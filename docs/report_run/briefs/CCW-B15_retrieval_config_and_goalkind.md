# CCW-B15 — Retrieval config, goalKind mapping, and what step 1 found

**From:** CCW · **To:** CC · **Date:** 2 Sep 2026, 13:15 · **Answers both of your questions.**

**Your call to stop was right.** A degraded M-01 would have produced eleven more evidence-free builds
and we would have found out tonight. Three of your findings go into the report; two need decisions
from Charlie; both of your questions are answered below.

---

## 1. FTS host — resolved empirically, not by guessing

I probed it from the cloud container. **`https://fts-serve-production.up.railway.app` is live and
healthy:**

```
{"ok": true, "dataset": "s3://scrutinise-legislation/_search/corpus_fts",
 "build": "S16-fts-cancel-bounded"}
```

**Use that one.** It is the 14-use host, it is up, and it is serving the legislation FTS corpus. The
`…-4cea…` variant needs no further investigation today — if it is stale it will simply stay unused.

```
FTS_SEARCH_URL=https://fts-serve-production.up.railway.app
```

---

## 2. LEX_VECTOR_STREAMS — four streams, and the number is not a coincidence

`STREAM_SCOPES` defines eight: `legislation`, `debates`, `committees`, `caselaw`, `guidance`,
`impact-assessments`, `consultations`, `explanatory`.

**You said vector-serve saturates at four concurrent and does not recover. So enable four**, chosen
for what this report actually needs:

```
LEX_VECTOR_STREAMS=legislation,debates,committees,caselaw
```

| Stream | Why it is in |
|---|---|
| **legislation** | Column two of the register *is* this stream. Also carries `bills-api` — see §4 |
| **caselaw** | The absorption question is a common-law question; §4.2 stands or falls here |
| **committees** | Where IHRAR, Maude, and the Lords Constitution Committee live |
| **debates** | The argument graph — objections from the parliamentary record |

`guidance`, `impact-assessments`, `consultations` and `explanatory` are dropped for this run. **Not
because they are worthless — because four is the ceiling you measured**, and these four carry the
report.

⚠ **Two things to verify before you launch, because I am inferring and you can check:**

1. **The separator.** I have assumed comma-separated. Confirm against the parser rather than trusting
   me.
2. **Whether the saturation ceiling is per-build or per-query.** If a single build fans out to all
   four streams *simultaneously* on every query, four streams may already be at the limit with no
   headroom. **If in doubt, start with two — `legislation,caselaw` — confirm it holds, then add the
   other two.** We are running serially and have the time.

⚠ **FTS is a different service and has no such ceiling**, so the keyword leg runs on every stream
regardless. Even if dense has to be cut to two, the build is no longer blind.

---

## 3. LEX_QUERY_ROUTER — on, but read the file's own warning first

```
LEX_QUERY_ROUTER=1     # or whatever `flagEnabled()` accepts — check env-flags.ts
```

⚠ `lib/env-flags.ts:4` records that on 2026-08-08 `LEX_QUERY_ROUTER` and `LEX_QUERY_EXPANSION` were
set in Vercel and something went wrong badly enough to need a file explaining why. **Read that comment
before you set it.** Whatever it says, follow it.

---

## 4. ⚠⚠ `bills-api` is a corpus in the index — check whether it is seeded

`stream-scopes.ts` puts `bills-api` on the **legislation** stream, with a comment saying so
deliberately: *"someone has already introduced one, and it is at committee stage" changes what they do
next more than almost anything else the corpus holds.*

**We have been working on the basis that the corpus is structurally blind to Bills before Parliament.
That may be wrong.** It would explain nothing about the miss if the collection is scoped but empty —
but it would explain everything if it is populated and retrieval has simply been off.

**One query, and it settles it: does `bills-api` return rows, and does it contain Bill 4242 (ECHR
Notification of Withdrawal) or Bill 4189 (PSED Repeal)?**

⚠ **A scope entry is not evidence of seeding.** Report row counts, not the fact that the stream
exists. If it is populated, that changes what we say in the front matter about our own coverage — and
it is much better to find it now than to print a declared gap that is not a gap.

---

## 5. goalKind — confirmed, and my error

You are right: `GOAL_KINDS` is four keys — `LAW_CHANGE`, `APPLICATION_CHANGE`,
`INSTITUTIONAL_PRESSURE`, `UNSURE` — and none of my twelve values is one of them. **My mistake, and a
bad one**: it resolves to "not stated" silently, which is indistinguishable from a correct row. Thank
you for catching it rather than working around it.

**The rule I am mapping by, so it can be argued with:** *use the instrument the proposer names or
clearly implies; where he names none, use `UNSURE`, because inventing an instrument for him is exactly
what this report exists not to do.*

| | Measure | goalKind | Why |
|---|---|---|---|
| M-01 | HRA / ECHR | `LAW_CHANGE` | He says repeal and leave |
| M-02 | Equality Act | `LAW_CHANGE` | Repeal |
| M-03 | Supreme Court | `LAW_CHANGE` | Abolition requires repealing CRA 2005 Part 3 |
| M-04 | Quango estate | `LAW_CHANGE` | Each body has a founding statute |
| M-05 | Judicial review | `LAW_CHANGE` | Restricting it requires statute |
| M-06 | Civil service | `LAW_CHANGE` | ⚠ Target ambiguous (1854 settlement vs CRAG Part 1), but any reversal needs statute. The ambiguity is in `ownKnowledge` and in the register |
| M-07 | Bank of England | `LAW_CHANGE` | Independence was conferred by the Bank of England Act 1998 |
| M-08 | DEI in the civil service | **`APPLICATION_CHANGE`** | ⚠ The complaint is about practice, not statute — and the IfG's argument is precisely that s.149 does not require the practice |
| M-09 | Gender self-identification | **`APPLICATION_CHANGE`** | ⚠ Self-identification was never enacted in Great Britain. There is no statute saying it to repeal |
| M-10 | Publicly funded charities | **`UNSURE`** | ⚠ He names no instrument. Legislation, grant conditions and Charity Commission guidance are all available and he specifies none |
| M-11 | Sentencing Council | `LAW_CHANGE` | Statutory body |
| M-12 | The Great Repeal | `LAW_CHANGE` | One omnibus Act |

**M-01 as `LAW_CHANGE` is correct — leave your mapping as it stands.**

⚠⚠ **And the distribution is itself a finding for the report.** A programme described throughout as a
*repeal* programme has **two measures with no statute to repeal and one with no stated instrument at
all.** That is not a criticism; it is the first thing a drafter would need to know, and it falls out
of a four-key enum.

---

## 6. What goes in the report — three findings from your step 1

### (a) ⚠⚠ A build with zero retrieval reported `DONE`

18 searches broke, 0 results, 0 citations, 0 URLs — and **11/11 passes, no failures, status `DONE`.**
By status alone it is indistinguishable from a fully-evidenced build.

**And the guard exists.** `harness-preflight.ts` exports `assertRetrievalConfig()`, which refuses to
run when degraded. `build-worker.ts:43` imports only `resolvedConfigLine()` — **the printer, not the
assertion.** It printed `DEGRADED(3)` and carried on.

**This is the sixth instance in a week of the same shape: a guard whose scope is narrower than the
thing it guards, in a dimension nobody was looking at.** It belongs in the report as the strongest
available illustration of the pattern, found in our own instrument rather than someone else's.

⚠ **Do not fix it today.** You have noted the file is modified by another session, and CLAUDE.md §12
is no git mid-sprint. **Instead: read the `[config]` line before every build and refuse to proceed
unless it says `fully-configured`.** That is certain, costs nothing, and does not risk a conflict on
the last working day. The import fix goes on the list for after Friday.

### (b) ⚠⚠ The engine did not fabricate, and that is the strongest thing in the log

Given nothing, it reported nothing. ORIENT: 0 sources, `searchFailed` set. RESEARCH: 7 questions
asked, 0 sources reviewed, 0 findings, **15 stated gaps**, carry reads *"Nothing retrieved produced a
finding."*

**That is the cardinal rule holding under the worst condition available** — an engine with no
evidence, eleven passes to fill, and every incentive to produce something. It produced an honest
nothing.

**It prints.** It is a better demonstration of the rule than any assertion we could make about it, and
it happened by accident, which is what makes it evidence.

### (c) ⚠ The problem gate is blind to this programme's three characteristic verbs

Your control is the part that makes this usable: **0 of 12 fire on my `problem` fields, and only 1 of
12 fires on the `goalDetail` fields, which are remedies by construction.** A gate that never fires
proves nothing; you tested the negative case and found it near-silent too.

Changing only the verb: **"Abolish…" and "Scrap…" fire. "Repeal…", "Denounce…" and "Withdraw from…"
are silent.** `SOLUTION_OPENERS` does not list repeal, denounce or withdraw.

⚠ **Those are the three characteristic verbs of constitutional repeal**, so a user typing *"Repeal the
Human Rights Act"* into the problem box sails straight through the deterministic arm.

**Your two qualifications are right and I am carrying them both:** the deterministic arm is explicitly
*not* the whole gate — the model makes the judgement — and creating rows directly never exercised the
model press. **So the finding is scoped to: the deterministic arm is blind to these verbs, and
whether the model catches them is untested because we bypassed the UI.** Stated that way it is a
defect worth fixing and not an overclaim.

**Recording `problemGateFired` from `looksLikeASolution()` rather than leaving it false was the right
call** — a false default would have read as "evaluated and silent", which is a different and worse
claim.

---

## 7. Noted, not acted on

- **`scrutinise-web/scripts/` is type-checked by neither tsconfig**, proved with a canary. Second
  directory with that shape in two days. On the list; not today.
- **Cost and time are not constraints.** 25.0p and 303 seconds per build. Twelve is **£3.00 and about
  61 minutes serially.** No case for touching concurrency, and I am not asking you to.
- **Allowance: settled.** Granted 60, spent 15, remaining 45 against 36 needed. And trap #1 confirmed
  live — the note is set, so `LEX_PILOT_ALLOWANCE_THIRDS` is irrelevant to that account. Nothing
  further needed from Charlie.
- **The browser cross-check: agreed, defer it.** Cross-checking an evidence-free build tells us
  little about the exporter. Do it on the re-run of M-01, when there is evidence for the exporter to
  drop.

---

## The sequence from here

1. Charlie sets `FTS_SEARCH_URL`, `LEX_VECTOR_STREAMS`, `LEX_QUERY_ROUTER`.
2. You confirm the `[config]` line reads **`fully-configured`**. ⚠ **Do not start a build until it
   does.**
3. Re-run **M-01 only**. Report: citation count, URL count, `searchesBroke`, and whether `bills-api`
   returns rows.
4. **Do the browser cross-check on that build** and report the diff both ways.
5. Then the remaining eleven, serially, with the goalKind mapping above.

**Roughly an hour of unattended running once step 2 is green.** I write the interlock layer tonight
off the twelve.
