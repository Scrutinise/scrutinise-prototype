# §19-D — Sprint 3-D: fixes from the 10 Aug full walk-through

**Context.** Charlie walked the complete flow end to end for the first time — corpus chat, legislation guide,
feedback, export, and all four kernel pages. **Much of it worked**: the background briefing is dramatically
better and downloads cleanly, Exit and Edit behave, feedback emails arrive, costing captures fine, the corpus
chat retains context and links through to source documents, and Lex proposed a good pivotal obstacle.

The findings below are what didn't. They are grouped by severity, and **Task 1 is the most important thing in
this brief** — it is a logic defect at the root of the method, not a UI bug.

Production (Main auto-deploys). Usual git discipline; scoped paths; browser-verify anything with UI before
reporting done. Record in `LEX_PLAYBOOK.md`.

---

## Task 1 — The problem gate (the headline finding)

**What happened:** Charlie entered *"I want to change the amount charged for plastic bags in shops"* — which
is a **solution**, not a problem — and Lex accepted it and carried on. His words: *"Without a problem we can
have no strategy and the whole logical structure breaks down. At the moment I can put anything in and it's
accepted, and none of it makes sense."*

This is Rumelt failing at the root: a diagnosis that never names a problem cannot produce a guiding policy,
and everything downstream inherits the incoherence.

**1a. Rename the field.** `challenge` → **"The problem"** everywhere it is user-visible (label, hints, Lex's
prompts, the document render). Keep the stored key as-is if a migration would be disruptive, but the user
must never see the word "Challenge" again. *A vague label invites a vague answer.*

**1b. Lex must press for a problem, and not accept a solution in its place.** Extend the method layer
(`method.ts`, M-DIAGNOSIS) so Lex tests the answer before accepting it:

- Is this stated as a **problem** (something wrong in the world) or as a **solution** (a thing to do)?
- If it is a solution: *do not reject it* — ask what problem it solves, and propose the problem statement
  back. "Change the charge for plastic bags" → *"What's going wrong that a change in the charge would fix?
  Is the problem that too many bags are used, that the current charge is too low to change behaviour, or
  something else?"*
- Only accept once there is a statement of what is wrong, for whom, and why it matters.
- **At most two presses, then accept what the user gives and note it** — Lex guides, it does not gatekeep.
  A user who insists is allowed to proceed; the deepening stage will return to it.

`// Every downstream stage inherits this field. A solution entered here makes the whole kernel incoherent.`

## Task 2 — Never-claim violations (three live instances)

The §19-C invariant is being broken in the conductor and the panel. Each is Lex asserting something the state
does not support:

**2a.** The middle panel showed **"Proposed by Lex"** on the legal-landscape field when **nothing was
proposed**. The badge must render only when a proposal actually exists.

**2b.** On Guiding Policy the panel said *"I'll seed a few candidate approaches per material cause with the
case for and against"* — **and then seeded none.** Either seed them, or say what actually happened. Diagnose
first (`[lex-diag]`): did `generatePolicyOptions` run and return empty, fail, or never fire?

**2c.** **Anticipated responses** left "enforcement burden" and "legal challenge" empty. Charlie's point:
*"Lex is best placed to fill these in."* These should arrive as Lex proposals for the user to sharpen, not as
blank boxes.

Add a check that fails if a UI "proposed" affordance can render without a corresponding proposal in state.

## Task 3 — You cannot go back (blocks the whole deepening stage)

**What happened:** after moving to Guiding Policy, Charlie could not return to add causes. The middle panel
lets him edit and remove them, **but the chat doesn't follow** — Lex stays on the current stage. Likewise he
could not go back to add or edit Coherent Actions, which meant **the coherence check could not be tested at
all**.

The flow is currently one-way. That was tolerable for a first build; it is not tolerable now, because
**deepening is inherently iterative** — its entire purpose is to send the user back into earlier stages with
new evidence.

**Required:** the user can re-enter any completed stage. Clicking a completed stage in the middle panel moves
the working context there — Lex picks up that stage's conversation, the right-hand panel shows that stage's
search, and edits go through the normal save path. Moving back does not discard later work. `stageSearches`
already stores per-stage results, so the panel side is largely wiring.

## Task 4 — The right-hand panel reverts to the briefing on Guiding Policy

Entering Guiding Policy, the panel **went back to the Initial Background** instead of showing the
`POLICY_ALTERNATIVES` stage search. Diagnose whether the search fired and stored nothing, or fired and the
panel didn't read it. §19-C Task 2 requires prior stages to fold and the active stage's results to show.

## Task 5 — Legislation links are broken

In the background panel, links under **"Possibly relevant legislation" do not work.** Debates, committee
reports and "anything else relevant" **all work.** So it is specific to the legislation tier's URL
construction. This matters more than the others — legislation is the point.

## Task 6 — The feedback scrub leaves names in

Email addresses were stripped; **the name was not.** The deterministic scrub is meant to remove the user's own
name and the model pass is meant to catch third-party names. Diagnose which layer let it through, then fix
and add a check with a name in the input.

## Task 7 — The cost summary is wrong

An enforcement cost rendered as **"£57/year"**, which cannot be right for the inputs given. Trace the
aggregation: is it a unit/scale error (thousands vs units), a price-year uprating error, or a per-line figure
being shown as a total? Add a check with known inputs and an expected total.

## Task 8 — Seeded causes aren't causes

The three causes Lex seeded **came from the corpus (good)** but were **not parsed or expressed as causes of
the stated problem** — they read as topic fragments. Charlie's two logic tests, which should be applied
before a seeded cause is offered:

1. Is the idea actually expressed as a problem? *(Task 1 handles this upstream.)*
2. Does this candidate have a plausible **causal** relationship to that problem — would removing it reduce
   the problem?

A corpus hit that fails test 2 is a *related document*, not a cause. Either express it as a cause in Lex's
own words with the source attached, or don't offer it.

## Task 9 — Smaller items

- **9a. "Save & exit" doesn't exit.** It may save, but the user stays on the page and had to press Discard to
  leave; ~5-second pause. Fix, and make the pause show a spinner.
- **9b. Team roles:** delete **"Communications"** and **"Policy Development"** from the Team page unless
  there is a reason to keep them. Charlie's view: these sound like permissions to grant after inviting
  someone, not roles to pick from. *(Note: §22.4 specifies the role model — Owner / Editor / Reviewer /
  Contributor. Align with that when the team feature is next touched.)*
- **9c. FAQ:** give **"Reading legislation"** its own section in the FAQ list, placed **after "What's scrutiny
  and why does it matter?"** It is currently not discoverable from the FAQ page.
- **9d. FAQ text amendment**, verbatim. Replace the answer to *"Can Scrutinise staff read my work?"* with:

  > Administrators have access for moderation (investigating reports of abuse) and support purposes (at your
  > specific invitation). This is managed through transparency. Every time anyone with admin rights opens an
  > idea that isn't theirs, it's logged with a written comment stating the reason. As the owner, you can see
  > in your idea's Privacy Log whether any administrative access has happened, and why. The promise is: all
  > internal human access is logged and visible to you in real time.

- **9e. Material vs contributory** — Charlie could not find how to classify a cause. Either it isn't built or
  the affordance is invisible. Make it an obvious control on each cause card, and have Lex ask for the call
  in conversation.
- **9f. Option cards** did not visibly collapse to their title. Verify in a browser.
- **9g. Causes cannot be added via chat** — Lex asks the user to type into the panel. Not a blocker, but it
  is inconsistent with every other field, where chat answers become proposals. Make chat-added causes
  proposals on the loop.
- **9h. Retry search** — no visible control in the panel. Low priority per Charlie; add a quiet "run this
  search again" link rather than a prominent button.

## Acceptance criteria

- Entering a solution as the problem gets challenged, with the problem proposed back; two presses maximum.
- No "Proposed by Lex" badge without a proposal; no announced seeding that doesn't happen; anticipated
  responses arrive populated.
- A completed stage can be re-entered, with chat, panel and edits all following.
- Guiding Policy shows its own search, not the briefing.
- Legislation links open.
- A name in feedback text is stripped.
- Cost totals are right for known inputs.
- Seeded causes read as causes of the stated problem.
- 9a–9h done and browser-verified.
