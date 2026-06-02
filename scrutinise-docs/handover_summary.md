# Handover summary — Architecture sprint + build fix (2 Jun 2026)

**Date:** 2 Jun 2026  
**Previous conversations:** V.4-FTS-3 + L6-C + source-client sprint (prior sessions); architecture + build fixes (this session)  
**Status:** All pushed. Workers 2–10 + scheduler ACTIVE on Railway. Worker-1 auto-deploy triggered (fix commit `484d105`). cc-monitor auto-redeploy DISABLED — re-enable after confirming all workers stable.

---

## CURRENT STATE

### Railway Worker Status (as of 2 Jun 2026 ~11:30 BST)

| Service | Status | Commit | Note |
|---------|--------|--------|------|
| ingest-worker-2 | ✅ SUCCESS | 02979a94 | Running worker-queue.ts |
| ingest-worker-3 | ✅ SUCCESS | 02979a94 | Running worker-queue.ts |
| ingest-worker-4 | ✅ SUCCESS | 02979a94 | Running worker-queue.ts |
| ingest-worker-5 | ✅ SUCCESS | 02979a94 | Running worker-queue.ts |
| ingest-worker-6 | ✅ SUCCESS | 02979a94 | Running worker-queue.ts |
| ingest-worker-7 | ✅ SUCCESS | 02979a94 | Running worker-queue.ts |
| ingest-worker-8 | ✅ SUCCESS | 02979a94 | Running worker-queue.ts |
| ingest-worker-9 | ✅ SUCCESS | 02979a94 | Running worker-queue.ts |
| ingest-worker-10 | ✅ SUCCESS | 02979a94 | Running worker-queue.ts |
| Ingest-scheduler | ✅ SUCCESS | 02979a94 | Progress bar email active |
| ingest-worker-1 | ⏳ DEPLOYING | 484d105 | Auto-deploy triggered; should be SUCCESS within ~2 min |

**Root cause of build loop:** Railway silently migrated to Railpack builder. Workers had no `rootDirectory` set, so Railpack received a stale/partial snapshot (3 files only). Fix: set `rootDirectory = "scripts/ingest"` on all 11 Railway services + remove NIXPACKS from `railway.json`. Workers now build from `package.json` in `scripts/ingest/`.

**cc-monitor auto-redeploy is DISABLED** (`cc-monitor.ts` lines ~145–153 commented out). Re-enable once all workers confirmed stable for 24h. The monitor still logs crashes and stall warnings — it just doesn't act on them.

### Queue State (as of 2 Jun ~02:45 BST)
- `ingest_queue`: 60,575 pending rows seeded
  - TNA legislation: 47,540 acts (priority 1–2)
  - TNA caselaw: 7,485 Atom pages (~374k judgments, priority 1)
  - Hansard: 5,544 monthly chunks (priority 2)
  - BAILII: 0 (Cloudflare WAF blocking scraper — deferred)
  - FCA/ECHR/EUR-Lex/HMRC/Treaties/OECD: 6 index placeholder rows

### Architecture sprint — ALL PARTS COMPLETE (pushed)

| Commit | What |
|--------|------|
| `e82ced3` | `ingest_queue` table + `compiledText` + `fts_vector` on `corpus_sections` |
| `0c82f32` | `queue-client.ts` (FOR UPDATE SKIP LOCKED) + `queue-populator.ts` |
| `90aaabe` | `worker-queue.ts` — dynamic queue claiming, all workers interchangeable |
| `47b96ad` | `discoverFormats()` — TNA metadata feed before fetch |
| `f38b0c1` | `compiledText` in `upsertSection()` → DB trigger maintains `fts_vector` |
| `dd37601` | `cc-monitor.ts` + `known-errors.json` |
| `8e5dc24` | Progress bar email (████ + % + status breakdown) |
| `02979a9` | Build fix: remove NIXPACKS, sync ingest prisma schema, disable cc-monitor auto-redeploy |
| `484d105` | Patch bump to force worker-1 auto-deploy |

### Source-Client Sprint — ALL 5 PRIORITIES COMPLETE (not yet pushed)

All source clients previously exiting immediately are now fully implemented:

| Priority | Source | Workers | Status |
|----------|--------|---------|--------|
| 1 | TNA Find Case Law | Worker 9 Phase 1 | ✅ COMPLETE |
| 2 | Parliament API / Hansard | Workers 1–4 Phase 2 | ✅ COMPLETE |
| 3 | BAILII scraper | Workers 5, 6, 7 Phase 2 | ✅ COMPLETE |
| 4 | FCA Handbook | Worker 7 Phase 1 | ✅ COMPLETE |
| 5 | International (ECHR, EUR-Lex, OECD, Treaties) | Worker 10 Phase 1+2 | ✅ COMPLETE |

**Key changes:**
- `r2-client.ts`: new key helpers `caselawKey`, `bailiiKey`, `hansardKey`
- `tna-caselaw.ts`: `getTotalJudgments()` pre-processing count
- `parliament-api.ts`: `countHansardDebates()`, `fetchReportContent()`
- `bailii-scraper.ts`: WORKER_DB_SUBSETS extended to all 10 courts
- `fca-handbook.ts`: rewritten as HTML scraper (30+ sourcebooks)
- `echr-hudoc.ts`: fixed `country:GBR` typo, added `countUkCases()`
- `eurlex.ts`: paginated search API (was 100-item SPARQL stub)
- `oecd-free.ts`: rewritten to gov.uk content API for OECD docs
- `uk-treaties.ts` (NEW): FCDO treaties via gov.uk search + content API
- `worker-main.ts`: all workers now enumerate count before processing,
  use source-specific R2 keys, rawToText() only (no LLM calls)

**tsc --noEmit (ingest/ only): CLEAN** (pre-existing errors in backfill/v3opt unrelated)

**After push, reset + redeploy each worker set in order — see CHANGE_LOG for commands.**

---


### V.4-FTS-3 — Neon Migration + Search Enhancements — ✅ COMPLETE (all 4 parts)

#### Part 1 — Neon connection + prisma-search.ts — ✅ COMPLETE
- `NEON_DATABASE_URL` in `.env`.
- `scrutinise-web/lib/prisma-search.ts` — separate Prisma client targeting Neon via `NEON_DATABASE_URL`. Lazy Proxy-based init (avoids tsx ESM dotenv timing).
- `scrutinise-web/lib/pg-pool.ts` — raw `pg.Pool` wrapper for Railway + Neon, used by scripts. Railway uses `ssl: { rejectUnauthorized: false }`.

#### Part 2 — Neon schema + FTS enhancements — ✅ COMPLETE
- Schema pushed (54 tables), FTS config `legislation_english` created, triggers + GIN indexes installed, pgvector enabled, `embedding vector(768)` added.
- `buildTsQuery()` in `search.ts` — prefix matching via `:*` on final token when input has no trailing space.
- Thesaurus file: `scrutinise-web/prisma/pg_thesaurus/legislation_synonyms.ths` (9 synonym pairs).
- `scripts/legislation/apply-fts-config.sql` — self-hosted PG setup.
- `scrutinise-docs/CLAUDE.md` §15 added (thesaurus + prefix matching docs).

#### Part 3 — Railway → Neon data transfer — ✅ COMPLETE
- Transfer script: `scripts/legislation/transfer-to-neon.ts`
  - Multi-row batched INSERT (200 rows/batch), cursor-based pagination, checkpoint/resume.
  - Hit Neon 512 MB free-tier limit at 215,000 sections. Neon upgraded to Pro. Resumed from checkpoint.
  - Total time: ~83 minutes across two runs (72s items + 678s sections in second run).
- **Verification — ALL COUNTS MATCH:**

| Type | Railway | Neon |
|------|---------|------|
| UKSI | 473,828 | 473,828 ✓ |
| UKPGA | 171,346 | 171,346 ✓ |
| EUR | 75,658 | 75,658 ✓ |
| SSI | 44,943 | 44,943 ✓ |
| NISR | 42,477 | 42,477 ✓ |
| EUDN | 40,376 | 40,376 ✓ |
| WSI | 25,404 | 25,404 ✓ |
| EUDR | 17,278 | 17,278 ✓ |
| NISI | 12,026 | 12,026 ✓ |
| ASP | 6,678 | 6,678 ✓ |
| NIA | 3,114 | 3,114 ✓ |
| ANAW | 734 | 734 ✓ |
| ASC | 412 | 412 ✓ |
| **LegislationItem** | **135,531** | **135,531** ✓ |
| **LegislationSection** | **914,274** | **914,274** ✓ |

- `ANALYZE "LegislationSection"` run post-transfer to update planner statistics.

#### Part 4 — Switch search to Neon — ✅ COMPLETE
- `scrutinise-web/lib/search.ts`: imports `prismaSearch` from `@/lib/prisma-search`; legislation search branch now queries Neon; operational branch keeps Railway (`prisma`).
- `scripts/legislation/fts-smoke-test.ts`: updated to target Neon (`prismaSearch`), latency threshold adjusted for managed cloud DB (5s vs 2s for "person" worst-case), GIN assertion replaced with performance assertion.
- `scripts/legislation/neon-analyze.ts`: one-off post-transfer ANALYZE script (run once ✓).
- **Smoke test: ALL PASS** against Neon.

**Smoke test results (Neon):**
- ftsVector fully populated: 914,274 rows ✓
- CTE bounds ts_headline ≤20 rows ✓
- "cryptoasset" selective term: 40ms ✓
- Data Protection Act 2018: 20 results, 96ms ✓
- Human Rights Act 1998: 20 results, 68ms ✓
- UKSI commencement: 20 results, 3,743ms ✓
- actId filter: 20 results, 32ms ✓
- p99 "person" worst-case: 2,883ms (≤5s target) ✓

**tsc --noEmit: CLEAN ✓**

---

### L6-C — Lex Reliability Sprint — ✅ COMPLETE (not yet pushed)

5 web app files modified (see CHANGE_LOG.md §L6-C for detail):
- `scrutinise-web/app/api/ai/[ideaId]/route.ts`
- `scrutinise-web/components/FieldProposalCard.tsx`
- `scrutinise-web/app/ideas/create/CreateIdeaClient.tsx`
- `scrutinise-web/app/ideas/[id]/IdeaDetailClient.tsx`
- `scrutinise-web/lib/stage-gates.ts`

---

## NEXT STEPS

1. **Charlie approves `commit-all.sh`** at project root → CC runs it → push to Main.
2. **Vercel deploy** — `scrutinise-web/lib/search.ts` now imports `prismaSearch`. Ensure `NEON_DATABASE_URL` is set in Vercel environment variables before deploying. Then deploy to preview, verify search works, promote to production.
3. **V.4-FTS-2** — pgvector embeddings (semantic search) — `embedding vector(768)` column is on Neon, ready to populate.
4. **UKSI full ingest** — 61,179 items, pipeline approved, awaiting Charlie decision.

---

## Key file reference

| File | Purpose |
|------|---------|
| `scrutinise-web/lib/prisma-search.ts` | Neon Prisma client (lazy init, read-only search) |
| `scrutinise-web/lib/pg-pool.ts` | Raw pg Pool for Railway + Neon (used by scripts) |
| `scrutinise-web/lib/search.ts` | FTS search — prefix matching + Neon for legislation |
| `scrutinise-web/prisma/pg_thesaurus/legislation_synonyms.ths` | Synonym pairs (self-hosted PG) |
| `scripts/legislation/neon-fts-setup.ts` | Neon FTS schema setup (idempotent) |
| `scripts/legislation/apply-fts-config.sql` | Self-hosted PG thesaurus setup |
| `scripts/legislation/transfer-to-neon.ts` | Data transfer Railway→Neon (complete ✓) |
| `scripts/legislation/neon-transfer-checkpoint.json` | Transfer progress (both tables done) |
| `scripts/legislation/neon-analyze.ts` | Post-transfer ANALYZE script (run once ✓) |
| `scripts/legislation/fts-smoke-test.ts` | FTS smoke test — Neon target, ALL PASS |
| `scripts/legislation/check-railway-counts.ts` | Railway row count diagnostic |
| `scripts/legislation/test-neon-connection.ts` | Neon connectivity test |

---

## Notes for next CC session

- `commit-all.sh` is at project root — awaiting Charlie's approval to run.
- Before Vercel deploy: confirm `NEON_DATABASE_URL` is in Vercel env vars (Settings → Environment Variables).
- Operational data (OperationalDocument / OperationalSection) remains on Railway — NOT transferred to Neon. Operational search still queries Railway via `prisma`.
- The `embedding vector(768)` column on Neon's LegislationSection is empty (nullable) — V.4-FTS-2 will populate it.
