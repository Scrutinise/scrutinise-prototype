# Search Infrastructure — Handover Brief

**From:** the CCh-Search conversation running late June – 9 August 2026
**To:** the next conversation
**Date:** 9 August 2026
**Purpose:** everything needed to finish the core retrieval stack and move on to the
principle streams and graph layers, without re-deriving context.

---

## 1. Where things stand — the honest summary

**Live in production as of 8 August 2026:**

- **Keyword search (BM25)** with citation resolver and legislation boost
- **Query expansion** — bridges lay vocabulary to statutory terms ("data protection" →
  Data Protection Act 2018, UK GDPR, PECR)
- **Query router** — one LLM call decides which of five streams a query belongs to
  (legislation, debates, committees, case law, guidance) and writes a tailored search
  string per stream
- **Vector (dense) retrieval, fused with keyword at weight 0.5 — legislation stream only**
- **Citation/amendment graph** (Tier 1, built 5 July) powering rescission-impact traversal
- **General corpus chat** at `/admin/lex-general` — untiered, admin-gated, shows retrieved
  sources and diagnostics; the cleanest test surface for the whole stack
- **Monitoring** — `serve-observer` on hourly tick, both serve services, daily digest plus
  immediate alerts

**The flip happened on 8 August after a fortnight of false starts.** Root cause: the flags
were case-sensitively compared (`=== 'true'`) and had been set to `TRUE`, and
`LEX_QUERY_ROUTER` existed as two separate Vercel variables (Production and Preview) both
marked "sensitive" so unreadable. The router and expansion had **never run in production**
before 8 August, meaning their measured gold-set gains (+15.3pp concept, +10.0pp citation)
had never reached a user. This is now hardened: `lib/env-flags.ts` normalises all eight
boolean flags, a build-time check scans 340 files and fails on any bare
`process.env.FLAG ===` comparison, and `instrumentation.ts` logs a `[capabilities]` line at
boot showing resolved state.

---

## 2. IN FLIGHT — must close before "core stack complete"

### 2a. The truncation bug (CC-Search working now — BLOCKS everything downstream)
`callGeminiJson` never checks `finishReason`, and the routing call is capped at
`maxOutputTokens: 512` — five tailored per-stream queries don't fit, so the response
arrives truncated and surfaces as a *JSON parse failure*. Two of four real questions
silently fell back to unrouted search. **Routing is therefore currently intermittent, not
on.** `expandQuery` shares the same helper and the same exposure.

This is the **third instance of one failure class** (query-expansion 29 Jul, web-orientation
6 Aug, routing 8 Aug). Standing rule now being added to CLAUDE.md: *a truncated LLM response
must name itself as truncated, everywhere; the guard belongs in the shared helper, not in
each caller.* Same family as the silent stub, the placeholder, and the invisible fail-open —
failures that present as something else.

### 2b. Re-establish the benchmark (after 2a)
The observed regression — new answer leads with PECR 2003, reaches UK GDPR at citation [9],
where the old one led with UK GDPR and DPA 2018 — was measured **while routing was
intermittent**. It may be a genuine ordering problem or an artefact of a silently unrouted
query. Re-run once routing is reliable. **This determines whether the reranker is still the
right next build.**

### 2c. The ordering baseline (approved, not yet built)
Proposal at `docs/ORDERING_METRIC_PROPOSAL.md`. Approved as written.

- **Pairwise preferences** (`prefer?: {above, below, why}` on `GoldQuery`), NOT nDCG —
  because our answer key is admittedly incomplete and nDCG grades every unlisted document 0,
  penalising a reranker for promoting something relevant we never enumerated.
- **MRR is the wrong primary and our own failure proves it**: PECR 2003 *is* relevant to
  "what is the law on data protection", so the regression scores MRR = 1.0.
- **recall@20 stays as an invariant guard, not a target** — a reranker only reorders, so
  recall should not move. Accuracy up with recall down means it's discarding.
- Measure on the fused list **before `groupForPanel`** (it caps ~3 per type and would hide
  the exact legislation-vs-legislation error being chased).
- **Seed 15–20 pairs and score today's ranking BEFORE building anything.** One observed
  regression motivates a metric, not a build. If preference accuracy is already high, the
  highest-value next build changes.

### 2d. The reranker — build only if 2c justifies it
Cross-encoder over the fused top ~100. Long-planned as "the highest-ROI quality
multiplier once retrieval is decent", and the ordering regression is the strongest argument
yet — but gated on the baseline, not assumed.

---

## 3. KNOWN GAPS — needed for the stack to be genuinely complete

| # | Gap | Owner | Notes |
|---|-----|-------|-------|
| 1 | **Vector index is a July snapshot** | ingest | Predates the committee rechunk, the FTS backfill, and the treaties ingest. Dense retrieval currently cannot find anything ingested since July. **Delta embed required before vector serves accurately.** |
| 2 | Vector on the other four streams | search | Only legislation is fused today. Debates, committees, case law, guidance still keyword-only. One stream at a time, gold-tested each — all-five-dense doubled p95 to 25s in load testing, which is the evidence for the sequencing. |
| 3 | `eur-lex` sectioning fault | ingest | Legislation truncation is fine overall (79.2% tier-wide, 99.3% core), but eur-lex 57.3% / explanatory-notes 14.3% — worst case is a single row holding 760,509 words. This is a *sectioning* fault, not a chunk-cap one; raising MAX_CHUNKS would not fix it. |
| 4 | MAX_CHUNKS top-up (~$284) | ingest | Deferred deliberately: the committees per-finding rechunk *replaces* those sections, so topping up first pays to embed chunks about to be superseded. Confirmed incremental (chunks 1-8 byte-identical), not the ~$785 full re-embed. |
| 5 | Committees gold questions | search | Current four score a flat 100% while returning zero committee documents — Hansard debates satisfy the key by accident. Cannot be fixed by rewording; needs real report content first (gap 3 of the ingest backlog). |
| 6 | Legacy table DROP | ingest | Still blocked: `backfill-citations.ts` reads `LegislationItem` at build time, six web-app paths read `LegislationSection` (including one on the Lex chat route with no flag gate), plus one row of real user data in `IdeaLegislation`. Reclaims only 1.73GB (91%→81.1%) — headroom, not the fix. |
| 7 | `corpus_sections` storage | ingest | 12.6GB of 15.93GB Neon usage — the real storage story. Drop no-reader indexes first (immediate reclaim); `DROP COLUMN` needs a full-table rewrite that could hit the ceiling at 91%. |
| 8 | Cost visibility | ops | Dense retrieval is the first usage-proportional cost (one Gemini embed per uncached query, p50 228ms, multiplied by router fan-out). Need per-request / per-idea / per-user / site-wide weekly and monthly, high-usage users flagged. Alert at $20 then $50 monthly — early enough that pricing is a choice, not a reaction. |
| 9 | Answer streaming | Lex | 8.4s end-to-end (3.5s search + 4.1s answer). The answer half won't shrink much; streaming makes text appear at ~1s. Highest-value latency work available. |
| 10 | Region co-location | search | Live log shows request received in London (lhr1), function executed in Washington (iad1). With the router fanning to five streams that's potentially five transatlantic round trips. Quantify before changing. |
| 11 | `SEARCH_CALL_MAP.md` | search | Definitive map of every point the platform calls search: trigger, intent, routed vs tier-scoped, streams hit, blocking vs background. Briefed, in progress. Now matters for cost as well as latency. |
| 12 | `LEX_WEB_ORIENTATION` status | search | Web/X orientation shipped 6 Aug behind the same flag pattern that kept the router dark. Currently reads **off**. Confirm that is a deliberate choice, not another silent failure. |

---

## 4. Two structural findings worth carrying forward

**Tier-scoped callers bypass the router entirely.** `gateway-legacy.ts` passes an explicit
tier, which takes the tier-scoped branch and calls `runFtsSearch` directly, never reaching
`fusedStream`. So the Lex chat route, `/api/search`, and the legislation-search panel get
**neither routing nor dense retrieval**. Dense currently reaches only the untiered callers:
Page-1 briefing, cause-seeding, ad-hoc research, and general corpus chat. That was accepted
as a deliberate first blast radius — the untiered callers are where the gold-set evidence
came from — but extending dense to the legacy surfaces is real outstanding work, tied to the
legacy migration.

**Conversation history was steering retrieval on general chat, and it was measurably wrong.**
`probe-context-bleed.ts` called `routeQuery` twice with one variable changed: cold, the
legislation query was *"Enterprise Act 2002 regulatory powers compel information disclosure"*;
with two data-protection turns as history it became *"Data Protection Act 2018 investigatory
powers disclosure of information"* — the anchor Act swapped for the previous topic's statute,
on the stream carrying dense retrieval. Fixed by emptying `ideaContext` on general chat; the
*answer* call still receives history. **Known accepted cost:** purely anaphoric follow-ups
("tell me more about that") now retrieve against the pronoun. The real fix is resolving the
question to a standalone query before retrieval — recorded, not built.

---

## 5. After the core stack — the roadmap beyond (the next conversation's real subject)

In rough priority order, all documented in `SEARCH_STRATEGY.md` (v3, 6 Aug):

1. **Web/X orientation** — built 6 Aug, flag currently off. Two calls by design: a
   ~90-day recency scan feeding "current context / political risks", and *unbounded*
   argument mining feeding "arguments and viewpoints", with a noise filter (discard ad
   hominem, sarcasm, straw men, pile-ons; keep claims with reasons) and three reliability
   tiers — corpus testifies, web gives context, X merely circulates. Charlie's judgement:
   this is a **credibility floor, not a nice-to-have** — the worst outcome is a user finding
   something obvious in ChatGPT that Lex missed.
2. **People-graphs** — social/political-actor (an MP's votes, debates, involvement),
   committee/witness, interests-register. Directly powers the "who will kick up a fuss"
   political-risk question the rescission report has always wanted to answer.
3. **Principle streams** — special investigations, outcome/evaluation reports, tax
   simplification. Architecturally different: search by *failure-mode vocabulary*, return
   *clustered transferable lessons*, not ranked documents. Genuinely unbuilt, not wiring.
4. **The mechanism/principle LENS** — reframed in v3 as a cross-cutting filter applied
   *while* searching legislation/case law/evaluations, **not** a stream or a graph of its
   own. Tag provisions by lever type (duty-to-report, licensing regime, sunset clause) and
   connect matches across unrelated subjects.
5. **Statistics catalogue** — headings searchable, values callable. Blocked on an ingest-side
   deterministic `seriesKey` (the current identifier is unstable across re-ingest and has
   already caused one duplication bug).
6. **Content graphs** — intent/problem→lever, institutional-outcome/failure-pattern,
   argument/contested-cause, case-law doctrine, lineage-of-attempts.

---

## 6. Working practices that earned their place

- **Flag off → measure on the gold set → flip → verify engagement.** The last step is not
  optional: we flipped flags twice and only discovered weeks later that nothing had engaged.
  Every flip needs a positive signal that proves engagement (a counter moving, a log line),
  not merely an absence of errors.
- **One shared resource, one owner at a time**, recorded in `handoff_summary.md` when it
  changes hands. Search, ingest, and Lex threads run in parallel; this prevented at least
  one index-corrupting collision.
- **Every brief gets written to disk** (`SPRINT.md` or a named `BRIEF_*.md`) before the
  conversation moves on. A brief that exists only in chat does not survive a `/clear` —
  this bit us for real in August.
- **Measured, not modelled.** The best work in this thread ran controls: reversing test order
  to catch a cache-warming artefact masquerading as a handle-pool gain; changing one variable
  to isolate context bleed; verifying a check can actually fail before trusting it passes.
- **Re-baseline after any index change.** Two separate index changes (coverage fix, then
  dedup/orphan removal) each invalidated prior measurements.
- **Bytes before hypotheses.** Queue depths, deployment SHAs, row counts and flag states get
  re-fetched each session, never assumed.

---

## 7. The immediate next action

Close 2a (truncation fix), then 2b (re-establish the benchmark), then 2c (ordering baseline)
— and only then decide on 2d (the reranker). In parallel and independently: gap 1 (the stale
vector index delta embed) is the highest-value ingest-side item, because dense retrieval is
currently answering from a July corpus.
