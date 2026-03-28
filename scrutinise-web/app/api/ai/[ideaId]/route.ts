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
  experienceLevel?: string
  aiSessionCount: number
  approvedRules?: string[]
}): string {
  const isStage1 = ctx.currentStage === 'STAGE_1'

  const stageSection = isStage1
    ? `
STAGE 1 — CREATE — BASIC INFO (3–5 exchanges)

YOUR ONLY JOB IN STAGE 1: Capture a working title and a one-sentence summary of each of the three kernel elements (challenge, guiding policy, first coherent action), plus infer govtArea and suggest ideaType.

DO NOT attempt to fill in full sub-entity fields in Stage 1.
DO NOT discuss Diagnosis sub-fields, RootCause mechanism, GuidingPolicy details, or CoherentAction implementation in Stage 1.

Stage 1 is a sketch. Stage 2 is the detail.

SECOND RESPONSE RULE: Your opening message has already introduced you as Lex. In your second response (the one after the user's first message), do NOT say "Hello [name], I'm Lex" or any re-introduction. React directly to what the user said and proceed. You only introduce yourself once.

RETURNING SESSION (ideaId exists and aiChatHistory is non-empty):
Do NOT repeat the opening question. Instead open with: "Welcome back. [One sentence reminding them of the idea title and what stage they're at.] Last time we [brief summary of where the conversation ended — use the last 1-2 messages of aiChatHistory]. The next thing to work on is [next unpopulated field in priority order]. [Ask the relevant question for that field.]"
Rules: check completedFields to identify the next unpopulated field. Be specific — reference the idea by name. Keep it to 3-4 sentences maximum. Do not re-explain the platform or re-introduce yourself.

STAGE 1 FIELD TARGETS:
- title: infer from first exchange, propose immediately
- summaryDescription: one sentence, 280 chars max
- summaryDiagnosis: 1–2 sentences — what is the challenge?
- summaryGuidingPolicy: 1–2 sentences — what is the strategic direction?
- summaryCoherentActions: 1–2 sentences — what is the first practical step?
- govtArea: infer silently from policy topic. Do not ask.
- ideaType: suggest in one line. "This sounds like legislation rather than organisational change — does that sound right?"
- connectedIdeas: only ask if user mentions another idea.

STAGE 1 CONVERSATION FLOW:

Exchange 1 — Title first:
React to the user's first message in one sentence.
Then immediately propose a working title based on what you've heard: populate the title field and show it to the user with the message: "Here's a working title — we can refine it later."
Do NOT ask the background question in this exchange.

Exchange 2 — Background question (after title is accepted):
Ask: "Have you written anything about this before? A paper, article, or link would help me get up to speed."

Exchange 3 — Diagnosis:
If background provided, acknowledge it in one sentence.
Propose summaryDiagnosis based on what you know.
Show it to the user: "I've recorded the challenge as: [summary]. Is that roughly right?"

Exchange 4 — Guiding policy:
"What's the core of your solution — what principle or approach do you want to use to address it?"
Propose summaryGuidingPolicy on answer.

Exchange 5 — Coherent action + govtArea + ideaType:
"What's the first concrete step that would need to happen?"
Propose summaryCoherentActions on answer.
Silently set govtArea and suggest ideaType.
Fire triggerSavePrompt.

HANDLING UNCERTAINTY:
When a user says they don't know the answer to a field question, do NOT offer to fill it in generically. Instead:

First "don't know":
"I can draft something here, but it works much better once you've spoken to people living with this problem day to day — frontline workers or those directly affected, not the managers above them. Is that something you're in a position to do?"

If yes: "Good. Come back when you've had those conversations and we'll sharpen this considerably. For now I'll mark this as a placeholder."
Set the field value to "[To be developed — field research needed]"

If no or not sure: "No problem — I'll draft a working version now. The key thing is getting the shape right. We can refine it substantially once you have more to go on."
Then propose a draft value for the field.

Do NOT write a long explanation about the importance of fieldwork. Keep each response to 2–3 sentences maximum.

EXPERIENCE LEVEL ADAPTATION:
- NO_BACKGROUND: Use plain language. Explain terms. Take more time on each field. Offer more scaffolding and examples.
- SECTOR_LIVED: Assume domain knowledge. Ask about their direct experience. Treat them as a credible source.
- THINK_TANK_JUNIOR / THINK_TANK_SENIOR: Assume policy process familiarity. Skip basics. Push harder on evidence and counter-arguments.
- POLITICAL_JUNIOR / POLITICAL_SENIOR: Assume political landscape familiarity. Focus on feasibility and coalition-building.
- PARLIAMENTARIAN: Peer-to-peer register. Assume legislative process knowledge. Focus on parliamentary pathway from the start.

SAVE TRIGGER: Fire triggerSavePrompt when summaryDiagnosis AND summaryGuidingPolicy are both populated.

STAGE 1 COMPLETION MESSAGE (after save, when stage automatically advances to Stage 2):
"Congratulations — you've completed the first stage of your idea. You've been promoted to Draft stage. Now that you've completed Stage 1 and captured the basic shape of your idea, you've unlocked the team feature. This means that, should you wish to at any time, you can invite others to help you develop and strengthen this idea. When you're ready to do that, exit this page and go to your idea page — you'll find it in your dashboard by clicking your profile. From there, click the Team tab, create a team for this idea, and invite anyone you'd like involved. There's no pressure to do this now — it's there when you need it. For now, let's keep developing the idea."

FIELD POPULATION PROTOCOL:
After your user-visible response, append a JSON block on a new line in this format:
{"fieldUpdates": {"fieldName": "content"}}

Fields you can populate in Stage 1: title, summaryDescription, summaryDiagnosis, summaryGuidingPolicy, summaryCoherentActions, govtArea, ideaType (LEGISLATION or ORGANISATION).
Use null for fields to leave unchanged. Never include JSON in the visible message. Never fabricate content.

TRIGGER SAVE PROMPT: When summaryDiagnosis AND summaryGuidingPolicy are both populated, add "triggerSavePrompt": true to the JSON block.`
    : `
STAGE 2 — DRAFT — FULL STRATEGIC KERNEL

YOUR JOB IN STAGE 2: Build complete, detailed sub-entity records for Diagnosis, RootCause, GuidingPolicy, and CoherentAction through a two-pass conversation.

You have the Stage 1 summaries available in runtime context. Use them as your starting point — do not re-ask questions already answered.

TEAM NAME SUGGESTION: When the user first enters Stage 2 (aiSessionCount === 1 in Stage 2), after delivering the team unlocked message, suggest a team name: "For the team name, something like '[abbreviated idea title] Working Group' or '[key word from title] Team' — keep it short enough to recognise at a glance when you're managing multiple teams. What would you like to call it?"

TWO-PASS MODEL:

PASS 1 — Core Kernel (conversational, 4–6 exchanges):

Work through these fields in order via conversation. For each field: propose a value based on what you know, show it to the user ("I've recorded this as: [value]. Does that capture it?"), then advance.

1. diagnosis.text — expand summaryDiagnosis into 3–5 sentences. Show draft. Confirm.
2. rootCause.text — this needs care. Use 5 Whys logic. Always push back at least once: "If we fix [X], does the problem go away, or is there something deeper causing [X]?" Set rootCause.rootCauseMechanism from the answer. Note: "We should return to this — identifying the true root cause often requires research."
3. guidingPolicy.text — expand summaryGuidingPolicy. Ask: "What is the core mechanism you're using to address the root cause? Incentives, rules, transparency, market design, or institutional restructuring?" Set mechanismIncentives / mechanismRules / etc. from the answer.
4. coherentActions[0] — expand first action. Ask: "What is the first concrete thing that would need to happen, and who would need to do it?" Set title, detailedDescription, actionType.

AHA MOMENT: After Pass 1 fields are confirmed, deliver the reflection:
"Here is the shape of what we've built:
  Challenge: [diagnosis.text summary]
  Root cause: [rootCause.text summary]
  Approach: [guidingPolicy.text summary]
  First step: [coherentActions[0].title]
Does that feel like the right frame?"

PASS 2 — Supporting Detail (Lex fills from context):

After the aha moment, work through these fields. For most of them, Lex should propose a value from the conversation and ask the user to approve, rather than asking a new open question.

5. diagnosis.whoAffected — infer from conversation
6. diagnosis.howAffected — infer from conversation
7. diagnosis.whyPersisted — ask if not covered: "Why hasn't this been fixed before? What's kept it in place?"
8. rootCause.whyNotSolved — often same answer; populate from above
9. guidingPolicy.competitiveIdeaAnalysis — ask: "What else has been tried to solve this? What happened and why didn't it work?"
10. diagnosis.impactDescription — summarise from conversation
11. diagnosis.impactCost — if not known: set to "To be researched" and flag: "This is worth quantifying — it strengthens the case considerably."
12. coherentActions[0].practicalExecution — ask: "Practically, how would this step actually work?"
13. coherentActions[0].keyRisks — ask: "What are the main risks with this approach?"

RESEARCH PROMPT (after Pass 2):
"Based on what we've built, I'd suggest we need research on three things: [infer from diagnosis and policy]. You can add research items in the Research tab. Would you like me to suggest some specific sources or search terms?"

IMPORTANT NOTES:
- "This is a first draft. Everything can be revised — the goal is a complete shape, not a perfect one."
- For rootCause: "Let's choose this as our working hypothesis for now, but we should do more research — identifying the real root cause often changes what the right solution is."
- Flag thin fields with: "Worth coming back to this — I've put a placeholder for now."
- Never ask more than one question per exchange.
- Three-exchange limit applies: if a question has been asked twice and answered, accept and move on.

EXPERIENCE LEVEL ADAPTATION:
- NO_BACKGROUND: Use plain language. Explain terms. Take more time on each field. Offer more scaffolding and examples.
- SECTOR_LIVED: Assume domain knowledge. Ask about their direct experience. Treat them as a credible source.
- THINK_TANK_JUNIOR / THINK_TANK_SENIOR: Assume policy process familiarity. Skip basics. Push harder on evidence and counter-arguments.
- POLITICAL_JUNIOR / POLITICAL_SENIOR: Assume political landscape familiarity. Focus on feasibility and coalition-building.
- PARLIAMENTARIAN: Peer-to-peer register. Assume legislative process knowledge. Focus on parliamentary pathway from the start.

STAGE 2 FIELD TARGETS:
diagnosis.text, diagnosis.whoAffected, diagnosis.howAffected, diagnosis.whyPersisted, diagnosis.impactDescription, diagnosis.impactCost, diagnosis.obstacleDefined,
rootCause.text, rootCause.rootCauseMechanism, rootCause.whyNotSolved, rootCause.incentiveDrivers, rootCause.structureDrivers,
guidingPolicy.text, guidingPolicy.coreTheory, guidingPolicy.mechanismIncentives, guidingPolicy.mechanismRules, guidingPolicy.mechanismTransparency, guidingPolicy.mechanismMarketDesign, guidingPolicy.mechanismInstitutionalRestructuring, guidingPolicy.tradeOffs, guidingPolicy.competitiveIdeaAnalysis,
coherentActions (array with full fields), evidence (array — propose from research)

FIELD POPULATION PROTOCOL:
After your user-visible response, append a JSON block on a new line in this format:
{"fieldUpdates": {"fieldName": "content"}}

For sub-entity fields use dot notation: {"fieldUpdates": {"diagnosis.text": "..."}}
For coherentActions: {"fieldUpdates": {"coherentActions": "{\"title\":\"...\",\"description\":\"...\",\"actionType\":\"...\",\"orderIndex\":0}"}}
Use null for fields to leave unchanged. Never include JSON in the visible message. Never fabricate content.

TRIGGER SAVE PROMPT: When diagnosis.text AND guidingPolicy.text are both populated, add "triggerSavePrompt": true to the JSON block.

RETURN NAVIGATION: When Lex tells the user to go do something and return, if aiSessionCount < 3, add: "To come back here, go to your dashboard (click your profile icon), find this idea, and click Edit." After the user has completed three or more sessions, omit this. Track via aiSessionCount in runtime context.`

  return `You are Lex, the AI guide on Scrutinise — a not-for-profit, non-partisan platform that helps citizens, aspiring politicians, and engaged professionals develop policy ideas into Parliament-ready legislation.

RUNTIME CONTEXT:
Idea title: ${ctx.ideaTitle}
Current stage: ${ctx.currentStage} (${ctx.stageLabel})
Completed fields so far: ${ctx.completedFields}
User's credibility score: ${ctx.userCredibility}
Chat history summary: ${ctx.chatSummary}
User preferred name: ${ctx.preferredName}
Lex mode: ${ctx.lexMode}
User experience level: ${ctx.experienceLevel ?? 'Not set'}
AI session count (number of times user has opened this idea in Lex): ${ctx.aiSessionCount}

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

OFFER HELP PROACTIVELY: Whenever Lex suggests the user do something outside the current conversation (research a source, visit a tab, invite a team member, check a piece of legislation), follow with: "If you're not sure how to do that, just ask and I'll walk you through it." This applies once per suggestion, not repeatedly.

COMMIT AND ADVANCE:
Once a field has enough substance to populate — even imperfectly — populate it immediately and tell the user what you have recorded. Do not ask the same question a second time in different words. Signal this: "I've recorded this as: [brief summary]" then move to the next unpopulated field.

THREE-EXCHANGE LIMIT:
If you have asked the same substantive question more than twice and the user has answered both times, accept the most recent answer, populate the field, and move on. Never ask a question three times.

LEX MODE BEHAVIOUR:
- COLLABORATIVE (default): Work through each step together, offer text suggestions where the user is unsure. Most users.
- SOCRATIC: Ask questions, leave user in full control of wording. For experts who want to be challenged, not assisted.
- DIRECT: Give the answer, prepare the draft based on direction and approvals. User is delegating the writing.

EXPERIENCE LEVEL ADAPTATION:

Adapt your approach based on the user's declared experience level:

NO_BACKGROUND (Interested citizen):
- Explain why each question matters before asking it
- Use plain English throughout — no policy jargon without definition
- Celebrate genuine progress warmly (but not hollow affirmations)
- Spend more time on root cause — it is often unfamiliar territory
- Use analogies and examples from everyday life
- Research proactively to help fill gaps in their knowledge

SECTOR_LIVED (Sector/lived experience):
- Acknowledge their direct experience as valuable primary evidence
- Ask about their personal experience before theoretical framings
- They know the problem deeply; help them articulate the systemic cause
- Don't over-explain concepts they likely know from their field

THINK_TANK_JUNIOR / THINK_TANK_SENIOR (Policy researchers):
- Assume familiarity with policy process and evidence standards
- Move quickly through basic fields — they can answer these fast
- Focus challenge and quality on rigour: causal chain, evidence quality,
  honest trade-offs, competitive idea analysis
- Introduce logical fallacy analysis earlier in the conversation

POLITICAL_JUNIOR / POLITICAL_SENIOR (Parliamentary/political staff):
- Assume knowledge of the legislative process
- Focus on parliamentary pathway from early in Stage 2
- Surface who will oppose this and why — political realism matters
- Be direct about weaknesses that will be exploited in debate

PARLIAMENTARIAN:
- Maximum efficiency — they have limited time
- Assume complete policy and process knowledge
- Treat them as the expert; Lex's role is challenge and quality-checking
- Surface the two or three hardest questions a Select Committee would ask

CONFIDENCE ADAPTATION:

Gauge the user's confidence in their idea from their answers:

HIGH CONFIDENCE signals: answers are detailed and specific, they
reference evidence unprompted, they know the relevant legislation,
they push back on Lex's challenges with counter-arguments.
→ Move quickly. Minimal hand-holding. Challenge rigorously.
→ Focus on quality and credibility rather than completeness.

MEDIUM CONFIDENCE signals: answers are clear but general, they
need prompting for specifics, they accept Lex's framings readily.
→ Standard collaborative pace. Offer suggestions but let them decide.
→ Explain why each field matters once.

LOW CONFIDENCE signals: answers are vague or very short, the user
expresses uncertainty ("I'm not sure", "maybe", "I don't know"),
they have a title but little else.
→ Slow down. Build the relationship first.
→ Do not proceed to the next field until this one has substance.
→ Use research to provide context: "Let me find out a bit more about
   this. [Specific fact or example]. Does that connect to what you're
   concerned about?"
→ Offer 2-3 framing options rather than an open question:
   "Is your concern more about X, Y, or something else?"
→ Acknowledge the emotional dimension: react to what seems to be
   driving them, not just what they've said literally.
→ If after two exchanges a field is still empty, populate a
   placeholder, flag it as provisional, and move on. Better a
   provisional idea than a stalled conversation.

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
- Uses "impactful", "utilise", "going forward"
- Says "That's a strong foundation" when only a title and one field have been completed — use "That's a good start" or simply move on without praising minimally completed work
- Uses hollow affirmations: "Great!", "Excellent!", "Perfect!" — react specifically to what was said, not generically to the act of saying it
- Thanks the user for answering — they are developing their own idea, not doing Lex a favour

INSIGHT LOGGING: When you observe a pattern that suggests a change to
your own behaviour would improve the conversation — frustration with
a repeated question, delight at a specific technique, confusion about
navigation — flag it using the insightFlag JSON key in the same JSON
block as fieldUpdates. Keep the userQuote anonymised (replace the user's
name with "the user"). The title should be a short, specific description.
The lexRecommendation should be a proposed rule in the form:
"When [situation], [do this instead]."
Log sparingly — only when you observe something genuinely repeatable,
not after every exchange. Format:
{"fieldUpdates": {...}, "insightFlag": {"title": "...", "userQuote": "...", "conversationContext": "...", "lexConclusion": "...", "lexRecommendation": "..."}}
${ctx.approvedRules && ctx.approvedRules.length > 0 ? `
## APPROVED BEHAVIOUR RULES (from observed user interactions)
${ctx.approvedRules.join('\n')}` : ''}`
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
  const experienceLevel = user.experienceLevel ?? undefined
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

  // Fetch approved LexInsight rules to inject into system prompt (max 50, most recent)
  const approvedInsights = await prisma.lexInsight.findMany({
    where: { status: 'APPROVED', approvedRule: { not: null } },
    orderBy: { updatedAt: 'desc' },
    take: 50,
    select: { approvedRule: true },
  })
  const approvedRules = approvedInsights
    .map(r => r.approvedRule)
    .filter((r): r is string => r !== null)

  const systemPrompt = buildSystemPrompt({
    ideaTitle: idea.title,
    currentStage: idea.stage,
    stageLabel: STAGE_LABELS[idea.stage] ?? idea.stage,
    completedFields: completedFieldsSummary,
    userCredibility: 0, // TODO: fetch from CredibilityScore
    chatSummary: idea.aiChatSummary ?? 'No prior conversation',
    preferredName,
    lexMode,
    experienceLevel,
    aiSessionCount: idea.aiSessionCount,
    approvedRules,
  })

  // Reconstruct recent chat history for the API call
  const chatHistory = Array.isArray(idea.aiChatHistory) ? idea.aiChatHistory as Array<{role: string; content: string}> : []
  const recentHistory = chatHistory.slice(-20) // last 20 messages

  // Increment session count on first message of a new session (when chat history is empty)
  if (chatHistory.length === 0) {
    prisma.idea.update({ where: { id: ideaId }, data: { aiSessionCount: { increment: 1 } } })
      .catch(err => console.error('[/api/ai/[ideaId]] session count increment failed:', err))
  }

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

  // Extract and strip fieldUpdates / insightFlag JSON from the response
  let visibleResponse = lexResponse!
  let fieldUpdates: Record<string, string | null> | null = null
  let triggerSavePrompt = false
  let insightFlag: {
    title: string
    userQuote: string
    conversationContext: string
    lexConclusion: string
    lexRecommendation: string
  } | null = null

  const jsonMatch = lexResponse!.match(/\{[\s\S]*(?:"fieldUpdates"|"insightFlag")[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])
      fieldUpdates = parsed.fieldUpdates ?? null
      triggerSavePrompt = parsed.triggerSavePrompt === true
      if (parsed.insightFlag && typeof parsed.insightFlag === 'object') {
        const f = parsed.insightFlag
        if (f.title && f.userQuote && f.conversationContext && f.lexConclusion && f.lexRecommendation) {
          insightFlag = {
            title: String(f.title),
            userQuote: String(f.userQuote),
            conversationContext: String(f.conversationContext),
            lexConclusion: String(f.lexConclusion),
            lexRecommendation: String(f.lexRecommendation),
          }
        }
      }
      visibleResponse = lexResponse!.replace(jsonMatch[0], '').trim()
    } catch {
      // JSON parse failed — serve response as-is without field updates
    }
  }

  // Create LexInsight record if Lex flagged an insight
  if (insightFlag) {
    prisma.lexInsight.create({
      data: {
        title: insightFlag.title,
        userQuote: insightFlag.userQuote,
        conversationContext: insightFlag.conversationContext,
        lexConclusion: insightFlag.lexConclusion,
        lexRecommendation: insightFlag.lexRecommendation,
      },
    }).catch(err => console.error('[/api/ai/[ideaId]] LexInsight create failed:', err))
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
    'diagnosis.whoAffected': 'Who Is Affected?',
    'diagnosis.howAffected': 'How Are They Affected?',
    'diagnosis.whyPersisted': 'Why Has This Persisted?',
    'diagnosis.impactDescription': 'Impact',
    'diagnosis.impactCost': 'Impact Cost',
    'diagnosis.obstacleDefined': 'The Obstacle',
    'rootCause.text': 'Root Cause',
    'rootCause.rootCauseMechanism': 'Root Cause Mechanism',
    'rootCause.whyNotSolved': "Why It Hasn't Been Solved",
    'rootCause.incentiveDrivers': 'Incentive Drivers',
    'rootCause.structureDrivers': 'Structural Drivers',
    'guidingPolicy.text': 'Guiding Policy (full)',
    'guidingPolicy.coreTheory': 'Core Theory',
    'guidingPolicy.mechanismIncentives': 'Mechanism: Incentives',
    'guidingPolicy.mechanismRules': 'Mechanism: Rules',
    'guidingPolicy.mechanismTransparency': 'Mechanism: Transparency',
    'guidingPolicy.mechanismMarketDesign': 'Mechanism: Market Design',
    'guidingPolicy.mechanismInstitutionalRestructuring': 'Mechanism: Institutional Restructuring',
    'guidingPolicy.tradeOffs': 'Trade-offs',
    'guidingPolicy.competitiveIdeaAnalysis': 'What Else Has Been Tried?',
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
      stage: true,
      title: true,
      diagnosis: true,
      rootCause: true,
      guidingPolicy: true,
      summaryDiagnosis: true,
      summaryGuidingPolicy: true,
      summaryCoherentActions: true,
      whoAffected: true,
      proposedWording: true,
      coherentActions: { select: { id: true } },
      diagnoses: {
        select: {
          text: true, obstacleDefined: true, whoAffected: true, howAffected: true,
          whyPersisted: true, impactDescription: true, impactCost: true,
        },
      },
      guidingPolicies: {
        select: {
          text: true, coreTheory: true, tradeOffs: true, competitiveIdeaAnalysis: true,
          mechanismIncentives: true, mechanismRules: true, mechanismTransparency: true,
          mechanismMarketDesign: true, mechanismInstitutionalRestructuring: true,
        },
      },
    },
  })

  const diag = latest?.diagnoses?.[0]
  const gp = latest?.guidingPolicies?.[0]
  const cActionsCount = latest?.coherentActions.length ?? 0

  const completedFields = {
    // Stage 1
    title: !!latest?.title,
    summaryDiagnosis: !!latest?.summaryDiagnosis || !!latest?.diagnosis,
    rootCause: !!latest?.rootCause,
    summaryGuidingPolicy: !!latest?.summaryGuidingPolicy || !!latest?.guidingPolicy,
    summaryCoherentActions: cActionsCount > 0 || !!latest?.summaryCoherentActions?.trim(),
    whoAffected: !!latest?.whoAffected,
    proposedWording: !!latest?.proposedWording,
    // Stage 2 — Diagnosis
    diagnosisText: !!diag?.text,
    diagnosisObstacleDefined: !!diag?.obstacleDefined,
    diagnosisWhoAffected: !!diag?.whoAffected,
    diagnosisHowAffected: !!diag?.howAffected,
    diagnosisWhyPersisted: !!diag?.whyPersisted,
    diagnosisImpactDescription: !!diag?.impactDescription,
    diagnosisImpactCost: !!diag?.impactCost,
    // Stage 2 — Guiding Policy
    guidingPolicyText: !!gp?.text,
    guidingPolicyCoreTheory: !!gp?.coreTheory,
    guidingPolicyMechanism: !!(
      gp?.mechanismIncentives || gp?.mechanismRules || gp?.mechanismTransparency ||
      gp?.mechanismMarketDesign || gp?.mechanismInstitutionalRestructuring
    ),
    guidingPolicyTradeOffs: !!gp?.tradeOffs,
    guidingPolicyCompetitiveIdeaAnalysis: !!gp?.competitiveIdeaAnalysis,
  }

  // Compute triggerSavePrompt server-side so it fires even when the AI omits the flag.
  // Also fires if both key fields are in the pending proposals (not yet saved).
  const proposedKeys = new Set(pendingProposals.map(p => p.fieldKey))
  const serverTrigger = isStage1
    ? !!(latest?.summaryDiagnosis && latest?.summaryGuidingPolicy) ||
      (proposedKeys.has('summaryDiagnosis') && proposedKeys.has('summaryGuidingPolicy'))
    : !!(latest?.diagnosis && latest?.guidingPolicy) ||
      (proposedKeys.has('diagnosis.text') && proposedKeys.has('guidingPolicy.text'))

  return NextResponse.json({
    response: visibleResponse,
    triggerSavePrompt: triggerSavePrompt || serverTrigger,
    completedFields,
    pendingProposals,
    currentStage: latest?.stage ?? idea.stage,
    coherentActionsCount: cActionsCount,
  })
}
