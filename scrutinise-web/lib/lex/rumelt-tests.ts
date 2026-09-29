// ─────────────────────────────────────────────────────────────────────────────
// 26-I §4 — THE JUDGE. "Four polished sentences from four models will all sound like
// guiding policies. Charlie has read Rumelt several times and finds it hard to apply —
// the user is choosing between checked sentences, not plausible ones."
//
// Addendum B2: the judge is a premium-model job — the only guard between a weak draft
// and an Accept. The compound test is made deterministic where it can be; the obstacle
// test (and the causes-attacked judgement it needs) runs as ONE BATCHED CALL over every
// candidate, never one call per candidate.
//
// §4a asked which half is which. The answer, and the reason it splits there:
//   - COMPOUND and RULES-OUT-NOTHING are mechanical. Counting joined clauses and reading
//     an empty/placeholder rules-out string need no judgement call.
//   - ANSWERS THE OBSTACLE and WHICH CAUSES IT ACTUALLY ATTACKS are semantic. Only a
//     model can read a sentence against a stated obstacle and a set of causes and say
//     whether it is really aimed at either.
// ─────────────────────────────────────────────────────────────────────────────

import { callModelJson, type LlmUsage } from './model-call'
import { recordUsage, type PricedSpend } from './spend-ledger'

export interface CompoundTest {
  isCompound: boolean
  why: string
}

/**
 * ⚠ DETERMINISTIC, ON PURPOSE (B2). Splits on top-level "and"/";" joins (parenthetical
 * asides removed first, so they can't be mistaken for a second clause) and flags a
 * compound when two or more of the resulting pieces are substantial (3+ words each) —
 * the exact shape of Charlie's own example: *"a statutory framework… enforced by
 * transparent performance management and robust parliamentary oversight"* is three
 * substantial things joined by "and".
 *
 * This is a mechanical heuristic, not a parser — it will occasionally flag a genuinely
 * single approach that happens to use "and" (a compound cause list is not a compound
 * policy) and occasionally miss a compound with no "and"/";" in it at all (e.g. joined
 * by a comma alone). It is the mechanical HALF of the test; nothing here claims to
 * replace a reader.
 */
export function testIsCompound(statement: string): CompoundTest {
  const trimmed = (statement || '').trim()
  if (!trimmed) return { isCompound: false, why: '' }

  const withoutAsides = trimmed.replace(/\([^)]*\)/g, ' ')
  const parts = withoutAsides
    .split(/\s*;\s*|,?\s+and\s+/i)
    .map((s) => s.trim())
    .filter(Boolean)
  const substantial = parts.filter((p) => p.split(/\s+/).filter(Boolean).length >= 3)

  if (substantial.length >= 2) {
    return {
      isCompound: true,
      // ⚠ 26-L addendum 3 §6 — NEVER PRINT THE PIECES. 26-L §6b: a sentence split on "and" is not
      // to be presented as fragments; the split cannot tell two approaches from one approach with
      // a compound object ("project and service"), so quoting the pieces asserts a division the
      // check has not established. The reason is one line, and it says what was and was not found.
      why: `The wording joins ${substantial.length} substantial clauses with "and"/";" — worth re-reading `
        + 'to check it is one approach and not two (a check on wording only; it may be a single approach with a compound object).',
    }
  }
  return { isCompound: false, why: '' }
}

/**
 * ⚠ DETERMINISTIC (B2). "Rules out: nothing — this is a compound" (§4) is the wording
 * when a draft's own rules-out field is blank or a placeholder ("nothing", "n/a",
 * "none") rather than naming something the approach genuinely forecloses.
 */
export function testRulesOutNothing(rulesOut: string): boolean {
  const t = (rulesOut || '').trim().toLowerCase()
  if (!t) return true
  if (/^(nothing|none|n\/?a|not applicable|no-?op)\b/.test(t)) return true
  return t.length < 8
}

export interface DraftForJudge {
  /** Position in the batch — how results are matched back to their card. Not the
   *  PolicyOption/candidate number; the judge sees a batch, not the sort. */
  index: number
  model: string
  statement: string
  rulesOut: string
  /** What the draft ITSELF claims it fixes — compared against the judge's own
   *  independent reading (`causesAttackedByJudge`) for `causesMatch`. */
  fixesCauseNumbers: number[]
}

export interface JudgeVerdict {
  index: number
  isCompound: boolean
  compoundWhy: string
  rulesOutNothing: boolean
  /** The semantic half — a model call. */
  answersObstacle: { verdict: boolean; why: string }
  causesAttackedByJudge: number[]
  causesMatch: boolean
}

export interface JudgeContext {
  pivotalObstacle: string
  causes: Array<{ number: number; cause: string }>
}

/** The one premium model used for the judge — see the report this feeds (26-I §4a/B2):
 *  reported here as a named export, not buried in the call site, so "which model did
 *  the judging" is one grep away rather than a fact only the call site knows. */
export const JUDGE_MODEL = 'claude-opus-5'

const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          index: { type: 'integer' },
          answersObstacle: {
            type: 'object',
            properties: {
              verdict: { type: 'boolean' },
              why: { type: 'string' },
            },
            required: ['verdict', 'why'],
          },
          causesAttackedByJudge: { type: 'array', items: { type: 'integer' } },
        },
        required: ['index', 'answersObstacle', 'causesAttackedByJudge'],
      },
    },
  },
  required: ['verdicts'],
} as const

function judgeSystemPrompt(): string {
  return [
    'You are the adversarial judge in a guiding-policy consolidation step, applying Richard',
    "Rumelt's tests. You are handed several candidate guiding-policy statements in one batch.",
    'For EACH one, independently:',
    '1. Decide whether it genuinely answers the stated pivotal obstacle — not whether it sounds',
    '   confident or well-written, whether it is actually aimed at that specific obstacle.',
    '2. Read which of the numbered causes it actually attacks, from your own reading of the',
    '   statement — not from any list the draft itself claims. If it attacks none, return an',
    '   empty array.',
    'No evaluative preamble. No praise for the drafting. Answer only the two questions, per index.',
  ].join('\n')
}

function judgeUserPrompt(ctx: JudgeContext, drafts: DraftForJudge[]): string {
  const causesBlock = ctx.causes.map((c) => `[${c.number}] ${c.cause}`).join('\n')
  const draftsBlock = drafts
    .map((d) => `--- Candidate ${d.index} ---\nStatement: ${d.statement}\nClaims it fixes causes: ${d.fixesCauseNumbers.join(', ') || '(none stated)'}`)
    .join('\n\n')
  return [
    `The pivotal obstacle: ${ctx.pivotalObstacle}`,
    '',
    'The diagnosed causes:',
    causesBlock || '(none recorded)',
    '',
    'The candidates to judge:',
    draftsBlock,
  ].join('\n')
}

/**
 * §4/B2 — one premium-model call, judging every draft in the batch at once. Mechanical
 * tests (compound, rules-out-nothing) are computed here in code and merged in; only the
 * obstacle test and the judge's own cause-attribution come from the model.
 *
 * Returns the priced cost of this one call (§3/§4a: "report the cost per judge pass").
 */
export async function judgeDrafts(
  ctx: JudgeContext,
  drafts: DraftForJudge[],
  spend: { ideaId: string; userId?: string | null; pass: string },
): Promise<
  | { ok: true; verdicts: JudgeVerdict[]; usage: LlmUsage; model: string; priced: PricedSpend }
  | { ok: false; reason: string; usage: LlmUsage; model: string }
> {
  const mechanical = new Map(
    drafts.map((d) => [d.index, { isCompound: testIsCompound(d.statement), rulesOutNothing: testRulesOutNothing(d.rulesOut) }]),
  )

  const result = await callModelJson<{ verdicts: Array<{ index: number; answersObstacle: { verdict: boolean; why: string }; causesAttackedByJudge: number[] }> }>({
    model: JUDGE_MODEL,
    system: judgeSystemPrompt(),
    user: judgeUserPrompt(ctx, drafts),
    schema: JUDGE_SCHEMA,
    maxOutputTokens: 2048,
    timeoutMs: 45_000,
    label: 'guiding-policy-judge',
    stream: 'lex',
    pass: spend.pass,
    ideaId: spend.ideaId, userId: spend.userId ?? null,
  })

  const priced = result.usage.recorded ?? await recordUsage(result.usage, {
    stream: 'lex', pass: spend.pass, ideaId: spend.ideaId, userId: spend.userId ?? null,
  })

  if (!result.ok) {
    // ⚠ `strict: false` — TS will not narrow on the boolean `ok` discriminant (established
    // idiom, see reranker.ts/query-expansion.ts). `result.ok === false` on this line already.
    const fail = result as import('./model-call').LlmFail
    return { ok: false, reason: `${fail.reason}: ${fail.detail}`, usage: fail.usage, model: JUDGE_MODEL }
  }

  const byIndex = new Map(result.value.verdicts.map((v) => [v.index, v]))
  const verdicts: JudgeVerdict[] = drafts.map((d) => {
    const m = mechanical.get(d.index)!
    const semantic = byIndex.get(d.index)
    const causesAttackedByJudge = semantic?.causesAttackedByJudge ?? []
    const claimed = new Set(d.fixesCauseNumbers)
    const attacked = new Set(causesAttackedByJudge)
    const causesMatch = claimed.size === attacked.size && [...claimed].every((n) => attacked.has(n))
    return {
      index: d.index,
      isCompound: m.isCompound.isCompound,
      compoundWhy: m.isCompound.why,
      rulesOutNothing: m.rulesOutNothing,
      answersObstacle: semantic?.answersObstacle ?? { verdict: false, why: 'The judge returned no verdict for this candidate.' },
      causesAttackedByJudge,
      causesMatch,
    }
  })

  return { ok: true, verdicts, usage: result.usage, model: JUDGE_MODEL, priced }
}
