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

## OECD SDMX — read this before touching `sources/oecd.ts`

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

Every upsert keys on `stat_series`'s unique tuple
`(datasetId, sourceSeriesId, geography, cofogFunctionCode, forecastVintage, measure)` and
`stat_observation`'s unique `(seriesId, periodStart)` — re-running a refresh (forced or
scheduled) after a source revises a historical figure updates the existing row rather than
duplicating it. `StatRefreshLog` records `seriesUpserted`/`observationsUpserted` per attempt so
a revision-only run (no new periods, existing values changed) is visible in the log even though
the row counts look unchanged.

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

## Measured runtimes (first live run, 2026-08-01)

The upsert path is one round trip per observation, sequential — so wall-clock tracks observation
count closely. Full cold run of all 7 datasets: **~34 minutes** for ~28,500 observations
(≈14 obs/sec against pooled Neon in `eu-west-2`). The long pole is `obr-historical-forecasts`
(20,506 observations, ~22 min); everything else is single-digit minutes or less.

That is comfortably inside any sensible cron window, and a normal tick does far less work than
this (most datasets skip as not-due). It does mean a daily tick should be given a timeout well
above an hour if several sources come due at once. If runtime ever becomes a problem the obvious
fix is batching the observation writes (`createMany` + a follow-up update pass) rather than
per-row `upsert` — not needed at this scale, noted so nobody re-derives it.

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
