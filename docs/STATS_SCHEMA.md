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
- **`stat_cofog_function`** — the COFOG code list as a first-class reference table, FK'd from
  `stat_series.cofogFunctionCode`. **Sub-function codes (e.g. `07.1`) are FK'd too, not free
  text** — the `code` column is the FK target for every value, at any depth, and `parent`
  carries the top-level code a sub-function rolls up to.

  > **CORRECTION (2026-08-01).** This bullet previously claimed sub-codes were "stored as free
  > text on the series, not FK'd." That was wrong — `schema.prisma` has always declared a real
  > relation on this column. The doc and the schema disagreed, the schema won at runtime, and
  > the **entire PESA refresh failed with `P2003` on the first live ingest** because
  > `seed-catalogue.ts` seeds only the top-level 10 while PESA Table 5.2 reports against 59
  > sub-functions. Fixed in `lib/upsert.ts`'s `ensureCofogFunction()`, which creates a
  > sub-function reference row on demand from the source's own label (deriving `parent` from
  > the code) rather than relying on a hardcoded list that drifts as sources add breakdowns.
  > `seed-catalogue.ts` still seeds only the top-level 10 — that is now deliberate, since the
  > sub-tree is discovered from the data.
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

## The database (live since 2026-08-01)

Neon project **`scrutinise-stats`** (`winter-frost-26605722`), org `org-summer-tooth-29015000`,
region `aws-eu-west-2` (London — same region as the corpus project, different project),
Postgres 17, branch `main` (`br-soft-lake-za4122vr`), endpoint `ep-gentle-waterfall-zab5zcwv`,
database `neondb`. Compute is capped at 0.25–2 CU autoscaling with a 5-minute suspend timeout —
this workload is a few hundred MB and runs a handful of scheduled batch jobs a month, so it
should sit idle (and unbilled for compute) almost all the time.

Credentials live in **`scripts/stats/.env`** (gitignored) as `STATS_DATABASE_URL` (pooled) and
`STATS_DIRECT_URL` (non-pooled, used by `prisma.config.ts` for migrations).

**Before any migration or DDL against this DB, run `npx tsx --tsconfig ../tsconfig.json
whichdb.ts` from `scripts/stats/`** — the `docs/CLAUDE.md` §16 rule, with a stats-specific
guard: it prints host/database/user for both URLs and hard-fails if either resolves to the
corpus/app endpoint.

## Phase B — comparative / international (added 2026-08-03)

Additive to the same schema; **no schema rebuild** — the model was designed for this. Two new
things only: four `StatSource` enum values (`WORLD_BANK`, `OECD`, `IMF`, `EUROSTAT`, migration
`20260803070000_phase_b_sources`) and `scripts/stats/lib/iso.ts`.

### The one thing that makes comparison work: alpha-2 geography

Phase A wrote the UK as **`GB`** (alpha-2). Every international source speaks alpha-3 (`GBR`).
Had Phase B stored `GBR`, the UK's own spending would sit in a **different geography from its
own comparators** and no comparative query would ever line up. `lib/iso.ts` normalises every
country code to alpha-2 on the way in, so UK PESA rows and UK OECD rows share `GB`. This is the
single highest-consequence decision in Phase B.

Non-ISO published aggregates are kept verbatim and listed explicitly in `AGGREGATE_CODES`:
`OECD`, `OECD_REP` (OECD's own "average country"), `EUOECD`, `WLD`. Using OECD's published
average is deliberately preferred over averaging member rows ourselves, which would silently
weight by whichever members happen to report in a given year.

### Sources as built

| dataset | source | licence (verified at source 2026-08-03) | `commercialUseExcluded` |
|---|---|---|---|
| `wb-wdi-comparative` | World Bank WDI | **CC BY 4.0** (`data.worldbank.org/summary-terms-of-use`) | `false` |
| `oecd-cofog-expenditure` | OECD SDMX | **OECD T&C §3 "Data"** — reuse for any purpose *including commercial*, attribution required | `false` |

**The OECD licence contradicts the brief, and the verified position was taken.** The brief said
to set `commercialUseExcluded=true` because "pre-2024 content is CC-BY-NC". Verification at
source shows two problems with that: the CC-BY-NC question concerns OECD **written content**
(publications), which has its own clause — statistical **Data** is governed by §3, which states
"you can extract from, download, copy, adapt, print, distribute, share and embed Data for any
purpose, **even for commercial use**"; and even the pre-1-July-2024 written-content clause
permits "commercial and non-commercial" use. The brief's standing instruction was to *verify
each licence at its own terms page*, so verification won. This is one boolean in
`seed-catalogue.ts` — trivially reversible if Charlie prefers the conservative reading.
OECD's own caveat is carried in the module: individual datasets may declare third-party
restrictions in their metadata.

### COFOG is the join

OECD `EXPENDITURE` codes are `GF` + COFOG digits (`GF07` → `07`, `GF0605` → `06.5`), mapped by
`cofogFromExpenditureCode()` onto the **existing** `cofogFunctionCode` axis, with
`ensureCofogFunction()` auto-creating sub-codes exactly as PESA does. That is what lets
"UK health spending" (PESA) and "OECD-average health spending" (OECD) be compared on one column.

### Query layer

`query/stats-query.ts` gains `compareByCofogFunction()` (a COFOG function across geographies
over time), `compareByMeasure()` (a non-COFOG indicator across geographies), and
`availableGeographies()`.

### Not ingested, and why

- **IMF** — probed successfully (`GFS_COFOG`, `WEO` reachable; country-filtered CSV works —
  note the unfiltered `GFS_COFOG` response is **242 MB**, so country filtering is mandatory).
  **Not ingested: the licence could not be verified.** `imf.org/external/terms.htm`,
  `data.imf.org/en/Terms-of-Use` and `imf.org/en/About/copyright-and-terms` all return **403**
  from this environment, and the data's own `LICENSE` column reads *"© International Monetary
  Fund Copyright. All Rights Reserved."* — materially more restrictive than CC BY. Ingesting a
  source whose terms cannot be read, when its own metadata asserts all rights reserved, is not a
  defensible call. Needs Charlie to open the terms page in a browser and confirm.
- **Eurostat** — the brief marks it optional and time-boxed; not attempted this pass.

## What's genuinely NOT built yet (honest gaps, not oversights)

- **The scheduled invocation of `refresh-scheduler.ts` is not deployed.** The script is live-run
  and proven, but nothing calls it on a timer yet — that needs a Railway cron service, which is
  a paid resource and so sits behind the brief's "Charlie confirms before you provision anything
  that costs money" gate. See `STATS_REFRESH.md` for exactly what the wiring needs.
- **Refresh-failure alerting.** Failures are recorded in `stat_refresh_log` (and a
  zero-observation run is now correctly recorded as `FAILURE`), but nothing emails anyone.
- Full official COFOG sub-function tree. The reference table now holds the top-level 10 plus
  every sub-code the ingested sources actually report against, created on demand — not the
  complete official classification. Codes no source uses simply don't exist as rows.
- **PESA's health lines are attributed to top-level `07`, not to COFOG sub-functions.** PESA
  reports health as three unnumbered UK service categories ("Medical services", "Medical
  research", "Central and other health services") rather than COFOG `07.1`–`07.6`. Mapping
  "Medical services" to a single COFOG sub-function would be inventing a classification the
  source does not make, so the three are kept as distinct series under `07`, with the service
  name in `sourceSeriesId`. They sum to PESA's own "Total health" row exactly.
- A combined department × function × **year** cube. PESA publishes the function time series
  (Table 5.2, multi-year, no departmental split) and the departmental cross-tab (Table 5.1,
  single latest year) as separate tables; it does not publish the combined cube.
