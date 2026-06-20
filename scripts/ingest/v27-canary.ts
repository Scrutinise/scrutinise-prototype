/**
 * v27-canary.ts — V27 post-push canary. Seeds 5 real scottish-courts + 5 real
 * ico rows (a subset of the full seeds — idempotent, the full --seed later skips
 * them), triggers the Ingest service the same way Ops does
 * (serviceInstanceRedeploy), and polls corpus_sections for both corpora to
 * confirm Railway egress + extraction before the full seeds.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { searchJudgmentsPage, linkToKey } from './sources/scottish-courts'
import { enumerateIcoLeaves } from './sources/ico'

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const INGEST_SERVICE_ID = process.env.INGEST_SERVICE_ID ?? 'a7f4d75f-d844-4e1c-8edf-2569346b31c9'
const ENV_ID = process.env.RAILWAY_ENVIRONMENT_ID ?? '991f733c-719c-4217-a6d6-1dbe80642bbe'

async function triggerIngest() {
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RAILWAY_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation($s: String!, $e: String!){ serviceInstanceRedeploy(serviceId: $s, environmentId: $e) }`,
      variables: { s: INGEST_SERVICE_ID, e: ENV_ID },
    }),
  })
  const j = await res.json() as { errors?: Array<{ message: string }> }
  if (j.errors?.length) throw new Error(JSON.stringify(j.errors))
}

async function main() {
  const pool = getNeonPool()

  // ── seed 5 scottish-courts ──────────────────────────────────────────────────
  const sc = await searchJudgmentsPage(1, 50)
  if (!sc) throw new Error('scottish-courts search failed')
  const scRows = sc.entries.slice(0, 5).map(e => {
    const key = linkToKey(e.documentLink)
    return { id: `scottish-courts:${key}`, corpus: 'scottish-courts', docId: `${key}|${e.date ?? ''}|${e.court ?? ''}`, sourceType: 'scottish-courts', priority: 4 }
  })
  const scIns = await bulkInsertQueueRows(scRows)
  console.log(`[canary] scottish-courts: seeded ${scIns.affected}/5 rows`)

  // ── seed 5 ico (mix decision-notices + enforcement) ─────────────────────────
  const leaves = await enumerateIcoLeaves()
  const enf = leaves.filter(l => l.category === 'enforcement').slice(0, 2)
  const dn = leaves.filter(l => l.category === 'decision-notices').slice(0, 3)
  const icoRows = [...enf, ...dn].map(l => ({ id: `ico:${l.path}`, corpus: 'ico', docId: l.path, sourceType: 'ico', priority: 4 }))
  const icoIns = await bulkInsertQueueRows(icoRows)
  console.log(`[canary] ico: seeded ${icoIns.affected}/${icoRows.length} rows`)

  // ── trigger Ingest (mimic Ops; set last_start_trigger so Ops won't double) ──
  await triggerIngest()
  await pool.query(`
    INSERT INTO ingest_service_state (id, last_start_trigger, starts_on, starts_count)
    VALUES (1, NOW(), CURRENT_DATE, 1)
    ON CONFLICT (id) DO UPDATE SET last_start_trigger = NOW()
  `)
  console.log('[canary] Ingest serviceInstanceRedeploy triggered — polling (build ~1-2 min)…\n')

  // ── poll ────────────────────────────────────────────────────────────────────
  const deadline = Date.now() + 10 * 60_000
  let scDone = false, icoDone = false
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 30_000))
    const q = await pool.query<{ corpus: string; n: string; words: string }>(`
      SELECT corpus, COUNT(*)::text n, COALESCE(SUM("wordCount"),0)::text words
      FROM corpus_sections WHERE corpus IN ('scottish-courts','ico') GROUP BY corpus`)
    const qr = await pool.query<{ sourceType: string; status: string; n: string }>(`
      SELECT "sourceType", status, COUNT(*)::text n FROM ingest_queue
      WHERE "sourceType" IN ('scottish-courts','ico') GROUP BY "sourceType", status ORDER BY 1,2`)
    const beat = await pool.query<{ age: string }>(`SELECT (EXTRACT(EPOCH FROM (NOW()-last_beat))||'s') age FROM ingest_service_state WHERE id=1`)
    const secMap = new Map(q.rows.map(r => [r.corpus, r]))
    const t = new Date().toISOString().slice(11, 19)
    console.log(`[${t}] beat ${beat.rows[0]?.age ?? '?'} | sections: scottish-courts=${secMap.get('scottish-courts')?.n ?? 0} (${secMap.get('scottish-courts')?.words ?? 0}w) ico=${secMap.get('ico')?.n ?? 0} (${secMap.get('ico')?.words ?? 0}w) | queue: ${qr.rows.map(r => `${r.sourceType.slice(0,4)}/${r.status}=${r.n}`).join(' ')}`)
    scDone = (secMap.get('scottish-courts')?.n ?? '0') !== '0'
    icoDone = (secMap.get('ico')?.n ?? '0') !== '0'
    if (scDone && icoDone) break
  }

  console.log('')
  console.log(`[canary] VERDICT — scottish-courts egress: ${scDone ? '✅ sections written' : '❌ NO sections (Railway egress to www.scotcourts.gov.uk?)'}`)
  console.log(`[canary] VERDICT — ico egress:             ${icoDone ? '✅ sections written' : '❌ NO sections (Railway egress to ico.org.uk?)'}`)
  // sample one of each
  for (const c of ['scottish-courts', 'ico']) {
    const s = await pool.query(`SELECT id, "wordCount", status, format FROM corpus_sections WHERE corpus=$1 ORDER BY "wordCount" DESC LIMIT 2`, [c])
    if (s.rows.length) { console.log(`  ${c} sample:`); console.table(s.rows) }
  }
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
