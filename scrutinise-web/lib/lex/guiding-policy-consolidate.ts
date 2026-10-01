// ─────────────────────────────────────────────────────────────────────────────
// 26-I §3 — CONSOLIDATE: FOUR PREMIUM MODELS, EACH DRAFTS ONE GUIDING POLICY.
//
// Addendum B3: premium, as specified from the start — no debate here, unlike the judge
// (B2) or ordinary chat drafting (B1), both of which had a routing question to settle.
//
// ⚠ THE CONTEXT FINDING THAT GOVERNS THIS FILE (§0): Lex produced a compound guiding
// policy when asked cold because it had none of the material a good answer needs. Every
// call here is handed the diagnosis, the causes, the sorted candidates, the user's own
// attempts and the Rumelt tests explicitly — never a bare "give me a guiding policy."
// ─────────────────────────────────────────────────────────────────────────────

import { callModelJson, type LlmUsage } from './model-call'
import { recordUsage, type PricedSpend } from './spend-ledger'

/** §3/B3 — one call per vendor, deliberately, so a single provider outage never leaves
 *  the user with fewer than three drafts to choose from. */
export const PREMIUM_DRAFT_MODELS = ['gemini-2.5-pro', 'claude-opus-5', 'grok-4.7', 'gpt-6-luna'] as const

/**
 * ══ 26-L ADDENDUM 2 §1 — THE THREE FAILURES, MEASURED FROM A REAL RUN ═══════════════════
 *
 * `maxOutputTokens: 1024` was too tight for Claude's own `tool_use` answer (Anthropic charges
 * the whole structured call against `max_tokens`, unlike Gemini/OpenAI's separate JSON mode) —
 * `callAnthropic` reported `stop_reason: 'max_tokens'`, cut off, every time. Raised well past
 * what a two-or-three-sentence guiding-policy draft could ever need.
 *
 * `timeoutMs: 60_000` was tight for Grok specifically — `callXai`'s own header notes it was
 * "UNVERIFIED LIVE FROM THIS MACHINE" (no `GROK_API_KEY` when that code was written); the first
 * live exercise found x.ai's Responses API needs more room than 60s under real load. Raised for
 * every model in this file, which only ever helps the other three.
 */
const DRAFT_MAX_OUTPUT_TOKENS = 4096
const DRAFT_TIMEOUT_MS = 120_000

/**
 * ══ 26-L ADDENDUM 5 — GROK TIMED OUT AT 120s, TWICE, ON 1 OCT ═══════════════════════════
 *
 * Two runs 30s apart each produced three drafts and no Grok; Grok's ledger rows were 0 tokens,
 * written ~120.0s after the others finished — the timeout. Its drafts on 28 Sep (when it did
 * answer) were 5–7k output tokens, mostly reasoning, landing at ~110s+: 120s was never real
 * headroom. So Grok gets its own, longer limit. The other three keep 120s — they answer in
 * under 40s, and a longer limit would only slow the page down when one of them hangs.
 */
const MODEL_TIMEOUT_MS: Record<string, number> = { 'grok-4.7': 150_000 }
const timeoutFor = (model: string) => MODEL_TIMEOUT_MS[model] ?? DRAFT_TIMEOUT_MS
/**
 * ⚠ THE TIMEOUT WAS THE SYMPTOM; UNBOUNDED REASONING WAS THE CAUSE. Re-running Grok on the stored
 * 1 Oct inputs: 200s timeout again; then 211s and 15,058 output tokens with no limit, versus 5,798
 * on 30 Sep (MODEL_REVIEW_2026-09-30). `reasoning.effort` is accepted by the Responses API and cuts
 * it: `medium` 93s / 6.7k tokens, `low` 16s / 1.1k. `medium` — a considered draft that finishes
 * well inside 150s, leaving the retry budget intact. Other providers ignore the option.
 */
const reasoningEffortFor = (model: string): 'medium' | undefined => (model.startsWith('grok-') ? 'medium' : undefined)

/** The routes that call this run under `maxDuration = 300`; the judge (~15s) and the DB writes
 *  come after the drafts, so the drafts — retry included — must be finished well inside that. */
const DRAFT_BUDGET_MS = 255_000
/** A retry that cannot be given at least this long is not worth starting. */
const MIN_RETRY_MS = 60_000

/** Worth one more go: a timeout, or a 5xx/429 from the vendor. Not a 4xx (a bad request will
 *  be just as bad again), not truncation/blocked/bad-json (a deterministic answer, not a blip). */
function isTransient(reason: string, detail: string): boolean {
  if (reason === 'timeout') return true
  return reason === 'http' && !/HTTP 4(?!29)\d\d/.test(detail)
}

/**
 * The product's own operationalisation of Rumelt's three tests for a guiding policy —
 * BRIEF_25F §6b names two of the three explicitly ("conditions for success and
 * anticipated responses are two of Rumelt's three tests"); the third is leverage, the
 * asymmetry a policy exploits at the pivotal obstacle (page3-config.ts's own field
 * order: leverage, anticipated responses, conditions for success). Stated in full, per
 * §3, rather than assumed known by the model.
 */
export const RUMELT_TESTS_TEXT = [
  "Rumelt's three tests for a guiding policy:",
  '1. LEVERAGE — it exploits a specific asymmetry or pivot point at the pivotal obstacle. '
    + 'Not a goal, not a wish: an approach that concentrates effort where it actually bites.',
  '2. ANTICIPATED RESPONSES — it survives avoidance, gaming, enforcement burden, legal '
    + 'challenge and political attack. A policy nobody will resist has not been examined.',
  '3. CONDITIONS FOR SUCCESS — testable bets, not hopes. What must be true for this to work,',
  'stated so it could be checked.',
  '',
  'A guiding policy is ONE approach, not a list. If it takes "and" to state it, it is a',
  'compound, not a policy — Charlie\'s own example of the failure: "a statutory framework…',
  'enforced by transparent performance management and robust parliamentary oversight" is',
  'three things, not one.',
].join('\n')

export interface ConsolidateContext {
  problem: string
  pivotalObstacle: string
  causes: Array<{ number: number; cause: string }>
  /**
   * §3 — candidates marked part of the solution.
   *
   * ⚠⚠ 26-L ADDENDUM, DECISION 103 ITEM 2 — "CONSOLIDATION READS THE FEEDBACK TEXT."
   * `feedback` is every `PolicyFeedback` row filed against this candidate (chat, card reason
   * box, general box scoped to it), in the user's own words. Before this, feedback was filed
   * and stored but never read by anything — a user could write "don't lose the enforcement
   * point from #7" against a candidate and it would never reach the models drafting from it.
   */
  partOfSolution: Array<{
    number: number; approach: string; caseFor: string | null; caseAgainst: string | null
    feedback: string[]
  }>
  /** §3 — the user's own attempts, distinct from the candidates above: every guiding-policy
   *  candidate the USER personally wrote, whatever its current disposition, so a model does
   *  not propose back something already tried and set aside without knowing it. */
  userAttempts: Array<{ number: number; approach: string }>
  /**
   * ⚠ 26-L ADDENDUM 4 §2 — "START AGAIN" READS THE FEEDBACK TOO. Set only when a consolidation
   * is started FROM a previous one: the user's general comment and their comment on each earlier
   * draft (only drafts they commented on are listed). Stored with the snapshot, so the audit
   * record shows what the four new models were told about the four before them.
   */
  priorRound?: {
    generalFeedback: string | null
    drafts: Array<{ model: string; statement: string; feedback: string }>
  }
}

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    statement: { type: 'string' },
    rulesOut: { type: 'string' },
    fixesCauseNumbers: { type: 'array', items: { type: 'integer' } },
    likelihood: { type: 'string' },
    chainLink: { type: 'string' },
  },
  required: ['statement', 'rulesOut', 'fixesCauseNumbers', 'likelihood', 'chainLink'],
} as const

export interface DraftOutput {
  statement: string
  rulesOut: string
  fixesCauseNumbers: number[]
  likelihood: string
  chainLink: string
}

export function draftSystemPrompt(): string {
  return [
    'You are drafting ONE guiding policy for a Scrutinise idea — the approach that answers the',
    "diagnosed pivotal obstacle. This is Richard Rumelt's sense of the term: not a goal, not a",
    'list of actions, ONE coherent approach.',
    '',
    RUMELT_TESTS_TEXT,
    '',
    'Every field is required:',
    '- statement: the approach, in one or two sentences. ONE approach — if you need "and" to',
    '  join two different mechanisms, you have written two policies, not one.',
    '- rulesOut: what choosing this approach deliberately forecloses. Required on every guiding',
    '  policy, candidate or final — never "nothing" unless you mean it literally rules out',
    '  nothing, which is itself a sign this is not yet a real choice.',
    '- fixesCauseNumbers: the numbered diagnosed causes this approach actually targets.',
    '- likelihood: how likely this is to actually happen — the real obstacles to adoption, not',
    '  a confidence score.',
    '- chainLink: the chain-link warning, where the links bind — "delivered without X, this',
    '  changes nothing."',
    '',
    'No evaluative preamble. Answer in the schema, nothing else.',
  ].join('\n')
}

export function draftUserPrompt(ctx: ConsolidateContext): string {
  const causesBlock = ctx.causes.map((c) => `[${c.number}] ${c.cause}`).join('\n') || '(none recorded)'
  const candidatesBlock = ctx.partOfSolution
    .map((p) => `[${p.number}] ${p.approach}${p.caseFor ? `\n    For: ${p.caseFor}` : ''}${p.caseAgainst ? `\n    Against: ${p.caseAgainst}` : ''}`
      + (p.feedback.length ? `\n    User feedback on this candidate: ${p.feedback.join(' / ')}` : ''))
    .join('\n') || '(none marked part of the solution)'
  const attemptsBlock = ctx.userAttempts.map((a) => `[${a.number}] ${a.approach}`).join('\n') || '(none yet)'

  return [
    `THE PROBLEM: ${ctx.problem}`,
    '',
    `THE PIVOTAL OBSTACLE: ${ctx.pivotalObstacle}`,
    '',
    'THE DIAGNOSED CAUSES:',
    causesBlock,
    '',
    'THE CANDIDATES MARKED PART OF THE SOLUTION:',
    candidatesBlock,
    '',
    "THE USER'S OWN ATTEMPTS AT A GUIDING POLICY (do not simply repeat one of these back;",
    'improve on them, or explain in the statement why a different approach is stronger):',
    attemptsBlock,
    ...(ctx.priorRound && (ctx.priorRound.generalFeedback || ctx.priorRound.drafts.length) ? [
      '',
      'A PREVIOUS ROUND OF DRAFTS WAS WRITTEN AND THE USER COMMENTED ON IT. Write a NEW draft that',
      'takes these comments into account — do not simply repeat an earlier draft. This is feedback on',
      'direction, not an instruction to splice text together:',
      ctx.priorRound.generalFeedback ? `GENERAL COMMENT ON THE ROUND: ${ctx.priorRound.generalFeedback}` : '',
      ...ctx.priorRound.drafts.map((d) => `COMMENT ON THE EARLIER DRAFT BY ${d.model} ("${d.statement}"): ${d.feedback}`),
    ].filter((l) => l !== '') : []),
  ].join('\n')
}

export interface DraftCallResult {
  model: string
  ok: boolean
  value?: DraftOutput
  error?: string
  usage: LlmUsage
  priced: PricedSpend
}

/**
 * §3 — one call per model, in parallel (`Promise.all`, not the sequential loop
 * `build-smart.ts`'s two-vendor panel uses — B3 wants all four premium drafts at once).
 * A model that fails is reported, never silently dropped: the caller sees exactly which
 * of the four came back.
 */
export async function runFourDrafts(
  ctx: ConsolidateContext,
  spend: { ideaId: string; userId?: string | null },
  /** 26-L addendum 2 §1 — "Retry reruns only the models that failed." Defaults to all four
   *  (the original call site), so this is additive, not a second function to keep in step. */
  models: readonly string[] = PREMIUM_DRAFT_MODELS,
): Promise<DraftCallResult[]> {
  const system = draftSystemPrompt()
  const user = draftUserPrompt(ctx)
  const deadline = Date.now() + DRAFT_BUDGET_MS

  const attempt = async (model: string, timeoutMs: number) => {
    const result = await callModelJson<DraftOutput>({
      model,
      system,
      user,
      schema: DRAFT_SCHEMA,
      maxOutputTokens: DRAFT_MAX_OUTPUT_TOKENS,
      timeoutMs,
      reasoningEffort: reasoningEffortFor(model),
      label: `guiding-policy-draft:${model}`,
      stream: 'lex',
      pass: 'guiding-policy.draft',
      ideaId: spend.ideaId, userId: spend.userId ?? null,
    })
    // Gemini/xAI already recorded inside callModelJson (with this attribution); recording again
    // wrote every such draft twice. Claude/GPT do not, so they are recorded here. A call that
    // failed with nothing recorded (a timeout) is written as `failed`, so the cost dashboard
    // shows it rather than a 0-token row that reads as a success.
    const priced = result.usage.recorded ?? await recordUsage(result.usage, {
      stream: 'lex', pass: 'guiding-policy.draft', ideaId: spend.ideaId, userId: spend.userId ?? null,
      failed: !result.ok,
    })
    return { result, priced }
  }

  return Promise.all(
    models.map(async (model): Promise<DraftCallResult> => {
      const { result, priced } = await attempt(model, Math.min(timeoutFor(model), deadline - Date.now()))
      if (!result.ok) {
        // ⚠ `strict: false` — TS will not narrow a union on a boolean discriminant, per the
        // established idiom in reranker.ts/query-expansion.ts.
        const first = result as import('./model-call').LlmFail
        const remaining = deadline - Date.now()
        // One automatic retry on a transient failure, only while it can still finish inside the
        // route's limit. Both attempts are on the ledger; a model that fails twice reports the
        // SECOND failure, with the first noted so the cause is not lost.
        if (isTransient(first.reason, first.detail) && remaining >= MIN_RETRY_MS) {
          console.warn(`[guiding-policy-draft:${model}] ${first.reason} — retrying once (${Math.round(remaining / 1000)}s left in budget)`)
          const second = await attempt(model, Math.min(timeoutFor(model), remaining))
          if (second.result.ok) return { model, ok: true, value: second.result.value, usage: second.result.usage, priced: second.priced }
          const fail2 = second.result as import('./model-call').LlmFail
          return {
            model, ok: false, usage: fail2.usage, priced: second.priced,
            error: `${fail2.reason}: ${fail2.detail} (first attempt also failed: ${first.reason})`,
          }
        }
        return { model, ok: false, error: `${first.reason}: ${first.detail}`, usage: first.usage, priced }
      }
      return { model, ok: true, value: result.value, usage: result.usage, priced }
    }),
  )
}

/**
 * 26-L addendum 5 — the models that did not draft, for the page. Uses what was recorded; for a
 * consolidation from before `failedModels` existed (NULL) it names every model with no draft,
 * saying the reason was not kept, so the Retry button is offered rather than the gap going unseen.
 */
export function effectiveFailedModels(
  stored: unknown, draftModels: readonly string[],
): Array<{ model: string; error: string }> {
  if (Array.isArray(stored)) {
    return (stored as Array<{ model?: unknown; error?: unknown }>)
      .filter((f) => typeof f?.model === 'string' && !draftModels.includes(f.model as string))
      .map((f) => ({ model: f.model as string, error: typeof f.error === 'string' ? f.error : 'no reason recorded' }))
  }
  return PREMIUM_DRAFT_MODELS
    .filter((m) => !draftModels.includes(m))
    .map((m) => ({ model: m, error: 'no draft, and the reason was not recorded' }))
}

/** §6 — the one redraft, by the favourite's model. Same fixed form, briefed with both
 *  feedbacks (the user's, and the judge's on all four) rather than a fresh cold call. */
export async function runRedraft(
  ctx: ConsolidateContext,
  input: {
    favouriteModel: string
    favouriteStatement: string
    userFeedback: string | null
    /** 26-L addendum 4 §2 — the user's comments on individual drafts (only those with one). */
    draftFeedback?: Array<{ model: string; statement: string; feedback: string }>
    judgeFeedback: string
  },
  spend: { ideaId: string; userId?: string | null },
): Promise<DraftCallResult> {
  const system = [
    draftSystemPrompt(),
    '',
    '⚠⚠ NEVER A MERGE. You are the SOLE author of this redraft, informed by four drafts and two',
    'kinds of feedback — not assembling pieces of other drafts. A guiding policy stitched',
    "together from fragments of other people's sentences is a compound by construction.",
  ].join('\n')
  const user = [
    draftUserPrompt(ctx),
    '',
    'YOUR OWN EARLIER DRAFT (you are redrafting this, not starting over):',
    input.favouriteStatement,
    '',
    'WHAT THE USER SAID — their general comment on the four drafts (this is feedback on',
    'direction, not an instruction to splice text together):',
    input.userFeedback?.trim() || '(no general comment given)',
    '',
    "WHAT THE USER SAID ABOUT INDIVIDUAL DRAFTS (each comment is about that draft only):",
    ...((input.draftFeedback?.length)
      ? input.draftFeedback.map((d) => `On ${d.model}'s draft ("${d.statement}"): ${d.feedback}`)
      : ['(no comments on individual drafts)']),
    '',
    "LEX'S OWN JUDGEMENT — which Rumelt tests each of the four drafts failed, and why:",
    input.judgeFeedback,
  ].join('\n')

  const result = await callModelJson<DraftOutput>({
    model: input.favouriteModel,
    system,
    user,
    schema: DRAFT_SCHEMA,
    maxOutputTokens: DRAFT_MAX_OUTPUT_TOKENS,
    timeoutMs: DRAFT_TIMEOUT_MS,
    label: `guiding-policy-redraft:${input.favouriteModel}`,
    stream: 'lex',
    pass: 'guiding-policy.redraft',
    ideaId: spend.ideaId, userId: spend.userId ?? null,
  })
  const priced = result.usage.recorded ?? await recordUsage(result.usage, {
    stream: 'lex', pass: 'guiding-policy.redraft', ideaId: spend.ideaId, userId: spend.userId ?? null,
  })
  if (!result.ok) {
    const fail = result as import('./model-call').LlmFail
    return { model: input.favouriteModel, ok: false, error: `${fail.reason}: ${fail.detail}`, usage: fail.usage, priced }
  }
  return { model: input.favouriteModel, ok: true, value: result.value, usage: result.usage, priced }
}
