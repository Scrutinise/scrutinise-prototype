# BRIEF — STAGE 2D SPRINT 3: WHAT DID THEY ACTUALLY SAY?

**Owner:** CC-Graph
**Stream:** GRAPH
**Written:** 16 August 2026
**Design:** `POSITION_GRAPH_DESIGN.md` + Amendments 1 and 2. **Read Amendment 2 first** — it changes
how identity is handled and this sprint is built on it.

**Where this sits:**
- *2D-1:* the entity spine — 86,816 actors, who gave evidence to which inquiry
- *2D-2:* 2.48M `voted` edges, 60k `signed-motion` edges, all fully evidenced
- **This: 2D-3 — what those actors actually argued, which is the point of the whole thing**
- *Then:* external registers, the web layer, the explorable graph

**Storage is no longer a constraint.** V38 measured the real Neon ceiling at 16 TiB against 0.10%
usage; the 17.5 GiB "line" 2D-2 designed around never existed. ⚠ That does not mean revisit the
views — views over 2.5M rows are cheaper and always current, and were the better design regardless.
It means **do not size anything in this sprint around space.**

---

## §0 — Two sprints in, the graph still records nothing anyone said

2D-1 and 2D-2 built who did what: gave evidence, voted, signed. Both were right to build the spine
first, and both deliberately declined to infer. But `holds-position` — the edge the design is named
for — **does not exist**, and without it there is no alignment, no supporters and opponents, and no
political-risk output.

**That edge is also the only thing in this project no general model can produce.** Everything else in
the platform is doing retrieval better. This is holding data nobody else holds. Charlie's judgement
is that it is the highest-demand and most distinctive thing available, and I agree.

**So this sprint is a pilot of position extraction, and everything else in it is support.**

---

## §1 — Positions, on ONE policy area, hand-scored

### The area

2D-1 §4 produced a ranked candidate table — organisations appearing across multiple inquiries,
weighted by contested participation. **Use it.** Pick the top-ranked area, state which and why, and
note the runner-up so the choice is auditable. The design's rule stands: **the data chooses the
area, not us.** A curated pick would be a political act.

### The proposition unit

Per the design's §2, the atom is a **proposition** — a specific contestable claim, not a topic.

> *"Section 21 no-fault eviction should be abolished."*

⚠ **Amendment 1 flagged the cheapest source and it is worth using here:** an early day motion's text
is usually a single compound proposition, already written by a parliamentarian, already dated. If
the chosen area has EDMs, they are a better starting vocabulary than anything we could generate —
and we hold 60,737 of them.

Otherwise, derive candidate propositions from the recurring contested claims in the area's committee
evidence. **Report the propositions before extracting positions against them**, so the vocabulary is
inspectable before it is used.

### The extraction

For each submission in the area: does it take a position on each proposition, and which way?

- `holds-position`, with polarity **for / against / balanced** and — non-negotiable — **the extract
  that supports it**, per §5.1. A position without its passage is a claim we cannot show working for.
- Date it. §5.2's changed-position rule depends on it.
- ⚠ **"No position" is an output, not a gap** (§5.4). An organisation that submitted and did not
  address a proposition has not tacitly agreed with it.

### The cost, priced before spent

**This is the graph's first real LLM spend.** 2D-1 and 2D-2 cost nothing because everything was
already structured. Predict the cost in `CHANGE_LOG` before running anything, run a bounded pilot
first, and score the prediction after — the discipline V35 and V36 both followed.

### The acceptance test, and it is not a count

**Read fifty extracted positions by hand against their source passages and report the error rate.**

⚠ **Do not report an extraction rate as an accuracy rate.** "We extracted 4,000 positions" says
nothing about whether they are right, and this is the first thing in the graph where the machine is
*interpreting* rather than *joining*. Both prior sprints earned their trust by reading real records
by hand; this one needs it more, not less.

Where the model was wrong, **classify how**: polarity flipped, position invented, nuance flattened,
representative capacity misread. The failure shapes decide whether this generalises.

---

## §2 — Organisation identity: Companies House and the Charity Commission

The largest single improvement available to the organisation half, and organisations are the half
that matters most (Amendment 2 §6).

- Match organisations to Companies House numbers and Charity Commission registrations. Both are open
  and both give a **stable key** where we currently have a name.
- ⚠ **When in doubt, do not merge** — unchanged from 2D-1, and it matters more once positions are
  attached. A wrongly merged pair of bodies now holds *contradictory positions*, which is exactly
  the composite actor Amendment 2 §1 rules out.
- Report the resolution rate, and **report merges and splits separately.**

⚠ **Do not fold this into §1's numbers.** Two things improving at once is two things you cannot
attribute.

---

## §3 — The mention layer

Amendment 2 §1: a mention can always be displayed; an entity is a claim that several mentions are
the same actor.

Make mentions first-class, so a name in a document with a position and a source can be surfaced
without an entity behind it. **The display is Lex's work, not yours** — what this sprint owes is a
queryable mention that carries its own confidence tier.

Three tiers, per Amendment 2 §3: stable key · corroborated name match · mention only.

---

## §4 — Behavioural split detection: flag, do not act

Amendment 2 §2, and it is free — the positions are the graph's own content once §1 lands.

Where a name-matched cluster holds **contradictory positions across the same propositions**, flag it
for review with the evidence attached.

⚠ **A flag, never a split.** One person changing their mind is a finding the design protects (§5.2),
and it looks identical from here. Report the count and the cases; resolve none of them.

⚠ **And never merge on behavioural similarity.** Two people who agree about everything are still two
people. That is how a composite actor gets built.

---

## §5 — What "done" looks like

- The chosen area, with the ranking that chose it
- The propositions, inspectable
- `holds-position` edges with 100% evidence coverage, as every prior sprint achieved
- **The hand-scored error rate over fifty positions, with failures classified by type**
- Organisation resolution rate, merges and splits separate
- Mentions queryable with their confidence tier
- Behavioural flags counted, none acted on
- Predicted versus actual cost

⚠ **Nothing here goes in front of a user this sprint.** Positions are an inference and this is the
first time we are making one. It gets read by hand before it gets shown.

---

## Working rules

Unchanged, and one of them is now load-bearing rather than hygienic: **an inference must not travel
as a measurement.** Every prior sprint applied that to its own tooling. This sprint applies it to
the product — a position is an inference, and the whole design rests on it being labelled as one.
