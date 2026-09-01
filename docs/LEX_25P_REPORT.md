# Sprint 25-P — the Guiding Policy becomes a decision

**1 September 2026, 02:49 UTC.** Brief: `docs/BRIEF_25P.md`.

---

## What was built, in one paragraph

The guiding policy stopped being a list of eighteen appended candidates and became something a
proposer acts on: every candidate has a **stable number that never moves**, Lex **sorts** them into
policies, actions and restated goals with its reasoning shown, an item that is really an action
**moves only on the user's consent** and follows the fate of the policy it implements, two policies
can be **merged by number** into one of four verdicts, and the choice can be **settled, phased,
rejected, restored, or left explicitly unresolved with a reason**. Alongside it, `EvidenceItem`
gained the date column 25-O went looking for and did not find — **315 of 501 evidence rows turn out
to be five or more years old, and none of them said so.**

---

## §1 — The Guiding Policy screen

| | |
|---|---|
| §1.1 stable numbers | `PolicyOption.number`, assigned once in `createdAt` order, never renumbered. A rejected 7 leaves a gap; `nextNumber` is max+1 and never reuses one. |
| §1.2 the sort | GUIDING_POLICY / COHERENT_ACTION / GOAL_RESTATEMENT, each with `kindReason` in Lex's words. A reclassification with no reason is a disappearance. |
| §1.3 consent to move | An action is **offered**, never moved. Accepted while its policy is unsettled, it is **parked with that policy** — and if the policy is rejected, the action is rejected with it, naming the policy number. |
| §1.4 the implied cause | Where a policy answers a cause the diagnosis does not hold, Lex offers the cause. Accepting adds it, marked as the user's. **Declining records the mismatch against the policy** and keeps the claim, because it is a real weakness the adversarial read must see. |
| §1.5 pairings | ALTERNATIVES / CHAIN / DISPERSIVE, computed from the causes each policy attacks and the cause tree. |
| §1.6 two ratings | Importance and addressability, never combined, each carrying `basis: REASONED / RETRIEVED / NOT_FOUND`. |
| §1.7 merge by number | Four verdicts. **Only `MERGE` writes**; the other three are advice. Parents are superseded, not deleted — they keep their rows and their numbers. |
| §1.8 the chain-link | Renders on screen **and in both generated documents** — see below. |
| §1.9 two rounds | After two, Lex offers to proceed unresolved rather than asking again. |
| §1.10 what you leave with | Settle, phase NOW/LATER with a reason, reject with a reason, restore **to the original number** with the old reason retained as history. |
| §1.11 targeted edits | Written up below. |
| §1.12 the checks | 72 assertions, 24 controls, all firing. |

### §1.5 rested on a link nothing had ever written

The brief assumed clustering could read the causal chain off `targetCauseIds`. **Measured: that
column was set on zero of eighteen rows.** So the sort assigns it, and the screen labels it as
Lex's judgement rather than as a structural fact. Reported rather than quietly built on.

### §1.8 — the chain-link, in both documents

`chainLinkBlocks()` in `build-proposal.ts` is called by **both** `buildProposalDocument` and
`buildSummaryDocument`. One function, because two copies is how a warning survives in the long
report and quietly stops appearing in the one-pager — and the one-pager is the document more likely
to be the only one anybody reads. It sits **immediately under the policy it qualifies**, as a
`note` plus bold runs, which is the "marked" §1.8 asks for. Superseded parents are filtered out of
the snapshot, so a merged-away policy's warning cannot reach either document.

### §1.11 — is a targeted edit safe here?

**Yes, and for a structural reason rather than a careful one.** §1.11 named the risk correctly:
25-L's, where a second pass not given everything the first was given overwrites good work with a
thinner version, silently. That failure mode needs a **single-value overwrite**, and there is
exactly one on this screen — `setLoopProposal(ideaId, 'policyOptions', …)` writes the whole field
as one string.

The state itself lives in `PolicyOption` **rows**, which are individually addressable: every
operation names the rows it touches by id and cannot reach the others. So the field is **re-derived
from all the rows after every mutation** by `syncPolicyField`, which is its only writer. A model
that returned four policies cannot shrink a list of eighteen, because the model's answer is never
the source of the field — the rows are, and the field is a projection of them.

---

## §2 — `EvidenceItem` had nowhere to put a date

**2a.** `sourceDate` and `sourceDateBasis`, applied to Neon `ep-old-dust-aboxi69a`. Two columns,
not one: a lone nullable date cannot tell "this source carries no date" from "nothing has looked".

**2b.** Populated at write time, at **every one of the twelve** `evidenceItem.create` sites, from
the corpus row and never from the model. A site with no source row records `NO_SOURCE_ROW` — a
reasoning step Lex wrote over the proposal is not an undated document, and lumping the two together
is how a reasoning step ends up counted as an undated source. One retrieval type, `DevolutionResult`,
was dropping the date on the floor; it now carries it.

**2c. The backfill, and what it found.**

```
501 evidence rows, 501 of them with no date.

  dated:   404 of 501
  undated: 97

     368  CORPUS_ROW           Dated from the corpus record for the source itself.
      77  NO_SOURCE_ROW        No retrievable source record, so there is nothing to take a date from.
      36  URL                  Dated from the date in the source URL, recovered after the fact.
      20  CORPUS_ROW_UNDATED   The source is in the corpus and carries no date.

wrote 501 rows.
re-read: 404 of 501 rows now carry a date; 0 still have no basis recorded.
```

**⚠ The finding that matters is not the 404. It is this: 315 of 501 evidence rows are five or more
years old, and until today not one of them said so.** The 2014 Lords claim was not an outlier; it
was the visible member of a majority. Two examples now reading correctly:

- *"From 2015-02-13, 11 years old. Check the figures against current ones before relying on them."*
- *"From 2011-09-22, 14 years old. Check the figures against current ones before relying on them."*

**2d.** Three judgements, computed once in `lib/lex/evidence-date.ts` and read by the panel, the
evidence pack and the checks:

- **Older than five years** → "check the figures against current ones before relying on them". Not
  "wrong" — the threshold is about figures, and it is stated in one place.
- **No figures behind it** → labelled an assertion rather than evidence. The figures test is
  deliberately literal and its limit is stated: it can say "there is nothing quantitative here at
  all", which is safe, and never "this figure is good".
- **A claim that changed Lex's position** → names what it was weighed against, **or says nothing
  was**. The second half is the half that would have been dropped: a rewrite that turned the
  proposal round unopposed is a weaker thing than one that beat three contrary findings, and on the
  page they look identical unless the sentence saying so is printed.

**An undated row is never `CURRENT`.** That substitution is the whole of the original defect in one
line, and there is a control that stays false on it.

---

## §3 — The join-blind check class, enumerated

`npm run audit:join-blind`. **This changed nothing** — §3b asked for the list first.

```
61 check scripts; 32 of them assert in a countable style, with 1,060 assertions between them.

  483 assertions sit in a check that reads no system output at all.
  393 more are source-shaped inside a check that reads some.
  876 of 1,060 (83%) cannot see a lookup that misses.
```

**18 checks read no system output at all** — every assertion in them is about the code, not about
what it produces: `check-corpus-types` (93), `check-sprint3e-ui` (53), `check-text-integrity` (46),
`check-flags` (35), `check-document-render` (31), `check-lex-general` (30), `check-s9-catalogue`
(30), `check-lex-25o` (36), `check-s10-fusion` (20), `check-s14-merge` (20), `check-problem-gate`
(15), `check-dense-degraded` (14), `check-never-claim` (14), `check-panel-claims` (13),
`check-render-decode` (13), `check-s10-stats-licence` (10), `check-llm-guards` (9),
`check-stream-coverage` (1).

**13 read output and also assert on source**, the source-shaped ones being those to look at:
`check-deepening` (100 of 108), `check-lex-25n` (67 of 75), `check-lex-25d` (61 of 77),
`check-20bd` (32 of 47), `check-answer-the-question` (30 of 33), `check-lex-25e` (26 of 28),
`check-legislation-guide` (21 of 37), `check-cost-summary` (10 of 17), `check-export-e2e` (9),
`check-feedback-capture` (9), `check-score-scope` (8), `check-annotation-titles` (4),
`check-lex-25p` (16 of 43).

**⚠ The audit declares its own blind spot.** Nine further checks assert in a style it cannot count
(`check-lex-25m` walks a table of check objects and prints ✓/✗ itself). Reporting those as "0
assertions" would be a measurement of the wrong dimension dressed up as a result — the very shape
§3 is about — so they are listed separately and kept out of every total.

**This is a shape count, not a defect count.** A source assertion whose property genuinely is about
source is correct. What the number says is how much of the suite would stay green through another
§A1.

**§3c: the rule is now CLAUDE.md §25** — *a check must assert the data present in the rendered
output, not that the code which would render it exists* — with the five compliance points and
`check-lex-25p.ts` named as the worked example.

### The class bit twice while this sprint was running

Two assertions in `check-sprint3e-ui` were **red because the code got better**. Both asserted the
literal `deletedAt: null` in a page's source; 25-O §4b replaced those literals with `LIVE_IDEA`, a
shared predicate containing exactly that clause *and* hiding archived ideas. The pages became more
correct and the checks went red. That is the same class from the other side: a source assertion
cannot tell "the filter is gone" from "the filter moved", because it was never reading the filter —
only the characters that used to spell it. Both now assert against the **imported** predicate.

---

## §4 — Two wording defects

**4a.** "You have 4 builds left" was true and still misled: the balance is in one currency and is
spent in two. It now reads:

> You have 12 left. A full build costs 3 and a re-run costs 1 — so that is 4 full builds, or
> 3 full builds and 3 re-runs, or 12 re-runs.

It names the prices as well as the worked split, because a single example cannot let a user work
out any other one. The honest middle state survives: at 2 credits, *"enough for 2 re-runs, but not
for a full build."*

**4b.** "What to do next · 136" was accurate and read as a wall. The header now counts what is
**blocked on the user** — decisions to make plus gaps only they can fill — and the total, with its
breakdown, is one line lower, inside. 135 open challenges are not 135 things to do; they are the
body of work the proposal has to answer over its life, and putting them behind that heading turns a
two-item to-do list into something a user closes.

---

## §5 — The unbilled pass on a resumed historic build

**Recorded, with the reason stated in `passesAddedSince` (build-carry.ts) and announced to the
user on screen.**

A resume is not a purchase: the user paid for the build at its own mode's price and it stopped
without finishing, so `resumeBuild` deliberately charges nothing. What §5 spotted is narrower — a
build that stopped *before* we added a pass gains that pass on resume, and runs work that did not
exist when it was priced. We are not charging for it, because (1) the pass exists because we added
it, not because the user asked for it; (2) the money is already bounded — `MAX_RESUMES` caps
resumes and the per-build spend ceiling counts every pass including the stopped attempt's; and (3)
billing on resume would make a stopped build cost more than a finished one, which would teach
people not to press "carry on".

**What we owe is the sentence, so it is now printed:** *"Since this build ran we added a pass:
Describing the terrain. Carrying on will run it too, at no cost to your allowance — it was our
addition, not your request."*

**And a bug found on the way.** The resume copy read *"the eight passes already done are not
re-run"*. That sentence was written while looking at build v7, which had done eight — so **every
other stopped build in the product was told a number that was not its own.** It counts now.

---

## The checks

```
check:lex-25p    72 passed, 0 failed, 24 controls (0 dead)
```

Every §1.12 assertion performs the operation through the code the route runs — `writeSort`,
`writeMerge`, `applyPolicyOp` — against a scratch idea it creates, marks, and deletes in a
`finally`, then reads back what the screen and the documents would show. **On its first run it
failed 3 of its own assertions with 3 dead controls**, which is the only evidence any of it can
fail: the "before" list was being compared against a projection that had not been written yet, so
three assertions and their controls were reading an empty string, and everything "is not in" a list
that does not exist.

Neighbouring suites re-run clean: `lex-25n` 98/0, `lex-25o` 56/0, `lex-25d` 77/0, `lex-25l` 19/0,
`lex-25m` 12/0, `lex-general` 25/0, plus `documents`, `export`, `orientation`, `answer`,
`text-integrity`, `render-decode`, `cost-summary`, `panel-claims`, `never-claim`, `sprint3e-ui`
(after the §3 fix) and `check:scripts`. `npm run build` is clean.

`check:s7-retrieval` fails on a missing file (`scripts/ingest/search/measure-s7-framing.ts`) — a
pre-existing failure unrelated to this sprint; its typecheck passes.

---

## The one criterion that was half built, and how it was found

§6 asks that where a favoured policy implies an undiagnosed cause, *"accepting adds it **and marks
the causes section changed**"*. Only the first half existed: `acceptCause` created the
`DiagnosisCause` row and stopped.

**The half that was missing is the one that matters.** The `causes` field sits at `ACCEPTED` once
the user has agreed to the diagnosis. A cause added underneath it afterwards leaves the field
claiming agreement to a list that has grown by one — the user approved four causes and is looking
at five, with nothing anywhere saying so. `syncCausesField` now re-derives the whole list from
every row, in the shape the build writes, and puts the field back to `AWAITING_CONFIRMATION`, which
is this product's own vocabulary for "Lex has changed this and nobody has agreed to it yet".

⚠ **And my first assertion of it would have passed without the fix.** It counted `DiagnosisCause`
rows with `source: 'USER'` — and `USER` is that column's **default**, so the fixture's own two
causes were `USER` too and the count would have been satisfied by rows the operation never touched.
It names the cause by its text now. `check:lex-25p` is 72 passed, 0 failed, 24 controls, 0 dead.

Shipped as `753ee13`, after the sprint's five commits.

---

## §7 — What only Charlie's browser can confirm

The render assertions above are exactly that — assertions. These are not confirmed by them:

1. **The guiding-policy screen end to end on a real idea.** Sorting eighteen candidates, reading
   the reclassification reasons, accepting and declining a move, merging two by number and seeing
   the answer, settling, and leaving one unresolved. Nothing here has run a real model call.
2. **"Add to report" on a fresh item since the fix shipped.** The round trip is asserted in code;
   the addendum's defect was found in a browser and its absence should be confirmed in one.
3. **The resumed v7 build and the commentary prose it generates.** Whether the commentary pass says
   anything worth reading is a judgement no check can make — and it will now be preceded by the
   "we added a pass" sentence, which should be checked for tone.
4. **The evidence panel's new standing line at scale.** 315 rows are about to start saying "check
   the figures against current ones". Whether that reads as useful or as noise on a full panel is a
   thing only a person looking at one can say.
5. **The allowance sentence in place.** It is longer than what it replaced; whether it reads as
   clear or as fussy on the actual screen is a browser question.
6. **"What to do next" with the split count.** Whether an actionable count of 2 with "137 in all"
   inside reads as inviting rather than as hiding something.
