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
import { modelFor } from './model-registry'
import { recordGeminiUsage } from './spend-ledger'

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
  /** Per routed stream: how many hits it returned, and how many of them are inside the answer
   *  context. A stream with `retrieved > 0 && inContext === 0` is the §1 failure — retrieved,
   *  counted, panel-displayed, and invisible to the answer. Absent on the tier-scoped path,
   *  which has one stream by contract. */
  contextStreams?: Array<{ stream: string; retrieved: number; inContext: number }>
  searchMs: number
  /** Billed tokens for the answer call, from the API's own usageMetadata. Present only when the
   *  answer call completed. Input tokens scale with the context budget, so this is the number the
   *  budget decision is made on. */
  promptTokens?: number
  outputTokens?: number
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

// REMOVED 2026-08-08: conversationContext(), which fed recent turns to the router as steering
// context. It steered — into the previous question's topic. See the note at the runSearch call.
// Deleted rather than left unused so nobody reconnects it without reading why it went.

// ── the answer call ──────────────────────────────────────────────────────────

const ANSWER_SCHEMA = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    citedMarkers: { type: 'array', items: { type: 'integer' } },
  },
  // REQUIRED. Left optional, the first live run simply omitted it — the answer carried
  // perfectly good [n] markers and the structured field came back empty, which would have
  // rendered as "0 cited" under a fully-cited answer. An optional field a model may skip
  // is not a contract.
  //
  // ⚠ MARKERS, NOT IDS (changed 2026-08-08). This field used to be `citedIds: string[]`,
  // which asked the model to echo a long opaque compound id verbatim
  // (`primary-acts-pre-2000:ukpga/1988/50:section-21`). That is a pure transcription task over
  // an opaque string, and near-miss transcription — a wrong section number, a dropped
  // segment — produces something that looks plausible and matches nothing, which then
  // surfaced as "cited a source that was never retrieved" and read as a grounding failure
  // when it was a typo in a redundant field.
  //
  // The [n] markers are OURS: we numbered the sources, so a marker is a small integer that
  // either is in range or is not. That removes the mangling class outright rather than
  // widening the guard against it — and it makes what remains diagnostic, because an
  // out-of-range marker really is the model pointing at a source it was never given.
  required: ['answer', 'citedMarkers'],
}

const ANSWER_SYSTEM = `You are Lex, answering research questions against the Scrutinise corpus of UK primary legislation, statutory instruments, retained EU law, Hansard debates, select-committee reports and evidence, case law, and regulator guidance. British English, plain, FT op-ed register. No emojis. Never say you are an AI or name a model.

You are given SOURCES retrieved from the corpus for this question. They are the ONLY material you may draw factual claims from.

RULES, in order of importance:
- Every claim about what the law says, what was said in Parliament, what a court held or what a regulator published MUST come from a source below. If it is not in a source, you do not have it.
- Cite as you go, inline, using the source's [n] marker exactly as numbered below, and list those same numbers in citedMarkers. Use ONLY numbers that appear in the source list below — never a number you have not been given, and never an id string.
- If the sources do not answer the question, say so plainly and say what they DO cover. Do not fill the gap from memory, and do not describe a source you were not given. "The corpus didn't surface anything on this" is a useful answer here; a confident wrong one is not.
- Do not quote figures that are not in the sources.
- Distinguish what a source establishes from what it merely suggests. Note when a retrieved provision may have been amended since the retrieved text — say it plainly rather than implying currency you cannot see.
- Be concise: a few short paragraphs at most. General knowledge may be used to FRAME the sources (what an Act is for, how a committee works), never to add facts.`

interface AnswerOutput {
  answer: string
  /** 1-based indices into the source list the model was shown. See ANSWER_SCHEMA. */
  citedMarkers: number[]
  /** Billed tokens, straight from the response's usageMetadata — the exact number, not an
   *  estimate over a reconstructed prompt. The context budget is a direct cost-per-query trade,
   *  and it cannot be traded without this figure being visible. */
  promptTokens?: number
  outputTokens?: number
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
  // S6 §2 — default via lib/lex/model-registry.ts; LEX_GENERAL_MODEL still takes precedence.
  const model = process.env.LEX_GENERAL_MODEL ?? modelFor('lex.general-chat')
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
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
    }
    const data = (await res.json()) as Resp
    // BRIEF_SEARCH_S6 §3 addendum. Corpus chat is admin-only, and it is still spend — leaving it
    // out would understate the platform total by exactly the calls Charlie makes himself.
    void recordGeminiUsage(data, { stream: 'admin', pass: 'lex.general-chat', model: modelFor('lex.general-chat') })
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
      // Coerce defensively: the schema says integer, but a model that returns "3" should not
      // be treated as having cited nothing. Non-numeric entries fall through as NaN and are
      // rejected by the range check at the resolution step, where they are counted.
      citedMarkers: Array.isArray(parsed.citedMarkers) ? parsed.citedMarkers.map(Number) : [],
      // BRIEF_SEARCH_S6 §3 addendum — corpus chat is admin-only but it is still spend.
      promptTokens: data.usageMetadata?.promptTokenCount,
      outputTokens: data.usageMetadata?.candidatesTokenCount,
    }
  } finally {
    clearTimeout(t)
  }
}

// ── the turn ─────────────────────────────────────────────────────────────────

/**
 * Results handed to the model. Enough to answer from; not so many that the excerpt block crowds
 * out the question. The panel shows everything retrieved.
 *
 * ⚠ THE PREFIX IS ONLY HONEST BECAUSE THE LIST IS INTERLEAVED. `search.results` on the routed
 * path used to be `perStream.flat()` — stream-blocked, legislation first — so this slice landed
 * entirely inside one stream and the other four were dropped before the answer was written. That
 * is the bug that made Lex say "the sources do not contain information on what select committees
 * have said" while the committees stream had returned hits. runRoutedSearch now round-robins the
 * streams (lib/lex/interleave.ts), so a prefix is a balanced sample rather than one stream's
 * head. Do not reintroduce a slice over a flat concatenation anywhere.
 *
 * Read at CALL time from env so the budget can be measured without a code change (16/24/32,
 * scripts/measure-context-budget.ts). The DEFAULT IS UNCHANGED at 16 — the budget is a direct
 * cost-per-query trade and is Charlie's to set, not this file's.
 */
const DEFAULT_ANSWER_CONTEXT_LIMIT = 16
function answerContextLimit(): number {
  const raw = parseInt(process.env.LEX_GENERAL_CONTEXT_LIMIT ?? '', 10)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_ANSWER_CONTEXT_LIMIT
}

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
    // ⚠ DELIBERATELY EMPTY — history must not reach RETRIEVAL on this surface.
    //
    // `ideaContext` feeds the router, which writes each stream's tailored search string from it.
    // On an idea-bound chat that is right: the idea IS the context, and every question is about
    // it. Here it is wrong, because consecutive questions are routinely unrelated, and the
    // effect is that every question after the first is dragged toward the last one.
    //
    // Measured, not assumed (scripts/probe-context-bleed.ts, 2026-08-08). Same question, one
    // variable changed:
    //   cold           legislation → "Enterprise Act 2002 regulatory powers compel information disclosure"
    //   with history   legislation → "Data Protection Act 2018 investigatory powers disclosure of information"
    // The anchor Act was swapped for the previous topic's statute — on the legislation stream,
    // which is the one carrying dense retrieval. Live, that produced 233 data-protection sources
    // for a question about regulators' disclosure powers.
    //
    // The answer call still receives `history` (below), so Lex keeps the thread of the
    // conversation; only what we go and FETCH is decoupled from it.
    //
    // KNOWN COST, accepted: a purely anaphoric follow-up ("tell me more about that") now
    // retrieves against the pronoun and will do badly. The fix for that is to resolve the
    // question into a standalone query before retrieval, NOT to feed raw history to the router —
    // recorded as the next step rather than built here.
    ideaContext: '',
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

  const context = search.results.slice(0, answerContextLimit())
  diagnostics.contextCount = context.length
  // What the answer call can actually see, per stream. The counted thing, not the assumed one:
  // "committees was routed" and "committees reached the model" are different claims, and the
  // second is the one that decides whether Lex can say anything about committees.
  if (search.meta.perStream?.length) {
    const inContext = new Set(context.map((r) => r.id))
    diagnostics.contextStreams = search.meta.perStream.map((s) => ({
      stream: s.stream,
      retrieved: s.ids.length,
      inContext: s.ids.filter((id) => inContext.has(id)).length,
    }))
    const missing = diagnostics.contextStreams.filter((s) => s.retrieved > 0 && s.inContext === 0)
    if (missing.length) {
      console.error('[lex-general] a stream returned hits but reached NONE of the answer context', {
        missing: missing.map((s) => `${s.stream}(${s.retrieved} hits)`),
        budget: context.length,
        coverage: diagnostics.contextStreams,
      })
    }
  }
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
  diagnostics.promptTokens = out.promptTokens
  diagnostics.outputTokens = out.outputTokens

  // Resolve citations from two places and take the union, because the two go MISSING
  // differently even though they can no longer be WRONG differently:
  //
  //   · the inline [n] markers in the prose — present whenever the model cites as it writes;
  //   · the structured citedMarkers array — present whenever the model fills the field, which
  //     on the first live run it did not.
  //
  // Both are now the same kind of thing (a 1-based index into the sources we showed) and both
  // go through the same range check, so there is no longer a weaker half that can drift.
  // Anything out of range is the model pointing at a source it was never given, and on a
  // surface built to audit retrieval that has to be visible, not quietly dropped.
  const dropped: string[] = []
  const citedSet = new Set<string>()

  /** One range check, used by both paths. `context` is exactly what the model was shown. */
  const resolveMarker = (n: number) => {
    const source = Number.isInteger(n) && n >= 1 ? context[n - 1] : undefined
    if (source) citedSet.add(source.id)
    else dropped.push(`[${Number.isFinite(n) ? n : 'non-numeric'}]`)
  }

  // The structured field. Now markers rather than ids, so this is the same check as the
  // inline path — there is no longer a second, weaker way for a citation to be wrong.
  for (const n of out.citedMarkers) resolveMarker(n)

  // `[1, 2]` as well as `[1]` — the model groups markers when a sentence rests on two
  // sources, and the first live run produced both forms in the same answer.
  for (const m of out.answer.matchAll(/\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g)) {
    for (const part of m[1].split(',')) resolveMarker(parseInt(part.trim(), 10))
  }

  const cited = search.results.filter((r) => citedSet.has(r.id)).map((r) => r.id) // ranked order
  diagnostics.droppedCitations = [...new Set(dropped)]
  if (diagnostics.droppedCitations.length) {
    // Since citations became markers, there is exactly ONE way to land here: the model
    // pointed at a source number it was never shown. That is a real grounding failure, not a
    // mistyped id, so the message says so plainly and reports the range it had to work with.
    console.error('[lex-general] answer cited source numbers it was never shown', {
      dropped: diagnostics.droppedCitations,
      // 25-C — `String()` because `restrict-template-expressions` reports `context.length` as
      // `any` here. The value is a number at runtime; what the rule is telling us is that the
      // compiler cannot VOUCH for it on this path, and a diagnostic that silently prints
      // "[object Object]" would be worst exactly when someone is reading it to debug a grounding
      // failure. The underlying `any` on `search.results` is worth its own look.
      shown: `[1..${String(context.length)}]`,
      question: question.slice(0, 120),
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
