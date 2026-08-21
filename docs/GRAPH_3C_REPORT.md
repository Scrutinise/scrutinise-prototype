# GRAPH 3C — MAKE THE SCORE MEAN SOMETHING

**Executes:** `docs/BRIEF_GRAPH_3C.md` §0–§6, against `docs/POSITION_GRAPH_DESIGN.md` §5 and §8.
**Date:** 2026-08-21. **Cost: $0** — no LLM call was made anywhere in this sprint.
**Reproduce every figure:** from `scripts/graph` —
`npx tsx probe-3c.ts`, `probe-3c-rules.ts`, `probe-3c-pre.ts`, `audit-3c-scoring.ts`,
`audit-3c-distribution.ts`, `check-3c.ts`, `probe-3c-appg.ts`, `report-3c-ec-handoff.ts`,
`select-3c-validation.ts`.

---

## THE SHORT VERSION

**The score is a spectrum now, and the ranking key that was pointing the wrong way is pointing the
right way — measured on the Bill that prompted the sprint, not on a constructed case.**

| | 3A/3B | 3C |
|---|---:|---:|
| distinct `stance_score` values across 2,304,858 estimates | **3** | **13,448** |
| rows at exactly \|stance\| = 1.00 | 2,140,510 (**92.87%**) | **0 (0.0000%)** |
| on the Terminally Ill Adults Bill: mean confidence, 1 entirely consistent member | 0.7595 | 0.7595 |
| on the same Bill: mean confidence, 425 mixed-record members | **0.8947** | **0.3066** |
| rank of that one consistent member, of 426, on the key the page prints | **426th** | **1st** |

**The last row is the sprint.** The only member with a settled record on the assisted dying Bill
sorted dead last under the arithmetic 3B inherited, and sorts first under 3C's. Nothing about the
sort key changed — `confidence ↓, signals ↓, name A–Z` is the same line of code. What changed is
that confidence now saturates on the **net** evidence rather than the turnout, so a record that
points both ways is no longer the most confident thing on the page.

**And the false rebellions are gone at the root.** 328 `rebellion:v1` signals at weight 0.9 on the
two divisions 3B named → **0**. Across the whole graph, **8,443 of 18,493 rebellion signals
(45.7%)** were recorded against a party that had not held together — measured, not estimated. The
fix is not a wider free-vote heuristic; it is one more fact read off a column that was already
there: *a member cannot rebel against a whip that did not hold.*

**Built:** the two-axis score (`consistency` for the words, `stance_score` for the ranking); the
`party-split:v1` rung and the per-party cohesion gate; bill-level propagation of the free-vote
classification, with every propagated division printed; the cost-based replacement for the 17.5 GB
"ceiling"; a 50-row priority validation subset with the other 107 deferred and nothing scored; and
the Electoral Commission work-list, handed over as a file rather than described.

**Not built:** APPG. All three of its routes need Charlie, which brief §4.1 says is the case to
report and stop on. Two of 3B's three route descriptions turn out to be wrong, and that is in §4.1.

**Checks:** `check-3c` **41/41** with every constructed break watched firing and 8 negative
controls · `check-3b` **51/51** · `check-3a` **33/33** (32/33 before this sprint — see §6.2) ·
`verify:positions` **37/37 live** · `check:serve-observer` **29/29** · `audit-3c-scoring` every
property holds, including 3B's two published figures reproduced to four decimal places from a
frozen copy of its own function. `tsc` clean in `scrutinise-web`; `tsc -p scripts/tsconfig.json`
reports 4 errors, **all pre-existing and all in files this sprint did not touch**, each confirmed
unmodified against HEAD (§7).

⚠⚠ **One thing that is not mine and is not fixed:** `scrutinise-web/app/ideas/create/CreateIdeaClient.tsx`
has an **uncommitted syntax error** in the working tree — a `//` comment inside a JSX opening tag
at line 568–571, which is not a comment there. It is a Lex-stream edit, `git log` shows the file
last committed at `5cb2be7`, and the working copy adds five lines. **Production is unaffected
because it is uncommitted**, but `next build` cannot run in this tree and a sweep-style commit
would break the Vercel build. Reported, not touched (§6 — nothing owned by lex edited).

---

## §1 — THE SCORE. BEFORE AND AFTER, WITH WHAT EACH FIGURE IS A PROPORTION OF.

### 1.1 · The distributions, over all 2,304,858 estimate rows

Every percentage in this section is **of all 2,304,858 estimates**, unless the row says otherwise.
The "before" column is 3B's measurement of the same table, **re-taken by `probe-3c.ts --section 2`
on 21 August before anything in this sprint was applied** — so it is a reading, not a quotation.

| measure | BEFORE (3B, and re-read 21 Aug) | AFTER (3C) | predicted |
|---|---:|---:|---:|
| estimate rows | 2,304,858 | 2,304,858 | 2,304,858 ✓ |
| distinct `stance_score` values | **3** | **13,448** | 8,000 (+68%) |
| distinct `consistency` values | *(was the stance column: 3)* | **3** | 3 ✓ |
| distinct `confidence` values | 18,701 | 18,676 | — |
| rows at \|stance\| = 1.00 | 2,140,510 (**92.87%**) | **0 (0.0000%)** | 0 ✓ |
| max \|stance\| | 1.000000 | 0.497746 | — |
| max confidence | 0.496962 | 0.496880 | — |

**§1's own floor was "at least twenty distinct stance values across 2.3M rows, whatever the
arithmetic says". It is 13,448 — cleared by 672×**, and `build-position-estimates.ts` now asks that
question on every build and prints the verdict, so a future change that flattens the score again
fails visibly rather than quietly.

**The stance histogram, which used to be three lines:**

| \|stance\| | estimates | % OF ALL 2,304,858 ESTIMATES |
|---|---:|---:|
| exactly 0 | 164,348 | 7.1305% |
| 0.00 – 0.10 | 773,260 | 33.5491% |
| 0.10 – 0.20 | 1,246,451 | 54.0793% |
| 0.20 – 0.30 | 40,697 | 1.7657% |
| 0.30 – 0.40 | 55,392 | 2.4033% |
| 0.40 – 0.50 | 24,710 | 1.0721% |

⚠ **Read that honestly: 87.6% of the table still sits below 0.20, and that is correct rather than
disappointing.** 90% of these rows summarise exactly one vote, and one vote is not much evidence —
under 3A/3B every one of them read as ±1.00, which was the actual problem. The rows that carry a
real record are the ones above 0.20, and there are now 120,799 of them where there were none.

**By target type — the % columns here are of THAT TYPE'S own rows:**

| target_type | rows | distinct stance | distinct conf | mean \|stance\| | mean conf | max conf |
|---|---:|---:|---:|---:|---:|---:|
| division | 2,080,585 | 8,118 | 4,499 | 0.1244 | 0.0966 | 0.4969 |
| edm | 59,925 | 5,379 | 5,379 | 0.0871 | 0.0705 | 0.3630 |
| inquiry | 162,733 | 1 | 9,301 | 0.0000 | 0.0494 | 0.1500 |
| organisation | 1,615 | 1 | 125 | 0.0000 | 0.0781 | 0.1500 |

`inquiry` and `organisation` still have exactly ONE distinct stance value, and that is the design
working: they are direction-0 attention signals, they have no side, and 3C did not give them one.

**Confidence, before and after, over the same table:**

| bucket | before | after |
|---|---:|---:|
| 0.00 – 0.05 | 511,048 (22.17%) | 503,656 (21.85%) |
| 0.05 – 0.10 | 959,862 (41.65%) | 954,500 (41.41%) |
| 0.10 – 0.15 | 720,123 (31.25%) | 719,328 (31.21%) |
| 0.15 – 0.50 | 113,825 (4.94%) | 127,374 (5.53%) |

⚠ Confidence barely moves **at the per-target grain, and that is arithmetic rather than a null
result**: a division estimate aggregates one vote, and for one signal `|signed| = mass`, so the
change from gross to net evidence cannot bite. The confidence defect only exists in the ROLLUP
across targets — which is what `positionsFor()` computes and what a user sees. §1.3 measures it
there.

### 1.2 · What was chosen, and why — the shape on principle, the numbers provisional

3B's §1.5 offered six candidates. **P-1, P-2 and P-3 are implemented; P-4 was already done; P-5 and
P-6 are declined with reasons.** The shape was chosen from the properties §1 requires; the two
numbers are provisional and versioned, exactly as brief §1 asks.

| | what it is | status |
|---|---|---|
| **P-1** | group the harmonic discount by `(type, class)` and let direction NET inside the group | ✅ **done.** The group key ended in `direction`, so disagreeing signals dodged each other's discount and accumulated more mass than agreeing ones. One token removed. |
| **P-2** | put consistency into the score explicitly | ✅ **done, twice over.** `stance_score` is `signed / (mass + k)`, and confidence saturates on `\|signed\|` rather than on `mass`. |
| **P-3** | fix the free-vote misses before touching any weight | ✅ **done, and done FIRST** — §2. Retuning on top of misclassified signals tunes the wrong thing. |
| **P-4** | signal count as a displayed column | already shipped by 3B; still the second sort key. |
| **P-5** | signal-type mix | ⛔ **declined.** 86,394 of 87,942 actors carry exactly one signal type; it can discriminate for 1.8% of actors. Unchanged since 3B. |
| **P-6** | recency spread | ⛔ **declined.** Mean spread across Charlie's pair is 5.4 days. |

**The arithmetic, in full, because a score nobody can reproduce is a score nobody can argue with:**

```
per group (signalType, derivation, isAttention), signals ranked by decayed weight:
    massG   = Σ wᵢ / i                     ← the harmonic discount, unchanged
    signedG = massG × (Σ dirᵢ·wᵢ / Σ wᵢ)   ← the group's NET direction, applied to its mass

    mass    = Σ massG        signed = Σ signedG

    consistency = signed / mass                    ← 3A/3B's stanceScore, renamed
    stance      = signed / (mass + stanceShrinkage)
    confidence  = 1 − 2^(−|signed| / confidenceSaturation)   ⊕ the capped attention term
```

⚠ **The net direction is taken over GROSS weights and then applied to the DISCOUNTED mass, and that
detail is load-bearing.** Discounting each signal first and then summing signed contributions would
make the answer depend on which side happened to hold rank 1 within the group — with equal weights
that rank is decided by an id tie-break, so a 5-4 split would land anywhere between +0.62 and −0.62
of its own mass depending on an accident of ordering. This form is stable: five for and four
against always nets exactly 1/9, and `check-3c` asserts that number and asserts a shuffled input is
byte-identical.

**Two numbers, both provisional, both versioned (design §9), and one of them is deliberately not a
new number at all:**

- `stanceShrinkage = 0.9`, **set equal to `confidenceSaturation` on purpose**. Both then say the
  same thing — "this much summed evidence is worth half of what there is to know" — and a single
  undecayed rebellion reads stance 0.5 and confidence 0.5, which is one sentence to explain rather
  than two constants to defend. **Decision D-1.**
- `party-split:v1 = 0.7`, the free-vote weight, because it is the same fact one level down: a
  member voting where no whip held. **Decision D-2.**

### 1.3 · The properties §1 requires, each with the case that fails without it

`audit-3c-scoring.ts` runs 3B's function and 3C's over the same signals on every invocation.
⚠ **3B's own arithmetic is kept in the repository, frozen**, rather than its numbers being quoted:
a quoted number cannot be re-checked and quietly becomes a claim about the past. The frozen copy
reproduces 3B's two published figures — **0.7481 and 0.8810 — exactly**, which is what makes the
comparison evidence rather than assertion.

| constructed case | 3A/3B stance | 3A/3B conf | 3C consistency | 3C stance | 3C conf |
|---|---:|---:|---:|---:|---:|
| 1 vote | 1.000 | 0.3857 | 1.000 | 0.413 | 0.3857 |
| 5 votes, all one way | 1.000 | 0.6713 | 1.000 | 0.616 | 0.6713 |
| 9 votes, all one way | 1.000 | 0.7481 | 1.000 | 0.665 | 0.7481 |
| 50 votes, all one way | 1.000 | 0.8884 | 1.000 | 0.760 | 0.8884 |
| **5 one way + 4 the other** | 0.046 | **0.8809** | 0.111 | 0.074 | **0.1420** |
| 4 one way + 4 the other | 0.000 | 0.8687 | 0.000 | 0.000 | 0.0000 |
| 9 votes, all one way, dated 2009 | 1.000 | 0.2915 | 1.000 | 0.332 | 0.2915 |

- **Volume matters.** 1 → 50 consistent votes: stance 0.413 → 0.760. Under the old function both
  were exactly 1.000.
- **Consistency matters, in the right direction.** 9-for beats 5-for-4-against on confidence
  (0.7481 vs 0.1420) and on \|stance\| (0.665 vs 0.074). **The old function had it backwards** —
  0.7481 against 0.8809.
- **Direction-0 cannot manufacture certainty.** 40 donations: stance 0, confidence 0.1500 against
  the 0.15 ceiling.
- **Decay still applies.** The same nine votes dated 2009 read 0.332/0.2915 against 0.665/0.7481.
  The old function could not tell them apart on stance at all.
- **Absence is absence.** No signals → no row, and `check-3c` asserts no estimate exists without a
  signal behind it.
- **Design §5's own property survives.** One rebellion (0.5000) still outweighs ten whipped votes
  (0.3631), and the two together net positive.

**⚠ Where the WORDING moves, named rather than glossed.** On a consistent record `consistency` is
*exactly* the old stance score, so nothing a reader sees about a settled record changes. On a split
record the two differ, deliberately: the old ratio was `(H(k) − H(n−k)) / (H(k) + H(n−k))`, a number
that depended on which side got the undiscounted rank; the new one is the plain net share
`(2k − n)/n`. The word changes in sixteen of the splits up to n=11, always in the same direction —
`3-2`, `4-2`, `5-3`, `6-3`, `6-4`, `7-3`, `7-4`, `8-3` and their mirrors move from *"divided
record"* to *"supported"* / *"opposed"*. **A 6-3 record is not a divided record**, and calling it
one was an artefact of the grouping that has been removed. My first version of this check asserted
the wording never moves; it failed, correctly, and claiming otherwise would have been claiming the
fix did nothing.

### 1.4 · On the real Bill

Every member's whole record on the Terminally Ill Adults Bill (5,613 vote signals), rolled up under
both functions:

| | members | 3A/3B conf | 3C conf | 3C mean \|stance\| |
|---|---:|---:|---:|---:|
| entirely consistent | **1** | 0.7595 | 0.7595 | 0.6728 |
| mixed record | **425** | **0.8947** | **0.3066** | 0.1740 |

**Rank of the one consistent member, of 426, on the key the page prints: 426th → 1st.**

⚠ **The distinct-value count over this Bill's rollup does NOT move — 58 → 58 — and that is
reported, not asserted.** My first version of this check asserted it would grow and failed. Over
one bill whose eleven divisions all carry the same class and near-identical decay, the number of
distinguishable records is bounded by combinatorics, not by the formula. "Is it a distribution" is
a question about the 2.3M-row table, and asking it of a single bill's rollup was the wrong question
asked of the right data.

### 1.5 · Who reads `position_estimate` — established before the rebuild, not after it

Brief §1's ⚠, in response to 3B truncating the table and leaving it half-rebuilt. Grepped rather
than recalled. `position_estimate` (the table, not `_meta`) appears in **five files, every one of
them CC-Graph-owned tooling run by hand**: this sprint's build script (the writer), `check-3a`,
`check-3b`, `check-3c`, `report-3a`, `audit-3b/3c-distribution`.

⚠⚠ **No production read path touches it at all.** `positions.ts` — the read API, and the only thing
`/admin/positions` calls — computes every number live from the signal layer, and reads
`position_estimate_meta` for exactly one string: the `config_version` label at the foot of the
page. So the rebuild is **explicitly offline**, its 240-second empty window is not user-visible on
any surface that exists, and that is the honest reason it was safe.

It is also **a fact about today, and `check-3c` asserts it** rather than leaving it in a comment: a
grep over the five production files fails the sprint if any of them starts reading the table.
⚠ The first version of that check greped the raw file and reported `positions.ts` as a reader **on
the strength of a comment saying it is not one**. It strips comments now, and carries a negative
control proving it still catches a real read.

**The rebuild:** 2,317,767 signals → 2,304,858 estimates in **240.4s** (3A: 225s; 3B: 248.1s), one
`config_version` on the table (`3c.7bac2c10d652`), 164,348 attention-only estimates of which **0**
exceed the 0.15 ceiling. `position_estimate` 596 MB → **616 MB**.

---

## §2 — THE FALSE REBELLIONS. FIXED AT THE ROOT, NOT AT THE HEURISTIC.

### 2.1 · What the data said, before any fix

3B named two divisions the free-vote heuristic misses. `probe-3c.ts --section 3` asked why, and the
answer is one table:

```
commons:2051  Terminally Ill Adults Bill, Amendment (b) to New Clause 14, 13 Jun 2025
  Democratic Unionist Party   aye   5  no   0   cohesion 1.0000   (unwhipped group)
  Conservative                aye  71  no  12   cohesion 0.8554   ← the ONLY party over 0.85
  Liberal Democrat            aye  14  no  48   cohesion 0.7742
  Labour                      aye 126  no 181   cohesion 0.5896   ← 307 members, split near-evenly
```

**One party of 83 holding together at 0.855 was enough to make the division "whipped" for
everyone.** So 126 Labour members who voted with a party that had split almost down the middle were
recorded as `rebellion:v1` at **0.9 — the highest weight in the config** — and the 181 on the other
side as `whipped-with:v1` at 0.2. Neither describes what happened, and the two errors point in
opposite directions on the same division.

**This is not a peculiarity of one Bill.** Across the whole graph, of the 18,493 minority-side votes
classed `rebellion:v1`:

| the member's OWN party's cohesion | votes classed rebellion |
|---|---:|
| below 0.85 — the party did not hold together | **8,773 (46.2%)** |
| 0.85 – 0.90 | 2,376 |
| 0.90 – 0.95 | 2,968 |
| 0.95 and above | 4,882 |

### 2.2 · The fix: a member cannot rebel against a whip that did not hold

`is_whipped_party` only ever meant *"this group carries a whip and enough of it voted here to
judge"*. It never meant the whip HELD. The ladder used it as though it did. **Cohesion was already
stored on every row of `position_division_party` — the fact was there the whole time and nothing
read it.**

`position_vote_class_v2()` adds one rung:

```
1. no whip applies to this group at all          → unwhipped-group:v1        0.7
2. the division looks unwhipped for everyone     → free-vote-heuristic:v1    0.7
3. ⚠ NEW · their party did not hold together     → party-split:v1            0.7
4. their party held, and they were not on its side → rebellion:v1            0.9
5. their party held, and they were on its side   → whipped-with:v1           0.2
6. too few of their party voted to judge         → small-party-unclassified  0.2
```

**What that reclassified — % is of all 2,080,585 vote signals. The "before" column is not quoted
from a report: it is `position_vote_class()`, the surviving 5-argument original, run over today's
rows, and it reproduces all five of 3B's independently-recorded counts exactly.**

| class | after | % of votes | before | delta |
|---|---:|---:|---:|---:|
| `whipped-with:v1` | 1,844,806 | 88.668% | 1,865,002 | −20,196 |
| `unwhipped-group:v1` | 127,039 | 6.106% | 127,039 | **0** |
| `small-party-unclassified:v1` | 61,519 | 2.957% | 61,919 | −400 |
| **`party-split:v1`** | **28,101** | **1.351%** | 0 | **+28,101** |
| **`rebellion:v1`** | **10,050** | **0.483%** | **18,493** | **−8,443 (−45.7%)** |
| `free-vote-heuristic:v1` | 9,070 | 0.436% | 8,132 | +938 |
| **TOTAL** | **2,080,585** | | **2,080,585** | **0 — reclassified, none created or lost** |

**On the two divisions 3B named: 328 `rebellion:v1` signals at 0.9 → 0.** All 938 directional
signals there now carry 0.7, which is what a vote in a party that split 126/181 is worth.

⚠ `unwhipped-group:v1` moved by **zero rows**, which is the check that says the new rung went where
it was supposed to: it cannot reach a group that carries no whip in the first place.

### 2.3 · The detection, widened — and the four candidate rules, scored

Brief §2 also asks for the detection itself to be widened or replaced, with the revised rule's
tagged list reported. `probe-3c-rules.ts` scored four candidates against six cases decided **from
the public record before any of them was run**:

| case | n | R0 *(today)* | R1 *largest party* | **R2 *+ bill propagation*** | R3 |
|---|---:|:---:|:---:|:---:|:---:|
| Terminally Ill Adults (End of Life) Bill | 11 | ✗ 9 | ✓ 11 | **✓ 11** | ✓ 11 |
| Assisted Dying Bill [HL] / for the Terminally Ill | 3 | ✗ 2 | ✗ 2 | **✓ 3** | ✓ 3 |
| Hunting | 27 | ✗ 3 | ✗ 4 | **✗ 3** | ✗ 4 |
| ⛔ Abortion (Northern Ireland) Regulations | 9 | ✓ 0 | **✗ 7** | **✓ 0** | ✗ 7 |
| ⛔ Universal Credit and PIP | 6 | ✓ 0 | ✓ 0 | **✓ 0** | ✓ 0 |
| ⛔ Safety of Rwanda | 63 | ✓ 0 | **✗ 3** | **✓ 0** | ✗ 3 |
| **cases fully correct** | | **3** | **2** | **5** | **3** |

⚠ **R1 — "use the largest whipped party instead of the most cohesive one" — is the obvious fix and
it is refuted by the brief's own negative control**, tagging 7 of the 9 Northern Ireland abortion
Regulations as free votes. It was the rule I expected to adopt.

**R2 is what shipped:** 3A's rule, plus **bill-level propagation** — a division inherits its bill's
free-vote reading when (a) a **strict majority** of that bill's divisions are already tagged on
their own numbers, AND (b) this division's own most-cohesive party was itself a near miss, below
`billPropagationCohesionCeiling` (0.90). Condition (b) is what makes it a rescue rather than a
licence: without it the corpus's generic `bill_title` of *"Ten Minute Rule Bill"* carries a
free-vote reading to `commons:1079`, whose best party was 98.99% cohesive.

**Every division tagged by propagation rather than by its own numbers — the whole list, because
there are two:**

| date | division | best cohesion | title |
|---|---|---:|---|
| 2025-06-13 | commons:2051 | 0.8554 | Terminally Ill Adults (End of Life) Bill: Amendment (b) to New Clause 14 |
| 2025-06-13 | commons:2053 | 0.8659 | Terminally Ill Adults (End of Life) Bill: New Clause 2 |

**34 → 36 divisions tagged free-vote-like**, of 5,645. `derive-vote-classes.ts` now prints **all
36** rather than a top-30 — 3B's §1.7 is the standing lesson about what a harness limit does to a
claim, and a `LIMIT 30` over a 36-row answer is the same defect wearing a smaller hat.

⚠ **A prediction missed by one, and the miss is the interesting part.** `probe-3c-rules.ts`
evaluated propagation as `free / n >= 0.5` and predicted 37; the implementation uses a **strict**
majority and measured 36. The difference is exactly one division — `lords:1886`, the Assisted Dying
Bill [HL] of 16 January 2015, whose bill has two divisions of which one is tagged: exactly half.
Relaxing to `>= 0.5` would catch it and costs nothing measurable — but brief §2's named test case
is the two Terminally Ill Adults divisions, both of which a strict majority already catches, and
loosening a rule *after* seeing which row it would pick up is tuning past the requirement.
**Left as a residual. Decision D-3.**

**The negative controls hold, and one of them is load-bearing:** Universal Credit and PIP is a real
rebellion against a real whip (Labour cohesion 0.872, hand-checked by 3A). It is the control that
stops the cohesion threshold being raised to catch more free votes — at 0.90 it becomes
"free-vote-like" and 49 genuine rebels stop being rebels. Measured: all 284 of its minority-side
votes keep `rebellion:v1` at a floor of 0.85, and would keep it at 0.80.

⚠ **Hunting is 3 of 27 and will not get better.** 3A established why: Lords Conservative cohesion
on hunting was 0.97–0.99 **by conviction**. A free vote a party happens to agree on is
indistinguishable from a whipped one by any cohesion rule, and always will be. The check now
asserts a **floor of 3 with that reason printed beside it**, rather than 3A's `free > 0` — which
passed while 24 of 27 divisions were classified the opposite way from the public record.

⚠⚠ **And `abortion` moved from the positive list to the negative one, which is a correction to the
TEST, not to the world.** 3A inherited "the classic free votes — assisted dying, abortion, hunting"
from design §5 and printed a ⚠ against abortion for scoring 0 of 11. It then established why: the
abortion divisions this corpus holds are Northern Ireland *Regulations*, whipped, Labour cohesion
0.92–1.00. **0 of 11 is the correct answer and the warning was the wrong way round.**

### 2.4 · "An inference must not travel at the weight of a measurement"

Brief §2's principle, and the option chosen between its two: **emit rebellion only where the whip
is evidenced**, rather than capping every derived class. The reasoning is that capping all derived
classes would flatten `unwhipped-group:v1` and `free-vote-heuristic:v1` too, and those are not the
ones doing damage — the damage was a specific inference (*a whip existed here*) being asserted at
0.9 on evidence that contradicted it.

It is held as an assertion rather than as a comment, three ways:

- `check-3c`: **no `rebellion:v1` signal comes from a party below the cohesion threshold** — 0 of
  10,050, lowest party cohesion behind a rebellion 0.8500. With a negative control that there are
  10,050 rebellion signals to check at all.
- `check-3c`: **every `party-split:v1` signal comes from a party that really did split** — 0 of
  28,101 violations, with its own negative control.
- `check-3c --self-test`: the property *"party-split is capped below rebellion"* is watched failing
  against a config where the two weights are equal.

---

## §3 — THE VALIDATION SET: 50 CHOSEN, 107 DEFERRED, NOTHING SCORED

`docs/POSITION_VALIDATION_CANDIDATES.md` is rewritten by `select-3c-validation.ts`. All 157 rows
survive with their VERDICT lines blank — asserted by reading the file back and counting.

**50 rows, 5 from each of the 10 matters, 9 parties, both bases (19 `bill-sponsor`, 31
`amendment-sponsor`), stratified so the hard cases cannot fall off:**

| stratum | meaning | in the subset |
|---|---|---:|
| A | 3+ votes on the matter, all the same way | 16 |
| B | 3+ votes, **not** all the same way | 28 |
| C | fewer than 3 votes, or none — the graph should be quiet here | 6 |

⚠⚠ **Stratum C was 0 of 50 in my first selection, and that was a real defect, not a rounding.**
Cycling B → A → C with a party constraint filled all five slots from B and A in every matter, so
the subset contained no case where the graph holds almost nothing — precisely the case a key needs
in order to catch a graph that answers when it should abstain. One slot per stratum is now reserved
before any stratum is filled twice.

**Two things stated on the face of the document rather than in a footnote:**

1. **The selection used the graph. The verdict must not.** "Settled" and "divided" are facts about
   what the graph currently holds, so the graph chose which rows Charlie sees first. Its *answer*
   appears nowhere: no stance, no score, no confidence sits near a VERDICT line, because a reviewer
   told what the machine thinks is a reviewer who has been anchored. The only thing shown is a
   neutral **Coverage** line — how many votes exist and whether they agree — **never which way**.
2. ⚠ **An accuracy figure from this subset is not an accuracy figure for the graph.** It is
   over-weighted toward hard cases on purpose. Whoever scores it must report a **stratified**
   accuracy with the strata printed; a population figure needs the deferred rows too.

⚠ **A stale number was found and refreshed while doing this.** 3B's per-matter preambles carry
*"N classified free-vote-like"*, written when the answer was 9 for the assisted dying matter. §2
made it 11. The counts are now recomputed from the live table at write time — a stale number in a
document a reviewer is being asked to trust is worse than no number, and this one would have been
wrong in the very matter the sprint is about.

**The rewrite is idempotent and proven so**: running it twice produces a byte-identical file.
⚠ It was not, at first, in two separate ways — a re-parse of its own output saw each matter twice
and let the empty DEFERRED heading overwrite the PRIORITY preamble (M1's Bill link vanished on the
second run), and a stray horizontal rule accumulated. **Both were found by diffing two runs rather
than by reading the code**, which is the only way that shape of bug shows up.

**Nothing has been scored. Design §8's gate remains shut.**

---

## §4 — THE TWO REGISTERS

### 4.1 · APPG — ⛔ REPORT AND STOP, and two of 3B's three route descriptions are wrong

**The blocker is re-measured, not inherited** (docs/CLAUDE.md §0). `probe-3c-appg.ts`, today:

| | result |
|---|---|
| `publications.parliament.uk` register contents | **403**, body title *"Just a moment…"* |
| its own homepage (control) | **403** — so it is the SITE, not the path |
| `members-api` / `interests-api` / `bills-api` (controls, same process and IP) | **200 / 200 / 200** |
| `members-api/api/Reference/AllPartyParliamentaryGroups` | **404**, as 3B measured |
| ⚠ `data.parliament.uk` | **403 + the same challenge** — the historic open-data host is closed too |

**3B's finding stands. Two of its route descriptions do not.**

⚠⚠ **Route (c) is refuted, and it was 3B's recommendation.** D-8 recommends *"drop APPG and take
`interests-api.parliament.uk` instead"*. That API is open and it does carry the MNIS id on every
record — but its category list, read rather than assumed, is: *Employment and earnings · Donations
and other support · Gifts, benefits and hospitality from UK sources · Visits outside the UK · Gifts
and benefits from sources outside the UK · Land and property · Shareholdings · Miscellaneous ·
Family members employed · Family members engaged in third-party lobbying*. **Zero categories
mention a group of any kind.** It is the register of Members' Financial Interests. It answers a
different question and is not a substitute for APPG membership.

⚠⚠ **And 3B's register URLs were an eleven-year-old snapshot.** `/pa/cm/cmallparty/register/contents.htm`
— the path 3B probed — renders, in a browser, as **"Register Of All-Party Groups [as at 30 July
2015]"**. A successful capture of it would have ingested a register from the last Parliament but
one. The live editions are date-stamped and listed on `www.parliament.uk`, which is **not** blocked:

- **current edition: as at 29 June 2026**, `publications.parliament.uk/pa/cm/cmallparty/260629/`
- **571 groups, one HTML page each**, plus a single **6.5 MB PDF** of the whole register
- **published roughly every six weeks** — five editions so far in 2026

**What a parser would get** (`.../260629/africa.htm`, read in a browser): Title · Purpose ·
Category · an Officers table of **Role / Name / Party** · Registered Contact · Public Enquiry Point,
and the funding declarations below. Clean and entirely parseable.

⚠⚠ **But the officers carry a NAME and a PARTY and no MNIS id**, which makes an APPG ingest a
worse identity problem than the donations register — that one at least resolves the donor on an
exact Companies House key. Every APPG officer would have to resolve on a normalised name, and the
standing rule forbids merging identities on similarity. That is a fact worth knowing before the
work starts, not after.

**Why this stops here rather than shipping a capture.** All three routes need Charlie:

- **(a)** ask the Commons Library or the Registrar for the register as data — one email, zero code,
  and not something a session can complete.
- **(b)** the semi-manual download. **One file, one click** — and downloading a file on the user's
  behalf needs the user's say-so, which is exactly the decision brief §4.1 anticipates.
- **(c)** refuted above.

⚠ **What was deliberately NOT built: a crawler over the browser's challenge clearance.** 571
same-origin `fetch` calls from inside a page that has passed a Cloudflare challenge would work, and
would be a bot wearing a browser's clothes. Brief §4.1 forbids it and it is the right prohibition.
**Decision D-4.**

### 4.2 · Electoral Commission — the work-list, handed over, and D-10's ratio corrected

⚠ **D-10's "roughly 11×" is a ratio of ROWS, and rows are not signals.** A donation becomes a
signal only when BOTH ends resolve, and the donee resolves on 8.6% of the register. Measured:

| | |
|---|---:|
| published records | 89,861 |
| donor CH number we hold | 1,489 |
| donor CH number we do NOT hold | 14,879 ← D-10's numerator |
| **distinct companies behind those rows** | **4,458** ← the actual work-list length |
| rows that are a signal today (both ends + a date) | **251** |
| rows that would become one (donee already resolves) | **1,682** |
| **ceiling** | **1,933 signals — a 7.7× widening, not 11×** |

⚠⚠ **And 84.3% of the work is not worth doing.** Of the 4,458 companies, **3,756 unlock nothing** —
every one of their donations went to a party or to a donee this graph will not name. **702
companies carry the whole 7.7×.** `scripts/graph/ec-companies-to-acquire.csv` is the work-list,
sorted so those 702 are the first 702 rows, with the donor name as published, the rows each would
unlock, the members involved and the date range.

**What acquiring them would take:** 4,458 Companies House API lookups at 600 requests / 5 minutes
is **~40 minutes of wall clock** — genuinely small, and needing only the 702 makes it smaller. It
still needs `COMPANIES_HOUSE_API_KEY` (3B's D-12, still absent) and it is **the entity sweep's job,
not the graph's**: design §3 forbids the graph creating organisations. So the list is emitted and
nothing is ingested. **Decision D-5.**

⚠⚠ **A defect in the resolution we already have, found in the work-list itself.** The top-20 list
contains `9630980` **and** `09630980` (Labour Together), `8114952` **and** `08114952` (Conservative
Friends of Israel), `7213374` **and** `07213374` (MPM Connect). The Commission publishes the same
company's number with and without its leading zero: **8,252 register rows across 1,833 companies.**

Normalising is a **format** change to an exact key, not a similarity match — a Companies House
number is eight characters zero-padded by definition, so those are one key written two ways, not
two keys judged to probably mean one thing.

⚠ **It would resolve ZERO rows today, and that is the dangerous answer rather than the reassuring
one.** It costs nothing right now only because we hold none of those 1,833 companies under either
spelling. The moment the entity sweep acquires them, a padded store meeting an unpadded register
produces a join that silently misses 8,252 rows and looks exactly like *"those donors are not in
the register"*. **It must be fixed before the acquisition, not diagnosed after it. Decision D-6.**

---

## §5 — HOUSEKEEPING: THE STORAGE LINE IS NOW A BILL, NOT A WALL

**`NEON_CEILING_GB = 17.5` is gone**, replaced in `scripts/ingest/search/serve-observer.ts` with a
cost threshold. ⚠ That file is ingest-owned and §6's rule is *"nothing owned by search, ingest or
lex edited — report needed changes instead"*; **brief §5 is an explicit carve-out for this one
constant** (*"Find the constant … and replace the threshold with a cost-based one"*), and the edit
is confined to it and its three use sites.

**What it is now, with the source and the date beside it, in the file:**

```
source        Neon console, Launch plan, read by Charlie; recorded in BRIEF_GRAPH_3C.md §5
date checked  2026-08-21     ← a plan price is a fact about a day
unit price    $0.35 per GB-month
budget        $15/month of storage  (≈43 GB) — under a third of the $50 spend notification
```

**Measured today: 19.01 GB = $6.65/month = 44.3% of the budget. The alert is quiet.** Under the old
constant the same database read **108.6% of a "ceiling"** and had been raising a CRITICAL alert
against a number whose only citation was itself since 3B.

**Two things the alert cannot see, said in the file rather than implied by its silence:**

1. **Compute is ~8× storage ($33.01 against $3.96) and is invisible to this process.** A quiet
   storage alert does not mean the bill is fine; the $50 console notification is what watches total
   spend.
2. ⚠ **The brief's own two figures do not reconcile with its own unit price.** 19.09 GB × $0.35 =
   **$6.68**, against the **$3.96** recorded. A factor of 1.7. Most likely Neon bills average
   storage over the period and the reading was mid-month — but nobody here can read the console to
   find out. The alert computes from the **unit price**, because that is the number that can be
   recomputed; if the console disagrees, the console wins, and the discrepancy is recorded in the
   file rather than smoothed over. **Decision D-7.**

**The alert also dropped from `critical` to `warning`**, because overspending a storage budget is a
decision to take, not an outage — and a page of red is a page to scroll past.

**`check-serve-observer` 29/29**, including a new control that **today's actual 19.01 GB does NOT
fire**. Its old breach fixture was 15 GB, which is $5.25 — 35% of budget — so the fixture that used
to prove the alert works now proves it stays quiet; the breach case is now a database that genuinely
costs more than the budget (50 GB, $17.50, 116.7%).

**3A's D-1 is closed: do not drop the estimate rows.** `position_estimate` is 616 MB = **$0.22 a
month**. Dropping 90% of it saves twenty cents. Printed by `audit-3c-distribution.ts` on every run.

⚠ **On compute, per brief §5's last line:** the only thing in the graph stream that touches compute
materially is the estimate rebuild — **240 seconds, and it runs when weights change, not on a
schedule.** No hot query: the page's own query is 113 ms (`check-3b`), down from the 9,048 ms
Charlie saw. Nothing in the graph stream is driving the compute line.

---

## §6 — WHAT WENT WRONG IN THIS SPRINT, AND WHAT IT COST

Six, all mine, all caught by measurement rather than review, all recorded because the failure mode
generalises.

### 6.1 · ⚠⚠ A check that could not fail — for the third time in three sprints, from the third direction

3A asserted *"every member who voted in both readings voted the same way twice"*. It passed 23/23,
was published as a fact, and was false: 16 of 587 changed side, and every one of them ranked below
the harness's own `limit: 400`. **3B rewrote the assertion to require the counter-examples to be
visible — and left the limit at 400**, because under 3B's ranking key those 16 sorted to ranks
1–23.

3C's §1 is that the key was pointing the wrong way. Corrected, a contradictory record is correctly
a *low*-confidence one, so the same 16 sorted to the bottom, fell below 400 again, and
`verify:positions` reported **"400 the same way twice, 0 changed side"** — the identical false
sentence 3A published, reached from the opposite direction.

**It failed rather than passing, which is the entire value of 3B's rewrite.** But the lesson is
narrower than "assert the mechanism": **3B fixed the assertion and not the harness limit that had
defeated it**, so the fix survived exactly as long as the ranking key it was written against. The
limit is now larger than the matched set and the harness **asserts it is not truncating** — 627 of
627. `check-3c.ts` contains no `limit` at all.

⚠ **And raising it exposed a second assertion the limit had been propping up.** *"A multi-target
claim always carries the do-not-read-this-as-the-subject caveat"* passed because the top 400 under
the old key happened to be all two-division voters. Showing every matched actor brought in the 40
who voted in only one division, whose caveat is correctly null. The assertion was measuring *"the
sample contains no single-target actors"*, not the property it names. **Same limit, three
assertions, two of them measuring something other than what they said.**

### 6.2 · ⚠ `check-3a.ts` has been failing since 3B and nobody looked

3B added `position_donation` and did not add it to 3A's "created no relation outside its own seven"
list, so `check-3a` has reported **32/33** ever since — a real, harmless failure sitting in a
harness whose whole purpose is that a failure means something. 3B's report quotes `check-3b` 50/50
and `verify:positions` 35/35 and does not mention it. Extended (not loosened) to name the relation
and its sprint; **33/33**.

### 6.3 · ⚠⚠ Two self-test breaks that did not break anything

`check-3c --self-test` reported **DID NOT FIRE** twice on its first run:

- *"Consistency matters"* was handed a broken **weight**, which cannot falsify a property about
  **grouping**. The defect it guards lived in the code, so the break has to be the code:
  `aggregate3B`, frozen in `audit-3c-scoring.ts`, is now the break — the real broken state, which
  is what brief §0 asks for.
- *"Direction-0 cannot manufacture certainty"* compared the result against **`cfg`'s own ceiling**.
  Lifting the ceiling to 1 lifted the assertion with it, so the check passed at confidence 0.2575
  "under" a ceiling of 1. **An assertion that reads its own bound out of the thing it is testing
  cannot fail.**

### 6.4 · ⚠ A guard that greped prose

The check asserting no production path reads `position_estimate` reported `positions.ts` as a
reader **on the strength of a comment that says, in terms, that it is not one**. It strips comments
now and carries a negative control proving it still catches a real read. It failed in the direction
that wastes time rather than the one that hides a defect — but it was still measuring documentation
rather than behaviour.

### 6.5 · ⚠ A "before" column I was about to type in from a report

The first draft of `audit-3c-distribution.ts` hard-coded six pre-3C class counts, one of which
(`whipped-with:v1`) I had **inferred rather than measured** — the derivation had already re-run, so
the real numbers were gone from the database and an arithmetic guess was about to sit beside five
measurements with nothing to distinguish them. They did not have to be guessed: the 5-argument
`position_vote_class()` survives (setup-3c refuses DROPs), and `free_vote_source` records which
divisions 3A's rule tagged, so the whole pre-3C classification is reproducible by query. It is —
and it reproduces all five of 3B's independently-recorded counts exactly, which is what makes the
before/after table evidence rather than decoration.

### 6.6 · ⚠ Two failed comparisons against a published number, both of them the clock

`audit-3c-scoring` asserts the frozen 3B function reproduces 3B's published 0.7481 / 0.8810. It
failed twice — 0.7480/0.8808, then 0.7481/0.8809 — and both times read exactly like a copying error
in the frozen function. Both times it was the as-of date: 3B's harness uses `2026-08-19`
(`probe-3b-rank.ts:30`), found by reading that file rather than guessing at it. **A comparison
against a published number has to hold every input still, including the one nobody thinks of as an
input.**

---

## §7 — WHAT IS NOT DONE, NAMED

- **Nothing is scored.** `POSITION_VALIDATION_CANDIDATES.md` is a draft awaiting verdicts; no
  accuracy figure is claimed anywhere in this report, and design §8's gate is still shut. The 3C
  scoring is what gets scored when it opens, per brief §3's ⚠.
- **APPG** — reported and stopped, per brief §4.1's own instruction. **D-4.**
- **Companies House acquisition** — the work-list is emitted, the ingest is not built and is not the
  graph's to build. **D-5.** No API key. (3B's D-12.)
- **The CH zero-padding normalisation** — diagnosed and NOT applied. **D-6.**
- **`lords:1886`** — one assisted-dying division still classified whipped, by one row of a strict
  majority. **D-3.**
- **Hunting: 3 of 27** — structural, and stated as such rather than chased.
- **`amendment_sponsorship` and `committee_membership`: 0 signals** — no source data, printed by
  name on every `check-3b` run. Unchanged since 3A.
- **97.1% of EDM signatures** — still primary sponsors only. Unchanged since 3A.
- **The deepening wiring** — still not applied. Out of scope, three sprints running.
- **A browser walk of `/admin/positions`** — not possible from here (see §8).
- ⚠ **`CreateIdeaClient.tsx`'s syntax error** — Lex-owned, uncommitted, not touched. It means
  `next build` cannot run in this working tree, which is why §8 check 4 has one fewer local
  corroboration than usual.
- **`tsc -p scripts/tsconfig.json` reports 4 errors**, all pre-existing, each confirmed unmodified
  against HEAD: `check-3a.ts:428` (3A's deliberately-broken self-test literal, which TypeScript
  narrows to a no-overlap comparison), `ingest/graph/download-graph-sources.ts:55`,
  `ingest/search/fts-refresh.ts:180` and `:232`. Every file 3C adds or edits compiles clean.

---

## §8 — DECISIONS FOR CHARLIE

**D-1 · `stanceShrinkage = 0.9`, deliberately the same number as `confidenceSaturation`.**
It is the constant that turns the score from a three-valued flag into a spectrum, and it controls
how fast the magnitude grows with evidence: one vote reads 0.41, fifty read 0.76. Setting it equal
to the confidence constant means 3C adds a *shape* and no new number, and gives one sentence to
explain both. *Recommendation:* **keep**, and let §3's scored set move it if it needs moving.
*Consequence of a different value:* smaller ⇒ a single vote reads closer to ±1 and the old
flattening returns; larger ⇒ even long records stay near zero and the page looks timid.

**D-2 · `party-split:v1 = 0.7`, the free-vote weight, on both sides of a split party.**
Design §5 has no row for it. It carries the free-vote weight because it is the same fact one level
down — a member voting where no whip held. *Recommendation:* **keep.** *Consequence:* this is the
class that absorbed 28,101 signals, so the number matters: at 0.2 the 181 Labour members who voted
*with* their split party would be back to being described as whip-followers.

**D-3 · `lords:1886` — strict majority, or at least half?**
The Assisted Dying Bill [HL] has two divisions, one tagged. A **strict** majority leaves the other
whipped, so eight Labour peers keep a `rebellion:v1` at 0.9 on what was a free vote. Relaxing to
`>= 0.5` catches it and — measured — reaches nothing else, because the near-miss guard already
excludes the only other candidate. *Recommendation:* **relax it, as a deliberate decision rather
than as a tune.** I did not do it in-sprint because the brief's named test case is already passed
and changing a rule after seeing which row it picks up is how tuning-to-the-answer starts.
*Consequence of doing nothing:* eight false rebellion signals on one 2015 Lords division.

**D-4 · APPG: which route, and one of the three has died since 3B.**
(a) ask the Commons Library / Registrar for the register as data — one email, zero code.
(b) the download: **one 6.5 MB PDF, or 571 HTML pages, published every ~6 weeks** — one click for a
person, and I will not take it on your behalf.
(c) **withdrawn** — `interests-api` is the register of *financial interests*; its category list has
nothing about groups.
*Recommendation:* **(a) first, (b) as the fallback.** ⚠ Whichever you pick, know the identity cost
before the work starts: APPG officers are published as **a name and a party, with no MNIS id**, so
every one would resolve on a normalised name against a standing rule that forbids merging on
similarity. That is a worse identity story than the donations register. *Consequence of doing
nothing:* the funded-group prior stays unbuilt — the cleanest soft-alignment signal in the P1 tier.

**D-5 · Hand the 702 companies to the entity sweep, not the 4,458.**
`scripts/graph/ec-companies-to-acquire.csv` is sorted so the 702 that unlock something come first.
~40 minutes of Companies House lookups for all of them, less for the 702, and a free API key to
obtain. *Recommendation:* **do the 702.** *Consequence of doing nothing:* the register stays at 244
signals and reads as a failed experiment rather than a blocked one.

**D-6 · Normalise Companies House numbers to 8 characters, before the acquisition and not after.**
8,252 register rows across 1,833 companies carry an unpadded number. It resolves **zero** rows today
— because we hold none of them either way — and will silently swallow 8,252 the moment the sweep
lands. It is a format normalisation of an exact key, not a similarity match. *Recommendation:*
**approve it, and sequence it before D-5.** *Consequence of doing nothing:* D-5 half-works and the
miss looks like an absence in the register.

**D-7 · The Neon storage price does not reconcile with the Neon storage bill.**
19.09 GB × $0.35 = $6.68/month against the $3.96 you recorded. The alert computes from the unit
price. *Recommendation:* **one look at the console settles it** — if Neon bills average storage over
the period, say so and the constant gets a comment; if the unit price is different, the constant
gets the real number and today's date. *Consequence of doing nothing:* the storage budget is
right-ish and its arithmetic is unexplained, which is how the last unsourced constant started.

**D-8 · `CreateIdeaClient.tsx` is broken in the working tree and it is not mine.**
A `//` comment inside a JSX opening tag, uncommitted, from the Lex stream. Production is fine;
`next build` in this tree is not. *Recommendation:* **whoever is holding that file should finish or
revert it before the next commit sweep** — this is the fourth file-level build break in three weeks
and the previous three all reached production.

---

## §9 — DELIVERY (docs/CLAUDE.md §20)

| # | check | result |
|---|---|---|
| 1 | every file the sprint created is committed | *(filled in after `commit-graph-3c.sh` — with `git ls-files --error-unmatch` against the file list, and `git check-ignore -v` on anything missing, confirming the FILE and not the pattern)* |
| 2 | the remote has the commits | *(after push: `git ls-remote origin Main` against local HEAD, and `git merge-base --is-ancestor` — the server ref, never cached status)* |
| 3 | the deployment is green AND is Production | ⛔ **UNREADABLE FROM HERE.** The Vercel token authenticates and 403s on every project scope with `"saml": true` (docs/CLAUDE.md §19). **Charlie's dashboard.** |
| 4 | the running site serves the change | ⛔ **CANNOT BE RUN, and the negative control is the reason.** `/admin/positions` 307s to sign-in, and so does a route that does not exist — an unauthenticated probe cannot tell deployed from absent. Reported as **not run**, never as passed. |

**What IS verified**, and it is the code and the data rather than the delivery: `check-3c` 41/41
with every break watched firing, `check-3b` 51/51, `check-3a` 33/33, `verify:positions` **37/37
live against Neon**, `check:serve-observer` 29/29, `audit-3c-scoring` every property, `tsc` clean in
`scrutinise-web`, and every figure in this report read back off the production database.

⚠ **`next build` was NOT run**, and that is a gap rather than an omission: the working tree contains
a syntax error in a file this sprint does not own (§7). Two of the three §20 incidents were caught
by exactly that build, so its absence is named here rather than glossed.

---

## ▶ WHAT CHARLIE SHOULD CLICK

1. Confirm a green **Production** deployment — read the environment column, not just the status.
2. `/admin` → **"Position Graph"**. Search **`Terminally Ill Adults`**.
3. **The config version at the foot of the page should read `3c.7bac2c10d652`.** 3B left
   `3a.d28ce0b05297`. If it still says `3a.…`, production is serving the old build and nothing
   below will be true.
4. **The case that prompted the sprint.** Tick **"Amendment (b) to New Clause 14"** *(13 Jun 2025)*
   and **"Amendment 12"** *(20 Jun 2025)*, press **Show positions**. The amber line should read:

   > ⚠ **40 of 555 actors, tied at this confidence (0.518, 2 signals) — ordered by name. This is
   > not a ranking.**

   It said **0.671** under 3B. The number moved because those two divisions are now BOTH classified
   free-vote-like, so they fall in one weight class and the harmonic discount applies — instead of
   one of them being a "rebellion" at 0.9 against a whip that was not there.
   ⚠ **It still says "this is not a ranking", and that is correct**: with two divisions of equal
   weight there are only a few distinguishable states, and the page says so rather than implying an
   order it does not have.
5. **Where the ranking now separates people.** Tick **several** of the eleven divisions — Second
   Reading, Third Reading, and three or four amendments. The top of the list should now be members
   who voted the same way throughout, and the members who voted both ways should be near the
   bottom, flagged **divided record**. Under 3B it was the other way round.
6. **Two numbers on every row.** `1.00 ×0.67` reads: *consistency 1.00* (every vote the same way)
   and *strength 0.67* (that direction, weighted by how much evidence there is). Before 3C those
   were one number and it was always 1.00.
7. **`docs/POSITION_VALIDATION_CANDIDATES.md`** — the **50 PRIORITY rows** at the top, one VERDICT
   line each, citation in the row. The other 107 are DEFERRED below, not deleted. **That document
   is still the gate on any of this reaching a user**, and until it is scored nothing here has been
   measured against anything.
