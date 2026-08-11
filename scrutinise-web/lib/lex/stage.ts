// ─────────────────────────────────────────────────────────────────────────────
// Stage advance — the ONE code path (§19-B Task 1).
//
// Invariant: chat page == state page, always. If they can diverge, the bug will
// recur somewhere else.
//
// Every way a user can move to the next Lex page — the Background-panel CTA, the
// inline "Continue to …" action in chat, and typed assent ("yes", "let's go",
// "continue") — funnels through `performStageAdvance`. Lex NEVER advances the
// stage itself and never conducts a page the state machine has not entered: while
// a page is complete but not yet left, /lex builds a transition-guarded prompt
// (see lex-client `pageComplete`) and any proposal it emits is discarded because
// there is no current field.
//
// `assertWritableField` is the write-side half of the same invariant: a field on a
// page ahead of `Idea.lexPage` cannot be written at all.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { advanceLexPage } from './field-machine'
import { orchestrateAfterWrite } from './orchestrator'
import { computeCanonicalState } from './state'
import { pageOf, pageSeqIndex } from './page1-config'
import { runStageSearch, readStageSearches, displayStageFor } from './stage-search'

export type AdvanceVia = 'panel-cta' | 'chat-inline' | 'chat-assent'

// ── Chat-expressed intent to continue ────────────────────────────────────────
// Deliberately conservative: a negation or a question (without a leading assent)
// never advances — those are answered in chat, with the Continue affordance still
// showing. Anything this matches is handled by the platform, not by Lex.
const NEGATION =
  /\b(?:not yet|no thanks|don'?t|do not|isn'?t|can'?t|wait|hold on|hang on|before we|rather not|not ready)\b/i

const ASSENT_START =
  /^\s*(?:yes|yep|yeah|yup|ok|okay|sure|please|ready|absolutely|of course|definitely|sounds good|go on|go ahead|let'?s)\b/i

const CONTINUE_PHRASE =
  /\b(?:i'?m ready|ready to (?:start|begin|go|continue|move)|let'?s (?:go|start|begin|crack on|move on|get (?:going|started|cracking))|move on|moving on|carry on|crack on|next (?:section|step|stage|page|part)|continue|proceed|onwards?|start the diagnosis|begin the diagnosis|on to the diagnosis)\b/i

/** True when a chat message plainly means "move me on to the next section". */
export function isContinueIntent(raw: string): boolean {
  const text = raw.trim()
  if (!text) return false
  if (NEGATION.test(text)) return false
  const assent = ASSENT_START.test(text)
  // "What's next?" is a question to answer, not a command to act on.
  if (text.endsWith('?') && !assent) return false
  return assent || CONTINUE_PHRASE.test(text)
}

// ── §19-C Task 1c — an explicit request to search the corpus ─────────────────
// As conservative as the assent detector: it must be an EXPLICIT instruction to look
// something up, not merely a question that mentions the law. Where this doesn't fire,
// the prompt makes Lex decline honestly rather than improvise (lex-client).
const RESEARCH_VERB =
  /\b(?:research|search|look\s?up|find|check|dig (?:in)?to|pull (?:up|together)|what does the corpus (?:say|hold))\b/i
const RESEARCH_OBJECT =
  /\b(?:corpus|database|library|legislation|law|laws|statute|act|acts|regulations?|case ?law|debates?|hansard|committee|precedent)\b/i

/** True when the user is plainly asking the platform to run a corpus search. */
export function isResearchRequest(raw: string): boolean {
  const text = raw.trim()
  if (!text) return false
  if (!RESEARCH_VERB.test(text)) return false
  if (!RESEARCH_OBJECT.test(text)) return false
  // "I've researched the law myself" is not a request.
  if (/\b(?:i(?:'ve| have)? (?:already )?(?:researched|searched|looked)|don'?t (?:search|research|look))\b/i.test(text)) return false
  return true
}

/** Strip the instruction wrapper so the query is the SUBJECT, not the request. */
export function researchQueryFrom(raw: string): string {
  return raw
    .replace(/^[^:]*:\s*/, '')                     // "can you research X in the corpus: <query>"
    .replace(RESEARCH_VERB, ' ')
    .replace(/\b(?:can|could|would|please|you|for me|in (?:our|the) (?:corpus|database|library)|the corpus)\b/gi, ' ')
    .replace(/[?]+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
}

/**
 * Advance the Lex page pointer and let the conductor seed the new page's first
 * field. The ONLY way the stage moves. Returns the new page key (null when the
 * advance was refused — e.g. the current page is not complete) plus any chat
 * bubbles the conductor produced.
 */
export async function performStageAdvance(
  ideaId: string,
  userId: string,
  via: AdvanceVia,
): Promise<{ advanced: string | null; messages: string[] }> {
  const before = (await prisma.idea.findUnique({ where: { id: ideaId }, select: { lexPage: true } }))?.lexPage ?? 'ORIENTATION'
  const next = await advanceLexPage(ideaId)
  if (!next) {
    console.warn('[lex-diag] stage advance refused', { via, from: before })
    return { advanced: null, messages: [] }
  }
  // §19-C Task 2 — the stage's own focused search runs BEFORE the conductor speaks,
  // so the message Lex writes is grounded in results that already exist (the facts
  // block reads the stored record). A search failure is recorded honestly and the
  // conductor still speaks; it simply cannot claim to have found anything.
  const search = await runStageSearch(ideaId, next)

  // Seed the new page's first step so the flow never lands idle.
  const { messages } = await orchestrateAfterWrite(ideaId, userId)
  console.log('[lex-diag] stage advance', {
    via, from: before, to: next, bubbles: messages.length,
    searchRan: !!search, searchOk: search?.ok ?? null, results: search?.results.length ?? 0,
  })
  return { advanced: next, messages }
}

// ── §19-D Task 3 — RE-ENTERING A COMPLETED STAGE ─────────────────────────────
//
// The flow was one-way. After moving to Guiding Policy, Charlie could not get back to
// add causes: the middle panel let him edit and remove them, but the chat stayed on the
// current stage, and he could not get back to Coherent Actions at all — which meant the
// coherence check could not be tested.
//
// That was tolerable for a first build and is not tolerable now, because DEEPENING IS
// INHERENTLY ITERATIVE: its whole purpose is to send the user back into earlier stages
// with new evidence. So the pointer moves both ways, and the three surfaces move with it
// — chat picks up that stage's conversation, the right-hand panel shows that stage's
// stored search (`displayStageFor(lexPage)` already does this), and edits go through the
// ordinary save path (`assertWritableField` already permits any page at or before the
// active one).
//
// LATER WORK IS NOT DISCARDED. Nothing is reset: field states, causes, options, actions
// and every stage's stored search all stay exactly as they are. Moving back changes one
// column — which page the user is looking at.

/** A page the user may move the working context into: at or before the furthest reached. */
async function reachablePages(ideaId: string): Promise<string[]> {
  const state = await computeCanonicalState(ideaId)
  return (state?.pages ?? []).filter((p) => p.reachable).map((p) => p.key)
}

/**
 * Move the working context to an already-reached page. Returns the page moved to (null
 * when refused) plus the chat bubbles the client should append.
 */
export async function performStageReentry(
  ideaId: string,
  userId: string,
  pageKey: string,
): Promise<{ movedTo: string | null; messages: string[] }> {
  const before = (await prisma.idea.findUnique({ where: { id: ideaId }, select: { lexPage: true } }))?.lexPage ?? 'ORIENTATION'
  if (pageKey === before) return { movedTo: null, messages: [] }

  const allowed = await reachablePages(ideaId)
  if (!allowed.includes(pageKey)) {
    console.warn('[lex-diag] stage re-entry refused — page not reached yet', { from: before, to: pageKey, allowed })
    return { movedTo: null, messages: [] }
  }

  await prisma.idea.update({ where: { id: ideaId }, data: { lexPage: pageKey } })

  // The panel shows this stage's stored search. If the stage never stored one (§19-D
  // Task 4), run it now rather than leaving the panel to fall back on older material.
  const store = readStageSearches(
    (await prisma.idea.findUnique({ where: { id: ideaId }, select: { stageSearches: true } }))?.stageSearches,
  )
  const shown = displayStageFor(pageKey)
  let searchRan = false
  if (!store.byStage[shown]) {
    await runStageSearch(ideaId, shown).catch((e) =>
      console.warn('[lex-diag] re-entry search failed:', e instanceof Error ? e.message : e))
    searchRan = true
  }

  // If the stage has an unfinished step, the conductor owns the next word exactly as it
  // does on a forward move. If it is complete, the conductor would post the end-of-page
  // wrap-up — which is not what "I've come back to change something" needs — so the
  // re-entry line is written here instead.
  const state = await computeCanonicalState(ideaId)
  const label = state?.pages.find((p) => p.key === pageKey)?.label ?? pageKey
  let messages: string[]
  if (state?.currentField && state.currentField.status === 'EMPTY') {
    messages = (await orchestrateAfterWrite(ideaId, userId)).messages
  } else {
    const line =
      `We're back in ${label}. Everything you'd settled is still here, and so is everything after it — ` +
      `nothing has been undone. Change what you want to change in the panel and I'll follow; when you're ` +
      `ready, pick up where you left off.`
    await postLexBubble(ideaId, line, pageKey)
    messages = [line]
  }

  console.log('[lex-diag] stage re-entry', { from: before, to: pageKey, searchRan, bubbles: messages.length })
  return { movedTo: pageKey, messages }
}

type ChatMsg = { role: string; content: string; timestamp?: string; stage?: string; field?: string }

/** Append one Lex bubble, tagged with the stage it was said in (§19-B Task 3). */
async function postLexBubble(ideaId: string, content: string, stage: string) {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { aiChatHistory: true } })
  const updated: ChatMsg[] = [
    ...(Array.isArray(idea?.aiChatHistory) ? (idea!.aiChatHistory as ChatMsg[]) : []),
    { role: 'lex', content, timestamp: new Date().toISOString(), stage },
  ].slice(-60)
  await prisma.idea.update({ where: { id: ideaId }, data: { aiChatHistory: updated } })
}

/**
 * Write-side page guard: a field belonging to a page AFTER the active one can
 * never be written (the state machine has not entered that page). Fields on the
 * active page or any earlier one are writable (earlier ones may be reopened).
 *
 * Returns `null` when the write is allowed, or the offending page pair when it is
 * refused — so a caller reads as `if (blocked) return 409`.
 */
export async function assertWritableField(
  ideaId: string,
  fieldKey: string,
): Promise<{ activePage: string; fieldPage: string } | null> {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { lexPage: true } })
  const activePage = idea?.lexPage ?? 'ORIENTATION'
  const fieldPage = pageOf(fieldKey)
  if (!fieldPage) return null // unknown key — the caller's own validation owns it
  const activeIdx = Math.max(0, pageSeqIndex(activePage))
  const fieldIdx = pageSeqIndex(fieldPage.key)
  if (fieldIdx > activeIdx) {
    console.warn('[lex-diag] write refused — field is on a page the state machine has not entered', {
      fieldKey, fieldPage: fieldPage.key, activePage,
    })
    return { activePage, fieldPage: fieldPage.key }
  }
  return null
}
