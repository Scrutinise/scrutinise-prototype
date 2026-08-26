// reranker.ts — SEARCH S14 §3. A MODEL READS THE POOLED CANDIDATES AND ORDERS THEM.
//
// ════════════════════════════════════════════════════════════════════════════════════════════════
// ⚠⚠ §5.1 OF `SEARCH_STRATEGY_v5.md` DECLINED A RERANKER, AND THE REASON NO LONGER HOLDS.
//
// It was declined in June because **the binding constraint was recall, not ordering**: 11 of 15
// scored pairs turned on whether the document was retrieved at all. S13 reversed that finding on
// measurement — 28 of 65 validated answers are now FOUND in some stream's own list and only 15
// are DISPLAYED. The system retrieves correctly and then fails to order across sources.
// **Ordering is the binding constraint now.** BRIEF_SEARCH_S14 §3 authorises this, bounded.
//
// ── WHAT IT MAY AND MAY NOT DO. The brief states it and this file enforces it:
//
//   ✅ REORDER the candidates it was given.
//   ❌ INVENT. An id in the model's answer that was not in the candidate list is DISCARDED and
//      counted as `invented`. It is never inserted, never looked up, never rendered.
//   ❌ SUMMARISE. The model returns ids and nothing else — there is no free-text field it could
//      put a summary in, so a summary cannot reach a user by accident.
//   ❌ DROP SILENTLY. A candidate the model omits from its ordering keeps its place BEHIND the
//      ones it ranked, in the order it already had, and the omission is COUNTED as `omitted`.
//      ⚠ A model that quietly drops the right answer is indistinguishable from retrieval that
//      never found it — the exact failure this measurement programme exists to prevent.
//
// ── BOUNDED, IN THREE PLACES, ALL CONFIG:
//   `SEARCH_RERANK_CANDIDATES`   how many pooled candidates the model may read   (default 60)
//   `SEARCH_RERANK_SNIPPET_CHARS` how much of each it may read                    (default 420)
//   `SEARCH_RERANK_MAX_PENCE`    per-query cost ceiling, refused BEFORE the call  (default 1.5p)
// The ceiling is checked against an ESTIMATE before the call and the ACTUAL cost is reported
// after, so an estimate that is wrong is visible rather than load-bearing.
//
// ── ⚠ THE CANDIDATE CAP IS TAKEN ROUND-ROBIN, AND THAT IS NOT AN ACCIDENT. Truncating the pool by
// merged order would hand the model a cap shaped by exactly the rationing this sprint exists to
// remove — the reranker would only ever see floor(N/S) of each stream and could not promote
// anything deeper, which is the round-robin defect one layer up wearing a model's face. Taking the
// cap round-robin guarantees every routed stream is represented in what the model reads, and the
// model is then free to give one stream all twenty slots.
//
// ── ⚠⚠ MODEL CHOICE IS A DECISION, AND HERE IT WAS MADE TWICE: ONCE ON REASONING AND ONCE ON
// MEASUREMENT, AND THEY DISAGREED. Ordering across sources is a judgement task, so this shipped on
// `gemini-2.5-pro`. Measured over the 64 validated questions against `gemini-2.5-flash`, on
// identical inputs, with the ECHOED model checked on every call:
//
//                        recall@20   recall@5   cost/query   latency   completed
//     gemini-2.5-pro       18/64       10/64      2.551p      34.7 s     44/64
//     gemini-2.5-flash     19/64       15/64      0.221p       1.6 s     63/64
//
// Flash is 11.5× cheaper, 22× faster and better on both, so the registry default is Flash. See
// `model-registry.ts` for the full note. ⚠ This is NOT the failure BRIEF_SEARCH_S14 §3 warns about
// — that is a pass running on the cheapest model available WITHOUT anyone having looked. The
// comparison is in `docs/SEARCH_S14_REPORT.md` §3.1.

import type { SearchResult } from './page1-config'
import { callModelJson, type LlmUsage } from './model-call'
import { outputBudgetFor } from './model-thinking'
import { resolveModel } from './model-registry'
import { priceBuild } from './build-cost'
import { flagEnabled } from '@/lib/env-flags'

/** ON only when deliberately switched on. Read through `flagEnabled` — never a bare `=== 'true'`. */
export function rerankerEnabled(): boolean { return flagEnabled('LEX_SEARCH_RERANKER') }

const intEnv = (name: string, dflt: number) => {
  const v = parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(v) && v > 0 ? v : dflt
}
const numEnv = (name: string, dflt: number) => {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v >= 0 ? v : dflt
}

export const RERANK_CANDIDATES = () => intEnv('SEARCH_RERANK_CANDIDATES', 60)
export const RERANK_SNIPPET_CHARS = () => intEnv('SEARCH_RERANK_SNIPPET_CHARS', 420)
/**
 * ⚠⚠ THE CEILING IS SET ABOVE THE INTENDED CONFIGURATION ON PURPOSE, AND THE ARITHMETIC IS WORTH
 * WRITING DOWN BECAUSE IT IS COUNTER-INTUITIVE.
 *
 * At the shipped defaults — `gemini-2.5-pro`, 60 candidates, 420 characters each — the pre-call
 * estimate is **~4.3p**, and about 3.5p of that is the THINKING ALLOWANCE (`LEX_THINKING_HEADROOM`,
 * 4,000 tokens at pro's $10/M output rate). Thinking tokens are billed as output, so the allowance
 * has to be inside the ceiling even though a given call usually does not spend all of it.
 *
 * A ceiling of 1.5p — the number this line first carried — would therefore have refused EVERY
 * call. That is not a ceiling; it is an off switch wearing one's name, and in a log it would have
 * read as "the reranker never helped." **A guard that refuses the configuration it is guarding is
 * the same defect as a guard that cannot fire, arrived at from the other side.**
 *
 * ⚠ RAISED TO 9p AFTER THE FIRST LIVE RUN, and the reason is the answer budget rather than the
 * price. `answerBudget` had to grow from 512 to 2,048 tokens because the model truncated on 45% of
 * queries, and the estimate is computed against the budget the call will ALLOW. So the worst case
 * moved to ~6.6p while the MEASURED ACTUAL over 64 queries was **3.622p** — the gap is the
 * unspent thinking allowance, and it is exactly why the actual is reported beside the estimate
 * rather than being inferred from it.
 *
 * 9p leaves the intended configuration comfortably inside and still catches what the ceiling
 * exists for: a pool that grew, a snippet budget someone raised, or a model swap to something an
 * order of magnitude dearer.
 */
export const RERANK_MAX_PENCE = () => numEnv('SEARCH_RERANK_MAX_PENCE', 9)
export const RERANK_TIMEOUT_MS = () => intEnv('SEARCH_RERANK_TIMEOUT_MS', 45_000)

const SYSTEM = `You are ordering search results for a UK policy and law research platform.

You are given a QUESTION and a numbered list of CANDIDATE documents drawn from several different
parts of a corpus — legislation, parliamentary debates, select committee material, court judgments
and regulator guidance. Each candidate shows the part of the corpus it came from, its title, and
the passage that matched.

Return the candidate numbers ordered from MOST to LEAST useful for answering the question.

Rules:
- Order by whether the document ANSWERS THE QUESTION, not by whether it shares vocabulary with it.
  A document that repeats the question's words while answering something else ranks low.
- Do NOT balance the sources. If every useful document comes from one part of the corpus, put them
  all at the top. If a source has nothing useful, its candidates belong at the bottom.
- A document that states the operative rule, the finding, or the decision outranks one that merely
  mentions the subject.
- Include EVERY candidate number exactly once. Do not add numbers that are not in the list.
- Return numbers only. No titles, no explanation, no summary.`

export interface RerankCandidate {
  id: string
  stream: string
  title: string
  citation: string
  snippet: string
  /** Provenance of the snippet. `false` = no query term was located, so the snippet is the head of
   *  the document; the prompt says so rather than presenting it as the matched passage. */
  snippetMatched?: boolean
}

export interface RerankOutcome {
  /** id → position, lower is better. EMPTY when the reranker did not run. */
  priority: Map<string, number>
  /** TRUE only when a model ordered the candidates. */
  applied: boolean
  reason?: 'disabled' | 'no-candidates' | 'over-cost-ceiling' | 'model-failed' | 'empty-ordering'
  detail?: string
  /** How many candidates the model was given. */
  read: number
  /** Candidates the model left OUT of its ordering. Counted, never silent. */
  omitted: number
  /** Numbers the model returned that were not candidates. Discarded, and counted. */
  invented: number
  /** Numbers the model returned more than once. The first occurrence wins; the rest are counted. */
  duplicated: number
  model: string
  usage: LlmUsage | null
  /** Estimated pence for this query. NULL means the model could not be priced — never 0. */
  pence: number | null
  ms: number
}

const EMPTY = (reason: RerankOutcome['reason'], model: string, detail?: string): RerankOutcome => ({
  priority: new Map(), applied: false, reason, detail, read: 0, omitted: 0, invented: 0,
  duplicated: 0, model, usage: null, pence: null, ms: 0,
})

const ORDER_SCHEMA = {
  type: 'object',
  properties: { order: { type: 'array', items: { type: 'integer' } } },
  required: ['order'],
}

/**
 * Take up to `cap` candidates ROUND-ROBIN across the streams, so every routed stream is
 * represented in what the model reads. See the header for why a merged-order cap would be wrong.
 */
export function capRoundRobin(perStream: RerankCandidate[][], cap: number): RerankCandidate[] {
  const out: RerankCandidate[] = []
  const cursor = perStream.map(() => 0)
  let progressed = true
  while (out.length < cap && progressed) {
    progressed = false
    for (let i = 0; i < perStream.length && out.length < cap; i++) {
      if (cursor[i] >= perStream[i].length) continue
      out.push(perStream[i][cursor[i]++])
      progressed = true
    }
  }
  return out
}

/**
 * A cheap, deliberately CONSERVATIVE token estimate for the pre-call ceiling check.
 *
 * ⚠ It is an estimate and the report prints the ACTUAL cost beside it. Four characters per token
 * understates a little for dense legal text, which is the safe direction for a ceiling: the check
 * fires slightly early rather than slightly late.
 */
export function estimatePence(candidates: RerankCandidate[], model: string): number | null {
  const snipChars = RERANK_SNIPPET_CHARS()
  const chars = SYSTEM.length + candidates.reduce(
    (n, c) => n + c.title.length + c.citation.length + Math.min(c.snippet?.length ?? 0, snipChars) + 40, 0)
  const tokensIn = Math.ceil(chars / 4)
  // ⚠ THE OUTPUT ESTIMATE IS THE BUDGET THE CALL WILL ACTUALLY ALLOW, not the answer we hope for.
  // `outputBudgetFor` adds the thinking headroom for a model that must think, and THINKING TOKENS
  // ARE BILLED AS OUTPUT — on `gemini-2.5-pro` that headroom is the majority of the bill. A
  // ceiling checked against the happy path is one a thinking model walks straight through.
  const tokensOut = outputBudgetFor(model, answerBudget(candidates.length))
  const price = priceBuild([{ model, tokensIn, tokensOut }])
  return price.pence
}

/**
 * The ANSWER budget, before any thinking headroom. One definition, so the estimate and the call
 * cannot disagree about the ceiling.
 *
 * ⚠⚠ IT WAS `max(512, n * 6 + 128)` AND THAT WAS TOO TIGHT — MEASURED, ON THE FIRST LIVE RUN.
 * `gemini-2.5-pro` truncated on **29 of 64 queries (45%)**, every one of them naming itself
 * correctly (`cut off at maxOutputTokens=4512`) because CLAUDE.md §18's guard is in the shared
 * helper. Two things were wrong with six tokens per candidate:
 *
 *   · **the model pretty-prints.** The salvaged tails read `"order": [\n    32,\n    51,\n    1,`
 *     — four spaces, a comma and a newline per entry, so an integer costs 5–8 tokens, not 2.
 *   · **the thinking allowance is not free room.** Thinking tokens are billed as output AND count
 *     against `maxOutputTokens`, so whatever a thinking model spends before it answers comes out
 *     of the same 4,512.
 *
 * CLAUDE.md §18 rule 5 is the fix and it is the fix here: *"Output tokens are billed on what is
 * generated, so a generous ceiling on a call that emits a small JSON object costs nothing. A tight
 * one buys nothing and eventually fires."* 16 tokens per candidate with a 2,048 floor is generous
 * for a list of integers and still bounded.
 *
 * ⚠ It moves the pre-call ESTIMATE, which is checked against `SEARCH_RERANK_MAX_PENCE` — see that
 * constant. The estimate is a worst case; the first run's ACTUAL was 3.6p per query.
 */
const answerBudget = (n: number) => Math.max(2048, n * 16 + 256)

/**
 * ⚠⚠ THE ENFORCEMENT, AS A PURE FUNCTION — "it may reorder; it may not invent, summarise, or drop
 * a result silently." Separated from the network call ON PURPOSE, so that
 * `scripts/check-s14-merge.ts` can watch each rule REJECT a real violation without needing a model
 * that is willing to misbehave on demand. A rule that has never been seen to fire is not a rule.
 *
 * The three deviations and what happens to each:
 *   INVENTED   — a number outside 1..n. Discarded. Never looked up, never inserted, counted.
 *   DUPLICATED — a number returned twice. The FIRST occurrence wins; the rest counted.
 *   OMITTED    — a candidate the model never named. It keeps its existing relative order BEHIND
 *                every candidate the model did rank (merge-judged.ts sorts absent ids last), and
 *                the count is reported. It is NOT dropped.
 */
export function applyOrdering(
  raw: unknown[],
  candidates: RerankCandidate[],
): { priority: Map<string, number>; omitted: number; invented: number; duplicated: number } {
  const priority = new Map<string, number>()
  const usedIndex = new Set<number>()
  let invented = 0
  let duplicated = 0
  for (const v of raw) {
    const i = typeof v === 'number' ? v : Number(v)
    if (!Number.isInteger(i) || i < 1 || i > candidates.length) { invented++; continue }
    if (usedIndex.has(i)) { duplicated++; continue }
    usedIndex.add(i)
    priority.set(candidates[i - 1].id, priority.size)
  }
  return { priority, omitted: candidates.length - priority.size, invented, duplicated }
}

/**
 * Order the pooled candidates with a model.
 *
 * Never throws: a reranker failure must degrade to the deterministic ordering, and it must SAY SO
 * (CLAUDE.md §18 — a degradation announces itself, with its cause attached).
 */
export async function rerankCandidates(
  question: string,
  perStream: RerankCandidate[][],
  opts: { label?: string } = {},
): Promise<RerankOutcome> {
  const choice = (() => {
    try { return resolveModel('search.reranker') } catch (e) {
      console.error('[reranker] model resolution failed — NOT falling back to a model nobody chose:', e)
      return null
    }
  })()
  if (!choice) return EMPTY('model-failed', 'unresolved', 'search.reranker could not be resolved')
  const model = choice.model

  const candidates = capRoundRobin(perStream, RERANK_CANDIDATES())
  if (!candidates.length) return EMPTY('no-candidates', model)

  const maxPence = RERANK_MAX_PENCE()
  const est = estimatePence(candidates, model)
  if (est === null) {
    // ⚠ UNPRICED IS NOT FREE. A ceiling that cannot see a cost is not a ceiling, and a run that
    // spent money nobody could account for is exactly what the ceiling exists to prevent.
    return EMPTY('over-cost-ceiling', model, `${model} has no rate in build-cost.ts — refusing to spend against an unenforceable ceiling`)
  }
  if (est > maxPence) {
    return EMPTY('over-cost-ceiling', model,
      `estimated ${est.toFixed(3)}p for ${candidates.length} candidates exceeds SEARCH_RERANK_MAX_PENCE=${maxPence}p`)
  }

  const snipChars = RERANK_SNIPPET_CHARS()
  const lines = candidates.map((c, i) => {
    const snip = (c.snippet ?? '').replace(/\s+/g, ' ').trim().slice(0, snipChars)
    const provenance = c.snippetMatched === false ? ' [opening of the document; no query term located]' : ''
    return `${i + 1}. [${c.stream}] ${c.title}${c.citation && c.citation !== c.title ? ` — ${c.citation}` : ''}\n   ${snip}${provenance}`
  })
  const user = `QUESTION: ${question}\n\nCANDIDATES (${candidates.length}):\n\n${lines.join('\n\n')}`

  const t0 = Date.now()
  const res = await callModelJson<{ order?: unknown }>({
    model,
    system: SYSTEM,
    user,
    schema: ORDER_SCHEMA,
    // The ANSWER budget alone — `callModelJson` runs it through `outputBudgetFor`, which adds the
    // thinking headroom for a model that must think. Same function `estimatePence` uses, so the
    // ceiling and the call cannot disagree about what the call will allow.
    maxOutputTokens: answerBudget(candidates.length),
    timeoutMs: RERANK_TIMEOUT_MS(),
    temperature: 0,
    label: opts.label ? `reranker:${opts.label}` : 'reranker',
    stream: 'lex',
    pass: 'search.reranker',
  })
  const ms = Date.now() - t0
  const usage = res.usage
  const pence = priceBuild([usage]).pence

  if (!res.ok) {
    // ⚠ THE CAST IS DELIBERATE AND IS NOT A TYPE HOLE. This project compiles with `strict: false`,
    // so TypeScript will not narrow a union on a BOOLEAN literal discriminant (`ok: true | false`)
    // — the same limitation `query-expansion.ts` records, which is why its own result type uses a
    // string `kind` instead. `res.ok === false` has already been established on this line.
    const fail = res as import('./model-call').LlmFail
    console.error(`[reranker] DEGRADED — reranking is ON but produced no ordering (${fail.reason}): ${fail.detail}. ` +
      `The deterministic ordering stands for this query.`)
    return { ...EMPTY('model-failed', model, `${fail.reason}: ${fail.detail}`), usage, pence, ms }
  }

  // ⚠ `?? []` IS NOT AVAILABLE HERE AS A CONVENIENCE. A declared schema is a REQUEST, not a
  // guarantee (docs/CLAUDE.md — a `?? []` once let a string into `.join` and killed four of ten
  // passes). An `order` that is not an array of numbers is a FAILED rerank, named as one.
  const raw = (res.value as { order?: unknown })?.order
  if (!Array.isArray(raw)) {
    return { ...EMPTY('empty-ordering', model, `the model returned no usable \`order\` array (${typeof raw})`), usage, pence, ms }
  }

  const { priority, omitted, invented, duplicated } = applyOrdering(raw, candidates)

  if (!priority.size) {
    return { ...EMPTY('empty-ordering', model, `all ${raw.length} returned values were unusable`), usage, pence, ms, invented, duplicated, read: candidates.length }
  }

  // ⚠ EVERY DEVIATION IS COUNTED AND LOGGED, at warn level when there is one. A reranker that
  // dropped or invented silently is the failure mode named in the brief; the log line is what
  // makes "it worked" and "it half worked" different observations.
  if (omitted || invented || duplicated) {
    console.warn('[reranker] the ordering was not a clean permutation of the candidates', {
      model, read: candidates.length, ranked: priority.size, omitted, invented, duplicated,
      note: 'omitted candidates keep their existing relative order BEHIND the ranked ones; invented numbers were discarded',
    })
  }
  console.log('[reranker] ordered', { model, read: candidates.length, ranked: priority.size, omitted, invented, duplicated, pence, ms })

  return { priority, applied: true, read: candidates.length, omitted, invented, duplicated, model, usage, pence, ms }
}
