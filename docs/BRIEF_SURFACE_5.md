# BRIEF — SURFACE 5: CONNECT THE CROSS-REFERENCE GRAPH

**For:** CC-Surface (Lex-side work; coordinate, do not edit their files)
**Written:** 8 September 2026, by CCh-Search
**Executes:** step 1 of the citator path — *"if this changes, here is what points at it"*
**Reads first:** `CROSS_REFERENCE_GRAPH.md`, `GRAPH_4A_REPORT.md`, `GRAPH_4B_REPORT.md`
**Format:** audit-then-build. No git during the sprint; one **`commit-surface-5.sh`** at the end.
Scoped commits by explicit path.

---

## §0 — WHAT EXISTS, AND WHY NOBODY HAS SEEN IT

**1,225,806 cross-references** between pieces of law, hand-checked twenty out of twenty against
legislation.gov.uk, with a scale control that passes (a narrow recent Act does not outrank a broad
old one). **Every row quotes the words that make the reference** — required by the schema, because an
edge with no quotable source is a claim rather than a fact.

⚠ **Nothing under `scrutinise-web/` reads it. Every answer this graph has ever given was given to a
script.**

**This sprint builds no new capability.** If something here needs new extraction or new inference, it
belongs to `BRIEF_GRAPH_5.md`. Say so and move on.

**Why it matters to a user:** they propose changing a provision. Until now nobody could tell them what
else in the statute book points at it. **That list is the whole of a consequence analysis**, and it is
the thing a reformer cannot assemble by hand.

---

## §1 — THE PROBLEM NOBODY HAS SOLVED YET: 1,868 IS NOT A LIST

The Equality Act 2010 has **1,868 inbound references**. The Human Rights Act has 938. **You cannot
show a user 1,868 rows, and there is currently no ranking for them.**

⚠⚠ **Do not invent an importance score.** This project has twice produced a ranked list that was
really alphabetical and said "top 40" over it. **Audit first and report what ordering the data can
honestly support.** Candidates, strongest first:

1. **The kind of reference.** The graph already keeps three apart and they are genuinely different
   strengths of evidence:
   - **enabling** — *"this instrument was made under section 15"*. ⚠ **The strongest and the most
     consequential: an instrument that merely mentions an Act survives its repeal; one whose enabling
     power is repealed may fall with it.**
   - **markup** — the source document asserted the target itself. Strong.
   - **text** — we resolved an Act's name in running prose. ⚠ **The target is derived, not read, and
     must never be presented as though the document asserted it.**
2. **Whether the referring provision is itself still in force.** A reference from a repealed section
   is a weaker consequence than one from live law.
3. **Grouping by referring instrument** rather than listing every instance separately.

▶ **Report the ordering you recommend and what it rests on. If the honest answer is "these are not
rankable today", say so and group them instead** — and say that on screen, as the positions surface
now does.

---

## §2 — WHERE IT APPEARS

- **The Deepening's legal pass**, alongside the existing precedent and devolution blocks.
- **The printed output**, because a consequence list a user cannot take away is half a feature.
  ⚠ **On paper there are no clicks:** each reference carries its quoted words and its source in the
  document itself, or it does not go in.
- Report whether a legislation view should carry it too — **recommend, do not build a second surface
  in this sprint.**

---

## §3 — THE COVERAGE STATEMENT IS THE FEATURE, NOT THE FOOTNOTE

`inbound()` returns `{ rows, coverage }` and ⚠ **the signature is deliberate: a bare array lets a
caller present a short list as a complete one.**

**Render it, in ordinary words, wherever the rows appear.** Today it would say:

- amendment effects are held elsewhere and are **not joined here**;
- **case-law citations: not built** — a provision may have been read down by a court with nothing
  here to show it;
- **treaty obligations: not built** — a change may be prevented by an international obligation this
  graph cannot see;
- **21.8%** of references are not inside a provision (an Act named in a title or explanatory note —
  a real reference, but not a provision that breaks);
- **14.1%** of targets are instruments we hold no text for;
- **schedule coverage 8.6%** — ⚠ a scheduled agreement that was not ingested **presents as a short
  document, not as an error**;
- **77 identifier forms were refused** a bridge because they name more than one Act. ⚠ **A refusal is
  not an absence** and must not read as one.

⚠⚠ **Generated from live state on every call. Never a hardcoded sentence.** A check already fails the
graph's build if any string in its coverage module states a figure about the corpus — **do not
introduce one on the display side either.** This project has had one figure survive being retired
twice by living in a comment.

**Charlie's own wording is the test:** a count of 1,868 is *"1,868 that we found in the layers we
have searched"*, and **that sentence must come from what the graph reports about itself.**

---

## §4 — WHAT THIS SPRINT MUST NOT SAY

⚠⚠ **This is the most important section.**

- **Never "this is still good law" or "this is no longer good law".** Those are legal conclusions.
  The graph reports references and effects with citations; **the reader draws the conclusion.**
- **Never a total.** Every count is a count of what was found in the layers searched.
- **Never flatten the three kinds** into one number. They are different strengths of evidence and
  merging them produces a confident wrong answer, which is worse than a short one.

---

## §5 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-surface-5.sh`; nothing owned by Lex, graph or ingest
  edited — **report the exact change needed** so Charlie can relay it in one message.
- Every check watched failing against the real broken state; **every guard states what it counted.**
- **Report `docs/SURFACE_5_REPORT.md`:** §1's ordering recommendation first with its evidence. Then
  what a user now sees, **with a real worked example on one of Charlie's own ideas**, including the
  rendered coverage statement. Then what is NOT done, named. Decisions for Charlie as numbered
  questions with a recommendation and the consequence of each.
- ▶ Name the idea Charlie should open and what he should be able to click.
- Change-log and handoff entries labelled **SURFACE**.
