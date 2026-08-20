# BRIEF FOR THE SEARCH THREAD — make the statistics layer properly searchable
**Written:** 02 Aug 2026, by CCh. Cross-thread: the stats data is built (ingest thread); Lex retrieval is a separate brief. This brief makes statistics *discoverable* through search so the router can surface the right series.

## THE PROBLEM
Statistics are numeric observations, not text — they won't appear in the full-text index the way documents do. But a user searching "UK health spending" should discover that a relevant *series* exists, not just legislation and debates. So the search layer needs to index the stats **catalogue** (the metadata describing what series exist), while the numbers themselves are fetched on demand via the stats query layer.

## KEY DISTINCTION
- **Index (searchable text):** the catalogue — `stat_dataset` + `stat_series` metadata: dataset title/description, measure name, COFOG function label, geography, source, time span. This is small (datasets + series rows, not observations) and text-like — perfect for the existing FTS/embedding index.
- **Do NOT index:** the observations themselves (the ~28k+ numeric rows). Numbers aren't full-text-searched; they're retrieved by the query layer once a series is identified.

## WHAT TO BUILD
1. **A `statistics` content stream in the query router.** Add it alongside the existing streams (legislation, debates, committees, case law, guidance). The router should recognise quantitative/comparative intent ("how much", "spending on", "compare X and Y", "over time", "rate of") and include the statistics stream in dispatch.
2. **Index the stats catalogue.** Pull `stat_dataset` + `stat_series` metadata (read-only, from `STATS_DATABASE_URL` — a read-only role; the stats DB is a separate Neon project) and index the text fields into the search index (FTS + embeddings, consistent with how the document streams are indexed). Refresh this when the stats catalogue grows (Phase B adds OECD/World Bank/IMF series; a periodic re-index or a hook on stats refresh).
3. **Return enough to retrieve.** A stats hit should carry the series identity (dataset id + series key) so the retrieval contract (shared with the Lex thread) can fetch the actual observations via `stats-query.ts`. Search surfaces *that a series exists and is relevant*; the query layer returns *the numbers*.
4. **Blended results.** For queries that want both (e.g. "UK health spending" — relevant legislation AND the spending series), the router should be able to return document hits and a stats-series hit together, so Lex can compose an answer that cites both the law and the numbers.

## ACCEPTANCE
- `statistics` stream present in the router; quantitative-intent queries dispatch to it.
- Stats catalogue indexed (catalogue metadata only, not observations); re-indexes as the catalogue grows.
- A worked example: "UK health spending" surfaces the relevant COFOG/health spending series (with its identity for retrieval) alongside relevant documents.
- Read-only access to the stats DB; separate from the corpus DB.

## COORDINATION / BOUNDARIES
- This brief owns the **router stream + catalogue index (discoverability)**. The **Lex thread** owns the **tool + answer composition**. Agree the retrieval contract (series identity -> observation fetch) between the two threads.
- The stats DB is a separate Neon project (`scrutinise-stats`); index only its catalogue metadata, and only read-only. Do not couple the stats catalogue into the corpus DB (which is being slimmed for the DROP).
