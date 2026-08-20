# BRIEF — STAGE 2D, SPRINT 1: THE ENTITY SPINE AND THE OBSERVED EDGES

**Owner:** CC-Graph (new thread)
**Written:** 11 August 2026
**Design:** `docs/POSITION_GRAPH_DESIGN.md` — read it first, in full. This brief implements build
steps 1 and 2 of its §8 and nothing else.
**Runs in parallel with:** CC-Search on `BRIEF_SEARCH_S2C4.md` and CC-Ingest on
`BRIEF_INGEST_POLITICAL_SOURCES.md`. Nothing here shares a resource with either.

---

## What this sprint is, and what it deliberately is not

**Is:** identify the organisations and people who appear in the corpus we already hold, resolve
them to stable identities, and record the things they demonstrably *did* — gave evidence to this
inquiry, spoke in this debate, declared this interest.

**Is not:** proposition extraction, position inference, alignment scoring, media analysis, or any
external register. Every one of those depends on this sprint being right, and none of them can
repair it later. The design's §8 puts entity resolution first because it is the only step whose
errors are unrecoverable — a wrongly merged pair of organisations contaminates every edge either of
them ever acquires.

**No LLM extraction in this sprint.** If a fact is not already structured in the corpus or derivable
by deterministic rule, it is out of scope. That keeps the cost at effectively zero and means every
number this sprint produces is checkable.

---

## §1 — Establish what the corpus actually holds, before designing anything

Bytes before hypotheses, and this is the step most likely to change the rest of the brief.

For **committees evidence** (`committees-evidence`, 322k sections across the committees corpora),
answer with counts, not impressions:

1. Is the **submitting organisation** carried in structured metadata, or does it exist only inside
   the document text? If structured, what field, and what proportion of rows have it populated?
2. Is the **inquiry** identified, and can a submission be joined to the inquiry and the committee?
3. For **oral** evidence, are **witnesses** named separately from the organisations they represent?

For **Hansard**, whether speakers carry a Parliament member ID or only a name string. For
**members-interests** (3,448 rows, `excluded-by-design` for search and available here), the shape of
the person → organisation → category triple.

**Report before building.** If organisation names turn out to be text-only, the extraction problem
is much larger than the design assumes, and that changes the sprint — say so rather than starting an
LLM pipeline this brief does not authorise.

---

## §2 — Storage: relational, in Neon

**Decision taken, with reasoning.** The queries this graph actually serves — what positions has this
actor taken, who has taken a position on this proposition, how often do these two agree — are joins
and aggregates. A graph database earns its keep on deep multi-hop traversal, which we do not need
yet, and it adds an operational dependency and a second thing to back up. Postgres handles the
traversal we will need at this scale, and the citation/amendment graph already runs relationally. If
traversal depth ever becomes the bottleneck, that is a migration with a clear trigger rather than a
bet taken now.

Four tables, roughly:

- **`graph_entity`** — one row per person, organisation or publication. Carries `kind`, a canonical
  name, and the stable external keys where they exist (Companies House number, Charity Commission
  number, Parliament member ID).
- **`graph_alias`** — every surface form ever seen, with its source. **Never discard the raw
  string.** The original spelling is evidence, and entity resolution across registers is the largest
  hidden cost in this build.
- **`graph_edge`** — subject, predicate, object, plus `first_seen` / `last_seen` dates. Predicates
  in this sprint are the observed set only: `gave-evidence-to`, `spoke-in`, `declared-interest`.
- **`graph_evidence`** — one row per (edge, source document), carrying the corpus section id and,
  where applicable, the extract. **Every edge has at least one.** An edge with no evidence row is a
  claim we cannot show our working for, and the design's §5.1 makes that unacceptable.

Dates on everything. The design's rule that a changed position is a *finding* rather than noise
depends on edges being time-stamped from the start; retrofitting dates is far harder than carrying
them.

---

## §3 — Entity resolution, and the honest treatment of uncertainty

Two stable keys exist: **Companies House numbers** and **Parliament member IDs**. Everything else is
name matching.

- Where a stable key is available, use it and record that you did.
- Where it is not, match on normalised name, and **record a confidence**. Do not silently merge.
- **When in doubt, do not merge.** Two rows for one organisation is a visible, fixable problem. One
  row for two organisations is an invisible, contaminating one, and it is not recoverable once edges
  have accumulated against it.
- Keep a **`merge_log`** so any merge can be undone. You will get some wrong.

Report the resolution rate: how many distinct organisation strings, how many resolve to a stable
key, how many merged on name, and how many are left as singletons.

---

## §4 — The policy-area selection measurement

The design says to prove proposition extraction on one policy area before generalising. **Which area
is chosen from the data, not from political judgement** — Charlie's explicit position, and the right
one: picking the area by intuition is a curation act, and we have ruled those out.

Produce a ranked candidate list. Per policy area, count:

- distinct organisations appearing across **more than one** inquiry,
- total submissions,
- and, as a rough proxy for contestation, how many organisations appear in inquiries where the
  committee's recommendations were **not** accepted in full (or another countable signal you can
  defend — say what you chose and why).

The area with the densest repeat organisational participation is the best test bed, because it has
the most edges per unit of extraction cost. **Present the table; Charlie picks from it.**

---

## §5 — What "done" looks like

Counts, not adjectives:

- distinct organisations, distinct people, distinct publications
- edges by predicate, each with evidence coverage (should be 100%)
- resolution rate against stable keys
- the policy-area candidate table
- a written statement of what the corpus **cannot** support, so the next sprint is not designed
  against capability we do not have

Plus one thing that is not a count: **pick three organisations you would expect to be well
represented and read their edges by hand.** If the graph says something obviously wrong about a body
you can check, the counts are decoration.

---

## §6 — Two standing constraints from the design

1. **No curated lists.** The entity set is discovered from the corpus and from public registers. We
   never hand-maintain a list of the organisations that matter — the selection would be the
   political act.
2. **"No evidence" is an output.** Where the corpus is silent about an actor, that is recorded as
   silence, never rendered as neutrality and never filled in.

---

## Working rules

The same ones the search and ingest threads run on, and they have earned it this week:

- **Bytes before hypotheses** — §1 exists for this reason.
- **Prove a check can fail before trusting it passes.**
- **An inference must not travel as a measurement** — and in this workstream that rule is
  load-bearing rather than hygienic, because the whole product claim is that we show our working.
- **Scoped commits only.** Three threads share this tree; never `git add -A`.
- Report costs in full, and predict before any expensive or destructive run.
