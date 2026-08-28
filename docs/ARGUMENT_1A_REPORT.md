# ARGUMENT 1A — SEEDS, PROPAGATION, AND TEN QUESTIONS

**Sprint:** ARGUMENT 1A · **Executes:** `BRIEF_ARGUMENT_1A.md`, which executes
`MECHANISM_AND_ARGUMENT_GRAPH_DESIGN.md` §3 and §5 stages 3–4 · **Written:** 2026-08-28
**Predictions logged before every measurement:** `docs/census/argument-1a-predictions.json`

---

## THE HEADLINE

1. ⚠⚠ **CHARLIE'S PERORATION HYPOTHESIS IS SUPPORTED, AND MY PREDICTION WAS WRONG IN DIRECTION.**
   Over **8,959 speeches and 10.2 million words**, argument-marker density rises through a speech:
   the **opening fifth is the sparsest** and the **closing fifth the densest**, at **1.57×** the
   opening on the narrow instrument and **1.30×** on a second, broader one. I predicted the opposite
   and said so first.
2. ⚠⚠ **AND THE CONFOUND I WENT LOOKING FOR STRENGTHENED THE RESULT INSTEAD OF EXPLAINING IT AWAY.**
   A committee report's *Conclusions* chapter is at the end by construction, so pooling reports with
   speeches could have manufactured the effect. Measured apart: **speeches 1.57×, committee
   documents 0.86×** — the documents were diluting it.
3. ⚠⚠ **HALF OF WHAT DENSE RETRIEVAL RETURNS FOR AN ARGUMENT PROBE IS A FRAGMENT.** 48.8% of dense
   candidates are under 30 words and 28.2% under fifteen — *"Where is the money to come from?"*
   retrieved four separate times from four different decades. Median dense candidate **32 words**
   against **83** for a random passage and **130** for the keyword arm. **The passage unit is doing
   something nobody designed.**
4. **`EVIDENCE_GAP` fails on word sense, not polarity, and that is worse.** Most of what came back
   was *"there is no evidence against him"* — criminal evidence about a person — or a minister
   saying *"we have no evidence of that"*. Neither is a claim about a policy's evidence base.
5. **The instrument holds.** 60 random control passages read one at a time: **41 untagged, 68.3%**,
   comfortably above the brief's one-third floor. My prediction of 75–90% was too high, and that is
   scored as a miss.

---

## §0 — WHAT WAS PREDICTED, AND HOW THE PREDICTIONS SCORED

Written to `docs/census/argument-1a-predictions.json` before any measurement in this sprint.

| prediction | measured | verdict |
|---|---|---|
| Peroration: opening densest; closing/opening < 1; effect small | closing densest; **closing/opening 1.57×** (speeches) | ❌ **WRONG IN DIRECTION** |
| Peroration effect too small to justify weighting the seeds | 1.30–1.57× — real, and modest | ⚠ half right |
| Counter-hypothesis: short interventions denser than long speeches | short **0.81×** narrow, **0.92×** stance — *less* dense | ❌ WRONG |
| Random control sample 75–90% untagged | **68.3%** (41 of 60) | ❌ outside the range, right side of the floor |
| Clearest signal: ENFORCEMENT, COST, EVIDENCE_GAP | ENFORCEMENT and COST yes; **EVIDENCE_GAP is the worst of the ten** | ⚠ half right |
| Spend near zero, under £0.20 | see §6 | ✅ |

**Four of six predictions were wrong or half wrong.** That is the useful outcome: every one of them
was wrong because of something about the corpus nobody had looked at.

---

## §1.1 — THE PERORATION HYPOTHESIS

`npm run argument:peroration` → `docs/census/argument-1a-peroration.json`.

**Population:** parliamentary sections of **≥300 words** — short enough speeches have no "opening
fifth" to distinguish from a "closing fifth". Sampled **`ORDER BY md5(id)`** within each
(collection, decade) stratum, ≤200 per stratum. **9,959 long speeches and documents drawn, 9,959
bodies read from R2; 9,800 short interventions in the counter-arm.** 52 strata, from the 1830s to
the 2020s; the counts are in the artefact.

⚠ **IT CANNOT BE TESTED THROUGH THE VECTOR INDEX, AND THAT IS THE FIRST FINDING — COUNTED, NOT
INFERRED.** The chunker emits **one chunk for any section under 4,096 characters** and caps long
ones at 8 windows (~22,240 characters). Measured over the **13,724,557** compiled parliamentary
sections:

- **12,705,570 — 92.6% — are a SINGLE chunk.** For nine sections in ten there is exactly one passage
  and therefore no "position within the speech" at all.
- **53,347 — 0.39% — are longer than the eight-chunk cap covers**, so their tails carry no vector.
  Real, and much smaller than the first figure.

**A position experiment run over chunks would have been measuring the chunker.** This reads the
stored body out of R2 and splits it by word count.

### Two instruments, reported apart and never summed

| | what it is | why |
|---|---|---|
| **narrow** | the ten tags' own MOVE patterns | what §2 propagates on. Fires **0.070 times per 1,000 words** — about once in fourteen thousand |
| **stance** | the constructions with which a speaker asserts rather than narrates | the narrow set is too sparse for a per-fifth figure at any sample size affordable here; this one fires 10× more often |

⚠ **The narrow set's sparsity is itself a finding for §2**: at 0.07 hits per 1,000 words, the
deterministic patterns would tag on the order of a hundred thousand passages across the whole
parliamentary corpus. That is a useful filter and a hopeless position instrument.

### The result — SPEECHES ONLY, which is the population the hypothesis is about

**8,959 speeches. 549 narrow hits, 6,493 stance hits.**

| fifth | narrow / 1k | stance / 1k | procedural closers / 1k |
|---|---:|---:|---:|
| opening | **0.051** | **0.634** | 0.121 |
| 2nd | 0.068 | 0.771 | 0.023 |
| middle | 0.063 | 0.813 | 0.029 |
| 4th | 0.067 | 0.851 | 0.039 |
| closing | **0.080** | 0.825 | **0.256** |

- narrow: opening/middle **0.82×** · closing/middle **1.28×** · **closing/opening 1.57×**
- stance: opening/middle **0.78×** · closing/middle **1.01×** · **closing/opening 1.30×**

**Both instruments agree, and they are independent of each other.** The opening fifth is the
sparsest on both. *"Throat-clearing"* is exactly right — and it is the OPENING that is the throat-
clearing, not the middle.

### The confound, measured rather than assumed away

Procedural closers — *"I beg to move"*, *"I commend the amendment"* — spike **8.8×** in the closing
fifth (0.256 against 0.029 in the middle) and **4×** in the opening, where an amendment is moved.
They are counted on their own axis and share no pattern with the argument markers, so they cannot be
driving the effect.

⚠⚠ **The bigger confound was the corpus.** `committees-reports` and `committees-evidence` are not
speeches: a report's *Conclusions and recommendations* chapter sits at the end BY STRUCTURE.
Measured apart:

| population | n | narrow closing/opening |
|---|---:|---:|
| speeches (Hansard, devolved records) | 8,959 | **1.57×** |
| committee documents | 1,000 | **0.86×** |

**The documents fall the other way.** Pooled they gave 1.39×; the speeches alone give 1.57×.
The effect is a property of speaking, which is what Charlie claimed.

### The counter-hypothesis, refuted

I predicted a short intervention would be denser than any fifth of a long speech, because *"an
intervention is nothing but the point"*. **9,800 short interventions, 493,264 words: narrow 0.057
per 1k against 0.070 (0.81×), stance 0.647 against 0.701 (0.92×).** Short interventions are *less*
argumentative, not more — most of them are questions, points of order and one-line answers.

### What follows for the seed draw

The hypothesis holds and the effect is **1.3–1.6×**. That is **not** large enough to restrict a
draw to perorations — four fifths of the arguments are somewhere else — but it is free enrichment
for anything that has to scan in an order: **start at the back.** Recorded here rather than baked
into the sampling, per the brief's warning that a prior in the sampling silently shapes everything
above it.

⚠ **Found on the way and reported to ingest, not fixed:** `historic-hansard` holds **788 rows dated
before 1800, the earliest 23 June 1013** — nine centuries before Hansard existed. The first run
produced strata labelled `1050s` and `1100s`. Excluded here by a date floor.

---

## §1 — THE SEED SAMPLE

`npm run argument:seed-draw` → `docs/census/argument-1a-candidates.json`; labels in
`scripts/argument/seeds.ts` and `scripts/argument/controls.ts`.

**Two arms, because they miss different things:**

| arm | how | yield |
|---|---|---|
| **dense** | 3 probe queries per tag against `vector-serve`, tier `parliamentary` | 1,179 hits → 369 selected after post-stratification |
| **keyword** | 3 literal phrases per tag in BM25, then **the tag's own regex applied to the body from R2** | 900 proposed by BM25 → **255 confirmed (28.3%)**, 31 selected |

⚠ **BM25 is not a phrase matcher and the numbers say so.** *"Who is going to pay for"* proposed 90
documents and 7 survived the regex. *"Unintended consequence"* proposed 90 and 59 survived, because
that phrase is a fixed collocation. **The regex disposal is doing most of the work in the keyword
arm**, and without it that arm would be noise.

**Strata drawn** (all candidates, by decade): 1830s 1 · 1860s 1 · 1870s 3 · 1880s 2 · 1890s 6 ·
1900s 9 · 1910s 16 · 1920s 20 · 1930s 18 · 1940s 19 · 1950s 25 · 1960s 28 · 1970s 27 · 1980s 37 ·
1990s 41 · 2000s 44 · 2010s 63 · 2020s 40. By collection: `pwdata-debates` 205 · `historic-hansard`
76 · `pwdata-lords` 39 · `pwdata-westminster` 21 · `committees-evidence` 10 · `committees-reports`
10 · `niassembly-hansard` 8.

### ⚠⚠ THE FINDING THAT CHANGES WHAT A "PASSAGE" IS

| | median words | under 30 words | under 15 words |
|---|---:|---:|---:|
| dense candidates (n=369) | **32** | **48.8%** | **28.2%** |
| keyword candidates (n=31) | 130 | 6.5% | — |
| random control passages (n=120) | 83 | — | — |

**Dense retrieval on an argument probe returns passages less than half the length of a random one,
and half of them are fragments.** *"Where is the money to come from?"* came back four times, from
1898, 1916, 1924 and 1971. It makes the move and it says nothing.

The mechanism is not mysterious: a `pwdata` section is **one speech**, most speeches are short
interventions, and a seven-word sentence that is nothing but the probe's own idea is lexically
purer than a 400-word passage that also contains the argument. **The retriever is behaving
correctly and the unit is wrong.** §3.5 of the design promises a user *"the words somebody actually
said"*; a six-word question is not that.

### The random control arm — the check on the labeller

The brief: *"if fewer than a third of a random control sample come back untagged, the labelling is
over-eager and must be re-run."* **60 passages drawn `ORDER BY md5(id)` with no probe near them, read
one at a time: 41 untagged (68.3%), 19 carrying a move.**

Most of what Parliament says is a question, an undertaking to write to a colleague, a point of
order, a ministerial progress report or the text of an amendment. ⚠ **One label was reversed on a
second pass and the reversal is recorded in the file**: Stanley Orme on NHS funding was tagged
`COST` and is now untagged, because `COST` means *a proposal is mis-costed* and he was attacking a
government's record. **Adjacent is not the same, and a tag that drifts to "adjacent" stops meaning
anything.**

### ⚠ THE SEED COUNT IS A SHORTFALL AND IT IS STATED HERE

The brief asked for **~50 verified seeds per tag**. This sprint produced **7–11 per tag, 71 in
total**, from about 220 passages read. Five hundred verified seeds is five hundred passages read one
at a time. The seeds are enough to propagate from and enough to measure with; they are **not** the
sample the brief specified, and every figure derived from them carries that. **Decision D-2.**

---

## §3 — TEN QUESTIONS OF A NEW SHAPE

**`docs/ARGUMENT_QUESTIONS_V1.md`**, generated by `npm run argument:questions`. **Nothing is scored
against them.**

**What the run counted:** questions **10** · tags exercised **10 of 10** · keys **21** · bodies read
from R2 **21** · containing their declared confirming term **21** · unusable **0**.

⚠⚠ **Seven of the ten have their answer in a debate about a different subject — the floor was
three.** That is the whole case for an argument graph rather than a decoration on one:

| the user asks about | the answer was said about | when |
|---|---|---|
| a licensing scheme for short-term lets not being enforced | **Sunday trading** ("in large parts of the country local people do not want the law enforced") | 1985 |
| banning a product and it moving underground | **auction sales of wines and spirits** | 1944 |
| whether other countries have tried it | the **War Crimes Bill** ("frustration, futility and fiasco" in Australia and Canada) | 1991 |
| legislating with no evidence the problem is real | the **Public Health Bill** ("no evidence that tuberculosis is spread by food… until evidence is produced the Government should reject the clause") | 1961 |
| a new offence catching innocent people | the **Trade Disputes and Trade Unions Bill** ("law-abiding citizens… brought, often without their knowledge… within the meshes of the Criminal Law") | 1927 |
| whether a scheme can be operated as drafted | the **Intestates' Estates Bill** ("completely unworkable") | 1952 |
| evidence an arrangement works elsewhere in the UK | the **Scotland Bill** ("worked quite well in Northern Ireland") | 1978 |

**No keyword search reaches any of these from the question, and no topic search does either.** The
1985 Sunday-trading paragraph contains none of the words a user asking about short-term lets would
type.

⚠ The three that are NOT cross-subject are cross-subject-proof by nature: `WRONG_VEHICLE`, `COST`
and `RIGHTS` questions are about legislating, so the debates that answer them are too. That is worth
knowing rather than hiding — **the argument graph's advantage is not uniform across the taxonomy.**

---

## §2 — PROPAGATION

`npm run argument:propagate -- --k 120 --write` → `docs/census/argument-1a-propagation.json`,
written to the new `argument_tag` table.

### ⚠⚠ HOW THIS DIVERGES FROM THE BRIEF'S WORDING, SAID FIRST

§2 asks to *"score every paragraph in the parliamentary collections"* and calls it *"arithmetic over
an index that exists"*. It is arithmetic — but not arithmetic this machine can run.
**`corpus_vec.lance` is 147.58 GB** and a full scan of 22.7 million vectors is a memory-bound job
that belongs on a rented box (docs/CLAUDE.md §17). What is free is `vector-serve`'s ANN, which
returns the **top K** neighbours of a query.

So propagation here is **top-K retrieval per seed, unioned**, and one consequence follows everywhere:

> **We cannot say how many paragraphs IN THE CORPUS clear a threshold — only how many of the
> RETRIEVED candidates do.** Where the lowest score returned for a seed still clears a threshold the
> count is **CENSORED** and is printed `>= n`, not `n`.

⚠ **And the brief's shoulder test cannot be run at all.** A shoulder is the fall-off between a tag's
neighbourhood and the bulk of the corpus, and top-K removes the bulk of the corpus before you can
look at it. Every tag's candidates arrive packed into two to four hundredths of score. **The first
version of this script duly reported "no signal" for all ten tags; that was the cut-off talking**,
and it is now reported as UNMEASURABLE. Answering it needs the full scan — **D-1**.

### What propagation produced

**7,116 rows · 7,047 distinct passages · 6,594 `prototype:v1` · 522 `pattern:v1`.**

| tag | seeds | dense candidates | ≥0.75 | ≥0.80 | pattern proposed → confirmed |
|---|---:|---:|---:|---:|---|
| COST | 10 | 953 | 732 | 70 | 180 → **10** |
| ENFORCEMENT | 11 | 979 | 462 | 19 | 180 → **36** |
| UNINTENDED | 9 | 878 | 117 | 9 | 180 → **114** |
| EVIDENCE_GAP | 4 | 400 | 77 | 3 | 180 → **43** |
| WRONG_VEHICLE | 7 | 616 | 507 | 25 | 180 → **90** |
| RIGHTS | 8 | 623 | 209 | 5 | 180 → **79** |
| PRECEDENT | 6 | 583 | 240 | 12 | 180 → **11** |
| SCOPE | 6 | 590 | 467 | 12 | 180 → **60** |
| IMPLEMENTATION | 4 | 398 | 205 | 3 | 180 → **75** |
| SUPPORT_EVIDENCE | 6 | 574 | 195 | 7 | 180 → **4** |

Every count at 0.60, 0.65 and 0.70 is **censored** — the cut-off, not the corpus.

⚠ **The pattern arm's confirmation rate is the tag's own vocabulary talking.** `UNINTENDED` confirms
114 of 180 because *"unintended consequence"* is a fixed collocation; `SUPPORT_EVIDENCE` confirms 4
because *"the evidence shows"* is three ordinary words BM25 scatters across a corpus.

### ⚠⚠ THE TAGS BARELY OVERLAP, AND THAT HAS TWO READINGS

**28 of 7,047 tagged passages carry two or more tags — 0.4%.** I predicted more than a third. Two
readings, and this sprint cannot choose between them:

1. **The ten moves occupy genuinely separate regions of meaning space** — good news for the taxonomy.
2. **Each seed pulls a tight cluster of near-duplicates of itself** rather than a concept — in which
   case low overlap is a symptom, not a virtue.

⚠ **§4's recall result decides it, and it decides for reading 2.**

---

## §4 — MEASURING THE TAGGING

### ⚠⚠⚠ RECALL FIRST, BECAUSE IT IS THE RESULT THAT MATTERS

The brief: *"recall matters more here than precision… a tag that fires rarely and correctly is
WORSE than one that fires often and roughly."*

**Held-out set: the 19 random control passages a human tagged** — drawn `ORDER BY md5(id)` with no
probe anywhere near them, and the only argument-carrying passages in this sprint the method had no
hand in choosing. They carry **20 tag instances** between them.

> ## **0 of 20 retrieved. 0.0%, at top-200 per seed.**

Propagation from the verified seeds returned **400–980 distinct candidates per tag** and did not
reach a single one of them.

### The control that decides what 0 of 20 means

That number had two readings and they had to be separated before it could be reported:

- **A.** the passages are in the index and propagation never reaches them → a real failure;
- **B.** the passages are not in the dense index → the figure measures index coverage and says
  nothing about propagation.

`npm run argument:retrievability` asks the index for each passage **using the passage's own words**
— the probe S16 used on the committees keys.

> **19 of 19 came back. All 19 at RANK 1.**

**So it is reading A.** Every held-out passage is in the dense index, perfectly retrievable, and
seed-neighbourhood propagation reaches none of them. **Similarity to a seed does not generalise to
other passages making the same move in different words.**

⚠⚠ **AND THE CONTROL CAUGHT A DEFECT OF MY OWN ON THE WAY.** The first retrievability run found only
16 of 19, and all three misses were `scottish-parliament-or`. That collection is indexed under tier
**`other`** (SEARCH S17 §2), and every query in this sprint was scoped `tier: 'parliamentary'` —
**so my own propagation silently excluded 1,044,188 sections, 7.6% of the parliamentary corpus.**
Verified rather than assumed: with no tier filter all three return at rank 1; with `tier: 'other'`
all three return at rank 1; with `tier: 'parliamentary'` none is found. Every script now scopes by
`corpora`, and **the recall figure is unchanged at 0 of 20 after the fix** — which is the point of
re-running it rather than reasoning about it.

### Cross-arm recall, the weaker measurement

Propagate from one arm's seeds, test on the other's. **2 of 26 retrieved (7.7%)**, and **12 of the
20 tag-direction pairs were SKIPPED** for having fewer than two seeds on one side. The number is
thin and is reported with its denominator rather than rounded up into a claim.

### The two accuracy numbers, reported apart

`npm run argument:measure` over **60 passages** drawn from `argument_tag` `ORDER BY md5(chunk_id)`
within each (tag, method) — not the top-scoring rows, and not the pool the seeds came from. The
brief asks for fifty.

| | | |
|---|---:|---:|
| **1. Is the tag right** | **35 of 60** | **58.3%** |
| **2. Should it have been tagged at all** | **41 of 60** | **68.3%** |
| *and the conditional, labelled as a third number* | of the 41 that should have been tagged, the tag was right on **35** | **85.4%** |

⚠⚠ **MY PREDICTION OF WHICH WOULD BE LOWER WAS WRONG, AND THE REVERSAL IS THE FINDING.** The
position work's lesson was that a system *over-claims* — it answers because it was asked. Here
**"should it have been tagged" (68.3%) is HIGHER than "is the tag right" (58.3%)**. The system is
not inventing arguments where there are none; it is putting **the wrong one of the ten** on
arguments that are really there. That is a different defect with a different fix.

**Polarity, counted and not chased:** right subject, opposite claim **6 of 60 (10.0%)**; right
subject, no claim either way **2 of 60 (3.3%)**.

### ⚠⚠⚠ AND THE SPLIT THAT SHOULD DECIDE WHAT HAPPENS NEXT

| method | n | tag right | should be tagged |
|---|---:|---:|---:|
| `prototype:v1` — dense seed-neighbourhood | 40 | **17 (42.5%)** | 23 (57.5%) |
| `pattern:v1` — a literal phrase, then the tag's own regex | 20 | **18 (90.0%)** | 18 (90.0%) |

**The deterministic half is more than twice as accurate as the embedding half — and the embedding
half has zero measured recall on independently-found arguments.** The "cheap half" that works is
the regex. Put beside §1's finding that the dense arm returns fragments half the length of a random
passage, and beside the 0.3% tag overlap, one reading fits all three: **similarity to a seed
retrieves paraphrases of the seed, not instances of the move.**

⚠ Per tag, with n stated every time — `COST` 6/6 right, and then it falls away:

| tag | tag right | should be tagged | opposite polarity |
|---|---:|---:|---:|
| COST | 6/6 | 6/6 | 0/6 |
| RIGHTS | 5/6 | 5/6 | 0/6 |
| SCOPE | 5/6 | 5/6 | 0/6 |
| WRONG_VEHICLE | 4/6 | 5/6 | 1/6 |
| EVIDENCE_GAP | 3/6 | 4/6 | 1/6 |
| IMPLEMENTATION | 3/6 | 3/6 | 0/6 |
| SUPPORT_EVIDENCE | 3/6 | 3/6 | 0/6 |
| ENFORCEMENT | 2/6 | 4/6 | 2/6 |
| UNINTENDED | 2/6 | 3/6 | 1/6 |
| PRECEDENT | 2/6 | 3/6 | 1/6 |

### The three failure shapes, named

1. **Word sense, not polarity, and worse than polarity.** *"Is the zero option still on the table or
   is it a dead letter?"* — arms control, tagged ENFORCEMENT. *"There is no evidence against him"* —
   criminal evidence, tagged EVIDENCE_GAP. The pattern matched the words and the words meant
   something else. **Polarity at least keeps the subject; word sense does not.**
2. **Phrase-mention without the move.** *"I think that the unintended consequences can be ironed out
   in the bill"* uses the phrase and names no consequence.
3. **The fragment.** *"said, he could not accept the Amendment"* — seven words, tagged
   IMPLEMENTATION at 0.769. *"The information is correct in respect of Scotland"* — eight words about
   Rudolf Hess, tagged SUPPORT_EVIDENCE at 0.740.

### ⚠ A defect in my own schema, found by reading the draw

Entries 9 and 10 of the sixty are **the same passage**. `argument_tag`'s unique key is
`(chunk_id, tag, method, evidence)`, so a passage re-retrieved by a *different seed* on a later run
is stored again. The natural key is `(chunk_id, tag, method)` with evidence as an attribute.
**7,926 rows describe 7,142 distinct passages.** Reported rather than silently deduplicated — the
duplicate is a real row a consumer would have counted twice. **D-6.**

---

## §5 — WHAT IS NOT DONE, NAMED

1. **No full scan.** §2's literal ask — a score for every paragraph — was not answered, and neither
   was the shoulder question. Both need a memory-bound job on a rented box. **D-1.**
2. **The seed count is 71, not ~500.** §1's shortfall, stated at the point it was made. **D-2.**
3. **No model adjudication pass**, per §5 of the brief. It is authorised only once §4 shows what
   survives propagation, and §4 has now shown it.
4. **No user-facing surface**, per §5. Everything is in `argument_tag` and in documents.
5. **No mechanism tagging**, per §5.
6. **Nothing is scored against the ten questions.** They wait on Charlie exactly as the committees
   re-key does.
7. **The `pattern:v1` arm was never run over the whole corpus** — only over what BM25 proposed for
   thirty phrases. Given that it is the arm that works, that is the obvious next measurement and it
   is cheap. **D-3.**
8. **No per-tag position breakdown** beyond the table in §1.1.

---

## §6 — SPEND

**Predicted: near zero, under £0.20.** Actual: **no per-paragraph model call was made anywhere in
this sprint.** The only paid work is embedding on `vector-serve`, one call per query — on the order
of **500 embeddings of ≤900 characters** across the draw, propagation (twice), recall and the
retrievability control. R2 reads (~41,000 objects) and Neon queries are infrastructure already
running.

⚠ **The expensive resource was WALL-CLOCK, not money**: the two propagation runs took about an hour
each, dominated by 1,800 R2 fetches per run in the pattern arm.

⚠ **Database headroom, measured before writing anything: 18.85 GiB.** GRAPH 3A recorded 99.2% of a
17.5 GiB ops alert line; the database is now **above that line**. `argument_tag` adds ~1 MB and is
immaterial, but a corpus-wide propagation would not be. **D-5.**

---

## DECISIONS FOR CHARLIE

**D-1 — Fund the full scan?** *(Recommended: yes, and it is the only way to answer §2 as written.)*
Score all 22.7M vectors against ten tag centroids on a rented box (docs/CLAUDE.md §17). It answers
the two questions this sprint could not: how many paragraphs in the corpus clear a threshold, and
does each tag have a shoulder. The FTS index build cost **€0.049**; this is the same shape of job.
*Consequence of no:* every propagation figure stays censored by a top-K cut-off, and "does this tag
have signal" stays unanswerable.

**D-2 — Accept 71 seeds, or fund the reading to ~500?** *(Recommended: accept for now, and revisit
after D-3.)* The brief asked ~50 per tag. *Consequence of yes:* the per-tag figures rest on 4–11
seeds and say so. *Consequence of no:* several hundred more passages read one at a time, for a
method §4 has just shown to be the weaker of the two.

**D-3 — Run the `pattern:v1` arm over the whole parliamentary corpus?** *(Recommended: yes — it is
the cheapest thing on this list and the arm that works.)* 90% tag-right against 42.5%, and at 0.07
hits per 1,000 words it would tag on the order of a hundred thousand passages. It needs the body of
every parliamentary section, which is an R2 sweep, not a model call.
*Consequence of no:* the argument graph keeps being built on the half that measured worse.

**D-4 — What to do about the fragment problem?** *(Recommended: a minimum-length rule at display,
and tell ingest.)* 48.8% of dense candidates are under 30 words. Options: (a) exclude passages under
~40 words from the argument surface — a display rule, reversible, ours; (b) ask ingest to merge
short adjacent speeches within a debate before chunking — the real fix, and it costs a re-embed;
(c) accept. *Consequence of (c):* §3.5's promise of *"the words somebody actually said"* is
delivered as six-word questions.

**D-5 — Database headroom.** The database is **18.85 GiB, above the 17.5 GiB ops alert line**.
Nothing in this sprint moves it materially, but D-1 and D-3 both write at scale.
*Consequence of ignoring:* the first thing to notice will be something unrelated failing.

**D-6 — Fix `argument_tag`'s unique key** to `(chunk_id, tag, method)`. One line, and it stops a
re-run duplicating rows. *Consequence of no:* row counts drift above passage counts, silently.

---

## STANDING-RULE NOTES

- **Predictions were logged before every measurement** and are scored in §0, including four that
  were wrong.
- **Every figure states its denominator and its cut-off.** Threshold counts print `>= n` where the
  top-K cut-off censored them — 28 of 50 counts are censored and say so.
- **Every check was watched failing.** The untagged floor rejects a planted over-eager labelling;
  the blank-evidence detector catches a planted blank; `patternHits` is silent on a procedural
  sentence. `npm run check:argument-1a` — **17 passed, 0 failed**.
- ⚠ **Three of my own instruments were wrong and all three were caught by running them:** a shoulder
  test that cannot work over a top-K set; a `corpus` column filled with a tier name; and a
  `tier: 'parliamentary'` filter that silently excluded 1,044,188 Scottish Parliament sections. The
  third was caught by a control built to interpret a different number.
- ⚠ **One guard passed vacuously on its first run** — "no machine tag stored without its evidence,
  0 rows across 0 methods, ok" — on an empty table. Emptiness is now the failure.
- **A negative result is reported as a result.** 0 of 20 recall is the sprint's most important
  number and it is the headline of §4 rather than a footnote.
- **Nothing owned by search, graph, ingest or lex was edited.** `scrutinise-web/package.json` gained
  script entries and `prisma/argument_1a.sql` is new; no existing source file outside this sprint's
  own area was touched. Needed changes elsewhere are reported rather than made: the
  `historic-hansard` pre-1800 dates, the chunker's treatment of short speeches, and the `pwdata`
  passage unit.
- **Git:** no git during the sprint; one `commit-argument-1a.sh`, scoped by explicit path.
