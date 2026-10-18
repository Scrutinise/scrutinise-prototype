// ─────────────────────────────────────────────────────────────────────────────
// 26-S §3 (decision 140) — THE ACTION IMPORT PASS.
//
// A document full of ideas becomes rows in the Coherent Actions list, AFTER the user has seen and approved what will be written,
// and with every row saying where it came from. It runs as a PASS (a row, `ActionImportPass`), not a chat turn: sixty silent writes
// cannot be reviewed, half the provisions overlap existing actions, and a chat turn sees only a stub of a filed document (26-M).
//
//   start    → validate the source (a numbered, READ source), plan the chunks, write the pass row.
//   advance  → ONE unit of model work per call (a chunk, then the structure step, then a policy-test batch). The panel calls it in
//              a loop; each call is well inside a serverless function's limit, and a closed tab loses nothing — the next call picks
//              up where the row says. (The update pass is also in-route; the build worker is for builds.)
//   edit     → the user changes a title, a heading, a disposition, strikes a row. Their edit is never overwritten.
//   confirm  → writes. Only here does anything reach `LexCoherentAction` or the policy review.
//
// THE HONESTY RULES (BRIEF_26S §3c), in code:
//   · The ITEM column is the DOCUMENT'S text. A quote is accepted only as a span the stored text really contains; where the model's
//     string is not found word for word the row says so, in words, and is demoted to "Could not place — needs you". Title and
//     summary are labelled as Lex's wording on screen.
//   · Nothing is dropped. A row the model cannot place is "Could not place". Passages that read as proposals but sit inside no row's
//     quote are listed as a count and a list ("Passages not covered") — never silently absent, and never turned into rows by a regex.
//   · A struck row stays in the table. Nothing deletes.
//   · "Adds to #n" APPENDS beside what is there, labelled with its source; the user's own words are never overwritten (decision 59).
//   · Policy-level material goes to the policy review as PROPOSED findings (26-K's categories) — the Guiding Policy is not touched.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { callModelJson } from './model-call'
import { recordUsage } from './spend-ledger'
import { addAction } from './field-machine'
import * as S from './action-structure'
import { HEADING_PALETTE, nextColourKey } from './action-headings'
import { stems, jaccard, actionLabel } from './action-facets'
import { TEST_SYSTEM, TEST_SCHEMA, placeGroups } from './action-ideas'
import { syncRegistry } from './source-registry'
import { fetchedContentIsData } from './fetched-content-guard'
import { writeProposedFindings, type ImportedFinding } from './update-pass'
import { recordToolCall } from './agent/tool-log'
import {
  PROPOSAL_KINDS, PURPOSE_MAX_WORDS, countItems, provenanceLine, wordCount, importPenceFor, chunkNeedsYou, partName, IMPORT_MAX_TRIES, type ImportableSource,
  type ImportChunk, type ImportExisting, type ImportHeading, type ImportItem, type ImportMapping, type ImportPassView, type ImportResult,
  type ImportStatus, type PolicyCategory, type PolicyVerdict, type ProposalKind,
} from './action-import-types'

export type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: string }
const fail = <T = never>(error: string): Result<T> => ({ ok: false, error })

/** ⚠ Sonnet 5.5 unless it cannot hold the table (BRIEF_26S §3g). The choice and the measurement are in docs/LEX_26S_REPORT.md. */
export const IMPORT_MODEL = 'claude-sonnet-5-5'
const TEST_MODEL = 'gemini-2.5-pro'
/** About this many words per chunk: ~12 items at ~250 output tokens each stays far inside one call's time limit. */
export const CHUNK_WORDS = Math.max(300, parseInt(process.env.LEX_IMPORT_CHUNK_WORDS ?? '2600', 10) || 2600)
const QUOTE_WORDS = 60
const TITLE_WORDS = 12
const TEST_BATCH = 25
/**
 * 26-S2 §10.4 — the per-part OUTPUT ceiling. It was 14,000 and a dense part hit it (twice, at 12.4p each). A larger ceiling spends only what is
 * used, so raising it costs nothing on a part that finishes. 20,000 is the most a non-streamed call is run at here: a part must finish in ~110 s
 * (measured: 6–9k tokens in 40–55 s on Sonnet 5.5) and stay resumable. ⚠ Sonnet 5.5's own maximum output is NOT readable from this repository
 * (no registry entry) and was not probed — the splitting, not the ceiling, is what makes a dense part finish.
 */
export const ITEMS_MAX_OUTPUT_TOKENS = 20000
/** The model call, behind a seam so a check can force a truncation (scripts/check-lex-26s2.ts). Production never touches it. */
export const modelCaller: { current: typeof callModelJson } = { current: callModelJson }

const clip = (s: string | null | undefined, n: number): string => { const t = (s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t }
const firstWords = (s: string, n: number): string => { const w = s.trim().split(/\s+/); return w.length > n ? `${w.slice(0, n).join(' ')}…` : s.trim() }
const normText = (s: string): string => s.replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"').replace(/[‐-―]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase()

// ── the source ────────────────────────────────────────────────────────────────────────────────────────────

export interface ImportSource { sourceId: string; number: number; title: string; text: string; materialId: string }

/** A numbered source that was actually READ. A source saved NOT READ is refused with the reason (BRIEF_26S §3b). */
export async function readImportSource(ideaId: string, sourceNumber: number): Promise<Result<ImportSource>> {
  await syncRegistry(ideaId) // numbers every source first (idempotent)
  const s = await prisma.ideaSource.findFirst({ where: { ideaId, number: sourceNumber } })
  if (!s) return fail(`There is no source [Ref: ${sourceNumber}] on this idea, so nothing was started. Use “+ Add research” to file the document first, then try again.`)
  if (s.archivedAt) return fail(`[Ref: ${sourceNumber}] “${clip(s.title, 60)}” has been archived, so nothing was started. Bring it back in the Sources list, or file the document again.`)
  if (s.readStatus !== 'READ' || !s.materialId) {
    const why = s.readNote ?? (s.kind === 'CORPUS' ? 'it is a source from the research record, not a document you filed' : 'only its address was saved — its text was never read')
    return fail(`[Ref: ${sourceNumber}] “${clip(s.title, 60)}” was saved but not read — ${why}. Nothing was started. Add its text with “+ Add research” (paste it, or file the document), then try again.`)
  }
  const m = await prisma.ideaUserMaterial.findUnique({ where: { id: s.materialId }, select: { text: true, archivedAt: true } })
  if (!m?.text?.trim()) return fail(`[Ref: ${sourceNumber}] “${clip(s.title, 60)}” has no stored text (${m?.archivedAt ? 'it was archived' : 'the stored text is empty'}), so nothing was started.`)
  return { ok: true, data: { sourceId: s.id, number: sourceNumber, title: s.title, text: m.text, materialId: s.materialId } }
}

// ── chunking (pure; exported for the check) ──────────────────────────────────────────────────────────────────

interface Para { start: number; end: number; words: number; heading: string | null; provisions: number }

const HEADING_RES = [
  /^#{1,6}\s+\S/,
  /^(clause|section|part|article|schedule|annex|appendix|chapter)\s+\S+/i,
  /^\d+(\.\d+){0,3}[.)]?\s+\S/,
]
function headingOf(p: string): string | null {
  const t = p.trim().split(/\r?\n/)[0]?.trim() ?? ''
  if (!t || t.length > 120) return null
  if (HEADING_RES.some((r) => r.test(t)) && !/[.;]$/.test(t)) return t.replace(/^#{1,6}\s+/, '')
  if (t.length >= 4 && t.length <= 90 && /[A-Z]/.test(t) && t === t.toUpperCase() && !/[a-z]/.test(t)) return t
  return null
}

/**
 * 26-S2 §10.1 — DENSITY, NOT ONLY WORDS. Output size follows the NUMBER OF PROVISIONS, not the word count: on Charlie's real document a
 * 2,100-word part of "seventeen Q&A rules and a thirteen-row table" asked for more than 14,000 tokens of rows and was cut off twice.
 * A provision is estimated from the document's own structure — a list item, a numbered clause, a table row, a bold lead-in, a "Label:" line —
 * and a part is closed at ~PROVISION_CAP of them, with the word ceiling as the backstop. Prose with no markers counts one per ~150 words.
 */
export const PROVISION_CAP = 25
/** A part is never split below this (words); a part this small that still will not read is shown to the user, once. */
export const SPLIT_FLOOR_WORDS = 250
const MARKER_RE = /^\s*(?:[-*•–·]\s+\S|\d+(?:\.\d+)*[.)]\s+\S|\(?[a-z]{1,3}\)\s+\S|\([ivxlc]+\)\s+\S|\|.+\||\*\*[^*\n]{2,90}\*\*|[A-Z][A-Za-z0-9 /’'-]{2,50}:\s+\S)/
const TABLE_RULE_RE = /^\s*\|?[\s:|-]+\|?\s*$/
/**
 * One paragraph's provisions. Marked lines (list items, numbered clauses, table rows, bold lead-ins) count one each. A paragraph with no markers
 * — most text that comes out of a Word file — counts one if it reads as a STATEMENT (12–70 words, ending in punctuation: a rule, a requirement), one
 * per ~70 words if longer, and nothing if it is a heading or a table cell. CALIBRATED on the only measured data (Charlie's document, 17 Oct): on the
 * three parts that were read this gave 35 / 42 / 17 against 32 / 39 / 20 rows actually returned; on the part that was cut off at 14,000 tokens it
 * gave 60. (Paragraph count and words-per-provision did not track: 93 / 80 / 156.) Three parts is a thin sample — it is a guide, and the automatic split is the guarantee.
 */
function paraProvisions(p: string): number {
  const lines = p.split(/\r?\n/).filter((l) => l.trim() && !TABLE_RULE_RE.test(l))
  const marked = lines.filter((l) => MARKER_RE.test(l)).length
  if (marked > 0) return marked
  const w = wordCount(p)
  if (w < 12) return 0
  if (w <= 70) return /[.;:)”"]$/.test(p.trim()) ? 1 : 0
  return Math.ceil(w / 70)
}
export function provisionsIn(s: string): number {
  return s.split(/\r?\n\s*\r?\n/).filter((p) => p.trim()).reduce((n, p) => n + paraProvisions(p), 0)
}

/** Paragraph (blank-line separated) units; a paragraph that alone holds more than the cap (a table, a long list with no blank lines) is cut into its lines. */
function unitsOf(text: string): Para[] {
  const paras: Para[] = []
  const re = /\S[\s\S]*?(?=\r?\n\s*\r?\n|$)/g
  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0
    const prov = paraProvisions(m[0])
    if (prov > PROVISION_CAP && m[0].includes('\n')) {
      let carry: Para | null = null
      for (const lm of m[0].matchAll(/[^\r\n]+/g)) {
        const s = start + (lm.index ?? 0), e = s + lm[0].length
        const marked = MARKER_RE.test(lm[0]) && !TABLE_RULE_RE.test(lm[0])
        if (marked || !carry) { if (carry) paras.push(carry); carry = { start: s, end: e, words: wordCount(lm[0]), heading: headingOf(lm[0]), provisions: marked ? 1 : 0 } }
        else { carry.end = e; carry.words += wordCount(lm[0]) } // a continuation line stays with the item above it
      }
      if (carry) paras.push(carry)
    } else paras.push({ start, end: start + m[0].length, words: wordCount(m[0]), heading: headingOf(m[0]), provisions: prov })
  }
  return paras
}

/** Splits the stored text into parts: at most ~`maxWords` words AND ~PROVISION_CAP provisions, preferring to break before a heading. Offsets index `text`. */
export function planChunks(text: string, maxWords = CHUNK_WORDS, cap = PROVISION_CAP): ImportChunk[] {
  const paras = unitsOf(text)
  if (!paras.length) return []
  type Cur = { from: number; to: number; label: string; words: number; provisions: number }
  const chunks: Cur[] = []
  let cur: Cur | null = null
  let lastHeading = ''
  for (const p of paras) {
    if (p.heading) lastHeading = p.heading
    const wouldBeWords = (cur?.words ?? 0) + p.words
    const wouldBeProv = (cur?.provisions ?? 0) + p.provisions
    const breakHere = cur && (wouldBeWords > maxWords || wouldBeProv > cap || (p.heading && (cur.words >= maxWords * 0.6 || cur.provisions >= cap * 0.8)))
    if (!cur || breakHere) {
      if (cur) chunks.push(cur)
      cur = { from: p.start, to: p.end, label: lastHeading, words: p.words, provisions: p.provisions }
    } else { cur.to = p.end; cur.words += p.words; cur.provisions += p.provisions; if (!cur.label && lastHeading) cur.label = lastHeading }
  }
  if (cur) chunks.push(cur)
  return chunks.map((c, i) => ({
    index: i, part: String(i + 1), label: `${clip(c.label, 60) || 'start of the document'} (part ${i + 1} of ${chunks.length})`,
    from: c.from, to: c.to, status: 'PENDING' as const, itemCount: 0, tries: 0, error: null,
  }))
}

/**
 * 26-S2 §10.2 — SPLIT A PART IN TWO at the paragraph (or, inside one, line) boundary nearest the middle by provisions, then words. Returns
 * null at the floor (<= SPLIT_FLOOR_WORDS words) or when there is no boundary to cut at. Pure; the halves are exact slices of the part.
 */
export function splitRange(text: string, from: number, to: number): [{ from: number; to: number }, { from: number; to: number }] | null {
  const slice = text.slice(from, to)
  if (wordCount(slice) <= SPLIT_FLOOR_WORDS) return null
  // Boundaries: ends of the units inside the slice, forced to line level when a single paragraph is the whole part.
  let units = unitsOf(slice).map((u) => ({ ...u, start: u.start + from, end: u.end + from }))
  if (units.length < 2) {
    units = []
    for (const lm of slice.matchAll(/[^\r\n]+/g)) { const s = from + (lm.index ?? 0); units.push({ start: s, end: s + lm[0].length, words: wordCount(lm[0]), heading: null, provisions: 1 }) }
  }
  if (units.length < 2) return null
  const totalW = units.reduce((a, u) => a + u.words, 0), totalP = units.reduce((a, u) => a + u.provisions, 0)
  let accW = 0, accP = 0, best = -1, bestScore = Infinity
  for (let i = 0; i < units.length - 1; i++) {
    accW += units[i].words; accP += units[i].provisions
    const score = Math.abs(accP / Math.max(totalP, 1) - 0.5) + Math.abs(accW / Math.max(totalW, 1) - 0.5) * 0.5
    if (accW >= SPLIT_FLOOR_WORDS / 2 && totalW - accW >= SPLIT_FLOOR_WORDS / 2 && score < bestScore) { bestScore = score; best = i }
  }
  if (best < 0) best = Math.floor(units.length / 2) - 1
  if (best < 0 || best >= units.length - 1) return null
  return [{ from, to: units[best].end }, { from: units[best + 1].start, to }]
}

// ── verifying the document's words (pure; exported for the check) ───────────────────────────────────────────

/** A regex that finds `words` in the ORIGINAL text, tolerant of curly quotes, dash kinds and any whitespace run — so the span
 *  returned is the document's own characters, never the model's. */
function spanPattern(words: string[]): RegExp {
  const piece = (w: string) => w.split('').map((ch) => {
    if (/['‘’‚‛]/.test(ch)) return "['‘’‚‛]"
    if (/["“”„‟]/.test(ch)) return '["“”„‟]'
    if (/[-‐-―]/.test(ch)) return '[-‐-―]'
    return ch.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')
  }).join('')
  return new RegExp(words.map(piece).join('\\s+'), 'i')
}

/**
 * The document's own words for what the model quoted — or null. Whole-quote match first (any length); then the longest prefix
 * that matches (>= 5 words); never the model's string.
 */
export function findInDocument(quote: string, text: string): string | null {
  const words = quote.replace(/[…]/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (words.length < 3) return null
  const whole = spanPattern(words).exec(text)
  if (whole) return whole[0]
  for (let n = words.length - 1; n >= 5; n--) {
    const m = spanPattern(words.slice(0, n)).exec(text)
    if (m) return m[0]
  }
  return null
}

/** Sentences of `text`, with their offsets. */
function sentencesOf(text: string): Array<{ start: number; text: string }> {
  const out: Array<{ start: number; text: string }> = []
  for (const m of text.matchAll(/[^.!?\n]+(?:[.!?]+|\n|$)/g)) {
    const t = m[0].trim()
    if (t) out.push({ start: m.index ?? 0, text: t })
  }
  return out
}

/** The document's sentence that best matches a loose quote (>= 0.6 stem overlap) — used when the model pointed at the right
 *  place but not word for word. The result is still the document's text. */
export function nearestSentence(quote: string, text: string): string | null {
  const q = stems(quote)
  if (q.size < 3) return null
  let best: { s: string; score: number } | null = null
  for (const s of sentencesOf(text)) {
    // CONTAINMENT, not Jaccard: a loose quote is shorter than the sentence it points at, so most of ITS words must be in the
    // sentence (>= 70%), and the sentence must not merely share a couple of common words with it (>= 25% of the sentence).
    const ss = stems(s.text)
    let inter = 0
    for (const x of q) if (ss.has(x)) inter++
    const score = inter / q.size
    if (score >= 0.7 && inter / Math.max(ss.size, 1) >= 0.25 && (!best || score > best.score)) best = { s: s.text, score }
  }
  return best?.s ?? null
}

// A modal or a creating verb in the imperative or "shall" register — the words a proposal is written in. Deliberately NOT "amend"/"legislate":
// those turn up in a document's own description of itself ("each can be amended or rejected") and made the list noisy on the first run.
const PROPOSAL_WORDS_RE = /\b(should|must|shall|require[sd]?|requiring|establish(?:es|ed)?|create[sd]?|introduc(?:e|es|ed)|mandat(?:e|es|ed|ory)|appoint(?:s|ed)?|prohibit(?:s|ed)?|ban(?:s|ned)?)\b/i

/**
 * Passages that read as proposals and fall inside NO row's quote. A count and a list — NEVER rows: a regex that made rows would
 * put rows in the table the fixture does not list. The review shows them under "Passages not covered" so a missed provision is
 * visible, and the user can promote one.
 */
export function findUncovered(chunkText: string, section: string, items: Array<Pick<ImportItem, 'quote'>>): Array<{ section: string; text: string }> {
  const quotes = items.map((i) => normText(i.quote.replace(/…$/, '')))
  const out: Array<{ section: string; text: string }> = []
  for (const s of sentencesOf(chunkText)) {
    if (wordCount(s.text) < 8 || !PROPOSAL_WORDS_RE.test(s.text)) continue
    const ns = normText(s.text)
    const covered = quotes.some((q) => q.length >= 12 && (ns.includes(q) || q.includes(ns) || jaccard(stems(ns), stems(q)) >= 0.6))
    if (!covered) out.push({ section, text: clip(s.text, 320) })
  }
  return out
}

// ── merging duplicates across chunks (pure; exported for the check) ─────────────────────────────────────────

/** 26-S2 decision 180 — do two quotes carry the SAME DOCUMENT TEXT? Equal, or one inside the other (the same passage cut at a
 *  different end — the quotes are the document's own characters, so a re-read passage is a substring, never a paraphrase). A fuzzy
 *  stem overlap was tried and merged two of ten same-shaped Q&A rules on shared words ("pay"); rows that share a SHAPE share
 *  template words, never the passage. The error that remains is one extra row the user can strike, not a lost provision. */
export function quotesOverlap(a: string, b: string): boolean {
  const na = normText(a.replace(/…$/, '')), nb = normText(b.replace(/…$/, ''))
  if (na.length < 20 || nb.length < 20) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

/** Two rows from different chunks that are the same item collapse to one (BRIEF_26S §3g: "duplicates across chunks must resolve to
 *  one row"). The first keeps its place; the section notes where else it appeared. Decision 180: ONLY rows whose quoted text
 *  substantially overlaps — the title and summary are the model's words and never evidence that two rows are one passage. */
export function mergeDuplicates(items: ImportItem[]): { items: ImportItem[]; merged: number } {
  const kept: ImportItem[] = []
  let merged = 0
  for (const it of items) {
    const twin = kept.find((k) => k.chunk !== it.chunk && k.proposal === it.proposal && (k.actionNumber ?? -1) === (it.actionNumber ?? -1) && quotesOverlap(k.quote, it.quote))
    if (twin) { merged++; if (!twin.section.includes(it.section)) twin.section = `${twin.section} (also ${it.section})`; continue }
    kept.push(it)
  }
  return { items: kept.map((k, i) => ({ ...k, id: `i${i + 1}` })), merged }
}

// ── the model's side ──────────────────────────────────────────────────────────────────────────────────────

interface RawItem {
  section?: unknown; quote?: unknown; proposal?: unknown; headingName?: unknown; actionNumber?: unknown; reason?: unknown
  title?: unknown; summary?: unknown; implementer?: unknown; policyCategory?: unknown; policyTarget?: unknown
}

export const ITEMS_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          section: { type: 'string' }, quote: { type: 'string' },
          proposal: { type: 'string', enum: [...PROPOSAL_KINDS] },
          headingName: { type: 'string' }, actionNumber: { type: 'integer' }, reason: { type: 'string' },
          title: { type: 'string' }, summary: { type: 'string' }, implementer: { type: 'string' },
          policyCategory: { type: 'string', enum: ['SUPPORTS', 'CONTRADICTS', 'NEW_CAUSE', 'NEW_POLICY_OPTION'] },
          policyTarget: { type: 'string' },
        },
        required: ['section', 'quote', 'proposal', 'reason', 'title', 'summary'],
      },
    },
  },
  required: ['items'],
} as const

export const ITEMS_SYSTEM = [
  'You read ONE part of a document that proposes ideas for a UK policy proposal, and list every separate PROPOSAL in it, so a person',
  'can review each one before anything is added to their Coherent Actions list. A coherent action is a concrete step: something an',
  'organisation or a person would do, change, create, publish, require or stop.',
  '',
  'Return one item for each separate proposal. Split a run of provisions into separate items whenever each could be accepted or',
  'rejected on its own; do not merge two provisions into one item, and do not split one provision into its sentences.',
  '',
  'For each item:',
  '  section      the DOCUMENT\'S own reference for where it is (a heading number, a clause number, a table row), copied from the text;',
  '               if the text has none, the words of the nearest heading.',
  '  quote        a VERBATIM span of the document, at most 60 words: the words that make the proposal. Copy them exactly. Do not tidy,',
  '               shorten inside the span, correct, or join two separate passages. If you cannot copy it exactly, say UNPLACED.',
  '  proposal     one of:',
  '    NEW         a separable provision that no EXISTING ACTION below already says.',
  '    ADDS_TO     says the same thing as an existing action (give actionNumber) and adds detail or wording to it.',
  '    PART_OF     is one component of an existing action — a field, a rule, a data item (give actionNumber).',
  '    POLICY      is about the overall approach or its principles — what the guiding policy should be — not a step anyone takes.',
  '                Give policyCategory (SUPPORTS or CONTRADICTS an existing cause or approach, or NEW_CAUSE, or NEW_POLICY_OPTION) and',
  '                policyTarget (exactly one of the references given below; leave it out for NEW_CAUSE and NEW_POLICY_OPTION).',
  '    NOT_ACTION  background, a description of the present position, or argument. Say why in `reason`.',
  '    UNPLACED    it reads as a proposal but you cannot tell what step it is or where it belongs, or you cannot copy its words exactly.',
  '                Say why. NEVER omit an item because you cannot place it.',
  '  headingName  NEW only: the instrument this provision belongs to — an existing heading\'s exact name where one fits, otherwise a',
  '               short name for a new one, taken from the document\'s own terms.',
  '  actionNumber ADDS_TO and PART_OF only: the number of the existing action, exactly as listed.',
  '  title        at most 12 words, in the voice of the idea: what the action DOES.',
  '  summary      one line.',
  '  implementer  the body or role the DOCUMENT names as doing it, if it names one; otherwise leave it out. Never infer one.',
  '  reason       one line: why this disposition.',
  '',
  'Check overlaps before you answer NEW: if an existing action already says the same thing, the item is ADDS_TO (or PART_OF), not NEW.',
  'ADDS_TO and PART_OF refer ONLY to the existing actions listed below, by their number. A provision that is a detail of ANOTHER PROVISION',
  'IN THIS DOCUMENT is not PART_OF anything: if it could be accepted or rejected on its own it is its own NEW item.',
  'A part of the document with no proposal in it yields an empty list. Never carry over an example, a subject or a figure from these',
  'instructions or from any other document.',
  fetchedContentIsData('document text'),
].join('\n')

interface KernelBits { problem: string; obstacle: string; causes: Array<{ number: number; cause: string }>; options: Array<{ number: number; approach: string }>; chosen: { approach: string; rulesOut: string | null; chainLink: string | null } | null }

export async function readKernelBits(ideaId: string): Promise<KernelBits> {
  const [idea, causes, options, chosen] = await Promise.all([
    prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true, challenge: true, summaryDescription: true, pivotalObstacle: true } }),
    prisma.diagnosisCause.findMany({ where: { ideaId }, select: { number: true, cause: true }, orderBy: { number: 'asc' } }),
    prisma.policyOption.findMany({ where: { ideaId, status: { not: 'RULED_OUT' }, mergedIntoId: null, kind: 'GUIDING_POLICY' }, select: { number: true, approach: true }, orderBy: { number: 'asc' } }),
    prisma.policyOption.findFirst({ where: { ideaId, status: 'CHOSEN' }, select: { approach: true, rulesOut: true, chainLink: true } }),
  ])
  return {
    problem: idea?.challenge?.trim() || idea?.summaryDescription?.trim() || idea?.title || '',
    obstacle: idea?.pivotalObstacle?.trim() || '',
    causes: causes.filter((c) => c.number != null).map((c) => ({ number: c.number!, cause: c.cause })),
    options: options.filter((o) => o.number != null).map((o) => ({ number: o.number!, approach: o.approach })),
    chosen,
  }
}

const policyRefs = (k: KernelBits): Set<string> => new Set(['pivotalObstacle', 'challenge', ...k.causes.map((c) => `causes:${c.number}`), ...k.options.map((o) => `policyOptions:${o.number}`)])

export function chunkUser(text: string, chunk: ImportChunk, mapping: ImportMapping, kernel: KernelBits, live: Array<{ number: number; label: string }>, headingNames: string[], ideaTitle: string): string {
  return [
    `THE IDEA: ${ideaTitle}`,
    kernel.problem ? `THE PROBLEM IT ADDRESSES: ${clip(kernel.problem, 500)}` : '',
    '',
    'EXISTING HEADINGS (use these names exactly where one fits):',
    headingNames.length ? headingNames.map((h) => `- ${h}`).join('\n') : '(none yet)',
    '',
    'EXISTING ACTIONS (number — what it does):',
    live.length ? live.map((a) => `#${a.number} — ${clip(a.label, 160)}`).join('\n') : '(none yet)',
    '',
    'REFERENCES A POLICY ITEM MAY BEAR ON (policyTarget must be exactly one of these):',
    [
      kernel.obstacle ? `pivotalObstacle — ${clip(kernel.obstacle, 200)}` : 'pivotalObstacle',
      'challenge — the problem statement',
      ...kernel.causes.map((c) => `causes:${c.number} — ${clip(c.cause, 160)}`),
      ...kernel.options.map((o) => `policyOptions:${o.number} — ${clip(o.approach, 160)}`),
    ].join('\n'),
    '',
    `THE DOCUMENT: "${mapping.sourceTitle}" — ${chunk.label}. List every proposal in THIS part only.`,
    '--- document text begins ---',
    text.slice(chunk.from, chunk.to),
    '--- document text ends ---',
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n')
}

/** Turn what the model said into a row — or into an honest "Could not place". Pure on its inputs; exported for the check. */
export function shapeItem(
  raw: RawItem, ctx: { chunkIndex: number; chunkText: string; liveNumbers: Set<number>; headingNames: string[]; refs: Set<string> },
): Omit<ImportItem, 'id'> {
  const str = (v: unknown, n: number) => (typeof v === 'string' ? clip(v, n) : '')
  const section = str(raw.section, 80) || 'section not stated'
  const rawQuote = typeof raw.quote === 'string' ? raw.quote.trim() : ''
  let proposal: ProposalKind = PROPOSAL_KINDS.includes(raw.proposal as ProposalKind) ? (raw.proposal as ProposalKind) : 'UNPLACED'
  let reason = str(raw.reason, 300)

  // ⚠ THE QUOTE IS THE DOCUMENT'S. Found word for word, or found as the document's nearest sentence, or flagged as Lex's wording.
  let quote = rawQuote ? findInDocument(rawQuote, ctx.chunkText) : null
  let quoteVerified = !!quote
  if (!quote && rawQuote) { quote = nearestSentence(rawQuote, ctx.chunkText); quoteVerified = !!quote }
  if (!quote) {
    quote = rawQuote || '(no wording given)'
    if (proposal !== 'NOT_ACTION') {
      proposal = 'UNPLACED'
      reason = `The wording shown is Lex's, not the document's: it could not be found word for word in ${section}. ${reason}`.trim()
    }
  }

  let actionNumber = typeof raw.actionNumber === 'number' && Number.isInteger(raw.actionNumber) && raw.actionNumber > 0 ? raw.actionNumber : null
  if ((proposal === 'ADDS_TO' || proposal === 'PART_OF') && (actionNumber == null || !ctx.liveNumbers.has(actionNumber))) {
    // ⚠ A detail of another provision IN THIS DOCUMENT is its own NEW row, so reaching here means Lex pointed at nothing real.
    reason = `Lex said this adds to an existing action but ${actionNumber == null ? 'named none' : `named #${actionNumber}, which is not on the list`}. ${reason}`.trim()
    proposal = 'UNPLACED'; actionNumber = null
  }
  if (proposal !== 'ADDS_TO' && proposal !== 'PART_OF') actionNumber = null

  let headingName: string | null = null
  if (proposal === 'NEW') {
    const hn = str(raw.headingName, 80)
    headingName = hn ? (ctx.headingNames.find((h) => h.toLowerCase() === hn.toLowerCase()) ?? hn) : null
  }

  let policyCategory: PolicyCategory | null = null
  let policyTarget: string | null = null
  if (proposal === 'POLICY') {
    policyCategory = ['SUPPORTS', 'CONTRADICTS', 'NEW_CAUSE', 'NEW_POLICY_OPTION'].includes(raw.policyCategory as string) ? (raw.policyCategory as PolicyCategory) : null
    const t = typeof raw.policyTarget === 'string' ? raw.policyTarget.trim() : ''
    policyTarget = (policyCategory === 'SUPPORTS' || policyCategory === 'CONTRADICTS') && ctx.refs.has(t) ? t : null
    if ((policyCategory === 'SUPPORTS' || policyCategory === 'CONTRADICTS') && !policyTarget) policyCategory = policyCategory // kept; target is stated as unknown
  }

  const implementer = str(raw.implementer, 200)
  return {
    chunk: ctx.chunkIndex, section, quote: firstWords(quote, QUOTE_WORDS), quoteVerified, proposal, headingName, actionNumber, reason,
    policyTest: null,
    title: firstWords(str(raw.title, 200), TITLE_WORDS).replace(/…$/, ''), summary: str(raw.summary, 400),
    implementer: implementer || null, policyCategory, policyTarget, struck: false, edited: false,
  }
}

// ── start ─────────────────────────────────────────────────────────────────────────────────────────────────

type PassRow = NonNullable<Awaited<ReturnType<typeof prisma.actionImportPass.findFirst>>>
const mappingOf = (r: PassRow): ImportMapping => r.mapping as unknown as ImportMapping
const asView = (r: PassRow): ImportPassView => ({
  id: r.id, status: r.status as ImportStatus, sourceNumber: r.sourceNumber, chunkCount: r.chunkCount, chunksDone: r.chunksDone,
  spentPence: r.spentPence, failure: r.failure, mapping: mappingOf(r), result: (r.result ?? null) as unknown as ImportResult | null, createdAt: r.createdAt.toISOString(),
})

async function liveActions(ideaId: string) {
  return prisma.lexCoherentAction.findMany({
    where: { ideaId, status: 'LIVE' }, orderBy: [{ number: 'asc' }],
    select: { id: true, number: true, title: true, practicalStep: true, headingId: true },
  })
}

export async function startImport(ideaId: string, userId: string, sourceNumber: number): Promise<Result<ImportPassView>> {
  const open = await prisma.actionImportPass.findFirst({ where: { ideaId, status: { in: ['MAPPING', 'READY', 'CONFIRMING'] } }, orderBy: { createdAt: 'desc' } })
  if (open) {
    if (open.sourceNumber === sourceNumber && open.status !== 'CONFIRMING') return { ok: true, data: asView(open) } // resume, not a second spend
    return fail(`An import of [Ref: ${open.sourceNumber}] is already ${open.status === 'READY' ? 'waiting for your review' : 'being read'}. Confirm or discard it before starting another. Nothing was started.`)
  }
  const src = await readImportSource(ideaId, sourceNumber)
  if (!src.ok) return fail((src as { error: string }).error)
  const chunks = planChunks(src.data.text)
  if (!chunks.length) return fail(`[Ref: ${sourceNumber}] has no text to read, so nothing was started.`)

  const [acts, headings] = await Promise.all([liveActions(ideaId), prisma.actionHeading.findMany({ where: { ideaId }, select: { id: true, name: true } })])
  const hName = new Map(headings.map((h) => [h.id, h.name]))
  const existing: ImportExisting[] = acts.map((a) => ({
    actionId: a.id, number: a.number, label: actionLabel(a, 100), currentHeading: a.headingId ? hName.get(a.headingId) ?? null : null, proposedHeading: null,
  }))
  const mapping: ImportMapping = {
    version: 1, sourceTitle: clip(src.data.title, 200), chunks, stage: 'ITEMS', items: [], existing, headings: [], uncovered: [],
    guidingPolicy: null, policyTestNote: null, policyTestCursor: 0, model: IMPORT_MODEL,
  }
  const row = await prisma.actionImportPass.create({
    data: { ideaId, sourceId: src.data.sourceId, sourceNumber, status: 'MAPPING', mapping: mapping as never, chunkCount: chunks.length, chunksDone: 0, startedBy: userId },
  })
  return { ok: true, data: asView(row) }
}

// ── advance ─────────────────────────────────────────────────────────────────────────────────────────────────

async function priced(usage: Parameters<typeof recordUsage>[0] & { recorded?: unknown }, ideaId: string, userId: string | null, pass: string, failed: boolean) {
  const rec = (usage as { recorded?: { pence: number | null } }).recorded ?? await recordUsage(usage, { stream: 'lex', pass, ideaId, userId, failed })
  return (rec as { pence: number | null }).pence ?? 0
}

/** Compare-and-set save: if another call advanced the pass meanwhile, this unit's result is dropped (and says so) rather than merged. */
async function save(row: PassRow, patch: { mapping?: ImportMapping; status?: ImportStatus; chunksDone?: number; chunkCount?: number; failure?: string | null; addPence?: number }): Promise<boolean> {
  const r = await prisma.actionImportPass.updateMany({
    where: { id: row.id, updatedAt: row.updatedAt },
    data: {
      ...(patch.mapping ? { mapping: patch.mapping as never } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.chunksDone != null ? { chunksDone: patch.chunksDone } : {}),
      ...(patch.chunkCount != null ? { chunkCount: patch.chunkCount } : {}),
      ...(patch.failure !== undefined ? { failure: patch.failure } : {}),
      ...(patch.addPence ? { spentPence: (row.spentPence ?? 0) + patch.addPence } : {}),
      updatedAt: new Date(),
    },
  })
  return r.count === 1
}

export async function advanceImport(ideaId: string, userId: string, passId: string): Promise<Result<ImportPassView>> {
  const row = await prisma.actionImportPass.findFirst({ where: { id: passId, ideaId } })
  if (!row) return fail('That import is not on this idea. Nothing was changed.')
  if (row.status !== 'MAPPING') return { ok: true, data: asView(row) } // READY / FAILED / CONFIRMED: nothing to advance
  const m = mappingOf(row)
  const src = await readImportSource(ideaId, row.sourceNumber)
  if (!src.ok) { const why = (src as { error: string }).error; await save(row, { status: 'FAILED', failure: why }); return fail(why) }
  const text = src.data.text

  try {
    if (m.stage === 'ITEMS') return await advanceChunk(row, m, text, ideaId, userId)
    if (m.stage === 'STRUCTURE') return await advanceStructure(row, m, ideaId, userId)
    if (m.stage === 'POLICY_TEST') return await advancePolicyTest(row, m, ideaId, userId)
    await save(row, { status: 'READY' })
  } catch (err) {
    // Plain words on the screen; the exception is in the log. The pass is KEPT (a part already read is not lost to a fault further on).
    const msg = `The import stopped while ${m.stage === 'ITEMS' ? 'reading the document' : m.stage === 'STRUCTURE' ? 'proposing headings' : 'testing against the policy'}, because something went wrong on our side. Everything read so far is kept and nothing has been written to your actions. Try again; if it stops again, use “Report a bug”.`
    console.error('[action-import] advance threw', { passId, stage: m.stage, err })
    return fail(msg)
  }
  const again = await prisma.actionImportPass.findFirst({ where: { id: passId } })
  return { ok: true, data: asView(again!) }
}

/** The provider refused because the ACCOUNT is out of credit (HTTP 400 "credit balance is too low") — retrying cannot help. */
const outOfCredit = (f: { detail: string }) => /credit balance is too low|insufficient[_ ]quota|billing/i.test(f.detail)

/** Worth one immediate retry: a network fault, a timeout-free 5xx/429/529, an empty or unparseable answer. Never a billing or request-shape refusal. */
export function isTransient(f: { reason: string; detail: string }): boolean {
  if (f.reason === 'empty' || f.reason === 'bad-json') return true
  if (f.reason !== 'http') return false // truncated is split, not retried; timeout would double a 200 s wait; blocked / no-key / unroutable cannot change
  if (outOfCredit(f)) return false
  const code = /HTTP (\d{3})/.exec(f.detail)?.[1]
  return !code || code === '429' || code.startsWith('5') // no status = the connection itself failed
}

/** The one reason shown in the parentheses of the screen sentence — plain words, no developer nouns. */
export function failureWhy(f: { reason: string; detail: string }): string {
  if (outOfCredit(f)) return 'the model provider says the account is out of credit'
  return 'the model did not answer'
}

async function advanceChunk(row: PassRow, m: ImportMapping, text: string, ideaId: string, userId: string): Promise<Result<ImportPassView>> {
  // 26-S2 §10.3 — a part that used up its tries WAITS for the user ("Retry part N"); it does not end the pass, and the others are kept.
  const chunk = m.chunks.find((c) => c.status === 'PENDING' || (c.status === 'FAILED' && !chunkNeedsYou(c)))
  if (!chunk && m.chunks.some(chunkNeedsYou)) {
    const waiting = m.chunks.filter(chunkNeedsYou)
    const read = m.chunks.filter((c) => c.status === 'DONE').length
    const msg = `${read} of ${m.chunks.length} parts read. ${waiting.map((c) => c.error ?? `Part ${partName(c)} could not be read.`).join(' ')}`
    if (row.failure !== msg) await save(row, { failure: msg })
    return { ok: true, data: asView((await prisma.actionImportPass.findFirst({ where: { id: row.id } }))!) }
  }
  if (!chunk) {
    // every chunk is read → merge, find what no row covers, move to the structure step
    const merged = mergeDuplicates(m.items)
    const uncovered = m.chunks.flatMap((c) => findUncovered(text.slice(c.from, c.to), c.label, m.items.filter((i) => i.chunk === c.index)))
    const next: ImportMapping = { ...m, items: merged.items, uncovered: uncovered.slice(0, 60), stage: 'STRUCTURE' }
    await save(row, { mapping: next })
    return { ok: true, data: asView((await prisma.actionImportPass.findFirst({ where: { id: row.id } }))!) }
  }

  const [kernel, acts, headings, idea] = await Promise.all([
    readKernelBits(ideaId), liveActions(ideaId), prisma.actionHeading.findMany({ where: { ideaId }, select: { name: true } }),
    prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } }),
  ])
  const live = acts.filter((a) => a.number != null).map((a) => ({ number: a.number!, label: actionLabel(a, 160) }))
  const headingNames = headings.map((h) => h.name)

  chunk.tries += 1
  const t0 = Date.now()
  const callItems = () => modelCaller.current<{ items?: RawItem[] }>({
    model: IMPORT_MODEL, system: ITEMS_SYSTEM, user: chunkUser(text, chunk, m, kernel, live, headingNames, idea?.title ?? ''), schema: ITEMS_SCHEMA as never,
    maxOutputTokens: ITEMS_MAX_OUTPUT_TOKENS, timeoutMs: 200_000, temperature: 0.1, label: 'action-import-chunk', stream: 'lex', pass: 'action-import.map', ideaId, userId,
  })
  // 18 Oct — a single provider failure retries ITSELF once before it reaches the screen (a part is read, or the user is told why it was not).
  let res = await callItems()
  let pence = await priced(res.usage as never, ideaId, userId, 'action-import.map', !res.ok)
  if (!res.ok && isTransient(res as { reason: string; detail: string })) {
    console.warn('[action-import] transient failure, retrying once', { passId: row.id, part: partName(chunk), reason: (res as { reason: string }).reason, detail: clip((res as { detail: string }).detail, 300) })
    res = await callItems()
    pence += await priced(res.usage as never, ideaId, userId, 'action-import.map', !res.ok)
  }
  const seconds = Math.round((Date.now() - t0) / 100) / 10

  if (!res.ok) {
    const f = res as { reason: string; detail: string }
    // Developer words ("raise the budget") go to the LOG, never the screen (26-S2 §10.5). The user gets one sentence per failure.
    console.warn('[action-import] part failed', { passId: row.id, part: partName(chunk), reason: f.reason, detail: clip(f.detail, 300) })
    const here = text.slice(chunk.from, chunk.to)
    if (f.reason === 'truncated') {
      // Too many rows for one call: SPLIT the part and read the halves — recursively, down to the floor. Not a try, not an error.
      const halves = splitRange(text, chunk.from, chunk.to)
      if (halves) {
        const base = partName(chunk)
        const mk = (h: { from: number; to: number }, suffix: string, idx: number): ImportChunk => ({
          index: idx, part: `${base}${suffix}`, label: `${clip(chunk.label.replace(/\s*\(part [^)]*\)\s*$/, ''), 60) || 'start of the document'} (part ${base}${suffix})`,
          from: h.from, to: h.to, status: 'PENDING', itemCount: 0, tries: 0, error: null,
        })
        const nextIdx = Math.max(...m.chunks.map((c) => c.index)) + 1
        const kids = [mk(halves[0], 'a', nextIdx), mk(halves[1], 'b', nextIdx + 1)]
        const chunks = m.chunks.flatMap((c) => (c.index === chunk.index ? kids : [c]))
        const next: ImportMapping = { ...m, chunks, notice: `Part ${base} was too dense to read in one go — splitting it and trying again.` }
        await save(row, { mapping: next, addPence: pence, failure: null, chunkCount: chunks.length })
        return { ok: true, data: asView((await prisma.actionImportPass.findFirst({ where: { id: row.id } }))!) }
      }
      chunk.status = 'FAILED'; chunk.tries = IMPORT_MAX_TRIES
      chunk.error = `Part ${partName(chunk)} could not be read even in small pieces (${wordCount(here)} words). Nothing has been written. Paste that section on its own, or discard this import.`
    } else {
      chunk.status = 'FAILED'
      chunk.error = chunk.tries >= IMPORT_MAX_TRIES
        ? `Lex could not read part ${partName(chunk)} (${failureWhy(f)}). Nothing has been written. Press “Retry part ${partName(chunk)}”, or discard this import.`
        : null
    }
    const stuck = chunkNeedsYou(chunk)
    await save(row, { mapping: m, addPence: pence, failure: stuck ? `${m.chunks.filter((c) => c.status === 'DONE').length} of ${m.chunks.length} parts read. ${chunk.error}` : null })
    return { ok: true, data: asView((await prisma.actionImportPass.findFirst({ where: { id: row.id } }))!) }
  }

  const ctx = {
    chunkIndex: chunk.index, chunkText: text.slice(chunk.from, chunk.to), liveNumbers: new Set(live.map((a) => a.number)),
    headingNames, refs: policyRefs(kernel),
  }
  const shaped = (res.value.items ?? []).map((r) => shapeItem(r, ctx)).filter((i) => i.quote || i.title)
  chunk.status = 'DONE'; chunk.error = null; chunk.itemCount = shaped.length
  chunk.pence = Math.round(pence * 100) / 100; chunk.outTokens = (res.usage as { tokensOut?: number }).tokensOut ?? 0; chunk.seconds = seconds // measured (§10.6)
  const next: ImportMapping = { ...m, items: [...m.items, ...shaped.map((s, i) => ({ ...s, id: `c${chunk.index}-${i + 1}` }))], notice: null }
  await save(row, { mapping: next, chunksDone: next.chunks.filter((c) => c.status === 'DONE').length, addPence: pence, failure: null })
  return { ok: true, data: asView((await prisma.actionImportPass.findFirst({ where: { id: row.id } }))!) }
}

/**
 * 26-S2 §10.3 — "Retry part N": a part that failed its tries (or was too dense even in small pieces) goes back to waiting, with fresh tries.
 * Every part already read is kept; nothing is re-read or re-spent but this one.
 */
export async function retryPart(ideaId: string, passId: string, chunkIndex: number): Promise<Result<ImportPassView>> {
  const row = await prisma.actionImportPass.findFirst({ where: { id: passId, ideaId } })
  if (!row) return fail('That import is not on this idea. Nothing was changed.')
  if (row.status !== 'MAPPING') return fail('That import is no longer being read, so there is nothing to retry. Nothing was changed.')
  const m = mappingOf(row)
  const c = m.chunks.find((x) => x.index === chunkIndex)
  if (!c) return fail('That part is not in this import. Nothing was changed.')
  if (c.status !== 'FAILED') return fail(`Part ${partName(c)} is not waiting for a retry. Nothing was changed.`)
  c.status = 'PENDING'; c.tries = 0; c.error = null
  const ok = await save(row, { mapping: { ...m, notice: null }, failure: null })
  if (!ok) return fail('The import moved on while you clicked. Look at it again. Nothing was changed.')
  return { ok: true, data: asView((await prisma.actionImportPass.findFirst({ where: { id: passId } }))!) }
}

// ── structure: headings + existing → heading ─────────────────────────────────────────────────────────────

const STRUCTURE_SCHEMA = {
  type: 'object',
  properties: {
    purposes: { type: 'array', items: { type: 'object', properties: { heading: { type: 'string' }, purpose: { type: 'string' } }, required: ['heading', 'purpose'] } },
    existing: { type: 'array', items: { type: 'object', properties: { number: { type: 'integer' }, heading: { type: 'string' } }, required: ['number', 'heading'] } },
  },
  required: ['purposes', 'existing'],
} as const

const STRUCTURE_SYSTEM = [
  'You help a person sort their Coherent Actions under HEADINGS. A heading is an INSTRUMENT — the thing that gets made — and an action',
  'is one provision inside it.',
  '',
  'You are given (1) NEW HEADINGS that an import proposes to create, each with the provisions that would go under it, and (2) the',
  'EXISTING ACTIONS, with the heading each already has.',
  '',
  'Return:',
  '  purposes  for each new heading: a purpose paragraph of AT MOST 120 words saying what this instrument does and why it is needed, drawn',
  '            only from the provisions listed under it. Plain English. No evaluative preamble.',
  '  existing  for each existing action that has NO heading, or whose heading plainly does not fit: the heading it belongs under — an',
  '            existing or new heading, by its exact name. Leave out an action whose heading is fine, and leave out one you are unsure',
  '            about; the person decides. Do not invent a heading that is not in either list.',
  'Never carry over an example, a subject or a figure from these instructions.',
].join('\n')

async function advanceStructure(row: PassRow, m: ImportMapping, ideaId: string, userId: string): Promise<Result<ImportPassView>> {
  const existingHeadings = await prisma.actionHeading.findMany({ where: { ideaId }, select: { name: true, colourKey: true } })
  const byLower = new Map(existingHeadings.map((h) => [h.name.toLowerCase(), h]))
  const used = existingHeadings.map((h) => h.colourKey)
  const headings: ImportHeading[] = []
  const grouped = new Map<string, ImportItem[]>()
  for (const it of m.items) {
    if (it.proposal !== 'NEW' || !it.headingName) continue
    const key = it.headingName.toLowerCase()
    grouped.set(key, [...(grouped.get(key) ?? []), it])
  }
  for (const [key, its] of grouped) {
    const name = its[0].headingName!
    const ex = byLower.get(key)
    if (ex) { headings.push({ name: ex.name, colourKey: ex.colourKey, purpose: '', isNew: false, struck: false }); continue }
    const colourKey = nextColourKey(used); used.push(colourKey)
    headings.push({ name, colourKey, purpose: '', isNew: true, struck: false })
  }

  const newOnes = headings.filter((h) => h.isNew)
  let pence = 0
  let proposedFor = new Map<number, string>()
  if (newOnes.length || m.existing.some((e) => !e.currentHeading)) {
    const user = [
      'NEW HEADINGS, with the provisions that would go under each:',
      newOnes.length ? newOnes.map((h) => `## ${h.name}\n${(grouped.get(h.name.toLowerCase()) ?? []).map((i) => `- ${i.title}: ${i.summary}`).join('\n')}`).join('\n\n') : '(none)',
      '',
      'EXISTING HEADINGS:',
      existingHeadings.length ? existingHeadings.map((h) => `- ${h.name}`).join('\n') : '(none)',
      '',
      'EXISTING ACTIONS (number — what it does — [its heading]):',
      m.existing.map((e) => `#${e.number} — ${e.label} — [${e.currentHeading ?? 'no heading'}]`).join('\n') || '(none)',
    ].join('\n')
    const res = await modelCaller.current<{ purposes?: Array<{ heading?: string; purpose?: string }>; existing?: Array<{ number?: number; heading?: string }> }>({
      model: IMPORT_MODEL, system: STRUCTURE_SYSTEM, user, schema: STRUCTURE_SCHEMA as never,
      maxOutputTokens: 8000, timeoutMs: 150_000, temperature: 0.1, label: 'action-import-structure', stream: 'lex', pass: 'action-import.structure', ideaId, userId,
    })
    pence = await priced(res.usage as never, ideaId, userId, 'action-import.structure', !res.ok)
    if (!res.ok) {
      const f = res as { reason: string; detail: string }
      // 26-S2 §10.5/§10.3: plain words (the detail is in the log), and the pass is KEPT — every part already read is still there; "Try again" re-asks.
      console.warn('[action-import] structure step failed', { passId: row.id, reason: f.reason, detail: clip(f.detail, 300) })
      const msg = 'Proposing the headings did not complete. Every part of the document has been read and is kept; nothing has been written to your actions. Try again, or discard this import.'
      await save(row, { addPence: pence })
      return fail(msg)
    }
    for (const p of res.value.purposes ?? []) {
      const h = newOnes.find((x) => x.name.toLowerCase() === (p.heading ?? '').toLowerCase())
      if (h && p.purpose) h.purpose = firstWords(p.purpose, PURPOSE_MAX_WORDS).replace(/…$/, '')
    }
    const allNames = new Map([...existingHeadings.map((h) => h.name), ...newOnes.map((h) => h.name)].map((n) => [n.toLowerCase(), n]))
    for (const e of res.value.existing ?? []) {
      const nm = allNames.get((e.heading ?? '').toLowerCase())
      if (typeof e.number === 'number' && nm) proposedFor.set(e.number, nm)
    }
  }
  const existing = m.existing.map((e) => {
    const p = e.number != null ? proposedFor.get(e.number) : undefined
    return { ...e, proposedHeading: p && p.toLowerCase() !== (e.currentHeading ?? '').toLowerCase() ? p : null }
  })
  const kernel = await readKernelBits(ideaId)
  const next: ImportMapping = {
    ...m, headings, existing, stage: 'POLICY_TEST', policyTestCursor: 0,
    guidingPolicy: kernel.chosen?.approach ?? null,
    policyTestNote: kernel.chosen ? null : 'There is no accepted Guiding Policy on this idea yet, so nothing could be tested against it. Each row says so.',
  }
  await save(row, { mapping: next, addPence: pence })
  return { ok: true, data: asView((await prisma.actionImportPass.findFirst({ where: { id: row.id } }))!) }
}

// ── the policy test (the same words and schema as testHeldActions) ──────────────────────────────────────────

const TEST_ONE_BY_ONE = [
  '',
  '⚠ HERE EVERY GROUP HAS EXACTLY ONE MEMBER. These items come from one document and are reviewed one by one; do not merge any of them,',
  'whatever they have in common. The `text` of each group is that item\'s own wording.',
].join('\n')

async function advancePolicyTest(row: PassRow, m: ImportMapping, ideaId: string, userId: string): Promise<Result<ImportPassView>> {
  const testable = m.items.map((it, idx) => ({ it, idx })).filter(({ it }) => ['NEW', 'ADDS_TO', 'PART_OF'].includes(it.proposal))
  const batch = testable.filter(({ idx }) => idx >= m.policyTestCursor).slice(0, TEST_BATCH)
  const items = m.items.map((x) => ({ ...x }))

  if (!batch.length) {
    await save(row, { mapping: { ...m, stage: 'DONE' }, status: 'READY' })
    return { ok: true, data: asView((await prisma.actionImportPass.findFirst({ where: { id: row.id } }))!) }
  }
  const kernel = await readKernelBits(ideaId)
  let pence = 0
  if (!kernel.chosen) {
    for (const { idx } of batch) items[idx].policyTest = { verdict: 'NOT_TESTED', reason: 'There is no accepted Guiding Policy yet, so this was not tested.' }
  } else {
    const user = [
      'THE FINAL GUIDING POLICY',
      `Policy: ${kernel.chosen.approach}`,
      kernel.chosen.rulesOut ? `What it rules out: ${kernel.chosen.rulesOut}` : '',
      kernel.chosen.chainLink ? `If only part is delivered: ${kernel.chosen.chainLink}` : '',
      '',
      'THE CANDIDATE ACTIONS',
      ...batch.map(({ it }, i) => `[${i}] (${provenanceLine(row.sourceNumber, it.section)}) ${it.title}: ${it.summary}`),
    ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n')
    const res = await modelCaller.current<{ groups?: Array<{ members?: unknown; text?: unknown; verdict?: unknown; reason?: unknown }> }>({
      model: TEST_MODEL, system: TEST_SYSTEM + TEST_ONE_BY_ONE, user, schema: TEST_SCHEMA as never,
      maxOutputTokens: 8192, timeoutMs: 120_000, temperature: 0.1, reasoningEffort: 'medium', label: 'action-import-test', stream: 'lex', pass: 'action-import.test', ideaId, userId,
    })
    pence = await priced(res.usage as never, ideaId, userId, 'action-import.test', !res.ok)
    if (!res.ok) {
      const f = res as { reason: string; detail: string }
      console.warn('[action-import] policy test failed', { passId: row.id, reason: f.reason, detail: clip(f.detail, 300) })
      const msg = 'Testing the rows against your Guiding Policy did not complete. The table is kept; nothing has been written to your actions. Try again, or discard this import.'
      await save(row, { addPence: pence })
      return fail(msg)
    }
    const groups = placeGroups(res.value.groups, batch.map(({ it }) => it.title))
    for (const g of groups) for (const mem of g.members) {
      items[batch[mem].idx].policyTest = { verdict: g.verdict as PolicyVerdict, reason: g.reason }
    }
  }
  const last = batch[batch.length - 1].idx
  await save(row, { mapping: { ...m, items, policyTestCursor: last + 1 }, addPence: pence })
  return { ok: true, data: asView((await prisma.actionImportPass.findFirst({ where: { id: row.id } }))!) }
}

// ── what can be imported ──────────────────────────────────────────────────────────────────────────────────

/** The numbered sources the button offers: READ, with stored text. A source that was only saved by address is NOT offered — and
 *  `startImport` refuses it with the reason if asked anyway. */
export async function listImportable(ideaId: string): Promise<{ sources: ImportableSource[]; notRead: Array<{ number: number; title: string; why: string }> }> {
  await syncRegistry(ideaId)
  const rows = await prisma.ideaSource.findMany({ where: { ideaId, archivedAt: null, number: { not: null }, kind: { in: ['DOCUMENT', 'URL'] } }, orderBy: { number: 'asc' } })
  const mats = await prisma.ideaUserMaterial.findMany({ where: { id: { in: rows.map((r) => r.materialId).filter((x): x is string => !!x) } }, select: { id: true, charCount: true, text: true } })
  const byId = new Map(mats.map((m) => [m.id, m]))
  const sources: ImportableSource[] = []
  const notRead: Array<{ number: number; title: string; why: string }> = []
  for (const r of rows) {
    const m = r.materialId ? byId.get(r.materialId) : undefined
    if (r.readStatus === 'READ' && m?.text?.trim()) {
      const words = wordCount(m.text)
      sources.push({ number: r.number!, title: clip(r.title, 120), words, ...(() => { const p = importPenceFor(words); return { estimatePence: p.pence, basis: p.basis } })() })
    } else notRead.push({ number: r.number!, title: clip(r.title, 120), why: r.readNote ?? 'only its address was saved' })
  }
  return { sources, notRead }
}

// ── reading the pass ──────────────────────────────────────────────────────────────────────────────────────

export async function getImport(ideaId: string, passId?: string): Promise<ImportPassView | null> {
  const row = passId
    ? await prisma.actionImportPass.findFirst({ where: { id: passId, ideaId } })
    : await prisma.actionImportPass.findFirst({ where: { ideaId, status: { in: ['MAPPING', 'READY', 'CONFIRMING', 'FAILED'] } }, orderBy: { createdAt: 'desc' } })
  return row ? asView(row) : null
}

// ── edit ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface EditInput {
  items?: Array<{ itemId: string; patch: Partial<Pick<ImportItem, 'title' | 'summary' | 'implementer' | 'proposal' | 'headingName' | 'actionNumber' | 'struck'>> }>
  existing?: Array<{ actionId: string; proposedHeading: string | null }>
  headings?: Array<{ name: string; purpose?: string; struck?: boolean }>
}

export async function editImport(ideaId: string, passId: string, input: EditInput): Promise<Result<ImportPassView>> {
  const row = await prisma.actionImportPass.findFirst({ where: { id: passId, ideaId } })
  if (!row) return fail('That import is not on this idea. Nothing was changed.')
  if (row.status !== 'READY') return fail(`The table can be changed only when it is ready for review; this import is ${row.status.toLowerCase()}. Nothing was changed.`)
  const m = mappingOf(row)
  const live = new Set((await liveActions(ideaId)).map((a) => a.number))
  const problems: string[] = []

  for (const e of input.items ?? []) {
    const it = m.items.find((x) => x.id === e.itemId)
    if (!it) { problems.push(`the row “${e.itemId}” is not in this table`); continue }
    const p = e.patch
    if (p.proposal && !PROPOSAL_KINDS.includes(p.proposal)) { problems.push(`“${p.proposal}” is not a disposition`); continue }
    if (p.title !== undefined) it.title = firstWords(p.title, 40).replace(/…$/, '')
    if (p.summary !== undefined) it.summary = clip(p.summary, 600)
    if (p.implementer !== undefined) it.implementer = p.implementer ? clip(p.implementer, 200) : null
    if (p.proposal) {
      it.proposal = p.proposal
      if (p.proposal !== 'NEW') it.headingName = null
      if (p.proposal !== 'ADDS_TO' && p.proposal !== 'PART_OF') it.actionNumber = null
    }
    if (p.headingName !== undefined) it.headingName = p.headingName ? clip(p.headingName, 80) : null
    if (p.actionNumber !== undefined) {
      if (p.actionNumber != null && !live.has(p.actionNumber)) { problems.push(`action #${p.actionNumber} (row ${it.id}) is not on the list`); continue }
      it.actionNumber = p.actionNumber
    }
    if (p.struck !== undefined) it.struck = p.struck
    it.edited = true
  }
  for (const e of input.existing ?? []) {
    const ex = m.existing.find((x) => x.actionId === e.actionId)
    if (!ex) { problems.push('one of the existing actions is not in this table'); continue }
    ex.proposedHeading = e.proposedHeading ? clip(e.proposedHeading, 80) : null
  }
  for (const h of input.headings ?? []) {
    const hh = m.headings.find((x) => x.name.toLowerCase() === h.name.toLowerCase())
    if (!hh) { problems.push(`the heading “${h.name}” is not in this table`); continue }
    if (h.purpose !== undefined) {
      if (wordCount(h.purpose) > PURPOSE_MAX_WORDS) { problems.push(`the purpose of “${hh.name}” is ${wordCount(h.purpose)} words (the limit is ${PURPOSE_MAX_WORDS})`); continue }
      hh.purpose = h.purpose.trim()
    }
    if (h.struck !== undefined) hh.struck = h.struck
  }
  if (problems.length) return fail(`Saving your changes was refused: ${problems.join('; ')}. Nothing was changed.`)

  // A heading named on a row but not yet in the table becomes a proposed new heading (so a typed name is not lost).
  const existingNames = new Set((await prisma.actionHeading.findMany({ where: { ideaId }, select: { name: true } })).map((h) => h.name.toLowerCase()))
  const used = (await prisma.actionHeading.findMany({ where: { ideaId }, select: { colourKey: true } })).map((h) => h.colourKey).concat(m.headings.map((h) => h.colourKey))
  const want = [...m.items.filter((i) => !i.struck && i.proposal === 'NEW' && i.headingName).map((i) => i.headingName!), ...m.existing.map((e) => e.proposedHeading).filter((x): x is string => !!x)]
  for (const n of want) {
    if (m.headings.some((h) => h.name.toLowerCase() === n.toLowerCase())) continue
    const isNew = !existingNames.has(n.toLowerCase())
    const colourKey = isNew ? nextColourKey(used) : (HEADING_PALETTE[0].key)
    if (isNew) used.push(colourKey)
    m.headings.push({ name: n, colourKey, purpose: '', isNew, struck: false })
  }
  const ok = await prisma.actionImportPass.updateMany({ where: { id: row.id, updatedAt: row.updatedAt }, data: { mapping: m as never, updatedAt: new Date() } })
  if (ok.count !== 1) return fail('The table changed while you were editing it (another tab?). Reload it and make the change again. Nothing was changed.')
  return { ok: true, data: asView((await prisma.actionImportPass.findFirst({ where: { id: row.id } }))!) }
}

export async function discardImport(ideaId: string, passId: string): Promise<Result<{ discarded: boolean }>> {
  const r = await prisma.actionImportPass.updateMany({ where: { id: passId, ideaId, status: { in: ['MAPPING', 'READY', 'FAILED'] } }, data: { status: 'DISCARDED' } })
  if (r.count !== 1) return fail('That import cannot be discarded now (it may already be confirmed). Nothing was changed.')
  return { ok: true, data: { discarded: true } }
}

// ── confirm ───────────────────────────────────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10)

export function clipWords(s: string, n: number): string {
  const w = s.trim().split(/\s+/).filter(Boolean)
  return w.length > n ? w.slice(0, n).join(' ') : w.join(' ')
}

/** The body a NEW row is written with: Lex's one-line summary, then the DOCUMENT'S words, labelled, with the source line. */
export function newActionBody(it: Pick<ImportItem, 'summary' | 'title' | 'quote' | 'quoteVerified' | 'section'>, sourceNumber: number): string {
  const label = it.quoteVerified ? 'From the document' : 'Lex’s wording of the document (not word for word)'
  return `${it.summary || it.title}\n\n${label}: “${it.quote}” (${provenanceLine(sourceNumber, it.section)})`
}

/** What is APPENDED to an existing action — beside its own text, never in place of it. */
export function appendedBlock(it: Pick<ImportItem, 'summary' | 'title' | 'quote' | 'quoteVerified' | 'section' | 'proposal'>, sourceNumber: number): string {
  const head = it.proposal === 'PART_OF' ? 'A component of this action' : 'More on this action'
  const label = it.quoteVerified ? 'The document says' : 'Lex’s wording of the document (not word for word)'
  return `\n\n— ${head}, imported ${today()} (${provenanceLine(sourceNumber, it.section)}) —\n${it.summary || it.title}\n${label}: “${it.quote}”`
}

export async function confirmImport(ideaId: string, userId: string, passId: string): Promise<Result<ImportResult>> {
  const row = await prisma.actionImportPass.findFirst({ where: { id: passId, ideaId } })
  if (!row) return fail('That import is not on this idea. Nothing was written.')
  if (row.status !== 'READY') return fail(`This import is ${row.status.toLowerCase()}, not ready to confirm. Nothing was written.`)
  const m = mappingOf(row)
  const counts = countItems(m.items)

  // ── refuse before writing anything ──
  const live = await liveActions(ideaId)
  const liveByNumber = new Map(live.map((a) => [a.number, a]))
  const refuse: string[] = []
  for (const it of m.items) {
    if (it.struck) continue
    if (it.proposal === 'NEW' && !it.title.trim()) refuse.push(`row ${it.id} (${it.section}) has no title`)
    if ((it.proposal === 'ADDS_TO' || it.proposal === 'PART_OF') && (it.actionNumber == null || !liveByNumber.has(it.actionNumber))) refuse.push(`row ${it.id} (${it.section}) names action #${it.actionNumber ?? '?'}, which is not on the list now`)
  }
  const src = await readImportSource(ideaId, row.sourceNumber)
  if (!src.ok) refuse.push((src as { error: string }).error)
  if (refuse.length) return fail(`Confirming was refused: ${refuse.join('; ')}. Nothing was written.`)

  // ── the lock: two clicks, or two tabs, cannot write the rows twice ──
  const lock = await prisma.actionImportPass.updateMany({ where: { id: row.id, status: 'READY', updatedAt: row.updatedAt }, data: { status: 'CONFIRMING', updatedAt: new Date() } })
  if (lock.count !== 1) return fail('This import changed while you were confirming it (another tab?). Reload it and review it again. Nothing was written.')

  const created: ImportResult['created'] = []
  const addedTo: number[] = []
  const headingsCreated: string[] = []
  let reheaded = 0
  let findings = 0
  try {
    // 1 · headings (a new one carries its purpose paragraph)
    const headingId = new Map<string, string>()
    for (const h of await prisma.actionHeading.findMany({ where: { ideaId }, select: { id: true, name: true } })) headingId.set(h.name.toLowerCase(), h.id)
    for (const h of m.headings) {
      if (h.struck) continue
      if (h.isNew && !headingId.has(h.name.toLowerCase())) {
        const made = await S.createHeading(ideaId, h.name, h.colourKey)
        if (!made.ok) throw new Error((made as { error: string }).error)
        headingId.set(h.name.toLowerCase(), made.data.id); headingsCreated.push(h.name)
      }
      const id = headingId.get(h.name.toLowerCase())
      if (id && h.purpose.trim()) {
        const cur = await prisma.actionHeading.findUnique({ where: { id }, select: { purpose: true } })
        if (!cur?.purpose?.trim()) await prisma.actionHeading.update({ where: { id }, data: { purpose: clipWords(h.purpose, PURPOSE_MAX_WORDS) } })
      }
    }

    // 2 · new actions, in the document's order, landing last — NOT confirmed ("These are my actions" is untouched)
    for (const it of m.items) {
      if (it.struck || it.proposal !== 'NEW') continue
      const a = await addAction(ideaId, { practicalStep: newActionBody(it, row.sourceNumber), whoImplements: it.implementer ?? undefined, source: 'LEX' })
      const hid = it.headingName && !m.headings.find((h) => h.name.toLowerCase() === it.headingName!.toLowerCase())?.struck ? headingId.get(it.headingName.toLowerCase()) ?? null : null
      const t = it.policyTest
      await prisma.lexCoherentAction.update({
        where: { id: a.id },
        data: {
          title: it.title.trim(), headingId: hid,
          policyTestVerdict: t?.verdict ?? 'NOT_TESTED', policyTestReason: t?.reason ?? 'This row was not tested against the Guiding Policy.',
          policyTestFrom: [provenanceLine(row.sourceNumber, it.section)] as never,
        },
      })
      const fresh = await prisma.lexCoherentAction.findUnique({ where: { id: a.id }, select: { number: true } })
      created.push({ id: a.id, number: fresh?.number ?? null, title: it.title.trim() })
    }

    // 3 · Adds to / Part of: APPENDED beside what is there. The user's own words are never overwritten (decision 59).
    for (const it of m.items) {
      if (it.struck || (it.proposal !== 'ADDS_TO' && it.proposal !== 'PART_OF')) continue
      const cur = await prisma.lexCoherentAction.findFirst({ where: { ideaId, number: it.actionNumber!, status: 'LIVE' }, select: { id: true, practicalStep: true } })
      if (!cur) throw new Error(`action #${it.actionNumber} disappeared during the import`)
      await prisma.lexCoherentAction.update({ where: { id: cur.id }, data: { practicalStep: cur.practicalStep + appendedBlock(it, row.sourceNumber) } })
      addedTo.push(it.actionNumber!)
    }

    // 4 · existing actions → the headings the user approved
    for (const e of m.existing) {
      if (!e.proposedHeading) continue
      const hid = headingId.get(e.proposedHeading.toLowerCase())
      if (!hid) continue
      const r = await S.assignHeading(ideaId, [e.actionId], hid)
      if (r.ok) reheaded += r.data.assigned
    }

    // 5 · "for the policy": PROPOSED findings in the policy review. Nothing on the policy changes until accepted.
    const out: ImportedFinding[] = []
    for (const it of m.items) {
      if (it.struck || it.proposal !== 'POLICY') continue
      const category = it.policyCategory ?? 'NEW_POLICY_OPTION'
      out.push({
        category, targetRef: it.policyTarget,
        title: it.title.trim() || clip(it.summary, 90),
        explanation: `${it.reason || it.summary}\n\nFrom the document: “${it.quote}” (${provenanceLine(row.sourceNumber, it.section)})`.trim(),
        proposedText: category === 'NEW_CAUSE' || category === 'NEW_POLICY_OPTION' ? (it.summary || it.title) : null,
        sourceId: src.ok ? src.data.materialId : null, citation: `[Ref: ${row.sourceNumber}] ${it.section}`,
      })
    }
    findings = (await writeProposedFindings(ideaId, out)).written
  } catch (err) {
    const msg = `The import stopped part-way: ${err instanceof Error ? err.message.slice(0, 240) : 'unknown error'}. Already written: ${created.length} new action${created.length === 1 ? '' : 's'}${created.length ? ` (${created.map((c) => `#${c.number ?? '?'}`).join(', ')})` : ''}, added to ${addedTo.length}. They are in your list as candidates and can be ruled out. Nothing else was changed.`
    console.error('[action-import] confirm threw', { passId, err })
    await prisma.actionImportPass.update({ where: { id: row.id }, data: { status: 'FAILED', failure: msg, result: { created, addedTo, partial: true } as never } })
    return fail(msg)
  }

  const result: ImportResult = { created, addedTo, findings, headingsCreated, reheaded, counts, at: new Date().toISOString() }
  await prisma.actionImportPass.update({ where: { id: row.id }, data: { status: 'CONFIRMED', confirmedAt: new Date(), result: result as never, updatedAt: new Date() } })
  // Privacy Log & Lex activity — the owner can read what was written, when, and on whose confirm.
  await recordToolCall({
    ideaId, userId, tool: 'import_actions_from_source', tier: 'run', instruction: `Confirmed the import of [Ref: ${row.sourceNumber}] in the review panel`,
    input: { passId: row.id, sourceNumber: row.sourceNumber }, ok: true, confirmedVia: 'button',
    summary: `Imported ${created.length} new action(s), added to ${addedTo.length}, sent ${findings} to the policy review, created ${headingsCreated.length} heading(s), re-headed ${reheaded}.`,
  })
  return { ok: true, data: result }
}
