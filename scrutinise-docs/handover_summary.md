# Handover summary — V.4-FTS-3 IN PROGRESS (Neon migration + search enhancements)

**Date:** 26 May 2026  
**Previous conversations:** V.4-FTS-3 (this session); L6-C, V.3-E + V.3-F (earlier)  
**Status:** V.4-FTS-3 Parts 1 + 2 COMPLETE. Part 3 GATED (awaiting HMRC completion). Part 4 pending Part 3.

---

## CURRENT STATE

### V.4-FTS-3 — Neon Migration + Search Enhancements — IN PROGRESS

Sprint brief: CC BRIEF pasted into session — `Search Infrastructure Migration (V.4-FTS-3)`

#### Part 1 — Neon connection + prisma-search.ts — ✅ COMPLETE

- `NEON_DATABASE_URL` was already in `.env` at session start.
- Created `scrutinise-web/lib/prisma-search.ts` — separate Prisma client targeting Neon via `NEON_DATABASE_URL`. Uses lazy initialisation (Proxy-based) so the client is not created at module load time.
- Verified Neon connection: PostgreSQL 17.10, pgvector v0.8.0 available, fresh DB.

#### Part 2 — Neon schema + FTS enhancements — ✅ COMPLETE

**Schema push:**
- Ran `npx prisma db push --url NEON_DATABASE_URL` → 54 tables created on Neon (full schema).
- All 4 key search tables confirmed: `LegislationItem`, `LegislationSection`, `OperationalDocument`, `OperationalSection`.

**FTS setup (via `scripts/legislation/neon-fts-setup.ts`):**
- `legislation_english` TEXT SEARCH CONFIGURATION created (copy of `english`).
  - NOTE: Thesaurus synonym file is ready but requires server filesystem access (not available on Neon managed PG). Synonym expansion is application-layer only at runtime. See CLAUDE.md §15.
- `ftsVector tsvector` columns confirmed on both `LegislationSection` and `OperationalSection`.
- FTS triggers installed — both tables use `legislation_english` config.
- GIN indexes confirmed: `LegislationSection_ftsVector_idx` and `OperationalSection_ftsVector_idx` (Prisma created them via `@@index` during db push).
- pgvector extension enabled ✓
- `embedding vector(768)` added to `LegislationSection` (nullable — populated in V.4-FTS-2).

**Thesaurus files:**
- `scrutinise-web/prisma/pg_thesaurus/legislation_synonyms.ths` — synonym pairs (GDPR↔data protection, NHS↔national health service, etc.).
- `scripts/legislation/apply-fts-config.sql` — repeatable setup script for self-hosted PostgreSQL deployments.

**Prefix matching (search.ts):**
- `buildTsQuery()` helper added to `search.ts`.
- When input ends without a space → `to_tsquery` with `:*` on the final token (e.g. "data prot" → `data & prot:*`).
- When input ends with a space → `plainto_tsquery` (completed query, standard stemming).
- Both legislation and operational search branches updated.

#### Part 3 — Data transfer — 🔴 GATED

**Do NOT run** `scripts/legislation/transfer-to-neon.ts` **until Charlie confirms the HMRC full ingest (CC-C terminal) has completed successfully.**

Transfer script is written and ready:
- Cursor-based pagination (no OFFSET), batches of 1,000 rows.
- Checkpoint/resume to `scripts/legislation/neon-transfer-checkpoint.json` every 10,000 rows.
- Transfers `LegislationItem` first, then `LegislationSection`.
- Post-transfer verification compares row counts by `legislationType`.

Run command (when Charlie gives go-ahead):
```powershell
cd C:\Code\scrutinise-prototype\scrutinise-web
npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/legislation/transfer-to-neon.ts
```

#### Part 4 — Switch search query path — ⏳ PENDING Part 3

When transfer is verified, update `search.ts` to import `prismaSearch` (Neon) instead of `prisma` (Railway) for legislation search. Switch `app/api/search/route.ts` accordingly. Run `fts-smoke-test.ts` against Neon. Deploy to Vercel preview then production.

---

### L6-C — Lex Reliability Sprint — CLOSED (26 May 2026) — COMMITTED BUT NOT PUSHED

5 web app files modified. `commit-all.sh` at root includes L6-C commits + V.4-FTS-3 commits (see below). **Do not run commit-all.sh until Charlie approves.**

---

### V.3-C — HMRC Full Ingest (in progress in separate CC-C terminal)

`scripts/operational/hmrc-full-ingest.ts` — 137 manuals from gov.uk/government/collections/hmrc-manuals. Estimated 20–30 hours. Checkpoint/resume handles drops.

Check status via `scripts/operational/hmrc-full-checkpoint.json`.

---

## What's NOT done

- **Part 3 transfer** — GATED on HMRC completion; script is ready
- **Part 4 search query switch** — pending Part 3 verification
- **Vercel deploy** — Part 4 must complete first
- **V.4-FTS-2** — pgvector embeddings — embedding column added to schema, population deferred
- **UKSI full ingest** — 61,179 items, pipeline approved, awaiting Charlie decision
- **UKPGA/UKLA** — not yet ingested
- **Application-layer synonym expansion** — synonym .ths file and SQL script ready; TypeScript expansion not yet implemented (V.4-FTS-2 scope)

---

## Key file reference

| File | Purpose |
|------|---------|
| `scrutinise-web/lib/prisma-search.ts` | Neon Prisma client (lazy init) |
| `scrutinise-web/lib/search.ts` | FTS search — prefix matching added |
| `scrutinise-web/prisma/pg_thesaurus/legislation_synonyms.ths` | Synonym pairs for thesaurus |
| `scripts/legislation/neon-fts-setup.ts` | Neon schema FTS setup (idempotent) |
| `scripts/legislation/apply-fts-config.sql` | Self-hosted PG thesaurus setup |
| `scripts/legislation/transfer-to-neon.ts` | Data transfer Railway→Neon (GATED) |
| `scripts/legislation/test-neon-connection.ts` | Neon connectivity test |
| `scripts/legislation/neon-transfer-checkpoint.json` | Transfer progress (created on run) |

---

## Notes for next CC session

- Check `scripts/operational/hmrc-full-checkpoint.json` to confirm HMRC ingest completed.
- If HMRC complete: run Part 3 transfer (`transfer-to-neon.ts`), then Part 4 switch.
- Transfer will populate ftsVector automatically via the installed triggers.
- After Part 4, run `fts-smoke-test.ts` with Neon target before Vercel deploy.
- `commit-all.sh` at root covers L6-C + V.4-FTS-3 — do NOT run until Charlie approves.
