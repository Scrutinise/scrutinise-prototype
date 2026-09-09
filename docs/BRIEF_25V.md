# BRIEF — LEX 25-V: make the First Scrutiny document printable

**Thread:** LEX. **Written:** 2 September 2026.
**Source:** 25-U's audit, which answered "would you hand this to a think tank today?" with **no**, and
named three reasons. This brief is those three and what the audit found behind them.

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the report. **Stop only for** spend beyond a ceiling or a change of scope.

⚠ **Charlie's build allowance is 0.** Do not plan work that needs a build without saying so. If a
section can only be verified by a build, say which and stop there.

⚠ **§1 is the sprint.** A misattributed citation in front of a think tank costs more than every other
defect in this document combined, and it is the one failure that cannot be repaired by explanation.
§2–§4 in order. §5–§8 if reached.

⚠ **CLAUDE.md §25 and §26 apply.** And add §27 from 25-U's own finding: **what a prompt shows reaches
the output as readily as what it asks for.** An illustrative example inside a prompt is a template
the model may fill.

**Must not be disturbed:** the sort, which now runs — 24 of 24 sorted and reasoned, and REVISE did
not wipe them. The build on the worker. Everything 25-S shipped.

---

## §1 — Three citations in ten did not support what they were cited for

**What 25-U found, on ten citations sampled from one document:** one dead page; one cited as the
Greensill report that loads written evidence on research funding, poly-pills and artificial hearts;
one cited as "Managing Ministers' conflicts of interest" that loads lessons from the Chilcot inquiry.

⚠⚠ **And the detail that makes this urgent: all three returned HTTP 403 to a plain fetch — the same
403 the correct parliamentary citations return.** An automated link-checker passes every one of
them. Only opening them in a browser separated *blocked* from *wrong*.

**1a. Establish the real rate.** Ten is a sample, not a measurement. ⚠ **Check every citation on this
proposal, and report the count and the rate.** If the rate holds at three in ten across 55 citations,
that is sixteen wrong citations in a document Charlie intends to hand to a think tank.

**1b. Diagnose the cause before fixing anything.** ⚠ **Report which of these it is, with evidence:**
- the URL is constructed or guessed rather than taken from the corpus row;
- the title or description is written by the model rather than read from the source;
- the right document was retrieved and the wrong identifier stored;
- the corpus row itself is wrong.

**These have entirely different fixes and the report must not blend them.**

**1c. Build a verification that can tell "blocked" from "wrong".** ⚠ **A status code cannot.** It has
to read what actually loads and compare it against what the citation claims. Report what that costs
per citation and per document.

**1d. Say what happens when verification fails.** Options to put to Charlie, not to choose: the
citation is dropped; it is kept and marked unverified; the finding that rests on it is withdrawn.
⚠ **Note which of those is compatible with the standing principle that the corpus is ground truth
and Lex never asserts a fact the corpus did not return.**

**1e.** ⚠ **This is not confined to this proposal.** Report whether the same cause would affect the
Starkey programme's report and any other built idea. **Say so plainly if it would.**

## §2 — The document has no centre

**The report's Guiding Policy section prints one sentence:** *"No approach has been committed to on
this proposal yet."* It renders the committed approach, and none is committed. ⚠ **So the sort that
25-P designed, 25-R fixed and 25-S dressed — 24 policies sorted and reasoned — reaches the screen and
never reaches the document.** The 411-word summary is more informative than the 45,101-word report on
the most important field in it.

**2a.** ⚠ **This is the same class as the last four defects: correct data that does not reach the
output.** Report why the document renders only a committed approach, and whether that was a decision
or an assumption.

**2b. When nothing is committed, the document says so *and* prints the candidates** — grouped as the
screen groups them, with the reasoning and the history lines. ⚠ **"Not yet decided, and here are the
twenty-four approaches under consideration with why each is there" is a First Scrutiny document. "No
approach has been committed" is a blank page.**

**2c.** The same question for **"The problem"**, also declared empty. Report whether it is empty in
the data or empty only in the document.

## §3 — The document shouts internal test language at the reader

Quoted from 25-U: **`KERNEL TEST FAILED` × 32**, `THE ROAD TAKEN AT "guidingPolicy:instrument"`,
`"Drafted by Lex from the toolkit"` × 36.

**3a.** ⚠ **`KERNEL TEST FAILED` in capitals, thirty-two times, is the loudest thing on the page and
it is our test apparatus talking to itself.** Rename to language a reader can use — what was tested,
what the answer was, and what it means for the proposal.
**3b.** Same for the other two. **3c.** ⚠ **Sweep for the rest.** Report every remaining string in an
outward-facing document that is our vocabulary rather than a reader's, with each instance quoted.

## §4 — A prompt's own example came back as data

The report told a reader, under *Questions the research could not answer* on a civil service
accountability proposal: *"No source quantifies how many bags enter waterways each year."* That is
`deepening-client.ts:90`'s illustration of its own rule, copied verbatim — and this morning's build
rewrote the row and put it back, so it was live rather than stale.

**4a.** The instance is fixed. ⚠ **Now sweep the class: every prompt in the build, for illustrative
examples that a model could fill in as content.** Report each one found and whether it has ever
appeared in output.
**4b.** Add to `CLAUDE.md`: **what a prompt shows reaches the output as readily as what it asks for.**

## §5 — The document contradicts itself

*"129 accepted findings"* appears in the same document as *"0 of 56"*. **Report which is true, why
both are printed, and fix the one that is wrong.** ⚠ A reader who spots one internal contradiction
stops trusting the arithmetic everywhere else.

## §6 — Dates we do not have are being printed as precise

58 date flags print **2010-01-01** for 100 rows that only ever carried a year. ⚠ **That is invented
precision, and it is the opposite of the standing principle.** A row known only to a year prints as
the year. Report how many rows are affected and what each now prints.

## §7 — The challenges are the best content and are unlabelled

**221 of 225 have no title. 185 of 225 name no source model.** 25-Q §7 reported this built; the
prefix is gone but nothing replaced it. ⚠ **Report why the titling did not take effect**, then fix
it. These are, in 25-U's own words, the sharpest content in the document.

## §8 — Open questions that name no route to an answer

*"Decisions still open"* exists, which is why 25-U built nothing. ⚠ **What it lacks is the rule: every
item states what would resolve it.** A question with no route to an answer is a complaint. Add it.

## §9 — Acceptance criteria

- The true citation error rate is measured across every citation, not sampled.
- The cause is named as one of the four possibilities, with evidence, not blended.
- Verification distinguishes a blocked page from a wrong one, and its cost is stated.
- Whether the same cause affects the Starkey programme is answered plainly.
- With nothing committed, the document prints the candidate approaches, grouped and reasoned.
- No outward-facing document contains `KERNEL TEST FAILED`, `THE ROAD TAKEN AT`, or `Drafted by Lex
  from the toolkit`.
- No prompt example can appear as content, and the sweep is reported.
- The finding counts agree with each other.
- A date known only to a year prints as a year.
- Challenges carry titles and a source line.
- Every open decision states what would resolve it.

## §10 — The bottom line, again

⚠ **End with the same question 25-U ended with: would you hand this document to a think tank today?**
If still no, name what remains, in order.
