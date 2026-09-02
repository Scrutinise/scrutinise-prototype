# CCW-B17 — the twelve are built

**2 Sep 2026, 16:27 UTC.** Eleven builds run on the full retrieval configuration, exported, and
verified. **No failed pass in any of the eleven.** Allowance left: **3 thirds.**

Files: `docs/report_run/builds/M-01.json` … `M-12.json`, plus `M-01_v2_keyword_only.json` — the
keyword-only baseline, preserved before anything could overwrite it.

---

## The twelve

| ref | rows | cited | dur | Q | findings | contra | gaps | deepening |
|---|---|---|---|---|---|---|---|---|
| M-01 v2 *(keyword only)* | 73 | 59 | 611s | 7 | 30 | 7 | 9 | 89 |
| M-02 Equality Act | 107 | 91 | 875s | 6 | 80 | 6 | 9 | 46 |
| M-03 Supreme Court | **128** | **111** | 710s | 6 | **94** | 4 | 16 | 46 |
| M-04 Quangos | 103 | 89 | 692s | 6 | 78 | 3 | 9 | 46 |
| M-05 Judicial review | 109 | 96 | 886s | 6 | 58 | 2 | 7 | 50 |
| M-06 Civil service | 118 | 103 | 719s | 7 | 70 | 6 | 8 | 41 |
| M-07 Bank of England | 119 | 105 | 594s | 7 | 87 | **10** | 10 | 46 |
| M-08 DEI | 110 | 97 | 629s | 6 | 69 | 1 | 16 | 48 |
| M-09 Gender self-ID | 83 | 68 | 613s | 7 | 55 | 1 | 12 | 39 |
| M-10 Charities | 75 | 60 | 701s | 6 | 48 | 1 | 13 | 48 |
| M-11 Sentencing Council | 96 | 78 | 575s | 7 | 60 | 7 | 16 | 39 |
| M-12 The Great Repeal | **52** | **39** | 576s | 7 | 39 | 7 | 8 | 48 |
| **total (M-02…M-12)** | **1,100** | **937** | | | | | | **497** |

---

## 1. What the router was worth

The comparison B17 §2 predicted, though **not the controlled one** — see the caveat below.

| | rows | cited | `by_source_type` |
|---|---|---|---|
| **M-01 v2** keyword only | 73 | 59 | committee 30 · debate 22 · **unattributed 14** · **legislation 3** · SI 2 · **caselaw 1** · bill 1 |
| **M-02** full config | 107 | 91 | **caselaw 33** · **legislation 18** · debate 17 · unattributed 16 · committee 13 · guidance 8 · SI 1 · IA 1 |

**Case law 1 → 33. Legislation 3 → 18.** Two source types appear that keyword-only never produced —
`GUIDANCE` and `IMPACT_ASSESSMENT` — and later builds add `EXPLANATORY_NOTE`, `BILL` and
`CONSULTATION`. ORIENT retrieved 240 against 48.

CCW's diagnosis in §2 was right and right for the stated reason: *"fourteen unattributed rows is what
an unscoped query looks like."*

⚠⚠ **THIS IS SUGGESTIVE, NOT MEASURED, AND MUST NOT BE PRINTED AS MEASURED.** M-01 and M-02 are
different measures. A single-variable test needs the same measure with only the configuration
changed — which is exactly what **M-01 v3** would have been, and which the allowance could not
afford at the time. **3 thirds remain, so it is affordable now**, and it would convert this into the
measured statement B17 called "the first this project has had".

The cross-measure support is nonetheless eleven builds deep: every full-config build returns case law
and legislation in double figures where the keyword-only baseline returned 1 and 3.

## 2. The classification and the evidence agree without being made to

CCW's B15 §5 rule — *use the instrument the proposer names or clearly implies; `UNSURE` where he
names none* — is visible in the retrieval profiles:

- **`LAW_CHANGE`** measures return legislation and case law in double figures.
- **`APPLICATION_CHANGE`** — M-08 returns **guidance 24**, the highest of the run, and the lowest
  contradiction count. The complaint is about practice, and retrieval went where practice lives.
- **`UNSURE`** — M-10 returns **legislation 5**, the lowest of the run, and debate and committee
  material about the problem rather than legislation implementing a remedy.

Two independent routes agreeing is worth more than either alone.

## 3. ⚠ Three thin builds that are findings, not shortfalls

**A reader comparing row counts across the twelve will misread these unless told.**

- **M-09 gender self-identification — 83 rows.** Asked all seven questions, reviewed the full 600
  sources, was not truncated, and came back with 1 contradiction and 12 gaps. **That is what
  searching for something never enacted looks like.** Three independent routes now agree: CCW's
  reading, B12's provision retrieval (the Act in force is the GRA 2004, requiring a diagnosis and a
  panel), and a full-config build that looked hard and found little.
- **M-10 charities — 75 rows, legislation 5.** He names no instrument, so retrieval has nothing
  statutory to converge on.
- **M-12 the Great Repeal — 52 rows, the lightest.** ⚠ This is the **master scope statement**, and
  its thinness is the same finding B5 reached from the other end: the programme's scope is *temporal*
  (1997–2010), not a list of instruments, so there is no single statute for retrieval to find. **The
  omnibus measure is the least evidenced of the twelve, and that is the point rather than a defect.**

## 4. ⚠ The spend ceiling truncated five of eleven

M-02, M-03, M-04, M-05, M-08 and M-10 asked **6 questions, not 7**, most reporting *"stopped at its
own spend ceiling"*. M-06, M-07, M-09, M-11 and M-12 asked all seven.

**So some stated gaps are unasked questions rather than unanswered ones, and the build output does
not distinguish them.** M-01 v2 on keyword-only asked 7 — richer retrieval costs enough per question
that a question is sometimes dropped. Worth knowing before the gaps sections are read as coverage
statements.

## 5. Configuration, and how it was verified

Set on the Railway `build-worker`, read back from the API:

```
LEX_VECTOR_STREAMS = legislation,debates,committees,caselaw
LEX_QUERY_ROUTER   = 1
```

Previous values recorded to `scrutinise-web/.b17-worker-vars-before.json` **before** the change —
both `null`, meaning **absent**, which is a distinct state from empty and is restored by deletion,
not by blanking. `b17-set-worker-retrieval.ts --revert` does exactly that.

⚠⚠ **B17 step 2's verification could not have succeeded, and the stop-loss fired on it.** The
`[config] … fully-configured` banner exists only in the **uncommitted working-tree** version of
`build-worker.ts` (another session's in-flight edit at lines 43/133); `git show HEAD:…` has no such
import. Railway builds from the repository, so the deployed worker cannot print it whatever its
configuration. Its absence was evidence about the verification path, not about the config — the same
class CCW named for `sync-worker-retrieval.ts`.

Verified instead by the route that was going to be run anyway: **the evidence profile of the next
build**, which shifted exactly as §2 predicted.

## 6. Two bugs of mine, and where the margin went

- **`claimBuild` requires `framing`.** Fixed in the resume path when M-01 hit it; **the new-idea path
  was left passing `undefined`**, so M-02 — the first new idea after the fix — failed identically,
  after creating its Idea row. One fix, two call sites, only the site that had already failed got it.
- **`b14-drain`'s guard was right and my architecture was wrong.** It reported "nothing moved" and
  stopped the run — correct, because the Railway worker claims a QUEUED row within ~5s and a local
  `--once` drain was never going to move anything. Replaced by waiting on the **row**, which is true
  whichever worker runs it.

Both created build rows before failing, and a created build spends. **That is where the margin went**
— from ~39 thirds to exactly 33 for 11 builds. It recovered to 3 spare because later builds ran
faster than budgeted.

## 7. Housekeeping

- `docs/report_run/builds/` is git-ignored; all 13 files confirmed ignored by `git status`.
- ⚠ `.env.backup-b15` was **not** ignored when created — a secrets file one `git add` from the
  history. Closed under `.env.*` in the B15a commit. Nothing leaked.
- The `[config]` banner import fix for `build-worker.ts` is **not** made here: that file is modified
  in the tree by another session, and §12 applies.
