# SEARCH STAGE 2C-4 — THE GATE WAS OPEN, AND §1 CLOSED A DIFFERENT ONE

**Executes:** `docs/BRIEF_SEARCH_S2C4.md`
**Written:** 11 August 2026
**Verdict in one line:** §1 measured production dense recall at **70.4% of what the same index
returns when fully probed**, which is below the brief's 0.9 gate, so **§2's ordering baseline was
not run and no reranker number is published** — exactly the outcome §1 exists to produce.

---

## §0 — What was verified before anything was measured

Three facts, each read rather than inferred, because §2's number would have inherited any error in
them.

| fact | how it was established | value |
|---|---|---|
| `corpus_vec` rows | `countRows()` on the live table, from the box | **22,518,608** |
| ANN index coverage | `indexStats` on `vector_idx` (IVF_PQ) | **indexed 22,518,608, unindexed 0** |
| production probe count | Railway GraphQL `variables` query on service `ae95be0a…`, 11 Aug 02:40 UTC | **no `VECTOR_NPROBES` set → code default 24** |

The third one matters most and is the one that could not have been guessed. `vector-serve` carries
17 variables and **none of `VECTOR_NPROBES`, `VECTOR_CHUNK_OVERSCAN` or `VECTOR_REFINE_FACTOR` is
among them**, so production runs `vector-core.ts`'s defaults: **nprobes 24, overscan ×5, refine ×2,
cosine**. Provenance: read from the Railway API by CC-Search on 11 Aug 2026 at 02:40 UTC with the
project token. This is the §19 discipline applied — Railway config *is* readable from here, unlike
Vercel's, so it was read.

**And the row count reconciles exactly**, which is worth stating because it makes 22,518,608 a fact
rather than a figure:

```
21,846,364  July full build
  + 768,085  V33 catch-up embed
   − 89,377  orphan-chunk hygiene, 11 Aug
    − 6,464  earlier hygiene, 6 Aug
= 22,518,608  ✓ the table's own COUNT
```

⚠ **One thing that can no longer be verified, and it is a loss.** The brief's §4 asks that the
embed's finish time be corrected from "16:33 UTC" to 15:33 UTC where it appears. It **has** been
corrected — `CHANGE_LOG.md` (2026-08-11 01:02 UTC) and `handoff_summary.md` line 9 both carry the
correction, and the two remaining "16:33" copies sit *below* explicit superseded markers in blocks
both files deliberately keep unedited as an audit trail. But the evidence for 15:33 is gone: the
checkpoint at `_search/corpus_vec.checkpoint.json` now reads `updatedAt 2026-08-11T00:42:54.825Z`,
because the ANN rebuild overwrote it. So **15:33 UTC is the ingest thread's reading of a file that
has since been rewritten, and I could not independently confirm it.** The correction is almost
certainly right — 16:33 BST is 15:33 UTC and the arithmetic is the whole point — but it is now a
report, not a re-checkable measurement.

⚠ **Also found in that checkpoint, and handed to the ingest thread rather than acted on:** it still
records `vectors: 21,846,364`, the July figure. The catch-up embed added 768,085 vectors without
updating the counter, so the checkpoint **under-reports the table by 672,244**. Nothing reads it for
correctness today, and the ANN build's own shard assertions use `shardSize`, not `vectors` — but a
counter that disagrees with the table by two-thirds of a million is the kind of thing that later gets
quoted.

---

## §1 — The ANN retrieves about two-thirds of what it holds. This is the sprint's finding.

### What was measured, and why this shape

The brief offered two routes and this took the second: **compare production's 24-probe result with an
exhaustive 4,096-probe result on the same index.** Probing all 4,096 partitions is exhaustive by
construction — every vector lives in exactly one partition, so nprobes=4096 cannot miss a candidate
the index holds. Every other knob is held identical across rungs (cosine, refine ×2, the ×5 chunk
overscan), so **one variable moves**.

`scripts/ingest/ann-recall-check.ts`, run through the heavy-job runner on a cpx42 in nbg1.
**58 distinct queries** — the whole gold set plus the ordering-preference queries, deduplicated,
which is every real query this project has written down.

### The ladder

Full result at `r2://_ops/ann-recall/result-2026-08-11T04-05-54-730Z.json`.

| probes of 4,096 | chunk top-20 overlap | section top-20 overlap | mean ms (box) | p95 ms (box) |
|---:|---:|---:|---:|---:|
| 1 | 20.6% | 20.9% | 497 | 1,234 |
| **24 — production** | **70.4%** | **70.6%** | **638** | **921** |
| 256 | **96.3%** | 96.3% | 2,366 | 3,289 |
| 4,096 — exhaustive | 100% by construction | 100% | 28,592 | 32,762 |

**The curve is steep exactly where production sits and flat above it.** Going from 24 to 256 probes
buys **+25.9pp of dense recall** for about +1.7s per query *on this box*; going from 256 to exhaustive
buys the last 3.7pp for a further 26 seconds, which is not a trade anyone would make.

⚠ **Those milliseconds are this box against R2 — no query cache, no concurrency, a different network
path from `vector-serve`.** Read them as the *shape* of the trade-off, not as a production latency.
The production number of record remains `vector-serve`'s own `/stats` (p50 3,647 ms, embed p50
241 ms, read 11 Aug 02:31 UTC). ⚠ **And 64 and 128 probes were not measured** — the sweet spot is
very likely between 24 and 256, so the next step is to measure those two rungs, not to adopt 256.

### The controls, because a check that cannot fail is not a check

| control | result | what it rules out |
|---|---|---|
| sensitivity — rung 1 vs rung 24 | **20.6% vs 70.4% ✓** | that the comparison is blind to probe count |
| shuffle — query *i*'s hits vs query *j*'s exhaustive hits | **0.0% ✓** | that the overlap metric is not discriminating |
| live service — 6 queries re-asked at `vector-serve` | **100.0% agreement ✓** | that the box and production are different measurements |
| exact scan — `bypassVectorIndex()` true KNN, n=2 | **production 77.5%, all-partitions 97.5% of the true top-20** | that PQ quantisation, not probing, is the loss |
| mirror guard — 5 planted defects in `vector-core.ts` | **5/5 caught** | that the probe imitates retrieval nobody serves |

Two of those deserve reading rather than skipping.

**The live-service control is the one that makes the rest usable.** Six queries re-asked at the
production endpoint returned **exactly** the sections this box computed at 24 probes — 100% overlap.
So this is not "a rented box measured something"; it is a measurement of what `vector-serve` is
serving right now.

**The exact scan separates the two losses.** A true exhaustive KNN over all 22.5M vectors (73s and
122s per query, hence n=2) says that probing every partition recovers **97.5%** of the true top-20 —
so **PQ quantisation costs about 2.5pp and no probe count can recover it** — while production at 24
probes reached 77.5% of the true top-20 on the same two queries. The loss this sprint found is
overwhelmingly the probe count, not the codebook.

The mirror guard earned its place twice. It is what asserts this probe still describes production's
query rather than a copy that has drifted, and **its first version reported 4/5 because one mutation
regex used `\n` against a CRLF tree and never applied** — a planted defect that was never planted
reads exactly like a guard with a hole in it. Fixed, then watched passing 5/5.

### The verdict

**Mean chunk-level overlap at production settings: 70.4% over 58 queries (section-level 70.6%). The
gate is 0.9. §2 does not run.** The brief's instruction is followed to the letter: *"Overlap < 0.9 → stop and report.
Retuning partitions is a separate decision with a cost, and it belongs to Charlie and the ingest
thread, not to this sprint."*

The weakest queries are worth reading, because they are not random:

| overlap | id | query |
|---:|---|---|
| 5% | F3 | I want a law making landlords accept tenants with pets. Has this been tried? |
| 15% | P11 | section 172 Companies Act 2006 |
| 25% | G3 | How is a 'fit and proper person' test typically operated by regulators in practice? |
| 30% | H3 | Where inquiries have examined regulatory capture, what mechanisms recur? |
| 40% | B5 | What are the rules about how much noise my neighbours can make at night? |
| 40% | D4 | Has the Dangerous Dogs Act 1991 been changed since it was passed? |

⚠ **The obvious reading of that table is wrong and I nearly wrote it.** "Broad thematic questions
lose most" fits F3, G3 and H3 — and then `section 172 Companies Act 2006` sits at **15%**, which is
about as precise as a query gets. So the loss is **not** explained by query breadth. What the low
scorers share is more likely that their best chunks are thinly spread across many partitions, which a
0.59% probe cannot reach whether the query is diffuse or exact. That is a hypothesis, not a finding:
distinguishing it would need per-query partition statistics, which this sprint did not gather.

### ⚠ The reading Charlie needs, stated carefully

**This is not evidence that the index is mis-partitioned, and it must not be reported as such.**
The KMeans warnings the ingest thread flagged (`1529 < 4096`) remain unexplained, but the ladder
does not implicate them. What it shows is simpler and cheaper: **24 probes out of 4,096 is 0.59% of
the index, and standard IVF practice is 1–5%.** The system is *under-probed*, and at 0.59% a recall
of about two-thirds is close to what the parameter predicts.

That distinction is the difference between two very different pieces of work:

- **`VECTOR_NPROBES` is a query-time environment variable.** Raising it needs **no rebuild, no heavy
  job, no re-embed** — one Railway variable and a restart. The cost is latency, and the ladder above
  is the price list.
- **Re-tuning `numPartitions` is a full ANN rebuild** — 29.5 min, €0.145, and a fresh index to
  validate.

The first is a minutes-long experiment; the second is a sprint. **The ladder says try the first
before considering the second**, and I have deliberately not done either: *"Do not retune anything
under this brief. Measure and report."*

**The concrete next step, costed.** Measure 64 and 128 probes on the same 58 queries — a second
`ann-recall-check` run with `--ladder 24,64,128,256`, about 10 minutes and €0.03, because those rungs
are far cheaper than the 4,096 one that dominated this run. That produces the recall/latency curve
where the decision actually lives. Then, *if* Charlie wants it, `VECTOR_NPROBES` on `vector-serve` is
one variable and one restart, and `check-vector-serving.ts` plus the gold harness measure the effect
on the product. ⚠ **The restart resets `/stats`**, so the pre-change baseline (p50 3,647 ms, p95
4,355 ms, 13 served, read 02:31 UTC) is recorded here to be compared like-for-like afterwards —
docs/CLAUDE.md §17's standing rule.

---

## §2 — The ordering baseline was NOT run, and that is the instruction, not a shortfall

§1's gate closed, so no benchmark and no preference accuracy is published. Publishing one now would
be the fourth time this project measured on a substrate it already knew to be degraded, and the
number would be quoted long after the caveat was forgotten.

**What was done instead is the preparation that makes §2 a single command when Charlie decides.**

### The measurement point is now correct — verified by reading, not assumed

The 9 August attempt recorded a real defect: `score-ordering.ts` measured `runSearch().results`,
which at the time was `perStream.flat()` — a plain concatenation in `STREAMS` order, with no
cross-stream ranking to measure at all. **That is now fixed upstream.** `query-router.ts` returns
`interleaveStreams(perStream, …)` and its own comment marks the old behaviour as the bug;
`search-gateway.ts` returns that as `results` and `groupForPanel(results)` as `grouped`.

So the brief's requirement — *"the interleaved list handed to the answer call, before
`groupForPanel`"* — is exactly what the existing harness already reads. **No change needed.**

### ⚠ But the interleave fix creates a second problem for the metric, and it is not fixed

Round-robin interleaving is **stream-balanced by construction**. A cross-stream preference pair
(a committee report vs a statute; Hansard vs an Act; ICO guidance vs an SI) measured on that list is
therefore measuring **the `STREAMS` order and the round-robin**, not a ranking judgement. Three of
the twenty pairs are deliberately inverted cross-stream pairs — they exist precisely so the set
cannot be satisfied by "always prefer legislation" — and on the interleaved list they would be
scored against a surface that has no opinion about them.

The proposal already anticipated this (*"the metric needs to specify a surface per pair"*) and it is
still open. The fix is small and mechanical: annotate each pair as within-stream or cross-stream,
score within-stream pairs on `results` and cross-stream pairs on `grouped`, and report the two
populations separately. **Not done here** — it changes how the pair set is scored, and doing it in
the same sprint that decides the reranker would mix a metric change into a measurement.

### The two figures the brief asked to be carried, unchanged and ready

- **The ordering baseline excludes 4 questions** — D2, D3, D4, D5, the archetype-D set declaring a
  citation-graph stream the router does not have.
- **Recall lost to scoping is 10 questions, not 12** (CM2 and CM3 became routable when Scottish
  material joined the debates stream), and it is reported **separately from ordering changed**.
- Both figures must be labelled with the path they came from. The harness measures the **product
  path** (routing, per-stream fusion, the tuned weight); `gold-queries.ts` measures the **serve
  services directly, untiered**. The EN2 finding showed those two disagreeing while both were
  correct. A future reader comparing a §2 number with a gold-report number must be able to tell
  which is which, so every number in the eventual §2 report needs that label attached at birth.

---

## §3 — The reranker decision

**Not authorised, and it cannot be authorised from this sprint's evidence**, because the brief ties
it to the §2 number and §2 did not run.

What §1 changes about the decision is worth saying plainly, as a reading rather than a
recommendation:

> A reranker reorders the candidates it is given. If dense retrieval is handing it about two-thirds
> of the candidates an exhaustive probe would surface, then some of what looks like an ordering
> problem is a **candidate-set** problem, and no reranker can fix a document that never arrives.
> The cheap experiment — raise `VECTOR_NPROBES`, re-measure the ladder, then run §2 — costs a Railway
> variable and one restart. The expensive one is a sprint. The order seems clear.

Charlie decides. This sprint's contribution is that the decision is now being taken with the
candidate-set question answered rather than folded invisibly into the ordering number.

---

## §4 — Carried, with their status

| item | status |
|---|---|
| `caselaw` selection 36/36 → 22/36 after the few-shot examples | **still open.** The brief puts the answer in §2's gold run, which did not happen. Not reverted on suspicion. |
| All `--pre-fix` modes stay in the tree | **unchanged.** Nothing removed. |
| The "16:33 UTC" → 15:33 UTC correction | **already applied** by the ingest thread; the two surviving copies are inside deliberately-unedited superseded blocks. ⚠ The checkpoint that evidenced it has since been overwritten — see §0. |

---

## Infrastructure defects found and fixed on the way

Both were found because a measurement went missing, and both are the same family: **a failure that
looks like a success.**

1. **The heavy-job runner's log follow silently stopped once a job's stdout passed 96 KB.**
   `hetzner-logtail.ts` uploads a *sliding* 96 KB tail; `run.ts` followed it by **line index**. Once
   Lance's deprecation warnings pushed the log past the window, the object's first line stopped being
   the log's first line and `lines.slice(seen)` went empty. The first ann-recall run therefore
   **succeeded, computed every number, and displayed none of them** — €0.099 and 37.6 minutes for a
   verdict line and nothing behind it. `run.ts` now follows by content and *announces* a window it has
   lost rather than skipping it.
2. **A measurement that lives only in a log tail can be lost**, so `ann-recall-check.ts` now writes
   its whole result — ladder, per-query overlaps, controls, latency — to
   `_ops/ann-recall/result-<stamp>.json` **before** printing the verdict.

Also corrected: the runner's `list()` printed every job's size as the `ccx43` fallback because it
read a `serverType` field that no longer exists; and **the CPX server line has been renumbered** —
`cpx41`/`cpx51`/`cpx31` no longer exist in fsn1/nbg1/hel1, so the job's size list is now
`cpx42`/`cpx52`/`cpx32`. The runner's availability read caught that before creating anything, which
turned a stale constant into a ten-second correction instead of a failed run.

**Cost of this sprint:** two heavy-job runs at €0.099 and €0.097 (36.9 min, peak RSS 7.6 GB), plus 58 × 2 query embeddings
(fractions of a cent). No production configuration was changed.

---

## Working rules, as applied

- **Repeats are not optional on anything intermittent** — the ANN measurement was run twice, the
  second time because the first run's numbers were lost in transit rather than because they were
  doubted.
- **Prove a check can fail before trusting it passes** — the mirror guard was watched failing on five
  planted defects, and its own first version's silent non-application is recorded above.
- **An inference must not travel as a measurement** — the production probe count was *read* from
  Railway; the 15:33 UTC correction is labelled as a reading of a file that no longer says it; and
  the KMeans warnings are explicitly *not* claimed as the cause of the recall gap.
- **A marker that carries no provenance is not evidence** — which is why the result artefact now
  carries the table name, row count, every parameter and the timestamp alongside the numbers.
