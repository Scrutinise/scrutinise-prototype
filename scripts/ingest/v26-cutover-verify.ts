/**
 * v26-cutover-verify.ts — confirms the B.5 cutover took effect after Charlie
 * flipped the Vercel env to Neon:
 *  1. Live production API (public, DB-backed) returns data → the deployed app is
 *     reading its DATABASE_URL (now Neon) successfully.
 *  2. Railway scrutinise-db shows no app connections → the app stopped reading it.
 *  3. Neon connection snapshot (sanity).
 * READ-ONLY.
 */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}

const PROD = process.env.NEXT_PUBLIC_APP_URL || 'https://www.scrutinise.org'

function mk(url: string) { return new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 2,
  statement_timeout: 30_000, query_timeout: 30_000, idleTimeoutMillis: 5_000, connectionTimeoutMillis: 15_000 }) }

async function main() {
  // 1. production endpoint (public, reads the DB)
  console.log(`=== 1. production API probe (${PROD}) ===`)
  for (const p of ['/api/legislation/search?q=data%20protection', '/api/legislation/search?q=housing']) {
    try {
      const t0 = Date.now()
      const res = await fetch(PROD + p, { headers: { 'User-Agent': 'Scrutinise-cutover-verify/1.0' } })
      const ms = Date.now() - t0
      const body = await res.text()
      let n = -1
      try { n = (JSON.parse(body).items ?? []).length } catch {}
      console.log(`  GET ${p} → HTTP ${res.status} (${ms}ms) | items=${n}${n < 0 ? ` | body[0..120]=${body.slice(0, 120)}` : ''}`)
    } catch (e: any) { console.log(`  GET ${p} → FETCH ERROR ${e.message}`) }
  }

  // 2. Railway scrutinise-db app connections (should be ~none post-cutover)
  console.log('\n=== 2. Railway scrutinise-db pg_stat_activity (non-self app connections) ===')
  const rail = mk(process.env.DATABASE_URL!)
  try {
    const r = await rail.query(`
      SELECT usename, application_name, state, count(*)::int n,
             max(now()-state_change) AS idle_for
      FROM pg_stat_activity
      WHERE datname = current_database() AND pid <> pg_backend_pid()
      GROUP BY usename, application_name, state ORDER BY n DESC`)
    if (r.rows.length === 0) console.log('  (no other connections — app no longer attached to Railway ✓)')
    else console.table(r.rows)
  } catch (e: any) { console.log('  Railway query err:', e.message.split('\n')[0]) }
  await rail.end()

  // 3. Neon snapshot
  console.log('\n=== 3. Neon pg_stat_activity (connection count by app) ===')
  const neon = mk(process.env.NEON_DATABASE_URL!)
  try {
    const r = await neon.query(`
      SELECT application_name, state, count(*)::int n FROM pg_stat_activity
      WHERE datname=current_database() AND pid <> pg_backend_pid()
      GROUP BY application_name, state ORDER BY n DESC LIMIT 15`)
    console.table(r.rows)
  } catch (e: any) { console.log('  Neon query err:', e.message.split('\n')[0]) }
  await neon.end()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
