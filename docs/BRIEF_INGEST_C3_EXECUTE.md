# BRIEF — INGEST C3: execute the twelve decisions

**Stream:** CC-Ingest · **Written:** 24 Aug 2026 · **Author:** CCh for Charlie
**Supersedes:** the unrun lanes of `BRIEF_INGEST_COMPLETION_C2.md`. Where C2 and this brief disagree, this brief wins — C2 was written before C1 and C2-Lane-2 reported, and three of its lanes were costed against numbers those sprints disproved.

**Inputs, and this time they exist on disk.** `docs/CORPUS_REGISTER_V31.csv` (CC's own A2 output) · `docs/QUANGO_UNIVERSE.csv` · `docs/SCRUTINISE_CORPUS_REGISTER_v4.xlsx` (CCh's, 09:02 23 Aug — a snapshot, now partly stale; Lane F reconciles it) · `docs/INGEST_CENSUS_C1_A_REPORT.md` · `docs/INGEST_C2_LANE2_REPORT.md` · `docs/CASELAW_PRE2001_SCOPE.md` · `docs/INGEST_PLAYBOOK.md` §21–25.

**Spend ceiling: US$150 of embedding.** Batch endpoint only ($0.075/1M tokens). Stop and report at 2× any lane's estimate.

**Lanes A–F are independent and run in parallel.** The only ordering inside a lane is stated in that lane.

---

## Part 0 — Charlie's two commands, before anything

```
git push origin Main
```
Ten commits are sitting locally. The push was blocked by the session permission classifier and correctly not worked around.

Then, once Lane A's manifest has been reviewed, the purge command in Lane A.

---

## Lane A — THE PURGE (approved 23 Aug, scope expanded) — **STILL UNEXECUTED**

⚠ **State check as at 24 Aug 01:00: nothing has been deleted.** 18,272,452 compiled sections, all
131,650 `et-decisions` landing pages and all 28,629 retired-collection rows are still present and
still being returned to users. The purge was staged, approved, and then three sessions were cleared
without it running. **This is the first thing to do.**

The staged run is 160,279 rows across four collections, reversible, guarded, dry-run proven. **Charlie has approved four additions**, taking it to **168,569 rows across eight collections**:

| collection | rows | why it goes |
|---|---:|---|
| `et-decisions` landing pages | 131,650 | the page *about* the decision; 131,147 have the real decision already held beside them |
| `lda-lordswrittenquestions` | 20,500 | retired, never deleted; duplicates `pwdata-lordswrans` |
| `lda-commonswrittenquestions` | 8,000 | retired, never deleted |
| `written-statements` | 129 | retired; one section per *month*, statements joined by `---` |
| **`lda-commonsdivisions`** | **5,553** | proved duplicate, item-level (C1 A4); median 8 words against 1,972 |
| **`lda-lordsdivisions`** | **2,089** | proved duplicate at 2,087 of 2,089 (C2 L2 item 8) |
| **`written-answers`** | **143** | truncated at the API's 5,000-answer page cap; `pwdata-wrans` holds 1,235,281 properly split |
| **`oecd`** | **505** | contains no OECD material at all — 505 of 505 are gov.uk URLs |
| **TOTAL** | **168,569** | corpus after purge: 18,103,866 |

Add the four new keys to `TARGETS` in `scripts/ingest/c2/l2-purge.ts`, re-run the dry run, confirm all eight match their expected counts exactly, then execute. **Three layers, not one** — target row, `corpus_sections` rows, and the vector/FTS index off the same manifest, so the layers cannot drift. Then redeploy `fts-serve` and `vector-serve` (they hold Lance open from boot) and run `verify-retired-gone.ts` — it must move 0/3 → 3/3, having been watched at 0/3 first.

Also in this lane: `labels/remove-retired.ts --apply`, which was blocked by a permission classifier and is the same operation.

### ⚠ `ots-reports` is NOT in the purge, and must not be

`oecd` is 100% contaminated — nothing legitimate is lost. `ots-reports` is roughly 14% contaminated: **at least 69 of 497 rows are news stories and speeches, and the other ~428 are real OTS reports**, correctly published on gov.uk. A wholesale purge would delete 428 genuine documents.

Deliverable: a **filter**, not a purge. Classify by gov.uk `document_type` (the same field the quango census uses), delete only the news and speech rows, and report the exact count deleted. If the type field does not cleanly separate them, read ten bodies before writing the rule — this is the class of decision where the URL test was wrong one time in seven.

---

## Lane B — MAKE THE PLATFORM HONEST (highest user value, no fetching)

Nothing in this lane downloads anything. All of it changes what a user is told.

**B1. Declare the coverage boundary of every case-law collection.** ~2 days.
Each collection declares the era it starts and ends: English courts 2003 (not 2001 — `tna-caselaw` holds 29 items from 2001–02 against 74,657 from 2003 on), Scotland 1999-02-06, Northern Ireland 1984-09, Strasbourg 1956, employment tribunals 2017. Lex states the boundary when a question is doctrinal.

Test it against the ten authorities in `docs/pre2001_probe.json`. Today: 0 of 10 return nothing and **3 of 10 return a different case with a similar name** — *Caparo* returns an employment tribunal case involving a company called Caparo; *ex p Coughlan* returns "Mrs M Coughlan", ET 2020. After B1 all ten should say the corpus does not reach that era. **Ten confidently wrong answers become ten honest ones. The gap does not close, and users will be told about a hole we have chosen not to fill — that is the trade Charlie has accepted.**

**B2. Suppress whole-body dot leaders as answers.** 249,256 sections.
Approved: **suppress**. Keep the rows and the repeal history — a repeal is a real fact about the law — but exclude them from usable-text counts and never return one as an answer. Today a question about a retained EU provision can be answered with `Article 31 . . . . . . . .`, presented as if it were the law.

**B3. Label and warn on partially repealed sections.** ~35,895 sections.
Approved: **label and warn**. These carry live law with holes in it. Keep them retrievable; the answer must state that the section is partially repealed and that removed subsections are not shown. **B2 and B3 must not share a rule.** CC's own first detector treated them alike and would have dropped live law out of the corpus; its negative control caught it. That test stays in place.

**B4. Wire the exclusion, not just the annotation.** All 249,256 are annotated in search results today and still counted as usable text and still returned. Annotation without exclusion is the same defect class as retiring a target without deleting the rows.

**B5. Fix the citation rewrite.** Only **14.0%** of pre-2000 legislation identifiers resolve to an Act title, so a user sees a raw identifier where a title should be. Cause: the regnal-year trap — the Vagrancy Act 1824 is filed as `ukpga/Geo4/5/83`, not `ukpga/1824/83`. The resolver must try both forms, as `v36-reconcile.ts` already does. Never merge two identities on similarity alone.

**B6. Diagnose the two unreachable treaty collections.** The search stream reports 69 of 74 collections reachable; two treaty collections can be returned by no query at all. They are held, processed, and invisible. Find out why and report before fixing.

---

## Lane C — THE CHEAP FETCHES

**C1. Building Regulations Approved Documents — 21 documents.**
All 21 rows are `format=null` GOV.UK landing pages. **There is no PDF to extract from; one was never fetched.** Write the fetch. Then carry the boundary into the answer: Approved Documents incorporate BSI standards by reference and BSI standards are sold, not published, so the answer must say "this Approved Document refers to BS EN xxxx, which is not in the corpus" rather than stopping silently.

**C2. The 503 employment tribunal decisions with nothing behind them.**
Not 131,650. The list is already computed and reproduces C1 exactly. Fetch 200 to `/tmp` first and report the share that resolve to a real document versus a dead link.

**C3. The House of Lords judicial archive — ~760 judgments, under $2.**
The Lords was the UK's final court of appeal until 30 July 2009 and Find Case Law does not publish it at all, so **we hold zero**. The archive sits on `publications.parliament.uk` under OPL v3.0: commercial use expressly permitted, no computational-analysis exclusion. ~250 are pre-2001; the 2001–2009 portion is a gap nobody had counted.

Three things gate it, in order:

1. **Cloudflare.** Node's `fetch` is blocked outright on `parliament.uk` hosts by TLS fingerprinting — documented in our own `scripts/ingest/committees-freshness.ts`, and `publications.parliament.uk/pa/ld/ldjudgmt.htm` 403s to WebFetch while rendering fully in real Chrome. **Pilot 20 documents before planning around any route.** Railway IPs are separately blocked on some hosts.
2. **The quality gate, fired red before green, on the first 50.** Parliament serves judgments as HTML wrapped in site navigation, so naive extraction stores *"Accessibility Email alerts RSS feeds Contact us Home Parliamentary business…"* as the opening of *Pepper v Hart*. The gate: (a) the first 300 characters must contain the case name **and** the `[YYYY] UKHL n` citation, and must not contain `Accessibility`, `RSS feeds`, `Parliamentary business` or `<style`; (b) a stopword-density band — judicial prose runs ~4–7% "the", navigation chrome does not; (c) anything under 500 words is quarantined, not stored; (d) **five hand-reads by a person before the other 755 are fetched.** Feed it raw page bytes first and require it to fail. Half a day, not optional, not deferrable — that is exactly how the case-law stylesheet survived for months.
3. **Notice to the search stream before the ingest.** Adding 760 documents moves document frequencies across the whole BM25 table; S11 measured 0 of 5 rankings surviving the last case-law rewrite. Any baseline taken across this ingest is void and the 65-question baseline must be re-taken after, not compared across.

**C4. `tna-caselaw` stylesheet re-embed.** ~$31, still unspent. 12.7% of embedded case-law text is markup and chunk 0 is more than half markup in 77% of judgments. Verify by sampling 50 and showing chunk 0 under 5% markup.

---

## Lane D — THE LEGISLATION BACKFILL, RE-ORDERED BY REASON

Measured, not estimated: **~91,500 sections, ~11.5M words, $1.33 on batch, ~7.5 hours** — against the C2 brief's 0.45–0.6M sections and $6–9.

**Run all 7,924 `classb` instruments first.** They are ~19% of the work list and carry most of the value. `classb` means *we* marked them "No CLML/HTML/PDF found on TNA" — our own failure marker, not the publisher's — and **37.5% of them do have text**, including the Public Health Act 1875 (143 sections) and the Companies Act 2006 (2,093 sections). The 33,989 `unseen` rows recover at 17.0% and are mostly genuinely textless at source; run them second.

**Single-threaded.** Two concurrent fetchers measured **8.2 instruments/min against 93.5 for one**. That is throttling, not capacity, and it was discovered by accident when two runs overlapped.

Match on **either** regnal or calendar id. Hetzner, never Railway. R2 writes before Neon. Record the prediction in `CHANGE_LOG` before the run and score it after.

⚠ The 258 `classb` rows inside `primary-acts-pre-2000` project ~19,866 sections — about 12% on top of that collection — but **that rests on n=2 and is not a number until the other 256 are fetched.** Do not quote it as one.

---

## Lane E — PLUMBING

**E1. Drop the `ftsVector` column.** 1,178 MB, 6.2% of the database, 96% of case law's per-row cost, and nothing in the serving path reads it. **Do this before Lane C3**, so the House of Lords ingest is never written with one.

**E2. Re-parse the Senedd backlog.** The parser fix is correct and in the shared parser, but **117,231 of 191,756 speeches (61.1%) still carry the wrong inherited heading** and the Welsh-language bodies are still stored wrong, because nothing has re-parsed the data. One re-parse fixes both. **It renumbers ids, so sequence it with the search stream before running** — that handshake is a prerequisite, not a courtesy.

**E3. Rebuild the daily email's coverage line for legislation.** Print: *"3,560 of 9,343 Acts that have text — 38.1%; 7,279 more are published with no provisions."* Expect 38.1% to be revised **upward** as the walk improves, because 0 of 67 sampled `unseen` pre-2000 Acts returned any text, which means the 12 August walk under-counted the no-provisions class substantially. Never print 21.4% as a closable gap: ~96% of it is not text we can fetch.

**E4. Delete the storage warning.** There is no 20 GB ceiling. Neon is usage-priced at $0.35/GB-month and the enforced cluster limit is 16,384 GiB; we are at roughly 0.11%. Replace the line with $/month, the source, and the date checked. Keep the 17.5 GiB ops alert line if it is useful, but label it as ours.

---

## Lane F — ONE REGISTER, GENERATED NOT HAND-BUILT

Two sprints opened by discovering the workbook was not in the repository. It now is, but it is a 09:02 snapshot and C2 Lane 2 landed at 19:43, so parts of it are already stale.

**F1. Reconcile the three artefacts.** `CORPUS_REGISTER_V31.csv` (CC's, columns invented by CC, walk leads marked "CC-proposed"), `QUANGO_UNIVERSE.csv`, and `SCRUTINISE_CORPUS_REGISTER_v4.xlsx` (CCh's). Where they disagree, **live data wins, then the dated sprint report, then the workbook.** Produce one reconciliation table naming every disagreement and its resolution.

**F2. Fold in the corrections CC has already identified.** At minimum:

| workbook row | says | should say |
|---|---|---|
| I12 dot leaders | ~178,826 (11.4%) | **249,256 (15.6% of legislation)** |
| I08 building-regs | "fix PDF extraction"; "~446 words each" | **no PDF exists — all 21 are `format=null` landing pages; median 318 words** |
| I10 written-answers | "re-split into one section per answer" | **retire — truncated at the API's 5,000-answer page cap** |
| I17 duplicate pairs | "four suspected pairs never checked" | **all four resolved: Hansard disproved, treaties and both division pairs proved** |
| I15 legacy table | "unresolved" | **29 instruments / 211 sections independent** |
| `ots-reports` | complete | **contaminated: ≥69 of 497 are news and speeches** |
| **`historic-hansard` / `pwdata-debates` overlap** | "overlaps pwdata, not de-duplicated" — and **three rows commission work to "measure and resolve the overlap"** | **there is no overlap.** Commons `S5CV` ends 1918-11-21, `pwdata-debates` begins 1919-02-04; Lords `S5LV` ends 1999-11-11, `pwdata-lords` begins 1999-11-17. They abut. Delete the work item from all three rows — the register inherited a first, wrong measurement that its author later corrected |
| **`oecd`** | framed as a licence-vintage problem: "pre-July-2024 content and NON-COMMERCIAL" | **it is a wrong-content problem.** 505 of 505 rows are gov.uk URLs with zero OECD content. It is **not in the Issues Log at all** — add it |
| `et-decisions` counts | 131,654 of 293,403 | **131,650 of 293,399**, measured by `sourceUrl` |
| `pwdata-wrans` sections held | — | **+17** against live; snapshot drift, harmless, but correct it |
| the one sections-held mismatch CC found | — | it is the `pwdata-wrans` row above; no others |

CC's full review is committed at `docs/CORPUS_REGISTER_V4_REVIEW.md` — read that, not this table, for the authoritative list. CC's structural check found the workbook otherwise sound: no live collection omitted, no orphan percentages, denominators genuinely source-derived, and the Coverage Summary correctly subtracts the legacy row from its total.

**F3. Generate the workbook from the CSVs, and keep generating it.** A spreadsheet that is hand-built once becomes a second source of truth within a week. Write `scripts/ingest/census/build-register-workbook.ts` so the workbook is an output, never an input.

⚠ **`docs/DAILY_EMAIL_V31_REBUILT.md` now exists** (23 Aug 01:54). C1's Part A report says Part C
has no target format to build against; that line was written four minutes before the file appeared
and is wrong. Part C has a target format. Read the file, not the report line.

**F4. Create the two files C1 reported missing and never got:** `docs/CORPUS_SCOPE.md` (the declared scope for collections with no publisher index) and `docs/OPEN_ITEMS.md` (the single open-items register — its absence contributed to a previous production incident).

---

## Reporting

Per lane, in this order and in ordinary words: what a user would have seen → why → what we did → what it cost → what is still open. Then solved / not solved / next. Decisions as numbered questions with a recommendation and the consequence of each option. Every percentage states what it is a fraction of, what counts as good, and what follows.

Lessons into `docs/INGEST_PLAYBOOK.md` as they land, not at the end.

## Standing rules

- Audit before build. `whichdb` before any DDL. `prisma db execute --file` against the direct Neon URL; never `db push`.
- **A check that cannot fail is not a check.** Watch every new check fail against the real broken state before trusting it to pass.
- **An inference must not travel as a measurement.** Record where every number came from.
- **Bytes before hypotheses.** Read the artefact, not the counter. Every correction this month came from opening the actual file.
- **A field corrected in the database has not reached a user.** Nothing refreshes the search index after a backfill unless you refresh it. Use the general refresh path.
- **Restarting a service is not deploying new code.** Prove which code arrived with a probe that is false on the old build.
- **Never regenerate a "baseline" after the repair has run** — a post-repair snapshot labelled *before* is worse than a missing one. (CC got this right on `C2_L2_baseline.json`; it is now a rule.)
- **Never share an output path between two runs**, and re-read any artefact before citing it — a kill notice does not mean the process died or that the work did not land.
- No git during a sprint. One commit script per lane, scoped by explicit path, executed once, deleted. **Verify a patch to a commit script actually landed** — a `.replace()` that matches nothing still reports success, and one nearly dropped four files including a retraction.
- **Write incrementally, not at the end.** `l2-measure.ts` produced every measurement it was asked
  for and then crashed on its last query (`column "itemId" does not exist`) before its single
  `writeFileSync`, so the whole run was lost and its named artefact never existed. A script that
  measures and then writes once at the end can lose everything to its final statement.
- **Run `scripts/check-clean-build.sh` before any push that touches a shared tree.** It installs
  from a clean checkout and builds the way the deployment does. A local build passing proves only
  that your own `node_modules` is richer than the deployment's — which is exactly what kept
  production broken for two days.
- Predictions in `CHANGE_LOG` before every run; scored after.
