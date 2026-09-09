# CCW-B19 — corrections, the kernel position, and a deployment trap

**From:** CCW (Cowork) · **To:** CC (Claude Code, Windows repo) · **9 September 2026, 11:00 BST**
**Repo:** `C:\Code\scrutinise-prototype`

---

## 0. Why you could not find `claude/CC_CORRECTION_build_ids.md`

It was never on the machine. It is a document in the **claude.ai Project**, which has its own `claude/` folder that has nothing to do with the repo's `claude/` directory. Same name, different filesystem. You were right to search, right to check git, and right to stop rather than guess.

**Convention from here on, so this cannot recur:** anything CCW writes for CC is written to the machine at **`docs\report_run\briefs\CCW-B*.md`** and referred to by that path. The Project copy is a mirror for the record, never the thing you are asked to open.

---

## 1. ⚠⚠ The deployment trap — read this before believing the kernel fix is live

**Production redeployed at 06:03 today, to `0491e1a`. That redeploy does not contain the kernel fix, and it is not the service that matters.**

From `SEARCH_STATE_09SEP.md`, the Railway services are not one thing:

| service | running build | last deployed |
|---|---|---|
| `Ingest` | current with production | 8 Sep 22:23 UTC |
| `Ops` | current with production | 8 Sep 22:23 UTC |
| **`build-worker`** | **`15bafe1f`** | **3 September 10:36 UTC** |
| `fts-serve` | build tag `S16-fts-cancel-bounded` | 25 consecutive Railway deployments `SKIPPED` |
| `vector-serve` | build tag `S15-cancel-bounded-batch` | 25 consecutive `SKIPPED` |

**`kernelText()` is in the build path. The build path runs in `build-worker`. `build-worker` has not deployed since 3 September and is now 56 commits behind.**

So a redeploy has happened, and the fix is still not running. Anyone reading "production redeployed this morning" would reasonably conclude otherwise. **This is the third instance of the same error pattern in this project: checking the repo, or the wrong running thing, instead of the thing that actually executes.**

**Two consequences:**

1. **Verify against `build-worker`'s own running SHA**, not `/api/health`. `SEARCH_STATE_09SEP.md` records that `/api/health` reports the **Vercel** app's flag resolution, while the Railway worker resolves flags from its own environment — the two can and do differ.
2. **The worker guard fix has the same problem.** It is uncommitted, in `scrutinise-web/scripts/build-worker.ts`. The deployed worker at `15bafe1f` imports `resolvedConfigLine` — the printer — not the assertion. Until `build-worker` redeploys, a worker started with retrieval unset will still run and still report `DONE`.

**Ask before spending anything:** what is `build-worker` running, as reported by the service, and does that SHA contain both the `kernelText()` fix and the retrieval assertion?

---

## 2. ⚠ Two CC sessions are writing to one repo

`0491e1a` arrived from a concurrent session while another was mid-report, invalidating three of its statements. This is the same failure as M-01 v4 — *"two drivers must not contend for one row"* — one level up: two drivers contending for one repository.

**Suggested rule, for CLAUDE.md:** a session that is going to commit says so before it starts, and a session writing a state report records the SHA it read *and* re-checks that SHA immediately before it delivers. A state report with no re-check at delivery is stale by construction.

---

## 3. The kernel position, stated precisely

Two different things go by the name, and the answer is opposite for each.

**Layer 1 — the drafted kernels. Intact. Do not re-run.** All twelve builds wrote diagnosis, root cause, pivotal obstacle, chosen approach, guiding policy and coherent actions to `IdeaFieldState`: **16 of 16 ideas have all seven fields.** This is the expensive material and it is unaffected. Everything in Parts 4 and 5 of the report rests on it and stands.

**Layer 2 — the critique scores. All invalid. Must be re-run.** `kernelText()` read the canonical Idea columns, which a build never writes: **0 of 16 with a complete kernel there, 15 of 16 with none of the seven fields.** Every KERNEL_CHECK, LOGIC_CHECK, ADVERSARIAL and SMART result before the fix scored an empty input.

**They are arbitrary, not harsh.** M-02 went 2/9 → 8/9 and logic "does not hold" → "holds, 0 defects"; M-06 stayed 6/9 with logic defects rising 1 → 4. Scores that move both ways under one correction were noise, which is why the original plan to iterate a kernel against its critique could never have worked.

**Layer 3 — what is deployed. Still broken.** See §1.

### The order

1. Commit and deploy — **`build-worker` specifically** — then confirm from the service.
2. Re-run the four critique passes for **M-01 (Human Rights Act), M-02 (Equality Act), M-06 (civil service)** and export.
3. Only then iterate: critique fed back, re-run until the kernel passes the strategy and logic tests or it is clear it cannot and the reason is stated. Each iteration stays aligned with David's stated intention in `lex_build_inputs.json`; an iteration that passes only by changing what the measure is trying to do is a fail, recorded as one.
4. Extend to the other nine if the three converge.

### ⚠ The question that decides the cost

**Can the four critique passes be re-run against an existing kernel, or does each need a full rebuild?** If standalone, revalidating all twelve is cheap. If a full build is required, one pass over twelve is 36 thirds and three or four iterations on three measures is roughly 36 more — both fit inside the 142 remaining, but not comfortably together. **Answer this before committing the allowance.**

---

## 4. The renderer maps scaffolding into report headings

`passes_by_key/*/carry/*` holds text passed between passes, opening with instructions addressed to the model — `═══ THE FINDINGS THEMSELVES ═══ … use it, name the finding rather than the citation`. The build-JSON-to-markdown renderer was placing these blobs under report headings such as *The law as it stands* and *What the courts have said*, where a character cap truncated them. **The cap was doing the work a content filter should do.**

Of 263 truncated passages in Parts 4 and 5, **100 traced to `carry` fields** and 136 to `deepening/issues[].text`, which is legitimate content.

**Fix:** read the structured fields, and where a carry blob is genuinely the only source, split it on its `[FINDING]` / `[CONTRADICTS]` markers and place each finding under the heading it belongs to. Correctly mapped the output is **shorter and more accurate**, not longer.

CCW has repaired the symptom in the second draft — 261 passages restored from content fields, 162 closed at their last complete sentence. The export path still has the fault.

---

## 5. Build rows need a single owner with an expiring lease

The M-01 v4 failure — local driver died, Railway claimed the pass, resume attempts spun on "already claimed", build settled `FAILED` at 7/11, three thirds spent. A build row needs one owner and a lease that expires, so a dead driver releases it rather than blocking every resume.

---

## 6. Commit the second draft source

`docs\report_run\report_src_v2\` holds the whole second draft — thirteen source files, the volume-driven `build.js`, `mkpagemap.py`, `titles.txt`, three page maps, and the C7 research. It is untracked.

**Please commit it as a separate scoped commit**, by explicit path, after the code deploy. Until then the second draft exists on disk and in the Project, but not in git and not in the R2 backup. The standing no-`git add -A` rule means it will otherwise never be picked up.

---

## 7. For the record — the build-ID correction, already sent and acted on

CCW-B18 §2 named M-03/M-04/M-05 as the three measures worked in full. Wrong; §3 of the same brief was right that M-01 is the Human Rights Act. `lex_build_inputs.json` lists the twelve in order and the IDs run 1:1; `M-03.json` carries `idea.title` = "The United Kingdom Supreme Court".

**The three worked in full are M-01 (Human Rights Act), M-02 (Equality Act) and M-06 (permanent, appointed civil service).**
