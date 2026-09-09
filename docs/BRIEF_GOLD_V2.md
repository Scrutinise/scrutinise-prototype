# BRIEF — GOLD SET v2: TEST QUESTIONS FOR DEBATES AND LEGISLATION

**For:** whichever search-side session is free (small, self-contained, runs in parallel with S11)
**Written:** 21 August 2026, by CCh-Search
**Executes:** `SEARCH_S10_REPORT.md` §7 Q5 and gap G1
**Format:** audit-then-build. No git during the sprint; one **`commit-search-goldv2.sh`** at the
end. Scoped commits by explicit path. **This sprint scores nothing.**

---

## §0 — WHY THIS EXISTS, IN ONE PARAGRAPH

The validated gold set has **zero questions** that debates or legislation owns. Those are the two
streams carrying the most traffic. The consequence, from S10: their meaning-based-search settings
are held on *absence of evidence* rather than on evidence; S7's "debates is 15 percentage points
worse" is neither confirmed nor refuted; and the central hypothesis of the fusion-dial work — that
debates wants a small share of meaning-matching rather than none — **cannot be tested at all**. A
built dial that has never been swept on the stream it was built for is not a feature, it is a
liability.

**Deliverable: `docs/GOLD_CANDIDATES_V2.md`, ~20 questions, numbered, one VERDICT line each,
nothing scored.** Charlie validates it in one pass exactly as he did the first 60.

---

## §1 — WHAT A GOOD QUESTION LOOKS LIKE, AND THE TRAPS

Each entry carries: **the question as a real person would type it**; **the answer key** (the
specific document ids a correct top-20 must contain); **one line on why a real user would ask it**;
**the archetype** it covers; and **how it was sourced** (see §2).

Four traps, each of which the first gold set hit:

1. ⚠ **Corpus vocabulary.** "What laws govern e-scooters?" is a question. "Provisions relating to
   personal light electric vehicles" is a search string. If the question uses the words the document
   uses, it tests nothing except whether keyword matching works — which is exactly the thing debates
   is suspected of being *too* good at.
2. ⚠ **Keys asserted from outside knowledge.** Four of the first ten case-law keys were wrong,
   including the same judgment offered as the answer to two unrelated questions. **Every key must be
   verified by reading the document back out of `corpus_sections` and confirming it answers the
   question.** Print the confirming line in the file.
3. ⚠ **Questions with no known answer.** If no document in the corpus answers it, it is not a gold
   question — it is a corpus gap, and belongs in the gap log, not here.
4. ⚠ **Do not let the retrieval system choose the questions.** If you find candidates by searching
   and keeping what comes back, you will build a set the system already passes. See §2.

---

## §2 — SOURCE HALF FROM EACH DIRECTION, AND MARK WHICH

**Document-outward (about half).** Find a notable debate or Act and write the question it answers.
Cheap, keys are certain, and it **inherits the corpus's vocabulary**, which flatters recall.

**Controversy-inward (about half).** Start from real public arguments of the last decade — the
things a campaigner, a journalist or a constituent would actually be asking about — and only then
find the document. Harder, and the only kind that tests whether someone who does not know our
vocabulary can find anything.

**Mark every question with which method produced it.** If the two halves score very differently that
is itself a finding, and it cannot be seen unless the method is recorded.

---

## §3 — WHAT TO COVER

**Debates (~10).** Note the Commons division record starts March 2016, but *debate text* goes back
to the nineteenth century — so the collection is far larger than the voting data and questions
should span that. Archetypes worth one question each:

- what was argued for and against a specific measure
- who made a particular argument
- when Parliament last considered a subject
- a minister's stated position at the despatch box
- a debate on a subject that never became law
- a Lords debate rather than a Commons one
- a devolved legislature debate

⚠ **At least three questions must be ones where the user would not use the debate's own words** —
this is the specific case the debates vector decision turns on, and without it the sweep will run on
questions that only reward keyword matching and will "confirm" the current setting for the wrong
reason.

**Legislation (~10).** This stream carries the strongest prior evidence and has never been tested on
a validated question. Archetypes:

- which Act governs a described situation
- which section of a named Act does a specific thing
- has a named Act been amended, and by what
- what a statutory instrument did
- a devolved equivalent of a UK-wide provision
- an old Act still in force (⚠ our coverage is 99.5% of post-2000 primary Acts but **21.4% of
  pre-2000** — if a pre-2000 question has no answer in the corpus, that is a gap finding, not a
  question)
- a repealed provision, where the correct behaviour includes saying it is repealed

---

## §4 — INCLUDE NEGATIVE CONTROLS, AND LABEL THEM AS SUCH

The first set's five negative controls — questions where the *correct* behaviour is admitting the
platform cannot answer — proved their worth and Charlie accepted all five. Include **two or three**
here, clearly marked, with the required behaviour written out.

⚠ They are scored on behaviour, not recall. A 0% on a negative control is a pass. Say so in the file
so a future scoring session cannot fold them into an average.

---

## §5 — STANDING RULES AND THE REPORT

- **Score nothing.** A number scored against an unvalidated key is the mistake this whole instrument
  exists to prevent.
- Format the file so Charlie can accept, reject or amend each question in one line, in the same
  shape as `GOLD_CANDIDATES_S8.md` — that format worked and he completed the pass.
- Scoped commits by explicit path; `commit-search-goldv2.sh`; touch nothing owned by another thread.
- **Report** (short, at the top of the file rather than a separate document): how many questions per
  stream, the split between the two sourcing methods, how many keys were verified by reading the
  document back, and any archetype you could not find a question for — that last one is a corpus
  gap finding and worth more than the question would have been.
- Change-log and handoff entries labelled **SEARCH**.
