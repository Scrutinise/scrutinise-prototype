// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-V2d (BRIEF_26V §7, decision 239) — THE FIVE REVIEW PASSES, RE-POINTED AT DOCUMENTS. PURE; CLIENT-SAFE.
//
// "The five existing passes (evidence/precedent, legal, financial, political risk, statutory consequences) run over documents, not over the
// kernel: an issue they raise is attached to the document and part it concerns (38.2.1), shown in the tree as a count on the node, answered
// in the Risks view (225) or by a redraft." No new pass: each review is one of the five PASSES in deepening-config.ts — its own label, its own
// method block and its own standing questions — read against ONE document's current version, part by part.
//
// ⚠ What a document review is NOT: a second gather. It runs no search. It reads the document, the action it belongs to and the guiding
//   policy, and raises the issues a reader with this pass's lens would raise ABOUT THE TEXT. So the instructions forbid it any fact about the
//   law, a figure or a source it was not given; where something needs checking, the issue says what to check (the never-claim rule, §18 family).
// ⚠ An issue it raises carries the action, the document and the part, and the review it came from (`reviewId` → document_review, which records
//   the version read). Its passKey is "review:<PASS>" so the kernel pass cards, which list issues by exact pass key, never mix the two; and its
//   runVersion is 0, so no reader that selects a BUILD's issues by `runVersion = buildVersion` can ever pick one up by coincidence.
// ⚠ §27: the instructions describe the shape of an issue; they carry no specimen issue, clause or sentence.
// ⚠ A review that raises nothing still leaves its row (status RUN, 0 issues, and what held up, in one sentence) — a review that was never run
//   and a review that found nothing must not look the same (§23.2).
// ─────────────────────────────────────────────────────────────────────────────

import { PASSES, type PassDef, type PassKey } from './deepening-config'
import { GENERATED_KINDS, KIND_WORD, STATUS_WORD, dNumber, partNumber, type DocumentKind, type DocumentPart, type DocumentStatus } from './action-documents-pure'

export const REVIEW_PREFIX = 'review:'
export const reviewPassKey = (k: PassKey) => `${REVIEW_PREFIX}${k}`
/** The pass a review issue came from, from its passKey; null for any other issue. */
export const passOfReviewKey = (passKey: string): PassDef | null =>
  passKey.startsWith(REVIEW_PREFIX) ? PASSES.find((p) => p.key === passKey.slice(REVIEW_PREFIX.length)) ?? null : null
export const REVIEW_PASS_KEYS = PASSES.map((p) => p.key)

/** The most issues one pass may raise on one document. More are cut, and the cut is counted. */
export const MAX_REVIEW_ISSUES = 8
/** Bounds on what one review reads (CLAUDE.md §30.1): the commentary, the policy, each part, the whole document. Every cut is said in the text. */
export const REVIEW_LIMITS = { policy: 2_000, statement: 1_500, commentary: 3_500, part: 6_000, document: 40_000 } as const

/** The review's instructions for one pass: the shared rules, then the pass's own method and questions, then the other lenses by name. */
export function reviewSystem(def: PassDef): string {
  const others = PASSES.filter((p) => p.key !== def.key)
  return [
    `You are Lex, reviewing ONE DOCUMENT of one coherent action in a UK policy proposal, through ONE lens: the ${def.label.toLowerCase()} review.`,
    '',
    'THE LENS, as it is used on the proposal as a whole:',
    def.method,
    '',
    'Its standing questions:',
    ...def.mustAnswer.map((q) => `- ${q}`),
    '',
    'HERE YOU ARE READING THE DOCUMENT ITSELF, part by part, not gathering material. Through this lens, raise an ISSUE wherever the',
    'document’s own words are wrong, unclear, unsupported, inconsistent with the action or the policy, or silent on something a hostile',
    'reader with this lens would ask for. For each issue give:',
    '- title: a few words naming the point;',
    '- text: two to four sentences — what in the document causes the issue, and what the document needs to answer it;',
    '- part: the number of the part it concerns, exactly as listed (the n of <part n="…">), or null where it concerns the document as a whole.',
    'In the text, name any part by its full number (the number attribute of <part>), never by its bare n.',
    '',
    'A GENERATED document (said below where it is one) is built by the platform from data. Its form, its sources, its method and what it',
    'leaves out by design are the platform’s, not the proposal’s: never raise an issue about how it was generated or what it is built from.',
    'Review only what its rows say about the proposal.',
    '',
    'READ ONLY WHAT IS IN FRONT OF YOU. You have no search here. Never state a fact about the law, a figure, a date, a body or a source that the',
    'document, the action or the policy does not give you. Where something needs checking, the issue says what to check and why.',
    `Raise only the issues that matter through this lens: at most ${MAX_REVIEW_ISSUES}; fewer is normal; none is right when the document holds up,`,
    'or when it holds nothing yet to review. Leave to the other lenses what is theirs (below), unless it is plainly yours as well. Do not raise',
    'the caveat or status line the document already carries.',
    'Then, in heldUp, say in one sentence what the document gets right through this lens — or, where you raise nothing, why there is nothing to raise.',
    '',
    'THE OTHER LENSES (not yours):',
    ...others.map((p) => `- ${p.label}: ${p.strapline}`),
    '',
    'Never carry over an example, a subject or a phrase from these instructions or from any other proposal.',
  ].join('\n')
}

export const REVIEW_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['issues', 'heldUp'],
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['title', 'text', 'part'],
        properties: { title: { type: 'string' }, text: { type: 'string' }, part: { type: ['integer', 'null'] } },
      },
    },
    heldUp: { type: 'string' },
  },
} as const

export interface ReviewAnswer { issues: Array<{ title: string; text: string; part: number | null }>; heldUp: string }

/** Everything one review reads, already assembled (the server half fills it; a check can build it by hand). */
export interface ReviewTarget {
  documentId: string; actionId: string; ideaId: string
  actionNumber: number | null; docNumber: number; kind: DocumentKind; title: string; status: DocumentStatus
  /** The version read: its number, author and text. */
  v: number; author: string; body: string
  parts: DocumentPart[]
  action: { title: string | null; statement: string; commentary: string | null; heading: string | null; headingKind: string | null }
  policy: string | null
}

const cut = (s: string, max: number, what: string) => (s.length <= max ? s : `${s.slice(0, max)}\n[… ${what}: ${(s.length - max).toLocaleString('en-GB')} more characters not shown]`)

/** The text above a document's first part (a clause's caveat and heading lines). */
export function headOf(body: string, parts: DocumentPart[]): string {
  const first = parts[0]
  if (!first) return ''
  const i = body.replace(/\r\n/g, '\n').indexOf(first.text.slice(0, 40))
  return i > 0 ? body.replace(/\r\n/g, '\n').slice(0, i).trim() : ''
}

export function reviewUser(t: ReviewTarget): string {
  const d = dNumber(t.actionNumber, t.docNumber)
  let budget: number = REVIEW_LIMITS.document
  const partLines = t.parts.map((p) => {
    const text = cut(p.text, Math.max(500, Math.min(REVIEW_LIMITS.part, budget)), `part ${p.n} cut`)
    budget = Math.max(0, budget - text.length)
    return `<part n="${p.n}" number="${partNumber(t.actionNumber, t.docNumber, p.n)}" title="${p.title.replace(/"/g, "'")}">\n${text}\n</part>`
  })
  const head = headOf(t.body, t.parts)
  return [
    'THE GUIDING POLICY OF THE PROPOSAL:',
    t.policy?.trim() ? cut(t.policy.trim(), REVIEW_LIMITS.policy, 'the policy is cut') : 'not yet written',
    '',
    `THE ACTION #${t.actionNumber ?? '?'}${t.action.heading ? ` (under “${t.action.heading}”${t.action.headingKind ? `, a ${t.action.headingKind.toLowerCase().replace(/_/g, ' ')} heading` : ''})` : ''}:`,
    `Title: ${t.action.title?.trim() || 'none'}`,
    `Statement: ${cut(t.action.statement.trim(), REVIEW_LIMITS.statement, 'the statement is cut')}`,
    `Commentary: ${t.action.commentary?.trim() ? cut(t.action.commentary.trim(), REVIEW_LIMITS.commentary, 'the commentary is cut') : 'none'}`,
    '',
    `THE DOCUMENT ${d}: ${KIND_WORD[t.kind]}, “${t.title}”, ${STATUS_WORD[t.status]}; version ${t.v} (${t.author === 'LEX' ? 'drafted by Lex' : t.author === 'GENERATED' ? 'generated from data' : 'written by the owner or a collaborator'}).`,
    GENERATED_KINDS.has(t.kind) ? 'This is a GENERATED document: built by the platform from data, not drafted.' : '',
    head ? `Above the first part:\n${cut(head, REVIEW_LIMITS.part, 'the opening is cut')}` : '',
    `Its ${t.parts.length} part${t.parts.length === 1 ? '' : 's'}:`,
    ...partLines,
  ].filter((x) => x !== '').join('\n')
}

/** Every way an answer was corrected, counted (count what was not done, in words). */
export interface ReviewFalls { partOutOfRange: number; empty: number; overCap: number }
export interface CheckedIssue { title: string; text: string; partN: number | null }

/** Checks a review's answer against the document: a part that does not exist → the document as a whole; an empty issue dropped; over the cap cut. */
export function checkReview(ans: ReviewAnswer, parts: DocumentPart[]): { issues: CheckedIssue[]; heldUp: string; falls: ReviewFalls } {
  const falls: ReviewFalls = { partOutOfRange: 0, empty: 0, overCap: 0 }
  const out: CheckedIssue[] = []
  for (const i of ans.issues ?? []) {
    const text = String(i.text ?? '').replace(/\s+/g, ' ').trim()
    if (!text) { falls.empty++; continue }
    if (out.length >= MAX_REVIEW_ISSUES) { falls.overCap++; continue }
    let partN = typeof i.part === 'number' ? i.part : null
    if (partN != null && !parts.some((p) => p.n === partN)) { falls.partOutOfRange++; partN = null }
    out.push({ title: String(i.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 120) || text.slice(0, 60), text: text.slice(0, 2_000), partN })
  }
  return { issues: out, heldUp: String(ans.heldUp ?? '').replace(/\s+/g, ' ').trim().slice(0, 600), falls }
}

export function reviewFallsWords(f: ReviewFalls): string[] {
  return [
    f.partOutOfRange && `${f.partOutOfRange} named a part the document does not have (kept on the document as a whole)`,
    f.empty && `${f.empty} came back empty (dropped)`,
    f.overCap && `${f.overCap} over the limit of ${MAX_REVIEW_ISSUES} (not kept)`,
  ].filter((x): x is string => !!x)
}

/** The line an issue raised by a review carries: which pass, which document, which version. */
export const raisedByWords = (label: string, d: string, v: number) => `Raised by Lex’s ${label.toLowerCase()} review of ${d}, version ${v}`

/**
 * MEASURED price of one pass reviewing one document, per real run on 452c5ade's documents with the spend charged to a scratch copy (§23.2).
 * `chars` = the length of the version read, so the price is said for a document of that size and not passed off as a constant.
 * Empty = not measured.
 */
export const REVIEW_RUNS: Partial<Record<PassKey, Array<{ chars: number; pence: number }>>> = {
  // 24–25 Oct, scripts/measure-26v2d.ts: D.38.1 v1 (5,542 characters, 18 parts) twice; D.203.1 v2 (272 characters, the empty schedule) once,
  // before empty generated documents were made unreviewable. Sonnet 5.5, effort medium. 7–13 s a pass.
  EVIDENCE_PRECEDENT: [{ chars: 5542, pence: 1.71 }, { chars: 5542, pence: 1.77 }, { chars: 272, pence: 0.79 }],
  LEGAL: [{ chars: 5542, pence: 1.97 }, { chars: 5542, pence: 2.01 }, { chars: 272, pence: 0.85 }],
  FINANCIAL: [{ chars: 5542, pence: 1.73 }, { chars: 5542, pence: 1.83 }, { chars: 272, pence: 0.79 }],
  POLITICAL_RISK: [{ chars: 5542, pence: 1.76 }, { chars: 5542, pence: 1.84 }, { chars: 272, pence: 0.77 }],
  STATUTORY_CONSEQUENCES: [{ chars: 5542, pence: 1.67 }, { chars: 5542, pence: 1.72 }, { chars: 272, pence: 0.78 }],
}

/** The price of reviewing a document of `chars` characters with `passes`: scaled from the measured runs per pass (a floor of 1 run). */
export function reviewPrice(passes: readonly PassKey[], chars: number): { pence: number | null; n: number; unmeasured: PassKey[] } {
  let pence = 0, n = Infinity
  const unmeasured: PassKey[] = []
  for (const k of passes) {
    const runs = REVIEW_RUNS[k] ?? []
    if (!runs.length) { unmeasured.push(k); continue }
    // pence per 1,000 characters, plus the fixed part of a call (the instructions): fitted as a mean of each run's price at its own size
    const perChar = runs.reduce((a, r) => a + r.pence / Math.max(1, r.chars + FIXED_CHARS), 0) / runs.length
    pence += perChar * (chars + FIXED_CHARS)
    n = Math.min(n, runs.length)
  }
  if (unmeasured.length) return { pence: null, n: 0, unmeasured }
  return { pence: Math.round(pence * 10) / 10, n: n === Infinity ? 0 : n, unmeasured }
}
/** What every review call costs whatever the document (instructions, policy, action), as characters of document: fitted to the two sizes
 *  measured (0.8p at 272 characters, 1.8p at 5,542 → about 1.8p per 10,000 characters on top of about 4,000 characters' worth). */
export const FIXED_CHARS = 4_000

/** Who raised an issue, in words, from its passKey — for the Risks view, which lists issues from every producer. Never a bare key. */
export function producerWords(passKey: string): string {
  const review = passOfReviewKey(passKey)
  if (review) return `Lex’s ${review.label.toLowerCase()} review`
  const pass = PASSES.find((p) => p.key === passKey)
  if (pass) return `the ${pass.label.toLowerCase()} pass`
  const fixed: Record<string, string> = {
    ADVERSARIAL: 'the hostile reading of the build', SMART: 'the specificity check', KERNEL_CHECK: 'the kernel check',
    LOGIC_CHECK: 'the logic check', REVISE: 'the revision pass', MATERIAL_UPDATE: 'the new-material pass',
  }
  if (fixed[passKey]) return fixed[passKey]
  if (passKey.startsWith('question:')) return `the research question on ${passKey.slice(9).toLowerCase().replace(/_/g, ' ')}`
  return 'an earlier pass'
}

/** A window event the Deepening page's panels send when issues change (a review ran, an issue was answered), so the tree's counts and the
 *  Risks view never disagree on one screen. */
export const ISSUES_CHANGED_EVENT = 'lex-issues-changed'

/** "Reviewed by 3 of 5 passes at this version", for the tree and the document header. */
export function reviewedWords(reviewed: number, total = PASSES.length): string {
  return reviewed === 0 ? 'not yet reviewed' : `reviewed by ${reviewed} of ${total} passes at this version`
}
