# `docs/report_run/` — corpus track outputs

*Produced by CC against `docs/CC_BRIEF_report_corpus.md`. Data only; no prose, no conclusions.*
*Generated 2026-08-28, evening. All statutory text read from the local bulk CLML file on this
machine. The graph rows come from Neon; T5 alone goes out to legislation.gov.uk.*

Read this page before reading any output. Three of the things below change what a number means.

---

## The three rules the files obey

**1. `markup`, `text` and `enabling` are never summed.** They are three strengths of evidence and
no file here contains a merged total. Where a file needs to state its own size the field is called
`rows_in_this_file` and says it is a fact about the file.

| detector | what it is | what it is worth |
|---|---|---|
| `markup` | a `<Citation URI="…">` element | the source document asserting the target **by identity**. The strongest. 2–5% of references carry it. |
| `text` | the Act's **name** in running text, resolved against `corpus_acts` titles | the target id is **derived**, not read from the document. Never quote `target_uri` as the source's own words. |
| `enabling` | the instrument's own enacting words: "in exercise of the powers conferred by section N of…" | **a different and stronger fact than a mention.** An instrument that merely mentions an Act survives its repeal; one whose enabling power is repealed may fall with it. |

**2. Every quoted sentence says where it came from and whether it is whole.** A row with
`sentence_complete: false` is material to read, not material to quote.

**3. Every coverage block is verbatim.** It is generated from live state at the moment of the run
and is reproduced unedited, with its own timestamp. It says what the answer could **not** see.

---

## The files

| file | what it is |
|---|---|
| `WS-05_inbound.json` / `.csv` | CRAG 2010 — every inbound reference, act-wide, each **banded** `part-1` / `act-level` / `other-provision` |
| `WS-01_inbound.json` / `.csv` | Human Rights Act 1998 — whole Act |
| `WS-04_inbound.json` / `.csv` | Equality Act 2010 — whole Act |
| `WS-0n_provisions.json` | the target Act's own provisions in scope, **plus the full sentence containing each inbound reference** |
| `gates_WS-0n.json` | devolution, Northern Ireland and instrument-allocation evidence, with the statutory text attached |
| `scoping_remaining.csv` / `.json` | reference counts for the measures not worked at full depth |
| `verification_sample.md` / `.json` | the 20-row hand check against legislation.gov.uk |

### On the CSVs

They are RFC 4180. Statutory text contains commas, quotation marks **and newlines**, so cells are
quoted and a quoted cell may span several physical lines. `wc -l` will overcount; any real CSV
reader gives the right number. Record counts: WS-05 **208**, WS-01 **1,013**, WS-04 **2,016**.

---

## ⚠ Three findings that change how you use these files

### 1. `source_provision_ref` is wrong on 19.1% of the rows that have one

**496 of the 2,593 rows that name a source provision do not contain the referenced Act inside that
provision.** The citation is real and the target is real; the words sit somewhere else in the same
document. Measured by re-reading each referring provision's own CLML, and confirmed independently
by the live check in T5, which caught one in a nine-row draw.

Where they actually sit (from the chain of open CLML elements at the match, not guessed):

| where | rows |
|---|---|
| Explanatory Note | 184 |
| elsewhere in the document | 101 |
| schedule heading | 76 |
| cross-heading | 47 |
| repeals / amendments table | 43 |
| a heading | 42 |
| enacting words, footnote | 3 |

Per measure: WS-05 **38 of 149 (25.5%)**, WS-01 **139 of 892 (15.6%)**, WS-04 **319 of 1,552 (20.6%)**.

**Two consequences, and they are not equally severe.**

- **Certain:** you cannot quote that provision as containing the reference. The words are not in it.
  A quotation built from one of these rows is a misquotation.
- **Not settled by this measurement:** whether the provision nonetheless *bears on* the target. A
  cross-heading reading "Consequential amendment to the Constitutional Reform and Governance Act
  2010" sitting immediately above a paragraph is strong evidence that the paragraph does amend it.
  These are **not 496 false rows.** They are rows whose evidence sits outside the provision named,
  and each needs its own look before a disposition is written.

The per-row field is `provision_attribution` in `WS-0n_provisions.json`, with `reference_found_in`
alongside it. Filter on it before drafting.

⚠ This is **not** the same as `coverage.notInAProvision`, which counts rows whose
`source_provision_ref` is NULL — those are honest about naming none. Nothing before this run counted
the non-null-and-elsewhere case.

### 2. The act-level band is large, and it is a floor, not noise

For CRAG, **106 rows name the Act and no provision** against **29 that name a Part 1 provision**.
Any of the 106 may bear on Part 1 and the markup does not say. Excluding them understates the work;
including them overstates it. They are banded, never merged, and the decision is yours.

### 3. Some references have already been amended or revoked away

**41 rows** (WS-01 18, WS-04 23) exist in the as-made text of the referring document and **not** in
its current text. `sentence_source: "as-made-text"` marks them. The referring provision has since
been amended or revoked, so the reference no longer bites — a disposition finding, not a retrieval
failure. The Criminal Procedure Rules 2005 are the worked example: they cite section 4 of the Human
Rights Act, and the current copy is a shell reading "(revoked)".

⚠ **Related, and not fixed by this run:** the bulk CLML file holds two copies of 2,894 documents (an
as-made and a revised one), and `extract-citation-edges.ts` iterated *entries* rather than
documents, so for those it extracted from **both** and wrote the rows under one `source_gid` with no
column saying which. `citation_edge` therefore mixes as-made and current text for those documents.
Quantified per measure under `version_ambiguity`. It needs a re-extraction and a schema column, which
does not belong in a report run.

---

## What T5 does and does not establish

**20 of 20 correct**, all 20 actually fetched. The verifier was made to pass once and fail twice
before any row was scored, and every non-pass would have been re-examined against both our copy and
the whole live document before being reported.

⚠ **The 20 rows contained no `markup` rows at all** — the brief's sample is stratified by measure,
and markup is 2–5% of the table. So the headline rate measures the `text` detector. A supplementary
three-per-detector draw was run and is reported separately, never merged: markup 2/3, text 3/3,
enabling 3/3. The one failure is the misattribution described above.

Three rows per detector establish that a detector is not systematically broken. They do **not**
establish a rate, and none is quoted for them.

---

## What was not produced, and why

- **WS-02/03 (Constitutional Reform Act 2005) at full depth.** Conditional on Charlie's decision at
  09:00 Tuesday 1 September per brief §5. Its scoping row is in `scoping_remaining.csv` and the full
  T1–T3 run is one flag away: `--include-t4` on each of the three scripts, about fifteen minutes.
- **Nothing else.** Every item on the brief's §8 checklist is present.

---

## Added 29 Aug by briefs B2, B3 and B4

| file | brief | what it is |
|---|---|---|
| `argument_WS-0n.json` | B2 | historic objections for §9 — sourced, quoted, with speaker/date/debate/source key |
| `caselaw_WS-0n.json` | B3 | Set A (cases citing the Act) and Set B (the principle at common law), never merged |
| `verification_markup.md` / `.json` | B4 | the `markup` detector's own verification rate |

### ⚠ Four things in those files that change what a number means

**1. B2: sort on `subject_terms_present` before you draft.** A confirmed objection can be two
things that look identical in JSON — the cross-subject find this instrument exists for (the
unbounded-duty argument made in 2005 about *advertising marches*, which transfers to a public
sector equality duty unchanged), or pattern noise (a COST pattern firing on "burden on small
businesses" in a question about *fuel protesters*). An empty `subject_terms_present` means the
passage is connected to the measure by the argumentative **move** alone. **For WS-04 that is 28 of
32 rows.** Telling the two apart is a reading and it is yours; the field sorts the pile and rules on
nothing.

**2. B3: the front matter's "case law from 2001 only" is wrong.** The measured floor is
**1965-08-09** across 280,573 rows in five collections. ⚠ And `coverage.ts`'s own
`CASE_LAW_CORPORA` is wrong too — two of the four names it lists hold zero rows, and it misses
`tna-caselaw` (which supplies the 1965 floor) and `ni-judgments`. The coverage block in each B3
file is reproduced **exactly as generated, defect included**, because that is what the report
prints; `date_range_measured` beside it is the corrected measurement. Not fixed here: correcting it
changes a block you are drafting against today.

**3. B3: CRAG 2010 is essentially unlitigated — one judgment.** `ni-judgments:2021-nica-49 — JR83
(No 2) and The Prime Minister`. That is a finding, not a retrieval failure: the Human Rights Act
through the identical path returns 53 of 60. §8 for WS-05 has to be written knowing it.

**4. B4: the markup rate is 20 of 25 (80%) and it is NOT the T5 rate.** Two detectors, two
denominators, never averaged. **All five surviving failures are one class** — the misattributed
`source_provision_ref` described above — at 5 of 25 = 20%, against T2's 496 of 2,593 = 19.1%.
Two methods (local CLML, and live legislation.gov.uk), two samples, one rate. ⚠ Two further
first-pass failures were the *checker's* and were caught by re-examination before being recorded;
had they been published the rate would have read 18 of 25.

### Still not produced

- **B5** — `register_proposals.json` is not on disk. Not started, not improvised.
- **B6** — waits on B5.
