# BRIEF — SEARCH STAGE 2B: THE SCORE LANDMINE, AND WHAT THE CORPUS CAN ACTUALLY REACH

**Owner:** Search thread (CC-Search)
**Written:** 9 August 2026
**Follows:** `BRIEF_SEARCH_S2A.md` §1 and §2 (landed, commits `4c3d18f..972de76`)
**Runs independently of:** S2A §3 and §4, which remain gated on the `corpus_vec` delta-embed
marker. Nothing in this brief touches that gate, so start now.

---

## §0 — The cross-stream score landmine (PREREQUISITE FOR 2C)

The S2A audit recorded, correctly, that `groupForPanel` already performs the global cross-stream
score sort the S2A brief argued against, and that `fuseWeightedRrf` **overwrites** `score` with an
RRF value of roughly 0.008–0.016 while unfused streams carry raw BM25 of roughly 5–25. The
consequence: with per-stream vector active, every fused hit sorts below every unfused hit and can
be clipped out of the panel's 20-cap entirely.

CC was right to leave it out of S2A's scope. It is in scope now, because **Stage 2C is "turn
per-stream vector on for the remaining four streams" — which is precisely the action that
detonates this.** It must be fixed before 2C, not after.

### The fix is a deletion, not a new policy

Do **not** invent a normalisation scheme, and do not tune weights. After S2A the list arriving at
`groupForPanel` is already stream-balanced by construction. The minimal correct change is
therefore:

- **`groupForPanel` stops re-sorting across streams.** It preserves the incoming order for
  cross-stream purposes, and keeps its existing per-type bucketing (≤3 per type) and `TOTAL_CAP`.
  Within a type, preserve incoming order.
- Anywhere a score comparison survives, it must compare **like with like** — two hits from the
  same stream, produced by the same scorer.

Why deletion rather than normalisation: a min-max or z-score normalisation across streams would
produce numbers that look comparable and are not, because the underlying distributions come from
different indexes and, after fusion, from a different scoring function altogether. That is the
same false precision, wearing a more convincing face. A genuine cross-stream ordering arrives with
the reranker, which scores documents against the query rather than against their own corpus — and
it gets adopted only if the pairwise-preference baseline rewards it.

### Make the class unrepeatable

Add an assertion to the existing check family: **no code path may sort a list that mixes fused and
unfused results by `score`.** The cheapest durable form is to carry the scorer's identity on the
result (`scorer: 'bm25' | 'rrf'`) and assert that any sort-by-score sees exactly one value. Prove
the check fails before trusting it to pass.

### One thing to establish first, and report before changing anything

**Read the resolved capability line at boot (`instrumentation.ts` `[capabilities]`) and report
whether `LEX_VECTOR_STREAMS` and `LEX_SEARCH_VECTOR` are currently set in production.** If
per-stream vector is already live, this is not a latent landmine — it is a live defect on the
panel-consuming surfaces (Page-1 briefing, ad-hoc research, stage search), and it is a pilot
blocker rather than a prerequisite. Report the resolved values, do not infer them from `.env`.

---

## §1 — The corpus reachability matrix

### Why

The router selects from five streams. The corpus holds roughly 68 collections, and
`SEARCH_STRATEGY.md` §3.1 already names about fifteen stream-worthy rows. **A collection with no
stream the router can select is unreachable by any query, no matter how good the ranking is.** We
have been improving the ordering of the part of the corpus that is wired up, with no instrument
that says how large that part is.

This is a measurement, not a design. The stream set gets decided from the table, not from
intuition about which corners matter.

### The deliverable

One script producing `docs/CORPUS_REACHABILITY.md` plus machine-readable JSON, with one row per
source collection:

| Column | Meaning |
|---|---|
| `collection` | the corpus/source identifier as ingest names it |
| `sections` | rows in Neon |
| `fts_rows` | rows in `corpus_fts` |
| `vec_rows` | rows in `corpus_vec` |
| `type` / `tier` | the display type and tier tags it carries |
| `router_stream` | the stream that can select it, or **`NONE`** |
| `tier_scoped_callers` | which callers reach it by explicit tier, bypassing the router |
| `gold_questions` | count of gold-set questions whose answer key names a document in it |
| `verdict` | one of `reachable` / `keyword-only` / `tier-only` / `UNREACHABLE` |

`verdict` is the point of the table. Everything else is evidence for it.

### Three specific things to check while you are in there

1. **Named suspects.** Confirm the status of each of these, individually, rather than reporting a
   total: treaties, members' interests, written answers, ministerial statements, impact
   assessments, explanatory notes, NAO and evaluation reports, consultations, quango rulebooks,
   statutory codes, sector rulebooks (FCA Handbook), HMRC manuals, and the statistics catalogue.
2. **The committees gold-question defect, restated as a measurement.** Four committee gold
   questions score a flat 100% while returning zero committee documents — Hansard satisfies the
   key by accident. The matrix should make that visible as a general property: for each gold
   question, which collection the returned documents actually came from versus which the key
   intends. Any question satisfied entirely from a different collection than intended is
   **not testing what it claims to test**, and there may be more than the four we know about.
3. **Tier-scoped bypass.** `gateway-legacy.ts` passes an explicit tier, so the Lex chat route,
   `/api/search`, and the legislation-search panel get neither routing nor dense retrieval. Record
   which collections are reachable *only* that way, because they are invisible to every
   measurement we have taken through the routed path.

### What NOT to do in this sprint

Do not add streams. Do not change the router prompt. The matrix is the input to that decision and
the decision is Charlie's, taken against the table.

---

## §2 — Open items carried, not closed

- **`caselaw` selection fell from 36/36 to 22/36** after the few-shot examples landed. A router
  that selected every stream on every query was not routing, so the fall is plausibly correct —
  but "plausibly correct" is not measured. Add it to the list of things the gold set answers once
  Gate 2 opens. Do not revert it on suspicion.
- **S2A's `--pre-fix` mode stays in the tree.** It is the only thing that can demonstrate the old
  behaviour, and the next person to doubt the interleave will want it.

---

## Working rules

Unchanged from S2A, and two of them earned their place again this week:

- **Repeats are not optional** on any intermittent behaviour. One pass measures the sample.
- **Prove a check can fail before trusting that it passes.** The stale `check:flags` assertion had
  been failing for a day against correct code; the reverse error is worse and quieter.
- One variable at a time; reverse the run order to catch warming artefacts.
- No mid-sprint commits; one named commit script at the end.
