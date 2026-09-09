# SEARCH S19 — THE UNIT, AND THE REACH

**Sprint:** BRIEF_SEARCH_S19.md · **Run:** 2026-09-09, 03:54–05:0x UTC · **Stream:** SEARCH
**Artefacts:** `docs/census/s19-predictions.json` (written before any retrieval) ·
`docs/census/s19-grain-scoped-dense.json` · `docs/census/s19-grain-gateway.json` ·
`docs/census/s19-grain-gateway-grainon.json` · `docs/census/s19-grain-gateway-control.json` ·
`docs/census/s19-reach.json`
**Question set:** S10 `GOLD_CANDIDATES_S8` (validated 20 Aug) + `GOLD_CANDIDATES_V2` (validated
22 Aug), **pre-re-key**. 65 scoreable recall questions; the four negative controls are excluded by
design, and a scorer that folded them into an average would have broken the instrument.

---

## ▼▼ THE ONE-PARAGRAPH ANSWER

**The unit is worth eighteen questions of sixty-five, and it is worth them in four collections and
exactly nothing in three.** BM25 scoped to each key's own collection, recall@20: **section 23 of
65, document 41 of 65.** The gain is concentrated — impact assessments 0→6 of 9, debates 2→7 of 11,
legislation 2→6 of 10, committees 0→3 of 10 — and is **structurally zero** for caselaw, guidance and
consultations, where one document holds exactly one section and the two grains are the same object.
⚠⚠ **And the half of the fix that would reach a user does not follow from the half that finds the
document.** Retrieve at document grain and show that document's best-scoring retrieved section —
which is what §3's own build does — and the score is **22 of 65, WORSE than the 23 the section grain
already gets**: debates 0 of 11, impact assessments 0 of 9. The right sitting day comes back and the
answer speech is never the one displayed. **For 11 of the 18 questions the document grain rescues,
the answer section is not in the top 500 of its own collection at all**, so no re-ranking of the
retrieved list can ever surface it. The capability that is actually missing is a **retrieval scoped
to one document**, which no search service we run can do. It is Q1 below.

---

## §2 — THE THREE-GRAIN TABLE. THIS IS THE SPRINT.

### §2.0 First, the fact that decides which collections a grain change can even touch

Measured from `corpus_sections` on 2026-09-09, over every collection holding a validated answer key.
Not assumed, and not read from a map:

| collection | sections | documents | sections per document |
|---|---:|---:|---:|
| `historic-hansard` | 4,641,117 | 4,026 | **1,152.8** |
| `pwdata-debates` | 6,393,542 | 20,087 | 318.3 |
| `niassembly-hansard` | 196,348 | 632 | 310.7 |
| `primary-acts-2000plus` | 147,975 | 938 | 157.8 |
| `scottish-parliament-or` | 1,044,188 | 7,452 | 140.1 |
| `pwdata-lords` | 755,411 | 5,724 | 132.0 |
| `pwdata-westminster` | 241,030 | 3,973 | 60.7 |
| `impact-assessments` | 18,759 | 1,172 | 16.0 |
| `primary-acts-pre-2000` | 179,435 | 16,622 | 10.8 |
| `si-2010plus` | 287,078 | 28,401 | 10.1 |
| `regional` | 357,161 | 38,120 | 9.4 |
| `committees-reports` | 344,773 | 51,000 | 6.8 |
| `college-of-policing` · `committees-evidence` · `consultations` · `cps-guidance` · `hmrc-manuals` · `tna-caselaw` | — | — | **1.0** |

⚠⚠ **Six of the eighteen collections hold exactly one section per document.** They carry **29 of the
65 questions**. For those the document grain is not a worse idea or a better one; it is the same
object under another name. **A table that did not say so would report a null result as a finding**,
and this is also the harness's own control: recall at the two grains MUST be identical there, and
`measure-s19-grain.ts` asserts it (29 questions, **0 disagreements**) — as does `check:s19-grain`.

⚠ **The document key is the thing most likely to be wrong, so it lives in one place and is
imported** (`lib/lex/grain.ts::documentKeyOf`, CLAUDE.md §25.3). Both obvious rules are wrong
somewhere and both were measured before either was used:

- **`parentDocId`** is right for committees, debates and the devolved Hansards. ⚠ It names the
  **instrument appraised** for `impact-assessments` (1,172 assessments, only 1,049 distinct
  parents), so two assessments of one SI would collapse into one document. ⚠ It is **NULL on every
  row** of `consultations`, `primary-acts-*`, `regional`, `si-2010plus` and `tna-caselaw`.
- **the id's second colon segment** is right for those, and **catastrophic** for committees: every
  id is `committees-reports:publication:{report}:{section}`, so segment 2 is the literal word
  `publication` and **all 344,773 sections of all 51,000 reports collapse into ONE document**.
  Measured: distinct id-segment-2 for `committees-reports` = **1**.

### §2.1 ▶▶ RECALL@20 AT EACH GRAIN, PER COLLECTION

Two arms, both **scoped to the key's own collection** so the unit is isolated from routing and from
the merge. Depth 500 (sparse) / 200 (dense). ⚠ Every miss is a miss at the depth searched, never an
absence from the corpus.

**Arm A — BM25 over `corpus_fts`. This is the SECTION-grain scorer: it reads the whole section as
one bag of words.**

| collection | n | section | document | doc → best § | *S18's definition* |
|---|---:|---:|---:|---:|---:|
| committees | 10 | **0** | 3 | 2 | 1 |
| caselaw | 6 | 3 | 3 | 3 | 3 |
| guidance | 10 | 8 | 8 | 8 | 8 |
| impact-assessments | 9 | **0** | **6** | **0** | 4 |
| consultations | 9 | 8 | 8 | 8 | 8 |
| debates | 11 | 2 | **7** | **0** | 6 |
| legislation | 10 | 2 | **6** | 1 | 5 |
| **ALL** | **65** | **23** | **41** | **22** | **35** |

**Arm B — the dense leg over `corpus_vec`. This is the CHUNK-grain scorer: it reads ~3,200-character
windows and takes each section's best.**

| collection | n | section | document | doc → best § | *S18's definition* |
|---|---:|---:|---:|---:|---:|
| committees | 10 | 4 | 7 | **7** | 4 |
| caselaw | 6 | 5 | 5 | 5 | 5 |
| guidance | 10 | 8 | 8 | 8 | 8 |
| impact-assessments | 9 | 4 | **9** | 2 | 9 |
| consultations | 9 | 9 | 9 | 9 | 9 |
| debates | 11 | 2 | **8** | **0** | 8 |
| legislation | 10 | 6 | 8 | 5 | 8 |
| **ALL** | **65** | **38** | **54** | **36** | **51** |

**The four columns, because three of them are routinely conflated:**

- **section** — the key's rank in the ranked section list. What is scored today.
- **document** — the key's document's rank in the list *deduplicated to one entry per document*.
  What a document-grain retrieval finds.
- **doc → best §** — ⚠⚠ **the number this should be judged on.** The top 20 documents, each
  rendered as its own best-scoring retrieved section: is the answer one of those 20 sections? This
  is exactly what §3's build returns and what a user would see.
- **S18's definition** — the position **in the section list** of the first hit belonging to a key's
  document, reproduced so this sprint's figures can be compared with the published ones rather than
  quietly superseding them.

### §2.2 ⚠⚠ THE FINDING THAT REFUTES §3 AS THE BRIEF WROTE IT

§3 says *"Retrieve at the grain that finds it; display the passage that matched … Locate the passage
inside the document after retrieval."* **Locating it inside the already-retrieved list does not
work.**

```
                       section    document    doc → best §
sparse (BM25)            23/65       41/65          22/65     ← WORSE than the section grain
dense  (chunks)          38/65       54/65          36/65     ← also worse than its own section grain
```

Per collection it is worse in exactly the places the document grain won most: **debates 0 of 11 on
BOTH arms**, impact assessments 0 of 9 sparse and 2 of 9 dense, legislation 1 of 10 sparse.
Committees is the exception — dense **7 documents, 7 right passages** — because a committee report
is 6.8 substantive sections, so its best retrieved section usually *is* the answer.

▶▶ **And the mechanism, measured rather than reasoned: of the 18 questions the document grain
rescues on the sparse arm, the answer section is NOT in the top 500 of its own collection for 11 of
them** (dense: 8 of 16 not in the top 200). Those answers were never retrieved. **No re-ranking, no
snippet selection and no display change can reach a row that retrieval did not return.** What is
needed is a *second retrieval, scoped to the one document* — over all 318 speeches of the sitting
day, not over the four of them that happened to score.

⚠ **No search service we run can do that.** `fts-serve`'s contract is
`{query, tier?, limit?, corpora?, excludeCorpora?}` and `vector-serve`'s is the same; neither
accepts a document, a parent or an id list. Adding one is a small change to a service that
**auto-deploys**, and it is Q1 below rather than something ridden along behind a measurement.

### §2.3 ⚠⚠ AND THE OTHER HEADLINE: THE CHUNK-GRAIN SCORER BEATS THE SECTION-GRAIN SCORER EVERYWHERE

**P-5 is REFUTED, and in the direction that matters.** I predicted the dense arm would beat sparse
on debates and committees and **lose** on legislation and guidance. It wins or ties on all seven:

| | committees | caselaw | guidance | impact-a. | consultations | debates | legislation | ALL |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| sparse, section grain | 0/10 | 3/6 | 8/10 | 0/9 | 8/9 | 2/11 | 2/10 | **23/65** |
| dense, chunk grain | 4/10 | 5/6 | 8/10 | 4/9 | 9/9 | 2/11 | 6/10 | **38/65** |

Legislation goes **2 → 6 of 10**, which is where I was most confident of the opposite. ⚠ **What that
means for §3: the grain is not the only mechanism, and it is not even the larger one here.** The two
effects are close to additive — the document grain adds +18 on the sparse arm and +16 on the dense
one — so both are real, but a report that presented the grain alone would be describing the smaller
half of what moves these numbers.

### §2.4 The length distribution at each grain, and ARGUMENT 1A's fragment finding

Word counts of the top 20 returned at each arm, per collection (median of per-question medians;
share of returned rows under 30 words and over 1,500):

| collection | sparse median | sparse <30w | sparse >1500w | dense median | dense <30w | dense >1500w |
|---|---:|---:|---:|---:|---:|---:|
| committees | 722 | 0.0% | 25.0% | 1,126 | 0.0% | 42.0% |
| caselaw | 5,397 | 0.0% | **84.2%** | 8,317 | 0.0% | **96.7%** |
| guidance | 3,594 | 0.0% | 47.5% | 2,523 | 0.0% | 51.0% |
| impact-assessments | 1,603 | 0.0% | 48.3% | 287 | **12.8%** | 36.1% |
| consultations | 298 | 0.0% | 0.0% | 232 | 0.0% | 0.0% |
| debates | 549 | 0.5% | 6.8% | 480 | **9.1%** | 7.3% |
| legislation | 368 | 2.0% | 0.5% | 235 | **9.5%** | 0.5% |

⚠⚠ **P-6 IS REFUTED ON THE SPARSE ARM AND THE REFUTATION IS USEFUL.** I predicted the median
returned debates section would be under 100 words and more than a quarter under 30. It is **549
words with 0.5% under 30**. BM25 rewards term frequency, so it *prefers long sections* — the exact
opposite of the fragment problem. **The fragment problem is a property of the DENSE arm**
(9–13% under 30 words on debates, legislation and impact assessments), not of retrieval generally,
and ARGUMENT 1A's 48.8% was measured on a seed-neighbourhood argument probe, which is a harder case
than a gold question. ▶ **So a minimum-length floor belongs on the dense leg and nowhere else.**
It is built, and it is OFF (§3).

⚠ **The opposite end is the bigger problem and nobody has been counting it.** **84.2% of what the
sparse arm returns for caselaw, and 96.7% of what the dense arm returns, is over 1,500 words** — a
whole judgment is one section (`tna-caselaw`: 74,896 sections over 74,896 judgments, one apiece,
median 17,650 words on the sampled rows). A "result" there is an entire High Court judgment. That is
the unit being wrong in the OTHER direction, exactly as §0 of the brief said, and it is not fixable
by any grain setting because there is no finer grain stored.

### §2.5 Six questions that no grain and no arm can answer

| id | collection | question |
|---|---|---|
| S10-Q6 | committees | What did people submitting evidence say about how AI should be governed? |
| S10-Q8 | committees | What did witnesses tell the committee about special educational needs? |
| S10-Q9 | committees | What was the committee told about serious violence? |
| S10-Q28 | guidance | What guidance does HMRC give its own staff on money laundering…? |
| S10-Q29 | guidance | When can HMRC depart from the strict letter of the law? |
| V2-Q15 | legislation | Is the old law banning schools from promoting homosexuality still…? |

Every grain, both arms, missed at 20. **6 of 65 (9.2%) is a floor on what the unit cannot fix** —
these are the NOT-MATCHED class and they need re-keying or a different retrieval, not a different
unit. ⚠ Three of the six are committee EVIDENCE questions, and `committees-evidence` is a
one-section-per-document collection, so the document grain was never going to reach them.

---

### §2.6 ⚠ AND THROUGH THE REAL GATEWAY, MOST OF IT IS TAKEN BACK

The brief: *"a grain that wins in isolation and loses in the merge is not a win."* Both arms above
are scoped to one collection. This one is the whole product — `runSearch()`, router on, five dense
streams, reranker on, judged merge on — **run under production's flag string, read live off
`/api/health` at the top of the run and recorded in the artefact** (commit `3f205a2`,
`LEX_VECTOR_STREAMS=caselaw,committees,debates,guidance,legislation`).

| collection | n | section | document | doc → best § | median words | <30w |
|---|---:|---:|---:|---:|---:|---:|
| committees | 10 | 3 | 4 | 3 | 716 | 1% |
| caselaw | 6 | 4 | 4 | 4 | 6,940 | 0% |
| guidance | 10 | 6 | 6 | 3 | 1,551 | 1% |
| impact-assessments | 9 | **2** | **2** | 0 | 451 | 1% |
| consultations | 9 | 6 | 6 | 6 | 364 | 0% |
| debates | 11 | 2 | **7** | 2 | 603 | 1% |
| legislation | 10 | 4 | **7** | 3 | 485 | 3% |
| **ALL** | **65** | **27** | **36** | **21** | — | — |

▶▶ **P-7 is CONFIRMED, and the shape of the loss is the finding.** The document grain is worth
**+18 scoped and +9 through the gateway** (27 → 36). It survives for the two collections that are
large enough to win interleave slots — **debates 2 → 7, legislation 4 → 7** — and it is
**annihilated for impact assessments: 6 of 9 scoped, 2 of 9 merged, and the document grain adds
literally nothing there (2 → 2)**, because the assessment's sections never reach the merged list at
all. 18,759 sections compete for `legislation`'s slots against a 2.09M-section tier.

⚠⚠ **That is S8 §4's `LEX_ROUTER_STREAMS_V2` argument arriving on the unit axis, and it is the
sharper version of it: a grain change cannot help a collection that gets no slots.** Two mechanisms,
and the smaller collection needs the other one first.

⚠ **A control the harness applied to itself, which removed two columns from this table.**
`aggregateToDocuments('max')` must order a score-sorted list exactly as a first-occurrence collapse
does. On the two scoped arms it did, on all 130 results. **On the gateway arm it disagreed on 42 of
65** — because `runRoutedSearch` returns `results` INTERLEAVED ROUND-ROBIN, deliberately, so that any
prefix is stream-balanced, and `score-scope.ts` exists to stop anything sorting it. So the two
score-aggregation columns are **not computable on this arm** and are withheld rather than printed
with a footnote. A number that should not be read is better absent.

### §2.7 ▶ THE BASELINE S17'S D-6 ASKED FOR

*"Re-take the baseline under production's real flag string"* has been open since 27 August. The
gateway row above **is** that baseline: **27 of 65 (41.5%) at section grain**, under
`QUERY_EXPANSION=ON QUERY_ROUTER=ON SEARCH_VECTOR=ON SEARCH_RERANKER=ON TIER_FUSION=ON
SEARCH_JUDGED_MERGE=ON STATS_STREAM=ON ROUTER_STREAMS_V2=off ROUTER_APPRAISAL=off`, verified against
`/api/health` rather than inferred.

⚠ **It is NOT directly comparable to S15's "19 of 64" and I am not presenting it as an improvement.**
Three things differ: the flag string (S15's figure describes the merge-OFF arm — S17 §3 established
that the instrument and the product were differently configured and nobody could see it), the
question set (65 scoreable here against 64 there; the composition has not been reconciled row by
row), and the scoring depth. **What this number is good for is being the first figure taken with the
configuration written down beside it.** Everything after it can be compared to it.

---

## §1 — THE REACH

`docs/census/s19-reach.json`. ⚠ **Every tier below is READ BACK OFF `fts-serve`, one collection at a
time, using words taken from that collection's own rows.** Nothing is read from `corpus-map.ts`.
That is the brief's instruction and it is also the S16 lesson: UNREACHABLE=4 was published off a
tier artefact generated one day before S11's re-tier.

### §1.1 ▶▶ EVERY COLLECTION, PROBED. AND THE HEADLINE IS NOT THE TREATIES.

**74 collection names were probed** — the union of `corpus_sections` (67), the names in
`docs/corpus_reachability.json` (74, names only), and an unscoped discovery sweep. ⚠ A collection in
the index under a name none of those three sources knows would still be missed; closing that needs a
full index scan, which `scripts/ingest/search/corpus-reachability.ts` does and this does not.

| verdict | collections | database sections |
|---|---:|---:|
| **reachable** | 62 | 18,241,533 |
| deferred-to-graph (`early-day-motions`, `petitions`) | 2 | 110,266 |
| **keyword-only — no stream can return them** (`uk-treaties`, `tax-treaties-dta`) | **2** | **3,588** |
| excluded-by-design (`members-interests`) | 1 | 3,448 |
| **ORPHANED-IN-INDEX** | **7** | **0 in the database** |

**18,241,533 of 18,358,835 database sections (99.36%) sit in a collection some router stream can
select.** ⚠ **And that percentage is taken over the database, which cannot see seven of the rows'
collections at all.**

▶▶ ⚠⚠ **THE FINDING OF §1 IS NOT ABOUT REACHABILITY. SEVEN COLLECTIONS ARE IN THE SERVED INDEX,
ARE ADMITTED BY REAL STREAMS, AND HOLD ZERO ROWS IN `corpus_sections`.**

`lda-commonsdivisions` · `lda-commonswrittenquestions` · `lda-lordsdivisions` ·
`lda-lordswrittenquestions` · `oecd` · `written-answers` · `written-statements`

All seven were in `docs/CORPUS_REACHABILITY.md` on 20 August with section counts (36,919 rows
between them, **read off that artefact, not measured today**). All seven return hits from the served
index right now. All seven have **0 rows in Neon**. So the hydrate finds nothing, and — measured
through `runFtsSearch`, the adapter the product actually calls, not reasoned:

```
id=oecd:-government-news-introducing-the-ukgi-contingent-liability-central-capability:1
   type=GUIDANCE  title="oecd"  citation=""  url=""  date=""
id=written-statements:2015-05-01:2015-05-31:1
   type=DEBATE    title="written-statements"  citation=""  url=""  date=""
```

**The product returns a result card titled with the name of the collection, with no citation, no
date and nothing to click.** 30 such rows came back from one probe. ⚠ And Lex may cite them.

⚠ **`et-decisions` is the same defect, partially: 12 of 20 returned ids hydrate.** It holds 161,753
sections in Neon today against 293,403 in the 20 August artefact — the C2 L2 purge — and the index
still serves the purged rows. **The grain run met 55 of these ids in its own rankings.**

▶ **This is an INGEST finding and is reported, not fixed** (§5 of the brief). The change needed:
**a purge or re-key of `corpus_sections` must be followed by the same deletion in `corpus_fts` and
`corpus_vec`, and something must assert the two agree.** The instrument for the assertion now
exists — `audit:s19-reach`'s `hydrates` column, ids taken from the index and looked up in the
database, in that direction.

⚠ **My own first sweep got one row of this table wrong and it is worth naming.** It reported
`lda-commonsoralquestions` (69,529 sections) as TIER-UNREAD after twelve probes. The collection is
in the index and perfectly reachable; **all 69,529 of its rows have a blank `sectionTitle`**, so
every probe string was empty. A probe that matches nothing reads exactly like an unreachable
collection — the brief warned about this in §1.1 and I built the warning in and was caught anyway.
The sweep now probes in three stages (title → id → four generic phrases, corpus-scoped) and records
**which stage answered**. ⚠ 69,529 sections with no title at all is itself an ingest finding.

### §1.2 — SEPARATING WHAT A DOCUMENT *IS* FROM WHERE IT CAN BE *FOUND*

**Measured live, not reasoned:**

| collection | sections | served tier | display type | streams that admit it |
|---|---:|---|---|---|
| `uk-treaties` | 3,264 | parliamentary | TREATY | **NONE** |
| `tax-treaties-dta` | 324 | parliamentary | TREATY | **NONE** |
| `uk-treaties-fcdo` | 23,372 | parliamentary | **DEBATE** | debates |

Same material, same tier, opposite fates, on a label chosen for rendering. The brief is right that
this is a design in which reachability is a side effect.

⚠⚠ **AND THE BRIEF'S ACCOUNT OF THE MECHANISM IS HALF RIGHT, WHICH CHANGES WHAT A FIX HAS TO DO.**
§0 says they are unreachable *"because they are display-typed TREATY"*. They are excluded **twice**:

1. by the display type — the debates stream takes `types: ['DEBATE','DIVISION']`; **and**
2. **by name** — both are listed in `NON_DEBATE_PARLIAMENTARY`, the debates stream's `excludeCorpora`.

**So re-typing them `DEBATE` would not make them reachable, and neither would a routing attribute
independent of display type, on its own.** Two locks, one door. A fix aimed at one of them would
ship, measure as a no-op, and read as though the mechanism had been misunderstood.

**The options, with costs:**

| | what it is | cost | what it leaves |
|---|---|---|---|
| **A — a routing attribute independent of display type** | a `retrievalClass` computed at query time from the corpus name, exactly as `corpusToType` computes the display type; `StreamScope.types` filters on it instead | **~1 day**, plus a before/after gold run. One pure function over 74 names, one clause in `streamCanSelect`, three readers follow. **No reindex** — it is query-time, like the display type. ⚠ It does NOT touch rendering: the display type is untouched and the new axis is additive, so the brief's worry about "how every result is rendered" does not apply | the `excludeCorpora` lock, which still has to be edited by hand |
| **B — a total type→streams table** | `TYPE_TO_STREAMS: Record<SearchResultType, RouterStreamName[]>`, exhaustive over the enum so a new display type must be assigned or a check fails | **~half a day** | the coupling itself. A future decision to render treaties differently still changes what can be found |
| **C — fix the two collections by hand** | admit `TREATY` to the debates stream and remove both from `NON_DEBATE_PARLIAMENTARY` | **two lines** | ⚠ **the mechanism, entirely.** The brief says this is not the answer to the question and it is right; saying so plainly is the instruction and this is it |
| **D — make reachability a CHECKED property** | every collection is admitted by a stream **or** named in a register with a reason; a check counts all three buckets and fails when the third is non-empty | **built this sprint**, changes no retrieval | nothing — but it is a guard, not a fix |

▶▶ **RECOMMENDATION: D is done. Do A next, but not yet, and do not do C on its own.**

- **D shipped**, because it removes the class permanently at zero retrieval risk and it is a guard
  rather than a widening. `check:s19-grain` §5 now counts **67 collections: 62 admitted by a stream,
  5 named in a register, 0 owned by nobody**, and it fails if that third number moves. The two
  treaty collections are named in a **new, fourth register** — `UNREACHABLE_PENDING_DECISION` in
  `corpus-type-map.ts` — which says *unreachable, not intended, and here is what is blocking the
  fix*. ⚠ `EXCLUDED_BY_DESIGN` says "nobody is meant to reach this" and `DEFERRED_TO_GRAPH` says
  "retrieval is the wrong door"; neither is true of these, and filing them under either would be
  exactly the lie the first register was invented to stop. ⚠⚠ **The check also fails if a
  collection named in that register has BECOME reachable**, so it cannot turn into a place where
  problems are filed and forgotten.
- **A is the durable fix and its cost is modest.** It should not ship this sprint, for a reason that
  is not caution: ⚠⚠ **the validated set contains ZERO treaty questions**, so a change to what the
  debates stream returns has nothing to score against. `corpus-map.ts` recorded that blocker on 21
  August and it has not moved. **Sequencing A after treaty questions exist is a re-keying ask for
  Charlie, not a search task** — Q3 below.

### §1.3 — THE NOT-ROUTED CLASS, RECOMPUTED RATHER THAN INHERITED

The brief says impact assessments were overturned by S18 and asks me to re-check "the other three".
Rather than re-checking three questions a stale class list happens to name, **the router was rolled
three times over every one of the 65 validated questions**, and a question counts as routed only
when the model named a stream that **admits one of that question's keys** — computed with the
imported `streamCanSelect` against the tier read off the served index, never from a label.

```
ROUTED 60   ·   INTERMITTENT 1   ·   NOT-ROUTED 4      (65 questions × 3 rolls, ROUTER_STREAMS_V2=false)
```

▶▶ **There is no class of "four collections never routed to". There is ONE collection with four
questions**, and they are **exactly** the four S17 published and S18 diagnosed — S10-Q33, Q34, Q35
and Q39, impact assessments — reproducing three times each, with the router naming
`debates+committees+guidance` and never `legislation` on any of the twelve rolls.

⚠ **S17's fifth NOT-ROUTED question has moved: S10-Q27 (guidance) is now INTERMITTENT at 2 of 3
rolls**, naming `legislation+caselaw+guidance` twice and `caselaw` alone once. That is the
intermittency S18 §1 built `--repeat` for, and a single roll would have recorded it as either state.

▶ **So §1.3's answer is that the routing half of "the reach" is closed**: it is one known collection,
already diagnosed, with a fix already built behind `LEX_ROUTER_APPRAISAL` (default OFF) — and S18
already established that the fix **buys no recall**, because routing cannot make an unanswerable key
answerable. §2.6 adds the second reason it would not help: even correctly routed, impact assessments
score 2 of 9 through the merge.

---

## §3 — WHAT WAS BUILT

**`LEX_SEARCH_GRAIN`, default OFF, read through `flagEnabled()`.** A per-collection grain setting
(`LEX_SEARCH_GRAIN_MAP=impact-assessments:document,debates:document`) plus a retrieval-side length
floor (`LEX_SEARCH_MIN_WORDS`, default 0).

- **`lib/lex/grain.ts`** — the document key, the two collapse/aggregate operations, and the chunk
  arithmetic. Dependency-free, so `scripts/ingest/**` can import the same object rather than a copy
  (the same discipline `stream-scopes.ts` keeps, and for the same reason).
- **`lib/lex/grain-policy.ts`** — the flag, the map, the floor, and `applyGrain`.
- **`lib/lex/query-router.ts`** — one call site, at the end of `fusedStream`, on **every** path out,
  so a stream cannot return an un-regrouped list by taking an early exit. ⚠ It is BEFORE the
  interleave deliberately: the interleave allocates slots per stream, so collapsing a stream's 300
  sections to 40 documents afterwards would collapse a list already cut to 20 and buy nothing —
  which is the mistake `extraCorpora` made with the division roll-calls.
- **`lib/lex/fts-search.ts` and `lib/lex/vector-search.ts`** — `parentDocId` and `wordCount` added to
  the hydrate that already fetches url, date and title. **Same round-trip, two more columns.**
  ⚠⚠ Without `parentDocId` the regroup would fall back to the id's second segment and merge all
  51,000 committee reports into one document. `SearchResult.parentDocId` is deliberately three-state:
  `undefined` (not hydrated — the orphan case) is not `null` (no parent), and `applyGrain` refuses to
  regroup the first rather than grouping it on a wrong key.

**It is inert until a grain is set.** With the flag off `applyGrain` returns its argument **by
reference**, which `check:s19-grain` asserts by comparing rankings rather than by reading the
default out of the code.

### §3.1 ⚠⚠ AND THE MEASURED EFFECT SAYS TO LEAVE IT OFF

Three full gateway runs in one session — OFF, OFF again as a noise-floor control, and ON.
**Turning it on costs four questions of sixty-five in what a user receives (27 → 23) against a
measured drift of ZERO between the two OFF runs**, and buys at most two in the passage metric.
⚠⚠ **And it drops `guidance` from 6 to 4 while no guidance collection is named in the map at
all** — the interleave allocates slots from the total number of results, so shrinking one
stream changes every other stream’s share. **A per-collection grain setting is not
per-collection in its effects.** Full table and the control in §4.

### §3.2 What I declined to change, and why

- **The length floor is built and OFF, and the arm it would act on is the dense one.** §2.4 measured
  0.0–2.0% of the sparse arm's top 20 under 30 words — BM25 rewards term frequency, so it *prefers*
  long sections. The dense arm is 9–13% on debates, legislation and impact assessments. ⚠ A floor is
  a **ranking rule used as a filter** unless it is set from evidence, and this project has already
  paid for that once (a cap used as a selection rule dropped "civil service" twice from the one
  proposal a sprint existed to serve). It stays off until there is a question set that a fragment is
  measurably costing.
- **I did not join adjacent short sections into a passage.** The brief asks for the effect to be
  reported before adopting it. The effect cannot be reported without doing it, and doing it
  **changes identifiers**, which invalidates everything keyed to them — the answer keys, the
  citation graph's `source_provision_ref`, the argument tags, and the R2 keys. That is a
  cross-stream change with an ingest dependency, not a search experiment. **Reported, not done.**
  ⚠ And §2.4 removes most of the motivation for it on the sparse arm: the fragments are not what
  BM25 returns.
- **I did not touch `scripts/ingest/search/`**, so `vector-serve`'s auto-deploy was not triggered.
  **Checked, not assumed** — `check-clean-build.sh --fast` and the file list.
- **I did not tune anything to the 64 questions.** No sweep was run and no parameter was chosen from
  a score. The grain map used in §4 is the one §2 pointed at, set once, and the shape is reported
  rather than a winning point.

---

## §4 — THE MEASURED EFFECT, AND WHAT IT SUPERSEDES

### §4.1 The noise floor first, because without it the arms are unreadable

An LLM sits in the router, in the expansion and in the reranker, so two runs of the **same**
configuration do not return the same list. S18 §1.4 learned this the hard way: a first read reported
19.4% of questions losing a stream, and an OFF-vs-OFF control put the floor at 8.3%. So the control
was run **before** the arms were compared — a third full gateway pass, same flag string, same index,
nothing changed.

| | OFF (run 1) | OFF (control) | drift |
|---|---:|---:|---:|
| section — **what a user receives** | 27 / 65 | 27 / 65 | **0** (one gained, one lost) |
| document found | 36 / 65 | 36 / 65 | **0** (one gained, one lost) |
| doc → best § | 21 / 65 | 22 / 65 | **+1** |

⚠⚠ **The aggregate counts are stable to ±1 of 65 while the RANKINGS churn heavily: only 21 of 65
top-20 lists are identical between two runs of the same configuration.** Both halves matter. The
churn means no single question's rank can be quoted from one run; the stability means the aggregate
**can** be, and a movement of 4 is well outside it.

### §4.2 ▶▶ THE GRAIN POLICY ON, AND IT COSTS MORE THAN IT BUYS

All three runs in one session, same index (`fts-serve` build `S16-fts-cancel-bounded`,
`vector-serve` `S15-cancel-bounded-batch`, unchanged either side), production's flag string, and
`LEX_SEARCH_GRAIN_MAP` naming all thirteen multi-section collections.

| | OFF | OFF (control) | **ON** | verdict |
|---|---:|---:|---:|---|
| **section — what a user receives** | 27 | 27 | **23** | ⚠ **−4, against a floor of 0. REAL.** |
| document found | 36 | 36 | 34 | −2, marginal |
| doc → best § | 21 | 22 | 24 | +2, marginal |

**Per collection, what a user receives (top-20 sections):**

| | OFF | ON | |
|---|---:|---:|---|
| committees | 3 | 3 | — |
| caselaw | 4 | 4 | — (structurally cannot move) |
| **guidance** | 6 | **4** | ⚠⚠ **and NO guidance collection is in the grain map** |
| impact-assessments | 2 | **0** | the assessment's one returned section is not the key |
| consultations | 7 | 7 | — |
| debates | 2 | 2 | — |
| legislation | 4 | 3 | — |

▶▶ ⚠⚠ **THE GUIDANCE ROW IS THE FINDING, AND IT IS A FINDING ABOUT THE MECHANISM.** Not one guidance
collection is named in `LEX_SEARCH_GRAIN_MAP`, so the regroup cannot touch a guidance row — and
guidance drops 6 → 4, twice the noise floor, while the two OFF runs hold it at 6 → 6. **A
per-collection grain setting is not per-collection in its effects.** `runRoutedSearch` interleaves
round-robin over a budget derived from the total number of results, so shrinking the legislation
stream from 300 sections to 40 documents changes how many slots every OTHER stream is given. The
coupling is in `interleaveStreams`, it is by design, and nothing about a "per-collection" flag
escapes it.

▶ **So the flag stays OFF, and this is the reason, not caution.** It costs four questions of
sixty-five in what a user receives, buys at most two in the passage metric, and has a cross-stream
side effect that a per-collection setting is not supposed to have. **The mechanism is right and the
missing half is Q1** — a retrieval scoped to one document, after which the document grain would
deliver the passage instead of merely finding the file it is in.

⚠ **Reported as the shape, not as a tuning point** (the brief's §3 rule). No sweep was run, no
parameter was chosen from a score, and the grain map is the one §2 pointed at, set once.

### §4.3 What this supersedes, named

| figure | status |
|---|---|
| **S18 §1's four impact-assessment numbers** (section@20 0/9, section@200 2/9, document@20 4/9, document@200 8/9, BM25 scoped) | ✅ **REPRODUCED EXACTLY**, three days later, on a different harness. Not superseded — corroborated. S18's document definition (position in the SECTION list) is carried as its own column so the two can be compared |
| S18's *"document-level 4 of 9"* as **the** document number for impact assessments | ⚠ **SUPPLEMENTED, not contradicted.** Under the collapsed-document ranking it is **6 of 9**, and with the dense leg **9 of 9**. The difference is the definition, not the data, and both are printed |
| `docs/CORPUS_REACHABILITY.md`'s verdict table (20 Aug) — 9 keyword-only collections, 48,883 sections | ⚠ **SUPERSEDED.** Two keyword-only collections, 3,588 sections. The seven S11 re-tiered are reachable. ⚠ The old file is **not edited** — it is generated by a fuller instrument (two full Lance scans) and a hand-corrected row is a row that will be wrong after the next ingest. It should be **regenerated**; until it is, `docs/census/s19-reach.json` is the current reading and this report says which is which |
| `SEARCH_CONTRACT.md` §1's *"reachable by no search stream at all … `members-interests`, `erskine-may` where not bridged, `uk-treaties`, `tax-treaties-dta`, `bills-api`"* | ⚠ **SUPERSEDED, and three of the five were wrong.** Updated in this sprint's commit |
| S17's **D-6** (*"re-take the baseline under production's real flag string"*) | ▶ **CLOSED**: 27 of 65 at section grain, flag string verified off `/api/health` |
| S15's *"19 of 64"* | ❌ **NOT superseded and NOT compared.** Different flag string (S15's describes the merge-OFF arm), different set size, no row-by-row reconciliation. Naming it as an improvement would be the exact error S17 §3 found |
| S16's 32-failure autopsy and S17's recount | ❌ **Untouched.** This sprint measures a different property; no recount was attempted and none is implied |

⚠ **And the caution the brief asked for, applied to every number above.** Four sets of re-keyed
questions are with Charlie (debates, committees, costing, impact assessments). **These figures will
move when they land, for reasons that have nothing to do with this sprint.** The set version is
stamped in every artefact (`S10 GOLD_CANDIDATES_S8` + `GOLD_CANDIDATES_V2`, pre-re-key) and **no
re-key landed during this sprint, so no part of any movement above is attributable to one.**

---

## §5 — WHAT IS NOT DONE, NAMED

1. ❌ **A retrieval scoped to one document does not exist and is the missing capability.** §2.2.
   Both search services take `{query, tier?, limit?, corpora?, excludeCorpora?}`. Neither can be
   asked for "the best passage inside `pwdata-debates:debates2024-11-29d`".
2. ❌ **The chunk grain cannot be measured as the brief asks it.** No served surface returns a ranked
   chunk list; `vector-serve` collapses to sections inside the service. It is measured as the dense
   ARM instead, and `lib/lex/grain.ts` records why, so nobody re-derives it. ⚠ It would also not be
   worth a deploy: because the collapse is best-per-section, chunk-grain recall is bounded above by
   the dense arm's section-grain recall and can only be lower.
3. ❌ **The seven orphaned collections are not fixed and `et-decisions`' partial orphaning is not
   fixed.** Ingest's, reported with the instrument to verify it.
4. ❌ **`lda-commonsoralquestions`' 69,529 blank titles are not fixed.** Ingest's.
5. ❌ **The two treaty collections are still unreachable.** Now named in a register with what blocks
   the fix, which is different from being fixed and is said as such.
6. ❌ **`LEX_SEARCH_GRAIN` is not on for anything.** §4.
7. ❌ **No recall figure published here supersedes a published one except by explicit statement in
   §4.2.** In particular S16's 32-failure autopsy is **not** recounted: this sprint measures a
   different property.

---

## §6 — DECISIONS FOR CHARLIE

*Numbered, each with a recommendation and the consequence of each option. **Q1 gates the value of
everything in §2.***

---

### Q1 ⚠⚠ — A RETRIEVAL SCOPED TO ONE DOCUMENT. THE GATE.

**The finding.** The document grain finds the right document for 41 of 65 questions against the
section grain's 23, and then **shows the wrong passage**: 22 of 65, debates 0 of 11. For **11 of the
18 questions it rescues, the answer section is not in the top 500 of its own collection** — it was
never retrieved, so no re-ranking, snippet selector or display change can reach it. The second step
has to be a real retrieval **inside** the document.

**And it is much cheaper than I expected, because the column is already there.**
`build-fts-index.ts` writes `parentDocId` into the Lance schema and **`fts-serve` returns it on every
hit today** (verified live, 2026-09-09). So:

| | change | reindex? |
|---|---|---|
| **sparse** | one predicate in `fts-core.ts::ftsWhere` — `parentDocId = …` | **No** |
| **dense** | `corpus_vec` has no `parentDocId`, but it has `sectionId`; an `sectionId IN (…)` prefilter does the same job from a list fetched out of Neon | **No** |
| **the caller** | after document-grain retrieval, one extra call per shown document (or per shown document above the fold) | — |

⚠⚠ **THE ONE TRAP, AND IT IS A SILENT ONE.** A **double-quoted column name in a Lance predicate
matches NOTHING and raises nothing** — this project has already had a `delete()` report success
having removed 0 rows, and be 70× faster because it pruned everything. `parentDocId` is camelCase, so
whether it needs quoting is exactly the case that fails silently. **The predicate must ship with a
control that returns a known non-empty set**, not with a smoke test that returns *something*.

⚠ It touches `scripts/ingest/search/`, which **auto-deploys `vector-serve`**. It must be pushed when
nothing is measuring.

- **Recommended: BUILD IT.** ~half a day plus a redeploy and a before/after on the 65 questions.
  It is the only option that converts §2's +18 into something a user receives.
- *Do nothing:* the document grain stays a number in a report. `LEX_SEARCH_GRAIN` stays off for ever,
  because turning it on trades finding for showing (§4).
- *Do it for the sparse leg only:* cheaper by half, and it would still leave the debates case — where
  the dense leg is the one that finds the day — half-served.

---

### Q2 — SHOULD `LEX_SEARCH_GRAIN` BE TURNED ON FOR COMMITTEES ALONE, NOW?

**The finding.** Committees is the one collection where the document's best retrieved section IS the
answer: on the dense arm, **7 documents found and 7 right passages shown**, against 4 at section
grain. A committee report is 6.8 substantive sections, so its best-scoring section is usually the one
that answers. Everywhere else the passage is wrong (§2.2).

- **Recommended: NO, not yet — wait for Q1.** The gain is +3 of 10 on one collection, measured
  scoped; through the gateway committees moves 3 → 3 at section grain and the document number goes
  **down** (4 → 3). ⚠ That difference is within the noise floor in §4.1, so I cannot show a real
  gain through the product, and turning a flag on for a gain I cannot demonstrate is how a
  configuration accumulates.
- *Turn it on for `committees-reports`:* one env var, reversible, and it would need a fresh
  before/after because the interleave couples the streams (§4.2).

---

### Q3 — TREATY QUESTIONS. THE GATE ON §1.2's DURABLE FIX.

**The finding.** `uk-treaties` (3,264) and `tax-treaties-dta` (324) can be returned by no query, and
`uk-treaties-fcdo` (23,372, the same material) can, because it happens to be display-typed `DEBATE`.
The durable fix — option A, a routing attribute independent of display type — is about a day and
needs no reindex. **It cannot ship, because the validated set has ZERO treaty questions and a change
to what the debates stream returns would have nothing to score against.** `corpus-map.ts` recorded
that blocker on 21 August; it has not moved.

- **Recommended: write 5–8 treaty questions with keys, the way the debates and costing sets were
  written.** ⚠ The generator that refuses to write a set whose keys are unanswerable already exists
  (`s18-costing-questions.ts`); the same discipline should apply.
- *Fix the two collections by hand instead:* two lines, and **the brief is right that it is not an
  answer** — it leaves a mechanism in which a rendering label decides what can be found, to bite
  again on the next collection.
- *Do nothing:* 3,588 sections stay unreachable. They are now **named in a register with what blocks
  them**, and a check fails if a third collection joins them unnamed, so nothing is silent.

---

### Q4 — THE ORPHANED COLLECTIONS. FOR INGEST, AND IT IS USER-VISIBLE TODAY.

**The finding.** Seven collections are in the served index, admitted by real streams, and hold zero
rows in `corpus_sections`; `et-decisions` hydrates 12 of 20. **The product returns a card titled with
the literal collection name, with no citation, date or link** — measured through the real adapter.

- **Recommended, and it is two things.** (1) **Ingest:** a purge or re-key of `corpus_sections` must
  delete the same rows from `corpus_fts` and `corpus_vec`; the reconciliation instrument now exists
  (`audit:s19-reach`'s `hydrates` column — ids taken **from the index** and looked up in the
  database, in that direction, because asking the database first can never find a row it does not
  have). (2) **Search, one line, today if you want it:** the adapter can drop a hit whose hydrate
  missed. ⚠ I have NOT done that, deliberately: it would hide the defect from the only instrument
  that can see it, and a silently-shorter result list is the shape this project keeps paying for.
- *Do nothing:* Lex can cite a document that cannot be opened.

---

### Q5 — THE CASELAW UNIT, WHICH NO GRAIN SETTING CAN REACH.

**The finding.** **84.2% of what the sparse arm returns for caselaw is over 1,500 words; 96.7% on the
dense arm.** `tna-caselaw` holds 74,896 sections over 74,896 judgments — **one section per
judgment**, median 17,650 words on the sampled rows. A "result" is an entire High Court judgment.
That is the unit wrong in the other direction, and it is not fixable by any setting because **no
finer grain is stored**.

- **Recommended: scope it, do not decide it here.** Sectioning judgments is an INGEST change (it
  changes ids, and GRAPH 5's 1,288,630 citation edges are keyed to them). GRAPH 5 established that
  71.1% of case-law references are already anchored to the judge's paragraph — **so the paragraph
  structure exists in the Akoma Ntoso and is being discarded at ingest.** That is the cheap version
  of this and it belongs in an ingest brief.
- *Do nothing:* caselaw recall stays 3–5 of 6, which is not bad — the cost is what a user is handed.

---

### Q6 — DOES `LEX_ROUTER_STREAMS_V2` DESERVE RECONSIDERING ON THE UNIT EVIDENCE?

**The finding, which is new.** Scoped to their own collection, impact assessments reach **6 of 9 at
document grain (sparse) and 9 of 9 (dense)**. Through the real gateway they reach **2 of 9, and the
document grain adds nothing at all (2 → 2)**. The sections never reach the merged list: 18,759
sections competing for `legislation`'s interleave slots against a 2.09M-section tier. **That is the
V2 argument — a slot of their own — measured on a new axis and much more sharply than S8 could put
it, because we now know the content IS retrievable at 9 of 9 when it gets a fair race.**

- **Recommended: re-measure V2 with the grain evidence in hand, do not flip it.** ⚠ S8's cost
  reasoning stands (five streams become eight against a `vector-serve` concurrency cap) and S18's
  finding stands (`ROUTER_STREAMS_V2` on sends 8 of 10 impact-assessment questions to that stream
  **alone** — it starves everything else). What has changed is that we can now say what the ceiling
  is: **9 of 9.**
- *Flip it:* untested against this evidence, and S18 measured a real cost to other questions.
- *Do nothing:* impact assessments stay at 2 of 9 through the product while the corpus can answer 9.
