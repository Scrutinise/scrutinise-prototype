# Scrutinise Central — question library

A design spec for discussion. This describes a prototype built in Claude Design against the real `scrutinise-web` codebase. It is written to be read without seeing the visuals.

## Where this sits

Central is a top-level navigation item. Inside it are the areas where you are *in the community* — Questions, Board, Training, Leaderboard — as sub-tabs. Personal concerns (which groups you belong to, your points) sit at the Central level rather than inside those tabs.

This split was a correction made during design and is the part most worth pressure-testing. The open question is whether "manage my groups" and "my points" genuinely belong under Central at all, or whether they are account-level concerns that only appear there for want of a better home.

## What the Questions area is for

Members meet hard questions in public: on the doorstep, in media interviews, at hustings, in university AMAs, in the council chamber. The library collects those questions and the answers the community rates highest, so that the answer a member gives is the best one anyone in the community has found, not the best one they can improvise.

Two consequences shape the whole design:

The library fills from the field, not from an admin seeding it. The empty state asks for the last question that caught you out, and promises that the settled answer will be written by the people who had to give one.

Answers are community-rated, not official positions. This is stated on the printed pack. The design should never imply the top answer is a line to take.

## Screens

**Question library.** Search, a topic filter, a sort (top this month / all time / newest), and context chips. Each row shows the vote count, the question, the opening of the top answer, its tags, and markers for whether it cites sources or carries a local example. Two states are designed: populated, and empty for a new community.

**Question detail.** Answers ranked by weighted votes. The top answer shows its body, its sources, and — visually distinct — a local example: a worked instance from a specific branch's own council or patch. Below, a compose box that prompts for a source and a local example rather than treating them as optional extras.

**Add a question.** Three steps. Write it in the words it was asked. See near matches. Tag and scope it.

The middle step is the one carrying the most intent. Rather than blocking a duplicate, it opens with "Good news — three people have already been asked this" and argues that an answer is worth more on a question people are already reading. Carrying on regardless sits at equal visual weight, with the reassurance that an answer can be moved later. The framing is a shortcut offered, never a rejection issued.

**Pack builder.** Turns the library's current filter into a top-N pack for the doorstep or a training session. The pack inherits the filter rather than asking you to specify it again. You choose a size, choose what travels with each question, and pin or remove individual questions in a live preview. Pinned questions hold their place when the ranking moves beneath them.

**Pack output.** Three field behaviours were designed rather than one, because the right answer depends on the moment:

- *Glance cards* — one question per screen, question first, answer opening visible without tapping. For when you are mid-conversation and need to look up.
- *Answer-first flashcards* — the question demoted to small type, the line you would actually say filling the card. For rehearsal, and for when you need words rather than context.
- *Continuous list* — the whole pack on one thumb, numbered and scannable. For training, and closest to the printed sheet.

Plus an A4 print sheet for handing out.

**Across branches.** An admin overview: participation figures, and per branch the top-voted and rising questions. Quiet branches are marked neutrally, not flagged as failing. Counts are participation only — no per-member activity is shown, and nothing is visible outside the admin group.

## Voting and favourites

Three distinct mechanics, deliberately kept apart:

**Question votes** record *frequency*, not quality. One per member, upvote only, no downvote — the vote means "I get asked this too". Hovering says exactly that. These drive the library ranking and therefore what lands in a pack.

**Answer votes** record *quality*. One per member per answer, up or down, mutually exclusive. Switching from up to down withdraws the first vote rather than stacking.

**Favourites** are *private*. One per member per answer, no shared count, no effect on ranking, invisible to everyone including admins. A favourite is your own shortlist. Its only effect is in the pack builder: with the option enabled, a question where you have favourited an answer carries your answer instead of the top-voted one.

The design labels the weighting on the detail screen as "ranked by weighted votes", but the weighting itself is undefined. That is an open decision, not a designed one.

## Open questions

1. Is the Central structure right — do groups and points belong there, or at account level?
2. What actually weights an answer vote? Branch size, role, recency of canvassing, or nothing at all?
3. Do votes expire, so that "top this month" reflects current concerns rather than accumulated history?
4. Can a member vote on their own question or answer?
5. Who moderates, and what happens to an answer that is popular but wrong? Nothing in this design addresses correction; "Suggest an edit" and "Report" exist as affordances but the process behind them is unspecified.
6. What happens when a branch-scoped question turns out to be general — is promoting it to the whole Community a member action or an admin one?

## Visual direction

Built on the tokens already in `scrutinise-web`: DM Sans, a navy primary, hairline borders, a near-white page. Three changes were made as a proposed upgrade to the current V0-derived styling: cards move to a 12px radius with a single hairline border and no nested boxes; teal is promoted from animation-only to the live-state accent (voted, pinned, local example, rising); and every count is set in tabular figures so numbers do not jitter as they change. No new colours, no change to the type stack.

If adopted, the same treatment would carry to the bulletin board, teams tree and leaderboard panels so the dashboard stays consistent.
