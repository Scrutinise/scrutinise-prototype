# BRIEF — INGEST CBA-1 EXECUTE: decisions 326–331

**For:** CC-Ingest
**Written:** 4 November 2026, by CCh-Ingest for Charlie
**Authorises:** `docs/INGEST_CBA_1_REPORT.md` D-1 to D-6, answered by CCh-Lex as decisions 326–331
**Read first:** `docs/INGEST_CBA_1_REPORT.md` · `docs/BRIEF_INGEST_CBA_1_SEQUENCED.md`

Two items were pasted separately and are already with you: the **Table 1 print** and the **PSSRU rows**.
They are restated at §8 so nothing is lost, not to be done twice.

⚠ **Pull before anything.** This tree is behind the remote, which holds 307's commits through `ed0d5ea`,
and `CHANGE_LOG.md` is shared with the other session. A commit from behind conflicts there first.

Predictions in `CHANGE_LOG.md` before each write, scored after. One `commit-ingest-cba-1.sh` at the end,
scoped by explicit path.

---

## §1 — ⚠⚠ FIRST: A CONFLICT BETWEEN TWO DECISIONS, SAME TWO ROWS

**Decision 324** (given to the 307 stream): remove the five leftover rows **from the index**; mark the
database rows, do not delete. Two of those five are the old Green Book path.

**Decision 327** (given here): mark the February Green Book superseded, not deleted, **off by default in
search**.

These prescribe different mechanisms for the same two rows:

| | reachability |
|---|---|
| 324 — removed from index | unreachable by any query |
| 327 — off by default in search | still indexed; suppressed from default results; retrievable deliberately |

▶ **327 is the better answer and should win**, because the February edition is what a costing produced in
March 2026 correctly cited, and a scrutiny platform needs to be able to show what the guidance said at the
time. **But it has a dependency 324 does not:** it needs a search-side default filter, and that is
CC-Search's, not yours.

**So:**
1. **If the default filter exists**, implement 327: keep the rows indexed, carry the `superseded` state, and
   report to CC-Search what they must suppress.
2. **If it does not exist, implement 324** — remove from the index — and report that 327 is pending a
   search-side change, naming it. The failure mode of guessing the other way is serving withdrawn Treasury
   guidance in default results as though it were current.
3. **Either way, say in the report which of the two you did and why.** Do not leave this to be inferred.

⚠ The Bank of China rows (2) and the old Aqua Book marker (1) stay removed under 324 regardless. Nobody will
ever want to opt into those, and the Aqua marker holds no document text.

⚠ **Verify any index deletion by querying for the ids afterwards and confirming zero results.** LanceDB with
a quoted identifier (`"id" = 'x'`) matches nothing, raises nothing, returns success, and runs ~70× faster
than the real thing. Five rows is exactly the size at which that failure is invisible.

---

## §2 — 326: WRITE PILOT A TO PRODUCTION, UNDER NEW DOCIDS

Authorised. The annex question is closed: **the October 2026 Green Book has one annex, Annex A (Private
Finance Models)**, confirmed against gov.uk. The 2026 revision folded the earlier annexes into the ten
chapters, which is also why Lex's paragraph citations moved. So `A.1 … A.18` is the whole of it and the
pilot's 391 sections are complete.

- New docIds (`…/the-green-book-2026-paragraphs`) as you proposed. The 89 heading rows stay until nothing
  cites them.
- The 13 tables come from the HTML edition and the 391 paragraphs from the PDF. ▶ **Confirm both renderings
  are the same October edition** before writing — a citation that resolves to text from one edition and a
  table from another is the kind of defect that never announces itself.
- Then the discounting guidance (33) and optimism-bias guidance (31) by paragraph, as Lex asks.

⚠ **The CBA report's delivery check reads "NOT APPLICABLE — nothing was written." That no longer holds.**
Everything here is a production write, so the three-layer check applies: rows in `corpus_sections`, rows in
the keyword index, rows in the vector index, agreeing within a stated tolerance, **named per collection**.
A number in the database has not reached a user until the index carries it and the index has been read back.
MPM is the standing example — held in full for weeks and invisible to search.

---

## §3 — 329: THE THREE NEW TABLES

Civil Service Statistics, PESA, and deflator releases. Lex's shape is right and adds something the brief did
not specify: **release date and price basis per row**, and **suppressed cells stored as suppressed**.

▶ **These belong in the statistics store, not in `corpus_sections`.** A price series is not a section of
text; these numbers are called, not searched. Putting them in the corpus means a user can be handed half a
deflator series as a search result. Confirm this is where they land.

Per row, without exception:
- the publisher's **release date**
- the **price basis** — cash terms at a stated date (Civil Service Statistics is cash at 31 March 2026), or
  indexed to a base year (deflators, 2025-26 = 100), or a stated price year (unit costs)
- **suppression as a state**, never as zero or null: `[c]` (fewer than 10 or 30 staff) and `[n]` (not
  applicable) are different facts and neither is an amount

⚠ `m3-deflators.ts` replaces the whole table and has nowhere to write a release date, so the schema change is
a prerequisite for recording provenance at all — not a tidy-up afterwards.

⚠ **Civil Service Statistics gives gross median salary only.** No employer National Insurance, no pension, no
paybill. Store it as what it is and let Lex apply an on-cost uplift as a stated assumption. Do not compute a
total employment cost here; an inference must not travel as a measurement.

---

## §4 — 331: LOAD THE GREATER MANCHESTER UNIT COSTS

Authorised. `m4-gmca.ts --apply`, 30 entries, built and dry-run verified 4 July.

- Licence **CC BY 4.0**, verified from the workbook's own Introduction sheet.
- ▶ **CC BY 4.0 requires attribution in a specified form.** Record the **required attribution string** in
  `LICENCE_REGISTER.md`, not just the licence name — otherwise the obligation is recorded as satisfied when
  nothing has been built to satisfy it.
- Price year per row, per §3.

---

## §5 — 330: THE NAO LICENCE NOTE

Lex's reading: quotable with attribution for the not-for-profit platform, `licence: NAO non-commercial` on
every row, and the register carries a note that a commercial arm must relicense. **Charlie's to confirm.**

Record it as Lex framed it. The register note is the safeguard that matters: it means the commercial question
can be answered later by reading the register rather than re-auditing the corpus.

---

## §6 — THE CITATION MANIFEST (recommended addition)

Lex asks you to "report what Lex can now cite by paragraph." ▶ **Report it as a machine-readable manifest,
not prose** — one file listing the valid citation keys per document (`green-book:6.58`,
`gb-discounting:3.8`, `managing-public-money:A4.6`, …).

The reason: Lex can then validate a citation at the point of writing, so a bad reference fails there rather
than appearing in a published costing. We have just found that `costing-params.ts` cited "Green Book §6.58"
for four months after the paragraph moved. **A citation that silently re-points is worse than one that
breaks**, and a manifest is what turns the first into the second.

---

## §7 — WHAT IS STILL NOT HELD, AND IS NOT IN THIS SPRINT

Name these in the report so they are not mistaken for done:

- **Impact Assessment template** and **Better Regulation Framework guidance** — Lex says next, not now
- **Distributional analysis** supplementary guidance — still **NOT CHECKED** in the audit
- **FSMA 2000 Explanatory Notes** — 0 held. ⚠ FSMA is a 2000 Act and Explanatory Notes began in 1999, so this
  is probably a holding gap, not an absence. Unlike LGA 1972 and LGHA 1989, where none was ever published and
  the absence is permanent.
- **IA summary-sheet extraction** — gated since 7 Sep; the `BRIEF_INGEST_IMPACT_NUMBERS` §2 design exists
- **Bill-stage IAs** for 3 of the 5 precedents — source is gov.uk / bills.parliament.uk, not `ukia`
- **NAO / PAC cost figures** — 3,983 + 20,564 sections, extraction not built

---

## §8 — ALREADY WITH YOU (do not repeat)

**Table 1 of the 2013 optimism-bias guidance** — print it with its column headings from
`Optimism_bias.pdf` (15pp, 21 April 2013,
`https://assets.publishing.service.gov.uk/media/5a74dae740f0b65f61322c72/Optimism_bias.pdf`), the same
document you processed in Pilot A. Expect four numbers per project type, not two. No parser.

⚠ **Writing the 31 optimism-bias sections to production does not close this.** Table 1 stays flattened text
inside those sections whatever grain they are cut at. The transcription is a **separate small reference
table** with its page number recorded, and it is the only artefact a costing can safely read an uplift from.

**PSSRU** — 9 rows through the citation reference layer; licence field
`all-rights-reserved-presumed`, because the publisher's own record states no licence at all.

---

## §9 — CARRIED, AND STILL UNANSWERED

⚠ **`costing-params.ts` — what was it fixed to?** Decision 328 says done via Lex (325). If the change was
`0.035` → `0.03` and nothing else, **every appraisal longer than 30 years is still wrong and will look
right**, because the headline rate is correct. The rates are forward rates: 3.00% to year 30, then 2.50% to
year 75, then 2.25% to year 125, nothing discounted beyond 125. The parameter must be a schedule with a
per-year lookup. Not your file — but worth one line in the report that it is unconfirmed.

---

## Standing rules

- Bytes before hypotheses — read documents back from R2, not counters.
- A guard that cannot fail is not a guard. Every guard states **what it counted**.
- Held, processed, reachable and correct are four different questions. Answer them separately.
- Archive, never hard-delete. A state label must say why a row is inert, accurately.
- R2 before Neon. Heavy jobs on Hetzner. Scoped commits by explicit path.
- **Report `docs/INGEST_CBA_1_EXECUTE_REPORT.md`:** §1's answer first — which mechanism you used for the
  February Green Book rows and why. Then the three-layer check per collection. Then the citation manifest.
  Then what is not done, named. Decisions as numbered questions with a recommendation and the consequence of
  each option.
