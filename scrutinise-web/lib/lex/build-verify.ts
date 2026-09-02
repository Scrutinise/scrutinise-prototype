// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-F §3 — NOTHING VERIFIES ANYTHING. TWO PASSES THAT DO.
//
// ⚠ THE GAP, STATED PRECISELY. The build's only reviewing pass is the hostile clerk
// (ADVERSARIAL), and it asks "where is this weak?". That is a lesser question than the one
// nobody was asking: **is this a kernel at all?** A proposal can survive a hostile reading
// and still be a wish with an action list under it — the clerk will find the weakest point
// of the wish rather than noticing it is one.
//
// So two passes, and they are deliberately different in kind:
//
//   3a KERNEL COMPLIANCE — MECHANICAL, against the method layer (§16.3 / method.ts). Nine
//      named tests, each with a yes/no answer and, where the answer is no, THE TEXT THAT
//      FAILS IT quoted back. This is the standard the product claims to hold users to; it
//      should not be a cheap pass and it does not run on the cheapest model.
//
//   3b LOGICAL CONSISTENCY — does the CHAIN hold: causes → obstacle → approach → actions?
//      Non-sequiturs, circularity, claims that do not follow, assertions with no support.
//
// ⚠ WHY THEY ARE NOT ONE PASS. They fail differently and a reader needs to be able to tell
// them apart. "Your guiding policy rules nothing out" is a defect in the STRATEGY; "your
// third action does not follow from any cause you named" is a defect in the ARGUMENT. One
// merged verdict would let a model trade one against the other, and the commonest way to
// score well on a merged rubric is to be vague about both.
//
// ⚠ AND THEY DO NOT REWRITE. §2's smart pass has the rewrite mandate and runs before these,
// so by the time they run the kernel is the one the user will see. These two REPORT — every
// failure becomes a `DeepeningIssue` on the list the user works through. A pass that both
// judges and fixes has an obvious incentive to judge gently.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { callJson, llmFailed, type LlmUsage } from './build-llm'
import { strategyTestHeading } from './reader-language'
import { M_GENERAL, M_DIAGNOSIS, M_GUIDING_POLICY, M_COHERENT_ACTIONS } from './method'

const TIMEOUT_MS = parseInt(process.env.LEX_BUILD_TIMEOUT_MS ?? '90000', 10)

/**
 * §2e — "adversarial and verification passes do not run on the cheapest one."
 *
 * ⚠ THIS IS ENFORCED, NOT REQUESTED. `assertNotTheCheapest` below throws if configuration
 * points a verification pass at the house default, because the whole reason §3 exists is
 * that the adversarial read had quietly been running on `gemini-2.5-flash` and producing
 * 407 output tokens for six issues. A rule that lives only in a comment is the rule that
 * was already being broken.
 */
export const CHEAPEST_MODEL = 'gemini-2.5-flash'

export function verifyModel(which: 'KERNEL_CHECK' | 'LOGIC_CHECK'): string {
  return (
    process.env[`LEX_BUILD_MODEL_${which}`]?.trim()
    || process.env.LEX_BUILD_MODEL_VERIFY?.trim()
    || 'gemini-2.5-pro'
  )
}

// ── §3a — kernel compliance ──────────────────────────────────────────────────

/**
 * The tests, as data.
 *
 * ⚠ THEY ARE A LIST HERE AND NOT PROSE IN A PROMPT so that the CHECK can assert every one
 * of them reached the model, and so that a test added later is one array entry. A rubric
 * embedded in a paragraph is a rubric nobody can count.
 */
export interface KernelTest {
  id: string
  /** The test, as the user reads it when it fails. */
  test: string
  /** What the model is actually being asked. */
  ask: string
}

export const KERNEL_TESTS: KernelTest[] = [
  {
    id: 'PROBLEM_IS_A_PROBLEM',
    test: 'The problem is stated as a problem, not as a solution',
    ask:
      'Is `THE PROBLEM` a statement of what is WRONG, for whom, and why it matters — or is it a remedy '
      + 'in disguise? "The charge for plastic bags should be higher" is a solution; "too many bags are '
      + 'still used because the charge no longer changes behaviour" is a problem. A problem stated as a '
      + 'solution has already chosen the answer before the diagnosis was written.',
  },
  {
    id: 'OBSTACLE_DISTINCT',
    test: 'The pivotal obstacle is distinct from the root cause',
    ask:
      'The ROOT CAUSE explains why the problem HAPPENS. The PIVOTAL OBSTACLE explains why it PERSISTS '
      + 'UNSOLVED — usually enforcement failure, a coordination gap, a cost nobody will bear, or a party '
      + 'who benefits from the status quo. Are these two genuinely different findings, or is the '
      + 'obstacle a restatement of the cause in other words?',
  },
  {
    id: 'DIAGNOSIS_SIMPLIFIES',
    test: 'The diagnosis simplifies rather than inventories',
    ask:
      'Could a reader say in ONE SENTENCE what must be defeated for anything else to matter? Or is the '
      + 'diagnosis a list of everything that is wrong, with nothing named as pivotal?',
  },
  {
    id: 'POLICY_RULES_OUT',
    test: 'The guiding policy rules things out',
    ask:
      'Name something this guiding policy FORBIDS. If it is compatible with any action anyone might '
      + 'take, it is not a policy — it is a sentiment. Quote the text that does the ruling out, or say '
      + 'plainly that there is none.',
  },
  {
    id: 'POLICY_NOT_A_GOAL',
    test: 'The guiding policy is an approach, not a goal',
    ask:
      'Is this an APPROACH to the obstacle, or is it a restatement of the desired outcome? "Establish a '
      + 'framework that makes officials accountable" is a goal wearing a policy\'s clothes; "shift the '
      + 'accountability from the department to a named individual at the point the money is committed" '
      + 'is an approach.',
  },
  {
    id: 'HAS_LEVERAGE',
    test: 'The approach has leverage on the named obstacle',
    ask:
      'Does the approach hit the PIVOTAL OBSTACLE specifically, or does it act nearby? Name the '
      + 'asymmetry or pivot point it exploits. An approach that would be equally sensible against a '
      + 'different obstacle has no leverage on this one.',
  },
  {
    id: 'ACTIONS_DEFEAT_CAUSES',
    test: 'The actions defeat the diagnosed causes',
    ask:
      'Take each MATERIAL cause in turn. Which action defeats it? A cause with no action against it, or '
      + 'an action that answers no cause, is the failure this test exists to find — name it either way.',
  },
  {
    id: 'ACTIONS_COHERE',
    test: 'The actions cohere with each other',
    ask:
      'Are these coordinated, or a list? Check CONCENTRATION (do they pull in one direction, or is '
      + 'effort smeared?), SEQUENCING (does anything depend on something that comes after it?), and '
      + 'IMPLEMENTERS (is there a step with nobody named to do it?).',
  },
  {
    id: 'NO_BAD_STRATEGY_SMELL',
    test: 'No bad-strategy smell',
    ask:
      'Rumelt\'s four: FLUFF (abstract language dressing an ordinary idea as a profound one), FAILURE TO '
      + 'FACE THE PROBLEM (the hard part is never named), GOALS MISTAKEN FOR STRATEGY (a list of things '
      + 'to achieve with no route to them), IMPRACTICABLE OBJECTIVES (targets nobody could hit). Say '
      + 'which if any is present, and QUOTE the text that smells of it.',
  },
]

export interface KernelTestResult {
  id: string
  passes: boolean
  /** Where it fails: what is wrong, in a sentence a proposer can act on. */
  whatFails: string
  /** The text that fails it, quoted from the kernel. Empty when the test passes. */
  theTextThatFails: string
}

export interface KernelComplianceResult {
  results: KernelTestResult[]
  /** The one-sentence verdict. Not a score: a score invites averaging a failure away. */
  verdict: string
}

const COMPLIANCE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string' },
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          passes: { type: 'boolean' },
          whatFails: { type: 'string' },
          theTextThatFails: { type: 'string' },
        },
        required: ['id', 'passes', 'whatFails', 'theTextThatFails'],
      },
    },
  },
  required: ['verdict', 'results'],
}

export async function runKernelCompliance(input: {
  kernel: string
  model?: string
  onUsage: (u: LlmUsage) => void
}): Promise<KernelComplianceResult | null> {
  const model = input.model ?? verifyModel('KERNEL_CHECK')
  const system = [
    M_GENERAL, '', M_DIAGNOSIS, '', M_GUIDING_POLICY, '', M_COHERENT_ACTIONS,
    '',
    '════ YOU ARE MARKING A KERNEL AGAINST A FIXED SET OF TESTS ════',
    '',
    'This is not a review and it is not a critique. It is a CHECKLIST, and each item has a yes or a no.',
    'Answer every one of the tests below, using its `id` exactly.',
    '',
    ...KERNEL_TESTS.map((t) => [
      `[id=${t.id}] ${t.test}`,
      `    ${t.ask}`,
    ].join('\n')),
    '',
    '⚠ WHERE A TEST FAILS, `theTextThatFails` MUST QUOTE THE KERNEL. Not a paraphrase and not a summary:',
    'the actual words, so the proposer can look at the sentence and see it for themselves. A failure with',
    'no quotation is an opinion, and an opinion is what this pass exists to replace.',
    '',
    '⚠ WHERE A TEST PASSES, say so and leave `theTextThatFails` empty. Do not manufacture a failure to',
    'look rigorous; a checklist that never passes anything tells the proposer nothing about which parts',
    'are sound.',
    '',
    '⚠ AND DO NOT SOFTEN. This is the standard the product tells users it holds them to. A kernel that',
    'fails six of nine should be told it fails six of nine — that is a more useful morning than a',
    'generous mark and a surprise at a committee.',
  ].join('\n')

  const result = await callJson<KernelComplianceResult>({
    model,
    system,
    user: `═══ THE KERNEL ═══\n${input.kernel || '(nothing drafted)'}`,
    schema: COMPLIANCE_SCHEMA,
    maxOutputTokens: parseInt(process.env.LEX_VERIFY_TOKENS ?? '10000', 10),
    timeoutMs: TIMEOUT_MS,
    temperature: 0.1,
    label: 'kernel-compliance',
  })
  input.onUsage(result.usage)

  if (llmFailed(result)) {
    console.error('[25f:verify] the kernel-compliance pass did not complete', {
      model, reason: result.reason, detail: result.detail?.slice(0, 300),
    })
    return null
  }

  // ⚠ A TEST THE MODEL DID NOT ANSWER IS NOT A TEST THAT PASSED. Silence on a checklist
  // item reads as a pass to every downstream reader, which is the fail-open shape this
  // codebase keeps removing — so the absence is reported as an unrun test.
  const answered = new Set((result.value.results ?? []).map((r) => r.id))
  const unrun = KERNEL_TESTS.filter((t) => !answered.has(t.id))
  if (unrun.length) {
    console.warn('[25f:verify] the compliance pass skipped tests — reported, not treated as passes', {
      model, skipped: unrun.map((t) => t.id),
    })
  }

  return {
    verdict: String(result.value.verdict ?? '').trim(),
    results: [
      ...(result.value.results ?? []).filter((r) => r?.id && KERNEL_TESTS.some((t) => t.id === r.id)),
      ...unrun.map((t) => ({
        id: t.id,
        passes: false,
        whatFails: `This test was not answered by ${model}, so it is UNRUN rather than passed. `
          + `The kernel has not been checked against "${t.test}".`,
        theTextThatFails: '',
      })),
    ],
  }
}

// ── §3b — logical consistency ────────────────────────────────────────────────

export interface LogicDefect {
  kind: 'NON_SEQUITUR' | 'CIRCULAR' | 'UNSUPPORTED' | 'BROKEN_LINK'
  /** The link or claim at fault, quoted from the kernel. */
  theText: string
  /** What is wrong with it, in a sentence. */
  problem: string
}

export interface LogicResult {
  chainHolds: boolean
  /** The chain as this pass reads it: causes → obstacle → approach → actions. */
  chainAsRead: string
  defects: LogicDefect[]
}

const LOGIC_SCHEMA = {
  type: 'object',
  properties: {
    chainHolds: { type: 'boolean' },
    chainAsRead: { type: 'string' },
    defects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['NON_SEQUITUR', 'CIRCULAR', 'UNSUPPORTED', 'BROKEN_LINK'] },
          theText: { type: 'string' },
          problem: { type: 'string' },
        },
        required: ['kind', 'theText', 'problem'],
      },
    },
  },
  required: ['chainHolds', 'chainAsRead', 'defects'],
}

export async function runLogicCheck(input: {
  kernel: string
  model?: string
  onUsage: (u: LlmUsage) => void
}): Promise<LogicResult | null> {
  const model = input.model ?? verifyModel('LOGIC_CHECK')
  const system = [
    M_GENERAL,
    '',
    '════ YOU ARE CHECKING WHETHER THE ARGUMENT HOLDS ════',
    '',
    'Not whether it is a good idea, not whether it will pass, and not whether it is well written.',
    'Whether the CHAIN holds:',
    '',
    '    causes  →  pivotal obstacle  →  approach  →  actions',
    '',
    'Trace it link by link and write what you traced in `chainAsRead`, in your own words. That paragraph',
    'is the most useful thing here: a proposer who reads their own argument written back to them by',
    'somebody following it literally finds the break themselves half the time.',
    '',
    'Then report every defect, each QUOTING the text at fault:',
    '  `NON_SEQUITUR` — the conclusion does not follow from what precedes it.',
    '  `CIRCULAR`     — the claim rests on itself. "Accountability is poor because officials are not',
    '                   accountable" is the shape.',
    '  `UNSUPPORTED`  — an assertion with nothing behind it: no finding, no cited source, no reasoning',
    '                   shown. ⚠ An assertion the proposer made FROM THEIR OWN EXPERIENCE is SUPPORTED —',
    '                   testimony is evidence. Do not report first-hand experience as unsupported.',
    '  `BROKEN_LINK`  — a link in the chain that simply is not there: an action answering no cause, a',
    '                   cause nothing acts on, an obstacle the approach never touches.',
    '',
    '⚠ `chainHolds` IS FALSE IF ANY LINK IS BROKEN. It is not an average and it is not a vote. A chain',
    'with one broken link does not hold, and saying otherwise is exactly the kind of rounding that lets',
    'a proposal reach a committee with a hole in it.',
    '',
    '⚠ QUOTE, DO NOT PARAPHRASE. `theText` is the actual words from the kernel. A defect the proposer',
    'cannot locate in their own document is a defect they cannot fix.',
  ].join('\n')

  const result = await callJson<LogicResult>({
    model,
    system,
    user: `═══ THE KERNEL ═══\n${input.kernel || '(nothing drafted)'}`,
    schema: LOGIC_SCHEMA,
    maxOutputTokens: parseInt(process.env.LEX_VERIFY_TOKENS ?? '10000', 10),
    timeoutMs: TIMEOUT_MS,
    temperature: 0.1,
    label: 'logic-check',
  })
  input.onUsage(result.usage)

  if (llmFailed(result)) {
    console.error('[25f:verify] the logic pass did not complete', {
      model, reason: result.reason, detail: result.detail?.slice(0, 300),
    })
    return null
  }
  return {
    chainHolds: !!result.value.chainHolds,
    chainAsRead: String(result.value.chainAsRead ?? '').trim(),
    defects: (result.value.defects ?? []).filter((d) => d?.theText?.trim() && d?.problem?.trim()),
  }
}

// ── Persistence — every failure becomes an issue ─────────────────────────────

/**
 * §3 — "Each failure is an issue naming the text that fails it."
 *
 * ⚠ ISSUES, NOT EVIDENCE. A failed test is not a finding about the world; it is a thing
 * for the proposer to do. The issues list is what they work through, and putting these on
 * it is what makes the difference between a critique that was written and one that was
 * acted on.
 */
export async function recordVerificationIssues(input: {
  ideaId: string
  buildVersion: number
  passKey: string
  issues: Array<{ text: string }>
}): Promise<number> {
  let written = 0
  for (const i of input.issues) {
    const text = i.text.trim()
    if (!text) continue
    await prisma.deepeningIssue.create({
      data: {
        ideaId: input.ideaId,
        passKey: input.passKey,
        runVersion: input.buildVersion,
        text,
        status: 'OPEN',
      },
    })
    written++
  }
  return written
}

/** The issue text for a failed kernel test. Quotes the kernel, because §3 requires it. */
export function complianceIssueText(t: KernelTest, r: KernelTestResult): string {
  return [
    // ⚠ 25-V §3a — WAS `KERNEL TEST FAILED — …`, in capitals, 32 times in the printed report.
    // See `reader-language.ts`: the verdict is unchanged, the reader can now tell it is a
    // judgement about the strategy rather than an error in our software.
    strategyTestHeading(t.test),
    r.whatFails.trim(),
    r.theTextThatFails.trim() ? `The text that fails it: "${r.theTextThatFails.trim()}"` : '',
  ].filter(Boolean).join(' ')
}

/** The issue text for a logic defect. */
export function logicIssueText(d: LogicDefect): string {
  const label: Record<LogicDefect['kind'], string> = {
    NON_SEQUITUR: 'THE CONCLUSION DOES NOT FOLLOW',
    CIRCULAR: 'THIS CLAIM RESTS ON ITSELF',
    UNSUPPORTED: 'NOTHING SUPPORTS THIS CLAIM',
    BROKEN_LINK: 'A LINK IN THE CHAIN IS MISSING',
  }
  return `${label[d.kind]} — ${d.problem.trim()} The text: "${d.theText.trim()}"`
}
