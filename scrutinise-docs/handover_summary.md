# Handover summary — Self-discovering workers sprint (3 Jun 2026, afternoon)

**Date:** 3 Jun 2026
**Previous conversations:** Full queue seeding + corpus email manifest (3 Jun 2026 overnight)
**Status:** All pushed and deployed. Workers self-discovering. Scheduler fixed and running correctly.

---

## CURRENT STATE

### Railway Worker Status (as of 3 Jun 2026 ~14:00 BST)

| Service | Status | Commit | Note |
|---------|--------|--------|------|
| ingest-worker-1 through 20 | ✅ SUCCESS | `fc1a172` | Running worker-queue.ts with self-discovery + rate-limit token bucket |
| ingest-scheduler | ✅ SUCCESS | `fc1a172` | Running scheduler.ts correctly — hourly emails active |

**cc-monitor auto-redeploy:** Active for workers 1–20 (crash + stall detection).

**Workers 1–4 history:** Were FAILED on old commits due to railway.json `startCommand` bug. Fixed by commit `253e339` (removed startCommand from railway.json). All 4 are now SUCCESS on latest commit.

### Queue State (as of 3 Jun 2026 ~10:00 BST — after direct seeding)

1,360 pending rows seeded across new corpora:
- `fca-regulators`: 36 per-sourcebook rows (one per FCA Handbook sourcebook code)
- `echr-hudoc`: 600 per-page rows (HUDOC offset-based, 50 cases per page)
- `eur-lex`: 50 per-page rows
- `written-answers`: 318 monthly chunk rows (2000-01 to 2026-06-03)
- `written-statements`: 350 monthly chunk rows (1997-05 to 2026-06-03)
- `committees-a`, `hmrc-tiins`, `ots-reports`, `scotlawcom`, `nilawcom`, `uk-treaties:v2`: 6 single-row sources

Workers are actively processing these rows. When exhausted, self-discovery kicks in automatically.

### Key architecture: self-discovery loop

When `claimNextChunk()` returns null:
1. `countPendingRows()` → **0 = queue empty**, **>0 = rate-limited**
2. If empty: iterate `DISCOVERY_CORPUS_ORDER`, call `discoverForCorpus(corpus)` for each
3. New rows found → insert + claim immediately
4. No rows found → mark `isComplete = true` on that sourceType's rate-limit entry, try next
5. All exhausted → sleep 5 min

Workers never idle indefinitely again. New monthly chunks, caselaw pages, and acts are discovered automatically.

### corpus_sections compiled counts (as of 2 Jun 2026 ~23:51 — last known snapshot)

| Corpus | Compiled | Failed |
|--------|---------|--------|
| primary-acts-2000plus | 83,183 | 7,676 |
| primary-acts-pre-2000 | 62,637 | 27 |
| si-2010plus | 59,920 | 12 |
| si-pre-2010 | ~30,847 (all done ✅) | 1,379 |
| regional | 92,681 | 0 |
| retained-eu | 14,390 | 0 |
| tna-caselaw | 74,730 | 0 |
| hmrc-codes-guidance | 13,425+ | 0 (in progress) |
| oecd | 462 | 0 |
| **Total new pipeline** | **~600k+** | |
| **+ Neon legacy** | **914,274** | ✅ |

**Note:** si-pre-2010 corpus exhausted the original queue rows (~00:42 on 3 Jun). Workers then had nothing to process until queue seeding ran. Self-discovery will prevent this recurring.

---

## WHAT WAS DONE THIS SESSION

### Diagnostics run
- Confirmed `claimNextChunk()` returns null for both "queue empty" and "all rate-limited" with no distinction
- Identified railway.json `startCommand: "npm run worker"` was overriding the scheduler service — it was running as a worker, not sending emails
- Confirmed workers 1–4 were FAILED on old commits (same root cause)
- Verified via Railway GraphQL API: all worker logs showing `"no token available — sleeping 60000ms"` — healthy but idle

### Fixes applied
| Fix | Commit | Detail |
|-----|--------|--------|
| railway.json startCommand removed | `253e339` | Scheduler now runs `scheduler.ts`, workers run `worker-queue.ts` per their service-level settings |
| isComplete migration | `0d60b2c` | `ALTER TABLE source_rate_limits ADD COLUMN "isComplete" boolean NOT NULL DEFAULT false` — applied directly + in migration file |
| queue-client helpers | `12b69d3` | `countPendingRows()`, `getMaxDocIdForCorpus()`, `getAllDocIdsForCorpus()`, `markSourceTypeComplete()`, `getNextDiscoveryTarget()` |
| discovery.ts | `53bf442` | Per-corpus discovery logic for all source types |
| Worker self-discovery loop | `fc1a172` | Main loop updated: empty queue → self-discover, rate-limited → sleep |

### Direct DB seeding (not committed — applied via node script)
Queue-populator kept failing due to local DNS issues with Railway proxy. Seeded 1,360 rows directly via pg client, bypassing the slow TNA enumeration phase.

---

## NEXT STEPS

### Immediate (automatic)
- Workers are processing the 1,360 pending rows right now
- When those drain, self-discovery triggers automatically — no manual intervention needed
- Scheduler sends hourly emails with full CORPUS_MANIFEST (now running correctly)

### Backlog
- **Hansard corpus_sections backfill**: 5,544 monthly chunk rows are `done` but 0 corpus_sections rows — content exists in R2 from legacy worker-main.ts pipeline. Needs a backfill script to walk R2 keys and write corpus_sections rows. Estimated 2M+ Hansard sections waiting in R2.
- **FCA / ECHR / UK Treaties silent failures**: all had `done` queue rows but 0 corpus_sections. Investigate why workers produced no output — likely API endpoint issues or r2Exists false positives.
- **BAILII**: Cloudflare WAF blocking. Data access request to BAILII pending.
- **SSRN**: API returned 403 Forbidden on 3 Jun verification. Marked blocked in CORPUS_MANIFEST. Needs manual access investigation.
- **Tesseract OCR**: PDFs with `notes='pdf-ocr-needed'` need a post-ingest OCR pass.
- **V.4-FTS-2**: pgvector semantic search — embedding vector(768) on Neon is empty, ready to populate.
- **npx prisma migrate deploy**: Run in scrutinise-web/ to formally record the isComplete migration in Prisma's migration table (was applied directly to DB).

---

## Key file reference

| File | Purpose |
|------|---------|
| `scripts/ingest/shared/discovery.ts` | Self-discovery logic per corpus — called when queue empties |
| `scripts/ingest/shared/queue-client.ts` | claimNextChunk, countPendingRows, markSourceTypeComplete, getSleepDuration |
| `scripts/ingest/workers/worker-queue.ts` | Queue worker main loop — self-discovery + rate-limit-aware claim |
| `scripts/ingest/shared/progress-reporter.ts` | Full CORPUS_MANIFEST (39 entries) + snapshot-based ETA + email |
| `scripts/ingest/scheduler.ts` | Persistent hourly loop — sends email, clears suspensions, writes snapshots |
| `scripts/ingest/cc-monitor.ts` | Auto-redeploy for crashed/stalled workers 1–20 |
| `scripts/ingest/seed-rate-limits.ts` | Rate limit seed — includes gov-uk, scotlawcom, nilawcom, ssrn entries |
| `scripts/ingest/sources/discovery.ts` | Per-corpus discovery functions |
| `scripts/ingest/railway.json` | Empty `{}` — each Railway service uses its own dashboard start command |

---

## Notes for next CC session

- **`npx prisma migrate deploy`**: The isComplete migration was applied directly (ALTER TABLE). Run `npx prisma migrate deploy` in `scrutinise-web/` to sync Prisma's migration history table, otherwise future `migrate deploy` calls may error.
- **Scheduler**: Confirmed running `scheduler.ts` after `253e339` fix. Hourly emails should resume from next scheduler cycle.
- **Self-discovery `isComplete` reset**: When a sourceType is marked `isComplete = true`, it stays that way until reset. The scheduler does NOT currently reset these. For ongoing sources (written-answers etc.) this is fine — `discoverForCorpus` returns [] only when truly up-to-date. For historical sources (si-pre-2010) marked complete, isComplete stays true permanently (correct behaviour). If a source needs re-discovery after being marked complete, run `seed-rate-limits.ts` to reset all isComplete flags.
- **DB column naming**: ingest_queue uses `corpus` (not `source_key`) and `lastError` (not `error_message`). Brief SQL queries have used wrong names historically — always verify against schema.
- **CORPUS_MANIFEST source keys**: 7 discrepancies between brief naming and DB corpus values — documented in CHANGE_LOG. Manifest uses DB values.
