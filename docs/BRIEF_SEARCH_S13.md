# BRIEF — SEARCH S13: RETURN THE PARAGRAPH THAT ANSWERS THE QUESTION

**For:** CC-Search
**Written:** 24 August 2026, by CCh-Search
**Executes:** `MECHANISM_AND_ARGUMENT_GRAPH_DESIGN.md` §2.1–§2.3 and stages 0–2 of §5;
`SEARCH_S12_REPORT.md` findings on dilution and debates
**Format:** audit-then-build. **§1 reports before it changes anything.** No git during the sprint;
one **`commit-search-s13.sh`** at the end. Scoped commits by explicit path. `SEARCH_CONTRACT.md`
updated in the same commit as any capability change.

---

## §0 — THE POINT OF THIS SPRINT, IN ONE PARAGRAPH

A user asks what has been argued about their idea. Somewhere in Hansard, somebody made exactly that
argument — possibly in a debate about something else entirely. **Three separate things stop that
paragraph reaching them**, and none of them is a ranking problem:

1. **We find the right paragraph and display a different one.** The meaning-based index matches at
   chunk level — roughly a paragraph — but what gets shown is **the head of the document**. For a
   4,000-word speech that is the opening courtesies. (This is also why the case-law stylesheet
   defect stayed invisible: the stylesheet sat at the top of the body, and the top of the body is
   what gets served.)
2. **The merge discards what the search found.** On guidance, **6 of 10 questions found the right
   document inside its own stream's list and lost it when the five lists were merged.** In-stream
   recall is 48%; merged, 34%.
3. **The debates answer key is written in the wrong unit**, so no debates number currently means
   anything — including the 0 of 11.

⚠ **Charlie has explicitly reversed an earlier instruction here.** An earlier plan proposed widening
the debates key to accept any speech in the same debate. **Do not do that.** We do not want to return
a whole debate or even a whole speech. We want the paragraph that makes the point; if the user wants
the rest of the speech, it is one click away. The key gets **tighter and more precise**, not looser.

**Coordination:** CC-Ingest holds a Senedd backlog re-parse that renumbers identifiers — confirm with
Charlie whether it has run before you re-key anything, and say in the report which order happened.

---

## §1 — AUDIT THE MERGE. REPORT BEFORE CHANGING IT.

**This is the highest-value unknown in the platform and it must not be fixed by guesswork.**

Establish, with numbers read off the running system:

1. **What exactly does the merge do?** `interleaveStreams` round-robins; the fusion inside a stream
   is weighted RRF. Print the actual ordering logic. State whether a cross-stream comparison ever
   compares raw scores that were computed on different scales — that has bitten this project before
   (two components producing scores three orders of magnitude apart, sorted together).
2. **Where does each lost answer die?** For every one of the 65 validated questions, record: the
   rank the correct document held **inside its own stream's list**, and its rank **after the merge**.
   ⚠ **That table is the deliverable of this section** — it turns "the merge loses things" into
   "the merge loses things *here*, for *this* reason".
3. **Is length the mechanism?** A 4,000-word speech and a 200-word regulation are being ranked
   against each other. Report the length distribution of surviving versus discarded correct answers.
   ⚠ If long documents systematically win or lose, that is a normalisation defect and it is a
   different fix from a round-robin defect. **Name which one you found; do not fix both blind.**
4. **What is the round-robin actually costing?** Round-robin guarantees each stream a slot regardless
   of whether it has anything worth showing. Quantify: how often does a stream's low-value result
   displace another stream's high-value one?

▶ **Report §1 before building §2.** If the audit contradicts this brief, the brief changes on the
record.

---

## §2 — FIX THE MERGE

Build the fix the audit points at, not the one this brief guesses at. Whatever the design:

- **Flag-gated, default OFF**, read through `flagEnabled()` — never a bare `=== 'true'`; a
  capitalised `TRUE` in Vercel silently disabled the router once for an unknown period.
- **Both arms runnable in the same session** against the same index, so the before/after is a
  measurement rather than a comparison against a figure taken at another time. ⚠ The 20 August
  case-law repair voided a whole baseline twenty hours after it was taken; do not create a second
  orphaned number.
- **Report the change per stream**, not as a single headline. A merge fix that helps guidance and
  hurts legislation is a trade Charlie decides, not one you resolve.
- ⚠ **Do not tune to the 65 questions.** With n this small the best-scoring configuration is not
  automatically the best configuration. Report the *shape* — a flat curve means the parameter does
  not matter; a single spike is more likely noise than discovery. Say explicitly where you decline
  to change anything.

---

## §3 — SHOW THE PARAGRAPH THAT MATCHED

**The largest single win available for debates, committee evidence and inquiry evidence at once**,
because all three are the same shape: the useful thing is a passage buried in a long document about
something adjacent.

**Audit first:**

1. Does the retrieval path already know which chunk matched — is the chunk id or offset available at
   the point the result is assembled, or discarded on the way? Print where it is lost, if it is.
2. What produces the snippet today? S12 found a shared row budget defect (`limit=10` gives 5 of 10
   results no snippet at all) — **confirm whether that fix has actually deployed**, since it was
   committed, pushed and then found undeployed because `vector-serve` was pinned to a 12 August
   commit. **Read it off the running service, not off the repository.**

**Build:**

- Carry the matched chunk's identity through to the result, and render **that text** as the snippet,
  with enough surrounding context to be readable.
- ⚠ **The keyword leg and the meaning leg must agree on what they display.** If one shows the matched
  paragraph and the other the head of the document, the same document appears twice in different
  clothes — the exact defect S11 fixed for case-law titles.
- Show where in the document the passage sits (speaker, date, and which debate or report), because a
  paragraph without its speaker is worth much less than one with. Attribution already exists for
  debates.
- ⚠ Keep the whole document one click away. **We are changing what is shown first, not what is
  available.**

**Verify through the platform, not the database:** for ten debates questions, what proportion of
displayed results contain the words that caused the result to be retrieved? Today that is close to
zero by design. Report it as a percentage with the count stated.

---

## §4 — RE-KEY DEBATES TO PARAGRAPHS

⚠ **Tighter, not looser.** Re-key each debates question to **the specific paragraph** that makes the
argument, not the speech and not the debate.

- **Interim scoring rule until §3 ships:** a hit is scored when the returned speech **contains** the
  keyed paragraph. That is fair to retrieval without crediting a different speech that merely sits in
  the same debate.
- Verify every re-keyed paragraph by reading it back out of the stored body and confirming it makes
  the argument the question asks for. **Print the confirming sentence in the file.** Four wrong keys
  in the first gold set and 138 unsound rows in the position validation set both came from claims
  asserted without reading the source.
- ⚠ **Re-keyed rows go back to Charlie for validation.** He validated the originals; a changed key is
  a changed question. Deliver in the same numbered one-verdict-per-row format that he has now
  completed twice.
- **Score nothing against the new keys in this sprint.**

---

## §5 — RE-MEASURE, AND SAY WHAT IT SUPERSEDES

After §2, §3 and §4 land and Charlie has validated the re-keyed rows:

- Re-run the baseline. Report per collection with **n stated every time**, and the four-way split
  from S10 (hit · diluted · not-retrieved · not-routed) — a single recall number hid three different
  failures and that split is the most useful thing S10 produced.
- **Stamp the index version either side of the run.** If the two stamps differ, the corpus moved
  mid-run and the figures describe neither state.
- **Name explicitly which earlier figures this supersedes.** A corrected number that does not say
  what it replaces leaves two numbers in circulation, and this project now has two voided baselines
  in its history.
- ⚠ **Only after this** is the debates meaning-based-search decision worth re-taking — and it should
  be re-taken on questions of the form *"find me the argument that X"*, not *"find the debate about
  X"*. Those questions are the next sprint's work; name the dependency, do not pre-empt it.

---

## §6 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-search-s13.sh`; nothing owned by ingest, graph or lex
  edited — report needed changes instead.
- Every check watched failing against the **real** broken state. Every check asserting over a ranked
  or limited set must assert over the whole population or print its own cut-off — three sprints in a
  row produced a check that could not fail because of exactly this.
- Predictions logged before runs; bytes before hypotheses; read rendered results off the running
  service, never the repository.
- ⚠ **A redeploy is not a rebuild.** S12 shipped data but not code because restarting re-runs the
  existing artefact, and `vector-serve` was pinned to a 12 August commit. If this sprint's changes
  need to reach a service, **prove which code arrived with a probe that is false on the old build** —
  a process coming back proves nothing about what it came back into.
- **Report `docs/SEARCH_S13_REPORT.md`:** §1's per-question in-stream-versus-merged table first — it
  is the sprint's most valuable artefact. Then the fix and its per-stream effect. Then §3 with the
  proportion of displayed results that contain the matched text. Then what is NOT done, named.
  Decisions for Charlie as numbered questions with a recommendation and the consequence of each.
- ▶ Name what Charlie must do, with the signal that proves it — a counter moving, never an absence
  of errors.
- Change-log, contract and handoff entries labelled **SEARCH**.
