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

### Railway DB connection storm on simultaneous worker restart

Symptom: All workers crash with ECONNRESET within 30s of a deploy  
Cause: 20 workers attempting DB connections simultaneously exceeds Railway Postgres pool limit  
Fix (permanent): startup jitter in `worker-queue.ts` (random 0–20s delay before first DB call)  
Fix (manual): staggered restart script — batches of 5, 20s gap, using `deploymentRedeploy(id)`  
First seen: V8 sprint (6 Jun 2026). Recurred: V10, V12, V13.  
Now automated: startup jitter added V13 — manual restart should no longer be needed.

### Local scheduler process causing duplicate emails

Symptom: Second email arriving at consistent :XX past the hour, different timestamp from Railway scheduler  
Cause: `scheduler.ts` running locally on developer machine from a CC session that was left open  
Diagnosis: `Get-WmiObject Win32_Process | Where-Object {$_.CommandLine -like "*scheduler*"}`  
Fix: `Stop-Process -Id {PID} -Force` in PowerShell 7 (pwsh), not Command Prompt  
Prevention: never run `scheduler.ts` locally; always let Railway manage the scheduler service  
First seen: 6 Jun 2026 01:21 BST. Ran for 38+ hours before diagnosed.

### Monitor partial-item reseed false positives

Symptom: Thousands of complete short Acts reseeded as 'pending', workers spin on them producing nothing  
Cause: `PARTIAL_SECTION_THRESHOLD` global value too high for ancient legislation (pre-2000 Acts  
  legitimately have 1 section)  
Fix: `CORPUS_THRESHOLDS` map in `monitor.ts` with per-corpus values (pre-2000: 1, modern records: 3–5)  
First seen: V12 sprint. Fixed V12.

### Deploy of crash-fix causes the crash it is fixing

Symptom: Startup jitter deployed to fix connection storm; deploy itself triggers connection storm  
Cause: Railway auto-deploys all services simultaneously on push; jitter code not yet running  
Fix: For any deploy changing worker startup behaviour, manually trigger staggered redeploy  
  immediately after push rather than waiting for Railway auto-deploy  
Prevention: Add to sprint brief checklist — if `worker-queue.ts` is modified, trigger manual  
  staggered restart after push  
First seen: V13 deploy, 8 Jun 2026

### Workers claiming rows but producing 0 sections (silent throughput failure)

Symptom: All workers show as active in Railway, queue claim rate normal, but corpus_sections  
  write rate is 0 for hours  
Cause: Workers claiming hasNoProvisions legislation rows at high priority — each claim takes  
  ~500ms and marks the row unavailable, but writes nothing to corpus_sections  
Detection gap: `monitor.ts` checks for idle workers via snapshot writes, but hasNoProvisions  
  processing writes to `ingest_queue` (not `corpus_sections`) so appears healthy  
Fix: Add monitor check — if queue claims > 100 in last 30min but corpus_sections writes = 0,  
  fire `all_workers_idle` alert  
Fix: Priority SQL must be run as part of any sprint that touches legislation queue rows —  
  never leave as a manual carry-over step  
First seen: 8 Jun 2026, 09:30–15:35 BST (6 hours, 0 sections)
| Duplicate email at :23 surviving all Railway restarts+redeploys | LOCAL scheduler.ts process running on Charlie's machine (started when code used fixed `setInterval`; fires at original start minute) | Kill local node process: `Stop-Process -Id <PID>`; check via `Get-WmiObject Win32_Process -Filter "Name='node.exe'" \| Select CommandLine` |

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

### TNA hasNoProvisions classification (V14)

`NumberOfProvisions="0"` in the CLML root element means the document exists but has no structured provision nodes. These are real legal instruments, not errors. V11 stopped workers spinning on them. V14 adds proper classification and a specialist queue.

**Classification types** (stored in `corpus_sections.availability_status`):

| Type | Meaning | Action |
|------|---------|--------|
| `commencement` | Title includes "commencement", "appointed day", or "coming into force" | Queued in `specialist_queue` for future commencement worker |
| `metadata-only` | Year < 1980 — pre-digitisation, no text available anywhere | Metadata-only record in `corpus_sections` |
| `pdf-only` | HEAD request to `/data.pdf` succeeds | Queued in `specialist_queue` for future PDF extraction worker |
| `no-provisions` | None of the above — catch-all | `corpus_sections` row with note; no specialist queue entry |

**Architecture (V14):**
- `tna-legislation.ts`: `classifyNoProvisionsItem(docId, fullXml)` performs classification using title regex + year heuristic + HEAD request for PDF
- `worker-queue.ts`: calls classification in `processTnaLegislation()` when `section.format === 'unavailable'`; writes `availabilityStatus` + `availabilityNote` to Neon; inserts `specialist_queue` row for commencement/pdf-only
- `corpus_sections.availability_status`: new column (`full` default for all existing rows)
- `corpus_sections.availability_note`: user-facing explanation for non-full items (Lex displays this)
- `specialist_queue` on Railway DB: holds commencement + pdf-only items for future specialist workers

**Bulk classification script:** `scripts/ingest/classify-no-provisions.ts`
- Targets existing done queue rows with `hasNoProvisions` in `lastError`
- Checkpointed/resumable — kill and restart safely
- 200ms delay between TNA requests; reports progress every 500 items
- Run: `NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json scripts/ingest/classify-no-provisions.ts`

**Part 7 SQL result (V14 session):** 0 rows affected — V11 already marks hasNoProvisions rows done inline (no `lastError` set). The SQL was targeting a pre-V11 failure state. Workers are processing correctly.

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

## 10. QUICK REFERENCE — CORPUS STATUS (as of 8 Jun 2026)

| Corpus | Status | Notes |
|--------|--------|-------|
| primary-acts-pre-2000 | ✅ active | 6,038 false-positive pending rows reset to done (V12); 0 genuine gaps found |
| primary-acts-2000plus | ✅ complete | 90,860 sections |
| si-pre-2010 | ✅ active | 20,533 pending |
| si-2010plus | ✅ active | 3,228 pending |
| regional | ✅ active | 4,859 pending |
| retained-eu | ✅ active | 2,452 pending |
| tna-caselaw | ✅ complete | ~74,950 judgments |
| eur-lex | ✅ complete V13 | 90,260 sections; est_is_confirmed=true |
| fca-handbook | ✅ complete V10 | 3,661 sections; est_is_confirmed=true |
| fca-publications | ⛔ retired V10 | Superseded by fca-handbook |
| fca-regulators | ⛔ retired V10 | Old SPA scraper; never worked |
| echr-hudoc | ⛔ blocked | HUDOC API endpoint changed Jun 2026; no fix |
| hansard-commons-a/b | ⛔ retired V8 | Covered by pwdata-debates (1919–present) |
| hansard-lords-a/b | ⛔ retired V8 | Covered by pwdata-lords (1999–present) |
| pwdata-debates | ✅ complete | ~20k files 1919–2026; auto-reseeds daily via monitor |
| pwdata-lords | ✅ complete | ~5.7k files 1999–2026 |
| pwdata-wrans / wms / lordswrans / lordswms | ✅ complete | All done V11 |
| pwdata-westminster | ✅ complete | ~3.9k files; all done |
| lda-commonsoralquestions | ✅ complete | 65,806 sections |
| lda-commonswrittenquestions | ⚠️ active | 1,232 pending (V12 reset); timeout 45s→90s |
| lda-lordswrittenquestions | ⚠️ active | 132 pending (V12 reset) |
| hmrc-tiins | ✅ complete V12 | 791 sections; est_is_confirmed=true |
| hmrc-codes-guidance | ✅ complete V12 | 14,067 sections; est 640k→14,067 confirmed |
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

---

## 12. LESSONS LEARNED — V11 SESSION (7 Jun 2026)

### TNA Legislation — hasNoProvisions

**74% of pending SI rows return NumberOfProvisions="0" (diagnostic V11)**  
`enumerateSections` previously fell through to HTML/PDF fetchers when the CLML had `NumberOfProvisions="0"`. For SI corpora (commencement orders, amending SIs), these fallback fetches consistently return nothing — wasting 2 HTTP round-trips per item. `diag-has-no-provisions.ts` sampled 100 random pending `si-pre-2010`/`si-2010plus` rows: **74 of 100 (74%) had `NumberOfProvisions="0"`**. Fix: push unavailable section immediately, skip HTML/PDF. Saves ~2 RTTs per item × 20k pending SI rows = significant throughput gain.

Run `scripts/ingest/diag-has-no-provisions.ts` periodically to check if the rate changes as newer SIs (with more structure) enter the queue.

### pwdata queue — fully seeded, grows incrementally

**All pwdata corpora are fully processed (V11 diagnosis)**  
After the full seeding runs in V2/V8, all 7 pwdata corpora reached 0 pending rows by V11:
- pwdata-debates: 19,768 done + ~236 skipped (empty parliament days)
- All other corpora: 100% done

Re-running `seed-pwdata-queue.ts` inserts 0 new rows because all directory files are already in the queue. New files are only added as Parliament sits (~1–5 files/week during term). To pick up new parliament days: re-run the seeder weekly. The ON CONFLICT DO NOTHING makes re-runs safe.

**pwdata "millions of sections" was an overestimate**  
Each daily XML file = 1 queue row = 1 section in Neon. 20k debate files = ~20k Neon sections, not millions. The "millions" figure in earlier briefs was based on individual speech counts, but the worker compiles each daily file into one combined text blob.

### TNA rate limits — increased for legislation

**tna-legislation: 6 → 10 concurrent workers (V11)**  
Increased `maxConcurrentWorkers` from 6 to 10 in `seed-rate-limits.ts`. Applied via re-run of the script (7 Jun 2026). Safe because `AdaptiveThrottle` in `tna-legislation.ts` automatically suspends the source on 429s. Evidence of no recent 429s: `source_rate_limits.suspended = false` at time of change.

Workers will now be able to maintain 10 parallel TNA XML fetches at 200ms interval instead of 6 — meaningful throughput increase for the 38k+ pending SI/regional/retained-eu rows.

### Monitor alerts — added to monitor.ts

**`monitor_alerts` table in Neon (V11)**  
New table stores alert history for rate-limiting (max 1 per issue per 4 hours). Created by `createMonitorAlertsTable()` in `monitor.ts` — runs on every monitor startup (idempotent `CREATE TABLE IF NOT EXISTS`). No migration required.

**Monitor alert requires RESEND_API_KEY on monitor service**  
`ingest-monitor` Railway service does not yet have `RESEND_API_KEY` set. Add it to the service env vars in Railway dashboard (same key as scheduler uses). Without it, alerts are logged to Railway logs but not emailed. The alert table in Neon still records them either way.

**Two alert conditions (V11):**
- `all_workers_idle`: pending > 0 AND no worker snapshots in last 1 hour
- `stalled_source`: a sourceType has > 100 pending rows, no claimed rows, and no snapshots in 2 hours

---

## 13. LESSONS LEARNED — V12 SESSION (8 Jun 2026)

### Duplicate email — definitive root cause found

**The duplicate email at :23 was a LOCAL scheduler.ts process on Charlie's machine, not Railway.**  
After 38+ hours of Railway restarts and redeployments failing to kill the duplicate, the root cause was found via `Get-WmiObject Win32_Process` — two node.exe processes (tsx parent + child) running `scheduler.ts` in `scripts/ingest/`. The local process was started before the `msUntilNextRun()` clock-alignment was introduced. Old scheduler code used a fixed `setInterval` — so it fires at whatever minute it started, every hour. New code always aligns to :01.

**Diagnosis checklist for future "duplicate email that survives Railway redeploy":**
1. Check Railway service list — all services should have expected startCommands (`check-service-config.ts`)
2. Check local processes: `Get-WmiObject Win32_Process -Filter "Name='node.exe'" | Select CommandLine`
3. Check Windows Task Scheduler: `Get-ScheduledTask | Where TaskName -match "scrutinise|ingest|scheduler"`
4. Kill any stale local process: `Stop-Process -Id <PID>`

**Prevention:** Never start `scheduler.ts` as a local long-running process — it's for Railway only. For local monitoring use `cc-monitor.ts`.

### Monitor partial-item threshold — corpus-aware (V12)

**Single global threshold (3) caused false-positive reseeding of pre-2000 Acts.**  
V9/V11 monitor used `PARTIAL_SECTION_THRESHOLD = 3` for all corpora. This caused 6,038 `primary-acts-pre-2000` rows to be re-queued — the entire backlog. Root cause: many pre-2000 Acts genuinely have 1–2 sections; the threshold flagged them as incomplete.

**Fix (V12):** `CORPUS_THRESHOLDS` map in `monitor.ts` with per-corpus values. Pre-2000 legislation: threshold 1 (0 sections = incomplete, 1+ = legitimate). Modern parliamentary records (pwdata, LDA): threshold 3–5.

**Finding from cross-DB verification (V12):**  
ALL 6,038 falsely-reseeded `primary-acts-pre-2000` rows had ≥1 section in Neon — 0 genuine gaps. Reset all to `done` via cross-DB script. If future diagnostic finds genuine gaps, docIds have format `ukpga/{year}/{number}`.

### HMRC corpora — completed, estimates confirmed (V12)

**hmrc-tiins: 791 sections — complete (est_is_confirmed=true)**  
800-section estimate was accurate. Queue: 1 row done. No reseeding needed.

**hmrc-codes-guidance: 14,067 sections — complete (est_is_confirmed=true, was 640,000)**  
The 640,000 estimate was wrong by 45×. Root cause: `processHmrc()` uses the GOV.UK search API which returns top-level document pages, not individual HMRC manual sub-pages. Each manual is one GOV.UK URL = one Neon section. 14,067 documents were found across 6 generators (manuals + NAO + HoCL + explanatory notes + impact assessments + consultations). The 640k figure assumed individual sub-page enumeration which was never built. The corpus is complete as-is.

**Lesson:** For corpora using GOV.UK search API (`searchGovUk`, `searchGovUkByOrg`), the section count = number of search results (capped at `count` param), not number of sub-pages per result. Estimates based on sub-page counts are unreliable.

### LDA timeout — increased to 180s (V13, was 90s in V12)

**LDA API is erratically slow at ALL page numbers — pages 3 through 1089 all timed out at 90s (V13 diagnosis, 8 Jun 2026).**  
This is NOT limited to high page numbers as previously believed. Increased `LDA_FETCH_TIMEOUT_MS` to 180,000 in `lda-parliament.ts`.

**Timeout history:** 45s (original) → 90s (V12, based on page 999+ observation) → 180s (V13, after finding page 3 also times out).

**V12 note (now superseded):** "Pages 0–200 are fast; pages 200+ slow down progressively." — this was incorrect. Failures observed at page 3, page 10, page 100 in V13.

**LDA failure reset procedure:**
```sql
UPDATE ingest_queue
SET status = 'pending', "lastError" = NULL, "claimedBy" = NULL, "claimedAt" = NULL
WHERE corpus = 'lda-commonswrittenquestions'
  AND status = 'failed'
  AND "lastError" LIKE '%fetch timed out%';
```
After any timeout increase, reset all timed-out rows and redeploy workers to pick up the new timeout value.

### pwdata auto-reseed — added to monitor (V12)

**Monitor now auto-reseeds exhausted pwdata corpora.**  
`reseedExhaustedCorpora()` added to `checkQueueExhaustion()`. When a pwdata corpus hits 0 pending + 0 claimed, monitor fetches TWFY directory and inserts any new files (ON CONFLICT DO NOTHING). This handles the daily new parliament files without requiring manual `seed-pwdata-queue.ts` runs.

**TNA legislation and LDA: no auto-reseed** — TNA discovery is expensive (sequential HTTP scans); LDA reseeding risks rate-limit overflow. Only pwdata uses incremental daily files that are safe to auto-discover.
