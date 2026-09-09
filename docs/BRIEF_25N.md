# BRIEF — Sprint 25-N: what the first real walk found

**Thread:** LEX. **Written:** 31 August 2026.
**Source:** Charlie's walkthrough of 30–31 August — the first complete pass over 25-K/L/M by a human,
plus both generated documents.

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the rest into one report. **Stop only for** spend beyond a ceiling or a change of
scope. Shell per CLAUDE.md §22. Most of this is behind sign-in: verify by check and render harness and
**say plainly what only Charlie's browser can confirm.**

⚠ **This is a large brief and the order is the point.** §1 is broken behaviour. §2–§4 are cheap and
change the experience most. §5–§8 are new building. **If the sprint runs long, stop after §4 and
report** — a coherent, working surface is worth more than a half-built new one.

**What is working and must not be disturbed:** the challenges section (*"the most valuable part of the
run so far"*), the for/against snippets on candidate approaches, the causal chain now nesting, the
honest empty states, and Lex's ability to discuss and rewrite a candidate policy in conversation.

---

## §1 — Broken behaviour

**1a. ⚠ A build stopped before finishing its passes, with no way to restart it.** Charlie: *"This is
no good! Stopping before it's finished the passes! With no re-start. Why has it stopped?"* **Diagnose
from the build row** — which pass, what error, whether the settle wrote it. Then: **a partial build
must say what happened and offer to resume**, and it must never silently present incomplete work as
finished.

**1b. Panels resize themselves and cannot be restored.** Clicking an item in the right-hand panel
re-proportions all three columns. **Panels change size only when the user drags them.** Add a visible
**resize handle** on each divider so it is obvious they can be dragged, and a **vertical divider in
the left panel** between the worklist and the chat.

**1c. Sections cannot be closed once opened.** Clicking "Work on this" locks you into a section.
**Every heading toggles both ways, always** — including Decisions and "Where the research changed my
mind", which currently do not.

**1d. The allowance balance is not shown before committing to a re-run.** It was built; it is not
appearing at the moment of decision. Fix and verify.

**1e. Re-running while a run is in progress gives *"A rerun is not available at this time"*.** True
and useless. **A banner across the top: "Re-running now…" while it runs, "Re-run finished" when it
ends**, with a link to the result.

**1f. Uploaded files cannot be opened or downloaded**, and *"9 findings · 87k characters kept"* means
nothing to a user. **Let the user open what they uploaded**, and say plainly what was taken from it —
*"Lex read this and took 9 findings from it"* — not a character count.

## §2 — Naming and layout of the three panels

All of these are Charlie's words; use them verbatim.

- Panel titles: **WORKING AREA · DRAFT STRATEGY · THE RESEARCH**. **Delete all three subtitles**, except
  THE RESEARCH which carries: *"This panel is where you'll find the background, the research, the
  issues, the numbers and the debates behind your draft strategy."*
- **"Collapse" → "Hide this Panel"** on every column.
- Delete the headings **"Background"** and **"Resources"**; the explanatory line becomes
  *"Everything Lex found or worked out:"*
- Delete *"You can:"* from the first line of the how-it-works text — it does not flow into what follows.
- **"0 of 7" → "0 of 7 approved"**.
- Remove *"You've finished this section"* from the right-hand panel. ⚠ It is a relic of forced staging.
  **The user must be free to jump around** — there is too much here to march through in order.

**And in the "How this works" modal, immediately below "Welcome to Scrutinise", above "When editing
your idea…", verbatim:**

> The purpose of this tool is not to solve everything for you, but to give you the insight to lead an
> informed debate. Through debate and scrutiny we build better legislation.

## §3 — The three columns get one clear logic

⚠ **This is the structural change and everything else in the sprint is easier once it is true:**
**raw material on the right · the draft report in the middle · notes and chat on the left.**

**3a. The middle column holds only what is going in the report.** Nothing arrives there until the user
puts it there. **"Make priority" becomes "Add to report"**, with a balancing **"Remove from report"**
once it is in. When the first item from a section is added, **that section's heading appears in the
middle column with it.**

**3b. Move to the right-hand panel:** "Where the research changed my mind", the root cause, and
**Decisions — which goes to the top of the right-hand contents list.**

**3c. The left panel is the working area:** the worklist, then the chat, split by a draggable divider.
**Two tabs on the chat:**

- **Lex** — *"talk to me, Lex, and I'll help you shape each part"*. ⚠ **Only conversations started on
  this page appear here.**
- **Notes** — private to the user, saved with the idea, **never shared**. Notes can be **titled, dragged
  under headings and sorted**, each with show/hide. ⚠ **The user's original idea moves here**, under
  *"My original idea"* — it should not be the first thing on the working page.

⚠ **Open question for Charlie, recorded not resolved:** notes are private to the user, but the user
asked whether they should be visible to their idea-team. **Report the options; do not choose.**

**3d. "What to do next" — the panel text, verbatim:**

> This panel lists the decisions and actions you need to take to build the draft strategy I've prepared
> for you into your formal proposal.

**And the draft's own introduction, verbatim:**

> Here is the draft strategy I have written for you to review and develop into your formal proposal. As
> you go through this you can edit and improve it by typing directly in any box or discussing with Lex
> and asking Lex to write it for you.

**3e. The worklist has four parts, in this order**, each a checkbox list, hidden until clicked:

1. **Things to read** — everything from the research and the strategy, each tickable as read.
2. **Decisions to make** — the first being to approve Lex's drafts for the diagnosis and the rest.
3. **Put it out for scrutiny** — *"find friends and experts willing to read this and ask hard questions
   to help you make your proposal more credible and authoritative"*: **Invite your own private team** ·
   **Make it public and invite wider scrutiny**.
4. **Promote it** — *"build support for your idea from the public and parliamentarians"*.

⚠ **The items must be clickable.** On mobile they currently are not.

## §4 — The right-hand contents list

**Order:** **Decisions** · **Outputs** · **How hard will this be to achieve?** · *divider* · **Inputs**
· everything else · **anything "not asked of this draft" at the bottom.**

- **Inputs** is a new group holding *"Everything we retrieved, by document type"* and *"The basic idea —
  initial background"*.
- ⚠ **Clicking a contents item shows that item only.** It currently shows neighbouring sections too.
- **Delete "The strongest case against."** Neither example under it was a case against; the good
  material belongs in **Challenges** or **Who has argued about this**.
- ⚠ **Items must be movable between sections.** Charlie's example: a Braverman incident filed under one
  heading that belongs under *"Who has argued about this"* or *"How hard will this be to achieve"*.
  Keep it, move it.
- **Cost and duration is missing entirely.** It belongs in this contents list: the cost of
  implementation and the financial benefits, **with its assumptions stated**, and the caveat that this
  is a purely financial view excluding human costs and benefits. If the kernel is unsettled, say so and
  state what has been assumed.

## §5 — The two documents

Both are wrong in the same way: **internal working numbers are appearing in outward-facing documents.**

**5a. Both:** remove *"9 of 9 settled kernel fields carry no source"*, *"167 questions remain open"*
and everything of that kind. ⚠ **That belongs in a separate progress report for the user** — a "what is
left to do" view — not in a document for a reader. **Where the proposal is unfinished, say so once, at
the top: "This is a DRAFT report for a proposal in process."**

**5b. The summary is one page, not two**, and its headings should be **The problem · Cause · Guiding
Policy · Proposed Actions**. Where a field has several candidates, **take the top one and label it**:
*"Current leading cause, of 10 under consideration."* ⚠ **Kernel items must be draggable so the user
chooses which is top** — that is how a useful draft can be printed part-way through.

**5c. The long report:**
- **"Guiding Policy"**, not "The approach".
- **List all proposed approaches** rather than *"no approach has been committed to"* — keep that line,
  then list what is under consideration.
- **Delete "In Charlie's own words"** — this is an outward document.
- **Sections, with the heading repeated in large bold type on every page of that section**, so a reader
  leafing through a hundred pages always knows where they are: **DRAFT STRATEGY · HOW HARD WILL THIS BE
  TO ACHIEVE · WHAT THE LAW SAYS NOW · QUESTIONS THE RESEARCH COULDN'T ANSWER · CHALLENGES · SOURCES.**

**5d. Outputs takes ~5 seconds to show anything.** If generation is happening, say **"Building
reports"**; if it is a page load, fix it. Report which it was.

**5e. A third document, new: the meeting pack.** For someone who will contribute but will not join the
team. The current choices and decisions to be made, plus the research and issues, **printable, with the
user choosing what to show and hide** before printing.

## §6 — The public view *(new)*

*"See this as others would"* currently goes to the Strategy page — which is what the *team* sees.
**Build the public view:**

- A **title and summary card**, clickable to open.
- Inside, **just the headings — Problem · Cause · Policy · Actions — each clickable to reveal detail.**
- **Space below for contributions.**
- Reachable from the top of Stage 1, alongside the re-run.

## §7 — Choosing a guiding policy *(new — decide the logic first)*

⚠ **The mechanics are not defined and the user cannot tell what to do.** Charlie: *"How do I choose? Do
I have to choose one only? What if I want parts of others built in?"*

**Design it, report it, then build it:**

- A **comment box under each candidate**: what do you like, what do you dislike.
- **Lex then re-runs** with a proposed rule-in/rule-out and guidance on what the user must resolve to
  reach one clear guiding policy — with comment boxes again for the user's answers. Iterate.
- ⚠ **Some candidates are complementary, not exclusive** — Charlie's example: legislation alongside an
  HR and performance rethink are *"not only complementary but essential to have together"*. **Lex must
  say which are genuinely mutually exclusive and which combine**, rather than forcing a single choice.
- ⚠ **Impasse:** if the user will not narrow, **do not block them.** Proceed, with Lex recording a risk:
  *"this proposal carries two potentially conflicting guiding policies, to be resolved."* Splitting into
  two ideas is offered, never imposed. **A "computer says no" is worse than an unresolved tension.**
- **Clear instructions at the top of the section** once the logic is settled.

## §8 — Causes: nesting and evidence

- **The title box must expand** like the others.
- ⚠ **"Add cause beneath" creates a duplicate with no hierarchy.** Fix, and add **drag-and-drop: drop
  one cause onto another and it sits indented beneath it, visually linked.**
- **Charlie's question, answered in the design and reported:** if the *material* cause is the last link
  in the chain, the preceding causes should stack **above and indented**, so that choosing the final
  material cause highlights the whole chain. **Report the model chosen and why.**
- **Lex is putting everything in the title and leaving "why it has persisted" empty**, despite having
  clear answers for both. Fix in the prompt — and ⚠ **assert the value, not the schema.**

## §9 — Deferred, recorded so they are not lost

**Not in this sprint. Do not build; do not lose.**

- **The Deepening becomes a research tool** — the user picks any element and says "research this"; Lex
  returns statistics, corpus links and evidence on that specific question, filed in the right-hand
  panel under **The Deepening**, each topic with its own title. ⚠ **And it must not be blocked on kernel
  completion** — research changes the kernel, so it cannot wait for it.
- **The challenges section gains a Respond button** — the user explains how they will deal with a
  challenge; it moves to **Resolved challenges**, still visible to team and public, because *"they set a
  good tone"* and a resolved challenge may be *"a genuine issue addressed by CA9"*. **Remove "Another
  model made this point"** — give each a title and put the model name as its source at the bottom. Add
  a **re-run challenges** button for after major kernel changes.
- **Positions/graph** — still no for-and-against list. Needs the disclaimer and consent tick, then the
  list with evidence, then endorse-or-correct.
- **Lex should answer navigation questions** from the FAQ — *"how do I see the middle panel"* currently
  gets a description of the panel rather than directions.

## §10 — Content quality *(the standing problem, not a task)*

⚠ **Report an approach; do not attempt a fix in this sprint.**

Charlie's finding: a single 2014 Lords remark that civil service productivity had improved was
**accepted, used to change Lex's mind, and never questioned** — not for its date, not for its absence
of figures, not against contrary evidence. His standard:

> *"I've tracked down the numbers he referred to and they no longer hold."*

And the larger gap: **there is no commentary at the start of the causes section** setting out the
evidence, the issues, the level of complexity, and how the pieces might fit into a coherent strategy.
The user is asked to choose between options at a granular level with no overview of the terrain.

**Report what it would take** to (a) date-check and challenge a retrieved claim before relying on it,
and (b) produce that opening commentary. Both are prompt and pass work, and both are more valuable than
anything else outstanding.

## §11 — Mobile

- **Default to the top of the page** — the three stages currently scroll off.
- Under the stage line, add: **"Pull down to change stage"**.
- ⚠ **Nothing says the panel switcher is at the foot of the page.** Add a line at the top of each panel
  and a section to "How this works" for mobile.
- **"What to do next" items are not clickable** on mobile.

## §12 — Acceptance criteria

- A partial build says what happened and can be resumed; nothing incomplete is presented as finished.
- Panels resize only on drag; handles are visible; the left panel has its own divider.
- Every heading toggles both ways; nothing locks the user into a section.
- The allowance shows before a re-run; a run in progress shows a banner, and its finish shows one.
- Uploaded files can be opened; what was taken from them is described in words.
- All §2 naming is exact; the purpose sentence is in the modal.
- The middle column contains only what the user added; "Add to report"/"Remove from report" work and
  bring their headings with them.
- The left panel has Lex and Notes tabs; notes are private, titled and sortable; the original idea sits
  under "My original idea".
- The worklist has the four parts, clickable, in order.
- The right-hand contents is in the order given; clicking an item shows only that item; items can be
  moved between sections; cost and duration exists.
- Neither document carries internal working counts; the summary is two pages with the four headings and
  a labelled leading item; the long report has repeating section headers.
- *(if reached)* The public view exists; the guiding-policy logic is reported before it is built; causes
  nest by drag and drop.
- §9 and §10 are reported, not built.
