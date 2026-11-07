# INGEST-CBA-1 — REPORT BACK: what the corpus holds for cost–benefit analysis

*Executes `docs/BRIEF_INGEST_CBA_1.md` §5. **2026-11-04 03:13 UTC · CC-Ingest.** Every figure below was read
from the live Neon corpus (`ep-old-dust-aboxi69a`) or the publisher's own files on 4 Nov 2026, not inferred.
**Nothing was written to Neon or R2.** The pilot is a dry run with a full read-back. As with 307, sections Lex
may already cite are not re-cut until the read-back has been reviewed.*

Artefacts (all in `docs/ingest_traces/`): `cba1_audit.json`, `cba1_audit_2.json` (what is held),
`cba1_sources.json` (what gov.uk serves), `cba1_pilot_text.json` + **`cba1_pilot_readback.txt`** (every pilot
section, for review), `cba1_pilot_tables.json`. Scripts: `scripts/ingest/lex-five/audit-cba.ts`,
`audit-cba-2.ts`, `probe-cba-sources.ts`; `scripts/ingest/cba/numbered-paras.ts` + `pilot-text.ts`;
`scrutinise-web/scripts/costing/cba1-tables.ts`.

---

## HEADLINE

1. **⚠⚠ The discount rate is no longer 3.5%.** HM Treasury's discounting guidance, updated **28 Oct 2026**,
   says (para 2.1): *"The STPR is currently set at 3.00% in real terms for the first 30 years of a proposal"*.
   Para 3.8 gives the schedule: **3.00% for years 1–30, 2.50% for years 31–75, 2.25% for years 76–125**.
   The brief (§1 row 1) says 3.5%, and so does `scrutinise-web/lib/lex/costing-params.ts:26`
   (`STPR_DISCOUNT_RATE value: 0.035`). That file's own note said "under formal HMT review"; the review has
   now concluded. **Lex's file, not touched here.**
2. **⚠ The Green Book Lex cites has changed edition.** The October 2026 Green Book (86pp, published at a new
   path, `the-green-book--2`) no longer states the 3.5% or the 1.5% health rate at all. Both moved to the
   supplementary guidance. Its paragraph 6.58 is now *"Discounting should not be applied retrospectively…"*.
   `costing-params.ts:46–54` cites **"Green Book 2026, §6.58"** for the 1.5% health rate, verified on
   4 Jul 2026 against the February edition. **That citation now points at a different sentence.** I did not
   find the 1.5% health rate in either October document: 0 hits for "health" in the discounting guide, and
   0 hits for "1.5" in the Green Book text. Where it lives now is **NOT CHECKED**.
3. **Most of §1 is held, but split by heading, not by paragraph number.** The method documents mostly arrive
   as gov.uk HTML editions, and **the HTML has no paragraph numbers** (0 numbered `<p>`s in the Green Book's
   224,559-character body). Lex can cite "Green Book › Chapter 6 › Discounting" today but not
   "Green Book 6.56". The numbers exist only in the PDF.
4. **The 307 splitter cannot number these documents. A two-level splitter can, and the pilot shows it.**
   307's splitter keys on Managing Public Money's three levels ("3.3" section, "3.3.1" paragraph). The Green
   Book, its supplementary guidance, the Magenta Book and the Better Regulation Framework number at **two**
   levels ("6.58" is the paragraph). Measured: **307's splitter returns 0 sections for all five.**
   `cba/numbered-paras.ts` returns the Green Book as **391 sections (1.1–10.12, then A.1–A.18), with 0
   sequence gaps and 94.7% of words placed**, plus its **13 tables taken from the HTML edition, kept as
   tables**.
5. **§2's two priority-1 tables are opposite cases.** The GDP deflator series **is held** and current to
   within 0.17% for every year since 2020. **Civil Service Statistics is not held at all**, but its 2026
   tables are clean, machine-readable, and give median salary and headcount by **department × grade**.

---

## §5.1 — WHAT IS HELD, IN WHAT FORM, AND WHETHER IT IS SECTION-ADDRESSABLE

### §1 Guidance (all in corpus `govuk-core-docs` unless stated)

| Brief item | Held? | Form | Section-addressable? | Publisher date |
|---|---|---|---|---|
| **Green Book** (Oct 2026, `the-green-book--2`) | ✅ 89 sections | full text, HTML edition split at headings (88 headed + landing page) | **by heading only — no paragraph numbers** | 2026-10-28 |
| ⚠ Green Book (Feb 2026, old path) | still held: 2 rows | landing page + **one 31,515-word PDF blob** | ❌ | 2026-02-05 — **superseded**, still searchable |
| GB supplementary: **discounting** | ❌ not held | — | — | 2026-10-28 |
| GB supplementary: **optimism bias** | ❌ not held (only a Homes England page matches) | — | — | 2013-04-21 (still the current edition) |
| GB supplementary: distributional analysis | **NOT CHECKED** | | | |
| **Managing Public Money** (307) | ✅ 138 sections | full text, 134 headed | ✅ by section/annex: "Managing Public Money › Annex 4.6 Procurement" | 2026-08-13 |
| **Magenta Book** | ✅ 388 sections | full text, 387 headed (HTML editions of the book and its supplementary guides) | by heading only | 2026-05-15 |
| **Better Regulation Framework** guidance | ❌ not held (one PAC correspondence item mentions it) | — | — | 2025-09-05 |
| **Impact Assessment template** | ❌ not held | — | — | 2025-07-10 (two .docx: RIA and options assessment) |
| **Aqua Book** (307 fixed path) | ✅ 79 sections at `guidance/the-aqua-book` | full text, headed ("2 Definitions and concepts › …") | ✅ by heading | 2025-07-30 |
| **Orange Book** | ✅ 94 sections | 92 headed, numbered ("2. Part I › 2.3 Main Principle") + the May 2023 PDF as one blob | ✅ | 2026-07-29 |

▶ MPM addressing confirmed by read-back: `Annex 4.1` to `Annex 4.12` are each a section, so **"MPM A4.6" resolves
to `managing-public-money:115` (Annex 4.6 Procurement, 1,651 words)**. Paragraph A4.6.3 sits *inside* that section,
not as its own row. That is 307's design (section level, not paragraph level), and it is the right grain for MPM.

### §2 Reference tables

| Brief item | Held? | Where / form | Notes |
|---|---|---|---|
| **GDP deflators** | ✅ | `DeflatorSeries`: 71 rows, FY1955–2025 (2025-26 = 100), loaded 2026-07-04 from the **June 2026 QNA** by `scripts/costing/m3-deflators.ts` | ⚠ **The table has no source or publisher-date column**, so the brief's "publisher date" cannot be recorded per row today. |
| **Green Book discount rates / optimism-bias ranges** | ⚠ partly, as code | `lib/lex/costing-params.ts` (STPR, health rate, optimism-bias uplifts 24/51/44/66/200% upper, 2/4/3/6/10% lower, outsourcing 41%) | **STPR is now wrong (3.5% → 3.00%) and the §6.58 citation is stale.** The optimism-bias figures match the 2013 guide's Table 1, which is still current. Not a table keyed by category, and not cited to a held section. |
| **Civil Service Statistics** | ❌ | one landing page (2023) in `hmrc-codes-guidance` | — |
| **PESA** | ❌ | one consultation landing page | 2026 edition exists: PDF + chapter `.xlsx` tables |
| **Published IAs — summary-sheet table** | ⚠ text held, table **not built** | `impact-assessments`: **1,172 assessments, 18,759 sections**, 2005-12 to 2026-07; **989 sections with NULL `parentDocId`** | `BRIEF_INGEST_IMPACT_NUMBERS` §2 extraction has been gated since 7 Sep (`INGEST_IMPACT_NUMBERS_REPORT.md`); no later CHANGE_LOG entry. The figures survive ingest (6,288/6,288 £ figures), but `pdfToText` flattens the summary table, so the extractor must **assign by label**. |
| **NAO cost findings** | ⚠ text held, extraction **not built** | `nao-reports`: 3,983 sections, all dated (18 Oct) | ⚠ **Licence `nao-nc`, i.e. non-commercial.** 31 sections are titled on major projects / SROs / accounting officers / write-offs. |
| **Unit-cost databases** | ⚠ partly, as rows | `CostBenchmark`: 53 verified rows — Home Office crime 19 + fraud 3, PSSRU 9, TAG 10, ASHE 3, BPE 5, DESNZ 2, QALY 1, WELLBY 1 | **GMCA: 0 rows.** `m4-gmca.ts` is built and dry-run verified (CC BY 4.0), but `--apply` has awaited Charlie's go since 4 Jul. |

### §3 Precedent costings

| Act | Explanatory Notes held | Impact assessment held |
|---|---|---|
| Building Safety Act 2022 (`ukpga/2022/30`) | ✅ 361 sections | ✅ `ukia/2022/11`, 8 sections |
| Health and Care Act 2022 (`ukpga/2022/31`) | ✅ 213 | ✅ `ukia/2022/13`, 25 sections |
| FSMA 2000 (`ukpga/2000/8`) | ❌ 0 | ❌ |
| … as amended 2013: FS (Banking Reform) Act 2013 (`ukpga/2013/33`) | ✅ 69 | ❌ |
| … FS Act 2012 (`ukpga/2012/21`) | ✅ 129 | ❌ |
| Corporate Manslaughter and Corporate Homicide Act 2007 (`ukpga/2007/19`) | ✅ 17 | ❌ |
| LGA 1972 s.151 (`ukpga/1972/70`) / LGHA 1989 ss.4–5 (`ukpga/1989/42`) | ❌ 0 — Explanatory Notes did not exist before 1999 | ❌ — impact assessments did not exist |
| CRaG 2010 (`ukpga/2010/25`) | ✅ 54 | ❌ |

▶ **The gap is bill-stage IAs.** `impact-assessments` is legislation.gov.uk's `ukia` series, which is mostly
attached to *instruments*. A Bill's IA is published on gov.uk or bills.parliament.uk and is held for only 2 of
the 5 precedents. PAC material is broadly held: 20,564 `committees-reports` sections carry a Public Accounts
Committee title (Open Parliament Licence). Cost figures from it are not extracted.

---

## §5.2 — LICENCES

| Item | Licence | Basis |
|---|---|---|
| Green Book + supplementary guidance, MPM, Magenta, Aqua, Orange, BRF, IA template | **OGL v3.0** | gov.uk terms. The Green Book PDF's own front matter: *"licensed under the terms of the Open Government Licence v3.0"* (read in the pilot) |
| GDP deflators, Civil Service Statistics, PESA | **OGL v3.0** | gov.uk national statistics |
| Impact assessments, Explanatory Notes | OGL v3.0 | as stored (`licence = ogl-3.0` on all 18,759 / 18,801 rows) |
| NAO reports | ⚠ **`nao-nc` — non-commercial** | as stored on all 3,983 rows. Reuse in a not-for-profit is likely inside it; **Charlie to confirm before cost figures are extracted and shown** |
| PAC / committee reports | Open Parliament Licence v3.0 | as stored (`opl-3.0`) |
| GMCA Unit Cost Database v3.0 | **CC BY 4.0** (attribution required) | stated in the workbook's own Introduction sheet (CHANGE_LOG 2026-07-04) |
| PSSRU Unit Costs of Health and Social Care 2025 | **NOT VERIFIED** | recorded as "openly published, NIHR-funded"; no licence statement captured |
| Home Office costs of crime / fraud | OGL v3.0 | gov.uk |

---

## §5.3 — THE GAP, AND THE PILOT (§1 rows 1–2, §2 rows 1 and 3)

### Pilot A — the method documents, numbered by paragraph (DRY RUN)

`scripts/ingest/cba/pilot-text.ts`: fetches the publisher's PDFs, splits them with `numbered-paras.ts`, and writes
every section to **`docs/ingest_traces/cba1_pilot_readback.txt`**.

| Document | Sections | Range | Gaps | Words placed | Tables |
|---|---|---|---|---|---|
| **Green Book (Oct 2026)** | **391** | front, 1.1 … 10.12, **A.1 … A.18** | 0 | 29,803 / 31,479 = **94.7%** | **13 from the HTML edition**, rows intact (`Year \| 0 \| 1 \| …`) |
| GB discounting (Oct 2026) | 33 | front, 1.1 … 3.13 | 0 | 95.3% | none in source |
| GB optimism bias (2013) | 31 | 1.1 … 4.1, then Example 1 (Part 1), APPENDIX | 0 | 97.4% | Table 1 is in the text, flattened (see below) |

Read back verbatim, by key:
- **Green Book 6.56** [Chapter 6: Shortlist appraisal › Discounting]: *"Discounting is distinct from adjusting for inflation. The STPR is a real discount rate…"*
- **Green Book 6.58**: *"Discounting should not be applied retrospectively to costs and benefits that have already occurred."*
- **Green Book A.1** [Annex A: Private finance models]: *"The Balance Sheet Framework defines private finance models as…"*
- **GB discounting 3.8** [Chapter 3: Discounting in appraisal › Proposals with time horizons beyond 30 years]: *"• 3.00% for years 1 to 30 • 2.50% for years 31 to 75 • 2.25% for years 76 to 125"*

⚠ **What the first run got wrong. The splitter was fixed against its own read-back, not assumed right.**
- The first version placed only **60.7%** of the Green Book's words. A "second 1.1 means the contents list
  ended" rule fired on a numbered cell **inside the options-framework table** and discarded chapters 1–5. A
  restart now requires everything before it to read as a contents list (median ≤ 12 words).
- It titled 6.58 *"Present values£1,000£971£943…"*, a table row taken for a sub-heading. A heading may no
  longer contain £, % or more than two digits.
- Annex A's 18 paragraphs piled into 10.12 (2,337 words). Annex paragraphs ("A.n") are now their own
  sequence.

⚠ **Kept honest, not hidden:**
- **pdfToText splits the "fr/fl/fi" ligature in the Green Book's font**: 179 instances of "f rom" /
  "f ramework" in the source text. `dekern()` repairs them to 5, and the pilot counts before and after.
  §14's adversarial set survives: £ 41, curly quotes 152, dashes 20.
- **PDF tables are flattened** (`Year012345`). That is why the Green Book's tables come from the HTML. The
  optimism-bias guide has **no HTML edition**, so its Table 1 (the uplift percentages) is held as text rows
  (`Standard Buildings 4 1 24 2`). It is readable, but not a table.
- Optimism bias "Example 1 (Part 1)" holds 2,336 words, because the later worked examples are numbered
  "1.1 Example 1 (Part 2)" and read as body text. The example blocks are one section, not four.
- The 5.3% of the Green Book that does not land in a paragraph is page furniture and the contents list.

### Pilot B — the two priority-1 tables (DRY RUN)

`scrutinise-web/scripts/costing/cba1-tables.ts`:

- **GDP deflators.** The October 2026 Budget release (outturn as at QNA 30 Sep 2026) parsed by m3's own rule:
  71 outturn rows FY1955–2025, latest 2025 = 100, exactly matching the held table's span. Rebased to
  2019 = 1, **the largest revision is 0.68% (2008); from 2020 on, every year is within ±0.17%.** Refreshing is
  `m3-deflators.ts` with the new URL; it is not urgent. ⚠ m3 **replaces the whole table** and has nowhere to
  write the release date.
- **Civil Service Statistics 2026 V2** (published 28 Oct 2026, ODS, 67 sheets). The four tables Lex needs are
  clean:
  - **Table 7**: median salary by responsibility level × sex. All staff: SCS £95,540 · G6/7 £65,830 ·
    SEO/HEO £43,930 · EO £32,140 · AO/AA £28,020.
  - **Table 25**: median salary by **department × organisation × grade** (e.g. Crown Prosecution Service:
    SCS £98,970, G6/7 £63,500 …).
  - **Tables 20 / 21**: headcount / FTE by department × organisation × grade.
  - ~150 organisation rows each. Suppression is **marked in the cell** (`[c]` = fewer than 10 or 30 staff,
    `[n]` = not applicable), so it can be carried as a state, never as zero.

### The size of the gap

| Work | Size | Status |
|---|---|---|
| Re-cut the Green Book by paragraph + tables | 391 + 13 sections (replacing 89) | **built and dry-run.** Writes once the read-back is reviewed |
| Discounting + optimism-bias guidance | 33 + 31 sections | built and dry-run |
| Retire the superseded Feb 2026 Green Book rows | 2 rows | needs a decision (mark `superseded`, never delete) |
| Better Regulation Framework guidance | ~215 numbered paragraphs (64pp PDF, same two-level shape) | same splitter, not yet run |
| IA template fields | 2 .docx | not started. Field list = the template's own headings |
| Magenta Book by paragraph | already held by heading; its PDF numbers *sections* ("1.1 Introduction"), not paragraphs | **recommend leaving it by heading** |
| Civil Service Statistics | ~2,700 cells per year (4 tables × ~150 orgs × ~6 grades) | **needs a table**: schema is Charlie's and CCh's |
| PESA | chapter `.xlsx` tables, 2026 edition | not started. Needs a table |
| Deflators: a source + publisher-date column | 2 columns on `DeflatorSeries` | schema, Charlie's and CCh's |
| IA summary-sheet extraction | 1,172 assessments | the `BRIEF_INGEST_IMPACT_NUMBERS` §2 design exists; gated since 7 Sep |
| Bill-stage IAs for the precedent Acts | ~3–5 documents | not started. Source is gov.uk / bills.parliament.uk, not `ukia` |
| NAO / PAC cost figures with sentence + page | 3,983 + 20,564 sections to search | not started. NAO licence question first |
| GMCA | 30 entries | **built; one `--apply` away**, on Charlie's go |

---

## §5.4 — WHAT THE DATA CANNOT SUPPORT (write Lex's brief to this)

1. **"The cost of a civil servant's time at a grade" is not published as a unit cost.** Civil Service
   Statistics gives **gross salary** (median and mean) by grade and department. It has **no employer on-costs**
   (NI, pension) and **no paybill by department or grade**. A full employment cost needs an on-cost uplift that
   these tables do not carry; Lex must state it as an assumption, with its source. The brief's
   "headcount and paybill" is half-supported: headcount yes, paybill no.
2. **Salaries are as at 31 March 2026 in cash terms, not a price year.** Uprating to the analysis year with
   the deflator is Lex's step, and it must say so.
3. **Small cells are suppressed** (`[c]`). A department × grade median does not always exist; the fallback
   (department overall, or Civil Service grade median) must be visible, never silent.
4. **The Green Book no longer carries its own numbers.** Discount rates live in the discounting guide
   (Oct 2026), and optimism bias in a 2013 guide whose Table 1 survives only as text. "Green Book discount
   rate" must cite **GB discounting 2.1 / 3.8**, not the Green Book. The 1.5% health rate's current home is
   **not established**.
5. **Optimism-bias uplifts are by *project type*** (buildings, civil engineering, equipment/development,
   outsourcing). They are not by policy category. Applying them to a regulatory duty or an administrative
   process is an inference the guidance does not make; Lex must say which category it chose and why.
6. **Paragraph-level citation of the method documents does not exist until Pilot A is written.** Today Lex can
   cite the Green Book by heading only.
7. **IA figures are not a table yet.** "A comparable duty cost £X per body per year in IA Y" needs the
   IMPACT_NUMBERS extractor. Until then a figure can be quoted from text, by label, with its price base year;
   it cannot be filtered or compared. Only **73 of 1,172 assessments are post-implementation reviews**, so
   "what it actually cost" is rarely available.
8. **Bill-stage costings for 3 of the 5 precedents are not held.** For LGA 1972 / LGHA 1989 none was ever
   published, so that absence is permanent, not a gap.
9. **NAO figures carry a non-commercial licence**, and no NAO or PAC report is linked to the measure it
   examines (S18 finding, unchanged).

---

## DECISIONS FOR CHARLIE

- **D-1 · Write Pilot A to production?** It replaces the 89 heading sections of `the-green-book--2` with
  391 paragraph sections + 13 table sections, and adds discounting (33) and optimism bias (31). ⚠ Section ids
  change, so any existing `[Ref:]` to a Green Book heading section would point elsewhere. *Recommend: yes,
  after a look at `cba1_pilot_readback.txt`, writing to NEW docIds (`…/the-green-book-2026-paragraphs`) so
  the heading rows stay until nothing cites them.*
- **D-2 · Mark the February 2026 Green Book rows `superseded`** (availability_status, not deleted) so search
  stops returning the old edition? *Recommend: yes.*
- **D-3 · Tell Lex: STPR 3.00% / 2.50% / 2.25%, and the stale §6.58 citation.** `costing-params.ts` is Lex's
  file. *Recommend: a note to CCh-Lex today*; it drives user-facing numbers.
- **D-4 · Schema (Charlie / CCh, entity_list).** (a) `DeflatorSeries` + `source`, `publishedAt`; (b) a table
  for Civil Service Statistics (year × table × parent department × organisation × grade × measure, value,
  suppression state, source, publishedAt); (c) the same shape for PESA.
- **D-5 · NAO licence (`nao-nc`).** Confirm that reuse inside Scrutinise is within it before cost figures are
  extracted and shown.
- **D-6 · GMCA `--apply`** (built 4 Jul, CC BY 4.0, 30 entries).

---

## CHECKS RUN (§23.2)

| check | result |
|---|---|
| `audit-cba.ts` (14 items × all non-speech corpora + CostBenchmark + DeflatorSeries) | ran, 0 errors |
| `audit-cba-2.ts` (precedent Acts, MPM, licences, NAO/PAC) | ran, 0 errors. ⚠ The first EN query used the wrong key shape (`explanatory-notes:ukpga/…`) and returned 0 for every Act. Re-run with the real shape (`explanatory-notes:en:ukpga/…`); the table above is the re-run |
| `probe-cba-sources.ts` (17 gov.uk paths) | ran. 2 paths redirect (Green Book, IA calculator), followed and read |
| `pilot-text.ts` | ran 3×. The first run failed its own read-back (60.7% placed, a table row as a heading); fixed; final run above |
| `cba1-tables.ts` | ran 2× (the first missed sheet titles behind "Back to contents") |
| `tsc --noEmit` (scripts/ingest) | the five new files are in the program (`--listFilesOnly`) and add **0 errors**; 24 error lines elsewhere, in files this work did not touch |
| `tsc --noEmit` (scrutinise-web, includes `scripts/costing/cba1-tables.ts`) | **clean** |
| Production write / delivery check | **NOT APPLICABLE — nothing was written** |
