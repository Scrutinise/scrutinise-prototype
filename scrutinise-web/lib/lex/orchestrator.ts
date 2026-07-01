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
import { buildLexSystemPrompt, runLexTurn, generateCauseCandidates } from './lex-client'
import { setProposal, storeExtracted, createCauses, buildWhoAffectedSeed } from './field-machine'
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

/** Ask the current box/panel field's question (narrative, structured, loop, reference). */
async function askQuestion(ideaId: string, userId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  const fallback = def.question ?? 'What would you like to add next?'
  try {
    const prompt = await buildPrompt(ideaId, userId, state, def)
    const directive = `[The user just completed the previous step. In ONE short sentence acknowledge it, then ask this in your own words: "${def.question}". Do not propose anything.]`
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
  try {
    const challenge = (acceptedValue(state, 'challenge') as string) ?? ''
    const keywords = (acceptedValue(state, 'keywords') as string[] | null) ?? []
    const context = [challenge, acceptedValue(state, 'ideaNarrative')].filter(Boolean).join(' ').slice(0, 500)
    const searchTerms = keywords.length ? keywords : challenge.split(/\s+/).slice(0, 8)
    const { results } = await runSearch({ keywords: searchTerms, intent: 'CAUSE_SEEDING', ideaContext: context, limit: 10 })
    const snippets = results
      .filter((r) => r.type === 'DEBATE' || r.type === 'COMMITTEE' || r.type === 'PRIMARY_LEGISLATION')
      .map((r) => `${r.citation}: ${r.snippet}`)
      .slice(0, 8)
    const candidates = await generateCauseCandidates({ challenge, context, snippets })
    if (candidates.length) await createCauses(ideaId, candidates, 'LEX_CORPUS')
  } catch (err) {
    console.warn('[orchestrator] cause seeding failed (user can add their own):', err instanceof Error ? err.message : err)
  }
  // Mark the loop AWAITING so it stays current while the user curates (and isn't re-seeded).
  await setProposal(ideaId, def.key, { value: '' })
  return askQuestion(ideaId, userId, def, state)
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
  if (def.origin === 'proposed') {
    text = await proposeScalar(ideaId, userId, def, state)
  } else if (def.type === 'structured') {
    text = await seedStructured(ideaId, userId, def, state)
  } else if (def.type === 'loop') {
    text = await seedCauses(ideaId, userId, def, state)
  } else {
    // narrative box (Page 1) and reference (rootCause): just ask the question.
    text = await askQuestion(ideaId, userId, def, state)
  }

  await pushLex(ideaId, text)
  return { messages: [text] }
}
