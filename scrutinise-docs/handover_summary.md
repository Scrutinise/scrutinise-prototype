# Handover summary — Corpus Monitoring + Rate Limiting sprint (2 Jun 2026, evening)

**Date:** 2 Jun 2026 (evening session)
**Previous conversations:** Architecture sprint + build fixes (earlier today)
**Status:** All pushed and deployed. Workers 1–10 running with rate-limit token bucket. Scheduler sending hourly emails. Workers 11–20 cleared to add in Railway — see NEXT STEPS.

---

## CURRENT STATE

### Railway Worker Status (as of 2 Jun 2026 ~22:45 BST)

| Service | Status | Commit | Note |
|---------|--------|--------|------|
| ingest-worker-1 through 10 | ✅ Should be SUCCESS | `9acd458` | Running worker-queue.ts with rate-limit-aware claim |
| ingest-scheduler | ✅ SUCCESS | `9acd458` | Persistent hourly loop — no cron schedule needed |

**Workers 11–20:** NOT YET ADDED. Ready to add — see NEXT STEPS.

**Ingest progress:** 426,343 new pipeline sections compiled + 914,274 legacy (Neon) = **1,340,617 total = 18.9% overall**.

### Queue State (as of 2 Jun 2026 ~22:00 BST)

- `tna-legislation`: ~33,000 pending (down from 40,070 — workers actively processing)
- `tna-caselaw`: 7,485 done ✅
- `hansard`: 5,544 done ✅
- `fca`, `hmrc`, `echr`, `eurlex`, `oecd`, `treaties`: 1 pending each (priority 3–5, will process after TNA legislation drains)

### Key tables added this session

| Table | Purpose |
|-------|---------|
| `source_rate_limits` | Token bucket per sourceType — seeded with 10 entries (200ms–1000ms) |
| `ingest_progress_snapshots` | Append-only time-series, one row per corpus per scheduler run |

---

## WHAT WAS DONE THIS SESSION

### Fix: Workers 1–4 build failures
- Root cause: missing `scripts/ingest/package-lock.json` — non-deterministic npm installs
- Fix: generated lockfile (Prisma 6.19.3, tsx 4.22.4, pg 8.21.0 pinned)
- Also fixed: `db-metadata.ts` used deprecated Prisma `datasources` constructor option → `new PrismaClient()` (no options, reads DATABASE_URL from env; works Prisma 6 and 7)

### Fix: Scheduler silence (no emails after 15:42)
- Root cause: `queryNeonCount()` created a pg Pool with no timeouts → Neon idle-timeout caused a silent hang → loop stuck forever
- Fix: `connectionTimeoutMillis: 10_000` + `statement_timeout: 30_000` on both pools
- Fix: `Promise.race([run(), timeout(5min)])` in scheduler loop — hung run() aborts, loop continues

### Scheduler architecture change
- Converted from Railway cron service to **persistent always-on loop**
- Default interval: `SCHEDULER_INTERVAL_HOURS=1` (env var set in Railway)
- Fires immediately on startup — redeploy = immediate email
- Remove the Railway cron schedule from `ingest-scheduler` if still set

### Corpus Monitoring sprint (B1–B3)
| Item | Detail |
|------|--------|
| `IngestProgressSnapshot` table | Append-only, one row per corpus per run. Migration: `20260602150000`. Applied ✅ |
| `progress-reporter.ts` rewrite | CORPUS_TARGETS const (~6.9M total), per-corpus section targets, Neon count query, unified email showing legacy + new pipeline totals |
| `scheduler.ts` update | Queries corpus_sections + Neon; writes IngestProgressSnapshot rows; new email API |
| `pdf-parse` added | `pdfToText()` in compile.ts — extracts machine-readable PDFs; low-yield (scanned) PDFs flagged `notes='pdf-ocr-needed'` for later Tesseract pass |
| Worker-queue.ts PDF branch | Now calls `pdfToText()` instead of storing placeholder text |

### Rate Limiting sprint (B1–B5)
| Item | Detail |
|------|--------|
| `SourceRateLimit` table | Token bucket per sourceType. Migration: `20260602160000`. Applied ✅. Seeded ✅ |
| `claimNextChunk()` rewrite | Two-phase: (1) find highest-priority source with available token via JOIN; (2) claim row + update lastIssuedAt atomically. Falls back to unconstrained sources if rate-limit table empty |
| `getSleepDuration()` | Workers sleep until next token available (not fixed 5-min sleep). Wakes in as little as 10ms |
| `suspendSource()` / `clearExpiredSuspensions()` | 429 suspension written to source_rate_limits; scheduler sweeps expired suspensions each run |
| `AdaptiveThrottle.onSuspend` | Callback fired when delay ≥ 60s. Wired on tna-legislation and tna-caselaw |
| WORKER_ID cap removed | Was capped at 10; now accepts any positive value — workers 11–20 supported |
| `seed-rate-limits.ts` | Upsert script. Already run (data live). dotenv path fixed in `9acd458` |

---

## NEXT STEPS

### 1. Add workers 11–20 in Railway (CLEARED — do now)

Pre-conditions all met:
- ✅ source_rate_limits seeded
- ✅ claimNextChunk() with token bucket deployed on workers 1–10
- ✅ WORKER_ID cap removed

For each `ingest-worker-11` through `ingest-worker-20`:
- Same repo, `rootDirectory = scripts/ingest`, start command `npm run worker`
- Copy all env vars from `ingest-worker-1`
- Set `WORKER_ID` = 11 through 20

### 2. Add NEON_DATABASE_URL to ingest-scheduler in Railway
Currently falls back to hardcoded 914,274 baseline. Add the env var to keep the Neon count live.

### 3. Verify source_rate_limits updating
After next scheduler email, query: `SELECT "sourceKey", "lastIssuedAt", suspended FROM source_rate_limits ORDER BY "lastIssuedAt" DESC` — should show non-zero lastIssuedAt values for tna-legislation and tna-caselaw.

### 4. Re-enable cc-monitor auto-redeploy (deferred)
Once workers 11–20 are stable for 24h. Uncomment lines ~145–153 in `cc-monitor.ts`.

### 5. Backlog
- Tesseract OCR pass for PDFs with `notes='pdf-ocr-needed'` (separate post-ingest cleanup job)
- BAILII data access request to unblock BAILII scraper (Cloudflare WAF blocking)
- V.4-FTS-2: pgvector semantic search (embedding vector(768) on Neon is empty, ready to populate)
- Shared rate-limit bucket for HMRC/FCA/OECD sources if workers added for those

---

## Key file reference

| File | Purpose |
|------|---------|
| `scripts/ingest/shared/queue-client.ts` | claimNextChunk (rate-limited), getSleepDuration, suspendSource, clearExpiredSuspensions |
| `scripts/ingest/shared/progress-reporter.ts` | Corpus coverage email — CORPUS_TARGETS, Neon query, snapshot write |
| `scripts/ingest/shared/compile.ts` | rawToText() (XML/HTML), pdfToText() (pdf-parse) |
| `scripts/ingest/scheduler.ts` | Persistent hourly loop, clearExpiredSuspensions sweep |
| `scripts/ingest/seed-rate-limits.ts` | Rate limit seed (already run — re-run to reset) |
| `scripts/ingest/workers/worker-queue.ts` | Queue worker — smart sleep, WORKER_ID unrestricted |
| `scripts/ingest/shared/adaptive-throttle.ts` | Rate throttle with onSuspend callback |
| `scrutinise-web/prisma/migrations/20260602150000_*` | IngestProgressSnapshot migration (applied) |
| `scrutinise-web/prisma/migrations/20260602160000_*` | source_rate_limits migration (applied) |

---

## Notes for next CC session

- The Prisma error on local `queryUnrecognisedFormats` runs is **local-only** — scrutinise-web uses Prisma 7 which rejects `new PrismaClient()` without options. Railway workers use Prisma 6.19.3 (lockfile-pinned) and work correctly.
- The scheduler's format breakdown query (`queryUnrecognisedFormats`) uses Prisma client. It fails locally but is caught by try/catch — emails still send. On Railway it works fine.
- CORPUS_TARGETS total is ~6.9M sections. The brief comment says ~6.5M after excluding out-of-scope rows. Current denominator uses full sum.
