# BRIEF — SEARCH S5: LET LEX SEE THE WHOLE CORPUS

**Owner:** CC-Search, with a contract for CC-Lex in §4
**Stream:** SEARCH
**Written:** 17 August 2026
**Follows:** S4, which audited the problem and deliberately changed nothing.

**Where this sits:**
- *S4:* established that the Lex chat route searches legislation only, found three gates rather than
  one, and measured `LEX_TIER_FUSION` at +21.7pp recall
- **This: S5 — the fix S4 was forbidden from making**
- *Then:* batching (which this makes a prerequisite), then the deepening retrieval intents

---

## §0 — The problem in one paragraph

When a user talks to Lex about their idea, the search behind that conversation looks **only at
legislation**. Never at committee evidence, debates, case law or guidance. Ask Lex what select
committees have said about sewage and it returns seven Acts and four statutory instruments while the
corpus holds the actual committee report and cannot show it. Across seven test questions, **between
36 and 146 relevant non-legislation documents per question exist and are unreachable.**

**This is the largest gap between what the platform holds and what a user experiences.**

---

## §1 — There are three gates, and all three have to move

S4's most useful finding, and the reason this is not a one-line change:

1. **The tier filter.** The caller passes `tier: 'legislation'`.
2. **The type filter**, applied *after* it, keeping only three legislation display types. Measured:
   **it drops 24 of 36 results on every probe.**
3. **The response contract.** `LegacySearchResult` carries `actId`, `actTitle`, `sectionNumber`, and
   the chat route maps those into `legislationContext`. **There is nowhere to put a committee
   transcript.**

⚠ **Change gate 1 alone and the measurement shows no difference**, because gate 2 discards whatever
gate 1 admits. Anyone who widens the tier, sees nothing change, and concludes the scope was not the
problem will be wrong for a reason nothing in the logs would show them.

⚠ **Change gates 1 and 2 without gate 3 and it is worse than doing nothing**: a committee transcript
would reach Lex through a field called `actTitle` and be presented to the user **as a section of an
Act**. That is the never-claim rule broken in the most damaging place available.

---

## §2 — The fix: a second context channel

The Lex chat route needs **two** kinds of retrieved material, rendered differently and labelled
differently:

- **Legislation** — what the law says. Act title, section number, provision link. The existing
  channel, unchanged.
- **Everything else** — what was said, argued, decided or advised. Committee evidence, debates,
  divisions, case law, guidance, impact assessments, explanatory notes, consultations. Its own
  shape, its own rendering, its own block in the prompt.

Requirements:

- **A user must never be unable to tell which is which**, and neither must Lex. The same requirement
  that governed Holyrood versus Westminster and Bills versus Acts. Say what the rendered output
  reads as.
- **Route rather than widen.** The router already picks the right streams — S4 showed it choosing
  `committees` for a committee question and `debates` for a debate question, and the caller
  overruling it with a constant. **Stop overruling it.** That is the change: the chat route becomes
  a routed caller like the untiered surfaces already are.
- **The legislation panel keeps its scope.** S4 measured it and it is right. Widening it would be a
  regression dressed as a fix.

⚠ **Batching is now a prerequisite, not an optimisation.** Five streams per query against a service
that handles four at once means one user saturates it. **Do the batching in this sprint**, before or
alongside the widening, and measure the concurrency behaviour rather than assuming it.

---

## §3 — Measure it, before and after, on the same questions

This changes what users see on the platform's main surface, so it ships with a before-and-after or
not at all — the discipline the Scottish material, the bills and the tier-fusion flag all followed.

Report, for the same set of questions: what the answer says, what the source panel contains, and
latency at p50 and p95. ⚠ **Reverse the run order**, because a cache-warming artefact has already
misled one measurement in this project.

⚠ **Expect the answers to change substantially and do not treat that as a defect.** The point is
that Lex can now cite what committees said. Read a handful of the new answers by hand before
declaring it an improvement — more sources is not the same as a better answer.

---

## §4 — THE SEARCH CONTRACT FOR LEX

Charlie's instruction: *"make sure Lex stream knows how to access all and any search it wants and
what to do if anything it wants is not yet connected."*

**Write this as a document Lex's owner can read** — `docs/SEARCH_CONTRACT.md` — and keep it current.
It is a standing reference, not a note in a change log.

### It must state, in plain terms:

1. **What the corpus holds**, by kind rather than by internal collection name: legislation and the
   notes explaining it, what Parliament said and how it voted, what committees were told, what
   courts have decided, what regulators advise, what the government predicted and what it consulted
   on. **With rough sizes**, so a reader knows what to expect.
2. **What can be asked for today**, by intent — and what each returns.
3. **What cannot be asked for yet, named individually**, with what it would take. Today that
   includes: cross-domain mechanism analogues, contradiction retrieval, positions, and anything
   involving the open web.
4. **How to ask.** The one call, its parameters, and the fact that the router chooses the streams —
   so a caller does not have to.
5. **What each surface currently gets**, since they differ, and the differences have caused two
   sprints of confusion.

### ⚠ And the rule for when Lex wants something search cannot give

This is the part Charlie is really asking for, and it is a never-claim rule:

> **If Lex wants something and search cannot supply it, Lex says so plainly and specifically.**
>
> Not silence, not a vague deflection, and above all **not an answer composed from general knowledge
> presented as though it came from the corpus.**
>
> *"I looked for what select committees have said about this and I can't reach committee evidence
> from here yet"* is a good answer. It tells the user what exists, what is missing, and that
> somebody knows. *"I don't have information on that"* is a bad answer to the same situation,
> because it is indistinguishable from the corpus being empty.

⚠ **A gap that announces itself is a feature.** A gap that looks like an absence of evidence is the
single most damaging thing this platform can produce, because the user cannot tell the difference
and neither can we.

⚠ **And every unmet request should be logged.** V37's gap-filler expects exactly this signal:
what Lex looked for and could not get is the most direct evidence available about what the corpus
should hold next.

---

## §5 — Standing

- Thread labelling in the change log and handoff: **SEARCH**.
- Scoped commits by explicit path; three streams share this tree.
- **Nothing widens before it is measured**, and the measurement is reported whichever way it goes.
