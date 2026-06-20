/**
 * v29-postpush-monitor.ts — trigger Ingest (loads the new rate config + the
 * already-deployed processors) and poll corpus_sections per new corpus to canary
 * Railway egress on each new host. Reports sections-landed + queue failed/blocked
 * per sourceType, plus any tripped breakers.
 *
 *   default   trigger + poll ~14 min
 *   --watch   poll only (no trigger) — for re-checking later
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const INGEST_SERVICE_ID = process.env.INGEST_SERVICE_ID ?? 'a7f4d75f-d844-4e1c-8edf-2569346b31c9'
const ENV_ID = process.env.RAILWAY_ENVIRONMENT_ID ?? '991f733c-719c-4217-a6d6-1dbe80642bbe'

const NEW_SOURCES = ['erskine-may', 'early-day-motions', 'petitions', 'members-interests',
  'cps-guidance', 'independent-reviews', 'ofgem', 'ofcom', 'lgsco', 'govuk-content', 'ico', 'scottish-courts']
const NEW_CORPORA = ['erskine-may', 'early-day-motions', 'petitions', 'members-interests',
  'cps-guidance', 'independent-reviews', 'ofgem', 'ofcom', 'lgsco', 'quangos-govuk', 'hmrc-ancillary', 'ico', 'scottish-courts']

async function triggerIngest() {
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RAILWAY_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `mutation($s: String!, $e: String!){ serviceInstanceRedeploy(serviceId: $s, environmentId: $e) }`, variables: { s: INGEST_SERVICE_ID, e: ENV_ID } }),
  })
  const j = await res.json() as { errors?: Array<{ message: string }> }
  if (j.errors?.length) throw new Error(JSON.stringify(j.errors))
}

async function main() {
  const pool = getNeonPool()
  const watch = process.argv.includes('--watch')

  // baseline (pre-trigger) section counts so we measure DELTA
  const base = new Map<string, number>()
  const b = await pool.query<{ corpus: string; n: string }>(
    `SELECT corpus, COUNT(*)::text n FROM corpus_sections WHERE corpus = ANY($1) GROUP BY corpus`, [NEW_CORPORA])
  for (const r of b.rows) base.set(r.corpus, Number(r.n))

  if (!watch) {
    await triggerIngest()
    await pool.query(`INSERT INTO ingest_service_state (id, last_start_trigger, starts_on, starts_count) VALUES (1, NOW(), CURRENT_DATE, 1) ON CONFLICT (id) DO UPDATE SET last_start_trigger = NOW()`)
    console.log('[monitor] Ingest serviceInstanceRedeploy triggered (build ~1-2 min)…\n')
  }

  const deadline = Date.now() + 14 * 60_000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 30_000))
    const sec = await pool.query<{ corpus: string; n: string; words: string }>(
      `SELECT corpus, COUNT(*)::text n, COALESCE(SUM("wordCount"),0)::text words FROM corpus_sections WHERE corpus = ANY($1) GROUP BY corpus`, [NEW_CORPORA])
    const q = await pool.query<{ s: string; status: string; n: string }>(
      `SELECT "sourceType" s, status, COUNT(*)::text n FROM ingest_queue WHERE "sourceType" = ANY($1) GROUP BY 1,2`, [NEW_SOURCES])
    const beat = await pool.query<{ age: string }>(`SELECT (EXTRACT(EPOCH FROM (NOW()-last_beat))||'s') age FROM ingest_service_state WHERE id=1`)
    const secMap = new Map(sec.rows.map(r => [r.corpus, r]))
    const qmap = new Map<string, Record<string, string>>()
    for (const r of q.rows) { const m = qmap.get(r.s) ?? {}; m[r.status] = r.n; qmap.set(r.s, m) }

    const t = new Date().toISOString().slice(11, 19)
    console.log(`\n[${t}] beat ${beat.rows[0]?.age ?? '?'}`)
    for (const c of NEW_CORPORA) {
      const now = Number(secMap.get(c)?.n ?? 0)
      const delta = now - (base.get(c) ?? 0)
      console.log(`  ${c.padEnd(20)} sections ${String(now).padStart(7)} (Δ+${delta}) words ${secMap.get(c)?.words ?? 0}`)
    }
    const qline = NEW_SOURCES.map(s => { const m = qmap.get(s); return m ? `${s}:${Object.entries(m).map(([k, v]) => k[0] + v).join('/')}` : null }).filter(Boolean)
    console.log('  queue: ' + qline.join('  '))
  }

  // breaker check
  const br = await pool.query<{ corpus: string; reason: string }>(
    `SELECT corpus_key corpus, blocked_reason reason FROM corpus_targets WHERE blocked = true AND corpus_key = ANY($1)`, [NEW_CORPORA])
  if (br.rows.length) { console.log('\n⚠ BLOCKED corpora:'); for (const r of br.rows) console.log(`  ${r.corpus}: ${r.reason}`) }
  else console.log('\nno new-corpus breakers tripped.')
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
