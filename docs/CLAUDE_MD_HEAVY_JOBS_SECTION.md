# For CLAUDE.md — Heavy jobs: never Railway, always the runner

*Paste this in as its own numbered section. Charlie: hand CC this file with — "Add this to CLAUDE.md as a new
section, numbered to fit, and cross-reference it from INGEST_PLAYBOOK.md §20 and docs/HEAVY_JOBS.md."*

---

## N. Heavy jobs — memory-bound work does NOT run on Railway

**The rule: if a job is single-process and memory-hungry — index builds, index merges, embedding runs,
corpus-wide rewrites — it runs through the Heavy Job Runner (`scripts/ops/heavy-job/`, documented in
`docs/HEAVY_JOBS.md`). Never on Railway, never locally, and never by shrinking the work until it fits.**

### Why — the evidence, so this isn't relitigated

The FTS index rebuild failed **three times in three different ways**, each a symptom of the same gap: there
was no standard home for memory-bound work.

1. **June:** `createIndex` OOM-looped until `withPosition:false` shrank it enough to fit the then-24 GB
   container.
2. **2 Aug:** `optimize()` OOM'd, then crash-looped **eight times** — deployed with `ON_FAILURE` on a job
   that restarts from zero. ~25 minutes of burnt container time.
3. **3 Aug:** the no-compaction `createIndex` path ran cleanly for 6.5 minutes, climbed smoothly to 6.1 GB,
   and was SIGKILLed against Railway's **measured 8 GB per-replica cap** (`LIMIT=8000000000`).

**The measured peak of that job is 19.8 GB.** No Railway setting could ever have run it. Railway's
"48 GB per service" headline is an **aggregate across replicas** — a single-process job only ever gets the
per-replica limit, and replicas give you more *copies*, not a bigger heap. When it finally ran on a rented
32 GB box it took minutes and cost **€0.049**.

### When to reach for it

Any of these is enough:

- A job dies with no error line (silent SIGKILL = OOM, not a bug in your code).
- You are about to write "let me reduce the batch size / skip a step so it fits".
- You are about to ask Charlie to raise a Railway memory limit.
- The work touches the whole corpus at once (index build/merge, embeddings, a full rewrite).

### How

Jobs are registered by name in `scripts/ops/heavy-job/jobs.ts` — **adding a heavy job is an entry there, not
a new script.** The runner provisions → runs → verifies → **destroys** → reports cost, in one command.

- **Teardown is the default**, in a `finally`. Only `--keep` overrides it, and only for debugging. *A manual
  teardown is how a box billed for four days in July.*
- **Size from evidence.** `jobs.ts` records each job's observed `expectedPeakGb` — fill it in from the run's
  own report. Leave it null until something is measured; never guess a size upward or downward.
- **Placement is read from the API, not assumed.** Three real failures are already handled: dedicated-core
  account quota, out-of-stock server types, and the `datacenter` field deprecated Dec 2025. If placement
  fails, read availability — don't cycle through guesses.
- **Every run prints a cost line** (size, minutes, charge) so spend is visible per run rather than discovered
  on a bill.

### Traps that have already cost us time

- **`optimize()` is the pathological step, not `createIndex`.** It bundles compaction with the index merge and
  has an independent v0.30 memory cost. `FTS_SKIP_COMPACT=true` / `VECTOR_SKIP_COMPACT` exist for exactly
  this — the answer both times was to stop compacting, not to buy memory. *(This was already documented in
  `build-fts-index.ts` and got missed by reading the LanceDB docs first. **Read our own code before the
  internet.**)*
- **`restartPolicy: NEVER` for anything without a checkpoint.** `ON_FAILURE` on a job that restarts from zero
  produces a crash loop, not a retry.
- **Restart `fts-serve` after any index work.** It calls `openTable()` once at boot with no
  `readConsistencyInterval`, so it holds a fixed snapshot — without a restart it keeps serving the old index
  and any after-measurement is meaningless.
- **Match the live index configuration when rebuilding** (currently `withPosition: false`, the no-positions v1
  build). Rebuilding with different settings silently changes ranking. Confirm before running; never assume.
- **`/stats` counters are since-boot**, so a redeploy resets them. Keep the pre-change numbers as the baseline
  of record and compare like-for-like.

### The standing rule this pairs with

`INGEST_PLAYBOOK.md` §20: **after any backfill or large append, rebuild/merge the index before it serves
users.** A LanceDB append leaves the new rows searchable by brute-force scan — correct, but every subsequent
query pays for them forever. That is what made warm p50 26 seconds while everything still "worked".
