# INGEST — IMPACT ASSESSMENTS: §1 AUDIT REPORT

*Executes `docs/BRIEF_INGEST_IMPACT_NUMBERS.md` §1 in full. **§2, §3 extraction and §4 linkage are NOT
built** — the brief gates them on this report ("▶ Report §1 before building §2"), and §1 found four
things that change the sprint's shape.*

*2026-09-07 · INGEST · everything below is measured against the live Neon corpus and the live
publisher, not inferred. Artefacts: `docs/census/IMPACT_1_retention.json`, `IMPACT_2_layout.json`,
`IMPACT_3_pir.json`, `IMPACT_4_probe.json`, `IMPACT_5_columns.json`, `IMPACT_6_duplicates.json`,
`IMPACT_7_dupcause.json`, `IMPACT_feed_meta.json`, and three documents read end to end in
`docs/census/impact_samples/`.*

---

## THE HEADLINE, IN FOUR LINES

1. **§1.1 retention is not the blocker. Proceed.** 50 of 50 sampled assessments re-fetched from
   source; **every one of 6,288 £ figures and 47,709 of 47,718 numeric tokens survived ingest**, and
   **29 of 29 assessments that have an annex at source have it in what we hold.** This is not
   GRAPH 4B's 41.3%.
2. ⚠⚠ **The brief's §0 is out by a factor of ~16. We hold 1,169 impact assessments, not 18,700** —
   and only **869 distinct documents**, because 463 ids share a body. 18,756 is the **section** count.
   The sharing is verified genuine publishing, not an ingest fault — checked by hashing the
   publisher's own PDFs — but it carries an attribution trap of its own (§1.2).
3. ⚠⚠ **The brief's §3 is out by a factor of ~14 in the other direction. There are 73 post-
   implementation reviews, not ~1,000.** The ~1,000 sections titled "Post-implementation review" are
   our own sectioner firing on the proforma *question* "Will the policy be reviewed?", asked of every
   measure. Counting those as reviews is the exact substitution §3 forbids.
4. ⚠⚠ **The layout is stable in MEANING and unstable in SURFACE, and that inverts §2's design.** A
   positional parse — "take the third number after the heading" — returns a confidently wrong figure
   with no error on documents I have hand-read. §2 must assign **by label**, and refuse.

**Recommendation: proceed to §2, with the extractor redesigned as §2-DESIGN below. Do not build the
regex-per-field pass the brief's §2 table implies.**

---

## §1.1 — DID THE ANNEXES SURVIVE INGEST?

**Yes. Comprehensively.** Method: 50 assessments sampled `ORDER BY md5(...)` (never `ORDER BY id` —
ukia ids begin with the year, so id-order draws one year); for each, the source PDF re-fetched from
the link **read off the item page, never constructed**, re-extracted, and compared against the
concatenated R2 bodies we hold.

| measure | result |
|---|---|
| source fetched | **50 / 50** — nothing skipped, so nothing is excused |
| bulk text, held ÷ freshly-extracted source | **median 99.1%**; 0 under 90%, 0 over 110% |
| **£ figures surviving** | **6,288 / 6,288 = 100.0%** |
| **all numeric tokens surviving** | **47,709 / 47,718 = 100.0%** (9 lost across 50 documents) |
| summary sheet, held ÷ present at source | 44 / 44 = **100%** |
| evidence base | 42 / 42 = **100%** |
| **annexes** | **29 / 29 = 100%** |
| PIR / review section | 44 / 44 = **100%** |
| costs table | 48 / 48 = **100%** |

⚠ **Two honesty notes on this table, because a 100% is exactly when to look harder.**

- **The bulk and figure comparisons are same-tool.** Ingest extracted with `pdfToText`; so did this
  audit. That comparison can only catch the pipeline *losing* text it had — truncation, dropped
  sections, a sectioner that silently discarded a part. It cannot catch a fault in `pdfToText`
  itself. It is still the right test for the question §1.1 asks ("did the annexes survive **ingest**")
  and it answers it: nothing was lost between the PDF and R2.
- **The table-structure metric is reported as NOT MEASURED, not as a pass.** It found a
  label-plus-cells table row in only 4 of 50 documents (13 of 29 rows intact). The reason is not a
  defect in our ingest: **`pdfToText` flattens a PDF table into a header block followed by loose
  cells on their own lines, at source exactly as in what we hold.** No line carries a label *and* its
  numbers. A metric whose denominator is near zero proves nothing, and is written up as such.

**That last point is not a footnote — it is the finding that §2 turns on**, and it is set out in
§1.2 below.

---

## §1.2 — WHAT IS ACTUALLY ON THE PAGE

Three assessments read end to end as the brief asks (`ukia/2019/64` mid-size, `ukia/2018/132`
monetised, `ukia/2023/49` de minimis — dumped to `docs/census/impact_samples/`), then every finding
re-measured across all 1,169 held documents, because three documents establish a shape and 1,169
establish whether it holds.

### How many documents are there, really

| | |
|---|---:|
| sections in `corpus_sections` | 18,759 |
| **`ukia` ids held** | **1,169** |
| **distinct bodies (sha256)** | **869** |
| ids sharing a body | 463, in 163 groups |
| largest duplicate group | **17** (`ukia/2019/24`, `/28`…`/94`) |

⚠⚠ **Where the brief's 18,700 came from, precisely: `docs/CORPUS_SCOPE.md` lists
`impact-assessments | 18,756` in a column headed *"sections held"*.** It was read as a document
count. The same page's other rows carry the same risk.

**Is the duplication an ingest bug?** It had to be settled before anything else, because the two
possibilities have opposite consequences: genuine publishing means the copies are faithful, an ingest
fault means **up to 463 assessments hold somebody else's numbers, attributed.** The database cannot
tell them apart — and the first evidence pointed the wrong way, because every member of every group
advertises **its own distinct PDF URL** and, in the 2007 group, **its own distinct title**.

Settled by downloading the files and hashing them (`impact/audit-7-dupcause.ts`):

| group | finding | verdict |
|---|---|---|
| `ukia/2007/13`, `/20`, `/28` | **byte-identical PDF** — sha `7a617294…`, 1,092,360 bytes — served at three distinct URLs | faithful |
| `ukia/2019/24`, `/94` | two **different** PDF files (588,335 / 588,232 bytes) that extract to **identical text** — the publisher re-uploaded the same document | faithful |

**Not an ingest bug.** Held text matched a fresh extraction of each id's own PDF in 5 of 5 checked.

⚠⚠ **But it exposes a worse trap than the one it ruled out, and §2 must handle it. A title is not
the document.** `ukia/2007/13` is titled *"amending s237 Town and Country Planning Act"*, `/20`
*"granting local planning authorities the discretion to allow minor amendments"*, `/28` *"removing
requirement SPDs to undergo a sustainability appraisal"* — **fifteen different measures, one shared
375,965-character *Planning Bill* impact assessment.** The title names the measure; the body costs
the whole Bill. **Reading "the EANDCB of `ukia/2007/20`" out of that body attributes the entire
Planning Bill's figure to one sub-measure.** An umbrella figure must be attributed to the umbrella,
and the de-duplication key is the **body hash** — never the title, and never the id.

### Coverage against the publisher

| | |
|---|---:|
| `ukia` deposits legislation.gov.uk publishes | 1,186 |
| held | 1,169 |
| **at source, not held** | **17 (1.4%)** — 2005:1 2007:1 2017:2 2018:4 2020:2 2023:2 2026:5 |
| held but not in any year feed | 0 |

⚠ **The 2008–2016 and 2024–2025 gaps were re-probed live and are still real at source** — every one
of those eleven year-feeds returns 0. The `UKIA_YEARS` constant in
`scripts/ingest/sources/impact-assessments.ts` is not stale. It is a hardcoded list, though, so
`impact/feed-meta.ts` now re-probes the excluded years on every run and prints a loud line if any
gains deposits.

### Is the layout stable?

**Across templates — mostly, and it degrades sharply and recently.**

| template family | held | share |
|---|---:|---:|
| IA proforma (summary sheet) | 1,013 | 86.7% |
| PIR template | 126 | 10.8% |
| de minimis / no-IA note | 104 | 8.9% |
| NI regulatory screening | 20 | 1.7% |
| **none of the above (free prose)** | **60** | **5.1%** |

⚠⚠ **The trend is the finding, not the average:**

| year | held | proforma | EANDCB label | COSTS (£m) block | RPC opinion in-doc |
|---|---:|---:|---:|---:|---:|
| 2017 | 169 | 97.0% | 86.4% | 96.4% | 87.6% |
| 2018 | 180 | 97.2% | 87.2% | 97.2% | 94.4% |
| 2019 | 165 | 96.4% | 67.3% | 97.0% | 89.1% |
| 2020 | 101 | 91.1% | 87.1% | 79.2% | 77.2% |
| 2021 | 92 | 89.1% | 93.5% | 82.6% | 76.1% |
| 2022 | 108 | 85.2% | 87.0% | 75.0% | 75.0% |
| 2023 | 187 | 78.1% | 73.8% | 71.1% | 77.5% |
| **2026** | **129** | **51.9%** | **57.4%** | **33.3%** | **38.8%** |

**The template is being abandoned, and 2026 — the year Charlie's forward-looking question needs
most — is the worst-covered year in the collection.** Extraction rates will be highest exactly where
the material is oldest.

### Where the headline figures sit — and why a regex will get them wrong

The summary sheet is **not a table in the extracted text**. It is a header *block* followed by a
value *row*. Verbatim, from `ukia/2018/132`:

```
Cost of Preferred (or more likely) Option
Total Net
Present Value
Business Net
Present Value
Net cost to business per
year (EANDCB in 2014 prices)
One-In,
Three-Out
Business Impact Target
Status

-£54m -£0.1m £0.01m Not applicable Not a regulatory provision
```

Five column names, wrapped mid-phrase across nine lines; then every value on one line. **"Find the
label, take the number after it" returns the price year 2014 as the EANDCB.** The figures can only be
recovered by pairing the header block with the value row.

⚠⚠ **And they cannot be paired by counting from the left.** Hand-read, from the documents:

| document | what it does |
|---|---|
| `ukia/2017/13` | canonical: `£41.38m £41.38m -£4.73m No Non qualifying provision` |
| `ukia/2021/16` | **EANDCB alone — no NPV columns at all.** "…(EANDCB in 2019 prices) Nil £m Nil" |
| `ukia/2023/159` | **BIT status moved INTO the header**, 3 cells against 5 canonical columns, a **range** in cell 1 and a minus *inside* the £: ` £300-£500m £-120m £8.4m` |
| `ukia/2017/124` | **`EANCB on 2014 prices`** — the department's own typo — and **bare numbers with no £ at all**: `-1.17 -9.29 1.0 Qualifying provision` |
| `ukia/2017/103` | value row is **`0 0 0 In scope In scope`** — three bare zeros |
| `ukia/2026/90` | **no `Cost of Preferred Option` anchor at all** |

Measured over all 1,169:

| | |
|---|---:|
| carry the `Cost of Preferred Option` anchor | 911 (77.9%) |
| distinct header orderings | **12** |
| the canonical 5-column ordering | 419 — 46.0% of anchored, **35.8% of all** |
| canonical + the 4-column variant without OI3O | 751 — **82.4% of anchored** |

⚠ **One correction I have to make against my own first measurement, because the gap between the two
numbers is itself the lesson.** The first version of this detector reported **27 orderings and 72.8%
mismatched**. I hand-read four of those mismatches and **all four carried the full canonical five
columns**: the PDF justifies the headings, so the same label arrives as `Business Net Present Value`,
`Business   Net\nPresent Value` and `Business    Net  Present  Value`, and a literal regex reads one
document as three. Normalising whitespace before matching took 27 orderings to 12 and canonical
coverage from 19.0% to 35.8%. **The corpus was more regular than the reader.** The residual mismatch
(~72%, cell-count against label-count) is still detector-sensitive and is **not** quoted here as a
property of the documents — it is quoted as the reason §2 must never count from the left.

### The two remaining §1.2 questions, answered

**How many are the standardised format versus free prose?** 86.7% proforma, 5.1% free prose, the
rest PIR / de minimis / NI-screening templates. See the year table for the trend that matters more.

**Is the RPC opinion in the document or published separately?** **In the document, 76.0% of the
time** (889 of 1,169) — but the verdict vocabulary is not one scale:

| verdict as published | n |
|---|---:|
| green | 293 |
| not applicable | 210 |
| n/a | 146 |
| fit for purpose | 65 |
| awaiting scrutiny | 34 |
| **"choose an item"** | **8** |

⚠ Two scales are mixed — **green/amber/red is the current RPC rating and "fit for purpose" is the
one it replaced** — and 356 are non-verdicts that must be stored as *declared not applicable*, never
as missing. ⚠⚠ **"choose an item" is an unfilled Word dropdown**: eight departments published the
template placeholder. A field extractor that trusts the text would record that as an RPC opinion.

**And the two other RPC/IA routes the source module documents are NOT ingested.** Every held row is
`legislation.gov.uk/ukia/…`; **gov.uk's 1,932 `impact_assessment` documents and the Regulatory Policy
Committee's 826 documents have never been fetched.** They are decision 3 below.

---

## §3 — POST-IMPLEMENTATION REVIEWS: THE PREMISE IS INVERTED

**The brief:** *"Roughly 1,000 review sections sit inside the impact assessment collection,
distinguished by section title."*

**Measured:** a section titled `Post-implementation review` exists on **1,052 of 1,169** held
assessments (90.0%) — because that title is **our own sectioner** matching the proforma question
*"Will the policy be reviewed?"*, which is asked of every measure and answered by most with a date or
a "No". The publisher's own `ukm:DocumentStage` — which ingest **did not store**, and which
`impact/feed-meta.ts` now recovers — says:

| `DocumentStage` | deposits |
|---|---:|
| Final | 1,095 |
| **Post Implementation** | **73** |
| Enactment | 12 |
| Consultation / Options / Implementation / none | 6 |

**73 at source; 71 held (97.3%).** Distinguishing a review by section title would turn 73 reviews
into 1,052 — *"the government promised to review this in 2024"* rendered as *"the government reviewed
this"*. That is the §3 substitution, one level down from where §3 warns about it.

Separating the three facts the one title conflates, over all 1,169:

| | n |
|---|---:|
| **A. the deposit IS a review** (publisher's stage) | **71** |
| B. the body reports FINDINGS (outcome language) | 67 |
| C. the body PROMISES a review (clause / future tense) | 567 |
| — of which a due **year** is stated | 232 |

⚠ **B is not usable as a classifier and is reported as such.** Of the 71 the publisher calls a
review, my outcome-language detector fires on **18** — 25% recall — while firing on 49 documents the
publisher calls `Final`. **Use `DocumentStage`. Do not infer a review from the prose.** That
recommendation is the whole of what this measurement is for.

### The overdue count — §3 calls it "itself a finding", and it is

Of held assessments that promise a review, state a due year, and name their instrument (**231**):

| | n | |
|---|---:|---:|
| a `Post Implementation` deposit exists for that instrument | **2** | **0.9%** |
| **due year has passed and no review deposit exists** | **196** | **84.8%** |

Due years: 2019:20 2020:24 2021:27 2022:24 **2023:35** 2025:40 2026:11 2027:7 2028:21 …

⚠ **Stated at its true strength and no higher: "no review deposit on legislation.gov.uk" is not "no
review was done."** A post-implementation review can be published on gov.uk alone, and gov.uk is one
of the two un-ingested routes. **This number is a floor on the gap and cannot be quoted as the
answer** until decision 3 is taken. That is the honest form of the most valuable sentence the
platform can produce, and it is worth more than a wrong precise one.

---

## §2-DESIGN — WHAT §1 SAYS THE EXTRACTOR MUST BE

Not built. Specified here so the decision below is a real choice.

1. **Read the whole document, never a section.** ⚠ The headline table is **split across section
   boundaries**: in `ukia/2018/132` the labels *Total Net Present Value / Business Net Present Value*
   sit in the `RPC opinion` section and their values `-£54m -£0.1m £0.01m` in the `Costs and benefits`
   section. A per-section extractor gets headers without values, or values without headers.
2. **Assign by LABEL, never by ordinal, and REFUSE on a mismatch.** 12 header orderings; documents
   with 5 labels and 2 cells and with 1 label and 5 cells both exist. A fixed-ordinal reader does not
   fail on those — it returns the wrong figure under the right field name.
3. **Normalise whitespace before matching anything.** Demonstrated above: it moved a headline number
   by 17 points and it was *my* error, not the corpus's.
4. **A bare number is a unit-less number.** `-1.17 -9.29 1.0` is a real value row. Reading it as £m
   when it is £ is a factor of a million. Where the unit is not attached to the figure or stated in
   the header, the row is **unparsed**, not guessed.
5. **Unparsed ≠ zero ≠ declared-N/A.** Three distinct states, three distinct stored values. 160
   documents declare `N/A` for total NPV; storing those as 0 would be a lie with a number on it.
6. **Price base year is per FIGURE, not per assessment.** Of 173 documents stating both a
   `Price Base Year` and an `EANDCB in YYYY prices`, **153 (88.4%) disagree** — the EANDCB is quoted
   on the Business Impact Target baseline while the NPV is in the appraisal's own prices. One
   `priceBaseYear` column per row would silently mis-uprate 88% of them.
7. **Assert the sign convention with a worked example in both directions.** Of 296 EANDCBs parsed in
   the feasibility probe, **63 (21.3%) are negative — a net benefit to business** and 233 positive.
   Both directions are present, so a sign bug would be **invisible in any total** and would invert 63
   measures. `ukia/2018/132` (`£0.01m`, a cost) and `ukia/2017/13` (`-£4.73m`, a benefit) are the two
   worked examples; both are in `docs/census/impact_samples/`.
8. **Provenance on every field.** `probe-extractable.ts` already records the verbatim substring each
   value was read from; that stays a hard requirement, not a nice-to-have.
9. **De-duplicate on the body hash, and attribute an umbrella figure to the umbrella.** 463 ids share
   a body with another id; the largest such body covers 15 separate Planning Bill measures under 15
   separate titles. Extract once per distinct body, keep every id and instrument link pointing at it,
   and record that the figure is Bill-level — never measure-level — when the body is shared.

**Feasibility, from the probe (`docs/census/IMPACT_4_probe.json`) — these are FLOORS on a thin
detector, not forecasts:** summary value row located on 671/1,169 (57.4%); of those, total NPV parsed
73.5%, business NPV 62.4%, EANDCB 44.1%. Price base year 51.9% of all; RPC verdict 45.1%;
non-monetised benefits captured as text 66.2%.

---

## WHAT IS NOT DONE, NAMED

- **§2 extraction — not built.** No field table exists; nothing has been written to any database.
- **§3 review extraction and linkage — not built.** The 71 reviews are identified, not read.
- **§4 chain (assessment → review → NAO / PAC / independent review) — not built, and not scoped.**
  ⚠ It cannot be scoped honestly until decision 3 is taken: `nao-reports` (2,570) and
  `independent-reviews` (657) are held, but the review side of the chain is missing its gov.uk half.
- **The 17 deposits at source and not held** — identified, not fetched.
- **Nothing has been written to the search index**, because nothing has been extracted. When §2 runs,
  the S11 refresh path is the route, and CC-Search is told **before**.
- **No stored body was rewritten**, so no search baseline is voided.

---

## DECISIONS FOR CHARLIE

**1. Does §2 proceed on 869 documents, given the brief expected 18,700?**
*Recommendation: **yes, proceed.*** The value is per-measure, not per-row: 869 costed measures with
provenance is a real costing corpus, and the retention audit says the numbers are all there.
*Consequence of no:* the forward-looking question ("what will this cost?") has no precedent base at
all, and the review-calendar product in decision 4 is lost with it.

**2. Extractor by label with a refusal path, or a fast regex pass?**
*Recommendation: **by label, with refusal.*** ~2× the work of the regex pass.
*Consequence of the fast pass:* it will populate more rows and some will be wrong, silently, with no
signal distinguishing them — 12 header orderings and hand-verified mis-assignments say so. In a
costing table a wrong number is worse than an absent one, because the absent one asks a question.

**3. Ingest the two un-ingested routes — gov.uk's 1,932 `impact_assessment` documents and the RPC's
826 — before or after §2?**
*Recommendation: **the RPC's 826 first, gov.uk's 1,932 after §2.*** The RPC set is small, bounded, and
is the independent check on every number §2 extracts; it also carries the opinions for the 24% of
assessments that don't state one. gov.uk's set is noisy (its `impact_assessment` type includes HS2
air-quality monitoring reports) and needs its own filter.
*Consequence of doing neither:* the overdue-review count stays a floor and cannot be published as an
answer to "has this been reviewed?", because a review published only on gov.uk is invisible to us.

**4. Ship the review calendar as its own product now, or hold it for §2?**
*Recommendation: **ship it after §2, not before.*** 232 measures with a stated review due-year, 196 of
them past due with no review deposit, is a finished product on its own — but published before
decision 3 it would overstate the gap.
*Consequence of shipping now:* a headline that says Parliament broke 196 promises, when some of those
reviews exist on gov.uk and we simply have not looked.

**5. Do the 463 duplicate ids collapse to 869 rows, or stay 1,169?**
*Recommendation: **extract once per distinct body; keep every id and its instrument link pointing at
that body; and mark a shared body's figures as covering the whole umbrella.*** The duplication is
verified genuine publishing, not error, and the instrument links are exactly what §4 needs.
*Consequence of collapsing the ids away:* the instrument links go with them and §4 loses its join.
*Consequence of not de-duplicating:* a "most expensive measures" ranking lists one measure 17 times.
*Consequence of ignoring the umbrella problem:* the Planning Bill's whole cost gets attributed to
"removing the requirement for SPDs to undergo a sustainability appraisal", and to fourteen others.
