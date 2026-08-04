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
  scheduler. `commercialUseExcluded` is the dataset-level default for commercial terms — see
  "Commercial terms travel per series" below; **`imf-gfs-cofog` is the first source where it is
  `true`.**
- **`stat_dimension`** — informational only (documents what axes a dataset has); not queried at
  runtime. `codeList` is a free-form JSON blob.
- **`stat_series`** — the catalogue. Unique on **`seriesKey`** (see the next section; this
  replaced the old composite unique on
  `(datasetId, sourceSeriesId, geography, cofogFunctionCode, forecastVintage, measure)` on
  2026-08-04). `forecastVintage` is modelled here, not on the observation, because a forecast round (e.g.
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

## `seriesKey` — the stable identity (added 2026-08-04)

**Every series carries `seriesKey`: `TEXT NOT NULL UNIQUE`, a deterministic sha-256 hex over
its six identity fields.** It is the join key anything outside this database should store —
above all the search thread's catalogue index.

```
seriesKey = sha256_hex( datasetId ␟ measure ␟ geography ␟ cofogFunctionCode ␟ forecastVintage ␟ seriesLabel )
```

`␟` is U+001F (unit separator); a **null** field is written as U+001E (record separator). Both
are C0 control characters that cannot occur in a spreadsheet label, a slug or an ISO code, so
no value can impersonate a separator or a null. The definition lives in
**`scripts/stats/lib/series-key.ts`**, mirrored in SQL by the
`20260804180000_series_key` migration; `npm run check:series-key` asserts the two agree, that
every stored key matches its own identity fields, and that nothing collides.

**Why it had to exist.** `stat_series.id` is a cuid: unique, but not stable. Any change to how
a series key was computed minted a *new* row beside the old one that the upsert could no longer
reach — which is how 27 stale HMRC tax-gap series came to double-count 540 observations on
1 Aug 2026. The natural key could not stand in either: 3,404 series collapsed onto 3,244
distinct `(datasetId, measure, geography, cofogFunctionCode, forecastVintage)` tuples, because
`sourceSeriesId` was NULL for 2,925 of them.

**What is deliberately NOT in the key, and why it matters:** `unit` and `sourceSeriesId`. Both
are corrigible metadata *about* the same line of data. Had `unit` been in the key, recovering
OBR's 2,807 `unit='UNKNOWN'` series (see below) would have orphaned every one of them and
re-created the exact duplicate class this column exists to end. `upsertSeries` therefore
*updates* those fields on conflict rather than forking.

**What IS in it, and the price:** `seriesLabel`, because without it the key is not unique — the
distinguishing detail (which department, which tax, which wellbeing band) often lives only
there. The cost is that a source which **re-words a label** mints a new series. That is the
right trade here (labels derive from stable source structure — sheet names, COFOG names, tax
names) but it is the first thing to check if duplicate series ever reappear.

**`sourceSeriesId` is now populated on every series** (was NULL on 2,925 of 3,404). Where the
publisher issues a code it is used verbatim; where it issues none, `ingest-handlers.ts` derives
a stable slug from the source's own structure, prefixed **`derived:`** so an id we invented is
never mistaken for one the publisher assigned.

## Commercial terms travel per series (added 2026-08-04)

`commercialUseExcluded` now exists on **both** `stat_dataset` and `stat_series`. The series
column is nullable and **null means "inherit the dataset's value"**, which is the normal case.
Read it as `coalesce(series."commercialUseExcluded", dataset."commercialUseExcluded")` — never
the series column alone.

It exists because the dataset-level flag cannot express "the pre-2024 vintages of this source
are restricted", and where several series are quoted together (a COFOG rollup, a cross-country
comparison) the aggregate must be restricted if **any** contributing series is — the query
layer uses `bool_or` / `.some()` for exactly that. Understating terms is the dangerous
direction: a wrongly-licensed figure inside a commercial document is a legal problem, not a
style one.

Current position, both verified at source in a browser on 2026-08-04 (both pages 403 every
programmatic fetch — do not conclude from a 403 that the terms are unavailable):

| source | `commercialUseExcluded` | basis |
|---|---|---|
| **IMF** (`imf-gfs-cofog`) | **`true`** | "The Use of IMF Data" permits publication and redistribution with attribution, but: *"For any potential commercial reuse of IMF Data, please email copyright@imf.org to request permission."* |
| **OECD** (`oecd-cofog-expenditure`) | `false` | Terms §3 *Data* → Permitted Use: *"you can extract from, download, copy, adapt, print, distribute, share and embed Data for any purpose, even for commercial use."* §3 carries **no** before/after-1-July-2024 split — that split is in §1, *Written Content*, and even §1.2 permits commercial use. |
| everything else | `false` | OGL v3.0 / CC BY 4.0 |

> The sprint brief instructed `true` for OECD pre-2024 series. That instruction rests on a
> premise the terms contradict, verified twice now. The verified position was taken instead;
> it is one boolean in `seed-catalogue.ts` if Charlie prefers the conservative reading.

## Units

The vocabulary is a controlled list, extended as sources need it. **Unmapped source units are
skipped, never guessed** — a figure whose unit we cannot state is a figure that cannot be
quoted responsibly, and `scrutinise-web/lib/stats/stats-query.ts::findSeries` excludes
`unit='UNKNOWN'` from catalogue search for that reason.

Money: `GBP_MILLION`, `GBP_BILLION`, `USD`, `USD_PPP`/`USD_PPP_PER_CAPITA`.
Shares and rates: `PERCENT`, `PERCENT_GDP`, `PERCENT_TOTAL_EXPENDITURE`, `PERCENT_CHANGE_YOY`,
`PERCENT_POTENTIAL_OUTPUT`, `PERCENTAGE_POINT_GDP_CONTRIBUTION`, `PER_1000`.
Other: `INDEX`, `YEARS`, `MILLIONS`, `SCORE_0_10`, `GBP_PER_BARREL`, `USD_PER_BARREL`,
`GBP_PER_THERM`, `EUR_PER_GBP`.

The percentage-shaped ones are distinct on purpose: `2.1` rendered as a bare `%` reads as a
level, but `PERCENT_CHANGE_YOY` is a growth rate and `PERCENT_GDP` is a share. Lex's block
spells each out (`query-stats.ts::money`).

**OBR unit recovery (2026-08-05).** All 2,807 `obr-historical-forecasts` series carried
`unit='UNKNOWN'`, because the handler passed a hardcoded literal — so every one of them was
invisible to catalogue search. The workbook states its unit plainly at cell **A2** of each
sheet (`£ billion`, `per cent of GDP`, `Percentage change on a year earlier`, …), with a
parenthesised title as the fallback for the five sheets that have no unit row.
`sources/obr.ts::resolveHistoricalForecastUnit` reads it; the map was enumerated across all
131 sheets, not sampled. Result: `unit='UNKNOWN'` is now **0** rows, and all 2,807 series
reach search. Sheets that state no unit anywhere still resolve to `UNKNOWN` rather than a
guess.

> **Known coverage gap, pre-existing and out of this sprint's scope:** ~22 sheets in that same
> workbook (CPI, RPI, real GDP growth, unemployment, consumer spending, oil and gas prices …)
> report against **calendar** years, and `parseHistoricalForecastSheet` only parses financial
> years — so they contribute **zero** observations today. Not a regression; worth a look when
> OBR forecast coverage next matters.

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

### `GB` is the United Kingdom — deliberately NOT relabelled `UK` (decided 2026-08-04)

The 4 Aug brief asked for UK-wide series to be corrected from `GB` to `UK`, "or document the
choice explicitly if there's a reason". There is a reason, and it is decisive:

**`GB` is the ISO-3166-1 alpha-2 code for the United Kingdom of Great Britain and Northern
Ireland.** It is not an abbreviation of "Great Britain" that happens to be in the wrong column —
it is the correct code for the whole state, and it already includes Northern Ireland.
`UK` is *not* an ISO-3166-1 code at all (it is only exceptionally reserved). So PESA's UK public
expenditure sitting under `GB` is right, not a mislabel.

Relabelling to `UK` would also break the one decision that makes Phase B work: every
international source speaks alpha-3 `GBR`, normalised to `GB` on the way in (`lib/iso.ts`) so
that the UK's own figures land in the **same geography as its comparators**. Writing UK-wide
Phase A series as `UK` would put UK spending in a different geography from UK spending, and
nothing would line up — the exact failure the alpha-2 decision was taken to avoid.

What was actually wrong was the **display**: `geographyLabel('GB')` returned the string `GBR`.
That is fixed — it now returns "United Kingdom", so Lex says the country's name while the
database keeps the standard code. Downstream's "geography is an optional filter, never a
default" behaviour stays correct and is now a deliberate design choice rather than a workaround.

### Price base — a genuine gap, recorded rather than papered over

The brief's list of properties that must travel with every value is: `status`, **price base**,
`forecastVintage`, `geography`, `unit`. Four of the five now travel (`forecastVintage` was the
one missing, added 2026-08-05 — it matters immediately, because the 2,807 OBR forecast-round
series became visible to search the same day).

**Price base does not travel, because no source records one and there is nowhere to put it.**
There is no column for it, and none of ONS/OBR/PESA/HMRC/World Bank/OECD/IMF exposes it as a
dimension in the feeds ingested here. Adding a column would mean populating it per source from
our own reading of each publication — a real piece of work, and one that must not be done by
guessing, since "nominal" vs "real" is precisely the distinction that would be wrong. Flagged
here as the outstanding item on that rule rather than filled with an invented value.

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
