# §25-E — the elicitation flow is a dead end. Fix brief.

**From:** Charlie's first walk of `/ideas/build`, 22–23 August. **Thread:** LEX.
**Priority: this is the highest-severity brief since the routes were down.**

**The state of it:** Charlie could not get past the confirmation step, the "Build it" button was
greyed out with no way to enable it, and **refreshing lost everything he had entered.** He never
reached the build, the agenda, the panel, the documents or any of the honesty checks. Sections B
through G of the walk are entirely untested because the flow stops at section A.

⚠ **The first three defects are one bug wearing three faces**, so read §1 before starting: a
confirmation step with no way to confirm.

Production. Usual git discipline; **`commit-lex-25e.sh`**; scoped paths; every check watched failing
first; and — given this is a UI flow that eight sprints of code checks passed while being unusable —
**the acceptance criterion is a human-completed run, not a green check.**

---

## §1 — The confirmation is a dead end (three symptoms, likely one cause)

The screenshot shows all three at once: Lex's understanding paragraph, then *"Everything I write next
follows from this, so if I've got the wrong end of anything, now is the cheapest moment to say so"* —
and then **a greyed-out "Build it", a note reading "Confirm what I've understood first — I won't
build on a reading you haven't seen", and nowhere at all to respond.**

**1a. There is no way to confirm.** The button is disabled pending a confirmation, and the control
that provides it either does not render or does not exist. **Find it and prove it renders**, then:

**1b. There is no "Not quite" and no way to disagree.** The brief specified two buttons — *"That's
right — build it"* and *"Not quite — let me correct you"* — and the copy explicitly invites a
correction. **A step that asks for a correction and provides no means of making one is worse than one
that never asked**, and it is the single most alienating moment in the product: Lex has just said
"tell me if I've misread this" and given the user no way to answer.

**1c. The chat input has disappeared.** Charlie: *"there's nowhere to enter a response if I disagreed
with any part of it, the chat seems to have gone."* Whatever the mechanism — the composer hidden on
this step, or the step rendering outside the chat — **the user must be able to type at every point in
this flow.** If the design intends a two-button choice, the buttons must exist; if it intends free
text, the composer must be there. Currently neither is.

**Diagnose first and report the cause**, then fix so that: the understanding paragraph is followed by
a working accept, a working "not quite", **and** a live text input; "not quite" re-runs the
confirmation only, never the whole flow; and "Build it" is enabled the moment confirmation is given.

## §2 — ⚠ Refreshing destroys everything the user has entered

**The worst defect in the walk.** Charlie refreshed after the apparent crash and **every answer he had
given was gone.** Four questions' worth of considered, personal writing — including the "what you know
that we won't find" answer the whole design says is the most valuable thing a user contributes.

**A user who loses that once does not type it again.**

- **Persist each answer server-side the moment it is given**, not on submission of the whole flow.
  `IdeaElicitation` exists; if answers are being held in client state until the end, that is the bug.
- **Resume on return.** Landing on `/ideas/build` with an unfinished elicitation restores it and says
  so — *"Picking up where you left off."*
- **Never silently discard.** If a session genuinely cannot be resumed, say so before the user starts
  typing, not after.
- Add a check that fails if an answer can be given and not read back from the database.

## §3 — The build appears to have crashed, and said nothing

Charlie pressed Build it (probably — he fell asleep, which is itself a finding about the wait), and
found it *"paused and crashed."* **The build row will say what happened**: read the `IdeaBuild` rows
for his idea, establish whether a build was ever claimed, which pass it reached, and whether the
settle wrote it to FAILED or left it RUNNING.

- If a build was killed, **the user must be told** — a failed build that looks like a paused one is
  the failure-dressed-as-success class again.
- If no build was ever started, that is §1: the button was never enabled.
- **Report which**, because the fixes are different.

## §4 — Three smaller elicitation defects

**4a. The opening question is printed twice, verbatim** — once as Lex's message and again as the
field's own description (screenshot). Say it once. The card's description should be the short hint
list, not a repeat of the paragraph above it.

**4b. Question 2 needs both a button and text, and does not say so.** Charlie could not press send
until he clicked one of the four options, and nothing told him that. Either make the requirement
visible — *"Pick one, and add anything else in your own words"* — with the send control explaining
why it is disabled, or accept text alone and infer the category. **A disabled control that does not
say what would enable it is the same defect as §1a**, in miniature.

**4c. The estimate reads oddly at zero data** — *"Usually a few minutes — we don't have enough builds
yet to be precise"* is honest but says two things at once. *"This usually takes a few minutes"* is
enough until there are five completed builds to average.

## §5 — Acceptance criteria

- **A human completes the elicitation and starts a build.** Not a check; a person. If the extension
  still cannot hold a session, say so and Charlie runs it — but this brief does not close on green
  checks alone.
- The confirmation step offers accept, "not quite", **and** a text input; "not quite" re-runs only the
  confirmation.
- Answers survive a refresh, a closed tab and a return, and the resumption is announced.
- The cause of the apparent crash is named in the CHANGE_LOG, with the `IdeaBuild` row as evidence.
- No question text appears twice; question 2 explains its own requirement; the estimate reads cleanly.
- Delivery verified per CLAUDE.md §20.

---

## For the record — what this cost

Eight sprints of work sit behind this step and **none of it has ever been seen**: the build, the
agenda, the by-question panel, document upload, publishing, the proposal, the summary, the evidence
pack. All of it verified by code checks; all of it unreachable through a front door that does not
open.

**The lesson is the one already in CLAUDE.md §20 and it now has its most expensive instance: a green
check proves the code, and only a person completing the journey proves the product.** Whatever it
takes to give CC a signed-in browser session is now the highest-leverage unblocking task on the
project.
