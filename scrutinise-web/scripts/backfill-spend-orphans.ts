// 26-S2 decision 193 (18 Oct 2026) - label the ledger rows that belong to ideas which no longer exist.
// They are the scratch copies the checks made and deleted. The ledger has no relation to Idea on purpose, so the rows survive the idea; what they
// lacked was a PURPOSE. We label them purpose = 'check' and set purposeInferred = true: nobody wrote "check" at the call site, we are inferring it
// from the fact that the idea is gone. An inference must never pass for a fact (same rule as attrSource).
//
//   npx tsx --env-file=.env scripts/backfill-spend-orphans.ts            (dry run)
//   npx tsx --env-file=.env scripts/backfill-spend-orphans.ts --apply
//
// Only rows with a purpose still NULL, an ideaId that no longer exists in "Idea", and a createdAt on/after 29 Sep. Rows of a LIVE idea are never touched.
import { prisma } from '../lib/prisma'

const SINCE = '2026-09-29'
const WHERE = `l."ideaId" IS NOT NULL AND l.purpose IS NULL AND l."createdAt" >= $1
      AND NOT EXISTS (SELECT 1 FROM "Idea" i WHERE i.id = l."ideaId")`

async function main() {
  const apply = process.argv.includes('--apply')
  const rows = await prisma.$queryRawUnsafe<Array<{ ideas: number; n: number; pence: string | null; users: number }>>(
    `SELECT count(DISTINCT l."ideaId")::int ideas, count(*)::int n, count(DISTINCT l."userId")::int users, round(sum(l."estCostPence")::numeric, 2)::text pence
       FROM "LlmSpend" l WHERE ${WHERE}`, SINCE)
  const r = rows[0]
  console.log(`${apply ? 'APPLYING' : 'DRY RUN'}: ${r.n} rows on ${r.ideas} deleted ideas (${r.users} distinct users), ${r.pence}p -> purpose='check', purposeInferred=true`)
  if (!apply) { console.log('Nothing changed. Add --apply to write.'); return }
  const n = await prisma.$executeRawUnsafe(
    `UPDATE "LlmSpend" l SET purpose = 'check', "purposeInferred" = true WHERE ${WHERE}`, SINCE)
  console.log(`updated ${n} rows`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
