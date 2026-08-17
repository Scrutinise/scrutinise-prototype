# BRIEF — GRAPH 2D-4: MAKE THE POSITIONS TRUSTWORTHY, AND THE PEOPLE FINDABLE

**Owner:** CC-Graph
**Stream:** GRAPH
**Written:** 17 August 2026
**Follows:** 2D-3 — 16,196 positions extracted, 5,496 organisations keyed, and a hand-score of 54%
wrong or partly wrong that stopped the sprint at exactly the right place.

**Where this sits:**
- *2D-1/2D-2:* the spine, then 2.5M vote edges and 60k sponsor edges — all factual, all evidenced
- *2D-3:* the first inference. It works, and it is not yet good enough to show anyone.
- **This: 2D-4 — get the error rate down, and give people a real identity source**
- *Then:* the remaining registers, then the explorable graph

**Two independent halves.** §1 and §2 share nothing. Do them in either order, or both.

---

## §1 — The positions are over-attributed, not misread

2D-3's failure table is more useful than its headline, and it points at a cheap fix.

| shape | count | what it means |
|---|---:|---|
| `position-invented` | 12 | the submission does not address this claim at all |
| `nuance-flattened` | 11 | a qualified position recorded as a plain one |
| `proposition-mismatch` | 2 | matched to the wrong claim |
| **`polarity-flipped`** | **2** | **the direction was wrong** |

**When the model says a submission addresses a claim, the direction is nearly always right.** It just
says so far too often — 81.7% "for" against 13.7% "against", which is the distribution of a model
that will not decline.

**So this is a threshold problem, not a comprehension problem.** That is a much cheaper thing to be
wrong about.

### What to try, one variable at a time

1. **Make "no position" the default and require a higher bar to leave it.** State plainly in the
   prompt that most submissions do not address most propositions, and that saying so is the correct
   answer rather than a failure to find something.
2. **Give `nuance-flattened` somewhere to go.** Eleven of fifty failures are a qualified position
   recorded as a plain one — *"supports, provided funding follows"* stored as *"supports"*. A
   `qualified` polarity alongside for/against/balanced, or a required condition field, would convert
   most of those from wrong to right.
3. **Re-score the SAME fifty.** Not a new fifty — the same ones, so the comparison is a comparison.

⚠ **One change at a time, re-scored after each.** Two at once and neither is attributable — and 2D-3
was right that replacing a measured 54% with an unmeasured number is not an improvement.

⚠ **Watch for the opposite failure.** A threshold that stops over-attributing can start
under-attributing, and a "no position" that should have been "against" is invisible in a hand-score
of extracted positions. **Score a sample of submissions the model declined**, not only the ones it
accepted.

### The two failures the verbatim check cannot catch

2D-3 found one extract drawn from a document's **bibliography** and another from **the submitter
introducing itself**. Both genuinely present, both worthless as evidence of a position. Worth a
cheap rule — a passage from the first or last few hundred words of a submission, or one matching a
citation shape, is suspect — but **report the rule's own false-positive rate before applying it.**

---

## §2 — People: a real tenure source

94.6% of people rest on a name match. Charlie's instruction stands and Amendment 2 delivers it —
**every name is kept and displayed regardless** — so this is about making the graph *better*, not
about unblocking anything.

2D-3 established why office-by-date did not work: `graph_member_name`'s windows record **when a name
form was carried, not when an office was held.** Only 1 of 6,512 surfaces qualified, at 63.8%
accuracy. That was the right call and the mechanism still needs a source that actually states tenure.

### In priority order

1. **Ministerial appointments.** Parliament publishes them with dates. **The highest value by a
   distance** — *"the Minister for X"* appears constantly in committee evidence and in Hansard, and
   the office is held by exactly one person at a time. Verify the feed exists and carries start and
   end dates before designing anything on it.
2. **Company officers.** Companies House holds appointment and resignation dates, and arrives free
   with the register work 2D-3 already did.
3. **Peerages.** Charlie's point: a life peer runs from ennoblement to death, a hereditary peer from
   inheritance to death, and the son is Lord Stanley until he becomes the 19th Earl of Derby. All
   public, all dated. ⚠ **Establish the source before assuming it** — the Members API's Lords data
   may carry only entry to the House rather than creation of the peerage, which are different dates.

### Two rules that apply to all three

⚠ **A title is the identifying part of a name, and stripping it is a bug.** "Lord Sharma" and
"Mr Virendra Sharma" are two people who both normalise to `sharma`, and they agree on 5.4% of 868
divisions. 2D-2 recovered 97 peers by keeping titles rather than discarding them as honorifics; the
same applies wherever a title distinguishes.

⚠ **Give it its own `key_source`** — `office-by-date`, or similar. It is a temporal lookup against a
register that asserts the succession, **not** a name match, and it should carry a confidence that
says so. Recording it as a name match would understate it; recording it as a stable key would
overstate it.

### The test case, before trusting the mechanism

**MNIS 3296** — a Lord Archbishop of Canterbury record covering 1991–2002 that casts **zero votes**,
while 310 Bishops' votes exist in that window under other records. And 2D-3 found **five separate
MNIS records** for "archbishop of canterbury", one with no start date at all.

**If office-by-date attributes those votes to the wrong Archbishop, that is a fabricated voting
record for a named person.** Run the mechanism against this case first and report what it does.

---

## §3 — Small, carried from 2D-2

**Three of the 788 name matches stand on a surface the register itself says is shared** —
`Mr George`, `Robinson`. Coin flips recorded at 0.9 confidence. A rule refusing a match on a
register-ambiguous surface is a few lines and removes a known-wrong claim.

---

## §4 — What "done" looks like

- The re-scored error rate on the **same** fifty, one change at a time, each attributable
- A sample of declined submissions scored, so the opposite failure is visible
- Whichever tenure source proved out, with the MNIS 3296 case reported
- Resolution rate, merges and splits reported separately as always
- ⚠ **Still nothing user-facing.** Positions go in front of someone when the error rate justifies it,
  and 54% does not.

---

## Working rules

Unchanged. The one governing this sprint: **an inference must not travel as a measurement.** A
position is an inference; a vote is a fact; an office-by-date resolution is somewhere between and
must say which.
