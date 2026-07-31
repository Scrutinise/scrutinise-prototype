# SPRINT — STATISTICS LAYER, PHASE A (UK SPINE)

**Written:** 29 Jul 2026, by CCh. Build input: `STATS_LAYER_SPEC.md` (read it first — governing architecture). This is Phase A only: the UK spine. International/comparative sources (Phase B) and other countries (Phase C) are out of scope here.

## GOAL

Stand up the statistics layer as its own store and ingest the UK fiscal + economic + forecast data, so Lex can answer questions like "how has UK health spending changed since 1997," "what does the UK spend most on," and "what's the UK tax-to-GDP ratio over time." Prove the pipeline on the UK before any comparative work — same discipline as the text corpus.

## AUTONOMY

Run end-to-end; reversible choices are yours; fix-or-report otherwise. No git until commit-all.sh. **Verify each source's licence at its own terms page** (expect OGL v3.0 for UK gov sources — confirm, don't assume). Probe -\> pilot -\> measure -\> auto-upgrade per source. Predict-measure-compare.

## 0. ARCHITECTURE (non-negotiable — from the spec)

-   **Separate database. Do NOT touch the corpus DB or** `corpus_sections`**.** The corpus Neon is \~79% full and being actively cleaned up for the DROP; this layer must not compete for that space or that workload. Stand up its own store (see §9 for the choice) with its own connection config and migrations.
-   **SDMX-shaped schema, NOT documents.** Observations, not text sections. R2 is for text blobs and is NOT used here — statistics live directly in the database as structured numeric rows.
-   **Scheduled-refresh, not one-time.** These series update on schedules (monthly PSF, quarterly GDP, twice-yearly OBR). Design incremental refresh from the start.

## 1. SCHEMA (SDMX-modelled)

Model on the SDMX concepts so Phase B/C sources drop in without rework:

-   `stat_dataset` — a dataflow/table (id, source, title, description, COFOG-relevant flag, licence, refresh cadence, source URL).
-   `stat_dimension` — the axes of a dataset (dataset_id, name e.g. geography/time/measure/unit/cofog_function, code_list).
-   `stat_series` — a catalogue entry: a unique combination of non-time dimensions (so a "series" = one line you can chart over time). Carry source series id (e.g. ONS CDID, OECD series key) for provenance + refresh.
-   `stat_observation` — the value (series_id, time_period, value, status/flag). This is the big table; keep the row narrow.
-   Country codes ISO-3166; time periods normalised (annual/quarterly/monthly) to a sortable form. **COFOG** (the 10 government functions) as a first-class code list on spending datasets — it's the axis the comparative questions turn on later. Add indexes for the query patterns: by series over time, and by (geography, cofog_function, time) for spending rollups.

## 2. ONS — TWO ROUTES (both OGL v3.0, no API key)

-   **Route A — Beta API** `api.beta.ons.gov.uk/v1`: structured dataset/edition/version/dimension/observation. Good for Census, population, regional, and the datasets it hosts. Enumerate the dataset catalogue, ingest relevant datasets (economy, public finance, population, wellbeing) into the schema.
-   **Route B — CDID time-series CSV endpoint** (on the ONS website): the **headline economic series the Beta API does NOT host** — GDP, CPI/inflation, unemployment, wages, trade — keyed by 4-character CDID codes. Ingest the key macro series (build/maintain a CDID list of the ones that matter). **Both routes are required** — Route B carries the series people actually ask about.
-   Probe both, pilot a handful of series end-to-end (catalogue -\> observations -\> schema), measure, auto-upgrade.

## 3. OBR (forecasts + deep history)

The richest single UK source. Stable spreadsheet URLs:

-   **Public Finances Databank** — all main tax/spending lines + fiscal aggregates (borrowing, debt), outturn + forecast.
-   **Historical Official Forecasts Database** — every forecast since 1970 (incl. pre-OBR Treasury) — lets us hold *successive forecasts* (what was predicted vs what happened), which is uniquely valuable.
-   **300-year historical public finances database** — tax/spending/borrowing/debt back to 1700.
-   **Economic and Fiscal Outlook (EFO)** editions — twice-yearly 5-year forecasts (each at a dated URL). Parse the spreadsheets into the observation schema; tag forecast vs outturn; keep the forecast *vintage* (which forecast round) so "what did the OBR predict in 2015 for 2020 vs actual" is answerable. Licence: verify (OBR is a non-departmental public body — expect Crown/OGL).

## 4. HM TREASURY PESA

Public Expenditure Statistical Analyses (gov.uk spreadsheets) — detailed **spending by department and function since 1983**. This is the granular UK spend breakdown and maps to COFOG. OGL. Ingest the department x function x year tables.

## 5. HMRC STATISTICS

Tax receipts, the tax gap, and reliefs (gov.uk). OGL. Pairs directly with the tax legislation already in the corpus. Ingest the headline receipts + tax-gap series.

## 6. REFRESH SCHEDULER

A scheduled job (pattern like the existing Ops scheduler, but for this DB) that re-pulls changed editions/versions per source cadence and upserts new observations idempotently. Record last-refresh per dataset. Don't re-pull unchanged series (check edition/version or last-updated first).

## 7. ACCESS FOR LEX / ANALYSIS

Expose the observations for the product: a thin query layer (service or well-indexed views) supporting time-series retrieval, COFOG rollups, and simple aggregation. This is analytical/numeric access, distinct from the document full-text search — note in the handoff how Lex should call it. (Full Lex integration can be a follow-on; Phase A must at least make the data cleanly queryable.)

## 8. VERIFICATION & DOCS

Per-source scorecards (series count, observation count, date span, licence-verified-at-source). Licence map for stats sources. `STATS_SCHEMA.md` (the SDMX model as built) + `STATS_REFRESH.md` (cadences + job). CHANGE_LOG. `tsc`/tests clean.

## 9. SIZING + DB CHOICE (measure, then decide)

-   **Measure at pilot:** after ingesting a representative slice (a few ONS datasets + the OBR databank), count observations and extrapolate the full UK-spine footprint. Expectation: **single-digit to low-tens of GB** — numeric rows are compact, so this is small vs the text corpus. Report the measured projection.
-   **DB choice:** given the small size and the cost sensitivity, recommend between (a) a **separate Neon project** (managed, clean, modest monthly) and (b) **Postgres on a small persistent Hetzner instance** (cheaper if you'll run one anyway, but self-managed). Do NOT co-locate on the corpus Neon. State your recommendation with the measured size + cost tradeoff; Charlie confirms before you provision anything that costs money.

## OUT OF SCOPE (Phase B/C)

OECD / IMF / World Bank / Eurostat comparative sources; FRED and other-country national sources; the cross-country comparative queries (they need Phase B data); full Lex conversational integration.

## GIT / PROCESS

No git mid-sprint; single commit-all.sh; preview; Main. New DB = its own migration + connection config, isolated from the corpus DB.
