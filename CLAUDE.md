# SCRUTINISE — Claude Code Boot File

This file is auto-read by Claude Code on every session start and after `/clear`.

**Read these files before writing any code:**

1. `docs/CLAUDE.md` — project rules, terminology, architecture, git policy
2. `docs/entity_list_v5.md` — every DB entity and field (never edit without Charlie's instruction)
3. `docs/system_mechanics_v0_8.md` — current business rules
4. `docs/handoff_summary.md` — current sprint state and where we left off

The active sprint brief is referenced in `handoff_summary.md` — check there for the current `*_CC_Brief.md` file.

## Git — commit & CHANGE_LOG timestamping

**Always record a date *and time* stamp** so the history can be matched to when something
happened (e.g. to line up a CHANGE_LOG entry with the commit active when an error occurred).
Two places, the same stamp:

**Use UTC for every timestamp** — commit trailers, CHANGE_LOG headings, and any log
times you compare. (A BST↔UTC mixup once caused a false "build hung" diagnosis; UTC-only
removes that whole class of error.)

1. **Every commit message** carries a `Date:` trailer in `YYYY-MM-DD HH:MM` 24-hour **UTC**,
   on its own line in the body alongside `Co-Authored-By:`:

   ```
   Date: 2026-06-20 09:58 UTC
   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   ```

2. **Every `CHANGE_LOG.md` entry** leads with that same `YYYY-MM-DD HH:MM UTC` stamp in its
   heading, so scanning the file shows which change shipped when.

Get the stamp from the **actual system clock in UTC** at commit time — run
`[DateTime]::UtcNow.ToString("yyyy-MM-dd HH:mm")` (the session `currentDate` gives only the
date, not the time, and the date can roll over mid-session). Never guess or copy a stamp
forward, and never use local-time `Get-Date` for a stamp or a log comparison. This applies
to every commit, including each one inside `commit-all.sh` (give each its own real stamp).
See `docs/CLAUDE.md` §12 for the rest of the git policy (single end-of-sprint
`commit-all.sh`, no git mid-sprint).

**Carve-out — build-breaking fixes ship immediately.** A fix for a broken build/deploy
(e.g. a type error failing the Vercel build) is the exception to no-mid-sprint-git: commit
it on its own and push to `Main` straight away — never batch it into the next
`commit-all.sh`. It still carries the `Date:` trailer.

## In a shared tree, uncommitted work is not protected work

**A Prisma schema reached production twelve hours before its migration.** The Central session
had deliberately held its own commit back *specifically* to stop that happening — and holding
it back did not stop it, because another session's `git add` swept the uncommitted schema file
in with its own work. The generated client then expected columns the database did not have.

**So: commit a schema and its migration TOGETHER, as early as possible, rather than waiting**
for the end-of-sprint `commit-all.sh`. Apply the SQL first, then push the pair in one commit.
This is a second sanctioned mid-sprint git action alongside the build-break carve-out, and it
exists because the alternative was tried and failed.

⚠ **Commit by explicit file path. Never `git add -A`, never a directory-level add.** The rule
already existed; breaking it once is how the schema shipped early. Two sessions (LEX and
CENTRAL) share this repository at the same time, and `git add .` in one of them stages the
other's half-finished work.

## Railway Operations

### Worker restart procedure

NEVER restart all Railway ingest workers simultaneously. This saturates the Railway Postgres
connection pool and crashes all workers immediately (ECONNRESET).

Always use staggered restart: batches of 5 workers, 20s gap between batches.
Use `deploymentRedeploy(id)` mutation — NOT `serviceInstanceRedeploy` (which rebuilds from source).
Script: `scripts/ingest/restart-workers-staggered.ts`

The startup jitter in worker-queue.ts (random 0–20s delay) handles this automatically on new deploys.
Manual staggered restart is only needed when workers crash and Railway's auto-restart also fails.

### Railway API endpoint

Always use `backboard.railway.com/graphql/v2` — NOT `api.railway.app`.
The api.railway.app endpoint returns stale deployment data in queries.

### ⚠⚠ A deploy is proved by `meta.commitHash`. Never by the status, never by the id (9 Sep 2026)

**`serviceInstanceDeployV2` takes a THIRD argument. Called with two, it returns SUCCESS with a
fresh deployment id while building the OLD commit.**

```
serviceInstanceDeployV2(serviceId, environmentId)              → SUCCESS on the pinned commit
serviceInstanceDeployV2(serviceId, environmentId, commitSha)   → builds what you asked for
```

On 9 September, deployment `a47cdcaa` went green in four minutes with `meta.commitHash` still
`15bafe1f` — the 3 September commit — when the intended commit was `5b92b93`. Nothing in the call,
the response, or the deployment status said so. Named explicitly, `13a413f3` built the right commit.
(`serviceInstanceDeploy` additionally takes `latestCommit: Boolean`.)

**This is the fourth mutation of the same error pattern, and the first where the fix for the trap
was itself trapped.** The brief being followed *warned* that `deploymentRedeploy` re-runs the same
artefact and that a new deployment id would read as evidence a fix was live. The source-rebuild
mutation, chosen precisely to avoid that, did it anyway.

**So, after every deploy:**

1. **Read `meta.commitHash` off the deployment and confirm it is the commit you intended.** Both
   deployments that day were `SUCCESS` with fresh ids and one of them meant nothing.
2. **Where the service prints something the new code alone can produce, read that too.** The
   `build-worker` container built from `5b92b93` prints `retrieval configuration OK — …`, which is
   `assertRetrievalConfig`'s own line; a container built before that morning cannot produce it. A
   string only the new build can emit is proof; a green status is inference.

### ⚠ A service with no `watchPatterns` is deployed by hand, for ever, silently

`build-worker` ran with `watchPatterns: []` from 3 to 9 September. **Sixteen pushes produced no
deployment record for it at all**, while `fts-serve` and `vector-serve` each got a `SKIPPED` record
for every one — so the service that runs every build was the only one with no trace in the
deployment list, and its absence read as "nothing to do". That is the root cause of the six-day
staleness, and of the trap above.

⚠ **A `SKIPPED` deployment is healthy.** It means Railway compared the push against the watch paths
and correctly declined to rebuild. **No record at all is the danger sign.**

⚠ **Watch paths are REPO-ROOT-RELATIVE, not relative to `rootDirectory`.** `fts-serve`'s
`rootDirectory` is `scripts/ingest` and its working pattern is `scripts/ingest/search/**`. A pattern
written relative to the root directory matches nothing and is indistinguishable from the empty list
it replaced.

⚠ **Watch the dependencies, not just the interesting file.** `build-worker` now watches
`scrutinise-web/lib/**` rather than `lib/lex/**`: `build.ts` imports `@/lib/prisma`,
`@/lib/env-flags` and `@/lib/ai/*`, and `prisma/**` is watched because the client is generated at
deploy time. Set with `scripts/b21-railway-watch.ts`, which reads the list back after writing it.

### ⚠⚠ …and `watchPatterns` was the symptom. The layer below it is `repoTriggers` (9 Sep 2026)

**Setting the watch paths changed nothing, and reading them back said it had worked.**

`repoTriggers` on `build-worker` is **0**. Every other repo-backed service in the project has **1**.
So no push has ever reached the service, and the empty watch list was irrelevant because there was
nothing arriving to be filtered. **A `SKIPPED` deployment record is a trigger firing and the watch
declining. NO record at all is no trigger** — which is why `build-worker` was the only service with
no deployment row per push, and why its silence read as "nothing to do".

⚠ **This is why the config read-back is not the test.** `watchPatterns` was set, verified identical
on read-back, and the service still does not auto-deploy. **The test is a push to a watched path
followed by a deployment appearing that nobody triggered.** Anything short of that is the
guard-that-cannot-fail in its deployment-shaped form.

⚠ **A PROJECT token cannot fix it.** `deploymentTriggerCreate` and `serviceInstanceAutoDeployUpdate`
both return **`Bad Access`** with the `Project-Access-Token`; they need the account's GitHub
linkage. `serviceInstanceUpdate` (watch paths, variables) works fine, so the failure is specific and
not a dead token. **Connecting the repo is Charlie's, in the Railway dashboard:** build-worker →
Settings → Source → connect `Scrutinise/scrutinise-prototype` @ `Main`. Until then the worker is
deployed by hand with `serviceInstanceDeployV2(..., commitSha)` and the sha read back.
