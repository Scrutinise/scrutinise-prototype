# SCRUTINISE — HANDOFF SUMMARY

*Read this first every session. Top section is authoritative.*

*Last updated: 3 Jun 2026 (evening)*

---

## CURRENT STATE

**Active branch:** Main
**Last sprint:** Scheduler fix + throughput email + sprint workflow (3 Jun 2026 evening)
**Latest commits:** `c5c7fee` (docs update, 3 Jun afternoon) — code changes from this session not yet committed

### What just happened (3 Jun 2026 evening sprint)

1. **RangeError fix (Part 1):** `progressBar()` in `progress-reporter.ts` now clamps `pct` to `[0,100]` and `filled` to `[0,barWidth]`. Email sends were crashing every hour since compiled > estSections for some corpora.

2. **Worker throughput in email (Part 2):** Added `queryWorkerThroughput()` and a new "WORKER THROUGHPUT" section in `sendProgressEmail()`. Shows per-corpus sections/hr rate with mini bar, ⚠️ stalled / ℹ️ idle flags, total rate, stalled list. Uses 3-snapshot pivot to distinguish stalled vs idle.

3. **Diagnostics (Part 3):** Queue is exhausted (0 pending, 120 claimed, 61,829 done). Self-discovery is working — just trickle-rate new items now. Snapshot doubling bug (×2 SUM at 11:54 BST) is a one-time Railway restart overlap, not a systematic code bug.

4. **Sprint workflow (Part 4):** Created `docs/SPRINT.md` as the canonical home for CCh sprint briefs. Added sprint brief protocol to `CLAUDE.md` §12.

5. **Part 5 (read-only):** Confirmed Hansard/ECHR/FCA/Treaties have the R2 backfill gap. See CHANGE_LOG for exact counts and key patterns.

### Pending commit

All changes above need to be committed via `commit-all.sh`. **Do not run git mid-sprint** — produce `commit-all.sh` at end.

Files changed:
- `scripts/ingest/shared/progress-reporter.ts`
- `scrutinise-docs/CLAUDE.md`
- `scrutinise-docs/CHANGE_LOG.md`
- `scrutinise-docs/handoff_summary.md` (this file)
- `docs/SPRINT.md` (new)
- `scrutinise-docs/SPRINT.md` (CCh's original brief — can be cleared after commit)

---

## NEXT STEPS

1. **Redeploy `ingest-scheduler` on Railway** — picks up the progressBar fix immediately
2. **Trigger one local scheduler run** to confirm email sends cleanly (no RangeError)
3. **Next sprint:** Hansard R2 backfill — CCh to write brief to `docs/SPRINT.md`:
   - List R2 keys under `hansard/` prefix
   - For each key, check corpus_sections existence
   - Fetch from R2, parse text, call upsertSection()
   - Run as one-off migration script
   - Investigate FCA/ECHR R2 key patterns before including them

---

## ARCHITECTURE SNAPSHOT (3 Jun 2026)

- **20 Railway workers** ingesting via `worker-queue.ts` — queue-claim model with `FOR UPDATE SKIP LOCKED`
- **Scheduler** (`scheduler.ts`) — hourly loop, sends progress email, saves snapshots
- **Self-discovery** working — fills queue from live publication feeds when empty
- **Corpus coverage:** ~585,576 Railway sections + 914,274 Neon legacy = ~1.5M total
- **Hansard gap:** ~5,544 queue rows done, 0 corpus_sections — content in R2 only
- **ECHR/FCA gaps:** smaller but same pattern

## DEPLOYMENT

- Ingest workers: Railway (20 services)
- Scheduler: Railway (1 always-on service — `ecosystem.config.js`)
- DB: Railway PostgreSQL (`switchback.proxy.rlwy.net:16156`)
- R2: Cloudflare `scrutinise-legislation` bucket
- Web app: Vercel (scrutinise.org)
