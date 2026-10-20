# INGEST_LEX_FIVE — REPORT

*CC-Ingest, 2026-10-19 00:39 UTC. Executes `BRIEF_INGEST_LEX_FIVE.md`. Nothing here is committed or pushed; see "Not done".*

## §0 — why the September brief did not run
`BRIEF_INGEST_AMENDMENTS_EDGES_REACH.md` is not in the working tree and in no commit (`git log --all` over the name finds nothing; its only trace is line 6 of the new brief). It was never committed, so it could not reach this stream through the repository. **A routing problem, not a blocker.**

## §5.1 — the volume finding (it changes §5)
Counted, not estimated: **45,655 amendments** in the **423** held bills, across 3,713 stages, 209 of the 423 bills having any. 4,166 calls, **0 × 429**, every stage list reconciled to its declared total. The Bills API declares **4,061** bills; we hold **423 of 4,061 (10.4%)**.
- **Unit: one individual amendment** (`amendmentId`, marshalled number such as `NC32`). `id` on the wire is always 0 and unusable; `amendmentId` is the key.
- `totalResults` present on every response (0 missing). Entry walk = `totalResults` = a single `Take=1000` call = distinct `amendmentId`s on **6 of 6** stages checked. The **stage list is paged (20 a page)**; a walk that reads page one silently drops stages of the long bills.
- `Take=1000` returns a whole stage in one call. **Listing all 45,655 needs ~300 calls (minutes).** But the list item carries only `summaryText` (a summary: heading and title lines); **the amendment's full wording is on the per-amendment detail endpoint, 45,655 calls ≈ 2 hours at the converged 150 ms gap.** "3,500 calls" was wrong in both directions.
- Heavy tail: largest single stage 1,289; Lords Committee 21,062 and Lords Report 9,866 are 68% of everything.
- **The publisher's `decision` has 14 values, not five:** NoDecision, Withdrawn, WithdrawnBeforeDebate, Disagreed, NotMoved, Agreed, AgreedOnDivision, NegativedOnDivision, QuestionProposed, NotSelected, StoodPart, NotStoodPart, Preempted, NotCalled. Stored verbatim, none merged.
- Reuse: the EDM controller was embedded in `sweep-edm-signatures.ts`, not importable. Lifted unchanged into `shared/self-tuning-gap.ts` and used by the audit. **The EDM script still carries its own copy** (follow-up, not done).
- **Not written.** No amendment row exists. Proposed table when approved: one row per `amendmentId` — bill, stage, number, type, clause/schedule/page/line, summary, full wording, decision (verbatim), lead and co-sponsors as MNIS ids, fetched_at.

## §3 — `nao-reports` dates: DONE in the database
All 3,983 rows (2,755 reports) dated, 1984-02 → 2026-06. The date was **a field at source** (WP REST `date`), not in the body; `processNao` never set `itemDate`. **Writer fixed** (`fetchNaoReportDate`; warns loudly when absent). Cross-check against the PDF upload-path year: 2,399 of 2,514 same year, 2,465 within one; the rest are PDFs re-uploaded in 2022 where the WP date is the better one.
Before: "latest NAO view" unsortable. After: sortable. **Caveats:** new rows are dated only once the ingest workers are redeployed; I have **not** read the served index back, so whether it carries `itemDate` is unverified.

## §1 — Managing Public Money: DONE in the database
Through the real `processRow` path into `govuk-core-docs`: page body (100 words of landing text — the shape that produced three near-empty collections), **the 298-page April 2026 PDF (83,752 words)** and the Delegated Authority Guidance (4,614). Read back from R2: "value for money" ×93, "accounting officer" ×290, regularity/propriety/feasibility all present. Before: only documents *about* it. After: the document. **Not yet in the index** (three-layer audit shows the collection within its 5-row tolerance, which would hide 3 new sections — so this is stated, not measured).

## §2 — Departmental Annual Report and Accounts
**Audit (gov.uk's own lists, 59 organisations, every one walked to its declared total).** Findings that change the denominator:
- gov.uk's `Ministerial department` tag **omits DBT, DSIT, DIT and DLUHC** (tagged `Other`); added by slug. A search by organisation returns arm's-length bodies' reports published *through* the department (DCMS: 26 in a year), so "documents under a department" ≠ "the department's report". Own reports judged by title prefix: 265; **fetch set 211** corporate reports, FY 2015-16 →.
- Not listed on 18 Oct for 2025-26: DfE, DHSC, MoJ, NIO, UKEF; ARAs named as "technical notes" (5) are not the report.
- Already held: ~7,400 sections / 3,401 documents of arm's-length-body reports in `quangos-govuk`, plus NAO-hosted accounts pages; **no department's own report.** This is gap-fill.

**Fetched** into new corpus `departmental-accounts` (OGL3): 211 documents, 0 threw, **204 verified** (≥5,000-word PDF section containing the statement headings). 7 not: 4 HMRC and 1 DFID "technical notes" (HTML shells), `dft-olr-holdings` 2018-19 and `wales-office` 2024-25 (PDF lacks the statement headings; read as not verified). After removing duplicates: **551 sections, 19.1M words, 0 undated.** Storage: 110.5M characters of extracted text in R2 for the main PDFs (before duplicate removal).
**Two duplication defects found and handled:** "(print ready)" PDFs (filter added to `processGovukContent` — shared code, also applies to re-runs of other govuk-content corpora) and web/print variants not titled so — **59 near-duplicate PDF sections removed** from the table (R2 text untouched; `lex-five/ara-dupes.ts`).

**One document end to end — MoJ 2024-25 (314 pages, 8.6 MB, 93,495 words).** ⚠ **The financial statements are neither a table nor a header-plus-value-row.** Label, note number and four columns are concatenated on one line: `Staff costs54,955,266 5,238,303 4,701,2334,965,029` (note 5, first value 4,955,266), digits broken by spaces (`1 ,1 8 7, 6 7 1`), column headings detached, labels wrapped. **Figures cannot be extracted reliably from this text.** The HTML "Financial statements" part and the core-tables workbook are the structured sources. Holding ≠ extracting; extraction not started.

## §4 — `legislation_edges` refresh: REPORT ONLY, nothing written
- **There is no fresher primary-Act source.** TNA's primary, secondary-aggregate and EU effects files are still dated **30 Oct 2025** at source today. Re-running the extractor over them reproduces the same data under a new date. Only uksi/ssi/nisr/wsi regenerate daily (18 Oct 2026); my local copies of those four are partial.
- **`extracted_at` is already a column but holds ONE value for all 2,348,993 rows** (the evening of 4 July). It states when we extracted, not how old the data is. S27's `freshness.newest_row_at` is computed from it → "98 days old" while primary-Act effects are ~1 year old. **The misleading recent date already exists.**
- Row mix: amends 1,015,960; commences 477,946; repeals 322,346 (215,312 bulk + 107,034 in-force dataset); made-under 230,681; modifies 180,781; **cites 121,279** (44,183 source docs).
- Cheapest honest fix needs no rewrite: a view giving per-row **source vintage** derived from the target's document type (primary/EU → 2025-10-30; secondary four → bulk date). A column UPDATE of 1.2M+ rows on Neon (~16 of 17.5 GB) is the risky route.

## §6 — three-layer reach: audit built and WATCHED FAILING FIRST
`search/audit-three-layer.ts` (corpus_sections / corpus_fts / corpus_chunks+corpus_vec per collection, scans asserted complete: 18,272,377 / 22,670,808 / 22,670,808). **It named exactly seven ORPHANED-IN-INDEX collections** — `lda-commonsdivisions` 5,553, `lda-commonswrittenquestions` 8,000, `lda-lordsdivisions` 2,089, `lda-lordswrittenquestions` 20,500, `oecd` 505, `written-answers` 143, `written-statements` 129 (FTS rows) — **confirming the missing-layer-three hypothesis**; `et-decisions` shows FTS-EXCESS of **131,650**, exactly the landing pages. Also named: `pwdata-wrans`, `-lordswrans`, `-westminster` FTS-SHORT (index lags ingest by 1,189–11,477) and `departmental-accounts` NOT-IN-FTS (349 at the time).
**§6.2:** `c2/purge-ledger.ts` — append-only; the database purge records layers 2–3 `pending`; the index purge closes a layer only after a **count read-back**, never an exit code. The August run is recorded retroactively. Not yet exercised on a live execute run.
**§6.3 for CC-Search:** orphaned entries are in `docs/census/three-layer.json` (`verdict: ORPHANED-IN-INDEX`). Rendering is theirs.
**The purge was not re-run.** Finishing the index purge (heavy: Hetzner) closes the seven.

## Not done, named
Amendments rows (§5.2/5.3); any `legislation_edges` change; running the index purge; index rebuild so §1/§2/§3 reach users (`departmental-accounts` and MPM are database-only); worker redeploy for the NAO date fix; `check:scripts`-style type check of the final tree (tsc ran: my files clean after one fix, 41 pre-existing errors elsewhere); **no commit, no push**. The stream worktree was not created: work was done in the shared tree.
**Commit hazard:** `licence-map.ts` and `LICENCE_REGISTER.md` carry another stream's uncommitted FCA edits beside mine — they need a joint commit agreed between the two. `commit-ingest-lex-five.sh` lists my files and *excludes* those two.

## Decisions for Charlie
1. **Amendment wording: summary only (~300 calls, minutes) or full wording (45,655 detail calls, ~2 h)?** Recommend full wording — the wording is the product; consequence of summary-only: a user sees "To move the following Clause— Workplace intimidation…" and not the clause.
2. **`legislation_edges`: add the vintage view (no rewrite, zero storage), and refresh only the four daily secondary slices?** Recommend yes. Alternative, backfilling primary effects after Oct 2025 via the per-Act Changes API, is ~290k fetches and unscoped; recommend a separate brief.
3. **`cites` rows (121,279, ~2% coverage): retire** per GRAPH_4A Q2 rather than refresh. Consequence of keeping: any new date on them overstates.
4. **Run the index purge on Hetzner** to close the seven orphans and the 131,650 et-decisions rows (recommended; heavy-job runner). Consequence of waiting: users keep getting cards with nothing behind them.
5. **Index the three additions** (rebuild/merge) so §1–§3 reach users, and add `departmental-accounts` to CC-Search's `corpus-map.ts` (tier `guidance`, my suggestion).
6. **Approve the joint commit** of `licence-map.ts` / `LICENCE_REGISTER.md` with the FCA stream.
