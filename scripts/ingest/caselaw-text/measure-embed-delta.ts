/**
 * measure-embed-delta.ts — what the stylesheet costs the MEANING-BASED half, and what re-embedding
 * would cost in money. WRITES NOTHING.
 *
 * The keyword half is easy to reason about: the CSS is in the indexed body, so `font-family` is a
 * searchable term. The vector half is worse and less obvious, and it is worse because of a cap:
 * `chunk.ts` emits at most MAX_CHUNKS (8) windows of WINDOW_CHARS (3,200) per section, so only the
 * first ~22,240 characters of any judgment are ever embedded. A 2,000–3,400-character stylesheet
 * at the head therefore does two things at once — it fills chunk 0 with declarations, and it
 * pushes the same number of characters of real judgment off the end of the cap entirely.
 *
 * This measures both, per document, and prices the re-embed at the Batch-API rate the corpus embed
 * was costed at (docs/VECTOR_EMBED_REPORT.md §1: gemini-embedding-001, $0.075/1M input tokens).
 *
 * Run: --n=300
 */
import { namesPool, endNamesPool } from '../names/names-pool'
import { r2Get } from '../shared/r2-client'
import { aknJudgmentText } from '../shared/akn-text'
import { styleChars } from '../shared/style-detect'
import { chunkBody, MAX_CHUNKS, WINDOW_CHARS } from '../search/chunk'

const n = parseInt(process.argv.find(a => a.startsWith('--n='))?.split('=')[1] ?? '300', 10)
/** docs/VECTOR_EMBED_REPORT.md §1 — gemini-embedding-001, Batch API. */
const USD_PER_1M_TOKENS = 0.075
/** The same conservative chars/4 the corpus embed was costed with, so the numbers are comparable. */
const CHARS_PER_TOKEN = 4

;(async () => {
  const p = namesPool()
  const total = (await p.query(`SELECT COUNT(*)::int AS n FROM corpus_sections WHERE corpus='tna-caselaw'`)).rows[0].n
  const rows = (await p.query(
    `SELECT id, "r2Key", "r2RawKey" FROM corpus_sections
      WHERE corpus='tna-caselaw' AND "r2Key" IS NOT NULL AND "r2RawKey" IS NOT NULL
      ORDER BY md5(id || 'embed') LIMIT $1`, [n])).rows

  let read = 0
  let oldChunks = 0, newChunks = 0
  let oldEmbedChars = 0, newEmbedChars = 0
  let oldCssInEmbedded = 0
  let cappedBefore = 0, cappedAfter = 0
  let chunk0MostlyCss = 0
  let judgmentCharsLostToCap = 0

  await Promise.all(rows.map(async r => {
    const old = await r2Get(r.r2Key)
    const raw = await r2Get(r.r2RawKey)
    if (!old || !raw) return
    const fresh = aknJudgmentText(raw)
    if (!fresh) return
    read++

    const oc = chunkBody(old)
    const nc = chunkBody(fresh.text)
    oldChunks += oc.length
    newChunks += nc.length
    const oldEmb = oc.join(' ')
    const newEmb = nc.join(' ')
    oldEmbedChars += oldEmb.length
    newEmbedChars += newEmb.length
    oldCssInEmbedded += styleChars(oldEmb)
    if (oc.length >= MAX_CHUNKS) cappedBefore++
    if (nc.length >= MAX_CHUNKS) cappedAfter++
    if (oc.length && styleChars(oc[0]) > 0.5 * oc[0].length) chunk0MostlyCss++

    // How much REAL JUDGMENT never reached the embedder because a stylesheet occupied the cap.
    // Only meaningful where the cap actually bit: below the cap everything was embedded anyway.
    if (oc.length >= MAX_CHUNKS) {
      const judgmentInOld = oldEmb.length - styleChars(oldEmb)
      judgmentCharsLostToCap += Math.max(0, newEmb.length - judgmentInOld)
    }
  }))

  const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—')
  const scale = total / read
  const newTokens = (newEmbedChars * scale) / CHARS_PER_TOKEN

  console.log(`sampled ${read} of ${total.toLocaleString()} tna-caselaw documents (chunker: ${MAX_CHUNKS} x ${WINDOW_CHARS} chars max)\n`)
  console.log('  WHAT THE EMBEDDER WAS GIVEN, AND WHAT IT WOULD BE GIVEN')
  console.log(`    chunks per document            ${(oldChunks / read).toFixed(2)} now -> ${(newChunks / read).toFixed(2)} after`)
  console.log(`    embedded chars per document    ${Math.round(oldEmbedChars / read).toLocaleString()} now -> ${Math.round(newEmbedChars / read).toLocaleString()} after`)
  console.log(`    of those, stylesheet            ${Math.round(oldCssInEmbedded / read).toLocaleString()} chars (${pct(oldCssInEmbedded, oldEmbedChars)} of everything embedded for case law)`)
  console.log(`    chunk 0 is >50% stylesheet      ${chunk0MostlyCss}/${read} (${pct(chunk0MostlyCss, read)})`)
  console.log(`    documents hitting the 8-chunk cap  ${cappedBefore}/${read} now, ${cappedAfter}/${read} after`)
  console.log(`    judgment text that never reached the embedder because the stylesheet used up`)
  console.log(`    the cap: ${Math.round(judgmentCharsLostToCap / read).toLocaleString()} chars per capped document ` +
    `(~${Math.round(judgmentCharsLostToCap / read / 5).toLocaleString()} words)`)

  console.log('\n  WHAT A RE-EMBED WOULD COST, at the rate the corpus embed was costed at')
  console.log(`    scaled to the whole collection  ${Math.round((newChunks * scale)).toLocaleString()} chunks, ` +
    `${Math.round(newEmbedChars * scale).toLocaleString()} chars`)
  console.log(`    est. input tokens (chars/${CHARS_PER_TOKEN})       ${Math.round(newTokens).toLocaleString()}`)
  console.log(`    est. Batch-API cost @ $${USD_PER_1M_TOKENS}/1M   $${((newTokens / 1e6) * USD_PER_1M_TOKENS).toFixed(2)}`)
  await endNamesPool()
})().catch(e => { console.error(e); process.exit(1) })
