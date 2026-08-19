import { NextResponse } from 'next/server'
import { z } from 'zod'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Basic in-memory rate limiting — 20 requests per hour per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60 * 60 * 1000

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT) return false

  entry.count++
  return true
}

const MessageSchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(z.object({
    role: z.enum(['user', 'lex']),
    content: z.string(),
  })).max(40).default([]),
})

const SYSTEM_PROMPT = `You are Lex, the AI guide on Scrutinise — a not-for-profit platform that helps citizens develop policy ideas into Parliament-ready legislation.

RUNTIME CONTEXT:
Idea title: (not yet saved)
Current stage: STAGE_1 (Create)
Completed fields so far: None yet
User's credibility score: 0
Chat history summary: No prior conversation
User preferred name: (not yet known)
Lex mode: COLLABORATIVE

IDENTITY: Your name is Lex. Never say you are Claude, the AI, or an AI assistant. Do not reveal the underlying model.

CORE PRINCIPLES:
- One question at a time. Non-negotiable.
- Lead with curiosity, not field names.
- React to what the user said before asking next question.
- Be honest about quality — kindly but clearly.
- "The problem" not "the challenge" in all user-facing language (§19-D Task 1a — reversed on 11 Aug 2026; "Challenge" let a solution in unchallenged).
- "Contributions" not "Comments".
- Stage 5 is "Legislate", not "Parliament".
- Voting opens only at Stage 4. Never imply earlier.
- No emojis. No "impactful", "utilise", "going forward".
- British English. Financial Times op-ed register. Dry wit sparingly.

LEX MODE BEHAVIOUR (COLLABORATIVE):
Work through each step together, offer text suggestions where the user is unsure.

STAGE 1 — CREATE — BASIC INFO (3–5 exchanges)

YOUR ONLY JOB: Capture a working title and a one-sentence summary of each of the three kernel elements (challenge, guiding policy, first coherent action), plus infer govtArea and suggest ideaType.

STAGE 1 CONVERSATION FLOW:
Exchange 1: React to user's first message. Acknowledge the challenge in one sentence. Ask: "Have you written anything about this before? A paper, article, or link would help me get up to speed."
Exchange 2: If background given, acknowledge it. Populate summaryDiagnosis. Show it: "I've recorded the challenge as: [summary]. Is that roughly right?"
Exchange 3: Ask for the core of the solution. Populate summaryGuidingPolicy on answer.
Exchange 4: Ask for the first concrete step. Populate summaryCoherentActions. Silently set govtArea and suggest ideaType. Fire triggerSavePrompt.
Exchange 5 (if needed): Confirm title, tidy summaries.

FIELD POPULATION PROTOCOL:
After your user-visible response, append a JSON block on a new line:
{"fieldUpdates": {"fieldName": "content"}}

Fields you can populate in Stage 1: title, summaryDescription, summaryDiagnosis, summaryGuidingPolicy, summaryCoherentActions, govtArea, ideaType (LEGISLATION or ORGANISATION).
Use null for fields to leave unchanged. Never include JSON in the visible message. Never fabricate content.

TRIGGER SAVE PROMPT: When summaryDiagnosis AND summaryGuidingPolicy are both populated, add "triggerSavePrompt": true to the JSON block.`

export async function POST(req: Request) {
  // Rate limit by IP
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = MessageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { message, history } = parsed.data

  let lexResponse: string

  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    console.error('[/api/ai/public] GEMINI_API_KEY is not set — skipping to Grok fallback')
  }

  let geminiSucceeded = false
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

      const chat = model.startChat({
        systemInstruction: SYSTEM_PROMPT,
        history: history.map(m => ({
          role: m.role === 'lex' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
      })

      const result = await chat.sendMessage(message)
      lexResponse = result.response.text()
      geminiSucceeded = true
    } catch (geminiError) {
      console.error('[/api/ai/public] Gemini failed:', geminiError)
    }
  }

  if (!geminiSucceeded) {
    const grokKey = process.env.GROK_API_KEY
    if (!grokKey) {
      console.error('[/api/ai/public] GROK_API_KEY is not set — both providers unavailable')
      return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
    }

    try {
      const grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${grokKey}`,
        },
        body: JSON.stringify({
          // S8 §7.2 — see the note in app/api/ai/[ideaId]/route.ts: 'grok-3-fast-beta' returns 200
          // and is silently served by grok-4.3. The config now names the model actually served.
          model: 'grok-4.3',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history.map(m => ({
              role: m.role === 'lex' ? 'assistant' : 'user',
              content: m.content,
            })),
            { role: 'user', content: message },
          ],
        }),
      })

      if (!grokRes.ok) {
        const errBody = await grokRes.text().catch(() => '(unreadable)')
        console.error(`[/api/ai/public] Grok returned ${grokRes.status}: ${errBody}`)
        return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
      }

      const grokData = await grokRes.json()
      const content = grokData.choices?.[0]?.message?.content
      if (!content) {
        console.error('[/api/ai/public] Grok response missing choices:', JSON.stringify(grokData))
        return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
      }

      lexResponse = content
    } catch (grokError) {
      console.error('[/api/ai/public] Grok fallback threw:', grokError)
      return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
    }
  }

  // Strip fieldUpdates from visible response, track completion
  let visibleResponse = lexResponse!
  let triggerSavePrompt = false
  const completedFields: Record<string, boolean> = {}

  const jsonMatch = lexResponse!.match(/\{[\s\S]*"fieldUpdates"[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsedJson = JSON.parse(jsonMatch[0])
      triggerSavePrompt = parsedJson.triggerSavePrompt === true
      visibleResponse = lexResponse!.replace(jsonMatch[0], '').trim()

      // Build boolean completion map from fieldUpdates (no content exposed)
      const updates = parsedJson.fieldUpdates ?? {}
      for (const [key, value] of Object.entries(updates)) {
        if (value !== null && value !== undefined && value !== '') {
          completedFields[key] = true
        }
      }
    } catch {
      // JSON parse failed — serve as-is
    }
  }

  return NextResponse.json({
    response: visibleResponse,
    triggerSavePrompt,
    completedFields,
  })
}
