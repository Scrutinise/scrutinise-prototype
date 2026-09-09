# POSITION GRAPH — DESIGN (v1)

**Status:** canonical design document for the position graph. Cite by section number in CC briefs.
Sits under `SEARCH_STRATEGY_v5.md` §9.2, which states the strategy; this file states the build.
**Written:** 19 August 2026. **Owner of the build:** CC-Graph.

---

## 1. Purpose, and what died

The position graph answers one product question: **"who is likely to support or resist this idea,
on what grounds, with the evidence attached"** — the political-risk pass of the Lex deepening.

The first design read positions out of committee submissions with a model and stored them as
assertions. Hand-reading fifty against source found 22 wrong or partly wrong (44%). The diagnosis:
the *direction* was wrong on only 2 of 50 — the model is nearly always right about which side a
document takes, but claims a position far too often, because "this document doesn't take one"
feels to a model like failing. Meanwhile the corpus already held **2.5 million perfectly reliable
positions** (every division vote *is* a position) and surfaced none of them.

**The reframing (v5 §9.2):** the graph holds **graded, evidence-backed estimates**, not
certainties. Facts are estimates with confidence 1.0. Extraction survives as one low-confidence
signal. Everything carries provenance, and everything old fades.

## 2. The two-layer model: signals are facts, estimates are derived

Two layers, and the split is the losslessness invariant applied to this graph:

- **`position_signal` — immutable observations.** One row per observed event: *this actor did this
  thing bearing on this target, on this date, evidenced by these corpus rows.* Signals are never
  edited and never deleted by recomputation; a corrected signal is superseded, not overwritten.
- **`position_estimate` — derived, recomputable.** The aggregated stance of an actor toward a
  target: score, confidence, contributing-signal breakdown, computed_at. **Estimates can be
  dropped and rebuilt from signals at any time.** No fact lives only in an estimate.

Why: weights, decay curves and aggregation rules *will* change as we measure. If the aggregate
were the stored truth, every tuning change would corrupt history; because the signal layer is the
truth, tuning is a recompute, and any past output can be reproduced from the signals plus the
config version that produced it.

## 3. Schema

```sql
-- one row per observed event; append-only
position_signal (
  id            bigserial primary key,
  actor_id      -- FK to the existing graph person/org entity (GRAPH 2D-2 sweep). NEVER a raw name.
  target_type   -- 'division' | 'edm' | 'bill' | 'instrument' | 'submission_claim' (P3, later)
  target_id     -- id in the relevant store
  signal_type   -- 'vote' | 'edm_signature' | 'amendment_sponsorship' | 'committee_membership'
                --  | 'declared_interest' | 'witness_appearance' | (later) 'prototype_similarity'
                --  | 'extracted_position'
  direction     smallint,     -- +1 / -1 / 0 (0 = attention/affinity signal with no side)
  raw_weight    real,         -- informativeness of this signal type at observation time (§5)
  derivation    text,         -- NULL for a plain fact; else names the method, e.g. 'rebellion:v1'
  evidence_ids  bigint[],     -- corpus/graph rows this is drillable to; never empty
  observed_at   date,         -- when the event happened (the vote date, not the ingest date)
  created_at    timestamptz,
  superseded_by bigint null   -- corrections point forward; nothing is deleted
)

-- derived; safe to truncate and rebuild
position_estimate (
  actor_id, target_type, target_id,
  stance_score  real,   -- [-1, +1]
  confidence    real,   -- [0, 1]
  signal_counts jsonb,  -- per signal_type: n, summed weight — the "grounds" for display
  config_version text,  -- which weight/decay config produced this
  computed_at   timestamptz,
  primary key (actor_id, target_type, target_id)
)
```

Rules the schema enforces or a check asserts:

- `actor_id` references the existing entity layer. **Never merge two identities on similarity**
  (standing rule): an unresolved name stays unresolved and thin; the graph does not create people.
- `evidence_ids` is never empty. An edge that cannot point at its evidence does not exist.
- A signal with `derivation` set is an **inference travelling as an inference**: the method name is
  versioned, so a method change produces new signals rather than silently re-meaning old ones.
- Estimates carry `config_version`, so a number quoted in a report can be reproduced.

## 4. The signal ladder — build order and confidence classes

| Tier | Signal | Direction from | Confidence class | Status |
| --- | --- | --- | --- | --- |
| **P0** | Division votes, **rebellion/free-vote weighted** (§5) | aye/no vs the question | fact of the act; weight varies | GRAPH 3A — no new data |
| P0 | EDM signatures (voluntary, unwhipped signalling) | the motion's ask | fact | 3A |
| P0 | Amendment sponsorship (strengthening vs wrecking needs classification — deferred to 3B; the *sponsorship* fact lands in 3A with direction 0) | later | fact / classified later | 3A partial |
| P0 | Committee membership, witness appearances | none (direction 0 — attention) | fact | 3A |
| P0 | Declared interests, register-numbered organisations | none (direction 0 — alignment prior) | fact | 3A |
| **P1** | APPG membership and funders; Electoral Commission donations; Companies House joins | none directly; paths raise priors | fact of the path | GRAPH 3B (ingest half is CC-Ingest) |
| **P2** | Embedding-prototype stance scores (similarity of an actor's speech/submissions to curated position-paper prototypes, reusing the live vector index) | prototype's side | continuous; calibrated by measurement | 3C — **gated on the validated gold set** |
| P2 | Written/oral question volume and framing | mostly 0 | weak | 3C |
| **P3** | Existing 16,196 extracted positions + the bottom-up claims supplement (2D-5: finds 74% more, 85% real, recovers only 57% of known-correct, 3.73× cost — supplement, not switch) | extraction | low; direction reliable, existence not | 3D — demoted, never shown as fact |

## 5. Weighting, the free-vote problem, and decay

**Initial weights are config constants, versioned, explicitly provisional until measured (§8).**
Starting values, with the reasoning each carries as a comment:

| signal | raw_weight | why |
| --- | ---: | --- |
| rebellion (voted against own party's majority) | 0.9 | the member paid a price to record this |
| free vote | 0.7 | unwhipped, so the member's own view |
| whipped vote, with the whip | 0.2 | mostly measures the whip, not the member |
| EDM signature | 0.6 | voluntary, costless but deliberate |
| amendment sponsorship (once classified) | 0.7 | active effort |
| witness appearance / committee membership | 0.1 | attention, not stance |
| declared interest | 0.1 | alignment prior, not stance |

**Rebellion is derivable today:** for each division, compute each party's majority side; a member
on the minority side of their own party rebelled. `derivation: 'rebellion:v1'`.

**Free votes are NOT recorded in the data we hold** — whipping instructions are not published
systematically. 3A approximates: a division where **both** major parties split badly (cohesion
below a threshold, e.g. neither party ≥ 85% on one side) is *treated as* free-vote-like, method
`'free-vote-heuristic:v1'`, threshold in config. This is an inference and travels as one; the
report must show the divisions the heuristic tags so the classification is auditable (the classic
free votes — assisted dying, abortion, hunting — are the expected members of that set, and if they
are missing the heuristic is wrong).

**Decay:** signals fade with a per-signal-type half-life (config; starting point: votes 8 years,
EDMs 5, interests none while current). Old positions become low-confidence, not absent — a 1998
vote still appears in the evidence, discounted, dated.

**Aggregation (estimate build):** weighted mean of directional signals' `direction × raw_weight ×
decay(observed_at)`, with confidence a saturating function of summed decayed weight (one rebellion
outweighs ten whipped votes; many weak signals never manufacture certainty — cap the contribution
of any 0-direction signal type to confidence at a low ceiling). Exact functional forms are 3A's to
propose in code with reasoning comments; the *properties* above are the requirements and are
asserted by checks with constructed cases.

## 6. How the consumer uses it — query-time, not precomputed topics

The graph stores stances toward **concrete targets** (divisions, EDMs, bills, instruments). It does
not try to precompute stances toward abstract topics — that mapping is what search is for:

1. The political-risk pass takes the idea and uses the existing gateway (`runSearch`) to find the
   relevant bills, divisions and instruments.
2. A read API — `positionsFor(targets[], opts)` — returns, per actor: estimate, confidence,
   signal breakdown, and drillable evidence rows.
3. The pass renders: ranked likely supporters and opponents, **each line carrying its grounds**
   ("opposed: rebelled on X (2021), signed EDM Y (2019)") and its confidence in words, not just a
   number.

The never-claim rule, applied here: the synthesis layer reports the estimate and its grounds; it
does not round 0.6 up to "supports"; and an actor with no signals is *absent*, not neutral —
"no recorded signal" is a different fact from "score 0".

Mechanism-transfer edges ("actors who backed analogous levers in other domains") depend on the
mechanism lens (strategy §9.3) and are out of scope until it exists.

## 7. Phasing

| Sprint | Scope | New data | LLM spend | Owner |
| --- | --- | --- | --- | --- |
| **GRAPH 3A** | schema, P0 signals, weighting/decay engine, estimates, read API, admin surface | none | $0 | CC-Graph — brief written |
| **GRAPH 3B** | P1 registers (APPG, Electoral Commission, Companies House joins) + amendment classification pilot | 3 public registers | small, piloted | ingest half CC-Ingest; edges CC-Graph — briefed after 3A lands |
| **GRAPH 3C** | P2 prototype stance scoring + question-attention signals | curated prototype texts | embedding reuse; small | briefed after the gold-set validation pass |
| **GRAPH 3D** | P3: fold extraction in at low confidence; claims-architecture supplement per 2D-5's verdict | none | measured per 2D-5 | last |

Briefs are written one sprint ahead only (standing practice: a brief written before the prior
sprint's findings is a brief written on guesses).

## 8. Measurement — the gate on visibility

Before any estimate reaches a user surface:

- **A hand-labelled validation set:** ~10 well-known contested matters (assisted dying, hunting,
  Rwanda/removals, smoking ban, HS2-class infrastructure…), each with ~10 actors whose public
  position is documented and checkable. CC drafts candidates with citations; **Charlie validates**,
  exactly like the search gold questions.
- Score: does the estimate's *sign* match the documented position (target ≥ 90% on
  confidence ≥ 0.6 estimates), and does confidence rank honestly (high-confidence errors are the
  damaging class and are counted separately).
- Predict-measure-compare: the expected accuracy is written down before the run.
- Until this passes, estimates appear **only** inside the deepening's political-risk pass output
  (clearly worded as estimates) and on an admin surface — not on any public-facing page.

## 9. What this graph never does

- Never asserts a position without evidence rows behind it.
- Never merges identities on similarity.
- Never lets a P3 extraction appear as a fact, at any confidence.
- Never precomputes "topic" stances — targets are concrete artefacts; topics are query-time.
- Never survives a tuning change silently: weights and decay are versioned config, estimates name
  the version that produced them, and history is reproducible from signals.
