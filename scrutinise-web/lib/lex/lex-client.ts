// ─────────────────────────────────────────────────────────────────────────────
// Lex structured output (§4). Gemini is constrained to a fixed JSON shape via
// responseSchema, so we never parse data out of prose again. Lex returns content
// only — chatText, an optional proposal, optional extracted slots. The platform
// owns sequence, completion and the search trigger. A malformed proposal is
// discarded by the caller; Lex can never half-advance state.
// ─────────────────────────────────────────────────────────────────────────────

import type { FieldDef } from './page1-config'

export interface LexTurnContext {
  preferredName: string
  lexMode: string
  experienceLevel: string | null
  ideaTitle: string | null
  isFirstIdea: boolean
  currentField: FieldDef | null
  /** True when the current field already holds a Lex proposal the user has not yet
   *  Saved (status AWAITING_CONFIRMATION). In this state Lex refines THIS field only
   *  and points the user to the panel to Save — it never moves on (§13 / Sprint 1.3). */
  awaiting?: boolean
  /** A compact summary of what's already accepted, for grounding. */
  acceptedSummary: string
}

export interface LexRawOutput {
  chatText: string
  proposal: {
    fieldKey: string
    valueText?: string
    valueList?: string[]
    rationale?: string
  } | null
  extracted: Record<string, string>
}

// Gemini structured-output response schema (OpenAPI subset).
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    chatText: { type: 'string' },
    proposal: {
      type: 'object',
      nullable: true,
      properties: {
        fieldKey: {
          type: 'string',
          enum: ['ideaNarrative', 'youAndIdeaNarrative', 'aboutYou', 'title', 'keywords'],
        },
        valueText: { type: 'string' },
        valueList: { type: 'array', items: { type: 'string' } },
        rationale: { type: 'string' },
      },
      required: ['fieldKey'],
    },
    extracted: {
      type: 'object',
      properties: {
        problemNarrative: { type: 'string' },
        currentFraming: { type: 'string' },
        motivation: { type: 'string' },
        priorWork: { type: 'string' },
        ideaGoal: { type: 'string' },
        experienceLevel: { type: 'string', enum: ['novice', 'some', 'expert'] },
        career: { type: 'string' },
        resources: { type: 'string' },
        legislativeKnowledge: { type: 'string' },
        politicalLevel: { type: 'string' },
        whatTheyWant: { type: 'string' },
      },
    },
  },
  required: ['chatText'],
}

export function buildLexSystemPrompt(ctx: LexTurnContext): string {
  const field = ctx.currentField
  const fieldBlock = field
    ? `CURRENT FIELD (the platform decides this — you never choose the sequence):
  key:    ${field.key}
  label:  ${field.label}
  origin: ${field.origin}   ${field.origin === 'box' ? '(a box the user writes themselves)' : '(you propose a value)'}
  ${field.hints?.length ? 'helps to cover: ' + field.hints.join('; ') : ''}

${
  field.origin === 'box'
    ? (ctx.awaiting
        ? `You have ALREADY drafted this box — it is showing in the proposal panel on the right, waiting for the user to review and Save it. Do NOT move on, do NOT ask the next question, and do NOT propose any other field. The platform only advances once the user Saves or Skips. If the user asks for a change, RETURN A FRESH PROPOSAL for THIS field (proposal.fieldKey "${field.key}", proposal.valueText = the improved version in their own voice, first person, concise) and in chatText say briefly what you changed and ask them to Save it in the panel. If they seem happy, emit no proposal and in chatText simply invite them to Save it (or edit it in the panel). Quietly capture any slots in "extracted".`
        : `This box can be filled two ways: the user types it in themselves, or they answer you here in chat and you tidy their words into it. When the user's message contains enough to fill this box, RETURN A PROPOSAL — proposal.fieldKey "${field.key}", proposal.valueText = a tidied version of what they said for THIS field, in their own voice (first person), concise, no preamble or quotes. When you return a proposal your chatText must point them to the panel and ask them to review and Save — for example: "I've drafted that in the panel on the right — have a read, edit it directly if you'd change anything, then Save it. Or tell me here how to sharpen it." Do NOT ask the next question in the same turn. If they haven't answered this yet, just ask the question and nudge obvious gaps GENTLY (at most twice), with no proposal. The user confirms by SAVING the box — never tell them to "accept a card". Quietly capture any slots in "extracted".`)
    : field.key === 'title'
      ? `Propose a working title from what the user has told you. It should name the problem OR the solution, not both. Plain English. Put it in proposal.valueText with proposal.fieldKey "title".`
      : `Propose 4–8 search keywords drawn from everything the user has said. INCLUDE the likely government department as one keyword among the others — do not ask which department. Put them in proposal.valueList with proposal.fieldKey "keywords".`
}`
    : `All Page 1 fields are complete. Acknowledge warmly in one or two sentences and tell the user the diagnosis comes next. Emit no proposal.`

  return `You are Lex, the guide on Scrutinise — a non-partisan platform that helps people turn policy ideas into Parliament-ready proposals. You are warm, curious, plain-spoken, British English, FT op-ed register. No emojis. Never say you are an AI or name a model. "Challenge" not "problem"; "Contributions" not "comments".

You are NOT in control of the conversation's mechanics. The platform tells you which single field is active and renders confirmation cards. You only: (a) write a short conversational message in chatText, (b) when the active field is one you propose, put your proposal in the proposal object, (c) quietly record anything you learn about the user or idea in extracted.

CONTEXT
  user:            ${ctx.preferredName}
  experience:      ${ctx.experienceLevel ?? 'unknown — establish it gently early on'}
  mode:            ${ctx.lexMode}
  idea title:      ${ctx.ideaTitle ?? '(not set yet)'}
  first idea:      ${ctx.isFirstIdea ? 'yes' : 'no'}
  already captured: ${ctx.acceptedSummary || 'nothing yet'}

${fieldBlock}

RULES
- One thing at a time. Finish the CURRENT field before the next one. Never ask about, hint at, or propose the next field — the platform moves on only when the user Saves or Skips, and it tells you the new current field then.
- React to what the user just said before anything else.
- chatText is always 1–4 sentences. Never put JSON or field names in chatText.
- Only ever propose for the CURRENT field shown above (never another field).
- "extracted" is optional; include only slots you are confident about.`
}

async function callGemini(systemPrompt: string, userMessage: string, history: { role: string; content: string }[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')
  const model = 'gemini-2.5-flash'

  const contents = [
    ...history.map((m) => ({ role: m.role === 'lex' ? 'model' : 'user', parts: [{ text: m.content }] })),
    { role: 'user', parts: [{ text: userMessage }] },
  ]

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const e = new Error(`Gemini HTTP ${res.status}`) as LexError
    e.status = res.status
    e.body = body
    e.kind = res.status === 429 ? 'rate_limit' : res.status >= 500 ? 'upstream_5xx' : 'http_error'
    throw e
  }
  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') {
    const e = new Error('Gemini returned no text part') as LexError
    e.kind = 'empty_response'
    throw e
  }
  return text
}

/** Error carrying the diagnostic cause of a failed Lex turn (logged, never tuned blindly). */
export type LexError = Error & { status?: number; body?: string; kind?: string }

function parseLexOutput(raw: string): LexRawOutput | null {
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>
  if (typeof o.chatText !== 'string' || !o.chatText.trim()) return null

  let proposal: LexRawOutput['proposal'] = null
  if (o.proposal && typeof o.proposal === 'object') {
    const p = o.proposal as Record<string, unknown>
    if (typeof p.fieldKey === 'string') {
      proposal = {
        fieldKey: p.fieldKey,
        valueText: typeof p.valueText === 'string' ? p.valueText : undefined,
        valueList: Array.isArray(p.valueList) ? p.valueList.map(String) : undefined,
        rationale: typeof p.rationale === 'string' ? p.rationale : undefined,
      }
    }
  }

  const extracted: Record<string, string> = {}
  if (o.extracted && typeof o.extracted === 'object') {
    for (const [k, v] of Object.entries(o.extracted as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) extracted[k] = v.trim()
    }
  }

  return { chatText: o.chatText.trim(), proposal, extracted }
}

/** Call Lex with one retry if the structured output is unparseable (§4 step 3). */
export async function runLexTurn(
  systemPrompt: string,
  userMessage: string,
  history: { role: string; content: string }[],
): Promise<LexRawOutput> {
  let lastErr: LexError | undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await callGemini(systemPrompt, userMessage, history)
      const parsed = parseLexOutput(raw)
      if (parsed) return parsed
      // Structured output returned but failed our shape/schema check. Log the raw
      // bytes — bytes before hypotheses; don't tune until the cause is visible.
      console.error('[lex] structured-output validation failed', {
        attempt: attempt + 1,
        rawSnippet: raw.slice(0, 800),
      })
      const e = new Error('lex output failed validation') as LexError
      e.kind = 'schema_validation'
      lastErr = e
    } catch (err) {
      const e = err as LexError
      console.error('[lex] gemini call failed', {
        attempt: attempt + 1,
        kind: e.kind ?? (e.name === 'AbortError' ? 'timeout' : 'network'),
        status: e.status ?? null,
        message: e.message,
        bodySnippet: typeof e.body === 'string' ? e.body.slice(0, 800) : undefined,
      })
      lastErr = e
    }
  }
  throw lastErr ?? new Error('Lex turn failed')
}
