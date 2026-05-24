# Handover summary — V.3-C-2 CLOSED + V.3-D CLOSED + V.3-C HMRC pending + V.4-FTS-1 pending deploy

**Date:** 24 May 2026  
**Previous conversations:** V.3-C-2 operational codes (this session); V.3-D, V.3-C, V.3-B-opt, V.4-FTS-1 (earlier sessions)  
**Status:** V.3-C-2 CLOSED (operational codes scraper — Civil Service, GovS, Treasury, PACE, ACAS, ICO — all complete). V.3-D CLOSED (devolved corpus ingest). V.3-C HMRC scraper written, run pending. V.3-B-opt CLOSED (UKSI full ingest still pending). V.4-FTS-1 working-tree complete, not yet deployed to Vercel.

---

## CURRENT STATE

### V.3-C-2 — Operational Codes Scraper Sprint — CLOSED (24 May 2026)

**What was delivered this session:**

Implemented and ran scrapers for all priority operational code sources (Priority 1–6). All scripts follow the standard pattern: robots.txt check, 2s rate limit, exponential backoff, checkpoint/resume, `OperationalDocument` + `OperationalSection` DB writes, R2 under `operational/{publisher}/{slug}/`.

| Source Group | Script | Status |
|---|---|---|
| Civil Service core (Code, CSMC, Ministerial Code, Cabinet Manual) | `civil-service-ingest.ts` | 3/4 ✓ (CSMC 404 on gov.uk) |
| Government Functional Standards (GovS 001–015 + 3 companions) | `govs-ingest.ts` | 17/17 ✓ |
| HM Treasury appraisal guidance (5 docs) | `treasury-guidance-ingest.ts` | 5/5 ✓ |
| PACE Codes A–I (8 codes) | `pace-codes-ingest.ts` | 8/8 ✓ |
| ACAS codes + guides | `acas-ingest.ts` | 3/3 ✓ |
| ICO Codes (5 multi-chapter) | `ico-ingest.ts` | 5/5 ✓ |
| College of Policing APP | `college-of-policing-ingest.ts` | 0/1 ✗ WAF 403 |

**Permanent blocks / gaps:**
- **Civil Service Management Code**: HTTP 404 on all gov.uk URL variants — document appears archived/removed. Not found via search. Needs manual investigation.
- **College of Policing APP**: HTTP 403 from WAF on all `/app/*` and `/guidance/*` paths, all IPs, all user-agents including Googlebot and browser UA. robots.txt is permissive. DB record `college-of-policing-app` marked `FAILED`. Needs CoP partnership access or bulk data export.

**Key technical fixes this session:**
- `r2-client.ts`: `r2Put()` extended to accept `Buffer | Uint8Array` for PDF binary upload
- `pdf-parse v2.4.5`: class-based API (`PDFParse`) — CJS entry at `dist/pdf-parse/cjs/index.cjs`
- GovS 002: special-case fetches PDF from `projectdelivery.gov.uk` (robots.txt permissive, dynamic download link discovery)
- GovS 008: `HTML_OVERRIDES` map in `govs-ingest.ts` — landing page first link was wrong
- ICO: rewritten as multi-chapter crawler (v2) — previous hub-page captures (707w, 1,033w, 47w) overwritten
- ACAS: `extractMainContent` uses `<article>` first (`.body-wrapper` div is subscription widget, not content)
- Aqua Book URL: corrected from `/government/publications/...` (404) to `/guidance/the-aqua-book`

**Run commands for reference:**
```powershell
cd C:\Code\scrutinise-prototype\scrutinise-web

# Civil Service core
npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/operational/civil-service-ingest.ts

# GovS standards (all / single: --govs=002)
npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/operational/govs-ingest.ts

# HM Treasury
npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/operational/treasury-guidance-ingest.ts

# PACE Codes
npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/operational/pace-codes-ingest.ts

# ACAS
npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/operational/acas-ingest.ts

# ICO (all / single: --slug=ico-data-sharing-code)
npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/operational/ico-ingest.ts

# College of Policing (script ready, currently blocked)
npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/operational/college-of-policing-ingest.ts
```

---

### V.3-D — Devolved Corpus Ingest — CLOSED (24 May 2026)

**What was delivered this session:**

1. **Schema enum extension** — added NISR, NISI, NIA to `LegislationType` in `schema.prisma`. Pushed to Railway production. Prisma client regenerated.
2. **Pipeline generalised** — `worker.ts` now derives `legislationType`, `jurisdiction`, `tier` from `ManifestEntry` rather than UKSI hardcodes. `main.ts` accepts `--manifest <path>`. Fully backward-compatible (existing UKSI manifest has no `legislationType`/`jurisdiction` fields; defaults to `'UKSI'`/`'UK'`).
3. **Manifest interface extended** — `manifest.ts`: optional `legislationType?` and `jurisdiction?` on `ManifestEntry`.
4. **New manifest builder** — `scripts/legislation/v3opt/src/build-manifest-devolved.ts` — pure TypeScript, reads ZIP directly via adm-zip, applies revised-current-wins dedup, outputs two manifest files.
5. **Manifests built:**
   - `manifest-devolved-secondary.json` — 23,202 entries (SSI 8,680 · NISR 9,316 · WSI 4,648 · NISI 558). 900 made versions dropped where revised-current existed.
   - `manifest-devolved-primary.json` — 671 entries (ASP 395 · NIA 232 · ANAW 44).
6. **Full ingest run (production, no isolation):**

| Run | Items created | Sections | Errors | Elapsed | Throughput |
|---|---|---|---|---|---|
| Secondary full (SSI+NISR+WSI+NISI) | 23,097 | 124,406 | 0 | 3,247s | ~25,608/hr |
| Primary full (ASP+NIA+ANAW) | 671 | 10,526 | 0 | 148s | ~16,322/hr |

All production writes: `DATABASE_URL` → public schema, no R2_KEY_PREFIX.

**DB state by LegislationType (post-V.3-D):**

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
| **Total (legislation)** | **~23,871** | excl. HMRC |

**Tier assignment logic (deriveTier in worker.ts):**
- TIER_3 (secondary SI): UKSI, SSI, NISR, WSI, NISI
- TIER_1 (post-2010 primary UK Act): UKPGA
- TIER_2 (all other primary): ASP, NIA, ANAW, UKLA, NIER, etc.

---

### V.3-C — HMRC Full Ingest (scraper ready, run pending)

`scripts/operational/hmrc-full-ingest.ts` — full-corpus HMRC ingest covering **137 manuals** from `https://www.gov.uk/government/collections/hmrc-manuals`.

**Run command (from Charlie's terminal):**
```powershell
cd C:\Code\scrutinise-prototype\scrutinise-web
npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/operational/hmrc-full-ingest.ts
```

**Single-manual smoke test:**
```powershell
npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/operational/hmrc-full-ingest.ts --manual=compliance-handbook
```

**Resume from a specific manual:**
```powershell
npx tsx --tsconfig ../scripts/tsconfig.json ../scripts/operational/hmrc-full-ingest.ts --from=company-taxation-manual
```

**Note:** Use `tsx` (not `ts-node --transpile-only`). tsx applies tsconfig `paths` at runtime via esbuild so `@prisma/client` resolves correctly to `scrutinise-web/node_modules`. This matches the pattern used by CC-A for all other operational scripts.

**Estimated duration:** 20–30 hours. Checkpoint/resume handles drops.  
**Pre-run state:** Railway DB well under 4 GB. robots.txt passes.  
**Expected Railway growth:** ~50–80 MB. Expected R2 growth: ~2–3 GB.

---

### V.3-B-opt — CLOSED (23 May 2026)

Pure-TypeScript UKSI ingest pipeline. Full ingest (61,179 items) still pending Charlie's go/no-go.  
Pipeline approved. Pre-flight checklist in `v3opt_pilot_report.md`.

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

---

## Forward roadmap

| Sprint | Focus | Backend | Search |
|---|---|---|---|
| Next | UKSI full ingest + HMRC | 61,179 UKSI items (v3opt --full) + HMRC 137 manuals | — |
| +1 | V.4-FTS-1 deploy + V.4-FTS-2 | Vercel deploy | pgvector + Gemini embeddings |
| +2 | V.3-G | UKPGA/UKLA ingest | Hybrid FTS+vector with RRF |
| +3 | V.4-A | Lex cross-corpus analytical mode | — |

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
| Devolved manifest builder | `scripts/legislation/v3opt/src/build-manifest-devolved.ts` |
| Devolved secondary manifest | `scripts/legislation/v3opt/manifest-devolved-secondary.json` |
| Devolved primary manifest | `scripts/legislation/v3opt/manifest-devolved-primary.json` |
| UKSI manifest | `scripts/legislation/v3opt/manifest-uksi.json` (in v3b-uksi dir) |
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

- V.3-D is fully closed. No devolved ingest work remains unless UKPGA/UKLA is added.
- Devolved manifests are committed and can be re-run with `--resume` if needed.
- `deriveTier()` in `worker.ts` handles all known legislation types; extend the `secondary` set if any new SI types are added.
- The `--manifest <path>` flag on `main.ts` means any new corpus manifest can be ingested without code changes.
- Read Section 12 (git discipline) before any code work.
- Do NOT run `npm install` in `scripts/legislation/v3opt/` without checking existing dependency set.
