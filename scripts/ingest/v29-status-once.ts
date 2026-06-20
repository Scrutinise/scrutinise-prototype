/** v29-status-once.ts — one-shot egress canary read: sections + queue per new corpus. */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const CORPORA = ['erskine-may', 'early-day-motions', 'petitions', 'members-interests',
  'cps-guidance', 'independent-reviews', 'ofgem', 'ofcom', 'lgsco', 'quangos-govuk', 'hmrc-ancillary', 'ico', 'scottish-courts']
const SOURCES = ['erskine-may', 'early-day-motions', 'petitions', 'members-interests',
  'cps-guidance', 'independent-reviews', 'ofgem', 'ofcom', 'lgsco', 'govuk-content', 'ico', 'scottish-courts']

async function main() {
  const pool = getNeonPool()
  const sec = await pool.query<{ corpus: string; n: string; words: string; mx: string }>(
    `SELECT corpus, COUNT(*)::text n, COALESCE(SUM("wordCount"),0)::text words, COALESCE(MAX("wordCount"),0)::text mx
     FROM corpus_sections WHERE corpus = ANY($1) AND "compiledAt" > NOW() - INTERVAL '40 minutes' GROUP BY corpus ORDER BY corpus`, [CORPORA])
  console.log('=== sections compiled in the last 40 min (egress canary) ===')
  for (const r of sec.rows) console.log(`  ${r.corpus.padEnd(20)} +${String(r.n).padStart(6)} sections, ${r.words} words (max sec ${r.mx})`)
  if (!sec.rows.length) console.log('  (none yet — worker may still be building/starting)')

  const q = await pool.query<{ s: string; status: string; n: string }>(
    `SELECT "sourceType" s, status, COUNT(*)::text n FROM ingest_queue WHERE "sourceType" = ANY($1) GROUP BY 1,2 ORDER BY 1,2`, [SOURCES])
  const m = new Map<string, Record<string, string>>()
  for (const r of q.rows) { const o = m.get(r.s) ?? {}; o[r.status] = r.n; m.set(r.s, o) }
  console.log('\n=== queue status per sourceType ===')
  for (const s of SOURCES) { const o = m.get(s); if (o) console.log(`  ${s.padEnd(20)} ${Object.entries(o).map(([k, v]) => `${k}=${v}`).join('  ')}`) }

  const beat = await pool.query<{ age: string }>(`SELECT (EXTRACT(EPOCH FROM (NOW()-last_beat))||'s') age FROM ingest_service_state WHERE id=1`)
  console.log(`\ningest heartbeat age: ${beat.rows[0]?.age ?? '?'}`)
  const br = await pool.query<{ c: string; r: string }>(`SELECT corpus_key c, blocked_reason r FROM corpus_targets WHERE blocked = true AND corpus_key = ANY($1)`, [CORPORA])
  console.log(br.rows.length ? `⚠ blocked: ${br.rows.map(x => x.c).join(', ')}` : 'no new-corpus breakers tripped.')
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
