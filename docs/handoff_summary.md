# SCRUTINISE — HANDOFF SUMMARY

*Read this first every session. Top section is authoritative.*

*Last updated: 2026-07-31 00:03 UTC — ▼ STATS: Phase A (UK spine) sprint built end-to-end
(schema, ONS/OBR/PESA/HMRC sources, scheduler, Lex query layer) — all sources live-probed and
licence-verified (OGL v3.0), pilot measured with zero DB writes (4,081 series / 28,866 obs on
the ingested slice). **No database provisioned — Charlie's DB-choice call still open**, see its
own CURRENT STATE section. ▼ 2026-07-30 04:32 UTC — ▼ SEARCH: query router — guidance added as 5th stream (B
+15.3pp, A holds +10.0pp, C partially recovers -20.0→-13.3pp), the flagged fts-query-service.ts
concurrency risk CONFIRMED real (crashed the live service at 15 concurrent requests — the exact
load the router's 5-stream fan-out produces) and FIXED (global semaphore, re-tested clean).
**Recommend flipping `LEX_QUERY_ROUTER=true` — not flipped this session, Charlie's call.** See its
own CURRENT STATE section. ▼ 2026-07-29 20:14 UTC — ▼ SEARCH: FTS rebuild + cursor fix COMPLETE — `corpus_fts` fully
reconciled (0 gap across all 70 corpora, 1,172,169+ rows backfilled incl. all of scottish-parliament-or,
uk-treaties-fcdo, parliament-treaties, cma-cases, the Hansard partial gaps); new append-safe
`fts-catchup.ts` ships for future drift. Hit + resolved a real operational incident along the way
(harness "kill" doesn't actually kill the OS process here — caused a duplicate-write mess, cleanly
fixed) — see its own CURRENT STATE section for the full story. ▼ 2026-07-29 19:25 UTC — ▼ SEARCH:
query router built + measured (`LEX_QUERY_ROUTER`,
default OFF) — one LLM call routes per-stream (legislation/debates/committees/caselaw), generalising
Stage-3 expansion; gold-set B +12.5pp, A +10.0pp (not diluted — citation-exact special case confirmed
working), C -20.0pp (guidance stream not yet routed, an honest expected cost, not a bug) — see its own
CURRENT STATE section. ▼ 2026-07-29 16:12 UTC — ▼ FTS rebuild + cursor fix PULLED OUT of the queued Act-metadata
sprint and run separately (ready-now, independent) — see its own CURRENT STATE section. ▼ 2026-07-29
13:04 UTC — ▼ shipped the Stage-3 query-expansion fix (`thinkingConfig:{thinkingBudget:0}`, commit
`eb8641f`) — see below. ▼ 2026-07-29 12:10 UTC — ▼ ADDENDUM to the queued sprint's item-4 number: **the headline combined legacy total is
1,049,805 rows, not 914,274** — 914,274 is `LegislationSection` alone; `LegislationItem`'s 135,531 rows
are separate/additional and gated on item 2 (Act-metadata table), not item 1 (route swap). Use
1,049,805 for Neon space-planning when this sprint is scheduled — no other change to the still-queued
Act-metadata sprint. ▼ QUEUED (not started): Act-metadata sprint scoped (now 3 items — FTS-freshness
pulled out, see above) — the one pre-scheduling number Charlie asked for is answered: see the addendum
above for the corrected total. ▼ 2026-07-29 08:10 UTC — ▼ SEARCH: stale-vector mechanism IDENTIFIED (not deletion — `corpus_fts` is stale) + scoped legislation-tier recall test on B1–B3 (see CURRENT STATE below). ▼ 2026-07-22 — ▼ SEARCH VECTOR REBUILD on a 128GB Vultr box **did NOT recover recall** (vector-alone 70.5% post-rebuild vs 71.2% pre-, reproduced twice) — the compaction-skip diagnosis from earlier the same day is REVERSED; the true cause is an open search-quality question (see CURRENT STATE). Positions-rider bonus ABANDONED (hard R2 10,000-part multipart-upload limit, non-retryable). `LEX_SEARCH_VECTOR` stays OFF. ▼ 2026-07-21 — ▼ SEARCH VECTOR EMBED **COMPLETE**: full-corpus batch drain finished (1,821/1,821 shards), ANN index build OOM'd at fragment compaction on the 32GB box (CCX43 fallback blocked by Hetzner account quota) — fixed via `VECTOR_SKIP_COMPACT=true` (skips compaction, indexes the fragments directly), index built in 711.7s. **21,846,364 vectors, 0 misses, `phase: "done"`.** Caveat: un-compacted build logged Lance kmeans "empty cluster" warnings — quality not yet independently confirmed, rides on the already-planned gold-set/fusion re-confirm before the flag flip. See CURRENT STATE below. ▼ 2026-07-11 (laptop diagnosis) — ▼ INGEST TREATY COVERAGE EXTENSION (executes `TREATY_INGEST_BRIEF.md`, 8 Jul): `uk-treaties-fcdo` NEW corpus — FCDO UK Treaties Online reverse-engineered anonymous JSON API (treaties.fcdo.gov.uk, legacy JBoss/Knowvation, no bulk export, JS-only SPA); **honest-denominator correction: measured universe = 21,970 records, not the ~15,000 brief/gov.uk estimate**; 33% carry a PDF (full text), 67% metadata-only (surfaced honestly, not dropped); 127 dedup skips vs existing `uk-treaties`/`tax-treaties-dta`; pilot passed clean; **21,840-row backlog SEEDED, DRAINING in the background (not complete this sprint)** — live `ops`/`Ingest` Railway service picks it up automatically, no action needed. `parliament-treaties` NEW corpus — CRaG-2010 scrutiny register via the documented `treaties-api.parliament.uk` API (laid dates, scrutiny status, committee/debate timeline); kept separate from `uk-treaties-fcdo` (different id space + content kind, CC's call per the brief); **328/328 SEEDED + DRAINED this sprint, 0 failures.** Both licence-verified OGL3/OPL3, rate-limited, corpus-mapped. CHANGE_LOG "INGEST — Treaty coverage extension" (2026-07-08 16:33 UTC). ▼ SEARCH VECTOR EMBED — **TIER 2 FLIPPED; batch embed LIVE & progressing, 851/1,821 shards (~46.7%), 10.21M vectors, 0 misses at 21:32 UTC — NOT stalled** (the prior "paused/blocked" read was a ~24.5h-behind laptop clock + a sync-only £46.55 console snapshot; see CURRENT STATE). **Shipped the missing email observer** (`search/embed-observer.ts` → `ops`: stall/crash/ANN-stuck/daily-heartbeat alerts; deploys on next push). Historical tier-wall note follows. ▼ SEARCH VECTOR EMBED — TIER WALL + SYNC MODE (7 Jul, now superseded): full-run STEP 1 **DONE** (17,640,560 sections → **21,846,364 chunks** in `corpus_chunks`, 230 misses, ~32h cpx62); STEP 2 blocked — **account is Batch Tier 1 (500k enqueued-token queue; probed + docs-verified T1 500k/T2 5M/T3 10M)**, 40k shards ≈ 12.4M tok fit NO tier; also fixed en route: node default-heap OOM on the 21.8M id load (`NODE_OPTIONS=--max-old-space-size=28672`) and GEMINI_API_KEY missing from cloud-init (carve-out commit `c715e00`). Zero Gemini spend lost. **BUILT INERT this sprint:** `VECTOR_EMBED_MODE=sync|batch` (NEW `gemini-sync.ts` — standard-rate embedContent, global 950k-TPM pacer, same shard plan/checkpoint), checkpoint-pinned shardSize, batch sub-job token splitting (`VECTOR_BATCH_JOB_TOKENS` 4.5M — dense caselaw regions ~800 tok/chunk), `gemini-tier-probe.ts` tier detector. **Gated plan:** sync slice ~667M tok ≈ $100 (~11.7h) → auto Tier-2 flip → batch remainder ~$370–460 with SHARD_SIZE=12000/INFLIGHT=1 → revised total **~$470–560** (under the ~$600 gate; Tier-1 monthly cap £189≈$250 accommodates the slice). Report `docs/VECTOR_EMBED_REPORT.md` §5. ▼ GRAPH TIER 1 (COMPLETE): explicit-edge legislation graph — Neon `legislation_edges` **2,348,993 edges / ~0.94 GB** (amends 1.02M · commences 478k · repeals 322k · made-under 231k · modifies 181k · cites 121k), all from bulk TNA sources (bulk-before-API held; no LLM extraction); rescission traversal `impactSet()` + `/impact` service (fts-serve pattern, smoke-tested 224ms); **gold archetype D un-floored 0% → 80%** (D1–D4 = 8/8; D5 needs case-law edges, out of sprint scope). Audit refuted the fragments-have-Citation-markup premise — whole-doc bulk CLML + bulk amendments XML are the real sources. Report `docs/GRAPH_TIER1_REPORT.md`. **⚠ Neon now ~16 GB of the 17.5 GB line.** ▼ Earlier: SEARCH VECTOR EMBED (BUILT INERT): full-corpus gemini-embedding-001 @768-d batch-embed pipeline + IVF_PQ ANN + OFF-by-default gateway wiring (tuned 70/30 fusion). Actual corpus **17.64M sections / 6.12B words → ~22.25M chunks / ~5.7–6.9B tokens → ~$430–520** at the batch rate ($0.075/1M) — **within the ~$600 gate, no flag raised**. **CANARY RUN + PASSED (4 Jul, ~$0.01):** live Batch API contract confirmed — 200/200 vectors @768-d, order/keys clean. Remaining spend = the full Hetzner+Batch run (~$430–520), Charlie-triggered. `@google/genai` added. Report `docs/VECTOR_EMBED_REPORT.md`. ▼ SEARCH FUSION TUNING (pilot subset, no new embed cost): **weighted RRF fixed 70/30 vector/BM25 ships** — gemini 87.8% recall@20 vs naive RRF 84.3% / vector-alone 85.9% / BM25 68.3%; the pilot's naive-RRF regression is RESOLVED (fusion now beats vector-alone). **Kind-based routing NOT needed** — the full (wCit,wCon) grid over the `parseCitation` router only TIES fixed 70/30 (87.8%); at 70/30 the citation-resolver pin survives fusion (A=100%), ≥80/20 breaks A1. voyage confirms vector-heavy (80/20=86.9%, B6 naive-collapse FIXED 0→33.3%); e5 optimum stays 50/50 → the right weight tracks vector-arm strength. Ship spec: w=0.7 RRF_K=60 as env config, no router. `docs/FUSION_REPORT.md`. ▼ SEARCH type-taxonomy fix (§10.2): 13 hidden corpora → 4 (all intentional); scottish-parliament-or (1.04M)→DEBATE, regulators/reviews→GUIDANCE (`corpus-type-map.ts` display override). retained-EU/SI already mapped correctly; MiFID miss is RANKING (B6), not display → vector layer. ▼ SEARCH VECTOR PILOT: embedding-model bake-off on the gold set. **Winner gemini-embedding-001** (vector 85.9% / hybrid 84.3%, +16pp over BM25); voyage-4 TIES on vector (85.9%) but no legal-specialist premium; e5 open-weight 70.5%. Vector layer's big win = archetype B +45.8pp (lay-concept); B6 burial 0→50%. Equal-weight RRF hurts strong models → route/vector-weight the fusion. Full embed with gemini gated on Charlie (test @768-d). ▼ 1 Jul 2026 — SEARCH: Stage 3 PAYOFF MEASURED (recall@20 A/B, OFF vs ON). **B +15.3pp (33.3→48.6)** — expansion bridges lay vocab to anchor Acts. **A NOT flat (+10pp, bidirectional)** — helps concept queries (A5 +100) but HURTS precise citations (A1 −50, dilution); keep expansion scoped to concept queries. B6 answer-key filled+verified (all 6 sources in corpus, incl. fca-handbook — no coverage gaps) & now scoreable; B6 itself only +16.7pp = a RANKING problem (legislation buried under parliamentary/HMRC noise even when named) → the vector-layer flag. ▼ LEX REBUILD Sprint 2 (Diagnosis / Page 2 + search gateway + Page 1→2 transition), preview only, NOT promoted; `tsc` clean (pre-existing react-markdown only); Page 1→Diagnosis chain smoke-tested end-to-end on Neon (fallback path). ▼ SEARCH: Stage 3 SMOKE-TESTED (verified — MiFID/data-protection/seatbelt all name real anchors + surface new legislation; Gemini 503s degrade gracefully as designed) + v2 GOLD structure encoded in the scoring harness (`gold-queries.ts`/`score-fts.ts`; headline byte-identical to v1 at 69.4%/68.0%; new B6·G–I·J1·K1–K2 present, principle+pending cleanly excluded). ▼ 30 Jun — SEARCH Stage 3: LLM query expansion built + flag-gated (`LEX_QUERY_EXPANSION=true`, default off). `lib/lex/query-expansion.ts` (new) + `field-machine.ts` modified. `tsc --noEmit` clean (pre-existing react-markdown only). ▼ Earlier 25 Jun LEX REBUILD Sprint 1.3 (preview, NOT promoted): save-before-advance enforced, "How this works" tour + FAQ modal restored, `preferredName ?? firstName` (+ Neon data fix Charles→Charlie). ▼ V30 POST-PUSH EXECUTED: cma-cases SEEDED+DRAINED (22,890 sections); scottish-parliament-or SEEDED 7,452 rows (2016+ ∪ pre-2016) + DRAINING, canary PASS; inquiry-evidence POH bounded tranche (90 rows) SEEDED+DRAINED, §0 canary PASS → full POH seed awaiting go. ▼ V26 soak continues (DROP gated; legacy `Legislation*` STILL PRESENT).*

---

## CURRENT STATE — STATS: Phase A (UK spine) built, DB choice pending Charlie (2026-07-31 00:03 UTC)

**Executes `docs/STATS_PHASE_A_BRIEF.md`.** New parallel workstream, separate from the corpus/
search/Central work above — a standalone statistics store. Full detail: `docs/STATS_SCHEMA.md`,
`docs/STATS_REFRESH.md`, and the CHANGE_LOG entry "STATS — Statistics layer, Phase A (UK
spine)" (2026-07-31 00:03 UTC) — not repeated here.

- **Built:** `scripts/stats/` (own npm project) — SDMX Prisma schema (dataset/dimension/series/
  observation + COFOG reference table), source modules for ONS (Beta API + CDID), OBR, PESA,
  HMRC (all verified against real live endpoints, all OGL v3.0), a cadence-aware refresh
  scheduler, and a Lex/analysis query layer. `tsc --noEmit` clean.
- **NOT built / NOT run:** no database exists yet. Schema was validated + client generated +
  initial migration produced entirely offline (no DB connection needed for any of that).
  `seed-catalogue.ts`/`ingest-handlers.ts`/`refresh-scheduler.ts` are real code, never executed
  against a live target — same posture as the vector-embed pipeline's "built inert" ships.
- **Sizing measured, not guessed:** `measure-pilot.ts` fetches+parses real data from every
  source (no DB writes) and counts — 4,081 series / 28,866 observations on the ingested slice
  (1 of 337 ONS Beta datasets, 1 of 10 PESA chapters, 1 of 15 HMRC tax-gap tables — deliberately
  partial, see CHANGE_LOG for the extrapolation). Honest read: full Phase A UK spine likely
  lands in the tens-to-low-hundreds of MB, not the brief's "single-digit to low-tens of GB"
  expectation — that ceiling looks more like Phase B/C (OECD/IMF/World Bank) scale.
- **DB choice DECIDED (Neon, new separate project) — provisioning still blocked.** Charlie
  confirmed CC's recommendation. CC cannot create the project itself in this environment (no
  stored Neon API key, and `neonctl` login needs a browser that isn't available here) — it
  needs Charlie to either create the project in the Neon console and paste back the pooled +
  direct connection strings, or hand over a Neon API key. **Charlie chose to hold off this
  session** — nothing costing money has been touched, `STATS_DATABASE_URL` is unset everywhere.
- **NEXT (whenever Charlie is ready to unblock provisioning):** get the Neon project created
  (either path above), wire `STATS_DATABASE_URL`/`STATS_DIRECT_URL`, run the offline-generated
  migration, `seed-catalogue.ts`, then `refresh-scheduler.ts` for real, wire the Railway cron,
  then full Lex tool-calling integration (brief scopes this as a follow-on, not Phase A
  blocking).

---

## CURRENT STATE — SEARCH: query router — guidance stream, concurrency fix, flip recommendation (2026-07-30 04:32 UTC)

**Executes the CC brief "add guidance as a fifth routed stream, then re-measure."** Direct
continuation of the entry below (2026-07-29 19:25 UTC) — read together.

- **Guidance stream added, purely additive as the design predicted** — one config-list entry in
  `query-router.ts` (`{name:'guidance', tier:'guidance', search: ftsStream('guidance')}`), one
  schema/prompt addition in `query-expansion.ts`. `tsc --noEmit` clean both packages, zero changes
  to routing logic.
- **The flagged concurrency risk was CONFIRMED real, not a false alarm.** The prior entry hedged
  that production's HTTP-based stream dispatch might not share the harness's in-process
  `Promise.all` crash risk. Directly tested (new `scripts/ingest/search/concurrency-stress-test.ts`
  — boots the real `fts-query-service.ts` and fires concurrent requests shaped exactly like
  `runRoutedSearch()`'s 5-stream fan-out): **the unpatched service crashed outright at 15
  concurrent requests** — 3 users searching within the same few hundred ms, once the router is
  ON, produces exactly this load. The "different execution model" reasoning was wrong: the danger
  is concurrent native Lance calls against ONE shared table handle in one process, regardless of
  what triggers them.
- **Fixed:** `fts-query-service.ts` gates every request through a global semaphore
  (`FTS_MAX_CONCURRENT=4` default), excess requests queue FIFO. Re-tested: the exact 15-request
  load that crashed it now completes with 0 errors, service stays alive. At much heavier synthetic
  load (20–25 concurrent, beyond realistic traffic) some individual requests failed client-side
  with no server crash — flagged as an unconfirmed residual, not blocking.
- **Gold-set re-measured, full 43 queries:** A holds +10.0pp (unchanged). **B improved further,
  +12.5pp → +15.3pp.** **C partially recovered, -20.0pp → -13.3pp** — investigated why it didn't
  fully close: the two still-regressing C queries (C1, C3) route correctly to `legislation`-only
  because their true expected sources genuinely are legislation, not guidance — so "guidance
  missing" was only part of the original diagnosis. The residual is a smaller, more fundamental
  cost of any tier-scoping (losing the unscoped baseline's incidental cross-tier text matches),
  not something more streams fix. D/F improved (likely LLM stream-choice run-to-run variance, not
  a guidance effect). Full detail: `docs/FTS_ROUTER_AB.md` (overwritten with this run's numbers).
- **RECOMMENDATION: flip `LEX_QUERY_ROUTER=true` in production.** The one genuinely blocking risk
  (the crash) is fixed and validated at the load that broke it; every archetype is net
  flat-or-positive except C's small, understood, bounded residual. Ships independently of the
  vector-layer question. **Not flipped this session** — Charlie's call.
- **NEXT:** flip the flag when ready; watch `/stats`'s new `concurrency.queueHighWaterMark` after
  flip for real-world load; C's residual scoping tradeoff is a known cost, not queued as a fix.

---

## CURRENT STATE — SEARCH: query router built + measured, flag OFF (2026-07-29 19:25 UTC)

**Executes the CC brief "build the query router" (generalises Stage-3 expansion into per-stream
routing).** One new Gemini call (`routeQuery()`, `scrutinise-web/lib/lex/query-expansion.ts`)
decides which of four streams — legislation / debates / committees / caselaw — a query belongs
to and writes a tailored search string for each; everything after is deterministic dispatch
(`query-router.ts`, a config list of `{name, tier, types?, search}`). Flag `LEX_QUERY_ROUTER`
(default OFF), independent of `LEX_QUERY_EXPANSION` — router ON supersedes expansion for that
call. Fail-open: a null/unparseable/empty router decision degrades to searching all streams
unfiltered with the bare query (today's default) — never an empty result.

- **Audit finding — contradicts the brief's premise:** `query-expansion.ts` had no existing
  citation-vs-concept logic; `expandQuery()` called the LLM unconditionally for every query,
  always. Citation-pinning lives entirely server-side (`citation-resolver.ts`/`fts-core.ts`'s
  `resolveInjections`), unrelated to `query-expansion.ts`. The router's own prompt now makes
  this decision for the first time — verified live: A1–A4 (exact citations) all route to
  `legislation` alone, scoring identically to baseline (zero dilution).
- **Tier filter confirmed real, not throwaway:** `fts-query-service.ts`'s `POST /fts-search`
  already accepts `tier`, wired to `rankedSearch`'s existing filter — the platform-side gap was
  `fts-search.ts` never threading a `tier` param through; fixed. debates/committees share
  `tier='parliamentary'`, split via the existing `corpusToType()` display mapping rather than a
  new filter axis.
- **Gold-set result (43-query set, 0/34 fail-opens):**

  | archetype | OFF | ON | delta |
  |---|---|---|---|
  | A (citation) | 60.0% | 70.0% | +10.0pp |
  | B (concept, payoff target) | 33.3% | 45.8% | +12.5pp |
  | C (legislation+guidance) | 60.0% | 40.0% | **-20.0pp** |
  | D (graph, floor) | 76.7% | 76.7% | 0.0pp |
  | E (Hansard intent) | 90.0% | 90.0% | 0.0pp |
  | F (bills/precedent) | 90.0% | 80.0% | -10.0pp |

  Both brief predictions confirmed (B rises, A improves not dilutes). **C regresses -20.0pp — an
  honest expected cost**, not a bug: `guidance` is a deferred stream (brief scope: 4 streams
  only), so any C-archetype guidance-tier expected source (FCA/HMRC/etc.) is now unreachable by
  ANY routed stream, where the unscoped baseline could stumble onto it via the shared candidate
  pool. Full detail: `docs/FTS_ROUTER_AB.md` / `docs/fts_router_ab.json`.
- **Bug found + fixed during measurement:** the harness crashed twice (bare exit 255, no JS
  stack trace) from concurrent `rankedSearch` calls via `Promise.all` against the same in-process
  Lance table handle — fixed by making the harness's per-stream dispatch sequential. **Flagged,
  not fixed:** production's `query-router.ts` also uses `Promise.all`, but through independent
  HTTP calls to `fts-query-service` rather than a shared in-process handle — a different
  execution model, not confirmed to share the risk, but not confirmed safe either.
- **NEXT:** `LEX_QUERY_ROUTER` stays OFF pending Charlie's read of the C regression — accept it
  as the current 4-stream scope's known cost, or add a `guidance` stream (one config-list entry)
  before flipping. Both `tsc --noEmit` clean.

---

## CURRENT STATE — Community feature: Stage 1 build complete, not click-tested (2026-07-29 17:43 UTC)

**Full Stage 1 build shipped this session** (schema → API routes → UI), executing the brief Charlie
dictated and the scope now formalised in `docs/SCRUTINISE_CENTRAL_SPEC.md` (new master spec for the
whole Central module — read this, not just this handoff section, for the full roadmap through Stage 4).
Full account: `docs/CHANGE_LOG.md` "CENTRAL — Stage 1 Community build" (2026-07-29 17:43 UTC) and the
schema-migration entry just above it (17:24 UTC).

- **Two migrations applied to production this session:** `20260729141507_add_community_hierarchy`
  (Community/CommunityMember/CommunityInvite/Idea.communityId) and `20260729173128_add_bulletin_board`
  (BulletinPost/BulletinVote/Community.managerId/CommunityMember.lastReadAt). Both hand-scoped from the
  raw `prisma migrate diff` output rather than applied as-is — the raw diff also wants to drop the
  914,274-row `LegislationSection_DEPRECATED_2026-06-19` table and `specialist_queue`, fallout from
  `schema.prisma` having drifted ahead of production on the unrelated, deliberately-still-unmigrated LEX
  Rebuild Sprint 2 set. **That wider drift is still there and will resurface on every future migration
  attempt** until someone either migrates the Sprint 2 tables for real or reconciles
  `LegislationSection`'s physical rename back into a proper migration — not this session's job, flagging
  for whoever touches `schema.prisma` next.
- **Built:** API routes (create/join Communities, branches, manager assignment, invites, bulletin
  CRUD+vote+search), `/communities` + `/communities/[id]` + `/community-invite/[code]` pages, dashboard
  reorg ("My Communities and teams" section, Feed/Upcoming tabs). Detail in CHANGE_LOG — not repeated
  here.
- **Real bug caught by testing against a live dev server (not just `tsc`):** `middleware.ts` was missing
  `/communities` from its protected-route list, so the page-level redirect for signed-out visitors only
  worked via React's streaming protocol (real browsers were fine; a non-JS client would hang on a 200 +
  loading shell). Fixed — see CHANGE_LOG for exact detail.
- **NOT tested:** the actual signed-in interactive paths (create/join a Community, post/reply/vote,
  assign a manager). No way to authenticate as a real user from this environment — only auth-boundary
  and error-path smoke tests were run. **The Stage 1 test checklist in
  `SCRUTINISE_CENTRAL_SPEC.md` §3 still needs running by a signed-in human in a browser** before this
  is considered done, not just shipped.
- **Deliberately not touched:** `entity_list_v5.md` (CCh-only, never edited by CC without instruction —
  the new entities are documented in `SCRUTINISE_CENTRAL_SPEC.md` §2 instead). DOMPurify gap (referenced
  only in a schema comment codebase-wide, never implemented) — sidestepped for bulletin posts via
  plain-text/default-JSX-escaping rendering rather than closed.
- **NEXT:** click-test the Stage 1 checklist; Stage 2 (points/leaderboards) is "under discussion," not
  yet briefed — see `SCRUTINISE_CENTRAL_SPEC.md` §4 for what's agreed so far.

---

## QUEUED (not started) — Act-metadata sprint (scoped 2026-07-29 11:52 UTC; FTS item pulled out 16:12 UTC)

**Not started. Scoped and recorded for when Charlie schedules it.** Three items (item 3, the
`corpus_fts` cursor/rebuild, was PULLED OUT 2026-07-29 16:12 UTC into its own ready-now, independently
scheduled piece of work — see its own CURRENT STATE section below; no change to items 1/2 here):
1. Low-effort: repoint `searchLegislation()`/idea-chat onto the current (once-rebuilt) FTS path.
2. **Gating item — scope as ONE sub-project, not three small fixes:** a proper Act-level metadata
   table (title/year/jurisdiction/number/section-counts + whatever `LegislationPanel` needs), fed from
   ingest, independent of `corpus_sections`' section granularity and of `LegislationItem`. Unblocks the
   panel route + browse-page route AND makes `LegislationItem` itself droppable.
3. **Answered below** — the one number needed before scheduling.

**ADDENDUM (2026-07-29 16:12 UTC) — correction to the item-3 (orig. item-4) number, per Charlie:**
**the headline combined legacy total to use for Neon space-planning is 1,049,805 rows, not 914,274.**
The table below already had this right, but the top-line framing undersold it — flagging explicitly so
a skim doesn't anchor on 914,274 alone. 914,274 is `LegislationSection` (gated on items 1+2 above);
`LegislationItem`'s 135,531 rows are separate/additional and gated on item 2 only. No other change to
this queued sprint's scope.

**Original answer — the row split, with a correction to the framing:** queried Railway (`DATABASE_URL`,
the main app's Prisma DB) directly. **The "914,274 legacy rows" figure is not a combined total that
needs splitting — it already equals the entire `LegislationSection` row count, exactly.**
`LegislationItem` (135,531 rows) is separate and additional, not part of that number.

| Table | Rows | Droppable when |
|---|---|---|
| `LegislationSection` (physically renamed `LegislationSection_DEPRECATED_2026-06-19`) | **914,274** | #1 + #2 land |
| `LegislationItem` | **135,531** | #2 lands (Act-metadata table) |
| **Combined legacy footprint — USE THIS FOR SPACE-PLANNING** | **1,049,805** | — |

**Two things this surfaced (flagged, not touched):**
- **Schema/DB drift, live now, not a future-state description:** `schema.prisma` still declares
  `model LegislationSection` mapped to the un-suffixed table name, but the physical Railway table was
  already renamed to `LegislationSection_DEPRECATED_2026-06-19` (date suggests this happened the day
  before `corpus_fts`'s last successful build, 2026-06-20 — likely the same cutover). Schema and DB are
  out of sync right now.
- **One live-broken route from that drift:** `app/api/legislation/test-sections/route.ts` (public,
  no-auth "research tool") is the ONLY code path still calling `prisma.legislationSection.findMany(...)`
  — it would 500 if hit today, since that table name no longer exists. Given it's the sole remaining
  reference, `LegislationSection` may already be closer to actually droppable than item #1+#2 assumed —
  worth weighing whether removing/fixing this one route unblocks dropping it sooner, ahead of the full
  Act-metadata sub-project, rather than only as part of it. Not removed this session (out of scope of
  what was asked). Script (throwaway): `scripts/ingest/search/_legacy-row-split-tmp.ts`.

---

## CURRENT STATE — SEARCH: FTS rebuild + cursor fix COMPLETE, `corpus_fts` fully reconciled (2026-07-29 20:14 UTC)

**Executes the "FTS rebuild + cursor fix" brief pulled out of the queued Act-metadata sprint (16:12
UTC) to run separately, ready-now.** All four asks done: (1) append-safe catch-up mechanism built,
(2) the backfill run to completion, (3) completeness confirmed across scottish-parliament-or/treaty
corpora/cma-cases/Hansard, (4) this write-up.

**1. Fix shipped — `scripts/ingest/search/fts-catchup.ts` (new, committed).** Rather than rework
`build-fts-index.ts`'s id-cursor (higher-risk change to a script that already correctly completed a
16.5M-row build once), this does a full per-corpus RECONCILIATION every run: count `corpus_sections`
(status='compiled') vs `corpus_fts` per corpus, diff the exact id sets for any corpus with a gap, and
APPEND the missing rows. Self-healing against any future drift, not just id-sort position — run on a
schedule (e.g. daily via `ops.ts`) to stop the gap regrowing. **Correctness does not require a
`createIndex()` rebuild after appending**: confirmed LanceDB's default query behaviour (no
`.fastSearch()` call anywhere in `rankedSearch()`/`fts-core.ts`) scans un-indexed fragments alongside
the FTS index, so newly-appended rows are searchable immediately — verified directly against the live
production module, not just a throwaway repro (a freshly-backfilled `cps-guidance` row ranked #2 via
`rankedSearch()` with zero reindex). `createIndex()` stays available via `--reindex` as a pure
performance step for later.

**2. Full audit before backfilling — the gap was much bigger than the two corpora first sampled.**
Per-corpus reconciliation (`corpus_sections` compiled count vs `corpus_fts` count, every corpus) found
**21 corpora with a gap, 1,172,169+ rows missing** (grew to ~1,177,770 by the time of the dry-run,
live proof the gap was actively widening under the old cursor, exactly as flagged): `scottish-
parliament-or` entirely absent (1,043,264, ~89% of the total gap), `early-day-motions` (50,437 of
60,737 — 83% missing, a new finding), `uk-treaties-fcdo` (23,372, entirely absent), `cma-cases`
(21,525, entirely absent), `pwdata-wrans`/`pwdata-debates`/`pwdata-lords`/`pwdata-westminster`/
`pwdata-lordswrans`/`pwdata-lordswms`/`pwdata-wms` (partial — the "Hansard gap", ~24k combined),
`erskine-may` (1,319 of 1,873 — 70% missing), `members-interests` (2,768 of 3,448 — 80% missing),
`ofgem` (4,272), `parliament-treaties` (328, entirely absent), `inquiry-evidence` (89, entirely
absent), `lgsco` (20 of 40 — 50% missing), `petitions`/`quangos-govuk`/`ico`/`cps-guidance`/
`pwdata-lordswms` (small tails). The prior "264k unexplained gap" figure referenced going into this
work is **superseded by this exact, itemised audit** — not reconciled against that number since this
one is the ground truth (full per-corpus count, not an estimate).

**3. Backfill executed — all 1,172,169+ rows written, verified complete.** Final full-corpus
`--dry-run` reconciliation: **0 corpora with gaps, 0 rows missing.** `corpus_fts` total
16,509,051 → **17,700,396**. Spot-verified: `scottish-parliament-or` count (1,043,264) exactly matches
`corpus_sections`, 0 duplicates (distinct ids == total rows); `cma-cases` and `early-day-motions` also
clean (0 duplicates). Searchability confirmed live via `rankedSearch()`: a freshly-backfilled
`cma-cases` row and `early-day-motions` row both rank in the top 10 for a phrase pulled from their own
body; a `scottish-parliament-or` row scores **rank 1 of 500** in a raw unboosted FTS scan on its own
distinctive terms (fully indexed and matchable) — it just doesn't win `rankedSearch`'s TITLE_BOOST/
tier-boost ranking for a generic query, because `corpus-map.ts`'s `tierFor()` has no entry for
`scottish-parliament-or` (falls through to `tier: 'other'`, no boost) — a **pre-existing corpus-map.ts
gap, not introduced by this backfill**, and consistent with the noise-burial pattern already diagnosed
in the 08:10 UTC entry below. Not fixed this session (a labelling/taxonomy question, out of scope of
what was asked) — flagging for whoever next touches `corpus-map.ts`'s tier map.

**4. Operational incident + clean resolution, worth remembering for future long-running sessions:**
attempting to chunk the ~1M-row `scottish-parliament-or` backfill across repeated harness-tracked
`Bash(run_in_background: true)` calls (needed because the tool caps a single invocation's actual
runtime at 600s, whether foreground or background) ran into the tool's timeout repeatedly; using
`TaskStop` / letting the timeout fire to "kill" a chunk **did not actually terminate the underlying
Windows node process** — it kept running, unsupervised, writing to `corpus_fts` in the background,
invisible to the harness. Multiple such zombies accumulated (one, an attempted `tbl.optimize()`
compaction, alone burned 3,939 CPU-seconds before being found) and wrote **overlapping/duplicate
batches concurrently** — `scottish-parliament-or` ended up with 274,000 rows for only 88,390 distinct
ids (up to 4× duplicates) before this was caught. **Root cause of the confusion, now resolved:** the
apparent "fragmentation slowdown" that made repeated diff-fetches progressively slower was actually
resource contention from these accumulating zombie processes, not Lance table fragmentation — killing
them (`Stop-Process -Force` on all `node` processes, verified via `Get-Process`, not just the harness's
own tracking) restored normal query latency immediately (a full-row fetch that had been hanging past
600s completed in 3.3s once the zombies were gone). **Fix:** deleted the corrupted
`scottish-parliament-or` slice (`tbl.delete(...)`, cheap — 3.3–8.1s regardless of row count, since it's
predicate-based, not a full fetch) and re-ran the backfill ONE more time as a genuinely OS-level
detached process (`nohup ... > logfile 2>&1 & disown`, absolute paths, polling the log file — not the
harness's `run_in_background`/`TaskStop`, which is a leaky abstraction here) — completed cleanly,
verified 0 duplicates. **General lesson for this environment:** the harness's "killed" status on a
background task means "the harness stopped watching it," not "the process is dead" — for anything that
mutates shared state (a Lance table, a DB), verify with `Get-Process`/OS tools before trusting it, and
prefer real OS-level detachment for genuinely long operations rather than fighting the tool's ~10-minute
per-call ceiling.

**5. Outstanding, not blocking:** `corpus_fts` has accumulated many small fragments from all the
`tbl.add()` batches across this backfill (and the historical incremental builds) — a `tbl.optimize()`
compaction pass is recommended for live query latency, but was not completed cleanly this session (the
attempt became one of the zombie processes above, uncertain whether it partially compacted before being
killed — Lance's atomic-commit design means this is safe, not corrupting, just incomplete). Flagging as
a follow-up, not correctness-blocking (confirmed rows are searchable regardless of compaction state).

**Scripts:** `scripts/ingest/search/fts-catchup.ts` (real, committed). Throwaway diagnostics (not
committed, left untracked per repo convention): `_fts-gap-audit-tmp.ts`, `_stale-vector-diag-tmp.ts`,
`_stale-vector-diag2-tmp.ts`, `_dedup-check-tmp.ts`, `_dedup-check2-tmp.ts`, `_dedup-spotcheck-tmp.ts`,
`_dedup-fix-tmp.ts`, `_quick-count-tmp.ts`, `_optimize-fts-tmp.ts`, `_final-search-verify-tmp.ts`,
`_final-search-verify2-tmp.ts`, `_sp-search-deep-tmp.ts`.

---

## CURRENT STATE — SEARCH: stale-vector mechanism identified + scoped legislation-tier recall test (2026-07-29 08:10 UTC)

**Part 1 — "removed since indexing" ghosts are `corpus_fts` staleness, NOT deletion.** Sampled 17 of the
`(metadata unavailable — section may have been removed since indexing)` ids from `VECTOR_DOSSIER.md`
(16 `scottish-parliament-or` + 1 `cps-guidance`). **17/17 exist in `corpus_sections` (Neon, the
keyword source of truth) AND in `corpus_chunks` (Lance, the vector pipeline's own body manifest —
full text retrieved, content confirmed intact). 0/17 exist in `corpus_fts`** (the Lance keyword table
the dossier script queries for display metadata, and the live BM25 arm's index).

**Root cause confirmed:** `corpus_fts`'s checkpoint (`_search/corpus_fts.checkpoint.json`) shows
`phase: "done"`, `updatedAt: 2026-06-20T17:34:13Z`, `lastId: "written-statements:2026-06-01:..."`.
The build resumes via a plain **lexicographic string cursor** (`WHERE id > lastId ORDER BY id`), which
only ever moves forward. All 1,043,743 `scottish-parliament-or` rows were created **2026-06-25 —
five days after that build completed** — no rebuild has run since, so the entire corpus (0/1,043,743
rows) has never been in `corpus_fts`, and a plain resume can never pick it up either (`s` sorts before
the cursor's final `w...` value, so `id > lastId` permanently excludes it without a `--reset`).
`cps-guidance` (created 2026-06-20, same day, 224/270 present) shows the same mechanism on a smaller
scale: rows compiled by the concurrent ingest worker after that single run's cursor had already swept
past the `cps-guidance:` id range are invisible to a forward-only cursor. **Not a reprocessing decision,
not a join-key mismatch between the vector's stored id and the current DB — both point at the same row,
which genuinely exists — `corpus_fts` is simply missing everything ingested after its last build that
sorts before the final cursor position.** The vector arm's ANN search correctly finds these sections
(they're properly embedded); it's the metadata/snippet lookup (which reads `corpus_fts`) that comes up
empty and prints the misleading "removed" placeholder.
**Blast radius:** at minimum the full 1.04M-row `scottish-parliament-or` corpus is currently
unsearchable via BM25/keyword at all, plus a partial `cps-guidance` gap — likely more corpora are
affected (anything seeded/re-ingested after 2026-06-20 whose id sorts before `written-statements`, i.e.
most of the alphabet). **Not exhaustively audited this session** (only the 17 sampled ids + the two
corpora's row counts were checked) — a full completeness sweep (`corpus_sections.createdAt` vs the
checkpoint's `updatedAt`, per corpus) is the natural next step. **Fix needs a `corpus_fts` rebuild**
(full `--reset`, or a targeted backfill of rows created after 2026-06-20) — Charlie's call on which,
not executed this session (multi-hour class of operation). Diagnostic scripts (throwaway):
`scripts/ingest/search/_stale-vector-diag-tmp.ts`, `_stale-vector-diag2-tmp.ts`.

**Part 2 — scoped (tier=legislation) recall test, B1–B3.** Filter-only, no rebuild (both `corpus_fts`
and `corpus_vec` already carry `tier` per row via `corpus-map.ts`). Full report:
`docs/VECTOR_DOSSIER_SCOPED.md` (full section text, not snippets, top 3 per arm).

- **B1 (landlord eviction) — CONFIRMS the noise-drowning diagnosis on the vector arm:** vector-alone
  unscoped does not surface HA 1988 s.21 in the top 10 at all; **scoped to legislation, it appears at
  rank 8.** BM25 fails both scoped and unscoped (never retrieves it regardless of tier — a genuine
  BM25 vocabulary gap, not a noise problem).
- **B3 (photographing people in public) — CONFIRMS the same pattern:** vector-alone unscoped misses
  Sexual Offences Act 2003 entirely (top 10 is petitions + Scottish-Parliament-OR ghosts + a 2026 Act);
  **scoped to legislation, SOA 2003 s.67A appears at rank 6.** BM25 fails both scoped and unscoped.
- **B2 (Airbnb whole-house lets) — DOES NOT confirm the diagnosis; a distinct failure mode.** Neither
  arm recovers the anchor Acts (Levelling-up and Regeneration Act 2023 / Deregulation Act 2015 s.44 /
  Use Classes Order) even scoped to legislation-only — the vector-alone top 10 stays dominated by
  unrelated pre-2000 housing-benefit-SI and redevelopment provisions regardless of scoping. BM25
  unscoped had a loose phrase-match at rank 9 (a parliamentary debate that happens to say "Use Classes
  Order," not the Act itself) — **scoping to legislation actually loses that hit** and surfaces nothing
  better. B2 looks like a genuine embedding/vocabulary miss where the anchor never enters the candidate
  set at all, scoped or not — not a case of the right answer being buried in noise. Worth its own look
  rather than folding into the noise-drowning story.

**Net read: 2 of 3 archetype-B queries tested show sharp vector-alone recall recovery when scoped to
legislation, supporting the "drowning in noise, not failing to find the law" diagnosis — but it is not
universal (B2 contradicts it), so scoping is not a substitute for fixing retrieval quality, only a
partial mitigation.** `LEX_SEARCH_VECTOR` stays OFF; this doesn't change that gate on its own. Script:
`scripts/ingest/search/_dossier-scoped-tmp.ts`.

**Part 3 — B2 follow-up: the Part 2 test above was RAW query, no Stage-3 expansion.** Re-ran BM25
B2 scoped WITH expandQuery's enrichment (mirroring score-fts.ts's exact merge mechanism). **Result:
B2 recovers under expansion+scoping — it is NOT a new/distinct vocabulary gap, it's the July A/B
finding (expansion already recovers B2 unscoped) and legislation-tier scoping, just never tried
together.** Levelling-up and Regeneration Act 2023: unscoped+expansion rank 12 → **scoped+expansion
rank 7** (scoping helps further). Use Classes Order: raw rank 9 → expansion rank 1 (scoped or
unscoped, tied). **One sub-source still never recovers in any of the 4 arms: Deregulation Act 2015
s.44 (the London 90-night provision)** — a standalone gap, not explained by either fix.
**⚠ Side-discovery, unrelated to B2, flagging separately: the production `expandQuery()`
(`scrutinise-web/lib/lex/query-expansion.ts`, `LEX_QUERY_EXPANSION` flag) is currently NON-FUNCTIONAL
against live `gemini-2.5-flash`** — the model's default "thinking" mode consumes the entire
`maxOutputTokens: 512` budget before writing any output (`finishReason: MAX_TOKENS`, ~488
`thoughtsTokenCount`, output truncated mid-JSON), so `JSON.parse` always fails and the function
silently degrades to EMPTY (by design — fail-open, no user-facing harm since BM25 falls back to the
bare query — but the feature does nothing if the flag is ever turned on). **Verified fix:** add
`thinkingConfig: { thinkingBudget: 0 }` to `generationConfig` — confirmed via direct API round-trip
(same prompt: `MAX_TOKENS`/empty parts → `STOP`/full valid JSON). **Not patched this session** — this
is a live-file change outside what was asked; Charlie's call whether to ship it. This was NOT
happening back on 1 Jul when the Stage-3 A/B was measured (it produced real anchors then) — something
changed in the model's default behaviour or the call site between then and now, unconfirmed which.
Scripts (throwaway): `scripts/ingest/search/_b2-scoped-expansion-tmp.ts`,
`_expansion-raw-debug-tmp.ts`.

**Note for the ingest/index-check thread (flag only, no action taken):** the `corpus_fts` rebuild
(Part 1 above) is now a **precondition** for any legacy-route migration work, not a parallel/independent
task — repointing those routes today, before the rebuild, would silently drop the entire
`scottish-parliament-or` corpus (1.04M rows) from production keyword results.

**One-line thought on preventing a repeat (no action taken):** the same "silent staleness" pattern
that bit the embed observer now confirmed to have bitten `corpus_fts` too — a cheap fix would be the
same `embed-observer.ts` pattern (already shipped for `corpus_vec`) applied to `corpus_fts`: a daily
Railway `ops` check comparing `MAX(corpus_sections."createdAt")` against the `corpus_fts` checkpoint's
`updatedAt`, alerting if the gap exceeds some threshold (e.g. 24h) — one query + one checkpoint read,
no new infra.

---

## CURRENT STATE — INGEST: Treaty coverage extension (8 Jul 2026, drain confirmed + re-baselined 21 Jul)

**`TREATY_INGEST_BRIEF.md` executed end-to-end** (ingest thread). CHANGE_LOG "INGEST — Treaty
coverage extension" (2026-07-08 16:33 UTC). `scripts/ingest` `tsc --noEmit` = only the 4 documented
pre-existing errors, unrelated. **Code committed to `Main` 2026-07-21** (`7deffbf`) — it had been
built and documented on 8 Jul but never pushed until this session.

- **STEP 0:** confirmed `uk-treaties` (3,264 sections/1,519 docs) + `tax-treaties-dta` (324/172) are
  entirely gov.uk-sourced (`filter_format=international_treaty`, V19) — not FCDO's own archive, not
  Parliament's. Extending, not duplicating.
- **STEP 1 `uk-treaties-fcdo` (new corpus) — ✅ SEEDED + DRAINED, re-baselined:** treaties.fcdo.gov.uk
  has no bulk export and no server-rendered HTML (legacy JBoss/Knowvation Backbone SPA) — the
  underlying anonymous JSON REST API was reverse-engineered from the SPA's own JS
  (`sources/fcdo-treaties.ts`: anonymous session login + `POST /awweb/awfp/search/1`). **Measured
  universe = 21,970 records — an honest-denominator correction against the brief's/gov.uk's ~15,000
  estimate.** 33% (7,184) carry a full-text PDF; 67% (14,786) are metadata-only records with no full
  text anywhere on the site — these get a compiled, searchable section built from the API's
  structured metadata (`availabilityStatus: 'metadata-only'`), not silently dropped. Dedup vs
  existing gov.uk-sourced corpora is best-effort exact-title-match (different id namespace, no shared
  key) — 127 skipped. Licence OGL v3.0, verified via the FCDO's own data.gov.uk catalogue entry (the
  site itself has no terms page). Pilot (3 diverse rows incl. a genuinely-scanned 1976 PDF) passed
  clean. **Drain confirmed complete 21 Jul: 0 open `ingest_queue` rows (pending/claimed/blocked/
  failed), 23,372/23,372 `corpus_sections` compiled, 0 residue** — the queue's completed rows have
  since been auto-purged by the 7-day cleanup job (`run-cleanup.ts`), which is why the queue itself
  now shows empty rather than "done". Section count (23,372) exceeds the 21,843 queued-row estimate
  because multi-PDF records produce more than one section each. **Re-baselined:**
  `corpus_targets.est_sections` 21,843 → **23,372**, `est_is_confirmed` false → **true**.
- **STEP 2 `parliament-treaties` (new corpus) — COMPLETE, 328/328, 0 failures:** the documented
  `treaties-api.parliament.uk` OpenAPI (same family as bills-api/committees-api) covers the CRaG 2010
  scrutiny register — laid dates, parliamentary conclusion, sponsoring department, and a
  BusinessItems timeline (debates, committee evidence, objection-period tracking). Kept as its own
  corpus rather than an enrichment on `uk-treaties-fcdo` (CC's call, brief left it open): different id
  space, different content kind (procedure vs treaty text), matches the codebase's existing
  parliamentary-procedure-APIs-stay-separate convention. Licence OPL v3.0 (verified family). Fully
  seeded and drained this session.
- **Wiring:** `licence-map.ts`, `seed-rate-limits.ts`, `search/corpus-map.ts` all updated for both new
  corpora.
- **NEXT:** nothing outstanding — both corpora fully drained, code pushed, targets re-baselined.

---

## CURRENT STATE — SEARCH: VECTOR rebuild COMPLETE — regression did NOT recover; positions rider abandoned (2026-07-22)

**Rebuild executed end to end on a Vultr box (128GB, `voc-g-32c-128gb-640s-amd`, lhr). Compaction
succeeded this time (1,821 fragments → 40, no OOM) — but recall did NOT recover.** Vector-alone
70.5% post-rebuild vs 71.2% pre-rebuild (statistically flat, reproduced twice bit-for-bit across
independent runs). **This overturns the original diagnosis:** compaction-skip was NOT the actual
cause of the regression. `LEX_SEARCH_VECTOR` stays OFF. This is now a search-quality question, not
an infrastructure one — see "what this means" below. Reports: `docs/VECTOR_FULL_RECONFIRM.md`,
`docs/VECTOR_NPROBES_DIAG.md`.

- **Positions rider (bonus, step 4): ABANDONED per the "abandon, don't debug" rule.** The prepped
  single-shot `withPosition:true` build on `corpus_fts_positions` hit a **hard R2/S3 multipart-upload
  limit (10,000 parts)** writing the inverted-index file — a platform ceiling, not a transient fault,
  so retrying would fail identically every time. Stopped immediately per spec rather than let the
  retry wrapper burn paid box-time. `corpus_fts_positions` is left in a partial, isolated state (zero
  risk to live `corpus_fts`) for a future attempt that rethinks the upload chunking — not investigated
  further this session, as directed.
- **Process note:** the vector-rebuild box was torn down before the positions rider ran (ordering
  mistake — the plan was rebuild → reconfirm → positions rider → teardown), requiring a second
  short-lived box for the positions attempt. Minor extra Vultr spend (~20 min), no data risk.

- **Diagnostic trail (22 Jul, before the rebuild):** full-index recall was measured at BM25-alone
  62.2% (pilot 68.3%, −6.1pp — expected corpus-scale control), vector-alone 71.2% (pilot 85.9%,
  −14.7pp), fused 70/30 71.2% (pilot 87.8%). Archetype B (lay-concept) at 30.6%. Harness self-tested
  clean (pure `fuseWeighted` unit tests + live-wiring re-check, both PASS — the regression was real,
  not a scoring bug). An nprobes[24..512]/refineFactor[2,4] query-time sweep found no recovery (flat
  ~70–71%), which correctly ruled out under-probing — but the working hypothesis at the time (the
  un-compacted index's degenerate IVF partitions) has now ALSO been ruled out by the rebuild result
  above. Also found: ~9s/ANN-call latency at the nprobes=24 production default — independently
  unshippable regardless of the recall question, unexplained, needs its own look before any flag work.
- **DO preflight (22 Jul): account active but size-gated** — `/v2/sizes` exposes only `m-2vcpu-16gb`,
  none of the larger Memory-Optimized tiers (new-account premium-class gate; the droplet_limit=10
  count cap is separately fine). Ask for Charlie if DO is wanted later: a support ticket for
  Memory-Optimized access, not a droplet-count increase. **Vultr had no such gate** — full range of
  64GB–2TB+ memory-optimized plans available immediately; used for both boxes this session.
- **What this means / NEXT:** the vector regression is now an **open search-quality question**, not
  an infrastructure one — ruling out compaction removes the only concrete lead so far. Candidate
  directions for a future session: (a) compare the pilot's and the full build's chunking/collapse
  logic for a subtle difference; (b) embed a larger (e.g. 500k–1M row) curated validation slice to see
  whether recall degrades gradually with scale or drops off a cliff, which would distinguish "ANN
  inherently loses recall at 21.8M scale" from "something is wrong with the full corpus specifically";
  (c) separately investigate the ~9s query latency, which blocks shipping regardless of the recall
  outcome. `LEX_SEARCH_VECTOR` stays OFF pending this. The positions build can be retried another day
  with a rethought upload-chunking approach (`corpus_fts_positions` left in place, isolated, harmless).

---

## CURRENT STATE — SEARCH: VECTOR EMBED full run — ANN INDEX BUILT, embed COMPLETE (2026-07-21)

**The full-corpus embed is DONE end to end.** `corpus_vec` checkpoint: `phase: "done"`, **1,821/1,821
shards, 21,846,364 vectors, 0 misses** (matches `corpus_chunks` exactly — zero loss across the whole
run). Superseded everything below in this section (kept for the incident trail). CHANGE_LOG entry
pending same session.

- **What happened between the 11 Jul "batch run LIVE" state and now:** the batch drain finished
  unattended (as expected) reaching 1,821/1,821 shards, phase→`indexing`. The indexing step
  (`vecTbl.optimize()` fragment compaction ahead of `createIndex()`) then **OOM-killed twice (exit
  137)** on the running cpx62 (32 GB) box — genuine OS SIGKILL, not a JS exception the code's
  try/catch could ever see. **CCX43 (64 GB), the documented fallback, is unavailable on this Hetzner
  account** (`dedicated_core_limit exceeded` — the same wall STEP 1's box selection hit; confirmed
  again live). No shared-core Hetzner type goes above 32 GB, so a bigger box wasn't an option.
- **Fix shipped (commit `fe518eb`):** `VECTOR_SKIP_COMPACT=true` on `build-vector-index.ts` skips
  `vecTbl.optimize()` and runs `createIndex()` directly over the un-compacted fragments — compaction
  is a read-efficiency step, not required for index correctness. Relaunched cpx62, index built
  **in 711.7s (~12 min)**, exit 0. Also bundled the 16 Jul `uncaughtException` crash-recovery handler
  (same file, already resilient to the stale-keep-alive-socket class of fault) — this is what let the
  *first* cpx62 box's retry loop survive the initial 25-min stall alert before the OOM was even found.
- **⚠ Quality caveat, NOT yet validated:** skipping compaction means the IVF_PQ index was built over
  ~1,821 un-merged shard fragments rather than one compacted table. The build log showed repeated
  `lance_index::vector::kmeans` warnings ("more than 10% of clusters are empty… dataset too small to
  have a meaningful index") during training, and many `partition N is empty, skipping` lines during
  the build proper. This MAY just be normal large-scale IVF_PQ chatter, or may mean partition
  assignment is less globally optimal than a compacted build would give — **not established either
  way**. This is exactly what the existing NEXT step (fusion + recall re-confirm on the full ANN
  index, gold-key validation) is for — treat that re-confirm as also validating this build, don't
  skip it. If recall comes back visibly worse than the pilot's 85.9% vector-alone number, the
  follow-up is a compact-then-reindex pass (needs the CCX43-quota problem solved first — a Hetzner
  support request to raise the dedicated-core limit, or process compaction in smaller batches).
- **Spend:** box torn down (`teardown`, confirmed). No further Hetzner billing. Total run cost is
  whatever the sync+batch embed phases already cost (§5.3/§6 estimate ~$470–560) — the index-build
  retries were compute-only on an already-running/short-lived box, not additional Gemini spend.
- **NEXT (unchanged from the existing plan, all still Charlie-gated):** (1) fusion re-confirm on the
  full ANN index (pilot's 70/30 weighting was tuned on the 60k exact-cosine subset, not ANN) —
  **this run doubles as the quality caveat's validation**; (2) gold-key validation; (3) flag flip
  (`LEX_SEARCH_VECTOR`) once both pass; (4) reranker (layer 5); (5) if recall regresses, plan a
  compact-then-reindex pass (blocked on Hetzner dedicated-core quota — flag to Charlie if needed).

---

## CURRENT STATE — SEARCH: VECTOR EMBED full run — TIER 2 FLIPPED, batch run LIVE (2026-07-11)

**Status corrected 2026-07-11 21:35 UTC (laptop diagnosis).** The prior "Tier 1 blocked / spend
PAUSED / awaiting Charlie's go" text below was STALE — the tier flip and batch relaunch already
happened on the desktop (7 Jul). Verified live from this laptop: **the batch embed is RUNNING and
actively progressing** (watched shards 849→850→851 complete in real time, checkpoint advancing).

- **THE RUN IS NOT STALLED — it is live.** At 2026-07-11 21:32 UTC: **851 / 1,821 shards done
  (~46.7%), 10,212,000 vectors banked, 0 misses**, phase=`embedding`, `corpus_vec` checkpoint
  advancing every ~2–3 min. Gemini batch jobs all `JOB_STATE_SUCCEEDED`; the newest is the shard
  currently RUNNING. The `create 429 (quota bucket)` waits in the tail log are **normal Tier-2
  pacing** (f6022df: 429 is a signal, not an error), NOT a failure. Correlation fix (84eba61) +
  create-429 pacing are working — 0 misses across 851 shards.
- **Why it looked "stalled":** (a) this laptop's clock is ~24.5h BEHIND (read 07-10 21:00 UTC when
  true time — 3 independent network sources — was 07-11 21:26 UTC); every timestamp looked "in the
  future / negative age". (b) The £46.55 July console figure = the **sync slice only** (~$47, 34
  shards / 408k vec); batch charges hadn't posted to the reading Charlie saw. **Fix the laptop clock
  (`w32tm /resync`) before any commit — CLAUDE.md §12 UTC stamps depend on it.**
- **Spend reconciliation (est):** sync slice ~$47 (£46.55, matches console) + batch-to-date ~$200–260
  (≈9.8M vec at $0.075/1M, token density varies by region) ≈ **~$250–310 so far**; on track for the
  report's **~$470–560** total projection. Read the LIVE billing console (now 07-11) for the true
  batch figure — the £46.55 is a stale sync-only snapshot.
- **Tooling gap — CLOSED 2026-07-11.** The email observer that was never built now ships:
  **`scripts/ingest/search/embed-observer.ts`**, wired into `ops.ts`'s 15-min cycle (R2-only,
  edge-triggered, no-op when idle). Emails `cl@scrutinise.org` on transitions: 🔴 STALL (>25m idle
  while embedding) · 🟢 RECOVERED · ✅ COMPLETE · 💚 daily HEARTBEAT (silence = healthy) · 💥 CRASH
  (tail-log `build exited code≠0`/`FATAL`/shard-`FAILED`, **any phase**) · ⏳ ANN-STUCK (indexing
  frozen >8h). The CRASH scan + ANN-STUCK ceiling close the phase=indexing blind spot (an ANN OOM
  would otherwise be silent). 23/23 offline tests pass; one confirmation heartbeat email sent.
  **Deploys with `ops` on the next push** (auto-deploy). Detail: `VECTOR_EMBED_REPORT.md` §6.2.
- **Resolved:** laptop clock fixed (`w32tm /resync`); `HETZNER_API_TOKEN` refreshed → box confirmed
  live via API (`scrutinise-build`, id 148701597, cpx62, running since 2026-07-07 08:08 UTC).
- **NEXT (no relaunch needed — it's running):** (1) push so `ops` deploys the observer; (2) let the
  batch drain to 1,821/1,821 (at the observed cadence, on the order of a few days) — the observer now
  emails if it stalls; (3) the ANN IVF_PQ index then builds automatically (phase→indexing; 32 GB OOM
  risk → `--index-only` on a CCX43 fallback; observer's ⏳/💥 alerts cover a failure here); (4) when
  done, `hetzner-build-run.ts teardown` (this laptop has no state file — tear down by id 148701597 or
  recreate `.hetzner-build-server-id`). Report: **`docs/VECTOR_EMBED_REPORT.md` §5–§6**.

<details><summary>STALE (7 Jul, superseded) — tier-wall / sync-mode / "spend PAUSED, awaiting go"</summary>

- **STEP 1 DONE (durable):** `corpus_chunks` on R2 = **21,846,364 chunks** from 17,640,560 sections
  (1.24/section, 230 body misses, ~32h on a cpx62 — CCX43 still quota-blocked). Never re-run.
- **STEP 2 WAS BLOCKED at the Batch tier:** account = paid Tier 1 → **500k enqueued-token queue**
  (probed: 182k ACCEPTED / 2.56M REJECTED; docs T1 500k / T2 5M / T3 10M). Original 40k shards
  (~12.4M tok) fit no tier. Learned en route: id-list load needs
  `NODE_OPTIONS=--max-old-space-size=28672` (V8 default-heap OOM, exit 134); cloud-init now injects
  GEMINI_API_KEY (`c715e00`, §12 carve-out). Zero Gemini spend lost across all failures.
- **Billing decode (Charlie):** £150 payment = CREDIT not spend; usage ≈ $36; Tier 2 = ≥$100 ACTUAL
  usage + 3 days (met) → AUTOMATIC flip. "£189.01 tier cap" = Tier 1's $250/month account ceiling —
  the slice fits. Tier-2 monthly cap $2,000 → remainder fits same month. **[CONFIRMED: flip happened.]**
- **THE GATED PLAN (now EXECUTED):** (0) sync `--canary` → (1) sync slice ~$47 (34 shards) →
  (2) probe confirmed Tier 2 → (3) batch relaunch `VECTOR_SHARD_SIZE=12000 VECTOR_MAX_INFLIGHT=1` —
  **this is the run now live at 851/1,821 shards.**

</details>

---

## CURRENT STATE — GRAPH: Tier 1 legislation graph + rescission traversal (5 Jul 2026)

**Sprint complete** (ingest thread; executes the Tier-1 graph brief). Report:
**`docs/GRAPH_TIER1_REPORT.md`**; CHANGE_LOG "GRAPH — Tier 1" (2026-07-05 16:57 UTC). All code in
`scripts/ingest/graph/`; `scripts/ingest` `tsc` = only the 4 documented pre-existing errors.

- **Store:** Neon `legislation_edges` — **2,348,993 edges, ~0.94 GB** incl. indexes. Columns per the
  brief (from_id, to_id, edge_type, sub_type, source, granularity, detail, extracted_at); ids in the
  corpus_sections `{corpus}:{gid}[:{sectionRef}]` scheme; PK-idempotent; gid expression indexes both
  directions. **⚠ Neon ~16 GB of 17.5 — check `graph/setup-edges-table.ts --status` before adding volume.**
- **Sources (all explicit/structured, bulk-before-API held, no LLM):** TNA bulk amendments XML
  (research.legislation.gov.uk; 2.6M effects → amends/repeals/commences/modifies; secondary types daily,
  primary/EU vintage 2025-10-30); whole-doc CLML `best-collection-xml.zip` already on disk (SI preambles →
  230,681 made-under edges incl. section-level enabling powers; body Citations → 121,279 cites edges);
  In-Force dataset CSVs (~107k act-level historical repeals back to 1235).
- **Audit headline:** per-section raw.xml in R2 has NO `<Citation>` markup (brief premise refuted —
  verified on amending provisions); effects only ever captured for 3,590 legacy UKPGA acts; SI preambles
  never stored per-section. The bulk sources supply all three gaps.
- **Traversal + service:** `graph/traverse-edges.ts` `impactSet(gid, sectionRef?)` → grouped
  madeUnder/citedBy/amendedBy/repealedBy/commencedBy/targetTouches + one-hop over dependent SIs;
  section queries prefix-match subsection grain + inserted siblings. `graph/edges-query-service.ts`
  (POST /impact, :8091) mirrors fts-query-service; smoke-tested live then shut down (no Railway home yet).
- **Gold archetype D through the traversal: 0% floor → 80% (8/10).** D1 2/2 · D2 2/2 · D3 1/1 · D4 3/3 ·
  D5 0/2 (case-interprets-section edges = future sprint, as briefed). Scorer `graph/score-gold-d.ts`.
- **NEXT / follow-ups (report §5):** primary/EU effects vintage top-up; elided revised-SI preambles
  (6,108) via made-version fetch; case-law edges (D5); fold the scorer's Title-Case citation-resolver
  fallback into production; Page-4 rescission-impact report wiring = Lex-side brief once wanted.

---

## CURRENT STATE — SEARCH: VECTOR EMBED (full-corpus pipeline + ANN + flag wiring, 3 Jul 2026)

**Sprint complete — BUILT INERT; the embed RUN is the Charlie-triggered spend** (search thread;
executes the post-pilot/post-fusion embed brief). Report + runbook: **`docs/VECTOR_EMBED_REPORT.md`**.
CHANGE_LOG "SEARCH — VECTOR EMBED" (2026-07-04 13:37 UTC). `scripts/ingest` `tsc` = only the 4
documented pre-existing errors; `scrutinise-web` = only the 2 pre-existing `react-markdown` errors.
New dep `@google/genai@^1.52` (isolates the Batch API's Files-upload + LRO polling).

- **Cost CONFIRMED within the ~$600 gate — no flag raised.** Measured on Neon (`search/measure-corpus.ts`):
  **17,640,217 compiled sections / 6.12 B words → ~22.25 M chunks (1.26/section) → ~6.90 B tokens (chars/4)
  / ~5.69 B (words×1.3)**. Batch rate $0.075/1M (verified ai.google.dev) → **~$430–520**. 768-d halves the
  vector store (~68 GB vs ~137 GB @1536-d), not the embed bill (Gemini meters input tokens).
- **Pipeline (`scripts/ingest/search/`, resumable/idempotent, mirror build-fts-index.ts):** `chunk.ts`
  (validated pilot chunker, pure) → `build-corpus-chunks.ts` (Neon→R2→`corpus_chunks` Lance + citation
  backfill) → `gemini-batch.ts` (ONLY Batch-API module: `:asyncBatchEmbedContent`, 50% discount; pure
  build/parse offline-selftested) → `build-vector-index.ts` (≤40k-req shards, ≤8 inflight, `corpus_vec` +
  IVF_PQ cosine ANN; `--canary`) → `vector-core.ts`/`vector-query-service.ts` (query-embed + ANN serve, INERT).
- **Wiring behind `LEX_SEARCH_VECTOR` (OFF):** `scrutinise-web/lib/lex/vector-search.ts` adapter +
  `search-gateway.ts` fuses via the **tuned 70/30 weighted RRF** (`LEX_FUSION_VECTOR_WEIGHT` 0.7, per
  FUSION_REPORT). Doubly inert (flag OFF + `VECTOR_SEARCH_URL` unset).
- **✅ CANARY RUN + PASSED (2026-07-04 11:51 UTC, ~$0.01, Charlie-approved).** Bounded STEP-1
  (5,000 sections → 23,130 chunks, 0 body misses; full build resumes from this checkpoint) + one live
  200-chunk batch job to `corpus_vec_canary`: job SUCCEEDED, 200/200 vectors all exactly 768-d, order/key
  assertions clean, norms 0.572–0.584, cos(adjacent windows) 0.932 > 0.854 (different sections). **The live
  Batch API JSONL/response contract is CONFIRMED** — the full spend is de-risked. (SDK flags
  `createEmbeddings()` experimental — pin `@google/genai` if re-installing.)
- **REMAINING RUN ORDER (Charlie-triggered):** `hetzner-build-run setup` →
  `run "…build-corpus-chunks && …build-vector-index"` (~$430–520 Batch spend) → `logs` (fts-watch
  checkpoints) → `teardown`.
- **Left OFF deliberately:** 70/30 fusion needs full-corpus re-confirm through the ANN path (pilot tuned on
  the 60k exact-cosine subset); ANN recall vs exact is a separate measurement; gold key still draft. The
  flag-flip is the next sprint.

---

## CURRENT STATE — SEARCH: FUSION TUNING (weighted RRF vs routing, 3 Jul 2026)

**Sprint complete** (search thread; the pilot's flag-flip follow-up — ran on the already-embedded
pilot subset, zero new embedding cost). Decision: **`docs/FUSION_REPORT.md`**; numbers
`docs/FUSION_RESULTS.md`/`fusion_tuning.json`; harness `scripts/ingest/search/pilot-fusion.ts` (new).
CHANGE_LOG "SEARCH — FUSION TUNING" (2026-07-03 22:54 UTC). `scripts/ingest` `tsc --noEmit` = only
the 4 documented pre-existing errors. Self-check: w=0.5 reproduces the pilot naive-RRF hybrid
byte-identically for all 3 models.

- **DECISION: ship weighted RRF at a single fixed 70/30 (vector/BM25), RRF_K=60 — no query-kind
  router.** gemini: **87.8%** recall@20 excl-floor vs naive RRF 84.3% / vector-alone 85.9% / BM25
  68.3%. The pilot's blocker (naive fusion < vector-alone) is resolved — weighted fusion is now
  strictly the best arm. At 70/30: A 100% · B 69.4% · B6 50% · C 93.3% · E 100% · F 80%.
- **A single fixed weight is competitive with kind-based routing — routing adds exactly nothing.**
  Full (wCit,wCon) grid over the production-detectable `parseCitation()` router tops out at 87.8%
  (ties fixed; none beat it). Why: at 70/30 the BM25 citation-resolver pin survives fusion, so
  citation queries keep 100% without routing; only ≥80/20 breaks A1 (100→50, dilution). Router
  also over-triggers on E-debate queries naming Acts (harmless here, but blunt) → prefer no-router.
- **Robust, not a spike:** 60/40=85.3 / 70/30=87.8 / 80/20=85.9 (plateau). voyage's optimum is
  also vector-heavy (80/20=86.9%) and weighting **fixes its B6 collapse** (naive 0% → 33.3%);
  e5 (weak model) stays best at 50/50 → the right weight tracks vector-arm strength (re-tune on a
  model swap = one cheap `pilot-fusion.ts` re-run). Watch-item: F5 (BILLS) 100→50 at w≥0.7.
- **Ship spec (§ of FUSION_REPORT):** fused score `0.7/(60+rank_vec) + 0.3/(60+rank_bm25)` over the
  BM25-with-resolver-pin arm; weight as env config (`LEX_FUSION_VECTOR_WEIGHT`, default 0.7).
- **NEXT (unchanged gates):** full-corpus gemini embed (test @768-d first) → ANN index → wire the
  `vector` capability flag with THIS fusion; re-confirm 70/30 on the full corpus (plateau means the
  flag-flip doesn't hang on it). Gold key still the unvalidated draft.

---

## CURRENT STATE — SEARCH: type-taxonomy display fix (§10.2, 3 Jul 2026)

**Fix shipped in code (search thread).** Report: **`docs/TYPE_TAXONOMY_AUDIT.md`**; CHANGE_LOG
"SEARCH — type-taxonomy display fix" (2026-07-03 22:14 UTC). `scrutinise-web` `tsc` = only the two
pre-existing `react-markdown` errors. Changed: `scrutinise-web/lib/lex/corpus-type-map.ts`.

- **Brief's premise refuted for MiFID (verified empirically).** retained-EU (→EU_LEGISLATION) and
  SI (`uksi`→STATUTORY_INSTRUMENT) ALREADY map correctly + render. "Revoke MiFID II" is empty because
  BM25 doesn't RANK the validated answers (MiFIR/SI-701/FSMA-2023) into the results at all — the B6
  ranking problem, not display. A type-map change can't surface them → that's the vector layer
  (`docs/PILOT_REPORT.md`). Reported honestly, not faked.
- **Real bug fixed: 13 hidden corpora → 4.** FTS `tier` is baked into the index; corpora seeded after
  `corpus-map.ts` last covered them carry `tier:'other'` → fell through to `null` → panel hid them.
  Biggest: **`scottish-parliament-or` = 1.04M sections**. Fixed in the DISPLAY layer
  (`CORPUS_DISPLAY_OVERRIDE`, by corpus name → works on the live baked-tier index, no reindex):
  scottish-parliament-or/EDMs/petitions → DEBATE; cma-cases/ofgem/ofcom/independent-reviews/
  cps-guidance/inquiry-evidence/lgsco → GUIDANCE. Remaining null (INTENTIONAL): explanatory-notes/
  -memoranda (annotations), erskine-may, members-interests.
- **Follow-ups:** `corpus-map.ts` `tierFor` for reindex consistency; `buildInitialBackground` prose
  narrates only 4/9 types (cards render all); MiFID answer surfacing = vector layer.

---

## CURRENT STATE — SEARCH: VECTOR PILOT (embedding-model bake-off, 3 Jul 2026)

**Sprint complete** (search thread; separate from the LEX thread below). Decision doc:
**`docs/PILOT_REPORT.md`**; numbers `docs/PILOT_RESULTS.md`/`pilot_results.json`; subset
`docs/PILOT_SUBSET.md`. CHANGE_LOG "SEARCH — VECTOR PILOT" (2026-07-03 15:50 UTC). `scripts/ingest`
`tsc --noEmit` = only the 4 documented pre-existing errors. New: `scripts/ingest/search/pilot-*.ts`
(common/providers/subset/chunk/embed/score). Lance pilot tables live on R2 (throwaway, not committed).

- **DECISION: gemini-embedding-001** for the full-corpus embed — NOT the legal-specialist voyage-4.
  On the 60k subset (all gold answers + stratified distractors, 0 MISS; 79,908 chunks), recall@20
  excl-floor: **gemini vector 85.9% / hybrid 84.3% (+16.0pp over BM25 68.3%)**; **voyage-4 vector
  85.9% (TIE) / hybrid 81.1%**; e5-open-weight 70.5%/77.2%. **No legal-specialist premium** — the
  brief's central question answers *no*; gemini is already integrated + wins hybrid + more robust on B6.
- **Vector layer helps where predicted:** archetype B (lay concept) BM25 23.6% → gemini vector
  **69.4% (+45.8pp)**; **B6 (MiFID burial) 0% → 50%** (3/6 sources unburied, all models). Citations
  NOT hurt (gemini hybrid A = 100%).
- **Nuance:** equal-weight RRF *underperforms* vector-alone for strong models (drags them toward the
  weaker BM25; voyage B6 collapses 50%→0%). End-state should route by query kind / vector-weight the
  fusion — NOT naive RRF. Open-weight slot = e5-large-instruct (Together delisted BGE-M3; BGE-* non-serverless).
- **NEXT (gated on Charlie):** full-corpus embed with gemini (test @768-d first — Matryoshka halves
  the ~$0.8–1.2k sticky cost / 1.5× storage of 1536-d) → ANN index → wire the `vector` capability flag
  already reserved in `lib/lex/search-gateway.ts`; then tune fusion + chunking. Provisional (gold key
  still the unvalidated draft). Voyage needs a payment method on the account for standard rate limits
  (done this session; still within free token credits).

---

## CURRENT STATE — LEX REBUILD Sprint 3 + 3-A (full kernel + preview-validation amendments) + Sprint 1.4 (3 Jul 2026)

**Preview only — NOT promoted.** Frontend Sprint 1.4 + the full-kernel Sprint 3 + the **§19-A amendments
(Sprint 3-A)** from Sprint 2 preview validation all shipped to the preview this session (separate from the
SEARCH thread below). Full account: CHANGE_LOG "Sprint 3-A" / "Sprint 3" / "Sprint 1.4"
(2026-07-03 17:27 / 02:02 / 01:58 UTC); as-built in `LEX_PLAYBOOK.md` §11 + §11a.

**Sprint 3-A amendments (§19-A, take precedence over §19):** **A1 (fix-first)** structured fields are now
proposable — Lex synthesises chat into slot JSON (`proposal.valueObject`), box shows "proposed by Lex", user
edits/Saves; new anti-transcribe rule (no more "pop it in the box"). **A2** completed stages collapse in all
three panels (accordions / chat dividers / legislation stage groups). **A3** middle panel auto-scrolls the
next box to top on Save. **A4** cause-seeding diagnosed (likely transient Gemini empty/error, swallowed) +
hardened (stage logging + retry + corpus-grounded fallback). **A5** single-cause root = one-click confirm,
not "which driver"; duplicate bubbles suppressed. **A6** "The Basic Idea" everywhere. **A7** empty legal-tier
copy reworded for retained-EU law (+ retrieval question flagged to the search workstream). `scrutinise-web`
`tsc --noEmit` clean (only the two pre-existing `react-markdown` errors — install on Vercel). Additive schema
**applied to Neon** (`prisma/lex_rebuild_page3_4.sql`, idempotent; 10 placeholder `CostBenchmark` rows).
**Full kernel smoke-tested end-to-end on Neon on the deterministic no-Lex fallback path
(Orientation→Diagnosis→Guiding Policy→Coherent Actions, 16/16 assertions pass; throwaway deleted).**

**COSTING_SCOPE §9 (schema brief) also executed** (extends Sprint 3 Task 5): `CostBenchmark` gains
`priceYear`/`category`/`region`/`uprateMethod`/`confidence`; new `DeflatorSeries { year, index }` table (seeded
illustrative 2015–2026 placeholder); the estimator now UPRATES each cost to the latest deflator year before
aggregating (verified: £1m@2016 → £1.33m@2026). Additive SQL applied to Neon (`prisma/lex_costing_deltas.sql`).
Phase-2 (per COSTING_SCOPE §7) — real ONS deflator + GDP-per-head series, ~50 Tier-1 benchmarks, optimism-bias
uplift, EANDCB RPC-scrutiny flag — is scaffolded and ready. See CHANGE_LOG "COSTING_SCOPE §9".

**COSTING Phase 2a s1 — verified benchmark seed LOADED (placeholders OUT).** `docs/cost-benchmarks-seed-v1.json`
integrated per its loader_note: 5 verified rows in (`v1-qaly` £70k, `v1-wellby` £10–16k, `v1-vpf` £2.0m
GDP_PER_HEAD + contested note, `v1-homicide` £3.2m, `v1-crime-total` £59bn context anchor), all 10 `seed-*`
placeholders deleted (the un-replaced ones are in `_pending` — no unverified numbers in the DB). Loader
`scrutinise-web/scripts/load-cost-benchmarks.ts` (idempotent, `--apply` run on Neon + verified); appraisal
parameters in `lib/lex/costing-params.ts` (STPR/EANDCB VERIFIED; health rate + optimism-bias TRAINING_RECALL,
gated `verified:false`). `_pending` in the JSON = the Phase-2b extraction backlog. See CHANGE_LOG
"COSTING Phase 2a s1".

**COSTING Phase 2a s2 — v2 additions loaded + extraction manifest M1–M11 WORKED (4 Jul 2026).**
**CostBenchmark = 53 verified rows, zero unverified.** v2 (20 HO crime 2019/20 rows) loaded; homicide +
context anchor replaced. Manifest via `scrutinise-web/scripts/costing/` (per-target scripts, verify-against-
bytes, refresh = new SOURCE_URL + re-run): **M3 ✓** real ONS L8GG deflator 1955–2025 (placeholder series
gone; uprating targets 2025); **M1/M2 ✓** TAG May-2026 — live VPF £2,652,796 (replaced provisional £2m) +
casualty/accident + travel-time rows; **M5 ✓** PSSRU 2025 (9 rows); **M6 ✓** ASHE 2025 wages; **M7 ✓** DESNZ
carbon 2026/2030; **M8 ✓** BPE 2025 business counts; **M10 ✓** fraud 2023-24 £2,884/£2,170 + £14.4bn
(v2 fraud row superseded+deleted); **M11 ✓** optimism-bias + 1.5% health rate VERIFIED against the primary
PDFs → `costing-params.ts` fully verified. **⚠ DECISIONS WAITING ON CHARLIE:** (1) **M4 GMCA ingest go** —
licence read from the workbook itself = **CC BY 4.0 (© GMCA 2026)**, attribution satisfied per-row;
`m4-gmca.ts` dry-run-verified with 30 selected entries, `--apply` held per the report-back gate. (2) M9
(HO amendments to unit costs) BLOCKED — gov.uk link 404s; re-check next pass. See CHANGE_LOG
"COSTING Phase 2a s2".

- **Sprint 1.4 (UX polish, frontend).** Prominent coloured **pill** "How this works" centred above the chat
  column (was a tiny link); **auto-opens on a user's first idea**; Lex's first-message aside → "For a quick
  introduction if you don't know what to do, click 'How this works' above."; modal copy rewritten (Welcome +
  three panel boxes + four-stages closing, repetition dropped); first stage / sidebar renamed **"The Basic Idea"**.
- **Sprint 3 (design §16–§19).** (1) **Method layer** `lib/lex/method.ts` — the four Rumelt blocks verbatim,
  injected per stage (M-GENERAL + active block), visible in `[lex-diag]`. (2) **Page 2 refinements** —
  `classification` (material/contributory) chips + root-cause-among-material; who's-affected reframed; cui bono
  captured. (3) **Causal tree** — `parentCauseId` self-FK; List|Map toggle; dependency-free nested tree render
  (**Mermaid deferred** to keep the tsc gate clean — no diagram dep existed); soft depth cap 4. (4) **Page 3
  Guiding Policy** — `PolicyOption` table + `/policy-options`; Lex seeds candidate approaches per material cause
  with for/against; choose→CHOSEN + rest RULED_OUT; whatItRulesOut composed; leverage/responses/conditions/summary.
  (5) **Page 4 Coherent Actions + costing** — `LexCoherentAction` (isolated from legacy `CoherentAction`) with the
  §18.2 three-way cost ranges; `CostBenchmark` + `IdeaAssumption` + 10 placeholder benchmarks; `/actions`; estimator
  with benchmark picker + override; `computeCostSummary` vs the Page 2 problem cost; coherence check + summaries.
- **REMAINING GATE:** Charlie validates `/ideas/create` end-to-end through Coherent Actions on the preview, then
  promote. Real FTS is still stubbed behind the gateway; the benchmark set is hand-seeded placeholders (Phase-2
  research pending). `commit-all.sh` produced for the single end-of-sprint push (do NOT promote).

---

## CURRENT STATE — SEARCH: Stage 3 payoff A/B (recall@20 OFF vs ON, 1 Jul 2026)

**Sprint complete** (search thread; separate from the LEX REBUILD thread below). Full account: CHANGE_LOG "SEARCH — Stage 3 payoff A/B" (2026-07-01 16:03 UTC). Reports: **`docs/FTS_STAGE3_AB.md`** + `docs/fts_stage3_ab.json`. `scripts/ingest` `tsc --noEmit` = only the 4 documented pre-existing errors.

- **B6 answer-key filled + VERIFIED (no coverage gaps).** All 6 MiFID sources present in `corpus_sections`: FSMA 2023 (`ukpga/2023/29`, `pNNNNN` refs), MiFI Regs 2017 (`uksi/2017/701`), retained MiFIR (`retained-eu:eur/2014/600`), **FCA Handbook COBS+SYSC (`fca-handbook:cobs`/`:sysc` — IS ingested)**, FSMA 2000 (`ukpga/2000/8`), onshoring SIs (`uksi/2019/1390`,`uksi/2021/1388`). B6 `scoreable:true`.
- **A/B mode** in `score-fts.ts` (`--ab`): per recall@20 query, bare vs `expandQuery`-enriched recall@20. Without `--ab` = byte-identical baseline. `expandQuery` loaded via runtime require (keeps tsc clean across rootDir).
- **Result:** **B OFF 33.3% → ON 48.6% (+15.3pp)** ✅ payoff confirmed (B3 0→66.7, B1 0→25, B2 33.3→66.7). **A OFF 60% → ON 70% (+10pp), NOT flat & bidirectional** — A5 0→100 (concept) but A1 100→50 (precise citation displaced by dilution; exact-pin held). Dilution regressions: B4 −50 (bill crowded out), D1 −50, D3 −100 → **keep expansion scoped to concept queries (prod already does — Page-1 keywords, not citation lookups).**
- **B6 only +16.7pp** — expansion named plausible anchors (FSMA 2000, MiFID Directive, Investment Firms Reg/Dir) but not the exact key (FSMA 2023/MiFIR/MiFI Regs/FCA Handbook); only an onshoring SI matched. Probed: key sources ARE indexed in Lance (targeted "FCA COBS" query → 15/20 fca-handbook rows), but even a near-exact "FSMA 2023" query surfaces committee/HMRC/parliamentary chatter above the Act. **B6 is a RANKING problem, not coverage** → the flagship case for the vector layer / stronger legislation-tier ranking.
- **Caveat:** transient Gemini 503s left C1/C2/F2/F4/K2/J1 with no expansion (ON=OFF) — C's +6.7pp understates; **A and B measurements are clean** (every A/B query got a full expansion). Baseline headline shifted 69.4%→67.2% (n 30→31) solely because B6 (OFF 0%) joined the scored set; the 30 v1 per-query numbers are unchanged.
- **NEXT:** tune the legislation-tier ranking (B6/Finding-B class) and/or bring in the vector layer; the Stage 3 staging GATE still stands. K1/K2/J1 expected-sources still TODO. G–I 0–2 rubric still to be calibrated by example.

---

## CURRENT STATE — LEX REBUILD Sprint 2 (Diagnosis / Page 2, 1 Jul 2026)

**Preview only — NOT promoted.** Built `LEX_DESIGN_ADDENDUM_14-15.md §15` (design §7, §14). Full account:
CHANGE_LOG "LEX REBUILD — Sprint 2" (2026-07-01 15:26 UTC); as-built rules in `LEX_PLAYBOOK.md` §10.
`scrutinise-web` `tsc --noEmit` clean (only the two pre-existing `react-markdown` module-not-found errors —
installs on Vercel). Page 1→Diagnosis chain smoke-tested end-to-end on Neon on the deterministic no-Lex
fallback path (22 assertions pass; throwaway script deleted).

- **Task 1 — search gateway.** New `lib/lex/search-gateway.ts` = the ONE search seam. `runSearch({keywords,
  intent, ideaContext?, limit?})`; intents `BACKGROUND_BRIEFING`/`CAUSE_SEEDING`; capability flags
  (`expansion`/`webOrientation`/`vector`/`reranker`/`graph`) env-gated, **default OFF**. `fireSearchTrigger`
  routes through it — no behaviour change.
- **Tasks 2/3 — Diagnosis fields + causes loop.** `lib/lex/page2-config.ts` (challenge, whoAffectedImpactCost,
  causes, rootCause, legalLandscape, pivotalObstacle, summaryDiagnosis). New `DiagnosisCause` table + enum +
  additive Idea columns (`lexPage`, `challenge`, `whoAffectedImpactCost` Json, `legalLandscape` Json,
  `pivotalObstacle`), **applied to Neon** via `prisma/lex_rebuild_page2.sql` (`prisma db execute` + generate).
  Causes CRUD + `POST /api/ideas/[id]/causes`; Lex pre-seeds candidates via gateway `CAUSE_SEEDING`. The
  field machine + conductor + panels were **generalised from Page-1-only to multi-page**.
- **Task 4 — transition.** `Idea.lexPage` pointer; `POST /api/ideas/[id]/page` advance (guarded); Background
  panel CTA row (**Continue to Diagnosis** + **Ask Lex about this** + disabled Give-feedback placeholder).
- **Task 5/6 — conductor + panels.** `orchestrateAfterWrite` dispatches by field kind (propose / seed
  structured / seed causes / ask reference / generate summary), same save-before-advance rule. `FieldsPanel`
  renders the new kinds; `BackgroundPanel` CTA; `ChatPanel` `focusNonce`.
- **REMAINING GATE:** Charlie validates `/ideas/create` through Diagnosis on the preview, then promote.
  The Page-1-Box-1 carry-forward into `whoAffectedImpactCost` is thin today (only legacy `whoAffected` — see
  playbook §10); widen when a structured Page-1 impact/cost source exists.

---

## CURRENT STATE — SEARCH: Stage 3 smoke-test + v2 gold harness (1 Jul 2026)

**Sprint complete.** Two independent tasks (neither blocked on the archetype-B answer-key). Full account: CHANGE_LOG "SEARCH — Stage 3 smoke-test + v2 gold harness" (2026-07-01 13:57 UTC). `scripts/ingest` `tsc --noEmit` = only the 4 documented pre-existing errors.

- **Task 1 — Stage 3 VERIFIED.** Throwaway smoke test (written, run, deleted) drove `expandQuery` + the real BM25 `rankedSearch` against the live 16.5M `corpus_fts` index for the 3 lay queries. **Acceptance MET:** "Revoke MiFID II" → anchors FSMA 2000/2023, MiFID Directive, **retained MiFIR**, UK MiFID; expansion surfaced **6 new legislation rows** (2006 MiFID SIs + 2019/2021 onshoring SIs), top-leg score 44→378. "data protection" → DPA 2018/UK GDPR (leg@20 0→1). "seatbelt law" → RTA 1988 + Seat Belts Regs, surfaced RTA 1988 s.15 (0→5). Gemini threw transient **503s** → `expandQuery` degraded to EMPTY as designed (a harness retry rode over it). **Plumbing note:** `runFtsSearch` is dormant locally (`FTS_SEARCH_URL` unset → stub); it wraps the same `rankedSearch` the test used.
- **Task 2 — v2 GOLD encoded.** `gold-queries.ts` gained `ARCHETYPE_META` (stream/kind/metric per §A) + per-query `stream`/`kind`/`metric`/`scoreable`/`lessonTarget`/`todo`; new entries **B6, G1–G3, H1–H3, I1–I3, J1, K1–K2**. B6/K1/K2/J1 carry **TODO expected-sources** (`scoreable:false`) → present but excluded from the headline until the validated answer-key lands. `score-fts.ts` headline now aggregates over the **scoreable recall@20 set only (== v1)**, added the **0–2 lesson scaffold** (G–I = NOT CALIBRATED) + a pending-validation section. **Verified:** headline **69.4% / 68.0% excl-floor (n=25)** — byte-identical to the 27 Jun v1 baseline; 9 principle + 4 pending cleanly excluded. Regenerated `docs/FTS_S1b_SCORING.md` + `docs/fts_s1b_scores.json`.
- **NEXT (unchanged gates):** fill B6/K1/K2 expected-sources from the validated answer-key (then flip `scoreable:true`); calibrate the G–I 0–2 rubric by example once a principle-stream result exists (§C.3); the Stage 3 staging GATE below still stands (`LEX_QUERY_EXPANSION=true` in Vercel staging → re-score).
- **Local-dev note:** to run the harness I `npm install`-ed `scripts/ingest` (node_modules is gitignored; deps were absent since the 27 Jun run). Not part of the commit.

---

## CURRENT STATE — SEARCH Stage 3: LLM query expansion (30 Jun 2026)

**Sprint complete.** CHANGE_LOG "SEARCH — Stage 3" (2026-06-30 10:32 UTC). `scrutinise-web` `tsc --noEmit` clean (pre-existing `react-markdown` module-not-found only — not installed locally, installs on Vercel).

- **Built:** `lib/lex/query-expansion.ts` (new) — `expandQuery(keywords, ideaContext)` → `{ anchors, termsOfArt, rephrasings }`. Gemini 2.5 Flash structured JSON, temperature 0.2, 10s timeout, resilient (returns EMPTY on any failure).
- **Wired:** `lib/lex/field-machine.ts` `fireSearchTrigger` now fetches `ideaNarrative + youAndIdeaNarrative`, calls `expandQuery`, merges expanded terms via `Set`, passes enriched keyword set to `runFtsSearch`. Briefing prose (`buildInitialBackground`) still receives original keywords only — grounding guardrail enforced.
- **Flag:** `LEX_QUERY_EXPANSION=true` in Vercel env enables it (default off). `QUERY_EXPANSION_MODEL` overrides model (default `gemini-2.5-flash`).
- **Observability:** `[query-expansion] terms added` log per trigger — original/added/anchors/termsOfArt/rephrasings breakdown.
- **GATE:** Set `LEX_QUERY_EXPANSION=true` in Vercel env (staging first) → run gold-set queries → verify lay-concept archetypes (data protection, road safety, Revoke MiFID II) now surface anchor Acts. Citation queries (archetype A) should be unaffected.

---

## CURRENT STATE — V30 (UK DEPTH COMPLETION: financial corpus · own-domain reviews · inquiry evidence · pre-2016 Scottish OR, 24 Jun 2026)

**Sprint:** V30 (`SPRINT_V30_BRIEF.md`). Full account + per-source scorecards + category-completeness table: **`docs/SPRINT_V30_REPORT.md`**. CHANGE_LOG "V30". Governance: **`docs/SENSITIVE_EVIDENCE_POLICY.md`**. Build-only; `scripts/ingest` `tsc --noEmit` **clean (0 errors)**. Baseline at open: 16,785,723 sections / 5.84B words / Neon 14 GB (3.5 GB headroom to 17.5 GB — V30 adds <1 GB).

**Category-completeness (read the report's table for detail):**
- **§1.1 CMA/OIM/SAU — SEEDED + DRAINED ✓** (`cma-cases`, OGL v3.0 ✓; **22,890 sections live** / 8 transient PDF-fetch fails; seeded+drained 24 Jun 12:15–14:18 UTC by the interrupted session). Measure undershot (sample 4.1 PDFs/case → full 20,336 decision PDFs + 2,562 overviews).
- **§1.2 CAT — PROBED-V31** (route clean ~1,100 judgments; own copyright/private-study-only; not in Find Case Law → email Competition Service). `cat-restricted`.
- **§1.3 FCA enforcement — PROBED-V31** (FCA own copyright; email with BoE/PRA). `fca-restricted`.
- **§2 Own-domain reviews — BUILT, PDF-ROUTE-BLOCKED** (Cass/Children's-Social-Care/IMMDS = SPA shells, 0 archive-enumerable PDFs; adapter+registry+seeder ready for pinned PDFs; listed for Charlie).
- **§3 Inquiry evidence — BOUNDED TRANCHE SEEDED ✓, full seed AWAITING GO** (`inquiry-evidence` + §0; POH `--max-pages 5` = 90 rows → **90 sections** (89 `av=full`, real text 132–218,448 w; 1 `av=pdf-only` graceful marker), **§0 keep-path + extraction canary PASS**, 0 skipped/failed. POH §0 sample all-keep so no `sensitive-excluded` observed — exclude path stays unit-tested-only until IB/Grenfell). Charlie chose bounded-first → **full ~19,425-item POH seed is the live ask.** Then IB(kept-only)→Grenfell.
- **§4 Pre-2016 Scottish OR — SEEDED + DRAINING ✓** (`scottish-parliament-or` extended to 1999 via Wayback; 2,322 rows seeded; `arch:` branch canary PASS — producing ~83–130 sections/report; sparse captures → `archive-miss` markers).

**✅ CARRIED CATCH RESOLVED:** `scottish-parliament-or` now seeded BOTH 2016+ (V28, **5,130 rows**) and pre-2016 (V30, **2,322 rows**) = **7,452 rows, canary PASS (skipped=0, failed=0), DRAINING** (modern 5,130 still queued behind pre-2016 — full drain is hours; re-baseline at drain per step 7).

**POST-PUSH RUN ORDER:** (1) `seed-rate-limits.ts` (+`cma-cases`,`inquiry-evidence`); (2) confirm Ingest deploy SUCCESS (commit hash) before seeding new sourceTypes; (3) `v30-seed-cma-cases.ts --seed`; (4) `v28-seed-scottish-parliament-or.ts --seed` THEN `v30-seed-scottish-or-pre2016.ts --seed`; (5) `v30-seed-inquiry-evidence.ts --seed` (Post Office Horizon; `--max-pages` to tranche); (6) if own-domain PDFs pinned, `v30-seed-own-domain-reviews.ts --seed`; (7) at drain re-baseline + `v20-licence-backfill.ts`.

**▶ POST-PUSH STATUS (executed 24–25 Jun; the interrupted session got through 1–3, this session resumed 4–5):**
- **(1) rate-limits ✓** (`cma-cases` 300/5, `inquiry-evidence` 1000/2 live). **(2) Ingest deploy SUCCESS** confirmed (Railway 24 Jun 12:15 UTC; canary = worker produces sections not markSkipped → processors deployed).
- **(3) cma-cases ✓ SEEDED + DRAINED** — 22,890 sections (see §1.1).
- **(4) scottish-parliament-or ✓ SEEDED (7,452 rows) + DRAINING** — both branches canary PASS, skipped=0 failed=0 (see §4 / catch-resolved).
- **(5) inquiry-evidence ✓ BOUNDED TRANCHE (90 rows) SEEDED + DRAINED, canary PASS** — full POH seed awaiting Charlie go (see §3).
- **(6) own-domain reviews — SKIPPED** (no pinned PDFs; still gated on Charlie capturing Cass/CSC/IMMDS report PDFs).
- **(7) re-baseline + licence-backfill — PENDING at drain** (scottish modern 5,130 still draining; run `v30-corpus-status-table.ts` + re-baseline + `v20-licence-backfill.ts` once scottish drains).

**DECISIONS WAITING ON CHARLIE (V30):** **GO on the full ~19,425-item POH inquiry-evidence seed** (bounded tranche canary PASSED — drop `--max-pages` to run it all) · V31 emails — Competition Appeal Tribunal (Competition Service) · FCA enforcement (+BoE/PRA) · capture/pin own-domain review PDFs (Cass et al.) · IB(kept-only)→Grenfell evidence sequence after POH · plus the full carried V29/V26 list below. *(RESOLVED this session: scottish-parliament-or 2016+ seed — now run; cma-cases post-push seed — now drained.)*

---

## CURRENT STATE — SEARCH S1b: archetype-A fix (citation resolver + backfill), positions pilot stood down (23 Jun 2026)

**Search workstream.** v1's one serious hole — archetype A (citation lookup) at **0%** — is fixed. Full account: CHANGE_LOG "SEARCH S1b — archetype-A fix" (2026-06-23 11:24 UTC); diagnosis + deltas in `docs/FTS_ARCHETYPE_A_DIAG.md`. `scripts/ingest` `tsc --noEmit` clean (only the 4 documented pre-existing unrelated errors).

- **Diagnosis:** legislation section rows never carry the parent act's title ("Housing Act 1988") — it lives only in legacy `LegislationItem.title` (gid-keyed), never carried onto `corpus_sections`. So citation queries surface parliamentary chatter, not the section (A1/A5 absent from retrieval; A2/A3/A4 present but out-ranked).
- **Fix (applied):** (1) **query-time citation resolver** (`search/citation-resolver.ts` + `fts-core.ts`) — parse citation → resolve act→gid → fetch exact section by id → inject at #1; legislation-tier favour on the BM25 remainder; **no reindex**. Wired into `fts-query-service.ts` + `score-fts.ts`. (2) **body/title citation backfill** (`citation.ts` + `build-fts-index.ts` + `backfill-citations.ts`) — complementary BM25 retrieval gain, **lands on the gated Railway rebuild** (local 16GB can't reindex 16.5M).
- **Re-score (resolver, full 16.5M):** A **0%→60%** (MRR 0.800; exact section #1 for A1–A4), overall **57.8%→69.4%**, D 67%→77%, no regressions. A5 stays 0% (concept query, no citation — out of scope). v1 baseline preserved at `docs/FTS_S1b_SCORING_v1_baseline.md`.
- **Positions parked; pilot stood down:** dropped `corpus_fts_pilot` table + checkpoint + `build-fts-pilot.ts` + wiring. `corpus_fts` restored to pristine (exploratory in-place mutations rolled back via Lance version restore).
- **GATED ON CHARLIE:** (1) Railway full rebuild to land the body backfill in production (`build-fts-index.ts` bakes it); (2) delete the empty `fts-pilot` Railway shell (`serviceDelete fdd32248-1bd5-4264-8ab0-54de78545151`).

---

## CURRENT STATE — LEX REBUILD Sprint 1.3 (web app, 25 Jun 2026)

**Preview only — NOT promoted.** Full account: CHANGE_LOG "LEX REBUILD — Sprint 1.3" (2026-06-25 01:12 UTC); rules in `LEX_PLAYBOOK.md` §3a/§3b. `scrutinise-web` `tsc --noEmit` clean.
- **Task 1 save-before-advance.** Diagnosed: the state machine already keeps a box current until Saved/Skipped (`currentField` = first non-terminal); the regression was the **prompt** reading as advancing. Enforced: `/lex` builds the prompt with **`awaiting`** so while a box is `AWAITING_CONFIRMATION` Lex refines THAT box only + points to **Save** (no next-field ask/propose); fresh proposals tell the user to review & Save in the panel; tightened RULES. Added `[lex-diag]` logging across `/lex` + orchestrator + `fields` route (the brief's "log/inspect").
- **Task 2 tour.** New `components/lex/HowItWorksModal.tsx` — **persistent "How this works"** button in the create view → tour (3 panels, verbatim copy) → **Read the FAQs** (wired to `lib/faq-content.ts`, incl. Guiding-Policy/Strategic-Kernel). Intro "say the word" opens it via a conservative `HELP_INTENT` regex.
- **Task 3 name.** `preferredName ?? firstName` in intro + orchestrator prompt; **Neon data fix** — `cl@scrutinise.org` + `scalablefinance@gmail.com` `preferredName` `Charles`→`Charlie` (applied; the deliberate "Boss" account untouched).
- **REMAINING GATE:** Charlie validates `/ideas/create` on the preview, then promote. **Note:** the FTS "Finding B" search changes (`scripts/ingest/search/fts-core.ts`, `fts-query-service.ts`, `scrutinise-web/lib/lex/fts-search.ts`; CHANGE_LOG "Finding B", 2026-06-25 01:08 UTC) landed as their own commit `d55e118` (separate search workstream) and sit *below* the Sprint 1.3 commits — they were NOT bundled into them.

## CURRENT STATE — LEX REBUILD Sprint 1.2 (web app, 23 Jun 2026)

**Polish (23 Jun, preview only — NOT promoted):** (1) Background panel now renders the Initial Background **markdown** via `react-markdown@10` (no prior renderer; Tailwind v4 has no `prose` plugin → `Components` map); (2) returning-user intro reworded to drop the non-existent "guided tour button" (Sprint 1.3 restores a real one); (3) failed Lex turn now **logs cause per attempt** (kind/status/body, or raw bytes on schema-validation) and the client **retries once** before the fallback. `tsc` clean. CHANGE_LOG "LEX REBUILD — Sprint 1.2" (2026-06-23 17:42 UTC); recorded in `LEX_PLAYBOOK.md`. Below = Sprint 1.1 (still current architecture).

---

## CURRENT STATE — LEX REBUILD Sprint 1.1 (web app, 21 Jun 2026)

**Separate workstream from ingest.** Built `LEX_REBUILD_DESIGN v.1.md` §13 — the **orchestration fix** that wires Lex's conversation to the field machine (Sprint 1 built both but never connected them, so the flow stalled). Full account: CHANGE_LOG "LEX REBUILD — Sprint 1.1" (2026-06-21 01:58 UTC). `tsc --noEmit` clean; 13/13 orchestration assertions pass end-to-end on Neon (fallback path); live Gemini emits a box proposal.

- **Revised accept-surface model (§3.2/§5):** narrative boxes are now proposable from chat — Lex tidies a chat answer into a `proposal`, the **box** renders it ("proposed") and Save accepts. The box is the single accept surface for narratives; Title/Keywords keep the chat inline confirm.
- **New/changed:** `lib/lex/orchestrator.ts` (the conductor — runs after every write, makes Lex speak the next step, deterministic fallbacks so no stalls); `lex-client`/`proposal-schema`/`lex` route (narratives proposable); `fields` route returns `{state, messages}`; `state.ts` advances stage→DIAGNOSIS + unlocks Diagnosis; `FieldsPanel`/`CreateIdeaClient`/`page.tsx` (proposed-in-box, server messages, verbatim first-idea intro + separate question bubble, name→firstName). **No schema change** (Sprint-1 additive Neon schema already applied).
- **SHIPPED 21 Jun:** pushed to `Main`; `migrate-lex-fields.ts --apply` run on Neon (**42/56 ideas** migrated, idempotent); **`docs/LEX_PLAYBOOK.md`** added (as-built operational reference — read this + `LEX_REBUILD_DESIGN v.1.md` before any Lex work). **Remaining gate:** validate `/ideas/create` on the preview, then promote to production. Sprints 2–4 (Diagnosis loop, real FTS, Pages 3–4) later per §11.

---

## CURRENT STATE — V29 (UK COMPLETION WAVE, 20 Jun 2026)

**Sprint:** V29 (SPRINT_V29_BRIEF.md). Full account: CHANGE_LOG V29. Pure-additive, orthogonal to the V26 DROP. **§0: legacy `Legislation*` STILL PRESENT on Neon — DROP not fired; untouched.** `scripts/ingest` `tsc --noEmit` **clean (0 errors)**. **11 new corpora / 9 new sourceTypes — all seed POST-PUSH.**

**DONE this session (live data ops POST-PUSH):**
- **§1 ICO/Scottish-courts triage.** The V27-drain failures are transient throttling, NOT dead pages (14/14 ICO + 8/9 scottish-courts re-fetch 200; 1 genuine 404). Adapters hardened with a polite retry (`ico.ts`, `scottish-courts.ts`). Recovery = `v29-triage-fix.ts --apply` POST-PUSH (resets 3,226 ICO + 8 SC to pending; 1 SC 404 → unavailable marker). Dry-run verified.
- **§8 HMRC soft-law audit.** Coverage already ~98% (RCBs 120/120, SoP 182/184, ESC 31/35, VAT Notices 104/106) → only **8 missing leaves**; seed via `v29-hmrc-audit.ts --seed` POST-PUSH.

**BUILT + PILOTED — seed POST-PUSH:**
- **§2 Quango T3 tail** — `v29-seed-quango-t3.ts`; 968 orgs / 25,366 docs measured, 0 guard-paused; closes the org universe to 100% (`quangos-govuk`, OGL).
- **§3 Parliament remainder (4, all OPL3):** `erskine-may` (2,038 sections) · `early-day-motions` (60,737) · `petitions` (~66,075 open+archived) · `members-interests` (3,341, one section/interest). `v29-seed-parliament.ts`.
- **§4 CPS guidance** — `cps-guidance` (270 docs, OGL VERIFIED at /crown-copyright-and-disclaimer). `v29-seed-cps.ts`.
- **§5 Independent reviews** — `independent-reviews` (345 reviews / 675 PDFs, registry ∪ gov.uk discovery, PDF-verified; reuses inquiry-reports machinery). Casey pilot 72,663 words. `v29-seed-independent-reviews.ts`.
- **§6 Exempt orgs:** `ofgem` (12,899 publications, OGL VERIFIED /copyright) · `ofcom` (4,093 pages, `ofcom-open` VERIFIED /about-ofcom/website/terms-of-use). `v29-seed-exempt-orgs.ts` (Railway egress canary first).
- **§7 LGSCO** — `lgsco` (`lgsco-open`, OGL-equivalent VERIFIED /copyright); self-propagating list rows over 10 categories. `v29-seed-lgsco.ts` (egress canary). The clean ombudsman; re-baseline at drain.

**PROBED-V30 (licence/route gated, in OMBUDSMEN_PROBE.md + EXEMPT_ORGS_PROBE.md):** Housing Ombudsman (165,524 decisions — licence unverified, biggest prize) · PHSO (route re-resolve) · Pensions Ombudsman (conditional grant — email) · FOS (restrictive) · Ofwat/BoE (email).

**GATED-ON-CAPTURE:** **§9 POSTnotes** re-probed = FULLY CF-challenged server-side (not less gated than Library). Wired into the V28 §5 seam as a 3rd host (corpus `postnotes`, OPL3) + turn-key `processLibraryBriefings` processor added. post.parliament.uk / commonslibrary / lordslibrary / researchbriefings.files are DISTINCT CF hosts → each needs its OWN `cf_clearance` + research-briefing CPT slug (cf_clearance is host-bound; the brief's "one capture unblocks both" was optimistic).

**POST-PUSH run order:** (1) `seed-rate-limits.ts`; (2) confirm Ingest deploy SUCCESS; (3) `v29-triage-fix.ts --apply`; (4) seed (canary+egress each new host): quango-t3 → parliament(×4) → cps → independent-reviews → exempt-orgs(ofgem/ofcom) → lgsco → hmrc-audit(8 missing); (5) at drain re-baseline + `v29-corpus-status-table.ts` + `v20-licence-backfill.ts` (confirm `ofcom-open`/`lgsco-open` apply).

**DECISIONS WAITING ON CHARLIE:** per-host cf_clearance + CPT-slug captures for POSTnotes/Commons/Lords Library (§9) · Housing-Ombudsman/Pensions/FOS re-use emails (§7) · Ofwat/BoE re-use emails · V26 §6 DROP go (soak; still needs search-thread Lex-grounding repoint) · Railway Hobby downgrade 28 Jun · plus the carried V28 list below.

---

## CURRENT STATE — V28 (SEARCH-RELAY · VOTING · INQUIRIES · SCOTTISH OR · LIBRARY/REVIEWS, 19 Jun 2026)

**Sprint:** V28 (SPRINT_V28_BRIEF.md). Full account: CHANGE_LOG V28. Pure-additive + the search-thread relay during the V26 soak (legacy `Legislation*` rollback path untouched). `scripts/ingest` `tsc --noEmit` clean (only the 4 documented pre-existing unrelated errors — none new).

**DONE + LIVE this session (Neon data ops, no deploy needed):**
- **§1.2 jurisdiction column** on `corpus_sections` (NOT NULL DEFAULT 'uk', metadata-only add + ~399k devolved UPDATE; labels match search `jurisdictionFor()`: ni 204,292 · wales 191,756 · scotland 3,234 · uk 16.15M). Wired into the ingest write path too. **Search thread can switch off its stopgap map.**
- **§1.3 TIME-CRITICAL title/date extraction — COMPLETE + VERIFIED.** 335,595 sectionTitles carried from legacy `LegislationSection` (18.4% of leg+caselaw — the high-signal section/article heading rows; schedule/paragraph sub-units have no legacy equivalent) + 1,708,117 itemDates (gid-year for legislation, `[YYYY]` citation-year for tna-caselaw; `enactmentDate` was 0-populated so gid-year used). **The V26 §6 DROP's title-extraction precondition is now CLEAR.**
- **§2 ops `reseedExhaustedPwdata` FIXED** (index-friendly PK existence check, not a 6.4M-row pull). Verified: pwdata-debates dedup 15.2s (was >60s timeout); 18 backlogged TWFY files recovered automatically post-deploy. Sweep: that was the ONLY broken cron query (census aggregates measured fast, 1.3–3.2s). Goes live at push.

**BUILT + PILOTED — seed POST-PUSH:**
- **§3 division votes** — `division-votes` sourceType, corpora `commons-/lords-divisions-votes` (OPL3). One section per division w/ full member roll-call. Universe 5,603 (Commons 2,333 + Lords 3,270). Both houses piloted end-to-end.
- **§4 inquiry register completed** 21→58 inquiries / 146→197 report PDFs (all PDF-verified). Re-seed = `v24-seed-inquiry-reports.ts --seed` (idempotent +51).
- **§7 Scottish Parliament OR** — `scottish-parliament-or` sourceType. Sitemap enumeration = 5,131 reports (2016–). Per-contribution parser (base + iob pages) PILOTED (337 & 218 contributions). Licence VERIFIED = **SPCB** (`spcb`), not OGL. ~300–500k sections est.
- **§1.1 written-answers split** — `hansard` processor `answers` branch rewritten to one section per Q&A (was ~306k-word date-range blobs). Pilot: 1 window → 1,046 items, max 116 w/item. Re-seed = `v28-reseed-written-answers.ts --seed`. pwdata-wrans untouched.

**SCOPED / GATED:**
- **§5 library briefings — BUILT TO THE GATE.** Commons/Lords Library are WordPress behind a Cloudflare managed-challenge (content endpoints 403; `/wp-json/` root edge-cached only); LDA API dead; no `*-api` host; no web-archive. Capture-ready seam + probe seeder. **Needs Charlie: a `cf_clearance` cookie + the research-briefing WP REST endpoint** (devtools, same as V27 Scottish Courts).
- **§6 independent reviews — SCOPED** (`INDEPENDENT_REVIEWS_UNIVERSE.md`); Casey 2025 probed CLEAN (72,663 words). Build `independent-reviews` V29.
- **§8 exempt orgs — CORRECTION:** **Ofgem = OGL (clean), Ofcom = own-open (clean)** — V27 wrongly marked them own-copyright. Build V29 (own-domain enumerator); ranked Ofgem > Ofcom > Ofwat > BoE.

**POST-PUSH run order:** (1) `seed-rate-limits.ts`; (2) confirm Ingest deploy SUCCESS; (3) `v28-reseed-written-answers.ts --seed`; (4) `v24-seed-inquiry-reports.ts --seed`; (5) `v28-seed-division-votes.ts --seed`; (6) `v28-seed-scottish-parliament-or.ts --seed`; (7) at drain re-baseline + `v28-corpus-status-table.ts` + `v20-licence-backfill.ts`.

**DECISIONS WAITING ON CHARLIE:** library-briefings cf_clearance + CPT-slug capture (unblocks §5) · V26 §6 DROP go (soak ~25 Jun; §1.3 title-gate now CLEAR; still needs search-thread Lex-grounding repoint) · Railway Hobby downgrade 28 Jun · search-thread FTS-scope · V29 builds (independent-reviews, Ofgem/Ofcom exempt-orgs, Scottish OR pre-2016 archive, eur-lex/uk-treaties/inquiry chapter-splits) · (carried) FCL computational-analysis email · FCA Handbook · pwdata licence backfill · BAILII email · Scottish-courts/ICO/quango-T2 V27 seeds still POST-PUSH.

---

## CURRENT STATE — SEARCH S1b + DOCS CONSOLIDATION + RAILWAY LEGSECTION RETIRE (19 Jun 2026)

Three separate workstreams this session, each its own commit (kept OUT of the V27 ingest changes). `tsc --noEmit` on `scripts/ingest` clean (only 4 pre-existing errors in unrelated files: `diag-db`/`run-cleanup` missing `@prisma/adapter-pg`, `test-fca-playwright` missing `playwright`, `v26-pooled-smoke` rootDir — none new).

**1. FTS BUILD (Search S1b) — BUILT, INERT. Charlie triggers the index run.** Full-corpus BM25 on R2 via LanceDB native inverted index. New `scripts/ingest/search/`: `lance.ts` (R2 connect), `corpus-map.ts` (tier + jurisdiction, pure), `build-fts-index.ts` (indexer), `fts-core.ts` (BM25 + query-time title-boost), `fts-query-service.ts` (HTTP), `score-fts.ts` + `gold-queries.ts` (30 gold queries + citation matchers). `@lancedb/lancedb@^0.30.0` + `apache-arrow@^18.1.0` added to `scripts/ingest/package.json`. Reads `NEON_DATABASE_URL` (not `DATABASE_URL`). Brief additions all in: title-boost query-side ~2.5× untuned (no pseudo-titles); jurisdiction map (senedd→wales, ni*, scottish*/scotlawcom→scotland, else uk); **resumable+idempotent indexer** (mergeInsert on PK `id` = no dupes; R2 checkpoint `_search/corpus_fts.checkpoint.json` cursor = resume not restart; phase loading→indexing→done); citation-matcher scoring + eyeball top-20 dump; archetype-D `[GRAPH]` + A/C/D `[INFORCE]` reported as engine-floor, `[BILLS]` scores for real. As-built + run order in `docs/FTS_BUILD_S1b.md` §2A. Dataset `s3://{bucket}/_search/corpus_fts.lance` does NOT exist until the run. **Execution path confirmed (post-build): runs ON RAILWAY** (datacenter→R2 bandwidth; ~124 rows/s on a home connection ≈ 36h) on a **dedicated, isolated `fts-build` service** — NOT the Ingest worker (busy draining + bounced by Ops liveness on `pending>0`) and NOT local `tsx`. Ingest is git-connected to `Main` (RAILPACK, root `scripts/ingest`), so **commit-all.sh precedes the canary**. Driver `scripts/ingest/search/fts-railway-run.ts` (`setup`/`canary`/`full`/`logs`/`teardown`; needs only Neon+R2 creds — the indexer never calls Railway). **Run order:** `commit-all.sh` → `fts-railway-run.ts setup` → `…canary` (report → Charlie decides) → `…full` (resumable; re-run to resume from R2 checkpoint) → `score-fts.ts` (reads finished dataset; local OK) → `…teardown`.

**2. DOCS CONSOLIDATION — DONE.** `scrutinise-docs/*` moved into `docs/` (git mv where tracked; plain mv for the 2 untracked: `GOLD_QUERIES_2.md`→`docs/GOLD_QUERIES.md`, `SPRINT_V27_BRIEF.md`). `scrutinise-docs/` removed. All 144 `scrutinise-docs/` refs across 43 files rewritten → `docs/` (incl. BOTH boot files: root `CLAUDE.md` + `docs/CLAUDE.md`; handoff; briefs; INGEST_PLAYBOOK; CHANGE_LOG; the corpus-status-table + quango scripts that WRITE into the folder; `.ths`; `.ps1`). Gold deduped per Charlie: canonical `docs/GOLD_QUERIES.md` (was `GOLD_QUERIES_2.md`); `GOLD_QUERIES_1.md` stays in `docs/Archive/`. Zero stray `scrutinise-docs`/`GOLD_QUERIES_2` refs remain.

**3. RAILWAY LegislationSection RETIRE — reversible canary DONE; DROP still Charlie's.** All clean (report: `docs/RAILWAY_LEGSECTION_RETIRE_REPORT.md`): S1a EXPLAIN shows the panel on Neon's `LegislationSection_ftsVector_idx` GIN (no Seq Scan); no web runtime path reads Railway (`prisma`/`prismaSearch`→`DATABASE_URL`→Neon; `getRailwayPool` dead in-app, offline scripts only); exact parity (LegislationSection 914,274 / LegislationItem 135,531 on BOTH DBs → nothing lives only on Railway). Executed `railway-legsection-retire.ts --rename` (host-guarded, Railway-only): `LegislationSection` → `LegislationSection_DEPRECATED_2026-06-19`; Neon untouched. Reverse with `--rename-back` (one command). **Rollback-during-soak note:** this mutates the V26 rollback path — a full env-flip rollback would need `--rename-back` first (rest of app DB unaffected). Charlie drops it deliberately after one clean cycle (folds into V26 §6).

**COMMIT PLAN (commit-all.sh, 3 separate commits — NOT entangled with the uncommitted V27 ingest changes, which Charlie sequences separately):** (a) FTS build [now incl. `fts-railway-run.ts` + the corrected §2A run order]; (b) docs consolidation [now sweeps in these handoff/CHANGE_LOG/playbook updates]; (c) Railway-legsection retire. **commit-all.sh APPROVED + run (19 Jun)** — pushed to `Main`; Ingest+Ops auto-redeploy (harmless; FTS code inert). FTS index run still gated: Charlie triggers `setup`→`canary`→(report)→`full` separately.

---

## CURRENT STATE — V27 (BREAKER FIX · SCOTTISH COURTS · QUANGO T2 · EXEMPT-ORG PROBES, 19 Jun 2026)

**Sprint:** V27 (SPRINT_V27_BRIEF.md). Full account: CHANGE_LOG V27. Pure additive ingest during the V26 soak — writes only to `corpus_sections` on Neon (legacy `Legislation*` rollback path untouched; §6 DROP still gated). **Everything BUILT + LOCALLY PILOTED; nothing seeded yet — the new corpora seed POST-PUSH** (new sourceTypes are markSkipped by the live worker until their processors deploy). `tsc --noEmit` clean.

**DONE this session:**
- **§1 breaker-eval FIXED + verified.** Live Ops was throwing `Query read timeout` every 15-min tick since the 18 Jun 21:44 redeploy — `querySourceCounts`'s `corpus_sections GROUP BY` over 17.2M rows exceeds the 60s client timeout (diagnosed from the **Ops deploy logs**, not the misleading `source_status`/lock timestamps). That GROUP BY fed only the unread informational `section_count` column → moved it to read the hourly `corpus_snapshots` (PK-indexed) in a try/catch so the trip evaluation always completes. `v27-breaker-verify.ts`: deliberate failure-trip→clear+recover + zero-output-trip all PASS against the live DB. **Goes live at push.** Also reported (not fixed): `reseedExhaustedPwdata` hits the same timeout class (~8.8M-id pull) → pwdata auto-reseed failing → V28 dedup rework.
- **§2 Scottish Courts BUILT + piloted.** Captured API works server-side with Origin/Referer only (no token); `POST /web/search` (1-indexed, limit 200), `documentLink` → PDF at www.scotcourts.gov.uk. **13,066 judgments**, OGL v3.0 (judiciary.scot/crown-copyright, VERIFIED). Pilot 5/5, avg 6,185 w → **≈13,066 sections / ~80.8M words**. `sources/scottish-courts.ts` + `processScottishCourts` + `v27-seed-scottish-courts.ts` (seeder clears the blocked corpus_target).
- **§3 Quango T2 BUILT + measured.** 40 ALBs (ranks 21–60, broad set) + 24 ministerial depts (narrow `{statutory_guidance,regulation,manual,manual_section}`). Measured **18,320 + 1,788 = ≈20,108 docs**; 0 orgs >5× guard. `v27-seed-quango-t2.ts` (govuk-content, OGL, URL-dedup, utaac/fatality excluded).
- **§4 Exempt-org probes → `EXEMPT_ORGS_PROBE.md`.** Sized ICO/Ofgem/Ofwat/Ofcom/BoE. **ICO the only clear open licence (OGL v3.0)** → BUILT: 26,576 action-weve-taken leaves (mostly FOI decision-notices + PDFs), pilot 5/5 avg 3,090 w → **≈26,576 sections / ~82.1M words**. `sources/ico.ts` + `processIco` + `v27-seed-ico.ts`. Others = ranked V28 list, each gated on a licence check.
- **§5 Scottish Parliament OR — built to the gate.** Recon confirms no open API in static assets; capture-ready seam + `v27-seed-scottish-parliament.ts` dry-run; **waits on Charlie's XHR capture** (~320k est).

**POST-PUSH run order:** (1) `seed-rate-limits.ts`; (2) confirm Ingest deploy SUCCESS before seeding new sourceTypes; (3) `v27-seed-scottish-courts.ts --seed` (canary + Railway PDF-egress check); (4) `v27-seed-ico.ts --seed` (canary + egress); (5) `v27-seed-quango-t2.ts --seed`; (6) at drain `v27-corpus-status-table.ts` + re-baseline + `v20-licence-backfill.ts`.

**DECISIONS WAITING ON CHARLIE:** Scottish Parliament OR XHR capture (unblocks §5) · exempt-org licence verification for Ofgem/Ofwat/Ofcom/BoE (V28) · §6 DROP go (soak, ~25 Jun) · Railway Hobby downgrade 28 Jun · search-thread FTS-scope decision · (carried) FCL computational-analysis email · FCA Handbook licence · pwdata licence backfill · BAILII email.

---

## CURRENT STATE — V26 (UNIFICATION + RAILWAY DECOMMISSION — structural, 16 Jun 2026)

**Sprint:** V26 (SPRINT_V26_BRIEF.md), build input `UNIFICATION_PLAN.md` §4. Full account: CHANGE_LOG V26 + UNIFICATION_PLAN "AS-BUILT (V26)". Operational steps: **`V26_CUTOVER_RUNBOOK.md`**. Site access is closed, so the cutover needs no user write-freeze. Everything below the V25 heading is historical.

**DONE this sprint (ran unattended; two human gates remain):**
- **§1 precondition:** V25 drained corpora rebaselined ✓ (committees-reports 24,876 · committees-evidence 140,567 · niassembly-hansard 196,348 · inquiry-reports 140 · college 332). bills-api + senedd-cofnod were still draining → proceeded per brief §1 (independent data); **both since drained + rebaselined ✓ (bills-api 6,535 · senedd-cofnod 191,730).**
- **Migration A (corpus unification) — DONE + DRAINED + REBASELINED ✓, reversible.** 38,571 non-matching legacy gids → **24,247 genuine gaps** + 14,324 docId-form diffs already covered (ukpga calendar↔regnal 8,514 · uksi regional 4,041 · eur→eudr/eudn/CELEX 1,769). Gaps verified real (99.6% hold legacy text; 25/25 live-TNA fetchable). **Gap-fill (24,246 tna-legislation rows) fully drained → rebaselined ✓:** si-pre-2010 174,552→**419,250** · primary-acts-2000plus 90,838→**145,704** · retained-eu→187,555 · si-2010plus 270,339 · regional→331,124. Licence backfill swept (85 stragglers; new sections got OGL at ingest). **Compilation layer preserved** in `legislation_compilation_enrichment` (26,126 rows, pointer-only; amendment tables were empty).
- **Migration B (app DB Railway→Neon) — PREP DONE.** All app tables already existed on Neon → B.1 = parity verify (clean) + `_prisma_migrations` baseline. **App data copied** (24 tables / 62,394 rows, exact parity; OperationalSection 61,315 the only bulk; FK-topological order — Neon forbids session_replication_role). **Search repointed in code** onto Neon's intact legacy `ftsVector` (both tables 100% populated + GIN-indexed); dual client collapsed (`prismaSearch`→alias of `prisma`); `/legislation-search` moved onto the GIN index (EXPLAIN-confirmed); `directUrl` added. `tsc --noEmit` clean.
- **§4 Railway** holds only `scrutinise-db` + `Ingest` + `Ops` (confirmed via API).

**CUTOVER — DONE + VERIFIED (18 Jun):** Charlie moved the Vercel env to Neon (`DATABASE_URL`→pooled `&pgbouncer=true&connection_limit=1`, `DIRECT_URL`→non-pooled). Verified live (`v26-cutover-verify.ts`): prod `GET /api/legislation/search` → HTTP 200 / 20 items from Neon; **Railway scrutinise-db now shows 0 app connections** (web app fully detached); Neon serves via the pgbouncer pooler. Login (Clerk auth) is Charlie's own final eyeball — DB-independent, and `prisma.user.count()` on Neon pooled already verified. Rollback (if ever needed pre-DROP) = flip env back + redeploy; Railway DB left intact through the soak.

**STILL GATED:**
1. **§6 soak ≥1 week → DROP legacy `Legislation*` (both DBs) + decommission Railway Postgres** — the one irreversible step; separate Charlie go. **Soak clock started 18 Jun → earliest DROP ~25 Jun.** Gated ALSO on the search thread delivering the new `corpus_sections` FTS + the Lex-grounding repoint onto it (so the legacy `ftsVector` can be retired first). Checklist in `V26_CUTOVER_RUNBOOK.md` §6.

**TOTAL at V26 post-drain close:** 16,302,498 compiled / 16,521,390 total sections · **5.06B words** · ~28.75 GB R2 (est) · 7.00 GB Neon heap (was V24 15.58M / 4.83B). Per-corpus table → `CORPUS_STATUS_V26.csv`.

**IN FLIGHT / NEXT SESSION:**
1. ✅ Gap-fill drained + rebaselined ✓ + licence-backfilled + workbook table emitted (17 Jun); ✅ cutover executed + verified live (18 Jun).
2. **Soak watch (→ ~25 Jun):** keep an eye on prod for any DB-move regressions; Railway DB stays intact + running as the rollback path until the DROP.
3. **§6 DROP (after soak):** needs the search thread's new `corpus_sections` FTS + Lex-grounding repoint first (retire legacy `ftsVector`), then verified Neon backup → drop legacy `Legislation*` (both DBs) + decommission Railway Postgres. Charlie's separate go.
4. Scottish XHR capture still outstanding (ingest, not migration).

**DECISIONS WAITING ON CHARLIE:** B.5 cutover go · §6 DROP go · Scottish SpOpenData XHR · Railway Hobby downgrade 28 Jun · (carried) College fresher route · FCL computational-analysis email · FCA Handbook licence · pwdata licence backfill · BAILII email · V26 search-thread FTS-scope decision.

---

## CURRENT STATE — V25 (FEED THE MACHINE: Senedd · College · Bills · inquiry expansion · licence compliance, 16 Jun 2026)

**Sprint:** V25 (SPRINT_V25_FEED_BRIEF.md). Full account: CHANGE_LOG V25. Pure additive ingest — zero structural-DB risk (structural unification is now V26, gated on the FTS decision + production gates). Queue ran dry ~14 Jun (0 pending at open). Everything below the V24 heading is historical.

**BUILT + LOCALLY PILOTED this session (predict-measure-commit); NEW sourceTypes seed POST-PUSH:**
- **§2 Senedd Cofnod ✓ built+piloted+licence-VERIFIED.** `record.senedd.wales/Plenary/{id}` (custom .NET, no CF), enumerated by redirect-classified meeting-id scan; one section per English speaker-turn (bilingual — prefer `translation`). Licence OGL v3.0 (Charlie verified the Senedd copyright page; supersedes the V24 "g**oogl**e" false positive). PILOT: 254–259 sections/plenary, ~847 plenaries → **PREDICTION ≈217k sections / ~30M words**. `sources/senedd-cofnod.ts` + `processSeneddCofnod` + `v25-seed-senedd-cofnod.ts`.
- **§3 College of Policing ✓ built+piloted.** UK Gov Web Archive 2022 snapshots (live site CF-blocked, fresh snapshots are JS shells). CDX enumerates `app-content*`, content via the `id_` raw-capture route. **332 distinct APP pages** (the ~8k placeholder was a rough overestimate), avg ~2,431 words/page → **PREDICTION ≈332 sections / ~0.81M words**. Licence `college-nc` → **commercial-surface excluded**. `sources/college-policing-archive.ts` + `processCollegePolicing`.
- **§4 Bills API ✓ built+piloted.** `bills-api.parliament.uk` (3,914 bills). Two-stage `list:{billId}` → per-PDF rows (bill 3774 alone = 267 PDFs); **files[] Download route only** (links[] are unreliable). Licence OPL v3.0. PILOT: avg 3.3 files-PDFs/bill, 100% extract → **PREDICTION ≈13k sections / ~9.4M words** (the ~5k placeholder undershoots — amendment papers dominate). `sources/bills-parliament.ts` + `processBills`.
- **§5 Public inquiries — register 8 → 21 inquiries / 53 → 146 report PDFs.** 13 verified concluded inquiries added to `INQUIRY_REGISTRY` (Saville 11, Al-Sweady 50, Grenfell P2 12, Mid Staffs, IICSA, Litvinenko, Baha Mousa, Zahid Mubarek, Hillsborough, Victoria Climbié, Azelle Rodney, Rosemary Nelson, Equitable Life). Re-run `v24-seed-inquiry-reports.ts --seed` POST-PUSH (idempotent, +93 rows).
- **§6 Scottish — built to the gate, SEEDS NOTHING.** HTML route live; SpOpenData API key still not captured (none in session prompt). `sources/scottish-parliament.ts` + `v25-seed-scottish.ts` report the blocker. Did NOT guess the key.
- **§7 LICENCE_COMPLIANCE.md created** — Find Case Law serving-layer hard requirements (auth-only judgment text, noindex/robots, no open/3rd-party API over judgment text or extracts, no open-web publication of derived extracts) + the NC commercial-exclusion set + fca-restricted. Recorded, not enforced (ingest only).
- **§1 carry-over:** divergence fix (§1.1) + CSV TOTAL-row drop (§1.3) were already in HEAD `96d150f`; §1.2 rebaseline is POST-PUSH (`v25-rebaseline.ts --classify-failed --confirm`).

**POST-PUSH — DONE this session (deploy confirmed; Ops auto-started the worker):**
- rate-limits upserted (4 new sourceTypes).
- **inquiry-reports ✓ drained:** 146 rows → 140 compiled / 14.56M words (6 markers).
- **college-of-policing ✓ via LOCAL ingest:** the worker hit a Railway-egress BLOCK on `webarchive.nationalarchives.gov.uk` (257/332 "archive fetch failed"; 200 from a residential IP). `v25-ingest-college-local.ts` ingested all **332 / 840,308 words** locally. Future re-seeds use the local path. **NEW Railway-blocked host recorded.**
- **senedd-cofnod ✓ seeded + processing on the worker:** enumeration bug fixed (conc-6 throttling → false gaps + a Neon DNS blip; first run found only 396). Re-run at conc 3 with retries + insert-retry found **713 plenaries**, all seeded. record.senedd.wales IS Railway-reachable (no CF) — worker grinding (27 meetings → 6,849 sections at check, ~254/meeting, 0 fails).
- **bills-api seeded + grinding:** 3,919 `list:{billId}` rows; per-PDF child rows + sections appear as the worker reaches modern (high-billId) file-rich bills (early low-billId bills are legacy links[]-only → 0 files).
- **scottish:** gated, seeds nothing.

**IN FLIGHT / NEXT SESSION:**
1. bills-api + senedd-cofnod finish draining → `v25-rebaseline.ts --classify-failed --confirm` (the §1.2 four + new corpora; senedd ~713 plenaries × ~254 ≈ ~180k, bills TBD, college 332); re-run `v20-licence-backfill.ts`; regenerate `v25-corpus-status-table.ts`.
2. Scottish (parliament + courts) waits on Charlie's SpOpenData XHR capture; College follow-up = a rendered/API content route fresher than 2022; inquiry dark-site report-PDF Web Archive adapter (Manchester Arena/Undercover/Shipman own domains).
3. V26 = structural unification + Railway decommission (gated on the FTS-scope decision + the two production gates).

**DECISIONS WAITING ON CHARLIE:** Scottish-parliament + Scottish-courts SpOpenData devtools XHR (same technique unblocks both) · College of Policing fresher content route · FCL computational-analysis email · FCA Handbook licence · pwdata licence backfill · BAILII email · written-answers month-blob deletion · V26 FTS-scope decision.

---

## CURRENT STATE — V24 (REBASELINE + BREAKER FIX + EMAIL HONESTY + NI ASSEMBLY + INQUIRIES + UNIFICATION SPEC, 14–15 Jun 2026)

**Sprint:** V24 (SPRINT_V24_BRIEF.md). Full account: CHANGE_LOG V24. Everything below the V23 heading is historical.

**TOTAL at close:** 15,577,221 compiled sections / **4.82B words** (15,770,435 incl. classified residue; V23: 12.56M / 4.05B). Per-corpus table → `CORPUS_STATUS_V24.csv` (R2 ~27.4 GB est, Neon heap 6.76 GB). **The email no longer shows a % (Charlie-directed §3)** — two hard numbers + a completion count + a labelled projection.

**DONE this sprint:**
- **§1 — 7 corpora ✓ re-baselined** (`v24-rebaseline.ts --confirm`): retained-eu 186,371 · si-2010plus 270,339 · explanatory-notes 410 · explanatory-memoranda 5,420 · historic-hansard 4,641,085 · ni-judgments 7,772 · quangos-govuk 86,547. Transient failures reset+drained; 2 deterministic historic-hansard gapday misses classified `skipped`. **committees-reports (47.6k pending) + committees-evidence (~4.9k pending + 83 failed) still draining → ✓ next session.**
- **§2 — zero-output breaker FIXED at the worker.** New `ingest_queue.produced_output` (per-row verdict via `AsyncLocalStorage` in `process-row.ts`; counts compiled writes, r2Exists confirmations, and markers — so idempotent reseeds no longer read as empty). `ops.evaluateBreakers` trips on the trailing all-empty run (24h window, threshold 25), not cross-sweep deltas. Verified against tna-legislation + committees reseeds (no false trip) and the curl-broken case (still trips) — `v24-verify-breaker.ts`, production untouched. Column migrated live (`v24-migrate-produced-output.ts`).
- **§3 — email >100% headline retired** (`progress-reporter.ts`): subject + TOTAL block now exact sections + words + completion counts + labelled projection.
- **§4.1 NI Assembly Hansard — BUILT + piloted + SEEDED + verified live.** Licence VERIFIED OGL v3.0; IIS host (no CF, Railway-safe). Pilot: 646 reports, ~482 sections/report → **PREDICTION ≈311,157 sections / ≈48.4M words**; canary CONFIRMED post-deploy (3 reports → 1,445 sections / 224,732 words). `sources/niassembly-hansard.ts` + `processNiAssemblyHansard` + seeder; all 646 rows seeded post-deploy, grinding. (A premature mid-sprint seed had the OLD worker markSkipped 95 rows in ~2 min → deleted all 646, re-seeded only after the new deployment was confirmed SUCCESS; lesson logged in playbook.)
- **§4b College of Policing:** licence RESOLVED = **Non-Commercial College Licence** (`college-nc`, verified via 2026-02-03 web-archive snapshot). Content route BLOCKED — fresh archive snapshots are Drupal JS-SPA shells; only 2022 snapshots have static text (~4yr stale). **No seed; recommend Playwright/JSON-API or a direct permission email.**
- **§4.2 Senedd/Scottish:** neither meets the seed condition — Senedd route confirmed but **licence unverified** (the "ogl" footer match was "g**oogl**e"); Scottish API still needs Charlie's XHR. No seed.
- **§5 Public inquiries — `inquiry-reports` sourceType BUILT + SEEDED + verified live.** Per-PDF rows (timeout-safe). **8 concluded inquiries → 53 report-volume PDFs seeded → 51 compiled sections / 6.55M words** (2 markers; Iraq/Chilcot vols huge), OGL v3.0 via gov.uk attachments. Grenfell/dark-site adapter = follow-up.
- **§6 `UNIFICATION_PLAN.md` DELIVERED** (spec only): legacy LegislationSection inventory, 71.5% measured overlap with corpus_sections, conversion (A) + app-DB Railway→Neon (B), <15 min downtime, minutes rollback.

**POST-PUSH — DONE this session** (commit `fe4d15f`+`623d386` pushed; Railway Ingest deployment `623d386` confirmed SUCCESS via the deployments API before seeding, so no skip-race):
1. ✅ `seed-rate-limits.ts` — niassembly-hansard 1000ms/2, inquiry-reports 500ms/3 added (30 entries).
2. ✅ `v24-seed-niassembly-hansard.ts --canary 3` then `--seed` — **canary verified live: 3 reports → 1,445 compiled sections / 224,732 words** (≈482/report, matches the pilot exactly; Railway egress on the IIS host confirmed). Full 646 rows seeded — grinding toward ~311k.
3. ✅ `v24-seed-inquiry-reports.ts --seed` — 53 report PDFs seeded → **51 compiled sections / 6.55M words** (2 markers; Iraq/Chilcot volumes are huge), inquiry-reports corpus_target upserted est=53.
4. ✅ Verified: 0 tripped breakers; the new per-row breaker is live and recording `produced_output` verdicts. Re-baseline niassembly/inquiry when drained (next session).

**IN FLIGHT / NEXT SESSION:**
1. committees-reports + committees-evidence drain → ✓ (clear the 83 committees-api AggregateError failures first); then re-run `v24-rebaseline.ts --confirm`.
2. Post-push NI Assembly + inquiry seeds drain → ✓ re-baseline (niassembly-hansard est currently the V23 placeholder 270k; pilot says ~311k).
3. Devolved follow-ups: Senedd licence verification (Welsh Parliament licence page, not the homepage footer) → build; Scottish needs Charlie's SpOpenData XHR; College needs a rendered/API content route.
4. Re-run `v20-licence-backfill.ts` after drains (NULL stragglers; new corpora niassembly/inquiry licences applied at ingest via the map).

**DECISIONS WAITING ON CHARLIE:** Scottish-courts + Scottish-parliament SpOpenData devtools XHR (same technique unblocks both) · Senedd licence (verify the Welsh Parliament licence page) · College of Policing content route (Playwright/API or direct permission email) · FCL computational-analysis email · FCA Handbook · pwdata licence backfill · BAILII email · written-answers month-blob deletion.

---

## CURRENT STATE — V23 (V22 CLOSEOUT + ORAL EVIDENCE + QUANGO T1 SEED + DEVOLVED/INQUIRY SCOPING, 13 Jun 2026)

**Sprint:** V23 (SPRINT_V23_BRIEF.md). Full account: CHANGE_LOG V23. Everything below the V22 heading is historical. Session note: switched models mid-sprint (Fable 5 → Opus 4.8) with full transcript continuity — no state lost.

**TOTAL at close:** 12,558,897 compiled sections / **4.05B words** (V22 ~9.87M / 3.46B). Denominator 14.79M, 29/53 ✓ → headline ~84.9% (honest-lower from new placeholders).

**DONE this sprint:**
- **S5L Lords listing walk was CF-blocked → switched to ENUMERATION.** The WebForms listing path IP-penalty-boxes for minutes after any burst (undici + curl both 403 on page 1, box outlives 4-min cooloff). The zip path is CF-free (V21-proven), docIds deterministic, no `_a/_b`/`P1` splits in range → `v22-seed-lords-hansard.ts` enumerates P0 vols 1-606; worker PK-checks soft-404 gaps to markers. **Canary PASSED** (S5LV0100P0 → 2,408 sections, 1936 date proves the deployed Lords-1999 cutoff). 578 rows seeded, **tranche grinding** (754 done, S5L 110,441 sections, at 1981 → 1999). Resumable curl walk built + kept for future series.
- **Gap-fill seeded:** 113 gapvol rows (S3 40 · S4 57 · S5C 16). 1 S5L HTML gap volume absorbed as a marker (noted).
- **⚠️ tna-legislation breaker FALSE-POSITIVE cleared:** tripped on 838 idempotent re-runs (already-held sections → 0 COUNT growth ≠ 0 output), parked 108,349 rows; root cause verified, cleared per §8, unparked, did not re-trip. **Recommend breaker fix** (track empty done-rows at the worker, not aggregate count growth).
- **✓ re-baselines:** echr-hudoc 4,410 · tax-tribunals 12,089 · nao-reports 2,570 · lawcom 262 · primary-acts-pre-2000 165,438 (ukpga cleanup ran). uksi enum (7) reset + drained.
- **Oral evidence COVERED (§2):** OralEvidence is a distinct committees-api type, already ingested — 14,820 `oralevidence:*` sections (committees-evidence, opl-3.0), R2-verified clean transcripts. Not a gap.
- **Quango T1 SEEDED (§3):** 41,321 `quangos-govuk` rows (42,942 measured − URL-dedup), grinding (76,461 sections at close).
- **Devolved (§4) PROBED+SIZED, build V24:** NI Assembly AIMS API build-ready (646 reports 2012-2026, ~250-300k, cleanest); Senedd record.senedd.wales (~150-250k); Scottish parliament.scot HTML + hidden SpOpenData API (~250-400k, hardest). Placeholders + licence-map entries added.
- **Inquiries (§5):** `INQUIRIES_UNIVERSE.md` register built (~35 inquiries, ~40-70k reports-only). Infected Blood probe = 9 PDF report vols on gov.uk (CF-free OGL, route verified, NOT seeded — needs `inquiry-reports` sourceType, V24).
- **Small probes (§6) SIZED:** ONS 11,177 gov.uk docs (marginal); OBR 61 (trivial/foldable); pre-2010 committees ~10-20k (CF-blocked, depth gap named).

**IN FLIGHT / NEXT SESSION:**
1. Drains → ✓ re-baseline (`v23-rebaseline.ts --confirm`, guarded): retained-eu, si-2010plus, regional, EN/EM (now unblocked, draining), committees-reports/evidence, ni-judgments, **historic-hansard (re-baseline only when 1803-1918 + Lords tranche + gap-fill ALL drain — single corpus)**.
2. EN/EM (11,424) were never processed (blocked behind retained-eu since V20) — verify they produce content now that they're unparked.
3. Re-run `v20-licence-backfill.ts` after drains (NULL stragglers).
4. **V24 candidates:** NI Assembly Hansard build (turn-key); inquiry-reports sourceType (Infected Blood first); Senedd/Scottish builds; quango T2/T3.
5. **Breaker fix:** zero-output breaker false-trips on idempotent reseeds — track genuinely-empty done rows at the worker.

**DECISIONS WAITING ON CHARLIE:** devolved licences (3, expected OGL — verify) · FCL computational-analysis email · FCA Handbook · pwdata licence backfill · Scottish-courts + Scottish-parliament SpOpenData devtools XHR (same technique unblocks both) · written-answers month-blob deletion · BAILII email.

---

## PREVIOUS STATE — V22 (REPAIRS + SECOND HANSARD CENTURY + WORD COUNTS + QUANGO DRY-RUN, 13 Jun 2026)

**Sprint:** V22 (SPRINT_V22_BRIEF.md). Full account: CHANGE_LOG V22. Everything below the V21 heading is historical.

**DONE this sprint:**
- **committees-api repaired:** deep-offset server 500s (~31s timeout, load-dependent) killed the WrittenEvidence walk — replaced with date-windowed `list:…:win:{YYYY-MM}` rows. Breaker cleared, **56,518 item rows unparked + draining**, 1,239 offset list rows retired. Windows seeded post-push (`v22-seed-writtenevidence-windows.ts`).
- **judiciaryni repaired:** transient IP-cut + the AdaptiveThrottle suspend path was DEAD CODE everywhere (ceiling 30s < threshold 60s — fixed, plus 403/socket backoff) — rate halved 2000ms/1; listing got the list-row treatment (`list:page:{N}`, pages 96–396). Breaker cleared + 332 failed reset POST-PUSH (`v22-seed-judiciaryni-list.ts` then the SQL).
- **Enum repairs found real universe:** si-2010plus enum seeded **11,852 missing instruments** (the V12 never-run reseed); regional enum seeded 6,435 (incl. asc/mwa). 7 dense uksi years re-throttled — reset at close, verify drained next session.
- **HUDOC revived:** working grammar (`contentsitename:ECHR AND respondent:"GBR" AND languageisocode:"ENG"` = ✓4,471, browser UA + Referer, kpdate sort), PDF-conversion text route, one-judgment probe PASSED end-to-end (19,283 words, licence `echr-nc` VERIFIED live). Seed post-push: `v22-seed-echr-queue.ts --canary 5` (Railway egress unverified!) → full.
- **Lords Hansard 1919–1999:** per-house cutoffs — Lords cuts at **1999-11-17** (first pwdata-lords file; S5L vol 607 starts that exact day). S5L cap 32 → 606. Pilot scored: 1936 vol 2,408 items/462k words; 1999 vol 7,076/806k, 0 ≥ cutoff. R2 batch 16 (timeout headroom for fat volumes). Seed post-push: `v22-seed-lords-hansard.ts` (~574 vols ≈ +2.3M sections est).
- **Hansard gap-fill:** V21's "169 exist on the HTML site" was WRONG — measured **114 fillable of 170 missing** (56 genuinely lost; S1/S2 wholly unfillable). Two-stage crawl built (`gapvol:`/`gapday:` rows, sourceType `historic-hansard-html` 500ms/2). Seed post-push AFTER the Lords seeder: `v22-seed-hansard-gapfill.ts`.
- **Word counts:** already exact at ingest for every compiled section (the brief's backfill was unnecessary — NULLs are only unavailable markers). **Total 3.456B words.** Email TOTAL block now prints the words line.
- **Quango T1:** tiers unconfirmed → seeder built (`v22-seed-quango-t1.ts`, --seed gated), live dry-run done: **T1 = 42,942 docs**. ⚠️ HMCTS (515) and UTAAC (0) are gutted by the utaac_decision/fatality_notice exclusions — Charlie to confirm slot replacement.

**POST-PUSH RUN ORDER (this session if push lands, else next):**
1. `seed-rate-limits.ts` (judiciaryni 2000/1, historic-hansard-html new).
2. NI: clear breaker + reset 332 failed (playbook §8 SQL) → `v22-seed-judiciaryni-list.ts`.
3. `v22-seed-echr-queue.ts --canary 5` → verify sections + Railway egress → full seed (unblocks echr-hudoc, est 4,471).
4. `v22-seed-lords-hansard.ts` (S5L re-list + seed) → THEN `v22-seed-hansard-gapfill.ts` (asserts the lifted-cap checkpoint).
5. `v22-seed-writtenevidence-windows.ts` (~163 window rows).
6. Reset the 7 throttled uksi enum rows after cooloff.

**IN FLIGHT / NEXT SESSION:**
1. Drains → ✓ re-baseline per §1c: retained-eu (~74k), historic-hansard (1803–1918 tail + Lords tranche + gap-fill — single corpus, re-baseline when ALL drain), committees-reports/evidence (56k + windows), si-2010plus (11,852 + 7 enum years), regional (6,435), EN/EMs, tax-tribunals, nao, ni-judgments, echr-hudoc.
2. ukpga enum drained → run `v19-cleanup-ukpga-calendar.ts` → primary-acts-pre-2000 ✓.
3. si-2010plus enum drain → re-run `seed-explanatory-queue.ts` (idempotent; new SIs need EM rows).
4. Re-run `v20-licence-backfill.ts` after drains (NULL stragglers).
5. Quango T1 seed once Charlie confirms tiers (`v22-seed-quango-t1.ts --seed`).
6. Corpus unification + Railway-DB migration: structural-sprint readiness — no blocker found this sprint; the queue patterns (list:/enum:/win:/gap*) are stable and documented.

**DECISIONS WAITING ON CHARLIE:** quango tier confirmation (incl. HMCTS/UTAAC slot question) · FCL computational-analysis licence email · FCA Handbook licence · pwdata licence backfill · Scottish-courts devtools XHR · written-answers month-blob deletion.

---

## PREVIOUS STATE — V21 (QUANGOS MEASURED + HISTORIC HANSARD + HONEST DENOMINATOR, 12 Jun 2026 evening)

**Sprint:** V21 (SPRINT_V21_BRIEF.md). Full account: CHANGE_LOG V21. Everything below the V20 heading is historical.

**DONE this sprint:**
- **Quango universe MEASURED:** `docs/QUANGO_UNIVERSE.md` + `.csv` — 1,255 orgs, 904,989 total docs, **162,004 relevant-format docs** (AAIB 11,732 · HMRC 8,487 · EA 7,639 top the table). `quangos-govuk` placeholder in corpus_targets. **No content seeded — Charlie triages the table for V22.**
- **Historic Hansard 1803–1918 BUILT + PROBED:** `sources/historic-hansard.ts` (bulk volume zips, hansard_v12 parser, per-speech pwdata-shaped items, exact 1919-02-04 cutoff = pwdata handoff), `processHistoricHansard`, `seed-historic-hansard-queue.ts` (--canary). Pilot S1V0001P0: 1,597 sections end-to-end in Neon+R2, OPL verified, 49s/volume. Universe ~763 volumes ≈ ~1.1M sections. Host soft-404s (listing = universe; PK magic checked). Rate 5000ms/2.
- **Honest denominator (playbook §1d):** blocked targets now count, retired never (the retired LDA rows were double-counting 722k). Placeholders: scottish-courts ~20k, college-of-policing ~8k, echr-hudoc 4,471 (V20 measured, was 30,050), bills-api ~5k, financial-corpus NULL/unsized. **Headline 91.3% → 88.0% (denominator 12.61M).**
- **SSRN re-classified:** api.ssrn.com serves 200 JSON unauthenticated now (V20 hard-403 was transient WAF state) — **stays PARKED on licence grounds** (author copyright).

**POST-PUSH (done this session):** canary PASSED from Railway (CF serves Railway IPs on hansard-archive); **universe MEASURED 595 zips / 594 distinct vols** (not the nominal 763 — real digitisation gaps; HTML-crawl gap-fill of the 169 missing vols is a V22+ candidate); est re-baselined **~850k**; **full seed done, grinding** (4 done / 589 pending at close, ~10–20h). One incident: CF 403 on the S5C listing walk at page 24 → seeder fixed (60s-cooling retries + stop-at-volume-cap, committed post-push).

**IN FLIGHT / NEXT SESSION (V20 carry-overs unchanged):**
1. retained-eu ✓ at drain; committees WrittenEvidence `list:` rows draining; NI seeder resume from checkpoint (page 66 hard-cut); si-2010plus ✓ at enum drain → re-run `seed-explanatory-queue.ts`.
2. ukpga regnal enum drain → `v19-cleanup-ukpga-calendar.ts` → primary-acts-pre-2000 ✓; regional enum drain → ✓.
3. New V20 corpora ✓ at drain; re-run `v20-licence-backfill.ts` after drains.
4. **historic-hansard ✓ re-baseline at drain** (~10–20h grind from full seed).
5. V22 candidates: quango triage (Charlie) · HUDOC revival (routes in V20 §3.6, measured universe 4,471) · **Lords Hansard 1919–1999** (bulk archive holds it; new named hole) · regional-act EN/EMs.

**DECISIONS WAITING ON CHARLIE:** unchanged from V20 (FCL computational-analysis licence email; FCA Handbook licence; pwdata licence backfill; Scottish courts devtools XHR; written-answers month-blob deletion) **plus:** quango triage of QUANGO_UNIVERSE.md.

---

---

## SEARCH PROJECT — S0 AUDIT COMPLETE (12 Jun 2026)

Read-only audit done; all measured numbers + extrapolation arithmetic in **`docs/SEARCH_AUDIT.md`**. CHANGE_LOG "SEARCH S0" entry has the digest. The headline facts the design doc must reckon with:

- **Full-corpus FTS-in-Neon (10.5M tsvectors + GIN) ≈ 15.2–15.8 GB vs ~10.5 GB free headroom — over budget by ~5 GB** (pwdata ≈ 11 GB of it). The **legislation+caselaw scope (~1.05M rows) ≈ 3.8 GB — fits.**
- corpus_sections has NO functioning FTS (no-op trigger since V3; 266 MB GIN over 6.8% relic vectors; no web code reads the table). Legacy `LegislationSection` (914k) carries the live search: Lex grounding via `/api/search` (Neon GIN) + LegislationPanel via an **un-indexed seq-scan path on Railway**; the legacy table is duplicated in full on both DBs; its embedding vector(768) column exists with 0 rows.
- Corpus text ≈ 17.4 GB (debates 6.2 + caselaw 5.6 dominate). pgvector 0.8.0 installed (halfvec OK); pg_search BM25 available-not-installed. Full-corpus embeddings don't fit in Neon in any §5 configuration; the 1.2M scope mostly fits.
- 100k-row latency is network-floor (server 0–18 ms warm) — a 1M+ sample is needed before trusting FTS-in-Neon latency at scale.
- Needs Charlie: Neon compute CU/autoscale range from the console (no API key locally).

**Next: search design doc — architecture decided WITH Charlie (S0 made no recommendations).** Scratch table dropped (0 remain); production untouched (evidence in SEARCH_AUDIT §8). INGEST_PLAYBOOK unchanged — no ingest doctrine touched.

---

## CURRENT STATE — V20 (THE PROBE WAVE, 12 Jun 2026)

**Sprint:** V20 (SPRINT_V20_BRIEF.md). Full account + per-probe scorecards: CHANGE_LOG V20. Everything below the V19 heading is historical.

**DONE this sprint:**
- **Licence metadata live:** `corpus_sections.licence`/`attribution` columns; map in `shared/licence-map.ts` + INGEST_PLAYBOOK §18; applied at ingest; 1.07M rows backfilled. **pwdata backfill deferred (Charlie: ~4–5GB MVCC churn for uniform OPL).**
- **Five sources built + auto-upgraded** (seed post-push): committees-api (193,238 docs — CF-free API; Railway-egress canary first), tax-tribunals (13,037, continuously updated, .doc via word-extractor), explanatory-notes/-memoranda (EN/EM "intention layer", rides the tna-legislation budget), lawcom (240), nao-reports (2,755, nao-nc licence), ni-judgments (~5,900).
- **Classified:** HUDOC alive again (routes in CHANGE_LOG V20 §3.6 — revival V21); historic Hansard 1803–1918 = 763 bulk XML volumes ≈ ~1.1M sections (v12 parser is V21); Scottish courts BLOCKED (authed Azure API — Charlie: 5-min browser devtools XHR inspection would unblock); SSRN parked (hard WAF 403).
- **Partials audit:** building-regs/planning-policy were 791-doc duplicates of hmrc-tiins (V2 seed-before-push default-branch bug) — deleted + reseeded correctly; college-of-policing was 1,944 unfiltered-search junk — deleted + blocked; sentencing-council ✓ 253 (was complete; V13 ~381 was pre-dedup); nilawcom ✓ 17 (site dead); written-statements retired.
- **V19 closeout:** et-decisions ✓ 293,399 (+4 residue) — prediction 140–200k overshot 1.5–2.1×; uk-treaties ✓ 3,250 (+14); regnal + regional enumeration moved into the QUEUE (`enum:{type}:{year}` rows → Railway IPs; TNA penalty-boxes the local IP for any sustained enumeration — incident in CHANGE_LOG V20 §4); **asc + mwa were missing from the regional type list since forever** (now seeded).
- **Email honesty:** TOTAL % labelled "of ENUMERATED universe" + unenumerated-sources list.

**POST-PUSH (done same session):** canaries PASSED from Railway (committees-api CF-free — blocker dead); breaker cleared + 2,538 portal rows retired; seeded tax-tribunals 13,037 / lawcom 240 / nao 2,755 / EN 560 + EM 10,864 / tna-enum 1,246 (+ si-2010plus enum 17 — **NEW finding: si-2010plus holds only 5,899 distinct instruments; the V12 "2015–2026 reseed" never ran**); licence sweep re-run. Committees (~59k of 193k) + NI (~1.3k) seeders are checkpointed — rerun their seed scripts to resume if they stopped short.

**IN FLIGHT / NEXT SESSION:**
1. **retained-eu** still draining (~93k pending at close) → ✓ re-baseline at drain (playbook §1c).
1b. **Committees fully seeded queue-driven** (Publications + Oral complete; WrittenEvidence via `list:` rows from Railway — commit `6e30c54`). **NI seeder resume** from checkpoint (judiciaryni hard-cut the local IP at page 66; 1,279 of ~5,900 seeded — give it the list-row treatment if it keeps failing). **si-2010plus ✓ at enum drain, then re-run `seed-explanatory-queue.ts`** (idempotent — newly-found SIs need EM rows).
2. **ukpga regnal enum drain** → run `v19-cleanup-ukpga-calendar.ts` (5,840 chrome + 1,057 dead markers) → primary-acts-pre-2000 ✓.
3. **regional enum drain** → ✓ re-baseline.
4. New corpora ✓ at drain: committees-reports/evidence, tax-tribunals, lawcom, nao-reports, ni-judgments, explanatory-notes/-memoranda, building-regs (21), planning-policy (64).
5. Re-run `v20-licence-backfill.ts` after the drains (sweeps any NULL stragglers).

**DECISIONS WAITING ON CHARLIE (V20 additions):**
- **FCL Open Justice Licence v2.0 EXCLUDES computational analysis** (indexing/bulk/ML). Apply for TNA's computational-analysis licence: caselawlicence@nationalarchives.gov.uk (pairs with the BAILII email errand).
- **FCA Handbook**: reproduction requires an FCA licence agreement (fca.org.uk/legal) — 3,661 sections flagged `fca-restricted`.
- **pwdata licence backfill** (8.8M rows ≈ 4–5GB churn) — run or leave to the map?
- **Scottish courts**: open scotcourts.gov.uk/judgments/ with browser devtools → Network tab → copy one `api.pa.web.scotcourts.gov.uk` request's headers (the auth key) → unblocks the build.
- **written-answers/-statements legacy month-blobs** (272 rows, the tsvector-1MB offenders): delete?
- Carried from V19: OECD (position now logged in CHANGE_LOG V20 §2 — confirm), historic tax tribunals (now BUILT), committees local-fetch (MOOT if the API canary passes).

---

## PREVIOUS STATE — V19 (P1 TO 100% + PARLIAMENTARY RECORD + TAX COMPLETENESS)

**Active branch:** Main. **Sprint:** V19 (SPRINT_V19_BRIEF.md, archived at sprint close). Politeness doctrine now governs all rates: **a 5xx storm is a rate signal — halve and document** (playbook §1b). Three sources were halved this sprint: twfy-pwdata 1000ms/5, govuk-content 300ms/5, local TNA enumeration floor 500ms.

**DONE + ✓ (measured denominators):**
- **Parliamentary record COMPLETE** — 297 failed pwdata rows retried clean at halved rate; all 7 denominators ✓ at measured: **8,800,253 compiled sections** (V18 prediction ~9.8M, range 8–11M: within range). wrans "60.9%" was estimate error.
- **hmrc-manuals ✓** 69,136 + 16,061 classified residue (contents/index nodes — NOT missing content; brief's "zero-section rows" classified).
- **hmrc-ancillary ✓ 457** (RCBs/SoPs/ESCs/VAT+excise notices, NEW P1) · **tax-treaties-dta ✓ 324** (NEW P1) · **uk-treaties unblocked** → gov.uk international_treaty (1,519 seeded P3; FCO client in attic).
- **bailii-eat / bailii-tribunals / bailii-privy-ni retired** → FCL court feeds + et-decisions. NI stays parked.
- **tna-caselaw ✓ 74,896** — all 180 FCL court pages processed under V19 code; per-court tribunal coverage proven (+22 sections; the global feed already had ~everything FCL holds).
- **lda-commonsoralquestions ✓ 69,529** — closed; ~500 delta vs LDA totalResults is source-side phantom (deprecated API; full text in pwdata).
- **si-pre-2010 ✓ 174,552 + 1 classified residue** — AI-era failed relics fixed/removed; 1958 SI classified metadata-only.
- **et-decisions (NEW P3):** 131,668 gov.uk ET decisions seeded; resumed post-cooloff with zero new 429s (~125k pending, ~11h).

**IN FLIGHT / POST-PUSH CHECKLIST:**
1. ✅ V19 code deployed (pushed 16:48; the 18:46 Ops-liveness `serviceInstanceRedeploy` built from post-push Main — running since ~18:48 with the rate-limiter fix + 429/503 suspend).
2. ✅ gov.uk cooloff observed (4.4h quiet); breaker cleared, 117,781 blocked unparked + 8,554 429-failed reset (et-decisions + uk-treaties) — 11 Jun ~20:55.
3. ✅ 180 court-page rows reset to pending; `si-pre-2010:uksi/1958/1156` requeued.
4. ⏸ **`v19-seed-ukpga-regnal.ts` DEFERRED to next session** — TNA has penalty-boxed the LOCAL IP after three enumeration runs today (instant 429 backoff to 16s even at a 1000ms floor; process killed by PID, verified dead). Run tomorrow with `TNA_THROTTLE_FLOOR_MS=1000`; sanity-check the enumerated universe (~10k+ acts expected — a visibly small count means TNA was still throttling; the script is single-shot, rerun it). Also note the seeder requeued `si-pre-2010:uksi/1958/1156` already (done).
5. **retained-eu: SEEDED + RUNNING** — true universe **~153k instruments** (not V18's ~33k; playbook §8). ~154k rows seeded (idempotent union of two enumeration runs — incl. an orphaned first run, see playbook's Windows pipeline-kill pattern); ~36h of TNA fetching at 200ms/10. ✓ re-baseline at drain (the 140k "phantom" may land close — 93% shells).
6. **At each remaining drain:** re-baseline ✓ (playbook §1c) — **retained-eu** (~36h; re-measure, the 140k may land close), **et-decisions + uk-treaties** (~11h gov.uk), and after the deferred regnal pass: **primary-acts-pre-2000** (`v19-cleanup-ukpga-calendar.ts` deletes the 5,840 chrome-boilerplate rows + 1,057 dead calendar markers, then ✓). si-pre-2010 / lda-oral / tna-caselaw already ✓ (11 Jun evening).
7. **regional:** enumerate the 7-type universe with `listActEntries` (politeness backlog deferred it); re-baseline the ~160k estimate with evidence.

**INCIDENT LOG (this sprint):** gov.uk 429 storm exposed a latent V17 race — idle loops raced un-consumed tokens; instant failures ran govuk-content at 24 fails/s against a configured 3.3/s, keeping the penalty box alive. Fixed (reserve-then-claim + suspend-on-429/503). The breaker contained it. Full account: CHANGE_LOG V19 + playbook §8.

**DECISIONS WAITING ON CHARLIE:**
- **OECD MTC/TPG:** pre-Jul-2024 content is CC non-commercial — plausibly fine for us, but seeding needs sign-off (CHANGE_LOG §3.4).
- **Historic tax tribunals** (financeandtax.decisions.tribunals.gov.uk): alive, April 2003+, ASP.NET postback scraping — build go/no-go.
- **Committees** (carried from V18): Railway IP CF-blocked; local fetch / proxy / retire.

### The three layers (V17 doctrine)
- **R2** = corpus text, permanent, zero egress.
- **Neon** = metadata + search index + queue (`ingest_queue`, `corpus_sections`, `source_status` NEW, `ingest_service_state` NEW, etc).
- **Railway** = transient compute only: `Ingest` + `Ops` (+ `scrutinise-db` for the web app — ingest never touches it).

### Services (the fleet is gone — 23 containers deleted by Charlie 10 Jun)
- **`Ingest`** (`a7f4d75f…`, start: `npm run worker` → `workers/ingest-pool.ts`): single process, `WORKER_CONCURRENCY` (default 20) claim loops, shared pg.Pool (max 10), in-process token-bucket rate limiting, per-loop error isolation, 5-min row timeout. **Exit-on-empty:** 3 empty sweeps × 30s → exit(0), service stays stopped, bills nothing. Heartbeat → `ingest_service_state.last_beat` every 30s. No DATABASE_URL anywhere in its import graph (grep-proven).
- **`Ops`** (`f3397bee…`, start: `npm run scheduler` → `ops.ts`): merged scheduler+monitor, Neon only. Hourly: reaper, census, snapshots, cleanup, pwdata daily reseed, progress email (now with INGEST SERVICE state, sections-vs-rows divergence warning, persistent 🔴 breaker ISSUES). Every 15 min: circuit breakers + liveness (starts `Ingest` via `serviceInstanceRedeploy` when pending > 0 and heartbeat stale; 15-min cooldown).

### Circuit breakers (the V17 renewal — deterministic, no auto-retry ever)
- Failure breaker: 5 consecutive failures → trip. Zero-output breaker: ≥25 done rows with 0 section growth → trip.
- On trip: pending rows parked as `status='blocked'`, persistent email ISSUES line. Manual clear SQL in INGEST_PLAYBOOK §8.
- `committees-portal` is already tripped (correctly — CF 403, known since V15/V16).

### Queue state (10 Jun 2026, morning)
- 0 pending | 80,499 done | 2,538 failed (all committees-portal, parked behind breaker) | 275 skipped
- corpus_sections: 884,982. si-2010plus tail finished overnight 9–10 Jun before the fleet was deleted.
- pwdata current through 2026-06-08/09 (latest TWFY files); ops reseeds new files hourly → liveness starts ingest automatically.

### V17 code changes (key files)
- NEW: `workers/ingest-pool.ts`, `workers/process-row.ts` (processors extracted verbatim from worker-queue), `ops.ts`, `shared/neon-pool.ts`, `shared/rate-limiter.ts`
- REWRITTEN: `shared/queue-client.ts` (claim SQL without rate-limit writes), `shared/db-metadata.ts` (Prisma removed), `shared/progress-reporter.ts` (fleet relics removed), `census/live-census.ts` (Neon-only — its queue query had silently pointed at the stale Railway copy since V16)
- FIXED (latent): pwdata reseed now dedupes against `corpus_sections`, not the queue — the monitor-era version would re-seed the whole archive once cleanup deleted done rows, which under V17 would have kept `Ingest` alive forever.
- RETIRED to `scripts/attic/v17-fleet/`: worker-queue.ts, worker-main.ts, phase-router.ts, scheduler.ts, monitor.ts, restart-workers-staggered.ts, checkpoint.ts, check-status.ts, cc-monitor.ts, retry-failed.ts, prisma/ (ingest copy), DEPLOY.md
- `scripts/ingest/package.json`: prisma deps + postinstall removed; `worker`→ingest-pool, `scheduler`→ops.

### Still true / carry-overs
- Railway curl absent → committees-document rows produce 0 sections until nixpacks curl (V18+ scope).
- Blocked sources (HUDOC, NAO, uk-treaties, SSRN, BAILII) — out of V17 scope.
- Railway-DB → Neon web-app migration — future scope.

---

## ⚠️ CRASH DIAGNOSIS — What CC did and why it matters

### Timeline of CC's session (9 Jun 2026, ~17:00–18:00 BST)

CC ran a diagnostic to test whether Railway workers have curl. During this session CC:

1. **~17:23 BST** — Called `deploymentRedeploy(id: "63e9dbbf")` — accidentally redeployed a REMOVED June-4 deployment of worker-1. That old code (pre-Neon) tried to connect to Railway DB directly for queue operations, crash-looped repeatedly with ECONNRESET. This created sustained failed-connection activity against Railway DB.

2. **~17:28–17:47 BST** — Called `serviceInstanceRedeploy` on worker-1 multiple times for the CF test. Each fresh build started a new process.

3. **~17:40 BST** — Ran `restart-workers-staggered.ts` which triggered `serviceInstanceRedeploy` on **all 21 services** (20 workers + scheduler) in batches of 5. This created 21 fresh builds in ~3 minutes. On startup each worker process opens Neon connections. The scheduler additionally opens a Railway DB connection pool via `getPrisma()`.

4. **~17:40–17:46 BST** — Syntax error in test-committees-fetch.ts caused worker-1 to crash-loop on esbuild parse failure (all other workers unaffected — tsx dynamic import not eagerly resolved for them). Cleaned up.

### Root cause of Railway DB crash

**`scheduler.ts` line 82–84 calls `queryFormatBreakdown()` and `queryUnrecognisedFormats()`** — both defined in `db-metadata.ts`, both call `getPrisma()` which creates `new PrismaClient()` using `DATABASE_URL` (Railway PostgreSQL). PrismaClient maintains a persistent connection pool (default: up to 10 connections). This pool stays open for the scheduler's entire lifetime.

After the staggered restart at 17:40, a fresh scheduler instance started, opened a new PrismaClient pool to Railway DB. If the old scheduler instance did not disconnect cleanly, both pools would be open simultaneously. Combined with connection pressure from the June-4 worker-1 crash loop, Railway DB likely hit its connection or memory limit.

**This is the most probable cause.** It cannot be confirmed until Railway DB is back up and `pg_stat_activity` can be queried.

### What CC reported incorrectly

CC said "Workers are running normally" and "19/21 workers SUCCESS" at ~17:46 BST. Both statements were true for Railway deployment status and Neon queue health. CC did NOT check Railway DB health before reporting. Given Railway DB's history of OOM crashes, this was a serious oversight.

### What was discovered during the session (useful for next sprint)

1. **Curl is NOT available on Railway worker containers.** The Railway container (mise + Node.js 22.22.3, Railpack build) has no curl at `/usr/bin/curl`, `/usr/local/bin/curl`, `/bin/curl`, or via PATH. The CLAUDE.md claim "Railway Linux containers have curl by default" is WRONG.

2. **V16.1 committees-document approach has never worked.** All 2,422+ committees-document done rows produced 0 corpus_sections. `fetchPublicationHtml()` silently returns null when curl is absent; `processCommitteeDocument()` marks the row done without error. 2,896 rows tagged with `lastError = 'empty — curl not available in Railway container (V16.1)'`.

3. **`reports-responses` accessible with curl from Charlie's machine, no CF challenge.** Seeder correctly found 1,132 rows (not 9,959 — the ~80-page real extent of the listing). `other-publications` returns CF JS challenge from Charlie's machine; unknown from Railway (test could not run without curl).

4. **Queue nearly exhausted.** At end of session: 1,622 pending (si-2010plus only), 112,600 done. Workers should have finished si-2010plus overnight and be in discovery/idle mode.

---

## IMMEDIATE ACTIONS REQUIRED — V16

---

## IMMEDIATE ACTIONS REQUIRED — V16

| Action | Status | Who |
|--------|--------|-----|
| Execute commit-all.sh | ✅ done — `c0c9844`, `6cbf568` | CC |
| Stop workers (Railway OOM crash did this) | ✅ done — all offline at migration time | — |
| Run `migrate-queue-to-neon.ts` | ✅ done — 127,380 rows Railway = 127,380 Neon | CC |
| LDA retirement SQL (Railway + Neon + corpus_targets) | ✅ done — 168 rows each + 2 targets retired | CC |
| Staggered redeploy 20 workers + scheduler + monitor | ✅ done — 20/21 SUCCESS | CC |
| Railway DB zero ingest connections verified | ✅ done — 0 pg_node, 9 total (web app only) | CC |
| **Fix worker-18** — Railway dashboard → ingest-worker-18 → Deploy from Main | ⬜ pending | Charlie |
| **Resume committees seeder** — see instructions below | ⬜ next session | CC |
| **Retire old committees-portal rows** — SQL below, run AFTER seeder completes | ⬜ after seeder | CC |

### V16.1 — committees-document approach (9 Jun 2026)

**Root cause diagnosis:** committees.parliament.uk and publications.parliament.uk both block Node.js
Undici via Cloudflare TLS fingerprinting (JA3), regardless of headers or IP. curl's TLS fingerprint
IS accepted. Fix: `fetchPublicationHtml()` in committees-portal.ts now uses `spawnSync(curl)`.
Railway Linux containers have curl by default — workers can fetch from publications.parliament.uk.

**Seeder approach:** `seed-committees-publications.ts` uses curl with a cookie jar (`-c/-b` flags).
CF tracks session continuity via parliament.uk session cookies. Without a cookie jar, CF challenges
after 1-2 pages. With cookie jar, sessions stay valid for 100+ pages at 1.5s pace.

**Seeder state (9 Jun 2026 end of session):**
- committees-reports document rows seeded: **~1,176** (pages 1–~80 of 498)
- committees-evidence document rows seeded: **0** (not yet started)
- All 1,176 seeded rows: **done** (workers processed them immediately)
- Seeder checkpoint: `scripts/ingest/seed-committees-checkpoint.json` — survives session clear
- Old committees-portal rows: still `failed` — DO NOT retire until seeder completes all pages

**Resume seeder in next session:**
```
NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
  --tsconfig scripts/tsconfig.json \
  scripts/ingest/seed-committees-publications.ts
```
The checkpoint resumes automatically. Expect ~25–30 min for remaining reports + ~50 min for evidence.
Total expected: ~9,959 reports + ~40,794 evidence = ~50,753 per-document rows.

**Retire old committees-portal rows AFTER seeder completes (run on Neon):**
```sql
UPDATE ingest_queue
SET status = 'done', "lastError" = 'retired V16 — replaced by committees-document rows'
WHERE "sourceType" = 'committees-portal'
  AND corpus IN ('committees-reports', 'committees-evidence');
```

### V16 cutover — all done

- Queue migration: 127,380 rows Railway → Neon (exact match)
- LDA retirement: 168 rows done each DB, 2 corpus_targets retired
- Workers: 20/21 SUCCESS on Neon queue
- Railway DB: 0 ingest connections (web app only)
- Worker-18: stale Railway deploy issue — Charlie: Railway dashboard → ingest-worker-18 → Deploy from Main

### V16 pwdata-wrans coverage confirmed
- TWFY wrans: **2001-06-21 → 2026-06-08** (current, adds files daily)
- TWFY lordswrans: **1999-11-18 → 2026-06-08** (current)
- LDA written questions covers only from ~2009 (API launch) → TWFY has MORE coverage. Clean switch.

---

## IMMEDIATE ACTIONS REQUIRED — V15

| Action | Status | Who |
|--------|--------|-----|
| Commit and push V15 code | ✅ done — `a0137b6`, `72da2d7`, `3019b0e` | CC |
| Redeploy all 20 workers + scheduler on V15 | ✅ done — 20/21 SUCCESS (worker-18 retriggered) | CC |
| Rate limits updated (eurlex→8, lda→2, committees-portal→3) | ✅ done via script | CC |
| Neon corpus_targets: committees-reports + committees-evidence added | ✅ done; committees-a/b retired | CC |
| Seed committees queue | ✅ 498 reports rows + 2,040 evidence rows inserted | CC |
| Reset LDA 524 failed rows | ✅ done (0 rows matched — none outstanding) | CC |
| Kill reseed-deep.ts local process | ✅ killed PIDs 58060 + 18264 | CC |
| Verify reseed-deep.ts log | retained-eu: 0 new rows; regional: interrupted mid-nia | CC |

**V15 Railway DB findings:**
- `max_connections = 100` (not 25 — Starter plan has room)
- Peak connections with 20 workers: ~46 (well under 100)
- **Crash cause: OOM, not connection exhaustion.** Railway Postgres container memory-killed under peak concurrent write load.
- Fix applied: monitor.ts Railway pool cap reduced `max: 3 → 2`
- Longer-term: upgrade Railway Postgres plan (more RAM) OR migrate ingest queue to Neon
- **Do NOT run reseed-deep.ts locally again.** Move it to Railway as a one-off service job.

**V14 actions still pending:**

**V13 carry-over (still needed):**
| Run priority SQL in Railway dashboard Query tab (de-prioritize completed legislation corpora) | ⬜ pending | Charlie |
| Update sentencing-council corpus_targets: `UPDATE corpus_targets SET blocked=false, blocked_reason=NULL WHERE corpus_key='sentencing-council'` | ⬜ pending | Charlie |

**V12 carry-over (still needed):**
| Kill local scheduler.ts process: `Stop-Process -Id 22916` (and child 47892) | ⬜ URGENT (if not done) | Charlie |
| Redeploy `Ingest-scheduler` on Railway (stopped 7 Jun 23:01 UTC) | ⬜ after commit | Charlie |
| Add `RESEND_API_KEY` to `ingest-monitor` Railway service env | ⬜ pending | Charlie |

**Run classify-no-provisions.ts:**
```
NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json scripts/ingest/classify-no-provisions.ts
```
Runs overnight. Checkpoint at `scripts/ingest/classify-no-provisions-checkpoint.json`. Resume by re-running same command.

**Priority SQL (run in Railway dashboard → scrutinise-db → Query tab):**
```sql
UPDATE ingest_queue
SET priority = 5
WHERE corpus IN ('si-pre-2010', 'si-2010plus', 'primary-acts-pre-2000', 'primary-acts-2000plus')
  AND status = 'pending';
```

**No other pending actions from V11 (except RESEND_API_KEY).**
('fca-handbook:serv', 'fca-handbook', 'serv', 'fca-handbook', 2),
('fca-handbook:bench', 'fca-handbook', 'bench', 'fca-handbook', 2),
('fca-handbook:bfsag', 'fca-handbook', 'bfsag', 'fca-handbook', 2),
('fca-handbook:collg', 'fca-handbook', 'collg', 'fca-handbook', 2),
('fca-handbook:enfg', 'fca-handbook', 'enfg', 'fca-handbook', 2),
('fca-handbook:fcg', 'fca-handbook', 'fcg', 'fca-handbook', 2),
('fca-handbook:fctr', 'fca-handbook', 'fctr', 'fca-handbook', 2),
('fca-handbook:perg', 'fca-handbook', 'perg', 'fca-handbook', 2),
('fca-handbook:rfccbs', 'fca-handbook', 'rfccbs', 'fca-handbook', 2),
('fca-handbook:rppd', 'fca-handbook', 'rppd', 'fca-handbook', 2),
('fca-handbook:unfcog', 'fca-handbook', 'unfcog', 'fca-handbook', 2),
('fca-handbook:wdpg', 'fca-handbook', 'wdpg', 'fca-handbook', 2),
('fca-handbook:m2g', 'fca-handbook', 'm2g', 'fca-handbook', 2)
ON CONFLICT (id) DO NOTHING;
```

**V9 carry-over:**

**V9 carry-over — Monitor service details:**
- Service name: `ingest-monitor`
- Service ID: `d4945e0c-207a-46ca-aceb-bdc010183cc5`
- Start command: `npm run monitor`
- DATABASE_URL + NEON_DATABASE_URL already set via API
- Repo: Scrutinise/scrutinise-prototype, branch: Main
- Steps: Railway dashboard → Projects → scrutinise-prototype → ingest-monitor → Settings → Source → connect GitHub → Deploy

**V9 SQL already applied to Neon:**
- `retired` column added to corpus_targets
- 4 hansard API corpora marked retired (won't appear in emails)
- 42 corpus_targets display_labels updated to match Excel

**V9 partial reseeding:**
- 6,038 primary-acts-pre-2000 items detected with < 3 sections (covers the 1,084 section gap)
- Monitor will auto-reseed these on first cycle once deployed

---

## KEY ARCHITECTURE STATE (as of V16 + V16.1)

- **Queue on Neon (V16):** `ingest_queue`, `source_rate_limits`, `specialist_queue`, `scheduler_lock`, `ingest_progress_snapshots` all on Neon. Railway Postgres holds only Prisma app tables.
- **Connection-per-transaction (V16):** ECONNRESET retry loop removed. Clean exit on DB error → Railway restarts with jitter.
- **LDA written questions retired (V16):** covered by `pwdata-wrans` (2001–present) and `pwdata-lordswrans` (1999–present).
- **committees-document (V16.1) — BROKEN on Railway:** All 2,896 done rows from first seeder run produced 0 corpus_sections. Root cause: curl NOT installed on Railway containers. `fetchPublicationHtml()` returns null silently; rows marked done with no content. All tagged `lastError = 'empty — curl not available in Railway container (V16.1)'`. Needs Nixpacks curl installation before workers can produce content.
- **Seeder completed (10 Jun 2026 — multiple runs):** Best run (with retry-on-timeout): **~1,633 reports + ~55 evidence total rows in Neon** (idempotent; subsequent runs added 0 new). The retry path is essential — ~30% of pages fail first attempt but succeed after 8s retry; without retries only ~89 rows found. `other-publications` listing ends consistently at p1175; ~55 rows is the real accessible extent from residential IP. All rows will produce 0 corpus_sections until curl installed on Railway.
- **Retirement SQL** (run on Neon AFTER curl installed and workers processing): `UPDATE ingest_queue SET status='done', "lastError"='retired V16 — replaced by committees-document rows' WHERE "sourceType"='committees-portal' AND corpus IN ('committees-reports','committees-evidence');`
- **committees-portal rows:** 498 reports + 2,040 evidence still `failed`. DO NOT retire until curl installed.
- **Cloudflare diagnosis (confirmed 9/10 Jun 2026):** `reports-responses` accessible with curl, no CF challenge. `other-publications` mostly exit 28 timeouts from Charlie's residential IP (CF rate-limiting, not JS challenge). Railway IPs unknown. CLAUDE.md claim "Railway Linux containers have curl by default" is incorrect.

## KEY ARCHITECTURE STATE (as of V15)

- **committees portal (V15):** `committees-portal.ts` scrapes `committees.parliament.uk/publications/` with browser User-Agent (Cloudflare bypass). 498 pages × ~20 pubs = 9,959 committee reports. 40,794 other-publications (evidence sessions, oral/written evidence). sourceType: `committees-portal`, max 3 concurrent, 500ms interval.
- **LDA pageSize fix (V15):** `processLda()` in worker-queue.ts now passes `pageSize=100` for `writtenquestions` corpora at all times (not just 524 fallback). After 3 524 failures (MAX_524_RETRIES), row is marked `specialist-queue: LDA 524 after N attempts — archived`. Monitor no longer resets these rows.
- **SOURCES email section (V15):** `sendProgressEmail()` now includes SOURCES section showing pending/active/cap per sourceKey. Flags `⚡cap-full` when active == cap with pending work.
- **INGEST_PLAYBOOK §8 (V15):** Three new patterns: committees portal alternative, LDA 524 fix approach, connection pool exhaustion signature.

## KEY ARCHITECTURE STATE (as of V14)

- **hasNoProvisions classification (V14):** `classifyNoProvisionsItem()` in `tna-legislation.ts` classifies into: commencement | metadata-only | pdf-only | no-provisions. Uses title regex + year < 1980 heuristic + PDF HEAD check. Workers write classified rows to Neon `corpus_sections.availability_status` + `availability_note`.
- **specialist_queue (V14):** New Railway DB table. Workers insert commencement + pdf-only items for future specialist worker processing. Indexed on `(specialist_type, status)` and `(corpus, status)`.
- **corpus_sections new columns (V14):** `availability_status TEXT NOT NULL DEFAULT 'full'` and `availability_note TEXT`. Existing rows default to 'full'. Index on availability_status WHERE != 'full'.
- **fetch() timeout fix (V14):** `withTimeout(ms)` helper added to `tna-legislation.ts`. All fetch calls use AbortController: 30s for text/binary, 10s for HEAD. Workers were hanging indefinitely on old NISR items with no timeout.
- **Monitor reseed loop fix (V14):** `CORPUS_THRESHOLDS` now has `regional: 1` and `retained-eu: 1`. `reseedPartialItems()` excludes items with `availability_status != 'full'` via second Neon query. Root cause of 36,983 items stuck in false-positive pending state all day.
- **Queue state after V14 fixes:** 162 pending (lda-lordswrittenquestions only). Workers in discovery mode after these complete.

## KEY ARCHITECTURE STATE (as of V13)

- **Startup jitter (V13):** Random 0–20s delay added as first `await` in `worker-queue.ts main()` before any DB call. Prevents connection storm on simultaneous Railway redeploy. Jitter line: `scripts/ingest/workers/worker-queue.ts` line 65.
- **sentencing-council (V13):** `listSentencingCouncilGuidelines()` now scrapes `sentencingcouncil.org.uk` directly (embedded JSON, ~381 guidelines across crown-court + magistrates pages). Was returning 0 results via GOV.UK search API.
- **nilawcom (V13):** `listNiLawComReports()` now uses BFS crawl (homepage + completed_projects → individual report pages → PDFs). Was returning 0 PDFs from homepage (no direct PDF links there).
- **Priority SQL pending (V13):** SQL to set si-pre-2010/si-2010plus/primary-acts rows to priority 5 pending Charlie running it in Railway dashboard.
- **CLAUDE.md + INGEST_PLAYBOOK.md (V13):** Railway Operations section added to CLAUDE.md; 3 new failure patterns added to INGEST_PLAYBOOK §8.
- **Duplicate email root cause (V12):** LOCAL scheduler.ts process (PIDs 22916/47892 on Charlie's machine) — kill before restarting Railway scheduler. See §IMMEDIATE ACTIONS.
- **Railway scheduler:** DOWN since 2026-06-07T23:01 UTC (scheduler_lock confirms). Needs redeploy after commit.
- **CORPUS_THRESHOLDS (V12):** Per-corpus partial-item reseed thresholds in `monitor.ts` — replaces single global threshold of 3. Prevents false-positive reseeding of short pre-2000 Acts.
- **primary-acts-pre-2000 (V12):** 6,038 false-positive pending rows reset to done. 0 genuine gaps. Queue now: 0 pending.
- **hmrc-tiins (V12):** COMPLETE — 791 sections; est_is_confirmed=true in corpus_targets.
- **hmrc-codes-guidance (V12):** COMPLETE — 14,067 sections; est confirmed (was 640,000). GOV.UK search API returns document pages not sub-pages.
- **LDA timeout (V12):** `LDA_FETCH_TIMEOUT_MS` 45s → 90s in `lda-parliament.ts`. 1,402 failed/timed-out rows reset to pending. lda-commonswrittenquestions: 1,232 pending; lda-lordswrittenquestions: 132 pending.
- **Monitor auto-reseed (V12):** `reseedExhaustedCorpora()` + `seedPwdataCorpus()` added to monitor.ts — auto-seeds new TWFY pwdata files daily when corpus exhausts. No more manual weekly re-run needed for pwdata.
- **hasNoProvisions skip:** ADDED (V11) — workers need redeploy to pick up.
- **tna-legislation rate limit:** 10 concurrent workers (V11).
- **Monitor alerts:** ADDED (V11) — requires `RESEND_API_KEY` on `ingest-monitor` service.
- **pwdata corpora:** ALL COMPLETE (V11) — monitor auto-reseeds daily files now.
- **Queue state (8 Jun 2026):** ~31,110 pending | 11 claimed | 92,111 done | 0 failed | 237 skipped
- **Pending by corpus:** si-pre-2010: 20,533 | regional: 4,859 | retained-eu: 2,452 | si-2010plus: 3,228 | lda-commonswrittenquestions: 1,232 | lda-lordswrittenquestions: 132 | (primary-acts-pre-2000: 0)
- **FCA Handbook:** COMPLETE (V10) — 3,661 sections; est_is_confirmed=true
- **Monitor:** RUNNING — loops every 15 min; alert + auto-reseed functionality added V11/V12
- **Restart policy:** ON_FAILURE / max 3 retries on all 22 services (V10)
- **Retired corpora (Neon):** `fca-publications`, `fca-regulators` retired+blocked (V10); `hansard-*-a/b` retired (V8)
- **source_rate_limits actual columns:** `sourceKey`, `intervalMs`, `lastIssuedAt`, `suspended`, `suspendedUntil`, `updatedAt`, `isComplete`, `maxConcurrentWorkers`
- **Neon corpus_sections:** ~785,099+ rows — growing as SI/regional/LDA process
- **Railway DB:** ~2.0GB of 20GB

---

## KEY ARCHITECTURE STATE (as of V3)

- **Neon corpus_sections:** 751,949 rows — no compiledText column (dropped V3)
- **Neon corpus_targets:** 39 rows — email denominators; edit via SQL to update estimates
- **Railway corpus_sections:** 0 rows (TRUNCATEd V3)
- **Railway DB:** ~0.8GB of 20GB — target maintained
- **R2 compiled text:** 100% coverage verified — all compiledText is in R2 at r2Key paths
- **Workers:** 20 active, on pwdata-* (priority 3) — priorities 1/2 fully done
- **Neon DB limit:** `DB_LIMIT_GB = 10` in progress-reporter.ts — update if on Scale plan (50GB)

---

## DIAGNOSTIC SNAPSHOT — 5 Jun 2026 (run ~01:00 UTC)

### DB state (Railway corpus_sections)

**Total rows: 732,942 — DB: 4,824 MB (4.7 GB of 20 GB) — table: 581 MB**

compiledText column: 665,707 rows populated, ~1,617 MB raw text. This is the primary volume driver — by design for FTS (schema: "First 10,000 chars; full text in R2"), but at 732k rows it dominates the DB.

| corpus | rows |
|--------|-----:|
| si-pre-2010 | 174,507 |
| regional | 109,695 |
| primary-acts-2000plus | 90,860 |
| tna-caselaw | 74,730 |
| primary-acts-pre-2000 | 69,501 |
| lda-commonsoralquestions | 65,806 |
| si-2010plus | 60,485 |
| eur-lex | 18,973 |
| pwdata-debates | 18,937 |
| retained-eu | 14,390 |
| hmrc-codes-guidance | 13,425 |
| pwdata-wrans | 6,429 |
| pwdata-lords | 5,448 |
| pwdata-westminster | 3,860 |
| college-of-policing | 1,944 |
| building-regs / hmrc-tiins / planning-policy | 791 each |
| ots-reports | 497 |
| oecd | 462 |
| scotlawcom | 350 |
| written-answers | 142 |
| written-statements | 128 |

**Zero rows for:** lda-lordswrittenquestions, lda-commonswrittenquestions, lda-commonsdivisions, lda-lordsdivisions, uk-treaties, echr-hudoc, fca-regulators, sentencing-council, nao-reports.

### Queue state (ingest_queue)

**pending: 0 — claimed: 409 (stale from crash) — done: 106,945**

Queue is **fully exhausted**. Workers processed all remaining pending rows in the ~1.5h they ran after recovery (20:43–21:11 UTC on 4 Jun). 409 claimed rows are stale locks — will expire. No new ingest can happen until the queue is reseeded.

**Open question:** `lda-commonswrittenquestions` (expected ~619k records across 1,238 queue pages) shows 0 DB rows and 0 R2 keys. Was it processed when DB was full (inserts silently failed)? Or was it never seeded? Needs investigation before next seed run.

### R2 state (scrutinise-legislation bucket — 41 top-level prefixes)

Legislation corpora (CLML) store 2 keys per section (raw.xml + compiled.txt), hence ~2× ratio. Text-only corpora (pwdata, LDA, etc.) store 1 key per section.

| prefix | R2 keys | DB rows | ratio |
|--------|--------:|--------:|------:|
| si-pre-2010/ | 331,925 | 174,507 | ~1.9× |
| regional/ | 216,179 | 109,695 | ~2.0× |
| primary-acts-2000plus/ | 174,079 | 90,860 | ~1.9× |
| caselaw/ | 149,702 | 74,730 | ~2.0× |
| si-2010plus/ | 118,782 | 60,485 | ~2.0× |
| lda-commonsoralquestions/ | 65,813 | 65,806 | 1.0× |
| retained-eu/ | 26,704 | 14,390 | ~1.9× |
| hmrc-codes-guidance/ | 26,659 | 13,425 | ~2.0× |
| eur-lex/ | 18,973 | 18,973 | 1.0× |
| pwdata-debates/ | 18,945 | 18,937 | 1.0× |
| pwdata-wrans/ | 6,429 | 6,429 | 1.0× |
| pwdata-lords/ | 5,448 | 5,448 | 1.0× |
| pwdata-westminster/ | 3,860 | 3,860 | 1.0× |

Key naming: caselaw is stored under `caselaw/` (not `tna-caselaw/`). LDA, pwdata, eur-lex: compiled.txt only. Legislation: raw.xml + compiled.txt per section.

Legacy R2 prefixes from old Neon pipeline (not in Railway DB): `ukpga/`, `uksi/`, `eudn/`, `eudr/`, `eur/`, `anaw/`, `asp/`, `asc/`, `nia/`, `nisi/`, `nisr/`, `ssi/`, `wsi/`, `operational/` — these correspond to the 914,274 Neon legacy sections.

### Root cause of volume fill (confirmed)

`processPwdata` (and all other source clients) calls both `r2Put()` AND `upsertSection({ compiledText: compiled.slice(0, 10_000) })`. The `compiledText` field stores up to 10KB per row in Railway DB by design — intentional for FTS. At ~730k rows this is 1.6GB of text in Postgres.

**This is an architectural decision to discuss with CCh.** Options:
1. Remove compiledText from corpus_sections entirely — rely on R2 for full text, FTS via tsvector trigger only (already maintained)
2. Reduce slice to 2,000 chars (enough for FTS lexemes, less storage)
3. Accept it and plan for larger Railway volume as corpus grows

Hourly cleanup (added V3) handles snapshot + done-row accumulation but does NOT address compiledText growth. That requires a schema/code decision.

---

## IMMEDIATE ACTIONS REQUIRED (for Charlie)

### V2 Part 1 — TWFY pwdata client (4 Jun 2026)

**Directory probe verified before building.** Three mismatches from brief:
- `lords/` → actual path `lordspages/`, prefix `daylord{date}{a/b}.xml`
- `westminster/` → actual path `westminhall/`, prefix `westminster{date}{a/b}.xml`
- `wrans/` → filename prefix is `answers` not `wrans`

| Corpus | Dir | Files | Coverage |
|--------|-----|-------|----------|
| pwdata-debates | `debates/` | 19,999 | 1919–present |
| pwdata-lords | `lordspages/` | 5,663 | 1999–present |
| pwdata-wrans | `wrans/` | 6,857 | 2001–present |
| pwdata-westminster | `westminhall/` | 3,932 | 2000–present |

All directories return HTTP 200. Files current through 2026-06-03. XML parseable — speech format for debates, ques/reply format for written answers.

**Files created/modified:**
- `scripts/ingest/sources/twfy-pwdata.ts` (new — source client)
- `scripts/ingest/seed-pwdata-queue.ts` (new — seeder, ~36k rows)
- `scripts/ingest/workers/worker-queue.ts` (processPwdata added)
- `scripts/ingest/shared/progress-reporter.ts` (CORPUS_MANIFEST updated — Hansard/WA entries now point to pwdata corpora)
- `scripts/ingest/seed-rate-limits.ts` (twfy-pwdata 500ms added)
- `scripts/ingest/shared/discovery.ts` (pwdata corpora added to SINGLE_PASS_CORPORA + ORDER)

**Post-deploy actions needed:** ~~Run `seed-pwdata-queue.ts`~~ ✅ done | ~~Run `seed-rate-limits.ts`~~ ✅ done | Redeploy workers (Charlie).

---

### V2 Part 2 — LDA 524 fallback + UK Treaties fix (4 Jun 2026)

**LDA 524 fallback:** `fetchLdaPage` now retries with `pageSize 100` on HTTP 524 when original size > 100. Prevents permanent failure; accepts partial page coverage over zero. 1,416 LDA failed rows reset to pending.

**UK Treaties silent failure:** Root cause was `filter_organisations[]=` sent as literal `[]` in URL — gov.uk API returns 422. Fix: `URLSearchParams` encodes as `%5B%5D`. Query now returns 1,104 FCDO treaty results. 2 done rows reset to pending.

**LDA Divisions content:** Each record = title + date + UIN only (no narrative). Low text volume but descriptive titles retained; already priority 3.

**Queue state after all V2 post-deploy actions:** 37,869 pending | 270 claimed | 70,730 done | 0 failed

**V2 Part 3 — NPPF/PPG + Building Regs (4 Jun 2026)**
- `listPlanningPolicyNppf()`: enumerates PPG collection 63 HTML chapters (~60KB text each) + NPPF page
- `listBuildingRegs()`: enumerates 21 Approved Documents (description text; PDFs future work)
- V1 blocked: Erskine May, Bill Pages, HoC Library all CF 403 — not built
- Seed rows inserted: `planning-policy:__index`, `building-regs:__index`

**All post-deploy actions complete:**
- ~~`commit-all.sh`~~ ✅ pushed (commits `a526de9..3b0b676`)
- ~~Redeploy workers~~ ✅ all 20 redeployed via Railway API
- **Redeploy scheduler** — Charlie to do manually (or CC can trigger via API if needed)

---

### Post-sprint monitoring (4 Jun 2026 ~02:00 BST)

Queried Railway DB directly after push. **All V1 post-deploy actions still pending** — Charlie has not yet run migration or redeployed.

| Check | Result |
|-------|--------|
| `scheduler_lock` table | Does not exist — `prisma migrate deploy` not yet run |
| Per-worker snapshots | 0 rows — workers not yet redeployed (still running pre-V7 code) |
| Last scheduler run | 2026-06-03T23:56 UTC (corpus-level snapshots only, no per-worker breakdown) |
| Queue state | 955 pending / 257 claimed / 70,709 done / **491 failed** (LDA 524s accumulating — reset SQL still needed) |
| `acquireSchedulerLock()` fallback | Working correctly — returns `true` (proceeds without lock) when table missing |

Next hourly email will still show the old per-corpus format (no per-worker rows) until Charlie redeployes.

---

### What just happened (4 Jun 2026 V1)

1. **Scheduler email deduplication (PART 2)** — Added `scheduler_lock` table + `acquireSchedulerLock()`. Scheduler acquires a DB-based mutex at the start of each `run()`. If another instance holds the lock (set within last 50 minutes), the run is skipped. Uses random per-startup ID (not process.pid — all Railway containers are PID 1). Migration: `20260604010000_scheduler_lock`.

2. **Source audit (PART 3)** — 50 sources tested live. Full results in CHANGE_LOG. Key: **FCA Publications accessible** (162KB HTML), Sentencing Council, College of Policing, Ofcom/Ofgem/Ofsted all accessible. FCA Handbook (JS SPA), ECHR, SSRN, HoC Library, Erskine May all blocked.

3. **Stalled source diagnoses (PART 4)**:
   - *HMRC*: Single `__index` row stuck claimed for 26h (worker 8). Root cause: `processHmrc` runs 6 generators (~17k items) in one claim — killed by Railway SIGTERM. **Reset SQL in post-deploy actions.**
   - *LDA commonswrittenquestions*: 388 failures with HTTP 524 (Cloudflare timeout). Fix applied: retry logic added to `fetchLdaPage`. **Reset SQL in post-deploy actions.**
   - *SI 2010+*: Queue exhausted (5,813/5,824 done). Not stalling — needs reseeding for 2015–2026 gap.

4. **Worker-2 build failure (PART 1)** — Root cause: Railway retrying an old deployment (commit `4f9cc389`) with Nixpacks + old postinstall path. Worker-2 IS running (SUCCESS at 22:47). Fix: Charlie triggers fresh "Deploy" from Main in Railway (NOT "Redeploy"). Stops hourly spam.

5. **New source clients (PART 5)** — Added `listFcaPublications()`, `listSentencingCouncilGuidelines()`, `listCollegeOfPolicing()` to gov-scraper.ts (GOV.UK search API by org). Wired into processGovUk switch + processRow dispatcher. Queue seeds added to queue-populator.ts.

6. **LDA retry fix (PART 4 fix)** — `fetchLdaPage` now retries on HTTP 524/502/503/504 (up to 3 retries, 3s×attempt backoff). 388 failed rows need reset to pending (SQL in post-deploy actions).

7. **TWFY pwdata discovery (PART 6)** — `theyworkforyou.com/pwdata/scrapedxml/` is freely accessible. `debates/` has Commons Hansard XML from 1919 to present (~431KB/day, daily files). `wrans/` has Written Answers from 2001+ (3,259 files). This supersedes all other Hansard ingest approaches. **Do not build yet — awaiting CCh review.** See CHANGE_LOG for full findings.

---

## IMMEDIATE ACTIONS REQUIRED (for Charlie)

### V3 — all complete ✅

| Action | Status |
|--------|--------|
| Railway PostgreSQL restarted | ✅ CC via Railway API |
| All 20 workers redeployed | ✅ all SUCCESS by ~20:43 UTC 4 Jun |
| Scheduler redeployed with DB size + hourly cleanup | ✅ commit b0a7a7d live |
| Hourly cleanup running | ✅ scheduler deletes old snapshots + done rows every cycle |
| DB size in email | ✅ every hourly email now shows %, warns at 80%/90% |

**Remaining decision for CCh:** What to do about `compiledText` (see diagnostic snapshot above). This is the root cause of volume fill — not a code bug, an architectural choice.

**Open investigation:** `lda-commonswrittenquestions` — 0 rows in DB and R2 despite being seeded. Determine if queue rows exist (check failed count), and whether inserts failed silently when DB was at capacity.

### V1 post-deploy (all required before workers pick up new sources)

1. **`npx prisma migrate deploy`** — Apply `20260604010000_scheduler_lock` migration
2. **Reset stuck HMRC row:**
   ```sql
   UPDATE ingest_queue SET status='pending', "claimedBy"=NULL, "claimedAt"=NULL 
   WHERE corpus='hmrc-codes-guidance' AND status='claimed';
   ```
3. **Reset LDA 524 failures:**
   ```sql
   UPDATE ingest_queue SET status='pending', "lastError"=NULL, "claimedBy"=NULL 
   WHERE corpus='lda-commonswrittenquestions' AND status='failed';
   ```
4. **Fix worker-2 build loop** — Railway dashboard → ingest-worker-2 → Settings → trigger a new "Deploy" from Main branch (not "Redeploy" of existing deployment). This uses fresh commit + empty railway.json → RAILPACK builder → succeeds.
5. **Redeploy workers + scheduler** — So LDA retry fix and scheduler lock go live.
6. **Seed new source rows** — Run `tsx scripts/ingest/queue-populator.ts` (adds nao-reports, fca-publications, sentencing-council, college-of-policing seed rows — safe to re-run, ON CONFLICT DO NOTHING).

### V7 (still pending)
- **Manually redeploy workers + scheduler** in Railway dashboard — so containers pick up `writeWorkerSnapshot()` call.

### V5 (still pending)
- **Register TWFY API key** at theyworkforyou.com/api/key. Add `TWFY_API_KEY` to Railway env.
- **Run `seed-twfy-queue.ts`** after key is added.
- **Review data access request drafts** in `docs/data-access-requests/`.

---

## ARCHITECTURE SNAPSHOT (4 Jun 2026 — post V1)

### What just happened (3 Jun 2026 V7 post-deploy — all seeding and SQL actions complete)

All V6/V7 pending actions now done:
- **`prisma migrate deploy`** ✅ — `workerId` column live on Railway DB
- **`seed-rate-limits.ts`** ✅ — 16 entries, including `lda-parliament` (200ms) and `fca-publications` (300ms)
- **`seed-lda-queue.ts`** ✅ — 1,602 LDA queue rows inserted (5 datasets seeded)
- **EUR-Lex queue reset** ✅ — 50 done rows → pending (workers will retry with SPARQL API)
- **Format backfill** ✅ — 688 null `formatFound` rows fixed (echr-hudoc/eur-lex/fca → html); 695 → 7 remaining nulls
- **Queue health:** 1,652 pending / 200 claimed / 70,560 done — workers actively picking up LDA + EUR-Lex
- **ONE remaining action (Charlie):** Manually redeploy workers + scheduler in Railway dashboard so `writeWorkerSnapshot()` is active and next email shows per-worker throughput

### What just happened (3 Jun 2026 V7 — Worker-ID throughput + FCA status)

1. **Worker throughput now by worker ID** — Workers write their own snapshots to `ingest_progress_snapshots` (with `workerId` column, new migration). Every 50 rows processed, each worker records `sectionsCompiled` (actual upsertSection calls). Email now shows "Worker 1  si-2010plus  4,230 /hr  ████  87% eff" — sorted numerically. Workers with no recent activity don't appear.

2. **FCA status corrected** — `blocked: true` removed from FCA Handbook entry. Since queue rows exist (failed status), it auto-shows `⚠️ failing` rather than `⛔ blocked`. FCA Publications placeholder added (shows "not started" — V8 build scope).

3. **Duplicate scheduler confirmed resolved** — Railway API: one `Ingest-scheduler` service, one `loop()` call. All 20 workers + scheduler SUCCESS at 22:07 post-V6b.

4. **ACTION NEEDED (Charlie):** `npx prisma migrate deploy` in `scrutinise-web/` after push (adds `workerId` column). Then redeploy workers and scheduler.

5. **SQL backfill (informational):**
   ```sql
   UPDATE ingest_queue SET format = 'clml' WHERE format IS NULL AND status = 'done'
     AND (corpus LIKE '%primary-acts%' OR corpus LIKE '%si-%' OR corpus LIKE '%regional%');
   UPDATE ingest_queue SET format = 'html' WHERE format IS NULL AND status = 'done' AND corpus = 'tna-caselaw';
   ```

### What just happened (3 Jun 2026 V6b — Worker crash-loop fix)

Workers 6, 9 (and others) were crash-looping via self-discovery: when their primary corpus was exhausted, they walked `DISCOVERY_CORPUS_ORDER` and hit TNA legislation corpora. `discoverTnaLegislation` triggered a full historical scan (`listActIds('ukpga', 1267, 1999)` = 733 sequential TNA HTTP calls). Railway SIGTERM'd the container at ~10 min. Worker restarted. Loop repeated.

**Fix:** `discoverTnaLegislation` now:
- Returns [] immediately for historical-only corpora (`yearMax < currentYear - 1`)
- For ongoing corpora, checks only the last 2 years inline (`checkFrom = max(yearMin, currentYear - 1)`)
- Warns in logs if queue is genuinely empty (don't trigger full scan inline — use `reseed-si-gaps.ts`)

`UNDER_SEEDED_THRESHOLD` logic and `needsFullScan` path removed entirely.

### What just happened (3 Jun 2026 V6 — EUR-Lex SPARQL fix + LDA Parliament)

1. **EUR-Lex unblocked via CELLAR SPARQL** — `search.html?format=json` now returns HTML (SPA redesign). Fixed: use `publications.europa.eu/webapi/rdf/sparql` (no auth). Confirmed: 232,988 series-3 CELEX IDs enumerable; `fetchDocumentText` returns full text (GDPR: 350KB). EstSections updated 80k→232k.
   - **ACTION NEEDED (Charlie):** Reset existing EUR-Lex done rows: `UPDATE ingest_queue SET status='pending', "lastError"=NULL, claimed_by=NULL, claimed_at=NULL WHERE corpus='eur-lex' AND status='done';`

2. **FCA Handbook confirmed truly blocked** — Every URL (including /sitemap.xml) returns same JS SPA shell. Explicit "JavaScript disabled" message. No rule text in initial HTML. FCA Publications (fca.org.uk/publications) is a viable V7 corpus but requires scraper build.

3. **LDA Parliament integrated** — 5 datasets confirmed, 799K records across 1,602 queue pages:
   - Commons Oral Questions: 69,852 records (140 pages)
   - Lords Written Questions: 103,137 records (207 pages)
   - Commons Written Questions: 618,599 records (1,238 pages)
   - Commons Divisions: 5,553 records (12 pages)
   - Lords Divisions: 2,089 records (5 pages)
   - `lda-parliament.ts` source client built; `processLda()` added to worker-queue.ts; seeder written.
   - **ACTION NEEDED (Charlie):** Run `seed-lda-queue.ts` after deploy to seed 1,602 queue rows.
   - **ACTION NEEDED (Charlie):** Run `seed-rate-limits.ts` to register `lda-parliament` rate limit (200ms).

4. **CORPUS_MANIFEST updated** — EUR-Lex unblocked (blocked→not blocked), estSections 80k→232k. 5 new LDA entries added at correct priorities. FCA comment updated with V6 confirmation.

### What just happened (3 Jun 2026 V5 — Hansard alternative + blocked sources)

1. **TWFY client built** (`theyworkforyou.ts`): TheyWorkForYou API confirmed accessible from Railway (status 200, needs API key only). Source client + worker route + queue seeder all built. **ACTION NEEDED:** Register for TWFY API key at theyworkforyou.com/api/key, add `TWFY_API_KEY` to Railway env, then run `seed-twfy-queue.ts` (~4,700 monthly rows for Commons+Lords+Westminster Hall).

2. **FCA, ECHR, EUR-Lex blocked in manifest**: All APIs confirmed non-functional from Railway environment. Marked `blocked: true` — will show ⛔ blocked in email instead of ⚠️ failing.

3. **⚠️ failing state added to email**: Sources with queue rows but 0 corpus_sections now show `⚠️ failing` — visible signal that something is broken rather than appearing at 0%.

4. **Scheduler duplicate**: Not a code bug — two Railway deployments running simultaneously. Fix: manually redeploy `ingest-scheduler` in Railway dashboard to kill old instance.

5. **Data access request drafts**: `docs/data-access-requests/bailii-request.md` and `parliament-hansard-request.md` ready to send.

6. **corpus-census.md §8**: 19 sources with "client needed" added, with URLs for future build sprints.

### What just happened (3 Jun 2026 V4 — caselaw diagnosis + silent failure fixes)

1. **Caselaw `getTotalJudgments()` fixed** — TNA feed reports 7,489 pages but pages 1,500+ are empty. Binary-search now finds true last non-empty page (~1,499). We've ingested all ~74,950 available TNA caselaw judgments. `estSections` updated to 75,000.

2. **Silent failures now surfaced** — `processHansard`, `processFca`, `processEchr` now mark 'failed' (not 'done') when 0 items are yielded. Root causes confirmed:
   - FCA: `handbook.fca.org.uk` is a JS SPA — HTML scraping never works. Needs Playwright.
   - ECHR: `/app/query/results` returns 404 — API endpoint changed Jun 2026. Needs new endpoint.
   - Hansard: `api.parliament.uk/v1/hansard` returns 403 from Railway IPs. Written Answers/Statements use a different API that works fine.

3. **Reseed running:** UKPGA pre-1963 (6,897 rows) inserted; UKSI 2010-2026 completed; SSI/WSI enumeration rate-limited at 30s/request — still running.

4. **Queue state:** 5,307 primary-acts-pre-2000 pending rows, workers actively processing. Grand total corpus_sections: 587,128.

### What just happened (3 Jun 2026 Sprint 2 — queue gap seeding)

1. **Queue reset (Part 2):** 6,185 rows reset to pending for corpora with 0 corpus_sections (Hansard, FCA, ECHR, Treaties). Root cause: `api.parliament.uk/v1/hansard` returns 403 from Railway IPs — workers looped over 0 debates and marked rows done. FCA/ECHR similar pattern. Workers will retry on next claim cycle; Hansard API access needs Railway investigation.

2. **Queue reseed (Part 1):** `reseed-si-gaps.ts` run: (A) UKSI 2010–2026 enumeration from TNA (adds ~5k–8k new rows for 2015–2026 gap); (B) UKPGA pre-1963: 6,897 new rows inserted from Neon items with 0 sections; (C) SSI+WSI added to regional corpus. Workers now have 13,082+ pending rows — queue is no longer empty.

3. **Worker efficiency email (Part 3):** `queryWorkerThroughput` extended with sourceKey, efficiency %, and ⚡low/🔴critical flags. Each source has theoretical max adjusted by number of workers sharing the token bucket.

4. **Discovery fix (Part 4):** `TNA_CORPUS_META.regional` now includes ssi+wsi. `discoverTnaLegislation` detects under-seeded corpora dynamically (threshold 400 rows/yr) and triggers full historical scan when needed.

### What just happened (3 Jun 2026 late evening — corpus census sprint)

1. **Census scripts created** (`scripts/ingest/census/`): neon-counts.ts, railway-counts.ts, tna-counts.ts, source-counts.ts. Reusable — re-run quarterly.

2. **Census report written** (`docs/corpus-census.md`): Full findings with Neon vs. new pipeline comparison, gap analysis, source API counts.

3. **CORPUS_MANIFEST estSections updated** (`progress-reporter.ts`): Revised 8 estimates based on confirmed data. Most significant: SI-2010+ 300k→120k, Written Statements 50k→17,487. Total corpus estimate revised from ~7M to ~5.3M sections.

4. **Key action items (status):**
   - ~~SI-2010plus reseed~~ — Done V3 (TNA feed confirms counts were accurate, not a gap).
   - ~~Hansard/ECHR/FCA R2 backfill~~ — V2–V5: confirmed no R2 content. Workers marked done due to API failures (403/404). Hansard addressed via TWFY (V5). FCA/ECHR blocked.

### What just happened (3 Jun 2026 evening sprint)

1. **RangeError fix (Part 1):** `progressBar()` in `progress-reporter.ts` now clamps `pct` to `[0,100]` and `filled` to `[0,barWidth]`. Email sends were crashing every hour since compiled > estSections for some corpora.

2. **Worker throughput in email (Part 2):** Added `queryWorkerThroughput()` and a new "WORKER THROUGHPUT" section in `sendProgressEmail()`. Shows per-corpus sections/hr rate with mini bar, ⚠️ stalled / ℹ️ idle flags, total rate, stalled list. Uses 3-snapshot pivot to distinguish stalled vs idle.

3. **Diagnostics (Part 3):** Queue is exhausted (0 pending, 120 claimed, 61,829 done). Self-discovery is working — just trickle-rate new items now. Snapshot doubling bug (×2 SUM at 11:54 BST) is a one-time Railway restart overlap, not a systematic code bug.

4. **Sprint workflow (Part 4):** Created `docs/SPRINT.md` as the canonical home for CCh sprint briefs. Added sprint brief protocol to `CLAUDE.md` §12.

5. **Part 5 (read-only):** Confirmed Hansard/ECHR/FCA/Treaties have the R2 backfill gap. See CHANGE_LOG for exact counts and key patterns.

---

## IMMEDIATE ACTIONS REQUIRED (for Charlie)

### ONE REMAINING ACTION (Charlie)
- **Manually redeploy workers + scheduler** in Railway dashboard — so running containers pick up the `writeWorkerSnapshot()` call added to worker-queue.ts. Auto-redeploy only fires on new pushes; current containers are still running pre-V7 code. After redeploy, next hourly email will show per-worker throughput.

### V7 (all done ✅)
1. ~~Run `commit-all.sh`~~ — Done (`f912b3a`)
2. ~~`npx prisma migrate deploy`~~ — Done (workerId column applied)
3. Redeploy workers + scheduler — **Charlie to do** (see above)
4. ~~`seed-rate-limits.ts`~~ — Done (16 entries including fca-publications)
5. ~~Format backfill SQL~~ — Done (688 rows fixed)
6. ~~Verification SQL~~ — Done (1,652 pending, 200 claimed, workers active)

### V6b (resolved)
1. ~~Run `commit-all.sh`~~ — Done (`8cc89d9`). Workers stable since 22:07.
2. **Confirm workers stable** — check Railway logs after redeploy. Workers should no longer SIGTERM. Look for `[worker-N] all sources exhausted — sleeping 5min` instead of crash.
3. **Reset EUR-Lex queue rows** after redeploy: `UPDATE ingest_queue SET status='pending', "lastError"=NULL, claimed_by=NULL, claimed_at=NULL WHERE corpus='eur-lex' AND status='done';`
4. **Run `seed-lda-queue.ts`** — seeds 1,602 LDA Parliament queue rows: `NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json scripts/ingest/seed-lda-queue.ts`
5. **Run `seed-rate-limits.ts`** — adds `lda-parliament` rate limit: same tsx command, `scripts/ingest/seed-rate-limits.ts`

### V5 (still pending)
5. **Redeploy `ingest-scheduler` on Railway** — kills duplicate deployment causing alternating email formats. Settings → Deployments → Redeploy.
6. **Register TWFY API key** at theyworkforyou.com/api/key (free for civic use). Add `TWFY_API_KEY` to Railway env vars for all workers + scheduler.
7. **Run `seed-twfy-queue.ts`** after key is added — seeds ~4,700 monthly Hansard rows for Commons (1988–), Lords (1988–), Westminster Hall (1999–).
8. **Review data access request drafts** in `docs/data-access-requests/` — BAILII and Parliament Hansard bulk data.

---

## ARCHITECTURE SNAPSHOT (4 Jun 2026 — post V1)

- **20 Railway workers** ingesting via `worker-queue.ts` — queue-claim model with `FOR UPDATE SKIP LOCKED`
- **Scheduler** (`scheduler.ts`) — hourly loop, sends progress email, saves snapshots. **DB-based mutex added (V1)** — duplicate email sends now prevented without needing Railway redeploy.
- **Self-discovery** working — detects under-seeded corpora and triggers full historical scan
- **Corpus coverage:** ~587,128 Railway sections + 914,274 Neon legacy = ~1.5M total (approximately)
- **Hansard:** TWFY client built (needs API key). **MAJOR FIND: `theyworkforyou.com/pwdata/scrapedxml/` has free bulk Hansard XML from 1919 — awaiting CCh review before building client.**
- **LDA Parliament:** 5 datasets integrated, workers processing. `lda-commonswrittenquestions` had 388 HTTP 524 failures — retry fix applied (V1), rows need reset to pending.
- **EUR-Lex:** UNBLOCKED — SPARQL-based enumeration. Workers processing.
- **FCA Handbook:** Confirmed blocked (pure JS SPA). **FCA Publications confirmed accessible (V1 audit)** — source client added (GOV.UK search approach), seed row added.
- **ECHR:** Both APIs dead (api.echr.coe.int connect error, /app/query path 404). No accessible alternative found.
- **TNA Caselaw:** Complete (~74,950 available judgments all ingested).
- **New V1 sources:** nao-reports, fca-publications, sentencing-council, college-of-policing added — seeded and ready.
- **HMRC:** Stuck claimed row (26h) — reset needed (SQL above). Long-term: needs per-source queue split.

## DEPLOYMENT

- Ingest workers: Railway (20 services)
- Scheduler: Railway (1 always-on service — currently 2 running, needs redeploy)
- DB: Railway PostgreSQL (`switchback.proxy.rlwy.net:16156`)
- R2: Cloudflare `scrutinise-legislation` bucket
- Web app: Vercel (scrutinise.org)
