# BRIEF — Sprint 25-O: clearing the road to Pilot A

**Thread:** LEX. **Written:** 31 August 2026.
**Source:** Charlie's decisions of 31 August, plus 25-N's own report and the findings it produced
that were not brief items.

## §0 — Run mode and ordering

**Continuous.** Diagnose, record in the CHANGE_LOG, proceed — including where a finding contradicts
this brief. Batch the rest into one report. **Stop only for** spend beyond a ceiling or a change of
scope. Shell per CLAUDE.md §22. Most of this is behind sign-in: verify by check and render harness,
walk the authed surface as you did in 25-N, and **say plainly what only Charlie's browser can
confirm.**

**§1–§4 are pilot-blocking and the pilot is in one to two days. §5 is the highest-value change in
the whole outstanding list. §6–§7 if reached. If the sprint runs long, stop after §5 and report.**

⚠ **Not in this sprint and deliberately so:** the guiding-policy choice mechanics (25-N §7). The
logic is still under discussion with Charlie and the design will land in 25-P. **Do not build it,
and do not let §5 quietly pre-empt it** — the opening commentary describes the terrain, it does not
make the choice.

**What is working and must not be disturbed:** everything 25-N verified live — the three panel
names, "Hide this Panel", the toggling headings, the Lex/Notes tabs, `ReportAdditions` in the middle
column, the four worklist parts, the §4 contents order, and the absence of "The strongest case
against". The challenges section, the for/against snippets, the causal chain, and the honest empty
states all predate 25-N and stay.

---

## §1 — The allowance must be reserved before the build starts

**Charlie's instruction, verbatim: *"It certainly shouldn't stop mid-way."*** Today's mechanism
refuses at the write path with a 402, which means a build can begin, run passes, spend real money
and then be refused part-way — leaving the user with an incomplete kernel and no explanation. That
is 25-N §1a's failure arriving from the other direction: 25-N fixed the *time* ceiling stopping a
build mid-run; this is the *allowance* ceiling doing the same thing.

**1a. Reserve the whole build's worth of allowance before pass 1 runs**, and refuse at the door with
a message naming the shortfall — *"You have enough for a re-run but not a full build."* A build that
starts must be able to finish on the allowance it holds. **Why reserve rather than check:** a check
at the door and a spend across ten passes are separated by minutes, and two builds started in that
window both pass a check and only one can be paid for.

**1b. Release the reservation on FAILED and CANCELLED**, and report what was released. ⚠ 25-M
recorded that the spend test is an allow-list counting only DONE builds — so a reservation that is
taken but never released turns every failed build into a permanent deduction. **Assert both
directions:** a failed build returns its reservation, a completed one does not.

**1c. The pilot allowance is three full builds and three re-runs per user.** Set as configuration,
not as a constant in code, because it drops back to one once the payment path exists.

**1d. The resume control must be reachable.** 25-N found `resumable` had been in the API payload
all along and was rendered by nothing. Confirm the control now renders, and that a build which hit
its ceiling offers it. ⚠ **This cannot be proven without a build that actually stops** — say so
rather than reporting the render assertion as a live resume.

## §2 — The public view: a holding page, not a build

**Charlie's decision: hold, do not build.** "See this as others would" currently goes to the
Strategy page, which is what the *team* sees. That is a dead end in the middle of the core flow and
a pilot tester will find it.

Behind the button: the idea's **title and summary**, and one line — *"The public view is being
built. This is what your team sees today; the version the public will see is coming."* Nothing else.
25-N's §6 design stands and is built in a later sprint.

**Why a holding page rather than hiding the button:** the button tells the user the feature exists,
which is true. An honest "not yet" costs a tester nothing; a button that goes somewhere wrong costs
their trust in everything else on the page.

## §3 — Retire `/ideas/build` without blinding the delivery probes

`/ideas/build` was the testing surface. Everything is now in the normal navigation at
`/ideas/create` and the old route should not be reachable from the product.

⚠ **It cannot simply be deleted.** Several probes read marker strings off that page — it is how
25-E proved a push had become a deployment, and `verify:build-25a-ui` renders it to assert 43
things. **Delete the route and those probes stop failing, which looks exactly like passing.**

**3a. Redirect `/ideas/build` to `/ideas/create`.** Keep the route; remove every link to it.

**3b. Re-point every probe and harness that reads `/ideas/build`** at `/ideas/create`, and **watch
each one fail** on a deliberately broken marker before reporting it green. Enumerate them by name in
the report — do not report "the probes were updated" without the list.

**3c. Report any probe whose assertion no longer has a home** on `/ideas/create`, rather than
deleting the assertion. A check that was quietly dropped and a check that passes are the same thing
from the outside.

## §4 — Archive the pre-rebuild ideas and builds

Three testers made ideas under the previous structure. They were going wrong at the time and Charlie
will explain directly to those three; the ideas should not appear anywhere in the product.

**4a. Print the list first.** Every idea and build about to be archived: id, title, owner, created
date, build count. **Charlie sees this list before anything is hidden.**

**4b. Archive, never hard-delete.** ⚠ In 25-H three copies reported deleted were still in the
database five days later, two carrying real titles and indistinguishable from Charlie's own ideas on
any list. Mark archived; hide from every list, every count and every search; keep the rows.

**4c. Re-read the rows back after archiving** and report what is actually hidden — not what the
update statement claimed. **Report only what you re-read.**

**4d. Assert the negative:** an archived idea appears in zero lists, and a control unarchived idea
still appears in all of them. A hide that one read path forgets is worse than no hide at all.

## §5 — The opening commentary on the causes

⚠ **CC ranked this first of everything outstanding and the reasoning is right: it changes the shape
of the decision rather than the ergonomics of making it.** It is also Charlie's own strongest
finding from the walkthrough.

**The symptom:** the user is asked to choose between causes at a granular level with no account of
the terrain — what the evidence says, where it conflicts, how complex the problem is, and how the
pieces might fit into one coherent strategy.

**Build: a commentary that opens the causes section**, before any choice is offered, covering:

- **What the evidence says**, and where the sources disagree with each other.
- **The level of complexity** — whether this is a single-cause problem or one where several causes
  each bind.
- **How the pieces might fit together**, without making the choice.
- ⚠ **Contrary evidence named as contrary.** Charlie's own example is the standard: *"this quote
  suggests civil servants may not be inefficient — but he gives no hard numbers, there are plenty of
  numbers saying the opposite, and I have tracked down the figures he referred to and they no longer
  hold."*

**Constraints:**

- **It describes; it does not decide.** The guiding-policy mechanics land in 25-P and this must not
  pre-empt them.
- ⚠ **Assert the value, not the schema.** 25-N §8's lesson and 25-M's before it: `required` in a
  JSON schema means the key is present. A commentary field containing `""` passes every structural
  check. Assert it has substance and assert it mentions at least one point of conflict.
- **Report the cost.** This is another model call in the build. State what it adds per build in
  pence against the ~23p baseline.

## §6 — Date-checking a retrieved claim before relying on it

The standing content-quality failure: a single 2014 Lords remark that civil service productivity had
improved was accepted, used to change Lex's mind, and never questioned — not for its date, not for
its absence of figures, not against contrary evidence.

**Build the minimum that would have caught it:**

- **Every retrieved claim carries its date where the corpus knows it**, and a claim older than a
  stated threshold is flagged as needing checking against current figures rather than used as
  settled.
- **A claim with no figures behind it is labelled as an assertion**, not as evidence.
- **A claim that changes Lex's position must name what it was weighed against.** ⚠ If nothing was
  weighed against it, that is what it must say.

⚠ **Diagnose before building.** Report where in the pass sequence the acceptance happened, and
whether the date was available and ignored or was never retrieved. The fix differs completely
between those two.

## §7 — Measure the duplicate fetches, then decide

25-N's walk found `/panel` fetched twice (the second caller added by `ReportAdditions`) and
`/agenda` twice (pre-existing) — three heavy reads on one paint, with the first paint sitting
pending for several seconds on Charlie's idea.

**Measure first:** the time each of the four calls takes, and how much of the pending paint they
account for. ⚠ **A saving figure must come from a run that finished.** Then either de-duplicate or
report why it is not the cause. **Do not optimise before the measurement says these are the
problem** — a slow first paint has more than one possible cause and this is the one that happens to
be visible.

## §8 — Held for Charlie, do not run

- **`prisma/lex_25n_backfill_against.sql`.** Before Charlie runs it, **print what it would change**
  — the row count and a sample of ten rows with their current and proposed headings. It runs after
  §4, so that it does not operate on rows about to be archived.
- **Notes visibility.** Charlie has decided: **private only for the pilot, one list.** Build no
  sharing UI. ⚠ Structure it so that team-visible notes later become a **second list**, not a
  per-note switch — CC's own recommendation, and it is right: a per-note flag is a boundary the user
  must remember, and a mis-set flag leaks a private note with nothing on screen to have warned them.
  A list is a boundary they can see at all times.

## §9 — Acceptance criteria

- A build cannot begin unless the whole of it is paid for, and the refusal names the shortfall.
- A failed build returns its reservation; a completed one does not; both asserted.
- The pilot allowance is three builds and three re-runs, set as configuration.
- The resume control renders where a build is resumable — with the live resume declared unproven.
- "See this as others would" reaches a page that says honestly what it is.
- `/ideas/build` redirects; every probe that read it now reads `/ideas/create` and each was watched
  failing; any homeless assertion is named, not deleted.
- The archive list was shown before anything was hidden; archived ideas appear in zero lists; a
  control idea still appears in all of them; the rows were re-read.
- The causes section opens with a commentary that names conflicting evidence, and the assertion is
  on the value.
- A retrieved claim carries its date, an unsupported claim is labelled as an assertion, and a claim
  that changed Lex's position names what it was weighed against.
- The duplicate fetches are measured before anything is changed.
