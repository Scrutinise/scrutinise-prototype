/**
 * v29-seed-independent-reviews.ts — V29 §5. Commissioned independent reviews /
 * audits (gov.uk-published, OGL v3.0). New sourceType + corpus
 * 'independent-reviews', reusing the inquiry-reports per-PDF machinery.
 *
 *   --measure   build the verified universe (registry ∪ gov.uk discovery, each
 *               PDF-verified live); print review + PDF counts. Seeds nothing.
 *   --pilot     measure + extract ONE review's lead PDF end-to-end. Seeds nothing.
 *   --seed      ⚠️ POST-PUSH only. One row per report PDF, upsert the target.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { pdfToText } from './shared/compile'
import { countWords } from './shared/db-metadata'
import { REVIEW_REGISTRY, discoverReviewPaths, listInquiryPdfs, fetchPdfBuffer } from './sources/independent-reviews'

const CORPUS = 'independent-reviews'

interface Verified { key: string; name: string; path: string; pdfs: Array<{ seq: number; url: string; title: string }> }

function keyFromPath(path: string): string {
  return path.replace(/^government\/publications\//, '').slice(0, 60)
}

async function buildUniverse(): Promise<Verified[]> {
  const out: Verified[] = []
  // 1. curated registry — PDF-verify each
  for (const r of REVIEW_REGISTRY) {
    const pdfs = await listInquiryPdfs(r.govukPath)
    if (pdfs && pdfs.length > 0) out.push({ key: r.key, name: r.name, path: r.govukPath, pdfs })
    else console.log(`  ⚠ registry ${r.key}: no PDFs at ${r.govukPath} (dropped)`)
    await new Promise(r => setTimeout(r, 150))
  }
  // 2. gov.uk discovery — PDF-verify each new candidate
  const discovered = await discoverReviewPaths()
  console.log(`  discovery: ${discovered.length} candidate paths (title ~ review/audit)`)
  const seen = new Set(out.map(v => v.path))
  for (const d of discovered) {
    if (seen.has(d.path)) continue
    const pdfs = await listInquiryPdfs(d.path)
    if (pdfs && pdfs.length > 0) { out.push({ key: keyFromPath(d.path), name: d.title, path: d.path, pdfs }); seen.add(d.path) }
    await new Promise(r => setTimeout(r, 120))
  }
  return out
}

async function main() {
  const mode = process.argv.includes('--seed') ? 'seed' : process.argv.includes('--pilot') ? 'pilot' : 'measure'
  const universe = await buildUniverse()
  const totalPdfs = universe.reduce((s, v) => s + v.pdfs.length, 0)
  console.log(`\nverified universe: ${universe.length} reviews / ${totalPdfs} report PDFs`)
  for (const v of universe.slice(0, 40)) console.log(`  [${v.pdfs.length} pdf] ${v.name.slice(0, 56)}`)

  if (mode === 'pilot') {
    const lead = universe[0]
    if (lead) {
      const buf = await fetchPdfBuffer(lead.pdfs[0].url)
      const text = buf ? await pdfToText(buf, lead.pdfs[0].url) : null
      console.log(`\nPILOT ${lead.key}: lead PDF → ${text ? countWords(text) : 0} words`)
      if (text) console.log('  ' + text.slice(0, 200).replace(/\s+/g, ' '))
    }
  }
  if (mode !== 'seed') { await endNeonPool(); return }

  const rows: any[] = []
  for (const v of universe) for (const p of v.pdfs) {
    rows.push({ id: `${CORPUS}:${v.key}#${p.seq}`, corpus: CORPUS, docId: `${v.key}#${p.seq}|${p.url}`, sourceType: CORPUS, priority: 3 })
  }
  const { affected } = await bulkInsertQueueRows(rows)
  const pool = getNeonPool()
  await pool.query(`
    INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, priority, blocked, retired, notes, updated_at)
    VALUES ($1, 'Independent reviews & audits', $2, false, 3, false, false, 'V29 §5 — commissioned independent reviews, gov.uk OGL v3.0 (registry + discovery, PDF-verified)', NOW())
    ON CONFLICT (corpus_key) DO UPDATE SET est_sections = $2, est_is_confirmed = false, blocked = false, blocked_reason = NULL, updated_at = NOW()
  `, [CORPUS, totalPdfs])
  console.log(`\n[independent-reviews] seeded ${affected}/${rows.length} PDF rows across ${universe.length} reviews; target est≈${totalPdfs}`)
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
