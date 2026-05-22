# V.3-B-opt — Pure TypeScript UKSI ingest pipeline

Replaces the PowerShell-helper-based V.3-B pipeline. Eliminates the per-item process spawn (~200–500 ms each), adds 4-worker parallelism and 50-section batch writes, and removes the entire PowerShell stdout encoding bug class.

## Setup

```bash
cd scripts/legislation/v3opt
npm install          # installs adm-zip, fast-xml-parser, vitest
npm run build        # compiles src/ → dist/
```

Requires `scrutinise-web/.env` with the standard env vars (DATABASE_URL, CLOUDFLARE_R2_*).

## Running

```bash
# Pilot (100-item stratified sample — run first)
node dist/main.js

# Full ingest (61,179 UKSI)
node dist/main.js --full

# Resume after interruption
node dist/main.js --full --resume

# Standalone verification
node dist/verify.js
```

Worker count and checkpoint directory are configurable:

```bash
WORKER_COUNT=2 CHECKPOINT_DIR=D:/checkpoints node dist/main.js --full
```

## Architecture

```
ZIP archive (read-only, in-memory per worker)
    │
    ▼
[manifest loader] — loads manifest-uksi.json from v3b-uksi/
    │
    ▼
[partition] — round-robin across WORKER_COUNT workers
    │
    ▼
[4 × worker_threads]
    │  Each worker: opens own ZIP handle, own Prisma client, own R2 client
    │  Per item:
    │    1. AdmZip entry.getData().toString('utf8')  — UTF-8, no spawn
    │    2. extractTitle (regex dc:title / Title fallback)
    │    3. extractSections (regex P1group, bare P1 fallback)
    │    4. Dedup sectionNumbers (trim + strip trailing dot; first wins)
    │    5. For each batch of 50 sections:
    │       a. batchR2Put (Promise.allSettled — partial failures safe)
    │       b. batchDbCreate (createMany + skipDuplicates — idempotent on resume)
    │       Only sections whose R2 PUT succeeded are written to DB.
    │       DB rows never point at a missing R2 blob.
    │    6. UPDATE sectionCount
    │  Checkpoint every 100 items per worker
    │
    ▼
[verify] — 0.5% sample, R2 blob check, web parity (20 items)
```

## Key design properties

**R2-before-DB ordering:** R2 PUTs run first via `Promise.allSettled`. Only sections
with a confirmed R2 blob are written to the DB. This prevents dangling FK pointers
(a Railway row whose tnaXmlKey/originalXmlKey points at a missing R2 object).

**Idempotent section writes:** `createMany({ skipDuplicates: true })` on the
`(legislationItemId, sectionNumber)` unique constraint. Safe to re-run after
a crash without duplicate rows.

**UTF-8 throughout:** `entry.getData().toString('utf8')` — no system code page
involved, no PowerShell stdout, no `[Console]::OutputEncoding` workaround needed.

## Tests

```bash
npm test             # vitest run (unit + integration)
npm run test:watch   # watch mode
npm run typecheck    # tsc --noEmit
```

Unit tests (`__tests__/unit/`) are pure — no DB, no R2, no network.
Integration tests (`__tests__/integration/`) exercise adm-zip round-trips and
checkpoint persistence using in-memory ZIPs. No live DB or R2 required.

## Throughput target

≥10,000 items/hour (local developer machine; higher on Railway-adjacent infra).
V.3-B baseline was ~700 items/hour. Expected 15–25× improvement from eliminating
the PowerShell spawn and adding 4-worker + batch parallelism.

## FTS note

`originalText` is tag-stripped and sliced to 10,000 characters (matching V.3-B).
Text beyond 10k chars is stored in R2 only and is not searchable via FTS. This is
a deliberate storage constraint (Railway 5 GB limit) documented in CLAUDE.md §13.
The V.4-FTS-1 sprint builds on this field as-is; see its pilot report for the
FTS quality implications.

## Migration

This pipeline targets the same Railway schema and R2 key scheme as V.3-B.
It is intended for V.3-G and future ingest sprints. Existing V.3-B data is not
re-ingested. `scripts/legislation/v3b-uksi/` remains in place until V.3-G
completes successfully (~1 quarter delay).
