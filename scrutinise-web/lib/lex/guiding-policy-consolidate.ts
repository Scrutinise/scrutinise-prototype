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
  /** §3 — candidates marked part of the solution. */
  partOfSolution: Array<{ number: number; approach: string; caseFor: string | null; caseAgainst: string | null }>
  /** §3 — the user's own attempts, distinct from the candidates above: every guiding-policy
   *  candidate the USER personally wrote, whatever its current disposition, so a model does
   *  not propose back something already tried and set aside without knowing it. */
  userAttempts: Array<{ number: number; approach: string }>
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

function draftSystemPrompt(): string {
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

function draftUserPrompt(ctx: ConsolidateContext): string {
  const causesBlock = ctx.causes.map((c) => `[${c.number}] ${c.cause}`).join('\n') || '(none recorded)'
  const candidatesBlock = ctx.partOfSolution
    .map((p) => `[${p.number}] ${p.approach}${p.caseFor ? `\n    For: ${p.caseFor}` : ''}${p.caseAgainst ? `\n    Against: ${p.caseAgainst}` : ''}`)
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
): Promise<DraftCallResult[]> {
  const system = draftSystemPrompt()
  const user = draftUserPrompt(ctx)

  return Promise.all(
    PREMIUM_DRAFT_MODELS.map(async (model): Promise<DraftCallResult> => {
      const result = await callModelJson<DraftOutput>({
        model,
        system,
        user,
        schema: DRAFT_SCHEMA,
        maxOutputTokens: 1024,
        timeoutMs: 60_000,
        label: `guiding-policy-draft:${model}`,
        stream: 'lex',
        pass: 'guiding-policy.draft',
      })
      const priced = await recordUsage(result.usage, {
        stream: 'lex', pass: 'guiding-policy.draft', ideaId: spend.ideaId, userId: spend.userId ?? null,
      })
      if (!result.ok) {
        // ⚠ `strict: false` — TS will not narrow a union on a boolean discriminant, per the
        // established idiom in reranker.ts/query-expansion.ts. `result.ok === false` is
        // already established on this line.
        const fail = result as import('./model-call').LlmFail
        return { model, ok: false, error: `${fail.reason}: ${fail.detail}`, usage: fail.usage, priced }
      }
      return { model, ok: true, value: result.value, usage: result.usage, priced }
    }),
  )
}

/** §6 — the one redraft, by the favourite's model. Same fixed form, briefed with both
 *  feedbacks (the user's, and the judge's on all four) rather than a fresh cold call. */
export async function runRedraft(
  ctx: ConsolidateContext,
  input: {
    favouriteModel: string
    favouriteStatement: string
    userFeedback: string | null
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
    'WHAT THE USER SAID — what worked and did not, across all four drafts (this is feedback on',
    'direction, not an instruction to splice text together):',
    input.userFeedback?.trim() || '(no feedback given)',
    '',
    "LEX'S OWN JUDGEMENT — which Rumelt tests each of the four drafts failed, and why:",
    input.judgeFeedback,
  ].join('\n')

  const result = await callModelJson<DraftOutput>({
    model: input.favouriteModel,
    system,
    user,
    schema: DRAFT_SCHEMA,
    maxOutputTokens: 1024,
    timeoutMs: 60_000,
    label: `guiding-policy-redraft:${input.favouriteModel}`,
    stream: 'lex',
    pass: 'guiding-policy.redraft',
  })
  const priced = await recordUsage(result.usage, {
    stream: 'lex', pass: 'guiding-policy.redraft', ideaId: spend.ideaId, userId: spend.userId ?? null,
  })
  if (!result.ok) {
    const fail = result as import('./model-call').LlmFail
    return { model: input.favouriteModel, ok: false, error: `${fail.reason}: ${fail.detail}`, usage: fail.usage, priced }
  }
  return { model: input.favouriteModel, ok: true, value: result.value, usage: result.usage, priced }
}
