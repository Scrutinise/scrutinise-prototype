// ─────────────────────────────────────────────────────────────────────────────
// The Deepening's one model call: turn what retrieval returned into FINDINGS, ISSUES
// and, most importantly, an honest account of what it could NOT answer.
//
// Written to the rules the four §18 incidents produced:
//   • `finishReason` is checked BEFORE parsing, via the shared helper. A truncated
//     payload is broken JSON, so parsing first converts a length limit into a parse
//     error and hides it.
//   • thinking is OFF (`thinkingBudget: 0`). §19-D Task 2b: three generators were
//     silently returning nothing because thinking ate the whole output budget.
//   • the budget is generous. Output tokens are billed on what is generated, so a
//     large ceiling on a call that emits a small object costs nothing, and a tight one
//     buys nothing and eventually fires.
//   • failure returns null and SAYS so. The caller marks the run FAILED and keeps its
//     retrieval; it never presents an empty gather as a completed one.
//
// GROUNDING: the model is given ONLY the retrieved results and the user's own text. It
// must cite a sourceId from that list for every finding, and the engine drops any
// finding whose sourceId is not in it — so a fabricated citation cannot be persisted
// even if the model produces one.
// ─────────────────────────────────────────────────────────────────────────────

import type { SearchResult } from './page1-config'
import { geminiFinishProblem } from './gemini-finish'
import { modelFor } from './model-registry'
import { recordGeminiUsage } from './spend-ledger'

const MAX_TOKENS = parseInt(process.env.LEX_DEEPENING_MAX_TOKENS ?? '8000', 10)
const TIMEOUT_MS = parseInt(process.env.LEX_DEEPENING_TIMEOUT_MS ?? '60000', 10)

export interface RawFinding {
  kind: 'FINDING' | 'PRECEDENT' | 'SUPPORTS' | 'CONTRADICTS' | 'COMPARISON'
  title: string
  body: string
  /** MUST be one of the supplied result ids. Anything else is dropped by the engine. */
  sourceId: string
  /** Optional canonical field this bears on: "challenge", "causes:<id>", "actions:<id>". */
  fieldRef?: string
}

export interface GatherResult {
  findings: RawFinding[]
  issues: string[]
  /** Which of the pass's mustAnswer questions this run actually answered — verbatim. */
  answered: string[]
  /** Gaps the pass itself names, beyond the unanswered mustAnswer questions. */
  gaps: string[]
}

const SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['FINDING', 'PRECEDENT', 'SUPPORTS', 'CONTRADICTS', 'COMPARISON'] },
          title: { type: 'string' },
          body: { type: 'string' },
          sourceId: { type: 'string' },
          fieldRef: { type: 'string' },
        },
        required: ['kind', 'title', 'body', 'sourceId'],
      },
    },
    issues: { type: 'array', items: { type: 'string' } },
    answered: { type: 'array', items: { type: 'string' } },
    gaps: { type: 'array', items: { type: 'string' } },
  },
  required: ['findings', 'issues', 'answered', 'gaps'],
}

const SYSTEM = [
  'You are Lex, running one DEEPENING PASS over a UK policy proposal. You do the heavy lifting;',
  'the user does the judging. You produce material for them to accept or reject — never conclusions',
  'they must take on trust.',
  '',
  'ABSOLUTE RULES:',
  '1. Every finding MUST carry `sourceId`, copied exactly from the SOURCES list. A statement you',
  '   cannot attribute to a supplied source is not a finding — leave it out, or raise it as an issue',
  '   or a gap. Never invent a citation, a statistic, a date or a case name.',
  '2. A finding that CONTRADICTS the proposal is as valuable as one that supports it. Type it',
  '   CONTRADICTS and report it plainly. Suppressing it is the worst thing you can do here.',
  '3. `answered` must contain, VERBATIM, only those of the MUST-ANSWER questions this run genuinely',
  '   answered from the sources. Omitting a question is how the user learns what is still unknown,',
  '   so omission is useful and over-claiming is not.',
  '4. `gaps` is for what you looked for and could not find. A named gap is a strength.',
  '5. `issues` are SPECIFIC and ADDRESSABLE — something the user can go and do. "Consider the',
  '   evidence base" is useless; "no source quantifies how many bags enter waterways each year" is',
  '   an issue. Do not raise an issue that merely restates a finding.',
].join('\n')

export async function generateDeepeningFindings(input: {
  method: string
  mustAnswer: string[]
  idea: string
  costLines: string[]
  results: SearchResult[]
}): Promise<GatherResult | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.warn('[deepening] no GEMINI_API_KEY — the gather cannot run')
    return null
  }
  // S6 §2 — default via lib/lex/model-registry.ts; legacy env vars still take precedence.
  const model = process.env.LEX_DEEPENING_MODEL ?? process.env.QUERY_EXPANSION_MODEL ?? modelFor('deepening.gather')

  const sources = input.results
    .map((r, i) => `[${i + 1}] id=${r.id}\n    type: ${r.type}\n    title: ${r.title}\n    citation: ${r.citation}\n    date: ${r.date}\n    extract: ${r.snippet}`)
    .join('\n')

  const user = [
    `THIS PASS'S METHOD:\n${input.method}`,
    '',
    `MUST-ANSWER QUESTIONS (copy verbatim into \`answered\` only those you actually answered):\n- ${input.mustAnswer.join('\n- ')}`,
    '',
    `THE PROPOSAL AS THE USER HAS WRITTEN IT:\n${input.idea || '(nothing recorded yet)'}`,
    input.costLines.length ? `\nCOST LINES AS ENTERED:\n- ${input.costLines.join('\n- ')}` : '',
    '',
    `SOURCES — the ONLY material you may cite. Use the \`id=\` value as \`sourceId\`:\n${sources}`,
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
            temperature: 0.3,
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
      console.error('[deepening] gather HTTP', res.status, await res.text().catch(() => ''))
      return null
    }
    type Resp = { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }> }
    const data = (await res.json()) as Resp
    // BRIEF_SEARCH_S6 §3 addendum — recorded before any truncation check, because a call
    // cut off at maxOutputTokens was billed in full. Fire-and-forget: a ledger write must
    // never take down the work it is measuring.
    void recordGeminiUsage(data, { stream: 'deepening', pass: 'deepening.gather', model: model })

    // BEFORE parsing (CLAUDE.md §18.1). A truncated gather is broken JSON, and reporting it as
    // a parse error would send the next reader looking for a serialiser bug.
    const cut = geminiFinishProblem(data?.candidates?.[0], MAX_TOKENS, { label: 'deepening-gather' })
    if (cut) {
      console.error(`[deepening] gather ${cut.reason} — ${cut.detail}`)
      // Truncation is a FAILED run, not a partial one: half a findings array parsed out of a
      // cut-off payload would silently drop the tail and look complete.
      return null
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') return null
    const obj = JSON.parse(text) as Partial<GatherResult>

    const findings = (Array.isArray(obj.findings) ? obj.findings : [])
      .filter((f): f is RawFinding =>
        !!f && typeof f === 'object' &&
        typeof f.title === 'string' && !!f.title.trim() &&
        typeof f.body === 'string' && !!f.body.trim() &&
        typeof f.sourceId === 'string' && !!f.sourceId.trim())
      .map((f) => ({
        kind: (['FINDING', 'PRECEDENT', 'SUPPORTS', 'CONTRADICTS', 'COMPARISON'] as const).includes(f.kind) ? f.kind : 'FINDING',
        title: f.title.trim(),
        body: f.body.trim(),
        sourceId: f.sourceId.trim(),
        fieldRef: typeof f.fieldRef === 'string' && f.fieldRef.trim() ? f.fieldRef.trim() : undefined,
      }))

    return {
      findings,
      issues: (Array.isArray(obj.issues) ? obj.issues : []).map(String).map((s) => s.trim()).filter(Boolean),
      answered: (Array.isArray(obj.answered) ? obj.answered : []).map(String).map((s) => s.trim()).filter(Boolean),
      gaps: (Array.isArray(obj.gaps) ? obj.gaps : []).map(String).map((s) => s.trim()).filter(Boolean),
    }
  } catch (err) {
    console.error('[deepening] gather failed:', err instanceof Error ? err.message : err)
    return null
  } finally {
    clearTimeout(t)
  }
}
