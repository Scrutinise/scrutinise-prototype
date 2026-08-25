# BRIEF — Sprint 25-G: make it affordable, navigable, whole — and open the new door

**Thread:** LEX. **Written:** 25 August 2026.
**Source:** the second build of Charlie's accountability idea — 10/10 passes, 12m 10s, **33.4p**,
217,687 in / 49,111 out.

**Where we are.** 25-F worked. The pivotal obstacle is a real diagnosis (it names the constitutional
veto that has defeated every previous attempt); the guiding policy routes around that veto rather than
fighting it; the instrument fork moved from primary legislation to secondary; Carltona, Osmotherly,
Accounting Officer and SRO all surfaced, none of them supplied by the user; the corpus argued **back**
in four "cuts against the draft" findings; and the smart pass cut two of our own actions with the line
*"proposing both is a failure to choose."* **This sprint does not touch any of that.**

**What it does:** make the economics survive a pilot, make the two surfaces navigable, restore what
the new door lost, fix five presentation defects — **and then flip the cutover.**

Standing rules: audit-then-build; **`commit-lex-25g.sh`**; scoped paths; checks watched failing first;
clean-package build check before push; delivery verified per CLAUDE.md §20.

---

## §1 — Cost: the re-run must not cost what the first build costs

**33.4p a build is the constraint on everything.** At 1,000 pilot users a single free build each is
£330, and "run it again" at full price makes iteration unaffordable exactly when it is most valuable.

**1a. ⚠ A re-run reuses the research.** This is the largest single saving available and it is also
better product design. Passes 1 and 5 — orient and research — produced 340 and 500 sources. **Unless
the elicitation changed, they should not run again.** A re-run should re-run **drafting, revision, the
smart pass, verification and the clerk** over the *existing* evidence, and say so on screen:

> *Re-running from the research already gathered — 55 findings, 42 cited sources. Add new information
> above if you want me to search again.*

Expect roughly 12–15p against 33p. **Report the measured figure.**

**1b. A full re-search is an explicit choice**, offered separately and priced honestly:
*"Search again from scratch"* — used when the elicitation has materially changed.

**1c. Stop re-sending the same evidence.** 217,687 input tokens is where the money goes, and much of
it is the same corpus material handed to pass after pass. Audit what each pass actually needs and
**report the input-token reduction achieved.** ⚠ Do not do this by truncating evidence — the defect
25-F fixed was a pass being shown headings instead of findings, and this must not reintroduce it.

**1d. The smart pass is 17.8p of the 33.4p** and calls three models. It is worth the money — it
produced the best output in the build — so **do not cheapen it before 1a and 1c are measured.** If a
saving is still needed after those, report options rather than choosing.

## §2 — Navigation: there are now two surfaces and no way between them

The build screen (page 1, the drafted kernel, "what I make of it", run again) and the kernel/deepening
editing surface where the choices are actually made. Charlie: *"we need to make sure both are clearly
navigable."*

- **A persistent control moving between them, in both directions**, on every screen of each.
- **Each screen says which one it is** and what the other contains — *"The proposal — 23 fields, 10
  decisions waiting"* / *"The build — how this was made, and what I make of it."*
- **Returning to a built idea lands on the proposal**, not the build screen: the build is how it was
  made, the proposal is the work.
- The temporary previous-ideas panel stays until §5's findability lands.

## §3 — What the new door lost (A1–A7)

`docs/LEX_25F_CUTOVER.md` names eight things absent at `/ideas/build`. **CC's judgement is right and
adopted: these are built before the flag is flipped** — shipping a validation door without the control
that lets a user say it isn't working is the wrong way round.

1. **Feedback capture** — first, for the reason above.
2. **"How this works"** tour — restored from §19-D, adapted: four questions, a build, then a proposal.
3. **The first-idea modal and intro**, and **greeting by preferred name**.
4. **The FAQ link**, including *Reading legislation*.
5. **"Say the word"** — asking how it works opens the tour.
6. **Exit**, with the unsaved-draft prompt.
7. Anything else in the eight not covered above.

**Report anything deferred rather than built, and why.**

## §4 — Five presentation defects from the second build

**4a. The opening paragraph is printed twice**, verbatim.

**4b. "7 search queries issued" is followed by seven empty bullets.** Show the queries, or drop the
count — an empty list under a count is a claim with nothing behind it.

**4c. ⚠ The forks conflate different kinds.** The second "I chose" is a *pivotal obstacle*, the third a
*cause*, the fourth an *instrument* — all rendered identically as bare "I chose / instead of". **Label
each fork with what is being decided** ("The approach", "The pivotal obstacle", "The instrument"), and
group them. A user cannot make four decisions well if they cannot tell what each one is about.

**4d. Conditions for success is five sentences all opening "For this to work"** — a template showing
through. Vary, or render as a list.

**4e. Verdict WEAK, 3 of 9 kernel tests passed** (2 of 9 in the first build). Improving and honestly
reported. **Not a defect to suppress** — but check the six failures are reaching the user's list with
the specific text that failed, per 25-F §3a.

## §5 — Findability, carried from 25-F §7 and still open

Every build produces a **titled, listed idea**, linked from the build screen. Charlie could not find
his first build after logging out; ideas still show as "Untitled idea".

## §6 — The cutover

⚠ **Flip only when §1a, §2, §3 and §4 are done and Charlie has confirmed the rebuild reads well.**
Not before, and the ordering is not negotiable — §3 in particular exists so a user can tell us the new
door is broken.

- **Flip the `PlatformConfig` flag** so `/ideas/new` resolves to the build flow. No deploy required,
  and the revert is the same one-row change — which is why it was built this way.
- **Only the creation entry moves.** `?ideaId=` links, the editing surface and every returning-user
  path are untouched.
- **The old elicitation stays behind the flag.** Removing it is a later, separate commit, after the
  new door has served real ideas without incident.
- **Verify by reading the live site**: the front door resolves to the build flow, an existing idea
  still opens where it did, and the control asserting the flag's resolution passes both ways.
- **Watch the first real builds.** Report the first three: completion, cost, time, and any failed pass.

## §7 — Acceptance criteria

- A re-run reuses existing research, says so on screen, and **costs materially less — the figure is
  reported**; a full re-search is available as an explicit, separately-priced choice.
- Input tokens per build are reduced and the reduction is measured; **no pass receives a summary in
  place of findings.**
- Both surfaces carry a persistent route to the other; a returning user lands on the proposal.
- A1–A7 are present at the new door, feedback capture first; anything deferred is named.
- No duplicated paragraph; no count with an empty list beneath it; **every fork says what is being
  decided**; conditions for success does not repeat one opening five times.
- Builds produce titled, listed, linked ideas.
- The flag flips, `/ideas/new` resolves to the build flow on the live site, `?ideaId=` links are
  unaffected, and the revert is demonstrated once and then undone.
- Delivery verified per §20; the first three real builds reported.
