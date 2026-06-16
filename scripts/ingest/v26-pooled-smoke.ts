/**
 * v26-pooled-smoke.ts — de-risks the B.5 cutover flip WITHOUT touching production.
 * Points the real Prisma client at the Neon POOLED endpoint (pgbouncer transaction
 * mode, as the flipped DATABASE_URL will be) and runs the exact query patterns the
 * smoke-test covers: app-data read (auth/User), idea read, and both search paths
 * (legislation + operational ftsVector). Proves the unified Neon target serves the
 * app through PgBouncer before Charlie flips the Vercel env.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}

function pooledUrl(direct: string): string {
  const u = new URL(direct)
  const host = u.hostname                       // ep-xxxx.eu-west-2.aws.neon.tech
  const first = host.indexOf('.')
  u.hostname = host.slice(0, first) + '-pooler' + host.slice(first)
  u.searchParams.set('sslmode', 'require')
  u.searchParams.set('pgbouncer', 'true')
  u.searchParams.set('connection_limit', '1')
  return u.toString()
}

async function main() {
  const direct = process.env.NEON_DATABASE_URL!
  const pooled = pooledUrl(direct)
  console.log('pooled endpoint host:', new URL(pooled).hostname)
  process.env.DATABASE_URL = pooled               // what the flip will set

  const { prisma } = await import('../../scrutinise-web/lib/prisma')

  // 1. app-data read (auth path reads User)
  const users = await prisma.user.count()
  const idea = await prisma.idea.findFirst({ select: { id: true, title: true, stage: true } })
  console.log(`✓ User.count via pooled = ${users}`)
  console.log(`✓ Idea.findFirst = ${idea ? `${idea.title?.slice(0, 40)} [${idea.stage}]` : 'none'}`)

  // 2. legislation search (the ftsVector GIN path)
  const leg = await prisma.$queryRawUnsafe<any[]>(`
    SELECT ls.id, li."legislationGovUkId" gid
    FROM "LegislationSection" ls JOIN "LegislationItem" li ON ls."legislationItemId"=li.id
    WHERE ls."ftsVector" @@ plainto_tsquery('english','data protection')
    ORDER BY ts_rank(ls."ftsVector", plainto_tsquery('english','data protection')) DESC LIMIT 3`)
  console.log(`✓ legislation search returned ${leg.length} (e.g. ${leg[0]?.gid})`)

  // 3. operational search (the other ftsVector path)
  const op = await prisma.$queryRawUnsafe<any[]>(`
    SELECT os.id FROM "OperationalSection" os
    WHERE os."ftsVector" @@ plainto_tsquery('english','police') LIMIT 3`)
  console.log(`✓ operational search returned ${op.length}`)

  await prisma.$disconnect()
  console.log('\nALL POOLED SMOKE CHECKS PASSED — the B.5 flip target is sound.')
}
main().catch(e => { console.error('POOLED SMOKE FAILED:', e); process.exit(1) })
