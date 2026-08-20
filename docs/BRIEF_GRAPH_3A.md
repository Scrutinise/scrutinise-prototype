# BRIEF — GRAPH 3A: THE POSITION GRAPH, FACTUAL LAYER

**For:** CC-Graph
**Written:** 19 August 2026, by CCh-Search/Graph
**Executes:** `docs/POSITION_GRAPH_DESIGN.md` §2–§6 (read it first; it is the spec, this is the
work order). Strategy context: `SEARCH_STRATEGY_v5.md` §9.2.
**Format:** audit-then-build. No git during the sprint; one `commit-all.sh` at the end, scoped by
explicit path, Charlie approves on preview, execute, delete. **Cost: $0 — no LLM calls anywhere in
this sprint.** Every derivation is arithmetic over data we already hold.

---

## §0 — WHERE WE ARE

Recent past: GRAPH 2D-2 built 2.48M `voted` edges and the person sweep; 2D-3/2D-4 extracted 16,196
positions from submissions; 2D-5 hand-read fifty, found 44% wrong (direction wrong on only 2), and
measured Charlie's bottom-up claims architecture as a supplement, not a switch. The extraction
route is **parked, not dead** — it returns in 3D as a low-confidence signal.

This sprint: the position graph is rebuilt as **graded estimates over immutable factual signals**
(design §1–§2). 3A builds the schema, derives every P0 signal from data already in Neon, builds the
weighting/decay/aggregation engine, exposes a read API, and puts an admin surface over it.
**Nothing user-facing.** Visibility is gated on the §8 validation set, which is a later sprint.

Next after this: 3B (registers + amendment classification), the validation set, 3C (prototypes),
3D (extraction folded back in).

**Coordination — read carefully:** CC-Search is running SEARCH S8 today in the same repository.
S8 §1 edits the **Deepening pass configuration**. Therefore 3A must **not** touch the deepening
pass config or any file under the search stream's ownership (`lib/lex/search-gateway.ts`,
`chat-retrieval.ts`, stream scopes). 3A builds up to and including the read API
(`lib/graph/positions.ts` — new file, yours) and the admin surface. **The one-line registration of
the political-risk hook into the deepening config is deliberately OUT of this sprint** and will be
done as a follow-up commit after S8's commit-all lands. Scoped commits by explicit path are what
make this safe; `git add -A` is what makes it a merge disaster.

---

## §1 — AUDIT FIRST

Report before building:

1. **The entity layer.** Confirm where the person and organisation entities from the 2D-2 sweep
   live, their id shape, and coverage: what fraction of `division_votes` rows resolve to an entity
   id today, and what fraction of EDM sponsorships do. Unresolved names are *excluded* from
   signals (design §3 — the graph never creates people); report the exclusion rate so it is a
   known number, not a silent loss.
2. **The stores.** Row counts and column shapes actually present for: division votes (expect
   ~2.53M), divisions themselves (do we hold the division *question/subject* text — needed for
   evidence display), EDM sponsorships (~60k) and EDM texts, committee memberships, witness
   appearances, declared interests (~1,505), bill sponsorship/amendment rows in `bills-api`.
   Read rows back, not just counts.
3. **Party-at-time-of-vote.** Rebellion derivation needs each member's party *on the date of the
   division* (members change party). Establish what we hold: a party-membership history, or only
   current party. If only current, the rebellion derivation must use per-division party inference
   (the party whose majority the member usually sits with in that parliament) — and if that is the
   route, say so in the report and version it into the derivation name, because it is an inference
   with a different error profile.
4. **Existing `voted` edges.** Decide, with reasoning: derive `position_signal` rows from the 2D-2
   edges, or from the underlying vote rows directly. Recommendation: from the underlying rows
   (one derivation, one provenance chain), with a reconciliation count against the 2D-2 edges as a
   cross-check — a large discrepancy is a finding, not a rounding error.

If any audit finding contradicts this brief's assumptions, **stop and report before building** —
the design survives contact with the data or it changes on the record.

## §2 — SCHEMA

Build `position_signal` and `position_estimate` exactly per design §3, as an **additive**
migration (no ALTER/DROP of anything outside these tables — asserted by a check, like 25-A's).
Apply to Neon, then re-apply to prove idempotence. Indexes to support the two real queries:
signals by `(actor_id, target_type, target_id)` and by `(target_type, target_id)`.

## §3 — DERIVE THE P0 SIGNALS

Each derivation is a standalone, re-runnable script; each records predicted row counts in the
change log **before** running (predict-measure-compare), and each verifies by reading rows back.

1. **Votes.** One signal per resolved vote row. `direction` from aye/no relative to the division
   question. `raw_weight` per design §5: compute each party's majority side per division; a member
   on their own party's minority side is a **rebellion** (`derivation: 'rebellion:v1'`, weight
   0.9); divisions where no major party reaches the cohesion threshold (config, start 85%) are
   **free-vote-like** (`'free-vote-heuristic:v1'`, weight 0.7); everything else whipped-with (0.2).
   ⚠ **Auditability requirement:** the report lists the top 30 divisions the heuristic tags as
   free-vote-like, by rebellion volume. The classic free votes — assisted dying, hunting, abortion-
   related divisions — are the *expected* members of that list. If they are absent, the heuristic
   is wrong; investigate before proceeding. This is the sprint's built-in sanity check on its
   biggest inference.
2. **EDM signatures.** One signal per sponsorship, direction +1 toward the EDM as target, weight
   0.6. (Whether an EDM's *subject* supports or opposes some wider idea is query-time synthesis
   work, not stored direction — the stored fact is "signed this motion".)
3. **Amendment sponsorship.** One signal per sponsorship fact from `bills-api`, **direction 0**,
   weight recorded but inert until 3B classifies strengthening-vs-wrecking. Landing the fact now
   costs nothing and gives 3B a stable base.
4. **Committee membership and witness appearances.** Direction 0, weight 0.1 (attention signals).
5. **Declared interests.** Direction 0, weight 0.1, target = the interest's organisation where the
   org entity resolves; unresolved orgs excluded and counted.

Every signal: `evidence_ids` non-empty (the vote row / sponsorship row / interest row), `observed_at`
= the event date, never the ingest date. Scale note: ~2.5M+ rows — run heavy batches sensibly and
verify totals by count *and* by sampling 50 random signals read back against their source rows by
hand-checkable join, printed in the report.

## §4 — THE ESTIMATE ENGINE

`scripts/graph/build-position-estimates.ts`, re-runnable, truncate-and-rebuild (design §2 makes
this safe).

- Aggregation per design §5: weighted mean of `direction × raw_weight × decay(observed_at)`;
  confidence a saturating function of summed decayed weight; direction-0 signal types capped in
  their confidence contribution (config ceiling, start 0.15) so attention can never manufacture
  certainty.
- All constants in one config module with a `config_version` string; every estimate row carries it.
  Comments carry the *why* per the design table — if a why is missing, ask Charlie, do not invent.
- **Checks with constructed cases, each watched failing first:**
  - one rebellion outweighs ten whipped votes (same target, opposite directions);
  - a 15-year-old vote contributes less than a 1-year-old identical vote;
  - an actor with only direction-0 signals has confidence ≤ the ceiling;
  - an actor with no signals has **no row** (absence, not zero — design §6);
  - truncate-and-rebuild is bit-identical on a fixed fixture (determinism);
  - changing a weight changes `config_version` on rebuilt rows.

## §5 — THE READ API

`lib/graph/positions.ts` (new, CC-Graph-owned): `positionsFor(targets[], opts)` → per actor:
estimate, confidence, `signal_counts` breakdown, and evidence rows resolvable to displayable
citations (division title + date, EDM title, etc.). Include a `describeConfidence()` helper that
maps confidence bands to fixed wording ("strong recorded record" / "some recorded signals" /
"weak indication") so callers cannot each invent their own adjectives — the never-claim rule
enforced at the vocabulary level.

**Do not wire this into the deepening in this sprint** (§0 coordination). Write the ~5-line
integration snippet the political-risk pass will need into the report, ready for the follow-up
commit after S8 lands.

## §6 — ADMIN SURFACE

A minimal admin page (admin-gated, alongside the existing admin tools): enter one or more targets
(division/EDM/bill id, or free text resolved via the existing search to candidate targets), see
ranked actors with score, confidence wording, signal breakdown and drillable evidence. Purpose:
Charlie can eyeball the graph against his own political knowledge before the formal validation
set exists — the cheapest possible reality check. Browser verification of this page is Charlie's;
name it in the report as the thing to click.

## §7 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; additive migration only; no files under search-stream or
  ingest-stream ownership touched.
- Every check watched failing first; predictions logged before derivations run.
- Bytes before hypotheses: sampled signals read back against source rows.
- Report `docs/GRAPH_3A_REPORT.md`: audit findings first (including the entity-resolution exclusion
  rates, with what each is a percentage OF and what follows from it), per-section counts against
  predictions, the free-vote sanity list, what is NOT done (deepening wiring, 3B classification,
  validation set), and the numbered decisions for Charlie, if any arise.
- Handoff and change-log entries labelled **GRAPH**.
