# SPRINT — Search thread: freshness → baseline → streams one at a time

*From CCh, handed over 2026-08-04 16:53 UTC. Read this at session start (targeted view, not a full
dump — `docs/CLAUDE.md` §12 "Sprint brief protocol"). Archive to `CHANGE_LOG.md` and clear this file
at sprint end.*

## Context you need before starting

**The FTS latency crisis is RESOLVED — do not re-diagnose it.** `corpus_fts` had 1,191,345 un-indexed
rows being brute-force scanned on every query (warm p50 26,005 ms). Rebuilt 4 Aug via the Heavy Job
Runner; verified again at 16:53 UTC: `unindexed=0`, warm p50 **1,250 ms**, live query **0.62 s**.
See `CHANGE_LOG.md` 2026-08-04 13:20 and 16:53 UTC, `INGEST_PLAYBOOK.md` §20, `docs/CLAUDE.md` §17.

**The gap this sprint closes.** The index is fast, but the surfaces users actually touch are not on
it. `app/api/ai/[ideaId]/route.ts:9` (idea-chat) imports legacy `searchLegislation()` from
`lib/search.ts` — Postgres GIN on `LegislationSection` — and never reaches `search-gateway.ts`. Same
for `LegislationPanel` (`/api/ideas/[id]/legislation-search`, un-indexed sequential scan) and the
browse page (`/api/legislation/search`, ILIKE on title). `SEARCH_AUDIT.md` §346–348 has the full
table. The gateway's only callers are `field-machine.ts:22` / `orchestrator.ts:30`, i.e. the Lex
rebuild surface — which is **preview-only, NOT promoted**.

**Worked example of the damage** (real, mid-conversation, Diagnosis stage): "what is the law on data
protection currently?" returned Road Traffic Act / Road Safety Act results. `buildTsQuery()`
(`lib/search.ts:75-98`) AND-joins every token, Postgres strips the stop words, and the surviving
query is `law & data & protection & current:*` — a hard conjunction in which "currently" became a
mandatory content term. No intent routing, because the legacy path has none.

## 0. Confirm BEFORE anything below is trusted

Verify `expandQuery()`'s thinking-mode fix is **genuinely live in production**, not merely committed
— it has drifted once already (the Gemini default changed under us in July). Re-confirm against the
deployed runtime; a green diff is not evidence. `VERCEL_TOKEN` is in `scrutinise-web/.env`.

## 1. Freshness sprint (the 29 July items, still outstanding)

- Backfill the still-missing corpora — Scottish Parliament + partial CPS guidance — same mechanism
  as the July fix, applied to what remains absent.
- **1a. REBUILD THE INDEX AFTERWARDS — this is not optional and it is not a footnote.** Every row the
  backfill appends lands *un-indexed*. LanceDB keeps them searchable by brute-force scanning the
  un-indexed fragments on **every query, forever**, until they are merged in. That is precisely what
  took warm p50 to 26,005 ms while everything still "worked" and nothing alerted. The backfill is not
  finished until the rebuild is:
  1. `tsx search/fts-optimize.ts --verify-only` → read `numUnindexedRows` (free, metadata only).
  2. If non-zero: `cd scripts/ingest && tsx ../ops/heavy-job/run.ts run fts-index` (~10 min, ~€0.05).
     Never on Railway — it peaks at 19.8 GB against an 8 GB per-replica cap (`docs/CLAUDE.md` §17).
  3. **Redeploy `fts-serve`** — it pins its index snapshot at `openTable()` on boot, so without a
     restart it keeps serving the old index however well the rebuild went.
  4. `--verify-only` again → confirm `unindexed=0`, then re-measure `/stats`.
- Act-level metadata table: title / year / jurisdiction / section-counts.
- **Repoint the legacy call sites through `search-gateway.ts`** — `searchLegislation()`,
  `LegislationPanel`, browse page — *through the gateway, never directly at FTS*. This is the Lex
  thread's own discipline: one point of contact stops scattered callers recurring. Apply it here.

## 2. Gold baseline — with Charlie's human validation pass folded in

**Sequencing trap:** "fully covered" means §1a is done and `unindexed=0` — *not* merely that the
backfill finished. Baselining against an index with an un-indexed tail measures a degraded
instrument and then enshrines it as the trusted reference for everything in §3 and §4.

Once the index is fully covered, take a fresh baseline reading. **This is the moment to finally do
the human answer-key validation pass outstanding since June.** Everything downstream treats this
baseline as the trusted reference, so it must rest on a validated instrument.

> **BLOCKS ON CHARLIE — this is his pass, not CC's.** Do not proceed to §3 on an unvalidated key.

## 3. Wire remaining streams into the router ONE AT A TIME, re-scoring after each

Each stream earns its place on the gold set or it waits — the same discipline as the original router
build. **The statistics-discoverability stream is one of the streams in this phase, not a separate
track** — its brief is already written: `docs/BRIEF_SEARCH_stats-discoverability.md` (see also
`docs/BRIEF_LEX_connect-stats-to-router.md`).

Watch while wiring: `query-router.ts:60` is a `Promise.all` fan-out over up to 5 streams against
`FTS_MAX_CONCURRENT=4` in `fts-query-service.ts`, so one user's query can queue against itself. Not
load-bearing at today's 1.25 s p50, but it scales with stream count — re-check as streams are added.

## 4. Vector fusion LAST, behind the same gate

Only once the above is done and re-scored clean. `LEX_SEARCH_VECTOR` stays OFF until then.

## Standing rules that apply to this sprint

- **Git:** no mid-sprint git. Write to disk, `tsc --noEmit` clean, then one `commit-all.sh` at the
  end (`docs/CLAUDE.md` §12). Build-breaking fixes are the only carve-out. Every commit and
  CHANGE_LOG heading carries a real `Date: YYYY-MM-DD HH:MM UTC` stamp from the system clock.
- **Heavy jobs:** anything memory-bound goes through `scripts/ops/heavy-job/` — never Railway, never
  local, never shrink-to-fit (`docs/CLAUDE.md` §17). `plan` before `run`.
- **After any index work, redeploy `fts-serve`** — it pins its snapshot at boot, so without a restart
  every after-measurement is meaningless.
- **Verify before asserting** (`docs/CLAUDE.md` §0) — this sprint has already had one hypothesis
  (semaphore contention) refuted by measurement, and one rebuild avoided by a free pre-check.
