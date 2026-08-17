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

// ── The named passes (§2 — "Named passes, not a spinner") ────────────────────
//
// FOUR displayed passes, and the split is not cosmetic. §4 drafts diagnosis → guiding
// policy → coherent actions "straight through", and running that as one opaque step
// would mean a five-minute progress bar with one label on it AND — worse — a single
// commit point, so a timeout in the actions draft would lose the diagnosis too.
// Committing each as it completes is what makes "a timeout loses the tail, never the
// run" true rather than aspirational.

export type BuildPassKey = 'ORIENT' | 'DIAGNOSIS' | 'APPROACH' | 'ACTIONS'

export interface BuildPassDef {
  key: BuildPassKey
  /** What the user sees while it runs. Charlie's wording. */
  label: string
  /** One line under the label, so a five-minute wait is legible. */
  detail: string
}

export const BUILD_PASSES: BuildPassDef[] = [
  {
    key: 'ORIENT',
    label: 'Understanding the terrain',
    detail: 'Searching the corpus, and asking who else has solved a problem shaped like this.',
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
]

export function passDef(key: string): BuildPassDef | undefined {
  return BUILD_PASSES.find((p) => p.key === key)
}

/** §7 — model per pass, configurable. Falls through: pass → build → the house default. */
export function modelForPass(key: BuildPassKey): string {
  return (
    process.env[`LEX_BUILD_MODEL_${key}`] ??
    process.env.LEX_BUILD_MODEL ??
    process.env.QUERY_EXPANSION_MODEL ??
    'gemini-2.5-flash'
  )
}

// ── Ceilings (§2) ────────────────────────────────────────────────────────────
//
// ⚠ TWO CEILINGS, AND ONLY ONE OF THEM CAN FIRE ON VERCEL TODAY. The brief asks for a
// hard stop at 15 minutes. A Next.js route handler cannot run for 15 minutes on this
// platform — `maxDuration` tops out at 300s for these functions — so a 900,000ms budget
// checked inside the request is a guard that CANNOT FAIL, which this codebase has
// learned to distrust (docs/CLAUDE.md, and the "a guard that cannot fail is not a guard"
// note in the memory index).
//
// So both numbers are declared, `effectiveBudgetMs()` returns the one that actually
// binds, and the engine logs WHICH. The 15-minute ceiling becomes reachable the day the
// build moves to a background worker; until then the honest statement is that the
// in-request budget is the operative limit, and a build the platform kills outright is
// caught by `settleAbandonedBuilds` and written to FAILED.
export const HARD_STOP_MS = parseInt(process.env.LEX_BUILD_HARD_STOP_MS ?? '900000', 10)
export const REQUEST_BUDGET_MS = parseInt(process.env.LEX_BUILD_BUDGET_MS ?? '270000', 10)

export function effectiveBudgetMs(): { ms: number; binding: 'request' | 'hard-stop' } {
  return REQUEST_BUDGET_MS <= HARD_STOP_MS
    ? { ms: REQUEST_BUDGET_MS, binding: 'request' }
    : { ms: HARD_STOP_MS, binding: 'hard-stop' }
}

/** Spend ceiling for one build, in pence. Hitting it is a FAILED build with a reason. */
export const COST_CEILING_PENCE = Number(process.env.LEX_BUILD_COST_PENCE ?? '50')

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
 *  is about FRAMING, and changing the term extraction as well would confound it. */
function termsFrom(text: string, cap = 18): string[] {
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
