# SCRUTINISE — HANDOFF SUMMARY

*Read this first every session. Top section is authoritative.*

*Last updated: 12 Jun 2026 — Search S0 readiness audit complete (`docs/SEARCH_AUDIT.md`, commit `ca38dd3`); V19 completion passes still in flight below.*

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

## CURRENT STATE — V19 (P1 TO 100% + PARLIAMENTARY RECORD + TAX COMPLETENESS)

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
