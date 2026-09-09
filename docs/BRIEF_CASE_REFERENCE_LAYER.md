# BRIEF — THE CASE REFERENCE LAYER: say what the case is, without holding it

**For:** CC-Ingest (extraction) with a named handover to CC-Search (retrieval)
**Written:** 27 August 2026 · **Author:** CCh-Ingest for Charlie
**Size:** one sprint. No licence needed, no fetching from any restricted source, $0 of external spend beyond embedding a few thousand short records.

---

## §0 — What a user sees today, and what they should see

Ask the platform about **Caparo** — the leading authority on when a duty of care is owed for negligent statements — and it returns an employment tribunal case from 2017 involving a company called Caparo. Ask about **ex p Coughlan** and it returns "Mrs M Coughlan", a 2020 tribunal case. Of ten leading pre-2003 authorities tested, **none was returned and three came back as a different case with a similar name.**

Nothing returns nothing. That is the problem. **A confident wrong answer is worse than an empty one**, because it will be quoted.

We are not going to hold these judgments. BAILII has refused in writing (16 June 2026) and its terms independently forbid it; The National Archives has confirmed it will not digitise or license digitisation of its pre-2001 paper holdings. **This is a permanent boundary, not a backlog.**

But we already hold everything needed to say what the case *is*. 74,896 modern judgments cite these authorities. Hansard, committee reports and Law Commission papers discuss them at length — the Law Commission routinely spends whole reports explaining what a leading case held and why it should change. All of that is ours, under open licences.

**What the user should see:**

> **Donoghue v Stevenson [1932] AC 562** — House of Lords
> Established the modern duty of care in negligence.
> **Not held in our corpus.** Our case law begins in 2003 for the English courts.
> Cited in **412** judgments and discussed in **31** parliamentary and Law Commission documents that we do hold.
> → Read the judgment on BAILII · → Where it is discussed in our corpus

---

## §1 — EXTRACT (audit first; report before building the table)

**1.1 Find the citations.** Extract case citations from every collection we hold — `tna-caselaw`, `committees-reports`, `committees-evidence`, `lawcom`, `scotlawcom`, `historic-hansard`, `pwdata-*`, `nao-reports`, `explanatory-notes`.

Two citation forms, and both are needed:
- **Neutral citation** (2001 onwards): `[2019] UKSC 22`
- **Law report citation** (the only form pre-2001 cases have): `[1932] AC 562`, `[1990] 2 AC 605`, `(1932) SC (HL) 31`, `[1968] AC 997`

⚠ **The pre-2001 authorities have no neutral citation.** A parser written only for the modern form will find nothing and report success — the exact failure shape this project has hit repeatedly. Build for law report citations first and test on the ten cases in `docs/pre2001_probe.json` before running anything at scale.

**1.2 Report before building.** How many distinct citations, how many pre-2003, what the top 200 by citing-document count are, and the ten most common malformed matches. **Print twenty extracted citations in full alongside the sentence they came from.** If the parser is wrong, this is where it shows, not in a count.

**1.3 Names — the trap.** *Donoghue v Stevenson* also appears as *Donoghue v. Stevenson*, *M'Alister (or Donoghue) v Stevenson*, and *Donoghue v Stevenson [1932] AC 562*. Normalise for matching, but **never merge two case identities on name similarity alone** — a citation must agree as well. *Caparo Industries plc v Dickman* and *Caparo Group Ltd v X* are different cases and the platform has already confused their modern namesakes. An unresolved name is visibly thin and harmless; a wrongly merged one is a case that does not exist.

---

## §2 — BUILD THE REFERENCE RECORDS

A new collection, `case-references`. One record per distinct case, **not** a section of judgment text — nothing in this collection contains any text from a judgment we do not hold.

Each record carries: case name (canonical and variants), citation(s), court, year, **held / not held**, count of citing documents in our corpus broken down by collection, and up to five links to the places in our corpus where it is discussed.

**The description comes from what we hold.** Where a Law Commission report or a modern judgment characterises what a case decided, quote it briefly with attribution and a link — that is OGL and Open Justice Licence material we are entitled to use. **Do not generate a description from a source we do not hold.** If nothing we hold says what a case decided, the record says the case exists and is cited N times, and says nothing about its content. **An unknown fact is unknown, not absent and not guessed.**

**Links out.** For a case we do not hold, link to BAILII. Two things first:

1. ⚠ **Verify BAILII's terms on deep linking before shipping a single link.** Expectation is not verification, and this project has paid for that distinction. If deep links are restricted, link to their search page instead.
2. Where the case is post-2003 and we do hold it, link internally. Where it is on Find Case Law but outside our corpus, link there.

---

## §3 — WIRE IT INTO RETRIEVAL (handover to CC-Search — do not edit their files)

This is the half that fixes the user-facing defect, and it is a search-stream change. **CC-Ingest provides the data and the measurement; CC-Search makes the change.**

The requirement: when a query is recognisably about a named case, the reference record must outrank any modern case that merely shares a name. Today *Caparo* returns a 2017 tribunal decision at the top.

**Measure it, do not assert it.** The ten probes in `docs/pre2001_probe.json` are the test set. Before: 0 of 10 correct, 3 of 10 returning a wrong case. After: all ten should return the reference record and state the coverage boundary. **Watch it fail first** — run the test against the current build and record 3/10 wrong before anything changes.

⚠ **Do not suppress the tribunal cases.** *Mrs M Coughlan* is a real case and someone may want it. The fix is ranking and labelling, not deletion.

---

## §4 — WHAT THIS IS NOT

State these in the report so nobody later mistakes the design:

- **We do not fetch from BAILII.** Not in bulk, not one page at a time, not through a browser, not on a user's behalf. Automated retrieval is what their terms prohibit, and the user agent does not change what the act is.
- **We do not reproduce judgment text we do not hold.** The reference record is our own writing plus attributed quotation from open-licensed sources.
- **We do not claim to hold what we do not.** Every record for an absent case says so on its face.

---

## §5 — REPORT

Plain English: what a user saw, what they see now, and the before/after on the ten probes with both numbers printed. Then: how many cases have reference records, how many of those are pre-2003, and how many have a description versus only a citation count. Then what is not done, named.

Decisions for Charlie as numbered questions with a recommendation and the consequence of each option.

Scoped commits by explicit path; one `commit-ingest-case-references.sh` at the end.

**Standing rules that apply directly here:** a check that cannot fail is not a check — watch the 3/10 wrong before the fix · never merge two identities on similarity · bytes before hypotheses, print real extracted citations rather than counts · a field corrected in the database has not reached a user until the index is refreshed and the refresh is verified.
