# BRIEF — Sprint 25-Q: the things a pilot tester will try and fail to do

**Thread:** LEX. **Written:** 1 September 2026.
**Source:** Charlie's walkthrough of 30–31 August, re-read in full. Every item below is a line from
it that 25-N, 25-O and 25-P did not reach.

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. ⚠ **Three of the last four briefs carried a premise that measurement overturned, and CC
was right every time. Assume a fourth.** Batch the rest into one report. **Stop only for** spend
beyond a ceiling or a change of scope. Shell per CLAUDE.md §22.

**§1 is the sprint and is the largest thing in it. §2–§4 are what a tester hits in the first ten
minutes. §5–§8 are cheap. If the sprint runs long, stop at a section boundary.**

⚠ **Nothing here depends on a fresh build**, and that is deliberate — Charlie is running one full
build to make 25-O's commentary and 25-P's guiding-policy sort visible for the first time, and this
sprint must not collide with it.

**Must not be disturbed:** the guiding-policy screen shipped in 25-P; the commentary pass added in
25-O, **which has still never been generated**; the evidence date column and its backfill; the three
proven write paths; the divider fix; the toggling headings; the report running headers; the two
collapsed sections.

---

## §1 — Lex can talk about the draft but cannot write to it

**Charlie's walkthrough, verbatim: *"I tried to get Lex to edit this and the result was helpful but
no interaction with the Middle Panel."*** He asked Lex to rewrite a candidate guiding policy. Lex
produced a good rewrite — in the chat. The DRAFT STRATEGY panel never changed. He had to copy it
across by hand.

⚠ **This is the single largest interaction gap left in the product.** The whole design says the
middle panel is what the user is saying and the left panel is where they work it out. Right now
there is no bridge between them.

**1a. Diagnose first and report before building.** Establish whether Lex's chat has any write path
to kernel fields at all, or whether the chat is read-only by construction. The answer changes the
size of this section completely, and Charlie should be told which it is.

**1b. When Lex produces text that is plainly a replacement for a field**, it offers to write it:
*"Shall I put that in as the guiding policy? You can edit it after."* ⚠ **Lex proposes; the user
accepts; only then does the panel change.** Never a silent write.

**1c. On acceptance the middle panel updates without a page reload**, and the change is visible
where the user is already looking.

**1d. The user's original text is kept.** ⚠ Standing principle: the user's own words are testimony,
kept verbatim and attributed, never overwritten by an edited version. An accepted rewrite supersedes;
it does not delete.

**1e. Assert the rendered result, not the write.** Per CLAUDE.md §25 — the check must show the new
text present in the rendered panel, with a control that stays false.

## §2 — A build gives no sign it is running

Three separate walkthrough lines, one cause: the page does not say what state the build is in.

**2a.** Charlie pressed re-run, it started, he pressed again and got **"A re-run is not available in
this idea at this time"** — a refusal that reads like a fault. It was already running.
**Replace with a banner across the top: "Re-running now", and "Re-run finished" when it completes.**
An already-running build is not an error and must not be reported as one.

**2b.** When a pass finishes, the user is left where they were. **Either move them to The Strategy,
or say "Pass finished — now go to the Strategy section"** with a control that takes them there.

**2c.** ⚠ Charlie's other note: the wait when opening Outputs was about five seconds with nothing on
screen, and the same on the second open. **If a report is being assembled, say "Building reports".
If it is not being assembled, the delay has another cause — measure it and report which.** 25-O
measured the panel at 579 ms of server time; this is a different surface and has not been measured.

## §3 — Stage 1 has no Lex and the re-run controls are at the bottom

**3a.** ⚠ There is **no Lex chat box on Stage 1 · The Idea**. Charlie could not ask Lex to re-run
because there was nothing to ask. Add the same Lex/Notes pair used on Stage 2.

**3b.** The re-run block sits at the foot of a long page. **Move re-run, add-a-file and add-further-
information to the top**, where a user arriving to change something will look. The allowance line
now reads correctly and stays with it.

**3c.** There is **nowhere to add further text before re-running** — only the existing answers can be
edited. Add a free-text box: *"Anything else you want me to take into account this time?"*

**3d.** The answer pills at the top are clickable and nothing says so. Add one line above them:
*"Click below to change any of the answers you've given for that section."*

## §4 — Uploaded files cannot be opened

**Charlie's first walkthrough line: you can add files, you cannot download them or view them to check
what is in them.** A user who uploads the wrong document has no way to discover that.

**4a.** Each uploaded file is openable and downloadable by anyone who can see the idea.
**4b.** ⚠ Report what the permission model actually is before building the control — do not assume
that "can see the idea" and "can see its files" are already the same set.

## §5 — "Findings" and "characters kept" mean nothing to a user

Shown against an uploaded document. Charlie: **confusing.** Say what they are in words —
how much of the document was kept, and how many things Lex took from it — or remove them.
⚠ **Do not guess the intended meaning: read what produces the numbers and report it**, then write
the label to match.

## §6 — Lex cannot answer questions about the product

Charlie asked Lex on mobile how to see the middle panel and got a description of what the panel
contains rather than how to reach it.

Give Lex the operating facts: how to switch panels on desktop and mobile, what the three stages are,
what a build costs and what the allowance means, where notes go and who can see them, what "Add to
report" does. ⚠ **Sourced from one place that is also what "How this works" renders**, so the two
cannot drift apart.

## §7 — Challenges: the attribution is in the wrong place

The challenges are, in Charlie's words, the most valuable part of the run. Two changes only:

**7a.** Remove **"Another model made this point"** as the heading. Give each challenge a real title —
*"Employment law issues"*.
**7b.** Put the model's name **at the foot of the point, as its source.**

⚠ **Nothing else in this section.** The Respond flow, resolved challenges and the re-run-challenges
control are designed and belong in a later sprint. Do not start them.

## §8 — Three small ones

**8a.** Anything under **"Not asked of this draft" goes to the bottom** of the contents list in THE
RESEARCH.
**8b.** The **cause title box is not expandable** while the boxes below it are. Make it match, and
start all of them at roughly twice their current height.
**8c.** On the two-page report, when the kernel is incomplete, the top must read **"This is a DRAFT
report for a proposal in process."** Confirm whether 25-N already did this; if so, say so and do
nothing.

## §9 — Acceptance criteria

- Lex offers to write a rewrite into the field, the user accepts, and the middle panel shows the new
  text without a reload — asserted on the rendered panel with a control that stays false.
- The user's original text survives an accepted rewrite and is still attributed to them.
- Pressing re-run while a build is running shows "Re-running now", not a refusal.
- A finished pass tells the user where to go next.
- Stage 1 has a Lex chat, a further-information box, and its re-run controls above the fold.
- An uploaded file can be opened and downloaded, and the permission set is stated.
- "Findings" and "characters kept" either say what they mean or are gone.
- Lex answers "how do I see the middle panel" with navigation, from the same source as "How this
  works".
- No challenge is headed "Another model made this point"; every challenge has a title and a source
  line.

## §10 — Say what only Charlie's browser can confirm

Expect this to include the Lex-writes-to-the-panel round trip on a real model call, the re-running
banner during an actual build, and the file open on a real upload. **List them rather than reporting
render assertions as user-confirmed.**
