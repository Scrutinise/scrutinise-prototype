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
import { pageOf, pageSeqIndex } from './page1-config'
import { runStageSearch } from './stage-search'

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
