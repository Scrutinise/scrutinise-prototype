/**
 * extract-madeunder-edges.ts — SI → enabling Act/section edges (`made-under`)
 * from SecondaryPreamble/EnactingText in the whole-doc CLML we already hold
 * (scripts/legislation/v276-bulk/best-collection-xml.zip, May 2026 vintage).
 *
 * The per-section corpus ingest dropped preambles (audit finding), but the bulk
 * ZIP's whole-doc CLML has them: "…in exercise of the powers conferred by
 * sections 70(1), 105(7) … of the National Health Service (Scotland) Act
 * 1978<FootnoteRef f00001/>…" where footnote f00001's FIRST <Citation URI>
 * is the enabling act. Modern SIs may carry inline <Citation> in the
 * EnactingText instead. Both are handled:
 *   from = the SI (act-level)
 *   to   = enabling act (act-level), plus section-level edges where a
 *          "section(s)/article(s)/regulation(s) N … of" list precedes the anchor
 *   detail = the start of the enacting text (provenance for review)
 *
 * Revised SIs whose preamble TNA elided ("… . . . .") are counted, not silent.
 *
 * Zip access via graph/zip-reader.ts (streaming central directory) — adm-zip's
 * whole-file 1.4 GB Buffer fails allocation on this machine.
 *
 *   npx tsx graph/extract-madeunder-edges.ts --pilot [N=500]  — stats only, no writes
 *   npx tsx graph/extract-madeunder-edges.ts                  — full run (checkpointed)
 */
import fs from 'fs'
import path from 'path'
import { ZipReader } from './zip-reader'
import { endNeonPool } from '../shared/neon-pool'
import { EdgeRow, dedupeEdges, edgeId, granularityOf, insertEdges, parseLegUri } from './graph-common'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
const CHECKPOINT = path.join(__dirname, 'madeunder-checkpoint.json')
const SOURCE = 'clml-si-preamble'
const SI_TYPES = new Set(['uksi', 'ssi', 'nisr', 'wsi', 'nisro'])

type Stats = {
  siDocs: number
  noPreamble: number
  elidedPreamble: number
  noTarget: number
  recitalFallback: number
  actEdges: number
  sectionEdges: number
  written: number
}
const stats: Stats = { siDocs: 0, noPreamble: 0, elidedPreamble: 0, noTarget: 0, recitalFallback: 0, actEdges: 0, sectionEdges: 0, written: 0 }

const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * "sections 70(1), 105(7) and 108(1) of" → ['section-70','section-105','section-108'].
 *
 * ⚠⚠ TWO DEFECTS FIXED HERE ON 2026-08-28 (GRAPH 4B §2.1), BOTH FOUND BY READING
 * THE PARSER'S OUTPUT RATHER THAN ITS CODE, AND BOTH ALREADY PRESENT IN THE
 * 230,681 `made-under` rows this file wrote in July.
 *
 * 1. **A SUBSECTION WAS READ AS A SECTION.** `\d+[A-Z]*` over the raw list
 *    matched the bracketed subsection too, so "sections 191(2) and 195(3) of"
 *    produced `section-191`, `section-2`, `section-195` — and `section-2` is an
 *    edge to a provision the instrument was never made under. Every enabling
 *    power written with a subsection, which is most of them, carried one or more
 *    of these. Parentheses are stripped before the numerals are read.
 *
 * 2. **A REF LIST WAS ATTACHED TO THE WRONG ACT.** A preamble naming several
 *    enabling Acts — "section 2(2) of the European Communities Act 1972, section
 *    379A of the Financial Services and Markets Act 2000 and sections 204(6) …
 *    of the Banking Act 2009" — has one anchor per Act, and the old regex
 *    matched the EARLIEST list in the window for every one of them. So FSMA's
 *    anchor was given the European Communities Act's section 2. The window is
 *    now cut at the last COMPLETED act citation ("… Act 1972"), because the
 *    anchor's own year sits inside the <Citation> element and so cannot appear
 *    in the text before it. What is left is the list that belongs to this Act.
 *
 * ⚠ Act-level rows were never affected — only the section-level ones, which are
 * the rows a repeal analysis actually reads.
 */
const ITEM_RX = /\b(section|sections|article|articles|regulation|regulations|paragraph|paragraphs)\s+([0-9][0-9A-Za-z()]*(?:\s*(?:,|and|to)\s*[0-9][0-9A-Za-z()]*)*)\s+of\b/gi

/**
 * The ref list belonging to the anchor at the END of `text`.
 *
 * ⚠ The LAST list wins, not the first — a preamble naming several Acts has one
 * anchor each and the first list belongs to the first Act. ⚠ But a `paragraph`
 * list is skipped over rather than accepted, because "sections 126(1) and
 * 128(1) OF, AND BY PARAGRAPH 2A OF SCHEDULE 12 TO, the Act" ends with a
 * schedule paragraph whose schedule number we deliberately do not record — and
 * taking it would throw away the two sections that are the real answer.
 */
function pickList(text: string): RegExpMatchArray | null {
  const cands = [...text.matchAll(ITEM_RX)].filter(m => {
    const after = text.slice(m.index! + m[0].length)
    return after.length <= 120 && !after.includes('.')
  })
  for (let i = cands.length - 1; i >= 0; i--) {
    if (cands[i][1].toLowerCase().replace(/s$/, '') !== 'paragraph') return cands[i]
  }
  return cands.length > 0 ? cands[cands.length - 1] : null
}

export function refListBefore(plainBefore: string): string[] {
  return refListDetail(plainBefore).refs
}

/** Same answer, plus the phrase it was read from — so an audit can tell a
 *  DROPPED ref (same phrase, fewer numbers) from a RE-ATTRIBUTED one (a
 *  different phrase entirely) without re-implementing the picker. */
export function refListDetail(plainBefore: string): { refs: string[]; listText: string | null } {
  const tail = plainBefore.slice(-260)
  // ⚠ Prefer the window after the last COMPLETED citation of another instrument
  // ("… Act 1972"), because the anchor's own year sits inside the <Citation>
  // element and so can never appear in the text before it — anything with a
  // year attached therefore belongs to a DIFFERENT Act.
  // ⚠⚠ But only when a list survives the cut. The instrument's own title
  // ("… Order 2009") also matches that pattern and sits inside the window, and
  // cutting at it removed every real ref list on the first attempt.
  let m: RegExpMatchArray | null = null
  const completed = [...tail.matchAll(/\b(?:Act|Order|Regulations|Rules|Measure)\s+\d{4}\b/g)]
  if (completed.length > 0) {
    const last = completed[completed.length - 1]
    m = pickList(tail.slice(last.index! + last[0].length))
  }
  if (!m) m = pickList(tail)
  if (!m) return { refs: [], listText: null }
  const kw = m[1].toLowerCase().replace(/s$/, '')
  if (kw === 'paragraph') return { refs: [], listText: m[2] } // schedule paragraphs need the schedule number too — act-level is honest
  // ⚠ strip bracketed subsections BEFORE reading numerals: 191(2) is one
  // section, not sections 191 and 2.
  const nums = m[2].replace(/\([0-9a-zA-Z]+\)/g, '').match(/\d+[A-Z]*/gi) ?? []
  return { refs: [...new Set(nums.map(n => `${kw}-${n.toUpperCase()}`))], listText: m[2] }
}

/**
 * ⚠⚠ GRAPH 4B §2.1. ONE PARSER, TWO WRITERS.
 *
 * The enabling relationship is now extracted TWICE — once into
 * `legislation_edges` as a `made-under` edge (this file's `main()`), and once
 * into `citation_edge` with the enacting words attached as evidence
 * (`extract-enabling-edges.ts`). ⚠ **Two writers sharing one fact is exactly
 * the shape that produced the regnal-year trap in four code paths**, so the
 * PARSING lives here, in one exported function, and neither writer restates it.
 *
 * `anchor` is the citation element or footnote reference that names the
 * enabling instrument. `refs` are the provisions the words before it name.
 * `citationText` is those words — the source's own sentence, which is what
 * `legislation_edges` structurally cannot hold and `citation_edge` requires.
 */
export type EnablingHit = {
  targetGid: string
  /** section-level refs named in the words before the anchor; [] = act-level only */
  refs: string[]
  /** ⚠ the source's own words granting the power — the evidence for this edge */
  citationText: string
  /** surrounding preamble XML, for hand-checking the parse */
  rawFragment: string
  /** true when the anchor was found in the recitals rather than the enacting
   *  words: lower precision, and it must be visible on the row */
  recitalFallback: boolean
  /** ⚠ the exact input `refListBefore` was given, so an audit can re-run a
   *  different parser over IDENTICAL bytes rather than over the truncated quote */
  beforeWindow: string
}

export type EnablingOutcome =
  | { kind: 'no-preamble' }
  | { kind: 'elided' }          // TNA replaced a revised SI's preamble with ". . . ."
  | { kind: 'no-target' }
  | { kind: 'hits'; hits: EnablingHit[] }

/** Parse one SI's enacting words. Pure: no counters, no writes. */
export function parseEnabling(gid: string, xml: string): EnablingOutcome {
  const pre = xml.match(/<SecondaryPreamble>[\s\S]*?<\/SecondaryPreamble>/)
  if (!pre) return { kind: 'no-preamble' }
  const enacting = pre[0].match(/<EnactingText>[\s\S]*?<\/EnactingText>/)?.[0] ?? pre[0]
  const plain = stripTags(enacting)
  if (/(\.\s+){8,}/.test(plain) || plain.replace(/[.\s]/g, '').length < 20) return { kind: 'elided' }

  // footnote id → first Citation gid in that footnote
  const footnoteGid = new Map<string, string>()
  for (const f of xml.matchAll(/<Footnote id="([^"]+)"[\s\S]*?<\/Footnote>/g)) {
    const cite = f[0].match(/<Citation\b[^>]*\sURI="([^"]+)"/)
    const parsed = cite ? parseLegUri(cite[1]) : null
    if (parsed) footnoteGid.set(f[1], parsed.gid)
  }

  const anchorRx = /<Citation\b[^>]*\sURI="([^"]+)"[^>]*>|<FootnoteRef\b[^>]*\sRef="([^"]+)"[^>]*\/?>/g
  const scan = (scope: string, recital: boolean): EnablingHit[] => {
    const out: EnablingHit[] = []
    for (const a of scope.matchAll(anchorRx)) {
      const targetGid = a[1] ? parseLegUri(a[1])?.gid : footnoteGid.get(a[2] ?? '')
      if (!targetGid || targetGid === gid) continue
      const before = stripTags(scope.slice(0, a.index))
      out.push({
        targetGid,
        refs: refListBefore(before),
        // ⚠ the words that GRANT the power, not the document's opening line.
        // A fixed slice of the preamble would quote the same sentence for every
        // anchor in a multi-power instrument and read as evidence for each.
        // ⚠ start at a word boundary — a fixed slice cuts mid-word and the
        // quote then reads as if the source said "he application of…"
        citationText: before.slice(-240).replace(/^\S*\s+/, '').trim(),
        rawFragment: scope.slice(Math.max(0, (a.index ?? 0) - 300), (a.index ?? 0) + 300),
        recitalFallback: recital,
        beforeWindow: before.slice(-300),
      })
    }
    return out
  }
  let hits = scan(enacting, false)
  if (hits.length === 0 && pre[0] !== enacting) {
    // enacting words cite indirectly ("the Order of 1978", "powers in Schedule 1")
    // — the defining citation sits in the preamble recitals. Lower precision.
    hits = scan(pre[0], true)
  }
  return hits.length === 0 ? { kind: 'no-target' } : { kind: 'hits', hits }
}

function extractDoc(gid: string, xml: string): EdgeRow[] {
  stats.siDocs++
  const outcome = parseEnabling(gid, xml)
  if (outcome.kind === 'no-preamble') { stats.noPreamble++; return [] }
  if (outcome.kind === 'elided') { stats.elidedPreamble++; return [] }
  if (outcome.kind === 'no-target') { stats.noTarget++; return [] }

  const fromId = edgeId(gid)
  const edges: EdgeRow[] = []
  let sawRecital = false
  for (const h of outcome.hits) {
    if (h.recitalFallback) sawRecital = true
    const detail = ((h.recitalFallback ? '[preamble-recital] ' : '') + h.citationText).slice(0, 200)
    for (const ref of h.refs) {
      edges.push({ fromId, toId: edgeId(h.targetGid, ref), edgeType: 'made-under', subType: '', source: SOURCE, granularity: granularityOf(false, true), detail })
    }
    stats.sectionEdges += h.refs.length
    edges.push({ fromId, toId: edgeId(h.targetGid), edgeType: 'made-under', subType: '', source: SOURCE, granularity: granularityOf(false, false), detail })
    stats.actEdges++
  }
  if (sawRecital) stats.recitalFallback++
  return edges
}

function loadCheckpoint(): Set<string> {
  if (!fs.existsSync(CHECKPOINT)) return new Set()
  return new Set(JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')).done as string[])
}

async function main() {
  const pilotIx = process.argv.indexOf('--pilot')
  const pilot = pilotIx >= 0
  const pilotN = pilot ? parseInt(process.argv[pilotIx + 1] ?? '500', 10) || 500 : 0
  if (process.argv.includes('--reset') && fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT)
  const done = pilot ? new Set<string>() : loadCheckpoint()

  console.log(`[made-under] opening ${ZIP_PATH}…`)
  const zip = new ZipReader(ZIP_PATH)
  const entries = zip.entries.filter(e => {
    const m = e.name.match(/\/([a-z]+)-\d{4}-\d+-\w+-data\.xml$/)
    return m != null && SI_TYPES.has(m[1])
  })
  console.log(`[made-under] ${entries.length} SI docs in zip${pilot ? ` (PILOT: first ${pilotN}, no writes)` : ''}`)

  let buffer: EdgeRow[] = []
  let processed = 0
  const t0 = Date.now()
  for (const entry of entries) {
    if (pilot && processed >= pilotN) break
    const m = entry.name.match(/\/([a-z]+)-(\d{4})-(\d+)-\w+-data\.xml$/)!
    const gid = `${m[1]}/${m[2]}/${m[3]}`
    if (done.has(gid)) continue
    buffer.push(...extractDoc(gid, zip.readText(entry)))
    done.add(gid)
    processed++
    if (!pilot && buffer.length >= 5000) {
      stats.written += await insertEdges(dedupeEdges(buffer))
      buffer = []
      fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done] }))
      console.log(`  ${processed} docs, written=${stats.written}, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
    }
  }
  if (!pilot && buffer.length > 0) {
    stats.written += await insertEdges(dedupeEdges(buffer))
    fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done] }))
  }

  console.log('\n[made-under] stats:', JSON.stringify(stats, null, 1))
  console.log(`[made-under] accounted: siDocs=${stats.siDocs} = with-edges(${stats.siDocs - stats.noPreamble - stats.elidedPreamble - stats.noTarget}) + noPreamble(${stats.noPreamble}) + elided(${stats.elidedPreamble}) + noTarget(${stats.noTarget})`)
  if (pilot) {
    const perDoc = (stats.actEdges + stats.sectionEdges) / Math.max(1, stats.siDocs - stats.noPreamble - stats.elidedPreamble)
    console.log(`[made-under] PILOT: ${perDoc.toFixed(2)} edges per preambled doc → extrapolate over full SI count before the full run`)
  }
  await endNeonPool()
}
// ⚠ GUARDED. `parseEnabling` is imported by extract-enabling-edges.ts, and an
// unguarded main() means importing the parser STARTS A FULL EXTRACTION over a
// 1.4 GB zip that writes to the database. GRAPH 4A had to add this same guard to
// extract-cites-edges.ts for exactly the same reason.
if (require.main === module) {
  main().catch(e => { console.error('[made-under] FATAL', e); process.exit(1) })
}
