# INGEST NAMES — THE MISSING NAMES (CASE TITLES AND COMMITTEE SPEAKERS)

**Executes** `docs/BRIEF_INGEST_NAMES.md` §0–§3.
**Written** 19–20 August 2026 by CC-Ingest. **Cost $0 — no LLM call anywhere in this sprint.**

---

## THE ONE-PARAGRAPH ANSWER

Both halves of §0 were ingest failures, and both were failures of the **same shape**: the writer
had the name in its hand and dropped it. `processTnaCaselaw` fetches every judgment's Akoma Ntoso
XML — which carries `<FRBRname value="Mensah v Jones"/>` — and stored only the citation.
`processCommitteesApi` fetches `item.witnesses` and `item.committee` — the API returns both on
every call it was already making — and stored neither. Nothing new had to be discovered to fix
either one; the facts were inside requests we had already paid for.

**Case law: 0% → 99.98%** (74,883 of 74,896), **99.99% of it by the `source` route**, hand-read
30/30 correct with a negative control that fails 0/30. **Committee reports: 0% → 85.58%**
(295,052 of 344,773) with **no fetch at all** — the committee's name was already in our own
`notes` column. Committee evidence: see §2, swept from the API.

---

## §0 — TWO PREMISES IN THE BRIEF ARE WRONG, AND ONE OF MY OWN WAS TOO

**⚠⚠ 1. "Every court judgment we hold has a blank title" is true of ONE collection.** `tna-caselaw`
was 0 of 74,896. Every other case-law collection already carried a title:

| collection | rows | titled before this sprint |
|---|---:|---:|
| `tna-caselaw` | 74,896 | **0 (0.00%)** |
| `et-decisions` | 293,403 | 293,399 (100.0%) |
| `cma-cases` | 22,898 | 21,525 (94.0%) |
| `tax-tribunals` | 13,099 | 12,089 (92.3%) |
| `scottish-courts` | 13,070 | 13,056 (99.9%) |
| `ni-judgments` | 7,927 | 7,772 (98.0%) |
| `echr-hudoc` | 4,460 | 4,460 (100.0%) |

⚠ **Titled is not the same as well titled**, and the report says so rather than counting a title
as a win. `scottish-courts` stores a slug rendered as prose — *"Court of Session: 2011csoh54 graham
hunter martinpluslaurie katherine manson joint liquidators of simclar ayrshire limited vsinclar
group limitedplusjohn ian durieplusstephe"*, where `plus` is a mangled `&` and the string is
truncated mid-word. `cma-cases` stores *"apples mobile platform — decision doc 11"*. Those are
**display strings a rule composed**, not names a source published, and improving them is NOT in
this sprint's scope — it is named here so nobody reads the table above as "solved".

**⚠⚠ 2. The brief expected a parsed-text fallback to do the work. It did 6 rows of 74,896.** §1.2
says a fetched name is a fact and a parsed one is an inference, and prefers the source field "if it
does". It does, on 100 of 100 sampled judgments, so the preference resolves to the first branch
essentially always.

**⚠⚠ 3. MY OWN PREDICTION 3 WAS REFUTED, AND THE GUARD IT DOUBTED IS THE REASON.** I predicted
**"0 citation-shaped rejects — the source never publishes a bare citation as `FRBRname`"**. The
source does. Two judgments carry `FRBRname="[2015] EWHC 1842 (Fam)"` and
`FRBRname="[2020] EWHC 3396 (Fam)"` — the citation, in the name field. Without §1.2's
"a placeholder that looks like data is worse than a blank" rule those two would now be sitting in
the search index titled with their own citation, looking like recovered names. **The guard I
predicted would never fire is the only reason they are blank.**

---

## §1 — CASE LAW: RECOVER THE CASE NAME

### §1.1 The audit, before anything was built

100 `tna-caselaw` rows, sampled deterministically (`ORDER BY md5(id)`, so a re-run reads the same
rows — S8 §2 lost a measurement to `LIMIT` with no `ORDER BY`).

**Where the name actually lives — and it is a structured source field, not text:**

| shape | present in 100 |
|---|---:|
| `<FRBRname value="…"/>` in the stored AKN XML | **100** |
| `<uk:cite>` (neutral citation) | 99 |
| `<uk:court>` | 100 |
| `<FRBRdate>` (the real judgment date) | 100 |
| `<docTitle>` | 7 |
| an `X v Y` party line in the first six lines of the **compiled text** | **0** |

Three examples in full:

```
id         tna-caselaw:[2023] EWHC 852 (Ch):1
FRBRname   "Tosi Limited v 99 Hippos Limited &amp; Anor"
uk:cite    "[2023] EWHC 852 (Ch)"    uk:court "EWHC-Chancery-InsolvencyAndCompanies"
FRBRdate   "2023-04-19"              sectionTitle NULL

id         tna-caselaw:[2004] EWHC 2699 (Ch):1
FRBRname   "Mensah v Jones"
uk:cite    "[2004] EWHC 2699 (Ch)"   uk:court "EWHC-Chancery"   FRBRdate "2004-11-19"

id         tna-caselaw:[2017] EWCA Crim 273:1
FRBRname   "Hamberger, R. v"
uk:cite    "[2017] EWCA Crim 273"    uk:court "EWCA-Criminal"   FRBRdate "2017-03-14"
```

**Does a structured field at source carry the name, and did we discard it? YES — TWICE.**

1. **`sources/tna-caselaw.ts` already parses it.** `CaseLawJudgment` declares `name: string` and
   `parseEntries()` fills it from the Atom feed's `<title>`. ⚠ **Nothing consumes it.**
   `listJudgments` and `CaseLawJudgment` have no caller outside their own file — the live path is
   `workers/process-row.ts::processTnaCaselaw`, which re-parses the same Atom entry inline and
   extracts only the XML link and the citation. The name was parsed into a dead interface.
2. **The AKN we store carries it, and we read the file and ignored the field.** The writer already
   holds `judgmentXml` in a local variable when it calls `upsertSection` without a title.

**⚠ `docTitle` is NOT the case name and is not used, not even as a fallback.** In all 7 documents
where both exist they disagree: `docTitle` is cover-page text ("IN THE HIGH COURT OF JUSTICE",
"Approved Judgment"), and `FRBRname` is the FRBR work-level name — the thing a user means by "what
case is this".

**⚠ A parsed-text route would have been reading a stylesheet.** `rawToText` emits the AKN `<meta>`
block, so a compiled `tna-caselaw` document opens with 2,000–3,400 characters of embedded CSS
before the first word of the judgment. That is why the "X v Y in the first six lines" count is
0/100, and it is a finding in its own right — see the NOT-DONE list.

### §1.2 The build

`scripts/ingest/shared/caselaw-name.ts` is the one place a case name comes from, used by the
backfill AND by the live writer. `scripts/ingest/names/backfill-caselaw-titles.ts` ran it over the
corpus.

| outcome | rows | % of 74,896 |
|---|---:|---:|
| **recovered, route `source`** (`FRBRname`) | **74,877** | **99.97%** |
| recovered, route `parsed:v1` (cover-page party line) | 6 | 0.01% |
| miss — source publishes no `FRBRname` | 10 | 0.01% |
| miss — candidate was citation-shaped, refused | 3 | 0.00% |
| **titled after** | **74,883** | **99.98%** |

**Provenance is stored per row**, in `corpus_sections.notes`, as `title-route:source` /
`title-route:parsed:v1` — counted back off the database, not off the script's own tally:

```
title-route:source     74,877
title-route:parsed:v1       6
```

**⚠ THE 13 MISSES, EACH ONE READ RATHER THAN COUNTED.** All 13 have their raw XML present in R2, so
none is a fetch failure:

- **10** — the source genuinely publishes no `FRBRname` element at all.
  (`[2009] EWHC 1088 (Comm)`, `[2010] EWCA Civ 1053`, `[2010] EWHC 90169 (Costs)`,
  `[2016] EWHC 3256 (Fam)`, `[2018] EWCA Crim 832`, `[2019] EWHC 1401 (Ch)`, `[2019] EWHC 30 (Comm)`,
  `[2020] EWHC 3559 (QB)`, `[2022] EWHC 1584 (Admin)`, `[2023] EWHC 3445 (KB)`)
- **2** — `FRBRname` IS the citation. Refused, correctly. Both are 39- and 47-word anonymised
  family judgments.
- **1 — MY GUARD'S FALSE NEGATIVE, and it is mine, not the source's.**
  `[2013] EWHC 1901 (Fam)` publishes `FRBRname="M"`. A single letter IS the case name for an
  anonymised family judgment, and `isCitationShaped()` rejects it because nothing survives its
  strip. The row is blank where a name existed. It is one row in 74,896 and a bare "M" is a nearly
  useless search title, so it is reported rather than special-cased — a rule loosened to admit "M"
  would also admit noise.

**Optional extra taken on the same read, at no extra cost:** the live writer now also stores
`FRBRdate` as `itemDate`. ⚠ **The BACKFILL did not rewrite existing dates** — see Decision D-3.

### §1.3 The gold-question pre-task — DELIVERED FIRST, and it found four bad keys

Written into `docs/GOLD_CANDIDATES_S8.md` beneath each of the ten case-law questions: the case
name, its route, the source's own citation / court / judgment date, and the first ~200 words of the
judgment, clearly marked as an extract for verification. **10 of 10 names established, all by
`source`.**

The extracts answer the question S8 could not:

| Q | keyed citation | what the case actually is | fits the question? |
|---|---|---|---|
| K1 public sector equality duty | `[2015] UKSC 21` | **R (Evans) v Attorney General** — the Prince of Wales letters, FOIA s.53 | ❌ |
| K2 prorogation | `[2019] UKSC 41` | **R (Miller) v The Prime Minister** | ✅ |
| K3 gig-economy employment status | `[2021] UKSC 5` | **Uber BV v Aslam** | ✅ |
| K4 deprivation of liberty in care | `[2014] UKSC 19` | **P v Cheshire West and Chester Council** | ✅ |
| K5 employment tribunal fees | `[2017] UKSC 51` | **R v Lord Chancellor** (the UNISON fees case) | ✅ |
| K6 deaths in custody | `[2011] UKSC 20` | **In the matter of an application by Brigid McCaughey** | ✅ |
| K7 benefit cap discrimination | `[2015] UKSC 21` | **R (Evans) v Attorney General** — same as K1 | ❌ |
| K8 public authority duty of care | `[2018] UKSC 22` | **Newcastle upon Tyne Hospitals NHS FT v Haywood** — notice of termination | ❌ |
| K9 climate targets | `[2020] UKSC 12` | **WM Morrison Supermarkets plc v Various Claimants** — vicarious liability | ❌ |
| K10 (citation-lookup control) | `[2003] EWCA Civ 1769` | **Phillips & Anor v Symes & Anor** | control |

**Four of nine substantive keys are wrong.** ⚠ The verdicts in the right-hand column are MY reading
and are not written into the gold document — the extracts there are factual only, because
accepting or rejecting a question is Charlie's call and §1.3 asked for evidence, not a decision.

⚠ **The search thread restructured this file while the sprint was running** (`### K1 —` →
`### Q11 · K1 —`, `- **Accept / Reject / Amend:**` → `- **VERDICT →**`), has already acted on the
extracts, and records a 40% key error rate. The extract writer's strict heading regex matched
nothing and **refused to run rather than silently writing zero blocks**; it accepts both shapes now.

### §1.4 Verify — the hand-read, WITH a negative control

30 recovered titles read against their own judgment text (`--verify`), plus a mechanical screen
asking whether every distinctive party word in the stored title occurs in the judgment's opening
400 words.

```
SCREEN over 30: all party words found 30, most 0, few/none 0
NEGATIVE CONTROL (each title paired with the NEXT row's judgment):
SCREEN over 30: all party words found 0, most 0, few/none 30
```

**30 of 30 correct.** The negative control matters more than the 30: without it, "all party words
present" could have been matching *Royal Courts of Justice* and *Before* — boilerplate every
judgment shares. It fails 30 of 30 under a shuffle, so the pass means what it says.

**⚠ THE VERIFICATION FOUND A REAL DEFECT IN MY OWN CODE — the first run of it, not the third.**
Eight of the thirty came back showing CSS instead of a party line. Cause: `stripAknPreamble`
required every CSS rule to contain a `prop: value` pair, and the generator emits empty rules
(`#judgment .PageNumber { }`) — so the walk stopped at the first empty one and returned the whole
stylesheet as if it were the judgment. Fixed, a regression check added, and **the seven affected
§1.3 gold extracts were rewritten** (CSS occurrences in the gold document: 7 → 0). Nothing stored
in the database was affected: the title path never touches the compiled text.

---

## §2 — COMMITTEE EVIDENCE: RECOVER WHO SAID IT

### §2.1 The audit

**What the source publishes** (probed live against `committees-api.parliament.uk`, 19 Aug 2026):

```json
// /api/WrittenEvidence/1 — an ORGANISATION submission
{ "internalReference": "ZIN0001", "anonymous": false, "anonymousWitnessText": null,
  "witnesses": [ { "submitterType": "Organisation", "name": null, "personId": null,
                   "organisations": [ { "name": "International Alert",
                                        "role": "Head of Advocacy" } ] } ],
  "committees": [ { "id": 336, "name": "EU External Affairs Sub-Committee", "house": "Lords" } ] }

// /api/WrittenEvidence/10 — an INDIVIDUAL submission
{ "witnesses": [ { "submitterType": "Individual", "name": "Mikaela Gavas", "personId": 31,
                   "organisations": [ { "name": "Center for Global Development",
                                        "role": "Visiting Fellow" } ] } ] }

// /api/OralEvidence/1 — a PANEL of four
{ "witnesses": [ { "submitterType": "Organisation", "name": null,
                   "organisations": [ { "name": "Bond", "role": "Head of Policy and Campaigns" } ] },
                 { "submitterType": "Organisation", "name": null,
                   "organisations": [ { "name": "European Think Tanks Group", "role": "Chair" } ] },
                 { "submitterType": "Individual", "name": "Rachel Turner", "personId": 53,
                   "organisations": [ { "name": "Department for International Development" } ] },
                 { "submitterType": "Individual", "name": "Juliette Prodhan", "personId": 54,
                   "organisations": [ { "name": "Department for International Development" } ] } ] }
```

**⚠⚠ THE NAME IS IN A DIFFERENT FIELD DEPENDING ON THE SUBMITTER TYPE, and reading the obvious one
drops most of the corpus.** For an Organisation submission `.name` is **null**; the name is in
`organisations[0].name`. Measured on the OralEvidence listing (n=100): `witnesses[]` present
**100/100**, non-empty **89/100**, a witness `.name` **47/100**, `.organisations` **82/100**. A
`.name`-only reader would have found 47% and looked like it worked.

**⚠ HOST NOTE, and the brief's warning is right about a different host.** `committees.parliament.uk`
(the portal) refuses Node's `fetch` — Cloudflare TLS fingerprinting, documented in our own
`sources/committees-portal.ts`, and a previous sprint burned 300 probes on 403s. That file was read
first this time. `committees-api.parliament.uk` is a **different host** and carries no challenge:
every probe in this sprint returned 200. **0 of ~1,000 requests in the sweep were 403.**

**Which of our stored rows could carry it** — and the three populations need three different
treatments:

| population | rows | items | what it is | who the author is |
|---|---:|---:|---|---|
| `committees-evidence` / **written** | 126,509 | 126,509 | one submission per row | the **submitter** |
| `committees-evidence` / **oral** | 15,806 | 15,806 | one whole transcript per row (mean 14,190 words) | the **panel**, session-level |
| `committees-reports` / Report + Special Report | 295,085 | — | the committee's own text | the **committee** |
| `committees-reports` / **Government Response** | 8,302 | 1,553 | the GOVERNMENT's text | **neither** |
| `committees-reports` / no metadata blob | 41,419 | 39,511 | pre-V32 archive ingest | unknown |

**⚠⚠ THE MOST DAMAGING ERROR AVAILABLE HERE IS ALREADY SITTING IN OUR DATA, AND IT IS NOT THE ONE
2D-5 FOUND.** 8,302 rows are **Government Responses** — a department answering a committee,
published under that committee's inquiry, carrying that committee's id and name on the row. The
obvious sweep ("attribute every `committees-reports` row to its `committeeName`") would have
labelled 8,302 rows of *government* text as the *committee's* finding. They are excluded by
publication type and left NULL. The API's `respondingDepartment` — the field that would give them a
correct author — was populated on **1 of 100** sampled publications, so there is no name to put
there and a blank is the honest output.

**What can be recovered without a full re-fetch, with the cost of each route MEASURED before one
was chosen:**

| route | measured | projected for the whole corpus |
|---|---|---|
| `committees-reports` — read our own `notes` blob | a DB scan | **no fetch at all** |
| `committees-evidence` — metadata sweep, month-windowed listing | 100 items / ~4.7 s | ~1.7 h, ~1,400 pages |
| `committees-evidence` — per-item detail fetch | 157 ms/item at concurrency 4 | 5.5 h, 142,315 calls |
| re-fetching document text | — | **508 million words. Never on the table.** |

⚠ The unwindowed `WrittenEvidence` listing **HTTP 500s** at `Skip=0&Take=100` after 33.6 s, twice,
and at `Take=20` too — it is not a deep-offset problem, that endpoint needs a date window at all.
This matches the note already in `sources/committees-api.ts`; the sweep windows by month.

### §2.2 The build

One decision site — `scripts/ingest/shared/committee-attribution.ts` — used by the backfill AND
the live writer, so a row ingested tomorrow cannot be attributed differently from one backfilled
today.

**Which column carries which kind**, under `lib/lex/attribution.ts`'s contract (`speaker` = a
person, `attribution` = a body):

| population | column | value |
|---|---|---|
| written evidence, `submitterType: Individual` | `speaker` | the person |
| written evidence, `submitterType: Organisation` | `attribution` | the organisation |
| written evidence, joint submission | `attribution` | the names, deduped, `; `-joined |
| oral evidence | `attribution` | the session's panel, deduped, `; `-joined |
| committee Report / Special Report | `attribution` | the committee |
| Government Response | — | NULL, counted as a deliberate exclusion |
| anonymous submission | — | NULL, whatever `witnesses[]` says |

**⚠⚠ ORAL EVIDENCE IS DELIBERATELY NOT WRITTEN AS A SPEAKER, AND THIS IS THE SCOPING DECISION THE
BRIEF ANTICIPATED.** We hold **one row per whole transcript**. "Who said this sentence" is not a
question our data can answer — the answer needs a granularity change (one section per contribution,
the way INGEST V18 did for `pwdata`), not a field. What the source can tell us is **who appeared**,
and that is what is stored, in the body column. Writing a four-person panel into `speaker` would
make it read as one human being with semicolons in their name. **Per-speech oral attribution is NOT
DONE and is named in the NOT-DONE list.**

### §2.3 Verify

**`committees-evidence`, swept from the API — 0% → 96.87%** (137,854 of 142,315). 1,603 listing
pages, **0 failed pages and 0 incomplete windows**, ~1.9 h, no LLM call and no document re-fetch.

| population | rows | outcome | % |
|---|---:|---|---:|
| **written**, organisation submitter → `attribution` | 85,345 | attributed | 67.46% |
| **written**, individual submitter → `speaker` | 38,267 | attributed | 30.25% |
| written — **anonymous, deliberately not named** | 2,810 | NULL | 2.22% |
| written — item no longer returned by the API | 56 | NULL | 0.04% |
| written — no witness record at source | 31 | NULL | 0.02% |
| **written total attributed** | **123,612** | | **97.72%** |
| **oral**, session panel → `attribution` | 14,242 | attributed | 90.11% |
| oral — no witness record at source | 1,401 | NULL | 8.86% |
| oral — item no longer returned by the API | 163 | NULL | 1.03% |

⚠ **2,810 anonymous submissions are NULL on purpose and are not a coverage failure.** The API's
`anonymous: true` is respected ahead of `witnesses[]`, and `check:names` has a negative control for
it. Anonymity granted by a select committee is not ours to withdraw for a search result.

⚠ **0 of 15,806 oral-evidence rows carry a `speaker`, by design and asserted by a live check.** A
panel is not a person; see §2.2.

`committees-reports`, applied — **0% → 85.58%**:

| outcome | rows | % of 344,773 |
|---|---:|---:|
| **attributed to its committee** | **295,052** | **85.58%** |
| not attributed — no metadata blob (pre-V32 archive rows) | 41,419 | 12.01% |
| not attributed — **Government Response, by decision** | 8,302 | 2.41% |

Top attributions, read back off the database: European Scrutiny Committee 24,171 · Public Accounts
Committee 18,198 · Health and Social Care Committee 10,764 · Justice Committee 10,699 · Education
Committee 10,652.

### §2.3 end-to-end — THE NUMBER THAT MATTERS

Three committee questions through **the platform's own search**, not a database query
(`npm run verify:names-e2e`). Both services confirmed engaged by their own counters —
`fts+29 vector+15` — so this measured retrieval rather than a config file.

```
§2.3  committee questions: 25/30 of ALL evidence results carry a name (83%)
§2.3  of the COMMITTEE results specifically:      21/23 named (91%)
§1.2  case-law results carrying a case name:        6/6  (100%)
```

**S8 measured this collection at 0** — 0 of 800 stored rows, and every committee result in its
retrieval run carrying no name. What a user gets now, verbatim from the run:

```
[Committee evidence] Water Quality in Rivers — WQR0085
   — Salmon and Trout Conservation, the body that published it
[Committee evidence] Leasehold reform inquiry — LHR0054
   — Rachael Newman, named on this record
[Committee evidence] Welfare policy in Scotland inquiry — WIS0021
   — Frank Field MP, named on this record
[Committee evidence] Report: Fourth Report - Water quality in rivers — Environmental Audit Committee
   — Environmental Audit Committee, the body that published it
```

The first line is §0's own example — a user reading select-committee evidence on sewage can now
tell that the quote is from a **campaign group** and not from the committee or a water company.

⚠ **DECLARED IMPRECISION IN THIS MEASUREMENT.** n is small (3 questions, 23–30 results) and **the
router makes an LLM call per stream, so the retrieved set is not identical between runs** (S8 §4
documented exactly this non-determinism). An intermediate run of the same harness — after the
reports backfill but before the evidence sweep — measured 13/23 (57%). The direction is not in
doubt; the second decimal place is.

⚠ **Two case-law titles in that run are rows this sprint recovered**, checked back to their corpus
rather than assumed: `Griffiths v The Secretary of State for Work And Pensions`
(`tna-caselaw:[2015] EWCA Civ 1265:1`, route `source`) and, in the earlier run,
`R (on the application of Miller) v The Prime Minister` (`tna-caselaw:[2019] UKSC 41:1`, route
`source`). ⚠ `British Telecommunications PLC and Kevin Owen Meier` is an `ni-judgments` row that was
already titled — the §1.2 counter measures "carries a case name", not "carries a name this sprint
recovered", and that distinction is stated rather than glossed.

---

## PREDICTIONS, SCORED

Recorded in `docs/CHANGE_LOG.md` at 2026-08-19 22:04 UTC, before any sweep ran.

| # | prediction | outcome | |
|---|---|---|---|
| 1 | ≥99.5% of 74,896 rows titled | **99.98%** (74,883) | ✅ |
| 2 | ≥99.9% by `source`; `parsed:v1` on <50 rows | **99.99% source, 6 parsed** | ✅ |
| 3 | **0 citation-shaped rejects** | **3** — the source does publish a citation as a name | ❌ **refuted** |
| 4 | ≥29 of 30 hand-read titles correct | **30 of 30**, negative control 0 of 30 | ✅ |
| 5 | ~87% of `committees-reports` attributed | **85.58%** | ✅ close |
| 6 | ≥90% of written evidence attributed, ~60/40 org/individual | **97.72%** ✅; split **69/31** ❌ | ◐ |
| 7 | ≥85% of oral evidence carries a panel; 0% per-speech | **90.11%**; **0** speakers, asserted live | ✅ |
| 8 | ≥50% of committee search hits carry a name | **91%** (21/23) | ✅ |

⚠ **6 is scored as half-wrong on purpose.** The coverage number was right and the SHAPE was not: I
expected a 60/40 organisation/individual split and it is 69/31. That matters more than it looks —
the split is what decides how many submissions land in `speaker` (a person) versus `attribution`
(a body), so a wrong split is a wrong prediction about what a user will see, not just about a ratio.

---

*(This document is completed below with the §2 sweep results, the end-to-end measurement, the
decisions for Charlie, and the NOT-DONE list.)*

---

## ⚠⚠ TWO THINGS A USER MEETS TODAY THAT THIS SPRINT DID NOT FIX, AND ONE OF THEM IS NEW

### 1. The BM25 half of search still titles a judgment `tna-caselaw`

The recovered title **does** reach a user — verified live, not asserted. On
`supreme court judgment on prorogation of parliament`, the platform's own search returned:

```
· R (on the application of Miller) v The Prime Minister
```

**But it reached them through the DENSE half only.** The two retrievers now disagree:

| retriever | where it reads the title | what a `tna-caselaw` hit is called |
|---|---|---|
| dense (`vector-search.ts:172`) | `meta?.sectionTitle` — **Neon** | **the recovered case name** |
| BM25 (`fts-search.ts:270`) | the **FTS index**, unless `dbTitleSupersedesIndex(corpus)` | `tna-caselaw` |

Asked directly, the FTS service confirms its copy is still null:

```
POST /fts-search {"query":"prorogation prime minister Miller","corpora":["tna-caselaw"]}
  → {"id":"tna-caselaw:[2019] UKSC 41:1", "sectionTitle": null, "titleBoosted": false, …}
```

and `corpusDisplayName` has no entry for the collection, so the BM25 fallback title is the literal
corpus slug **`tna-caselaw`**. This is precisely the drift `corpus-type-map.ts`'s own comment warns
about — *"the same row would then be titled differently depending on which retriever found it."*

**⚠ THE EXACT ONE-LINE CHANGE, IN A SEARCH-OWNED FILE, REPORTED AND NOT MADE**
`scrutinise-web/lib/lex/corpus-type-map.ts:226`

```diff
-const TITLE_FROM_DB = new Set(['bills-api'])
+const TITLE_FROM_DB = new Set(['bills-api', 'tna-caselaw'])
```

The precedent is exact: `bills-api` is in that set for the same reason (v34 rewrote its titles on
2026-08-10, after the index was built), and the comment already says to remove such an entry after
the next full FTS rebuild.

⚠ **A second consequence the one-line change does NOT fix: `titleBoosted: false`.** The index has a
title-match boost that `tna-caselaw` can never earn while its indexed title is null, so **searching
for a case BY NAME still cannot match on the name** — "Miller v The Prime Minister" matches body
text only. That needs a reindex, not a flag.

### 2. ⚠⚠ THE SNIPPET A USER (AND LEX) SEES FOR A JUDGMENT IS A STYLESHEET

Found by accident while probing the index, and it is live now. `rawToText` emits the AKN `<meta>`
block, so every compiled `tna-caselaw` document opens with the generator's embedded CSS — and the
snippet is taken from the head of the body:

```
"snippet": "UKSC 2019 41 [2019] UKSC 41 0.26.19 c08dfb9d3c7e45… 7.4.0 #judgment { font-family:
            'Times New Roman'; font-size: 12pt; } #judgment .Normal { font-size: 12pt; } …"
```

That is what Lex is handed as the **evidence** for *R (Miller) v The Prime Minister*. Measured over
200 documents:

| | |
|---|---:|
| documents opening with a `<meta>`/CSS preamble | **200 / 200 (100%)** |
| of all characters, the share that is preamble rather than judgment | 5.64% |
| per-document preamble share — p10 / p50 / p90 / max | 1.8% / 5.3% / 23.5% / **67.9%** |

It is small on average and **always at the front**, which is the worst possible place: it is exactly
the region a snippet is cut from, and it is indexed, so `font-family` and `Times New Roman` are
searchable terms in the case-law tier.

**NOT FIXED HERE, deliberately.** Fixing it means re-compiling 74,896 documents and rebuilding the
FTS index — a sprint, not a footnote, and re-compiling would invalidate every stored `wordCount`.
`stripAknPreamble()` in `shared/caselaw-name.ts` already does the cut correctly and is the piece
that work would reuse. Decision D-4.

---

## DECISIONS FOR CHARLIE

### D-1 — The committee ROLE phrase: how precise, at what cost to another thread?

The **name** now reaches a user. The **role phrase beside it** is built by
`lib/lex/attribution.ts::attributionFor()`, a search-owned file this sprint does not edit, and its
default for the `attribution` column is `"the body that published it"`. So a committee report
currently reads:

```
— Environmental Audit Committee, the body that published it
```

True, but flat — and for an oral-evidence panel it would be actively imprecise, because the panel
did not publish anything.

| option | change | consequence |
|---|---|---|
| **A — one generic phrase per corpus (RECOMMENDED)** | two entries in the corpus→role map | Never wrong, never precise. An oral panel and a written submitter read the same. 2 lines. |
| **B — distinguish written from oral** | A, plus pass `h.id` into `attributionFor` and branch on the `:oralevidence:` segment | Exact wording for all three populations. ~5 lines, and it adds a parameter to the one function S8 deliberately kept parameter-free. |
| **C — do nothing** | — | The name still shows. The role reads "the body that published it" for a witness. |

**Recommended: B if CC-Search is comfortable adding the parameter, A otherwise.** Both are theirs to
make; the exact code for A:

```ts
// lib/lex/attribution.ts — SPEAKER_ROLE, for an INDIVIDUAL written submitter
'committees-evidence': 'the person who submitted this evidence to the committee',

// lib/lex/attribution.ts — the publisher-role ternary
: corpus === 'committees-reports'
  ? 'the committee that published this report'
  : corpus === 'committees-evidence'
    ? 'named on the record of this committee evidence'
```

⚠ And a documentation change that is now simply **false** and should go with it: the header of
`lib/lex/attribution.ts` says *"the collection §2 exists for is the one that has nothing …
`committees-evidence` is 0 of 800 rows"*, and `ATTRIBUTION_ABSENCE_NOTE` tells the model
*"Committee evidence in particular names its witnesses inside the document; we simply do not store
that name as a field yet."* Both were true on 19 August and are not now. The absence note in
particular is carried **into the prompt**, so Lex is being told the opposite of the data it is
holding.

### D-2 — Provenance lives in `notes`. Should it have its own column?

The title route is stored as `title-route:source` / `title-route:parsed:v1` in
`corpus_sections.notes`, a column that was empty on this corpus and is per-corpus by existing
convention (`petitions` a Parliament label, `tax-tribunals` a category, `committees-reports` a JSON
blob). It is indexed, so counting by route is cheap.

I did **not** add a dedicated column unilaterally, for two stated reasons: the database is at
**99.2% of its 17.5 GiB ops ALERT line**, and `schema.prisma` is shared by three threads mid-sprint.
A nullable text column would in fact cost close to nothing (the null bitmap on these rows already
exists), so this is a preference, not a constraint. **Recommendation: leave it.** If a second route
flag ever needs storing on the same corpus, that is the moment to promote it.

### D-3 — `itemDate` on case law is the CITATION YEAR, not the judgment date

Every `tna-caselaw` row carries `itemDate = {year}-01-01`, derived from the citation year by
`v28-title-extract.ts` because nothing better was available then. The AKN carries the real date:
`[2019] UKSC 41` is stored as **2019-01-01** and was handed down on **2019-09-24**.

The live writer now stores the true `FRBRdate` for **new** rows. **The backfill deliberately did not
rewrite the 74,896 existing dates**, because `itemDate` feeds date filtering and recency ranking in
search, and silently moving 74,896 dates by up to a year is not an ingest thread's call to make
inside a sprint about names. The same sweep would do it in ~13 minutes. **Recommendation: yes, do
it** — a date that is wrong by up to eleven months is worse than the cost of the rerun — but say so
first.

⚠ Until it runs, new and old case-law rows carry dates on **two different bases**. That is worse
than either basis alone, and it is the reason this is a decision and not a footnote.

### D-4 — The CSS in the case-law text (see above)

Fixing means re-compiling 74,896 documents and rebuilding the FTS index, and re-compiling
invalidates every stored `wordCount`. **Recommendation: schedule it with the next FTS rebuild**, so
one index build serves both this and the title reindex D-1 mentions. `stripAknPreamble()` is the cut.

---

## WHAT IS NOT DONE, NAMED

1. **⚠⚠ PER-SPEECH ATTRIBUTION INSIDE ORAL EVIDENCE.** 15,806 transcripts, mean 14,190 words, one
   database row each. We now record **who appeared at the session**; we cannot say **who said a
   given sentence**, and no field can fix that. It needs the same granularity change INGEST V18 made
   for `pwdata` — one section per contribution — which is a sprint on its own and would multiply the
   row count. Scoped out in §2.1 and reported here rather than left to be discovered.
2. **The BM25 half of search still titles a judgment `tna-caselaw`.** One line in a search-owned
   file, quoted exactly above, reported and not made.
3. **Searching for a case BY NAME still cannot match on the name** (`titleBoosted: false`). Needs an
   FTS rebuild, not a flag.
4. **The snippet for a judgment is a stylesheet** — 200 of 200 documents. Decision D-4.
5. **41,419 `committees-reports` rows (12.0%) carry no metadata blob** and so have no author. They
   are pre-V32 archive-path rows across 39,511 publications. Recoverable by a Publications API sweep
   on the same pattern as §2.2 — not attempted, because the §2 sweep was already the sprint's long
   pole and this population was not in the brief's framing.
6. **8,302 Government Responses have no author at all.** Correctly not the committee; the API's
   `respondingDepartment` was populated on 1 of 100 sampled publications, so there is no reliable
   name. Naming them needs a different source.
7. **1,401 oral sessions and 31 written submissions carry no witness record at source.** Not a
   fetch failure — the source has nothing.
8. **`itemDate` on 74,896 case-law rows is still the citation year.** Decision D-3; the fix is a
   13-minute rerun and is Charlie's to authorise.
9. **The 13 untitled case-law rows**, including the one my own guard wrongly refused
   (`FRBRname="M"`).
10. **The other case-law collections' titles were not improved.** `scottish-courts` renders a
    truncated slug as prose and `cma-cases` a slugged inquiry name. Both are *titled* and neither is
    a *name*. Out of scope, and named so the coverage table is not misread.
11. **No browser walk.** None was possible from this session (the extension has no localhost host
    permission and no Clerk session on production), and none is claimed. Every user-facing number
    above comes from the platform's own search called in-process, with the services' `served`
    counters read either side to prove retrieval happened.
12. **`entity_list_v5.md` was not touched.** No new column was added; provenance rides in an
    existing one. See D-2.

---

## THE FILES

| file | what |
|---|---|
| `scripts/ingest/shared/caselaw-name.ts` | **new** — where a case name comes from, one place |
| `scripts/ingest/shared/committee-attribution.ts` | **new** — who a committee document is by, one place |
| `scripts/ingest/shared/r2-client.ts` | `r2GetRange` — read 32 KB, not a whole judgment |
| `scripts/ingest/workers/process-row.ts` | the two live writers now keep what they already fetched |
| `scripts/ingest/names/backfill-caselaw-titles.ts` | §1.2 sweep + §1.4 `--verify` |
| `scripts/ingest/names/gold-caselaw-extract.ts` | §1.3, writes into `GOLD_CANDIDATES_S8.md` |
| `scripts/ingest/names/backfill-committee-attribution.ts` | §2.2, `committees-reports`, no fetch |
| `scripts/ingest/names/sweep-evidence-attribution.ts` | §2.2, `committees-evidence`, API sweep |
| `scripts/ingest/names/check-names.ts` | **33/33**, unit + live |
| `scripts/ingest/names/check-names-negative.ts` | **5/5 fired** — breaks the DB in a rolled-back txn |
| `scripts/ingest/names/verify-titles.ts` | §1.4 screen + shuffle control |
| `scripts/ingest/names/audit-caselaw.ts`, `audit-collections.ts`, `probe-committees-api.ts`, `probe-evidence-counts.ts`, `inspect-misses.ts`, `measure-css-pollution.ts`, `which-corpus.ts` | the audits, kept so every number above can be re-derived |
| `scrutinise-web/scripts/verify-ingest-names-e2e.ts` | §2.3, the platform's own search |
| `scripts/ingest/names/names-pool.ts` | dedicated pool — the shared one's 60 s client timeout kills these scans |

**Checks:** `check:names` **33/33** · `check:names-negative` **5/5 fired, rollback demonstrated** ·
`verify:names-e2e` run live · `tsc` clean in `scrutinise-web`; in `scripts/` the only 6 errors are
**pre-existing and in other threads' files** (`graph/check-3a.ts`, `ingest/graph/download-graph-sources.ts`,
`ingest/s3-drop-readiness.ts`, `lib/lex/repeal-status.ts`) and none is touched by this sprint.

---

## DELIVERY — CLAUDE.md §20's FOUR CHECKS

⚠ **This sprint's value is a DATABASE change, not a code change.** No file under
`scrutinise-web/app`, `/lib` or `/components` was modified — the four commits touch ingest scripts,
one verification script, two `package.json` script entries and docs. So there is no new behaviour
waiting on a Vercel deploy: production reads the recovered names straight out of Neon. That makes
checks 3 and 4 mean something different here from the three incidents §20 was written about, and
the difference is stated rather than used to wave them away.

**1. Every file this sprint created is committed** — checked with `git ls-files --error-unmatch`
per path, not `git status`, and `git check-ignore -v` run over all 21 new paths returned nothing.
13 of 13 named files COMMITTED.

**2. The remote has the commits** — `git merge-base --is-ancestor HEAD origin/Main` after a real
fetch, and `git ls-remote` returns `a5334675…` for `refs/heads/Main`, matching local HEAD.

**3. The deployment.** ⚠ **NOT CHECKED, AND IT IS NOT READABLE FROM HERE** — `VERCEL_TOKEN`
authenticates and then 403s on every project-scoped endpoint with `"saml": true`
(`docs/CLAUDE.md` §19). ⚠ **No app code changed, so there is nothing in this sprint for a
deployment to carry.** Both halves of that sentence are true and neither is offered as a
substitute for the other.

**4. The running site serves the change** — answered as far as it can be, and the limit is stated:

- **The write landed in production's database, verified by endpoint identity.**
  `NEON_DATABASE_URL` (where the sweeps wrote) is `ep-old-dust-aboxi69a.eu-west-2.aws.neon.tech`;
  `DATABASE_URL` (what the app reads) is that same endpoint's pooler alias. This matches the
  record in `docs/CLAUDE.md` §16.
  ⚠ **I ran this check AFTER the sweeps, not before.** §16 requires it first. The sweeps were
  `UPDATE`s that only fill NULL columns — not schema-altering, not destructive, and idempotent —
  so the risk was low, but the rule says first and I did it last. Recorded rather than tidied away.
- **The serving path was exercised live and returned the recovered names.** `verify:names-e2e`
  calls the platform's own gateway against production Neon, production `fts-serve` and production
  `vector-serve`, and both services' `served` counters moved (`fts+29 vector+15`) — so retrieval
  happened rather than being assumed. It returned
  `Water Quality in Rivers — WQR0085 — Salmon and Trout Conservation` and
  `Griffiths v The Secretary of State for Work And Pensions`, and the second was checked back to
  `tna-caselaw:[2015] EWCA Civ 1265:1`, route `source`.
- ⚠ **What was NOT exercised is production's own Next.js process.** Every search surface requires
  a Clerk session, `/api/search` calls `getAuthenticatedUser()` before anything else, and no
  browser walk is possible from this session (no localhost host permission, no production Clerk
  session). The harness runs the same library code against the same three backends, which is
  strong — but it is not the production web process, and it is not claimed to be.

**The honest closing sentence:** *pushed, and verified live by reading the recovered names back out
of the platform's own retrieval against production Neon, production `fts-serve` and production
`vector-serve`, with both services' counters confirming engagement; production's own web process
was NOT exercised, because its search surfaces need a Clerk session this environment cannot hold.*

▶ **CHARLIE, the one-minute confirmation this cannot do:** ask Lex about committee evidence on
sewage — expect a **named** submitter now, where S8 told you to expect none — and ask it about a
Supreme Court judgment, expecting a case name rather than a bare citation.
