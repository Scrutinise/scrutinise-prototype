# V.3-B-opt — Rewrite UKSI ingest pipeline in pure TypeScript

**Sprint owner:** CC
**Sprint goal:** Replace the PowerShell-helper-based UKSI ingest pipeline with a pure TypeScript implementation that is faster, testable, and free of cross-language encoding bugs.
**Estimated effort:** 2 sprints

---

## Background and rationale

V.3-B Phase 3 completed in 24 hours for 60,167 items (~700/hr). Three sources of overhead dominate the runtime:

1. PowerShell process spawn per item (~200-500ms each)
2. Per-section Prisma writes (no batching)
3. Per-section R2 writes (no batching, no parallelism)

V.3-G (devolved secondary, ~37,000 items) at the current rate would take ~50 hours. NISR, SSI, WSI corpora exist; ingest cost compounds across each.

Additionally: V.3-B Phase 3 lost ~5 hours of engineering time to a Windows PowerShell stdout encoding bug that pure-TypeScript code would not have produced. The bug class is eliminated by removing PowerShell from the path.

## Goals

| Goal | Target |
|---|---|
| Throughput | ≥10,000 items/hour for typical workloads (15-25× current) |
| Test coverage | >80% unit, smoke integration coverage |
| Encoding bugs | Zero by design (no PowerShell spawn, explicit UTF-8 everywhere) |
| Reusable pattern | Same pipeline shape for V.3-D, V.3-G, V.4-A |
| Verification | Built-in Phase-4-equivalent runs automatically post-ingest |

## Non-goals

- Schema changes (Phase 3 schema is fine)
- New R2 key conventions (keep existing scheme)
- Re-ingesting existing V.3-B data (records are correct)
- FTS or embeddings integration (separate workstream)

## Architecture

### Stack

| Concern | Library | Reason |
|---|---|---|
| ZIP reading | `adm-zip` | Node-native, no spawn |
| XML parsing | `fast-xml-parser` | Performant, well-maintained, handles malformed XML gracefully |
| Database | existing Prisma client | Already wired |
| R2 storage | existing `@aws-sdk/client-s3` | Already wired |
| Parallelism | `worker_threads` (Node built-in) | True multi-core, no external dependency |
| Testing | `vitest` | Fast, modern, TypeScript-native |
| Validation | `zod` (already in project) | Type-safe runtime validation |

### Pipeline shape

```
ZIP archive
    │
    ▼
[manifest builder] → manifest.json (one-time, persisted)
    │
    ▼
[main thread]
    │  Partitions manifest into 4 partitions (round-robin by index)
    │  Spawns 4 workers, assigns each a partition
    │
    ▼
[4 × worker_threads]
    │  Each worker:
    │  1. Opens its own ZIP handle, own Prisma client
    │  2. For each item in partition:
    │     a. Extract XML from ZIP (in-memory)
    │     b. Parse with fast-xml-parser
    │     c. Extract title, sections, metadata
    │     d. Build LegislationItem + LegislationSection records
    │     e. Build R2 keys + content blobs
    │     f. Buffer 50 sections; flush as batch (one transaction + parallel R2 puts)
    │  3. Reports progress to main thread via parentPort
    │
    ▼
[main thread]
    │  Aggregates progress, writes checkpoint every 100 completed items
    │  Restarts workers on crash, resumes their partition from last checkpoint
    │
    ▼
[verification]
    │  Random 0.5% sample (cap 500), cross-check Railway ↔ R2 ↔ web
    │  Exit non-zero if verification fails
    │
    ▼
Done
```

### File layout

```
scripts/legislation/v3opt/
├── README.md                    # Pipeline architecture, how to run
├── package.json                 # Dependencies (adm-zip, fast-xml-parser, vitest)
├── tsconfig.json
├── src/
│   ├── manifest.ts              # Build/read manifest from ZIP
│   ├── partition.ts             # Split manifest into N partitions
│   ├── worker.ts                # Worker entry point — runs in worker_thread
│   ├── parser.ts                # XML → structured records (pure, no IO)
│   ├── parseActId.ts            # actId parsing + ISBN filter
│   ├── r2keys.ts                # R2 key builder
│   ├── batch.ts                 # 50-section batch buffer with flush
│   ├── prisma-batch.ts          # Batch DB write (one transaction)
│   ├── r2-batch.ts              # Parallel R2 PUT batch
│   ├── checkpoint.ts            # Progress file read/write
│   ├── verify.ts                # Post-ingest verification
│   ├── log.ts                   # Structured logger
│   └── main.ts                  # Entry point, argument parsing, worker management
├── __tests__/
│   ├── unit/
│   │   ├── parseActId.test.ts
│   │   ├── parser.test.ts
│   │   ├── r2keys.test.ts
│   │   └── batch.test.ts
│   ├── integration/
│   │   ├── pipeline.test.ts
│   │   ├── checkpoint-resume.test.ts
│   │   └── verify.test.ts
│   ├── fixtures/
│   │   ├── small-zip.zip         # 10 representative items
│   │   ├── adversarial.zip       # Curly quotes, em-dashes, accents, ISBN overflow, empty sections
│   │   └── malformed.zip         # Items designed to test error paths
│   └── perf/
│       └── benchmark.ts          # 1,000-item benchmark
└── bin/
    ├── ingest                    # Entry shell script
    ├── verify                    # Standalone verification entry
    └── benchmark                 # Run perf benchmark
```

### Encoding policy

**Mandatory: UTF-8 specified at every encoding boundary.**

- File reads: `fs.readFileSync(path, 'utf8')` or `fs.createReadStream(path, { encoding: 'utf8' })`
- ZIP entry reads: `entry.getData().toString('utf8')`
- String to buffer: `Buffer.from(str, 'utf8')`
- Buffer to string: `buf.toString('utf8')`
- R2 PUT: `ContentType: 'application/xml; charset=utf-8'` or `text/plain; charset=utf-8`

No reliance on system defaults. No PowerShell. No spawned processes.

### Worker / parallelism design

- **WORKER_COUNT** environment variable, default 4, allowed range 1-8
- Each worker spawned via `new Worker(__filename, { workerData: { partition, options } })`
- Each worker maintains its own Prisma client (separate connection from pool)
- Each worker maintains its own R2 client
- Workers communicate progress via `parentPort.postMessage({ type, payload })`
- Message types: `progress`, `item-complete`, `item-error`, `batch-flushed`, `done`
- Main thread coordinates progress aggregation and checkpoint writes
- On worker crash, main thread logs the crash, restarts the worker, worker resumes from its partition's last checkpoint

### Batching

**Database writes:**
- Buffer 50 sections per worker
- Flush triggers: buffer full OR 5 seconds elapsed since first item in buffer
- Single transaction per flush — `prisma.$transaction([...])`
- Rollback on any constraint failure; report which item caused failure; do not crash worker

**R2 writes:**
- Same 50-item buffer
- Parallel PUTs via `Promise.all([put(key1, val1), put(key2, val2), ...])`
- R2 supports this concurrency well; no rate limit issues at 4 workers × 50 batch = 200 in-flight max
- If any PUT fails, mark item as error and continue batch (do not block worker)

### Verification

Built-in to pipeline. After all workers complete:

1. **Sample** 0.5% of completed items, minimum 100, maximum 500
2. **For each sample**:
   - Read Railway record (LegislationItem + LegislationSection counts)
   - Read R2 key(s) — confirm bytes are valid UTF-8 XML
   - Cross-check Railway sectionCount = R2 file count
3. **Web parity** — 20 random items, fetch from `legislation.gov.uk`, compare top-level structural metrics (title match, section count within ±10%)
4. **Output verification report** to `verification-{timestamp}.log`
5. **Exit code**: 0 if all checks pass, non-zero if any fail

Verification failure does NOT roll back the ingest — data is already written. But it does require manual review before declaring sprint complete.

### Test strategy

**Unit tests (`__tests__/unit/`):**
- `parseActId` — normal UKSI, normal UKPGA, ISBN overflow detection, malformed inputs, year normalisation edge cases
- `parser.ts` — extractTitle (dc:title preferred, Title fallback, tag stripping), extractSections (P1group standard, P1 bare fallback, zero-section, mixed)
- `r2keys.ts` — key generation for all sourceTypes, version disambiguation
- `batch.ts` — buffer accumulation, flush triggers (full vs timer), error handling

**Integration tests (`__tests__/integration/`):**
- `pipeline.test.ts` — end-to-end on small ZIP, assert Railway + R2 state matches expected
- `checkpoint-resume.test.ts` — simulate interruption mid-run, resume, confirm idempotency
- `verify.test.ts` — verification logic against known-good and known-bad fixtures

**Adversarial fixtures (`__tests__/fixtures/adversarial.zip`):**
Must include items with:
- Curly Unicode quotes (`"` `"` `'` `'`)
- Em-dashes (`—`)
- Accented characters (`é` `ñ` `ø`)
- Currency symbols (`£` `€`)
- Section symbols (`§`)
- ISBN-overflow actId
- Empty sections / commencement orders
- Bare `<P1>` (no `<P1group>`) sections
- Long content (>50,000 chars) to surface buffer issues

**Performance benchmark (`__tests__/perf/`):**
- 1,000-item benchmark on developer machine
- Target: >5,000 items/hour locally; >10,000 items/hour on Railway production-grade DB
- Run on CI, track regression

**Coverage target:** >80% of `src/` covered by tests. Boundary code (R2 client wrapper, Prisma client wrapper) excluded from coverage target.

## Migration plan

1. **Build** new pipeline as `scripts/legislation/v3opt/` (new directory, parallel to v3b-uksi/, no interaction)
2. **Validate** on 1,000-item pilot from existing UKSI ZIP
3. **Compare outputs** against existing V.3-B Railway records:
   - Sample 100 items already ingested in V.3-B
   - Re-ingest with new pipeline to a test Railway schema
   - Diff: titles, section counts, R2 byte equality, metadata
   - Expected: 100% identical (minus the ingest provenance fields which are new)
4. **Document** any differences and explain (or fix)
5. **Switch over** at V.3-G start: V.3-G uses new pipeline from day one
6. **Sunset** `scripts/legislation/v3b-uksi/` after V.3-G completes successfully (~1 quarter delay, kept for reference)

## Deliverables for sprint close

1. Full `scripts/legislation/v3opt/` codebase
2. Test suite passing (`vitest run`)
3. Benchmark report comparing new pipeline against V.3-B Phase 3 numbers
4. Pilot validation report (`scrutinise-docs/v3opt_pilot_report.md`)
5. Cross-check report against V.3-B data (`scrutinise-docs/v3opt_v3b_comparison.md`)
6. Updated `scrutinise-docs/handoff_summary.md` to v51
7. `commit-all.sh` covering all V.3-B-opt work

## Decisions for CCh to confirm before starting

These are answered already in the brief above; flagged here for explicit confirmation:

| Decision | Choice |
|---|---|
| Parallelism level | 4 workers (configurable 1-8) |
| Batch size | 50 sections per flush |
| Test coverage target | >80% unit, smoke integration |
| R2 key scheme | Keep existing |
| Verification | Built-in to pipeline, not separate script |
| ZIP library | adm-zip |
| XML library | fast-xml-parser |
| Test framework | vitest |

## Out of scope clarification

- This sprint does NOT touch FTS, embeddings, or pgvector — those are V.4-FTS workstream
- This sprint does NOT change Prisma schema — same fields, same constraints
- This sprint does NOT re-ingest existing V.3-B records — they're correct
- This sprint does NOT modify `scrutinise-web/` application code — only the ingest scripts
- This sprint does NOT touch Sentry, Clerk, or other production integrations

## When stuck or making non-obvious choices

If during implementation CC encounters a design decision not specified in this brief, **pause and ask Charlie before deciding**. Examples that would warrant pausing:

- Choosing between two valid libraries
- Choosing between two batching strategies
- Deciding error-handling policy for an edge case
- Performance trade-offs with non-obvious implications

The brief covers the architecture; implementation details may surface decisions that need product judgement.
