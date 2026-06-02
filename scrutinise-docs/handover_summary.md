# Handover summary — Full queue seeding + corpus email manifest (3 Jun 2026)

**Date:** 3 Jun 2026 (overnight session)
**Previous conversations:** Corpus Monitoring + Rate Limiting sprint (2 Jun evening)
**Status:** All code changes written to disk. commit-all.sh produced. Awaiting Charlie's single execution approval.

---

## CURRENT STATE

### Railway Worker Status

| Service | Status | Commit | Note |
|---------|--------|--------|------|
| ingest-worker-1 through 10 | ✅ Active | `9acd458` | Running worker-queue.ts with rate-limit token bucket |
| ingest-worker-11 through 20 | Initialising | `9acd458` | Added in Railway — WORKER_ID 11–20 set |
| ingest-scheduler | ✅ Active | `9acd458` | Persistent hourly loop — fires on startup |

**cc-monitor auto-redeploy:** Re-enabled this sprint (crash + stall). Extended to workers 1–20.

### Queue State (as of 3 Jun 2026 ~00:00 BST)

| Corpus | Status | Count |
|--------|--------|-------|
| si-pre-2010 | pending | 3,213 |
| si-pre-2010 | claimed | 80 |
| si-pre-2010 | done | 27,614 |
| primary-acts-2000plus | claimed | 25 |
| primary-acts-2000plus | done | 515 |
| primary-acts-pre-2000 | claimed | 10 |
| primary-acts-pre-2000 | done | 730 |
| regional | claimed | 11 |
| regional | done | 6,142 |
| si-2010plus | claimed | 11 |
| si-2010plus | done | 5,799 |
| tna-caselaw | done | 7,485 (all complete ✅) |
| retained-eu | done | 3,390 |
| hansard-commons-a/b | done | 2,772 (all monthly chunks) |
| hansard-lords-a/b | done | 2,772 (all monthly chunks) |
| hmrc-codes-guidance | claimed | 1 (active) |
| eur-lex | claimed | 1 (active) |
| oecd | done | 1 |
| echr-hudoc | done | 1 |
| fca-regulators | done | 1 |
| uk-treaties | done | 1 |

**NEW queue rows added this sprint** (pending after queue-populator run):
- `fca-regulators`: 30 per-sourcebook rows (one per FCA Handbook sourcebook code)
- `echr-hudoc`: ~600 per-page rows (HUDOC offset-based pagination)
- `eur-lex`: 50 per-page rows (EUR-Lex page-based pagination)
- `committees-a`: 1 discovery row (`__index`)
- `uk-treaties`: 1 refresh row (`v2:__index`)

### corpus_sections compiled counts

| Corpus | Compiled | Failed |
|--------|---------|--------|
| primary-acts-2000plus | 83,183 | 7,676 |
| primary-acts-pre-2000 | 62,637 | 27 |
| si-2010plus | 59,920 | 12 |
| si-pre-2010 | 152,258 | 1,379 (in progress) |
| regional | 92,681 | 0 |
| retained-eu | 14,390 | 0 |
| tna-caselaw | 74,730 | 0 |
| hmrc-codes-guidance | 13,425+ | 0 (in progress) |
| oecd | 462 | 0 |
| fca-regulators | 0 | 0 (re-seeded this sprint) |
| echr-hudoc | 0 | 0 (re-seeded this sprint) |
| **Total new pipeline** | **~553,686** | |
| **+ Neon legacy** | **914,274** | ✅ |
| **GRAND TOTAL** | **~1,467,960** | **~20.6%** |

---

## WHAT WAS DONE THIS SPRINT

### Part A — Diagnostic
- Ran 3 diagnostic queries: si-pre-2010 failures (0 — none at all), overall status (57,221 done / 3,213 pending / 141 claimed), per-corpus breakdown.
- Discovered DB uses `corpus` column (not `source_key`) and `lastError` (not `error_message`).
- Confirmed 7 sourceKey discrepancies between brief manifest and actual DB values.
- Queried corpus_sections: FCA, ECHR, Hansard, UK Treaties show 0 compiled despite done queue rows — silent failures in workers.

### Part B — SI pre-2010 failure fix
- No action needed. Zero failures in the entire queue. 3,213 pending rows are healthy.

### Part C — Queue seeding for parallel sources
| Item | Detail |
|------|--------|
| `populateCommittees()` | 1 `committees-a:__index` row — triggers `listCommitteeReports()` on worker claim |
| `populateFcaSourcebooks()` | 30 per-sourcebook rows (FCA_KNOWN_SOURCEBOOKS). Worker `processFca()` updated to handle `sourcebook:{CODE}` docId |
| `populateEchrPages()` | ~600 per-page rows at `page:{start}` offsets. Worker `processEchr()` updated to handle per-page rows. Queries HUDOC API for total count on populator run. |
| `populateEurLexPages()` | 50 per-page rows at `page:{N}` (1-indexed). Worker `processEurLex()` updated similarly. |
| `populateUkTreatiesRefresh()` | 1 fresh retry row `uk-treaties:v2:__index` (original `__index` done but 0 compiled) |
| **source_rate_limits** | No changes needed — all sourceTypes already seeded |

### Part D — Full corpus email manifest
- `progress-reporter.ts` full rewrite:
  - `CorpusEntry` interface with `dbCorpora` mapping to actual DB corpus values
  - `CORPUS_MANIFEST` array: 37 entries, priority-grouped 0–4
  - `queryQueueCorpora()` — detects seeded vs not-started sources
  - `queryEtaFromSnapshots()` — time-series ETA from last 6 snapshots (more accurate than single-snapshot)
  - `sendProgressEmail()` — full manifest email with tier separators, ✅/⛔ flags, progress bars, not-started detection
  - `buildAggregate()` extended to workers 1–20

### Part E — cc-monitor auto-redeploy
- Uncommented crash auto-redeploy loop (~lines 292–298)
- Uncommented stall auto-redeploy block (~lines 317–320)
- Extended `checkStalledWorkers()` from 10 to 20 workers

### Part F — New source clients + queue seeding

| Part | Source | Outcome |
|------|--------|---------|
| F1 | Parliamentary Written Answers | `fetchWrittenAnswers(from, to)` added to parliament-api.ts. WQS API confirmed live (swagger verified). Monthly chunks 2000-01 to present (~317 rows). Worker handles `answers:{from}:{to}` and `statements:{from}:{to}` docId prefixes. |
| F1 | Written Ministerial Statements | `fetchWrittenStatements(from, to)` added. Monthly chunks 1997-05 to present (~349 rows). |
| F2 | HMRC TIINs | `listHmrcTiins()` added to gov-scraper.ts — uses gov.uk content API for TIINS collection, falls back to search. sourceType = 'gov-uk'. 1 `__index` row seeded. |
| F3 | OTS Reports | `listOtsReports()` added to gov-scraper.ts — gov.uk search API. sourceType = 'gov-uk'. 1 `__index` row. |
| F4 | Scottish Law Commission | New `law-commissions.ts` — scrapes 46 listing pages, follows publication pages, downloads PDFs at `/sites/default/files/YYYY-MM/*.pdf`. 454 publications. 1 `__index` row. sourceType = 'scotlawcom'. |
| F5 | NI Law Commission | Same file — defunct since April 2015, ~18 historical PDFs scraped from index page. 1 `__index` row. sourceType = 'nilawcom'. |
| F6 | SSRN | **NOT IMPLEMENTED** — API returned 403 Forbidden on live verification (3 Jun 2026). Rate limit entry added as placeholder. Blocked in CORPUS_MANIFEST. Needs manual access investigation. |
| F7 | seed-rate-limits.ts | Added: `gov-uk` (300ms), `scotlawcom` (300ms), `nilawcom` (300ms), `ssrn` (200ms placeholder). |

---

## NEXT STEPS

### 1. Approve and run commit-all.sh
```bash
bash commit-all.sh
```

### 2. Redeploy scheduler (picks up manifest email immediately)
In Railway: redeploy `ingest-scheduler` service — next email will show full manifest.

### 3. Run queue-populator.ts to seed new rows
```bash
cd C:/Code/scrutinise-prototype
NODE_PATH=scrutinise-web/node_modules \
scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json \
scripts/ingest/queue-populator.ts
```
Expect: ~30 FCA rows, ~600 ECHR rows, 50 EUR-Lex rows, 1 committee row, 1 UK treaty retry row inserted.

### 4. Verify next hourly email shows full manifest
Look for: tier separators (PRIORITY 1–4), ✅ on Neon legacy, per-corpus progress bars for active sources, "not started" for unseeded sources.

### 5. Backlog (unchanged)
- Tesseract OCR pass for PDFs with `notes='pdf-ocr-needed'`
- BAILII data access request (Cloudflare WAF blocking)
- V.4-FTS-2: pgvector semantic search
- Hansard corpus_sections backfill: content exists in R2 but not in corpus_sections (from worker-main.ts era)
- Investigate Hansard / FCA / ECHR silent failures — determine if API endpoints are correct

---

## Key file reference

| File | Purpose |
|------|---------|
| `scripts/ingest/queue-populator.ts` | Queue seeding — run once per sprint before workers process new sources |
| `scripts/ingest/workers/worker-queue.ts` | Queue worker — handles per-sourcebook FCA, per-page ECHR/EUR-Lex, committees |
| `scripts/ingest/shared/progress-reporter.ts` | Full corpus manifest + email + ETA from snapshots |
| `scripts/ingest/shared/queue-client.ts` | claimNextChunk (rate-limited), getSleepDuration, suspendSource |
| `scripts/ingest/shared/compile.ts` | rawToText() (XML/HTML), pdfToText() (pdf-parse) |
| `scripts/ingest/scheduler.ts` | Persistent hourly loop, clearExpiredSuspensions sweep |
| `scripts/ingest/cc-monitor.ts` | Auto-redeploy for crashed/stalled workers — now active for workers 1–20 |
| `scripts/ingest/sources/fca-handbook.ts` | FCA scraper — exports FCA_KNOWN_SOURCEBOOKS, listFcaSectionsForSourcebook |
| `scripts/ingest/sources/echr-hudoc.ts` | ECHR HUDOC — exports listUkCasesPage for parallel pagination |
| `scripts/ingest/sources/eurlex.ts` | EUR-Lex — exports listRetainedEuPage for parallel pagination |

---

## Notes for next CC session

- `handoff_summary.md` renamed from `handover_summary.md` in some references. The file is at `scrutinise-docs/handover_summary.md`.
- The Prisma error on local `queryUnrecognisedFormats` runs is **local-only** — scrutinise-web uses Prisma 7; Railway workers use Prisma 6.19.3 (lockfile-pinned).
- CORPUS_MANIFEST uses `dbCorpora: []` for sources not yet seeded — these render as "not started" in emails.
- Hansard shows 0 corpus_sections despite 5,544 done queue rows — content is in R2 (compiled by worker-main.ts legacy). A backfill script is needed to populate corpus_sections from existing R2 keys. Out of scope this sprint.
