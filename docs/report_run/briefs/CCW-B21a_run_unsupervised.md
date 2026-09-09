# CCW-B21a — addendum: run the four tracks unsupervised

**9 September 2026, 13:40 BST. Read with CCW-B21, which this does not replace.**

**Charlie is away for a few hours and has authorised CC to run all four tracks and everything consequent on them without stopping to ask.** This addendum sets the boundaries of that authority, because "do not stop" needs edges or it becomes "guess".

---

## What CC may do without asking

- **All four tracks in CCW-B21**, in any order, in parallel across sessions.
- **Commit and push**, as often as useful. Explicit file paths only; no `git add -A`, no directory add.
- **Deploy to production**, subject to the check below, which is not optional.
- **Spend up to 30 thirds** of the 130 remaining — ten full builds. Standalone critique passes cost nothing and are not counted against it.
- **Run the four critique passes on the other nine measures** (M-03, M-04, M-05, M-07 to M-12) and export them the same way as M-01, M-02 and M-06. They cost nothing and the report can use all twelve.
- **Fix anything found broken along the way**, including in another session's files, provided the fix is committed separately with its own message saying what it was and that it was not this session's work.

## The one check that is not optional

**After every deploy, read `meta.commitHash` and confirm it is the commit intended.** Not the status, not the deployment id — both were `SUCCESS` with fresh ids this morning and one of them meant nothing. If the hash is wrong, redeploy naming the third argument, and read it again.

**And for the worker specifically**, confirm the running container prints `retrieval configuration OK …`. That line cannot be produced by a container built before this morning, so it is proof rather than inference.

## What CC must stop for

1. **The build-row lease.** It needs a schema column on production. Do not start it, whatever else finishes.
2. **Anything that deletes or overwrites data** that is not regenerable — the `vec-delta` lesson applies generally. Mirror first, verify the mirror by reading it back, then act.
3. **Spending beyond 30 thirds.**
4. **Any change to the twelve measures' inputs** in `lex_build_inputs.json`. Those are David's stated intentions and are not CC's to adjust; a kernel that only passes by changing them is a fail, recorded as one.
5. **Anything that would alter what the report asserts** without CCW placing it. Export it, and say so.

## Write findings to disk, not to chat

A brief that existed only in a conversation is what cost this project an hour this morning. Everything goes to `docs/report_run/`, and the running record goes in `docs/CHANGE_LOG.md` as it happens rather than at the end.

---

## One addition to track 4a — the cost module

Charlie's decision, in his words: **"Cost and benefit for now, but upgrade to include human cost and benefit going forward."**

So there are two parts, and only the first is CCW's:

- **Now:** the printed heading is **"Cost and benefit"**. CCW has already changed it in the report. Duration stays — but as one of the workings inside the section, not in the heading. That is done and needs nothing from CC.
- **Going forward:** the module itself should be widened so that it covers the human costs and benefits and not only the financial ones. At present its own definition says it is *"a purely financial view, which leaves out the human costs and benefits entirely"*, which is why the heading cannot yet say more than it does.

⚠ **Do not rename the module in the product to anything promising a cost-benefit analysis until it actually attempts the human side.** A heading that claims more than the module delivers is the same defect as a count presented as complete. When the module is widened, the heading can widen with it.

The cost route is still unbuilt — `costSummary` is starved and `COST_DURATION` was empty on all twelve — so this is a design note for whoever builds it, not a request to build it today.

---

## What CCW is doing meanwhile

Building the replacement for the withdrawn Appendix B from `docs/report_run/critique/`, correcting the transcript-corpus figure in Part 1, verifying every quotation in the research notes against a primary source, and drafting illustrative clauses for M-01, M-02 and M-06.

**None of that touches anything in the four tracks.** CCW writes only to `docs/report_run/report_src_v2/` and to the built PDFs in `docs/report_run/`. If CC needs to commit those, commit them by explicit path; do not edit them.
