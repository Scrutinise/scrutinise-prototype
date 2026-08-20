# BRIEF — Sprint 25-C: the review agenda, and four defects that undermine it

**Spec:** `docs/LEX_REBUILD_DESIGN.md` §25.3, §25.5. **Thread:** LEX.
**Written:** 20 August 2026. **Incorporates:** `BRIEF_LEX_DEEPENING_FIXES.md` (CCh-Search) in full,
plus two orphaned corrections from CC-Ingest.

**The shape of this sprint.** 25-A drafts, 25-B researches and revises. **The user still has no
agenda** — they get a filled-in kernel and a long list of findings, and must work out for themselves
what to decide, what to read and what to answer. §25.3 is that agenda, and it is the piece that turns
a build into work the user can actually do.

But it goes second. **The four presentation defects in §2 come first**, because the agenda is a
presentation layer and building one on top of four presentation bugs means building it twice.

Standing rules: audit-then-build; no git during the sprint; **`commit-lex-25c.sh`** (per stream, per
sprint — two sessions raced on a shared `commit-all.sh` on 19 August); scoped commits by explicit
path; every check watched failing first; delivery verified per CLAUDE.md §20 before anything is
reported done.

---

## §1 — Two one-line corrections, first, before anything else

CC-Ingest recovered case titles and committee speaker names overnight and **reported rather than made**
two changes in Lex-owned files. No session owns them; they are ours. Both are small and both are
currently wrong on production.

**1a. `lib/lex/attribution.ts` — the absence note is now false.** `ATTRIBUTION_ABSENCE_NOTE` tells Lex
we hold no committee speaker names. **96.87% of committee evidence rows now carry attribution.** Left
alone, Lex disclaims names it is actually holding — the never-claim rule inverted, which is its own
kind of dishonesty. **Derive the note from a measured coverage figure rather than asserting a fact**,
so it cannot go stale a second time.

**1b. `lib/lex/corpus-type-map.ts` line 226 — add `'tna-caselaw'` to `TITLE_FROM_DB`.** Without it the
meaning-based half of search shows the recovered case name and the keyword half shows the literal
string `tna-caselaw`: **the same document under two titles in one result set.**

Both need a check, watched failing first.

## §2 — The four Deepening presentation defects

`BRIEF_LEX_DEEPENING_FIXES.md` is attached and authoritative; execute it in full. In summary, so this
brief stands alone:

- **§1 of that brief — the sift did not run**, and the pass said so honestly ("Reviewed 630 sources.
  The sift did not run…"). **Diagnose and report before fixing:** configuration, budget, or defect —
  the fix differs for each, and if it is a flag it is Charlie's flip, not code. Report separately
  whether the even 6/6/6/6 type split is a **cap applied before the sift** — because if it is, the
  sift can never choose the best 28 of 630, only the best within quotas someone else set, and that is
  a design question for Charlie rather than a fix to make unilaterally.
- **§2 — instructions to the model are on the user's screen.** Split the block into what the user
  reads and what the model is told, **at construction**, never by stripping text afterwards.
- **§3 — two different things wear the same badge.** A deterministically assembled precedent record
  and a model-written summary of one document have very different reliability and are labelled
  identically. Distinct labels, derived from the item's provenance field rather than set per call
  site. **Do not solve it by removing the model-written items** — they were useful.
- **§4 — the known-unknowns list repeats itself.** Collapse structurally on statement type plus
  subject, never by string similarity, and **assert losslessness**: every instrument named in the
  input appears in the output.

## §3 — 25-C: the review agenda

§25.3, and the point of the whole inverted design: the user's work is **deciding, reading and
answering**, not hunting through a filled-in form for what changed.

A new panel on a completed build, ordered by what most changes the proposal:

**3a. Decisions — the forks, presented as live choices.** 25-B records them (`BuildFork`, two
alternatives, the case for each, resolved flag). Render each as a genuine choice: what Lex chose, the
alternative, the case for each, and **Lex's recommendation with its reasoning shown**. Choosing
resolves the fork and marks it; **the record keeps both, because a proposal that shows what it
considered and set aside is stronger than one that looks inevitable.**

⚠ **The one that matters most is the instrument fork** — primary legislation vs regulations vs
guidance vs funding. 25-B reports that **a positive `EXISTING_POWER` finding has never yet moved a
real fork**, so this is where to check the wiring end to end rather than assume it: a finding that a
Minister can already act must visibly change the instrument decision, not sit in a findings list.

**3b. Contradictions — what the research changed.** 25-B's best output, and currently buried:

> *"I first concluded: primary legislation… The evidence says: regulations under an existing power may
> already reach this."*

That is the single most valuable sentence a build produces and it should lead the agenda, not appear
mid-list. Give contradictions their own section with the before, the after, and the evidence.

**3c. Challenges — the adversarial issues**, using the existing triage (address · assign · defer ·
dismiss-with-reason; dismissed stays visible). No new mechanism.

**3d. Reading — two or three sources, not a list.** Each with **one specific sentence on why this one
and what to look for**. Lex is firm about it: reading the primary material is where the user's
judgment enters and Lex's cannot substitute. ⚠ Everything else stays in the panel — **the agenda names
what matters, it does not reproduce the library.**

**3e. Gaps — the known unknowns**, post-§2 collapse, each marked as a research task, a question only
the user can answer, or an honest limitation.

**3f. Your contribution** — where the user's own knowledge (Page 1, "what you know that we won't
find") has been used, and where more of it would strengthen the case.

**And the framing, at the top of the agenda** — after the work, never before it (§19-E's placement
lesson):

> Everything above is mine until you've been through it. If this goes to an MP or a committee, you'll
> be asked to defend it — so where you disagree, or where I've put words in your mouth, change it.
> Where I'm wrong, that's the most useful thing you can tell me.

## §4 — Three corrections to the design, from 25-B's findings

**4a. `intent` is decorative, platform-wide.** 25-B found there is no `intent ===` branch anywhere in
`lib/lex` and the router is never handed the intent. **§25.4's table is wrong to imply intents drive
retrieval** — the lever is query text, and each library question's `terms()` builder is the part worth
thinking hardest about. Keep the three honest `retrievalStanding` states. **I will amend §25.4;
no code change is wanted from this note** — but do not reintroduce intent-as-routing on the strength
of the old table.

**4b. Multi-perspective is not authorised.** Its own measurement — 5.6p → 11.4p for 68 → 73 findings,
with the uniqueness figure inflated by a wording-blind dedup key — does not support the case I made in
§25/§7. **Leave it flag-gated and off.** The proper re-run, with the wording-proof denominator 25-B
added, is worth doing **once the model-reachability problem below is fixed**, because a comparison run
against a model roster we cannot fully reach is not the comparison we meant to run.

**4c. `gemini-2.5-pro` is unreachable through every Gemini caller** — it rejects `thinkingBudget: 0`,
which we set everywhere. **A capability we believed we had and did not.** Fix the callers so a model
that refuses the zero-thinking setting can still be used, and **add a check that every model named in
config is actually reachable**, so the next such gap announces itself. This is a precondition for 4b
and for the adversarial pass ever getting a stronger model.

## §5 — Acceptance criteria

- §1's two corrections are live, and the attribution note is derived from coverage rather than asserted.
- The sift's non-execution is diagnosed and the cause named; if it is a flag, Charlie is told which.
- No rendered evidence block contains instruction text; the check compares against the instruction
  constants, not a hand-written phrase list.
- The two precedent kinds are distinguishable at a glance, and the label derives from provenance.
- The unknowns list is collapsed, losslessly, with the losslessness check watched failing.
- A completed build shows an agenda with decisions, contradictions, challenges, reading, gaps and
  contribution — and **contradictions lead it.**
- Resolving a fork records the choice and keeps the alternative.
- **A positive `EXISTING_POWER` finding visibly changes the instrument fork, demonstrated on a real
  build** — not asserted.
- Every model named in config is reachable, proven by a check.
- Delivery verified: green Production deployment, a 25-C string read back off the live site, and a
  signed-in browser walk — or a plain statement of why not.
