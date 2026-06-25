// ─────────────────────────────────────────────────────────────────────────────
// The conductor (§13 Task 3 + 4). Called after EVERY field write. It owns the
// "what next" decision (per §3.4 — server, not Lex, not frontend) and makes Lex
// speak the next step, so no path leaves the flow idle.
//
//   - EMPTY narrative box (just advanced to it) → Lex acks + asks its question.
//   - all boxes terminal, title EMPTY            → Lex proposes Title (inline confirm).
//   - title terminal, keywords EMPTY             → Lex proposes Keywords.
//   - keywords accept                            → handled in the fields route
//                                                  (search + pointer + stage advance).
//
// Every Lex call has a deterministic fallback so a Lex hiccup can never stall the
// flow ("No stalls" acceptance criterion).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { computeCanonicalState } from './state'
import { fieldDef, type CanonicalState, type FieldDef } from './page1-config'
import { buildLexSystemPrompt, runLexTurn } from './lex-client'
import { setProposal, storeExtracted } from './field-machine'
import { validateProposal } from './proposal-schema'

type ChatMsg = { role: string; content: string; timestamp?: string }

function historyOf(raw: unknown): { role: string; content: string }[] {
  return (Array.isArray(raw) ? (raw as ChatMsg[]) : [])
    .filter((m) => m.role === 'user' || m.role === 'lex')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }))
}

async function pushLex(ideaId: string, content: string) {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { aiChatHistory: true } })
  const updated: ChatMsg[] = [
    ...(Array.isArray(idea?.aiChatHistory) ? (idea!.aiChatHistory as ChatMsg[]) : []),
    { role: 'lex', content, timestamp: new Date().toISOString() },
  ].slice(-60)
  await prisma.idea.update({ where: { id: ideaId }, data: { aiChatHistory: updated } })
}

function acceptedSummary(state: CanonicalState): string {
  return state.pages[0].fields
    .filter((f) => f.status === 'ACCEPTED' && f.value)
    .map((f) => `${f.label}: ${typeof f.value === 'string' ? f.value.slice(0, 80) : JSON.stringify(f.value)}`)
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
    ideaTitle: (state.pages[0].fields.find((f) => f.key === 'title')?.value as string | null) ?? null,
    isFirstIdea: ideaCount <= 1,
    currentField: def,
    // The conductor only ever speaks for a freshly-EMPTY field (it returns early
    // on AWAITING_CONFIRMATION), so it is never in the awaiting-refine state.
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

function fallbackTitle(ideaNarrative: string): string {
  const firstSentence = ideaNarrative.split(/[.!?\n]/)[0].trim()
  const words = firstSentence.split(/\s+/).slice(0, 9).join(' ')
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

// ── Steps ────────────────────────────────────────────────────────────────────
async function askBoxQuestion(ideaId: string, userId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  const fallback = def.question ?? 'What would you like to add next?'
  try {
    const prompt = await buildPrompt(ideaId, userId, state, def)
    const directive = `[The user just completed the previous step. In ONE short sentence acknowledge it, then ask this question, in your own words: "${def.question}". Do not propose anything yet.]`
    const lex = await runLexTurn(prompt, directive, historyOf((await prisma.idea.findUnique({ where: { id: ideaId }, select: { aiChatHistory: true } }))?.aiChatHistory))
    if (lex.extracted && Object.keys(lex.extracted).length) {
      await storeExtracted(ideaId, userId, lex.extracted).catch(() => {})
    }
    return lex.chatText || fallback
  } catch {
    return fallback
  }
}

async function proposeOutput(ideaId: string, userId: string, def: FieldDef, state: CanonicalState): Promise<string> {
  const fields = state.pages[0].fields
  const ideaNarrative = (fields.find((f) => f.key === 'ideaNarrative')?.value as string) ?? ''
  const youAndIdea = (fields.find((f) => f.key === 'youAndIdeaNarrative')?.value as string) ?? ''

  let chatText = ''
  let applied = false
  try {
    const prompt = await buildPrompt(ideaId, userId, state, def)
    const directive = `[The user has finished the boxes. Propose a ${def.label} now from what they told you, and say one short sentence about it in chatText.]`
    const lex = await runLexTurn(prompt, directive, historyOf((await prisma.idea.findUnique({ where: { id: ideaId }, select: { aiChatHistory: true } }))?.aiChatHistory))
    chatText = lex.chatText
    if (lex.proposal && lex.proposal.fieldKey === def.key) {
      const rawValue = def.key === 'keywords' ? lex.proposal.valueList : lex.proposal.valueText
      const valid = validateProposal({ fieldKey: def.key, value: rawValue, rationale: lex.proposal.rationale })
      if (valid) {
        await setProposal(ideaId, def.key, { value: valid.value, rationale: valid.rationale })
        applied = true
      }
    }
  } catch {
    /* fall through to deterministic proposal */
  }

  // Guarantee a proposal exists so the inline confirm appears — no stall.
  if (!applied) {
    const value = def.key === 'keywords' ? fallbackKeywords([ideaNarrative, youAndIdea]) : fallbackTitle(ideaNarrative)
    await setProposal(ideaId, def.key, { value })
    if (!chatText) {
      chatText =
        def.key === 'keywords'
          ? 'Here are some keywords to search on — edit them if you like, then confirm.'
          : 'Here’s a working title — change it if you’d prefer, then confirm.'
    }
  }
  return chatText
}

/** The conductor. Returns any new Lex chat bubbles for the client to append. */
export async function orchestrateAfterWrite(ideaId: string, userId: string): Promise<{ messages: string[] }> {
  const state = await computeCanonicalState(ideaId)
  if (!state || !state.currentField) return { messages: [] }
  const def = fieldDef(state.currentField.key)
  if (!def) return { messages: [] }
  // Only speak when the current field is freshly EMPTY (needs a prompt). If it is
  // AWAITING_CONFIRMATION the user is mid-decision — don't talk over them, and do
  // NOT advance (the box stays current until Saved/Skipped — §13 / Sprint 1.3).
  if (state.currentField.status !== 'EMPTY') {
    console.log('[lex-diag] orchestrator holding (current field not yet saved)', {
      currentField: state.currentField.key,
      status: state.currentField.status,
    })
    return { messages: [] }
  }
  console.log('[lex-diag] orchestrator advancing', { currentField: def.key, type: def.type })

  const text =
    def.type === 'narrative'
      ? await askBoxQuestion(ideaId, userId, def, state)
      : await proposeOutput(ideaId, userId, def, state)

  await pushLex(ideaId, text)
  return { messages: [text] }
}
