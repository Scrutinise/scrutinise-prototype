/**
 * diag-v18.ts — V18 §1 carry-over verification queries (read-only).
 *
 * 1. corpus_sections count vs legacy LegislationSection count — resolves the
 *    884,982 vs 1,790,298 discrepancy (email total = legacy + new pipeline).
 * 2. echr-hudoc V17 verification test rows in ingest_queue.
 * 3. tna-caselaw pre-V4 overhang rows (page > true last page ~1501).
 * 4. source_status breaker state.
 *
 * Run:
 *   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
 *     --tsconfig scripts/tsconfig.json scripts/ingest/diag-v18.ts
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()

  console.log('=== 1. Count discrepancy ===')
  const cs = await pool.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM corpus_sections')
  const leg = await pool.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM "LegislationSection"')
  const csN = parseInt(cs.rows[0].n, 10)
  const legN = parseInt(leg.rows[0].n, 10)
  console.log(`  corpus_sections:            ${csN.toLocaleString()}`)
  console.log(`  LegislationSection (legacy): ${legN.toLocaleString()}`)
  console.log(`  sum (email grand total):     ${(csN + legN).toLocaleString()}`)
  console.log(`  V17 report said:             884,982 (corpus_sections only)`)
  console.log(`  hourly email said:           1,790,298 (grand total)`)

  console.log('\n=== 2. echr-hudoc rows in ingest_queue ===')
  const echr = await pool.query(
    `SELECT id, status, "lastError", "createdAt" FROM ingest_queue WHERE corpus = 'echr-hudoc' ORDER BY id`
  )
  for (const r of echr.rows) {
    console.log(`  ${String(r.id).padEnd(28)} ${String(r.status).padEnd(8)} ${String(r.lastError ?? '').slice(0, 60)}  created ${new Date(r.createdAt).toISOString()}`)
  }
  console.log(`  total: ${echr.rowCount}`)

  console.log('\n=== 3. tna-caselaw overhang ===')
  const maxDoc = await pool.query<{ docId: string }>(
    `SELECT "docId" FROM ingest_queue WHERE corpus = 'tna-caselaw' ORDER BY "docId" DESC LIMIT 1`
  )
  console.log(`  max docId (lexicographic, discovery cursor): ${maxDoc.rows[0]?.docId}`)
  const caselawDist = await pool.query<{ bucket: string; status: string; n: string }>(`
    SELECT CASE WHEN (substring("docId" from 'page:(\\d+)'))::int > 1501 THEN 'page>1501 (overhang)'
                ELSE 'page<=1501 (real)' END AS bucket,
           status, COUNT(*)::text AS n
    FROM ingest_queue
    WHERE corpus = 'tna-caselaw' AND "docId" LIKE 'page:%'
    GROUP BY 1, 2 ORDER BY 1, 2
  `)
  for (const r of caselawDist.rows) {
    console.log(`  ${r.bucket.padEnd(22)} ${r.status.padEnd(8)} ${r.n}`)
  }
  const nonPage = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM ingest_queue WHERE corpus = 'tna-caselaw' AND "docId" NOT LIKE 'page:%'`
  )
  console.log(`  non-page docIds: ${nonPage.rows[0].n}`)
  const caselawSections = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM corpus_sections WHERE corpus = 'tna-caselaw'`
  )
  console.log(`  tna-caselaw corpus_sections: ${parseInt(caselawSections.rows[0].n, 10).toLocaleString()}`)

  console.log('\n=== 4. source_status (breakers) ===')
  const ss = await pool.query(
    `SELECT source_key, state, trip_reason, tripped_at, zero_output_streak FROM source_status ORDER BY source_key`
  )
  for (const r of ss.rows) {
    console.log(`  ${String(r.source_key).padEnd(22)} ${String(r.state).padEnd(8)} streak=${r.zero_output_streak}  ${String(r.trip_reason ?? '').slice(0, 70)}`)
  }

  console.log('\n=== 5. queue summary ===')
  const q = await pool.query<{ status: string; n: string }>(
    `SELECT status, COUNT(*)::text AS n FROM ingest_queue GROUP BY status ORDER BY status`
  )
  for (const r of q.rows) console.log(`  ${r.status.padEnd(8)} ${parseInt(r.n, 10).toLocaleString()}`)

  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
