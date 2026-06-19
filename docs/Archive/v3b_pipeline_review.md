# V.3-B Pipeline Review — UKPGA-Specific Assumptions

*Status: Phase 1 complete — awaiting Charlie + CCh review before any code changes.*
*Author: CC, Sprint V.3-B, 2026-05-15*

---

## Purpose

This document identifies every UKPGA-specific assumption in the V2.76-B bulk ingest pipeline and
documents the changes required to reuse it for UKSI. One section per script; each assumption listed
with file and line reference; recommended change noted.

The review covers all scripts in `scripts/legislation/v276-bulk/` plus `scripts/legislation/r2-client.ts`.

---

## 0. Pre-review facts

From handoff_summary.md V2.76-A Phase 1 extended:

- UKSI in bulk: ALL 108,798 UKSI are in the Best Collection bulk ZIP.
- UKSI have Revised Current XML: only ~8% (vs ~36% of UKPGA). The remaining 92% have enacted-only XML.
- No Railway UKSI items exist yet — all 108,798 are NEW_TO_RAILWAY.
- R2 prefix decision (from CCh, 15 May 2026 session): flat prefixes. `uksi/{legislationGovUkId}/sections/{N}.original.xml` and `.tna.xml`, mirroring the UKPGA scheme exactly.
- `LegislationItem.legislationType` = UKSI (enum value confirmed in schema).
- `sourceType` defaults to STATUTE on LegislationItem and LegislationSection — correct for UKSI, no change needed.

---

## 1. build-manifest.ts

**Purpose:** Walks the extracted bulk ZIP directory and generates `manifest-ukpga.json` with per-act metadata.

**Note:** The manifest actually used by the pipeline (`manifest-ukpga.json`) has a slightly different structure
from what this script outputs — it records `zipPath` (path within ZIP, not extracted directory) and has
`version` as a top-level string, not `datasetType`. The actual manifest was likely hand-tuned after
build-manifest.ts ran. A new UKSI manifest generation run will need to match the live manifest schema.

| # | Line | Assumption | Recommended change |
|---|------|-----------|-------------------|
| 1 | 15 | `MANIFEST_OUT = 'manifest-ukpga.json'` — hard-coded output file | Parameterise: accept `--type=uksi` CLI flag, output `manifest-uksi.json` |
| 2 | 45, 85 | `filter(f => f.toLowerCase().includes('ukpga'))` — filters to UKPGA files only | Parameterise filter: `'uksi'` for UKSI run |
| 3 | 47–51 | `extractActId()` regex: `ukpga[\/\\-](\w+)[\/\\-](\d+)` — UKPGA prefix only | Generalise to `(ukpga\|uksi\|asp\|nia\|anaw\|ssi\|wsi)[\/\\-](\w+)[\/\\-](\d+)` and return `${type}/${year}/${num}` |
| 4 | 35–42 | `detectDatasetType()` checks filePath for `revised-current` / `enacted-epublished` strings | **This is correct logic.** Ensure the output `version` field matches live manifest schema (`"revised-current"`, `"enacted-epublished"`) — the field in the actual manifest is `version`, not `datasetType`. |

**Effort:** 30 minutes to fork as `build-manifest-uksi.ts` with parameterised prefix.

---

## 2. phase2-db-counts.ts

**Purpose:** Queries Railway section counts for all acts found in the bulk manifest that are also in Railway.

| # | Line | Assumption | Recommended change |
|---|------|-----------|-------------------|
| 5 | 26 | `fs.readFileSync('manifest-ukpga.json')` — hard-coded manifest | Change to `manifest-uksi.json` (or parameterise via CLI arg) |
| 6 | 29 | `fs.readFileSync('reconcile-results.json')` — UKPGA reconcile | For UKSI, a new UKSI reconcile will be needed (see §12 below). For the initial run, since all UKSI are NEW_TO_RAILWAY, `notInDbActIds` will be all 108,798 actIds and `inBothActIds` will be empty — so this script produces an empty output JSON, which is correct. |
| 7 | 90 | Output path `phase2-db-counts.json` — not type-namespaced | Change to `phase2-db-counts-uksi.json` to avoid overwriting UKPGA results |

**No structural changes needed.** The Railway query (line 39) uses `legislationGovUkId` — UKSI actIds (`uksi/…`) are distinct from UKPGA actIds (`ukpga/…`), so no collision risk.

**Effort:** 15 minutes (file name changes only).

---

## 3. phase2-bulk-p1groups.ps1

**Purpose:** Counts P1group elements per act in the bulk ZIP, outputting a count map for reconciliation.

| # | Line | Assumption | Recommended change |
|---|------|-----------|-------------------|
| 8 | 7 | `$manifestPath = 'manifest-ukpga.json'` | Change to `manifest-uksi.json` |
| 9 | 8 | `$dbCountsPath = 'phase2-db-counts.json'` | Change to `phase2-db-counts-uksi.json` |
| 10 | 10 | `$outPath = 'phase2-bulk-p1groups.json'` | Change to `phase2-bulk-p1groups-uksi.json` |
| 11 | 48–51 | `<P1group` count with `<P1\b` fallback — correct for primary legislation | **Verify for UKSI.** Simple statutory instruments (commencement orders, short SIs with a preamble and 1–3 articles) may have no `<P1group>` and use bare `<P1>` or no numbered provisions at all. The fallback is in place. Acts with count=0 should be expected and handled (do not treat as errors). |

**Effort:** 15 minutes (file name changes). The P1 fallback is already present.

---

## 4. phase2-categorise.ts

**Purpose:** Merges DB counts + bulk P1group counts to assign each act a category (SKIP / PATCH_GAPS / FULL_INGEST / COUNT_DIFF / NEW_TO_RAILWAY / PRINT_ONLY).

| # | Line | Assumption | Recommended change |
|---|------|-----------|-------------------|
| 12 | 46 | `'manifest-ukpga.json'` | Change to `manifest-uksi.json` |
| 13 | 47 | `'reconcile-results.json'` | Change to `reconcile-results-uksi.json` |
| 14 | 48 | `'phase2-db-counts.json'` | Change to `phase2-db-counts-uksi.json` |
| 15 | 49 | `'phase2-bulk-p1groups.json'` | Change to `phase2-bulk-p1groups-uksi.json` |
| 16 | 138–147 | PRINT_ONLY branch: marks items from `reconcile.inDbNotInBulkSample` | **Inapplicable for UKSI.** Since no UKSI items exist in Railway, there are no "in Railway but not in bulk" items. The PRINT_ONLY category will not appear in UKSI categorisation output. The branch can be left as dead code (will simply produce zero PRINT_ONLY entries) — no harm. |
| 17 | 52 | `reconcile.inDbNotInBulkSample` — used for PRINT_ONLY loop | As above — for UKSI this array will be empty. No crash, no harm. |
| 18 | 249 | Phase 3 plan comment: `NEW_TO_RAILWAY — requires schema decision` | For UKSI, NEW_TO_RAILWAY is the primary (and only) category — all 108,798 items. No schema decision is deferred; LegislationItem creation IS the work. |

**Key structural point:** For UKSI, the categorisation output will have zero SKIP, PATCH_GAPS, FULL_INGEST, PRINT_ONLY entries. Effectively 100% NEW_TO_RAILWAY (plus COUNT_DIFF for any version variance within the same actId). The pipeline's Phase 3 must be written to handle this — Phase 3A FULL_INGEST logic as written handles 0-section items that exist in Railway, but NOT items that don't exist at all.

**Effort:** 15 minutes (file name changes). No logic changes required — dead code is harmless.

---

## 5. phase3a-zip-helper.ps1

**Purpose:** Extracts P1group XML from a bulk ZIP entry, returning an array of `{ sectionNumber, xml }`.

| # | Line | Assumption | Recommended change |
|---|------|-----------|-------------------|
| 19 | 31 | `<P1group[^>]*>.*?</P1group>` — only extracts P1group elements | **Medium risk for UKSI.** Simple statutory instruments may use `<P1>` elements directly (not wrapped in `<P1group>`). If a UKSI has only `<P1>` tags with no `<P1group>`, the extractor returns empty — the act is silently skipped with `skipped++` in phase3a-patch-gaps.ts. For simple 1-3 regulation SIs, this means no sections are created. |
| 20 | 32 | `<Pnumber[^>]*>(.*?)</Pnumber>` — extracts provision number from within P1group | **Low risk.** `<Pnumber>` is the CLML standard tag for numbered provisions in both primary and secondary legislation. Works correctly for UKSI. |

**Recommended change:** Add a fallback extraction branch: if `$results.Count -eq 0` after P1group extraction, try matching `(?s)<P1\b[^>]*>.*?</P1>` and extract `<Pnumber>` from those. This mirrors the fallback in `phase2-bulk-p1groups.ps1`.

**Effort:** 30 minutes to add P1 fallback extraction block.

---

## 6. phase3a-patch-gaps.ts

**Purpose:** Handles FULL_INGEST (Companies Act 2006) and PATCH_GAPS for 316 acts.

This is the most significant script for UKSI work because the FULL_INGEST path is the template for creating sections, and the PATCH_GAPS path shows how to update existing sections. For UKSI, we need to extend the FULL_INGEST pattern to also create the LegislationItem row — which currently it does not do.

| # | Line | Assumption | Recommended change |
|---|------|-----------|-------------------|
| 21 | 24 | `MANIFEST_PATH = 'manifest-ukpga.json'` | Change to `manifest-uksi.json` |
| 22 | 25 | `PHASE2_PATH = 'phase2-results.json'` | Change to `phase2-results-uksi.json` |
| 23 | 23 | `PROGRESS_FILE = 'phase3a-progress.json'` | Change to `phase3a-progress-uksi.json` to avoid overwriting UKPGA progress |
| 24 | 89–93 | `processFullIngest` calls `prisma.legislationItem.findUnique` and throws if not found | **CRITICAL GAP.** For UKSI, no LegislationItem rows exist. The script must CREATE the LegislationItem row before creating sections. See §6A below for required fields. |
| 25 | 105 | `makeTnaKey(actId, sectionNumber)` — always writes to `.tna.xml` key | **Wrong for 92% of UKSI.** Must check manifest `version` field: `"revised-current"` → `tnaXmlKey`; `"enacted-epublished"` → `originalXmlKey`. |
| 26 | 209 | Reads FULL_INGEST and PATCH_GAPS acts from `phase2.acts` | For UKSI, the acts list will be NEW_TO_RAILWAY (not FULL_INGEST). The processing loop must add a NEW_TO_RAILWAY path that creates LegislationItem first, then processes sections. |

### §6A — LegislationItem required fields for UKSI creation

`LegislationItem` has 8 non-nullable fields without server defaults that must be provided:

| Field | Source for UKSI bulk ingest |
|-------|---------------------------|
| `legislationType` | Hard-code `LegislationType.UKSI` |
| `tier` | Hard-code `LegislationTier.TIER_3` |
| `title` | Extract from CLML `<Title>` element in bulk XML (first occurrence) |
| `year` | Parse from actId: `uksi/2021/100` → `2021`; for old SIs: `uksi/S.I._1970/1370` → year extraction will need regex |
| `number` | Parse from actId: final segment as integer |
| `jurisdiction` | Default `'UK'`; can be refined from CLML metadata in future pass |
| `legislationGovUkId` | The actId itself (e.g. `uksi/2021/100`) |
| `clmlUrl` | Derive: `https://www.legislation.gov.uk/${actId}/data.xml` |

Optional fields that are useful to populate on creation:
- `shortTitle`: same as `title` (for SIs, title is already the short form)
- `enactmentDate`: if CLML `<EnactmentDate>` present
- `sectionCount`: update after sections created

**Effort for §6 (full rewrite of processFullIngest + NEW_TO_RAILWAY path):** 4–6 hours. This is the core engineering work for V.3-B Phase 2.

---

## 7. phase3a-print-only.ts

**Purpose:** Marks LegislationItem rows as PRINT_ONLY when not found in bulk manifest.

| # | Line | Assumption | Recommended change |
|---|------|-----------|-------------------|
| 27 | 17 | `'manifest-ukpga.json'` | N/A |
| 28 | — | Entire premise: "Railway has items that bulk doesn't cover → mark PRINT_ONLY" | **Do not run for UKSI.** All 108,798 UKSI are in the Best Collection bulk ZIP (confirmed in V2.76-A Phase 1). There are no UKSI items in Railway yet, so there are no items to mark. Running this script against a UKSI manifest and Railway would have zero effect (correct but pointless). Running it against the UKPGA manifest after UKSI items exist in Railway would incorrectly ignore UKSI items (also harmless since UKSI actIds don't appear in `manifest-ukpga.json`). |

**Recommendation:** Leave as-is. Simply do not invoke this script during V.3-B.

**Effort:** 0.

---

## 8. phase3b-count-diff.ts

**Purpose:** Additive top-up for COUNT_DIFF acts — fills in missing sections without overwriting existing ones.

| # | Line | Assumption | Recommended change |
|---|------|-----------|-------------------|
| 29 | 28 | `MANIFEST_PATH = 'manifest-ukpga.json'` | Change to `manifest-uksi.json` |
| 30 | 29 | `PHASE2_PATH = 'phase2-results.json'` | Change to `phase2-results-uksi.json` |
| 31 | 27 | `PROGRESS_FILE = 'phase3b-progress.json'` | Change to `phase3b-progress-uksi.json` |
| 32 | 95–101 | `processCountDiff` calls `prisma.legislationItem.findUnique` and warns/returns if not found | For UKSI COUNT_DIFF acts, this is only reached after LegislationItem creation (Phase 3A), so the item will exist. **No structural change needed** — the warn+return on missing item is safe. |
| 33 | 129 | `makeTnaKey(actId, sectionNumber)` — always writes to `.tna.xml` | Same issue as §6, item 25. Must check manifest version and write to `originalXmlKey` vs `tnaXmlKey`. This is less critical for COUNT_DIFF (which runs after Phase 3A) but still should be consistent. |

**Effort:** 15 minutes (file name changes) + share the version-aware key helper from the phase3a fix.

---

## 9. phase4-verify.ts

**Purpose:** Post-ingest verification — corpus overview, key coverage, spot-checks, delta table.

| # | Line | Assumption | Recommended change |
|---|------|-----------|-------------------|
| 34 | 32 | `expected 9043` comment for PRINT_ONLY | Replace with UKSI expected value (0 — no UKSI should be PRINT_ONLY) |
| 35 | 42–43 | `preV276BNeither`, `preV276BWithTna` baseline constants | Replace with V.3-B UKSI pre-ingest baselines (0 for both, since no UKSI existed before) |
| 36 | 53, 62, 65 | `ukpga/2006/46` (Companies Act 2006) spot-check | Replace with a representative UKSI actId (e.g. `uksi/2021/819` — Health and Social Care Levy Regulations 2021, a complex SI) |
| 37 | 62 | `co2006SampleSections = ['1', '10', '100', '500', '1000', '1665']` | Replace with sections appropriate to the chosen UKSI (e.g. regulations 1 through 10) |
| 38 | 72–74 | PATCH_GAPS check acts: `ukpga/2015/21`, `ukpga/2000/6`, `ukpga/1900/12` | Remove or replace with UKSI equivalents. For UKSI there are no PATCH_GAPS acts (all NEW_TO_RAILWAY). Replace with a "sections created" check for 3 sample UKSI |
| 39 | 94–95 | Retry acts: `ukpga/1968/73` etc. | Remove — UKPGA-specific retry acts from Phase 3B |
| 40 | 146–154 | Delta table uses UKPGA pre-sprint baselines | Replace with UKSI baselines (pre-V.3-B: 0 UKSI items, 0 UKSI sections) |
| 41 | 14 | `PHASE2_PATH = 'phase2-results.json'` | Change to `phase2-results-uksi.json` |

**Recommended approach:** Fork as `phase4-verify-uksi.ts` rather than modifying the existing script. The UKPGA verification script should remain intact in case re-verification is needed.

**Effort:** 2–3 hours to write a clean UKSI verification script.

---

## 10. r2-client.ts

**No UKPGA-specific assumptions.** All key functions are type-agnostic:

- `tnaXmlKey('uksi/2021/100', '3')` → `uksi/2021/100/sections/3.tna.xml` ✓
- `originalXmlKey('uksi/2021/100', '3')` → `uksi/2021/100/sections/3.original.xml` ✓
- `effectsKey('uksi/2021/100')` → `uksi/2021/100/effects.xml` ✓

These match the flat-prefix scheme confirmed by CCh. **No changes needed.**

---

## 11. Reconcile step (not a named script — was done manually for UKPGA)

For UKPGA, `reconcile-results.json` was produced by comparing the Railway LegislationItem table against the bulk manifest. For UKSI, a new reconcile step is needed.

**For UKSI, the reconcile output is trivially predictable:**
- `notInDbActIds` = all 108,798 UKSI actIds (nothing is in Railway yet)
- `inDbNotInBulkSample` = empty (no UKSI in Railway to be absent from bulk)
- Summary: `inBulkNotInDb = 108,798`, `inDbNotInBulk = 0`

This means:
1. Phase 2 DB counts script produces empty output (no in-both acts).
2. Phase 2 categorise output is 100% NEW_TO_RAILWAY.
3. Phase 3 is entirely NEW_TO_RAILWAY creation — no PATCH_GAPS, no PRINT_ONLY.

A manual `reconcile-results-uksi.json` can be generated trivially by scanning the UKSI manifest and confirming zero Railway items. This is a 15-minute task.

---

## 12. Summary

### Total assumptions found: 41 (across 9 scripts)

**By script:**

| Script | Assumptions | Critical? |
|--------|-------------|-----------|
| build-manifest.ts | 4 | No — parameterisation only |
| phase2-db-counts.ts | 3 | No — file names only |
| phase2-bulk-p1groups.ps1 | 4 | No — file names only |
| phase2-categorise.ts | 7 | No — file names + dead PRINT_ONLY branch |
| phase3a-zip-helper.ps1 | 2 | Medium — P1 fallback needed for simple SIs |
| phase3a-patch-gaps.ts | 6 | **YES** — LegislationItem creation gap + wrong R2 key |
| phase3a-print-only.ts | 2 | No — do not run; no changes needed |
| phase3b-count-diff.ts | 5 | No — file names + shared key fix from phase3a |
| phase4-verify.ts | 8 | No — needs UKSI-specific fork |
| r2-client.ts | 0 | — |

### Changes required before data is touched

1. **[CRITICAL] New LegislationItem creation logic** in phase3a equivalent for UKSI.
   - Must extract `title`, `year`, `number` from bulk CLML and actId.
   - Must set `legislationType: UKSI`, `tier: TIER_3`, `jurisdiction: 'UK'`, `clmlUrl`.
   - Required fields confirmed from schema: `legislationType`, `tier`, `title`, `year`, `number`, `jurisdiction`, `legislationGovUkId`, `clmlUrl`.

2. **[CRITICAL] Version-aware R2 key selection** in phase3a and phase3b equivalents.
   - Check manifest `version` field: `"revised-current"` → `tnaXmlKey`; `"enacted-epublished"` → `originalXmlKey`.
   - For 92% of UKSI, bulk XML is enacted-only → `originalXmlKey`.

3. **[MEDIUM] P1 fallback in phase3a-zip-helper.ps1** for simple SIs with no P1group.

4. **[MINOR] File name parameterisation** across all scripts (15–30 minutes each).

5. **[MINOR] New phase4-verify-uksi.ts** with UKSI spot-check acts.

6. **[MINOR] Manual reconcile-results-uksi.json** (trivially all NEW_TO_RAILWAY).

### Estimated total effort

| Work item | Estimate |
|-----------|----------|
| File name parameterisation (all scripts) | 2 hours |
| `build-manifest-uksi.ts` fork | 30 min |
| `reconcile-results-uksi.json` manual creation | 15 min |
| `phase3a-zip-helper.ps1` P1 fallback | 30 min |
| LegislationItem creation in phase3a UKSI equivalent | 4–6 hours |
| Version-aware R2 key selection (shared helper) | 1 hour |
| `phase4-verify-uksi.ts` fork | 2–3 hours |
| **Total** | **~10–13 hours (~1.5 days)** |

### Concerns for Charlie + CCh review

1. **Volume.** 108,798 UKSI vs 12,009 UKPGA — 9× more LegislationItem creates + section creates. At 200ms between writes, Phase 3 will run for multiple sessions even with unattended PM2. Checkpoint/resume is already in place.

2. **UKSI with zero sections.** Some statutory instruments have no numbered provisions (commencement-only SIs, citation SIs, fee tables). These will have 0 P1group elements. Decision needed: skip them entirely (no Railway row created), or create a LegislationItem with `sectionCount: 0`? Recommendation: create the LegislationItem (for search discoverability) but skip section rows. Status = `PENDING`, `sectionCount: 0`.

3. **Regnal-year UKSI actIds.** The manifest may include old SI actIds with non-numeric years (e.g. `uksi/S.I._1970/...`). The `year` field is `Int` — non-numeric years will fail. Need year parsing that handles these edge cases.

4. **`clmlUrl` for UKSI.** The formula `https://www.legislation.gov.uk/${actId}/data.xml` should work. However, some UKSI at legislation.gov.uk are only available via the research site (`research.legislation.gov.uk`). The `clmlUrl` field for those items may be unreachable from the production app. Acceptable risk for V.3-B — the R2 copy is the live source, not `clmlUrl`.

5. **Title extraction.** CLML `<Title>` for UKSI returns the long SI title (e.g., "The Income Tax (Construction Industry Scheme) (Amendment) Regulations 2021"). This is the correct title to store. The regex in existing scripts (`xml.match(/<Title[^>]*>(.*?)<\/Title>/)`) should work. Verify on pilot sample.

---

*CC stopping here. No data touched. Awaiting Charlie + CCh review and approval before any script changes.*
