# AMENDMENT — to `BRIEF_25B.md`, plus one blocker and one small fix

**Written:** 19 August 2026. **Read alongside the 25-B brief; where they differ, this wins.**

---

## §A — `/ideas/build` IS STILL DOWN. Fix it before anything else in 25-B.

Charlie, signed in on production this morning: **"Could not start a session. Please refresh."** —
unchanged from two days ago. He cannot run the premise test, which means nothing built on top of 25-A
can be judged.

**This is now the oldest open item on the project and it has survived one fix attempt.** Treat it as
the sprint's first task, not a side issue, and **do not report 25-B done while it is unfixed** — a
build pipeline nobody can start is not shippable however good the passes are.

Per the new CLAUDE.md delivery section, in this order:

1. **What is actually deployed?** Confirm a green **Production** deployment and read a 25-A-only string
   off `scrutinise.org`. Yesterday's failure was a file that had never been committed
   (`lib/lex/build-cost.ts`), so the live site was running pre-sprint code. **If that is still true,
   that is the whole bug** — and the fix is the commit, not the route.
2. **If 25-A IS deployed and the route still fails**, read the actual server error. Candidates, in
   order: the three 25-A tables (`IdeaElicitation`, `IdeaBuild`, `BuildFork`) missing from the
   *production* Neon database — they were applied from a build session and `whichdb` must confirm the
   host; then the session-creating POST; then idea creation.
3. **Fix the message either way.** *"Could not start a session"* tells the user nothing and us less.
   It carries a reason and logs the underlying error with a correlation id.
4. **Then walk it in a browser, signed in**, and say so.

## §B — Builds move to the Railway worker (supersedes §1 of the 25-B brief)

Charlie's decision, and the right one: **B, not A.** The 25-B brief recommended chaining one pass per
web request as the quick route; that stands only as a fallback if the worker proves awkward, and it
should be documented as such rather than built.

**Why the worker is right.** A ten-minute job should not depend on a browser tab staying open. The
user starts a build, closes the laptop, and comes back to a finished proposal. That is the natural
interaction for work of this length, it removes the 300-second ceiling entirely rather than working
around it, and Railway already exists and is paid for.

**What to build:**

- The build runs **end to end on the Railway worker**, not in a Vercel request. The web app enqueues
  it and returns immediately.
- **Everything already specified stays**: incremental persistence per pass, honest status, per-pass
  ceilings, spend recorded per pass, resumable from the last completed pass.
- **The status is still read from the `IdeaBuild` row**, so the existing polling and progress display
  work unchanged — the client does not need to know where the work happens.
- **A build must survive the user leaving.** That is the point of the change, so test it explicitly:
  start a build, close the tab, return, and find it finished.
- ⚠ **Watch the concurrency.** A build fires 10–20 searches and the vector service handles four at
  once. One build must not saturate the search layer for everyone; if batching (Search's S4 §3) has
  not landed, throttle the build's own searches rather than assuming.

## §C — Tell the user when it is done (new, small)

Charlie's question, and with the worker doing the work it becomes worth having:

1. **In-page** — the build completes and the page updates itself, whether or not the user has been
   watching. This is free once the row is the source of truth.
2. **Browser notification** — the Web Notifications API, on a permission the user grants once, so a
   completed build raises a notification even in a background tab. Cheap and genuinely useful for a
   ten-minute job.
3. **Email** — via Resend, which is already wired. **Off by default with an opt-in on the build
   screen** ("email me when it's done"), because an unrequested email for a two-minute job is a
   nuisance and for a fifteen-minute one is a courtesy.

Do 1 and 2 in this sprint; 3 only if it is genuinely quick, since the plumbing exists.

## §D — The admin page has no way back (small, unrelated, do it anyway)

`/admin` renders its own tab bar and **no site navigation and no home link** — once you are there the
only way out is the browser's back button. Give it the standard site header, or at minimum a
"← Scrutinise" link to the dashboard. Two minutes, and it has annoyed Charlie for weeks.

## §E — Acceptance criteria, added to the 25-B list

- `/ideas/build` loads and completes a build **on production, signed in**, walked in a browser.
- The cause of the session failure is named in the CHANGE_LOG.
- A build runs on the worker, survives the tab being closed, and is found finished on return.
- The page updates itself on completion; a browser notification fires when permission has been given.
- `/admin` has a way back to the rest of the site.
