# CCW-B20 — push, rebuild, and the critique that turned out to already exist

**From:** CC (Claude Code, Windows repo) · **To:** CCW · **9 September 2026, 11:35 UTC**
Brief: `docs/report_run/briefs/CCW-B20_push_rebuild_and_critique.md`

> **The headline for the report: nothing was spent.** §4 asked whether the critique passes can run
> standalone before committing to 36 builds. The answer turned out not to matter, because **all
> three measures already carry a complete-kernel critique** — including M-01, which the B18 report
> says has none. §5 is an export.

---

## 1. The push — done

`git ls-remote` before pushing: `0491e1a`. Local `HEAD`: `5b92b93`. Sixteen commits, and every one
accounted for against the brief's list:

| | |
|---|---|
| `62626f0` → `4adbe3d` | **nine INGEST** — the EDM signature sweep |
| `02466cf` → `5b92b93` | **seven B18** — the kernel fix, the worker guard, GRAPH 5, the C2/C3 tooling |
| already on the remote at `0491e1a` | SEARCH S19 |

Nothing unexpected, nothing from CCW's bridge in the commit range. Pushed; `git ls-remote` now reads
`5b92b93`; `git merge-base --is-ancestor` confirms it against the **server** ref rather than the
cached one.

⚠ The machine clock was cross-checked against an HTTP `date` header before any stamp was written
(11:11 UTC both). It has been ~14 hours out before.

## 2. The delivery checks

1. **Vercel green and Production** — `/api/health` returns `"env":"production"`.
2. **The deployed commit, read back:** `"commit":"5b92b93de2dd1e25f178645c6c65affdcf8aef82"`. ✅
3. **`scripts/check-clean-build.sh --fast`** — PASS, 0 cross-package files in the web program. ⚠ Run
   **before** the push, per §20 check 0, not after.

---

## 3. ⚠⚠ The worker — and the trap fired, through the door built to avoid it

**The worker is running `5b92b93de2dd`.** But getting there took two attempts and the first one is
the finding.

**`serviceInstanceDeployV2(serviceId, environmentId)` — the *source rebuild* mutation, not
`deploymentRedeploy` — returned SUCCESS on the OLD commit.** Deployment `a47cdcaa` went green in
four minutes with `meta.commitHash` still `15bafe1f7492`, the 3 September commit. Nothing in the
call, the response, or the deployment status said so. The brief warned that a new deployment id
would read as evidence the fix was live; **that is exactly what happened, and it arrived through the
mutation chosen to prevent it.**

The mutation takes a third argument. Named explicitly —
`serviceInstanceDeployV2(commitSha: "5b92b93…")` — deployment `13a413f3` built the right commit.
(`serviceInstanceDeploy` additionally takes `latestCommit: Boolean`.)

> **The rule this yields: read the sha, never the status and never the id.** Both deployments were
> SUCCESS and both had fresh ids. Only one of them meant anything.

### The two symbols, confirmed in the sha itself

| fix | where | in `5b92b93` |
|---|---|---|
| `kernelText()` reads the field states | `lib/lex/build.ts:3446` | `const fields = await currentFieldValues(ideaId)` ✅ |
| the worker refuses to start degraded | `scripts/build-worker.ts:173` | `assertRetrievalConfig(\`build-worker ${WORKER_ID}\`, …)` ✅ |

### And confirmed on the running container, not just in the repo

The new container prints a line the old one could not:

```
[build-worker bw-sjk8jw] retrieval configuration OK — [config] fts=… vector=… streams=… router=ON
```

That sentence is `assertRetrievalConfig`'s own output. The previous container (`a47cdcaa`, old code)
printed `[config] …` from `resolvedConfigLine` and then went straight to the email line. So the guard
is not merely committed, it is *executing*.

### ⚠ Why sixteen pushes never touched the worker

**`build-worker`'s `watchPatterns` are `[]`.** That is why it has served the same container since 3
September while every push produced a deployment record for the other two services. It has to be
told, every time. Worth a decision: either give it a watch pattern, or accept that the worker is
deployed by hand and say so somewhere a future session will read.

### fts-serve and vector-serve — one line, as asked

**They are serving what they should, and the 25 consecutive `SKIPPED` deployments are correct rather
than a fault:** their watch path is `scripts/ingest/search/**` and no commit in that run touched it,
so Railway records a deployment and skips the build while the working container keeps serving —
fts `served=4898`, vector `served=3874`, queue `0/32`, `0` rejections, both up since 28 Aug, both
`REACHABLE` and unsaturated on `b18-retrieval-preflight`.

---

## 4. Can the four passes run standalone? — **Yes. And it is moot.**

### The answer

**All four read an existing kernel and none of them requires a drafting pass to re-run.**

| pass | what it actually consumes | standalone? |
|---|---|---|
| `KERNEL_CHECK` | `kernelText(ideaId)` → `runKernelCompliance({ kernel, model, onUsage })` | **yes, trivially** — a string and a model |
| `LOGIC_CHECK` | `kernelText(ideaId)` → `runLogicCheck({ kernel, model, onUsage })` | **yes, trivially** |
| `ADVERSARIAL` | kernel + `costLinesFor` + `EvidenceItem` rows + `DeepeningPass.knownUnknowns` | **yes** — all stored rows of an existing build version |
| `SMART` | kernel + `elicitationContext(ideaId, userId)` + the RESEARCH pass's `carry` + `BuildFork` rows | **yes** — the carry is readable off the stored pass log via `carryInto` |

**What it would cost to enable:** `runOnePass` and the four pass functions are module-private in
`build.ts`. A standalone runner needs one `export` keyword and a `PassContext` assembled the way
`runNextPass:1359–1382` assembles it — roughly thirty lines. ⚠ It should *call* that construction
rather than restate it; a re-implemented context is how the marker quietly starts reading something
else.

### Two consequences worth having in writing

**A standalone pass costs ZERO allowance.** The counter is `IdeaBuild` rows at `status = 'DONE'`
(`allowance.ts`), and a standalone pass creates no build row. It costs real money and no credits.
Measured from the runs already on disk, one full critique set is roughly:

| pass | tokens in / out (typical of the three) |
|---|---|
| `KERNEL_CHECK` | 3,332–3,829 in / 1,955–2,736 out |
| `LOGIC_CHECK` | 2,381–2,878 in / 1,696–2,212 out |
| `ADVERSARIAL` | 15,609–26,811 in / 1,838–2,119 out |
| `SMART` | 31,264–33,813 in / 16,928–19,126 out — **five model calls, 3–5 minutes** |

So the three cheap passes are ~9k tokens together; `SMART` is the whole cost.

**⚠⚠ And a re-run of `SMART` changes what the other three then mark.** `SMART` does not only judge,
it **rewrites** — `setProposal` on up to five kernel fields. Before the B18 fix those rewrites were
invisible to `KERNEL_CHECK`, because they land in `IdeaFieldState` and the marker read the columns.
**Now that `kernelText` reads the field states, they are visible.** So "re-run the four passes" is
no longer an idempotent measurement: `SMART` moves the target the next three aim at. If a
single-variable comparison is wanted, run the three verification passes without `SMART`.

### The allowance balance

Read through `readAllowance()` rather than restated:

```
granted 200 · spent 70 · reserved 0 · remaining 130 · = 43 full builds
```

Explicitly granted (`buildAllowanceNote`: *"B18 kernel iteration — Restoration Programme second draft
— CCW-B18 §2 — set to 200 thirds … on 2026-09-09T03:16Z (was 60)"*), so the env var is irrelevant
here. 24 DONE builds since the epoch: 23 FULL + 1 REUSE.

⚠ **The brief's 142 predates four runs, not one.** 142 → 130 is twelve thirds: M-01 v3, M-02 v2,
M-06 v2 **and** M-01 v4. The M-01 v4 that the B18 report records as a failure is `DONE` in the
database and spent its three like the others.

---

## 5. The critique on a complete kernel — M-01, M-02, M-06

**Exported, not re-run.** Files:

- `docs/report_run/critique/B20_CRITIQUE_M-01.md`
- `docs/report_run/critique/B20_CRITIQUE_M-02.md`
- `docs/report_run/critique/B20_CRITIQUE_M-06.md`
- `docs/report_run/critique/B20_ALTERNATIVES.md` — the alternatives, separately, as §5 asks

Each carries the score with the failing criteria named, the logic verdict with each defect, the full
`ADVERSARIAL` and `SMART` output, the nine tests **imported from `KERNEL_TESTS`** rather than
retyped, the per-pass model and token counts, and the kernel re-derived at export time (labelled as
a re-derivation, since `kernelText` reads live rows).

| measure | build | KERNEL_CHECK | LOGIC_CHECK |
|---|---|---|---|
| **M-01** Human Rights Act 1998 | v4 | **8 of 9**, 1 failed | **holds**, 0 defects |
| **M-02** Equality Act 2010 | v2 | **8 of 9**, 1 failed | **holds**, 0 defects |
| **M-06** the permanent civil service | v2 | **6 of 9**, 3 failed | ⚠ **does NOT hold**, 4 defects |

### ⚠⚠ This corrects the B18 report, in our favour

B18_REPORT says *"M-01 has no kernel number on the fixed path"*. It was written while the row had
settled FAILED. **The row is now DONE and carries 8 of 9.** So the measurement no longer rests on
M-02 and M-06 alone.

**That was not taken on trust**, because the deployed worker — 3 September code, the code that reads
the empty columns — *did* resume the row at 04:15:52, and a number it produced would be an old-path
number wearing a new timestamp. Two independent checks settle it:

**(a) The prompt size.** A sparse kernel and a complete one differ by thousands of tokens, and the
step lands on exactly the three runs claimed as fixed-path:

| | v1 | v2 | v3 | v4 |
|---|---|---|---|---|
| M-01 `KERNEL_CHECK` tokens in | 1,827 | 2,096 | 2,400 | **3,829** |
| M-01 score | 2 of 9 | 1 of 9 | 1 of 9 | **8 of 9** |
| M-02 tokens in | 1,801 | **3,549** | — | — |
| M-06 tokens in | 1,841 | **3,332** | — | — |

**(b) The worker's own logs.** It has logged exactly two `25f kernel check done` lines in its
lifetime — 4 September, and 03:30:21 on 9 September, which is M-01 **v3**. It never marked v4.

⚠ **One honest gap: `SMART` on M-01 v4 is ambiguous and its recorded window is unreliable.** The
entry says 04:15:51.996 → 04:15:53.070 — 1.07 seconds, against 3–5 minutes on the other two — while
carrying five model calls and 33,465 input tokens. The resume rewrote `startedAt`; the usages are
the evidence that the work happened, the clock is not. The worker claimed a pass at 04:15:52, inside
that window. **`KERNEL_CHECK`, `LOGIC_CHECK` and `ADVERSARIAL` on M-01 v4 are safe to cite; `SMART`
on M-01 v4 should be cited only from its content, not as a timed fixed-path run.** M-02 and M-06
have no such ambiguity.

### ⚠⚠ M-06 confirms B18's qualification from a second direction, and this is the sentence for the report

**M-06's prompt nearly doubled — 1,841 → 3,332 tokens — and its score did not move at all: 6 of 9
both times.** The marker was handed roughly twice as much material and returned the same verdict.
That is a much stronger statement than "the effect was not uniform": it is measured on prompt size
rather than inferred from the words, and it says the old verdicts were **arbitrary** rather than
harsh. With a title and two lists in front of it the marker had less to fail *and* less to pass.

**So `SMART` still rating completed kernels WEAK is not rubber-stamping** — and it should be printed,
as the brief anticipated. M-01 v4's `SMART` verdict, verbatim:

> *"WEAK — The kernel identifies the basic steps but fails two critical tests. The pivotal obstacle
> is fluff ('political and institutional inertia' is a restatement of the problem, not an explanation
> for it). The coherent actions are not coherent; they are a repetitive list of the same three steps,
> failing the coordination test. The kernel misses the real, concrete obstacle: the ECHR is
> constitutionally embedded in the devolution settlements, and withdrawal would risk a crisis of the
> Union."*

That is a substantive objection about the devolution settlements, not a checklist failure.

### On §5's iteration constraint

**No iteration was run, so nothing can have passed by drifting from David's stated intention.** The
three exports are the passes as they stand. ⚠ If CCW wants M-06 iterated, note the `SMART`
interaction in §4 above: `SMART`'s rewrite of `pivotalObstacle` and `summaryCoherentActions` is
*itself* a change to what the measure says it is trying to do, made by a model, and it now reaches
the marker. That is precisely the drift §5 asks to be recorded as a failure — so an iteration should
diff the rewritten fields against `lex_build_inputs.json` before its score is believed.

### ⚠ `goalKind` — not verified this sprint

The brief flags that free text resolves silently to "not stated". **No build was run, so no
`goalKind` was written.** The existing rows were not audited; if the report leans on `goalKind`, ask
and it can be checked in one query.

---

## 6–7. Source, housekeeping

**§6 — the premise was out of date, and the commit says so.** `report_src_v2` was **not** untracked:
34 of its 38 files went in with `ba432cd`, in the sixteen commits just pushed. Genuinely outside git
were four files, plus four modified. Committed as `394d9c8` by explicit path.

⚠ **Deliberately NOT committed: `RESTORATION_1`/`_2` (modified) and `RESTORATION_3_The_evidence.pdf`
(new).** `build.js` moved in the same window, so these are outputs of a build still being changed,
and a half-rebuilt PDF committed as the second draft is worse than one plainly absent. **Your call —
say the word and they go in.**

**§7a** — the ten spent `commit-*.sh` deleted after the push (backed up to the session scratchpad
first). ⚠ `commit-all.sh` itself is still in the root — it was not on your list of ten, so it was
left rather than swept; §12 step 5 says it should go. `commit-ingest-edm-signatures.sh` is **tracked**
and was left alone.

**§7b** — CHANGE_LOG entry written (`CCW-B20 — THE KERNEL FIX IS LIVE …`), spliced idempotently.

**§7c** — ⚠⚠ **the three `vec-delta.jsonl` are NOT regenerable, and the command that looks like it
would regenerate them is the trap.** `tsx v33-vec-delta.ts --calibrate 300 --write --run <tag>`
writes the set of `corpus_sections` rows with **no vector at that moment**. The catch-up has since
run, so a re-run today yields a near-empty list — a different fact under the same filename. The
script's own header already says the before and after runs "are two different facts". So: **mirrored
first, ignored second.** `r2://scrutinise-legislation/research/ingest_worklists/`, uploaded and read
back byte-for-byte (49,369,956 / 3,267,256 / 6,603,451), with a control key confirmed absent so the
read-back could have failed. `.gitignore` names them **file by file, not by pattern**, and every new
rule was checked with `git check-ignore -v` against the file, with controls that must *not* match and
a sweep confirming no tracked file became ignored.

**§7d** — the INGEST scratchpad was **still there**. Copied to `docs/ingest_traces/`: `edm-sweep.log`,
`edm-sweep2.log`, `edm-sweep3.log`, `edm-finish.log`, `edm-rebuild2.log`.

## 8. Item 2 and item 3 — not started

The renderer and the build-row lease were gated on "neither blocks the critique". The critique turned
out to be an export, so this session's remaining time went into establishing the provenance of the
numbers rather than starting either. Both are untouched and unblocked.

---

## What is still Charlie's or CCW's

1. **The three PDFs** — commit them, or wait for the build to settle? (§6 above.)
2. **`build-worker`'s empty `watchPatterns`** — give it a watch path, or record that it is deployed
   by hand?
3. **Extending to the other nine** — §5 says stop and report. Reported. The other nine measures'
   critiques are all pre-fix and, per B18, **may not be fed back in either direction**; each would
   need one full build (3 thirds) to get a complete-kernel critique. Nine builds = 27 of the 130
   remaining.
