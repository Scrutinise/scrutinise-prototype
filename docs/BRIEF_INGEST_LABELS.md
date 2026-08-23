# BRIEF — INGEST: THE LEDGER, AND LABELS THAT DO NOT DESCRIBE THEIR CONTENT

**For:** CC-Ingest
**Written:** 22 August 2026, by CCh-Search
**Executes:** `CORPUS_COVERAGE_AUDIT_22_AUG.md` items 1–4 and Charlie's decisions of 22 August;
`GOLD_CANDIDATES_V2.md` §"legislation titles are unreliable" and the `senedd-cofnod` heading finding
**Format:** audit-then-build. **§4 is an investigation that reports before it fixes.** No git during
the sprint; one **`commit-ingest-labels.sh`** at the end. Scoped commits by explicit path.

---

## §0 — WHY THIS SPRINT EXISTS

Two unrelated-looking problems, both of which cost real time in the last 48 hours.

**The ledger lies by omission.** On 21 August the daily email said `primary-acts-pre-2000` was **100%
complete** while the search contract said we held **21.4%** of pre-2000 primary Acts. Charlie
reasonably concluded one of them was false and that weeks of work had been built on a fiction. **Both
numbers were correct and neither was about the other** — the email counts *sections* (chunks of
text), the coverage walk counts *instruments* (whole Acts and SIs). One Act can be five hundred
sections. Nothing was wrong except that two incomparable numbers were published side by side with no
label saying so.

**Labels do not describe their content.** Two speeches titled *"Senedd Plenary: The 20 mph Speed
Limit"* are, in the body, a debate about oesophageal and stomach cancers. Online Safety Act section
12 is titled *"Serious Crime Act 2007"* while its text is the children's safety duties — **two wrong
of three read.** Titles are indexed and searched, so this costs retrieval, not just keying.

⚠ **These are the same family as every expensive finding this month** — the case-law stylesheet, the
48,883 unreachable sections, the committee names recovered into the database and never into the
index. A value is correct in one place and wrong, missing or unreadable in another, and nothing
compares the two. §4 is the largest instance still open.

**Coordination:** CC-Search may be finishing S12's case-law embed; CC-Graph may be running 3D. Report
changes needed in their files, do not edit them. In particular **do not touch the vector index** —
§3's removal is an index change and must be sequenced with them (see §3).

---

## §1 — THE DAILY EMAIL: TWO NUMBERS, BOTH LABELLED

**Never print one completion figure again.** Print both, side by side, each saying what it counts:

- **Sections ingested** — of the sections we set out to fetch, how many are in and compiled.
- **Instruments source-confirmed** — of the instruments the source publishes, how many we hold, and
  **whether the denominator came from the source or from our own list.** The audit already
  distinguishes source-confirmed (`✓`) from estimated (`~`); surface that distinction in the email
  rather than burying it in a key.

⚠ **A corpus marked "100% complete" against a denominator we invented is not 100% of anything.** The
listing already shows only 53 of 62 "complete" corpora as source-confirmed. The email must make an
unconfirmed denominator visibly weaker than a confirmed one — not a footnote.

**Also in the email:**

- **Delete the storage warning.** `DB: Neon 18 GB (88.5% of 20GB) ⚠️ WARNING` — **there is no 20 GB
  limit.** Neon is on the Launch plan, usage-priced at $0.35 per GB-month; 19.09 GB costs $3.96 a
  month against $33.01 of compute. This is the **third** fictional storage ceiling this project has
  carried, and one of the previous two nearly caused real data to be deleted. Replace it with a
  cost-based line tied to the $50 spending notification already set in Neon, **recording the source
  and the date checked beside the figure**, because a plan price is a fact about a day.
- ⚠ Charlie's note stands: the email's logic is yours to change, the **replacement denominator is
  his call** where one is genuinely ambiguous. Where it is not ambiguous, choose and say why.

---

## §2 — PLAN ROWS FOR THE 1,981,946 SECTIONS NOBODY NAMED

**10.8% of everything we hold is named by no row of the plan** — 21 collections, the largest being
the *entire devolved parliamentary record*: Holyrood 1,043,264, Stormont 196,348, Senedd 191,730;
plus `et-decisions` 293,399, petitions, EDMs, ICO, and the Scottish and NI courts.

- Add a plan row for each, with the same columns as the rest, so the workbook accounts for 100% of
  what we hold rather than 89.2%.
- ⚠ **Do not backfill a denominator by guessing.** Where the source total is unknown, mark it
  unsized — exactly as the four already-unsized corpora are — rather than inventing a number that
  will be quoted as fact within a week. An honest "unsized" is worth more than a plausible estimate.
- Report the resulting figure: what proportion of held sections the plan now accounts for.

---

## §3 — REMOVE THE RETIRED COLLECTIONS FROM THE INDEX

**28,629 sections in three retired collections are still held and still in the vector index**, so
material we decided not to carry can still be returned to a user. That is a correctness problem, not
housekeeping.

- Identify the three, confirm from the change log **why** each was retired, and confirm the decision
  still stands before removing anything. ⚠ A collection retired for a licence reason and a
  collection retired as superseded are different situations; if any was retired for licence reasons,
  say so prominently — that is a compliance exposure, not a tidy-up.
- Remove them from both the keyword and the vector indexes, and from the corpus tables if the
  retirement decision says so. **Removal from the index is the part that matters to a user.**
- ⚠ **Sequence with CC-Search.** If the case-law embed or a vector index build is in flight, wait
  and say so in the report. Two processes rebuilding the same index is how S12's near-miss happened.
- Verify by querying for a known string from each retired collection **through the platform's own
  retrieval** and getting nothing back. A count of rows deleted proves nothing about what a user can
  reach.

---

## §4 — THE INVESTIGATION: TITLES THAT DESCRIBE THE WRONG TEXT

**This is the substantial part of the sprint. Report before fixing.**

### §4.1 Legislation section titles

Known: Online Safety Act section 12 carries the title *"Serious Crime Act 2007"* over the children's
safety duties; 2 of 3 sampled were wrong. Nobody has measured how wide this is.

**Measure it.** Sample at least 200 sections across `primary-acts-2000plus`, `primary-acts-pre-2000`,
`si-2010plus` and `si-pre-2010`, and for each ask: does the stored title correspond to the stored
body? Report the error rate **per collection, with the sample size stated**, and characterise the
failure — is it an offset (titles shifted by one), a parent/child confusion (the Act's title landing
on a section), or something else? **The shape of the error tells you the fix; the rate tells you
whether it matters.**

⚠ Titles are indexed. Quantify the retrieval cost: take ten sections with a known-wrong title and
ask whether the right query returns them. That number is what makes this urgent or not.

### §4.2 Senedd headings

61.1% of all 191,730 `senedd-cofnod` speeches sit in their session's single largest heading block —
14.6 headings per 279 speeches, so most speeches inherit whatever heading came last. Establish
whether the source publishes a per-speech heading we discarded, or whether the association has to be
rebuilt from document structure.

### §4.3 The Welsh-language question, which is probably not what it looked like

GOLD V2 reported that 95% of a 40-row sample had Welsh-language bodies and concluded a Welsh devolved
question "isn't askable in English today". ⚠ **Check that conclusion before accepting it.** The
Senedd's Record of Proceedings is published bilingually — contributions made in Welsh appear with an
English translation. So the likely cause is that we ingested the wrong version or the wrong field of
a bilingual publication, which is a fixable ingest defect, **not** a property of the material.

Establish which it is, from the source, with a real response printed in the report. ⚠ And note the
separate fact for anyone reading this later: **Welsh law is made in English and Welsh, both texts
authoritative, and we hold the English** — roughly 70,000 Welsh SIs and 9,000 Senedd Acts. Nothing
about Welsh *legislation* is blocked. Only the debate record is in question.

### §4.4 What to build in this sprint

**Only what the measurement justifies.** If §4.1's error rate is high and the shape is systematic,
fix the writer and sweep — but **fix the writer first, then the backlog**, which is the order that
worked for case-law titles and committee names. If it is low or unsystematic, report it and propose
a check rather than a sweep.

⚠ **A title is indexed, so any corrected title must be carried into the index**, not just the
database. S11 built the general refresh path for exactly this; use it. The case-law title recovery
reached the database on 19 August and no user saw a single recovered name until someone happened to
look.

---

## §5 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-ingest-labels.sh`; nothing owned by search, graph or lex
  edited — report needed changes instead.
- Every check watched failing against the real broken state, not a synthetic one. Every check that
  asserts over a ranked or limited set must assert over the whole population or print its own
  cut-off — three sprints in a row produced a check that could not fail because of this.
- Predictions logged before sweeps run; bytes before hypotheses — read bodies and rendered results,
  never counters.
- **Report `docs/INGEST_LABELS_REPORT.md`:** §4's measurement first, per collection, with sample
  sizes and what each rate is a proportion of, and what a user would see. Then the ledger changes,
  with the email's new shape quoted verbatim. Then §3, including why each retired collection was
  retired. Then what is NOT done, named. Decisions for Charlie as numbered questions with a
  recommendation and the consequence of each option.
- Change-log and handoff entries labelled **INGEST**.
