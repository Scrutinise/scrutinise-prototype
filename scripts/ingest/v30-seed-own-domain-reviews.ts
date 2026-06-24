/**
 * v30-seed-own-domain-reviews.ts — V30 §2. Flagship independent reviews on their
 * OWN microsites (Cass et al.), ingested into the EXISTING independent-reviews
 * corpus (reports-only, per-PDF rows) via the already-deployed inquiry-reports
 * PDF processor — no new processor code (the independent-reviews sourceType is
 * already wired). docId = "{key}#{seq}|{pdfUrl}".
 *
 *   --measure   per-review: resolve PDFs (pinned, else Wayback CDX); print
 *               findability. Seeds nothing.
 *   --pilot     measure + extract one resolvable review's lead PDF (word count).
 *   --seed      ⚠️ POST-PUSH only. One row per resolvable PDF into
 *               independent-reviews; bump the target est.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { pdfToText } from './shared/compile'
import { countWords } from './shared/db-metadata'
import { OWN_DOMAIN_REVIEWS, resolveReviewPdfs, fetchPdfBuffer } from './sources/own-domain-reviews'

const CORPUS = 'independent-reviews'

async function main() {
  const mode = process.argv.includes('--seed') ? 'seed' : process.argv.includes('--pilot') ? 'pilot' : 'measure'
  const resolved: Array<{ key: string; name: string; pdfs: Array<{ url: string; title: string }> }> = []
  for (const r of OWN_DOMAIN_REVIEWS) {
    const pdfs = await resolveReviewPdfs(r)
    resolved.push({ key: r.key, name: r.name, pdfs })
    const status = pdfs.length ? `${pdfs.length} PDFs` : `BLOCKED (${r.spa ? 'SPA' : 'no archive PDFs'}${r.archive === 'ukgwa' ? ', UKGWA-only' : ''})`
    console.log(`  ${pdfs.length ? '✓' : '✗'} ${r.key.padEnd(24)} ${status}  — ${r.name.slice(0, 48)}`)
  }
  const totalPdfs = resolved.reduce((s, r) => s + r.pdfs.length, 0)
  const findable = resolved.filter(r => r.pdfs.length)
  const blocked = resolved.filter(r => !r.pdfs.length)
  console.log(`\n${findable.length}/${OWN_DOMAIN_REVIEWS.length} reviews have archive-findable PDFs (${totalPdfs} PDFs).`)
  if (blocked.length) console.log(`PDF-route-blocked (identified, list for Charlie): ${blocked.map(r => r.key).join(', ')}`)

  if (mode === 'pilot') {
    const lead = findable[0]
    if (lead) {
      const buf = await fetchPdfBuffer(lead.pdfs[0].url)
      const text = buf ? await pdfToText(buf, lead.pdfs[0].url) : null
      console.log(`\nPILOT ${lead.key}: lead PDF → ${text ? countWords(text) : 0} words`)
    } else console.log('\nPILOT: no resolvable review to pilot (all PDF-route-blocked).')
  }
  if (mode !== 'seed') { await endNeonPool(); return }

  const rows: Array<{ id: string; corpus: string; docId: string; sourceType: string; priority: number }> = []
  for (const r of findable) for (let i = 0; i < r.pdfs.length; i++) {
    const seq = i + 1
    rows.push({ id: `${CORPUS}:${r.key}#${seq}`, corpus: CORPUS, docId: `${r.key}#${seq}|${r.pdfs[i].url}`, sourceType: CORPUS, priority: 3 })
  }
  if (rows.length === 0) { console.log('\nnothing resolvable to seed (all PDF-route-blocked).'); await endNeonPool(); return }
  const { affected } = await bulkInsertQueueRows(rows)
  const pool = getNeonPool()
  await pool.query(`
    UPDATE corpus_targets SET est_sections = est_sections + $2, est_is_confirmed = false,
      notes = 'V29 gov.uk discovery + V30 §2 own-domain microsites (Wayback web-archive PDFs); OGL/Crown, verified per site.', updated_at = NOW()
    WHERE corpus_key = $1
  `, [CORPUS, rows.length])
  console.log(`\n[own-domain-reviews] seeded ${affected}/${rows.length} PDF rows into ${CORPUS} (${findable.length} reviews)`)
  await endNeonPool()
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
