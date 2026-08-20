# SEARCH S10 — THE FIRST TRUSTWORTHY RETRIEVAL NUMBERS THIS PROJECT HAS HAD

**Executes:** `docs/BRIEF_SEARCH_S10.md` §0–§7 · **Run:** 20 August 2026 · **By:** CC-Search
**Reads:** `docs/GOLD_CANDIDATES_S8.md` (Charlie's validation pass, complete)
**Cost:** ~£0.03 — 110 Gemini `2.5-flash` routing calls, one live retrieval pass, no embedding run,
no index build, no heavy job.

---

## ⚠ THIS IS THE FIRST SPRINT WHOSE NUMBERS ARE TRUSTWORTHY, AND HERE IS WHAT IT SUPERSEDES

Since S7 every retrieval-quality statement this project has made rested on questions the implementer
wrote for itself — the binding constraint of `SEARCH_STRATEGY_v5.md` §5.2. Charlie's pass lifts it.
A corrected number that does not name what it replaces leaves two numbers in circulation, so:

| superseded | by |
|---|---|
| **S7: committees "at a 100% ceiling"** — a ceiling, not a result, on questions CC wrote | **committees 3/10 merged, 3/10 in-stream (n=10)**. The collection had never been evaluated. |
| **S7: caselaw and guidance "+12.5pp from vector"** (CC-written questions) | **caselaw +50.0pp (n=6), guidance +0.0pp (n=10)** — and both figures carry caveats below that matter more than the numbers. |
| **S7: "debates is 15pp WORSE" with vector on** | **Neither confirmed nor refuted. The validated set contains ZERO debates questions.** The setting stays provisional and is now provisional *for a stated reason*. |
| **S9: "the licence register withholds 40.6% of series, 50.2% of observations"** | **That is the `commercial` arm.** Under `STATS_USE_CONTEXT=non-commercial`, now set in Vercel, the withheld count is **0** and all 5,733 series are searchable. Both numbers are correct; only one describes production. |
| **S9: "0 of 10 false positives" on the statistics stream** (S9's own probes) | **3 of 50 (6%)** on Charlie's legal and evidential questions. |
| **GOLD TEST 11's 8.1% floor** | Not superseded — it measured `rankedSearch` against `corpus_fts`, a system nobody runs. Scored here through `runSearch()`, per §1.1. |

**And one number that is NOT superseded, because it was never measured:** no prior sprint reported
`impact-assessments` or `consultations` recall at all. Both are first measurements.

---

## §0 — HOW THE NUMBERS WERE MADE HONEST

Three mechanisms, each answering a specific way an earlier measurement went wrong.

**1. Every answer key was proved to exist before anything was scored.**
`scripts/verify-s10-keys.ts`, a direct `corpus_sections` read — never through `runSearch()`, because
checking a key by searching for it makes every key "present" that retrieval happens to return.
**68 of 68 key rows across 50 corpus questions are present.** So every zero below is a retrieval
result, not a missing row. The check carries a planted absent id *and* a real id alongside it — the
second arm matters, because "the fake id was absent" passes just as well if the query returns
nothing at all.

**2. The route is rolled once and reused; every arm is computed from ONE retrieval, and the
recomputation is proven rather than asserted.** S9's A/B was unreadable because the router re-rolls
per arm. Routes are cached; the BM25 and dense legs are captured from the **production path**
(`query-router.ts::captureLegs` — a seam in the real code, not a reimplementation) and every weight
is computed from them. The load-bearing guard: recomputing at the weight the live call actually
used must reproduce that call's own per-stream id sequence exactly. **50 of 50 questions reproduced
id-for-id.** Without that, this report would be a plausible copy of the ranking pipeline.

**3. The services were proved engaged, positively.** `FTS_SEARCH_URL` is not in the local `.env`,
and a run without it searches nothing and reports zeros that look like a regression — exactly what
happened to S9's first A/B arm, which compared 0 against 0 and printed "identical on 10/10".
Counters read either side of the pass: **`fts+231  vector+231`**.

Resolved configuration, printed with the numbers:
`fts=fts-serve-production.up.railway.app vector=vector-serve-production.up.railway.app router=ON`.

---

## §1 — THE BASELINE

### The set, and how its arithmetic reconciles with the brief's

The brief counts 51 ACCEPT / 4 REJECT / 5 "no verdict — CC's own annotation left in the slot". Those
five slots each end in **ACCEPT** after the annotation, so the set is **56 ACCEPT + 4 REJECT**. Of
the 56, three are negative controls scored on behaviour (Q40, Q50, Q60) and two are accepted-but-
flagged-hard (Q56, Q57), which §1.3 says to score on recall. **Scoreable = 53: 44 corpus + 9
statistics.**

| collection | scoreable n | rejected | negative controls |
|---|---:|---:|---:|
| committees | 10 | 0 | 0 |
| caselaw | 6 | **4** | 0 |
| guidance | 10 | 0 | 0 |
| impact-assessments | 9 | 0 | 1 |
| consultations | 9 | 0 | 1 |
| statistics | 9 | 0 | 1 |

⚠ **53 questions is a real instrument and a small one.** No figure here is quoted to two decimal
places, `n` is stated beside every one, and caselaw's n=6 will not support a conclusion on its own.

### The headline

Scored through `runSearch()` — the real gateway, routing and fusion — dense on all five streams at
today's 0.5 weight.

| collection | n | recall@20 | recall@5 |
|---|---:|---|---|
| committees | 10 | **3/10 — 30%** | 1/10 — 10% |
| caselaw *(pre-fix baseline, §0)* | 6 | 3/6 — 50% | 2/6 — 33% |
| guidance | 10 | **1/10 — 10%** | 0/10 — 0% |
| impact-assessments | 9 | 1/9 — 11% | 0/9 — 0% |
| consultations | 9 | **7/9 — 78%** | 4/9 — 44% |
| **ALL** | **44** | **15/44 — 34%** | 7/44 — 16% |

Each figure reads: *of the N questions where a known-correct document exists, X% returned it in the
top 20.*

**Configuration arms**, because the production value of `LEX_VECTOR_STREAMS` is unreadable from this
machine (SAML-blocked — `docs/CLAUDE.md` §19) and the difference is large:

| arm | recall@20 (n=44) | provenance of the arm |
|---|---|---|
| dense on all five streams @ 0.5 | 15/44 — 34% | the pass configuration |
| `legislation,caselaw,guidance` @ 0.5 | 12/44 — 27% | **S7's recommendation. An INFERENCE about Vercel, not a reading of it.** |
| `legislation` only @ 0.5 | 8/44 — 18% | the last value anyone on this machine watched Charlie set (`VECTOR_FLIP_LOADTEST.md`) |
| keyword only, dense off | 7/44 — 16% | control |

⚠ **The spread between the second and third rows is 9 questions of 44.** Nobody here can say which
of them production is running. That is a bigger uncertainty than anything else in this report and
it is one dashboard read away from being closed — see decision Q1.

### ⚠⚠ THE TABLE THAT MATTERS MORE THAN THE HEADLINE: why every miss is a miss

A single recall figure cannot tell three completely different failures apart, and they have three
completely different fixes. Guidance scored 1/10 while consultations scored 8/9 — **from the same
stream**, since both collections sit in the `guidance` tier. That is not a search-quality story, and
one number could never have said so.

| collection | n | hit@20 | DILUTED | NOT-RETRIEVED | NOT-ROUTED | **in-stream recall@20** |
|---|---:|---:|---:|---:|---:|---|
| committees | 10 | 3 | 3 | 4 | 0 | 3/10 — 30% |
| caselaw | 6 | 3 | 2 | 1 | 0 | 4/6 — 67% |
| guidance | 10 | 1 | 2 | 7 | 0 | 3/10 — 30% |
| impact-assessments | 9 | 1 | 2 | 2 | **4** | 3/9 — 33% |
| consultations | 9 | 7 | 2 | 0 | 0 | 8/9 — 89% |
| **ALL** | **44** | **15** | **11** | **14** | **4** | **21/44 — 48%** |

- **NOT-ROUTED** — the stream owning the answer was never asked. A routing problem; the question
  never had a chance, and counting it as a retrieval miss libels the index.
- **NOT-RETRIEVED** — the stream ran and its own 60-result list does not contain the key anywhere.
  The only one of the three that is a retrieval miss.
- **DILUTED** — the key IS in its stream's list at a rank the stream would have served, and did not
  survive the round-robin interleave into the merged top 20. An *allocation* failure.

⚠⚠ **The interleave costs six questions of 44 — 34% merged against 48% in-stream.**
`runRoutedSearch` interleaves round-robin, so with four streams routed the top 20 holds about five
results per stream. A key at rank 8 of its own stream is unreachable in a merged top 20 however good
the retrieval was. Q4 is the sharpest case: rank 20 within `committees` with **one** stream routed,
so it missed the top 20 by a single position. This is not a defect — the interleave exists because
concatenation meant every downstream consumer taking a prefix read one stream and never saw the
other four (S5). But it is a fixed budget being divided, and it is now measured.

### ⚠⚠⚠ THE LARGEST SINGLE FINDING: `cps-guidance` IS STRUCTURALLY UNREACHABLE

Seven of the ten guidance misses are NOT-RETRIEVED. Probing the service directly rather than
reasoning about it (`scripts/diagnose-s10-misses.ts`):

**All five CPS keys are returned at rank 0–2 when scoped to their own corpus. `streamCanSelect`
returns FALSE for every one of them.** `cps-guidance` is display-typed GUIDANCE by `corpusToType`
but **indexed under tier `other`**, and the guidance stream prefilters on tier `guidance`. So no
router stream can select it, and **no query can ever return a CPS guidance document.** Perfectly
retrievable; structurally unreachable. It is the `erskine-may` shape exactly.

⚠ **It was already known and already deferred — without a price on it.**
`docs/CORPUS_REACHABILITY.md` (10 Aug) lists it verdict `keyword-only`, among nine collections
"deferred pending the reranker decision". `keyword-only` means *reachable only when routing is OFF
or has failed open* — and routing is ON in production, so in the product it means unreachable. The
deferral was reasonable when nothing could price it. **Charlie's set prices it: five of ten guidance
questions.**

⚠⚠ **And the one-line fix is zero-sum, which is why it shipped behind a flag rather than as a list
entry.** Measured before-and-after with dense off, so the extra BM25 leg was the only difference
(`scripts/measure-s10-guidance-fix.ts`), in-stream recall@20:

| collection | before | after |
|---|---|---|
| guidance | 2/10 | **8/10** (Q22, Q23, Q25, Q26, Q27 recovered at ranks 4, 0, 12, 2, 0) |
| consultations | 6/9 | **4/9** ⚠ (Q44 rank 0 → 21, Q49 rank 4 → 33) |
| total | 8/19 | 12/19 |

`mergeLegs` sorts the two legs together on one BM25 scale and slices to a fixed budget, so an extra
leg that scores well does not get extra room — **it takes the main leg's**. This is the divisions
finding from `stream-scopes.ts` inverted: there the extra leg lost the merge and bought nothing;
here it wins the merge and displaces the collection that was already working. Net +4 of 19 with a
real loss inside it. Shipped as `LEX_GUIDANCE_CPS`, **default OFF** — decision Q2.

▶ **The durable fix is neither arm:** `tierFor()` plus a full index rebuild puts `cps-guidance` in
the `guidance` tier, where it competes in the main leg and costs no extra call at all.

### The other misses, named

- **Impact assessments, 4 NOT-ROUTED (Q33, Q34, Q35, Q39).** The router sent them to
  `debates, committees, guidance` and never selected `legislation` — the only stream that can reach
  an impact assessment with `LEX_ROUTER_STREAMS_V2` off. Not a retrieval failure; the stream was
  never asked. **This is the strongest evidence yet for V2**, and the set now exists to score it.
- **Impact assessments generally.** The key rows average **37 words** (measured). A 37-word section
  under an internal heading — "Summary", "Costs and benefits" — has almost nothing to match on. The
  S2C6 §1 finding, now with a recall cost attached.
- **Committees, 4 NOT-RETRIEVED.** Q5 sits at rank 15 of its own corpus but rank 28 within the
  `parliamentary` tier and outside 60 in the stream; Q6, Q8 and Q10 are out-ranked by `pwdata-wrans`
  and `pwdata-lordswrans` at BM25 78–86. **Committee content is 1.17% of the parliamentary tier**
  and the corpus prefilter is what is meant to protect it; these are the cases where it does not.
- **Caselaw, Q16 (`In re McCaughey`).** Not returned even scoped to `tna-caselaw` on its own title —
  expected, and it is §0 dependency 1: the FTS index still holds `sectionTitle: null` for
  `tna-caselaw`, so **searching for a case by name still cannot match the name.** Neon now has the
  recovered titles (verified: all nine case-law key rows carry a `sectionTitle` today) and
  `corpus-type-map.ts`'s `TITLE_FROM_DB` already includes `tna-caselaw`, so the *display* is fixed;
  matching needs the reindex.

### Predictions, recorded before the run and scored against

| collection | predicted @20 | measured (merged / in-stream) | verdict |
|---|---:|---|---|
| committees | 60% | 30% / 30% | **REFUTED — over-predicted by half** |
| caselaw | 50% | 50% / 67% | **CONFIRMED** on merged |
| guidance | 80% | 10% / 30% | **REFUTED, badly** — and the reason is the reachability bug I had no idea existed |
| impact-assessments | 25% | 11% / 33% | direction right, level wrong |
| consultations | 55% | **78%** / 89% | **REFUTED — under-predicted** |

Two sub-predictions worth scoring separately, because both were specific enough to be wrong:

- ✅ **"Q20 — the exact-citation control — should be 100%: it is a pure pin lookup."** Rank 2. Held.
- ❌ **"The committee misses will concentrate in the written-evidence half, because a submission is
  titled by its reference code."** Wrong: five of the seven misses are *reports*, two are evidence.
  Written evidence did **better**, not worse.
- ❌ **"Consultations will do better than impact assessments and worse than guidance."** The first
  half held; the second was wrong by 68 percentage points, and the reason is the guidance
  reachability bug rather than anything about consultations.

⚠ **Guidance and consultations were predicted as different collections and turned out to be one
stream with a broken half.** That is the single most useful thing the prediction discipline bought
this sprint: an 80%-predicted collection landing at 10% is what forced the question "why is its
neighbour at 78%?", and that question is what found the reachability bug.

---

## §2 — THE PER-STREAM VECTOR DECISIONS, RE-TAKEN

Each row: that stream's dense leg ON versus OFF with every other stream held OFF, so the difference
is attributable to one stream. Scored over the collection the stream owns.

| stream | current setting | collection | n | OFF | ON | delta | headroom |
|---|---|---|---:|---|---|---|---|
| **committees** | vector OFF | committees | 10 | 0/10 — 0% | **3/10 — 30%** | **+30.0pp** | 7 of 10 could still move |
| **caselaw** | vector ON | caselaw | 6 | 0/6 — 0% | **3/6 — 50%** | **+50.0pp** | 3 of 6 could still move |
| **guidance** | vector ON | guidance | 10 | 1/10 — 10% | 1/10 — 10% | **+0.0pp** | 9 of 10 could still move |
| **debates** | vector OFF | — | **0** | — | — | — | **NOT MEASURABLE** |
| **legislation** | vector ON | — | **0** | — | — | — | **NOT MEASURABLE** |

**Latency**, measured by alternating arms in one process against the same warm services (n=12):

| arm | p50 | p95 |
|---|---|---|
| dense OFF everywhere | 3,575 ms | 4,495 ms |
| dense ON: `legislation,caselaw,guidance` | 3,436 ms | 9,249 ms |
| dense ON: all five streams | 4,426 ms | 6,910 ms |

⚠ Every figure includes one Gemini routing call (~1–2s), identical across arms, so it cancels in the
delta and inflates the absolutes. **The p50 is flat and the p95 is not** — the dense leg costs tail
latency rather than typical latency, which is what a concurrency-capped service does under fan-out.

### What each row actually says

⚠⚠ **`committees` is the strongest result in the sprint and it reverses the current setting.**
Vector is OFF for committees today, on the grounds that it was "unmeasurable (ceiling)". It is now
measurable and it is **0/10 → 3/10**. Every committee question the platform answers, it answers
because of the dense leg. On keyword alone it answers none.

⚠ **`caselaw` +50.0pp is real and must not be acted on.** §0 dependency 1: CC-Ingest is re-compiling
case-law text, which is currently an Akoma Ntoso stylesheet preamble followed by the judgment. This
is a **pre-fix baseline** and no recommendation is made from it. n=6 as well.

⚠⚠ **`guidance` +0.0pp is a FLOOR EFFECT, not a null result.** Five of its ten questions key on
`cps-guidance`, which no query could return at any setting. The dense leg cannot rescue a document
the prefilter excludes. **The guidance vector decision is not re-taken this sprint** — it needs
re-measuring after the reachability question is settled.

⚠⚠ **`debates` and `legislation` cannot be re-taken at all, and that is the finding.** The validated
set contains **zero** questions either stream owns. S7's "debates is 15pp worse" is neither confirmed
nor refuted, and reporting +0.0pp for them would have been a null result manufactured out of an
absence of questions. **The two streams carrying the most traffic have no validated questions** —
gap G1 below.

### ▶ Recommended `LEX_VECTOR_STREAMS`

```
LEX_VECTOR_STREAMS=legislation,caselaw,guidance,committees
```

**The only change is `committees`, and it is the only one with evidence under it** (+30.0pp, n=10,
0→3). `legislation` stays because it carries the strongest prior evidence and nothing here contests
it; `caselaw` stays where it is rather than being re-decided on void text; `guidance` stays because
removing it on a floor effect would be acting on a measurement that could not have moved.
`debates` stays OFF because nothing measured it — **held on absence of evidence, and now labelled as
such rather than as a result.**

⚠ Cost: a fourth dense stream against a service four requests wide. See §6.2.

---

## §3 — THE DIAL: BUILT, SWEPT, AND ADOPTED NOWHERE

**Built.** The per-stream fusion weight is now a configuration value
(`lib/lex/fusion.ts::streamVectorWeight`), gated by `LEX_FUSION_WEIGHTS` (boolean, default OFF) with
values in `LEX_FUSION_STREAM_WEIGHTS` (`debates:0.2,caselaw:0.65`). Same shape as
`LEX_SEARCH_VECTOR` + `LEX_VECTOR_STREAMS`: one boolean gates, one string configures, and flipping
the boolean off restores 0.5 everywhere without anyone having to remember what the string said.

**With the flag off it is a no-op — proven by comparing rankings, not by reading the constant.**
`npm run check:s10-fusion` is **19/19 with all 5 purpose-built breaks firing**. One break per
property, not a blanket one: GRAPH 3A broke one thing, expected twelve failures, got two, because a
blanket break "tests the checks it happens to reach and quietly certifies the rest". The gate must
dominate a leftover weights string; an out-of-range weight is refused rather than clamped (silently
clamping 1.5 to 1.0 would ship vector-only retrieval while the dashboard said 1.5); `TRUE`
capitalised must work; and the source invariant that `query-router.ts` resolves the weight *per
stream* is checked, because a future edit back to the module constant would leave every behavioural
check green while the product ignored the dial.

### The curves

Read the **in-stream** row for shape — it is the ranking the weight actually orders. The merged row
is flattened by the interleave and would report "flat" for a change that moved a key from rank 30 to
rank 8.

**committees (n=10)**
```
merged     @20   kw-only:0   80/20:1   65/35:2   50/50:3   35/65:3   vec-only:3
in-stream  @20   kw-only:1   80/20:2   65/35:3   50/50:3   35/65:3   vec-only:3
in-stream   @5   kw-only:0   80/20:0   65/35:0   50/50:1   35/65:1   vec-only:1
```
Monotone rising to a **plateau at 65/35**, flat from there to vector-only. Clear direction, no spike.
**Today's 0.5 is already on the plateau.** No weight adopted — the dial has nothing to add here.

**caselaw (n=6)** *— pre-fix baseline, §0*
```
in-stream  @20   kw-only:0   80/20:0   65/35:0   50/50:4   35/65:4   vec-only:4
in-stream   @5   kw-only:0   80/20:0   65/35:0   50/50:3   35/65:3   vec-only:4
```
A **step function at 0.5**: nothing below it, everything above. recall@5 gains one more at
vector-only. **Declining to adopt** — on n=6, over text that is being replaced, a step at exactly
today's value is not a mandate to move past it.

**guidance (n=10)**
```
in-stream  @20   kw-only:2   80/20:3   65/35:3   50/50:3   35/65:3   vec-only:3
```
**Not usable.** Five of ten questions were structurally unreachable at every weight, so this is a
curve over five questions wearing a denominator of ten. **Declining to adopt.**

**debates and legislation — NO CURVE.** No questions.

### ⚠⚠ The dial's central hypothesis could not be tested

§3's hypothesis is specifically about **debates** ("large, rhetorical, usually contains the exact
words a user types, so the keyword leg is already close to its best… debates does not want vector
*off*, it wants a small share of it"). That is a good hypothesis and **the validated set cannot test
it**, because it contains no debates questions. The mechanism is built and inert; the experiment it
was built for is waiting on ten debates questions.

### The latency of each blend

**Zero, and structurally so rather than measured-as-zero.** A weight changes only how two
already-retrieved rankings are merged; `fusedStream` issues the same BM25 and dense calls at every
weight, including 0 and 1. **The dial is free; the on/off switch is what costs.** So §3's "a 2pp gain
that costs 2.5 seconds is a decision for Charlie" does not arise for the dial — it arises for §2.

---

## §4 — STATISTICS

### Selection: 9 of 9

Every accepted quantitative question selected the stream. The tailored queries are short and
geographic, as the prompt requires: `UK tax gap`, `UK unemployment rate`, `UK alcohol duty receipts`.
**Prediction of 9/9 — confirmed**, though I named Q53 as the likely miss and it was selected.

### ⚠⚠ False positives: 3 of 50 — the number §4 says matters most

Measured against **Charlie's fifty legal and evidential questions**, not the ten probes S9 wrote for
itself. Every one is a question where selecting statistics is wrong.

| | the router's statistics query |
|---|---|
| Q31 I1 | `UK plastic straw ban cost estimate` |
| Q33 I3 | `UK residual waste reduction cost` |
| Q35 I5 | `UK tobacco duty receipts` |

**Prediction: "3 to 6, and I name Q10, Q31, Q33, Q35, Q38."** Measured 3 — inside the band, and
**three of the five named, with no unnamed ones.** The reasoning held: all three have quantitative
surface ("what did it COST", "the PREDICTED COST") over a question about a *document*.

⚠ **They are all impact-assessment questions, and that is a coherent failure rather than three
accidents.** "What did the government think X would cost" is genuinely ambiguous between *is there a
series* and *what did the impact assessment predict*. The router is not being careless; the two
readings are close. 6% is well inside "leaves it alone on legal and evidential questions".

### Retrieval: 6 of 9

| | result |
|---|---|
| Q51, Q52, Q54, Q55, Q58 | ✓ keyed series returned |
| **Q56** *(flagged HARD — OBR column codes)* | ✓ returned, via `obr-psf-databank` |
| Q53 | ✗ top hit *GDP per capita, PPP (current international $)* |
| **Q57** *(flagged HARD — derived heading)* | ✗ **returned NOTHING AT ALL** |
| Q59 | ✗ top hit `income_tax` |

⚠ **Q56 was predicted hard and passed; Q57 was predicted hard and failed in an unexpected way.**

⚠⚠ **Q57's failure is a vocabulary mismatch, and it is recoverable — measured, not guessed.** The
router wrote `UK government departmental expenditure` and the relevance floor kept **0 of 5,587**
candidates. Probing the catalogue directly:

```
"UK government departmental expenditure"  → 0 series
"departmental expenditure"                → 0 series
"department expenditure function"         → 2 series, both pesa-ch5-function/dept_expenditure_by_function ✓
"Local Government health expenditure"     → 5 series, "Local Government — 07" at rank 0 ✓
```

**`departmental` matches nothing; `department` matches the right dataset.** The catalogue's own
stemming does not collapse the two, so the discriminating-term floor had no term to work with. The
floor is doing its job — it is the tokenisation that fails.

⚠ **Q59 reproduces S9's own named failure exactly.** `UK income inequality` → `income_tax`, because
`income` matches HMRC receipts labels and **`inequality` matches nothing** — the series is labelled
*Gini index*. `Gini index United Kingdom` returns *United Kingdom — Gini index* at rank 0. The user's
word and the catalogue's word are different words and nothing bridges them. This is the other half
of S9's "27 of ~40 code-labelled measure families still unglossed": there a code needed a gloss;
here a well-labelled series needs a **synonym**.

### The negative control passes

**Q60 "How many people are on an NHS waiting list?" → 0 series returned.** The two relevance floors
S9 added mid-sprint still hold against Charlie's phrasing of the question, not just S9's.

⚠ **And Q57 is the price of that.** The floors that make Q60 return nothing are the same floors that
made Q57 return nothing. Both are the same mechanism firing; one is the design working and one is a
false negative. Tightening the floor to recover Q57 would need re-checking Q60 in the same pass.

### §4.1 — which use context produced S9's withheld figures. Measured, both ways

```
probe "UK public expenditure health"
  non-commercial   withheld=    0   searchedOver= 5733   returned=8
  commercial       withheld= 2329   searchedOver= 3404   returned=8
```

⚠⚠ **S9's "40.6% of series, 50.2% of observations, filtered before scoring" is the COMMERCIAL arm.**
The gate reads `if (useContext === 'commercial' && row.commercialUseExcluded) → withhold`, so a
series marked `commercialUseExcluded` is withheld under `commercial` and **permitted** under
`non-commercial`. With `STATS_USE_CONTEXT=non-commercial` now set in Vercel, **nothing is withheld
and all 5,733 series are searchable.** Both figures are correct; S9 did not say which one described
production, and the direction is counter-intuitive — "non-commercial" reads like the cautious
setting and is the permissive one.

### §4.2 — the setting is now a decision with a date and an owner

`lib/lex/stats-licence-register.ts` records the use context, the date, who decided it, the basis
(scrutinise.org is a not-for-profit and does not sell the figures or anything derived from them; the
IMF terms exclude *commercial* use) and **what would make it need re-taking** (charging for access,
a commercial fork, a partner feed, or an IMF terms change — each flips the correct value to
`commercial`, which withholds the IMF half).

`npm run check:s10-stats-licence` is **9/9 with all 4 breaks firing.** It asserts the register and
the running configuration agree, and — separately — that **`commercial` really is the restrictive
context**, by driving the real gate both ways. If that ever inverted, the platform would serve IMF
series in a context the licence excludes and nothing else would notice.

⚠ **What the check can and cannot see, stated in its own output every run:** it reads
`STATS_USE_CONTEXT` from the environment it runs in. Locally that is this shell, **not Vercel**.
Green here proves the register agrees with *this* environment and says nothing about production.

### Latency and non-regression

The corpus half of the result was compared id-for-id with the flag off and on. **1 of 6 pairs was
cleanly comparable and was IDENTICAL** (2,965 ms vs 2,945 ms). The other five are **unattributable,
and reported as such rather than counted**: the router re-rolls between the two calls, so the routed
stream set differed.

⚠ **The mean-latency line (`off=3,971ms on=1,955ms`) is confounded and must not be quoted as a
gain.** When the router selects statistics for a plainly quantitative question it often selects
*only* statistics — no corpus streams at all — which returns in ~470 ms. That is a fact about
routing, not a saving from the stats stream. The honest statement is the n=1 comparable pair: **no
measurable corpus cost.** Structurally expected — the catalogue runs concurrently, touches a
different database, and shares none of the corpus services.

### ▶ Recommendation on `LEX_STATS_STREAM`

**Turn it ON.** 9/9 selection, 3/50 false positives (6%, all one coherent ambiguity), 6/9 retrieval,
the negative control passing, no measurable corpus latency, and a structural guarantee that a
catalogue heading can never be quoted as evidence of a fact. Decision Q4 below carries the
consequence of each option.

---

## §5 — THE FOUR REJECTED QUESTIONS: THE FINDING IS PRESERVED

Q11, Q17, Q18 and Q19 are **excluded from every figure in this report and deleted from nothing.**
Each now carries, in `docs/GOLD_CANDIDATES_S8.md` beside its verdict:

> **STATUS → REJECTED — AWAITING RE-KEY** *(S10 §5, 20 Aug 2026)*. Excluded from scoring; **not
> deleted**. **Blocker:** re-keying needs a subject-searchable case-law index, which does not exist
> until CC-Ingest's case-law text fix lands. **Not to be re-keyed from outside knowledge — that is
> the method that produced this wrong key.** When the index exists it is re-keyed *by search* and
> re-validated by Charlie.

They are also present in `scripts/gold/s10-gold-set.ts` with `verdict: 'REJECT'` and the reason, so a
scorer cannot quietly lose them: **a scorer that lacked them would be a scorer that had deleted
them.** A 40% error rate on keys asserted from outside knowledge is the strongest evidence this file
produces about why the validation pass exists, and it survives this sprint intact.

⚠ Their (wrong) keys were included in the presence check and all four are present in
`corpus_sections` — the citations are real, they are simply not the cases the questions ask about.

---

## §6 — THE TWO CHEAP INVESTIGATIONS

### §6.1 — Is the dense leg searching the rewritten query? **YES. The hypothesis is refuted.**

Asserted live, not read (`scripts/verify-s10-dense-query.ts`). One real routed search on a
deliberately conversational question, with a sink on the production leg-capture seam:

```
raw: "why do water companies keep getting away with dumping sewage in rivers"

debates      "water companies sewage dumping rivers enforcement fines"
committees   "Environment Committee inquiry water quality sewage pollution"
caselaw      "water company environmental permit breach prosecution enforcement"
legislation  "Water Industry Act 1991 environmental permitting sewage discharge"
guidance     "Ofwat Environment Agency sewage discharge enforcement guidance"

streams captured: 5 · handed the RAW question: 0 · distinct query strings: 5
```

**Five streams, five different strings, none of them the raw question.** The raw-text hypothesis
predicts both that the captured query equals the raw text *and* that every stream gets the same
string, since there is only one raw question; the capture falsifies both at once.
`fusedStream` passes one `query` variable to both `bm25Only(query, …)` and
`runVectorSearch([query], …)` — there is no path where the two legs see different text.

⚠ **The first version of this verification was itself wrong and reported a false defect.** It
compared the capture against a *separately rolled* route; `routeQuery` is an LLM call and re-rolls
("…enforcement failures" vs "…enforcement fines"), so two perfectly correct rewrites came back
marked "neither — investigate". The test was rebuilt to need neither roll to match.

▶ **Consequence:** the improvement §6.1 hoped for is already banked, and **it cannot be part of the
debates explanation.** Whatever made debates measure 15pp worse in S7, it is not that the dense leg
was reading raw conversational text.

⚠ Scope: this covers the ROUTED path, which is what production runs. The gateway's legacy
whole-query fusion (step 4b — reachable only with `LEX_SEARCH_VECTOR=true` **and**
`LEX_VECTOR_STREAMS` unset) fuses one *unscoped* dense ranking built from bare or expansion-widened
keywords, because that path has no per-stream queries at all. It is superseded and logs loudly when
reached; named here so the finding is not read as covering it.

### §6.2 — What would widening `vector-serve` take?

**What sets the width.** `VECTOR_MAX_CONCURRENT` (default **4**) — an in-process semaphore in
`scripts/ingest/search/vector-query-service.ts`, plus a **bounded** queue `VECTOR_MAX_QUEUE`
(default 64) that refuses overflow with 503 + `Retry-After` rather than admitting it. Read live off
the service just now: `concurrency.max: 4, maxQueue: 64, queueHighWaterMark: 4, rejections: 0`.
`fts-serve` by contrast reports `max: 16`. **It is one environment variable, not a code change.**

**⚠⚠ The cap is a throughput choice, not a safety floor — and this project already measured that.**
`docs/VECTOR_SERVING_STEPS_1_3.md` §2, which I read before proposing anything:

- On **one** handle, throughput scales ~4× from concurrency 1 to 8 (0.96 → 3.82 q/s), peaks at
  concurrency **16** (4.12 q/s) and degrades beyond it (3.65 at 32, 1.33 at 64).
- **64 concurrent ANN queries did not crash.** Peak RSS 707 MB.
- A **handle pool buys nothing**: order-controlled, the apparent 1.29× gain became **0.82×** —
  whichever handle count ran second won. Cache warming was doing all of it.
- The premise recorded in `fts-query-service.ts` — that concurrent native calls against one handle
  are unsafe — **did not reproduce** on the vector path. A silent death with no JS-catchable error
  is the signature of an OOM SIGKILL (`docs/CLAUDE.md` §17), so the semaphore is likely a **memory**
  guard rather than a contention one.

That document ends: *"do not re-tune it off these local numbers — re-measure on Railway once
deployed."* **It is now deployed, and that re-measurement has never been done.**

**What widening would cost on the always-on host.** Memory, and the headroom is real but not
generous. Read live: `rss 3,737 MB`, `peak_rss 4,821 MB`, `cap 7,629 MB` — **49% now, 63% at peak.**
About 2.8 GB of headroom above the observed peak. Each additional concurrent ANN query needs working
memory on top of the resident index, and the local probe's 707 MB peak was a smaller working set
than production's. So the cost is not a bigger bill — it is the risk of crossing an 8 GB per-replica
cap that `docs/CLAUDE.md` §17 records SIGKILLing a job at exactly this boundary before.

⚠ **Replicas do not help.** Railway's "48 GB per service" is an aggregate across replicas; a
single-process job only ever gets the per-replica limit, and each replica pays the ~3.7 GB resident
index again.

**▶ What the stream cap should become afterwards.** `LEX_STREAM_CONCURRENCY` is **3** today
(`stream-batch.ts`), against a service width of 4 — strategy §3.4's "one below the service width",
correctly implemented. Observed live in this sprint: `streams batched { streams: 5, cap: 3,
maxInFlight: 3 }`, so five streams already queue behind a cap of three. Adding `committees` to
`LEX_VECTOR_STREAMS` (§2) makes four of five streams issue a dense call, which tightens this.

Recommended sequence, **none of it run here** — §6.2 is explicit that heavy work stays off the
always-on serving host, and a concurrency stress test against production vector-serve *is* load on
it:

1. Re-run `vector-handle-pool-probe.ts` **on Railway**, not locally, at concurrency 4/8/16, watching
   RSS against the 7,629 MB cap. This is the measurement the 2 Aug document deferred.
2. If peak RSS at 8 stays under ~6 GB, set `VECTOR_MAX_CONCURRENT=8`.
3. Then, and only then, `LEX_STREAM_CONCURRENCY=7`.

⚠ **Do not do step 3 without step 1.** Raising the stream cap to 4 in S8 made every statistic worse
precisely because 4 *was* the service width; raising it against an unchanged width would repeat that
exactly.

---

## §7 — DECISIONS FOR CHARLIE

**Q1 — What is `LEX_VECTOR_STREAMS` actually set to in Vercel?** *(a question, not a change)*
Nobody on this machine can read it and the arms differ by 9 questions of 44 (34% / 27% / 18%). One
dashboard read, or `vercel env ls`, closes the largest single uncertainty in this report.
▶ **Recommend:** read it and tell me, before acting on anything else here.

**Q2 — Set `LEX_VECTOR_STREAMS=legislation,caselaw,guidance,committees`?**
- **Do it:** committees goes 0/10 → 3/10. It is the only stream in the set with clean evidence and
  the change is one word. Cost: a fourth dense stream against a 4-wide service; p95 rises, p50 does
  not.
- **Don't:** committees keeps answering none of its ten validated questions on keyword alone.
▶ **Recommend: do it.** This is the sprint's clearest actionable result.

**Q3 — Turn on `LEX_GUIDANCE_CPS`?**
- **On:** guidance 2/10 → 8/10 in-stream; consultations 6/9 → 4/9. Net +4 of 19.
- **Off (today's default):** CPS prosecution guidance remains unreachable by **any** query — the
  platform cannot answer "how do prosecutors decide whether to charge in a domestic abuse case" at
  all, and never could.
- **Neither:** a full FTS reindex with `cps-guidance` moved into the `guidance` tier fixes it with
  no trade and no extra retrieval call. That is the right answer and it is a heavy job.
▶ **Recommend: turn it ON as a bridge, and schedule the reindex.** Losing two consultation answers
from rank 0 to rank 21 is a smaller harm than a collection that returns nothing forever — but this
is a product judgement and it is yours. ⚠ Whichever way, the other eight deferred collections
(~48,600 sections, `cma-cases` 22,898, `ofgem` 17,161, `ofcom` 4,169…) are in the same state and
were **not** touched.

**Q4 — Flip `LEX_STATS_STREAM` to true?**
- **On:** 5,733 official series become discoverable. 9/9 selection, 3/50 false positives, 6/9
  retrieval, negative control passing, no measurable corpus latency cost, and the layer structurally
  cannot return a number.
- **Off:** the stream stays built and unused, as it has been since S9.
▶ **Recommend: on.** ⚠ With the caveat that Q53, Q57 and Q59 return a wrong or empty top hit, so a
user asking about international health spending, departmental budgets or income inequality gets a
plausible-looking wrong series. That is the honest cost of flipping now.

**Q5 — Ten debates questions and ten legislation questions.** The set has none, so the two streams
carrying the most traffic cannot be evaluated, the §2 decisions for them cannot be taken, and §3's
central hypothesis cannot be tested. ▶ **Recommend:** the next validated set is debates and
legislation, and nothing else.

---

## NOT DONE, NAMED

- ❌ **`debates` and `legislation` are unevaluated.** No questions exist. Their vector settings are
  held on absence of evidence and say so.
- ❌ **§3's central hypothesis is untested.** The dial is built, checked and adopted nowhere; the
  experiment it exists for needs debates questions.
- ❌ **No weight was adopted for any stream.** Committees is already on its plateau, caselaw is a
  step at today's value over text being replaced, guidance is a floor effect. Declining is stated,
  per §3.
- ❌ **Case law is a pre-fix baseline only.** No recommendation is made from it. The FTS index still
  holds `sectionTitle: null` for `tna-caselaw`, so **searching for a case by name still cannot match
  the name** until the reindex.
- ❌ **The four rejected questions are not re-keyed** — deliberately, and blocked on the same fix.
- ❌ **`vector-serve` was not widened and no stress test was run against it.** §6.2 is a report, as
  the brief requires; heavy work stays off the always-on serving host.
- ❌ **Q53, Q57 and Q59 return wrong or empty statistics top hits**, and the tokenisation
  (`departmental` ≠ `department`) and synonym (`inequality` ≠ `Gini`) causes are named but not
  fixed — that is the stats thread's file.
- ❌ **The interleave allocation was measured, not changed.** 11 of 44 questions are DILUTED. Whether
  a stream should get a guaranteed floor in the merged top 20 is a design decision this sprint
  raises and does not take.
- ❌ **`LEX_ROUTER_STREAMS_V2` was not scored**, although four impact-assessment misses are
  NOT-ROUTED for exactly the reason V2 exists. The set now supports it; this sprint ran out of scope
  before it.
- ⚠ **No browser walk was possible from here and none is claimed** — the extension has no host
  permission for localhost and there is no Clerk session on production.
- ⚠ **Every "production" configuration named in this report is an INFERENCE about Vercel**, labelled
  in the same sentence, never a reading. The token is SAML-blocked.

---

## ⚠ ONE CROSS-THREAD ITEM, RAISED NOT FIXED — AND STATED MORE PRECISELY THAN I FIRST HAD IT

`npm run check:committed` fires on two files that are on this machine and in no commit:

```
scrutinise-web/lib/lex/known-unknowns.ts
scrutinise-web/lib/lex/evidence-labels.ts
```

**It is a LATENT risk, not a live break, and the distinction is the whole point.** My first reading
of this was wrong and would have been alarming for no reason: I checked that the *importing files*
were tracked (`git ls-files`) and concluded five committed files import two missing ones. Checking
the committed *content* rather than the path says otherwise:

| importer | imports it in HEAD | imports it in the working copy |
|---|---:|---:|
| `lib/lex/deepening.ts` | 0 | 3 |
| `components/lex/DeepeningPanel.tsx` | 0 | 2 |
| `lib/lex/deepening-jobs.ts` | 0 | 1 |
| `lib/lex/deepening-sift.ts` | 0 *(the one hit is a comment)* | 1 |
| `lib/documents/proposal-snapshot.ts` | 0 | 0 |

**Nothing in the repository imports either file, so production is not broken and www.scrutinise.org
returned HTTP 200 during this check.** The break happens the moment the Lex thread commits its
modified `deepening.ts` / `DeepeningPanel.tsx` / `deepening-jobs.ts` **without** also committing the
two new files — which is precisely the `build-cost.ts` incident of 17–18 Aug (`docs/CLAUDE.md` §20),
and precisely what `check:committed` was built to catch one sprint earlier.

⚠ **`next build` passed locally on this tree, and that proves nothing about it** — the files exist
here. A green local build says the files on this machine are consistent with each other, not that a
clean checkout would compile. That is §20's third incident restated.

▶ **Whoever owns the Deepening work: `git add` both files in the same commit as their importers.**
Not committed here — a half-written file from a live session is worse than an absent one, and these
are not search's to commit.

---

## ARTEFACTS

| file | what it is |
|---|---|
| `scrutinise-web/lib/lex/fusion.ts` | the dial — `streamVectorWeight`, `resolvedFusionWeights` |
| `scrutinise-web/lib/lex/query-router.ts` | per-stream weight resolution + the `captureLegs` measurement seam |
| `scrutinise-web/lib/lex/stream-scopes.ts` | `cps-guidance` behind `LEX_GUIDANCE_CPS`, with the measurement in the comment |
| `scrutinise-web/lib/lex/stats-licence-register.ts` | the dated, owned use-context decision |
| `scrutinise-web/lib/env-flags.ts` | `LEX_FUSION_WEIGHTS`, `LEX_GUIDANCE_CPS` |
| `scrutinise-web/scripts/gold/s10-gold-set.ts` | Charlie's validated set as data, rejects preserved |
| `scrutinise-web/scripts/verify-s10-keys.ts` | 68/68 keys present, with a planted-absent self-test |
| `scrutinise-web/scripts/measure-s10-recall.ts` | §1/§2/§3 from one retrieval pass + the fidelity control |
| `scrutinise-web/scripts/diagnose-s10-misses.ts` | why each NOT-RETRIEVED miss is one |
| `scrutinise-web/scripts/measure-s10-guidance-fix.ts` | the cps-guidance before/after |
| `scrutinise-web/scripts/measure-s10-stats.ts` | §4 end to end |
| `scrutinise-web/scripts/verify-s10-dense-query.ts` | §6.1, asserted live |
| `scrutinise-web/scripts/check-s10-fusion.ts` | 19/19, 5/5 breaks fired |
| `scrutinise-web/scripts/check-s10-stats-licence.ts` | 9/9, 4/4 breaks fired |
