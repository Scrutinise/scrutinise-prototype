// ─────────────────────────────────────────────────────────────────────────────
// 26-I ADDENDUM A1-A4 — THE GUIDING POLICY, FED FROM CHAT, ON DECISION 92'S PATTERN.
//
// A2: "The platform files, Lex reports — decision 92's pattern. Feedback given in chat is
// filed against the candidates it names before Lex replies, and Lex confirms what was
// filed." Modelled directly on lib/lex/chat-material.ts: identification is MECHANICAL
// (a candidate number in the text, the same grammar the instruction box already uses —
// "merge 4 and 8"), filing happens BEFORE the model is called, and Lex is handed only the
// outcome to report — never asked to decide what happened or whether to act.
//
// A3/A4 are prompt-level rules rather than a further mechanism: Lex never produces a
// guiding policy as chat prose, and when asked for "the" guiding policy reports the sort
// and feedback counts and points at Consolidate — both stated in `guidingPolicyChatRules`
// below, always present while the chat is on the Guiding Policy page.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { GUIDING_POLICY_FIELDS } from './page3-config'
import { readPolicyState } from './guiding-policy-state'

const GUIDING_POLICY_FIELD_KEYS = new Set(GUIDING_POLICY_FIELDS.map((f) => f.key))

/** Whether the chat's current field puts it on the Guiding Policy page. */
export function isGuidingPolicyContext(fieldKey: string | null | undefined): boolean {
  return !!fieldKey && GUIDING_POLICY_FIELD_KEYS.has(fieldKey)
}

// The same grammar the instruction box already teaches ("merge 4 and 8"): a number
// following "candidate"/"policy"/"option"/"number", or a bare "#4". A bare digit with no
// such marker is NOT treated as a reference — "I've read 3 versions of this" must not
// misfire against candidate 3.
const CANDIDATE_REF_RE = /(?:\b(?:candidate|policy|option|number)s?\s*#?\s*(\d+))|(?:#(\d+)\b)/gi

export function candidateNumbersIn(message: string): number[] {
  const nums = new Set<number>()
  const re = new RegExp(CANDIDATE_REF_RE)
  let m: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(message))) {
    const n = Number(m[1] ?? m[2])
    if (Number.isFinite(n)) nums.add(n)
  }
  return Array.from(nums)
}

export interface FiledFeedbackResult {
  outcome: 'not-guiding-policy' | 'filed-general' | 'filed-against-candidates' | 'named-unknown-numbers'
  candidateNumbers?: number[]
  unmatchedNumbers?: number[]
}

/**
 * A1/A2 — file whatever the user just said about guiding policies, before Lex is called.
 * Never throws: a feedback record that fails to write is a platform fault to log, not a
 * reason to block the turn.
 */
export async function fileChatPolicyFeedback(
  ideaId: string, fieldKey: string | null | undefined, message: string,
): Promise<FiledFeedbackResult> {
  if (!isGuidingPolicyContext(fieldKey)) return { outcome: 'not-guiding-policy' }

  try {
    const mentioned = candidateNumbersIn(message)
    if (mentioned.length === 0) {
      await prisma.policyFeedback.create({ data: { ideaId, source: 'LEX_CHAT', text: message } })
      return { outcome: 'filed-general' }
    }

    const rows = await prisma.policyOption.findMany({
      where: { ideaId, number: { in: mentioned } }, select: { id: true, number: true },
    })
    const byNumber = new Map(rows.map((r) => [r.number, r.id]))
    const matched = mentioned.filter((n) => byNumber.has(n))
    const unmatched = mentioned.filter((n) => !byNumber.has(n))

    if (matched.length === 0) {
      // Named numbers that don't exist — file as general rather than lose the feedback,
      // and let Lex's reply say plainly that the number(s) named don't match anything.
      await prisma.policyFeedback.create({ data: { ideaId, source: 'LEX_CHAT', text: message } })
      return { outcome: 'named-unknown-numbers', unmatchedNumbers: unmatched }
    }

    await Promise.all(matched.map((n) =>
      prisma.policyFeedback.create({ data: { ideaId, policyOptionId: byNumber.get(n)!, source: 'LEX_CHAT', text: message } }),
    ))
    return {
      outcome: 'filed-against-candidates',
      candidateNumbers: matched,
      unmatchedNumbers: unmatched.length ? unmatched : undefined,
    }
  } catch (err) {
    console.error('[policy-feedback-chat] filing THREW', { ideaId, error: err instanceof Error ? err.message : err })
    return { outcome: 'not-guiding-policy' }
  }
}

/** A2 — the report Lex is handed, never asked to compose the facts of. */
export function policyFeedbackFiledBlock(result: FiledFeedbackResult): string | null {
  if (result.outcome === 'not-guiding-policy') return null
  if (result.outcome === 'filed-general') {
    return 'GUIDING-POLICY FEEDBACK FILED THIS TURN (the platform already filed it, as general '
      + 'feedback, not about one candidate): confirm this plainly in your reply. Never re-ask for '
      + 'it or say you will file it — it is already filed.'
  }
  if (result.outcome === 'named-unknown-numbers') {
    return `GUIDING-POLICY FEEDBACK: candidate number(s) ${result.unmatchedNumbers!.join(', ')} named `
      + 'in that message do not exist on this idea, so the feedback was filed as general instead. '
      + 'Say plainly which number(s) did not match — never guess what they meant.'
  }
  // filed-against-candidates
  const lines = [
    `GUIDING-POLICY FEEDBACK FILED THIS TURN (the platform already filed it — confirm this `
      + `plainly; never re-ask for it or offer to file it): filed against candidate`
      + `${result.candidateNumbers!.length === 1 ? '' : 's'} ${result.candidateNumbers!.join(', ')}.`,
  ]
  if (result.unmatchedNumbers?.length) {
    lines.push(`Number(s) also named that do not exist on this idea: ${result.unmatchedNumbers.join(', ')} — say so.`)
  }
  return lines.join('\n')
}

/**
 * A3/A4 — standing rules for the whole time the chat is on the Guiding Policy page, not
 * only on a turn that filed something. A4 needs real numbers to report, so this reads the
 * current sort/feedback state rather than leaving Lex to invent them (docs/CLAUDE.md §24 —
 * a field the model has no data for is a field it will guess at).
 */
export async function guidingPolicyChatRules(ideaId: string, fieldKey: string | null | undefined): Promise<string | null> {
  if (!isGuidingPolicyContext(fieldKey)) return null
  const state = await readPolicyState(ideaId)
  const live = state.policies.filter((p) => p.kind === 'GUIDING_POLICY' && p.status !== 'RULED_OUT' && !p.superseded)

  return [
    'GUIDING POLICY — STANDING RULES ON THIS PAGE:',
    '- Addendum B1: draft with whatever model you are already running — never switch models for',
    '  a chat draft. If asked for a guiding policy, or you judge one is due, your draft is a',
    '  CANDIDATE, not chat prose: propose it as the policyOptions field with your drafted text as',
    '  the value, rather than writing the guiding policy itself out as chat prose. ⚠⚠ 26-L §4 — THE',
    '  PLATFORM ADDS IT FOR REAL, THIS TURN, AND NAMES THE ACTUAL NUMBER AFTER YOUR REPLY. Never',
    '  state a candidate number yourself, and never say "you should see it" or "it has been',
    '  added" — you do not know whether it was, and a claim with nothing behind it is the exact',
    '  failure this rule exists to stop. Say only that you are proposing it as a candidate; the',
    '  platform confirms the rest. It will be tested like any other candidate; its test result on',
    '  the card is the signal, not your own chat commentary on its quality.',
    '- If asked for "the" guiding policy directly: do not synthesise one in chat. Report the',
    `  state instead — ${live.length} live candidate(s), ${state.consolidate.candidateCount} `
      + `marked part of the solution, ${state.consolidate.feedbackCount} item(s) of feedback on `
      + `record, and ${state.consolidate.undispositionedCount} still needing a disposition — and`,
    '  point at the Consolidate button as the way to actually get one, checked.',
  ].join('\n')
}
