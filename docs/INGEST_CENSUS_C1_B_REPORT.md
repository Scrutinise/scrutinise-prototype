# INGEST CENSUS C1 — PARTS B AND C

**Stream:** CC-Ingest · **Run:** 2026-08-27, 14:40–15:20 UTC
**Brief:** `docs/BRIEF_INGEST_CENSUS_C1.md` Parts B and C, with a state check over everything
staged and unrun since Part A.
**Database:** Neon `ep-old-dust-aboxi69a` / `neondb` (§16 check ran before the DDL; output below).
**Spend:** **US$0.00** of the $250 embedding ceiling. No embedding ran. No fetch cost beyond
publisher index reads at a 500 ms politeness floor.

**Artefacts:** `corpus_census` (new table, 91 rows) · `docs/census/<corpus_key>.json` × 91 ·
`docs/census/walks/pwdata-days.json` · `docs/census/walks/legislation-entries.json` (walk in
progress) · code under `scripts/ingest/census/b/`.

---

## ⚠⚠ READ FIRST — WHAT WAS ALREADY DONE, AND THE ONE THING THE PURGE LEFT HALF-FINISHED

**Part A is complete.** All seven sub-parts have artefacts on disk and the report is written
(`docs/INGEST_CENSUS_C1_A_REPORT.md`, 23 Aug 01:50 UTC): A1 `A1_target_provenance.md` · A2
`docs/CORPUS_REGISTER_V31.csv` · A3 `A3_hollow_units.{md,json}` · A4 `A4_duplication.json` · A5
`A5_worklist_pilot.json` + `A5b_modern_acts.json` · A6 in the report · A7 `A7_legacy_overlap.md`.
Nothing in Part A needed re-running.

**And the purge Charlie was handed on 24 August HAS run — at 02:20 UTC this morning.**
`docs/census/C2_L2_purge_plan.json` records `executed: true` across all eight collections, 168,569
rows, and the database agrees: 18,272,452 → **18,103,959** compiled sections, `et-decisions` down
from 293,403 to 161,753, the seven whole collections at zero. The `ftsVector` drop (C3 step 1) went
with it.

⚠⚠ **BUT LAYER THREE DID NOT RUN, AND THAT IS A LIVE USER-FACING DEFECT AS OF NOW.**
`corpus_fts` still reports **18,272,377 rows** and still holds **36,919 rows from the seven
purged collections**, measured this afternoon. The rows were deleted from Neon twelve hours ago and
are still in the serving index, which means a user can still be returned a written answer that no
longer has a source row behind it. The purge's own script says this in its header — *"deleting the
database rows and leaving the index is the same mistake one layer along"* — and it is what
happened, because `l2-purge-index.ts --execute --stamp=…` is a separate command.

⚠ **It cannot be run from this machine.** Two attempts, at the default batch of 4,000 ids and again
at 400, both died with `memory allocation of ~1.9 MB failed` inside LanceDB's Rust layer while
counting the 131,650 `et-decisions` ids against an 18M-row table with no scalar index on `id`.
That is CLAUDE.md §17's signature exactly — single-process memory-bound work, which does not run
locally and does not run on Railway. **This is decision B-1 below.**

---

## 1. Part B — the census table, and why its constraints are the deliverable

### What a user would have seen

The daily email printed `[100% complete]` for 62 of 77 collections. The number behind the tick was
`compiled / est_sections`, and for 41 of 71 live collections `est_sections` was **a copy of that
collection's own compiled row count**, written by one of six rebaseline scripts. `held / held` is
100% for any corpus, including one holding nothing.

### The fix, and the part of it that matters

`corpus_census` holds one row per collection, counted in **units** — the thing the publisher counts
and we can match one for one — with the walk that produced the denominator stored on disk and
dated. The email now reads that table and nothing else.

The load-bearing part is not the table, it is the **CHECK constraints**, because a table that will
accept a MEASURED row with no denominator is the same tautology one layer along:

| constraint | refuses |
|---|---|
| `corpus_census_measured_has_denominator` | MEASURED without `published_units`, `walked_at` **and** a walk artefact path |
| `corpus_census_declared_has_denominator` | DECLARED without a denominator — DECLARED prints a percentage too |
| `corpus_census_state_known` | a state nobody defined (`'COMPLETE'`) |
| `corpus_census_exact_match_explained` | published == held without a deliberate `EXACT:` assertion in `notes` |
| `corpus_census_hollow_within_held` | more hollow units than units held |

`apply-schema.ts` inserts one row per case inside an aborted transaction and requires each to be
**refused**, plus one valid row that must be **accepted** so the test cannot pass by rejecting
everything. Current state: **7 refusals and 1 acceptance, all as specified.**

### ⚠ TWO OF MY OWN CONSTRAINTS WERE WRONG, AND BOTH WERE CAUGHT BY THE TEST RATHER THAN BY READING

1. **The first version of `exact_match_explained` accepted any non-null `notes`** — and every
   walker writes notes, so on its first real run it waved through **six** exact matches without a
   murmur. A guard satisfied by something the writer was always going to do anyway is not a guard.
   It now requires the literal token `EXACT:`, which has to be typed deliberately, and the sentence
   after it is the evidence that the two numbers came from different places.
2. **Then `notes LIKE '%EXACT:%'` let through the one row it most needed to refuse.** `NULL LIKE
   '…'` evaluates to NULL, and **a CHECK constraint PASSES on NULL** — so exact-match-with-empty-
   notes was accepted. `coalesce(notes,'')` fixes it. Nothing in the SQL looks wrong; only the test
   case found it.

⚠ The tightening was applied against the live table with rows already in it, and **`ALTER TABLE …
ADD CONSTRAINT` validated them and failed loudly** — which is the intended behaviour and is the
only reason the six unexplained exact matches came to light rather than sitting there.

---

## 2. What the walkers measured

**Three walkers ran to completion; one is still running.**

### pwdata — 7 collections, MEASURED, and essentially complete

Unit is a **sitting day**, not a file. ParlParse republishes a day as it is corrected
(`debates2026-04-21a` … `f`), so counting files would give a denominator that climbs every time
Hansard fixes a typo. Both sides are reduced to `<stream><date>`.

| collection | held days | published days | files behind them |
|---|---:|---:|---:|
| `pwdata-debates` | 16,039 | 16,039 | 20,080 |
| `pwdata-lords` | 3,977 | 3,977 | 5,718 |
| `pwdata-westminster` | 2,646 | 2,646 | 3,966 |
| `pwdata-wrans` | 4,652 | 4,652 | 6,918 |
| `pwdata-lordswrans` | 4,681 | **4,682** | 5,222 |
| `pwdata-wms` | 3,388 | 3,388 | 4,487 |
| `pwdata-lordswms` | 3,168 | 3,168 | 3,700 |

**CCh's prediction was >98% of sitting-day files held, with gaps concentrated in the last 14 days.
Measured: 100% on six streams and one day short on the seventh — and that day is
`lordswrans2026-08-11`, which appears in this same email's ISSUES block as `HTTP 503`.** The
prediction's *shape* was right and its *size* was pessimistic.

⚠ **Six exact matches is exactly the result that should be distrusted, so it was.** The
independence of the two sides is established three ways: they come from different systems (a
directory listing on theyworkforyou.com against our own `parentDocId` column); the identical
comparison **found a real absence** in the seventh stream; and the harness self-test shows a
mistyped corpus key reporting **0%, not 100%**.

### Publisher APIs — 17 collections

| collection | held | published | | collection | held | published |
|---|---:|---:|---|---|---:|---:|
| `committees-evidence` | 140,567 | 144,178 (97.5%) | | `members-interests` | 3,448 | 4,100 (84.1%) |
| `et-decisions` | 131,161 | 133,641 (98.1%) | | `hmrc-manuals` | 69,136 | 85,435 (80.9%) |
| `consultations` | 7,448 | 7,461 (99.8%) | | `echr-hudoc` | 4,410 | 8,018 (**55.0%**) |
| `cma-cases` | 2,536 | 2,579 (98.3%) | | `petitions` | 49,529 | 135,279 (**36.6%**) |
| `commons-divisions-votes` | 2,361 | 2,361 (100%) | | `committees-reports` | 30,149 | 51,866 (**58.1%**) |
| `lords-divisions-votes` | 3,284 | 3,284 (100%) | | `bills-api` | 421 | 4,035 (**10.4%**) |

▶ **`committees-reports` at 58.1% is the ingest-side counterpart of what SEARCH S16 found this
morning from the retrieval side.** S16 concluded committees' documents *are* indexed and the answer
keys are wrong; this says that separately, **42% of the committee publications Parliament lists are
not held at all**. Those are two different problems and both are real.

▶ **`petitions` at 36.6% and `bills-api` at 10.4% are the two largest newly-visible gaps.** Both
printed as complete yesterday.

### ⚠⚠ FOUR DENOMINATORS WERE BROKEN ON THE FIRST RUN AND I DID NOT SHIP THEM

The first pass of the API walker printed `quangos-govuk 126,306.5%`, `consultations 647.7%`,
`hmrc-tiins 791 / 0` and `ots-reports 223.9%`. Three of those are not coverage figures — they are
**broken denominators wearing a percentage**, which is the defect this sprint exists to end,
arrived at from the opposite direction. **A wrong denominator is worse than no denominator, because
it prints as fact.**

- `consultations` — the filter asked for open + closed and missed `consultation_outcome`, which is
  6,311 of the 7,461. **Fixed**: 99.8%.
- `hmrc-tiins` — gov.uk publishes **no** `tax_information_and_impact_note` type; both the doctype
  and format filters return 0 against 791 held. TIINs are attachments to other documents, so there
  is no page-level universe to count. **UNMEASURED.** A zero denominator would have printed ∞%.
- `quangos-govuk` — the filter covered **one** organisation of the many the collection draws from,
  62 documents against 78,310 held. **UNMEASURED**, with the number recorded so nobody re-runs it.
- `tax-tribunals` — gov.uk lists 1,434; we hold 12,027 from the tribunal's own archive. Two
  different universes. **UNMEASURED.**
- `ots-reports` — this one is **not** broken and stays MEASURED. 497 held against a publisher
  universe of **222** is a real finding: it is the same over-collection C3-A measured from the
  other end, and it prints `⚠ denominator suspect (224% of published)` and **never a tick**.

A `proxy: true` flag now means "this endpoint counts a different universe" and forces UNMEASURED
however good the number looks.

### Legislation — running, partial at the time of writing

The walk is checkpointed per (type, year) into `docs/census/walks/legislation-entries.json` and was
at 530 feeds when this report was written. **It re-walks entries rather than reading
`<openSearch:totalResults>`**, because that header is emitted only when the result set fits on one
page — re-measured on six feeds this afternoon, present on `ukpga/2020` and `asp/2020`, absent on
`uksi/2020`, `apni`, `ukcm` and `nisr/2020`, i.e. absent on precisely the dense feeds where a
denominator matters. V36 found the same in July.

Complete so far, and **four of these types have never had a published count at all**:

| type | published | held | note |
|---|---:|---:|---|
| `apni` — Acts of the NI Parliament | **288** | 0 | brief's new type; we hold none |
| `ukcm` — Church Measures | **244** | 0 | brief's new type |
| `ukci` — Church Instruments | **60** | 0 | brief's new type |
| `ukla` — UK Local Acts | **20,132+** | 0 | brief's new type; walk still in the 2000s |
| `asp` | 402 | 401 | |
| `nia` | 236 | 236 | |
| `anaw` | 44 | 44 | |
| `asc` | 34 | 34 | |

⚠ `ukpga`, `uksi`, `ssi`, `wsi`, `nisr`, `nisi`, `mwa`, `eur`, `eudn`, `eudr` are **still walking**
and their collections read UNMEASURED in the email until it finishes. That is the honest state:
their old self-referential targets are gone and no denominator has replaced them yet.

⚠ **The devolved types are printed individually, not as `regional`.** `regional` holds ssi, wsi,
nisr, nisi, asp, nia, anaw, asc and mwa together — one blended percentage would hide a type at 40%
behind one at 99%. The aggregate `regional` and `retained-eu` census rows are deleted when the
per-type rows land, so nothing double-counts.

### Everything else — 67 collections swept

Every remaining collection gets a row so it cannot fall out of the email: **RETIRED** (18),
**BLOCKED** (1), **NOT_STARTED** (5), **UNMEASURED** (46). Each UNMEASURED row carries its declared
scope from `docs/CORPUS_SCOPE.md` where one exists, and quotes the old `est_sections` **as prose**,
saying explicitly where it was self-referential — recorded, never used as a denominator.

**The census now stands at: MEASURED 20 · CLAIMED 1 · UNMEASURED 46 · RETIRED 18 · NOT_STARTED 5 ·
BLOCKED 1.**

---

## 3. Part C — the email

`progress-reporter.ts` now reads `corpus_census`. It does **not** fall back to `est_sections` when
the census is empty — it prints "THE CENSUS TABLE IS EMPTY OR ABSENT" and says why a fallback would
restore the defect. A silent fallback is how this class of bug comes back.

Changes a reader will see:

1. **The headline is the searchable corpus.** `SEARCHABLE: 18,103,959` — the legacy
   `LegislationSection` table's 914,274 rows are printed **beneath** it and never added in, because
   `runSearch()` does not read them. The subject line carried the combined 19,018,233 until today.
2. **Seven states**, with a mark each. A percentage prints only for MEASURED and DECLARED.
   UNMEASURED prints the held count and the word — no number.
3. **`100% complete` is behind one clamp**, in one function: MEASURED, `published ≤ held ≤
   published × 1.02`, and zero hollow units. Held above 102% prints `⚠ denominator suspect`.
4. **Sections and units never share a column.** Two lines per collection: sections held (ours),
   coverage in the publisher's units.
5. **`CENSUS C1` in the footer.**

### The verification, with the negative control watched failing first

`check-email.ts` carries the **old rule kept as a negative control** and runs the same 22 August
fixture — `est == compiled` for every collection — through both:

```
── NEGATIVE CONTROL: the rule that shipped until 27 Aug, same fixture ──
   historic-hansard       4,641,085 / 4,641,085 sections [100% complete]
   …
   an-empty-corpus        0 / 0 sections [100% complete]
  ✓ the old rule ticks ALL 7 fixture collections — 7/7, including the one holding ZERO sections.

── THE NEW RENDERER, SAME FIXTURE ──
   historic-hansard       4,641,085 document(s) held   [UNMEASURED — no publisher denominator]
   …
  ✓ prints "100% complete" NOWHERE — 0 ticks
  ✓ prints UNMEASURED everywhere — 7/7
  ✓ no percentage of any kind on an UNMEASURED row
```

And it asserts the **positive** direction so the renderer cannot pass by refusing everything:
a genuinely walked 16,039/16,039 must tick; 30,149/51,866 must print 58.1% and not tick; 497/222
must warn; 102/100 ticks and 103/100 warns (the clamp boundary, both sides); 21 units of which 21
are hollow must not tick. **All pass.**

⚠ **One defect the check found in my own renderer: a shortfall that ROUNDS to 100.0%.**
`pwdata-lordswrans` is 4,681 of 4,682 — at one decimal place that prints `100.0%` with no tick, and
a reader has to do the subtraction to learn a sitting day is missing. It now prints
`(1 Lords written-answers day not held)` in words beside the percentage.

---

## 4. ⚠ A DEFECT THIS MORNING'S PURGE INTRODUCED, FOUND BY THE CENSUS

`l2-purge.ts` retires **and blocks** the `corpus_targets` row for every collection it touches:

```ts
UPDATE corpus_targets SET retired = true, blocked = true, … WHERE corpus_key = $1
```

For seven of the eight that is right — the whole collection went. For the eighth it is not:
the target was `et-decisions-landing`, only the 131,650 landing pages were deleted, and
**`et-decisions` still holds 161,753 real employment tribunal judgments.** Its target row now reads
retired **and** blocked.

**What it does not do:** hide anything from users. `runSearch()` and the serving path do not read
`corpus_targets` at all — checked, not assumed. The judgments are still retrievable.

**What it does do:** drop 161,753 sections and 131,161 decisions out of every report that filters on
`retired`, including the old email's ALL CORPORA STATUS block, and add them to the retired total.
The census contradicts it — `et-decisions` is MEASURED at 98.1% — which is how it surfaced.

▶ **Decision B-2.** One `UPDATE` reverses it.

---

## 5. Still unrun — the honest list

| what | state | why |
|---|---|---|
| **C3 step 3 — the serving-index purge** | **UNRUN, and the rows are live in `corpus_fts`** | OOM on this machine, twice. §17 job. **B-1** |
| C3 steps 4–5 — redeploy `fts-serve`/`vector-serve`, `verify-retired-gone` | unrun | depends on step 3 |
| C3 step 6 — `labels/remove-retired.ts --apply` | unrun | |
| C3 step 7 — B3 partial-repeal backfill | **unrun** — `section_repeals` holds 249,256 rows, all dot leaders, no partial-repeal rows | OI-7 |
| C3 step 8 — B5 legislation title refresh into the index | unrun | OI-5 |
| C3A steps 1–6 — `ots-filter`, re-seed, ET orphans | unrun — `ots-reports` still reads 497 | OI-1, OI-8 |
| C1 Part B — legislation walk | **running**, 530 of ~800 feeds | resumes from checkpoint |
| C1 Part B — historic-hansard, Find Case Law, Holyrood, Senedd, NI Assembly walks | not written | see B-3 |
| C1 Parts D, E, F | not started | D is ~5× smaller than briefed (A5); E is BAILII, shut by its own terms (23 Aug); F2 is 503 fetches not 131,650 |

---

## SOLVED / NOT SOLVED / NEXT

**Solved.** `corpus_census` exists with constraints watched refusing 7 cases and accepting 1 · the
harness self-test proves a walker can report 0% · pwdata walked, 7 collections, one real gap found ·
17 API collections walked, four broken denominators caught and demoted rather than shipped ·
8 legislation types walked including 4 that never had a published count · 67 collections swept so
none falls out of the email · the email reads the census, the negative control was watched printing
the tick, and the headline is the searchable corpus.

**Not solved.** The serving-index purge (memory) · the legislation walk (still running) ·
historic-hansard, Find Case Law and the three devolved Official Reports (not written) · every C3 /
C3A production step from the state table above · Parts D, E and F.

**Next.** B-1 first — it is the only item on this page that is currently costing a user something.

---

## DECISIONS FOR CHARLIE

**B-1. The serving-index purge — how does it get run?** ▶ **Recommend: the Heavy Job Runner**
(`scripts/ops/heavy-job/`, §17), as a new entry in `jobs.ts` with `expectedPeakGb: null` until it is
measured. The work is one process holding an 18M-row LanceDB table and 131,650 ids; a 32 GB box ran
the FTS index rebuild for €0.049. *Consequence otherwise:* 36,919 rows from seven deleted
collections keep being returned to users with no source row behind them, and the `et-decisions`
landing pages stay in the index indefinitely. *Alternative:* raise the scalar index on `corpus_fts.id`
first (`build-chunks-scalar-index.ts` did exactly this for `corpus_chunks` and took 45 s), which may
bring the delete inside this machine's memory — cheaper to try, and worth one attempt before renting.

**B-2. `et-decisions`' target row.** ▶ **Recommend: un-retire and un-block it now.**
`UPDATE corpus_targets SET retired=false, blocked=false WHERE corpus_key='et-decisions'`, and change
`l2-purge.ts` so a target whose `where` clause is narrower than the whole collection does not retire
the collection. *Consequence otherwise:* 161,753 held judgments read as retired in every report that
is not the census.

**B-3. Which walkers next?** ▶ **Recommend: Find Case Law, then historic-hansard.** Find Case Law
has a working Atom feed (50 entries/page, court × year) and `tna-caselaw` is 74,896 units with a
self-referential target — the largest MEASURED gain available. historic-hansard needs ~2,400 month-
page fetches for 4.64M sections. Holyrood and Senedd are JavaScript search pages with no index and
should stay UNMEASURED with their declared scope, not be forced into a number.
*Consequence of stopping here:* 46 collections stay UNMEASURED — honest, but the email cannot yet
answer "how complete are we?" for the second- and fourth-largest collections we hold.

**B-4. `bills-api` at 10.4% and `petitions` at 36.6%.** ▶ **Recommend: size them before deciding.**
Both printed complete yesterday and neither has been costed. *Consequence:* two collections a user
would reasonably expect to be complete are not, and nothing currently says so outside this table.

**B-5. Should the census walk become a scheduled job?** ▶ **Recommend: weekly, per source group.**
Every denominator here has a date, and a denominator with a date drifts. *Consequence otherwise:*
`walked_at` ages silently and the email starts quoting a universe that has moved — the same failure
as a stale target, arrived at slowly.
