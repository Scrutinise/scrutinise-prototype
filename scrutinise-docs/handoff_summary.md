# SCRUTINISE — CONVERSATION HANDOFF SUMMARY

*Last updated: 15 May 2026 v48*

***

## CURRENT STATE — V.3-B IN PROGRESS | Phase 2 (pilot) COMPLETE ✓ | Awaiting Phase 3 approval

**This section supersedes everything below. Sections below are preserved as historical context.**

### What is happening right now

Sprint V.3-B (UKSI Bulk Ingest) is in progress. Phase 1 (pipeline review) ✓, Phase 1.5 (pre-flight) ✓, Phase 2 (100-UKSI pilot + verification) ✓.

**Phase 3 (full 61,179-item ingest) requires explicit Charlie + CCh approval before CC runs `--full` mode.**

### V.3-B Phase 2 pilot results (15 May 2026)

**Pilot outcome:**

| Metric | Count |
|--------|-------|
| LegislationItem rows created | 100 |
| LegislationSection rows created | 1,041 |
| R2 objects written | 1,041 |
| → tnaXmlKey (revised-current) | 393 |
| → originalXmlKey (made/enacted) | 648 |
| Zero-section items | 0 |
| Errors (final state) | 0 |

**Verification results:**

| Check | Result |
|-------|--------|
| Railway integrity (type, tier, jurisdiction, yearRaw, sectionCount, UKPGA baseline) | **PASS** ✓ |
| R2 spot-check (30 sections: 15 RC + 15 made) | **PASS** ✓ 30/30 |
| Web cross-check (10 UKSI vs TNA) | 1/10 exact, advisory — see pilot report |
| Title decoding (10 sample titles) | **PASS** ✓ |

**Bugs found and fixed:**
1. Duplicate `<Pnumber>` in 18 CLML files → unique constraint error → fixed with `seenSectionNumbers` Set
2. `sectionCount` set to pre-dedup count → fixed to `seenSectionNumbers.size`; 18 Railway rows reconciled
3. Verify script R2 band used array position → fixed to use manifest versionMap
4. Verify script web check used wrong CSS class → fixed to `Leg(Article|Rule|...)No` pattern

**Phase 3 estimate:** ~3.5 hours, ~637,000 sections, ~620,000 R2 writes. No schema changes needed.

### V.3-B Phase 1.5 results (15 May 2026)

**Schema shipped:**
- `yearRaw String?` added to `LegislationItem` — nullable, backfilled for all UKSI rows during ingest
- `prisma db push` + `prisma generate` complete; Railway confirmed

**Key manifest findings (`scripts/legislation/v3b-uksi/manifest-uksi.json`):**

| Finding | Value | Impact |
|---------|-------|--------|
| UKSI with XML in bulk ZIP | **61,179** | Phase 3 will process this count, not 108,798 |
| Revised-current | **8,796** (14.4%) | → `tnaXmlKey` |
| Made / enacted | **52,383** (85.6%) | → `originalXmlKey` |
| PDF-only (not in ZIP) | **~47,619** (43.8%) | Deferred to V.3-H — no in-ZIP flag |
| Year formats | **All integers** (1948–2026) | `yearRaw` = string integer, no complex parsing |
| Zero-section SIs in ZIP | **~0** (0/300 sampled) | Defensive code only; rarely triggers |

### V.3-B files produced (Phase 1.5 + Phase 2)

- `scripts/legislation/v3b-uksi/build-manifest-uksi.ps1` — ZIP enumerator
- `scripts/legislation/v3b-uksi/build-manifest-uksi.ts` — TypeScript wrapper
- `scripts/legislation/v3b-uksi/manifest-uksi.json` — generated manifest (gitignored, 61,179 entries)
- `scripts/legislation/v3b-uksi/zip-helper-uksi.ps1` — CLML extractor (title + P1group/P1 fallback)
- `scripts/legislation/v3b-uksi/key-helper.ts` — version-aware R2 key selection
- `scripts/legislation/v3b-uksi/phase3-uksi-ingest.ts` — main ingest (pilot + full modes)
- `scripts/legislation/v3b-uksi/phase4-verify-uksi.ts` — 4-check verifier (with pre-flight reconciliation)
- `scripts/legislation/v3b-uksi/cleanup-errors.ts` — one-off cleanup (served its purpose; delete before commit)
- `scrutinise-docs/v3b_pipeline_review.md` — Phase 1 pipeline review
- `scrutinise-docs/v3b_uksi_manifest_findings.md` — Phase 1.5 findings
- `scrutinise-docs/v3b_pilot_report.md` — Phase 2 pilot report ← READ FOR FULL DETAIL

**Next action:** Charlie + CCh approve Phase 3 (`--full` mode). CC runs `phase3-uksi-ingest.ts --full`.
After Phase 3, CC runs verify, updates handoff, writes commit-all.sh.

---

---

## HISTORICAL — V.3-A COMPLETE ✓ (15 May 2026)

**Railway DB size after V.3-A: still 250 MB (0.244 GB)** — R2 stores all HTML and text; only 1 000-char FTS excerpts in Railway. Well clear of 4.5 GB alert threshold.

### V.3-A results

| Manual | Pages ingested | Status | R2 prefix |
|---|---|---|---|
| Employment Income Manual | 42 | COMPLETE | `operational/hmrc/employment-income-manual/` |
| Capital Gains Manual | 17 | COMPLETE | `operational/hmrc/capital-gains-manual/` |
| Compliance Handbook | 31 | COMPLETE | `operational/hmrc/compliance-handbook/` |
| **Total** | **90** | | |

All 90 `OperationalSection` rows carry `sourceType = ADMINISTRATIVE_GUIDANCE`. `OperationalDocument` rows marked `COMPLETE`.

**Known limitation in pilot:** `pageTitle` on individual sections shows the manual-level title (e.g. "Employment Income Manual") rather than the section-level heading. gov.uk pages have the specific section heading in a `<h2>` element — refinement needed in V.3-B. Does not affect R2 storage or FTS.

**Note on page counts:** These are top-level index-linked pages only. EIM has ~3,000 total pages — full ingest will need recursive link following. Pilot confirms the pipeline works.

### Schema changes shipped in V.3-A

- `DocumentSourceType` enum (7 values: STATUTE, STATUTORY_GUIDANCE, ADMINISTRATIVE_GUIDANCE, EXPLANATORY, PARLIAMENTARY, JUDICIAL, FINANCIAL_DOCUMENT)
- `OperationalIngestStatus` enum (PENDING, IN_PROGRESS, COMPLETE, FAILED)
- `LegislationItem.sourceType: DocumentSourceType @default(STATUTE)` — added
- `LegislationSection.sourceType: DocumentSourceType @default(STATUTE)` — added
- `OperationalDocument` model — new (Section 15 of schema)
- `OperationalSection` model — new (Section 15 of schema)
- All pushed to Railway via `prisma db push`

**Naming decision — `DocumentSourceType` vs `sourceType`:** Enum named `DocumentSourceType` (not `SourceType`) to avoid collision with the existing `SourceType` enum used by `Research` and `Evidence` models. Field on all models is `sourceType`. Field name describes the column; enum name describes the type it draws from. This is the permanent name — do not rename without updating all four model definitions.

### New scripts produced in V.3-A

- `scripts/operational/hmrc-ingest.ts` — HMRC manual scraper (rate-limited, checkpoint/resume, R2 + Railway)
- `scripts/operational/phase-b-verify.ts` — verification query (Railway counts + sample rows)
- `scripts/legislation/phase-a-verify.ts` — schema verification (temp, not committed)

### New docs produced in V.3-A

- `scrutinise-docs/operational_corpus_framework_v1.md` — canonical model, scraper interface, rate-limiting policy, provenance flags, update strategy, known limitations, next-source priority list

### Other pending manual steps (carried from v45)

- `npx prisma db push` on Railway for Feedback table (V2-SUPPORT-TAB — schema pushed locally but Railway needs manual run)
- A4 acceptance test for V2-LEX-FLOW: walk through fresh Stage 1 idea to verify all 3 Lex field-sequence bugs are fixed

### Next sprint options

- **V.3-B** — Operational Corpus expansion: FCA Handbook (`STATUTORY_GUIDANCE`) using their structured API; full EIM ingest (recursive link following); page title refinement
- **V2.76-C** — Legislative Corpus: Explanatory Notes ingest (fetch `/notes.xml` per act, 1988+ primary legislation)
- **NEW_TO_RAILWAY** — 1,657 regnal-era + 2026 acts in bulk not yet in Railway (schema decision needed)
- **Product work** — any of the V2-support-tab or V2-lex-flow acceptance tests

### Sprints since V2.75-I (all committed and pushed)

| Sprint | Commit | What shipped |
|--------|--------|------|
| V2-HOMEPAGE-RESTRUCTURE | 05836df | Copy restructure, block reorder |
| V2-HOMEPAGE-RESTRUCTURE-2 | 5c6576b | Hero width, Five Steps title, copy edit |
| V2-HOMEPAGE-RESTRUCTURE-3 | d685b93 | Networking paragraph, MPs copy, bullet alignment |
| V2-SUPPORT-TAB | 196387f | Training→Support tab; FAQs; Feedback; How does this work? button fix |
| V2-LEX-FLOW-AND-LEGPANEL | fd3993e | Lex field-sequence guard (A1/A2/A3); LegislationPanel pulse/trigger fixes (B); Legislation nav gated to admin |
| V2.76-A homepage | f1404be | Not-for-profit non-partisan hero copy; Who is it for? bullet indent |
| V2.76-A Phase 1 (extended) | ff8961f | Bulk data inventory Sections 1–13 + 14–17 (EN, InForce, coverage, UKSI); corpus categorisation in handoff |
| V2.76-B Phase 1–4 | 555ff96 | Bulk ZIP download + verification; manifest; reconciliation; FULL_INGEST Companies Act 2006; PATCH_GAPS 316 acts; PRINT_ONLY 9,043 acts |
| V2.76-B Phase 3B + verification | (this commit) | COUNT_DIFF additive top-up (1,146 acts); Phase 4 verification; NEITHER-key 21,850→7,208 |

### V2.76-A Phase 1 key findings (original + extended)

- Site: `research.legislation.gov.uk` — HTTP Basic Auth (`research` / `n3w_s!te`)
- Best Collection XML: 1.32 GB (best available version of all 350,557 documents), updated daily
- Amendment bulk XML: same schema as TNA Changes API, per-type per-year ZIPs — but **6 months stale** (Oct 2025 latest)
- **Companies Act 2006:** `Revised Current English: Yes` in bulk — resolves HTTP 202 issue from per-section ingest
- **Explanatory Notes:** NOT in bulk. Separate document at `/{type}/{year}/{num}/notes/data.xml`. Root element `<EN>` with `en.xsd` schema. Public endpoint (no auth). Scope: 1988+ primary legislation. Must be fetched per-act. Target: Phase 3 ingest pass.
- **InForce Dataset granularity:** Act-level only for modern UKPGA (Equality Act 2010 = 1 row). Section-level only for ancient AEP surviving provisions. Jurisdiction-specific repeal codes exist (`repealedEWBy`, `NIUnknownStatus` etc.) but only for repeal end-state — NOT for partial commencement. No commencement order cross-references. `Prosp` status correctly flags 5 acts with Royal Assent but no commencement order yet. **For NI partial-enactment: use Effects XML** (`InForceDates` + `AffectingEffectsExtent` in amendments data), not InForce Dataset.
- **Historical coverage:** 7,634 of 12,020 UKPGA (64%) are print/PDF-only — no XML, not solved by bulk download. 4,386 (36%) have machine-readable XML. By era: 1988+ = 100%, 1901–87 = 38%, 1800s = 16%, pre-1800 = AEP type not UKPGA. The bulk download solves the 202-failing modern acts (Companies Act 2006 class) but does NOT solve the historical print-only problem. 7,634 should be marked permanently excluded from XML ingest.
- **UKSI in bulk:** ALL 108,798 UKSI are in Best Collection. Per-type sub-downloads confirmed 404 (monolithic ZIP only). Devolved: NIA 95%, ASP 99%, ANAW 100% Revised Current. UKSI only 8% (SIs are superseded not revised — normal). No Explanatory Notes equivalent for secondary legislation.
- Full details: `scrutinise-docs/V2.76_bulk_data_inventory.md`

### V2.76-B — fully complete (15 May 2026)

**Railway state — final post-V2.76-B (Phase 3A + 3B + verification):**

| Metric | Pre-V2.76-B | Post-V2.76-B |
|--------|-------------|--------------|
| LegislationItem total | 11,768 | **11,768** |
| Items with section data | 4,340 | **4,341** (+1 Companies Act 2006) |
| Total LegislationSection rows | 168,970 | **171,346** (+2,376) |
| tnaXmlKey sections | 29,164 | **162,785** (+133,621) |
| NEITHER-key sections | 21,850 | **7,208** (−14,642, −67%) |
| PRINT_ONLY items | 0 | **9,043** |
| tnaXmlKey coverage | ~17% | **95.8%** |

**What was done (Phase 3A):**
- Bulk archive (1.32 GB, MD5: F9BEE248B5235CDA06C9373EBA6DD587) downloaded and verified
- Manifest: 4,407 UKPGA acts indexed from ZIP
- Cross-check: 2,750 in bulk+Railway; 1,657 NEW_TO_RAILWAY; 9,043 PRINT_ONLY
- Companies Act 2006: 1,665 sections created in Railway, all R2 `.tna.xml` keys written
- PATCH_GAPS (316 acts): 1,077 neither-key sections patched; 639 unmatched (likely repealed)
- PRINT_ONLY: 9,043 LegislationItem rows marked `compilationStatus = PRINT_ONLY`
- Schema: `CompilationStatus.PRINT_ONLY` added to enum + pushed to Railway

**What was done (Phase 3B — COUNT_DIFF additive top-up):**
- 1,146 COUNT_DIFF acts processed (bulk had more P1groups than Railway sections)
- Approach: additive only — never overwrote existing `tnaXmlKey`
- 15,034 Railway row updates (missing tnaXmlKey added); 587 new Railway rows created; 121,040 already-keyed skipped
- 15,621 R2 writes total
- 4 acts retried after duplicate-P1group bug fix (`ukpga/1968/73`, `1974/37`, `1988/33`, `1992/19`) — all clean on retry
- `created=0` for nearly all acts confirms bulk is a near-perfect superset of Railway section numbering

**Phase 4 verification (15 May 2026):**
- PRINT_ONLY: 9,043 ✓
- Companies Act 2006: 1,665 sections ✓; R2 s.1–s.1000 all OK
- NEITHER-key: 7,208 residual — sections absent from TNA revised current bulk (repealed/removed); irreducible
- 20-act spot-check: 13/20 fully keyed; 7/20 partial (residual neither-key sections confirmed to be repealed provisions)

**Still deferred:**
- NEW_TO_RAILWAY: 1,657 acts in bulk but not in Railway (regnal-era + 6 × 2026 acts) — requires schema decision
- NEITHER-key residual: 7,208 sections — not fixable from revised bulk; would need enacted/historical source

**Scripts in `scripts/legislation/v276-bulk/`:**
- `phase2-db-counts.ts`, `phase2-bulk-p1groups.ps1`, `phase2-categorise.ts` — Phase 2 reconciliation
- `phase3a-zip-helper.ps1`, `phase3a-patch-gaps.ts`, `phase3a-print-only.ts` — Phase 3A ingest
- `phase3b-count-diff.ts` — Phase 3B COUNT_DIFF additive top-up
- `phase4-verify.ts` — full verification (covers Phase 3A + 3B)
- `sample-comparison.md` — Phase 2 report (human-readable)
- `manifest-ukpga.json`, `reconcile-results.json` — reference data (committed)
- `best-collection-xml.zip` — gitignored (1.32 GB); re-downloadable via `research.legislation.gov.uk`

### Other pending manual steps

- `npx prisma db push` on Railway for Feedback table (V2-SUPPORT-TAB — schema was pushed locally but Railway needs manual run)
- A4 acceptance test for V2-LEX-FLOW: walk through fresh Stage 1 idea to verify all 3 Lex field-sequence bugs are fixed

---

## HISTORICAL — SPRINT V2.75-I COMPLETE ✓ (30 April 2026)

**This section supersedes everything below. The V2L commit summary that follows is preserved as historical context but does not reflect current working state.**

### What happened in V2.75

Charlie left for 4 days on 26 April 2026. V2.75 was an architectural reset triggered by three failures discovered after V2L's full-corpus ingest had been running for \~24 hours.

**The three failures (24 April 2026):**

1.  **TNA gold standard corrupted.** `fetchTnaCompiledText()` strips XML tags from the full TNA response without scoping to the target P1group node first, so editorial content from other Acts contaminates the stored compiled text. Visible at `/legislation-compare`: "40B Employment Rights Act 2025" appearing inside Equality Act 2010 s.11. AI Jaccard scores 0–1.4% as a result.
2.  **Compile worker idling against false signal.** Sections stuck in `COMPILING` status after a crash are invisible to the `PENDING`-only query, so the compile loop reports "8908 COMPILED, 0 PENDING" despite \~10,875 sections being in `FAILED` state.
3.  **Ingest crashed at act 1,891.** Administration of Justice Act 1982 (ukpga/1982/54). Prisma P1017 — Railway closed an idle connection during a long TNA fetch throttle wait. No connection-pool retry config existed.

### Architectural discovery (V2.75-F audit, 25 April 2026)

**The** `.xml` **files in R2 are NOT original-as-enacted.** They are P1group sub-extracts from TNA's current-version full-act CLML — already-compiled by TNA, with all amendment markup stripped before we saw it. **Zero** `<Addition>`**/**`<Substitution>`**/**`<Repeal>` **tags exist in any of the 40,635 stored XML files.** Cannot build a deterministic compiler from this data.

The 5,507 AI-compiled `.compiled.txt` files are tag-stripped prose of TNA's already-compiled text with zero amendments fed in (Amendment table has zero rows, was never populated). They are noise — neither compilations nor summaries nor true Layer 6.

The legislation-compare page was structurally incapable of scoring 100% — comparing TNA-current text against an AI re-compile of the same TNA-current text.

### V2.75 sprints completed

| Sprint     | Date   | Outcome                                                                                                                                                                                                                                                                                                                                                                                                               |
|------------|--------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| V2.75-A    | 24 Apr | `withPrismaRetry()` helper added (handles P1017/P1001, 3 retries × 5s). Top-level try/catch per act with `failCount`. AdaptiveThrottle confirmed in place. tsc clean.                                                                                                                                                                                                                                                 |
| V2.75-B/F  | 25 Apr | Architecture audit produced (V2.75_architecture_audit.md). AI output samples (V2.75_ai_output_samples.md). Diagnostic report (V2.75_diagnostic_report.md).                                                                                                                                                                                                                                                            |
| V2.75-C    | 25 Apr | Fixed `fetchTnaCompiledText()` to scope to `<P1group>` with attributes (regex `/<P1group[^>]*>([\s\S]*?)<\/P1group>/g`). Tests passed for Equality Act sections; Companies Act 2006 returns HTTP 202 (AWS WAF challenge / on-demand generation).                                                                                                                                                                      |
| V2.75-D    | 25 Apr | DB state confirmed: COMPILED 26,365; FAILED 10,875; PENDING 3,395; COMPILING 0. Stale-reclaim added to compile.ts (10-minute threshold).                                                                                                                                                                                                                                                                              |
| V2.75-G    | 25 Apr | Confirmed 1,142 `.summary.txt` files are genuine plain-English Layer 6 summaries (Lex output). Only AI-compiled sections received summaries.                                                                                                                                                                                                                                                                          |
| V2.75-H1   | 25 Apr | Phase 1 of hard-reset brief: `/enacted/data.xml` URL pattern verified. HTTP 200 for Equality Act 2010 s.11 and Theft Act 1968 s.1. Confirmed: TNA does NOT use inline `<Addition>`/`<Substitution>`/`<Repeal>` markup anywhere — it uses `<CommentaryRef>` + `<Commentary>` footnote pairs (human prose). Companies Act 2006 s.172 returns HTTP 202 for both enacted and current endpoints.                           |
| V2.75-H1.5 | 25 Apr | Bulk download alpha site (`leggovuk.s3-website-eu-west-1.amazonaws.com`) confirmed decommissioned (403 every path). `research.legislation.gov.uk` confirmed invite-only HTTP Basic Auth beta — `WWW-Authenticate: Basic realm="By Invitation Only"` on homepage itself. TNA bulk download PDF documents dataset structure. Verdict: bulk requires credentials. **Charlie approved option 3: proceed with per-section API ingest.** Phase 2 issued. |
| V2.75-H2   | 25 Apr | Phase 2 complete — three-layer ingest implemented and tsc clean. Schema: `LegislationSection.rawXmlKey` → `originalXmlKey` + `tnaXmlKey`; `LegislationItem.effectsKey` + `effectsFetchedAt` added. `r2-client.ts` + `lib/r2.ts`: new key helpers (`originalXmlKey`, `tnaXmlKey`, `effectsKey`). `ingest.ts` full rewrite: `fetchSectionXml()` fetches enacted + current per section, `fetchEffectsFeed()` paginates TNA Changes feed, `withPrismaRetry()` on all DB calls, checkpoint auto-migrated to `ingest-checkpoint.v2L.json`. `compile.ts`: `rawXmlKey` → `originalXmlKey`. Both tsc checks clean. |
| V2.75-H3   | 26 Apr | Phase 3 complete — R2 partial wipe. 65,255 objects deleted (40,635 `.xml` + 24,620 `.compiled.txt`). 1,142 `.summary.txt` files preserved. `wipe-r2-partial.ts` script produced. `prisma db push --accept-data-loss` applied to Railway. |
| V2.75-H4   | 26 Apr | Phase 4 complete — 5-act verification. VERDICT: PARTIAL (4/5). Equality Act 2010: 239 sections, 500 effects ✓. Theft Act 1968: 40 sections, 71 effects ✓. Income Tax Act 2007: 1776 sections, 500 effects ✓. Finance Act 2024: 269 sections, 93 effects ✓. Companies Act 2006: 0 sections — TNA returns 202 for full-act CLML (expected, handled gracefully) ✗. 7 bugs discovered and fixed in ingest.ts during Phase 4 (dotenv path, ECONNREFUSED retry, P1group regex, Pnumber tag-strip, 202 handling, fetch timeout, pnum mismatch). New scripts: `wipe-r2-partial.ts`, `test-ingest-5.ts`, `clear-test-acts.ts`. Full verification report: `V2.75_phase4_verification.md`. |
| V2.75-H5   | 26 Apr | Phase 5 complete — PM2 unattended runner configured and dry-run verified. `ecosystem.config.js` at project root. PM2 6.0.14 installed globally. Dry run confirmed: feed fetched (600 pages, 12,009 acts total in UKPGA corpus), section writes to R2 (`✓ s.N enacted → R2`, `✓ s.N current → R2`) observed, effects feed fetched. `MAX_PAGES` raised 10→200 (Equality Act + Income Tax Act hit cap at 500 entries). `scripts/tsconfig.json` dotenv path added. **READY TO LAUNCH** — awaiting Charlie's go. |
| V2.75-I    | 30 Apr | Resilient resume complete. Root cause identified: PM2 `autorestart: true` restarted on clean exit code 0; main loop iterated all 12,009 acts with 500ms delay each (100 min/restart) even when corpus was complete. Full corpus ingested Apr 29 03:59. Three fixes: (1) `stop_exit_codes: [0]` in `ecosystem.config.js` prevents restart on clean exit; (2) main loop now iterates `remaining` only (not `acts`) — skips 500ms delay for done acts; (3) if `remaining.length === 0`, process logs "Corpus complete" and exits immediately. Also added: checkpoint format upgrade (`permanentlySkipped`, `attemptCounts`), attempt tracking (≥3 failures → permanent skip + crash log), crash exit code (`process.exit(1)` on unhandled errors so PM2 restarts on real crashes). tsc clean. 3-act test passed. PM2 restarted with new config — 241 remaining acts being processed. |

### Critical architectural breakthrough — TNA Effects API

Per TNA's official data-documentation (`https://legislation.github.io/data-documentation/model/effects.html`), the **Changes to Legislation database** is exposed as a structured API:

```
https://www.legislation.gov.uk/changes/affected/{actId}/data.feed
```

Each effect record contains: EffectType (substituted, inserted, repealed, applied, modified), AffectingProvisions, AffectedProvisions, Savings, in-force dates, commencement authority, geographical extent, applied/requires-applied status. Repeals, commencements, and non-textual amendments are deterministically applicable from this data alone. Substitutions and insertions need additional parsing of the affecting provision's prose to extract the literal text change ("In subsection (X) for 'old' substitute 'new'"), but Parliamentary draftsmen use a constrained vocabulary that makes this tractable.

**Coverage:** `to-ukpga` from 1994 onwards, `to-uksi` from 1972 onwards, NI types from 2006, UKLA from 2013. Sufficient for the entire modern statutory tax corpus and most practical use.

This means the original product vision (deterministic compilation with verifiable Jaccard \~100% against TNA gold standard) is achievable, just with a more sophisticated compiler than "find and replace." Build-time estimate: a week of focused engineering post-trip.

### V2.75-H plan — three-layer per-section ingest with effects feed

R2 key scheme:

```
{actId}/sections/{N}.original.xml — enacted CLML from /{actId}/section/{N}/enacted/data.xml
{actId}/sections/{N}.tna.xml      — current revised CLML from /{actId}/section/{N}/data.xml
{actId}/effects.xml               — structured effects from /changes/affected/{actId}/data.feed
```

Schema additions to `LegislationItem`:

-   `effectsKey: String?` — R2 key for the act's effects.xml
-   `effectsFetchedAt: DateTime?`

No schema changes to `LegislationSection`.

**Ingest order per act:**

1.  Fetch section list / metadata as today
2.  For each section: fetch `.original.xml` then `.tna.xml`
3.  After all sections done: fetch `/changes/affected/{actId}/data.feed`, follow pagination if needed, store as `effects.xml`
4.  Update `LegislationItem` with `effectsKey` and `effectsFetchedAt`

**Per-act effects fetch is fast:** \~12,000 acts × \~200ms = \~40 minutes total, trivial relative to the \~4-day per-section run.

### Current state of R2 and Railway (as of 30 April 2026, post V2.75-I)

| Store                              | Content                                                                    | Status                                      |
|------------------------------------|----------------------------------------------------------------------------|---------------------------------------------|
| R2 (scrutinise-legislation bucket) | 267,963 objects: 117,957 `.original.xml`, 145,274 `.tna.xml`, 3,590 `effects.xml`, 1,142 `.summary.txt` | **Full corpus V2.75-H key scheme** |
| Railway `LegislationSection`       | ~11,768+ acts ingested, sections growing                                   | **In progress — 241 remaining acts**        |
| Railway `LegislationItem`          | ~12,009 rows (full UKPGA corpus)                                           | **Complete**                                |
| Railway `Amendment`                | 0 rows                                                                     | Empty (never populated)                     |
| PM2 `scrutinise-ingest`            | Running with new V2.75-I code — 241 remaining acts being processed         | **Online — will self-terminate on completion** |

### Bulk download status

Bulk download alpha site (`leggovuk.s3-website-eu-west-1.amazonaws.com`) decommissioned — 403 on every path. Replacement site `research.legislation.gov.uk` is invite-only HTTP Basic Auth beta — not publicly accessible without credentials. **Decision: proceed with per-section ingest (option 3).** V2.75-H runs as per-section ingest over ~4 days unattended via PM2.

### Next CC action

**V2.75-I complete. Full corpus ingest finishing — 241 remaining acts processing now.**

PM2 is running (`pm2 status` → online, PID active). When 241 acts finish, process logs "Corpus complete — all acts already in checkpoint. Exiting cleanly." and exits with code 0. PM2 **will NOT restart** (new `stop_exit_codes: [0]` config). Status becomes "stopped" — this is correct and expected.

Monitor: `pm2 logs scrutinise-ingest --lines 50`  
Check done: look for "Corpus complete" in log, then `pm2 status` should show stopped/0 restarts.

**Next sprint** (post-trip): compile.ts — build the amendment-aware compiler using `.original.xml`, `.tna.xml`, and `effects.xml` per section. The three-layer data is now in R2; the compiler can apply Effects feed data to produce deterministic compiled text for Jaccard scoring.

**Known limitation:** Acts where TNA returns HTTP 202 for full-act CLML (e.g. Companies Act 2006) produce 0-section LegislationItems — handled gracefully, future sprint.

**`commit-all.sh` ready** at project root (per Section 12 — execute then delete).

### Corpus categorisation — strategic decision (14 May 2026)

Charlie has defined three corpus categories along user-intent lines. This supersedes the previous Phase 1–5 engineering sub-phase list (which now organises within these categories).

| Corpus | What it contains | Source infrastructure | Status |
|--------|-----------------|----------------------|--------|
| **Legislative Corpus** | Statutes, SIs, devolved equivalents, amendments, commencement, Explanatory Notes | legislation.gov.uk + research.legislation.gov.uk bulk | **Active — V2.75-H ingesting, V2.76-A Phase 2 pending** |
| **Financial Corpus** | Estimates, Spending Reviews, Departmental Annual Reports, PESA, HM Treasury Green Book | gov.uk PDFs, parliament.uk — separate ingest infrastructure | Future workstream |
| **Operational Corpus** | Departmental policy papers, Cabinet Office codes, regulator codes, HMRC manuals, Hansard ministerial statements | Gov.uk, regulators — scraping workstreams | Future workstream |

### Sprint phasing within corpus categories

**Legislative Corpus sub-phases:**

1. **V2.75-H (done):** Per-section ingest — UKPGA, enacted + current XML, effects feed. 12,009 acts processed.
2. **V2.76-A Phase 2 (pending approval):** Bulk Best Collection download — patch Companies Act 2006 class (HTTP 202 failures); backfill historical enacted text (794+ 1800s + 2,019 1900–87 acts with Encoded ePublished). Mark 7,634 print-only permanently excluded.
3. **V2.76-B (future):** Extend to UKSI, ASP, NIA, ANAW, NISI — same three-layer ingest (enacted + current + effects). Use bulk download for initial load.
4. **V2.76-C (future):** Explanatory Notes ingest — fetch `/notes.xml` per act for 1988+ primary legislation (~12,009 acts). Phase 3 of Legislative Corpus.
5. **V2.76-D (future):** Amendment-aware compiler — apply Effects feed data against `.original.xml` + `.tna.xml` per section. Deterministic compilation for Jaccard scoring.

**Financial Corpus sub-phases (future):** Estimates, Departmental Annual Reports, PESA, Green Book. New ingest infrastructure (PDF extraction, not CLML). Separate data pipeline.

**Operational Corpus sub-phases (future):** HMRC manuals, BAILII case law, FCA Handbook, PRA Rulebook, CMA decisions, Cabinet Office codes, professional codes, Hansard. Primarily scraping workstreams. Most of the old Phase 2+3+4+5 list maps here.

**Note on old Phase list:** The previous "Phase 1 (legislation) / Phase 2+3 (scraping) / Phase 4 (codes) / Phase 5 (Hansard)" ordering is subsumed by the ternary categorisation above. Phase 2+3 scraping maps to Operational Corpus; Phase 4 codes map to Operational Corpus; Phase 5 Hansard spans all three.

***

## CC GIT DISCIPLINE — STILL THE LAW

CC must not call git during a sprint. At the end of each sprint, CC produces `commit-all.sh` in the project root containing all `git add` + commit commands plus `git push origin Main`, executes it after Charlie's single approval prompt, then deletes the file. Per CLAUDE.md Section 12. Last 4 sprints have ended with mid-sprint commits despite this — every brief must explicitly remind CC.

***

## SESSION CONTEXT MANAGEMENT

If `/clear` is used during a session, CC will lose all working memory. To prevent CC reading stale boot files and reporting outdated state:

-   **handoff_summary.md must be the truth.** It is updated mid-sprint where state changes are significant (this is the one exception to Section 12's no-mid-sprint-commit rule for docs).
-   After `/clear`, CC re-reads boot files. If the handoff says "Sprint X in progress with state Y," CC should report that. If the handoff is stale, fix the handoff first.
-   A dedicated `CURRENT_SPRINT.md` file at repo root could replace this convention post-trip — see CLAUDE.md Section 0.

***

## HISTORICAL — SPRINT V2-L COMPLETE ✅ (24 April 2026, v36)

**Note:** the section below is preserved for reference. It describes the state at end of V2L. V2.75-A through V2.75-H1.5 have superseded the working state described below.

Eight commits to Main. `tsc --noEmit` clean. `prisma generate` done locally. `prisma db push --accept-data-loss` and env vars are MANUAL STEPS (see below).

### V2L commit summary

1.  **V2L-A1** — Schema: `LegislationSection`: removed `compiledText`, `tnaCompiledText`, `lexSummary`; added `rawXmlKey String?`, `compiledTextKey String?`, `lexSummaryKey String?`, `ftsVector String?`. `LegislationItem`: added `feedUrl String?`. `prisma generate` ✅ (locally). `prisma db push --accept-data-loss` is a MANUAL STEP (data loss acceptable — rebuilding into R2).
2.  **V2L-A2** — `scripts/legislation/r2-client.ts` (NEW): `r2Put`, `r2Get`, `r2Exists`, `xmlKey`, `compiledKey`, `summaryKey`. `scrutinise-web/lib/r2.ts` (NEW): same for Next.js API routes. `@aws-sdk/client-s3` installed ✅.
3.  **V2L-A3** — `scripts/legislation/ingest.ts`: R2-first writes — raw XML and TNA compiled text to R2; stores `rawXmlKey`, `compiledTextKey`, `compiledBy: 'tna-direct'` in DB. Full corpus feed flags: `--full` (ukpga all), `--si`, `--eu`. Atom feed pagination with 500ms delay. Checkpoint/resume (`ingest-checkpoint.json`, `--reset-checkpoint` flag). PAUSE file support. Progress logging `[done/total]`.
4.  **V2L-A4** — `scripts/legislation/compile.ts`: fetches raw XML from R2 via `rawXmlKey`. Writes compiled text + lexSummary to R2; stores `compiledTextKey`, `lexSummaryKey` in DB. Parallel batches of 5 (6s between batches). `--reset-failed` flag. Progress summary + PAUSE file.
5.  **V2L-A5** — `app/api/ideas/[id]/legislation-search/route.ts`: SQL selects `compiledTextKey`, `lexSummaryKey`, `compiledBy`; FTS uses `originalText` (in Railway). After query: parallel `r2Get()` for each result. Returns `compiledText`, `lexSummary`, `isTnaVerified` (compiledBy === 'tna-direct'). `components/LegislationPanel.tsx`: interface updated — removed `tnaCompiledText`, added `isTnaVerified`; labels updated.
6.  **V2L-B1** — `app/api/legislation/test-sections/route.ts` (NEW): GET, no auth. Fetches 20 COMPILED sections + amendments from DB; fetches compiledText + lexSummary from R2. `app/legislation-compare/LegislationCompareClient.tsx`: rebuilt — dynamic sections from API, gold standard from R2, verbatim amendment-compilation task, removed cleanTnaText() and live-fetch logic.
7.  **V2L-C1** — `scrutinise-docs/CLAUDE.md`: added STORAGE ARCHITECTURE section (Railway 5GB limit, R2 key scheme, on-demand flow).
8.  **V2L-D1** — `CHANGE_LOG.md` + `handoff_summary.md` bumped to v35.

### V2L architecture notes (still valid)

-   `compiledTextKey` holds the same R2 path regardless of TNA or AI source. `compiledBy === 'tna-direct'` distinguishes TNA from AI in Railway.
-   FTS query uses `originalText` (short, in Railway). `ftsVector` field reserved for future pre-computed tsvector from full compiled text.
-   `compile.ts` only processes `PENDING` sections — sections marked `COMPILED` by ingest (TNA path) are skipped.
-   `LegislationItemClient.tsx` (`/legislation/[itemId]`) will show no compiled text after migration — graceful degradation, not an error.

### V2L MANUAL STEPS (largely done, listed for reference)

1.  Add `CLOUDFLARE_R2_*` env vars to Railway and Vercel.
2.  `npx prisma db push --accept-data-loss` on Railway.
3.  Re-ingest existing Acts (replaced by V2.75-H plan).
4.  Run compile loop (replaced by V2.75-H plan).

***

*Below this point, the historical V2L handoff has been truncated. Full V2L detail remains in git history at the V2L-D1 commit.*
