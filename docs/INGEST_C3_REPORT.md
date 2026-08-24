# INGEST C3 — EXECUTE THE TWELVE DECISIONS

**Stream:** CC-Ingest · **Run:** 2026-08-24, 00:29–02:4x UTC · **Brief:** `docs/BRIEF_INGEST_C3_EXECUTE.md`
**Database:** Neon `ep-old-dust-aboxi69a` / `neondb` (§16 check run first, output below)
**Spend:** **US$0.00 of the $150 embedding ceiling.** No embedding ran. Lane C4 was not started.

**Artefacts:** `docs/census/C3_ots_classification.jsonl` · `C3_b3_partial_census.json` ·
`C3_b5_citation_gap.json` · `C3_et503_probe.json` · `C2_L2_purge_index.2026-08-24T00-34-43-701Z.dryrun.json` ·
`docs/CORPUS_SCOPE.md` · `docs/OPEN_ITEMS.md` · `docs/C3_EXECUTE.sh`

---

## ⚠⚠ READ THIS FIRST — NOTHING DESTRUCTIVE RAN, AND NOT BECAUSE OF A JUDGEMENT

**Claude Code's auto-mode classifier refuses production `DELETE` and `DDL` from a session, whatever
the sprint brief authorises.** Three separate attempts were refused: `l2-purge.ts --execute`,
`e1-drop-ftsvector.ts --execute`, and by extension every write below them.

So Lane A — *"this is the first thing to do"* — is **staged and unrun for the fourth session running**,
and this time the reason is a harness boundary rather than a cleared context. Everything needed is
on disk: the manifests, the guards, the dry-run output, the expected counts. `docs/C3_EXECUTE.sh`
runs the lot in order, one step at a time, with a confirmation before each destructive one.

**The honest sentence is: the purge is proven, not performed.** ▶ **CHARLIE: `bash docs/C3_EXECUTE.sh`.**

---

## THE STATE CHECK, BEFORE ANYTHING

```
host      : ep-old-dust-aboxi69a.eu-west-2.aws.neon.tech
database  : neondb   user: neondb_owner
corpus_sections compiled : 18,272,452

  et-decisions                        293403   (html: 131650)
  lda-lordswrittenquestions            20500
  lda-commonswrittenquestions           8000
  written-statements                     129
  lda-commonsdivisions                  5553
  lda-lordsdivisions                    2089
  written-answers                        143
  oecd                                   505
  ots-reports                            497
```

Every count in the brief's Lane A table is exact. Nothing had been deleted.

**And the acceptance test was watched failing first, at 00:29 UTC:**

```
0/3 pass.
  lda-lordswrittenquestions   → 10 hits   (must be 0)     pwdata-lordswrans  → 10
  lda-commonswrittenquestions → 10 hits   (must be 0)     pwdata-wrans       → 10
  written-statements          → 10 hits   (must be 0)     pwdata-wms         → 10
```

Both sides of all three probes return 10, so the probe is sound and the failure is the real broken
state — not a query that returns nothing whatever you ask it.

---

## LANE A — THE PURGE

### What a user would have seen

Ask about a Lords written question and get the answer twice: once from `pwdata-lordswrans`, which
holds it properly, and once from `lda-lordswrittenquestions`, a collection retired months ago whose
rows were never deleted. Ask about an employment tribunal decision and get a **131,650-strong
population of GOV.UK landing pages at a median of 18 words** — the page *about* the decision — while
the decision itself sits beside it. Ask about tax policy at the OECD and get 505 gov.uk pages,
including one about the London 2012 Olympics.

### Why

Retiring a target set a boolean on `corpus_targets`. It deleted nothing. **Retirement is a
three-layer operation — the target row, the `corpus_sections` rows, and the serving index — and
doing one of the three and calling it done is the whole defect.**

### What we did

**All eight collections matched their brief counts exactly** in the dry run — 131,650 / 20,500 /
8,000 / 129 / 5,553 / 2,089 / 143 / 505 = **168,569**. The four newly approved keys were added to
`TARGETS` with their evidence in the file, not in a commit message.

**Layer three did not exist and now does.** `l2-purge.ts` ended by printing *"NEXT (index layer, not
done here)"* — which is the same mistake one layer along, since a row deleted from Postgres and left
in `corpus_fts` is still returned to users, now with nothing behind it. `c2/l2-purge-index.ts` reads
**that run's manifest files**, not a fresh query, so the two layers cannot drift.

Dry run, 15m53s:

| table | seven whole collections | et-decisions landing | total to remove | survivors |
|---|---:|---:|---:|---:|
| `corpus_fts` | 36,919 | 131,650 | **168,569** | 161,749 et-decisions |
| `corpus_chunks` | 39,139 | 131,650 | **170,789** | 373,036 |
| `corpus_vec` | 39,139 | 131,650 | **170,789** | 373,036 |

### ⚠⚠ THE FINDING THAT NEARLY SHIPPED A SILENT NO-OP

The first dry run reported **`et-decisions landing pages present here: 0`** on all three tables —
while the same tables held 293,399 `et-decisions` rows. That is impossible, and it was my predicate,
not the data.

**LanceDB's DataFusion parser accepts a double-quoted identifier, matches NOTHING, and raises
nothing.** Measured on all three tables, both forms, the same ids:

```
corpus_fts     id = 'x' → 1                  "id" = 'x' → 0
corpus_chunks  sectionId IN (2000) → 2000    "sectionId" IN (2000) → 0
corpus_vec     sectionId IN (2000) → 2000    "sectionId" IN (2000) → 0
```

**A `delete()` carrying the quoted form removes 0 rows, returns normally, and the purge reports
success** — 168,569 rows still serving, a green run, and nothing to look at. It is also **~70×
faster** (0.1 s against 6.9–10.1 s) because it prunes every fragment, which is exactly what makes it
look like a working optimisation rather than a bug.

`fts-hygiene.ts` and `vec-hygiene.ts` both use the bare form. This file broke with them. What caught
it was **counting before deleting and printing the count** — so the script now refuses to run when a
predicate matches zero rows, which is a guard that could not have existed if the counts had been
inferred after the fact rather than measured before it.

⚠ It also invalidated two of my own predictions: the "0.2–0.3 s" probes in predictions 5 and 6 were
quoted-form probes and were measuring nothing.

### What it cost

£0. Dry runs only.

### What is still open

**Everything.** `--execute` was refused. `docs/C3_EXECUTE.sh` steps 2–6.

### `ots-reports` — a filter, and the brief's premise is inverted

The brief: *"roughly 14% contaminated: at least 69 of 497 rows are news stories and speeches, and
the other ~428 are real OTS reports. A wholesale purge would delete 428 genuine documents."*

**Measured, 497 of 497 readable through the gov.uk content API:**

```
  KEEP    76   published by office-of-tax-simplification
  DELETE 421   published by somebody else
  HOLD     0   unreadable
```

**The collection is 84.7% not-OTS.** The cause is in the seeder, not the data —
`sources/gov-scraper.ts:176` is a **free-text relevance search with no publisher filter**:

```ts
yield* searchGovUk('office of tax simplification report', 'ots-reports', 500)
```

That query reports **`total: 347,938`**. We kept the first 500. Ranks 481–485 are *Spring Budget
2017: documents*, *Summer Budget 2015* and *Notices made under The Customs (Import Duty) (EU Exit)
Regulations 2018*. There is no *category* of contamination to remove: relevance decays continuously,
so the cut has to come from outside the query.

**Ten bodies read at random before any rule was written** (`--read-ten`, `ORDER BY md5(id)`), as the
brief required. Zero of the ten were OTS reports. They included *Renew your driving licence*,
*Report an immigration or border crime*, *Apply online for a UK passport* and *Spain travel advice*.

⚠ **`document_type` cannot make the cut, exactly as the brief anticipated.** Nine types carry both
verdicts:

```
   policy_paper               KEEP   23   DELETE   62
   corporate_report           KEEP    7   DELETE   51
   consultation_outcome       KEEP    2   DELETE   44
   press_release              KEEP   19   DELETE    7
```

The instrument that works is **who published it** — `filter_organisations=office-of-tax-simplification`
returns **222** documents, from a field the publisher maintains.

⚠ **The brief's own rule, applied literally, is worse than doing nothing precise.** Deleting the
news/speech types removes **68** rows (close to its "at least 69") — of which **27 are genuine OTS
press releases**, including *"Government announces closure of the Office of Tax Simplification"* —
and leaves **380 non-OTS rows serving**.

⚠ **And `source-audit.ts` has been checking the wrong thing since V1.** It asserts `minSize: 5000` on
`/government/collections/office-of-tax-simplification-reports`, which **404s**. A gov.uk 404 page
satisfies a size floor. A size threshold is not an existence check.

**Not deleted.** 421 is 6× the authorised action on the strength of my own re-measurement, and 148
of the 421 are held in no other collection (273 are duplicates of `hmrc-codes-guidance`,
`consultations`, `hmrc-tiins`). **Decision D-1 below.**

---

## LANE B — MAKE THE PLATFORM HONEST

### B2 / B4 — the exclusion, not just the annotation

**What a user would have seen:** a question about a retained EU provision answered with
`Article 31 . . . . . . . .`, presented as if it were the law.

**Why:** all 249,256 whole-body dot leaders have been *labelled* in every search result since
Surface 1 shipped — **and returned anyway**. Annotation without exclusion is the same defect as
retiring a target without deleting the rows.

**What we did:** the filter is in `search-gateway.ts`, at the one point every consumer reads, so the
panel and the prompt cannot disagree. `npm run check:repeal-exclusion` was **watched failing (8/2)
against pre-sprint behaviour and passing (10/0) after.**

⚠ **The rule keys on the EVIDENCE, not on the state, and that is load-bearing.** A repealed
provision *whose text we hold* is still returned, with its REPEALED label — that is what Surface 1
is for, and suppressing it would destroy the repeal history the user came for. Today every repeal
record happens to be a dot leader, which makes the two rules look identical; the moment a real
repeal record lands with real text behind it they diverge, and keying on the state would silently
start hiding law. Two of the ten check cases assert precisely that.

The email now prints **`USABLE TEXT: 18,937,470 (19,186,726 ingested − 249,256 whole-body dot
leaders, 1.30%)`**, and prints `UNMEASURED` rather than a flattering total if a caller forgets to
supply the count.

### B3 — partially repealed sections, counted for the first time

**What a user would see:** Lex quotes a section as the law. Most of it **is** the law. One subsection
was repealed and the publisher marks it with a dot leader, and nothing says so. This is worse than
the B2 case, because it reads exactly like current law.

**Nobody had ever counted it.** `section_repeals` holds 249,256 rows and **every single one carries
`evidence = 'dot-leader-placeholder'`** — there is no column for the partial case and no row of it.

**Measured: 32,040 [95% CI 25,956–40,088]**, from 510 found in 15,000 bodies read — a random
stratified sample drawn in Postgres and resolved through `corpus_fts`, with Wilson intervals. C2's
uncounted estimate of ~35,895 lands inside the interval.

⚠ *A `body LIKE '%. . .%'` scan over the six legislation collections was tried first and did not
return within 120 seconds; reading 1.6M bodies from R2 is hours. The sample is stated as a sample.*

### ⚠⚠ B2's 249,256 IS A FLOOR — AND THE SAME BUG HAS NOW WORN THREE COSTUMES

Reading the bodies the partial census flagged — rather than trusting the count — showed **4 of 60
were whole-body dot leaders**:

```
12ZA  . . . .      234ZA  . . . .      502GC  . . . .      164FG  . . . .
```

`ZA`, `GC` and `FG` are each a run of two letters, so *"no word of two or more letters"* read them as
words and the section as live law. **One letter was always fine** (`12A . . . .` matched), which is
why it survived two previous fixes:

| when | the costume | example |
|---|---|---|
| V36 | the bare number | `31 . . . .` |
| C2 Lane 2 | the provision **label** | `Article 31 . . . .` |
| **C3** | the provision number's **own suffix** | `12ZA . . . .` |

Every fix has been *"strip one more leading thing"*. Projected miss: **~1,487** further whole-body
dot leaders, largest in `si-pre-2010` (~858).

⚠ **And the fix must not swallow live text.** V36's dangerous near-miss `5A . . . as amended . . .`
must stay non-hollow; the strip is bounded to a single leading digits-then-letters token so it can
never reach a word starting with a letter. `check:dot-guard` is **13/13** (was 7/7), and a new
`check:partial-guard` is **14/14** — including an explicit assertion that **no body can satisfy both
predicates**, and a case where **my own fixture was wrong before the code was** (`1. 2. 3.` puts a
digit between the dots, so it never matches a spaced leader; the fixture stays in the file saying so).

### B5 — the citation rewrite

**What a user would have seen:** a pre-1963 Act headed `ukpga/Geo4/5/83` instead of *Vagrancy Act
1824*.

**Measured before and after, through the real loaders:**

```
pre-2000 instruments resolving to a title:  54.2%  →  99.1%
  ukpga/Geo4/5/83      → Vagrancy Act 1824
  ukpga/Vict/24-25/97  → Malicious Damage Act 1861
```

⚠ **The brief's 14.0% does not reproduce.** `corpus_acts` and `LegislationItem` both sit at 54.2% of
instruments, and 79.5% at the section level. The repair is the same either way, and it is the
brief's own diagnosis — the regnal-year trap — that it repairs.

⚠⚠ **AND THE OBVIOUS FIX WOULD HAVE RESOLVED A TITLE AND THEN FETCHED NOTHING.** The gid is used to
fetch `{corpus}:{gid}:{ref}` by id. Measured:

```
ukpga/1824/83     title "Vagrancy Act 1824"   sections:  0
ukpga/Geo4/5/83   title (none)                sections: 20
```

So "Section 4 Vagrancy Act 1824" would resolve cleanly and return **zero rows** — a miss that
presents to the user as *"we do not hold it"*. **My first repoint tested membership of the titled gid
set, which by construction contains the calendar form, so it never fired.** It now tests
`corpus_acts.section_count > 0`, and **1,575 citations repoint** to the form that holds text.

⚠ **The pairing is the publisher's own**, from `v36/source-entries.json` (`docId` + `calendarId` per
entry), never a title-similarity match — `citation-resolver.ts` already records 173 normalised
titles carrying more than one gid.

`npm run check:b5-regnal` is **7/7 including a calendar-Act control** (Human Rights Act 1998, which
must be untouched).

⚠ **NOT DELIVERED.** `loadActTitles` is read at **index build** time and the title is baked into the
`corpus_fts` body. The resolver is fixed; a search result is not. Step 8 of `C3_EXECUTE.sh`.

### B6 — the two unreachable treaty collections: **report before fixing**, as asked

Verified **live and two-sided**, not read off the code comment:

| probe | `uk-treaties` | `tax-treaties-dta` |
|---|---|---|
| scoped to its own corpus (control) | **20/20** | **20/20** |
| through the DEBATES stream scope | **0/20** | **0/20** |
| through the COMMITTEES stream scope | **0/20** | **0/20** |
| tier filter alone, no stream exclusion | **3/20** | **4/20** |

⚠ *My first probe counted hits rather than hits **from that collection**, and reported 10 for a scope
that excludes the collection by name. A stream returns 20 rows whatever happens.*

**Mechanism:** both sit in the `parliamentary` tier, are named in `NON_DEBATE_PARLIAMENTARY` (so
`debates` excludes them) and are not in `COMMITTEE_CORPORA` (so `committees` never selects them). No
stream can reach them at any setting. The last row is the important one: **with the tier filter alone
they win 3 and 4 of 20** — they earn their place when allowed to compete, so this is a scope
decision, not a ranking problem.

⚠⚠ **THE STATED BLOCKER IS GONE AND THE CODE COMMENT IS STALE.** `corpus-map.ts` says this
*"cannot be measured today: the validated set has ZERO debates questions"*. **Gold v2 shipped 11
debates questions (Q1–Q11) on 22 August.** The decision is now measurable with a before-and-after.
**Decision D-2.**

### B1 — the coverage boundary: **NOT DONE**

The brief costs it at ~2 days. It is not started. What C3 contributes is one boundary the brief did
not have — see Lane C2 — recorded in `docs/CORPUS_SCOPE.md`.

---

## LANE C — THE CHEAP FETCHES

### C2 — the 503 employment tribunal decisions

**200 probed (systematic every-2nd sample, id-ordered, not the head):**

```
  has-pdf           21   10.5%
  no-attachment    179   89.5%
  gone               0    0.0%
  error              0    0.0%
→ projected across all 503: 53 have a real judgment PDF to re-fetch.
```

⚠ The classification is made from the content API's own fields, not the status code — *an error is
not an absence*, and a freshness probe manufactured two "gone" verdicts out of 403s on 17 August.
Here there were **zero** of both.

**And the shape of the 179 is the interesting part, measured rather than eyeballed:**

- **131 of 179 (73.2%) are Scottish tribunals** — against **1 of 21** among those with a PDF.
- **134 of 179 carry a 6-digit case number** (the old Scottish numbering, e.g. `114940/2006`); **all
  21** with a PDF are 7-digit.
- **105 of 179 are from 2006.** The PDFs are 2013–2018.

**This is a coverage boundary, not a fetch failure.** gov.uk publishes pre-~2013 Scottish employment
tribunal decisions as a **title-only listing with no judgment attached, ever.** Recorded in
`CORPUS_SCOPE.md`. Re-fetching ~53 is worth doing; re-fetching 503 is not a thing that exists.

### C3 — the House of Lords archive: **gate 1 is RED**

The brief gates this on Cloudflare and says *"pilot 20 documents before planning around any route."*
The pilot cannot start:

```
403  node default  publications.parliament.uk/pa/ld/ldjudgmt.htm         ⚠ CLOUDFLARE CHALLENGE PAGE
403  browser UA    publications.parliament.uk/pa/ld/ldjudgmt.htm         ⚠ CLOUDFLARE CHALLENGE PAGE
403  node default  .../pa/ld199697/ldjudgmt/jd970206/index.htm           ⚠ CLOUDFLARE CHALLENGE PAGE
403  browser UA    .../pa/ld199697/ldjudgmt/jd970206/index.htm           ⚠ CLOUDFLARE CHALLENGE PAGE
403  node default  https://www.parliament.uk/                            ⚠ CLOUDFLARE CHALLENGE PAGE
403  browser UA    https://www.parliament.uk/                            ⚠ CLOUDFLARE CHALLENGE PAGE
```

**Every host, including the site root, with and without a browser User-Agent.** Spoofing the UA
changes nothing — it is TLS fingerprinting, as our own `committees-freshness.ts` already documents.
**Reported, not built around.** The quality gate (gate 2) was deliberately *not* written against
invented fixtures: a gate whose test data I made up is a gate tested against my imagination, and the
brief is right that this is exactly how the case-law stylesheet survived for months. It needs real
bytes first.

### C1 (building-regs) and C4 (stylesheet re-embed): **NOT STARTED.**

---

## LANE D — THE LEGISLATION BACKFILL: **NOT STARTED**

7,924 `classb` instruments, single-threaded, ~7.5 hours. Nothing was fetched and nothing was spent.
The prediction has not been logged, so **it must be logged before the run**, not reconstructed after.

---

## LANE E — PLUMBING

**E1 — drop `ftsVector`. Audited, guarded, blocked.** 1,178 MB across 683,153 of 18,521,194 rows
(3.7%). Three facts measured: **there is no index on the column at all**, so Postgres could never
have answered a search from it; **the maintaining trigger function is a literal no-op**
(`BEGIN RETURN NEW; END;`), gutted when `compiledText` was dropped, which is why 96.3% of rows are
null; and the serving path is LanceDB. `scrutinise-web/lib/search.ts` reads `ls."ftsVector"` and
`os."ftsVector"` — **`LegislationSection` and `OperationalSection`, different tables**, untouched.

The script re-derives all three and **refuses if any has changed**; watched refusing on a simulated
index (`--simulate-index-exists` → `⛔ REFUSING TO DROP`, exit 1). ⚠ `DROP COLUMN` is metadata-only —
the database will not shrink today, and the script says so rather than claiming 6.2%.

**E2 — Senedd re-parse: NOT STARTED.** It renumbers ids and the brief makes the search-stream
handshake a prerequisite.

**E3 — the coverage line: DONE.** It now prints exactly what the brief asked for:

```
3,560 of 9,343 that have text — 38.1%; 7,279 more are published with no provisions
   (21.4% of all 16,622 published — 56% of that shortfall is the no-provisions class,
    so it is mostly NOT a closable gap)
```

⚠ **My first version appended "NOT a closable gap" to all six collections and it is false for
`si-pre-2010`** — 32 of a 26,732 shortfall are textless, 0.1%, so almost all of that gap *is*
closable. The note is now a measured share and fires only above 50%. A warning that fires everywhere
warns about nothing.

**E4 — delete the storage warning: ALREADY DONE, by GRAPH 3C.** `progress-reporter.ts` prints
`$/month` at `STORAGE_RATE_USD_PER_GB_MONTH = 0.35` with its source and date, and states *"There is
NO storage cap on this plan; Neon's enforced ceiling is 16,384 GiB."* `serve-observer.ts` replaced
its 17.5 GiB constant with a $ alert. Nothing to do; verified rather than assumed.

---

## LANE F — ONE REGISTER

**F4 — DONE, and generated rather than hand-built.** `docs/CORPUS_SCOPE.md` comes from
`census/build-corpus-scope.ts`: counts and dates from the live database on every run, the declared
wording in code where a change shows in a diff. **23 declared · 48 NOT DECLARED · 77 live** — and the
backlog number is printed first so it cannot be skimmed past. `docs/OPEN_ITEMS.md` is written, with
14 items, each naming what a user sees and who decides.

⚠ **An incidental finding straight off the live table: `historic-hansard`'s earliest `itemDate` is
`1013-06-24`.** Almost certainly `1913`. Nobody has looked. It corrupts any date-range facet over
that collection. OI-9.

**F1, F2, F3 — NOT DONE.** The reconciliation, the corrections and the workbook generator are not
started. Two corrections this sprint can contribute to them:

- **`et-decisions` counts.** The brief's F2 says the workbook's *"131,654 of 293,403"* should read
  *"131,650 of 293,399"*. Measured: **131,650 landing pages, 293,403 rows total, 293,399 compiled.**
  Both numbers in the brief's correction are right, but they are counting different things — 131,650
  is of all rows, 293,399 is of compiled rows. The four-row difference is the `format=null`,
  `status='unavailable'` rows. Say which denominator or the correction re-introduces the confusion.
- **`ots-reports`** is not "≥69 of 497 are news and speeches". It is **421 of 497 published by
  somebody else** (above).

---

## SOLVED / NOT SOLVED / NEXT

**Solved (measured, artefact on disk, check watched failing first).**
The B2/B4 retrieval exclusion, keyed on evidence rather than state, 10/10 after 8/2 · the B3
population, **32,040 [25,956–40,088]**, counted for the first time · the third costume of the
dot-leader bug and its ~1,487-row floor correction, with a 13-case guard and a 14-case disjointness
guard · B5, **54.2% → 99.1%** with 1,575 citations repointed to the id form that holds text, 7/7
with a control · B6's mechanism, verified live and two-sided, **and its stated blocker refuted** ·
the `ots-reports` classification, 497 of 497, and the seeder line that caused it · the 503 ET
orphans, **10.5% fetchable**, and the Scottish pre-2013 boundary behind it · E3 · E4 confirmed
already done · F4 · the purge staged across all three layers with the counts proven · **the
quoted-identifier silent no-op**, which would have made the whole purge report success.

**Not solved / not attempted.**
**Lane A's execution** and every other production write — blocked by the classifier, staged in
`C3_EXECUTE.sh` · `ots-reports`, a decision not a step (D-1) · **B1** the coverage-boundary
declaration (~2 days) · **C1** building-regs · **C3** beyond gate 1 · **C4** the $31 re-embed ·
**Lane D** in its entirety · **E1** and **E2** · **F1, F2, F3**.

**Next.** Run `C3_EXECUTE.sh`. Then B1, then Lane D — which C1 has already re-costed at ~91,500
sections and $1.33.

---

## DECISIONS FOR CHARLIE

**D-1. `ots-reports`: delete the 421 rows the publisher says are not OTS, or the 68 the brief names?**
▶ **Recommend: the 421.** The collection's *name* is a claim about provenance, and *Spain travel
advice* filed as an OTS report is worse than absent. All 76 genuine OTS documents survive; 273 of
the 421 are duplicates of collections that hold them properly.
*Consequence of the brief's rule instead:* 27 genuine OTS press releases are destroyed and 380
non-OTS rows keep serving — the worst of both.
*Consequence of doing nothing:* a tax-simplification question can be answered with a passport page.
*Cost of the recommendation:* 148 rows leave the corpus entirely. Most are transactional gov.uk
pages; ~50 are substantive documents filed under the wrong collection, and those belong to
`consultations` or `govuk-content`, re-ingested from the right source, not retained under a false label.

**D-2. The two treaty collections — admit TREATY to the debates stream, or build a sixth stream?**
▶ **Recommend: measure it now and decide on the number.** The blocker of record is gone: Gold v2 has
11 debates questions, so a scope change can ship with a before-and-after, which S11 established as
the rule. A tier/type admission costs nothing per query; a sixth stream costs one extra retrieval
call against `vector-serve`'s concurrency cap of 4.
*Consequence otherwise:* 3,574 sections stay unreachable at any setting, while their sibling
`uk-treaties-fcdo` answers treaty questions because it happens to be typed DEBATE.

**D-3. The ~1,487 whole-body dot leaders B2 never held — write them, and also remove them from the index?**
▶ **Recommend: write the records now (step 7), and do NOT touch the index yet.** The gateway
exclusion is live off `section_repeals`, so writing the records stops them being returned
immediately, at zero risk. Deleting them from `corpus_fts` moves BM25 document frequencies for the
whole table and voids every recall number taken before it.
*Consequence otherwise:* they stay in the index costing query time, correctly, but invisibly.

**D-4. `historic-hansard`'s `1013-06-24` — investigate, or record and move on?**
▶ **Recommend: record it (OI-9) and move on.** It is one row's parse artefact and no user-facing
surface facets on that date today. It becomes urgent the moment a date filter ships.

**D-5. Lane D's prediction has not been logged. Log it before the run, or run and score after?**
▶ **Recommend: log first, without exception.** The standing rule exists because a prediction written
after the measurement is not a prediction. Lane D is the single largest remaining piece of work in
the ingest stream and the one where a wrong cost estimate is expensive.

---

## SCORING THE PREDICTIONS

Logged at 00:35 UTC before anything ran (`CHANGE_LOG.md`).

| # | prediction | outcome |
|---|---|---|
| 1 | E1 `DROP COLUMN` under 5s | **UNSCORED** — refused by the classifier |
| 2 | DB size does not fall today | **UNSCORED** — same |
| 3 | all eight collections match exactly | ✅ **CORRECT** — 168,569, 8 of 8 |
| 4 | compiled → **18,103,883**, not the brief's 18,103,866 | ✅ **CORRECT arithmetically** (all 168,569 rows confirmed `status='compiled'`); unverified until the purge runs |
| 5 | `corpus_fts` deletes 6–20 min | ⚠ **PARTLY REFUTED.** Counting alone took **8.2 min** on `corpus_fts` — inside the range — but the whole dry run was **15m53s**, and the basis was wrong: my 8.0 s probe was sound, but see 6 |
| 6 | chunks + vec under 5 min combined | ❌ **REFUTED — 7.4 min**, and the reason matters: the 0.2–0.3 s probes it rested on used **quoted identifiers and were measuring nothing**. A prediction resting on a broken measurement |
| 7 | `verify-retired-gone` 0/3 → 3/3 | ⚠ **HALF SCORED.** Watched at **0/3** with both sides sound. The 3/3 half cannot be scored until the purge runs |
| 8 | the purge voids every prior recall baseline | ✅ stands, unchanged |
| 9 | `ots-reports` deletion lands in **60–110** | ❌ **BADLY REFUTED — 421.** I predicted the brief's framing rather than measuring the collection. The brief's *rule* does yield **68**, inside my range, which is the only reason the range looked reasonable |

**Two of nine refuted, both because a measurement underneath them was wrong rather than because the
world surprised me.** Prediction 6 is the instructive one: it was derived from a probe that returned
in 0.2 s *because it matched nothing*, and a suspiciously good number was taken as good news instead
of as a question.
