# BRIEF — SEARCH S16: WHY HALF THE QUESTIONS FIND NOTHING

**For:** CC-Search
**Written:** 27 August 2026, by CCh-Search
**Executes:** `SEARCH_S15_REPORT.md` D-3 (make the next sprint about retrieval) and the unfixed
`fts-serve` item; `SEARCH_STRATEGY_v5.md` §5.2
**Format:** diagnose, then fix. **§2 is an autopsy and produces no code.** No git during the sprint;
one **`commit-search-s16.sh`** at the end. Scoped commits by explicit path.

---

## §0 — WHERE WE ARE, STATED WITHOUT FLATTERY

S15 produced the first trustworthy baseline this project has ever had, on the real production
configuration with dense retrieval genuinely arriving:

| | in-stream@20 | displayed today | displayed with judged merge + reranker |
|---|---:|---:|---:|
| **64 validated questions** | **32** | 19 | **30** |

**And the sentence that matters: 45 of 64 questions return nothing correct today; 34 will still
return nothing with the merge and reranker on. A perfect merge could only ever reach 32, because for
half the set retrieval finds nothing at all.**

Per collection: **debates 0 of 11 on every arm.** Committees 2 of 10. Impact assessments **find 4 of
9 and display 0 of 9** — a routing failure, not a retrieval one.

⚠ **Both earlier baselines are void, and one for an instructive reason:** S14's own artefact records
`streams=NONE … DEGRADED(1)`. Its numbers described a keyword-only system while being read as though
dense retrieval were live. Dense retrieval is worth **thirteen points** — S14 predicted "roughly
twelve", which is the prediction discipline working.

**The merge is no longer the constraint. Retrieval is.** This sprint is about why.

---

## §1 — `fts-serve` HAS EVERY DEFECT WE JUST FIXED, AND RUNS ON EVERY QUERY

⚠ **Do this first. It is the largest unmitigated risk on the platform.**

`fts-serve` still has an unbounded queue, no cancellation of abandoned work, and **the same copied
width of 4** — `VECTOR_MAX_CONCURRENT ?? '4'` was itself copied *from* the FTS service. Unlike the
dense service, it runs on **every** query, not on four streams of some queries.

- Apply S15's §2, §3 and §5 fixes: cancel work whose client has gone; bound the queue at a small
  multiple of width and shed honestly; set width from a measured service time, not by copying a
  constant.
- ⚠ **Check for the same index defect.** S15's real cause was not width at all: **1,478,964 rows —
  6.5% of 22,670,808 — had fallen outside the `sectionId` index and were brute-force scanned on
  every lookup.** An equality lookup on the *indexed* column took **133,401 ms**. Rebuilding took
  45 seconds and €0.008, and cut peak memory under load from 5,586 MB to 1,253 MB.
  **Ask the same question of every index `fts-serve` depends on**, and answer it by counting rows in
  versus out, never by asking whether an index exists.

### ⚠⚠ The standing rule this earns

The rebuild script's own header said the index would need rebuilding after a top-up. Its
`--verify-only` asked *"is there an index on this column?"* — which an index missing 6.5% of the
table answers **yes**. It printed **"Nothing to do."**

**An existence check is not a completeness check.** This is the same family as the ledger denominator
copied from its own numerator, the delete guard that only checked a file existed, and the ranking
harness that could not see past row 400. **Every guard in this sprint must state what it counted, not
whether a thing exists.**

---

## §2 — THE AUTOPSY: CLASSIFY ALL 32 FAILURES INDIVIDUALLY

**No code in this section. A table, one row per failing question, is the deliverable** — and it is the
most valuable artefact of the sprint, because nobody has ever looked at these one at a time.

For each of the 32 questions where the correct document is not found in-stream, establish which of
these it is, by probing rather than by reasoning:

1. **Not in the corpus.** The document is absent, or is a placeholder. ⚠ Verify against
   `corpus_sections`, not by inference. **This is an ingest finding, not a search failure**, and must
   be reported separately so it does not contaminate the search number.
2. **Not routed.** The right stream was never searched. **Impact assessments are 4-of-9-found and
   0-of-9-displayed, so this class is already known to be non-empty.**
3. **Not reachable.** In the corpus, in a collection no stream admits. S11 fixed nine of these; two
   treaty collections remain.
4. **Query failure.** The right stream was searched with a query that could not match — see §4.
5. **Ranking failure.** Retrieved by the stream, but below rank 20 in its own list.
6. **Unit mismatch.** The answer is a paragraph inside a long document that is being scored as a
   whole — **the expected dominant cause for debates**, and the reason the argument work exists.

**Report the counts by class.** ⚠ **The distribution decides the next three sprints, and a guess at
it would misdirect all three.** Do not aggregate; print the table.

---

## §3 — THE CHEAP WINS ALREADY IDENTIFIED

**§3.1 Turn on the router extension.** `LEX_ROUTER_STREAMS_V2` was built in S8 and never enabled;
impact assessments finding 4 and displaying 0 is exactly what it addresses. Re-measure it on the
**validated** set — S8's own measurement was taken before any trustworthy questions existed — and
recommend with numbers.

**§3.2 Re-decide dense retrieval for debates.** Debates has no dense leg because a June measurement
found it 15 points worse. ⚠ **That measurement asked "does this find the right debate?"** — where
keyword matching is nearly unbeatable, because a debate about e-scooters says "e-scooter" constantly.
It has never been asked "does this find the right argument?", which is the question that matters.

Now that capacity is fixed, **measure it again on the current set** and report. ⚠ Do not treat the
result as final either way: the question shape that would settle it is the argument set being drafted
in `BRIEF_ARGUMENT_1A.md`, and this sprint should say so rather than close the question.

**§3.3 Committees at 2 of 10.** It has a dense leg and real questions and still finds almost nothing.
**Probe five of its failures individually** and report which §2 class they fall into. ⚠ This is the
largest evidence collection we hold; a collection this size performing this badly is either a
retrieval defect or a question-set defect, and both are worth knowing.

---

## §4 — IS THE QUERY WE ISSUE ANY GOOD?

The Lex stream reports that a real build issued this, and read 231 sources while citing 0:

```
civil service public failure accountability responsibility cost deliver sector process accountable
those system pr
```

**A truncated term-frequency dump of the user's own prose. It contains "those" and ends mid-word.**

- Establish whether the validated questions travel through the same builder. **Print the actual query
  string issued for ten of the failing questions** — this is the fastest way to find a whole class of
  failure and nobody has looked at it.
- ⚠ **A query is written, not extracted.** Assert in a check that no issued query ends mid-token or is
  a stopword-bearing keyword dump.
- **Report only** on query expansion: is it firing on the validated set, and does it change anything?
  It has been live for months and has never been measured on trustworthy questions.

⚠ **Do not rebuild the query builder in this sprint.** The Lex stream owns the build-side query, and
`BRIEF_25F.md` §4 already covers it. **Report what search sees and tell them.**

---

## §5 — WHAT TO FIX HERE, AND WHAT TO HAND ON

Fix in this sprint only what §2's table shows is search-owned and cheap: routing, reachability, and
any query defect inside the gateway.

**Hand on explicitly, with the counts:**

- **Class 1 (absent from the corpus)** → the ingest stream. ⚠ A search sprint that "fixes" a corpus
  gap by loosening matching has made the platform worse.
- **Class 6 (unit mismatch)** → the argument work.
- **Query construction on the build side** → the Lex stream.

---

## §6 — MEASURE, AND DO NOT REPEAT S14'S MISTAKE

- **Confirm the configuration the measurement ran under, in the artefact itself.** S14's figures were
  taken with dense retrieval degraded and read for a fortnight as though it were live. **Every arm
  file must record the flag string and the degraded state**, and the report must quote it.
- Report per collection with **n stated every time**, and the class distribution from §2.
- **Name what this supersedes.** Two baselines are already void.
- n is **64**.

---

## §7 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-search-s16.sh`; nothing owned by ingest, graph, lex or the
  argument stream edited — report needed changes instead.
- Every check watched failing against the real broken state. ⚠ **And every guard states what it
  counted** (§1), not whether something exists.
- Predictions logged before each measurement; bytes before hypotheses.
- **A redeploy is not a rebuild.** Prove new code is running with a probe false on the old build.
- **Report `docs/SEARCH_S16_REPORT.md`:** §2's per-question table first — that is the sprint. Then
  §1's hardening with before/after. Then the cheap wins with numbers. Then §4's ten real query
  strings. Then what is handed to which stream, with counts. Then decisions for Charlie as numbered
  questions with a recommendation and the consequence of each option.
- ⚠ **Do not write this report as though the platform is fixed.** S15's own closing sentence is the
  standard: *"This is not a report about a fixed platform."*
- Change-log, contract and handoff entries labelled **SEARCH**.
