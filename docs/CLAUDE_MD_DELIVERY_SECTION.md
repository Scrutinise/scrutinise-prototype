# For CLAUDE.md — Delivery: the code is not the deploy

*Paste this in as its own numbered section. Charlie: hand CC this file with — "Add this to CLAUDE.md
as a new section, numbered to fit, and cross-reference it from the §12 git-discipline section."*

---

## N. Delivery — a sprint is not done until the running site says so

**The rule: every local check proves the CODE. Only a string read back off the running site proves
the DELIVERY. A sprint closes on the second, never the first.**

Three separate incidents, three different mechanisms, one shape — the code was correct, `tsc` was
clean, every check passed, and **the thing was not on the site**:

| When | What happened | Why nothing caught it |
|---|---|---|
| 6–9 Aug | Production served **three-day-old code** for a week. Every sprint in that window closed with "Charlie's browser re-test is the remaining gate" — **and none of those gates could have passed.** | Pushes were building as Previews, not Production. Every deployment was green. |
| 12 Aug | `build/` unanchored in `.gitignore` silently excluded a **whole new route directory** from the repository. | `git status` does not list ignored files. `git add` refusing it was the only signal. |
| 17–18 Aug | `lib/lex/build-cost.ts` was never committed. Production failed to build for ~10 hours; the live site fell back to a build predating the sprint. **Both Lex routes appeared broken to the user.** | `tsc` and `next build` were clean **locally**, because the file existed on the machine. |

⚠ **The third one is the instructive one: the local build passed on code the repository does not
contain.** A green local build says the files on this machine are consistent with each other. It says
nothing about what a clean checkout would do.

### The four checks that close a sprint

Run all four, in this order, and report each:

1. **Every file you created is committed.** Not `git status` — an ignored file never appears in it.
   Take the list of files the sprint created and run `git ls-files` against it, and
   `git check-ignore -v <path>` on anything missing. **Confirm the file, not the pattern**: a
   `build`-shaped rule swallows the directory `build/` *and* the file `build-cost.ts`, and reading
   the pattern is how the second one gets missed after the first is fixed.
2. **The remote has your commits.** `git merge-base --is-ancestor` against the server ref, not local
   `git status`. Three threads share this tree and one of them will have pushed since.
3. **The deployment is green AND is Production.** A green Preview is not a deploy. Read the
   environment column, not just the status.
4. **The running site serves your change.** Fetch a string that *this sprint* introduced and confirm
   it comes back — with a control that carries no such marker. **This is the only step that proves
   anything**, and the three incidents above would each have been caught here in under a minute.

### Two rules that follow

**Never report a sprint "done" on local evidence alone.** The honest sentences are *"pushed, and
verified live at <url> by reading back <string>"* or *"pushed; NOT verified live because <reason>"*.
Both are fine. *"Built, tsc clean, checks pass"* as a closing line is not, because it is the exact
report all three incidents produced.

**Never diagnose a user-visible fault before confirming what is deployed.** On 18 Aug two Lex routes
looked broken to Charlie and produced a plausible application-level hypothesis; the actual cause was
that production had been failing to build for ten hours and was serving code from before the sprint.
**Establish what is running, then debug it** — otherwise you are debugging code the user is not using.

### And a check worth building once

A CI or pre-push check that **fails when a source file imported by committed code is not itself
committed** would have caught incidents two and three outright. It is a short script against the
import graph, and it turns the whole class into something that cannot recur.

*(Companion rules: §12 on scoped commits, and the standing note that a push is not a deploy — this
section is that note, given the evidence and the procedure to go with it.)*
