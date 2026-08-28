/**
 * extract-citation-edges.ts — Sprint 25-H Task 2: populate `citation_edge` from
 * the body `<Citation>` / `<CitationSubRef>` markup in whole-document CLML,
 * with the evidence for every row attached to that row.
 *
 * ── WHAT THE AUDIT ESTABLISHED, AND WHAT THIS CODE THEREFORE HAS TO DO ───────
 *
 * 1. CLML body markup USUALLY NAMES THE ACT, NOT THE PROVISION. Measured over
 *    all 4,426 Acts and 61,996 SIs in the file: of 286,659 body citation
 *    elements, exactly **3** were a `<CitationSubRef>` carrying a `SectionRef`.
 *    A `SectionRef` attribute on `<Citation>` itself is commoner — recent Acts
 *    do carry it, and it supplies the target provision on 10,853 rows — but
 *    that is under 3% of the markup detector's output. For the other 97% the
 *    provision ("section 3 of") is plain running text sitting immediately
 *    before the marked-up act name:
 *
 *      …a person authorised under an intervention order under section 53 of the
 *      Adults with Incapacity (Scotland) Act <Citation URI="…/asp/2000/4">2000
 *      (asp 4)</Citation>…
 *
 *    So `target_provision_ref` is recoverable ONLY by parsing the words, which
 *    is `parseProvisionRef()` below. It is also exactly why `citation_text` is
 *    mandatory rather than decorative: it is the evidence for the parse as well
 *    as for the edge, and a reader can check both from the same string.
 *
 * 2. 98.9% of citation markup in Acts sits inside <Commentaries>/<Footnote>.
 *    Those are amendment-provenance annotations ("S. 3 substituted by 2010 c.
 *    15") and are already held as `amends`/`repeals` edges from TNA's own
 *    effects data. Including them here would double-count them AND would
 *    swamp the real body references 93-to-1. Excluded, and COUNTED — the
 *    accounting line proves nothing was dropped silently.
 *
 * 3. The shipped `extract-cites-edges.ts` matched `-(\d{4})-` on zip entry
 *    names and so never opened 2,431 documents, including 1,650 ukpga (37% of
 *    every Act in the file) — all of them regnal-year, i.e. all of them
 *    pre-1963. This uses the widened `ENTRY_RX` from audit-25h-citations.ts.
 *
 *   npx tsx graph/extract-citation-edges.ts --pilot [N=1500]  — stats + projection, NO writes
 *   npx tsx graph/extract-citation-edges.ts [--types a,b]     — full run (checkpointed)
 *   npx tsx graph/extract-citation-edges.ts --reset           — drop the checkpoint first
 */
import fs from 'fs'
import path from 'path'
import { ZipReader, ZipEntryMeta } from './zip-reader'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { parseLegUri } from './graph-common'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { identitiesFor, loadIdentityBridge } from './identity'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
const CHECKPOINT = path.join(__dirname, 'citation-edge-checkpoint.json')
const LEG_CORPORA = [
  'primary-acts-2000plus', 'primary-acts-pre-2000',
  'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu', 'eur-lex',
]

/** Caps: see the size note in setup-citation-edge-table.ts. Long enough to
 *  quote and to hand-check; short enough that 400k rows stay in the hundreds
 *  of megabytes on a database already past its alert line. */
const CITATION_TEXT_MAX = 300
const RAW_FRAGMENT_MAX = 600

const PRIMARY_TYPES = new Set(['ukpga', 'asp', 'anaw', 'asc', 'nia', 'apni', 'aep', 'apgb', 'aosp', 'ukla', 'ukcm', 'ukci', 'ukppa', 'gbla', 'aip', 'mwa', 'ukmo'])
const SI_TYPES = new Set(['uksi', 'ssi', 'nisr', 'wsi', 'nisi', 'uksro', 'nisro', 'nidsi', 'nisro'])
export function sourceTypeFor(gid: string): 'primary' | 'SI' | 'other' {
  const t = gid.split('/')[0]
  return PRIMARY_TYPES.has(t) ? 'primary' : SI_TYPES.has(t) ? 'SI' : 'other'
}

type Stats = {
  docs: number; docErrors: number
  elements: number; excludedZone: number; selfCite: number
  badUri: number; rows: number; written: number
  withSourceProvision: number; withTargetProvision: number
  targetProvisionFromSectionRef: number; resolvedRows: number
  textSpans: number; textExcludedZone: number; textAlreadyMarkedUp: number
  textUnresolved: number; textSelf: number; textRows: number
  textWithTargetProvision: number; textResolvedRows: number
}
const stats: Stats = {
  docs: 0, docErrors: 0, elements: 0, excludedZone: 0, selfCite: 0, badUri: 0, rows: 0, written: 0,
  withSourceProvision: 0, withTargetProvision: 0, targetProvisionFromSectionRef: 0, resolvedRows: 0,
  textSpans: 0, textExcludedZone: 0, textAlreadyMarkedUp: 0, textUnresolved: 0, textSelf: 0,
  textRows: 0, textWithTargetProvision: 0, textResolvedRows: 0,
}

// ── zones and provision marks (same shape as the shipped cites extractor) ────

function exclusionZones(xml: string): Array<[number, number]> {
  const zones: Array<[number, number]> = []
  for (const rx of [/<Commentaries>[\s\S]*?<\/Commentaries>/g, /<Footnote\b[\s\S]*?<\/Footnote>/g, /<SecondaryPreamble>[\s\S]*?<\/SecondaryPreamble>/g]) {
    for (const m of xml.matchAll(rx)) zones.push([m.index!, m.index! + m[0].length])
  }
  return zones.sort((a, b) => a[0] - b[0])
}
function zoneCursor(zones: Array<[number, number]>) {
  let zi = 0
  return (i: number): boolean => {
    while (zi < zones.length && zones[zi][1] <= i) zi++
    return zi < zones.length && i >= zones[zi][0]
  }
}
function provisionMarks(xml: string): Array<{ at: number; id: string }> {
  const marks: Array<{ at: number; id: string }> = []
  for (const m of xml.matchAll(/<(?:P1|Article|Regulation|Rule|Paragraph|Section)\b[^>]*\sid="([^"]+)"/g)) {
    marks.push({ at: m.index!, id: m[1] })
  }
  return marks
}

// ── text helpers ─────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
function plain(xmlChunk: string): string {
  return xmlChunk
    .replace(/<[^>]+>/g, '')
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/\s+/g, ' ')
    .trim()
}
/** Force a flat string copy — regex match groups on a multi-MB document are V8
 *  sliced strings that pin the WHOLE document; buffering rows built from them
 *  leaked ~0.6 MB/doc and OOM'd the July run (GRAPH_TIER1_REPORT.md §3.3). */
function flat(s: string): string { return Buffer.from(s, 'utf8').toString('utf8') }

// ── the provision-reference parser ───────────────────────────────────────────

const ORDINAL: Record<string, string> = { section: 'section', sections: 'section', s: 'section', ss: 'section', part: 'part', parts: 'part', pt: 'part', pts: 'part', schedule: 'schedule', schedules: 'schedule', sch: 'schedule', paragraph: 'paragraph', paragraphs: 'paragraph', para: 'paragraph', paras: 'paragraph', article: 'article', articles: 'article', art: 'article', arts: 'article', regulation: 'regulation', regulations: 'regulation', reg: 'regulation', regs: 'regulation', rule: 'regulation', rules: 'regulation', chapter: 'chapter', chapters: 'chapter' }

/** One "<kind> <number>" hit in the running text before a citation. */
type ProvHit = { kind: string; num: string; at: number }

const PROV_RX = /\b(sections?|ss?|parts?|pts?|schedules?|sch|paragraphs?|paras?|articles?|arts?|regulations?|regs?|rules?|chapters?)\.?\s+([0-9]+[A-Z]{0,2}(?:\([0-9a-zA-Z]+\))*)/gi

/**
 * The text immediately before a body <Citation> is the END of the Act's NAME —
 * the year and chapter number live inside the element, the words before it do
 * not. So a citation the parser may trust looks like "…of the Housing Act " or
 * "…to the Quarries Regulations 1999 (". Anything else is not a reference in
 * running prose.
 *
 * ⚠ This anchor is the whole precision story, and the first version had no such
 * anchor. Without it the parser scraped SI COMMENCEMENT TABLES — cells like
 * "Arts. 15 to 24, 1st August 1990 … 1990 No. 246 (C. 9)" — and attributed
 * "article 15" to whichever instrument the next cell happened to name. Four of
 * the first fifteen sample rows were wrong that way. A wrong provision is worse
 * than no provision, because `inbound(CRAG, part-1)` silently inherits it.
 */
const ACT_NAME_TAIL = /\b(Act|Acts|Order|Orders|Regulations?|Rules?|Measure|Scheme|Convention|Treaty|Code|Instrument)\b\s*(?:\([^()]{0,40}\))?\s*(?:\d{4})?\s*\(?\s*$/

/**
 * Parse the target provision out of the words immediately before the citation.
 *
 * Shape: "<provision> of|to [the] <Act name><Citation>". Three gates, in order,
 * and a failure at any of them returns null rather than a guess:
 *
 *   1. the window must END in an act-name token (above);
 *   2. an "of"/"to" connector must sit between the provision and that name;
 *   3. the provision must be the LAST one before the connector, and adjacent
 *      to it — a "section 5" earlier in the sentence belongs to another clause.
 *
 * Composite forms compose the way CLML section refs do: "paragraph 4 of
 * Schedule 1 to the … Act" → `schedule-1-paragraph-4`, matching the ids in
 * corpus_sections so results join to the corpus with no further mapping.
 */
export function parseProvisionRef(before: string): string | null {
  const nameTail = before.match(ACT_NAME_TAIL)
  if (!nameTail) return null                                   // gate 1
  const beforeName = before.slice(0, nameTail.index!)
  // gate 2: the LAST "of"/"to" whose remainder is act-name-shaped. Last, not
  // first: "section 149(3) of, and paragraph 10 of Schedule 5 to, the Social
  // Security … Act" has three, and only the third ends at the Act's name.
  let connAt = -1
  for (const c of beforeName.matchAll(/\b(of|to)\b/gi)) {
    const rest = beforeName.slice(c.index! + c[0].length)
    if (rest.length <= 90 && /^[\s,]*(?:the\s+|that\s+|this\s+)?[A-Z(]/.test(rest)) connAt = c.index!
  }
  if (connAt < 0) return null
  const window = beforeName.slice(0, connAt)
  const hits: ProvHit[] = []
  for (const m of window.matchAll(PROV_RX)) {
    const kind = ORDINAL[m[1].toLowerCase().replace(/\.$/, '')]
    if (kind) hits.push({ kind, num: m[2], at: m.index! })
  }
  if (hits.length === 0) return null
  // gate 3: adjacency — the provision must run up to the connector
  const last = hits[hits.length - 1]
  if (window.length - (last.at + last.kind.length + last.num.length) > 8) return null
  const run = hits.filter(h => last.at - h.at <= 45)

  // A schedule qualifies whatever was named inside it: "paragraph 4 of Schedule
  // 1", "Part 10 of Schedule 3A". Compose in CLML order (container first), which
  // is the order corpus_sections ids use.
  const sched = run.find(h => h.kind === 'schedule')
  // the qualified thing is the NEAREST hit before the schedule, and only a kind
  // that can actually sit inside one.
  //
  // ⚠ `section` is NOT such a kind. Schedules contain paragraphs, Parts and
  // Chapters; a section lives in the body of the Act. Without this list the
  // parser emitted `schedule-12-section-310` — a provision that exists nowhere
  // — whenever a long list mentioned a Schedule before naming a section.
  // Taking the FIRST non-schedule hit rather than the nearest was the other
  // half of the same bug: "section 149(3) of, and paragraph 10 of Schedule 5
  // to" composed as schedule-5-section-149-3.
  const SCHEDULE_INNER = new Set(['paragraph', 'part', 'chapter'])
  const inner = run.filter(h => sched && SCHEDULE_INNER.has(h.kind) && h.at < sched.at).sort((a, b) => b.at - a.at)[0]
  if (sched && inner) return norm(`schedule-${sched.num}-${inner.kind}-${inner.num}`)
  // a bare schedule reference with a section named elsewhere in the clause is
  // the schedule, not a fabricated composite
  if (sched && last.kind === 'schedule') return norm(`schedule-${sched.num}`)
  return norm(`${last.kind}-${last.num}`)
}

/** "section-149(3)" → "section-149-3", matching corpus_sections' ref scheme. */
function norm(ref: string): string {
  return ref.toLowerCase().replace(/[()]/g, '-').replace(/-+/g, '-').replace(/-$/, '')
}

// ── held-instrument resolution ───────────────────────────────────────────────
//
// ⚠⚠ GRAPH 4B §1. This file used to carry its OWN copy of the regnal/calendar
// alias map — one of two copies that had to agree, with no check that they did.
// That is how the regnal-year trap reached four separate code paths. Both
// copies are gone; the one resolver is `graph/identity.ts` and
// `check-4b-identity.ts` fails the build if a second one appears here again.
//
// ⚠ ONE BEHAVIOUR CHANGE, DELIBERATE. The old map wrote
// the calendar form onto the regnal one in a single pass, so where two Acts share
// a calendar form — 41 Geo 3 and 42 Geo 3 are both 1801, and each session
// numbers its chapters from 1 — the LAST entry seen silently won, for 419
// calendar ids. The shared bridge REFUSES those and counts them instead, so a
// target under an ambiguous calendar form now reads as unheld rather than as a
// coin-flip between two different Acts.

// ── extraction ───────────────────────────────────────────────────────────────

export type CitationRow = {
  sourceDocUri: string; sourceProvisionRef: string | null
  targetUri: string; targetActId: string | null; targetProvisionRef: string | null
  citationText: string; rawFragment: string
  resolved: boolean; sourceType: 'primary' | 'SI' | 'other'; sourceGid: string
  detection: 'markup' | 'text'
}

// ── the TEXT detector ────────────────────────────────────────────────────────
//
// The markup detector finds ~2-5% of the real cross-references (measured: 5.4%
// of body mentions of the Human Rights Act, 1.8% of the Equality Act, 0% of
// CRAG). The rest are the Act's NAME in running prose with no markup at all:
//
//     “Convention right” has the same meaning as in the Human Rights Act 1998.
//
// This finds those by name and resolves them against corpus_acts titles. It is
// a WEAKER kind of evidence than a URI — the document did not assert the
// identity, we inferred it — which is exactly why `detection` records which.

/** Title normalisation for both sides of the lookup. */
export function normTitle(t: string): string {
  return t.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').replace(/[.,]/g, '').trim()
}

/**
 * ⚠⚠ TWO separate truncation bugs have lived in this regex. Both silently lost
 * references rather than failing, and both showed up as "names we do not hold".
 *
 * 1. The leading class must be `[A-Z(]`, not `[A-Z]`. With `[A-Z]`, "Children
 *    (Scotland) Act 1995" matched only from the S of "(Scotland)", producing
 *    the unresolvable name "scotland) act 1995" — 192 occurrences in a
 *    1,209-document sample.
 *
 * 2. **Act titles contain lowercase words.** Requiring every word before "Act"
 *    to be capitalised broke the run at the connective: "Constitutional Reform
 *    _and_ Governance Act 2010" matched as "Governance Act 2010" and resolved
 *    to nothing — so the SPRINT'S OWN PILOT TARGET was invisible to the text
 *    detector, and so was every Act with "and", "of", "at" or "etc." in its
 *    name. The top unresolved names were all this bug wearing a disguise:
 *    "taxes act 1988" (Income *and* Corporation Taxes), "country planning act
 *    1971" (Town *and* Country Planning), "markets act 2000" (Financial
 *    Services *and* Markets), "community care act 1990".
 *
 * Over-capturing leading words is harmless — `resolveActName` walks suffixes
 * and only accepts an exact title — so the regex errs wide deliberately.
 */
const CONNECTIVE = String.raw`and|of|for|the|in|to|at|on|etc\.?|no\.?|&`
export const ACT_NAME_RX = new RegExp(
  String.raw`[A-Z(][A-Za-z'’(),.&\-]*\s+(?:(?:[A-Z(][A-Za-z'’(),.&\-]*|${CONNECTIVE})\s+){0,15}` +
  String.raw`(?:Act|Measure)\s*(?:\((?:Northern Ireland|Scotland|Wales|N\.I\.)\)\s*)?(\d{4})`,
  'g',
)

/**
 * A captured span may carry extra leading words ("under the Children (Scotland)
 * Act 1995"), so try progressively shorter SUFFIXES until one is a real title.
 * Longest first, so "Finance Act 2020" never wins over a longer real title that
 * ends with the same words.
 */
export function resolveActName(span: string, titles: Map<string, string>): { gid: string; title: string } | null {
  const words = span.trim().split(/\s+/)
  for (let i = 0; i < words.length - 1; i++) {
    const cand = words.slice(i).join(' ')
    const gid = titles.get(normTitle(cand))
    if (gid) return { gid, title: cand }
    const gidThe = titles.get(normTitle('The ' + cand))
    if (gidThe) return { gid: gidThe, title: 'The ' + cand }
  }
  return null
}

/**
 * title → gid for the text detector. Titles that map to more than one
 * instrument are DROPPED, not guessed: an ambiguous name resolved by coin toss
 * is a wrong edge with evidence attached, which is worse than no edge.
 *
 * ⚠ Exported (GRAPH 4A §3) so a caller re-running the detector gets THE SAME
 * map. A second copy built from the same query would drift the moment either
 * side changed, and the unresolved count is defined relative to this map.
 */
export async function loadActTitles(): Promise<Map<string, string>> {
  const pool = getNeonPool()
  const titles = new Map<string, string>()
  const { rows } = await pool.query(
    `SELECT gid, title FROM corpus_acts WHERE title IS NOT NULL AND title <> ''`)
  const ambiguous = new Set<string>()
  for (const r of rows as Array<{ gid: string; title: string }>) {
    const k = normTitle(r.title)
    if (titles.has(k) && titles.get(k) !== r.gid) { ambiguous.add(k); continue }
    titles.set(k, r.gid)
  }
  for (const k of ambiguous) titles.delete(k)
  console.log(`[cite-edge] ${titles.size.toLocaleString()} unambiguous act titles for the text detector (${ambiguous.size} names dropped as ambiguous)`)
  return titles
}

function extractDoc(gid: string, xml: string, held: Set<string>): CitationRow[] {
  stats.docs++
  const zones = exclusionZones(xml)
  const inZone = zoneCursor(zones)
  const marks = provisionMarks(xml)
  const rows: CitationRow[] = []
  const sourceType = sourceTypeFor(gid)
  const sourceDocUri = `http://www.legislation.gov.uk/id/${gid}`
  let mi = 0
  const rx = /<(Citation|CitationSubRef)\b([^>]*)\sURI="([^"]+)"([^>]*)>/g
  for (const m of xml.matchAll(rx)) {
    stats.elements++
    const at = m.index!
    if (inZone(at)) { stats.excludedZone++; continue }
    const uri = m[3]
    const target = parseLegUri(uri)
    if (!target) { stats.badUri++ }
    if (target && target.gid === gid) { stats.selfCite++; continue }

    while (mi < marks.length && marks[mi].at < at) mi++
    const sourceProvisionRef = mi > 0 ? marks[mi - 1].id : null
    if (sourceProvisionRef) stats.withSourceProvision++

    // inner text of the citation element, and the running text before it
    const openEnd = at + m[0].length
    const closeTag = `</${m[1]}>`
    const closeAt = xml.indexOf(closeTag, openEnd)
    const innerEnd = closeAt < 0 || closeAt - openEnd > 4000 ? openEnd : closeAt
    const inner = plain(xml.slice(openEnd, innerEnd))
    const before = plain(xml.slice(Math.max(0, at - 400), at))

    // target provision: SectionRef if the markup carries one (it almost never
    // does in body text — 3 in 286,659), otherwise parsed from the words.
    // ⚠ Only ever set alongside a target act. A provision with no instrument to
    // hang on ("article 291" of nothing) is not a fact about anything.
    const sectionRefAttr = (m[2] + m[4]).match(/\sSectionRef="([^"]+)"/)
    let targetProvisionRef: string | null = null
    if (!target) targetProvisionRef = null
    else if (sectionRefAttr) { targetProvisionRef = sectionRefAttr[1]; stats.targetProvisionFromSectionRef++ }
    else if (target.sectionRef) { targetProvisionRef = target.sectionRef; stats.targetProvisionFromSectionRef++ }
    else targetProvisionRef = parseProvisionRef(before)
    if (targetProvisionRef) stats.withTargetProvision++

    // normalised target id: the identity the corpus HOLDS, when one of the
    // aliases is held; otherwise the gid as cited. The raw URI is untouched
    // either way, so a wrong normalisation is recoverable without re-extracting.
    let targetActId: string | null = null
    let resolved = false
    if (target) {
      targetActId = target.gid
      if (held.has(target.gid)) resolved = true
      else {
        const heldAlias = identitiesFor(target.gid).find(id => held.has(id))
        if (heldAlias) { targetActId = heldAlias; resolved = true }
      }
    }
    if (resolved) stats.resolvedRows++

    const citationText = (before.slice(-(CITATION_TEXT_MAX - inner.length - 1)) + ' ' + inner)
      .replace(/^\S*\s/, '').trim().slice(-CITATION_TEXT_MAX) || inner || uri
    const fragStart = Math.max(0, at - Math.floor(RAW_FRAGMENT_MAX / 2))
    const rawFragment = xml.slice(fragStart, Math.min(xml.length, fragStart + RAW_FRAGMENT_MAX))

    rows.push({
      sourceDocUri: flat(sourceDocUri),
      sourceProvisionRef: sourceProvisionRef ? flat(sourceProvisionRef) : null,
      targetUri: flat(uri),
      targetActId: targetActId ? flat(targetActId) : null,
      targetProvisionRef: targetProvisionRef ? flat(targetProvisionRef) : null,
      citationText: flat(citationText),
      rawFragment: flat(rawFragment),
      resolved,
      sourceType,
      sourceGid: flat(gid),
      detection: 'markup',
    })
  }
  stats.rows += rows.length
  return rows
}

/** The text detector, over the same body zones and with the same evidence.
 *
 *  ⚠ `onUnresolved` (added by GRAPH 4A §3/T3) is how a caller gets at the spans
 *  behind the 93,772 unresolved-name counter. That number is a STATISTIC — the
 *  spans themselves were never stored — so the only honest way to ask "where do
 *  they sit?" is to run THIS detector again and watch it, rather than write a
 *  second one that would answer questions about itself. The callback is passed
 *  the raw span; it does not affect what is extracted. */
export function extractDocText(
  gid: string, xml: string, titles: Map<string, string>, held: Set<string>,
  onUnresolved?: (span: string) => void,
): CitationRow[] {
  const zones = exclusionZones(xml)
  const inZone = zoneCursor(zones)
  const marks = provisionMarks(xml)
  const rows: CitationRow[] = []
  const sourceType = sourceTypeFor(gid)
  const sourceDocUri = `http://www.legislation.gov.uk/id/${gid}`

  // ranges already claimed by the markup detector — a marked-up citation's own
  // inner text matches the name pattern too, and counting it twice would double
  // every reference that IS properly marked up.
  const citRanges: Array<[number, number]> = []
  for (const c of xml.matchAll(/<Citation\b[\s\S]*?<\/Citation>/g)) citRanges.push([c.index!, c.index! + c[0].length])
  let ri = 0
  const claimed = (i: number): boolean => {
    while (ri < citRanges.length && citRanges[ri][1] <= i) ri++
    return ri < citRanges.length && i >= citRanges[ri][0]
  }
  // strip tags but PRESERVE OFFSETS, so a text match still maps back to the XML
  const text = xml.replace(/<[^>]+>/g, m => ' '.repeat(m.length))

  let mi = 0
  for (const m of text.matchAll(ACT_NAME_RX)) {
    const at = m.index!
    stats.textSpans++
    if (inZone(at)) { stats.textExcludedZone++; continue }
    if (claimed(at)) { stats.textAlreadyMarkedUp++; continue }
    const hit = resolveActName(m[0], titles)
    if (!hit) { stats.textUnresolved++; onUnresolved?.(m[0]); continue }
    if (hit.gid === gid) { stats.textSelf++; continue }

    while (mi < marks.length && marks[mi].at < at) mi++
    const sourceProvisionRef = mi > 0 ? marks[mi - 1].id : null
    const before = plain(xml.slice(Math.max(0, at - 400), at))
    // ⚠ Feed the parser the REAL act name, not a synthetic " Act " marker. With
    // a synthetic one the name-tail anchor landed on the wrong end of the
    // sentence: "no order was made under section 4(2) of this Act or under
    // section 41(2) of the Criminal Appeal (Northern Ireland) Act 1980" parsed
    // as section-4-2 — the FIRST clause's provision, attached to the SECOND
    // clause's Act.
    const targetProvisionRef = parseProvisionRef((before + ' ' + plain(m[0])).replace(/\s+/g, ' '))
    if (targetProvisionRef) stats.textWithTargetProvision++

    const resolved = held.has(hit.gid)
    if (resolved) stats.textResolvedRows++
    const citationText = (before.slice(-(CITATION_TEXT_MAX - m[0].length - 1)) + ' ' + plain(m[0]))
      .replace(/^\S*\s/, '').trim().slice(-CITATION_TEXT_MAX)
    const fragStart = Math.max(0, at - Math.floor(RAW_FRAGMENT_MAX / 2))

    rows.push({
      sourceDocUri: flat(sourceDocUri),
      sourceProvisionRef: sourceProvisionRef ? flat(sourceProvisionRef) : null,
      // ⚠ DERIVED, not read from the document. detection='text' is what says so.
      targetUri: flat(`http://www.legislation.gov.uk/id/${hit.gid}`),
      targetActId: flat(hit.gid),
      targetProvisionRef: targetProvisionRef ? flat(targetProvisionRef) : null,
      citationText: flat(citationText),
      rawFragment: flat(xml.slice(fragStart, Math.min(xml.length, fragStart + RAW_FRAGMENT_MAX))),
      resolved,
      sourceType,
      sourceGid: flat(gid),
      detection: 'text',
    })
  }
  stats.textRows += rows.length
  return rows
}

async function insertRows(rows: CitationRow[], provenance: string): Promise<number> {
  if (rows.length === 0) return 0
  const pool = getNeonPool()
  let written = 0
  const BATCH = 500
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const values: unknown[] = []
    const tuples = batch.map((r, j) => {
      values.push(r.sourceDocUri, r.sourceProvisionRef, r.targetUri, r.targetActId, r.targetProvisionRef,
        r.citationText, r.rawFragment, r.resolved, r.sourceType, r.sourceGid, r.detection, provenance)
      const b = j * 12
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12})`
    })
    const res = await pool.query(
      `INSERT INTO ${CITATION_TABLE}
       (source_doc_uri, source_provision_ref, target_uri, target_act_id, target_provision_ref,
        citation_text, raw_fragment, resolved, source_type, source_gid, detection, extracted_from)
       VALUES ${tuples.join(',')}`, values)
    written += res.rowCount ?? 0
  }
  return written
}

async function main() {
  const pilotIx = process.argv.indexOf('--pilot')
  const pilot = pilotIx >= 0
  const pilotN = pilot ? parseInt(process.argv[pilotIx + 1] ?? '1500', 10) || 1500 : 0
  const typesArg = process.argv.indexOf('--types')
  const types = typesArg >= 0 && process.argv[typesArg + 1] ? new Set(process.argv[typesArg + 1].split(',')) : null
  if (process.argv.includes('--reset') && fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT)
  const done: Set<string> = pilot || !fs.existsSync(CHECKPOINT) ? new Set() : new Set(JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')).done)

  const detectArg = process.argv.indexOf('--detect')
  const detect = detectArg >= 0 ? (process.argv[detectArg + 1] ?? 'both') : 'both'
  const wantMarkup = detect === 'both' || detect === 'markup'
  const wantText = detect === 'both' || detect === 'text'

  const pool = getNeonPool()
  console.log('[cite-edge] loading held gids…')
  const { rows: heldRows } = await pool.query(
    `SELECT DISTINCT split_part(id, ':', 2) AS gid
     FROM corpus_sections WHERE corpus = ANY($1::text[]) AND status = 'compiled'`, [LEG_CORPORA])
  const held = new Set<string>(heldRows.map((r: { gid: string }) => r.gid))
  const bridge = loadIdentityBridge()
  if (bridge.stats.degraded) console.warn(`[cite-edge] ⚠ identity bridge DEGRADED (no ${bridge.stats.sourcePath}) — regnal/calendar targets will read as unheld`)
  console.log(`[cite-edge] ${held.size.toLocaleString()} held instruments · ${bridge.stats.bridgedForms.toLocaleString()} bridged id forms · ${bridge.stats.ambiguousForms.toLocaleString()} refused as ambiguous`)

  const titles = wantText ? await loadActTitles() : new Map<string, string>()
  console.log(`[cite-edge] detectors: ${[wantMarkup && 'markup', wantText && 'text'].filter(Boolean).join(' + ')}`)

  const zipStat = fs.statSync(ZIP_PATH)
  const provenance = `best-collection-xml.zip@${zipStat.mtime.toISOString().slice(0, 10)}`
  console.log(`[cite-edge] opening ${ZIP_PATH} (provenance ${provenance})…`)
  const zip = new ZipReader(ZIP_PATH)
  let entries = zip.entries
    .map(e => ({ e, m: e.name.match(ENTRY_RX) }))
    .filter((x): x is { e: ZipEntryMeta; m: RegExpMatchArray } => x.m != null)
  if (types) entries = entries.filter(x => types.has(x.m[1]))
  console.log(`[cite-edge] ${entries.length.toLocaleString()} documents in scope${pilot ? ` (PILOT ${pilotN}, no writes)` : ''}`)

  const step = pilot ? Math.max(1, Math.floor(entries.length / pilotN)) : 1
  let buffer: CitationRow[] = []
  let processed = 0
  const t0 = Date.now()
  const sample: CitationRow[] = []

  for (let i = 0; i < entries.length; i += step) {
    const { e, m } = entries[i]
    const gid = gidFromEntry(m)
    if (done.has(gid)) continue
    try {
      const xml = zip.readText(e)
      const rows: CitationRow[] = []
      if (wantMarkup) rows.push(...extractDoc(gid, xml, held))
      else stats.docs++
      if (wantText) rows.push(...extractDocText(gid, xml, titles, held))
      if (pilot) { for (const r of rows) if (sample.length < 25 && r.targetProvisionRef) sample.push(r) }
      else buffer.push(...rows)
    } catch (err) {
      stats.docErrors++
      console.error(`  DOC ERROR ${gid}: ${(err as Error).message}`)
    }
    done.add(gid)
    processed++
    if (pilot && processed >= pilotN) break
    if (!pilot) {
      if (buffer.length >= 5000) {
        stats.written += await insertRows(buffer, provenance)
        buffer = []
        fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done] }))
      }
      if (processed % 2000 === 0) {
        const mu = process.memoryUsage()
        console.log(`  ${processed}/${entries.length} docs, rows=${stats.rows}, written=${stats.written}, heap=${Math.round(mu.heapUsed / 1e6)}MB, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
      }
    }
  }
  if (!pilot && buffer.length > 0) {
    stats.written += await insertRows(buffer, provenance)
    fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done] }))
  }

  console.log('\n[cite-edge] stats:', JSON.stringify(stats, null, 1))
  console.log(`[cite-edge] accounting: elements(${stats.elements}) = rows(${stats.rows}) + excludedZone(${stats.excludedZone}) + selfCite(${stats.selfCite})`)
  const accounted = stats.rows + stats.excludedZone + stats.selfCite
  if (accounted !== stats.elements) console.error(`  ⚠ UNACCOUNTED: ${stats.elements - accounted} elements`)
  console.log(`[cite-edge] badUri (kept, target_act_id NULL): ${stats.badUri}`)
  console.log(`[cite-edge] target provision recovered on ${stats.withTargetProvision}/${stats.rows} rows ` +
    `(${(100 * stats.withTargetProvision / Math.max(1, stats.rows)).toFixed(1)}%), of which ${stats.targetProvisionFromSectionRef} came from SectionRef markup`)
  if (wantText) {
    const textAccounted = stats.textRows + stats.textExcludedZone + stats.textAlreadyMarkedUp + stats.textUnresolved + stats.textSelf
    console.log(`[cite-edge] TEXT accounting: spans(${stats.textSpans}) = rows(${stats.textRows}) + excludedZone(${stats.textExcludedZone}) ` +
      `+ alreadyMarkedUp(${stats.textAlreadyMarkedUp}) + unresolvedName(${stats.textUnresolved}) + selfReference(${stats.textSelf})`)
    if (textAccounted !== stats.textSpans) console.error(`  ⚠ UNACCOUNTED: ${stats.textSpans - textAccounted} spans`)
    console.log(`[cite-edge] text rows resolving to a held instrument: ${stats.textResolvedRows}/${stats.textRows}; ` +
      `with a target provision: ${stats.textWithTargetProvision}`)
    console.log(`[cite-edge] ⚠ ${stats.textAlreadyMarkedUp} spans were inside <Citation> markup and belong to the markup detector — ` +
      `counting them here would have double-counted every properly marked-up reference`)
  }

  if (pilot) {
    const projected = Math.round(stats.rows * (entries.length / Math.max(1, stats.docs)))
    const bytesPerRow = 240 + CITATION_TEXT_MAX + RAW_FRAGMENT_MAX / 2
    console.log(`[cite-edge] PROJECTION: ${projected.toLocaleString()} rows over ${entries.length.toLocaleString()} docs ` +
      `≈ ${(projected * bytesPerRow / 1e9).toFixed(2)} GB heap-side (Neon will differ; --status reports the real number)`)
    console.log('\n[cite-edge] sample rows WITH a parsed target provision — check these by eye before trusting the parse:')
    for (const r of sample.slice(0, 15)) {
      console.log(`  ${r.sourceGid}:${r.sourceProvisionRef ?? '-'}  →  ${r.targetActId}:${r.targetProvisionRef}`)
      console.log(`     "${r.citationText}"`)
    }
  }
  zip.close()
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[cite-edge] FATAL', e); process.exit(1) })
}
