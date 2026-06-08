# SCRUTINISE — HANDOFF SUMMARY

*Read this first every session. Top section is authoritative.*

*Last updated: 8 Jun 2026 (V13 — startup jitter added, sentencing-council fixed, nilawcom fixed, Railway ops docs added)*

---

## CURRENT STATE

**Active branch:** Main
**Last commit:** pending (commit-all.sh to be generated)
**Last sprint:** V13 (8 Jun 2026) — startup jitter in worker-queue.ts; sentencing-council scraper fixed (direct site, embedded JSON); nilawcom BFS crawl fix; CLAUDE.md + INGEST_PLAYBOOK.md docs updated

---

## IMMEDIATE ACTIONS REQUIRED — V13

| Action | Status | Who |
|--------|--------|-----|
| Run `commit-all.sh` | ⬜ pending | Charlie |
| Redeploy all 20 workers (to pick up startup jitter + sentencing-council + nilawcom fixes) | ⬜ after commit | Charlie |
| Run priority SQL in Railway dashboard Query tab (de-prioritize completed legislation corpora) | ⬜ pending | Charlie |
| Update sentencing-council corpus_targets: `UPDATE corpus_targets SET blocked=false, blocked_reason=NULL WHERE corpus_key='sentencing-council'` | ⬜ pending | Charlie |
| Run `commit-all.sh` from V12 first if not yet done | ⬜ check | Charlie |

**V12 carry-over (still needed):**
| Kill local scheduler.ts process: `Stop-Process -Id 22916` (and child 47892) | ⬜ URGENT (if not done) | Charlie |
| Redeploy `Ingest-scheduler` on Railway (stopped 7 Jun 23:01 UTC) | ⬜ after commit | Charlie |
| Add `RESEND_API_KEY` to `ingest-monitor` Railway service env | ⬜ pending | Charlie |

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
