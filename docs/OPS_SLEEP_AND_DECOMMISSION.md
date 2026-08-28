# Sleeping the search services, and decommissioning scrutinise-db

**2026-08-27/28.** Ordered as instructed: **the timeouts were raised and confirmed live
before sleep was enabled.**

---

## What it saves

| service | avg memory | avg vCPU | disk | est. $/month |
|---|---|---|---|---|
| **vector-serve** | 1.93 GB | 0.006 | — | **$19.44** |
| **fts-serve** | 1.79 GB | 0.018 | — | **$18.30** |
| Ops | 0.17 GB | 0.001 | — | $1.75 |
| **scrutinise-db** | 0.22 GB | 0.000 | 2.63 GB | **$2.59** |
| Ingest | 0.005 GB | 0.001 | — | $0.07 |
| fts-build | 0.002 GB | 0.001 | — | $0.04 |
| | | | | **$42.17** |

**The two search services are 89% of the bill** — $37.74 of $42.17 — and both are idle
almost all of the time.

⚠ **Getting that table took a correction worth recording.** Reading `MEMORY_USAGE_GB` as
GB-hours produced **$2,530/month** for a project that bills a few tens of dollars. The values
are **sums of per-minute samples**. The giveaway was `scrutinise-db`'s disk figure of
102,229: divided by the minutes in the window it is **2.63 GB**, which is exactly the 2,029 MB
database. The same divisor turns `fts-serve`'s 69,620 into 1.79 GB of memory — believable for
a service holding a Lance index.

⚠ **And it is calibrated against the one number we can check.** Your bill puts
`scrutinise-db` at **$3.11**; this model computes **$2.59**. Within ~20%, which is the
accuracy it claims — good enough to rank services against each other, not good enough to
quote to the penny. `cost-estimate.ts` prints that comparison on every run so the next
person re-runs the calibration rather than trusting me.

### The new estimate

| | |
|---|---|
| before | **$42.17/month** |
| removing `scrutinise-db` | **−$3.11** — certain, once you run the destroy command |
| sleeping the two search services | **−$37.74 IF they sleep. As measured, they do not yet.** |
| **after, if sleeping works** | **≈ $5–9/month** plus awake time |
| **after, if it does not** | **≈ $39/month** — the legacy DB saving only |

⚠⚠ **THE SLEEPING SAVING DOES NOT EXIST TODAY.** The flag is set, reads back `true`, survives
a redeploy — and the services do not sleep. Four attempts; Railway's own logs show **one HTTP
request in 100 minutes** and they still stayed warm. Details below.

**The only saving I can promise you is the $3.11 from `scrutinise-db`**, and that one is
certain the moment you run the destroy command.

⚠ **Next step is yours and takes ten seconds:** check in the Railway dashboard whether app
sleeping is included on this plan. A project-scoped token cannot read the team or plan
(measured — `Not Authorized`), so I cannot see it from here. If it is not included, the flag
being settable is simply misleading and the answer is the memory lever at the end of this
document.

---

## Sleep: the setting, and that it is available

**Available on this plan.** `sleepApplication` on `ServiceInstance`, set through
`serviceInstanceUpdate`.

⚠ **Established by querying the GraphQL schema, not by reading documentation** —
`audit-sleep.ts` asks `__type(name: "ServiceInstance")` what fields exist and `Mutation` what
can set them. A script that assumed the field and got `null` would have reported "sleep is
off" when the truth was "this plan has no such thing".

Both services were set and **read back**:

```
fts-serve:    sleepApplication false → true   re-read: true ✓
vector-serve: sleepApplication false → true   re-read: true ✓
```

A mutation that returns is a mutation that was *accepted*, not a setting that is *in force*.

---

## Cold start, measured

### Baseline before sleep — restart to first **served query**

| service | `/health` answers | **first served query** | gap |
|---|---|---|---|
| fts-serve | 10.0 s | **12.1 s** | 2.1 s |
| vector-serve | 6.7 s | **13.5 s** | **6.8 s** |

⚠⚠ **This is why the timeout is not sized from `/health`.** On `vector-serve` there is a
**6.8-second window in which the container is up, the health check is green, and a search
still fails** — nearly half the wait happens after the thing most people would have measured.
A budget sized from the health probe would have been short by exactly the part that matters,
and would have failed on the first user after every doze.

### The real wake — ⚠ THEY ARE NOT SLEEPING YET

| attempt | silent window | result |
|---|---|---|
| 1 | 15 min | `0.6 s — STILL AWAKE` ⚠ **spoiled by me** — I ran `curl` health checks while it counted down |
| 2 | **30 min, untouched** | `fts-serve 1.2 s`, `vector-serve 0.9 s` — **STILL AWAKE** |

**The second attempt is clean and the finding is real: `sleepApplication` is `true` on both,
read back, and neither service dozes.**

⚠ **The guard is what caught this.** The script refuses to report anything under three
seconds as a cold start. Without it, attempt 1 would have gone into this report as
*"cold start: 0.6 s"* — a spectacular and completely false result, and the reassuring one.

**Ruled out by measurement, not assumption:**

- **A Railway healthcheck** — `healthcheckPath` is unset on both. A configured healthcheck is
  the usual cause, because Railway pings it and the service is never idle.
- **A cron** — `cronSchedule` null on both; no schedulers anywhere in the codebase.
- **My own probing** — attempt 2 was genuinely untouched for 30 minutes.

| 3 | ~23 min, **after redeploying both** | `fts-serve 0.88 s`, `vector-serve 1.78 s` — **STILL AWAKE** |

**Redeploy hypothesis: disproven.** Both were running deployments created at 14:25, hours
before the flag was flipped, so it was reasonable that the running containers did not know
about it. They were redeployed, the flag still reads `true`, and they still do not sleep.

**"Something is knocking" hypothesis: disproven.** Railway's own HTTP logs, over the last
100 minutes:

```
fts-serve:    1 HTTP request   (ua: node — mine)
vector-serve: 1 HTTP request   (ua: node — mine)
```

⚠ **One request in a hundred minutes, and they still never dozed.** No bot, no scanner, no
uptime check on the public domain.

### ▶ The conclusion

**`sleepApplication` is accepted, stored, survives a redeploy — and has no effect on these
services.** Four attempts, three of them clean, and the services stay warm through near-total
idleness.

**So the $37.74 saving does not exist today, and I am not going to write it down as though it
does.**

What I cannot check from here: **the plan**. A project-scoped Railway token cannot read `me`
or the team (measured — both return `Not Authorized`), so I cannot see whether app sleeping is
included. **That is a ten-second check in the Railway dashboard and it is the next thing to
do.** If sleeping is not on this plan, the flag being settable is simply misleading.

**The flag is left ON.** It costs nothing, it is the correct configuration, and if Railway
starts honouring it the saving arrives with no further work.

### If the goal is the standing cost, the real lever is memory

The two services cost what they cost because they hold indexes resident: **1.79 GB and
1.93 GB**, at $10 per GB-month. That is essentially the whole bill. Sleeping was the cheap
way at it; if it is unavailable, the options that would actually move the number are:

- **consolidate** — one service holding both indexes instead of two containers
- **shrink the resident set** — page the Lance indexes from R2 rather than holding them in
  memory, which is what the cold-start measurements suggest already happens partially
- **a smaller instance** for whichever is over-provisioned

⚠ All three are design changes rather than configuration, and none is in this task. I am
naming them so the next decision is informed, not proposing to do them now.

---

## The timeouts — raised first, and labelled

| | before | after |
|---|---|---|
| `FTS_TIMEOUT_MS` | 25,000 | **75,000** |
| `VECTOR_TIMEOUT_MS` | 25,000 | **75,000** |

Sized at roughly **6× the measured 12–14 s**, because a restart is a *proxy* for a wake and a
wake schedules a container from cold. Both are named `*_COLD_START_MS` in code and carry a
comment saying so, **so nobody tunes them down as if they were a latency target**. They fit
inside the `maxDuration = 300` of the routes that search.

⚠ **Changed as code defaults, not environment variables**, because the Vercel token is
SAML-blocked and I cannot set env vars there.

⚠ **The cost of the headroom is paid by a genuinely dead service**, which now takes 75 s to
fail instead of 25 s. That is acceptable *only* because the user is told what they are
waiting for. If the waking message is ever removed, this number has to come back down — the
comment in `fts-search.ts` says so.

---

## Warm on intent

`POST /api/search/warm` pokes `/health` at both services. Called from **exactly two places**:

- the **ideas hub** (`BuildIdeaClient`) — arriving means a search is coming
- the **proposal surface** (`CreateIdeaClient`) — the legislation panel and every field
  interrogation go through the same two services

⚠ **Not in a layout, and this is the whole discipline.** Warming on every navigation would
keep both services permanently awake and *silently undo the entire saving*. A warm-up that
never lets a service sleep is a cost, not an optimisation.

⚠ **Signed-in only** — verified live, an unauthenticated `POST` returns **401**. An open warm
endpoint is a free way for anyone to keep two paid services running.

⚠ `/health` is the right probe here even though it answers before the index is ready: the
point is to *start* the wake, not to wait for it. The index load then overlaps with the user
typing.

---

## Telling the user

`lib/lex/search-wait.ts` holds three states apart that a single spinner would collapse:

| state | what the user should do |
|---|---|
| **waking** | *"Waking the search service — about half a minute the first time."* Wait; nothing is wrong. |
| **searching** | It is awake and working; the query is heavy. |
| **failed** | It is not coming, and here is what we could not do. |

⚠ **Shown only when a service really was asleep.** The warm probe reports `alreadyAwake` per
service, so the message rests on a measurement. Inferring a wake from a slow response would
label every heavy query a wake, and the message would mean nothing on the day it was true.

The copy says "about half a minute" against a measured ~13 s deliberately: the measurement is
a restart proxy, and a promise of fifteen seconds that takes thirty is worse than no promise.

---

## scrutinise-db — backed up and verified; the deletion is yours to run

### ⚠⚠ It is not empty, and `pg_stat` says it is

`pg_stat_user_tables.n_live_tup` reported **0 live rows for all 68 tables**. The real counts:

| | |
|---|---|
| tables | 68 |
| **rows** | **1,251,338** |
| size | 2,029 MB |

Including **29 Users and 54 Ideas from before the Neon migration**, plus
`LegislationSection_DEPRECATED_2026-06-19` at 914,274 rows.

**Anyone reading the statistics view would have concluded this database was empty and deleted
it.** The stats had been reset; the data had not.

### The dump

⚠ **There is no `pg_dump` on this machine and no Docker** — both checked. The dump goes
through the wire protocol instead: DDL reconstructed from the catalogue, every table streamed
with `COPY … TO STDOUT` (the same text format `pg_dump` emits), gzipped. Restorable with
`psql -f`.

```
r2://scrutinise-legislation/backups/scrutinise-db/legacy-railway-postgres.sql.gz
585.3 MB gzipped → 1,918.2 MB of SQL
sha256 675d4cf6d32dae92…
```

### The verification

Re-downloaded from R2, gunzipped, and checked **table by table against the live database**:

```
CREATE TABLE: 68   COPY blocks: 68   terminators: 68
✓ all 68 tables match, 1,251,338 rows accounted for.
```

⚠ **The verifier is streamed because the first version could not read its own backup.** It
decompressed into a single string and died on V8's ~512 MB string cap against 2 GB of SQL. **A
verification step that cannot run on the real artefact verifies nothing** — and it would have
failed at exactly the size where a backup matters most.

### ▶ The one command, for you to run

I have not deleted the service. Deleting it destroys the volume with no undo, which is a
permanent deletion of data — I prepare those and hand them over rather than performing them.

```bash
cd C:/Code/scrutinise-prototype/scripts/ingest
./node_modules/.bin/tsx ops/with-legacy-env.ts "node_modules\.bin\tsx.cmd" \
  ops/delete-legacy-db.ts --yes-destroy-scrutinise-db
```

⚠ **It refuses unless it re-verifies the backup against the live database in the same run**,
because a backup taken yesterday and a deletion today are two facts nobody checked together.
It then re-reads the project's service list and confirms the service is gone rather than
trusting the mutation's return value.

Run it without the flag first for a dry check — that is what produced the ✓ above.

---

## Two mistakes worth keeping

⚠⚠ **The measurement prevented the thing it was measuring.** The first cold-start script
polled `/health` every 15 seconds waiting for the service to doze. Railway's sleeping triggers
on an *absence of inbound requests* — so the poller held both services awake for the entire
wait and reported that they had not slept. Read at face value, that says *"sleep does not work
on this plan"*. It now waits in silence and makes exactly one request: the one being timed.
**I then made the same mistake by hand**, checking with `curl` while the measurement ran.

⚠ **A fast answer is not a cold start.** The script now refuses to report anything under three
seconds as a wake, because that is a warm number wearing a cold label — and it would have been
the reassuring one.
