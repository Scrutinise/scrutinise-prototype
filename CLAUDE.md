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

1. **Every commit message** carries a `Date:` trailer in `YYYY-MM-DD HH:MM` 24-hour UK local
   time (BST/GMT), on its own line in the body alongside `Co-Authored-By:`:

   ```
   Date: 2026-06-20 04:29 BST
   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   ```

2. **Every `CHANGE_LOG.md` entry** leads with that same `YYYY-MM-DD HH:MM` stamp in its
   heading, so scanning the file shows which change shipped when.

Get the stamp from the **actual system clock** at commit time — run `Get-Date -Format
"yyyy-MM-dd HH:mm"` (the session `currentDate` gives only the date, not the time, and the
date can roll over mid-session). Never guess or copy a stamp forward. This applies to every
commit, including each one inside `commit-all.sh` (give each its own real stamp). See
`docs/CLAUDE.md` §12 for the rest of the git policy (single end-of-sprint `commit-all.sh`,
no git mid-sprint).

**Carve-out — build-breaking fixes ship immediately.** A fix for a broken build/deploy
(e.g. a type error failing the Vercel build) is the exception to no-mid-sprint-git: commit
it on its own and push to `Main` straight away — never batch it into the next
`commit-all.sh`. It still carries the `Date:` trailer.

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
