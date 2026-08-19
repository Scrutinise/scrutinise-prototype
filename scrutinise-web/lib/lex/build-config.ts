// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A §2/§3/§4 — THE BUILD, AS CONFIGURATION.
//
// The passes, their models, the ceilings, and the two query framings. One mechanism
// (build.ts); everything a later sprint will want to change without a code change lives
// here — §7: "Model choice per pass should be configurable rather than hardcoded —
// pass 5's adversarial read (25-B) is where model strength is most likely to matter,
// and we will want to test it without a code change."
// ─────────────────────────────────────────────────────────────────────────────

import type { ElicitationContext } from './elicitation'
import { flagEnabled } from '@/lib/env-flags'

// ── The named passes (§2 — "Named passes, not a spinner") ────────────────────
//
// FOUR displayed passes, and the split is not cosmetic. §4 drafts diagnosis → guiding
// policy → coherent actions "straight through", and running that as one opaque step
// would mean a five-minute progress bar with one label on it AND — worse — a single
// commit point, so a timeout in the actions draft would lose the diagnosis too.
// Committing each as it completes is what makes "a timeout loses the tail, never the
// run" true rather than aspirational.

export type BuildPassKey =
  | 'ORIENT' | 'DIAGNOSIS' | 'APPROACH' | 'ACTIONS'
  // ── 25-B: the three passes that make the draft worth reading ──
  | 'RESEARCH' | 'REVISE' | 'ADVERSARIAL'

export interface BuildPassDef {
  key: BuildPassKey
  /** What the user sees while it runs. Charlie's wording. */
  label: string
  /** One line under the label, so a five-minute wait is legible. */
  detail: string
  /**
   * 25-B §7 — IS THIS A COVERAGE PASS?
   *
   * The multi-perspective experiment applies to passes 1 and 3 "only — the coverage
   * passes. Not pass 2 or 4: one voice drafts better than four merged, and merging
   * drafts produces exactly the mush we are trying to avoid."
   *
   * That rule lives HERE as a flag rather than as `key === 'ORIENT' || key === 'RESEARCH'`
   * at the call site, because the next pass someone adds will be added to this array and
   * the question "is it a coverage pass" has to be answerable at that moment, in this
   * file, rather than discovered later in an `if`.
   */
  coverage?: boolean
  /**
   * The default model for this pass, before any env override. §6: "model choice is
   * configurable per pass and this is the pass where it matters".
   */
  model?: string
}

export const BUILD_PASSES: BuildPassDef[] = [
  {
    key: 'ORIENT',
    label: 'Understanding the terrain',
    detail: 'Searching the corpus, and asking who else has solved a problem shaped like this.',
    coverage: true,
  },
  {
    key: 'DIAGNOSIS',
    label: 'Drafting the diagnosis',
    detail: 'What is actually going wrong, what causes it, and what has stopped anyone fixing it.',
  },
  {
    key: 'APPROACH',
    label: 'Drafting the approach',
    detail: 'The approach to the obstacle, the instrument it would use, and what it rules out.',
  },
  {
    key: 'ACTIONS',
    label: 'Drafting the actions',
    detail: 'The coordinated steps that would execute the approach, and who does each one.',
  },
  {
    key: 'RESEARCH',
    label: 'Researching what the draft revealed',
    detail: 'Interrogating the corpus about the draft — starting with whether a power to do this already exists.',
    coverage: true,
  },
  {
    key: 'REVISE',
    label: 'Revising in the light of it',
    detail: 'Rewriting the kernel — especially the causes — and keeping every place the evidence changed my mind.',
  },
  {
    key: 'ADVERSARIAL',
    label: 'Reading it back as a hostile clerk',
    detail: 'Where is it weakest, what can it not answer, what will it be asked that it has no answer to.',
    // ⚠ NOT CHANGED FROM THE HOUSE DEFAULT HERE. §6 asks us to TRY a stronger model and
    // report the difference in the findings; a swap made permanent in config before that
    // comparison exists would be a verdict nobody measured. `LEX_BUILD_MODEL_ADVERSARIAL`
    // is the one-line override the comparison is run with, and BUILD_25B_REPORT.md
    // records what it produced.
    model: 'gemini-2.5-flash',
  },
]

export function passDef(key: string): BuildPassDef | undefined {
  return BUILD_PASSES.find((p) => p.key === key)
}

export function isBuildPassKey(key: string): key is BuildPassKey {
  return BUILD_PASSES.some((p) => p.key === key)
}

/** §7/§6 — model per pass, configurable. Falls through: env pass → env build → the pass's
 *  own declared default → the house default. */
export function modelForPass(key: BuildPassKey): string {
  return (
    process.env[`LEX_BUILD_MODEL_${key}`] ??
    process.env.LEX_BUILD_MODEL ??
    passDef(key)?.model ??
    process.env.QUERY_EXPANSION_MODEL ??
    'gemini-2.5-flash'
  )
}

// ── Ceilings (§2, and 25-B §1/§8) ────────────────────────────────────────────
//
// ⚠ 25-A DECLARED THE 15-MINUTE CEILING UNREACHABLE. IT IS NOW REACHABLE, AND THIS IS
// THE NOTE RECORDING WHY THAT CHANGED — because a limitation that quietly stops being
// true is how a stale comment becomes a lie.
//
// 25-A ran the whole build inside ONE request, so the only ceiling that could fire was
// the platform's own `maxDuration` (300s). A 900,000ms budget checked inside a function
// the platform kills at 300s is a guard that CANNOT FAIL, which this codebase has
// learned to distrust ("a guard that cannot fail is not a guard").
//
// 25-B §1 puts ONE PASS IN ONE REQUEST. Elapsed is therefore measured from the row's
// stored `startedAt` ACROSS requests, not from the start of the current function — so
// the whole-build hard stop is now a real wall clock that a seven-pass build can
// genuinely hit, and it fires between passes like every other stop reason.
//
// Two ceilings remain, and they now bind on different things:
//   · PASS_BUDGET_MS  — one pass, inside one request. Under the platform's 300s.
//   · HARD_STOP_MS    — the whole build, across all its requests. Now enforceable.
export const HARD_STOP_MS = parseInt(process.env.LEX_BUILD_HARD_STOP_MS ?? '900000', 10)

/**
 * The in-request budget for ONE pass. Must stay under the route's `maxDuration` (300s)
 * with enough headroom to write the failure — a pass that spends its whole budget and is
 * then killed before it can record why is the failure this budget exists to prevent.
 */
export const PASS_BUDGET_MS = parseInt(process.env.LEX_BUILD_PASS_BUDGET_MS ?? '240000', 10)

/**
 * Retained under its 25-A name because the check harness, the state payload and the
 * `ceiling.binding` string all read it. It now means "the budget for the request in
 * front of you", which is the pass budget.
 */
export const REQUEST_BUDGET_MS = parseInt(process.env.LEX_BUILD_BUDGET_MS ?? String(PASS_BUDGET_MS), 10)

export function effectiveBudgetMs(): { ms: number; binding: 'request' | 'hard-stop' } {
  return REQUEST_BUDGET_MS <= HARD_STOP_MS
    ? { ms: REQUEST_BUDGET_MS, binding: 'request' }
    : { ms: HARD_STOP_MS, binding: 'hard-stop' }
}

/** Spend ceiling for one build, in pence. Hitting it is a FAILED build with a reason. */
export const COST_CEILING_PENCE = Number(process.env.LEX_BUILD_COST_PENCE ?? '50')

/**
 * §8 — "CEILINGS PER PASS, NOT JUST PER BUILD, so one runaway question cannot consume
 * the budget."
 *
 * The build ceiling alone has a specific hole that 25-B opens up: pass 3 issues one
 * retrieval and one sift PER LIBRARY QUESTION, so a single pass can now make a dozen
 * model calls where 25-A's passes made one each. Under a build-only ceiling, one
 * pathological question spends the whole 50p and passes 4 and 5 never run — and the
 * build reports "hit its spend ceiling" without saying that one pass ate it.
 *
 * A pass that hits its own ceiling stops THAT PASS and lets the build continue, which is
 * the difference between losing a question and losing the sprint's whole point.
 */
export const PASS_COST_CEILING_PENCE = Number(
  process.env.LEX_BUILD_PASS_COST_PENCE ?? String(Math.max(1, Math.round(COST_CEILING_PENCE / 2))),
)

/**
 * How long a RUNNING build may go unfinished before it is treated as abandoned.
 * Comfortably longer than the in-request budget plus the platform's own ceiling, so a
 * slow-but-live build is never killed by the settle.
 */
export const ABANDONED_AFTER_MS = parseInt(process.env.LEX_BUILD_ABANDON_MS ?? '600000', 10)

// ── §3a — THE QUERY-FRAMING EXPERIMENT ───────────────────────────────────────
//
// Charlie's observation, and it is the reason pass 1 is in this sprint at all: a naive
// user-style question may OUTPERFORM a heavily contextualised one, because loading a
// model with structure can crowd out its own reasoning.
//
// ⚠ NO WINNER IS PICKED IN CODE. Both arms are built, both are runnable on the same
// idea, and the arm is written onto the build row so the comparison survives the
// session that ran it. `DEFAULT_FRAMING` is the arm an ordinary user gets and is NOT a
// verdict — it is simply the framing closest to what the rest of the product does
// today, so that the experiment is the thing being tested and not the deployment.

export type Framing = 'A_NAIVE' | 'B_CONTEXTUALISED'

export const DEFAULT_FRAMING: Framing =
  (process.env.LEX_BUILD_FRAMING as Framing | undefined) ?? 'B_CONTEXTUALISED'

export function isFraming(v: unknown): v is Framing {
  return v === 'A_NAIVE' || v === 'B_CONTEXTUALISED'
}

export interface FramedQuery {
  /** Terms handed to the gateway. */
  keywords: string[]
  /** Extra context the gateway may use to steer retrieval ONLY (never cited). */
  ideaContext: string
  /** The block the orient pass reasons over. THIS is where the two arms differ most. */
  promptBlock: string
  /** Exactly what was issued, recorded on the build row. */
  queryUsed: string
}

const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'they', 'their', 'them', 'about',
  'would', 'should', 'could', 'because', 'which', 'what', 'when', 'where', 'there', 'here',
  'into', 'over', 'under', 'more', 'most', 'some', 'such', 'than', 'then', 'will', 'been',
  'being', 'were', 'your', 'ours', 'also', 'just', 'very', 'much', 'many', 'need', 'want',
])

/** The user's own words, reduced to search terms. Shared by BOTH arms — the experiment
 *  is about FRAMING, and changing the term extraction as well would confound it.
 *
 *  Exported since 25-B: the interrogation library builds a query per question and must
 *  use the SAME extraction, or a question's retrieval would differ from the build's for
 *  a reason nobody chose. */
export function termsFrom(text: string, cap = 18): string[] {
  const freq = new Map<string, number>()
  for (const w of text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []) {
    if (STOPWORDS.has(w)) continue
    freq.set(w, (freq.get(w) ?? 0) + 1)
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, cap).map(([w]) => w)
}

export function frameQuery(framing: Framing, ctx: ElicitationContext): FramedQuery {
  const keywords = termsFrom(ctx.problem || ctx.goalDetail)

  if (framing === 'A_NAIVE') {
    // A — the user's problem, phrased as they would put it into a chat window. Nothing
    // else: no goal, no ruled-outs, no profile, no structure. That absence IS the arm.
    const plain = ctx.problem.trim().slice(0, 4000)
    return {
      keywords,
      ideaContext: '',
      promptBlock: plain,
      queryUsed: `A_NAIVE :: ${keywords.join(' ')} :: (no context supplied)`,
    }
  }

  // B — the problem plus goal, ruled-outs, their own knowledge and the profile.
  const block = [
    `THE PROBLEM, IN THE USER'S WORDS:\n${ctx.problem.trim().slice(0, 4000) || '(not given)'}`,
    `\nWHAT THEY WANT TO HAPPEN: ${ctx.goalKindLabel}${ctx.goalDetail ? ` — ${ctx.goalDetail.slice(0, 2000)}` : ''}`,
    ctx.ruledOut ? `\nALREADY RULED OUT (do not propose these): ${ctx.ruledOut.slice(0, 2000)}` : '',
    // ⚠ LABELLED, ALWAYS, IN EVERY PROMPT THAT CARRIES IT. This is the user telling you
    // what they know from experience. It is NOT a retrieved source and may never be
    // cited as one — §25.3 item 5 and every later citation depend on the distinction.
    ctx.ownKnowledge
      ? `\nTHE USER'S OWN KNOWLEDGE (USER TESTIMONY — not a retrieved source, never cite it as one):\n${ctx.ownKnowledge.slice(0, 4000)}`
      : '',
    ctx.aboutYou ? `\nABOUT THE USER: ${ctx.aboutYou.slice(0, 1500)}` : '',
  ].filter(Boolean).join('\n')

  const context = [ctx.goalDetail, ctx.ruledOut, ctx.ownKnowledge].filter(Boolean).join(' ').slice(0, 1500)
  return {
    keywords,
    ideaContext: context,
    promptBlock: block,
    queryUsed: `B_CONTEXTUALISED :: ${keywords.join(' ')} :: context(${context.length} chars)`,
  }
}

// ── 25-B §7 — MULTI-MODEL PERSPECTIVES, ON THE COVERAGE PASSES ONLY ──────────
//
// Charlie's case, and the four-model comparison is the evidence for it: asked the same
// question, four models found substantially different things — a decision frame, an
// empirical case study, an official review, the constitutional depth. Ask one and you
// get roughly a quarter of the available material.
//
// ⚠ WHERE IT APPLIES IS A PROPERTY OF THE PASS, NOT OF THIS LIST. `coverage: true` on a
// BuildPassDef is the gate, so passes 2 and 4 cannot acquire perspectives by someone
// adding an entry here: "one voice drafts better than four merged, and merging drafts
// produces exactly the mush we are trying to avoid."
//
// ⚠ AND THE DIVERGENCE IS THE POINT. The merge deduplicates, but a finding only ONE
// perspective produced is precisely what the exercise is for and must never be averaged
// away — see mergePerspectives in build-perspectives.ts, where that rule is executed
// rather than requested.

export interface Perspective {
  id: string
  /** Shown against a finding that only this perspective produced. */
  label: string
  /**
   * The instruction appended to the pass's system prompt. Different FRAMINGS, not
   * different rules — every perspective is bound by the same never-claim contract.
   */
  lens: string
  /** Optional model override, so a perspective can be a different MODEL as well as a
   *  different framing. Falls back to the pass's own model when absent. */
  model?: string
}

/**
 * The house perspective — what a single-perspective run is, named rather than implied.
 * A run with perspectives OFF still records that it used this one, so "one perspective"
 * and "the flag was off" are the same statement rather than two indistinguishable ones.
 */
export const HOUSE_PERSPECTIVE: Perspective = {
  id: 'HOUSE',
  label: 'the standing reading',
  lens: '',
}

export const PERSPECTIVES: Perspective[] = [
  HOUSE_PERSPECTIVE,
  {
    id: 'EMPIRICAL',
    label: 'the empirical reading',
    lens:
      'BIAS YOUR READING TOWARDS THE EMPIRICAL. Prefer what was measured, counted, evaluated or ' +
      'reviewed after the fact over what was argued or intended. Where a source states a number, an ' +
      'outcome or a finding from an evaluation, that is worth more here than a well-made argument.',
  },
  {
    id: 'CONSTITUTIONAL',
    label: 'the constitutional reading',
    lens:
      'BIAS YOUR READING TOWARDS THE CONSTITUTIONAL AND INSTITUTIONAL. Who holds the power, under ' +
      'what provision, answerable to whom, and what happens at the boundary between Westminster, the ' +
      'devolved legislatures, regulators and the courts. Structural facts about WHO MAY ACT are ' +
      'routinely missed by a reading that goes straight to the policy merits.',
  },
  {
    id: 'ADVERSARIAL_COVERAGE',
    label: 'the sceptical reading',
    lens:
      'BIAS YOUR READING TOWARDS WHAT CUTS AGAINST THE PROPOSAL. Look hardest for material that ' +
      'CONTRADICTS the premise, shows a comparable measure failing, or shows the problem is smaller ' +
      'or differently caused than stated. A search that returns only supporting material has usually ' +
      'not looked for the other kind.',
  },
]

export function perspectiveById(id: string): Perspective | undefined {
  return PERSPECTIVES.find((p) => p.id === id)
}

/** How many perspectives a multi-perspective run uses, house included. */
export const PERSPECTIVE_COUNT = Math.max(
  1,
  Math.min(PERSPECTIVES.length, parseInt(process.env.LEX_BUILD_PERSPECTIVE_COUNT ?? '3', 10)),
)

/**
 * The perspectives a pass runs.
 *
 * ⚠ SINGLE-PERSPECTIVE BY DEFAULT AND FLAG-GATED, as §7 requires. Multi-perspective
 * multiplies the cost of the coverage passes, and §7's whole point is that Charlie
 * judges whether the extra coverage is worth the money — which he cannot do if it is
 * already on.
 *
 * Reads the flag through `flagEnabled` rather than `=== 'true'`: a capitalised TRUE in
 * Vercel silently disabled the router once already (lib/env-flags.ts).
 */
export function perspectivesFor(key: BuildPassKey): Perspective[] {
  const def = passDef(key)
  if (!def?.coverage) return [HOUSE_PERSPECTIVE]
  if (!flagEnabled('LEX_BUILD_PERSPECTIVES')) return [HOUSE_PERSPECTIVE]
  return PERSPECTIVES.slice(0, PERSPECTIVE_COUNT)
}

// ── §3 — the domain-transfer question ────────────────────────────────────────
//
// "the highest-yield generic question we have". Answered by REASONING, labelled as
// reasoning, and never presented as corpus-grounded.
export const DOMAIN_TRANSFER_QUESTION =
  'Who else has this problem, outside this sector, and what have they built to deal with it?'

// ── §4 — the instrument question ─────────────────────────────────────────────
//
// Charlie's gap, and it is a real one. An idea that needs a funding decision and gets
// drafted as a Bill is wrong in a way no amount of good drafting fixes — so Lex must
// NAME the instrument it has assumed, and record the alternatives as a fork.
export const INSTRUMENTS = [
  'primary legislation',
  'secondary legislation',
  'regulator rule or guidance',
  'funding',
  'organisational change',
  'a change to a quango’s remit',
] as const

export const INSTRUMENT_DIMENSIONS =
  'Also say whether it is LOCAL or NATIONAL, and whether the subject is DEVOLVED or RESERVED.'

/** The fork key for the instrument choice, so 25-C can find it without string matching. */
export const INSTRUMENT_FORK_KEY = 'guidingPolicy:instrument'

/** Two alternatives per fork — Charlie's decision: two strong beats three with filler. */
export const ALTERNATIVES_PER_FORK = 2

/**
 * Keep at most `ALTERNATIVES_PER_FORK` complete alternatives, and say how many were
 * dropped.
 *
 * A pure function rather than three lines inside `persistForks` so that "two, and the
 * excess is COUNTED rather than silently discarded" is something `check:build-25a` can
 * actually execute. A cap nobody can see fire is a cap nobody can trust.
 */
export function trimForkAlternatives<T extends { alternative?: string; caseForAlternative?: string }>(
  alternatives: T[] | undefined,
): { kept: T[]; trimmed: number } {
  const complete = (alternatives ?? []).filter(
    (a) => !!a?.alternative?.trim() && !!a?.caseForAlternative?.trim(),
  )
  return {
    kept: complete.slice(0, ALTERNATIVES_PER_FORK),
    trimmed: Math.max(0, complete.length - ALTERNATIVES_PER_FORK),
  }
}
