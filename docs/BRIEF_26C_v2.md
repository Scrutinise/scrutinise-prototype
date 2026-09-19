# BRIEF — LEX 26-C: one box, and the library

**Thread:** LEX. **Written:** 19 September 2026. **Replaces** any earlier draft of 26-C.
**Source:** Charlie's walkthrough of the new four-step door, 17–19 September.

⚠⚠ **This reverses part of 26-B, which shipped two days ago.** 26-B built a four-step elicitation.
Charlie has since concluded the separation is unnecessary: *"let's just get one big dump of whatever
they can give us, and Lex will need to sift through it. This keeps the UI incredibly simple."*
**One box. Build that.**

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the report. **Stop only for** spend beyond a ceiling or a change of scope.

⚠ **§1 first, and report it separately.** It is a live fault on the second screen a new user sees.

⚠ **CLAUDE.md §25–§28 apply. Read-back list for every string** — most of this sprint is strings and
layout, so that list is the check, not a supplement to it.

⚠ **A CENTRAL session shares this repository.** Explicit file paths only.

---

## §1 — The page froze

**Charlie, in his own words:** *"Lex did die. The page froze with no question or button to move it on.
I had to exit and 'edit' to get to the 3 panel view."*

He answered Lex's clarifying question and **nothing happened** — no reply, no control, no way forward.
The only escape was to leave and come back, which landed him in the full three-panel workspace with
*"nothing built yet"* and a research panel reading **0 in all**.

**1a. Diagnose before fixing. Report which:** the turn failed and the error was swallowed; the
conversation hit a silent turn cap; or the reply was produced and never rendered. ⚠ **The third has
been the answer six times this month. Check it early.**

**1b.** ⚠ **Silence is never the behaviour.** A failed turn says so and offers to retry.

**1c.** ⚠ **Report what "2 of 8 approved" is counting on THE BASIC IDEA when nothing has been built.**
Elicitation answers being read as approvals would explain it and would be wrong.

## §2 — One box

**2a. The new-idea screen asks one question, into one text box.** No separate steps for the problem,
the outcome and other information. ⚠ **Lex sorts what it is given; the user is not asked to.**

**2b. Keep the four bullets** as guidance beside the box — *what is going wrong and for whom · what
you have seen yourself · why it matters · what you think is really going on.*

**2c. Above them, this text, replacing the current paragraph:**
> *The first step is to describe the problem you want to solve, in as much detail as possible.*

**2d. To the right of the bullets, a second box:**
> *Any background information you can add — including attaching reports — will improve the quality of
> what you get back.*

**2e. The file and link control stays** with the box. ⚠ Charlie's four documents produced 38 findings;
every document ever read came in through that control.

**2f.** ⚠ **What must not be lost from 26-B's four steps: Lex reading its understanding back.** That
survives — as part of the conversation, not as a separate step. **Report anything else those steps
did that this loses.**

**2g. Remove the Stage 1-2-3 header** from this screen. It belongs on the next page.

**2h. Ask Lex and Notes are suppressed** until the first build has run.

## §3 — Two prompts, then the build

**3a. Lex replies at most twice.** ⚠ **Not three times.** The second closes with:
> *Is there anything more you can tell me, or anything you can add, to give focus to this before I
> build the first draft?*

**3b. Then it stops asking and offers the build:**
> *Thank you — I'm ready to run the initial build whenever you are. As a new user you have twelve
> builds at our expense, after which we'll ask you to contribute to the cost. It's worth including as
> much as you can before you press the button. Once it starts it runs for ten to fifteen minutes, and
> you can close this tab and go and do something else.*

⚠ **3c. Verify "twelve" against the configuration and use whatever it actually grants.** Charlie's
recollection is twelve runs; the figure in the product must match the code, not the recollection.

⚠ **3d. The email sentence returns once delivery is confirmed, and not before.** The provider returns
a 2xx and an id; nobody has confirmed a message in an inbox. **Send one test to Charlie and report
the id.** When he confirms it arrived, add: *"and we'll email you when it's ready."*

## §4 — Nothing leaves the simple screen until a build has run

**Charlie: *"we stay on this super-simple UI, even if we exit and edit."***

**4a. Stage 2 does not open until a build exists.**
**4b. Exit and re-enter returns to this screen and this conversation** — not the three-panel
workspace.
**4c.** ⚠ **Report how the product currently decides to move the user on**, since it did so
unprompted and left him somewhere empty.

## §5 — The idea has no title

⚠ **Lex should name the idea in its first response and does not.** Charlie already has two ideas
called *Untitled idea*. **Report whether titling exists and never fires, or does not exist**, then
build it. The title is how the user finds the idea again.

## §6 — The layout of the front screen

**6a. Two columns, side by side: the new idea on the left at three-quarters of the width, the
library on the right at one quarter.**
**6b. The divider is draggable**, like the ones in the workspace.
**6c. Headings:** *Create a new idea* on the left. On the right, ⚠ **propose a heading and let Charlie
choose** — he offered *My Previous Ideas* and *Idea History* and invited better.
**6d. Exit** moves to the far right, below the header line. **How this works** moves to the left,
below the left-hand column heading.

## §7 — The library

**7a. Every idea is listed.** ⚠ Charlie has about 50 and sees 16. **Report why before changing it** —
a limit, a page size, or a filter. A long list scrolls within its column.

**7b. On every card, in every list including the dashboard: archive and delete**, to the right.
⚠⚠ **They are different and must look different.** Archive hides; delete removes, asks once, names
what will go, and is re-read back afterwards.

**7c. Drag to reorder**, and the order persists.

**7d. Grouping.** A **Group ideas** button puts a checkbox on every card and offers a **Group name**
box. A group can be shown or hidden.

**7e.** ⚠ **Report the data model before building 7c and 7d.** Both are new per-user state and 7d is
the larger. **If grouping is a sprint on its own, say so rather than half-building it.**

## §8 — Colour

**Charlie is content with the palette. His requirement is contrast, not hue:** a clear difference in
**brightness and saturation** between the three panels — his example, black for the strategy panel
against a pale green for research.

**8a.** ⚠ **The box around each heading takes the same colour as the heading, heavy and strongly
saturated.** At present the heading is coloured and its container is not.
**8b.** ⚠ **Test with colour removed.** Brightness, weight, size and position must still distinguish
the three panels completely.

## §9 — Acceptance criteria

- A user's second message always produces a reply, or a stated failure with a way to retry.
- The new-idea screen has one text box, one instruction, the four bullets, the background note, and
  the file control — and no stage header.
- Lex reads its understanding back within the conversation.
- Lex prompts at most twice, then offers the build with the closing message.
- The allowance figure matches the configuration, verified against it.
- No sentence promises an email until delivery is confirmed by Charlie.
- Exiting and re-entering before the first build returns to this screen, not the workspace.
- Every new idea is given a title in Lex's first response.
- The front screen is three-quarters and one quarter with a draggable divider.
- Every idea is listed; each card carries archive and delete; a delete names what it removes.
- Each panel heading and its container share a colour, and the three remain distinguishable with
  colour removed.

## §10 — Say what only Charlie's browser can confirm

⚠ **He found §1 by using the product and no check saw it. Say what you could not test.**
