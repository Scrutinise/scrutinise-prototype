# Handover summary — V.4-FTS-1 complete → V.4-FTS-2 (Phase 2) + V.3-B-opt

**Date:** 21 May 2026
**Previous conversation:** V.4-FTS-1 sprint (Session 2), and V.3-B close-out
**Status:** V.4-FTS-1 working-tree complete, not yet deployed to Vercel. V.3-B-opt (Session 1) in parallel.

---

## CURRENT STATE

### What just happened (V.4-FTS-1)

Postgres native FTS (Phase 1) is complete:

1. **Migration ran** against production Railway — 645,174 LegislationSection rows backfilled (604.7s), GIN index built (24s). OperationalSection 90 rows. Both triggers installed.
2. **`lib/search.ts`** — shared search library with rank-then-headline CTE pattern. Two-query approach (legislation + operational, merged and sorted in application).
3. **`/api/search`** — auth-gated, Zod-validated POST endpoint.
4. **Pre-search hook** in `app/api/ai/[ideaId]/route.ts` — auto-injects up to 4 legislation results as `legislationContext` when user message is ≥4 words. Non-blocking on error.
5. **Schema updated** — `Unsupported("tsvector")?` fields and GIN index declarations in `prisma/schema.prisma`.
6. **Smoke test written** — `scripts/legislation/fts-smoke-test.ts` validates corpus health, CTE correctness, known queries, and latency.
7. **Report written** — `scrutinise-docs/fts_phase1_report.md`.

### What's NOT done yet

- **Smoke test not run** — needs to be run by Charlie against Railway to confirm latency and known-query correctness. Run: `cd scrutinise-web && npx ts-node --project ..\scripts\tsconfig.json ..\scripts\legislation\fts-smoke-test.ts`
- **Not deployed to Vercel** — working tree changes in `scrutinise-web/`. The DB is ready; the app changes need a Vercel deploy.
- **minRank tuning** — default is 0.05 (conservative). Should be reviewed after smoke test rank distribution output.

### Next immediate action

Run `commit-all.sh` (see project root) then run the smoke test.

---

## Forward roadmap (unchanged from previous handover, updated with V.4 status)

### Active parallel streams

**Stream A: V.3-B-opt** (CC session 1, ongoing)
- Pure TypeScript UKSI pipeline rewrite
- Eliminates PowerShell encoding bug class
- ~2 sprints estimated

**Stream B: V.4-FTS-2** (next sprint for this session)
- pgvector + Gemini text-embedding-004
- Semantic search to close the "GDPR ≠ data protection" gap
- Requires adding embedding column to LegislationSection, batch embed job, cosine-similarity query path

### Near-term (sprints 3-5)

| Sprint | Focus | Stream A (Backend) | Stream B (Search) |
|---|---|---|---|
| 3 | V.3-D + FTS Phase 2 | Devolved primary (~1,363 items, using new pipeline) | pgvector + Gemini embeddings |
| 4 | V.3-G + FTS Phase 3 | Devolved secondary (~37,000 items) | Hybrid FTS+vector with RRF |
| 5 | V.4-A + Lex analytical | HMRC manuals full ingest (~80) | Cross-corpus analytical mode |

---

## Key reference paths

| Resource | Path |
|---|---|
| Project root | `C:/Code/scrutinise-prototype` |
| Web app | `scrutinise-web/` |
| Scripts | `scripts/legislation/` |
| Docs | `scrutinise-docs/` |
| Schema | `scrutinise-web/prisma/schema.prisma` |
| Search library | `scrutinise-web/lib/search.ts` |
| Search API | `scrutinise-web/app/api/search/route.ts` |
| Lex AI route | `scrutinise-web/app/api/ai/[ideaId]/route.ts` |
| FTS migration | `scripts/legislation/fts-migration.ts` |
| FTS smoke test | `scripts/legislation/fts-smoke-test.ts` |
| Phase 1 report | `scrutinise-docs/fts_phase1_report.md` |
| R2 bucket | `scrutinise-legislation` |
| Railway project | `scrutinise-db` (Hobby tier) |

---

## Open questions for Charlie to decide

- **minRank default** — 0.05 is conservative (many low-quality matches returned). After running smoke test, review rank distribution and consider raising to 0.1 or 0.15 for the pre-search hook (where quality matters more than recall).
- **Lex tool call mode (Phase 2)** — Phase 1 uses implicit auto-search. Phase 2 brief should specify whether Lex should also get an explicit `searchLegislation` tool to call when it decides to search, or whether auto-search is sufficient.
- **V.4-FTS-2 timing** — start immediately after V.3-B-opt completes, or in parallel with V.3-B-opt Sprint 2?

---

## Apprentice-mode education delivered in V.4-FTS-1

(Continuing from V.3-B handover)

- Postgres tsvector internals: stemming, stopwords, lexeme structure
- GIN index mechanics: how @@ uses the inverted index
- ts_rank_cd: cover density scoring, why it's unbounded
- CTE pattern: why rank-then-headline reduces headline work from O(all matches) to O(limit)
- The `plainto_tsquery` vs `to_tsquery` distinction
- Why `Unsupported("tsvector")` in Prisma and what it means for schema management

---

## Notes for next CC session

- Read `scrutinise-docs/CLAUDE.md` especially Sections 12 (git discipline) and 13-14 (parse failure protocol, PowerShell encoding)
- Check memory files in `C:\Users\charl\.claude\projects\C--Code-scrutinise-prototype\memory\`
- V.4-FTS-2 brief does not yet exist — Charlie will write it, referencing the Phase 2 row in the table above
- V.3-B-opt (Session 1) is independent — do not touch `scripts/legislation/v3opt/`
