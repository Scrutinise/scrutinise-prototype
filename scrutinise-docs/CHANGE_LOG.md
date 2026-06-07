# SCRUTINISE — CHANGE LOG

*Pending and applied changes to all spec documents.* *PENDING section: cleared after each batch application.* *APPLIED section: permanent audit trail, never deleted.* *Last updated: 7 Jun 2026 (V9 — Monitor service + email cleanup + partial reseeding + corpus labels)*

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

`scrutinise-docs/Legislation_Corpus_Current_Status.xlsx` columns H-N populated:
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
| `scrutinise-docs/CLAUDE.md` | **Add:** Sprint brief protocol section under §12 Git Discipline — CCh writes briefs to `docs/SPRINT.md`, CC archives at sprint end. |
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
| `scrutinise-docs/CLAUDE.md` | Added §15: PostgreSQL thesaurus dictionary. Documents .ths file location, deployment steps for self-hosted vs managed PG, Neon limitation, and application-layer fallback path. Documents prefix matching implementation in `buildTsQuery()`. |

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
| `scrutinise-docs/operational_corpus_framework_v1.md` (NEW) | Design doc: canonical model, source taxonomy, R2 key scheme, OperationalScraper interface, rate-limiting policy, provenance flags, update strategy, known limitations, next-source priority list. |
| `scrutinise-docs/handoff_summary.md` | Updated to v46: V.3-A results, Railway state, schema changes, pending items, next sprint options. |
| `scrutinise-docs/CLAUDE.md` | Fixed two occurrences of `D:/Dropbox/GitHub/scrutinise-prototype` → `C:/Code/scrutinise-prototype` (Section 8 git approval policy + Section 12 `commit-all.sh` example). |
| `scrutinise-docs/CHANGE_LOG.md` | This entry. |

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
| `scrutinise-docs/handoff_summary.md` | Updated to v45: V2.76-B fully complete; final Railway state delta table; Phase 3B results; verification findings; deferred items updated |
| `scrutinise-docs/CHANGE_LOG.md` | This entry |

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
| `scrutinise-docs/handoff_summary.md` | Updated to v44: V2.76-B complete; Railway state delta table; deferred items |
| `scrutinise-docs/CHANGE_LOG.md` | This entry |

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
| `scrutinise-docs/V2.76_bulk_data_inventory.md` (NEW, extended) | Full Phase 1 inventory: access verification, dataset map, amendment XML schema, Companies Act 2006 confirmation, download order, size estimates, gotchas, Phase 2 plan + Sections 14–17: Explanatory Notes, InForce granularity, historical coverage, UKSI/devolved scope |
| `.gitignore` | Added `scripts/legislation/v276-samples/` — local discovery artefacts (large CSVs/XML), not committed |
| `scrutinise-docs/handoff_summary.md` | Updated to v43: extended Phase 1 findings + corpus categorisation (Legislative / Financial / Operational) + sprint phasing within categories |

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
| `scrutinise-docs/roadmap.md` | Funding-route guidance entry added |

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
| `scrutinise-docs/CHANGE_LOG.md`      | Sprint V2L entry added. |
| `scrutinise-docs/handoff_summary.md` | Bumped to v35.          |

**Deploy actions needed:** None.

***

### V2L-C1: CLAUDE.md storage policy

| File                        | Change                                                                                                                            |
|-----------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `scrutinise-docs/CLAUDE.md` | Added STORAGE ARCHITECTURE section: Railway 5GB hard limit policy, R2 key scheme, on-demand fetch flow, R2 client file locations. |

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
| `scrutinise-docs/system_mechanics_v0_8.md` | NEW — v0.8 with updated Section 3 points schedule and new Section 21 (Referral Mechanics, Points, and Credibility end-to-end). |
| `scrutinise-docs/CHANGE_LOG.md`            | This entry.                                                                                                                    |
| `scrutinise-docs/handoff_summary.md`       | Sprint V2-A section added.                                                                                                     |
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
| `scrutinise-docs/lex_system_prompt_v5.0.md` | Updated to v5.1 with all 6 changes documented.                                                                                                                                                                                                                                                                                                                                   |

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
| 2026-03-06    | scrutinise-docs/scrutinise_prototype_brief.md                    | Created — comprehensive prototype build guide covering codebase state, file structure, mock data, scripted Lex conversation (19 exchanges), component specs, five user journeys, terminology, styling guidelines, deployment notes, and build order                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | CC session                             |
| 2026-03-07    | scrutinise-web/app/prototype/profile/[username]/page.tsx         | Created — user profile page (WF-30): credibility score display, points breakdown (Strategist/Thinker/Rallymaster/Teambuilder), expert badges, user's ideas grid, recent contributions, Follow toggle button (visual only in prototype)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Phase 2 build                          |
| 2026-03-08    | scrutinise-web/components/VoteWidget.tsx                         | Strength slider updated to step={0.5} (11 stops: 0–5 in 0.5 increments). strengthLabels changed from 6-entry array to 11-entry Record\<number, string\>. Display updated to toFixed(1).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Spec correction                        |
| 2026-03-08    | scrutinise-web/.dropboxignore                                    | Created — excludes .next/ and node_modules/ from Dropbox sync to prevent file locking conflicts with Next.js dev server (EPERM rename errors)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Dev environment fix                    |
| 2026-03-09    | scrutinise-web/app/prototype/create/stage1/page.tsx              | Rebuilt: 8-field Basic Info form (title, ideaType toggle, govtArea dropdown, summaryDescription, summaryDiagnosis, summaryGuidingPolicy, summaryCoherentActions, connectedIdeas). Stage progress indicator. Conditional "Ready for Stage 2" button.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | CC_briefing_next_session.md Priority 1 |
| 2026-03-09    | start-session.sh                                                 | Created: session logging script — appends timestamp and branch to session-log.txt, runs git status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | CC_briefing_next_session.md Priority 2 |
| 2026-03-09    | scrutinise-web/app/prototype/page.tsx                            | Converted from journey-selector hub to WF-10 proper dashboard: welcome greeting, My Ideas section, quick actions, notifications sidebar, following/watching placeholder, groups section                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | CC_briefing_next_session.md Priority 3 |
| 2026-03-09    | scrutinise-web/app/prototype/testing-guide/page.tsx              | Created: tester-facing checklist with 8 journeys, step-by-step verification items per journey, full page inventory table with checkboxes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | CC_briefing_next_session.md Priority 4 |
| 2026-03-09    | scrutinise-docs/entity_list_v4.md                                | Added to repo: replaces entity_list_v3.md. 54 entities. CommentRating redesigned with positiveFlags/negativeFlags JSON + dispute flow. DisputedLogicFlag entity added. Follow entity added. Training entity added. CredibilityScore canonical (InfluenceScore retired). User.mobile required. BroadcastMessage expanded with co-signatory fields.                                                                                                                                                                                                                                                                                                                                                                                                                                     | CCh session 09-03-26                   |
| 2026-03-09    | scrutinise-docs/CC_briefing_next_session.md                      | Created: CCh-produced briefing document for this CC session                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | CCh session 09-03-26                   |
| 2026-03-09    | scrutinise-docs/CLAUDE.md                                        | Updated: Section 1 checklist references entity_list_v4; Section 5 repo structure updated to v4 (54 entities); Section 12 Field Preservation Rule added (immutable, CCh-only entity list); Section 11/13 renumbered                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | CCh session 09-03-26                   |
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
