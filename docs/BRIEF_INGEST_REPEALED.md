# BRIEF — INGEST: THE LAW WE HOLD AS A ROW OF DOTS

**For:** CC-Ingest
**Written:** 26 August 2026, by CCh-Search
**Executes:** `OPEN_ITEMS.md` OI-6, OI-7, OI-13; `SEARCH_S13_REPORT.md` §1.4; Charlie's decision of
26 August
**Format:** audit-then-build. **§1 reports before it fetches anything in bulk.** No git during the
sprint; one **`commit-ingest-repealed.sh`** at the end. Scoped commits by explicit path.

---

## §0 — WHY THIS SPRINT EXISTS

**What a user sees.** They ask whether the old law banning schools from promoting homosexuality is
still in force. Search finds section 28 of the Local Government Act 1988 at second place — and then
correctly hides it, because everything we hold is this:

```
28 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
```

A section number followed by thirty-two dot leaders, which is how legislation.gov.uk renders a
provision that has been repealed. **We do not hold the words.** So the platform can neither answer
the question nor explain why it cannot.

**Two things are wrong with that, and they are separable:**

1. **We say nothing.** A repeal is a fact, and often the most useful fact available: *this was law,
   it was repealed on this date by this instrument.* Today we suppress the row and go quiet, which is
   indistinguishable from the provision never existing. ⚠ That is the platform's single worst failure
   mode — **a gap that looks like an absence of evidence.**
2. **We could hold the text and do not.** legislation.gov.uk publishes an *original (as enacted)*
   version of every Act alongside its revised text. A provision repealed in 2003 is still present, in
   full, in the 1988 Act as enacted. **This is an ingest gap we can close from a source we already
   use.**

⚠ **Correcting an assumption before anyone acts on it: BAILII is case law, not legislation, and is in
any event blocked by its own terms.** It is not the route to repealed statutory text and must not be
offered to a user as one. The route is legislation.gov.uk's *as enacted* and point-in-time versions.

**Scale, from the open register:** **249,256 rows** whose entire body is dot leaders, with a further
~1,487 the repeals table never held; and **~32,040 partially repealed sections** (95% CI
25,956–40,088) — live law with subsections removed — carrying no label at all.

---

## §1 — AUDIT FIRST, AND REPORT BEFORE FETCHING ANYTHING IN BULK

1. **Characterise the placeholders.** Of the ~250,743 dot-leader rows: how many are whole-section
   repeals, how many are something else (never commenced, moved, spent)? Print ten real examples in
   full. ⚠ The source uses this rendering for more than one situation and treating them all as
   "repealed" would put a false statement in front of a user.
2. **Establish what the repeal facts actually are, per row:** the date of repeal, the instrument that
   did it, and the extent (a provision can be repealed in England and live in Scotland). Say where
   each of those lives — the revised text's own annotations, a separate feed, or nowhere.
   ⚠ **Extent matters and is easy to get wrong.** *"Repealed"* when the answer is *"repealed in
   England and Wales, still in force in Northern Ireland"* is worse than saying nothing.
3. **Establish what *as enacted* gives us.** For a sample of 30 placeholder rows, can the original
   text be obtained from legislation.gov.uk, in what format, and at what request cost? Report the hit
   rate. ⚠ Expect pre-1963 Acts to behave differently — the regnal-year identifier trap has now bitten
   this project three times, in three different code paths.
4. **Cost the bulk fetch** from that hit rate: requests, elapsed time, storage, embedding. Report it
   **before** starting. ⚠ Bulk fetching 250,000 documents is not something to begin inside a sprint
   that was scoped as a fix.

▶ **Report §1 and stop if the fetch is large.** Charlie decides the fetch; the labelling in §2 does
not depend on it and should ship regardless.

---

## §2 — SAY WHAT WE KNOW, WHICH IS ALREADY MORE THAN WE SAY

**This is the half that is cheap and should ship even if §3 is deferred.**

Give every placeholder row a structured repeal record: **repealed / never commenced / other**, the
date, the repealing instrument, and the extent. Where a fact is unknown, it is **unknown**, not
absent and not guessed.

**Then make it visible.** A user searching a repealed provision should be told, in ordinary words:

> **Repealed.** Section 28 of the Local Government Act 1988 was repealed on 18 November 2003 by
> section 122 of the Local Government Act 2003 (England and Wales). We do not currently hold the
> text of this provision as it stood.

⚠ **Wording constraints, and they are not stylistic:**

- **Never present a repealed provision as current law.** This is the same class as the case-law
  rule about citing a repealed section, which an earlier sprint spent itself closing.
- **"We do not hold the text" is a different statement from "this provision had no text."** Say the
  first.
- **Do not send the user to BAILII** (§0). Where a link is offered, it is to the *as enacted* version
  on legislation.gov.uk, and only where that version is confirmed to exist.
- ⚠ The display half of this touches the search stream's rendering. **Provide the data and report the
  exact change needed; do not edit their files.**

### §2.1 The placeholder detector, which has now been defeated three times

`isRepealedPlaceholder` has been beaten by the bare number (`31 . . .`), then the provision label
(`Article 31 . . .`), then the multi-letter suffix (`12ZA . . .`, `502GC`) — one letter always
worked, which is why it survived two fixes.

⚠ **Every fix so far has been "strip one more leading thing". Stop doing that.** Invert the test:
a body is a placeholder when, **after removing all leading identifier-shaped tokens, what remains is
only dot leaders and whitespace** — defined by what is left, not by what is stripped.

**Predict the next costume before it arrives** and write the prediction in the report. Then build the
check with negative controls drawn from all three historical failures **plus** two you invent, and
watch every one of them fail against the current implementation before the fix.

---

## §3 — FETCH THE TEXT, IF §1 SAYS IT IS AFFORDABLE

Only on Charlie's approval of §1's cost.

- Store the original text **as a distinct thing from current law**, never merged into the live row.
  A repealed provision and a provision in force must not be capable of being confused by any later
  reader, query or index.
- ⚠ **It must not be retrievable as though it were operative law.** Decide and state how: a separate
  collection, a required status field, or exclusion from the default streams. **Report the choice and
  its consequence** — this is a decision about what search can return, so CC-Search must be told what
  changed.
- Verify by hand-reading 30 fetched provisions against the source. A count of documents written
  proves nothing about what is in them — the case-law stylesheet was 74,896 documents of formatting
  code that passed every count.

---

## §4 — THE PARTIAL REPEALS, WHICH ARE THE MORE DANGEROUS HALF

**~32,040 sections are live law with subsections removed and carry no label at all.** The repeals
table has never held a row of this kind.

⚠ **This is worse than a whole repeal**, because the row looks entirely normal. A user reads a
section, acts on it, and the subsection they relied on was removed years ago. A whole repeal at
least renders as dots.

The backfill is already written and dry-run, and blocked only on a production write (OI-2, step 7 of
`C3_EXECUTE.sh`). **No index rebuild and no redeploy — the join is live.** Get it run, verify the
count against the confidence interval, and report where it lands.

---

## §5 — TWO THINGS TO REPORT, NOT FIX

- **15,784 `si-pre-2010` instruments have no title on either identifier form**, and the publisher's
  own enumeration has no title for them either. The regnal repair does not touch these; the cause is
  unexamined. **Report what you find; do not start it.**
- **`historic-hansard`'s earliest date is `1013-06-24`** — almost certainly `1913` misparsed. Small,
  and it corrupts any date filter over 4.6 million sections. Confirm the cause; fix only if it is a
  one-line parse.

---

## §6 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-ingest-repealed.sh`; nothing owned by search, graph or lex
  edited — report needed changes instead.
- Every check watched failing against the **real** broken state, not a synthetic one.
- Predictions in `CHANGE_LOG.md` before any sweep; bytes before hypotheses.
- ⚠ **Any rewrite of stored bodies voids search baselines.** The 20 August case-law repair invalidated
  a whole measurement set twenty hours after it was taken. **Tell CC-Search before, not after.**
- **Report `docs/INGEST_REPEALED_REPORT.md`:** §1's characterisation first, with what each figure is
  a proportion of and what a user would see. Then the labelling, with the exact user-facing sentence
  quoted. Then the fetch decision. Then what is NOT done, named. Decisions for Charlie as numbered
  questions with a recommendation and the consequence of each option.
- Change-log and handoff entries labelled **INGEST**.
