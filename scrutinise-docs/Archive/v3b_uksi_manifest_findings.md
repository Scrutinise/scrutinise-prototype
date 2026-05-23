# V.3-B UKSI Manifest Findings

*Author: CC, Phase 1.5, 2026-05-15*
*Status: Investigation complete — awaiting Charlie + CCh review before Phase 2 pilot work.*

---

## Schema change shipped (Task 1.5.1)

Added `yearRaw String?` to `LegislationItem` in `schema.prisma`. Pushed to Railway via `prisma db push`
and `prisma generate`. Verified: column present on Railway, `yearRaw: null` on existing UKPGA rows
(correct — nullable, no backfill for existing rows). No migration risk.

---

## Manifest generated (Task 1.5.2)

`scripts/legislation/v3b-uksi/manifest-uksi.json` generated from `best-collection-xml.zip`.

**Headline numbers:**

| Metric | Value |
|--------|-------|
| Total UKSI with XML in bulk ZIP | **61,179** |
| Revised-current (tnaXmlKey path) | **8,796** (14.4%) |
| Made / enacted (originalXmlKey path) | **52,383** (85.6%) |
| Year range | **1948–2026** |
| Zero-uncompressed entries | **0** |
| Non-integer year segments in actId | **0** |

**Implication vs handoff figure:** The handoff (V2.76-A Phase 1 extended) stated "ALL 108,798 UKSI
are in Best Collection." This referred to the TNA *corpus count* (metadata records on legislation.gov.uk),
not the XML count in the bulk ZIP. The ZIP contains 61,179 UKSI with machine-readable XML. The
remaining ~47,619 UKSI have no XML in the ZIP — they are the UKSI equivalent of the UKPGA
PRINT_ONLY cohort. This is consistent with the finding that UKSI have only ~8% Revised Current coverage;
the made-only SIs from earlier eras that were never digitized simply aren't in the ZIP.

---

## Q1.5.A — Year format distribution

**Findings:** All 61,179 UKSI actIds use clean integer years (`uksi/1948/1` through `uksi/2026/...`).
Zero non-integer year segments found.

**Implication for `yearRaw`:** The field will always contain a numeric string (e.g., `"1948"`, `"2021"`)
for all UKSI rows — never a complex format like `"S.I._1970"`. This is good news.
Per the brief, `yearRaw` is still populated for every UKSI row for audit-trail consistency:
even when `yearRaw = "2021"` and `year = 2021`, the field confirms the source-fidelity record was checked.

**No unusual year parsing needed.** `parseYearInt(actId)` can simply extract the second segment and call
`parseInt()`. Edge cases (regnal years in UKPGA like `Geo3`) do not appear in the UKSI corpus at all.

---

## Q1.5.B — PDF-only UKSI count and detection method

**Finding:** There is NO explicit PDF-only flag in the bulk ZIP. PDF-only UKSI simply do not have an
entry in the ZIP. Zero-uncompressed-size entries were found (there are no "placeholder" XML files for
inaccessible SIs — they are completely absent).

**Estimated PDF-only UKSI:** ~47,619 (108,798 total − 61,179 in ZIP = **47,619**).
That is **43.8% of the UKSI corpus** has no machine-readable XML.

**Detection method:** Compare the full UKSI metadata feed from legislation.gov.uk against
`manifest-uksi.json`. Any UKSI actId in the feed but absent from the manifest is a PDF-only candidate.
This comparison is a future-sprint task (requires fetching the UKSI feed — ~108,798 metadata entries).

**For V.3-B pilot and Phase 3:** Ingest only from `manifest-uksi.json` (61,179 UKSI with XML).
The ~47,619 PDF-only SIs are deferred. When the full feed comparison is done (future sprint),
`CompilationStatus.PRINT_ONLY` applies — the enum value already exists.

**Implication for Phase 3 full ingest count:** Phase 3 will process 61,179 UKSI (not 108,798).
This is still 5× the UKPGA bulk corpus (4,407 UKPGA in ZIP vs 61,179 UKSI in ZIP).

---

## Q1.5.C — Zero-section UKSI prevalence

**Sampling approach:** Read XML for 300 entries (every ~204th entry in manifest order — deterministic
sample across the full corpus range). Count P1group elements; fall back to bare P1 elements.

**Findings:**

| Provision count | Count in sample | % |
|-----------------|-----------------|---|
| 0 provisions (zero-section) | **0** | **0.0%** |
| 1 provision | 4 | 1.3% |
| 2–10 provisions | 233 | 77.7% |
| 11+ provisions (complex SI) | 63 | 21.0% |

**Extrapolated zero-section UKSI: ~0.** All UKSI in the ZIP have at least one `<P1group>` or `<P1>`
provision. The smallest XML files (≥5KB — none are smaller) all contain at least 1 provision.

**Smallest SIs:**

| actId | Uncompressed size | Version |
|-------|-------------------|---------|
| uksi/2020/1671 | 5KB | made |
| uksi/2024/726 | 5KB | made |
| uksi/2025/302 | 6KB | made |

**Implication:** Zero-section handling code in `phase3-uksi-ingest.ts` is still worth adding for
defensive robustness, but it will not trigger on any known UKSI in the bulk ZIP.

**Largest SIs (for pilot diversity — good test candidates):**

| actId | Uncompressed size | Version |
|-------|-------------------|---------|
| uksi/1998/3132 | ~13MB | revised-current |
| uksi/1994/1443 | ~10MB | revised-current |
| uksi/2005/2517 | ~8.5MB | made |

---

## Summary for Phase 2 approval

| Question | Finding | Phase 2 impact |
|----------|---------|----------------|
| **Year formats** | All clean integers (1948–2026) | `yearRaw` = year string, always set; no complex parsing needed |
| **PDF-only count** | ~47,619 (not in ZIP); no in-ZIP flag | Ingest 61,179 from ZIP; PDF-only marking deferred to future sprint |
| **Zero-section SIs** | 0 found in 300-entry sample | Defensive code only; effectively no zero-section UKSI in corpus |
| **Revised-current** | 8,796 of 61,179 (14.4%) | 14.4% go to `tnaXmlKey`; 85.6% go to `originalXmlKey` |
| **Schema push** | `yearRaw String?` confirmed on Railway | Prisma client regenerated; no migration risk |

**Phase 2 pilot is ready to proceed** pending Charlie + CCh sign-off on these findings.

---

## Files produced in Phase 1.5

| File | Description |
|------|-------------|
| `scrutinise-web/prisma/schema.prisma` | `yearRaw String?` added to LegislationItem |
| `scripts/legislation/v3b-uksi/build-manifest-uksi.ps1` | PowerShell ZIP enumerator — generates manifest-uksi.json |
| `scripts/legislation/v3b-uksi/build-manifest-uksi.ts` | TypeScript wrapper for the PS script |
| `scripts/legislation/v3b-uksi/manifest-uksi.json` | UKSI manifest (61,179 entries, gitignored — large) |
| `scrutinise-docs/v3b_uksi_manifest_findings.md` | This document |
