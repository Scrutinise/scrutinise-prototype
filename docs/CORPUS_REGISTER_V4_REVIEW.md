# REVIEW — `SCRUTINISE_CORPUS_REGISTER_v4.xlsx`

**Reviewed:** 2026-08-23 23:02 UTC by CC-Ingest, at Charlie's request.
**Reviewed against:** the live database, `docs/INGEST_CENSUS_C1_A_REPORT.md` (Census C1 Part A), and
CCh-Ingest's own `INGEST_C2_LANE2_REPORT.md` / commit `48a1909`.
**Nothing in the workbook was changed.** It is CCh-Ingest's artefact; this is a list of corrections
for whoever next edits it.

---

## What is right, and it is most of it

Checked mechanically against `corpus_sections`:

- **All 74 live collections are named.** Zero omissions — the check looked for any corpus with
  compiled rows that the register does not list, and found none.
- **`Sections held` matches the live compiled count on every row but one.** `pwdata-wrans` is
  1,232,999 in the register against 1,233,016 live — **+17 of snapshot drift, not an error.**
- **No orphan percentages.** No row carries a `% complete (units)` without a `Units published`.
- **The denominators are real, and they are the honest ones.** `primary-acts-pre-2000` is
  3,560 of **9,343** — published minus the 7,279 the source declares have no provisions — which is
  exactly the denominator Census C1 Decision 2 recommended. `retained-eu` 39,068 of 46,150 likewise.
- **The legacy table is excluded from the headline.** `Coverage Summary` ends
  `=SUM(C17:C24)-C23`, so the 914,274 legacy sections do not inflate the total. A naive sum of the
  `Sections held` column gives 19,186,709 and is *not* what the workbook reports — the 19.19M vs
  18.24M trap the brief warns about is handled correctly.
- The MEASURED / CLAIMED / UNMEASURED / NOT STARTED / BLOCKED / RETIRED / LEGACY / OUT OF SCOPE
  vocabulary is applied consistently, and the 51 keys with no rows in `corpus_sections` are all
  NOT STARTED, OUT OF SCOPE, BLOCKED or RETIRED — correct by design, not gaps.

---

## Wrong on the data — four items

### 1. ⚠⚠ The Hansard "overlap" does not exist. Three rows act on it.

`historic-hansard` — *"Known overlap window with pwdata-debates / pwdata-lords, not de-duplicated"*,
work: *"measure and resolve the overlap"*. `pwdata-debates` — *"Overlaps historic-hansard and is not
de-duplicated in retrieval."*

**Measured: zero shared sitting days on both pairs.**

| | historic-hansard ends | pwdata begins | shared days |
|---|---|---|---:|
| Commons (`S5CV`) | **1918-11-21** | `pwdata-debates` **1919-02-04** | **0** |
| Lords (`S5LV`) | **1999-11-11** | `pwdata-lords` **1999-11-17** | **0** |

The collections **abut**; there is nothing to de-duplicate. ⚠ This is an error I made first and
corrected — a day-level join that compared `historic-hansard`'s **Lords** volumes against `pwdata`'s
**Commons** stream produced a spurious "8,697 shared sitting days". Split by House it is zero.
Evidence: `INGEST_CENSUS_C1_A_REPORT.md` §A4.

### 2. ⚠⚠ `et-decisions` / I05 — the re-fetch is 503, not 131,650

The row and I05 both say *"delete the 131,654 and re-fetch the real decisions"*. **The real decisions
are already held.** Of the 131,650 landing pages (by `sourceUrl`, not 131,654), **131,147 have their
judgment PDF ingested alongside them** at `assets.publishing.service.gov.uk/…​.pdf` — 161,749 such
rows. Only **503** have nothing behind them.

The delete stands. The re-fetch is **503 documents, a ~260× reduction**. Deleting the landing rows
also loses no metadata: all 161,749 document rows already carry their own `sectionTitle` and
`itemDate`. Evidence: `INGEST_CENSUS_C1_A_REPORT.md` §A3.

*(Row counts differ slightly because the register counts by word-count median and this counts by URL:
131,650 landing / 293,399 compiled.)*

### 3. ⚠⚠ `oecd` is a wrong-content problem, not a licence-vintage problem — and it is not in the Issues Log

The row says: *"Existing 505 rows are pre-July-2024 content and are NON-COMMERCIAL. Post-July-2024
OECD content is CC-BY and seedable."*

**505 of 505 rows are `gov.uk` URLs. None is from OECD.** Ten so much as mention "oecd" in the URL.
52 are gov.uk **news stories**, 31 are ministerial **speeches** — one is *"London 2012 sets new world
standard on Olympic legacy"*. Labelling the two vintages separately would label content that is not
OECD's at all.

This is the failure V20 found in `college-of-policing` (*"prior content was unfiltered gov.uk search
junk"*), which was **blocked** for it. Recommend the same: block, purge, re-seed from oecd.org.

### 4. `ots-reports` is not "complete by definition"

The row says *"OTS abolished 2023 — collection is closed and complete by definition"*, work:
*"Confirm closure; mark COMPLETE-CLOSED."* All 497 rows are gov.uk (correct — OTS published there),
but **≥69 are news stories and speeches, not OTS reports** (e.g. *"Speech by the Financial Secretary
to the Treasury… at the Private Equity Seminar"*). Closed, yes. Complete, no — contaminated.

---

## Superseded by CCh-Ingest's own later work — three items

The register is a **09:02** snapshot; C2 Lane 2 landed at **19:43** (commit `48a1909`) and overtakes
it in three places:

| register | says | C2 Lane 2 measured |
|---|---|---|
| **I12** dot leaders | "about 178,826 legislation sections (11.4%)" | **249,256** — the census undercounted by **28.3%**, because `isRepealedPlaceholder` was defeated by the word "Article" in `retained-eu` |
| **I08** `building-regs` | "21 rows at roughly 446 words each… Fix PDF extraction, then re-fetch" | **there is no PDF to extract from** — all 21 rows are `format=null` landing pages. (Measured median is **318** words, not ~446.) |
| **I10** `written-answers` | "143 rows at roughly 306,000 words each — whole source files… Re-split into one section per answer" | **truncated, not merely unsplit** — 10 of 10 sampled rows hold exactly 5,000 answers, the API's page size. **Retire rather than re-split.** |

## Answered since the snapshot — two items

- **I15** *"legacy-legislation-section… Join the legacy ids"* — done. **29 instruments / 211 sections**
  are an independent gap; 127,417 of 127,790 are already held (`INGEST_CENSUS_C1_A_REPORT.md` §A7,
  independently reproduced by C2 Lane 2).
- **I17** *"Four suspected pairs have never been checked"* — three now have been.
  `uk-treaties`/`uk-treaties-fcdo` **duplicated at item level** (TS No. 8 (2016) appears in
  `uk-treaties` and **twice within `uk-treaties-fcdo`**); `lda-lordsdivisions`/`lords-divisions-votes`
  **duplicated 2,087 of 2,089** (C2 Lane 2); the two Hansard pairs **disproved** — see item 1.

---

## One loose end outside the workbook

`docs/INGEST_C2_LANE2_REPORT.md` line 8 cites `docs/census/C2_L2_baseline.json` as an artefact. **That
file does not exist on disk.** It was in `commit-c2-lane2.sh`'s manifest and aborted the script; I
omitted the path so the lane could commit, and deliberately did **not** regenerate it — the
dot-leader repair has already run, so a fresh `l2-measure.ts` would produce a *post*-repair snapshot
under the name "baseline", which is worse than the file being absent. **The report's artefact line
needs correcting, or the baseline needs recovering from wherever it was written.**
