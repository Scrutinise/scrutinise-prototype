/**
 * v29-state-check.ts — V29 opening diagnostics.
 *  §0  legacy Legislation* table presence (DROP/soak state)
 *  §1  ico + scottish-courts failed-row triage: counts, lastError histogram,
 *      a sample of failing docIds to investigate live.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()

  // ── §0 DROP state ──────────────────────────────────────────────────────────
  const legacy = await pool.query<{ table_name: string }>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name ILIKE 'Legislation%'
    ORDER BY table_name`)
  console.log('=== §0 legacy Legislation* tables on Neon ===')
  console.log(legacy.rows.length ? legacy.rows.map(r => '  ' + r.table_name).join('\n') : '  (none — DROP appears to have fired)')

  // ── queue status by sourceType for the two corpora ─────────────────────────
  for (const src of ['ico', 'scottish-courts']) {
    console.log(`\n=== ${src} — ingest_queue status ===`)
    const st = await pool.query<{ status: string; n: string }>(
      `SELECT status, COUNT(*)::text n FROM ingest_queue WHERE "sourceType"=$1 GROUP BY status ORDER BY 2 DESC`, [src])
    console.table(st.rows)

    console.log(`--- ${src} failed lastError histogram (top 15) ---`)
    const hist = await pool.query<{ err: string; n: string }>(
      `SELECT COALESCE(LEFT("lastError", 60),'(null)') err, COUNT(*)::text n
       FROM ingest_queue WHERE "sourceType"=$1 AND status='failed'
       GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 15`, [src])
    console.table(hist.rows)

    console.log(`--- ${src} sample failed docIds (12) ---`)
    const sample = await pool.query<{ docId: string; attempts: number; lastError: string }>(
      `SELECT "docId", attempts, LEFT("lastError",80) "lastError"
       FROM ingest_queue WHERE "sourceType"=$1 AND status='failed'
       ORDER BY random() LIMIT 12`, [src])
    for (const r of sample.rows) console.log(`  [${r.attempts}] ${r.docId}  — ${r.lastError}`)
  }

  // corpus_sections already landed for these corpora
  console.log('\n=== sections landed so far ===')
  const sec = await pool.query<{ corpus: string; status: string; n: string; words: string }>(`
    SELECT corpus, status, COUNT(*)::text n, COALESCE(SUM("wordCount"),0)::text words
    FROM corpus_sections WHERE corpus IN ('ico','scottish-courts')
    GROUP BY corpus, status ORDER BY corpus, status`)
  console.table(sec.rows)

  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
