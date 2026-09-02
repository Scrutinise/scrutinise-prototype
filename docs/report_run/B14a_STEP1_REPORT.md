# CCW-B14a step 1 — M-01 run, and the thing that stops the other eleven

**2 Sep 2026, 12:04 UTC.** M-01 built, exported, and **the remaining eleven have not been started.**

> ## ⚠⚠ STOP — the run must not continue as configured
>
> **M-01 was built with no corpus access at all.** Both retrieval legs were dead. The build
> completed `DONE`, 11/11 passes, no failures, and produced **0 citations and 0 URLs**.
> Twelve builds in this state would cost £3.00 and 36 thirds of allowance and be unusable as
> evidence for a report whose cardinal rule is that every legal assertion resolves to a corpus row.

---

## 1. The blocking finding — a third pre-flight, which neither brief names

The worker printed it at line 3 of its own run:

```
[config] fts=UNSET vector=vector-serve-production.up.railway.app streams=NONE router=OFF DEGRADED(3)
```

From `lib/lex/harness-preflight.ts`, in its own words:

| flag | state | what the code says it means |
|---|---|---|
| `FTS_SEARCH_URL` | **unset** | *"the FTS leg throws; keyword retrieval contributes NOTHING"* |
| `VECTOR_SEARCH_URL` | set ✔ | reachable |
| `LEX_VECTOR_STREAMS` | **empty** | *"dense retrieval is OFF on every stream, **silently**"* |
| `LEX_QUERY_ROUTER` | **off** | *"every query fails open; per-stream scoping AND dense fusion are skipped"* |

⚠ **`VECTOR_SEARCH_URL` being set is what makes this deceptive.** With `streams=NONE` the dense leg
is off regardless, so the one variable that *is* configured buys nothing.

**Measured, not inferred:** the RESEARCH pass logged `searchesBroke: 18, results: 0`, and the log
carries eighteen instances of `[fts-search] search failed — returning empty, NOT a stub:
FTS_SEARCH_URL not set`.

### The guard for this exists and is one import away

`harness-preflight.ts` exports **`assertRetrievalConfig()`**, which *refuses to run* when degraded:

> `[harness] REFUSING TO RUN — retrieval is degraded in N way(s)`

`build-worker.ts:43` imports only **`resolvedConfigLine()`** — the printer. It states the degradation
and proceeds. The two functions are in the same file, and the worker took the one that cannot stop it.

⚠ I have not changed `build-worker.ts`: it is **currently modified in the working tree by another
session**, and editing it under them is how this repo got a schema into production early.

---

## 2. The engine did not fabricate — and that is worth saying plainly

Given no retrieval, it reported the absence rather than filling it:

- **ORIENT** output: `0 sources — ⚠ at least one corpus search did not complete · 1 of 1 queries written`, and its `carry` sets `searchFailed`
- **RESEARCH** output: `7 questions asked; reviewed 0 sources; 0 findings; 15 stated gaps`
- **RESEARCH carry**: *"Nothing retrieved produced a finding. See the per-question account below."*
- **EvidenceItem rows: 9, all from SMART, `with_citation: 0`, `with_url: 0`**

So it produced a full kernel with **no sourced evidence and said so**. That is the instrument
behaving correctly under a broken configuration. It is still unusable as report evidence, and it is
exactly the condition that would produce more of the five fabrications B14a lists — but the failure
here is the environment's, not the engine's.

---

## 3. The four things B14a step 1 asks for

### (1) The export shape

`docs/report_run/builds/M-01.json` — **147,347 bytes**. Top-level keys:

| key | contents |
|---|---|
| `ref`, `sourcing`, `source_proposals` | provenance from your input row |
| `inputs_as_supplied` | **your row verbatim**, so the file is self-contained |
| `goal_kind_mapping` | supplied vs stored, and why — see §4 |
| `idea`, `elicitation` | as stored, incl. `problemGateFired` and a note on how it was set |
| `build` | id, version, status, framing, mode, timings, `durationMs`, failureReason, summary, uncertainties |
| `kernel` | `causes` (2), `coherent_actions` (4), diagnosis/guiding-policy field states, unresolved flags |
| `passes_by_key` | all eleven keys you named, `null` where absent |
| `passes_raw` | every pass object untouched — a field I did not think to name is still there |
| `passes_missing` / `passes_unexpected` | named absences, so "no ADVERSARIAL section" can't read as "it had nothing to say" |
| `pass_status`, `failures` | status + failureReason per pass, failures also hoisted to top level |
| `coverage` | ORIENT and RESEARCH output/activity/carry, raw |
| `evidence`, `evidence_summary` | every EvidenceItem; counts by pass, by status, with/without citation |
| `revise`, `causes_commentary`, `forks` (8), `field_states` (18) | |

⚠ **All 18 field states are `AWAITING_CONFIRMATION`.** The canonical `Idea` columns are empty after a
successful build — the drafted kernel sits in `IdeaFieldState` until a human accepts it. The export
carries both and says so; `dump:kernel`'s §0 warns about exactly this misreading.

**On `dump:kernel`:** you asked me to extend it rather than write a new exporter, and the intent was
right, but it renders **Markdown** for a human reviewer. Converting that back to keyed JSON would be
parsing prose we had just formatted. What I reused is the part worth reusing — the set of models it
reads — so the export covers the same ground rather than a subset I guessed at.

### (2) What one full build cost

**25.0p** · 46,061 tokens in / 33,425 out · from the worker's own settle line.

**Twelve = £3.00.** That is the arithmetic for the allowance decision, which is already made — see §5.

### (3) How long it took

**303 seconds — 5m 03s**, not the ten assumed. START 11:58:17 → END 12:03:23 UTC.

**Twelve serially ≈ 61 minutes**, plus enqueue overhead. Comfortably inside this afternoon, so there
is no case whatever for raising concurrency.

### (4) What the problem gate did

**0 of 12 problem statements fire.** Your separation of complaint from remedy worked.

⚠ **But a gate that never fires proves nothing**, so I ran the control on your `goalDetail` fields,
which are remedies by construction. **Only 1 of 12 fires there either.** Single-variable substitution
on M-01, changing nothing but the verb:

| text | gate |
|---|---|
| "**Repeal** the Human Rights Act 1998 and denounce the ECHR under Article 58." | silent |
| "**Abolish** the Human Rights Act 1998 and denounce the ECHR under Article 58." | **FIRES** |
| "**Scrap** …" | **FIRES** |
| "Denounce the European Convention on Human Rights." | silent |
| "Withdraw from the European Convention on Human Rights." | silent |
| "**We should** repeal the Human Rights Act 1998." | **FIRES** |

`SOLUTION_OPENERS` in `lib/lex/method.ts:214` lists `change|raise|lower|increase|reduce|ban|abolish|
introduce|create|require|mandate|fund|scrap|extend|legalise|criminalise|tax|subsidise` — and **not
`repeal`, `denounce` or `withdraw`**, the three characteristic verbs of this programme. The
deterministic arm cannot see the report's central verb.

⚠⚠ **Two qualifications, both load-bearing:**

1. The code comment says this is *"NOT a gate on its own — the model makes the judgement"*. Creating
   rows directly bypasses the chat flow, so **the model press was never exercised by this run**. What
   is reported is the deterministic arm only.
2. `problemGateFired` in the database is **measured, not defaulted** — set from `looksLikeASolution()`,
   the same function the elicitation calls. Left to its `false` default it would have read as "the
   gate was evaluated and stayed silent" when nothing had evaluated it.

**So the honest answer to your question is: on this evidence the deterministic gate would not have
fired on your inputs even if you had written them as bare remedies.** Whether that is a defect is
yours to judge; it is certainly not the instrument "separating diagnosis from remedy" on the strength
of this arm alone.

---

## 4. Two input issues needing your decision before the eleven

**`goalKind` is a four-key enum and none of your twelve values is a valid key.** The keys are
`LAW_CHANGE`, `APPLICATION_CHANGE`, `INSTITUTIONAL_PRESSURE`, `UNSURE`. `elicitationContext` resolves
the label with `GOAL_KINDS.find(g => g.key === row.goalKind)` and falls back to the string **"not
stated"** — so your prose written straight in would leave every build reading its goal kind as *not
stated* while the sentence sat unused one column over. Silent, and indistinguishable from a correct row.

M-01 is mapped to `LAW_CHANGE`. **Nothing was reworded** — the full remedy is in `goalDetail`, which
is what the build actually reads — and your wording is preserved verbatim in
`inputs_as_supplied`. **Proposed mapping for the twelve, for your confirmation:**

| | | | |
|---|---|---|---|
| M-01 `LAW_CHANGE` | M-04 `LAW_CHANGE` | M-07 `LAW_CHANGE` | M-10 `APPLICATION_CHANGE` |
| M-02 `LAW_CHANGE` | M-05 `LAW_CHANGE` | M-08 `APPLICATION_CHANGE` | M-11 `LAW_CHANGE` |
| M-03 `LAW_CHANGE` | M-06 `INSTITUTIONAL_PRESSURE` | M-09 `LAW_CHANGE` | M-12 `LAW_CHANGE` |

**`understanding` is not build input.** `elicitationContext` reads problem, goalKind, goalDetail,
ruledOut and ownKnowledge — never `understanding`. It is assembled from your own fields, restating
and inventing nothing, so the row looks to the product like one a person confirmed.

---

## 5. B14b §2 — the four allowance numbers

Read through `readAllowance()` itself rather than recomputed, because your trap #2 is exactly the
kind of rule a re-implementation gets subtly wrong.

**`cl@scrutinise.org`** (`32c15f4f-…`, 53 ideas):

| | |
|---|---|
| `buildAllowanceNote` set? | **YES — an explicit grant**, which is the only reliable signal |
| (1) grantedThirds | **60** |
| (2) spentThirds | **15** — non-zero, as you anticipated |
| (3) remainingThirds | **45** → 15 full builds |
| twelve need | 36 → ✔ **enough, 9 thirds spare** |

Note: *"One-off grant of 20 full builds — set to 60 thirds by cl@scrutinise.org on
2026-09-02T09:34Z (was 4)."* **The decision gate is already satisfied, and by the instrument you
recommended** — a per-user admin grant, not the env var.

⚠ `LEX_PILOT_ALLOWANCE_THIRDS` is **irrelevant** to this account precisely because the note is set —
your trap #1, confirmed live. `charlieleach1@gmail.com` runs on the default 12 and would be short by
24, so the account matters.

---

## 6. B14b §1 — visibility, and the browser cross-check

`visibility`, `status` and `stage` were **not set** and hold their defaults `PRIVATE` / `DRAFT` /
`STAGE_1`. M-01 appears in Charlie's own My Ideas list and nowhere else.

⚠ **One thing worth knowing: this is the production database.** `.env` points at Neon, which is the
app's live database — so M-01 is visible at scrutinise.co.uk now, not only locally.

**The cross-check is not yet done.** It is worth doing against a build with real retrieval rather
than this one, since M-01 will be rebuilt once the configuration is fixed and the interface has
nothing to show for eleven of the passes' evidence. Say the word and I will do it either way.

---

## 7. Housekeeping

- **`builds/` added to `docs/report_run/.gitignore` before the first export was written**, on the
  house rule already in that file. Verified with a real file that `find` sees and `git status` does
  not — not with `git check-ignore`, per that file's own comment.
- New: `scrutinise-web/scripts/b14-preflight.ts`, `b14-enqueue.ts`, `b14-export.ts`.
- ⚠ **`scrutinise-web/scripts/` is type-checked by neither tsconfig** — it is excluded from
  `scrutinise-web/tsconfig.json` (`"exclude": ["node_modules","scripts/**"]`) and outside
  `scripts/tsconfig.json`. Proved with a deliberate type error that both project configs ignored and
  only a direct `tsc` on the file caught. The three scripts above are clean under a direct check.
  This is the same shape as yesterday's finding about `scripts/`, in a second directory.
- `b14-enqueue.ts` takes **one ref per invocation** on purpose, so running all twelve cannot be one
  keystroke.

---

## What I need before step 2

1. **Set `FTS_SEARCH_URL`, `LEX_VECTOR_STREAMS` and `LEX_QUERY_ROUTER`, then re-run M-01.** The
   canonical FTS host in-repo is `https://fts-serve-production.up.railway.app` (14 occurrences; a
   second, `…-4cea…`, appears 6 times and I do not know which is current). ⚠ I have not set
   `LEX_VECTOR_STREAMS` myself: it governs how many dense streams run, and the measured behaviour of
   vector-serve is that it saturates at four concurrent and does not recover — warm p95 7.7s → 707s,
   still climbing forty minutes after every client had died.
2. **Confirm the `goalKind` mapping** in §4.
3. Then M-02…M-12 drained serially, ~61 minutes, £3.00, 36 of the 45 remaining thirds.
