# BRIEF — Sprint 25-D / 20-E: the panel by question, documents, and finishing §20

**Spec:** `docs/LEX_REBUILD_DESIGN.md` §25.5, §25.6, §20.1, §20.2. **Thread:** LEX.
**Written:** 21 August 2026.

**This completes §25 and finishes §20.** After it, the inverted flow is whole: four questions in, a
researched and revised proposal out, an agenda to work through, a panel organised by question, the
user's own documents folded in, and a publishable artefact with an evidence annex.

**Sections are ordered by value and must be done in order.** §1 and §2 are small. §3 is the bulk.
**If §5 is not reachable inside a sensible sprint, stop after §4 and report** — a half-built Evidence
Pack is worse than a scaffolded one, which is the judgement 20-B/D already made correctly.

Standing rules: audit-then-build; no git during the sprint; **`commit-lex-25d.sh`**; scoped commits by
explicit path; every check watched failing first; delivery verified per CLAUDE.md §20.

---

## §1 — Three model-registry fixes (small, carried over from 25-C)

**1a. Drop `grok-4.20-multi-agent-0309` from `REACHABLE`.** Charlie's decision. Multi-vendor is not
authorised, nothing depends on this entry, and a specialised multi-agent endpoint is exactly the shape
that invites the failure we have already had from this vendor once — **a provider silently
substituting a different model for the one requested.** Keep xAI as a vendor if the standard model is
reachable.

**1b. `claude-sonnet-5` rejects `temperature` with a hard 400.** Make sampling parameters
**per-model**, the same way `thinkingBudget` had to become per-model for `gemini-2.5-pro`. A model
that refuses a parameter must still be usable, not quietly unusable.

**1c. ⚠ The reachability check certified a model on which every real call would have failed** — it
passed for `claude-sonnet-5` while the structured call 400s. It tested that the door opens, not that
you can walk through it. **The check must make a representative call**: same structured-output mode,
same parameters, same shape as production actually uses. `// A ping is not a call. A check that
certifies an unusable model is worse than no check, because it is trusted.`

## §2 — Two things 20-B/D reported and nobody owns

**2a. Sources need an `excluded` state.** §20.2.1 requires it, no such state exists, and **the
Evidence Pack is blocked on it** (§5). A source the user considered and set aside must remain in the
record as *excluded, with a reason* — never deleted. Showing what was considered and rejected is a
strength; silently dropping it is the opposite.

**2b. Curation merges into the agenda — the decision, with one addition.** 20-B/D recommends merging
and is right; §25.3 item 9 already says the claims check belongs in the agenda. **So do not build a
separate curation surface.**

⚠ **But 20-B/D found the one thing the merge does not cover, and it is a real distinction: the agenda
is per-idea and continuous; a published version is per-artefact and frozen.** So **publishing pins the
agenda's outstanding items into the version** — the open issues, the unresolved forks, the declared
gaps, as they stood at that moment. That is what makes §24's *"12 of 14 findings resolved since"*
computable rather than asserted, and it means a recipient sees what the author knew was unfinished.

## §3 — 25-D: the right-hand panel, organised by question

**The change:** "primary legislation / debates / committee reports" is our filing system. The user
needs the answer to a question. Panel headings become the interrogation library (§25.5):

*What the law says now · How the courts have read it · What was tried before — and what happened ·
Where this mechanism works elsewhere · Who has argued about this · Who has taken a position ·
The numbers · What's devolved · The strongest case against · Your material*

**Four rules, all of which matter more than the reordering itself:**

1. ⚠ **A heading with nothing under it renders as a stated gap, not as absent.** *"We looked for how
   the courts have read this and found nothing"* is a finding. An absent heading is indistinguishable
   from a question never asked, and that is the difference between honest and merely quiet.
2. **Every entry carries one sentence of why it matters** — specific, or it is decoration.
   *"Read paragraphs 14–19: the only place a committee has tested whether an official can be named."*
3. **The panel follows what the user is reviewing.** Reading the diagnosis shows the diagnosis's
   evidence. Prior stages fold, as they do today.
4. **The full source list stays, collapsed, underneath.** The headings name what matters; they do not
   hide the rest.

**Do not lose what exists.** The panel already renders stage searches, the briefing and the Deepening
passes. This is a reorganisation of the same material against question headings, not a new panel —
**report what you mapped and anything that had no home**, because a source with no heading is a gap in
the library, not a source to drop.

## §4 — 25-D: documents and links (§25.6)

The user brings their own material. Page 1 already captures the *intent* to; this makes it real.

- **Both files and URLs.** A link is fetched, extracted, stored as text with the link retained.
- ⚠ **Store the extracted text, never the binary.** ~30KB a document; storage is not the constraint,
  token cost and liability are. No video; images only where OCR yields text; a per-idea cap.
- ⚠ **Never inject a document wholesale into a prompt.** On ingest, run the Deepening's pass shape:
  read it, produce **findings with provenance**, store them in the evidence layer. The document
  becomes a per-idea evidence source retrieved when relevant — so a fifty-page report costs nothing
  per turn and still surfaces its one useful paragraph at the right moment.
- Findings from a user document appear in the panel **under the question they answer**, alongside
  corpus material, and are visibly marked as the user's own source.
- **Deleted with the idea** (GDPR erasure). Private to the idea and its team.

## §5 — 20-E: the Evidence Pack and the Online View *(stop here if the sprint is long)*

Both were deliberately scaffolded by 20-B/D with their snapshot inputs defined. Build them over the
existing snapshot; **no renderer reads idea state directly.**

**5a. The Evidence Pack.** Every source cited, grouped by the question it answers (§3's headings);
the cost basis and assumptions, marked default or overridden; the ruled-out alternatives with reasons;
**the excluded sources with reasons** (§2a); and the declared gaps. This is the document that survives
scrutiny, and 20-B/D's framing is the right one: *an MP's office can hand over a proposal; the annex
is what survives being checked.*

**5b. The Online View.** The same content as a web page, corpus links live, respecting the visibility
state. `/proposals/[token]` currently resolves a link and says so honestly; this makes it the real
thing. ⚠ **Pinned to the published version**, so a recipient's link does not shift while the author
keeps editing.

## §6 — Acceptance criteria

- The three model fixes are live; the reachability check makes a representative structured call and
  was watched failing against `claude-sonnet-5` before being fixed.
- A source can be excluded with a reason and remains visible as excluded.
- Publishing pins the agenda's outstanding items into the version; a later change does not alter what
  was pinned.
- The panel renders by question; **a fired question with no results shows a stated gap**; every entry
  has a specific reason line; the mapping report names anything with no home.
- A document and a link can both be added; neither appears wholesale in a prompt; findings from them
  appear under the right question, marked as the user's source; deleting the idea deletes the text.
- *(if reached)* Evidence Pack renders with excluded sources and gaps; the Online View is pinned to
  its version.
- `check:committed` clean; delivery verified per §20, with any unverifiable check labelled as an
  inference rather than a measurement — as 25-C and 20-B/D both correctly did.
