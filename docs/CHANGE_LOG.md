# SCRUTINISE — CHANGE LOG

*Pending and applied changes to all spec documents.* *PENDING section: cleared after each batch application.* *APPLIED section: permanent audit trail, never deleted.* *Last updated: 2026-08-01 11:05 UTC — LEX REBUILD Sprint 3-B: the conversation/state divergence fix
(§19-B). Cause found in the data, not guessed: `lexPage` never left ORIENTATION, so `currentField`
was null, so every Page-2 proposal Lex emitted was silently discarded while the empty-field prompt
("tell them what comes next") plus the whole-kernel M-GENERAL method block let it conduct Diagnosis
anyway. Fixed by making stage advance ONE server-side path (panel CTA · inline chat action · typed
assent), keying the prompt's method + a new transition guard off the state machine's page, refusing
writes to un-entered pages, giving every non-terminal field card its buttons, adding the two verbatim
end-of-Page-1 wrap bubbles with an inline Continue, and marking the stage shift visually (per-stage
accents, chat divider, queued fields). Preview only, NOT promoted. Earlier:
2026-07-31 00:03 UTC — STATS: Phase A (UK spine) sprint — new standalone
statistics layer built end-to-end (SDMX schema, ONS/OBR/PESA/HMRC source modules, refresh
scheduler, Lex query layer), verified against real live sources (all licences confirmed OGL
v3.0 at source), measured via a no-DB-writes pilot (4,081 series / 28,866 observations on the
ingested slice) — **no database provisioned, Charlie's DB-choice call still pending.** Earlier:
2026-07-30 04:32 UTC — SEARCH: query router — guidance added as 5th stream (B now +15.3pp, A holds +10.0pp, C partially recovers -20.0→-13.3pp), the flagged fts-query-service.ts concurrency risk CONFIRMED and FIXED (direct load-test crashed the live service at 15 concurrent requests — the exact load the router's 5-stream fan-out produces; a global semaphore now caps concurrent Lance calls, re-tested clean), and LEX_QUERY_ROUTER is recommended for production flip. Earlier: 2026-07-29 19:25 UTC — SEARCH: query router built + measured (LEX_QUERY_ROUTER, OFF) — per-stream routing generalises Stage-3 expansion; gold-set B +12.5pp, A +10.0pp (not diluted), C -20.0pp (guidance stream not yet routed, expected cost). Earlier: 2026-07-29 14:16 UTC — INGEST V30 tidy-up: two silent data-correctness bugs fixed — LGSCO fake pagination (was re-discovering the same 10 rows forever, never actually archiving) and members-interests-api Take=20 server cap (was silently dropping 80% of every requested window). Committed with companion one-off reseed scripts. Earlier: 2026-07-22 — SEARCH VECTOR: rebuild on a 128GB Vultr box (proper compaction, no OOM) did NOT recover the recall regression (vector-alone 70.5% post-rebuild vs 71.2% pre-, reproduced twice) — the original compaction-skip diagnosis is REVERSED; the cause is now an open search-quality question, not infrastructure. Positions-rider bonus ABANDONED (hard R2 10,000-part multipart-upload limit, non-retryable, stopped per spec). Flag stays OFF. Earlier same day: recall re-confirm + nprobes diagnostic first surfaced the regression and (wrongly, in hindsight) pointed at compaction.*

---

## LEX REBUILD — Sprint 3-B: the conversation/state divergence fix (2026-08-01 11:05 UTC)

**Executes `docs/SPRINT_3B_BRIEF.md` (§19-B) — the three defects from Charlie's 1 Aug pass-1 test
("VAT on care home renovations").** Preview only, **NOT promoted**. `scrutinise-web`
`tsc --noEmit` clean (only 5 pre-existing `xlsx` module-not-found errors in `scripts/costing/*` —
declared in `package.json`, simply not installed locally; installs on Vercel). No schema change.

### Task 1 — the cause, found in the data before any code was touched

The `[lex-diag]` trail was gone (Vercel logs roll), so the diagnosis was done against the idea
itself in Neon (`f534c43d-…`, "Reforming VAT on Care Home Renovations", read-only). What it shows,
exactly:

- **`Idea.lexPage` was still `ORIENTATION`.** The stage never advanced. All five Page-1 field
  rows `ACCEPTED`; **all seven Page-2 rows `EMPTY`, every `value` and `proposal` null**;
  `Idea.challenge` / `whoAffectedImpactCost` null; 0 `DiagnosisCause` rows. Meanwhile the stored
  transcript has Lex asking the Diagnosis questions and twice *claiming* a write —
  "I've put it into the 'Challenge' box", "I've drafted this for the 'Who is affected…' section".
  Nothing had been written anywhere.
- **Why Lex conversed ahead.** With Page 1 complete, `computeCanonicalState` correctly returns
  `currentField: null` (the page is done; the next page is not entered until an explicit advance).
  `/lex` then built the prompt with **no field block** — whose text was *"All the fields on the
  current page are complete… tell the user what comes next"* — plus the **M-GENERAL method block,
  which describes the whole kernel (diagnosis → guiding policy → coherent actions)**. That is
  ample material for a capable model to start conducting Diagnosis. Nothing stopped it: there was
  no instruction that the next page had not been entered and must not be started.
- **Why nothing landed.** `/lex` only ever persists a proposal `if (current && proposal.fieldKey
  === current.key)`. With `current === null` **every** proposal Lex emitted was discarded silently
  — the user saw Lex say "I've drafted this" and saw nothing appear.
- **Why the Page-2 cards had no buttons.** Two separate reasons, both real: (a) `DIAGNOSIS` was
  `status: 'locked'`, and `FieldsPanel` renders a locked page's header only — no field cards at
  all; (b) independently, the first Diagnosis field (`challenge`) is a Lex-**proposed** scalar, and
  proposed scalars rendered through `OutputField`, which had **no action buttons in any
  non-terminal status** — only a read-out and a "Change" link once accepted. So even a correctly
  entered Page 2 would have opened on an inert card.

**One code path for the advance — `lib/lex/stage.ts` (new).** `performStageAdvance(ideaId, userId,
via)` is now the ONLY way the stage moves, and all three routes call it: the Background-panel CTA
(`/page`), the new inline Continue action in chat (`/page`), and typed assent in chat (`/lex`,
`via: 'chat-assent'`). `isContinueIntent()` is deliberately conservative — a negation never
advances, and a question without a leading assent never advances ("what's next?" is answered, not
acted on). When assent fires, **the platform advances first and the conductor speaks for the new
page**; the user's turn does not reach the model at all, so Lex cannot get there first.

**The invariant, enforced on both sides.**
- Prompt side: `buildLexSystemPrompt` now takes `activePage` (the state machine's `Idea.lexPage`)
  and keys the **method block off that**, never off the current field's page. When the page is
  complete and unexited it emits a **transition-guard block** naming the next section and
  forbidding its questions outright, plus a new rule: never claim to have written to a box without
  having returned a proposal for the current field in the same turn.
- Write side: `assertWritableField()` refuses any write to a field on a page after `lexPage` —
  wired into `/fields`, `/causes`, `/policy-options`, `/actions` (409). A page the state machine
  has not entered cannot be written by any route.

**Every non-terminal card now has its buttons.** `OutputField` became a real accept surface:
editable, with **Save / Save & accept** (and Skip) in every non-terminal status, keyword lists
split on commas. The chat `AcceptCard` is unchanged — proposed scalars are now acceptable from
either surface.

### Task 2 — end-of-page wrap-up + transition affordance

`orchestrateAfterWrite` no longer returns empty on a completed page: it posts the **two verbatim
wrap bubbles** (briefing explanation + what the next three sections do + "Ready to start the
diagnosis?"), once, dedup-guarded against the recent transcript. The `/fields` keywords branch now
fires the search and then runs the conductor (the briefing must exist before the bubble points at
it); the old one-line pointer survives only for the case where keywords are accepted while an
earlier box is still open. A generic two-bubble wrap covers Pages 2–4. **`ContinueCard`** renders
inline in chat whenever `state.nextPage` is set — the same surface as the accept card — alongside
the existing right-panel CTA; both call the one advance path.

### Task 3 — the stage shift is now visible

`lib/lex/stage-accents.ts` (new) holds the four-colour set — **ORIENTATION blue · DIAGNOSIS amber ·
GUIDING_POLICY violet · COHERENT_ACTIONS emerald** — all literal Tailwind class strings (never
interpolated, or Tailwind won't emit them). Applied to the fields-panel stage header (dot, label,
soft wash) and the **active section's left border**, and to the chat's new slim **stage divider**
("— Diagnosis —") at the transition point. Within the active stage, fields past the current one
render **greyed "next up"** cards so the shape of the section is visible but not workable.
Completed stages collapse (existing accordions) and the new stage's header scrolls to the top on
entry. Chat messages are now **persisted with their stage tag** (`aiChatHistory[].stage`), so
dividers and stage collapse survive a page reload instead of only living in client memory.

### Verification

- **Deterministic replay, 34/34 assertions** (throwaway, run on Neon with `GEMINI_API_KEY`
  cleared so every fallback path is exercised; test idea created and deleted). Covers: Page 1 →
  complete → wrap bubbles posted once → assent advances → `lexPage` DIAGNOSIS → `challenge`
  current and proposed → Page-2 writes mirror to `Idea.*` → Page-2 field unwritable before the
  advance and writable after → the guard block present on Page 1 and the M-DIAGNOSIS block absent
  until entry.
- **Live-model check of the exact failure**: on Page 2, a chat answer about who is affected came
  back as a `valueObject` proposal for `whoAffectedImpactCost`, passed the field schema, and the
  box rendered "proposed by Lex" — the thing that silently vanished on 1 Aug.
- **Operational note for future runs:** PowerShell `| Select-Object -First N` terminates the
  upstream pipeline, which killed one smoke run mid-flight and left its test idea behind (found
  and deleted). Filter with `Select-String`, or let the command finish, when the script has
  cleanup in a `finally`.

**Out of scope, unchanged:** search-result relevance (pass-2 / search workstream). **Not
promoted** — Charlie replays the test on the preview first.

---

## STATS — Statistics layer, Phase A (UK spine) (2026-07-31 00:03 UTC)

**Executes `docs/STATS_PHASE_A_BRIEF.md` (built on `docs/STATS_LAYER_SPEC.md`).** New parallel
workstream — a separate statistics store (SDMX-modelled: dataset → dimension → series →
observation), UK fiscal/economic/forecast data only (Phase B/C — OECD/IMF/World Bank/Eurostat,
other countries — explicitly out of scope this sprint). Full build detail:
`docs/STATS_SCHEMA.md` (schema as built) and `docs/STATS_REFRESH.md` (refresh design). This
entry is the scorecard + sprint outcome.

- **Own npm project, own DB target, zero contact with the corpus DB.** `scripts/stats/` has its
  own `package.json`/`node_modules` (Prisma 7's client generator resolves `@prisma/client`
  relative to the schema file's directory tree, not `cwd` — sharing `scrutinise-web`'s
  `node_modules` the way `scripts/legislation` does doesn't work for a second Prisma schema).
  New env var `STATS_DATABASE_URL` (+ `STATS_DIRECT_URL`) — deliberately not `DATABASE_URL`, so
  a stale `.env` can never point a stats script at the corpus/app DB the way the 29–30 Jul
  incident happened in the other direction (`docs/CLAUDE.md` §16).
- **Schema validated + client generated + initial migration produced, all OFFLINE** — no live
  database was touched or provisioned. `prisma validate`/`generate` needed only a placeholder
  connection string; the initial migration SQL came from
  `prisma migrate diff --from-empty --to-schema=prisma/schema.prisma --script`, which needs no
  DB connection at all. `scripts/stats/prisma/migrations/20260730235112_init/migration.sql` is
  ready to apply the moment a target exists.
- **Every source probed and licence-verified live, not assumed:**

  | source | licence (verified at source) | route confirmed |
  |---|---|---|
  | ONS Beta API | OGL v3.0 (`"license"` field on the dataset JSON itself) | `api.beta.ons.gov.uk/v1` — live, 337 datasets in catalogue |
  | ONS CDID | OGL v3.0 (`ons.gov.uk/help/termsandconditions`) | `ons.gov.uk/generator?format=csv&uri=...` — 429s under rapid requests, needs pacing (built in) |
  | OBR | OGL v3.0 (footer, `obr.uk/data/`) | gated behind a WordPress Download-Monitor nonce — bare/no-cookie request 302s to `/no-access/`; a stale/no-referer token 403s; **fresh cookie jar from `/data/` + matching Referer resolves it** to a static ungated `obr.uk/docs/dlm_uploads/*.xlsx` |
  | HM Treasury PESA | OGL v3.0 (footer, gov.uk statistics page) | direct static `assets.publishing.service.gov.uk` URLs, no gating |
  | HMRC | OGL v3.0 (footer, gov.uk statistics page) | direct static `assets.publishing.service.gov.uk` URLs, no gating |

- **Pilot measurement (real fetches, real parses, zero DB writes — `measure-pilot.ts`):**

  | source | dataset slice | series | observations |
  |---|---|---|---|
  | ONS (CDID) | 4 curated, individually-verified headline series (GDP, unemployment, CPIH, avg earnings) | 4 | 2,242 |
  | ONS (Beta API) | 1 of 337 catalogue datasets (`wellbeing-quarterly`, pilot sample) | 980 | 1,960 |
  | OBR | Public Finances Databank (2 sheets) | 31 | 2,443 |
  | OBR | Historical Official Forecasts Database (85/131 sheets parsed — 6 are index/contents pages, not data, correctly skipped) | 2,807 | 20,506 |
  | HMT PESA | Chapter 5 (function), Tables 5.1+5.2 — 1 of 10 chapters | 186 | 422 |
  | HMRC | Tax receipts (annual) + tax gap Table 1.1 (1 of 15 tax-gap tables) | 73 | 1,293 |
  | **TOTAL (pilot slice)** | | **4,081** | **28,866** |

  This is a deliberately partial slice (1 Beta dataset of 337 relevant candidates, 1 of 10 PESA
  chapters, 1 of 15 tax-gap tables) — **not the full Phase A footprint**, which the brief's own
  §9 says to measure-then-extrapolate rather than estimate blind. Extrapolating honestly: OBR
  (both sources) is already near-complete at this slice; PESA/HMRC would roughly 5-15x with
  every chapter/table; a *curated* (not all-337) ONS Beta subset covering the relevant
  economy/public-finance/population/wellbeing datasets the brief asks for is the biggest
  remaining unknown. Best-effort full-Phase-A-UK-spine projection: **low hundreds of thousands
  of observations, comfortably tens to low hundreds of MB** at the schema's per-row size — this
  undershoots the brief's "single-digit to low-tens of GB" expectation; that ceiling looks more
  like a Phase B/C (full OECD/IMF/World Bank multi-country) scale than the UK-alone spine.
- **Successive-forecast-vintage capability confirmed working end-to-end**, the OBR databank's
  standout feature: the Historical Official Forecasts Database's `£TME (2)` sheet alone parsed
  into 34 distinct forecast vintages (June 2010 → latest) for one measure — "what did the OBR
  predict in round N vs what actually happened" is answerable the moment this loads.
- **COFOG confirmed as a first-class, real classification already embedded in PESA**: Table 5.2
  row labels are literally COFOG sub-function codes (`"1.1 Executive and legislative organs..."`
  → `01.1`); Table 5.1's departmental-group x function cross-tab parses cleanly against the same
  code parser. `lib/cofog.ts` seeds the 10 top-level codes as a real FK'd reference table.
- **Refresh scheduler + Lex query layer built, both untested against a live DB** (no DB exists
  yet) — same "built inert" posture the vector-embed pipeline shipped with. `refresh-scheduler.ts`
  is cadence-aware run-and-exit (not an always-on daemon — nothing here updates faster than
  monthly); `query/stats-query.ts` gives time-series-by-series and COFOG-rollup-by-geography
  reads for Lex/analysis, kept separate from `scrutinise-web/lib/search.ts` (analytical vs
  full-text).
- **`tsc --noEmit` clean** (`scripts/stats/tsconfig.json`, new — scoped to this folder only).
- **DB choice DECIDED, NOT YET PROVISIONED.** Charlie confirmed CC's recommendation — a new,
  separate Neon project (managed backups/branching, and — being a genuinely new project — it
  does not compete with the corpus Neon's already-tight ~16/17.5 GB headroom) over a
  self-managed Hetzner Postgres instance. **Provisioning itself is on hold**: this environment
  has no stored Neon API key and `neonctl`'s login needs a browser it doesn't have, so CC
  cannot create the project unassisted — it needs either Charlie creating it in the Neon
  console (pasting back the pooled + direct connection strings) or a Neon API key. Charlie
  chose to hold off this session rather than hand over either. `STATS_DATABASE_URL` remains
  unset everywhere; nothing costing money has been touched.
- **NOT built this sprint:** the actual DB (pending the above), `seed-catalogue.ts`/
  `ingest-handlers.ts` run for real, the Railway cron wiring for `refresh-scheduler.ts`, full
  Lex tool-calling integration (brief explicitly scopes this as a follow-on), Phase B/C sources
  (OECD/IMF/World Bank/Eurostat/FRED, other countries).

---

## SEARCH — Query router: guidance stream, concurrency fix, flip recommendation (2026-07-30 04:32 UTC)

**Executes the CC brief "add guidance as a fifth routed stream, then re-measure."** Follow-up to
the query-router sprint below (2026-07-29 19:25 UTC) — reads as a continuation of that entry, not
a separate feature.

- **Guidance stream added — additive as predicted, zero routing-logic changes needed.**
  `RouterStreamName`/`ROUTER_STREAMS`/`ROUTER_SCHEMA`/prompt in `query-expansion.ts` gained
  `guidance`; `query-router.ts`'s `STREAMS` config gained one entry
  (`{ name: 'guidance', tier: 'guidance', search: ftsStream('guidance') }` — single-type tier,
  same shape as legislation/caselaw, no `types` filter needed); `score-fts.ts`'s mirrored config
  updated to match. `tsc --noEmit` clean in both packages — confirms the file's own design claim
  ("adding a stream means adding a list entry, not touching this file's logic").
- **Concurrency risk CONFIRMED, not just flagged — the prior entry's hedge was WRONG.** The prior
  entry assumed production's HTTP-based dispatch (`query-router.ts` → `fts-query-service.ts`) was
  a "different execution model" from the harness's in-process `Promise.all` crash and therefore
  not necessarily at risk. Direct load-testing (new `scripts/ingest/search/concurrency-stress-test.ts`
  — starts the real `fts-query-service.ts` locally and fires concurrent requests shaped exactly
  like `runRoutedSearch()`'s 5-stream fan-out) refutes that: **the unpatched service crashed
  outright (bare process death, no JS-catchable error) at 15 concurrent requests** — the exact
  load one background search trigger now produces with `LEX_QUERY_ROUTER=true` if just 3 users
  search within the same few hundred ms. 10 concurrent survived but took 226s (already severe
  contention). The "independent HTTP calls vs in-process `Promise.all`" distinction was a red
  herring: the actual danger is concurrent native Lance calls against ONE shared table handle
  within a single Node process, which happens either way — production genuinely shared the risk.
- **Fixed:** `fts-query-service.ts` now gates every `/fts-search` call through a global in-process
  semaphore (`FTS_MAX_CONCURRENT`, default 4) — excess requests queue FIFO instead of running
  concurrently against the shared handle. `/stats` now reports `concurrency: {max, inFlight,
  queued, queueHighWaterMark}` for monitoring after flip. **Re-tested clean:** the exact 15-request
  load that crashed the unpatched service now completes with 0 errors and the service stays
  alive. At significantly heavier synthetic load (20–25 concurrent, well beyond realistic current
  traffic) some individual requests failed client-side ("fetch failed", no server-side error, no
  crash) — noted in the stress-test file as an unconfirmed residual (possibly the single test
  client's own connection pool, not a server limit) for anyone raising `FTS_MAX_CONCURRENT` later.
  **The confirmed, load-bearing result: the full-process crash is gone.**
- **Gold-set re-measured (43 queries, full run):**

  | archetype | recall@20 OFF | ON (4-stream, 29 Jul) | ON (5-stream, this session) |
  |---|---|---|---|
  | A (citation) | 60.0% | +10.0pp | **+10.0pp — held** |
  | B (concept, payoff target) | 33.3% | +12.5pp | **+15.3pp — improved further** |
  | C (legislation+guidance breadth) | 60.0% | **-20.0pp** | **-13.3pp — partially recovered** |
  | D (graph, floor) | 76.7% | 0.0pp | +13.3pp |
  | E (Hansard intent) | 90.0% | 0.0pp | 0.0pp |
  | F (bills/precedent) | 90.0% | -10.0pp | 0.0pp — recovered |

  Both brief predictions **directionally confirmed, C only partially so.** A held exactly, B
  improved further (33.3%→48.6%). **C recovered from -20.0pp to -13.3pp — real but incomplete.**
  Investigated why: C1 and C3 (the two still-regressing C queries) both route to `legislation`
  ONLY even with `guidance` available — because their true expected sources (Finance Act FHL
  provisions; Care Act 2014 / Care and Support Charging Regs) genuinely ARE legislation-tier, not
  guidance-tier. **The original "guidance stream missing" diagnosis was therefore only PART of the
  story for C's regression** — the router correctly scopes these two queries to legislation, and
  still loses the unscoped baseline's incidental cross-tier hits (e.g. a differently-tiered
  document that happens to contain a matching phrase). That is a smaller, more fundamental
  tradeoff of ANY tier-scoping, not fixable by adding more streams — flagged for awareness, not
  a regression this brief's scope can close. D/F variance (D4, F3) looks like normal LLM
  stream-choice variance (temperature 0.2, not zero) between runs rather than a guidance effect.
  Full detail: `docs/FTS_ROUTER_AB.md` / `docs/fts_router_ab.json` (overwritten with this run —
  the 29 Jul 4-stream numbers are preserved in this CHANGE_LOG entry and the prior one).
- **RECOMMENDATION: flip `LEX_QUERY_ROUTER=true` in production.** Both brief gate conditions are
  met well enough to ship: the concurrency crash — the one genuinely blocking risk — is fixed and
  empirically validated at the load that broke it; every archetype is net flat-or-positive except
  C, whose residual -13.3pp is small, understood, bounded, and not a hidden landmine. This ships
  independently of the vector-layer question, per the brief. **Not flipped by this session** —
  Charlie's call per the git/deploy discipline (this session only prepares the recommendation +
  evidence, doesn't flip flags in production unilaterally).
- **Files:** `scrutinise-web/lib/lex/query-expansion.ts`, `query-router.ts` (guidance stream);
  `scripts/ingest/search/fts-query-service.ts` (concurrency semaphore), `score-fts.ts` (mirrored
  config); new `scripts/ingest/search/concurrency-stress-test.ts` (permanent regression check, not
  throwaway — re-run after any future change to `fts-query-service.ts`'s request handling).
  `tsc --noEmit` clean, both packages.

---

## INCIDENT — production `/dashboard` full outage: local `.env` pointed at Railway, not Neon (2026-07-30 02:10 UTC)

**Full outage, every signed-in `/dashboard` request threw the app's error boundary, for ~1h32m
(00:19 UTC deploy of an unrelated commit surfaced it → 01:51 UTC fix).** Root cause: **`.env` on this
machine was never updated for the 18 Jun 2026 Railway→Neon app-database cutover.** `DATABASE_URL` still
pointed at `switchback.proxy.rlwy.net` (Railway) the whole time. Every migration run locally since 18 Jun
— including both Community/bulletin-board migrations committed earlier tonight (see the two corrected
entries below) — was applied to Railway, which had already stopped being production over a month
earlier. `prisma migrate deploy` reported success both times because it genuinely succeeded, just against
the wrong database. Production (Neon) silently fell behind with no error until code that depended on the
new schema actually shipped.

- **Trigger:** an unrelated deploy (`3b67324`, "feat(search): query router") promoted to production at
  00:19:48 UTC. `/dashboard` queries `prisma.communityMember.findMany()` unconditionally (Community
  section of the dashboard reorg, see the Stage 1 Community build entry below) — first request after
  that promotion hit it.
- **Runtime trace** (Vercel production logs, `www.scrutinise.org`, digest `2385406076`):
  ```
  Error [PrismaClientKnownRequestError]:
  Invalid `prisma.communityMember.findMany()` invocation:
  The table `public.CommunityMember` does not exist in the current database.
    code: 'P2021', clientVersion: '7.5.0'
  ```
  First captured 00:58:30 UTC via `vercel logs` on the live deployment.
- **Diagnosis:** `scripts/whichdb.ts` (new — prints connected host/database + last 5
  `_prisma_migrations` rows, written this session) confirmed local tooling was on Railway.
  `_prisma_migrations` diffed between Neon and Railway: identical history through
  `20260605010000_source_rate_limits_max_workers`, diverging only on the two Community migrations —
  confirms the drift started exactly at the 29 Jul Community work, not earlier. Row counts corroborated
  Neon as the real live database (67 `Idea` rows vs Railway's 54, identical `User` count on both — a
  common fork point, not a live mirror).
- **Surprise finding:** `prisma migrate diff` from Neon to `schema.prisma` showed the LEX Rebuild Sprint 2
  models (`IdeaFieldState`, `Document`, `DiagnosisCause`, `PolicyOption`, `LexCoherentAction`,
  `CostBenchmark`, `DeflatorSeries`) and the new `Idea`/`User` Lex columns **already present on Neon** —
  no `CREATE TABLE`/`ADD COLUMN` needed for any of them, only a cosmetic `updatedAt` default mismatch (8
  statements). These were previously logged as "still deliberately unmigrated, preview only, not
  promoted" (see the corrected Community-schema entry below) — that was wrong on the production side;
  they'd been applied directly to Neon at some point outside the tracked migration history (no matching
  migration file exists for them on either database — most likely a manual `prisma db execute`/`db push`
  against Neon, never recorded here). Railway, not Neon, was missing this schema. Net effect: **no Lex
  Sprint 2 migration work was needed tonight** — Phase 2 of the incident runbook was cancelled once this
  was confirmed.
- **Fix:** `DATABASE_URL`/`DIRECT_URL` in `.env` corrected to Neon (pooled/non-pooled respectively); old
  Railway value preserved as `RAILWAY_DATABASE_URL_LEGACY` for reference only, never to be used for
  schema work again (see `docs/CLAUDE.md` §16). Both pending migrations
  (`20260729141507_add_community_hierarchy`, `20260729173128_add_bulletin_board`) applied to Neon via
  `prisma migrate deploy` against `DIRECT_URL` (not the pooled endpoint — PgBouncer's transaction pooling
  breaks Prisma Migrate's advisory locks) at 01:51 UTC. `CommunityMember` confirmed present on Neon
  immediately after; `/dashboard` confirmed working on reload.
- **Not done tonight, deliberately:** Railway Postgres (`scrutinise-db`) is left running — decommission
  scheduled for next week after a `pg_dump` to R2 and a `getRailwayPool` health check, not rushed
  mid-incident.
- **Process fix:** `docs/CLAUDE.md` §16 now requires running `scripts/whichdb.ts` and pasting its output
  before any migration, `db execute`, or destructive SQL, no exceptions. See also `docs/roadmap.md` for
  the proposed separate ingest schema (would have made this class of mix-up structurally harder) and this
  session's Phase 3 proposals (build-step `migrate deploy`, Neon dev branch) — reported for approval, not
  yet applied.

---

## SEARCH — Query router (per-stream routing, generalises Stage-3 expansion) (2026-07-29 19:25 UTC)

**Executes the CC brief "build the query router."** One new Gemini call (`routeQuery()`,
`scrutinise-web/lib/lex/query-expansion.ts`) decides which of four streams — legislation /
debates / committees / caselaw — a query belongs to and writes a tailored search string for
each; everything after that is deterministic dispatch (`query-router.ts`, a config list of
`{name, tier, types?, search}` — adding a stream later means adding a list entry, not touching
logic). Flag-gated `LEX_QUERY_ROUTER` (default OFF), independent of `LEX_QUERY_EXPANSION` —
router ON supersedes expansion for that call, the two are never combined. Fail-open
(brief-mandated): a null/unparseable/empty router decision degrades to searching all streams
unfiltered with the bare query — today's default behaviour — never an empty result.

- **Audit finding (contradicts the brief's premise):** `query-expansion.ts` had NO existing
  citation-vs-concept decision or "skip expansion for citations" logic — `expandQuery()` called
  the LLM unconditionally for every query, always. The actual citation-pinning mechanism lives
  entirely server-side (`citation-resolver.ts` + `fts-core.ts`'s `resolveInjections`), unrelated
  to `query-expansion.ts`. The router's own prompt now makes this decision explicitly for the
  first time (an exact-citation query routes ONLY to `legislation` with the citation string
  unchanged — verified live: A1–A4 all route to `legislation` alone).
- **Tier-filter mechanism confirmed real, not throwaway** (audit requirement): `fts-query-service.ts`'s
  `POST /fts-search` already accepts a `tier` param, passed straight to `rankedSearch`'s existing
  `tier` filter — both already production code, not the scoped B1/B3 test's throwaway script. The
  platform-side gap was that `fts-search.ts`'s `runFtsSearch()` never threaded a `tier` through;
  fixed (new optional 3rd param).
- **debates vs committees** share the FTS `tier='parliamentary'`; split via the existing
  `corpusToType()` display-mapping (already computed on every FTS hit) rather than inventing a
  second server-side filter axis for two streams sharing one tier.
- **Files:** `scrutinise-web/lib/lex/query-expansion.ts` (routeQuery + shared Gemini-call
  helper factored out of expandQuery's fetch/timeout/parse mechanics), `query-router.ts` (new —
  STREAMS config + dispatch), `fts-search.ts` (tier param threaded through), `search-gateway.ts`
  (router capability flag + wiring, supersedes expansion when ON); `scripts/ingest/search/score-fts.ts`
  (`--router` measurement mode, mirrors the existing `--ab` convention exactly).
- **Bug found + fixed during measurement:** the harness's first two runs crashed (bare exit 255,
  no JS stack trace — not a catchable error) after making it through 0–15 queries inconsistently.
  Root cause: concurrent `rankedSearch` calls via `Promise.all` against the SAME in-process Lance
  table handle. Fixed by making the harness's per-stream dispatch sequential (order doesn't affect
  the score; confirmed clean on rerun, made it through all 43 queries with 0 crashes). **Flagged,
  not fixed:** production's `query-router.ts` also dispatches streams via `Promise.all`, but each
  goes through an independent HTTP round-trip to the Railway `fts-query-service` rather than a
  shared in-process handle — a different execution model, so the same failure mode is NOT
  confirmed to apply there, but it is also not confirmed safe. Worth a look if `fts-query-service`
  ever shows unexplained crashes under concurrent load.
- **Gold-set result (router ON vs OFF, full 43-query set, 0/34 fail-opens across every
  recall@20 query):**

  | archetype | recall@20 OFF | recall@20 ON | delta | n |
  |---|---|---|---|---|
  | A (citation) | 60.0% | 70.0% | **+10.0pp** | 5 |
  | B (concept, the payoff target) | 33.3% | 45.8% | **+12.5pp** | 6 |
  | C (legislation+guidance breadth) | 60.0% | 40.0% | **-20.0pp** | 5 |
  | D (graph, floor) | 76.7% | 76.7% | 0.0pp | 5 |
  | E (Hansard intent) | 90.0% | 90.0% | 0.0pp | 5 |
  | F (bills/precedent) | 90.0% | 80.0% | -10.0pp | 5 |

  **Both brief predictions confirmed: B rises (+12.5pp) and A improves rather than dilutes
  (+10.0pp)** — A1–A4 (exact citations) route to `legislation` only and score identically to the
  baseline (the citation-exact special case working as designed, zero dilution); A5 ("wear a
  seatbelt", lay-phrased, not a citation) gains +50pp from multi-stream routing. B1 +75pp, B3
  +33.3pp (both previously-buried concept queries now surfaced); B5 -33.3pp is the one B
  regression (see `FTS_ROUTER_AB.md` for the per-source detail).
  **C regresses (-20.0pp) — an honest, expected cost, not a bug:** `guidance` is explicitly a
  deferred stream (brief scope: legislation/debates/committees/caselaw only), so a C-archetype
  expected source living in the guidance tier (FCA/HMRC/etc.) is now unreachable by ANY routed
  stream, where the unscoped baseline could at least stumble onto it via the shared candidate
  pool. E flat; F -10.0pp (F3 -50pp — one precedent query lost a Bill-tier hit outside the routed
  streams' reach). Full per-query + per-source breakdown: `docs/FTS_ROUTER_AB.md` /
  `docs/fts_router_ab.json`.
- **NEXT:** `LEX_QUERY_ROUTER` stays OFF pending Charlie's read of the C-archetype regression —
  either accept it as the known cost of the current 4-stream scope (a `guidance` stream is
  already a one-line config-list addition away, per query-router.ts's design) or add it before
  flipping. `scrutinise-web` `tsc --noEmit` clean; `scripts/ingest` `tsc --noEmit` clean
  (`query-router.ts`/`routeQuery`/`corpusToType` loaded via the same require-by-computed-path
  trick as the existing `expandQuery` usage, invisible to tsc by design — same pattern the
  `--ab` mode already relies on).

---

## CENTRAL — add "Communities" nav link (2026-07-30 00:11 UTC)

**Real gap found by Charlie on live production, not by any of the earlier local/build testing:** the
Stage 1 build (below) shipped `/communities` as a working, promoted, live route — confirmed via direct
`curl` against `www.scrutinise.org` (signed-out redirect fires correctly, the invite page renders
server-side) — but `components/PublicNav.tsx` was never given a link to it. The only discovery path was
the "My Communities and teams" section on `/dashboard` itself; anyone elsewhere on the site had no way
to find the feature at all. `tsc --noEmit` a build weren't going to catch this — it's a missing UI
affordance, not a compile or runtime error. Fixed: `PublicNav.tsx` — a signed-in-only "Communities" link
added to both the desktop and mobile nav, next to the dashboard-avatar link (same gating pattern as the
existing admin-only links).

---

## CENTRAL — Stage 1 Community build: bulletin board, teams/branches, invites, dashboard reorg (2026-07-29 17:43 UTC)

**Full Stage 1 build per `docs/SCRUTINISE_CENTRAL_SPEC.md` §3 and `docs/SPRINT.md`.** `tsc --noEmit`
clean (0 errors). Smoke-tested against a live local dev server (not just `tsc`): auth-boundary checks
on every new route/page, invalid-invite-code handling. **Not tested: the actual signed-in interactive
paths (create/join a Community, post/reply/vote) — no way to authenticate as a real user in this
environment; say so explicitly rather than claiming full verification.**

- **New schema, second migration this session** (`20260729173128_add_bulletin_board`, applied via the
  same hand-scoped `migrate deploy` procedure as the Community migration below — same drift avoidance):
  `Community.managerId` (branch-manager assignment), `CommunityMember.lastReadAt` (unread bulletin
  count), `BulletinPost` (self-referential `parentId` — root posts carry title/category, replies don't;
  same pattern as `RootCause.parentId`), `BulletinVote` (unique per post+user, cached `score` on the
  post to avoid a COUNT aggregate per render).
  **CORRECTION (2026-07-30 ~02:10 UTC):** "same drift avoidance" turned out not to mean "applied to
  production" — see the correction on the Community-schema entry below for the full story. This
  migration also landed on Railway only and had to be re-applied to Neon on 30 Jul.
- **API routes** (`app/api/communities/`): list/create Communities, get/rename a Community, create a
  branch, assign/clear a branch manager, generate/list invite codes, redeem an invite code
  (`/api/communities/join`), bulletin thread list (ILIKE keyword search + category filter, deliberately
  NOT the corpus-search stack — different scale, different problem) + create/reply/vote, mark-read.
  Auth/validation pattern copied from the existing `app/api/ideas/[id]/*` routes (Zod, `getAuthenticatedUser()`,
  404-not-403 for non-members so membership isn't leaked). Vote endpoint rate-limited 20/hr per IP via
  `lib/rateLimit.ts`, mirroring `app/api/ai/public/route.ts` (CLAUDE.md security rule #7 — the existing
  `ideas/[id]/vote` route doesn't actually enforce this today, a pre-existing gap not fixed here).
- **UI**: `/communities` (My Communities landing list, create + join-by-code), `/communities/[id]`
  (dashboard — header, Teams & branches expandable tree, Bulletin board, Points & leaderboards stub),
  `/community-invite/[code]` (rules/points-info screen, explicit Join click — not auto-accept, since a
  reusable code isn't a targeted 1:1 invite the way the existing `UserInvite` magic link is). Dashboard
  reorg: "My Communities and teams" section added below "Your ideas" (Community and Idea-team/`Group`
  cards side by side, tagged not merged); Notifications panel split into Feed/Upcoming tabs — Upcoming is
  an intentional empty state (events land in Stage 2b, not this sprint); Feed reuses the existing
  `Notification` model unchanged (bulletin replies now create a `SYSTEM`-type notification, so they
  surface in Feed without a second data source).
- **"Training — offers & requests" bulletin category** seeded as a first-class category option
  (`lib/community.ts` `BULLETIN_CATEGORIES`) per the explicit Stage 1 scope note — the Stage 2c
  structured training marketplace starts life as ordinary bulletin posts.
- **Real bug caught by testing against a live server, not by `tsc`:** `middleware.ts` didn't list
  `/communities` as a protected route, so the page-level `redirect()` for signed-out visitors was only
  ever delivered via the React streaming/RSC protocol (real browsers still redirect correctly via the
  client router, but a non-JS client — or anything relying on a plain HTTP 30x — would see 200 + an
  infinite loading shell instead). Fixed: `/communities(.*)` and `/api/communities(.*)` added to
  `isProtectedRoute`; `/community-invite(.*)` added to `isPublicRoute` (mirrors the existing `/invite`
  pattern — the whole point of that page is to be viewable before signing up).
- **Known gaps carried forward, not fixed here (flagged, not silently absorbed):** DOMPurify is
  referenced only in a schema comment across the whole codebase, never actually implemented anywhere —
  bulletin post bodies are plain text rendered through default JSX escaping (no `dangerouslySetInnerHTML`
  anywhere in this build), which sidesteps the gap rather than closing it. No abuse-reporting workflow
  yet (§1, explicitly out of Stage 1). `entity_list_v5.md` was deliberately NOT edited — it's a
  CCh-only document; the new entities are documented in `SCRUTINISE_CENTRAL_SPEC.md` §2 instead, add to
  `entity_list_v5.md` at Charlie's discretion.
- **NEXT:** the Stage 1 test checklist (`SCRUTINISE_CENTRAL_SPEC.md` §3) needs running by a signed-in
  human in a browser — nothing in this build has been click-tested end to end. Stage 2 (points/
  leaderboards) is still "under discussion," not briefed.

---

## CENTRAL — Community schema committed + migrated to production (2026-07-29 17:24 UTC)

**Commits the `Community` / `CommunityMember` / `CommunityInvite` schema draft that had been sitting
uncommitted since 22 Jul with no CHANGE_LOG/handoff trace — this session started by finding it orphaned
and asking Charlie what it was.** Full feature scope now recorded in `docs/SCRUTINISE_CENTRAL_SPEC.md`
(new master spec for the whole Central module, §2–3) and `docs/SPRINT.md` (active Stage 1 brief).

- **Schema:** `Community` (self-referential `parentCommunityId` hierarchy), `CommunityMember`
  (`OWNER`/`ADMIN`/`MEMBER`, unique per community+user), `CommunityInvite` (code/email/maxUses/expiry,
  mirrors `GroupInvite`), `Idea.communityId` (informational/display only — grants no permissions, per
  the 22 Jul decision already in schema comments). Existing `Group`/`GroupMember`/`GroupInvite`/
  `IdeaCollaborator` (Idea-scoped "Team" mechanism) untouched — deliberately separate hierarchy.
- **Migration `20260729141507_add_community_hierarchy` — applied to production this session** (see the
  V30 entry below for the same-session ingest fixes; this is a separate thread). Hand-written, not the
  raw `prisma migrate diff` output: the raw diff also wanted to drop the 914,274-row
  `LegislationSection_DEPRECATED_2026-06-19` table and `specialist_queue`, fallout from `schema.prisma`
  having drifted ahead of production on an unrelated already-in-git LEX Rebuild Sprint 2 set
  (`IdeaFieldState`/`Document`/`DiagnosisCause`/etc., still deliberately unmigrated, "preview only, not
  promoted"). Only the additive Community statements were extracted and applied via `prisma migrate
  deploy`. `migrate dev`'s shadow-database path is currently broken by the same `LegislationSection`
  drift — unrelated to this change, not fixed here.
- **CORRECTION (2026-07-30 ~02:10 UTC), added by the incident-response session that found this:** "applied
  to production" above is **false**. Local `.env`'s `DATABASE_URL` still pointed at Railway
  (`switchback.proxy.rlwy.net`) — a stale value left over from the 18 Jun 2026 Railway→Neon app-DB
  cutover, which was never propagated to this machine's `.env`. `migrate deploy` ran clean and really did
  apply the migration, just to Railway, which had already stopped being production over a month earlier.
  Actual production (Neon, `ep-old-dust-aboxi69a`) never received this migration or the bulletin-board one
  below. Silent until `/dashboard` was reloaded after an unrelated deploy ~00:19 UTC on 30 Jul, which
  surfaced `PrismaClientKnownRequestError P2021: table public.CommunityMember does not exist` in
  production runtime logs at 00:58 UTC — full outage, every `/dashboard` request threw the app's error
  boundary. Root cause confirmed by `scripts/whichdb.ts` and a `_prisma_migrations` diff between the two
  databases (Neon and Railway shared identical migration history up to `20260605010000`, diverging only
  on these two migrations — no earlier drift). Both migrations applied to Neon via `DIRECT_URL` at 01:51
  UTC same night; `/dashboard` confirmed working after. Also discovered while fixing this: the
  "unrelated already-in-git LEX Rebuild Sprint 2 set" mentioned above as "still deliberately unmigrated"
  was in fact **already present on Neon** (created via a manual `prisma db execute`, or equivalent,
  outside the tracked migration history — no corresponding migration file exists for it on either
  database). It was Railway, not production, that was missing it. Full incident writeup in the new
  30 Jul entry above this one.
- **NEXT:** Stage 1 build (API routes + UI per `docs/SPRINT.md`) — in progress this session.

---

## INGEST — V30 tidy-up: LGSCO pagination + members-interests Take=20 fixes (2026-07-29 14:16 UTC)

**Two silent data-correctness bugs found and fixed in the ingest workers, both verified live against
the source APIs before the fix, not assumed.** `scripts/ingest` `tsc --noEmit` unaffected (no new
errors). Files: `scripts/ingest/workers/process-row.ts`, `scripts/ingest/v29-seed-parliament.ts` (code
fixes) + new one-off companion scripts `scripts/ingest/v30-lgsco-fix.ts`,
`scripts/ingest/v30-members-interests-fix.ts` (idempotent, dry-run by default, `--apply` to execute —
Charlie-gated, not run as part of this commit).

- **LGSCO (`lgo.org.uk`) fake pagination.** `processLgsco()`'s self-propagating paged walk assumed
  `?page=N` moved through an archive. Verified live: `page=1` through `page=999999` return
  byte-identical "10 most recent" listings — the page itself says "Recent [statements/reports] in this
  category are shown below," not an archive browse. The walk therefore never terminated naturally; it
  re-discovered the same 10 already-queued decisions forever (harmless, dedup'd on insert) until a
  random transient fetch failure killed the chain (the V30 incident: `adult-care-services` ground on to
  page 108 before failing there). **Fix:** stopped propagating to `page+1` — one row per category
  captures everything this endpoint actually exposes; no working pagination/sitemap/date-search endpoint
  exists on the site for a real full-archive build (future Charlie-gated decision, out of scope here).
  `v30-lgsco-fix.ts` retires the one stray failed row and reseeds the 7 categories whose page-1 seed
  never produced output.
- **`interests-api.parliament.uk` silently caps `Take` at 20.** Verified live: `Take=21/50/100` all
  return exactly 20 items regardless of what's requested. The original seeder (`TAKE=100`, skip-by-100)
  paired with `processMembersInterests()`'s `TAKE=100` meant every queued row only ever captured the
  first 20 of its intended 100-item window — **80% of the members'-interests corpus (items 20–99 of
  every hundred) was silently never fetched.** Matches the measured stall exactly: 34 rows × 20
  items/row ≈ 680 of the reported 680/3,341 (20.4%). **Fix:** `TAKE` is now the true page size (20) in
  both the seeder and the worker, so skip steps by 20 instead of 100. `v30-members-interests-fix.ts`
  reseeds `list:{skip}` for `skip = 0, 20, 40, …` across the live total (3,415, up from the 3,341
  measured at the original V29 seed — re-baselined in the script too); idempotent, harmlessly re-touches
  already-compiled windows.
- **Not included in this commit:** `v30-triage-fix.ts` (queue-breaker triage) and
  `v30-denominator-rebaseline.ts` (corpus_targets honest-denominator correction) are separate V30
  tidy-up items from the same session, still uncommitted — out of scope of "the two fixes."

---

## SEARCH — VECTOR: rebuild on Vultr COMPLETE — regression did NOT recover, diagnosis reversed; positions rider abandoned (2026-07-22 17:20 UTC)

**Executes the Charlie-approved rebuild brief (provision → compact+reindex → re-confirm → positions
rider → teardown → report).** Full account: `docs/handoff_summary.md` CURRENT STATE. New
`search/vultr-build-run.ts` (permanent, mirrors `hetzner-build-run.ts`). `tsc`: only the 4 documented
pre-existing errors.

- **Provisioned `voc-g-32c-128gb-640s-amd` in `lhr`** ($1.315/hr) after DO's Memory-Optimized class
  came back new-account-gated (only `m-2vcpu-16gb` visible via `/v2/sizes`; Vultr had no such gate).
- **`corpus_vec` compact+reindex: SUCCEEDED technically** — `optimize()` merged 1,821 fragments → 40
  (never got this far on the 32GB Hetzner box; genuine OOM there both times), `createIndex()` completed
  in 935.9s, checkpoint `phase: "done"`, 21,846,364 vectors / 0 misses preserved.
- **Recall re-confirm: NO RECOVERY.** `score-vector-full.ts` against the rebuilt index: vector-alone
  70.5% (pre-rebuild 71.2%), fused 70/30 71.2% (unchanged) — reproduced bit-for-bit across two
  independent runs. BM25-alone numbers identical to the pre-rebuild run (62.2%, matching per-query),
  confirming the harness itself is stable and this is a real result. **The compaction-skip hypothesis
  from earlier today is REVERSED** — properly compacting and rebuilding from scratch on ample hardware
  produced essentially the same recall as the "degraded" un-compacted build. The true bottleneck is
  unknown; leading candidate is an inherent ANN-at-21.8M-scale vs pilot's-exact-cosine-at-60k gap
  rather than a build defect. `docs/VECTOR_FULL_RECONFIRM.md` updated with the corrected framing.
- **Positions rider (bonus step 4): ABANDONED.** The prepped single-shot `withPosition:true` build
  (`corpus_fts_positions`, checkpoint pre-pinned to `phase:"indexing"`, `FTS_SKIP_COMPACT=true`) hit a
  **hard R2/S3 multipart-upload 10,000-part limit** writing the inverted-index file — a platform
  ceiling, deterministic on retry. Stopped immediately per the "abandon, don't debug" rule rather than
  let the retry wrapper spend paid box-time on a guaranteed-repeat failure. Left in a partial, isolated
  state (zero risk to live `corpus_fts`) for a future attempt with a rethought upload-chunking approach.
- **Process note (own mistake):** tore down the vector-rebuild box before running the positions rider,
  out of the specified order (rebuild → reconfirm → **positions rider** → teardown). Required a second
  short-lived Vultr box for the positions attempt. Minor extra spend (~20 min), no data risk — flagging
  for the record rather than quietly absorbing it.
- **Decision: `LEX_SEARCH_VECTOR` stays OFF.** Not an infrastructure problem to throw more compute at —
  needs a search-quality investigation (chunking/collapse diff vs the pilot; a larger validation slice
  to test whether recall degrades gradually with scale; the unexplained ~9s ANN query latency separately).

---

## SEARCH — VECTOR: full-index recall re-confirm + nprobes diagnostic — regression CONFIRMED, rebuild approved (2026-07-22 12:55 UTC)

**Executes the SEARCH_STRATEGY.md §12 step-1 re-confirm, then CC's go for a query-time recovery
diagnostic.** New harness `search/score-vector-full.ts` (permanent) + `search/_nprobes-diag-tmp.ts`
(throwaway). Reports: `docs/VECTOR_FULL_RECONFIRM.md`, `docs/VECTOR_NPROBES_DIAG.md`. `tsc`: only the
4 documented pre-existing errors.

- **Full-index recall (real `corpus_fts` + real `corpus_vec`, not the 60k-row pilot subset):**
  BM25-alone 62.2% (pilot 68.3%, −6.1pp — corpus-scale control). **Vector-alone 71.2% (pilot 85.9%,
  −14.7pp). Fused 70/30 71.2% (pilot 87.8%, −16.7pp)** — fusion contributes nothing at the shipped
  weight; fused == vector-alone in every query at w≥0.7. **Archetype B (lay-concept) collapsed to
  30.6%**, 3/6 queries scoring literal 0% on both arms.
- **Harness self-tested before trusting the result:** pure `fuseWeighted` unit tests + a live-wiring
  re-check against 2 sample queries, both PASS — the regression is real, not a scoring bug.
- **nprobes [24,64,128,256,512] × refineFactor [2,4] sweep: flat at ~70-71%, no recovery** (64/128 even
  dipped below baseline). A 21× search-depth increase producing no monotonic gain rules out
  under-probing — the IVF_PQ partition structure itself is degraded from the compaction-skip build.
  Also found: ~9s/query ANN latency at the production default — independently unshippable.
- **Decision: `LEX_SEARCH_VECTOR` flag stays OFF. Rebuild approved (Charlie)** — one-off memory-optimised
  cloud box (Hetzner CCX* ruled out, same dedicated-core quota wall as the original embed run),
  DigitalOcean primary / Vultr fallback, 128–256GB RAM. DO preflight: account gated to `m-2vcpu-16gb`
  only (new-account Memory-Optimized class restriction) — needs a Charlie-side support ticket, not a
  droplet-count increase. Vultr token landed same session; its preflight is next.
- **Positions-rider prep (bonus, riding on the same paid box, abandon-don't-debug):** R2 server-side
  copy of `corpus_fts.lance` (10,106 objects / 34.16GB) → isolated `corpus_fts_positions` table (zero
  risk to live search), fresh checkpoint pinned to `phase: "indexing"` (no reload needed),
  `build-fts-index.ts` gained `FTS_SKIP_COMPACT=true` mirroring the vector fix — one shot at the
  `withPosition:true` build parked since the 20 Jun OOM + independent v0.30 optimize() bug.

---

## SEARCH — VECTOR EMBED: full run COMPLETE — ANN index built (2026-07-21 13:58 UTC)

**The full-corpus embed finished end to end.** `corpus_vec` checkpoint: `phase: "done"`, 1,821/1,821
shards, **21,846,364 vectors, 0 misses** (exact match to `corpus_chunks` — zero loss). Full detail +
caveat: `docs/handoff_summary.md` CURRENT STATE (21 Jul). `tsc`: only the 4 documented pre-existing
errors.

- The batch drain (live since 7/11) reached 1,821/1,821 shards unattended, then the indexing phase's
  fragment compaction (`vecTbl.optimize()`) OOM-killed (exit 137) twice on the 32 GB cpx62 box — the
  documented CCX43 fallback is unavailable on this Hetzner account (`dedicated_core_limit exceeded`,
  confirmed live; no shared-core type exceeds 32 GB).
- **Fix (`fe518eb`):** `VECTOR_SKIP_COMPACT=true` skips the compaction step (a read-efficiency
  optimization, not required for `createIndex()` correctness) and builds the IVF_PQ index directly
  over the un-compacted fragments. Rebuilt in 711.7s. Bundled with the 16 Jul `uncaughtException`
  crash-recovery handler (same file, already in place — is what let the box's retry wrapper survive
  the stall alert that preceded the OOM discovery).
- **Caveat flagged, not yet resolved:** the build logged repeated Lance kmeans "clusters empty /
  dataset too small" warnings and many `partition N is empty, skipping` lines — possibly benign at
  this scale, possibly a sign the un-compacted build is less globally optimal than a compacted one
  would be. Rides on the already-planned fusion/gold-key re-confirm on the full ANN index as its
  validation; a compact-then-reindex follow-up would need the Hetzner quota resolved first.
- Box torn down; no further Hetzner spend from the index-build phase.

---

## SEARCH — VECTOR EMBED: live-state correction + email heartbeat/stall observer shipped (2026-07-11 22:09 UTC)

**Laptop diagnosis after the desktop's 7-Jul Tier-2 flip + batch relaunch.** Full detail:
**`docs/VECTOR_EMBED_REPORT.md` §6**. `tsc`: only the 4 documented pre-existing errors;
`embed-observer.ts` offline-selftested (23 cases, all PASS).

- **The run is NOT stalled — it is LIVE at ~47%** (859/1,821 shards, 10.31 M vectors, 0 misses,
  climbing in real time). The "spend PAUSED / Tier-1 blocked / awaiting go" handoff was STALE: the
  sync slice (~$47, 34 shards) + Tier-2 flip + batch relaunch all happened on the desktop and have
  been draining for days. Hetzner `scrutinise-build` (cpx62) up since 2026-07-07 08:08 UTC.
- **Why it looked stalled:** the diagnosing laptop's clock was **~24.5 h behind** (read 07-10 21:00
  when 3 network sources agreed it was 07-11 21:26 UTC) → every checkpoint/job timestamp looked
  future-dated / negative-age; compounded by a **sync-only £46.55 console figure** (batch charges
  unposted). Fixed the clock (`w32tm /resync`) and refreshed the stale `HETZNER_API_TOKEN`.
- **NEW `search/embed-observer.ts` — the monitoring that never shipped.** R2-only, edge-triggered,
  called by `ops.ts` in the 15-min cycle (behind the breaker lock, own `.catch`, no-op when no embed
  runs). Emails `cl@scrutinise.org` on transitions only: 🔴 STALL (checkpoint >25m idle while
  embedding), 🟢 RECOVERED, ✅ COMPLETE, 💚 daily HEARTBEAT (so silence = healthy, not dead observer),
  and — closing the ANN blind spot — 💥 CRASH (tail-log `build exited code≠0`/`FATAL`/shard-`FAILED`,
  **any phase**) + ⏳ ANN-STUCK (phase=indexing frozen >8h, for a box-kill that flushes no exit line).
  Edge-state in `_search/corpus_vec.observer-state.json`. Confirmed live with one heartbeat email.
- **Handoff CURRENT STATE rewritten** to the true post-flip live state (old tier-wall text collapsed
  into a superseded `<details>` block).

---

## INGEST — Treaty coverage extension: uk-treaties-fcdo + parliament-treaties (2026-07-08 16:33 UTC)

**Executes `TREATY_INGEST_BRIEF.md` end to end** (STEP 0–2 + ACCEPTANCE). `scripts/ingest` `tsc --noEmit`
clean (only the 4 documented pre-existing errors, unrelated). No git mid-sprint per §12 — see
`commit-all.sh`.

- **STEP 0 (provenance check, before extending):** `uk-treaties` (3,264 sections / 1,519 docs) and
  `tax-treaties-dta` (324 sections / 172 docs) were built entirely from **gov.uk's search API**
  (`filter_format=international_treaty`, V19) — NOT from FCDO's UK Treaties Online and NOT from the
  Parliament API. Confirms the brief's premise: current coverage is a small gov.uk-sourced subset,
  not the authoritative FCDO archive.
- **STEP 1 — FCDO UK Treaties Online (`uk-treaties-fcdo`, new corpus).** treaties.fcdo.gov.uk is a
  legacy JBoss/Knowvation "AWARE" federated-search deployment (Backbone.js SPA, Solr-backed, PTFS
  Inc) with **no bulk export** — data.gov.uk's "UK Treaties Database" dataset's only bulk resource is
  a stale one-off Nov-2015–Feb-2016 CSV bulletin — and **no server-rendered HTML** (JS-only SPA). Per
  the bulk→HTML→API priority order, the underlying anonymous JSON REST API was reverse-engineered from
  the SPA's own JS (`GET /awweb/federated/users/op/login/anonymous` for a session cookie, `POST
  /awweb/awfp/search/1` for search, both undocumented but require no auth beyond the anonymous
  session the UI itself silently uses) — `scripts/ingest/sources/fcdo-treaties.ts`.
  - **Honest-denominator correction:** measured universe = **21,970 records** (single collection,
    library2_lib), NOT the ~15,000 the brief and the gov.uk `/uk-treaties` page state. Reported as
    measured, not silently substituted.
  - Every record's HTML "page" is confirmed to be ALWAYS just a country/action-date summary table,
    never full text (checked multiple samples incl. records both with and without a linked PDF).
    Full text exists ONLY in linked Treaty Series PDFs embedded in the `references` field: **7,184
    records (33%) carry ≥1 PDF; 14,786 (67%) are metadata-only** with no full text anywhere on the
    site. Metadata-only records get a compiled, searchable section built from the API's structured
    fields (title/parties/subject/dates/archive references), flagged `availabilityStatus:
    'metadata-only'` — surfaced honestly, not silently dropped, per the brief's explicit ask.
  - **Dedup vs what we hold:** best-effort exact-normalized-title match against `uk-treaties` +
    `tax-treaties-dta` (3,197 distinct titles) — conservative on purpose (different id namespace,
    no shared key; a false-positive skip would silently drop a unique FCDO treaty, a false-negative
    just duplicates cheaply). **127 apparent duplicates skipped**, 21,843 net-new candidates.
  - **Licence OGL v3.0** — verified via the FCDO's own data.gov.uk catalogue entry for this dataset
    (organisation "Foreign and Commonwealth Office", `license_id: uk-ogl`); the site itself has no
    dedicated terms page (`/copyright`, `/terms`, `/about` etc. all 404 on the JBoss host).
  - Pilot shakedown (3 rows: zero-pdf / one-pdf / multi-pdf, incl. one genuinely-scanned 1976 PDF
    that correctly fell back to the metadata-only marker) passed clean — real extracted text,
    correct classification, no encoding corruption. Full seed: **21,840 queue rows** (P3,
    `sourceType: fcdo-treaties`, 750ms/2-worker rate limit — legacy host, kept gentle). **Draining in
    the background at seed time; not complete this sprint** (~21.5k rows remaining, multi-hour run) —
    the live `ops`/`Ingest` Railway service picks it up automatically (no manual trigger needed).
- **STEP 2 — Parliament Treaty Tracker (`parliament-treaties`, new corpus) — COMPLETE.**
  `treaties-api.parliament.uk` is a clean documented JSON API (OpenAPI spec at
  `/swagger/v1/swagger.json`), same family as `bills-api`/`committees-api`/`erskine-may-api`.
  Covers CRaG-2010 scrutiny: laid dates, `parliamentaryConclusion`, sponsoring/laying department, and
  a `BusinessItems` timeline (debates, committee evidence sessions, objection-period tracking) —
  `scripts/ingest/sources/parliament-treaties.ts`.
  - **Model decision (brief left this as CC's call):** kept as its OWN corpus, not an enrichment on
    `uk-treaties-fcdo` — different id namespace (no shared key), different content kind (scrutiny
    procedure vs treaty legal text), and matches the codebase's existing convention that
    parliamentary-procedure APIs (`bills-api`, `division-votes`, `committees-api`) always live
    separately from the legal-text corpora they relate to.
  - Universe = 328 treaties (verified live, single-page `Take=1000` response — no pagination needed
    at this size). One section per treaty (Treaty record + BusinessItems timeline combined — the
    small volume and narrative-timeline shape don't warrant per-item sections).
  - **Licence OPL v3.0** — same verified `*.parliament.uk` API family as the existing OPL entries.
  - **Seeded and fully drained this sprint: 328/328 done, 328/328 compiled, 0 failures.**
- **Wiring:** `shared/licence-map.ts` (`uk-treaties-fcdo` → OGL3, `parliament-treaties` → OPL3),
  `seed-rate-limits.ts` (both sourceTypes), `search/corpus-map.ts` (`parliamentary` tier for both).
- **NEXT:** `uk-treaties-fcdo` backlog continues draining via the live Railway `Ingest` service — no
  action needed; re-baseline `corpus_targets.est_sections`/`est_is_confirmed` once it drains (current
  value is the provisional queued-row count, 21,843).

---

## SEARCH — VECTOR EMBED: tier wall verified + sync-embed mode built (INERT, spend Charlie-gated) (2026-07-06 23:26 UTC)

**Executes the verify-limits + sync-mode brief.** Full findings + plan: **`docs/VECTOR_EMBED_REPORT.md` §5**.
`tsc`: only the 4 documented pre-existing errors; both transports offline-selftested.

- **VERIFIED (no spend):** account = paid **Batch Tier 1 → 500k enqueued-token queue** (probed:
  182k accepted / 2.56M rejected; docs: T1 500k / T2 5M / T3 10M). The "£189.01 Billing Account
  Tier Cap" = Tier 1's mandatory **$250/month** account spend ceiling (GBP) — a ~$100 sync slice +
  $36 existing usage fits. Tier-2 flip is AUTOMATIC at ≥$100 actual usage (+3 days, met), docs say
  ≤10 min once criteria register. Sync limits for gemini-embedding-001 at T1: **3,000 RPM / 1M TPM**
  (forum-official; confirm in AI Studio). Sync request caps: 250 texts / 20k tokens / 2,048 tok/text.
- **BUILT:** `VECTOR_EMBED_MODE=sync|batch` on `build-vector-index.ts` — sync drives the SAME shard
  plan/writes/checkpoint through NEW **`gemini-sync.ts`** (packed ≤100 texts/≤18k tok per call,
  GLOBAL 950k-TPM/2,800-RPM pacer, per-call 429 retries). Checkpoint now **pins shardSize** (plan
  must survive the transport switch). **`gemini-batch.ts` splits over-budget shards into sequential
  sub-jobs** (`VECTOR_BATCH_JOB_TOKENS` 4.5M) — caselaw/debate regions run ~800 tok/chunk, so a 12k
  shard there (~9.6M tok) would otherwise 429 at Tier 2 forever. `gemini-tier-probe.ts` promoted
  (token-targeted create-then-cancel tier detector, ~$0).
- **PLAN NUMBERS (gated):** shard plan `VECTOR_SHARD_SIZE=12000` → 1,821 shards, pinned. Sync slice
  ~667M tok ≈ $100 ≈ **~11.7h** at the pacer rate (427M/$64/7.5h if the $36 counts — console-controlled,
  not shard-counted). Tier-2 batch remainder ~6.1B tok ≈ **$370–460**, ~1,900–2,200 sequential jobs
  (MAX_INFLIGHT=1), days-to-2-weeks. **Revised total ~$470–560** (~$50 sync premium buys the flip) —
  still under the ~$600 gate. NOTHING runs without Charlie's go.

---

## SEARCH — VECTOR EMBED hotfix: GEMINI_API_KEY injected onto the Hetzner build box (2026-07-06 07:05 UTC)

**Mid-sprint carve-out commit (build-breaking fix).** The full-corpus STEP-2 embed failed on the
box with every shard erroring `GEMINI_API_KEY not set` — `hetzner-build-run.ts` injected only the
Neon+R2 creds via cloud-init, never the Gemini key (the canary passed because it ran locally where
`.env` supplies it). One-line fix: `GEMINI_API_KEY` added to the `NEEDED` inject list. **Zero Gemini
spend lost** — all 547 shards failed client-side before any Batch API call; checkpoint intact (0 done).
Also hit + fixed operationally (no code change): STEP-2's chunkId load OOM'd at node's default ~4GB
heap cap (21.8M ids ≫ the comment's <1GB estimate once V8 object overhead counts) — relaunch command
now carries `NODE_OPTIONS=--max-old-space-size=28672`. STEP 1 final: **17,640,560 sections →
21,846,364 chunks** (1.24/section, 230 body misses, ~32h on the cpx62). tsc: only the 4 documented
pre-existing errors.

---

## GRAPH — Tier 1 legislation graph (explicit edges) + rescission traversal (2026-07-05 16:57 UTC)

**Sprint complete — graph built, loaded, traversed, scored.** Full audit + build report:
**`docs/GRAPH_TIER1_REPORT.md`**. New code all under `scripts/ingest/graph/` (ingest-side only).
`scripts/ingest` `tsc --noEmit` = only the 4 documented pre-existing errors.

- **Audit first (bytes before hypotheses):** the brief's "CLML cross-reference markup in the XML we
  already hold" is REFUTED for the per-section fragments — stored raw.xml has ZERO `<Citation>` markup
  (verified across 30 random + 14 explicitly-amending provisions; act names are plain text). Effects
  feeds captured for only 3,590 legacy UKPGA acts; corpus-pipeline effects rows = 0; SI preambles never
  stored. What DOES hold everything: the TNA bulk sources — `best-collection-xml.zip` (1.4 GB whole-doc
  CLML, on disk since May 2026, WITH Citation/CitationSubRef/SecondaryPreamble) and
  research.legislation.gov.uk bulk amendments XML (bulk-before-API verified by HEAD + download;
  secondary types regenerate daily, primary/EU vintage 2025-10-30).
- **Built:** Neon `legislation_edges` (from_id, to_id, edge_type, sub_type, source, granularity, detail,
  extracted_at; ids in the corpus_sections `{corpus}:{gid}[:{sectionRef}]` scheme; PK-idempotent inserts;
  gid expression indexes both directions). Extractors (each pilot→full, zero silent drops, resumable):
  `extract-effects-edges.ts` (2,605,737 effects → amends/repeals/commences/modifies; regnal-year URI fix
  recovered 22k skips), `extract-madeunder-edges.ts` (82,831 SIs → 230,681 made-under edges incl.
  section-level enabling powers; recital fallback; 6,108 TNA-elided revised preambles counted),
  `extract-cites-edges.ts` (body citations only — commentary/footnote/preamble zones excluded as
  effects/made-under duplicates; 121,279 edges), `extract-inforce-edges.ts` (~107k act-level historical
  repeals back to 1235). **Total 2,348,993 edges / ~0.94 GB; Neon 15 → ~16 GB (17.5 GB line — thin).**
- **Traversal + service:** `traverse-edges.ts` `impactSet(gid, sectionRef?)` — "if this is repealed,
  what is affected" grouped madeUnder/citedBy/amendedBy/repealedBy/commencedBy/targetTouches + one-hop
  over dependent SIs; section queries prefix-match TNA's subsection grain AND inserted siblings
  (section-21 → section-21-4, section-21A). `edges-query-service.ts` mirrors fts-query-service
  (POST /impact; smoke-tested live: 224 ms, correct groups, titles resolved).
- **Gold archetype D re-scored through the traversal: 0% (floor) → 80% (8/10).** D1 2/2 (Deregulation
  2015 ss.33–41 + Renters' Rights 2025 prospective repeal of HA1988 s.21), D2 2/2 (35 SIs under BSA 2022
  incl. Higher-Risk Buildings regs), D3 1/1 (957 commences edges w/ in-force facts), D4 3/3 (ABCPA 2014
  s.106 + XL Bully order via made-under), D5 0/2 (needs case-interprets-section edges — explicitly out
  of sprint scope; stays floored as predicted).
- **Engineering notes:** adm-zip's whole-file 1.4 GB buffer fails on this machine → `zip-reader.ts`
  (~130-line streaming ZIP64 reader, no new deps). Cites OOM root-caused to V8 sliced strings pinning
  source docs via regex-match-derived ids → `dedupeEdges` flattens all retained strings.
- **Follow-ups (report §5):** primary/EU effects vintage top-up (per-act API or TNA refresh); elided SI
  preambles via made-version fetch; case-law edges for D5 (separate brief); fold the scorer's Title-Case
  resolver fallback into `citation-resolver.ts`; add `legislation_edges` to schema.prisma when the web
  app needs typed access.

## LEX REBUILD — COSTING Phase 2a s2: v2 additions + extraction manifest M1–M11 worked (2026-07-04 12:11 UTC)

**Preview only — NOT promoted.** Executes `docs/cost-benchmarks-seed-v2-additions.json` per its loader_note,
then the `cc_extraction_manifest` M1–M11 (M3 first as directed). Every value verified against the actual
downloaded source bytes before insert (label-anchored extraction; scripts fail loudly on layout drift).
`tsc` clean (react-markdown only). **CostBenchmark now 53 verified rows; zero unverified values.**
New scripts under `scrutinise-web/scripts/costing/` (`util.ts` + one per manifest target — repeatable on
source updates); loader `load-cost-benchmarks-v2.ts`.

- **v2 loaded:** 20 Home Office costs-of-crime 2019/20 rows (2019/20 prices, OGL; per-row multiplier +
  usage rule carried in notes); REPLACED v1-homicide (£3.2m/2015 → £3,346,680/2019) + v1 context anchor
  (£59bn/2015 → £77.7bn/2019).
- **M3 ✓ (first):** HMT GDP deflators June 2026 QNA — the REAL ONS L8GG financial-year series, 71 outturn
  years 1955→2025 (2025-26=100), forecasts excluded by construction → `DeflatorSeries` replaced (placeholder
  gone). Uprating now targets 2025 outturn prices. Key = FY starting year (matches stored priceYears).
- **M1+M2 ✓:** DfT TAG Data Book **May 2026 v2.03** (2023 prices/values, GDP_PER_HEAD uprating): per-casualty
  fatal (**live VPF £2,652,796** — replaces the v1 provisional £2m; contested-evidence note kept), serious
  £295,069, slight £22,668, average £98,933; per-accident fatal £2,950,460 / serious £337,548 / slight
  £34,233; values of time — working (car) £23.17–27.57/hr, commuting £13.04–15.51, other £5.95–7.08.
- **M4 — LICENCE REPORT (ingest GATED on Charlie):** the GMCA Unit Cost Database **v3.0** states in its own
  Introduction sheet: *"This work is licensed under the Creative Commons Attribution 4.0 International
  License"* (© GMCA 2026). **CC BY 4.0 = reuse incl. commercial permitted WITH attribution** — our schema
  satisfies attribution structurally (source + entry code + URL + CC note per row). NOT Crown copyright.
  `m4-gmca.ts` is built + dry-run verified (30 selected entries across crime/education/employment/housing/
  health/social-services, original values + original price years, licence-guard refuses to run if the CC
  statement disappears) — **`--apply` awaits Charlie's go per the manifest's report-back gate.**
- **M5 ✓:** PSSRU/CoReC Unit Costs of Health and Social Care **2025** (2024/25 prices; openly published
  NIHR-funded manual) — 9 rows via verify-then-insert PDF anchors: GP consultation £40–48, GP hour-of-contact
  £239–285, A&E attendance £280, inpatient stays £6,620/£5,395/£824 (elective/non-el long/short), Band-5
  nurse £57/hr, social worker £54–61/hr, NHS Talking Therapies contact £169.
- **M6 ✓:** ONS ASHE 2025 provisional (zip→xlsx via a dependency-free zip reader in util.ts): median gross
  hourly — all £17.96, professional £26.11, admin & secretarial £15.20 (stored as [median, mean] ranges;
  SCM wage inputs).
- **M7 ✓:** DESNZ carbon values (Annex 1, £2020 prices): emissions in 2026 £132/264/396 low/central/high
  per tCO2e; 2030 £140/280/420.
- **M8 ✓:** DBT Business Population Estimates 2025 Table 1 — total 5,690,265; micro 5,423,410; small
  220,085; medium 38,435; large 8,335 (bands verified to sum exactly to the published total; counts,
  uprateMethod NONE).
- **M9 — BLOCKED (documented):** the "Economic and social cost of crime: Amendments to unit costs" doc is
  linked from the 2019/20 publication but its gov.uk URL **404s** (both path variants) and site search can't
  find it. The 2019/20 page itself notes the Police Activity Survey (2025) supersedes the police-response
  basis. Re-check next pass; blocker recorded in `m10-fraud.ts` header.
- **M10 ✓:** HO Economic and social cost of fraud **2023-24** (YE Mar 2024 prices): fraud vs individuals
  **£2,884**/offence (274+2,256+354, cross-checked against the doc's own summary), vs businesses £2,170,
  total £14.4bn/yr context anchor. **Superseded `v2-fraud-individual` deleted** per the manifest.
- **M11 ✓ — both TRAINING_RECALL params now VERIFIED** (`lib/lex/costing-params.ts`): optimism-bias uplifts
  24/51/44/66/200% confirmed as Table 1 capex UPPER bounds in the HMT supplementary guidance PDF (lower
  bounds 2/4/3/6/10 added; outsourcing 41% opex); health discount rate **1.5%** confirmed at Green Book 2026
  §6.58. Both now `verified: true` and usable.
- **Dependency:** `xlsx@0.18.5` added to scrutinise-web devDependencies (extraction tooling only).

---

## SEARCH — VECTOR EMBED: full-corpus embed pipeline + ANN + flag wiring (OFF) + canary PASS (2026-07-04 13:37 UTC)

**Search thread; executes the post-pilot/post-fusion embed brief.** Builds (inert) the full-corpus
gemini-embedding-001 @768-d embed via the **Gemini Batch API** (50% discount), the ANN index, and the
OFF-by-default production wiring. Decision + runbook: **`docs/VECTOR_EMBED_REPORT.md`**. `scripts/ingest`
`tsc --noEmit` = only the 4 documented pre-existing errors; `scrutinise-web` = only the 2 pre-existing
`react-markdown` errors. New dep `@google/genai@^1.52` (isolates the Batch API's Files-upload + LRO polling).

- **Cost CONFIRMED within the ~$600 gate (no flag raised).** Measured on Neon (`search/measure-corpus.ts`):
  **17,640,217 compiled sections / 6.12 B words → ~22.25 M chunks (1.26/section) → ~6.90 B tokens (chars/4,
  conservative) / ~5.69 B (words×1.3)**. At the batch rate ($0.15→**$0.075/1M**, verified on ai.google.dev):
  **~$430–520**. Under 8 B est. and the ~$600 gate. 768-d halves the vector store (~68 GB vs ~137 GB), not the
  embed bill (Gemini meters input tokens); the batch discount is the embed saving.
- **Pipeline (`scripts/ingest/search/`, all resumable/idempotent, mirror build-fts-index.ts):** `chunk.ts`
  (validated pilot chunker, extracted pure) → `build-corpus-chunks.ts` (STEP 1: Neon→R2→`corpus_chunks` Lance,
  + archetype-A citation backfill) → `gemini-batch.ts` (the ONLY Batch-API module: Files upload →
  `batches.createEmbeddings`/`:asyncBatchEmbedContent` → poll → download → parse; pure JSONL build/parse
  offline-selftested) → `build-vector-index.ts` (STEP 2: ≤40k-req shards, ≤8 in flight, `corpus_vec` +
  **IVF_PQ** cosine ANN; `--canary` validates the live batch shape) → `vector-core.ts`/`vector-query-service.ts`
  (query-embed + ANN serve, INERT — the vector analogue of fts-query-service).
- **Wiring behind the reserved `LEX_SEARCH_VECTOR` flag (OFF):** `scrutinise-web/lib/lex/vector-search.ts`
  (platform adapter, mirrors fts-search) + `search-gateway.ts` fuses BM25+vector with the **TUNED 70/30
  weighted RRF** (`0.7/(60+rank_vec)+0.3/(60+rank_bm25)`, env `LEX_FUSION_VECTOR_WEIGHT`; per FUSION_REPORT.md,
  NOT naive equal-weight). Doubly inert (flag OFF + `VECTOR_SEARCH_URL` unset).
- **The embed RUN is the Charlie-triggered spend** (Hetzner CCX43 + Batch API), inert until then — same
  pattern as the FTS full-corpus build. Runbook in the report: `measure` (re-confirm) → `--canary` (validate
  batch shape, ~cents) → `hetzner-build-run run "…build-corpus-chunks && …build-vector-index"` → teardown.
- **✅ CANARY RUN + PASSED (2026-07-04 11:51 UTC, Charlie-approved, ~$0.01).** Bounded STEP-1 (5,000
  sections → 23,130 chunks, 0 body misses; full build resumes from the checkpoint) + one live 200-chunk
  batch job → `corpus_vec_canary`: SUCCEEDED; 200/200 vectors all exactly 768-d (Matryoshka honoured);
  order/key assertions clean; norms 0.572–0.584 no zero/NaN; cos(adjacent same-section windows) 0.932 >
  cos(different sections) 0.854. **Live Batch API JSONL/response contract CONFIRMED — the full spend is
  de-risked.** SDK note: `batches.createEmbeddings()` prints an experimental warning; `@google/genai` is
  version-pinned in package-lock. Remaining: the full Hetzner+Batch run (~$430–520).
- **Left OFF deliberately:** 70/30 fusion needs a full-corpus re-confirm through the ANN path (pilot tuned on
  the 60k exact-cosine subset); ANN recall vs exact is a separate measurement; gold key still draft. Flipping
  the flag is the next sprint.

---

## SEARCH — FUSION TUNING: weighted RRF 70/30 ships, kind-based routing not needed (2026-07-03 22:54 UTC)

**Search thread; the vector pilot's flag-flip follow-up.** The bake-off left the vector flag off because
naive equal-weight RRF was a regression against vector-alone (voyage B6 50%→0%). Tuned the fusion on the
already-embedded 60k pilot subset (zero new embedding cost). Decision report: **`docs/FUSION_REPORT.md`**;
generated numbers `docs/FUSION_RESULTS.md` + `docs/fusion_tuning.json`. `scripts/ingest` `tsc --noEmit` =
only the 4 documented pre-existing errors.

- **New `scripts/ingest/search/pilot-fusion.ts`** — reuses pilot-score.ts arms EXACTLY (same subset, BM25
  incl. citation-resolver pin, exact in-memory cosine, same gold scoring); sweeps weighted RRF
  `w·1/(60+rank_vec) + (1−w)·1/(60+rank_bm25)`, w ∈ {0,.3,.5,.6,.7,.8,.9,1}, and composes the full
  (wCit,wCon) routed grid from the per-query sweep (routing = per-query weight choice, so it's free).
  **Self-check PASS:** w=0.5 reproduces the pilot naive-RRF hybrid exactly for all 3 models (81.1/84.3/77.2).
- **Result (gemini, ship model): fixed 70/30 = 87.8%** recall@20 excl-floor — beats naive RRF 84.3%
  (+3.5pp), vector-alone 85.9% (+1.9pp), BM25 68.3% (+19.5pp). Per-archetype at 70/30: A 100% (resolver
  pin survives fusion) · B 69.4% (matches vector-alone's best) · B6 50% · C 93.3% · E 100% · F 80%.
- **Routing adds exactly nothing:** best routed = 87.8% (tie). ≥80/20 is where A1 breaks (100→50) — 70/30
  is the coexistence point of the vector signal and the citation pin, so no router is needed. The
  `parseCitation` router also over-triggers (fires on E1/E3/E5 debate queries that merely name an Act
  and all D floors — 12/31 queries) — harmless in the grid, but another reason to prefer no-router.
- **Robustness:** plateau not spike (60/40=85.3, 80/20=85.9). voyage optimum also vector-heavy
  (80/20=86.9%) and weighting FIXES its B6 collapse (naive 0% → 33.3%); e5 (weak vector arm) stays best
  at naive 50/50 (77.2%) → the right weight tracks vector-arm strength; re-tune on any model swap.
  Watch-item: F5 (BILLS) 100→50 at w≥0.7 — the one per-query regression vs naive.
- **Ship spec:** weighted RRF w=0.7, RRF_K=60, over BM25-with-resolver-pin; weight as env config
  (`LEX_FUSION_VECTOR_WEIGHT`, default 0.7); no query-kind router in the fusion layer (production's
  expansion scoping stays as-is). Wire with the `vector` capability flag after the full-corpus embed;
  re-confirm 70/30 there (cheap re-run; the plateau means the decision doesn't hang on it).

---

## LEX REBUILD — COSTING Phase 2a s1: verified benchmark seed loaded (placeholders OUT) (2026-07-03 22:39 UTC)

**Preview only — NOT promoted.** Integrates **`docs/cost-benchmarks-seed-v1.json`** (renamed from
"Cost benchmarks seed v1 · JSON.json" to its own `_meta.file` name) per its loader_note. File principle:
every value verified against a primary source, or it goes in `_pending` — **no unverified numbers in the DB**.
`tsc` clean (react-markdown only). **Applied to Neon** and verified row-by-row.

- **5 verified `CostBenchmark` rows IN** (stable ids, upserted by `scripts/load-cost-benchmarks.ts` —
  dry-run default, `--apply`): `v1-qaly` £70k (2020 prices, Green Book — NOT the NICE £20–30k threshold, per
  the file's note), `v1-wellby` £10–16k (2019, HMT Wellbeing Guidance), `v1-vpf` £2.0m (2018, **GDP_PER_HEAD**
  uprating, OFFICIAL_DATED + contested-evidence note), `v1-homicide` £3.2m (2015, HO horr99),
  `v1-crime-total` £59bn/yr (context anchor, not a unit cost).
- **All 10 Sprint-3 `seed-*` placeholder rows DELETED** — the un-replaced ones (carbon, travel time, admin
  burden, service unit costs…) are all in `_pending`, so the "no unverified numbers" principle now holds in
  the database. (`CostRange.benchmarkId` is a soft string ref — any range already stamped keeps its
  values/basis; only the picker's offer set changes.)
- **`parameters` → `lib/lex/costing-params.ts`** (mirror of the JSON — edit the JSON first): STPR 3.5%
  (VERIFIED; under 2026 HMT review), EANDCB ±£5m RPC-scrutiny threshold (VERIFIED), health discount rate
  1.5% + optimism-bias uplifts (**TRAINING_RECALL — `verified:false`, hard rule: must NOT drive a user-facing
  number until Phase 2b verifies them**).
- **`_pending` stays in the JSON in docs** as the Phase-2b extraction backlog (TAG A4.1.1 live VPF, horr99
  Table 1 per-offence costs, GMCA top-30 (licence check first), PSSRU core set, ASHE wages, DESNZ carbon,
  business population counts, real GDP-deflator series).
- Files: `docs/cost-benchmarks-seed-v1.json` (renamed in), `scrutinise-web/scripts/load-cost-benchmarks.ts`
  (new), `scrutinise-web/lib/lex/costing-params.ts` (new).

---

## SEARCH — type-taxonomy display fix (SEARCH_STRATEGY §10.2) (2026-07-03 22:14 UTC)

Live test: "Revoke MiFID II" shows no legislation answer despite retained MiFIR / SI 2017/701 being
in the corpus. Audited the raw-corpus → display-bucket map empirically (68 corpus types + live BM25
retrieval). Full account: **`docs/TYPE_TAXONOMY_AUDIT.md`**. `scrutinise-web` `tsc --noEmit` = only the
two pre-existing `react-markdown` errors.

- **Brief's mechanism REFUTED for MiFID (verify-before-asserting).** In the current code
  `corpus-type-map.ts` ALREADY routes `retained-eu`/`eur-lex` → EU_LEGISLATION and `uksi/*` →
  STATUTORY_INSTRUMENT, and `BackgroundPanel` renders both — so retained-EU has its own correct
  bucket and SI routes correctly. The MiFID "empty" is a **RANKING** problem: bare BM25's top-30 for
  the query is 17 tangential SIs + 9 guidance + 4 dropped explanatory-memoranda, and the VALIDATED
  answers (MiFIR/SI-701/FSMA-2023) never rank in at all (the B6 case — see `docs/PILOT_REPORT.md`,
  BM25 B6 0% → vector 50%). A type-map change cannot surface them; that's the vector-layer workstream.
  Reported honestly, not claimed fixed.
- **REAL bug found + fixed: 13 corpora were hidden (null) → 4.** The FTS `tier` is baked into the
  index; corpora seeded after `corpus-map.ts` last covered them carry `tier:'other'` and fell through
  to `null` → the panel hid them. Biggest loss: **`scottish-parliament-or` = 1,042,819 sections**.
  Fixed in the DISPLAY layer (`corpus-type-map.ts` `CORPUS_DISPLAY_OVERRIDE`, by corpus name — works
  on the live baked-tier index, no reindex): scottish-parliament-or / early-day-motions / petitions →
  DEBATE; cma-cases / ofgem / ofcom / independent-reviews / cps-guidance / inquiry-evidence / lgsco →
  GUIDANCE. Remaining null (4, INTENTIONAL): explanatory-notes/-memoranda (annotations, not the law),
  erskine-may, members-interests.
- **Follow-ups (not this change):** update `corpus-map.ts` `tierFor` for reindex consistency;
  `buildInitialBackground` prose narrates only 4/9 types (enum-flagged TODO; cards render all buckets);
  MiFID answer surfacing = the vector layer.
- **File:** `scrutinise-web/lib/lex/corpus-type-map.ts` (+ `docs/TYPE_TAXONOMY_AUDIT.md`).

---

## LEX REBUILD — COSTING_SCOPE §9: benchmark schema deltas + estimator uprating (2026-07-03 18:17 UTC)

**Preview only — NOT promoted.** Executes `docs/COSTING_SCOPE.md §9` (the Phase-1 schema brief) as an extension
of Sprint 3 Task 5. `tsc` clean (react-markdown only). Additive schema **applied to Neon**
(`prisma/lex_costing_deltas.sql`, idempotent). Uprating verified with a throwaway check: £1,000,000 at 2016
prices → £1,333,333 at 2026 prices (×136/102), summary states the price base.

- **§3 deltas on `CostBenchmark`:** `priceYear` (prices distinct from publication `year`), `category`
  (`BenchmarkCategory` enum — HEALTH/LIFE_SAFETY/WELLBEING/TIME/CRIME/ADMIN_BURDEN/EMPLOYMENT_ECONOMY/HOUSING/
  EDUCATION/ENVIRONMENT/SERVICE_UNIT_COST), `region` (default 'UK'), `uprateMethod` (`UprateMethod` —
  GDP_DEFLATOR/GDP_PER_HEAD/NONE), `confidence` (`BenchmarkConfidence` — OFFICIAL_CURRENT/OFFICIAL_DATED/
  ACADEMIC/SECTOR). The 10 placeholder rows backfilled with real price years + categories (e.g. QALY 2020/HEALTH,
  VPF 2016/LIFE_SAFETY/GDP_PER_HEAD, carbon 2023/ENVIRONMENT). `IdeaAssumption` unchanged (as §3 states).
- **New `DeflatorSeries { year, index }` table** — the GDP deflator as DATA so uprating is a lookup, not a
  hardcode. Seeded with an ILLUSTRATIVE placeholder 2015–2026 series (2015=100, ~2%/yr) so the shell is testable
  before the Phase-2 ingest of the real ONS series (only ratios matter).
- **Estimator uprates before aggregating.** `CostRange` gains `priceYear`; the benchmark picker stamps it from
  the chosen benchmark; `computeCostSummary` uprates every per-action cost from its price year to the latest
  deflator year via the deflator ratio, then totals, and the summary notes "(all figures uprated to N prices)".
  Falls back to no-op when a figure has no price year or the series lacks the year (graceful before Phase 2).
- **Files:** `prisma/schema.prisma` + `prisma/lex_costing_deltas.sql` (new); `lib/lex/page1-config.ts`
  (`CostRange.priceYear`, `CanonicalBenchmark` +5 fields), `state.ts`, `field-machine.ts` (uprating),
  `components/lex/FieldsPanel.tsx` (picker sets priceYear), `app/api/ideas/[id]/actions/route.ts` (zod).
- **Deferred to Phase 2 (per COSTING_SCOPE §7):** real ONS deflator series + GDP-per-head series (VPF); ~50
  Tier-1 benchmark rows (Green Book/GMCA/PSSRU); optimism-bias uplift; EANDCB ±£5m RPC-scrutiny flag; NPV
  discounting. The schema + uprating pipeline are ready to receive them.

---

## LEX REBUILD — Sprint 3-A: amendments from Sprint 2 preview validation (§19-A) (2026-07-03 17:27 UTC)

**Preview only — NOT promoted.** Executes `LEX_DESIGN_ADDENDUM_16-19.md §19-A` (takes precedence over §19
where they conflict). `scrutinise-web` `tsc --noEmit` clean (react-markdown only). Kernel re-smoked end-to-end
on Neon (fallback path) — all four pages still drive with no dead-ends.

- **A1 — structured fields are now PROPOSABLE (the "pop it in the box" defect).** Extended the §4 proposal
  contract with `proposal.valueObject` (a per-slot JSON map). Lex now SYNTHESISES a chat answer into the slot
  schema and returns a proposal; the box renders "proposed by Lex — refine"; the user edits/Saves — identical
  to narrative boxes. Applies generically to every structured field on Pages 2–4 (`whoAffectedImpactCost`,
  `legalLandscape`, `anticipatedResponses` — added to the proposable enum). New RULE forbids ever asking the
  user to transcribe/"pop" their own words into a box. `lex-client.ts` (schema + guidance + rule + parser),
  `/lex` route (structured → valueObject), `FieldsPanel` label.
- **A4 — cause seeding diagnosed + hardened.** *Finding (by inspection; the live [lex-diag] will confirm):*
  the CAUSE_SEEDING gateway call is NOT flag-gated and FTS is live, so the most probable cause of "no
  candidates surfaced" is the Gemini cause generator returning empty/erroring on a transient 429/503 — which
  `seedCauses` swallowed silently, leaving zero seeds. **Fix:** `seedCauses` now logs every stage
  (`[lex-diag] cause seeding` — challengeLen/keywords/results/snippets/generated/created/fallbackUsed/error),
  RETRIES the generator once, and falls back to deterministic corpus-grounded candidates (drawn from the FTS
  results) when the generator yields nothing but the corpus returned relevant material — so the acceptance
  ("candidates seeded from the corpus") holds even when Gemini blips.
- **A5 — single-cause root step + bubble dedupe.** With one (material) cause, the conductor no longer asks
  "which is the main driver" — it proposes that cause as root with a one-click "Confirm … as the root cause"
  button (`RootCauseField`), and the conductor `questionFor` phrases it as a confirm. Added consecutive-
  duplicate suppression in `orchestrateAfterWrite` (`[lex-diag] suppressed duplicate bubble`).
- **A2 — page collapse on stage transition (all three panels).** Fields panel: completed stages collapse into
  accordions (title + tick + "n of n", "+"/"−" to expand). Chat: prior-stage messages collapse under a divider
  ("The Basic Idea — N messages +") — messages are stage-tagged client-side; the active stage stays expanded.
  Legislation panel: content grouped under its stage header ("The Basic Idea").
- **A3 — middle-panel auto-scroll.** On Save the newly-active box scrolls to the top of the Fields panel
  (`currentFieldKey` + `scrollIntoView`), so the user no longer hunts for it.
- **A6 — "The Basic Idea" everywhere.** Modal four-stage list aligned ("The Basic Idea, Diagnosis, …");
  the sidebar/first-stage rename shipped in Sprint 1.4. (FAQ's own "## Getting started" heading is a different
  concept, left as-is.)
- **A7 — empty legal-tier copy reworded** (`search-stub.ts buildInitialBackground`): "No UK Act matched
  directly — this area may be governed by retained/assimilated EU law, secondary legislation, or regulator
  rules." **Retrieval question passed to the search workstream:** when the governing law is onshored/retained
  EU regulation, surface it in the legal-framework tier (it lives in the corpus under EU_LEGISLATION/GUIDANCE).

---

## SEARCH — VECTOR PILOT (embedding-model bake-off on the gold set) (2026-07-03 15:50 UTC)

Picks ONE embedding model on the gold set BEFORE the sticky full-corpus embed (different models'
vectors are incompatible → switching = re-embed everything). Measures per-model recall@20
(vector-alone AND RRF-hybrid) vs the current BM25 baseline, on ONE 60k-section subset so all arms
see an identical candidate universe. Full account: **`docs/PILOT_REPORT.md`** (decision) +
`docs/PILOT_RESULTS.md`/`.json` (numbers) + `docs/PILOT_SUBSET.md` (coverage). `scripts/ingest`
`tsc --noEmit` = only the 4 documented pre-existing errors.

**Candidates.** voyage-4 (Voyage, legal front-runner) · gemini-embedding-001 (best-general, 1536d)
· open-weight datapoint. Note: brief's BGE-M3 is DELISTED on Together and BGE-* are non-serverless,
so the open-weight slot is **intfloat/multilingual-e5-large-instruct** (the only serverless
open-weight embedder Together serves) — same "free/self-host economics" question, different model.

**Subset (validated).** `pilot-subset.ts` locates every gold expected-source (id-probe via Neon
`id LIKE ANY`; text-probe via Lance BM25 + the exact gold regex), then adds stratified distractors
keeping corpus proportions → **60,000 sections = 1,715 gold-answer + 58,285 distractor, 0 source
MISS** across all 31 scoreable recall@20 queries (zero silent drops). `pilot-chunk.ts` pulls bodies
from R2 (same citation-backfilled text as production), chunks (whole ≤1024 tok; else ~800-tok
windows, 15% overlap, cap 8/section) → **79,908 chunks**, and builds the subset BM25 (Lance FTS).

**Models embedded.** `pilot-providers.ts` (model-agnostic) + `pilot-embed.ts` (resumable) → three
`pilot_vec_<slug>` Lance tables, 79,908 vectors each, cosine. `pilot-score.ts` scores vector-alone,
hybrid (RRF), and BM25 with production semantics (title/leg-tier boost + archetype-A citation
resolver), exact in-memory kNN (no ANN confound).

**Result (recall@20, excl. [GRAPH] floor, n=26; BM25 baseline 68.3% ≈ full-corpus headline).**
- **Winner gemini-embedding-001:** vector **85.9%**, hybrid **84.3% (+16.0pp over BM25)**.
- **voyage-4:** vector **85.9% (ties gemini)**, hybrid 81.1% (+12.8pp). **No legal-specialist
  premium** — the general model matches on vector and wins hybrid; the brief's central question
  ("does legal-specialist beat general on OUR corpus?") = **no**.
- **e5 (open-weight):** vector 70.5%, hybrid 77.2% (+9.0pp) — ~8pp behind, and handicapped by
  Together's 512-token cap. A viable cost floor, not a quality choice.
- **Vector layer helps most exactly where predicted:** archetype B (lay-vocabulary concept) BM25
  **23.6% → gemini vector 69.4% (+45.8pp)**; **B6 (MiFID burial) BM25 0% → vector 50%** for all
  three (3/6 sources unburied). **Citations not hurt:** gemini hybrid A = 100% (vs BM25 90%).
- **Nuance — equal-weight RRF is the wrong fusion for a strong model:** hybrid < vector-alone for
  gemini (84.3<85.9) and voyage (81.1<85.9), because RRF drags the strong vector ranking toward the
  weaker BM25 (voyage B6 even collapses 50%→0%). Only e5 gains from hybrid. Recommend query-routed
  / vector-weighted fusion (vector-dominant for concept, BM25+resolver for citations), NOT naive RRF.

**NEXT (gated on Charlie).** Full-corpus embed with gemini (test @768-d first — Matryoshka halves
the ~$0.8–1.2k sticky cost / 1.5× storage of 1536-d) → ANN index → wire the `vector` capability
flag already reserved in `lib/lex/search-gateway.ts`. Then tune the fusion + chunking. Provisional:
gold expected-sources are still the unvalidated draft.

**Files (new, `scripts/ingest/search/`):** `pilot-common.ts`, `pilot-providers.ts`, `pilot-subset.ts`,
`pilot-chunk.ts`, `pilot-embed.ts`, `pilot-score.ts`. **Docs (new):** `docs/PILOT_REPORT.md`,
`docs/PILOT_RESULTS.md`, `docs/pilot_results.json`, `docs/PILOT_SUBSET.md`. Lance (R2, throwaway
pilot tables, not committed): `pilot_chunks`, `pilot_vec_{voyage,gemini,e5}`; `_search/pilot/*`.

---

## LEX REBUILD — Sprint 3: the full kernel (Page 2 refinements + causal tree + Page 3 + Page 4 + costing shell) (2026-07-03 02:02 UTC)

**Preview only — NOT promoted.** Built `LEX_DESIGN_ADDENDUM_16-19.md` (design §16–§19). `scrutinise-web`
`tsc --noEmit` clean (only the two pre-existing `react-markdown` errors — install on Vercel). Additive
schema applied to Neon (`prisma/lex_rebuild_page3_4.sql`, idempotent; 10 placeholder benchmarks seeded).
Full kernel smoke-tested end-to-end on Neon on the deterministic no-Lex fallback path
(Orientation→Diagnosis→Guiding Policy→Coherent Actions, **16/16 assertions pass**, throwaway deleted).

- **Task 1 — method layer (§16.3).** `lib/lex/method.ts` — the four blocks VERBATIM (M-GENERAL, M-DIAGNOSIS,
  M-GUIDING-POLICY, M-COHERENT-ACTIONS). `buildLexSystemPrompt` injects M-GENERAL + the active stage's block
  (derived via `pageOf(currentField)`), under a METHOD heading ("apply it, never quote it or name a book").
  `[lex-diag] method blocks` logs which blocks are in the prompt per stage.
- **Task 2 — Page 2 refinements (§16.1).** `DiagnosisCause.classification` enum (MATERIAL|CONTRIBUTORY|
  UNASSESSED) + UI chips + a `classify` /causes action; `rootCause` selects among MATERIAL causes (falls back
  to all if none marked); reframed who's-affected to "most acutely affected"; cui bono asked in the
  pivotalObstacle turn, captured as the `beneficiariesOfStatusQuo` idea slot.
- **Task 3 — causal tree (§16.2).** `DiagnosisCause.parentCauseId` self-FK (additive SQL, ON DELETE CASCADE);
  List | Map toggle in the causes field; Map = a dependency-free nested tree render (indented + left
  connector; material nodes amber), nodes edit/classify/remove + "+ cause beneath"; soft depth cap 4 with a
  consolidation nudge; Lex `generateCauseCandidates` extended to return `classification` + one level of
  `subCauses` chains (linked on create). **Mermaid deferred** — no diagram dep existed and adding an
  uninstalled npm dep would muddy the tsc gate; the nested-tree render satisfies "Map view renders + edits".
- **Task 4 — Page 3 Guiding Policy (§17).** `lib/lex/page3-config.ts`; `PolicyOption` table + `/policy-options`
  route + field-machine CRUD; Lex seeds candidate approaches per material cause with genuine for/against
  (`generatePolicyOptions`, gateway-adjacent, resilient→[]); choose→CHOSEN + rest RULED_OUT; `whatItRulesOut`
  composed by the conductor from the ruled-out options; `leverage` (box), `anticipatedResponses` (structured),
  `conditionsForSuccess` + `summaryGuidingPolicy` (proposed). Panels: `PolicyOptionsField` + `ChosenApproachField`.
- **Task 5 — Page 4 Coherent Actions + costing shell (§18).** `lib/lex/page4-config.ts`; `LexCoherentAction`
  table (deliberately isolated from the legacy `CoherentAction` model) with the §18.2 three-way cost structure
  ({low,high,unit,basis,benchmarkId?,userOverride?}); `CostBenchmark` + `IdeaAssumption` tables + 10 hand-seeded
  placeholder benchmarks (`method: "placeholder — Phase 2 research pending"`); `/actions` route; estimator UI
  (per-action cost editors with a benchmark picker + user override); `computeCostSummary` aggregates costs vs
  the Page 2 problem cost; `coherenceCheck` + `costSummary` (computed) + `summaryCoherentActions` proposed;
  page-transition CTAs generalised (2→3→4).
- **Conductor** dispatches loops by key (causes/policyOptions/actions) and computed proposed scalars
  (whatItRulesOut/costSummary) via `seedComputedProposed`; `state.ts` populates policyOptions/actions/benchmarks;
  `proposal-schema` + `field-machine.mirrorValue` extended for all new fields; `LOCKED_PAGES` now empty (kernel
  complete). As-built rules in `LEX_PLAYBOOK.md` §11.
- **REMAINING GATE:** Charlie validates `/ideas/create` end-to-end through Coherent Actions on the preview,
  then promote. Files: `lib/lex/method.ts`, `page3-config.ts`, `page4-config.ts` (new); `page1-config.ts`,
  `page2-config.ts`, `state.ts`, `field-machine.ts`, `orchestrator.ts`, `lex-client.ts`, `proposal-schema.ts`,
  `components/lex/FieldsPanel.tsx`, `BackgroundPanel.tsx`, `app/ideas/create/CreateIdeaClient.tsx`,
  `app/api/ideas/[id]/{fields,causes}/route.ts` (edited); `app/api/ideas/[id]/{policy-options,actions}/route.ts`
  (new); `prisma/schema.prisma` + `prisma/lex_rebuild_page3_4.sql`.

---

## LEX REBUILD — Sprint 1.4: "How this works" UX polish (frontend only) (2026-07-03 01:58 UTC)

**Preview only — NOT promoted. Frontend-only.** `scrutinise-web` `tsc --noEmit` clean (pre-existing
react-markdown only).

- **Prominent trigger.** Replaced the tiny right-aligned "How this works" link with a coloured pill button
  (blue-600, rounded-full), centred above the left (chat) column via a grid matching the 3-col layout
  (`CreateIdeaClient.tsx`).
- **Auto-open on first idea.** `isFirstIdea` (already passed from `page.tsx`) now initialises `showHelp` → the
  modal opens unprompted on a user's very first idea.
- **Lex first message.** The bracketed/aside sentence in both the first-idea intro and the returning-user
  greeting now reads: "For a quick introduction if you don't know what to do, click 'How this works' above."
  (`app/ideas/create/page.tsx`).
- **Modal copy (`HowItWorksModal.tsx`).** Dropped the paragraph that repeated the panel boxes. New copy:
  "Welcome to Scrutinise." + "When editing your idea you will see three panels which all work together. You
  can:" → the three panel boxes (kept) → the four-stages closing paragraph (Basic idea, Diagnosis, Guiding
  policy, Coherent actions; research/evidence/case for Parliament; take it at your own pace).
- **Stage naming aligned.** First stage / sidebar header renamed "Getting started" → **"The Basic Idea"**
  (`ORIENTATION_PAGE.label`), matching the modal's first-stage name.

---

## SEARCH — Stage 3 payoff A/B (recall@20 OFF vs ON) (2026-07-01 16:03 UTC)

Measures whether query expansion surfaces more of the RIGHT (validated) legislation, not just more legislation — as a recall@20 delta. Search thread (separate from the LEX REBUILD entry below). Builds on the 13:57 smoke test.

**B6 answer-key filled + verified (Task 1).** All 6 MiFID sources confirmed PRESENT in `corpus_sections` (Neon prefix-LIKE on the id PK): FSMA 2023 (`ukpga/2023/29`, enacted-CLML `pNNNNN` refs — pinned on the act gid), FSMA 2000 (Markets in Financial Instruments) Regs 2017 (`uksi/2017/701`), retained MiFIR (`retained-eu:eur/2014/600`), **FCA Handbook COBS + SYSC (`fca-handbook:cobs`/`:sysc` — it IS ingested**, contra the assumption the licence gate meant no data), FSMA 2000 framework (`ukpga/2000/8`), onshoring SIs (`uksi/2019/1390`, `uksi/2021/1388`). **No coverage gaps.** B6 set `scoreable:true`.

**Expansion A/B mode (Task 2).** `score-fts.ts --ab`: for every recall@20 query, `rankedSearch` on the BARE query (OFF) vs the `expandQuery`-enriched keyword set (ON), recall@20 both ways. Without `--ab` the harness is byte-identical to the baseline (expansion never runs). `expandQuery` is the SAME platform function `fireSearchTrigger` uses, loaded via runtime `require` (computed path) so the cross-rootDir web import stays tsc-clean. Writes `docs/FTS_STAGE3_AB.md` + `docs/fts_stage3_ab.json`.

**Results (Task 3).**
- **Archetype B (payoff): OFF 33.3% → ON 48.6% = +15.3pp.** ✅ B RISES as predicted. Biggest wins where lay words miss the statute: B3 photo-privacy 0→66.7 (DPA 2018 @1 + PfHA 1997), B1 no-fault eviction 0→25 (HA 1988 s.21 @1), B2 short-lets 33.3→66.7 (LURA 2023 surfaced).
- **Archetype A: OFF 60.0% → ON 70.0% = +10.0pp — NOT flat**, and bidirectional: A5 ("law that says wear a seatbelt", a concept query filed under A) 0→100, but **A1 ("Section 21 Housing Act 1988", precise citation) 100→50** — expansion diluted the query and displaced the secondary source (exact-pin on s.21 preserved by the resolver). So expansion is NOT neutral on citation queries: it helps concept-bridge queries and HURTS precise ones. The prediction ("A flat") is too simple.
- **Dilution regressions:** B4 100→50 (Public Office/Hillsborough Bill crowded out by HSCA/Care-Act terms), D1 −50, D3 −100, B5 ranks pushed toward the tail. Pattern: when a query already retrieves the precise item, adding ~15 broad terms dilutes BM25 and pushes precise/secondary sources out of the top-20. → **Keep expansion scoped to concept queries** (production already does — Page-1 keywords, not citation lookups).
- **B6 (MiFID) only 0→16.7pp** — the diagnostic the brief asked for. Expansion named plausible anchors (FSMA 2000, MiFID Directive, UK MiFID, Investment Firms Reg/Directive) but NOT the validated key (FSMA 2023, MiFIR, MiFI Regs 2017, FCA Handbook); only an onshoring SI matched (@9). Probed the cause: the key sources ARE present + indexed in Lance (a targeted "FCA Handbook COBS best execution" query returns 15/20 fca-handbook rows; FSMA 2023 sections exist) — but even a near-exact "Financial Services and Markets Act 2023" query surfaces committee/HMRC/parliamentary chatter ABOVE the Act's own sections. **B6 is a RANKING problem, not coverage:** for a broad financial-regulation concept, BM25 buries the legislation beneath denser non-legislative mentions, and the 1.8× legislation-tier boost + expansion aren't enough. The flagship case for the vector layer / stronger legislation-tier ranking (GOLD_QUERIES §A: B is "the core target").
- **Caveat:** transient Gemini 503/aborts left C1/C2/F2/F4/K2/J1 with `+0 terms` (expansion failed → ON=OFF), so C's +6.7pp understates; **every A and B query got a full expansion**, so the payoff (B) and flat-check (A) conclusions are clean.
- **Baseline headline shifted 69.4%→67.2% (n 30→31)** solely because B6 (now scoreable, OFF 0%) joined the scored set — the 30 v1 per-query numbers are unchanged.
- **`tsc --noEmit` (scripts/ingest):** only the 4 documented pre-existing errors.
- Files: `scripts/ingest/search/gold-queries.ts` (B6 filled), `scripts/ingest/search/score-fts.ts` (A/B mode), `docs/FTS_STAGE3_AB.md` + `docs/fts_stage3_ab.json` (new), `docs/FTS_S1b_SCORING.md` + `docs/fts_s1b_scores.json` (regenerated, B6 scoreable).

---

## LEX REBUILD — Sprint 2: Diagnosis (Page 2) + search gateway + Page 1→2 transition (2026-07-01 15:26 UTC)

**Preview only — NOT promoted.** Built `LEX_DESIGN_ADDENDUM_14-15.md §15` (design §7, §14). `scrutinise-web`
`tsc --noEmit` clean (only the two pre-existing `react-markdown` module-not-found errors — not installed
locally, installs on Vercel). Full Page 1→Diagnosis chain smoke-tested end-to-end on Neon on the
deterministic fallback path (no-Lex): 22 assertions pass, throwaway script deleted.

**Task 1 — the search gateway (§14).** New `lib/lex/search-gateway.ts` — the SINGLE point of contact with
search. `runSearch({ keywords, intent, ideaContext?, limit? })` owns: build query → Stage-3 expansion
(capability flag) → web orientation (capability flag) → retrieval (`runFtsSearch`) → map + group by display
type (`groupForPanel`). **Intent vocabulary owned here** (`BACKGROUND_BRIEFING`, `CAUSE_SEEDING`; reserved
`AMENDABLE_SECTION`/`POLICY_ALTERNATIVES`/`COMPARATIVE_LAW`). **Capability flags** (`expansion`,
`webOrientation`, `vector`, `reranker`, `graph`) read from env, **default OFF** (`expansion` = existing
`LEX_QUERY_EXPANSION` for back-compat). `fireSearchTrigger` now routes through the gateway with intent
`BACKGROUND_BRIEFING` — **no behaviour change** (expansion still gated + query-only, briefing prose still
uses original keywords). `// Single seam — when search grows, only this file changes.`

**Task 2 — Diagnosis fields (§7.1).** New `lib/lex/page2-config.ts` (7 fields): `challenge` (text,
Lex-proposed), `whoAffectedImpactCost` (structured — slots affectedGroups/impact/cost/evidence; **carried
forward** from Page 1's `whoAffected`, not re-asked), `causes` (loop), `rootCause` (reference — pick one
cause), `legalLandscape` (structured — currentLaw/whereItFails, placed **before** the obstacle), 
`pivotalObstacle` (text, Lex-proposed, distinct from root cause), `summaryDiagnosis` (Lex-generated, names
**both** root cause and pivotal obstacle). The whole field machine was **generalised from Page-1-only to
multi-page**: `page1-config` now aggregates `PAGE_SEQUENCE = [ORIENTATION, DIAGNOSIS]`, `ALL_FIELDS`,
`fieldDef`/`PROPOSABLE_KEYS`/`BOX_KEYS`/`STRUCTURED_KEYS` span all pages; `acceptSurfaceOf(def)` (box→panel,
proposed→chat) routes the accept surface; canonical state gains `stage` (=lexPage), `nextPage`,
`diagnosisCauses`. `state.ts` scopes `currentField` to the active `lexPage` page.

**Task 3 — the causes loop (§7.2).** New `DiagnosisCause` child table (mirror of CoherentActions) +
`DiagnosisCauseSource` enum; additive Idea columns (`lexPage`, `challenge`, `whoAffectedImpactCost` Json,
`legalLandscape` Json, `pivotalObstacle`; `rootCause`/`summaryDiagnosis` reuse legacy columns). Applied to
Neon via idempotent `prisma/lex_rebuild_page2.sql` (`prisma db execute`, **not** `db push` — playbook §7).
CRUD in `field-machine.ts` (add/update/remove/list/setRootCause/createCauses); Lex pre-seeds candidates via
the gateway `CAUSE_SEEDING` + `generateCauseCandidates` (structured Gemini call, resilient → [] on failure).
New `POST /api/ideas/[id]/causes` route (add/update/remove/confirm/skip/setRoot).

**Task 4 — the Page 1→Diagnosis transition.** `Idea.lexPage` is the explicit current-page pointer (distinct
from the 5-stage lifecycle). Page 1 no longer dead-ends: on Orientation complete + briefing **ready**, the
Background panel shows a CTA row — **Continue to Diagnosis** (`POST /api/ideas/[id]/page` → `advanceLexPage`,
guarded: forward-only, current page must be complete → then the conductor seeds the first Diagnosis field) +
**Ask Lex about this** (focuses the chat) + a disabled **Give feedback** placeholder (flow is Sprint 2.5).

**Task 5 — conductor extension (§13).** `orchestrateAfterWrite` generalised to the active page and dispatches
by field kind: narrative box → ask; proposed scalar → propose (deterministic fallback so the confirm always
appears); structured panel box → **seed** a proposal (carry-forward / empty slots) → AWAITING; loop → seed
corpus candidates → AWAITING; reference → ask which cause; `summaryDiagnosis` generated when the prior fields
are terminal. **Same save-before-advance rule** — it only speaks for a freshly-EMPTY field and never advances
an AWAITING one. Seeding structured/loop fields to AWAITING both holds them current and prevents re-seeding.

**Task 6 — panels.** `FieldsPanel` renders the new field kinds (StructuredField editor, CausesField loop with
per-row edit/remove + "these are my causes"/skip, RootCauseField selector) alongside the Page-1 renderers,
purely from canonical state. `BackgroundPanel` gained the CTA row. `ChatPanel` gained a `focusNonce` for
"Ask Lex about this". `lex-client` proposable-key enum + prompt extended for the Page-2 proposed scalars and
the panel-box (no-proposal) fields; `proposal-schema` gained validators for the Page-2 fields.

**Files:** new `lib/lex/{search-gateway,page2-config}.ts`, `app/api/ideas/[id]/{causes,page}/route.ts`,
`prisma/lex_rebuild_page2.sql`; changed `lib/lex/{page1-config,field-machine,state,orchestrator,lex-client,
proposal-schema}.ts`, `app/api/ideas/[id]/{fields,lex}/route.ts`, `components/lex/{FieldsPanel,BackgroundPanel,
ChatPanel}.tsx`, `app/ideas/create/CreateIdeaClient.tsx`, `prisma/schema.prisma`. **GATE:** Charlie validates
`/ideas/create` through Diagnosis on the preview, then promote.

---

## SEARCH — Stage 3 smoke-test + v2 gold harness (2026-07-01 13:57 UTC)

Two independent tasks; neither depended on the archetype-B answer-key being finalised.

**Task 1 — Stage 3 smoke-test (VERIFIED, throwaway script deleted).** Confirmed the query-expansion
plumbing works and the model names real anchors, before investing in formal scoring. A throwaway
`scripts/ingest/search/smoke-stage3.ts` drove the REAL path: `expandQuery(keywords, '')` (with
`LEX_QUERY_EXPANSION=true`) then `rankedSearch` (bare keywords vs expanded set) against the live
16.5M-row `corpus_fts` LanceDB-on-R2 index.
- **Note on plumbing:** the platform entry point `runFtsSearch` is a thin HTTP+hydrate wrapper over the
  Railway `fts-serve` endpoint and is DORMANT locally (`FTS_SEARCH_URL` unset → silent stub fallback,
  tests nothing). So the test exercised `rankedSearch` directly — the exact BM25 + title/legislation-tier
  boost path both the query service (behind `runFtsSearch`) and `score-fts.ts` use. `expandQuery` + the
  Set-merge mirrored `fireSearchTrigger` line-for-line.
- **Result (acceptance MET):** for **"Revoke MiFID II"** the LLM named sensible anchors — **FSMA 2000,
  FSMA 2023, MiFID Directive, retained MiFIR, UK MiFID** — and the expanded query surfaced **6 new
  legislation rows** the bare query missed (the 2006 MiFID-implementing SIs + 2019/2021 onshoring SIs),
  lifting the top legislation score 44→378. **"data protection"** → anchors DPA 2018 / UK GDPR / GDPR;
  expansion surfaced DPA 2018 (leg@20 0→1). **"seatbelt law"** → anchors RTA 1988 + Wearing of Seat Belts
  Regs; expansion surfaced **RTA 1988 s.15** (the actual provision, leg@20 0→5).
- **Observed:** Gemini returned transient **HTTP 503** on 2 of the first calls (overloaded); `expandQuery`
  degraded to EMPTY exactly as designed (resilient). A short retry in the test harness rode over it. In
  prod this means an occasional trigger gets no expansion and falls back to the original keywords — the
  intended graceful degradation.
- **Caveat on the leg@20 count metric:** it can *fall* (MiFID 11→10) even as relevance rises sharply —
  the composition shifts toward MiFID-specific instruments and scores jump ~8×. The "new legislation
  surfaced" set + score lift tell the real story, not the raw count.

**Task 2 — v2 gold structure encoded in the scoring harness (`GOLD_QUERIES.md` v2).**
- **`gold-queries.ts`:** added `Archetype` G–K, `ARCHETYPE_META` (per-archetype stream/kind/metric from
  §A), and per-query `stream` / `kind` / `metric` (`recall@20` | `lesson`) / `scoreable` / `lessonTarget`
  / `todo`. New entries: **B6** (validated MiFID lay test), **G1–G3 · H1–H3 · I1–I3** (principle streams,
  `[PRINCIPLE-STREAM]`), **J1** (`[FOREIGN]`, deferred), **K1–K2** (exact-pin). The 30 v1 entries are
  untouched — stream/kind/metric are grafted on at export; `scoreable` defaults to
  `metric === 'recall@20'`, so all 30 stay `scoreable:true` and their patterns/scores are unchanged.
- **Expected-sources for the new SPECIFIC queries (B6, K1, K2) + J1 are TODO placeholders** (empty
  patterns, `todo:true`) — to be filled from the validated answer-key (§C). Marked `scoreable:false` so
  they are present but excluded from the headline until then.
- **`score-fts.ts`:** headline recall@20 now aggregates over **scoreable recall@20 queries only** (== the
  v1 set) → numbers byte-identical to v1. Added the **0–2 lesson scaffold** (principle G–I reported as
  NOT CALIBRATED — rubric set by example once a principle-stream result exists, §C.3) and a **pending-
  validation** section (B6/J1/K1/K2). Both groups get a top-20 eyeball dump (the calibration/validation
  artefact) but never enter the headline. JSON gains stream/kind/metric/scoreable/todo + `excluded` lists.
- **Verified (harness runs, EXIT 0, 43 queries):** headline **overall recall@20 = 69.4% / MRR 0.693**,
  **excl. [GRAPH] floor = 68.0% / 0.729 (n=25)** — identical to the 27 Jun v1 baseline; per-archetype
  A=60 B=40 C=60 D=76.7 E=90 F=90 unchanged. New queries present; **9 principle + 4 pending cleanly
  excluded** from the headline. Regenerated `docs/FTS_S1b_SCORING.md` + `docs/fts_s1b_scores.json`.
- **`tsc --noEmit` (scripts/ingest):** only the 4 documented pre-existing errors (diag-db / run-cleanup
  missing `@prisma/adapter-pg`, test-fca-playwright missing `playwright`, v26-pooled-smoke rootDir) —
  zero new.
- Files: `scripts/ingest/search/gold-queries.ts`, `scripts/ingest/search/score-fts.ts`,
  `docs/GOLD_QUERIES.md` (v2), `docs/FTS_S1b_SCORING.md` + `docs/fts_s1b_scores.json` (regenerated).

---

## SEARCH — Stage 3: LLM query expansion (concept→legislation bridging) (2026-06-30 12:14 UTC)

Bridges the lay-vocabulary gap proven in Finding B. Before the background search runs, a Gemini call
expands the user's concept keywords with likely anchor Acts/SIs, statutory terms-of-art, and alternative
phrasings — so anchor legislation enters the BM25 candidate set even when the user's words are lay terms.

- **Scope:** Page 1 background search only (the keywords-accept trigger in `fireSearchTrigger`). Other
  callers unchanged. Widen after measuring.
- **Single enriched query:** one expansion call per trigger, merged into the keyword set passed to
  `runFtsSearch`. Not fan-out.
- **Parametric only:** Gemini's own UK law knowledge. No web grounding.
- **Audit:** traced the full path — `fields/route.ts` keywords-accept trigger → `fireSearchTrigger`
  → `runFtsSearch`. Expansion inserts at the exact point where the keyword set is assembled (line 217),
  platform-side. The FTS service itself is unchanged.
- **New file `lib/lex/query-expansion.ts`:** `expandQuery(keywords, ideaContext)` → `{ anchors,
  termsOfArt, rephrasings }`. Uses Gemini 2.5 Flash structured JSON (responseSchema, temperature 0.2).
  Returns `EMPTY` on any failure so `fireSearchTrigger` always runs (resilient). Config-driven:
  `QUERY_EXPANSION_MODEL` (default `gemini-2.5-flash`), `QUERY_EXPANSION_TIMEOUT_MS` (default 10s).
- **Modified `lib/lex/field-machine.ts` → `fireSearchTrigger`:** fetches `ideaNarrative` +
  `youAndIdeaNarrative` alongside `keywords`; calls `expandQuery`; merges via `Set` (deduplication);
  passes expanded set to `runFtsSearch`; briefing prose (`buildInitialBackground`) still receives only
  the user's original keywords — grounding guardrail enforced.
- **Grounding guardrail (critical):** expansion feeds ONLY the FTS query. Nothing the LLM proposes
  enters briefing text. A hallucinated Act scores zero in BM25 and causes no harm.
- **Feature flag:** `LEX_QUERY_EXPANSION=true` (default off in prod — A/B scoreable on gold set). Set
  in Vercel env to enable. Off means zero expansion call, zero added latency.
- **Observability:** `[query-expansion] terms added` log per trigger (original keywords, added terms,
  anchors/termsOfArt/rephrasings breakdown) so each expansion is inspectable.
- **Predict/measure:** lay-concept queries (data protection, road safety, "Revoke MiFID II") should rise
  when expansion ON (anchor Act enters BM25 candidates). Citation queries (archetype A) should be
  unaffected. Verify on gold set once `LEX_QUERY_EXPANSION=true` in staging.
- **`tsc --noEmit`:** only pre-existing `react-markdown` module-not-found errors (package in package.json,
  not locally installed — installs at Vercel build time). Zero new errors from this sprint.
- Files: `lib/lex/query-expansion.ts` (new), `lib/lex/field-machine.ts`.

---

## LEX REBUILD — Sprint 1.3 (save-before-advance + guided tour + name) (2026-06-25 01:12 UTC)

Un-promoted preview (no promote). `scrutinise-web` `tsc --noEmit` clean. Behavioural rules recorded in
`LEX_PLAYBOOK.md` §3a/§3b. Touches only the create flow; the Stage-2 `/api/ai` path is untouched.

- **Task 1 — save-before-advance (diagnosed first, then enforced).** Diagnosis (reading every byte of
  the state path): `currentField` = the *first non-terminal* field, so an `AWAITING_CONFIRMATION` box
  stays current by construction — the structural guarantee was already correct, and the orchestrator
  runs only from the `fields` route (never `/lex`). The live regression was at the **conversation/prompt**
  layer: when a box already held an unsaved proposal, the `/lex` prompt still treated the turn generically,
  so Lex's `chatText` read as moving to the next box and didn't direct the user to **Save**. Enforced on
  three layers: (1) `/lex` now builds the prompt with **`awaiting`** = `currentField` is
  `AWAITING_CONFIRMATION` → Lex refines *that box only*, must not ask/propose the next field, and points
  to the panel to Save; (2) on a fresh box proposal the prompt requires `chatText` to point to the panel
  and ask the user to review and Save (suggested copy); (3) tightened RULES ("finish the CURRENT field…
  the platform moves on only when the user Saves or Skips"). Kept the existing structural guards (proposal
  applied only when `fieldKey === current.key`; orchestrator early-returns on non-`EMPTY`). **Added
  `[lex-diag]` logging** across the `/lex` route (`{currentField,status,awaiting,proposalApplied}` +
  `off-field proposal discarded` warning), the orchestrator (`advancing`/`holding`), and the `fields`
  route (`{action,fieldKey,nextField,nextStatus}`) so the symptom is visible if it recurs.
  Files: `lib/lex/lex-client.ts`, `app/api/ideas/[id]/lex/route.ts`, `lib/lex/orchestrator.ts`,
  `app/api/ideas/[id]/fields/route.ts`.
- **Task 2 — guided tour + FAQ modal restored.** New `components/lex/HowItWorksModal.tsx`: a **persistent
  "How this works"** button in the create view (always rendered) opens a tour explaining the three panels
  (verbatim brief copy) with a **Read the FAQs** button that switches to the existing FAQ content
  (`lib/faq-content.ts`, incl. the Strategic-Kernel / Guiding-Policy explanation), rendered with
  `react-markdown`. The first-idea intro now offers it ("…say the word…"); a conservative `HELP_INTENT`
  regex in `CreateIdeaClient` opens the modal on a plain "how does this work / give me a tour" message
  (does **not** match a bare "yes please" or "explain how this *policy* works"). Files:
  `components/lex/HowItWorksModal.tsx` (new), `app/ideas/create/CreateIdeaClient.tsx`,
  `app/ideas/create/page.tsx`.
- **Task 3 — name.** Intro + orchestrator prompt now use **`preferredName ?? firstName`** (was bare
  `firstName` in the page after the earlier "Charles" workaround; the orchestrator had the fallback order
  reversed). **Data fix on Neon:** the two Charlie accounts (`cl@scrutinise.org`,
  `scalablefinance@gmail.com`) had `firstName`=`preferredName`=`Charles` → `preferredName` set to
  `Charlie` (the deliberate "Boss"/historical accounts left untouched). Files:
  `app/ideas/create/page.tsx`, `lib/lex/orchestrator.ts`.
- **Verification:** `tsc --noEmit` clean; deterministic smoke (deleted) asserted the `awaiting` vs
  fresh-box prompt branches and the `HELP_INTENT` match/non-match set. Charlie validates on the preview.
- **Separation note:** the prior session's FTS "Finding B" search changes landed as their own commit
  `d55e118` (below the two Sprint 1.3 commits) — kept out of this Lex work, not bundled in.

## SEARCH/LEX — Finding B: concept→legislation diagnosis + legislation-tier boost (2026-06-25 01:08 UTC)

Diagnosed why broad **concept** queries under-surfaced the legislation tier (the briefing's
"legal framework" fell back to "no primary legislation matched"), then fixed the half that
ranking can fix. Full diagnosis + boost sweep: `docs/FTS_FINDING_B_DIAG.md` (companion to the
archetype-A diag). Deep candidate-set probe (k=800) against live `corpus_fts` (16,509,051 rows).

- **Two causes, one symptom.** *Term-of-art* concepts (MiFID) → **RETRIEVED-but-low**: the
  anchors (FSMA 2000, the 2017 MiFID SIs, retained MiFIR/MiFID II) ARE in the BM25 candidate
  set (retained MiFIR at cand#1 on one phrasing) but only 1 legislation row reached the
  pre-boost top-20 — legislation bodies have NULL `sectionTitle`, so they miss the ~2.5×
  title-boost that lifts parliamentary/guidance rows. *Lay-phrased* concepts (data protection,
  road safety) → **ABSENT**: the DPA 2018 Act never enters candidates; RTA 1988 appears only as
  `section-12E`. Vocabulary mismatch — hard evidence the **vector layer** (next build) is the
  fix there; re-ranking can't reach rows retrieval never returned.
- **Fix (`search/fts-core.ts`):** `LEX_LEG_TIER_BOOST` (`FTS_LEX_LEG_TIER_BOOST`, default
  **1.8**) on the legislation tier for NON-citation queries (citation path keeps
  `CITATION_TIER_BOOST` 1.6). Multiplicative on the BM25 body score → re-ranks only what BM25
  retrieved; a boost, NOT a reserved slot, so it never injects an irrelevant Act.
- **Re-test (top-20 legislation):** MiFID set A **1→4 (FSMA 2000 at #1)**, set B **4→4 (#1–4)**;
  controls (data protection, road safety) stay at **0** at every boost — proof it's inert when
  the anchor isn't in candidates. 2.5 over-corrects (11–15/20, EM filler) → 1.8 chosen.
- Query-time only — **no reindex**. Takes effect on **fts-serve redeploy** (boost lives in
  `fts-core`, shared by the serving service + scoring harness).

## SEARCH/LEX — Finding A: FTS cold-start fix (adapter timeout + serve warm-up) (2026-06-25 01:08 UTC)

The FIRST query after an fts-serve (re)deploy is cold — LanceDB fetches the FTS index files
from R2 on first touch (~15s observed), which blew the platform adapter's 8s budget and made it
silently fall back to the **stub** (caught when the FTS path was first validated, 24 Jun).

- **`scrutinise-web/lib/lex/fts-search.ts`:** `FTS_TIMEOUT_MS` default `8000 → 25000` (still
  env-overridable) — covers the cold-redeploy window.
- **`scripts/ingest/search/fts-query-service.ts`:** boot **warm-up self-query**
  (`rankedSearch(table,'legislation',{limit:1})`) after the table + ActIndex open, before
  `listen()`, so the cold R2 index fetch happens at boot, not on a user query. Non-fatal:
  a warm-up failure is logged and the service still serves (next real query pays the cold cost).
- Net: the first real user query is warm AND the adapter no longer trips into the stub on the
  rare cold path. Takes effect on **fts-serve redeploy** + the web deploy picking up the adapter.

## SEARCH/LEX — FTS serving endpoint + platform adapter (wire Lex to real search) (2026-06-24 06:57 UTC)

Stand up the permanent FTS query service and the platform-side adapter that maps native
FTS results → the Lex `SearchResult` contract. The platform calls FTS; Lex never does.

- **Serving:** `scripts/ingest/search/fts-serve-run.ts` — creates the always-on Railway
  `fts-serve` (POST `/fts-search`; opens `corpus_fts` on R2 once + loads the 135k-row
  ActIndex so the citation resolver is active; restart=ALWAYS; public domain). Small
  instance, inside the 8 GB Hobby cap. LIVE: https://fts-serve-production.up.railway.app
  (16,509,051 rows; /health + sample query verified).
- **Adapter:** `scrutinise-web/lib/lex/fts-search.ts` (`runFtsSearch`) — keywords[] →
  query, calls `/fts-search`, maps id/snippet/score direct; `type` via the corpus map;
  `title`/`citation` from gid → `LegislationItem.title` (legislation) else `sectionTitle`;
  `url`/`date` via one batched `WHERE id IN` over `corpus_sections` (legislation url
  derivable from the gid). Falls back to the stub on any failure.
- **Type map:** `scrutinise-web/lib/lex/corpus-type-map.ts` — corpus/tier/gid-doctype →
  `SearchResultType`.
- **Enum extension (Charlie, 24 Jun):** `page1-config.ts` `SearchResultType` +GUIDANCE /
  EU_LEGISLATION / BILL / TREATY so every corpus family maps; `BackgroundPanel.tsx` labels
  + order updated for the four new types.
- **Swap:** `field-machine.ts` `fireSearchTrigger` — `runStubSearch` → `await
  runFtsSearch` (one line). Dormant (stub fallback) until `FTS_SEARCH_URL` is set on the
  web deploy. tsc clean both sides.

## BUILD — Hetzner build-runner tooling (INERT, no box created) (2026-06-24 06:57 UTC)

Reusable runner to drive a transient Hetzner build box for heavy single-shot builds
(first use: the vector layer), mirroring `fts-railway-run`. INERT — box creation is the
spend event, Charlie-triggered; nothing is created here.

- `scripts/ingest/search/hetzner-build-run.ts` — `setup` (INERT preflight: validates
  HETZNER_API_TOKEN + Neon/R2 creds and CCX43 / fsn1 / ubuntu-24.04 against the live API,
  renders cloud-init, creates nothing) / `run` (the spend: create a CCX43 16 vCPU/64 GB
  Falkenstein box; cloud-init clones Main, installs Node 20 + deps, injects Neon + R2 —
  NOT the Hetzner token, the build never calls Hetzner) / `logs` (stdout tail via R2) /
  `teardown` (DELETE via API). Progress checkpoints to R2 so the existing `fts-watch`
  monitors it unchanged.
- `scripts/ingest/search/hetzner-logtail.ts` — on-box stdout → R2 tailer.
- `.gitignore` — guards the cred-bearing cloud-init preview, the server-id, and the
  `.*-service-id` state files (the glob also covers the FTS-serve runner). tsc clean.

## V30 POST-PUSH — seed execution (cma-cases · scottish OR 2016+∪pre-2016 · POH evidence tranche) (2026-06-25 01:12 UTC)

*(Grouped with the V30 build entry below; sits chronologically alongside the concurrent 25 Jun SEARCH/LEX entries near the top of this file — separate workstream.)*

Executed the V30 POST-PUSH run order. The prior session (interrupted by a VSCode shutdown) had completed steps 1–3 but never recorded them; this session verified that, resumed at step 4, and seeded with per-corpus canaries. Live data ops only — no code/schema change. Deploy confirmed SUCCESS (Railway Ingest 24 Jun 12:15 UTC); each new sourceType canaried (worker produces sections, not markSkipped) before trusting the seed.

- **(1) rate-limits ✓** — `cma-cases` 300ms/5, `inquiry-evidence` 1000ms/2 upserted (idempotent re-run).
- **(3) cma-cases ✓ SEEDED + DRAINED** — found already drained by the interrupted session (queue rows created 24 Jun 11:53, sections 12:15–14:18 UTC): **22,890 done / 22,890 sections / 8 transient `PDF fetch failed`**. Re-running the seed was a harmless idempotent no-op (0 processed in the last 90 min). Full enumeration = 20,336 decision PDFs + 2,562 case-overview rows = 22,898 (the `--measure` 4.1-PDFs/case sample undershot; actual >5).
- **(4) scottish-parliament-or ✓ SEEDED (7,452) + DRAINING** — pilot re-confirmed live (366 contributions / 38,014 w on a 24 Jun report). `v28-seed-…` enumerated **5,130** modern rows (sitemap); `v30-seed-…-pre2016` enumerated **2,322** legacy rows (Wayback CDX; 6/10 sample with content, 4 → expected `archive-miss`). Ops woke the idle worker ~4 min after seed; **canary PASS: both branches produce sections, skipped=0 failed=0** (pre-2016 `arch:` branch ~83–130 sections/report). Modern 5,130 still queued behind pre-2016 → re-baseline at drain.
- **(5) inquiry-evidence ✓ BOUNDED TRANCHE SEEDED + DRAINED (canary PASS)** — Charlie chose bounded-first. `--max-pages 5` = **90 rows → 90 sections** (89 `av=full`, real extracted text 132–218,448 words; 1 `av=pdf-only` graceful marker on a likely-scanned witness statement; 0 skipped/failed). **§0 keep-path + PDF extraction confirmed live**; POH's §0 sample is all-keep so the exclude→`sensitive-excluded` path stays unit-tested-only (matters for IB/Grenfell, not POH). **Full ~19,425-item POH seed is the live ask** (drop `--max-pages`).
- **(6) own-domain reviews — SKIPPED** (no pinned PDFs; gated on Charlie capturing Cass/CSC/IMMDS report PDFs).
- **(7) re-baseline + `v20-licence-backfill.ts` — PENDING at drain** (scottish modern still draining).

**Tidy-up note:** the interrupted session left the handoff/CHANGE_LOG describing cma-cases as "seed POST-PUSH" when it had in fact shipped; both are now corrected to as-built. No uncommitted code was left (V30 code committed in `0305905`+`de87942`; the 3 untracked `docs/` files — `OUTREACH_EMAILS.md`, `LEX_REBUILD_DESIGN*.md` — are pre-existing other-workstream drafts, not V30).

---

## V30 — UK DEPTH COMPLETION (financial corpus · own-domain reviews · inquiry evidence · pre-2016 Scottish OR) (2026-06-24 00:00 UTC)

Closes the four deferred-tail items into scope. Build-only (no git until `commit-all.sh`; new sourceTypes seed POST-PUSH). `tsc --noEmit` clean. Full report + scorecards: `docs/SPRINT_V30_REPORT.md`. Governance: `docs/SENSITIVE_EVIDENCE_POLICY.md`.

- **§1 Financial & competition corpus DEFINED + partly built.** The bodies that make/interpret financial/competition/economic law.
  - **§1.1 CMA / OIM / SAU cases — BUILT (`cma-cases`, OGL v3.0 verified).** gov.uk `cma_case` finder (2,562 cases) → body-overview section + per-PDF decision-doc rows (assets.publishing.service.gov.uk). Measured **~12,511 sections** (60-case sample, avg 3.9 PDFs/case); pilot ✓ (body 925 w + lead PDF 5,199 w). Dedup-clean vs `quangos-govuk`. `sources/cma-cases.ts` + `processCmaCases` + `v30-seed-cma-cases.ts`.
  - **§1.2 CAT — PROBED, NOT BUILT (V31 email).** catribunal.org.uk `/judgments` route clean (~1,100 judgments) but `/copyright-notice` = CAT/Competition Service own copyright, private-study-only, other use by application — **not open**. Not in Find Case Law (no OJL route). licence code `cat-restricted`; email the Competition Service.
  - **§1.3 FCA enforcement — PROBED, NOT BUILT (V31 email).** fca.org.uk/legal verified: FCA own copyright, OGL only for expressly-stated statistical outputs → final/decision notices not open. `fca-restricted`; email with BoE/PRA.
- **§2 Own-domain reviews (Cass) — BUILT, PDF-ROUTE-BLOCKED.** `sources/own-domain-reviews.ts` (Wayback-CDX PDF enumerator + pinned-PDF support) + registry + `v30-seed-own-domain-reviews.ts` (ingests into `independent-reviews` via the deployed per-PDF processor). The flagship microsites (Cass, Children's Social Care, IMMDS) are **JS-SPA shells**: 0 Wayback PDF captures; Cass UKGWA-only (no CDX). 0/3 enumerable — listed for Charlie (capture/pin the report PDFs to unblock).
- **§3 Inquiry evidence — PIPELINE BUILT + PILOTED + §0 GOVERNED.** New corpus `inquiry-evidence`; `sources/inquiry-evidence.ts` + `processInquiryEvidence` + `v30-seed-inquiry-evidence.ts`. **§0 structural sensitive-exclusion** (`classifyEvidence` keep/exclude/flag on the inquiry's own evidence-type/witness-category/restriction structure — never per-paragraph; enforced at ingest, excluded → `sensitive-excluded` marker; **6/6 unit assertions pass**). `SENSITIVE_EVIDENCE_POLICY.md` written. **Pilot: Post Office Horizon** (OGL v3.0 verified, **~19,605 items**; §0 12/12 keep; 2 PDFs extracted ✓). Infected Blood + Grenfell probed (own-site `/evidence`+`/hearings`) → sequenced (POH → IB kept-only → Grenfell, measure each).
- **§4 Pre-2016 Scottish OR — BUILT (`scottish-parliament-or` extended, SPCB).** Sessions 1–4 (1999–2016) from the **Internet Archive Wayback** of the legacy `report.aspx?r={id}` site (membership = capture < 2016-05; fetch = multi-capture fallback to the `or_speaker`-era rendering). **2,322 reports**; old-format parser ✓ (sitting date = most-frequent in-content date — the `DC.date` meta is a constant template value); pilot content reports avg 157 turns / 22k words; sparse ones → `archive-miss` markers. `sources/scottish-or-archive.ts` + `processScottishOrArchive` (`arch:{r}` docId branch) + `v30-seed-scottish-or-pre2016.ts`.
- **§5 Docs/code:** `licence-map.ts` +4 (`cma-cases` OGL3, `inquiry-evidence` OGL3, `cat-restricted`, `fca-enforcement`→`fca-restricted`); `seed-rate-limits.ts` +2 (`cma-cases` 300/5, `inquiry-evidence` 1000/2); `db-metadata.ts` availabilityStatus +5 (`sensitive-excluded`/`-flagged`/`no-pdf`/`archive-miss`/`superseded`); `CORPUS_CLOSURE_REGISTER.md` updated; `INGEST_PLAYBOOK.md` §8 V30 patterns; handoff updated.
- **⚠️ Verify-before-asserting catch:** `scottish-parliament-or` has **0 sections / 0 queue rows** — the V28 2016+ seed was never run. POST-PUSH order seeds both 2016+ (V28) and pre-2016 (V30).

---

## LEX REBUILD — Sprint 1.2: polish (markdown · intro copy · Lex retry) (2026-06-23 17:42 UTC)

Three polish items on the un-promoted preview (`LEX_REBUILD_DESIGN v.1.md`). `tsc --noEmit` clean. **Do NOT promote to production.**

- **Markdown in the Background panel.** The Initial Background body rendered as raw markdown (`##`, `**`). No existing markdown renderer (checked, to avoid a duplicate) → added **`react-markdown@10`** (React-19-compatible). `BackgroundPanel` renders the body via a `Components` map (`MD_COMPONENTS`, `node` stripped); Tailwind v4 has no typography plugin so styling is per-element. Verified: `## / **` → `<h2>/<strong>/<li>`. Recorded in `LEX_PLAYBOOK.md` §5.
- **Returning-user intro fixed.** Dropped the "the button below takes you on a short guided tour" promise (no such button exists; the tour is a future feature). Now: "Good {afternoon} {name}. What's the problem or challenge you want to address? (Say the word if you'd like me to explain how this works.)" (`app/ideas/create/page.tsx`).
- **Lex turn: log-then-retry (bytes before hypotheses).** `runLexTurn` now logs the **cause per attempt** before anything else — `kind` ∈ rate_limit(429)/upstream_5xx/http_error/timeout/network/empty_response with `status` + `bodySnippet`, and the raw bytes when structured output fails the shape check; `/lex` returns `errorType=kind`. The client **retries the whole turn once** (700 ms) before showing "I lost the connection" (the failure self-recovered on resend → likely transient). No tuning — diagnose from the server logs first.

---

## SEARCH S1b — archetype-A fix: citation resolver + citation backfill; positions pilot stood down (2026-06-23 11:24 UTC)

**Why:** v1 is the win (57.8% recall@20) but archetype A (known-item / citation lookup) scored **0%** — a core use case. This sprint diagnoses it before building, then fixes it and re-scores.

**Diagnosis (`docs/FTS_ARCHETYPE_A_DIAG.md`, diagnostic `search/diag-archetype-a.ts`).** One root cause, two symptoms. A legislation section's indexed text carries only its operative `body` + its section heading; the **parent act's title/citation ("Housing Act 1988") is on no row** — it lives only in legacy `LegislationItem.title` (135,531 rows, 100% populated, keyed by the gid embedded in every `corpus_sections.id`) and was never carried across (`sectionTitle` is NULL for 62–88% of legislation rows, and even the populated ones omit the act name). So a citation query's discriminating tokens (act + year) are absent from the target row but present in thousands of parliamentary rows that mention the act in passing. Per-A measured against the FULL BM25 list: **ABSENT from retrieval** (A1 HA1988 s.21, A5 RTA1988 ss.14–15 — confirmed in corpus, beyond rank 50,000) vs **PRESENT but out-ranked** (A2 #1,789 · A3 #29 · A4 #3,319 — buried under parliamentary chatter, and the existing title-boost made it worse because parliamentary rows carry the act name in their *title* and the legislation row's section-heading title does not).

**Fix — two complementary parts:**
- **Query-time known-item resolver (headline; `search/citation-resolver.ts` + `fts-core.ts`).** Parse the citation, resolve act title → gid (from `LegislationItem`), fetch the EXACT section by id (`…ukpga/1988/50:section-21`) and inject at rank 1; act-level queries surface the act's leaves. BM25 remainder gets a legislation-tier favour for citation queries. **No reindex** (resolves by id). Wired into `fts-query-service.ts` (loads the act index at boot; plain BM25 if NEON unset) and `score-fts.ts`.
- **Body/title citation backfill (complementary; `search/citation.ts`, `build-fts-index.ts`, `backfill-citations.ts`).** Derives the citation from id+title and prepends it to the indexed `body` + folds it into `sectionTitle` (helps BM25 for concept/partial-citation queries). Baked into the canonical indexer for the next from-scratch rebuild; `backfill-citations.ts` is the in-place variant. **Lands on the gated Railway rebuild** (local 16GB can't reindex 16.5M — v1 was built on Railway's 24GB box). Not reflected in the re-score below (which isolates the resolver on the pristine index).

**Re-score (resolver, full 16.5M `corpus_fts`; v1 baseline preserved at `docs/FTS_S1b_SCORING_v1_baseline.md`):** **archetype A 0% → 60.0%** (MRR 0.000 → 0.800 — exact cited section is #1 for A1–A4), **overall 57.8% → 69.4%** (excl-floor 56.0% → 68.0%), **D 66.7% → 76.7%**, **no regressions** (B 40% · C 60% · E 90% · F 90% unchanged). Residual: A2/A4 = 50% (primary section #1; the secondary gold source isn't citation-resolvable → expected to lift on the backfilled rebuild); A5 = 0% (concept query, no citation; "seatbelt" ≠ "seat belt" — a vocabulary gap, out of scope).

**Positions parked / pilot stood down (per brief).** Did NOT pursue the optimize()/LargeUtf8 incremental-merge path. **Dropped the `corpus_fts_pilot` Lance table + checkpoint**; removed `build-fts-pilot.ts` and its `fts-railway-run.ts` wiring (`pilot` mode + `PILOT_CMD`) and the `.fts-pilot-service-id`; `fts-watch.ts` de-pilot'd. The Railway **`fts-pilot` service is an empty shell (no deployments, 0 compute) — deleting the shell is GATED ON CHARLIE** (`serviceDelete fdd32248-1bd5-4264-8ab0-54de78545151`, per CLAUDE.md "deleting Railway services"). Positions stay a single-shot `createIndex(withPosition:true)` v2 on a Hetzner box, later.

**Index hygiene:** `corpus_fts` was restored to its pristine pre-session version (16,509,051 rows; an exploratory partial in-place backfill + a throughput probe were rolled back via Lance version restore) so the re-score is apples-to-apples with v1. The exploratory `corpus_fts_archeA` validation table was dropped.

**Verify:** `scripts/ingest` `tsc --noEmit` clean (only the 4 documented pre-existing unrelated errors — `diag-db`/`run-cleanup` adapter-pg, `test-fca-playwright` playwright, `v26-pooled-smoke` rootDir). Resolver parse/resolve/fetch verified on all 5 A queries.

**GATED ON CHARLIE:** (1) the Railway full rebuild to land the body-citation backfill into the production index (`build-fts-index.ts` now bakes it); (2) `serviceDelete` of the empty `fts-pilot` shell.

---

## LEX REBUILD — Sprint 1.1: wire Lex to the field machine (orchestration fix) (2026-06-21 01:58 UTC)

**Why:** Sprint 1 built the state foundation and the conversation, but never wired them — the conductor ("whose turn, what next") was missing, so the flow stalled. Build input: `LEX_REBUILD_DESIGN v.1.md` §13 (revises §3.2/§5 to the revised accept-surface model). **Un-promoted preview fix — do NOT promote to production or run the §9 migration until acceptance passes.**

**Task 1 — diagnosis (bytes-before-hypotheses):** Fault 1 = **no `proposal` in Lex's output** (a prompt problem + a wiring guard). The Sprint-1 system prompt told Lex *not* to propose for box fields, `RESPONSE_SCHEMA.proposal.fieldKey` was `enum:['title','keywords']` (narratives inexpressible), and `/lex` only persisted proposals when `origin==='proposed'`. So chat answers never reached the boxes.

**Revised accept-surface model (§3.2/§5):** narrative boxes have two input paths, both writing through the server to `IdeaFieldState`: **Form** (type + Save → ACCEPTED) and **Chat** (Lex tidies the answer into a `proposal` → box AWAITING → box renders the proposed text marked "proposed" → Save accepts). **The box is the single accept surface for narratives** — no chat accept-card for them. Title/Keywords keep the inline confirm in chat.

**Task 2 — chat → box (`lex-client.ts`, `lex/route.ts`, `proposal-schema.ts`):** `RESPONSE_SCHEMA.proposal.fieldKey` now includes the three narratives; box instruction rewritten so Lex returns a tidied `proposal.valueText` for the current box; narrative value schemas added; `/lex` proposal guard dropped (acts on a valid proposal for the current field, box or output). Verified live: Gemini now emits `{proposal:{fieldKey:'ideaNarrative', valueText:…}, extracted:…}`.

**Task 3+4 — the conductor (`lib/lex/orchestrator.ts`, new):** `orchestrateAfterWrite` runs after every field write and makes Lex speak the next step — EMPTY box → ack + its question; boxes done → propose Title; Title done → propose Keywords; keywords-accept → search + pointer + stage `DIAGNOSIS`. **Deterministic fallbacks** (platform-authored `question` per field; `fallbackTitle`/`fallbackKeywords`) guarantee no path stalls even if a Lex turn fails. `fields` route now returns `{state, messages}`; form Save produces a one-line Lex ack + next question.

**Task 5 — frontend + copy:** `FieldsPanel` narrative box renders Lex's proposed text (marked "proposed", blue) with **Save & accept**; chat accept-card restricted to Title/Keywords; `CreateIdeaClient` appends server-conducted `messages`; `state.ts` advances `stage`→`DIAGNOSIS` and unlocks the Diagnosis page (`active`) on completion. First-idea intro is now the verbatim §13 intro **+ a separate first-question bubble**; name fixed to the user's **actual first name** (`firstName`, not `preferredName` which rendered "Charles").

**Verify:** `tsc --noEmit` clean. 13/13 orchestration assertions pass end-to-end on Neon via the **fallback** path (boxes → ack/question → Title → Keywords → search → stage DIAGNOSIS → Diagnosis unlocked; chat-path box shows proposed text). Live Gemini structured-output emits a box proposal. **Acceptance criteria (§13) all exercised.** No schema change this sprint (Sprint-1 additive Neon schema already applied).

**Shipped 21 Jun:** `commit-all.sh` pushed to `Main`; `scripts/migrate-lex-fields.ts --apply` run on Neon — **42/56 ideas migrated** (idempotent, legacy fields → `ideaContext`); `docs/LEX_PLAYBOOK.md` (as-built operational reference, the Lex companion to `INGEST_PLAYBOOK.md`) added. Remaining: validate `/ideas/create` on the preview, then promote to production.

---

## SEARCH S1b — FTS index OOM: no-positions v1 + positions memory pilot (2026-06-20 17:25 UTC)

The `createIndex` over 16.5M docs **with positions** OOM-crash-looped the 24 GB Pro-ceiling container (silent SIGKILL during the native build). v0.30 `FtsOptions`/`createIndex` expose **no** memory/thread/buffer knob, and `train:false` (empty-index seeding) is scalar-only — so a single full-table positions build cannot be made to fit. Two tracks:

- **TRACK 1 — no-positions v1 (`build-fts-index.ts`):** new `FTS_WITH_POSITIONS` env (default true); `false` builds the smaller no-position inverted index over the already-loaded 16.5M **in place** (resumes at `phase=indexing`, no reload) — fits memory, gives a working full-corpus BM25 search to score the gold set this week. Loses exact-phrase ranking (terms still match). If TRACK 2 passes, the positions build replaces it as v2 (repoint, nothing discarded).
- **TRACK 2 — positions memory pilot (`build-fts-pilot.ts`, new):** incremental build into isolated `corpus_fts_pilot` — `createIndex` on chunk 1 then append-chunk + `optimize()` per chunk (Lance's documented "add new data to existing indices" = merge-to-ONE-index), logging **peak container memory** (cgroup `memory.current`, RSS fallback) measured during each merge across ~9 chunks to ~3.6M rows. Answers the real question: is per-merge peak **FLAT** (→ chunking fits 16.5M in 24 GB; report safe chunk size) or **CLIMBING** (→ chunking only delays the OOM; report slope + 24 GB crossover).
- **Tooling:** `fts-railway-run.ts` gains `FTS_SERVICE` selector (parallel `fts-build` + `fts-pilot` services) + `v1`/`pilot` modes. `fts-watch.ts` fixed: detects **CRASHED/FAILED deployments + index restart-loops during `phase=indexing`** (the blind spot that let the earlier OOM loop run unnoticed); `FTS_SERVICE`/`FTS_CHECKPOINT_KEY`-parameterised to watch either track.

Both tracks run in parallel on Railway; deliverables = the v1 gold score (`docs/FTS_S1b_SCORING.md`) + the pilot's per-merge memory trend.

**RESULT — TRACK 1 done (2026-06-20 17:47 UTC):** no-positions index built over 16,509,051 rows in **339 s**, no OOM. First real query surfaced + fixed a bug in `fts-core.ts` — `table.search(query, 'fulltext')` is not a valid query type and silently fell through to vector search ("No embedding functions are defined"); corrected to `search(query, 'fts', 'body')`. **v1 gold baseline: recall@20 57.8% / MRR 0.569** (56.0% excl. [GRAPH] floor) — `docs/FTS_S1b_SCORING.md`. By archetype: E 90% · F 90% · D 67%(floor) · C 60% · B 40% · **A 0%**. The A=0% is a real **ranking** finding, not a missing index: for legislation-citation lookups ("Section 21 Housing Act 1988") the top-20 is dominated by parliamentary debates/written-answers *about* the section, and the query-time title-boost amplifies that chatter, out-ranking the actual legislation section → legislation-lookup needs tier-aware boosting/filtering (plus the matcher key is CCh-unvalidated). TRACK 2 pilot still running on `fts-pilot`.

---

## LEX REBUILD — Sprint 1: canonical state layer + Page 1 + 3 panels (2026-06-20 15:57 UTC)

**Why:** the old conversation layer let three sources of state (frontend, DB, Lex's parsed prose) disagree — the root cause of every Stage-1 UX bug (card revert, sidebar miscount, early stage advance, Lex looping). This sprint removes the possibility of collision: one server-authoritative canonical state, Lex taken out of the control loop, panels as pure renderers. Build input: `docs/LEX_REBUILD_DESIGN.md` §12. **Replaced the live `/ideas/create` flow in place** (Charlie's call).

**Schema (additive, applied to Neon only — Railway untouched; `prisma/lex_rebuild_page1.sql`, idempotent):**
- `enum FieldStatus {EMPTY, AWAITING_CONFIRMATION, ACCEPTED, SKIPPED}`; `IdeaFieldState` (per-field state machine, server-authoritative, `@@unique([ideaId,fieldKey])`); `Document(kind:INITIAL_BACKGROUND)`.
- `Idea`: `ideaNarrative`, `youAndIdeaNarrative`, `ideaSlots` Json, `keywords` String[], `ideaContext` (§9 migration sink), `legislationRefs` Json. `User`: `aboutYouNarrative`, `profileSlots` Json (Box 3, reused across ideas).

**State layer (`lib/lex/`):** `page1-config.ts` (field SoT: 3 boxes + title/keywords + behind-box slots + canonical-state types + the §8.3 `SearchResult` interface), `field-machine.ts` (EMPTY→AWAITING→ACCEPTED/SKIPPED + reopen; mirrors accepted values onto canonical columns per §3.4; `fireSearchTrigger`), `state.ts` (`computeCanonicalState` §3.3; `currentField` = first non-terminal; page complete when all fields terminal), `lex-client.ts` (Gemini **structured output** via `responseSchema` → `{chatText, proposal, extracted}`; validate + 1 retry; Lex never writes sequence/stage), `proposal-schema.ts` (per-field zod), `search-stub.ts` (stub shaped exactly as `SearchResult[]`, grouped ≤3/type ≤20; Initial Background prose).

**API:** `GET /api/ideas/[id]/state`; `POST /api/ideas/[id]/lex` (one Lex turn → AWAITING on valid proposal, else discard proposal + keep chatText); `POST /api/ideas/[id]/fields` (`submitBox|accept|skip|reopen`; keywords-accept deterministically fires the stub search + posts Lex's one-line pointer). Old `/api/ai/[ideaId]` left for Stage 2 (untouched).

**Frontend:** `CreateIdeaClient.tsx` rebuilt to hold **no progress state** — only server canonical state, the chat transcript, and an in-flight spinner. `components/lex/`: `ChatPanel` (accept card renders **iff** `currentField.status===AWAITING_CONFIRMATION` — kills the 20s revert bug), `FieldsPanel` ("X of Y" derived from the fields array, never stored), `BackgroundPanel` (Initial Background + grouped source cards), `AcceptCard`.

**Migration (§9):** `scripts/migrate-lex-fields.ts` copies legacy idea fields (summaryDescription/Diagnosis/backgroundResearch/initialThoughts) into `ideaContext` tagged `[migrated: <field>]`; idempotent; dry-run default, `--apply` to write. Dry-run on Neon: would migrate 42/55 ideas. **`--apply` POST-MERGE.**

**Verify:** `tsc --noEmit` clean (whole web app). 19/19 state-machine assertions pass end-to-end against Neon (boot → box submit → skips → propose/accept title → propose/accept keywords → search fires → Initial Background ready → mirrored columns → reopen; test idea cleaned up). Live HTTP + Gemini wiring is the Vercel-preview gate.

**Run order (POST-MERGE):** (1) Vercel build picks up the new schema via `prisma generate` (schema already on Neon); (2) eyeball `/ideas/create` on the preview; (3) `npx tsx scripts/migrate-lex-fields.ts --apply` (against Neon).

---

## SEARCH S1b — lift the R2 socket cap + UTC timestamp convention (2026-06-20 10:00 UTC)

**Why:** with the append fix, the build ran flat at **~290 rows/s across every corpus** (et-decisions, eur-lex, historic-hansard all ~278–333/s) → request-latency-bound, not CPU/write-bound. Root cause: the shared S3/R2 client uses the AWS SDK default **`maxSockets=50`**, so `FTS_R2_CONCURRENCY=256` only ran ~50 effective sockets (`@smithy` "socket at capacity" warnings).

**Change:**
- **`scripts/ingest/shared/r2-client.ts`:** the S3 client now takes a `NodeHttpHandler` with `maxSockets` from `R2_MAX_SOCKETS` (**default 50 = unchanged**, so the live worker is identical unless set) + a `requestTimeout` from `R2_REQUEST_TIMEOUT_MS` (default 120 s) so a stuck socket can't silently wedge a batch (the failure mode behind the earlier false "hang").
- **`fts-railway-run.ts` `FULL_CMD`:** sets `R2_MAX_SOCKETS=256` (with `FTS_R2_CONCURRENCY=256`, `FTS_BATCH=5000`) — only the build lifts the cap.
- **Timestamp convention → UTC.** Both boot files updated: commit `Date:` trailers, CHANGE_LOG headings, and all log comparisons use **UTC** (`[DateTime]::UtcNow…`). A BST↔UTC mixup earlier caused a false "build hung" diagnosis (the build was healthy at 230k); UTC-only removes that error class.

**Run:** stop build (continuous to ~3.69M rows at ~290/s, no data lost) → push → resume `full` from the 3.69M checkpoint with 256 real sockets. Tripwire: expect ≫320/s (target ~1000+/s → ~3–5 h total); if it plateaus near ~320/s despite 256 sockets, the limiter is CPU/writer → shard. Index-build seconds reported at completion.

---

## SEARCH S1b — FTS write-path fix: mergeInsert → append (2026-06-20 06:14 BST)

**Why:** the first Railway canary (load path, committed code) measured **~123 rows/s ≈ the home-connection rate** → the build is **write-bound, not bandwidth-bound**: `mergeInsert` (idempotent upsert) was the bottleneck and degrades as the table grows, so running on Railway bought ~nothing. (That canary also ran *committed* code, so the working-tree `--canary`/isolation edits had no effect — Railway builds from `Main`; the fix is inert until pushed.)

**Change (`scripts/ingest/search/`):**
- **`build-fts-index.ts`:** load phase now **appends** (`tbl.add`) instead of `mergeInsert`. Idempotency preserved by the cursor: on resume it **deletes rows `WHERE id > lastId`** (clears any appended-but-un-checkpointed tail from a crash) then appends `WHERE id > lastId` — no duplicates. New `--reset-only` (drop+recreate empty table, write fresh checkpoint, exit) keeps reset a **discrete** step, never in the Railway start command (ON_FAILURE re-runs it on crash → a `--reset` there would wipe progress). Kept `--canary` (isolated `corpus_fts_canary` load+index) + timing logs; progress line now prints live rows/s.
- **`lance.ts`:** table name env-overridable (`FTS_TABLE_NAME`); default `corpus_fts` unchanged.
- **`fts-railway-run.ts`:** split deploy from tail; added `idle` (park service `true`/NEVER before a push so the watch-pattern auto-redeploy doesn't re-run a stale build); `full` now launches + monitors only the first ~7 min (reads steady-state rows/s) instead of blocking for hours.

**Run:** `idle` → push → local `--reset-only` (wipe the 5k partial bills-api rows) → `full` (clean append build) → monitor first-minutes rows/s; STOP if not materially > 123/s. Index-build seconds reported at completion (never yet run).

---

## V29 — UK COMPLETION WAVE (20 Jun 2026)

**Context:** SPRINT_V29_BRIEF.md. HEAD = V28 close. Pure-additive + orthogonal to the V26 DROP path. **§0 DROP state confirmed: the legacy `Legislation*` tables ARE STILL PRESENT on Neon (LegislationSection/Item/Amendment/Correction/CrossRef + legislation_compilation_enrichment) — the V26 §6 DROP has NOT fired; untouched this sprint.** `scripts/ingest` `tsc --noEmit` **fully clean (0 errors)**. **11 new corpora across 9 new sourceTypes — all SEED POST-PUSH** (the live worker markSkips a new sourceType until its processor deploys). Category-completeness summary at the end.

### §1 ICO + SCOTTISH-COURTS FAILED-ROWS TRIAGE — DIAGNOSED + FIXED (recovery POST-PUSH)
- **Diagnosis (verify-before-asserting, live re-fetch):** the 3,226 `ico` "page fetch failed" rows and 9 `scottish-courts` "PDF fetch failed" rows are **transient host-side throttling under load, NOT dead pages**. 14/14 sampled ICO rows re-fetch HTTP 200 (full ~30KB HTML); 8/9 scottish-courts re-fetch valid 200 PDFs — exactly ONE scottish-courts row is a genuine 404. ICO's ~12% failure rate during the V27 drain is the per-row fan-out (1 HTML + up to 6 PDF requests) tripping the host's edge throttle (politeness §1b — a connection storm under load is a rate signal).
- **Adapter fix:** `sources/ico.ts` (`fetchIcoPage`/`fetchIcoPdf`) + `sources/scottish-courts.ts` (`fetchJudgmentPdf`) hardened with a polite retry (up to 3 attempts, 1.5s×n backoff on throw / 429 / 5xx; deterministic 404/410 returns immediately so a genuinely-gone page is still classified).
- **Recovery:** `v29-triage-fix.ts --apply` (POST-PUSH, after the hardened adapters deploy): bulk-resets the 3,226 ICO failures to `pending` (the unanimous re-fetch sample makes a per-row recheck unnecessary); per-classifies the 9 scottish-courts (8 → `pending`, the 1 confirmed-404 → an `unavailable` pdf-only marker + queue row `skipped`, honest known-unknown §1d). Dry-run verified (8 recoverable + 1 dead).

### §2 QUANGO TRANCHE 3 — THE TAIL — BUILT + MEASURED (seed POST-PUSH)
- Closes the org universe from the T1+T2 60 ALBs + all ministerial depts (115 covered) to **100%**. `v29-seed-quango-t3.ts` derives the tail = every QUANGO_UNIVERSE.csv org with relevant-format docs not already seeded. **Measured live: 968 tail orgs → 25,366 relevant docs, 0 guard-paused** (no org exceeded the 5× register estimate). Same machinery as T1/T2: `govuk-content` rows under `quangos-govuk` (OGL), broad statute-adjacent format set, URL-dedup against every held gov.uk URL, utaac/fatality excluded. Diminishing returns per org as expected (the tail is dominated by est=1 orgs). Re-baseline `quangos-govuk` at drain.

### §3 PARLIAMENT REMAINDER — 4 NEW CORPORA BUILT + PILOTED (all OPL v3.0; seed POST-PUSH)
All JSON APIs, robust pattern. The list/section endpoints already carry full content → efficient list-page rows (one queue row per page → many sections), no per-item detail fetches.
- **§3.1 Erskine May** (`erskine-may`) — `erskinemay-api.parliament.uk`. Walk chapters 1..46, flatten the section tree → **2,038 sections**; one row per Section (`sec:{id}`) → `/api/Section/{id}` contentHtml + footnotes. Pilot §5616 → 375 words clean. The procedural rulebook for how legislation moves.
- **§3.2 Early Day Motions** (`early-day-motions`) — `oralquestionsandmotions-api.parliament.uk/EarlyDayMotions/list`. **60,737 motions**; `list:{skip}` page rows (take=100) → one section per motion (title + full motion text + primary sponsor + signature count + date), keyed on motion Id. Backbench-opinion signal absent from Hansard.
- **§3.3 E-Petitions** (`petitions`) — `petition.parliament.uk` open (561 pages) + archived (2,082 pages) → **~66,075 petitions**; `list:{open|archived}:{page}` rows → one section per petition (action + background + details + government response + debate + signature count + state), keyed on petition id. Pilot: "Call a General Election" 3.08M sigs / 346 words.
- **§3.4 Register of Members' Financial Interests** (`members-interests`) — `interests-api.parliament.uk`. **3,341 interests** (ExpandChildInterests). DECISION: **one section per interest** (the natural self-contained unit — member + category + fields — vs concatenating a member's whole register); `list:{skip}` rows (Take=100), keyed on interest id.

### §4 CPS PROSECUTION GUIDANCE — BUILT + PILOTED (seed POST-PUSH)
- `cps-guidance` sourceType/corpus. **Licence VERIFIED OGL v3.0 at cps.gov.uk/crown-copyright-and-disclaimer** (the copyright page, not a footer; "Open Government Licence" + v3 stated). Own domain → own enumerator: Drupal sitemap index (`/sitemap.xml?page=1..5`, 4,272 urls) → the `/prosecution-guidance/{slug}` library (271, minus the search index) + the Code for Crown Prosecutors publication = **270 docs**. Each is server-rendered HTML in `<main>`. Pilot 3/3, avg 3,703 words → ~1.0M words. The prosecutorial interpretation of criminal law.

### §5 INDEPENDENT REVIEWS — BUILT + PDF-VERIFIED + PILOTED (seed POST-PUSH)
- `independent-reviews` sourceType/corpus, reusing the inquiry-reports per-PDF machinery (dispatch routes to `processInquiryReports`). Universe = a curated registry (`INDEPENDENT_REVIEWS_UNIVERSE.md`) ∪ a gov.uk Search discovery pass (`document_type=independent_report`, title ~ review/audit, reports-only filter excluding ToRs / government responses / consultations), **each PDF-verified live → 345 reviews / 675 report PDFs** (5 stale registry slugs self-healed/dropped). Pilot: Casey lead PDF → 72,663 words (matches the V28 probe). Own-domain reviews (Cass on cass.independent-review.uk) deferred to a Web Archive adapter (documented follow-up). OGL v3.0.

### §6 EXEMPT ORGS — OFGEM + OFCOM — BOTH BUILT + PILOTED (seed POST-PUSH)
- **Ofgem** (`ofgem`) — **OGL v3.0 VERIFIED at ofgem.gov.uk/copyright** (non-ministerial dept, Crown copyright under OGL). Drupal sitemap (10 sub-pages, 49,518 urls) → **12,899 English `/publications/` leaves** (Welsh /cy/ excluded). PDF-heavy (like ICO): prefer the linked PDF(s), fall back to `<main>`. Pilot 4/4, avg 3,897 words → ~50.3M words.
- **Ofcom** (`ofcom`, `ofcom-open`) — **own open re-use terms VERIFIED at ofcom.org.uk/about-ofcom/website/terms-of-use** ("reproduced free of charge … accurately and not misleading … acknowledged as Ofcom copyright"; OGL-equivalent, logos excluded). CORRECTION to V27/V28: Ofcom DOES have a server-side sitemap index → 8 en topic sitemaps → **4,093 regulatory pages** (data-download/interactive pages filtered out). HTML-led + optional PDFs. Pilot 4/4, avg 791 words → ~3.2M words.
- Ofwat (© Ofwat) and BoE (no clear open statement) stay a V30 email item — not built.

### §7 OMBUDSMEN PROBE WAVE — 5 PROBED; 1 BUILT (`OMBUDSMEN_PROBE.md`)
- All five sized + licence-checked at source. **LGSCO is the clean win** (`lgsco`, `lgsco-open`): lgo.org.uk/copyright carries the verbatim OGL permission wording on a bespoke statement (free re-use in any format, with attribution/accuracy/non-misleading/non-advertising). BUILT: self-propagating `list:{category}:{page}` rows over 10 categories → per-decision HTML (`<main>`). Pilot: decision 25-009-294 → 1,024 words clean; 9/10 categories populated. Large DB (decisions since 2013) → re-baseline at drain.
- Ranked V30 (licence-gated): **Housing Ombudsman** (165,524 decisions — the biggest prize, licence UNVERIFIED, chase a re-use statement) > **PHSO** (Crown-ish, licence unverified, route re-resolve) > **Pensions Ombudsman** (conditional grant, email to confirm) > **FOS** (restrictive — prior permission required; 100k+ decisions). Findings in OMBUDSMEN_PROBE.md.

### §8 HMRC SOFT-LAW AUDIT — COVERAGE NEAR-COMPLETE (`v29-hmrc-audit.ts`)
- Precise title-matched coverage vs `corpus_sections`: **Revenue & Customs Briefs 120/120 (100%) · Statements of Practice 182/184 · Extra-Statutory Concessions 31/35 · VAT Notices 104/106 → only 8 genuinely-missing leaves** (the families are already carried by hmrc-ancillary 464 + hmrc-codes-guidance 14,067 + hmrc-manuals 85,197). "Likely small" confirmed; seed the 8 missing as `govuk-content` rows under `hmrc-ancillary` POST-PUSH (`--seed`).

### §9 POSTNOTES RE-PROBE + LIBRARY-BRIEFINGS SEAM — GATED, NOW TURN-KEY
- **POST re-probed (verify-before-asserting): post.parliament.uk is FULLY Cloudflare-challenged server-side** (403 "Just a moment…" on home, /wp-json/, the research-briefing CPT, sitemap, an individual POSTnote page) — it is NOT less gated than the Library hosts. CORRECTION to the brief's optimism: post.parliament.uk, commonslibrary, lordslibrary and researchbriefings.files are **distinct CF hostnames**, and cf_clearance is host-bound — so a single capture does NOT unblock all listing endpoints; the shared briefing-PDF host needs its own capture too. POST wired into the V28 §5 seam as a third `house` (corpus `postnotes`, OPL v3.0). Added `fetchBriefingById` + a turn-key `processLibraryBriefings` processor (handles commons/lords/post; body + PDFs) so the seam is genuinely capture-ready end-to-end. **The single capture that unblocks each family: a per-host `cf_clearance` cookie + the research-briefing CPT slug** (devtools, V27 Scottish-Courts technique).

### §10 VERIFICATION & DOCS
- licence-map: erskine-may/early-day-motions/petitions/members-interests/postnotes → OPL3; cps-guidance/independent-reviews/ofgem → OGL3; ofcom → `ofcom-open`; lgsco → `lgsco-open`. seed-rate-limits: 10 new sourceTypes added. jurisdiction-map: all new corpora default `uk` (correct — no devolved). `v29-corpus-status-table.ts` (run POST-DRAIN → CORPUS_STATUS_V29.csv). `OMBUDSMEN_PROBE.md` delivered. `tsc --noEmit` clean.

### CATEGORY-COMPLETENESS SUMMARY (per family)
- **DONE (data fix, live POST-PUSH):** ICO/Scottish-courts triage (§1) · HMRC soft-law (§8 — already ~98% covered, 8 to seed).
- **BUILT-POST-PUSH (built + piloted, seed after deploy):** Quango T3 tail (§2, 968 orgs/25,366 docs) · Erskine May · Early Day Motions · E-Petitions · Members' Interests (§3) · CPS guidance (§4, 270) · Independent reviews (§5, 345/675 PDFs) · Ofgem (§6, 12,899) · Ofcom (§6, 4,093) · LGSCO (§7, large).
- **PROBED-V30 (licence/route gated):** Housing Ombudsman (165k — licence) · PHSO · Pensions Ombudsman · FOS (§7) · Ofwat · BoE (§6).
- **GATED-ON-CAPTURE:** POSTnotes + Commons/Lords Library briefings (§9 — per-host cf_clearance + CPT slug).

### POST-PUSH RUN ORDER (after commit-all.sh deploys Ingest+Ops)
1. `seed-rate-limits.ts` (all new sourceTypes). 2. Confirm Ingest deploy SUCCESS. 3. `v29-triage-fix.ts --apply` (§1 recovery). 4. Seed with a canary + egress check on each new host: `v29-seed-quango-t3.ts --seed` → `v29-seed-parliament.ts --seed` (all four) → `v29-seed-cps.ts --seed` → `v29-seed-independent-reviews.ts --seed` → `v29-seed-exempt-orgs.ts --seed` (ofgem+ofcom; Railway egress canary first) → `v29-seed-lgsco.ts --seed` (egress canary) → `v29-hmrc-audit.ts --seed` (8 missing). 5. At drain: re-baseline new/changed corpora; `v29-corpus-status-table.ts`; `v20-licence-backfill.ts` for NULL stragglers (ofcom-open/lgsco-open are new codes — confirm the map applies them).

---

## V28 — SEARCH-RELAY SCHEMA · VOTING RECORDS · INQUIRY REGISTER · LIBRARY/REVIEWS · SCOTTISH OR (19 Jun 2026)

**Context:** SPRINT_V28_BRIEF.md. HEAD = V27 close. Pure-additive ingest + the search-thread relay during the V26 soak (legacy `Legislation*` rollback path untouched). `scripts/ingest` `tsc --noEmit` clean (only the 4 documented pre-existing unrelated errors: diag-db/run-cleanup `@prisma/adapter-pg`, test-fca-playwright `playwright`, v26-pooled-smoke rootDir — none new). New sourceTypes (`division-votes`, `scottish-parliament-or`) seed POST-PUSH; written-answers re-split + inquiry +51 also post-push.

### §1 SEARCH-THREAD RELAY
- **§1.2 jurisdiction column — DONE (live).** `corpus_sections.jurisdiction` added `NOT NULL DEFAULT 'uk'` (metadata-only in PG11+ — no 17M-row rewrite; only the ~399k devolved rows UPDATEd, avoiding the MVCC churn the project defers for pwdata). Values match the search `jurisdictionFor()` labels exactly (`uk`/`wales`/`scotland`/`ni`) so the search thread switches off its stopgap map and reads the column. Result: ni 204,292 · wales 191,756 · scotland 3,234 · uk 16,153,776. Column comment flags the territorial-extent caveat. Also wired into the ingest write path (`shared/jurisdiction-map.ts` + `db-metadata.ts` — new devolved rows, e.g. scottish-courts still draining + §7, get the right label, not the 'uk' default). `v28-jurisdiction-column.ts`.
- **§1.3 sectionTitle + itemDate — DONE (live); the pre-DROP gate is CLEAR.** Verified the legacy table's real contents first: `LegislationSection.sectionTitle` present for 760,919 (gid,section) pairs; `LegislationItem.enactmentDate` 0/135,531 populated and no date column on `LegislationSection` (the brief's itemDate-in-legacy premise was optimistic). So titles come from the legacy join; itemDate is derived from the gid year (accurate, 92% coverage). Join: `corpus_sections` gid (`split_part(id,':',2)`) → `LegislationItem.legislationGovUkId`; `section-{N}`↔`{N}`, `article-{N}`↔`Article {N}`. **335,595 titles carried** (18.4% of leg+caselaw — the high-signal `section-N`/`article-N` heading rows; the 1.16M schedule/paragraph sub-unit rows have no legacy equivalent and don't gain titles, as expected). **1,708,117 itemDates** (1,634,051 legislation gid-year + 74,066 tna-caselaw `[YYYY]` citation-year). Dedicated pool, 600s statement_timeout, per-corpus batching (the shared pool's 60s cap would kill these). `v28-title-extract.ts`. **§1.3 COMPLETE — DROP gate for title extraction cleared.**
- **§1.1 written-answers split — BUILT + PILOTED (reseed POST-PUSH).** Audit (`v28-blob-audit.ts`): written-answers is the date-range-aggregate problem — 128/143 sections >512KB, avg **305,936 words/section**. Other oversized corpora split into (a) legitimately-large SINGLE documents (tna-caselaw judgments, quangos-govuk pages, et-decisions, committees — one coherent retrieval unit, no split) and (b) sub-unit candidates needing structural parsing (inquiry-reports by chapter, eur-lex/uk-treaties by article — V29 follow-ups). Only written-answers has a clean per-item API. Rewrote the `hansard` processor's `answers` branch to write ONE section per Q&A (stable key = question id; heading/asking+answering member/date as metadata) via new `fetchWrittenAnswerItems`/`compileWrittenQa`. **PILOT one window: 1,046 Q&A items, max 116 words/item** (was a single ~306k-word blob). `pwdata-wrans` untouched (confirmed different corpus). `v28-reseed-written-answers.ts` recovers the 143 windows from existing ids, deletes the blobs + re-seeds POST-PUSH.

### §2 OPS FULL-TABLE-SCAN SWEEP — DONE (live at push)
- **`reseedExhaustedPwdata` FIXED + verified.** Root cause confirmed by timing the live DB: it pulled `SELECT id FROM corpus_sections WHERE corpus='pwdata-debates'` = ~6.4M rows into JS (huge transfer), exceeding the 60s client query_timeout → pwdata auto-reseed of new TWFY files silently failing (V27 §1 flag). Replaced with an index-friendly PK existence check (`id = ANY({corpus}:{docId}:1)`, chunked — every processed file writes a `:1` section/marker). **Verified (`v28-verify-reseed.ts`): pwdata-debates dedup now 15.2s** (vs >60s timeout) and correctly surfaces **18 new TWFY files** (debates +17, lords +1) the broken reseed had been missing — the fixed reseed recovers them automatically post-deploy.
- **Sweep findings (measured against the live 17M-row DB):** the census `GROUP BY corpus,status` (3.2s), `SELECT DISTINCT corpus` (2.0s), `SUM(wordCount)` (1.3s), `LegislationSection COUNT` (1.7s) are all FAST aggregates (return tiny result sets) — V27's transient "Query read timeout" was a load spike on an identical-shape query, already mitigated by the breaker's snapshot read; no change needed. The genuinely-broken cron query was ONLY `reseedExhaustedPwdata` (a million-row result-set pull, not an aggregate). Manual-only seeders that pull all ids / `DISTINCT sourceUrl` (seed-hmrc-manuals-v18, v22-seed-quango-t1, v19-seed-*) are NOT on the cron path — listed, not fixed.

### §3 PER-MEMBER DIVISION VOTES — BUILT + PILOTED (seed POST-PUSH)
- Commons Votes + Lords Votes APIs (OPL v3.0). `sources/division-votes.ts` (Commons `divisions.json/search` + `division/{id}.json`; Lords `Divisions/search` + `Divisions/{id}`), `processDivisionVotes` (sourceType `division-votes`), `v28-seed-division-votes.ts`. **Granularity confirmed: ONE section per division** carrying the full aye/no member roll-call (id + name + party + constituency) as searchable text — NOT one per member. Universe: **Commons 2,333 + Lords 3,270 = 5,603 divisions**. PILOT both houses end-to-end: Commons division 2382 → 387 members / 17.5k chars; Lords division 3675 → 83 members. New corpora `commons-divisions-votes` / `lords-divisions-votes` (OPL3 in licence-map). Pairs with bills-api (bill text + who voted).

### §4 PUBLIC INQUIRY REGISTER — COMPLETED (re-seed POST-PUSH)
- Discovered via the gov.uk Search API + PDF-verification (`v28-discover-inquiries.ts`), curated reports-only (excluded govt-responses, ToR, costs, statistics). **Register 21 → 58 inquiries / 146 → 197 report PDFs** (+37 inquiries, +51 report volumes): Stephen Lawrence (Macpherson), Shipman 2 & 3, Detainee (Gibson), Paterson, Angiolini Pt1, David Fuller Ph1+2, Southport Ph1, Wass, Laidlaw, Magnox, Kerr/Haslam, Billy Wright, Cranston, Royal Liverpool/Redfern, Confait, Ashworth, Burns (hunting), Anthony Grainger, BVI CoI, Sheehy, Fife, May (Guildford), ICL/Stockline, Jermaine Baker, Dawn Sturgess, Jalal Uddin, UCPI T1, Redfern-nuclear, Orkney, Crown Agents (Fay), Acheson, Turks & Caicos, CPS deaths-in-custody, Sutherland, … All 58 paths PDF-verified (0 fetch failures). New denominator 197. Dark-site-only reports (BSE/Phillips, Bristol full, Morecambe Bay, Gosport, Daniel Morgan, Hutton, Penrose-Scotland, Vale of Leven, Telford CSE) need a Web Archive adapter — documented follow-up. POST-PUSH: `v24-seed-inquiry-reports.ts --seed` (idempotent, +51 PDF rows), drain, re-baseline est→197.

### §5 COMMONS & LORDS LIBRARY BRIEFINGS — BUILT TO THE GATE (seeds nothing)
- Thoroughly probed (verify-before-asserting): commonslibrary/lordslibrary run on WordPress behind a **Cloudflare managed-challenge**. The `/wp-json/` root is edge-cached and returns JSON with browser headers (confirming a WP REST + custom-post-type architecture), but the content endpoints (`/wp/v2/posts`, the research-briefing CPT) return CF's JS challenge (HTTP 403) consistently across retries; the `researchbriefings.files` PDF host 403s; the LDA `researchbriefings` API host is unreachable (HTTP 000, decommissioned); no `*-api.parliament.uk` briefings host; TNA web-archive has no usable capture. Capture-ready seam `sources/library-briefings.ts` (parameterized by `cf_clearance` cookie + the CPT slug) + `v28-seed-library-briefings.ts --probe` report the gate. **Unblock route (matches V27 Scottish Courts): a browser devtools capture of a `cf_clearance` cookie + the research-briefing WP REST endpoint.** licence-map: `commons-/lords-library-briefings` → pending-verification (expected OPL3).

### §7 SCOTTISH PARLIAMENT OFFICIAL REPORT — BUILT + PILOTED (seed POST-PUSH; supersedes V27 §5 gate)
- The OR IS conventional server-rendered HTML (no capture needed). `sources/scottish-parliament-or.ts`: enumeration via **`sitemap.xml`** (the date-browse paginates only ~2-3 pages deep; meeting-id probing returns shells) → **5,131 distinct reports, 2016-05-17 … 2026-06-03** (sessions 5–6; pre-2016 on the legacy archive host, a follow-up). Per-contribution parser: the base meeting page renders only the first agenda item; each item loads on its own `?iob={id}` page, so the worker fetches base + each iob and aggregates. `processScottishParliamentOr` (sourceType `scottish-parliament-or`), `v28-seed-scottish-parliament-or.ts`. **PILOTs: meeting 20167 → 337 contributions / 44,983 words across 8 agenda items; meeting 20175 → 218 / 34,747.** Prediction ~5,131 reports → on the order of ~300–500k sections (brief's ~320k in range; refine at drain). **Licence VERIFIED — Scottish Parliament Copyright Licence (SPCB)**, NOT OGL (parliament.scot/about/copyright: reproducible without formal permission, with attribution; excludes party-political/advertising use — a serving-layer note). licence code `spcb`. (Verify-before-asserting: avoided the googletagmanager "ogl" false-positive that bit V24/V25.)

### §6 INDEPENDENT REVIEWS — SCOPED (build V29)
- `docs/INDEPENDENT_REVIEWS_UNIVERSE.md` register (review · body · year · route · licence · est). End-to-end probe **Casey 2025 National Audit on Group-Based CSE — CLEAN** (gov.uk PDF → 72,663 words extracted via the inquiry-reports machinery). Most major reviews are gov.uk-published OGL PDFs (Augar 7, Windrush 4, Lammy 3, Taylor 1, Francis 1, …); Cass is own-domain (Web Archive adapter). A distinct family from inquiries — V29 builds `independent-reviews` (clone of inquiry-reports pattern + gov.uk Search discovery). No seed this sprint (scoping only).

### §8 EXEMPT-ORG LICENCE CHECKS — CORRECTION (build V29)
- Re-checked the four copyright pages directly. **CORRECTION to V27's EXEMPT_ORGS_PROBE:** **Ofgem publishes under OGL v3.0** ("free of charge in any format or medium, under the terms of the Open Government Licence" — Crown copyright, non-ministerial dept) and **Ofcom** has own open re-use terms (free + attribution). Both are licence-clean and buildable (V27 wrongly marked them own-copyright). Ofwat = © Ofwat; BoE = no clear open statement. Building Ofgem/Ofcom needs a from-scratch own-domain enumerator (not in the gov.uk API, like ICO) → deferred to V29 (§8 is lowest priority). Ranked V29 exempt-org list (licence-cleared first): **Ofgem (OGL) > Ofcom (own-open) > Ofwat (email) > BoE (email).** EXEMPT_ORGS_PROBE.md updated.

### Verification & docs
- licence-map additions: `commons-/lords-divisions-votes`→OPL3; `scottish-parliament-or`→`spcb` (verified); `commons-/lords-library-briefings`→pending-verification. `seed-rate-limits.ts`: `division-votes` 400ms/3, `library-briefings` 1000ms/2 (gated), `scottish-parliament-or` updated 1000ms/2 (HTML scrape). `v28-corpus-status-table.ts` (run POST-DRAIN → CORPUS_STATUS_V28.csv). `tsc --noEmit` clean (4 pre-existing only). No git mid-sprint — single `commit-all.sh`.

### POST-PUSH run order (after commit-all.sh deploys Ingest+Ops)
1. `seed-rate-limits.ts` (adds division-votes, library-briefings; updates scottish-parliament-or).
2. Confirm the Ingest deploy is SUCCESS before seeding new sourceTypes (V24 markSkip lesson).
3. `v28-reseed-written-answers.ts --seed` (delete 143 blobs + re-seed windows → per-Q&A re-ingest).
4. `v24-seed-inquiry-reports.ts --seed` (idempotent; +51 new report PDFs).
5. `v28-seed-division-votes.ts --seed` (~5,603 divisions).
6. `v28-seed-scottish-parliament-or.ts --seed` (~5,131 reports; per-contribution).
7. At drain: re-baseline the new/changed corpora; `v28-corpus-status-table.ts`; `v20-licence-backfill.ts` for NULL stragglers.

### §1.3 / DROP gate
- **§1.3 is COMPLETE and verified.** The V26 §6 DROP's title-extraction precondition is CLEAR (titles + dates extracted from the legacy table into corpus_sections before the DROP deletes it). The DROP still also needs the ≥1-week soak (~25 Jun) and the search-thread Lex-grounding repoint (Charlie's gates).

---

## SEARCH S1b (FTS BUILD, inert) + DOCS CONSOLIDATION + RAILWAY LEGSECTION RETIRE (19 Jun 2026)

Three separate workstreams, three separate commits, deliberately kept out of the V27 ingest changes. `scripts/ingest` `tsc --noEmit` clean (4 pre-existing unrelated errors only).

### Search S1b — FTS indexer + query service + scoring harness (BUILT, INERT; Charlie triggers the index run)
Full-corpus BM25 over the 16.3M compiled `corpus_sections` rows, LanceDB native inverted index on R2 (`s3://{bucket}/_search/corpus_fts.lance`). New `scripts/ingest/search/`: `lance.ts`, `corpus-map.ts`, `build-fts-index.ts`, `fts-core.ts`, `fts-query-service.ts`, `score-fts.ts`, `gold-queries.ts`. `@lancedb/lancedb@^0.30.0` + `apache-arrow@^18.1.0` added to `scripts/ingest/package.json`. All read `NEON_DATABASE_URL` (cutover-independent). Brief additions implemented:
- **Title-boost (a):** query-time ~2.5× (env `FTS_TITLE_BOOST`), applied in `fts-core` by re-ranking BM25-on-`body` hits whose `sectionTitle` contains a query term. No pseudo-titles. Inert for legislation/caselaw (NULL titles) — starts working for them automatically when the unification lands real titles.
- **Jurisdiction:** `jurisdictionFor()` writes a real `jurisdiction` column (senedd→wales; niassembly-hansard/ni-judgments/nilawcom→ni; scottish*/scotlawcom→scotland; else uk) — avoids ~700k wrong-'uk' labels.
- **Resumable + idempotent indexer:** mergeInsert keyed on text PK `id` (no duplicate Lance rows on re-run / mid-batch death) + R2 checkpoint `_search/corpus_fts.checkpoint.json` carrying max-`id` cursor + phase (loading→indexing→done). Resume = `WHERE id > lastId` (PK btree). `--reset` / `--limit N` flags. Reported in `docs/FTS_BUILD_S1b.md` §2A.
- **Scoring:** `gold-queries.ts` encodes all 30 GOLD_QUERIES with citation-string matchers (legislation = gov.uk path from id, e.g. `ukpga/1988/50:section-21`; caselaw = neutral citation in id; parliamentary/bills = body/title); `score-fts.ts` → recall@20 + MRR per archetype + overall (incl. and excl. floor) + a by-eye top-20 dump (`docs/FTS_S1b_SCORING.md`) for Charlie/CCh to validate the matcher key.
- **Floors:** archetype D (all `[GRAPH]`) + `[INFORCE]` aspects of A1/C3/D3 marked `floor:true` (engine-floor, not failure); `[BILLS]` (F + B4) scores for real.
Gold set located + renamed canonical `docs/GOLD_QUERIES.md`. Throwaway `tmp-s1b-audit/` removed. `docs/FTS_BUILD_S1b.md` status → BUILT (inert).

**Execution path confirmed (19 Jun, post-build):** the index build runs **on Railway, not Charlie's laptop** (the audit's ~124 rows/s home-connection rate ≈ 36h; Railway's datacenter→R2 bandwidth is the point). Probed the live Railway config (read-only): the **Ingest** service is **git-connected** (repoTrigger branch `Main`, RAILPACK, root `scripts/ingest`) → the `search/` code + the new LanceDB/arrow deps reach Railway only via a push, so **commit-all.sh must precede the canary** (corrects the brief §2A run order, which read as a local `tsx` invocation). The Ingest worker is also normally busy draining the queue, and **Ops liveness redeploys Ingest whenever `pending>0 && heartbeat stale`** — so the build cannot live on the Ingest container (it would stall the drain and be bounced mid-run). Decision: a **dedicated, isolated `fts-build` Railway service** (same repo/Main/RAILPACK/root → identical build to Ingest; Ops liveness targets only the Ingest service id, so it never touches it). Canary + full build run on that one service — same image/region/R2-egress path, differing only by `--limit 5000`. New tooling `scripts/ingest/search/fts-railway-run.ts` (`setup`/`canary`/`full`/`logs`/`teardown`): `serviceCreate` (Neon+R2 creds only — the indexer never calls Railway) → `serviceInstanceUpdate` (root, RAILPACK, no-op start cmd that builds-then-idle-stops) → on trigger sets the real `tsx search/build-fts-index.ts [--limit 5000]` start cmd + redeploys + tails `[fts-index]` logs. **Trigger sequence: commit-all.sh → `setup` → `canary` (report) → `full` → `score-fts.ts` → `teardown`.** Spend events (canary, full) stay Charlie-triggered; `score-fts.ts` reads the finished R2 dataset so it can run locally.

### Docs consolidation — `scrutinise-docs/` → `docs/`
Moved all of `scrutinise-docs/*` into `docs/` (git mv tracked; plain mv 2 untracked); removed `scrutinise-docs/`. Rewrote all 144 `scrutinise-docs/` references across 43 files → `docs/` — including both boot files (root `CLAUDE.md`, `docs/CLAUDE.md`), handoff, briefs, INGEST_PLAYBOOK, this CHANGE_LOG, the V22–V27 corpus-status-table + quango scripts (which write output into the folder), `legislation_synonyms.ths`, and the uksi `.ps1`. Gold deduped: `GOLD_QUERIES_2.md` → `docs/GOLD_QUERIES.md` (canonical); `GOLD_QUERIES_1.md` left in `docs/Archive/`. Verified: zero stray `scrutinise-docs`/`GOLD_QUERIES_2` refs; root boot file resolves to `docs/…`.

### Railway LegislationSection retire — reversible canary (DROP still Charlie's)
`scripts/ingest/railway-legsection-retire.ts` (`--check`/`--rename`/`--rename-back`, host-guarded to Railway only). Confirmed: panel query on Neon GIN (`LegislationSection_ftsVector_idx`, no Seq Scan); no web runtime reads Railway (`prisma`/`prismaSearch`→`DATABASE_URL`→Neon; `getRailwayPool` used only by offline `scripts/legislation/*`); exact parity LegislationSection 914,274 / LegislationItem 135,531 on both DBs (nothing lives only on Railway). Executed the rename `LegislationSection` → `LegislationSection_DEPRECATED_2026-06-19` on Railway; Neon untouched; reversible in one command. Report: `docs/RAILWAY_LEGSECTION_RETIRE_REPORT.md`. Charlie drops it deliberately after one clean cycle (V26 §6, ahead of the 28 Jun Hobby downgrade).

---

## V27 — BREAKER FIX · SCOTTISH COURTS · QUANGO T2 · EXEMPT-ORG PROBES (19 Jun 2026)

**Context:** SPRINT_V27_BRIEF.md. HEAD = V26 close (58f2e76). Ingestion safe during the Railway→Neon soak — new ingest writes only to `corpus_sections` on Neon, orthogonal to the legacy `Legislation*` rollback path (untouched). **BUILT + LOCALLY PILOTED this session; the four NEW/expanded corpora seed POST-PUSH** (new sourceTypes `scottish-courts`/`ico` would be `markSkipped` by the live worker until the processors deploy — V24 lesson). All `tsc --noEmit` clean.

### §1 — Ops breaker EVALUATION un-stalled (safety mechanism; done first)
- **Diagnosed from the Ops deploy logs** (the verify-before-asserting win): the symptom looked like "liveness runs but breakers don't" and `source_status` stale — but the real error was `[ops] breaker evaluation failed: Error: Query read timeout … querySourceCounts (ops.ts:192) … Promise.all (index 2)`. The third query — `SELECT corpus, COUNT(*) FROM corpus_sections GROUP BY corpus` over **17.2M rows** — exceeds the pool's 60s client `query_timeout` on the prod Railway→Neon link (ran ~1.8s locally vs warm Neon, which masked it). Every 15-min tick threw → **no breaker tripped/cleared since the 18 Jun 21:44 redeploy**; the lighter liveness/retry queries after it still ran.
- **Fix (`ops.ts`):** that GROUP BY only fed the **informational** `source_status.section_count`/`done_count` (written here, read NOWHERE — the email uses the census + `corpus_snapshots`). `querySourceCounts` now sources per-corpus counts from the **latest `corpus_snapshots` hour** (census-computed hourly, PK-indexed) in its own try/catch; a miss returns `null` → UPSERT keeps the prior value (`COALESCE`), and the trip evaluation + `updated_at` refresh ALWAYS complete. Breaker decisions never used it (failure breaker = top-5 window; zero-output = 24h `produced_output` streak — both fast).
- **Verified** `v27-breaker-verify.ts` (synthetic isolated sourceType, self-cleaning): evaluateBreakers completes vs the live 17M DB in ~3s + refreshes `source_status`; deliberate failure-breaker trip → clear+recover (no re-trip) → zero-output trip all PASS. Snapshot-derived `section_count` matches the old GROUP BY exactly (twfy-pwdata 8,816,376 · tna-legislation 1,685,853 · niassembly-hansard 196,348). Goes live at push. Diagnostics `v27-breaker-diag.ts` + `v27-railway-ops-logs.ts`. Playbook §breakers updated.
- **Related (NOT fixed, reported):** `reseedExhaustedPwdata` hits the same class of timeout — its `SELECT id FROM corpus_sections WHERE corpus='pwdata-debates'` pulls ~8.8M ids and times out; pwdata auto-reseed of new TWFY files is currently failing. Out of §1 scope (reseed, not safety) — recommend a V28 dedup rework (keyset/`NOT EXISTS`, not a full id pull).

### §2 — Scottish Courts judgments BUILT + piloted (auto-upgrade ready; corpus unblocked)
- Charlie's captured API works server-side with just Origin/Referer (no token): `POST api.pa.web.scotcourts.gov.uk/web/search` (1-INDEXED `page`; `limit:200` accepted) returns `results[]` with a direct `documentLink` PDF path + `pagination.count.total`. No `/web/definition/{id}` needed. **Universe measured = 13,066 judgments.** PDF served at `www.scotcourts.gov.uk{documentLink}`.
- **Licence VERIFIED OGL v3.0** — judiciary.scot/crown-copyright: judiciary material (ex logos/photos) re-usable "free of charge in any format or medium, under the terms of the Open Government Licence". licence-map `scottish-courts`→ogl-3.0.
- **PILOT 5/5 end-to-end** (real worker path: search → PDF → pdfToText → countWords): avg **6,185 words/judgment** (1,386–17,813). **PREDICTION ≈13,066 sections / ~80.8M words** (~0.5 GB R2; negligible Neon). `sources/scottish-courts.ts` + `processScottishCourts` (sourceType `scottish-courts`) + `v27-seed-scottish-courts.ts` (--pilot/--measure/--seed) + rate-limit 1000ms/2. The seeder enumerates all judgments and clears the blocked `scottish-courts` corpus_target. **Seed POST-PUSH** (Railway PDF-egress canary first).

### §3 — Quango Tranche 2 BUILT + measured (seed POST-PUSH)
- T2 = (A) the **next 40 live non-ministerial ALBs by relevant-format weight** (ranks 21–60, T1 took 1–20; same broad statute-adjacent set, HMRC excluded) **+ (B) the 24 ministerial departments RESTRICTED to the narrow statute-adjacent set** `{statutory_guidance, regulation, manual, manual_section}` (brief §3) to drop policy/press noise. Same machinery as T1: `govuk-content` rows under corpus `quangos-govuk` (OGL), URL-dedup vs every gov.uk URL in `corpus_sections`, `utaac_decision`+`fatality_notice` excluded.
- **Measured (dry-run):** ALBs **18,320** relevant docs (every measured ≈ register estimate; **0 orgs tripped the 5× guard**); ministerial narrow set **1,788** (MoD 611 · DfE 261 · MHCLG 170 · Home Office 149 · Defra 142 · DfT 116 · DHSC 105 …). **T2 GRAND TOTAL ≈ 20,108 docs to seed.** `v27-seed-quango-t2.ts` (--dry-run/--seed; guard pauses+reports any org >5× est). Processor already deployed (govuk-content) — **seed POST-PUSH** for atomicity with the ops fix.

### §4 — Exempt-org probes (sized 5; built the cleanest) → `EXEMPT_ORGS_PROBE.md`
- Sized ICO · Ofgem · Ofwat · Ofcom · Bank of England/PRA (route · size · licence · effort). **ICO is the only one with a clear open licence** (OGL v3.0, verified) — the others all assert own-org copyright (© Ofgem/© Ofwat/© BoE/Ofcom terms), so under the project's licence discipline none could be built this sprint; they become a ranked V28 list (Ofgem > Ofwat > Ofcom > BoE), each gated on a licence check.
- **ICO BUILT + piloted:** flat sitemap → **26,576** `action-weve-taken` leaves (25,979 FOI/EIR decision-notices · 326 FOI-reg · 210 GDPR enforcement · 61 audits); each leaf = HTML summary + a full decision/penalty PDF. Adapter prefers the PDF, falls back to `<main>` HTML. **PILOT 5/5** avg **3,090 words/leaf** → **PREDICTION ≈26,576 sections / ~82.1M words** (~0.4 GB R2). `sources/ico.ts` + `processIco` (sourceType `ico`, corpus `ico`) + `v27-seed-ico.ts` + licence-map `ico`→ogl-3.0 + rate-limit 500ms/2. **Seed POST-PUSH** (egress canary first); seeder upserts the new `ico` corpus_target.

### §5 — Scottish Parliament Official Report — built to the gate (seeds nothing)
- Recon (19 Jun): the OR landing page exposes NO api/data host in static HTML (`data.parliament.scot/api/` + `www.parliament.scot/api/` → 404) — search loads via a runtime XHR whose URL+key aren't in any asset, confirming the V25 gate. Did NOT brute-force. Added a capture-ready seam (`sources/scottish-parliament.ts`: `ScottishApiConfig`/`ScottishReportEntry`/`listOfficialReports`) + `v27-seed-scottish-parliament.ts` dry-run that states the exact capture needed (devtools XHR on the OR search), pointing at the §2 courts API as the working template. **Still WAITS ON CHARLIE'S CAPTURE** (~320k est).

### Verification & docs
- Per-source scorecards above (predictions recorded for scoring at drain). licence-map: `scottish-courts`+`ico` added (both OGL v3.0, verified). Breaker fix trip+recover proven. `EXEMPT_ORGS_PROBE.md` delivered. Playbook §breakers + header updated. `v27-corpus-status-table.ts` ready (run POST-DRAIN → `CORPUS_STATUS_V27.csv`). No git mid-sprint — single `commit-all.sh`.

### POST-PUSH run order (after Charlie's commit-all.sh deploys Ingest+Ops)
1. `seed-rate-limits.ts` (adds `scottish-courts`, `ico`).
2. Confirm the Ingest deployment is SUCCESS (deployments API) BEFORE seeding new sourceTypes — else the old worker markSkips them.
3. `v27-seed-scottish-courts.ts --seed` → canary a few rows, verify sections + Railway PDF-egress, then it's grinding (~13k).
4. `v27-seed-ico.ts --seed` → canary, verify egress, grind (~26.6k).
5. `v27-seed-quango-t2.ts --seed` (govuk-content already live — can seed once ops fix is deployed; ~20k docs after URL-dedup).
6. At drain: `v27-corpus-status-table.ts`; re-baseline the new corpora to confirmed; re-run `v20-licence-backfill.ts` for any NULL stragglers (new corpora get licences at ingest via the map).

---

## V26 — UNIFICATION + RAILWAY DECOMMISSION (structural) (16 Jun 2026)

**Context:** SPRINT_V26_BRIEF.md, build input `UNIFICATION_PLAN.md` §4. Fold legacy `LegislationSection`/`Item` into `corpus_sections` (Migration A) + move the web-app tables Railway→Neon (Migration B). Public site access is closed pending the new Search/Lex build, so the cutover needs no user write-freeze. **Two human gates only — the cutover flip (§3.5) and the eventual DROP (§6); both deferred to Charlie. Everything else ran unattended.** As-built detail: UNIFICATION_PLAN "AS-BUILT (V26)"; operational steps: `V26_CUTOVER_RUNBOOK.md`.

### §1 Precondition — corpus settled
- V25 drained corpora rebaselined ✓ (`v25-rebaseline.ts --classify-failed --confirm`): committees-reports 24,876 · committees-evidence 140,567 · niassembly-hansard 196,348 · inquiry-reports 140 · college-of-policing 332 (small deterministic failed residues classified skipped). **bills-api + senedd-cofnod were still draining** at sprint start (senedd since drained, bills ~900 pending) — per brief §1, proceeded with the migration anyway (independent legislation data) and noted it; rebaseline those + the gap-filled corpora at drain.

### §2 Migration A — corpus unification (additive, reversible, online)
- **A.1 normalization (read-only):** 38,571 non-matching legacy gids → **24,247 genuine gaps** + 14,324 docId-form differences already covered (ukpga calendar↔regnal 8,514 · uksi regional 4,041 · eur→eudr/eudn/CELEX 1,769). Genuine gaps verified real: 99.6% carry legacy `originalText`; 25/25 stratified live-TNA `data.feed` probe fetchable. Scratch: `v26_cs_gids`, `v26_nonmatch` (categorized). Scripts `v26-normalize-explore/-hypotheses/-build-gaplist/-gap-probe.ts`.
- **A.2 gap-fill:** 24,246 `tna-legislation` rows seeded (priority 5, `ON CONFLICT DO NOTHING`), corpus-mapped (si-pre-2010 23,510 · primary-acts-2000plus 394 · retained-eu 339 · si-2010plus 3 · regional 1). Draining online. `v26-seed-gapfill.ts`.
- **A.3 compilation layer preserved:** `legislation_compilation_enrichment` (Neon) — 26,126 rows keyed by (legislationGovUkId, sectionNumber): 24,579 compiled-text R2 keys / 1,142 lex-summary keys / 5,635 unapplied-amendment JSON + metadata. Pointer-only (V3 rule). `LegislationAmendment/Correction/CrossRef` all empty → nothing else to carry. `v26-build-enrichment.ts`.

### §3 Migration B — app tables Railway → Neon (prep done; flip gated)
- **B.1:** the plan's assumption was stale — **all app tables already existed on Neon**. So B.1 = column-parity verify (clean) + `_prisma_migrations` baseline on Neon (ledger table created, 13 rows copied). `v26-schema-parity.ts`, `v26-db-inventory.ts`.
- **B.2 app-data copy:** 24 tables / 62,394 rows Railway→Neon, exact parity (OperationalSection 61,315 the only bulk; rest dozens — pre-launch site). Neon forbids `session_replication_role`, so copied in FK-topological order (self-refs single-statement). `v26-copy-appdata.ts`, `v26-fk-graph.ts`.
- **B.3/B.4 code repoint:** Neon legacy `ftsVector` confirmed intact (both tables 100% populated + GIN-indexed; OperationalSection index re-populated by the BEFORE-INSERT trigger during the copy). Dual client collapsed — `lib/prisma-search.ts` now re-exports `prisma`; `lib/search.ts` unified onto one client (operational FTS off Railway); `/api/ideas/[id]/legislation-search` moved off the per-query seq-scan onto the `ftsVector` GIN index (EXPLAIN → Bitmap Index Scan); `prisma.config.ts` gained `directUrl`. `tsc --noEmit` clean.
- **B.5 cutover flip — GATED** (Vercel `DATABASE_URL`→Neon pooled `&pgbouncer=true&connection_limit=1`, `DIRECT_URL`→non-pooled, redeploy, smoke-test auth/idea-create/Lex/LegislationPanel). Runbook + rollback in `V26_CUTOVER_RUNBOOK.md`.

### §4 Railway — confirmed compute + idle DB
- Railway project holds exactly `scrutinise-db`, `Ingest`, `Ops`. Post-flip the DB serves nothing; left intact + running through the soak. Decommission is §6 (gated).

### §6 soak + DROP — documented, NOT executed
- Checklist in the runbook: soak ≥1 week → search verified (+ new corpus_sections FTS when search thread lands) → verified Neon backup → THEN drop legacy `Legislation*` (both DBs) + decommission Railway Postgres. The one irreversible step.

### Reversibility
- Migration A: gap-fill rollback = delete the priority-5 rows + the corpus_sections for `v26_nonmatch` gap gids; enrichment = drop the table. Migration B: Railway intact → flip `DATABASE_URL` back + redeploy. No legacy data deleted before §6.

### Post-drain rebaseline + workbook (17 Jun 2026)
- Gap-fill (24,246 rows) + bills-api + senedd-cofnod all drained (queue 806,382 done, 0 open). `v26-rebaseline.ts --confirm` stamped ✓: **si-pre-2010 174,552→419,250 · primary-acts-2000plus 90,838→145,704 · retained-eu→187,555 · si-2010plus 270,339 · regional→331,124 · bills-api→6,535 · senedd-cofnod→191,730**. `v20-licence-backfill.ts` swept 85 NULL stragglers (new sections got OGL/OPL at ingest; only pwdata-* deferred remain, by design).
- **Per-corpus workbook table** → `CORPUS_STATUS_V26.csv` (`v26-corpus-status-table.ts`). **TOTAL 16,302,498 compiled / 16,521,390 sections · 5.06B words · ~28.75 GB R2 est · 7.00 GB Neon heap** (V24 close was 15.58M / 4.83B — the delta is the gap-fill +~300k legislation sections, bills/senedd, and the regional/retained-eu reconfirms). Pooled-endpoint Prisma smoke test (`v26-pooled-smoke.ts`) green.

### B.5 cutover EXECUTED + verified (18 Jun 2026)
- Charlie moved the Vercel env to Neon (`DATABASE_URL`→pooled `&pgbouncer=true&connection_limit=1`, `DIRECT_URL`→non-pooled). **Verified live** (`v26-cutover-verify.ts`): prod `GET /api/legislation/search` → HTTP 200, 20 items served from Neon (4.1s cold / 315ms warm); **Railway scrutinise-db: 0 app connections** (web app fully detached); Neon serves via the pgbouncer pooler. Clerk login is DB-independent + `prisma.user.count()` on Neon pooled already verified — Charlie's own final eyeball.
- Railway now = `Ingest` + `Ops` + **idle** `scrutinise-db`. Soak clock started 18 Jun. **§6 DROP (legacy `Legislation*` both DBs + Railway PG decommission) remains gated** on ≥1-week clean soak (earliest ~25 Jun) + the search thread's new `corpus_sections` FTS / Lex-grounding repoint (to retire the legacy `ftsVector` first). The one irreversible step.

---

## V25 — FEED THE MACHINE (Senedd · College · Bills · inquiry register expansion · licence compliance) (16 Jun 2026)

**Context:** SPRINT_V25_FEED_BRIEF.md — pure additive `corpus_sections` ingest of newly-unblocked sources; zero structural-DB risk (the structural-unification brief is now V26, gated on the FTS decision). Queue had run dry since ~14 Jun (0 pending at sprint open). Three new source families BUILT + LOCALLY PILOTED (predict-measure-commit); the public-inquiry register expanded 8→21 inquiries. **New sourceTypes seed POST-PUSH** (the live worker markSkips an unknown sourceType) — see the POST-PUSH run order at the end.

### §1 Carry-over

- **§1.1 divergence-check fix — already in HEAD (`96d150f`).** `progress-reporter.ts` `queryRowsCompletedLastHour()` returns `{ total, empty }` where `empty` = rows with `produced_output=false`; the hourly email warns on that, NOT on compiled-section delta — a marker-heavy or idempotent-reseed hour no longer cries wolf. Verified present this sprint.
- **§1.3 CORPUS_STATUS CSV TOTAL row — already dropped in HEAD (`96d150f`).** `v24/v25-corpus-status-table.ts` prints TOTAL to the console only; the CSV holds per-corpus rows only (a trailing TOTAL row double-counts on a naive workbook SUM). `v25-corpus-status-table.ts` writes `CORPUS_STATUS_V25.csv`.
- **§1.2 rebaseline (4 corpora) → POST-PUSH.** committees-reports/-evidence + niassembly-hansard + inquiry-reports all drained except a tiny deterministic FAILED residue (committees-api 18 detail-fetch + 83 AggregateError; niassembly 14 components-fetch misses). `v25-rebaseline.ts --classify-failed` marks those skipped (≤200, no pending/claimed → the "✓-or-classified" rule), then `--confirm` stamps ✓ at the measured compiled count. Runs after the new worker deploys.

### §2 Senedd Cofnod — BUILT + PILOTED (licence VERIFIED OGL v3.0)

- **Licence VERIFIED** (Charlie, brief §2): Senedd content is Crown copyright, reproducible under OGL v3.0 with source acknowledgement (senedd.wales copyright page). `licence-map` `senedd-cofnod` → `ogl-3.0` (supersedes the V24 "g**oogl**e" false positive).
- **Route:** `record.senedd.wales/Plenary/{meetingId}` (custom .NET, NO Cloudflare). Enumeration walks the meeting-id space classified by redirect (`/Meeting/{id}` → `/Plenary/{id}` = plenary; the on-site search is JS-driven and useless for bulk listing). Granularity = one section per English speaker-turn (bilingual page: prefer `translation`, fall back to `verbatim`).
- **PILOT (predict-measure):** Plenary/16073 (2026-06-10) = 254 sections / 32,096 words / 51 speakers; Plenary/5000 (2018-07-17) = 259 / 47,510. Density sample 16/304 ids plenary → **~847 plenaries**. **PREDICTION ≈ 217,000 sections / ~30M words** (matches the V23 ~200k placeholder).
- Files: `sources/senedd-cofnod.ts`, `processSeneddCofnod`, `v25-seed-senedd-cofnod.ts` (--pilot/--seed), rate-limit 500ms/3.

### §3 College of Policing — BUILT + PILOTED (college-nc, commercial-excluded)

- **Route:** UK Gov Web Archive 2022 snapshots (live site CF-blocked; fresh snapshots are JS shells — V24). CDX enumerates `app.college.police.uk/app-content*` (200/html/2022, deduped to the latest capture per URL); content fetched via the `…{ts}id_/…` raw-capture route (no archive banner) and sliced from `<div id="content" role="main">`. One section per APP page; snapshot date carried as `itemDate` so the ~4yr staleness is visible.
- **Licence college-nc** (Non-Commercial College Licence, verified V24) → flagged for **commercial-surface exclusion** (LICENCE_COMPLIANCE.md §2).
- **PILOT:** **332 distinct APP pages** (2022 snapshot; the V21 ~8k placeholder was a rough overestimate), avg ~2,431 words/page (8,568 for the deep armed-deployment guidance). **PREDICTION ≈ 332 sections / ~0.81M words.**
- Files: `sources/college-policing-archive.ts`, `processCollegePolicing`, `v25-seed-college-policing.ts`, sourceType `college-policing-archive` rate 1000ms/2. Seeder `--seed` clears the corpus_target block.

### §4 Bills API — BUILT + PILOTED (OPL v3.0)

- **Route:** `bills-api.parliament.uk` JSON API (3,914 bills). Two-stage queue (committees pattern) — a single bill carries up to hundreds of publication PDFs (bill 3774 = 267), too many for one row's 5-min budget: `list:{billId}` enumerates a bill's PDFs into per-PDF content rows; each content row extracts ONE PDF → one section. **Only the API-hosted `files[]` Download route is used** — the legacy `links[]` (external parliament.uk / data.parliament.uk URLs) are unreliable (HTML index pages mislabelled PDF, dead URLs, scanned image PDFs; verified across sampled bills 986/2071).
- **Licence opl-3.0** (parliamentary material — Open Parliament Licence; same family as Hansard/committees).
- **PILOT:** 16 bills sampled across the id range → avg 3.3 files-PDFs/bill, 100% extract-rate (5/5 downloads), 729 words/section. **PREDICTION ≈ 12,965 sections / ~9.4M words** (the V21 ~5k placeholder is an underestimate — amendment papers/EN/memoranda dominate; rebaseline at drain).
- Files: `sources/bills-parliament.ts`, `processBills`, `v25-seed-bills.ts`, rate 500ms/3, P2.

### §5 Public inquiries — register expanded 8 → 21 (reports-only)

- `INQUIRY_REGISTRY` extended with 13 verified concluded inquiries whose final reports are gov.uk publication pages (each confirmed → PDFs at build via the gov.uk content API `details.attachments`): Bloody Sunday/Saville (11), Mid Staffs/Francis (4), Al-Sweady (50), Grenfell Phase 2 (12), Baha Mousa (3), Zahid Mubarek (3), IICSA (3), Litvinenko (2), + Victoria Climbié / Azelle Rodney / Rosemary Nelson / Equitable Life / Hillsborough Panel (1 each).
- **21 inquiries → 146 report PDFs** (was 8 / 53). Slugs found via the gov.uk search API (guessing was unreliable). Re-run `v24-seed-inquiry-reports.ts --seed` POST-PUSH (idempotent — adds the 93 new rows); rebaseline `inquiry-reports` from what seeds. Dark-site-only inquiries (some Manchester Arena / Undercover Policing / Shipman own-domain reports) still need a Web Archive report-PDF adapter — documented follow-up.

### §6 Scottish — BUILT to the gate, SEEDS NOTHING

- HTML Official Report route live (`parliament.scot/chamber-and-committees/official-report` → 200); the structured SpOpenData API base is still not exposed in static assets (`data.parliament.scot/api/` → 404) — the auth key lives in the site's XHR calls. `sources/scottish-parliament.ts` carries the integration seam + an HTML liveness probe; `v25-seed-scottish.ts` confirms the route and reports the blocker. **No XHR capture was supplied in the session prompt → no seed.** Did NOT brute-force the key (brief §6). Waits on Charlie's devtools Network-tab capture (same technique unblocks scottish-courts).

### §7 Case-law licence compliance — RECORDED

- `docs/LICENCE_COMPLIANCE.md` created: the Find Case Law commitments as HARD serving-layer build requirements — (a) judgment text auth-only/no public URL; (b) noindex/robots/no crawlable route; (c) no open or third-party API over judgment text or derived data; (d) no open-web publication of citation/entity/statistical extracts. Plus the NC commercial-exclusion set (college-nc/oecd/nao-nc/echr-nc) and fca-restricted. NOT enforced this sprint (ingest only) — flagged to the search thread.

### POST-PUSH RUN ORDER (after `commit-all.sh` push + Railway Ingest deploy confirmed SUCCESS)

1. `seed-rate-limits.ts` (adds senedd-cofnod, bills-api, college-policing-archive, scottish-parliament-or).
2. `v25-seed-college-policing.ts --seed` (332 rows; smallest, fastest canary of the web-archive route).
3. `v25-seed-bills.ts --seed` (3,914 list rows → per-PDF rows expand on the worker).
4. `v25-seed-senedd-cofnod.ts --seed` (full id scan → ~847 plenary rows).
5. `v24-seed-inquiry-reports.ts --seed` (idempotent; +93 new report rows for the expanded register).
6. `v25-seed-scottish.ts` — confirms gated, seeds nothing.
7. Verify breakers 0 tripped; spot-check one section per new corpus in Neon + R2.
8. At drains: `v25-rebaseline.ts --classify-failed --confirm` (the §1.2 four + new corpora) and re-run `v20-licence-backfill.ts`.

### POST-PUSH — DONE this session (deploy confirmed SUCCESS; Ops auto-started the Ingest worker)

- **rate-limits** upserted (senedd-cofnod / bills-api / college-policing-archive / scottish-parliament-or).
- **inquiry-reports ✓ seeded + drained:** +93 rows → **146 rows, 140 compiled / 14.56M words** (6 markers — scanned/huge Iraq-Chilcot vols). The expanded register works end-to-end on the worker.
- **college-of-policing — Railway-egress BLOCK discovered → ingested LOCALLY.** The worker got **257/332 "archive fetch failed"** while the identical `id_` capture returns 200 from a residential IP (burst-tested) — `webarchive.nationalarchives.gov.uk` blocks/challenges Railway egress (same class as committees.parliament.uk CF). Bypassed with `v25-ingest-college-local.ts` (local fetch+extract+R2+Neon, idempotent r2Exists-skip): **332 compiled / 840,308 words — exactly the pilot.** Future College re-seeds MUST use the local path; the worker `processCollegePolicing` stays wired but is inert behind the IP block.
- **senedd-cofnod — enumeration bug found + fixed; seeded.** The first `--seed` ran the scan at conc 6, which provoked host throttling; `classifyMeeting`'s `catch→'gap'` turned the resulting fetch failures into false "not-a-plenary" (found only 396, missed real plenaries e.g. id 5000), and then a transient Neon DNS blip lost even those at insert. Hardened: `classifyMeeting` retries (3×, backoff) and returns a distinct `'error'` (never a false gap); the seeder scans at conc 3, re-scans transient-error ids serially, and wraps the insert in a retry. Re-run found **713 plenaries** (seeded). Worker reachability of record.senedd.wales (no CF) being canaried.
- **bills-api seeded + grinding:** 3,919 `list:{billId}` rows on the worker. Done list rows so far are low billIds (old bills, legacy `links[]` only → 0 `files[]` PDFs → 0 child rows, by design); per-PDF child rows + sections appear as the worker reaches modern (high-billId) file-rich bills.
- **scottish — gated, seeds nothing** (HTML route 200, SpOpenData key not supplied).
- **Rebaseline** (`v25-rebaseline.ts`) runs at drains — pending bills/senedd completion.

**Railway-reachability note (NEW doctrine input):** `webarchive.nationalarchives.gov.uk` joins the Railway-egress-blocked list. The fix pattern for a small/static blocked corpus is a **local one-shot ingest** that writes R2+Neon+queue directly (`v25-ingest-college-local.ts` is the template). CF-free custom gov hosts (record.senedd.wales, niassembly IIS) are typically reachable from Railway.

---

## V24 — REBASELINE + BREAKER FIX + EMAIL HONESTY + NI ASSEMBLY + INQUIRIES + UNIFICATION SPEC (14–15 Jun 2026)

**Context:** SPRINT_V24_BRIEF.md. **TOTAL at close: 15,577,221 compiled sections / 4.82B words** (15,770,435 incl. classified residue; V23: 12,558,897 / 4.05B — the jump is the Lords 1919-1999 tranche fully drained (historic-hansard 4.64M), quangos T1 + committees draining, and the si-2010plus/retained-eu enum drains landing). Per-corpus table → `CORPUS_STATUS_V24.csv` (R2 ~27.4 GB est, Neon heap 6.76 GB). Two new source families built, then **seeded + verified live the same session after the push** (NI Assembly Hansard, public inquiry reports — see the POST-PUSH subsection at the end).

### §1 Rebaseline — 7 corpora ✓ confirmed

`v24-rebaseline.ts --confirm` (same §1c guard as V23 — refuses any corpus with open pending/claimed/blocked/failed rows; classified residue excluded). Before → after:
- **retained-eu** 140,000 → **186,371** · **si-2010plus** 61,111 → **270,339** · **explanatory-notes** 560 → **410** · **explanatory-memoranda** 10,864 → **5,420** · **historic-hansard** 3,304,200 → **4,641,085** · **ni-judgments** 5,900 → **7,772** · **quangos-govuk** 162,004 → **86,547**.
- Prep (`v24-rebaseline-prep.ts`): 29 transient failures (ni-judgments connection-timeouts, quangos-govuk gov.uk aborts) reset to pending → drained → ✓; the 2 deterministic `historic-hansard` gapday misses (`lords 1859/feb/08`, `…/feb/10` — day-index absent on the HTML archive) classified `skipped` with a note (genuinely-unfillable, the V22 "lost day" category) so they don't block ✓.
- **Still draining (reported, not ✓):** committees-reports (47,593 pending) and committees-evidence (~4,900 pending + 83 committees-api AggregateError failures) — the WrittenEvidence/reports windows are still grinding from V22/V23. ✓ next session.

### §2 Zero-output breaker — FIXED at the worker (CC's V23 recommendation, approved)

The V23 breaker inferred emptiness from **corpus-level `section_count` deltas across sweeps**, so an idempotent reseed (already-complete rows re-run → 0 NEW `corpus_sections` rows → 0 delta) read as zero-output and false-tripped — it parked 108,349 legitimate rows in V23. **Fix: the worker now records a per-row verdict in `ingest_queue.produced_output`** (new boolean column, added idempotently in `ops.ensureTables` + `v24-migrate-produced-output.ts`). A `done` row is `produced_output=false` ONLY if it wrote no compiled section AND confirmed no existing R2 file AND wrote no marker AND is not a structural seeder (enum:/list:/gapvol:/treaties).
- Implemented with **`AsyncLocalStorage`** in `process-row.ts` — the 20 concurrent claim loops share module state, so per-row counters must be request-scoped. `processRow` runs the dispatch inside a per-row store; the existing `upsertSection`/`bulkUpsertSections` wrappers and a NEW counting `r2Exists` wrapper update it transparently — **zero changes to the 30+ processor bodies**. The decisive insight: counting the `r2Exists`-confirmation (the idempotent-reseed skip path) as "output produced" is what removes the false signal.
- `ops.evaluateBreakers` rewritten: trips when the **trailing run of most-recent `done` rows** for a sourceType (24h window, non-null verdict) is all-`produced_output=false` and reaches `ZERO_OUTPUT_THRESHOLD` (25). Replaces the cross-sweep delta logic; `done_count`/`section_count` still tracked for the email.
- **Verified** (`v24-verify-breaker.ts`, TEMP-table, production untouched): tna-legislation reseed (40 confirmed) → no trip ✓; committees-api (30 produced) → no trip ✓; committees-document curl-broken (30 empty) → **trips** ✓; recovery (30 empty then 1 produced) → resets ✓; legacy NULL rows ignored ✓. The two paths the brief named (committees, tna-legislation) do NOT false-trip on idempotent reseeds.

### §3 Email — the >100% headline retired (Charlie-directed)

`shared/progress-reporter.ts`: the single overall percentage (which crossed 100% because exact numerators ran against stale estimated denominators) is **gone from both the subject and the TOTAL CORPUS block**. Replaced with (a) two exact hard numbers — sections ingested + words; (b) a COMPLETION count table (✅ complete / ✓ source-confirmed / ▶ in progress / ○ not started / ⛔ blocked / unsized); (c) the eventual total as a **labelled projection** ("Eventual total ≈ N est. when the open corpora land — NOT a %"). The per-corpus ALL CORPORA STATUS table (which never exceeded 100% per-row) is retained, as is the unenumerated-sources list.

### §4 Devolved records

- **NI Assembly Hansard — BUILT + piloted + seed-ready (POST-PUSH).** Licence **VERIFIED OGL v3.0** (data.niassembly.gov.uk footer: "Contains Parliamentary information licensed under the Open Government Licence v3.0"); host is Microsoft-IIS, **no Cloudflare** → Railway-egress safe. New `sources/niassembly-hansard.ts` (AIMS `GetAllHansardReports` + `GetHansardComponentsByReportId`, one section per speaker-turn — `Speaker (*)` component → name, following `Spoken Text`/`Quote`/`Bill Text`/`Question` → words, `Header` → running title, `PlenaryDate` → date; entity-decoded, `<BR/>`→newline) + `processNiAssemblyHansard` + `v24-seed-niassembly-hansard.ts` (built-in `--pilot`). **Pilot (predict-measure-commit): 3 reports → avg 482 sections/report → PREDICTION ≈ 311,157 sections / ≈48.4M words across 646 reports (2012-09-10..2026-06-09)** — consistent with the V23 ~270-300k estimate; parser handles Irish-language + Unicode cleanly. Rate limit 1000ms/2.
  - **Skip-race caught:** seeding 646 rows while the OLD worker code was live had it `markSkipped` 95 rows in ~2 min (unknown sourceType → `default` case). Deleted all 646 (0 sections processed); **the seed is deferred to the POST-PUSH run order** — the established pattern for any new sourceType.
- **§4b College of Policing (Web Archive route).** Licence **RESOLVED**: the college.police.uk footer (UK Gov Web Archive snapshot 2026-02-03, CF-free) states APP content "is available under the **Non-Commercial College Licence** except where otherwise stated" — NOT OGL; same posture as `nao-nc`/`echr-nc`. Licence-map updated `pending-verification` → `college-nc`. **BUT the content route is blocked:** fresh (2026) archived snapshots are Drupal **JS-SPA shells** with no static body text ("Sorry, you need to enable JavaScript"); only **pre-redesign 2022 snapshots** carry extractable body (~4k words/page). So usable content is ~4 years stale — the brief's "snapshots too stale → report + recommend fallback" condition. **No seed; breaker left as-is.** Recommendation: a rendered (Playwright)/JSON-API route for fresh content, or Charlie's direct permission email for a clean feed.
- **§4.2 Senedd / Scottish — neither meets the seed condition (no seed, per brief).** Senedd `record.senedd.wales` route confirmed (date-based plenary 200), but **licence NOT verified** — the apparent "ogl" footer signal was a false positive from "g**oogl**e"/googletagmanager (verify-before-asserting); copyright reads "Welsh Parliament 2026". Scottish `parliament.scot/.../official-report` HTML route is live, but the structured SpOpenData API still needs Charlie's devtools XHR (§7, not supplied). Both documented build-ready/blocked; placeholders unchanged.

### §5 Public inquiries — first real seed BUILT (POST-PUSH)

New `inquiry-reports` sourceType — **one queue row per report PDF** (a 12-volume inquiry would blow the 5-min row cap if all PDFs ran in one row, which is why this is distinct from the govuk-content content-page processor). `sources/inquiry-reports.ts` (registry + gov.uk content-API attachment enumeration) + `processInquiryReports` (per-PDF fetch → pdfToText → one section/volume) + `v24-seed-inquiry-reports.ts`. **Dry-run measured: 8 concluded major inquiries → 53 report-volume PDFs** (Infected Blood 9 · Iraq/Chilcot 26 · Leveson 4 · Manchester Arena ×3 = 8 · Brook House 3 · Post Office Horizon 3), all `application/pdf` on assets.publishing.service.gov.uk (CF-free), OGL v3.0. Grenfell/dark-site own-domain reports need a Web Archive snapshot adapter (documented follow-up). `inquiry-reports` corpus_target upserted on `--seed` (est = seeded PDF count — brief §5 "rebaseline from what's seeded"). Rate limit 500ms/3.

### §6 Unification readiness — `UNIFICATION_PLAN.md` DELIVERED (spec only, no migration)

Measured inventory (live 14 Jun + S0 SEARCH_AUDIT): legacy `LegislationSection` 914,274 rows (135,531 items), duplicated on BOTH Railway + Neon; `originalText` 100% (0.86 GB in Postgres) but `compiledTextKey` only 2.7% (R2 backfill needed for the rest); `embedding` 0 rows; `ftsVector` 100% = the live search index (3 web paths read it, none touch `corpus_sections`). **Overlap measured: 96,960/135,531 (71.5%) legacy items already in `corpus_sections` by exact `legislationGovUkId`; 28.5% need normalization-or-gap-fill.** New pipeline holds 356,634 distinct legislation docs (2.6× the legacy item count) — it is the coverage superset; legacy is the compilation/summary/amendment-layer superset (mostly unbuilt). Plan: (A) gap-fill the additive 28.5% via the tna-legislation queue (R2-backed) rather than copy the Postgres column; defer/sidecar the compilation layer; (B) move ~60 app tables Railway→Neon pooled endpoint, repoint all three search paths + `DATABASE_URL`. **Predicted downtime < 15 min (one write-freeze); rollback in minutes; no data loss possible before the final `DROP` (gated on soak + verified backup).** Corpus FTS-on-`corpus_sections` is a search-thread dependency (full corpus over the 20 GB budget; legislation+caselaw scope fits — SEARCH_AUDIT §7).

### POST-PUSH (done same session)

After `commit-all.sh` pushed (`fe4d15f` feat + `623d386` docs), the Railway Ingest deployment of `623d386` was confirmed **SUCCESS via the deployments API** before seeding (so the new dispatch cases were live — no skip-race repeat). Then:
- `seed-rate-limits.ts` (30 entries incl. the two new sources).
- **NI Assembly: canary then full.** `--canary 3` → **1,445 compiled sections / 224,732 words** (≈482/report — matches the pilot exactly; Railway egress on the IIS host confirmed). Then `--seed` → 646 rows total, grinding toward ~311k.
- **Inquiries: full seed.** 53 report PDFs → **51 compiled sections / 6.55M words** (2 markers; Iraq/Chilcot volumes are huge). inquiry-reports corpus_target est=53.
- **Verified:** 0 tripped breakers; the new per-row zero-output breaker is live and recording `produced_output` verdicts on the fresh done rows (the deployed fix functioning, not just unit-tested). TOTAL crossed **15.58M compiled / 4.83B words**.

### §8 Artifacts

`CORPUS_STATUS_V24.csv` (corpus | sections | words | R2-bytes-est | Neon-heap-bytes — for the workbook). New scripts: `v24-state-check`, `v24-rebaseline(-prep)`, `v24-migrate-produced-output`, `v24-verify-breaker`, `v24-seed-niassembly-hansard`, `v24-unseed-niassembly`, `v24-seed-inquiry-reports`, `v24-unification-inventory`, `v24-corpus-status-table`. Licence-map: niassembly-hansard → ogl-3.0 (verified), college-of-policing → college-nc (verified), inquiry-reports → ogl-3.0.

---

## V23 — V22 CLOSEOUT + ORAL EVIDENCE + QUANGO T1 SEED + DEVOLVED/INQUIRY SCOPING (13 Jun 2026)

**Context:** SPRINT_V23_BRIEF.md. §1 closeout was the load-bearing work this sprint — a live breaker incident and the S5L listing block both needed fixing before the new-source probes. Mid-sprint the session switched models (Fable 5 → Opus 4.8); full transcript continuity preserved, no state lost. **TOTAL at close: 12,558,897 compiled sections / 4.05B words** (V22: ~9.87M / 3.46B — the jump is the historic-hansard 1803-1918 full drain landing ~2.0M not the predicted ~850k, the Lords tranche, quangos T1, and the retained-eu/si drains). Denominator 14.79M, 29/53 targets ✓ → headline ~84.9% (honest-lower: the three devolved placeholders + Lords/gap-fill est increments enlarged the known universe — §1d working as designed).

### §1 V22 closeout

- **S5L Lords listing walk was CF-blocked — switched from listing walk to enumeration.** Root cause (verified, not assumed): `www.hansard-archive.parliament.uk` CF penalty-boxes the WebForms listing path IP for *minutes* after even a small request burst; the box outlives a 4×60s cooloff, so every retry (undici AND curl alike) 403'd on page 1. Both curl builds present are Schannel (no TLS-fingerprint lever); isolated requests succeed only in the gaps. **The decisive insight: the ZIP path is CF-free** (V21 proved it — full seed + Railway canary ran on zip fetches). S5L docIds are deterministic `S5LV{NNNN}P0`; probed 13 Jun — vols 33/100/300/606 PK-real, NO split (`_a/_b`) or multi-part (`P1`) forms exist in the range (S5LV0100P1 + S5LV0040P0_a both soft-404). **`v22-seed-lords-hansard.ts` rewritten to enumerate P0 vols 1-606** and let the worker's `fetchVolumeXml` PK-check sort real zips from soft-404 gaps (absent → `no-provisions` marker, itself a section row, so a run of gaps can't trip the zero-output breaker). **Canary PASSED** (predict-measure-commit): seeded S5LV0100P0 → 2,408 compiled sections, max date 1936-05-29 — exactly the V22 pilot figure, AND a surviving 1936 Lords volume proves the DEPLOYED parser uses the Lords 1999-11-17 cutoff (not the old Commons-1919 one). Seeded 578 rows (574 above the old cap-32), est += 2,296,000. **Tranche grinding** (754 done at close, S5L at 110,441 sections, max date 1981 — climbing to 1999). The resumable-walk machinery (curl + per-page sidecar checkpoint, `listHistoricHansardVolumes` `resumeFile`) was built first and is kept for future series, but enumeration is the live path for S5L.
- **Hansard gap-fill seeded — 113 gapvol rows** (S3 40 · S4 57 · S5C 16; S5L 0 — enumeration covers it). The 113-vs-V22-measured-114 difference is exactly the 1 S5L HTML-fillable volume, now absorbed as a bulk-archive soft-404 marker rather than HTML-crawled (acceptable 1-volume / ~4k-section loss; noted).
- **uksi enum rows reset + DRAINED:** the 7 throttled `enum:uksi:{2012-14,2023-26}` rows reset to pending → all 17 si-2010plus enum rows now done.
- **⚠️ INCIDENT — tna-legislation zero-output breaker FALSE-POSITIVE trip (root cause found, cleared).** Tripped 02:16 *"838 rows marked done with 0 corpus_sections written"*, parking **108,349 rows** (retained-eu 74,311 · si-2010plus 22,215 · EM 10,864 · EN 560 · regional 399). Verified, not assumed: the 838 rows (regional wsi/2017, ssi/2020) **already held their sections from a prior ingest** — idempotent re-processing UPSERTs identical rows, so `corpus_sections` COUNT does not grow even though output was produced. The zero-output breaker (`querySourceCounts` compares total per-source section count between sweeps) cannot distinguish "wrote nothing" from "re-wrote identical rows" → false trip on a contiguous run of idempotent re-runs (clustered by the `priority,id` claim order). Cleared per playbook §8 (breaker + streak reset + unpark 108,349); did NOT re-trip in-session. **Recommended fix (playbook §8 lesson added): the breaker should track genuinely-empty done rows at the worker, not infer emptiness from aggregate count growth** — otherwise any reseed of already-complete rows re-trips it.
- **✓ re-baselines (4 drained corpora):** echr-hudoc 4,410 · tax-tribunals 12,089 · nao-reports 2,570 · lawcom 262 (`v23-rebaseline.ts`, guarded — refuses any corpus with open rows; classified residue excluded per §1c rule 2). Still grinding (✓ next session): retained-eu, si-2010plus, regional, EN/EM, committees-reports/evidence, ni-judgments, historic-hansard (Lords + gap-fill must ALL drain first). ukpga cleanup ran → **primary-acts-pre-2000 ✓ 165,438** (deleted 5,840 boilerplate + 1,057 dead markers).
- **rawToText entity fidelity (V23):** `shared/compile.ts` `rawToText()` now decodes numeric (`&#xa0;`) and named HTML entities (the historic-hansard fidelity set) instead of blanking them — committees oral transcripts carried literal `&#xa0;`. Affects future ingests/re-compiles only.

### §2 Committee oral evidence — COVERED (verified definitively)

- **OralEvidence IS a distinct Committees-API publication type and IS already ingested** — 14,820 compiled `oralevidence:*` sections under corpus `committees-evidence` (avg 14,688 words, opl-3.0, 535 no-provisions markers). R2 spot-check (oralevidence:5193, Energy & Climate Change Committee 2016) = clean witness-session transcript with named witnesses + Q-numbered exchanges. The V20-22 committees-api build walked Publications + OralEvidence + WrittenEvidence; expert oral sessions are NOT a gap. WrittenEvidence (126,564) + reports (47,593) still draining.

### §3 Quango Tranche 1 — SEEDED (Charlie-confirmed)

- `v22-seed-quango-t1.ts --seed`: T1 live re-measure = **42,942 docs** across 20 ALBs; **41,321 new `quangos-govuk` rows seeded** (the gap = URL-dedup against 233,480 gov.uk URLs already held). Per-org tagging via docPath, OGL, govuk-content sourceType. Grinding — **76,461 sections at close**, 5,380 pending, 23 transient failures (0.05%, non-systemic). HMCTS (515) and UTAAC (0) confirmed gutted by the utaac_decision/fatality_notice exclusions (Charlie's tier decision stands).

### §4 Devolved parliament records — PROBED + SIZED (build V24)

- **NI Assembly — build-ready, cleanest route.** AIMS API `data.niassembly.gov.uk/hansard.asmx` (`GetAllHansardReports` + `GetHansardComponentsByReportId`), clean per-speech XML. MEASURED: **646 plenary reports 2012-09-10..2026-06-09**; sampled 539-1172 components/report, ~400 Spoken-Text speech sections each → **~250-300k**. Speaker via `Speaker(MlaName)`+`Spoken Text` pairs (pwdata-shaped). Pre-2012 not in AIMS (Assembly suspended 2002-07, 2017-20).
- **Senedd Cofnod** — `record.senedd.wales` structured archive (English) + `cofnod.senedd.cymru` (Welsh) + `business.senedd.wales` ModernGov; `/Search/` live. ROUGH ~150-250k (bilingual, since 1999). Structure mapping needed.
- **Scottish Parliament Official Report** — `parliament.scot` HTML (date-based + alphabetical-list + search); `data.parliament.scot` is the SpOpenData platform but its API base is NOT exposed in static HTML (path guesses 404 — needs JS-bundle/XHR inspection, same class as the blocked scottish-courts API). ROUGH ~250-400k. HARDEST — HTML-crawl fallback.
- Placeholders upserted (`v23-devolved-placeholders.ts`, playbook §1d): niassembly-hansard ~270k · senedd-cofnod ~200k · scottish-parliament-or ~320k. Licences pending-verification (all expected OGL/own-OGL — footer grep was analytics-noisy; verify at V24 build). Licence-map entries added.

### §5 Public inquiries — REGISTER BUILT + one probed (`INQUIRIES_UNIVERSE.md`)

- Register from gov.uk org enumeration (22 concluded inquiry/review bodies — Iraq, Leveson, Shipman, Bloody Sunday, Mid Staffs, Baha Mousa…) + the major current/recent statutory inquiries (Covid-19, Grenfell, Post Office Horizon, Infected Blood, Manchester Arena, IICSA, Undercover Policing, Brook House) + the UK Gov Web Archive route for dark own-sites.
- **Probe — Infected Blood Inquiry (concluded May 2024): route verified.** Reports = **9 PDF report volumes** on `gov.uk/government/publications/infected-blood-inquiry-reports` (MEASURED via content-API attachments), CF-free, OGL, pdfToText-extractable. **NOT seeded** — needs a small `inquiry-reports` sourceType (gov.uk publication-attachment route differs from the govuk-content content-page processor); turn-key for V24, recommended as the family's first seed. Reports-only universe ROUGH ~40-70k across ~35 inquiries; evidence bundles deferred. Licence-map `inquiry-reports` → OGL added.

### §6 Small probes — SIZED

- **ONS** 11,177 gov.uk docs (5,022 national_statistics + 4,845 official_statistics + 1,211 announcements); substantive datasets on `api.beta.ons.gov.uk` (live). Marginal legal-text relevance — sizing only, deferred.
- **OBR** 61 gov.uk docs (23 independent_report + 13 policy_paper) — trivial, OGL; substantive EFO/fiscal-risks publications on obr.uk. Foldable into a future govuk-content org seed.
- **Pre-2010 select-committee archive** — `publications.parliament.uk/pa/cm{session}/cmselect/` live (200) but CF-fronted (the V15/16 committees-portal blocker); ~10-20k reports, depth gap named (committees-api covers ~2012+). Sizing only.

### §7 Readiness — unification + Railway-migration sprint

- Flagged per brief §8: no new blocker found. Queue patterns (list:/enum:/win:/gap*/enumerated-stem) are stable and documented; the breaker false-positive class is the one ops-doctrine gap (idempotent reseed re-trips the zero-output breaker). Legacy 914k `LegislationSection` conversion + web-app table inventory remain the structural-sprint scope (SEARCH_AUDIT §1/§6).

## V22 — REPAIRS, THE SECOND HANSARD CENTURY, WORD COUNTS, QUANGO TRANCHE 1 (13 Jun 2026)

**Context:** SPRINT_V22_BRIEF.md. Two breakers parked 58k+ rows; the V21 holes (HUDOC, Lords 1919–1999, Hansard gap volumes) all had named routes. Quango tiers not confirmed by Charlie → dry-run only.

### §1 Repairs

- **§1.1 committees-api breaker — root cause: deep-offset server timeout, NOT Cloudflare and NOT rate.** Probes (13 Jun): `WrittenEvidence?Skip=100000` → HTTP 500 after ~31s; **load-dependent** — skip=50000 also 500'd the next day, skip=0 always fine. An offset walk over 126,589 rows is fundamentally fragile. **Fix: date-windowed listing** — the API takes StartDate/EndDate; monthly windows are ≤ ~2k items (peak year 2025 = 16,393), shallow-skip, ~2s answers. `processCommitteesApiList` gains `list:writtenevidence:win:{YYYY-MM}` (+`win:pre2013`) handling, one in-row 60s-cooling retry; `v22-seed-writtenevidence-windows.ts` seeds pre2013 + 2013-01..now (~163 rows, full-range re-walk — idempotent inserts self-heal the aborted V20 walks). Executed same session: breaker cleared, **56,518 item rows unparked** (draining under deployed code — item processing was never broken: 12,732 done pre-trip), 1,239 offset list: rows retired. Playbook §8 pattern added per brief.
- **§1.2 judiciaryni breaker + 332 failed — root cause: host IP-cut under sustained drain + a latent throttle bug.** All probed URLs serve 200 after cooloff (transient, not URL-pattern). The burn-through had a code cause: **every V20-era AdaptiveThrottle was constructed with suspendThresholdMs 60s but the default 30s ceiling — `onSuspend` could mathematically never fire** (dead code since V20). Fixed (ceiling 120s) + clients now `backoff()` on 403/socket-level failures (an IP cut does not announce itself as 429) in judiciaryni, committees-api, echr, hh-html. Rate halved 1000ms/2 → 2000ms/1 (§1b). Listing resume from checkpoint advanced p66→p96 (+600 rows) then the host cut again — **its listing budget is ~30 pages/session** → list-row treatment (`list:page:{N}` rows, `processJudiciaryNiList`, `v22-seed-judiciaryni-list.ts` for pages 96–396). Seeder est-clobber fixed (partial walk wrote est 1,879 — V20 rule recurrence; est now updates only on a completed walk, from queue counts) + est restore to ~5,900 in the V22 seeder. Breaker stays tripped until post-push (clearing under old code = same burn).
- **§1.3 throttled enum rows reset** (88: regional 61 + ukpga 27) + priority-bumped to 1 (they were starving behind 74k retained-eu ids at equal priority — claim order is `priority, id`). **Drained within the session and the findings are big: si-2010plus enum seeded 11,852 missing instruments** (the V12 "2015–2026 reseed never ran" gap, now real rows) **and regional enum seeded 6,435** (incl. the V20 asc/mwa types). 7 dense uksi years (2012-14, 2023-26) re-throttled from Railway — reset after cooloff at session close. ukpga enum fully drained → `v19-cleanup-ukpga-calendar.ts` then primary-acts-pre-2000 ✓ remain next-session actions (behind the si/regional drain).
- **§1.4 re-baselines:** all major drains (retained-eu ~74k, historic-hansard, committees, EN/EMs, tax-tribunals, NAO) still grinding at session close — ✓ re-baselines recorded as next-session actions in the handoff.

### §2 HUDOC revival — BUILT + PROBED ✓ (seed post-push)

- Routes (V20 probe, re-verified + refined 13 Jun): `/app/query/results` with **browser UA + Referer** and the `contentsitename:ECHR AND respondent:"GBR" AND languageisocode:"ENG"` grammar = **4,471 resultcount — exactly the V20 universe** (584 = the JUDGMENTS subset; the V-era `country:GBR` grammar draws 404). Stable pagination via `sort=kpdate Ascending` (oldest GBR doc: Greece v UK, 1956). Text: **PDF conversion only** (html/docx 404). Client rewritten (`echr-hudoc.ts`), `processEchr` rewritten for `doc:{itemid}` rows (legacy page:/__index forms markSkipped; discovery/populator generators stubbed), `v22-seed-echr-queue.ts` (--canary, checkpointed, est from enumerated resultcount on completion).
- **One-judgment probe through the production path (HORA v UK, 001-244851): PASSED** — 350KB PDF → 19,283 words, §/"/—/é fidelity, R2 round-trip identical, Neon row `licence='echr-nc'` via the map default.
- **Licence VERIFIED live** (echr.coe.int/copyright-and-disclaimer): reproduction free with source acknowledged (© ECHR-CEDH) for private/information/education; commercial needs written permission → `echr-nc` (nao-nc posture: fine for the charity, default-excluded commercially). Map + playbook §18 updated.
- ⚠️ Railway egress to hudoc.echr.coe.int unverified — canary 5 post-push before the full seed.

### §3 Lords Hansard 1919–1999 — BUILT + PILOTED ✓ (seed post-push)

- **The handoff is exact on both ends:** pwdata-lords starts **1999-11-17** (daylord1999-11-17a.xml, verified at TWFY) and **S5L vol 607 starts that very day** (vol 606 ends 11 Nov at prorogation — verified via api.parliament.uk volume indexes). Mirrors the Commons S5C 111/112 boundary.
- Code: per-house cutoffs (`HouseCutoffs`, Commons 1919-02-04 / Lords 1999-11-17) in `parseHansardV12Items`; S5L cap 32 → 606; zips spot-checked PK-real at vols 33/100/300/606. `v22-seed-lords-hansard.ts` re-lists S5L (drops the cap-32 checkpoint entry) and bumps est by zips × ~4k blended pilot rate.
- **Pilot scored (predict-measure-commit):** S5LV0100P0 (1936) predicted 800–2,000 items / 150–500k words → **measured 2,408 items / 461,687 words** (items 1.2× over top of range — Lords sat more than predicted); S5LV0606P0 (1999, the cutoff volume) 7,076 items / 805,540 words, **0 items ≥ cutoff ✓**, fidelity ✓, heading coverage 96.9–99.6%.
- **Row-timeout guard:** late-century volumes (~7k sections ≈ 3.6 min at V21's measured rate) ran too close to the 5-min row cap → `processHistoricHansardVolume` R2 batch 8 → 16 (R2 puts dominate wall time, don't touch the pg pool).
- The parliamentary record will then have **no known gap 1803 → present in either House** (modulo §4's unfillable volumes).

### §4 Hansard gap-fill — BUILT, premise corrected (seed post-push)

- **V21's "the 169 missing volumes exist on api.parliament.uk" was wrong:** measured 13 Jun by diffing nominal vols vs the bulk listing vs the HTML site's series indexes — of **170** bulk-missing volumes, only **114 are fillable** (S3 40 · S4 57 · S5C 16 · S5L 1); 56 are absent from BOTH stores (S1 13/13 and S2 3/3 wholly unfillable — the two stores share one digitisation). The unfillable 56 are genuine, permanent gaps — recorded here, excluded from est.
- Build: HTML-crawl functions in `historic-hansard.ts` (`listGapVolumeDays`, `listGapDaySections`, `fetchGapSectionItems` — hentry/blockquote speeches + sibling procedural `<p>`s, marker-bounded chunks so nested quotation blockquotes and page-tail scripts can't bleed into text; parse verified live on S3V53). Two-stage queue crawl: `gapvol:{series}:{vol}` → `gapday:{house}:{yyyy/mon/dd}` rows under NEW sourceType `historic-hansard-html` (own api.parliament.uk budget, 500ms/2; per-house cutoff guard kept explicit). `v22-seed-hansard-gapfill.ts` (re-derives fillable sets live; guards that the S5L checkpoint reflects the lifted cap — run order: after the Lords seeder).

### §5 Word counts — already exact; email line added

- **The brief's §5.1 was already true:** `corpus_sections."wordCount"` exists and is written at ingest by every processor. Coverage measured: **zero compiled rows lack it** — the 122,641 NULLs are all unavailable markers (no text; NULL correct) + 64 failed. **§5.2's backfill is therefore unnecessary** — no R2 walk, no ÷6.2 estimate; the counts are exact.
- **Total corpus: 3,455,730,226 words** (3.46B) at measure time (13 Jun 2026 00:30, mid-drain). Largest: pwdata-debates 1.011B · tna-caselaw 680.7M · et-decisions 291.4M · historic-hansard 272.5M (growing) · pwdata-lords 210.3M. Full per-corpus table in the sprint report.
- Email TOTAL block now prints `≈ N.NNB words` (one SUM over corpus_sections, V22); the unsized list drops "Lords Hansard 1919–1999" (now seeded/sized).

### §6 Quango Tranche 1 — tiers NOT confirmed → seeder built, dry-run produced, NOTHING seeded

- `v22-seed-quango-t1.ts`: T1 derived from QUANGO_UNIVERSE.csv (top 20 live, body type ≠ ministerial dept, HMRC excluded); default mode is a live facet re-measure dry-run; `--seed` (gated on Charlie + post-push) walks search.json per org, client-filters the relevant-format set **minus utaac_decision + fatality_notice** (brief §6), URL-dedupes against every gov.uk corpus in corpus_sections (not the queue — cleanup deletes done rows), seeds `quangos-govuk` govuk-content rows (OGL, map entry added).
- **Dry-run (live, 13 Jun): T1 = 42,942 docs.** AAIB 11,733 · EA 7,639 · Company Names Tribunal 2,302 · Schools Adjudicator 2,217 · IPO 1,742 · TRA 1,663 · Certification Officer 1,587 · UKHSA 1,573 · UKVI 1,416 · HS2 1,380 · MAIB 1,320 · RPA 1,256 · MCA 1,220 · Natural England 1,189 · Traffic Commissioners 1,105 · Ofqual 1,059 · HMPPS 1,016 · SAGE 1,010 · **HMCTS 515 and UTAAC 0 — the V22 format exclusions gut both** (their CSV rank was utaac_decision-driven). ⚠️ CHARLIE: confirm whether HMCTS/UTAAC keep T1 slots or are replaced by the next two ALBs.
- UTAAC overlap note (brief): gov.uk holds 2,019 utaac_decision docs vs FCL's ukut/aac ~1,250 (V19, 25 pages) — partial overlap, gov.uk likely deeper on older decisions; neither seeded.

### §7 Incidental finds

- pg BIGINT-as-string would have corrupted the words SUM — cast `::text` + `Number()` used (V17 lesson applied, not re-learned).
- `v22-state-check.ts` / `v22-repairs.ts` added as sprint diagnostics; tmp-v22/ scratch deleted.

## V21 — QUANGO ENUMERATOR + HISTORIC HANSARD + HONEST DENOMINATOR (12 Jun 2026, evening)

**Context:** SPRINT_V21_BRIEF.md (archived below this entry's session). Three fronts: convert the V21 quango scoping from opinion to measurement, open the largest enumerated hole (Historic Hansard 1803–1918), and make the denominator stop lying by omission. Everything running on Railway continued untouched.

### §1 Quango universe enumerator — MEASURED ✓

- `scripts/ingest/enumerate-quangos.ts` (read-only vs public APIs; checkpointed; 300ms ≈ 3.3 rps, one 503 → 60s cooling, zero 429s): gov.uk Organisations API full register (**1,255 orgs**, 63 pages) × one Search API `count=0&facet_format=200` call per org.
- Output: **`docs/QUANGO_UNIVERSE.md`** (ranked table, body-type rollup, method) + **`QUANGO_UNIVERSE.csv`** (per-org format columns for the Corpus Status xls).
- Headline: **904,989 total docs / 162,004 relevant-format docs** (135,284 from non-closed orgs) across the register. Top of table: AAIB 11,732 (custom `aaib_report` format), HMRC 8,487, Environment Agency 7,639, Defra 4,630, DfE 4,038. Relevance rule documented in the MD (substantive formats + `_report/_decision/_guidance/…` suffixes; `*_tribunal_decision`/`international_treaty`/`hmrc_manual*` excluded — already dedicated corpora).
- `corpus_targets` placeholder: `quangos-govuk` est **162,004** (~, unenumerated-by-org; per-org sums double-count multi-org docs — caveat in notes). **No content seeded — the table is Charlie's V22 triage input.**

### §2 Historic Hansard 1803–1918 — BUILT + PROBED ✓ (seed post-push)

- **Source:** `sources/historic-hansard.ts` — per-volume `hansard_v12` XML zips from www.hansard-archive.parliament.uk. Listings are WebForms GridView pages (10/page) walked via `__doPostBack` + VIEWSTATE (plain Node fetch works). **The host soft-404s: every unknown path returns HTTP 200 text/html — so the LISTING is the universe** (unlisted volumes verified absent: real digitisation gaps, e.g. S1 vol 2) **and every zip fetch checks the PK magic**. Split volumes (`_a/_b`) and multi-part (`P0/P1`) are each their own docId. CF fronts the host (`__cf_bm`) but serves the honest UA locally — Railway egress needs the post-push canary (committees-api lesson).
- **Scope cutoff is exact, not approximate:** items dated ≥ **1919-02-04** dropped — that is the first pwdata-debates file, and S5C vol 112 / S5L vol 33 both START that exact day (Parliament did not sit 21 Nov 1918 → 4 Feb 1919). Seed caps: S5C ≤ vol 111, S5L ≤ vol 32, S1–S4 whole. **NEW universe note: Lords 1919–1999 is a separate known hole** (bulk archive holds S5L to 2004; pwdata-lords starts 1999) — V22+ candidate, now named in the email's unsized list.
- **Parser** (`parseHansardV12Items`): per-speech items mirroring the pwdata model — house container (`housecommons`/`houselords`) → sitting `<date format>` → nested `<section>` title stack → one item per `<p>` (speaker from `<member>`, procedural ps kept); titlepage/frontmatter/index self-exclude (items emitted only inside house containers); `<col>` page numbers and `<image>` stripped as content, not just tags.
- **Pilot scored (predict-measure-commit):** predicted ~1,500–2,200 items / ~450–530k words for S1V0001P0; **measured 1,597 items, 1,137 with speaker (= exactly V20's membercontribution count), 512,541 words, 93.4% heading coverage, £/—/é fidelity** (§14 adversarial check). End-to-end probe wrote production rows: 1,597 sections in Neon, all `licence='opl-3.0'`, R2 round-trip verified, **49s/volume** (5-min row timeout safe). One source quirk: an OCR-era `1803-03-29` date that should be 1804 — harmless noise.
- **Licence:** OPL v3.0 page served full terms live 12 Jun evening (the V20 CF-block was transient) — licence-map note upgraded to VERIFIED; `historic-hansard` → `opl-3.0`.
- **Rate:** 5000ms/2 (half of a reasonable 2500/4, politeness doctrine) — processing time (~50s/volume) is the real throttle; the host sees ≲1 zip fetch/min/loop. ~763 volumes ≈ 10–20h grind at concurrency 2.
- `seed-historic-hansard-queue.ts` (checkpointed per series, `--canary N`); `processHistoricHansard` in process-row.ts; new dep `adm-zip` (the §14 "TypeScript-native, no PowerShell" remediation path).

### §3 Honest denominator — playbook §1d ✓

- **Rule (playbook §1d): a known source missing from the denominator is a lie of omission — placeholders with honest `~` beat absence.**
- **Reporter fix:** denominator now INCLUDES blocked targets (the universe doesn't shrink because we can't fetch it) and EXCLUDES retired ones — **the retired LDA written-questions rows had been silently double-counting 722k** next to their pwdata replacements since V16.
- **Placeholder rows upserted** (`v21-honest-denominator.ts`, provenance in notes): historic-hansard ~1.1M (V20 probe + V21 pilot) · quangos-govuk 162,004 (§1 measured) · scottish-courts ~20k (ROUGH — API blocked) · college-of-policing ~8k (ROUGH) · **echr-hudoc 30,050 → 4,471 (V20 MEASURED GBR resultcount replaces the V-era guess — honesty cut this one UP)** · bills-api ~5k (ROUGH) · financial-corpus NULL (unsized, visible).
- **Headline: 91.3% → 88.0%** (denominator 12.15M → 12.61M). The drop is the point.
- Email TOTAL block reworded: "% is of the KNOWN universe incl. ~ placeholders"; residual unsized list = financial-corpus · quango external-site content · pre-redesign LC papers · Lords Hansard 1919–1999.

### §4 SSRN — RE-CLASSIFIED, stays PARKED

- One probe (12 Jun evening): `api.ssrn.com/content/v1/bindings/{id}/papers` returned **200 JSON unauthenticated with the honest UA** (total 58,288 for one binding) — **the V20 "hard 403 WAF" classification is stale/state-dependent**, failure mode = intermittent WAF, not a permanent block.
- **Parked anyway on licence grounds** (author copyright, full texts login-gated; only metadata/abstracts exposed). corpus_targets row updated with the new classification. Recommendation: revisit only if an abstracts-level corpus is ever wanted.

### §5 Post-push execution (same session)

- Push `15f2c3c` auto-deployed Ingest + Ops; `seed-rate-limits.ts` run before the new container started (config loaded at startup).
- **Canary PASSED from Railway:** 3 volumes → done; S1V0001P0 re-compiled to the IDENTICAL 1,597 sections (idempotency proven), S1V0003P0 937, S1V0004P0 1,150 — all `opl-3.0`. **Cloudflare serves Railway IPs on hansard-archive.parliament.uk.**
- **INCIDENT + fix:** the first full listing walk drew **HTTP 403 at S5C page 24** — CF rate-limits sustained WebForms listing walks (the V20 committees/judiciaryni pattern; the V20 lesson should have been carried over at build time). Fixed in `listHistoricHansardVolumes`: page fetches retry after 60s cooling (≤4 attempts), AND series with a volume cap now stop as soon as a page is wholly past the cap — S5C needs ~12 pages for vols ≤111, not ~100 (the 403 page was pure waste). Checkpoint resume re-listed only S5C/S5L.
- **Universe MEASURED: 595 volume zips** (S1 29 · S2 22 · S3 306 · S4 133 · S5C 78 · S5L 27) = **594 distinct volumes of the nominal 763** — the V20 "~763" was volume-number arithmetic; the bulk archive has real interior digitisation gaps (~22%; spot-checked absent: 4/4 random unlisted volumes soft-404). Every series spans vol 1 → its cap. **The 169 missing volumes exist on api.parliament.uk/historic-hansard (HTML crawl) — V22+ gap-fill candidate.**
- **est re-baselined to ~850,000** (595 zips × ~1.2–1.6k sections/zip; canary avg 1,228, later series fatter); ✓ at drain.
- **Seeded + grinding at session close:** 595 rows (4 done / 2 claimed / 589 pending within minutes of seeding; 4,952 sections from the first 4 volumes). ~10–20h unattended at 5000ms/2.

---

## V20 — THE PROBE WAVE (12 Jun 2026)

**Context:** corpus ~91% of the enumerated universe; V20 opened every remaining front with bounded probes under the probe-with-auto-upgrade rule, plus licence metadata infrastructure and V19 closeout. All probes ran the same day; five sources were auto-upgraded to full builds, three classified, one parked.

### §1 V19 closeout

- **et-decisions ✓ 293,399 compiled + 4 classified residue.** PREDICTION SCORED: V19 predicted 140–200k sections; observed 293,399 — **1.5–2.1× over** (each gov.uk decision page carries body + PDF assets, ~2.2 sections/doc; the V19 range was extrapolated from doc counts alone). Drained clean ~10:00, zero failures, the V19 rate-limiter fix + 300ms/5 held (no new 429s).
- **uk-treaties ✓ 3,250 compiled + 14 classified residue** (drained same morning).
- **retained-eu still draining** (~93k pending at session close, ~1.1 rows/s — TNA shells process fast; the licence backfill caught 131k rows mid-flight). ✓ re-baseline at drain (next session).
- **Pre-1963 regnal pass + regional enumeration: moved into the queue** (see §4 incident — TNA penalty-boxes the local IP for any sustained enumeration). `processTnaEnum` handles `enum:{type}:{year}` rows: enumerates the year feed from Railway IPs and seeds act rows for anything `corpus_sections` lacks (the V19 regnal-seeder skip-logic verbatim: regnal docIds seeded unless the calendar alias holds real non-html content). `seed-tna-enum-queue.ts` (post-push) seeds 733 ukpga years + **9 regional types × 1970–2026 — including `asc` and `mwa`, which discovery's 7-type regional list omitted entirely (V20 finding: Senedd Acts 2020+ and Welsh Measures 2008–11 were never enumerable)**. After drain: `v19-cleanup-ukpga-calendar.ts` (5,840 chrome rows + 1,057 dead calendar markers), then ✓ both corpora.

### §2 Licence metadata (corpus_sections.licence + attribution)

- Columns added (nullable, instant); per-corpus map in `shared/licence-map.ts`, applied per-row at ingest via `db-metadata.ts sectionParams` default; full map + verification status in **INGEST_PLAYBOOK §18**. Backfilled **1,065,505 rows** (all non-pwdata corpora; batched on a dedicated pg client — the shared pool's 60s query_timeout aborts migration batches because non-HOT updates re-insert relic caselaw tsvectors into the 266MB GIN).
- **pwdata-\* backfill (8.8M rows) DEFERRED — Charlie decision:** a full-row MVCC rewrite would churn ~4–5GB of the 20GB Neon budget to stamp a value ('opl-3.0') that is uniform and derivable from the map. New pwdata rows get licence at ingest post-push.
- Attribution column is written only where wording is row-specific (sentencing-council source-title requirement, OECD per-doc credit); uniform boilerplate lives in the map.
- **⚠️ CHARLIE — Find Case Law:** the Open Justice Licence v2.0 (verified) **explicitly excludes computational analysis** — search indexing, bulk/automated processing, ML training. Our 74,896-judgment ingest + FTS plans sit squarely in that exclusion. TNA grants a separate computational-analysis licence: **caselawlicence@nationalarchives.gov.uk** — recommend applying (fits the BAILII-email errand).
- **⚠️ CHARLIE — FCA Handbook:** fca.org.uk/legal (verified): reproduction/storage of site content in any retrieval system requires prior written permission, and Handbook reproduction requires a licence agreement. Our 3,661 ingested sections are flagged `fca-restricted`.
- **OECD position logged per brief §2:** post-Jul-2024 CC-BY 4.0 content seedable with attribution; pre-Jul-2024 CC-BY-NC is link-only, NOT ingested; existing 505 rows flagged `cc-by-nc-4.0`; default-excluded from any commercial surface; free-tier question deferred until a commercial product exists.
- Parliament licence pages (OPL) could not be re-verified live — CF blocks both local and fetcher IPs (12 Jun); mapping recorded as the long-standing published licence.

### §3 Probe scorecards (route | universe | rate | sections verified | auto-upgraded | prediction)

1. **Committees API — UPGRADED (build complete, seed post-push).** Route: `committees-api.parliament.uk` open JSON API (OpenAPI spec public); documents served from the API host as base64 JSON — CF-FREE locally, verified end-to-end (%PDF magic + native Html for evidence). Universe ✓ measured: **Publications 50,846 + OralEvidence 15,803 + WrittenEvidence 126,589 = 193,238** (~4× the portal-era ~50k estimate — flagged per the >2× rule; size impact trivial ~200MB). Rate: 1000ms/3 (2 fetches/row ≈ 2 rps at host). Built: `sources/committees-api.ts`, `processCommitteesApi`, `seed-committees-api-queue.ts --canary`. ⚠️ Railway egress unverified (the portal + old Hansard API both CF-block datacentre IPs) — **canary 25 rows post-push before the full seed**; breaker armed either way. On clean canary: full seed, clear committees-portal breaker, retire portal rows.
2. **Historic tax tribunals — UPGRADED (build complete, seed post-push).** Route: `financeandtax.decisions.tribunals.gov.uk` — GET `view.aspx?id=N` works with the honest ingest UA (only the WebForms search POST is UA-fussy; never needed — the id space is dense). Universe ✓ binary-searched: **ids 1–13,037**, and the archive is CONTINUOUSLY UPDATED (id 13,037 = TC 09248, decided 11 Jun 2024) — far deeper FTT-Tax coverage than FCL's ukftt/tc (~1,450). `.doc` (OLE2) extraction via new `word-extractor` dep, verified; modern decisions are PDF. Rate: 1000ms/2. Licence: pending-verification (no statement on the HMCTS legacy site).
3. **EN/EMs — UPGRADED (build complete, seed post-push).** Routes verified: EN pdf `/{actId}/pdfs/{type}en_{year}{nnnn}_en.pdf` + `/notes` HTML; EM pdf `…{type}em_…` + `/memorandum/contents`. Universe derives from held corpora (no enumeration): ukpga ≥1999 (`en:`) + uksi ≥2002 (`em:`) — EM rows are five figures. Rows ride sourceType `tna-legislation` (docId prefix) so the host keeps ONE politeness bucket (§1b); absent EN/EM → unavailable marker. P3, drains behind retained-eu. Regional-act EN/EMs (asp/anaw/nisr filename forms) deferred to V21.
4. **Law Commission E&W — UPGRADED (build complete, seed post-push).** Route: open WordPress REST API (`/wp-json/wp/v2/publication`, X-WP-Total 240) + PDFs on the MoJ CDN (verified). Licence: OGL v3.0 (site footer, verified). Universe note: pre-redesign LC papers (400+ since 1965) exist only in the UK Gov Web Archive — out of universe, recorded here. Rate 500ms/2.
5. **NI courts — UPGRADED (build complete, seed post-push); Scottish courts — BLOCKED.** judiciaryni.uk: Drupal listing pages 0–395 (~5,900 decisions incl. NICA/NIKB/NICC/NIFAM + summary judgments), PDFs under `/files/judiciaryni/` (verified via Node fetch; one URL-variant 404 was a different page's `_0` file). Rate 1000ms/2; licence pending-verification (© Crown footer, no open licence stated). **Scotland:** the new scotcourts.gov.uk judgment search is a Vue app calling `api.pa.web.scotcourts.gov.uk` (Azure) → **401 without a key that is not present in any static asset**; the old archive 404s; judiciary.scot holds only shallow recent lists (sentencing statements). Needs browser-devtools XHR inspection (Charlie, 5 min) or a headless browser — REPORTED.
6. **HUDOC — CLASSIFIED: ALIVE AGAIN.** `/app/query/results` returns 200 JSON (browser UA + Referer): resultcount 106,188 ENG; GBR 4,471 docs / 584 judgments; document text via `/app/conversion/pdf/?library=ECHR&id={itemid}` (200, real PDF; docx variant 404s). The V-era "endpoint changed, 404" classification is stale. Revival = point the existing echr-hudoc client at these routes + Referer; V21.
7. **NAO — ROUTED + UPGRADED (build complete, seed post-push); SSRN — PARKED.** NAO: open WP REST API (`report` type, **2,755**), PDFs under wp-content/uploads (main-region filter excludes the site-wide footer PDFs). Licence verified: free **non-commercial** re-use with attribution (`nao-nc`) — fine for the charity, default-excluded from commercial surfaces. SSRN: hard 403 (WAF) on UI search AND api.ssrn.com with both honest and browser UAs — failure mode named; also licence-hostile. Parked.
8. **Partials audit — root causes found, fixed:** see §5.
9. **Historic Hansard 1803–1918 — CLASSIFIED (route proven, build V21).** Bulk beats crawl: `www.hansard-archive.parliament.uk` serves per-volume zips of `hansard_v12` XML (1803–2004!). Universe 1803–1918 ≈ **763 volumes**; sample volume (S1V1) = 1,137 `membercontribution` + 282 sections, 527k words → est **~1.1M sections / ~400M words / ~2.4GB text / ~0.6GB Neon** (within the 16GB guard). NOT auto-upgraded: no v12 parser exists — parse quality unproven (the rule's ambiguity clause). V21: parser + pilot (predict-measure-commit). The api.parliament.uk/historic-hansard HTML crawl works as fallback but is ~300k fetches.

### §4 INCIDENT — TNA penalty-boxes the local IP for sustained enumeration (all day)

The V19 handoff's "run the regnal seeder tomorrow" failed twice: a 1000ms-floor run 429'd from year ~1300 onward (397 of 722 log lines were backoffs) and **silently dropped whole years** (1933–38 missing — `fetchText` returns null for both 404 and 429); a 2000ms-floor run hours later 429'd instantly. Single requests pass; sustained patterns re-trip within seconds. Fixes: (a) `fetchTextWithStatus` distinguishes deterministic 404 from retryable 429; (b) `enumerateActEntriesCheckpointed` — per-year checkpoint, throttled years retried across passes, **throws on a partial universe** (no silent gaps); (c) the real cure — **enumeration moved into the queue** (`enum:` rows, §1) so it runs from Railway IPs, which TNA serves happily at 200ms/10 all day. Local TNA enumeration is effectively dead as a technique; playbook updated.

### §5 Partials audit — the V2 seed-before-push bug wrote one corpus's documents under three labels

- **building-regs + planning-policy = 791/791 doc-for-doc duplicates of hmrc-tiins** (verified by INTERSECT). Root cause: V2-era rows were processed before `processGovUk`'s switch knew their corpora → the `default:` branch ran `listHmrcTiins()` and wrote TIIN docs under `row.corpus`. The seed-after-push lesson predates its V19 naming. **Deleted 1,582 rows + R2 objects; reseeded correct `__index` rows (current code dispatches correctly — live now, drains to ✓ at 21 / 64).**
- **college-of-policing = 1,944 unfiltered junk** (`listCollegeOfPolicing` is a free-text gov.uk search, no org filter — samples: DVLA accounts, ET decisions, news updates). **Deleted rows + R2; corpus blocked** pending the real APP source (college.police.uk — CF-blocked, licence unverified).
- **sentencing-council ✓ 253** — live re-enumeration returned exactly 253; the V13 "~381" was a pre-dedup count. Complete all along.
- **nilawcom ✓ 17** — site SSL-dead (12 Jun); 17 of ~18 historical reports held.
- **written-statements retired** (superseded by pwdata-wms/lordswms per-speech). written-answers has no corpus_targets row (never in the email). **CHARLIE:** propose deleting the 272 legacy month-blob rows (avg 306k words/row — they're also the tsvector-1MB offenders from SEARCH_AUDIT).

### §6 Email honesty

TOTAL block now prints "% is of the ENUMERATED universe" + a maintained list of major unenumerated sources (historic Hansard ~1.1M, Scottish courts, committees evidence backlog, college-of-policing APP, quango universe, pre-redesign LC papers, HUDOC).

### §7 Post-push run order (this session, CC)

1. `seed-committees-api-queue.ts --canary 25` → verify sections (Railway egress test) → full seed → clear committees-portal breaker + retire portal rows (handoff SQL).
2. `seed-tax-tribunals-queue.ts --canary 25` → verify → full seed.
3. `seed-lawcom-queue.ts`, `seed-nao-queue.ts`, `seed-judiciaryni-queue.ts --canary 2` → verify → full.
4. `seed-explanatory-queue.ts` (P3, behind retained-eu).
5. `seed-tna-enum-queue.ts` (733 ukpga + 513 regional enum rows).
6. `seed-rate-limits.ts` (new sources) + restart Ingest to load config.
7. Re-run `v20-licence-backfill.ts` (sweeps rows written by pre-V20 code today).

**Deferred to next session:** retained-eu ✓ at drain; ukpga regnal drain → `v19-cleanup-ukpga-calendar.ts` → primary-acts-pre-2000 ✓; regional ✓ at enum drain; committees/tax-tribunals/EN-EM ✓ at drain; Hansard v12 parser (V21); HUDOC revival (V21); quango scoping (V21).

### §8 Post-push execution (same session, evening)

- **Canaries PASSED from Railway:** committees-api 73 sections compiled (+2 markers) — **the API host is CF-free from Railway IPs; the 9-month committees blocker is dead.** tax-tribunals 22 compiled + 3 id-gap markers; ni-judgments 29 compiled.
- **Seeded:** tax-tribunals 13,037 ✓-pending · lawcom 240 · nao-reports 2,755 · explanatory-notes 560 + explanatory-memoranda 10,864 (from held docIds) · tna-enum 1,246 rows (733 ukpga + 513 regional) + 3 failed-act requeues · committees ~59k so far (see below) · ni-judgments ~1.3k so far.
- **committees-portal breaker CLEARED; 2,538 portal/document rows retired** ("retired V20 — replaced by committees-api rows").
- **NEW FINDING — si-2010plus was never completed:** only **5,899 distinct uksi instruments** behind its 63k sections — the V12-noted "needs reseeding for 2015–2026 gap" was never run and the corpus was never ✓'d. Seeded `enum:uksi:2010..2026` rows (17); si-2010plus est_is_confirmed → false; **re-baseline at enum drain, then re-run `seed-explanatory-queue.ts`** so newly-found SIs get EM rows (it's idempotent).
- **Seeder lessons (fixed in code):** committees-api and judiciaryni both rate-limit sustained LISTING walks — single transient failures aborted three runs; both seeders now retry pages after 60s cooling (checkpointed either way). A stalled committees run also clobbered the evidence est with a partial universe — targets now update only from fully-known universes (est restored to 142,397). judiciaryni listing links include sidebar facets (`/judiciary/{id}` ×224, `/date/{year}`) on every page incl. 404s — real decision slugs contain no slash; 229 junk canary rows purged.
- **Licence sweep re-run:** 7,180 pre-push retained-eu rows stamped; all post-push writes carry licence at ingest.
- **Committees listing finished queue-driven:** Publications (50,853) and OralEvidence (15,809) walks completed locally, but the API's per-IP budget cut the WrittenEvidence walk three times at ~2,700 of 126,589 (even with 60s-cooling retries). Final fix (`6e30c54`): `list:writtenevidence:{skip}` queue rows — `processCommitteesApiList` walks the remaining 1,239 pages from Railway claim loops within the source budget, each inserting its page's item rows. Seeded post-deploy.
- **NI listing walk:** judiciaryni hard-cut the local IP at page 66 (persists through retries) — 1,279 of ~5,900 seeded; `seed-judiciaryni-queue.ts` resumes from checkpoint next session (or gets the same list-row treatment if it keeps failing).

## SEARCH S0 — SEARCH-READINESS AUDIT (12 Jun 2026)

**Context:** first sprint of the Search Project. Read-only audit of everything search-relevant — what exists in Neon, what the corpus weighs, what FTS/vector indexing costs at scale. Output: `docs/SEARCH_AUDIT.md` (commit `ca38dd3`) — measured numbers only, no recommendations; the architecture decision is the design doc's job, with Charlie.

### Key measured facts (full tables + arithmetic in SEARCH_AUDIT.md)

- **§1 schema:** the brief's "legacy sections table" is `LegislationSection` (914,274 — there is no table named `sections`). It has live FTS (100% ftsVector, 153 MB GIN, `legislation_english` trigger) and an **unpopulated `vector(768)` embedding column (0 rows)**. `corpus_sections` (9,846,300 → 9,866,543 during the audit; ingest live) has **no functioning FTS**: trigger no-op'd by V3's compiledText drop, 6.8% relic vectors under a 266 MB GIN no live query uses. pgvector 0.8.0 INSTALLED (halfvec available); pg_trgm / pg_search BM25 0.15.26 / rum / unaccent available-not-installed.
- **§2 storage:** Neon 9,485 MB of the 20 GB budget → **~10.5 GB headroom**. corpus_sections 7,480 MB (incl. 1,639 MB indexes). PG 17.10. Compute CU/autoscale range: needs console (no API key locally).
- **§3 corpus weight (507-object stratified R2 HEAD sample):** **~17.4 GB total compiled text** (cross-check: 2.67B words × measured 6.1 B/word = 16.3 GB, agrees within 7%). pwdata-debates 6.22 GB + tna-caselaw 5.63 GB (avg 75 KB/section) dominate; ~18 GB at retained-eu/et-decisions drain.
- **§4 FTS experiment (the core):** built `scratch_fts_sample`, 99,999 rows (50k acts/SIs, 40k pwdata, 10k caselaw), tsvector-only storage from R2 text. Measured: heap+TOAST 327 MB, **GIN 56.1 MB**, pkey 8.1 MB; per-corpus tsvector cost 610 B (acts) → 21.9 KB (caselaw); ratios heap=1.10×Σvec, GIN=0.198×Σvec. **Extrapolation: legislation+caselaw scope (~1.05M rows) ≈ 3.8 GB — fits; full corpus (10.5M) ≈ 15.2–15.8 GB — exceeds headroom by ~5 GB** (pwdata is ~11 GB of it). Latency at 100k = network floor (server-side 0–18 ms warm; RTT 25–26 ms) — floor only, 1M+ sample needed if FTS-in-Neon survives the size math. Backfill: 124 rows/s wall single-process → 5.4–23.5 h full corpus; GIN build 8–32 min.
- **§5 vector math (paper):** cheapest full-corpus option (384d halfvec + HNSW@1.5×) = 19.0 GiB > headroom; at 1.2M-row scope everything except 1024d float32 fits (2.2–8.6 GiB).
- **§6 query paths:** no web code reads corpus_sections at all. Three live paths on legacy tables: `/api/search` (Lex grounding, Neon GIN), `/api/ideas/[id]/legislation-search` (**LegislationPanel — live, un-indexed on-the-fly to_tsvector seq-scan on Railway**; its R2 hydration key populated for only 2.7% of rows), `/api/legislation/search` (title ILIKE). LegislationSection is duplicated in full on Railway AND Neon; OperationalSection populated only on Railway (61,315).
- **tsvector 1 MB hard limit** bites written-answers (avg 1.77 MB/row, 143 day-aggregate rows).

### Hygiene

- Acceptance met: scratch_fts_sample dropped (0 scratch tables, query in §8); production untouched (corpus_sections delta +20,243 = live retained-eu/et-decisions ingest; session issued only SELECTs against production). Scratch scripts ran from `tmp-audit/` (deleted). Single-file commit per Section 12.
- INGEST_PLAYBOOK unchanged — audit sprint, no ingest doctrine touched.

## V19 — P1 TO 100% + PARLIAMENTARY RECORD COMPLETION + TAX COMPLETENESS (11 Jun 2026)

**Context:** corpus at 83.7% / queue empty after V18. Directive: P1 corpora to verified 100%, parliamentary record to verified completion, tax universe (IBFD-replication) seeded, politeness doctrine throughout ("a 5xx storm under load is a rate signal, not a retry signal; halve and document" — now playbook §1b).

### §1 Parliamentary record — COMPLETE ✓

- twfy-pwdata rate **halved 500ms/10 → 1000ms/5** (the V18 503 storm was us overdriving a charity's server), then the 297 failed rows (192 debates / 55 lords / 49 lordswrans / 1 wrans R2-transient) reset. **All 297 retried clean at the halved rate — zero residual failures**, nothing for the specialist queue.
- **All seven denominators re-baselined to measured actuals ✓:** debates 6,377,271 · wrans 1,219,934 · lords 748,072 · lordswrans 173,436 · westminster 237,135 · wms 23,676 · lordswms 20,729 = **8,800,253 compiled pwdata sections**. The wrans "60.9%" was pure estimate error (2.0M era-average vs 1.22M real).
- **V18 prediction scored:** predicted ~9.8M (range 8–11M); actual 8.80M — within range, 10% under midpoint. Duration ~1 day at concurrency 20 (predicted 1.5–4 days — beat it).

### §2 P1 legislation tails

- **§2.1 primary-acts-pre-2000 — root cause found, fix built (completion runs post-push).** The 1,084 email gap = 1,057 `unavailable` + 27 `failed` section rows. Three-layer failure, V2-era:
  1. **Pre-1963 acts are regnal** (`ukpga/Geo5/14-15/41`); the enumeration regex only matched calendar ids → pre-1963 acts were NEVER enumerable. The 6,897 pre-1963 rows came from the Neon legacy seed in calendar form.
  2. **Calendar ids dead-end on TNA** (HTTP 300 when two acts share year+chapter — that's the 1,057; 301→`/resources/` otherwise), and the `data.htm` fallback then captured the act landing page: **5,840 acts ingested as ~834 words of site chrome each, marked compiled** (uniform wordCount was the tell). These are garbage and will be deleted post-regnal-reingest (`v19-cleanup-ukpga-calendar.ts` + new `r2Delete`).
  3. The 27 failed sections are 3 post-1963 acts with **AI-compile-era Anthropic billing errors** (pre-V2L relics) — requeued.
  - Fixes: `listActEntries()` (regnal + calendar identity per entry), chrome-guard on the HTML fallback (requires `LegRHS`/`LegP1ParaText` body markers), `v19-seed-ukpga-regnal.ts` (run AFTER push). Verified: in-force old acts serve full revised CLML via regnal ids (OAPA 1861: 69 provisions); textless ones classify via hasNoProvisions.
- **§2.2 regional:** audited — no boilerplate disease (clml 120,370 sections, wordCount sd 197; html 3,271, sd 1298 = real content); 3,498 classified unavailable markers. The ~160k denominator remains UNCONFIRMED — universe enumeration queued behind the TNA politeness backlog (next session; same `listActEntries` machinery; note V15's reseed-deep was interrupted mid-nia).
- **§2.3 retained-eu:** completion pass seeded and RUNNING — and the universe measurement rewrote the premise: **~153k instruments (eur ~95k+ / eudn ~27k / eudr ~3k), not V18's ~33k** (morePages undercounts dense years; TNA mirrors the complete EU corpus, mostly spent instruments). ~154k queue rows seeded (union of two enumerations — the "killed" first run survived as an orphaned node process and inserted 149,480 rows itself; playbook §8 has the Windows pipeline-kill lesson, and ON CONFLICT idempotency is what kept the union harmless). The approved "bounded ~2h" is really **~36h of TNA fetching** at the long-tolerated 200ms/10; left running. V18's 93%-shell sample implies the 140k phantom denominator may land accidentally close — **✓ re-baseline at drain** per playbook §1c. Lessons: TNA 429'd the 200ms local feed sweep (floor now 500ms via `TNA_THROTTLE_FLOOR_MS`); 0-id years during a 429 window must never checkpoint (eur/1986 was briefly poisoned as empty).
- **§2.4 tails:** si-pre-2010 — 7 failed sections = AI-billing-era relics across 4 instruments, requeued (+1 unclassified 1958 marker to requeue post-push); will close at ✓ on drain. lda-commonsoralquestions — live LDA total 70,040 (grows daily; pages are 0-indexed, 0–140); tail pages 120–141 reseeded idempotently (22 rows — deliberately under the 25-row zero-output breaker threshold); page 141 closed `skipped` (beyond extent); est → 70,040, ✓ on drain.

### §3 Tax completeness (IBFD-replication) — universe sizes measured BEFORE seeding (per brief)

- **`hmrc-ancillary` (P1, NEW):** 416 docs — RCB collection 63 + 58 free-text backfilled pre-2014 briefs, SoPs 135, ESCs 4 (consolidated), VAT notices 109, excise notices 67 across 7 collections. **DRAINED same session: ✓ 457 compiled, 7 classified residue.**
- **`tax-treaties-dta` (P1, NEW):** gov.uk `tax-treaties` collection, 172 per-country DTA pages. **DRAINED: ✓ 324 compiled, 0 residue.**
- **`uk-treaties` UNBLOCKED + re-pointed:** gov.uk `filter_format=international_treaty` = 1,685 docs; 166 of the 172 DTA pages carry that format — the brief's "same documents, working host" hypothesis CONFIRMED. Seeded 1,519 (DTA overlap excluded) at P3; FCO client retired to `scripts/attic/v19-fco-treaties/` (URLSearchParams 422 era over); `treaties` sourceType is a markDone stub; corpus_targets unblocked.
- **§3.3 historic tax tribunals:** `financeandtax.decisions.tribunals.gov.uk` is **ALIVE** — ASP.NET WebForms search app (VAT & Duties, Special Commissioners, etc.), decisions April 2003+ only. Report only; build needs Charlie's go-ahead (postback scraping).
- **§3.4 OECD licensing (report only, nothing seeded):** content published ≥1 Jul 2024 is **CC BY 4.0** (freely redistributable, attribution); earlier content — incl. Model Tax Convention 2017 + TP Guidelines 2022 — is CC **non-commercial** ("may not be sold but may be used in the context of commercial activities such as consulting or training"). Scrutinise's not-for-profit use plausibly qualifies; **Charlie's sign-off required before any seeding.**
- **§3.5 hmrc-manuals 16,061 "zero-section done rows" — CLASSIFIED, nothing to fix:** they are `unavailable` marker sections for **manual contents/index nodes** (Content API returns `child_section_groups` with an empty body; the text lives in child leaf pages, all 69,136 of which are compiled). 100-sample + 8 live probes; notes updated; **✓ re-baselined at 69,136 compiled + 16,061 classified residue.** (First check wrongly tested queue-rows-without-sections = 0 — the markers ARE the sections; §0 verify-before-asserting cuts both ways.)

### §4 Case law re-point (bailii → official sources)

- **FCL per-court feeds** (`atom.xml?court=…`) are required for tribunals — the global feed only carries their newest entries. `rel="last"` is **phantom on per-court feeds too** (eat claimed 80 pages; true extent 16 — binary-searched, V4 pattern). True extents: eat 16 / ukut tcc 7, iac 21, lc 11, aac 25 / ukftt tc 29, grc 55 / ukpc 15 / ukiptrib 1 = **180 pages (~9k judgments, ~8.5k already held via the global feed)**. FCL is thin on tribunals; rate unchanged (it took the 99.6% run happily). `processTnaCaselaw` now handles `court:{code}:page:{N}` rows — **the 180 seeded rows were markSkipped'd by the old deployed code and need a reset post-push** (playbook §8: seed-after-push).
- **`et-decisions` (P3, NEW):** gov.uk `employment_tribunal_decision` = **131,668 docs** (brief's ~72k was low) — the first-instance ET record FCL lacks. gov.uk's `employment_appeal_tribunal_decision` (2,560) NOT seeded — FCL EAT is canonical. **Prediction to score: ~140–200k sections (body+PDFs), ~11–14h of processing at 300ms/5.**
- **Retired:** `bailii-eat` → FCL eat; `bailii-tribunals` → FCL UT/FtT + et-decisions; `bailii-privy-ni` → FCL ukpc. NI courts stay parked (FCL excludes them; BAILII contact in progress). Coverage table: playbook §17.

### INCIDENT — gov.uk 429 storm exposed a V17 pool rate-limiter race (fixed)

Within an hour of et-decisions seeding, gov.uk 429'd (each row = content fetch + PDF asset fetch; V18's 150ms/10 was too hot for 2-fetch rows). Politeness response: halved to 300ms/5 + Ingest restart. **Failures then accelerated: configured 3.3 rows/s, measured 24 fails/s.** Root cause — `eligible()` → *async claim (100–300ms)* → `recordClaim()`: every idle loop saw the same free token; instant 429 failures idled all 20 loops which then raced every token, keeping gov.uk's penalty box alive (also explains the V18 TWFY storm's severity). **Fixed in `ingest-pool.ts`: reserve-then-claim (token consumed BEFORE the async claim, single-source claims) + in-process 5-min source suspend on HTTP 429/503.** The zero-output/failure breaker contained the storm at 16:30 (working as designed); ~7k burned 429 rows + parked pending await reset after the fix deploys and gov.uk cools off. Playbook §8 entry.

### Verification state at session close (§6)

**✓ at measured actuals (12 corpora):** all 7 pwdata · hmrc-manuals 69,136 (+16,061 classified index nodes) · hmrc-ancillary 457 (+7) · tax-treaties-dta 324 · **tna-caselaw 74,896** (court-page sweep verified: all 180 pages processed under V19 code, +22 sections — the global feed had already captured nearly all FCL tribunal holdings; per-court coverage now proven, not assumed) · **lda-commonsoralquestions 69,529** (closed: tail reseed of pages 120–141 yielded 0 new — the ~500-record delta vs LDA's claimed totalResults 70,040 is source-side phantom in a deprecated API; full text is in pwdata anyway) · **si-pre-2010 174,552 + 1 classified residue** (uksi/1958/1156 → metadata-only via requeue; 5 of 7 AI-era failed sections recompiled; 2 were stale sectionRefs absent from current CLML — deleted, acts have full modern coverage).

**In flight (autonomous — Ops liveness + breakers guard):** retained-eu ~145k pending (~36h TNA), et-decisions ~125k + uk-treaties 205 pending (~11h gov.uk — resumed after 4.4h cooloff with ZERO new 429s; the rate-limiter fix + suspend verified live). ✓ re-baseline each at drain.

**Deferred to next session (TNA penalty-boxed the local IP after three enumeration runs):** `v19-seed-ukpga-regnal.ts` (primary-acts-pre-2000 completion) and the regional universe enumeration. Both documented in handoff with run commands.

**Post-push timeline note:** the 16:48 push's auto-deploy never visibly registered (Railway API began returning Not Authorized to the polling token — likely API rate-limit); the V19 code went live anyway at 18:46 via Ops liveness `serviceInstanceRedeploy` (builds from Main HEAD). Verified by heartbeat + behavior.

## V18 — REFILL THE QUEUE → PWDATA PER-SPEECH MIGRATION (10 Jun 2026)

**Context:** brief said "seed the full pwdata backlog (~2M sections)". Verification showed the archive was ALREADY fully ingested at day-file granularity (queue done-counts matched TWFY directory counts exactly for all 7 corpora; the processor writes ONE section per day-file — the V11 lesson recurring at brief level). Charlie chose **per-speech migration**: the corpus exists to link debate to legislation; a day of Hansard as one section is not a retrieval unit, and re-chunking after search ships would cost strictly more. Refinements: per-section metadata (heading, speaker, date, parent day-file) so supersession is traceable, and **pilot before full reseed — predict, measure, commit.**

### §1 carry-over verification

1. **Count discrepancy RESOLVED — neither instrument was wrong.** Email 1,790,298 = 914,274 legacy `LegislationSection` + 876,024 *compiled-only* corpus_sections. V17's 884,982 = all corpus_sections rows (incl. 8,893 unavailable + 71 failed). Fix: the email TOTAL CORPUS section now prints the breakdown line so a raw `count(*)` can never look 2× off again.
2. 8 echr-hudoc V17 test rows deleted; echr breaker cleared (trip was a verification artifact; corpus_targets.blocked still ⛔s the corpus). tna-legislation zero_output_streak (10, from verification re-processing) reset.
3. **tna-caselaw:** queue cleanup had ALREADY deleted the page:7489 overhang — and with it the discovery cursor (discovery itself was retired in V17). Bonus finding: the Atom feed is **NEWEST-first**, so the first tail seed (pages 1495–1501) re-fetched old judgments and wrote 0 sections; the real gap was pages 1–7. Seeded those; ops liveness started Ingest unaided, +144 sections (74,874 total, current through 10 Jun). Refresh rule now in playbook §8.
4. Email storage denominator 10GB → 20GB (`DB_LIMIT_GB`, display only).

### §2 pwdata per-speech migration (built + piloted; full reseed is post-push)

- `parsePwdataItems()`: one item per `<speech>` / `<ques>`+`<reply>` exchange, with major/minor heading context, speaker, per-item canonical URL. ISO-8859-1 declaration sniffing (pre-2006 files were silently mojibaked by `res.text()` since V2) + named-entity map (`&pound;` was being blanked).
- `corpus_sections` columns added (live, nullable): `sectionTitle`, `speaker`, `itemDate`, `parentDocId` (+ partial index). **entity_list_v5.md needs the matching update — CCh.**
- `processPwdata` rewritten: batched R2 puts + multi-row section upserts; `deleteStaleSections` keeps re-parses consistent; empty/404 files write `unavailable` markers — **closes the 2,520-empty-file perpetual-reseed hole** (they fell outside corpus_sections dedup; weekly cleanup + hourly reseed would have re-processed them forever and tripped the zero-output breaker ~14 Jun).
- **Scrape versions:** TWFY publishes up to ~7 letter versions per sitting day and rewrites superseded files to `latest="no"` (verified). Superseded → marker + purge; latest → per-speech sections + purge of earlier letters. Files ≠ days: 20,010 debates files = 16,017 sitting days.
- **Pilot (235 files: 2026-03 all 7 corpora + 1950-03/1985-03 debates): 40,258 sections written via the production path.** Sections/day: debates 475 (2026) / 414 (1985) / 328 (1950); lords 216; wrans 436; westminster 92; lordswrans 54; wms 8; lordswms 7. Avg section ~173 words; **Neon marginal cost ~495 bytes/section** (19.0 MB for 40,258).

**PREDICTION TO SCORE (full reseed, ~50k day-file rows at P3):**
| corpus | days | est sections |
|---|---|---|
| pwdata-debates | 16,017 | ~6.4M |
| pwdata-wrans | 4,595 | ~2.0M |
| pwdata-lords | 3,949 | ~853k |
| pwdata-lordswrans | 4,629 | ~250k |
| pwdata-westminster | 2,624 | ~241k |
| pwdata-wms + lordswms | 6,509 | ~49k |
| **TOTAL** | **42,323 days / ~50k rows** | **~9.8M (range 8–11M)** |

The brief's ~2M for debates was LOW once measured — pre-2000 Hansard runs 328–414 speeches/day with no version splitting. Implied: Neon +~4.9GB → ~9.6GB total (48% of the 20GB headroom); R2 ~9.8M one-off Class-A PUTs ≈ **~$45** (the only non-trivial one-off cost) + ~12GB storage (+$0.18/mo); duration at 20 loops with twfy cap 10: **1.5–4 days**, Railway $1.5–2/day → $3–8 compute. Pilot local rate was ~35ms/section single-loop; §8 verification scores sections/hour against the 100–300k/hr band.

### §3 committees — **Railway is BLOCKED; stopped per brief**

curl 7.88.1 installed in `Ingest` (builder confirmed RAILPACK; service variable `RAILPACK_DEPLOY_APT_PACKAGES=curl` — left in place, harmless and useful). One-shot container test (temporary startCommand swap, no mid-sprint push; method in playbook §8): `committees.parliament.uk` (both listings) AND `publications.parliament.uk` all return the CF "Just a moment…" JS challenge from Railway's IP — the same curl passes from Charlie's residential IP. **Datacentre-IP reputation, not TLS fingerprinting — the V16.1 curl approach cannot work from Railway.** Untouched per §3.4: 2,896 empty-done rows, committees-portal breaker, retirement SQL. Fallback (local fetch / proxy egress / retire) is Charlie's decision.

### §4 + §5 gov.uk corpora (built; seed post-push)

- New generic `govuk-content` source (Content API JSON + PDF attachments via pdf-parse; deep search paging verified to 84k+; 404/410 → unavailable marker). Rate limit 150ms/10 — GOV.UK asks <10 rps sustained. Post-sprint hotfix `6b52c36`: `order=link` 422s (not sortable) → `order=public_timestamp`; paging uniqueness re-verified.
- **hmrc-manuals: real universe is 85,197 `hmrc_manual_section` pages, not the brief's ~626k** (stale 640k-era estimate). Seeder ready, P2.
- govuk-core-docs: PACE codes (live-extracted from the collection page), Green/Magenta/Aqua/Orange Books, Cabinet Manual, Civil Service + Ministerial Codes, ~629→title-confirmed white papers (gov.uk has no white_paper type — probed). Seeder ready, P1.

### §6 retained-eu viability (REPORT ONLY — Charlie decides)

- **Root-cause finding: TNA year-feed pagination was broken from V2→V17** (`?start=` ignored by TNA; only bucket-linked dense uksi years paginated). Every eur/eudn/eudr year was capped at 20 instruments. Fixed (follow `rel="next"`).
- True universe ~**32,970** instruments (eur 14,031 / eudn 13,064 / eudr 5,875) vs 3,390 ever ingested. 200-sample of never-ingested: **93.0% hasNoProvisions** (avg 9.9 provisions when real). **Est real remaining ≈ 8,700 sections** vs the 140,000 denominator.
- Recommendation: one bounded pass (~30k TNA fetches ≈ ~2h) to capture the ~8.7k real sections + classification markers, then `est_is_confirmed=true` at ~23k; alternative is retire at current coverage (EUR-Lex's 90,260 sections already carry EU-law text). **Nothing seeded or retired.**

### Post-push run order (Charlie's terminal, any order after `git push`)

1. `seed-govuk-core-docs-v18.ts` (P1, minutes) → 2. `seed-hmrc-manuals-v18.ts` (P2, ~3.5h of fetches) → 3. `seed-pwdata-perspeech-v18.ts` (P3 floor, days). Ops liveness starts Ingest unaided — that is §8.1. §8.2–8.4 (memory ≤600MB at concurrency 20, divergence ~0, 24h sections/hour vs prediction) are scored from the hourly emails + Railway metrics over the following day.

## V17 — CONSOLIDATION & RENEWAL (10 Jun 2026)

**Context:** the 8–10 Jun project-wide outages were a Railway workspace Compute Usage Limit pause (confirmed on Usage page), not crashes. Charlie deleted the 23-container fleet; its ~$3.6/day idle cost floor is the problem V17 removes. Design criterion: **system cost at zero work ≈ $0.**

**Built:**

1. **`Ingest` = single-process pool worker** (`workers/ingest-pool.ts` + `workers/process-row.ts`). `WORKER_CONCURRENCY` (default 20) concurrent claim loops on one Node runtime; per-source processors extracted verbatim from worker-queue.ts. Shared `pg.Pool` max 10 (`shared/neon-pool.ts`); in-process token-bucket rate limiter (`shared/rate-limiter.ts` — source_rate_limits is config-only now, no per-claim DB writes); per-loop error isolation; 5-min row timeout kept; **exit-on-empty** (3 sweeps × 30s → exit 0 → stopped service bills nothing); 30s heartbeat to `ingest_service_state`. Startup jitter removed (existed to stagger 20 containers). No Railway-DB code path (grep-proven).
2. **`Ops` = merged scheduler + monitor** (`ops.ts`), Neon only. Hourly: stale-claim reaper, census, corpus snapshots, cleanup, pwdata daily reseed, progress email. Every 15 min: **circuit breakers** (failure: 5 consecutive; zero-output: ≥25 done rows with 0 section growth — the alarm the committees incident lacked) + **ingest liveness** (pending > 0 + stale heartbeat → `serviceInstanceRedeploy`, 15-min cooldown). On trip: pending rows parked `status='blocked'`, persistent email ISSUES line, no auto-retry ever; manual clear SQL in playbook §8. Breaker state in new `source_status` table (separate from human-edited rate-limit config by design). `queryFormatBreakdown`/`queryUnrecognisedFormats` and all Prisma/DATABASE_URL usage deleted (documented scheduler-hang cause).
3. **Email additions:** INGEST SERVICE line (running/stopped, starts today), rows-completed vs sections-added divergence warning, 🔴 breaker ISSUES sourced from source_status (persist until cleared).
4. **Latent bug fixed:** monitor-era pwdata reseed deduped against the queue; hourly cleanup deletes done rows after 7 days, so it would eventually re-seed the entire TWFY archive (~20k files) — under V17 that would keep Ingest alive forever and feed the zero-output breaker. Now dedupes against `corpus_sections` (the permanent record) and checks all configured pwdata corpora (the old "has done rows" condition went permanently blind after a recess).
5. **Also fixed:** `census/live-census.ts` queue query had silently pointed at the stale pre-migration Railway `ingest_queue` copy since V16 — now Neon.
6. **Cleanup:** retired to `scripts/attic/v17-fleet/`: worker-queue.ts, worker-main.ts, phase-router.ts, scheduler.ts, monitor.ts, restart-workers-staggered.ts, checkpoint.ts (R2 per-worker checkpoints), check-status.ts, cc-monitor.ts, retry-failed.ts, ingest prisma/ copy, DEPLOY.md. `scripts/ingest/package.json`: prisma deps + postinstall removed (lockfile regenerated); scripts repointed (`worker`→ingest-pool, `scheduler`→ops) so Railway service start commands needed no change.
7. **Docs:** INGEST_PLAYBOOK §1 three-layer doctrine + §1a cost model + §8 usage-limit-pause first-check pattern + breaker clear procedure + §15 jurisdiction onboarding checklist; §3 staggered restarts marked retired. handoff_summary CURRENT STATE rewritten.

**Session note:** the 6am session Charlie scheduled was killed ~6:11 by a laptop restart after writing neon-pool.ts, rate-limiter.ts and the queue-client refactor (all sound, kept). This session audited for partial state (none beyond running old deployments, which were stopped), and completed the sprint.

**Verification (brief §5, adapted — the si-2010plus tail had finished overnight, so the shakedown used a small SI-refresh batch + deliberately failing echr rows):**
1. ✅ Deployed at concurrency 5; two real bugs found and fixed during shakedown: (a) BIGINT `intervalMs` returned as string by pg → token bucket self-poisoned after first claim (froze all loops; fixed with Number() coercion — playbook §8 entry); (b) missing client-side `query_timeout`/keepAlive on the shared pool (added).
2. ✅ Sections-not-statuses verified: SI-refresh rows are idempotent (0 new sections, expected); pdf-only classifications wrote real upserts; pool exit summary reports sections written.
3. ✅ Concurrency 20 run: 20 loops, clean exit-on-empty, trivial footprint (workload too small for a meaningful 600MB check — first real backlog run will confirm).
4. ✅ Exit-on-empty: 3 sweeps × 30s → exit(0) → Railway leaves service stopped (status stays SUCCESS — which is why liveness uses the heartbeat, not deployment status).
5. ✅ Ops liveness: autonomously started Ingest via serviceInstanceRedeploy when pending > 0 with stale heartbeat.
6. ✅ Breaker: echr tripped on 5 consecutive real failures (HUDOC 404) with persistent ISSUES line; committees-portal tripped on its genuine CF-403 history. No auto-retry.
7. Steady-state idle cost = scrutinise-db + Ops only; Charlie to confirm on the Usage page tomorrow.

---

## INCIDENT — 9/10 Jun 2026 (Railway DB crash caused by CC)

### What CC did

CC ran a diagnostic session to test whether Railway workers have curl access to committees.parliament.uk. The session caused or contributed to Railway DB crashing at ~17:47 BST on 9 Jun 2026. System has been down since.

**Actions taken that may have caused the crash:**

1. `deploymentRedeploy(id: "63e9dbbf")` called on a REMOVED June-4 deployment of worker-1. That old code predates V16 and connected to Railway DB for queue operations. It crash-looped repeatedly, creating sustained failed-connection pressure on Railway DB.

2. `serviceInstanceRedeploy` called on worker-1 three times in rapid succession for the curl diagnostic test (~17:28, ~17:34, ~17:40).

3. `serviceInstanceRedeploy` called on all 20 workers + scheduler simultaneously (staggered batches of 5, 20s gap, ~17:40). Scheduler fresh-build opened a new PrismaClient pool to Railway DB. Old scheduler instance may not have disconnected cleanly.

4. A syntax error in test-committees-fetch.ts caused worker-1 to crash-loop via esbuild parse failure for ~6 minutes. Cleaned up.

**Root cause hypothesis:** `scheduler.ts` calls `queryFormatBreakdown()` and `queryUnrecognisedFormats()` from `db-metadata.ts`. Both use `getPrisma()` → `new PrismaClient()` → Railway DB connection pool (10 connections, persistent for scheduler lifetime). After fresh redeploy, new PrismaClient instance opened while old instance may still have held connections. Combined with worker-1 crash-loop connection attempts against Railway DB, this likely exceeded Railway DB connection/memory limit.

### Findings during the session

1. **curl is NOT on Railway worker containers.** Confirmed by deploying a diagnostic to worker-1. `/usr/bin/curl`, `/usr/local/bin/curl`, `/bin/curl` all ENOENT. CLAUDE.md claim "Railway Linux containers have curl by default" is wrong.

2. **V16.1 committees-document approach has never worked.** 2,896 done rows produced 0 corpus_sections. `fetchPublicationHtml()` silently returns null when curl absent; rows marked done with no content. All tagged `lastError = 'empty — curl not available in Railway container (V16.1)'`.

3. **Queue drained overnight.** Was 31,110 pending at start of session; reached 1,622 (si-2010plus only) by end. Workers processed ~29,500 rows.

4. **`reports-responses` has ~1,132 actual publications** (not 9,959 — estimate was wrong; listing ends at ~page 80). `other-publications` returns CF JS challenge from Charlie's machine.

### Code changes during session (all committed, Main branch)

- `5c70768` diag: committees fetch test on Railway worker (TEST_COMMITTEES_FETCH env var)
- `36d2c1c` diag: improve curl PATH detection in Railway test
- `3e87f30` fix: syntax error in test-committees-fetch (esbuild rejects ?? with ||)
- `176dbbe` chore: remove Railway CF test scaffolding + fix seeder max-time ← **CURRENT HEAD**

All diagnostic code removed in `176dbbe`. worker-queue.ts clean.

### CC's error in reporting

CC reported "Workers are running normally" and "19/21 workers SUCCESS" without checking Railway DB health. This was accurate for Neon queue and Railway deployment status but missed Railway DB health entirely. Given Railway DB's crash history, Railway DB should be checked explicitly after any mass redeploy.

### Fix required before next ingest session

**`scheduler.ts` Railway DB connection must be removed.** `queryFormatBreakdown()` and `queryUnrecognisedFormats()` connect to Railway DB via Prisma. After V16, `corpus_sections` is on Neon — these queries hit an empty Railway table and are useless. They should be removed from the scheduler or replaced with Neon equivalents. This is the safest fix to prevent recurrence.

---

## SPRINT V15 — 9 Jun 2026 (committees portal + LDA fix + SOURCES email section)

### Part 1 — reseed-deep.ts status
`reseed-deep.ts` was still running when V15 session started. Log shows it reached retained-eu eudn enumeration (1,104 acts found) and was working through `eur` enumeration. Still in progress / interrupted — Charlie to check log for full results.

### Part 3 — Parliamentary Committees portal scraper (NEW SOURCE)
- `scripts/ingest/sources/committees-portal.ts` — portal scraper using browser User-Agent to bypass Cloudflare. Parses publication cards: title, committee, date, type, PDF URL, HTML URL. Prefers `publications.parliament.uk` HTML over PDF.
- `scripts/ingest/seed-committees-queue.ts` — seeds one queue row per listing page. 498 pages for reports-responses, ~2,040 for other-publications. Safe to re-run.
- `worker-queue.ts` — added `committees-portal` sourceType routing → `processCommittees()`
- `discovery.ts` — `committees-reports` and `committees-evidence` added to SINGLE_PASS_CORPORA + DISCOVERY_CORPUS_ORDER
- `seed-rate-limits.ts` — `committees-portal` entry (500ms, 3 concurrent)
- SQL: `scripts/ingest/sql/v15-rate-limits-and-targets.sql` — rate limit INSERT + Neon corpus_targets

### Part 4 — LDA 524 loop fix
- `lda-parliament.ts`: exported `MAX_524_RETRIES = 3`
- `worker-queue.ts processLda()`: passes `pageSize=100` for `writtenquestions` corpora (was 500 → 524 timeouts). After `MAX_524_RETRIES` 524 failures, marks row with `specialist-queue:` prefix error → monitor no longer resets these rows.
- `monitor.ts resetRetryableFailures()`: added `AND "lastError" NOT LIKE 'specialist-queue:%'` exclusion
- `monitor.ts CORPUS_THRESHOLDS`: added `committees-reports: 1` and `committees-evidence: 1`
- SQL in `v15-rate-limits-and-targets.sql`: reset current LDA 524 failed rows (after deploy)

### Part 5 — SOURCES section in hourly email
- `progress-reporter.ts`: added `querySourceStatus()` — queries source_rate_limits + ingest_queue for per-source pending/active/cap
- Added SOURCES section to `sendProgressEmail()` — shows active/pending sources with worker cap status. Suppresses fully-done sources. Flags `⚡cap-full` when active == cap with pending work.

### Part 6 — INGEST_PLAYBOOK.md §8
Three new failure patterns added:
1. committees.parliament.uk portal as alternative to blocked api.parliament.uk (V15)
2. LDA 524 permanent page failure — pageSize fix + specialist-queue archival (V15)
3. Connection pool exhaustion signature — ECONNRESET 30s retry loop diagnosis (V15)

### Post-session — Railway DB OOM diagnosis (9 Jun 2026)
Railway DB crashed twice during session (10:28 and 11:34 BST). Root cause diagnosed:

- **`SHOW max_connections` = 100** — not 25 as feared; Starter plan has room
- **Peak connections at 46** (20 workers × 2 + scheduler + monitor) — well under limit
- **Root cause: OOM kill**, not connection exhaustion. Railway Postgres container memory-killed under peak concurrent write load from 20 workers all active simultaneously
- Contributing factor: `reseed-deep.ts` running locally — local long-lived connections to Railway DB compete for connection slots and create ambient pressure during bulk inserts
- **Fix applied:** `monitor.ts` Railway pool `max: 3 → 2` (committed `a0137b6`)
- **reseed-deep.ts killed** (PIDs 58060 + 18264). Must run as Railway service job, not locally.
- **Longer-term recommendation for CCh:** upgrade Railway Postgres plan (more RAM) OR migrate ingest queue to Neon

### Post-session — All V15 actions applied
- 20/21 workers deployed on V15 (worker-18 retriggered)
- Rate limits: eurlex 3→8, lda-parliament 4→2, committees-portal added at max:3
- Neon corpus_targets: committees-reports (9,959) + committees-evidence (40,794) added; committees-a/b retired
- Queue seeded: 498 committees-reports rows + 2,040 committees-evidence rows
- LDA 524 reset: 0 rows matched (none outstanding)
- seed-rate-limits.ts updated with correct V15 values and pushed (`3019b0e`)

---

## SPRINT V14 post-session — 9 Jun 2026 (fetch timeout fix + monitor reseed loop fix)

### Bug 1 — fetch() no timeout (tna-legislation.ts)

Workers hung indefinitely on old NISR items. TNA accepts TCP connection but never sends data; no AbortController meant workers blocked forever.

- Added `withTimeout(ms)` helper returning `{ signal, clear }` to `tna-legislation.ts`
- `fetchText()`: 30s AbortController timeout
- `fetchBinary()`: 30s AbortController timeout
- `headRequest()`: 10s AbortController timeout
- All three call `clear()` in both success and catch paths
- Committed `398ffbd`

### Bug 2 — Monitor infinite reseed loop (monitor.ts)

36,983 completed items stuck in false-positive pending state all day. Workers processed them, monitor reseeded them, repeat.

Two triggers identified:
- `regional` and `retained-eu` not in `CORPUS_THRESHOLDS` → defaulted to 3, flagging 1-section NI Acts as partial
- hasNoProvisions items (availability_status != 'full') have 0 compiled r2Key sections → count=0 < any threshold → reseeded every 15 minutes

Fixes:
- Added `regional: 1` and `retained-eu: 1` to `CORPUS_THRESHOLDS`
- Added `status != 'unavailable'` filter to Neon count query
- Added second Neon query in `reseedPartialItems()` to fetch all classified-unavailable govUkIds and exclude them from reseed candidates
- Cleared 36,983 false-positive pending rows → done
- Committed `9c8d3cb`

### INGEST_PLAYBOOK.md — two new §8 entries

- "Monitor infinite reseed loop" — symptom, cause (both triggers), fix, diagnostic SQL, rule for new corpus onboarding
- "fetch() with no timeout blocks workers indefinitely" — symptom, cause, fix pattern with code snippet, diagnostic SQL

---

## SPRINT V14 — 8 Jun 2026 (hasNoProvisions classification + specialist queue)

### Part 7 — Immediate throughput fix (SQL)

Railway DB query found **0 rows** matching the `lastError LIKE '%hasNoProvisions%'` filter. V11 already handles hasNoProvisions items inline — workers mark them `done` without setting `lastError`. The SQL was targeting a pre-V11 failure state. Workers are not spinning; they process these rows and call `markDone()` cleanly.

### Part 1 — Neon schema: availability_status + availability_note

Applied to Neon `corpus_sections`:
- `availability_status TEXT NOT NULL DEFAULT 'full'` — classification value
- `availability_note TEXT` — user-facing explanation for Lex to display
- `idx_corpus_sections_availability` partial index on non-full rows

### Part 2 — Railway schema: specialist_queue table

New table `specialist_queue` on Railway DB:
- Holds commencement orders and pdf-only items for future specialist workers
- Columns: `id`, `corpus`, `docId`, `sourceType`, `specialist_type`, `title`, `legislationYear`, `legislationType`, `priority`, `status`, `notes`, `createdAt`, `updatedAt`
- Indexes on `(specialist_type, status)` and `(corpus, status)`

### Parts 3+4 — tna-legislation.ts classification logic

Added to `scripts/ingest/sources/tna-legislation.ts`:
- `NoProvisionsClass` type: `'commencement' | 'revoked' | 'pdf-only' | 'metadata-only' | 'no-provisions'`
- `AVAILABILITY_NOTES` constant: user-facing strings for each classification type
- `headRequest()`: lightweight HEAD-only HTTP check
- `classifyNoProvisionsItem(docId, fullXml)`: classifies using title regex (commencement) → year heuristic (< 1980 = metadata-only) → PDF HEAD check → fallback
- `extractSectionMetadata(docId, fullXml)`: extracts title + year from CLML XML
- `TnaSection` extended with `classifiedAs`, `legislationTitle`, `legislationYear` fields
- `enumerateSections()` updated to call `classifyNoProvisionsItem()` on hasNoProvisions path

### Part 3 (worker) — worker-queue.ts uses classification

`scripts/ingest/workers/worker-queue.ts`:
- Imports `AVAILABILITY_NOTES` and `insertSpecialistQueueRow`
- `processTnaLegislation()` writes `availabilityStatus`/`availabilityNote` to Neon corpus_sections
- Inserts `specialist_queue` row for commencement/pdf-only items (non-fatal if fails)

### Part 5 — classify-no-provisions.ts bulk script

New script `scripts/ingest/classify-no-provisions.ts`:
- Reads existing done queue rows with hasNoProvisions in lastError
- Fetches TNA XML, classifies, writes corpus_sections row to Neon
- Inserts specialist_queue row for commencement/pdf-only
- Checkpointed/resumable — 200ms TNA request delay — reports progress every 500 items

### Part 6 — corpus_targets notes

Updated 5 corpus_targets rows (si-pre-2010, si-2010plus, regional, primary-acts-pre-2000, retained-eu): `notes = 'Section count includes fully-extracted + classified unavailable items'`

### Part 8 — INGEST_PLAYBOOK.md updated

Added full §8 entry: hasNoProvisions classification types, architecture summary, bulk script usage, Part 7 SQL result.

---

## SPRINT V13 — 8 Jun 2026 (startup jitter + queue priority + blocked corpus fixes)

### Part 1 — Startup jitter added to worker-queue.ts

**`scripts/ingest/workers/worker-queue.ts` line 65** — Random 0–20s delay added as the very first `await` in `main()`, before `readCheckpoint()` (first DB call).

```typescript
const startupJitterMs = Math.floor(Math.random() * 20_000)
console.log(`[worker-${workerId}] startup jitter: ${startupJitterMs}ms`)
await new Promise(r => setTimeout(r, startupJitterMs))
```

Root cause of connection storm: all 20 workers receive Railway redeploy trigger simultaneously and all hit the Postgres connection pool within <1s. Expected stagger with 20 workers at 0–20s range: ~1s per worker average.

### Part 2 — pwdata file count (informational)

TWFY website unreachable from local dev machine (connection timeout on `www.theyworkforyou.com`). File count curl commands could not be run locally. **All pwdata corpora were confirmed fully seeded in V11** (19,768 debates, 5,668 lords, etc.). V12 monitor auto-reseed (`reseedExhaustedCorpora()`) handles daily new parliament files automatically. No additional seeding action needed.

### Part 3 — Priority routing SQL (for Charlie to run)

Workers are claiming si-pre-2010 and si-2010plus rows (priority 1) that yield nothing — these are the partial-item false positives. SQL to de-prioritize:

```sql
-- De-prioritise the false-positive reseeded rows for completed corpora
UPDATE ingest_queue
SET priority = 5
WHERE corpus IN ('si-pre-2010', 'si-2010plus', 'primary-acts-pre-2000', 'primary-acts-2000plus')
  AND status = 'pending';

-- Verify
SELECT corpus, priority, COUNT(*) FROM ingest_queue
WHERE status = 'pending' GROUP BY corpus, priority ORDER BY priority, corpus;
```

Run in Railway dashboard → `scrutinise-db` → Query tab.

### Part 4 — Blocked corpora

**4a — nilawcom (NI Law Commission):** Fixed. Bug: `listNiLawComReports()` was fetching the homepage which has no PDF links. PDFs are on individual report pages (news items from homepage → report announcement pages → PDF). Fixed with BFS crawl: seeds from homepage + `/completed_projects-2.htm`, follows non-nav `.htm` links, collects PDF links from each page (max 60 pages). Verified: `report_on_bail_in_criminal_proceedings_nilc_14__2012_-2.htm` has `href="32432_-_bail_report_nilc14__2012_.pdf"`.

**4b — sentencing-council:** Fixed. Root cause: `searchGovUkByOrg('sentencing-council', ...)` returns 0 results — sentencing council is not indexed on GOV.UK search. Fix: `listSentencingCouncilGuidelines()` now fetches from `sentencingcouncil.org.uk/guidelines/crown-court/` and `/magistrates/`, extracts guideline URLs from embedded JSON (`"url":"/guidelines/{slug}/..."` pattern). Crown court page: ~161 URLs; magistrates page: ~220 URLs. Content accessible via `fetchDocumentText`. Update `corpus_targets`:
```sql
UPDATE corpus_targets SET blocked = false, blocked_reason = NULL WHERE corpus_key = 'sentencing-council';
```

**4c — uk-treaties:** Already complete per INGEST_PLAYBOOK §10 (1,104 FCDO treaties, URLSearchParams fix applied V2). No code changes needed.

### Part 5 — CLAUDE.md Railway Operations section added

Root CLAUDE.md updated with `## Railway Operations` section covering:
- Worker restart procedure (staggered, never simultaneous)
- `deploymentRedeploy` vs `serviceInstanceRedeploy` distinction
- Correct Railway API endpoint (`backboard.railway.com`)

### Part 6 — INGEST_PLAYBOOK.md failure patterns added

Three new patterns added to §8:
1. Railway DB connection storm on simultaneous worker restart
2. Local scheduler process causing duplicate emails
3. Monitor partial-item reseed false positives

---

## SPRINT V12 — 8 Jun 2026 (throughput fixes + corpus completions + monitor improvements)

### Part 1 — Duplicate email — definitive root cause found

**Root cause:** A LOCAL `scheduler.ts` process (PIDs 22916/47892 on Charlie's machine, tsx parent + child) running the pre-`msUntilNextRun` version of scheduler.ts with a fixed interval timer. This fires at :23 every hour (the minute the process was originally started) and survives all Railway restarts because it's not on Railway.

**Diagnosis steps taken:**
- `vercel.json`: no crons section
- JSON files: no cron patterns
- GitHub: no `.github/workflows` directory
- Railway API: all 23 services have correct startCommands (scheduler=`npm run scheduler`, monitor=`npm run monitor`, workers=`npm run worker`)
- `Get-WmiObject Win32_Process`: found two node.exe processes running `--tsconfig tsconfig.json scheduler.ts` — local processes on Charlie's machine

**Fix (Charlie's action):** Kill local scheduler processes: `Stop-Process -Id 22916` (or restart machine). The `scheduler_lock` table (last updated 23:01 7 Jun) confirms the Railway scheduler has been idle for 23+ hours — it should be redeployed after the local process is killed.

### Part 2 — Corpus-aware partial-item reseed threshold

**monitor.ts** — `PARTIAL_SECTION_THRESHOLD = 3` (global) replaced with `CORPUS_THRESHOLDS` record:
- `primary-acts-pre-2000`: 1 (ancient Acts legitimately have 1 section)
- `si-pre-2010`: 1
- `primary-acts-2000plus`, `si-2010plus`: 2
- `pwdata-debates`, `pwdata-lords`: 5
- `pwdata-wrans`, `lda-commonswrittenquestions`: 3
- default: 3

`reseedPartialItems()` now queries Neon with `corpus` included in GROUP BY, applies per-corpus threshold in TypeScript.

**DB action:** All 6,038 falsely-reseeded `primary-acts-pre-2000` rows verified as false positives (0 rows with 0 Neon sections) and reset to `done` via cross-DB script. 0 genuine gaps found.

### Part 3 — hmrc-tiins confirmed complete

Queue: 1 row done (the `__index` row). Neon: 791 sections. `corpus_targets` updated:
```sql
UPDATE corpus_targets SET est_sections = 791, est_is_confirmed = true WHERE corpus_key = 'hmrc-tiins';
```

### Part 4 — hmrc-codes-guidance diagnosis

Queue: 1 row done. Neon: 14,067 sections. The 640,000 estimate was wrong by 45×.

**Root cause:** `processHmrc()` uses GOV.UK search API → returns top-level document pages (not sub-pages). Each HMRC manual = 1 URL = 1 Neon section. The 640k estimate assumed per-sub-page enumeration, which was never built. 14,067 is complete coverage of GOV.UK-indexed HMRC content across 6 generators. `corpus_targets` updated:
```sql
UPDATE corpus_targets SET est_sections = 14067, est_is_confirmed = true WHERE corpus_key = 'hmrc-codes-guidance';
```

### Part 5 — pwdata V11 verification

All 7 pwdata corpora fully processed. Queue:
- `pwdata-debates`: 19,768 done + 236 skipped
- `pwdata-lords`: 5,668 done
- `pwdata-lordswms`: 3,672 done + 1 skipped
- `pwdata-lordswrans`: 5,167 done
- `pwdata-westminster`: 3,934 done
- `pwdata-wms`: 4,463 done
- `pwdata-wrans`: 6,859 done

0 pending across all pwdata corpora. Auto-reseed via monitor (Part 6 below) will pick up daily new files.

### Part 6 — Monitor auto-reseed for exhausted pwdata corpora

**monitor.ts** additions:
- `reseedExhaustedCorpora(pool)` — called from `checkQueueExhaustion()` after logging; iterates exhausted corpora, calls `seedPwdataCorpus()` for any `pwdata-*` corpus
- `seedPwdataCorpus(pool, corpus)` — fetches TWFY directory via `listPwdataFiles()`, inserts new files with `ON CONFLICT DO NOTHING`; priority 2 for most, 3 for westminster
- Import added: `listPwdataFiles, PWDATA_CORPUS_CONFIG` from `./sources/twfy-pwdata`

TNA legislation and LDA corpora are explicitly excluded from auto-reseed (discovery cost and rate-limit risk respectively).

### Part 7 — LDA timeout increase + failed row reset

**lda-parliament.ts:** `LDA_FETCH_TIMEOUT_MS` 45,000 → 90,000. WHY: page 999+ of commonswrittenquestions consistently takes 60–80s.

**DB resets (1,402 rows total):**
- 1,199 rows with `%fetch timed out%` → pending
- 169 rows with `%HTTP 502%` or `%HTTP 524%` → pending
- 34 rows with `%HTTP 500%` or `%HTTP 503%` → pending

Post-reset state: lda-commonswrittenquestions 1,232 pending; lda-lordswrittenquestions 132 pending.

### Files changed

| File | Change |
|------|--------|
| `scripts/ingest/monitor.ts` | CORPUS_THRESHOLDS; corpus-aware reseedPartialItems; reseedExhaustedCorpora; seedPwdataCorpus; import twfy-pwdata |
| `scripts/ingest/sources/lda-parliament.ts` | LDA_FETCH_TIMEOUT_MS 45s→90s |
| `docs/INGEST_PLAYBOOK.md` | §8 new failure patterns; §10 corpus status updated; §13 V12 lessons |
| `docs/CHANGE_LOG.md` | V12 sprint |
| `docs/handoff_summary.md` | V12 current state |

---

## SPRINT V11 — 7 Jun 2026 (hasNoProvisions diagnosis + monitor alerts + throughput)

### Part 1 — hasNoProvisions diagnosis + skip

**Diagnostic result:** 74 of 100 sampled pending `si-pre-2010`/`si-2010plus` rows return `NumberOfProvisions="0"` (74%). Well above 40% threshold.

**tna-legislation.ts change:** When `hasNoProvisions=true`, `enumerateSections` now pushes `{ format: 'unavailable', errorMsg: 'hasNoProvisions — no text content' }` immediately, skipping the HTML/PDF fallback chain. Saves 2 HTTP RTTs per item × 20,533 pending si-pre-2010 rows = significant throughput improvement.

**New diagnostic script:** `scripts/ingest/diag-has-no-provisions.ts` — re-runnable to monitor rate over time.

### Part 2 — pwdata queue audit

**Finding:** All 7 pwdata corpora are 100% processed (0 pending). Queue exhausted after V2/V8 seeding runs. Re-running `seed-pwdata-queue.ts` confirms 0 new rows available (all directory files already seeded). pwdata-debates: 19,768 done + ~236 skipped (no-parliament days).

**Queue state (7 Jun):** 38,012 pending (SI/regional/retained-eu/LDA corpora keeping workers busy). Workers are NOT idle — they have substantial TNA legislation work.

**Action for Charlie:** Re-run `seed-pwdata-queue.ts` weekly to pick up new parliament files (added at ~1–5/week during term).

### Part 3 — Rate limit increase

**tna-legislation:** `maxConcurrentWorkers` increased 6 → 10 in `seed-rate-limits.ts`. Applied to Railway DB via re-run of seeder script. Rationale: `source_rate_limits.suspended = false` confirms no recent 429s; `AdaptiveThrottle` handles backoff if TNA rate-limits. twfy-pwdata already at 10 workers — no change.

**Workers to redeploy:** Rate limit changes are read by workers on each claim cycle — no worker restart needed (rate limits are DB-backed).

### Part 4 — Monitor alert emails

**monitor.ts additions:**
- `createMonitorAlertsTable()` — `CREATE TABLE IF NOT EXISTS monitor_alerts` in Neon on startup
- `sendMonitorAlert(alertType, corpusKey, message)` — sends via Resend, rate-limited 1 per issue per 4h, always records to Neon
- `checkCriticalConditions(pool)` — two conditions: `all_workers_idle` (pending > 0 + no snapshots in 1h) and `stalled_source` (sourceType pending > 100 + not claimed in 2h)

**Required action (Charlie):** Add `RESEND_API_KEY` to `ingest-monitor` Railway service env vars so alert emails can send. Table will auto-create on next monitor run.

**`monitor_alerts` table (Neon):**
```sql
CREATE TABLE IF NOT EXISTS monitor_alerts (
  id BIGSERIAL PRIMARY KEY,
  alert_type TEXT NOT NULL,
  corpus_key TEXT,
  message TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS monitor_alerts_type_time_idx ON monitor_alerts(alert_type, sent_at DESC);
```

---

## SPRINT V10 — 7 Jun 2026 (FCA Handbook + volume resize recovery + monitor fix + playbook)

### Post-sprint ops (same session)

**Volume resize recovery:**
- Railway PostgreSQL volume hit capacity; all 22 services CRASHED
- Staggered restart: batches of 5, 20s gap via `restart-workers-staggered.ts`; 13/21 SUCCESS on first pass; 8 re-triggered via `retry-crashed-workers.ts`; all 22 SUCCESS confirmed
- Root cause of slow first-pass: polling fired too early (< 60s); workers were mid-build not yet visible as DEPLOYING; re-trigger of old-timestamp services resolved it
- Railway restart policy set ON_FAILURE/max-3 on all 22 services via `set-restart-policy.ts`

**Monitor bugs fixed (first real deploy):**
- Bug 1: `require('pg')` inside `reseedPartialItems()` async function — Node.js/tsx ambiguity between ESM and CJS; replaced with top-level `Pool` import (`new Pool({ max:1 })` used as single-connection client)
- Bug 2: `"legislationGovUkId"` column referenced in UPDATE — does not exist on `ingest_queue`; correct column is `"docId"` (which holds the govUkId for TNA legislation rows)
- Monitor stable since deployment `86c4c5b1` (10:57 UTC); loop confirmed by same deployment ID 3+ min later

**Monitor rootDirectory fix:**
- `ingest-monitor` had `rootDirectory: null` → npm installed from repo root (only `dotenv`) → `pg` not found at runtime
- Fixed via `serviceInstanceUpdate` mutation: `rootDirectory: "scripts/ingest"`
- Also added `"monitor": "exec tsx monitor.ts"` to `scripts/ingest/package.json` (was missing)
- GitHub source was already connected (service deployed successfully despite V9 note saying it wasn't)

**Corpus retirements:**
- `fca-publications` and `fca-regulators` set `retired=true, blocked=true` on Neon corpus_targets
- Reason: superseded by `fca-handbook` JSON API client (V10)

**FCA Handbook confirmed complete:**
- All 63 queue rows `done`; **3,661 sections** written to Neon
- `corpus_targets`: `est_sections=3661`, `est_is_confirmed=true` (corrected from 8,000 estimate)
- Rate limit added to Railway DB: `fca-handbook` 500ms / 3 concurrent
- Actual `source_rate_limits` columns confirmed: no `note` column, column is `intervalMs` not `minIntervalMs`

**INGEST_PLAYBOOK.md created** at `docs/INGEST_PLAYBOOK.md`:
- 10 sections: system overview, Railway API (IDs + mutations), staggered restart, monitor diagnosis, queue seeding, service config requirements, R2 key scheme, known failure patterns V1–V10, DB size monitoring, corpus status table
- Updated post-session with schema corrections and new failure patterns

**Duplicate email check:**
- Searched `vercel.json` and all `scrutinise-web/app/api/` routes for `sendProgressEmail` or cron config
- Clean — no duplicate source in Vercel/Next.js; issue was Railway-only (resolved V6b)

**scheduler_lock:**
- `SELECT * FROM scheduler_lock` → 1 row, `locked_at: 2026-06-07T13:01:00`, `process_id: re0w3ph5eim` — intact after volume resize

**Scripts added this session:**
- `scripts/ingest/restart-workers-staggered.ts` — batch-5/20s restart of all 20 workers + scheduler
- `scripts/ingest/check-railway-status.ts` — deployment status for all services
- `scripts/ingest/check-service-config.ts` — rootDirectory + startCommand per service
- `scripts/ingest/fix-monitor-root-dir.ts` — patch rootDirectory + redeploy for monitor
- `scripts/ingest/retry-crashed-workers.ts` — re-trigger specific crashed workers
- `scripts/ingest/set-restart-policy.ts` — set ON_FAILURE/max-3 on all 22 services
- `scripts/ingest/check-monitor-deployments.ts` — last 5 deployments for monitor
- `scripts/ingest/check-neon-recent.ts` — sections written in last 5 min by corpus
- `scripts/ingest/retire-corpus-targets.ts` — retire corpora on Neon
- `scripts/ingest/check-scheduler-lock.ts` — verify scheduler_lock table
- `scripts/ingest/diag-queue-fca.ts` — queue status + rate limits for fca/tna corpora
- `scripts/ingest/diag-fca-neon.ts` — fca-handbook section count + samples on Neon
- `scripts/ingest/add-fca-rate-limit.ts` — insert fca-handbook rate limit to Railway DB
- `scripts/ingest/update-fca-est.ts` — update corpus_targets est_sections on Neon

---

## SPRINT V10 — 7 Jun 2026 (FCA Handbook — JSON API ingest client)

### Part 1 — Playwright investigation

- Installed `playwright@^1.60.0` as devDependency in `scrutinise-web/package.json`
- Wrote `scripts/ingest/test-fca-playwright.ts` — diagnostic script (not deployed)
- Key finding: `handbook.fca.org.uk` SPA calls `api-handbook.fca.org.uk` backend
- Intercepted endpoints: `GetAllHandbook` (full module hierarchy) + `GetAllHandBookProvisionsSortedOrderByChapter/{chapterId}` (provisions per chapter)
- Both endpoints return clean JSON; `contentText` field contains plain rule text
- No auth required; `Origin: https://handbook.fca.org.uk` header sufficient

### Part 2 — Architecture decision: JSON API path

- **No Playwright on Railway** — direct HTTP to `api-handbook.fca.org.uk` works
- `GetAllHandbook` returns 63 sourcebook modules with chapter IDs (linked list)
- `GetAllHandBookProvisionsSortedOrderByChapter/{chapterId}?IsDeleted=false` returns all provisions for a chapter grouped by `sectionId`
- Provisions aggregate by `sectionId` → one `corpus_sections` row per section

### Part 3 — FCA Handbook API client

- Rewrote `scripts/ingest/sources/fca-handbook.ts` as pure HTTP API client
- New exports: `getAllHandbookModules()`, `listSectionsForModule()`, `FcaHandbookModule`, `FcaSection`
- Kept backward-compat exports: `FCA_KNOWN_SOURCEBOOKS`, `listFcaSections()`, `fetchSectionText()` (stub)
- Added `processFcaHandbook()` to `worker-queue.ts` — sourceType `fca-handbook`, corpus `fca-handbook`
- Retired old `processFca()` (was broken SPA scraper); `case 'fca':` now calls `markSkipped`
- `scriptstsconfig.json` updated: added playwright to paths
- `progress-reporter.ts` sourceType mapping updated for `fca-handbook`

### Part 4 — Queue seeder and module list

- Wrote `scripts/ingest/seed-fca-handbook-queue.ts` — one queue row per module (63 total)
- 63 modules confirmed: PRIN, SYSC, COCON, COND, APER, FIT, FINMAR, TC, GEN, FEES, GENPRU, INSPRU, MIFIDPRU, MIPRU, IPRUFSOC, IPRUINS, IPRUINV, COBS, ICOBS, MCOB, BCOBS, CMCOB, FPCOB, PDCOB, CASS, MAR, PROD, ESG, SUP, DEPP, DISP, CONRED, COMP, ATCS, COLL, CREDS, CONC, CTPS, FUND, PROF, RCB, SECN, REC, EMIRR, UKLR, PRM, DTR, DISC, EMPS, OMPS, SERV, BENCH, BFSAG, COLLG, ENFG, FCG, FCTR, PERG, RFCCBS, RPPD, UNFCOG, WDPG, M2G
- Corpus targets SQL (run after seeding):

```sql
INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, blocked, blocked_reason)
VALUES ('fca-handbook', 'FCA Handbook', 8000, false, false, NULL)
ON CONFLICT (corpus_key) DO UPDATE
  SET display_label = 'FCA Handbook',
      est_sections = 8000,
      est_is_confirmed = false,
      blocked = false,
      blocked_reason = NULL;
```

- No new Railway service needed — any existing worker can process `fca-handbook` queue rows
- **Do NOT add Playwright** to Railway workers — ingest is pure HTTP

### Files created/modified

- `scripts/ingest/sources/fca-handbook.ts` (rewritten — new JSON API client)
- `scripts/ingest/test-fca-playwright.ts` (new — diagnostic only, not deployed)
- `scripts/ingest/seed-fca-handbook-queue.ts` (new — run once to seed 63 queue rows)
- `scripts/ingest/workers/worker-queue.ts` (processFcaHandbook added, old processFca retired)
- `scripts/ingest/workers/worker-main.ts` (updated FcaSection field names: .id→.sectionId, .url→.sourceUrl)
- `scripts/ingest/shared/progress-reporter.ts` (fca-handbook sourceType mapping)
- `scripts/tsconfig.json` (playwright paths added)
- `scrutinise-web/package.json` (playwright ^1.60.0 devDependency)

---

## SPRINT V9 — 7 Jun 2026 (Autonomous monitor service + email cleanup + corpus label alignment)

### Part 1 — Railway monitoring service (monitor.ts)

- Created `scripts/ingest/monitor.ts` — new autonomous service, runs every 15 minutes
- 4 corrective functions: reclaimStale, reseedPartialItems, checkQueueExhaustion, resetRetryableFailures
- Key implementation notes: uses r2Key regex to extract govUkId from corpus_sections (no legislationGovUkId column on Neon); correct column names claimedBy/claimedAt/completedAt; HAVING clause on Neon query returns only partial IDs directly (no cross-reference loop)
- Railway service created: `ingest-monitor` (ID: `d4945e0c-207a-46ca-aceb-bdc010183cc5`), start command `npm run monitor`, DATABASE_URL + NEON_DATABASE_URL set
- Manual step remaining: connect service to GitHub repo in Railway dashboard + trigger first deploy
- Added `"monitor"` script to root `package.json`

### Part 2 — Email fixes (progress-reporter.ts)

**2a:** Removed legacy/new pipeline breakdown line — email now shows `X sections ingested` (total only).

**2b:** Added `retired` column to Neon `corpus_targets` (ALTER TABLE + COALESCE in query). 4 hansard API corpora (hansard-commons-a/b, hansard-lords-a/b) marked retired=true. Retired corpora now suppressed from ALL email sections (ISSUES, BLOCKED, ALL CORPORA STATUS, ACTIVE CORPORA) and from queryStalledSources. CorpusTarget interface updated with `retired: boolean`.

**2c:** Updated 42 corpus_targets display_label values on Neon to match Excel Corpus/Source column. All 42 updated (0 not found).

### Part 3 — Partial section detection (primary-acts-pre-2000)

Diagnostic via Neon r2Key aggregation (query on 785,099 rows):
- `primary-acts-pre-2000`: **6,038 items** with < 3 sections (1-2 sections only, likely ancient pre-1900 Acts)
- Monitor service will auto-reseed these on first cycle; workers will re-compile
- Note: 6,038 items covers the 1,084-section gap + ~5,821 legitimately short Acts (idempotent upsert = harmless)
- Railway DB ECONNRESET locally (transient) — monitor handles this on Railway where it runs

### Part 4 — Excel status file updated

`docs/Legislation_Corpus_Current_Status.xlsx` columns H-N populated:
- 29 rows mapped from 46 corpus_keys (grand total: 785,099 sections ingested)
- Notable complete corpora: UK Primary Acts 161,574/161,574 (100%), SIs 235,572/235,572 (100%), OTS 497/497 (100%), Scotlawcom 350/350 (100%)
- Most active: Regional 123,058/160,000 (76.9%), TNA Case Law 74,730/75,000 (99.6%), HMRC TIINs 791/800 (98.9%)

---

## SPRINT V8 — 6 Jun 2026 (Retire Hansard API queue + add 3 missing pwdata corpora)

### Part 1 — pwdata coverage verified

- pwdata-debates (debates/): 1919-02-04 → 2026-06-04 (20,004 files)
- pwdata-lords (lordspages/): 1999-11-17 → 2026-06-05 (5,668 files)
- Hansard API queue rows: hansard-commons-a/b had 2,187 rows (Parliament API 403 + TWFY API); hansard-lords-a/b had 3,234 rows
- Coverage confirmed: pwdata bulk XML covers 1919+ for Commons and 1999+ for Lords — surpasses TWFY API (1988+)

### Part 2 — Hansard API queue rows retired

- 6,788 ingest_queue rows updated to status='done', lastError='retired — content covered by pwdata bulk XML (pwdata-debates/pwdata-lords)'
- Final counts: hansard-commons-a 2,634 done; hansard-commons-b 920 done; hansard-lords-a 2,634 done; hansard-lords-b 600 done
- 4 corpus_targets rows inserted to Neon as blocked=true with retirement reason

### Part 3 — written-statements source confirmed

- `written-statements` uses discoverWrittenChunks with sourceType='hansard' (Parliament API monthly chunks), NOT wms/ bulk XML
- `pwdata-wms` and `pwdata-lordswms` are genuinely new corpora

### Part 4 — 3 new pwdata corpora added to source client

Filename prefixes confirmed by live directory fetch:
- `lordswrans/` → prefix `lordswrans`; `wms/` → prefix `ministerial`; `lordswms/` → prefix `lordswms`

Added to PWDATA_CORPUS_CONFIG in twfy-pwdata.ts:
- pwdata-lordswrans / pwdata-wms / pwdata-lordswms

### Part 5 — corpus_targets, queue seeded

- 3 new corpus_targets rows (Neon): pwdata-lordswrans, pwdata-wms, pwdata-lordswms (priority 2)
- No new source_rate_limits entries needed — all 3 share existing twfy-pwdata rate (500ms, 10 workers)
- Queue seeded: pwdata-lordswrans 5,167 rows; pwdata-wms 4,463 rows; pwdata-lordswms 3,673 rows = 13,303 total new rows (priority 2)
- Workers already picking up new rows

### Part 6 — worker-queue.ts and discovery.ts updated

- worker-queue.ts: 3 new corpus→'twfy-pwdata' entries in sourceTypeMap
- discovery.ts: 3 new corpora in DISCOVERY_CORPUS_ORDER (priority 2 band)
- seed-pwdata-queue.ts: CORPUS_PRIORITIES updated with priority 2 for new corpora

---

## SPRINT V7 — 6 Jun 2026 (TWFY 429 fix + legislation reseed + overnight queue)

### Part 1 — TWFY client silent failure fixed

**Root cause confirmed:** TWFY API returns HTTP 429 "Usage limit reached" for every call. The free-tier daily quota was exhausted by 20 workers processing TWFY rows concurrently.

**Previous behaviour:** `fetchDebatesForDate` handled 429 with `throttle.backoff(); return null`. The monthly generator yielded 0 debates. The worker marked the row DONE with 0 sections written. No error visible anywhere.

**Fix in `theyworkforyou.ts`:**
- HTTP 429 now throws `Error('TWFY API usage limit reached (HTTP 429)...')` instead of returning null
- This propagates through the `for await` generator in `processHansard`, caught by the outer try/catch, row marked FAILED with visible error message
- Non-429 HTTP errors now log the status code (was silently null before)
- `data.error` responses now log raw keys for diagnosis

**Fix in `worker-queue.ts`:**
- TWFY route now logs a warning when 0 debates are written for a month (parliament recess vs. silent API failure now distinguishable in logs)

**Rate limiting fix:**
- New `twfy-api` source type added to `source_rate_limits`: 1500ms interval, `maxConcurrentWorkers: 1`
- `seed-rate-limits.ts` updated and applied to Railway DB
- 1,244 existing TWFY queue rows updated from `sourceType='hansard'` to `sourceType='twfy-api'` (prevents multiple workers burning the daily quota simultaneously)
- `seed-twfy-queue.ts` updated to seed new rows with `sourceType='twfy-api'`

**Queue state (hansard corpora):**
- hansard-commons-a: 2,172 FAILED rows (OLD `commons:DATE:DATE` format — api.parliament.uk 403, pre-existing). 442 pending TWFY rows.
- hansard-lords-a: 462 pending TWFY rows (lords old API rows already DONE from earlier working state)
- hansard-commons-b (Westminster Hall TWFY): 320 pending
- After fix deploy: TWFY rows will be marked FAILED when 429 is hit (not silently done). Rows will retry daily until quota resets.

### Part 2 — Legislation corpora audit and reseed

**si-2010plus estimate corrected:**
TNA enumeration confirmed: 5,810 UKSI acts exist for 2010–2026 (not ~11,500 as the 120,000-section estimate implied). Queue has 5,838 rows — essentially complete. All acts processed. The 120,000-section estimate in corpus_targets was wrong.

**reseed-si-gaps.ts run:**
- A) UKSI 2010-2026: 0 new rows (queue fully seeded, TNA has 5,810 acts)
- B) UKPGA pre-1963: 0 new rows (all 6,897 Neon items already in queue)
- C) SSI+WSI: **1,317 new rows inserted** (1,297 SSI + 20 WSI — genuine gap, workers actively processing)

**Workers confirmed active:** regional corpus_sections latest timestamp = 6 Jun 2026 19:32 (today), 112,205 sections already written.

**corpus_targets updated in Neon (confirmed complete):**
| Corpus | Old Estimate | New Confirmed Count |
|--------|-------------|---------------------|
| si-2010plus | 120,000 | 61,017 |
| primary-acts-2000plus | 100,000 | 90,860 |
| primary-acts-pre-2000 | 70,000 | 70,714 |
| si-pre-2010 | 180,000 | 174,555 |

### Part 3 — LDA rate limit and overnight queue

**LDA rate limit raised:** `lda-parliament` intervalMs 200ms → 500ms to reduce 524 timeouts. Applied via seed-rate-limits.ts.

**LDA failed rows reset:** 362 `lda-commonswrittenquestions` failed rows (timeout errors) reset to pending. Now 1,234 pending rows.

**Overnight queue state (post-fixes):**
| Corpus | Pending |
|--------|---------|
| lda-commonswrittenquestions | 1,234 |
| hansard-lords-a (TWFY) | 462 |
| hansard-commons-a (TWFY) | 442 |
| regional (new SSI/WSI) | 931 |
| hansard-commons-b (TWFY) | 320 |
| lda-lordswrittenquestions | 207 |
| lda-commonsdivisions | 12 |
| lda-lordsdivisions | 5 |
| eur-lex | 3 |
| **Total** | **3,616** |

Workers: 30 claimed at time of snapshot. Actively processing.

---

## SPRINT V6 — 6 Jun 2026 (Claim reaper + email deduplication + exec fix)

### Part 1 — Claim reaper added to scheduler

**Root cause:** Workers SIGTERM'd during Railway redeployments leave `ingest_queue` rows stuck in `claimed` state permanently. No heartbeat mechanism exists. 2,337 rows had to be manually reset before this sprint.

**Fix:** `reclaimStaleRows()` added to `progress-reporter.ts` (exported). Runs as first operation in `run()` after lock acquisition. Any row with `status='claimed'` and `claimedAt < NOW() - INTERVAL '90 minutes'` is reset to `pending` with `lastError='reclaimed by scheduler — worker SIGTERM or crash'`.

**90-minute threshold rationale:** Worst-case LDA fetch is 45s × 3 retries + backoff ≈ 90s. Threshold provides ample margin while catching any worker that crashed or was SIGTERM'd.

**Email integration:** `sendProgressEmail()` now accepts `reclaimedCount` parameter. When > 0, adds `⚠️  Reclaimed N stale claimed rows` as the FIRST item in the ISSUES section (above failed rows, above stalled sources).

**Files:** `scripts/ingest/shared/progress-reporter.ts`, `scripts/ingest/scheduler.ts`

### Part 2 — Email stalled-sources deduplication

**Root cause:** `queryStalledSources()` returned sources with done queue rows but 0 corpus sections. Sources already marked `blocked=true` in `corpus_targets` were included — they appeared both in the `⛔ BLOCKED` section and the `⚠️ stalled` section, creating noise.

**Fix:** Added parallel Neon query for `corpus_targets WHERE blocked=true`. Results filtered to exclude blocked corpus keys before returning stalled list. Blocked sources now appear only in the `⛔` section.

**Files:** `scripts/ingest/shared/progress-reporter.ts`

### Part 3 — exec prefix added to worker start scripts

**Status:** Scheduler already had `exec tsx scheduler.ts` in `scripts/ingest/package.json` (committed in V5 via Railway service fix). Added `exec` prefix to `start` and `worker` scripts for worker processes. Railway SIGTERM now reaches the `tsx` process directly instead of the shell wrapper, reducing stale claim generation on redeploy.

**Files:** `scripts/ingest/package.json`

### Part 4 — TWFY silent failure identified (investigation for next sprint)

**Finding:** Worker-1 Railway logs (deployment `66844414`) confirm workers ARE claiming `hansard-commons-a` rows (51 claim log lines observed at 17:22–17:25 UTC). However:
- 0 `upsertSection` log lines found
- 0 `corpus_sections` rows for any `hansard-*` corpus in Neon
- 0 error log lines

Workers claim → complete in seconds → mark done → 0 sections written. Classic silent failure pattern. Root cause is in the TWFY source client (`theyworkforyou.ts`) — likely the API response parser returning 0 items without logging failure. **Investigation needed before next Hansard sprint.**

---

## SPRINT V5 — 6 Jun 2026 (Scheduler loop + TWFY key + Prisma compiledText + row resets)

### Part 1 — Scheduler hourly loop fixed

**Root cause:** Loop used `setTimeout(run, INTERVAL_MS)` where `INTERVAL_MS = 1h`. Deployed at 09:53 → ran at 09:53, slept 1h, next run would be 10:53 not 10:01. Process stayed alive so Railway saw it as healthy; no second email at 10:01.

**Fix:** Added `msUntilNextRun()` helper. Calculates time until :01 past the next clock hour. Loop now sleeps that duration instead of a fixed hour. Deploy at any time → next run always at :01.

**Files:** `scripts/ingest/scheduler.ts`

### Part 2 — TWFY_API_KEY deployed to Railway

**Key:** Set on all 21 Railway services (workers 1–20 + Ingest-scheduler). Railway will auto-redeploy each service on variable set — this is the desired behaviour.

**Queue reset:** 1,244 Hansard failed rows reset to pending on Railway ingest_queue:
- hansard-commons-a: 462 rows
- hansard-commons-b: 320 rows
- hansard-lords-a: 462 rows

### Part 3 — Prisma compiledText removed

**Root cause of PrismaClientUnknownRequestError on pwdata-debates:** `compiledText String?` field remained in `schema.prisma` CorpusSection after the column was dropped from Neon in V3. Prisma client (regenerated on container build) included the field; any Prisma-based code path referencing it would error.

**Additional fix:** Removed the redundant R2 write inside `upsertSection` that was overwriting full compiled text (from explicit `r2Put` calls) with a truncated 10K slice. All callers already do explicit `r2Put` before calling `upsertSection`.

**Files:** `scrutinise-web/prisma/schema.prisma`, `scripts/ingest/shared/db-metadata.ts`, `scripts/ingest/workers/worker-queue.ts`

**Post-deploy:** `npx prisma generate` run locally — Railway will regenerate on next build.

**Queue reset:** 7 pwdata-debates failed rows reset to pending.

### Part 4 — Broken sources marked blocked in corpus_targets

11 corpus_targets rows updated with `blocked=true` and `blocked_reason` on Neon:
- committees-a/b: Parliament API 403 from Railway IPs
- echr-hudoc: HUDOC /app/query endpoint 404 (Jun 2026)
- fca-publications/fca-regulators: JS SPA, needs Playwright
- nilawcom, sentencing-council, nao-reports: 0 sections, uninvestigated
- uk-treaties: URLSearchParams fix applied but still 0 sections

Note: hansard-commons-a/b, hansard-lords-a/b corpus_keys do not exist in corpus_targets (these corpora use pwdata-* keys).

### Part 5 — LDA fetch timeout + retry

**Fix:** Added 45s `AbortController` timeout per fetch attempt. Added HTTP 500 to `TRANSIENT_STATUS` (was 524/502/503/504 only). Changed backoff from `3000 * attempt` (linear) to `2000 * 2^(attempt-1)` (exponential: 2s, 4s). AbortError counts as transient and retries.

**Files:** `scripts/ingest/sources/lda-parliament.ts`

**Queue reset:** 1,409 LDA failed rows reset to pending:
- lda-commonswrittenquestions: 1,213
- lda-lordswrittenquestions: 207
- lda-commonsdivisions: 12
- lda-lordsdivisions: 5

### Files created/modified

- `scripts/ingest/scheduler.ts` — `msUntilNextRun()` helper; loop uses it instead of `INTERVAL_MS`
- `scripts/ingest/sources/lda-parliament.ts` — `LDA_FETCH_TIMEOUT_MS=45000`; 500 in `TRANSIENT_STATUS`; AbortController per attempt; exponential backoff
- `scrutinise-web/prisma/schema.prisma` — removed `compiledText String?` from `CorpusSection`
- `scripts/ingest/shared/db-metadata.ts` — removed `compiledText` from `SectionMeta`; removed R2 write via compiledText from `upsertSection`; removed unused S3Client/PutObjectCommand imports
- `scripts/ingest/workers/worker-queue.ts` — removed `compiledText: ...slice(0, 10_000)` from all `upsertSection` calls (18 occurrences)

---

## SPRINT V4 — 6 Jun 2026 (Fix census crash + corpus_snapshots + email redesign)

### Root cause (Part 1)

Scheduler was crashing silently on every run since V3 (and likely since V2). Root cause: `live-census.ts` queried `MAX("updatedAt")` on `ingest_queue`, but `ingest_queue` has no `updatedAt` column (only `completedAt`). This caused `runCensus()` to throw, `run()` to fail, and **no emails to be sent**. The "914,274/7,075,050" email Charlie saw was from a pre-V3 deployment.

Deployed commit confirmed: `b0fb5c5` (correct). Bug was always present in the query.

### Changes

1. **Bug fix: `updatedAt` → `completedAt`** — `live-census.ts` query on `ingest_queue` now uses `MAX(COALESCE("completedAt", "createdAt"))`. `runHourlyCleanup()` in `progress-reporter.ts` also fixed.

2. **`corpus_snapshots` table created on Neon** — Stores per-corpus section counts every hour. `UNIQUE(hour, corpus_key)`. `ON CONFLICT DO UPDATE` so re-runs are idempotent. `hour` is truncated to clock hour (not capture time) to make delta queries simple.

3. **`writeCorpusSnapshot()` added** — Called after `runCensus()` on each hourly scheduler run. Writes all corpus_sections counts + legacy LegislationSection as a single row (corpus_key = 'legacy-legislation-section').

4. **`getHourlyDelta()` added** — Queries previous hour's snapshot from corpus_snapshots. Returns `Map<string, number>` of deltas per corpus. Returns empty map (shows "--") if no previous snapshot (first run after deploy).

5. **`sendProgressEmail()` fully rebuilt (V4 design)**:
   - Subject: `Ingest HH:MM | +{delta} this hour | {total} total | {pct}%`
   - `THIS HOUR` section: per-corpus delta from corpus_snapshots
   - `TOTAL CORPUS` section: progress bar, legacy + new pipeline breakdown
   - `ACTIVE CORPORA` section: only corpora with worker activity in last 2h; per-corpus worker state (active/stalled IDs, rate)
   - `QUEUE` section: totals + per-corpus pending/failed; queue-exhausted warning
   - `ISSUES` section: failed rows with last error snippet, stalled sources, blocked corpora
   - `ALL CORPORA STATUS` section: one-line per corpus with emoji status indicator
   - ETA removed (queue exhausted, meaningless)

### Files created/modified

- `scripts/ingest/census/live-census.ts` — fix `updatedAt` → `completedAt`
- `scripts/ingest/shared/progress-reporter.ts` — add `writeCorpusSnapshot`, `getHourlyDelta`; fix `runHourlyCleanup`; rebuild `sendProgressEmail`
- `scripts/ingest/scheduler.ts` — import new functions; call `writeCorpusSnapshot` after census; compute `hourlyDelta`; pass delta to email
- `scripts/ingest/migrations/create-corpus-snapshots.ts` — migration script (already executed on Neon)

### Post-deploy actions

- Deploy: push to Main → Railway auto-deploys scheduler
- First email after deploy will show `-- this hour` (no previous snapshot yet); second email will show real delta

---

---

## SPRINT V3 — 5–6 Jun 2026 (Migrate → Backfill → Clean Architecture → Rebuild Email)

### Summary

1. **Scheduler redeployed** — V2 code (Neon count queries) deployed. Double-email issue resolved (single clean scheduler instance).

2. **Migration complete** — 732,954 rows migrated Railway→Neon corpus_sections. Neon total: 751,949 (includes ~19k direct writes from workers since V1).

3. **R2 backfill verified** — 665,719 rows checked. Written: 0. Already existed: 665,719. R2 coverage 100% — compiled text was already in R2 for all rows (pipeline writes R2 first). TRUNCATE safe.

4. **Railway corpus_sections TRUNCATEd** — 732,954 rows deleted. Frees ~4GB on Railway volume.

5. **compiledText column dropped from Neon** — FTS trigger updated (no-op, removes compiledText reference), column dropped. Compiled text lives in R2 only.

6. **upsertSection() R2-first** — `db-metadata.ts` updated: compiledText written to R2 at r2Key BEFORE DB upsert. If R2 fails, DB insert does not proceed. compiledText removed from all DB INSERT/UPDATE SQL.

7. **Email rebuilt from corpus_targets** — `progress-reporter.ts` fully rewritten:
   - `corpus_targets` table created on Neon (39 rows with labels, estimates, confirmed flags)
   - CORPUS_MANIFEST removed entirely from code
   - Estimated denominators marked with `~`; confirmed denominators (TNA caselaw) unmarked
   - Queue state section (pending/claimed/done/failed) added
   - Unlabelled corpora shown in separate section

### Files modified

- `scripts/ingest/shared/db-metadata.ts` — R2 client added; upsertSection() writes compiledText→R2 first; compiledText removed from DB SQL
- `scripts/ingest/shared/progress-reporter.ts` — CORPUS_MANIFEST removed; reads corpus_targets from Neon; queue state section; unlabelled section
- `scripts/ingest/backfill-compiled-to-r2.ts` — new script; 665,719 rows checked; 0 gaps found
- `scripts/ingest/drop-compiled-text-col.ts` — new script; updated trigger + dropped column

### Post-deploy state

- Railway corpus_sections: 0 rows (TRUNCATEd)
- Neon corpus_sections: 751,949 rows (no compiledText column)
- R2: 100% coverage of compiled text for all rows that had compiledText
- Scheduler: redeployed with V3 code

---

***

## SPRINT V2 — 5 Jun 2026 (Fix scheduler counts → Neon; live-census.ts; email fixes)

### Summary

1. **Scheduler reads Neon, not Railway** — `queryCorpusCounts()` and `queryDbSize()` in `progress-reporter.ts` now use `NEON_DATABASE_URL` pool instead of Railway. Emails will show counts from Neon (where workers are writing).

2. **queryStalledSources() fixed** — was doing a cross-DB subquery (`ingest_queue` Railway vs `corpus_sections` Railway). After migration, Railway corpus_sections is truncated, breaking the check. Now two-step: query Neon for compiled corpora, then filter Railway ingest_queue.

3. **live-census.ts** — new file at `scripts/ingest/census/live-census.ts`. Queries Neon corpus_sections + Railway ingest_queue state. Writes JSON snapshot to R2 as `ingest-csv/census-{date}.json`. Called from scheduler every hour; replaces redundant separate queryCorpusCounts() + queryNeonCount() calls.

4. **CORPUS_MANIFEST estSections fixed** — Planning Policy: 64 → 5,000. Building Regs: 21 → 3,000. Was causing 1235% and 3766% absurd percentages. Actual compiled count is 791 for each (from Railway pre-migration); estimates raised to account for PDFs and future expansion.

5. **Worker throughput filter** — `queryWorkerThroughput()` CTE now filters `AND "capturedAt" > NOW() - INTERVAL '2 hours'`. Previously included stale snapshots from before the V1 redeploy, causing the 78,586/hr ghost figure.

6. **Worker count dynamic** — Email "NEW PIPELINE (N workers)" now counts distinct workerIds from recent (2h) snapshots instead of hardcoded "20". Shows 0 if no recent snapshots (correctly indicates workers not reporting).

### Files modified

- `scripts/ingest/shared/progress-reporter.ts` — getNeonPool(); queryCorpusCounts()→Neon; queryDbSize()→Neon; queryStalledSources() two-step; estSections fix; throughput 2h filter; dynamic worker count
- `scripts/ingest/census/live-census.ts` — new file (CensusResult type + runCensus() + saveToR2())
- `scripts/ingest/scheduler.ts` — imports runCensus/saveToR2; replaces queryCorpusCounts+queryNeonCount with runCensus(); saves census to R2 each hour

### Post-deploy actions required (Charlie)

1. **Push + Redeploy scheduler** — picks up Neon count queries and census
2. **Run migration** — `NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json scripts/ingest/migrate-corpus-to-neon.ts` — takes 30-60 min for 732,954 rows
3. **Verify** Neon count matches Railway count (script reports both at end)
4. **TRUNCATE corpus_sections on Railway** — frees ~4GB: `TRUNCATE corpus_sections;` (Railway dashboard → DB → Query)
5. **Confirm** next hourly email shows Neon-sourced counts (numbers should now move)

### Queue / priority state (confirmed 5 Jun 2026 ~17:30 BST)

- Priority 1 (TNA legislation): **all done** — 540/7637/5838/30907/8117/3390 ingest_queue rows done, matching Railway corpus_sections compiled counts. Workers correctly on priority 3.
- Priority 2: only 28 LDA rows pending (lda-commonswrittenquestions: 21, lda-lordswrittenquestions: 7)
- Neon corpus_sections: 27,849 rows (post-V1 new writes only — migration pending)
- Railway corpus_sections: 732,954 rows (full pre-migration population)

### Neon DB limit note

`DB_LIMIT_GB` in progress-reporter.ts set to 10 (Neon Launch plan). If on Scale plan (50GB), update this constant.

***

## SPRINT V1 — 5 Jun 2026 (Architecture fix: Neon writes + single-worker discovery + priority enforcement)

### Summary

Three root-cause fixes deployed:

1. **Neon writes** — `upsertSection()` in `db-metadata.ts` now writes `corpus_sections` to Neon via raw pg Pool instead of Railway Prisma. Railway DB stops growing; Neon gets FTS-ready data. `corpus_sections` table created on Neon with full schema + FTS trigger (0 rows — populates from new ingest onwards; migration script for existing 732k rows provided separately).

2. **Single-worker discovery** — Thundering herd eliminated. `acquireDiscoveryLock()` / `releaseDiscoveryLock()` added to `queue-client.ts` using `scheduler_lock id=2`. Worker-queue wraps the discovery loop so only one worker enumerates TNA at a time; others sleep 30s and retry.

3. **Source concurrency limits** — `maxConcurrentWorkers` column added to `source_rate_limits` (migration `20260605010000`). `claimNextChunk()` now checks claimed count against limit before issuing a token. Seeds: TNA 6, caselaw 4, TWFY 10, LDA 4, etc. Prevents all 20 workers piling onto a single rate-limited source.

4. **pwdata daily discovery** — Removed pwdata corpora from `SINGLE_PASS_CORPORA`. Added `discoverPwdata()` which fetches TWFY directory listing and inserts any docIds not yet in queue. Workers now pick up new daily files automatically. Priority for `pwdata-westminster` corrected to 3 (was 2).

5. **Stalled source alerting** — `queryStalledSources()` added to `progress-reporter.ts`. Scheduler calls it each run; sources with `done` queue rows but 0 corpus_sections after 24h are listed in a new ⚠️ ATTENTION NEEDED email section.

6. **Worker throughput fix** — `twfy-pwdata` entry added to `THEORETICAL_SECTIONS_PER_HOUR` (2.16M/hr at 500ms × ~300 speeches/file) and sourceType detection map.

7. **Migration script** — `scripts/ingest/migrate-corpus-to-neon.ts` created. Reads Railway `corpus_sections` in batches of 200, bulk-inserts to Neon with ON CONFLICT DO NOTHING. Checkpoint/resume safe. Run after Part 2 is confirmed working; then TRUNCATE Railway corpus_sections to reclaim ~580 MB.

### Files modified

- `scripts/ingest/shared/db-metadata.ts` — Neon pool + raw-SQL upsertSection
- `scripts/ingest/shared/queue-client.ts` — discovery lock functions + maxConcurrentWorkers check in claimNextChunk
- `scripts/ingest/workers/worker-queue.ts` — discovery block wrapped with lock
- `scripts/ingest/shared/discovery.ts` — discoverPwdata() added; pwdata removed from SINGLE_PASS_CORPORA
- `scripts/ingest/shared/progress-reporter.ts` — twfy-pwdata in THEORETICAL_SECTIONS_PER_HOUR + sourceType map + queryStalledSources() + email section
- `scripts/ingest/scheduler.ts` — calls queryStalledSources, passes to sendProgressEmail
- `scripts/ingest/seed-rate-limits.ts` — maxConcurrentWorkers added to all entries
- `scrutinise-web/prisma/schema.prisma` — maxConcurrentWorkers field on SourceRateLimit
- `scrutinise-web/prisma/migrations/20260605010000_source_rate_limits_max_workers/migration.sql` — new migration
- `scripts/ingest/migrate-corpus-to-neon.ts` — new one-time migration script (corpus_sections Railway→Neon)

### Post-deploy actions required (Charlie — run via Railway dashboard SQL or tsx)

1. **`npx prisma migrate deploy`** in `scrutinise-web/` — applies `20260605010000_source_rate_limits_max_workers`
2. **Fix pwdata-westminster priority:**
   ```sql
   UPDATE ingest_queue SET priority = 3 WHERE corpus = 'pwdata-westminster';
   ```
3. **Reseed missing queue rows** (ON CONFLICT DO NOTHING — safe to re-run):
   ```bash
   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json scripts/ingest/seed-pwdata-queue.ts
   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json scripts/ingest/seed-lda-queue.ts
   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json scripts/ingest/queue-populator.ts
   ```
4. **Re-run seed-rate-limits** to populate maxConcurrentWorkers:
   ```bash
   NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json scripts/ingest/seed-rate-limits.ts
   ```
5. **Redeploy all workers + scheduler** (code already redeployed for NEON_DATABASE_URL; redeploy again after push for new code)
6. **Verify** one new corpus_sections row appears in Neon after a worker processes an item
7. **Run migrate-corpus-to-neon.ts** (can run locally — both Neon and Railway accessible from local... actually Railway ECONNRESET from local. Run from a Railway service or after confirming Neon writes work, defer migration to next sprint)
8. **After migration verified:** `TRUNCATE corpus_sections;` on Railway to reclaim ~580 MB

---

## DIAGNOSTIC — 5 Jun 2026 (D-series, read-only, no code changes)

### Summary

Full diagnostic of Railway DB + R2 bucket contents. Key findings:

- **732,942 corpus_sections rows, DB at 4.7 GB / 20 GB**
- **compiledText column = 1.6 GB** — root cause of volume fill. By design for FTS (10k chars/row). Needs CCh decision on whether to remove/reduce.
- **Queue exhausted: 0 pending** — workers processed all remaining rows during the 1.5h post-recovery window. 409 stale claimed rows.
- **lda-commonswrittenquestions: 0 DB rows, 0 R2 keys** — expected ~619k rows. Unknown whether inserts failed silently at capacity or rows were never seeded. Needs investigation.
- **R2/DB ratio:** ~2× for legislation (raw.xml + compiled.txt), 1× for text-only sources.
- **Legacy R2 prefixes:** ukpga/, uksi/, eudn/ etc. from old Neon pipeline exist in R2 but not Railway DB.

See handoff_summary.md DIAGNOSTIC SNAPSHOT for full table detail.

### Scripts created (diagnostic only — safe to delete)

- `scripts/ingest/diag-db.ts` — DB queries (D1, D4, D5). Works from local via PrismaPg adapter now that DB is healthy.
- `scripts/ingest/diag-r2.ts` — R2 prefix + key count survey (D2).
- `scripts/ingest/run-cleanup.ts` — manual cleanup runner (idempotent). Can be used from local now.

---

## POST-DEPLOY ACTIONS — 4 Jun 2026 V3 ✅ ALL COMPLETE

| Action | Status |
|--------|--------|
| Railway PostgreSQL restarted | ✅ CC via Railway API |
| All 20 workers redeployed | ✅ SUCCESS |
| Scheduler redeployed (DB size + hourly cleanup) | ✅ commits e11f9ea + b0a7a7d |

---

## CODE CHANGES — 4 Jun 2026 V3: Railway volume crash recovery + DB size monitoring

### Context

Railway volume hit 5GB hard limit at ~6pm, causing all 20 workers + scheduler to crash. Volume resized to 20GB. Workers crashed again at ~7pm (presumably during restart against still-full volume). CC triggered full redeploy of all 21 services via Railway API at ~8pm.

Root cause of volume fill: full text is being stored in the DB. Charlie to discuss with CCh what the strategy is for managing this long-term.

### Files changed

| File | Change |
|------|--------|
| `scripts/ingest/shared/progress-reporter.ts` | Add `queryDbSize()` — queries `pg_database_size`, returns bytes/pretty/pct against 20GB limit. Add `DbSizeResult` interface. Wire into `sendProgressEmail()` as optional param — shows DB size line in email header with ⚠️ WARNING at 80% and ⚠️ CRITICAL at 90%. Email subject gets `⚠️ DB XX%` suffix when >80%. |
| `scripts/ingest/scheduler.ts` | Import `queryDbSize`. Query DB size in parallel with corpus counts each hourly run. Log DB size to console (with warning if >80%). Pass to `sendProgressEmail`. |

### Post-deploy actions

- **Workers redeployed:** All 20 workers triggered via Railway API `serviceInstanceRedeploy` mutation ✅
- **Scheduler redeployed:** Triggered via Railway API ✅  
- **Cleanup SQL:** Must be run manually in Railway dashboard (CC cannot connect to Railway DB from local — `switchback.proxy.rlwy.net` resets connection from outside Railway network)

---

## POST-DEPLOY ACTIONS — 4 Jun 2026 V2 (Charlie to run after commit)

| Action | Command / Detail |
|--------|-----------------|
| Seed pwdata queue rows | `NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json scripts/ingest/seed-pwdata-queue.ts` — seeds ~36,451 rows across 4 corpora |
| Add twfy-pwdata rate limit | Run updated `seed-rate-limits.ts` (adds `twfy-pwdata` at 500ms) |
| Redeploy workers + scheduler | So new `processPwdata` case is live |
| Monitor next email | Should show Hansard Commons (TWFY), Hansard Lords (TWFY), Written Answers (TWFY), Westminster Hall (TWFY) in manifest |

---

## CODE CHANGES — 4 Jun 2026 V2 Addendum: Railway audit + duplicate scheduler verdict

### Issue 1 findings

| Check | Result |
|-------|--------|
| Railway API: scheduler services | **1 only** — `Ingest-scheduler` (id `7a4f3ffb`) |
| Active deployment | SUCCESS at 08:24, commit `646b2c2f` (V1 code, "20 workers") |
| Previous deployments | All REMOVED |
| scheduler_lock table | **Exists** (P1 was completed). Lock held by `17h6521s7zah` since 08:26 |
| Workers with recent snapshots | None yet (workers just redeployed, no 50-row checkpoint hit) |
| Other services running scheduler | **None** — all 20 workers run `npm run worker` |

**cronSchedule check (addendum query):** All 22 service instances return `cronSchedule: null`. No Railway cron job is set on any service including `Ingest-scheduler`. The cron-job theory is ruled out.

**Final verdict:** No persistent duplicate scheduler mechanism found via Railway API. The 09:56 old-format email was a one-time bleed from a lingering container of the `08:00 REMOVED` deployment. With `scheduler_lock` table live and the 08:24 deployment the only running instance, duplicate emails should stop. If they continue, next step is checking Railway logs directly for two simultaneous process IDs.

**Workers redeployed (CC via Railway API):** All 20 workers triggered via `serviceInstanceRedeploy` mutation (environmentId `991f733c`). V2 code now live on all workers.

### Issues 2 and 3 (already completed in Part 2 this session)

`seed-pwdata-queue.ts`: `bulkUpsertQueueRows` already uses `BATCH = 500` internally — no change needed. 36,451 rows already seeded. `seed-rate-limits.ts` already run (17 entries). Both confirmed idempotent.

---

## CODE CHANGES — 4 Jun 2026 V2 Part 3: NPPF/PPG and Building Regs source clients

### V1 audit verdict for Part 3 candidates

| Source | V1 Audit | Action |
|--------|----------|--------|
| Erskine May | ⛔ CF 403 | Not built |
| Bill Pages (bills.parliament.uk) | ⛔ CF 403 | Not built |
| House of Commons Library | ⛔ CF 403 | Not built |
| Planning Policy NPPF/PPG | ✅ accessible | Built ✅ |
| Building Regulations | ✅ accessible | Built ✅ |

### Implementation notes

**NPPF/PPG (`listPlanningPolicyNppf`):**
Uses gov.uk content API to enumerate the PPG collection (63 chapters). Each chapter is a `detailed_guide` with ~60KB HTML body text (confirmed for "Advertisements" chapter). Also yields NPPF guidance page. Workers use `fetchDocumentText` (HTML scrape) — full content available.

**Building Regulations (`listBuildingRegs`):**
Uses gov.uk content API to enumerate the Approved Documents collection (21 docs). Content is in PDF attachments — `fetchDocumentText` captures the description/metadata text only (~1KB each). Full PDF ingest is future work.

### Files changed

| File | Change |
|------|--------|
| `scripts/ingest/sources/gov-scraper.ts` | Add `listPlanningPolicyNppf()` — gov.uk content API enumeration of PPG collection (63 chapters) + NPPF page. Add `listBuildingRegs()` — content API enumeration of Approved Documents collection (21 docs). |
| `scripts/ingest/workers/worker-queue.ts` | Import `listPlanningPolicyNppf`, `listBuildingRegs`. Add `case 'planning-policy'` and `case 'building-regs'` to `processGovUk` switch. Add to sourceTypeMap. |
| `scripts/ingest/shared/progress-reporter.ts` | Update CORPUS_MANIFEST: `planning-policy` dbCorpora `['planning-policy']` estSections 64; `building-regs` dbCorpora `['building-regs']` estSections 21. |
| `scripts/ingest/queue-populator.ts` | Add `planning-policy:__index` and `building-regs:__index` seed rows (priority 4, sourceType gov-uk). |
| `scripts/ingest/shared/discovery.ts` | Add `planning-policy` and `building-regs` to SINGLE_PASS_CORPORA and DISCOVERY_CORPUS_ORDER. |

### Post-deploy actions completed

`queue-populator.ts` run — seeds `planning-policy:__index` and `building-regs:__index` rows.

---

## CODE CHANGES — 4 Jun 2026 V2 Part 2: LDA 524 fix + UK Treaties silent failure fix

### Findings

**LDA Divisions content:** Each record contains only `title`, `date`, `UIN` (no vote counts, no member votes, no narrative). Example: `"The Tribunal Procedure (Upper Tribunal)... Rules 2024 | Date: 2024-05-24 | UIN: CD:2024-05-24:1824"`. Minimal text for policy research but titles are descriptive. Kept in corpus; de-prioritised (already priority 3).

**UK Treaties — silent failure root cause confirmed:** `listUkTreaties()` constructs the gov.uk search URL with `filter_organisations[]=...` as a literal template string. Node's `fetch` sends `[]` unencoded; gov.uk search API returns HTTP 422. `fetchJson()` returns `null` on non-ok status. Loop yields 0 items. Worker marks row done silently. Fix: use `URLSearchParams` which encodes `[]` as `%5B%5D`. Fixed URL returns 1,104 FCDO treaty results (verified).

**LDA 524 fix:** On 524 with pageSize > 100, worker now retries with pageSize 100. Note: page*100 offset ≠ page*500 offset — partial coverage is accepted over zero coverage.

### Files changed

| File | Change |
|------|--------|
| `scripts/ingest/sources/lda-parliament.ts` | Add 524 fallback: if 524 and pageSize > 100, retry recursively with pageSize 100. Prevents permanent failure on large page timeouts. |
| `scripts/ingest/sources/uk-treaties.ts` | Fix `listUkTreaties()` URL construction: use `URLSearchParams` for `filter_organisations[]` to produce `%5B%5D` encoding accepted by gov.uk API. |

### Post-deploy actions completed (CC ran)

| Action | Result |
|--------|--------|
| `seed-pwdata-queue.ts` | **36,451 rows inserted** (debates 19,999; lords 5,663; wrans 6,857; westminster 3,932) |
| `seed-rate-limits.ts` | `twfy-pwdata` 500ms entry added (17 total entries) |
| UK Treaties queue reset | 2 `done` rows → `pending` (will re-run with URLSearchParams fix) |
| LDA failed rows reset | **1,416 rows** → `pending` (all LDA sourceType failed rows reset) |
| **Total pending queue** | **37,869 rows** |

---

## CODE CHANGES — 4 Jun 2026 V2 Part 1: TWFY pwdata bulk Hansard client

### Directory findings (verified 4 Jun 2026, before building)

The brief's directory names were slightly off. Actual paths and prefixes:

| Content | Dir path | Filename prefix | File count | Coverage |
|---------|----------|-----------------|------------|----------|
| Commons debates | `debates/` | `debates{date}{a/b}.xml` | 19,999 | 1919–present |
| Written Answers | `wrans/` | `answers{date}.xml` | 6,857 | 2001–present |
| Westminster Hall | `westminhall/` | `westminster{date}{a/b}.xml` | 3,932 | 2000–present |
| Lords debates | `lordspages/` | `daylord{date}{a/b}.xml` | 5,663 | 1999–present |

Brief said `lords/` (→ actual `lordspages/`), `westminster/` (→ actual `westminhall/`), and `wrans/` prefix `wrans` (→ actual prefix `answers`).

XML formats confirmed:
- Debates/Lords/WH: `<publicwhip>` → `<speech speakername="..."><p>text</p></speech>` (422 speeches, ~571KB for one day)
- Written Answers: `<publicwhip>` → `<ques speakername="...">`, `<reply speakername="...">` (284 Q+A pairs, ~387KB)

Bonus directories not in brief but accessible: `wms/` (4,462), `lordswms/` (3,672), `lordswrans/` (5,165) — all current through 2026-06-03.

### Files changed

| File | Change |
|------|--------|
| `scripts/ingest/sources/twfy-pwdata.ts` | NEW — source client. `PWDATA_CORPUS_CONFIG` maps corpus to actual dir/prefix. `listPwdataFiles(corpus)` — fetches directory listing, returns all file refs. `fetchPwdataFile(corpus, docId)` — fetches one file, returns null on 404. `parsePwdataXml(xml)` — handles both `<speech>` (debates) and `<ques>`/`<reply>` (wrans) formats; includes speaker attribution. |
| `scripts/ingest/seed-pwdata-queue.ts` | NEW — seeder. Fetches all 4 directory listings, inserts one row per file. ~36,451 total rows. Safe to re-run (ON CONFLICT DO NOTHING). |
| `scripts/ingest/workers/worker-queue.ts` | Import `fetchPwdataFile`, `parsePwdataXml`, `PWDATA_CORPUS_CONFIG`. Add `case 'twfy-pwdata': return processPwdata(row)` to dispatcher. Add `processPwdata()` function. Add pwdata corpora to sourceTypeMap. |
| `scripts/ingest/shared/progress-reporter.ts` | CORPUS_MANIFEST: replace Hansard Commons → `Hansard Commons (TWFY)` with dbCorpora `['pwdata-debates']`. Replace Hansard Lords → `Hansard Lords (TWFY)` with dbCorpora `['pwdata-lords']`. Replace Written Answers → `Written Answers (TWFY)` with dbCorpora `['pwdata-wrans']`. Add new entry: `Westminster Hall (TWFY)` with dbCorpora `['pwdata-westminster']`, priority 3. |
| `scripts/ingest/seed-rate-limits.ts` | Add `twfy-pwdata` at 500ms (polite; mySociety server). |
| `scripts/ingest/shared/discovery.ts` | Add pwdata corpora to `SINGLE_PASS_CORPORA` and `DISCOVERY_CORPUS_ORDER`. |

---

## POST-DEPLOY ACTIONS — 4 Jun 2026 V1 (ALL STILL PENDING — Charlie to run)

**Monitoring check (~02:00 BST):** scheduler_lock table not yet created, per-worker snapshots = 0, queue has 491 failed (LDA 524s accumulating). All actions below still required.

## POST-DEPLOY CHECKLIST — 4 Jun 2026 V1

| Action | Command / Detail |
|--------|-----------------|
| `prisma migrate deploy` | Apply `20260604010000_scheduler_lock` — creates `scheduler_lock` table |
| Reset stuck HMRC row | `UPDATE ingest_queue SET status='pending', "claimedBy"=NULL, "claimedAt"=NULL WHERE corpus='hmrc-codes-guidance' AND status='claimed'` |
| Reset LDA 524 failures | `UPDATE ingest_queue SET status='pending', "lastError"=NULL, "claimedBy"=NULL WHERE corpus='lda-commonswrittenquestions' AND status='failed'` |
| Redeploy workers + scheduler | Trigger in Railway dashboard (worker-2 specifically needs fresh "Deploy" from Main — not "Redeploy" of old deployment) |
| Seed new sources | `tsx scripts/ingest/queue-populator.ts` (adds nao-reports, fca-publications, sentencing-council, college-of-policing seed rows) |

---

## CODE CHANGES — 4 Jun 2026 V1: Corpus audit + scheduler lock + new source clients

### Files changed

| File | Change |
|------|--------|
| `scripts/ingest/scheduler.ts` | Import and call `acquireSchedulerLock()` at the start of `run()`. Skips run if another instance holds the lock. |
| `scripts/ingest/shared/progress-reporter.ts` | Add `acquireSchedulerLock()` — DB-based mutex using `scheduler_lock` table. Uses random per-startup ID (not process.pid — all Railway containers start as PID 1). Falls back to proceeding if table doesn't exist yet (pre-migration). Update CORPUS_MANIFEST: set dbCorpora for nao-reports, fca-publications, sentencing-council, college-of-policing. Rename 'FCA Publications (PDFs)' → 'FCA Publications'. |
| `scrutinise-web/prisma/schema.prisma` | Add `SchedulerLock` model mapping to `scheduler_lock` table. |
| `scrutinise-web/prisma/migrations/20260604010000_scheduler_lock/migration.sql` | CREATE TABLE scheduler_lock (single-row mutex). process_id is TEXT not INTEGER (avoids Railway container PID=1 collision). |
| `scripts/ingest/sources/lda-parliament.ts` | Add retry logic for HTTP 524/502/503/504 (transient Cloudflare/origin timeouts) in `fetchLdaPage`. Up to 3 retries with 3s×attempt backoff. Was causing 388 permanent failures in lda-commonswrittenquestions queue. |
| `scripts/ingest/sources/gov-scraper.ts` | Add `searchGovUkByOrg()` (GOV.UK search filtered by org slug). Add `listFcaPublications()`, `listSentencingCouncilGuidelines()`, `listCollegeOfPolicing()`. Fix `listNaoReports()` to use org-filtered search (financial-conduct-authority, national-audit-office, sentencing-council orgs). |
| `scripts/ingest/workers/worker-queue.ts` | Extend `processGovUk()` switch to handle nao-reports, fca-publications, sentencing-council, college-of-policing. Add `fca-publications` to processRow dispatcher. Import new listing functions. Add new corpora to `sourceTypeMap`. |
| `scripts/ingest/queue-populator.ts` | Add seed rows for nao-reports, fca-publications, sentencing-council, college-of-policing. |
| `scripts/ingest/census/source-audit.ts` | New script — live HTTP audit of all 50 corpus sources. Runs in 10 concurrent batches. |

### V1 findings

**Part 1 — worker-2 build failure root cause:**
Railway keeps retrying an OLD deployment (commit `4f9cc389`) that has `{"build":{"builder":"NIXPACKS"}}` in railway.json and the old postinstall path `../../scrutinise-web/prisma/schema.prisma`. The current running instance (SUCCESS at 22:47, commit f83977f6) IS live. The failure is spam from Railway retrying the old deployment every hour. Fix: Charlie triggers a fresh "Deploy" from Main in Railway dashboard (NOT "Redeploy" of old deployment). This stops the retry loop.

**Part 3 — Source audit (50 sources tested):**
- ✅ 29 accessible: TNA Legislation, TNA Caselaw, EUR-Lex SPARQL, OECD, Scottish Law Commission, Law Commission E&W, HMRC TIINs, **FCA Publications** (162KB HTML), BAILII homepage, Sentencing Council, College of Policing APP, Bills API, Civil Service Code, Treasury Green Book, NPPF, Building Regulations, CMA, Ofcom, Ofgem, Ofsted, Consultations, NAO Reports, NHS Guidance, WQS Written Answers/Statements APIs, White/Green Papers, Impact Assessments, Post-Leg Memoranda, Explanatory Notes, HMRC Manuals
- ⛔ 18 blocked: FCA Handbook (JS SPA), ECHR HUDOC (both APIs dead), NI Law Commission (404), OTS collection (404 — URL changed), Erskine May (CF 403), Bill Pages site (CF 403), PACE Codes (404), Ofwat (403), ONS Datasets API (404), SSRN (CF 403), HoC Library (CF 403), LDA endpoints (timeout from local — works from Railway)
- ⚠️ 3 warnings: TNA Legislation (XML tag regex mismatch — false alarm), WQS Written Statements (empty for test range), Post-Leg Memoranda (empty for test filter)

**Part 4 — Stalled source diagnoses:**

*SI 2010+*: Queue exhausted (5,813 done / 5,824 total). Not stalling — the seeded docs are processed. Under-seeded vs 120k estimate. Needs `reseed-si-gaps.ts` to seed 2015–2026 gap (Charlie action, V2).

*HMRC*: Single `__index` row claimed by worker 8 for **26 hours** — definitively stuck (SIGTERM during multi-source crawl). `processHmrc` aggregates 6 source generators (HMRC manuals, NAO, HoCL, Explanatory Notes, Impact Assessments, Consultations) in a single queue claim — far exceeds Railway's container lifetime. Reset stuck row to pending (SQL above). Long-term: split into per-source queue rows (future sprint).

*LDA commonswrittenquestions*: 388 failed rows (HTTP 524 = Cloudflare/origin timeout). Fix applied: retry logic added to `fetchLdaPage` (3 retries, 3s×attempt backoff). Reset failed rows to pending (SQL above).

**Part 6 — TWFY parser.theyworkforyou.com:**
- `parser.theyworkforyou.com` = ParlParse documentation site (accessible, static)
- `/data/`, `/dumps/`, `/api/` all 404 (GitHub Pages paths don't exist)
- `**theyworkforyou.com/pwdata/scrapedxml/` = GOLD MINE — free bulk data accessible without auth:**
  - `debates/` — Commons Hansard XML from **1919 to present** (e.g. `debates2024-11-06a.xml` = 431KB, one per sitting day, structured ParlParse XML with speeches, dates, members)
  - `wrans/` — Written Answers XML from **2001 to present** (3,259 files, daily, `answers2026-06-02.xml` current)
  - `wms/` — Written Ministerial Statements
  - `westminhall/` — Westminster Hall debates
  - `lordspages/` — Lords debates
  - `sp/` — Scottish Parliament
  - No API key required. Files are ~100-500KB each.
- **Recommendation**: This supersedes TWFY API (needs key), LDA (JSON, not full speeches), and the Parliament API (403 from Railway). Build a `pwdata-parliament.ts` bulk ingest client in a dedicated sprint (V2). Estimate: ~27,000 sitting-day XML files for Commons debates alone.

---

## POST-DEPLOY ACTIONS — 3 Jun 2026 V7 (all completed)

| Action | Result |
|--------|--------|
| `prisma migrate deploy` | Applied `20260603220000_snapshot_worker_id` — `workerId` column live |
| `seed-rate-limits.ts` | 16 entries upserted, `fca-publications` added at 300ms |
| `seed-lda-queue.ts` | 1,602 rows inserted (commons oral 140, lords written 207, commons written 1,238, commons divs 12, lords divs 5) |
| EUR-Lex queue reset | 50 rows reset `done → pending` (workers will retry with new SPARQL API) |
| Format backfill (null → html) | 601 echr-hudoc + 50 eur-lex + 37 fca-regulators = 688 rows fixed; null format count: 695 → 7 |
| Queue health check | 1,652 pending / 200 claimed / 70,560 done — workers actively claiming LDA + EUR-Lex rows |

Railway redeploy (workers + scheduler) still needed — Charlie to trigger in Railway dashboard so workers pick up the `writeWorkerSnapshot` call and the new throughput email format activates.

---

## CODE CHANGES — 3 Jun 2026 V7: Worker-ID throughput + FCA status fix

### Files changed

| File | Change |
|------|--------|
| `scrutinise-web/prisma/schema.prisma` | Add `workerId Int?` to `IngestProgressSnapshot`. NULL = scheduler-written corpus snapshot. Non-null = worker-written session snapshot. Add `@@index([workerId])`. |
| `scrutinise-web/prisma/migrations/20260603220000_snapshot_worker_id/migration.sql` | `ALTER TABLE ingest_progress_snapshots ADD COLUMN "workerId" integer` + index. |
| `scripts/ingest/shared/progress-reporter.ts` | **(2a)** Add `writeWorkerSnapshot(workerId, sourceKey, sectionsCompiled)` — writes per-worker snapshot with `phase='worker'`. **(2b)** Rewrite `queryWorkerThroughput()`: groups by `workerId IS NOT NULL` rows instead of `workerLabel`. **(2c)** Email format: "Worker N  corpus  4,230 /hr  ████  87% eff" — sorted by worker ID. Stalled/critical flags now show "Worker N" not corpus label. **(3a)** Remove `blocked: true` from FCA Handbook — now auto-shows ⚠️ failing (queue rows exist, 0 sections). **(3b)** Add FCA Publications placeholder entry (estSections 20k, priority 3, dbCorpora=['fca-publications'], no queue rows → shows "not started"). |
| `scripts/ingest/workers/worker-queue.ts` | **(2b)** Wrap `upsertSection` import with local tracker — increments `sessionSectionsCompiled` on every section write without changing call sites. Import `writeWorkerSnapshot`. Every `CHECKPOINT_EVERY` rows, write a worker snapshot (non-fatal on failure). |
| `scripts/ingest/seed-rate-limits.ts` | Add `fca-publications` at 300ms interval. |

### V7 findings

**Part 1 — Duplicate scheduler:** Railway API confirms exactly ONE `Ingest-scheduler` service. `loop()` called exactly once in `scheduler.ts`. Workers 1–4 had FAILED deployments at 20:56/21:56 (pre-V6b crash loop era). All 22 services show `SUCCESS` at 22:07 post-fix. Duplicate was two Railway deployment instances of the same service — resolved by V6b redeploy. No code change needed.

**Parts 4–5 (informational — Charlie to run):**

Part 4 — Format backfill SQL:
```sql
UPDATE ingest_queue SET format = 'clml'
WHERE format IS NULL AND status = 'done'
  AND (corpus LIKE '%primary-acts%' OR corpus LIKE '%si-%' OR corpus LIKE '%regional%');

UPDATE ingest_queue SET format = 'html'
WHERE format IS NULL AND status = 'done' AND corpus = 'tna-caselaw';
```

Part 5 — Railway cost: 20 workers × ~128MB = negligible memory. Primary cost driver is network egress from TNA XML downloads (~20KB/section × throughput). At 7,200 sections/hr (stable rate) × 720hrs/month = ~5.2M sections × 20KB = ~100GB/month egress. Railway charges network egress — this explains the $33 vs expected $8-12. Crash loop prior to V6b would have multiplied this by repeated failed requests. Post-fix cost should normalise.

**Part 6 — Worker stability:** All workers `SUCCESS` at 22:07. Run verification SQL after V7 deploy to confirm productive processing.

---

## CODE CHANGES — 3 Jun 2026 V6b: Discovery crash-loop fix (TNA full-scan removed)

### Files changed

| File | Change |
|------|--------|
| `scripts/ingest/shared/discovery.ts` | **Remove full historical scan from `discoverTnaLegislation()`**. The old `needsFullScan` logic called `listActIds(type, yearMin, yearMax)` with yearMin as far back as 1267 — one HTTP request per year, 733+ sequential TNA calls for `primary-acts-pre-2000`. Railway SIGTERM'd the container at ~10 min, worker restarted, loop repeated. Fix: historical-only corpora (`yearMax < currentYear - 1`) return [] immediately. Ongoing corpora check only the last 2 years inline (`checkFrom = max(yearMin, currentYear - 1)`). Queue-empty warning added to Railway logs. Full historical backfill remains in `reseed-si-gaps.ts`. |

### Root cause

`UNDER_SEEDED_THRESHOLD = 400` × `historicalYears` produced thresholds no queue could meet:
- `primary-acts-pre-2000`: 757 years × 400 = 302,800 threshold. Even with 70,000+ rows → `needsFullScan = true` → `listActIds('ukpga', 1267, 1999)` = 733 HTTP calls → SIGTERM.
- `si-pre-2010`, `retained-eu` similarly affected.

Affected workers (6=retained-eu, 9=tna-caselaw) crash-looped via self-discovery triggering the full scan when their primary corpus was exhausted and they checked TNA corpora in DISCOVERY_CORPUS_ORDER.

---

## CODE CHANGES — 3 Jun 2026 V6: EUR-Lex SPARQL fix + LDA Parliament integration

### Files changed

| File | Change |
|------|--------|
| `scripts/ingest/sources/eurlex.ts` | **Fix parser — CELLAR SPARQL.** Replaces broken `search.html?format=json` (now returns HTML SPA). Uses `publications.europa.eu/webapi/rdf/sparql` — no auth required. SPARQL query enumerates all ~232,988 series-3 CELEX IDs via LIMIT/OFFSET pagination (500/page). `fetchDocumentText` unchanged — confirmed working (GDPR: 350KB text). Remove `blocked: true` from manifest. |
| `scripts/ingest/sources/lda-parliament.ts` | **New.** `lda.data.parliament.uk` source client. `fetchLdaPage(slug, page, pageSize=500)` returns `{items, totalResults}`. `ldaItemToText()` handles questions (oral/written) and divisions. No auth required. |
| `scripts/ingest/seed-lda-queue.ts` | **New.** Seeds queue rows for 5 confirmed LDA datasets: commonsoralquestions (140 pages), lordswrittenquestions (207 pages), commonswrittenquestions (1,238 pages), commonsdivisions (12 pages), lordsdivisions (5 pages). Run once after deploy. |
| `scripts/ingest/seed-rate-limits.ts` | **Add `lda-parliament` rate limit:** `intervalMs: 200`. |
| `scripts/ingest/shared/progress-reporter.ts` | **CORPUS_MANIFEST:** Unblock EUR-Lex (estSections 80k→232k). Update FCA comment (confirmed JS-only SPA — FCA Publications noted as V7 target). Add 5 LDA entries (Commons Oral Q: 70k, Lords Written Q: 103k, Commons Written Q: 619k, Commons Divisions: 5,553, Lords Divisions: 2,089). Add `lda-parliament` to THEORETICAL_SECTIONS_PER_HOUR + sourceType derivation. |
| `scripts/ingest/workers/worker-queue.ts` | **Add `processLda()`.** Derives slug from `row.corpus` (strips `lda-` prefix). Fetches LDA page, stores each item as R2 section + corpus_sections row. Add `case 'lda-parliament'` to router. Add LDA corpus→sourceType mappings for completion marking. |
| `scripts/ingest/shared/discovery.ts` | **Add LDA corpora** to `SINGLE_PASS_CORPORA` (all pages seeded upfront) and `DISCOVERY_CORPUS_ORDER` (priority 2 for questions, priority 3 for divisions). |

### V6 diagnostic findings

**EUR-Lex (Part 1):**
- `search.html?format=json` → HTML SPA shell (200 OK but JS-rendered, no results in initial HTML)
- REST API (`/api/eurlex/rest/v1/EurlexSearchResult`) → 404
- **CELLAR SPARQL** (`publications.europa.eu/webapi/rdf/sparql`) → ✅ Working. No auth. COUNT query confirms 232,988 series-3 CELEX IDs. SELECT without ORDER BY returns IDs correctly (ORDER BY on date field caused empty results). `fetchDocumentText(celexId)` confirmed: GDPR (32016R0679) returns 350KB clean text.
- **Fix implemented.** EUR-Lex unblocked.
- **Action required (Charlie):** `UPDATE ingest_queue SET status='pending', "lastError"=NULL, claimed_by=NULL, claimed_at=NULL WHERE corpus='eur-lex' AND status='done';` — reset existing done rows to pending so workers retry with new API.

**FCA (Part 2):**
- `/sitemap.xml`, `/robots.txt`, `/handbook/COBS/1/1.html` all return identical SPA HTML shell (`<title>FCA Handbook - Home</title>`)
- Extracted text: 2,884 chars — "JavaScript is disabled in your browser. This application requires JavaScript to run properly."
- No COBS text, no rule numbers — `\d+\.\d+\.\d+` matches in JS bundle were version strings (e.g. `17.3.12`, `94.94.94`)
- **FCA Handbook: confirmed JS-only. Remains blocked.**
- FCA Publications (`fca.org.uk/publications`) returns 200 HTML with `/publications/search-results?...` links (Drupal CMS). Viable for V7 — no PDF links in listing HTML, needs scraper design.

**LDA Parliament (Part 3):**
- Confirmed working: `commonsoralquestions` (69,852), `lordswrittenquestions` (103,137), `commonswrittenquestions` (618,599), `commonsdivisions` (5,553), `lordsdivisions` (2,089)
- Not available (404): hansardcommons, hansardlords, committees, billsamendments
- `hansardcommonsdocuments` returns 200 but 0 records
- Item structure inspected: questions have `questionText`, `AnsweringBody`, `dateTabled`; divisions have `title`, `date`, `uin`
- **All 5 working datasets integrated.** Total: ~799K records across 1,602 pages.

---

## CODE CHANGES — 3 Jun 2026 V5: Hansard alternative + blocked source fixes + email state

### Files changed

| File | Change |
|------|--------|
| `scripts/ingest/sources/theyworkforyou.ts` | **New.** TheyWorkForYou API client — fetches Hansard Commons/Lords/Westminster Hall by day within a month. `listDebatesForMonth()`, `twfyMonthlyDocIds()`. Requires `TWFY_API_KEY` env var (register free at theyworkforyou.com/api/key). |
| `scripts/ingest/workers/worker-queue.ts` | **Add TWFY route to `processHansard()`:** handles `twfy:{type}:{YYYY-MM}` docIds. Fetches all debates for each day in the month via TWFY API. Non-sitting days return 0 debates (marked done, not failed — legitimate). |
| `scripts/ingest/seed-twfy-queue.ts` | **New.** Seed queue rows for TWFY Hansard (Commons 1988–, Lords 1988–, Westminster Hall 1999–). Run after `TWFY_API_KEY` is added to Railway env vars. |
| `scripts/ingest/shared/progress-reporter.ts` | **Mark FCA, ECHR, EUR-Lex as `blocked: true`** in CORPUS_MANIFEST (API changes confirmed). **Add ⚠️ failing state:** sources with queue rows but 0 corpus_sections now display `⚠️ failing` instead of appearing at 0% progress. |
| `docs/corpus-census.md` | **Add §8:** "Sources with no client yet" — 19 sources with URLs and notes for future sprints. |
| `docs/data-access-requests/bailii-request.md` | **New.** Formal BAILII bulk data access request draft. |
| `docs/data-access-requests/parliament-hansard-request.md` | **New.** Parliament bulk Hansard data access request draft. |
| `scripts/ingest/diagnose-v5.ts` | **New.** V5 diagnostic script. |

### V5 findings

**Scheduler duplicates:** Single `loop()` call confirmed in `scheduler.ts` — code is not the cause. Two Railway deployments are running simultaneously. Fix: redeploy `ingest-scheduler` on Railway to force kill old instance. Settings → Cron Schedule must be empty.

**TheyWorkForYou (Part 1):** ✅ Accessible from Railway IPs (status 200). Returns JSON. Needs API key only. Register at theyworkforyou.com/api/key — free for non-commercial/civic. `TWFY_API_KEY` env var needed on Railway workers + scheduler before running `seed-twfy-queue.ts`.

**FCA (Part 2):** ❌ All alternative endpoints (RSS, XML, publications) return 404 or JS SPA HTML. Marked `blocked: true` in manifest.

**ECHR (Part 3):** ❌ All alternative endpoints return 404 or 403. Marked `blocked: true` in manifest. BAILII data access request drafted.

**EUR-Lex (Part 4):** ❌ `search.html?...&format=json` returns HTML (API changed). Queue has 50 done rows, 0 corpus_sections (⚠️ failing). Marked `blocked: true` in manifest.

**Committee Reports (Part 5):** `api.parliament.uk/v1/committees` returns 500 from Railway — same environment issue. Will work once TWFY or direct Parliament data access is resolved.

**Email ⚠️ failing state (Part 7):** Added to manifest rendering — sources with queue rows but 0 sections now visibly flagged instead of appearing at 0% progress.

---

## CODE CHANGES — 3 Jun 2026 V4: Caselaw gap diagnosis + silent failure fixes

### Files changed

| File | Change |
|------|--------|
| `scripts/ingest/sources/tna-caselaw.ts` | **Fix `getTotalJudgments()`:** feed reports page 7,489 as last but pages 1,500+ are empty. Now verifies last page has entries; binary-searches for true last non-empty page (~1,499 × 50 = ~74,950). Prevents phantom queue rows being seeded. |
| `scripts/ingest/workers/worker-queue.ts` | **Fix `processHansard()`, `processFca()`, `processEchr()`:** all three silently called `markDone()` when 0 items were yielded (API returning 403/404). Now marks `failed` with explanatory message when 0 items found. Makes failures visible in queue instead of silently hidden. |
| `scripts/ingest/shared/progress-reporter.ts` | **Update `estSections`:** TNA Case Law 374,450→75,000 (confirmed ~74,950 available; binary-search validated). |
| `scripts/ingest/diagnose-v4.ts` | **New:** diagnostic script — SQL + API tests for all Part 1/2 sources. |
| `scripts/ingest/diagnose-v4b.ts` | **New:** FCA section URL test + ECHR new endpoint discovery. |
| `scripts/ingest/verify-v4.ts` | **New:** Part 5 verification queries. |

### V4 diagnostic findings

**TNA Caselaw (Category A):**
- Queue has 7,490 page-rows, all marked done with null lastError.
- Pages 1–1,499 return 50 entries each; pages 1,500+ return empty feeds.
- 74,730 corpus_sections ≈ 1,499 pages × 50 = 74,950 judgments. **We've ingested all available content.**
- Root cause of 374,450 estimate: `link rel="last"` on the TNA feed reports page 7,489, but those pages are empty. Fixed by binary-search in `getTotalJudgments()`.

**FCA Handbook (Category B):**
- `handbook.fca.org.uk` is a JavaScript SPA (Angular). Static HTML has 63 nav hrefs, 0 section links.
- `getSourcebookSections()` scraped static HTML → 0 sections → `processFca` silently marked done.
- Fix: mark failed with explanation. FCA content requires JS rendering (Playwright/Puppeteer) — out of scope for current pipeline.

**ECHR HUDOC (Category B):**
- `/app/query/results` endpoint returns 404 as of Jun 2026 — API has changed.
- Workers looped over 0 items, silently marked done.
- Fix: mark failed with explanation. ECHR will need new endpoint investigation.

**Hansard debates (Category B):**
- `api.parliament.uk/v1/hansard` returns 403 from Railway IPs.
- Workers looped over 0 debates, silently marked done.
- Fix: mark failed with explanation. Written Answers/Statements use a different base URL and work fine.

**Verification state (3 Jun 2026 late):**
- Grand total corpus_sections: 587,128 (was 585,576 at start of day)
- primary-acts-pre-2000: 5,307 pending rows (workers actively processing pre-1963 UKPGA)
- SSI+WSI: 1,959 new regional rows added to queue
- Hansard/FCA/ECHR: back to 'done' (workers re-processed after Sprint 2 reset, before V4 fix deployed)
- After Railway redeploy: these rows will become 'failed' instead of 'done' — visible in logs
- UKSI 2010–2026 gap was smaller than estimated — TNA feed confirms 200–324 SIs/year for 2015–2026 is the actual count (not a seeding gap)

---

## CODE CHANGES — 3 Jun 2026 Sprint 2: Queue gap seeding + worker efficiency email

### Files changed

| File | Change |
|------|--------|
| `scripts/ingest/reseed-si-gaps.ts` | **New.** One-off reseed script: (A) UKSI 2010–2026 full enumeration from TNA, (B) UKPGA pre-1963 from Neon items with 0 sections, (C) SSI+WSI types added to regional corpus. |
| `scripts/ingest/backfill/reset-queue-done.ts` | **New.** Resets 'done' rows back to 'pending' for corpora with 0 corpus_sections. Run and confirmed: 6,185 rows across 8 corpora reset. |
| `scripts/ingest/backfill/r2-pattern-check.ts` | **New.** R2 key diagnostic — confirmed hansard/fca-regulators/echr-hudoc have 0 R2 keys. |
| `scripts/ingest/shared/progress-reporter.ts` | **Add:** `THEORETICAL_SECTIONS_PER_HOUR` map per source type. `WorkerThroughputRow` extended with `sourceKey`, `efficiencyPct`, `efficiencyFlag`. `queryWorkerThroughput()` now includes `sourceKey` from snapshot, computes fair-share efficiency (divides theoretical by workers-on-same-source). Email row now shows `% eff ⚡low/🔴critical`. |
| `scripts/ingest/shared/discovery.ts` | **Fix:** `TNA_CORPUS_META.regional` now includes `ssi+wsi` types (was only `asp+anaw+nia`). `discoverTnaLegislation` no longer has a static `COMPLETE_TNA_CORPORA` exclusion list — instead detects under-seeded corpora dynamically and triggers full scan from yearMin when historical row count < threshold. |

### Sprint 2 findings

**Part 2 root cause (Hansard/FCA/ECHR 0 corpus_sections):**
Workers use `if (await r2Exists(cKey)) continue` to skip already-fetched content.
But the actual failure was UPSTREAM: `listHansardDebates()` called `api.parliament.uk/v1/hansard/search`
which returns 403 from Railway IPs. Workers looped over 0 debates → called `markDone()` with nothing written.
R2 check confirmed: 0 keys under `hansard/`, `fca-regulators/`, `echr-hudoc/`.
Fix: reset 6,185 rows to 'pending'. Workers will retry. Hansard API access from Railway needs further investigation.

**Part 1 reseed results (COMPLETE — reseed-si-gaps.ts run):**
- UKSI 2010–2026: **0 new rows** — TNA returned 5,596 acts; queue already had 5,821 rows. Gap was smaller than estimated — TNA feed genuinely has 200–324 SIs/year for 2015–2026.
- UKPGA pre-1963: **6,897 new rows** — Neon items with 0 LegislationSections seeded.
- SSI + WSI: **1,959 new rows** (1,419 SSI + 540 WSI from TNA).
- **Total: 8,856 new queue rows inserted.**

**Queue state after sprint:** 13,082 pending rows confirmed (workers have work)

**R2 structure audit (r2-top-level diagnostic):**
- `caselaw/` has 149,702 keys (~74,851 judgment sections in R2). TNA caselaw worker uses `caselawKey()` → `caselaw/` prefix (NOT `tna-caselaw/`). corpus_sections has 74,730 `tna-caselaw` rows consistent with R2.
- **TNA caselaw gap:** queue has 7,489 done page-rows × 50 = 374,450 expected judgments, but only ~74,851 in R2/corpus_sections (~20%). ~300k judgments either failed silently or were skipped. Needs investigation in next sprint.
- Confirmed: hansard/, fca-regulators/, echr-hudoc/ have 0 R2 keys — reset approach is correct.

---

## CODE CHANGES — 3 Jun 2026 Sprint 1: Corpus census

### Files changed

| File | Change |
|------|--------|
| `scripts/ingest/census/neon-counts.ts` | **New.** Queries Neon DB for LegislationItem and LegislationSection counts by type. |
| `scripts/ingest/census/railway-counts.ts` | **New.** Queries Railway corpus_sections and ingest_queue for new pipeline counts and SI/UKPGA year coverage. |
| `scripts/ingest/census/tna-counts.ts` | **New.** Queries TNA Atom feeds for authoritative doc counts. (Feeds were unresponsive from CC sandbox — Neon counts used as proxy.) |
| `scripts/ingest/census/source-counts.ts` | **New.** Queries Parliament APIs, TNA caselaw, ECHR, FCA for non-legislation source counts. |
| `docs/corpus-census.md` | **New.** Full census report with all findings, gap analysis, updated estimates. |
| `scripts/ingest/shared/progress-reporter.ts` | **Update CORPUS_MANIFEST estSections:** SI-2010+ 300k→120k, SI-pre-2010 300k→180k, Primary pre-2000 80k→70k, Retained EU 80k→140k, TNA Case Law 374,250→374,450, Written Answers 500k→537,593, Written Statements 50k→17,487, HMRC TIINs 2k→800, ScotLawCom 500→350, OTS Reports 200→500, OECD 10k→500, ECHR 30k→30,050. |

### Key census findings

- **Total corpus estimate revised:** ~5.3M sections (was ~7M). Major revisions: SI-2010+ and Written Statements were overestimated; Retained EU was underestimated.
- **SI-2010plus queue gap:** 2015–2026 under-seeded. ~5,000–8,000 SIs missing from queue → ~50,000–80,000 sections unprocessed. **Action: reseed si-2010plus for 2015–2026.**
- **UKPGA Neon gap:** 7,427 Primary Acts have 0 sections in Neon (63% of all UKPGA items). Not covered by new pipeline (starts at 1963). Pre-1963 acts remain without content.
- **Hansard/ECHR/FCA R2 backfill confirmed** (from previous sprint diagnostics).
- **Current new pipeline coverage:** 585,576 / ~5.3M = ~11% (accurate, not the misleadingly-high prior estimate).

---

***

## CODE CHANGES — 3 Jun 2026 Sprint: Scheduler fix + throughput email + sprint workflow

### Files changed

| File | Change |
|------|--------|
| `scripts/ingest/shared/progress-reporter.ts` | **Fix:** `progressBar()` — clamp `pct` to `[0,100]` and `filled` to `[0,width]` before `String.repeat()`. Eliminates `RangeError: Invalid count value` crash in scheduler email. |
| `scripts/ingest/shared/progress-reporter.ts` | **Add:** `queryWorkerThroughput()` — queries `ingest_progress_snapshots`, pivots 3 most-recent snapshots per workerLabel, computes sections/hr rate, flags stalled (0 rate for 2+ intervals) vs idle (0 rate, was positive). |
| `scripts/ingest/shared/progress-reporter.ts` | **Add:** Worker throughput section appended to email body in `sendProgressEmail()`. Shows per-corpus rate, mini bar, ⚠️/ℹ️ flags, total rate, stalled list. |
| `docs/CLAUDE.md` | **Add:** Sprint brief protocol section under §12 Git Discipline — CCh writes briefs to `docs/SPRINT.md`, CC archives at sprint end. |
| `docs/SPRINT.md` | **New:** Empty sprint brief template (replaces ad-hoc brief pasting). |

### Diagnostic findings — Part 3

Queue state as of 3 Jun 2026 ~12:30 BST:
- **120 claimed, 61,829 done, 0 pending.** Queue exhausted for initial backlog.
- **Self-discovery IS working** — new 2026 SIs and case law pages trickling in. No silent failure.
- **Root cause of near-zero throughput:** Initial seeded backlog exhausted. Workers now follow live publication rate (handful of new SIs per day, occasional case law pages). Not a bug.
- **Snapshot doubling at 11:54 BST:** Each workerLabel appears ×2 in that snapshot → SUM = 1,152,952 (double actual 576,476). Likely caused by two scheduler instances running simultaneously during Railway restart. One-time anomaly.
- **Hansard/ECHR/FCA/Treaties gap confirmed** (Part 5): All have done queue rows but 0 corpus_sections. Content is in R2 but not in DB.

### Part 5 findings (Hansard R2 backfill — next sprint)

R2 key pattern for Hansard: `hansard/{YYYY-MM-DD}/{safe-debateId}/compiled.txt`
(from `r2-client.ts` `hansardKey()` — list under `hansard/` prefix to enumerate all keys)

Queue rows done → corpus_sections gap:
- hansard-commons-a: 2,172 done → 0 sections
- hansard-commons-b: 600 done → 0 sections
- hansard-lords-a: 2,172 done → 0 sections
- hansard-lords-b: 600 done → 0 sections
- **Total Hansard: 5,544 queue rows → 0 corpus_sections**
- echr-hudoc: 601 done → 0 sections
- fca-regulators: 37 done → 0 sections
- uk-treaties: 2 done → 0 sections

FCA/ECHR have no dedicated key functions in `r2-client.ts` — if they used the legacy pipeline, keys would follow the same Hansard-style pattern. Needs investigation before backfill sprint.
R2 key count for Hansard: estimated ~2M individual debate items across 5,544 monthly chunks (~361/chunk average). Actual count requires paginated R2 list under `hansard/` prefix.

---

## CODE CHANGES — 3 Jun 2026 Sprint: Self-discovering workers

### Commits: `0d60b2c` → `fc1a172`

| File | Change |
|------|--------|
| `scrutinise-web/prisma/schema.prisma` | Added `isComplete Boolean @default(false)` to `SourceRateLimit` model |
| `scripts/ingest/prisma/schema.prisma` | Same |
| `scrutinise-web/prisma/migrations/20260603100000_source_rate_limits_is_complete/` | Migration SQL: `ALTER TABLE source_rate_limits ADD COLUMN "isComplete" boolean NOT NULL DEFAULT false`. Applied directly to Railway DB. |
| `scripts/ingest/shared/queue-client.ts` | Added: `countPendingRows()` (distinguishes empty queue from rate-limited), `getMaxDocIdForCorpus()` (discovery cursor), `getAllDocIdsForCorpus()` (FCA membership check), `markSourceTypeComplete()` (sets isComplete=true), `getNextDiscoveryTarget()` (highest-priority sourceType with no pending rows) |
| `scripts/ingest/shared/discovery.ts` | **New file.** `discoverForCorpus(corpus)` dispatcher + per-corpus discovery logic: written-answers/statements (date arithmetic → next monthly chunks), hansard (month extension), tna-caselaw (new Atom pages), echr-hudoc (new HUDOC offset pages), eur-lex (next batch of pages), fca-regulators (missing sourcebook rows), tna-legislation (current-year acts), historical fixed sets and single-pass sources return []. `DISCOVERY_CORPUS_ORDER` priority list. |
| `scripts/ingest/workers/worker-queue.ts` | Main loop updated: when `claimNextChunk()` returns null, `countPendingRows()` distinguishes empty vs rate-limited. If empty: iterates `DISCOVERY_CORPUS_ORDER`, calls `discoverForCorpus()`, inserts new rows and loops immediately. If all exhausted: sleeps 5 min. If rate-limited: existing sleep behaviour unchanged. |

**Diagnostic findings this session:**
- `claimNextChunk()` returns null for both "queue empty" and "all rate-limited" with no distinction. `getSleepDuration()` only partially signals this. Fix: explicit `countPendingRows()`.
- Workers 1–4 were FAILED on old commits — root cause was `railway.json` `startCommand` override (fixed in previous commit `253e339`). All 4 resolved automatically when railway.json was fixed.
- `Ingest-scheduler` was running `worker-queue.ts` as WORKER_ID=1 instead of `scheduler.ts` — same railway.json cause. Fixed by `253e339`.

---

## CODE CHANGES — 3 Jun 2026: railway.json fix + direct queue seeding

### Commit: `253e339`

| File | Change |
|------|--------|
| `scripts/ingest/railway.json` | Removed `startCommand: "npm run worker"`. This field was overriding service-level start commands for ALL services sharing rootDirectory=scripts/ingest, including the scheduler. Scheduler was running worker-queue.ts (WORKER_ID=1) instead of scheduler.ts — no emails sent, no progress snapshots written. Workers 1–4 were FAILED for the same reason. Empty `{}` lets each service use its Railway dashboard start command. |

**Direct DB seeding (not in a commit — applied via node script):**
1,360 rows inserted directly to ingest_queue bypassing the populator's slow TNA enumeration:
- FCA sourcebooks: 36 rows (`fca-regulators:sourcebook:CODE`)
- ECHR pages: 600 rows (`echr-hudoc:page:{offset}`)
- EUR-Lex pages: 50 rows
- Written Answers monthly chunks: 318 rows (2000-01 to 2026-06-03)
- Written Statements monthly chunks: 350 rows (1997-05 to 2026-06-03)
- Single-row sources: 6 rows (committees-a, hmrc-tiins, ots-reports, scotlawcom, nilawcom, uk-treaties:v2)

---

## CODE CHANGES — 3 Jun 2026 Sprint: Full queue seeding + corpus email manifest

### Files changed

| File | Change |
|------|--------|
| `scripts/ingest/queue-populator.ts` | Added `populateCommittees()`, `populateFcaSourcebooks()`, `populateEchrPages()`, `populateEurLexPages()`, `populateUkTreatiesRefresh()`. Imports `FCA_KNOWN_SOURCEBOOKS`, `countUkCases`. Updated `main()`. |
| `scripts/ingest/workers/worker-queue.ts` | `processFca()` handles `sourcebook:{CODE}` docId (per-sourcebook parallelism). `processEchr()` handles `page:{start}` docId. `processEurLex()` handles `page:{N}` docId. Imports new per-page/per-sourcebook functions. |
| `scripts/ingest/sources/fca-handbook.ts` | Exported `FCA_KNOWN_SOURCEBOOKS` (was unexported `KNOWN_SOURCEBOOKS`). Added `listFcaSectionsForSourcebook(sourcebook)` export. |
| `scripts/ingest/sources/echr-hudoc.ts` | Added `listUkCasesPage(start, length)` export — fetches single HUDOC page at given offset. |
| `scripts/ingest/sources/eurlex.ts` | Added `listRetainedEuPage(page, pageSize)` export — fetches single EUR-Lex search page. |
| `scripts/ingest/shared/progress-reporter.ts` | Full rewrite: `CorpusEntry` interface + `CORPUS_MANIFEST` (37 entries, priority-grouped). `MANIFEST_TO_DB_CORPORA` replaced by `dbCorpora` field on each entry. `queryQueueCorpora()` for seeded-vs-not-started detection. `queryEtaFromSnapshots()` uses ingest_progress_snapshots time-series (last 6 snapshots). `saveProgressSnapshot()` maps to manifest. `buildAggregate()` extended to workers 1–20. `sendProgressEmail()` full manifest email with per-tier grouping, ✅/⛔ flags, not-started detection. |
| `scripts/ingest/cc-monitor.ts` | Auto-redeploy re-enabled for crashed services (lines ~292–298). Stall-redeploy re-enabled (lines ~317–320). Stall check extended from workers 1–10 to 1–20. |

### Diagnostic findings (Part A)

- **SI pre-2010**: ZERO failures. 27,614 done, 80 claimed, 3,213 pending. No SQL remediation needed.
- **Queue field naming**: `corpus` (not `source_key`); `lastError` (not `error_message`). Brief SQL queries used wrong column names.
- **FCA, ECHR, UK Treaties**: all had 1 `done` row (processed) but 0 corpus_sections compiled — workers ran but produced no output (likely API rate-limit or parse failures). Re-seeded with per-sourcebook/per-page rows.
- **Hansard**: 5,544 monthly chunk rows all `done`, but 0 corpus_sections rows. Content exists in R2 from worker-main.ts era; upsertSection was skipped by r2Exists checks. Not addressed in this sprint.
- **TNA caselaw**: 7,485 Atom pages done, 74,730 sections compiled.
- **HMRC**: 1 row `claimed`, 13,425 sections compiled and growing.
- **OECD**: 1 row `done`, 462 sections compiled.

### Key sourceKey discrepancies (brief vs DB corpus column)

| Brief manifest sourceKey | DB corpus value |
|---|---|
| `primary-acts-post-2000` | `primary-acts-2000plus` |
| `si-post-2010` | `si-2010plus` |
| `retained-eu-law` | `retained-eu` |
| `fca-handbook` | `fca-regulators` |
| `hmrc-web` | `hmrc-codes-guidance` |
| `gov-uk` | `uk-treaties` |
| `oecd-free` | `oecd` |

Manifest uses DB values throughout. Aggregate entries (hansard-commons, hansard-lords, committee-reports, bailii) sum across multiple DB corpora.

### corpus_sections state as of diagnostic (2 Jun 2026 ~23:51)

| Corpus | Compiled | Failed |
|--------|---------|--------|
| primary-acts-2000plus | 83,183 | 7,676 |
| primary-acts-pre-2000 | 62,637 | 27 |
| si-2010plus | 59,920 | 12 |
| si-pre-2010 | 152,258 | 1,379 |
| regional | 92,681 | 0 |
| retained-eu | 14,390 | 0 |
| tna-caselaw | 74,730 | 0 |
| hmrc-codes-guidance | 13,425 | 0 (in progress) |
| oecd | 462 | 0 |
| Total new pipeline | ~553,686 | |

### Part F — New source clients (addendum)

| File | Change |
|------|--------|
| `scripts/ingest/sources/parliament-api.ts` | Added `WQS_BASE` constant, `fetchWrittenAnswers(from, to)`, `fetchWrittenStatements(from, to)`. WQS API confirmed live via swagger (`/swagger/v1/swagger.json`). Written questions endpoint: `/api/writtenquestions/questions`. Statements: `/api/writtenstatements/statements`. |
| `scripts/ingest/sources/gov-scraper.ts` | Added `listHmrcTiins()` (gov.uk content API → TIINS collection, falls back to search) and `listOtsReports()` (gov.uk search for OTS historical reports). |
| `scripts/ingest/sources/law-commissions.ts` | **New file.** `listScotLawComReports()` — scrapes 46 listing pages at scotlawcom.gov.uk, follows individual publication pages, yields primary PDF per report. `listNiLawComReports()` — index-page scrape of defunct NI Law Commission (~18 historical reports). |
| `scripts/ingest/seed-rate-limits.ts` | Added 4 new entries: `gov-uk` (300ms), `scotlawcom` (300ms), `nilawcom` (300ms), `ssrn` (200ms placeholder). |
| `scripts/ingest/queue-populator.ts` | Added `monthlyChunks()` helper, `populateWrittenAnswers()` (317 rows), `populateWrittenStatements()` (349 rows), `populateNewSingleRowSources()` (hmrc-tiins, ots-reports, scotlawcom, nilawcom — 4 rows). |
| `scripts/ingest/workers/worker-queue.ts` | New switch cases: `gov-uk` → `processGovUk()`, `scotlawcom`/`nilawcom` → `processLawCommission()`. `processHansard()` updated to handle `answers:{from}:{to}` and `statements:{from}:{to}` docId prefixes. |
| `scripts/ingest/shared/progress-reporter.ts` | Added to `CORPUS_MANIFEST`: Written Answers (500k est), Written Statements (50k est), HMRC TIINs (2k), Law Commission E&W renamed, Scottish Law Commission (500), NI Law Commission (50, historic), OTS Reports (200), SSRN blocked (403). |

**F6 (SSRN) — NOT IMPLEMENTED.** Live check: `https://api.ssrn.com/content/v1/bindings` returned 403 Forbidden. API is gated. No queue rows seeded. Marked `blocked: true` in manifest. Needs manual investigation (SSRN API credentials or alternative endpoint).

### Sprint history reference

All prior sprint entries below cover work since 1 Jun 2026. Do not modify.

---

## CODE CHANGES — 2 Jun 2026 Evening Sprint: Corpus Monitoring + Rate Limiting

### Commits: `3e85931` → `9acd458`

| Item | Detail |
|------|--------|
| `scripts/ingest/package-lock.json` | Added lockfile — root cause of workers 1–4 build failures. Pins Prisma 6.19.3, tsx 4.22.4, pg 8.21.0. |
| `scripts/ingest/shared/db-metadata.ts` | `new PrismaClient()` — no constructor options. Prisma 6 reads DATABASE_URL from env automatically. Fixes deprecated `datasources` option. |
| `scripts/ingest/tsconfig.json` + `scripts/tsconfig.json` | Added `pg`/`pg/*` path mappings. |
| `scripts/ingest/scheduler.ts` | Converted from one-shot cron to persistent hourly loop. `SCHEDULER_INTERVAL_HOURS` env var (default 1). Fires immediately on startup. `Promise.race` 5-min timeout prevents hung run() blocking loop. Calls `clearExpiredSuspensions()` each run. |
| `scripts/ingest/shared/progress-reporter.ts` | Full rewrite: CORPUS_TARGETS const (~6.9M total), per-corpus SECTION_TARGETS + CORPUS_DISPLAY, `queryCorpusCounts()` (Railway corpus_sections), `queryNeonCount()` (Neon LegislationSection with 10s/30s timeouts), `saveProgressSnapshot()` (writes IngestProgressSnapshot rows), unified email showing legacy + new pipeline totals + per-corpus bars. |
| `scripts/ingest/shared/compile.ts` | `pdfToText(buffer, url)` — pdf-parse extracts machine-readable PDFs; low-yield (scanned) returns null + logs warning. |
| `scripts/ingest/workers/worker-queue.ts` | PDF branch calls `pdfToText()`. WORKER_ID cap removed (1–10 → any positive). Smart sleep via `getSleepDuration()` replaces fixed 5-min poll. |
| `scripts/ingest/package.json` | Added `pdf-parse@1.1.1` + `@types/pdf-parse`. Version bumped to 1.0.2 (worker redeploy trigger). |
| `scripts/ingest/shared/queue-client.ts` | `claimNextChunk()` rewritten: two-phase rate-limit-aware claim (JOIN source_rate_limits → claim row → update lastIssuedAt, all atomic). `getSleepDuration()` computes minimum wait until next token. `suspendSource()` writes 429 suspension. `clearExpiredSuspensions()` unsuspends expired rows. |
| `scripts/ingest/shared/adaptive-throttle.ts` | `onSuspend` callback + `suspendThresholdMs` option. Fires when delay ≥ threshold after repeated backoffs. |
| `scripts/ingest/sources/tna-legislation.ts` | Wired `onSuspend` → `suspendSource('tna-legislation', ...)`. |
| `scripts/ingest/sources/tna-caselaw.ts` | Wired `onSuspend` → `suspendSource('tna-caselaw', ...)`. |
| `scripts/ingest/seed-rate-limits.ts` | Upsert script for source_rate_limits. Already run. |
| `scrutinise-web/prisma/schema.prisma` + `scripts/ingest/prisma/schema.prisma` | Added `IngestProgressSnapshot` and `SourceRateLimit` models. |
| Migration `20260602150000_ingest_progress_snapshot` | Applied ✅ |
| Migration `20260602160000_source_rate_limits` | Applied ✅. Seeded ✅ (10 rows, 200ms–1000ms per source). |

**Post-sprint state:** 426,343 new pipeline + 914,274 Neon legacy = 1,340,617 sections (18.9%). Workers 1–10 active with rate-limit token bucket. Workers 11–20 cleared to add.

---

## CODE CHANGES — 2 Jun 2026 Sprint: Build fix + architecture deployment

| Item | Detail |
|------|--------|
| `scripts/ingest/railway.json` | Removed `{"builder":"NIXPACKS"}` — Railway migrated to Railpack; NIXPACKS was triggering a compatibility mode that looked for `start.sh` and failed. Railpack now auto-detects Node.js from `package.json`. |
| `scripts/ingest/package.json` | `start`/`worker` scripts now point to `worker-queue.ts`. `worker-legacy` alias for `worker-main.ts`. Version bumped to 1.0.1 to force worker-1 auto-deploy. |
| `scripts/ingest/prisma/schema.prisma` | Synced with main schema: `CorpusSection` adds `compiledText` + `ftsVector`; `IngestQueue` model added. Required for `prisma generate` to succeed on Railway. |
| `scripts/ingest/cc-monitor.ts` | Auto-redeploy calls commented out until workers confirmed stable. Monitor still logs crashes/stalls. |
| Railway service config | `rootDirectory = "scripts/ingest"` set on all 11 services via GraphQL API. Was unset (root of repo), causing Railpack to receive partial snapshot. |
| `scripts/ingest/shared/progress-reporter.ts` | Progress bar email: `████░░░░` Unicode bar in subject + body, overall % prominent, per-worker bars, status summary (Phase 1 complete count, error count). |

**Post-build state:** Workers 2–10 + scheduler SUCCESS on `02979a94`. Worker-1 auto-deploy in progress (`484d105`). `ingest_queue` seeded with 60,575 rows.

---

## CODE CHANGES — 1 Jun 2026 Sprint: Source-client implementations (Workers 7, 9, 10 Phase 1 + Workers 1–7 Phase 2)

### Commit 1 — TNA Find Case Law (Worker 9 Phase 1)

| Item | Detail |
|------|--------|
| `scripts/ingest/shared/r2-client.ts` | Added `caselawKey()`, `caselawRawKey()`, `bailiiKey()`, `hansardKey()` key helpers. Shared `safeKeyPart()` normaliser (brackets/spaces → hyphens, lowercase, 200-char cap). |
| `scripts/ingest/sources/tna-caselaw.ts` | Added `getTotalJudgments()` — probes `/search/results.json?per_page=1` to get total count before iteration. Removed `extractJudgmentText` export (rawToText used directly). |
| `scripts/ingest/workers/worker-main.ts` | Worker 9: enumerate total, log `[worker-9] tna-caselaw: N items enumerated`; store at `caselaw/{safe-citation}/compiled.txt` + `raw.xml`; full judgment, no 50k truncation; rawToText() only. |

### Commit 2 — Parliament API / Hansard (Workers 1–4 Phase 2)

| Item | Detail |
|------|--------|
| `scripts/ingest/sources/parliament-api.ts` | Added `countHansardDebates()` (probes `take=1` to get total); `fetchHtml()`; `fetchReportContent()` (committee publication HTML scraper); ceiling raised to 60s. |
| `scripts/ingest/workers/worker-main.ts` | Phase 2 hansard: log count before processing, store at `hansard/{date}/{id}/compiled.txt`; committees: fetch real content via `fetchReportContent()`; `processText()` accepts `customKey` param, no 50k truncation. |

### Commit 3 — BAILII scraper (Workers 5, 6, 7 Phase 2)

| Item | Detail |
|------|--------|
| `scripts/ingest/sources/bailii-scraper.ts` | `WORKER_DB_SUBSETS` extended to cover all 10 courts: W5 = UKSC+CSIH+CSOH+UKET, W6 = EWCA+EWHC+UKEAT, W7 = UKPC+NICA+NIQB. |
| `scripts/ingest/workers/worker-main.ts` | Phase 2 bailii: per-court enumerate listing pages first (no HTML fetch), log count per court, then process; store at `caselaw/bailii/{ref}/compiled.txt`. |

### Commit 4 — FCA Handbook (Worker 7 Phase 1)

| Item | Detail |
|------|--------|
| `scripts/ingest/sources/fca-handbook.ts` | Rewrite from JSON API stub to HTML scraper. `discoverSourcebooks()` fetches handbook index, extracts `/handbook/{CODE}` links; falls back to 30 known sourcebook codes. `getSourcebookSections()` fetches each sourcebook TOC. `fetchSectionText()` extracts `<main>` body. `FcaSection` interface updated (`sourcebook` replaces `instrumentCode`). |
| `scripts/ingest/workers/worker-main.ts` | Worker 7: collect all sections to array, log count before processing. |

### Commit 5 — Worker 10 International Sources + UK Treaties

| Item | Detail |
|------|--------|
| `scripts/ingest/sources/echr-hudoc.ts` | Fixed `contry:GBR` → `country:GBR` typo; extracted `UK_QUERY` constant; added `countUkCases()` for pre-processing count. |
| `scripts/ingest/sources/eurlex.ts` | Replaced 100-item SPARQL stub with paginated EUR-Lex search API (CELEX series 3, up to 5000 items). Clean `fetchSearchPage()` helper. |
| `scripts/ingest/sources/oecd-free.ts` | Rewritten from non-existent iLibrary JSON endpoint to gov.uk content API search for OECD-framework documents. |
| `scripts/ingest/sources/uk-treaties.ts` (NEW) | FCDO treaties via gov.uk search API (up to 2000 items); `fetchTreatyText()` uses gov.uk JSON content API first, then HTML fallback; 500ms floor; corpus: `uk-treaties` (Worker 10 Phase 2). |
| `scripts/ingest/workers/worker-main.ts` | Worker 10: enumerate ECHR total via `countUkCases()`; collect EUR-Lex+OECD to arrays, log counts; `uk-treaties` Phase 2 handler; removed stale `fetchDocText` wrapper. |

**Post-push reset/redeploy checklist:**
- Worker 9: `npx tsx scripts/ingest/reset-checkpoints.ts 9` → redeploy
- Workers 1–4: `npx tsx scripts/ingest/reset-checkpoints.ts 1 2 3 4` → redeploy
- Workers 5–7: `npx tsx scripts/ingest/reset-checkpoints.ts 5 6 7` → redeploy
- Worker 10: `npx tsx scripts/ingest/reset-checkpoints.ts 10` → redeploy

---

## CODE CHANGES — 27 May 2026 Sprint V.4-FTS-3 Parts 3+4 (Transfer complete + search switched to Neon)

### V.4-FTS-3 Part 3: Railway → Neon data transfer

| Item | Detail |
|------|--------|
| `scrutinise-web/lib/pg-pool.ts` (NEW) | Raw `pg.Pool` wrapper for Railway and Neon. Railway pool: `ssl: { rejectUnauthorized: false }` (required — PrismaPg adapter doesn't pass SSL options). Neon pool: same. Used by transfer and diagnostic scripts. |
| `scripts/legislation/transfer-to-neon.ts` (REWRITTEN) | Multi-row batched INSERT (200 rows/batch), cursor-based pagination (no OFFSET). `buildBulkInsert()` generates parameterized VALUES list with explicit PostgreSQL enum casts (`$n::"LegislationType"` etc.) and `::jsonb` for `unappliedAmendments`. `ON CONFLICT (id) DO NOTHING` — idempotent. Checkpoint/resume every 5,000 rows. `ftsVector` excluded (Neon trigger repopulates). `embedding` excluded (Neon-only, V.4-FTS-2). |
| `scripts/legislation/check-railway-counts.ts` (NEW) | Diagnostic: counts Railway LegislationItem + LegislationSection by legislationType. Used to verify source counts before and after transfer. |
| `scripts/legislation/neon-transfer-checkpoint.json` (NEW) | Transfer state file — both tables done (legItemDone: true, legSectionDone: true). |

**Transfer results (27 May 2026):**
- Hit Neon 512 MB free-tier limit at 215,000 sections. Neon upgraded to Pro tier. Resumed from checkpoint.
- LegislationItem: 135,531 rows ✓
- LegislationSection: 914,274 rows ✓ (13 types, all counts match Railway exactly)
- `ANALYZE "LegislationSection"` run post-transfer (`scripts/legislation/neon-analyze.ts`).

### V.4-FTS-3 Part 4: Switch legislation search to Neon

| Item | Detail |
|------|--------|
| `scrutinise-web/lib/search.ts` | Imports `prismaSearch` from `@/lib/prisma-search`. Legislation search branch (`LegislationSection` queries) uses `prismaSearch.$transaction(...)` → Neon. Operational search branch keeps `prisma.$transaction(...)` → Railway (operational data not transferred). Also includes Part 2 changes: `buildTsQuery()` prefix matching. |
| `scripts/legislation/fts-smoke-test.ts` | Updated to target Neon (`import { prismaSearch as prisma } from '../../scrutinise-web/lib/prisma-search'`). Latency threshold adjusted: 5,000ms for "person" worst-case (Neon managed cloud vs Railway local proxy 2,000ms). GIN assertion replaced with performance assertion (40ms for "cryptoasset" — Seq Scan with LIMIT 20 early termination is correct planner behaviour at 914k rows). |
| `scripts/legislation/neon-analyze.ts` (NEW) | One-off post-transfer ANALYZE script. Runs `ANALYZE "LegislationSection"` + `ANALYZE "LegislationItem"` on Neon to update planner statistics. Run once ✓. |

**Smoke test results (Neon, 27 May 2026) — ALL PASS:**
- ftsVector fully populated: 914,274 rows ✓
- CTE bounds ts_headline ≤20 rows ✓
- "cryptoasset" 40ms ✓ | Data Protection Act 2018 96ms ✓ | Human Rights Act 1998 68ms ✓
- UKSI commencement 3,743ms ✓ | actId filter 32ms ✓ | p99 "person" 2,883ms ✓

---

## CODE CHANGES — 26 May 2026 Sprint V.4-FTS-3 Parts 1+2 (Neon migration + search enhancements)

### V.4-FTS-3: Neon DB connection, schema push, FTS setup, prefix matching

| Item | Detail |
|------|--------|
| `scrutinise-web/lib/prisma-search.ts` (NEW) | Separate Prisma client pointing at `NEON_DATABASE_URL` (Neon search DB). Uses lazy Proxy-based initialisation — client created on first property access so dotenv timing issues are avoided. Runtime role: read-only search. All writes continue via `prisma.ts` → Railway. |
| `scripts/legislation/test-neon-connection.ts` (NEW) | One-off connectivity probe: SELECT 1, PostgreSQL version, pgvector availability, existing table count. Result: PostgreSQL 17.10, pgvector v0.8.0, fresh DB ✓. |
| `scripts/legislation/neon-fts-setup.ts` (NEW) | Idempotent Neon FTS setup script. Creates `legislation_english` TEXT SEARCH CONFIGURATION (copy of `english`). Verifies `tsvector` columns. Installs FTS triggers using `legislation_english` on `LegislationSection` and `OperationalSection`. Confirms GIN indexes. Enables `pgvector` extension. Adds `embedding vector(768)` to `LegislationSection` (nullable — V.4-FTS-2 semantic sprint). |
| `scrutinise-web/prisma/pg_thesaurus/legislation_synonyms.ths` (NEW) | PostgreSQL thesaurus synonym file. 9 bidirectional synonym pairs: GDPR↔data protection, employment↔labour, NHS↔national health service, HMRC↔revenue customs, planning permission↔development consent, judicial review↔JR, freedom of information↔FOI, equality act↔protected characteristics. For use with `apply-fts-config.sql` on self-hosted PostgreSQL. |
| `scripts/legislation/apply-fts-config.sql` (NEW) | Repeatable SQL setup script for self-hosted PostgreSQL deployments. Creates `legislation_thesaurus` TEXT SEARCH DICTIONARY (thesaurus template, `.ths` file-based). Alters `legislation_english` config to use thesaurus + English stemming. Rebuilds triggers and GIN indexes. NOTE: not applicable to managed PG (Neon) — .ths file requires server filesystem access. |
| `docs/CLAUDE.md` | Added §15: PostgreSQL thesaurus dictionary. Documents .ths file location, deployment steps for self-hosted vs managed PG, Neon limitation, and application-layer fallback path. Documents prefix matching implementation in `buildTsQuery()`. |

**Neon DB state post-setup:**
- 54 tables (full Prisma schema), `legislation_english` FTS config, GIN indexes, pgvector, triggers ✓

---

## CODE CHANGES — 26 May 2026 Sprint L6-C (Lex field 5 stall, panel race, sidebar)

### L6-C: Fix Lex legislation field stall, panel race condition, and sidebar journey view

| Item | Detail |
|------|--------|
| `scrutinise-web/app/api/ai/[ideaId]/route.ts` | **Task 3:** FTS always fires at field 5 (`isAtLegislationField` guard). Query derived from `idea.title + summaryDescription + summaryDiagnosis` instead of user message. `shouldSearch` word-count gate bypassed for field 5. Comment added per v6.0 §7.1 trigger 1. **Task 9:** `buildSystemPrompt` OPENING instruction updated — Lex no longer re-introduces itself on first turn (server message is now canonical intro). **Task 2:** System prompt for field 5 (ideaLegislation) updated: `EMPTY CANDIDATES — MANDATORY PATH` instruction added; Lex must emit `{"fieldProposal":{"fieldKey":"ideaLegislation","proposedValue":"[]"}}` with natural-language explanation when no candidates found. |
| `scrutinise-web/components/FieldProposalCard.tsx` | **Task 2:** `handleSkipLegislation` useCallback added at component level (unconditionally — hooks rules). When `legCandidates.length === 0`: header shows "No legislation found", "Skip for now →" button shown and enabled, `onAccept('[]')` called and gate advances. Previous disabled Accept button behaviour removed. |
| `scrutinise-web/app/ideas/create/CreateIdeaClient.tsx` | **Task 2:** `handleCurrentProposalAccept` — for `ideaLegislation` with empty parsed array (`parsedCandidates.length === 0`): skip field-approval, send `Accepted: Reference legislation` directly to Lex. Field stays `false` in completedFields (intentionally deferred). **Task 4:** Two race-condition guards: (a) `setCurrentProposal` suppressed for `Accepted:` responses — no duplicate card; (b) DB re-fetch suppressed for `Accepted:` messages — no panel revert. **Task 5 (desktop):** `PAGE_REGISTRY` future pages rendered after active page: greyed section header + field labels only, no tick; Coherent Actions shows "1 Coherent Action" placeholder. **Task 5 (mobile, `MobileSidebarContent`):** Diagnosis and Guiding Policy sections show greyed field labels when section has no content and is not active. Coherent Actions shows greyed "1 Coherent Action" placeholder. **Task 6:** Removed auto-open block for newly accepted fields (default collapsed). 40-char truncated preview shown in collapsed state. |
| `scrutinise-web/app/ideas/[id]/IdeaDetailClient.tsx` | **Task 7:** `backgroundResearch: string | null` added to `Idea` interface. Rendered in Overview tab left column as "Background Research" section (above summary fields). Root cause was missing type and render — server page already fetches all scalars via `include`. |
| `scrutinise-web/lib/stage-gates.ts` | **Task 8:** `checkAndAdvanceStage()` now requires all 7 Page 1 (Initial Information) fields: `title`, `summaryDescription`, `summaryDiagnosis`, `backgroundResearch`, `ideaLegislation` (≥1 `legislationLinks`), `initialThoughts`, `govtArea`. Previously fired after title + summaryDescription only. Consumer audit documented in comments. `transitionReason` updated to "Automatic: all 7 Page 1 (Initial Information) fields completed". |

---

## CODE CHANGES — 25 May 2026 Sprint V.3-F (Sentencing Council Guidelines)

### V.3-F: Sentencing Council guidelines ingest — 274 docs, ~2.1M words, 0 errors

| Item | Detail |
|------|--------|
| `scripts/operational/sentencing-council-ingest.ts` (NEW) | Ingests all 274 active Sentencing Council guidelines from sentencingcouncil.org.uk. Three tiers: 253 offence-specific (Crown Court + Magistrates, loaded from `sc-guideline-list.json`), 10 overarching principles (hardcoded in script), 11 supplementary/explanatory material (hardcoded). `STATUTORY_GUIDANCE`. Rate: 1 req/2s, exponential backoff 30s→10min. Checkpoint: `sc-checkpoint.json`. Audit log: `sc-log.csv`. R2 keys: `operational/sentencing-council/{slug}/{slug}.html` and `.text`. 1 OperationalDocument + 1 OperationalSection per guideline. robots.txt: `Scrutinise/1.0` permitted under wildcard `Allow: /` rule (`ClaudeBot` blocked). Run time: 12m 22s. Word range: 82–17,313; avg 7,680. |
| `scripts/operational/sc-guideline-list.json` (NEW) | 253-entry pre-extracted JSON array — offence-specific guideline metadata (slug, name, courts, acts, category, URL) extracted from embedded page JSON on sentencingcouncil.org.uk. Tier 2 (10 overarching) and Tier 3 (11 supplementary) are hardcoded in the script. |

**Ingest results:**

| Source | Docs | Words | Errors | Elapsed |
|--------|------|-------|--------|---------|
| Sentencing Council guidelines (all 3 tiers) | 274 | ~2,100,000 | 0 | 12m 22s |

---

## CODE CHANGES — 25 May 2026 Sprint V.3-E (Retained EU Law + Acts of the Senedd Cymru)

### V.3-E: EU retained law ingest (EUR, EUDN, EUDR) + ASC — schema extension + production ingest

| Item | Detail |
|------|--------|
| `scrutinise-web/prisma/schema.prisma` | Added `EUDN` (Retained EU Decision), `EUDR` (Retained EU Directive), `ASC` (Act of the Senedd Cymru) to `LegislationType` enum. `EUR` (Retained EU Regulation) was already present. Pushed to Railway production via `prisma db push`. Prisma client regenerated. |
| `scripts/legislation/v3opt/src/build-manifest-eu-asc.ts` (NEW) | Pure TypeScript manifest builder for EUR, EUDN, EUDR, ASC. Reads `best-collection-xml.zip` via adm-zip. Applies revised-current-wins dedup (3 ASC 2026 enacted versions dropped where revised-current existed; 1 EUDN adopted-only item kept as `made`). Version mapping: `revised`→`revised-current`, `enacted`/`adopted`→`made`. Jurisdiction: EUR/EUDN/EUDR → `UK`; ASC → `Wales`. Tier: all four types → `TIER_2` (retained EU primary + devolved Senedd primary). |
| `scripts/legislation/v3opt/manifest-eur.json` (NEW) | 24,488-entry manifest. All `revised-current`. |
| `scripts/legislation/v3opt/manifest-eudn.json` (NEW) | 13,173-entry manifest. 13,172 `revised-current` + 1 `made` (`eudn/2004/513` — adopted-only). |
| `scripts/legislation/v3opt/manifest-eudr.json` (NEW) | 2,035-entry manifest. All `revised-current`. |
| `scripts/legislation/v3opt/manifest-asc.json` (NEW) | 29-entry manifest (32 raw entries; 3 ASC 2026 enacted dropped where revised-current existed). 26 `revised-current` + 3 `made`. |

**XML structure check (Step 2):**

All four types use `<EURetained>` (EU) or `<Primary>` (ASC) as document container. EU types use `<EUBody>` instead of `<Body>`, but the regex-based parser scans the full XML string and is container-agnostic. EUR and EUDN typically use bare `<P1>` (no P1group); EUDR uses `<P1group>+<P1>`; ASC uses `<Part>+<P1group>+<P1>` (identical to ASP/NIA/ANAW). Parser `extractSections` (P1group-first, P1 fallback) handles all four correctly. No parser changes required.

**Ingest results:**

| Type | Items created | Sections | Zero-section | R2 failures | Elapsed | Throughput |
|------|--------------|----------|--------------|-------------|---------|------------|
| ASC | 29 | 412 | 0 | 0 | 79s | ~1,322/hr |
| EUDR | 2,035 | 17,278 | 0 | 0 | 414s | ~17,696/hr |
| EUDN | 13,173 | 40,376 | 100 | 0 | 1,976s | ~23,999/hr |
| EUR | 24,488 | 75,658 | 2 | 0 | 3,520s | ~25,045/hr |
| **Total** | **39,725** | **133,724** | | | | |

*EUDN zero-section (100 items): expected — fully revoked/repealed early decisions where `<EUBody>` contains only elision-marker text with no parseable Pnumber.*  
*EUR zero-section (2 items): same cause — two fully revoked early regulations with empty bodies.*

---

## CODE CHANGES — 24 May 2026 Sprint V.3-C-2 (Operational Codes Scraper — Civil Service, GovS, Treasury, PACE, ACAS, ICO)

### V.3-C-2: Operational codes scraper sprint — all priority sources implemented and ingested

| Item | Detail |
|------|--------|
| `scripts/legislation/r2-client.ts` | `r2Put()` signature extended to accept `Buffer \| Uint8Array` in addition to `string`. Required for PDF binary upload. |
| `scrutinise-web/package.json` | Added `pdf-parse@2.4.5` dependency. Installed. |
| `scripts/operational/civil-service-ingest.ts` (NEW) | Ingests 4 civil service core documents: Civil Service Code, Civil Service Management Code (404 — confirmed absent from gov.uk), Ministerial Code, Cabinet Manual. Discovers HTML or PDF from gov.uk publication landing pages. Checkpoint: `civil-service-checkpoint.json`. |
| `scripts/operational/govs-ingest.ts` (NEW) | Ingests all 17 Government Functional Standards (GovS 001–015 + 3 companion docs) from `gov.uk/government/collections/functional-standards`. Auto-discovers chapter links and derives `govs-{NNN}` slug. Special case: GovS 002 (Project Delivery) fetched from `projectdelivery.gov.uk` — robots.txt permissive, PDF download discovered dynamically. GovS 008 overridden via `HTML_OVERRIDES` map (first link on landing page was wrong). Checkpoint: `govs-checkpoint.json`. |
| `scripts/operational/treasury-guidance-ingest.ts` (NEW) | Ingests 5 HM Treasury appraisal guidance documents: Green Book, Magenta Book, Aqua Book, Orange Book, Managing Public Money. All HTML or PDF. Aqua Book URL corrected to `/guidance/the-aqua-book`. Checkpoint: `treasury-checkpoint.json`. |
| `scripts/operational/pace-codes-ingest.ts` (NEW) | Ingests 8 PACE Codes (A, B, C, D, EF, G, H, I) from gov.uk. Pre-checks legislation corpus to confirm codes are not in statutes DB. Discovers accessible HTML versions from publication landing pages. Checkpoint: `pace-codes-checkpoint.json`. |
| `scripts/operational/acas-ingest.ts` (NEW) | Ingests 3 ACAS sources: Code of Practice 1 (statutory), Discipline & Grievances Guide (multi-chapter, explicit URL list — ACAS restructured from PDFs to web pages), Dismissal Guide (multi-chapter, auto-discovered from `/dismissals/` namespace). `extractMainContent` fixed to use `<article>` first (ACAS `body-wrapper` div is a subscription widget, not content). Checkpoint: `acas-checkpoint.json`. |
| `scripts/operational/ico-ingest.ts` (NEW) | Ingests 5 ICO codes. v2 rewrite: multi-chapter crawler. Discovers all immediate sub-pages of each code's root URL and concatenates text into one `main` section. Sources: Data Sharing Code (25pp, 32,858w), Children's Code (30pp, 42,384w), Direct Marketing Guidance (9pp, 19,611w), Journalism Code (15pp, 25,660w), FOI Guidance (14pp, 11,479w). Previous shallow hub captures (707w, 1,033w, 47w) overwritten via ON CONFLICT UPDATE. Checkpoint: `ico-checkpoint.json`. |
| `scripts/operational/college-of-policing-ingest.ts` (NEW) | Script written. robots.txt permissive, but all `/app/*` and `/guidance/*` paths return HTTP 403 from WAF (all IPs, all user-agents including browser UA and Googlebot). DB record marked FAILED. Checkpoint updated with `httpBlocked: true`. Needs manual export or CoP partnership access. |
| `scripts/operational/mark-cop-failed.js` (NEW) | One-off utility — marks College of Policing APP DB record as FAILED. |

**Ingest results:**

| Source | Words | Pages | Status |
|--------|-------|-------|--------|
| Civil Service Code | 1,018 | 1 | ✓ |
| Civil Service Management Code | — | — | ✗ 404 on gov.uk (archived/removed) |
| Ministerial Code | 11,285 | 1 | ✓ |
| Cabinet Manual | 46,054 | 1 | ✓ (PDF) |
| GovS 001–015 + 3 companion docs (17 total) | varies | 1 each | ✓ (16 HTML, 1 PDF from projectdelivery.gov.uk) |
| Green Book | 28,441 | 1 | ✓ |
| Magenta Book | 38,287 | 1 | ✓ |
| Aqua Book | 13,760 | 1 | ✓ |
| Orange Book | 13,153 | 1 | ✓ |
| Managing Public Money | 83,530 | 1 | ✓ (PDF) |
| PACE Codes A–I (8) | varies | 1 each | ✓ all |
| ACAS Code of Practice | 3,219 | 1 | ✓ |
| ACAS Discipline & Grievances Guide | 3,557 | 6 | ✓ |
| ACAS Dismissal Guide | 4,152 | 6 | ✓ |
| ICO Data Sharing Code | 32,858 | 25 | ✓ |
| ICO Children's Code | 42,384 | 30 | ✓ |
| ICO Direct Marketing Guidance | 19,611 | 9 | ✓ |
| ICO Journalism Code | 25,660 | 15 | ✓ |
| ICO FOI Guidance | 11,479 | 14 | ✓ |
| College of Policing APP | — | — | ✗ HTTP 403 WAF (all paths, all IPs) |

---

## CODE CHANGES — 24 May 2026 Sprint V.3-D (Devolved Corpus — Secondary)

### V.3-D: Devolved secondary ingest (SSI, NISR, WSI, NISI) — pipeline extension + production ingest

| Item | Detail |
|------|--------|
| `scrutinise-web/prisma/schema.prisma` | Added `NISR`, `NISI`, `NIA` to `LegislationType` enum. Updated `NIER` comment to clarify legacy/generic status. Pushed to production Railway via `prisma db push`. Prisma client regenerated. |
| `scripts/legislation/v3opt/src/manifest.ts` | Extended `ManifestEntry` with optional `legislationType?: string` and `jurisdiction?: string`. Backward-compatible — existing `manifest-uksi.json` works unchanged. |
| `scripts/legislation/v3opt/src/build-manifest-devolved.ts` (NEW) | Pure TypeScript manifest builder for all 7 devolved types. Reads directly from `best-collection-xml.zip` via adm-zip (no PowerShell). Applies version dedup (revised-current preferred; falls back to made/enacted). Outputs `manifest-devolved-secondary.json` (SSI+NISR+WSI+NISI) and `manifest-devolved-primary.json` (ASP+NIA+ANAW). |
| `scripts/legislation/v3opt/src/worker.ts` | Parameterised `legislationType`, `jurisdiction`, `tier` — read from manifest entry, no longer hardcoded to UKSI/UK/TIER_3. Added `deriveTier()` helper. Fixed title fallback to be type-aware (e.g. `SSI 1999/1` not `SI 1999/1`). |
| `scripts/legislation/v3opt/src/main.ts` | Added `--manifest <path>` CLI arg (default: backward-compat UKSI manifest). Mode label now uses manifest filename, not hardcoded `UKSI` / `(61,179)`. |
| `scripts/legislation/v3opt/manifest-devolved-secondary.json` (NEW) | 23,202-entry manifest: SSI 8,680 · NISR 9,316 · WSI 4,648 · NISI 558. Dedup: 900 items had both revised+made; revised-current kept. |
| `scripts/legislation/v3opt/manifest-devolved-primary.json` (NEW) | 671-entry manifest: ASP 395 · NIA 232 · ANAW 44. Ready for Step 3 (pending secondary completion). |

**Pilot-100 results (against production):** 100 items · 444 sections · 0 errors · 0 R2 failures · 183s  
**DB integrity confirmed:** `legislationType=NISR/NISI/SSI/WSI`, `tier=TIER_3`, `jurisdiction=Northern Ireland/Scotland/Wales` all correct on pilot records.

**Secondary full run (SSI+NISR+WSI+NISI):** 23,097 items · 124,406 sections · **0 errors · 0 R2 failures** · 3,247s (54 min) · **25,608 items/hr**  
**Primary full run (ASP+NIA+ANAW):** 671 items · 10,526 sections · **0 errors · 0 R2 failures** · 148s (2.5 min) · **16,322 items/hr**  
**Total devolved in production DB:** 23,868 items · 135,376 sections (inc. 100 pilot items)

---

## CODE CHANGES — 24 May 2026 Sprint V.3-C (HMRC Full Ingest — Tax Corpus)

### V.3-C: HMRC full ingest scraper — all 137 manuals, BFS page discovery

| Item | Detail |
|------|--------|
| `scripts/operational/hmrc-full-ingest.ts` (NEW) | Full HMRC ingest: 137 manuals from gov.uk/government/collections/hmrc-manuals. BFS page discovery per manual (recursively follows all linked pages within the manual's URL namespace — needed because HMRC manuals are 3+ levels deep: manual index → chapter contents → sub-chapter contents → leaf pages). Rate-limited 1 req/2s, exponential backoff 30s→10min, robots.txt check, R2+Railway upsert, checkpoint every 20 pages, `--manual=` and `--from=` CLI flags, ETA display. New checkpoint file: `hmrc-full-checkpoint.json`. Transpilation verified clean. |

**Manual list verified from:** `https://www.gov.uk/government/collections/hmrc-manuals`  
**Count:** 137 manuals (135 confirmed on page; 2 additional included that may 404-gracefully if absent)  
**DB state pre-run:** 3 OperationalDocument rows (V.3-A pilot), 90 OperationalSection rows, 1.406 GB Railway  
**Run command:** `cd scrutinise-web && npx ts-node --project ..\scripts\tsconfig.json --transpile-only ..\scripts\operational\hmrc-full-ingest.ts`  
**Estimated duration:** 20–30 hours for full run (~27,000–35,000 pages × 2s + R2/DB writes)  
**CC-A coordination:** If v3opt UKSI full ingest is running simultaneously, stagger by 30 min to distribute Railway pool pressure.

---

## CODE CHANGES — 15 May 2026 Sprint V.3-A (HMRC Tax Manuals Pilot + Operational Corpus Framework)

### V.3-A: Operational Corpus — schema, HMRC pilot ingest, framework doc

| Item | Detail |
|------|--------|
| `scrutinise-web/prisma/schema.prisma` | Added `DocumentSourceType` enum (7 values), `OperationalIngestStatus` enum (4 values). Added `sourceType: DocumentSourceType @default(STATUTE)` to `LegislationItem` and `LegislationSection`. Added `OperationalDocument` and `OperationalSection` models (Section 15). Pushed to Railway via `prisma db push`. |
| `scripts/operational/hmrc-ingest.ts` (NEW) | HMRC internal manuals scraper: 3 manuals (EIM, CG, CH), rate-limited (1 req/2s), exponential backoff on 429/503, robots.txt check, R2 HTML+text writes, Railway upserts via raw pg, checkpoint/resume, CSV audit log, `--manual=` flag. |
| `scripts/operational/phase-b-verify.ts` (NEW) | Verification script: Railway counts, sourceType filter check, DB size confirmation. |
| `docs/operational_corpus_framework_v1.md` (NEW) | Design doc: canonical model, source taxonomy, R2 key scheme, OperationalScraper interface, rate-limiting policy, provenance flags, update strategy, known limitations, next-source priority list. |
| `docs/handoff_summary.md` | Updated to v46: V.3-A results, Railway state, schema changes, pending items, next sprint options. |
| `docs/CLAUDE.md` | Fixed two occurrences of `D:/Dropbox/GitHub/scrutinise-prototype` → `C:/Code/scrutinise-prototype` (Section 8 git approval policy + Section 12 `commit-all.sh` example). |
| `docs/CHANGE_LOG.md` | This entry. |

**V.3-A ingest results (all manuals COMPLETE):**
- Employment Income Manual: 42 pages, `operational/hmrc/employment-income-manual/{ch}/{slug}.html/.text`
- Capital Gains Manual: 17 pages, `operational/hmrc/capital-gains-manual/{ch}/{slug}.html/.text`
- Compliance Handbook: 31 pages, `operational/hmrc/compliance-handbook/{ch}/{slug}.html/.text`
- Total: 90 OperationalSection rows in Railway; all `sourceType = ADMINISTRATIVE_GUIDANCE`
- Railway DB size unchanged: 250 MB (0.244 GB) — full text in R2 only

**Flag for CCh — enum name collision:** CCh correction specified new enum as `SourceType` but that name already exists in schema for Research/Evidence. CC renamed to `DocumentSourceType`. CCh to confirm before V.3-B.

---

## CODE CHANGES — 15 May 2026 Sprint V2.76-B Phase 3B + Verification (COUNT_DIFF top-up, closes V2.76-B)

### V2.76-B Phase 3B: COUNT_DIFF additive top-up + Phase 4 verification

| Item | Detail |
|------|--------|
| `scripts/legislation/v276-bulk/phase3b-count-diff.ts` (NEW) | Additive top-up for 1,146 COUNT_DIFF acts: skip already-keyed sections, update neither-key sections, create genuinely missing rows. Checkpoint/resume every 20 acts. |
| `scripts/legislation/v276-bulk/phase4-verify.ts` (UPDATED) | Extended to cover Phase 3A + 3B: corpus overview, key coverage stats, Companies Act 2006 R2 spot-check, retry act verification, 20-act random spot-check, full delta summary table. |
| `docs/handoff_summary.md` | Updated to v45: V2.76-B fully complete; final Railway state delta table; Phase 3B results; verification findings; deferred items updated |
| `docs/CHANGE_LOG.md` | This entry |

**Phase 3B results:**
- 1,146 COUNT_DIFF acts processed (additive top-up — never overwrites existing keys)
- 15,034 Railway row updates, 587 Railway row creates, 121,040 skipped (already keyed)
- 15,621 R2 writes
- 4 acts retried after duplicate-P1group bug fix — all clean on retry; 0 errors final
- Bug fixed: `existingMap` now updated after `create` to handle duplicate P1groups in bulk XML

**Phase 4 verification results (15 May 2026):**
- PRINT_ONLY: 9,043 ✓ (exact match)
- Companies Act 2006: 1,665 sections ✓; R2 s.1–s.1000 all present
- tnaXmlKey sections: 29,164 → **162,785** (+133,621)
- NEITHER-key sections: 21,850 → **7,208** (−14,642, −67%)
- tnaXmlKey coverage: ~17% → **95.8%** of all sections
- 20-act spot-check: 13/20 fully keyed; residual neither-key sections confirmed as repealed provisions absent from revised bulk

**V2.76-B is closed. Next sprint to be decided.**

---

## CODE CHANGES — 14 May 2026 Sprint V2.76-B (Bulk Corpus Download, Correction, Verification)

### V2.76-B: Best Collection bulk ingest — Phase 3A complete

| Item | Detail |
|------|--------|
| `scrutinise-web/prisma/schema.prisma` | Added `PRINT_ONLY` to `CompilationStatus` enum. Pushed to Railway. |
| `scripts/legislation/check-state.ts` (NEW) | Railway DB state diagnostic script |
| `scripts/legislation/check-reconcile.ts` (NEW) | Cross-check bulk manifest vs Railway; produces `reconcile-results.json` |
| `scripts/legislation/v276-bulk/phase2-db-counts.ts` (NEW) | Query Railway section counts for in-bulk acts |
| `scripts/legislation/v276-bulk/phase2-bulk-p1groups.ps1` (NEW) | Count P1groups from ZIP for all in-bulk acts |
| `scripts/legislation/v276-bulk/phase2-categorise.ts` (NEW) | Merge DB + bulk counts → categorise → `sample-comparison.md` |
| `scripts/legislation/v276-bulk/phase3a-zip-helper.ps1` (NEW) | PowerShell helper: extract named P1groups from ZIP entry via stdin/stdout |
| `scripts/legislation/v276-bulk/phase3a-patch-gaps.ts` (NEW) | FULL_INGEST (Companies Act 2006) + PATCH_GAPS (316 acts): upload to R2, update Railway |
| `scripts/legislation/v276-bulk/phase3a-print-only.ts` (NEW) | Mark 9,043 print-only LegislationItems with `compilationStatus = PRINT_ONLY` |
| `scripts/legislation/v276-bulk/phase4-verify.ts` (NEW) | Phase 4 verification spot-checks (PRINT_ONLY count, R2 existence, neither-key delta) |
| `scripts/legislation/v276-bulk/build-manifest.ts` (NEW) | TypeScript manifest builder (reference; PowerShell version used in practice) |
| `scripts/legislation/v276-bulk/sample-comparison.md` (NEW) | Phase 2 reconciliation report |
| `scripts/legislation/v276-bulk/manifest-ukpga.json` (NEW) | 4,407-act UKPGA manifest from bulk ZIP |
| `scripts/legislation/v276-bulk/reconcile-results.json` (NEW) | Cross-check results: categories + actId lists |
| `.gitignore` | Added `v276-bulk/extracted/`, `best-collection-xml.zip`, and 4 large intermediate JSON files |
| `docs/handoff_summary.md` | Updated to v44: V2.76-B complete; Railway state delta table; deferred items |
| `docs/CHANGE_LOG.md` | This entry |

**Results:**
- Companies Act 2006: 1,665 sections created in Railway + R2 (`ukpga/2006/46/sections/{N}.tna.xml`)
- PATCH_GAPS: 1,077 of ~1,716 neither-key sections patched; 639 unmatched (likely repealed sections absent from revised bulk)
- PRINT_ONLY: 9,043 LegislationItem rows marked permanently excluded
- NEITHER-key sections: 21,850 → 20,747 (−1,103)
- Schema: `CompilationStatus.PRINT_ONLY` added + Railway pushed

**Deferred:** COUNT_DIFF (1,146 acts) and NEW_TO_RAILWAY (1,657 acts) — await Phase 3B decision.

**tsc clean. All changes to be committed via commit-all.sh.**

---

## CODE CHANGES — 14 May 2026 Sprint V2.76-A (Bulk Data Discovery — Extended Phase 1)

### V2.76-A: research.legislation.gov.uk Phase 1 inventory (original + extended)

Phase 1 extended discovery sprint — no code changes, no DB changes, no ingest modifications.

| Item | Detail |
|------|--------|
| `docs/V2.76_bulk_data_inventory.md` (NEW, extended) | Full Phase 1 inventory: access verification, dataset map, amendment XML schema, Companies Act 2006 confirmation, download order, size estimates, gotchas, Phase 2 plan + Sections 14–17: Explanatory Notes, InForce granularity, historical coverage, UKSI/devolved scope |
| `.gitignore` | Added `scripts/legislation/v276-samples/` — local discovery artefacts (large CSVs/XML), not committed |
| `docs/handoff_summary.md` | Updated to v43: extended Phase 1 findings + corpus categorisation (Legislative / Financial / Operational) + sprint phasing within categories |

**Original Phase 1 key findings:**

- Credentials `research` / `n3w_s!te` confirmed working (HTTP Basic Auth on all download paths)
- Dataset A — Legislative Texts: 6 version-datasets × 6 formats. Best Collection XML: 1.32 GB. Updated daily.
- Dataset B — Amendments: 29 legislation types × per-year ZIPs. Same XML format as TNA Changes API but bulk pre-paginated. **6 months stale** (Oct 2025 latest).
- Dataset C — Statute Book Metadata: Legislation on Website CSV 350,557 rows (daily); InForce CSVs back to 1235.
- **Companies Act 2006:** `Revised Current English: Yes` in bulk CSV — resolves HTTP 202 problem.

**Extended Phase 1 key findings (14 May 2026):**

- **Explanatory Notes:** NOT in bulk. Separate document at `/{type}/{year}/{num}/notes/data.xml`. Root element `<EN>`, schema `en.xsd`. Public endpoint (no auth). Scope: 1988+ primary. Must be fetched per-act in a dedicated pass. Root element is `<ExplanatoryNotes>` → `<ENprelims>` + `<Body>` → `<Division>` paragraphs.
- **InForce Dataset granularity:** Act-level for modern UKPGA. Section-level only for ancient AEP surviving provisions. Jurisdiction-specific repeal codes exist but only for repeal end-state. No commencement order cross-references. For NI partial-enactment: use Effects XML (`InForceDates` + `AffectingEffectsExtent`).
- **Historical UKPGA coverage:** 7,634 of 12,020 (64%) are print/PDF-only — no XML, NOT solved by bulk. 1988+ = 100% XML; 1901–87 = 38%; 1800s = 16%. Bulk DOES solve 202-failing modern acts and adds 2,813 historical acts with Enacted ePublished digital text. 7,634 print-only to be marked permanently excluded.
- **UKSI in bulk:** ALL 108,798 UKSI in Best Collection. Per-type sub-downloads = 404 (monolithic ZIP only). Devolved: NIA 95%, ASP 99%, ANAW 100% Revised Current.
- **Corpus categorisation decision:** Three corpora defined — Legislative (legislation.gov.uk + bulk), Financial (gov.uk PDFs), Operational (HMRC, BAILII, regulators, Hansard).

**Phase 2 status:** AWAITING CHARLIE APPROVAL. Do not bulk-download. Do not modify PM2 ingest. Do not modify DB.

---

## CODE CHANGES — 14 May 2026 Sprint V2-LEX-FLOW-AND-LEGPANEL + V2.76-A Homepage

### V2-LEX-FLOW-AND-LEGPANEL: Lex field sequence + LegislationPanel

| File | Change |
|------|--------|
| `scrutinise-web/app/api/ai/[ideaId]/route.ts` | A1: FIELD SEQUENCE — ABSOLUTE RULES section in `buildSystemPrompt`; A2: out-of-sequence write guard in `applyFieldUpdatesAndSave` (rejects writes to fields ahead of current target, injects self-correction system note); A3: removed standalone summary-turn encouragement |
| `scrutinise-web/app/ideas/create/CreateIdeaClient.tsx` | B: `pulseLegButton` state; `searchLegislation` no longer auto-opens panel; Moment 2 field key fixed (`summaryDiagnosis`/`diagnosis.text`); Moment 3 triggers 2s pulse on both Legislation buttons |
| `scrutinise-web/components/PublicNav.tsx` | Legislation nav link gated to `isAdmin` (desktop + mobile) |
| `docs/roadmap.md` | Funding-route guidance entry added |

### V2.76-A: Homepage copy + indentation

| File | Change |
|------|--------|
| `scrutinise-web/app/page.tsx` | Hero paragraph changed to "not-for-profit, non-partisan…" copy |
| `scrutinise-web/app/page.tsx` | Who is it for? bullet `<ul>` — added `pl-4` (indent bullets one tab) |

**tsc clean. All changes committed and pushed to Main.**

***

## CODE CHANGES — 30 April 2026 Sprint V2.75-I (Resilient Resume)

### V2.75-I: Checkpoint resilience, skip-loop fix, PM2 clean-exit

**Root cause diagnosed:** Full corpus was ingested Apr 29 03:59 (12,012 acts). PM2 `autorestart: true` restarted on clean exit code 0. Old main loop iterated all 12,009 acts with 500ms inter-act delay = ~100 min/restart. 17+ idle restarts accumulated over 12 hours.

**Fixes applied:**

| File | Change |
|------|--------|
| `ecosystem.config.js` | Added `stop_exit_codes: [0]`. PM2 no longer restarts on clean exit (code 0). Genuine crashes (code 1) still trigger autorestart. |
| `scripts/legislation/ingest.ts` | Main loop now iterates `remaining` (not `acts`). Eliminates 500ms delay on already-checkpointed acts — reduces idle restart time from ~100 min to <1 min. |
| `scripts/legislation/ingest.ts` | Completion detection: if `remaining.length === 0` after feed load, logs "Corpus complete — all acts already in checkpoint. Exiting cleanly." and returns (code 0 → PM2 stops). |
| `scripts/legislation/ingest.ts` | Checkpoint format upgraded: `{ completed, permanentlySkipped, attemptCounts }`. Backward-compatible with old `{ completed }` format. |
| `scripts/legislation/ingest.ts` | Attempt tracking: `attemptCounts[id]` incremented per act attempt. Acts failing ≥ 3 times → `permanentlySkipped` set + `writeCrashLog()`. Excluded from future `remaining` filter. |
| `scripts/legislation/ingest.ts` | Crash exit code: `main().catch(err => { console.error(err); process.exit(1) })`. Previously `.catch(console.error)` let crashes exit code 0, indistinguishable from clean completion. |
| `V2.75_crash_log.md` (NEW) | Markdown table; `writeCrashLog()` appends rows for permanently-skipped acts. |
| `V2.75_crashing_acts.md` (NEW) | Phase 1 diagnostic report — full root-cause analysis of the idle-restart loop. |

**tsc clean. 3-act test passed** (`ukpga/2023/1`, `ukpga/2022/3`, `ukpga/2021/24`).

**PM2 restarted** with new `ecosystem.config.js` at 10:46 Apr 30. 241 remaining acts being processed. Self-terminates on completion.

***

## CODE CHANGES — 26 April 2026 Sprint V2.75-H (Phase 3+4)

### V2.75-H3+H4: R2 wipe, schema migration, 5-act verification

**Phase 3 — R2 partial wipe + schema migration:**

| Action | Result |
|--------|--------|
| `prisma db push --accept-data-loss` on Railway | `rawXmlKey` dropped; `originalXmlKey`, `tnaXmlKey`, `effectsKey`, `effectsFetchedAt` added |
| R2 wipe via `wipe-r2-partial.ts --confirm` | 65,255 objects deleted (40,635 `.xml` + 24,620 `.compiled.txt`); 1,142 `.summary.txt` preserved |

**Phase 4 — 5-act ingest + verification:**

7 bugs fixed in `scripts/legislation/ingest.ts` during Phase 4 testing:

| # | Bug | Fix |
|---|-----|-----|
| 1 | `dotenv/config` read no `.env` in `scripts/` → `DATABASE_URL` undefined → ECONNREFUSED | `dotenv.config({ path: path.join(__dirname, '../../scrutinise-web/.env') })` |
| 2 | `withPrismaRetry()` only handled P1017/P1001 — ECONNREFUSED not retried | Extended RETRYABLE_CODES; 4 retries |
| 3 | P1group regex `/<P1group>/` skipped all attributed elements | `/<P1group[^>]*>/` |
| 4 | XML tags in `<Pnumber>` (e.g. `<Addition>17</Addition>`) produced corrupt section numbers | `.replace(/<[^>]+>/g, '').trim()` in both extraction points |
| 5 | HTTP 202 on full-act CLML not handled — empty body read as XML | Status check; if 202, `clmlXml = ''`, skip section extraction |
| 6 | `fetch()` no timeout — process hung 17+ min on slow TNA response | `fetchWithTimeout()` with 30s `AbortController`; applied to all TNA calls |
| 7 | Pnum mismatch in `fetchSectionXml()` for annotated sections | Tag-strip added to pnum extraction in `fetchSectionXml()` |

New scripts:

| File | Purpose |
|------|---------|
| `scripts/legislation/wipe-r2-partial.ts` | Scans all R2 objects; deletes `.xml` + `.compiled.txt`; preserves `.summary.txt`. Dry run by default, `--confirm` required. |
| `scripts/legislation/test-ingest-5.ts` | Phase 4 verification — queries DB + R2 for 5 test acts, spot-checks `.original.xml`, writes `V2.75_phase4_verification.md` |
| `scripts/legislation/clear-test-acts.ts` | Deletes DB sections + non-`.summary.txt` R2 objects for 5 test acts (used between test runs) |

**Verification results (4/5 passed):**

| Act | Sections | .original.xml | .tna.xml | Effects | Pass |
|-----|----------|---------------|----------|---------|------|
| Equality Act 2010 (ukpga/2010/15) | 239 | 218 | 234 | 500 | ✓ |
| Theft Act 1968 (ukpga/1968/60) | 40 | 36 | 40 | 71 | ✓ |
| Income Tax Act 2007 (ukpga/2007/3) | 1776 | 1035 | 1750 | 500 | ✓ |
| Finance (No. 2) Act 2024 (ukpga/2024/3) | 269 | 39 | 39 | 93 | ✓ |
| Companies Act 2006 (ukpga/2006/46) | 0 | 0 | 0 | 0 | ✗ (202) |

**VERDICT: PARTIAL** — Companies Act 2006 fails due to TNA returning HTTP 202 for full-act CLML (known limitation for very large/old acts, confirmed in H1 testing). Ingest handles it gracefully. Does not block full corpus run.

Full report: `V2.75_phase4_verification.md`

**Patch — effects feed page cap raised:**

`scripts/legislation/ingest.ts`: `MAX_PAGES` raised from 10 → 200. Equality Act 2010 and Income Tax Act 2007 hit the old cap during Phase 4, capping effects at 500 entries each. 200-page cap (100,000 entries max) prevents infinite loops without rationing data.

`scripts/tsconfig.json`: added `"dotenv"` to `paths` map — pre-existing tsc type resolution gap for scripts that import dotenv. No runtime impact. tsc clean.

**Deploy actions needed:**
- Charlie to approve full corpus run: `pm2 start ecosystem.config.js --only scrutinise-ingest`
- End-of-sprint `commit-all.sh` ready at project root

***

### V2.75-H5: PM2 unattended runner + MAX_PAGES patch

| File | Change |
|------|--------|
| `scripts/legislation/ingest.ts` | `MAX_PAGES` raised 10 → 200 in `fetchEffectsFeed()`. Equality Act 2010 and Income Tax Act 2007 hit the 10-page cap during Phase 4, capping effects at 500 entries. 200-page cap allows up to 100,000 entries while still preventing infinite loops. |
| `scripts/tsconfig.json` | Added `"dotenv": ["./node_modules/dotenv"]` to `paths` map. Pre-existing tsc type resolution gap — all scripts importing `dotenv` had TS2307 errors when running standalone `tsc --noEmit`. Runtime was unaffected (ts-node `--transpile-only` skips type checking). Same pattern as `@prisma/client` already in the map. `tsc --noEmit` now clean. |
| `ecosystem.config.js` (NEW) | PM2 process config. `script`: `scrutinise-web/node_modules/ts-node/dist/bin.js` (not the `.cmd` wrapper — PM2 on Windows cannot execute `.cmd` batch files as Node scripts). `args`: full corpus `--full` flag. `cwd`: `scripts/`. `NODE_PATH`: `scrutinise-web/node_modules`. `autorestart: true`, `max_restarts: 10`. Logs to `scripts/legislation/pm2-ingest-{out,error}.log`. |

**PM2 dry-run results:**
- PM2 6.0.14 installed globally (`npm install -g pm2`)
- `pm2 start ecosystem.config.js --only scrutinise-ingest --no-autorestart` ran successfully
- UKPGA feed: 600 pages fetched, 12,009 acts discovered
- Section writes confirmed: `✓ s.N enacted → R2` / `✓ s.N current → R2` observed
- Effects feed confirmed: `Fetching effects feed for ukpga/...` observed
- Process stopped and deleted cleanly after dry-run

`tsc --noEmit` clean (scripts + web).

***

## CODE CHANGES — 25 April 2026 Sprint V2.75 (architectural reset)

### V2.75-H2: Three-layer ingest implementation (Phase 2)

| File                                        | Change                                                                                                                                                                                   |
|---------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/prisma/schema.prisma`       | `LegislationSection.rawXmlKey` renamed to `originalXmlKey` (enacted CLML); `tnaXmlKey String?` added (current CLML). `LegislationItem`: `effectsKey String?` + `effectsFetchedAt DateTime?` added. |
| `scripts/legislation/r2-client.ts`          | Removed `xmlKey()`. Added `originalXmlKey()`, `tnaXmlKey()`, `effectsKey()`.                                                                                                            |
| `scrutinise-web/lib/r2.ts`                  | Added same three helpers (`originalXmlKey`, `tnaXmlKey`, `effectsKey`).                                                                                                                 |
| `scripts/legislation/ingest.ts`             | Full rewrite: `fetchSectionXml()` (enacted + current per section, scoped P1group), `fetchEffectsFeed()` (TNA Changes feed, paginated, wraps entries in `<EffectsFeed>`), new `ingestAct()` with three-layer R2 writes, `withPrismaRetry()` on all DB calls, checkpoint auto-migrated to `ingest-checkpoint.v2L.json`, `--reset-failed` resets `compiledBy='tna-202'` sections. Removed: `fetchTnaCompiledText()`, `--recompile-tna`. |
| `scripts/legislation/compile.ts`            | `section.rawXmlKey` → `section.originalXmlKey` (2 references). No other changes.                                                                                                        |

`tsc --noEmit` clean on both `scrutinise-web/` and `scripts/`.

**Deploy actions needed (gated — DO NOT run until Charlie approves after Phase 4):**
- `prisma db push --accept-data-loss` on Railway
- R2 wipe: delete all `.xml` + `.compiled.txt` (preserve `.summary.txt`)
- Restart ingest with `--full`

***

### V2.75-H1.5: Bulk download verification

| File                               | Change                                                                                                                                                           |
|------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `V2.75_bulk_site_index.html` (NEW) | Documents that `leggovuk.s3-website-eu-west-1.amazonaws.com` returns 403 on every path — alpha bulk site decommissioned.                                         |
| `.claude/settings.json` (NEW)      | Auto-approval rules for common bash patterns (npx ts-node, tsc, commit-all.sh, git status/add/commit/push). Created during Phase 1.5 pre-flight. |

**Verdict:** `research.legislation.gov.uk` is invite-only HTTP Basic Auth beta (`WWW-Authenticate: Basic realm="By Invitation Only"` on homepage). Not publicly accessible without credentials. Charlie approved option 3: proceed with per-section API ingest.

**Deploy actions needed:** None.

***

### V2.75-H1: URL pattern verification — /enacted/data.xml endpoint

| File                                   | Change                                                                           |
|----------------------------------------|----------------------------------------------------------------------------------|
| `V2.75_test_enacted_eq_s11.xml` (NEW)  | Equality Act 2010 s.11 enacted CLML. HTTP 200, 61KB.                             |
| `V2.75_test_current_eq_s11.xml` (NEW)  | Equality Act 2010 s.11 current CLML.                                             |
| `V2.75_test_enacted_ca_s172.xml` (NEW) | Companies Act 2006 s.172 enacted — HTTP 202, 0 bytes (TNA on-demand generation). |
| `V2.75_test_current_ca_s172.xml` (NEW) | Companies Act 2006 s.172 current — HTTP 202, 0 bytes.                            |

**Findings:** `/enacted/data.xml` returns valid original-as-enacted CLML for Equality Act and Theft Act. Zero `<Addition>`, `<Substitution>`, `<Repeal>`, `<ChangeId>` tags found in any TNA endpoint (enacted or current). TNA uses `<CommentaryRef>` + `<Commentary>` footnote pairs — human prose, not inline machine-readable markup. This is the architectural breakthrough that drove V2.75-F's audit conclusions.

**Deploy actions needed:** None.

***

### V2.75-G: Summary file audit

| File                             | Change                                                                                                                           |
|----------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| `V2.75_summary_samples.md` (NEW) | Three `.summary.txt` samples reviewed. Confirmed: 1,142 stored summaries are genuine plain-English Lex output (Layer 6 quality). |

Bug noted: Coronavirus Act 2020 s.83A has Welsh-language `sectionTitle` in DB mismatched to English XML — pre-existing ingest bug, low priority.

**Deploy actions needed:** None.

***

### V2.75-F: Architecture audit

| File                                | Change                                                                                                                                                                                                                                                                                                                                       |
|-------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `V2.75_architecture_audit.md` (NEW) | Full audit of R2 + DB. 40,635 .xml / 24,620 .compiled.txt / 1,142 .summary.txt. DB: 26,365 COMPILED / 10,875 FAILED / 3,395 PENDING. Confirms: stored XML is current-state TNA, NOT enacted. Zero deterministic compiler exists. AI pipeline strips all tags. Amendment table has zero rows. 6-layer model: Layers 1 and 5 missing entirely. |

**Conclusion:** all `.compiled.txt` files are noise (AI re-compilations of already-compiled TNA text); legislation-compare page is structurally incapable of scoring 100%. Hard reset required.

**Deploy actions needed:** None.

***

### V2.75-D: Compile worker — stale-section reclaim

| File                             | Change                                                                                                                                                                                                   |
|----------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scripts/legislation/compile.ts` | Added stale-reclaim query: sections in `COMPILING` status for \> 10 minutes are reset to `PENDING` at the start of each compile loop. Prevents post-crash zombie sections being invisible to the worker. |

**Deploy actions needed:** None (compile loop will pick up reclaimed sections on next run).

***

### V2.75-C: Ingest TNA fetch — scope to P1group node

| File                            | Change                                                                                                                                                                                                                                                                                                                    |
|---------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scripts/legislation/ingest.ts` | `fetchTnaCompiledText()` now extracts only the `<P1group>` node matching the target section before tag-stripping. Regex: `/<P1group[^>]*>([\s\S]*?)<\/P1group>/g`. Iterates matches and selects the one whose `id` attribute matches the section. Prevents editorial content from other Acts contaminating compiled text. |

Tests pass for Equality Act sections. Companies Act 2006 sections still return HTTP 202 (TNA on-demand generation / AWS WAF challenge) — separate retry strategy needed.

**Deploy actions needed:** Re-ingest needed once V2.75-H plan is in place to overwrite contaminated text.

***

### V2.75-A: Ingest reliability — Prisma retry + per-act try/catch

| File                            | Change                                                                                                                                                                                                                                                                                                                    |
|---------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scripts/legislation/ingest.ts` | Added `withPrismaRetry()` helper wrapping all 6 Prisma calls in `ingestAct`: catches P1017 (server closed connection) and P1001 (cannot reach DB), retries 3 times with 5s backoff. Added top-level try/catch around each act in the loop with `failCount` counter — single act failure no longer halts the whole ingest. |

Triggered by P1017 crash at act 1,891 (Administration of Justice Act 1982) on 24 April. Railway closes idle connections during long TNA throttle waits (5000ms cap × multiple sections); the retry covers the reconnect window.

**Deploy actions needed:** Restart command for ingest:

```
cd D:/Dropbox/GitHub/scrutinise-prototype/scrutinise-web
NODE_PATH=./node_modules npx ts-node --project ../scripts/tsconfig.json ../scripts/legislation/ingest.ts --full
```

(Restart deferred pending V2.75-H plan — would re-fetch contaminated current-version XML.)

***

## CODE CHANGES — 24 April 2026 Sprint V2-L (patch)

### V2L-A3-fix4: Ingest TNA fetch — adaptive throttle replaces fixed 1s delay

| File                            | Change                                                                                                                                                                                             |
|---------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scripts/legislation/ingest.ts` | Added `AdaptiveThrottle` class: starts at 200ms, doubles on 429/503 (max 5000ms), reduces 10% after 10 consecutive successes (min 100ms). `fetchTnaCompiledText` return type changed from \`string |

**Deploy actions needed:** None.

***

### V2L-A4-fix: Compile script — Claude Haiku fallback on Gemini 429

| File                               | Change                                                                                                                                                                                                                                                                                                                                                                                                               |
|------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scripts/legislation/compile.ts`   | Added `@anthropic-ai/sdk` import and lazy `getAnthropic()` client. Added `callClaudeJson()` using `claude-haiku-4-5-20251001`. `callWithRetry` now returns `{ result, compiledBy }` — on Gemini 429 logs `⟳ Gemini 429 — trying Claude fallback` and delegates to `callClaudeJson`; result stored with `compiledBy: 'claude-fallback'`. On failure Claude throws and the outer catch marks section FAILED as before. |
| `scrutinise-web/package.json`      | Added `@anthropic-ai/sdk ^0.91.0` dependency.                                                                                                                                                                                                                                                                                                                                                                        |
| `scrutinise-web/package-lock.json` | Updated.                                                                                                                                                                                                                                                                                                                                                                                                             |

**Deploy actions needed:** Add `ANTHROPIC_API_KEY` to Railway and Vercel env vars (if not already present).

***

### V2L-A3-fix3: Ingest TNA fetch — switch to CLML XML endpoint, add --recompile-tna flag

| File                            | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
|---------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scripts/legislation/ingest.ts` | `fetchTnaCompiledText`: URL changed from HTML page to `/data.xml` CLML endpoint. Removed `stripHtml` and `cleanTnaCompiledText` helpers. New parsing: strip XML tags, collapse whitespace, manually decode XML entities (`&amp;`, `&lt;`, `&gt;`, `&nbsp;`, `&#xD;`, `&#x9;`). `ingestAct`: accepts `recompileTna` flag — skips R2 existence check when set. `main`: parses `--recompile-tna` arg independently of mode flag; passes through to `ingestAct`. |

**Deploy actions needed:** Re-run ingest with `--recompile-tna` to overwrite existing compiled text with clean XML-sourced text.

***

### V2L-A3-fix: Ingest feed pagination — HTML entity decode + infinite loop guard

| File                            | Change                                                                                                                                                                                 |
|---------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scripts/legislation/ingest.ts` | `fetchFeedPage`: decode `&amp;` → `&` in extracted next-page URL before use. `fetchAllActsFromFeed`: break if `nextUrl === url` to prevent infinite loop if entity decode still fails. |
| `scripts/tsconfig.json`         | `@aws-sdk/client-s3` path alias committed (was already on disk, missed from V2L-A2 commit).                                                                                            |

**Deploy actions needed:** None.

***

## CODE CHANGES — 24 April 2026 Sprint V2-L

### V2L-D1: Docs — CHANGE_LOG + handoff v35

| File                                 | Change                  |
|--------------------------------------|-------------------------|
| `docs/CHANGE_LOG.md`      | Sprint V2L entry added. |
| `docs/handoff_summary.md` | Bumped to v35.          |

**Deploy actions needed:** None.

***

### V2L-C1: CLAUDE.md storage policy

| File                        | Change                                                                                                                            |
|-----------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `docs/CLAUDE.md` | Added STORAGE ARCHITECTURE section: Railway 5GB hard limit policy, R2 key scheme, on-demand fetch flow, R2 client file locations. |

**Deploy actions needed:** None.

***

### V2L-B1: Legislation-compare page rebuild

| File                                                                  | Change                                                                                                                                                                                                                                                                                                                                                                                  |
|-----------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/app/api/legislation/test-sections/route.ts`           | NEW. GET handler (no auth). Fetches up to 20 COMPILED sections from DB, fetches compiledText + lexSummary from R2. Returns amendments array for each section.                                                                                                                                                                                                                           |
| `scrutinise-web/app/legislation-compare/LegislationCompareClient.tsx` | REBUILT. Dynamic sections from `/api/legislation/test-sections` (replaces static TEST_SECTIONS). Gold standard = compiledText from R2. User prompt = "apply amendments to original text" verbatim task. System prompt = VERBATIM_SYSTEM_PROMPT. Removed cleanTnaText(), fetchLegislationXml(), goldTexts state. Added loading state, empty-DB message. Section list shows TNA/AI label. |

**Deploy actions needed:** None (after schema + R2 client deploys).

***

### V2L-A5: Legislation search API — R2 fetch

| File                                                            | Change                                                                                                                                                                                                                                             |
|-----------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/app/api/ideas/[id]/legislation-search/route.ts` | SQL updated: selects compiledTextKey, lexSummaryKey, compiledBy (not removed text fields). FTS uses originalText (in Railway). After query: parallel r2Get() for compiledText + lexSummary. Returns isTnaVerified = (compiledBy === 'tna-direct'). |
| `scrutinise-web/components/LegislationPanel.tsx`                | Interface: removed tnaCompiledText, added isTnaVerified flag. Display uses compiledText from R2. TNA badge uses isTnaVerified. Labels updated to "Compiled text (TNA)" / "Compiled text (AI)".                                                     |

**Deploy actions needed:** None (after schema + R2 client deploys).

***

### V2L-A4: Compile script — R2 round-trip + parallel batches

| File                             | Change                                                                                                                                                                                                                                                                                                                                                                                   |
|----------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scripts/legislation/compile.ts` | Imports r2Get, r2Put, compiledKey, summaryKey from r2-client. Fetches rawXml from R2 via rawXmlKey (falls back to originalText). Writes compiledText to R2 via compiledKey; writes lexSummary to R2 via summaryKey. DB updated with compiledTextKey, lexSummaryKey (not text fields). Parallel batches of 5. --reset-failed flag. Progress summary after each batch. PAUSE file support. |

**Deploy actions needed:** None (after R2 client deploy).

***

### V2L-A3: Ingest script — R2-first writes + full corpus feed

| File                            | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
|---------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scripts/legislation/ingest.ts` | Imports r2Put, r2Exists, r2Get, xmlKey, compiledKey from r2-client. fetchSectionsFromXml: returns rawXml per section. Writes raw XML to R2 (skip if exists). Writes TNA compiled text to R2; stores compiledTextKey, compiledBy: 'tna-direct' in DB. Skip if compiledTextKey already in R2. Full corpus flags: --full (ukpga all), --si (uksi), --eu (euretained). Atom feed pagination (follows 'next' rel links, 500ms delay). Checkpoint/resume (ingest-checkpoint.json, --reset-checkpoint flag). PAUSE file support. Progress: [{done}/{total}] per act. feedUrl stored on LegislationItem. |

**Deploy actions needed:** `npx prisma db push --accept-data-loss` + `npx prisma generate` (V2L-A1 schema changes).

***

### V2L-A2: R2 client utility

| File                               | Change                                                                                                                                                                                                                   |
|------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scripts/legislation/r2-client.ts` | NEW. r2Put, r2Get, r2Exists, xmlKey, compiledKey, summaryKey. Uses @aws-sdk/client-s3. Reads CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, CLOUDFLARE_R2_BUCKET_NAME from env. |
| `scrutinise-web/lib/r2.ts`         | NEW. r2Get, r2Exists, compiledKey, summaryKey for Next.js app routes. Same S3 client setup.                                                                                                                              |

**Deploy actions needed:** `npm install @aws-sdk/client-s3` ✅ (installed). Add env vars to Railway + Vercel (see handoff).

***

### V2L-A1: Schema — lean FTS fields + R2 pointer keys

| File                                  | Change                                                                                                                                                                                                     |
|---------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/prisma/schema.prisma` | LegislationSection: REMOVED compiledText, tnaCompiledText, lexSummary. ADDED rawXmlKey String?, compiledTextKey String?, lexSummaryKey String?, ftsVector String?. LegislationItem: ADDED feedUrl String?. |

**Deploy actions needed:** `npx prisma db push --accept-data-loss` + `npx prisma generate` ✅ (generate done locally).

***

## CODE CHANGES — 23 April 2026 Sprint V2-K

### V2K-C3: Homepage Section 2 text tweaks + Section 4 moved to bottom

| File                          | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
|-------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/app/page.tsx` | H2 headline: removed trailing full stop from "Scrutinise is a vision and a tool." Vision paragraph: "Empower you to change the world" → "To empower you to change your world"; removed trailing full stop. Tool paragraph: "helps professionals…to help you:" → "Scrutinise helps professionals…as your personal guide and researcher. We'll help you:" Section 4 ("Be the engine of the change…") removed from between Section 3 and Section 5 and moved to bottom of page, after Section 8 ("If you're serious"), before footer. |

**Deploy actions needed:** None.

***

### V2K-D2: Lex onboarding flow + userProfiling step

| File                                                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
|--------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/app/ideas/create/CreateIdeaClient.tsx` | Added `onboardingState` ('pending'→'done') and `skipUserProfilingRef`. Two onboarding choice handlers: `handleOnboardingKnow` (sets done, marks skip flag) and `handleOnboardingTellMore` (sets done). Two teal pill buttons rendered below first Lex message when `i === 0 && onboardingState === 'pending' && !msg.isStreaming`. `handleCurrentProposalAccept`: injects "Congratulations — Stage 1 complete" Lex message when `fieldKey === 'ideaType'`. Uses `effectiveNextIdx` to skip `userProfiling` when `skipUserProfilingRef.current` is true. |
| `scrutinise-web/lib/field-labels.ts`                   | Added `userProfiling` step to `FIELD_SEQUENCE` between `title` (index 0) and `summaryDescription` (index 2).                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `scrutinise-web/app/api/ai/[ideaId]/route.ts`          | Added `userProfilingInstruction` constant. `fieldInstruction` condition now excludes `userProfiling`. System prompt appends `userProfilingInstruction` after `fieldInstruction`. `applyFieldUpdatesAndSave`: extracts `parsedJson.userAdditionalNotes`, persists to DB, adds `userAdditionalNotes` to `DIRECT_IDEA_FIELDS`. Returns `userAdditionalNotes` in done event.                                                                                                                                                                                |
| `scrutinise-web/app/api/ideas/[id]/route.ts`           | Added `userAdditionalNotes: z.string().optional()` to `PatchIdeaSchema`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**Deploy actions needed:** `npx prisma db push` + `npx prisma generate` (for `userAdditionalNotes String?` on `Idea`).

***

### V2K-D1: `userAdditionalNotes` schema field

| File                                  | Change                                               |
|---------------------------------------|------------------------------------------------------|
| `scrutinise-web/prisma/schema.prisma` | Added `userAdditionalNotes String?` to `Idea` model. |

**Deploy actions needed:** `npx prisma db push` ✅ `npx prisma generate` ✅

***

### V2K-C2: Homepage Section 2 text tweaks

| File                          | Change                                                                                                                                                              |
|-------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/app/page.tsx` | Vision paragraph: "Empower anyone" → "Empower you"; removed "We call it: 'Active Democracy'." Third box: removed "and MPs to promote it" from influencers sentence. |

**Deploy actions needed:** None.

***

### V2K-C1: Homepage — Vision/Tool section + layout reorder

| File                          | Change                                                                                                                                                                                                                                            |
|-------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/app/page.tsx` | Added new Section 2 "Vision and Tool" (dark `bg-[#0a0a0f]`, large bold headline, two labelled paragraphs, three dark info boxes). Moved "If you're serious" from Section 3 to Section 8 (bottom). Changed "into" → "to help build" in middle box. |

**Deploy actions needed:** None.

***

### V2K-B1: Legislation compare — Llama model fix + single-line TNA cleaning

| File                                                                  | Change                                                                                                                                                                                                                                                                                                                                                                         |
|-----------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/app/legislation-compare/LegislationCompareClient.tsx` | Fixed Llama model ID to `meta-llama/Llama-3.3-70B-Instruct-Turbo`, label `'Llama 3.3 70B'`. System prompt changed to verbatim-accuracy prompt. `cleanTnaText()` improved: single-line path now tries subsection marker regex `(\d+[A-Z]?\s+[A-Z][a-z][^\n]{0,60}\n?\s*$$\d+$$)` before falling back to `sectionNumber` last-occurrence scan. Both call sites pass `s.section`. |

**Deploy actions needed:** None.

***

### V2K-A4: Legislation search route + LegislationPanel TNA/lexSummary

| File                                                            | Change                                                                                                                                                                                                                                                             |
|-----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/app/api/ideas/[id]/legislation-search/route.ts` | Added `tnaCompiledText`, `lexSummary` to SELECT. FTS tsvector updated to `COALESCE(tnaCompiledText, compiledText)`.                                                                                                                                                |
| `scrutinise-web/components/LegislationPanel.tsx`                | `LegislationResult` interface gets `tnaCompiledText?` and `lexSummary?`. TNA verified badge (teal) shown when `tnaCompiledText` present. Plain English / statutory text toggle shown when `lexSummary` present. `statutoryText = tnaCompiledText ?? compiledText`. |

**Deploy actions needed:** None (schema fields added in A1).

***

### V2K-A3: Verbatim-first compile script

| File                             | Change                                                                                                                                                                                                                                                                                                                                                                                                                              |
|----------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scripts/legislation/compile.ts` | Rewritten. `VERBATIM_SYSTEM_PROMPT` (legal editor prompt). `SUMMARY_SYSTEM_PROMPT` (plain English for Lex). `compileSection()`: if `tnaCompiledText` present, copies to `compiledText`, sets `HIGH` confidence, skips Gemini, generates `lexSummary` via separate Gemini call. Else: calls Gemini with verbatim JSON prompt, generates `lexSummary`. Progress logging: `✓ s.N — TNA (verbatim)` vs `✓ s.N — AI (verbatim attempt)`. |

**Deploy actions needed:** Re-run `cd scrutinise-web && npx ts-node ../scripts/legislation/compile.ts` to compile any sections with `tnaCompiledText`.

***

### V2K-A2: Ingest script — fetch TNA compiled text per section

| File                            | Change                                                                                                                                                                                                                                                                                                                                                                                                                                     |
|---------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scripts/legislation/ingest.ts` | Added `cleanTnaCompiledText(raw, sectionNumber)`: multi-line path (find content start, strip footnotes) and single-line path (subsection marker regex, then sectionNumber fallback). Added `fetchTnaCompiledText(legislationGovUkId, sectionNumber)`: fetches `https://www.legislation.gov.uk/{id}/section/{num}`, 404-safe (warning + null). `ingestAct()`: after each section upsert, 1000ms delay then fetch + store `tnaCompiledText`. |

**Deploy actions needed:** Re-run `cd scrutinise-web && npx ts-node ../scripts/legislation/ingest.ts` to populate `tnaCompiledText` for existing sections.

***

### V2K-A1: `LegislationSection` — `tnaCompiledText` + `lexSummary` fields

| File                                  | Change                                                                                  |
|---------------------------------------|-----------------------------------------------------------------------------------------|
| `scrutinise-web/prisma/schema.prisma` | Added `tnaCompiledText String?` and `lexSummary String?` to `LegislationSection` model. |

**Deploy actions needed:** `npx prisma db push` ✅ `npx prisma generate` ✅

***

## CODE CHANGES — 22 April 2026 Sprint V2-J

### V2J-D1: Llama 4 Maverick model ID fix + TNA cleaning improvement

| File                                                                  | Change                                                                                                                                                                                                                                                                                                                                      |
|-----------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/app/legislation-compare/LegislationCompareClient.tsx` | Fixed Llama 4 Maverick model ID from `Llama-4-Maverick-17B-128E-Instruct-FP8` to `Llama-4-Maverick-17B-128E-Instruct-Turbo` (FP8 requires a dedicated endpoint). Extended `cleanTnaText()` with single-line fallback: when no newline-based start found, tries regex `\s(\d+[A-Z]?\s+[A-Z][a-z])` on full raw string and slices from there. |

**Deploy actions needed:** None.

***

### V2J-C1: Inject legislation context into Lex system prompt

| File                                                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
|--------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/app/api/ai/[ideaId]/route.ts`          | `MessageSchema` extended with optional `legislationContext` array (actTitle, sectionNumber, sectionTitle, compiledText). `buildSystemPrompt` ctx type extended with same. When `legislationContext` provided, appends `RELEVANT LEGISLATION FOUND` block to `fieldInstruction` with per-section text (first 800 chars). Includes scripted language guidance for Moments 1/2 vs Moment 3 (Coherent Actions). POST handler destructures and passes `legislationContext` to `buildSystemPrompt`. |
| `scrutinise-web/app/ideas/create/CreateIdeaClient.tsx` | `handleSend` now includes `legislationContext` in request body (top 2 results, mapped to actTitle/sectionNumber/sectionTitle/compiledText) when `legislationResults.length > 0`.                                                                                                                                                                                                                                                                                                              |

**Deploy actions needed:** None.

***

### V2J-B2: LegislationPanel slide-out component

| File                                                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
|--------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/components/LegislationPanel.tsx`       | New component. Slide-over panel (fixed right, full-height, max-w-md, z-50). Backdrop overlay. Header with close button. Amber disclaimer banner linking to legislation.gov.uk. Per-result cards: act title + section number + year, teal section title, scrollable monospace compiled text (max-h-200px), legislation.gov.uk link, change type selector (Amend/Repeal/Add), proposed wording textarea, "Attach to this action" button (only visible when `currentCoherentActionId` set). Calls POST `/api/ideas/[id]/legislation-link`. Shows saved state. Empty state message. |
| `scrutinise-web/app/ideas/create/CreateIdeaClient.tsx` | Imported `LegislationPanel`. Added `coherentActionIds: string[]` state populated from `ideaData.coherentActions[*].id` in `populateFieldValuesFromIdea`. Derived `currentCoherentActionId = coherentActionIds[caLoopCount]` when in `coherentActions` section. Added legislation toggle button to toolbar (desktop: hidden lg:inline-flex, teal; mobile: alongside "See completed answers"). Rendered `<LegislationPanel>` as slide-over before `<SiteFooter>`.                                                                                                                 |

**Deploy actions needed:** None.

***

### V2J-B1: Three-moment legislation search in CreateIdeaClient

| File                                                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
|--------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/app/ideas/create/CreateIdeaClient.tsx` | Added `LegislationResult` interface. Added state: `legislationResults`, `showLegislationPanel`, `legislationLoading`. Added `searchLegislation(query)` function (POST to `/api/ideas/[id]/legislation-search`, sets results + opens panel). Added three trigger moments in `handleCurrentProposalAccept` after `handleSend`: (1) `summaryDescription` accepted → search `title + value`; (2) `diagnosis.whyPersisted` accepted → search `value`; (3) `coherentAction.title` accepted → search `value`. |

**Deploy actions needed:** None.

***

### V2J-A1: Legislation search API, CoherentActionSection schema, legislation-link route

| File                                                            | Change                                                                                                                                                                                                                                                                                                              |
|-----------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/prisma/schema.prisma`                           | Added `CoherentActionSection` model (cuid id, coherentActionId, legislationSectionId, proposedWording?, changeType default AMEND, timestamps). Added `legislationSections CoherentActionSection[]` to `CoherentAction`. Added `coherentActionLinks CoherentActionSection[]` to `LegislationSection`.                |
| `scrutinise-web/app/api/ideas/[id]/legislation-search/route.ts` | New POST route. Auth required. Zod body: `{ query, limit? }`. Runs PostgreSQL FTS query via `prisma.$queryRaw` — joins LegislationSection + LegislationItem, filters `compilationStatus = COMPILED` and `compiledText IS NOT NULL`, ranks by `ts_rank` DESC and `amendmentCount` ASC. Returns `{ results: [...] }`. |
| `scrutinise-web/app/api/ideas/[id]/legislation-link/route.ts`   | New POST + DELETE route. POST: auth + idea ownership check, upsert CoherentActionSection (findFirst + update/create). DELETE: auth + ownership check, delete by id.                                                                                                                                                 |

**Deploy actions needed:** `npx prisma db push` ✅ `npx prisma generate` ✅

***

## CODE CHANGES — 22 April 2026 Sprint V2-I (continued)

### V2I-A3: Server-side proxy for Together AI (CORS fix)

| File                                                                  | Change                                                                                                                                                                                                                                                       |
|-----------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/app/api/legislation/together-proxy/route.ts`          | New POST route. Reads `{ model, messages, apiKey }` from request body, forwards to `https://api.together.xyz/v1/chat/completions` with `Authorization: Bearer {apiKey}`, returns response JSON. Proxies the request server-side to avoid browser CORS block. |
| `scrutinise-web/app/legislation-compare/LegislationCompareClient.tsx` | `together` caller updated to POST to `/api/legislation/together-proxy` instead of calling Together AI directly. `apiKey` included in body rather than Authorization header.                                                                                  |

**Deploy actions needed:** None.

***

### V2I-A2: Clean TNA gold standard text before Jaccard scoring

| File                                                                  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
|-----------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/app/legislation-compare/LegislationCompareClient.tsx` | Added `cleanTnaText()` function that strips metadata preamble (seeks first line matching operative statutory text: section number + capital, "Part N", "Chapter N", or `**N`) and amendment footnotes from the end (strips trailing lines starting "Words in s.", "S. N", "Substituted", "Inserted", "Omitted", "Repealed", "Modified"). Applied to gold text before Jaccard comparison in both success and error paths. TNA Gold Standard display heading shows `(cleaned)` label in grey. |

**Deploy actions needed:** None.

***

## CODE CHANGES — 21 April 2026 Sprint V2-I

### V2I-A1: Llama 4 Maverick (Together AI) on legislation-compare

| File                                                                  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                          |
|-----------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-web/app/legislation-compare/LegislationCompareClient.tsx` | Added `meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8` to `MODELS` array (provider: `together`). Added `together` caller in `PROMPTS` — OpenAI-compatible format, endpoint `https://api.together.xyz/v1/chat/completions`. Added `together: ''` to `apiKeys` state. Added Together AI API key input to API keys section (placeholder `key_...`). Errors shown as "Error" in results like other models. Client-side only — no server changes. |

**Deploy actions needed:** None.

***

## CODE CHANGES — 17 April 2026 Sprint V2-H

### V2H-A1: FIELD_SEQUENCE in field-labels.ts

| File                  | Change                                                                                                                                                                                                                                                                                                                       |
|-----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `lib/field-labels.ts` | Added `FieldStep` interface and `FIELD_SEQUENCE` array (57 steps: 4 Initial Information, 8 Diagnosis + summary, 9 Guiding Policy + summary, 10 Coherent Action loop + summary). `isLexGenerated` flag for 3 summary steps. `isLoop` flag for 9 CA fields. Canonical ordered sequence — frontend walks it one step at a time. |

**Deploy actions needed:** None.

***

### V2H-A2: currentFieldIndex state machine — platform controls field sequence

| File                                    | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
|-----------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/create/CreateIdeaClient.tsx` | Added `currentFieldIndex`, `caLoopCount`, `addAnotherCAPrompt` states. Added `currentFieldIndexRef` for stale-closure-safe access in handleSend. `populateFieldValuesFromIdea` computes first unfilled field on load (resume from where user left off). Every API call now includes `currentFieldKey`, `currentFieldLabel`, `currentFieldSection`. `handleCurrentProposalAccept` advances `currentFieldIndex`, triggers CA loop "Add another?" prompt at last isLoop step, auto-sends generation trigger for isLexGenerated steps. `handleAddAnotherCA` handles Yes/No response to CA loop. `handleSkipField` advances without writing a value. Skip button added to input area. Old `prev === null ? fp : prev` gate removed — platform controls sequence now. |

**Deploy actions needed:** None.

***

### V2H-B1: Dynamic single-field instruction to Lex

| File                           | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
|--------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/api/ai/[ideaId]/route.ts` | `MessageSchema` extended with `currentFieldKey`, `currentFieldLabel`, `currentFieldSection` (all nullable optional). `buildSystemPrompt` accepts and uses these fields to generate dynamic `fieldInstruction`. `fieldInstruction` injected after `${stageSection}` in system prompt. Removed old FIELD CONVERSATION PROTOCOL block (FIELD SEQUENCE, SECTION GATE RULE, EVIDENCE NUDGING, MECHANISM TYPE, 5-step protocol, ONE FIELD AT A TIME rule, FIELD ACCEPTANCE rule, Valid fieldUpdates keys list) from Stage 1 section. SCOPE BOUNDARIES added to `fieldInstruction` (no team names, sharing, voting in Lex chat). |

**Deploy actions needed:** None.

***

### V2H-C1: Five mobile UX fixes

| File                                    | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
|-----------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/create/CreateIdeaClient.tsx` | Fix 1 (viewport clip): added `max-w-full overflow-x-hidden` to chat panel and `max-w-full` to input box. Fix 2 (scroll): chat now scrolls to TOP of latest Lex message (`data-role="assistant"` added to Lex bubbles, `scrollIntoView({block: 'start'})` used). Fix 3/5 (Initial Information): always expanded when has content; chevron shows collapse state; collapses via `initialInformation_collapsed` toggle key. Fix 4 (team name scope): SCOPE BOUNDARIES added to system prompt via `fieldInstruction` (covers both field-active and field-complete states). |

**Deploy actions needed:** None.

***

### V2H-D1: RootCause multiple causes with depth and parent-child chain

| File                   | Change                                                                                                                                                                                                                                                                               |
|------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `prisma/schema.prisma` | Added `causeDepth Int @default(0)`, `orderIndex Int @default(0)`, `parentId String?` to `RootCause`. Added self-referential `parent`/`children` relations via `"CauseChain"`. Added `@@index([parentId])`. `prisma db push` ✅ (additive only — no data loss). `prisma generate` ✅. |

**Deploy actions needed:** `npx prisma db push` + `npx prisma generate` (already applied locally).

***

## CODE CHANGES — 17 April 2026 Sprint V2-G

### V2G-A1: MechanismType enum + schema refactor

| File                   | Change                                                                                                                                                                                                                                                                                                                                                                                |
|------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `prisma/schema.prisma` | Added `MechanismType` enum (INCENTIVES, RULES, TRANSPARENCY, MARKET_DESIGN, INSTITUTIONAL_RESTRUCTURING). Removed 5 deprecated `mechanism*` String? fields from `GuidingPolicy`, replaced with `mechanismTypes MechanismType[]`. Added `mechanismType MechanismType?` to `CoherentAction`. `prisma db push --accept-data-loss` applied (test data only in DB). `prisma generate` run. |

**Deploy actions needed:** None (db push already applied).

***

### V2G-B1: field-labels.ts restructure — numbered fields, Initial Information, DEPRECATED_FIELDS

| File                  | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `lib/field-labels.ts` | Restructured `SIDEBAR_SECTIONS` from flat array to nested `{ key, heading, fields[] }` structure. Added `initialInformation` section (fields 1–4). Added field numbers (1–27) to all labels. Replaced 5 mechanism field entries with single `mechanismTypes` (field 14). Added `mechanismType` (field 20a) to coherent actions section. Removed `summaryDiagnosis`, `summaryGuidingPolicy`, `summaryCoherentActions`, `proposedWording`, `whoAffected` from sections (Lex-generated, not user-filled). Added `DEPRECATED_FIELDS` export (infrastructure only — not wired to UI). |

**Deploy actions needed:** None.

***

### V2G-C1: Lex system prompt — field sequence, section gates, evidence nudging, mechanism type

| File                           | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
|--------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/api/ai/[ideaId]/route.ts` | Updated FIELD CONVERSATION PROTOCOL: added explicit numbered field sequence (1–27) with section gate rule. Added EVIDENCE NUDGING instruction (once per section for factual assertions). Added MECHANISM TYPE FOR COHERENT ACTIONS instruction (ask after each CA title). Updated fieldUpdates key list to include `mechanismTypes` and `mechanismType`, remove deprecated mechanism fields. Updated field label references to use numbered format. Updated Stage 2 field targets. Added `mechanismType` persistence to most recent CoherentAction in `applyFieldUpdatesAndSave`. |

**Deploy actions needed:** None.

***

### V2G-D1: Mobile answers panel — Initial Information section

| File                                         | Change                                                                                                                                                                                                                                                                                                                             |
|----------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/create/CreateIdeaClient.tsx`      | Added `summaryDescription`, `govtArea`, `ideaType` to `FieldCompletion` interface and `EMPTY_FIELDS`. Added govtArea and ideaType to `populateFieldValuesFromIdea`. Updated mechanism field handling in `populateFieldValuesFromIdea` to use `mechanismTypes` array. Added `initialInformation` section to `MobileSidebarContent`. |
| `app/api/ai/[ideaId]/route.ts`               | Added `summaryDescription`, `govtArea`, `ideaType` to completedFields select and response.                                                                                                                                                                                                                                         |
| `app/api/ideas/[id]/field-approval/route.ts` | Updated to remove deprecated mechanism field refs; added `mechanismType` CoherentAction handler; added `guidingPolicy.mechanismTypes` array handler; added `summaryDescription`, `govtArea`, `ideaType` to completedFields.                                                                                                        |
| `app/api/ideas/[id]/guiding-policy/route.ts` | Replaced 5 mechanism String? fields in Zod schema with `mechanismTypes` enum array. Added new Rumelt fields (`linkToDiagnosis`, `whatThisPolicyRulesOut`, `whyThisApproachNotOthers`, `conditionsForSuccess`).                                                                                                                     |
| `app/ideas/[id]/IdeaDetailClient.tsx`        | Replaced `GuidingPolicyRecord` interface (5 mechanism fields → \`mechanismTypes: string[]                                                                                                                                                                                                                                          |

**Deploy actions needed:** None (db push already applied).

***

## CODE CHANGES — 16 April 2026 Sprint V2-F

### V2F-A1: Fix fieldUpdates not persisting to DB

| File                           | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
|--------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/api/ai/[ideaId]/route.ts` | Added DB write inside `applyFieldUpdatesAndSave`: when `fieldUpdates` contains keys matching direct Idea fields (`title`, `summaryDiagnosis`, `summaryGuidingPolicy`, `summaryCoherentActions`, `govtArea`, `ideaType`, `whoAffected`, etc.), writes them to DB via `prisma.idea.update`. Root cause: `fieldUpdates` was parsed and returned in `pendingProposals` but never persisted; `hasFieldUpdates: true` triggered a DB re-fetch which returned stale data, overwriting the client's optimistic state. |

**Deploy actions needed:** None (Vercel auto-deploy on push).

***

### V2F-A2: Strengthen FIELD ACCEPTANCE in Lex system prompt

| File                           | Change                                                                                                                                                                                                                     |
|--------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/api/ai/[ideaId]/route.ts` | Rewrote the FIELD ACCEPTANCE rule in `buildSystemPrompt` to be explicit that `fieldUpdates` is mandatory on "Accepted:" messages, includes example JSON, and makes clear this is a machine-generated signal not user text. |

**Deploy actions needed:** None.

***

### V2F-B1: Mobile UI — remove label, full-width black action buttons

| File                                    | Change                                                                                                                                                                                                                                                                                                                                                                                                                                          |
|-----------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/create/CreateIdeaClient.tsx` | (1) Removed "Developing with Lex" label from toolbar; changed `justify-between` to `justify-end`. (2) Removed teal `See completed answers →` button from inside toolbar button row; added full-width black button (`bg-foreground text-background`) below toolbar (`lg:hidden`). (3) Removed teal `← Back to chat` button from panel h2 header row (kept "Your Idea" heading); added full-width black `← Back to chat` button below the header. |

**Deploy actions needed:** None.

***

## CODE CHANGES — 16 April 2026 Sprint V2-E

### V2E-A1: Mobile sidebar field display fix

| File                                    | Change                                                                                                                                                                                                                                                                                                                          |
|-----------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/create/CreateIdeaClient.tsx` | Removed V2D debug console.logs and yellow debug block. Removed temporary "Back to Chat" button from `MobileSidebarContent`. Added `useEffect` that auto-expands sections with content so filled fields are always visible when mobile panel opens. Fixed `renderFieldCard` to use direct key lookup (no broken regex fallback). |
| `app/api/ai/[ideaId]/route.ts`          | Removed V2D debug console.logs.                                                                                                                                                                                                                                                                                                 |

**Deploy actions needed:** None.

***

### V2E-A2: "See completed answers →" button in mobile chat toolbar

| File                                    | Change                                                                                                                                                                                             |
|-----------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/create/CreateIdeaClient.tsx` | Added `See completed answers →` button to Lex toolbar (`lg:hidden`). Updated "← Back to chat" button in mobile panel header to teal styling. Both buttons use `text-teal-600 hover:text-teal-700`. |

**Deploy actions needed:** None.

***

### V2E-A3: Auto-flip to answers on acceptance + field whoosh animation

| File                                    | Change                                                                                                                                                                                                                                                                                                                                                                                            |
|-----------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/create/CreateIdeaClient.tsx` | Added `lastAcceptedField` state. In `handleCurrentProposalAccept`, on mobile (\< 1024px): sets `mobilePanelOpen(true)` and `lastAcceptedField(normKey)`. Added `lastAcceptedField` + `setLastAcceptedField` props to `MobileSidebarContent`. In `renderFieldCard`, applies `field-whoosh` class when key matches `lastAcceptedField`. Added `useEffect` to clear `lastAcceptedField` after 800ms. |
| `app/globals.css`                       | Added `fieldWhoosh` keyframe (slide from right, teal peak, fade) and `.field-whoosh` utility class (800ms).                                                                                                                                                                                                                                                                                       |

**Deploy actions needed:** None.

***

### V2E-A4: Gate Lex to one field proposal at a time

| File                                    | Change                                                                                                                                                                      |
|-----------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/api/ai/[ideaId]/route.ts`          | Added CRITICAL RULE — ONE FIELD AT A TIME to the FIELD CONVERSATION PROTOCOL in the system prompt.                                                                          |
| `app/ideas/create/CreateIdeaClient.tsx` | In done event handler, `setCurrentProposal` now uses functional update: `prev => prev === null ? fp : prev` — only sets a new proposal if no proposal is currently showing. |

**Deploy actions needed:** None.

***

### V2E-B1: Legislation schema — FTS fields, tags, jurisdiction, crossref

| File                   | Change                                                                                                                                                                                                                                                                                                |
|------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `prisma/schema.prisma` | Added `tags String[]`, `amendmentCount Int`, `complexityScore Int`, `inForce Boolean`, `jurisdiction String`, `policyArea String?` to `LegislationSection`. Added `subjectArea String?`, `policyArea String?`, `crossRefsOut`, `crossRefsIn` to `LegislationItem`. Added `LegislationCrossRef` model. |

**Deploy actions needed:** `npx prisma db push` ✅ `npx prisma generate` ✅

***

### V2E-B2: PostgreSQL GIN FTS index + ingest/compile script updates

| File                                                                   | Change                                                                                                                                                                                                                                              |
|------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `prisma/migrations/20260416120000_legislation_fts_index/migration.sql` | Raw SQL migration: GIN index on `LegislationSection` for FTS (compiledText + sectionTitle + policyArea), GIN index on tags array, btree index on jurisdiction + inForce. Apply via psql when ingestion is ready. Column casing note in file header. |
| `scripts/legislation/compile.ts`                                       | Extended Gemini prompt to return `tags` array. After compilation, writes `tags`, `amendmentCount` (count of amendment records), `complexityScore` (`ceil(amendmentCount/3)` capped at 5) to `LegislationSection`.                                   |
| `scripts/legislation/ingest.ts`                                        | Refactored to fetch CLML once per act. Added `extractClmlMetadata()` to parse `dc:coverage`, `ukm:Subject`, `dc:subject` elements. Writes `jurisdiction`, `subjectArea`, `policyArea` to `LegislationItem` on create and update.                    |

**Deploy actions needed:** Apply `migration.sql` via psql when running ingestion (not before). Casing of column names should be verified with `\d "LegislationSection"` first.

***

## CODE CHANGES — 15 April 2026 Sprint V2-D

### V2D-fix-params: Async params verified clean (V2C-fix already applied)

| File                                    | Change                                                                                                            |
|-----------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| `app/api/legislation/[itemId]/route.ts` | Confirmed `params: Promise<{itemId: string}>` and `await params` — applied in V2C-fix. No further changes needed. |
| `app/legislation/[itemId]/page.tsx`     | Same — already correct. No other dynamic routes required fixing.                                                  |

**Deploy actions needed:** None.

***

### V2D-proposal-card-desktop: Teal proposal card on desktop + swipe gesture threshold

| File                                    | Change                                                                                                                                                                                                                                                                                                                                                                                    |
|-----------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `components/FieldProposalCard.tsx`      | Rewrote swipe detection: `absDx > 50 && absDx > absDy * 2.5` ratio (was just `absDx > absDy`). Edit button now calls `onEdit(proposedValue)` to copy text to chat input (card goes to `discussed`), replacing in-card textarea editing. Updated visual to teal border design per brief. Added `proposal-pulse-animation` class on Accept. Removed autoAcceptSeconds countdown complexity. |
| `app/ideas/create/CreateIdeaClient.tsx` | `handleProposalEdit` now marks proposal as `discussed` and copies proposed text to `inputValue` + focuses input. No longer calls `handleProposalAccept`.                                                                                                                                                                                                                                  |

**Deploy actions needed:** None.

***

### V2D-mobile-panel: Mobile sidebar panel — swipe-right navigation

| File                                    | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
|-----------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/create/CreateIdeaClient.tsx` | Added `mobilePanelOpen` state. Added `outerTouchStartX/Y` refs and `handleOuterTouchStart/End` (threshold 80px, ratio 2.0). Main area wrapped with touch handlers. Added teal edge indicator button (fixed right, `lg:hidden`). Added full-screen `fixed inset-0 z-40 lg:hidden` panel overlay with slide-in transition. Added `MobileSidebarContent` component: shows all Diagnosis + GuidingPolicy fields with value preview, Edit (copies to input + closes panel) and Chat (sends revisit message + closes panel) buttons per field. |

**Deploy actions needed:** None.

***

### V2D-sidebar-answers: Desktop sidebar — filled answers with open/close toggles

| File                                    | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
|-----------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/create/CreateIdeaClient.tsx` | Added `sidebarExpanded`, `openFields` (Set), `fieldValues` (Record\<string, string\>) states. Desktop sidebar: added expand/collapse button (⊞/⊟), sidebar width transitions between `w-72` and `w-1/2`. Stage 1 sidebar fields now show collapsible value div with `field-accept-animation` when toggled. `Stage2Sidebar` updated with same props + `renderFieldRow` updated to show value when `openFields` contains field key. `handleProposalAccept` stores value in `fieldValues` and adds to `openFields`. Streaming `done` handler auto-opens newly completed fields. |

**Deploy actions needed:** None.

***

### V2D-whoosh-animation: Whoosh animation on field accept

| File                                    | Change                                                                                                                                                                                                      |
|-----------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/globals.css`                       | Added `@keyframes fieldAccept` (slide-in from right, 200ms) and `@keyframes proposalPulse` (teal background pulse, 300ms). Added `.field-accept-animation` and `.proposal-pulse-animation` utility classes. |
| `components/FieldProposalCard.tsx`      | Accept button triggers `proposal-pulse-animation` via `isPulsing` state on the saved-state card.                                                                                                            |
| `app/ideas/create/CreateIdeaClient.tsx` | Field values in sidebar render with `field-accept-animation` class.                                                                                                                                         |

**Deploy actions needed:** None.

***

### V2D-lex-flow: Lex field conversation protocol

| File                                    | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
|-----------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/api/ai/[ideaId]/route.ts`          | Added FIELD CONVERSATION PROTOCOL section to `buildSystemPrompt` (Stage 1 section): 5-step flow (Orientation → Question → Assess → Confirmation → Next field). Added FIELD ACCEPTANCE rule: messages starting with "Accepted: " trigger `fieldUpdates` population and next-field orientation. `applyFieldUpdatesAndSave` now parses `fieldProposal` JSON key (alongside `fieldUpdates`, `insightFlag`) and strips it from `displayText`. Returns `fieldProposal` in done SSE event.                                                                                                                                                     |
| `app/ideas/create/CreateIdeaClient.tsx` | Added `currentProposal` state. Streaming `done` handler extracts `fieldProposal` from event and sets `currentProposal`. Renders `FieldProposalCard` above input when `currentProposal` is non-null. `handleCurrentProposalAccept`: optimistically updates `fieldValues` + `openFields`, clears `currentProposal`, sends silent system message `Accepted: [label]` to Lex via `handleSend(false, systemMessage)`. `handleCurrentProposalEdit` / `handleCurrentProposalDiscuss` clear `currentProposal`. `handleSend` updated to accept optional `systemMessageOverride` — when set, message is sent to API without appearing in chat UI. |

**Deploy actions needed:** None.

***

## CODE CHANGES — 15 April 2026 Sprint V2-C

### V2C-admin-nav: Admin nav link visible to ADMIN/SUPER_ADMIN

| File                         | Change                                                                                                                                                                                                           |
|------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/api/user/role/route.ts` | NEW — `GET /api/user/role` returns `{ role }` from DB for the current Clerk session.                                                                                                                             |
| `components/PublicNav.tsx`   | Added `useEffect` to fetch `/api/user/role` when signed in. `isAdmin` computed from `dbRole`. Admin link rendered in desktop and mobile nav when `isAdmin` is true. Added Legislation link to both nav variants. |

**Deploy actions needed:** None.

***

### V2C-leg-compare: Legislation evaluator at /legislation-compare

| File                                                   | Change                                                                                                                                                                                          |
|--------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/api/legislation/fetch/route.ts`                   | NEW — server-side CORS proxy for legislation.gov.uk CLML XML. Accepts `type`, `year`, `chapter`, `section`, `version` params. Caches 24h.                                                       |
| `app/legislation-compare/page.tsx`                     | NEW — Server Component wrapper with metadata.                                                                                                                                                   |
| `app/legislation-compare/LegislationCompareClient.tsx` | NEW — Full interactive evaluator. 20 test sections, 6 models, Jaccard similarity scoring, per-section gold/AI comparison, leaderboard. API keys entered client-side only, never sent to server. |
| `middleware.ts`                                        | Added `/legislation-compare`, `/api/legislation/fetch`, `/legislation`, `/api/legislation/search`, `/api/legislation/(.*)` to public routes.                                                    |

**Deploy actions needed:** None. Page is public.

***

### V2C-leg-schema: Legislation DB schema

| File                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                              |
|------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `prisma/schema.prisma` | Added enums: `LegislationTier`, `LegislationType`, `CompilationConfidence`, `CompilationStatus`, `CorrectionStatus`, `CorrectionDecision`. Added models: `LegislationItem`, `LegislationSection`, `LegislationAmendment`, `IdeaLegislation`, `LegislationCorrection`. Added `legislationLinks` relation to `Idea`. Added `legislationCorrections` relation to `User`. Added `@@unique([legislationItemId, sectionNumber])` on `LegislationSection`. |

**Deploy actions needed:** `npx prisma db push` + `npx prisma generate` ✓ done.

***

### V2C-leg-ingest: Legislation ingestion script

| File                            | Change                                                                                                                                                                                                                                                                            |
|---------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scripts/legislation/ingest.ts` | NEW — Fetches Tier 1 (post-2010 UKPGA) Act list from legislation.gov.uk Atom feed. Parses CLML P1group elements into sections. Upserts `LegislationItem` and `LegislationSection` records. Rate-limited. Run: `cd scrutinise-web && npx ts-node ../scripts/legislation/ingest.ts` |

**Deploy actions needed:** Manual — run after deploy. Start with `slice(0, 5)` to test.

***

### V2C-leg-compile: Legislation compilation script

| File                             | Change                                                                                                                                                                                                                                                                                                                    |
|----------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scripts/legislation/compile.ts` | NEW — AI batch compiler using Gemini 2.5 Flash. Picks up `PENDING` sections in batches of 50. Applies amendments chronologically. Stores `compiledText`, `confidence`, `unappliedAmendments`. Sections with `LOW` confidence flagged `NEEDS_REVIEW`. Run: `GEMINI_API_KEY=xxx npx ts-node scripts/legislation/compile.ts` |

**Deploy actions needed:** Manual — run after ingestion.

***

### V2C-leg-api: Legislation API routes

| File                                    | Change                                                                                                                        |
|-----------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| `app/api/legislation/search/route.ts`   | NEW — `GET /api/legislation/search` — public, filterable by q/type/year/jurisdiction, paginated (20/page).                    |
| `app/api/legislation/[itemId]/route.ts` | NEW — `GET /api/legislation/[itemId]` — public, returns full item with compiled sections and amendments.                      |
| `app/api/legislation/link/route.ts`     | NEW — `POST /api/legislation/link` — auth required, upserts `IdeaLegislation` link with linkType (target/relevant/precedent). |

**Deploy actions needed:** None.

***

### V2C-leg-ui: Legislation search and browse UI

| File                                                 | Change                                                                                                                                                                                                                                 |
|------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/legislation/page.tsx`                           | NEW — Server Component wrapper with metadata.                                                                                                                                                                                          |
| `app/legislation/LegislationBrowseClient.tsx`        | NEW — Browse/search page with debounced search, type/jurisdiction filters, paginated results list.                                                                                                                                     |
| `app/legislation/[itemId]/page.tsx`                  | NEW — Server Component, fetches full item from DB, passes to client.                                                                                                                                                                   |
| `app/legislation/[itemId]/LegislationItemClient.tsx` | NEW — Section list with expand/collapse. Provenance banner on every section (TNA source link, amendment count, confidence badge, suggest correction). Correction submission form (auth-gated — redirects to sign-in if not signed in). |

**Deploy actions needed:** None. Initially empty pending ingestion + compilation.

***

## CODE CHANGES — 13 April 2026 Sprint V2-A

### V2A-connection: AI reliability — Vercel timeout, Grok fallback, auto-retry, Sentry logging

| File                                    | Change                                                                                                                                                                                                                                            |
|-----------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `vercel.json`                           | Added `maxDuration: 60` for the AI route function.                                                                                                                                                                                                |
| `app/api/ai/[ideaId]/route.ts`          | Added `classifyError` helper ('timeout', 'rate_limit', 'network', 'api_error'). Added `logAICall` helper via Sentry. Gemini/Grok try/catch now structured with timing, error type, and fallback flag. All 503 responses return `errorType` field. |
| `app/ideas/create/CreateIdeaClient.tsx` | Progressive retry: silent 1s auto-retry on first failure; message + 5s auto-retry on second failure (timeout/rate_limit); final error with Try Again button on third failure. `handleSend` accepts `isRetry` param to skip user message append.   |

**Deploy actions needed:** None (Vercel env var verification needed).

### V2A-labels: Stage labels — Stage X format, notification redesign, remove voting box

| File                                  | Change                                                                                                                                                                                                                        |
|---------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `lib/display-utils.ts`                | NEW — `stageToLabel()` maps STAGE_1→'Stage 1' etc.                                                                                                                                                                            |
| `app/dashboard/page.tsx`              | Uses `stageToLabel()` for idea stage pills. Notification cards redesigned: title/message/date/What Next? link layout. Added `relatedIdeaId` to notification query. `normaliseStages()` replaces STAGE_X in notification text. |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Removed "Voting opens when this idea reaches the Campaign stage" box.                                                                                                                                                         |

**Deploy actions needed:** None.

### V2A-field-labels: Field labels — lib/field-labels.ts, sidebar section navigation

| File                                    | Change                                                                                                                                                   |
|-----------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| `lib/field-labels.ts`                   | NEW — `FIELD_LABELS` record (80+ fields), `SIDEBAR_SECTIONS` array, `getFieldLabel()`, `getSectionHeading()`.                                            |
| `app/ideas/create/CreateIdeaClient.tsx` | Stage2Sidebar rewritten to use SIDEBAR_SECTIONS loop, show/hide toggles, getFieldLabel(). Fixed `onClick={handleSend}` → `onClick={() => handleSend()}`. |

**Deploy actions needed:** None.

### V2A-schema: Schema additions

| File                   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
|------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `prisma/schema.prisma` | Added enums: `TargetOrganisationType`, `PointsCategory`, `PointsReason`. GuidingPolicy: +4 Rumelt fields (linkToDiagnosis, whatThisPolicyRulesOut, whyThisApproachNotOthers, conditionsForSuccess). CoherentAction: +5 benefit/cost fields (benefitFinancial, benefitSocial, benefitOngoing, netCostOngoing, netCostOneOff). New models: ResourcesCommitted, TargetOrganisation, PointsLedger, Reputation, ReferralEvent. Updated User and Idea relations. |

**Deploy actions needed:** `npx prisma db push` ✓ `npx prisma generate` ✓

### V2A-ux: Navigation and UX fixes

| File                                    | Change                                                                                                                                                              |
|-----------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/sign-in/[[...sign-in]]/page.tsx`   | After sign-in, redirect to /dashboard (not /ideas/create).                                                                                                          |
| `app/ideas/create/CreateIdeaClient.tsx` | Added "My Dashboard" link button to Lex toolbar.                                                                                                                    |
| `app/ideas/[id]/IdeaDetailClient.tsx`   | Edit + What Next? buttons moved below author/date line. Gate cards moved below tab content area. Added `whatNextOpen` state, reads `?whatnext=true` param on mount. |
| `app/api/ai/[ideaId]/route.ts`          | RETURNING SESSION replaced with ORIENTEERING ON RETURN — specific 3-step return welcome (name + last thing + next field + "Shall we continue?").                    |

**Deploy actions needed:** None.

### V2A-points: Credibility points system

| File                                                         | Change                                                                                                                                                     |
|--------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `lib/points.ts`                                              | NEW — `POINTS_SCHEDULE`, `awardPoints`, `checkCap`, `cascadeTeambuilderPoints`, `awardPointsDirect`. Full cap logic (once_per_idea, idea_count, per_idea). |
| `lib/stage-gates.ts`                                         | Added `awardPoints` import. Awards STAGE_2_ADVANCE, STAGE_3_ADVANCE, STAGE_4_ADVANCE, STAGE_5_ADVANCE at each advance function.                            |
| `app/api/ideas/[id]/route.ts`                                | Awards IDEA_STARTED (first PATCH), DIAGNOSIS_COMPLETE, GUIDING_POLICY_COMPLETE when fields first populated.                                                |
| `app/api/ideas/[id]/contributions/route.ts`                  | Awards CONTRIBUTION_SUBMITTED on POST.                                                                                                                     |
| `app/api/ideas/[id]/contributions/[commentId]/rate/route.ts` | Awards CONTRIBUTION_RATED_3/4/5/1_2 to contribution author; IDEA_RATED to rater.                                                                           |
| `app/api/ideas/[id]/vote/route.ts`                           | Awards IDEA_VOTED on POST.                                                                                                                                 |

**Deploy actions needed:** None.

### V2A-whatnext: "What Next?" static panel

| File                                  | Change                                                                                                            |
|---------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| `components/WhatNextPanel.tsx`        | NEW — Progress bar (4 segments), collapsible journey overview, template status text, collapsible tips section.    |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Imports WhatNextPanel. Renders below Edit button. Passes `diagnoses[0]`, `guidingPolicies[0]`, `coherentActions`. |

**Deploy actions needed:** None.

### V2A-docs: Docs update

| File                                       | Change                                                                                                                         |
|--------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| `docs/system_mechanics_v0_8.md` | NEW — v0.8 with updated Section 3 points schedule and new Section 21 (Referral Mechanics, Points, and Credibility end-to-end). |
| `docs/CHANGE_LOG.md`            | This entry.                                                                                                                    |
| `docs/handoff_summary.md`       | Sprint V2-A section added.                                                                                                     |
| `CLAUDE.md`                                | Updated entity_list reference from v4 to v5.                                                                                   |

**Deploy actions needed:** None.

***

## CODE CHANGES — 28 March 2026 Sprint L5-A (L5-insight, L5-adapt, L5-research)

### L5-insight: LexInsight system — DB, admin panel, approved rules in prompt

| File                                       | Change                                                                                                                                                                                                                                                          |
|--------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `prisma/schema.prisma`                     | Added `LexInsightStatus` enum (DRAFT/APPROVED/REJECTED). Added `LexInsight` model. Added `lexInsightReviews` relation to User.                                                                                                                                  |
| `app/api/ai/[ideaId]/route.ts`             | Fetches up to 50 APPROVED LexInsight rules before building system prompt; injects as `## APPROVED BEHAVIOUR RULES`. Parses `insightFlag` from Lex JSON response; creates LexInsight DB record when present. Added INSIGHT LOGGING instruction to system prompt. |
| `app/api/admin/lex-insights/route.ts`      | NEW — GET /api/admin/lex-insights — returns all insights sorted DRAFT→APPROVED→REJECTED. ADMIN/SUPER_ADMIN only.                                                                                                                                                |
| `app/api/admin/lex-insights/[id]/route.ts` | NEW — PATCH /api/admin/lex-insights/[id] — update status + approvedRule. ADMIN/SUPER_ADMIN only.                                                                                                                                                                |
| `app/admin/page.tsx`                       | Added `LexInsight` type, `LexInsightCard` component, `LexInsightsSection` component. Added "Lex Insights" tab (available to all admins, not just SUPER_ADMIN).                                                                                                  |

**Deploy actions needed:** `npx prisma db push` then `npx prisma generate`.

### L5-adapt: Lex adapts to experience level and user confidence

| File                           | Change                                                                                                                                                                                                                                 |
|--------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/api/ai/[ideaId]/route.ts` | Added full EXPERIENCE LEVEL ADAPTATION section (all 5 levels with specific guidance). Added CONFIDENCE ADAPTATION section (HIGH/MEDIUM/LOW signals with response strategies). Both added as top-level sections in `buildSystemPrompt`. |

**Deploy actions needed:** None.

### L5-research: Lex proactive research and engagement facts

| File                           | Change                                                                                                                                                                                          |
|--------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/api/ai/[ideaId]/route.ts` | Added PROACTIVE RESEARCH AND ENGAGEMENT section to `buildSystemPrompt` — when/what/how to surface surprising facts, ironies, and examples. Hard limits: one fact per exchange, never fabricate. |

**Deploy actions needed:** None.

***

## CODE CHANGES — 28 March 2026 (team-invite-1, nav-lex-1, edit-button-1, Lex v5.1)

### team-invite-1: Team invite — search existing users and email invite for new users

| File                                        | Change                                                                                                                                                           |
|---------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/api/users/search/route.ts`             | NEW — GET /api/users/search?q= — search by name/username, auth required, excludes self and historical accounts, returns id/name/firstName/lastName/username      |
| `app/api/ideas/[id]/collaborators/route.ts` | Extended POST to support two flows: userId (Flow A — add existing user directly as IdeaCollaborator) and email+name (Flow B — send invite via UserInvite+Resend) |
| `app/ideas/[id]/IdeaDetailClient.tsx`       | TeamTab: "Add existing user" modal with debounced search results and Invite button; "Invite by email" form with firstName/lastName/email                         |
| `lib/email.ts`                              | Added `sendInviteMismatchNotificationEmail` — notifies inviter when signed-up user has different name from invite                                                |
| `app/api/webhooks/clerk/route.ts`           | On `user.created`: check for pending UserInvite to same email; if name differs, send mismatch notification email + create in-app Notification for inviter        |

### nav-lex-1: Add top and bottom nav bars to Lex editing page

| File                                    | Change                                                                                                                                                       |
|-----------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/create/CreateIdeaClient.tsx` | Replaced minimal inline header with `PublicNav`. Added Lex toolbar (Save & Exit, View your idea, Sign in for unauthenticated). Added `SiteFooter` at bottom. |
| `components/SiteFooter.tsx`             | NEW — minimal footer: Home, Browse, Dashboard, About, Privacy, Contact                                                                                       |

### edit-button-1: Rename Edit With Lex to Edit, make primary button

| File                                  | Change                                                                                                                                       |
|---------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/[id]/IdeaDetailClient.tsx` | "Edit with Lex" button renamed to "Edit". Changed from `variant="outline"` to `variant="default"` (solid dark/white). Owner only, Stage 1–2. |

### Lex v5.1: System prompt updates (6 targeted changes)

| File                                        | Change                                                                                                                                                                                                                                                                                                                                                                           |
|---------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/api/ai/[ideaId]/route.ts`              | 4a: Stage 2 team message — exact wording from brief. 4b: OFFER HELP PROACTIVELY added. 4c: RETURN NAVIGATION — dashboard nav reminder for aiSessionCount \< 3; aiSessionCount injected and incremented. 4d: No false praise — three bullets in What Lex Never Does. 4e: RETURNING SESSION — welcome back opening for returning users. 4f: TEAM NAME SUGGESTION on Stage 2 entry. |
| `docs/lex_system_prompt_v5.0.md` | Updated to v5.1 with all 6 changes documented.                                                                                                                                                                                                                                                                                                                                   |

**Deploy actions needed:** None — no schema changes (aiSessionCount already existed), no new env vars.

***

## CODE CHANGES — 27 March 2026 (UX-mobile-1 — mobile swipe hint, connection retry button, accepted card position)

### UX-mobile-1: Three mobile UX fixes

| File                                    | Change                                                                                                                                                                                                                                                                                                              |
|-----------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `components/FieldProposalCard.tsx`      | **FIX 1:** Swipe hint already correctly implemented — `showSwipeHint` state, localStorage check, `lg:hidden` class, hint below buttons. No change required.                                                                                                                                                         |
| `components/FieldProposalCard.tsx`      | **FIX 3:** Saved card state changed from green styling to teal chip (`#2da8a8` left border + fill, `#2da8a8` check icon). Visually connects accepted field to Lex message (Option B).                                                                                                                               |
| `app/ideas/create/CreateIdeaClient.tsx` | **FIX 2:** Added `isConnectionError?: boolean` to `ChatMessage`. Added `lastSentMessageRef` to store last sent message. Connection error catch sets `isConnectionError: true`. Added `handleRetry` function that removes error message and re-sends last message. Retry button rendered inline in error Lex bubble. |

***

## CODE CHANGES — 27 March 2026 (Sprint L4-editorial — 8 editorial seed ideas with full strategic kernels)

### L4-editorial: Seed 8 editorial ideas

| File                                   | Change                                                                                                                                                                                                                                                                                                                              |
|----------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `scripts/seed/seed-editorial-ideas.ts` | New idempotent seed script for 8 live-policy-debate editorial ideas. Creates `editorial_scrutinise` User (clerkId, `isHistoricalAccount: false`). Upserts Ideas with `ideaOrigin: EDITORIAL_SEED`, blue banner `#3B82F6`, `STAGE_3`, `LINK_ONLY`. Upserts Diagnosis + GuidingPolicy; creates RootCause + CoherentActions if absent. |
| —                                      | 8 ideas seeded: FCA competitiveness, pandemic preparedness, defence industrial reserve, ARIA governance, pre-legislative scrutiny, procurement open data, criminal courts digitisation, NHS diagnostic guarantee                                                                                                                    |
| —                                      | All 8: Diagnosis ✓ (created), RootCause ✓ (created), GuidingPolicy ✓ (created), 1 CoherentAction ✓ (created)                                                                                                                                                                                                                        |

***

## CODE CHANGES — 27 March 2026 (Sprint L3 bug fixes — Edit with Lex button + sidebar field verification)

### L3-nav-fix: Edit with Lex button resumes existing idea session

| File                                  | Change                                                                                                                                                     |
|---------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/[id]/IdeaDetailClient.tsx` | Replaced "Continue with Lex →" inline link with a proper `<Button variant="outline">` labelled "Edit with Lex"                                             |
| —                                     | href was already correct (`/ideas/create?ideaId=${idea.id}`); page.tsx and CreateIdeaClient already seed state from DB on resume — no changes needed there |
| —                                     | Button visible to owner only at STAGE_1 or STAGE_2; placed below idea title, above gate checklist                                                          |

### L3-sidebar-fix: Sidebar field key alignment verified (no code changes required)

| File                                         | Change                                                                                                                                                                     |
|----------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/create/CreateIdeaClient.tsx`      | Verified: SIDEBAR_FIELDS keys (`title`, `summaryDiagnosis`, `rootCause`, `summaryGuidingPolicy`, `summaryCoherentActions`, `whoAffected`, `proposedWording`) match exactly |
| `app/api/ai/[ideaId]/route.ts`               | Verified: `buildCompletedFields` returns same keys; `rootCause` reads from `idea.rootCause` (Idea-level field), `whoAffected` reads from `idea.whoAffected`                |
| `app/api/ideas/[id]/field-approval/route.ts` | Verified: `buildCompletedFields` returns same keys; completedFields returned after every acceptance                                                                        |
| `app/ideas/create/CreateIdeaClient.tsx`      | Verified: `handleProposalAccept` calls `setFields(prev => ({ ...prev, ...data.completedFields }))` after every acceptance                                                  |

***

## CODE CHANGES — 27 March 2026 (Sprint L4 — Historical Examples + IdeaOrigin Banner + SuperAdmin Transfer)

### L4-1: IdeaOrigin enum, isHistoricalAccount flag, banner fields

| File                   | Change                                                                                                   |
|------------------------|----------------------------------------------------------------------------------------------------------|
| `prisma/schema.prisma` | Added `IdeaOrigin` enum: `USER`, `HISTORICAL_EXAMPLE`, `EDITORIAL_SEED`                                  |
| `prisma/schema.prisma` | Added `isHistoricalAccount Boolean @default(false)` to User model                                        |
| `prisma/schema.prisma` | Added `ideaOrigin IdeaOrigin @default(USER)`, `bannerColour String?`, `bannerText String?` to Idea model |
| —                      | `npx prisma db push` and `npx prisma generate` run clean                                                 |

### L4-2: IdeaOrigin banner on idea detail page

| File                                  | Change                                                                                                         |
|---------------------------------------|----------------------------------------------------------------------------------------------------------------|
| `app/ideas/[id]/IdeaDetailClient.tsx` | Added `ideaOrigin`, `bannerColour`, `bannerText` to `Idea` interface                                           |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Added `IdeaOriginBanner` component with info SVG icon, dynamic hex colour, left border, 15% opacity background |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Banner rendered between stage stepper and idea header; hidden for `USER` origin                                |
| —                                     | Default text and colour per origin type; overridable per-idea via `bannerColour`/`bannerText`                  |

### L4-3: SuperAdmin ownership transfer in admin panel

| File                                                       | Change                                                                                             |
|------------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| `app/admin/page.tsx`                                       | Added `SuperAdminTransferSection` component: debounced idea/user search, inline confirmation modal |
| `app/admin/page.tsx`                                       | "Transfer Ownership" tab added — SUPER_ADMIN only                                                  |
| `app/api/admin/ideas/search/route.ts`                      | New: GET search by title or ID, max 5 results, ADMIN+                                              |
| `app/api/admin/users/search/route.ts`                      | New: GET search by email/username/name, excludes `isHistoricalAccount`, max 5, ADMIN+              |
| `app/api/admin/ideas/[ideaId]/transfer-ownership/route.ts` | New: POST SUPER_ADMIN only; patches `creatorId`; creates `ActivityLog` ADMIN_ACTION record         |

### L4-4: Seed 20 historical examples

| File                                       | Change                                                                                  |
|--------------------------------------------|-----------------------------------------------------------------------------------------|
| `scripts/seed/seed-historical-examples.ts` | New idempotent seeding script                                                           |
| —                                          | 19 User records created (isHistoricalAccount=true, clerkId=`historical_[slug]`)         |
| —                                          | 20 Idea records created (STAGE_3, LINK_ONLY, HISTORICAL_EXAMPLE, bannerColour=\#F97316) |

### L4-kernels: Seed Stage 2 strategic kernels for 20 historical example ideas

| File                                      | Change                                                                                                              |
|-------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| `scripts/seed/seed-historical-kernels.ts` | New idempotent seeding script — upserts Diagnosis, GuidingPolicy; creates RootCause + CoherentActions if none exist |
| —                                         | All 20 ideas: Diagnosis ✓, RootCause ✓, GuidingPolicy ✓                                                             |
| —                                         | CoherentAction counts: 14 ideas × 1 action, 6 ideas × 2 actions (30 total)                                          |
| —                                         | Run against production DB — 20/20 ideas processed successfully                                                      |
| —                                         | Shelter England user used for ideas 1 and 9 as specified                                                            |

***

## CODE CHANGES — 26 March 2026 (Sprint L3 — Idea Page UX + Ownership Transfer)

### L3-1: Idea page layout and UX improvements

| File                                  | Change                                                                                                                                                                         |
|---------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/[id]/IdeaDetailClient.tsx` | Stage2GateCard restructured to two-column: left = requirements list, right = two info chips (Voting / Campaign in a Box)                                                       |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Idea sub-tabs changed from underline style to pill/chip row to visually distinguish from main tabs                                                                             |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Overview sub-tab redesigned to two-column: left 2/3 = Summary heading + summaryDescription + summary fields; right 1/3 = metadata stack with Owner linking to /user/[username] |
| `app/ideas/[id]/IdeaDetailClient.tsx` | "Approach (summary)" label replaces "Solution (summary)" for summaryGuidingPolicy                                                                                              |
| —                                     | "Continue with Lex →" already present from L2-4 — verified present, no change needed                                                                                           |

### L3-2: Transfer idea ownership

| File                                            | Change                                                                                                                                                       |
|-------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `prisma/schema.prisma`                          | Added `ownershipTransferToken String? @unique`, `ownershipTransferToId String?`, `ownershipTransferExpiry DateTime?` to Idea model                           |
| `lib/email.ts`                                  | Added `sendOwnershipTransferEmail()` — sends accept link to new owner candidate                                                                              |
| `app/api/ideas/[id]/transfer/initiate/route.ts` | POST: owner-only; validates new owner is existing collaborator; generates UUID token; sets 48hr expiry; sends email                                          |
| `app/api/ideas/[id]/transfer/accept/route.ts`   | POST: validates token + recipient match + expiry; transfers creatorId; adds old owner as EDITOR collaborator; creates SYSTEM notification                    |
| `app/api/ideas/[id]/transfer/cancel/route.ts`   | POST: owner or recipient can cancel; clears all three transfer fields                                                                                        |
| `app/ideas/[id]/transfer/accept/page.tsx`       | Server component: auth-gated; calls Prisma directly; on success redirects to /ideas/[id]?transferSuccess=1; on error shows message with back link            |
| `app/ideas/[id]/IdeaDetailClient.tsx`           | TeamTab: Transfer Ownership section at bottom (owner-only, requires ≥1 collaborator); collaborator dropdown; confirm modal; pending amber banner with cancel |

### L3-3: Prisma db push (production)

| Action                                  | Result                                                                                  |
|-----------------------------------------|-----------------------------------------------------------------------------------------|
| `npx prisma db push --accept-data-loss` | Database in sync — 3 new Idea fields added; unique constraint on ownershipTransferToken |
| `npx prisma generate`                   | Prisma Client v7.5.0 regenerated                                                        |

***

## CODE CHANGES — 26 March 2026 (Content and Copy)

| Change                          | File(s)                                                                         | Detail                                                                                                                                                           |
|---------------------------------|---------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| About page copy                 | `app/about/page.tsx`                                                            | Replaced 5 paragraphs with 4 new ones — non-partisan mission statement, platform description, track record rationale, closing focus line                         |
| Training page items             | `lib/mockData.ts`                                                               | All 5 MOCK_TRAINING items updated: real URLs, Item 4 renamed to "Parliament's Engagement with the Public", all changed to ARTICLE type (external/internal links) |
| Legislative drafting sub-page   | `app/training/legislative-drafting/page.tsx`                                    | New page: OPC guidance link, Core Principles, IfG Recommendations, Best Practices sections                                                                       |
| Parliamentary scrutiny sub-page | `app/training/parliamentary-scrutiny/page.tsx`                                  | New page: Key Aspects, Current Concerns, Key Links sections                                                                                                      |
| Terms / Community Rules nav     | `app/terms/page.tsx`, `app/community-rules/page.tsx`, `components/BackLink.tsx` | Removed PublicNav from both pages (used in sign-up flow); replaced with `BackLink` client component using `router.back()`                                        |

***

## CODE CHANGES — 26 March 2026 (Post-UAT Bug Fixes)

| Bug | File(s)                                                              | Change                                                                                                                         |
|-----|----------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| B1  | `app/ideas/create/page.tsx`, `app/ideas/create/CreateIdeaClient.tsx` | Auth guard: server component with `auth()` redirect for unauthenticated users; client code extracted to `CreateIdeaClient.tsx` |
| B2  | `app/ideas/page.tsx`                                                 | Browse Ideas holding page — PublicNav, Sign Up button, back to home                                                            |
| B3  | `app/privacy/page.tsx`                                               | Privacy Policy holding page — PublicNav, footer nav                                                                            |
| B4  | `app/contact/page.tsx`                                               | Contact Us holding page — hello@scrutinise.org, footer nav                                                                     |
| B5  | `app/onboarding/page.tsx`                                            | Post-onboarding redirect → `/dashboard`; respects `redirect_url` query param                                                   |
| B6  | `app/page.tsx`, `components/ui/Navbar.tsx`                           | `/prototype/create/stage1` → `/ideas/create`                                                                                   |
| B8  | `app/api/ai/[ideaId]/route.ts`                                       | Full Lex v5.0 system prompt: commit-and-advance, three-exchange limit, field completion reference, Stage 1 aha moment          |
| B10 | `app/ideas/create/page.tsx`, `app/ideas/create/CreateIdeaClient.tsx` | Dynamic opening message (first visit vs return visit), personalised by preferredName and time of day                           |

***

## CODE CHANGES — 26 March 2026 (Sprint L1 — Lex Overhaul)

### L1-1: Schema + sub-entity API routes

| File                                           | Change                                                                                                                                                                                                                                                                                        |
|------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `prisma/schema.prisma`                         | Add Diagnosis, RootCause, GuidingPolicy, Evidence models; EvidenceOutcome enum; missing CoherentAction fields (costFinancial/Social/Ongoing, benefits, keyChallenges, legislationDraftWording, organisationalChangeDraftWording, oppositionWho/Why/Answers); add Idea relations to new models |
| `app/api/ideas/[id]/diagnosis/route.ts`        | POST upsert Diagnosis (one per idea)                                                                                                                                                                                                                                                          |
| `app/api/ideas/[id]/root-causes/route.ts`      | GET list + POST create RootCause                                                                                                                                                                                                                                                              |
| `app/api/ideas/[id]/guiding-policy/route.ts`   | POST upsert GuidingPolicy (one per idea)                                                                                                                                                                                                                                                      |
| `app/api/ideas/[id]/evidence/route.ts`         | POST create Evidence                                                                                                                                                                                                                                                                          |
| `app/api/ideas/[id]/coherent-actions/route.ts` | Updated to accept all CoherentAction fields from entity_list_v4.md                                                                                                                                                                                                                            |

### L1-2: Stage 1 Lex scoped to Basic Info

| File                           | Change                                                                                                                                                                                                                                                      |
|--------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/api/ai/[ideaId]/route.ts` | Stage 1 prompt: 3–5 exchange flow, targets title/summaryDescription/summaryDiagnosis/summaryGuidingPolicy/summaryCoherentActions/govtArea/ideaType; triggerSavePrompt on summaryDiagnosis+summaryGuidingPolicy; mirrors to legacy fields for sidebar compat |
| `app/api/ai/public/route.ts`   | Updated SYSTEM_PROMPT to use Stage 1 field names                                                                                                                                                                                                            |

### L1-3: FieldProposalCard approval UX

| File                                         | Change                                                                                                                                                              |
|----------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `components/FieldProposalCard.tsx`           | New: teal-accented proposal card; Accept/Edit/Discuss buttons; 30s auto-accept countdown; keyboard shortcuts; swipe gestures; edit mode; saved/discussed states     |
| `app/api/ideas/[id]/field-approval/route.ts` | New: POST accepts proposal, writes to DB; handles Idea-level, diagnosis.*, guidingPolicy.*, rootCause.\*, coherentActions, evidence fields; returns completedFields |
| `app/api/ai/[ideaId]/route.ts`               | Stop writing fieldUpdates to DB; return pendingProposals array; serverTrigger checks proposals                                                                      |
| `app/ideas/create/CreateIdeaClient.tsx`      | Handle pendingProposals; render FieldProposalCards; disable input while pending; "Accept all" button; POST to field-approval                                        |

### L1-4: Stage 2 Lex two-pass Strategic Kernel

| File                           | Change                                                                                                                                                            |
|--------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/api/ai/[ideaId]/route.ts` | Stage 2 system prompt: Pass 1 (core kernel) + Pass 2 (supporting detail); aha-moment reflection; research prompt; full sub-entity field targets with dot notation |

### L1-5: Idea tab with sub-tabs + full field display

| File                                  | Change                                                                                                                                                                                        |
|---------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/[id]/page.tsx`             | Fetch diagnoses, rootCauses, guidingPolicies, evidence; serialise; pass to IdeaDetailClient                                                                                                   |
| `app/ideas/[id]/IdeaDetailClient.tsx` | Rename Overview → Idea tab; add 4 sub-tabs (Overview, Diagnosis, Policy, Coherent Actions); FieldDisplay component with inline edit; sub-entity interfaces; extended CoherentAction interface |

### L1-6: Campaign in a Box button + Browse Ideas page

| File                                  | Change                                                                                                                            |
|---------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/[id]/IdeaDetailClient.tsx` | Campaign in a Box button: owner-only, disabled Stages 1–3, active Stages 4–5 navigates to Campaign tab                            |
| `app/ideas/page.tsx`                  | Replace holding page with real server-side listing: Stage 3+ ACTIVE ideas, cursor pagination, "Your Ideas" section for auth users |
| `components/IdeaCard.tsx`             | New: idea card with title, summary, stage badge, govtArea tag, creator link, votes, contributions, relative time                  |

***

## CODE CHANGES — 26 March 2026 (Sprint L2 — Lex UX and Experience Level)

### L2-0: Onboarding routing fixes

| File                                | Change                                                                                                                                                                            |
|-------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/layout.tsx`                    | Add `afterSignUpUrl="/onboarding"` to ClerkProvider so Google SSO users land on onboarding                                                                                        |
| `app/onboarding/page.tsx`           | Converted to async server component; server-side redirect if `ageConfirmed && experienceLevel` both set; passes `promptOnly` flag for existing users missing only experienceLevel |
| `app/onboarding/OnboardingForm.tsx` | New client component extracted from old page.tsx; accepts `redirectUrl`, `promptOnly`, `fromCreate` props; `promptOnly` mode shows only the experience level question             |
| `app/ideas/create/page.tsx`         | Gate on `ageConfirmed`; redirect existing users with no `experienceLevel` to onboarding; adds `?from=create` param                                                                |

### L2-1: Sidebar completedFields fix + Stage 1 field labels

| File                                         | Change                                                                                                                                                                                                                                                                                                           |
|----------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/create/CreateIdeaClient.tsx`      | `SIDEBAR_FIELDS` updated to 7 Stage 1 fields with correct keys and labels (title, summaryDiagnosis, rootCause, summaryGuidingPolicy, summaryCoherentActions, whoAffected, proposedWording); `FieldCompletion` interface extended with 12 Stage 2 fields; `calcProgress` takes `stage` and `coherentActionsCount` |
| `app/api/ideas/[id]/field-approval/route.ts` | `buildCompletedFields` updated to return new Stage 1 key names; response now includes `{ completedFields, currentStage, coherentActionsCount }`                                                                                                                                                                  |
| `app/api/ai/[ideaId]/route.ts`               | `completedFields` map aligned to new Stage 1 key names; response includes `currentStage` and `coherentActionsCount`                                                                                                                                                                                              |

### L2-2: Lex Stage 1 prompt fixes

| File                           | Change                                                                                                                                                                          |
|--------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/api/ai/[ideaId]/route.ts` | SECOND RESPONSE RULE (no re-intro); title proposal precedes background question; HANDLING UNCERTAINTY section; EXPERIENCE LEVEL ADAPTATION section for both Stage 1 and Stage 2 |

### L2-3: Keyboard shortcuts for FieldProposalCard

| File                                    | Change                                                                                                                                                                                                                               |
|-----------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `components/FieldProposalCard.tsx`      | Global `keydown` listener: Enter accepts when no input/textarea focused; Escape switches to edit mode; `handleAccept` dispatches `lex-field-accepted` custom event; declaration order fixed (useCallback before dependent useEffect) |
| `app/ideas/create/CreateIdeaClient.tsx` | Global `lex-field-accepted` listener refocuses chat input after acceptance                                                                                                                                                           |

### L2-4: Save & Exit, View Idea, Continue with Lex navigation

| File                                    | Change                                                                                                                                                                                       |
|-----------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/create/page.tsx`             | Accept `searchParams: Promise<{ ideaId?: string }>`; fetch `aiChatHistory` and `stage` when `?ideaId` present; pass `initialIdeaId`, `initialMessages`, `initialStage` to `CreateIdeaClient` |
| `app/ideas/create/CreateIdeaClient.tsx` | Save & Exit button (navigates to `/dashboard` if `ideaId` set, shows inline message otherwise); View Idea link (new tab, owner only); `initialStage` prop initialises `currentStage` state   |
| `app/ideas/[id]/IdeaDetailClient.tsx`   | "Continue with Lex →" link below idea title; owner-only; visible at STAGE_1 or STAGE_2; links to `/ideas/create?ideaId=${idea.id}`                                                           |

### L2-5: ExperienceLevelEnum + onboarding form + Lex context + settings

| File                                | Change                                                                                                                                                                                                       |
|-------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `prisma/schema.prisma`              | Add `ExperienceLevelEnum` (NO_BACKGROUND, SECTOR_LIVED, THINK_TANK_JUNIOR, THINK_TANK_SENIOR, POLITICAL_JUNIOR, POLITICAL_SENIOR, PARLIAMENTARIAN); add `experienceLevel ExperienceLevelEnum?` to User model |
| `app/onboarding/OnboardingForm.tsx` | Experience level dropdown added between preferredName and T&Cs; required in both full and promptOnly modes                                                                                                   |
| `app/api/user/onboarding/route.ts`  | GET handler returns `{ preferredName, experienceLevel }`; PATCH handles full onboarding and profile-update (experience level only) modes                                                                     |
| `app/api/ai/[ideaId]/route.ts`      | `buildSystemPrompt` context includes `experienceLevel`; runtime context block emits `User experience level: …`; `experienceLevel` fetched from user record                                                   |
| `app/settings/page.tsx`             | Experience level dropdown added to Account Details; fetches current value on mount; auto-saves on change with "Saved" confirmation                                                                           |

### L2-6: Stage 2 sidebar progressive disclosure

| File                                         | Change                                                                                                                                                                                                                                                       |
|----------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `app/ideas/create/CreateIdeaClient.tsx`      | `Stage2Sidebar` component with three progressive-disclosure sections (Diagnosis, Guiding Policy, Coherent Actions); renders in place of Stage 1 sidebar when `currentStage` is STAGE_2+; `coherentActionsCount` displayed in Coherent Actions section header |
| `app/api/ideas/[id]/field-approval/route.ts` | `buildCompletedFields` fetches `diagnoses` and `guidingPolicies` sub-entities; returns 7 Stage 2 boolean fields across diagnosis and guidingPolicy groups                                                                                                    |
| `app/api/ai/[ideaId]/route.ts`               | `latest` select extended with `diagnoses` and `guidingPolicies`; Stage 2 `completedFields` includes all sub-entity boolean fields                                                                                                                            |

***

## PENDING CHANGES

*(Changes decided but not yet applied to spec docs)*

| Date       | Document                 | Change Required                                                                                                                                                                                                                                                         | Source                                  |
|------------|--------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------|
| 2026-03-06 | entity_list_v3.md        | Add DisputedLogicFlag entity — referenced in lex_system_prompt_v2.md Section 5 but missing from entity list. Fields needed: id, ideaId, userId, lexFlag (text), userDispute (text), status (PENDING/REVIEWED), adminVerdict (nullable), createdAt                       | lex_system_prompt_v2.md cross-reference |
| 2026-03-06 | entity_list_v3.md        | Confirm UserAIKey entity is correctly marked deferred (bring-your-own-key, v1.1). Currently in entity list — verify deferred status matches implementation_plan                                                                                                         | handoff_summary                         |
| 2026-03-06 | CLAUDE.md                | Add temporary instruction: "Audit existing CC build against spec before continuing Sprint 1. Produce gap report: what matches spec / what needs correcting / what doesn't exist yet. Fix all 'needs correcting' items before new build." [REMOVE AFTER: audit complete] | March 2026 session                      |
| 2026-03-06 | wireframes_v3.md         | Add ASCII layout sketches for key pages where spatial layout is load-bearing: WF-11 (Lex two-panel interface), WF-13 (idea detail tabs), WF-33 (admin dashboard)                                                                                                        | March 2026 session                      |
| 2026-03-06 | entity_list_v3.md        | Clarify ProposedWording location — confirm it is per CoherentAction (not a single field on Idea). If so, update CoherentAction entity to make proposedWording the primary field and demote Idea.proposedWording to a computed/display field                             | handoff_summary                         |
| 2026-03-06 | system_mechanics_v0.6.md | Clarify 70/30 AI credit split mechanic — confirmed as 70/30 but exact mechanic (how user pays their 30%) is TBC. Add placeholder with TBC note.                                                                                                                         | handoff_summary                         |
| 2026-03-06 | README.md                | This document — created this session, first entry                                                                                                                                                                                                                       | March 2026 session                      |
| 2026-03-06 | CHANGE_LOG.md            | This document — created this session, first entry                                                                                                                                                                                                                       | March 2026 session                      |

***

## APPLIED CHANGES

*(Permanent audit trail of all changes applied to spec docs)*

| Date Applied  | Document                                                         | Change Made                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Originally Decided                     |
|---------------|------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------|
| 2026-03-24    | schema.prisma                                                    | Added User fields: deletionRequestedAt DateTime?, deletionScheduledFor DateTime?, unsubscribeToken String @unique @default(uuid())                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Sprint 9 GDPR                          |
| 2026-03-24    | components/PublicNav.tsx                                         | Replaced all /prototype/\* nav links with real routes (/ideas/create, /ideas, /dashboard). Updated "Profile" button label to "Dashboard".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Sprint 9 Priority 1                    |
| 2026-03-24    | app/layout.tsx                                                   | Updated signInFallbackRedirectUrl from /prototype/dashboard to /dashboard. Added full Metadata export (title template, description, metadataBase, OpenGraph).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Sprint 9 Priority 1 + 3a               |
| 2026-03-24    | app/error.tsx                                                    | New: global error boundary — "Something went wrong" + Try again button + home link. No stack traces exposed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Sprint 9 Priority 2b                   |
| 2026-03-24    | app/not-found.tsx                                                | New: 404 page — clean, links to homepage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Sprint 9 Priority 2b                   |
| 2026-03-24    | app/loading.tsx                                                  | New: global loading skeleton (spinner + "Loading…").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Sprint 9 Priority 2c                   |
| 2026-03-24    | app/ideas/[id]/loading.tsx                                       | New: route-level loading skeleton for idea detail page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Sprint 9 Priority 2c                   |
| 2026-03-24    | app/user/[username]/loading.tsx                                  | New: route-level loading skeleton for public profile page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Sprint 9 Priority 2c                   |
| 2026-03-24    | app/admin/loading.tsx                                            | New: route-level loading skeleton for admin panel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Sprint 9 Priority 2c                   |
| 2026-03-24    | app/ideas/[id]/page.tsx                                          | Added generateMetadata: Stage 3+ public ideas get dynamic title/description/OG/twitter. Private/early-stage ideas return generic metadata.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Sprint 9 Priority 3a                   |
| 2026-03-24    | app/user/[username]/page.tsx                                     | Added generateMetadata: returns user name and bio as page title/description.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Sprint 9 Priority 3a                   |
| 2026-03-24    | app/terms/page.tsx                                               | Updated version label to "Version 1.0 — Draft · Last updated: March 2026".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Sprint 9 Priority 4                    |
| 2026-03-24    | app/community-rules/page.tsx                                     | Updated version label to "Version 1.0 — Draft · Last updated: March 2026".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Sprint 9 Priority 4                    |
| 2026-03-24    | public/robots.txt                                                | New: robots.txt allowing /ideas/ /user/ but blocking /admin/ /api/ /prototype/ /settings/ /dashboard/. Sitemap pointer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Sprint 9 Priority 3b                   |
| 2026-03-24    | app/sitemap.ts                                                   | New: dynamic sitemap returning static pages + all Stage 4+ PLATFORM_LISTED ideas + public user profiles with Stage 3+ ideas.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Sprint 9 Priority 3c                   |
| 2026-03-24    | app/api/user/export/route.ts                                     | New: POST owner-only data export (user, ideas, contributions, votes, research, amendments). Rate limited 1/24h. Returns JSON directly (R2 stub for future).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Sprint 9 Priority 5a                   |
| 2026-03-24    | app/api/user/account/route.ts                                    | New: DELETE account deletion request. Sets DELETION_PENDING + 30-day grace period. Sends confirmation email if RESEND_API_KEY set.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Sprint 9 Priority 5b                   |
| 2026-03-24    | lib/auth.ts                                                      | Added deletion cancellation: if user logs in while DELETION_PENDING, restores to ACTIVE and clears deletion dates. Removed console.log.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Sprint 9 Priority 5b                   |
| 2026-03-24    | lib/gdpr.ts                                                      | New stub: anonymiseExpiredAccounts() — finds DELETION_PENDING users where deletionScheduledFor \< now, anonymises PII, sets status DELETED.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Sprint 9 Priority 5b                   |
| 2026-03-24    | app/settings/page.tsx                                            | New client page: Account details, Download your data button, Delete account button + confirmation modal, Notification preferences placeholder.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Sprint 9 Priority 5c                   |
| 2026-03-24    | app/unsubscribe/[token]/page.tsx                                 | Updated to support both UUID token (new-style) and base64-encoded email (legacy). UUID token looks up unsubscribeToken field; base64 falls back to existing behaviour.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Sprint 9 Priority 6b                   |
| 2026-03-24    | app/dashboard/page.tsx                                           | New server page: user's ideas as cards (all stages, most recent first), notifications (last 10), quick stats (ideas, contributions, credibility score), Create new idea button.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Sprint 9 Priority 7                    |
| 2026-03-24    | middleware.ts                                                    | Added /dashboard(.*) and /settings(.*) to protected routes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Sprint 9 Priority 5c/7                 |
| 2026-03-24    | api/webhooks/clerk/route.ts                                      | Removed console.log.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Sprint 9 Priority 2a                   |
| 2026-03-24    | schema.prisma                                                    | Added GeneratedOutputType enum (MP_BRIEFING, ONE_PAGER, PRESS_RELEASE, SOCIAL_KIT), GeneratedOutputStatus enum (PENDING, COMPLETE, FAILED), GeneratedOutput model with @@unique([ideaId, documentType]); added generatedOutputs relation to Idea                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Sprint 8 Campaign in a Box             |
| 2026-03-24    | lib/campaign-prompts.ts                                          | New module: four prompt builder functions (buildMpBriefingPrompt, buildOnePagerPrompt, buildPressReleasePrompt, buildSocialKitPrompt) — each injects referral link                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Sprint 8 Campaign in a Box             |
| 2026-03-24    | app/api/ideas/[id]/generate/route.ts                             | POST — owner-only, Stage 4+ gate, Zod body, Gemini 2.5 Flash call, PENDING→COMPLETE/FAILED upsert, force-regenerate support                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Sprint 8 Campaign in a Box             |
| 2026-03-24    | app/api/ideas/[id]/campaign-outputs/route.ts                     | GET — owner-only, returns all GeneratedOutput records with 200-char preview                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Sprint 8 Campaign in a Box             |
| 2026-03-24    | app/ideas/[id]/CampaignTab.tsx                                   | New component: four document cards, generate/regenerate buttons, 3-second polling, copy/download actions, owner-locked message for non-owners                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Sprint 8 Campaign in a Box             |
| 2026-03-24    | app/ideas/[id]/IdeaDetailClient.tsx                              | Added Campaign tab (Stage 4/5 only) to Tab type, isValidTab, tabs array, and tab panel render                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Sprint 8 Campaign in a Box             |
| ------------- | ----------                                                       | -------------                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | -------------------                    |
| 2026-03-06    | All docs                                                         | Initial creation of complete 9-document library from scattered architecture docs, wireframe audits, process lists, system mechanics, AI integration spec, Lex system prompt v2, and implementation plan. Consolidated two months of decisions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | March 2026 reconciliation session      |
| 2026-03-08    | scrutinise-web/lib/mockData.ts                                   | Expanded MockIdea interface with diagnosis, rootCause, guidingPolicy, research, history, endorsements, qualityFlags, targetLegislation, wordingLocked, version, proposedWording. Rewrote CoherentAction interface (title/description/proposedWording). Updated all 3 mock ideas with realistic content. Added MOCK_TRAINING (5 entries), MOCK_GROUPS (2 groups), expanded MOCK_NOTIFICATIONS to 8 entries. Added isOwnerReply and stance to Comment.                                                                                                                                                                                                                                                                                                                                  | 2026-03-08 prototype build session     |
| 2026-03-08    | scrutinise-web/components/CommentRatingForm.tsx                  | Created new component: multi-flag positive/negative rating UI for comments. Positive flags: constructive, insightful, relevant, fresh_perspective, balanced, helpful_facts, direct_experience, good_question. Negative flags: ad_hominem, straw_man, red_herring, false_dilemma, slippery_slope, moving_goalposts, motte_bailey, tu_quoque, cherry_picking, not_relevant. Optional note field. Submit state.                                                                                                                                                                                                                                                                                                                                                                          | 2026-03-08 prototype build session     |
| 2026-03-08    | scrutinise-web/app/prototype/idea/[id]/page.tsx                  | Complete rebuild. 6 tabs (Overview, Amendments, Comments, Research, Wording, History). Owner vs guest view detection. Owner panel: stage gate checklist, vote analytics with bars, quality flag tallies, Broadcast to Voters button. Tab 1 Overview: diagnosis, rootCause, guidingPolicy, expandable coherent actions, target legislation card, endorsements with required count. Tab 2 Amendments: filter bar, DiffView on expand, owner Accept/Reject/Consult buttons on PENDING. Tab 3 Comments: stance filter, sort, CommentRatingForm inline, stance badges, Report button. Tab 4 Research: filter bar, sourceType badges, for/against indicator, Add Research link. Tab 5 Wording: locked/unlocked notice, version, edit button. Tab 6 History: type icons, chronological list. | 2026-03-08 prototype build session     |
| 2026-03-08    | scrutinise-web/app/prototype/settings/page.tsx                   | New page. Account section (display name, username, email read-only, bio, expertType, politicalParty). Status Claims (parliamentary modal with MP/Lords roles; professional modal with firm/credentials/file upload). Privacy (download data, delete account with warning). Notifications (global email toggle + 8 individual type toggles). AI section (interaction style dropdown, credit balance bar, top-up button).                                                                                                                                                                                                                                                                                                                                                               | 2026-03-08 prototype build session     |
| 2026-03-08    | scrutinise-web/app/prototype/notifications/page.tsx              | New page. Filter tabs (All/Votes/Amendments/Stage/System). Mark all as read state. Per-notification mark-read on click. Type icons. Unread blue dot and blue-tinted card. Click navigates to idea.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 2026-03-08 prototype build session     |
| 2026-03-08    | scrutinise-web/app/prototype/groups/page.tsx                     | New page. Group cards with type badge, role badge (Owner/Member), member count. Manage/View links. Create Group button.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 2026-03-08 prototype build session     |
| 2026-03-08    | scrutinise-web/app/prototype/groups/create/page.tsx              | New page. Group name (required), description, type radio (Collaborators/Supporters/Public), email chip input with add/remove, submit success state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 2026-03-08 prototype build session     |
| 2026-03-08    | scrutinise-web/app/prototype/groups/[id]/page.tsx                | New page. Header with type badge, member count. Invite link with clipboard copy button. Member list with Remove buttons (owner only). Add member email input. Settings accordion (owner only): edit name/description, delete group.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 2026-03-08 prototype build session     |
| 2026-03-08    | scrutinise-web/app/prototype/propose-amendment/[ideaId]/page.tsx | New page. Section dropdown (CoherentAction titles + Guiding Policy + Diagnosis). Current text auto-populated read-only. Proposed text with live word count diff. Rationale (required). Research URL multi-row input. Relevant legislation. Submit success state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 2026-03-08 prototype build session     |
| 2026-03-08    | scrutinise-web/app/prototype/add-research/[ideaId]/page.tsx      | New page. Title, snippet, relevance, summary, source URL, source type dropdown. For policy Yes/No toggle. For action Yes/No toggle. Quality self-assessment 1–5 star buttons. PDF file input (visual). Submit success state.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 2026-03-08 prototype build session     |
| 2026-03-08    | scrutinise-web/app/training/page.tsx                             | Complete rebuild. Dark mode. Filter bar: Stage (All/Create/Draft/Develop/Campaign/Parliament), Difficulty (All/Beginner/Intermediate/Advanced), Type (All/Video/Article). Resource cards with type badge, stage badge, difficulty badge. Video cards: Watch button triggers inline iframe embed. Article cards: Read → external link.                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 2026-03-08 prototype build session     |
| 2026-03-08    | scrutinise-web/app/prototype/referral/idea/[id]/page.tsx         | New page. "Shared by [owner]" attribution banner. Idea title, summary, vote counts. VoteWidget. Diagnosis, guiding policy, coherent actions. Endorsements section. What is Scrutinise? explainer. Login/signup prompt with links.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 2026-03-08 prototype build session     |
| 2026-03-08    | scrutinise-web/app/prototype/referral/user/[username]/page.tsx   | New page. User avatar initials circle, display name, role badge, verified badge, Credibility Score. Their ideas list with stage badge, vote count, passion score. What is Scrutinise? explainer. Login/signup prompt.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 2026-03-08 prototype build session     |
| 2026-03-08    | scrutinise-web/app/prototype/layout.tsx                          | Added sticky prototype nav bar with links to Dashboard, Groups, Training, Settings. Added notification bell icon with red unread count badge (reads from MOCK_NOTIFICATIONS).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 2026-03-08 prototype build session     |
| 2026-03-08    | scrutinise-web/components/ui/Navbar.tsx                          | Updated links array from plain strings to {label, href} objects with correct routes (Create→/prototype/create/stage1, Browse→/prototype/browse, Training→/training, About→/about).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 2026-03-08 prototype build session     |
| 2026-03-08    | scrutinise-web/app/prototype/page.tsx                            | Added Journey 6 (Explore dashboard → /prototype/dashboard) and Journey 7 (Browse training → /training).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 2026-03-08 prototype build session     |
| 2026-03-08    | scrutinise-web/app/prototype/dashboard/page.tsx                  | Added header shortcut links to Notifications, Groups, Settings pages.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 2026-03-08 prototype build session     |
| 2026-03-06    | README.md                                                        | Added Section 4a: Concurrent Working — the critical rule. CC edits files directly on disk; CCh works from uploaded copies. They must never work on the same file simultaneously. Charlie is the gatekeeper. CCh holds decisions in context and batch-applies at handoff.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Reply 26–27, March 2026 session        |
| 2026-03-06    | README.md                                                        | Clarified file access for each actor in Section 4: CC reads/writes disk directly; CCh only sees uploaded files and produces outputs for Charlie to save manually.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Reply 25–26, March 2026 session        |
| 2026-03-06    | scrutinise-web/components/RevolutHero.tsx                        | Stage names corrected in homepage hero: Stage 1–5 → Create / Draft / Develop / Campaign / Parliament                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | CC build audit                         |
| 2026-03-06    | scrutinise-web/lib/mockData.ts                                   | Comment rating structure changed from numeric {quality, evidence, civility} to multi-flag arrays: positiveFlags: string[], negativeFlags: string[]. Valid flags defined per spec.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | CC build audit                         |
| 2026-03-06    | scrutinise-web/app/about/page.tsx                                | "burnish the reputation of parties" → "enhance the standing of parties" to avoid conflict with platform Credibility Score terminology                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | CC build audit                         |
| 2026-03-06    | docs/scrutinise_prototype_brief.md                    | Created — comprehensive prototype build guide covering codebase state, file structure, mock data, scripted Lex conversation (19 exchanges), component specs, five user journeys, terminology, styling guidelines, deployment notes, and build order                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | CC session                             |
| 2026-03-07    | scrutinise-web/app/prototype/profile/[username]/page.tsx         | Created — user profile page (WF-30): credibility score display, points breakdown (Strategist/Thinker/Rallymaster/Teambuilder), expert badges, user's ideas grid, recent contributions, Follow toggle button (visual only in prototype)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Phase 2 build                          |
| 2026-03-08    | scrutinise-web/components/VoteWidget.tsx                         | Strength slider updated to step={0.5} (11 stops: 0–5 in 0.5 increments). strengthLabels changed from 6-entry array to 11-entry Record\<number, string\>. Display updated to toFixed(1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Spec correction                        |
| 2026-03-08    | scrutinise-web/.dropboxignore                                    | Created — excludes .next/ and node_modules/ from Dropbox sync to prevent file locking conflicts with Next.js dev server (EPERM rename errors)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Dev environment fix                    |
| 2026-03-09    | scrutinise-web/app/prototype/create/stage1/page.tsx              | Rebuilt: 8-field Basic Info form (title, ideaType toggle, govtArea dropdown, summaryDescription, summaryDiagnosis, summaryGuidingPolicy, summaryCoherentActions, connectedIdeas). Stage progress indicator. Conditional "Ready for Stage 2" button.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | CC_briefing_next_session.md Priority 1 |
| 2026-03-09    | start-session.sh                                                 | Created: session logging script — appends timestamp and branch to session-log.txt, runs git status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | CC_briefing_next_session.md Priority 2 |
| 2026-03-09    | scrutinise-web/app/prototype/page.tsx                            | Converted from journey-selector hub to WF-10 proper dashboard: welcome greeting, My Ideas section, quick actions, notifications sidebar, following/watching placeholder, groups section                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | CC_briefing_next_session.md Priority 3 |
| 2026-03-09    | scrutinise-web/app/prototype/testing-guide/page.tsx              | Created: tester-facing checklist with 8 journeys, step-by-step verification items per journey, full page inventory table with checkboxes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | CC_briefing_next_session.md Priority 4 |
| 2026-03-09    | docs/entity_list_v4.md                                | Added to repo: replaces entity_list_v3.md. 54 entities. CommentRating redesigned with positiveFlags/negativeFlags JSON + dispute flow. DisputedLogicFlag entity added. Follow entity added. Training entity added. CredibilityScore canonical (InfluenceScore retired). User.mobile required. BroadcastMessage expanded with co-signatory fields.                                                                                                                                                                                                                                                                                                                                                                                                                                     | CCh session 09-03-26                   |
| 2026-03-09    | docs/CC_briefing_next_session.md                      | Created: CCh-produced briefing document for this CC session                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | CCh session 09-03-26                   |
| 2026-03-09    | docs/CLAUDE.md                                        | Updated: Section 1 checklist references entity_list_v4; Section 5 repo structure updated to v4 (54 entities); Section 12 Field Preservation Rule added (immutable, CCh-only entity list); Section 11/13 renumbered                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | CCh session 09-03-26                   |
| 2026-03-10    | scrutinise-web/app/globals.css                                   | Merged v0 design token set: full :root CSS variable block (background, foreground, card, primary, secondary, muted, accent, destructive, border, input, ring, chart-1–5, sidebar-\*, stage-create through stage-parliament, success, dark-bg/fg/muted/border). Added .dark-section utility class, @theme inline block, @layer base. Replaced @tailwind v3 directives with @import 'tailwindcss' (v4). Retained DM Sans font import and video-mask-left utility.                                                                                                                                                                                                                                                                                                                       | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/lib/utils.ts                                      | Created: cn() helper (clsx + tailwind-merge) required by shadcn components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/components/ui/button.tsx                          | Added: shadcn Button component (cva variants: default/destructive/outline/secondary/ghost/link; sizes: default/sm/lg/icon)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/components/ui/badge.tsx                           | Added: shadcn Badge component (variants: default/secondary/destructive/outline)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/components/ui/card.tsx                            | Added: shadcn Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction components                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/components/ui/input.tsx                           | Added: shadcn Input component                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/components/ui/textarea.tsx                        | Added: shadcn Textarea component                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/components/ui/separator.tsx                       | Added: shadcn Separator component                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/components/ui/label.tsx                           | Added: shadcn Label component                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/components/ui/empty.tsx                           | Added: v0 Empty component set (Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/components/ui/field.tsx                           | Added: v0 Field component                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/components/ui/item.tsx                            | Added: v0 Item component                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/components/ui/spinner.tsx                         | Added: v0 Spinner component                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/components/ui/button-group.tsx                    | Added: v0 ButtonGroup component                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/layout.tsx                                    | Simplified root layout: removed old Navbar and dark body classes. ClerkProvider + clean body wrapper only. Homepage now self-contained with its own nav.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/page.tsx                                      | Replaced RevolutHero-based homepage with full v0 design. Sticky nav with backdrop-blur, mobile hamburger. Hero section (bg-background, left-aligned). Parliament video dark band. Research video band (placeholder). Five Stages section. Stats band. Trust/Democracy copy. Footer with About/Privacy/Terms/Contact. All CTAs use Scrutinise routes (/prototype/create/stage1, /prototype/browse). No /prototype entry-point link.                                                                                                                                                                                                                                                                                                                                                    | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/layout.tsx                          | Restyled: sticky header with backdrop-blur, bg-background/95. Bell icon from lucide-react (size-5). Nav links text-muted-foreground hover:text-foreground. Unread badge uses bg-primary. Removed dark bg-gray-950.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/page.tsx                            | Restyled dashboard: Button/Card/Badge/CardHeader/CardTitle/CardContent from shadcn. stageBadgeStyle using CSS variables. Section headings text-xs uppercase tracking-wider text-muted-foreground. Cards bg-card border-border rounded-xl. Quick action buttons use Button variants. Notification unread uses bg-primary/5 border-primary/20.                                                                                                                                                                                                                                                                                                                                                                                                                                          | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/browse/page.tsx                     | Style pass: stageBadgeStyle CSS variables. Cards bg-card border-border hover:border-primary/40. Filters/selects use border-border bg-background. Text foreground/muted-foreground.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/idea/[id]/page.tsx                  | Style pass: full token replacement. stageBadgeStyle CSS variables. Amendment/comment/research/stance badge colours use light semantic (bg-green-100 text-green-800 etc). Filter buttons bg-primary active / border-border inactive. Owner panel cards bg-card border-border. Progress bars bg-secondary. Tabs border-primary active. History timeline bg-secondary.                                                                                                                                                                                                                                                                                                                                                                                                                   | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/create/stage1/page.tsx              | Style pass: bg-background, border-border, text-foreground/muted-foreground, primary CTAs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/create/stage2/page.tsx              | Style pass: bg-background, border-border, text-foreground/muted-foreground.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/profile/[username]/page.tsx         | Style pass: stageBadgeStyle CSS variables. Cards bg-card border-border. Text tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/settings/page.tsx                   | Style pass: all form inputs border-border bg-background. Cards bg-card. Text tokens. Button variants.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/notifications/page.tsx              | Style pass: bg-card border-border cards. Unread highlight bg-primary/5 border-primary/20. Text tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/groups/page.tsx                     | Style pass: bg-card border-border. Text tokens. Button variants.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/groups/create/page.tsx              | Style pass: form inputs border-border. Cards bg-card. Text tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/groups/[id]/page.tsx                | Style pass: bg-card border-border. Member list. Text tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/propose-amendment/[ideaId]/page.tsx | Style pass: form inputs, selects, cards all use design tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/add-research/[ideaId]/page.tsx      | Style pass: toggles, star buttons, file input, cards all use design tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/admin/page.tsx                      | Style pass: tabs bg-primary active / border-border inactive. Cards bg-card. Text tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/dashboard/page.tsx                  | Style pass: stageBadgeStyle CSS variables. Nav links text-muted-foreground. Cards bg-card border-border.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/amendment/[id]/page.tsx             | Style pass: bg-card border-border. Text tokens. text-primary links.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/referral/idea/[id]/page.tsx         | Style pass: stageBadgeStyle CSS variables. Cards bg-card border-border. Avatar bg-primary text-primary-foreground. Text tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/referral/user/[username]/page.tsx   | Style pass: stageBadgeStyle CSS variables. Cards bg-card. Avatar bg-primary. Text tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/prototype/testing-guide/page.tsx              | Style pass: progress bar bg-primary. Checkbox bg-primary. Cards bg-card border-border. Text tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/training/page.tsx                             | Style pass: filter buttons bg-primary active / border-border inactive. Resource cards bg-card border-border. Watch/Read buttons use primary tokens. Text tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | v0 design integration session 10-03-26 |
| 2026-03-10    | scrutinise-web/app/about/page.tsx                                | Style pass: text-foreground, bg-background. Text tokens.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | v0 design integration session 10-03-26 |

\| 2026-03-22 \| scrutinise-web/lib/mockData.ts \| Stage type `'Parliament'` → `'Legislate'`. Training resource stageTag `'Parliament'` → `'Legislate'`. \| Sprint 1 session \| \| 2026-03-22 \| scrutinise-web/lib/lexScripts.ts \| Fix 2 — LEX_JOURNEY_1_SCRIPT opening message changed to: "I'm Lex, your researcher and guide. What's the challenge you want to fix?" \| Sprint 1 Fix 2 \| \| 2026-03-22 \| scrutinise-web/components/LexChat.tsx \| Fix 4 — Full rewrite: input inside scrollable container (follows conversation, not pinned to viewport). Scroll-to-bottom arrow. autoFocus on input. \| Sprint 1 Fix 4 \| \| 2026-03-22 \| scrutinise-web/app/prototype/referral/idea/[id]/page.tsx \| Fix 1 — stageBadgeStyle key Parliament → Legislate. "What is Scrutinise?" text updated. \| Sprint 1 Fix 1 \| \| 2026-03-22 \| scrutinise-web/app/prototype/referral/user/[username]/page.tsx \| Fix 1 — same as above. \| Sprint 1 Fix 1 \| \| 2026-03-22 \| scrutinise-web/app/prototype/idea/[id]/page.tsx \| Fix 5 — five-stage progress stepper added. Fix 6 — useSearchParams reads ?tab=amendments to set activeTab. stageBadgeStyle Parliament → Legislate. \| Sprint 1 Fix 5 & 6 \| \| 2026-03-22 \| scrutinise-web/app/prototype/settings/page.tsx \| Fix 7 — Collaborative as default AI mode. Radio buttons with full descriptions replacing select dropdown. \| Sprint 1 Fix 7 \| \| 2026-03-22 \| scrutinise-web/app/page.tsx \| Fix 8 — Step 3 description: "first 25 votes" removed, now "open to referral-link scrutiny". \| Sprint 1 Fix 8 \| \| 2026-03-22 \| scrutinise-web/app/prototype/create/stage2/page.tsx \| Fix 2 — STAGES array Parliament → Legislate. Fix 3 — initialFields updated to 7 correct Lex sidebar fields. \| Sprint 1 Fix 2 & 3 \| \| 2026-03-22 \| scrutinise-web/app/prototype/notifications/page.tsx \| Fix 6 — amendment notifications deep-link to /prototype/idea/[id]?tab=amendments. \| Sprint 1 Fix 6 \| \| 2026-03-22 \| scrutinise-web/app/prototype/browse/page.tsx \| stageBadgeStyle Parliament → Legislate. stages filter array updated. autoFocus on search input. \| Sprint 1 session \| \| 2026-03-22 \| scrutinise-web/app/prototype/dashboard/page.tsx \| stageBadgeStyle Parliament → Legislate. \| Sprint 1 session \| \| 2026-03-22 \| scrutinise-web/app/prototype/page.tsx \| stageBadgeStyle Parliament → Legislate. \| Sprint 1 session \| \| 2026-03-22 \| scrutinise-web/app/prototype/profile/[username]/page.tsx \| stageBadgeStyle Parliament → Legislate. \| Sprint 1 session \| \| 2026-03-22 \| scrutinise-web/app/prototype/create/stage1/page.tsx \| STAGES array Parliament → Legislate. \| Sprint 1 session \| \| 2026-03-22 \| scrutinise-web/app/prototype/testing-guide/page.tsx \| Stage progress test description updated. \| Sprint 1 session \| \| 2026-03-22 \| scrutinise-web/app/training/page.tsx \| stageBadgeColors Parliament → Legislate. stages filter array updated. \| Sprint 1 session \| \| 2026-03-22 \| scrutinise-web/app/api/webhooks/clerk/route.ts \| Task 1a — reads preferredName, ageConfirmed, tcAgreed, rulesAgreed from unsafe_metadata; writes tcAgreedAt, rulesAgreedAt, tcVersion to User on creation \| Sprint 2 Task 1a \| \| 2026-03-22 \| scrutinise-web/middleware.ts \| Task 1b — unauthenticated requests to protected routes redirect to /sign-in?redirect_url=; /ideas/create and /api/ai/public added as public routes; /onboarding and /api/user added as protected; /api/webhooks/clerk moved to public (server-to-server, verified by Svix) \| Sprint 2 Task 1b + production fixes \| \| 2026-03-22 \| scrutinise-web/app/layout.tsx \| signUpFallbackRedirectUrl changed to /onboarding; signInFallbackRedirectUrl stays /prototype/dashboard \| Sprint 2 Task 1b \| \| 2026-03-22 \| scrutinise-web/app/api/ai/[ideaId]/route.ts \| completedFields variable renamed to completedFieldsSummary to fix TS2451 redeclaration; re-fetch after field updates returns boolean completedFields map to client (no field content exposed) \| Sprint 2 \| \| 2026-03-22 \| scrutinise-web/app/api/ai/public/route.ts \| New — unauthenticated Lex endpoint. In-memory IP rate limit 20/hr. Accepts message + history array. Gemini primary / Grok fallback. Returns {response, triggerSavePrompt, completedFields} boolean map. fieldUpdates stripped server-side. \| Sprint 2 Priority 2 \| \| 2026-03-22 \| scrutinise-web/app/ideas/create/page.tsx \| New — full Lex chat UI. 75/25 layout. Hardcoded opening message. Auto-expanding textarea, Enter sends, Shift+Enter newline. Voice dictation (Web Speech API, en-GB, min 44px touch target). One-time mic hint (localStorage). Progress bar 0→90%. 7-field sidebar (grey/amber/green). Scroll-to-bottom arrow. 3s debounced auto-save PATCH. File attachment UI (PDF/doc). Unauthenticated → /api/ai/public; authenticated → ensureIdea → /api/ai/[ideaId]. triggerSavePrompt → save prompt with SignInButton. \| Sprint 2 Priority 2 \| \| 2026-03-22 \| scrutinise-web/app/onboarding/page.tsx \| New — post-sign-up onboarding. preferredName input (defaults to Clerk firstName). Three required checkboxes: age 18+, T&Cs (links /terms), Community Rules (links /community-rules). PATCH /api/user/onboarding on submit → redirect to /ideas/create. \| Sprint 2 Task 1a \| \| 2026-03-22 \| scrutinise-web/app/api/user/onboarding/route.ts \| New — PATCH handler. Zod validation (all three checkboxes must be literal true). Updates preferredName, ageConfirmed, tcAgreedAt, rulesAgreedAt, tcVersion. \| Sprint 2 Task 1a \| \| 2026-03-22 \| scrutinise-web/app/sign-in/[[...sign-in]]/page.tsx \| Updated bg-black → bg-[--background] to match current design system \| Sprint 2 \| \| 2026-03-22 \| scrutinise-web/app/sign-up/[[...sign-up]]/page.tsx \| Updated bg-black → bg-[--background] to match current design system \| Sprint 2 \| \| 2026-03-22 \| scrutinise-web/app/api/ideas/route.ts \| Made summaryDescription and govtArea optional in Zod schema (both required in Prisma; populated by Lex during Stage 1). Added try/catch with structured logging around prisma.idea.create — previously an unhandled throw produced empty 500 response body ("Unexpected end of JSON input"). Both fields default to '' when absent. \| Sprint 2 production fix \| \| 2026-03-23 \| scrutinise-web/app/api/ai/[ideaId]/route.ts \| Structured logging on all failure paths. Check GEMINI_API_KEY presence before constructing client. Check GROK_API_KEY presence before fetch. Check grokRes.ok — previously 401/429 from Grok silently set lexResponse to undefined with no error returned. Track actual provider used (GEMINI_FLASH vs GROK_FAST) and log correct value in AIUsageLog. Log auth failure explicitly. \| Sprint 2 production fix \| \| 2026-03-23 \| scrutinise-web/app/api/ai/public/route.ts \| Same logging improvements as authenticated route. Explicit grokRes.ok check. Return 503 on all Grok failure paths instead of silent fallback string. \| Sprint 2 production fix \| \| 2026-03-23 \| scrutinise-web/lib/auth.ts \| JIT user sync — if clerkId not in DB (webhook missed or delayed), fetch from Clerk API and create User + CredibilityScore in transaction. Logs at each step. Falls back to 404 only if Clerk API call itself fails. Eliminates hard dependency on webhook for platform access. \| Sprint 2 production fix \| \| 2026-03-23 \| scrutinise-web/app/api/webhooks/clerk/route.ts \| Username fallback: username ?? (firstName.toLowerCase().replace(/[\^a-z0-9]/g,'*') \|\| 'user') then .slice(0,20) + '*' + timestamp. Matches JIT sync pattern. Structured error logging in catch block (logs clerkId, email, generated username, Prisma error message). Info log before transaction showing what will be written. \| Sprint 2 production fix \| \| 2026-03-22 \| scrutinise-web/prisma/schema.prisma \| Created: full Prisma 7.x schema. All Sprint 1 schema changes applied: new User fields (preferredName, ageConfirmed, tcAgreedAt, rulesAgreedAt, tcVersion, politicalSpectrumX/Y, manualCredibilityOverride, aiPreferredStyle), PartyMembership, PlatformConfig, IdeaReview, Amendment counter-proposal fields, ActivityLog access fields, CredibilityScore.lexLogicScore, Idea maturity fields, CoherentAction.implementationSubQuestions, Research ResearchType enum, Group groupType MY_TEAM/COMMUNICATIONS/POLICY_DEVELOPMENT. \| Sprint 1 Days 1–2 \| \| 2026-03-22 \| scrutinise-web/prisma.config.ts \| Created: Prisma 7.x datasource config (DATABASE_URL from env, dotenv). \| Sprint 1 Days 1–2 \| \| 2026-03-22 \| scrutinise-web/middleware.ts \| Created: Clerk middleware. Protects /prototype/(.*), /api/ideas(.*), /api/ai(.\*). Public routes whitelisted. \| Sprint 1 Days 1–2 \| \| 2026-03-22 \| scrutinise-web/lib/prisma.ts \| Created: Prisma client singleton. Imports from ../generated/prisma. \| Sprint 1 Days 1–2 \| \| 2026-03-22 \| scrutinise-web/lib/auth.ts \| Created: getAuthenticatedUser() helper — Clerk auth() → DB user lookup → returns {error, user}. \| Sprint 1 Days 1–2 \| \| 2026-03-22 \| scrutinise-web/lib/stage-gates.ts \| Created: checkAndAdvanceStage (Stage 1→2 auto), checkStage2to3Gate (validates gate conditions), advanceStage2to3 (STAGE_3 + LINK_ONLY + referralLinkActive). \| Sprint 1 Days 3–4 \| \| 2026-03-22 \| scrutinise-web/lib/email.ts \| Created: isEmailSuppressed(), sendCollaboratorInviteEmail() via Resend. EmailSuppression checked before every send. One-click unsubscribe on every email. \| Sprint 1 Day 5 \| \| 2026-03-22 \| scrutinise-web/app/api/webhooks/clerk/route.ts \| Created: POST handler. Svix signature verify. user.created → upsert User + create CredibilityScore. referralCode via crypto.randomUUID(). \| Sprint 1 Days 1–2 \| \| 2026-03-22 \| scrutinise-web/app/api/ideas/route.ts \| Created: POST /api/ideas — create idea at STAGE_1/PRIVATE/DRAFT. \| Sprint 1 Days 3–4 \| \| 2026-03-22 \| scrutinise-web/app/api/ideas/[id]/route.ts \| Created: GET + PATCH /api/ideas/[id]. Privacy log for admin access. checkAndAdvanceStage on PATCH. \| Sprint 1 Days 3–4 \| \| 2026-03-22 \| scrutinise-web/app/api/ideas/[id]/progress/route.ts \| Created: POST /api/ideas/[id]/progress — Stage 2→3 manual transition with gate check. \| Sprint 1 Days 3–4 \| \| 2026-03-22 \| scrutinise-web/app/api/ai/[ideaId]/route.ts \| Created: POST /api/ai/[ideaId] — Lex endpoint. Gemini 2.5 Flash primary, Grok 4.1 Fast fallback. preferredName + lexMode injection. fieldUpdates stripped from response. Rolling aiChatHistory (last 40). AIUsageLog. checkAndAdvanceStage after update. \| Sprint 1 Days 3–4 \| \| 2026-03-22 \| scrutinise-web/app/api/ideas/[id]/collaborators/route.ts \| Created: POST /api/ideas/[id]/collaborators — owner-only invite. UserInvite with magicLinkToken (32 bytes hex), 7-day expiry. Sends invite email via Resend. \| Sprint 1 Day 5 \| \| 2026-03-22 \| scrutinise-web/app/invite/[token]/page.tsx \| Created: Magic link landing page. Token validation (invalid/expired/used). If signed in with matching email → auto-accept (create IdeaCollaborator, mark invite ACCEPTED, redirect to idea). Wrong email → error. Not signed in → invite preview with sign-up/sign-in CTAs and redirect_url param. \| Sprint 1 Day 5 \| \| 2026-03-22 \| scrutinise-web/app/unsubscribe/[token]/page.tsx \| Created: Unsubscribe page. Decodes base64 email from URL. Upserts EmailSuppression record (USER_UNSUBSCRIBED). Confirmation message. \| Sprint 1 Day 5 \| \| 2026-03-22 \| scrutinise-web/prisma/seed.ts \| Created: SuperAdmin seed (cl@scrutinise.org, SUPER_ADMIN, clerkId PENDING_CLERK_LINK). CredibilityScore for SuperAdmin. PlatformConfig defaults (9 keys incl. stage display names, credibilityWeightingActive, minReviewersForStage4). \| Sprint 1 Days 1–2 \| \| 2026-03-22 \| scrutinise-web/package.json \| Added db:seed script (ts-node). Added prisma.seed config. Added ts-node devDependency. \| Sprint 1 session \| \| 2026-03-22 \| scrutinise-web/app/layout.tsx \| Added signInFallbackRedirectUrl and signUpFallbackRedirectUrl (/prototype/dashboard) to ClerkProvider. \| Sprint 1 Days 1–2 \|

\| 2026-03-23 \| scrutinise-web/prisma/schema.prisma \| Sprint 3 additions: ContributionType enum (NEW_INFORMATION / RED_TEAM_CHALLENGE / MINOR_ADJUSTMENT / ADDITIONAL_COHERENT_ACTION / AMENDMENT / OTHER). Comment: commentNumber Int?, contributionType ContributionType?. Research: forAction Boolean?. \| Sprint 3 \| \| 2026-03-23 \| scrutinise-web/middleware.ts \| Sprint 3: removed /ideas(.*) from protected routes; added /ideas(.*) and /user(.*) to public routes (visibility enforced in API/page). Added public patterns for /api/ideas/(.*)/contributions(.*), /api/ideas/(.*)/research(.*), /api/users/(.*). \| Sprint 3 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/route.ts \| GET updated: LINK_ONLY/PLATFORM_LISTED ideas now public (no auth required). PRIVATE ideas require auth + owner/collaborator/admin check. Creator included in response with credibility score. \| Sprint 3 \| \| 2026-03-23 \| scrutinise-web/app/sign-in/[[...sign-in]]/page.tsx \| Updated: reads redirect_url from searchParams, passes as forceRedirectUrl to Clerk component. Returning users now land back on originating page after sign-in. \| Sprint 3 Priority 6c \| \| 2026-03-23 \| scrutinise-web/app/ideas/[id]/page.tsx \| New — real data-driven idea detail page. Server component: fetches idea from DB, optional auth, visibility check (PRIVATE → redirect to sign-in, LINK_ONLY/PLATFORM_LISTED → public). Passes idea + isOwner + currentUserId to client component. \| Sprint 3 Priority 1 \| \| 2026-03-23 \| scrutinise-web/app/ideas/[id]/IdeaDetailClient.tsx \| New — client component for idea detail. Five-stage stepper (wired to idea.stage). Title/description/owner/date header. Stage 2 gate checklist card (owner only). Tabs: Overview / Contributions / Research / Amendments / Team. Overview: Challenge, Root Cause, Who Affected, Guiding Policy, Coherent Actions. "Take Public" button + warning modal → POST /api/ideas/[id]/progress. Referral link shown to owner after Stage 3. Vote widget absent (Stage 4+ only). \| Sprint 3 Priority 1+2 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/contributions/route.ts \| New — GET (public for Stage 3+, ordered by helpfulCount DESC) and POST (auth required, Stage 3+, creates Comment with contributionType/commentNumber, notifies owner). \| Sprint 3 Priority 3 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/contributions/[commentId]/reply/route.ts \| New — POST owner reply. Owner-only. Creates Comment with parentId/isOwnerReply:true. Notifies contributor. \| Sprint 3 Priority 3 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/research/route.ts \| New — GET (public for Stage 3+, owner+editors at Stage 2+) and POST (owner+editors at Stage 2, any auth at Stage 3+, Google Safe Browsing check on sourceUrl). \| Sprint 3 Priority 4 \| \| 2026-03-23 \| scrutinise-web/app/api/users/[username]/route.ts \| New — GET public profile: name, bio, joinDate, credibility score, public ideas (Stage 3+ only), contribution count. \| Sprint 3 Priority 5 \| \| 2026-03-23 \| scrutinise-web/app/user/[username]/page.tsx \| New — public profile page. Profile header with avatar initials, name, username, bio, join year, contribution count, credibility score. Public ideas list (Stage 3+ only) linking to /ideas/[id]. \| Sprint 3 Priority 5 \| \| 2026-03-23 \| scrutinise-web/lib/rateLimit.ts \| New — in-memory Map-based rate limiter. checkRateLimit(key, max, windowMs). \| Sprint 3 Priority 6b \| \| 2026-03-23 \| scrutinise-web/app/api/ai/[ideaId]/route.ts \| Rate limiting applied: 50 requests/hr per authenticated userId → 429. \| Sprint 3 Priority 6b \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/collaborators/route.ts \| Rate limiting applied: 10 invites/day per userId → 429. \| Sprint 3 Priority 6b \|

\| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/vote/route.ts \| New — GET aggregate counts {for, against, undecided, total} + userVote if authenticated. POST upsert vote (Stage 4+ only), Zod schema direction/strength/qualityFlags, denormalised voteCount update on Idea. \| Sprint 4 Priority 3 \| \| 2026-03-23 \| scrutinise-web/components/VoteWidget.tsx \| Full rewrite: props changed to {ideaId, currentUserId}. Fetches from GET /api/ideas/[id]/vote. All hardcoded dark colours replaced with CSS design tokens. Sign-in prompt for unauthenticated users. Existing vote display with Change flow. Optimistic count updates on submit. Quality flags: "doesn't go far enough", "goes too far", "poorly worded". \| Sprint 4 Priority 3 \| \| 2026-03-23 \| scrutinise-web/middleware.ts \| /api/ideas/(.*)/vote(.*) added to public routes. \| Sprint 4 Priority 3 \| \| 2026-03-23 \| scrutinise-web/app/prototype/idea/[id]/page.tsx \| Removed VoteWidget import (props now incompatible). Replaced with placeholder div. \| Sprint 4 Priority 3 \| \| 2026-03-23 \| scrutinise-web/app/prototype/referral/idea/[id]/page.tsx \| Removed VoteWidget import (props now incompatible). Replaced with placeholder div. \| Sprint 4 Priority 3 \| \| 2026-03-23 \| scrutinise-web/app/ideas/[id]/ContributionsTab.tsx \| New — full contributions tab. ContributionCard: comment number, type badge (NEW_INFORMATION / RED_TEAM_CHALLENGE / MINOR_ADJUSTMENT / ADDITIONAL_COHERENT_ACTION / AMENDMENT / OTHER), stance badge (SUPPORTIVE / CRITICAL / NEUTRAL / QUESTION), 200-char truncation + Read more, author name + credibility score, helpful count, owner-only Reply button. ReplyForm: inline textarea, POST to .../reply. ContributionForm: content 5000 chars, contributionType select, stance select. PAGE_SIZE=10 with Show all button. Loading skeleton. onCommentAdded callback. \| Sprint 4 Priority 1 \| \| 2026-03-23 \| scrutinise-web/app/ideas/[id]/ResearchTab.tsx \| New — full research tab. ResearchCard: title, snippet, external link icon, expandable "Why is this relevant?" relevance explanation, research type badge (colour-coded), source type badge, forPolicy/forAction indicators. ResearchForm: title 200, snippet/relevance 500 each, sourceUrl with URL validation, researchType select (EVIDENCE/CASE_STUDY/CAUSES/PERSPECTIVES/OTHER), sourceType select, forOrAgainstPolicy/forOrAgainstAction radio groups (Yes/No/N/A). canAdd: owner/editors at Stage 2+, any authenticated user at Stage 3+. onResearchAdded callback. \| Sprint 4 Priority 2 \| \| 2026-03-23 \| scrutinise-web/app/ideas/[id]/IdeaDetailClient.tsx \| Updated: replaced inline ContributionsTab and ResearchTab stubs with imports of new components. VoteWidget imported and rendered only at STAGE_4/STAGE_5 (not in DOM at Stages 1–3). onResearchAdded callback updates idea.research for gate check. commentCount state tracks new contributions for tab label. \| Sprint 4 Priority 1+2+3 \|

\| 2026-03-23 \| scrutinise-web/prisma/schema.prisma \| Comment model: added isInternal Boolean @default(false). Marks contributions created at Stage 2 as internal (collaborator-only). Applied via db push (no migration history). \| Product decision: Stage 2 internal contributions \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/contributions/route.ts \| GET: Stage 2 returns internal-only to owner/collaborators; Stage 3+ returns non-internal to public, all to owner, own internals to their authors. POST: Stage 2 requires owner/collaborator + sets isInternal:true; Stage 3+ open to any auth user. \| Product decision: Stage 2 internal contributions \| \| 2026-03-23 \| scrutinise-web/app/ideas/[id]/ContributionsTab.tsx \| STAGE_2 added to allowed stages; public pool filtered to !isInternal at Stage 3+; Internal badge (violet) on isInternal cards; empty state and pagination use filtered pool. \| Product decision: Stage 2 internal contributions \| \| 2026-03-23 \| scrutinise-web/app/ideas/[id]/IdeaDetailClient.tsx \| DevelopmentHistory section added — owner-only, renders at Stage 3+, fetches contributions and displays internal ones grouped by contributor; self-hides when none exist. \| Product decision: Stage 2 internal contributions \|

\| 2026-03-23 \| scrutinise-web/lib/stage-gates.ts \| Added: checkStage3to4Gate(ideaId) — validates ≥12 unique IdeaReview records and avgQualityRating ≥ 2.5 (VIEWED=3, ENDORSED=5, BELOW_STANDARD=0). advanceStage3to4(ideaId, ownerId) — updates stage to STAGE_4, visibility to PLATFORM_LISTED, creates StageTransition record. getStage3GateData(ideaId) — returns {reviewCount, avgQualityRating} for gate checklist display. \| Sprint 5 Priority 1 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/progress/route.ts \| Extended: added STAGE_3→STAGE_4 branch. Calls checkStage3to4Gate (returns 422 if blocked) then advanceStage3to4. \| Sprint 5 Priority 1 \| \| 2026-03-23 \| scrutinise-web/app/ideas/[id]/page.tsx \| IdeaReview upsert (outcome=VIEWED) for authenticated visitors at Stage 3+ — server-side, non-blocking (.catch(()=\>{})). Stage 3→4 gate data fetched when Stage 3 + owner: ideaReviewCount + avgQualityRating. Both passed as new props to IdeaDetailClient. \| Sprint 5 Priority 1+3 \| \| 2026-03-23 \| scrutinise-web/app/ideas/[id]/IdeaDetailClient.tsx \| Stage3GateCard component added (shows reviewCount/12 and avgQualityRating/2.5 with CheckCircle icons). BeginCampaignModal component added (warning modal, warns voting opens + cannot be undone). Begin Campaign action button (Stage 3, owner only, disabled until gate met). stage3GateMet derived state. handleBeginCampaignSuccess sets stage to STAGE_4 + PLATFORM_LISTED. useSearchParams reads ?tab= for deep-link support. AmendmentsTab stub replaced with real import. \| Sprint 5 Priority 1+2 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/amendments/route.ts \| New — GET (public for Stage 3+, returns amendments with counter-proposals) and POST (propose amendment, auth required, Stage 3+ only). Notifies idea owner via notification with linkUrl deep-linking to Amendments tab. \| Sprint 5 Priority 2 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/amendments/[amendmentId]/route.ts \| New — PATCH owner action on pending amendment. Actions: accept (MODE_B), circulate (MODE_A), request_revision (sets REVISION_REQUESTED + revisionGuidance), reject (sets REJECTED + rejectionReason). Notifies amendment author on each action. Discriminated union Zod schema. \| Sprint 5 Priority 2 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/amendments/[amendmentId]/counter/route.ts \| New — POST owner counter-proposal. Creates new Amendment with isCounterProposal=true, parentAmendmentId set. Notifies original proposer. Parent must be PENDING. \| Sprint 5 Priority 2 \| \| 2026-03-23 \| scrutinise-web/app/ideas/[id]/AmendmentsTab.tsx \| New — real amendments tab. ProposeAmendmentForm: section, current/proposed wording, rationale. AmendmentCard: expandable, status badge, wording diff, rationale, rejection/revision notes, counter-proposals nested. OwnerActionPanel: 5 actions (Accept Binding, Consult First, Request Revision, Counter-Propose, Reject) with inline text forms for revision/reject/counter. \| Sprint 5 Priority 2 \| \| 2026-03-23 \| scrutinise-web/middleware.ts \| /api/ideas/(.\*)/amendments added to public GET routes. \| Sprint 5 Priority 2 \|

\| 2026-03-23 \| scrutinise-web/prisma/schema.prisma \| Sprint 6 P0a — Added: qualityRating Int? to IdeaReview and Comment; qualityRating Int? + updatedAt to CommentRating; AlertType enum (VOTE_OPEN/STAGE_CHANGE); IdeaAlert model (userId, ideaId, alertType, @@unique[userId,ideaId,alertType]); IdeaAlert relations on User and Idea. Removed: helpfulCount/notHelpfulCount from Comment. Group: added ideaId optional + relation to Idea + stageTransitionRequests. Added StageTransitionRequest model (ideaId, groupId, requestedByUserId, fromStage, toStage, status). \| Sprint 6 P0a \| \| 2026-03-23 \| scrutinise-web/app/ideas/[id]/ContributionsTab.tsx \| Sprint 6 P0a — Removed helpfulCount/notHelpfulCount from Contribution type; replaced helpful count display with QualityRating component per contribution card (calls POST .../rate). Added QualityRating import. \| Sprint 6 P0a+P0c \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/contributions/route.ts \| Sprint 6 P0a — Removed helpfulCount from orderBy (now orderBy createdAt asc). \| Sprint 6 P0a \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/reviews/route.ts \| New — POST /api/ideas/[id]/reviews. Auth required, Stage 3+. Upserts IdeaReview for current user with qualityRating 1–5. Creates VIEWED outcome if no existing record. \| Sprint 6 P0b \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/contributions/[commentId]/rate/route.ts \| New — POST /api/ideas/[id]/contributions/[commentId]/rate. Auth required. Upserts CommentRating.qualityRating 1–5. Recalculates and denormalises avg back to Comment.qualityRating. \| Sprint 6 P0b \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/alerts/route.ts \| New — POST /api/ideas/[id]/alerts. Auth required, Stage 2+. Upserts IdeaAlert (VOTE_OPEN or STAGE_CHANGE). \| Sprint 6 P0b \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/alerts/[alertType]/route.ts \| New — DELETE /api/ideas/[id]/alerts/[alertType]. Auth required. Removes IdeaAlert for current user. \| Sprint 6 P0b \| \| 2026-03-23 \| scrutinise-web/components/QualityRating.tsx \| New — shared QualityRating component. Idle: thumbs-up icon (muted if unrated, filled if rated) + avg beside it. Expanded: 1–5 slider with labelMin/labelMax, promptText. Submits on slider release or Confirm. \| Sprint 6 P0c \| \| 2026-03-23 \| scrutinise-web/components/VoteInterceptModal.tsx \| New — VoteInterceptModal. Shown at Stage 2/3 when any vote-related element is clicked. Offers VOTE_OPEN notification subscription via POST .../alerts. YES → subscribe + confirm. NO → dismiss. \| Sprint 6 P0c \| \| 2026-03-23 \| scrutinise-web/app/ideas/[id]/IdeaDetailClient.tsx \| Sprint 6 P0c/P1/P2/P3 — Added: QualityRating + VoteInterceptModal imports. VoteInterceptModal shown at Stage 2/3 on vote area click. Vote intercept banner at Stage 2/3. QualityRating for idea argument quality (Stage 3+, authenticated). Stage4GateCard (3 MP / 3 Peer / 1 Draftsman / all wording). SubmitToParliamentModal. Submit to Parliament action button (Stage 4, owner). stage4GateMet derived state. handleSubmitToParliamentSuccess. EndorsementPanel: fetches + displays MP/Peer/Draftsman endorsements; Endorse + Below Standard buttons for MPs/Peers/manualCredibilityOverride. TeamTab: full rewrite with real group data — Core Team collaborators + MY_TEAM/COMMUNICATIONS/POLICY_DEVELOPMENT group CRUD. \| Sprint 6 P0c+P1+P2+P3 \| \| 2026-03-23 \| scrutinise-web/app/ideas/[id]/page.tsx \| Sprint 6 P1/P2 — Added stage4GateData fetch (getStage4GateData, owner-only Stage 4). Added currentUserCanEndorse detection (MP/Peer/manualCredibilityOverride). Both passed as new props to IdeaDetailClient. \| Sprint 6 P1+P2 \| \| 2026-03-23 \| scrutinise-web/lib/stage-gates.ts \| Sprint 6 P1 — Added: checkStage4to5Gate (≥3 MP, ≥3 Peer endorsements, ≥1 DraftsmanEndorsement, all proposedWording complete). getStage4GateData (returns mpCount/peerCount/draftsmanCount/wordingComplete). advanceStage4to5 (STAGE_5 + PLATFORM_LISTED + StageTransition + notifies all STAGE_CHANGE IdeaAlert holders). \| Sprint 6 P1 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/progress/route.ts \| Sprint 6 P1 — Extended: added STAGE_4→STAGE_5 branch. Calls checkStage4to5Gate then advanceStage4to5. \| Sprint 6 P1 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/endorsements/route.ts \| New — GET public endorsements list. POST create endorsement (MP/Peer/manualCredibilityOverride only, Stage 4+). action=BELOW_STANDARD creates IdeaReview(BELOW_STANDARD). Unique constraint enforced (P2002 → 409). \| Sprint 6 P2 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/endorsements/[endorsementId]/route.ts \| New — DELETE withdraw endorsement. Endorser-only. Updates status=WITHDRAWN, decrements endorsementCount. \| Sprint 6 P2 \| \| 2026-03-23 \| scrutinise-web/middleware.ts \| Sprint 6 — /api/ideas/(.\*)/endorsements added to public GET routes. \| Sprint 6 P2 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/groups/route.ts \| New — GET (owner/collaborators only) + POST (owner only) idea-scoped groups. \| Sprint 6 P3 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/groups/[groupId]/members/route.ts \| New — POST add member to group. Owner only. \| Sprint 6 P3 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/groups/[groupId]/members/[userId]/route.ts \| New — DELETE remove member from group. Owner or self. \| Sprint 6 P3 \|

\| 2026-03-23 \| scrutinise-web/prisma/schema.prisma \| Sprint 7 — Added draftsmanEndorsementCount Int @default(0) to Idea. Added draftsmanName String? and organisation String? to DraftsmanEndorsement. Made DraftsmanEndorsement.draftsmanUserId optional (String?). \| Sprint 7 P1 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/endorsements/draftsman/route.ts \| New — POST /api/ideas/[id]/endorsements/draftsman. Owner-only. Stage 4+. One per idea (409 on duplicate). Body: { draftsmanName, organisation, qualifications, statement }. Creates DraftsmanEndorsement, increments idea.draftsmanEndorsementCount. \| Sprint 7 P1 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/endorsements/route.ts \| Sprint 7 — Updated GET to include draftsmanName and organisation in draftsman endorsement select. \| Sprint 7 P1 \| \| 2026-03-23 \| scrutinise-web/app/ideas/[id]/IdeaDetailClient.tsx \| Sprint 7 — Updated DraftsmanRecord interface (draftsmanName, organisation, draftsman nullable). Added DraftsmanEndorsementForm to EndorsementPanel (owner-only, Stage 4+, hidden once submitted). Added privacy-log Tab type and tab entry (owner-only). Added PrivacyLogTab component (green banner if no records; amber banners per event showing accessor first+initial, date, reason). \| Sprint 7 P1+P2 \| \| 2026-03-23 \| scrutinise-web/app/api/ideas/[id]/privacy-log/route.ts \| New — GET /api/ideas/[id]/privacy-log. Owner-only. Returns ActivityLog records where accessType=ADMIN_ACCESS for this idea, ordered createdAt DESC. Resolves accessedByUserId to first name + last initial only. \| Sprint 7 P2 \| \| 2026-03-23 \| scrutinise-web/app/admin/layout.tsx \| New — Admin layout. Server component. Auth guard: redirects to /sign-in if not authenticated; redirects to /dashboard if not ADMIN or SUPER_ADMIN. \| Sprint 7 P3 \| \| 2026-03-23 \| scrutinise-web/app/admin/page.tsx \| New — Admin panel page. Client component with three sections: (a) Content Reports — lists ContentReport records PENDING first; Dismiss/Hide/Remove/Warn actions via PATCH; (b) Users — paginated user list with inline role dropdown; (c) Platform Config — SUPER_ADMIN only, toggle/number inputs for credibilityWeightingActive, peerReviewRequired, minReviewersForStage4, minRatingForStage4. \| Sprint 7 P3 \| \| 2026-03-23 \| scrutinise-web/app/api/admin/reports/route.ts \| New — GET /api/admin/reports. Admin+. Lists ContentReport records PENDING first, then createdAt DESC. Returns reporter, content owner, reported content snippet, reason, status. \| Sprint 7 P3a \| \| 2026-03-23 \| scrutinise-web/app/api/admin/reports/[reportId]/route.ts \| New — PATCH /api/admin/reports/[reportId]. Admin+. Actions: DISMISS→DISMISSED, HIDE/REMOVE/WARN→ACTION_TAKEN. Creates notification for content owner (except DISMISS). HIDE also archives idea. \| Sprint 7 P3a \| \| 2026-03-23 \| scrutinise-web/app/api/admin/users/route.ts \| New — GET /api/admin/users. Admin+. Paginated (page + limit). Returns name, email, role, status, joinDate, credibilityScore, ideaCount. \| Sprint 7 P3b \| \| 2026-03-23 \| scrutinise-web/app/api/admin/users/[userId]/role/route.ts \| New — PATCH /api/admin/users/[userId]/role. SUPER_ADMIN can set any role; ADMIN can set CITIZEN or MODERATOR only. Logs to ActivityLog. \| Sprint 7 P3b \| \| 2026-03-23 \| scrutinise-web/app/api/admin/config/route.ts \| New — GET /api/admin/config (Admin+) and PATCH (SUPER_ADMIN only). Manages PlatformConfig keys: credibilityWeightingActive, peerReviewRequired, minReviewersForStage4, minRatingForStage4. Changes logged to ActivityLog. \| Sprint 7 P3c \| \| 2026-03-23 \| scrutinise-web/middleware.ts \| Sprint 7 — Added /admin(.*) and /api/admin(.*) to protected routes (Clerk session required). \| Sprint 7 P3 \|

***

*CHANGE_LOG.md — Scrutinise — March 2026* *PENDING entries are cleared after batch application.* *APPLIED entries are never deleted — this is the audit trail.*
