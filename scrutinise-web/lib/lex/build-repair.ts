// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-B addendum (Charlie, 17 Sep 2026) — REPAIR AND RETEST, ON THE FIRST PASS.
//
// *"Even on the first pass, if it fails the coherence test it should correct this problem and
// retest."* Until now KERNEL_CHECK and LOGIC_CHECK marked the kernel and wrote each failure to
// the user's list — on both live 26-B builds the run ended *"6 of 9 kernel tests passed; 3
// failed"* / *"the chain does NOT hold; 2 defects"*, and stopped there. This pass runs after the
// two checks: where either failed, it REWRITES the failing fields against the named failures,
// then RE-RUNS BOTH CHECKS on the rewritten kernel. Once. A second cycle would be a loop that
// pays until the marker relents, and the marker is not deterministic (B21a measured LOGIC_CHECK
// flipping on unchanged kernels).
//
// ⚠ WHAT IT MAY AND MAY NOT TOUCH. The same fields the smart critique may rewrite, through the
// same `setProposal` — so an ACCEPTED field gets an OFFER, never an overwrite (the proposer's
// text wins). The three avenues are not its to drop or demote. It may not invent a citation.
//
// ⚠ THE RETEST IS THE PRODUCT, NOT THE REWRITE. A repair that says "fixed" without re-marking
// is the guard that cannot fail. So: original failures that now pass are marked ADDRESSED on the
// user's list with a note saying the repair did it and the retest agreed; ones that still fail
// stay OPEN; ones the retest newly finds are added under this pass's own key. Every rewrite is
// recorded as an evidence row in the revision pass's shape (was saying / now says / why), so the
// proposer can see what moved and reject it.
// ─────────────────────────────────────────────────────────────────────────────

import { callJson, llmFailed, type LlmUsage } from './build-llm'
import { M_GENERAL, M_DIAGNOSIS, M_GUIDING_POLICY, M_COHERENT_ACTIONS } from './method'
import { KERNEL_TESTS, type KernelTestResult, type LogicDefect } from './build-verify'

export const REPAIR_PASS_KEY = 'REPAIR'

/** The fields the repair may rewrite — the smart critique's set, plus the root cause. */
export const REPAIRABLE_FIELDS = [
  'summaryDiagnosis', 'rootCause', 'pivotalObstacle', 'chosenApproach',
  'summaryGuidingPolicy', 'whatItRulesOut', 'summaryCoherentActions',
] as const
export type RepairableField = (typeof REPAIRABLE_FIELDS)[number]

export interface RepairOutput {
  /** The rewrite, field by field. Empty string = leave it. */
  rewrite: Record<RepairableField, string>
  /** One entry per field actually rewritten. */
  changed: Array<{ fieldKey: string; wasSaying: string; nowSays: string; whyChanged: string; fixes: string }>
  /** A failure the repair could not honestly fix, and why — stays on the list. */
  couldNotFix: Array<{ failure: string; why: string }>
}

const REPAIR_SCHEMA = {
  type: 'object',
  properties: {
    rewrite: {
      type: 'object',
      properties: Object.fromEntries(REPAIRABLE_FIELDS.map((k) => [k, { type: 'string' }])),
      required: [...REPAIRABLE_FIELDS],
    },
    changed: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fieldKey: { type: 'string' }, wasSaying: { type: 'string' }, nowSays: { type: 'string' },
          whyChanged: { type: 'string' }, fixes: { type: 'string' },
        },
        required: ['fieldKey', 'wasSaying', 'nowSays', 'whyChanged', 'fixes'],
      },
    },
    couldNotFix: {
      type: 'array',
      items: { type: 'object', properties: { failure: { type: 'string' }, why: { type: 'string' } }, required: ['failure', 'why'] },
    },
  },
  required: ['rewrite', 'changed', 'couldNotFix'],
}

const TIMEOUT_MS = parseInt(process.env.LEX_VERIFY_TIMEOUT_MS ?? '150000', 10)

export function repairModel(): string {
  return process.env.LEX_BUILD_MODEL_REPAIR?.trim() || 'gemini-2.5-pro'
}

export async function runRepair(input: {
  kernel: string
  kernelFailures: KernelTestResult[]
  logicDefects: LogicDefect[]
  chainAsRead: string
  /** The research carry — the only material a rewrite may cite. */
  research: string
  onUsage: (u: LlmUsage) => void
}): Promise<RepairOutput | null> {
  const failures = input.kernelFailures.map((r) => {
    const t = KERNEL_TESTS.find((x) => x.id === r.id)
    return `- KERNEL TEST "${t?.test ?? r.id}" FAILS: ${r.whatFails}${r.theTextThatFails ? ` — the text: "${r.theTextThatFails}"` : ''}`
  })
  const defects = input.logicDefects.map((d) => `- LOGIC ${d.kind}: ${d.problem} — the text: "${d.theText}"`)

  const system = [
    M_GENERAL, '', M_DIAGNOSIS, '', M_GUIDING_POLICY, '', M_COHERENT_ACTIONS,
    '',
    '════ YOU ARE REPAIRING A KERNEL THAT FAILED ITS OWN CHECKS, SO THAT IT CAN BE RE-CHECKED ════',
    '',
    'Two markers have just read this kernel. One marks it against nine tests from the method; the other',
    'traces the argument link by link (causes → pivotal obstacle → approach → actions). The failures',
    'and defects they named are below, each quoting the text at fault. FIX THEM — in the fields, in',
    '`rewrite` — and record each fix in `changed` with the failure it addresses in `fixes`.',
    '',
    '  `rewrite`      — the corrected text, field by field. ⚠ AN EMPTY STRING MEANS "LEAVE IT AS IT IS".',
    '                   Touch only what a named failure requires; a rewrite that changes a field no',
    '                   failure touched is a second opinion, not a repair.',
    '  `changed`      — one entry per field rewritten: what it was saying, what it now says, why, and',
    '                   WHICH failure or defect it fixes (quote its opening words in `fixes`).',
    '  `couldNotFix`  — a failure you cannot honestly fix without inventing something — a cause the',
    '                   evidence does not support, a link that needs a fact nobody has — stays on the',
    '                   proposer\'s list. Say which and why. That is a better answer than a fix that is',
    '                   only wording.',
    '',
    '⚠ RULES THAT DO NOT BEND:',
    '  · GROUNDING. You may reason and you must say when you are; you may NOT invent a citation, a',
    '    statute, a section number, a figure or a case name. The research below is the only material',
    '    you may cite. A logic defect that says "nothing supports this" is fixed by pointing at a',
    '    finding that does, or by weakening the claim to what is supported — never by asserting harder.',
    '  · THE THREE AVENUES ARE THE PROPOSER\'S TO CHOOSE BETWEEN. Do not drop, defer or demote the',
    '    legislative, organisational or financial route in any rewrite; the plan may say which steps',
    '    belong to which, and that is all.',
    '  · THE PROPOSER\'S OWN ACCOUNT IS EVIDENCE. Do not remove a cause or a claim because it rests on',
    '    their testimony; testimony is support.',
    '  · Never carry over an example, a subject or a figure from these instructions or from any other',
    '    proposal.',
  ].join('\n')

  const result = await callJson<RepairOutput>({
    model: repairModel(),
    system,
    user: [
      '═══ THE KERNEL, AS IT STANDS ═══',
      input.kernel || '(nothing drafted)',
      '',
      '═══ WHAT FAILED ═══',
      ...(failures.length ? failures : ['(every kernel test passed)']),
      ...(defects.length ? defects : ['(the chain held)']),
      input.chainAsRead ? `\nThe argument as the logic marker read it: ${input.chainAsRead}` : '',
      '',
      '═══ WHAT THE RESEARCH FOUND (the only material you may cite) ═══',
      input.research || '(nothing)',
    ].join('\n'),
    schema: REPAIR_SCHEMA,
    maxOutputTokens: parseInt(process.env.LEX_REPAIR_TOKENS ?? '12000', 10),
    timeoutMs: TIMEOUT_MS,
    temperature: 0.2,
    label: 'build-repair',
  })
  input.onUsage(result.usage)
  if (llmFailed(result)) {
    console.error('[26b:repair] the repair did not complete', { reason: result.reason, detail: result.detail?.slice(0, 300) })
    return null
  }
  const v = result.value
  return {
    rewrite: Object.fromEntries(REPAIRABLE_FIELDS.map((k) => [k, String(v.rewrite?.[k] ?? '').trim()])) as Record<RepairableField, string>,
    changed: (v.changed ?? []).filter((c) => c?.fieldKey?.trim() && c?.nowSays?.trim()),
    couldNotFix: (v.couldNotFix ?? []).filter((c) => c?.failure?.trim()),
  }
}
