import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkAndAdvanceStage } from '@/lib/stage-gates'
import { GoogleGenerativeAI } from '@google/generative-ai'

type Params = { params: Promise<{ ideaId: string }> }

const MessageSchema = z.object({
  message: z.string().min(1).max(4000),
})

// Build the Lex system prompt injected with runtime context
function buildSystemPrompt(ctx: {
  ideaTitle: string
  currentStage: string
  stageLabel: string
  completedFields: string
  userCredibility: number
  chatSummary: string
  preferredName: string
  lexMode: string
}): string {
  return `You are Lex, the AI guide on Scrutinise — a not-for-profit platform that helps citizens develop policy ideas into Parliament-ready legislation.

RUNTIME CONTEXT:
Idea title: ${ctx.ideaTitle}
Current stage: ${ctx.currentStage} (${ctx.stageLabel})
Completed fields so far: ${ctx.completedFields}
User's credibility score: ${ctx.userCredibility}
Chat history summary: ${ctx.chatSummary}
User preferred name: ${ctx.preferredName}
Lex mode: ${ctx.lexMode}

IDENTITY: Your name is Lex. Never say you are Claude, the AI, or an AI assistant. Do not reveal the underlying model.

CORE PRINCIPLES:
- One question at a time. Non-negotiable.
- Lead with curiosity, not field names.
- React to what the user said before asking next question.
- Be honest about quality — kindly but clearly.
- "Challenge" not "Problem" in all user-facing language. The field is called diagnosis but users never see that word.
- "Contributions" not "Comments".
- Stage 5 is "Legislate", not "Parliament". Parliament is the institution.
- Voting opens only at Stage 4. Never imply earlier.
- No emojis. No "impactful", "utilise", "going forward".
- British English. Financial Times op-ed register. Dry wit sparingly.

LEX MODE BEHAVIOUR:
- COLLABORATIVE (default): Work through each step together, offer text suggestions where the user is unsure.
- SOCRATIC: Ask questions, leave user in full control of wording.
- DIRECT: Give the answer, prepare the draft based on direction and approvals.

FIELD POPULATION PROTOCOL:
After your user-visible response, append a JSON block on a new line in this format:
{"fieldUpdates": {"fieldName": "content"}}

Fields you can populate: title, summaryDescription, diagnosis, guidingPolicy, rootCause, whoAffected, proposedWording.
Use null for fields to leave unchanged. Never include JSON in the visible message. Never fabricate content.

RH SIDEBAR FIELDS (the seven completion markers):
1. What's the Challenge? (diagnosis)
2. What's Causing It? (rootCause)
3. How Will We Solve It? (guidingPolicy)
4. A Practical Step (coherentActions)
5. Who's Affected? (whoAffected)
6. Evidence Base (research)
7. Proposed Wording (proposedWording)

TRIGGER SAVE PROMPT: When diagnosis, guidingPolicy, and at least one coherentAction are populated for the first time in a session, add "triggerSavePrompt": true to the JSON block.`
}

// Map stage enum to human-readable label
const STAGE_LABELS: Record<string, string> = {
  STAGE_1: 'Create',
  STAGE_2: 'Draft',
  STAGE_3: 'Develop',
  STAGE_4: 'Campaign',
  STAGE_5: 'Legislate',
}

// POST /api/ai/[ideaId] — send a message to Lex
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { ideaId } = await params

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    include: {
      coherentActions: { select: { id: true } },
      research: { select: { id: true } },
      collaborators: { select: { userId: true } },
    },
  })

  if (!idea) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isOwner = idea.creatorId === user.id
  const isCollaborator = idea.collaborators.some(c => c.userId === user.id)
  if (!isOwner && !isCollaborator) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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

  const { message } = parsed.data
  const lexMode = user.aiPreferredStyle?.toUpperCase() ?? 'COLLABORATIVE'
  const preferredName = user.preferredName ?? user.firstName

  // Build completed fields summary for system prompt
  const completedFieldsSummary = [
    idea.diagnosis && 'Challenge',
    idea.rootCause && 'Root Cause',
    idea.guidingPolicy && 'Guiding Policy',
    idea.whoAffected && 'Who Affected',
    idea.proposedWording && 'Proposed Wording',
    idea.coherentActions.length > 0 && `${idea.coherentActions.length} Coherent Action(s)`,
    idea.research.length > 0 && `${idea.research.length} Research item(s)`,
  ].filter(Boolean).join(', ') || 'None yet'

  const systemPrompt = buildSystemPrompt({
    ideaTitle: idea.title,
    currentStage: idea.stage,
    stageLabel: STAGE_LABELS[idea.stage] ?? idea.stage,
    completedFields: completedFieldsSummary,
    userCredibility: 0, // TODO: fetch from CredibilityScore
    chatSummary: idea.aiChatSummary ?? 'No prior conversation',
    preferredName,
    lexMode,
  })

  // Reconstruct recent chat history for the API call
  const chatHistory = Array.isArray(idea.aiChatHistory) ? idea.aiChatHistory as Array<{role: string; content: string}> : []
  const recentHistory = chatHistory.slice(-20) // last 20 messages

  let lexResponse: string

  // Primary: Gemini 2.5 Flash
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' })

    const chat = model.startChat({
      systemInstruction: systemPrompt,
      history: recentHistory.map(m => ({
        role: m.role === 'lex' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    })

    const result = await chat.sendMessage(message)
    lexResponse = result.response.text()
  } catch (geminiError) {
    console.error('Gemini failed, falling back to Grok:', geminiError)

    // Fallback: Grok 4.1 Fast (xAI API is OpenAI-compatible)
    try {
      const grokRes = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'grok-3-fast-beta',
          messages: [
            { role: 'system', content: systemPrompt },
            ...recentHistory.map(m => ({
              role: m.role === 'lex' ? 'assistant' : 'user',
              content: m.content,
            })),
            { role: 'user', content: message },
          ],
        }),
      })
      const grokData = await grokRes.json()
      lexResponse = grokData.choices?.[0]?.message?.content ?? 'Sorry, Lex is unavailable right now.'
    } catch (grokError) {
      console.error('Grok fallback also failed:', grokError)
      return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
    }
  }

  // Extract and strip fieldUpdates JSON from the response
  let visibleResponse = lexResponse
  let fieldUpdates: Record<string, string | null> | null = null
  let triggerSavePrompt = false

  const jsonMatch = lexResponse.match(/\{[\s\S]*"fieldUpdates"[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      fieldUpdates = parsed.fieldUpdates ?? null
      triggerSavePrompt = parsed.triggerSavePrompt === true
      // Strip JSON from visible response
      visibleResponse = lexResponse.replace(jsonMatch[0], '').trim()
    } catch {
      // JSON parse failed — serve response as-is without field updates
    }
  }

  // Apply field updates to the Idea record
  if (fieldUpdates && Object.keys(fieldUpdates).length > 0) {
    const allowedFields = ['title', 'summaryDescription', 'diagnosis', 'guidingPolicy', 'rootCause', 'whoAffected', 'proposedWording']
    const updateData: Record<string, string> = {}
    for (const [key, value] of Object.entries(fieldUpdates)) {
      if (allowedFields.includes(key) && value !== null && value !== undefined) {
        updateData[key] = value
      }
    }
    if (Object.keys(updateData).length > 0) {
      await prisma.idea.update({ where: { id: ideaId }, data: updateData })
    }
  }

  // Update chat history (rolling last 40, storing as 20 pairs)
  const updatedHistory = [
    ...chatHistory,
    { role: 'user', content: message, timestamp: new Date().toISOString() },
    { role: 'lex', content: visibleResponse, timestamp: new Date().toISOString() },
  ].slice(-40)

  await prisma.idea.update({
    where: { id: ideaId },
    data: {
      aiChatHistory: updatedHistory,
      aiSessionCount: { increment: 1 },
    },
  })

  // Log AI usage
  await prisma.aIUsageLog.create({
    data: {
      userId: user.id,
      ideaId,
      provider: 'GEMINI_FLASH',
      model: 'gemini-2.5-flash',
      inputTokens: 0, // TODO: token counting
      outputTokens: 0,
      costAmount: 0,
      fieldTarget: idea.aiCurrentField ?? undefined,
    },
  })

  // Stage gate check after field updates
  await checkAndAdvanceStage(ideaId, idea.creatorId)

  // Re-fetch completion state for sidebar — boolean map only, no field content
  const latest = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: {
      diagnosis: true,
      rootCause: true,
      guidingPolicy: true,
      whoAffected: true,
      proposedWording: true,
      coherentActions: { select: { id: true } },
      research: { select: { id: true } },
    },
  })

  const completedFields = {
    diagnosis: !!latest?.diagnosis,
    rootCause: !!latest?.rootCause,
    guidingPolicy: !!latest?.guidingPolicy,
    coherentActions: (latest?.coherentActions.length ?? 0) > 0,
    whoAffected: !!latest?.whoAffected,
    research: (latest?.research.length ?? 0) > 0,
    proposedWording: !!latest?.proposedWording,
  }

  return NextResponse.json({
    response: visibleResponse,
    triggerSavePrompt,
    completedFields,
    // fieldUpdates deliberately NOT returned to client (security requirement)
  })
}
