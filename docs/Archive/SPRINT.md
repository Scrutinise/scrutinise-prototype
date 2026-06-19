# SPRINT — Scheduler fix + autonomous pipeline hardening
**Written by CCh — 3 Jun 2026 ~11:35 BST**
**For:** CC (Claude Code)
**Read first:** CLAUDE.md §0 (verify before asserting), then this file top to bottom.

---

## CONTEXT — what has been built

20 Railway workers ingesting UK legal corpus into PostgreSQL + R2.
Architecture: central `ingest_queue` table, workers claim rows via `FOR UPDATE SKIP LOCKED`,
per-source rate-limit token bucket in `source_rate_limits` table, self-discovery when queue empties.
Scheduler runs `scheduler.ts` as always-on Railway service, fires hourly, sends progress email.

Current corpus coverage: ~21% (1,490,735 / 7,075,050 est. sections).
Latest commit on main: `fc1a172` (self-discovering workers sprint).

---

## IMMEDIATE ISSUE — Scheduler email crash (fix this first)

### Symptom
Scheduler runs every hour but **every email send fails** with:
```
RangeError: Invalid count value
  at String.repeat (<anonymous>)
  at progressBar (/app/shared/progress-reporter.ts:302:35)
  at sendProgressEmail (/app/shared/progress-reporter.ts:394:17)
```

### Root cause
`String.repeat(n)` throws if `n` is negative or NaN.
In `progressBar()` at line ~302, the empty-bar portion is computed as `barWidth - filled`.
If `filled > barWidth` (happens when compiled > estSections for any source, or when
percentage calculation produces > 100%), `barWidth - filled` is negative → throws.

### Fix
In `progress-reporter.ts`, find `progressBar()`. Add a clamp:
```typescript
// Clamp filled to [0, barWidth] — prevents RangeError if compiled > estSections
const filled = Math.min(barWidth, Math.max(0, Math.round((pct / 100) * barWidth)))
const empty = barWidth - filled  // now guaranteed >= 0
```

Also clamp `pct` to `[0, 100]` before the bar calculation:
```typescript
const pct = Math.min(100, Math.max(0, (compiled / estimated) * 100))
```

Do NOT just read the whole progress-reporter.ts — search for `String.repeat` or `progressBar`
and read only that function (likely 15–20 lines). Fix in place.

### Verify
Run the scheduler locally to confirm no throw:
```bash
cd C:/Code/scrutinise-prototype
NODE_PATH=scrutinise-web/node_modules scrutinise-web/node_modules/.bin/tsx \
  --tsconfig scripts/tsconfig.json scripts/ingest/scheduler.ts
```
Expect: email sends, no RangeError. Cancel after first run (Ctrl+C).

---

## PART 2 — Worker throughput in email

After fixing Part 1, add per-worker throughput to the email.

### What to add
Query `ingest_progress_snapshots` for the two most recent rows per worker.
Compute delta (sections compiled in interval) and rate (sections/hour).

Target email section (append after corpus manifest):
```
— WORKER THROUGHPUT (last 1h) —
Worker  1    310 secs/hr  ████
Worker  2    295 secs/hr  ███▌
...
Worker  7      0 secs/hr  ⚠️  stalled
...
Total: 4,820 secs/hr across 20 workers
Stalled workers: 7, 12, 15
```

### Rules
- Worker with 0 sections in the interval AND previous interval also 0 = stalled, flag ⚠️
- Worker with 0 sections but previous interval > 0 = possibly idle (no queue rows), flag ℹ️
- List stalled worker IDs in the email summary line so they're visible at a glance
- Do NOT read all of progress-reporter.ts — find the `sendProgressEmail` function signature
  and append the worker section at the end of the email body

### Schema note
`ingest_progress_snapshots` columns: `id`, `capturedAt`, `workerLabel`, `sourceKey`,
`sectionsCompiled`, `sectionsEstimated`, `phase`. Query by `capturedAt DESC LIMIT 40`
to get last two snapshots for all 20 workers.

---

## PART 3 — Diagnose why workers are producing near-zero output

### Symptom
Scheduler logs show: `new pipeline: 576,474` → `576,475` across multiple hours.
20 workers are running but throughput is ~1 section/hour total. Workers are either:
(a) idle — no pending queue rows after 1,360 seeded rows were processed, OR
(b) processing rows but producing 0 sections (silent failure pattern)

### Diagnostic queries (run these, report results before fixing anything)

```sql
-- 1. Queue state
SELECT status, COUNT(*) FROM ingest_queue GROUP BY status;

-- 2. Per-source breakdown
SELECT corpus, status, COUNT(*) 
FROM ingest_queue 
GROUP BY corpus, status 
ORDER BY corpus, status;

-- 3. Recently processed rows (last 2 hours)
SELECT corpus, "docId", status, "updatedAt", "lastError"
FROM ingest_queue
WHERE "updatedAt" > NOW() - INTERVAL '2 hours'
ORDER BY "updatedAt" DESC
LIMIT 30;

-- 4. corpus_sections recent additions
SELECT "sourceKey", COUNT(*), MAX("createdAt") as latest
FROM corpus_sections
WHERE "createdAt" > NOW() - INTERVAL '2 hours'
GROUP BY "sourceKey";
```

Run all four. Report before touching any code.

### Expected outcomes and actions
- If Q1 shows 0 pending rows → queue is empty, self-discovery should be triggering.
  Check worker logs for "self-discovered N new rows" messages.
  If not appearing → self-discovery has a bug. Read `discovery.ts` `discoverForCorpus()`
  and identify which corpus it tries first, what it returns.

- If Q1 shows pending rows but Q4 shows 0 new sections →
  workers are claiming rows and marking done without writing sections.
  Check Q3 for `lastError` values and identify the source clients that are silently failing.

- If Q4 shows sections being added → throughput is real but the snapshot mechanism
  isn't capturing it. Check `ingest_progress_snapshots` for recent rows.

---

## PART 4 — SPRINT.md workflow (implement once, then use going forward)

### What to build
1. Create `docs/SPRINT.md` as an empty file (this file will be the template going forward)
2. Add to `CLAUDE.md` under git discipline section:

```markdown
## Sprint brief protocol
- CCh writes each sprint brief to docs/SPRINT.md before each CC session
- CC reads docs/SPRINT.md at session start using a targeted view (not full file dump)
- CC archives completed sprint to CHANGE_LOG.md at sprint end and clears SPRINT.md
- Never paste the full brief into chat — keep briefs in the file to save context
- When reading large files, always use line-range view or grep — never dump entire files
```

3. Confirm `docs/SPRINT.md` is in `.gitignore` so it doesn't pollute commit history
   (or keep it tracked — either is fine, discuss with CCh if unsure)

---

## PART 5 — Hansard R2 backfill (brief only — implement in next sprint)

Do NOT implement this now. Read and understand, then confirm understanding to CCh.

### The gap
5,544 Hansard monthly chunk rows in `ingest_queue` are marked `done`.
But `corpus_sections` has **0** Hansard rows.
The content exists in R2 under Hansard key patterns from the legacy `worker-main.ts` pipeline.
Workers processed the chunks, found content already in R2, skipped `upsertSection()`, marked done.
Result: ~2M Hansard sections in R2 with no DB record → Lex cannot search them.

### What the backfill script needs to do
1. List all R2 keys matching Hansard patterns (use `r2-client.ts` list functions)
2. For each key, check if a `corpus_sections` row exists with that R2 key
3. If not: fetch from R2, parse text, call `upsertSection()` 
4. Run as a one-off script, not a worker — it's a migration, not ongoing ingest

### Confirm before next sprint
- What are the exact R2 key patterns for Hansard content?
  Check `r2-client.ts` `hansardKey()` function — report the pattern.
- How many R2 keys match that pattern? (R2 list is paginated — estimate from queue row count)
- Is the same gap present for any other source? Check FCA, ECHR, Treaties —
  all had `done` rows but 0 corpus_sections.

Report findings. CCh will write the backfill sprint brief based on confirmed patterns.

---

## AFTER ALL COMMITS

1. `commit-all.sh` at project root — Charlie approves once, CC runs it, then deletes it
2. Do NOT call git during the sprint
3. After push: redeploy `ingest-scheduler` in Railway (picks up progressBar fix)
4. Trigger one local scheduler run to confirm email sends cleanly before waiting for hourly
5. Update `CHANGE_LOG.md` and `handover_summary.md` at sprint end
6. Clear this file (`docs/SPRINT.md`) and note sprint complete in CHANGE_LOG

---

## FILE READING GUIDE — read these sections only, not whole files

| File | What to read | Why |
|------|-------------|-----|
| `scripts/ingest/shared/progress-reporter.ts` | `progressBar()` function only (~15 lines around line 302) | Fix the clamp |
| `scripts/ingest/shared/progress-reporter.ts` | `sendProgressEmail()` signature + email body construction | Add worker throughput section |
| `scripts/ingest/shared/discovery.ts` | `discoverForCorpus()` + `DISCOVERY_CORPUS_ORDER` | Diagnose why self-discovery may not be triggering |
| `scripts/ingest/workers/worker-queue.ts` | The null-handling block (~lines 57–105) | Verify self-discovery is wired correctly |
| `scripts/ingest/shared/r2-client.ts` | `hansardKey()` function only | Confirm R2 key pattern for backfill scoping |

Do not read `scrutinise-web/prisma/schema.prisma` — it is 1,800+ lines and not needed for this sprint.
