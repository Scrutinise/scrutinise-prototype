# CCW-B20 — push, rebuild from source, and run the critique passes

**From:** CCW (Cowork) · **To:** CC (Claude Code, Windows repo) · **9 September 2026, 11:45 BST**
**Repo:** `C:\Code\scrutinise-prototype` · **Supersedes CCW-B19 items 1 and 3.**

Charlie has authorised the push. All three concurrent sessions have confirmed their work is committed and safe to send: INGEST (EDM signatures, nine commits), SEARCH (S19, already on the remote at `0491e1a`), and the B18 session (seven commits, `02466cf`→`5b92b93`).

---

## 0. Standing rules that still bind

- Commit by explicit file path. Never `git add -A`, never a directory add. Two or more sessions share this tree.
- `commit-all.sh` is **spent**. Do not re-run it; its path lists lived in a scratchpad that has since been cleared.
- Verify against what is *running*, never against the repo. That rule has now failed three times in different disguises, most recently as "rebuild the worker" — which would have rebuilt a commit that did not contain the fix.
- Never sum the detection types. Never present a count as complete. Never say a provision or case is "no longer good law".

---

## 1. Push

⚠ **Do not trust any commit count in this brief.** It was 15 an hour ago, 16 after the follow-up brief was written, and the tree has been modified since by CCW writing report source through the device bridge. **Read it at the moment of pushing:**

```
git ls-remote origin Main          # the server's ref, not the cached one
git log --oneline origin/Main..HEAD
```

Print that list, then push. If anything in it is not from INGEST, SEARCH, the B18 session or CCW's report source, stop and say so before sending.

```
git push origin Main
```

## 2. The delivery checks — the push is not the delivery

Per CLAUDE.md §20:

1. Vercel: the deployment is **green AND Production**, not a preview.
2. Read the deployed commit back: `curl -s https://www.scrutinise.org/api/health`.
3. Confirm the boundary check still passes: `bash scripts/check-clean-build.sh --fast`.

⚠ **`/api/health` reports the Vercel app.** It says nothing about the Railway worker, which resolves its own environment. Step 3 below is a separate machine.

---

## 3. ⚠⚠ Rebuild `build-worker` FROM SOURCE, then read the running commit back

`build-worker` has served `15bafe1f` since 3 September 10:36 UTC.

**`deploymentRedeploy` re-runs the same artefact and will produce a container with a new id and identical behaviour.** That is the trap: the new id reads as evidence the fix is live. **Trigger a source rebuild**, so Railway builds the pushed commit.

Then, before anything is paid for:

- **Read the SHA the worker is actually running**, from the service itself.
- **Confirm that SHA contains both fixes** — `kernelText()` reading `currentFieldValues()`, and `build-worker.ts` calling `assertRetrievalConfig` rather than only `resolvedConfigLine`.
- **Report both**, as the SHA and the two symbols, not as "redeployed".

⚠ While you are there: `fts-serve` and `vector-serve` showed 25 consecutive `SKIPPED` Railway deployments. Say in one line whether they are serving what they should. They did not bite the M-01 re-run — retrieval engagement was measured at fts +136 / vector +136 — but they are the same class of thing.

---

## 4. ⚠ Answer this before spending anything

**Can the four critique passes — SMART, KERNEL_CHECK, LOGIC_CHECK, ADVERSARIAL — be re-run against an existing kernel, or does each require a full build?**

- If they run standalone, revalidating all twelve is cheap and should be done in one pass.
- If a full build is required, one pass over twelve is 36 thirds and three or four iterations on three measures is roughly 36 more.

**Report the answer and the current allowance balance before running anything.** The 142 figure predates the M-01 v4 failure that spent three.

---

## 5. Run the critique on a complete kernel — M-01, M-02, M-06

These are the three worked in full in Part 4: **M-01 Human Rights Act, M-02 Equality Act, M-06 the permanent, appointed civil service.** Verified against `lex_build_inputs.json` and each build's own `idea.title`, and corroborated by all three having two build JSONs on disk.

**For each, produce and export:**

| What | Why the report needs it |
|---|---|
| KERNEL_CHECK score, out of 9, with the failing criteria named | Replaces the withdrawn two-of-nine figure |
| LOGIC_CHECK verdict, and each defect | The claim that the system argues against itself rests on this |
| ADVERSARIAL and SMART output | SMART rated completed kernels WEAK on the trial run; if that holds it is evidence the critique is not rubber-stamping, and it should be printed |
| The alternatives generated along the way, separately | These are the "choices that require human decisions" the report exists to present |

**Constraint on iteration:** each pass must stay aligned with David's stated intention as recorded in `lex_build_inputs.json`. **An iteration that passes only by changing what the measure is trying to do is a fail, and is recorded as one.** That distinction is the whole value of the exercise; a kernel that passes by drifting is worse than one that fails honestly.

**Watch:** `goalKind` must be one of the four enum keys — `LAW_CHANGE`, `APPLICATION_CHANGE`, `INSTITUTIONAL_PRESSURE`, `UNSURE`. Free text resolves silently to "not stated". This has bitten once.

**⚠ Stop and report after these three, before extending to the other nine.**

---

## 6. Commit the second-draft report source

`docs\report_run\report_src_v2\` is untracked and was not in the six commits. It holds the whole second draft: eighteen source files, the volume-driven `build.js`, `mkpagemap.py`, `titles.txt`, four page maps, and the C7 research note.

**Commit it by explicit path, as its own commit, after the push.** The no-`git add -A` rule means nothing else will pick it up. Until it is committed, the second draft is on disk and in the claude.ai Project but not in git and not in the R2 backup.

Suggested message subject: `docs(report-run): the second draft — source, volume-driven build, and the C7 research`.

---

## 7. Housekeeping — all three approved by Charlie

**7a. Delete the ten stale `commit-*.sh`** in the repo root (`commit-lex-25f` through `25v`, `commit-graph-5-24`, `commit-statutory`). §12 says delete after a successful push. Do this after the push, not before.

**7b. Write the CHANGE_LOG entry for the kernel fix.** It is the most significant finding of the sprint and the CHANGE_LOG is the only shared record between concurrent sessions — the one place another session looks before repeating the mistake. Do not wait for CCW to write it.

**7c. Add the excluded artefacts to `.gitignore`** — `scripts/ingest/v33-vec-delta.jsonl`, `v35-vec-delta.jsonl`, `v36-vec-delta.jsonl`, `scrutinise-web/tsconfig.3c-check.tsbuildinfo`, and a pattern for `scrutinise-web/scripts/_*.ts` scratch scripts.

⚠ **Charlie's approval is conditional: "as long as we are mirroring anything we don't want to lose."** So before the gitignore lands, **write the three `vec-delta.jsonl` files to R2** alongside the existing corpus backup, and confirm they are there. 58 MB does not belong in git history, but it does not belong nowhere either. If any of the three is genuinely regenerable in a single command, say so with the command and it can be dropped instead — but say which, rather than assuming.

**7d. The raw EDM sweep trace.** The INGEST session offered to copy the 219-minute run trace (`edm-sweep3.log`, `edm-finish.log`) into `docs/` before its scratchpad was cleared. Every figure taken from them is already in `docs/INGEST_EDM_SIGNATURES_REPORT.md` and the CHANGE_LOG. **If the scratchpad is already gone, note it and move on** — nothing unrecorded was lost. If it is still there, copy them.

---

## 8. Then, and not before

**Item 2 — the renderer.** `passes_by_key/*/carry/*` blobs are being mapped into report headings. 100 of 263 truncated passages in Parts 4 and 5 traced to `carry` fields against 136 to `deepening/issues[].text`. Read the structured fields; where a carry blob is genuinely the only source, split it on its `[FINDING]` / `[CONTRADICTS]` markers and place each finding under the heading it belongs to. Correctly mapped, the output is shorter and more accurate.

**Item 3 — a lease on build rows.** One owner, expiring, so a dead driver releases rather than blocks every resume. It needs a schema column, so schema and migration ship together and early rather than batched at the end.

Neither blocks the critique run. Both can start while §5 is executing.

---

## 9. What comes back to CCW

Hand back as files under `docs/report_run/`, not in chat:

1. The worker SHA and the two symbol confirmations from §3.
2. The answer and allowance balance from §4.
3. The critique exports from §5, per measure, plus the alternatives as a separate file.

CCW will place them. The report currently carries no claim about the critique at all — Appendix B was withdrawn on 9 September because every score in it was taken against an empty kernel — and it stays that way until §5 lands.
