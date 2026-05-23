# Handover summary — V.3-B-opt CLOSED → V.4-FTS-1 (pending deploy) + V.4-FTS-2 (next)

**Date:** 23 May 2026  
**Previous conversations:** V.4-FTS-1 sprint (Session 2); V.3-B-opt (Sessions 1 & 2)  
**Status:** V.3-B-opt sprint CLOSED. V.4-FTS-1 working-tree complete, not yet deployed to Vercel. V.4-FTS-2 not yet started.

---

## CURRENT STATE

### V.3-B-opt — CLOSED (23 May 2026)

Pure-TypeScript UKSI ingest pipeline rewrite is complete and validated.

**What was delivered:**
1. **Full pipeline rewrite** — `scripts/legislation/v3opt/` — pure TypeScript, no PowerShell, no encoding risk. Eliminates the Windows-1252 encoding bug class that caused V.3-B to silently corrupt Unicode at item 33,942.
2. **4-worker parallel architecture** — `worker_threads` + checkpoint/resume per worker. Worker crash recovery (3 retries before give-up).
3. **PGSCHEMA isolation mechanism** — `db.ts` + `setup-test-schema.js` — allows full pilot runs against an isolated schema without touching production.
4. **R2_KEY_PREFIX isolation** — pilot R2 writes under `v3opt-pilot/` prefix, zero production namespace pollution.
5. **Verify module** — `src/verify.ts` — DB integrity checks (sectionCount header vs actual rows, R2 blob spot-checks, web parity against legislation.gov.uk). PGSCHEMA fix applied for `$queryRaw` schema qualification.
6. **Unit + integration test suite** — `__tests__/` — vitest, covers parser, batch, checkpoint, parseActId, r2keys.

**Pilot results (see `v3opt_pilot_report.md` for full data):**

| Pilot | Items | Sections | Errors | Elapsed | Throughput |
|-------|-------|----------|--------|---------|-----------|
| Pilot-100 | 100 | 658 | 0 | 54s | ~6,667/hr |
| Pilot-1000 | 998 (898 new) | 5,343 | 0 | 304s | **~10,634/hr** |

**Benchmark: 10,634 items/hr vs V.3-B baseline ~700/hr → 15.2× improvement.**

**Cross-comparison vs V.3-B production (see `v3opt_v3b_comparison.md`):**
- 998/998 items matched in production (100% coverage)
- 16 title differences: expected (`(revoked)` suffix — v3opt is more accurate)
- 273 sectionCount differences: expected (made vs revised-current version distinction)
- 8 items where v3opt has MORE sections than production: positive (fresher TNA data)
- **Overall: No correctness bugs found. Pipeline approved for full ingest.**

**Committed:** `89dc782` — `V.3-B-opt: UKSI ingest rewrite — 100-item pilot pass (100 items, 658 sections, 0 errors, 54s, idempotent)`

### What's NOT done yet

- **Full ingest not run** — 61,179 items awaiting `--full` run. Pre-flight checklist in `v3opt_pilot_report.md`. Charlie to decide timing and whether to filter to `revised-current` only (see comparison report Option A/B analysis).
- **V.4-FTS-1 not deployed to Vercel** — working tree changes in `scrutinise-web/`. The DB migration ran against production Railway in the previous sprint. App changes need a Vercel deploy.
- **V.4-FTS-1 smoke test not run** — run: `cd scrutinise-web && npx ts-node --project ..\scripts\tsconfig.json ..\scripts\legislation\fts-smoke-test.ts`

### Next immediate actions (in priority order)

1. **Run V.4-FTS-1 smoke test** (Charlie, in terminal) then deploy to Vercel.
2. **Decide V.3-B-opt full ingest timing** — Option A (all versions, 61,179 items, ~6hrs) or Option B (revised-current only). See `v3opt_v3b_comparison.md`.
3. **Start V.4-FTS-2** — pgvector + Gemini embeddings (brief not yet written).

---

## Forward roadmap

### Active parallel streams

**Stream A: V.3-B-opt full ingest** (pending Charlie decision)
- Pre-flight checklist complete; pipeline approved
- Run `node dist/main.js --full` from `scripts/legislation/v3opt/`
- ~5–6 hours estimated

**Stream B: V.4-FTS-2** (next sprint for this session)
- pgvector + Gemini text-embedding-004
- Semantic search to close the "GDPR ≠ data protection" gap
- Requires: embedding column on LegislationSection, batch embed job, cosine-similarity query path

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
| v3opt ingest | `scripts/legislation/v3opt/` |
| Docs | `scrutinise-docs/` |
| Schema | `scrutinise-web/prisma/schema.prisma` |
| Search library | `scrutinise-web/lib/search.ts` |
| Search API | `scrutinise-web/app/api/search/route.ts` |
| Lex AI route | `scrutinise-web/app/api/ai/[ideaId]/route.ts` |
| FTS smoke test | `scripts/legislation/fts-smoke-test.ts` |
| FTS phase 1 report | `scrutinise-docs/fts_phase1_report.md` |
| v3opt pilot report | `scrutinise-docs/v3opt_pilot_report.md` |
| v3opt vs V.3-B comparison | `scrutinise-docs/v3opt_v3b_comparison.md` |
| R2 bucket | `scrutinise-legislation` |
| Railway project | `scrutinise-db` (Hobby tier) |

---

## Open questions for Charlie to decide

- **V.3-B-opt full ingest: Option A or B?** Option A ingests all versions (made + revised-current, 61,179 items). Option B ingests revised-current only (fewer items, corpus closer to V.3-B). See `v3opt_v3b_comparison.md` for full analysis. CC recommends Option A.
- **V.4-FTS-2 timing** — start before or after V.3-B-opt full ingest completes?
- **minRank default** (FTS) — 0.05 is conservative. Review after smoke test rank distribution output; consider raising to 0.1–0.15.
- **Lex tool call mode (Phase 2)** — explicit `searchLegislation` tool vs auto-search only.

---

## Apprentice-mode education delivered in V.3-B-opt sessions

(Continuing from V.4-FTS-1 handover)

- `worker_threads` architecture: why parallelism requires checkpoint-per-worker for safe crash recovery
- Prisma adapter schema option vs `$queryRaw` literal SQL — why schema qualification must be explicit in raw queries
- UKSI instrument versioning: `made` (original enacted) vs `revised-current` (TNA current) — why section counts naturally diverge over time
- R2 key prefix isolation as a safe pilot pattern — how to write to a quarantine namespace without code changes beyond env vars
- Cross-schema SQL comparison as a verification technique for ingest correctness

---

## Notes for next CC session

- Read `scrutinise-docs/CLAUDE.md` especially Sections 12 (git discipline), 13 (parse failure protocol), 14 (PowerShell encoding)
- Check memory files in `C:\Users\charl\.claude\projects\C--Code-scrutinise-prototype\memory\`
- V.3-B-opt full ingest decision rests with Charlie (Option A/B above)
- V.4-FTS-2 brief does not yet exist — Charlie will write it
- Do NOT touch `scripts/legislation/v3opt/` node_modules or run `npm install` in that directory without checking the existing dependency set first
