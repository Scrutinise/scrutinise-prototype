/**
 * v24-seed-inquiry-reports.ts — V24 §5 first real inquiry seed. One queue row per
 * report PDF for the concluded major inquiries in INQUIRY_REGISTRY.
 *
 *   (default)  dry-run — enumerate each inquiry's report PDFs, print counts.
 *   --seed     insert per-PDF rows + upsert the inquiry-reports corpus_target.
 *
 * NEW sourceType (inquiry-reports) → must be seeded POST-PUSH (the live worker
 * would markSkipped an unknown sourceType). See the sprint POST-PUSH run order.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { INQUIRY_REGISTRY, listInquiryPdfs } from './sources/inquiry-reports'

const CORPUS = 'inquiry-reports'

async function main() {
  const seed = process.argv.includes('--seed')
  const rows: Array<{ id: string; corpus: string; docId: string; sourceType: string; priority: number }> = []
  let totalPdfs = 0

  for (const inq of INQUIRY_REGISTRY) {
    const pdfs = await listInquiryPdfs(inq.govukPath)
    if (pdfs === null) { console.log(`  ${inq.key.padEnd(22)} FETCH FAILED (${inq.govukPath})`); continue }
    totalPdfs += pdfs.length
    console.log(`  ${inq.key.padEnd(22)} ${String(pdfs.length).padStart(3)} report PDFs  [${inq.status}]  ${inq.name}`)
    for (const p of pdfs) {
      rows.push({
        id: `${CORPUS}:${inq.key}:${p.seq}`,
        corpus: CORPUS,
        docId: `${inq.key}#${p.seq}|${p.url}`,
        sourceType: CORPUS,
        priority: 3,
      })
    }
  }
  console.log(`\n${INQUIRY_REGISTRY.length} inquiries → ${totalPdfs} report PDFs (= ${totalPdfs} sections, one per volume)`)

  if (!seed) { console.log('(dry-run; pass --seed POST-PUSH)'); await endNeonPool(); return }

  const pool = getNeonPool()
  const { affected } = await bulkInsertQueueRows(rows)
  // Seeded universe is the inquiry-reports denominator (brief §5 — rebaseline
  // from what's seeded). est_is_confirmed stays false until the corpus drains.
  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, est_sections, est_is_confirmed, blocked, retired, display_label, notes)
    VALUES ($1, $2, false, false, false, $3, $4)
    ON CONFLICT (corpus_key) DO UPDATE SET
      est_sections = EXCLUDED.est_sections, display_label = EXCLUDED.display_label, notes = EXCLUDED.notes`,
    [CORPUS, totalPdfs, 'Public inquiry reports (final reports; reports-only)',
     `V24 §5 first seed: ${INQUIRY_REGISTRY.length} concluded major inquiries, ${totalPdfs} report-volume PDFs via gov.uk publication attachments (OGL v3.0). One section per volume. Evidence bundles deferred. Grenfell/dark-site own-domain reports need a Web Archive adapter (follow-up).`])
  console.log(`seeded ${affected} inquiry-reports rows; corpus_target est=${totalPdfs}`)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
