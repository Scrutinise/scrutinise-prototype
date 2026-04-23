import { NextResponse } from 'next/server'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkAndAdvanceStage } from '@/lib/stage-gates'
import { checkRateLimit } from '@/lib/rateLimit'

function classifyError(error: unknown): string {
  const msg = String(error).toLowerCase()
  if (msg.includes('timeout') || msg.includes('etimedout')) return 'timeout'
  if (msg.includes('rate') || msg.includes('429')) return 'rate_limit'
  if (msg.includes('network') || msg.includes('econnrefused')) return 'network'
  return 'api_error'
}

async function logAICall(params: {
  provider: string
  success: boolean
  durationMs: number
  errorType?: string
  fallbackUsed?: boolean
  ideaId?: string
}) {
  Sentry.captureEvent({
    message: 'lex_ai_call',
    level: params.success ? 'info' : 'warning',
    extra: {
      provider: params.provider,
      ideaId: params.ideaId ?? null,
      success: params.success,
      durationMs: params.durationMs,
      errorType: params.errorType ?? null,
      fallbackUsed: params.fallbackUsed ?? false,
    },
  })
}

type Params = { params: Promise<{ ideaId: string }> }

const MessageSchema = z.object({
  message: z.string().min(1).max(4000),
  currentFieldKey: z.string().nullable().optional(),
  currentFieldLabel: z.string().nullable().optional(),
  currentFieldSection: z.string().nullable().optional(),
  legislationContext: z.array(z.object({
    actTitle: z.string(),
    sectionNumber: z.string(),
    sectionTitle: z.string(),
    compiledText: z.string(),
  })).optional(),
})

// Build the Lex system prompt injected with runtime context (v6.0 + V2H-B1 + V2J-C1)
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
  currentFieldKey?: string | null
  currentFieldLabel?: string | null
  currentFieldSection?: string | null
  legislationContext?: Array<{
    actTitle: string
    sectionNumber: string
    sectionTitle: string
    compiledText: string
  }>
}): string {
  const isStage1 = ctx.currentStage === 'STAGE_1'

  // V2K-D2 — userProfiling step: special instruction injected instead of standard field instruction
  const userProfilingInstruction = ctx.currentFieldKey === 'userProfiling' ? `

CURRENT TASK — USER PROFILING:
You are now gathering background information about the user to calibrate the support you give them. Start by saying:
"It would be helpful to understand a bit about you and your idea so I can give you the right support. Is that okay? If you'd rather just get started, just say so."

If they agree, ask open questions in this priority order, adapting naturally based on what they tell you. Do not ask multiple questions at once — ask one at a time and build on their answers:

0. "Tell me about your background, what you want to change, and why."
1. After that: What level of support do they want? Full guidance step-by-step, expert assistant who checks their work, or something in between?
2. More about the specific idea
3. More about their background and why this matters to them
4. How familiar are they with the policy/legislative process?
5. Have they published or campaigned on this before?

Once you have a reasonable picture — or if they say they want to move on — synthesise what you've learned into 3-5 sentences covering: their background/expertise, what they want to change and why, their familiarity with the process, and the level of support they want. Then say: "Thanks — that's really helpful. Let's move to the proposal." The platform will then save your synthesis and advance to the first field.

IMPORTANT: The synthesis you produce at the end of this step will be stored. Format the synthesis as a JSON object on its own line (in addition to the fieldProposal):
{"fieldProposal": {"fieldKey": "userProfiling", "fieldLabel": "User Profiling", "proposedValue": "..."}, "userAdditionalNotes": "[synthesis text here]"}

Where proposedValue contains the same synthesis text as userAdditionalNotes.
` : ''

  // V2H-B1 — dynamic single-field instruction (platform controls field sequence)
  const fieldInstruction = ctx.currentFieldKey && ctx.currentFieldKey !== 'userProfiling' ? `

CURRENT TASK — FILL ONE FIELD ONLY:
You are currently helping the user fill this single field:
  Field: ${ctx.currentFieldLabel}
  Section: ${ctx.currentFieldSection}
  Key: ${ctx.currentFieldKey}

YOUR ONLY JOB RIGHT NOW:
1. If this is the first message on this field (no recent user input about it), orient the user briefly (1 sentence max) about what this field is for, then ask a focused question to elicit the information needed.
2. As the conversation develops, gather what you need through follow-up questions. Stay on this field — do not ask about any other field.
3. When you have enough information to propose a value, output a fieldProposal JSON block:
   {"fieldProposal": {"fieldKey": "${ctx.currentFieldKey}", "fieldLabel": "${ctx.currentFieldLabel}", "proposedValue": "..."}}
4. Once the user accepts (you will receive "Accepted: ${ctx.currentFieldLabel}"), output fieldUpdates:
   {"fieldUpdates": {"${ctx.currentFieldKey}": "the accepted value"}, "fieldProposal": null}
   Then STOP. Do not propose the next field. Do not ask another question. The platform will tell you what to do next.

CRITICAL: You must NEVER include fieldProposal or fieldUpdates for any key other than "${ctx.currentFieldKey}". The platform controls sequencing. If the user tries to discuss a different field, acknowledge it briefly and redirect: "We'll get to that — for now let's finish [current field]."

EVIDENCE NUDGING: If the user makes a factual assertion while filling the Diagnosis or Guiding Policy fields, ask once: "Do you have evidence or sources that support this?" Do not repeat.

SCOPE BOUNDARIES — NEVER discuss these in the Lex chat:
- Team names, team membership, inviting collaborators
- Sharing settings or privacy settings
- Voting, endorsements, or credibility scores
- Any platform features not directly related to filling idea fields
If the user asks about these, tell them: "That's managed in the relevant tab — I'm focused on helping you build the idea content."
${ctx.legislationContext && ctx.legislationContext.length > 0 ? `
RELEVANT LEGISLATION FOUND:
The platform has identified the following legislation as potentially relevant to this idea. Reference it naturally where appropriate.
Do NOT invent or hallucinate legislation not listed here.
Do NOT claim this is definitive — always note it should be verified.
${ctx.legislationContext.map(l => `--- ${l.actTitle} — Section ${l.sectionNumber}: ${l.sectionTitle}\n${l.compiledText.slice(0, 800)}`).join('\n')}
When surfacing this to the user at summary/diagnosis stages, say something like:
"I've found a section of [Act] that may be relevant — [brief description]. We'll look at this more carefully when we reach the Coherent Actions stage."
At the Coherent Actions stage, say:
"To implement this action, you'll likely need to amend [Act] s.[X] — [section title]. Here's what it currently says: [brief quote]. Would you like me to draft proposed amendment wording?"
` : ''}` : `
You are Lex, Scrutinise's AI assistant. All fields are complete for this session. Help the user refine their idea, answer questions about the process, or prepare for the next stage.

SCOPE BOUNDARIES — NEVER discuss these in the Lex chat:
- Team names, team membership, inviting collaborators
You are Lex, Scrutinise's AI assistant. All fields are complete for this session. Help the user refine their idea, answer questions about the process, or prepare for the next stage.

SCOPE BOUNDARIES — NEVER discuss these in the Lex chat:
- Team names, team membership, inviting collaborators
- Sharing settings or privacy settings
- Voting, endorsements, or credibility scores
- Any platform features not directly related to filling idea fields
If the user asks about these, tell them: "That's managed in the relevant tab — I'm focused on helping you build the idea content."
`

  const stageSection = isStage1
    ? `
STAGE 1 — CREATE — BASIC INFO (3–5 exchanges)

YOUR ONLY JOB IN STAGE 1: Capture a working title and a one-sentence summary of each of the three kernel elements (challenge, guiding policy, first coherent action), plus infer govtArea and suggest ideaType.

DO NOT attempt to fill in full sub-entity fields in Stage 1.
DO NOT discuss Diagnosis sub-fields, RootCause mechanism, GuidingPolicy details, or CoherentAction implementation in Stage 1.

Stage 1 is a sketch. Stage 2 is the detail.

SECOND RESPONSE RULE: Your opening message has already introduced you as Lex. In your second response (the one after the user's first message), do NOT say "Hello [name], I'm Lex" or any re-introduction. React directly to what the user said and proceed. You only introduce yourself once.

ORIENTEERING ON RETURN — THIS IS MANDATORY when aiSessionCount > 0:

You MUST NOT use the Stage 1 opening question ("What is the challenge you want to overcome?")
when returning to an existing idea. This idea already exists. The user has been here before.

Your FIRST message when aiSessionCount > 0 must follow this EXACT structure:
1. "Welcome back, [preferredName]."
2. One sentence: what was last worked on (draw from chatSummary or last message in aiChatHistory).
   If aiChatHistory has entries referencing the overview/title/summary, say "Last time we worked on the overview."
   If diagnosis fields have content, say "Last time we made progress on the diagnosis."
3. One sentence: what comes next. Name the next empty field using its user-friendly label.
4. "Shall we continue?"

EXAMPLE (Stage 1, overview complete, diagnosis not started):
"Welcome back, Charles. Last time we worked on the overview and gave your idea its first shape.
Next up is the Diagnosis — identifying the challenge you want to address and its root causes.
Shall we continue?"

NEVER say "let's develop another idea" or "What is the challenge" to a returning user.
NEVER re-introduce yourself to a returning user.

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

JSON OUTPUT FORMAT: Always append your JSON block at the very end of your response text, after all conversational content. Never put JSON in the middle of your response. Wrap the JSON block in \`\`\`json \`\`\` markers.

FIELD POPULATION PROTOCOL:
After your user-visible response, append a JSON block at the very end in this format:
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
3. guidingPolicy.text — expand summaryGuidingPolicy. Ask: "What is the core mechanism you're using to address the root cause? Incentives, rules, transparency, market design, or institutional restructuring?" Set mechanismTypes from the answer (array of enum values e.g. ["RULES", "INCENTIVES"]).
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
guidingPolicy.text, guidingPolicy.coreTheory, guidingPolicy.mechanismTypes (array), guidingPolicy.tradeOffs, guidingPolicy.competitiveIdeaAnalysis, guidingPolicy.linkToDiagnosis, guidingPolicy.whatThisPolicyRulesOut, guidingPolicy.whyThisApproachNotOthers, guidingPolicy.conditionsForSuccess,
coherentActions (array with full fields including mechanismType per action), evidence (array — propose from research)

JSON OUTPUT FORMAT: Always append your JSON block at the very end of your response text, after all conversational content. Never put JSON in the middle of your response. Wrap the JSON block in \`\`\`json \`\`\` markers.

FIELD POPULATION PROTOCOL:
After your user-visible response, append a JSON block at the very end in this format:
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

PROACTIVE RESEARCH AND ENGAGEMENT (particularly for early stages
and lower-confidence users):

Lex should use its knowledge to surface surprising, specific, and
relevant facts that help the user understand their own idea better.
This is not padding — it is demonstrating value and building trust.

WHEN TO USE THIS:
- When a user's answer is vague, research helps clarify framing
- When a user is uncertain, an interesting fact can re-engage them
- When a user seems disengaged, a surprising statistic or irony
  can restart the conversation
- In the first 3-4 exchanges with any new user, prioritise this
  to establish Lex's value

WHAT TO SURFACE:
- Unexpected statistics about the scale of the problem
- Previous attempts to solve the same problem (anywhere in the world)
  and what happened — especially failures
- Ironies and paradoxes: "Interestingly, the UK actually led the world
  on this in the 1990s but then reversed the policy because..."
- Named individuals or organisations who have tried this: who, when,
  what happened, why it matters
- Cost comparisons that reframe the problem: "The annual cost of
  inaction on this is roughly equivalent to..."
- Comic or surprising observations that fit someone with this concern
  — use sparingly and only when the user's tone has been light

HOW TO USE THIS:
- One interesting fact or observation per exchange, at most
- Integrate it naturally: "You might be interested to know that..."
  or "This is a problem Denmark tried to solve in 2007 — what they
  found was..." — not as a list
- Then connect it to the question: "Does that change how you're
  thinking about the root cause?"
- Do not use this to avoid asking the real question — use it to
  enrich the question

WHAT NEVER TO DO:
- Fabricate statistics or cite specific numbers without being
  confident they are accurate
- Use this to pad responses when you should be advancing
- Deploy interesting facts at the expense of the user's own voice
  — their experience is primary

RH SIDEBAR FIELDS (the seven completion markers):
1. What's the Challenge? (diagnosis / summaryDiagnosis)
2. What's Causing It? (rootCause)
3. How Will We Solve It? (guidingPolicy / summaryGuidingPolicy)
4. A Practical Step (coherentActions / summaryCoherentActions)
5. Who's Affected? (whoAffected)
6. Evidence Base (research)
7. Proposed Wording (proposedWording)
${stageSection}
${fieldInstruction}${userProfilingInstruction}

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

// Streaming Gemini call
async function* callGeminiStream(systemPrompt: string, userMessage: string, history: Array<{role: string; content: string}>) {
  const apiKey = process.env.GEMINI_API_KEY!
  const model = 'gemini-2.5-flash'

  const contents = [
    ...history.map(m => ({
      role: m.role === 'lex' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    { role: 'user', parts: [{ text: userMessage }] },
  ]

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
      }),
    }
  )

  if (!response.ok || !response.body) throw new Error(`Gemini error: ${response.status}`)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const json = JSON.parse(line.slice(6))
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) yield text
        } catch {}
      }
    }
  }
}

// Grok fallback (non-streaming)
async function callGrok(systemPrompt: string, userMessage: string, history: Array<{role: string; content: string}>): Promise<string> {
  const grokKey = process.env.GROK_API_KEY
  if (!grokKey) throw new Error('GROK_API_KEY not set')

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
        ...history.map(m => ({
          role: m.role === 'lex' ? 'assistant' : 'user',
          content: m.content,
        })),
        { role: 'user', content: userMessage },
      ],
    }),
  })

  if (!grokRes.ok) {
    const errBody = await grokRes.text().catch(() => '(unreadable)')
    throw new Error(`Grok error ${grokRes.status}: ${errBody}`)
  }

  const grokData = await grokRes.json()
  const content = grokData.choices?.[0]?.message?.content
  if (!content) throw new Error('Grok response missing content')
  return content
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

  const { message, currentFieldKey, currentFieldLabel, currentFieldSection, legislationContext } = parsed.data
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

  // Reconstruct recent chat history for the API call
  const chatHistory = Array.isArray(idea.aiChatHistory) ? idea.aiChatHistory as Array<{role: string; content: string; timestamp?: string}> : []
  const recentHistory = chatHistory.slice(-20) // last 20 messages

  // Detect new session (first message in >30 mins)
  const lastMessageTime = chatHistory.length > 0
    ? new Date((chatHistory.at(-1) as { timestamp?: string })?.timestamp ?? 0)
    : null
  const isNewSession = !lastMessageTime || (Date.now() - lastMessageTime.getTime() > 30 * 60 * 1000)

  if (isNewSession) {
    await prisma.idea.update({
      where: { id: ideaId },
      data: { aiSessionCount: { increment: 1 } },
    })
    idea.aiSessionCount = (idea.aiSessionCount ?? 0) + 1
  }

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
    currentFieldKey: currentFieldKey ?? null,
    currentFieldLabel: currentFieldLabel ?? null,
    currentFieldSection: currentFieldSection ?? null,
    legislationContext: legislationContext ?? undefined,
  })

  const startTime = Date.now()
  const geminiKey = process.env.GEMINI_API_KEY

  // Helper: parse field updates and save chat history
  async function applyFieldUpdatesAndSave(fullText: string): Promise<{
    displayText: string
    fieldUpdates: Record<string, string | null> | null
    triggerSavePrompt: boolean
    pendingProposals: Array<{ fieldKey: string; fieldLabel: string; proposedValue: string }>
    fieldProposal: { fieldKey: string; fieldLabel: string; proposedValue: string } | null
  } & { userAdditionalNotes: string | null }> {
    let displayText = fullText
    let fieldUpdates: Record<string, string | null> | null = null
    let triggerSavePrompt = false
    let fieldProposal: { fieldKey: string; fieldLabel: string; proposedValue: string } | null = null
    let userAdditionalNotes: string | null = null
    let insightFlag: {
      title: string; userQuote: string; conversationContext: string;
      lexConclusion: string; lexRecommendation: string
    } | null = null

    let jsonStr: string | null = null
    // Try markdown code block first (```json ... ```)
    const codeBlock = fullText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (codeBlock) {
      jsonStr = codeBlock[1]
    } else {
      // Try inline JSON containing known keys
      const inline = fullText.match(/\{[^{}]*(?:"fieldUpdates"|"fieldProposal"|"insightFlag")[^{}]*(?:\{[^{}]*\}[^{}]*)?\}/)
      jsonStr = inline?.[0] ?? null
    }
    if (jsonStr) {
      try {
        const parsedJson = JSON.parse(jsonStr)
        fieldUpdates = parsedJson.fieldUpdates ?? null
        triggerSavePrompt = parsedJson.triggerSavePrompt === true
        // Extract fieldProposal (new Lex field protocol, V2-D)
        if (parsedJson.fieldProposal && typeof parsedJson.fieldProposal === 'object') {
          const fp = parsedJson.fieldProposal
          if (fp.fieldKey && fp.fieldLabel && fp.proposedValue) {
            fieldProposal = {
              fieldKey: String(fp.fieldKey),
              fieldLabel: String(fp.fieldLabel),
              proposedValue: String(fp.proposedValue),
            }
          }
        }
        // V2K-D2 — extract userAdditionalNotes from userProfiling step
        if (parsedJson.userAdditionalNotes && typeof parsedJson.userAdditionalNotes === 'string') {
          userAdditionalNotes = parsedJson.userAdditionalNotes
        }
        if (parsedJson.insightFlag && typeof parsedJson.insightFlag === 'object') {
          const f = parsedJson.insightFlag
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
        displayText = fullText.replace(jsonStr, '').trim()
      } catch {
        // JSON parse failed — serve as-is
      }
    }

    // Strip any remaining markdown code fence markers from display text
    displayText = displayText
      .replace(/```json[\s\S]*?```/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .trim()

    // V2K-D2 — persist userAdditionalNotes when extracted from userProfiling step
    if (userAdditionalNotes) {
      prisma.idea.update({
        where: { id: ideaId },
        data: { userAdditionalNotes },
      }).catch(err => console.error('[/api/ai/[ideaId]] userAdditionalNotes write failed:', err))
    }

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

    // Persist direct Idea fields from fieldUpdates to DB (V2F-A1 fix)
    if (fieldUpdates) {
      const DIRECT_IDEA_FIELDS = new Set([
        'title', 'summaryDescription', 'summaryDiagnosis', 'summaryGuidingPolicy',
        'summaryCoherentActions', 'govtArea', 'ideaType', 'whoAffected', 'proposedWording',
        'diagnosis', 'rootCause', 'guidingPolicy', 'userAdditionalNotes',
      ])
      const toUpdate: Record<string, string> = {}
      for (const [key, value] of Object.entries(fieldUpdates)) {
        if (value && DIRECT_IDEA_FIELDS.has(key)) toUpdate[key] = String(value)
      }
      if (Object.keys(toUpdate).length > 0) {
        await prisma.idea.update({ where: { id: ideaId }, data: toUpdate }).catch(
          err => console.error('[/api/ai/[ideaId]] fieldUpdates DB write failed:', err)
        )
      }
      // Persist mechanismType to most recent CoherentAction (V2G-A1)
      if (fieldUpdates['mechanismType']) {
        const lastCA = await prisma.coherentAction.findFirst({
          where: { ideaId },
          orderBy: { createdAt: 'desc' },
        })
        if (lastCA) {
          const enumVal = String(fieldUpdates['mechanismType']) as
            'INCENTIVES' | 'RULES' | 'TRANSPARENCY' | 'MARKET_DESIGN' | 'INSTITUTIONAL_RESTRUCTURING'
          await prisma.coherentAction.update({
            where: { id: lastCA.id },
            data: { mechanismType: enumVal },
          }).catch(err => console.error('[/api/ai/[ideaId]] mechanismType write failed:', err))
        }
      }
    }

    const FIELD_LABELS: Record<string, string> = {
      title: '1. Title',
      summaryDescription: '2. Summary Description',
      govtArea: '3. Government Area',
      ideaType: '4. Idea Type',
      summaryDiagnosis: "5. What's the Challenge?",
      summaryGuidingPolicy: '12. How Will We Solve It?',
      summaryCoherentActions: '20. A Practical Step',
      diagnosis: "5. What's the Challenge?",
      guidingPolicy: '12. How Will We Solve It?',
      rootCause: 'Root Cause',
      whoAffected: "7. Who's Affected?",
      proposedWording: 'Proposed Wording',
      mechanismType: '20a. Mechanism Type',
      'diagnosis.text': "5. What's the Challenge?",
      'diagnosis.obstacleDefined': '6. The Obstacle',
      'diagnosis.whoAffected': "7. Who's Affected?",
      'diagnosis.howAffected': '8. How Are They Affected?',
      'diagnosis.whyPersisted': '9. Why Has This Persisted?',
      'diagnosis.impactDescription': '10. Impact',
      'diagnosis.impactCost': '11. Impact Cost',
      'rootCause.text': 'Root Cause',
      'rootCause.rootCauseMechanism': 'Root Cause Mechanism',
      'rootCause.whyNotSolved': "Why It Hasn't Been Solved",
      'rootCause.incentiveDrivers': 'Incentive Drivers',
      'rootCause.structureDrivers': 'Structural Drivers',
      'guidingPolicy.text': '12. How Will We Solve It?',
      'guidingPolicy.coreTheory': '13. Core Theory',
      'guidingPolicy.mechanismTypes': '14. Mechanism Types',
      'guidingPolicy.tradeOffs': '15. Trade-offs',
      'guidingPolicy.whyThisApproachNotOthers': '16. Why Not Other Approaches?',
      'guidingPolicy.linkToDiagnosis': '17. Link to Diagnosis',
      'guidingPolicy.whatThisPolicyRulesOut': '18. What This Policy Rules Out',
      'guidingPolicy.conditionsForSuccess': '19. Conditions for Success',
      'guidingPolicy.competitiveIdeaAnalysis': 'Competing Approaches',
    }

    const pendingProposals: Array<{ fieldKey: string; fieldLabel: string; proposedValue: string }> = []
    if (fieldUpdates) {
      for (const [key, value] of Object.entries(fieldUpdates)) {
        if (value === null || value === undefined || value === '') continue
        let fieldLabel = FIELD_LABELS[key]
        if (!fieldLabel) {
          if (key.startsWith('coherentActions')) {
            try {
              const parsedAction = JSON.parse(String(value))
              fieldLabel = `Coherent Action: ${parsedAction.title ?? 'Action'}`
            } catch {
              fieldLabel = 'Coherent Action'
            }
          } else {
            fieldLabel = key
          }
        }
        pendingProposals.push({ fieldKey: key, fieldLabel, proposedValue: String(value) })
      }
    }

    // Update chat history
    const updatedHistory = [
      ...chatHistory,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'lex', content: displayText, timestamp: new Date().toISOString() },
    ].slice(-40)

    await prisma.idea.update({
      where: { id: ideaId },
      data: { aiChatHistory: updatedHistory },
    })

    // Log AI usage
    await prisma.aIUsageLog.create({
      data: {
        userId: user.id,
        ideaId,
        provider: 'GEMINI_FLASH',
        model: 'gemini-2.5-flash',
        inputTokens: 0,
        outputTokens: 0,
        costAmount: 0,
        fieldTarget: idea.aiCurrentField ?? undefined,
      },
    })

    return { displayText, fieldUpdates, triggerSavePrompt, pendingProposals, fieldProposal, userAdditionalNotes }
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''
      let usedGrok = false

      if (geminiKey) {
        try {
          await logAICall({ provider: 'gemini', success: true, durationMs: 0, ideaId })
          for await (const token of callGeminiStream(systemPrompt, message, recentHistory)) {
            fullText += token
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: token })}\n\n`))
          }
          await logAICall({ provider: 'gemini', success: true, durationMs: Date.now() - startTime, ideaId })
        } catch (geminiError) {
          const geminiErrorType = classifyError(geminiError)
          await logAICall({ provider: 'gemini', success: false, durationMs: Date.now() - startTime, errorType: geminiErrorType, ideaId })
          console.error('[/api/ai/[ideaId]] Gemini streaming failed:', geminiError)
          fullText = ''
          usedGrok = true
        }
      } else {
        usedGrok = true
      }

      if (usedGrok || !fullText) {
        const grokStart = Date.now()
        try {
          const grokResult = await callGrok(systemPrompt, message, recentHistory)
          fullText = grokResult
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: fullText })}\n\n`))
          await logAICall({ provider: 'grok', success: true, durationMs: Date.now() - grokStart, fallbackUsed: true, ideaId })
        } catch (grokError) {
          const grokErrorType = classifyError(grokError)
          await logAICall({ provider: 'grok', success: false, durationMs: Date.now() - grokStart, errorType: grokErrorType, fallbackUsed: true, ideaId })
          console.error('[/api/ai/[ideaId]] Grok fallback failed:', grokError)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', errorType: 'both_failed' })}\n\n`))
          controller.close()
          return
        }
      }

      // Parse and persist
      const { displayText, fieldUpdates, triggerSavePrompt: aiTrigger, pendingProposals, fieldProposal, userAdditionalNotes: lexUserNotes } = await applyFieldUpdatesAndSave(fullText)

      // Stage gate check
      await checkAndAdvanceStage(ideaId, idea.creatorId)

      // Re-fetch for completion state
      const latest = await prisma.idea.findUnique({
        where: { id: ideaId },
        select: {
          stage: true,
          title: true,
          summaryDescription: true,
          govtArea: true,
          ideaType: true,
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
              mechanismTypes: true, linkToDiagnosis: true, whatThisPolicyRulesOut: true,
              whyThisApproachNotOthers: true, conditionsForSuccess: true,
            },
          },
        },
      })

      const diag = latest?.diagnoses?.[0]
      const gp = latest?.guidingPolicies?.[0]
      const cActionsCount = latest?.coherentActions.length ?? 0

      const completedFields = {
        title: !!latest?.title,
        summaryDescription: !!latest?.summaryDescription,
        govtArea: !!latest?.govtArea,
        ideaType: !!latest?.ideaType,
        summaryDiagnosis: !!latest?.summaryDiagnosis || !!latest?.diagnosis,
        rootCause: !!latest?.rootCause,
        summaryGuidingPolicy: !!latest?.summaryGuidingPolicy || !!latest?.guidingPolicy,
        summaryCoherentActions: cActionsCount > 0 || !!latest?.summaryCoherentActions?.trim(),
        whoAffected: !!latest?.whoAffected,
        proposedWording: !!latest?.proposedWording,
        diagnosisText: !!diag?.text,
        diagnosisObstacleDefined: !!diag?.obstacleDefined,
        diagnosisWhoAffected: !!diag?.whoAffected,
        diagnosisHowAffected: !!diag?.howAffected,
        diagnosisWhyPersisted: !!diag?.whyPersisted,
        diagnosisImpactDescription: !!diag?.impactDescription,
        diagnosisImpactCost: !!diag?.impactCost,
        guidingPolicyText: !!gp?.text,
        guidingPolicyCoreTheory: !!gp?.coreTheory,
        guidingPolicyMechanism: !!(gp?.mechanismTypes && gp.mechanismTypes.length > 0),
        guidingPolicyTradeOffs: !!gp?.tradeOffs,
        guidingPolicyCompetitiveIdeaAnalysis: !!gp?.competitiveIdeaAnalysis,
      }

      const proposedKeys = new Set(pendingProposals.map(p => p.fieldKey))
      const serverTrigger = isStage1
        ? !!(latest?.summaryDiagnosis && latest?.summaryGuidingPolicy) ||
          (proposedKeys.has('summaryDiagnosis') && proposedKeys.has('summaryGuidingPolicy'))
        : !!(latest?.diagnosis && latest?.guidingPolicy) ||
          (proposedKeys.has('diagnosis.text') && proposedKeys.has('guidingPolicy.text'))

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'done',
        response: displayText,
        triggerSavePrompt: aiTrigger || serverTrigger,
        completedFields,
        pendingProposals,
        fieldProposal,
        userAdditionalNotes: lexUserNotes,
        currentStage: latest?.stage ?? idea.stage,
        coherentActionsCount: cActionsCount,
        hasFieldUpdates: !!fieldUpdates,
      })}\n\n`))
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
