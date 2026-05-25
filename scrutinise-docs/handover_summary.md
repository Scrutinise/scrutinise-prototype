# Handover summary — V.3-E CLOSED + V.3-F CLOSED (Retained EU Law + ASC + Sentencing Council)

**Date:** 25 May 2026  
**Previous conversations:** V.3-E + V.3-F (this session); V.3-C-2, V.3-D, V.3-C, V.3-B-opt, V.4-FTS-1 (earlier sessions)  
**Status:** V.3-E CLOSED — 39,725 items, 133,724 sections, 0 errors. V.3-F CLOSED — Sentencing Council 274 docs, ~2.1M words, 0 errors.

---

## CURRENT STATE

### V.3-F — Sentencing Council Guidelines — CLOSED (25 May 2026)

274 active guidelines ingested from sentencingcouncil.org.uk. Three tiers: 253 offence-specific (loaded from `sc-guideline-list.json`), 10 overarching principles, 11 supplementary/explanatory material. `STATUTORY_GUIDANCE`. ~2.1M words, 0 errors, 12m 22s.

| File | Notes |
|---|---|
| `scripts/operational/sentencing-council-ingest.ts` | Full ingest script (754 lines). Run from `scrutinise-web/` with `npx tsx`. |
| `scripts/operational/sc-guideline-list.json` | 253-entry pre-extracted offence guideline manifest. |
| `scripts/operational/sc-checkpoint.json` | 274/274 completedSlugs — ingest is done. |

robots.txt: `Scrutinise/1.0` permitted under wildcard `Allow: /` (`ClaudeBot` blocked).  
R2 keys: `operational/sentencing-council/{slug}/{slug}.html` + `{slug}.text`  
Run: `cd scrutinise-web && npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/operational/sentencing-council-ingest.ts`

---

### V.3-E — Retained EU Law + ASC Ingest — CLOSED (25 May 2026)

**Sprint scope:**
- EUR (Retained EU Regulations): 24,488 items
- EUDN (Retained EU Decisions): 13,173 items  
- EUDR (Retained EU Directives): 2,035 items
- ASC (Acts of the Senedd Cymru): 29 items (32 raw — 3 enacted dropped where revised-current exists)

**Step 1 — Schema complete:**
- Added `EUDN`, `EUDR`, `ASC` to `LegislationType` enum in `schema.prisma`. (`EUR` already existed.)
- `npx prisma db push` → Railway production. Prisma client regenerated.

**Step 2 — XML structure check (GREEN):**
- EUR/EUDN/EUDR: `<EURetained>` container + `<EUBody>` (not `<Body>`). Parser is regex-based/container-agnostic — transparent.
- EUR: bare `<P1>` (no P1group) in ~80%; `<P1group>+<P1>` in ~20%. Parser P1group-first/P1-fallback handles both.
- EUDN: bare `<P1>` only. Parser fallback.
- EUDR: `<P1group>+<P1>`. Parser P1group extraction.
- ASC: `<Body>+<Part>+<P1group>+<P1>` — identical to ASP/NIA/ANAW (proven in V.3-D). No parser changes required.

**Step 3 — Manifests built:**

| Manifest | Items | revised-current | made |
|----------|-------|-----------------|------|
| manifest-eur.json | 24,488 | 24,488 | 0 |
| manifest-eudn.json | 13,173 | 13,172 | 1 |
| manifest-eudr.json | 2,035 | 2,035 | 0 |
| manifest-asc.json | 29 | 26 | 3 |

**Step 4 — Production ingest (bare DATABASE_URL, no R2_KEY_PREFIX):**

| Type | Items | Sections | Zero-section | R2 fail | Elapsed | Throughput |
|------|-------|----------|--------------|---------|---------|------------|
| ASC | 29 | 412 | 0 | 0 | 79s | ~1,322/hr |
| EUDR | 2,035 | 17,278 | 0 | 0 | 414s | ~17,696/hr |
| EUDN | 13,173 | 40,376 | 100 | 0 | 1,976s | ~23,999/hr |
| EUR | 24,488 | 75,658 | 2 | 0 | 3,520s | ~25,045/hr |
| **Total** | **39,725** | **133,724** | **102** | **0** | | |

*Zero-section (102): expected — fully revoked/repealed items with `<EUBody>` elision-only bodies and no parseable Pnumber. Not an error.*

---

### V.3-C-2 — Operational Codes Scraper Sprint — CLOSED (24 May 2026)

**What was delivered:** Scrapers for all priority operational code sources (Priority 1–6). All follow the standard pattern: robots.txt check, 2s rate limit, exponential backoff, checkpoint/resume, `OperationalDocument` + `OperationalSection` DB writes, R2 under `operational/{publisher}/{slug}/`.

| Source Group | Script | Status |
|---|---|---|
| Civil Service core (Code, CSMC, Ministerial Code, Cabinet Manual) | `civil-service-ingest.ts` | 3/4 ✓ (CSMC 404 on gov.uk) |
| Government Functional Standards (GovS 001–015 + 3 companions) | `govs-ingest.ts` | 17/17 ✓ |
| HM Treasury appraisal guidance (5 docs) | `treasury-guidance-ingest.ts` | 5/5 ✓ |
| PACE Codes A–I (8 codes) | `pace-codes-ingest.ts` | 8/8 ✓ |
| ACAS codes + guides | `acas-ingest.ts` | 3/3 ✓ |
| ICO Codes (5 multi-chapter) | `ico-ingest.ts` | 5/5 ✓ |
| College of Policing APP | `college-of-policing-ingest.ts` | 0/1 ✗ WAF 403 |

**Permanent blocks:**
- **Civil Service Management Code**: HTTP 404 on all gov.uk URL variants — archived/removed. Needs manual investigation.
- **College of Policing APP**: HTTP 403 WAF on all paths, all IPs. DB record marked FAILED. Needs CoP partnership access.

---

### V.3-D — Devolved Corpus Ingest — CLOSED (24 May 2026)

Full ingest run (production, no isolation):

| Run | Items | Sections | Errors | Elapsed | Throughput |
|---|---|---|---|---|---|
| Secondary (SSI+NISR+WSI+NISI) | 23,097 | 124,406 | 0 | 3,247s | ~25,608/hr |
| Primary (ASP+NIA+ANAW) | 671 | 10,526 | 0 | 148s | ~16,322/hr |

---

### V.3-C — HMRC Full Ingest (scraper ready, run pending)

`scripts/operational/hmrc-full-ingest.ts` — 137 manuals from gov.uk/government/collections/hmrc-manuals.

**Run command:**
```powershell
cd C:\Code\scrutinise-prototype\scrutinise-web
npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/operational/hmrc-full-ingest.ts
```

**Estimated duration:** 20–30 hours. Checkpoint/resume handles drops.

---

### V.3-B-opt — CLOSED (23 May 2026)

Pure-TypeScript UKSI ingest pipeline. Full ingest (61,179 items) still pending Charlie's go/no-go.

**Run command:**
```powershell
cd C:\Code\scrutinise-prototype\scripts\legislation\v3opt
npx ts-node --transpile-only src/main.ts --full
```

---

### V.4-FTS-1 — Full-text search (working-tree complete, Vercel deploy pending)

Working-tree changes in `scrutinise-web/`. DB migration ran against production Railway.  
**Smoke test:** `cd scrutinise-web && npx ts-node --project ..\scripts\tsconfig.json ..\scripts\legislation\fts-smoke-test.ts`

---

## What's NOT done

- **UKSI full ingest** — 61,179 items, pipeline approved, awaiting Charlie decision
- **HMRC full ingest** — script ready (`hmrc-full-ingest.ts`), run pending
- **V.4-FTS-1 Vercel deploy** — working-tree complete, smoke test not run
- **V.4-FTS-2** — pgvector + Gemini embeddings — brief not yet written
- **UKPGA/UKLA** — UK primary Acts not yet ingested
- **commit-all.sh** — ready at project root, 4 commits (V.3-E schema / V.3-E manifests / docs / V.3-F) — awaiting Charlie approval

---

## Forward roadmap

| Sprint | Focus | Backend | Search |
|---|---|---|---|
| Next | UKSI full ingest + HMRC | 61,179 UKSI items (v3opt --full) + HMRC 137 manuals | — |
| +1 | V.4-FTS-1 deploy + V.4-FTS-2 | Vercel deploy | pgvector + Gemini embeddings |
| +2 | V.3-G | UKPGA/UKLA ingest | Hybrid FTS+vector with RRF |
| +3 | V.4-A | Lex cross-corpus analytical mode | — |

---

## DB state by LegislationType (post-V.3-E)

| Type | Items | Notes |
|---|---|---|
| UKSI | ~998 | Pilot only — full ingest (61,179) still pending |
| SSI | ~8,680 | V.3-D — complete |
| NISR | ~9,316 | V.3-D — complete |
| WSI | ~4,648 | V.3-D — complete |
| NISI | ~558 | V.3-D — complete |
| ASP | 395 | V.3-D — complete |
| NIA | 232 | V.3-D — complete |
| ANAW | 44 | V.3-D — complete |
| ASC | 29 | V.3-E — complete |
| EUDR | 2,035 | V.3-E — complete |
| EUDN | 13,173 | V.3-E — complete |
| EUR | 24,488 | V.3-E — complete |
| **Total** | **~60,600** | excl. HMRC, excl. UKSI full run |

---

## Key reference paths

| Resource | Path |
|---|---|
| Project root | `C:/Code/scrutinise-prototype` |
| Web app | `scrutinise-web/` |
| v3opt ingest | `scripts/legislation/v3opt/` |
| HMRC ingest | `scripts/operational/hmrc-full-ingest.ts` |
| Docs | `scrutinise-docs/` |
| Schema | `scrutinise-web/prisma/schema.prisma` |
| EU/ASC manifest builder | `scripts/legislation/v3opt/src/build-manifest-eu-asc.ts` |
| Devolved manifest builder | `scripts/legislation/v3opt/src/build-manifest-devolved.ts` |
| EUR manifest | `scripts/legislation/v3opt/manifest-eur.json` |
| EUDN manifest | `scripts/legislation/v3opt/manifest-eudn.json` |
| EUDR manifest | `scripts/legislation/v3opt/manifest-eudr.json` |
| ASC manifest | `scripts/legislation/v3opt/manifest-asc.json` |
| R2 bucket | `scrutinise-legislation` |
| Railway project | `scrutinise-db` (Hobby tier) |

---

## Open questions for Charlie

- **UKSI full ingest timing** — go/no-go for 61,179 items? Pre-flight checklist in `v3opt_pilot_report.md`.
- **HMRC full ingest timing** — run now or wait until after UKSI? (Both use Railway DB; stagger by 30 min if simultaneous.)
- **V.4-FTS-2 brief** — Charlie to write before next CC session.
- **FTS minRank default** — currently 0.05. Review after smoke test.

---

## Notes for next CC session

- V.3-E: EUR ingest started 09:39 UTC 25 May. If EUR completed: check `handover_summary.md` was updated with final EUR stats. If EUR still running: use `--resume` flag.
- All four EU/ASC types use TIER_2; jurisdiction EUR/EUDN/EUDR=UK, ASC=Wales.
- The `build-manifest-eu-asc.ts` builder is in `scripts/legislation/v3opt/src/` and produces 4 separate manifest files. Re-run with `node dist/build-manifest-eu-asc.js` if manifests need regenerating.
- `deriveTier()` in `worker.ts` handles all new types via TIER_2 default — no code change needed.
- Read Section 12 (git discipline) before any code work.
- `commit-all.sh` is ready at project root — do NOT run until Charlie approves.
