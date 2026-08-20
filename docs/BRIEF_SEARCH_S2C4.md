# BRIEF — SEARCH STAGE 2C-4: THE GATE IS OPEN. MEASURE.

**Owner:** Search thread (CC-Search)
**Written:** 11 August 2026
**Follows:** `BRIEF_SEARCH_S2C3.md` (landed, `6f43b04`). This brief supersedes nothing — it opens
the gate that S2A §3/§4 and S2C2 §4 have been waiting behind since 9 August.

---

## §0 — Gate 2 is OPEN, with evidence

The ingest thread completed the whole finishing sequence overnight. Facts, all measured:

- **Embed complete**: 129/129 shards, 768,085 vectors, 0 misses, $36.51. `corpus_vec` and
  `corpus_chunks` both at 22,607,985 — exact parity.
- **89,377 orphan chunks deleted**, safety-exported to R2 first and verified three ways. Both
  tables reconcile at 22,518,608.
- **ANN index rebuilt**: 29.5 min on a cpx62, €0.145, peak RSS 5.6 GB. `verify-vector-index.ts`
  reports **indexed 22,518,608, unindexed 0** — against 768,085 unindexed (3.41% brute-forced per
  query) before.
- **`vector-serve` restarted and proven.** It had been pinned to a 7 August snapshot for 3.4 days,
  containing none of the new vectors. Latency on 11 sequential synthetic queries afterwards: p50
  3,529 ms, p95 3,750 ms, against a production baseline of p50 5,936 / p95 21,383. ⚠ Not
  like-for-like — the baseline includes real concurrency — but the unindexed-0 figure is clean.
- **Acceptance**: 18,166,684 of 18,166,911 sections have a vector; all 227 without one have
  `wordCount = 0`.

**So the vector index changed materially, again.** Every measurement taken before 11 August against
the dense path is void. That is not a reason to delay — it is the reason this sprint exists.

---

## §1 — Check the ANN actually retrieves well, BEFORE trusting any ordering number

The ingest thread handed over one lead rather than acting on it, and it should be settled first:

> The ANN build logged repeated `KMeans: clusters are empty / too small (1529 < 4096)` warnings.
> The 4,096-partition setting has never been re-tuned against a corpus that has since grown, and
> July's unexplained recall regression may or may not be related.

**Why this comes first.** The whole point of §2 below is to decide whether to build a reranker. If
the ANN index is mis-partitioned, dense recall is degraded, the ordering baseline will look poor,
and we could spend a sprint building a reranker to compensate for a clustering parameter. This
project has measured on a broken substrate three times now; do not make it four.

**The measurement, and keep it cheap.** Sample around 50 real queries. For each, take the ANN
top-20 from the live index and compare it against an exact top-20 — either a brute-force scan on a
bounded subset, or the same query with `nprobes` raised far enough that the result is effectively
exhaustive. Report the mean overlap.

- **Overlap ≥ 0.9** → the index is fine. Say so and go straight to §2.
- **Overlap < 0.9** → stop and report. Retuning partitions is a separate decision with a cost, and
  it belongs to Charlie and the ingest thread, not to this sprint.

Do not retune anything under this brief. Measure and report.

---

## §2 — The benchmark and the ordering baseline (S2A §3, §4)

Unchanged in substance, and carrying every correction the last three sprints established:

- **The ordering baseline excludes 4 questions** — D2, D3, D4, D5, the archetype-D set declaring a
  "citation graph" stream the router does not have. State the excluded count in the report.
- **Report recall lost to scoping separately from ordering changed.** That figure is now **10**
  questions, not 12 (CM2 and CM3 became routable when Scottish material joined the debates stream).
  A single routed-versus-unrouted delta would blame the router for a coverage loss; only the
  ordering half bears on the reranker.
- **Measure on the product path** — the interleaved list handed to the answer call, before
  `groupForPanel`.

⚠ **One caveat to write into the report rather than discover later.** The EN2 finding showed the
matrix's gold pass and the product path disagreeing, both correctly, because the harness searches
the whole corpus untiered while the product searches routed streams. So state plainly which path
each number came from. A future reader comparing a §2 number with a gold report number must be able
to tell whether they are the same measurement.

**Record a prediction before measuring, as before.** Mine: the PECR-leading ordering regression does
not reproduce. It was observed on a system where the answer saw only legislation, the panel sorted
legislation last, routing was intermittent, and the dense half was serving a stale index missing
768,085 vectors. Every one of those is now fixed. If the regression survives all four fixes, it is
real and the reranker case is strong.

---

## §3 — The reranker decision

**Authorised by the §2 number or not at all.** Report the pairwise-preference accuracy and the
recall@20 invariant, and state your reading. Charlie decides.

This is the last item before the first-pass retrieval stack is closed.

---

## §4 — Carried

- `caselaw` selection 36/36 → 22/36 after the few-shot examples. §2's gold run is where that gets
  answered. Not reverted on suspicion.
- All `--pre-fix` modes stay in the tree.
- **Reported by ingest, for the record**: the S2C3 entry logged the embed finishing at "16:33 UTC";
  the checkpoint says 15:33:23Z. BST labelled UTC. Correct it where it appears.

---

## Working rules

Unchanged. The three that keep paying: **repeats are not optional** on anything intermittent;
**prove a check can fail before trusting it passes**; **an inference must not travel as a
measurement**. Overnight added a fourth worth keeping — *a marker that carries no provenance is not
evidence*, which nearly authorised deleting 89,377 rows against a backup of 6,464 unrelated ones.
