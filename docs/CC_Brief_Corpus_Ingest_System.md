# CC Brief — Scrutinise Corpus Ingest System
**Base commit:** `79d83be` on `main`  
**Scope:** Full corpus ingest pipeline — Railway workers, R2 storage, checkpoint coordination, progress reporting  
**Do not touch:** Any Lex, idea flow, sidebar, or stage-transition code. This is infrastructure only.

---

## Overview

We are building a multi-worker corpus ingest system that fetches, compiles, and stores the full UK legal corpus into R2. The system must:

- Run as **10 independent Railway worker services** (long-running Node processes — no HTTP port)
- Use **R2 as the coordination and storage layer** — checkpoint state lives in R2 so any worker can resume on any machine
- **Never duplicate work** — workers claim sections via atomic R2 checkpoint writes
- **Compile text** using Gemini 2.5 Flash (legislation) or Claude Haiku (everything else)
- **Send a 4-hourly progress email** via Resend to `cl@scrutinise.org`
- **Write a daily CSV** to R2 for drill-down inspection
- **Never store compiled text or raw XML in PostgreSQL** — Railway/Neon is metadata + R2 keys only

---

## Architecture

```
R2 bucket: scrutinise-legislation
  ingest-checkpoint/
    worker-1.json        ← each worker's resume state
    worker-2.json
    ...
    worker-10.json
    corpus-progress.json ← aggregate written every 4hrs by scheduler worker
  ingest-csv/
    progress-YYYY-MM-DD.csv
  legislation/{docId}/sections/{sectionRef}/compiled.txt   ← existing pattern
  hansard/{debateId}/compiled.txt
  caselaw/{caseRef}/compiled.txt
  ... (same R2-first pattern already established)
```

### Worker types

Each worker is a Railway service with `WORKER_ID` env var (1–10). On startup it reads its checkpoint from R2, determines what to do next, and loops until complete.

```
Worker 1  — Primary Acts pre-2000     → Phase 2: Hansard Commons A
Worker 2  — Primary Acts 2000+        → Phase 2: Hansard Commons B  
Worker 3  — SIs pre-2010              → Phase 2: Hansard Lords A + Committees A
Worker 4  — SIs 2010+                 → Phase 2: Hansard Lords B + Committees B
Worker 5  — Regional (Scot/Wales/NI)  → Phase 2: BAILII phase 1 (tribunals)
Worker 6  — Retained EU Law           → Phase 2: BAILII phase 2 (EAT + employment)
Worker 7  — FCA + Regulators          → Phase 2: BAILII phase 3 (Privy Council/NI)
Worker 8  — HMRC✅ + Codes + Expl Notes + IAs + Consultations + NAO + HoCL
Worker 9  — TNA Find Case Law API (2001+) + leading cases curated set
Worker 10 — ECHR/HUDOC + EUR-Lex + UK Treaties + OECD free tier
```

Workers 1–4 handle TNA CLML (legislation.gov.uk). Workers 5–7 handle TNA first then switch to BAILII. Workers 8–10 handle varied sources. Each has its own rate limit floor.

---

## File structure

Create all new files under `scripts/ingest/`:

```
scripts/ingest/
  shared/
    r2-client.ts          ← R2 get/put/list (reuse @aws-sdk/client-s3 already in project)
    checkpoint.ts         ← read/write worker checkpoint to R2
    adaptive-throttle.ts  ← existing AdaptiveThrottle class, move here
    compile.ts            ← compile section text using Gemini or Haiku
    progress-reporter.ts  ← aggregate stats, write CSV, send Resend email
    db-metadata.ts        ← write metadata row to PostgreSQL (R2 key, section ref, status)
  sources/
    tna-legislation.ts    ← fetch CLML XML from legislation.gov.uk, enumerate sections
    tna-caselaw.ts        ← TNA Find Case Law API client
    bailii-scraper.ts     ← BAILII HTML scraper
    parliament-api.ts     ← api.parliament.uk client (Hansard + committees)
    fca-handbook.ts       ← FCA Handbook API
    gov-scraper.ts        ← generic gov.uk document scraper (HMRC, NAO, HoCL, etc.)
    echr-hudoc.ts         ← HUDOC API client
    eurlex.ts             ← EUR-Lex API client
    oecd-free.ts          ← OECD iLibrary free tier scraper
  workers/
    worker-main.ts        ← entry point, reads WORKER_ID, dispatches to correct source
    phase-router.ts       ← determines whether worker is in Phase 1 or Phase 2
  scheduler.ts            ← runs on a cron, writes aggregate progress, sends email
  tsconfig.json           ← extend root tsconfig, add paths for @aws-sdk
```

---

## Implementation details

### 1. Checkpoint schema (`R2: ingest-checkpoint/worker-N.json`)

```typescript
interface WorkerCheckpoint {
  workerId: number;
  phase: 1 | 2;
  corpus: string;              // e.g. "primary-acts-pre-2000"
  lastProcessedId: string;     // doc ID or section ref — resume from here
  totalInCorpus: number;       // estimated total (updated as we enumerate)
  completed: number;
  failed: number;
  skipped: number;             // already compiled (R2 key exists)
  lastUpdated: string;         // ISO timestamp
  phase1Complete: boolean;
  errors: Array<{ id: string; error: string; ts: string }>;  // last 50 only
}
```

On startup: read checkpoint from R2. If none exists, initialise with `completed: 0`. On each successful section: increment `completed`, write checkpoint to R2. Write frequency: every 100 sections, not every section (R2 Class A ops cost).

### 2. Deduplication / skip logic

Before compiling any section, check if `compiled.txt` already exists in R2:

```typescript
// Workaround: HeadObject is cheaper than GetObject for existence checks
const exists = await r2HeadObject(compiledKey);
if (exists) {
  checkpoint.skipped++;
  continue;  // don't recompile
}
```

This means restarting a worker after interruption is safe — it skips already-done work.

### 3. TNA legislation source (`tna-legislation.ts`)

Legislation.gov.uk API pattern (already established in project):

```
GET https://www.legislation.gov.uk/{type}/{year}/{number}/data.feed
  → enumerate sections

GET https://www.legislation.gov.uk/{type}/{year}/{number}/section/{N}/data.xml
  → CLML XML for one section
```

Worker 1 processes `ukpga` (UK Public General Acts) with year ≤ 1999.  
Worker 2 processes `ukpga` year ≥ 2000.  
Workers 3–4 process `uksi` split by year 2010.  
Worker 5 processes `asp` (Scottish) + `anaw` (Welsh) + `nia` (NI).  
Worker 6 processes `eudn`/`eur` (retained EU).

Rate limit: **200ms floor**, AdaptiveThrottle doubles on 429, reduces 10% after 50 clean requests, floor 100ms.

### 4. Compilation (`compile.ts`)

For legislation (Gemini):

```typescript
const prompt = `Convert this CLML XML section into clean, readable plain text suitable 
for legal research. Preserve all legal meaning, section numbers, cross-references, 
and defined terms. Remove XML markup. Output plain text only — no preamble.

CLML XML:
${rawXml}`;

// Use gemini-2.5-flash — not gemini-2.5-flash-preview or any other variant
// 404 errors arise from incorrect model strings
```

For all other sources (Haiku):

```typescript
// Use claude-haiku-4-5-20251001 via Anthropic SDK
// More extractive than interpretive — just clean the text, don't summarise
const prompt = `Extract clean readable plain text from this document. 
Preserve all factual content, headings, numbered points, and citations. 
Remove HTML/XML markup and boilerplate navigation. Output plain text only.

CONTENT:
${rawContent}`;
```

Compilation fallback chain (already established — preserve it):
1. Gemini 2.5 Flash → if rate limited, 2. Claude Haiku → if rate limited, exponential backoff wait

### 5. TNA Find Case Law API (`tna-caselaw.ts`)

Worker 9 uses the official TNA Find Case Law API:

```
Base URL: https://caselaw.nationalarchives.gov.uk/search/results.json
Params: ?query=*&page=N&per_page=50&order=date
→ returns paginated judgment list with neutral citations

GET https://caselaw.nationalarchives.gov.uk/{citation}/data.xml
→ LegalDocumentML XML for one judgment
```

Open Justice Licence explicitly permits bulk ingest. Rate limit: **200ms floor** (same TNA infrastructure as legislation, but different subdomain → treat as independent for throttle purposes).

### 6. BAILII scraper (`bailii-scraper.ts`)

BAILII has no API. Scrape HTML but compile only the text content, not BAILII's HTML markup (BAILII owns the markup; judgment text is Crown copyright / OGL).

```
Start: https://www.bailii.org/databases.html → enumerate databases
Per database: https://www.bailii.org/{jurisdiction}/{court}/ → case list
Per case: https://www.bailii.org/{jurisdiction}/{court}/{year}/{ref}.html
  → extract text between <div class="judgment-body"> or similar
  → strip all HTML tags → compile plain text
```

Rate limit: **1000ms floor** (BAILII is a charity running on minimal infrastructure — do not hammer it). AdaptiveThrottle same logic but floor never drops below 1000ms.

Important: `robots.txt` on BAILII does not prohibit scraping, but respect crawl-delay if present.

### 7. Parliament API (`parliament-api.ts`)

```
Base: https://api.parliament.uk/v1/
Hansard:    GET /hansard/search?house=Commons&startDate=YYYY-MM-DD&endDate=...
Committees: GET /committees and GET /committees/{id}/publications
Bills:      bills.parliament.uk API (separate endpoint)
```

Rate limit: **500ms floor**.

### 8. HUDOC API (`echr-hudoc.ts`)

```
GET https://hudoc.echr.coe.int/app/query/results
  ?select=itemid,docname,doctypebranch,applicability,importance,kpdate
  &query=contry:GBR  ← filter UK cases initially
  &start=0&length=50
→ paginated results

GET https://hudoc.echr.coe.int/app/conversion/pdf/?library=ECHR&id={itemid}&filename={docname}.pdf
→ full judgment as PDF — extract text server-side
```

Rate limit: **500ms floor**.

### 9. EUR-Lex API (`eurlex.ts`)

```
EUR-Lex SPARQL endpoint or REST:
GET https://eur-lex.europa.eu/search.html?type=quick&lang=en&...
Or use: https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri={celex}
```

Filter to the ~4,000 instruments that became UK retained EU law (cross-reference against legislation.gov.uk `eudn`/`eur` metadata already ingested).

Rate limit: **500ms floor**.

### 10. Progress reporter (`progress-reporter.ts`)

Runs as a cron inside the scheduler service (Railway cron, every 4 hours: `0 */4 * * *`).

Steps:
1. Read all 10 `ingest-checkpoint/worker-N.json` files from R2
2. Aggregate into summary object
3. Write `ingest-checkpoint/corpus-progress.json` to R2
4. Append row to daily CSV at `ingest-csv/progress-YYYY-MM-DD.csv` in R2
5. Send email via Resend to `cl@scrutinise.org`

Email format (plain text):

```
Scrutinise Corpus Ingest — Progress Report
[timestamp BST]

PHASE 1 LEGISLATION
  Worker 1  Primary Acts pre-2000   :  12,450 / 90,000 sections (13.8%)  ✓
  Worker 2  Primary Acts 2000+      :   8,200 / 90,000 sections ( 9.1%)  ✓
  Worker 3  SIs pre-2010            :  45,000 / 300,000 sections (15.0%) ✓
  Worker 4  SIs 2010+               :  31,000 / 300,000 sections (10.3%) ✓
  Worker 5  Regional                :  22,000 / 160,000 sections (13.8%) ✓
  Worker 6  Retained EU             :   5,400 / 80,000 sections  ( 6.8%) ✓
  Worker 7  FCA + Regulators        :  18,000 / 198,000 sections ( 9.1%) ✓
  Worker 8  Codes + Guidance        :   9,100 / 250,000 sections ( 3.6%) ✓
  Worker 9  TNA Case Law            :  25,000 / 400,000 sections ( 6.3%) ✓
  Worker 10 International           :   3,200 / 305,000 sections ( 1.0%) ✓

TOTAL: 179,350 / 2,183,000 sections compiled (8.2%)
Estimated completion: [calculated from current rate]

Errors (last 4hrs): 12 sections failed — see daily CSV in R2 for details.
```

CSV columns: `timestamp, worker_id, corpus, completed, total, pct_complete, errors_4hr, rate_per_hr`

### 11. PostgreSQL metadata schema

Add a new table for ingest tracking (do not modify existing `legislation` table structure):

```sql
CREATE TABLE corpus_sections (
  id            TEXT PRIMARY KEY,     -- unique key: "{corpus}:{docId}:{sectionRef}"
  corpus        TEXT NOT NULL,        -- e.g. "primary-acts", "hansard-commons"
  source_url    TEXT,
  r2_key        TEXT,                 -- compiled text location in R2
  r2_raw_key    TEXT,                 -- raw XML/HTML location in R2 (optional)
  compiled_at   TIMESTAMPTZ,
  word_count    INTEGER,
  status        TEXT DEFAULT 'pending', -- pending | compiled | failed | skipped
  error_msg     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_corpus_sections_corpus  ON corpus_sections(corpus);
CREATE INDEX idx_corpus_sections_status  ON corpus_sections(status);
```

Run migration via Prisma: add model to `schema.prisma`, run `npx prisma migrate deploy`.

### 12. Railway deployment

Each worker is a separate Railway service in the existing `miraculous-nature` project.

`package.json` in `scripts/ingest/`:
```json
{
  "scripts": {
    "worker": "tsx worker-main.ts",
    "scheduler": "tsx scheduler.ts"
  }
}
```

Railway service config per worker:
- **Start command:** `npm run worker`
- **Environment variables:**
  - `WORKER_ID=1` (through 10)
  - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (same as main app)
  - `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`
  - `DATABASE_URL` (same Railway PostgreSQL)
  - `RESEND_API_KEY` (same as main app — scheduler only)
- **No public domain** (worker services have no HTTP port)
- **Restart policy:** Always restart on failure

Scheduler service (11th Railway service):
- **Start command:** `npm run scheduler`  
- **Cron:** Set Railway cron to `0 */4 * * *`

### 13. Status check CLI script

`scripts/ingest/check-status.ts` — run on demand from any machine:

```bash
cd scripts/ingest && npx tsx check-status.ts
```

Reads `ingest-checkpoint/corpus-progress.json` from R2 and prints the same summary table as the email. No database query needed — R2 checkpoint is the source of truth for status.

---

## Environment variables needed (new ones only)

All existing R2, database, Gemini, Anthropic, and Resend env vars are already set. No new secrets needed in Vercel. These are Railway-worker-only env vars:

- `WORKER_ID` — integer 1–10, set per service in Railway dashboard
- Confirm `GEMINI_API_KEY` is accessible in Railway env (not just Vercel)

---

## What NOT to do

- Do not run `git commit` mid-sprint — single commit script at end as per normal process
- Do not modify any existing Next.js routes, components, or the main `schema.prisma` beyond adding `CorpusSection` model
- Do not store compiled text in PostgreSQL — R2 only
- Do not use `gemini-2.5-flash-preview` or any variant — use `gemini-2.5-flash` exactly
- Do not drop the CLML XML endpoint in favour of HTML — HTML endpoint produces HTML entity corruption (established learning)
- Do not set BAILII rate limit floor below 1000ms — it is a charity on minimal infrastructure

---

## Deliverables for this sprint

1. `scripts/ingest/` directory with all files listed above, fully implemented
2. Prisma migration for `corpus_sections` table
3. Railway deployment instructions (which env vars to set per service) as a `DEPLOY.md` in `scripts/ingest/`
4. `check-status.ts` CLI working and tested locally against R2
5. Workers 1–4 (legislation) started and confirmed running in Railway before handoff
6. Single `commit-all.sh` at end — do not commit mid-sprint

---

## Acceptance criteria

- Worker restarts from correct position after simulated kill (checkpoint resume works)
- Two workers do not compile the same section (skip-if-exists logic confirmed)
- 4-hourly email arrives at `cl@scrutinise.org` with correct counts
- `check-status.ts` outputs correct summary in < 5 seconds
- `corpus_sections` table populating in PostgreSQL with correct `r2_key` values
- Compiled text readable from R2 at expected key paths
