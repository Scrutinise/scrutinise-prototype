# STATISTICS LAYER — REFRESH (as built, Phase A)

*Written: 31 Jul 2026.*

## Shape: run-and-exit, not always-on

Every Phase A source updates on a monthly-or-slower cadence (HMRC receipts: monthly; ONS CDID
headline series: monthly; ONS Beta wellbeing: quarterly; OBR: biannual, tied to fiscal events;
PESA/HMRC tax gap: annual). There is no need for the always-on daemon pattern
`scripts/ingest/ops.ts` uses for the corpus pipeline (which exists because ingest workers need
liveness-checking and circuit breakers on a per-minute cadence). Instead:

`scripts/stats/refresh-scheduler.ts` is a **single run-and-exit pass**: load every `StatDataset`
row, check whether its `refreshCadence` interval has elapsed since `lastRefreshedAt`, and run
the matching handler from `ingest-handlers.ts` for anything due. Meant to be invoked by an
external cron (a Railway cron service, same idea as the rest of this codebase's scheduled
tasks) on a fixed daily or twice-daily tick — the due-ness check inside the script means a more
frequent cron tick than any source's cadence is harmless (everything just no-ops until due).

```bash
npx tsx --tsconfig ../tsconfig.json refresh-scheduler.ts            # normal run
npx tsx --tsconfig ../tsconfig.json refresh-scheduler.ts --force <datasetId>   # force one dataset now
```

## Per-dataset cadence (seeded in `seed-catalogue.ts`)

| dataset id                     | source | cadence   | why |
|---------------------------------|--------|-----------|-----|
| `ons-cdid-headline`             | ONS    | MONTHLY   | GDP/unemployment/CPIH/earnings all revise monthly |
| `ons-beta-wellbeing-quarterly`  | ONS    | QUARTERLY | matches the dataset's own release frequency |
| `obr-psf-databank`              | OBR    | BIANNUAL  | updated at each fiscal event (Spring/Autumn) |
| `obr-historical-forecasts`      | OBR    | BIANNUAL  | new forecast round added at each EFO |
| `pesa-ch5-function`             | HMT    | ANNUAL    | PESA publishes once a year (with an in-year update) |
| `hmrc-receipts`                 | HMRC   | MONTHLY   | published monthly |
| `hmrc-tax-gap`                  | HMRC   | ANNUAL    | published once a year |
| `wb-wdi-comparative`            | World Bank | ANNUAL | WDI indicators are annual; the API's `lastupdated` moves a few times a year as countries revise |
| `oecd-cofog-expenditure`        | OECD   | ANNUAL    | Government at a Glance "yearly updates" flow — one release a year, plus back-revisions |
| `imf-gfs-cofog`                 | IMF    | ANNUAL    | GFS is an annual publication; countries back-revise, so the whole 2007– window is re-fetched each time rather than appended to |

## OECD SDMX — read this before touching `sources/oecd.ts`

> **Update 2026-08-04 23:31 UTC — two things closed, one still open.**
>
> **The server-side unit filter is TESTED and ruled out.** It shipped on 3 Aug marked "NOT YET
> CONFIRMED against a live response" and was the best remaining hypothesis for the whole-window
> 500 (a quarter of every payload was being fetched and discarded, on a size-limited endpoint).
> Run from a fully cold quota, it returned **HTTP 500 on all seven windows** — whole window, both
> 10-year halves, all four 5-year quarters. Payload size is not the binding constraint. Do not
> re-run this experiment.
>
> **The `/all` fallback never actually ran, and that invalidates earlier readings.** This module
> claimed to fall back to the unfiltered key "on any non-200". `politeFetch` treats 429/5xx as
> retryable and **throws** when retries are exhausted — it never returns a non-ok response for a
> 500 — so `if (!res.ok)` was unreachable for the only status this endpoint returns. The 4 Aug
> logs prove it: all seven failures name the *filtered* URL. Now fixed by catching the throw.
> Treat any earlier "we also tried /all" conclusion as unverified.
>
> **Still open:** the flow returns 500 for every window size from a cold quota. The next
> diagnostic step is a single-year request in isolation (which returned 200 with 426 KB on
> 3 Aug) — if that now 500s too, the flow itself has moved or been withdrawn, which is a
> different problem from throttling. **One request, from a cold quota, nothing else running.**

**This endpoint has TWO independent failure modes and both present as HTTP 500.** Conflating
them sends you in circles; they were only separated by testing each in isolation on 2026-08-03.

| | trigger | signature | does waiting help? |
|---|---|---|---|
| **Quota** | too many requests | HTTP 500 *or* 429, intermittent | **yes** |
| **Size** | one window too large | HTTP 500, deterministic | **no** |

- **Quota.** A 20-request per-year pull of 2007–2026 failed **19 of 20 years** (17× 500, 6× 429
  across retries) — while the *identical* single-year request issued in isolation returned
  **HTTP 200 with 426 KB**. Note it reports quota exhaustion as 500 at least as often as 429.
- **Size.** After a full 12-minute cooldown with no other traffic, the single whole-window
  request (2007–2026, ~50 MB of CSV) **still** returned 500. So this one is not throttling and
  cooling off will never fix it.

**Why this matters more than an ordinary flaky API:** a 500 reads as "problem with that slice"
and an empty result reads as "that year has no data". A naive loop therefore stores whatever
survived and reports SUCCESS — on the first attempt here that would have been a **one-year
"time series"**.

Consequences now baked into `sources/oecd.ts`:

- `fetchOecdCofog()` tries the **largest window first** and subdivides (20 → 10 → 5 years) only
  on failure. This is right for both modes at once: it minimises request count (quota) while
  still searching downward for a window small enough to serve (size). Worst case 7 requests.
  **Never go back to per-year requests** — that maximises the quota problem to solve a size
  problem it cannot touch.
- 5s spacing, 4 retries, long backoff (10/20/40/80s) via `politeFetch`.
- A caller-side guard **refuses** a window where more than half the requests failed, rather than
  storing a partial series as a success. This is the zero-observation rule's sibling: the same
  silent-partial-success failure, just sitting above zero.
- **Do not run ad-hoc `curl` probes against this endpoint while an ingest is running** — that is
  how the quota was exhausted the first time, and it corrupts your own diagnosis by making a
  size failure look like a quota failure.

## `--force <id>` means EXACTLY that dataset (changed 2026-08-03)

`--force <id>` runs **only** that dataset. It previously meant "force this one, and also run
anything else that happens to be due" — which is a real hazard, not a cosmetic one: starting
`--force B` while a `--force A` run was still in flight began a **second writer on A** (A was
un-refreshed, therefore due). `upsertSeries` is find-then-create and not atomic, so two writers
on one dataset can duplicate series or collide outright. This happened during the Phase B ingest
on 2026-08-03 and was caught within a minute; the fix makes it structurally impossible.

## Idempotency

Every upsert keys on **`stat_series.seriesKey`** (the deterministic identity hash — see
STATS_SCHEMA.md) and on `stat_observation`'s unique `(seriesId, periodType, periodStart)`.
Re-running a refresh, forced or scheduled, after a source revises a historical figure updates
the existing row rather than duplicating it. `StatRefreshLog` records
`seriesUpserted`/`observationsUpserted` per attempt so a revision-only run (no new periods,
existing values changed) is visible in the log even though the row counts look unchanged.

> **Superseded (2026-08-04):** this used to key on the tuple
> `(datasetId, sourceSeriesId, geography, cofogFunctionCode, forecastVintage, measure)`. That
> was never actually enforcing much — Postgres treats NULLs as distinct in a unique index and
> `sourceSeriesId` was NULL on 86% of rows — so it did not prevent the duplicate-series class it
> was written for. The old index has been dropped.

**The acceptance test, run 2026-08-05:** every handler was re-run against a fully populated
database and every per-dataset series count came back **unchanged** (3,404 total). Zero new
duplicate series. `npm run check:series-key` reports `sql/ts mismatches=0, stored-key drift=0,
colliding keys=0`. That is the thing to re-run if idempotency is ever in doubt.

**The one legitimate way a series re-keys** is a changed `seriesLabel`, since the label is part
of the identity. If a source re-words its labels — or if we change how a label is built, as the
`geographyLabel` fix did on 2026-08-05 — the rename and the re-key must be applied together, in
place, **before** the next ingest, or the handler will fork a duplicate beside every renamed
row. `backfill-geography-labels.ts` is the worked example.

## Failure handling

Per `docs/CLAUDE.md` §13's retry policy: a failed refresh is logged (`StatRefreshLog.status =
FAILURE`, `errorMessage` captured) and **not automatically retried** — `lastRefreshedAt` is left
unset (`lastCheckedAt` still updates) so the next scheduled tick picks it straight back up.
Deterministic parse failures (a source changed its sheet layout) would fail identically on
every retry; the log is where a human finds out.

**A zero-observation run is always a FAILURE, never a no-op** (added 2026-08-01). Every handler
re-upserts its full series on every pass, so "0 observations upserted" cannot mean "nothing
changed" — it can only mean the fetch or the parse produced nothing. Reporting SUCCESS on zero
is how `ons-beta-wellbeing-quarterly` shipped a **green run that ingested nothing at all** on the
first live refresh: ONS's v4 CSV had two confidence-limit columns between the value and the
first dimension pair, the parser assumed none, and all 1,960 rows were silently discarded by a
`continue`. A source quietly changing shape is the single most likely long-run failure mode of
this whole layer, and it must not look like success. Recording FAILURE also leaves
`lastRefreshedAt` unset, so the next tick retries rather than waiting out a full annual cadence.

## Measured runtimes

**Current, after the bulk write path (2026-08-05).** `lib/upsert.ts::ingestRows` issues one
`INSERT … ON CONFLICT DO UPDATE` per ~500 rows instead of one round trip per row:

| dataset | rows | wall-clock |
|---|---|---|
| `obr-historical-forecasts` | 2,807 series / 20,506 obs | **12.7 s** |
| `imf-gfs-cofog` | 2,329 series / 40,351 obs | **28.8 s** (incl. a 52.8 MB fetch) |
| everything else | — | seconds each |

A full run of every dataset is now **a couple of minutes**, fetches included. An hour-plus cron
timeout is no longer needed, though leaving headroom costs nothing.

> **Superseded — but read this before writing another handler.** The original per-row path
> measured **~34 minutes** for ~28,500 observations (≈14 obs/sec against pooled Neon), and the
> note here said batching was "not needed at this scale". That was wrong twice over. Re-measured
> on 2026-08-05 the OBR dataset alone ran at **~10 series/minute — 3.5 hours** — and IMF's 65,985
> rows would have been an overnight job, i.e. the per-row path did not merely make Phase B slow,
> it made it *impractical*. Round trips, not row counts, were always the cost. **New handlers
> build their full `IngestRow[]` and call `ingestRows()` once.** The per-row helpers still exist
> and are still correct — same conflict targets, equally idempotent — but they are for small
> sources and tests.

## Not built this sprint

- **The actual Railway cron wiring to invoke `refresh-scheduler.ts` on a schedule.** The script
  itself is now live-run and proven against the real DB — this is purely the deployment step,
  and it is held because a Railway cron service is a **paid resource**, which falls under the
  brief's "Charlie confirms before you provision anything that costs money" gate. What it needs
  when approved: a Railway cron service on this repo, start command
  `cd scripts/stats && npx tsx --tsconfig ../tsconfig.json refresh-scheduler.ts`, schedule
  `0 3 * * *` (daily 03:00 UTC — every source's due-ness check makes a daily tick harmless),
  and `STATS_DATABASE_URL` set in that service's variables. It must NOT be added to the existing
  `ops`/Ingest service, whose env points at the corpus DB.
- Alerting on refresh failure (the corpus pipeline's scheduler emails a daily summary; this
  layer's failure visibility today is "query `StatRefreshLog` yourself"). Now more valuable than
  it looked when this was written — the first live run produced two failures, one of them silent
  until the zero-observation rule above was added.
