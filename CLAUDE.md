# SCRUTINISE — Claude Code Boot File

This file is auto-read by Claude Code on every session start and after `/clear`.

**Read these files before writing any code:**

1. `docs/CLAUDE.md` — project rules, terminology, architecture, git policy
2. `docs/entity_list_v5.md` — every DB entity and field (never edit without Charlie's instruction)
3. `docs/system_mechanics_v0_8.md` — current business rules
4. `docs/handoff_summary.md` — current sprint state and where we left off

The active sprint brief is referenced in `handoff_summary.md` — check there for the current `*_CC_Brief.md` file.

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
