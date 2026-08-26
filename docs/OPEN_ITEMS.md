# SCRUTINISE — OPEN ITEMS

*The single register of things that are known, unfinished, and not written down anywhere a person
will look. Created 2026-08-24 (C3 Lane F4). C1 reported this file missing; its absence contributed
to a production incident, because an item that lives only in a sprint report is an item nobody
re-reads.*

**The rule for this file:** an item leaves only when it is **done and verified**, or when somebody
**decides not to do it** — and a decision is recorded here with its reason, not silently deleted.
An item that is merely stale stays, with its date showing.

**One line per item. Every item names: what a user sees · what it would take · who decides.**

---

## ⛔ BLOCKED — needs a person, not more work

| id | item | what a user sees today | who decides |
|---|---|---|---|
| **OI-1** | **`ots-reports` — delete 421 of 497, or the brief's 68?** Measured against the gov.uk content API, 497 of 497 readable: 76 published by the OTS, 421 by somebody else. The brief authorised removing "news and speeches" (~69); the publisher test says 84.7% of the collection does not belong. 148 of the 421 are held in no other collection. | A question about tax simplification can return *Renew your driving licence* or *Apply online for a UK passport*, filed as an Office of Tax Simplification report. | **Charlie** — D-1 in `INGEST_C3_REPORT.md`. Script staged: `c2/ots-filter.ts --apply`. |
| **OI-2** | **Every production DELETE and DDL this session staged is unrun.** The purge (168,569 rows, 8 collections, 3 layers), the `ftsVector` drop, the B3 backfill, the retired-label sweep, the B5 index refresh. Claude Code's auto-mode classifier refuses production DELETE/DDL from a session regardless of the brief. | 168,569 rows that are duplicates, landing pages or wrong-content are still being returned. `verify-retired-gone.ts` still reads **0/3**. | **Charlie** — run `docs/C3_EXECUTE.sh`, one step at a time. |
| **OI-3** | **`uk-treaties` (3,250) and `tax-treaties-dta` (324) can be returned by NO query at any setting.** Verified live and two-sided on 24 Aug: 20/20 scoped to themselves, **0/20** through the debates scope and 0/20 through committees, **3/20 and 4/20 with the tier filter alone**. They are in the `parliamentary` tier, named in `NON_DEBATE_PARLIAMENTARY`, and display-typed TREATY, which no stream admits. | A treaty question is answered from `uk-treaties-fcdo` (23,372 sections, reachable because it happens to be typed DEBATE) and never from its two siblings — on a type distinction no user made. | **Charlie.** ⚠ The stated blocker is now GONE: `corpus-map.ts` says this "cannot be measured today — the validated set has ZERO debates questions", and **Gold v2 shipped 11 debates questions (Q1–Q11) on 22 August**. The comment is stale; the decision is measurable. |
| **OI-4** | **House of Lords judicial archive — ~760 judgments we hold none of.** The Lords was the final court of appeal until 30 Jul 2009 and Find Case Law does not publish it at all. OPL v3.0, commercial use permitted, under $2. **Gate 1 is RED:** every `parliament.uk` host returns **403 with a Cloudflare challenge**, with and without a browser UA, including the site root. | Ten pre-2001 authorities were run through the real `runSearch()`: 10 of 10 absent, 3 of 10 returned a *different case with a similar name*, 0 of 10 returned nothing. The absence never presents as an absence. | **Charlie** — a route that is not Node `fetch` from this machine. Do not build around the challenge page. |

## 🔧 BUILT, NOT DELIVERED — code is in, users have not seen it

| id | item | why it has not reached a user | next step |
|---|---|---|---|
| **OI-5** | **B5 — legislation titles, 54.2% → 99.1%.** `ukpga/Geo4/5/83` now resolves to *Vagrancy Act 1824*, and 1,575 citations repoint to the id form that actually holds sections. | `loadActTitles` is read at **index build** time and the title is baked into the `corpus_fts` body. The resolver is fixed; the index still holds the old rows. | `fts-refresh.ts --corpus=primary-acts-pre-2000 --from=db`, then redeploy `fts-serve`. Step 8 of `C3_EXECUTE.sh`. ⚠ Moves BM25 document frequencies — take no baseline across it. |
| **OI-6** | **B2/B4 — whole-body dot leaders excluded from retrieval.** 249,256 rows whose entire text is `Article 31 . . . .` have been *labelled* in every search result since Surface 1 and returned anyway. | The gateway filter is committed and takes effect on the next request — **but only for rows `section_repeals` holds.** B2's 249,256 is a **floor**: a further ~1,487 exist that the table never held. | Deploy, then run the B3 backfill (step 7) to add the missing ones. |
| **OI-7** | **B3 — ~32,040 partially repealed sections [95% CI 25,956–40,088] carry no label at all.** Live law with removed subsections. `section_repeals` has never held a row of this kind. | The backfill is written, dry-run and blocked (OI-2). | Step 7 of `C3_EXECUTE.sh`. No index rebuild, no redeploy — the join is live. |

## 📏 MEASURED, NOT ACTED ON

| id | item | the measurement | note |
|---|---|---|---|
| **OI-8** | **The 503 `et-decisions` orphans are mostly not fetchable.** | 200 probed: **21 has-pdf (10.5%) · 179 no-attachment · 0 gone · 0 error** → ~53 of 503 worth re-fetching. 131 of the 179 are Scottish tribunals, 134 carry 6-digit (old Scottish) case numbers, 105 are from 2006; all 21 with a PDF are 7-digit and 2013–2018. | This is a **coverage boundary**, not a fetch failure. Recorded in `CORPUS_SCOPE.md`. |
| **OI-9** | **`historic-hansard`'s earliest `itemDate` is `1013-06-24`.** | Straight off the live table while generating `CORPUS_SCOPE.md`. | A year-parsing artefact, almost certainly `1913`. Nobody has looked. Small, and it corrupts any date-range facet over that collection. |
| **OI-10** | **`si-pre-2010` has 15,784 instruments with no title on either id form**, and the publisher enumeration has no title for them either. | B5 measured 83.3% → 84.4% across all six legislation collections; the regnal fix is worth +1,651 and the residue is 23,646. | The regnal repair does not touch these. A different cause, unexamined. |
| **OI-11** | **`vec-hygiene.ts`'s header quotes a stale cost.** It records ~22.5 s per delete predicate on `corpus_chunks`, measured 11 Aug. | Measured 24 Aug: `sectionId IN (2000)` returns in **1.5 s** — a BTree index (`sectionId_idx`) landed since. `corpus_vec` is 10.1 s and `corpus_fts` 6.9 s (neither is indexed on its key). | A comment nobody re-measured would have justified an unnecessary redesign. |
| **OI-16** | **`<Citation URI>` markup covers 2–5% of the cross-references that are actually in the text**, so any inbound-citation count taken from it alone is a FLOOR reported as a total. Measured over 6,045 documents: 5.4% of body mentions of the Human Rights Act carry markup, 1.8% of the Equality Act, **0% of CRAG 2010**. This is a property of legislation.gov.uk's data, not of our code. | Measured over 6,045 documents by `probe` against the bulk CLML: 5.4% Human Rights Act, 1.8% Equality Act, 0% CRAG 2010. | 25-H's `citation_edge` adds a second `text` detector and keeps the two apart in a `detection` column; `legislation_edges`' `cites` rows have no such column and are markup-only. **Anything quoting `cites` as "the citations" is quoting ~2%.** |
| **OI-18** | **93,772 act-name spans in `citation_edge`'s text pass resolved to nothing, and 11.3% of the rows that DID resolve are not in a provision at all.** The unresolved are short forms ("the Taxes Act 1988"), pre-1963 Acts under the other id form, and Acts we do not hold — counted, never dropped silently. The non-provision rows are an Act named in an SI's TITLE, long title or explanatory note: real references, but not provisions that break. | 93,772 of 1,429,037 spans unresolved (6.6%); 73,238 of 649,202 text rows have `source_provision_ref IS NULL` (11.3%). CRAG's 182 inbound becomes 149 with them filtered; the Equality Act's 1,868 becomes 1,552. | Two levers on the same deliverable, both open. Short-form resolution ("the 1998 Act" → the Act named earlier in the same document) is the bigger win. For a repeal work-list today, filter `source_provision_ref IS NOT NULL` — the query surface does not do it for you, deliberately, because a title reference is still a reference. |

## 🧨 TRAPS — recorded so they are not rediscovered

| id | item |
|---|---|
| **OI-12** | **A quoted identifier in a LanceDB predicate matches NOTHING and raises NOTHING.** `"id" = 'x'` → 0; `id = 'x'` → 1. Measured on all three tables. It is also ~70× *faster*, because it prunes every fragment — so it looks like a working optimisation. A `delete()` carrying the quoted form removes 0 rows and reports success. `fts-hygiene.ts` and `vec-hygiene.ts` both use the bare form; `l2-purge-index.ts` broke with them and its count-before guard is what caught it. |
| **OI-13** | **`isRepealedPlaceholder` has now been defeated three times by the same shape.** V36: the bare number (`31 . . .`). C2 Lane 2: the provision label (`Article 31 . . .`). C3: **the provision number's own multi-letter suffix** (`12ZA . . .`, `234ZA`, `502GC`, `164FG`) — one letter was always fine, which is why it survived two fixes. Every fix has been "strip one more leading thing". The next costume is worth predicting rather than waiting for. |
| **OI-14** | **`source-audit.ts` asserts `minSize: 5000` on the OTS collection page — and that page 404s.** A gov.uk 404 page satisfies a size floor. A size threshold is not an existence check, and this one has passed since V1. |
| **OI-15** | **`extract-cites-edges.ts` never opened 37% of the Acts in the bulk file, and nobody noticed for seven weeks.** Its zip-entry filter is `-(\d{4})-`, which requires a CALENDAR year, so every regnal-year filename (`ukpga-Geo3-41-52-revised-data.xml`) fails to match: **2,431 of 132,990 documents skipped — 1,650 ukpga, all 660 `aep`, all 58 `apgb`**, all pre-1963. Proved by consequence, not by reading the regex: of 121,279 `cites` edges, **exactly 0** have a regnal-year source, while 29,800 edges of other types do. July's fix for regnal ids widened the URI *parser* (`GRAPH_TIER1_REPORT.md` §3.1) and never reached the entry *filter* — a separate code path. ⚠ The general shape: **a fix applied to one of two places that must agree, with no check that they agree.** 25-H's `ENTRY_RX` reads all 132,990; `legislation_edges` has NOT been re-extracted. |

---

## Closed

| id | item | why it left |
|---|---|---|
| **OI-17** | **"Neon is past its alert line" — WITHDRAWN, it was never an item.** Raised by 25-H on the strength of a 17.5 GB "alert line" quoted in `setup-edges-table.ts`. | **Closed 2026-08-26 as a false alarm, by Charlie.** There is no Neon storage ceiling: `neon.max_cluster_size` is 16 TiB and storage is a BILL, not a WALL — $0.35/GB-month against a $15/month budget, so 19 GB is ~$6.65 = 44%, quiet. ⚠ The project had ALREADY killed this figure: GRAPH 3B §4.1 traced its provenance to a closed loop (our constant cited the handoff; the handoff cited our constant), GRAPH 3C §5 retired it for the cost line, and `serve-observer.ts` prints "There is NO storage ceiling to hit" in the LIVE code. 25-H resurrected it by trusting a July header comment without asking whether it was still true. **The comment is now corrected in place, in `setup-edges-table.ts`, because leaving it is how it came back a second time.** |
