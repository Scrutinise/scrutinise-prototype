# STATISTICS LAYER — SCHEMA (as built, Phase A)

*Written: 31 Jul 2026. Executes `docs/STATS_LAYER_SPEC.md` + `docs/STATS_PHASE_A_BRIEF.md`.
Read those first for the "why"; this doc is the "what was actually built."*

## Location

`scripts/stats/` — its own npm project (own `node_modules`, own `package.json`), **separate
from `scrutinise-web`'s Prisma project and separate from the corpus DB.** Nothing in this
sprint touches `scrutinise-web/prisma/schema.prisma`, `corpus_sections`, or any Railway/Neon
connection the app or ingest pipeline already uses.

```
scripts/stats/
├── package.json / node_modules/     (own deps: @prisma/client, @prisma/adapter-pg, pg, xlsx)
├── prisma.config.ts                 (points at STATS_DIRECT_URL / STATS_DATABASE_URL — not DATABASE_URL)
├── prisma/
│   ├── schema.prisma                 (the SDMX model)
│   └── migrations/<ts>_init/         (generated OFFLINE via `prisma migrate diff --from-empty`
│                                       — no live DB was touched to produce this)
├── generated/stats-client/          (gitignored — `npm run generate` regenerates)
├── lib/                             (db.ts, cofog.ts, period.ts, fetch-utils.ts, upsert.ts)
├── sources/                         (ons-beta.ts, ons-cdid.ts, obr.ts, pesa.ts, hmrc.ts)
├── query/stats-query.ts             (Lex/analysis read layer)
├── seed-catalogue.ts                (StatCofogFunction + StatDataset seed, idempotent)
├── ingest-handlers.ts               (the real, DB-writing fetch+parse+upsert per dataset)
├── refresh-scheduler.ts             (cadence-aware run-and-exit refresh)
└── measure-pilot.ts                 (fetch+parse+COUNT only — never writes to a DB; this is
                                       what produced the sizing numbers in the brief's §9)
```

`STATS_DATABASE_URL` is a **new, separate env var** — deliberately not reusing `DATABASE_URL` —
so a stale `.env` can never silently point a stats-ingest script at the corpus/app DB the way
the 29–30 Jul incident happened the other way (`docs/CLAUDE.md` §16).

## Why a separate npm project

Prisma 7's client generator resolves `@prisma/client` relative to the schema file's own
directory tree, not the invoking `cwd`. `scripts/legislation` and `scripts/ingest` get away
with sharing `scrutinise-web`'s `node_modules` via `scripts/tsconfig.json`'s `paths` map (a
TypeScript-only remap) plus, for `scripts/ingest`, its own `node_modules`. For a *second Prisma
schema* pointed at a *different datasource*, the cleanest fix was giving `scripts/stats` its
own tiny `node_modules` (171 packages) — this also means `npx prisma generate/migrate` for the
stats DB can never accidentally pick up `scrutinise-web/prisma/schema.prisma`.

## The SDMX model

Per the spec: dataset (dataflow) → dimension (documents the axes) → series (one line you can
chart over time — a unique non-time dimension combination) → observation (the value at a time
period).

- **`stat_dataset`** — one row per ingested table/dataflow (e.g. `pesa-ch5-function`,
  `obr-psf-databank`). Carries licence + licence-verified-at, refresh cadence, source URL, and
  change-detection fields (`sourceEditionOrVersion`, `lastCheckedAt`, `lastRefreshedAt`) for the
  scheduler. `commercialUseExcluded` is a Phase-A-unused forward-compat field for Phase B's
  OECD commercial-exclusion flag (spec §"OUT OF SCOPE").
- **`stat_dimension`** — informational only (documents what axes a dataset has); not queried at
  runtime. `codeList` is a free-form JSON blob.
- **`stat_series`** — the catalogue. Unique on
  `(datasetId, sourceSeriesId, geography, cofogFunctionCode, forecastVintage, measure)`.
  `forecastVintage` is modelled here, not on the observation, because a forecast round (e.g.
  "March 2015 EFO") doesn't vary over time within one series — it's what makes that series
  line distinct from the outturn line and from every other vintage's line for the same measure.
  This is what lets OBR's Historical Official Forecasts Database hold **successive forecasts**
  (what was predicted in round N vs what actually happened) as coexisting series rather than
  overwriting each other.
- **`stat_observation`** — the fact table. `geography`, `cofogFunctionCode`, and `unit` are
  **denormalised from `stat_series` onto the observation row** — a deliberate star-schema
  tradeoff so the brief's required rollup query, "by (geography, cofog_function, time)", never
  needs a join through `stat_series`. Indexed on `(seriesId, periodStart)` (unique — one value
  per series per period, upsert target) and `(geography, cofogFunctionCode, periodStart)` (the
  rollup index).
- **`stat_cofog_function`** — the 10 top-level COFOG codes as a first-class reference table
  (`lib/cofog.ts`), FK'd from `stat_series.cofogFunctionCode`. Sub-function codes (e.g. `07.1`)
  are stored as free text on the series, not FK'd — the reference table only carries the
  top-level 10 (extending to the full official sub-function tree is a Phase B/C nice-to-have,
  not blocking).
- **`stat_refresh_log`** — one row per refresh attempt (`stat_dataset` 1:many), mirroring the
  existing Ops scheduler pattern (`scripts/operational`) but scoped to this DB and much
  lighter — no always-on daemon, see `STATS_REFRESH.md`.

## Time periods

`periodType` (`ANNUAL` / `FINANCIAL_YEAR` / `QUARTERLY` / `MONTHLY`) + `periodStart` (first day
of the period, as a real `DATE`/`TIMESTAMP` — the sortable form the spec asks for) +
`periodLabel` (the source's own display string, e.g. `"2025-26"`, `"2025 Q1"`, `"1900"`).
Financial years are anchored to 6 April. `lib/period.ts` has the parsers — one entry point per
period-string shape actually seen in the sources (`"2024-25"`, `"2024 to 2025"`, `"2025 Q1"`,
`"2025 JUL"`, bare 4-digit years).

## Geography

ISO-3166 alpha-2 for country level (`GB`), with room for ISO-3166-2:GB (`GB-ENG`/`GB-SCT`/
`GB-WLS`/`GB-NIR`) for devolved series — none of Phase A's sources needed a devolved split, so
no devolved rows exist yet, but the column supports it without a migration when they do. This
is also the field Phase C adds `US`/`FR` to.

## What's genuinely NOT built yet (honest gaps, not oversights)

- **No live database.** Schema is validated and the client generates offline; the initial
  migration SQL was produced via `prisma migrate diff --from-empty` (no DB connection needed
  for that command) and has never been applied anywhere. See the DB-choice section of the
  sprint report for why, and `seed-catalogue.ts`/`refresh-scheduler.ts` are therefore built but
  never run against a real target — same "built inert" pattern this codebase already uses for
  the vector-embed pipeline.
- **`ingest-handlers.ts` is untested against a live DB** for the same reason — the parsing logic
  underneath it (in `sources/*.ts`) IS tested, against real fetched data, in `measure-pilot.ts`
  runs (see the pilot scorecard). The upsert plumbing itself has not been exercised.
- Full COFOG sub-function code list (only top-10 + whatever sub-codes PESA's Table 5.2 rows
  happened to carry are seeded/seen — not the complete official COFOG classification tree).
- Sub-function-level FK integrity (sub-codes are free text, not FK'd to a sub-function
  reference row, since no such table was built this sprint).
