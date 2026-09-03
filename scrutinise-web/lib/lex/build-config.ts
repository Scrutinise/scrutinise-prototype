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
  // ── 25-F: the pass that asks whether any of it is good, and the two that verify it ──
  | 'SMART' | 'KERNEL_CHECK' | 'LOGIC_CHECK'
  // ── 25-O §5: the only pass that reads the causes as a SET ──
  | 'CAUSES_COMMENTARY'

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
  /**
   * ⚠⚠ 25-F — MAY THE BUILD CARRY ON IF THIS PASS FAILS?
   *
   * The standing rule is that a FAILED pass STOPS the build (`nextPassKey`), and for the
   * drafting passes that is right: there is no point researching a diagnosis that was
   * never written.
   *
   * THE FIRST LIVE RUN OF 25-F SHOWED WHERE IT IS WRONG. One panel model returned
   * `coherentActions` as a string where the schema asked for an array; the smart pass threw
   * on `.join`; and because a thrown pass is a FAILED pass, **four of ten passes were lost
   * — the smart pass, both verification passes and the hostile clerk — over one field of
   * one model's reply.** The kernel was drafted, researched and revised by then. Throwing
   * the adversarial read away because a critique misbehaved is the wrong trade.
   *
   * So the three passes ADDED BY 25-F are marked here, and only those three. They are
   * enhancements over a kernel that already exists; passes 1–6 build it, and a build
   * missing one of those has nothing to enhance.
   *
   * ⚠ THE FAILURE IS STILL RECORDED AS A FAILURE. It is not converted to SKIPPED, which
   * would read as "we chose not to run this". The pass log keeps FAILED and its reason,
   * `BuildProgress` renders it in amber, and `composeSummary` names it in the message the
   * user reads first — because a DONE build that quietly lost its hostile reading is the
   * silent-degradation failure this codebase has now recorded six times.
   */
  continueOnFailure?: boolean
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
  // ── 25-O §5 — THE OPENING COMMENTARY ON THE CAUSES ───────────────────────
  {
    key: 'CAUSES_COMMENTARY',
    label: 'Describing the terrain',
    detail:
      'Reading the causes as a SET rather than one at a time: what the evidence says, where the '
      + 'sources disagree, how complex this is, and how the pieces relate.',
    // ⚠⚠ IT RUNS HERE, AFTER `REVISE`, AND THE POSITION IS THE DESIGN. `REVISE` is the pass that
    // rewrites the causes against the research (25-L: two passes write causes and the second
    // replaces the first), so anything earlier would describe a terrain that is about to change.
    // And it runs BEFORE the four verification passes, which are all `continueOnFailure` — so if
    // the whole-build ceiling fires late, the thing lost is a check and not the commentary.
    //
    // ⚠ THE CEILING COST IS REAL AND IS NOT HIDDEN. Build v7 hit the 900s hard stop at 922s with
    // TEN passes (25-N §1a); this makes eleven. It does no retrieval and reads material already
    // in hand, so it is the cheapest kind of pass — but it is not free, and the sprint report
    // states what it adds. 25-N's resume is what makes an eleventh pass survivable.
    continueOnFailure: true,
    // ⚠ NOT THE CHEAPEST MODEL. This is a judgement about a body of evidence and about where it
    // contradicts itself — the same reasoning that moved the adversarial read off flash in 25-F
    // §2e after it produced 407 output tokens for six issues.
    model: 'gemini-2.5-pro',
  },
  // ── 25-F §2 — THE SMART PASS. After revision, before the agenda. ──────────
  {
    key: 'SMART',
    label: 'Asking whether any of this is good',
    detail:
      'Putting your own words to other models, turning what they name into corpus queries, and '
      + 'critiquing the kernel against Rumelt — rewriting it where it fails.',
    // See `continueOnFailure`: this runs on a kernel that already exists.
    continueOnFailure: true,
    // ⚠ §2e — NOT THE CHEAPEST MODEL, AND THIS ONE IS A DECISION RATHER THAN A DEFAULT.
    // The adversarial read ran on `gemini-2.5-flash` and produced 407 output tokens for
    // six issues, on the pass where reasoning strength matters most. This pass reads the
    // whole kernel, three outside answers and the research, and then rewrites. The panel
    // of outside models is chosen separately, for vendor spread — see build-smart.ts.
    model: 'gemini-2.5-pro',
  },
  // ── 25-F §3 — the two passes that verify. ─────────────────────────────────
  {
    key: 'KERNEL_CHECK',
    label: 'Checking it is a kernel at all',
    detail: 'Nine tests from the method: is the problem a problem, does the policy rule anything out, do the actions defeat the causes.',
    model: 'gemini-2.5-pro',
    continueOnFailure: true,
  },
  {
    key: 'LOGIC_CHECK',
    label: 'Checking the argument holds',
    detail: 'Causes → obstacle → approach → actions, link by link: non-sequiturs, circularity, claims with nothing behind them.',
    model: 'gemini-2.5-pro',
    continueOnFailure: true,
  },
  {
    key: 'ADVERSARIAL',
    label: 'Reading it back as a hostile clerk',
    detail: 'Where is it weakest, what can it not answer, what will it be asked that it has no answer to.',
    // ⚠⚠ 25-F §2e — THIS WAS `gemini-2.5-flash` AND THAT IS NOW A MEASURED MISTAKE, NOT AN
    // OPEN QUESTION.
    //
    // 25-B left it on the house default deliberately, so that a swap would be made on
    // evidence rather than on preference: "a swap made permanent in config before that
    // comparison exists would be a verdict nobody measured." The evidence arrived from the
    // first real build — the cheapest model we have, on the pass where reasoning strength
    // matters most, produced **407 output tokens for six issues** against a complete
    // constitutional-reform proposal. That is not a close call about ranking quality; it
    // is a pass that was not doing its job.
    //
    // `LEX_BUILD_MODEL_ADVERSARIAL` still overrides, and it is now what a comparison BACK
    // to flash would be run with.
    model: 'gemini-2.5-pro',
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
 * ══ ⚠⚠ 25-W §E (decision 55) — THE WALL CLOCK ON ONE PASS. NOT FOR SPEED. ═══════════════
 *
 * Charlie: *"A per-pass ceiling of 600 s. Not for speed: SMART's observed maximum is 285 s,
 * so it will not bite in normal use. ⚠ It exists because nothing now catches a hung call —
 * the 900 s clock only fires between passes. The pass must fail with a stated reason,
 * leaving a resumable build, not a dead one."*
 *
 * ⚠ IT IS A DIFFERENT INSTRUMENT FROM `PASS_BUDGET_MS`, WHICH IS WHY BOTH EXIST.
 * `PASS_BUDGET_MS` is a BUDGET a pass consults — 25-T §1e measured where it is honoured and
 * found exactly one place, the research pass's question loop. Every other pass ignores it,
 * because nothing asks. A budget nobody reads is not a ceiling, and off the Vercel functions
 * there is no platform kill behind it any more: on the worker a pass may run for ever and the
 * only clock is `HARD_STOP_MS`, which `checkStop` consults BETWEEN passes and so cannot
 * interrupt one. A single call that never returns is therefore unbounded today.
 *
 * This is a WALL CLOCK, enforced by `runNextPass` around the pass itself, so it binds on
 * every pass whether or not that pass knows it exists.
 *
 * ⚠ 600 s IS DELIBERATELY GENEROUS. The slowest pass ever measured is SMART at 285.5 s (25-Q
 * addendum) and the longest complete build is 525 s of pass time across eleven passes. At
 * twice the worst single pass this cannot fire on work; it fires on a hang. A ceiling set
 * close to the observed maximum would start failing healthy builds the first time a model was
 * slow, which is how a guard gets raised until it means nothing.
 */
export const PASS_CEILING_MS = parseInt(process.env.LEX_BUILD_PASS_CEILING_MS ?? '600000', 10)

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

// ── AMENDMENT_25B §B — WHERE THE BUILD ACTUALLY RUNS ─────────────────────────
//
// Charlie's decision, and it supersedes §1 of the brief: **the worker, not the request
// chain.** "A ten-minute job should not depend on a browser tab staying open. The user
// starts a build, closes the laptop, and comes back to a finished proposal."
//
// That is the whole argument and it is a good one. Pass-per-request removed the 300s
// ceiling by working around it; the worker removes it by not being subject to it, and it
// makes the build survive the thing that actually happens — someone closing a tab.
//
// ⚠ THE PASS-PER-REQUEST PATH IS KEPT, NOT DELETED, and it is the documented fallback the
// amendment asks for. It is the same `runNextPass` the worker calls in a loop, so keeping
// it costs one flag rather than a second engine — and if the worker is unavailable
// (unprovisioned, crash-looping, paused for a usage limit) a build can still be driven
// from the browser instead of failing.
//
// The CLIENT is told which driver is in force by the state payload, because it cannot
// read an env var and must not guess: a client that assumed "client" while the worker was
// also running would drive the same passes twice.

export type BuildDriver = 'worker' | 'client'

/**
 * ⚠ THE DEFAULT IS `client`, AND THAT IS NOT A VOTE AGAINST THE WORKER. It is the rule
 * that the default must be the configuration which actually works with what is deployed.
 *
 * The worker is built, tested and ready (`scripts/build-worker.ts`, and
 * `verify:build-worker` passes the closed-tab test end to end). Two things have to be
 * true before it can be switched on, and NEITHER of them is code:
 *
 *   1. A Railway service must exist running `npm run build:worker`.
 *   2. `LEX_BUILD_DRIVER=worker` must be set in Vercel — which cannot be done from this
 *      machine, because the Vercel token authenticates and then 403s on every
 *      project-scoped endpoint with `"saml": true` (docs/CLAUDE.md §19).
 *
 * Defaulting to `worker` before both are done would mean every build enqueued and NOTHING
 * running it: a page that says "Starting" for ever. `WORKER_PICKUP_GRACE_MS` catches that
 * if it ever happens anyway, but a 90-second dead start on every build is not a default,
 * it is a bug with a recovery path.
 *
 * ▶ FLIPPING IT IS ONE LINE, and the day it is flipped the worker takes over with no
 * other change — the client is told which driver is in force by the state payload.
 */
export function buildDriver(): BuildDriver {
  return process.env.LEX_BUILD_DRIVER === 'worker' ? 'worker' : 'client'
}

/**
 * ⚠ §B's concurrency warning, executed: "A build fires 10–20 searches and the vector
 * service handles four at once. One build must not saturate the search layer for
 * everyone."
 *
 * Two things hold that line, and only the second is a number:
 *
 *  1. A BUILD IS ALREADY SERIAL INSIDE ITSELF. The research pass asks its questions one
 *     at a time and each question runs its intents one at a time, so a single build has
 *     at most ONE search in flight. That is a property of the engine, not a setting, and
 *     `check:build-25b` asserts it rather than trusting it.
 *  2. THE WORKER RUNS ONE BUILD AT A TIME by default. Two builds in parallel would be two
 *     concurrent searches, which is still inside the service's four — but three or four
 *     workers would not be, and the failure would land on every user's search rather than
 *     on the build that caused it.
 *
 * Raise it only with a measurement, and raise `vector-serve`'s cap first.
 */
export const WORKER_CONCURRENCY = Math.max(
  1, parseInt(process.env.LEX_BUILD_WORKER_CONCURRENCY ?? '1', 10),
)

/** How long the worker waits between polls when it finds nothing to do. */
export const WORKER_IDLE_MS = parseInt(process.env.LEX_BUILD_WORKER_IDLE_MS ?? '5000', 10)

/**
 * ⚠ HOW LONG A BUILD MAY SIT QUEUED BEFORE THE BROWSER TAKES IT OVER.
 *
 * THE FAILURE THIS PREVENTS IS THE ONE THE ARCHITECTURE CREATES. With the worker driving,
 * the web app enqueues and returns — so if no worker is running (not yet provisioned,
 * crash-looping, paused on a usage limit, or mid-redeploy) the row sits at QUEUED and
 * NOTHING EVER HAPPENS. The user sees "Starting" for ever. That is strictly worse than
 * the design it replaced, and it is the sort of silence this codebase keeps having to
 * remove: a worker that is absent and a worker that is merely slow look identical from
 * the page.
 *
 * So after this grace period the CLIENT claims the build and drives it pass-by-pass —
 * the documented fallback, used automatically rather than by someone noticing. The
 * handover is safe in one direction by construction: the client's claim moves the row
 * QUEUED → RUNNING, and `claimQueuedBuild` only ever claims a QUEUED row, so a worker
 * that wakes up later cannot also take it.
 *
 * Generous on purpose. A worker polling every 5s picks a build up almost immediately;
 * ninety seconds means the fallback only fires when something is genuinely wrong.
 */
export const WORKER_PICKUP_GRACE_MS = parseInt(
  process.env.LEX_BUILD_WORKER_GRACE_MS ?? '90000', 10,
)

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

// ── 25-G §1a/§1b — HOW MUCH OF A BUILD A RE-RUN ACTUALLY RUNS ────────────────
//
// ⚠ THIS IS NOT A COLUMN, AND THAT IS DELIBERATE. The mode is expressed in the STORED PASS
// LOG — a reused pass is `SKIPPED` with its reuse note as its output — so "what did this
// build actually run" is answered by the same record that answers every other question
// about it. A `mode` column would be a second place to look, and the two would drift the
// first time a pass was skipped for a different reason.
//
// `REUSE` is the DEFAULT for a re-run and `FULL` is the explicit choice (§1b), because the
// expensive option should be the one somebody asks for.

export type BuildMode = 'FULL' | 'REUSE'

export function isBuildMode(v: unknown): v is BuildMode {
  return v === 'FULL' || v === 'REUSE'
}

/**
 * The passes a `REUSE` run reads from the previous build instead of running.
 *
 * ⚠ EXACTLY THESE TWO, and the reason is that they are the only passes whose output does
 * not depend on the draft. ORIENT and RESEARCH read the ELICITATION and the CORPUS; every
 * other pass reads the DRAFT, which is the thing a re-run exists to change. Adding a
 * drafting pass here would make a re-run re-present the same draft it was asked to redo.
 */
export const REUSABLE_PASSES: readonly BuildPassKey[] = ['ORIENT', 'RESEARCH']

/**
 * 25-G §1c — HOW MANY RETRIEVED SOURCES THE ORIENT MODEL ACTUALLY READS.
 *
 * ⚠ 40, AND THE NUMBER IS MEASURED. The pass was handing the model everything the gateway
 * returned — ~434 documents, **77,970 input tokens across two calls, 36% of a whole
 * build's input** — while storing 20 and showing the user 20. Forty is well above what is
 * stored (so nothing the user can see is unread) and an order of magnitude below what was
 * being sent.
 *
 * ⚠ It caps READING, never STORAGE and never the retrieved count, both of which are still
 * reported. See the note at the call site for why a prefix is a fair sample here and would
 * not be on a score-ordered list.
 */
export const ORIENT_SOURCE_CAP = Math.max(
  20, parseInt(process.env.LEX_BUILD_ORIENT_SOURCE_CAP ?? '40', 10),
)

export type Framing = 'A_NAIVE' | 'B_CONTEXTUALISED'

export const DEFAULT_FRAMING: Framing =
  (process.env.LEX_BUILD_FRAMING as Framing | undefined) ?? 'B_CONTEXTUALISED'

export function isFraming(v: unknown): v is Framing {
  return v === 'A_NAIVE' || v === 'B_CONTEXTUALISED'
}

/**
 * ⚠⚠ 25-L §1 — WHAT THE USER SAID WAS WRONG WITH THE LAST RUN, AS AN INSTRUCTION.
 *
 * §1: the dialogue's text "goes into the drafting and smart passes as *what the user says
 * was wrong with the last attempt*  — ⚠ with an explicit instruction to act on it, because
 * 25-F found that material supplied to a pass without an instruction is material the pass
 * ignores." Same finding as CLAUDE.md §24, from the other end: a prompt that merely CARRIES
 * a fact is not a prompt that asks for anything to be done about it.
 *
 * ⚠ IT IS LABELLED AS THE USER'S WORDS AND IS NOT A SOURCE. Like `ownKnowledge`, this is
 * testimony — it may steer the draft and may never be cited as evidence for a claim about
 * the world.
 *
 * ⚠ AND IT IS AN INSTRUCTION, NOT AN ORDER TO AGREE. A user can be wrong about what was
 * wrong; a pass told to obey would produce a draft that flatters them. The wording asks for
 * the criticism to be ANSWERED — acted on, or addressed and explained.
 */
export function critiqueBlock(critique: string | null | undefined): string {
  const text = (critique ?? '').trim()
  if (!text) return ''
  return [
    '\n═══ WHAT THE USER SAYS WAS WRONG WITH YOUR LAST ATTEMPT ═══',
    'They have read your previous draft and asked for this run. These are their words, not a',
    'retrieved source — never cite them as evidence for a claim about the world.',
    '',
    text.slice(0, 6000),
    '',
    '⚠ ACT ON THIS. It is the single most specific instruction you have been given about this',
    'proposal, and it is the reason this run exists. For each point they make: change what they',
    'say is wrong, add what they say is missing, or — if the record does not support them — say',
    'plainly in your output that you looked and why you did not change it. Do NOT simply repeat',
    'the last draft with different words, and do NOT agree with a criticism the evidence does not',
    'bear out; a draft that flatters the user is worth less to them than one that argues back.',
  ].join('\n')
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
  // ⚠ 25-L §1 — ON BOTH ARMS. The framing experiment is about how much CONTEXT each arm
  // carries; the critique is an instruction about this run, and withholding it from arm A
  // would make A worse at the thing the user just asked for rather than differently framed.
  const critique = critiqueBlock(ctx.userCritique)

  if (framing === 'A_NAIVE') {
    // A — the user's problem, phrased as they would put it into a chat window. Nothing
    // else: no goal, no ruled-outs, no profile, no structure. That absence IS the arm.
    const plain = ctx.problem.trim().slice(0, 4000)
    return {
      keywords,
      ideaContext: '',
      promptBlock: [plain, critique].filter(Boolean).join('\n'),
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
    critique,
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
