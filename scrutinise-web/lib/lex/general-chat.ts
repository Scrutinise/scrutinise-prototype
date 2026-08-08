// ─────────────────────────────────────────────────────────────────────────────
// general-chat.ts — "ask the corpus anything". The Lex thread with no idea
// attached (brief: a general corpus chat interface).
//
// WHAT THIS IS FOR. Two things at once, and the second is why it is worth the code:
//
//   1. A research tool. A plain question against the whole corpus, answered from
//      what was actually retrieved, with the retrieval shown.
//   2. A TESTING SURFACE for search. Until now, verifying retrieval meant finding
//      an idea whose open field the question happened to be on-topic for — Lex
//      refuses an off-topic corpus search inside an idea, which is correct there
//      and useless for a benchmark (that is exactly how trial 1 of the vector-flip
//      verification was lost). Here there is no open idea, no on-topic test and no
//      field-machine state to satisfy, so the question you want to ask is the query
//      that reaches the index.
//
// WHAT IT IS NOT. It does not touch idea data — no read of an Idea, no write of
// one, no stageSearches record. The transcript lives in the browser tab and dies
// with it. That is deliberate: this bypasses the idea structure, so it must not be
// able to leave a mark on it.
//
// HOW IT RETRIEVES. runSearch(), like every other caller — no second retrieval
// path, so routing, expansion, per-stream dense fusion and everything after them
// are inherited rather than reimplemented. Crucially it is UNTIERED: it never sets
// `tier`, so it takes search-gateway.ts's routed branch (the tier-scoped branch
// calls runFtsSearch directly and never reaches fusedStream — see the §1 legacy
// surfaces). What this page exercises is therefore the same path the Page-1
// briefing takes.
//
// HOW IT ANSWERS. One Gemini call over the retrieved excerpts and nothing else.
// If retrieval failed, there is NO answer call at all — the failure is reported as
// a failure. An honest "the search didn't run" beats plausible law every time
// (§19-C Task 1a), and it matters more here than anywhere, because the whole point
// of the surface is to tell you what retrieval did.
// ─────────────────────────────────────────────────────────────────────────────

import type { SearchResult } from './page1-config'
import { runSearch, type CapabilityFlags } from './search-gateway'

export interface GeneralChatTurn {
  role: 'user' | 'lex'
  content: string
}

/** Everything the debugging view needs to say what retrieval actually did. */
export interface GeneralChatDiagnostics {
  /** The terms handed to the gateway (what it joins into the query string). */
  query: string[]
  /** Resolved capability flags for the process that served this turn. */
  flags: CapabilityFlags
  /** Streams the router dispatched to. Undefined = the router did not run or
   *  failed open, which is the difference between "routing works" and "one
   *  unfiltered call" — the single most important line on this page. */
  routedStreams?: string[]
  /** Terms stage-3 expansion added (empty when the router path ran instead). */
  expansionAdded: string[]
  /** The search could not be COMPLETED. Distinct from "ran and found nothing". */
  searchFailed: boolean
  searchFailureReason?: string
  /** Canonical results before grouping, and after. */
  retrieved: number
  grouped: number
  /** How many of `results` were actually put in front of the model. The rest were
   *  retrieved and are shown, but the answer could not have used them — a distinction
   *  the debugging view has to make or the source list overstates what was read. */
  contextCount: number
  searchMs: number
  /** Absent when no answer call was made (search failed, or no key configured). */
  answerMs?: number
  answerFailureReason?: string
  /** Citations the model returned that match nothing retrieved. Should always be
   *  empty; if it is not, the answer is citing something it was never shown. */
  droppedCitations: string[]
}

export interface GeneralChatResult {
  /** Null when no answer could be produced. The results still stand on their own. */
  answer: string | null
  /** The ranked set, ungrouped — the debugging view wants the ranking, not the
   *  panel's ≤3-per-type presentation. `grouped` is reported as a count only. */
  results: SearchResult[]
  /** Result ids the answer drew on, validated against `results`. */
  cited: string[]
  diagnostics: GeneralChatDiagnostics
}

/** Terms sent to the gateway. Same shape as runAdHocResearch — the question is the query. */
function toQueryTerms(question: string): string[] {
  return question.split(/\s+/).map((t) => t.trim()).filter(Boolean).slice(0, 32)
}

/** Recent turns, as steering context for expansion/routing ONLY (never cited). */
function conversationContext(history: GeneralChatTurn[]): string {
  return history
    .slice(-4)
    .map((t) => `${t.role === 'user' ? 'Q' : 'A'}: ${t.content}`)
    .join('\n')
    .slice(0, 500)
}

// ── the answer call ──────────────────────────────────────────────────────────

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    citedIds: { type: 'array', items: { type: 'string' } },
  },
  // citedIds is REQUIRED. Left optional, the first live run simply omitted it — the
  // answer carried perfectly good [n] markers and the structured field came back
  // empty, which would have rendered as "0 cited" under a fully-cited answer. An
  // optional field a model may skip is not a contract.
  required: ['answer', 'citedIds'],
}

const ANSWER_SYSTEM = `You are Lex, answering research questions against the Scrutinise corpus of UK primary legislation, statutory instruments, retained EU law, Hansard debates, select-committee reports and evidence, case law, and regulator guidance. British English, plain, FT op-ed register. No emojis. Never say you are an AI or name a model.

You are given SOURCES retrieved from the corpus for this question. They are the ONLY material you may draw factual claims from.

RULES, in order of importance:
- Every claim about what the law says, what was said in Parliament, what a court held or what a regulator published MUST come from a source below. If it is not in a source, you do not have it.
- Cite as you go, inline, using the source's [n] marker exactly as numbered below, and list the full "id:" string of every source you used in citedIds. Never cite an [n] that is not in the list.
- If the sources do not answer the question, say so plainly and say what they DO cover. Do not fill the gap from memory, and do not describe a source you were not given. "The corpus didn't surface anything on this" is a useful answer here; a confident wrong one is not.
- Do not quote figures that are not in the sources.
- Distinguish what a source establishes from what it merely suggests. Note when a retrieved provision may have been amended since the retrieved text — say it plainly rather than implying currency you cannot see.
- Be concise: a few short paragraphs at most. General knowledge may be used to FRAME the sources (what an Act is for, how a committee works), never to add facts.`

interface AnswerOutput {
  answer: string
  citedIds: string[]
}

function renderSources(results: SearchResult[]): string {
  return results
    .map((r, i) => {
      const bits = [
        `[${i + 1}] id: ${r.id}`,
        `type: ${r.type}`,
        `title: ${r.title || '(untitled)'}`,
        r.citation && r.citation !== r.title ? `citation: ${r.citation}` : '',
        r.date ? `date: ${r.date}` : '',
        `excerpt: ${r.snippet.replace(/\s+/g, ' ').slice(0, 700)}`,
      ].filter(Boolean)
      return bits.join('\n')
    })
    .join('\n\n')
}

async function callGeminiForAnswer(
  question: string,
  history: GeneralChatTurn[],
  results: SearchResult[],
): Promise<AnswerOutput> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in this environment')
  const model = process.env.LEX_GENERAL_MODEL ?? 'gemini-2.5-flash'
  const timeoutMs = parseInt(process.env.LEX_GENERAL_TIMEOUT_MS ?? '30000', 10)
  // 8192, not the 2048 the idea-chat uses, and thinking OFF. The first live run of
  // this file died on `Unterminated string in JSON at position 2488`: an answer over
  // sixteen sources is simply longer than a chat turn, and gemini-2.5-flash spends
  // its "thinking" out of the SAME budget — the failure mode already documented in
  // query-expansion.ts (2026-07-29) and web-orientation.ts (2026-08-06). Both fixed
  // it the same way. A third instance is a pattern, so it is written down here too.
  const maxTokens = parseInt(process.env.LEX_GENERAL_MAX_TOKENS ?? '8192', 10)

  const user = [
    results.length
      ? `SOURCES retrieved for this question:\n\n${renderSources(results)}`
      : 'SOURCES: none. The search ran and returned nothing usable.',
    '',
    `QUESTION: ${question}`,
  ].join('\n')

  const contents = [
    ...history.slice(-8).map((t) => ({
      role: t.role === 'lex' ? 'model' : 'user',
      parts: [{ text: t.content }],
    })),
    { role: 'user', parts: [{ text: user }] },
  ]

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
          system_instruction: { parts: [{ text: ANSWER_SYSTEM }] },
          contents,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json',
            responseSchema: ANSWER_SCHEMA,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    )
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Gemini HTTP ${res.status}${body ? `: ${body.slice(0, 300)}` : ''}`)
    }
    type Resp = {
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>
    }
    const data = (await res.json()) as Resp
    const candidate = data?.candidates?.[0]
    const text = candidate?.content?.parts?.[0]?.text
    if (typeof text !== 'string') {
      throw new Error(`Gemini returned no text part (finishReason=${candidate?.finishReason ?? 'unknown'})`)
    }
    // Name truncation as truncation. Left unchecked it arrives as an opaque
    // "Unterminated string in JSON at position N", which reads like a serialiser bug
    // and sends you looking at the wrong thing — it did exactly that on the first run.
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      throw new Error(
        `Gemini stopped early (finishReason=${candidate.finishReason}) — the answer was cut off at ` +
        `maxOutputTokens=${maxTokens}. Raise LEX_GENERAL_MAX_TOKENS or shorten the source set.`,
      )
    }
    const parsed = JSON.parse(text) as Partial<AnswerOutput>
    if (typeof parsed.answer !== 'string' || !parsed.answer.trim()) {
      throw new Error('answer missing from structured output')
    }
    return {
      answer: parsed.answer.trim(),
      citedIds: Array.isArray(parsed.citedIds) ? parsed.citedIds.map(String) : [],
    }
  } finally {
    clearTimeout(t)
  }
}

// ── the turn ─────────────────────────────────────────────────────────────────

/** Results handed to the model. Enough to answer from; not so many that the
 *  excerpt block crowds out the question. The panel shows everything retrieved. */
const ANSWER_CONTEXT_LIMIT = 16

/**
 * One turn of general corpus chat: retrieve, then answer from what was retrieved.
 * Never throws — a failure on either half is reported in the diagnostics and the
 * other half's output still stands (retrieval is useful with no answer; an answer
 * is never produced with no retrieval).
 */
export async function runGeneralCorpusChat(input: {
  question: string
  history?: GeneralChatTurn[]
  /** Canonical results requested from the gateway before grouping. */
  limit?: number
}): Promise<GeneralChatResult> {
  const question = input.question.trim()
  const history = input.history ?? []
  const query = toQueryTerms(question)

  // ── retrieve. UNTIERED: no `tier`, so the gateway takes the routed path.
  const t0 = Date.now()
  const search = await runSearch({
    keywords: query,
    intent: 'GENERAL_CORPUS_CHAT',
    ideaContext: conversationContext(history),
    limit: input.limit ?? 16,
  }).catch((err: unknown) => {
    const reason = err instanceof Error ? err.message : String(err)
    console.error('[lex-general] gateway threw — reporting as a failed search:', reason)
    return null
  })
  const searchMs = Date.now() - t0

  if (!search) {
    return {
      answer: null,
      results: [],
      cited: [],
      diagnostics: {
        query,
        // The gateway owns flag resolution; if it threw we have no snapshot to report,
        // and inventing one here would put a second reader of the flags in the codebase.
        flags: { expansion: false, router: false, webOrientation: false, vector: false, reranker: false, graph: false },
        expansionAdded: [],
        searchFailed: true,
        searchFailureReason: 'The search gateway threw — see the server log.',
        retrieved: 0,
        grouped: 0,
        contextCount: 0,
        searchMs,
        droppedCitations: [],
      },
    }
  }

  const diagnostics: GeneralChatDiagnostics = {
    query,
    flags: search.meta.flags,
    routedStreams: search.meta.routedStreams,
    expansionAdded: search.meta.expansionAdded,
    searchFailed: search.failed,
    searchFailureReason: search.failureReason,
    retrieved: search.results.length,
    grouped: search.grouped.length,
    contextCount: 0,
    searchMs,
    droppedCitations: [],
  }

  // A search that could not COMPLETE gets no answer call. Answering anyway would
  // produce law from memory dressed as research — the exact failure §19-C forbids.
  if (search.failed) {
    console.error('[lex-general] search failed — no answer produced', { reason: search.failureReason })
    return { answer: null, results: [], cited: [], diagnostics }
  }

  const context = search.results.slice(0, ANSWER_CONTEXT_LIMIT)
  diagnostics.contextCount = context.length
  const t1 = Date.now()
  let out: AnswerOutput
  try {
    out = await callGeminiForAnswer(question, history, context)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    diagnostics.answerMs = Date.now() - t1
    diagnostics.answerFailureReason = reason
    console.error('[lex-general] answer call failed — returning retrieval only:', reason)
    return { answer: null, results: search.results, cited: [], diagnostics }
  }
  diagnostics.answerMs = Date.now() - t1

  // Resolve citations two ways and take the union, because the two fail differently.
  //
  //   · The inline [n] MARKERS are ours: we numbered the sources, so a marker resolves
  //     positionally and cannot be misremembered. This is the primary mechanism.
  //   · citedIds is the model echoing a long opaque id back. It is worth having as a
  //     cross-check but it is the half that can drift, and on the first live run it
  //     was simply absent.
  //
  // Anything that resolves to nothing — an out-of-range marker, an id never shown —
  // is a citation to something that does not exist, and on a surface built to audit
  // retrieval that has to be visible, not quietly dropped.
  const known = new Set(search.results.map((r) => r.id))
  const dropped: string[] = []
  const citedSet = new Set<string>()

  for (const id of out.citedIds) {
    if (known.has(id)) citedSet.add(id)
    else dropped.push(id)
  }
  // `[1, 2]` as well as `[1]` — the model groups markers when a sentence rests on two
  // sources, and the first live run produced both forms in the same answer.
  for (const m of out.answer.matchAll(/\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g)) {
    for (const part of m[1].split(',')) {
      const n = parseInt(part.trim(), 10)
      const source = context[n - 1]
      if (n >= 1 && source) citedSet.add(source.id)
      else dropped.push(`[${n}]`)
    }
  }

  const cited = search.results.filter((r) => citedSet.has(r.id)).map((r) => r.id) // ranked order
  diagnostics.droppedCitations = [...new Set(dropped)]
  if (diagnostics.droppedCitations.length) {
    console.error('[lex-general] answer cited sources that were not retrieved', {
      dropped: diagnostics.droppedCitations,
    })
  }

  console.log('[lex-general] turn', {
    q: question.slice(0, 80),
    retrieved: diagnostics.retrieved,
    streams: diagnostics.routedStreams ?? null,
    searchMs,
    answerMs: diagnostics.answerMs,
  })

  return { answer: out.answer, results: search.results, cited, diagnostics }
}
