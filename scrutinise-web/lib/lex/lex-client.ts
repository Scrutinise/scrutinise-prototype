// ─────────────────────────────────────────────────────────────────────────────
// Lex structured output (§4). Gemini is constrained to a fixed JSON shape via
// responseSchema, so we never parse data out of prose again. Lex returns content
// only — chatText, an optional proposal, optional extracted slots. The platform
// owns sequence, completion and the search trigger. A malformed proposal is
// discarded by the caller; Lex can never half-advance state.
// ─────────────────────────────────────────────────────────────────────────────

import type { FieldDef } from './page1-config'
import { methodForStage, methodBlocksFor } from './method'
import { assertGeminiFinished, geminiFinishProblem } from './gemini-finish'

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
  /** §19-B Task 1 — the page the STATE MACHINE is on (`Idea.lexPage`), which is what
   *  selects the method block. Never derived from the field: if they could disagree,
   *  the prompt could carry a page the user has not entered. */
  activePage: string
  /** The page the user has NOT yet moved into, when the active page is complete.
   *  Present ⇒ the transition-guard block replaces the field block. */
  nextPageLabel?: string | null
  /** Figures retrieved by a tool for THIS turn (lib/lex/tools). When present it is
   *  the only source of numbers Lex may quote — the data testifies, Lex narrates. */
  statsBlock?: string | null
  /** §19-C Task 1b — the facts of this turn (lib/lex/facts.ts). The only permitted
   *  source for any claim about what exists, was written, or was found. */
  factsBlock?: string | null
  /** A compact summary of what's already accepted, for grounding. */
  acceptedSummary: string
  /** §19-D Task 1b — how many times Lex has already pressed on the problem statement.
   *  At MAX_PROBLEM_PRESSES the gate is replaced by an instruction to accept and move
   *  on: Lex guides, it does not gatekeep. */
  problemPresses?: number
}

export interface LexRawOutput {
  chatText: string
  proposal: {
    fieldKey: string
    valueText?: string
    valueList?: string[]
    /** A1: structured multi-slot proposal — Lex synthesises chat into the slot schema. */
    valueObject?: Record<string, string>
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
          enum: [
            // Page 1
            'ideaNarrative', 'youAndIdeaNarrative', 'aboutYou', 'title', 'keywords',
            // Page 2 (Diagnosis) — proposed scalars + A1 structured multi-slot fields
            'challenge', 'pivotalObstacle', 'summaryDiagnosis',
            'whoAffectedImpactCost', 'legalLandscape',
            // §19-D Task 9g — the causes LOOP, proposed as valueList (one per cause).
            'causes',
            // Page 3 (Guiding Policy) — incl. A1 structured anticipatedResponses
            'whatItRulesOut', 'leverage', 'conditionsForSuccess', 'summaryGuidingPolicy',
            'anticipatedResponses',
            // Page 4 (Coherent Actions)
            'coherenceCheck', 'costSummary', 'summaryCoherentActions',
          ],
        },
        valueText: { type: 'string' },
        valueList: { type: 'array', items: { type: 'string' } },
        // A1: structured multi-slot proposal. Union of every structured field's slots
        // across Pages 2–4; unknown keys are stripped server-side per the field schema.
        valueObject: {
          type: 'object',
          properties: {
            affectedGroups: { type: 'string' },
            impact: { type: 'string' },
            cost: { type: 'string' },
            evidence: { type: 'string' },
            currentLaw: { type: 'string' },
            whereItFails: { type: 'string' },
            avoidance: { type: 'string' },
            gaming: { type: 'string' },
            enforcementBurden: { type: 'string' },
            legalChallenge: { type: 'string' },
            politicalAttack: { type: 'string' },
          },
        },
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
        beneficiariesOfStatusQuo: { type: 'string' },
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

// Per-field instruction body. Three kinds:
//  · narrative box  (Page 1 boxes)                → tidy chat into a box proposal
//  · panel box      (structured/loop/reference)   → discuss; the user fills + Saves in the panel, no proposal
//  · proposed scalar (title/keywords/challenge/…) → you propose the value
function fieldGuidance(field: FieldDef, ctx: LexTurnContext): string {
  if (field.origin === 'box' && field.type === 'narrative') {
    return ctx.awaiting
      ? `You have ALREADY drafted this box — it is showing in the proposal panel on the right, waiting for the user to review and Save it. Do NOT move on, do NOT ask the next question, and do NOT propose any other field. The platform only advances once the user Saves or Skips. If the user asks for a change, RETURN A FRESH PROPOSAL for THIS field (proposal.fieldKey "${field.key}", proposal.valueText = the improved version in their own voice, first person, concise) and in chatText say briefly what you changed and ask them to Save it in the panel. If they seem happy, emit no proposal and in chatText simply invite them to Save it (or edit it in the panel). Quietly capture any slots in "extracted".`
      : `This box can be filled two ways: the user types it in themselves, or they answer you here in chat and you tidy their words into it. When the user's message contains enough to fill this box, RETURN A PROPOSAL — proposal.fieldKey "${field.key}", proposal.valueText = a tidied version of what they said for THIS field, in their own voice (first person), concise, no preamble or quotes. When you return a proposal your chatText must point them to the panel and ask them to review and Save. Do NOT ask the next question in the same turn. If they haven't answered this yet, just ask the question and nudge obvious gaps GENTLY (at most twice), with no proposal. The user confirms by SAVING the box — never tell them to "accept a card". Quietly capture any slots in "extracted".`
  }

  if (field.origin === 'box' && field.type === 'structured') {
    // A1: structured multi-slot fields are PROPOSABLE, exactly like narrative boxes.
    // Lex synthesises the user's chat content into the slot schema and returns a
    // valueObject proposal; the box renders it "proposed by Lex"; the user edits/Saves.
    // NEVER ask the user to type their own words into the panel.
    const slots = (field.slots ?? []).join(', ')
    const specifics =
      field.key === 'whoAffectedImpactCost'
        ? `This field captures who is MOST ACUTELY affected (specific groups — the constituency/MP hook), the impact on them, the cost, and any evidence. Some of it may be carried over from earlier.`
        : field.key === 'legalLandscape'
          ? `This field captures what law currently governs this and where it falls short. If a relevant Act or regulator came up in the background briefing, fold it in.`
          : field.key === 'anticipatedResponses'
            ? `This field captures how people will respond to the chosen approach: avoidance, gaming, enforcement burden, legal challenge, and political attack vectors.`
            : `Help the user complete this structured field.`
    return ctx.awaiting
      ? `You have ALREADY drafted this field — it is showing in the panel on the right ("proposed by Lex"), waiting for the user to review and Save it. Do NOT move on or propose another field. If the user asks for a change, RETURN A FRESH PROPOSAL for THIS field (proposal.fieldKey "${field.key}", proposal.valueObject = the improved slot values for keys: ${slots}) and in chatText say briefly what you changed and ask them to Save it in the panel. If they seem happy, emit no proposal and invite them to Save (or edit in the panel).`
      : `${specifics} When the user's message contains enough to fill this field, SYNTHESISE their words into the slots and RETURN A PROPOSAL — proposal.fieldKey "${field.key}", proposal.valueObject = an object keyed by these slots: ${slots}, each value a tidied version of what they said (their voice, concise, no preamble). Your chatText must then point them to the panel and ask them to review and Save — do NOT ask the next question in the same turn. If they haven't given enough yet, ask for the gaps GENTLY (at most twice), with no proposal. NEVER ask the user to copy or "pop" their own words into the box — you tidy them in. Quietly capture any extra slots in "extracted".`
  }

  if (field.origin === 'box') {
    // Loop / reference fields — the user curates them IN THE PANEL. Your job is to help
    // them think it through in chat. Do NOT emit a proposal for these.
    const specifics =
      field.key === 'whoAffectedImpactCost'
        ? `They are describing who is affected, the impact, the cost, and any evidence. Help them be concrete and keep the affected groups specific (it is the constituency/MP hook). Some of this was carried over from earlier — they only need to sharpen it.`
        : field.key === 'causes'
          ? `They are building the causes of the problem as a TREE — for each, the cause and why it has persisted. Some candidates have been seeded from past debates and committee work; help them weigh those and add their own. Press every cause to a classification: MATERIAL (remove it and the problem largely goes away — decisive) or CONTRIBUTORY (worsens it, not decisive) — ask "is this THE thing, or A thing?" and do not accept vagueness. Where one cause drives another, encourage them to nest it beneath its parent ("X because Y because Z") rather than a flat list. They add, edit, classify, nest and remove causes in the panel; keep it clear, not exhaustive.`
          : field.key === 'rootCause'
            ? `They are choosing which single cause is the main driver of the problem — the root cause. Help them reason about which is upstream of the others. They select it in the panel.`
            : field.key === 'legalLandscape'
              ? `They are setting out what law currently governs this and where it falls short. If a relevant Act or regulator came up in the background briefing, point to it. They write this in the panel.`
              : field.key === 'policyOptions'
                ? `They are weighing CANDIDATE APPROACHES to the pivotal obstacle. A guiding policy is an approach, not a goal or an action list, and it is DESIGNED not picked — so help them argue each option genuinely FOR and AGAINST, seeded per material cause from the toolkit (incentives, rules, transparency, market design, institutional restructuring). Some candidates are seeded; push them to add, edit and stress-test. They curate options in the panel; a real choice comes next.`
                : field.key === 'chosenApproach'
                  ? `They are committing to ONE approach — and choosing it deliberately rules the others out (that is the point; a policy that rules nothing out is fluff). Help them pick the option with real leverage on the pivotal obstacle. They select it in the panel.`
                  : field.key === 'anticipatedResponses'
                    ? `They are anticipating how people will respond to the chosen approach: avoidance, gaming, enforcement burden, legal challenge, and political attack vectors. Propose sharp, concrete responses for each; they refine in the panel.`
                    : field.key === 'actions'
                      ? `They are setting out the COORDINATED actions that execute the policy — each consistent with it and with each other, resources concentrated not smeared. For each action: the practical step, who implements it, and its costs (implementation, enforcement, regulatory friction) and benefits as sourced ranges. Help them concentrate effort and think about sequencing. They add and cost actions in the panel.`
                      : `Help the user complete this in the panel.`
    // §19-D Task 9g — the causes loop is the ONE loop where a chat answer becomes a
    // proposal. Everywhere else in this flow, telling Lex something in chat is enough
    // and Lex tidies it into the field; causes alone made the user re-type into the
    // panel, which is the exact anti-pattern the platform exists to remove. The other
    // loops (policyOptions, actions) stay panel-authored: each of their rows carries
    // several structured fields the user is actively composing, not one sentence.
    if (field.key === 'causes') {
      return `${specifics}
When the user NAMES one or more causes in chat, do not ask them to type it into the panel — RETURN A PROPOSAL: proposal.fieldKey "causes", proposal.valueList = one tidied sentence per cause, in their voice, each a statement of something that is happening which produces the problem (never a topic or a document). The platform adds them to the loop for the user to classify, nest, edit or remove, so your chatText should say you have added them and ask which are material. Only propose causes the user has actually put forward in this conversation — do not invent extras. If they are still thinking aloud, discuss it and emit no proposal.
Discuss it conversationally in chatText (1–4 sentences). Quietly capture anything useful in "extracted".`
    }
    return `${specifics}\nDiscuss it conversationally in chatText (1–4 sentences). Do NOT return a proposal for this field — the user fills and Saves it in the panel. Quietly capture anything useful in "extracted".`
  }

  // Proposed scalars.
  switch (field.key) {
    case 'title':
      return `Propose a working title from what the user has told you. It should name the problem OR the solution, not both. Plain English. Put it in proposal.valueText with proposal.fieldKey "title".`
    case 'keywords':
      return `Propose 4–8 search keywords drawn from everything the user has said. INCLUDE the likely government department as one keyword among the others — do not ask which department. Put them in proposal.valueList with proposal.fieldKey "keywords".`
    case 'challenge':
      return `Propose THE PROBLEM in ONE crisp sentence, plain English — what is wrong, for whom, and why it matters, with no remedy in it. Draw on everything the user has said. proposal.valueText, proposal.fieldKey "challenge". In chatText, share it in a sentence and invite them to accept or refine it.`
    case 'pivotalObstacle':
      return `Propose the PIVOTAL OBSTACLE — the single most important thing blocking a *solution* (why the problem persists). It is DISTINCT from the root cause (which is why the problem happens): the obstacle may be enforcement difficulty, vested interest, cost, or political will. This is the thing the eventual policy must defeat. ALWAYS ask, in chatText, WHO BENEFITS from things staying as they are (cui bono) — it is frequently the route to the obstacle — and record their answer in extracted.beneficiariesOfStatusQuo. proposal.valueText, proposal.fieldKey "pivotalObstacle". In chatText, name the obstacle in a sentence, ask the cui bono question, and invite them to accept or refine.`
    case 'summaryDiagnosis':
      return `Write the DIAGNOSIS SUMMARY: 2–4 sentences that name BOTH the root cause (why the problem happens) and the pivotal obstacle (why a solution has not stuck), and how they relate. Ground it strictly in what the user accepted. proposal.valueText, proposal.fieldKey "summaryDiagnosis". In chatText, invite them to accept it or tell you what to adjust.`
    // ── Page 3 (Guiding Policy) ──
    case 'whatItRulesOut':
      return `Compose WHAT THE POLICY RULES OUT from the options the user ruled out and their reasons (the residue of choosing). 2–4 sentences, concrete. proposal.valueText, proposal.fieldKey "whatItRulesOut". In chatText, invite them to accept or edit.`
    case 'conditionsForSuccess':
      return `Propose the CONDITIONS FOR SUCCESS as testable bets — "for this to work, X must be true" — drawn from the chosen approach and its risks. A short list in one text block. proposal.valueText, proposal.fieldKey "conditionsForSuccess". In chatText, invite them to accept or add.`
    case 'summaryGuidingPolicy':
      return `Write the GUIDING-POLICY SUMMARY: the chosen approach, its leverage on the pivotal obstacle, what it rules out and why, the anticipated responses, and the conditions for success. Ground it strictly in what the user accepted. proposal.valueText, proposal.fieldKey "summaryGuidingPolicy". In chatText, invite them to accept or adjust.`
    // ── Page 4 (Coherent Actions) ──
    case 'coherenceCheck':
      return `Write the COHERENCE CHECK: a short commentary on whether the actions are mutually consistent, whether effort is CONCENTRATED (not smeared), and the SEQUENCING (what must precede what — chain-link dependencies where one failure breaks the chain). No new user labour — just your read. proposal.valueText, proposal.fieldKey "coherenceCheck". In chatText, invite them to accept or push back.`
    case 'costSummary':
      return `Present the COST SUMMARY: the aggregated plan cost (implementation one-off; enforcement and regulatory-friction ongoing) set against the Page 2 problem cost — the cost-benefit spine. Every figure is a range; never an unexplained point number. proposal.valueText, proposal.fieldKey "costSummary". In chatText, invite them to accept or challenge any figure.`
    case 'summaryCoherentActions':
      return `Write the COHERENT-ACTIONS SUMMARY: the plan of coordinated actions and its cost-benefit case against the problem. Ground it strictly in what the user accepted. proposal.valueText, proposal.fieldKey "summaryCoherentActions". In chatText, invite them to accept or adjust.`
    default:
      return `Propose a value for this field in proposal.valueText with proposal.fieldKey "${field.key}".`
  }
}

export function buildLexSystemPrompt(ctx: LexTurnContext): string {
  const field = ctx.currentField
  // Method layer (§16.3): M-GENERAL + the active stage's block, injected per stage.
  // §19-B: keyed off the STATE MACHINE's page, never off the field — so the method
  // in the prompt can never describe a section the user has not been moved into.
  // §19-D Task 1b — the problem gate arms only while the problem field is current, and
  // spends itself after two presses. Both facts are logged, so "the gate never fired"
  // and "the gate fired and the user held their ground" are distinguishable.
  const methodCtx = { currentFieldKey: field?.key ?? null, problemPresses: ctx.problemPresses ?? 0 }
  const method = methodForStage(ctx.activePage, methodCtx)
  // [lex-diag] — makes it visible in logs which method blocks are in the prompt (acceptance §19).
  console.log('[lex-diag] method blocks', {
    page: ctx.activePage, blocks: methodBlocksFor(ctx.activePage, methodCtx), presses: methodCtx.problemPresses,
  })
  const fieldBlock = field
    ? `CURRENT FIELD (the platform decides this — you never choose the sequence):
  key:    ${field.key}
  label:  ${field.label}
  origin: ${field.origin}   ${field.origin === 'box' ? '(a box the user works on in the panel)' : '(you propose a value)'}
  ${field.hints?.length ? 'helps to cover: ' + field.hints.join('; ') : ''}

${fieldGuidance(field, ctx)}`
    : ctx.nextPageLabel
      // §19-B Task 1 — the transition guard. This section is finished, the NEXT one
      // has not been entered, and only the platform can enter it. Lex answers where
      // it stands and waits; it must not start the next section's conversation.
      ? `THIS SECTION IS COMPLETE — AND THE USER HAS NOT YET MOVED ON TO "${ctx.nextPageLabel}".
The platform, not you, moves the user between sections. There is NO active field: nothing you write can be saved anywhere right now.

Answer whatever the user just said, briefly and warmly (1–3 sentences), using only what is already captured (plus any RETRIEVED STATISTICS block above, if one is present). Then, if it fits, remind them they can start ${ctx.nextPageLabel} whenever they're ready — there's a "Continue to ${ctx.nextPageLabel}" button in the chat and in the panel on the right, and simply saying so also works.

HARD RULE: do NOT ask any ${ctx.nextPageLabel} question, do NOT begin diagnosing, analysing causes or proposing next-section content, and do NOT claim you have written anything into a box. Emit no proposal.`
      : `Every section is complete. Acknowledge warmly in one or two sentences. Emit no proposal.`

  return `You are Lex, the guide on Scrutinise — a non-partisan platform that helps people turn policy ideas into Parliament-ready proposals. You are warm, curious, plain-spoken, British English, FT op-ed register. No emojis. Never say you are an AI or name a model. "The problem" — never "the challenge" — for the Page 2 problem field; "Contributions" not "comments".

You are NOT in control of the conversation's mechanics. The platform tells you which single field is active and renders confirmation cards. You only: (a) write a short conversational message in chatText, (b) when the active field is one you propose, put your proposal in the proposal object, (c) quietly record anything you learn about the user or idea in extracted.

METHOD (how to hold the user to good strategy — apply it, never quote it or name a book)
${method}

${ctx.factsBlock ? `${ctx.factsBlock}\n\n` : ''}${ctx.statsBlock ? `${ctx.statsBlock}\n\n` : ''}CONTEXT
  user:            ${ctx.preferredName}
  experience:      ${ctx.experienceLevel ?? 'unknown — establish it gently early on'}
  mode:            ${ctx.lexMode}
  idea title:      ${ctx.ideaTitle ?? '(not set yet)'}
  first idea:      ${ctx.isFirstIdea ? 'yes' : 'no'}
  already captured: ${ctx.acceptedSummary || 'nothing yet'}

${fieldBlock}

RULES
- One thing at a time. Finish the CURRENT field before the next one. Never ask about, hint at, or propose the next field — the platform moves on only when the user Saves or Skips, and it tells you the new current field then.
- NEVER ask the user to transcribe, copy, re-type, or "pop"/"put" their own words into a box or panel. If they have told you something in chat, YOU tidy it into a proposal (valueText or valueObject) — they only review and Save. Asking them to fill the box themselves is the exact anti-pattern this platform exists to remove.
- React to what the user just said before anything else.
- chatText is always 1–4 sentences. Never put JSON or field names in chatText.
- Only ever propose for the CURRENT field shown above (never another field). If no current field is shown, propose nothing at all.
- Never say you have written, saved, put or drafted something into a box unless you returned a proposal for the CURRENT field in this same turn. Claiming a write that did not happen is worse than saying nothing.
- NUMBERS: state a figure only if it appears in a RETRIEVED STATISTICS block above, and give its period, unit and source when you do. With no such block, do not produce figures from memory — say what you'd need to look up. A confident wrong number is the worst thing you can give a user building a case for Parliament.
- NEVER CLAIM: do not say that something exists, was written, was saved, was found, or is waiting in a panel unless the FACTS OF THIS TURN block says so. No "I've pulled together…", no "you'll find… in the panel", no describing research you have not been shown. If you have not been given it, you have not got it — say that instead. This is the single most damaging thing you can get wrong, because the user cannot tell the difference.
- If you could not do something (a draft failed, a search didn't run), say it plainly in one sentence and offer to try again. An honest failure is always better than a confident substitute.
- RESEARCH REQUESTS: you cannot search the corpus yourself. If the user asks you to look something up and the FACTS block shows no search ran this turn, say so plainly — "I can't run a corpus search from here yet; the panel search runs at each stage, and I can look again when we move on" — and offer what you can do instead. Never imply you have searched, never describe sources you have not been shown, and never send them to the panel on spec.
- "extracted" is optional; include only slots you are confident about.`
}

// Thinking stays ON for the conversational turn (it is a judgement call, not a form
// fill) — so the ceiling has to cover the thinking pass as well as a 4-sentence
// chatText plus a proposal. 2048 was the whole budget for both. CLAUDE.md §18 rule 5:
// output tokens are billed on what is generated, so a generous ceiling costs nothing.
const LEX_TURN_MAX_TOKENS = parseInt(process.env.LEX_TURN_MAX_TOKENS ?? '4096', 10)

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
          maxOutputTokens: LEX_TURN_MAX_TOKENS,
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
  // Before parsing: a truncated payload is broken JSON, and without this it arrives as a parse
  // failure rather than as "you ran out of output tokens". See lib/lex/gemini-finish.ts.
  assertGeminiFinished(data?.candidates?.[0], LEX_TURN_MAX_TOKENS, 'lex-turn')
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
      let valueObject: Record<string, string> | undefined
      if (p.valueObject && typeof p.valueObject === 'object' && !Array.isArray(p.valueObject)) {
        valueObject = {}
        for (const [k, val] of Object.entries(p.valueObject as Record<string, unknown>)) {
          if (typeof val === 'string' && val.trim()) valueObject[k] = val.trim()
        }
      }
      proposal = {
        fieldKey: p.fieldKey,
        valueText: typeof p.valueText === 'string' ? p.valueText : undefined,
        valueList: Array.isArray(p.valueList) ? p.valueList.map(String) : undefined,
        valueObject,
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

// ── Cause seeding (§7.2) ──────────────────────────────────────────────────────
// A separate, structured Gemini call: read the CAUSE_SEEDING corpus excerpts and
// articulate candidate causes. Resilient — returns [] on any failure (the user can
// always add their own causes), so the diagnosis flow never blocks on it.
export interface CauseCandidate {
  cause: string
  whyPersisted?: string
  evidence?: string
  classification?: 'MATERIAL' | 'CONTRIBUTORY' | 'UNASSESSED'
  /** §16.2 one level of chain — deeper causes that drive this one. */
  subCauses?: CauseCandidate[]
}

const CAUSE_ITEM = {
  type: 'object',
  properties: {
    cause: { type: 'string' },
    whyPersisted: { type: 'string' },
    evidence: { type: 'string' },
    classification: { type: 'string', enum: ['MATERIAL', 'CONTRIBUTORY', 'UNASSESSED'] },
  },
  required: ['cause'],
}

// 3–5 causes, each with whyPersisted + evidence + up to 3 sub-causes. 1024 was under
// half of what the schema can legitimately produce even before thinking took its cut.
const CAUSES_MAX_TOKENS = parseInt(process.env.LEX_CAUSES_MAX_TOKENS ?? '3000', 10)

const CAUSES_SCHEMA = {
  type: 'object',
  properties: {
    causes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          cause: { type: 'string' },
          whyPersisted: { type: 'string' },
          evidence: { type: 'string' },
          classification: { type: 'string', enum: ['MATERIAL', 'CONTRIBUTORY', 'UNASSESSED'] },
          // One level of chain — sub-causes that drive this cause (§16.2).
          subCauses: { type: 'array', items: CAUSE_ITEM },
        },
        required: ['cause'],
      },
    },
  },
  required: ['causes'],
}

/**
 * §19-D Task 8 — the two logic tests a candidate must pass before it is offered.
 * Stated to the model, and (for test 2's most visible failure) enforced afterwards.
 * A corpus hit that fails test 2 is a RELATED DOCUMENT, not a cause.
 */
const CAUSE_LOGIC_TESTS =
  'TWO TESTS, both of which a candidate must pass before you return it. ' +
  '(1) It must be expressed as a CAUSE — something that is happening in the world which ' +
  'produces the stated problem — in your own words, as a full sentence with a subject and a ' +
  'verb. Never a topic, a document, a policy area or a fragment. ' +
  '"A factor examined in the Environmental Audit Committee report" is NOT a cause; ' +
  '"retailers face no penalty for absorbing the charge, so the price signal never reaches the ' +
  'shopper" is. (2) It must have a plausible CAUSAL relationship to THIS problem: if you removed ' +
  'it, the problem would measurably reduce. Apply that test explicitly to each candidate and ' +
  'DROP any that fails — returning three good causes is better than five with a passenger. ' +
  'If the excerpts support none, return an empty list; do not pad it.'

export async function generateCauseCandidates(input: {
  challenge: string
  context: string
  snippets: string[]
  /** Second pass after an empty first: fewer, shorter, so a budget wall isn't hit twice. */
  terse?: boolean
}): Promise<CauseCandidate[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return []
  const model = process.env.QUERY_EXPANSION_MODEL ?? 'gemini-2.5-flash'
  const timeoutMs = parseInt(process.env.LEX_CAUSES_TIMEOUT_MS ?? '20000', 10)

  const system = `You are Lex, a UK parliamentary research assistant. Given a policy PROBLEM and excerpts from past debates, committee reports and legislation, list ${input.terse ? '2–3' : '3–5'} candidate CAUSES of that problem which the material identifies or clearly implies. For each cause return: cause (one sentence, the driver of the problem), whyPersisted (why it has resisted solution), evidence (a short pointer to the source it came from, e.g. "raised in a Transport Committee report"), classification (MATERIAL if removing it would largely dissolve the problem, CONTRIBUTORY if it only worsens it, else UNASSESSED). ${input.terse ? 'Do not nest subCauses.' : 'Where a cause is clearly driven by a deeper cause, nest that under subCauses (at most one level) — "X because Y".'} UK context only. Ground it in the excerpts; do not fabricate specific citations, numbers or case names.

${CAUSE_LOGIC_TESTS}`
  const user = [
    `Problem: ${input.challenge || '(not yet stated)'}`,
    input.context ? `Context: ${input.context}` : '',
    input.snippets.length ? `Excerpts:\n- ${input.snippets.slice(0, input.terse ? 5 : 8).join('\n- ')}` : '',
  ].filter(Boolean).join('\n')

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: CAUSES_MAX_TOKENS,
            responseMimeType: 'application/json',
            responseSchema: CAUSES_SCHEMA,
            // §19-D Task 8 / CLAUDE.md §18 rule 5. This call ran at 1024 with thinking
            // ON, which is the 29 Jul query-expansion failure exactly: the thinking pass
            // spends the whole budget, nothing is emitted, and the empty return reads as
            // "the corpus had nothing to say". It is why the 10 Aug walk-through got two
            // seeded "causes" reading "A factor examined in <report title>" — those come
            // from the deterministic fallback, which only fires when this returns nothing.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: ctrl.signal,
      },
    )
    if (!res.ok) {
      console.warn('[lex] cause seeding HTTP', res.status)
      return []
    }
    type Resp = { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }> }
    const data = (await res.json()) as Resp
    // Non-throwing on purpose: this path degrades gracefully and that behaviour is kept. The
    // guard only makes the CAUSE visible — without it a truncation lands as a JSON parse failure
    // and the empty return looks like "the model had nothing to say". See gemini-finish.ts.
    const cut = geminiFinishProblem(data?.candidates?.[0], CAUSES_MAX_TOKENS, { label: 'cause-seeding' })
    if (cut) console.error(`[lex] cause-seeding ${cut.reason} — ${cut.detail}`)
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') return []
    const obj = JSON.parse(text) as { causes?: unknown }
    if (!Array.isArray(obj.causes)) return []
    const CLASSES = new Set(['MATERIAL', 'CONTRIBUTORY', 'UNASSESSED'])
    const toCandidate = (raw: unknown): CauseCandidate | null => {
      const c = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
      if (typeof c.cause !== 'string' || !c.cause.trim()) return null
      const cls = typeof c.classification === 'string' && CLASSES.has(c.classification) ? (c.classification as CauseCandidate['classification']) : undefined
      const subs = Array.isArray(c.subCauses) ? c.subCauses.map(toCandidate).filter((x): x is CauseCandidate => !!x).slice(0, 3) : undefined
      return {
        cause: c.cause.trim(),
        whyPersisted: typeof c.whyPersisted === 'string' ? c.whyPersisted.trim() : undefined,
        evidence: typeof c.evidence === 'string' ? c.evidence.trim() : undefined,
        classification: cls,
        subCauses: subs && subs.length ? subs : undefined,
      }
    }
    const candidates = obj.causes.map(toCandidate).filter((x): x is CauseCandidate => !!x)
    const kept = candidates.filter((c) => readsAsACause(c.cause))
    if (kept.length !== candidates.length) {
      console.warn('[lex-diag] cause seeding dropped non-causes', {
        dropped: candidates.filter((c) => !readsAsACause(c.cause)).map((c) => c.cause.slice(0, 80)),
      })
    }
    return kept.slice(0, 5)
  } catch (err) {
    console.warn('[lex] cause seeding failed:', err instanceof Error ? err.message : err)
    return []
  } finally {
    clearTimeout(t)
  }
}

/**
 * §19-D Task 8, test 1, enforced rather than merely asked for: does this read as a
 * CAUSE, or as a topic fragment lifted off a document?
 *
 * Deliberately narrow. It cannot judge causality (test 2 — that stays with the model
 * and with the user's own Material/Contributory call); it only refuses the shapes that
 * are definitely not statements about the world. Those are the ones that actually
 * shipped: "A factor examined in Report: 11th Report - Plastic bags (Report, together
 * with formal minutes…)" was one of the three the walk-through saw.
 */
const NOT_A_CAUSE = [
  /^a?\s*(?:factor|issue|matter|theme|topic|point|question|consideration)s?\s+(?:examined|discussed|raised|considered|mentioned|explored|addressed)\b/i,
  /^(?:discussion|debate|evidence|report|consideration|correspondence|questions?|inquiry)\s+(?:on|about|of|into|regarding)\b/i,
  /^(?:see|per|from|in)\s+/i,
]

export function readsAsACause(text: string): boolean {
  const t = (text ?? '').trim()
  if (t.length < 20) return false                    // a fragment, not a statement
  if (NOT_A_CAUSE.some((re) => re.test(t))) return false
  // A statement about the world has a verb. Requiring a finite verb outright would be a
  // parser; requiring that it is not simply a document's title is not — a candidate made
  // only of Capitalised Words And Numbers is a citation someone pasted.
  const words = t.split(/\s+/)
  const capitalised = words.filter((w) => /^[A-Z0-9]/.test(w)).length
  if (words.length >= 4 && capitalised / words.length > 0.6) return false
  return true
}

// ── Coherence review (§18 / §19-C Task 5) ─────────────────────────────────────
// The coherence check is NOT a paragraph of praise. It is an experienced reviewer
// reading the plan back: what's missing, what will go wrong, who is actually doing
// each thing, in what order, whether effort is concentrated — and the closing test,
// do these actions actually defeat the diagnosed causes and obstacle. Structured
// output so each required element is present or visibly absent, rather than lost in
// prose the model felt like writing.
export interface CoherenceReview {
  gaps: string[]
  flaws: string[]
  missingImplementers: string[]
  sequence: string[]
  concentration: string
  defeatsTest: string
}

const COHERENCE_MAX_TOKENS = parseInt(process.env.LEX_COHERENCE_MAX_TOKENS ?? '4000', 10)

const COHERENCE_SCHEMA = {
  type: 'object',
  properties: {
    gaps: { type: 'array', items: { type: 'string' } },
    flaws: { type: 'array', items: { type: 'string' } },
    missingImplementers: { type: 'array', items: { type: 'string' } },
    sequence: { type: 'array', items: { type: 'string' } },
    concentration: { type: 'string' },
    defeatsTest: { type: 'string' },
  },
  required: ['gaps', 'flaws', 'missingImplementers', 'sequence', 'concentration', 'defeatsTest'],
}

export async function generateCoherenceReview(input: {
  actions: { practicalStep: string; whoImplements: string | null; mechanismType: string | null }[]
  chosenApproach: string
  rootCause: string
  pivotalObstacle: string
  causes: string[]
  corpusNotes?: string[]
}): Promise<CoherenceReview | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  const model = process.env.QUERY_EXPANSION_MODEL ?? 'gemini-2.5-flash'
  const timeoutMs = parseInt(process.env.LEX_COHERENCE_TIMEOUT_MS ?? '20000', 10)

  const system =
    'You are an experienced UK policy adviser reviewing a plan of action before it goes to a ' +
    'minister. Be useful, not encouraging. Return: gaps (what a reviewer would immediately ask ' +
    'about — "have you considered…"), flaws (concrete failure modes, how this goes wrong in ' +
    'practice), missingImplementers (name every action whose implementer is unnamed or whose step ' +
    'is too vague to act on — quote the action), sequence (a suggested order of events, naming ' +
    'chain-links where one failure breaks the rest), concentration (is effort concentrated where ' +
    'the leverage is, or smeared), and defeatsTest (the closing test: do these actions actually ' +
    'defeat the diagnosed root cause and pivotal obstacle — and HOW; say so plainly if they do ' +
    'not). UK context. Do not invent citations, numbers or bodies that were not mentioned.'

  const user = [
    `Chosen approach: ${input.chosenApproach || '(not stated)'}`,
    `Root cause: ${input.rootCause || '(not stated)'}`,
    `Pivotal obstacle: ${input.pivotalObstacle || '(not stated)'}`,
    input.causes.length ? `Causes identified:\n- ${input.causes.join('\n- ')}` : '',
    'Actions:',
    ...input.actions.map((a, i) =>
      `${i + 1}. ${a.practicalStep} — implementer: ${a.whoImplements || 'NOT NAMED'}${a.mechanismType ? ` — mechanism: ${a.mechanismType}` : ''}`),
    input.corpusNotes?.length ? `\nRelevant material from past scrutiny:\n- ${input.corpusNotes.join('\n- ')}` : '',
  ].filter(Boolean).join('\n')

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.4, maxOutputTokens: COHERENCE_MAX_TOKENS,
            responseMimeType: 'application/json', responseSchema: COHERENCE_SCHEMA,
            // Six fields, four of them lists, over every action in the plan. Same
            // budget discipline as the two seeders above (CLAUDE.md §18 rule 5).
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    )
    if (!res.ok) { console.warn('[lex] coherence review HTTP', res.status); return null }
    type Resp = { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }> }
    const data = (await res.json()) as Resp
    // Non-throwing on purpose: this path degrades gracefully and that behaviour is kept. The
    // guard only makes the CAUSE visible — without it a truncation lands as a JSON parse failure
    // and the empty return looks like "the model had nothing to say". See gemini-finish.ts.
    const cut = geminiFinishProblem(data?.candidates?.[0], COHERENCE_MAX_TOKENS, { label: 'coherence-review' })
    if (cut) console.error(`[lex] coherence-review ${cut.reason} — ${cut.detail}`)
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') return null
    const o = JSON.parse(text) as Partial<CoherenceReview>
    const list = (v: unknown) => (Array.isArray(v) ? v.map(String).filter((s) => s.trim()) : [])
    return {
      gaps: list(o.gaps), flaws: list(o.flaws), missingImplementers: list(o.missingImplementers),
      sequence: list(o.sequence),
      concentration: typeof o.concentration === 'string' ? o.concentration : '',
      defeatsTest: typeof o.defeatsTest === 'string' ? o.defeatsTest : '',
    }
  } catch (err) {
    console.warn('[lex] coherence review failed:', err instanceof Error ? err.message : err)
    return null
  } finally {
    clearTimeout(t)
  }
}

/** Render a review as the text proposed into the coherenceCheck field. */
export function formatCoherenceReview(r: CoherenceReview): string {
  const section = (title: string, items: string[]) =>
    items.length ? `${title}\n${items.map((i) => `• ${i}`).join('\n')}` : ''
  return [
    section('Gaps worth closing', r.gaps),
    section('How this could go wrong', r.flaws),
    section('Actions needing an owner or a sharper step', r.missingImplementers),
    section('Suggested order of events', r.sequence),
    r.concentration ? `Concentration of effort\n${r.concentration}` : '',
    r.defeatsTest ? `Does this defeat the diagnosis?\n${r.defeatsTest}` : '',
  ].filter(Boolean).join('\n\n')
}

// ── Policy-option seeding (§17) ────────────────────────────────────────────────
// Generate candidate approaches per material cause, each with a genuine case for and
// against + mechanism types. Resilient — returns [] on any failure (the user can add
// their own), so the Guiding Policy flow never blocks on it.
export interface PolicyOptionCandidate {
  approach: string
  caseFor?: string
  caseAgainst?: string
  mechanismTypes?: string[]
}

const POLICY_MAX_TOKENS = parseInt(process.env.LEX_POLICY_MAX_TOKENS ?? '4000', 10)

const POLICY_OPTIONS_SCHEMA = {
  type: 'object',
  properties: {
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          approach: { type: 'string' },
          caseFor: { type: 'string' },
          caseAgainst: { type: 'string' },
          mechanismTypes: { type: 'array', items: { type: 'string' } },
        },
        required: ['approach'],
      },
    },
  },
  required: ['options'],
}

export async function generatePolicyOptions(input: {
  pivotalObstacle: string
  materialCauses: string[]
  context: string
}): Promise<PolicyOptionCandidate[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return []
  const model = process.env.QUERY_EXPANSION_MODEL ?? 'gemini-2.5-flash'
  const timeoutMs = parseInt(process.env.LEX_POLICY_TIMEOUT_MS ?? '15000', 10)

  const system = `You are Lex, a UK policy strategist. Given a PIVOTAL OBSTACLE and the MATERIAL CAUSES of a problem, propose 3–5 candidate guiding-policy APPROACHES (an approach is a way of tackling the obstacle, NOT a goal and NOT an action list). Draw from the mechanism toolkit: incentives, rules, transparency, market-design, institutional. For each: approach (one line), caseFor (the genuine argument for), caseAgainst (the genuine argument against — do not strawman), mechanismTypes (1–3 from the toolkit). Aim for genuinely different approaches, at least one per material cause. UK context. Do not fabricate specific citations or numbers.`
  const user = [
    `Pivotal obstacle: ${input.pivotalObstacle || '(not yet stated)'}`,
    input.materialCauses.length ? `Material causes:\n- ${input.materialCauses.slice(0, 6).join('\n- ')}` : '',
    input.context ? `Context: ${input.context}` : '',
  ].filter(Boolean).join('\n')

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: POLICY_MAX_TOKENS,
            responseMimeType: 'application/json',
            responseSchema: POLICY_OPTIONS_SCHEMA,
            // §19-D Task 2b — same fault as cause seeding. 5 approaches × (approach +
            // caseFor + caseAgainst + mechanisms) does not fit in 1400 even with the
            // whole budget spent on output, and thinking was taking a share of it first.
            // The visible symptom was the panel announcing "I'll seed a few candidate
            // approaches per material cause" and then seeding none.
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
        signal: ctrl.signal,
      },
    )
    if (!res.ok) { console.warn('[lex] policy seeding HTTP', res.status); return [] }
    type Resp = { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }> }
    const data = (await res.json()) as Resp
    // Non-throwing on purpose: this path degrades gracefully and that behaviour is kept. The
    // guard only makes the CAUSE visible — without it a truncation lands as a JSON parse failure
    // and the empty return looks like "the model had nothing to say". See gemini-finish.ts.
    const cut = geminiFinishProblem(data?.candidates?.[0], POLICY_MAX_TOKENS, { label: 'policy-seeding' })
    if (cut) console.error(`[lex] policy-seeding ${cut.reason} — ${cut.detail}`)
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') return []
    const obj = JSON.parse(text) as { options?: unknown }
    if (!Array.isArray(obj.options)) return []
    return obj.options
      .map((o) => (o && typeof o === 'object' ? (o as Record<string, unknown>) : {}))
      .filter((o) => typeof o.approach === 'string' && (o.approach as string).trim())
      .slice(0, 5)
      .map((o) => ({
        approach: (o.approach as string).trim(),
        caseFor: typeof o.caseFor === 'string' ? o.caseFor.trim() : undefined,
        caseAgainst: typeof o.caseAgainst === 'string' ? o.caseAgainst.trim() : undefined,
        mechanismTypes: Array.isArray(o.mechanismTypes) ? o.mechanismTypes.map(String).slice(0, 3) : undefined,
      }))
  } catch (err) {
    console.warn('[lex] policy seeding failed:', err instanceof Error ? err.message : err)
    return []
  } finally {
    clearTimeout(t)
  }
}

// ── Anticipated responses (§19-D Task 2c) ─────────────────────────────────────
// The five slots on the Page-3 `anticipatedResponses` field used to arrive EMPTY:
// `seedStructured` seeds `{slot: ''}` for every structured field that isn't
// whoAffectedImpactCost, so the panel offered five blank boxes under a heading that
// says Lex will propose some. Charlie's point on the walk-through was the right one —
// "Lex is best placed to fill these in": the user can sharpen an anticipation far
// more easily than they can produce one from nothing.
//
// Resilient by the same rule as the other seeders: on failure this returns null and
// the conductor SAYS the draft failed, rather than presenting empty boxes as though
// they were a considered blank.

const ANTICIPATED_MAX_TOKENS = parseInt(process.env.LEX_ANTICIPATED_MAX_TOKENS ?? '3000', 10)

const ANTICIPATED_SCHEMA = {
  type: 'object',
  properties: {
    avoidance: { type: 'string' },
    gaming: { type: 'string' },
    enforcementBurden: { type: 'string' },
    legalChallenge: { type: 'string' },
    politicalAttack: { type: 'string' },
  },
  required: ['avoidance', 'gaming', 'enforcementBurden', 'legalChallenge', 'politicalAttack'],
}

export interface AnticipatedResponses {
  avoidance: string
  gaming: string
  enforcementBurden: string
  legalChallenge: string
  politicalAttack: string
}

export async function generateAnticipatedResponses(input: {
  chosenApproach: string
  pivotalObstacle: string
  challenge: string
  leverage?: string
}): Promise<AnticipatedResponses | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  const model = process.env.QUERY_EXPANSION_MODEL ?? 'gemini-2.5-flash'
  const timeoutMs = parseInt(process.env.LEX_ANTICIPATED_TIMEOUT_MS ?? '20000', 10)

  const system =
    'You are an experienced UK policy adviser stress-testing a chosen approach before it goes ' +
    'anywhere near a department. For each of the five headings, write 1–3 sentences naming the ' +
    'SPECIFIC response this particular approach would provoke — who does it, and how. Generic ' +
    'text ("some may seek to avoid it") is worthless; name the actor and the move. ' +
    'avoidance: how those affected legitimately arrange their affairs to fall outside it. ' +
    'gaming: how they comply in form while defeating the purpose. ' +
    'enforcementBurden: who has to enforce this, what it costs them in people and attention, and ' +
    'where enforcement realistically fails. ' +
    'legalChallenge: the grounds on which this would be challenged and by whom — judicial review, ' +
    'retained EU law, ECHR, competition, devolution competence, or a straightforward vires point. ' +
    'politicalAttack: the line of attack an opponent would use, in their words. ' +
    'UK context. Do not invent case names, statutes or figures.'

  const user = [
    `Chosen approach: ${input.chosenApproach || '(not stated)'}`,
    `Pivotal obstacle: ${input.pivotalObstacle || '(not stated)'}`,
    `The problem: ${input.challenge || '(not stated)'}`,
    input.leverage ? `Why this approach has leverage: ${input.leverage}` : '',
  ].filter(Boolean).join('\n')

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: ctrl.signal,
        body: JSON.stringify({
          system_instruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: user }] }],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: ANTICIPATED_MAX_TOKENS,
            responseMimeType: 'application/json',
            responseSchema: ANTICIPATED_SCHEMA,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    )
    if (!res.ok) { console.warn('[lex] anticipated responses HTTP', res.status); return null }
    type Resp = { candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }> }
    const data = (await res.json()) as Resp
    const cut = geminiFinishProblem(data?.candidates?.[0], ANTICIPATED_MAX_TOKENS, { label: 'anticipated-responses' })
    if (cut) console.error(`[lex] anticipated-responses ${cut.reason} — ${cut.detail}`)
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string') return null
    const o = JSON.parse(text) as Partial<Record<keyof AnticipatedResponses, unknown>>
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
    const out: AnticipatedResponses = {
      avoidance: str(o.avoidance),
      gaming: str(o.gaming),
      enforcementBurden: str(o.enforcementBurden),
      legalChallenge: str(o.legalChallenge),
      politicalAttack: str(o.politicalAttack),
    }
    // A response object where every slot came back blank is a failure wearing the
    // shape of a success — report it as one (§19-C 1a).
    return Object.values(out).some((v) => v) ? out : null
  } catch (err) {
    console.warn('[lex] anticipated responses failed:', err instanceof Error ? err.message : err)
    return null
  } finally {
    clearTimeout(t)
  }
}
