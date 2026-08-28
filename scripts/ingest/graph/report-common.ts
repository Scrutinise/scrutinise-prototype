/**
 * report-common.ts — shared machinery for the report run's corpus track
 * (`docs/CC_BRIEF_report_corpus.md`). Data only; nothing here draws a conclusion.
 *
 * ── THREE THINGS A READER OF THE OUTPUT NEEDS TO KNOW ───────────────────────
 *
 * 1. THE THREE `detection` VALUES ARE NEVER SUMMED. `markup`, `text` and
 *    `enabling` are different strengths of evidence, and the brief is explicit
 *    that a merged count is a wrong count in the direction that inflates the
 *    work. Every count this file emits is per-detection. Where a file needs to
 *    say how many rows it contains, that number is called `rows_in_this_file`
 *    and carries a note saying it is a fact about the FILE, not an evidence
 *    total. `writeCounts()` refuses to emit a bare `total`.
 *
 * 2. EVERY QUOTED SENTENCE SAYS WHERE IT CAME FROM AND WHETHER IT IS WHOLE.
 *    `sentence_source` is `provision-text` (flattened from the source document's
 *    own CLML, held locally), `raw-fragment` (the 600-character evidence window
 *    stored on the edge, which may be cut) or `not-found`. `sentence_complete`
 *    is true only when a sentence boundary was found on BOTH sides. A fragment
 *    presented as a sentence is a misquotation, and this report is going to a
 *    reader who will check.
 *
 * 3. SOURCE BYTES ARE LOCAL AND THE RUN IS OFFLINE. All 1,235 source documents
 *    of the four measures, and all three gate Acts, are in
 *    `best-collection-xml.zip` on this machine — measured, not assumed
 *    (`probe-zip-coverage.ts`: 1,235 of 1,235). So T2 and T3 need no network,
 *    which means they are reproducible and cannot be rate-limited half way.
 *
 * ⚠ CLML commentary handles (`key-` + 32 hex) are byte-identical in shape to a
 * Mailgun API key and GitHub's push protection rejects a file containing one.
 * Everything this file writes goes through `redactHandles` or `writeText`.
 * ⚠ This is the FOURTH copy of that four-character regex in `graph/`
 * (`audit-25h-citations.ts`, `check-4a-coverage.ts`, `pilot-25h-crag.ts`), and
 * one of those — `check-4a-coverage.ts` — needs its own by construction, since
 * it is the check that a real handle still matches. The other three were not
 * consolidated during a report run; noted here so the next sprint can, rather
 * than left silent for a fifth copy to be added on top of.
 */
import fs from 'fs'
import path from 'path'
import { ZipReader, ZipEntryMeta } from './zip-reader'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'
import { decodeHtmlEntities } from '../shared/html-entities'

export const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
export const OUT_DIR = path.join(__dirname, '../../../docs/report_run')

// ── redaction ───────────────────────────────────────────────────────────────

const CLML_HANDLE_RX = /key-[0-9a-f]{32}/g

/**
 * Strip CLML commentary handles from anything about to be written to a file.
 *
 * Only the handle is touched. It is an internal pointer with no evidential
 * value — every quotable word of `citation_text`, `raw_fragment` and every
 * extracted sentence survives, and the true bytes remain in `citation_edge`.
 */
export function redactHandles<T>(value: T): T {
  return JSON.parse(JSON.stringify(value).replace(CLML_HANDLE_RX, 'key-REDACTED-CLML-COMMENTARY-HANDLE'))
}

// ── the local CLML corpus ───────────────────────────────────────────────────

/**
 * ⚠⚠ ONE GID CAN NAME TWO DOCUMENTS IN THIS ZIP, AND THE FIRST VERSION OF THIS
 * FILE LET THE LAST ONE SEEN WIN.
 *
 * The zip holds 133,361 documents under 130,096 gids. **2,894 gids carry both
 * an as-made (or as-enacted) copy and a revised copy**, and a `Map` filled by
 * iteration keeps whichever the central directory happened to list second. That
 * is the GRAPH 4B regnal-year defect — "the last entry silently won, for 419
 * ids" — in a new place, and it was caught the same way: by a result that could
 * not be true. `uksi/2005/384` has a stored citation quoting section 4 of the
 * Human Rights Act, and the copy this index handed back does not contain the
 * words "Human Rights Act" at all. It is the Criminal Procedure Rules 2005, and
 * its revised copy is a one-line shell reading "(revoked)".
 *
 * So the choice is now DECLARED, not accidental:
 *   · `revised` is preferred, because a repeal analysis is about the law as it
 *     stands, and the revised copy is what a repeal would strike.
 *   · every read reports WHICH version it used, and callers record it.
 *   · when a reference is absent from the revised copy but present in the
 *     as-made copy, that is not a lookup failure — **it is a reference that has
 *     since been amended or revoked away**, which is a different and reportable
 *     fact, and `readDocVersion` exists so a caller can establish it.
 *
 * ⚠ A CONSEQUENCE FOR `citation_edge` ITSELF, WHICH THIS RUN DOES NOT FIX:
 * `extract-citation-edges.ts` iterates every ENTRY, not every gid, so for those
 * 2,894 gids it extracted from BOTH copies and wrote both under the same
 * `source_gid` with no column saying which. Quantified per measure in the T2
 * output as `version_ambiguity`. Reported, not repaired — repairing it is a
 * re-extraction and a schema change, neither of which belongs in a report run.
 */
export type DocVersion = 'revised' | 'enacted' | 'made' | 'created' | 'adopted'

/** Preference order. Revised first: the law as it stands is what a repeal strikes. */
const VERSION_ORDER: DocVersion[] = ['revised', 'enacted', 'made', 'created', 'adopted']

let _zip: ZipReader | null = null
let _index: Map<string, Map<DocVersion, ZipEntryMeta>> | null = null
const _docCache = new Map<string, string | null>()

function versionOf(name: string): DocVersion | null {
  const s = name.match(/-([a-z]+)-data\.xml$/)?.[1]
  return s && (VERSION_ORDER as string[]).includes(s) ? s as DocVersion : null
}

/** gid → version → entry, built once from the central directory (~170ms). */
function zipIndex(): Map<string, Map<DocVersion, ZipEntryMeta>> {
  if (_index) return _index
  if (!fs.existsSync(ZIP_PATH)) throw new Error(`bulk CLML not on disk at ${ZIP_PATH}`)
  _zip = new ZipReader(ZIP_PATH)
  _index = new Map()
  for (const e of _zip.entries) {
    const m = e.name.match(ENTRY_RX)
    if (!m) continue
    const v = versionOf(e.name)
    if (!v) continue
    const gid = gidFromEntry(m)
    let byVersion = _index.get(gid)
    if (!byVersion) { byVersion = new Map(); _index.set(gid, byVersion) }
    // ⚠ first write wins per VERSION, so two entries of the same version cannot
    // silently swap either. There are none today; this makes it stay that way.
    if (!byVersion.has(v)) byVersion.set(v, e)
  }
  return _index
}

/** Which versions of a gid the zip holds, in preference order. */
export function versionsHeld(gid: string): DocVersion[] {
  const m = zipIndex().get(gid)
  return m ? VERSION_ORDER.filter(v => m.has(v)) : []
}

/** Whole-document CLML for a gid at a named version, or null. */
export function readDocVersion(gid: string, version: DocVersion): string | null {
  const key = `${gid}@${version}`
  if (_docCache.has(key)) return _docCache.get(key)!
  const e = zipIndex().get(gid)?.get(version)
  let xml: string | null = null
  if (e) { try { xml = _zip!.readText(e) } catch { xml = null } }
  // The cache is bounded: these documents run to several MB and three measures
  // touch 1,235 of them. Keeping every one would hold the whole zip in memory.
  if (_docCache.size > 40) _docCache.clear()
  _docCache.set(key, xml)
  return xml
}

/** The preferred version's CLML, with the version it came from. */
export function readDocWithVersion(gid: string): { xml: string; version: DocVersion } | null {
  for (const v of versionsHeld(gid)) {
    const xml = readDocVersion(gid, v)
    if (xml) return { xml, version: v }
  }
  return null
}

/** The preferred version's CLML, or null. Prefer `readDocWithVersion` in a
 *  deliverable, so the output can say which copy it quoted. */
export function readDoc(gid: string): string | null {
  return readDocWithVersion(gid)?.xml ?? null
}

export function closeZip(): void { _zip?.close(); _zip = null; _index = null; _docCache.clear() }
export function zipHolds(gid: string): boolean { return zipIndex().has(gid) }

// ── CLML → text ─────────────────────────────────────────────────────────────

/**
 * Flatten CLML to readable prose.
 *
 * ⚠ Block elements become a SPACE, not nothing. Concatenating
 * `<Text>a</Text><Text>b</Text>` without a separator invents the word "ab",
 * which then fails to match anything and reads as a missing reference.
 */
export function flattenClml(xml: string): string {
  return decodeHtmlEntities(
    xml
      .replace(/<\?xml[^>]*\?>/g, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(Pnumber|Number)\b[^>]*>/g, ' $& ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim()
}

/** The element carrying `id="<ref>"`, with its children — or null. */
export function provisionSlice(xml: string, ref: string): string | null {
  const open = new RegExp(`<([A-Za-z0-9]+)\\b[^>]*\\sid="${ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*(/?)>`)
  const m = xml.match(open)
  if (!m) return null
  const start = m.index!
  if (m[2] === '/') return m[0]
  const tag = m[1]
  // walk nested same-name tags so a Section inside a Section cannot end it early
  const scan = new RegExp(`<${tag}\\b[^>]*?(/?)>|</${tag}>`, 'g')
  scan.lastIndex = start
  let depth = 0
  for (let t = scan.exec(xml); t; t = scan.exec(xml)) {
    if (t[0].startsWith(`</`)) { depth--; if (depth === 0) return xml.slice(start, t.index + t[0].length) }
    else if (t[1] !== '/') depth++
  }
  return xml.slice(start) // unclosed — return what there is rather than nothing
}

/** The enacting words / preamble block of an instrument, where an `enabling`
 *  reference lives. Named separately because those rows carry no provision. */
export function preambleSlice(xml: string): string | null {
  for (const tag of ['SecondaryPreamble', 'EnactingText', 'Preamble']) {
    const m = xml.match(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}>`))
    if (m) return m[0]
  }
  return null
}

// ── sentence extraction ─────────────────────────────────────────────────────

/**
 * A sentence boundary in statutory prose.
 *
 * ⚠ An em-dash is NOT a boundary. Statutes hang lists off `—` constantly
 * ("means— (a) …, or (b) …"), and cutting there would sever a definition from
 * the thing it defines and produce a quotation that says the opposite of the
 * provision.
 *
 * ⚠⚠ AND NEITHER IS THE FULL STOP IN "(c. 25)". The first version of this file
 * used a bare `/\.\s/` and produced, as a whole and quotable sentence,
 *
 *     "Constitutional Reform and Governance Act 2010 (c."
 *
 * from a repeals schedule reading "… paragraph 3. Constitutional Reform and
 * Governance Act 2010 (c. 25) In Schedule 6, paragraphs 36 and 37." A chapter
 * number is the single most common full stop in a statute book and it is never
 * a sentence end. The same goes for "s.", "Sch.", "art.", "reg.", "No." and a
 * bare initial. So a stop ends a sentence only when the word before it is not
 * one of those, and the next thing after it starts something: a capital, an
 * opening quote or bracket, or a paragraph number.
 */
const STOP = /\.\s+/g

/** Words that take a full stop without ending a sentence. */
const ABBREV = /(?:\b(?:cc?|ss?|sch|arts?|regs?|rr?|paras?|pts?|ch|nos?|vols?|pp?|cf|ib|ibid|art|st|mr|mrs|ms|dr|rt|hon)|\b[A-Za-z])$/i

/** Every index at which a sentence genuinely ends, as an offset just past the stop. */
function sentenceEnds(s: string): number[] {
  const out: number[] = []
  STOP.lastIndex = 0
  for (let m = STOP.exec(s); m; m = STOP.exec(s)) {
    const before = s.slice(0, m.index)
    if (ABBREV.test(before)) continue
    const next = s[m.index + m[0].length]
    // a capital, an opening quotation mark or bracket, or a paragraph number
    if (next === undefined || /[A-Z0-9“"'(\[]/.test(next)) out.push(m.index + m[0].length)
  }
  STOP.lastIndex = 0
  return out
}

export type SentenceHit = {
  sentence: string
  /** true only when a boundary was found on BOTH sides inside the material */
  complete: boolean
  leftBounded: boolean
  rightBounded: boolean
  /** ⚠ the left boundary is the START of the material, not a full stop that was
   *  found. A provision begins a sentence, so this is a real boundary — but a
   *  reader deserves to know which kind it is before quoting. */
  atStart: boolean
  atEnd: boolean
  /** how many times the anchor appeared in the material searched */
  occurrences: number
}

const MAX_SENTENCE = 2000

/**
 * The sentence containing `anchorRx`, from `flat`.
 *
 * When the anchor appears more than once — a long Act names another Act many
 * times — the occurrence whose surrounding window shares the most words with
 * `prefer` is taken, and the choice is deterministic. 25-H's verifier learned
 * this the hard way: anchoring on the FIRST occurrence marked two rows wrong
 * whose parse was right, because the reference that mattered was the second.
 */
export function sentenceAround(flat: string, anchorRx: RegExp, prefer?: string): SentenceHit | null {
  const rx = new RegExp(anchorRx.source, anchorRx.flags.includes('g') ? anchorRx.flags : anchorRx.flags + 'g')
  const hits = [...flat.matchAll(rx)]
  if (hits.length === 0) return null

  let best = hits[0]
  if (hits.length > 1 && prefer) {
    const want = new Set(prefer.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])
    let bestScore = -1
    for (const h of hits) {
      const win = flat.slice(Math.max(0, h.index! - 260), h.index! + 260).toLowerCase()
      const got = new Set(win.match(/[a-z0-9]{4,}/g) ?? [])
      let score = 0
      for (const w of want) if (got.has(w)) score++
      if (score > bestScore) { bestScore = score; best = h }
    }
  }

  const at = best.index!
  // left: the last real sentence end before the anchor, within MAX_SENTENCE
  const leftFloor = Math.max(0, at - MAX_SENTENCE)
  const ends = sentenceEnds(flat.slice(leftFloor, at))
  const leftIx = ends.length ? ends[ends.length - 1] : -1
  // ⚠ The start of the material IS a sentence start — a provision begins one.
  // It is recorded as `atStart` rather than folded into `leftBounded`, so a
  // reader can tell a boundary that was FOUND from one that was ASSUMED.
  const atStart = leftIx < 0 && leftFloor === 0
  const leftBounded = leftIx >= 0 || atStart
  const start = leftIx >= 0 ? leftFloor + leftIx : leftFloor

  // right: the first real sentence end after the anchor, within MAX_SENTENCE
  const rightCeil = Math.min(flat.length, at + MAX_SENTENCE)
  const rightEnds = sentenceEnds(flat.slice(at, rightCeil))
  const atEnd = rightEnds.length === 0 && rightCeil === flat.length
  const rightBounded = rightEnds.length > 0 || atEnd
  const end = rightEnds.length ? at + rightEnds[0] : rightCeil

  return {
    sentence: flat.slice(start, end).trim(),
    complete: leftBounded && rightBounded,
    leftBounded, rightBounded,
    atStart, atEnd,
    occurrences: hits.length,
  }
}

/**
 * A regex matching an Act by its short title, with the year optional.
 *
 * The year is optional because CLML puts it inside the `<Citation>` element —
 * "the Constitutional Reform and Governance Act <Citation>2010 (c. 25)</Citation>"
 * — so a name-plus-year pattern misses every marked-up reference, which are
 * exactly the strongest ones.
 */
export function actNameRegex(title: string): RegExp {
  const noYear = title.replace(/\s+\d{4}$/, '')
  const esc = noYear.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+')
  return new RegExp(`${esc}(?:\\s+\\d{4})?`, 'i')
}

// ── where in a document a reference actually sits ───────────────────────────

/**
 * The chain of open CLML elements at a byte offset — innermost last.
 *
 * Used to answer "the reference is not in the provision the row names, so where
 * IS it?", which is the difference between a row that is useless and a row
 * whose evidence simply sits one element away.
 */
/**
 * The offset of the occurrence of `rx` that this row is actually about.
 *
 * ⚠ NOT the first. A document names an Act many times, and the first mention is
 * usually in the long title or the explanatory note. Reporting the first one's
 * surroundings would attribute every reference in a long Act to whatever
 * element the long title sits in — a plausible category, confidently wrong.
 * The occurrence chosen is the one whose surrounding bytes share most words
 * with `prefer` (the row's own `citation_text`), which is the same rule
 * `sentenceAround` uses and for the same reason.
 */
export function bestMatchIndex(xml: string, rx: RegExp, prefer: string): number {
  const g = new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g')
  const hits = [...xml.matchAll(g)]
  if (hits.length === 0) return -1
  if (hits.length === 1) return hits[0].index!
  const want = new Set(prefer.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [])
  let best = hits[0].index!, bestScore = -1
  for (const h of hits) {
    const win = xml.slice(Math.max(0, h.index! - 300), h.index! + 300).toLowerCase()
    const got = new Set(win.match(/[a-z0-9]{4,}/g) ?? [])
    let score = 0
    for (const w of want) if (got.has(w)) score++
    if (score > bestScore) { bestScore = score; best = h.index! }
  }
  return best
}

export function enclosingChain(xml: string, at: number): string[] {
  const stack: string[] = []
  const rx = /<(\/?)([A-Za-z][A-Za-z0-9]*)\b[^>]*?(\/?)>/g
  for (let m = rx.exec(xml); m && m.index < at; m = rx.exec(xml)) {
    if (m[1] === '/') { const i = stack.lastIndexOf(m[2]); if (i >= 0) stack.length = i }
    else if (m[3] !== '/') stack.push(m[2])
  }
  return stack
}

/**
 * A plain-English name for the part of a document a reference sits in.
 *
 * ⚠ These are the categories the CLML schema actually has, checked against the
 * chain rather than guessed from the words. A reference in a cross-heading or a
 * repeals table is a real reference in a real place; it is simply not inside the
 * provision that `source_provision_ref` names.
 */
export function contextName(chain: string[], xml: string, at: number): string {
  const has = (t: string) => chain.includes(t)
  if (has('ExplanatoryNotes') || has('EarlierOrders')) return 'explanatory-note'
  // <Pblock><Title> is a cross-heading: it names the group of provisions below it
  if (has('Pblock') && has('Title') && !has('P1')) return 'cross-heading'
  if (has('Tabular') || has('table') || has('tbody') || has('tr')) return 'table (a repeals or amendments schedule)'
  if (has('Commentary') || has('CommentaryCitation')) return 'commentary'
  if (has('Footnote')) return 'footnote'
  if (has('SecondaryPreamble') || has('EnactingText') || has('Preamble')) return 'enacting words / preamble'
  if (has('Schedule') && has('Title') && !has('P1')) return 'schedule heading'
  if (has('Contents') || has('ContentsItem')) return 'table of contents'
  if (has('Title') && !has('P1')) return 'a heading'
  // fall back to the innermost structural element that carries an id
  const before = xml.slice(Math.max(0, at - 6000), at)
  const ids = [...before.matchAll(/\sid="([^"]+)"/g)]
  return ids.length ? `elsewhere in the document (nearest id: ${ids[ids.length - 1][1]})` : 'elsewhere in the document'
}

// ── output ──────────────────────────────────────────────────────────────────

/** RFC 4180. Newlines and quotes inside statutory text are ordinary, not rare. */
export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return ''
    const s = String(v)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns.join(','), ...rows.map(r => columns.map(c => cell(r[c])).join(','))].join('\r\n') + '\r\n'
}

/**
 * Per-detection counts, and NEVER a merged total.
 *
 * ⚠ The brief forbids merging `markup`, `text` and `enabling` into a total, so
 * this returns no such field. `rows_in_this_file` is emitted separately by the
 * caller and is labelled as a property of the file.
 */
export function countsByDetection(rows: Array<{ detection: string }>): Record<string, number> {
  const out: Record<string, number> = { markup: 0, text: 0, enabling: 0 }
  for (const r of rows) out[r.detection] = (out[r.detection] ?? 0) + 1
  return out
}

export const MERGE_WARNING =
  'markup, text and enabling are different strengths of evidence and are reported separately. ' +
  'Do not add them. A markup edge is the source document asserting the target by URI; a text edge ' +
  'is the Act NAME resolved against corpus_acts titles, so the target id is derived and must never ' +
  'be quoted as the source\'s own words; an enabling edge is the instrument\'s own enacting words ' +
  'saying it was MADE UNDER the target, which is a stronger and different fact — an instrument that ' +
  'merely mentions an Act survives its repeal, while one whose enabling power is repealed may fall ' +
  'with it.'

export function writeJson(file: string, value: unknown): string {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const p = path.join(OUT_DIR, file)
  fs.writeFileSync(p, JSON.stringify(redactHandles(value), null, 2))
  return p
}

export function writeText(file: string, body: string): string {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const p = path.join(OUT_DIR, file)
  fs.writeFileSync(p, body.replace(CLML_HANDLE_RX, 'key-REDACTED-CLML-COMMENTARY-HANDLE'))
  return p
}

// ── the measures ────────────────────────────────────────────────────────────

export type Measure = {
  ws_id: string
  gid: string
  title: string
  /** provision scope, when the measure is a Part rather than a whole Act */
  scope: string | null
  note: string
}

export const MEASURES: Measure[] = [
  {
    ws_id: 'WS-05', gid: 'ukpga/2010/25', scope: 'part-1',
    title: 'Constitutional Reform and Governance Act 2010',
    note: 'Part 1 only — the civil service provisions. Rows are labelled by scope band and never merged.',
  },
  {
    ws_id: 'WS-01', gid: 'ukpga/1998/42', scope: null,
    title: 'Human Rights Act 1998',
    note: 'Whole Act.',
  },
  {
    ws_id: 'WS-04', gid: 'ukpga/2010/15', scope: null,
    title: 'Equality Act 2010',
    note: 'Whole Act, including s.149 (the public sector equality duty).',
  },
]

/** T4's conditional fourth measure. Worked only on Charlie's Tuesday decision. */
export const MEASURE_T4: Measure = {
  ws_id: 'WS-02-03', gid: 'ukpga/2005/4', scope: null,
  title: 'Constitutional Reform Act 2005',
  note: 'Parts 2 and 3 — Lord Chancellor, Supreme Court. Conditional; see CC_BRIEF_report_corpus.md §5.',
}
