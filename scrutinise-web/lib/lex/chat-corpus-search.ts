// ─────────────────────────────────────────────────────────────────────────────
// 26-M — LEX CAN SEARCH THE CORPUS, FROM THE CHAT.
//
// Charlie, 2 Oct: 26-L removed the "research an angle" box *on the basis that Lex would do it*, and the Lex
// half was never built — so there was no way to search from the screen, and Lex, told it could not search,
// recommended a full re-run and a Deepening pass: the most expensive option, and one that could not even be
// reached.
//
// ⚠⚠ THE PLATFORM SEARCHES, LEX REPORTS — Decision 92's pattern a fourth time. The detector is deterministic
// (`isCorpusSearchRequest`), the search is `runGeneralCorpusChat` (lib/lex/general-chat.ts — retrieval through
// the search gateway, then an answer written ONLY from what was retrieved, with [n] markers validated against
// what the model was shown), and Lex is handed the outcome to relay. It is never asked to decide whether to
// search or to call a tool that might not fire.
//
// ⚠ REUSED, NOT REBUILT. `runGeneralCorpusChat` was admin-only (`/api/admin/lex-general`). It is a function, not
// a route: nothing in it is admin-specific except the ledger stream, which `spendStream` now sets.
//
// ⚠ SOURCES ARE APPENDED BY THE PLATFORM, not left to the model to remember: the user is shown what the answer
// rests on whether or not Lex lists it.
// ─────────────────────────────────────────────────────────────────────────────

import { runGeneralCorpusChat, type GeneralChatTurn } from './general-chat'
import { appendAdHocRecord, type ResearchRecord } from './stage-search'
import type { SearchResult } from './page1-config'

export interface LexCorpusSearch {
  query: string
  ok: boolean
  /** Why it did not complete, when it did not. */
  failure: string | null
  /** The prompt block Lex is handed. */
  block: string
  /** Appended to Lex's reply by the platform. Empty when there is nothing to list. */
  footer: string
  /** The record the panel shows as research the user asked for. */
  record: ResearchRecord
  sourceCount: number
}

const MAX_FOOTER_SOURCES = 8

function line(n: number | string, r: SearchResult): string {
  // `citation` usually already carries the title and the date; printing all three said everything twice.
  const label = r.citation && r.citation.toLowerCase().includes(r.title.toLowerCase().slice(0, 40)) ? r.citation : `${r.title} — ${r.citation}`
  const date = r.date && !label.includes(r.date.slice(0, 10)) ? `, ${r.date.slice(0, 10)}` : ''
  const url = r.url ? ` — ${r.url}` : ''
  return `[${n}] ${label}${date}${url}`
}

/**
 * Run one corpus search for the idea chat and shape what Lex is told. Never throws.
 */
export async function runLexCorpusSearch(input: {
  ideaId: string
  userId: string
  /** What to search for — the SUBJECT, with the instruction wrapper already stripped. */
  query: string
  ideaTitle: string | null
  history: Array<{ role: string; content: string }>
}): Promise<LexCorpusSearch> {
  // A bare "search again" has no subject; the idea's own title is the honest default, and the report says
  // what was actually searched for so the user can see it was not what they meant.
  const words = input.query.split(/\s+/).filter(Boolean)
  const query = words.length >= 3 || !input.ideaTitle ? input.query : `${input.query} ${input.ideaTitle}`.trim()

  const history: GeneralChatTurn[] = input.history
    .filter((m) => m.role === 'user' || m.role === 'lex')
    .slice(-6)
    .map((m) => ({ role: m.role as 'user' | 'lex', content: m.content.slice(0, 2000) }))

  const out = await runGeneralCorpusChat({ question: query, history, limit: 12, userId: input.userId, spendStream: 'lex' })

  const failed = out.diagnostics.searchFailed || (!out.answer && out.results.length === 0)
  const failure = out.diagnostics.searchFailed
    ? (out.diagnostics.searchFailureReason ?? 'The search did not complete.')
    : !out.answer && out.results.length === 0
      ? 'The search ran and returned nothing.'
      : out.diagnostics.answerFailureReason ?? null

  const context = out.context ?? []
  // The numbers in the answer are positions in `context`, so the cited list is printed with THOSE numbers.
  const citedIds = new Set(out.cited)
  const cited = context.map((r, i) => ({ n: i + 1, r })).filter(({ r }) => citedIds.has(r.id)).slice(0, MAX_FOOTER_SOURCES)

  const record: ResearchRecord = {
    query, ranAt: new Date().toISOString(), ok: !failed,
    failureReason: failure ?? undefined, results: out.results.slice(0, 12),
  }
  await appendAdHocRecord(input.ideaId, record).catch((err) => console.error('[lex-corpus-search] could not store the record', err))

  const footerSources = cited.length
    ? cited.map(({ n, r }) => line(n, r))
    : out.results.slice(0, 5).map((r, i) => line(i + 1, r))
  const footer = footerSources.length
    ? `\n\n${cited.length ? 'Sources the answer rests on' : 'Closest sources retrieved (none was cited in an answer)'}:\n${footerSources.join('\n')}`
    : ''

  let block: string
  if (failed || !out.answer) {
    block = [
      'CORPUS SEARCH RUN THIS TURN (the platform ran it — you did not, and you cannot): IT DID NOT PRODUCE AN ANSWER.',
      `Searched for: "${query}".`,
      `What happened: ${failure ?? 'an answer could not be written from what was retrieved'}.`,
      out.results.length ? `${out.results.length} sources were retrieved and are listed under your reply.` : 'Nothing was retrieved.',
      'Say plainly that the search did not give an answer, and why, in one or two sentences. Do NOT answer the question',
      'from memory as if it had been researched. Offer to try a differently-worded search.',
    ].join('\n')
  } else {
    block = [
      'CORPUS SEARCH RUN THIS TURN (the platform ran it — you did not, and you cannot run another this turn).',
      `Searched for: "${query}". ${out.results.length} sources retrieved; the answer below was written from the top ${context.length}.`,
      '',
      'WHAT THE SOURCES SAY (written only from the retrieved sources; [n] numbers match the list under your reply):',
      out.answer,
      '',
      'Report what was found, in your own words, citing the [n] numbers. Say how much of it there was and how strong:',
      'one passing mention is not a finding. Add nothing that is not above — no figures, cases or dates from memory.',
      'If the answer says the sources do not cover something, say that. The platform lists the sources itself.',
    ].join('\n')
  }

  return { query, ok: !failed && !!out.answer, failure, block, footer, record, sourceCount: out.results.length }
}
