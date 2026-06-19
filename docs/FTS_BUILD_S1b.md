# FTS BUILD — Full-corpus BM25 on R2 (LanceDB native) — Search S1b

*Status: **BUILT (inert) — index run gated on Charlie's trigger.** Audit measured 17 Jun 2026 against Neon (`NEON_DATABASE_URL`) and R2 `scrutinise-legislation`, read-only. Indexer + query service + scoring harness written 19 Jun under `scripts/ingest/search/` (typechecks clean), but NOT run — the multi-hour R2 index build is a deliberate spend event Charlie triggers. The throwaway audit dir `tmp-s1b-audit/` has been removed. No production table touched; the dataset (`_search/corpus_fts.lance`) does not exist until the run.*

---

## §0 — BLOCKERS / decisions needed before build completes

1. **Gold set located + now canonical** — `docs/GOLD_QUERIES.md`. (Audit-time it was `GOLD_QUERIES_2.md`; renamed to the canonical `GOLD_QUERIES.md` in the 19 Jun docs consolidation, so the brief's original path is now the actual name. `GOLD_QUERIES_1.md` stays in `docs/Archive/`.) 30 queries, archetypes A–F, read 19 Jun. Scoring caveats it imposes:
   - Expected-sources are **CCh's unvalidated draft** (the file says so) → report numbers as provisional + eyeball-flag obvious right/wrong, per brief.
   - Matching is **citation-string → retrieved-result**, inherently approximate (expected sources are named "HA 1988 s.21", not corpus ids). The harness encodes per-query matchers; by-eye top-20 dump accompanies every score.
   - **Archetype D is `[GRAPH]`** (5/5 queries) — the gold file states text search alone *cannot* answer these (needs the unbuilt citation-edge table). D scores as a known v1 floor, like A's `[INFORCE]` flag. Report both as engine-floor, not failure.
2. **Indexing run is a deliberate spend event** (multi-hour R2 read + build on Railway). Per the brief, **CC builds, Charlie triggers**. *Charlie is clearing the build go-ahead with CCh* — artifacts stay uncommitted/unlaunched until then.
3. **`DATABASE_URL` in local `.env` still points at Railway**; `corpus_sections` lives on Neon. The audit used `NEON_DATABASE_URL` directly. The indexer/query-service will read `NEON_DATABASE_URL` explicitly (not `DATABASE_URL`) to be cutover-independent.

---

## §1 — Audit findings (measured)

### 1.1 corpus_sections — live counts (Neon, 17 Jun 2026)

| metric | value |
|---|---|
| total rows | **16,521,390** |
| status=compiled | **16,302,498** (the indexable set) |
| status=unavailable | 218,828 |
| status=failed | 64 |
| planner estimate (stale) | 14,971,631 |

`availability_status`: full 16,302,903 · pdf-only 117,711 · no-provisions 72,071 · metadata-only 28,705. **Index only `status='compiled'` (and implicitly `availability_status='full'`)** — the others have no body text in R2.

Brief's "~17.2M sections" ≈ the total; the **indexable body is ~16.3M compiled rows**.

### 1.2 Columns present (live information_schema) + population caveat

Present: `id, corpus, sourceUrl, r2Key, r2RawKey, compiledAt, wordCount, status, errorMsg, format, xmlPreview, notes, createdAt, ftsVector, availability_status, availability_note, sectionTitle, speaker, itemDate, parentDocId, licence, attribution`.

- **`jurisdiction` does NOT exist** → carry a literal `'uk'` default in Lance and flag (matches the brief's contingency). Devolved corpora (senedd-cofnod=wales, niassembly-hansard=ni, scotlawcom/nilawcom) are mislabelled by that default — a future relayed column or a corpus-derived override can fix it; flagged, not fixed, for v1.
- **`sectionTitle`, `itemDate`, `speaker` are NULL for every legislation & caselaw corpus** (si-*, regional, retained-eu, primary-acts-*, eur-lex, tna-caselaw, et-decisions, fca-handbook, …). They are populated for parliamentary/committee/guidance corpora. **Consequence: title-boosting only affects the parliamentary/guidance tiers; legislation/caselaw rely entirely on `body`.** Section identity for legislation lives in the `id`/`r2Key` path (e.g. `…/section-128/…`), not a title column.
- `parentDocId` ~100% everywhere (the doc-grouping key). `speaker` ~89% of pwdata. `licence`/`attribution` populated (carry for serving-layer filtering later).

### 1.3 R2 layout + key scheme

`corpus_sections.r2Key` is **authoritative and per-corpus-shaped** — it is NOT the legacy `compiledKey()` helper (`{id}/sections/{N}.compiled.txt`). The indexer must read the `r2Key` column verbatim. Sampled, all readable:

| corpus | sample r2Key | bytes |
|---|---|---|
| pwdata-debates | `pwdata-debates/debates1989-01-18a/sections/42/compiled.txt` | 192 |
| tna-caselaw | `caselaw/2003-ewca-civ-1768/compiled.txt` | 70,447 |
| primary-acts-2000plus | `primary-acts-2000plus/ukpga/2011/11/sections/schedule-6-paragraph-11/compiled.txt` | 1,971 |
| eur-lex | `eur-lex/31973R1057/sections/1/compiled.txt` | 4,435 |
| written-answers | `written-answers/2014-05-31:2014-06-30/sections/1/compiled.txt` | 1,867,864 |
| bills-api | `bills-api/2518/sections/1/compiled.txt` | 2,741 |
| senedd-cofnod | `senedd-cofnod/11126/sections/285/compiled.txt` | 401 |
| niassembly-hansard | `niassembly-hansard/175709/sections/56/compiled.txt` | 2,367 |
| inquiry-reports | `inquiry-reports/brook-house/sections/2/compiled.txt` | 993,185 |
| college-of-policing | `college-of-policing/app-content/armed-policing/sections/1/compiled.txt` | 2,170 |

`r2Key` populated for 99.4%+ of compiled rows. **Plan: carry `body` into the Lance dataset at index time (single R2 read), so the query service does not re-hit R2 per result for snippets.** (`compiledTextKey`-style per-result hydration stays available for full-text display.)

### 1.4 Oversized rows (>~512 KB body)

Proxy `wordCount > 84,000` (~6 B/word): **1,272 rows total.** Leaders: quangos-govuk 372 · tna-caselaw 165 · uk-treaties 133 · written-answers 128 (max 391k words ≈ 1.9 MB) · eur-lex 92 · inquiry-reports 68. Lance has **no 1 MB token/value limit** (unlike Postgres tsvector), so index as-is for v1. Flag: these are wrong-granularity (day-aggregates / whole-judgment), pending an ingest-side split — a retrieval-quality issue, not an index blocker.

### 1.5 LanceDB capability — VERIFIED (not asserted)

- Installed `@lancedb/lancedb` **v0.30.0** (Node/TS, NAPI) — installs clean on this platform.
- **Native FTS = the default.** `Index.fts()` builds the Lance-native **INVERTED** index (Rust), which **supports object storage (S3/R2)**. The **Tantivy** backend is Python-sync-only and **local-filesystem only** — it *cannot* index/query on R2. We use native. (Confirmed via LanceDB docs + the `FtsOptions` typings in `dist/indices.d.ts`.)
- Exact Node create call + the real camelCase options (from the v0.30.0 typings):

```ts
// NATIVE Lance inverted index (NOT Tantivy) — works on R2 object storage.
await tbl.createIndex("body", {
  config: lancedb.Index.fts({
    withPosition: true,      // phrase queries e.g. "income tax relief"
    baseTokenizer: "simple", // whitespace + punctuation split
    stem: true,              // English stemming ON
    language: "English",     // governs stem/stop-word behaviour
    removeStopWords: false,  // BM25 IDF already down-weights commons; English stop
                             // lists drop legally-meaningful modals (shall/may/must)
    asciiFolding: true,      // accented case-party / ECHR / EUR-lex names
    maxTokenLength: 40,      // drop base64/URL noise
    lowercase: true,         // (default) case-insensitive
  }),
});
```

> Note the real option names: `withPosition`, `baseTokenizer`, `removeStopWords`, `asciiFolding`, `maxTokenLength`, `lowercase` (lowercase, not lowerCase), `stem`, `language`. **There is no per-field weight inside the FTS index** — title-boost is a *query-time* concern (and only meaningful for tiers that have titles, see §1.2).

---

## §2 — Build plan (to execute on Charlie's go)

### Dataset (R2): `r2://scrutinise-legislation/_search/corpus_fts.lance`
Columns: `id, corpus, tier, sectionTitle, body, itemDate, speaker, parentDocId, jurisdiction(='uk'), availability_status`.

### tier map (corpus → tier; explicit, documented in the indexer)
- **legislation**: primary-acts-pre-2000, primary-acts-2000plus, si-pre-2010, si-2010plus, regional, retained-eu, eur-lex, explanatory-notes, explanatory-memoranda
- **caselaw**: tna-caselaw, et-decisions, echr-hudoc, ni-judgments, tax-tribunals
- **parliamentary**: pwdata-* (debates, lords, wrans, lordswrans, westminster, wms, lordswms), historic-hansard, lda-* (oral/written questions, divisions), written-answers, written-statements, niassembly-hansard, senedd-cofnod, committees-reports, committees-evidence, bills-api, uk-treaties, tax-treaties-dta
- **guidance**: hmrc-* (manuals, codes-guidance, ancillary, tiins), fca-handbook, college-of-policing, sentencing-council, quangos-govuk, govuk-core-docs, nao-reports, ots-reports, oecd, inquiry-reports, lawcom, scotlawcom, nilawcom, building-regs, planning-policy
- *(debatable, flagged: tax-tribunals→caselaw; uk-treaties/bills→parliamentary; law-commission reports→guidance.)*

### Indexer (Railway): stream compiled rows from Neon → R2 GET body → batch write to Lance → `createIndex("body", fts(...))`. Title-boost handled query-side.
### Query service (Railway): open dataset on R2, cache hot index files locally, `POST /fts-search {query, tier?, limit}`; per-field boost (~2.5× title, **starting point, untuned**); log cold/warm p50/p95.
### Scoring: 30 gold queries → recall@20 + MRR per archetype + overall (**blocked on §0.1**).

---

---

## §2A — AS-BUILT (19 Jun 2026, inert)

All under `scripts/ingest/search/`. `@lancedb/lancedb@^0.30.0` + `apache-arrow@^18.1.0` added to `scripts/ingest/package.json`. Everything reads `NEON_DATABASE_URL` (NOT `DATABASE_URL`) and reuses the existing `CLOUDFLARE_R2_*` creds.

| file | role |
|---|---|
| `lance.ts` | R2 storage-options + `connect()` helper; dataset = `s3://{bucket}/_search` table `corpus_fts` |
| `corpus-map.ts` | `tierFor(corpus)` + `jurisdictionFor(corpus)` — pure, shared by all three tools |
| `build-fts-index.ts` | the indexer (resumable + idempotent; see below) |
| `fts-core.ts` | pure BM25 search + query-time title-boost re-rank (no import side-effects) |
| `fts-query-service.ts` | HTTP `POST /fts-search`, `GET /stats`, `GET /health` |
| `score-fts.ts` | runs the 30 gold queries → `docs/FTS_S1b_SCORING.md` + `.json` |
| `gold-queries.ts` | the 30 GOLD_QUERIES queries + citation-string matchers |

### Checkpoint mechanism (brief addition #3) — REPORTED
Two independent guarantees so a multi-hour run survives the interruption class behind the 48h compute-cap outage:

1. **Idempotent writes.** Every batch is applied with `mergeInsert('id').whenMatchedUpdateAll().whenNotMatchedInsertAll()` keyed on the text PK `id`. Re-applying an already-committed batch UPDATES in place — re-runs (and a death after a Lance write but before the checkpoint save) NEVER duplicate Lance rows.
2. **Resumable cursor.** Progress is one value — the max `id` committed — persisted to R2 at `_search/corpus_fts.checkpoint.json` after every batch, with a `phase` (`loading`→`indexing`→`done`). Resume reads `WHERE id > lastId ORDER BY id` (PK btree; no re-read of the 16.3M done). A death during index-build resumes at the index step, not a full reload.

The cursor is the optimisation (skip work); mergeInsert is the correctness guarantee (no dupes). Together: a run that dies at hour 5 resumes; a run re-triggered from scratch is still safe. `--reset` drops the table + discards the checkpoint; `--limit N` runs a small canary over the first N ids.

### Jurisdiction (brief addition #2) — BUILT
`jurisdictionFor()` writes a real `jurisdiction` column into Lance: `senedd*`→wales; `scottish*`/`scotlawcom`→scotland; `niassembly-hansard`/`ni-judgments`/`nilawcom`→ni; everything else→`uk`. Avoids ~700k wrong-'uk' labels. No gold query filters on jurisdiction, so it doesn't affect scoring — it's label quality for the serving layer.

### Title-boost (brief addition #1) — BUILT, query-side, untuned
Index is on `body` only (no per-field weight in a Lance inverted index, §1.5). `fts-core.rankedSearch` over-fetches `limit×OVERSCAN` (default ×5, min 100) by BM25 on body, then multiplies the score of any hit whose `sectionTitle` contains a query term by `FTS_TITLE_BOOST` (default **2.5**, env-tunable) and re-sorts. Inert for legislation/caselaw (NULL titles, §1.2); only moves parliamentary/guidance rows. No pseudo-titles synthesised (confirmed option a). Real legislation/caselaw titles, when the LegislationSection↔corpus_sections unification lands them, start being boosted automatically.

### Run order (Charlie triggers) — runs ON RAILWAY, not the laptop
The build runs in Railway's datacenter (datacenter→R2 bandwidth; the audit's ~124 rows/s home rate ≈ 36h). It runs on a **dedicated, isolated `fts-build` Railway service** — NOT the Ingest worker (which is normally busy draining the queue and gets redeployed by Ops liveness on `pending>0`, which would bounce a build) and NOT a local `tsx`. The service is git-connected to `Main`/RAILPACK/root `scripts/ingest`, an identical build to Ingest. **Ingest deploys from git, so commit-all.sh precedes the canary** — the `search/` code + LanceDB/arrow deps must be on `Main` before Railway can build them.

Driver: `scripts/ingest/search/fts-railway-run.ts` (reads Neon+R2 creds from `scrutinise-web/.env`; the indexer never calls Railway).
```
# (commit-all.sh has run → FTS code is on Main)
# 0. stand up the dedicated build service (creates fts-build, builds image, idle-stops)
tsx search/fts-railway-run.ts setup
# 1. canary (first 5k ids → ~minutes, pennies; validates the REAL Railway→R2 path)
tsx search/fts-railway-run.ts canary        # → report, Charlie decides
# 2. full build (multi-hour; resumable — re-run "full" to resume from the R2 checkpoint)
tsx search/fts-railway-run.ts full
# 3. score (reads the finished R2 dataset; can run locally → docs/FTS_S1b_SCORING.md)
tsx search/score-fts.ts
# 4. free the compute
tsx search/fts-railway-run.ts teardown
# (optional) query service for latency numbers, locally or on a service:
#   FTS_PORT=8080 tsx search/fts-query-service.ts   # then POST /fts-search, GET /stats
```
`fts-railway-run.ts logs` tails the running build's `[fts-index]` log lines at any time.

### Expected v1 floors (brief addition #5) — encoded in the harness
Archetype **D** (all 5 = `[GRAPH]`) and the `[INFORCE]` aspects of A1/C3/D3 are marked `floor:true` and reported as engine-floor, not failure (text search alone can't answer; needs the unbuilt citation-edge + in-force tables). `[BILLS]` (all of F + B4) is NOT a floor — bills-api landed, so it scores for real. The report prints overall recall@20/MRR **both including and excluding** the `[GRAPH]` floor.

---

## §3 — Results (pending the Charlie-triggered run)
*(index stats, latency p50/p95, recall@20/MRR per archetype, cost, "what would move the numbers" — filled by `score-fts.ts` + the query service `/stats` after the run. Scoring numbers are PROVISIONAL until Charlie/CCh validate the citation-matcher key against the top-20 dumps, per §0.1.)*
