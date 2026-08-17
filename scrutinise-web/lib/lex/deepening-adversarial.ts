// ─────────────────────────────────────────────────────────────────────────────
// THE ADVERSARIAL PASS (§19-E Task 4) — the issues list, from a different angle.
//
// Charlie on the issues the Deepening produced: "much better quality and genuinely
// useful. But it should be Lex critiquing its own work from a different angle to be
// really helpful."
//
// He is right about the mechanism, not just the output. Until now the SAME model call
// produced the findings AND the issues, which means the critique was written from
// inside the frame that produced the thing being critiqued — by an author who has just
// decided what matters, asked to say what it missed. That is not scrutiny; it is
// proof-reading. The predictable result is issues that are footnotes to the findings
// ("the evidence base could be stronger") rather than the question that would sink the
// proposal in a committee room.
//
// So the issues now come from a SEPARATE CALL WITH AN ADVERSARIAL BRIEF: a hostile
// committee clerk reading this proposal for the first time, with the findings attached,
// asked where it is weakest and what it cannot answer. Same structured output,
// different vantage point.
//
// WHAT DOES NOT CHANGE, deliberately:
//   · The deterministic issue templates stay (no-quantified-scale,
//     no-contradicting-evidence, and the rest). They fire reliably on the run's own
//     shape, both fired correctly on the 13 Aug run, and a model — hostile or not —
//     is the wrong instrument for "this run produced zero SUPPORTS findings".
//   · Never-claim still holds. The clerk may reason and may press, but it may not
//     invent a document, a statistic or a case. It is given the findings and the
//     proposal, and nothing else.
//   · A failure returns null and the caller says so. An empty issues list from a
//     hostile reader is a strong claim about a proposal, and we must not make it by
//     accident.
// ─────────────────────────────────────────────────────────────────────────────

import { geminiFinishProblem } from './gemini-finish'
import type { RawFinding } from './deepening-client'
import { modelFor } from './model-registry'
import { recordGeminiUsage } from './spend-ledger'

const MAX_TOKENS = parseInt(process.env.LEX_ADVERSARIAL_MAX_TOKENS ?? '4000', 10)
const TIMEOUT_MS = parseInt(process.env.LEX_ADVERSARIAL_TIMEOUT_MS ?? '45000', 10)

const SCHEMA = {
  type: 'object',
  properties: {
    issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['issues'],
}

const SYSTEM = [
  'You are a COMMITTEE CLERK preparing a session on the policy proposal below. You are reading it',
  'for the first time. Your job is to find the questions the proposer cannot answer, so that the',
  'Committee does not waste a sitting discovering them.',
  '',
  'You are not hostile to the proposer. You are hostile to WEAKNESS IN THE PROPOSAL — which is the',
  'most useful thing anyone can be to them, and it is why this is a separate reading from the one',
  'that assembled the evidence. Do not repeat that reading. Look for what it did not think to look',
  'for.',
  '',
  'WHERE PROPOSALS ARE WEAKEST, and where to look first:',
  '  · THE UNQUANTIFIED CLAIM. Which assertion carries the argument and has no number behind it?',
  '  · THE MECHANISM THAT DOES NOT BITE. Trace it: who exactly has to do what differently on the',
  '    Monday morning after this takes effect, and what happens to them if they do not?',
  '  · THE GROUP WHO WILL NOT COMPLY, and who is not mentioned anywhere in the proposal.',
  '  · THE THING THAT ALREADY EXISTS. Is some part of this already the law, already a duty,',
  '    already a regulator\'s job? A proposal that duplicates an existing regime dies on that.',
  '  · THE VEHICLE. Does this need primary legislation, and has anyone established that?',
  '  · THE COST NOBODY WILL BEAR, and the one the proposer has put on somebody else without',
  '    saying so.',
  '  · THE DEFINITION THAT WILL BE FOUGHT OVER — the word doing all the work, unspecified.',
  '  · WHAT THE FINDINGS ACTUALLY SHOW, as against what the proposal says they show.',
  '',
  'RULES:',
  '1. Each issue is ONE SPECIFIC, ADDRESSABLE THING the proposer can go and do. "Consider the',
  '   evidence base" is useless. "Nothing states how many major policy decisions a year would fall',
  '   inside the charter, and the enforcement cost depends entirely on that number" is an issue.',
  '2. Do NOT restate a finding. A finding says what the evidence shows; an issue says what is',
  '   missing, unresolved, or vulnerable.',
  '3. NEVER invent a citation, a statistic, a date or a case name. You may reason, press and',
  '   speculate about consequences — say so when you are speculating — but a fabricated fact in a',
  '   hostile reading is worse than in a friendly one, because it will be believed.',
  '4. Between three and eight issues. If the proposal is genuinely strong in an area, do not',
  '   manufacture an issue for it — but a proposal with fewer than three real vulnerabilities is',
  '   rare enough that you should look again before concluding it.',
  '5. Write each one as a committee clerk would put it to a colleague: direct, unhedged, and',
  '   without preamble.',
].join('\n')

/**
 * Generate the issues list from an adversarial reading of the proposal and findings.
 *
 * Returns null on any failure — the caller keeps the deterministic template issues and
 * says the adversarial reading did not run, rather than presenting a proposal as having
 * survived a hostile reading it never had.
 */
export async function generateAdversarialIssues(input: {
  idea: string
  costLines: string[]
  findings: RawFinding[]
  /** The pass's own method, so the clerk knows which angle this pass was covering. */
  passMethod: string
  /** What the run looked for and could not find — a gap is a question waiting to be asked. */
  knownUnknowns: string[]
}): Promise<string[] | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[deepening:adversarial] no GEMINI_API_KEY — the adversarial reading cannot run')
    return null
  }
  // S6 §2: the default now comes from lib/lex/model-registry.ts — ONE place where a pass's model
  // is chosen. The legacy env vars still win if set, so this is not a behaviour change; it is a
  // change to where the DEFAULT lives, which is what made it a dozen defaults before.
  const model = process.env.LEX_ADVERSARIAL_MODEL ?? process.env.LEX_DEEPENING_MODEL ?? process.env.QUERY_EXPANSION_MODEL ?? modelFor('deepening.adversarial')

  const findings = input.findings.length
    ? input.findings.map((f, i) => `[${i + 1}] (${f.kind}) ${f.title}\n     ${f.body}`).join('\n')
    : '(the evidence pass produced no findings — that is itself worth pressing on)'

  const user = [
    `THE PROPOSAL, AS THE PROPOSER HAS WRITTEN IT:\n${input.idea || '(nothing recorded yet)'}`,
    input.costLines.length ? `\nCOSTS AS THE PROPOSER HAS ENTERED THEM:\n- ${input.costLines.join('\n- ')}` : '',
    `\nWHAT THE EVIDENCE PASS FOUND — you are reading this critically, not accepting it:\n${findings}`,
    input.knownUnknowns.length
      ? `\nWHAT THAT PASS LOOKED FOR AND COULD NOT FIND:\n- ${input.knownUnknowns.join('\n- ')}`
      : '',
    `\nTHE ANGLE THIS PASS WAS COVERING (so you can look at what it was NOT covering):\n${input.passMethod}`,
    '\nWhere is this proposal weakest? What would you ask that it cannot answer?',
  ].filter(Boolean).join('\n')

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            // Warmer than the gather (0.3): the gather is reporting what sources say and
            // must not embellish; this is looking for the angle nobody thought of, and a
            // cold adversary produces the same four objections about every proposal.
            temperature: 0.7,
            maxOutputTokens: MAX_TOKENS,
            responseMimeType: 'application/json',
            responseSchema: SCHEMA,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: ctrl.signal,
      },
    )
    if (!res.ok) {
      console.error('[deepening:adversarial] HTTP', res.status, await res.text().catch(() => ''))
      return null
    }
    type Resp = { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }> }
    const data = (await res.json()) as Resp
    // BRIEF_SEARCH_S6 §3 addendum — recorded before any truncation check, because a call
    // cut off at maxOutputTokens was billed in full. Fire-and-forget: a ledger write must
    // never take down the work it is measuring.
    void recordGeminiUsage(data, { stream: 'deepening', pass: 'deepening.adversarial', model: model })

    // BEFORE parsing (CLAUDE.md §18.1).
    const cut = geminiFinishProblem(data?.candidates?.[0], MAX_TOKENS, { label: 'deepening-adversarial' })
    if (cut) {
      console.error(`[deepening:adversarial] ${cut.reason} — ${cut.detail}`)
      return null
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') return null
    const obj = JSON.parse(text) as { issues?: unknown }
    const issues = (Array.isArray(obj.issues) ? obj.issues : [])
      .map((s) => String(s).trim())
      // Rule 1 enforced rather than requested: a one-clause "issue" is a label.
      .filter((s) => s.length >= 40)
      .filter((s) => !/^consider\b/i.test(s))
    console.log('[deepening:adversarial]', { raised: issues.length, findingsRead: input.findings.length })
    return issues
  } catch (err) {
    console.error('[deepening:adversarial] failed:', err instanceof Error ? err.message : err)
    return null
  } finally {
    clearTimeout(t)
  }
}
