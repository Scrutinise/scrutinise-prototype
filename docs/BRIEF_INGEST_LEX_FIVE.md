# BRIEF — INGEST: THE FIVE LEX ITEMS

**For:** CC-Ingest
**Written:** 17 October 2026, by CCh-Ingest for Charlie
**Source:** five items relayed from LEX, 16 Oct; CC's corpus read in `docs/LEX_26S_REPORT.md` §A–§B
**Supersedes:** `BRIEF_INGEST_AMENDMENTS_EDGES_REACH.md` (25 Sep), which was never run. §4, §5 and §6
below absorb it. **Do not run both briefs** — two briefs on one stream is how three register rows
ended up commissioning work on an overlap that did not exist.

**Format:** §1–§3 are small and can be built directly. §4 and §5 report before they write.
One `commit-ingest-lex-five.sh` at the end, scoped by explicit path. One git worktree for this
stream.

---

## §0 — WHAT IS ACTUALLY BEING ASKED

Three of these are small and new. Two have been outstanding for three weeks.

| | item | state |
|---|---|---|
| §1 | Managing Public Money | not held — only documents that mention it |
| §2 | Departmental Annual Report and Accounts, ~20 departments, 2015-16 → | not held as a set |
| §3 | `nao-reports` — all 3,983 rows have `itemDate` null | a one-column repair |
| §4 | `legislation_edges` refresh | **briefed 25 Sep, never run** |
| §5 | Bills-API structured amendments — 0 rows | **briefed 25 Sep, never run** |

▶ **Before starting §4 or §5, say in one line why the September brief did not run.** If the answer
is that it was never handed over, that is a routing problem and worth knowing. If it was attempted
and blocked, the blocker is the first thing this sprint needs.

---

## §1 — MANAGING PUBLIC MONEY

HM Treasury's rulebook for how public money may be spent. LEX needs it because the Deepening's
costing cannot cite the value-for-money duty against a document we do not hold.

Source: gov.uk HTML plus the current PDF. Licence OGL 3.0 — add the row to `LICENCE_REGISTER.md`
before the fetch, not after.

⚠ **Use the attachment-fetching path, not the landing-page one.** This is the defect that has now
produced three near-empty collections. `processGovUk` stores the gov.uk page *about* a document;
`processGovukContent`, one function along, fetches the attachments. `building-regs` is 21 of 21
landing pages with no Approved Document behind any of them; `ots-reports` is 497 of 497 with
`format = null`; `hmrc-codes-guidance` is 9,253 landing pages with nothing behind them. **Managing
Public Money is exactly the shape that fails this way** — a long document published as a PDF with a
thin HTML summary in front of it.

Verify by reading the stored body back and confirming the value-for-money duty is in it. A row count
proves nothing about what is in the row.

Destination: `govuk-core-docs` as LEX asks, with one caveat on the record — that collection is 175
sections standing in for four separate plan rows (PACE codes, civil service and ministerial codes,
Treasury guidance, White Papers), so nothing in it can be reported on separately. Putting MPM there
is correct for now; splitting the collection remains outstanding.

---

## §2 — DEPARTMENTAL ANNUAL REPORT AND ACCOUNTS

~20 ministerial departments, 2015-16 to date. Needed as unit-cost comparators.

**§2.1 Audit before fetching.**

- **Report what we already hold.** CC's read says NAO-hosted accounts pages exist for a few
  departments, plus ~7,000 arm's-length-body reports. Say which departments and which years are
  already covered, so this is a gap-fill rather than a duplicate ingest.
- **State the denominator.** ~20 departments × 11 years is ~220 documents if every department
  published every year under the same name. They did not — departments merge, split and rename
  (BEIS, DBT, DESNZ; MHCLG twice). Walk gov.uk's own publication list per organisation and report
  what it says, rather than assuming the grid is full.
- **Print one document end to end** and report its shape: how many pages, where the financial
  statements sit, whether they are a table in the extracted text or a header block followed by a
  value row.

⚠ **This last point is not incidental.** The impact-assessment sprint found that the summary sheet
is *not* a table in the extracted text — it is a header block then a value row — so "find the label,
take the next number" returned the price base year as the cost to business. Departmental accounts
are far more table-dense. **Holding the documents and extracting figures from them are two different
jobs.** This brief covers holding them. Say so in the report, and do not start the extraction.

**§2.2 Fetch**, again through the attachment path. These are large PDFs; report the storage actually
used rather than an estimate.

---

## §3 — `nao-reports`: 3,983 ROWS WITH NO DATE

"The latest NAO view" cannot be sorted by date because there are no dates. A one-column repair.

Find where the date lives at source. ⚠ If it is in the body text rather than in a field — which is
what `lda-lordsdivisions` turned out to be, with its date buried in `…Date: 2008-01-21 UIN: …`
while the column sat null — parse it from the body and say so, because that is a defect in the
fetcher as well as in the data, and the fetcher is what writes the next 3,983 rows.

**Fix the writer, then sweep the backlog.** Report both counts: rows repaired, and whether new rows
now arrive with a date.

---

## §4 — REFRESH `legislation_edges`

Extracted 5 July 2026 against a bulk file dated 30 October 2025, so primary-Act effects are roughly
eleven months behind the statute book.

⚠⚠ **This table holds two different things and only one of them should be refreshed.**

**The amends/repeals relationships** are the official links from legislation.gov.uk and are what S23
approved the graph reading. Refresh these.

**The `cites` rows are a different matter.** All 121,279 of them are markup-only, they exclude every
pre-1963 Act as a source (OI-15), and measured coverage is about **2% of the cross-references
actually present in the text** (OI-16). `citation_edge` holds 98.1% of their pairs plus 226,516
more.

▶ **Refreshing the `cites` rows would put an October date on a 2% table.** A recent extraction date
on an incomplete table is worse than an old one, because staleness is at least visible. Either leave
them untouched pending the retirement decision (Q2 in `GRAPH_4A_REPORT.md` recommends retiring
rather than repairing), or refresh and carry a **coverage figure** on the row, not a date alone.

**Record the extraction date per row, not per table.** A table-level date cannot show a partial
refresh, and a partial refresh is what happens when a long sweep is interrupted.

**Keep `freshness` current, as LEX asks (S27 §5), so the stale caveat is generated from the data and
never hard-coded.** ⚠ The reason is on the record: the storage ceiling that came back from the dead
three times did so because a retracted claim survived in a code comment while the retraction lived
in a report. **A caveat written into a string is a fact that cannot be corrected by fixing the
data.**

Report what changed: rows added, rows whose target moved, rows now pointing at instruments we do
not hold.

---

## §5 — BILLS-API STRUCTURED AMENDMENTS

`/Bills/{billId}/Stages/{stageId}/Amendments` for the 423 held bills. Zero rows today.

**Why this is the highest-value item in the list.** `bills-api` holds Bill metadata and stage
records. It does not hold amendment text. **An amendment is the exact artefact a Scrutinise user is
trying to produce**, and the platform has never been able to show one — what a real amendment looks
like, whether an idea has been tried before, or what happened to it when it was.

**§5.1 Audit before fetching.**

- **3,500 calls is an estimate, not a count.** Call the endpoint for 20 bills across stages and
  years, and report the total the API declares, the page size, and whether a `totalResults` field
  is present and agrees with an entry walk on at least three of them. ⚠ V36 found that header
  present on 226 `ukpga` year feeds and absent on every `uksi` one. A header that is sometimes
  missing produces a wrong denominator silently rather than an error.
- **State the unit.** An amendment paper and an individual amendment differ by an order of
  magnitude. Pick one, say which, and never mix them in a column.
- **423 bills is a numerator.** Report what it is a fraction of. "423 of 700" is the useful sentence.
- **Print three real amendments end to end**, including one withdrawn and one not called.

**§5.2 Fetch.** Use the EDM sweep's fetcher and its self-tuning gap — 60,995 requests at 4.8/s with
**zero 429s**, walking from 250 ms to a 120 ms floor. Do not write a second rate limiter. Licence is
OPL v3.0, same as `bills-api`; record it before the run.

**§5.3 Storage.** ⚠ **Do not store an amendment as a prose section.** The value is the structure.
One row per amendment: bill id, stage id, amendment number, the clause or schedule it targets, the
wording, the sponsors as MNIS ids, and the decision.

The MNIS ids matter — they join to the position graph the EDM sprint filled with 2.13 million
signatures, so an MP's amendments and their signatures become the same kind of evidence about the
same person, joinable without a name match. **Never merge two identities on similarity.**

⚠ **Keep the publisher's own `decision` value and derive nothing from it.** *Agreed to · Negatived ·
Withdrawn · Not moved · Not called.* A withdrawn amendment is not a defeated one, and one never
called was never voted on. Reduce these to a success/failure boolean and all three become
indistinguishable.

---

## §6 — THE THREE-WAY REACH CHECK (carried from 25 Sep, still open)

Seven collections exist in the served search index with zero rows in `corpus_sections`
(`SEARCH_S22_REPORT` §3). A user can get a result card with nothing behind it.

**These are almost certainly the C2/C3 purge's missing layer three.** That purge deleted 168,569
rows from Neon across eight targets — seven whole collections plus the `et-decisions` landing pages
— and the index layer OOM'd and never ran. Seven collections deleted from the database; seven
orphaned in the index. **Confirm that before assuming it**, but if it holds, finishing the index
purge closes the item rather than requiring new work.

**§6.1** Extend `audit:s19-reach` so that for every collection it reports three numbers side by
side: rows in `corpus_sections`, rows in `corpus_fts`, rows in `corpus_vec`/`corpus_chunks`. It
passes only when all three agree within a stated tolerance, and it **names every collection where
they do not** rather than returning pass/fail.

⚠ **Watch it fail first.** Run it against production as it stands; it must name the seven.

**§6.2** Make the purge tooling three-layer by construction. It currently ends a run by printing
`NEXT (index layer, not done here)` — the same defect the purge exists to fix, one layer along. A
run that stops after the database must leave a **machine-readable** record saying so, which §6.1
reads.

⚠ **The OOM exits with code 0 sometimes and 127 others.** LanceDB's Rust allocator aborts without
reliably setting a failure status, so a wrapper sees green and continues. **Judge these runs by the
output they printed, never by the exit code**, and write a completion marker that an absence of
output cannot forge.

**§6.3** Orphaned index entries get a **visible marker**, not suppression (Charlie's decision,
23 Sep). That rendering is CC-Search's. Provide the data and report the change needed; do not edit
their files.

---

## Standing rules

- Bytes before hypotheses — read documents back rather than trusting a counter. Predictions in
  `CHANGE_LOG.md` before each sweep, scored after.
- A guard that cannot fail is not a guard. Every guard states **what it counted**, never whether
  something exists.
- Fix the writer, then sweep the backlog.
- R2 writes before database commits. Heavy jobs on Hetzner, never Railway.
- Scoped commits by explicit path; the tree is shared and a directory add sweeps other streams' work.
- A number in the database has not reached a user until the index carries it and the index has been
  read back.
- **Report `docs/INGEST_LEX_FIVE_REPORT.md`:** §0's one-line answer first, then §5.1's volume
  finding (it can change the sprint), then each item with what a user would see before and after.
  Then what is not done, named. Decisions for Charlie as numbered questions with a recommendation
  and the consequence of each option.
