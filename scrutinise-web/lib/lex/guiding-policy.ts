// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-P §1 — THE GUIDING POLICY BECOMES A DECISION, NOT A LIST.
//
// ⚠⚠ THE WALKTHROUGH FINDING THIS ANSWERS: *"How do I choose? Do I have to choose one only?
// What if I want parts of others built in?"* — and there was no answer anywhere on screen.
//
// ⚠⚠ TWO MEASUREMENTS SHAPE EVERYTHING BELOW, AND BOTH CONTRADICT AN ASSUMPTION IN THE BRIEF.
// Measured on idea 452c5ade, 1 Sept 2026:
//
//   1. **THE 18 CANDIDATES ARE SIX BUILDS × THREE, APPENDED.** `createPolicyOptions` never
//      deletes and `revisePass` never touches policy rows. The list is the UNION OF SIX RUNS,
//      full of near-duplicates. So the sort's first job is not classification, it is noticing
//      that "Enhance parliamentary oversight…" is on the list three times in different words.
//
//   2. ⚠⚠ **`targetCauseIds` IS SET ON ZERO OF EIGHTEEN.** §1.5 says cluster "read off the
//      causal chain". The column that would carry that link exists, is declared, and **no pass
//      has ever written it** — CLAUDE.md §24's schema-permits ≠ prompt-requires, fourth
//      instance. So the cluster CANNOT read a structural fact; the sort has to ASSIGN the link,
//      and it is a model judgement that must be labelled as one rather than presented as
//      derived from evidence.
//
// ── RUMELT, FOLLOWED RATHER THAN IMPROVISED ───────────────────────────────────
//
// A guiding policy **rules out as many options as it rules in**. It is the approach to the
// obstacles named in the diagnosis — a signpost marking direction without defining the details
// of the trip. Coherent actions are the feasible, coordinated commitments that carry it out.
// ⚠ The single most common defect in a generated list is **a coherent action wearing a guiding
// policy's clothes**, which is why §1.2's three tests exist and why verdict 2 in §1.7 is
// expected to be the most common.
//
// The reduction is **collect → cluster → filter**, and the filter is two SEPARATE judgements —
// importance and addressability — never combined into a score. Rumelt is explicit that the
// discipline is not to spread effort across all of them.
// ─────────────────────────────────────────────────────────────────────────────

import { callJson, llmFailed, type LlmUsage } from './build-llm'
import { M_GUIDING_POLICY, M_COHERENT_ACTIONS } from './method'

/** §1.2's three outcomes. */
export type PolicyKind = 'GUIDING_POLICY' | 'COHERENT_ACTION' | 'GOAL_RESTATEMENT'

/** ⚠ §1.6 — where a judgement came from. `NOT_FOUND` is an answer, not a gap to fill. */
export type RatingBasis = 'REASONED' | 'RETRIEVED' | 'NOT_FOUND'

export interface Rating {
  /** A short phrase a user can disagree with. Never a number, never a colour. */
  verdict: string
  why: string
  basis: RatingBasis
}

export interface SortedPolicy {
  /** The stable number this row already carries. The model is told it, and echoes it back. */
  number: number
  kind: PolicyKind
  /** ⚠ REQUIRED. §1.2: "visible, not silent" — a reclassification with no reason is a
   *  disappearance as far as the user is concerned. */
  kindReason: string
  /**
   * ⚠⚠ §1.5 — WHICH CAUSE THIS ATTACKS, ASSIGNED BECAUSE NOTHING HAS EVER WRITTEN IT.
   * The cause's own number from the list the model is given, or null where none fits.
   */
  targetCauseNumbers: number[]
  /** §1.4 — a cause this policy needs that the diagnosis does not have. Null on most items. */
  impliedCause: { cause: string; why: string } | null
  /** §1.3 — where this is an action, the number of the policy it implements. */
  implementsPolicyNumber: number | null
  /**
   * ⚠ FINDING 1 — the numbers of other items this one duplicates. The list is six builds
   * appended; saying so is more useful than classifying the same policy three times.
   */
  duplicateOfNumbers: number[]
  importance: Rating
  addressability: Rating
}

const RATING_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string' },
    why: { type: 'string' },
    basis: { type: 'string', enum: ['REASONED', 'RETRIEVED', 'NOT_FOUND'] },
  },
  required: ['verdict', 'why', 'basis'],
}

const SORT_SCHEMA = {
  type: 'object',
  properties: {
    policies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          number: { type: 'integer' },
          kind: { type: 'string', enum: ['GUIDING_POLICY', 'COHERENT_ACTION', 'GOAL_RESTATEMENT'] },
          kindReason: { type: 'string' },
          targetCauseNumbers: { type: 'array', items: { type: 'integer' } },
          impliedCause: {
            type: 'object',
            properties: { cause: { type: 'string' }, why: { type: 'string' } },
            required: ['cause', 'why'],
          },
          implementsPolicyNumber: { type: 'integer' },
          duplicateOfNumbers: { type: 'array', items: { type: 'integer' } },
          importance: RATING_SCHEMA,
          addressability: RATING_SCHEMA,
        },
        required: ['number', 'kind', 'kindReason', 'targetCauseNumbers',
                   'duplicateOfNumbers', 'importance', 'addressability'],
      },
    },
  },
  required: ['policies'],
}

/**
 * ⚠⚠ THE INSTRUCTION IS PROSE, AND CLAUDE.md §24 IS WHY THIS COMMENT EXISTS. `required` in the
 * schema guarantees the KEY is present and nothing else; `""` and `[]` satisfy it for ever. Four
 * times this repo has shipped a required field with no prose behind it. So every field that
 * carries a JUDGEMENT is explained at length, and the empty answer is given an explicit,
 * harder path than the full one.
 */
const SORT_SYSTEM = [
  M_GUIDING_POLICY, '', M_COHERENT_ACTIONS, '',
  '════ YOU ARE SORTING A LIST OF CANDIDATE GUIDING POLICIES ════',
  '',
  'A user has a list of candidate approaches and no way to choose between them. Before they can',
  'choose, the list has to be told apart: some of these are guiding policies, some are actions',
  'wearing a policy’s clothes, and some are the goal restated.',
  '',
  '⚠ APPLY THESE THREE TESTS TO EVERY ITEM, IN ORDER:',
  '',
  '  1. DOES IT RULE THINGS OUT? A guiding policy closes doors. If it closes none, it is a GOAL',
  '     restated — "improve accountability" rules nothing out and is not a policy.',
  '  2. CAN SEVERAL DIFFERENT ACTIONS BE DERIVED FROM IT? If so it is a POLICY. If the item IS',
  '     the thing you do, it is an ACTION.',
  '  3. DOES IT NAME AN INSTRUMENT, A BODY, A DATE OR AN AMOUNT? "Amend s.12 of the 2014 Act" is',
  '     an ACTION. "Move accountability from the department to the frontline body" is a POLICY.',
  '',
  '⚠⚠ THE MOST COMMON DEFECT IN A LIST LIKE THIS IS A COHERENT ACTION WEARING A GUIDING POLICY’S',
  'CLOTHES. Expect to reclassify several. Do not be shy of it — but give a REASON the user can',
  'argue with, naming the test it failed and quoting the words that fail it.',
  '',
  '⚠⚠ THIS LIST IS AN ACCUMULATION, NOT A CONSIDERED SET. It was appended to by several separate',
  'runs, so it contains NEAR-DUPLICATES in different words. Where two or more items say',
  'substantially the same thing, put the other numbers in `duplicateOfNumbers` on each of them.',
  'That is often the most useful thing you can tell the user about the list.',
  '',
  '⚠ `targetCauseNumbers` — WHICH DIAGNOSED CAUSE DOES THIS ATTACK? You are given the causes,',
  'numbered. A policy that attacks none of them is either misaimed or points at a cause the',
  'diagnosis has not got — see the next paragraph. Use the numbers you are given, and only those.',
  '',
  '⚠⚠ `impliedCause` — THE MOST VALUABLE FIELD HERE, AND THE ONE TO LEAVE NULL MOST OFTEN.',
  'Set it ONLY where the policy plainly answers a cause that is NOT in the numbered list, and the',
  'mismatch is clear rather than arguable. Then either the policy does not belong, or the',
  'DIAGNOSIS IS INCOMPLETE — and the second is far more often true. Say what the missing cause is',
  'in one sentence, as a cause ("information reaching ministers is filtered before it arrives"),',
  'not as a complaint. ⚠ Leave it NULL on every item where the policy maps to a cause you were',
  'given. It must not fire on everything; a suggestion on every item is a suggestion nobody reads.',
  '',
  '⚠ `implementsPolicyNumber` — set ONLY on an item you classified COHERENT_ACTION, naming the',
  'policy in this same list that it carries out. Null if none of them does.',
  '',
  '════ THE TWO RATINGS, WHICH ARE SEPARATE JUDGEMENTS AND MUST NOT BE BLENDED ════',
  '',
  '  importance     — how much of the diagnosed problem would this actually fix?',
  '  addressability — how likely is it actually to happen? Parliamentary time, money, whether',
  '                   the power already exists, whether something similar has failed before.',
  '',
  '⚠ `verdict` IS A SHORT PHRASE, NOT A NUMBER AND NOT A GRADE. "Fixes the central cause",',
  '"Touches a symptom", "Needs primary legislation and a Bill slot". The user must be able to',
  'disagree with it in words.',
  '',
  '⚠⚠ `basis` IS THE FIELD A REVIEWER WILL ATTACK FIRST, SO BE HONEST WITH IT:',
  '    RETRIEVED  — you are relying on something in the material you were given. Say what.',
  '    REASONED   — this is your judgement from the structure of the problem. Legitimate.',
  '    NOT_FOUND  — you have nothing to go on. ⚠ THIS IS AN ANSWER. Where the material says',
  '                 nothing about whether a comparable measure ever passed, say NOT_FOUND rather',
  '                 than estimating. An invented likelihood is worse than an admitted gap.',
  '',
  '⚠ AND DO NOT SOFTEN. A list of eighteen in which everything is important and everything is',
  'achievable tells the user nothing and is the opposite of the discipline this exists to apply.',
].join('\n')

const TIMEOUT_MS = parseInt(process.env.LEX_POLICY_TIMEOUT_MS ?? '120000', 10)

/** Sort, rate and cluster the list. Null when the pass could not complete. */
export async function sortPolicies(input: {
  material: string
  model: string
  onUsage: (u: LlmUsage) => void
}): Promise<SortedPolicy[] | null> {
  const out = await callJson<{ policies: SortedPolicy[] }>({
    model: input.model,
    system: SORT_SYSTEM,
    user: input.material,
    schema: SORT_SCHEMA,
    maxOutputTokens: parseInt(process.env.LEX_POLICY_TOKENS ?? '12000', 10),
    timeoutMs: TIMEOUT_MS,
    temperature: 0.2,
    label: 'policy-sort',
  })
  input.onUsage(out.usage)
  if (llmFailed(out)) {
    console.error('[25p:policy] the sort did not complete', {
      model: input.model, reason: out.reason, detail: out.detail?.slice(0, 300),
    })
    return null
  }
  // ⚠ THE VALUE IS CHECKED AT THE BOUNDARY. A sort that returns rows with no reason is a
  // reclassification the user cannot argue with, which §1.2 forbids — so those rows are dropped
  // rather than shown, and the count is logged so the loss is visible.
  const rows = (out.value.policies ?? []).filter(
    (p) => Number.isInteger(p?.number) && p.kindReason?.trim() && p.importance?.verdict?.trim(),
  )
  if (rows.length !== (out.value.policies ?? []).length) {
    console.warn('[25p:policy] dropped sort rows with no reason or no rating', {
      returned: out.value.policies?.length, kept: rows.length,
    })
  }
  return rows.length ? rows : null
}

// ═══════════════════════════════════════════════════════════════════════════════
// §1.7 — THE FOUR VERDICTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ⚠ A CLOSED SET OF FOUR. The user types "merge 4 and 8" and gets exactly one of these back
 * with its reasoning — never a paragraph that leaves them unsure what happened.
 */
export type MergeVerdict = 'MERGE' | 'ONE_CONTAINS_THE_OTHER' | 'SEQUENCE' | 'CONTRADICTORY'

export interface MergeAnswer {
  verdict: MergeVerdict
  /** Why, in the user's own vocabulary. Required on every verdict including MERGE. */
  reasoning: string
  /**
   * ⚠ §1.7 verdict 1 — A MERGE PRODUCES A NEW POLICY WRITTEN AS ONE THING, NOT TWO PARAGRAPHS
   * JOINED. Rumelt's point that design work is strategy work: the obvious first answer — "do
   * both" — is rarely the best, and a merged policy that reads as a list is that answer.
   */
  merged: { approach: string; caseFor: string; caseAgainst: string } | null
  /**
   * ⚠⚠ §1.8 — WHERE THE MERGED POLICY'S LINKS EACH BIND, WHAT HAPPENS IF ONLY PART IS
   * DELIVERED. A legislature takes the easy half of a proposal and leaves the hard half; this
   * sentence is the warning, and it is the first thing cut for length unless it is marked.
   */
  chainLink: string | null
  /** On ONE_CONTAINS_THE_OTHER: which number is the action. On SEQUENCE: which goes later. */
  subordinateNumber: number | null
}

const MERGE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: {
      type: 'string',
      enum: ['MERGE', 'ONE_CONTAINS_THE_OTHER', 'SEQUENCE', 'CONTRADICTORY'],
    },
    reasoning: { type: 'string' },
    merged: {
      type: 'object',
      properties: {
        approach: { type: 'string' },
        caseFor: { type: 'string' },
        caseAgainst: { type: 'string' },
      },
      required: ['approach', 'caseFor', 'caseAgainst'],
    },
    chainLink: { type: 'string' },
    subordinateNumber: { type: 'integer' },
  },
  required: ['verdict', 'reasoning'],
}

const MERGE_SYSTEM = [
  M_GUIDING_POLICY, '', M_COHERENT_ACTIONS, '',
  '════ THE USER HAS ASKED YOU TO MERGE TWO CANDIDATE POLICIES ════',
  '',
  'Answer with exactly ONE of four verdicts, and the reasoning for it.',
  '',
  '  MERGE',
  '      They attack DIFFERENT LINKS OF THE SAME CAUSAL CHAIN and each is necessary. Write the',
  '      merged policy in `merged`.',
  '      ⚠⚠ A MERGE PRODUCES ONE POLICY WRITTEN AS ONE THING — NOT TWO PARAGRAPHS JOINED WITH',
  '      "and". If your merged text contains "as well as" or reads as a list of two, you have not',
  '      done the design work: find the single approach of which both were partial statements.',
  '      ⚠ Then set `chainLink`: what happens if only ONE half is delivered. If the answer is',
  '      "it still mostly works", this was probably not a merge.',
  '',
  '  ONE_CONTAINS_THE_OTHER',
  '      One of them is a COHERENT ACTION of the other — the thing you would DO to carry the',
  '      other out. ⚠ EXPECT THIS TO BE THE MOST COMMON VERDICT. Put the action’s number in',
  '      `subordinateNumber`.',
  '',
  '  SEQUENCE',
  '      Both are real policies, on UNRELATED causes. Combining them widens the Bill and lowers',
  '      its chance of passing. Say which should go first and put the LATER one’s number in',
  '      `subordinateNumber`.',
  '',
  '  CONTRADICTORY',
  '      They cannot both be true — you cannot centralise and devolve the same power. ⚠ Say',
  '      WHICH TWO THINGS cannot both hold, specifically. Do not merely say they conflict.',
  '',
  '⚠⚠ A LEGISLATIVE POLICY AND AN OPERATIONAL POLICY COMBINING IS **NOT** A CONTRADICTION AND NOT',
  'AN ERROR. A statutory duty plus the performance regime that makes it bite is a genuine chain',
  'and is normally MERGE or ONE_CONTAINS_THE_OTHER. Do not refuse it.',
  '',
  '⚠ Write for the person who typed the instruction. They referred to these by number; use the',
  'numbers back.',
].join('\n')

export async function judgeMerge(input: {
  material: string
  model: string
  onUsage: (u: LlmUsage) => void
}): Promise<MergeAnswer | null> {
  const out = await callJson<MergeAnswer>({
    model: input.model,
    system: MERGE_SYSTEM,
    user: input.material,
    schema: MERGE_SCHEMA,
    maxOutputTokens: parseInt(process.env.LEX_POLICY_MERGE_TOKENS ?? '3000', 10),
    timeoutMs: TIMEOUT_MS,
    temperature: 0.3,
    label: 'policy-merge',
  })
  input.onUsage(out.usage)
  if (llmFailed(out)) {
    console.error('[25p:policy] the merge judgement did not complete', {
      model: input.model, reason: out.reason, detail: out.detail?.slice(0, 300),
    })
    return null
  }
  const a = out.value
  if (!a?.verdict || !a.reasoning?.trim()) return null
  // ⚠ A `MERGE` VERDICT WITH NO MERGED TEXT IS NOT A MERGE. Accepting it would leave the user
  // with a verdict and nothing to show for it — the "control that cannot fail" shape, in a
  // model answer. Reported as an incomplete judgement rather than applied.
  if (a.verdict === 'MERGE' && !a.merged?.approach?.trim()) {
    console.warn('[25p:policy] MERGE returned with no merged policy — refused', { model: input.model })
    return null
  }
  return a
}

// ═══════════════════════════════════════════════════════════════════════════════
// §1.5 — THE CLUSTER. PURE, SO A CHECK CAN ASSERT IT WITHOUT A MODEL CALL.
// ═══════════════════════════════════════════════════════════════════════════════

/** §1.5's four relationships, derived from which cause each policy attacks. */
export type Relationship =
  /** Same cause, incompatible means → one of them wins. */
  | 'ALTERNATIVES'
  /** Different links of one chain → candidates to merge; each necessary, none sufficient. */
  | 'CHAIN'
  /** Unrelated branches → not complementary but DISPERSIVE. Sequence, do not combine. */
  | 'DISPERSIVE'

export interface Pairing {
  a: number
  b: number
  relationship: Relationship
  /** The plain sentence the screen shows. */
  why: string
}

/**
 * Which policies relate to which, from the causes each attacks and the chain they sit on.
 *
 * ⚠⚠ PURE, AND THAT IS DELIBERATE. §1.12 requires checks that assert rendered data; a pure
 * function over a small input is the one part of this feature a check can exercise exhaustively
 * without a model call and without a database. The model assigns the CAUSES; this decides what
 * follows from them, and the rule is written down rather than asked for.
 *
 * ⚠ AND "DISPERSIVE" IS THE HONEST NAME. Two policies on unrelated branches are often described
 * as complementary, which invites combining them; Rumelt's point is that spreading effort across
 * unrelated fronts is the failure, not the strategy. The word on screen has to carry that.
 */
export function pairPolicies(
  policies: Array<{ number: number; causeNumbers: number[] }>,
  /** cause number → the number of the cause that DRIVES it, from the causal chain. */
  drivenBy: Map<number, number | null>,
): Pairing[] {
  const out: Pairing[] = []
  /** Walk up the chain from a cause to its roots. Bounded, so a cycle cannot hang it. */
  const ancestry = (c: number): Set<number> => {
    const seen = new Set<number>([c])
    let cur = drivenBy.get(c) ?? null
    let guard = 0
    while (cur != null && !seen.has(cur) && guard++ < 50) {
      seen.add(cur)
      cur = drivenBy.get(cur) ?? null
    }
    return seen
  }

  for (let i = 0; i < policies.length; i++) {
    for (let j = i + 1; j < policies.length; j++) {
      const A = policies[i]
      const B = policies[j]
      if (!A.causeNumbers.length || !B.causeNumbers.length) continue

      const shared = A.causeNumbers.filter((c) => B.causeNumbers.includes(c))
      if (shared.length) {
        out.push({
          a: A.number, b: B.number, relationship: 'ALTERNATIVES',
          why: `Both attack cause ${shared.join(' and ')}. They are alternative means to the same `
            + 'end, so one of them wins — combining them spends twice for one effect.',
        })
        continue
      }

      // Different causes: are they on one chain, or on unrelated branches?
      const onOneChain = A.causeNumbers.some((ca) => {
        const up = ancestry(ca)
        return B.causeNumbers.some((cb) => up.has(cb) || ancestry(cb).has(ca))
      })
      out.push(onOneChain
        ? {
            a: A.number, b: B.number, relationship: 'CHAIN',
            why: 'They attack different links of one causal chain. Each is necessary and neither '
              + 'is sufficient — these are the candidates worth merging.',
          }
        : {
            a: A.number, b: B.number, relationship: 'DISPERSIVE',
            why: 'They attack unrelated branches of the diagnosis. That is not complementary — it '
              + 'is dispersive: doing both widens the proposal and weakens each. Sequence them '
              + 'rather than combining them.',
          })
    }
  }
  return out
}

/**
 * §1.1 — the next free number. ⚠ ONE PAST THE HIGHEST EVER USED, not `count + 1`.
 *
 * A rejected 7 leaves a gap and `count + 1` would hand 7 out again to a different policy — so
 * the user's note saying "we rejected 7" would come to describe something else. The merged
 * policy in §1.7 takes "the lowest unused number", which is what this returns once gaps below
 * the maximum are ignored: a reused gap is exactly the collision the stable numbering exists
 * to prevent.
 */
export function nextNumber(existing: Array<{ number: number | null }>): number {
  const max = existing.reduce((n, p) => Math.max(n, p.number ?? 0), 0)
  return max + 1
}
