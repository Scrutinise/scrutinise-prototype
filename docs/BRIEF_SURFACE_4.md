# BRIEF — SURFACE 4: FINISH THE POSITIONS SURFACE AND GET IT INTO THE REPORT

**For:** CC-Surface / CC-Search (whichever is free)
**Written:** 4 September 2026, by CCh-Search
**Executes:** the open half of `SURFACE_3_REPORT.md`, plus Charlie's live observation on 4 September:
*"Key people and groups shows up a couple but you can't click through."*
**Reads first:** `SURFACE_3_REPORT.md`, `POSITION_SOURCE_FAMILIES.md`, `POSITION_GRAPH_DESIGN.md`
§6 and §8
**Format:** audit-then-build. No git during the sprint; one **`commit-surface-4.sh`** at the end.
Scoped commits by explicit path.

---

## §0 — WHERE THIS PICKS UP

SURFACE 3 found that `findClaimTarget` returned **no target on all twelve live ideas** — the
positions surface had rendered nothing for anybody, ever. Phrase matching fixed it: **45 of 84 ideas
now find a target, filed on 22 of Charlie's 47.** The coverage statement is live and generated on
every call.

**Charlie has now looked at it, and the surface is a dead end: a couple of names appear and there is
nothing to click.** ⚠ **A position without reachable evidence is exactly the thing this design forbids
in every other place** — the whole premise is that every line drills to a dated source. On screen the
evidence is one click away; **right now there is no click.**

**Two things remain outstanding and Charlie is relaying both to Lex:** the one-line `build.ts` change,
and the note that says positions have no producer, which is now false. **Do not edit Lex-owned files;
this sprint builds only what Surface owns and reports the rest.**

---

## §1 — MAKE EVERY POSITION DRILLABLE. THIS IS THE SPRINT.

**What a user must be able to do, in one click, from any name shown:** see **what that person or
organisation actually did** — the division or motion, its title, the date, which way they went, how
the signal was classified, and a link to the source.

⚠⚠ **This is not a new capability.** `positionsFor()` already returns the signal breakdown and the
evidence rows; the admin page has rendered them since GRAPH 3A; SURFACE 3 wired the surface itself.
**If this section turns into new retrieval or new inference, stop and report — it means the audit
found something other than a missing view.**

**Audit first, and report before building:**

1. What does the surface's own endpoint already return — the evidence rows, or only the summary?
   If the evidence is already in the payload, this is a rendering job. If it is dropped on the way,
   **print the line where it is lost.** ⚠ SURFACE 3's cause was exactly this shape one layer down:
   the matching chunk was found and then discarded by the line that assembled the result.
2. How many names does a typical idea show, and how many acts sit behind each? "A couple" may be
   correct — or may be a second filter doing the same thing the phrase-selection bug did.
   ⚠ **SURFACE 3 got that wrong twice, the same way both times: a ranking rule quietly acting as a
   filter.** Ask the question again here.

**Build:**

- Every actor row expands, or links, to its acts. **Nothing is shown that cannot be opened.**
- ⚠ **Keep the blind-judgement order LEX 25-L built**: the sourced record first, the user's own
  judgement, *then* our assessment — and our assessment is **absent from the payload**, not merely
  hidden in it, asserted by a control that plants a leak. **Do not weaken this to make drill-down
  simpler.**
- ⚠ **Use the shared confidence function** (`describeConfidence()`) for every word about certainty.
  Lex has ruled on this: one function everywhere. If each view picks its own adjectives, *"likely"*
  means different things on different pages and the confidence ceiling on direction-0 signals stops
  meaning anything.
- ⚠ **Fact and estimate are presented differently.** *"Voted against on 14 March 2019"* is a fact and
  carries no label. A stance score is an estimate never scored against a verified answer key and must
  say so. **Most of the value is in the first.**

---

## §2 — WHY 25 OF CHARLIE'S 47 IDEAS SHOW NOTHING

45 of 84 ideas find a target. **Establish, by probing, which of these the other 39 are** — and report
the counts, because the fix differs completely:

1. **No matching target exists.** The idea concerns something Parliament has not divided on since
   9 March 2016. ⚠ **This is a correct result and must be shown as one** — *"we hold no recorded
   division on this subject; our record begins 9 March 2016"* — never as an empty panel.
2. **A target exists and the phrase matcher missed it.** A search defect, fixable here.
3. **The idea is too abstract to name a concrete target at all.** ⚠ The graph holds positions toward
   **concrete things** — a division, a motion, an inquiry, an organisation — **never toward a topic**,
   by design. Say so on screen rather than appearing broken.

▶ **An empty panel is the failure mode this platform exists to avoid.** A gap that announces itself is
better than a gap that looks like an absence of evidence, and a user cannot tell "nobody holds a
position" from "we did not look".

---

## §3 — INTO THE PRINTED REPORT

Positions must reach the Output section of the idea. **The carrier is Lex's** (25-M §3) — coordinate,
do not build it in their files. Supply the shape and confirm it renders.

Each position in the document carries: **the actor** (name, party at the time, identifier); **the
target** (the concrete division, motion or bill, with title and date); **the stance, or the recorded
act with no stance**; **the confidence** as both a number and the shared function's words; **every
supporting act** — what, when, how classified, and its source; and **the config version and the date
it was computed**.

⚠⚠ **Two rules that are not bookkeeping:**

- **The document freezes; the graph does not.** Without the version and the date, the same report says
  different things to two readers and neither can tell. **Recommendation to Charlie: a published
  version keeps its original figures and offers a re-run — it never silently updates.**
- **On paper there are no clicks.** A position printed without its supporting acts is an attribution
  we cannot defend, and one wrong one costs more than the feature is worth. **The evidence goes in the
  document or the position does not.**

**The coverage statement appears twice** — once in the report, and again beside the positions. Lex has
ruled on this and the reason is right: *a reader who opens the report at the positions section must
not have to have read the front matter to know the record starts in 2016.*

---

## §4 — THE TWO THINGS SURFACE 3 LEFT, REPORTED NOT TAKEN

- **`DonationReview` has no route**, because every sensible parent is Lex-owned. **Report the exact
  route needed**; do not create one in their tree.
- **The one-line `build.ts` change** is with Lex via Charlie. **Confirm whether it has landed before
  assuming the carrier works**, and say in the report which it was.

---

## §5 — WHAT THIS SPRINT DOES NOT DO

- **No new signal types.** Companies House enrichment is SURFACE 3 §3 and is blocked on a key.
- **No new scoring.** Position estimates remain unvalidated; the 50 validation rows are still open,
  and nothing here changes what the graph believes.
- **No argument tags.** Measured as not working; **beta means unvalidated, not broken.**

---

## §6 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-surface-4.sh`; nothing owned by Lex, ingest, graph or the
  argument stream edited — report the change needed instead.
- Every check watched failing against the real broken state; **every guard states what it counted.**
- ⚠ **A redeploy is not a rebuild**, and a route returning 401 proves it was reached while a
  fabricated route returning 404 is the control that separates *deployed* from *looks deployed*.
  SURFACE 3 used exactly that pair — use it again.
- **Report `docs/SURFACE_4_REPORT.md`:** §1's audit first — was the evidence in the payload or dropped
  on the way. Then what a user now sees, in ordinary words, with a real example from one of Charlie's
  ideas. Then §2's three counts. Then what is NOT done, named. Decisions for Charlie as numbered
  questions with a recommendation and the consequence of each.
- ▶ **Name the idea Charlie should open and what he should be able to click**, since he is writing a
  report against this.
- Change-log and handoff entries labelled **SURFACE**.
