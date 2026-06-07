# SCRUTINISE — INGEST OPS PLAYBOOK

*Last updated: 7 Jun 2026 (V10 final — post-session lessons added). Maintained alongside handoff_summary.md.*

This is the practical ops reference for the ingest pipeline. Read this when something breaks, when restarting workers, or when seeding a new corpus. It assumes familiarity with the system architecture but not with the exact API calls and failure modes.

---

## 1. SYSTEM OVERVIEW

| Component | Where | What it does |
|-----------|-------|-------------|
| 20 workers | Railway (`ingest-worker-1` … `ingest-worker-20`) | Claim queue rows, fetch content, write to R2 + Neon |
| Scheduler | Railway (`Ingest-scheduler`) | Hourly: sends progress email, saves corpus snapshots, runs stale claim reaper |
| Monitor | Railway (`ingest-monitor`) | Every 15 min: reseeds partial items, resets 502/524 failures, logs exhausted corpora |
| Railway DB | Railway (`scrutinise-db`) | Holds `ingest_queue`, `source_rate_limits`, `ingest_progress_snapshots` |
| Neon DB | Neon | Holds `corpus_sections`, `corpus_targets`, `corpus_snapshots` |
| R2 | Cloudflare `scrutinise-legislation` | Raw XML + compiled text files per section |

**All workers are interchangeable.** Any worker can handle any corpus via the queue-claim model (`FOR UPDATE SKIP LOCKED`). Priority 1 > 2 > 3.

---

## 2. RAILWAY API

### Credentials (from `.env`)

```
RAILWAY_API_TOKEN    (Bearer token)
RAILWAY_PROJECT_ID   68707c61-5c68-4f37-88fc-c301fd6b90e7
ENV_ID               991f733c-719c-4217-a6d6-1dbe80642bbe
API endpoint         https://backboard.railway.com/graphql/v2
```

> **Note on API endpoints:** `backboard.railway.com/graphql/v2` is the correct endpoint. `api.railway.app/graphql/v2` also exists but returns stale data in some contexts. Use `backboard`.

### Service IDs (verified 7 Jun 2026)

| Service | ID |
|---------|-----|
| ingest-worker-1 | `a7f4d75f-d844-4e1c-8edf-2569346b31c9` |
| ingest-worker-2 | `239c82f3-5695-401a-8538-e0425c503896` |
| ingest-worker-3 | `de3eda47-6988-44d0-9da3-d845b1456a86` |
| ingest-worker-4 | `c36412fe-cecc-4534-9b7c-4d0b8288a726` |
| ingest-worker-5 | `ea4516e9-d037-4eb4-8739-63333d922a46` |
| ingest-worker-6 | `d7b9ed9b-5e37-4a37-8e24-fc0054f99d54` |
| ingest-worker-7 | `1e66ba24-2cb7-4ab0-85a7-a78640c53f44` |
| ingest-worker-8 | `aeb24af8-7965-470a-a0aa-89ff16a7aa2e` |
| ingest-worker-9 | `45ce2312-01ce-47d2-9d82-5b34f520f802` |
| ingest-worker-10 | `eecdc235-36e3-4351-bfed-659f3947c752` |
| ingest-worker-11 | `87c9c70c-c865-424b-9025-d7a0de6df30a` |
| ingest-worker-12 | `546a351e-c418-49e0-8160-0c8916c3074d` |
| ingest-worker-13 | `af5fdb2c-367f-4087-a11f-9a0a99230807` |
| ingest-worker-14 | `84a59dfc-ed77-4957-970e-53e50b7f0113` |
| ingest-worker-15 | `fc3e1aab-75d9-4aba-ac6c-ae0f96ca0ccb` |
| ingest-worker-16 | `e683f995-7938-4756-b645-a7b4626f0d7a` |
| ingest-worker-17 | `7d92a1d0-eb24-4631-97b4-797a0fa2a9e4` |
| ingest-worker-18 | `239e52f7-6a5d-41fd-a7bf-b22227ead4af` |
| ingest-worker-19 | `40839fb3-b395-47b2-bbb4-9ca5d3e8142d` |
| ingest-worker-20 | `01174183-68c7-4afd-88d0-9932cca3f9fa` |
| Ingest-scheduler | `f3397bee-e588-4b95-921f-2e0f2f169cc5` |
| ingest-monitor | `d4945e0c-207a-46ca-aceb-bdc010183cc5` |
| scrutinise-db | `2f0ef638-332c-4ed6-b8da-13384d90b87f` |

### Key mutations

**Restart a service (fast — reuses existing build):**
```graphql
mutation($deploymentId: String!) {
  deploymentRedeploy(id: $deploymentId)
}
```
Requires a deployment ID (from `deployments(last: 1)` query). Fastest option — no rebuild.

**Trigger new deployment from source (slow — full npm install + build):**
```graphql
mutation($serviceId: String!, $environmentId: String!) {
  serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
}
```
Use this when code has changed and you need to pick up the new version.

**Update service instance settings:**
```graphql
mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
  serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
}
```
Input fields used in practice:
- `rootDirectory: "scripts/ingest"` — required for non-root services (see §6)
- `restartPolicyType: "ON_FAILURE"`, `restartPolicyMaxRetries: 3` — set 7 Jun 2026 on all 22 services

**Query deployment status:**
```graphql
query($projectId: String!) {
  project(id: $projectId) {
    services { edges { node { id name
      deployments(last: 1) { edges { node { id status createdAt } } }
    } } }
  }
}
```

**Query service instance config (rootDirectory, startCommand):**
```graphql
query($serviceId: String!, $environmentId: String!) {
  serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
    rootDirectory startCommand buildCommand
  }
}
```

### Ready-to-run scripts

| Script | Purpose |
|--------|---------|
| `scripts/ingest/restart-workers-staggered.ts` | Batch-5, 20s-gap restart of all 20 workers + scheduler |
| `scripts/ingest/check-railway-status.ts` | Current deployment status for all services |
| `scripts/ingest/check-service-config.ts` | rootDirectory + startCommand for specific services |
| `scripts/ingest/fix-monitor-root-dir.ts` | Set rootDirectory + redeploy for ingest-monitor |
| `scripts/ingest/set-restart-policy.ts` | Set ON_FAILURE/max-3 on all 22 services |
| `scripts/ingest/check-monitor-deployments.ts` | Last 5 deployments for ingest-monitor |

Run any script with:
```
NODE_PATH=scrutinise-web/node_modules \
scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json \
scripts/ingest/<script>.ts
```

---

## 3. STAGGERED WORKER RESTART PROCEDURE

Use when: volume resize, DB restart, code push that needs container pickup, mass CRASHED status.

**Do NOT restart `scrutinise-db` itself** unless it's the specific DB service that failed — restarting the DB drops all worker connections simultaneously.

```
Step 1: Run restart-workers-staggered.ts
        → Batches of 5, 20s gaps, all 20 workers + scheduler
        → serviceInstanceRedeploy (triggers rebuild from current Main branch)
        → Polls until SUCCESS or CRASHED

Step 2: Check for any still-CRASHED after first pass
        → If timestamp is OLD (pre-restart), the redeploy wasn't received
        → Run retry-crashed-workers.ts or trigger individually
        → Wait 90s after re-trigger before polling again

Step 3: Confirm Neon writes
        → Run check-neon-recent.ts
        → Expect sections written within 5 minutes of workers going SUCCESS
```

**Timing expectations:**
- `serviceInstanceRedeploy` → SUCCESS: ~90s (npm install is cached after first build)
- `deploymentRedeploy` → SUCCESS: ~15–30s (no rebuild, just container restart)
- If polling too early (< 60s), workers still show old CRASHED — wait and re-poll

**Why staggered?** All 20 workers competing for Railway's build queue simultaneously causes some deploys to be queued and potentially time out. Batches of 5 with 20s gaps spread the load.

---

## 4. MONITOR DIAGNOSIS

`ingest-monitor` runs every 15 minutes and should stay in a persistent loop. If it shows CRASHED:

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| CRASHED immediately (< 30s) | `pg` module not found — rootDirectory wrong | Set `rootDirectory: "scripts/ingest"` via `serviceInstanceUpdate` + redeploy |
| CRASHED after first cycle (~30–120s) | Runtime error in `runMonitor()` — bad SQL column, missing env var | Check that `DATABASE_URL` and `NEON_DATABASE_URL` are set; check SQL column names |
| "Completed" in Railway UI (exit code 0) | Process exited cleanly — loop not running | Check `main()` ends with `loop()` call using `setTimeout` to keep process alive |
| SUCCESS but no corrective actions logged | Normal — monitor only logs when it actually takes action | Check next 15-min boundary in Railway logs |

**Current known bugs fixed (7 Jun 2026):**
- `require('pg')` inside async function → replaced with top-level `Pool` import
- `"legislationGovUkId"` column → does not exist on `ingest_queue`; correct column is `"docId"`

**To check if monitor is stable:** query `deployments(last: 5)` — if only one entry at SUCCESS for > 5 min, the loop is running. If multiple entries with recent timestamps, it's crash-cycling.

---

## 5. QUEUE SEEDING

### Railway DB queue (`ingest_queue`)

One row per unit of work. Key columns: `id`, `corpus`, `"docId"`, `"sourceType"`, `priority`, `status`.

**Schema** (`bulkUpsertQueueRows` accepts):
```typescript
{ id: string, corpus: string, docId: string, sourceType: string, priority: number }
```

**Corpus → sourceType mapping:**
| corpus | sourceType |
|--------|-----------|
| `fca-handbook` | `fca-handbook` |
| `lda-commonsoralquestions` etc. | `lda-parliament` |
| `pwdata-debates` etc. | `twfy-pwdata` |
| `tna-caselaw` | `tna-caselaw` |
| `primary-acts-*`, `si-*`, `regional`, `retained-eu` | `tna-legislation` |
| `eur-lex` | `eurlex` |
| `fca-publications`, `sentencing-council`, `nao-reports`, `college-of-policing` etc. | `gov-uk` |

**Seeder scripts:**
| Script | Seeds |
|--------|-------|
| `seed-fca-handbook-queue.ts` | 63 FCA Handbook modules |
| `seed-lda-queue.ts` | 1,602 LDA Parliament pages |
| `seed-pwdata-queue.ts` | ~36k TWFY pwdata files |

**If Railway DB is inaccessible locally** (ECONNRESET — transient after volume resize): use Railway dashboard → `scrutinise-db` → Query tab and paste the INSERT SQL directly.

**Reset stale/failed rows:**
```sql
-- Reset stuck claimed rows (worker crashed mid-claim)
UPDATE ingest_queue SET status='pending', "claimedBy"=NULL, "claimedAt"=NULL
WHERE status='claimed' AND "claimedAt" < NOW() - INTERVAL '90 minutes';

-- Reset retryable failures (502/524)
UPDATE ingest_queue SET status='pending', "lastError"=NULL, "claimedBy"=NULL, "claimedAt"=NULL
WHERE status='failed' AND ("lastError" LIKE '%HTTP 502%' OR "lastError" LIKE '%HTTP 524%')
  AND "completedAt" < NOW() - INTERVAL '30 minutes';
```

### Neon `corpus_targets`

Controls what appears in the progress email and what est_sections the email shows.

```sql
-- Add/update a corpus entry
INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, blocked, blocked_reason)
VALUES ('my-corpus', 'Display Name', 5000, false, false, NULL)
ON CONFLICT (corpus_key) DO UPDATE
  SET display_label    = EXCLUDED.display_label,
      est_sections     = EXCLUDED.est_sections,
      est_is_confirmed = EXCLUDED.est_is_confirmed,
      blocked          = EXCLUDED.blocked,
      blocked_reason   = EXCLUDED.blocked_reason;

-- Retire a corpus (suppress from email)
UPDATE corpus_targets
SET retired = true, blocked = true, blocked_reason = 'reason'
WHERE corpus_key = 'my-corpus';
```

**Retired corpora (as of 7 Jun 2026):** `hansard-commons-a/b`, `hansard-lords-a/b` (pwdata coverage supersedes), `fca-publications`, `fca-regulators` (superseded by `fca-handbook`).

---

## 6. RAILWAY SERVICE CONFIGURATION REQUIREMENTS

### `exec` prefix on start commands

All start commands use `exec tsx ...` not `tsx ...`. Without `exec`, npm spawns tsx as a child process. Railway sends SIGTERM to the npm process but tsx never receives it, so the container hangs for 10s before Railway force-kills it. With `exec`, tsx IS the process and receives SIGTERM cleanly.

```json
"start":     "exec tsx workers/worker-queue.ts",
"scheduler": "exec tsx scheduler.ts",
"monitor":   "exec tsx monitor.ts"
```

### `rootDirectory` for non-root services

Workers, scheduler, and monitor all live in `scripts/ingest/` which has its own `package.json` with `pg`, `@prisma/client`, `tsx`, etc. Railway must install deps from there, not from the repo root.

**Required setting:** `rootDirectory: "scripts/ingest"` on every ingest service.

If `rootDirectory` is `null` (repo root), npm installs only the root `package.json` (which has only `dotenv`). The process starts then crashes immediately with `Cannot find package 'pg'`.

**How to check:** `scripts/ingest/check-service-config.ts`  
**How to fix:** `scripts/ingest/fix-monitor-root-dir.ts` (adapts to any service ID)

### GitHub source connection

New services created via Railway API need to be connected to the GitHub repo in the Railway dashboard before they can build. API-created services have no source until manually connected via: Railway dashboard → Service → Settings → Source → Connect GitHub.

---

## 7. R2 KEY SCHEME

Bucket: `scrutinise-legislation`

### V2L key scheme (current — all production corpora)

```
{corpus}/{govUkId}/sections/{sectionRef}.compiled.txt    ← text for search/display
{corpus}/{govUkId}/sections/{sectionRef}.raw.xml         ← source CLML (legislation only)
```

Examples:
```
primary-acts-2000plus/ukpga/2020/1/sections/1.compiled.txt
si-pre-2010/uksi/2005/3452/sections/12.compiled.txt
fca-handbook/cobs/sections/cobs1s1.compiled.txt
tna-caselaw/{ncn}/sections/1.compiled.txt
```

### Helper functions (`scripts/ingest/shared/r2-client.ts`)

```typescript
compiledKey(corpus, docId, sectionRef)  // → {corpus}/{docId}/sections/{sectionRef}/compiled.txt
rawKey(corpus, docId, sectionRef, ext)  // → {corpus}/{docId}/sections/{sectionRef}/raw.{ext}
caselawKey(docId)                       // → caselaw/{docId}/compiled.txt
hansardKey(date, id)                    // → hansard/{date}/{id}.compiled.txt
bailiiKey(id)                           // → bailii/{id}.compiled.txt
```

### Legacy R2 prefixes (Neon legacy pipeline — do not modify)

`ukpga/`, `uksi/`, `eudn/`, `eudr/`, `eur/`, `anaw/`, `asp/`, `asc/`, `nia/`, `nisi/`, `nisr/`, `ssi/`, `wsi/`, `operational/` — these are from the pre-Railway Neon pipeline and hold ~914k legacy sections. They are separate from the Railway ingest prefixes.

---

## 8. KNOWN FAILURE PATTERNS (V1–V10 + post-V10 incidents)

### DB / Volume

| Incident | Cause | Fix |
|----------|-------|-----|
| Railway DB ECONNRESET locally | Railway blocks external connections during high load / post-crash | Retry after a few minutes; or use Railway dashboard → Query tab for SQL |
| All 20 workers CRASHED simultaneously | Railway PostgreSQL volume hit capacity limit (was 5GB, resized to 20GB) | Resize volume in Railway dashboard → wait for DB SUCCESS → staggered worker restart |
| Workers CRASHED immediately after volume resize | DB container still recovering; workers reconnected before DB ready | Wait 2–3 min after `scrutinise-db` shows SUCCESS, then restart workers |
| `compiledText` DB column bloat | 10KB compiledText per section × 750k+ rows = ~1.6GB | Column dropped in V3; now R2-only. Never re-add `compiledText` to schema. |

### Worker crashes

| Incident | Cause | Fix |
|----------|-------|-----|
| Worker SIGTERM crash-loop on TNA discovery | `discoverTnaLegislation` triggered full historical scan (733 HTTP calls) in one claim; Railway kills at ~10 min | Fixed V6b: discovery now only checks last 2 years inline; full scan is via reseed scripts only |
| HMRC worker stuck claimed 26h | `processHmrc` runs 6 generators in one claim (~17k items); Railway SIGTERM before done | Reset: `UPDATE ingest_queue SET status='pending'... WHERE corpus='hmrc-codes-guidance' AND status='claimed'` |
| Workers picking up wrong corpus | Stale `DISCOVERY_CORPUS_ORDER` not matching new sourceTypes | Add new corpus to `DISCOVERY_CORPUS_ORDER` and `sourceTypeMap` in `worker-queue.ts` |
| `serviceInstanceRedeploy` — some workers not receiving trigger | API receives request but Railway queues and sometimes drops under load | Re-trigger specifically the ones still showing old timestamps; wait 90s |

### Email / Scheduler

| Incident | Cause | Fix |
|----------|-------|-----|
| Duplicate progress emails (every hour × 2) | Two Railway deployments of scheduler running simultaneously | Deploy fresh from Main branch (not "Redeploy" of old deployment); `scheduler_lock` table prevents duplicate runs |
| `RangeError` in progressBar | `pct` > 100 when compiled > est_sections | Fixed V3: `progressBar()` clamps pct to [0, 100] |
| Email showing old per-corpus format | Workers not yet redeployed after code change | Redeploy all workers; snapshots with `workerId` column start appearing |
| No duplicate source in Vercel/Next.js | Checked `vercel.json` (no cron) and all API routes (no `sendProgressEmail`) — confirmed Railway-only |  |

### Source-specific

| Incident | Cause | Fix |
|----------|-------|-----|
| FCA Handbook 0 sections (old scraper) | `handbook.fca.org.uk` is JS SPA; static HTML has no content | Rewritten V10: direct HTTP to `api-handbook.fca.org.uk` JSON API |
| FCA Handbook monitor crash | `require('pg')` in async fn + `"legislationGovUkId"` column missing | Fixed V10: use Pool from top-level import; column is `"docId"` |
| EUR-Lex blocked | `search.html?format=json` redesigned as SPA | Fixed V6: use CELLAR SPARQL endpoint `publications.europa.eu/webapi/rdf/sparql` |
| ECHR HUDOC 404 | `/app/query/results` endpoint changed Jun 2026 | No fix yet — corpus blocked in `corpus_targets` |
| Hansard API 403 from Railway IPs | `api.parliament.uk/v1/hansard` blocks Railway egress IPs | Replaced by TWFY pwdata bulk XML (V8); Hansard API queue rows retired |
| LDA Commons Written Questions 524 | `lda.data.parliament.uk` times out on page > 100 records | Fixed V1: retry with `pageSize 100` on 524; partial coverage accepted |
| UK Treaties 422 | `filter_organisations[]=` sent as literal `[]` — gov.uk returns 422 | Fixed V2: use `URLSearchParams` which encodes as `%5B%5D` |
| TWFY pwdata wrong directory paths | Brief had `lords/` but actual path is `lordspages/`; `westminster/` → `westminhall/`; `wrans/` prefix is `answers` | Fixed V2: paths verified by live directory probe before building client |
| TNA caselaw "7,489 pages" — empty beyond 1,499 | Feed reports inflated page count; pages 1,500+ return empty | Fixed V4: binary search for true last non-empty page |
| LDA commonswrittenquestions 0 rows | 388 HTTP 524 failures when DB was near-full; inserts silently failed | Reset failed rows; retry once DB has space |

### Railway service config

| Incident | Cause | Fix |
|----------|-------|-----|
| `ingest-monitor` CRASHED — `pg` not found | `rootDirectory: null` → installs from repo root (only `dotenv`) | Set `rootDirectory: "scripts/ingest"` via `serviceInstanceUpdate` + redeploy |
| Scheduler running `worker-queue.ts` instead of `scheduler.ts` | `scripts/ingest/railway.json` had `startCommand: "npm run worker"` overriding service-level config | Removed `railway.json`; each service uses its own Railway dashboard start command |
| Worker-2 build loop | Railway retrying old deployment (old commit + old Nixpacks path) | Trigger fresh "Deploy" from Main branch in Railway dashboard (not "Redeploy") |

---

## 9. DB SIZE MONITORING

Railway PostgreSQL is on a 20GB volume (resized from 5GB after 4 Jun 2026 crash).

**Alert thresholds (in progress email):** ⚠️ at 80% (16GB), ⚠️ CRITICAL at 90% (18GB).

**Current drivers of Railway DB size:** `ingest_queue` rows (done rows accumulate) + `ingest_progress_snapshots` (hourly). Both are cleaned by the scheduler hourly cleanup.

**Neon DB** holds `corpus_sections` (no `compiledText` column — dropped V3; full text in R2 only). Neon size grows ~1MB per ~1,000 sections. At 790k sections ≈ ~800MB.

**Manual size check:**
```sql
-- Railway DB (run in Railway dashboard Query tab)
SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size;

-- Neon (run via seed script or diag-db.ts)
SELECT COUNT(*) FROM corpus_sections;
```

---

## 10. QUICK REFERENCE — CORPUS STATUS (as of 7 Jun 2026)

| Corpus | Status | Notes |
|--------|--------|-------|
| primary-acts-pre-2000 | ✅ active | 6,038 partial items being reseeded by monitor |
| primary-acts-2000plus | ✅ complete | 90,860 sections |
| si-pre-2010 | ✅ complete | 174,507 sections |
| si-2010plus | ✅ active | Growing |
| regional | ✅ active | 123,058 / ~160,000 |
| retained-eu | ✅ complete | 14,390 sections |
| tna-caselaw | ✅ complete | ~74,950 judgments |
| eur-lex | ✅ active | SPARQL-based; ~19k ingested |
| fca-handbook | ✅ complete V10 | 3,661 sections confirmed; est_is_confirmed=true |
| fca-publications | ⛔ retired V10 | Superseded by fca-handbook |
| fca-regulators | ⛔ retired V10 | Old SPA scraper; never worked |
| echr-hudoc | ⛔ blocked | HUDOC API endpoint changed Jun 2026; no fix |
| hansard-commons-a/b | ⛔ retired V8 | Covered by pwdata-debates (1919–present) |
| hansard-lords-a/b | ⛔ retired V8 | Covered by pwdata-lords (1999–present) |
| pwdata-debates | ✅ complete | 20,004 files 1919–2026 |
| pwdata-lords | ✅ complete | 5,668 files 1999–2026 |
| pwdata-wrans / wms / lordswrans / lordswms | ✅ active | Processing |
| lda-commonsoralquestions | ✅ complete | 65,806 sections |
| lda-commonswrittenquestions | ⚠️ active | 618,599 records; 524 retry fix in place |
| lda-lordswrittenquestions | ✅ active | 103,137 records |
| college-of-policing / sentencing-council / nao-reports | ✅ active | Gov.uk scraper |
| uk-treaties | ✅ complete | 1,104 FCDO treaties |
| oecd | ✅ complete | 462 open docs |
| planning-policy / building-regs | ✅ complete | Small corpora |

---

## 11. LESSONS LEARNED — V10 SESSION (7 Jun 2026)

These are non-obvious things discovered during the V10 session that aren't obvious from reading the code.

### Railway API

**`backboard.railway.com` vs `api.railway.app`**  
Use `backboard.railway.com/graphql/v2`. The `api.railway.app` endpoint works for some mutations but returns stale deployment data in queries — caused misleading "all settled" poll results during staggered restart.

**`serviceInstanceRedeploy` triggers a rebuild; `deploymentRedeploy` does not**  
`serviceInstanceRedeploy(serviceId, environmentId)` creates a new deployment from source (full npm install + build, ~90s). `deploymentRedeploy(id: deploymentId)` restarts the existing container (~15–30s, no rebuild). Use `deploymentRedeploy` for crash recovery after a volume resize; use `serviceInstanceRedeploy` only when you need to pick up new code.

**Staggered restart polling — wait 90s minimum before polling**  
Polling too soon (< 60s after `serviceInstanceRedeploy`) returns the old CRASHED status because the new deployment hasn't registered yet. Workers that show an old pre-restart timestamp in their deployment `createdAt` field did NOT receive the trigger — re-trigger those specifically. Workers that show a new timestamp but CRASHED failed the new build.

**`ServiceInstanceUpdateInput` — confirmed working fields**  
`rootDirectory`, `startCommand`, `buildCommand`, `restartPolicyType` ("ON_FAILURE"/"NEVER"/"ALWAYS"), `restartPolicyMaxRetries`. The `source { ... on ServiceSourceRepo }` inline fragment does NOT exist — use the project services query to get source info.

### Railway DB schema

**`source_rate_limits` actual columns (7 Jun 2026):**  
`sourceKey`, `intervalMs`, `lastIssuedAt`, `suspended`, `suspendedUntil`, `updatedAt`, `isComplete`, `maxConcurrentWorkers`  
— NOT `minIntervalMs`, NOT `note`. Always verify column names before writing scripts against this table.

**`ingest_queue` has no `legislationGovUkId` column**  
The govUkId for TNA legislation rows is stored in `"docId"`. Any query that filters by govUkId against ingest_queue must use `WHERE "docId" = ANY(...)`.

**`scheduler_lock` table survives volume resize**  
The lock row is a regular DB row — it persists across volume resizes, container restarts, and redeployments. It is only lost if someone explicitly TRUNCATEs or DROPs the table. If the table is empty, insert: `INSERT INTO scheduler_lock (id, "lockedBy", "lockedAt") VALUES (1, NULL, NULL) ON CONFLICT DO NOTHING`. Check actual column names first — observed columns are `id`, `locked_at`, `process_id` (snake_case, not camelCase).

### Monitor (`ingest-monitor`)

**`rootDirectory: null` is silent death**  
A service created via Railway API has `rootDirectory: null` by default. It builds from the repo root, installs the root `package.json` (only `dotenv`), then crashes at runtime on the first `import { Pool } from 'pg'`. There is no build error — the build succeeds, the runtime crashes. Always set `rootDirectory: "scripts/ingest"` for any new ingest service.

**`require()` inside async functions is fragile**  
Even with `"module": "commonjs"` in tsconfig, using `require('pg')` inside an async function can cause ambiguity errors depending on tsx version and Node.js version. Always use top-level ES imports. If a single-connection pattern is needed (like `pg.Client`), use `new Pool({ max: 1 })` with a checked-out client instead.

**Monitor "SUCCESS" does not mean "running"**  
Railway shows `SUCCESS` for a deployment that either (a) is still running healthy, or (b) has exited with code 0. To distinguish: query `deployments(last: 5)` — if the same deployment ID is still `SUCCESS` after 3+ minutes, the process is running its loop. If new deployment IDs appear at short intervals, the process is crash-cycling.

### Corpus estimates

**Always set `est_is_confirmed = true` after a corpus completes**  
`est_is_confirmed = false` means the email denominator is an estimate. Once all queue rows are `done` and the Neon count is final, run: `UPDATE corpus_targets SET est_sections = <actual>, est_is_confirmed = true WHERE corpus_key = '<key>'`. For `fca-handbook`: 3,661 actual vs 8,000 estimated — a 54% overestimate. Estimates for JS-rendered SPAs are inherently unreliable until the first ingest completes.

**FCA Handbook section count is lower than expected because provisions aggregate**  
The `GetAllHandBookProvisionsSortedOrderByChapter` API returns individual provision paragraphs (often 10–20 per section). The ingest groups them by `sectionId`, so the final row count is per-section not per-provision. This is the correct design for Lex search purposes, but it means the raw provision count (potentially ~20k) does not map 1:1 to corpus_sections rows.
