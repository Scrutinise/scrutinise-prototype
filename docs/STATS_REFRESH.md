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

## Not built this sprint

- The actual Railway cron wiring (or equivalent) to invoke `refresh-scheduler.ts` on a schedule
  — this is the same "built inert, needs Charlie's go-ahead to deploy" position as the DB
  itself (see the sprint report's DB-choice section).
- Alerting on refresh failure (the corpus pipeline's scheduler emails a daily summary; this
  layer's failure visibility today is "query `StatRefreshLog` yourself"). Cheap follow-on once
  the DB exists and a first real failure needs surfacing.
