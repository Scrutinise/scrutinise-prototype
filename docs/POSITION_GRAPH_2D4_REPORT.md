# STAGE 2D SPRINT 4 — THE POSITIONS ARE BETTER, AND THE PEOPLE HAVE A TENURE SOURCE

**Executes:** `docs/BRIEF_GRAPH_2D4.md` §1–§4
**Written:** 17 August 2026, 10:16 UTC
**Owner:** CC-Graph
**Cost:** $0.62 in LLM calls (four trial runs of 49 submissions), plus 5,234 free API requests.

---

## THE HEADLINE

**§1: the error rate on the same fifty goes 54% → 44%, and it is attributable to one change.**
**§2: 189 offices now have a real dated succession, against 2D-3's 1.**
**And the change the brief expected to help most — a `qualified` polarity — fixed none of the
failures it was designed for.**

| | baseline (2D-3) | v2 | v3 |
|---|---:|---:|---:|
| correct, on the reader's own verdicts | 23/50 (46%) | **28/50 (56%)** | 30/50 (60%) |
| error rate | **54%** | **44%** | 40% |
| positions kept over the 49 submissions | 269 | 212 | 180 |
| ⚠ rows lost to a MECHANICAL discard, not a decline | — | 4 | 9 |
| ⚠ prefix-check discards, all rows | 2 | 23 | **62** |
| **adopted** | — | **YES** | **NO** |

**v3 looks better and is not.** Its extra 4 points come from mechanical discards, its prefix-discard
rate tripled, it eliminated the `balanced` polarity entirely, and — the decisive test — **the
`qualified` polarity landed on 0 of the 11 `nuance-flattened` failures it was built for.**

---

## §1 — THE POSITIONS

### v2: one change, and it is the threshold

The single difference from 2D-3's prompt: **start from "no position" and require evidence to leave
it**, with a stated three-part bar (same question, a passage that persuades on its own, the
proposition's own distinguishing subject matter in that passage) and an explicit ban on quoting a
bibliography, a self-description, a heading or the inquiry's own question.

| | count |
|---|---:|
| ✓ HELD — baseline correct, v2 keeps it | 18 |
| ⚠ REGRESSION — baseline correct, v2 drops it | 5 |
| ✓ FIXED — baseline wrong/partly, v2 drops it | 10 |
| · STILL — baseline wrong/partly, v2 keeps it | 17 |

**3 of the 5 regressions were mechanical discards, not declines.** So the change itself trades **10
fixed for 2 genuine losses — 5:1.** Attribution over the original failure shapes: it removes
`position-invented` and `proposition-mismatch` rows, and leaves `polarity-flipped` untouched, which
is what a threshold change should do.

⚠ **Run-to-run variance is ±1–2 at n=50** (two clean v2 runs scored 29 and 28). The +5 to +6 gain is
larger than that, but a fifty-item sample cannot support a tighter claim than "54% → 42–44%".

### ⚠ My first v2 was confounded, and the confound was mine

The first run reported **118 rows discarded on the prefix check against 125 kept** — where 2D-3's
full run discarded 155 in 11,700 (1.3%). I had compressed the field instructions to one line while
changing the threshold, so v2 differed from the baseline in **two** ways and neither was
attributable. Restoring 2D-3's field wording verbatim took the discards to 23 and made the
comparison mean something. **The brief's "one change at a time" is not a style preference; it is the
only reason the 10-for-2 number exists.**

### v3: the qualified polarity, and why it is refused

v3 = v2 **plus** a `qualified` polarity with a required `condition` and `direction`. It produced 9
qualified rows, and some are genuinely good — *"if it is properly resourced"*, *"provided it does
not widen inequalities in access"*, *"provided it is targeted at those with the highest clinical
need"*. The feature works.

**It does not work where it was needed.** Of the 11 `nuance-flattened` baseline failures, v3 recorded
6 as plain `for`, discarded 3 on the prefix check and dropped 2. **Zero became `qualified`.** And it
did damage elsewhere: `balanced` went from 6 rows to **0** — `qualified` cannibalised it — while
prefix discards went 23 → 62, because two extra output fields degraded the echo the correlation
check depends on.

**So v2 is adopted and v3 is not.** A conditional-position field is still the right idea; it needs a
cheaper carrier than three new output fields on the main call — most likely a second pass over
positions already found, which cannot disturb the echo.

### The opposite failure, checked as §1 requires

§1: *"a 'no position' that should have been 'against' is invisible in a hand-score of extracted
positions. Score a sample of submissions the model declined."*

Ten (submission, proposition) pairs v2 declined **and** the baseline never scored, read by hand with
a mechanical term-match window for orientation. **Nine were readable and all nine declines are
correct:** alcohol-treatment funding put to a submission about less-survivable cancers; nurture
groups put to a document recommending online-safety training; a 0-25 CAMHS pathway put to Cornwall
Mind on adult severe mental illness. **No evidence of under-attribution.**

### The two failures the verbatim check cannot catch

A rule was written and **scored before being applied**, as §1 demands. Three tests: citation shape,
self-introduction, and document position.

| configuration | false positives on the 23 accepted extracts | of the 2 known-bad, caught |
|---|---:|---:|
| citation + self-intro + **document-tail** | **1/23 (4.3%)** | 1/2 |
| citation + self-intro (**adopted**) | **0/23 (0.0%)** | 1/2 |

**The positional test is the bad part and is off by default.** Its one false positive was #16097 —
*"Investment in transformation on a local level…"*, a genuine conclusion that happens to sit in the
last 6% of its document. It cannot tell a reference list from a closing argument, and it never could:
both live at the end.

⚠ **The bibliography case (#17758) is still MISSED**, because the quoted line —
*"Community-based physical and social activity for older adults with mild frailty: a rapid
qualitative study…"* — is a paper's title with no author, year or DOI in it. And the rule stays a
**flag, never a delete**: a positive class of two cannot justify discarding rows.

---

## §2 — PEOPLE: A REAL TENURE SOURCE

**Verified before anything was designed on it**, per the brief. `members-api.parliament.uk/api/
Members/{id}/Biography` carries `governmentPosts`, `oppositionPosts` and `otherPosts`, each with a
name, a **startDate and an endDate**. There is no bulk endpoint (`Reference/Posts` and friends all
404), so it is one request per member.

**5,234 of 5,234 members fetched, status `ok` on every one, 7,970 dated post spells.**

| | |
|---|---:|
| distinct post names | 1,560 |
| **held one at a time, dated → usable as an office** | **189** |
| ⚠ refused: several holders at once | 604 |
| single holder — nothing to resolve | 767 |
| ⚠ refused: a holder with no start date | 0 |

**Against 2D-3's attempt on `graph_member_name`: 1 office of 6,512 surfaces at 63.8% accuracy.** The
mechanism was always sound; the source was the wrong table. 604 refusals are posts like "Minister of
State", which several people genuinely hold simultaneously and which is therefore not an office.

### The validation is a different kind, and that is stated rather than glossed

2D-3 could score office-by-date against `division_votes`, because a vote independently carries the
true member id. **There is no equivalent independent truth for "who held post X on date D" — the
register is the assertion.** So instead of one accuracy figure:

**Hand spot-check, eight cases of public record: 7 right, 1 wrong.**

```
✓ secretary of state for health and social care  2019-01-15  Matt Hancock
✓ secretary of state for health and social care  2022-01-15  Sir Sajid Javid
✓ chancellor of the exchequer                    2018-06-01  Lord Hammond of Runnymede
✓ chancellor of the exchequer                    2021-06-01  Rishi Sunak
✓ secretary of state for foreign and commonwealth affairs 2017-06-01  Boris Johnson
✗ leader of the house of commons                 2019-11-01  NOBODY
✓ lord president of the council and leader of the house of commons 2024-10-01  Lucy Powell
✓ lord president of the council and leader of the house of commons 2023-01-15  Penny Mordaunt
```

⚠⚠ **THE ONE MISS IS THE SPRINT'S REAL LIMIT, AND IT IS NOT AN ACCURACY PROBLEM.** Jacob Rees-Mogg
was Leader of the House on 1 November 2019 — filed under *"Lord President of the Council and Leader
of the House of Commons"*. The bare *"Leader of the House of Commons"* post exists too, with
different holders, as does *"…and Lord Privy Seal"*. **One office, several post-name variants**, each
a correct dated succession, none of them the whole office. The last two rows prove the mechanism is
right while the KEY is incomplete.

⚠ **And they must not be merged.** Folding *"Leader of the House of Commons and Lord Privy Seal"*
into *"Lord Privy Seal"* would join two genuinely different offices — the same asymmetry as the
title-stripping rule the brief states. **Matching a mention ("the Leader of the House") to the right
post-name variant is a separate problem and this sprint has not solved it.**

### ⚠ A defect the verification caught, in my own classifier

The first version merged each person's spells into `min(start)..max(end)` before testing overlap.
Two bugs in one line: a NULL end means *still in post* and is therefore **maximal**, but the merge
preferred a concrete date and so **narrowed** the window; and merging spells at all invents tenure
across a gap the register does not assert. **`verify-2d4.ts` reported 13 posts classified as offices
whose stored holders demonstrably overlap.** Replaced by the definition itself — no two *different*
people at the same time, one person's two spells are not a conflict — and the overlap count is now 0.

### The brief's test case, run and reported

```
MNIS  3296  The Lord Archbishop of Canterbury  (no start date) -> current    0 votes
MNIS  2205  Lord Carey of Clifton              1991-03-27 -> 2002-10-31    219 votes
MNIS  3620  Lord Williams of Oystermouth       2003-02-03 -> 2013-01-08      8 votes
MNIS  4252  The Lord Archbishop of Canterbury  2013-02-26 -> 2024-11-06     84 votes
MNIS  4696  The Lord Archbishop of Canterbury  2026-02-04 -> 2026-03-18     88 votes
```

**Episcopal posts in `graph_member_post`: 0.** A see is not a government, opposition or party post,
so it is absent from the Biography endpoint and **MNIS 3296 stays unresolved** — the correct outcome:
this sprint gives ministers a tenure source and leaves bishops exactly where 2D-3 left them.

**944 Bishops' votes exist in the 1991–2002 window and none can be misattributed by this mechanism**,
for a structural reason rather than a lucky one: a division vote already carries its own member id,
so office-by-date is never consulted for one. It is consulted only where all we hold is a name and a
date.

⚠ **NOTHING WAS STAMPED ONTO `graph_entity`.** `key_source = 'office-by-date'` appears on 0 entities
and `verify-2d4.ts` asserts it. An entity is a claim that mentions are one actor; an office cluster
is several actors sharing a title, so stamping the cluster would build exactly the composite actor
Amendment 2 §1 rules out. The confidence is recorded on the POST (0.95 — above a name match, below a
stable key), not on a person.

---

## §3 — THE THREE REGISTER-AMBIGUOUS NAME MATCHES

All three the brief named, found and cleared:

| entity | keyed to | the surface is shared by | register spellings |
|---|---|---|---|
| Baroness Meacher | MNIS 3810 @ 0.9 | 3810, 454 | Baroness Meacher \| Mr Meacher |
| Mr George | MNIS 317 @ 0.9 | 317, 3706 | Mr George \| The Lord George |
| Robinson | MNIS 1456 @ 0.9 | 1456, 307 | Mr Robinson \| Mrs Robinson |

**The name stays; the claim about which person it is goes.** `parl_member_id` cleared, confidence
back to the unkeyed 0.7, each logged to `graph_merge_log` first so it is recoverable, and **all 6
edges kept**. People carrying a member id by name match: 788 → 785.

⚠⚠ **AND THE MORE INTERESTING FINDING: two of the three ambiguities are CREATED BY US.** *Baroness*
Meacher and *Mr* Meacher are two different people, and so are *Mr* George and *The Lord* George — the
register distinguishes them perfectly. It is `normalisePersonName`'s honorific-stripping that folds
them together. **That is the brief's own §2 rule biting on the spine:** a title-preserving normaliser
would have resolved 2 of these 3 correctly instead of needing them cleared. Only `Robinson`
(Mr/Mrs, same honorific class) is genuinely ambiguous. **Reported, not fixed — changing the
normaliser re-keys the whole person spine and is a sprint of its own.**

---

## §4 — WHAT "DONE" LOOKS LIKE, AGAINST THE BRIEF

- ✅ **Re-scored error rate on the same fifty, one change at a time, each attributable** — 54% → 44%
  on v2, with v3 measured and refused
- ✅ **A sample of declined submissions scored** — 9 of 9 declines correct, no under-attribution
- ✅ **The tenure source that proved out** — 189 dated offices, with the MNIS 3296 case reported
- ✅ **Resolution reported with merges and splits separate** — §3's three clears, logged and
  reversible, with the honorific-stripping cause named
- ✅ **Nothing user-facing.** 44% is better than 54% and still not a number to show anyone.

`verify-2d4.ts`: **22 checks, 22 pass, 7 of them negative controls.** `tsc --noEmit` clean for every
file this sprint touched. The graph of record is untouched — `graph_position` still holds exactly the
37,657 rows 2D-3 wrote, and every trial lives in `graph_position_trial`.

---

## WHAT IS NOT DONE

- **The full re-extraction under v2.** The 2,982-submission run would cost ~$8.50 again. Worth doing,
  but the next change (a conditional-position pass) will want its own run, so one run should carry
  both.
- **A conditional-position field.** Still the right idea; needs a second pass rather than three more
  fields on the main call.
- **Mention → post-name matching**, which is what would turn 189 dated offices into resolved people.
- **Peerages and company officers** — §2's items 2 and 3, both untouched. Companies House officer
  dates arrive free with 2D-3's bulk download, already on disk in a previous session's scratch.
- **The title-preserving normaliser**, which §3 shows would fix ambiguities rather than clear them.

## FOR CHARLIE

1. **v2 is ready to become the extractor.** 10 fixed for 2 lost, no output-shape change, and the
   declines check out. The full re-run is a decision about $8.50, not about correctness.
2. **v3's lesson is worth more than v3.** A feature can work perfectly and still not touch the
   failures it was justified by — which is only visible because the same fifty were re-scored.
3. **Your office-by-date insight now has a working source for ministers**, and the remaining gap is
   name-variant matching, not tenure.
4. **§3 says our own normaliser is manufacturing ambiguity.** Two of three "coin flips" were the
   register being clear and us discarding the distinguishing word.
