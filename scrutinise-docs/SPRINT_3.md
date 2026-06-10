# SPRINT — Queue gap seeding + R2 backfill + worker efficiency email
**Written by CCh — 3 Jun 2026 ~13:35 BST**
**For:** CC (Claude Code)
**Previous sprint output:** docs/corpus-census.md — read this first for confirmed totals.
**Current state:** 20 workers idle (queue empty). 585,576 / ~5.3M sections compiled (~11%).

Read this file top to bottom. Targeted file reads only — see guide at bottom.
Do not implement later parts before earlier parts are confirmed working.

---

## OBJECTIVE

Three goals in priority order:
1. Fill the queue with confirmed missing work so all 20 workers run continuously
2. Recover content already fetched but not in DB (R2 backfill)
3. Add worker efficiency ratio to the hourly email

---

## PART 1 — SI 2015–2026 reseed (highest priority — do first)

### Problem
Census confirmed: SI 2010+ queue has only 200–324 SIs/year but TNA has 500–1,200/year
for 2015–2026. Approximately 5,000–8,000 missing SI documents (~50–80k sections).
These years were under-seeded in the original queue-populator run.

### Fix
In `queue-populator.ts` (or as a standalone reseed script), enumerate TNA for UKSI
years 2010–2026 and insert any missing queue rows.

Read only the SI seeding section of `queue-populator.ts` — search for `uksi` or
`si-post-2010` and read ~30 lines around it.

The fix: for each year 2010–2026, query TNA for total SI count that year, then
compare against how many queue rows exist for that year. Seed any missing rows.

```typescript
// scripts/ingest/reseed-si-gaps.ts
// Run once — idempotent (ON CONFLICT DO NOTHING)

const years = Array.from({length: 17}, (_, i) => 2010 + i) // 2010–2026
for (const year of years) {
  // Query TNA for all SIs in this year
  const url = `https://www.legislation.gov.uk/uksi/${year}/data.feed?results-count=200`
  // Parse Atom feed, extract all docIds
  // Check which docIds already exist in ingest_queue
  // Insert missing rows with source_key='tna-legislation', corpus='si-post-2010', priority=1
  // Report: year, TNA count, queue count before, rows inserted
}
```

Also do the same for UKSI pre-2010 years not yet fully covered — query census.md for
which pre-2010 years had gaps.

Report total rows inserted before proceeding.

### Also reseed these confirmed gaps from census:
- Primary Acts pre-1963 — 7,427 UKPGA items in Neon with zero sections.
  These are likely very short or empty acts. Seed queue rows for each item ID
  from Neon that has zero LegislationSections. Workers will attempt compilation
  and mark unavailable if genuinely empty. Priority=3 (lower — older, less relevant).
- Regional legislation gaps — check census.md for ASP, WSI, NISR year gaps,
  reseed same way as SI.

---

## PART 2 — R2 backfill: write corpus_sections for content already fetched

### Problem
Content exists in R2 but not in corpus_sections. Workers processed these queue rows,
stored content in R2, but never called upsertSection(). Confirmed gaps:
- Hansard: 5,544 queue rows done → 0 corpus_sections
  R2 key pattern: `hansard/{YYYY-MM-DD}/{safe-debateId}/compiled.txt`
- ECHR: 601 queue rows done → 0 corpus_sections
  R2 key pattern: unknown — investigate r2-client.ts
- FCA: 37 queue rows done → 0 corpus_sections
  R2 key pattern: unknown — investigate r2-client.ts
- UK Treaties: 2 queue rows done → 0 corpus_sections

### Step 1 — Confirm R2 key patterns (read only, no writes)

Read `scripts/ingest/shared/r2-client.ts`. Find functions:
- `hansardKey()` — report exact pattern
- Any FCA key function — report pattern, or note it doesn't exist
- Any ECHR key function — report pattern, or note it doesn't exist

If FCA/ECHR have no key function, list actual R2 keys under those prefixes:
```typescript
// List R2 keys to find pattern
const list = await r2.list({ prefix: 'fca/' }) // try common prefixes
// Try: 'fca/', 'echr/', 'hudoc/', 'handbook/'
// Report the first 10 keys found under each prefix
```

Report key patterns before writing any backfill code.

### Step 2 — Hansard backfill script

```typescript
// scripts/ingest/backfill/hansard-backfill.ts
// Walks R2 under 'hansard/' prefix, checks for missing corpus_sections rows,
// writes any missing rows. Run once — idempotent.

import { r2 } from '../shared/r2-client'
import { upsertSection } from '../shared/db-metadata'

async function backfillHansard() {
  let cursor: string | undefined
  let processed = 0, inserted = 0, skipped = 0

  do {
    const list = await r2.list({ prefix: 'hansard/', cursor, limit: 1000 })
    
    for (const obj of list.objects) {
      // Only process compiled.txt keys, not raw/
      if (!obj.key.endsWith('/compiled.txt')) continue
      
      // Check if corpus_sections row exists for this R2 key
      const exists = await checkCorpusSectionExists(obj.key)
      if (exists) { skipped++; continue }
      
      // Fetch content from R2
      const content = await r2.get(obj.key)
      const text = await content?.text()
      if (!text || text.length < 50) { skipped++; continue }
      
      // Derive metadata from key: hansard/{date}/{debateId}/compiled.txt
      const parts = obj.key.split('/')
      const date = parts[1]
      const debateId = parts[2]
      
      await upsertSection({
        sourceKey: 'hansard',
        actId: debateId,
        sectionId: `hansard:${debateId}`,
        title: `Hansard debate ${date}`,
        compiledText: text,
        wordCount: text.split(/\s+/).length,
      })
      inserted++
    }
    
    cursor = list.truncated ? list.cursor : undefined
    processed += list.objects.length
    console.log(`[backfill] Hansard: ${processed} R2 keys checked, ${inserted} inserted, ${skipped} skipped`)
    
  } while (cursor)
  
  console.log(`[backfill] Hansard complete: ${inserted} sections written to corpus_sections`)
}
```

### Step 3 — FCA and ECHR backfill scripts

Write equivalent scripts once R2 key patterns are confirmed in Step 1.
Same structure as Hansard — list R2, check for missing corpus_sections, write missing rows.

### Step 4 — Run and verify

Run each backfill script and report:
- Hansard: N R2 keys found, N sections inserted
- FCA: N R2 keys found, N sections inserted  
- ECHR: N R2 keys found, N sections inserted

After each run, query:
```sql
SELECT "sourceKey", COUNT(*) FROM corpus_sections
WHERE "sourceKey" IN ('hansard', 'fca', 'echr')
GROUP BY "sourceKey";
```

Verify counts are non-zero and reasonable.

---

## PART 3 — Worker efficiency ratio in hourly email

### What to build
Each worker has a theoretical maximum throughput based on its current source's rate limit.
Actual / theoretical × 100 = efficiency %.

Workers below 60% efficiency consistently indicate a problem worth investigating
(empty responses, high retry rate, slow DB writes, etc.)

### Theoretical throughput per source
```typescript
// Add to progress-reporter.ts near CORPUS_MANIFEST
// Source: rate-limit intervals from source_rate_limits table
const THEORETICAL_SECTIONS_PER_HOUR: Record<string, number> = {
  // (3600 * 1000 / intervalMs) * avgSectionsPerRequest
  // TNA legislation: 200ms interval, avg ~5 sections/request
  'tna-legislation': Math.floor((3600_000 / 200) * 5),   // ~90,000/hr theoretical max
  // TNA caselaw: 200ms interval, avg 1 judgment = ~3 sections
  'tna-caselaw': Math.floor((3600_000 / 200) * 3),        // ~54,000/hr
  // Parliament/Hansard: 500ms interval, avg ~20 sections/debate
  'hansard': Math.floor((3600_000 / 500) * 20),           // ~144,000/hr
  // FCA: 300ms interval, avg ~10 sections/page
  'fca': Math.floor((3600_000 / 300) * 10),               // ~120,000/hr
  // HMRC: 300ms interval, avg ~8 sections/page
  'hmrc': Math.floor((3600_000 / 300) * 8),               // ~96,000/hr
  // ECHR: 500ms interval, avg 50 cases/page × 1 section
  'echr': Math.floor((3600_000 / 500) * 50),              // ~360,000/hr
  // EUR-Lex: 500ms interval, avg 10 docs/page × 5 sections
  'eurlex': Math.floor((3600_000 / 500) * 10),            // ~72,000/hr
  // Default for unknown sources
  'default': 1_000,
}
```

Note: these are theoretical maxima assuming every request succeeds and returns full content.
Real throughput will be lower. The ratio tells us how far below theoretical we are.

### Email format addition

In `queryWorkerThroughput()`, for each worker:
1. Look up current source from latest snapshot's `sourceKey`
2. Look up theoretical max for that source
3. Compute efficiency = `(actualSectionsPerHour / theoreticalMax) * 100`
4. Flag workers below 60% efficiency (⚡low) and below 20% (🔴critical)

```
— WORKER THROUGHPUT (last 1h) —
Worker  1  tna-legislation   4,230/hr  ████▌  theoretical 90k  4.7% ⚡low
Worker  2  hansard           8,100/hr  ████▌  theoretical 144k  5.6% ⚡low
...
```

Note: low efficiency on TNA legislation is expected — 20 workers share one token bucket,
so each worker gets ~1/20th of the theoretical max (90k / 20 = 4,500/hr expected).
Adjust theoretical by dividing by number of workers on the same source:

```typescript
const workersOnSameSource = workerSnapshots.filter(w => w.sourceKey === worker.sourceKey).length
const adjustedTheoretical = theoreticalMax / Math.max(1, workersOnSameSource)
const efficiency = (actualPerHour / adjustedTheoretical) * 100
```

This makes efficiency meaningful — a worker at 80% of its fair share of the token bucket
is healthy; a worker at 10% of its fair share has a problem.

Read only `queryWorkerThroughput()` function in `progress-reporter.ts` —
search for it by name and read ~40 lines. Add the efficiency calculation inline.

---

## PART 4 — Self-discovery: ensure full historical coverage

### Problem
Self-discovery currently re-enumerates only the last 2 years for TNA legislation
(to stay fast). This means historical year gaps found in the census will never be
auto-discovered — workers will exhaust new content and idle again.

### Fix
In `scripts/ingest/shared/discovery.ts`, find the TNA legislation discovery functions.
Read only those functions (~30 lines each).

Change the historical reseed logic:
- On first call after queue empties: enumerate ALL years from 1948 to present
- Track "full reseed done" in `source_rate_limits` using a new field, or simply
  check whether any queue rows exist for pre-2010 years
- On subsequent calls (after full reseed): enumerate only last 3 months (fast, for new content)

```typescript
// In discoverForCorpus() for TNA legislation:
const hasHistoricalRows = await checkHasHistoricalQueueRows('si-pre-2010')
if (!hasHistoricalRows) {
  // First time — do full historical enumeration
  return await enumerateAllYears(1948, 2026)
} else {
  // Subsequent calls — only recent content
  return await enumerateRecentYears(3) // last 3 months
}
```

This ensures the queue never fully empties on historical sources until every year
is genuinely complete.

---

## PART 5 — Verify and report

After completing Parts 1–4, run the following and report to Charlie:

```sql
-- Overall queue state
SELECT status, COUNT(*) FROM ingest_queue GROUP BY status;

-- New corpus_sections counts
SELECT "sourceKey", COUNT(*) as sections, MAX("createdAt") as latest
FROM corpus_sections
GROUP BY "sourceKey"
ORDER BY sections DESC;

-- Updated total
SELECT COUNT(*) as total_sections FROM corpus_sections;
```

Also trigger a local scheduler run to confirm the next email shows:
- Updated section counts (including backfilled Hansard/FCA/ECHR)
- Workers with pending queue rows (from SI reseed)
- Efficiency ratios in worker throughput section

Report the headline numbers:
- Total corpus_sections after backfill
- Total pending queue rows after reseed
- Expected ETA at current 20-worker throughput (from snapshot data)

---

## AFTER ALL COMMITS

1. `commit-all.sh` at project root — Charlie approves once, CC runs, then deletes
2. Do NOT call git during sprint
3. After push: Railway auto-redeploys all workers and scheduler
4. Run reseed script and backfill scripts manually (they're one-off, not deployed)
5. Update `CHANGE_LOG.md` and `handover_summary.md`
6. Clear `docs/SPRINT.md` and note sprint complete

---

## FILE READING GUIDE — targeted reads only

| File | What to read | Why |
|------|-------------|-----|
| `scripts/ingest/queue-populator.ts` | SI seeding section only (~30 lines, search 'uksi') | Understand seeding pattern for reseed script |
| `scripts/ingest/shared/r2-client.ts` | `hansardKey()`, any FCA/ECHR key functions only | Confirm R2 key patterns before backfill |
| `scripts/ingest/shared/discovery.ts` | TNA legislation discovery functions only (~30 lines each) | Fix historical coverage |
| `scripts/ingest/shared/progress-reporter.ts` | `queryWorkerThroughput()` only (~40 lines) | Add efficiency ratio |
| `scripts/ingest/shared/db-metadata.ts` | `upsertSection()` signature only | Confirm params for backfill script |
| `docs/corpus-census.md` | Full file — it's the census output, needed for gap analysis | Know which years/sources to reseed |

Do NOT read: `scrutinise-web/prisma/schema.prisma`, full `progress-reporter.ts`,
full `worker-queue.ts`, full source client files.
