/**
 * v30-seed-cma-cases.ts — V30 §1.1: Competition & Markets Authority cases &
 * decisions (gov.uk cma_case finder; incl. OIM + SAU). New sourceType + corpus
 * 'cma-cases'. Licence OGL v3.0 (VERIFIED — CMA is a non-ministerial dept, Crown
 * copyright; gov.uk/help/terms-conditions). Per-PDF decision-doc rows + a body
 * overview row per case.
 *
 *   --pilot     enumerate cases; sample 12 for avg PDFs/case + body words; run ONE
 *               case end-to-end (body + lead decision PDF, word count); predict.
 *   --measure   enumerate + sample 60 for a tighter avg; predict. Seeds nothing.
 *   --seed      ⚠️ POST-PUSH only. Fetch every case once → body row + per-PDF rows;
 *               upsert the target. Idempotent (ON CONFLICT).
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { pdfToText } from './shared/compile'
import { countWords } from './shared/db-metadata'
import { enumerateCmaCases, fetchCmaCase, fetchPdfBuffer } from './sources/cma-cases'

const CORPUS = 'cma-cases'

async function main() {
  const mode = process.argv.includes('--seed') ? 'seed' : process.argv.includes('--measure') ? 'measure' : 'pilot'
  const cases = await enumerateCmaCases(n => { if (n % 1000 === 0) console.log(`  …enumerated ${n}`) })
  console.log(`enumerated ${cases.length} CMA cases (cma_case; incl. OIM/SAU)`)

  if (mode !== 'seed') {
    const sampleN = mode === 'measure' ? 60 : 12
    const step = Math.max(1, Math.floor(cases.length / sampleN))
    const sample = cases.filter((_, i) => i % step === 0).slice(0, sampleN)
    let pdfTotal = 0, bodyWords = 0, ok = 0, withPdfs = 0
    for (const c of sample) {
      const full = await fetchCmaCase(c.slug)
      if (!full) { console.log(`  ✗ ${c.slug} — fetch failed`); continue }
      ok++; pdfTotal += full.pdfs.length; bodyWords += countWords(full.body)
      if (full.pdfs.length > 0) withPdfs++
      await new Promise(r => setTimeout(r, 150))
    }
    const avgPdfs = ok ? pdfTotal / ok : 0
    const avgBody = ok ? Math.round(bodyWords / ok) : 0
    console.log(`\nsample ${ok}/${sample.length}: avg ${avgPdfs.toFixed(1)} PDFs/case, ${withPdfs}/${ok} have ≥1 PDF, avg body ${avgBody} words`)
    const estSections = Math.round(cases.length * (1 + avgPdfs))
    console.log(`PREDICTION: ${cases.length} overview + ~${Math.round(cases.length * avgPdfs)} decision-PDF sections = ~${estSections} sections`)

    if (mode === 'pilot') {
      const lead = (await Promise.all(sample.slice(0, 6).map(c => fetchCmaCase(c.slug))))
        .find(c => c && c.pdfs.length > 0 && c.body.length > 200) || null
      if (lead) {
        const buf = await fetchPdfBuffer(lead.pdfs[0].url)
        const ptext = buf ? await pdfToText(buf, lead.pdfs[0].url) : null
        console.log(`\nPILOT ${lead.slug}: body ${countWords(lead.body)} words | lead PDF "${lead.pdfs[0].title.slice(0, 40)}" → ${ptext ? countWords(ptext) : 0} words`)
        console.log('  body: ' + lead.body.slice(0, 180).replace(/\s+/g, ' '))
      }
    }
    await endNeonPool(); return
  }

  // ── seed (POST-PUSH) ─────────────────────────────────────────────────────────
  const rows: Array<{ id: string; corpus: string; docId: string; sourceType: string; priority: number }> = []
  let withPdfs = 0, pdfTotal = 0, fetched = 0
  for (const c of cases) {
    const full = await fetchCmaCase(c.slug)
    if (!full) { console.log(`  ⚠ ${c.slug}: fetch failed (skipped)`); continue }
    fetched++
    rows.push({ id: `${CORPUS}:${c.slug}#overview`, corpus: CORPUS, docId: `${c.slug}#overview`, sourceType: CORPUS, priority: 3 })
    if (full.pdfs.length > 0) withPdfs++
    for (const p of full.pdfs) {
      pdfTotal++
      rows.push({ id: `${CORPUS}:${c.slug}#${p.seq}`, corpus: CORPUS, docId: `${c.slug}#${p.seq}|${p.url}`, sourceType: CORPUS, priority: 3 })
    }
    if (fetched % 250 === 0) console.log(`  …fetched ${fetched}/${cases.length} cases, ${rows.length} rows so far`)
    await new Promise(r => setTimeout(r, 120))
  }
  const { affected } = await bulkInsertQueueRows(rows)
  const est = rows.length
  const pool = getNeonPool()
  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, retired, notes, updated_at)
    VALUES ($1, 'CMA / OIM / SAU cases & decisions', $2, false, 3, false, false, 'V30 §1.1 — gov.uk cma_case finder, OGL v3.0 (non-ministerial dept Crown copyright). Body overview + per-PDF decision docs.', NOW())
    ON CONFLICT (corpus_key) DO UPDATE SET est_sections = $2, est_is_confirmed = false, blocked = false, blocked_reason = NULL, updated_at = NOW()
  `, [CORPUS, est])
  console.log(`\n[cma-cases] seeded ${affected}/${rows.length} rows across ${fetched} cases (${withPdfs} with PDFs, ${pdfTotal} decision PDFs); target est≈${est}`)
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
