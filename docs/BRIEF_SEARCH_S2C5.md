# BRIEF — SEARCH STAGE 2C-5: TURN THE PROBES UP, FIX THE METRIC, THEN MEASURE

**Owner:** CC-Search
**Written:** 11 August 2026
**Follows:** `BRIEF_SEARCH_S2C4.md` — §1 executed and closed the gate; §2/§3 correctly not run.

**Answering your six open items:** #1 and #2 are §1 and §3 below. #3 is §2 — permission granted, as
its own piece of work, before the baseline. #4 is filed (`POSITION_GRAPH_DESIGN_AMENDMENT_1.md` is
now in `docs/`). #5 is Charlie's to check in a browser. #6 stays with CC-Ingest.

---

## §0 — On §1 of S2C-4, which was the right call

The gate held and you stopped at it. Worth saying plainly what that bought: had §2 run, the ordering
baseline would have been measured on a dense half returning **70.4%** of what the index actually
holds, the number would have looked poor, and the obvious reading would have been "the ranking is
bad, build the reranker". We would have spent a sprint compensating for a query-time parameter.

The distinction you drew is the load-bearing one and it should survive into the change log: **this is
not the KMeans mis-partitioning the ingest thread flagged.** 24 probes of 4,096 is 0.59% against a
1–5% norm. The index is fine; it is being under-asked.

---

## §1 — Raise `VECTOR_NPROBES` to 64, as a measured A/B

**Decision: run it.** The measurement justifies it and the reasoning is not close: +12.7pp of dense
recall for a latency delta inside the noise (675 ms against 736 ms on the box — 64 came out *faster*,
which is the point). 128 is available later; 64 is the rung where the recall gain is large and the
cost is not yet visible, and moving one rung at a time keeps the attribution clean.

**Do not skip to 128 or 256.** The box numbers are sequential single queries with no cache and no
concurrency, and `vector-serve` runs 4-way concurrency behind a query cache with a queue that has
been observed at a high-water mark of 46. Production p95 under load is the number that could bite,
and it is the one the box cannot tell us.

Requirements:

- **Record the pre-change baseline before touching anything** — the restart resets `/stats`. Of
  record: **p50 3,647 ms, p95 4,355 ms, embed p50 241 ms, read 02:31 UTC on 11 Aug**. Re-read it
  immediately before the change as well, since it has served traffic since.
- Change `VECTOR_NPROBES` on `vector-serve` and restart. Query-time variable, no rebuild.
- **Verify engagement positively** — a counter moving or a log line, never merely an absence of
  errors. The standing rule from the August flag incident.
- Re-measure p50 and p95 after a realistic warm period, and report the delta against the baseline.
- Run `check-vector-serving.ts` and the gold harness. **Report the legislation stream's gold numbers
  before and after**, since that is the stream carrying dense retrieval.

**Revert criterion, set before the change rather than after:** if production p95 rises by more than
50% against the recorded baseline, revert to 24 and report. Recall we can improve later; a slow
product in front of pilot users is a worse trade.

---

## §2 — Fix the ordering metric first, as its own piece of work

**Permission granted, and your reasoning for asking is right**: changing how the pair set is scored
inside the sprint that decides the reranker mixes a metric change into a measurement, and we would
not be able to tell which had moved the number.

The defect, restated so it survives: round-robin interleaving is stream-balanced **by construction**,
so a cross-stream preference pair measures the `STREAMS` declaration order rather than any ranking
judgement. Three of the twenty pairs are affected.

- Annotate each pair with its **scoring surface** — within-stream pairs scored on the stream's own
  ranking, cross-stream pairs scored where a cross-stream ordering actually exists.
- If a pair cannot be scored on any surface that reflects a ranking decision, **say so and exclude
  it**, with the count stated. A metric that silently scores a construction artefact is worse than a
  smaller metric.
- Land this **before** §3 and report the pair count that survives. No baseline number in this step.

---

## §3 — Then the ordering baseline and the reranker decision

On the improved substrate, after §1 and §2 land. Carrying every correction the earlier sprints
established:

- Excludes 4 questions (D2, D3, D4, D5). State the excluded count.
- **Recall lost to scoping reported separately from ordering changed** — 10 questions, not 12.
- Measured on the product path: the interleaved list handed to the answer call, before
  `groupForPanel`.
- **State which path every number came from.** The EN2 finding showed the untiered harness and the
  routed product disagreeing, both correctly; a reader must be able to tell which measurement they
  are looking at.
- `caselaw` 36/36 → 22/36 is answered by this gold run.

**Prediction, recorded before measuring:** the PECR-leading regression does not reproduce. It was
observed on a system where the answer saw only legislation, the panel sorted legislation last,
routing was intermittent, and the dense half was serving a stale index — now at 85% recall rather
than 70%. If it survives all of that, it is real and the reranker case is strong.

**The reranker is authorised by that number or not at all.**

---

## §4 — The legacy DROP unblock

`BRIEF_CC_SEARCH_legacy-drop-unblock.md` (CCh-Ingest, 9 Aug) is the source; run it after §3. Two
updates to it:

- **Its decision 3 is confirmed: MOVE the type/year/actId filters onto `corpus_acts`, do not retire
  the UI.** `corpus_acts` has far wider coverage, so moving widens the feature rather than preserving
  it, and filtering legislation by type and year is a real research move.
- **Two items it lists as open search-thread work are closed**: the `callGeminiJson` truncation-guard
  class landed in S2A, and the cross-stream scoring work landed in S2B. Do not re-do them.

Everything else in that brief stands: fail honestly on gateway failure, migrate the one
`IdeaLegislation` row, prove zero runtime readers remain, then send ingest the repoint-confirm.

⚠ **The DROP is a storage fix and nothing more.** Do not fold the routed-gateway migration into it —
that is scoped separately below.

---

## §5 — NOT this sprint: the routed-gateway migration

Recorded here so it survives a `/clear`, and so nobody starts it early.

Three surfaces — the Lex chat route, `/api/search`, and the legislation-search panel — pass an
explicit tier, take the tier-scoped branch, and reach `runFtsSearch` directly. **They get neither
routing nor dense retrieval.** Everything measured and fixed over the past week reaches the untiered
callers only.

That was a deliberate first blast radius and it was right at the time. It is not a good state to
enter a pilot in: the Lex chat route is where pilot users will spend their time, and it is running
the weaker half of the stack.

**It gets its own brief, immediately after the reranker decision** — because it changes what users
see and therefore needs measuring, and it should be done once, on a settled substrate, not twice.

---

## §6 — Thread labelling, from now on

Three threads share this tree. Every `CHANGE_LOG.md` and `handoff_summary.md` entry must carry its
originating stream in the heading — **SEARCH**, **INGEST**, **LEX**, **CENTRAL**, or **GRAPH**. If a
brief does not make the stream obvious, ask rather than guess.

Commits stay scoped to explicit paths, as now. `git add -A` remains forbidden.

---

## Working rules

Unchanged, and this week added two worth keeping: **a marker that carries no provenance is not
evidence**, and **a page size that is not the page size you asked for is a failure wearing the face
of a clean run** — both from the same family as the truncated-LLM-response rule.
