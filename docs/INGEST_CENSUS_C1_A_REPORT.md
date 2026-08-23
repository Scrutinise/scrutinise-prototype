# CENSUS C1 — PART A REPORT (audit only; nothing written to Neon)

**Executes:** `docs/BRIEF_INGEST_CENSUS_C1.md` Part A · **Written:** 2026-08-23 01:50 UTC
**Artefacts:** `docs/census/A1_target_provenance.md` · `A3_hollow_units.md` · `A4_duplication.json` ·
`A5_worklist_pilot.json` · `A5b_modern_acts.json` · `A7_legacy_overlap.md` · `docs/CORPUS_REGISTER_V31.csv`
**Code:** `scripts/ingest/census/a{1,2,3,4,5,5b,7}-*.ts` — all read-only.

**Stop point reached. Part B has not been started.**

---

## ⚠ FOUR OF THE BRIEF'S NAMED INPUTS DO NOT EXIST

`docs/CORPUS_REGISTER_V31.csv` ("the scaffold this sprint fills"), `docs/DAILY_EMAIL_V31_REBUILT.md`
("the target email, fully populated"), `docs/CORPUS_SCOPE.md` and `docs/OPEN_ITEMS.md` are not in
the repository, tracked or untracked. Consequences:

- **A2** — I defined the register's columns myself. Every `denominator_source_to_walk` value is
  **CC-proposed**, not a verification of CCh's lead, and the column needs review before Part B walks
  anything.
- **Part C** has no target format to build against. That is a blocker for C, not for A.

---

## THE HEADLINE, IN PLAIN ENGLISH

**What a user would have seen:** a daily email saying the corpus is essentially complete.
**Cause:** for 56 of 77 live collections the "target" is at or below the count it measures — it was
set *from* that count. Two collections go further and contain none of their own subject.
**Fix:** Parts B and C (real denominators, an email that cannot print the lie).
**Cost:** Part A cost nothing but time. What Part A *changes about the cost of D, E and F* is the
substance of this report — **Part D is ~5× smaller than estimated, and Part F is ~260× smaller.**

---

## A1 — Provenance of every denominator

**91 rows (77 live, 14 retired). `est_sections` exactly equals `compiled` on 46 — the brief predicted
46. 40 of those 46 are flagged `est_is_confirmed = true`.**

**There is a sixth rebaseline script**, not the five named in `INGEST_LABELS_REPORT`, and it is the
most explicit: **`v30-denominator-rebaseline.ts`** — *"Corpus with an empty ingest_queue backlog …
→ `est_sections = actual_compiled`, `est_is_confirmed = true`."*

Its header also records **why**, and the why matters more than the rule:

> *"Fixes the honest-denominator violation flagged this session: summed `corpus_targets.est_sections`
> (16.56M) had fallen below actual compiled sections (17.65M compiled …) — a 'lie of omission'."*

The problem was identified correctly: a denominator smaller than its numerator is impossible. The
remedy chosen was to set the denominator to the numerator. **That converted a visible error into an
invisible one, in a script whose stated purpose was honesty.**

### The four the email ticks with a *different* number — provenance established

| corpus | est | provenance | verdict |
|---|---:|---|---|
| `impact-assessments` | 18,759 | its own note: *"est_sections RE-BASELINED from the completed drain … 1,181 documents → 18759 sections"* | **self-referential by its own admission** — it differs from compiled (18,756) only by 3 classified gaps |
| `erskine-may` | 2,038 | `v29-seed-parliament.ts` sets `est = ids.length` — a walk of the Erskine May contents on parliament.uk | a real publisher enumeration, but the artefact is not stored with a date → **CLAIMED** |
| `ico` | 26,576 | `v27-seed-ico.ts` sets `est = leaves.length` — a walk of ico.org.uk/action-weve-taken | same class → **CLAIMED** |
| `scottish-courts` | 13,070 | its own note: *"ROUGH order-of-magnitude only (~700 published opinions/yr since ~1998, **unmeasured** — search API blocked, old archive 404s). Replace with measured universe at unblock."* | **the note says unmeasured and the flag says confirmed** |

⚠ `scottish-courts` is the sharpest single row in the database: a contradiction inside one record,
where the free-text field is honest and the boolean the email reads is not.

---

## A2 — The register, regenerated from live data

`docs/CORPUS_REGISTER_V31.csv`, 91 collections plus the legacy table as its own row outside the sum.

```
live collections (searchable)                    18,243,823
retired collections (still held, still indexed)      28,629
sum                                              18,272,452
corpus_sections compiled total                   18,272,452   RECONCILES ✓
legacy LegislationSection (outside the sum)         914,274
```

The brief's figures were 18,243,806 searchable / 18,272,435 compiled; both are 17 higher today.
Ordinary drift, stated rather than smoothed over.

---

## A3 — Hollow units. **The brief's own instrument finds two of the four cases it names.**

Run exactly as specified — flag where `<15 words` exceeds 5% or `>20,000 words` exceeds 1% — the
scan flags 41 of 74 collections and finds:

| case | result |
|---|---|
| `written-answers` | **CAUGHT** — 143 rows, median 367,570 words, 95.8% over 20k |
| legislation dot leaders | **CAUGHT** — 112,554 sections under 15 words across 6 collections |
| `et-decisions` | **MISSED** — the landing pages sit at a median of **18 words**, above the 15-word floor. Only 3,150 of 293,399 rows fall under it: the test misses 97.6% of the defect it was written for |
| `building-regs` | **MISSED** — median 318, min 237, max 1,483. Nothing under 15, nothing over 20,000 |

**A length threshold cannot find either.** And at 41 of 74 collections flagged it is barely a filter:
`historic-hansard` at 23.2% under 15 words is a per-speech corpus full of *"Hear, hear."* — short,
not hollow.

**The instrument that works is one field: `sourceUrl` points at the publisher's landing page rather
than the document.**

| corpus | rows | landing pages | real documents | landing pages with NOTHING behind them | verdict |
|---|---:|---:|---:|---:|---|
| `et-decisions` | 293,399 | 131,650 | 161,749 | **503** | HOLLOW (verified) |
| `quangos-govuk` | 171,030 | 61,192 | 93,029 | 21,206 | HOLLOW (verified: 359-char abstract of an annual report) |
| `hmrc-codes-guidance` | 14,067 | 9,253 | 0 | 9,253 | HOLLOW (verified: gov.uk furniture + a link to the form) |
| `uk-treaties` | 3,250 | 1,470 | 1,780 | 67 | mixed |
| `hmrc-tiins` | 791 | 791 | 0 | 791 | candidate, unconfirmed |
| `building-regs` | 21 | 21 | 0 | **21** | **HOLLOW, 100%** (verified) |
| `planning-policy` | 64 | 64 | 0 | 64 | **FALSE POSITIVE — REAL** (verified: 49,999 chars of actual Planning Practice Guidance) |

⚠ **One in seven that the URL test flagged is a false positive**, so it is a candidate detector, not
a verdict. Part B must confirm `hollow_units` by reading a body per collection.

### ⚠⚠ A3 also found two collections that do not contain their own subject

| corpus | label | rows | from the nominal source | what is actually in it |
|---|---|---:|---:|---|
| `oecd` | "OECD iLibrary (free summaries)" | 505 | **0** | **505 of 505 are gov.uk URLs.** 52 are gov.uk news stories, 31 ministerial speeches — one is *"London 2012 sets new world standard on Olympic legacy"* |
| `ots-reports` | "Office of Tax Simplification Reports" | 497 | — | all gov.uk (correct: OTS published there), but **≥69 are news stories and speeches, not reports** |

Both print `[100% complete]`: `oecd` est 505 = compiled 505. **The self-referential denominator
certified a collection containing none of its nominal content.** V20 found exactly this in
`college-of-policing` — *"prior content was unfiltered gov.uk search junk"* — and blocked it. These
two were not.

---

## A4 — Duplication. **The largest pair in the brief is not duplicated, and I got that wrong first.**

Proved through the live index, scoped to each pair, with a control: a subject present in only one
member returns one corpus only (`et-decisions` 30 hits, `pwdata-debates` 0). The control holds, so
"both answered" is meaningful.

| pair | verdict |
|---|---|
| `historic-hansard` / `pwdata-debates` | **NOT DUPLICATED — 0 shared sitting days.** Commons volumes (`S5CV`) end **1918-11-21**; `pwdata-debates` begins **1919-02-04** |
| `historic-hansard` / `pwdata-lords` | **NOT DUPLICATED — 0 shared sitting days.** `S5LV` ends **1999-11-11**; `pwdata-lords` begins **1999-11-17** |
| `lda-commonsdivisions` / `commons-divisions-votes` | **DUPLICATED, item-level proof** — the EU (Withdrawal Agreement) Bill division of 2019-10-22 in both |
| `lda-lordsdivisions` / `lords-divisions-votes` | not proved by text query (median 8 words); structural duplication likely, unmeasured |
| `uk-treaties` / `uk-treaties-fcdo` | **DUPLICATED, item-level proof** — "Treaty Series No. 8 (2016) UK/New Zealand Exchange of Notes concerning air services" appears in `uk-treaties` **and twice within `uk-treaties-fcdo`** (`62817`, `62818`) |
| retired `lda-lordswrittenquestions` / `pwdata-lordswrans` | duplicated (proved at rank 0 in the previous sprint) |

⚠ **I first reported the Hansard pair as duplicated on 8,697 shared sitting days. That number was an
artefact of my own query**: it compared `historic-hansard`'s **Lords** volumes against `pwdata`'s
**Commons** stream — two Houses sitting on the same calendar dates, which is not the same debate.
Split by House, the overlap is zero on both. **The collections abut cleanly.** The retrieval test
that made me believe otherwise showed both collections answering a generic parliamentary phrase,
which any two parliamentary collections will; duplication has to be proved on the item.

⚠ Separately: **788 `historic-hansard` rows carry a date before 1800**, the earliest being
`1013-06-24`. A date-parse defect, not a coverage one.

---

## A5 — The legislation work list. **The split confirms; the yield does not.**

⚠ **THIS SECTION WAS REWRITTEN AFTER THE ARTEFACT CHANGED UNDER IT.** A first pilot run at n=501
stalled and was abandoned; I re-ran at n=301 in the foreground and wrote this section from that.
The n=501 run then completed after all and overwrote `A5_worklist_pilot.json`. It is the same
corrected code and a larger sample, so I have adopted it and rewritten the figures rather than
restore the smaller run. **Two of my headline claims changed and are corrected below.**

**A5(a)/(b) — the split, confirmed from the file:** 5 + 5,783 + 27,413 (26,700 + 713) + 7,082 +
1,630 = **41,913 exactly**, as the brief states. By reason: 33,989 `unseen` (never attempted),
7,924 `classb` (carrying the marker *"No CLML/HTML/PDF found on TNA"*).

**A5(c) — 501 instruments fetched to memory through the production enumerator, no writes.**

| measure | prediction (logged before the run) | measured (n=501) | |
|---|---|---|---|
| throughput at the 500 ms floor | 50–90 /min | **93.5 /min single-threaded; 8.2 /min with two fetchers running** | see below |
| `classb` recovery on a plain re-fetch | 20–40% | **36/96 = 37.5%** | ✓ (V36 measured 27.5% at n=40) |
| `unseen` recovery | 80–95% | **69/405 = 17.0%** | ✗✗ **wrong by a factor of five** |
| full-list yield | 0.4–0.7M sections, 55–95M words | **~91,500 sections, ~11.5M words** | ✗ ~5× over |

**394 of 501 (78.6%) return `no-provisions-at-source` — the publisher itself says there is no text.**
Two instruments (`uksi/1980/1723`, `uksi/1980/1960`) raised `RetryableSourceError`, which is the V36
fix working: a transient failure named as transient rather than written down as a property of the
instrument.

⚠ **THROUGHPUT: 93.5/min is the planning figure, not 8.2/min.** The n=501 run overlapped with the
n=301 run for most of its life and averaged 8.2 instruments/min against 93.5 for a single fetcher
with the source to itself. **Running two fetchers against legislation.gov.uk cost an order of
magnitude**, which is throttling, not capacity. Part D must run single-threaded; at 93.5/min the
whole list is ~7.5 hours.

⚠ **My first pilot run reported `classb` 96/96 and `unseen` 405/405 recovered.** Both were false:
`enumerateSections` returns a *marker* section for a no-provisions instrument, and I counted a marker
as a recovery, making the rate 100% by construction. It also reported `mean words: 0`, because
`TnaSection` has no `.text` field.

### The projection has to be per (stratum × reason), because both simpler estimators are outlier-driven

One instrument — `ukpga/2006/46`, the Companies Act 2006 — returned **2,093 sections and 361,186
words**, which is 88% of the sample's words. Projecting any whole-sample mean over 41,913 inherits
it. It is also 1 of only **5** `primary-acts-2000plus` entries on the list, so it can be counted
rather than projected. With it isolated, and projecting each stratum by its own reason:

| stratum × reason | on the list | sampled | with text | yield | → sections | → words |
|---|---:|---:|---:|---:|---:|---:|
| `primary-acts-pre-2000` × `classb` | 258 | 2 | 2 | 100% | 19,866 | 645,774 |
| `primary-acts-pre-2000` × `unseen` | 5,525 | 67 | **0** | **0%** | 0 | 0 |
| `si-pre-2010` × `classb` | 380 | 6 | 6 | 100% | 4,750 | 649,927 |
| `si-pre-2010` × `unseen` | 26,320 | 313 | 46 | 15% | 36,158 | 6,999,354 |
| `si-2010plus` × `classb` | 429 | 6 | 5 | 83% | 3,361 | 296,868 |
| `si-2010plus` × `unseen` | 284 | 3 | 2 | 67% | 473 | 41,369 |
| `regional` × `classb` | 1,544 | 18 | 13 | 72% | 9,950 | 787,183 |
| `regional` × `unseen` | 86 | 1 | 0 | 0% | 0 | 0 |
| `retained-eu` × `classb` | 5,312 | 63 | 9 | 14% | 2,614 | 80,607 |
| `retained-eu` × `unseen` | 1,770 | 21 | 21 | 100% | 3,877 | 221,503 |
| `primary-acts-2000plus` (counted, not projected) | 5 | 1 | 1 | — | ~10,465 | ~1,805,930 |
| **total** | **41,913** | **501** | **105** | | **~91,500** | **~11.5M** |

**≈17.8M tokens → $1.33 on the batch endpoint**, against CCh's $6–9 and 0.45–0.6M sections. ⚠ Several
cells rest on n=1–6 and their confidence intervals are enormous; read the total as an order of
magnitude, not a figure.

### ⚠⚠⚠ CORRECTED: the pre-2000 Acts DO yield text — but only from the 258 `classb` rows

My n=301 draw found **0 of 41** pre-2000 Acts with text and I reported that the slice yields
"essentially nothing, ~182 sections". **That was wrong.** At n=69 the split is decisive:

- **`unseen`, 5,525 on the list: 0 of 67 sampled return any text.** (95% upper bound on the yield
  ≈ 5%.) These are the Georgian and Victorian local Acts legislation.gov.uk lists and publishes no
  provisions for — V36 recorded the same shape: *"95% Georgian local Acts yielding no text."*
- **`classb`, 258 on the list: 2 of 2 sampled return text**, and they are substantial — one is
  `ukpga/Vict/38-39/55`, the **Public Health Act 1875, 143 sections**. Both were marked
  *"No CLML/HTML/PDF found on TNA"*, and that marker is simply wrong.

So the recoverable pre-2000 set is **the 258 `classb` rows, not the 5,783**, and it projects to
~19,866 sections — about 12% on top of the collection's current 166,290, not the ~182 I first
reported. ⚠ n=2. The honest statement is that both sampled recovered and one was a major public
general Act; the size needs the other 256 fetched before it is a number.

**Separately, the 87 modern (1900+) pre-2000 Acts were probed exhaustively** (`a5b-modern-acts-probe.ts`),
because a proportional sample structurally cannot see a 1.5% stratum: **11 of 87 carry text, 182
sections, 39,190 words**; 74 are no-provisions at source and 2 errored.

**The operative finding for Part D is the reason column, not the corpus column.** `classb` — our own
recorded fetch failures — recovers at 37.5% and carries far richer instruments; `unseen` recovers at
17.0% and is dominated by instruments with no text at source. **7,924 rows we already wrote off as
permanently unavailable are the valuable part of the work list.**

---

## A6 — Storage. **The 20 GB is ours; the real ceiling is 16,384 GiB.**

**(i)** Read from the compute's own configuration, not from a document about it:

```
neon.max_cluster_size = 16777216 MB  =  16,384 GiB       [configuration file]
current database size = 19.01 GB     =  0.11% of it
```

The 20 GB the alarm fired against was a constant in `progress-reporter.ts` (removed in the previous
sprint). Two more fictional ceilings survive in the tree and should go the same way:
`scripts/ingest/v33-neon-fill.ts` (`CEILING_GB = 17.5`) and the commented-out `NEON_CEILING_GB` in
`search/serve-observer.ts`.

**(ii) Neon bytes per compiled section, and what case law stores that Hansard does not:**

| corpus | rows | bytes/row | of which `ftsVector` | rows carrying an `ftsVector` |
|---|---:|---:|---:|---:|
| `tna-caselaw` | 74,896 | **7,496** | **7,225 (96%)** | 73,846 of 74,896 |
| `si-pre-2010` | 489,450 | 662 | 891 | 171,335 |
| `et-decisions` | 293,403 | 639 | — | **0** |
| `primary-acts-pre-2000` | 179,435 | 593 | 601 | 56,725 |
| `pwdata-debates` | 6,391,345 | 394 | 6,528 | 18,943 of 6,391,345 |

All three of the brief's predictions land (~7.4 KB / ~0.4 KB / 0.6–0.7 KB).

**The answer to "what is stored for case law that is not stored for Hansard" is the `ftsVector`
column** — a Postgres tsvector built by the retired Postgres-FTS path. `drop-compiled-text-col.ts`
says so explicitly: *"New rows get null ftsVector; FTS over compiled content is deferred to semantic
embeddings."*

⚠ **`corpus_sections.ftsVector` occupies 1,178 MB across 683,153 rows — 6.2% of the database — and
nothing in the live serving path reads it.** Every remaining reference is a diagnostic, an attic
script, or a query against the *legacy* `LegislationSection` table. This is the single largest
recoverable object in Neon and it is dead weight.

**Consequence for Part E:** if pre-2001 case law is ingested the way `tna-caselaw` was, 150k–250k
judgments × 7.5 KB ≈ **1.1–1.9 GB** on Neon. If the dead `ftsVector` is simply not written — as it
already is not for `et-decisions` — the same judgments cost **~0.1–0.16 GB**, a 12× difference for
no loss of function.

---

## A7 — The legacy table. **Its independent contribution is 29 instruments, not 914,274 sections.**

| bucket | instruments | legacy sections |
|---|---:|---:|
| already in `corpus_sections` | **127,417** (99.7%) | 911,479 |
| on the V36 work list (Part D fetches it) | 344 | 2,584 |
| **in NEITHER — a genuine independent gap** | **29** | **211** |

⚠ **My first run reported 1,579 independent gaps and every one was false.** It built the
calendar→regnal identity map from `worklist.jsonl`, which by construction lists only *absent*
instruments — so an instrument held under its regnal id had no mapping and fell into the gap bucket.
`ukpga/1801/52` was reported missing while `ukpga/Geo3/41/52` sat in the corpus with 5 compiled
sections. The map now comes from the full source walk (14,294 calendar↔regnal pairs), and the script
**refuses to report at all** if that walk is absent.

V36 §1.4's standing decision — re-fetch, do not migrate — is unchanged. What this settles is that
**there is almost nothing left to decide about**: the legacy table can be dropped without losing 211
sections' worth of anything, once someone confirms those 29.

---

## SOLVED / NOT SOLVED / NEXT

**Solved (measured, artefact on disk):** every denominator's provenance and the sixth rebaseline
script · the register, reconciling exactly · the hollow-unit instrument, including the two cases the
specified thresholds miss · two mislabelled collections · duplication, with the biggest claimed pair
disproved · the work list's split, yield and true cost · Neon's real ceiling and the 1.18 GB dead
column · the legacy table's real contribution.

**Not solved / not attempted:** Part B (no walkers written) · Part C (no target email format exists
to build against) · Parts D, E, F (gated on this report) · `lda-lordsdivisions` duplication (unproved
by text query) · `hmrc-tiins` hollowness (candidate only) · the 2 errored instruments in A5b.

**Next, if Charlie approves:** Part B's walkers, starting with the three high-volume groups, and
re-costing D and E from the numbers above rather than from the Corpus Plan's estimates.

---

## DECISIONS FOR CHARLIE

**1. Part D is ~5× smaller than the brief assumed, and should be re-ordered by REASON. Run it?**
Measured: **~91,500 sections, ~11.5M words, $1.33** on batch, ~7.5 hours single-threaded — against
the brief's 0.45–0.6M sections and $6–9.
▶ **Recommend: run it, but order it by `reason`, not by the five corpus-scoped runs the brief
specifies.** The 7,924 `classb` rows — instruments we ourselves marked *"No CLML/HTML/PDF found on
TNA"* — recover at **37.5%** and carry the rich instruments (the Companies Act 2006; the Public
Health Act 1875). The 33,989 `unseen` rows recover at **17.0%** and are mostly instruments with no
text at source. **Run all 7,924 `classb` first**; they are ~19% of the list and a large share of the
value.
▶ And run it **single-threaded**: two concurrent fetchers measured 8.2 instruments/min against 93.5
for one.
*Consequence if run as briefed (five corpus-scoped runs, concurrently):* the same text arrives, but
later and at an order of magnitude worse throughput, and the pre-2000 run spends most of its time on
5,525 instruments that yield nothing.

**2. `primary-acts-pre-2000` is at 21.4% of published instruments, and 5,525 of the 5,783 missing
Acts have no text at source. What should the email say?**
▶ **Recommend: report coverage against instruments-with-provisions, and show the no-provisions count
beside it** — "3,560 of 9,343 Acts that have text (38.1%); 7,279 more are published with no
provisions" — then correct 38.1% *downward* once Part B re-walks, because 0 of 67 sampled `unseen`
pre-2000 Acts returned any text: the 12 August walk under-counted no-provisions substantially.
⚠ The recoverable part is the **258 `classb`** rows, projecting ~19,866 sections (~12% on top of the
collection) — but that rests on n=2 and needs the other 256 fetched before it is a number.
*Consequence otherwise:* we keep publishing 21.4% as if it were a text gap we could close, when
~96% of it is not.

**3. Delete the 1,178 MB `ftsVector` column?**
Nothing in the serving path reads it; it is 6.2% of the database and 96% of case law's per-row cost.
▶ **Recommend: yes, and before Part E**, so pre-2001 case law is never written with one. That turns
E's Neon footprint from 1.1–1.9 GB into ~0.15 GB.
*Consequence if kept:* Part E writes ~1.5 GB of a column no reader uses.

**4. `oecd` and `ots-reports` contain content that is not theirs. Block, purge, or re-seed?**
▶ **Recommend: block both immediately (as V20 did for `college-of-policing`), then purge and
re-seed from the real sources.** `oecd` has zero legitimate content and should not be answering
queries at all.
*Consequence if left:* 1,002 sections of gov.uk news stories and speeches are being served as OECD
and OTS material, under a 100%-complete tick.

**5. Part F: F2 is ~260× smaller than the brief assumed. Confirm the reduced scope?**
Of 131,650 `et-decisions` landing pages, **131,147 already have the real judgment PDF ingested
alongside them**; only **503** have nothing behind them. Every one of the 161,749 document rows
already carries its own title and date, so deleting the landing rows loses no case name.
▶ **Recommend: F1 as briefed (delete 131,650 landing rows), F2 reduced to the 503.**
*Consequence if F2 runs as briefed:* ~131,000 fetches to re-acquire documents already held.
