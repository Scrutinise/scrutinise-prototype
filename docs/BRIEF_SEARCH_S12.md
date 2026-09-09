# BRIEF — SEARCH S12: A SAFE WAY TO REPLACE EMBEDDINGS, AND A BASELINE THAT SURVIVES

**For:** CC-Search
**Written:** 21 August 2026, by CCh-Search
**Executes:** `SEARCH_S11_REPORT.md` §3 (deferred re-embed) and its baseline-void finding;
`SEARCH_STRATEGY_v5.md` §5.2
**Format:** audit-then-build. No git during the sprint; one **`commit-search-s12.sh`** at the end.
Scoped commits by explicit path. `SEARCH_CONTRACT.md` updated in the same commit as any capability
change.

---

## §0 — WHERE WE ARE

S11 made 48,883 previously unreachable sections reachable, absorbed 118,789 un-indexed rows, and
cut a cold query from 44.3s to 1.6s (warm p50 318ms). It also did two things by *not* acting, and
both set this sprint's agenda:

1. **It refused the $31 case-law re-embed** because `build-vector-index.ts` requires `corpus_chunks`
   to be immutable — replacing one collection's chunks renumbers every boundary after it, which that
   file's own comment calls "a four-figure mistake, not a slow one". There is no REPLACE path. The
   refusal was correct; the gap is now the blocker.
2. **It found that S10's absolute recall numbers are void.** The 20 August case-law re-compile
   rewrote 74,896 bodies, and a delete-and-re-add moves keyword-ranking document frequencies
   **table-wide** — 0 of 5 sampled rankings reproduced twenty hours later. Our playbook already says
   a baseline measured across an index change is void; nobody had applied it to a *repair*. S10's
   internal comparisons stand; its per-collection numbers do not.

So: the meaning-based half of case-law search still matches against stylesheet text (12.7% of
everything embedded for the collection; chunk 0 more than half CSS in 77% of documents), and the
project has no valid absolute quality figure. This sprint fixes both, in that order.

⚠ **Confirm before starting:** GOLD V2 (debates and legislation questions) may have landed and may
have been validated by Charlie. If it has, §2 uses the enlarged set and says so. If it has not,
§2 runs on the existing 51 and the report must say which set produced the number — a baseline whose
question set is not named is the next void baseline.

---

## §1 — A REPLACE PATH FOR ONE COLLECTION'S CHUNKS

**The problem in plain terms.** Chunks are numbered in one continuous sequence across the whole
corpus, and the vector index is built in shards keyed off those numbers. Re-cutting one collection
changes how many chunks it has, which shifts every number after it, which silently invalidates every
shard boundary downstream. Nothing errors. Vectors simply start describing different text than the
one they are attached to — a match on one passage displays another.

**Audit first, report before building:**

1. What exactly does the shard boundary key off — the chunk id, an ordinal, a row offset? Read the
   code and print the relevant lines. The right fix depends entirely on this.
2. How many collections would a naive re-cut disturb, and by how much? Quantify it rather than
   asserting it is bad.
3. What are the candidate designs? At least: stable per-collection chunk identifiers so numbering is
   never global; or a build that recomputes boundaries from the table rather than assuming them; or
   an append-only scheme where replaced chunks are tombstoned rather than renumbered. **Recommend
   one, with the reasoning and the cost of each.**

**Build the chosen path**, then prove it on something small and cheap **before** spending anything on
case law:

- ⚠ **Pick a small collection, re-cut and re-embed it, and prove three things:** the collection's own
  retrieval still works; **a sample of documents from other collections returns identically to
  before** (the whole point — a boundary shift is invisible in the collection you touched and
  visible only in the ones you did not); and the chunk count and index size move as predicted.
- **Watch the check fail first** against a deliberately mis-numbered build. A REPLACE path whose
  guard has never seen a real boundary shift is not a guard.

---

## §2 — THE CASE-LAW RE-EMBED (~$31, APPROVED BY CHARLIE)

Only once §1's path is proven. **Both halves or neither** — re-chunking without re-embedding is
worse than doing nothing.

- Batch API for embeddings; one `vector-index` heavy-job run on the rented large-memory box, **never
  the always-on serving host**.
- Record actual spend against the $31 estimate. Estimates in this project run low (the corpus embed
  was gated at ~$600 and came in at $430–520) and the record is useful.
- **Verify by reading chunk 0 of 30 random documents** and confirming it is judgment text, not CSS.
  A count of chunks written proves nothing about what is in them.
- ⚠ Then **redeploy `vector-serve`** — or confirm it reloads on its own. S11 discovered `fts-serve`
  had restarted itself, which changed a delivery answer from "nothing has reached a user". Do not
  assume the same is true here; establish it and write it down.

---

## §3 — RETAKE THE BASELINE, AND MAKE IT HARDER TO VOID

Run the full validated set through `runSearch()` after §2 lands, not before.

- Report recall@20 and recall@5 per collection with **n stated every time**, and the four-way split
  S10 introduced (hit · diluted · not-retrieved · not-routed) — that split was the most useful thing
  in S10 because a single recall number hid three different failures.
- ⚠ **State explicitly which figures this supersedes.** S10's per-collection absolute numbers are
  void; a corrected number that does not name what it replaces leaves two numbers in circulation.
- **Record the index state alongside the number.** A baseline that does not say which index build it
  was taken against cannot be compared to anything later. Propose the smallest durable way to do
  this — an index build id or content hash stored with the result — and build it if it is cheap.
- **Predict before running.** With case law's text and embeddings both corrected and seven
  collections newly reachable, state what you expect per collection and why.

⚠ **Do not present this as "recall improved from 34%".** The old number is void, not a comparison
point. This is a new baseline. If you want a genuine before/after on any specific change, run both
arms in the same session against the same index.

---

## §4 — THE TREATY COLLECTIONS, AND WHAT THEY REVEAL

`uk-treaties` and `tax-treaties-dta` remain unreachable: they are typed `TREATY`, so a tier entry
cannot fix them. Meanwhile `uk-treaties-fcdo`, **seven times larger, is reachable purely because it
happens to be typed `DEBATE`.**

That second fact is the finding, and it is bigger than the two collections. **Reachability currently
depends on a display type that was chosen for how a document should be rendered, not for how it
should be found.** Two collections of the same material have opposite fates for an unrelated reason.

- **Report** whether any other collection is reachable or unreachable by the same accident. This is
  a sweep, like S11 §1, and it is the second half of the same question.
- **Propose** the fix — whether display type and retrieval routing should be separated — with the
  cost. ⚠ **Do not implement it in this sprint.** It touches how every result is rendered as well as
  how it is found, and it should not ride along behind an embedding change.
- The treaties themselves stay unreachable until there are questions that can measure them, which
  needs GOLD V2. Say so rather than leaving it looking forgotten.

---

## §5 — FINISH THE DRIFT DETECTION

S11 built the general refresh path so a backfill can tell the index which ids changed, and proposed
detection for the case where somebody forgets. **Build the detection if S11 costed it as cheap;
if not, report why and close it.**

The requirement is narrow: something that notices when a field in the database and the same field in
the index have diverged, and says so. It exists because a title recovery reached the database on
19 August, stopped there, and no user saw a single recovered case name until someone happened to
look.

---

## §6 — A STANDING FIX FOR CHECKS THAT CANNOT FAIL

⚠ **Three sprints in a row, in three different directions, have produced a check that could not
fail** — each time because a ranking harness looked only at the top N rows while the counter-examples
sat below the cut. One of those passes was published as a finding.

For every check in this sprint that asserts something about a ranked or limited result set:

- assert over the **whole population**, or state the cut-off in the assertion's own output so a
  reader cannot mistake a truncation for a result;
- and **show the check failing against the real broken state**, not a synthetic one.

Report this as a rule you applied, not as a rule you agree with — the point is that the previous
three sessions also agreed with it.

---

## §7 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-search-s12.sh`; nothing owned by graph, ingest or lex
  edited — report needed changes instead.
- Predictions logged before heavy jobs and before the baseline run.
- Bytes before hypotheses: read chunk 0, read rendered results, probe the built index.
- **Report `docs/SEARCH_S12_REPORT.md`:** §1's design decision first with the alternatives and why
  they lost — that is the durable artefact. Then the re-embed with actual spend. Then the new
  baseline, naming the question set, the index state, and what it supersedes. Then §4's sweep. Then
  what is NOT done, named. Decisions for Charlie as numbered questions with a recommendation and the
  consequence of each option.
- ▶ Name the deploy or reload step Charlie must take, with the observable signal that proves it —
  a counter moving, never an absence of errors.
- Change-log, contract and handoff entries labelled **SEARCH**.
