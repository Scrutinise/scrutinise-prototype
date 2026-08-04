# BRIEF FOR CC — STATS SCHEMA FIXES (one time-critical), PHASE B COMPLETION, APPEND-SAFE RESUME
**Written:** 04 Aug 2026, by CCh. Driven by the Lex thread's 04 Aug handover — its consumers are now live in front of users, so a data defect is a user-visible wrong answer in a document headed for Parliament. Priority order: §1 (time-critical) → §2 → §3 → §4.

## AUTONOMY
Run end-to-end; fix-or-report. No git until commit-all.sh. whichdb guard before any stats DDL (`npx tsx --tsconfig ../tsconfig.json whichdb.ts` from `scripts/stats/`; must resolve to `scrutinise-stats`, never the corpus DB). Backfills must be idempotent and reconciled with `verify.ts`.

## 1. ⏰ TIME-CRITICAL — deterministic `seriesKey` on `StatSeries`
**Why now:** the Search thread is about to build the stats catalogue index; it needs a stable join key. `stat_series.id` is a cuid (unique but NOT stable — a re-ingest mints a new row beside the old one; this double-counted 540 observations across 27 stale tax-gap series on 1 Aug). The natural key isn't unique either (3,404 series → 3,244 distinct `(datasetId, measure, geography, cofogFunctionCode, forecastVintage)` tuples, because `sourceSeriesId` is NULL for 2,925 and the distinguishing detail lives only in `seriesLabel`).
**Do:**
- Add a `seriesKey` column to `StatSeries` = a deterministic hash over `datasetId + measure + geography + cofogFunctionCode + forecastVintage + seriesLabel` (include the label precisely because it carries the distinguishing detail). Make it unique; it must survive re-ingest so a refresh updates rather than duplicates.
- Backfill it for all existing series; then de-duplicate the stale duplicates (the 27 tax-gap series / 540 obs class) — collapse to the surviving key, reconcile with `verify.ts`.
- Where the source provides a stable id, **populate `sourceSeriesId`** too (closes much of the ambiguity independently).
- Point the upsert path at `seriesKey` so future re-ingests are idempotent on it.
**Acceptance:** every series has a stable `seriesKey`; re-running any handler produces zero new duplicate series; the double-count is gone; Search can index against `seriesKey`.
**Cross-thread (confirmed 04 Aug by BOTH the Lex and Search threads):** the Search thread has **held** its stats catalogue-index build specifically pending this — it is the named, live downstream blocker, and it is right to wait rather than build on an unstable key. Two consequences for sequencing:
- **§1 must land before §4.** `seriesKey` must be the upsert target *before* Phase B re-ingests (OECD/IMF), or Phase B will mint the very duplicates this fixes. Do not parallelise §1 and §4.
- **On completion, signal the Search thread** with a one-line note: `seriesKey` is live, plus its exact column name and hash definition, so Search can un-hold and index against it. This handshake is what keeps the two threads in sync.

## 2. PROVENANCE + LICENCE CORRECTNESS (makes figures quotable + commercially safe)
- **Per-series commercial flag.** `commercialUseExcluded` currently sits on `StatDataset` and cannot express "pre-2024 vintages are non-commercial" — the real OECD case. Add a per-series `commercialUseExcluded` (series carries `forecastVintage`/period context) and **set it TRUE for OECD pre-2024 series**. Rationale: a commercial fork is a live possibility and a wrongly-licensed figure in a commercial document is a legal problem, not a style one. Confirm nothing else is mis-flagged (today nothing is flagged non-commercial, including OECD — that's the bug).
- **Every meaning-changing property must travel with the value** in the query payload: `status` (outturn vs forecast/projected), price base, `forecastVintage`, geography, unit. Lex mis-described outturn as "projected" until `status` travelled; the general rule is anything omitted, the model fills in. Audit `stats-query.ts`'s return shape against this and add any missing field.
- **Geography.** Phase A observations are labelled `GB` but PESA is `UK` public expenditure. Correct to `UK` at source for UK-wide series (or document the choice explicitly if there's a reason). Note downstream now treats geography as an optional filter because a `UK` default silently returned nothing — fixing the label removes that workaround.
- **Unit recovery.** OBR historical-forecast vintages carry `unit='UNKNOWN'` (e.g. `PSNB (April 1970)`) and are excluded from catalogue search. Recover the unit where derivable from the source/label; each recovered unit returns a real series to search.

## 3. FIX THE STALE SCRIPT-SIDE QUERY LAYER (sync the two mirrors)
`scripts/stats/query/stats-query.ts::getCofogRollup` queries measure `exp_by_subfunction` + geography `UK` — **neither exists live**. The live measures are `public_expenditure_by_function` (62 series, 60 COFOG codes, 2020-21…2024-25) and `dept_expenditure_by_function` (same total, cut by department). **NEVER sum across the two — they are alternative cuts of one quantity; summing doubles the answer.** The web-side mirror (`scrutinise-web/lib/stats/stats-query.ts`) carries the verified names. Update the script-side to match, and add a comment at both sites noting they are intentionally duplicated (script-side generated Prisma client is gitignored / outside the Vercel build root) and their analytical semantics MUST stay in sync.

## 4. COMPLETE PHASE B (OECD + IMF, to match World Bank coverage)
World Bank WDI (21 countries) is in. Finish Phase B per the original Phase B brief: **OECD** government expenditure by COFOG (set the per-series pre-2024 non-commercial flag from §2) and **IMF** GFS (COFOG-classified), across a country set matching the World Bank coverage. Verify licence at each source. Same DB, same idempotent upsert keyed on the new `seriesKey`. Report the intended vs achieved Phase B completion set (which OECD datasets, IMF yes/no) so "Phase B done" is evidenced. Phase C (US/France national sources) stays OUT of scope — confirm it is parked, not started.

## 5. APPEND-SAFE RESUME (so "ingested ≠ searchable" can't recur) — related, ingest-owned
Separate from stats: a resume-cursor defect left ~1.04M Scottish Parliament rows + part of CPS guidance out of the FTS index, and the gap grows. The Search thread owns rebuilding/merging the index; **Ingest owns the append-safe resume mechanism** so future large appends record their cursor safely and flag the index for re-merge before it serves users (playbook §20). Build/confirm that mechanism and ensure the current backfill hands Search a clean list of the unindexed rows to merge.

## 6. DOCS
Update `STATS_SCHEMA.md` (seriesKey, per-series commercial flag, geography, units), `STATS_REFRESH.md` (Phase B cadences), CHANGE_LOG, playbook §20. Scorecards per Phase B source. `verify.ts` clean.

## GIT
No git mid-sprint; single commit-all.sh; preview; Main.
