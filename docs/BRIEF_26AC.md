# BRIEF 26-AC — LEX: Private Scrutiny, the reader's page

**From CCh-Lex, 22 November 2026.** Decisions 319 and 367–375. Charlie: invited people should be able to see, understand, critique and contribute to an idea through a page much simpler than the workspace. Team members keep the workspace; reviewers get this page only.

## §0 Run mode

- As BRIEF_26S §0. New worktree `C:\lex26ac`, branch `wip/26ac` from Main; one session per tree; inbox per INBOX_PROTOCOL.md; checks one at a time.
- Report `docs/LEX_26AC_REPORT.md`. **Size first** (parts a–e, hours each, what exists to reuse); then build in the order of §9.
- **Pushes under 365:** push each part to Main yourself when it is green. The stop rules still apply: production schema change with its SQL reported first (whichdb, then the SQL, then schema + SQL in one commit before any code that reads them), deletes, other streams' files, spend over the caps.
- Nothing here writes to 452c5ade's content. An edition is new rows, created only when the owner presses for one.

## §1 Decisions

| # | Decision |
|---|---|
| 319 | Private Scrutiny is a page first, with a printed version on demand |
| 367 | Reviewers are invited by email and must sign in; no anonymous access |
| 368 | Reviewers read a **frozen edition** ("Scrutiny edition N"), not the live workspace. The owner keeps working; each round is a new edition |
| 369 | Every reviewer sees every contribution by default; the owner may make a round **blind** (each sees only their own until the round closes). **Every contribution shows the edition number it was made on** |
| 370 | The owner answers each contribution: **Accepted** (with a link to the change, e.g. "changed action #28"), **Noted**, or **Declined** (with a reason, which joins "Options considered and set aside"). The reviewer sees the outcome. **Before publishing an edition, the owner can run a source-linking exercise** (§3) |
| 371 | Lex for reviewers: read-only; explains a clause, finds a source. The owner pays, with a cap per reviewer the owner sets (default 50p) |
| 372 | Team members see the workspace; reviewers see only the scrutiny page. The owner can move a reviewer into the Team; moving someone out of the Team tells them |
| 373 | Order: (a) the reader's page and editions, (b) invitations and contributions, (c) the owner's answers, (d) the printed edition, (e) Lex for reviewers. Charlie reverses the original (d) and (e) |
| 374 | No standing "questions for reviewers" section. Instead, **author's notes**: owner-written text that introduces the idea, gives context, and can sit at the top or against any heading or action |
| 375 | The owner can **message a reviewer directly**: a private thread between owner and that reviewer (for questions aimed at one person) |

## §2 The page, top to bottom

Reading comes first: generous type, a clear column, nothing of the workspace's controls. On a phone, one panel at a time with the bottom bar from Z1. Shape plus word throughout, never colour alone.

1. **The idea in one page: the main section, nicely formatted.** The Introductory Summary (26-T 5b), generated from the kernel, never from the model's general knowledge: the problem in the owner's words, the guiding policy, each action in one line with **"Read the draft wording"** after it, what it costs if known, and what is not yet settled. Every figure is cited or absent.
2. **Author's notes** (374). The opening note sits under the title. Notes placed against a heading or an action appear there.
3. **The proposals, heading by heading.** Each action shows its statement, its plain explanatory note, any costs, and **"Read the draft wording"**, which opens the draft (the legal text) in its own view with a way back to the same place. If no draft is accepted, the latest is shown and labelled so; "needs no draft" says so with its reason.
4. **Options considered and set aside** (26-T 5c: ruled-out actions and set-aside proposals, each with its reason and date). Collapsed by default. *Charlie has asked what this is; keep it in the build, behind a collapsed heading, until he says otherwise.*
5. **Sources.** Each filed source the edition cites, with the sections that cite it (§3).

## §3 Editions (368) and the source-linking exercise (370)

- **"Create scrutiny edition"** (owner only): freezes the summary, notes, actions, drafts, explanatory notes, costs and sources as immutable rows, numbered 1, 2, 3 per idea. A draft edition can be previewed and edited (notes, which sections to include). **Publish** makes it readable by invited reviewers. Published editions never change.
- **Before publishing**, a checklist shows: sections with no linked source; drafts not accepted; figures without a citation. Each can be published anyway, recorded and shown to the owner, not hidden.
- **The source-linking exercise:** Lex proposes links between each section or claim and the filed sources that support it; the owner accepts or rejects each proposal (proposals beside, never over). Unlinked claims are listed. It runs on the draft edition, never on the published one. Price it before it runs and ask first (as "Draft it" does).
- **"Preview as a reviewer"**: the owner sees exactly what a reviewer will see.

## §4 Reviewers (367, 372)

- Invite by email address, per idea; the invitation names the edition. The invitee signs in (or creates a free account) and lands on the page.
- Report first what email-sending path exists. If there is none, or it would cost money, stop and ask: that is a provider decision.
- A reviewer sees the scrutiny page of the editions they were invited to, and nothing of the workspace. The owner sees the list of reviewers, who has read and who has contributed.

## §5 Contributions

- On any section, action, draft or paragraph: one of five kinds, each a shape and a word: **✓ Support · ⚠ Concern · ✎ Correction · ＋ Suggestion · ? Question**. Free text, with an optional source (a link, or a filed source).
- At the end of the page, an overall form with three questions: *Is the problem real? Will this work? What would stop it?*
- Each contribution shows its author's name, its date and **"on edition N"** (369). Replies go beneath. Nobody edits anyone else's words, and nothing deletes (archive with restore, as everywhere).
- Visible to all reviewers by default; **blind round** option per edition (369).
- Contributions carry forward: on edition N+1, contributions on N show against the same action where it still exists, marked "on edition N".

## §6 The owner's answers (370) and direct messages (375)

- Each contribution has Accepted (link to the change) / Noted / Declined (reason). Declined items join "Options considered and set aside" in the next edition with the reviewer credited.
- A count on the stage bar: "Private Scrutiny · 3 reviewers · 14 contributions · 9 answered".
- **Direct messages**: a private thread between the owner and one reviewer, visible to those two only.

## §7 The printed edition (373 d)

A print-ready PDF of a published edition, through the existing print path, with the edition number and date on every page. The contributions are not included unless the owner chooses "with contributions".

## §8 Lex for reviewers (371, 373 e)

- Read-only tools only: explain this clause, what does this cite, find a source on X within the corpus. No tool that writes.
- The owner pays. A cap per reviewer, set by the owner, default 50p, with a counter visible to the reviewer ("about 30p left"). At the cap, Lex says so in words.
- The owner sees spend per reviewer.

## §9 Order and checkpoints

1. **(a)** The page and editions, with Preview as a reviewer. **Stop and report: Charlie views his own idea's preview on his phone before (b) starts.**
2. **(b)** Invitations, reviewer access, contributions, blind rounds.
3. **(c)** The owner's answers, direct messages, the stage-bar count.
4. **(d)** The printed edition.
5. **(e)** Lex for reviewers.

Each part is pushed to Main when green (365), with the §20 read-back.

## §10 Rules that apply

Lex parity (301): the owner's Lex can create an edition, invite, and answer a contribution through the same code paths, each behind a confirm card. Every new label in `lib/lex/screen-labels.ts` with a field-guide entry and an ⓘ where it is a field. Nothing deletes. Limits with counters. Every rejection worded. Schema with or after the code that reads it.

## §11 Checks — `check:lex-26ac`

Per part, with planted controls and a mutation per behaviour, on scratch copies:
- **Editions:** a published edition does not change when the workspace does.
- **Access:** a reviewer cannot reach the workspace, or an edition they were not invited to; a signed-out visitor sees nothing.
- **Contributions:**
  - each carries its edition number;
  - blind rounds hide others' contributions until the round closes;
  - a declined item appears in the next edition's set-aside list.
- **Lex for reviewers:** it has no writing tool, and it stops at the cap.
- **Layout:** Chromium at 360 and 390 px; nothing wider than the viewport.

Regression one at a time; clean build.
