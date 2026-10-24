# BRIEF_GRAPH_9 — POWER OR MENTION · THE `mentions` KIND · EXPLANATORY NOTES

Stream: Graph · 24 Oct 2026 · CCh-Search
Depends on: GRAPH_8 `onwardFrom()` (live at `2030266`)
Blocks: nothing — but Lex's collision report is **live now** showing rows §2 says are false

**Self-contained.** Charlie has approved all four items below.

---

## §0 FIRST, AND BEFORE ANYTHING ELSE — THE 36.1% QUESTION

GRAPH_8 reported: **36.1% of the section-level references in
`legislation_edges` are wrong** (CRaG "section 52(2)" also filed as plain
"section 2"). GRAPH_8 worked around it by reading `citation_edge` instead.

⚠ **GRAPH_6's effects reader reads `legislation_edges`.** It is what answers
*"section-149: 0 amends (+5 on the whole Act)"* — and that answer is live and
quoted by Lex today.

**Determine which rows the 36.1% covers.** One query, and it gates whether any
provision-level figure in the product can be trusted:

- Take the **official** effect rows (`tna-bulk-amendments`,
  `tna-inforce-dataset`) and compare the stored provision identifier against
  the publisher's own identifier for the same row.
- Report the mismatch rate for official rows and for extracted rows
  separately.

**Two outcomes, two different consequences — say which it is:**

| If | Then |
|---|---|
| the 36.1% is confined to **our extracted** rows (made-under, cites) | GRAPH_6 is sound. Act-level and provision-level effect figures stand. Nothing to do but record the finding. |
| it also touches the **official** rows | **Every provision-level figure in the product is suspect** and must be withdrawn from display until fixed. Act-level totals are unaffected, because counting an Act needs no parsed section number. Stop and report before doing anything else in this brief. |

My expectation is the first: official rows carry publisher-supplied
identifiers rather than numbers parsed out of a sentence. **An expectation is
not a measurement.** Measure it.

---

## §1 WHY THIS BRIEF EXISTS (include in the commit message)

Every one of the eleven "made under CRaG section 20" rows is false. Section 20
is the treaty-ratification procedure; it confers no power to make anything.
Those instruments reference it because they **followed its procedure**, not
because they were **made under a power in it**.

The collision report is live and shows those eleven rows under *"What depends
on this"*. Only a warning sentence currently stops a reader concluding that
eleven instruments depend on section 20. A warning that asks the user to do
the classification is not a classification.

⚠ **And the wording cannot settle it.** GRAPH_8 found `uksi/2020/38` saying
*"under section 20(1)(a)"* — enabling language on a provision that confers no
power. A keyword rule on "under" versus "in accordance with" would get this
case wrong. **The words lie. Read the provision instead.**

---

## §2 THE POWER-OR-MENTION TEST

Two instruments, strongest first. They are deliberately independent, so
agreement is evidence and disagreement is a flag.

### §2.1 Primary — read the provision's own text

A provision that confers power to make subordinate legislation **says so**:
*"may by regulations"*, *"may by order"*, *"rules may be made"*, *"may by
statutory instrument"*, *"regulations under this section"*. Section 20 of
CRaG contains no such words.

This reads the source of truth rather than a pattern around it. We hold the
section text (`read_section`).

**Build the pattern list from the data, not from a guess.** Derive it from
provisions that are **independently confirmed** enabling (see §2.2), then test
it against provisions independently confirmed **not** enabling, and report
precision and recall against that set. If the list is assembled from
intuition it is uncalibrated and must not be presented as a determination.

⚠ Known false-negative shape: a power conferred in one section and *exercised*
with reference to another. The rule must not claim a negative it cannot
support — hence three states below.

### §2.2 Confirming — the official enabling record

⚠ **First establish whether we hold one at all.** GRAPH_6 listed four
sources: `tna-bulk-amendments` and `tna-inforce-dataset` (official),
`clml-si-preamble` and `clml-body-citation` (ours). **No official
enabling-power source appears in that list**, so the likeliest answer is that
every "made under" row we have is our own reading of a preamble.

Report, explicitly:

1. Do we hold a publisher-supplied enabling-power record? Name the source, or
   say none exists.
2. If not, is one obtainable from legislation.gov.uk (the SI metadata's
   powers-exercised relationship, or a bulk dataset)? Size it; do not fetch it
   in this sprint.

**If we hold none, §2.1 stands alone, is uncalibrated, and every answer it
gives is low confidence.** Say so on every row. Do not let an uncalibrated
text rule wear the grammar of a determination — that is the error we have
named three times now.

### §2.3 Three states, never two

| State | When | What the panel says |
|---|---|---|
| `power` | the provision's text confers a power, and the official record agrees (or is absent and the text is unambiguous) | shown under "what depends on this" |
| `mention` | the provision's text confers no power **and** the official record never names it as enabling | shown separately: *"N instruments reference this provision, having followed its procedure. None is made under a power in it."* |
| `unknown` | the two instruments disagree, or the text is ambiguous, or neither is available | shown as unresolved, with the stored words, for a human |

**Absence of data is never absence of power.** A two-state rule converts a gap
in the record into a confident false statement, which is the specific failure
this project has made with coverage figures twice.

### §2.4 CRaG section 20 is the acceptance test

Expected result: `mention`, eleven instruments, zero dependencies. If the
rule returns anything else, the rule is wrong — the legal position is not in
doubt.

Report the three rows that name the provision with their stored words, and
confirm each reads as procedural: *"the requirements of section 20"*
(`ssi/2024/101`, `uksi/2024/512`) and *"under section 20(1)(a)"*
(`uksi/2020/38`).

---

## §3 `mentions` — A SEPARATE, WEAKER KIND

Approved. Text-detected references become their own kind, `mentions`.

- **Never merged into `cites`.** Marked-up citations are about **1 in 19** of
  the references held for the Equality Act. Merged, roughly 95% of any
  "citations" answer would be the weaker kind with no way to tell which.
- **Not in the default walk.** Opt-in, like `caselaw-markup`. The depth-3
  saturation (13–22% of the statute book) only appears once these are
  counted, so they differ at scale as well as in confidence.
- Returned with `strength: 'reference'` and a distinct label on screen.
- Report the marked-up / text-detected ratio for each of the four Acts
  GRAPH_8 measured, so the 1-in-19 figure has company.

---

## §4 EXPLANATORY NOTES — TAG, DO NOT EXCLUDE

Approved: tag rather than exclude, and measure the real proportion.

- **Explanatory notes are not part of the law.** A fragment from a note shown
  as the words of a statute is a misrepresentation — the same family of error
  as an invented quotation, even though nothing was invented.
- **But they are useful.** A note often explains *why* a reference exists,
  which is what a drafter wants. Excluding them throws that away and costs a
  re-extraction.
- Every row carries its source document kind, and a note-sourced row renders
  *"explanatory note — not part of the Act"*.
- ⚠ GRAPH_8 said *"at least 5.7%"*. **"At least" is a floor, not a
  measurement.** Report the real proportion, with the denominator stated:
  note-sourced fragments as a share of all stored fragments walked.

---

## §5 ALSO IN SCOPE — TWO SMALL ITEMS WITH NO OTHER OWNER

**a. `detectionOf()` does not recognise case-law citation rows**
(`statutory-graph.ts:73`), so wherever they pass through it — line 715, in the
effects code — they are tallied as `unknown`. The onward reader is unaffected
because it reads case law directly. Graph owns this file; fix it or record why
not.

**b. `verify:statutory-parity` has been red since GRAPH 5** — 7 divergences,
every one a `caselaw-markup` row or the case-to-case layer added after the web
reader was written. It has had no owner for three sprints. Either make the
reader aware of the newer layers or retire the check with the reason. **A
permanently red check teaches everyone to ignore red.**

---

## §6 CONSTRAINTS

a. **§0 first.** If the official rows are affected, stop and report.

b. **No stored fragment is ever presented as a quotation of a provision.**
GRAPH_8 established they are 300-character windows ending at the reference,
cut at both ends, with the half that carries the meaning usually missing.

c. **Three states, never two** (§2.3).

d. **An uncalibrated rule is labelled low confidence on every row.** No
determination grammar without a validation set.

e. **`mentions` never merged into `cites`, never in the default walk.**

f. **State what you counted**, with the denominator, everywhere a proportion
appears.

g. **The check must be able to fail.** At least one deliberate break must be
*a procedural mention classified as a power* — the failure this brief exists
to prevent. Report cases red, then revert exactly.

---

## §7 REPORT

1. **§0's answer**, official and extracted mismatch rates separately, and
   which of the two consequences follows.
2. Whether a publisher-supplied enabling-power record exists in our corpus;
   if not, whether one is obtainable, and sized.
3. The text rule's pattern list, **how it was derived**, and its precision and
   recall against the validation set — or a plain statement that no validation
   set exists and the rule is uncalibrated.
4. CRaG section 20: the three states as returned, with the eleven rows and
   their stored words.
5. The marked-up / text-detected ratio for all four Acts.
6. The real explanatory-note proportion, with its denominator.
7. The mutation run.
8. What the data said that this brief got wrong. The last three sprints found
   five, seven and eight such things; that section has been the most useful
   part of every report.
