# HANDOVER — Citation graph → Lex standard pass

**Owner:** CC-Lex
**Depends on:** Search & Graph stream — `citation_edge` table and `inbound()` / `inbound_summary()`
**Status:** the graph exists and is verified for one layer. This brief is the integration design.
**Do not start building until §5's decisions are answered.**

---

## 1. What Lex gains

A new question Lex can now answer that it could not before:

> "You want to change section 3 of the Equality Act 2010. Forty-one other provisions across the
> statute book refer to it. Here they are, and here is what each one would need."

Plain terms: when a user proposes amending or repealing an existing law, we can now show them —
provision by provision, with the literal words and the source — everything else that breaks. That
turns a proposal from an assertion into a costed piece of work, which is the whole point of the
platform.

This is a real differentiator. Nobody else surfaces this to a non-lawyer.

---

## 2. Where it fits in the pass

The natural home is the **Deepening stage**, not the kernel pages. The kernel is where the user
establishes what they want and why; consequence analysis is research about an already-stated
proposal. Two candidate placements:

- **(a)** A fifth Deepening research pass — "Statutory Consequences" — alongside Evidence &
  Precedents, Legal, Financial and Political Risk.
- **(b)** Folded into the existing Legal pass.

Recommendation is **(a)**. It has a distinct trigger (does this proposal touch an existing enactment?),
a distinct output shape (a classified list, not prose), and a distinct failure mode (silent
incompleteness). Burying it inside Legal makes all three harder to see. It also lets the pass be
skipped cleanly for proposals that create new law without touching old law, which is a real fraction
of what users bring.

---

## 3. Trigger and pipeline

**Trigger:** the proposal names, or Lex resolves it to, one or more existing enactments. Include
provision-level targets where the user has been specific.

**Pipeline:**

1. Resolve the user's plain-language target to a legislation identifier. *"The Equality Act"* →
   `Equality Act 2010`. This is a resolution step and it can fail; when it does, ask, don't guess.
2. Call `inbound()` for each resolved target.
3. Classify each returned reference into a **disposition**: `repeal`, `amend`, `save`, `replace`,
   `no_action`, with a one-line reason.
4. Group by theme, not by source Act. The useful output is *"eleven of these are the same borrowed
   definition"*, not an alphabetical list of statutes.
5. Present the coverage statement (see §4) with the result, not after it.

**On step 3:** classification is a judgement, and Lex is the only component making one. Every
disposition must be traceable to the `citation_text` that produced it. A disposition with no visible
source text is exactly the failure this graph exists to prevent — Lex would be adding confident
prose on top of a verified fact and destroying its verifiability.

---

## 4. The coverage statement is mandatory and cannot be hardcoded

The graph is knowingly incomplete in named, quantified ways. As of today: statutory instruments are
not yet indexed; roughly 37% of pre-1963 Acts were not opened by the original extractor (magnitude of
effect being measured); 93,772 act-name references are unresolved; case law coverage, when that layer
lands, begins in 2001.

`inbound()` returns a coverage block alongside its rows. **Lex must render it, in plain words, every
time, adjacent to the count.** Never a static string in the prompt or the template — a hardcoded
caveat goes stale silently, which is how a stale storage figure survived being retired twice on this
project.

Wording principle: state what was searched and what was not, in the user's language.

> "This list covers Acts of Parliament. It does not yet cover statutory instruments — the
> regulations made under Acts — so there will be further references we cannot see yet. Case law
> coverage begins in 2001; earlier judgments are not held."

**Lex must never present a count as complete.** The number 29 is "29 that we found in the layers we
have searched", and it must read that way to the user. A gap that announces itself is better than a
gap that looks like an absence of evidence.

---

## 5. Decisions needed before building

1. **Placement** — fifth Deepening pass, or folded into Legal? Recommendation: fifth pass, for the
   reasons in §2.
2. **Volume ceiling.** The Equality Act returns 1,868 inbound references. That is unreadable and
   would be ruinous to classify one by one. Options: classify the top N by relevance and summarise
   the tail; classify by group and let the user open a group; or refuse to run at proposal level and
   require the user to narrow to a provision. Recommendation: **group first, drill down on request**,
   with an explicit count of what is in the tail so nothing is hidden.
3. **Cost.** Classification is a per-reference model call unless grouped first. On a 1,868-row target
   that is a material build cost and interacts with the one-free-build pricing model. Grouping before
   classifying is the lever; size it before committing.
4. **Re-run behaviour.** Consequence lists should reuse existing results the way research passes do.
   Confirm the cache key includes the graph's coverage state — otherwise a user who re-runs after the
   SI layer lands gets the old, narrower answer with no indication anything changed.

---

## 6. What not to do

- Do not let Lex assert a consequence the graph did not return. The graph's value is that every edge
  carries its source; prose that outruns the edges throws that away.
- Do not summarise 1,868 references into a confident paragraph. Group and count, don't compress.
- Do not surface this on the kernel pages. It is research about a stated proposal, not part of
  stating one.
