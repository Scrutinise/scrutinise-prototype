# BRIEF — GRAPH 5: CASE LAW TO LEGISLATION, THEN HOW COURTS HAVE TREATED IT

**For:** CC-Graph
**Written:** 8 September 2026, by CCh-Search
**Executes:** steps 2 and 3 of the citator path
**Reads first:** `CROSS_REFERENCE_GRAPH.md`, `GRAPH_4A_REPORT.md` (the unresolved-name breakdown),
`ARGUMENT_1A_REPORT.md` (patterns versus similarity)
**Format:** audit-then-build. **§3 is gated on §2's measurement and must not start early.** No git
during the sprint; one **`commit-graph-5.sh`** at the end. Scoped commits by explicit path; additive
migrations only.

---

## §0 — WHAT THIS IS FOR, AND THE LINE IT MUST NOT CROSS

A citator answers two questions: **what refers to this**, and **how has it been treated since**. We
can answer the first for legislation and not at all for case law. This sprint builds the case-law
half.

⚠⚠ **The line, and it is the most important sentence in this brief. We never say a provision or a
case is "no longer good law".** That is a legal conclusion, people act on it, and being wrong about
it could cost somebody badly. **We report the treatment, quote the words, cite the judgment, and let
the reader conclude.** This is the never-claim rule in its most consequential form anywhere on the
platform.

**Prerequisite, and it is now met:** case-law text was stored as its stylesheet until 20 August. That
is fixed — chunk-0 stylesheet content went from 77% to 0% across all 74,894 documents, and titles are
99.98% recovered. **Confirm both against the live tables before starting.** ⚠ Building a citation
extractor over formatting code would produce a large, confident, empty graph.

---

## §1 — THE COVERAGE BOUNDARY, DECLARED BEFORE ANYTHING IS BUILT

**We hold no English judgment before 2003.** Not 2001 — the real cliff was measured at 2003, and
3,703 pre-2001 sections do exist from Northern Ireland (to 1984), Scotland (to 1999) and Strasbourg
(to 1956).

⚠⚠ **A line of authority that starts in the middle is worse than no line at all**, because the reader
assumes they are seeing the whole. Ten pre-2001 authorities run through the real search returned
**10 of 10 absent, and 3 of 10 returned a different case with a similar name** — *Caparo* returning an
employment tribunal case called Caparo Atlas Fastenings. **The absence never presents as an absence.**

▶ **Every case-law edge result carries the boundary in its coverage statement, generated from live
state.** Build that first, before the extraction, so it cannot be forgotten afterwards.

---

## §2 — CASE LAW TO LEGISLATION

### §2.1 Audit before building

1. **How do judgments actually cite legislation?** Print twenty real examples. Expect at least:
   the full form (*"section 3 of the Human Rights Act 1998"*), the short form (*"s.3 HRA"*), the
   back-reference (*"the 1998 Act"*, *"the principal Act"*), and the bare provision once the Act has
   been named earlier.
2. ⚠ **GRAPH 4A measured the equivalent problem on legislation and the answer was counter-intuitive:
   of unresolved names, 59.2% were Acts we do not hold, 31.6% were title mismatches, and only 9.3%
   were short forms.** Measure the same breakdown here before assuming short-form resolution is the
   lever. It was not last time.
3. **Estimate the volume** from a sample: references per judgment × 74,896. Report rows, storage and
   build time at $0.35 per GB-month. ⚠ **Do not re-raise the storage alarm** — it has been retired
   three times; storage is a bill, not a wall.

### §2.2 The distinction that makes this useful rather than noisy

⚠⚠ **A provision the case turned on is a different fact from a provision mentioned in passing.** A
citator that cannot tell them apart returns a hundred references where two matter, and the user
learns to ignore it.

- Report **whether the judgment's structure lets you tell**: a provision cited in the reasoning or
  the disposal versus one in the background, the procedural history, or counsel's submissions.
- ⚠ **If the structure does not support it, say so and store the reference without the distinction**
  rather than guessing at it. **An honest flat list beats a confident wrong ranking** — and this
  project has produced two of the latter.

### §2.3 The rules that carry over

- **Every edge quotes the words that make it**, as the legislation graph requires by schema.
- **The identity resolver is shared, not reimplemented.** ⚠ The regnal-year trap has now appeared in
  four separate code paths, each time because a fix was applied to one of two places that had to
  agree with no check that they agreed.
- **Never merge two identities on similarity.** An unresolved citation is counted, not guessed.

---

## §3 — HOW COURTS HAVE TREATED IT. GATED ON §2.

**This is what makes it a citator rather than an index**, and it is the best candidate on the whole
platform for the technique that has already been measured.

### §3.1 Why patterns, and not similarity

ARGUMENT 1A tested finding a rhetorical move by similarity to hand-picked examples: **0 of 20** on
held-out passages, against **90%** for literal phrase patterns. ⚠ **And the reason applies with extra
force here: judicial treatment turns entirely on polarity, and polarity is what meaning-based
matching is worst at.** *"We decline to follow"* and *"we follow"* sit almost on top of each other in
meaning-space and mean opposite things.

**Judicial treatment language is formulaic — which is exactly the condition patterns need.**
*Followed · applied · distinguished · doubted · not followed · overruled · disapproved · read down ·
per incuriam · considered.*

### §3.2 Build

- Patterns first, per treatment type, with the verbatim sentence stored on every edge.
- ⚠ **Attach the court and the date.** A Supreme Court statement and a first-instance aside are not
  the same fact, and a citator that presents them alike is misleading in the direction that matters.
- ⚠ **Keep treatment-of-a-case and treatment-of-a-provision as separate edge types.** They are
  different questions and flattening them loses the distinction permanently.
- ⚠ **"Considered" and "mentioned" are not treatments.** Resist the pull to classify everything;
  **an unclassified citation is an honest result** and most citations are exactly that.

### §3.3 Measure, on a test set a person validates

- **Draft ~15 rows**: well-known treatments — a case overruled by a named later case, one
  distinguished, one applied — each with the verbatim sentence printed underneath, numbered, one
  verdict line each, in the format Charlie has now completed four times. **Score nothing.**
- Report the two numbers **separately**: **is the treatment right**, and **should this citation have
  been classified at all**. ⚠ The second is where this fails, exactly as the position work did:
  direction was wrong on only 2 of 50 there, but the system claimed a position far too often.

---

## §4 — WHAT IS EXPLICITLY OUT OF SCOPE

- **Case-to-case citation.** A line of authority needs it, and it is a separate sprint.
- **Any judgment before 2003.** The House of Lords archive is approved and unfetched; that is ingest.
- **Any statement about whether something is good law** (§0).
- **A user-facing surface.** `BRIEF_SURFACE_5.md` connects what exists; this adds to it.

---

## §5 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-graph-5.sh`; additive migrations only; nothing owned by
  search, ingest, lex or the argument stream edited — report the change needed instead.
- Numeric predictions in `CHANGE_LOG.md` before each extraction; **every guard states what it
  counted**, never whether something exists.
- Every check watched failing against the real broken state.
- Bytes before hypotheses: read the live schema and real judgments before building on either.
- **Report `docs/GRAPH_5_REPORT.md`:** §2.1's citation-form breakdown first — it decides the whole
  extraction design and the equivalent measurement surprised everyone last time. Then volume against
  prediction. Then §2.2's answer on whether the reasoning can be distinguished from the background.
  Then §3's two accuracy numbers, reported apart. Then what is NOT done, named. Decisions for Charlie
  as numbered questions with a recommendation and the consequence of each option.
- Change-log and handoff entries labelled **GRAPH**.
