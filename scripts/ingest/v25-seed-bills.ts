/**
 * v25-seed-bills.ts — V25 §4. UK Parliament Bills (bills-api.parliament.uk).
 *
 * Two-stage queue (committees-api pattern) — a single bill can carry hundreds of
 * publication PDFs (bill 3774 = 267 amendment papers/EN/memoranda), far too many
 * to extract within one row's 5-min budget:
 *   list:{billId}            → the worker enumerates that bill's PDFs, seeds
 *                              one content row per PDF.
 *   {billId}#{seq}|{url}     → the worker downloads+extracts ONE PDF → one section.
 *
 * Modes (predict-measure-commit):
 *   (default)   dry-run — enumerate bills, print total.
 *   --pilot N   sample N bills across the id range; count PDFs/bill (cheap) and
 *               download a subset to measure extractable-rate + words/PDF;
 *               extrapolate the section universe. No seed.
 *   --seed      insert one list:{billId} row per bill (P2). POST-PUSH only.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { listAllBills, listBillsPage, listBillPdfs, fetchBillPdf } from './sources/bills-parliament'
import { pdfToText } from './shared/compile'
import { countWords } from './shared/db-metadata'

const CORPUS = 'bills-api'
const SRC = 'bills-api'

async function main() {
  const seed = process.argv.includes('--seed')
  const pi = process.argv.indexOf('--pilot')
  const pilotN = pi >= 0 ? Number(process.argv[pi + 1]) : 0

  if (pilotN > 0) {
    const first = await listBillsPage(0, 1)
    if (!first) { console.log('bill list fetch failed'); await endNeonPool(); return }
    const total = first.total
    // sample bills evenly across the id space (skip offsets)
    const step = Math.max(1, Math.floor(total / pilotN))
    let pdfTotal = 0, billsSampled = 0
    let dlTried = 0, dlOk = 0, wordsOk = 0
    for (let skip = 0; skip < total && billsSampled < pilotN; skip += step) {
      const pg = await listBillsPage(skip, 1)
      if (!pg || pg.bills.length === 0) continue
      const b = pg.bills[0]
      const pdfs = await listBillPdfs(b.billId)
      if (!pdfs) continue
      billsSampled++; pdfTotal += pdfs.length
      // download up to 2 PDFs from this bill to measure extract-rate + words
      for (const p of pdfs.slice(0, 2)) {
        dlTried++
        const buf = await fetchBillPdf(p.url)
        if (!buf) continue
        const text = await pdfToText(buf, p.url)
        if (text && text.length >= 100) { dlOk++; wordsOk += countWords(text) }
      }
      console.log(`  bill ${b.billId} "${b.shortTitle.slice(0, 44)}": ${pdfs.length} PDFs`)
    }
    const avgPdf = pdfTotal / (billsSampled || 1)
    const extractRate = dlTried ? dlOk / dlTried : 0
    const wordsPerSec = dlOk ? wordsOk / dlOk : 0
    const estSections = Math.round(avgPdf * total * extractRate)
    console.log(`\nPILOT: ${billsSampled} bills sampled → avg ${avgPdf.toFixed(1)} PDFs/bill; extract-rate ${(extractRate * 100).toFixed(0)}% (${dlOk}/${dlTried}); ${wordsPerSec.toFixed(0)} words/section`)
    console.log(`total bills ${total.toLocaleString()}`)
    console.log(`PREDICTION ≈ ${estSections.toLocaleString()} sections (extractable PDFs), ≈ ${(estSections * wordsPerSec / 1e6).toFixed(1)}M words`)
    await endNeonPool(); return
  }

  const all = await listAllBills()
  if (!all) { console.log('bill enumeration failed'); await endNeonPool(); return }
  console.log(`enumerated ${all.length} bills`)

  if (!seed) { console.log('(dry-run — pass --pilot N to measure, --seed POST-PUSH to insert)'); await endNeonPool(); return }

  const rows = all.map(b => ({ id: `${CORPUS}:list:${b.billId}`, corpus: CORPUS, docId: `list:${b.billId}`, sourceType: SRC, priority: 2 }))
  const { affected } = await bulkInsertQueueRows(rows)
  const pool = getNeonPool()
  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, est_sections, est_is_confirmed, blocked, retired, display_label, notes)
    VALUES ($1, $2, false, false, false, $3, $4)
    ON CONFLICT (corpus_key) DO UPDATE SET blocked=false, notes=EXCLUDED.notes, display_label=EXCLUDED.display_label`,
    [CORPUS, 5000, 'UK Parliament Bills (texts, amendments, EN, memoranda)',
     `V25 §4: list:{billId} rows for ${all.length} bills → one section per publication PDF. OPL v3.0. est is the V21 placeholder; rebaseline at drain (per-PDF universe is much larger — bill 3774 alone = 267 PDFs).`])
  console.log(`seeded ${affected} new bill list rows (of ${all.length})`)
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
