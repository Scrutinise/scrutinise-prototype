# BRIEF — SEARCH STAGE 2C: THE DROPPED CORNERS, THEN THE BASELINE

**Owner:** Search thread (CC-Search)
**Written:** 10 August 2026
**Follows:** `BRIEF_SEARCH_S2A.md` (landed), `BRIEF_SEARCH_S2B.md` (landed)

---

## §0 — Your open question is answered, and your inference was right

Charlie read Vercel directly:

- `LEX_VECTOR_STREAMS` = **`legislation`** — set, in production.
- `VECTOR_SEARCH_URL` = **set** to the Railway vector-serve URL.
- `LEX_SEARCH_VECTOR` — **no entry**, so off, matching the `flags: expansion router` line you read.

**So the cross-stream score defect was live, not latent**, exactly as your `served +1 that does not
scale with stream count` reasoning concluded. You treated it as a live pilot blocker on the
conservative reading and were correct on the facts. That is the right way to be wrong-if-wrong.

Two consequences:

1. **`docs/RAILWAY_ROLE.md` is wrong and must be corrected.** It records `VECTOR_SEARCH_URL` as
   unset in Vercel. A document asserting a flag state that nobody can verify from the machine
   holding the document is the same failure class as the flag incident itself. Correct it, and add
   a line saying how the value was established (Charlie read the dashboard) and on what date —
   because the next reader will otherwise face the same unresolvable contradiction.
2. Record in `CLAUDE.md`, alongside the existing flag rule: **a SAML-scoped 403 means flag state is
   unknowable from here and must be asked for, not inferred — and where it has been inferred, the
   inference is labelled as one.**

Also worth stating plainly, because the two halves only make sense together: general chat was
reading **only** legislation (S2A), while the panel surfaces were sorting legislation **last or
off the end** (S2B). Opposite symptoms, one root cause — there was no cross-stream ordering policy
at all, so each caller improvised one.

---

## §1 — The four collections no caller can receive

The matrix found `corpusToType` returning null for `explanatory-notes` (18,801 sections),
`explanatory-memoranda` (27,428), `erskine-may`, and `members-interests`. Indexed, searchable,
retrieved, and dropped by the FTS adapter before any caller sees them. V33 built 24,987 vectors for
the first two, six hours before the matrix said no user can receive them.

**These are four different decisions, not one bug.** Do not fix them with one blanket mapping.

### 1a. Explanatory notes and explanatory memoranda — fix, and treat as high value

These are the plain-English statements of what a provision was *for*, published alongside Acts and
SIs. For a platform whose purpose is helping someone change the law, a statement of original
legislative intent is close to the most useful non-statutory thing in the corpus — the corpus plan
calls impact assessments "gold for *what were they solving*", and explanatory notes are the same
class of material and already ingested.

Map both to a display type and make them reachable from the **legislation** stream, so a query
about an Act can surface the note that explains it. Report which display type you chose and why;
if none of the existing types fits, say so rather than forcing one, and propose the new type as a
decision for Charlie rather than adding it silently.

### 1b. `erskine-may` — fix, low priority

Parliamentary procedure. Map it into the **guidance** stream. It answers a narrow class of question
(what the House can and cannot do with a proposal) and that class is real.

### 1c. `members-interests` — do NOT wire into general search

`SEARCH_STRATEGY.md` §3.1 already classes this as *"a political-risk and people-graph input, not
searched for its own sake."* That is the correct call and it should stay. **But it must stop being
correct by accident.** Right now it is excluded because a type map returns null, which is
indistinguishable from the explanatory-notes defect and would be "fixed" by the next person doing a
sweep.

Make the exclusion explicit and commented: a named, deliberate opt-out with the reason, so the
matrix reports it as `excluded-by-design` rather than `UNREACHABLE`. **Add that verdict to the
matrix** — a collection nobody can reach on purpose and a collection nobody can reach by mistake
must not print the same word.

### 1d. Re-run the matrix afterwards and report the delta

The headline is currently 93.1% of sections reachable. State what it becomes, and state what
remains outside — by name, not as a residual.

---

## §2 — The benchmark and the ordering baseline (S2A §3 and §4)

Gate 1 has been open since S2A. **Check Gate 2 yourself before starting**: the `corpus_vec`
delta-embed completion marker in `handoff_summary.md`. Ingest predicted completion around midday
UTC on 10 August with a 15–30 hour spread. If the marker is absent, do §1 and stop; do not measure
across a running embed.

### One thing the matrix changed about how this must be measured

**12 gold questions are satisfied in part by a `keyword-only` collection, so turning routing ON
costs recall on those questions for reasons that have nothing to do with ranking quality.** A
routed-versus-unrouted comparison is therefore not like-for-like, and reporting a single delta
would blame the router for a scoping loss.

Report the two separately:

- **recall lost to scoping** — keys satisfied only by documents a routed query can no longer reach.
- **ordering changed** — movement among the documents both configurations return.

The second is the number the reranker decision rests on. The first is an argument about stream
coverage, which is Charlie's decision and belongs in the same conversation as the matrix.

Note also that **4 questions declare a stream the router does not have** (archetype D, "citation
graph") and **4 are satisfied in part by an UNREACHABLE collection**. Exclude both sets from the
ordering baseline's denominator and say how many you excluded. A metric that silently scores
questions the system cannot answer is measuring the wrong system.

### Then, and only then

Run `score-ordering.ts` against the 20 committed pairs, on the interleaved list handed to the
answer call, before `groupForPanel`. Report the pairwise-preference accuracy and the recall@20
invariant. **The reranker is authorised by that number or not at all.**

Record a prediction before you measure, as in S2A. Mine, for scoring: the PECR-leading regression
does not reproduce, because it was observed on a system where the answer saw only legislation and
the panel sorted legislation last.

---

## §3 — Carried, unchanged

- `caselaw` selection 36/36 → 22/36 after the few-shot examples. Answered by the gold set once §2
  runs, not reverted on suspicion.
- The `--pre-fix` modes in `check-stream-coverage` and `check-score-scope` stay in the tree.

---

## Working rules

Unchanged. Two that keep earning their place: **repeats are not optional** on anything
intermittent, and **prove a check can fail before trusting it passes.** Add a third, from S2B:
**when a fact cannot be read from here, say so and ask — do not let an inference travel as a
measurement.**
