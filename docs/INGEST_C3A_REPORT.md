# INGEST C3-A — RUNNING THE ADDENDUM

**Stream:** CC-Ingest · **Run:** 2026-08-26, 12:55–20:40 UTC
**Brief:** `docs/ADDENDUM_C3_AFTER_FIRST_PASS.md` (v2), read with `docs/BRIEF_INGEST_C3_EXECUTE.md`
and `docs/INGEST_C3_REPORT.md`
**Database:** Neon `ep-old-dust-aboxi69a` / `neondb` (§16 check first, output below)
**Spend:** **US$0.00 of the $150 embedding ceiling.** No embedding ran, no Lane D fetch ran.

**Artefacts:** `docs/census/C3A_lance_predicate_sweep.json` · `C3A_source_audit_rules.json` ·
`C3A_source_audit_live.txt` · `C3A_ots_orphans.json` · `C3A_ots_reseed_plan.json` ·
`C3A_freetext_seeds.json` · `C3A_d2_treaty_scope.json` · `C3A_lords_archive_list.json` ·
`C3A_lords_pilot.json` · `C3A_et_orphans_refetch.json` · `C3A_denominator_sweep.json` ·
`C3_ots_classification.2026-08-26T13-16-40-105Z.jsonl` · **`docs/C3A_EXECUTE.sh`**

---

## ⚠⚠ READ FIRST — THE STATE, AND WHAT IS STILL UNRUN

`docs/C3_EXECUTE.sh` **has still not been run.** Measured at 13:05 UTC, before anything else:

```
host      : ep-old-dust-aboxi69a.eu-west-2.aws.neon.tech
corpus_sections compiled : 18,272,526

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

All eight purge collections are at their full counts. Nothing has been deleted, and 168,569 rows
that are duplicates, landing pages or wrong-content are still being returned to users.

**And this session's own destructive step was refused the same way.** `c2/ots-filter.ts --apply
--execute` was attempted at 13:26 UTC and blocked by the auto-mode classifier. Everything is dry-run
proven and staged in **`docs/C3A_EXECUTE.sh`**, which runs **after** `C3_EXECUTE.sh`, not instead of
it.

▶ **CHARLIE: `bash docs/C3_EXECUTE.sh`, then `bash docs/C3A_EXECUTE.sh`.**

---

## 1. `ots-reports` — the delete, the re-seed, and two things the addendum did not know

### What a user would have seen

Ask about tax simplification and get *Renew your driving licence*, *Apply online for a UK passport*
or *Spain travel advice*, each filed as an Office of Tax Simplification report.

### Why

One line of seeder:

```ts
sources/gov-scraper.ts:176   searchGovUk('office of tax simplification report', 'ots-reports', 500)
```

A free-text relevance search with no publisher filter, over a query that reports **348,062** results
today. We kept the first 500. Relevance decays continuously, so there is no *category* of
contamination to strip — the cut has to come from outside the query.

### What we did

**Re-classified all 497 rows against the gov.uk content API, and the verdicts reproduce exactly.**

| | 24 Aug | 26 Aug |
|---|---:|---:|
| KEEP — published by the OTS | 76 | **76** |
| DELETE — published by somebody else | 421 | **421** |
| HOLD — unreadable | 0 | **0** |

**497 of 497 rows carry the identical verdict on both runs, two days apart.** That is the control
that makes a 421-row delete safe to hand over.

⚠ **The classification no longer overwrites its own evidence.** The first version wrote every run to
one `C3_ots_classification.jsonl` and truncated it, so re-classifying destroyed the file the previous
verdict rested on — "never share an output path between two runs", broken by the script that exists
to make the delete safe. Each run now writes its own stamped file; `--report` and `--apply` read the
newest.

⚠⚠ **And `--apply` no longer ends by printing "INDEX LAYER NOT DONE HERE".** That sentence is the
defect the purge exists to fix, one layer along: rows deleted from Postgres and left in `corpus_fts`
are still returned to users, now with nothing behind them. It now does all three layers off the
manifest it writes, counts every predicate before deleting, and **aborts on a predicate that matches
zero rows**. Dry run:

```
DRY RUN — 421 DELETE · 76 KEEP · 0 HOLD
  corpus_sections: would delete 421; 497 → 76
  corpus_fts     : 18,272,377 rows; the 421 ids match   421 rows
  corpus_chunks  : 22,670,808 rows; the 421 ids match   740 rows
  corpus_vec     : 22,670,808 rows; the 421 ids match   740 rows
```

**⛔ `--execute` was refused by the classifier.** Staged: `C3A_EXECUTE.sh` step 1.

### The re-seed: 222 is a closed universe, and the diff is exactly 146

`filter_organisations=office-of-tax-simplification` returns **222** documents, live-confirmed. The
OTS was abolished in 2023, so that universe is closed and finite. Enumerated all 222 and derived each
one's section id exactly as the worker derives it:

```
enumerated                222
already held, exact id     76   ← precisely the KEEP set; r2Exists will skip these
to fetch                  146
```

The seeder is fixed to use the publisher filter, and `c3a/ots-reseed.ts --execute` **refuses to queue
the re-seed if that fix is not in the file** — queueing against the old query would re-create the
mess.

⚠ **The order is load-bearing and the script says so:** the delete must run first. `--apply` requires
the classification to cover the collection exactly as it stands, so seeding 146 rows first makes the
delete abort — the guard working, on a mess the ordering avoids.

### ⚠⚠ Finding 1: 222 documents is not 222 reports

**Every one of the 497 rows has `format = null` and a median of 399 words.** Reading three of the 76
genuine OTS bodies shows what that means:

> *"Call for evidence outcome — Inheritance Tax Review Call for evidence and Survey — From: Office of
> Tax Simplification — Published 27 April 2018 — **The findings of the OTS consultation on
> Inheritance Tax can now be viewed in our published report.**"*

That is the gov.uk landing page, not the review. **Of the 222 documents, 143 (64.4%) carry at least
one PDF attachment — 300 PDFs in total — and this seeder fetches none of them.** It is the same shape
as `building-regs` (21 rows, all landing pages, the PDF fetch never written), and the fix exists one
function along: `processGovukContent` already fetches attachments, `processGovUk` does not. **OI-24.**

### ⚠⚠ Finding 2: a second seeder parameter has been dead, silently

`searchGovUkByOrg` sends `organisations[]=`. Measured 26 Aug:

```
organisations[]=national-audit-office        → HTTP 422, 52 KB of HTML error page
filter_organisations=national-audit-office   → HTTP 200, application/json
```

`fetchJson` returns null on a non-OK response, the loop breaks on the first page, and the generator
yields **nothing**. No throw, no log — an empty run that reads as "no new documents". Fixed to
`filter_organisations=`.

⚠ **The fix does not resurrect `nao-reports`, and saying so matters more than the fix.** The NAO is
not a gov.uk publishing organisation at all: `filter_organisations=national-audit-office` returns
**total 0** and `/government/organisations/national-audit-office` **404s**. It publishes on
`nao.org.uk`, which is what `sources/nao.ts` is for. `listNaoReports()` yields zero under either
parameter. `fca-publications` is retired, blocked, and holds zero rows.

### The 148 held nowhere else (§1.4)

Reproduced exactly against the live database: **273 of the 421 are held in another collection** (241
in `hmrc-codes-guidance`, 48 in `consultations`, 15 in `hmrc-tiins`, 14 in `oecd`, 6 in
`hmrc-ancillary`, 3 in `et-decisions`), leaving **148 held nowhere else**. Zero of those 148 are held
elsewhere under a different URL string, so the exact-URL instrument is not hiding near-misses.

Split by the publisher's own `document_type`, with every type named in one list or the other:

| | count | median words | where it would go |
|---|---:|---:|---|
| SUBSTANTIVE | **99** | 349 | 71 have **no collection to go to** — there is no `govuk-content` corpus; 26 → `hmrc-codes-guidance`; 2 → `consultations` |
| not substantive | 45 | 536 | service pages, news, other tribunals' decisions |
| unclassified | 4 | 503 | `travel_advice`, `working_group`, `person`, `oral_statement` — named in neither list, so reported rather than swept |

⚠ The addendum estimated "~50 substantive". Measured against gov.uk's own types it is **99** — but the
median is **349 words**, because these are landing pages too. Several are substantive documents that
were never ours in the first place: the Charity Commission's annual report, Companies House accounts,
Crown Commercial Service accounts. **Re-ingesting them recovers a summary page, not a report**, and
71 of the 99 have no target collection at all. Artefact: `C3A_ots_orphans.json`.

### The sweep §1 asked for: every other capped free-text seeder

Nine gov.uk-seeded collections parsed out of `gov-scraper.ts`. Each was given an explicit,
falsifiable claim — a publisher, a document type, or a URL path — and 25 rows sampled
deterministically (`ORDER BY md5(id)`) and read through the content API against it.

| contamination | collection | cap | universe the query reports | held |
|---:|---|---:|---:|---:|
| **84.0%** | `ots-reports` | 500 | 222 (org-filtered) | 497 |
| 0.0% | `hmrc-manuals` | 5,000 | 123,543 | 85,197 |
| 0.0% | `explanatory-notes` | 2,000 | 174,839 | 18,801 |
| 0.0% | `impact-assessments` | 2,000 | 155,029 | 18,759 |
| 0.0% | `consultations` | 3,000 | 166,642 | 7,448 |
| 0.0% | `hmrc-tiins` | 3,000 | 356,696 | 791 |
| 0.0% | `college-of-policing` | 2,000 | 145,121 | 332 |
| 0.0% | `nao-reports` | 3,000 | **0** | 3,983 |
| — | `hocl-briefings` | 3,000 | 165,409 | **0 — holds nothing** |
| — | `fca-publications` | 3,000 | 57 | 0 (retired, blocked) |

**`ots-reports` is the only contaminated one.** The others survive the same dangerous shape because
their queries are self-limiting — a `site:` filter, or a phrase specific enough that the tail is
still on-topic. ⚠ **What the caps do cost them is completeness, not purity:** each cap is 0.8–4.0% of
what its query returns, and the rest is cut by relevance rank, which is not a category. ⚠
`hocl-briefings` holds **zero rows** — `commonslibrary.parliament.uk` is behind the same Cloudflare
challenge as the rest of `parliament.uk`.

**Nothing in this section beyond the seeder line has been changed.** The list came first, as §1 asks.

---

## 2. `source-audit.ts` — the addendum's §2 is refuted in its mechanism, and the real defect is worse

§2 says the OTS rule "**has passed for months against a URL that does not exist**". It has not.

```
if (!r.ok || r.code === null) return { status: '⛔', … }     ← the HTTP code short-circuits everything
```

The URL returns **HTTP 404**, so `!r.ok` fires first and the rule has printed **⛔** since the file was
written — `git log --follow` shows it unchanged since 2026-06-04. The `minSize: 5000` line is never
reached. **The principle is sound and worth keeping — a size threshold is not an existence check —
but this is not an instance of it.**

A simulation of the audit's own check precedence was compared against a live run of the real file:
**44 of 44 rules agree, symbol for symbol.** The list below rests on that.

| shape | count | what it means |
|---|---:|---|
| SOUND | 14 | the rule would fail if the source broke |
| **CANNOT-FAIL** | 10 | a floor 20–120× below the delivered size, or no assertion beyond the HTTP code |
| **RED — DEAD URL** | 6 | OTS collection, PACE codes, NI Law Commission, LDA Hansard debates, ONS datasets, ECHR query |
| **RED — BOT CHALLENGE** | 5 | Erskine May, Bills pages, Ofwat, SSRN, HoC Library |
| **ASSERTS THE SEARCH, NOT THE SOURCE** | 5 | a gov.uk `search.json` URL: it proves the search API answers |
| **PASSES ON EMPTY** | 1 | `{"results":[]}` contains the string `results` |
| **CANNOT-PASS** | 1 | `jsOnly` |
| FALSE ALARM | 1 | TNA Legislation |
| unreachable | 1 | ECHR api host |

**The defect that matters: 14 of 50 lines print ⛔ and nothing acts on the output** — and that single
column merges *"this URL no longer exists"* with *"they block robots today"* and *"the server erred"*.
Three different problems, three different answers, shown identically.

Three specific ones worth naming:

- ⚠ **`jsOnly` CANNOT PASS.** It requires `bodySnippet.length > 200`, and `bodySnippet` is
  `body.slice(0, 200)` — the length can never *exceed* 200. FCA Handbook reports ⛔ "JS SPA — no
  server-rendered content" at HTTP 200 with 14 KB delivered, and would do so whatever the server sent.
- ⚠ **The `oecd` rule is green off `q=OECD`** while the `oecd` collection holds 505 gov.uk pages and
  no OECD content at all. That is the real "threshold standing in for a fact": the rule asserts that
  gov.uk's search API answers, not that the source publishes what the collection claims.
- ⚠ **BAILII is reported ✅ HTTP 200 `text/html`** and is serving *"Making sure you're not a bot!"*.
  A 200 is not the content.

**Nothing in `source-audit.ts` has been changed.** §2 requires the list first.

---

## 3. The standing rule: quoted identifiers in LanceDB predicates

74 files in the tree talk to LanceDB. **65 predicate call sites read. ZERO quoted identifiers.**

The detector was watched getting all four reference cases right before the sweep was trusted —
`"id" = 'x'` and `"sectionId" IN (…)` flagged, `id = 'x'` and `corpus IN (…)` allowed. A sweep that
finds nothing and *cannot* find anything is the same shape as a check that cannot fail.

⚠ **The blind spot is stated rather than counted clean.** Two call sites compose the predicate from a
variable — `` `${variant} = '${esc(one)}'` `` where `variant` is `key` or `` `"${key}"` `` — and no
regex over the source can decide them. Both are in `c2/c3-probe-pred2.ts`, the diagnostic that proved
the trap in the first place; it counts and never deletes. Everything in a serving or deleting path
uses the bare form.

---

## 4. D-2 — the two unreachable treaty collections, measured; no search file edited

`uk-treaties` (3,250 compiled) and `tax-treaties-dta` (324) are in the `parliamentary` tier, named in
`NON_DEBATE_PARLIAMENTARY` so debates excludes them, and absent from `COMMITTEE_CORPORA` so
committees never selects them. Meanwhile `uk-treaties-fcdo` (23,372) answers treaty questions because
it happens to be typed DEBATE.

**The scopes were reconstructed as literals and passed to the live FTS service as parameters — the
same thing the router does, from outside. `stream-scopes.ts` was not touched.**

**The benefit** — 12 probe phrases per collection, taken from their own section titles:

| | `uk-treaties` | `tax-treaties-dta` |
|---|---:|---:|
| CONTROL, scoped to itself | 12/12 | 12/12 |
| debates stream as it ships | **0/12** | **0/12** |
| **option A** — admitted to debates | **12/12** | **12/12** |
| option B — its own sixth stream | 12/12 | 12/12 |

**The cost** — the 11 Gold v2 debates questions Charlie validated, before and after:

```
treaty rows entering the top 20 across all 11 questions:   0
debate rows displaced from the top 20:                     0
CONTROL: 11 of 11 questions returned a FULL 20-row set (20/20/20/…), so "0 displaced"
         is measured against rows that exist.
```

⚠⚠ **The recall half of the before-and-after could NOT be taken here, and a 0-vs-0 must not be read as
"no change".** Recall@20 against the validated keys is **0/14 before and 0/14 after** — and the
control says why: **0 of 14 keys are retrievable through this harness even when the query is the
document's own section title.** This machine's `.env` has no `LEX_VECTOR_STREAMS`, so the harness is
BM25-only, while Gold v2's keys were validated against the full hybrid pipeline. The instrument is
reporting its own absence. What stands is the displacement measurement, taken on full result sets.

**The cost of option B** could only be partially measured: 5 vs 6 concurrent calls against `fts-serve`
differ by **−4 ms** (1,081 vs 1,077 ms mean, 3 trials) — i.e. nothing. ⚠ But the concurrency cap of 4
that makes a sixth stream expensive is **`vector-serve`'s**, and measuring it needs a vector leg this
machine does not have.

▶ **Recommendation: OPTION A.** It buys exactly what a sixth stream buys on these collections
(12/12 either way), costs no extra retrieval call, and displaces nothing measurable on the validated
debates set. ⚠ **Take the definitive recall before-and-after through the full hybrid gateway before
shipping it** — this measurement cannot supply that half.

---

## 5. D-3 — the ~1,487 dot leaders: write the records, leave the index alone

`c2/b3-backfill-partial.ts` is ready and unchanged in substance. Dry run over 20,000 bodies of
`primary-acts-pre-2000`: **2,830 partially repealed found, 86 whole-body dot leaders B2 missed, 0 rows
absent from `corpus_fts`.**

✅ **It contains no `DELETE` of any kind** — verified by reading it, not assumed. It is insert-only
(`ON CONFLICT (section_id) DO NOTHING`), so it cannot overwrite an existing repeal record. That is
exactly what D-3 requires: writing the records stops those rows being returned on the next request,
because `search-gateway.ts` reads `section_repeals` live, while deleting them from `corpus_fts` would
move BM25 document frequencies across the whole table and void every recall number taken before it.

**⛔ Unrun — it is a production write.** Step 6 of `C3A_EXECUTE.sh` (and step 7 of `C3_EXECUTE.sh`).

---

## 6. D-4 — `historic-hansard`'s `1013-06-24`

Recorded and left, as D-4 directs. **OI-9** updated to say so, and to point the *cause* at
`BRIEF_INGEST_REPEALED.md` §5 rather than duplicating the work in this stream.

⚠ **That brief is not in the repository.** Nothing here can be aligned against a document that is not
on disk — **OI-23**.

---

## 7. D-5 — Lane D's prediction, logged before the run

Seven numbered predictions are in `CHANGE_LOG.md` under this sprint's heading, written **before any
of Lane D runs**, each with its basis named. The one worth repeating here:

⚠⚠ **The two sources disagree by 2.7× and the prediction records that rather than averaging it.** The
C3 brief costs Lane D at *"~91,500 sections, ~11.5M words"*; A5's own
`projection_full_worklist` says **250,725 sections, 39.9M words** over the same 41,913-entry work
list. One of them is wrong, nobody has reconciled them, and the run settles it.

The work list itself was re-counted from `v36/worklist.jsonl` and matches the brief exactly: **7,924
`classb` · 33,989 `unseen` · 41,913 total.**

---

## 8. Lane C3 — the House of Lords archive: ▶▶ GATE 1 IS GREEN, BY THE ROUTE §7 ASKS FOR FIRST

§7 says: before spending anything on a browser fetcher, ask whether an archive copy exists that does
not require crawling. Measured from this machine with Node's own `fetch`:

| route | result |
|---|---|
| The National Archives **UK Government Web Archive** | **HTTP 405, "Human Verification"** — blocked |
| `publications.parliament.uk` directly | **HTTP 403**, Cloudflare — as C3 measured |
| BAILII | **HTTP 200** carrying *"Making sure you're not a bot!"* — a challenge wearing a 200 |
| **The Internet Archive (`web.archive.org`)** | **HTTP 200, 372,360 bytes of the real judgments index** ✅ |

⚠ The route §7 nominated first — the National Archives — is the one that does not work. The Internet
Archive does.

**Enumerated through the CDX index, one query per Lords session 1996-97 → 2008-09: 2,820 archived
judgment pages, 1,088 distinct cases.** (A Lords judgment is published one opinion per page, so the
page count is not the judgment count and neither is quoted as the other.) That is more than the
brief's ~760.

**Cost in time: ~2.2 s per page single-threaded — 47 minutes for the 1,086 case-leading pages, under
two hours for all 2,820.** It is an afternoon, not a multi-day job, so it does not move behind Lane D
on cost.

### ⚠⚠ The quality gate was wrong in three ways against real bytes, and running it is what showed it

C3 declined to write this gate against invented fixtures — *"a gate whose test data I made up is a
gate tested against my imagination"*. With the real bytes:

1. **It accepted the raw HTML page.** The `<title>` supplies "House of Lords" inside the first 300
   characters, the banned navigation words all sit further down, and HTML tags barely move the
   stopword density (7.3%). A gate that accepts markup is the C4 defect waiting to happen. **Fixed:
   markup in the input is now a rejection.**
2. **Its `[YYYY] UKHL n` rule would have rejected every pre-2001 judgment.** Neutral citations began
   in 2001; a 1997 Lords judgment does not have one and never will — and the pre-2001 authorities are
   exactly what this lane exists to recover. **Fixed: the head must carry the court's own formal
   heading; the document must identify itself by a citation *or* by its judgment date.** In the
   20-page pilot, 10 of 20 have no neutral citation.
3. **Its 4–7% stopword band is below the real distribution.** Measured over 20 real judgments:
   **min 7.2 · p10 7.7 · median 9.0 · p90 9.8 · max 10.7%**. Navigation chrome measures **0.0%**, so
   the separation is enormous and the band does not need a tight ceiling. **Set to 5–13%, from the
   data.**

### ⚠⚠ And hand-reading five documents found two more, which is why the brief mandates it

4. **One page passed every check while opening** *"Search Advanced Search Home Glossary Index Contact
   Us Parliament Live … Site Map Bills Hansard Directories"*. The 2005-06 template uses a completely
   different navigation vocabulary from the one C3's banned-word list was drawn from — **a banned-word
   list calibrated on one era's chrome waves another era's through**, the dot-leader bug's third
   costume in a new corpus. **Fixed by making the test positive and template-independent:** the
   extracted text must *begin* with the court's formal heading, or it is quarantined.
5. **4 of 20 pages end with the word "Continue".** A Lords opinion is **paginated**, so one page is a
   fragment of one opinion — not the opinion, and certainly not the judgment. Storing it would put
   half an argument in the corpus under the case's name, reading exactly like the whole thing.

**Pilot after all five fixes: 13/20 pages pass, 20/20 fetched, 4 correctly held back as paginated
fragments.**

▶ **NOT READY TO INGEST, and the remaining work is named:** the unit must be the *case*, assembled
across `-1/-2/-3` opinion pages **and** across "Continue" pagination, before anything is stored.
Charlie's five hand-reads are the next gate; the extracted text is in the session scratchpad and the
per-page verdicts are in `C3A_lords_pilot.json`.

⚠ **Licence:** the judgments are Open Parliament Licence v3.0 at source (commercial use expressly
permitted, no computational-analysis exclusion); what changes is that we would be taking them through
a third-party mirror rather than from the publisher. Worth Charlie's eye before the full fetch.

---

## 9. Lane C2 — the 503 tribunal orphans: measured over the whole population, and the boundary declared

**All 503 read, not a sample of 200:**

```
  has-pdf           51   10.1%     ← the projection said 53; it was within two
  no-attachment    452   89.9%
  gone               0    0.0%
  error              0    0.0%
```

**The boundary separates cleanly**, and the contrast is the finding:

| | with a judgment (51) | with no attachment (452) |
|---|---:|---:|
| six-digit (pre-2013 Scottish) case number | **0** | **332** |
| seven-digit with a 41xx Scottish office | 2 | **93** |
| dated before 2013 | **0** | 338 |

**425 of the 452 (94%) are Scottish.** gov.uk lists those decisions by title and attaches no judgment,
ever. Declared in `CORPUS_SCOPE.md` in B1's own form:

> **"Scottish employment tribunal decisions before 2013 are not published and are not held."**

⚠ **27 seven-digit English rows have no attachment either and that is NOT explained by this
boundary** — 114 of the 120 seven-digit rows are dated 2013 or later, 66 from 2014 alone. Recorded as
**OI-22** rather than folded into a tidy 94%.

**The 51 are staged for re-fetch through the general path** — one `govuk-content` queue row each,
the same code that ingested the other 131,147 judgments. The landing page keeps `:1`, the judgment
lands at `:2`, nothing is overwritten. Step 5 of `C3A_EXECUTE.sh`.

---

## 10. B1 — still not started, and now blocked on a document

§9 calls B1 the highest-value unstarted item and requires its wording to **match**
`BRIEF_INGEST_REPEALED.md` §2's. **That brief is not in the repository** (OI-23). Writing the
case-law boundary wording now, blind, is how two streams end up saying the same thing in two
different voices — the exact failure §9 exists to prevent.

What this sprint contributed to B1 without touching it: **one more declared boundary**, in the form
B1 will use, with its numbers measured over a whole population rather than a sample (§9 above).

---

## 11. ⚠⚠ 31 of 77 collections answer "how complete are we?" with their own row count

`ots-reports` carried `est_sections = 497` with `est_is_confirmed = true` — and 497 is exactly the
number of rows we hold. An estimate that equals the row count cannot disagree with it, so
completeness is 100% by arithmetic, whatever is missing. §1.3 asks for that one row to be fixed. It
is not one row:

```
live targets                                        77
est_sections EXACTLY equals the held row count      31   (23 of them est_is_confirmed = true)
within 0.1% — a stale copy of the same number        5
```

Among them: `tna-caselaw` (74,896), `niassembly-hansard` (196,348), `impact-assessments`,
`consultations`, `cma-cases`, `scottish-courts`, `erskine-may`, `oecd`.

`ots-reports` now has a real external denominator waiting — **222**, from the field the publisher
maintains, with the landing-page caveat written into the row so one flattering number is not traded
for another (`c3a/ots-measured.ts`, step 4). **The other 30 need one each, and that is research per
collection, not a sweep.** **OI-25.**

---

## SOLVED / NOT SOLVED / NEXT

**Solved (measured, artefact on disk, check watched failing first where there is a check).**
The `ots-reports` classification, reproduced 497/497 two days apart · the seeder, both the OTS query
and the dead `organisations[]=` parameter · the three-layer delete, dry-run proven and guarded ·
the 146-document re-seed diff, by exact id · the free-text seed sweep, 9 collections with a
falsifiable claim each · `source-audit.ts`'s 50 rules classified, with the simulation validated 44/44
against a live run · the LanceDB predicate sweep, 65 call sites, detector watched · D-2's benefit and
displacement, with a non-empty control · the Lords route, the enumeration, the cost in time, and five
gate defects found by running it and reading it · the ET boundary over all 503 · the
denominator sweep.

**Not solved / not attempted.**
**Every production write** — refused by the classifier, staged in `C3A_EXECUTE.sh` · `C3_EXECUTE.sh`
**still unrun** · **Lane D** (prediction logged, run not started) · **B1**, blocked on a missing brief
· the Lords **ingest** (route proven, assembly not built) · the `source-audit.ts` repairs and the 30
other self-referential denominators — both deliberately report-only, as the addendum requires · the
`ots-reports` **attachment** fetch (OI-24) · C1 building-regs and C4's $31 re-embed, untouched by this
addendum.

**Next.** `bash docs/C3_EXECUTE.sh`, then `bash docs/C3A_EXECUTE.sh`. Then D-2 option A with a
hybrid-gateway before-and-after; then Lane D against its logged prediction.

---

## DECISIONS FOR CHARLIE

**A. `source-audit.ts` — repair it, or retire it?** ▶ **Recommend: repair, narrowly.** Three changes
buy most of it: split ⛔ into *dead URL* / *blocked* / *error*; delete the `jsOnly` branch that cannot
pass; and make each gov.uk-search rule assert a non-zero result count for the thing the collection
claims, not merely that the API answered. *Consequence otherwise:* 14 red lines that nobody reads, and
a green line for a collection with none of its own subject in it.

**B. The 148 `ots-reports` orphans — re-ingest, or let them go?** ▶ **Recommend: let 71 of the 99
substantive ones go for now.** They have no collection to go to, they are landing pages at a median
349 words, and several belong to bodies we do not otherwise cover. *Consequence:* 99 documents leave
the corpus; all are still one gov.uk fetch away if a `govuk-content` collection is ever created.

**C. The Lords archive — build the case-level assembler, or stop at the pilot?** ▶ **Recommend:
build it.** The route is proven, the whole fetch is under two hours, and 1,088 cases is the single
largest absence in the case-law corpus. *Consequence of stopping:* ten well-known authorities keep
returning a different case with a similar name. *Cost:* the assembler is the work, not the fetch —
pagination-following plus per-case merge, then the five hand-reads.

**D. `ots-reports` attachments — fetch the 143 PDFs, or accept landing pages?** ▶ **Recommend: fetch
them, as a separate item.** `processGovukContent` already does exactly this for another collection.
*Consequence otherwise:* the collection is marked complete at 222 while holding no OTS report in full.
