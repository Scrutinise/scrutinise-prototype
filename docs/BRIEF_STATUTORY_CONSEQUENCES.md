# BRIEF — Statutory Consequences: the fifth Deepening pass

**Thread:** LEX. **Written:** 27 August 2026.
**Spec:** `HANDOVER_lex_citation_pass.md`, with Charlie's §5 decisions answered below.
**Depends on:** Search/Graph's `citation_edge` table and `inbound()` / `inbound_summary()` — both
exist and are verified for the Acts layer.

**What this gives a user, and why it is worth building now:** when someone proposes changing an
existing law, we show them everything else in the statute book that refers to it — provision by
provision, with the literal words, and what each one would need. That turns a proposal from an
assertion into a costed piece of work. **Nobody surfaces this to a non-lawyer.** It is a named
requirement of the Starkey thesis sub-project and a headline feature for pilot testers.

---

## §0 — Run mode

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the rest into one report. **Stop only for** spend beyond §6's ceiling or a change of
scope. Shell per CLAUDE.md §22. Walk the signed-in site (the extension works; use text extraction, not
screenshots). Delivery verified per §20.

⚠ **Sequencing:** run **after 25-I**, or in parallel only with an explicit file-ownership split — this
touches `deepening-config.ts` and the panel, and 25-I is in the same package.

## §1 — Charlie's four decisions, answered

1. **Its own pass**, not folded into Legal. `passKey: STATUTORY_CONSEQUENCES`, alongside Evidence &
   Precedents, Legal, Financial and Political Risk. Distinct trigger, distinct output shape, and it
   skips cleanly for proposals that create new law without touching old law.
   ⚠ **Also carry to Search/Graph:** the cross-reference graph should appear as **its own listed graph**
   in the search-infrastructure taxonomy (`SEARCH_STRATEGY` §9), not folded into the citation/amendment
   row. *Report this as a message sent; do not edit their files.*
2. **Group first, drill down on request**, with the tail counted so nothing is hidden.
3. **Group before classify**, with the cost sized before committing (§6).
4. **Cache key includes the graph's coverage state**, so widened coverage forces a fresh run.

## §2 — The pipeline

1. **Resolve** the user's plain-language target to a legislation identifier — *"the Equality Act"* →
   `Equality Act 2010`. ⚠ **This can fail. When it does, ask; never guess.** A confidently wrong
   target produces a confidently wrong consequence list.
2. **Call `inbound()`** for each resolved target, at provision level where the user has been specific.
3. **Group** the returned references (§4).
4. **Classify each group** (§3).
5. **Present** with the coverage statement adjacent to the count, not after it (§5).

## §3 — What "classify" means

The graph returns a **fact**: *section 12 of the Housing Act 2004 contains the words "within the
meaning of section 3 of the Equality Act 2010."* That is a reference. It does not say what to do
about it.

**Classification is Lex reading the reference and saying what would have to happen to it if the target
changed.** Five dispositions, each with a one-line reason:

| disposition | meaning |
|---|---|
| **repeal** | this provision exists only to serve the target; if the target goes, it goes |
| **amend** | it needs rewording — typically a section number that would move |
| **save** | it must be preserved despite the change (transitional protection, accrued rights) |
| **replace** | it needs a substitute reference to whatever replaces the target |
| **no_action** | it mentions the target but nothing breaks |

⚠ **Charlie's question answered, and it is the reason classification matters:** repealing the Equality
Act does **not** mean all 1,868 references "need amending." Some become dead letters, some need a
substitute reference, some must be expressly saved, and some are untouched. **The count tells you the
scale; only the classification tells you the work.** A proposal that says "1,868 consequential
amendments" is wrong in a way that a select committee would find in a minute.

⚠ **Every disposition is traceable to the `citation_text` that produced it.** A disposition with no
visible source words is Lex putting confident prose on top of a verified fact and destroying its
verifiability — which is the one thing this graph exists to prevent.

## §4 — Grouping and the volume ceiling

The Equality Act returns **1,868** inbound references. A list of 1,868 rows is unreadable and
classifying them one by one is ruinous.

- **Group by what the reference does, not by which Act it sits in.** *"Eleven of these are the same
  borrowed definition"* is useful; an alphabetical list of statutes is not.
- **Classify the group**, then let the user open it to see the members.
- ⚠ **Count the tail explicitly.** *"Showing 14 groups covering 1,868 references"* — nothing is hidden
  and no number is quietly dropped.
- Where the graph offers `inbound_summary()`, prefer it over pulling every row.

## §5 — The coverage statement: mandatory, computed, never hardcoded

The graph is knowingly incomplete in named ways, and **Lex must say so every time, in plain words,
next to the count.**

Currently: **statutory instruments are not indexed**, so references from regulations made under Acts
are invisible; **93,772 act-name spans (6.6%) resolved to nothing** — mostly short forms like *"the
1998 Act"*; **case law coverage begins in 2001**.

> *"This list covers Acts of Parliament. It does not yet cover statutory instruments — the regulations
> made under Acts — so there will be further references we cannot see yet. Case law coverage begins in
> 2001; earlier judgments are not held."*

⚠ **Rendered from what `inbound()` reports about itself, never a fixed string.** A hardcoded caveat
goes stale silently — this project has already had a storage figure survive being retired twice
because it lived in a comment.

⚠ **Never present a count as complete.** 1,868 is *"1,868 that we found in the layers we have
searched"*, and it must read that way. **A gap that announces itself is better than a gap that looks
like an absence of evidence.**

*(Background, not a limitation to restate: legislation.gov.uk's own citation markup covers only 2–5%
of the cross-references actually in the text — 0% for CRaG 2010 — which is why the graph carries a
second text-based detector. The two are kept apart in `detection`. Do not quote the markup layer alone
as "the citations".)*

## §6 — Cost, and the re-run

- **Size it before committing.** Report the measured cost of a grouped classification on a large
  target before wiring it into every build. **Ceiling for this sprint: two live runs** — one small
  target, one large.
- ⚠ **It interacts with one-free-build pricing.** If a consequence pass on a large Act doubles a
  build's cost, that is a product decision for Charlie, not a default to set quietly. **Report the
  figure; do not choose.**
- **Re-runs reuse, like the research passes** — and ⚠ **the cache key includes the graph's coverage
  state.** Otherwise a user who re-runs after the SI layer lands gets the old, narrower answer with
  nothing telling them it changed.

## §7 — What not to do

- **Do not let Lex assert a consequence the graph did not return.** The graph's value is that every
  edge carries its source; prose that outruns the edges throws that away.
- **Do not compress 1,868 references into a confident paragraph.** Group and count; never summarise
  away the scale.
- **Do not surface this on the kernel pages.** It is research about a stated proposal, not part of
  stating one.
- **Do not filter `source_provision_ref IS NULL` silently.** Those 11.3% are Acts named in a title,
  long title or explanatory note — real references, but not provisions that break. **Separate them
  and say which is which**, rather than dropping them or mixing them in.

## §8 — Acceptance criteria

- The pass fires only when a proposal touches an existing enactment, and skips cleanly when it does
  not.
- An unresolvable target asks rather than guesses.
- References are grouped by what they do; each group carries a disposition and a one-line reason; the
  tail is counted.
- **Every disposition links to the citation text that produced it** — asserted by a check.
- The coverage statement renders from the graph's own report, adjacent to the count, and **a check
  fails if any coverage wording is a literal in the code.**
- No count is presented as complete.
- Title-only references are separated from provision references, not dropped.
- Two live runs reported: one small target, one large, with **measured cost** and the pricing
  implication stated, not decided.
- Re-run reuses, and a changed coverage state forces a fresh run — demonstrated.
- The graph-taxonomy message to Search/Graph is reported as sent.
