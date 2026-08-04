import { NextResponse } from 'next/server'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkAndAdvanceStage } from '@/lib/stage-gates'
import { checkRateLimit } from '@/lib/rateLimit'
import { FIELD_SEQUENCE } from '@/lib/field-labels'
import { searchLegislation, type SearchResult } from '@/lib/search'
import { searchLegislationViaGateway } from '@/lib/lex/gateway-legacy'

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
    legislationGovUkId: z.string().optional(),
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
  currentDateTime?: string
  legislationContext?: Array<{
    actTitle: string
    sectionNumber: string
    sectionTitle: string
    compiledText: string
    legislationGovUkId?: string
  }>
}): string {
  const isStage1 = ctx.currentStage === 'STAGE_1'

  const legislationCandidatesStr = ctx.legislationContext && ctx.legislationContext.length > 0
    ? ctx.legislationContext.map(c =>
        `- ${c.actTitle} (s.${c.sectionNumber}: ${c.sectionTitle})${c.legislationGovUkId ? ` [id: ${c.legislationGovUkId}]` : ''}`
      ).join('\n')
    : 'none'

  // Platform controls which field is active — Lex works on that field only (v6.0 §2.1)
  const fieldInstruction = ctx.currentFieldKey ? `

CURRENT TASK — ONE FIELD ONLY:
Work on this single field and no other.
  Key:     ${ctx.currentFieldKey}
  Label:   ${ctx.currentFieldLabel}
  Section: ${ctx.currentFieldSection}

1. If this is the opening of the field, orient the user in 1 sentence then ask the field's question.
2. When you have enough to propose a value, emit:
   {"fieldProposal": {"fieldKey": "${ctx.currentFieldKey}", "fieldLabel": "${ctx.currentFieldLabel}", "proposedValue": "..."}}
3. When you receive "Accepted: ${ctx.currentFieldLabel}", emit in THE SAME response (never deferred):
   {"fieldUpdates": {"${ctx.currentFieldKey}": "the accepted value"}, "fieldProposal": null}
   Then STOP. Do not orient the next field. Do not ask another question.
4. NEVER emit fieldProposal or fieldUpdates for any key other than "${ctx.currentFieldKey}".
   If the user raises another field: "We'll get to that — for now let's finish ${ctx.currentFieldLabel}."

SCOPE BOUNDARIES — never discuss in chat: team names/membership, sharing/privacy settings, voting, endorsements, credibility scores, platform features unrelated to idea content. → "That's managed in the relevant tab."
` : `
You are Lex, Scrutinise's AI assistant. All Stage 1 fields are complete. Help the user refine their idea, answer questions about the process, or prepare for the Strategic Kernel.

SCOPE BOUNDARIES — never discuss: team names/membership, sharing/privacy settings, voting, endorsements, credibility scores.
`

  const stageSection = isStage1
    ? `
STAGE 1 — CREATE (v6.0)

The platform controls which field is active via the CURRENT FIELD block. You work on that field — you never decide what comes next.

PROSE CAP: 3 sentences of prose per response in Stage 1, EXCEPT field 6 (initialThoughts) which is the one expansive field. The JSON options/proposal block is never counted toward this cap.

PAGE 1 FLOW: Move through Page 1 fields efficiently. Do not probe personal background or motivation. The goal is to capture the idea clearly so the deeper diagnosis can begin.

OPENING:
- Fresh idea (no chat history): the server has already delivered the opening message introducing Lex. Do NOT re-introduce yourself. Begin directly with the first field's question — no "Good morning", no "I'm Lex".
- Resuming (chat history present): "Welcome back, [preferredName]. We're working on [idea title]. The next thing to fill is [currentFieldLabel]." Then the field question. 3 sentences max; never re-introduce.

FIELD GUIDE:

Field 1 — Title (key: title)
Propose a working title from the user's first message. Names the problem OR solution, not both. Plain English. Propose immediately.

Field 2 — The idea (key: summaryDescription)
2–3 sentence plain-English description. One clarifying question if the opening was thin.

Field 3 — What's causing it (key: summaryDiagnosis) — PROVISIONAL
Surface MULTIPLE candidate causes. Proposed value may list more than one, flagged "to investigate later." Diagnosis = CAUSES, never consequences. Intentionally provisional — overwritten by the Strategic Kernel Diagnosis. Do not over-invest time here.

Field 4 — Background (key: backgroundResearch)
Background = the user's existing knowledge, context, or evidence about the problem — NOT their personal motivation or story.
Ask: "What do you already know about this problem — any research, reports, or direct experience with it? And has anything been tried before, here or elsewhere?" Do NOT ask about personal motivation, how they heard about the issue, or their feelings about it.
Enrich with prior-attempt research: anywhere in world, what happened, especially failures. Proposed value is synthesis of user input + Lex research, with Lex-sourced material clearly attributed.

Field 5 — Reference legislation (key: ideaLegislation) — RELATION, ONLY FIELD WHERE LEX LISTS LEGISLATION
Open: "My initial review of the legislation has turned up the following, which may interest you to review, and which we'll look at in more detail when it comes to nailing down the precise legislative changes — if that's the best route — in the final section, Coherent Actions."
Use legislationCandidates from runtime context. Every suggestion is "worth verifying" — never present as confirmed.
proposedValue must be a JSON array: [{"actTitle":"...","sectionNumber":"...","sectionTitle":"...","legislationGovUkId":"..."}]
Use legislationGovUkId from runtime context candidates. When expanding abbreviations in your reasoning: Electoral Administration Act → "electoral administration", Representation of the People Act → "representation people electoral", etc.

EMPTY CANDIDATES — MANDATORY PATH: If legislationCandidates is "none" OR you know of no clearly applicable statute:
- Say in natural language: "I couldn't find directly applicable legislation in the corpus — this may be a policy area without a clear statutory framework, or the terms may need refining. You can skip this field for now and return to it later, or tell me if you know of a specific Act and I'll look it up."
- STILL emit a fieldProposal with an empty array so the platform can offer a Skip option:
  {"fieldProposal": {"fieldKey": "ideaLegislation", "fieldLabel": "Reference legislation", "proposedValue": "[]"}}
- If the user names a specific Act, run a targeted FTS query for that Act in your next response and return a fresh proposal.
At ALL OTHER Stage 1 fields: do NOT list legislation — candidates may inform silent reasoning only.

Field 6 — Initial thoughts (key: initialThoughts) — EXPANSIVE, no prose cap
Draw on fields 1–5, survey realistic routes forward. Propose 3–5 candidate approaches from these route types (choose the ones that fit — do not use all four mechanically):
- Changing legislation — new law or amendment, where the gap is legal.
- Changing enforcement — where adequate laws exist but compliance/enforcement fails.
- Changing culture, behaviour, or codes of conduct of specific organisations — institutional practice lever.
- Raising money — where the binding constraint is funding.
For each: honest assessment of difficulty (who resists, why it's been hard, what it takes). Do not oversell.
Close: "If one of these feels right, the next step is to build it into a detailed proposal — the precursor to a formal campaign. Does one of these routes match what you want to pursue, or should we think differently about it?"
proposedValue must be a JSON object: {"options":[{"id":1,"routeType":"legislation","summary":"...with honest difficulty note..."},...], "chosen":[]}
routeType is one of: legislation, enforcement, organisational, funding.

Field 7 — Government area (key: govtArea) — LEX-ORIGINATED
Lex proposes without eliciting. Phrase for confirmation: "This looks like it sits with the [Department for X]. Does that match how you see it?" Do not wait for user input.

WHAT LEX NEVER DOES IN STAGE 1:
- Raises the Legislation/Regulation/Policy/Structural binary. If asked: "The type is decided at the action stage."
- Lists legislation to the user at any field other than field 5.
- Invents a citation. If unsure, say the area is governed by legislation you cannot pin down precisely yet.
- Calls a consequences question a "diagnosis." Diagnosis = causes.
- Defers fieldUpdates after an Accepted: message.

SAVE TRIGGER: When backgroundResearch AND initialThoughts are both proposed/populated, add "triggerSavePrompt": true to the JSON block.

JSON OUTPUT FORMAT: Always append your JSON block at the very end, after all conversational content. Wrap in \`\`\`json\`\`\` markers.
FIELD POPULATION PROTOCOL: {"fieldUpdates": {"fieldName": "content"}} — null for unchanged fields. Never include JSON in visible text. Never fabricate content.
Fields available in Stage 1: title, summaryDescription, summaryDiagnosis, backgroundResearch, govtArea. (ideaLegislation and initialThoughts are written by the platform on proposal acceptance — do NOT emit fieldUpdates for them.)
` : `
STAGE 2 — DRAFT — FULL STRATEGIC KERNEL

PAGE 1→2 TRANSITION (MANDATORY — first response on diagnosis):
If "Challenge" is NOT in the completed fields listed in RUNTIME CONTEXT, this is the user's first response in the Diagnosis section. Open with this transition — do NOT silently begin asking diagnosis questions:
"Now we move into the Strategic Kernel — starting with the Diagnosis. This is the most important section: we're going to identify the root causes of the problem, not just its symptoms. This will take more time and thought, but it's what makes the difference between a policy that addresses real causes and one that treats symptoms. Let's start with: in one or two sentences, what is the core challenge this idea addresses?"
On subsequent responses on diagnosis (Challenge already in completed fields), skip the transition and go straight to the field question.

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
Current date and time: ${ctx.currentDateTime ?? new Date().toISOString() + ' UTC'}
User name:             ${ctx.preferredName}
Lex mode:              ${ctx.lexMode}
User experience level: ${ctx.experienceLevel ?? 'Not set'}
AI session count:      ${ctx.aiSessionCount}
Idea title:            ${ctx.ideaTitle}
Current stage:         ${ctx.currentStage} (${ctx.stageLabel})
Completed fields:      ${ctx.completedFields}
Chat history summary:  ${ctx.chatSummary}

CURRENT FIELD:
  Key:     ${ctx.currentFieldKey ?? '(none — all fields complete)'}
  Label:   ${ctx.currentFieldLabel ?? ''}
  Section: ${ctx.currentFieldSection ?? ''}

Legislation candidates (FTS, keyword-matched — verify before use):
${legislationCandidatesStr}

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
Once a field has enough substance to populate — even imperfectly — populate it and move on. Do not ask the same question a second time in different words. Do NOT echo the accepted value back to the user ("I've recorded this as..." is forbidden — the panel shows the value). Acknowledge briefly ("Got it." / "Noted." / one short phrase) and immediately ask the next field's question in the same response. Never end a response after a field confirmation without asking the next question.

THREE-EXCHANGE LIMIT:
If you have asked the same substantive question more than twice and the user has answered both times, accept the most recent answer, populate the field, and move on. Never ask a question three times.

FIELD SEQUENCE — ABSOLUTE RULES:
The platform exposes a strict ordered list of fields (FIELD_SEQUENCE) for each idea. You MUST follow these rules without exception:

Always work on the lowest-indexed unfilled field. Identify the current target field by scanning FIELD_SEQUENCE in order and selecting the first one that is empty or has no substantive content. That is your only permitted target.

Never skip a field. Do not write to, propose to, or move the conversation toward a field whose index is higher than the current target while the current target is unfilled. Skipping a field is a critical error.

Never stall mid-sequence. After a field is confirmed and saved, you MUST immediately formulate and ask the question for the next unfilled field in the same response. Do not pause for the user to prompt you. Do not summarise progress mid-flow. Do not say "we've now captured…" or similar phrases unless every field in FIELD_SEQUENCE is filled.

Summary commentary is reserved for completion. A statement like "We've now captured the basic shape of your idea" is only permitted when every required field is non-empty. Until then, every field-confirmation message ends with the next question.

If the user introduces material relevant to a later field, acknowledge briefly and defer. Example: if during the Diagnosis the user says "and obviously this affects pedestrians most", Lex notes it ("I'll come back to who's affected when we get there") but does NOT write to that field yet.

Self-check before sending. Before producing any response, ask yourself: "What is the lowest-indexed unfilled field, and am I asking about it?" If the answer is no, regenerate.

LEX MODE BEHAVIOUR:
- COLLABORATIVE (default): Work through each step together, offer text suggestions where the user is unsure. Most users.
- SOCRATIC: Ask questions, leave user in full control of wording. For experts who want to be challenged, not assisted.
- DIRECT: Give the answer, prepare the draft based on direction and approvals. User is delegating the writing.

EXPERIENCE LEVEL ADAPTATION:

Adapt your approach based on the user's declared experience level:

NO_BACKGROUND (Interested citizen):
- Explain why each question matters before asking it
- Use plain English throughout — no policy jargon without definition
- Acknowledge genuine progress briefly — one short phrase integrated into the same response that asks the next question. Never use a standalone summary turn.
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

STAGE 1 SIDEBAR FIELDS (seven completion markers):
1. Title (title)
2. The idea (summaryDescription)
3. What's causing it (summaryDiagnosis)
4. Background (backgroundResearch)
5. Reference legislation (ideaLegislation)
6. Initial thoughts (initialThoughts)
7. Government area (govtArea)
${stageSection}
${fieldInstruction}

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
      legislationLinks: { select: { id: true } },
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
        idea.title && 'Title',
        idea.summaryDescription && 'The idea',
        idea.summaryDiagnosis && "What's causing it",
        idea.backgroundResearch && 'Background',
        (idea.legislationLinks?.length ?? 0) > 0 && 'Reference legislation',
        idea.initialThoughts && 'Initial thoughts',
        idea.govtArea && 'Government area',
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

  // Field 5 always triggers FTS. Query derived from title + description + provisional diagnosis
  // for maximum recall at keyword-match stage (v6.0 §7.1 trigger 1).
  const isAtLegislationField = currentFieldKey === 'ideaLegislation'
  const messageWordCount = message.trim().split(/\s+/).length
  const shouldSearch = (isAtLegislationField || messageWordCount >= 4) &&
    (!legislationContext || legislationContext.length === 0)

  // At field 5 use idea content as query for better coverage; elsewhere use the user message.
  const ftsQuery = isAtLegislationField
    ? [idea.title, idea.summaryDescription, idea.summaryDiagnosis]
        .filter((v): v is string => !!(v?.trim()))
        .join(' ')
        .slice(0, 250)
    : message

  // SPRINT §1 — Lex's grounding search now runs on the corpus index through the
  // search gateway, not `searchLegislation()`'s Postgres GIN over the 914k-row
  // legacy table.
  //
  // This is the call site the sprint's worked example came from: asked "what is the
  // law on data protection currently?" mid-conversation, the legacy path built the
  // hard conjunction `law & data & protection & current:*` — every token mandatory,
  // "currently" promoted to a content term by stop-word stripping — and grounded Lex
  // on the Road Traffic Act. BM25 over 17.7M sections does not AND-join tokens, so
  // an off-topic word costs rank rather than dictating the result set.
  //
  // `minRank: 0.25` is deliberately NOT carried across: it was a ts_rank_cd
  // threshold, and applying that number to a BM25 score would filter on a scale it
  // was never tuned for. Ordering plus the limit of 4 does the same job here.
  //
  // Failure stays non-fatal to the Lex turn (it always was): a failed search falls
  // back to the legacy index and says so in the log, rather than silently grounding
  // Lex on nothing.
  async function runGroundingSearch(): Promise<{ results: SearchResult[]; totalMatches: number }> {
    try {
      const gw = await searchLegislationViaGateway({
        q: ftsQuery || message,
        limit: 4,
        intent: 'IDEA_CHAT_GROUNDING',
      })
      if (!gw.failed) return { results: gw.results as SearchResult[], totalMatches: gw.totalMatches }
      console.error('[ai/route] gateway grounding search FAILED — legacy fallback:', gw.failureReason)
    } catch (err) {
      console.error('[ai/route] gateway grounding search threw — legacy fallback:', err)
    }
    return searchLegislation({ q: ftsQuery || message, limit: 4, minRank: 0.25 })
      .catch(() => ({ results: [] as SearchResult[], totalMatches: 0 }))
  }

  // Run lexInsight lookup and the grounding search in parallel — independent reads.
  const [approvedInsights, autoSearch] = await Promise.all([
    prisma.lexInsight.findMany({
      where: { status: 'APPROVED', approvedRule: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { approvedRule: true },
    }),
    shouldSearch
      ? runGroundingSearch()
      : Promise.resolve({ results: [] as SearchResult[], totalMatches: 0 }),
  ])

  // [L6-D Task 1] Temporary FTS diagnostic — remove after Vercel log review
  if (isAtLegislationField) {
    console.log(`[FTS-DIAG] field5 shouldSearch=${shouldSearch} query="${ftsQuery}" resultCount=${autoSearch.results.length}`)
  }

  const approvedRules = approvedInsights
    .map(r => r.approvedRule)
    .filter((r): r is string => r !== null)

  let resolvedLegislationContext = legislationContext
  if (shouldSearch && autoSearch.results.length > 0) {
    resolvedLegislationContext = autoSearch.results.map(r => ({
      actTitle:            r.actTitle,
      sectionNumber:       r.sectionNumber,
      sectionTitle:        r.title ?? '',
      compiledText:        r.snippet.replace(/<<|>>/g, ''),
      legislationGovUkId:  r.actId,
    }))
  }

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

  // Fetch current London time — gives Lex accurate temporal awareness for legislation queries.
  // 2s timeout; fallback to UTC ISO string so a failure never blocks the response.
  let currentDateTime: string
  try {
    const timeController = new AbortController()
    const timeoutId = setTimeout(() => timeController.abort(), 2000)
    const timeRes = await fetch('https://gateway.timeapi.world/timezone/Europe/London', { signal: timeController.signal })
    clearTimeout(timeoutId)
    const timeData = await timeRes.json() as { datetime?: string; abbreviation?: string }
    currentDateTime = timeData.datetime
      ? timeData.abbreviation ? `${timeData.datetime} (${timeData.abbreviation})` : timeData.datetime
      : `${new Date().toISOString()} UTC`
  } catch {
    currentDateTime = `${new Date().toISOString()} UTC`
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
    currentDateTime,
    legislationContext: resolvedLegislationContext ?? undefined,
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
    systemNote: string | null
  } & { userAdditionalNotes: string | null }> {
    let displayText = fullText
    let fieldUpdates: Record<string, string | null> | null = null
    let triggerSavePrompt = false
    let fieldProposal: { fieldKey: string; fieldLabel: string; proposedValue: string } | null = null
    let userAdditionalNotes: string | null = null
    let systemNote: string | null = null
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

    // A2 — Out-of-sequence write guard (V2-LEX-FLOW)
    if (fieldUpdates && isStage1) {
      function getFieldValue(key: string): unknown {
        const parts = key.split('.')
        if (parts.length === 1) return (idea as Record<string, unknown>)[key]
        const [section, ...rest] = parts
        const sectionVal = (idea as Record<string, unknown>)[section]
        if (!sectionVal || typeof sectionVal !== 'object') return undefined
        return rest.reduce<unknown>((obj, k) => (obj as Record<string, unknown>)?.[k], sectionVal)
      }
      const currentTargetIndex = FIELD_SEQUENCE.findIndex(field => {
        const value = getFieldValue(field.key)
        return !value || (typeof value === 'string' && value.trim().length === 0)
      })
      if (currentTargetIndex !== -1) {
        const rejectedFields: string[] = []
        for (const key of Object.keys(fieldUpdates)) {
          const fieldIndex = FIELD_SEQUENCE.findIndex(f => f.key === key)
          if (fieldIndex !== -1 && fieldIndex > currentTargetIndex) {
            console.log(`[V2-LEX-FLOW] Out-of-sequence update rejected: field=${key}, currentTarget=${FIELD_SEQUENCE[currentTargetIndex].key}`)
            rejectedFields.push(key)
          }
        }
        if (rejectedFields.length > 0) {
          for (const key of rejectedFields) delete fieldUpdates[key]
          const currentTargetLabel = FIELD_SEQUENCE[currentTargetIndex].label
          const rejectedLabel = rejectedFields.join(', ')
          systemNote = `NOTE: The previous response attempted to write to field '${rejectedLabel}' but the current target field is '${currentTargetLabel}'. Please ask about '${currentTargetLabel}' in your next response.`
        }
      }
    }

    // Persist direct Idea fields from fieldUpdates to DB (V2F-A1 fix)
    if (fieldUpdates) {
      const DIRECT_IDEA_FIELDS = new Set([
        'title', 'summaryDescription', 'summaryDiagnosis', 'backgroundResearch',
        'summaryGuidingPolicy', 'summaryCoherentActions', 'govtArea', 'ideaType',
        'whoAffected', 'proposedWording', 'diagnosis', 'rootCause', 'guidingPolicy',
        'userAdditionalNotes',
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
      ...(systemNote ? [{ role: 'system', content: systemNote, timestamp: new Date().toISOString() }] : []),
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

    return { displayText, fieldUpdates, triggerSavePrompt, pendingProposals, fieldProposal, userAdditionalNotes, systemNote }
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
          backgroundResearch: true,
          initialThoughts: true,
          whoAffected: true,
          proposedWording: true,
          coherentActions: { select: { id: true } },
          legislationLinks: { select: { id: true } },
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
      const legLinksCount = latest?.legislationLinks?.length ?? 0

      const completedFields = {
        title: !!latest?.title,
        summaryDescription: !!latest?.summaryDescription,
        govtArea: !!latest?.govtArea,
        ideaType: !!latest?.ideaType,
        summaryDiagnosis: !!latest?.summaryDiagnosis || !!latest?.diagnosis,
        backgroundResearch: !!latest?.backgroundResearch,
        initialThoughts: latest?.initialThoughts != null,
        ideaLegislation: legLinksCount > 0,
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
        ? !!(latest?.backgroundResearch && latest?.initialThoughts) ||
          (proposedKeys.has('backgroundResearch') && proposedKeys.has('initialThoughts'))
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
