# SPEC — STATISTICS / QUANTITATIVE DATA LAYER

**Written:** 29 Jul 2026, by CCh. A new parallel workstream, not a corpus sprint. Read alongside CLAUDE.md and the multi-country roadmap.

## WHY THIS EXISTS

The text corpus holds the *laws, debates, judgments, guidance* — but not the *numbers*. Charlie's headline multi-country questions ("compare UK/US/France government expenditure", "what do they spend on differently", "how has it changed over time", "what were the outcomes") need **quantitative time-series data**: spending, revenue, debt, forecasts, and outcome statistics. Two of his four question types are unanswerable from text alone, and no amount of extra countries fixes that — the missing thing is a statistics layer. It is also what unlocks the highest-value question: *what can we learn from how other countries legislate — and did it work?* Without outcome data you can compare what was legislated but never whether it worked.

## GOVERNING ARCHITECTURE PRINCIPLE

**This is a different data model from the text corpus — do NOT force it into** `corpus_sections`**.** Text is documents; this is observations (a number, for a measure, for a place, at a time). Build it as its own store, modelled on **SDMX** — the ISO statistical-data standard that ONS, OECD, IMF, World Bank, Eurostat and the UN all use. The SDMX shape is:

-   **Dataset / dataflow** — a coherent table (e.g. "government expenditure by function").
-   **Dimensions** — geography, time period, measure, unit, and classification axes (for spending, the key one is **COFOG** — the Classification of the Functions of Government: the 10 standard functions — general public services, defence, public order, economic affairs, environment, housing, health, recreation/culture, education, social protection).
-   **Observation** — the numeric value at a unique combination of dimension options.

Designing on SDMX + COFOG + ISO country codes from day one is what makes both **multi-source** (ONS + OECD + IMF align) and **multi-country** (add the US and France as new geography values, comparisons work automatically) coherent. This is the single most important decision in the spec.

Storage: observations are small numeric rows but there are many (millions). They fit Postgres well as structured tables — but note the main Neon instance is already \~79% full, so give this layer **its own database** (a separate Neon project or a Postgres on the Hetzner box), not the corpus DB. Query treatment is analytical (aggregation, time-series, cross-country comparison), NOT full-text search — so this layer feeds Lex/analysis differently from the document search.

Freshness: unlike the mostly-static legal corpus, statistics **update on schedules** (monthly public finances, quarterly GDP, twice-yearly OBR forecasts). So this needs a **scheduled-refresh** design (re-pull changed series), not one-time ingestion.

## HOW MUCH IS AVAILABLE PUBLICLY — a great deal, mostly via free open APIs

### UK — current, historical, AND forecasts (all open, mostly OGL v3.0)

-   **ONS — two routes** (both open, no API key, OGL v3.0): (a) the **Beta API** `api.beta.ons.gov.uk/v1` (structured dataset/edition/version/dimension/observation — Census, regional, population, some economic); (b) the **CDID time-series CSV endpoint** on the ONS site, which carries the *headline* economic series the Beta API does NOT (GDP, CPI/inflation, unemployment, wages, trade — keyed by 4-character CDID codes). CC needs **both**; the headline series are the ones people actually ask about.
-   **OBR (Office for Budget Responsibility)** — the forecasts + deep history: the **Public Finances Databank** (all main tax/spending lines + fiscal aggregates), the **Historical Official Forecasts Database** (every forecast since 1970, incl. pre-OBR Treasury), the **Economic and Fiscal Outlook** editions (twice-yearly 5-year forecasts), and a **300-year historical public finances database** (tax/spending/borrowing/debt back to 1700). Stable spreadsheet URLs. This is the "current + historical + forecasts" trifecta in one source.
-   **HM Treasury PESA** (Public Expenditure Statistical Analyses) — detailed spending by department and function since 1983 (gov.uk spreadsheets). The granular UK spend breakdown.
-   **HMRC statistics** — tax receipts, the tax gap, reliefs (gov.uk). Pairs with the tax legislation we hold.
-   **Bank of England** — monetary/financial statistics database (rates, money, lending).
-   **DWP Stat-Xplore** — welfare/benefits (relevant to social-protection outcomes).
-   **Devolved:** StatsWales, Scottish Government statistics, NISRA.

### International / comparative — the multi-country backbone (all SDMX, mostly free)

-   **OECD** — SDMX API (`sdmx.oecd.org/public/rest/...`): **government expenditure by function (COFOG)**, Government at a Glance, tax revenue, and outcome indicators, on a comparable cross-country basis. This is *the* source for "what do the UK, US and France spend on differently." Licence: OECD Terms — **note the pre-2024 CC-BY-NC caveat we already hit** (carry a commercial-exclusion flag on OECD-sourced data).
-   **IMF** — SDMX API: Government Finance Statistics (GFS COFOG), World Economic Outlook. Standardised fiscal data.
-   **World Bank** — World Development Indicators API (free, CC-BY-4.0 — commercial-clean): the broadest cross-country outcome + economic set.
-   **Eurostat** — SDMX API: EU-comparable detail (useful for France and EU context).
-   **FRED (US Federal Reserve)** — 800,000+ US economic series (free API, key). Plus, per-country for depth later: **US** — USASpending.gov, BEA, BLS, Census, CBO/OMB; **France** — INSEE, data.gouv.fr.

**Verdict:** current data, decades-to-centuries of history, and official forecasts are all publicly and freely available, overwhelmingly via clean APIs, and the comparative layer is *already standardised* (SDMX + COFOG) — which is exactly why the multi-country questions are tractable rather than a data-cleaning nightmare.

## PHASING (prove on the UK first — same discipline as the text corpus)

-   **Phase A — UK spine.** Model the SDMX schema; ingest ONS (both routes), OBR (databank + historical + forecasts), PESA, HMRC. Deliver: UK spending-by-function, revenue, debt, and headline economic series, current + historical + forecast, queryable by COFOG function and time. Prove Lex can answer "how has UK health spending changed since 1997" and "what does the UK spend most on."
-   **Phase B — comparative frame.** Add OECD + World Bank + IMF (COFOG-aligned). Now "compare UK spending-by-function to the OECD average" works — still single-country-plus-benchmark, no second full jurisdiction yet.
-   **Phase C — per country.** When a second jurisdiction is funded (US, then France), add its national sources (BEA/USASpending; INSEE) mapped into the same SDMX/COFOG schema. The comparative questions light up automatically because the frame was built for it.

## WHAT IT ANSWERS (mapping to Charlie's questions)

-   "Compare UK/US/France expenditure; what's different" → OECD/IMF COFOG + national sources (Phase B/C). ✓
-   "How has this changed over time" → time-series is the native shape; OBR 300-year + ONS history give exceptional depth. ✓
-   "Which country has the simplest tax code" → hybrid: text metrics from the *corpus* (word/section/cross-reference counts of tax legislation) + revenue/complexity stats from *this layer*. A genuinely novel capability. ✓
-   "What can we learn from how others legislate — what were the outcomes" → the corpus gives the legislation; **this layer gives the outcomes** (World Bank/OECD indicators). The two together are the whole answer. ✓
-   "Differences moving UK→US regulatory regime for this product" → mostly the text corpus (comparative regulatory text), with this layer for market-size/economic context. ✓

## OUT OF SCOPE / DECISIONS TO CONFIRM

-   Which store (separate Neon project vs Hetzner Postgres) — decide before ingesting; not the 79%-full corpus DB.
-   Whether to hold raw observations only, or also pre-computed COFOG rollups for speed.
-   OECD commercial-exclusion flag must be carried per-series (as with the OECD text corpus).
-   This is a spec, not a sprint brief — when Charlie greenlights, it becomes a phased brief (Phase A first).

## GIT / PROCESS

Standard: no git mid-work; single commit-all.sh per phase; preview; Main. New DB → its own migration + connection config, kept separate from the corpus DB.
