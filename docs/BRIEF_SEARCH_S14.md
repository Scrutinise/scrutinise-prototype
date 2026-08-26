# BRIEF — SEARCH S14: STOP RATIONING SLOTS, START JUDGING RESULTS

**For:** CC-Search
**Written:** 26 August 2026, by CCh-Search
**Executes:** `SEARCH_S13_REPORT.md` §1.3 and D-5; `SEARCH_STRATEGY_v5.md` §5.1 (which this brief
formally overturns)
**Format:** audit-then-build. No git during the sprint; one **`commit-search-s14.sh`** at the end.
Scoped commits by explicit path. `SEARCH_CONTRACT.md` updated in the same commit as any capability
change.

---

## §0 — THE DECISION THIS SPRINT EXISTS TO ACT ON

S13 established the constraint exactly: **`merged rank ≈ in-stream rank × streams routed`**, holding
for 29 of 34 keys. With five sources and a twenty-slot window, each source gets four slots. An answer
at in-stream rank five cannot be displayed whatever its score.

The consequences, measured:

| | |
|---|---|
| answers found **in-stream** | 28 of 65 (43%) |
| answers **displayed** after the merge | 15 of 65 (23%) |
| answers the window could arithmetically show, that it did show | **15 of 16** |
| recoverable by changing the merge | **12 of 65** — 23% → a ceiling of 42% |

⚠ **The merge is not making bad trades.** Across all 65 questions there is one case where a weaker
result displaced a stronger one, and it is misattributed. **The round-robin is fair and the window is
too small.** Rationing is the defect, not judgement.

**Charlie's instruction, and it is the design principle for this sprint:**

> *"We need at least 20 from each source — it might be that one source has all the top 20. We should
> never cut back the visibility when we add sources. Then something should be running a value
> judgement on all of them to get a merged top 20."*

That is correct and it is what this sprint builds.

### ⚠⚠ §5.1 of the strategy is hereby overturned, and the reason matters

The reranker — a model that reads candidates and orders them — was declined in June because **the
binding constraint was recall, not ordering**: 11 of 15 scored pairs turned on whether the document
was retrieved at all.

**S13 has reversed that finding.** 28 of 65 answers are now *found* and only 15 *displayed*. The
system is retrieving correctly and then failing to order across sources. **Ordering is now the
binding constraint, and the reason for declining a reranker no longer holds.** This brief authorises
one, bounded and measured, as §3.

---

## §1 — AUDIT: WHY ROUND-ROBIN WAS CHOSEN, AND WHAT WOULD REPLACE IT

**Report before building.** The audit exists because the obvious replacement does not work, and a
sprint that discovers that halfway through will ship the wrong thing.

1. **Establish what each stream's scores actually are.** Print the score distribution per stream on
   the same query. State plainly whether two streams' scores are on comparable scales. ⚠ This project
   has already shipped one defect where two components produced scores three orders of magnitude
   apart and something sorted them together.
2. ⚠⚠ **State, in the report, why plain rank fusion across streams cannot fix this.** Each stream
   returns a *disjoint* set of documents, so a rank-based fusion across streams reduces to: take
   every stream's rank 1, then every stream's rank 2, and so on — **which is round-robin.** Rank
   fusion carries no information about whose rank 1 is better. Anyone reaching for RRF here will
   rebuild the current behaviour and measure no change. Say so on the record so the next reader does
   not try it.
3. **Cost the four candidate designs**, with the evidence for and against each:
   - **(a) Score normalisation** — put each stream's scores on a common scale, then sort globally.
     Cheap, deterministic, no model. ⚠ Its failure mode is specific and must be stated: normalisation
     makes a stream's best-of-a-bad-lot look as strong as another stream's genuinely good hit,
     because it rescales *relative to that stream's own candidates*. A stream that found nothing good
     is promoted to parity.
   - **(b) Stream confidence from the router** — the router already decides which streams to search;
     have it also say how likely each is to hold the answer, and allocate slots accordingly. Cheap,
     reuses a call we already pay for, and directly answers *"one source might have all twenty."*
   - **(c) A reranker over the pooled candidates** (§3) — a model reads the top N from every stream
     and orders them on the question. Most accurate, costs money and latency.
   - **(d) Absolute relevance floors per stream** — a result must clear a bar to occupy a slot at
     all, rather than being entitled to one.
   ▶ **Recommend a combination and say why.** (b) and (d) are cheap and can ship first; (c) is the
   real answer and needs measuring.
4. **How wide can retrieval go before it hurts?** Charlie wants ≥20 per stream retrieved, always.
   Establish the latency and cost of retrieving 20–50 per stream against today's window. ⚠ The
   vector service handles four concurrent requests and stream concurrency is capped at 3 for that
   reason; state whether widening the window per stream touches that ceiling or is orthogonal to it.

---

## §2 — BUILD: WIDE RETRIEVAL, JUDGED SELECTION

**The shape, stated as a requirement rather than an implementation:**

- **Retrieve at least 20 per routed stream, always.** ⚠ **Adding a source must never reduce what any
  other source can contribute.** That is Charlie's rule and it is the acceptance criterion.
- **Select the displayed 20 by judgement across the whole pool**, not by quota.
- **A source may occupy all twenty slots** if that is where the answer is. Assert this with a
  constructed case — a question whose answer set is entirely within one stream must be able to fill
  the window. **A design that cannot do this has not implemented the brief.**
- Flag-gated, default OFF, read through `flagEnabled()` — never a bare `=== 'true'`.
- **Both arms runnable in one session against the same index**, so before/after is a measurement and
  not a comparison against an orphaned figure.

⚠ **`LEX_MERGE_COVERAGE` stays OFF and is not the thing being fixed.** It was S13's minimal
experiment: it bought two questions while moving 24 of 34 rankings and dropping two documents from
second in their own stream to merged 149 and 117. It is a different rationing rule, not a judgement.
**Delete it, or mark it superseded in the same commit** — a flag that survives its own replacement is
how a dead branch gets re-enabled by somebody reading an old note.

---

## §3 — THE RERANKER, AUTHORISED, BOUNDED

- Runs over the **pooled candidates from all streams**, after retrieval, before display.
- **Bounded**: a hard cap on candidates read per query and a per-query cost ceiling, both config.
  Report the actual cost per query against the ceiling.
- ⚠ **Choose the model on the job.** A recent Lex sprint found its adversarial pass running on the
  cheapest model available, producing 407 output tokens for six issues. Ordering across sources is a
  judgement task. **Report which model ran, and its cost.**
- ⚠ **The reranker may reorder. It may not invent, summarise, or drop a result silently.** If it
  discards a candidate, that is recorded and countable. A model that quietly drops the right answer
  is indistinguishable from retrieval that never found it — the exact failure this whole measurement
  programme exists to prevent.
- **Measure it against (b) and (d) from §1**, not only against today. If cheap deterministic changes
  get most of the gain, that is the finding and the reranker waits.

---

## §4 — TWO THINGS CHARLIE ASKED FOR THAT ARE NOT RANKING

Both **reported, scoped and not built** in this sprint. They are named here so they are not lost.

**§4.1 "Have we got everything the other models and the web orientation found?"** The Lex smart pass
(`BRIEF_25F.md` §2b) puts the whole of page one to other models and turns every statute, doctrine and
mechanism they name into a corpus query. **What search owes it is a clean answer to
*"did the corpus confirm this entity, yes or no"*** — so an unconfirmed term can be labelled
unverified rather than dropped or asserted. Report what interface that needs. ⚠ This is the direct
defence against a user getting a better answer from their own chat window.

**§4.2 "Results relevant for unusual reasons — would the user like to know?"** A hit that is
topically distant but genuinely relevant is the single most valuable thing this platform can surface,
and it is the retrieval half of the mechanism-analogue design. Report **what signal would identify
one** — a candidate: high semantic relevance with low keyword overlap, from a stream the router did
not prioritise. Do not build it; say whether the signal is available today.

---

## §5 — RE-MEASURE, WITH THE FLAGS PRODUCTION ACTUALLY HAS

⚠⚠ **Every number in S13 was taken with `LEX_VECTOR_STREAMS=legislation`**, which was the last value
read off the dashboard on 10 August. **Charlie has confirmed production reads
`legislation,caselaw,guidance,committees`.** So S13's absolute figures — including 23% and 43% —
describe a configuration nobody runs.

- **Retake the baseline with the confirmed flag string**, before and after §2, in the same session,
  with the index version stamped either side.
- **State explicitly which earlier figures this supersedes.** This project now has three baselines in
  circulation and two of them are void; a corrected number that does not name what it replaces makes
  a fourth.
- Report per collection with **n stated every time**, and the four-way split (hit · diluted ·
  not-retrieved · not-routed).
- **Q15 is excluded from the denominator** (D-3 approved): its answer key points at a section whose
  stored body is 66 characters of dot leaders, so it can never score. n is 64.
- ⚠ **The debates re-key is with Charlie and is not part of this sprint.** Debates figures here are
  provisional and must say so — 9 of its 11 were NOT-RETRIEVED, which is a retrieval problem this
  sprint does not address.

---

## §6 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-search-s14.sh`; nothing owned by ingest, graph or lex
  edited — report needed changes instead.
- Every check watched failing against the **real** broken state. Every check asserting over a ranked
  or limited set must assert over the whole population or print its own cut-off.
- ⚠ **Do not tune to 64 questions.** Report the shape of any parameter sweep, not the winning point,
  and say explicitly where you decline to change anything.
- **A redeploy is not a rebuild**, and a restart proves only that a process came back. If this
  sprint's changes must reach a service, prove which code arrived with a probe that is false on the
  old build. `/api/health` now returns the deployed commit — use it.
- **Report `docs/SEARCH_S14_REPORT.md`:** §1's design comparison first, including why rank fusion
  cannot work — that is the durable artefact. Then the measured before/after per collection with n.
  Then the reranker's cost per query. Then §4's two scoping answers. Then what is NOT done, named.
  Decisions for Charlie as numbered questions with a recommendation and the consequence of each.
- Change-log, contract and handoff entries labelled **SEARCH**.
