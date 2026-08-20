# GRAPH 3B — MAKE THE GRAPH DISCRIMINATE, THEN WIDEN IT

**Executes:** `docs/BRIEF_GRAPH_3B.md` §1–§5, against `docs/POSITION_GRAPH_DESIGN.md` §4–§6, §8.
**Date:** 2026-08-20. **Cost: $0** — no LLM call was made anywhere in this sprint.
**Reproduce every figure:** from `scripts/graph`, `npx tsx audit-3b-distribution.ts --explain`,
`probe-3b-pair.ts`, `probe-3b-perf.ts`, `probe-3b-rank.ts`, `pilot-3b-ec.ts`.

---

## THE SHORT VERSION

**Charlie's diagnosis was right, and the machine is worse than the symptom suggested.**

The page could not rank because **the stance score is not a spectrum at all**. Over all 2,304,748
estimates there are exactly **three distinct stance values** — `+1`, `0`, `−1` — and **zero rows
anywhere in between**. 92.87% of the table sits at exactly ±1.00. That is not a score with a tie
problem; it is a three-valued flag being displayed to two decimal places.

Four things came out of the audit that change what happens next:

1. ⚠⚠ **The confidence score currently rewards an inconsistent record.** A member who voted the
   same way nine times scores **0.748**. A member who voted five one way and four the other scores
   **0.881**. Measured on the real Bill: of 426 members with 9+ votes on assisted dying, the one
   entirely consistent member averages 0.896 and the 425 mixed ones average **0.919**. Confidence
   is measuring *turnout*, not how well we know anyone's position.
2. ⚠⚠ **3A's claim that a missed free vote "understates rather than overstates" is refuted.** The
   heuristic misses 2 of the 11 assisted-dying divisions, and on those two it emits **328
   `rebellion:v1` signals at weight 0.9** — the highest weight in the system — for members who
   rebelled against nothing, because there was no whip to rebel against.
3. ⚠⚠ **A 3A finding published as a fact about the world is false, and the check that "proved" it
   could not have failed.** 3A reports *"All 400 who voted in both voted the same way both times."*
   The raw rows say **16 of 587 changed side**. All 16 ranked **612th–627th of 627** under 3A's sort
   key, and the harness passed `limit: 400` — every counter-example was below the cut-off.
4. ✅ **The 9,048 ms is fixed: 91 ms, and it was never a missing index.** A view cannot take a
   parameter, so the target filter had nowhere to go and the plan materialised all 2,317,523 signals
   to return 981 of them.

**Built:** an honest ranking that prints its own key and says out loud when it has run out; the
never-claim rule at the display layer, so a stance word can no longer travel without the thing it
is a stance toward; per-division results separately labelled and never summed; the Electoral
Commission donations register (89,861 rows, 244 direction-0 signals); and a 157-candidate validation
draft built from a source the graph provably does not hold.

**Not built:** APPG. It is behind a Cloudflare bot challenge and I did not build a way around one.

**Checks:** `check-3b.ts` **50/50** with all **7** self-test breaks firing and **6 negative controls**;
`verify:positions` **35/35** against the live graph; `tsc` clean in `scrutinise-web`.
⚠ `tsc -p scripts/tsconfig.json` reports **2 errors, both pre-existing and neither in a file
this sprint touched** — `check-3a.ts:405` (a deliberately-broken literal inside 3A's own
self-test, which TypeScript narrows to a no-overlap comparison) and
`ingest/graph/download-graph-sources.ts:55` (a `stream/web` type mismatch, ingest-owned).
Both are unmodified against HEAD. Every file 3B adds compiles clean.

▶ **CHARLIE: `/admin` → "Position Graph"**, search *Terminally Ill Adults*, tick **Amendment (b) to
New Clause 14** and **Amendment 12**, press *Show positions*. That is the exact pair that produced
the alphabetical "top 40". The page should now say, in amber: *"40 of 555 actors, tied at this
confidence (0.671, 2 signals) — ordered by name. This is not a ranking."*

---

## §1 — THE SCORES DO NOT DISCRIMINATE. THE AUDIT.

### 1.0 · First, which case was this?

The brief describes 555 actors and confidence exactly 0.671. **My first guess was wrong** — I
assumed Amendment 12 + Third Reading, which gives 607 actors and 0.6227. `probe-3b-pair.ts` scores
all 55 pairs of the eleven assisted-dying divisions against both numbers, and exactly one pair
produces both:

```
commons:2051  2025-06-13  Amendment (b) to New Clause 14   free_vote_like = FALSE
commons:2068  2025-06-20  Amendment 12                     free_vote_like = TRUE
                                       → 555 actors, modal confidence 0.671
```

Diagnosing the wrong case would have produced a true-sounding explanation of something Charlie never
saw. It is checked, not assumed, and **the `free_vote_like = FALSE` on the first of them turns out to
be the whole story** (§1.3).

### 1.1 · The distribution, over all 2,304,748 estimates

Predictions were written into `audit-3b-distribution.ts` from *reading* `position-math.ts`, before
the first run.

| | predicted | measured | |
|---|---:|---:|---|
| distinct `stance_score` values, whole table | **3** | **3** | ✓ exact |
| % of estimates at exactly ±1.00 | **92.87%** | **92.87%** | ✓ exact |
| % at exactly 0.00 | **7.13%** | **7.13%** | ✓ exact |
| distinct `confidence` values | 10,000 | **18,647** | ✗ +86% |

**The stance histogram is the whole finding, and it fits in three lines:**

| stance_score | estimates | % OF ALL 2,304,748 ESTIMATES |
|---:|---:|---:|
| `+1` | 1,100,059 | 47.73% |
| `−1` | 1,040,451 | 45.14% |
| `0` | 164,238 | 7.13% |
| **anything else** | **0** | **0.0000%** |

**Why, stated as arithmetic rather than as a complaint.** `stanceScore = signed / mass` — a
*normalised* mean direction. A per-division estimate aggregates exactly one vote, so signed/mass is
±1 identically; an EDM estimate aggregates one +1 signature; an inquiry or organisation estimate is
all direction-0, so mass is 0 and the function returns 0. **There is no arithmetic path to any other
value at one signal per target.** The 92.87% is (2,080,585 division + 59,925 EDM) ÷ 2,304,748.

⚠ **The consequence is bigger than a tie-break.** Because stance is a ratio, it divides out both
volume and consistency: **one consistent vote and fifty consistent votes produce the identical
stance of exactly 1.00.** All the information about how much we know lives in `confidence` — and
§1.2 shows that axis is compressed and, worse, pointing the wrong way. `check-3b.ts` now holds this
as an assertion so a future change cannot quietly un-fix it.

**Confidence, over the same table:**

| bucket | estimates | % OF ALL ESTIMATES |
|---|---:|---:|
| 0.00–0.05 | 510,932 | 22.17% |
| 0.05–0.10 | 959,816 | 41.65% |
| 0.10–0.15 | 720,185 | 31.25% |
| 0.15–0.50 | 113,815 | 4.94% |
| above 0.50 | **0** | **0%** |

**95.07% of the whole estimate table sits below confidence 0.15**, and the maximum anywhere is
0.497. 3A reported that ceiling and explained it correctly (one signal per target); it is repeated
here because it is what makes the per-target layer unrankable on its own.

By target type, with what each figure is a percentage of:

| target_type | rows | distinct stance | distinct conf | at ±1.00 | mean conf | max conf |
|---|---:|---:|---:|---:|---:|---:|
| division | 2,080,585 | 2 | 4,524 | 2,080,585 (100%) | 0.0954 | 0.497 |
| edm | 59,925 | 1 | 5,379 | 59,925 (100%) | 0.0706 | 0.363 |
| inquiry | 162,733 | 1 | 9,296 | 0 | 0.0494 | 0.150 |
| organisation | 1,505 | 1 | 5 | 0 | 0.0783 | 0.150 |

### 1.2 · Charlie's case, and why the top 40 could not be ranked

Rolled up across the two divisions, over 555 actors, there are **5 distinct stance values and 7
distinct confidence values**:

| stance / confidence | actors | signals | e.g. |
|---|---:|---:|---|
| −1.000 / 0.4654 | 207 | 2 | Andrew George |
| **+1.000 / 0.6714** | **108** | 2 | Ms Diane Abbott |
| +1.000 / 0.4654 | 67 | 2 | Rt Hon Sir Desmond Swayne MP |
| +1.000 / 0.3857 | 39 | 1 | Sir Bernard Jenkin MP |
| −1.000 / 0.3857 | 30 | 1 | Rt Hon John Healey MP |
| −1.000 / 0.1298 | 25 | 1 | Fabian Hamilton |
| +0.124 / 0.6714 | 16 | 2 | Anna Turley |
| −1.000 / 0.6714 | 11 | 2 | Dr Andrew Mitchell |
| …the other 8 cells | 52 | | |

**135 of the 555 actors are tied on (confidence 0.671356, 2 signals).** The page shows 40. All forty
are inside that block, so the visible order was the name order and nothing else — which is exactly
what Charlie saw: Alex Baker, Alicia Kearns, Alison Taylor, Amanda Hack, Andrew Pakes.

### 1.3 · ⚠⚠ Why 0.671 for two votes, and the finding underneath it

Two votes on the *same* free-vote division pair would give **0.5546**, not 0.671. The extra comes
from somewhere specific:

```
commons:2051   free_vote_like = FALSE →  rebellion:v1                152 signals @ 0.9
                                          whipped-with:v1             300 signals @ 0.2
                                          unwhipped-group:v1           14 signals @ 0.7
                                          small-party-unclassified     20 signals @ 0.2
commons:2068   free_vote_like = TRUE  →  free-vote-heuristic:v1      484 signals @ 0.7
```

The two divisions fall in **different weight classes**, so the harmonic discount — which applies
only *within* a class — never fires, and both signals count in full:

```
0.9 × decay(2025-06-13) + 0.7 × decay(2025-06-20)  =  0.9×0.9040 + 0.7×0.9040  =  1.4464
confidence = 1 − 2^(−1.4464 / 0.9)                                              =  0.6714  ✓
```

**And that 0.9 should not be there.** Every one of the eleven divisions on the Terminally Ill Adults
Bill was a free vote as a matter of public record. The heuristic tagged nine of them and missed two.
On the two it missed, across the whole Bill:

| heuristic said | class emitted | signals | weight |
|---|---|---:|---:|
| free_vote_like = FALSE | `whipped-with:v1` | 570 | 0.2 |
| free_vote_like = FALSE | **`rebellion:v1`** | **328** | **0.9** |
| free_vote_like = FALSE | `unwhipped-group:v1` | 28 | 0.7 |
| free_vote_like = FALSE | `small-party-unclassified:v1` | 40 | 0.2 |
| free_vote_like = TRUE | `free-vote-heuristic:v1` | 4,536 | 0.7 |

⚠⚠ **3A's report says:** *"The heuristic under-detects, and it under-detects in the safe direction:
a missed free vote is scored at the whipped weight (0.2), which understates rather than
overstates."* **That is wrong, and it is wrong in the dangerous direction.** A missed free vote does
not produce one class, it produces the whole whipped ladder — including the `rebellion:v1` branch,
which fires for anyone on their party's minority side. On a free vote there is no party line to be
on the minority side *of*, so those 328 signals record a costly act of defiance that did not happen,
at the single highest weight the config contains.

This is not a small correction to a caveat. **It is the mechanism that put 108 people at the top of
Charlie's page**, and the reason the top block reads 0.671 rather than 0.555.

### 1.4 · The saturating function, with the arithmetic written out

`confidence(mass) = 1 − 2^(−mass / 0.9)`, and mass for N signals of one class in one direction is
`weight × H(N)` (the harmonic discount).

| N | H(N) | free vote 0.7 | Δ | rebellion 0.9 | Δ | whipped 0.2 | Δ |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1.0000 | 0.4167 | — | 0.5000 | — | 0.1428 | — |
| 2 | 1.5000 | 0.5546 | +0.138 | 0.6464 | +0.146 | 0.2063 | +0.064 |
| 3 | 1.8333 | 0.6278 | +0.073 | 0.7194 | +0.073 | 0.2460 | +0.040 |
| 5 | 2.2833 | 0.7080 | +0.080 | 0.7946 | +0.075 | 0.2965 | +0.051 |
| 10 | 2.9290 | 0.7938 | +0.086 | 0.8687 | +0.074 | 0.3631 | +0.067 |
| 20 | 3.5977 | 0.8562 | +0.062 | 0.9174 | +0.049 | 0.4255 | +0.062 |
| 50 | 4.4992 | 0.9116 | +0.055 | 0.9558 | +0.038 | 0.4999 | +0.075 |

**The brief asks me to pick one: is the shape wrong, or should two votes genuinely be near the
ceiling? The shape is wrong.** Three pieces of arithmetic, in increasing order of seriousness:

**(a) Two votes already clear the "strong recorded record" band.** The band starts at 0.65
(`confidenceBands.strong`). Charlie's pair reaches **0.6714**. So a member who turned up twice is
described in the same words as a member with a settled twenty-year record. Meanwhile fifty
consistent free votes reach 0.9116 — the entire range from *two* observations to *fifty* spans
0.55 → 0.91, and the band boundary sits at the very bottom of it.

**(b) The discount flattens the axis that is doing all the work.** Because stance is scale-free
(§1.1), confidence is the *only* axis carrying evidence strength — and the harmonic discount means
the 50th signal contributes `weight/50`. Without the discount, five free votes would read 0.9325 and
ten would read 0.9954. The discount is *correct in principle* — ten whipped votes really are ten
observations of one whip — but it is being applied to the only variable left that could separate
anybody.

**(c) ⚠⚠ And the discount is grouped in a way that rewards being inconsistent.** The grouping key in
`position-math.ts` is `(signalType, derivation, DIRECTION)`. Signals that *disagree* land in
different groups, so each counts in full and neither discounts the other:

```
9 votes, all the same way   → mass 1.7904  confidence 0.7481  stance  1.00
5 one way + 4 the other     → mass 2.7635  confidence 0.8810  stance  0.05
                                                   ↑ the contradictory record scores 0.1328 HIGHER
```

Measured on the real Bill, not only constructed — of 426 members with 9 or more votes on the
Terminally Ill Adults Bill:

| | members | mean confidence |
|---|---:|---:|
| entirely consistent | **1** | 0.8957 |
| mixed record | **425** | **0.9188** |

**Confidence is currently a measure of how many times someone voted, not of how well we know their
position.** That is the finding, and it is why §1's ranking key — which the brief specifies as
confidence-first, and which I have implemented exactly as specified — **puts the least decided
members at the top**. Both keys are biased; they are biased in opposite directions (§1.6).

### 1.5 · What would discriminate — ⚠ A PROPOSAL. NOTHING WAS RETUNED.

Brief §1: *"Weight changes must be validated against the §3 answer key, not chosen because they
produce a prettier distribution."* Nothing below is implemented. Each carries the evidence for it.

| # | candidate | the evidence | what it would cost |
|---|---|---|---|
| **P-1** | **Group the harmonic discount by `(type, class)` and let direction *net* inside the group**, instead of grouping by direction. | The 0.748-vs-0.881 inversion above. This is the single change that stops the arithmetic rewarding contradiction. | Changes every estimate. Must be scored against §3 first. |
| **P-2** | **Put consistency into the score explicitly** — e.g. scale confidence by `|signed| / mass`, so a perfectly split record cannot read as well-evidenced. | 425 of 426 members on this Bill are "mixed", so today the term would separate almost everyone. | Same. |
| **P-3** | **Fix the free-vote heuristic's misses before touching any weight.** | 328 spurious `rebellion:v1` signals at 0.9 on one Bill (§1.3). Retuning weights on top of misclassified signals would tune the wrong thing. | The cheapest of the five and the one with the clearest right answer. |
| **P-4** | **Number of independent signals**, as a displayed column rather than folded into one number. | Already shipped: `signalCount` is on every actor and is the second sort key. | Done. |
| **P-5** | **Signal-type mix** (a rebellion plus an EDM signature beats two whipped votes). | ⚠ **Weak today, and the number says why: 86,394 of 87,942 actors carry exactly ONE signal type.** Type-mix can discriminate for 1.8% of actors. | Wait for the registers to widen. |
| **P-6** | **Recency spread.** | ⚠ Useless on the case that prompted this: mean spread across Charlie's pair is **5.4 days**. Meaningful over a Bill, not over a sitting. | Low value now. |

### 1.6 · What was built — safe, non-tuning

**Rank by something honest, and print what it is.** `positionsFor()` now orders by
**confidence ↓, then contributing signals ↓, then name A–Z**, exactly as the brief specifies, and
returns a `ranking` object carrying the key *in words*, the number tied at the top (computed over
actors **matched**, not actors **shown**, so it stays true when `limit` changes), and the sentence to
print. On Charlie's pair the page now says:

> ⚠ **40 of 555 actors, tied at this confidence (0.671, 2 signals) — ordered by name. This is not a
> ranking.**

⚠ **And I am flagging that this key has its own bias, because §1.4(c) says so.** Confidence-first
promotes the *least* decided members; 3A's `|stance| × confidence` buried them. Neither is neutral
and neither should be treated as settled before §3 is scored. Recorded as decision **D-7**.

**Say what the stance is a stance toward.** `composeClaim()` in `position-math.ts` is now the only
way to render a stance word, and its signature will not let you call it without the targets. Every
actor carries a `claim` string:

> *opposed, across 2 things asked about — against "Terminally Ill Adults (End of Life) Bill: Third
> Reading" (2025-06-20); against "…: Second Reading" (2024-11-29)*

and, whenever more than one target contributed, a `claimCaveat` shown in the same breath:

> *A stance toward these specific divisions, not toward the Bill or the subject. Voting for a Bill
> and against an amendment to it are opposite directions once combined.*

**The 9,048 ms → 91 ms**, and it was **not** a missing index. Three shapes, three runs each, minimum
reported (`probe-3b-perf.ts`):

| | ms |
|---|---:|
| A · through the `position_signal` view, as 3A wrote it | 1,710–4,397 |
| B · the same rows, division predicate decomposed to `(house, division_id)` | **40** |
| C · concatenated predicate, no expression index (control) | 716 |

The plan says why: the view derives `target_id` as `house || ':' || division_id`, a **computed
column**, and the wanted targets arrive as a two-row function scan. Postgres cannot push a hash-join
condition into a computed column, so it materialised all 2,317,523 signals and discarded 2,316,542:

```
Hash Join (rows=981)
  ->  Append (rows=2317523)                    <- the whole graph, on every request
        ->  Seq Scan on division_votes (rows=2129113)
```

`idx_dv_div (house, division_id)` already existed and is exactly right — B's plan uses it and
finishes the index scan in **1.95 ms**. It was unreachable because **a view cannot take a
parameter**. So 3B adds `position_signal_for(types[], ids[])`, a set-returning function, which is
Postgres's own answer to a parameterised view and costs no new storage. Live end-to-end on Charlie's
pair: **91 ms**, asserted by `check-3b.ts` with the old figure in the failure message.

### 1.7 · ⚠⚠ A 3A finding that is false, and the check that could not have caught it

Running the 3A verify harness after the sort key changed turned up two failures. One was mine to
fix; the other was not.

`verify-positions-api.ts` asserted *"across the two readings, every member who voted twice voted the
same way twice"*, it passed 23/23, and 3A's report repeated it as a fact about the world:

> *"All 400 who voted in both voted the same way both times — a settled conscience position, not a
> bug."*

**The raw rows say 587 members voted in both readings and 16 of them changed side.** Emma Hardy, Lee
Anderson, Kanishka Narayan, Steve Darling, Andrew Snowden, Paul Foster, Markus Campbell-Savours,
Amanda Hack, Rupert Lowe, Brian Mathew, Chris Hinchliff, Jonathan Hinder, Yuan Yang, Al Pinkerton,
Jess Brown-Fuller, Jack Abbott.

It passed because of the sort key, not the data (`probe-3b-rank.ts`):

| | rank of the 16, of 627 |
|---|---|
| under 3A's key (`|stance| × confidence`) | **612 – 627** |
| under 3B's key (confidence, count, name) | 1 – 23 |

A member who changed their mind has stance ≈ 0, so 3A's product key is ≈ 0 and they sort dead last.
The harness passed `limit: 400`. **All 16 counter-examples were below the cut-off, so the assertion
could not have failed.** It is the same family as *a metric that cannot fail* and *a guard that
cannot fire* — this time wearing the disguise of a passing test whose passing was then written down
as a finding.

Rewritten to assert the *mechanism* — that both shapes exist, that a changed mind is flagged
`divided` and worded "divided record", and that the two readings are shown separately with opposite
sides — and to **require the counter-examples to be visible**, so a future ranking change that
buries them fails here instead of producing another confident sentence.

---

## §2 — P1: THE PUBLIC REGISTERS

Taken in the brief's order, and stopped when the sprint was full. One register is delivered whole
with its coverage numbers; the other two are reported with what blocks them.

### 2.1 · APPG membership and funders — ⛔ NOT BUILT, AND NOT WORKED AROUND

`publications.parliament.uk` returns **403 to every programmatic request**, including its own
homepage, while `members-api.parliament.uk`, `bills-api.parliament.uk`, `committees-api` and
`interests-api` all return 200 from the same process. So it is not a bad path and not an IP block:

| client | result |
|---|---|
| Node `fetch`, research UA | **403** on `/`, `/pa/cm/cmallparty/register/contents.htm`, `/pa/cm/cmallparty/250716/contents.htm` |
| Node `fetch`, browser-shaped UA and headers | **403** on all of the above |
| headless Chromium (Playwright, already a dependency) | **403**, page title **"Just a moment…"** |
| the real Chrome on this machine (claude-in-chrome) | **200**, the full register renders |

"Just a moment…" is a **Cloudflare bot challenge**. The register is reachable by a human with a
browser and not by a program.

⚠ **I did not build a way around it, and I am naming that as a decision rather than a limitation.**
Defeating a bot challenge is not something this project should be doing to a public body's website,
and an ingest that depends on beating one is an ingest that breaks silently the next time the
challenge changes. Decision **D-8** sets out the three legitimate routes.

Also checked and reported rather than assumed: `members-api` has **no** APPG endpoint
(`/api/Reference/AllPartyParliamentaryGroups` → 404), and `interests-api.parliament.uk` **is** open
and machine-readable. It is the Register of Members' Financial Interests, not APPGs — but it is a
genuine unlock for a later sprint, and the reason is in the bytes rather than in my expectation of
them:

```
GET /api/v1/Interests?Take=2        totalResults: 4,100
  item keys: id, summary, parentInterestId, registrationDate, publishedDate, updatedDates,
             category, member, fields, links, rectified, rectifiedDetails
  member: { "id": 4776, "nameDisplayAs": "Munira Wilson", "house": "Commons",
            "memberFrom": "Twickenham", "party": "Liberal Democrat", … }
```

**Every interest carries a full member object with the MNIS id on it**, so an ingest against this
API would need no name matching at all and could not create a wrongly-merged identity — which is a
strictly better identity story than §2.2's donations register, where the Commission publishes only
a free-text name.

### 2.2 · Electoral Commission donations — ✅ BUILT

Fully open, no key, no challenge. 21.5 MB CSV, **89,861 published records**, ingested into
`position_donation` keyed on the Commission's own reference.

**Predictions, recorded in `pilot-3b-ec.ts` before the first run:**

| | predicted | measured | |
|---|---:|---:|---|
| total records | 85,000 | **89,861** | ≈ +6% |
| % naming an individual rather than a party | 12% | **11.7%** | ≈ −3% |
| % carrying a company registration number | 22% | **18.2%** | ≈ −17% |
| % of eligible individual rows that resolve | 35% | **84.6%** | ✗ +142%, far better than predicted |
| % of CH-numbered rows matching an org we hold | 4% | **9.1%** | ✗ +128%, better than predicted |

**Donee resolution — as a share of all 89,861 published records:**

| outcome | rows | % of all records |
|---|---:|---:|
| `unresolved:not-an-individual` (a donation to a party) | 79,391 | 88.35% |
| **`resolved:unique-mnis-name`** | **7,121** | **7.92%** |
| `unresolved:donee-type-excluded` | 2,056 | 2.29% |
| `unresolved:no-entity` | 1,293 | 1.44% |

**As a share of the 8,414 rows that name an eligible individual: 84.6% resolved, 15.4% left
unresolved.**

**Identity resolution obeys the standing rule by construction, not by care.** Neither end is ever
resolved on a similarity score:

- **Donor** — `CompanyRegistrationNumber` only, an exact external key. The donor's *name is never
  consulted*. 16,355 rows carry a number; 1,489 match an organisation we already hold (9.10%).
- **Donee** — the Commission publishes a free-text name and no member id, so there is no external
  key. The rule is made structural instead: a donee resolves only where the normalised name matches
  **exactly one** MNIS-identified person in `graph_entity`. Two Gareth Thomases produce two
  candidates and the row stays unresolved. **The collision is what protects us**, and it is counted
  rather than resolved by picking one.
- ⚠ **And the donee-type exclusion is the load-bearing one.** `RegulatedDoneeType` includes Mayor,
  Councillor, MSP, Senedd Member, Candidate and Members Association. *A councillor who shares a name
  with an MP is precisely the wrongly-merged identity the rule is about, and nothing in the row can
  tell them apart.* Only three types are ever resolved; **2,056 rows are excluded on this ground
  alone**, named here:

| excluded donee type | rows |
|---|---:|
| Members Association | 1,174 |
| Mayor | 358 |
| MSP — Member of the Scottish Parliament | 135 |
| Candidate | 123 |
| MEP | 120 |
| AM — National Assembly for Wales | 47 |
| Cllr. — Member of a Local Authority | 36 |
| Senedd Member | 28 |
| GLA Assembly Member | 25 |
| Police and Crime Commissioner | 7 |
| Other | 3 |

⚠ **The donee link is still an inference and it travels as one.** Every signal carries
`derivation = 'ec-donee-name-match:v1'` — design §3's rule that a versioned method name means a
method change produces new signals rather than silently re-meaning old ones.

**The 15.4% that does not resolve, so the miss can be argued with rather than taken on trust.** The
ten most frequent unresolved recipients are almost all one of two things — a first-name variant the
rule refuses to bridge, or a former member outside our 2016-onward entity set:

```
 61 × The Rt Hon David Miliband MP      59 × The Rt Hon Edward Miliband MP
 48 × The Rt Hon Matthew Hancock MP     40 × The Rt Hon William Hague MP
 38 × Mr Edward Davey MP                38 × Mr James Wharton MP
 37 × Mr Crispin Jeremy Rupert Blunt MP 36 × The Rt Hon Nick Herbert MP
 36 × The Rt Hon Kenneth Clarke QC MP   30 × Mr Virendra Kumar Sharma MP
```

*"Edward Davey" and "Ed Davey" are the same person and the rule will not join them.* That is a real
cost of the rule and it is the right cost: the alternative is a fuzzy matcher, and a fuzzy matcher
that gets Ed Davey right also gets a councillor wrong.

**What the signal layer actually holds:**

| | |
|---|---:|
| rows where BOTH ends resolve and a date is published | 251 |
| **signals emitted** (one per member × donor org × date) | **244** |
| distinct members | 122 |
| distinct donor organisations | 80 |
| date range | 2001-11-01 → 2026-07-07 |

⚠ **244 is thin, and the reason is not the register — it is our entity layer.** 7,121 records resolve
to a member, but only 251 also resolve a donor, because `graph_entity` holds just 4,812
CH-numbered organisations and they were gathered for a different purpose (committee witnesses).
**14,879 rows carry a Companies House number we do not hold.** Ingesting those numbers into the
entity sweep would take the donor side from 9.1% to potentially all 16,355 CH-numbered rows — a
roughly 11× widening of this register from one job that is not the graph's to do (design §3: the
graph never creates organisations). Decision **D-10**.

**Direction 0 means direction 0**, and a check asserts it rather than a comment claiming it:
`EVERY donation signal is direction 0` · `no direction-0 target ever carries a non-zero stance` ·
`direction-0 confidence holds at the ceiling (max 0.15 vs ceiling 0.15)`. Read back live against
their source rows:

```
2026-07-07  Mr Wes Streeting MP    ← SABK LTD                        £  5,000  dir 0 w0.1  ec-donation:C0840215
2026-06-24  Yuan Yang              ← Ecotricity Group Ltd            £ 15,000  dir 0 w0.1  ec-donation:NC0840206
2026-06-15  Mr David Davis         ← Flowidea Limited                £  5,000  dir 0 w0.1  ec-donation:NC0840441
2026-06-04  Dan Carden             ← Arab Investments Limited        £  3,400  dir 0 w0.1  ec-donation:NC0838796
```

### 2.3 · Companies House joins — ⛔ NOT BUILT, blocked on a credential

`COMPANIES_HOUSE_API_KEY` is **not present** in `scrutinise-web/.env`. Reported rather than worked
around. What we hold to join *against* was measured: **4,812 organisations with a
`companies_house_no`** (the brief says 5,496 register-numbered organisations; the difference is
charity numbers, held in a separate column). §2.2's donor resolution is already a Companies House
join in everything but name — it just joins against our own numbers rather than the API's.

---

## §3 — THE VALIDATION SET: DRAFTED, NOT SCORED

**Delivered: `docs/POSITION_VALIDATION_CANDIDATES.md`**, generated by
`scripts/graph/draft-3b-validation.ts`, numbered `M1.001` … so Charlie can accept, reject or amend
each in one line. **Nothing has been scored against anything.**

**The circularity problem is solved by construction rather than by care.** Being careful not to use
votes is not enough — the graph also uses EDM signatures, witness appearances, declared interests
and now donations, and a key drawn from any of those measures the graph against itself. So every
citation is a **bill or amendment sponsorship fetched live from `bills-api.parliament.uk`**, and the
proof that it is non-circular is a number rather than an argument:

> `position_signal` holds **zero** `amendment_sponsorship` rows. 3A's audit found the source data
> does not exist in this database, and `check-3b.ts` prints that zero on every run. **The graph
> cannot be scored against a signal it does not hold.**

It is also better evidence on its own terms — tabling an amendment is a deliberate act no whip
required, whereas a whipped vote mostly measures the whip.

**157 candidate rows across 10 matters** — 16 per matter except Strikes (Minimum Service Levels),
which yielded 13 and says so rather than being padded. Every row carries the sponsor's **MNIS id**
(`sponsors[]` on an amendment is flat and carries `memberId`, so **zero rows** required a name match
and none could create a wrongly-merged identity), and every quoted amendment text was mojibake-
repaired — **0 mojibake sequences survive in the document**.

| # | matter | divisions we hold | candidates | bills-api billId |
|---|---|---:|---:|---:|
| M1 | Assisted dying | 11 | 16 | 3774 Terminally Ill Adults (End of Life) Bill |
| M2 | Removals to Rwanda | 57 | 16 | 3540 Safety of Rwanda Act 2024 |
| M3 | Illegal migration and small boats | 81 | 16 | 3429 Illegal Migration Act 2023 |
| M4 | Nationality and Borders | 84 | 16 | 3023 Nationality and Borders Act 2022 |
| M5 | Leaving the European Union | 78 | 16 | 2045 European Union (Withdrawal) Act 2018 |
| M6 | The generational smoking ban | 8 | 16 | 3879 Tobacco and Vapes Act 2026 |
| M7 | Protest and public order | 31 | 16 | 3153 Public Order Act 2023 |
| M8 | Employment rights and industrial action | 24 | **13** | 3396 Strikes (Minimum Service Levels) Act 2023 |
| M9 | Sewage, water quality and the Environment Act | 39 | 16 | 2593 Environment Act 2021 |
| M10 | Retained EU law and the sunset clause | 25 | 16 | 3340 Retained EU Law Act 2023 |

A row reads like this, and the point is that every part of it is checkable in one click:

> **M1.003 — Dame Meg Hillier (MNIS 1524), Labour**
> · Proposed position on Assisted dying: **PROPOSED — read the quote**
> · Basis: `amendment-sponsor`
> · Citation: Lead sponsor of **NC1** at Report stage, with **36 co-sponsors** (Naz Shah, Antonia
>   Bance, Jess Asato, Kirsteen Sullivan, …)
> · In its own words: *"To move the following Clause— 'No health professional shall raise assisted
>   dying first'"*

**Ten matters, chosen from what the corpus actually holds** (`probe-3b-matters.ts`), remembering the
Commons record starts 2016-03-09: assisted dying, Rwanda, illegal migration, Nationality and
Borders, EU withdrawal, the generational smoking ban, public order, minimum service levels, the
Environment Act, and retained EU law. The classic conscience votes on abortion are deliberately
absent — they predate coverage.

**Every row carries its own basis, and the honest one is labelled as such:**

| basis | what it means | how much to trust it |
|---|---|---|
| `bill-sponsor` | a named sponsor of the Bill itself | **mechanical** — a sponsor supports their own Bill |
| `amendment-sponsor` | put their name to an amendment; the amendment's **own text is quoted** | **direction is PROPOSED**, read off the quote |

⚠ **The direction on an `amendment-sponsor` row is the thing most likely to be wrong**, because an
amendment can strengthen a Bill or wreck it and the text does not always say which. SEARCH S8 found
**4 of 10** case-law gold keys wrong when asserted from outside knowledge; that is the error rate
this format exists to expose, which is why the amendment's own words sit beside every proposal.

⚠ Two data notes found by running it rather than reading it: `summaryText` comes back as an **array**,
not a string, and the API serves **mojibake** (`â€”` — UTF-8 em-dash bytes read as Windows-1252,
the signature in docs/CLAUDE.md §13). Repaired before quoting, because a key Charlie cannot read is
a key Charlie cannot validate.

---

## §4 — HOUSEKEEPING FROM 3A'S OPEN DECISIONS

### 4.1 · Where the 17.5 GB constant lives — ⚠ IT IS OURS, AND ITS PROVENANCE IS CIRCULAR

**`scripts/ingest/search/serve-observer.ts:50`**

```ts
// Neon plan ceiling. The handoff records the storage line at ~17.5 GB; override rather
// than edit if the plan changes.
const NEON_CEILING_GB = parseFloat(process.env.NEON_CEILING_GB ?? '17.5')
```

**Reported, not changed** — the brief says so, and the file belongs to the ingest stream (§5:
*"nothing owned by search, lex or ingest edited — report needed changes instead"*).

Three things about those three lines:

1. **It calls itself a "Neon plan ceiling". It is not one.** The enforced ceiling, read from this
   compute during this sprint, is `neon.max_cluster_size` = **16 TiB**. No Neon plan limit is
   17.5 GB.
2. **Its provenance is a closed loop.** The comment cites *"the handoff"*; the handoff's percentage
   is emitted *by this observer*. `GRAPH_TIER1_REPORT.md` (5 Jul) called it an **"alert line"**,
   correctly; it became a **"ceiling"** in the V26 recheck, and INGEST V38 (16 Aug) already
   established that the wall does not exist. Neither end of the citation is a source.
3. ⚠⚠ **The database passed it during this sprint. It is now 17.64 GiB — 100.8% of the line, and
   0.108% of the ceiling that is actually enforced.** If the observer is running, it is emitting a
   CRITICAL storage alert right now, against a number nobody can source.

**What the replacement needs**, per the brief: our *actual* plan limit from the Neon console, with
the source and the date checked recorded beside it, *because a plan limit is a fact about a day.*
Charlie confirms the number; the one-line edit is ingest's to make. Decision **D-11**.

Graph-owned copies of the same constant have been annotated rather than changed
(`setup-3b.ts` prints the warning inline on every run, naming file and line).

### 4.2 · Bill-level aggregation — do not combine divisions on one Bill ✅ DONE

`positionsFor()` now returns a `byTarget` array in which every requested target the actor has a
signal for appears **separately, labelled, dated, with its own stance wording and its own one-line
claim**, and the admin page renders it whenever more than one target contributed. Nothing sums them.

Two changes worth naming:

- **`byTarget` is computed from the signals, not read out of `position_estimate`.** Two reasons: an
  estimate row goes slightly stale every day because decay is baked into it, and a target with no
  precomputed estimate would silently drop out of the breakdown.
- **`divided` is its own boolean**, not something a reader has to infer from a score near zero. On
  Charlie's pair, `check`s assert that a member who changed side is flagged `divided`, worded
  *"divided record"*, and shown with two opposite sides.

### 4.3 · Amendment sponsorship — what it would actually take

3A's D-6 says *"the API does expose it (`/Bills/{id}` carries `sponsors[]`), so this is an ingest
job of a few hours."* I tested that claim, and **it is right about the endpoint and wrong about
which fact matters.**

`/Bills/3774` (Terminally Ill Adults) carries `sponsors[]` with **two** entries — Kim Leadbeater and
Lord Falconer. That is *Bill* sponsorship: a handful of names per Bill, useful but small.

**The high-value signal is on a different endpoint**, and it is there:

```
GET /api/v1/Bills/3774/Stages/19799/Amendments      totalResults = 95
  amendmentId, marshalledListText ("NC10"), clause, schedule, pageNumber, lineNumber,
  summaryText, amendmentType, statusIndicator, decision, decisionExplanation, sponsors[]
  sponsors[] → { isLead, sortOrder, memberId, name, party, house, memberFrom }
```

Every sponsor carries an **`memberId` — the MNIS id**, which means this ingest needs **no name
matching at all** and cannot create a wrongly-merged identity. (My first probe reported "no MNIS id
published" because it read `x.member?.memberId`; the object is flat. Corrected by looking at the
raw JSON.)

**What it would take, concretely:**

| step | shape | note |
|---|---|---|
| 1 | list bills, then stages per bill | ~5,000 bills; stages only exist on the ones that moved |
| 2 | `Amendments` on Committee / Report / Consideration / Lords Amendments stages only | other stages return `totalResults = 0` |
| 3 | store `(bill, stage, amendment, sponsor memberId, isLead, sortOrder, decision, summaryText)` | direction stays **0** until classified |
| 4 | resolve on `memberId` → `graph_entity.parl_member_id` | exact key; no similarity anywhere |
| ⚠ | **the API is slow** — 5–12 s per call in this sprint's probes | a few hours is optimistic; budget for rate-limited overnight |
| ⚠ | `summaryText` is an **array** and arrives **mojibake'd** | see §3 |

**And it unlocks two things at once**, which is why it is the highest-value missing P0 signal:
`decision` and `marshalledListText` on each amendment map directly onto our own division titles
("Report Stage: Amendment (a) to New Clause 10"), which is the missing half of **D-2** — the
strengthening-vs-wrecking classification that would let a Bill-level rollup mean anything.

### 4.4 · The two dataless signal types, printed by name every run ✅ DONE

`check-3b.ts` prints, on every run:

```
⛔ amendment_sponsorship: 0 signals — NO SOURCE DATA (design §3.3/§3.4)
⛔ committee_membership: 0 signals — NO SOURCE DATA (design §3.3/§3.4)
```

Not a skipped test and not a silent zero — a named absence. It is also, as §3 notes, the property
that makes the validation key non-circular.

---

## §5 — TWO THINGS THAT WENT WRONG IN THIS SPRINT, AND WHAT THEY COST

Both are mine, both were caught by measurement rather than by review, and both are recorded because
the failure mode generalises.

### 5.1 · ⚠⚠ I truncated `position_estimate` and left it half-rebuilt for an hour

Adding `political_donation` to `position-config.ts` changes `configVersion()` (by design — §9,
*"never survives a tuning change silently"*), so the 2.3M-row estimate table needed rebuilding. The
rebuild **truncated the table, wrote 1,357,000 rows, and died on a client-side read timeout**,
leaving the table partial and `position_estimate_meta` describing a build that no longer existed.

**The cause was a change I had made an hour earlier and had already measured as safe.** I redefined
the `position_signal_vote` view as `SELECT * FROM position_signal_vote_for(NULL)` so the
classification ladder would have one home. That is correct, returns byte-identical rows, and I
proved it — over a *target-filtered* read, which is the access pattern it was built for. The
estimate build uses the *other* access pattern:

```
build-position-estimates.ts:  WHERE actor_id BETWEEN $1 AND $2
```

Against a set-returning function, `actor_id` is an **output column**, so that filter can only be
applied after the fact and every batch hash-joins the entire vote arm:

```
->  Subquery Scan on position_signal_vote_for  (rows=3894)
      ->  Hash Join  (rows=709704 loops=3)          <- the whole vote arm, per batch
```

3.6 s per batch and rising, against 1.6 s for the shape 3A wrote. 3A's build took 225 s; mine passed
600 s at 59% done.

**The fix keeps both properties.** The view keeps its own `FROM` clause exactly as 3A wrote it — so
the planner keeps its plan — and only the `CASE` ladder is replaced by `position_vote_class(...)`, an
IMMUTABLE scalar function the planner folds. The classification still has one home. The `FROM`
clause is now written twice, deliberately, and that duplication is made safe the only way a
duplication can be: `check-3b.ts` asserts the view and the function return identical rows target
type by target type, **and separately asserts the comparison sample is non-empty**, because a
row-for-row comparison over zero rows passes for free.

**The rebuild then completed, and the cost of the fix is stated rather than glossed:**

```
2,317,767 signals → 2,304,858 estimates in 248.1s   (7,843/s)
3A, for comparison:  2,317,523 → 2,304,748 in 225s  (~8,600/s)
config_version 3a.d28ce0b05297 on the table, 1 distinct — more than one would mean a partial rebuild
attention-only estimates 164,348; of those, 0 exceed the 0.15 ceiling  ✓
database 17.45 → 17.68 GiB
```

⚠ **~9% slower than 3A**, and that is the price of the scalar function call replacing the inline
`CASE` on 2.1 million rows. Named rather than absorbed: it buys one home for the classification
ladder, and 23 seconds on a job that runs when weights change is a trade worth making — but it is a
real cost and the next person to wonder why 225 became 248 should not have to find out by bisecting.

⚠ **The lesson is narrower and more useful than "measure before changing".** I *did* measure. I
measured the access pattern I was optimising and never asked whether anything else read the same
object differently. **One object, two readers, one benchmark.**

### 5.2 · A guard fired, and a generated function silently didn't

Two smaller ones from the same hour:

- `setup-3b.ts`'s guard 3 **refused my own DDL** because I had added `position_donation` to the
  schema and not to the allow-list. Working exactly as designed, on its author.
- ⚠ **Re-running `setup-3a.ts` silently reverted 3B's view redefinition**, because `schema-3a.sql`
  contains its own `CREATE OR REPLACE VIEW position_signal_vote`. Both versions return identical
  rows, so nothing would have shown. `check-3b.ts` now asserts the live view definition mentions
  `position_vote_class` — and asserts it does **not** mention `position_signal_vote_for`, which is
  the shape that caused §5.1.
- ⚠⚠ **`weightFunctionSql()` in `setup-3a.ts` hard-coded its list of signal types.** Adding
  `political_donation` to the config therefore did *not* add a case to the generated SQL:
  `position_raw_weight('political_donation', NULL)` returned **NULL** while the TypeScript config
  happily returned 0.1. Two sources of truth wearing one name — which is the exact thing generating
  that function was supposed to prevent. Now derived from the config's own keys, and `check-3b.ts`
  asserts the SQL knows every signal type the config knows. **Both of these checks were watched
  failing against the real broken state before the fix was applied.**

---

## §6 — WHAT IS NOT DONE, NAMED

- **APPG membership and funders** — behind a Cloudflare bot challenge (§2.1). Not built and not
  worked around. **D-8.**
- **Companies House joins** — no API key in the environment (§2.3). **D-12.**
- **Nothing is scored.** `POSITION_VALIDATION_CANDIDATES.md` is a draft awaiting Charlie's verdicts;
  no accuracy figure is claimed anywhere in this report, and design §8's gate is still shut.
- **No weight was retuned.** §1.5 is a proposal with evidence and nothing more, per the brief's ⚠.
- **The free-vote heuristic's misses are diagnosed, not fixed** (§1.3). Fixing it changes 328
  signals' weights on one Bill alone, which is a tuning change, which needs the answer key.
- **The deepening wiring** — still not applied. 3A left the snippet ready; it remains out of scope
  and the deepening config is not the graph's to touch.
- **Amendment sponsorship** — measured and specified (§4.3), not ingested.
- **97.1% of EDM signatures** — still primary sponsors only, unchanged since 3A.
- **A browser walk of `/admin/positions`** — not possible from here. The Chrome extension has no
  host permission for `localhost:3000` and holds no Clerk session on production; 3A proved the
  unauthenticated probe cannot tell a deployed route from an absent one (both 307 to sign-in). **The
  click is Charlie's**, and §7 names exactly what to click.
- **The 596 MB `position_estimate` question (3A's D-1)** — deliberately not revisited. It has become
  *less* load-bearing, not more: `positionsFor()` now computes `byTarget` from signals, so the read
  path no longer depends on the table at all. That makes 3A's proposed reversal cheaper than it was.

---

## §7 — DECISIONS FOR CHARLIE

**D-7 · The ranking key is biased, and both available keys are biased in opposite directions.**
Confidence-first (the brief's specification, now implemented) puts the *least decided* members at
the top, because contradictory signals evade the harmonic discount and accumulate more mass
(§1.4c). 3A's `|stance| × confidence` put them dead last, which is how a false finding got published
(§1.7). *Recommendation:* **keep confidence-first and keep the tie disclosure**, because a key that
surfaces counter-examples is safer than one that hides them — then fix the arithmetic via P-1/P-2
once §3 is scored. *Consequence of doing nothing:* the top of every page is the members with the
least settled record, which reads as a bug to anyone who knows the subject.

**D-8 · APPG is behind a bot challenge. Three legitimate routes, none free.** (a) Ask the Commons
Library or the Registrar for the register as data — it is published under Parliamentary copyright
and a data request is ordinary. (b) Charlie downloads the register pages by hand once a quarter and
drops them in R2; the parser is then a morning's work. (c) Drop APPG and take
`interests-api.parliament.uk` instead, which is open, machine-readable and **carries the MNIS id on
every record** (verified: 4,100 interests, each with a `member.id`) — a strictly better identity
story than the donations register, though it answers a different question. *Recommendation:* **(c)
now, (a) in parallel.** *Consequence:* the funded-group prior stays unbuilt, which is the cleanest
soft alignment signal in the P1 tier.

**D-9 · `political_donation` weight 0.1, direction 0, half-life 8 years.** Design §5 has no row for
it. I gave it the declared-interest weight because it is the same *kind* of fact — an alignment
prior with a date and a counterparty — and giving it more would assert that money buys a position,
which this graph is in no position to claim. The half-life is [NOT IN DESIGN] and borrows the vote
half-life, because a donation *is* a dated event whereas a declared interest is a standing
relationship. *Recommendation:* keep both. **Two numbers, your call.**

**D-10 · The donations register is 11× smaller than it needs to be, and the fix is not the graph's
job.** 7,121 records resolve to a member but only 251 also resolve a donor, because we hold 4,812
CH-numbered organisations and **14,879 records carry a number we do not hold**. Design §3 forbids the
graph from creating organisations. *Recommendation:* **hand the 14,879 numbers to the entity sweep**
(the same place 3A's D-5 sends the 120 excluded members). *Consequence of doing nothing:* the
register stays at 244 signals and looks like a failed experiment rather than a blocked one.

**D-11 · The 17.5 GB alert line has been passed and cannot be sourced.** The database is 17.64 GiB —
100.8% of a number whose only citation is itself (§4.1). *Recommendation:* read the real plan limit
off the Neon console and give ingest the one-line replacement, **with the source and the date beside
it**. *Consequence of doing nothing:* a CRITICAL storage alert fires continuously against a fiction,
and the next sprint designs around it exactly as 2D-2 did.

**D-12 · No `COMPANIES_HOUSE_API_KEY`.** Free to obtain, rate-limited at 600 requests / 5 minutes.
*Recommendation:* create one if D-10 is accepted; without it the CH join is only ever against
numbers we already hold.

**D-13 · The free-vote heuristic misses 2 of 11 divisions on a Bill that was a free vote
throughout, and the misses cost more than 3A believed** (§1.3). *Recommendation:* treat P-3 as the
first tuning change after the answer key is validated, ahead of any weight change — retuning weights
on top of misclassified signals tunes the wrong thing. *Consequence of doing nothing:* 328 signals
on this Bill alone assert a costly act of defiance that did not occur, at the highest weight in the
config.

---

## §8 — DELIVERY (docs/CLAUDE.md §20)

| # | check | result |
|---|---|---|
| 1 | every file the sprint created is committed | ✅ **28 of 28** confirmed with `git ls-files --error-unmatch` against the file list, **not** `git status` — an ignored file never appears in it. The one file deliberately excluded is the 21.5 MB EC bulk CSV cache, and the ignore rule is **anchored to that exact path** (`/scripts/graph/.ec-donations.csv`), not a `*.csv` pattern: §20's own second incident was an unanchored rule swallowing a real directory. |
| 2 | the remote has the commits | ✅ `git ls-remote origin Main` = local HEAD `8a6ee81`, byte-identical; `git merge-base --is-ancestor` passes. Checked against the **server ref**, not cached status. Seven scoped commits, `5c8ae1f`…`8a6ee81`. |
| 3 | the deployment is green AND is Production | ⛔ **UNREADABLE FROM HERE — and measured just now rather than recalled.** `GET /v2/user` → **200**; `GET /v6/deployments` → **403** with `"saml":true,"scope":"charlie-leachs-projects"` in the body. Exactly the signature docs/CLAUDE.md §19 describes, and exactly the one that reads like an expired token and is not. **Charlie's dashboard.** |
| 4 | the running site serves the change | ⛔ **CANNOT BE RUN, and the negative control that kills it was re-run today rather than quoted from 3A:** `/admin/positions` → 307, `/admin/lex-general` → 307, **`/admin/nonexistent-control-xyz` → 307**, and the same for the two API paths. The route that does not exist behaves identically to the one that does, so a probe would "pass" whether or not this sprint deployed. Reported as **not run**, never as passed. |

**The honest closing sentence: pushed, and NOT verified live, because every surface this sprint
touches is authenticated and the negative control shows an unauthenticated probe cannot tell
deployed from absent.** What *is* verified is the code and the data — `check-3b.ts` 50/50 with 7 breaks firing and 6
negative controls, `verify:positions` 35/35 live against Neon, `tsc` clean in `scrutinise-web`,
`next build` compiled with **`/admin/positions` and `/api/admin/positions` both present** in
`.next/server/app/`, and every figure above read back off the production database.

▶ **Charlie closes checks 3 and 4:**

1. Confirm a green **Production** deployment (read the environment column, not just the status).
2. `/admin` → **"Position Graph"**.
3. Search **`Terminally Ill Adults`**. Tick **"Amendment (b) to New Clause 14"** *(13 Jun 2025)* and
   **"Amendment 12"** *(20 Jun 2025)*. Press **Show positions**.
4. **A second, independent deployment marker, in case the first is ambiguous:** open *"The config
   these numbers came from"* at the foot of the page. It should read **`3a.d28ce0b05297`**. The
   build 3A left behind was `3a.4ee358f542ea`; the hash changed because 3B added a
   `political_donation` weight, which is exactly the behaviour design §9 asks for — *"never survives
   a tuning change silently"*. If it still says `4ee358f542ea`, production is serving the old build.
5. **The string that proves this sprint deployed** is the amber line under the header:
   *"40 of 555 actors, tied at this confidence (0.671, 2 signals) — ordered by name. This is not a
   ranking."* If the page instead says "showing the top 40" over an alphabetical list, production is
   serving the old build.
6. Below it, every actor should now read as a sentence naming the divisions — e.g. *"opposed, across
   2 things asked about — against "…Amendment 12" (2025-06-20); …"* — with the amber caveat
   underneath. Open **Amanda Hack** or **Chris Hinchliff** on the two *readings* instead
   (Second + Third) to see a member who changed side rendered as a divided record with both sides
   shown separately.
7. Then **`docs/POSITION_VALIDATION_CANDIDATES.md`** — one VERDICT line per row. That document is
   the gate on any of this reaching a user, and until it is scored nothing here has been measured
   against anything.
