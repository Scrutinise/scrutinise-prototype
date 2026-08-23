# INGEST COMPLETION C2 — LANE 2 (QUALITY): stop counting things that say nothing

**Executes:** `docs/BRIEF_INGEST_COMPLETION_C2.md` Lane 2 · **Written:** 2026-08-23 08:54 UTC
**Charlie's decisions taken this session:** et-decisions on C1's reduced scope (re-fetch 503, not
131,654) · BAILII dropped, Lane 3 to be the tribunal chambers plus a UKHL scope · Lane 2 driven
end-to-end first.

**Artefacts:** `docs/census/C2_L2_baseline.json` · `C2_L2_dotleaders.json` · `C2_L2_item8_lords.json` ·
`C2_L2_item9_legacy.json` · `C2_L2_et_refetch_list.json` · `C2_L2_purge_plan.json`
**Code:** `scripts/ingest/c2/*.ts` (all read-only bar `l2-recensus-eu.ts`, which only inserts, and
`l2-purge.ts`, which is dry-run by default) · one fix in `scripts/ingest/shared/compile.ts`.

---

## ⚠ THE BRIEF'S NAMED INPUT DOES NOT EXIST — SECOND SPRINT RUNNING

`docs/SCRUTINISE_CORPUS_REGISTER_v4.xlsx`, the brief's "read first", is not in the repository,
tracked or untracked. C1 hit the same thing with four of its five named inputs.

Unlike C1, the underlying data was found elsewhere and reconciles **exactly**:

| the brief's figure | where it actually lives | reconciles |
|---|---|---|
| 1,255 organisations; 348 live / 590 closed / 300 exempt / 16 joining | `docs/QUANGO_UNIVERSE.csv` | ✓ exactly |
| 162,004 relevant GOV.UK documents | same file, summed | ✓ exactly |
| 1,761 statutory-guidance documents | same file, summed | ✓ exactly |
| the Master Register | `docs/CORPUS_REGISTER_V31.csv` (C1's A2, 91 collections) | — |

**Lane 5 is therefore not blocked.** The workbook is a presentation layer over data we hold. But
the pattern is now twice-confirmed and worth naming: *a brief that names a workbook as its
authority, when the authority is a CSV in the repo, spends the first hour of every sprint proving
the two are the same.*

---

## THE HEADLINE, IN PLAIN ENGLISH

**What a user would have seen.** Ask Lex about a retained EU provision and get back a document
whose entire body is `Article 31 . . . . . . . .` — a provision that has been removed, presented
as though it were the law. Ask about an employment tribunal case and get a GOV.UK landing *page*
about the decision rather than the decision. Ask a written-answer question and be answered from a
143-row collection in which every busy month is silently missing everything after the 5,000th
answer.

**What was actually wrong.** Four separate defects, none of which a section count can see:

1. A guard that was defeated by the word `Article`, so 70,430 dead provisions were never marked.
2. Retirement that set a boolean and deleted nothing, so 28,629 sections kept answering.
3. Collections whose *unit* is a date range rather than a document — a month of answers stored as
   one section, capped at the API's page size.
4. Collections that hold the page *about* the document instead of the document.

**What we did.** Fixed the guard in the shared helper and re-ran the census (+70,430, measured
against a prediction made first). Proved the last open duplicate pair on the item. Confirmed the
legacy-table question independently. Staged the three-layer purge, reversible, dry-run proven.

---

## ITEM-BY-ITEM

### Item 4 — dot leaders. **The brief's premise was wrong, mine was wrong twice, and the census undercounts by 28%.**

The brief asks to flag "the ~178,826 **one-word** legislation sections". Measured: their **median
`wordCount` is 33**, and 178,650 of 178,826 have fifteen words or more. Reading twelve bodies out
of R2 rather than trusting the number settled it — every one is a section number followed by
thirty-two dots. **The tokeniser counts each `.` as a word.**

That generalises, and it is the more useful half:

> **`et-decisions` sits at a median of 18 words and dot leaders at 33. Both of the two largest
> hollow collections in the corpus clear the playbook's "under 15 words" floor by construction.**
> The §22 hollow-unit instrument is systematically blind to the defect it was written to find.

Then the real finding. `shared/compile.ts::isRepealedPlaceholder` ended:

```ts
return !/[A-Za-z]{2}/.test(t)           // no word of two or more letters anywhere
```

`retained-eu` renders a removed provision as `Article 31 . . . .` rather than the bare
`31 . . . .` every other collection uses, and `Article` is a word of two or more letters. The V36
census therefore printed, in its own summary:

```
[census]   regional                   56659/336425   16.84%
[census]   primary-acts-pre-2000      35606/165746   21.48%
[census]   si-pre-2010                33953/446946    7.60%
[census]   retained-eu                   27/194537    0.01%   ← printed, never read
```

**A rate three orders of magnitude below its neighbours is not a fact about EU law.** That line sat
in the run's output for eleven days.

**Two corrections to my own work, both caught by checking rather than by reasoning:**

- I claimed the census had also stalled — cursor `si-pre-2010:uksi/2009/994:article-2`, 1,563,090
  of 1,780,445 read. **Refuted:** zero rows sit beyond that cursor. It read 1,563,090 against
  1,592,948 *censusable* rows today; the difference is drift since 12 August, not a stall. The
  1.78M figure counts rows the census's own filter excludes.
- My first detector — "a run of 20+ periods" — **over-flagged, and its own control caught it.**
  A dot run appears in two very different things: a whole-body dot leader (`Article 31 . . . .`,
  says nothing) and a **partially repealed section** (`4 1 . . . a traffic regulation order shall
  not be made with respect to any road…`, where subsections have been removed and the rest is live
  law). Counting the second as hollow would have dropped real law out of the usable-text count.
  The fix strips **one leading label**, not every word.

**The prediction, then the measurement** (playbook: predict before the run):

| | predicted | measured |
|---|---:|---:|
| retained-eu rows that are dot leaders | 35.4% ±4.19 | **35.37%** |
| further dot leaders found | ~70,516 | **+70,430** |

Off by 86 rows, 0.12%.

| | before | after |
|---|---:|---:|
| `section_repeals` total | 178,826 | **249,256** |
| of which `retained-eu` | 27 | **70,457** |

The census's 178,826 was an **undercount of 28.3%**. Nothing was missed in the other five
legislation collections — 0% in a 500-row sample of each, which is what you would expect, because
none of them uses a label. That is a sample, not a proof, and is recorded as such.

**Also surfaced, and nobody has counted it: ~35,895 partially-repealed sections** — a dot run
alongside live law. Lex can quote a subsection that no longer exists, and today nothing marks it.

**The fix is in the shared helper**, with the test failing first (playbook §21.4). Fixtures are
real bodies read out of R2, not invented ones:

```
FAIL  case 5  expected hollow=true, got false     ← retained-eu:eur/2006/952:article-31
FAIL  case 6  expected hollow=true, got false     ← retained-eu:eudn/2007/643:annex-article-32
FAIL  case 7  expected hollow=true, got false     ← retained-eu:eudn/2009/582:article-1
4 passed, 3 failed
```
after: `7 passed, 0 failed`, and the existing 14-case V36 guard test still passes 14/14 — including
its own dangerous near-miss, `5A . . . as amended . . .`, which must NOT match and does not.

**Still open:** the exclusion itself. `section_repeals` is *annotated* onto every search result
already (SURFACE 1, through the gateway, so no caller can forget) but repealed sections are still
**counted as usable text** and still **returned as answers**. That wiring is the remaining half of
item 4 and is not done.

---

### Item 1 — `et-decisions`. C1's reduced scope reproduces exactly.

| | rows | median words |
|---|---:|---:|
| `format='html'` — GOV.UK landing pages | **131,650** | 18 |
| `format='pdf'` — the real decisions | 161,749 | 159 |

Landing pages covered by a held PDF under the same `parentDocId`: **131,147**. With nothing behind
them: **503**. C1 predicted 131,147 / 503 — **reproduces exactly.** The 503 are written to
`docs/census/C2_L2_et_refetch_list.json` **before** anything is deleted, because they are the only
thing the deletion destroys a pointer to. Every one of the 161,749 PDF rows carries its own title
and date, so no case name is lost.

Deletion staged, not executed — see *The purge* below.

---

### Item 2 — the three retired collections. R9, confirmed, and one of them is worse than stated.

| collection | rows | words | verdict |
|---|---:|---:|---|
| `lda-lordswrittenquestions` | 20,500 | 1,072,407 | retired 
| `lda-commonswrittenquestions` | 8,000 | 402,315 | retired |
| `written-statements` | 129 | 852,742 | retired — **and a whole-file defect** |

`written-statements` is 6,610 words a row, which does not look hollow at all. Reading it settled
what a count could not: **the id is a date range** — `written-statements:2025-06-01:2025-06-30:1`
— one section per *month*, with separate ministerial statements joined by ` --- `, fetched from
`questions-statements-api.parliament.uk` with `madeWhenFrom`/`madeWhenTo`. Meanwhile
`pwdata-wms` (24,962 rows, 428 words each) and `pwdata-lordswms` (21,463) hold the same material
properly split, one statement per row.

So it is a duplicate **and** a unit error, and deleting it loses nothing. That is worth saying
explicitly, because "delete a collection holding 852,742 words" deserves more than a retired flag
as its justification.

---

### Item 5 — `written-answers`. **Do not re-split it. It is a truncated duplicate.**

The brief says: *"143 rows at ~306,000 words each. Whole files are stored as single sections.
Re-split into one section per answer."* The first two sentences are right. The instruction is not.

Same shape as `written-statements` — `written-answers:2018-05-31:2018-06-30:1`, one row per month
from the Parliament API. But counting the separators found something the brief did not:

```
written-answers:2020-06-30:2020-07-31:1  wc=391211  answers=5000   ← exactly 5,000
written-answers:2020-04-30:2020-05-31:1  wc=388868  answers=5000   ← exactly 5,000
…
10 of 10 sampled rows sit exactly on 5,000 answers.
```

**5,000 is the API's page size, not a month.** Every busy month is silently missing everything
after the 5,000th answer. Re-splitting the stored text would faithfully reproduce the truncation
one row at a time.

And it is unnecessary: **`pwdata-wrans` holds 1,235,281 written answers at one answer per row,
spanning 2001-06-21 → 2026-08-21**, plus `pwdata-lordswrans` at 176,131. `written-answers` covers
2014-05-31 → 2026-05-31 — wholly inside that span.

▶ **Recommendation: retire `written-answers` with the other three rather than re-split it.**
143 rows, 43.7M words, capped, and already held properly split at ten times the granularity.

---

### Item 6 — `building-regs`. **There is no PDF to extract from. One was never fetched.**

The brief says: *"PDF text is not being captured. Fix extraction, re-fetch."* Measured: **all 21
rows have `format = null`** — not `pdf`, not a failed extraction — and every body is the text of
the GOV.UK **publication landing page**:

```
building-regs:…access-to-and-use-of-buildings-approved-document-m:1   format=null  wc=1024
  "Statutory guidance  Access to and use of buildings: Approved Document M  Building regulation
   in England to ensure that people are able to access and use buildings…  From: Ministry of…"
```

This is the **same defect as `et-decisions`**: we hold the page *about* the document. The Approved
Documents themselves are PDFs linked from those pages and were never fetched, so there is no
extraction to fix. The work is a fetch that follows the link — a different job, correctly scoped
only once you look at `format`.

The brief's licence note stands and should be carried into the answer: Approved Documents
incorporate BSI standards by reference, which we cannot hold, so a retrieval answer must say so
rather than imply completeness (playbook L6).

---

### Item 7 — `senedd-cofnod`. **Already fixed in the shared parser by another sprint; the data has not been re-parsed.**

`scripts/ingest/sources/senedd-cofnod.ts` carries an uncommitted fix (+90/−13) from the
INGEST-LABELS stream, and it is the right fix in the right place — the shared parser, not per
caller, as the brief requires. Its own header records the mechanism: `agendaItem` was not in the
heading branch so it fell through and was stored as a speech, and the running `subHeading` was
never reset when the agenda moved on, so every speech under an agenda item with no sub-headings
inherited the previous item's last sub-heading. Measured at 1,609 of 2,915 contributions wrong
(55.2%) over twelve plenaries.

**The data still carries the old headings.** Measured today: 117,231 of 191,756 speeches
(**61.1%**) sit in their session's single largest heading block — reproducing C1's figure exactly.
The remaining work is a re-parse of 191,756 rows, not a code change.

The Welsh-language question (≈95% of a 40-row sample has Welsh bodies, unreachable from an English
query) is a product decision and is left for Charlie, as the brief directs.

---

### Item 8 — duplicate pairs. **The pair C1 left open is now proved, at 99.9%.**

C1 resolved three of four. The fourth, `lda-lordsdivisions` / `lords-divisions-votes`, it recorded
as *"not proved by text query (median 8 words); structural duplication likely, unmeasured"*. A
structural join failed too — **`itemDate` and `sectionTitle` are NULL on all 2,089 rows.**

They are not missing. **They are in the body and were never extracted into the columns:**

```
"Human Fertilisation and Embryology Bill [HL] Date: 2008-01-21 UIN: LD:2008-1-21:3"
```

A collection whose date lives only in its prose is invisible to every date-scoped query, every
freshness check and every duplication test in the register — which is exactly how this pair stayed
unresolved through two sprints. Parsed out of the body, the join is trivial:

| | |
|---|---:|
| rows parsed (title + date recovered from the body) | 2,089 / 2,089 — **0 unparsed** |
| date range recovered | 1999-11-24 … 2017-04-27 |
| whose date also appears in `lords-divisions-votes` | 2,088 |
| matching on **date AND title** — the item-level test | **2,087 (99.9%)** |

Concrete duplicated divisions:

```
2017-03-27  "Technical and Further Education Bill"
   lda-lordsdivisions:713960:1   ←  8 words
   lords-divisions-votes:2091:1  ←  full division with vote lists
2017-04-05  "Higher Education (Basic Amount) (England) Regulations 2016 …"
   lda-lordsdivisions:717890:1
   lords-divisions-votes:2099:1
```

**DUPLICATED — and the duplicate is the poorer copy**: median 8 words against 1,972.

All four pairs are now resolved:

| pair | verdict |
|---|---|
| `historic-hansard` / `pwdata-debates` | NOT duplicated (C1 — 0 shared sitting days, they abut) |
| `lda-commonsdivisions` / `commons-divisions-votes` | DUPLICATED (C1 — item-level proof) |
| `uk-treaties` / `uk-treaties-fcdo` | DUPLICATED (C1 — and twice within `uk-treaties-fcdo` alone) |
| `lda-lordsdivisions` / `lords-divisions-votes` | **DUPLICATED — 2,087 of 2,089, this sprint** |

⚠ `lda-lordsdivisions` (2,089) and `lda-commonsdivisions` (5,553) are now both proved duplicates of
a richer collection and are the obvious next candidates for the purge. **They are reported, not
removed** — the brief does not authorise it, and a proof is not an instruction.

---

### Item 9 — the legacy table. **A7 confirmed independently, and refined.**

The brief: *"Report how many are in neither. That one number decides whether 914,274 sections
matter or are a duplicate."*

A7's answer is **29 instruments / 211 legacy sections**. Its own first run said 1,579, so it was
re-derived here from scratch rather than quoted. **The re-derivation reproduced the failure first,
which is what makes it a verification and not a restatement:**

| identity map used | "in neither" |
|---|---:|
| `type/year/number` and the legacy row's own id | **1,574** ← reproduces A7's wrong first answer |
| + calendar→regnal map from the full source walk | 0 |
| + "held" restricted to rows with **compiled text** | **29** ✓ matches A7 |

Two distinct traps, and each moves the answer by orders of magnitude:

- **Identity.** An Act before 1963 is held under its regnal citation (`ukpga/Geo4/5/83`, not
  `ukpga/1824/83`), so every pre-1963 Act reads as absent. The map has to come from the full
  source walk; the worklist holds absences only, which is exactly how A7 went wrong first.
- **"Held" is two different sets.** Counting rows with `status='unavailable'` as held gives 0.
  Those rows record that we *looked*, not that we have text. This is R8 in a new place.

**Verdict: duplicate.** 127,417 of 127,790 legacy instruments (99.7%) are already in
`corpus_sections` with text, 344 are on the V36 worklist, and 29 are neither — 211 sections.

⚠ **Refinement A7 did not make:** of those 29, **5 carry an explicit `:unavailable` row** —
`uksi/1988/742`, `uksi/2022/852`, `uksi/1996/3021`, `uksi/2026/368`, `uksi/2023/655`. For those
five the source has already been asked and returned nothing, while legacy holds text. The standing
"re-fetch, do not migrate" decision **cannot succeed** for them; migration is the only route. It is
five instruments, so this changes little — but it is the one place in the whole legacy table where
the standing decision is not merely lower-value but impossible.

---

### Item 3 — `tna-caselaw` stylesheet. **NOT DONE.**

74,896 judgments, 656.8M words, 8,769 words a row. The re-embed is ~$31 on batch and needs the
`vec-replace.ts` path built in S12. Not started this session; no money spent.

---

## THE PURGE — staged, reversible, dry-run proven, NOT executed

`scripts/ingest/c2/l2-purge.ts`. Auto mode does not execute production deletes, so this is built
to be handed over as one command.

```
DRY RUN — nothing will be written. Pass --execute to perform.
── et-decisions-landing       rows now: 131,650  (expected 131,650) ✓ matches   2,941,258 words
── retired-lda-lords-wq       rows now:  20,500  (expected  20,500) ✓ matches   1,072,407 words
── retired-lda-commons-wq     rows now:   8,000  (expected   8,000) ✓ matches     402,315 words
── retired-written-statements rows now:     129  (expected     129) ✓ matches     852,742 words
DRY RUN — 160,279 rows staged across 4 collections. Nothing was written.
```

Every one of the four matches its expected count exactly.

**Retirement is a three-layer operation — the target, the rows, the vectors — and doing one of the
three is the whole defect R9 describes.** The script does the target and the rows; it writes the
id list for the vector and FTS layers keyed off the *same* manifest, so the layers cannot drift.

Safety properties, each of which is in the script rather than in this document:

- **Reversible.** Every row is written to a manifest with **full column values**, on disk and to
  R2, before anything is deleted. R2 bodies are never deleted, so the text survives regardless.
- **Guarded.** The delete re-counts *inside* the transaction and aborts if the count has moved
  since staging, and aborts again if `DELETE` touches a different number of rows than the manifest
  holds.
- **Transactional per collection**, so a failure part-way cannot leave a half-deleted corpus.

▶ **One command, when you want it:**

```
cd scripts/ingest && NODE_OPTIONS=--no-network-family-autoselection \
  ./node_modules/.bin/tsx c2/l2-purge.ts --execute
```

Then the vector/FTS layer from the emitted `*.ids.txt` files. **If `written-answers` is retired on
the recommendation above, add it to `TARGETS` first** — it is deliberately not in there, because
the brief asked for a re-split and this report is asking you to overrule that.

---

## SOLVED / NOT SOLVED / NEXT

**Solved (measured, artefact on disk).** The dot-leader guard, fixed in the shared helper with a
failing test first, and the census re-run: +70,430, against a prediction of ~70,516 · the
hollow-unit instrument's blindness to punctuation, and why both of the two largest hollow
collections clear its floor · the fourth duplicate pair, proved on the item at 99.9%, and *why*
two sprints could not prove it · the legacy-table question, confirmed independently at 29/211 by
reproducing both failure modes first, plus the 5 instruments where the standing decision cannot
work · `written-answers` as a **capped** duplicate rather than a splitting job · `building-regs`
as a landing-page fetch rather than a PDF-extraction failure · the 503 et-decisions re-fetch list,
reproducing C1 exactly · the purge, staged and dry-run proven against all four collections.

**Not solved / not attempted.** Item 3 (`tna-caselaw` stylesheet re-embed, ~$31, unspent) · item
4's *exclusion* wiring — repeals are annotated but still counted as usable text and still returned
as answers · item 7's re-parse of 191,756 senedd rows (the parser fix exists; the data does not
have it) · item 6's actual PDF fetch · item 1's 503 re-fetch · the purge execution and its
vector/FTS layer · **Lanes 0, 1, 3, 4, 5, 6, 7 in their entirety.**

**Next.** Execute the purge and its index layer · wire the repeal exclusion · then Lane 1, which
C1 has already re-costed at ~91,500 sections and $1.33.

---

## DECISIONS FOR CHARLIE

**1. Retire `written-answers` (143 rows, 43.7M words) instead of re-splitting it?**
Every sampled row sits on exactly 5,000 answers — the API's page size — so the stored text is
truncated for every busy month, and `pwdata-wrans` already holds 1,235,281 answers one-per-row
across a wider span.
▶ **Recommend: retire it with the other three.**
*Consequence otherwise:* we spend the re-split effort faithfully reproducing a truncation, and end
with a second, worse copy of a collection we already hold.

**2. Also purge `lda-lordsdivisions` (2,089) and `lda-commonsdivisions` (5,553)?**
Both are now proved duplicates of richer collections — Lords at 2,087 of 2,089 on date and title
this sprint, Commons item-level by C1. Median 8 words against 1,972.
▶ **Recommend: yes, in the same run.** Not included today because the brief does not authorise it.
*Consequence otherwise:* 7,642 metadata-only stubs keep competing with the full divisions for the
same result slots.

**3. Item 4's exclusion — suppress repealed sections, or only label them?**
All 249,256 are annotated in every search result today (SURFACE 1). They are still counted as
usable text and still returned as answers.
▶ **Recommend: exclude whole-body dot leaders from usable-text counts and suppress them as an
answer; keep the ~35,895 partially-repealed sections retrievable and labelled**, because those
carry live law. The two must not share a rule — that distinction is exactly what my own first
detector got wrong.
*Consequence if suppressed together:* live law disappears from retrieval. *If neither:* a user is
shown `Article 31 . . . .` as the answer to a question about EU law.

**4. `building-regs` — fetch the Approved Document PDFs now, or scope first?**
21 rows, all `format=null`, all landing pages. This is a fetch that was never attempted, not an
extraction to repair.
▶ **Recommend: fetch now — it is 21 documents** — and carry the BSI boundary into the retrieval
answer per L6.

**5. The register.** `SCRUTINISE_CORPUS_REGISTER_v4.xlsx` does not exist and its data lives in
`QUANGO_UNIVERSE.csv` and `CORPUS_REGISTER_V31.csv`.
▶ **Recommend: name those two as the authority in the next brief**, or generate the workbook from
them once and keep generating it.
*Consequence otherwise:* every sprint opens by proving the workbook and the CSVs are the same
thing.
