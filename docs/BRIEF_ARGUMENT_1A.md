# BRIEF — ARGUMENT 1A: SEEDS, PROPAGATION, AND TEN QUESTIONS FOR CHARLIE

**For:** any free session (self-contained; does not depend on the search capacity work)
**Written:** 27 August 2026, by CCh-Search
**Executes:** `MECHANISM_AND_ARGUMENT_GRAPH_DESIGN.md` §3 and §5 stages 3–4
**Format:** audit-then-build. **§3 produces a file for Charlie and scores nothing.** No git during
the sprint; one **`commit-argument-1a.sh`** at the end. Scoped commits by explicit path.

---

## §0 — WHAT THIS IS FOR, AND WHY IT CAN START NOW

**What a user should eventually get.** They describe an idea. The platform shows them the four
strongest objections anybody has ever made to that kind of measure — the cost objection, the
"nobody will enforce it" objection, the "this belongs in guidance not statute" objection — each in
the speaker's own words, with a name and a date, drawn from a debate that may have been about
something else entirely.

**Why now.** This depends on none of the open work. The vectors already exist (22.7 million
paragraphs). The retrieval fixes in flight change how results are ranked and displayed, not what is
stored. **Nothing here is blocked.**

⚠ **The single reframing this design rests on: an argument tag is a retrieval filter, not a published
claim.** It is never shown to a user as a fact. Its only job is to narrow 15 million paragraphs to a
few dozen worth reading, after which the model writing the answer reads the actual words. **So the
tag needs high recall and may have poor precision.** Over-inclusion costs a little compute;
under-inclusion loses the argument entirely.

⚠ That risk profile is deliberately different from the position graph's, and the difference must be
preserved in everything built here. A wrong *position* was displayed to a user as a claim about a
person, and that is why it failed. A wrong *tag* is invisible. **Over-eagerness was fatal there and is
acceptable here.** Do not import the position graph's caution into this design and cripple recall
with it.

---

## §1 — THE SEED SAMPLE

**The taxonomy** (design §3.2), ten tags: `COST` · `ENFORCEMENT` · `UNINTENDED` · `EVIDENCE_GAP` ·
`WRONG_VEHICLE` · `RIGHTS` · `PRECEDENT` · `SCOPE` · `IMPLEMENTATION` · `SUPPORT_EVIDENCE`.
Charlie has approved these as a starting set.

**Draw ~50 hand-verified example paragraphs per tag.** Every seed carries the verbatim paragraph,
speaker, date and section id, so a person can check it.

⚠ **Stratify the sample deliberately; do not draw at random.** A random sample of 15 million
parliamentary paragraphs is overwhelmingly recent and overwhelmingly Commons, because that is where
the volume is. Spread across: decades · Commons and Lords · government and opposition benches · bill
debates and general debates · chamber speech and committee evidence. **Report the strata and the
counts.**

⚠ **"This paragraph makes no argument" must be an easy, unpunished answer**, and a large share of any
honest sample will be exactly that. Assert it: if fewer than a third of a random control sample come
back untagged, the labelling is over-eager and must be re-run.

### §1.1 Charlie's peroration hypothesis — test it, do not assume it

The proposal: the substantive point usually lands in a speech's closing paragraphs, the rest being
throat-clearing.

**Predict first, then measure.** Sample paragraphs stratified by position within the speech —
opening fifth, middle, closing fifth — and report tag density in each.
⚠ **Counter-hypotheses worth naming so the result is informative either way:** interventions and
short questions are dense and have no peroration at all; set-piece opening speeches often front-load
the argument. **The answer may differ by speech type, which is more useful than a single rule.**

⚠ **A prior baked into sampling silently shapes everything built on top of it.** If the hypothesis
holds, weight the seeds and *record why*; if it does not, say so and sample evenly.

---

## §2 — PROPAGATION: THE CHEAP HALF

**Score every paragraph in the parliamentary collections by similarity to each tag's seed set, using
the vectors we already hold.** No new embedding job. No model call per paragraph. This is arithmetic
over an index that exists.

- Report, per tag: how many paragraphs clear each of several thresholds, and the shape of the score
  distribution. ⚠ **A tag whose distribution has no shoulder is a tag with no signal** — report that
  rather than picking a cut-off to make it look real.
- **Add deterministic phrase patterns** as a union with the similarity results: *"who is going to
  enforce"*, *"the impact assessment assumes"*, *"a cliff edge"*, *"this belongs in guidance"*.
  Zero cost, and they catch things similarity misses.
- ⚠⚠ **Expect polarity failures and do not try to fix them here.** *"Nobody will enforce this"* and
  *"the enforcement regime is working well"* sit close together in meaning-space — same subject, same
  vocabulary, opposite claim. Similarity **will** return both. That is expected and acceptable
  because the tag is a filter; the answer-writing model resolves it downstream by reading the words.
  **Tuning the embedding to fix polarity is a known-hard problem and the wrong place to spend effort.
  Report the rate; do not chase it.**

**Store every tag with provenance:** the paragraph id, the method and version (`prototype:v1`,
`pattern:v1`), and the score. **Never a bare label.**

---

## §3 — TEN QUESTIONS FOR CHARLIE. DRAFT THEM; SCORE NOTHING.

The existing test questions ask *"find the debate about X"*. **This is a different question shape:
*"find me the argument that X"*** — and it is the only shape that can settle whether meaning-based
search helps debates, which has been an open question since S7.

**Deliver `docs/ARGUMENT_QUESTIONS_V1.md`: ten questions, numbered, one VERDICT line each.**

Each entry carries:

- **The question as a real user would put it** — *"what's the strongest argument that a licensing
  scheme like this won't be enforced?"*, not corpus vocabulary.
- **The answer key: the specific paragraph(s)** that make that argument. ⚠ **Not the speech, not the
  debate.** The unit is the paragraph, because that is the unit the platform now displays.
- **The verbatim text of each keyed paragraph, printed in the file**, so Charlie can confirm it makes
  the argument without leaving the document.
- **Which tag it exercises**, so coverage across the taxonomy is visible rather than accidental.
- ⚠ **At least three questions where the answer sits in a debate about a different subject.** That is
  the whole point of the argument graph and the case that no other system can serve. Without these
  the set tests nothing new.

⚠ **Verify every key by reading the paragraph back out of the stored body.** Four wrong keys in the
first gold set and 138 unsound rows in the position validation set both came from claims asserted
without reading the source. **Print the confirming sentence.**

⚠ **Score nothing against these.** A number scored against an unvalidated key is the mistake this
whole instrument exists to prevent.

---

## §4 — MEASURE THE TAGGING, HONESTLY

Hand-read **50 tagged paragraphs** drawn across tags and report **two numbers separately**:

1. **Is the tag right** — does the paragraph make the move the tag names?
2. **Should this paragraph have been tagged at all** — or does it make no argument?

⚠ **The second is where models and prototypes fail, not the first.** The position work established
exactly this: direction was wrong on only 2 of 50, but the system claimed a position far too often.
**Report them apart. An average of the two hides the failure mode.**

Also report **recall**, which matters more here than precision: of the seeds' own tag, how many
comparable paragraphs did propagation find? ⚠ A tag that fires rarely and correctly is **worse** than
one that fires often and roughly, because the filter is what protects the answer-writing model from
having to read 15 million paragraphs.

---

## §5 — WHAT IS EXPLICITLY NOT IN THIS SPRINT

- **No model adjudication pass** (design §3.3 stage 4). It is authorised only once §4 shows what
  survives propagation and what it would cost.
- **No bulk pre-computation beyond the parliamentary collections.**
- **No user-facing surface.** Everything here lives behind an admin view or in the database, exactly
  as the position graph did until validated.
- **No mechanism tagging.** That is the other taxonomy and a separate piece of work.

---

## §6 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-argument-1a.sh`; nothing owned by search, graph, ingest or
  lex edited — report needed changes instead.
- Every check watched failing against the real broken state. Any check asserting over a ranked or
  limited set must assert over the whole population or print its own cut-off.
- Predictions recorded before §1.1's experiment and before propagation runs.
- **Report `docs/ARGUMENT_1A_REPORT.md`:** §1.1's peroration result first with its prediction beside
  it. Then propagation, per tag, with what each figure is a proportion of. Then §4's two accuracy
  numbers, reported apart. Then what is NOT done, named. Decisions for Charlie as numbered questions
  with a recommendation and the consequence of each option.
- ⚠ **Cost:** this sprint should cost close to nothing — the vectors exist and no per-paragraph model
  call is authorised. **Report actual spend against that expectation**; if it is not near zero,
  something is being done that this brief did not ask for.
- Change-log and handoff entries labelled **ARGUMENT**.
