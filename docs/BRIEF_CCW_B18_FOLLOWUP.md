# BRIEF — CCW-B18 FOLLOW-UP: the critique artefacts, the renderer, the lock, and the gate

**From:** CCh, 9 September 2026 · **For:** CC
**Written to disk** 2026-09-09 10:40 UTC, because a brief that exists only in chat does not
survive a `/clear` — `SEARCH_HANDOVER_BRIEF.md` §6, and it bit this project for real in August.

**Status of each item is recorded at the end of this file. Update it there, not in chat.**

---

## §4 (FIRST, BECAUSE IT GATES §1) — confirm before spending: is the fix actually running?

> *"The kernel fix is committed but Railway has served the same container since 3 September. No
> build result produced before that redeploy means anything. Confirm the redeploy from what is
> running — not from the repo — before any further kernel iteration is paid for. This is the
> error pattern that has cost this project twice already."*

### ✅ ANSWERED 2026-09-09 10:00–10:30 UTC — and the first half of the premise was wrong

**The fix was NOT committed.** Neither half of it existed in the repository:

| | at `HEAD` (`4adbe3d`) |
|---|---|
| `build.ts` — `kernelText()` | still read the canonical `Idea` columns |
| `field-machine.ts` — `currentFieldValues()` | **did not exist at all** |

`git log --all -S 'currentFieldValues' -- scrutinise-web/lib/lex/build.ts` returned **nothing** —
never committed on any branch. ⚠ **A Railway rebuild before this point would have built `HEAD` and
still not contained the fix**: a container with a new id, behaving identically to the old one. That
is the redeploy-vs-rebuild trap that already cost three days here.

**The fix itself was verified sound before committing:** `tsc --noEmit` clean, and
`check:b18-kernel-text` **36 passed, 0 failed, 2 controls fired, 0 dead** — a cold read over all
twelve report-run measures, all seven kernel sections present on each.

**Committed 2026-09-09 10:30 UTC as `02466cf`** (`fix(lex): the four critique passes were marking a
kernel the build never wrote`). ⚠ **NOT YET PUSHED** at the time of writing.

### ▶ THE CORRECTED ORDER — do not shortcut it

1. `git push origin Main` — ⚠ this also carries nine commits from the concurrent INGEST session
   (EDM signatures) that were sitting local-only. Their call, not ours.
2. Vercel: confirm the deployment is green **and Production**, then read the commit back from
   `https://www.scrutinise.org/api/health`. **Not `scrutinise.co.uk` — that domain 522s at the
   Cloudflare edge** (see `SEARCH_STATE_09SEP.md` §0).
3. **Rebuild `build-worker` FROM SOURCE.** Not `deploymentRedeploy`, which re-runs the same
   artefact. It has run `15bafe1f` since 3 September 10:36 UTC and is ~60 commits behind.
4. **Read the running commit back off the worker** before step 5. A restart proves a process came
   back, not which code it came back into.
5. Only then re-run anything.

---

## §1 — Appendix B and every critique number in the first draft are artefacts

CC's finding on `kernelText()` — that the four self-critique passes were reading canonical `Idea`
columns a build never writes, so they scored an empty kernel — means **every failed-kernel
statement in the first draft is a measurement of a blank input, not of the proposal.**

That includes the Equality Act's *"not a strategy… a list of actions"*, the *"two of nine strategy
tests passed"* figure, and the whole of what CCW pulled into Appendix B on 9 September. **None of it
can be published, and none of it can be cited as evidence that the critique works.**

⚠ The underlying measurement is wider than the report run: **16 ideas with a DONE build, 0 with a
complete kernel in the columns `kernelText` read, 15 with none of the seven kernel columns
populated** — and the same seven fields present in `IdeaFieldState` on 16 of 16. So this was true of
*every build ever run*, not only the twelve measures.

**What is needed from CC, in order:**

1. Deploy the fix — **per the corrected §4 order above, which supersedes "deploy the fix" as a
   single step.**
2. Re-run the four critique passes for **M-01, M-02 and M-06**.
3. Export the results.
4. State, for each, **whether the kernel passes on a complete input.**

Only then does the report have a defensible sentence about the critique.

---

## §2 — the renderer maps whole carry blobs to individual report headings

`passes_by_key/*/carry/*` holds scaffolding passed between passes, opening with instructions
addressed to the model — `═══ THE FINDINGS THEMSELVES ═══ … use it, name the finding rather than
the citation`. The build-JSON-to-markdown renderer was placing these blobs under report headings
such as *The law as it stands* and *What the courts have said*, where a character cap truncated
them. ⚠ **The cap is doing the work a content filter should do.**

**Fix:** the renderer should read the structured fields (`deepening/issues[].text`,
`evidence[].body`, `kernel`) and, where a carry blob is genuinely the only source, split it on its
`[FINDING]` / `[CONTRADICTS]` markers and place each finding under the heading it belongs to.
**Correctly mapped, the output is shorter and more accurate, not longer.**

CCW has already repaired the *symptom* in the second draft: 261 passages restored from content
fields, 162 closed at their last complete sentence because their source was scaffolding. **The
renderer itself is unchanged.**

---

## §3 — two drivers must not contend for one build row

The M-01 v4 failure — local driver died, Railway claimed the pass, resume attempts spun on *"already
claimed"*, build settled FAILED at 7/11, three thirds spent — **is a locking problem, not a
one-off.** A build row needs a single owner with a **lease that expires**, so a dead driver releases
it rather than blocking every resume.

⚠ This needs a schema column. Per `docs/CLAUDE.md` §12 and §21, **the schema change and its
migration ship together, in one commit, as early as possible** — not batched into an end-of-sprint
`commit-all.sh`.

---

## SETTLED AND VERIFIED — the build-ID correction

CCW-B18 §2 named M-03 Human Rights Act, M-04 Equality Act, M-05 civil service. **That mapping was
wrong;** §3 of the same brief correctly called M-01 the Human Rights Act.

✅ **Re-verified independently on 9 September** against both sources of record — the declared order
in `docs/report_run/lex_build_inputs.json` and each build JSON's own `idea.title`. **All twelve
agree.** `M-03.json` carries `idea.title = "The United Kingdom Supreme Court"`; "Supreme Court"
appears 541 times in it (case-insensitive, whole file), "Equality Act 2010" **zero** times.

| Build | Measure |
|---|---|
| M-01 | Human Rights Act 1998 and the European Convention |
| M-02 | Equality Act 2010 |
| M-03 | The United Kingdom Supreme Court |
| M-04 | The arm's-length body estate |
| M-05 | Judicial review of executive decisions |
| M-06 | The permanent, appointed civil service |
| M-07 | Operational independence of the Bank of England |
| M-08 | Diversity, equity and inclusion practice in the civil service |
| M-09 | Gender self-identification |
| M-10 | Publicly funded charities campaigning on government policy |
| M-11 | The Sentencing Council and sentencing guidelines |
| M-12 | The Great Repeal: the programme as a single instrument |

**The three measures worked in full in Part 4 are M-01, M-02 and M-06.** Corroborated on disk: those
three, and only those three, have two build JSONs each.

---

## STATUS

| § | state as at 2026-09-09 10:40 UTC |
|---|---|
| **§4** the gate | ✅ **ANSWERED.** Fix was never committed; now committed as `02466cf`, **unpushed**. Corrected 5-step order recorded above. |
| **§1** re-run the critique | ⛔ **BLOCKED** on §4 steps 1–4. Nothing re-run, nothing spent. |
| **§2** the renderer | ❌ **NOT STARTED.** Symptom repaired in the second draft by CCW; renderer unchanged. |
| **§3** the build-row lease | ❌ **NOT STARTED.** Needs a schema column — ship schema + migration together. |
| build-ID correction | ✅ **VERIFIED**, both sources, all twelve. |

**Also committed 2026-09-09 10:30 UTC, same session:** `c8b2fe1` — the build worker now **refuses to
start** under degraded retrieval rather than printing a warning above ten minutes of ordinary
progress output. That is the M-01-of-2-September cause (`FTS_SEARCH_URL` unset, build reported DONE
on 11 of 11 passes having retrieved nothing). `LEX_BUILD_ALLOW_DEGRADED_RETRIEVAL=1` keeps a
deliberate degraded run possible, by name.
