// stream-scopes.ts — WHICH PART OF THE CORPUS each router stream can reach.
//
// Extracted from query-router.ts on 2026-08-09 (BRIEF_SEARCH_S2B §1) because it now has a second
// reader: `scripts/ingest/search/corpus-reachability.ts`, which computes, per collection, whether
// any stream can select it at all. That measurement is worthless if it is taken against a COPY of
// this table — a copy is how the matrix would keep saying "reachable" for a month after someone
// narrowed a filter. So the scopes live here, with no runtime imports, and both readers take the
// same object.
//
// Runtime-dependency-free ON PURPOSE. query-router.ts pulls in the FTS client, the vector client,
// fusion and Prisma; the reachability script runs under `scripts/ingest`, outside the Next.js
// path alias, and could not import any of that. Every import below is `import type`, so this
// module compiles away to a single array of plain data.

import type { SearchResultType } from './page1-config'

/** The stream names the router can address today. Declared HERE, next to the scopes, and
 *  re-exported by query-expansion.ts (which owns the LLM decision that produces them). It used
 *  to live there, which meant anything wanting the name list imported a Gemini client.
 *
 *  The three after the base five are the S8 §4 candidates, live only behind
 *  `LEX_ROUTER_STREAMS_V2`.
 *
 *  ⚠ `statistics` (S9 §4, behind `LEX_STATS_STREAM`) IS DELIBERATELY NOT IN `STREAM_SCOPES`
 *  BELOW, and that is not an oversight. A `StreamScope` describes a slice of the CORPUS index
 *  — a tier, a corpus prefilter, a display type — and the statistics catalogue is none of
 *  those: it lives in a separate database, carries no corpus rows, and is retrieved by
 *  `lib/lex/stats-catalogue.ts` rather than by the FTS/vector services.
 *
 *  Two consequences worth stating, because both would otherwise read as bugs:
 *    · `runRoutedSearch` iterates `streams()`, which is built from `STREAM_SCOPES`, so a route
 *      naming `statistics` is simply not matched there and no corpus retrieval happens for it.
 *      The gateway picks it up separately and puts it on its own channel.
 *    · `corpus-reachability.ts` computes which COLLECTIONS a stream can select. Statistics has
 *      no collection, so its absence from the scope table keeps that matrix honest rather than
 *      adding a row that can never be satisfied. */
export type RouterStreamName =
  | 'legislation' | 'debates' | 'committees' | 'caselaw' | 'guidance'
  | 'impact-assessments' | 'consultations' | 'explanatory'
  | 'statistics'

/**
 * COMMITTEE / DEBATE corpora, kept next to each other because they are complements and must
 * stay so. corpus-type-map.ts maps `corpus.startsWith('committees')` → COMMITTEE within the
 * parliamentary tier; everything else in that tier is DEBATE apart from a handful of BILL /
 * TREATY / null corpora, which the debates stream excludes here for the same reason it always
 * dropped them client-side.
 *
 * Listed explicitly rather than by prefix because the filter is a SQL `IN` evaluated in the
 * index, and because a new `committees-*` corpus should be a deliberate addition here rather
 * than something that silently joins a stream on the strength of its name.
 *
 * ⚠ The complement form has a cost the reachability matrix made visible: every corpus named in
 * NON_DEBATE_PARLIAMENTARY that is NOT in COMMITTEE_CORPORA is in the parliamentary tier and in
 * NEITHER stream — no router stream can select it, whatever the query. That is a deliberate
 * exclusion for `bills-api`/`uk-treaties`/`tax-treaties-dta`/`members-interests`/`erskine-may`
 * and it is the right default; it is also invisible unless something counts it, which is the
 * job of docs/CORPUS_REACHABILITY.md.
 */
export const COMMITTEE_CORPORA = ['committees-reports', 'committees-evidence']
export const NON_DEBATE_PARLIAMENTARY = [
  ...COMMITTEE_CORPORA, 'bills-api', 'uk-treaties', 'tax-treaties-dta', 'members-interests', 'erskine-may',
]

/** What one stream is allowed to retrieve. Mirrors the `tier`/`corpora`/`excludeCorpora`/`types`
 *  fields of StreamConfig; the `search` function stays in query-router.ts because it is code. */
export interface StreamScope {
  name: RouterStreamName
  /** FTS tier value passed to the server-side tier filter. Matched against the tier BAKED INTO
   *  THE INDEX at build time — not against `tierFor(corpus)` as it reads today. A corpus seeded
   *  after the tier map last changed carries the old tier in the live index, and the router
   *  filters on the index. */
  tier: string
  /** Further restricts to these display types — needed only when a tier is shared by more than
   *  one stream (parliamentary → debates vs committees). Absent = every type the tier yields. */
  types?: SearchResultType[]
  /** Server-side corpus PREfilter — the real stream boundary when a tier is shared. */
  corpora?: string[]
  /** Server-side corpus prefilter, complement form — "the rest of the tier". */
  excludeCorpora?: string[]
  /**
   * Collections this stream also retrieves that DO NOT sit under its `tier` in the built index.
   * Retrieved by a SECOND, corpus-only prefiltered call, merged with the main leg (query-router.ts).
   *
   * ⚠ WHY THIS AXIS HAS TO EXIST, and why it is not just a bad tier map. The tier is BAKED INTO
   * THE INDEX at build time and the server-side prefilter matches against the index, not against
   * `tierFor()` as it reads today. So a collection seeded after the tier map last covered it
   * carries `other` in the index forever, and no stream can select it however the map is edited —
   * only a full reindex moves it. `CORPUS_DISPLAY_OVERRIDE` in corpus-type-map.ts already corrects
   * the same staleness on the *display type* axis; this is the same correction on the *prefilter*
   * axis, and without it a display override produces a correctly-typed row that no stream can
   * retrieve — which is exactly the state erskine-may was in.
   *
   * ⚠ KEEP IT SMALL, AND KEEP IT NAMED. Each entry costs one extra retrieval call on every query
   * routed to that stream. It is a bridge to the next reindex, not a second way to define a
   * stream: the durable fix is `tierFor()` plus a rebuild, after which the entry is deleted.
   */
  extraCorpora?: string[]
}

export const STREAM_SCOPES: StreamScope[] = [
  // `bills-api` joins LEGISLATION, not debates, and the reasoning is about what the user is asking
  // rather than about where the rows sit (2026-08-10, S2C3 §1). Someone who asks "what does the
  // law say about X" is asking a question a Bill can answer — "someone has already introduced
  // one, and it is at committee stage" changes what they do next more than almost anything else
  // the corpus holds. That is the same question the legislation stream serves, so it belongs on
  // that leg.
  //
  // ⚠ IT IS NOT A CONTRADICTION THAT `bills-api` STAYS IN `NON_DEBATE_PARLIAMENTARY` BELOW. That
  // list excludes it from the DEBATES stream, which remains right: a bill publication PDF is not
  // a debate. Two separate decisions about two separate streams, and the debates exclusion would
  // have been ineffective anyway — the debates stream also filters `types: ['DEBATE']` and a Bill
  // types as BILL.
  //
  // ⚠ AND IT IS AN EXTRA LEG RATHER THAN A TIER MEMBER because `bills-api` carries tier
  // `parliamentary` in the built index; the prefilter matches the index, not `tierFor()`. Same
  // mechanism as erskine-may and scottish-parliament-or, for the same reason.
  { name: 'legislation', tier: 'legislation', extraCorpora: ['bills-api'] },
  // `scottish-parliament-or` — 1,044,188 sections, 86% of the whole reachability gap S2C measured.
  // Same shape as erskine-may: already display-typed DEBATE, indexed under tier `other`, so no
  // stream could select it. Added 2026-08-10 on Charlie's decision (S2C2 §3) and shipped WITH a
  // before-and-after, not as a config line — it changes what the debates stream returns for every
  // query. Contamination and latency numbers are in CHANGE_LOG 2026-08-10.
  // `types: ['DEBATE', 'DIVISION']` — S2C6 §1, 2026-08-12. The debates stream is the only
  // parliamentary stream the router addresses, so a roll-call typed DIVISION and left out of this
  // list would be correctly labelled and retrievable by nothing: the exact UNREACHABLE state S2C
  // spent three sprints clearing, arrived at by being careful about the label. Adding the type to
  // an existing stream costs nothing; a sixth stream would cost a sixth ANN search per query
  // against a concurrency cap of 4 (S2C6 §4).
  //
  // ⚠ AND IT IS NOT A CONTRADICTION WITH THE TYPE DECISION. Refusing to LABEL a roll-call
  // "Debates" and refusing to RETRIEVE it for someone asking what Parliament has done about X are
  // different questions with different answers. Someone asking the second wants both; the type is
  // what stops them confusing the two once they arrive.
  //
  // ⚠⚠ THE ROLL-CALLS ARE SELECTABLE HERE AND STILL DO NOT ARRIVE, AND `extraCorpora` DOES NOT
  // FIX IT — measured 2026-08-12, not reasoned. Typing them DIVISION and admitting the type to
  // this stream makes them *reachable*; the debates stream nonetheless returned 60 hits and ZERO
  // divisions for "how did MPs vote on the assisted dying bill", and zero again for a query
  // containing the literal words "division ayes noes". Corpus-scoped, the same index returns
  // "Division — Assisted Dying Bill [HL] (Lords, 2015-01-16)" at rank 1.
  //
  // The cause is scale: 5,645 roll-calls share the parliamentary tier with ~12M Hansard sections
  // that use the identical vocabulary — "division", "ayes", "noes" and every bill name appear
  // constantly in debate text. This is the scottish-parliament-or problem inverted: there a
  // million rows joined a stream, here five thousand are drowned by it.
  //
  // ⚠ AND ADDING THEM TO `extraCorpora` WAS TRIED AND REVERTED, because it does not do what it
  // looks like it does. The extra leg guarantees a separate RETRIEVAL CALL, not slots:
  // `mergeLegs` sorts the two legs together by score, and BM25 scores ARE comparable across them
  // (a prefilter selects rows, it does not rescore them), so the roll-calls lose the merge for
  // exactly the reason they lost the main leg. Measured with the entry in place: still 0 of 60.
  // It was removed rather than left in, because each entry costs one extra retrieval call on
  // every query routed to this stream and this one bought nothing.
  //
  // The mechanism that WOULD work is the round-robin interleave, which allocates slots per
  // stream by construction — i.e. a dedicated `divisions` stream. That costs a sixth stream
  // against `vector-serve`'s concurrency cap of 4 (S2C6 §4), so it is Charlie's decision with a
  // measurement attached, not a line added here. Written up in docs/SEARCH_S2C6_REPORT.md §1.
  { name: 'debates', tier: 'parliamentary', types: ['DEBATE', 'DIVISION'], excludeCorpora: NON_DEBATE_PARLIAMENTARY, extraCorpora: ['scottish-parliament-or'] },
  { name: 'committees', tier: 'parliamentary', types: ['COMMITTEE'], corpora: COMMITTEE_CORPORA },
  { name: 'caselaw', tier: 'caselaw' },
  // `erskine-may` (1,873 indexed rows) is parliamentary PROCEDURE — what the House can and cannot
  // do with a proposal — and answers a narrow but real class of question for someone trying to
  // move one. It is indexed under tier `other`, so it joins here rather than through the tier.
  // ⚠ `scottish-parliament-or` is the same shape at 550× the size (1,044,188 sections, 83% of the
  // whole reachability gap) and is NOT listed: it is display-typed DEBATE, so it would join the
  // debates stream, and changing what a million sections do to that stream's results is a
  // measurement and a decision, not a line in a list. S2C reports it; Charlie decides it.
  //
  // ⚠⚠ `cps-guidance` IS NOT IN THIS LIST AND NO LONGER NEEDS TO BE. It was here behind
  // `LEX_GUIDANCE_CPS` until S11 moved it into the `guidance` TIER, where it competes in the main
  // leg with no extra call — the outcome `extraCorpora`'s own contract asks for ("a bridge to the
  // next reindex … after which the entry is deleted"). Six further collections moved with it:
  // `cma-cases`, `ofgem`, `ofcom`, `independent-reviews`, `inquiry-evidence`, `lgsco`. See the
  // block below and `corpus-map.ts`.
  //
  // ⚠ `erskine-may` STAYS an extra leg, deliberately. It is parliamentary PROCEDURE, not regulator
  // guidance; moving it into the `guidance` tier would file the rules of the House under the same
  // heading as an Ofgem licence condition. The extra leg is the right shape for the one collection
  // whose retrieval home and whose subject genuinely disagree.
  { name: 'guidance', tier: 'guidance', extraCorpora: ['erskine-may'] },
]

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * S8 §4 — THE THREE CANDIDATE STREAMS. Flag-gated (`LEX_ROUTER_STREAMS_V2`), default OFF.
 * ═══════════════════════════════════════════════════════════════════════════════════════════
 * "Impact assessments, consultations and explanatory material are typed, indexed and retrievable,
 * but the router's stream-selection prompt predates them — they surface only through neighbouring
 * streams. A user asking 'what did the government predict this policy would cost' has a stream
 * that answers exactly that, which the router cannot deliberately choose."
 *
 * ⚠⚠ THIS ADDS NO REACHABILITY, AND SAYING OTHERWISE WOULD OVERSELL IT. All three collections sit
 * inside tiers an existing stream already selects with no corpus filter:
 *
 *   impact-assessments   tier `legislation`  → already returned by the `legislation` stream
 *   explanatory-notes    tier `legislation`  → already returned by the `legislation` stream
 *   explanatory-memoranda tier `legislation` → already returned by the `legislation` stream
 *   consultations        tier `guidance`     → already returned by the `guidance` stream
 *
 * What V2 changes is SLOTS, not access. `runRoutedSearch` interleaves round-robin, so each stream
 * gets its own share of the final list; today an impact assessment competes for legislation's
 * slots against 1.6M sections of statute and loses on BM25 for the same reason the division
 * roll-calls lose to 12M Hansard sections (see the `debates` note above — this is that problem
 * again, and the interleave is the mechanism that was identified as the fix).
 *
 * ⚠ THE COST IS A RETRIEVAL CALL PER STREAM PER QUERY. Five streams become eight against a
 * `vector-serve` concurrency cap of 4 (S2C6 §4) and `LEX_STREAM_CONCURRENCY` of 3. That is why
 * the flag is OFF and why §4 asks for a latency delta rather than a recall number alone.
 *
 * ⚠ DIVISIONS STAY OUT — a graph input, never text-searched (SEARCH_STRATEGY §3.3).
 */
export const STREAM_SCOPES_V2: StreamScope[] = [
  // What the government PREDICTED an instrument would do. Corpus-scoped inside the legislation
  // tier, with the display type as the backstop — the same belt-and-braces the committees stream
  // uses, and for the same reason: a service that ignored `corpora` would otherwise return the
  // whole tier as though it were impact assessments.
  { name: 'impact-assessments', tier: 'legislation', types: ['IMPACT_ASSESSMENT'], corpora: ['impact-assessments'] },
  // What the government ASKED, and what respondents said.
  { name: 'consultations', tier: 'guidance', types: ['CONSULTATION'], corpora: ['consultations'] },
  // What a provision was FOR — the department's own statement of purpose. Both collections, one
  // stream: a user does not distinguish an explanatory note from an explanatory memorandum, and
  // splitting them would spend two of the eight slots on one question.
  { name: 'explanatory', tier: 'legislation', types: ['EXPLANATORY_NOTE'], corpora: ['explanatory-notes', 'explanatory-memoranda'] },
]

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * S10 §1 / S11 §1 — `cps-guidance`: FOUND UNREACHABLE, BRIDGED BY A FLAG, THEN FIXED PROPERLY.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * WHAT WAS FOUND (S10, 20 Aug 2026). Charlie's validated set scored guidance at 1/10 while
 * consultations scored 8/9 — from the SAME stream, both collections sitting in the `guidance`
 * tier. That is not a search-quality story, so the index was asked directly rather than reasoned
 * about: all five CPS keys came back at rank 0–2 scoped to their own corpus, and `streamCanSelect`
 * returned FALSE for every one. `cps-guidance` was display-typed GUIDANCE by `corpusToType` and
 * indexed under tier `other`, so **no router stream could select it and no query could ever return
 * a CPS guidance document.** Perfectly retrievable, structurally unreachable.
 *
 * WHAT WAS DONE ABOUT IT, IN TWO STEPS, AND WHY THE FIRST ONE IS GONE.
 *
 * S10 shipped a bridge: an `extraCorpora` entry behind `LEX_GUIDANCE_CPS`, default OFF, because
 * that arm was **zero-sum** — `mergeLegs` sorts both legs on one BM25 scale and slices to a fixed
 * budget, so a strong extra leg takes the main leg's room rather than getting its own. Measured:
 * guidance 2/10 → 8/10, consultations **6/9 → 4/9**.
 *
 * ⚠⚠ S11 DID THE DURABLE FIX, AND THE TRADE TURNED OUT TO BELONG TO THE MECHANISM, NOT TO THE
 * COLLECTION. `tierFor()` now returns `guidance` for it and the rows were rewritten to carry that
 * tier (`scripts/ingest/search/fts-refresh.ts --retier-all`), so it competes in the MAIN leg with
 * no extra retrieval call. Re-measured on the same validated set, arms differing only in which
 * rows are eligible (`scrutinise-web/scripts/measure-s11-tier.ts`):
 *
 *     guidance        3/10  →  8/10     (+5)
 *     consultations   4/9   →  4/9      (⚠ NOT ONE QUESTION LOST, AND NOT ONE RANK MOVED)
 *
 * The extra leg cost consultations two answers; the tier move costs them nothing. A quota has to
 * take a gain from somewhere; a shared ranking makes it earn its place. **That is the difference,
 * and it is why "widening a stream is zero-sum" is true of one mechanism and not of the other.**
 *
 * ⚠ `LEX_GUIDANCE_CPS` AND `GUIDANCE_CPS_EXTRA` ARE THEREFORE DELETED, not defaulted off. Left in
 * place they would double-retrieve a collection that is already in the tier, and a redundant flag
 * that still gates a live code path is a trap for the next reader.
 *
 * ⚠⚠ SEQUENCING, BECAUSE THIS CODE AND THE INDEX SHIP SEPARATELY. The flag was Charlie's stopgap
 * and was ON. Removing it is safe only once the re-tiered rows are BEING SERVED — the index has
 * them, but `fts-serve` holds its table from boot. Until it is redeployed, this code path is gone
 * and the served index still has the collection under `other`, i.e. `cps-guidance` is briefly back
 * to unreachable. Named as an expected observable in `docs/SEARCH_S11_REPORT.md` rather than left
 * to be discovered.
 */

/**
 * The scopes in force. Pure — the CALLER reads the flags, so this module keeps its
 * runtime-dependency-free property and `corpus-reachability.ts` can still import it from outside
 * the Next.js path alias.
 *
 * ⚠ The `cpsGuidance` parameter was removed in S11: the collection is in the `guidance` tier now,
 * so there is no arm to select between. See the block above.
 */
export function activeStreamScopes(v2: boolean): StreamScope[] {
  return v2 ? [...STREAM_SCOPES, ...STREAM_SCOPES_V2] : STREAM_SCOPES
}

/**
 * Could `stream` return a row of this corpus, sitting under this INDEXED tier, displayed as this
 * type? Pure set arithmetic over the scope — the same filters the retrieval path applies, in the
 * same order:
 *   1. `extraCorpora` — the second, corpus-only leg, which skips the tier prefilter entirely,
 *   2. the server-side tier prefilter,
 *   3. the server-side corpus prefilter (include list or exclude list),
 *   4. the client-side display-type filter (`types`), which is the backstop in query-router.ts.
 * A null `type` means the FTS adapter dropped the row before any stream saw it, so it is not
 * reachable by anything — and that is checked first, because it is true of every stream at once.
 */
export function streamCanSelect(
  scope: StreamScope,
  corpus: string,
  indexedTier: string,
  type: SearchResultType | null,
): boolean {
  if (type === null) return false
  // The extra leg is corpus-only: it does not pass `tier`, so the indexed tier is irrelevant to
  // it. `types` still applies — it is a client-side filter over whatever both legs return.
  if (scope.extraCorpora?.includes(corpus)) return !scope.types || scope.types.includes(type)
  if (indexedTier !== scope.tier) return false
  if (scope.corpora && !scope.corpora.includes(corpus)) return false
  if (scope.excludeCorpora && scope.excludeCorpora.includes(corpus)) return false
  if (scope.types && !scope.types.includes(type)) return false
  return true
}
