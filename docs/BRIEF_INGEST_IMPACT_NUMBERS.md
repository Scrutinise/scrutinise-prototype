# BRIEF — INGEST: TURN IMPACT ASSESSMENTS INTO NUMBERS

**For:** CC-Ingest
**Written:** 7 September 2026, by CCh-Search
**Executes:** Charlie's decision of 7 September — a costing and benefits capability that can answer
*"what will this cost against its likely benefits"* and *"what has this cost to date"*
**Pairs with:** `BRIEF_SEARCH_S18_COSTING.md`, which consumes what this produces
**Format:** audit-then-build. **§1 reports before any extraction is built.** No git during the
sprint; one **`commit-ingest-impact-numbers.sh`** at the end. Scoped commits by explicit path.

---

## §0 — THE PROBLEM, IN ONE PARAGRAPH

We hold roughly **18,700 impact assessments** and about **1,000 post-implementation review sections**
inside them. Every one carries the figures a costing analysis needs — and **we hold them as prose
inside a document.** Nobody has ever pulled them into columns. So they cannot be compared, sorted,
ranked, or set against what actually happened.

⚠ **This is the same lesson the statistics catalogue already taught and we did not apply here:
numbers are called, not searched.** A search over prose can find you an assessment. It cannot tell
you that this measure was predicted to cost business £42m a year, that the prediction was never
checked, and that three comparable measures were predicted at a tenth of that.

**What Charlie needs to be able to answer:**

1. *"What is this proposed legislation going to cost against its likely benefits?"* — forward-looking.
2. *"What has been the cost of the Public Sector Equality Duty to date?"* — backward-looking.

⚠⚠ **The second is much harder than the first, and the honest answer to it will usually be
"nobody has ever measured it".** That is not a failure of this sprint; **it is the most valuable
sentence the platform can produce**, and §4 exists to make sure it can be said with evidence rather
than by silence.

---

## §1 — AUDIT FIRST. TWO QUESTIONS, BOTH BLOCKING.

### §1.1 Did the annexes survive ingest?

⚠⚠ **Ask this before anything else, because it can change the whole shape of the sprint.** The
numbers in an impact assessment usually live in the **annexes and tables**, not the summary.
GRAPH 4B measured **41.3% schedule retention on legislation** — 118 of 201 instruments arrived
without their schedules — and the schedules sweep has not been run.

- Take 50 impact assessments. **For each, compare what the source publishes against what we hold**,
  part by part: summary sheets, evidence base, annexes, tables.
- Report retention **as a percentage of assessments that have that part at source**, with counts.
- ⚠ **If retention is poor, stop and report.** Extracting fields from documents that are missing
  their numbers would produce a confident, empty table — worse than no table.

### §1.2 What is actually on the page?

Print **three real assessments end to end** — a large one, a small one, and a de minimis one — and
report the shape. Establish, from the documents rather than from the template:

- Where the headline figures sit, and whether the layout is stable across years and departments.
- How many are the standardised summary-sheet format versus free prose.
- Whether the Regulatory Policy Committee opinion is in the document or published separately.

▶ **Report §1 before building §2.** If the layout is not stable, extraction is a different and larger
job than this brief assumes, and that is worth knowing on day one.

---

## §2 — THE FIELDS TO EXTRACT

One row per assessment, per option where options are costed separately.

| field | why it matters |
|---|---|
| **EANDCB** — equivalent annual net direct cost to business | the single headline figure, and the one comparison everybody wants |
| **price base year** | ⚠⚠ **without it the figures are not comparable**; a 2011 £ and a 2024 £ are different units |
| **net present value** | the whole-life figure |
| **transition cost** | one-off versus ongoing is the distinction users care about |
| **business population affected** | turns a total into a per-firm figure |
| **monetised benefits** | ⚠ the benefits half is the one that gets dropped; do not build a cost-only table |
| **non-monetised benefits** | ⚠ **held as text and never as zero.** "Not monetised" is not "no benefit", and treating it as zero would systematically make every measure look worse than it is |
| **RPC opinion and date** | fit for purpose / not fit for purpose — an independent check on the number |
| **de minimis flag** | these carry no EANDCB; an absent figure here is correct, not missing |
| **review or sunset clause, and the date the review is due** | ⚠ **this is the review-calendar product, free** — every measure Parliament promised to look at again, with its date |
| **the option chosen versus options considered** | what was rejected is evidence about what was thought |

⚠⚠ **Three traps, each of which would invert an answer:**

1. **The sign convention.** A **negative EANDCB is a net benefit to business.** Get this wrong and
   every deregulatory measure reads as a cost. **Assert the convention in a check with a known
   worked example in both directions.**
2. **Units and scale.** £m and £bn appear in the same corpus. **Normalise, record the original text
   beside the parsed value, and count what failed to parse.**
3. **An unparsed field is unparsed, never zero.** A missing number and a zero are different facts and
   the difference is the whole answer to *"has this been costed?"*

**Provenance on every row:** the assessment id, the page or section the figure came from, and the
verbatim text it was parsed from. ⚠ **A figure with no quotable source is a claim, not a fact** — the
same rule the citation graph enforces by schema.

---

## §3 — POST-IMPLEMENTATION REVIEWS: THE OUTTURN SIDE

Roughly 1,000 review sections sit **inside** the impact assessment collection, distinguished by
section title — there is no separate collection, and looking for one is how this gets written up as
impossible.

- Link each review to the measure it reviews, and extract what it found: was the prediction borne
  out, was the measure kept, changed or withdrawn.
- ⚠⚠ **A missing review is never filled from the impact assessment.** That substitution converts
  *"nobody has checked whether this worked"* into *"here is what it achieved"*, and it is the single
  most damaging error available in this whole area. The precedent block already enforces this and
  defaults to **predicted** when the leg is missing, because mislabelling a prediction as an outcome
  is the damaging direction.
- **Report the coverage: how many measures have a review, and how many are overdue one.**
  ⚠ **That second number is itself a finding** and is the backbone of Charlie's second question.

---

## §4 — WHAT MAKES "COST TO DATE" ANSWERABLE

Charlie's Public Sector Equality Duty example is the test case, and the honest answer is a chain of
four states rather than a number:

| state | source |
|---|---|
| **predicted** | the impact assessment |
| **reviewed** | a post-implementation review, an independent review, an NAO or PAC report |
| **measured** | an official statistics series that bears on it |
| **not measured** | ⚠ **the explicit statement that nobody has established the outturn** |

▶ **Deliver the linkage that lets a caller assemble that chain**: assessment → review → any NAO,
Public Accounts Committee or independent review naming the same measure. **Report what you can link
and what you cannot.**

⚠ **Do not attempt to compute an outturn cost.** No such figure is published for most measures, and
inventing one from partial data is exactly the class of error this project has spent a month
eliminating.

---

## §5 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-ingest-impact-numbers.sh`; nothing owned by search, graph
  or lex edited — report the change needed instead.
- **Every guard states what it counted**, never whether something exists. An existence check is not a
  completeness check, and that distinction has cost this project four separate incidents.
- Predictions in `CHANGE_LOG.md` before each sweep; bytes before hypotheses — read documents back.
- ⚠ **Any rewrite of stored bodies voids search baselines.** Tell CC-Search before, not after.
- ⚠ **A number in the database has not reached a user.** If any extracted field is to be searchable,
  it must reach the index — use the general refresh path S11 built.
- **Report `docs/INGEST_IMPACT_NUMBERS_REPORT.md`:** §1's retention finding first, since it can change
  the sprint. Then extraction rates per field, **as a percentage of assessments that have that field
  at source**, with what failed to parse. Then §3's review coverage and the overdue count. Then what
  is NOT done, named. Decisions for Charlie as numbered questions with a recommendation and the
  consequence of each option.
- Change-log and handoff entries labelled **INGEST**.
