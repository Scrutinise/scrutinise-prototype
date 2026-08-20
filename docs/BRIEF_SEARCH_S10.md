# BRIEF — SEARCH S10: SCORE THE VALIDATED SET, THEN REPLACE THE SWITCH WITH A DIAL

**For:** CC-Search
**Written:** 20 August 2026, by CCh-Search
**Executes:** `SEARCH_STRATEGY_v5.md` §5.2 (the binding constraint), §12 Block 2, §2 (per-stream
vector value)
**Reads first:** `docs/GOLD_CANDIDATES_S8.md` — **Charlie's validation pass is complete.** This is
the sprint that constraint has been waiting for since S7.
**Format:** audit-then-build. No git during the sprint; one **`commit-search-s10.sh`** at the end
(standing rule: commit scripts named per stream and per sprint). Scoped commits by explicit path.
`SEARCH_CONTRACT.md` updated in the same commit as any capability change.

---

## §0 — WHERE WE ARE, AND WHY THIS SPRINT MATTERS MORE THAN THE LAST FOUR

Since SEARCH S7 every statement this project has made about retrieval quality has rested on
questions the implementer wrote for itself. That is the "implementer writing its own exam" problem
named in strategy §5.2 as the **binding constraint on everything**. It is now lifted.

**Charlie's pass, as delivered:**

| | count | what it means for scoring |
|---|---:|---|
| **ACCEPT** | 51 of 60 | usable as a scored gold question |
| **REJECT** | 4 (Q11, Q17, Q18, Q19) | wrong keys — **excluded from scoring, not deleted** (§5) |
| **No verdict — CC's own annotation left in the slot** | 5 (Q40, Q50, Q56, Q57, Q60) | the deliberate negative controls; **see §1.3, they are scored differently** |

⚠ **51 accepted questions is a real instrument and still a small one.** Do not quote a headline
recall figure to two decimal places off 51 questions spread across seven collections. State the n
per collection every time, and say plainly where a collection has too few questions to support a
conclusion.

**Two hard dependencies, stated up front so they are not discovered mid-sprint:**

1. **Case law cannot be honestly measured in this sprint.** CC-Ingest is fixing stored case-law text,
   which is currently a stylesheet — every prior case-law measurement was taken over formatting code
   and is void. Score case-law questions if you like, but report the result **only** as a
   pre-fix baseline, labelled as such, and make no recommendation from it.
2. **Q11/Q17/Q18/Q19 cannot be re-keyed yet.** Re-keying needs a subject-searchable case-law index,
   which does not exist until that same fix lands. §5 says what to do instead.

**Coordination:** CC-Ingest owns the case-law text work; CC-Graph owns 3B; CC-Lex owns the Deepening
display fixes. Report changes needed in their files; do not edit them.

---

## §1 — SCORE THE VALIDATED SET, AND ESTABLISH THE BASELINE HONESTLY

### §1.1 The harness

Score through **`runSearch()`** — the real gateway, with routing, expansion and fusion. Not
`rankedSearch` against `corpus_fts`; GOLD TEST 11 measured a system nobody runs and produced an 8.1%
floor against a platform headline near 62%.

⚠ **`FTS_SEARCH_URL` is still unset in the local `.env`** (named in `SEARCH_S9_REPORT.md`). A local
run without it searches nothing and reports zeros that look like a regression. **Fix the local
environment first, and have the harness print the resolved service URLs and the flag state it
actually observed** — read positively, from a `served` counter moving, never from the presence of an
environment variable. A harness that cannot prove it reached the services is a harness that will
eventually report a fiction.

### §1.2 What to report

For each collection: **n questions**, recall@20, and recall@5. Every figure stated as *"of the N
questions where a known-correct document exists, X% returned it in the top 20"* — never a bare
percentage.

**Record the prediction before running** (predict-measure-compare). State, per collection, what you
expect and why. A written prediction is what turns a surprising number into a finding rather than a
shrug.

### §1.3 ⚠ The five negative controls are scored on behaviour, not recall

Q40, Q50, Q56, Q57 and Q60 were written so that **a helpful answer is a failure**. Q40 tests that the
platform says *nobody has ever checked whether this worked* rather than substituting the prediction;
Q50 is a question the corpus genuinely cannot answer, where the required behaviour is to say so
specifically rather than answer from general knowledge (`SEARCH_CONTRACT.md` §6).

**Scoring these on recall would score them backwards** — a 0% would look like a failure when it is
the correct result. Score them as **pass/fail on the required behaviour**: did the platform state
the gap specifically, or did it improvise? Report them in a separate table with their own heading,
and never fold them into a recall average.

⚠ Q56 and Q57 are *hard* rather than negative — Q56 because OBR series are labelled with the OBR's
own column codes rather than words, Q57 because it tests a derived heading. Score those two on
recall, but flag them as known-hard so a low score is read as the discoverability finding it is
rather than as a regression.

### §1.4 The one number that matters most

**Committees now has real questions for the first time.** It has been unevaluable since S7 — at a
100% ceiling on questions CC wrote for itself, which is a ceiling and not a result. Report its
recall prominently. It is the largest evidence collection we hold and we have never known whether
retrieval on it works.

---

## §2 — RE-RUN THE PER-STREAM VECTOR DECISIONS ON THE VALIDATED SET

Three decisions currently rest on untrusted evidence. Re-take all three:

| stream | current setting | current evidence | what to do |
|---|---|---|---|
| **debates** | vector OFF | measured 15pp worse, on CC-written questions | re-measure; the setting is provisional, not settled |
| **committees** | vector OFF | unmeasurable (ceiling) | **measure for the first time** |
| **guidance** | vector ON | +12.5pp, CC-written questions, +2,528 ms p50 | confirm the gain survives, and price it |
| **case law** | vector ON | +12.5pp, **measured over stylesheet text — void** | pre-fix baseline only; no recommendation (§0) |
| **legislation** | vector ON | the strongest evidence we have | confirm no regression |

Report each as: recall with vector on, recall with vector off, the difference in percentage points,
**the headroom** (how many questions could have shown a difference — a floor effect is not a null
result), and the latency cost.

▶ **The output is a recommended `LEX_VECTOR_STREAMS` value with numbers under it.** The variable is
Charlie's to set in Vercel and is unreadable from your machine.

---

## §3 — THE MAIN EVENT: REPLACE THE SWITCH WITH A DIAL

**The design problem, stated plainly.** Today the keyword and vector legs are fused at a fixed
50/50 within every stream where vector is on, and vector contributes nothing where it is off. That
is two settings — all or nothing — for five collections that behave completely differently.

The hypothesis, which this sprint tests rather than assumes: **debates is large, rhetorical, and
usually contains the exact words a user types, so the keyword leg is already close to its best and a
noisy dense leg drags correct hits down the merged ranking. Judgments and regulator guidance are the
opposite, because users describe those in their own words.** If that is right, debates does not want
vector *off* — it wants a small share of it, and the current binary choice is why it measured worse.

**Build:**

- Make the per-stream fusion weight a **configuration value per stream**, not a constant. Default to
  today's behaviour exactly, so the change is a no-op until a weight is set — **nothing widened
  before it is measured**.
- Sweep a small grid per stream: keyword-only, 80/20, 65/35, 50/50, 35/65, vector-only. Six points
  is enough to see a shape; more is over-fitting to 51 questions.
- ⚠ **Guard against over-fitting, and say how you did.** With n this small, the best-scoring blend on
  the gold set is not automatically the best blend. Report the *shape* of the curve, not just the
  peak: a stream whose score is flat across blends is telling you the dial does not matter there,
  and a single spiky maximum is more likely to be noise than a finding. Adopt a new weight only
  where the curve has a clear direction, and say explicitly where you are declining to adopt one.
- Report the latency cost of each blend alongside the quality — a 2pp gain that costs 2.5 seconds is
  a decision for Charlie, not an automatic win.

▶ Flag-gate the whole mechanism (default OFF, e.g. `LEX_FUSION_WEIGHTS`), read through
`flagEnabled()` — never a bare `=== 'true'`, because a capitalised `TRUE` in Vercel silently
disabled the router once for an unknown period.

---

## §4 — STATISTICS: SCORE Q51–Q60 AND MAKE THE CALL

Q51–Q60 are accepted (with Q56 and Q57 flagged hard, and Q60 a negative control per §1.3). The
statistics stream is built and `LEX_STATS_STREAM` is set to `false` in Vercel pending exactly this.

- Score selection behaviour and retrieval on the accepted statistics questions.
- **The negative half matters more than the positive half:** does the router leave the stats stream
  alone on questions that are legal or evidential? A stream that fires on everything is worse than
  one that fires on nothing. S9 measured 0 of 10 false positives on its own probes; re-measure on
  Charlie's.
- Report the latency added when the stream is selected, and confirm no regression on the other
  collections with the flag both off and on.
- ▶ Recommendation on whether Charlie should flip `LEX_STATS_STREAM`, with the numbers under it.

⚠ **`STATS_USE_CONTEXT=non-commercial` is now set in Vercel.** Two things to do with it:

1. **Report which use-context produced S9's withheld figures** (40.6% of series, 50.2% of
   observations). It is not currently clear from the report whether those were measured under the
   commercial or the non-commercial setting, and the direction matters: a licence marked
   `commercialUseExcluded` should *permit* use in a non-commercial context. State the withheld
   count under **each** setting, measured.
2. **Tie the setting to a documented decision.** A licence declaration sitting as a bare string in a
   dashboard is a compliance obligation with no owner and no date. Record it in the licence register
   with the date and who decided it, and add a check asserting the register and the running
   configuration agree.

---

## §5 — THE FOUR REJECTED QUESTIONS: PRESERVE THE FINDING

Q11, Q17, Q18 and Q19 were rejected because their keys are wrong — the same judgment,
*R (Evans) v Attorney General*, was offered as the answer to two unrelated questions, and two others
point at an employment notice-period case and a data-breach case.

- **Exclude them from scoring. Do not delete them.** A 40% error rate on keys asserted from outside
  knowledge is the strongest evidence this file produces about why the validation pass exists.
- Mark them `REJECTED — AWAITING RE-KEY`, with one line naming the blocker: re-keying needs a
  subject-searchable case-law index, which arrives with CC-Ingest's text fix.
- **Do not attempt to re-key them from outside knowledge.** That is precisely the method that
  produced the four wrong keys. When the index exists, they are re-keyed *by search* and re-validated
  by Charlie.

---

## §6 — TWO CHEAP INVESTIGATIONS, REPORTED NOT BUILT

**§6.1 Is the dense leg searching the rewritten query?** The router rewrites the question per stream
before retrieval. Confirm whether the vector leg embeds the **rewritten, stream-specific** query or
the raw user text. If it is the raw text, that is a large improvement available for very little work
— and it may also explain part of the debates result, since a raw conversational question is exactly
the input a dense retriever handles worst on a huge conversational collection. **Report the finding
and the proposed change; do not implement it in this sprint** — it would confound §3's measurement.

**§6.2 What would widening `vector-serve` take?** The service handles four concurrent requests
(`queueHighWaterMark: 4`) and we search five streams at once, which is why raising
`LEX_STREAM_CONCURRENCY` to 4 made things worse rather than better. This is the single biggest lever
on how fast the platform feels, and it is infrastructure rather than code. Report: what sets the
width, what widening it would cost on the always-on host, and what the stream cap should become
afterwards (strategy §3.4: still one below the service width). ⚠ **Heavy work stays off the
always-on serving host** — this is a capacity change to it, not a job to run on it.

---

## §7 — STANDING RULES AND THE REPORT

- Scoped commits by explicit path; `commit-search-s10.sh`; nothing owned by ingest, graph or lex
  edited — report needed changes instead.
- Every new check watched failing first. A check that cannot fail is not a check.
- **State the headroom of every comparison.** A floor effect is not a null result and a saturated
  metric is not a null result.
- Predictions logged before runs; bytes before hypotheses; read artefacts back, not counters.
- **Report `docs/SEARCH_S10_REPORT.md`:** the baseline first, per collection, with n stated every
  time. Then the vector re-decisions. Then the fusion curves, including where you declined to adopt.
  Then statistics. Then what is NOT done, named. Decisions for Charlie as numbered questions with a
  recommendation and the consequence of each option.
- ⚠ **This is the first sprint whose numbers are trustworthy.** Say so, and say plainly which
  earlier figures it supersedes — a corrected number that does not name what it replaces leaves two
  numbers in circulation.
- Change-log, `SEARCH_CONTRACT.md` and handoff entries labelled **SEARCH**.
- Commit `docs/BRIEF_*.md` by explicit path if they are still untracked; do not sweep the directory.
