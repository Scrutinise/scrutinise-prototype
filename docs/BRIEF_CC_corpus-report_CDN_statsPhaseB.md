# BRIEF FOR CC — CORPUS REPORT + CDN FIX (tidy-ups) & STATISTICS PHASE B
**Written:** 02 Aug 2026, by CCh. Two parts: Part 1 is quick tidy-up; Part 2 is a real build (Phase B comparative statistics). Do Part 1 first (fast, unblocks the workbook), then Part 2.

## AUTONOMY
Run end-to-end; reversible choices are yours; fix-or-report otherwise. No git until commit-all.sh. **Verify each new source's licence at its own terms page.** Probe -> pilot -> measure -> auto-upgrade per source; predict-measure-compare. For Part 2, the whichdb guard applies: run `npx tsx --tsconfig ../tsconfig.json whichdb.ts` from `scripts/stats/` before any DDL, and it must resolve to `scrutinise-stats`, never the corpus DB.

---
# PART 1 — TIDY-UPS

## 1.1 Corpus status report generator
Build the re-runnable generator per `docs/reports/corpus-status-report.md`: write the script, run it once, produce the current workbook to `docs/reports/output/`, and confirm the tabs match the spec (Summary, Corpus Status ~68, Quangos ~1,255, Inquiries & Reviews, Regulators & Ombudsmen, Parliamentary, Gaps & Pending). Org/collection level, never section level. Optionally add a small "Statistics" tab (dataset count + observation count read from the stats DB) so the workbook reflects the stats layer exists — but do NOT fold time-series into it.

## 1.2 xlsx -> SheetJS CDN build (clears the prototype-pollution/ReDoS advisory)
Switch the `xlsx` dependency from the npm registry package to the **SheetJS CDN build** (pin the versioned tarball URL from `cdn.sheetjs.com` in `package.json`) in **all** places that use it: `scripts/costing/*`, `scripts/stats/*`, and anywhere else `xlsx` is imported. Rationale: the npm package is frozen with a high-severity advisory and no registry fix (SheetJS distributes fixes via their CDN only); the fixed version removes the advisory and the recurring `npm audit` noise. Keep the versions consistent across all locations. Verify each still parses its spreadsheets after the switch.

---
# PART 2 — STATISTICS LAYER, PHASE B (COMPARATIVE / INTERNATIONAL)
**Build input:** `docs/STATS_LAYER_SPEC.md` (Phase B section) + the as-built `docs/STATS_SCHEMA.md`. Additive to the existing `scrutinise-stats` DB and SDMX schema — no schema rebuild; the schema was designed for this (geography takes country codes, `cofogFunctionCode` is the comparison axis, `commercialUseExcluded` exists for OECD).

## 2.0 GOAL
Add the comparative frame so questions like "compare UK / OECD-average government spending by function" and "how does the UK tax-to-GDP ratio compare over time" become answerable. Phase B is the *benchmark* layer (UK-vs-OECD/world), NOT yet per-country national sources (that's Phase C). Prove on a representative comparative slice, same pilot discipline as Phase A — do not attempt exhaustive coverage of these vast sources.

## 2.1 SOURCES (SDMX/API — verify licence at each source)
- **World Bank — World Development Indicators (WDI) API.** Licence: **CC-BY 4.0 — commercially clean** (set `commercialUseExcluded=false`). Broadest cross-country economic + outcome indicators. Ingest a curated set: GDP, government expenditure (% GDP), tax revenue (% GDP), debt, plus key *outcome* indicators (life expectancy, education, health spend per capita) — the outcome half is what makes "did their approach work" answerable.
- **OECD — SDMX API** (`sdmx.oecd.org/public/rest/...`). **Government expenditure by COFOG function** (the exact "what do they spend on differently" data) + Government at a Glance + tax revenue. Licence: OECD Terms — **pre-2024 content is CC-BY-NC**, so **set `commercialUseExcluded=true` on OECD-sourced series** (this is what the dormant flag was built for). Rate-limited — pace via `politeFetch()`.
- **IMF — SDMX API.** Government Finance Statistics (GFS, COFOG-classified) + World Economic Outlook fiscal aggregates. Licence: verify IMF terms at source. COFOG-aligned, so it maps to the same `cofogFunctionCode` axis.
- **Eurostat — SDMX API** (optional this pass if time-boxed). EU-comparable government expenditure by function — useful context and the natural bridge to France later. Licence: verify.

## 2.2 IMPLEMENTATION
- New source modules under `scripts/stats/sources/` (`world-bank.ts`, `oecd.ts`, `imf.ts`, `eurostat.ts` optional), each an SDMX/REST client mirroring the Phase A module pattern (probe -> pilot -> measure -> ingest).
- Map into the **existing** schema: `geography` = ISO country codes (the OECD/world set); `cofogFunctionCode` = the COFOG function (FK, auto-creating sub-codes via `ensureCofogFunction` as Phase A does); `measure`/`unit` per series; `forecastVintage` mostly N/A (these are outturn/estimates). Register each as a `StatDataset` with its cadence (WDI annual; OECD annual; IMF per release) and licence + `commercialUseExcluded`.
- Same idempotent upsert + `verify.ts` reconciliation. A zero-observation run is a FAILURE (Phase A rule).
- **Do NOT provision anything new that costs money** — this all lands in the existing `scrutinise-stats` DB (a few hundred MB; Phase B adds curated series, still small). The Railway refresh cron stays OUT of scope (Charlie's hold).

## 2.3 ACCEPTANCE
- Each source: probed, licence-verified-at-source, piloted end-to-end, measured, seeded; `commercialUseExcluded` correctly set (true for OECD pre-2024, false for World Bank).
- The comparative query works: `stats-query.ts` can return, for a given COFOG function, the UK value alongside OECD/other-country values over time. Print one worked example in the report (e.g. UK vs OECD-average health spend %GDP, 2010-latest).
- Sizing: report the Phase B observation count + total DB size.
- Docs: update `STATS_SCHEMA.md` (Phase B sources), `STATS_REFRESH.md` (new cadences), CHANGE_LOG; scorecards per source.

## 2.4 OUT OF SCOPE (Phase C / later)
Per-country national sources (US: BEA/USASpending/BLS/CBO; France: INSEE) and the full multi-country expansion; the Railway refresh cron; Lex/search integration (separate threads — briefs issued).

## GIT
No git mid-sprint; single commit-all.sh; preview; Main.
