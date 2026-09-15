# CC brief — Step 4 decision, then commit and push

**15 September 2026. Follow-on from `CC_BRIEF_commit_report_for_laptop.md`. Your Step 1–3 report is accepted; this answers Step 4.**

**Good report.** Two of the things you found were not in the original brief and both changed the answer. The `.gitignore` finding in particular means the recommendation in that brief was wrong, and is corrected below.

---

## 0 — Before anything else: the token in the remote URL

You reported the remote as `https://<PAT>@github.com/Scrutinise/scrutinise-prototype.git`, with a live personal access token embedded in it.

**Do not change it in this task, and do not print it again.** It is being handled separately. Noted here only so it is not lost.

---

## 1 — The `.gitignore` decision: neither of the two options in the last brief

That brief recommended a directory-wide negation such as `!docs/report_run/report_src_v2/*.docx`. **That recommendation is withdrawn.** It was written without knowing why `*.docx` was there.

You established that the rule exists to keep nine private "THE STARKEY THESIS" lecture transcripts off GitHub. **A pattern-wide negation is therefore a disclosure risk, not a convenience** — it would un-ignore every `.docx` that ever lands in a negated directory, including any of those transcripts that are moved or copied there later. The rule is doing a real job and must keep doing it.

**Do this instead: negate the three filenames, and nothing else.** Append to `docs/report_run/.gitignore`:

```gitignore
# *.docx above keeps the private lecture transcripts off GitHub and must stay.
# The three built report volumes are public deliverables with fixed filenames,
# so they are named individually rather than un-ignoring a directory: a
# directory-wide negation would also expose any transcript later moved into it.
!report_src_v2/RESTORATION_1_The_programme_and_the_argument.docx
!report_src_v2/RESTORATION_2_The_measures_worked.docx
!report_src_v2/RESTORATION_3_The_evidence.docx
```

⚠ **Paths in that file are relative to `docs/report_run/`, not to the repo root** — check the existing entries and match their style. If they are written repo-root-relative, use the full `docs/report_run/...` form instead. **Confirm with `git check-ignore -v` on all three before committing, and paste the output.**

⚠⚠ **`"report_src_v2/Claude outputs/RESTORATION_1_....docx"` must stay ignored.** If your check shows it has become un-ignored, the negation is too broad — stop and say so.

**Why negation rather than `git add -f`:** these three files are rebuilt every time the report changes, and a force-add has to be remembered every time. It will be forgotten. Naming them in `.gitignore` is the version that survives the next rebuild.

---

## 2 — The duplicates: five stale files, and why this matters today

You found more than the brief anticipated. Here is the disposal, and the reasoning.

**There must be exactly one copy of each volume, and it must be the one in `report_src_v2/`.** Everything below is an older build under a name close enough to be picked up by mistake. Volume 2's top-level copy is 855 KB against today's 1,089 KB — it is the version without the recovered section 6.1, and it is the one that would be attached to an email by someone browsing the folder.

**Tracked — remove with `git rm` so the history keeps them:**

```bash
git rm docs/report_run/RESTORATION_1_The_programme_and_the_argument.pdf
git rm docs/report_run/RESTORATION_2_The_measures_worked.pdf
git rm docs/report_run/RESTORATION_3_Appendices.pdf
```

`git rm` is right here rather than deletion: these are in history, so nothing is lost and any of them can be recovered by SHA if it turns out to have been wanted.

**Untracked — delete from disk:**

```
docs/report_run/RESTORATION_3_The_evidence.pdf
docs/report_run/RESTORATION_1_The_programme_and_the_argument-1.pdf
docs/report_run/RESTORATION_1_The_programme_and_the_argument-2.pdf
docs/report_run/report_src_v2/Claude outputs/          (the whole folder)
```

⚠ **The `-1` and `-2` variants are almost certainly LibreOffice's collision-avoidance output** — it appends a number when it cannot overwrite a PDF because the file is open. They are partial builds, not versions.

⚠⚠ **Before deleting anything, list the four paths with sizes and dates and confirm none is newer than `report_src_v2/RESTORATION_3_The_evidence.pdf` (15 Sep, 2,213,197 B).** If any is newer, stop — that would mean a build landed somewhere unexpected and the assumption above is wrong.

**If deletion is blocked or you would rather not:** move them into `docs/report_run/_superseded/` instead and say so. Either outcome is acceptable; leaving them where they are is not.

---

## 3 — Corrections to the file list

- **`pagemap_vol3.json` exists** (235 bytes). Include it. The last brief was wrong to say it might not.
- **`20_appendix_a_citator.md` is tracked and unmodified.** Leave it exactly as it is. It is out of the build but stays in the repo.
- **`docs/report_run/HANDOVER_CCW_SESSION_3.md`** appeared in your untracked list and was not in the brief. Include it — it is session context worth keeping.
- **`docs/report_run/briefs/CC_BRIEF_commit_report_for_laptop.md`** and this brief: include both.

---

## 4 — Commit and push

Add by explicit path. **No `git add -A`, no `git add .`.**

One commit, message as given in the previous brief, with these two lines added under the bullets:

```
- .gitignore: the three built .docx volumes named individually as exceptions
  to *.docx, which stays in force for the private lecture transcripts
- removed superseded top-level copies of Vols 1-3; the live files are in
  report_src_v2/ and there is now one copy of each
```

Then push and report the SHA and branch.

---

## 5 — Verify, and say plainly if it failed

```bash
echo "--- the six volume files must all be in the commit ---"
git ls-tree -r --name-only HEAD -- docs/report_run/report_src_v2 \
  | grep -E 'RESTORATION_[123].*\.(pdf|docx)$'
echo "--- the private transcripts must still be ignored ---"
git ls-files -- docs/report_run | grep -i 'starkey.*thesis' || echo "OK: none tracked"
echo "--- nothing left uncommitted ---"
git status --short --untracked-files=all -- docs/report_run
```

⚠ **The second check is the one that must not fail.** If any lecture transcript has become tracked, **do not push** — report it immediately.

If the first check prints fewer than six lines, the volumes are not in the commit and the laptop will not get them. Say so rather than reporting success.

---

## What to report

1. `git check-ignore -v` output for the three `.docx` files and for the `Claude outputs` one.
2. The size-and-date listing of the four files before you deleted them.
3. What you committed, what you removed, the SHA and branch.
4. The Step 5 verification output in full.
