// ─────────────────────────────────────────────────────────────────────────────
// 26-N §1/§2 — WHEN A GUIDING POLICY IS SETTLED, THE FIELDS THAT BELONG TO IT FOLLOW.
//
// Charlie, after accepting his final version: Chosen approach still showed an orange circle, "What it rules
// out" read "Waiting on Chosen approach", and Leverage and Anticipated responses still described the policy
// he had just replaced. Settling set `PolicyOption.status = CHOSEN` and `Idea.chosenApproach` — and never
// touched the Chosen approach FIELD, so everything downstream of that field stayed where it was.
//
// This runs from the settle EVENT (`applyPolicyOp('settle')` and `choosePolicyApproach`), alongside the
// coherent-action step (lib/lex/action-ideas.ts), so no route can settle a policy and skip it.
//
//   1. ACCEPT the Chosen approach field with the policy's statement — settled, the field shows complete.
//   2. FILL the matching fields from the final version's own sections (§2a): Rules out → What it rules out.
//   3. MARK STALE the fields written for the policy that was replaced (§2c), WITH A REASON.
//   4. REDRAFT Leverage, Anticipated responses and Conditions for success against the accepted policy,
//      from the final version's likelihood and "if only part is delivered" as well as its statement.
//
// ⚠⚠ EVERY REDRAFT IS A PROPOSAL, AND A FIELD THE USER HAS TOUCHED NEVER HAS ITS TEXT REPLACED.
// `offerRedraft` (lib/lex/field-machine.ts) puts the redraft BESIDE any field that holds the user's words and
// only becomes the pending proposal where there are none. His Leverage edit stands.
// ⚠ NOTHING HERE ACCEPTS A REDRAFT. The only acceptance is the Chosen approach field, which IS the settle.
// ⚠ BEST-EFFORT AND IDEMPOTENT: a failure is reported and changes nothing the user wrote; running it again
// for the same policy spends nothing and writes nothing.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { acceptField, offerRedraft, markFieldStale } from './field-machine'
import { callModelJson } from './model-call'
import { recordUsage } from './spend-ledger'
import { ANTICIPATED_RESPONSE_SLOTS } from './page3-config'

export interface PolicyFieldsResult {
  ok: boolean
  error?: string
  chosenAccepted: boolean
  /** What happened to each field the step touched: proposed | beside | unchanged | skipped-field | stale-only. */
  fields: Record<string, string>
  costPence: number | null
}

const REDRAFT_FIELDS = ['leverage', 'anticipatedResponses', 'conditionsForSuccess'] as const

const SCHEMA = {
  type: 'object',
  properties: {
    leverage: { type: 'string' },
    anticipatedResponses: {
      type: 'object',
      properties: Object.fromEntries(ANTICIPATED_RESPONSE_SLOTS.map((k) => [k, { type: 'string' }])),
      required: [...ANTICIPATED_RESPONSE_SLOTS],
    },
    conditionsForSuccess: { type: 'string' },
  },
  required: ['leverage', 'anticipatedResponses', 'conditionsForSuccess'],
}

const SYSTEM = [
  'You redraft three parts of a policy proposal against a guiding policy the user has just ACCEPTED.',
  '',
  'The guiding policy is the approach that deals with the pivotal obstacle. Redraft, for THIS policy:',
  '  leverage              — why this approach hits the pivotal obstacle specifically: the asymmetry or pivot point it',
  '                          exploits, and why it concentrates effort there. 3–6 sentences.',
  '  anticipatedResponses  — how people will respond to THIS policy, one short paragraph per slot: avoidance, gaming,',
  '                          enforcementBurden, legalChallenge, politicalAttack. Concrete, about this policy.',
  '  conditionsForSuccess  — what must be true for it to work: testable bets, not hopes. A short list, one per line.',
  '                          Include the condition the "if only part is delivered" warning implies.',
  '',
  'You are also given the CURRENT wording of each (written for an earlier policy). Where it still holds, keep it —',
  'especially the user\'s own points and specifics; change what no longer fits, above all the SCOPE (who and what the',
  'policy now covers). Do not invent evidence, figures, cases or statutes: reason from the policy and the problem.',
  'Plain British English, no headings, no preamble.',
].join('\n')

const asText = (v: unknown): string => {
  if (v == null) return ''
  if (typeof v === 'string') {
    try { const o = JSON.parse(v); if (o && typeof o === 'object') return Object.entries(o).map(([k, x]) => `${k}: ${x}`).join('\n') } catch { /* plain */ }
    return v
  }
  return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${String(x)}`).join('\n')
}

/**
 * The step. `previousNumber` is the policy that was settled before this one (for the reason text), if any.
 */
export async function applyAcceptedPolicyToKernel(
  ideaId: string, policyId: string, userId: string | null, previousNumber?: number | null,
): Promise<PolicyFieldsResult> {
  const out: PolicyFieldsResult = { ok: true, chosenAccepted: false, fields: {}, costPence: null }
  try {
    const policy = await prisma.policyOption.findFirst({ where: { id: policyId, ideaId } })
    if (!policy) return { ...out, ok: false, error: 'The policy is not on this idea.' }
    const mark = `Drafted against guiding policy #${policy.number}.`

    // ── 1. THE FIELD IS ACCEPTED: this is what "settled" looks like to everything downstream ──
    const chosen = await prisma.ideaFieldState.findUnique({
      where: { ideaId_fieldKey: { ideaId, fieldKey: 'chosenApproach' } }, select: { status: true, value: true },
    })
    if (chosen?.status !== 'ACCEPTED' || chosen.value !== policy.approach) {
      await acceptField(ideaId, userId ?? '', 'chosenApproach', policy.approach)
      out.chosenAccepted = true
    }

    // ── 2. THE FINAL VERSION'S OWN SECTIONS → THEIR FIELDS (§2a), beside anything already there ──
    if (policy.rulesOut?.trim()) {
      out.fields.whatItRulesOut = await offerRedraft(ideaId, 'whatItRulesOut', {
        value: policy.rulesOut.trim(), againstPolicyId: policy.id,
        rationale: `What the accepted final version rules out. ${mark}`,
      })
    }

    // ── 3. STALE, WITH A REASON: written for the policy that was replaced (§2c) ──
    const staleReason = `Written before your guiding policy was settled${previousNumber != null ? ` — it was drafted for #${previousNumber}` : ''}, not for the one you accepted (#${policy.number}), which may cover something different.`
    for (const k of ['leverage', 'anticipatedResponses', 'summaryGuidingPolicy'] as const) await markFieldStale(ideaId, k, staleReason)

    // ── 4. REDRAFT AGAINST THE ACCEPTED POLICY — all three, as proposals ──
    const rows = await prisma.ideaFieldState.findMany({
      where: { ideaId, fieldKey: { in: [...REDRAFT_FIELDS] } }, select: { fieldKey: true, value: true, proposal: true, redraft: true },
    })
    const already = (k: string) => {
      const r = rows.find((x) => x.fieldKey === k)
      const rd = r?.redraft as { againstPolicyId?: string } | null
      const pr = r?.proposal as { rationale?: string } | null
      return rd?.againstPolicyId === policy.id || !!pr?.rationale?.includes(mark)
    }
    if (REDRAFT_FIELDS.every(already)) { out.fields.redraft = 'already-done'; return out }

    const [idea, causes] = await Promise.all([
      prisma.idea.findUnique({ where: { id: ideaId }, select: { challenge: true, summaryDescription: true, pivotalObstacle: true } }),
      prisma.diagnosisCause.findMany({ where: { ideaId }, orderBy: { number: 'asc' }, select: { number: true, cause: true } }),
    ])
    const current = (k: string) => {
      const r = rows.find((x) => x.fieldKey === k)
      const pr = r?.proposal as { value?: unknown } | null
      return asText(r?.value || pr?.value) || '(nothing yet)'
    }
    const user = [
      `THE PROBLEM: ${idea?.challenge?.trim() || idea?.summaryDescription?.trim() || '(not recorded)'}`,
      `THE PIVOTAL OBSTACLE: ${idea?.pivotalObstacle?.trim() || '(not recorded)'}`,
      `CAUSES:\n${causes.map((c) => `  [${c.number}] ${c.cause}`).join('\n') || '  (none recorded)'}`,
      '',
      `THE ACCEPTED GUIDING POLICY (#${policy.number}): ${policy.approach}`,
      policy.rulesOut ? `What it rules out: ${policy.rulesOut}` : '',
      policy.likelihood ? `How likely it is to be carried through: ${policy.likelihood}` : '',
      policy.chainLink ? `What fails if only part is delivered: ${policy.chainLink}` : '',
      '',
      'CURRENT WORDING (written for an earlier policy):',
      `leverage: ${current('leverage')}`,
      `anticipatedResponses:\n${current('anticipatedResponses')}`,
      `conditionsForSuccess: ${current('conditionsForSuccess')}`,
    ].filter(Boolean).join('\n')

    const result = await callModelJson<{ leverage: string; anticipatedResponses: Record<string, string>; conditionsForSuccess: string }>({
      model: 'gemini-2.5-pro', system: SYSTEM, user, schema: SCHEMA,
      maxOutputTokens: 6000, timeoutMs: 90_000, temperature: 0.3, reasoningEffort: 'medium',
      label: 'guiding-policy-field-redraft', stream: 'lex', pass: 'guiding-policy.fields-redraft', ideaId, userId,
    })
    const priced = result.usage.recorded ?? await recordUsage(result.usage, {
      stream: 'lex', pass: 'guiding-policy.fields-redraft', ideaId, userId, failed: !result.ok,
    })
    out.costPence = priced.pence ?? null
    if (!result.ok) {
      const fail = result as { reason: string; detail: string }
      console.error('[policy-fields] redraft failed', { ideaId, reason: fail.reason })
      // The stale marks stand — the user is told the fields are out of date even though no redraft arrived.
      return { ...out, ok: false, error: `${fail.reason}: ${fail.detail}` }
    }

    const v = result.value
    const why = (k: string) => `Redrafted against your accepted guiding policy (#${policy.number}), from its statement${policy.likelihood || policy.chainLink ? ', its likelihood and what fails if only part is delivered' : ''}. ${mark}`
    const clean = (s: unknown) => String(s ?? '').trim()
    if (clean(v.leverage)) out.fields.leverage = await offerRedraft(ideaId, 'leverage', { value: clean(v.leverage), againstPolicyId: policy.id, rationale: why('leverage') })
    if (v.anticipatedResponses && ANTICIPATED_RESPONSE_SLOTS.every((k) => clean(v.anticipatedResponses[k]))) {
      out.fields.anticipatedResponses = await offerRedraft(ideaId, 'anticipatedResponses', {
        value: Object.fromEntries(ANTICIPATED_RESPONSE_SLOTS.map((k) => [k, clean(v.anticipatedResponses[k])])),
        againstPolicyId: policy.id, rationale: why('anticipatedResponses'),
      })
    }
    if (clean(v.conditionsForSuccess)) out.fields.conditionsForSuccess = await offerRedraft(ideaId, 'conditionsForSuccess', { value: clean(v.conditionsForSuccess), againstPolicyId: policy.id, rationale: why('conditionsForSuccess') })

    console.log('[policy-fields] applied', { ideaId, policy: policy.number, fields: out.fields, chosenAccepted: out.chosenAccepted, costPence: out.costPence })
    return out
  } catch (err) {
    console.error('[policy-fields] THREW', { ideaId, error: err instanceof Error ? err.message : err })
    return { ...out, ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * ══ THE ONE EVENT HANDLER: "A GUIDING POLICY WAS SETTLED" ══════════════════════════════════════
 *
 * Both halves — the kernel fields (this file) and the coherent actions (action-ideas.ts) — run from here, so a
 * route that settles a policy cannot run one and forget the other. They are independent, so they run together.
 * Never throws.
 */
export async function onGuidingPolicySettled(
  ideaId: string, policyId: string, userId: string | null, previousNumber?: number | null,
) {
  const { onChosenApproachSettled } = await import('./action-ideas')
  const [policyFields, actionIdeas] = await Promise.all([
    applyAcceptedPolicyToKernel(ideaId, policyId, userId, previousNumber),
    onChosenApproachSettled(ideaId, policyId, userId),
  ])
  return { policyFields, actionIdeas }
}
