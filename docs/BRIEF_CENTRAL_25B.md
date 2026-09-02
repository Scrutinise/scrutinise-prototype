# BRIEF — CENTRAL 25-B: the first ten minutes, and the points nobody checks

**Thread:** CENTRAL. **Written:** 1 September 2026, late.
**Follows:** CENTRAL 25-A (§§1–8 built or briefed; the provenance migration and Charlie's Vercel
changes are outstanding).

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the rest into one report. **Stop only for** spend beyond a ceiling or a change of
scope.

⚠ **Do not start this until 25-A §8a is done** — breaking branch-implies-root is load-bearing for
everything about who can do what, and §1 below walks exactly those paths.

⚠ **A LEX session shares this repository.** Commit by explicit file path only, never `git add -A`.
`package.json` is contended — report a conflict rather than resolving it.

⚠ **CLAUDE.md §25 and §26 apply.** And the lesson from 25-A that belongs here too: **a clean
typecheck of a Prisma write proves less than it appears to** — a fixture naming a column that does
not exist typechecked cleanly and could never have worked.

**§1 is the sprint. §2 and §3 in order.**

---

## §1 — Nobody has ever walked a new member's first ten minutes

⚠ **This is the point of the sprint.** Five branch chairs are arriving now, invited by Charlie, and
**no one has ever seen what they see.** Every defect in 25-A was found by a real person hitting it in
a browser, not by a check.

**1a. Walk the whole journey end to end on production, as a new person**, and report what is on
screen at each step:

1. The invitation email arrives — **what does it say, and does it say the right thing now that the
   two-email problem is fixed?**
2. They click it. What page? What does it ask for?
3. They create an account.
4. They land — **where?** ⚠ **This is the step Charlie most needs reported.** A branch chair who
   lands on an empty dashboard with no idea what to do next will not come back.
5. Are they in the community? In their branch? Does anything tell them so?
6. What can they actually do — and does the page tell them, or must they find out?

⚠ **Report what is there, not what should be.** Where a step is confusing rather than broken, say
that: confusing is the more common failure and the one nobody logs.

**1b. Walk it twice — once as a group member (a branch chair) and once as a branch member.** Their
first screens should differ, because what they may do differs. **Report whether they do.**

**1c.** ⚠ **Report, do not build, what is missing.** A first-run experience is a design job and
Charlie decides its shape. **What this brief wants is an honest account of the current one**, step by
step, with the wording quoted.

**1d.** Where something is plainly broken rather than merely thin — a dead link, a page that errors,
a button that does nothing — **fix that, and list what you fixed separately from what you observed.**

## §2 — Points can be awarded by the person receiving them

25-A found that root membership includes **logging activity claims that pay points immediately, with
no review**. Among a handful of trusted people that is a footnote. On a leaderboard at a party
conference it is an invitation.

**2a. Audit first, read-only.** How many points have been self-claimed, by whom, and what is the
largest single claim? ⚠ **Report the numbers before proposing anything.**

**2b. Report what a claim actually is** — what a member asserts, what evidence if any is attached,
and what stops the same activity being claimed twice.

**2c. Propose the smallest change that makes the leaderboard defensible**, and put the options to
Charlie rather than choosing. ⚠ **Note the constraint: a review step that needs Charlie's attention
does not scale, and one that needs nobody's is not a review.** Say which of the options has that
problem.

**2d. Do not change the points system in this sprint.** Report and propose only.

## §3 — Branch managers are accountable but may not be equipped

Charlie has made branch managers responsible for the conduct of people in their branch. **Report what
they can actually do about it:**

**3a.** Can a branch manager see **who invited whom** within their branch? (25-A §7h retains the
record; report whether it is visible to them.)
**3b.** Can they eject someone from their branch — and does it work? ⚠ 25-A found a title granting
invitation but not ejection; report whether that is now closed.
**3c.** Is there any way for a member to **report** conduct to their branch manager, or for a manager
to escalate to the community owner? ⚠ **If there is nothing, say there is nothing.**
**3d. Report only. Do not build a moderation system** — Charlie has not specified one and it is a
larger design question than this sprint.

## §4 — Two things carried from 25-A

**4a.** If `check:scripts` is still red on `scripts/check-central-25a.ts`, fix and commit it by
explicit path. ⚠ A shared check left red because it is known to be someone's own hides the next real
failure.

**4b.** Confirm by **re-reading the row** that the fixture user the check left on production is gone,
and reconcile the account count — how many of the current accounts are real people.

## §5 — Acceptance criteria

- The new member's journey is reported step by step, with the wording on screen quoted, for both a
  group member and a branch member.
- Anything plainly broken in that journey is fixed and listed separately from what was observed.
- The points audit reports totals, the largest single claim, and who claimed.
- Options for making the leaderboard defensible are put to Charlie, with the scaling problem named
  for each.
- What a branch manager can and cannot do about conduct is stated plainly, including where the answer
  is nothing.
- The fixture user is confirmed gone by a re-read, and the account count is reconciled.

## §6 — Say what only Charlie can confirm

⚠ **He is the only person who can read a real invitation email in a real inbox.** Say so rather than
reporting the template as evidence of what arrives.
