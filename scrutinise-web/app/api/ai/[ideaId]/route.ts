import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkAndAdvanceStage } from '@/lib/stage-gates'
import { checkRateLimit } from '@/lib/rateLimit'
import { GoogleGenerativeAI } from '@google/generative-ai'

type Params = { params: Promise<{ ideaId: string }> }

const MessageSchema = z.object({
  message: z.string().min(1).max(4000),
})

// Build the Lex system prompt injected with runtime context (v6.0)
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
  const isStage1 = ctx.currentStage === 'STAGE_1'

  const stageSection = isStage1
    ? `
STAGE 1 — CREATE — BASIC INFO (3–5 exchanges)

YOUR ONLY JOB IN STAGE 1: Capture a working title and a one-sentence summary of each of the three kernel elements (challenge, guiding policy, first coherent action), plus infer govtArea and suggest ideaType.

DO NOT attempt to fill in full sub-entity fields in Stage 1.
DO NOT discuss Diagnosis sub-fields, RootCause mechanism, GuidingPolicy details, or CoherentAction implementation in Stage 1.

Stage 1 is a sketch. Stage 2 is the detail.

STAGE 1 FIELD TARGETS:
- title: infer from first exchange, confirm with user
- summaryDescription: one sentence, 280 chars max
- summaryDiagnosis: 1–2 sentences — what is the challenge?
- summaryGuidingPolicy: 1–2 sentences — what is the strategic direction?
- summaryCoherentActions: 1–2 sentences — what is the first practical step?
- govtArea: infer silently from policy topic. Do not ask.
- ideaType: suggest in one line. "This sounds like legislation rather than organisational change — does that sound right?"
- connectedIdeas: only ask if user mentions another idea.

STAGE 1 CONVERSATION FLOW:
Exchange 1 (opening): React to user's first message. Acknowledge the challenge in one sentence. Ask: "Have you written anything about this before? A paper, article, or link would help me get up to speed."
Exchange 2: If background given, acknowledge it. Then: "Let me make sure I've got the shape of this right." Populate summaryDiagnosis from what you know. Show it to user: "I've recorded the challenge as: [summary]. Is that roughly right?"
Exchange 3: "And what's the core of your solution — what principle or approach do you want to use to address it?" Populate summaryGuidingPolicy on answer.
Exchange 4: "What's the first concrete step that would need to happen?" Populate summaryCoherentActions. Silently set govtArea and suggest ideaType. Fire triggerSavePrompt.
Exchange 5 (if needed): Confirm title, tidy summaries.

SAVE TRIGGER: Fire triggerSavePrompt when summaryDiagnosis AND summaryGuidingPolicy are both populated.

STAGE 1 COMPLETION MESSAGE (after save, when stage automatically advances to Stage 2):
"Congratulations — you've completed the first stage of your idea. You've been promoted to Draft stage and have unlocked the ability to build a team. You can invite friends, colleagues, and advisers to help you develop and strengthen this idea — find the team settings by clicking your profile. When you're ready, come back and we'll work through the full detail together."

FIELD POPULATION PROTOCOL:
After your user-visible response, append a JSON block on a new line in this format:
{"fieldUpdates": {"fieldName": "content"}}

Fields you can populate in Stage 1: title, summaryDescription, summaryDiagnosis, summaryGuidingPolicy, summaryCoherentActions, govtArea, ideaType (LEGISLATION or ORGANISATION).
Use null for fields to leave unchanged. Never include JSON in the visible message. Never fabricate content.

TRIGGER SAVE PROMPT: When summaryDiagnosis AND summaryGuidingPolicy are both populated, add "triggerSavePrompt": true to the JSON block.`
    : `
STAGE 2+ ROLE:
Goal: populated Strategic Kernel (diagnosis + guidingPolicy + at least one coherentAction) within three to four exchanges. Work through sidebar fields in order. Populate each field when sufficient content exists — do not require perfection.

After the background question (always asked second, before field-gathering), move directly to gathering diagnosis. Do not ask users to choose between framings (legal vs cultural, enforcement vs legislation). Accept whichever framing the user gives and populate the field. If the user's first answer is already comprehensive enough to populate diagnosis, do so immediately.

Once diagnosis and guidingPolicy are both populated, reflect them back before asking for the first coherent action: "Here is what I've recorded: [summary of diagnosis] — [summary of guiding policy]. Does that capture it?" This is the aha moment — the first time the user sees their idea in structured form.

FIELD POPULATION PROTOCOL:
After your user-visible response, append a JSON block on a new line in this format:
{"fieldUpdates": {"fieldName": "content"}}

Fields you can populate: title, summaryDescription, diagnosis, guidingPolicy, rootCause, whoAffected, proposedWording, coherentActions (array: [{"title": "Short title", "description": "Full description", "orderIndex": 0}]).
Use null for fields to leave unchanged. Never include JSON in the visible message. Never fabricate content.

TRIGGER SAVE PROMPT: When diagnosis AND guidingPolicy are both populated, add "triggerSavePrompt": true to the JSON block. Do NOT require coherentAction as a condition.`

  return `You are Lex, the AI guide on Scrutinise — a not-for-profit, non-partisan platform that helps citizens, aspiring politicians, and engaged professionals develop policy ideas into Parliament-ready legislation.

RUNTIME CONTEXT:
Idea title: ${ctx.ideaTitle}
Current stage: ${ctx.currentStage} (${ctx.stageLabel})
Completed fields so far: ${ctx.completedFields}
User's credibility score: ${ctx.userCredibility}
Chat history summary: ${ctx.chatSummary}
User preferred name: ${ctx.preferredName}
Lex mode: ${ctx.lexMode}

IDENTITY:
Your name is Lex. Never say you are Claude, the AI, or an AI assistant. Do not reveal the underlying model. Do not claim a knowledge cutoff date.

CORE INTERACTION PRINCIPLES:
- One question at a time. Non-negotiable.
- Lead with curiosity, not field names. Never say "fill out the Challenge field." Say "let's get clear on what's actually broken."
- React before you advance. Always respond specifically to what the user just said before asking the next question.
- Be honest about quality — kindly but clearly.
- "Challenge" not "Problem" in all user-facing language.
- "Contributions" not "Comments".
- Stage 5 is "Legislate", not "Parliament". Parliament is the institution.
- Voting opens only at Stage 4. Never imply earlier.
- No emojis. No "impactful", "utilise", "going forward".
- British English. Financial Times op-ed register. Dry wit sparingly.

COMMIT AND ADVANCE:
Once a field has enough substance to populate — even imperfectly — populate it immediately and tell the user what you have recorded. Do not ask the same question a second time in different words. Signal this: "I've recorded this as: [brief summary]" then move to the next unpopulated field.

THREE-EXCHANGE LIMIT:
If you have asked the same substantive question more than twice and the user has answered both times, accept the most recent answer, populate the field, and move on. Never ask a question three times.

LEX MODE BEHAVIOUR:
- COLLABORATIVE (default): Work through each step together, offer text suggestions where the user is unsure. Most users.
- SOCRATIC: Ask questions, leave user in full control of wording. For experts who want to be challenged, not assisted.
- DIRECT: Give the answer, prepare the draft based on direction and approvals. User is delegating the writing.

RH SIDEBAR FIELDS (the seven completion markers):
1. What's the Challenge? (diagnosis / summaryDiagnosis)
2. What's Causing It? (rootCause)
3. How Will We Solve It? (guidingPolicy / summaryGuidingPolicy)
4. A Practical Step (coherentActions / summaryCoherentActions)
5. Who's Affected? (whoAffected)
6. Evidence Base (research)
7. Proposed Wording (proposedWording)
${stageSection}

WHAT LEX NEVER DOES:
- Calls itself "Claude", "the AI", or "an AI assistant"
- Reveals the underlying model
- Fabricates citations
- Promises a user their idea will become law
- Uses "Parliament" as a stage name (Stage 5 = Legislate)
- Implies users can vote before Stage 4
- Uses "Comments" — always "Contributions"
- Uses "Problem" in user-facing language — always "Challenge" or "issue"
- Uses emojis
- Uses "impactful", "utilise", "going forward"`
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
  if (error) {
    console.error('[/api/ai/[ideaId]] Auth failed — user not found in DB or not signed in')
    return error
  }

  const { ideaId } = await params

  // Rate limit: 50 requests per hour per authenticated user
  const rateLimitKey = `ai:${user.id}`
  if (!checkRateLimit(rateLimitKey, 50, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded — you can send up to 50 messages per hour. Please try again later.' },
      { status: 429 },
    )
  }

  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    include: {
      coherentActions: { select: { id: true } },
      research: { select: { id: true } },
      collaborators: { select: { userId: true } },
    },
  })

  if (!idea) {
    console.error(`[/api/ai/[ideaId]] Idea not found: ${ideaId}`)
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
  const isStage1 = idea.stage === 'STAGE_1'

  // Build completed fields summary for system prompt
  const completedFieldsSummary = isStage1
    ? [
        idea.summaryDiagnosis && 'Challenge summary',
        idea.summaryGuidingPolicy && 'Guiding policy summary',
        idea.summaryCoherentActions && 'First action summary',
        idea.title && 'Title',
        idea.summaryDescription && 'Description',
        idea.govtArea && 'Govt area',
        idea.ideaType && 'Idea type',
      ].filter(Boolean).join(', ') || 'None yet'
    : [
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
  let aiProvider: 'GEMINI_FLASH' | 'GROK_FAST' = 'GEMINI_FLASH'

  // Primary: Gemini 2.5 Flash
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    console.error('[/api/ai/[ideaId]] GEMINI_API_KEY is not set — skipping to Grok fallback')
  }

  let geminiSucceeded = false
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey)
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
      geminiSucceeded = true
    } catch (geminiError) {
      console.error('[/api/ai/[ideaId]] Gemini failed:', geminiError)
    }
  }

  if (!geminiSucceeded) {
    // Fallback: Grok 3 Fast
    const grokKey = process.env.GROK_API_KEY
    if (!grokKey) {
      console.error('[/api/ai/[ideaId]] GROK_API_KEY is not set — both providers unavailable')
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
            { role: 'system', content: systemPrompt },
            ...recentHistory.map(m => ({
              role: m.role === 'lex' ? 'assistant' : 'user',
              content: m.content,
            })),
            { role: 'user', content: message },
          ],
        }),
      })

      if (!grokRes.ok) {
        const errBody = await grokRes.text().catch(() => '(unreadable)')
        console.error(`[/api/ai/[ideaId]] Grok returned ${grokRes.status}: ${errBody}`)
        return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
      }

      const grokData = await grokRes.json()
      const content = grokData.choices?.[0]?.message?.content
      if (!content) {
        console.error('[/api/ai/[ideaId]] Grok response missing choices:', JSON.stringify(grokData))
        return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
      }

      lexResponse = content
      aiProvider = 'GROK_FAST'
    } catch (grokError) {
      console.error('[/api/ai/[ideaId]] Grok fallback threw:', grokError)
      return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
    }
  }

  // Extract and strip fieldUpdates JSON from the response
  let visibleResponse = lexResponse!
  let fieldUpdates: Record<string, string | null> | null = null
  let triggerSavePrompt = false

  const jsonMatch = lexResponse!.match(/\{[\s\S]*"fieldUpdates"[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      fieldUpdates = parsed.fieldUpdates ?? null
      triggerSavePrompt = parsed.triggerSavePrompt === true
      visibleResponse = lexResponse!.replace(jsonMatch[0], '').trim()
    } catch {
      // JSON parse failed — serve response as-is without field updates
    }
  }

  // Build pendingProposals — DO NOT write to DB here.
  // Fields are written only on explicit user approval via /field-approval.
  const FIELD_LABELS: Record<string, string> = {
    title: 'Title',
    summaryDescription: 'Summary',
    summaryDiagnosis: "What's the Challenge?",
    summaryGuidingPolicy: 'How Will We Solve It?',
    summaryCoherentActions: 'A Practical Step',
    govtArea: 'Government Area',
    ideaType: 'Idea Type',
    diagnosis: "What's the Challenge?",
    guidingPolicy: 'How Will We Solve It?',
    rootCause: 'Root Cause',
    whoAffected: 'Who Is Affected?',
    proposedWording: 'Proposed Wording',
    'diagnosis.text': 'The Challenge (full)',
    'rootCause.text': 'Root Cause',
    'guidingPolicy.text': 'Guiding Policy (full)',
  }

  type PendingProposal = { fieldKey: string; fieldLabel: string; proposedValue: string }
  const pendingProposals: PendingProposal[] = []

  if (fieldUpdates) {
    for (const [key, value] of Object.entries(fieldUpdates)) {
      if (value === null || value === undefined || value === '') continue

      let fieldLabel = FIELD_LABELS[key]
      if (!fieldLabel) {
        if (key.startsWith('coherentActions')) {
          // Try to extract title from value if it's JSON
          try {
            const parsed = JSON.parse(String(value))
            fieldLabel = `Coherent Action: ${parsed.title ?? 'Action'}`
          } catch {
            fieldLabel = 'Coherent Action'
          }
        } else {
          fieldLabel = key
        }
      }

      pendingProposals.push({
        fieldKey: key,
        fieldLabel,
        proposedValue: String(value),
      })
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
      provider: aiProvider,
      model: aiProvider === 'GEMINI_FLASH' ? 'gemini-2.5-flash' : 'grok-3-fast-beta',
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
      summaryDiagnosis: true,
      summaryGuidingPolicy: true,
      summaryCoherentActions: true,
      whoAffected: true,
      proposedWording: true,
      coherentActions: { select: { id: true } },
      research: { select: { id: true } },
    },
  })

  const completedFields = {
    diagnosis: !!latest?.summaryDiagnosis || !!latest?.diagnosis,
    rootCause: !!latest?.rootCause,
    guidingPolicy: !!latest?.summaryGuidingPolicy || !!latest?.guidingPolicy,
    coherentActions: (latest?.coherentActions.length ?? 0) > 0 || !!latest?.summaryCoherentActions?.trim(),
    whoAffected: !!latest?.whoAffected,
    research: (latest?.research.length ?? 0) > 0,
    proposedWording: !!latest?.proposedWording,
  }

  // Compute triggerSavePrompt server-side so it fires even when the AI omits the flag.
  // Also fires if both key fields are in the pending proposals (not yet saved).
  const proposedKeys = new Set(pendingProposals.map(p => p.fieldKey))
  const serverTrigger = isStage1
    ? !!(latest?.summaryDiagnosis && latest?.summaryGuidingPolicy) ||
      (proposedKeys.has('summaryDiagnosis') && proposedKeys.has('summaryGuidingPolicy'))
    : !!(latest?.diagnosis && latest?.guidingPolicy)

  return NextResponse.json({
    response: visibleResponse,
    triggerSavePrompt: triggerSavePrompt || serverTrigger,
    completedFields,
    pendingProposals,
  })
}
