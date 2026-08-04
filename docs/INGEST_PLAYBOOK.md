# SCRUTINISE — INGEST OPS PLAYBOOK

*Last updated: 20 Jun 2026 — V29: §8 six new patterns (PDF-fan-out throttle≠dead pages → in-adapter retry + reset; Parliament JSON list-page rows; Drupal sitemap-index enumerator; ombudsmen licence findings; own-open≠OGL codes; per-host cf_clearance). §18 licence-map +11 corpora. Prior — V27: breaker EVALUATION un-stalled (a 17M-row corpus_sections GROUP BY for an unread column was timing out every tick, silently disabling all breakers — now read from the hourly corpus_snapshots; see §breakers); diagnose breaker stalls from the Ops deploy logs, not source_status timestamps. V24: zero-output breaker FIXED (per-row `produced_output`, not aggregate count deltas — counts the r2Exists reseed-confirmation); three new patterns (NEW sourceType must seed POST-PUSH or the live worker markSkips it; verify a licence at the licence page not a footer grep; Web Archive snapshots can be JS-SPA shells). V23: §8 four new patterns (zero-output breaker idempotent-reseed false-positive + verify-by-id-prefix, CF listing-walk penalty-box → enumerate deterministic path, public-inquiries register method). V19: §1b source politeness budget doctrine, §1c denominator re-baselining (✓ rules), §8 seven patterns, §16 tax-source map, §17 FCL court coverage.*

This is the practical ops reference for the ingest pipeline. Read this when something breaks, when restarting services, or when seeding a new corpus. It assumes familiarity with the system architecture but not with the exact API calls and failure modes.

---

## 1. SYSTEM OVERVIEW — the three-layer doctrine (V17)

| Layer | Where | Role | Cost behaviour |
|-------|-------|------|----------------|
| **Corpus text** | Cloudflare R2 (`scrutinise-legislation`) | Permanent store: raw XML + compiled text per section | ~$0.015/GB-month, **zero egress** — effectively free at rest |
| **Metadata + search index** | Neon (`corpus_sections`, `corpus_targets`, `ingest_queue`, `source_rate_limits`, `source_status`, `scheduler_lock`, `ingest_service_state`, `ingest_progress_snapshots`, `corpus_snapshots`, legacy `LegislationSection`) | Elastic Postgres; everything ingest-related since V16 | Scale-to-zero compute; storage $/GB-month |
| **Transient compute** | Railway: `Ingest` + `Ops` services | `Ingest` = single-process pool worker (`workers/ingest-pool.ts`, `WORKER_CONCURRENCY` claim loops, default 20). **Exit-on-empty:** 3 empty sweeps × 30s → exit(0) → service stays stopped, bills nothing. `Ops` = merged scheduler+monitor (`ops.ts`): hourly email/census/reaper + 15-min breakers/liveness. Starts `Ingest` via `serviceInstanceRedeploy` when pending > 0. | Pay only while ingesting (plus the tiny always-on `Ops` footprint) |

Railway also hosts `scrutinise-db` (web-app Postgres, Prisma app tables only — ideas, users, etc). **No ingest code path touches it since V17.**

**Design rule: system cost at zero work must be ≈ $0.** Anything always-on must justify itself; the 23-container fleet had a ~$3.6/day floor regardless of output, which is why V17 exists.

The 20-worker fleet, separate scheduler and monitor services, startup jitter, staggered restarts, per-worker R2 checkpoints, and per-worker snapshots are all **retired** (code in `scripts/attic/v17-fleet/`).

⚠️ **Railway container has no curl.** The Railway Node.js container (Railpack + mise) does not include curl. `spawnSync('curl', ...)` returns ENOENT. Any feature requiring curl must install it via Nixpacks config (`nixpacks.toml`). Confirmed 9 Jun 2026.

**Claim loops are interchangeable.** Any loop handles any corpus via the queue-claim model (`FOR UPDATE SKIP LOCKED`). Priority 1 > 2 > 3. Rate limiting is in-process (token bucket per source, `shared/rate-limiter.ts`); `source_rate_limits` is configuration only — edit the table, restart `Ingest` to apply.

---

## 1a. COST MODEL (V17)

| Resource | Rate | Notes |
|----------|------|-------|
| Railway memory | $0.000231/GB-min (~$10/GB-month) | Dominant fleet cost pre-V17 |
| Railway CPU | $0.000463/vCPU-min | I/O-bound workers use little |
| Railway egress | $0.05/GB | Worker → Neon/R2 writes |
| Neon compute | ~$0.10/CU-hr, 0.25 CU minimum while active | Scales to zero when idle |
| Neon storage | ~$0.35/GB-month | Keep big text out — pointers only |
| R2 storage | ~$0.015/GB-month | **Zero egress fees** — corpus lives here |

Steady-state cost while idle should be ≈ Railway `scrutinise-db` + the small always-on `Ops` process + storage. If the Usage page shows compute burn while the queue is empty, something is wrong — check whether `Ingest` failed to exit-on-empty (e.g. a perpetual reseed loop keeping pending > 0).

⚠️ **Workspace Compute Usage Limit:** when the workspace usage limit is hit, Railway pauses ALL deployments simultaneously ("All deployments are paused" on the Usage page). See §8 — check this FIRST when everything is offline at once.

---

## 1b. SOURCE POLITENESS BUDGET (V19 doctrine)

**A 5xx storm under load is a rate signal, not a retry signal; halve and document.** Sections/hour is not the KPI on small charitable/public hosts — completion without complaint is.

- When any source returns a 429/503 storm during a run, the default response is to **halve the rate** (double `intervalMs`, halve `maxConcurrentWorkers`), record the old → new values and the incident in `seed-rate-limits.ts`'s note field and the CHANGE_LOG, then resume. Never resume at the old rate "because the queue is long".
- Speed is no longer the scarce resource; **source goodwill is**. TWFY (a charity) 503'd under our V18 500ms/10 full-archive run → halved to 1000ms/5 (V19). GOV.UK 429'd within an hour of et-decisions seeding (each row adds a PDF asset fetch on top of the content call) → halved 150ms/10 → 300ms/5 (V19).
- Per-row request count matters: a corpus whose processor makes 2-3 fetches per row effectively doubles the rate against the host. Budget on **requests/second at the host**, not rows/second.
- The circuit breaker tripping on consecutive 429s is the system working. Procedure: fix the rate FIRST (config table), restart `Ingest` (config loads at startup), then clear the breaker and unpark rows (§8).
- Applies to retries of previously-5xx'd sources too: retry at HALF the rate that triggered the storm, not the same rate.

---

## 1c. DENOMINATOR RE-BASELINING (✓ rules, V19)

A corpus denominator (`corpus_targets.est_sections`) is **✓ confirmed** (`est_is_confirmed=true`) only when it equals a *measured* quantity:

1. **At completion** (queue drained, zero unclassified failures): set `est_sections` = measured compiled-section count; `est_is_confirmed = true`. The email then shows 100.0%.
2. **Classified residue does not block ✓**: rows/sections classified `unavailable` with a real `availability_status` (no-provisions, commencement, pdf-only, withdrawn…) are accounted-for non-text; they are excluded from the denominator (which counts *compiled* sections) and listed in the CHANGE_LOG as the corpus's classified residue. A corpus "ends at a ✓ denominator or a classified residue — no `~` estimates on completed corpora."
3. **Never** leave an era-average or extrapolated estimate on a completed corpus — V18/V19 proved them wrong in both directions (pwdata-wrans est 2.0M vs measured 1.22M; ET decisions est ~72k vs measured 131,668).
4. While a corpus is actively ingesting, `est_sections` may hold the enumerated doc/section universe with `est_is_confirmed=false`; re-baseline per rule 1 when it drains.
5. Universe estimates derived from feed metadata (`morePages`, `rel="last"`) are **upper bounds at best, phantoms at worst** (FCL per-court rel=last claimed 80 pages for EAT; true extent 16). Only entry-counting enumeration or a drained queue measures a universe.

---

## 1d. HONEST DENOMINATOR (V21 doctrine)

**A known source missing from the denominator is a lie of omission — placeholders with honest `~` beat absence.** Every source we know exists gets a `corpus_targets` row the moment we know about it, carrying the best current estimate and its provenance in `notes` (measured > probed > rough order-of-magnitude — say which). Unsized sources get a row with `est_sections = NULL` so they are at least visible in the email.

Denominator membership rules (implemented in `progress-reporter.ts`, V21):

1. **Blocked sources COUNT.** The universe does not shrink because we cannot fetch it yet (scottish-courts, college-of-policing, echr-hudoc).
2. **Retired sources NEVER count.** Their content is covered by a successor corpus; counting both is double-counting (the retired LDA written-questions rows silently inflated the denominator by 722k next to their pwdata replacements until V21 fixed the filter).
3. Expect the headline % to DROP when a new source is sized — that is the metric working, not a regression (V21 §3: 91.3% → 88.0%).
4. Rough placeholders are replaced by measured universes per §1c when probed/unblocked, and ✓-confirmed at drain. Placeholder upsert script: `scripts/ingest/v21-honest-denominator.ts`.

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

## 3. STAGGERED WORKER RESTART PROCEDURE — ⚠️ RETIRED (V17)

**The worker fleet no longer exists** — staggered restarts are no longer a concept. `Ingest` is one service: deploy it with `serviceInstanceRedeploy`; `Ops` restarts it automatically when there is pending work. The procedure below is kept only as historical reference (script in `scripts/attic/v17-fleet/`).

Use when (fleet era): volume resize, DB restart, code push that needs container pickup, mass CRASHED status.

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

### Neon queue (`ingest_queue` — on Neon since V16)

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

## 8. KNOWN FAILURE PATTERNS (V1–V17)

### V30 patterns (24 Jun 2026)

- **The financial/competition corpus is a licence map, not a scrape.** The bodies that make/interpret financial/competition law split cleanly by copyright posture: the **CMA is a non-ministerial department → Crown copyright → OGL** (gov.uk `cma_case` finder, 2,562 cases, clean — BUILT). The **CAT (Competition Appeal Tribunal) and the FCA assert their OWN copyright** — CAT's `/copyright-notice` grants "private reference, research and study" only (all other use by application); FCA's `/legal` grants OGL only to "some statistical outputs … where the UKOGL is expressly stated". Neither is open → email-gate, do NOT build. **Verify each at its own copyright page** (CAT and FCA both *look* governmental but are not OGL). A tribunal's judgments may still be Crown copyright as judicial works — **check Find Case Law first** (CAT is NOT an FCL court, so no OJL fallback; if a body WERE in FCL we'd already hold it as `tna-caselaw`).
- **Dark own-microsites = the SPA-shell wall, again.** The flagship modern reviews (Cass et al., `*.independent-review.uk`) and inquiries are JS-SPA microsites. Their live sites are gone; they survive in **UKGWA (TNA web archive) which exposes NO public CDX**, and the **Internet Archive holds 0 PDF captures** for them (report PDFs sat on client-side-loaded CDN paths the crawler never saw). Before promising a "web-archive PDF enumeration" of a microsite, **run the Wayback CDX with `filter=mimetype:application/pdf` first** — an empty result means SPA/CDN-blocked, list it for a direct-PDF capture, don't build a crawler against a shell. (College of Policing, V24, was the first instance.)
- **Web-archive replay: pick the capture, and a DOCUMENT-DATE meta can be a constant.** Two traps building the pre-2016 Scottish OR from the Wayback archive: (1) the **legacy `report.aspx` `<meta name="DC.date">` is a constant template value** (every report carried "24/05/2011") — a per-doc date that's identical across docs is chrome, not data; derive the real date from the most-frequent in-body date instead. (2) **A single capture pick is unreliable** — the earliest (contemporaneous) capture of an old report predates a later site-template's markup (→ 0 parsed turns), a too-late capture can be an interstitial. Use a **multi-capture fallback**: list all captures for the doc, try them (preferring the era when the target markup existed) until one parses with content; mark the rest as a classified `archive-miss` residue, never `markFailed` (keeps the failure breaker honest). Separate the **membership** test (capture-timestamp window) from the **fetch** pick (best-rendering capture).
- **Inquiry-evidence §0 exclusion is structural, enforced at the worker, applied to the live token.** Inquiry evidence libraries (Drupal: `/evidence/all-evidence` faceted by evidence-type/witness-category) hand you exactly the structural metadata the §0 sensitive-evidence policy needs — exclude at the inquiry's OWN category level, never per-paragraph (see `SENSITIVE_EVIDENCE_POLICY.md`). Two build notes: the per-item **download token is not stable** across a deferred drain, so the docId is the evidence SLUG and the worker re-fetches the detail page for the current `/file/.../download?token` (and the §0 metadata) at ingest; and §0 runs at the worker, not the seeder — excluded items get a `sensitive-excluded`/`sensitive-flagged` marker (accounted-for), kept items get the text. Volumes are large (Post Office Horizon ~19,605 published items) → pilot + sequence, never blanket-seed.
- **POST-PUSH (executed 25 Jun): the `--measure` PDF-per-case sample UNDERSHOOTS the full seed.** cma-cases `--measure` (60-case sample) predicted 4.1 PDFs/case ≈ 13k sections; the full `--seed` enumeration found **20,336 decision PDFs across 2,562 cases (22,898 rows)** — a stepped sample biases low when PDF-rich cases (long mergers) are sparse. For per-PDF-fan-out sources, treat the measure as a floor, not a point estimate; verify the real count from the seed run, not the sample. (Same family of trap as the per-speech estimate.) Also confirmed live: each new sourceType's deploy is best canaried by the **worker output itself** (seed a small/idle batch → within one Ops-wake watch it produces sections vs markSkipped) — Ops woke the idle worker ~4 min after seeding scottish-parliament-or, both branches PASS skipped=0; an idempotent re-seed of an already-drained corpus is a safe no-op (0 processed).

### V29 patterns (20 Jun 2026)

- **A high steady failure rate on a per-row PDF-fan-out source = host throttling, not dead pages.** ICO drained at ~12% "page fetch failed" (3,226/26,576) because each row fires 1 HTML + up to 6 PDF requests; all the failures re-fetch HTTP 200 on a calm retry. The fix is an in-adapter polite retry (throw/429/5xx, backoff; 404/410 returns immediately so genuine deaths still classify), then reset the failed rows — NOT a re-seed and NOT treating them as known-unknowns. Diagnose by re-fetching a sample LIVE before concluding (verify-before-asserting). A unanimous sample (14/14 → 200) justifies a bulk reset without a per-row recheck.
- **The Parliament JSON API family is the gold-standard build.** erskinemay-api / oralquestionsandmotions-api / petition.parliament.uk / interests-api / commonsvotes-api all serve robust JSON whose LIST/section responses already carry the full content. So the cheap pattern is **list-page queue rows** (one row per page → many sections, keyed on the stable item id) — no per-item detail fetch, ~hundreds of rows for tens of thousands of items. Use the `list:` docId prefix so the row is structural-safe (won't feed the zero-output breaker on an empty trailing page). Contrast division-votes (V28) which seeded one row per item because the per-member roll-call needed a detail call.
- **CPS / Ofgem own-domain enumerators = the ICO sitemap pattern.** A Drupal "Simple XML Sitemap" exposes a `/sitemap.xml` INDEX → `?page=N` sub-pages; filter `<loc>` to the target path prefix (`/prosecution-guidance/`, `/publications/`), exclude the `/cy/` Welsh duplicates and data-only pages. Verify the licence at the actual copyright page found IN the sitemap (CPS's was `/crown-copyright-and-disclaimer`, not a guessed `/terms`).
- **Ombudsmen licence findings (the gating question — read the body's own terms page, footer link not a guess).** LGSCO = OGL-EQUIVALENT clean (lgo.org.uk/copyright carries the verbatim OGL permission wording, code `lgsco-open`) → built. FOS = restrictive ("must not reproduce without prior permission"). Pensions = conditional grant (not a standard open licence). Housing Ombudsman (165k decisions!) + PHSO = no copyright page surfaced → unverified, V30. Most quasi-judicial bodies are NOT Crown and assert own copyright — never assume OGL.
- **A non-departmental/non-ministerial regulator's "own open re-use terms" can be OGL-equivalent (free + attribution) but is NOT OGL** — give it its own code (`ofcom-open`, `lgsco-open`) so the licence column stays honest. Ofgem (non-ministerial dept) IS Crown copyright → genuine OGL.
- **A separate WordPress install on a separate hostname behind Cloudflare needs its OWN cf_clearance** — the cookie is host-bound. POSTnotes (post.parliament.uk), Commons Library, Lords Library and the shared PDF host (researchbriefings.files) are four distinct CF hosts; "one capture unblocks all" is false. Wire each as its own `house` in the capture-gated seam.

### ⚠️ ALL services show "Service is offline" simultaneously → check Usage page FIRST

Symptom: every Railway service (including `scrutinise-db`) is offline/paused at the same moment.
Cause: the **workspace Compute Usage Limit** was hit — Railway pauses ALL workloads at once. This is not a crash, not OOM, not connections, not worker code.
Check: Railway → Workspace → **Usage page** — look for "All deployments are paused".
Fix: raise/remove the usage limit; deployments resume. Do NOT restart services, redeploy, or "fix" worker code first.
History: this caused the 8–10 Jun 2026 project-wide outages and was misread as crashes through ~5 incident cycles. A simultaneous-everything outage has ONE cheap check before any other diagnosis.

### Circuit breakers (V17) — deterministic failure containment

`Ops` evaluates two breakers per source every 15 min (state in Neon `source_status`):

- **Failure breaker:** last 5 completed attempts for a source all `failed` → trip.
- **Zero-output breaker (V24 — per-row, NOT aggregate):** trips when the **trailing run of most-recent `done` rows** for a source (24h window) is all `produced_output=false` and reaches 25. `ingest_queue.produced_output` is the worker's per-row verdict — `false` only when the row wrote no compiled section, confirmed no existing R2 file, and wrote no marker, and is not a structural seeder (enum:/list:/gapvol:/treaties). This is the alarm the committees incident lacked (2,896 empty "done" rows, no signal) — but it no longer false-trips on idempotent reseeds (the V23 bug below).

On trip: the source's `pending` rows are parked as `status='blocked'`, the reason is recorded, and a persistent 🔴 line appears in every hourly email until cleared. **Tripped sources are never auto-retried** — deterministic failures must not be retried (see Retry policy in §13 lessons).

**Manual clear (after fixing the root cause):**
```sql
-- 1. clear the breaker
UPDATE source_status
SET state = 'ok', trip_reason = NULL, tripped_at = NULL, zero_output_streak = 0
WHERE source_key = '<sourceKey>';

-- 2. un-park the rows
UPDATE ingest_queue
SET status = 'pending', "lastError" = NULL
WHERE "sourceType" = '<sourceKey>' AND status = 'blocked';
```
`Ops` liveness will start `Ingest` within 15 min of pending > 0.

### Zero-output breaker FALSE-POSITIVES on idempotent reseeds — FIXED V24

The V23 breaker compared **total per-source `corpus_sections` COUNT** between sweeps: if ≥25 rows went `done` while the count grew by 0, it tripped. This **could not distinguish "wrote nothing" from "re-wrote identical rows"** — re-processing a row whose sections already exist UPSERTs them (0 NEW rows, COUNT unchanged) → read as zero output. A contiguous run of idempotent re-runs (the `priority,id` claim order clusters them by corpus) tripped it. **V23 incident:** tna-legislation tripped on 838 already-ingested regional SIs → parked 108,349 legitimate rows.

- **The V24 fix (`process-row.ts` + `ops.ts`):** the worker records a per-row verdict in `ingest_queue.produced_output`. `produced_output=true` when the row wrote a compiled section OR **confirmed an existing R2 file via `r2Exists`** (the idempotent-reseed skip path — *this* is the bit the aggregate logic missed) OR wrote a no-content marker OR is a structural seeder. `ops.evaluateBreakers` trips on the trailing all-`false` run (24h window, threshold 25). An idempotent reseed now scores `true` (its `r2Exists` hits are counted) → no trip; the curl-broken empty-done case still scores `false` → trips. Implemented with `AsyncLocalStorage` so the per-row counters are safe across the 20 concurrent claim loops, with **no processor-body changes** (only the `upsertSection`/`bulkUpsertSections`/`r2Exists`/`markDone` wrappers). Verified with `v24-verify-breaker.ts` (TEMP-table; production untouched).
- **Still verify before clearing any FUTURE trip** (CLAUDE.md §0): query the source's recently-`done` rows for sections by **id-prefix** (legislation sections have `parentDocId=NULL`, so a parentDocId join falsely reports "no section"). With the V24 fix a trip should now mean a genuine empty-done bug — fix the processor, don't just clear.

### Breaker EVALUATION silently stalled on a corpus_sections timeout — FIXED V27

**Symptom (found V27 §1):** `source_status` stopped updating (stale ~14–18 Jun) while `Ops` liveness still ran — i.e. the 15-min cycle reached `checkIngestLiveness` but `evaluateBreakers` was aborting first. Ground truth came from the **Ops deploy logs** (not from inferring off timestamps): `[ops] breaker evaluation failed: Error: Query read timeout … at querySourceCounts (ops.ts:192) … Promise.all (index 2)`. The third query in `querySourceCounts` was `SELECT corpus, COUNT(*) FROM corpus_sections GROUP BY corpus` — a full scan over **17.2M rows** that exceeds the pool's 60s client `query_timeout` on the production Railway→Neon link (it ran in ~1.8s locally against a warm Neon, which masked it). Every 15-min tick threw, so **no breaker was tripped or cleared the whole time** — the safety mechanism was silently dead. The lighter liveness/retry queries after it still succeeded, hence "liveness runs but breakers don't."

- **The fix (`ops.ts`):** that GROUP BY only fed the **informational** `source_status.section_count`/`done_count` columns (written here, read NOWHERE — the email uses the census `corpusCounts` + `corpus_snapshots` directly). So it must never be on the breaker-critical path. `querySourceCounts` now reads per-corpus counts from the **latest `corpus_snapshots` hour** (the census already computes them hourly; PK-indexed, tiny) instead of a live 17M scan, wrapped in its own try/catch — a snapshot miss returns `null` and the UPSERT keeps the prior value (`section_count = COALESCE($3, …)`) but the trip evaluation + `updated_at` refresh **always complete**. The actual breaker decisions never depended on that query (the failure breaker uses a top-5 window; the zero-output breaker uses the 24h `produced_output` streak — both fast).
- **Lesson:** an unread informational query on a safety-mechanism's critical path is a latent outage as the table grows. Keep breaker evaluation off any full-table scan; source counts from the hourly snapshot, not live. **Diagnose from the Ops deploy logs** — the `source_status`/`scheduler_lock` timestamps are necessary but not sufficient (they showed the lock being acquired, which wrongly suggested the eval ran).
- Verified with `v27-breaker-verify.ts` (synthetic `sourceType`, isolated, self-cleaning): evaluateBreakers completes against the live 17M-row DB in ~3s, refreshes `source_status`, and a deliberate failure-breaker trip + clear-and-recover + a zero-output trip all pass. Diagnostics: `v27-breaker-diag.ts`, `v27-railway-ops-logs.ts`.

### CF penalty-boxes listing-walk IPs — enumerate the deterministic path instead (V23)

`www.hansard-archive.parliament.uk` (and the publications.parliament.uk class) CF-penalty-box the **listing/WebForms path** IP for *minutes* after even a small request burst; the box outlives a 4×60s cooloff, so a sustained walk 403s partway and every retry 403s on page 1. **Both local curl builds are Schannel — no TLS-fingerprint lever** (unlike committees-portal where curl's fingerprint helped). The fix is not to fight the listing: the **file/zip path is a different CF surface and is served fine** (V21 proved zip fetches work from Railway). When docIds are deterministic and the host soft-404s absent paths (PK-magic check), **enumerate the docId space directly and let the worker classify soft-404s as markers** — no listing walk needed. S5L Lords (V23): enumerated `S5LV{0033..0606}P0` after confirming no `_a/_b`/`P1` splits exist in range. A resumable curl walk (`listHistoricHansardVolumes` `resumeFile`, per-page VIEWSTATE sidecar) is kept for series that genuinely need the listing as the universe.

### Public inquiries register method (V23)

Statutory/public inquiries are a source family, not a single source — see `docs/INQUIRIES_UNIVERSE.md`. To (re)build the register: (1) gov.uk org enumeration `filter_format=organisation&q=inquiry` then filter titles to inquiry/review (drops pay-review-bodies) — yields the concluded historic backbone (~22); (2) add the major current/recent Inquiries-Act-2005 inquiries by hand (each on its own `*.public-inquiry.uk` domain); (3) the UK Gov Web Archive (`webarchive.nationalarchives.gov.uk`) preserves dark own-sites whole (CF-free, TNA-hosted). **Reports-first, evidence-deferred** — report PDFs are OGL/Crown and modest (~40-70k sections total); evidence bundles are an order of magnitude larger and mixed-licence. Recent inquiries publish report PDFs as gov.uk publication attachments (`/api/content/...` `details.attachments`) — CF-free, the cleanest seed route (build an `inquiry-reports` sourceType with a gov.uk-attachment adapter + a Web-Archive-snapshot adapter).

### A NEW sourceType must be seeded POST-PUSH, never before (V24)

The live `Ingest` process has the **currently-deployed** `process-row.ts`. Seed rows for a sourceType that only exists in your working tree and the live worker claims them (the rate-limiter gives any unconfigured source a default 500ms/4 bucket, so it IS eligible) and hits `dispatchRow`'s `default` → **`markSkipped`** — the rows are burned to a terminal state before your code ever deploys. **V24:** seeding 646 `niassembly-hansard` rows mid-sprint had the old worker markSkipped 95 in ~2 min; deleted all 646 and moved the seed to the post-push run order. **Rule:** build the source client + processor + seeder this sprint, run a LOCAL pilot (the seeder's `--pilot`/`--dry-run` measures without touching the queue), and list the `--seed` step in the handoff POST-PUSH RUN ORDER. Only seed once `commit-all.sh` has deployed the new dispatch case. **Confirm the deploy is live before seeding** by querying the Railway deployments API for the Ingest service — the newest deployment must read `status=SUCCESS` with the just-pushed `meta.commitHash` (V24: deployment `623d386` SUCCESS confirmed in <1 min before seeding; then a `--canary N` seed verified it produced sections before the full seed). (Reusing an already-deployed sourceType — e.g. `govuk-content` for a new corpus — is exempt and can seed immediately.)

### Verify a licence at the licence page, not a footer grep — and watch for JS-SPA archives (V24)

Two verify-before-asserting traps bit the devolved/College work:
- **Footer grep false-positives:** grepping a homepage for `ogl` matched **"g`oogl`e"** (googleapis/googletagmanager) and nearly stamped Senedd OGL-verified — its copyright actually reads "Welsh Parliament 2026", licence unverified. Confirm a licence on the source's **dedicated licence/copyright page** with the full statement, not a substring match on chrome. (NI Assembly verified cleanly: footer literally states "licensed under the Open Government Licence v3.0".)
- **Web Archive snapshots can be JS-SPA shells:** `webarchive.nationalarchives.gov.uk` is CF-free and reliable, but it captures whatever the page served — a modern Drupal/React SPA archives as a shell whose body is "Sorry, you need to enable JavaScript" with no static text. **College of Policing APP:** the fresh 2026 snapshots are JS shells; only pre-redesign 2022 snapshots carry extractable body (~4k words/page, ~4yr stale). Before building a web-archive crawler, fetch one content page and check the **stripped body word count** — an empty body means you need the pre-redesign snapshot generation, a rendered fetch (Playwright), or a JSON API, not a static crawl.

### Ingest liveness (V17)

`Ingest` writes a heartbeat to `ingest_service_state.last_beat` every 30s. `Ops` treats it as stopped when the beat is >10 min old; if pending > 0 it triggers `serviceInstanceRedeploy` (NEVER `deploymentRedeploy` — see §2 and the 9 Jun incident), with a 15-min cooldown between triggers. `starts_count`/`starts_on` track starts per day for the email.

WHY a heartbeat and not deployment status: a deployment whose process exits 0 **still reports `SUCCESS`** via the Railway API (verified 10 Jun 2026) — status cannot distinguish running from cleanly stopped. Also `deploymentStop` silently no-ops; use `deploymentRemove` to stop a running deployment manually.

### pg returns BIGINT columns as strings — coerce at every DB boundary (V17 shakedown)

Symptom: pool worker claims one burst then never claims again; loops report `rate-limited` forever with no suspension set.
Cause: `source_rate_limits.intervalMs` is BIGINT → node-pg returns `"200"` (string). `Date.now() + "200"` string-concatenates into a far-future timestamp, permanently disabling the token bucket after its first claim. TypeScript types said `number`; the runtime value was a string.
Fix: `Number()` coercion in `loadRateLimitConfigs` + defensive guard in `rate-limiter.configure()`.
Lesson: any numeric column read through pg must be coerced (`::int` in SQL, `Number()`/`parseInt` in JS) — TS types on `pool.query<T>` are assertions, not conversions. The local shakedown missed this because the workload (4 rows) was smaller than concurrency (5), so `eligible()` was never re-evaluated after a claim: **shakedown workloads must exceed concurrency**.

### Push to Main auto-deploys `Ingest` and `Ops` (GitHub trigger)

Any push replaces running containers mid-work; variable changes also trigger redeploys. SIGTERM'd claim loops leave rows `claimed` until the 90-min reaper. Expect "extra" deployments you didn't request when verifying.

### TNA caselaw Atom feed is NEWEST-first — refresh by seeding pages 1..N (V18)

Page 1 of `caselaw.nationalarchives.gov.uk/atom.xml` holds the NEWEST judgments; the V4-era "discover pages beyond the last seeded page" logic therefore points at the oldest end and finds nothing. Refresh rule: `missing = getTotalJudgments() − corpus_sections count`; seed pages `1..ceil(missing/50)+1` (idempotent — re-fetched overlap upserts harmlessly). Note the queue is NOT a usable cursor: hourly cleanup deletes done rows after 7 days, which silently erased both the old `page:7489` overhang and the legitimate max-docId cursor. Discovery was retired in V17, so caselaw currency is a periodic manual tail seed (constants in `scripts/attic/v18-verification/cleanup-v18-carryover.ts`) until an ops job exists.

### TNA year-feed pagination bug — eur/eudn/eudr years were capped at 20 items (V2→V17, fixed V18)

`fetchAllPages()` in `tna-legislation.ts` paginated with `?start=N`, which TNA ignores — every request re-served page 1 and the no-new-ids guard stopped enumeration at 20 items/year. Dense `uksi` years were rescued by range-bucket links (`/0-99/data.feed`); **eur/eudn/eudr years have no buckets, so retained-eu was systematically under-enumerated for its entire history.** Fixed V18: follow `<link rel="next">`. Universe sizing without full enumeration: page 1's `<leg:morePages>` × 20. When a corpus looks "complete" suspiciously early, check whether its enumeration ever paginated.

### Cloudflare blocks Railway IPs on parliament committees domains — even with curl (V18, 10 Jun 2026)

curl 7.88.1 was installed in the `Ingest` container (Railpack builder → set service variable `RAILPACK_DEPLOY_APT_PACKAGES=curl`; verified live) and `committees.parliament.uk` AND `publications.parliament.uk` both return the CF "Just a moment…" JS challenge (403) from Railway's IP. The same curl requests pass from a residential IP, so this is **datacentre-IP reputation, not TLS fingerprinting** — the V16.1 curl-spawn approach cannot work from Railway. Options are Charlie-level decisions: local fetch from a residential connection, a proxy egress, or retiring the corpus. The 2,896 empty-done committees-document rows and the committees-portal breaker were deliberately left untouched.

How to run a one-shot container test without pushing code: temporarily `serviceInstanceUpdate` the startCommand to an `sh -c '…curl…; sleep 120'` one-liner, read `deploymentLogs`, restore `npm run worker` (script: `v18-curl-test.ts`).

### Running a long one-off job on Railway — use a DEDICATED service, not the Ingest container (Search S1b, 19 Jun 2026)

For a *short* probe, hijacking the `Ingest` startCommand (above) is fine. For a **multi-hour job** (e.g. the FTS index build, datacenter→R2 bandwidth being the whole point of running it on Railway not a laptop), do NOT run it on the `Ingest` container:
- **Ingest is normally busy** draining the queue; commandeering it stalls the drain for the whole run.
- **Ops liveness will bounce it.** Liveness redeploys `Ingest` via `serviceInstanceRedeploy` whenever `pending>0 && heartbeat stale` (§"Ingest liveness"). A non-worker job on that container writes no heartbeat → liveness keeps redeploying it out from under itself every cooldown.

Instead create a **dedicated service** in the same project/env, git-connected to `Main` with the same `builder: RAILPACK` + `rootDirectory: scripts/ingest` → an **identical build** to Ingest, so a `--limit` canary on it validates the exact environment the full run uses. Ops liveness only targets the Ingest service id, so it never touches the dedicated one. Mechanics (`serviceCreate` → `serviceInstanceUpdate`, all in `scripts/ingest/search/fts-railway-run.ts`):
- `serviceCreate(input: { projectId, environmentId, name, branch: "Main", source: { repo }, variables })` — pass only the creds the job needs in `variables` (the FTS build needs Neon+R2, NOT `RAILWAY_API_TOKEN`).
- `serviceInstanceUpdate` to set `rootDirectory`, `builder: "RAILPACK"`, and a **no-op `startCommand` (`true`)** first — the auto-deploy from `serviceCreate` then builds the image and idle-stops (no compute burn) until you set the real start command + `serviceInstanceRedeploy`.
- **`Ingest` deploys from git** (repoTrigger branch `Main`) — so any new code the job needs must be pushed to `Main` first (`commit-all.sh` before the canary). A dedicated service inherits the same constraint.
- `restartPolicyType` "ON_FAILURE" (default) is right for a resumable job (crash → restart → resume from checkpoint; clean exit 0 → stays stopped). Tear the service down (`serviceDelete`) when done to free compute.

### pwdata per-speech granularity (V18 migration)

`processPwdata` writes one section per `<speech>` (debates/lords/westminhall/wms) or per `<ques>`+`<reply>` exchange (wrans), id `{corpus}:{docId}:{seq}`, with metadata columns `sectionTitle` (major — minor heading), `speaker`, `itemDate`, `parentDocId` (added V18, nullable, no entity_list update yet — CCh). Old day-blob rows are superseded in place (seq 1 overwrites `:1`; `deleteStaleSections` removes leftovers; blob-era rows are identifiable post-hoc as `corpus LIKE 'pwdata-%' AND "parentDocId" IS NULL`).

- **Empty/404 day-files write an `unavailable` marker row** instead of nothing. Without it ~2,520 empty files fell out of the corpus_sections dedup, and weekly queue cleanup + hourly reseed would re-process them forever — exactly the zero-output-breaker food the V17 dedup fix was meant to stop.
- **Encoding:** pre-~2006 pwdata files declare ISO-8859-1; `res.text()` always decodes UTF-8 and silently mojibakes £/accents. `fetchPwdataFile` now sniffs the XML declaration. Named entities (`&pound;` etc. from the pwdata DOCTYPE) are decoded by map, not blanked.
- **Scrape versions — files ≠ sitting days.** TWFY publishes up to ~7 letter-suffixed versions per day (`debates2026-03-02a..f`, 20,010 debates files = 16,017 days) and rewrites superseded files to `latest="no"` on the root element (verified live). The processor writes superseded versions as `unavailable` markers, purges any sections previously ingested under them, and after processing a latest version purges compiled sections of earlier letters of the same day (`deleteSupersededVersionSections`). The blob era ignored this entirely — version duplicates were ingested as separate day-blobs. **Estimate denominators from distinct days × per-day rate, never from file counts.**
- Re-seeding the archive deliberately skips corpus_sections dedup (`bulkInsertQueueRows(..., { resetExisting: true })`) — a granularity migration must re-process ingested files. The hourly ops reseed keeps its dedup.

### GOV.UK Content API source (`govuk-content`, V18)

Used by `hmrc-manuals` (85,197 `hmrc_manual_section` pages — the 626k brief estimate was stale) and `govuk-core-docs` (PACE codes, Treasury books, white papers). `https://www.gov.uk/api/search.json` enumerates (deep paging works ≥84k, verified); `https://www.gov.uk/api/content{path}` returns clean JSON (`details.body` HTML; publications carry `details.attachments` PDFs which are fetched + pdf-parsed, one section per attachment, capped at 20). Rate limit `govuk-content` 150ms / 10 concurrent — GOV.UK asks integrators to stay under ~10 rps; 6.7 rps leaves headroom. 404/410 → `unavailable` marker (gov.uk reorganises URLs; deterministic 404s must not retry). There is no `white_paper` document type — white papers are `policy_paper` filtered by title. `order=` only accepts sortable fields — `order=link` is HTTP 422 (found on first seeder run; use `public_timestamp` for deterministic deep paging).

### Pre-1963 acts are regnal, not calendar — enumeration regex dropped them all (V2→V18, found V19)

Pre-1963 ukpga feed `<id>`s are regnal-session URIs (`…/id/ukpga/Geo5/14-15/41`); the calendar identity lives in `<ukm:Year>`/`<ukm:Number>` entry attributes. `listActIds`' regex (`{type}/{year}/{number}`) silently dropped every regnal id, so pre-1963 acts were **never enumerable by discovery** — the only pre-1963 rows came from the Neon legacy seed in calendar form. A calendar id is not even addressable for many of them: `ukpga/1924/3` is HTTP **300 Multiple Choices** (two different acts are both "1924 chapter 3" under different sessions); others 301 to `/resources/data.xml` (a metadata page, not CLML). Use `listActEntries()` (V19) which returns `{docId (canonical/regnal), calendarId}` per entry, and seed regnal docIds. Regnal CLML works: `ukpga/Vict/24-25/100/data.xml` (OAPA 1861) returns the full revised act; textless old acts 307 to `/enacted/data.xml` shells that classify via hasNoProvisions.

### TNA `data.htm` fallback captures site chrome as "compiled" content (V2→V18, found V19)

For acts with no digitised text, `{actId}/data.htm` redirects to the act's **landing page** — ~834 words of pure site chrome, zero body text. 5,840 pre-1963 acts were silently ingested this way and marked `compiled` (uniform wordCount ~826–840 was the tell; real acts vary wildly). Real legislation HTML carries `LegRHS`/`LegP1ParaText` body markers; chrome pages carry none. `enumerateSections` (V19) rejects marker-less HTML so textless acts fall through to PDF → classified `unavailable`. **Detection heuristic for any HTML-scraped corpus: near-zero stddev on wordCount across thousands of docs = boilerplate capture, not content.**

### FCL per-court feeds + phantom `rel="last"` (V19)

Tribunal courts (eat, ukut/{tcc,iac,lc,aac}, ukftt/{tc,grc}, ukpc, ukiptrib) are only fully enumerable via `atom.xml?court=…` — the global feed carries just their newest entries. `rel="last"` is phantom on BOTH the global feed (claims 7,508 pages; pages >~1,500 are empty) and per-court feeds (eat claimed 80 pages; true extent 16). Binary-search the true last non-empty page (the V4 pattern) before seeding page rows, or you seed empty-page rows that feed the zero-output breaker. Queue row docId: `court:{code}:page:{N}` (V19 `processTnaCaselaw`).

### Seed rows that need new processor code ONLY after the push (V19 recurrence)

Push to Main auto-deploys `Ingest`; until then the running container has old code. V19 seeded 180 `court:…` caselaw rows before pushing — the old processor `markSkipped`'d all of them within minutes (exactly what the V18 seeder headers warn about: "RUN ONLY AFTER THE PUSH"). Recovery is cheap (reset skipped rows to pending post-push) but the rule stands: **config-only changes (rate limits) can be applied live; rows whose docId format or sourceType the deployed code doesn't know must wait for the deploy.**

### Postgres regex `\d` silently matches nothing via the pg driver — use `[0-9]` (V19)

`SELECT '1873' ~ '^\d+$'` returns **false** on Neon via node-pg (the `\d` reaches the server as a literal backslash-d in a standard-conforming string and POSIX regex treats it as an escaped `d`... empirically: it does not match). `[0-9]` works everywhere. Any corpus-audit SQL using `~ '\d'` classifies everything as non-numeric — V19's first primary-acts audit "found" 0 calendar docs because of this. Use `[0-9]` character classes in all SQL regexes.

### Pool rate-limiter race: instant failures ran sources at 20× their configured rate (V17→V19, fixed V19)

The V17 claim loop checked `eligible()` → awaited the claim query (100–300ms) → only then `recordClaim()` consumed the token. Every idle loop saw the same free token during that window. Invisible when rows take seconds (loops stay busy; concurrency caps bind); **catastrophic when rows fail instantly**: a 429 storm idles all 20 loops, they race every token, and the "rate-limited" source runs at 20×+ its configured rate — which keeps the upstream penalty box alive. Observed live 11 Jun 2026: govuk-content configured 300ms/5 ≈ 3.3 rows/s, measured **24 fails/s**, ~5k et-decisions rows burned in minutes; gov.uk never got relief. Also explains the V18 TWFY 503 storm's severity. Fixed V19 in `ingest-pool.ts`: (1) **reserve-then-claim** — pick one eligible source, `recordClaim()` BEFORE the async claim, release the slot on an empty claim; (2) **in-process 5-min source suspend on HTTP 429/503** so storms stop immediately instead of burning until the 15-min breaker sweep. Burned rows are `status='failed'` with HTTP 429 errors — reset to pending after the upstream cooloff and the fix deploy.

### Long enumerations: log to a file per unit, checkpoint per unit (V19)

The first retained-eu enumeration ran 2h with zero output: stdout was piped through `grep -v` (block-buffered, nothing visible until exit) and the only log line was scheduled for the END of a 68-year range. Rerun with per-year checkpoint + per-year log line showed ~2–40s/year and surfaced that dense eur years (1976: 3,195 instruments) far exceed the morePages-derived estimate. Rule: background enumeration scripts write progress per smallest natural unit directly to a file (`> x.log 2>&1`, no pipes), and checkpoint at the same granularity so reruns resume.

### Killing a `cmd | grep` background pipeline orphans the node process on Windows (V19)

Stopping the "wedged" first retained-eu run killed the *grep* stage; the node process survived headless, finished its full 153k-instrument enumeration, and inserted 149,480 queue rows two hours later — while two replacement runs were assuming a clean slate. The inserts were idempotent so the union was harmless (and run 1's universe was actually the most complete — it enumerated before TNA started 429ing), but only by luck. Rules: (1) background long-runners must not be pipelines — redirect to a file; (2) after stopping a background task, verify the node PID is actually gone (`tasklist | findstr node` / `ps`); (3) design every seeder so a surviving orphan is idempotent — ON CONFLICT DO NOTHING is what made this incident a footnote instead of a corruption.

### retained-eu true universe is ~153k instruments, not ~33k (V19 measurement)

The V18 morePages-derived estimate (~32,970) undercounted dense years badly; full entry-count enumeration found **eur ~95k+ / eudn ~27k / eudr ~3k — union ~153k instruments** (TNA mirrors the complete EU corpus to IP-completion day, mostly spent/expired instruments). The approved "bounded ~2h" completion pass is really ~36h of TNA fetching at 200ms/10 (the long-tolerated rate) — left running V19; ~93% will classify as hasNoProvisions shells (V18 sample), so the **140k phantom denominator may land accidentally close**. Re-baseline ✓ at drain per §1c.

### Deep-pagination offset walks die server-side — window by date instead (V22, 13 Jun 2026)

committees-api's WrittenEvidence walk (126,589 items, `Skip`/`Take`) failed from skip≈100,000 with socket-level "fetch failed"; probing showed **HTTP 500 after ~31s — a server-side query timeout that is LOAD-DEPENDENT** (skip=100000 failed 12 Jun; skip=50000 failed 13 Jun; skip=0 always fine). An offset walk over a big API table is fundamentally fragile past tens of thousands. Cure: **date-windowed listing** — the API takes `StartDate`/`EndDate`; within a month-sized window Skip stays shallow (~2k items max) and the same query answers in ~2s. One queue row per window (`list:{kind}:win:{YYYY-MM}`), inserts idempotent, 1-day window overlap harmless. Rule: when an API offers any date/range filter, never plan an unbounded offset walk deeper than ~10k.

### AdaptiveThrottle suspend path was dead code — ceiling < suspendThreshold (V20→V22, found 13 Jun 2026)

Sources constructed `AdaptiveThrottle({ suspendThresholdMs: 60_000 })` without raising the default 30s ceiling: `delay = min(ceiling, delay*2)` could never reach the threshold, so `onSuspend` (the `suspendSource` write) NEVER fired. This is why judiciaryni's 12 Jun IP-cut burned 332 rows at full configured speed instead of suspending. Fixed (ceiling 120s) in judiciaryni/committees-api/echr/hh-html clients; also: socket-level fetch failures and 403s now call `backoff()` — an IP cut does not announce itself as a 429.

### judiciaryni listing budget is ~30 pages per IP session (V20→V22)

Local walks cut at p66 (12 Jun) and p96 (13 Jun) even with 60s-cooling retries; the cut lifts after hours. Decision pages and PDFs are served normally at low rates — only sustained LISTING walks trip it. Cure: `list:page:{N}` queue rows drip one listing fetch per claim from Railway (V22; same pattern as committees `list:` and TNA `enum:` rows). Rate halved to 2000ms/1.

### Seeders must not write corpus_targets ests from partial walks (V20 rule, V22 recurrence)

The 13 Jun judiciaryni seeder resume clobbered est 5,900 → 1,879 when the host cut it at page 96 — the V20 committees lesson exactly. Fixed: est updates only on a COMPLETED walk (past-the-end detection), and from a queue-row count, not the run's incremental total. When writing any seeder: the est-update branch must be unreachable from the "stopped early" path.

### HUDOC revival routes (V22)

`/app/query/results` works with **browser UA + Referer** and the `contentsitename:ECHR AND respondent:"GBR" AND languageisocode:"ENG"` grammar (4,471 GBR ENG docs, 13 Jun 2026; the V-era `country:GBR` grammar 404s — a wrong FIELD name draws 404, not 400). Stable pagination needs `sort=kpdate Ascending`. Document text: **only the PDF conversion route works** (`/app/conversion/pdf/?library=ECHR&id={itemid}`); html/docx conversions 404. Licence echr-nc (verified: free reproduction with © ECHR-CEDH attribution for information/education; commercial needs permission).

### Historic Hansard per-house cutoffs + HTML gap-fill (V22)

The pwdata handoff is per-house and EXACT: Commons 1919-02-04 (S5C ≤ 111), Lords 1999-11-17 (S5L ≤ 606 — vol 607 starts that day; verified via api.parliament.uk volume indexes + TWFY lordspages first file). Bulk-archive gaps: 170 volumes missing for 1803–1918 caps, of which only **114 exist on api.parliament.uk/historic-hansard** (S1/S2 wholly unfillable — both stores share the same digitisation gaps; the V21 "169 exist on the HTML site" was unverified and wrong). Gap-fill = two-stage queue crawl (`gapvol:` → `gapday:` rows, sourceType `historic-hansard-html`, own host budget 500ms/2).

## 8b. PRE-V17 FAILURE PATTERNS (fleet era — kept for reference)

Most patterns below concern the retired 20-worker fleet, the separate scheduler/monitor, or Railway-DB queue tables. The diagnostics remain instructive; the named files now live in `scripts/attic/v17-fleet/`.

### DB / Volume

| Incident | Cause | Fix |
|----------|-------|-----|
| Railway DB ECONNRESET locally | Railway blocks external connections during high load / post-crash | Retry after a few minutes; or use Railway dashboard → Query tab for SQL |
| All 20 workers CRASHED simultaneously | Railway PostgreSQL volume hit capacity limit (was 5GB, resized to 20GB) | Resize volume in Railway dashboard → wait for DB SUCCESS → staggered worker restart |
| Workers CRASHED immediately after volume resize | DB container still recovering; workers reconnected before DB ready | Wait 2–3 min after `scrutinise-db` shows SUCCESS, then restart workers |
| `compiledText` DB column bloat | 10KB compiledText per section × 750k+ rows = ~1.6GB | Column dropped in V3; now R2-only. Never re-add `compiledText` to schema. |
| Railway DB crashes periodically — requires redeploy | **OOM kill**, not connection exhaustion. `max_connections=100`; 20 workers peak at ~46 connections (fine). Postgres container memory-killed under peak write load | Redeploy `scrutinise-db`; upgrade Railway Postgres plan for more RAM; OR migrate queue to Neon. Do NOT run local scripts (reseed-deep.ts etc.) against Railway DB — they add ambient connection pressure. Diagnosis: check Railway `scrutinise-db` Metrics tab for memory spike at crash time. |
| Railway DB crash after mass `serviceInstanceRedeploy` | `serviceInstanceRedeploy` on all 21 services triggers fresh builds; new scheduler instance opens a new PrismaClient pool to Railway DB while old instance may not have disconnected cleanly; combined with any simultaneous crash-looping workers making stale Railway DB connections = connection/OOM spike | After mass redeploy: immediately check `SELECT count(*), state FROM pg_stat_activity GROUP BY state;` on Railway DB. If >30 connections: kill the scheduler (`serviceInstanceRedeploy` on `Ingest-scheduler` alone, wait for SUCCESS) to drain the PrismaClient pool. **Root fix: remove `queryFormatBreakdown`/`queryUnrecognisedFormats` from `scheduler.ts`** — these connect to Railway DB via `new PrismaClient()` but query an empty table (corpus_sections is on Neon since V16). |
| `deploymentRedeploy(id)` runs old code, not latest Main | If called on a REMOVED or old deployment, Railway reuses that deployment's source — not the current Main branch commit | Always verify deployment `createdAt` timestamp before calling `deploymentRedeploy`. If you want latest Main code: use `serviceInstanceRedeploy`. Check the distinction in §2. |

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
| No progress emails — scheduler silent | Scheduler was redeployed and either: (a) crash-looping, (b) PrismaClient to Railway DB is hanging because Railway DB is down, (c) scheduler_lock held by dead instance | Check `Ingest-scheduler` Railway logs. If Railway DB is down, scheduler hangs at `queryFormatBreakdown()`/`queryUnrecognisedFormats()`. Fix: restart Railway DB first, then restart scheduler. Root fix: remove those two Railway DB queries from scheduler. |
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

### Worker crashes on transient DB error — ECONNRESET in main loop (V14 post-session)

**Symptom:** All workers go to NO_DEPLOY simultaneously. DB appears to be "offline" but is actually healthy (connecting with 2 connections proves it). Workers crash and exhaust ON_FAILURE retries in minutes.

**Cause:** `claimNextChunk(workerId)` in the main `while(true)` loop of `worker-queue.ts` was not in a try/catch. Any transient Railway TCP proxy drop (ECONNRESET/ETIMEDOUT) caused `main().catch → process.exit(1)`. All 20 workers exit simultaneously. Railway ON_FAILURE retries 3× each — all fail if the DB is still recovering — services go to NO_DEPLOY.

**Fix (V14 post-session, `8d546f0`):** Catch `ECONNRESET`/`ECONNREFUSED`/`ETIMEDOUT`/`Connection terminated` from `claimNextChunk()`. Sleep 30s and retry — `pg.Pool` reconnects automatically on next query. Also `.catch()` on `markFailed()` and `writeCheckpoint()` so those can't exit either.

**Important:** This was misdiagnosed as a "DB crash" because workers exiting abruptly causes all their connections to drop simultaneously, making Postgres appear down. Charlie was restarting the DB unnecessarily — the DB itself was healthy.

---

### Monitor infinite reseed loop (V14 — 9 Jun 2026)

**Symptom:** Workers processing rows but nothing appears in corpus_sections; pending count stays constant or rises despite workers being active and claimed.

**Cause:** `reseedPartialItems()` in `monitor.ts` reseeds items where section_count < CORPUS_THRESHOLDS[corpus]. Two triggers:

- **(a) Corpus missing from CORPUS_THRESHOLDS** — falls to `default: 3`, wrongly flags short 1-section Acts (e.g., NI regional Acts, retained-eu instruments) as partial. Every monitor cycle reseeds them.
- **(b) hasNoProvisions items always have 0 compiled sections** — they have `availability_status != 'full'` and no r2Key, so the Neon count query returns 0 for them. 0 < any threshold → reseeded every 15 minutes forever.

**Scale:** 36,983 completed items were in false-positive pending state, blocking all 20 workers for an entire day.

**Fix applied (V14):**
1. Added `regional: 1` and `retained-eu: 1` to `CORPUS_THRESHOLDS`.
2. Added `availability_status != 'full'` exclusion to the Neon count query — classified unavailable items are never counted as partial.
3. Added second Neon query in `reseedPartialItems()` that fetches all govUkIds with `availability_status != 'full'` and excludes them from the reseed candidate set.
4. Cleared 36,983 false-positive pending rows via SQL.

**Rule: when adding any new corpus to the ingest pipeline, always add it to `CORPUS_THRESHOLDS` before deploying.** If unsure of the right value, use 1 (only reseed items with 0 compiled sections — genuine crashes, not short Acts).

**Diagnostic SQL (Railway):**
```sql
-- Check if pending rows are monitor-reseeded false positives
SELECT COUNT(*) FROM ingest_queue
WHERE status = 'pending'
  AND "lastError" = 'reseeded by monitor — partial section count detected';

-- Clear false positives (after fixing CORPUS_THRESHOLDS)
UPDATE ingest_queue SET status = 'done', "lastError" = NULL
WHERE "lastError" = 'reseeded by monitor — partial section count detected'
  AND status = 'pending';
```

---

### fetch() with no timeout blocks workers indefinitely (V14 — 9 Jun 2026)

**Symptom:** Workers show as claimed in the queue; `claimedAt` age grows past 90 minutes. Railway CPU shows near-zero. No Neon section writes. Workers appear idle but are not.

**Cause:** Node.js `fetch()` with no `AbortController` — a server that accepts the TCP connection but never sends a response will block the worker process indefinitely. There is no default timeout in Node.js `fetch`. This affected `fetchText()`, `fetchBinary()`, and `headRequest()` in `tna-legislation.ts`. Workers were blocked for hours on TNA requests for old NISR items (pre-1980).

**Fix applied (V14):** Added `withTimeout(ms)` helper returning `{ signal, clear }`. All three fetch functions now pass `signal` to `fetch()` and call `clear()` in both success and catch paths. Timeouts: 30s for text/binary, 10s for HEAD requests.

```typescript
// Pattern — always use this for any new fetch in ingest scripts
const { signal, clear } = withTimeout(30_000)
try {
  const res = await fetch(url, { signal, headers: { ... } })
  clear()
  // ... handle response
} catch (err) {
  clear()
  // ... handle error (AbortError means timeout)
}
```

**Rule: every `fetch()` call in any ingest script must use `AbortController` with an explicit timeout.** Never rely on TCP-level or OS-level timeouts — they are not guaranteed to fire.

**Files fixed so far:** `tna-legislation.ts` (V14), `eurlex.ts` (V14 post-session). Remaining files still need fixing: `bailii-scraper.ts`, `echr-hudoc.ts`, `fca-handbook.ts`, `gov-scraper.ts`, `law-commissions.ts`, `oecd-free.ts`, `parliament-api.ts`, `theyworkforyou.ts`, `tna-caselaw.ts`, `twfy-pwdata.ts`, `uk-treaties.ts`.

**Per-row safety net (V14 post-session):** `worker-queue.ts` wraps every `processRow()` call in `Promise.race` with a 5-minute timeout. Any source file that hangs is capped at 5min — the row is marked failed and the worker moves on. This protects against all unfixed source files.

**Diagnostic:** If claimed age > 90 seconds and completions = 0, workers are hanging on source HTTP calls. Reset claimed rows and redeploy.

```sql
-- Reset all stale claimed rows
UPDATE ingest_queue SET status = 'pending', "claimedBy" = NULL, "claimedAt" = NULL
WHERE status = 'claimed';
```

---

### Parliamentary Committees portal — alternative to blocked api.parliament.uk (V15)

**Background:** `api.parliament.uk/v1/committees` returns HTTP 403 from Railway IPs. This has been the case for all of 2026 and is not expected to change.

**Alternative:** `committees.parliament.uk/publications/` is freely accessible. This is the public Parliament portal with the same data.

**Access requirement:** A browser-like User-Agent header is required to bypass Cloudflare bot detection. Plain `fetch()` without headers returns HTTP 403. Adding `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36` returns HTTP 200 with full HTML. No JS rendering needed.

**Endpoints confirmed working (9 Jun 2026 V15):**
- `committees.parliament.uk/publications/reports-responses/?page=N` — 9,959 reports, 498 pages
- `committees.parliament.uk/publications/other-publications/?page=N` — 40,794 items, ~2,040 pages

**Content structure:** Each publication card contains title, committee name(s), published date, paper number (HC/HL), publication type, PDF URL (relative → absolute via committees.parliament.uk redirect), HTML URL (absolute on publications.parliament.uk).

**HTML content:** `publications.parliament.uk/pa/...` pages are directly accessible, no auth, no Cloudflare issue.

**Source client:** `scripts/ingest/sources/committees-portal.ts`
**Seeder:** `scripts/ingest/seed-committees-queue.ts`
**sourceType:** `committees-portal` (max 3 concurrent, 500ms interval)

---

### LDA 524 permanent page failures — pageSize fix + specialist-queue archival (V15)

**Root cause of LDA 524s:** `lda.data.parliament.uk` uses a Cloudflare proxy in front of Parliament's database. Written questions have large result sets — with `pageSize=500`, the database query times out before Cloudflare's 100s limit, returning HTTP 524. The existing fallback (retry with `pageSize=100`) only fetches a partial slice of the page, not the full offset range.

**Permanent fix (V15):** `processLda` in `worker-queue.ts` now passes `pageSize=100` for `writtenquestions` corpora at all times (not just as a 524 fallback). This means 5× more requests but each succeeds within the timeout window.

**Specialist-queue archival:** After `MAX_524_RETRIES` (3) attempts, a LDA row that still returns 524 is marked with error prefix `specialist-queue:` — this prevents `resetRetryableFailures()` in `monitor.ts` from resetting it indefinitely. The row stays as `failed` and is visible in the email ISSUES section for future investigation.

**Reset SQL (run after deploying V15 code to pick up pageSize=100 fix):**
```sql
UPDATE ingest_queue
  SET status = 'pending', "lastError" = NULL, "claimedBy" = NULL, "claimedAt" = NULL
WHERE status = 'failed'
  AND corpus IN ('lda-commonswrittenquestions', 'lda-lordswrittenquestions')
  AND "lastError" NOT LIKE 'specialist-queue:%'
  AND ("lastError" LIKE '%524%' OR "lastError" LIKE '%timeout%');
```

---

### Connection pool exhaustion signature — workers in ECONNRESET retry loop (V15)

**Symptom:** Multiple workers show this pattern simultaneously in Railway logs:
```
[worker-N] DB connection error — sleeping 30s before retry: Error: read ECONNRESET
[worker-N] DB connection error — sleeping 30s before retry: Error: read ECONNRESET
```
Workers are NOT crashing (they sleep and retry). But they cannot connect to the DB. The pattern repeats every 30s.

**Cause:** Railway Postgres has a hard limit on simultaneous connections (~100 across all services). When workers are redeployed and have not yet been updated to the `max: 2` pool cap (`eac98af`), each worker holds multiple connections. 20 workers × 5 connections = 100 connections → pool exhausted → new workers ECONNRESET.

**Diagnosis:** Run in Railway dashboard Query tab:
```sql
SELECT COUNT(*) as connections, state, application_name
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state, application_name
ORDER BY connections DESC;
```
If total connections > 80, pool is near capacity. Check `application_name` — workers show as `pg_node`. If many connections from old code (no `max: 2` cap), trigger redeployment.

**Fix:** Workers with the V14 `max: 2` pool cap fix (`commit eac98af`) will release connections back. Workers running old code need redeployment. Once connections drop below 80, ECONNRESET workers will reconnect automatically on their next 30s retry — no manual action needed.

**Distinction from DB crash:** When DB is down, ALL connections fail immediately. In pool exhaustion, some workers ARE connected (the ones holding connections). DB health: run `SELECT 1` from Railway dashboard — if this works, DB is healthy and it is a pool exhaustion problem, not a DB crash.

---

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

### V25 patterns (16 Jun 2026)

**Redirect-classified id-space enumeration (Senedd).** When a site's only listing is a
JS-driven search that won't return a bulk list (record.senedd.wales), enumerate by walking
the numeric id space and classifying each id by its redirect target. `/Meeting/{id}` 302s to
`/Plenary/{id}` (plenary) or `/Committee/{id}` (committee); a `redirect:'manual'` fetch reads
the `Location` header without pulling the body. Keep the ids whose target matches the type you
want. Cheap on a no-CF host; concurrency-limited. The "recent" end of the id space can hold
FUTURE scheduled-but-empty meetings (0 contributions) — skip empties in pilots; the processor
writes a no-content marker for them.

**Bilingual transcripts — take one language deterministically.** Senedd contributions carry
`verbatim` (as spoken, Welsh or English) + `translation` (English, present only when spoken in
Welsh). For an English FTS corpus: prefer `translation`, fall back to `verbatim`. Picking one
keeps section counts honest (don't emit both).

**UK Gov Web Archive route (College APP).** CF-free, TNA-hosted — Railway-safe. Two pieces:
- **CDX enumeration:** `…/ukgwa/cdx?url={host}/{path}*&output=text&filter=statuscode:200&filter=mimetype:text/html&from=YYYYMMDD&to=YYYYMMDD&limit=50000`. `collapse=urlkey` does NOT reliably dedupe here — dedupe yourself by normalised original URL, keeping the LATEST timestamp. Drop `?`-query variants.
- **Raw-capture fetch:** `…/ukgwa/{timestamp}id_/{originalUrl}` — the `id_` modifier returns the ORIGINAL bytes (no archive banner / link-rewriting), so text extraction is clean. Record the snapshot date as `itemDate` so staleness is visible. Use this when a live site is CF-blocked or has gone JS-SPA (College: 2022 = last static-HTML snapshots; 2023+ = JS shells).

**Parliament JSON APIs — use `files[]` (API-hosted Download), not `links[]` (Bills).** The Bills
API publication objects carry both `files[]` (download via `/Publications/{pubId}/Documents/{docId}/Download`,
reliable) and `links[]` (external parliament.uk / data.parliament.uk URLs — HTML index pages
mislabelled application/pdf, dead URLs, scanned image PDFs with no text). Only `files[]` is
dependable. Older bills with only `links[]` yield 0 sections — acceptable, their enacted text is
already held via legislation.gov.uk.

**Two-stage list→per-item for fan-out rows (Bills, reuse of committees-api).** A single bill can
carry hundreds of publication PDFs (bill 3774 = 267) — far too many to extract within one row's
5-min budget. Seed `list:{billId}` rows; the worker enumerates that bill's PDFs into per-PDF
content rows (`{billId}#{seq}|{url}`); each content row extracts ONE PDF → one section. Same shape
as the inquiry-reports per-PDF rows and the committees-api `list:` windows.

**Railway-egress blocks → local one-shot ingest (College / web archive).** `webarchive.nationalarchives.gov.uk` blocks/challenges Railway egress IPs: the worker got 257/332 "archive fetch failed" while the identical `id_` capture returned 200 from a residential IP (burst-tested) — same class as committees.parliament.uk's CF block. For a SMALL, STATIC blocked corpus the fix is a **local one-shot ingest** that does the worker's job from a reachable IP — fetch + extract + `r2Put` + `upsertSection` + `markDone(id, fmt, true)` — idempotent via an `r2Exists` skip. Template: `scripts/ingest/v25-ingest-college-local.ts`. Rule of thumb: CF-fronted or nationalarchives hosts often block cloud egress; CF-free custom gov hosts (record.senedd.wales, niassembly IIS) are typically Railway-reachable — but VERIFY with a small canary before assuming, and never let a fetch-failure path silently classify "blocked" as "empty/not-found".

**High-throughput id/redirect scans throttle hosts — be polite + retry (Senedd).** Enumerating a 16k id space at concurrency 6 provoked record.senedd.wales into timeouts/5xx; the classifier's `catch→'gap'` then false-negatived real plenaries (found 396 vs the true 713). Fix: concurrency 2–3, the classifier RETRIES transient failures and returns a distinct `'error'` (never a false negative), the seeder re-scans error ids serially, and the final bulk insert is wrapped in a retry (a transient Neon DNS blip otherwise discards the whole scan). Always separate "transient failure" from "genuinely not the thing you want".

**gov.uk publication slugs — search, don't guess (inquiries).** To find a concluded inquiry's
report publication page, query the gov.uk search API (`https://www.gov.uk/api/search.json?q=…&fields=link`)
and verify the slug resolves (content API `details.attachments` → PDFs). Slug-guessing hit ~5/23;
the search API found the rest. The publication-attachments route gives REPORTS-ONLY for free
(the page lists only the official report volumes, not the separate evidence bundles).

---

## 9. SOURCE ACCESS PRIORITY ORDER

For every new corpus, test access methods in this order before writing a client:

### 1. Bulk download (always try first)
Single file or directory of files (XML, CSV, JSON). Fastest, no rate limits, no connection
pressure during download phase. Workers open a DB connection only when writing — not during fetch.

Check: `sitemap.xml`, `/data`, `/bulk`, `/downloads`, `/open-data`, `/pwdata`

Examples already in pipeline:
- TWFY pwdata XML (`theyworkforyou.com/pwdata/scrapedxml/`) — wrans, debates, lords, WMS
- TNA legislation XML (`legislation.gov.uk/ukpga/...`)
- EUR-Lex CELLAR SPARQL export

### 2. HTML scraping (second choice)
Paginated HTML with predictable URL patterns. No API key, usually no rate limiting, simpler
than API. Works when the public website has a search/browse page.

Check: does the public website have a `/search`, `/browse`, or `/publications` page?

Examples already in pipeline:
- `committees.parliament.uk/publications/` (replaces blocked api.parliament.uk/v1/committees)
- `sentencingcouncil.org.uk` (embedded JSON on HTML page)

### 3. REST/GraphQL API (only when 1 and 2 are unavailable or incomplete)
Use only for ad hoc queries or when bulk/HTML is genuinely unavailable. APIs are designed
for individual record lookup, not bulk ingestion. Rate limited, key required, single-request
oriented.

Examples:
- LDA Parliament API — **replaced by TWFY bulk XML for written questions (V16)**
- FCA Handbook `api-handbook.fca.org.uk` — no bulk alternative found

### When an API is blocked or failing

Immediately search for a bulk download or HTML alternative before debugging the API.
Most UK government data is published in bulk (GOV.UK open data, Parliament pwdata, TNA feeds).

**Never use a paginated API for bulk historical data** if a bulk download covers the same
content. A paginated API over 600,000+ records will always hit timeouts, rate limits, or
memory issues. The LDA written questions experience is the canonical example: 618,599 records
required 1,238 separate API pages at 100 records each; TWFY wrans XML covers the same data as
flat daily files that each need a single HTTP fetch.

### TWFY bulk XML written answers — coverage note (V16)

`pwdata-wrans` (Commons written answers from 2001) and `pwdata-lordswrans` (Lords written
answers) provide the same content as lda-commonswrittenquestions and lda-lordswrittenquestions.
`pwdata-wrans` directory files confirmed at `theyworkforyou.com/pwdata/scrapedxml/wrans/`.
LDA written questions corpora retired in V16 — see §10 corpus status table.

---

## 9a. QUEUE MIGRATION TO NEON (V16 — 9 Jun 2026)

### Background

Railway Postgres OOM crash (V15 diagnosis) was caused by 20 workers holding persistent
connection pools simultaneously under peak write load. The fix is architectural: migrate
`ingest_queue` and all operational tables to Neon (which uses PgBouncer for connection
multiplexing), and switch workers to connection-per-transaction (open only when writing).

### Tables migrated from Railway → Neon

| Table | Purpose |
|-------|---------|
| `ingest_queue` | Queue rows — main worker work queue |
| `source_rate_limits` | Per-source rate limit config and token bucket |
| `specialist_queue` | Commencement/pdf-only items for future specialist workers |
| `scheduler_lock` | Mutex preventing duplicate scheduler runs |
| `ingest_progress_snapshots` | Per-worker throughput snapshots for email |

After migration, **Railway Postgres holds only Prisma app tables** (LegislationSection,
OperationalSection, User, Idea, etc.). Ingest workers and scheduler no longer connect
to Railway DB at all.

### Migration procedure (one-time, non-reversible)

**STEP 1 — Stop all 20 workers** (Railway dashboard → each worker → stop, or via API).
Workers must not be writing to Railway queue during migration. The migration script checks
for active claimed rows and aborts if any are found within the last 5 minutes.

**STEP 2 — Run migration script:**
```
NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
  --tsconfig scripts/tsconfig.json scripts/ingest/migrate-queue-to-neon.ts
```
Script creates Neon tables if they don't exist, copies data in batches of 500 with
ON CONFLICT DO NOTHING, checkpoints to `migrate-queue-checkpoint.json`.

**STEP 3 — Verify row counts** match between Railway and Neon (reported by script).

**STEP 4 — Redeploy all workers and scheduler** (staggered restart via
`restart-workers-staggered.ts`). Workers now write to Neon queue automatically — the
code change (queue-client.ts NEON_DATABASE_URL, V16) was deployed in this step.

### Code changes in V16

| File | Change |
|------|--------|
| `shared/queue-client.ts` | `DATABASE_URL` → `NEON_DATABASE_URL` in `getPool()` |
| `shared/progress-reporter.ts` | `DATABASE_URL` → `NEON_DATABASE_URL` in `getPool()` |
| `monitor.ts` | `DATABASE_URL` → `NEON_DATABASE_URL` in `runMonitor()` pool |
| `seed-rate-limits.ts` | `DATABASE_URL` → `NEON_DATABASE_URL` |
| `workers/worker-queue.ts` | Removed ECONNRESET retry loop — clean exit; Railway restarts with jitter |

### ECONNRESET retry loop removal

The V14 ECONNRESET catch in worker-queue.ts was added because Railway Postgres TCP proxy
occasionally drops connections. With queue on Neon+PgBouncer, this is no longer relevant.
Any unhandled DB error from `claimNextChunk` now propagates to `main().catch → process.exit(1)`.
Railway restarts the worker; startup jitter staggers reconnections. Clean exit is safer than
a 30s retry loop that keeps broken connections alive (was contributing to OOM).

### Scripts that still use DATABASE_URL (Railway) directly

These diagnostic/backfill scripts were not updated in V16 — they operate on Railway app tables
(corpus_sections on Railway is fully gone since V3 TRUNCATE) or are one-off tools. Update them
to NEON_DATABASE_URL before re-running if they need queue data:

`classify-no-provisions.ts`, `check-scheduler-lock.ts`, `retry-failed.ts`, `run-cleanup.ts`,
`diag-has-no-provisions.ts`, `census/live-census.ts` (has both URL patterns already).

---

## 10. DB SIZE MONITORING

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

## 11. QUICK REFERENCE — CORPUS STATUS (as of 8 Jun 2026)

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

## 12. LESSONS LEARNED — V10 SESSION (7 Jun 2026)

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

## 13. LESSONS LEARNED — V11 SESSION (7 Jun 2026)

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

## 14. LESSONS LEARNED — V12 SESSION (8 Jun 2026)

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

---

## 15. JURISDICTION ONBOARDING CHECKLIST (V17 skeleton)

The repeatable path for adding a new jurisdiction/corpus. Each step gates the next; do not skip the shakedown.

1. **Manifest** — add the corpus to `corpus_targets` (corpus_key, display_label, est_sections if known, priority). Unconfirmed estimates stay `est_is_confirmed = false`.
2. **Source survey** — establish access in this priority order (see §9): bulk download → HTML scraping → REST/GraphQL API → PDF extraction. Verify from a Railway-like environment, not just a residential IP (Cloudflare TLS fingerprinting and IP blocks differ — see committees history).
3. **Adapter** — source client in `scripts/ingest/sources/`, processor case in `workers/process-row.ts`, seeder script. Follow the R2 key scheme (§7) and `rawToText()` rule.
4. **Rate limits** — add a `source_rate_limits` row (intervalMs + maxConcurrentWorkers). Unknown upstreams default to 500ms / 4 in-process.
5. **Shakedown at low concurrency** — seed a small batch, run `Ingest` with `WORKER_CONCURRENCY=5`. Verify **sections, not statuses**: `corpus_sections` delta must match expectations. Include adversarial fixtures (curly quotes, em-dashes, accents, very long docs).
6. **Breaker thresholds** — confirm the defaults (5 consecutive failures / 25 zero-output) suit the source; sources with many legitimately empty items may need a documented exception.
7. **Playbook entry** — record the source's quirks (auth, pagination, error modes) in §8/§9 and update `corpus_targets` estimates to confirmed once the full run completes.

---

## 16. TAX-SOURCE MAP (V19 — the IBFD-replication layer)

IBFD's replicable layer is aggregated public primary sources; their commentary is proprietary and out of scope (Lex generates analysis; we never ingest IBFD content). Universe sizes measured live 11 Jun 2026.

| Layer | Corpus | Source / route | Universe | Status |
|---|---|---|---|---|
| Tax statutes | primary-acts-*, si-* | TNA CLML | (in corpus) | ✓ long-standing |
| HMRC manuals | `hmrc-manuals` | govuk-content, `filter_format=hmrc_manual_section` | 85,197 | ✓ complete (1:1 rows:sections verified V19 — the brief's "16,061 zero-section rows" was a stale mid-ingest snapshot) |
| R&C Briefs | `hmrc-ancillary` | govuk-content: collection `revenue-and-customs-briefs` (63) + free-text `"Revenue and Customs Brief"` filtered to canonical links (+58 pre-collection briefs) | ~121 | seeded V19 |
| Statements of Practice | `hmrc-ancillary` | collection `statements-of-practice` | 135 | seeded V19 |
| Extra-Statutory Concessions | `hmrc-ancillary` | collection `extra-statutory-concessions` (consolidated docs) | 4 | seeded V19 |
| VAT notices | `hmrc-ancillary` | collection `vat-notices-numerical-order` | 109 | seeded V19 |
| Excise notices | `hmrc-ancillary` | collections `oils/alcohols/holdings-and-movement/tobacco/climate-change-levy/gambling-duty/aggregates-levy-notices` | 67 | seeded V19 |
| DTAs | `tax-treaties-dta` | govuk-content: collection `tax-treaties` (per-country pages, DTA PDFs attached) | 172 | seeded V19 (P1) |
| All UK treaties | `uk-treaties` | govuk-content: `filter_format=international_treaty`, minus DTA overlap (166 of 172 DTA pages are this format — confirmed "same documents") | 1,519 | re-pointed V19; FCO client retired to `scripts/attic/v19-fco-treaties/` |
| Tax tribunals 2019+ | `tna-caselaw` | FCL court feeds ukftt/tc + ukut/tcc | (see §17) | seeded V19 |
| Historic tax tribunals (pre-2009) | — | `financeandtax.decisions.tribunals.gov.uk` — ALIVE: ASP.NET WebForms search app; VAT & Duties Tribunal, Special Commissioners etc.; decisions from Apr 2003 only ("prior to April 2003 not available by search") | unknown | classification fetch done V19; **build needs Charlie's go-ahead** (postback scraping) |
| OECD MTC / TPG | — | OECD: content published ≥1 Jul 2024 is CC BY 4.0; earlier content (incl. MTC 2017, TPG 2022) is CC **non-commercial** ("may not be sold but may be used in the context of commercial activities") | — | **NOT seeded** — licensing report delivered V19; Charlie's sign-off required |

## 17. FCL COURT COVERAGE (V19)

Find Case Law per-court feeds (`atom.xml?court=…`), true extents binary-searched 11 Jun 2026 (rel="last" is phantom — see §8):

| Court | code | True pages (×50) | Previously in corpus via global feed |
|---|---|---|---|
| Employment Appeal Tribunal | `eat` | 16 (~800) | 787 |
| UT (Tax & Chancery) | `ukut/tcc` | 7 (~350) | — |
| UT (Immigration & Asylum) | `ukut/iac` | 21 (~1,050) | — |
| UT (Lands Chamber) | `ukut/lc` | 11 (~550) | — |
| UT (Admin Appeals) | `ukut/aac` | 25 (~1,250) | (ukut all: 2,686) |
| FtT (Tax) | `ukftt/tc` | 29 (~1,450) | — |
| FtT (General Regulatory) | `ukftt/grc` | 55 (~2,750) | (ukftt all: 4,325) |
| Privy Council | `ukpc` | 15 (~750) | 700 |
| Investigatory Powers Tribunal | `ukiptrib` | 1 (8 docs) | 8 |

- FCL is **thin on tribunals** (backfill is recent-years only) — the first-instance Employment Tribunal record lives on gov.uk: corpus `et-decisions`, `filter_format=employment_tribunal_decision`, **131,668 docs** (2017+; the brief's ~72k was low). gov.uk's `employment_appeal_tribunal_decision` (2,560) is NOT seeded — FCL EAT is canonical.
- Retired V19: `bailii-eat` → FCL eat; `bailii-tribunals` → FCL UT/FtT + et-decisions; `bailii-privy-ni` → FCL ukpc. **NI courts stay parked** (FCL excludes them; judiciaryni.uk is a future source; BAILII contact in progress).
- Politeness: FCL kept its existing rate (tna-caselaw 200ms/4) — it took the 99.6% run happily.

---

## 18. PER-SOURCE LICENCE MAP (V20)

Authoritative code copy: `scripts/ingest/shared/licence-map.ts` — applied per-row at ingest
(`corpus_sections.licence`, default by corpus in `db-metadata.ts sectionParams`). The
`attribution` column is written only where wording is row-specific; uniform boilerplate lives
here and in the map. Backfill: `v20-licence-backfill.ts` (idempotent; pwdata-* deferred — see
V20 CHANGE_LOG).

| licence code | sources | verified | notes |
|---|---|---|---|
| `ogl-3.0` | TNA legislation (primary-acts, si-*, regional, EN/EMs), all gov.uk corpora (hmrc-*, et-decisions, uk-treaties, tax-treaties-dta, govuk-core-docs, building-regs, planning-policy, ots-reports, quangos-govuk V22), sentencing-council, lawcom | 12 Jun 2026 (legislation.gov.uk/contributors; gov.uk T&Cs; per-site pages) | Sentencing Council additionally requires the source-document title in the acknowledgment (row-specific attribution) |
| `ogl-3.0+eu-2011-833` | retained-eu | 12 Jun 2026 | Dual attribution: OGL + Commission Decision 2011/833/EU — exact wording on legislation.gov.uk/contributors |
| `eu-2011-833` | eur-lex | via legislation.gov.uk/contributors (EUR-Lex legal notice is JS-rendered) | © European Union; Commission Decision 2011/833/EU |
| `opl-3.0` | pwdata-*, lda-*, written-answers/statements, committees-reports/evidence, historic-hansard (incl. V22 Lords tranche + HTML gap-fill) | OPL page served full terms 12 Jun 2026 evening (V21) | Long-standing published licence for parliamentary material |
| `echr-nc` | echr-hudoc (V22 revival) | 13 Jun 2026 (echr.coe.int/copyright-and-disclaimer) | Free reproduction with source acknowledged (© ECHR-CEDH) for private/information/education purposes; commercial use requires prior written permission. Default-excluded from commercial surfaces |
| `ojl-2.0` | tna-caselaw (Find Case Law) | 12 Jun 2026 | ⚠️ **Open Justice Licence v2.0 EXCLUDES computational analysis** (search indexing, bulk/automated processing, ML). Bulk ingest + FTS requires TNA's separate computational-analysis licence — caselawlicence@nationalarchives.gov.uk. CHARLIE ACTION (V20). Required attribution: "Contains information licensed under the Open Justice - Licence v2.0" |
| `fca-restricted` | fca-handbook | 12 Jun 2026 (fca.org.uk/legal) | Reproduction/storage in any retrieval system requires prior written permission; Handbook reproduction requires a licence agreement. CHARLIE ACTION (V20) |
| `nao-nc` | nao-reports | 12 Jun 2026 | Free re-use NON-COMMERCIAL with attribution; commercial needs express permission |
| `cc-by-nc-4.0` | oecd (existing 505 rows, pre-Jul-2024 content) | V19 §3.4 | Non-commercial; link-only policy for new pre-2024 OECD content (V20 §2). Post-Jul-2024 OECD is `cc-by-4.0` — seedable with attribution |
| `ogl` (unversioned) | scotlawcom | 12 Jun 2026 | Their copyright page names OGL without a version |
| `pending-verification` | college-of-policing (CF-blocked T&Cs), nilawcom (site SSL-dead), tax-tribunals (no statement on HMCTS legacy site), ni-judgments (© Crown, no open licence stated) | — | Judgment sources treated cautiously given the FCL computational-analysis precedent |

Rules:
- Every NEW corpus gets a licence-map entry BEFORE its seeder runs (the map default is the only thing standing between a new corpus and NULL licence rows).
- Restricted/NC sources (`fca-restricted`, `nao-nc`, `cc-by-nc-4.0`, `ojl-2.0`) are default-excluded from any future commercial surface.

---

## 19. DATABASE TOPOLOGY DOCTRINE (V26 — unification)

V26 folded the legacy `LegislationSection` store into `corpus_sections` and moved the web-app DB off Railway. **Cutover executed + verified live 18 Jun 2026** (prod reads Neon; Railway scrutinise-db detached, 0 app connections — now idle awaiting the §6 DROP after soak). The current topology:

- **One app DB on Neon (pooled).** `DATABASE_URL` points at the Neon **pooled** (`-pooler`) endpoint with `pgbouncer=true&connection_limit=1` (mandatory for Vercel's serverless fan-out — PgBouncer transaction mode). `DIRECT_URL` (non-pooled Neon) is kept for `prisma migrate` only (wired in `prisma.config.ts`). Railway = **compute only** (`Ingest` + `Ops`); its Postgres is decommissioned after the soak.
- **One Prisma client.** The historical `prisma` (Railway) / `prismaSearch` (Neon) split is collapsed — `lib/prisma-search.ts` re-exports `prisma`. All reads + writes + search go through the single client. Do NOT reintroduce a second client; if a future need arises, justify it against this doctrine.
- **Three layers unchanged** (V17): R2 = corpus text; Neon = metadata + search index + queue + **now the app DB**; Railway = transient compute.
- **Legacy compilation value lives in `legislation_compilation_enrichment`** (Neon), keyed by (legislationGovUkId, sectionNumber), pointer-only. When the legacy `Legislation*` tables are dropped (§6), this table + R2 carry the only non-duplicated derived value (compiled-text / lex-summary keys, unapplied-amendment JSON). `corpus_sections` remains pointer-only — never copy section text into a DB column (the V3 rule).
- **Coverage gap-fill, not column copy.** Legacy legislation absent from `corpus_sections` is re-seeded through the `tna-legislation` queue (R2-backed, first-class), never by copying the legacy Postgres `originalText` column. The normalization pass (calendar↔regnal, eudr/eudn↔CELEX, uksi↔regional sub-type) must run before declaring a gid a genuine gap — most "missing" gids are form variants already held.
- **Neon cannot `SET session_replication_role`** (`neondb_owner` lacks it) — cross-DB bulk copies into Neon must order inserts by FK topology (parents first), with self-referencing tables inserted in a single statement.

---

## 20. SEARCH INDEX HYGIENE — ALWAYS `optimize()` AFTER A BACKFILL (3 Aug 2026)

**The rule:** after ANY backfill or large append to a Lance search table (`corpus_fts`,
`corpus_vec`), run `optimize()` **before the index serves users**:

```
cd scripts/ingest
FTS_SERVICE=fts-build tsx search/fts-railway-run.ts optimize     # datacentre run
tsx search/fts-optimize.ts --verify-only                          # coverage check, no writes
```

**Why it is not optional.** LanceDB keeps newly-appended rows *searchable* by
brute-force scanning the un-indexed fragments alongside the inverted index. That is a
real feature — it is why the 29 Jul `fts-catchup` backfill was correct the moment it
finished, and it was verified as such at the time. But the scan is paid **on every
query, forever**, until the rows are merged into the index.

What that cost looked like in production, four days later:

| | before | after |
|---|---|---|
| `body_idx` indexed rows | 16,509,051 | (see CHANGE_LOG) |
| **un-indexed rows** | **1,191,345 (6.7%)** | |
| warm p50 | 26,005 ms | |
| warm p95 | 35,585 ms | |

The client timeout is 25s, so effectively **every** Lex search was timing out — which is
how a data-protection idea was served road-traffic fixtures from the stub fallback
(CHANGE_LOG "LEX REBUILD — Sprint 3-C"). A silent 6.7% index gap took out the whole
search layer, and nothing alerted on it: the rows were present, findable and correct.

**Two traps around the operation itself:**

1. **Run it in the datacentre.** `optimize()` compacts — it rewrites data files — so it
   is a datacentre→R2 job on the `fts-build` service, not a home connection. (A local
   attempt on 29 Jul burned 3,939 CPU-seconds and had to be killed.)
2. **Restart `fts-serve` afterwards, or you will measure nothing.**
   `fts-query-service.ts` calls `openTable()` once at boot with no
   `readConsistencyInterval`, so a running service holds a **fixed snapshot** and will
   keep serving the old, unindexed version no matter how well the optimize went. Pushing
   to `scripts/ingest/search/**` redeploys it (that is the service's `watchPatterns`), or
   redeploy it explicitly.

**Check coverage the cheap way** — metadata only, no scan, safe any time:
`table.indexStats('body_idx')` → `{numIndexedRows, numUnindexedRows}`. Anything above
zero un-indexed on a serving table is a latency bill being charged to every user.
`fts-optimize.ts --verify-only` prints exactly this and touches nothing.

**§20 addendum (4 Aug 2026) — HOW to run it.** The rebuild does not fit on Railway: the
FTS index build peaks at **19.8 GB** (measured), against Railway's 8 GB per-replica cap.
Use the Heavy Job Runner — `cd scripts/ingest && tsx ../ops/heavy-job/run.ts run fts-index`
— which provisions ephemeral rented compute, verifies, destroys the box and prints the
cost (€0.049 for the 4 Aug run). Full procedure: **`docs/HEAVY_JOBS.md`**.
