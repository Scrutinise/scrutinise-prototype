# BRIEF FOR THE LEX THREAD — connect the statistics layer to the Router
**Written:** 02 Aug 2026, by CCh. Cross-thread: the stats DB + read layer are built (ingest thread); this wires Lex to use them. Coordinates with the search-thread brief (which makes stats *discoverable*); this brief makes Lex *retrieve and answer*.

## GOAL
Let Lex answer quantitative questions ("what does the UK spend most on", "how has UK health spending changed since 1997", "compare UK vs OECD-average tax-to-GDP") by retrieving from the statistics layer, not by guessing numbers from text.

## WHAT ALREADY EXISTS (don't rebuild)
- A separate stats DB (`scrutinise-stats` Neon project) holding SDMX-modelled observations: `stat_dataset` / `stat_series` / `stat_observation` / `stat_cofog_function`. UK spine now (Phase A); OECD/World Bank/IMF comparative being added (Phase B).
- A read layer: `scripts/stats/query/stats-query.ts` — the intended retrieval entry point for Lex/analysis. Reuse it; do not write a second query path.

## WHAT TO BUILD
1. **Runtime access.** Add `STATS_DATABASE_URL` (pooled, **read-only** — create a read-only Postgres role on the stats DB for this; Lex must never write) to the web app's environment (Vercel). Keep it distinct from the app's `DATABASE_URL` — the whichdb discipline applies to the app too.
2. **A stats tool for the Router.** Register a Lex tool/function the router can dispatch to, backed by `stats-query.ts`. Tool input schema (at minimum): topic/measure, geography (default `GB`; allow country set + "OECD average"), COFOG function (optional), time range, and outturn-vs-forecast. Tool output: the matching series + observations, plus each series' `source`, `licence`, `commercialUseExcluded`, and (where relevant) `forecastVintage`.
3. **Routing.** The router must recognise quantitative intent and dispatch to the stats tool rather than (or alongside) document search — e.g. "how much does the UK spend on health" is a stats query; "what does the Health Act say about funding" is a document query; some questions want both. Coordinate the intent signal with the search thread (see its brief) so a single query can surface both a relevant series and relevant documents.
4. **Answer composition.** Lex presents retrieved numbers with: the figure(s), the source attribution (e.g. "OBR public finances databank"), the period, and honest caveats — flag forecast vs outturn, and surface a non-commercial note for any `commercialUseExcluded=true` (OECD pre-2024) series if the answer is ever shown in a commercial context. Never invent or interpolate a number the query didn't return; if the series isn't held, say so rather than estimating.

## ACCEPTANCE
- `STATS_DATABASE_URL` set (read-only role); app cannot write to the stats DB.
- The stats tool is registered and the router dispatches quantitative queries to it; a worked example answers end-to-end (e.g. "what does the UK spend most on" -> COFOG rollup from the stats DB, correctly attributed).
- Comparative example works once Phase B lands (e.g. "compare UK and OECD-average health spending").
- No fabricated numbers: a query for an unheld series returns "not held", not a guess.

## COORDINATION / BOUNDARIES
- The **search thread** owns the router's stream definitions + the stats *catalogue* index (discoverability). This brief owns the *tool* + *answer composition*. Agree the retrieval contract (how a surfaced series is identified and its observations fetched) with the search thread before finalising.
- Read-only, separate DB, never write. This is additive to Lex; it doesn't change the document-grounding path.
