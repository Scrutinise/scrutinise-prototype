/**
 * v22-probe-echr.ts — V22 §2: one-judgment end-to-end probe through the
 * production code path (predict-measure-commit) BEFORE the full seed.
 *
 * Takes an itemid (default: 001-244851, HORA v UK judgment 2025), runs the
 * exact processEchr logic locally (metadata query → pdf conversion →
 * pdfToText → R2 put → Neon upsert with licence default), then reads both
 * stores back and prints the evidence.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { getDocMeta, fetchDocPdf } from './sources/echr-hudoc'
import { pdfToText } from './shared/compile'
import { r2Put, r2Get, compiledKey } from './shared/r2-client'
import { upsertSection, sectionId, countWords } from './shared/db-metadata'

const CORPUS = 'echr-hudoc'

async function main() {
  const itemId = process.argv[2] ?? '001-244851'
  const pageUrl = `https://hudoc.echr.coe.int/eng#{"itemid":["${itemId}"]}`

  console.log(`[probe] itemid ${itemId}`)
  const meta = await getDocMeta(itemId)
  if (!meta) throw new Error('metadata query failed')
  console.log(`[probe] meta: ${meta.docName} | ${meta.date} | doctype ${meta.docType} | importance ${meta.importance}`)

  const pdf = await fetchDocPdf(itemId)
  if (!pdf) throw new Error('pdf conversion failed')
  console.log(`[probe] pdf: ${pdf.length} bytes`)

  const text = await pdfToText(pdf, `${itemId}.pdf`)
  if (!text || text.length < 100) throw new Error('no extractable text')
  console.log(`[probe] text: ${text.length} chars, ${countWords(text)} words`)
  console.log(`[probe] head: ${text.slice(0, 200).replace(/\s+/g, ' ')}`)
  // §14 adversarial check — non-ASCII fidelity
  for (const probe of ['§', '£', '“', '—', 'é']) {
    if (text.includes(probe)) console.log(`[probe] fidelity: contains ${probe}`)
  }

  const cKey = compiledKey(CORPUS, itemId, '1')
  await r2Put(cKey, text)
  await upsertSection({
    id: sectionId(CORPUS, itemId, '1'),
    corpus: CORPUS,
    sourceUrl: pageUrl,
    r2Key: cKey,
    wordCount: countWords(text),
    status: 'compiled',
    format: 'pdf',
    sectionTitle: meta.docName || undefined,
    itemDate: meta.date ? meta.date.slice(0, 10) : undefined,
    parentDocId: itemId,
  })

  // read-back evidence
  const roundTrip = await r2Get(cKey)
  console.log(`[probe] R2 round-trip: ${roundTrip?.length === text.length ? 'IDENTICAL length' : 'MISMATCH'}`)
  const pool = getNeonPool()
  const r = await pool.query(
    `SELECT id, status, "wordCount", licence, attribution, "sectionTitle", "itemDate", format
     FROM corpus_sections WHERE id = $1`, [sectionId(CORPUS, itemId, '1')])
  console.log('[probe] Neon row:', JSON.stringify(r.rows[0]))
  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
