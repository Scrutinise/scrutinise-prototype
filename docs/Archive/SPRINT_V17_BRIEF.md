# SPRINT V17 — CONSOLIDATION & RENEWAL
**Written:** 10 Jun 2026, by CCh. **Repo:** `C:/Code/scrutinise-prototype`, branch `Main` (capital M), HEAD ~`59f6900`.
**Read first:** `docs/handoff_summary.md`, `INGEST_PLAYBOOK.md` §8/§9, root `CLAUDE.md` (Railway ops conventions).

---

## 0. CONTEXT — root cause is CONFIRMED, do not re-litigate it

The project-wide outages of 8–10 Jun were caused by a **Railway workspace Compute Usage Limit ($30) being hit**, which pauses ALL workloads simultaneously ("All deployments are paused" — confirmed on Charlie's Usage page). Not OOM, not connections, not worker code. The limit has been raised; nothing is "crashed". Earlier incidents in the window were a mix of genuine worker bugs (since fixed or made obsolete by this sprint) and limit pauses misread as crashes.

Charlie has deleted the worker fleet. Remaining Railway services:
- `scrutinise-db` — web app Postgres. **Do not touch in this sprint.**
- `ops` (renamed from `Ingest-scheduler`) — shell kept for its variables; will become the merged scheduler+monitor.
- `ingest` (renamed from `ingest-worker-1`) — shell kept for its variables; will become the single consolidated worker.
(If Charlie deleted these two before renaming, recreate them and re-set variables from `scrutinise-web/.env` — flag to Charlie before setting any secrets.)

**Why this sprint exists:** 23 always-on containers had a ~$3.6/day cost floor regardless of output. The new architecture pays only while ingesting. Cost discipline is the design criterion throughout.

---

## 1. TASK — `ingest`: single-process pool worker

Audit the existing worker entrypoint and `worker-queue.ts` first; build in the same pass (no report-then-build round trip).

New entrypoint (e.g. `scripts/ingest/ingest-pool.ts`, follow repo conventions):

1. **N concurrent claim loops in one process.** `WORKER_CONCURRENCY` env var, default 20. Launch with `Promise.all` over `runLoop(i)`; each loop is today's worker cycle unchanged: claim (`FOR UPDATE SKIP LOCKED`) → fetch → parse → R2 put → Neon insert → mark done → next. Loop identity `pool-1…pool-N` used as the claim `workerId` and log prefix, so the queue model, reaper and email logic are untouched.
   *Why one process:* the work is I/O-bound; Node overlaps the network waits of all loops on one runtime. 20 containers paid 20× runtime overhead for parallelism the event loop provides free.
2. **Shared single `pg.Pool` to Neon, `max: 10`, `idleTimeoutMillis: 10000`.** All loops share it.
   *Why 10:* loops hold a connection only for the short claim/insert moments, not during fetches; 10 covers 20 loops with headroom. Replaces up to 60 fleet connections.
3. **Per-loop error isolation.** Each loop wraps its cycle in try/catch: a failing row is marked `failed` with `lastError` and the loop continues. Keep the existing 5-min per-row `Promise.race` timeout and `AbortController` fetch timeouts. Only a process-fatal error (Neon unreachable after the pool's own retry, OOM) exits non-zero.
4. **In-memory per-source rate limiter (token bucket).** On startup, read per-source rates from `source_rate_limits`; enforce in-process (one bucket per source shared by all loops). Do **not** write coordination rows back per-claim.
   *Why:* with one process, enforcement is exact and free; the DB round-trips existed only to coordinate 20 separate processes. The table remains the configuration source — rates are still edited there, re-read on startup.
5. **Exit-on-empty.** If a full sweep finds no claimable pending rows for **3 consecutive sweeps, 30s apart**, log a one-line summary (rows done this run, sections written, duration) and `process.exit(0)`.
   *Why:* a stopped service bills nothing. Idle polling was costing ~$1+/day across the fleet.
6. **Railway restart policy: `ON_FAILURE`, max 3.** Exit 0 → stays stopped (correct). Crash → restarts (correct).
7. **Remove startup jitter** (existed only to stagger 20 containers — obsolete) and any remaining ECONNRESET-loop remnants. No code path in `ingest` may read `DATABASE_URL` (Railway DB) — grep and prove it.
8. **Memory guard:** cap concurrent in-flight document buffers if needed (some Acts are very large). Target steady footprint ≤ ~600MB at concurrency 20.

Variables needed on `ingest`: `NEON_DATABASE_URL`, R2 credentials, `WORKER_CONCURRENCY`. Nothing else.

---

## 2. TASK — `ops`: merged scheduler + monitor

One service, one process, two cadences (single `setInterval` scheduler internally; keep `scheduler_lock` semantics so a redeploy overlap can't double-run):

**Hourly:** progress snapshot + email (existing format), stale-claim reaper.
**Every 15 min:** circuit-breaker evaluation + ingest liveness check.

1. **Remove `queryFormatBreakdown()` / `queryUnrecognisedFormats()` and ALL Railway-DB (Prisma/`DATABASE_URL`) usage.** `ops` connects to **Neon only**.
   *Why:* these query a table that has been empty since V16 and are the documented cause of scheduler hangs when Railway DB was down.
2. **Circuit breakers, per source** (deterministic — this is the core of the renewal):
   - **Failure breaker:** ≥5 consecutive failures on a source with no intervening success → trip.
   - **Zero-output breaker:** ≥25 rows marked `done` whose processing wrote 0 `corpus_sections` → trip.
     *Why 25:* catches a silently-broken client within minutes while tolerating legitimately empty items; the committees incident wrote 2,896 empty "done" rows with no alarm — this breaker makes that class of failure impossible.
   - **On trip:** park all the source's `pending` rows as `status='blocked'`, record the trip reason + last error, add a persistent ISSUES line to the hourly email. **No automatic retry, ever** (playbook rule: deterministic failures must not be retried). Clearing is a manual flag (document the SQL in the playbook).
   - Audit existing schema first; prefer minimal change (e.g. columns on `source_rate_limits` or a small `source_status` table) — choose and document why.
3. **Ingest liveness:** if `pending > 0` (excluding `blocked`) and the `ingest` service is not running → start it via `serviceInstanceRedeploy` (use `backboard.railway.com/graphql/v2`; note the `deploymentRedeploy` vs `serviceInstanceRedeploy` distinction in CLAUDE.md — never `deploymentRedeploy`, it can resurrect stale code). If `pending = 0`, do nothing — `ingest` stops itself.
4. **Email additions:** ingest service state (running/stopped, starts today), sections written this hour vs rows completed (divergence = early zero-output warning), and the ISSUES block now sourced from breaker state so issues persist until cleared.

Variables needed on `ops`: `NEON_DATABASE_URL`, `RESEND_API_KEY`, `RAILWAY_API_TOKEN`, `RAILWAY_PROJECT_ID` (+ env ID per CLAUDE.md).

---

## 3. TASK — cleanup

- Retire `restart-workers-staggered.ts` and any fleet-only scripts (delete or move to `scripts/attic/` per repo convention) — staggered restarts no longer exist as a concept.
- Remove worker-fleet assumptions from any shared code (per-service WORKER_ID env expectations etc.).

---

## 4. TASK — documentation (mandatory, not optional)

- **INGEST_PLAYBOOK.md:**
  - §1 architecture table rewritten to the three-layer doctrine: R2 = corpus text (permanent, zero egress); Neon = metadata + search index (elastic, scale-to-zero); Railway = transient compute only (`ingest` + `ops`, exit-on-empty).
  - New §cost model: Railway rates (memory $0.000231/GB-min, CPU $0.000463/vCPU-min, egress $0.05/GB), Neon (~$0.10/CU-hr at 0.25 CU minimum, $0.35/GB-month), R2 (~$0.015/GB-month, zero egress). State the design rule: **system cost at zero work must be ≈ $0.**
  - New §8 failure pattern: *ALL services show "Service is offline" simultaneously → check Workspace → Usage page FIRST (usage-limit pause), before restarting anything.* This was missed through ~5 crash cycles.
  - New §jurisdiction onboarding checklist (skeleton): manifest in `corpus_targets` → source survey (bulk → HTML → API → PDF) → adapter → shakedown at low concurrency → breaker thresholds → playbook entry.
- **handoff_summary.md:** rewrite CURRENT STATE for the post-V17 architecture.
- **CHANGE_LOG.md:** V17 entry.

---

## 5. VERIFICATION PROTOCOL (in order; do not skip)

1. Deploy `ingest` with `WORKER_CONCURRENCY=5`. Shakedown workload: the ~1,251-row si-2010plus tail already pending in Neon.
2. Verify **sections, not statuses**: `corpus_sections` row-count delta must match rows completed. (Lesson: "done" without output is the failure mode that hid for days.)
3. Raise to `WORKER_CONCURRENCY=20`; confirm memory ≤ ~600MB and no event-loop starvation (claim latency stays sane in logs).
4. When the tail finishes, confirm **exit-on-empty fires** and the service stays stopped.
5. Seed a handful of test rows; confirm `ops` detects pending > 0 and starts `ingest` within 15 min.
6. Force a breaker: point a few rows at a known-failing source (e.g. uk-treaties) and confirm trip → park → ISSUES email line.
7. Report predicted vs observed: expected steady-state cost while idle ≈ Railway `scrutinise-db` only; Charlie checks the Usage page the next morning.

---

## 6. OUT OF SCOPE (V18+ — do not start)

pwdata backlog seeding; committees curl/`nixpacks.toml`; blocked-source investigations (HUDOC, NAO, uk-treaties, SSRN, BAILII); Railway-DB → Neon web-app migration; sections-per-dollar KPI (needs Railway usage API work).

## 7. GIT DISCIPLINE

No git calls during the sprint. Single `commit-all.sh` at the end; Charlie approves on Vercel preview; then execute and delete the script. Commits to `Main`.
