# SEARCH S9 — THE STATISTICS CATALOGUE

**By:** CC-Search · **19 August 2026, 22:22 UTC** · Executes `BRIEF_SEARCH_S9.md` §1–§6
**Checks:** `check:s9-catalogue` **30/30 assertions, 9/9 breaks fired** · `tsc` clean
**Cost:** ~£0.02 — 60 router calls at Gemini Flash rates across three measurement runs. No
embedding, no index build, no heavy job.

---

## THE SHORT VERSION

The statistics catalogue is built, routed and flag-gated. **The router selects it on 10 of 10
questions that want a number and on 0 of 10 that want a law, a debate or a committee finding** —
the negative half being the one §5 says matters more. The licence register now *gates* retrieval
rather than being recorded beside it: 2,329 series (40.6%) are filtered out before scoring when
the use context forbids them.

**Two of the brief's three stated residuals were wrong, and one of my own predictions was wrong in
both directions.** `sourceSeriesId` is not null on a large minority of rows — it is null on **none**
of them. The per-vintage licence restriction the brief says cannot be expressed **can** be, and
the column already exists. My prediction that the router would miss one positive was wrong (it
missed none) and my prediction of two false positives was wrong (there were none).

**The honest weakness is retrieval quality, and it was only visible because the probes ran.** The
first build ranked *Unemployment rate* top for a question about the Gini index, and — after a
router-prompt fix — returned five plausible UK series for the NHS-waiting-list question the store
**cannot answer**. Both are fixed and both are guarded. Two of ten probe questions still return a
wrong top hit, and the mechanism is named in §A4.

---

# PART A — THE AUDIT (§3), WHICH CAME FIRST

Every number below is a `SELECT` against the live `scrutinise-stats` Neon database
(`ep-gentle-waterfall-zab5zcwv`, database `neondb`), read at **2026-08-19 21:50 UTC** by
`scripts/ingest/search/stats-catalogue-audit.ts`. Rows, not a manifest, per §3.

## A1 — What is actually in the store (§3.1)

**10 datasets · 5,733 series · 80,443 observations · 126 COFOG codes.**

| publisher | datasets | series | observations | span |
|---|---|---|---|---|
| IMF | 1 | 2,329 | 40,351 | 2007–2025 |
| OBR | 2 | 2,838 | 22,925 | 1900-01 – 2030-31 |
| World Bank | 1 | 257 | 11,235 | 1960–2025 |
| ONS | 2 | 44 | 4,202 | 1948 – 2026 Q2 |
| HMRC | 2 | 76 | 1,293 | 2005-06 – 2025 to 2026 |
| HM Treasury (PESA) | 1 | 189 | 437 | 2020-21 – 2024-25 |
| **OECD** | 1 | **0** | **0** | — |

Three things worth reading off that table:

1. ⚠ **The OECD dataset is registered and empty.** `oecd-cofog-expenditure` exists as a
   `stat_dataset` row with a verified licence and **no series and no observations**. It is
   therefore invisible to the catalogue (which requires `count(observations) > 0`) and would
   silently become visible the moment anyone ingests it. Flagged to the stats thread, not
   touched (§6 — not mine to edit).
2. ⚠ **Two publishers are 90% of the store by series.** IMF and OBR are 5,167 of 5,733. The UK
   "spine" everyone will actually ask about — ONS, HMRC, PESA — is **309 series, 5.4%**.
3. ✅ **No series has zero observations.** A catalogue entry that leads nowhere would be the
   worst possible result for this feature, and there are none.

**Geography:** 3,279 series are `GB`; the rest spread across 21 comparator countries (IT/DK/ES/FI/
CH/NO/NL/PL/DE at 132 each, down to NZ at 31). **Units:** `PERCENT_GDP` 2,020 · `GBP_BILLION`
1,992 · `PERCENT_TOTAL_EXPENDITURE` 1,146 · `GBP_MILLION` 236 · nine others.

## A2 — The join key (§3.2): ⚠⚠ THE BRIEF'S RESIDUAL IS REFUTED

**`seriesKey` exists, is enforced, and is fully populated.** Read from `information_schema` and
`pg_index`, not from the schema file:

- column `seriesKey text NOT NULL`, unique index `stat_series_seriesKey_key`;
- **5,733 of 5,733 populated · 5,733 distinct · 0 not matching `^[0-9a-f]{64}$`.**

**⚠⚠ `sourceSeriesId` IS NULL ON ZERO ROWS — NOT ON "A LARGE MINORITY".** The brief states, and
`series-key.ts`'s own doc comment still states, that it is "null for 2,925 of 3,404". That was
true on 4 August. It is not true now: **5,733 of 5,733 are populated, 0.0% null.** The ingest side
backfilled it (`deriveSourceSeriesId`) at some point between then and now.

**But the conclusion the brief drew from it still holds, for a different reason — so do not
"simplify" the key.** Two measurements:

| | distinct | collisions |
|---|---|---|
| natural key *without* `seriesLabel` | 4,427 of 5,733 | **1,306 series (22.8%) collide** |
| natural key *with* `seriesLabel` | 5,733 of 5,733 | none |
| `(datasetId, sourceSeriesId)` | 5,620 of 5,733 | **113 collide** |

So **neither the natural key nor the now-populated `sourceSeriesId` uniquely identifies a series.**
`seriesKey` is still the only unique stable handle, and `seriesLabel` still has to be in it. The
worst collisions show why: 40 wellbeing series share one tuple (*United Kingdom / Anxiety /
Average* vs *…/ Worthwhile / Very…*), and 24 PESA departmental totals share another (*Business and
Trade — total* vs *Work and Pensions — total*). The distinguishing detail — which department, which
wellbeing band — lives only in the label.

⚠ **And 79% of `sourceSeriesId` is synthesised, not sourced.** Values like
`derived:£PSCR (2)|March 2015` and `derived:Wine|November 2025` are our own slugs. The field is no
longer null; it is also not provenance. **The catalogue therefore stores and returns `seriesKey`
and nothing else as a handle.**

## A3 — The licence register (§3.3): load-bearing, and now enforced

| licence | datasets | series | commercial use |
|---|---|---|---|
| Open Government Licence v3.0 | 7 | 3,147 | permitted |
| **IMF Copyright and Usage** | 1 | **2,329** | ⚠ **EXCLUDED — written permission required** |
| CC BY 4.0 (World Bank) | 1 | 257 | permitted |
| OECD Terms §3 | 1 | 0 | permitted |

**Effective class per series** (per-series override `??` dataset): **3,404 permitted (59.4%) ·
2,329 restricted (40.6%)**. By observation the split is starker still: **40,092 vs 40,351 — the
restricted half is 50.2% of all the data in the store.** This is not a corner case, and a licence
that was recorded but not enforced would have leaked half the store into a commercial context.

Every dataset's `licenceVerifiedAt` is 2026-08-04 — fifteen days old, all seven verified on one
day. Not stale yet; worth a re-check cadence, and it is D-4 below.

**⚠⚠ THE BRIEF'S SECOND RESIDUAL IS ALSO WRONG, IN OUR FAVOUR.** §3.2 says licence terms "are
recorded per dataset and **cannot** express a per-vintage restriction". `StatSeries` has carried a
nullable per-series `commercialUseExcluded` override since 4 August, added for exactly the OECD
1-July-2024 terms change the brief has in mind, and it is **in use**: 2,329 rows carry an explicit
`true`, 3,404 inherit. So a per-*series* restriction is fully expressible today, and because
`forecastVintage` is a series-level dimension, **a per-vintage restriction on OBR forecast rounds
is expressible too.**

⚠ What remains genuinely inexpressible is narrower and should be stated precisely: a restriction
that changes **part-way through one series' own time range** ("this series' pre-2024 observations
are non-commercial") cannot be recorded, because there is no per-observation licence column. That
is the real residual, and it is much smaller than the brief's version.

## A4 — Derived headings (§3.4): yes, and they are required, not optional

**The question §3.4 asks is whether the catalogue can carry discoverable headings that are not raw
source columns. It can, and the audit shows the catalogue is barely usable without them.**

| the heading a user needs | is it a column? | how the catalogue gets it |
|---|---|---|
| COFOG function **name** ("Health") | ❌ only the code `07` | ✅ join to `stat_cofog_function` |
| geography **name** ("United Kingdom") | ❌ only `GB` | ✅ derived map |
| time **span** | ❌ | ✅ `min`/`max` over observations |
| **department** | ❌ **no column at all** | ⚠ free text inside `seriesLabel` |
| plain-English **measure gloss** | ❌ | ⚠ partial — see below |

The forcing evidence:

- ⚠⚠ **2,807 of 5,733 series (49%) are labelled with the publisher's own column codes.** Real
  labels: `PTT (November 2022)`, `NICS (October 2018)`, `PCDebtint (March 2022)`,
  `sa_nic2_4`, `nominal_gdp_centred_end_march_billion`. **Nobody types "pcdebtint".**
- ⚠ **PESA's departmental series identify the function by a bare number** — `Local Government — 03`,
  `Health and Social Care — 07`. Nothing else in the row says 03 is public order and safety. The
  COFOG name join is the only thing that makes those 103 series findable by subject.
- ⚠ **There is no `department` column.** For `dept_expenditure_by_function` the department is the
  text before the em-dash in the label. The catalogue indexes the label so it is *searchable*, but
  it is not a field and cannot be filtered on. Recorded as a change to request (D-3).

**On the gloss, and the line I did not cross.** Thirteen measure codes are glossed
(`psnb` → "public sector net borrowing deficit", `tme` → "total managed expenditure spending", …).
**Every one is corroborated from the store's own data** — `obr-psf-databank` carries the same
quantities under long snake_case names (`public_sector_net_borrowing_psnb`), so the databank
glosses the historical-forecast short codes. **Codes with no corroborating long name in the store
are deliberately absent rather than guessed.** An invented expansion puts words into a result that
the source never used, which is the same failure class as an invented figure. That leaves most of
the 49% unglossed and it is named as not-done below.

---

# PART B — WHAT WAS BUILT (§4)

## B1 — Where it sits

`scrutinise-web/lib/lex/stats-catalogue.ts` — an in-process inverted index over the catalogue
headings, refreshed on a 15-minute TTL from one SQL read.

**It is in the same discovery mechanism as everything else, as §4 requires:** the router selects
`statistics` exactly as it selects `legislation` or `caselaw`, through the same LLM call, the same
schema and the same flag mechanism (`flagEnabled`, never a bare `=== 'true'`).

**Two deliberate departures, both stated rather than smuggled:**

1. ⚠ **The payload travels on `GatewayResult.statistics`, not in `results`.** §4 requires "a series
   descriptor, not a document", and the only way to guarantee that is to keep it out of the
   `SearchResult[]` a caller may quote as evidence. This is the same structural separation that
   keeps `LegacySearchResult` and `EvidenceResult` apart.
2. ⚠ **There is no `StreamScope` for it, on purpose.** A scope describes a slice of the corpus
   index; the catalogue is a different database with no corpus rows. Adding a scope would put a row
   in `corpus-reachability.ts`'s matrix that no collection could ever satisfy.

**Why an in-process index and not Postgres FTS.** Two reasons, both load-bearing: the stats schema
is another thread's to edit (§6), and **half the headings this index needs are not columns** (A4).
Cost is 5,733 rows ≈ 700 KB of heading text, built in ~350–1,700 ms.

## B2 — The never-claim rule, at the boundary

`SeriesDescriptor` has **no field a value could travel in.** `assertNoObservationValues()` re-checks
that on **every call**, not only in tests, because a structural guarantee nothing re-checks is a
comment. `stat_observation.value` appears nowhere in the catalogue SQL — the rule expressed as a
query.

Watched failing: injecting `latestValue` and injecting `observations` both throw
(`check:s9-catalogue` breaks 1–2).

## B3 — The licence gate, structural rather than advisory

The filter runs **on the row set, before scoring**. A restricted series is not scored, not ranked,
and not removed from a list afterwards — it is never a candidate. `searchCatalogue` **requires** an
explicit `useContext`; there is no default parameter, so a caller that forgets does not compile.
An unrecognised `STATS_USE_CONTEXT` falls to the *restrictive* branch with a warning.

Proved, not assumed. A query aimed at the restricted collection:

| | restricted series returned | searched over | withheld |
|---|---|---|---|
| `non-commercial` | **10** | 5,733 | 0 |
| `commercial` | **0** | 3,404 | **2,329** |

⚠ **The break that matters:** "none in the commercial arm" would also pass if the query never
matched a restricted series at all. Break 3 asserts the permissive arm *does* reach 10 of them, so
the assertion is demonstrably not vacuous. IDF is recomputed over the permitted set, so a visible
row is never ranked by a statistic drawn from rows the caller cannot see.

## B4 — Two defects the measurement found, and the fixes

**⚠⚠ DEFECT 1 — collection-level fields swamped row identity.** Unweighted, `datasetTitle` and
`source` are identical on every row of a dataset, so they move all those rows together while
telling them apart not at all. Measured symptom:

> "income inequality Gini coefficient ONS time series" → top hit **Unemployment rate**

`ons` matched the dataset title *and* the source on all 44 ONS rows; `gini` matched one row once.
Fixed with field weights — `label` 3.0, `measure` 2.5, derived `gloss`/`cofog` 2.0, and
`dataset`/`source` damped to **0.4**. Guarded, with a break that fires only while the damping is
actually deciding something.

**⚠⚠ DEFECT 2 — THE NEGATIVE CONTROL BROKE, AND IT WAS MY OWN FIX THAT BROKE IT.** After A4's
probes I improved the router prompt to name the geography. The tailored query became
`UK NHS waiting list size number patients`, and the catalogue returned **five UK series** for a
question the store cannot answer at all. Cause, exactly: World Bank and IMF labels *begin with the
country name* ("United Kingdom — Life expectancy at birth"), so `uk` matches the **label** of
thousands of rows at full weight. One meaningless token manufactured five plausible hits.

**This is the worst failure this stream can have** — a statistics feature that answers "no" badly
is worse than one that answers nothing, because the user cannot tell the difference. Fixed with two
structural floors:

- **an identity match is required** — matching only the container (`source`, `dataset`,
  `geography`, `unit`, `span`) is not a hit;
- **a discriminating term is required** — at least one matched token must appear in ≤10% of the
  searched population, on an identity heading. `uk` matches ~60% of rows; `gini` matches 0.6%.

Q60 returns **0 series** again, and the floor logs what it dropped rather than dropping silently.

---

# PART C — THE NUMBERS (§5), AND WHAT EACH IS A PERCENTAGE OF

## ⚠⚠ READ THIS FIRST

**There is no gold set for statistics and none of these is a recall figure.** Q51–Q60 in
`GOLD_CANDIDATES_S8.md` are questions *I* wrote and are marked **UNVALIDATED** pending Charlie.
Scoring quality against them would be the exact failure that has left committees unevaluable since
S7. What follows is **behavioural**.

**The prediction was recorded in the script before the first run** and is reproduced verbatim in
`measure-s9-stats-stream.ts`'s header.

## C1 — Does it fire when a quantity is wanted? **10/10**

Of the ten questions (Q51–Q60), *all ten* routed to `statistics`.

⚠ **PREDICTION REFUTED.** I predicted **9/10**, and named Q55 ("has anyone measured whether people
in the UK are actually happier") as the miss on the grounds that it reads emotionally rather than
quantitatively. The router selected it and wrote `UK happiness life satisfaction`, which is a
better query than my reasoning deserved. The finding is that the router reads "has anyone measured"
as the quantitative marker it literally is; I was modelling the model as vaguer than it is.

⚠ **A second, unpredicted behaviour, and it is a decision for Charlie (D-1).** On all ten, the
router selected `statistics` **and nothing else** — no legislation, no debates. A user asking "how
much does the UK spend on health" therefore gets series descriptors and **zero corpus documents**.
For a pure "does a series exist" question that is arguably right; for a policy question wearing a
numeric hat it is a loss.

## C2 — Does it stay quiet on legal and evidential questions? **0/10 false positives**

The ten S5 questions — the same set S4, S5 and S8 used, so this is comparable rather than chosen to
flatter. **None** selected `statistics`, including the two I named in advance as expected false
positives (sewage discharge; universal credit rollout).

⚠ **PREDICTION REFUTED, in the good direction.** I predicted 2/10. The negative half of the prompt
— stated first, at length, with the explicit "'Should sewage discharges be banned' is a policy
question; 'How much sewage is discharged' is a request for a series" contrast — appears to be doing
real work. **This is the number §5 says matters most, and it is the best it can be.**

⚠ At n=1 per question with one LLM call each, 0/10 is consistent with a true false-positive rate
anywhere up to roughly 25%. It is not proof of zero.

## C3 — Latency

| | |
|---|---|
| catalogue retrieval, warm index, n=10 | **p50 3 ms · p95 7 ms** |
| cold index build (once per process, or per 15-min TTL expiry) | **1,360–1,706 ms** |
| added wall-clock on a routed query | **≈0 ms** — it runs concurrently with corpus retrieval against a different database, and 3 ms hides inside a p50 of ~3,900 ms |

⚠ The cold build is the real cost and it lands on **one unlucky user per process per 15 minutes**.
On Vercel's serverless model that is more often than it sounds. D-5.

## C4 — Regression on the S5 ten, flag OFF and ON: ⚠ THE A/B COULD NOT ANSWER IT

Run with the live FTS service, alternating arms per question:

- corpus results identical on **1 of 10**; corpus stream selection identical on **7 of 10**;
- latency p50 4,792 → 3,861 ms, p95 11,706 → 10,494 ms — i.e. the flag-ON arm measured **faster**.

**Both of those are noise, and reporting either as a result would be wrong.** The router rewrites
every stream's query with a *fresh LLM call in each arm*, so the arms differ before the flag does.
An "ON is 931 ms faster" claim is not credible and is not made. My prediction D said this
non-determinism would be the main difficulty in reading this arm; that part held.

⚠ **An earlier run of the same arm was worse than useless and is reported because it nearly wasn't
caught:** `FTS_SEARCH_URL` is unset in the local `.env`, so every corpus search returned **0
results in both arms** and the harness printed *"corpus results identical on 10/10"*. That is a
**saturated metric**, not a null result — the exact trap SEARCH_STRATEGY v5 §1 names. The rerun
points at `https://fts-serve-production.up.railway.app`, confirmed live (`/stats` → 200, served=28).

**So the question was answered deterministically instead, and the answer is stronger than the A/B
could have been.** Holding the route fixed and adding only the `statistics` key:

> **`["guidance","legislation"]` vs `["guidance","legislation"]` — 36 results, byte-identical
> `perStream` both ways.**

No LLM, no network variance, no arm. `runRoutedSearch` matches route keys against `STREAM_SCOPES`
and there is no scope named `statistics`, so the corpus path is the same code either way. That is a
guarantee rather than a measurement, and it is now `check:s9-catalogue` assertions 22–23.

## C5 — Retrieval quality: **8 of 10 plausible top hits — and this is NOT recall**

On my own unvalidated questions, the top hit is the right series family on 8 of 10 (Q60's correct
answer being *nothing*). **Do not quote this as a quality figure.** It is reported because the two
failures name a real mechanism:

| | query the router wrote | top hit | |
|---|---|---|---|
| Q53 | `UK health spending international comparison` | *United Kingdom — GDP per capita, PPP (current **international** $)* | ❌ |
| Q59 | `UK income inequality` | *income_tax* | ❌ |

⚠ **The mechanism: a catalogue heading is ~5 words, so a single incidental match dominates.**
`international` is a literal token in the WDI label. `income` is rarer in this store (df 12) than
`gini` (df 21), so *income_tax* outranks the Gini index for a query about income inequality — and
the concept "income inequality" appears nowhere in the World Bank's own label, which is just
"Gini index". Three more of the same shape were fixed by shortening the query instruction:
`Office Budget Responsibility` matched *Home Office*; `each year` matched *Life expectancy at birth
(years)*.

**BM25 over five-word titles is a different retrieval problem from BM25 over documents**, and the
router's generic six-to-twelve-word instruction is wrong for it. Shortening the statistics query to
three-to-six words fixed three of five failures. The remaining two need either a curated gloss
table or dense retrieval over headings — D-2.

---

# PART D — DECISIONS FOR CHARLIE

**D-1. Should the router be allowed to select `statistics` ALONE?**
Today it does, on all ten probes: a question about health spending returns series and no documents.
- **(a) Leave it** — the stream fires only on genuinely quantitative questions (0/10 false
  positives), and for those the corpus adds little. *Consequence:* a user whose question was
  quantitative *and* policy-shaped loses the legislation and committee context.
- **(b) Always pair it with at least one corpus stream.** *Consequence:* one extra retrieval call
  on every stats query, and it dilutes the clean separation C2 just measured.
- ✅ **Recommendation: (a) for now, and re-open it after the Q51–Q60 validation pass** — the
  evidence for (b) would be a validated question where the missing corpus context mattered, and no
  such question exists yet.

**D-2. How should the 49% of code-labelled series be made findable?**
- **(a) Curated gloss table**, ~40 entries, validated against OBR/HMRC documentation by a human.
  *Consequence:* cheap, precise, and it needs someone who can confirm `PTT` and `NICS`. I will not
  write it from the model's knowledge — that is an invented figure by another name.
- **(b) Dense retrieval over the headings.** *Consequence:* the embeddings exist and the headings
  are tiny, but it is a second system on a side-rail and the gold set cannot yet reward it.
- ✅ **Recommendation: (a), after validation.** It is hours of work and it fixes half the catalogue.

**D-3. Two changes to request from the stats thread** (not made — §6 forbids editing their schema):
- a `department` column on `stat_series`, currently free text inside the label;
- the empty `oecd-cofog-expenditure` dataset either populated or removed, so a registered-but-empty
  dataset cannot silently appear in the catalogue on someone else's ingest run.
- ✅ **Recommendation: raise both; neither blocks anything today.**

**D-4. Licence re-verification cadence.** All ten datasets were verified on one day, 4 Aug 2026.
✅ **Recommendation: a quarterly re-check, and an alert if `licenceVerifiedAt` passes 180 days** —
the IMF terms are the ones that would hurt, and they cover 50.2% of the observations.

**D-5. `STATS_CATALOGUE_TTL_MS`.** Default 15 minutes; the cold build costs ~1.5 s to one request
per process per expiry. ✅ **Recommendation: leave it.** Raising it to an hour trades freshness for
a saving that only matters on a cold serverless container, which a longer TTL does not prevent.

## ▶ WHAT TO SET IN VERCEL (unreadable from here — SAML, `docs/CLAUDE.md` §19)

| variable | recommended | why |
|---|---|---|
| `LEX_STATS_STREAM` | **leave unset / off** | The questions behind it are UNVALIDATED. Flip after the Q51–Q60 pass. |
| `STATS_USE_CONTEXT` | `non-commercial` | scrutinise.org is a not-for-profit; this is also the default, but setting it explicitly means the resolution is a decision on the record rather than a fallback. **Set it to `commercial` and 2,329 IMF series disappear from search — which is correct, and would otherwise be a licence breach.** |
| `STATS_DATABASE_URL` | must be set | Without it the stream reports *unavailable*, which Lex renders as "could not consult", not as "no series exists". |

## ▶ WHAT TO CLICK, TO VERIFY IT YOURSELF

⚠ **No live verification was possible from here** — no localhost host permission and no Clerk
session on production (`docs/CLAUDE.md` §20 · the browser-cannot-reach-localhost constraint). None
is claimed. What you can do once `LEX_STATS_STREAM` is on:

1. **`/admin/lex-general`** — ask **"how much does the UK government spend on health"**. Expect a
   series descriptor block: PESA, GBP_MILLION, 2020-21…2024-25, Open Government Licence. ⚠ **Expect
   NO figure.** A number appearing there is a defect — report it, do not enjoy it.
2. Ask **"how many people are on an NHS waiting list"**. Expect an explicit *we do not hold that*,
   naming what the store does hold. ⚠ **A helpful-looking answer here is the failure**, and it is
   the one that broke mid-sprint (B4).
3. Ask **"what does the Equality Act say about public sector duties"**. Expect **no statistics at
   all** — that is C2 working.
4. Check the function logs for `[search-gateway] statistics catalogue` — it prints `licenceWithheld`
   on every call, including zero. If that line never appears, the flag is not in effect.

---

# PART E — WHAT IS **NOT** DONE, NAMED

- ❌ **Nothing here is validated.** Q51–Q60 are UNVALIDATED. The 10/10, the 0/10 and the 8/10 are
  behavioural or self-scored. **No recall figure for statistics exists and none is claimed.**
- ❌ **Most of the 49% code-labelled series are still unglossed** (13 of ~40 codes). D-2.
- ❌ **Two of ten probe top hits are wrong** (Q53, Q59), mechanism named in C5, unfixed.
- ❌ **The A/B regression arm is not readable at n=1 per arm.** Replaced by a deterministic proof,
  which answers a narrower question — "the corpus path is untouched" — completely.
- ❌ **`salvageRoute` does not recover `statistics` from a truncated router payload.** It matches
  only the base five, unchanged from S8. Deliberate: a truncation should cost the side-rail before
  it costs `legislation`. Worth knowing, not worth fixing.
- ❌ **No `department` field, no per-observation licence, no OECD data.** A1, A3, D-3.
- ❌ **The values path is unscored.** These questions establish that a series is *discoverable*.
  Whether the number the exact call returns is right is a different instrument and does not exist.
- ❌ **`FTS_SEARCH_URL` is still unset in the local `.env`.** Every future local recall harness will
  silently measure zero unless it is passed explicitly. Worth fixing in the env file, not by me
  mid-sprint.

---

# PART F — §1, AND THE ORDER IT HAPPENED IN

§1 asked for `GOLD_CANDIDATES_S8.md` to be made reviewable in one pass, and warned about colliding
with CC-Ingest's case-law insertion. **The order, stated as the brief requires:**

1. **22:54 UTC — CC-Ingest wrote first.** All ten case-law extracts were in and the file was stable
   before I touched it (checked three times over 12 seconds).
2. **23:0x UTC — I restructured on top**, mechanically and with assertions that refuse to write on
   any unexpected count. **CC-Ingest's ten blockquotes are byte-for-byte identical afterwards**,
   verified by diff.

Delivered: a single running number **Q1–Q60**, the archetype spelled out at every question, a
one-line **VERDICT** slot, a progress index, and Q51–Q60 for statistics. **No question, key or
rationale was reworded** — the review is Charlie's.

## ⚠⚠ AND THE RESTRUCTURE SURFACED THE SPRINT'S SHARPEST FINDING

Reading CC-Ingest's extracts against the questions they were inserted under: **four of the ten
case-law keys are WRONG.**

| | asks about | the citation actually is |
|---|---|---|
| Q11 | the public sector equality duty | `[2015] UKSC 21` = **R (Evans) v Attorney General** — the "black spider memos" FOI case |
| Q17 | whether benefit caps discriminate | the **same** citation |
| Q18 | when a public authority owes a duty of care | `[2018] UKSC 22` = **Newcastle upon Tyne Hospitals NHS FT v Haywood** — an employment notice case |
| Q19 | the legality of a climate-targets policy | `[2020] UKSC 12` = **WM Morrison Supermarkets v Various Claimants** — vicarious liability for a data breach |

Six are right (Miller, Uber, Cheshire West, UNISON, McCaughey, and the Phillips control).

**A 40% error rate on keys asserted from outside knowledge is the strongest evidence this file has
produced**, and it is precisely the "implementer writing its own exam" failure that
SEARCH_STRATEGY v5 §5.2 names as the binding constraint on everything. The four are left in place,
marked, rather than deleted — deleting them would delete the finding. They cannot be re-keyed from
here, because nothing makes case law subject-searchable.

⚠ It also means every quality number this project has reported against case-law questions should be
treated as provisional until the whole set has been through Charlie's pass.
