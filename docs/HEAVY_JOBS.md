# HEAVY JOBS — running memory-bound work off ephemeral rented compute

*Companion to `INGEST_PLAYBOOK.md` §20. Written 4 Aug 2026 after the FTS index rebuild
failed three times in three different ways, each one a symptom of having no standard
place to run jobs that do not fit on Railway.*

> **The standing rule lives in `docs/CLAUDE.md` §17 — "Heavy jobs: memory-bound work does
> not run on Railway."** That section carries the three-failure evidence and the decision
> rule for *when* to reach for the runner; this file is the *how*. Read §17 first if you
> are deciding whether a job belongs here, and `INGEST_PLAYBOOK.md` §20 for the
> rebuild-after-backfill rule that most often sends work this way.

---

## What this is for

Any job that is **single-process, memory-bound, and run rarely**: search-index builds,
vector/ANN builds, full-corpus re-derivations. If something OOMs on Railway, it belongs
here rather than being nursed into fitting.

**Why not Railway.** Railway's headline "48 GB per service" is an aggregate across
replicas — a single-process job only ever gets the **per-replica** limit. Measured on
`fts-build`: `LIMIT=8000000000` (8 GB). The FTS index build peaks at **19.8 GB**, so
Hobby cannot run it at any setting, and Pro's 24 GB would be uncomfortably close.

## The one command

```bash
cd scripts/ingest
tsx ../ops/heavy-job/run.ts list                 # what jobs exist
tsx ../ops/heavy-job/run.ts plan  fts-index      # INERT: validate + price, create nothing
tsx ../ops/heavy-job/run.ts run   fts-index      # provision → run → verify → DESTROY → cost
tsx ../ops/heavy-job/run.ts reap                 # destroy any orphaned box (see below)
```

`run` destroys the server in a `finally` — on success, on failure, on a thrown error.
`--keep` opts out and says so loudly. **Teardown is the default because a forgotten
64 GB box is the only way this becomes expensive** (one was left idle and billing for
four days in July).

### If your session dies mid-run

Only the orchestrator can delete the server — the Hetzner token is deliberately never
placed on the box. So if the terminal is killed, **run `reap`**. It finds every server
named `scrutinise-heavy-*` and destroys it. Run it after any abnormal exit.

## Environment required

| Variable | Where | Used for |
|---|---|---|
| `HETZNER_API_TOKEN` | `scrutinise-web/.env` | create/destroy the server (never copied onto the box) |
| `NEON_DATABASE_URL` | `scrutinise-web/.env` | copied onto the box — the corpus DB |
| `CLOUDFLARE_R2_ACCOUNT_ID` / `_ACCESS_KEY_ID` / `_SECRET_ACCESS_KEY` / `_BUCKET_NAME` | `scrutinise-web/.env` | copied onto the box — Lance datasets live on R2 |

The box clones `Main` and runs `npm install` in `scripts/ingest`, so **the job's code
must be pushed before you run it**. R2 egress is free, so data transfer costs nothing.

## Choosing a size — read this before adding a job

Sizes are a **preference list** per job (`jobs.ts`), and the runner picks the first one
that is actually available, because two things will otherwise waste your time:

- **Account quota.** Hetzner enforces a per-account *dedicated-core* limit. `ccx43`
  (16 dedicated cores) was refused outright with `resource_limit_exceeded` — the same
  wall the vector rebuild hit in July. Shared-vCPU types (`cx`/`cpx`) do not draw on it.
- **Stock.** `cx53` was unavailable in every EU region on 4 Aug. The runner reads
  `/datacenters` → `server_types.available` and only attempts real placements, rather
  than probing combinations. (`datacenter` as a create field was deprecated 2025-12-16;
  use `location`.)

x86 only — the Lance native bindings are untested on ARM (`cax*`).

## Known jobs

| Job | Peak RSS (measured) | Size used | Runtime | Cost |
|---|---|---|---|---|
| `fts-index` | **19.8 GB** @ 17.7M rows (4 Aug 2026) | `cpx62` — 16 vCPU / 32 GB | 499 s build, 10.1 min box | **€0.049** |
| `vector-index` | ~32 GB (Jul 2026, needed `VECTOR_SKIP_COMPACT`) | `ccx43` — 64 GB | hours | ~€1–2 |

Record the peak from every run. The number above is why sizing is now evidence rather
than argument.

## Verifying success

The job's own `verify` command runs on the box straight after it (`jobs.ts`), so the log
carries the proof. For `fts-index` that is `fts-optimize.ts --verify-only`, which must
report **`unindexed=0`** with the row count unchanged.

Then, and this is easy to forget: **redeploy `fts-serve`**. It calls `openTable()` once
at boot with no read-consistency interval, so it holds a fixed snapshot and will keep
serving the old index however well the rebuild went. Without the restart the
after-measurement is meaningless.

## Confirming teardown

```bash
tsx ../ops/heavy-job/run.ts reap     # "no runner-created servers exist" = clean
```
The run's own output also ends with a cost line naming the size, minutes alive and
charge, so spend is visible per run rather than discovered on a bill.
