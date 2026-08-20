# BRIEF — GRAPH 3B: MAKE THE GRAPH DISCRIMINATE, THEN WIDEN IT

**For:** CC-Graph
**Written:** 19 August 2026, by CCh-Search/Graph
**Executes:** `POSITION_GRAPH_DESIGN.md` §4 (P1 tier), §5 (weighting), §6 (read API), §8 (the gate)
**Reads first:** `docs/GRAPH_3A_REPORT.md` — this brief is written against what 3A found, not against
what 3A was asked to do.
**Format:** audit-then-build. No git during the sprint; one **`commit-graph-3b.sh`** at the end
(standing rule: commit scripts named per stream and per sprint). Scoped commits by explicit path;
additive migrations only.

---

## §0 — WHERE WE ARE, AND WHAT 3A ACTUALLY PROVED

3A built the factual layer: 2,317,523 signals, 2,304,748 estimates, no model, £0. Two independent
sanity checks passed without being told the answer — the highest-confidence records in the whole
graph are the recognised serial rebels, and one member's two assisted-dying votes classify
differently because he had lost the whip for the first and been readmitted by the second.

**Three things 3A found that change this sprint:**

1. **Two planned P0 signals have no source data.** Amendment sponsorship and committee membership
   are not in the database; we hold bill PDFs, not who sponsored what.
2. **Party-at-time-of-vote is already stored** on 2,527,966 of 2,528,032 rows (99.997%) — no
   inference needed.
3. **The Commons division record starts March 2016.** The graph therefore has a ten-year memory.
   The historic conscience votes (1966, 1990, 2008) are simply absent, which is why the free-vote
   heuristic correctly flags no abortion divisions — the ones we hold are Northern Ireland
   Regulations, which were whipped.

**And one defect Charlie found in the live admin page**, which is §1 and is the most important item
in this sprint.

---

## §1 — THE SCORES DO NOT DISCRIMINATE. THIS IS THE PRIORITY.

**What Charlie saw** on `/admin/positions`, two assisted-dying divisions selected: 555 actors have a
signal; the page says *"showing the top 40"*; and the list runs Alex Baker, Alicia Kearns, Antonia
Bance, Aphra Brandreth, Bell Ribeiro-Addy — **alphabetical order**. Every actor shown carries
stance exactly +1.00 or −1.00 and confidence exactly 0.671.

**The diagnosis, stated plainly:** anybody who voted the same way on both selected divisions gets an
identical score, so "top 40" has nothing to sort on and falls back to name order. **A ranking that
cannot rank is the same failure class as a metric that cannot fail** — it looks like a result and
is not one.

⚠ **Do not fix this by changing the tie-break.** Sorting by something else would hide the real
finding, which is that on a small target set the current aggregation produces a handful of distinct
values.

**Audit first, report before building:**

1. **Distribution.** Over all 2.3M estimates, and separately over the two-target assisted-dying case:
   how many distinct stance values, how many distinct confidence values, and the histogram of each.
   Report what fraction of estimate rows sit at exactly ±1.00 — **as a percentage of all estimates**
   — because that fraction is the measure of how little the score currently says.
2. **Why confidence saturates at 0.671 for two votes.** Read the actual saturating function and
   state, with worked numbers, what one, two, five and twenty signals produce. Then say whether the
   shape is wrong or whether two votes genuinely *should* be near the ceiling. Both are defensible;
   the report must pick one and show the arithmetic.
3. **What would discriminate.** Candidates, with the evidence for each: number of independent
   signals; consistency across them (someone who voted the same way five times is not the same as
   someone who voted once); recency spread; signal-type mix (a rebellion plus an EDM signature is
   stronger evidence than two whipped votes). ⚠ **A proposal only — do not retune the weights in
   this sprint.** Weight changes must be validated against the §3 answer key, not chosen because
   they produce a prettier distribution.

**Build in this sprint (safe, non-tuning):**

- **Rank by something honest and say what it is.** Order by confidence, then by number of
  contributing signals, then by name; and **print the sort key on the page**. If the top 40 are tied,
  the page must say *"40 of 555 actors, tied at this confidence — ordered by name"* rather than
  implying a ranking exists.
- **Say what the stance is a stance toward.** "supported 1.00" against a target that is *Amendment
  12* reads as "supports assisted dying" and means "voted for Amendment 12". Render the target in the
  claim. This is the never-claim rule at the display layer.
- Query time on that page was **9,048 ms**. Report where it goes and fix it if the cause is an index
  that is missing rather than a query that is inherently heavy.

---

## §2 — P1: THE PUBLIC REGISTERS

Three sources, each a small ingest of published data. **Take them in this order and stop when the
sprint is full — a half-built register with a reported coverage number is worth more than three
started.**

1. **APPG membership and funders.** All-Party Parliamentary Groups are voluntary cross-party groups;
   membership of a *funded* group is a clean soft prior on alignment. Published register.
2. **Electoral Commission donations.** Bulk public data. The signal is the *path* (member ← donor →
   sector), not a stance: direction 0, and it raises a prior rather than asserting a position.
3. **Companies House joins** against the 5,496 organisations already carrying a register number.

For each: signals per `POSITION_GRAPH_DESIGN.md` §3 — `evidence_ids` never empty, `observed_at` the
date of the event not the ingest, `derivation` naming the method and its version.

⚠ **Never merge two identities on similarity** (standing rule). Register data is full of near-matches
and this is exactly where a wrongly merged identity gets created — a person who does not exist,
holding contradictory views, with nothing visibly wrong. An unresolved name stays unresolved and is
counted in the report.

⚠ **Direction 0 means direction 0.** A donation is not a position. If the aggregation is tempted to
convert a funding path into a stance, that temptation is the thing this whole design exists to
resist; the confidence ceiling on direction-0 signal types (design §5) must hold, and a check must
assert it.

---

## §3 — THE VALIDATION SET: DRAFT IT, DO NOT SCORE IT

Design §8 makes a hand-labelled answer key the gate on any of this reaching a user. Draft it now so
Charlie can validate it in the same pass as the search gold questions.

- **~10 well-known contested matters** we actually hold divisions for — remembering the record starts
  March 2016, so choose accordingly (assisted dying, the 2019 and 2019-24 Brexit-related divisions,
  Rwanda/removals, smoking generational ban, and similar).
- **~10 actors each** whose public position is documented, with a citation for each — a published
  statement, a party position, a press report. **The citation is the point**: an answer key sourced
  from the same votes the graph uses would be circular and would measure nothing.
- Deliver as `docs/POSITION_VALIDATION_CANDIDATES.md`, numbered so Charlie can accept, reject or
  amend each in one line. **Score nothing.** A number scored against an unvalidated key is precisely
  the mistake the search stream spent two sprints undoing.

---

## §4 — HOUSEKEEPING FROM 3A'S OPEN DECISIONS

1. **Charlie's decision on the storage alert: do not delete estimate rows.** The 17.5 GB figure is a
   monitoring threshold inherited from a handoff note, and the real Neon ceiling is 16 TB — this is
   the same fiction that shaped a whole sprint's design once before. **Find where the 17.5 GB
   constant lives** (it is almost certainly ours, not Neon's — no Neon plan limit is 17.5 GB), and
   report the file and line rather than changing it: the replacement value must be our actual plan
   limit, which Charlie will confirm from the Neon console. Add the source and date-checked beside
   it, because a plan limit is a fact about a day.
2. **Charlie's decision on Bill-level aggregation: do not combine divisions on one Bill.** Voting for
   a Bill and against an amendment to it currently cancel out. Keep per-division estimates and expose
   the breakdown; the read API should let a caller ask about several divisions and receive them
   **separately labelled**, never summed.
3. **The two dataless signal types** stay printed by name on every run. Report what it would take to
   acquire amendment sponsorship — it is the highest-value missing P0 signal, because tabling a
   wrecking amendment is a stronger position statement than most votes.

---

## §5 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-graph-3b.sh`; additive migrations only; nothing owned by
  search, lex or ingest edited — report needed changes instead.
- Every check watched failing first; predictions logged before derivations run.
- Bytes before hypotheses; read signals back against source rows.
- **One sample is not a measurement** — 3A published a deploy claim from a single cache header and
  withdrew it four minutes later. Good discipline; keep it.
- **Report `docs/GRAPH_3B_REPORT.md`:** §1's distribution audit first, with what each figure is a
  percentage OF and what follows from it; then registers with coverage and identity-resolution
  exclusion rates; then what is NOT done, named; then numbered decisions for Charlie with a
  recommendation and the consequence of each option.
- Name exactly what Charlie should click, since Vercel is unreadable from your machine.
- Change-log and handoff entries labelled **GRAPH**.
