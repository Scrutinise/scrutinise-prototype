// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-B §3 — THE THREE AVENUES A KERNEL EVALUATES (17 Sep 2026).
//
// Charlie's decision, superseding decision 78: *"Decisions about whether the coherent action
// should be legislative or operational should come out of the strategy kernel, not be a
// pre-condition."* So the instrument is no longer asked of the user, no longer named by the
// approach pass, and no longer handed to the actions pass as "THE INSTRUMENT YOU ASSUMED".
// Instead the actions pass evaluates three avenues — LEGISLATIVE, ORGANISATIONAL, FINANCIAL —
// every time, and the choice between them is put to the proposer (§4), never made by Lex.
//
// ⚠⚠ THE WHOLE DESIGN FAILS UNLESS EACH IS WORKED TO THE SAME DEPTH. Measured before this
// sprint: the smart pass softened or deferred the legislative step in 7 of 31 action rewrites,
// because Rumelt rewards feasible concentrated action and administration is always more
// feasible than legislation. Three avenues evaluated unequally is the same defect with better
// manners. So the prompt demands comparable length AND the row stores the length of each
// treatment (`chars`), so "worked to the same depth" is a column compared across builds
// (§3a's median) rather than an impression. `depthReport()` is what the report prints.
//
// ⚠ AN AVENUE THAT DOES NOT APPLY SAYS SO AND WHY (§3b). `applies: false` with
// `whyNotApplicable` is a real state and a different one from a thin treatment; the gap
// announces itself rather than being omitted.
//
// ⚠ THE EXISTING-POWER QUESTION STAYS AND MOVES (§3c). It now belongs to the legislative
// avenue's evaluation as a FINDING (`existingPower`, `existingPowerReach`), beside the route,
// never over it. The line that told the revise pass to reconsider before anything else is gone.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

export const AVENUES = ['LEGISLATIVE', 'ORGANISATIONAL', 'FINANCIAL'] as const
export type Avenue = (typeof AVENUES)[number]

export const AVENUE_LABEL: Record<Avenue, string> = {
  LEGISLATIVE: 'Legislative — a Bill, an amendment, or regulations under an existing power',
  ORGANISATIONAL: 'Organisational — how a body works: its remit, guidance, direction, structure or practice',
  FINANCIAL: 'Financial — funding, grant conditions, charges, incentives, budget allocation',
}

// ══ 26-B §10 (addendum) — WHAT AN AVENUE SAYS WHEN IT CANNOT BE DRAFTED ══════════════════
//
// An avenue is never left blank for want of development. Each says which of four states it is
// in, in the document, in plain words:
//   1. DRAFTED      — enough evidence to draft it → drafted, and `restsOn` says what it rests on.
//   2. FROM_DEBATE  — a debate exists but has not resolved the problem → the options are drawn
//                     from it and it SAYS so (§11: what was tried and what happened; what was
//                     recommended and never implemented; what is still unsolved; that an approach
//                     not on the list may be what is needed).
//   3. NOT_NEEDED   — enough evidence to say this route is not needed → Charlie's sentence.
//   4. INSUFFICIENT — not enough evidence to say anything → Charlie's sentence, then what would
//                     settle it.
// ⚠⚠ 3 AND 4 ARE OPPOSITE STATEMENTS — a finding and an absence — and are never rendered as
// each other. `NOT_NEEDED_SENTENCE` and `INSUFFICIENT_SENTENCE` are distinct constants and
// `check:lex-26b` asserts the distinction with a control that stays false.
export const AVENUE_STATES = ['DRAFTED', 'FROM_DEBATE', 'NOT_NEEDED', 'INSUFFICIENT'] as const
export type AvenueState = (typeof AVENUE_STATES)[number]

/** State 3 — Charlie's copy, verbatim. */
export const NOT_NEEDED_SENTENCE =
  'From what I know of the problem, this looks to be an operational or financial matter with no '
  + 'legislative change required. If that doesn’t seem right to you, point me in the direction you '
  + 'want me to take.'

/** State 4 — Charlie's copy, verbatim. Followed, always, by what would settle it. */
export const INSUFFICIENT_SENTENCE =
  'I don’t have enough information to understand the problem or its causes well enough to propose '
  + 'a solid solution here.'

/** State 3, for the two non-legislative avenues, in the same voice. */
export function notNeededSentence(avenue: Avenue): string {
  if (avenue === 'LEGISLATIVE') return NOT_NEEDED_SENTENCE
  const other = avenue === 'ORGANISATIONAL' ? 'a legislative or financial matter' : 'a legislative or organisational matter'
  return `From what I know of the problem, this looks to be ${other} with no ${avenue === 'ORGANISATIONAL' ? 'organisational' : 'financial'} change required. If that doesn’t seem right to you, point me in the direction you want me to take.`
}

/** §11 — the backward-looking weakness, as the actions pass reports it where a debate exists. */
export interface DebateRecord {
  /** What was tried, and what happened to it. */
  tried: Array<{ what: string; whatHappened: string }>
  /** What was recommended and never implemented — a different thing entirely. */
  recommendedNeverImplemented: Array<{ what: string; byWhom: string }>
  /** What the record shows still unsolved. */
  stillUnsolved: string
  /** That an approach not on this list may be what is needed — in the model's words for THIS problem. */
  offListNote: string
}

/** One avenue as the actions pass returns it. */
export interface RawAvenue {
  avenue: string
  /** 26-B §10 — which of the four states. `applies` is derived from it for older readers. */
  state: string
  /** State 1 — what the draft rests on. */
  restsOn?: string
  /** State 2 — §11's four findings. */
  debate?: DebateRecord
  applies: boolean
  whyNotApplicable?: string
  actions: Array<{ practicalStep: string; whoImplements: string }>
  difficulty: string
  tradeoffs: string
  rulesIn: string
  rulesOut: string
  whatWouldSettleIt: string
}

export const AVENUE_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      avenue: { type: 'string', enum: [...AVENUES] },
      state: { type: 'string', enum: [...AVENUE_STATES] },
      restsOn: { type: 'string' },
      debate: {
        type: 'object',
        properties: {
          tried: { type: 'array', items: { type: 'object', properties: { what: { type: 'string' }, whatHappened: { type: 'string' } }, required: ['what', 'whatHappened'] } },
          recommendedNeverImplemented: { type: 'array', items: { type: 'object', properties: { what: { type: 'string' }, byWhom: { type: 'string' } }, required: ['what', 'byWhom'] } },
          stillUnsolved: { type: 'string' },
          offListNote: { type: 'string' },
        },
        required: ['tried', 'recommendedNeverImplemented', 'stillUnsolved', 'offListNote'],
      },
      applies: { type: 'boolean' },
      whyNotApplicable: { type: 'string' },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: { practicalStep: { type: 'string' }, whoImplements: { type: 'string' } },
          required: ['practicalStep', 'whoImplements'],
        },
      },
      difficulty: { type: 'string' },
      tradeoffs: { type: 'string' },
      rulesIn: { type: 'string' },
      rulesOut: { type: 'string' },
      whatWouldSettleIt: { type: 'string' },
    },
    required: ['avenue', 'state', 'applies', 'actions', 'difficulty', 'tradeoffs', 'rulesIn', 'rulesOut', 'whatWouldSettleIt'],
  },
}

/**
 * The instruction the actions pass carries. ⚠ SHAPE, NOT SPECIMENS (docs/CLAUDE.md §27): it says
 * what each treatment must contain and how long, and gives no example sentence that could come
 * back as content.
 */
export const AVENUES_INSTRUCTION = [
  '  `avenues` — ⚠⚠ THREE ROUTES, EVALUATED EVERY TIME, TO THE SAME DEPTH. One entry each for',
  '              LEGISLATIVE (a Bill, an amendment to an Act, or regulations under an existing',
  '              power), ORGANISATIONAL (how a body works — remit, guidance, direction, structure,',
  '              practice) and FINANCIAL (funding, grant conditions, charges, incentives, budgets).',
  '              The instrument is an OUTPUT of this strategy, not an input to it: you are not',
  '              choosing between these — the proposer is — you are giving each a fair hearing.',
  '              For EACH avenue:',
  '                `actions`           — 2–4 concrete steps this route would take, each naming who',
  '                                      implements it. Real steps, not "consider" or "review".',
  '                `difficulty`        — how hard it is to get done, as a paragraph: the stage it',
  '                                      is most likely to fail at, who can block it, how long.',
  '                `tradeoffs`         — what this route buys that the others do not, and what it',
  '                                      costs that the others do not: durability, speed, reach,',
  '                                      reversibility, who bears the friction.',
  '                `rulesIn` / `rulesOut` — what choosing THIS route commits the proposer to, and',
  '                                      what it gives up.',
  '                `whatWouldSettleIt` — the EVIDENCE that would decide whether this route is worth',
  '                                      its difficulty: what would have to be true. Not "the',
  '                                      proposer\'s preference" — a thing someone could go and check.',
  '              ⚠⚠ COMPARABLE LENGTH AND SPECIFICITY. If one avenue gets three lines and another',
  '              twelve, you have made the choice for the proposer by neglect. A route you judge',
  '              hard gets the SAME number of steps and the SAME paragraph of difficulty as one you',
  '              judge easy — "hard" is a finding to state, not a reason to write less.',
  '              ⚠⚠ `state` — SAY WHICH OF FOUR THIS AVENUE IS, and never leave one blank for want',
  '              of development:',
  '                DRAFTED      — you have enough evidence to draft it. Draft it, and put what it',
  '                               RESTS ON in `restsOn` (the findings, the testimony, the law named).',
  '                FROM_DEBATE  — a debate on this exists in the record but has not resolved the',
  '                               problem. Draft the options FROM it, and fill `debate`: what was',
  '                               TRIED and what happened to it; what was RECOMMENDED AND NEVER',
  '                               IMPLEMENTED (a different thing entirely — keep the two apart); what',
  '                               the record shows STILL UNSOLVED; and, in your own words for this',
  '                               problem, that an approach not on the list may be what is needed.',
  '                               Only where a prior debate is actually in front of you.',
  '                NOT_NEEDED   — you have enough evidence to say this route is not needed for this',
  '                               problem. `applies: false`, `whyNotApplicable` in a sentence. This',
  '                               is a FINDING.',
  '                INSUFFICIENT — you do not have enough evidence to say anything about this route.',
  '                               `applies: true`, the fields as far as they honestly go, and',
  '                               `whatWouldSettleIt` doing the real work. This is an ABSENCE.',
  '              ⚠⚠ NOT_NEEDED and INSUFFICIENT are opposite statements. "No legislation is needed"',
  '              and "I could not find any" must never be confused: choose NOT_NEEDED only when the',
  '              evidence in front of you SAYS the route is unnecessary, and INSUFFICIENT whenever',
  '              you simply do not know. Never omit an avenue and never leave one thin without',
  '              saying which state it is in.',
  '              ⚠ Where the diagnosis or the approach already points at one route, say so in that',
  '              avenue\'s `tradeoffs` — and STILL work the other two fully.',
].join('\n')

function treatmentChars(a: RawAvenue): number {
  return (
    a.actions.map((s) => `${s.practicalStep} ${s.whoImplements}`).join(' ').length
    + (a.difficulty ?? '').length + (a.tradeoffs ?? '').length
  )
}

export function normaliseAvenues(raw: RawAvenue[] | undefined): RawAvenue[] {
  const byKey = new Map<string, RawAvenue>()
  for (const a of raw ?? []) {
    const key = String(a?.avenue ?? '').toUpperCase().trim()
    if (!(AVENUES as readonly string[]).includes(key)) continue
    const state = String(a?.state ?? '').toUpperCase().trim()
    const known = (AVENUE_STATES as readonly string[]).includes(state)
    // A missing or unknown state is derived from `applies`, and it is DRAFTED/NOT_NEEDED — never
    // INSUFFICIENT by default, because an absence asserted by default would be the confusion §10
    // exists to forbid.
    byKey.set(key, {
      ...a, avenue: key,
      state: known ? state : (a?.applies === false ? 'NOT_NEEDED' : 'DRAFTED'),
      applies: known ? state !== 'NOT_NEEDED' : a?.applies !== false,
      actions: (a.actions ?? []).filter((s) => s?.practicalStep?.trim()),
    })
  }
  return [...byKey.values()]
}

/** Which avenues the model left out entirely — reported, never silently filled. */
export function missingAvenues(list: RawAvenue[]): Avenue[] {
  return AVENUES.filter((k) => !list.some((a) => a.avenue === k))
}

/** Persist the build's avenues. One row per avenue; a re-run of the pass replaces them. */
export async function writeAvenues(ideaId: string, buildId: string, list: RawAvenue[]): Promise<{ written: number; chars: Record<string, number> }> {
  const chars: Record<string, number> = {}
  for (const a of list) {
    const n = treatmentChars(a)
    chars[a.avenue] = n
    const draft = a.actions.map((s, i) => `${i + 1}. ${s.practicalStep.trim()}${s.whoImplements?.trim() ? ` — ${s.whoImplements.trim()}` : ''}`).join('\n')
    await prisma.buildAvenue.upsert({
      where: { buildId_avenue: { buildId, avenue: a.avenue } },
      create: {
        buildId, ideaId, avenue: a.avenue, applies: a.applies !== false,
        state: a.state, restsOn: a.restsOn?.trim() || null, debate: (a.debate ?? undefined) as never,
        whyNotApplicable: a.applies === false ? (a.whyNotApplicable?.trim() || 'not stated') : null,
        draft, difficulty: a.difficulty?.trim() ?? '', tradeoffs: a.tradeoffs?.trim() ?? '',
        rulesIn: a.rulesIn?.trim() ?? '', rulesOut: a.rulesOut?.trim() ?? '',
        whatWouldSettleIt: a.whatWouldSettleIt?.trim() ?? '', chars: n,
      },
      update: {
        applies: a.applies !== false,
        state: a.state, restsOn: a.restsOn?.trim() || null, debate: (a.debate ?? undefined) as never,
        whyNotApplicable: a.applies === false ? (a.whyNotApplicable?.trim() || 'not stated') : null,
        draft, difficulty: a.difficulty?.trim() ?? '', tradeoffs: a.tradeoffs?.trim() ?? '',
        rulesIn: a.rulesIn?.trim() ?? '', rulesOut: a.rulesOut?.trim() ?? '',
        whatWouldSettleIt: a.whatWouldSettleIt?.trim() ?? '', chars: n, updatedAt: new Date(),
      },
    })
  }
  return { written: list.length, chars }
}

/** The avenues as prose for later passes' prompts — the carry. */
export function avenuesCarry(list: RawAvenue[]): string {
  return list.map((a) => [
    `${a.avenue} [${a.state}]${a.applies === false ? ` (not needed: ${a.whyNotApplicable ?? 'reason not stated'})` : ''}:`,
    ...a.actions.map((s) => `  - ${s.practicalStep}${s.whoImplements ? ` (${s.whoImplements})` : ''}`),
    `  difficulty: ${a.difficulty}`,
    `  trade-offs: ${a.tradeoffs}`,
    `  rules in: ${a.rulesIn} · rules out: ${a.rulesOut}`,
    `  what would settle it: ${a.whatWouldSettleIt}`,
  ].join('\n')).join('\n\n')
}

/**
 * §3a — THE DEPTH MEASURE. Median treatment length per avenue across every build that has
 * them, and the ratio of the shortest median to the longest. "Systematic shortfall" is a
 * ratio, so it is one number the report can print and a threshold a check can hold.
 */
export async function depthReport(): Promise<{
  builds: number
  perAvenue: Record<string, { n: number; median: number; notApplicable: number }>
  shortestOverLongest: number
  perBuildRatio: { median: number; worst: number }
}> {
  const rows = await prisma.buildAvenue.findMany({ select: { buildId: true, avenue: true, chars: true, applies: true } })
  const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0 }
  const perAvenue: Record<string, { n: number; median: number; notApplicable: number }> = {}
  for (const k of AVENUES) {
    const mine = rows.filter((r) => r.avenue === k)
    perAvenue[k] = { n: mine.length, median: median(mine.filter((r) => r.applies).map((r) => r.chars)), notApplicable: mine.filter((r) => !r.applies).length }
  }
  const medians = AVENUES.map((k) => perAvenue[k].median).filter((m) => m > 0)
  const shortestOverLongest = medians.length ? Math.min(...medians) / Math.max(...medians) : 0
  const builds = new Set(rows.map((r) => r.buildId))
  const ratios: number[] = []
  for (const b of builds) {
    const mine = rows.filter((r) => r.buildId === b && r.applies).map((r) => r.chars)
    if (mine.length >= 2 && Math.max(...mine) > 0) ratios.push(Math.min(...mine) / Math.max(...mine))
  }
  return {
    builds: builds.size, perAvenue, shortestOverLongest,
    perBuildRatio: { median: median(ratios), worst: ratios.length ? Math.min(...ratios) : 0 },
  }
}

/**
 * 26-B §10 — THE STATE, IN PLAIN WORDS, FOR THE DOCUMENT. One renderer, so the two fixed
 * sentences are never paraphrased and states 3 and 4 cannot swap. Rows written before the
 * addendum have no `state`; they are read from `applies` and labelled inferred.
 */
export function avenueStateLine(row: {
  avenue: string; state: string | null; applies: boolean; whyNotApplicable: string | null; restsOn: string | null
}): { state: AvenueState; inferred: boolean; line: string } {
  const av = row.avenue as Avenue
  const inferred = !row.state
  const state: AvenueState = (row.state && (AVENUE_STATES as readonly string[]).includes(row.state))
    ? (row.state as AvenueState)
    : (row.applies ? 'DRAFTED' : 'NOT_NEEDED')
  switch (state) {
    case 'DRAFTED':
      return { state, inferred, line: `Drafted from the evidence.${row.restsOn?.trim() ? ` It rests on: ${row.restsOn.trim()}` : ''}${inferred ? ' (state inferred: written before avenues carried one)' : ''}` }
    case 'FROM_DEBATE':
      return { state, inferred, line: 'Drawn from a debate that already exists on this and has not resolved the problem — so these are options that have already been proposed and have not solved it. See what was tried, what was recommended and never implemented, and what is still unsolved, below.' }
    case 'NOT_NEEDED':
      return { state, inferred, line: `${notNeededSentence(av)}${row.whyNotApplicable?.trim() ? ` (${row.whyNotApplicable.trim()})` : ''}${inferred ? ' (state inferred: written before avenues carried one)' : ''}` }
    case 'INSUFFICIENT':
      return { state, inferred, line: INSUFFICIENT_SENTENCE }
  }
}

/** §11 — the debate record read back off the row, or null. */
export function readDebate(raw: unknown): DebateRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const d = raw as Partial<DebateRecord>
  const arr = <T,>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : [])
  return {
    tried: arr<{ what: string; whatHappened: string }>(d.tried).filter((t) => t?.what),
    recommendedNeverImplemented: arr<{ what: string; byWhom: string }>(d.recommendedNeverImplemented).filter((t) => t?.what),
    stillUnsolved: typeof d.stillUnsolved === 'string' ? d.stillUnsolved : '',
    offListNote: typeof d.offListNote === 'string' ? d.offListNote : '',
  }
}
