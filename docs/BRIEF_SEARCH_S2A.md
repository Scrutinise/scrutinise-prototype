# BRIEF — SEARCH STAGE 2A: MAKE THE ROUTED PATH HONEST

**Owner:** Search thread (CC-Search)
**Written:** 9 August 2026
**Precedes:** Stage 2B (corpus reachability matrix), Stage 2C (vector on remaining streams),
Stage 2D (graphs)
**Status of dependencies:** ingest thread is mid-delta-embed on `corpus_vec`. **§3 of this brief
must not run until ingest confirms the delta embed is complete and stamps a completion marker.**

---

## Why this sprint exists

Three facts recorded on 9 August, in order of severity:

1. **Lex answers from one stream out of five.** `runRoutedSearch` ends `perStream.flat()` — a
   concatenation with no cross-stream sort — and `general-chat.ts` then takes
   `results.slice(0,16)` off it. The slice lands entirely inside the first stream
   (legislation). The other four streams are routed, retrieved, counted and shown in the
   source panel, then dropped before the answer is written. This is the confirmed cause of
   Lex saying *"the sources do not contain information on what select committees have said"*
   while the committees stream had returned hits.
2. **Routing is intermittent, not on.** Current measurement 7/12 on the harder query mix. The
   remaining failure is a **runaway** (the model emits multi-thousand-character per-stream
   queries until it hits the cap), not a ceiling. `maxLength: 200` in the response schema is
   not honoured by Gemini and made it worse (3/12); already reverted after one measured pass.
   When routing fails open the query loses stream scoping **and** dense retrieval.
3. **Every downstream measurement is therefore void.** The PECR-leading ordering regression,
   the reranker decision, and the ordering baseline were all observed on a system that was
   silently averaging routed and unrouted behaviour, and truncating four streams out of the
   answer. Nothing measured on top of that means anything.

**The strategic point:** §1 alone means we are paying to retrieve five streams and answering
from one. That is a pilot-blocker, and it is cheap to fix. It is also the likelier explanation
of the PECR regression than any ranking defect — which is why the reranker is *not* the next
build.

---

## §1 — Interleave streams into the answer context

### The fix

Add a shared `interleaveStreams(perStream: SearchResult[][], budget: number)` helper. It
**round-robins**: rank 1 from each stream, then rank 2 from each, and so on until the budget
is filled or every stream is exhausted. Skip exhausted streams rather than leaving gaps.

Apply a floor: **any stream that returned ≥2 hits gets at least 2 slots** before round-robin
resumes. Rationale — one document from a stream is often not enough for the answer model to
say anything about it, so a single-slot representation reads to the user as the stream having
found nothing, which is the same failure we are fixing.

### Why round-robin and not a global sort by score

A global cross-stream sort looks more principled and is not. Scores are not comparable across
streams: the indexes differ in size (BM25 is length- and corpus-normalised, so a score of 12
means different things in a 250k-instrument index and a 78k-section one), and the legislation
stream carries RRF-fused dense scores while the other four carry raw BM25. Sorting those
together is false precision — it would produce a confident ordering with no meaning behind it.
Round-robin makes the representation policy **explicit and measurable**; once the ordering
baseline exists (§4) and a reranker exists, a real cross-stream ordering can replace it, scored
against a metric rather than assumed.

### Do it at the seam, then audit every caller

This is the same failure class as the `finishReason` audit on 8 August: a guard that belonged
in one shared place had been written per-caller and was missing in seven of them.

- Put `interleaveStreams` in one module. **No caller reimplements slicing over a flat
  concatenation.**
- **Audit every consumer of routed results** for the same "slice off `perStream.flat()`"
  pattern — do not assume `general-chat.ts` is the only one. The 8 August audit found six more
  than expected; expect the same shape here.
- Report what you find *before* changing it, listing each call site, its current budget, and
  whether it consumes routed or tier-scoped results.

### New check script: `check:stream-coverage`

Assert as an invariant, against the real `runSearch`: **for a query routed to N streams, the
context handed to the answer call contains at least one document from every stream that
returned hits.** Prove the check can fail before trusting it to pass — run it once against the
pre-fix code path and confirm it reports the failure.

### One number for Charlie, not a decision you make

The current budget is 16 documents. Across five streams that is ~3 each, which is thin.
**Measure and report** the answer-call input token count and end-to-end latency at budgets of
16, 24 and 32 on three representative queries. Do not change the budget — Charlie decides,
because it is a direct cost-per-query trade.

---

## §2 — Salvage partial routing, and kill the runaway

Three separate changes. Land and measure them **one at a time**, on the same harder 12-query
mix, so each is attributable.

### 2.1 Salvage a partial routing decision (`parseRoute`)

Gemini emits JSON in property order and `legislation` is first, so a truncated payload usually
still contains one or more complete stream objects. Change `parseRoute` to recover every stream
object that closed cleanly and discard the trailing partial, rather than throwing and failing
open.

Why this is worth doing even after 2.2 fixes the runaway: failing open costs stream scoping
**and** dense retrieval for the whole query. Partial routing costs one stream. The salvage is
the cheap floor under every future truncation, not a workaround for this one.

Log the outcome explicitly as `route_outcome = full | partial | failed`.

### 2.2 Constrain query length deterministically, on our side

Do **not** retry the schema route — `maxLength` is not honoured and cost us a measured
regression. Instead:

- Instruct length in the prompt and show it: 2–3 few-shot examples with per-stream queries of
  **6–12 words**, which is the shape that produced the measured gold-set gains.
- **Truncate to a word cap after parsing**, in our code. Deterministic, ours, cannot be
  ignored by the model, and cannot degenerate the generation the way a schema constraint did.
- Keep `maxOutputTokens` where it is. Raising it again buys a longer runaway, not a fix.

### 2.3 Make the failure rate visible

Emit a counter and a log line for every routing call carrying `route_outcome` and the resolved
stream list. Standing rule from the August flag incident: **a flip needs a positive signal that
proves engagement, not an absence of errors.** We currently infer the intermittency rate from a
test script; it should be readable from production logs.

### Exit criterion

`route_outcome` is `full` or `partial` on **≥11 of 12** on the harder mix, **zero** silent
fail-opens (every `failed` produces a log line), and `check:llm-guards`, `check:flags`,
`check:lex-general` still pass.

---

## §3 — Re-establish the benchmark (HOLD until two gates open)

**Gate 1:** §1 and §2 have landed and `check:stream-coverage` passes.
**Gate 2:** the ingest thread confirms the `corpus_vec` delta embed is complete, with a
timestamp or SHA recorded in `handoff_summary.md`.

Gate 2 is not optional and is easy to skip. Our own standing rule is that any baseline
gathered across an index change is void; the delta embed *is* an index change, and the
legislation stream — the one carrying dense retrieval — is exactly where the PECR regression
was observed. Measuring mid-embed would produce a number we would have to throw away, which is
the third time this pattern would have cost us.

Then: re-run the regression query set and state plainly whether the PECR-leading ordering
persists once every stream reaches the answer and routing is reliable. **Predict before you
measure and record the prediction** — my expectation is that the interleaving fix substantially
changes the answer text on multi-stream queries and may dissolve the observed regression
entirely, because the old answer was written from legislation-only context.

---

## §4 — Ordering baseline, then the reranker decision

Unchanged from `docs/ORDERING_METRIC_PROPOSAL.md`, which is approved. The 20 pairs are already
committed. Run `score-ordering.ts` only once §3's gates are open, and correct the proposal's
two known errors as recorded on 9 August:

- "measure before grouping" is wrong for the routed path, because `runRoutedSearch` ends in a
  concatenation with no cross-stream sort. After §1 the correct measurement point is **the
  interleaved list handed to the answer call**, before `groupForPanel`.
- recall@20 stays an invariant guard, not a target.

**The reranker is not authorised by this brief.** It is decided on the baseline number, after
§3 and §4 report.

---

## §5 — NEXT SPRINT, do not start yet: the corpus reachability matrix

Recorded here so it survives a `/clear`. Full brief to follow once §1–§4 report.

The router selects from five streams. The corpus holds ~68 source collections and the strategy
document (§3.1) already names ~15 stream-worthy rows. **Anything not mapped to a stream the
router can select is dark: no query can ever reach it, however good the ranking is.** Known
candidates sitting outside the five today include treaties, members' interests, written
answers, ministerial statements, impact assessments, explanatory notes, NAO and evaluation
reports, consultations, quango rulebooks, statutory codes, sector rulebooks, and the statistics
catalogue.

Deliverable will be one script producing one row per source collection with: sections in Neon;
rows in `corpus_fts`; rows in `corpus_vec`; type/tier tags; the router stream that can select
it, or `NONE`; gold questions referencing it; and which Lex callers can reach it. Output to
`docs/CORPUS_REACHABILITY.md` plus machine-readable JSON.

This is a measurement, not a design. The stream set gets decided **from that table**, not from
intuition about which corners matter.

---

## Working rules that apply to this sprint

- One variable at a time, and reverse the order of any A/B run to catch cache-warming
  artefacts.
- Prove a new check can fail before trusting that it passes.
- Report the audit in §1 **before** changing anything, so the blast radius is agreed.
- No mid-sprint commits. One named commit script at the end.
- Write the numbers, not the impression: every claim in the report is a count, a latency, or a
  ratio.
