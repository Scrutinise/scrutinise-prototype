# BRIEF — Heavy Job Runner: a permanent home for memory-bound index work

**Written:** 04 Aug 2026 (CCh). **Thread:** Lex. **Decision taken by Charlie:** Option B — ephemeral
rented compute, set up once as a documented, repeatable procedure rather than another one-off scramble.

---

## Why this exists (read first — it changes what "done" means)

The FTS index rebuild has now failed **three times in three different ways**, and each failure was a
symptom of the same underlying gap: **we have no standard place to run memory-bound jobs.**

1. **June:** the original `createIndex` OOM-looped on the then-24 GB Railway container until
   `withPosition:false` shrank it enough to fit.
2. **2 Aug:** `optimize()` OOM'd, then crash-looped eight times (`ON_FAILURE` on a non-resumable job).
3. **3 Aug:** the no-compaction `createIndex` path ran cleanly for 6.5 minutes, climbed smoothly to
   6.1 GB, and was SIGKILLed against Railway Hobby's **8 GB per-replica cap** — measured, not inferred
   (`LIMIT=8000000000`).

Railway's "48 GB per service" is an aggregate across replicas; a single-process job can only ever have
the per-replica limit. Hobby therefore **cannot** run this job at any setting. Meanwhile the corpus keeps
growing (statistics stream added; more jurisdictions planned) and the vector index is hungrier than FTS —
so Railway Pro's 24 GB is *also* a ceiling we would eventually hit.

**Therefore the deliverable is not "get the index rebuilt". It is a reusable runner, with the index
rebuild as its first job.** If this ends with a working index but no documented procedure, it has failed:
the next corpus wave repeats the whole episode.

Usual git discipline: no mid-sprint git, one `commit-all.sh` at the end, Charlie approves, CC runs and
deletes it. Do not promote the web app.

---

## Task 1 — Stopgap first (do this before anything else; ~10 minutes)

Every Lex search currently exceeds the 25 s client timeout, so users get "the corpus search didn't
complete" every time and Charlie's Lex testing is blocked. Measured: warm p50 ≈ 26 s, p95 ≈ 35 s.

- Raise `FTS_TIMEOUT_MS` to **40000** in Vercel (Production + Preview) and redeploy.
- Label it in `CHANGE_LOG.md` as **TEMPORARY — revert when the index rebuild lands (Task 4)**, with the
  measured numbers and the reason.
- Confirm a real search now completes end-to-end.

`// Slow results beat no results while Charlie is the only user. This is a mask, and it comes off in Task 4.`

## Task 2 — Audit before building (report, don't assume)

1. **Is there an existing rented-box recipe?** The vector rebuild used a 128 GB Vultr instance. Find
   whatever exists — scripts, env lists, playbook notes, changelog entries — and report whether it is
   reusable as-is, adaptable, or absent. **Do not build a new procedure on top of a forgotten one.**
   *(This is the 3 Aug lesson: the `FTS_SKIP_COMPACT` answer was already in `build-fts-index.ts` and was
   missed by going to the LanceDB docs first. Read our own code before the internet.)*
2. **What does the job actually need to run?** Produce the definitive list: repo checkout, Node version,
   `npm ci` scope, R2 credentials, any DB URLs, the exact command. Anything missing is what makes a
   rented box painful; knowing it in advance is what makes it a 20-minute routine.
3. **Confirm the index configuration to match.** The live index is the no-positions v1 build
   (`FTS_WITH_POSITIONS=false`). A rebuild with different settings silently changes ranking. State
   explicitly which configuration will be used and why before running.

## Task 3 — Build the Heavy Job Runner (the permanent fix)

**Provider:** Hetzner Cloud. **Size for this job:** CCX43 (16 vCPU / 64 GB) — deliberate headroom over
the ~6–8 GB observed and the 24 GB June precedent, because a second OOM costs far more than the extra
few pence. Hetzner bills hourly with a monthly cap and only charges the hourly rate if the server is
deleted before month end, so a 2-hour session is well under €1. R2 has no egress charge, so data
transfer is free.

Deliver **all** of:

1. **`scripts/ops/heavy-job/` — a provisioning script** (Hetzner API or `hcloud` CLI): create server from
   a named size, wait for SSH, bootstrap (Node, git, repo clone at a given ref, `npm ci`), copy the env
   file, run a named job, stream logs, and **destroy the server on completion or failure**.
   - Job selection by name (`fts-index`, `vector-index`, …) so new heavy jobs plug in without new scripts.
   - `--keep` flag to leave the box alive for debugging; default is always destroy.
   - `// Teardown is the default because a forgotten 64 GB box is the only way this becomes expensive.`
2. **Secrets handling:** `HETZNER_API_TOKEN` in `scripts/ingest/.env` (gitignored) alongside the existing
   Railway token. Nothing secret in the repo; the env file is copied to the box and the box is destroyed.
3. **A cost line printed at the end:** size, minutes alive, and the resulting charge, so spend is visible
   per run rather than discovered on a bill.
4. **`docs/HEAVY_JOBS.md`** — the procedure as a document Charlie can follow or hand to anyone:
   what this is for, when to use it (any job that OOMs on Railway), the one-line command, the env vars
   required, expected runtime and cost, how to verify success, how to confirm teardown, and a table of
   known jobs with their observed peak memory and the size chosen. Cross-reference from
   `INGEST_PLAYBOOK.md` and `CLAUDE.md`.

## Task 4 — Run the FTS index rebuild as job #1

1. Record before-numbers (`/stats` cold/p50/p95 + the timed `"data protection"` query).
2. Run `fts-optimize.ts` via the runner on the **no-compaction `createIndex` path** (`optimize()` is the
   pathological step — never re-introduce it; the June workaround stands).
3. Verify `--verify-only` reports **unindexed = 0** and total rows unchanged at 17,700,396.
4. **Redeploy `fts-serve`** — it calls `openTable()` once at boot with no read-consistency interval, so
   without a restart it keeps serving the old snapshot and the after-measurement is meaningless.
5. Re-measure the same three numbers. Expected: the nonsense-word probe (`quokka`, currently 24 s, zero
   matches — pure scan of the unindexed rows) drops to milliseconds, and p50 to single-digit seconds.
6. **Revert `FTS_TIMEOUT_MS` to 25000** and confirm searches still complete comfortably. If p95 still
   brushes 25 s *after* a verified rebuild, report the numbers and hold — do not quietly leave the mask on.
7. Re-run the briefing on idea `06ca807a` and confirm on-topic data-protection results.
8. **Record the peak memory** the job reached at 17.7M rows in `HEAVY_JOBS.md`, so the next size decision
   is evidence-based rather than another guess.

## Task 5 — Close the loop

- `CHANGE_LOG.md` + `handoff_summary.md` entries (currently missing since 2 Aug), including the three-way
  failure history above so it isn't rediscovered.
- `INGEST_PLAYBOOK.md`: the standing rule stays — **after any backfill or large append, rebuild the index
  before it serves users** — now pointing at the runner as *how* to do it.
- Confirm the Hetzner server is destroyed and Railway `fts-build` is parked at zero compute.

## Acceptance criteria

- Stopgap live and labelled; reverted by the end of Task 4.
- A single documented command provisions, runs, verifies, and destroys — proven by an actual run.
- `unindexed = 0`, row count unchanged, `fts-serve` restarted, before/after numbers reported.
- Briefing on `06ca807a` returns on-topic results.
- `docs/HEAVY_JOBS.md` exists and is complete enough that the next rebuild needs no improvisation.
- Peak memory recorded; no server left running; cost of the run stated.
