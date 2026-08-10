# What Railway is for

*2026-08-09. V33 §4. Measured, not remembered: `scripts/ingest/v33-railway-inventory.ts`
(inventory), `v33-railway-db-probe.ts` (the old Postgres), `v33-railway-db-readwatch.ts` (is
anything still reading it), `v33-archive-railway-db.ts` (the archive). Raw inventory:
`docs/v33_railway_inventory.json`.*

**Railway is staying.** It is on Hobby and that is the right plan for what it now does. Nothing
live was removed, stopped, or reconfigured to write this document.

---

## The one-paragraph answer

Railway runs the **always-on, small, latency-sensitive** part of the search stack — two query
services and one scheduler — plus a Postgres instance that is now a **stale pre-V26 snapshot with
no live reader**. Everything memory-hungry left in August for the Hetzner Heavy Job Runner
(CLAUDE.md §17), and the application database left in June for Neon. What remains on Railway is
what Railway is actually good at: cheap containers that stay up.

## The services, and which are load-bearing

Project `miraculous-nature` (`68707c61-5c68-4f37-88fc-c301fd6b90e7`), one environment
(`production`), 7 services.

| service | status | what it does | verdict |
|---|---|---|---|
| **`fts-serve`** | SUCCESS, deployed 2026-08-09 02:01 | `FTS_PORT=8080 tsx search/fts-query-service.ts` — the BM25 query service over the `corpus_fts` Lance table. `https://fts-serve-production-4cea.up.railway.app` | **LIVE, load-bearing.** Every search the app performs goes through it. |
| **`Ops`** | SUCCESS, deployed 2026-08-09 08:47 | `npm run scheduler` → `scripts/ingest/ops.ts`. Hourly reaper/census/snapshot, 15-minute circuit breakers + ingest liveness + embed heartbeat, daily progress email. | **LIVE, load-bearing.** |
| **`vector-serve`** | SUCCESS, deployed 2026-08-07 | `VECTOR_PORT=8081 tsx search/vector-query-service.ts`. `https://vector-serve-production.up.railway.app` | **LIVE AND SERVING** the `legislation` stream in production. `VECTOR_SEARCH_URL` **is set** in Vercel and `LEX_VECTOR_STREAMS=legislation`; it is unset *locally*, which is why a local read of `vector-search.ts:111` shows the inert path. Keep. |
| **`Ingest`** | **FAILED**, last deploy 2026-06-30 | `npm run worker` — the V17 pool worker. Started on demand by `Ops` when the queue has pending rows; exits on empty. | **Dormant by design, but the last deploy FAILED.** The queue has been drained, so nothing has needed it; that also means the failure has never been exercised. See "what to fix" below. |
| **`fts-build`** | SUCCESS, 2026-08-03 | start command is literally `true`. The retired Railway index-build service. | **Stale.** Superseded by the Hetzner Heavy Job Runner on 3–4 Aug (CLAUDE.md §17). Costs nothing (it runs `true` and exits) but it is a live-looking service that does nothing. |
| **`fts-pilot`** | never deployed | start command `true`. | **Stale.** The bake-off scaffolding. |
| **`scrutinise-db`** | SUCCESS, 2026-06-10 | `postgres-ssl:17`, 1.98 GB. | **SURPLUS — archived, see below.** |

### ⚠ CORRECTION, 2026-08-09 — the `vector-serve` row above was wrong when first written

**What it said (9 Aug, V33 §4):** "LIVE but serving nobody. `VECTOR_SEARCH_URL` is unset in Vercel
and locally." **What is true:** `VECTOR_SEARCH_URL` **is set** in Vercel, and
`LEX_VECTOR_STREAMS=legislation`. `LEX_SEARCH_VECTOR` has no entry, so the legacy whole-query
fusion is off — which is why `capabilityFlags()` reads `flags: expansion router` and looks like
"vector off" from inside the app.

**How the corrected value was established, and by whom:** **Charlie read the Vercel dashboard
directly on 10 August 2026** and reported the three values. It was NOT read from this machine, and
could not be: `VERCEL_TOKEN` authenticates (`/v2/user` 200) and then **403s on every project scope
with `"saml": true`**, so env, deployments and runtime logs are all unreadable from here. See
`docs/CLAUDE.md` §19.

**Why the original line was wrong, which matters more than the line:** it was an *inference*
recorded in the grammar of a *measurement*. `vector-search.ts:111` returns `[]` when
`VECTOR_SEARCH_URL` is unset; the local `.env` has no such variable; the sentence that reached this
table asserted the state of Vercel's environment. The contradicting evidence was already on the
record — S2A measured `vector-serve`'s `served` counter moving **+1 on every routed production
query** (182 → 185), which is per-stream fusion on exactly one stream and requires both variables
set. A document asserting a flag state nobody holding the document can verify is the same failure
class as the flag incident it was written to prevent.

**Consequence, stated plainly:** the cross-stream score defect S2B fixed was **live in production**,
not latent. Any future claim about Vercel env in this file must carry who read it and on what date,
or be labelled an inference.

## Heavy jobs do NOT run here, and this is the reason

CLAUDE.md §17 is the standing rule; the evidence is worth restating because Railway's marketing
number is misleading. Railway's **"48 GB per service" is an aggregate across replicas**, and a
single-process job only ever gets the **per-replica cap, measured at 8 GB** (`LIMIT=8000000000`).
The FTS index build peaks at **18–20 GB**. No Railway setting could ever have run it — replicas
give you more *copies*, not a bigger heap. It failed three times in three different ways before
that was understood.

Heavy jobs are registered in `scripts/ops/heavy-job/jobs.ts` and run on rented Hetzner boxes that
the runner provisions, uses and **destroys**:

| job | observed peak | typical cost |
|---|---|---|
| `fts-index` | 19.8 GB | €0.049–0.053 per run |
| `vector-index` | 32 GB | the 64 GB-class job |
| `chunks-scalar-index` | 1.72 GB | trivial |

## The old Postgres — what is in it, and what reads it

`scrutinise-db` held the application database before the **18 Jun 2026 Railway→Neon cutover**.
Measured today: **1.98 GB, 66 tables, 1,244,339 rows**, postmaster up since 10 Jun 2026.

**Every user-data table is matched or exceeded by Neon**, which is the live application database:

| table | Railway | Neon |
|---|---:|---:|
| `LegislationSection_DEPRECATED_2026-06-19` | 914,274 | (as `LegislationSection`, 914,274) |
| `LegislationItem` | 135,531 | 135,531 |
| `ingest_queue` | 127,380 | 5,342 *(Railway holds the historical queue; Neon's is the live, drained one)* |
| `OperationalSection` | 61,315 | 61,315 |
| `Idea` | 54 | 70 |
| `User` | 29 | 29 |
| `IdeaLegislation` | 1 | 1 |
| `Comment` / `ActivityLog` | 1 / 1 | 1 / 1 |

Neon has *more* of the live tables — the app has been writing there for seven weeks.

**Is anything still reading it?**

- `pg_stat_activity`: **0 connections** other than the probe itself, on every sample taken.
- **The decisive test.** `pg_stat_user_tables` has never been reset on this instance (postmaster up
  since 10 Jun 2026), so two snapshots bracket a real window. Over **64.8 minutes spanning the
  `Ops` hourly tick at :01 and four of its 15-minute ticks: not one user table was scanned.**
  (`xact_commit` moved +134 and `tup_fetched` +1,585 — all `pg_catalog`, i.e. the probes themselves
  and Railway's own health checking.) A single `pg_stat_activity` sample could not have shown this;
  the counters can.
- Writes over the 60-day postmaster window: **458 inserts, 70 updates, 23 deletes** — i.e. none.
- The code: `ops.ts` states, and a grep confirms, that it **connects to Neon only** — there is no
  `DATABASE_URL`, no `new Pool`, no Prisma anywhere in it. The V16-era Railway-DB calls that used
  to hang the scheduler were removed in V17.

⚠ **But two live-looking services still carry a `DATABASE_URL` pointing at it** —
`Ops` (`switchback.proxy.rlwy.net:16156`) and the FAILED `Ingest`. The *code* does not use it; the
*variable* is a leftover from before the cutover. That is enough to stop this being called safe:
any script run inside those containers that reaches for `process.env.DATABASE_URL` (and
`scripts/ingest/` still has ~20 that do) would silently talk to the wrong database. That is
precisely the failure CLAUDE.md §16 exists because of.

### The archive — done

**`r2://scrutinise-legislation/archive/railway-scrutinise-db/2026-08-09/`**

31 tables, **1,244,339 rows, 611.7 MB gzipped**, 54 objects plus `MANIFEST.json`. Every object was
**read back from R2 as bytes, gunzipped, and its line count compared with the exported row count** —
all 54 matched.

⚠ **It is a DATA archive, not a restorable dump.** There is no `pg_dump` on the machine that ran
it (nothing on PATH, no PostgreSQL install), so the archive is gzipped JSONL: one JSON object per
line, `Buffer`s as `{type:"Buffer",data:[…]}`, timestamps as ISO-8601. **It carries rows, not DDL,
indexes, sequences or constraints, and it will not restore with `psql -f`.** If a true restore is
ever wanted, take a `pg_dump -Fc` from a machine that has one **before** the database is cleared.

### Clearing it — the remaining step, and why it was not taken

Dropping tables holding real user rows is on CLAUDE.md's short pause list, and the prerequisite
below is not yet met, so **nothing on Railway was dropped**. The order is:

1. **Remove or repoint `DATABASE_URL` on `Ops` and on `Ingest`** so nothing in those containers can
   reach the old database by accident. This is the actual blocker.
2. Optionally take a `pg_dump -Fc` from a machine that has one, for a restorable copy.
3. Then drop the tables (or delete the `scrutinise-db` service outright — it is the same 1.98 GB
   either way, and the service costs more than the storage).

Re-run `v33-railway-db-readwatch.ts` first: it diffs the never-reset cumulative scan counters, so
two runs an hour apart prove whether anything touched a user table in between. A first snapshot is
in `docs/v33_railway_db_readwatch.json`.

**What clearing is actually worth:** ~1.98 GB on Railway, pennies a month. The reason to do it is
not cost — it is that a second, stale copy of the production database, still named in two live
services' environments, is exactly the shape of the 29–30 July incident where two migrations were
applied to the wrong database and production silently fell behind.

## Two more things the inventory turned up

⚠ **`RAILWAY_API_TOKEN` is a PROJECT token, and every existing script sends the wrong header.**
It is a bare 36-character UUID, which Railway authenticates with `Project-Access-Token`. Every
script in `scripts/ingest/` sends `Authorization: Bearer` and therefore gets `Not Authorized` on
**every** query — including `me` and `projects`, which is what makes it read as an expired
credential rather than a wrong header. `v33-railway-inventory.ts` uses the correct header;
`check-railway-status.ts`, `check-v17-services.ts`, `check-railway-connections.ts`,
`restart-workers-staggered.ts` and the rest have not been changed and are dead until they are.
A project token is scoped to one project and one environment, so `RAILWAY_PROJECT_ID` is redundant
with it — `{ projectToken { projectId environmentId } }` reports both.

⚠ **`Ingest`'s last deployment FAILED (30 Jun) and nobody noticed**, because the queue drained and
`Ops` only starts it when there are pending rows. The next real backlog is when that will be
discovered. Worth a deliberate redeploy-and-watch before the next large seed, not after.

## The intended future role, in one line each

- **Railway** — always-on small containers: `fts-serve`, `vector-serve`, `Ops`, and the `Ingest`
  worker that `Ops` wakes on demand. Hobby is the right plan.
- **Hetzner (Heavy Job Runner)** — anything memory-bound: index builds, index merges, embedding
  runs, corpus-wide rewrites. Provision → run → verify → **destroy**, cost printed per run.
- **Neon** — the application database and `corpus_sections`. The single source of truth.
- **Cloudflare R2** — every body, every Lance table, every archive.
