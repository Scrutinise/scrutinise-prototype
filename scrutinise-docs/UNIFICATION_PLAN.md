# UNIFICATION PLAN — fold legacy `LegislationSection` into `corpus_sections`, and move the web-app tables Railway → Neon

*Spec written V24 (14 Jun 2026). **Report only — no migration this sprint** (brief §6). This is the build input for the next (structural) sprint. All counts are measured live 14 Jun 2026 against Neon unless cited from the S0 SEARCH_AUDIT (12 Jun); re-measure at migration time — the corpus is still growing.*

Two independent migrations are bundled here because they share the same cutover window and the same goal (one corpus store, one app DB):

- **A. Corpus unification** — retire the legacy `LegislationSection`/`LegislationItem`/`OperationalSection` legislation store, folding its unique value into `corpus_sections`.
- **B. App-DB move** — move the Prisma web-app tables from Railway Postgres to Neon (pooled endpoint), so Railway holds nothing and can be decommissioned.

---

## 1. INVENTORY (measured)

### 1.1 Legacy legislation store — `LegislationSection` (914,274 rows)

Duplicated **in full on BOTH** Railway (the web app's `DATABASE_URL`, ~2,029 MB DB) and Neon (`NEON_DATABASE_URL`, 1,712 MB of the table: 983 heap + 310 idx + 419 TOAST). Parent `LegislationItem`: 135,531 rows.

| field | population | meaning for the fold |
|---|---|---|
| `originalText` | 914,274 (100%) — **0.86 GB held in Postgres** | tag-stripped CLML section text. **NOT in R2 for most rows** → R2 backfill needed (see 2.2) |
| `compiledTextKey` (R2 compiled) | 24,579 (**2.7%**) | the AI-compiled current-state text — the legacy store's headline value — exists in R2 for only 2.7% |
| `originalXmlKey` (R2 enacted CLML) | 536,143 (58.6%) | |
| `tnaXmlKey` (R2 current CLML) | 487,526 (53.3%) | |
| `lexSummaryKey` (R2 Lex summary) | 1,142 (0.1%) | plain-English summary — effectively unbuilt |
| `ftsVector` | 914,274 (100%, **live trigger**) | **the live search index** — three web paths read it (§1.3) |
| `embedding vector(768)` | 0 (0%) | column exists, never populated |
| compilation metadata (`confidence`, `compilationStatus`, `compilationVersion`, `unappliedAmendments`, `needsReview`) | sparse (≤2.9%) | the compile-pipeline state; no equivalent column in `corpus_sections` |

`LegislationItem` carries the document-level identity: `legislationGovUkId` (e.g. `ukpga/2006/46`) — **identical in form to the `corpus_sections` docId** — plus `legislationType`, `tier`, `year`, `compilationStatus`, amendment/cross-ref relations.

Legacy `LegislationItem` by type (declared sections): UKSI 60,170 (473,828) · EUR 24,488 (75,658) · EUDN 13,173 (40,376) · UKPGA 11,768 (187,733) · NISR 9,316 · SSI 8,678 · WSI 4,645 · EUDR 2,035 · NISI 558 · ASP 395 · NIA 232 · ANAW 44 · ASC 29.

### 1.2 New pipeline — `corpus_sections` legislation corpora (1.31M compiled)

| corpus | rows | compiled | R2 compiled text |
|---|---:|---:|---|
| primary-acts-pre-2000 | 172,995 | 165,438 | r2Key 99.4% |
| primary-acts-2000plus | 90,901 | 90,838 | |
| si-pre-2010 | 174,553 | 174,552 | |
| si-2010plus | 281,241 | 270,339 | |
| regional | 346,274 | 331,124 | |
| retained-eu | 307,329 | 186,371 | |
| eur-lex | 90,260 | 90,260 | |
| **total** | | **≈1,308,922** | **356,634 distinct documents** |

`corpus_sections` columns the legacy store does NOT map onto cleanly: it has `r2Key`/`r2RawKey` (compiled + raw in R2) but **no** `compilationStatus`, `confidence`, `lexSummaryKey`, `amendment` linkage, or separate enacted-vs-current XML pointers. Its `ftsVector` trigger is a **no-op since V3** (93% of rows NULL) — `corpus_sections` has no working FTS today (SEARCH_AUDIT §1.4).

### 1.3 What reads the legacy store (all three live paths; none touch `corpus_sections`)

- `POST /api/search` → `lib/search.ts` → `LegislationSection.ftsVector` on **Neon** (Lex grounding — live). OperationalSection half runs on **Railway** (61,315 rows; Neon copy empty).
- `POST /api/ideas/[id]/legislation-search` → **Railway**, computes `to_tsvector` per query with **no index** (sequential scan), feeds `LegislationPanel` — live, hydrates R2 text via `compiledTextKey` (present for only 2.7% → most results show no text).
- `GET /api/legislation/search` → **Railway**, `title ILIKE` on `LegislationItem`.

**Migration B cannot complete until these three paths are repointed** (Neon for all, or onto the unified `corpus_sections` once it has FTS).

### 1.4 Overlap (the dedup core) — measured

Of 135,531 legacy `LegislationItem`s, **96,960 (71.5%) already exist in `corpus_sections`** matched by exact `legislationGovUkId`; **38,571 (28.5%) do not match**. The new pipeline holds 356,634 distinct legislation documents — 2.6× the legacy item count — so the new store is the **superset for coverage**, while the legacy store is the superset for the **compilation/summary/amendment layer** (which the new pipeline never built).

The 28.5% non-match is the investigation surface: it is a mix of (a) docId-form differences — the V19 ukpga *calendar-id vs chrome-id* issue, EU `eudn/eudr` vs `eur-lex` celex forms, `nisi/nia` regional sub-typing — and (b) genuinely legacy-only items the new enumeration didn't re-fetch. **This split must be resolved item-by-item before any legacy row is dropped** (a normalization pass, not a guess).

---

## 2. CONVERSION PLAN (A — corpus unification)

### 2.1 Decision: the legacy store is redundant for *coverage*, additive for *compilation*

`corpus_sections` already holds more legislation, with compiled text in R2 and exact word counts. The legacy table's only non-duplicated value is: the AI-**compiled current-state** text (2.7% in R2), **Lex summaries** (0.1%), and **amendment tracking**. Both the compiled text (97.3%) and summaries (99.9%) are *largely unbuilt* — so the legacy store is mostly raw `originalText` that the new pipeline already supersedes with R2-backed equivalents.

**Recommendation:** do NOT fold 914k legacy rows wholesale into `corpus_sections`. Instead:

1. **Coverage gap-fill (the additive 28.5%).** Normalize the 38,571 non-matching `legislationGovUkId`s; for those that are genuinely absent from `corpus_sections`, seed them through the **existing tna-legislation ingest** (queue rows) so they arrive as first-class `corpus_sections` rows with R2 text — not by copying the legacy column. This reuses a proven path and yields R2-backed text, fixing the legacy store's 97.3% "text only in Postgres" debt in passing.
2. **Compilation layer (optional, deferred).** The compiled/amended/Lex-summary layer is a *derived* product. Rather than carry it as section rows, keep it as an enrichment keyed by `(legislationGovUkId, sectionNumber)` that the search/Lex layer joins to `corpus_sections` on demand. If it must live in `corpus_sections`, add nullable columns (`compilation_status`, `lex_summary_key`, `amendment_count`) rather than a parallel table. Given only 2.7%/0.1% are populated, this is low-volume and can wait.
3. **Retire** `LegislationSection`/`LegislationItem`/`LegislationAmendment`/`LegislationCorrection`/`LegislationCrossRef` once (1) lands and the search paths (§1.3) are repointed.

### 2.2 If a wholesale fold is chosen instead (fallback) — the mechanics

- **Mapping.** `corpus_sections.id = '{corpus}:{legislationGovUkId}:{sectionNumber}'`, `corpus` derived from `legislationType` (UKPGA→primary-acts-{pre-2000|2000plus} by year; UKSI→si-{pre-2010|2010plus}; EUR/EUDN/EUDR→retained-eu/eur-lex; NISR/SSI/WSI/NISI/ASP/NIA/ANAW/ASC→regional). `format='clml'`, `status='compiled'`, `licence='ogl-3.0'` (retained-eu dual).
- **Dedup.** `INSERT … ON CONFLICT (id) DO NOTHING` — the 71.5% already present are skipped automatically; only the additive rows land.
- **R2 backfill (the real cost).** 97.3% of legacy rows have no compiled-text R2 key. Either (a) write `originalText` (0.86 GB) to R2 at `{corpus}/{gid}/sections/{N}.compiled.txt` and set `r2Key`, or (b) prefer the existing `tnaXmlKey`/`originalXmlKey` (53–59%) and re-compile. Backfill rate from SEARCH_AUDIT §4.4: ~178 rows/s R2 write → ~890k rows ≈ 1.4 h R2-bound, single process.
- **Cost guard.** Do NOT copy `originalText` into a `corpus_sections` text column — `corpus_sections` is pointer-only (text lives in R2); the V3 `compiledText` removal must not be reintroduced.

### 2.3 FTS prerequisite (blocks search cutover, not the fold)

`corpus_sections` FTS is a dead no-op trigger. Before search can move off the legacy `ftsVector`, `corpus_sections` needs a real FTS — but SEARCH_AUDIT §7 shows **full-corpus FTS-in-Neon is ~5 GB over the 20 GB budget**, while the **legislation+caselaw scope (~1.05M rows) fits in ~3.8 GB**. So the search-cutover scope is the legislation+caselaw subset, decided with Charlie in the search design thread — **out of scope here**, but it is the dependency that lets the legacy `ftsVector` be dropped.

---

## 3. CONVERSION PLAN (B — app tables Railway → Neon)

### 3.1 Scope

~60 Prisma models (`User`, `Idea`, `Comment`, `Vote`, `Endorsement`, `Group*`, `Points*`, `Notification`, `ActivityLog`, `OperationalDocument`/`OperationalSection`, the `Legislation*` family, …). These are small (kB–MB scale) except `OperationalSection` (61,315 rows on Railway) and the `Legislation*` family (handled by Migration A). Railway DB total ≈ 2.0 GB, dominated by the duplicated `LegislationSection`.

### 3.2 Mechanics

1. **Schema parity.** `LegislationSection`/`Item`/`OperationalSection` already exist on Neon (the V.4-FTS-3 copy). Run `prisma migrate deploy` against Neon to create the remaining app tables (User/Idea/… are NOT on Neon yet).
2. **Data copy.** Per-table `COPY`/`pg_dump --data-only` Railway→Neon, FK order respected. The app's live tables are small; the only bulk is `OperationalSection` (61,315) — seconds. Freeze writes during the copy (3.4).
3. **Repoint the app.** `DATABASE_URL` → Neon **pooled** endpoint (`-pooler` host, PgBouncer transaction mode). Vercel serverless needs the pooled endpoint + `pgbouncer=true&connection_limit=1`; keep a direct-endpoint `DIRECT_URL` for `prisma migrate`. Update `lib/prisma.ts` (currently Railway) and `lib/prisma-search.ts` (already Neon) — after this they are the same instance, so the dual-client split (`prisma` vs `prismaSearch`) collapses to one.
4. **Repoint search (§1.3).** All three paths to Neon; the `/legislation-search` seq-scan path should move onto the `ftsVector` index (or the unified `corpus_sections` FTS once built) — fixing a live performance bug in passing.
5. **Decommission Railway Postgres** once Neon is serving and a rollback window has passed.

### 3.3 Connection budget

Neon `max_connections = 901` (SEARCH_AUDIT §2.2); the pooled endpoint is mandatory for Vercel's serverless fan-out. Ingest already uses Neon (pool max 10) — the app's pooled traffic is additive but small; no contention near limits.

### 3.4 Downtime & 3.5 Rollback

**Downtime:** a single short write-freeze window. App tables are small, so the copy is **minutes**, not hours. Sequence: (1) enable read-only/maintenance banner, (2) final delta `COPY` Railway→Neon, (3) flip `DATABASE_URL` + redeploy Vercel, (4) smoke-test auth + idea create + Lex grounding + LegislationPanel, (5) lift maintenance. **Target: < 15 min user-visible.** Migration A's R2 backfill (~1.4 h) runs **before** the window, online, against `corpus_sections` (which the app doesn't read yet) — zero app downtime.

**Rollback:** Railway Postgres is left **intact and running** through the window and for a defined soak (≥ 1 week). Rollback = flip `DATABASE_URL` back to Railway + redeploy (minutes); no data is destroyed on Railway until soak passes. Because Migration A only **adds** `corpus_sections` rows (`ON CONFLICT DO NOTHING`) and never deletes legacy rows until step 2.3/§2.1.3, A is independently reversible (delete the added rows by `corpus`+`createdAt` watermark). The dangerous irreversible step — `DROP TABLE LegislationSection` — is **last**, gated on (a) search repointed and verified, (b) soak clean, (c) a verified Neon backup/branch.

---

## 4. SEQUENCING (next sprint)

1. Normalize the 38,571 non-matching legacy `legislationGovUkId`s → real coverage gap list (read-only).
2. Gap-fill that list via tna-legislation queue rows (online; R2-backed).
3. `prisma migrate deploy` on Neon for the app tables; copy app data (write-freeze window).
4. Repoint `DATABASE_URL` + all three search paths to Neon pooled; smoke-test; lift freeze.
5. Build `corpus_sections` FTS for the legislation+caselaw scope (search-thread decision) → repoint Lex grounding off the legacy `ftsVector`.
6. Soak ≥ 1 week. Then drop the legacy `Legislation*` tables and decommission Railway Postgres.

**Predicted user-visible downtime: < 15 min (one write-freeze).** **Rollback: minutes, until the final drop.** No data loss is possible before step 6 because every step before it is additive or repointable.

---

*Open dependency (Charlie): Neon plan/autoscale headroom — SEARCH_AUDIT flags full-corpus FTS as over-budget; the unified search scope (legislation+caselaw) fits. The app-DB move (B) is independent of that and can proceed first.*
