# V.4-FTS-1 — Postgres native full-text search

**Sprint owner:** CC (separate session from V.3-B-opt for parallel work)
**Sprint goal:** Add keyword/phrase search across the legislation corpus using Postgres native FTS (tsvector + GIN).
**Estimated effort:** 1 sprint

---

## Background

The legislation corpus is now substantial:

- ~4,341 UKPGA primary statutes (V2.76-B)
- ~60,167 UKSI statutory instruments (V.3-B)
- ~80 HMRC operational manuals (pilot)
- Total ~650,000 sections

Lex currently has no ability to search this corpus. Every Lex response must rely on what's in its prompt or training data, neither of which contains the specific text of UK legislation. Adding search unlocks:

- "Find sections about data protection in legislation passed after 2018"
- "Show me the commencement order for the Online Safety Act"
- "What's the wording of section 5 of the Human Rights Act 1998?"
- Plus all the downstream analytical capabilities that depend on Lex citing specific text

This is Phase 1 of a four-phase FTS workstream:

| Phase | Capability | Sprint |
|---|---|---|
| **1** | **Postgres native FTS — keyword/phrase search** | **This sprint** |
| 2 | pgvector + Gemini embeddings — semantic search | Next |
| 3 | Hybrid FTS+vector with Reciprocal Rank Fusion | After 2 |
| 4 | Cross-corpus analytical search (Hansard, committees, codes) | Later |

## Goals (Phase 1)

| Goal | Target |
|---|---|
| Add `tsvector` column to LegislationSection + OperationalSection | Migration ships clean |
| Backfill index for entire corpus | <30 minutes total |
| Search API endpoint | `POST /api/search` returns ranked results <500ms p99 |
| Lex tool integration | `searchLegislation` tool callable from Lex |
| Test coverage | Search results match expected for known queries |

## Non-goals (Phase 1)

- Semantic search (Phase 2)
- Hybrid ranking (Phase 3)
- Cross-corpus (Phase 4)
- Search UI for end users (Lex uses it via tool calls; no public search page in Phase 1)
- Search analytics / query logging (later)

## Schema changes

```prisma
model LegislationSection {
  // ... existing fields
  
  // Postgres FTS index — populated by trigger from compiledText + title
  ftsVector  Unsupported("tsvector")?
  
  @@index([ftsVector], type: Gin)
}

model OperationalSection {
  // ... existing fields
  
  ftsVector  Unsupported("tsvector")?
  
  @@index([ftsVector], type: Gin)
}
```

Plus raw SQL migration for the trigger:

```sql
-- Trigger function: populate ftsVector from title + compiledText, weighted
CREATE OR REPLACE FUNCTION update_legislation_section_fts() RETURNS trigger AS $$
BEGIN
  NEW.fts_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.compiled_text, '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_legislation_section_fts
  BEFORE INSERT OR UPDATE OF title, compiled_text ON "LegislationSection"
  FOR EACH ROW EXECUTE FUNCTION update_legislation_section_fts();

-- Same pattern for OperationalSection
```

**Weighting rationale:**
- Title gets weight A (highest) — matches in title strongly indicate relevance
- compiledText gets weight B — matches in body are relevant but less than title

If we later add a `summary` field, it could be weight C.

## Backfill strategy

Existing 650k rows need their ftsVector populated. Cannot rely on trigger (only fires on UPDATE). Run a one-time backfill:

```sql
UPDATE "LegislationSection"
SET fts_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(compiled_text, '')), 'B')
WHERE fts_vector IS NULL;
```

Estimated runtime: 15-30 minutes for 650k rows on Railway Hobby tier. Run during low-traffic window. No downtime — search just isn't available until backfill completes.

For OperationalSection (smaller): runs in seconds.

## Search API design

### Endpoint

```
POST /api/search

Request body:
{
  "q": "data protection",          // required: query string
  "filters": {                      // optional
    "type": "ukpga" | "uksi" | "operational" | null,
    "year": number | null,
    "actId": string | null,         // restrict to one act
    "sourceType": DocumentSourceType | null
  },
  "limit": number,                  // default 20, max 100
  "offset": number,                 // default 0
  "minRank": number                 // default 0.05 — threshold for relevance
}

Response:
{
  "query": "data protection",
  "totalMatches": number,
  "results": [
    {
      "type": "ukpga" | "uksi" | "operational",
      "actId": "ukpga/2018/12",
      "sectionId": string,
      "sectionNumber": "5",
      "title": "Section title here",
      "snippet": "...highlighted match in context...",
      "rank": 0.789
    },
    ...
  ]
}
```

### Query construction

Postgres FTS uses `tsquery` syntax. The user-facing `q` string needs translation:

- **Plain text query** → `plainto_tsquery('english', q)` — handles AND/OR/phrase implicitly
- **Phrase search** (q in quotes) → `phraseto_tsquery('english', stripped_q)`
- **Boolean syntax** (advanced) → `to_tsquery('english', q)` — caller must format correctly

Initial release: use `plainto_tsquery` for safety. Boolean operators added later if needed.

### Ranking

```sql
SELECT
  *,
  ts_rank_cd(fts_vector, query) AS rank,
  ts_headline('english', compiled_text, query, 'MaxFragments=2,MinWords=10,MaxWords=30') AS snippet
FROM "LegislationSection", plainto_tsquery('english', :q) AS query
WHERE fts_vector @@ query
  AND -- filters
ORDER BY rank DESC
LIMIT :limit OFFSET :offset
```

- `ts_rank_cd` is cover density ranking — weights proximity of matched terms
- `ts_headline` generates the highlighted snippet for display
- GIN index makes `@@` query fast (sub-100ms for our corpus size)

### Cross-corpus search

The API queries both LegislationSection AND OperationalSection. Two approaches:

**Approach A: UNION query**
```sql
SELECT 'legislation' as source, ... FROM "LegislationSection" WHERE ...
UNION ALL
SELECT 'operational' as source, ... FROM "OperationalSection" WHERE ...
ORDER BY rank DESC
LIMIT 20
```

Simple. Works fine for hundreds-of-thousands-of-rows corpus.

**Approach B: Separate queries, merged in application**
Better for performance optimisation later. Less natural for Postgres.

**Recommend Approach A** for Phase 1 simplicity.

## Lex integration

Add a tool function Lex can call:

```typescript
// scrutinise-web/src/ai/tools/searchLegislation.ts
export const searchLegislationTool = {
  name: 'searchLegislation',
  description: 'Search UK legislation, statutory instruments, and government operational manuals for sections matching keywords or phrases. Use when you need to cite specific legislative text or find provisions on a topic.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search terms or phrase' },
      filters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['ukpga', 'uksi', 'operational'] },
          year: { type: 'number' },
          actId: { type: 'string', description: 'e.g. "ukpga/2018/12" to restrict to one Act' }
        }
      },
      limit: { type: 'number', default: 10 }
    },
    required: ['query']
  },
  execute: async (args) => {
    // Call /api/search internally, return formatted results
  }
}
```

Lex prompts updated to mention this tool is available and when to use it.

## Test strategy

**Unit tests:**
- Query construction (plain → tsquery, phrase handling, filter SQL fragments)
- Result formatting (snippet generation, rank threshold filtering)

**Integration tests:**
- Known-good queries against test data — e.g. query "data protection" against a fixture containing Data Protection Act 2018, expect that act in top 3 results
- Filter behaviour — `year: 2018` returns only 2018 items
- actId filter — `actId: 'ukpga/2018/12'` returns only sections from that act
- Empty results handled correctly
- Special characters in query (apostrophes, quotes, percent signs) don't break SQL or syntax

**E2E test:**
- Lex tool call returns results that Lex can use in a response
- Latency under 500ms p99 for typical queries

## Deliverables

1. Schema migration with tsvector columns and trigger
2. Backfill script run successfully against production Railway
3. `/api/search` endpoint with tests
4. Lex tool integration with prompt update
5. `scrutinise-docs/fts_phase1_report.md` documenting:
   - Backfill performance
   - Sample queries with results
   - Known limitations (English-only, no semantic, etc.)
6. Updated `handoff_summary.md`
7. `commit-all.sh`

## Out of scope reminders

- No vector embeddings — Phase 2
- No reranking — Phase 3
- No public search UI — Phase 4 or beyond
- No Hansard / committee material — Phase 4
- No query analytics — later

## Risk: search quality

Postgres FTS is good but not perfect. Expected limitations:

- **No semantic matching.** "GDPR" won't match "data protection regulation" unless both literal terms appear.
- **English-only by default.** Welsh-language ASP/NIA legislation needs separate config — defer to Phase 2 or beyond.
- **Stemming is rule-based.** Some legal terms stem badly (e.g. "ratify" → "ratifi" matches both "ratification" and "ratifier", which is usually right but not always).

These limitations are acceptable for Phase 1 because:
1. Most user queries to Lex include the right terminology
2. Phase 2 (vectors) addresses the semantic gap
3. Welsh content is small fraction of corpus

If Phase 1 quality is insufficient for production use, Phase 2 starts immediately.

## Sequencing note

This sprint can run in parallel with V.3-B-opt. The two streams touch different parts of the codebase:

- V.3-B-opt: `scripts/legislation/v3opt/` (new directory)
- V.4-FTS-1: `scrutinise-web/prisma/schema.prisma`, `scrutinise-web/src/app/api/search/`, `scrutinise-web/src/ai/tools/`

No file overlap. Different CC sessions can work concurrently. Coordination required only at sprint-close (both contribute to handoff_summary update).
