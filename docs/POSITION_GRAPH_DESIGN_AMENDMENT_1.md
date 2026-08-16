# AMENDMENT 1 to POSITION_GRAPH_DESIGN.md — §3, the observed edge list

**Written:** 11 August 2026
**File with:** `docs/POSITION_GRAPH_DESIGN.md`. Fold into §3 when that document is next edited.
**Why this exists:** CC-Search deferred `early-day-motions` (60,737 sections) and `petitions`
(49,529) to the position graph on 10 August, citing this design's §3 — and §3 does not name an edge
either of them produces. The deferral is sound and the destination is real; the design was
incomplete. Flagging it rather than assuming it was an oversight was the right call, and it was
mine to fix.

---

## 1. Early day motions produce an observed edge, and it belongs near the top

Add to §3's **observed** list:

- `signed-motion` — **person → motion**, with the date of signature. Source: the EDM register.

An EDM is a motion an MP signs to put a position on the record. Nobody signs one by accident and
nobody signs one on someone else's behalf. That makes it the **highest-confidence position signal
available anywhere in this design** — higher than a committee submission, which is often an
organisation's institutional line rather than an individual's, and far higher than anything inferred
from a speech.

Two consequences worth stating so they are not rediscovered later:

- **The motion is the proposition, or very nearly.** An EDM's text is usually a single compound
  claim — "That this House notes X, believes Y, and calls on the Government to Z." That is closer to
  the proposition unit of §2 than any other source we hold, and it may make EDMs the cheapest place
  to *bootstrap* the proposition set rather than merely a place to attach positions to one.
- **A signature is dated and never withdrawn in the record**, so signature order over time is
  visible. Who signed first and who joined later is a coalition-formation signal that costs nothing
  extra to capture, and the §5.2 rule about never collapsing a changed view applies directly.

⚠ Do **not** treat non-signature as opposition. The overwhelming majority of members never sign any
given motion, for reasons that include never having seen it. §5.4 applies without exception: silence
is silence.

---

## 2. Petitions are a different shape, and the difference matters

Add to §3, but **not** to the observed *actor* edge list — as its own note:

- `petition-support` — **proposition → signature count**, with date and, where published,
  constituency breakdown. **No named individuals.**

Petition signatures are anonymous. There is no actor edge to be had, and anyone starting from the
EDM design will look for one and find nothing. What a petition gives is **public salience attached
to a proposition** — how many people cared, when, and where — which is a genuinely useful column
beside the actor positions but is not the same kind of fact and must not be rendered as one.

The constituency breakdown, where published, is the exception worth capturing: it permits the
statement *"this proposition drew above-average support in your constituency"*, which is factual,
neutral, and directly useful to someone deciding how to approach their own MP.

⚠ **Petition volume is not evidence that a proposition is right.** It is evidence that people
signed. The rendering must never blur the two, and a large count next to a small one is a
salience comparison, not an argument.

---

## 3. The general rule this exposed

The seam appeared because a collection was routed to a destination before the destination had a
place to put it. Worth making standing:

**A collection may only be deferred to the graph against a named edge type.** If no edge type in §3
consumes it, either the edge is missing from the design — as here — or the deferral is wrong. Naming
the edge is what makes "deferred" a decision rather than a shelf.
