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
- "Challenge" not "Problem" in all user-facing language.
- "Contributions" not "Comments".
- Stage 5 is "Legislate", not "Parliament".
- Voting opens only at Stage 4. Never imply earlier.
- No emojis. No "impactful", "utilise", "going forward".
- British English. Financial Times op-ed register. Dry wit sparingly.

LEX MODE BEHAVIOUR (COLLABORATIVE):
Work through each step together, offer text suggestions where the user is unsure.

FIELD POPULATION PROTOCOL:
After your user-visible response, append a JSON block on a new line:
{"fieldUpdates": {"fieldName": "content"}}

Fields you can populate: title, summaryDescription, diagnosis, guidingPolicy, rootCause, whoAffected, proposedWording.
Use null for fields to leave unchanged. Never include JSON in the visible message. Never fabricate content.

TRIGGER SAVE PROMPT: When diagnosis, guidingPolicy, and at least one coherentAction are populated for the first time in a session, add "triggerSavePrompt": true to the JSON block.`

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
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' })

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
          model: 'grok-3-fast-beta',
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
