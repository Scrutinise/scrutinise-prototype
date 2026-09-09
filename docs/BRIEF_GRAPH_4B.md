# BRIEF — GRAPH 4B: THE IDENTITY BRIDGE, AND THE INSTRUMENTS LAYER

**For:** CC-Graph
**Written:** 27 August 2026, by CCh-Search
**Executes:** `GRAPH_4A_REPORT.md` Q3 (identity bridge — **approved**) and §4's Layer 2 sizing;
`HANDOVER_search_graph_citation.md` §6 Layer 2; `OPEN_ITEMS.md` OI-19
**Format:** audit-then-build. No git during the sprint; one **`commit-graph-4b.sh`** at the end.
Scoped commits by explicit path; additive migrations only.

---

## §0 — WHY THIS IS THE NEXT SPRINT, AND WHY IT DID NOT HAPPEN SOONER

Charlie asked why statutory instruments have not been indexed yet. **The honest answer: 4A's brief
told CC to scope Layer 2 and not build it**, because nobody knew its size and the sizing was worth
having before committing. That was the right call once. It is now spent — 4A sized it, and this
sprint builds it.

**Why it matters more than Layer 1 did.** Most references to any Act sit in the instruments made
under it. Until this layer exists, **every consequence list is systematically incomplete in a way the
user cannot see** — the same silent-incompleteness failure as legislation.gov.uk's own markup being
2% complete, one level up.

**And one thing must be built first**, because it currently breaks joins silently: the two graph
tables **disagree on what a pre-1963 Act is called**, so a join on the identifier drops every one of
them and reports nothing wrong (OI-19).

---

## §1 — THE IDENTITY BRIDGE (Q3, APPROVED). BUILD THIS FIRST.

**What a user would see if this stayed broken:** a consequence list for an older Act that quietly
omits whole classes of reference, with no error and no gap flag.

**The cause, in one line:** UK Acts were cited by regnal year — *"1 & 2 Eliz. 2"* — until the Acts of
Parliament Numbering and Citation Act 1962 moved them to calendar years from 1963. The two tables
record those Acts under different identifier forms.

⚠ **This is the fourth appearance of the regnal-year trap in this project**, in four separate code
paths: the URI parser, the extractor's file filter, the legislation title resolver, and now a join.
**Every previous fix was applied to one of two places that had to agree, with no check that they
agreed.** Build the bridge as **one shared resolver both tables call**, not as a translation applied
at each join site — and assert in a check that no join site does its own translation.

**Build:**

- A canonical identity for every Act, and a resolver mapping every observed identifier form onto it.
- ⚠ **Never merge two identities on similarity** (standing rule). A form that cannot be resolved stays
  unresolved and is **counted**, not guessed at.
- **The check that proves it:** join the two tables on a set of known pre-1963 Acts and require a
  non-zero, correct result — watched failing against today's implementation first, where it returns
  zero and looks like an honest absence.

**Then re-answer 4A's §6 question with the bridge in place.** 4A found `citation_edge` supersedes the
`cites` rows (98.1% of pairs plus 226,516 more) while `legislation_edges` still solely holds 2.23M
rows of five other edge types. ⚠ **Retire nothing in this sprint.** Report what the bridge changes
about that overlap and what retiring the superseded rows would take.

---

## §2 — LAYER 2: INSTRUMENTS REFERRING TO LEGISLATION

**Size it against 4A's estimate before building, and report the comparison.** 4A measured 0 of 85,971
instruments touched by the old extractor defect, so this layer starts clean.

### §2.1 The enabling relationship is a different and stronger fact

⚠ *"This instrument was made under section 15 of that Act"* is **not** *"this instrument mentions
that Act"*. Capture the enabling power as **its own edge type**, distinct from textual reference.

**Why it is load-bearing:** an instrument whose enabling power is repealed may fall with it. Repeal
analysis — the reason this graph exists — is unanswerable without that separation, and flattening the
two would produce confident, wrong consequence lists.

### §2.2 Schedules

⚠ **Confirm statutory instrument schedules are ingested before building.** Extractors commonly drop
them, and §3 depends entirely on them. If they are absent, **stop and report** — that is an ingest
sprint, not something to work around here.

### §2.3 Volume and honesty

- Report rows, storage and build time, priced at $0.35 per GB-month — the real figure, not a
  threshold. ⚠ **Do not re-raise the storage alarm**; it has been retired three times. Storage is a
  bill, not a wall.
- Report the same quality measures 4A used: hand-check 20 against legislation.gov.uk, and a scale
  control where a narrow recent instrument must not outrank a broad old one.

---

## §3 — WHAT LAYER 2 UNLOCKS FOR TAX AND TREATIES

4A confirmed the mechanism Charlie asked about and found a gap in it: **we hold the scheduled
agreement for only 39 of 288 double taxation Orders.** The other 249 carry three operative articles
with the treaty itself absent — and ⚠ **it presents as a short document, not as an error.**

In this sprint, **report only** (the fetch is an ingest job):

1. Whether Layer 2 with schedules recovers any of the 249, and how many.
2. ⚠ **Whether the graph is queryable in the reverse direction.** TIOPA 2010 s.6 gives these
   agreements effect *despite anything in any enactment*, so the useful question for a tax proposal
   is not only *"what does my change break"* but **"does a treaty already prevent this"**. Report
   whether that query is answerable today.
3. Whether we hold OECD Multilateral Instrument positions. ⚠ The MLI modifies many agreements at once
   **without amending each Order**, so an agreement read off legislation.gov.uk can be out of date
   without saying so. Where a modification exists and is not held, **the coverage block must say so.**

---

## §4 — THE COVERAGE BLOCK EXTENDS TO THE NEW LAYER

4A built `inbound()` returning `{ rows, coverage }`, generated from live state and never hardcoded —
and its own check caught a real defect on first run, reporting an unbuilt layer as searched.

**Extend it, do not bypass it.** Every result must now also say: whether Layer 2 was searched, the
identity-bridge residual from §1, and the schedule coverage from §2.2.

⚠ **Charlie's own example of why this wording matters:** a count of 1,868 inbound references is
*"1,868 that we found in the layers we have searched"* — and that sentence must come from what the
graph reports about itself. **A hardcoded caveat goes stale silently.** This project has already had
one figure survive being retired twice by living in a comment.

---

## §5 — A MESSAGE ACCEPTED FROM THE LEX STREAM

CC-Lex reports that the cross-reference graph should be **its own listed graph in the search
infrastructure taxonomy**, not folded into the citation/amendment row. **Accepted.** CCh-Search will
reflect it in the strategy document. Nothing for this sprint beyond making sure the graph's own
documentation names it as a distinct capability with its own coverage statement.

---

## §6 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-graph-4b.sh`; additive migrations only; nothing owned by
  search, ingest or lex edited — report needed changes instead.
- Numeric predictions in `CHANGE_LOG.md` before the extraction runs.
- Every check watched failing against the real broken state — for §1 that means the join returning
  zero today.
- Bytes before hypotheses: read the live schema before building on it.
- **Report `docs/GRAPH_4B_REPORT.md`:** the identity bridge first, with the count of previously
  dropped joins now resolved. Then Layer 2's volume against 4A's estimate, with the enabling
  relationship reported separately from textual reference. Then §3's three answers. Then what is NOT
  done, named. Decisions for Charlie as numbered questions with a recommendation and the consequence
  of each option.
- Change-log and handoff entries labelled **GRAPH**.
