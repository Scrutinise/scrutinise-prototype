# CORPUS COVERAGE AUDIT — "100% complete" and "44% of the basic Acts" are both true, of different things

**Measured 2026-08-22 01:39 UTC.** Every number below was taken today against the live
database, the live serving index and the live Lance tables, except where a date is given.

Artefacts produced:

| what | where |
|---|---|
| per-collection embed census (new, 80 collections, no sampling) | `docs/embed_census.json` · `scripts/ingest/search/embed-census.ts` |
| the three-Act probe through the real gateway | `scrutinise-web/scripts/probe-three-acts.ts` |
| updated workbook, columns O–V + a reconciliation sheet | `docs/Legislation_Corpus_Breakdown_v3.xlsx` |
| retraction of the GOLD V2 absence claim | `docs/GOLD_CANDIDATES_V2.md` §"Archetypes I could NOT find a question for" item 2 |

---

## §1 — THE THREE ACTS. ALL THREE ARE HELD. ALL THREE ARE RETURNABLE. THE GOLD V2 CLAIM WAS WRONG.

Reported individually, as asked. Nothing here is an aggregate.

### Vagrancy Act 1824 — `ukpga/1824/83`, held as `ukpga/Geo4/5/83`

| question | answer |
|---|---|
| **(1) in `corpus_sections`?** | **YES — 20 sections, all 20 `status='compiled'`, all with an R2 key.** Corpus `primary-acts-pre-2000`. |
| **(2) in legacy `LegislationSection`?** | **YES — 19 sections**, 19 with `originalText`, 17 with a TNA XML key, 19 with an FTS vector, 0 with an embedding. `LegislationItem` row exists: `sectionCount` 19, `compiledSectionCount` 0, `compilationStatus` `PRINT_ONLY`. |
| **(3) returnable by `runSearch()` today?** | **YES.** `tier=legislation`, query *"Vagrancy Act 1824 rogue and vagabond wandering abroad begging"* → **rank 20** (`ukpga/Geo4/5/83:section-5`). Untiered/routed, lay query *"is it illegal to sleep rough or beg in a public place"* → **rank 110** (`section-4`). |

⚠ **The id is regnal, not calendar.** The corpus holds it under `ukpga/Geo4/5/83` (5 Geo 4 c 83).
A lookup keyed on `ukpga/1824/83` returns zero rows — which is exactly the query that produced the
GOLD V2 false gap, and exactly the trap `v36-reconcile.ts` exists to close. Two independent query
shapes were run before anything was reported: a PK range scan on the id, and a `LIKE` over
`sourceUrl` across **all 80 collections**. They agree.

⚠ **Its text is thin but it is not empty, and the thin part is real.** 20 sections, 1,082 words.
**13 of the 20 are one word** — the dot-leader rendering the source uses for a *repealed* provision.
The three that carry real text are the ones that matter and are the ones still in force:
**s.3 (203 words, begging), s.4 (439 words, rogue and vagabond), s.5 (210 words, incorrigible rogue)**.
So "is it illegal to sleep rough?" *is* answerable from this corpus — the sections are there and
retrievable; the problem is that at rank 110 on a lay query the model will rarely see them.

### Housing Act 1996 — `ukpga/1996/52`

| question | answer |
|---|---|
| **(1) in `corpus_sections`?** | **YES — 532 sections, all 532 compiled.** 97,714 words, mean 184 words/section, only 12 under 15 words. |
| **(2) in legacy `LegislationSection`?** | **YES — 388 sections**, 388 with `originalText`, 380 with TNA XML, 388 with FTS, 0 embedded. `LegislationItem`: `sectionCount` 407, `compiledSectionCount` 0, status `PENDING`. |
| **(3) returnable by `runSearch()` today?** | **YES — rank 0 on both arms.** `tier=legislation` → rank 0. Untiered lay query *"what duty does a council owe someone who is homeless"* → **rank 1**, and the hit is `section-184` (the inquiry duty) — the correct provision. |

**The corpus copy is richer than the legacy copy: 532 sections against 388.**

### National Minimum Wage Act 1998 — `ukpga/1998/39`

| question | answer |
|---|---|
| **(1) in `corpus_sections`?** | **YES — 108 sections, all 108 compiled.** 19,386 words, mean 180 words/section, 1 under 15 words. |
| **(2) in legacy `LegislationSection`?** | **YES — 85 sections**, 85 with `originalText`, 80 with TNA XML, 85 with FTS, 0 embedded. `LegislationItem`: `sectionCount` 84, `compiledSectionCount` 0, status `PENDING`. |
| **(3) returnable by `runSearch()` today?** | **YES — rank 0 on both arms.** Untiered lay query *"who is entitled to the national minimum wage and how is it enforced"* → **rank 0**. |

**How (3) was established.** `scripts/probe-three-acts.ts` calls the real `runSearch()` — not a copy
— under a fully-configured retrieval stack (`fts=fts-serve-production` · `vector=vector-serve-production`
· `LEX_VECTOR_STREAMS=legislation` · `LEX_QUERY_ROUTER=ON`), with `harness-preflight`'s assertion in
front of it. Service engagement was proved positively either side of the run: **fts +27, vector +6**.
A zero delta would have voided the result. The live index was probed directly as a second,
independent shape (`POST /fts-search` with `corpora=['primary-acts-pre-2000']`) and agrees.

⚠ **`compiledSectionCount` is 0 on all three `LegislationItem` rows and means nothing.** It tracks the
retired legacy compile pipeline, not the corpus. Reading it as a coverage signal is a third way to
manufacture this same false gap.

---

## §2 — IS THE `primary-acts-pre-2000` DENOMINATOR OURS OR THE SOURCE'S?

**It is the source's own published set. It is not our list, and it is not `LegislationItem`.**

**How it was derived.** `scripts/ingest/v36-source-census.ts --enumerate` walked
legislation.gov.uk's own year feeds — a full **entry walk**, not a `totalResults` read (that header
is absent on the bucketed year feeds and was measured absent: 226 `ukpga` years recorded it, zero
`uksi` years). For `ukpga` it walked **1801–1999, 199 year feeds, 16,622 entries**, recording BOTH ids
the source publishes per entry: the canonical `<id>` (regnal for pre-1963) and the calendar identity
from `<ukm:Year>`/`<ukm:Number>`. The walk is stored at `scripts/ingest/v36/source-entries.json`
(23 MB, written **2026-08-12 22:38 UTC**); `v36-reconcile.ts` diffs it against `corpus_sections`,
counting an instrument PRESENT if **either** id has a compiled section.

**So the denominator is source-confirmed. The numerator's identity rule is the part that was wrong
before and is right now** — and it demonstrably works: `ukpga/1824` reconciles as **4 present of 115
published, all four matched via the regnal id.** The Vagrancy Act was *counted correctly by the
reconciliation* on 12 August. The GOLD V2 claim did not come from the reconciliation; it came from a
fresh, un-joined lookup.

**⚠ But 21.4% is not the number to quote at a reader, and neither is 44%.** Both are
*instrument*-level, and both count instruments the source itself declares have **no provisions**:

| | published | present | coverage | of which the source declares **no provisions** | coverage **excluding** those |
|---|---:|---:|---:|---:|---:|
| `ukpga` **pre-2000** | 16,622 | 3,560 | **21.4%** | 7,279 | **38.1%** |
| `ukpga` all years | 17,560 | 4,493 | 25.6% | 7,279 | **43.7%** |
| `uksi` | 109,190 | 73,558 | 67.4% | 8,219 | 72.9% |
| retained EU (`eur`/`eudn`/`eudr`) | 159,773 | 39,068 | 24.5% | 113,623 | 84.7% |
| **all types** | **324,622** | **143,269** | **44.1%** | **139,440** | **77.4%** |

⚠ **There are two different 44%s in circulation and they are not the same fact.** **44.1%** is
corpus-wide instrument coverage. **43.7%** is UK public general Acts *excluding* no-provisions
instruments. If what you were told was "44% of the basic Acts", the figure that supports it is the
second one — and the honest statement of the pre-2000 half is **38.1% of pre-2000 Acts that have any
provisions at all**, not 21.4%.

⚠ **All of this is instruments, never text.** `ADDENDUM_V36_SEED_ORDER.md` already recorded the rule
and it still holds: *"we hold 44% of published instruments" and "we hold 44% of published text" are
very different claims, and only the first is true.* **139,440 of the 181,353 absences yield no text
at all**; the genuinely recoverable work list is **41,913 instruments**.

⚠ **Nothing outside legislation has a source-confirmed denominator of any kind.** Of the 74
collections `docs/CORPUS_COMPLETENESS.md` scored on 12 August, **6 are reconciled against a
publisher walk and 68 are not** (there are 77 live collections today). For the 68, no coverage
percentage should be quoted in either direction — and `est_is_confirmed` on their `corpus_targets`
row does **not** mean a publisher confirmed it; see §3.

---

## §3 — THE DAILY EMAIL'S "100% COMPLETE" IS A TAUTOLOGY. THIS IS THE WHOLE ANSWER TO THE CONTRADICTION.

The email's per-corpus line is one branch in `scripts/ingest/shared/progress-reporter.ts`:

```ts
if (est != null && compiled >= est) {
  parts.push(`  ✅ ${target.corpus_key.padEnd(38)} ${compiled.toLocaleString()}  [100% complete]`)
  continue
}
```

`est` is `corpus_targets.est_sections`. **For most collections that value was set BY COPYING THE
COMPILED COUNT**, and then marked confirmed. The mechanism is in the repository, unambiguous —
`v19-rebaseline-final.ts`, `v19-rebaseline-pwdata.ts`, `v20-rebaseline-drains.ts`, `v19-align-p1.ts`,
`v19-fix-si-residue.ts` all do a variant of:

```ts
await pool.query(`UPDATE corpus_targets SET est_sections=$1, est_is_confirmed=true WHERE corpus_key=$2`,
                 [compiledCount, corpus])
```

The rule was *"when the queue drains, set the target to what we ended up with."* The consequence:

- **62 of 77 live collections print `[100% complete]` today.**
- **46 of those 62 have `est_sections` EXACTLY equal to the compiled count.** A denominator equal to
  its own numerator is not a target — `historic-hansard` est 4,641,085 / held 4,641,085;
  `pwdata-debates` 6,387,304 / 6,387,304; `et-decisions` 293,399 / 293,399; `tna-caselaw` 74,896 / 74,896.
- **`corpus-completeness.ts` already carries the rule this violates**, in its own closing line:
  *"A count of what we fetched is not a denominator."* The daily email does exactly that, and stamps
  it `✓ source-confirmed`.

**`primary-acts-pre-2000` is the sharpest case.** est 165,438, held 166,290 → **100.5% → "✅ 100%
complete"**, on the same collection the source walk puts at **21.4% of published instruments**. Both
sentences are printed by the same system about the same collection on the same day.

Three further defects in the same branch, all live:

1. **There is no upper clamp.** `compiled >= est` prints "100% complete" at any overshoot.
   `explanatory-notes` is **4,549%** of its target (18,651 held against est 410),
   `committees-reports` **1,302%**, `eur-lex` **268%**, `explanatory-memoranda` **406%** — all
   reported as "100% complete", all flagged `est_is_confirmed`. A target that wrong in *either*
   direction is not being read by anything.
2. **An empty queue is not completeness, and `ingest_queue` cannot support the claim anyway.**
   It holds **5,343 rows in total right now** (5,173 done, 166 skipped, 4 failed, **0 pending**)
   against 18.3M held sections — because the hourly reaper `DELETE`s done rows older than 7 days.
   It is a 7-day rolling window, not a ledger. "The queue is empty" means "there is no work queued",
   which is only ever a statement about what was *seeded*.
3. **The email measures SECTIONS; the completeness walk measures INSTRUMENTS.** Even with a real
   denominator the two would not be comparable. An Act absent entirely and an Act present with one
   of 400 sections are the same event to one of them and opposite events to the other.

**▶ The fix is one line and one back-fill, and I have not made it** (it changes a live daily report
and the numbers behind it are Charlie's call): stop treating `est == compiled` as confirmed. The
honest states already exist in `corpus-completeness.ts` — `reconciled` / `target-only` /
`NOT RECONCILED` — and the email should print the third rather than a tick.

---

## §4 — THE WORKBOOK: WHAT IS NOW IN IT

`docs/Legislation_Corpus_Breakdown_v3.xlsx` — the three original sheets are unchanged except for
new columns on **Corpus Plan**; **column H (`Est. Sections`) was not touched.**

| col | header |
|---|---|
| **O** | Live corpus key(s) — the collection(s) in `corpus_sections` this plan row actually became |
| **P** | Sections ingested (`status='compiled'`) |
| **Q** | % of Est. Sections (H) ingested |
| **R** | Sections embedded (has a vector in `corpus_vec`) |
| **S** | % of Est. Sections (H) embedded |
| **T** | % of ingested that is embedded |
| **U** | Source-confirmed **instrument** coverage, where the publisher's own list was walked |
| **V** | Coverage note |

Rows with nothing ingested are filled red; rows under half their plan estimate, amber.
A fourth sheet, **Coverage vs Actual**, carries the reconciliation.

⚠ **Column H is not a denominator either, and the new columns make that visible rather than hiding
it.** The plan's estimates are wrong in both directions by large multiples — Primary Acts
**174.5%** of estimate, Hansard Commons **563%**, SIs **123%**, `regional` **379%**, while FCA
Handbook is **2.4%**, Planning Policy **1.3%** and Building Regs **0.7%**. Q and S are reported
because they were asked for and because the spread is itself the finding; **U is the column to
read for legislation**, and for everything else the honest answer is the one printed in it:
*"not walked — no publisher enumeration exists for this source."*

### Does the workbook account for 100% of what we have ingested? **No — 89.2%.**

| | sections |
|---|---:|
| Total held, all 80 collections | **18,272,435** |
| of which embedded | **18,272,151** (**99.998%**) |
| Accounted for by a Corpus Plan row | 16,290,489 |
| **NOT accounted for by any plan row** | **1,981,946 — 10.8%** |

**21 collections we hold are named nowhere in the plan:**

| corpus | sections | | corpus | sections |
|---|---:|---|---|---:|
| `scottish-parliament-or` | 1,043,264 | | `lda-commonsdivisions` | 5,553 |
| `et-decisions` | 293,399 | | `members-interests` | 3,448 |
| `niassembly-hansard` | 196,348 | | `lords-divisions-votes` | 3,284 |
| `senedd-cofnod` | 191,730 | | `commons-divisions-votes` | 2,361 |
| `lda-commonsoralquestions` | 69,529 | | `lda-lordsdivisions` | 2,089 |
| `early-day-motions` | 60,737 | | `independent-reviews` | 657 |
| `petitions` | 49,529 | | `cps-guidance` | 270 |
| `ico` | 26,562 | | `inquiry-reports` | 140 |
| `scottish-courts` | 13,056 | | `inquiry-evidence` | 89 |
| `tax-tribunals` | 12,089 | | `lgsco` | 40 |
| `ni-judgments` | 7,772 | | | |

The plan has **no devolved-legislature record at all** — Holyrood, Stormont and the Senedd are
1.43M sections, 7.8% of everything we hold, and the workbook does not know they exist.

⚠ **Three RETIRED collections still hold and still serve data**, counted into rows 33/34:
`lda-lordswrittenquestions` (20,500), `lda-commonswrittenquestions` (8,000), `written-statements` (129)
— **28,629 sections marked "superseded by" another collection, still in `corpus_sections` and still
in the vector index.** Retiring the target did not remove the rows, so this content is duplicated in
retrieval.

---

## §5 — EVERYTHING THAT COULD BE IN THIS CORPUS AND IS NOT

### 5.1 Plan rows with literally nothing ingested

| plan row | source | plan est. | state |
|---|---|---:|---|
| 43 | **BAILII — full corpus (pre-2003 + tribunals)** | 2,000,000 | **The largest single gap.** All four `bailii-*` targets retired/blocked as "superseded by `tna-caselaw`" — but `tna-caselaw` starts at 2001 and `et-decisions` at 2017. **Pre-2001 case law is not held.** |
| 44 | Leading Cases — curated ~10,000 | 50,000 | never built |
| 11 | Tax Legislation (Finance Acts + tax SIs) | 120,000 | not a gap — inside `si-*`, but not separable, so it cannot be reported on |
| 62 | SSRN UK Legal Scholarship | 80,000 | target exists, **blocked**, 0 held |
| 22 | NHS Standard Contracts + NHSE Guidance | 20,000 | no target row was ever created |
| 9 | **Local / Private Acts** | 10,000 | no `ukla` seeder, no target row |
| 39 | House of Commons Library Briefings | — | no target row |
| 52 | UN / UNCITRAL | — | no target row |
| 37 | Post-Legislative Memoranda | — | no collection; the PIR leg is ~1,235 sections *inside* `impact-assessments` |
| 40 | The Public Whip | — | not in `corpus_sections`; division data is in the position graph |
| 55 | ONS Statistical Datasets | — | not in `corpus_sections`; separate statistics store (`STATS_DATABASE_URL`) |
| 14, 51, 64–68 | IBFD, OECD Model Tax Commentary, Halsbury's, Westlaw, LexisNexis, HeinOnline | — | deliberately out of scope (private IP) |

### 5.2 Plan rows ingested far below their estimate

| plan row | held | plan est. | % |
|---|---:|---:|---:|
| Building Regulations Approved Documents | 21 | 3,000 | **0.7%** |
| Planning Policy (NPPF, PPG) | 64 | 5,000 | **1.3%** |
| FCA Handbook | 3,661 | 150,000 | **2.4%** |
| PACE / Codes / Green & Magenta Book / White Papers *(one 175-section collection for four plan rows)* | 175 | 1,800 + | **~10%** |
| HMRC Technical Manuals | 83,675 | 500,000 | **16.7%** |
| Ofcom / Ofwat / Ofgem / Ofsted | 21,312 | 40,000 | **53.3%** — and only **2 of the 4** regulators were ever seeded (no Ofwat, no Ofsted) |
| Erskine May | 1,873 | 3,000 | 62.4% |
| College of Policing APP | 332 | 8,000 | **4.2%** |
| Sentencing Council | 253 | 2,000 | 12.7% |

### 5.3 Named absences inside collections we DO hold

- **41,913 legislation instruments** on the recoverable work list (`scripts/ingest/v36/worklist.jsonl`)
  — i.e. published, no text held, and not one of the 139,440 the source says has no provisions.
- **`apni`** — Acts of the Parliament of Northern Ireland 1921–1972, **2,602 inbound citations**,
  target row exists, **0 held**.
- **`ukcm`** — Church Measures, **6,803 inbound citations**, target row exists, **0 held**.
- **`ukci`** — Church Instruments, target row exists, 0 held.
- **`financial-corpus`** — target row exists, scoping pending, 0 held.
- **Welsh-language content is effectively unaskable**: ~95% of a 40-row `senedd-cofnod` sample has
  Welsh bodies, and 61.1% of its 191,730 speeches carry an inherited (wrong) heading.

### 5.4 Held but degraded — present in the count, absent from the answer

These do not reduce the coverage figures and *should*:

- **~178,826 legislation sections (11.44%) are dot leaders** — the source's rendering of a repealed
  provision. Compiled, chunked, embedded, retrievable, and they say nothing. The Vagrancy Act is
  13/20 of exactly this.
- **131,654 of 293,403 `et-decisions` rows (44.9%) are a landing page, not a decision** (median 18 words).
- **12.7% of everything ever embedded for case law is stylesheet**, and chunk 0 is >50% stylesheet in
  77% of judgments — ~$31 to re-embed, not yet spent.
- **`legacy-legislation-section`**: the legacy `LegislationSection` table holds **914,274 sections
  across 127,790 instruments**, none of it embedded, none of it in `corpus_sections`. V36 §1.4
  measured n=25 and found the source richer than legacy in 11 and legacy richer in 0, so the
  decision was **re-fetch, do not migrate** — but until that fetch happens this is a real, held body
  of text that no retrieval path reaches.

---

## §6 — WHAT TO BELIEVE

1. **Embedding is not the bottleneck and never was.** 18,272,151 of 18,272,435 compiled sections have
   a vector — **99.998%**, measured over 100% of both Lance tables with no sampling. Every collection
   is at 100% bar rounding.
2. **Ingest "100% complete" means the queue drained against a target we copied from ourselves.** It is
   not a coverage statement and should not be read as one.
3. **44% is real, is instrument-level, and applies to legislation only** — the one tier with a
   publisher walk behind it. It rises to 77.4% once instruments the publisher says have no
   provisions are removed from the denominator.
4. **The pre-2000 Acts number is the weakest thing we have** — 21.4% raw, 38.1% of Acts with
   provisions — and it is *still* not what makes the Vagrancy Act hard to find. That is ranking.
5. **10.8% of what we hold is not in the plan at all**, including the entire devolved parliamentary
   record.
