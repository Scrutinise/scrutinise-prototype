# BRIEF — LEX 26-A: positions that mean something, and qualifications that cannot be dropped

**Thread:** LEX. **Written:** 4 September 2026.
**Follows:** 25-Z's positions report.
**Charlie's decisions:** 69 — positions to be included **if** the issues can be dealt with in one
brief. 70 — build the caveat, and it names where the material came from. 71 — approved.

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the report. **Stop only for** spend beyond a ceiling or a change of scope.

⚠ **§1 decides whether the rest of this sprint is worth doing, and it is a diagnosis before it is a
build. Report its size before building it.** If the mapping cannot be made to work in this sprint,
say so early — Charlie will leave positions out of the report rather than ship a thin section, and he
would rather know at 10am than at 6pm.

⚠ **Still blocking a rebuild and not part of this sprint:** 25-Y §1, uploaded documents reaching every
pass of every build. **If that has not shipped, say so in this report** — Charlie is waiting on it
before he rebuilds.

⚠ **CLAUDE.md §25–§28 apply. Read-back list for every string.** A CENTRAL session shares this
repository: explicit file paths only.

---

## §1 — The idea cannot find the thing it is about

**Measured in 25-Z:** on Charlie's idea, `findClaimTarget` returns **NO TARGET**, so the route returns
`claim: null` and the surface renders nothing. That is why he could not find the screen.

⚠ **The graph is not the problem.** 366 signals came back for one recent Commons division, and
"plastic bags" produces a real named claim. **The mapping from an idea to something that has
positions is the whole of the failure.**

**1a. Report what `findClaimTarget` actually looks for**, and why an idea about civil service
accountability finds nothing while an idea about plastic bags finds Lord Goldsmith. ⚠ **State the
mechanism, not the symptom.**

**1b. Report what a target can be.** A division? A bill? A committee inquiry? A named actor? **The
answer determines whether a general policy idea can ever have one**, and Charlie needs that sentence
in plain English.

**1c. Report the size of the fix before building it**, in these terms: can an idea like his be mapped
in this sprint, and what would it be mapped *to*? ⚠ **If the honest answer is that a broad policy
idea has no natural target in the current data, say that.** It is a better answer than a mapping
that guesses.

**1d.** ⚠⚠ **Whatever the mapping is, it must not merge identities on similarity.** Search's standing
rule and it applies here exactly: an unresolved target is visibly thin and harmless; a wrongly
resolved one attributes positions to the wrong subject and nothing looks wrong.

**1e.** Only then build it, and **assert on a real idea with a cold read** — a target found, signals
returned, and a control idea that correctly finds nothing.

## §2 — The coverage window, on the page

⚠ **The Commons division record begins 9 March 2016 and nothing anywhere says so.** A grep for "2016"
across every positions file returns no match. 2,361 Commons divisions from that date; 3,284 Lords
divisions from 1999.

What a user sees is a computed count — *"1 person has a record here"* — ⚠ **which reads as nobody
else took a position, and that is the opposite of the truth.** Same class as the citation defect:
a true sentence made misleading by an unstated boundary.

**2a.** One line in `claim-review.ts`: the record's start date, stated where the count is shown.
**2b.** ⚠ **It appears wherever positions appear** — on screen and in every generated document — and
**Search asked for it in both places**: once per report, and again beside the positions themselves.
**2c.** ⚠ **Read the boundary from the data, not from a constant.** A date hardcoded today is a date
that is wrong the moment the corpus grows.

## §3 — The caveat, and it names its source

**Charlie's decision 70: build it, and have it say where the material came from.**

⚠ Today exactly **one** item in the database is filed under POSITIONS, and it came from **a document
Charlie uploaded himself**, extracted on 30 August by the file reader — **not by any Lex pass.** So
the section promises an assessment of who is for and against, and hands the proposer back their own
sentence.

**3a.** The caveat states plainly what is behind the section: how many items, and that material
extracted from documents the proposer supplied is shown as such. ⚠ **A reader must never mistake the
proposer's own words for research.**
**3b.** It renders on screen and in every document that carries the heading.
**3c.** ⚠ **This is permanent and applies to every user and every idea. It is not a note for one
report.**

## §4 — Recorded and likely, as one object that cannot be split

**The distinction, agreed:**
- **Recorded** — this person or organisation said this. Quoted, dated, cited.
- **Likely** — Lex's reasoning from what they have argued before. Labelled as reasoning, with the
  prior positions it reasoned from shown, dated and linked.

⚠⚠ **The guard is a type, not a review step.** The inference and its grounds are **one object in the
snapshot**, so that a renderer *cannot* print the claim without them. **Not a rule asking a future
author to remember — a shape in which forgetting is impossible.**

**4a.** ⚠ **Every likely position also carries the coverage window**, because an inference drawn from
a record beginning in 2016 is about roughly ten years, not a career, and a reader will assume the
latter.
**4b. Assert the impossibility, not the behaviour.** ⚠ **A check that renders a claim correctly proves
nothing.** The check must attempt to render the claim *without* its grounds and fail to be able to.

## §5 — The same shape, applied to the four other places it has already failed

⚠⚠ **This is the point of the sprint and it is bigger than positions.** Five times in one week,
correct data has reached the output stripped of the thing that made it correct:

| what travelled | what was dropped |
|---|---|
| a citation | its real address — a working link to somebody else's document |
| a challenge | its title |
| a policy | the sort and the reasoning behind it |
| a field the user accepted | the acceptance |
| a likely position | its grounds |

⚠ **Three rules were written — §25, §26, §27 — and each was followed by another instance.** A rule
asks an author to remember. **A type that cannot be split removes the possibility.**

**5a. Report which of the four above could be given the same treatment**, and what it would cost.
**5b. Recommend a first one, and say why.** ⚠ **Do not attempt all four in this sprint.**
**5c.** ⚠ **Report honestly if you think this will not work**, or if some of the five have different
causes that a shared type would not touch. **That answer is worth more than an agreeable one** —
three rules have already been written and broken, and a fourth idea that fails should be found now.

## §6 — Colour, corrected

**Charlie's instruction: he does not mind colour, and would like it bright and distinct — primary
ideally, secondary at a push — as long as what it signifies is clear and intuitive.**

**6a. Bright, distinct colour on the three panel headings is welcome.** This supersedes any reading of
25-Z §5b that treated colour as merely tolerated.

**6b.** ⚠ **The rule that stands is narrower than "no colour": no state may be carried by colour
alone.** Charlie is colour blind. A panel *identity* may be coloured — it also has a large heading and
a fixed position. A *state* — this section needs work, this one is done — must also carry a word or a
shape, so that with the colour removed the meaning survives intact.

**6c.** ⚠ **Test it that way**: render with colour stripped and confirm nothing has become ambiguous.

**6d.** ⚠ **The Coherent Actions section is currently coloured red or orange and carries no "Work on
this" control while its three siblings do.** Report what that colouring signifies. **If it is a real
state it needs a word; if it is decoration it comes out** — either way the four kernel sections carry
the same controls.

## §7 — Acceptance criteria

- The mapping failure is explained as a mechanism, and whether a broad policy idea can have a target
  is answered in plain English.
- No target is ever resolved on similarity.
- The record's start date is read from the data and appears wherever positions appear, on screen and
  in every document.
- The caveat states how many items are behind the section and marks proposer-supplied material as
  such.
- A likely position cannot be rendered without its grounds and its coverage window — **asserted by
  attempting it and failing.**
- §5 is reported with a recommended first candidate and an honest view on whether the approach holds.
- With colour stripped, no meaning is lost anywhere on the three panels.

## §8 — Say what only Charlie can confirm

⚠ **He walked this on an iPad.** Say what could not be tested on a touch viewport, and — if positions
do reach the report — **say plainly whether you would put that section in front of a think tank.**
