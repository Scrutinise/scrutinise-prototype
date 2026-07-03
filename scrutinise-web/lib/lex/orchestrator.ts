// ─────────────────────────────────────────────────────────────────────────────
// The conductor (§13 + §7). Called after EVERY field write. It owns the "what next"
// decision (per §3.4 — server, not Lex, not frontend) and makes Lex speak the next
// step, so no path leaves the flow idle. Save-before-advance holds throughout: it
// only ever speaks for a freshly-EMPTY field and never advances an AWAITING one.
//
// By field kind of the active page's current field:
//   - narrative box (Page 1)               → Lex acks + asks the box's question.
//   - proposed scalar (title/keywords/       → Lex proposes the value (inline confirm
//     challenge/pivotalObstacle/summary)       in chat); deterministic fallback if Lex fails.
//   - structured panel box (whoAffected/     → seed a proposal (carry-forward / empty)
//     legalLandscape)                          → AWAITING; Lex introduces it in chat.
//   - loop (causes)                          → seed corpus candidates (CAUSE_SEEDING)
//                                              → AWAITING; Lex invites curation.
//   - reference (rootCause)                  → Lex asks which cause is the driver.
//
// keywords accept → handled in the fields route (search + pointer). Page advance →
// handled in the page route, which then calls this to seed the new page's first field.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { computeCanonicalState } from './state'
import { fieldDef, type CanonicalState, type FieldDef } from './page1-config'
import { buildLexSystemPrompt, runLexTurn, generateCauseCandidates, generatePolicyOptions } from './lex-client'
import {
  setProposal, storeExtracted, createCauses, buildWhoAffectedSeed,
  createPolicyOptions, listPolicyOptions, computeCostSummary,
} from './field-machine'
import { validateProposal } from './proposal-schema'
import { runSearch } from './search-gateway'

type ChatMsg = { role: string; content: string; timestamp?: string }

function historyOf(raw: unknown): { role: string; content: string }[] {
  return (Array.isArray(raw) ? (raw as ChatMsg[]) : [])
    .filter((m) => m.role === 'user' || m.role === 'lex')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }))
}

async function chatHistory(ideaId: string) {
  return historyOf((await prisma.idea.findUnique({ where: { id: ideaId }, select: { aiChatHistory: true } }))?.aiChatHistory)
}

async function pushLex(ideaId: string, content: string) {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { aiChatHistory: true } })
  const updated: ChatMsg[] = [
    ...(Array.isArray(idea?.aiChatHistory) ? (idea!.aiChatHistory as ChatMsg[]) : []),
    { role: 'lex', content, timestamp: new Date().toISOString() },
  ].slice(-60)
  await prisma.idea.update({ where: { id: ideaId }, data: { aiChatHistory: updated } })
}

// ── canonical helpers (span all pages, not just Page 1) ──────────────────────
function allFields(state: CanonicalState) {
  return state.pages.flatMap((p) => p.fields)
}
function findField(state: CanonicalState, key: string) {
  return allFields(state).find((f) => f.key === key) ?? null
}
function acceptedValue(state: CanonicalState, key: string): unknown {
  const f = findField(state, key)
  return f && f.status === 'ACCEPTED' ? f.value : null
}
function acceptedSummary(state: CanonicalState): string {
  return allFields(state)
    .filter((f) => f.status === 'ACCEPTED' && f.value)
    .map((f) => `${f.label}: ${typeof f.value === 'string' ? f.value.slice(0, 80) : JSON.stringify(f.value).slice(0, 120)}`)
    .join(' · ')
}

async function buildPrompt(ideaId: string, userId: string, state: CanonicalState, def: FieldDef) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferredName: true, firstName: true, aiPreferredStyle: true },
  })
  const ideaCount = await prisma.idea.count({ where: { creatorId: userId } })
  return buildLexSystemPrompt({
    preferredName: user?.preferredName ?? user?.firstName ?? 'there',
    lexMode: user?.aiPreferredStyle?.toUpperCase() ?? 'COLLABORATIVE',
    experienceLevel: state.userProfile.experienceLevel,
    ideaTitle: (acceptedValue(state, 'title') as string | null) ?? null,
    isFirstIdea: ideaCount <= 1,
    currentField: def,
    // The conductor only ever speaks for a freshly-EMPTY field (it returns early on
    // AWAITING_CONFIRMATION), so it is never in the awaiting-refine state.
    awaiting: false,
    acceptedSummary: acceptedSummary(state),
  })
}

// ── Deterministic fallbacks (never stall) ────────────────────────────────────
const STOPWORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'they', 'their', 'them', 'about',
  'would', 'should', 'could', 'because', 'which', 'what', 'when', 'where', 'there', 'here',
  'into', 'over', 'under', 'more', 'most', 'some', 'such', 'than', 'then', 'will', 'been',
  'being', 'were', 'your', 'ours', 'also', 'just', 'very', 'much', 'many', 'need', 'want',
])

function firstSentence(text: string, cap = 160): string {
  const s = (text ?? '').split(/[.!?\n]/)[0].trim()
  return s.slice(0, cap)
}
function fallbackTitle(ideaNarrative: string): string {
  const words = firstSentence(ideaNarrative).split(/\s+/).slice(0, 9).join(' ')
  return (words || 'Untitled idea').slice(0, 80)
}
function fallbackKeywords(texts: string[]): string[] {
  const freq = new Map<string, number>()
  for (const w of texts.join(' ').toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []) {
    if (STOPWORDS.has(w)) continue
    freq.set(w, (freq.get(w) ?? 0) + 1)
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([w]) => w)
}

/** A deterministic proposal value for any proposed scalar, so the confirm always appears. */
function fallbackValue(defKey: string, state: CanonicalState): unknown {
  const ideaNarrative = (acceptedValue(state, 'ideaNarrative') as string) ?? ''
  const youAndIdea = (acceptedValue(state, 'youAndIdeaNarrative') as string) ?? ''
  switch (defKey) {
    case 'keywords':
      return fallbackKeywords([ideaNarrative, youAndIdea])
    case 'title':
      return fallbackTitle(ideaNarrative)
    case 'challenge':
      return firstSentence(ideaNarrative) || 'The core challenge — please refine this in a sentence.'
    case 'pivotalObstacle':
      return 'The main thing blocking a workable solution here — please refine this.'
    case 'summaryDiagnosis': {
      const rc = acceptedValue(state, 'rootCause') as string | null
      const po = acceptedValue(state, 'pivotalObstacle') as string | null
      const parts = [rc ? `The root cause is ${rc}` : '', po ? `the pivotal obstacle is ${po}` : ''].filter(Boolean)
      return parts.length ? parts.join('; ') + '.' : 'Diagnosis summary — please refine this.'
    }
    default:
      return 'Please refine this.'
  }
}

function fallbackChat(defKey: string): string {
  switch (defKey) {
    case 'keywords':
      return 'Here are some keywords to search on — edit them if you like, then confirm.'
    case 'title':
      return 'Here’s a working title — change it if you’d prefer, then confirm.'
    case 'challenge':
      return 'Here’s the challenge in a sentence — accept it or tell me how to sharpen it.'
    case 'pivotalObstacle':
      return 'Here’s what looks like the pivotal obstacle — accept it or refine it.'
    case 'summaryDiagnosis':
      return 'Here’s the diagnosis, naming the root cause and the pivotal obstacle — accept it or tell me what to adjust.'
    default:
      return 'Here’s a draft — accept it or tell me how to change it.'
  }
}

// ── Steps ────────────────────────────────────────────────────────────────────

/** The effective question for a field given current state (A5: a single-cause root
 *  step must not ask "which is the main driver" — there's nothing to choose between). */
function questionFor(def: FieldDef, state: CanonicalState): string {
  if (def.key === 'rootCause') {
    const material = state.diagnosisCauses.filter((c) => c.classification === 'MATERIAL')
    const candidates = material.length ? material : state.diagnosisCauses
    if (candidates.length === 1) {
      return `There's a single cause on the table — I'll set it as the root cause; just confirm it in the panel on the right.`
    }
  }
  return def.question ?? 'What would you like to add next?'
}

/** Ask the current box/panel field's question (narrative, structured, loop, reference). */
async function askQuestion(ideaId: string, userId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  const question = questionFor(def, state)
  const fallback = question
  try {
    const prompt = await buildPrompt(ideaId, userId, state, def)
    const directive = `[The user just completed the previous step. In ONE short sentence acknowledge it, then ask this in your own words: "${question}". Do not propose anything, and do not repeat a question you have already asked.]`
    const lex = await runLexTurn(prompt, directive, await chatHistory(ideaId))
    if (lex.extracted && Object.keys(lex.extracted).length) {
      await storeExtracted(ideaId, userId, lex.extracted).catch(() => {})
    }
    return lex.chatText || fallback
  } catch {
    return fallback
  }
}

/** A proposed scalar (title/keywords/challenge/pivotalObstacle/summaryDiagnosis). */
async function proposeScalar(ideaId: string, userId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  let chatText = ''
  let applied = false
  try {
    const prompt = await buildPrompt(ideaId, userId, state, def)
    const directive = `[Propose a ${def.label} now from what the user has told you, and say one short sentence about it in chatText.]`
    const lex = await runLexTurn(prompt, directive, await chatHistory(ideaId))
    chatText = lex.chatText
    if (lex.proposal && lex.proposal.fieldKey === def.key) {
      const rawValue = def.key === 'keywords' ? lex.proposal.valueList : lex.proposal.valueText
      const valid = validateProposal({ fieldKey: def.key, value: rawValue, rationale: lex.proposal.rationale })
      if (valid) {
        await setProposal(ideaId, def.key, { value: valid.value, rationale: valid.rationale })
        applied = true
      }
    }
    if (lex.extracted && Object.keys(lex.extracted).length) {
      await storeExtracted(ideaId, userId, lex.extracted).catch(() => {})
    }
  } catch {
    /* fall through to deterministic proposal */
  }
  // Guarantee a proposal exists so the confirm appears — no stall.
  if (!applied) {
    await setProposal(ideaId, def.key, { value: fallbackValue(def.key, state) })
    if (!chatText) chatText = fallbackChat(def.key)
  }
  return chatText
}

/** A structured panel box (whoAffectedImpactCost/legalLandscape): seed a proposal so
 *  the panel editor pre-fills, then introduce it in chat. Seeding moves it off EMPTY so
 *  the conductor won't re-seed on the next write. */
async function seedStructured(ideaId: string, userId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  const seed =
    def.key === 'whoAffectedImpactCost'
      ? await buildWhoAffectedSeed(ideaId)
      : Object.fromEntries((def.slots ?? []).map((k) => [k, '']))
  await setProposal(ideaId, def.key, { value: seed })
  return askQuestion(ideaId, userId, def, state)
}

/** The causes loop: pre-seed candidates from the corpus (CAUSE_SEEDING), then invite
 *  curation. Set AWAITING so the field stays current AND the candidates aren't re-seeded. */
async function seedCauses(ideaId: string, userId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  // A4: instrument every stage so the [lex-diag] log reveals WHERE seeding stopped
  // (search fired? results? snippets? generator empty/error?). Bytes before hypotheses.
  const diag: Record<string, unknown> = { challengeLen: 0, keywordCount: 0, results: 0, snippets: 0, generated: 0, created: 0, fallbackUsed: false }
  try {
    const challenge = (acceptedValue(state, 'challenge') as string) ?? ''
    const keywords = (acceptedValue(state, 'keywords') as string[] | null) ?? []
    const context = [challenge, acceptedValue(state, 'ideaNarrative')].filter(Boolean).join(' ').slice(0, 500)
    const searchTerms = keywords.length ? keywords : challenge.split(/\s+/).filter(Boolean).slice(0, 8)
    diag.challengeLen = challenge.length
    diag.keywordCount = searchTerms.length

    const { results } = await runSearch({ keywords: searchTerms, intent: 'CAUSE_SEEDING', ideaContext: context, limit: 10 })
    diag.results = results.length
    const relevant = results.filter((r) => r.type === 'DEBATE' || r.type === 'COMMITTEE' || r.type === 'PRIMARY_LEGISLATION')
    const snippets = relevant.map((r) => `${r.citation}: ${r.snippet}`).slice(0, 8)
    diag.snippets = snippets.length

    // Generate — with ONE retry (the generator is resilient→[] and Gemini 429/503 are
    // common transient causes of "no candidates surfaced").
    let candidates = await generateCauseCandidates({ challenge, context, snippets })
    if (!candidates.length) candidates = await generateCauseCandidates({ challenge, context, snippets })
    diag.generated = candidates.length

    // Deterministic corpus-grounded fallback: if the generator yields nothing but the
    // corpus DID return relevant material, seed a couple of candidates pointing at the
    // sources so the acceptance ("candidates seeded from the corpus") always holds. The
    // user edits/keeps/deletes them like any seed.
    if (!candidates.length && relevant.length) {
      candidates = relevant.slice(0, 3).map((r) => ({
        cause: `A factor examined in ${r.citation}`,
        whyPersisted: undefined,
        evidence: r.snippet.slice(0, 240),
      }))
      diag.fallbackUsed = true
    }

    if (candidates.length) {
      await createCauses(ideaId, candidates, 'LEX_CORPUS')
      diag.created = candidates.length
    }
  } catch (err) {
    diag.error = err instanceof Error ? err.message : String(err)
  }
  console.log('[lex-diag] cause seeding', diag)
  // Mark the loop AWAITING so it stays current while the user curates (and isn't re-seeded).
  await setProposal(ideaId, def.key, { value: '' })
  return askQuestion(ideaId, userId, def, state)
}

/** Page 3 policy-options loop: seed candidate approaches per material cause (with a
 *  genuine case for and against), then invite evaluation. AWAITING so it stays current. */
async function seedPolicyOptions(ideaId: string, userId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  try {
    const pivotalObstacle = (acceptedValue(state, 'pivotalObstacle') as string) ?? ''
    const materialCauses = state.diagnosisCauses.filter((c) => c.classification === 'MATERIAL').map((c) => c.cause)
    // If nothing was marked material, fall back to all causes so seeding still runs.
    const causes = materialCauses.length ? materialCauses : state.diagnosisCauses.map((c) => c.cause)
    const context = [acceptedValue(state, 'challenge'), acceptedValue(state, 'summaryDiagnosis')].filter(Boolean).join(' ').slice(0, 600)
    const candidates = await generatePolicyOptions({ pivotalObstacle, materialCauses: causes, context })
    if (candidates.length) await createPolicyOptions(ideaId, candidates.map((c) => ({ ...c, source: 'LEX' as const })), 'LEX')
  } catch (err) {
    console.warn('[orchestrator] policy seeding failed (user can add their own):', err instanceof Error ? err.message : err)
  }
  await setProposal(ideaId, def.key, { value: '' })
  return askQuestion(ideaId, userId, def, state)
}

/** Page 4 actions loop: no corpus seeding — the user authors actions and Lex helps in
 *  chat + on the costing. Set AWAITING so the loop stays current while they build it. */
async function seedActions(ideaId: string, userId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  await setProposal(ideaId, def.key, { value: '' })
  return askQuestion(ideaId, userId, def, state)
}

/** Proposed scalars whose value is COMPUTED by the platform, not guessed by Lex:
 *  whatItRulesOut (composed from the RULED_OUT options) and costSummary (aggregated
 *  §18.2 costs vs the Page 2 problem cost). Seed the computed proposal → inline accept. */
async function seedComputedProposed(ideaId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  if (def.key === 'costSummary') {
    const { summary } = await computeCostSummary(ideaId)
    await setProposal(ideaId, def.key, { value: summary })
    return 'I’ve totted up the plan’s costs against what the problem costs — it’s in the chat to accept. Every figure is a range; challenge any of them.'
  }
  // whatItRulesOut
  const options = await listPolicyOptions(ideaId)
  const ruledOut = options.filter((o) => o.status === 'RULED_OUT')
  const value = ruledOut.length
    ? 'Choosing this approach rules out: ' +
      ruledOut.map((o) => `${o.approach}${o.ruleOutReason ? ` (${o.ruleOutReason})` : ''}`).join('; ') + '.'
    : 'Choosing this approach means committing to it over the alternatives considered, and accepting the trade-offs that comes with.'
  await setProposal(ideaId, def.key, { value })
  return 'Here’s what this choice deliberately rules out, drawn from the options you set aside — accept or edit it.'
}

/** The conductor. Returns any new Lex chat bubbles for the client to append. */
export async function orchestrateAfterWrite(ideaId: string, userId: string): Promise<{ messages: string[] }> {
  const state = await computeCanonicalState(ideaId)
  if (!state || !state.currentField) return { messages: [] }
  const def = fieldDef(state.currentField.key)
  if (!def) return { messages: [] }
  // Only speak when the current field is freshly EMPTY (needs a prompt). If it is
  // AWAITING_CONFIRMATION the user is mid-decision — don't talk over them, and do NOT
  // advance (the field stays current until Saved/Skipped — §13 / Sprint 1.3 / §3a).
  if (state.currentField.status !== 'EMPTY') {
    console.log('[lex-diag] orchestrator holding (current field not yet saved)', {
      currentField: state.currentField.key,
      status: state.currentField.status,
    })
    return { messages: [] }
  }
  console.log('[lex-diag] orchestrator advancing', { currentField: def.key, type: def.type, page: state.stage })

  let text: string
  if (def.key === 'whatItRulesOut' || def.key === 'costSummary') {
    // Proposed scalars whose value the platform COMPUTES (not Lex).
    text = await seedComputedProposed(ideaId, def, state)
  } else if (def.origin === 'proposed') {
    text = await proposeScalar(ideaId, userId, def, state)
  } else if (def.type === 'structured') {
    text = await seedStructured(ideaId, userId, def, state)
  } else if (def.type === 'loop') {
    // Dispatch the loop by which child entity it drives.
    text =
      def.key === 'policyOptions' ? await seedPolicyOptions(ideaId, userId, def, state)
        : def.key === 'actions' ? await seedActions(ideaId, userId, def, state)
          : await seedCauses(ideaId, userId, def, state)
  } else {
    // narrative box and reference (rootCause / chosenApproach): just ask the question.
    text = await askQuestion(ideaId, userId, def, state)
  }

  // A5: dedupe — if this bubble is identical to the last thing Lex said, don't repeat it.
  const history = await chatHistory(ideaId)
  const last = history.length ? history[history.length - 1] : null
  if (last && last.role === 'lex' && last.content.trim() === text.trim()) {
    console.log('[lex-diag] orchestrator suppressed duplicate bubble', { field: def.key })
    return { messages: [] }
  }

  await pushLex(ideaId, text)
  return { messages: [text] }
}
