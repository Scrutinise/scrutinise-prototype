# V.4-FTS-1 — Postgres Native FTS: Phase 1 Report

**Date completed:** 21 May 2026
**Sprint:** V.4-FTS-1
**Status:** Migration complete, API live in working tree (not yet deployed to Vercel)

---

## Migration results

### Corpus backfilled

| Table               | Rows backfilled | Duration  | Throughput   |
|---------------------|-----------------|-----------|--------------|
| LegislationSection  | 645,174         | 604.7s    | ~1,067 rows/s |
| OperationalSection  | 90              | <1s       | —            |

The 645,174 LegislationSection rows comprise the full V.3-B corpus: ~4,341 UKPGA items + ~60,167 UKSI items, each with between 1 and ~30 sections per act.

### GIN index build times

| Index                                    | Duration |
|------------------------------------------|----------|
| LegislationSection_ftsVector_idx (GIN)   | 24.0s    |
| OperationalSection_ftsVector_idx (GIN)   | 0.1s     |

Index built on fully-populated columns (correct order: backfill → index).

### Trigger installation

Triggers installed on both tables: `BEFORE INSERT OR UPDATE OF sectionTitle, originalText` (LegislationSection) and `BEFORE INSERT OR UPDATE OF pageTitle, extractedText` (OperationalSection). New rows auto-populate ftsVector without manual intervention.

---

## Architecture decisions

### Rank-then-headline CTE pattern

Both legislation and operational queries use a two-level CTE:

```
WITH ranked AS (
  SELECT ..., ts_rank_cd(...) AS rank
  FROM "LegislationSection" ls JOIN ...
  WHERE "ftsVector" @@ plainto_tsquery('english', $1)
  ORDER BY rank DESC
  LIMIT {fetchLimit}          -- bounds the ts_headline work below
)
SELECT ...,
  ts_headline('english', ...) AS snippet
FROM ranked
WHERE rank >= {minRank}       -- applied post-LIMIT, filters the bounded set
ORDER BY rank DESC
```

`ts_headline` is expensive — computing it on all GIN matches for high-frequency terms like "person" or "data" would be O(many thousands). The CTE ensures it only runs on ≤ `fetchLimit` rows (limit + offset, capped at 120 for default params). This is the critical correctness property for the <500ms p99 target.

### FTS weighting

- `sectionTitle` → weight A (highest priority)
- `originalText` → weight B

Title matches rank higher than body matches. If summary fields are added later, they would be weight C.

### plainto_tsquery

Used for safety: parses user input without requiring tsquery syntax knowledge. Handles multi-word queries as implicit AND. Phrase search (`phraseto_tsquery`) and boolean (`to_tsquery`) available for Phase 2 if needed.

### minRank default (0.05)

`ts_rank_cd` is unbounded — not clamped to 0–1. The 0.05 default filters noise (terms that appear once in a section of 10,000 words), while allowing genuinely relevant matches. This value should be tuned against the rank distribution output from `fts-smoke-test.ts` once the smoke test has been run against production.

---

## Files produced

| File | Purpose |
|------|---------|
| `scripts/legislation/fts-migration.ts` | One-time migration: addColumns → installTriggers → backfill → buildIndexes |
| `scrutinise-web/lib/search.ts` | Shared search library used by API and AI route |
| `scrutinise-web/app/api/search/route.ts` | `POST /api/search` — auth-gated, Zod-validated |
| `scrutinise-web/app/api/ai/[ideaId]/route.ts` | Pre-search hook (≥4-word gate), auto-injects legislationContext |
| `scripts/legislation/fts-smoke-test.ts` | Smoke test: corpus health, CTE explain, known queries, latency |
| `scrutinise-web/prisma/schema.prisma` | `Unsupported("tsvector")` fields + GIN index declarations |

---

## Known limitations (Phase 1)

| Limitation | Severity | Mitigation |
|------------|----------|------------|
| No semantic matching ("GDPR" ≠ "data protection regulation") | Medium | Phase 2: pgvector + embeddings |
| English stemmer only — Welsh/NI legislation not covered | Low | Small fraction of corpus; defer to Phase 3+ |
| `totalMatches` is a window count (≤fetchLimit), not true corpus total | Low | Documented in type annotation; sufficient for Lex grounding |
| ts_rank_cd unbounded — Zod max(1) removed from `/api/search` | Resolved | Documented in route.ts comment |

---

## Smoke test

Run before declaring Phase 1 production-ready:

```
cd scrutinise-web
npx ts-node --project ..\scripts\tsconfig.json ..\scripts\legislation\fts-smoke-test.ts
```

The script validates:
1. Corpus health — all 645k rows backfilled, no NULL ftsVector
2. EXPLAIN ANALYZE — GIN index used, ts_headline bounded by CTE
3. Known-query correctness — Data Protection Act 2018, Human Rights Act 1998, commencement SIs
4. Latency — p99 proxy for "person" (worst-case high-frequency term) ≤ 500ms
5. Rank distribution sample — data to tune minRank default

---

## Lex integration (Phase 1)

The pre-search hook in `app/api/ai/[ideaId]/route.ts` auto-searches on every substantive Lex message (≥4 words) and injects up to 4 results as `legislationContext` into the Lex system prompt. Lex uses these to cite specific legislation where relevant, with the prompt instruction to note results should be verified and not treat them as authoritative.

Phase 2 will add explicit `searchLegislation` tool calls where Lex can decide when to search (and on what query), rather than the implicit auto-search on the user message.

---

## Next steps (Phase 2)

Phase 2 adds pgvector + Gemini embeddings for semantic search. Key additions:
- Embedding column on LegislationSection
- Gemini text-embedding-004 for query and document vectors
- Cosine similarity ranking
- Reciprocal Rank Fusion (RRF) to merge FTS and vector scores in Phase 3
