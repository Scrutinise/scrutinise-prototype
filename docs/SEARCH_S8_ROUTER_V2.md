# SEARCH S8 §4 — ROUTER STREAMS V2, MEASURED

*Generated 2026-08-19T09:38:49.697Z. Both arms in ONE process, alternating per question,*
*against the same warm services. `LEX_ROUTER_STREAMS_V2` stays OFF; this is a recommendation.*

```
[config] fts=fts-serve-production.up.railway.app vector=vector-serve-production.up.railway.app streams=legislation,caselaw,guidance router=ON fully-configured
[engagement] fts+463  vector+254
```

## The gate: no recall regression on the questions the old router already served

| | recall@20 |
|---|---:|
| five streams (today) | **41.1%** |
| eight streams (V2) | **41.1%** |
| difference | **-0.0pp** |

Scored on **31** gold questions. Improved on 2, regressed on 3.

⚠⚠ **THE GATE IS NOT MET.** These questions lost recall: C2 (66.7% → 33.3%), F2 (100.0% → 50.0%), B6 (16.7% → 0.0%).

## Selection — is a new stream ever chosen?

| stream | chosen on | of |
|---|---:|---:|
| impact-assessments | 1 | 44 |
| consultations | 6 | 44 |
| explanatory | 7 | 44 |

### The three purpose-built selection probes

| probe | wanted | streams chosen (V2) | chosen? |
|---|---|---|---|
| what did the government predict this policy would cost | `impact-assessments` | — | ❌ |
| what did respondents say in the consultation on leasehold reform | `consultations` | consultations | ✅ |
| what was the purpose of the Data Protection Act 2018 according to its explanatory notes | `explanatory` | explanatory | ✅ |

⚠ These three questions were written for this measurement and have **no answer key**. They test
whether the router CHOOSES the right stream when the question is squarely about what that stream
holds. They do not and cannot show that the answer got better.

## Displacement — did a new stream push out one that was serving the answer?

| question | streams present at five, absent at eight |
|---|---|
| A3 (gold) | debates, committees, caselaw, guidance |
| C5 (gold) | caselaw |
| D4 (gold) | caselaw |
| E1 (gold) | legislation, debates, committees |
| E3 (gold) | legislation, caselaw, guidance |
| E4 (gold) | caselaw |
| E5 (gold) | debates, committees, guidance |
| F2 (gold) | legislation, guidance |
| F5 (gold) | guidance |
| S5-6 (s5) | debates, committees |
| S5-10 (s5) | guidance |
| V2-1 (v2-probe) | debates, committees, guidance |
| V2-2 (v2-probe) | committees, guidance |
| V2-3 (v2-probe) | legislation |

## Latency

| | p50 | p95 | mean |
|---|---:|---:|---:|
| five streams | 8401 ms | 14215 ms | 9246 ms |
| eight streams | 8169 ms | 15025 ms | 8655 ms |
| delta | -232 ms | 810 ms | -591 ms |

⚠ A stream is a retrieval call per query. Eight streams against `LEX_STREAM_CONCURRENCY=3` is
three waves where five was two, so a latency cost is expected rather than surprising; the number
above is what it actually is.

## ⚠⚠ ANALYSIS — WRITTEN AFTER THE RUN, AND IT CHANGES WHAT THE GATE MEANS

*(Added by hand against the tables above.)*

**Only ONE of the three regressions is attributable to the new streams.** Reading the per-question
stream sets rather than the headline:

| | streams at five | streams at eight | recall | verdict |
|---|---|---|---|---|
| **F2** | legislation, debates, committees, guidance | debates, committees, **consultations** | 100% → 50% | ⚠⚠ **real displacement** — `consultations` took a slot from `legislation` AND `guidance`, and the answer was in one of them |
| **C2** | legislation debates committees caselaw guidance | **identical** | 66.7% → 33.3% | router variance |
| **B6** | legislation debates committees guidance | **identical** | 16.7% → 0% | router variance |

C2 and B6 selected **exactly the same streams in both arms** and still moved. They cannot be
effects of a change that did not happen to them. What moved is the router's **per-stream query
rewrite**, which is an LLM call made fresh on every arm.

**⚠ That is a limitation of this measurement, not a footnote.** With one observation per question
per arm, router non-determinism and new-stream displacement are **confounded** — and the same
confound inflates the displacement table above, where A3 "lost" four streams by going from five to
one, which is the router choosing differently rather than three new streams crowding it out.
**Separating the two needs repeats per arm**, which this run does not have.

### What can be said honestly

- **Mean recall is unchanged**: 41.1% → 41.1%, −0.0pp on 31 scored gold questions.
- **The gate as literally written is NOT met** — three questions regressed. But only F2 shows the
  displacement mechanism the gate exists to catch.
- **Selection works, unevenly**: `explanatory` chosen on 7 of 44, `consultations` on 6, and
  **`impact-assessments` on only 1** — and its own purpose-built probe (*"what did the government
  predict this policy would cost"*) **did not select it**. The one stream whose question §4 quotes
  verbatim is the one the router reaches for least.
- **Latency is close to free**: p50 −232 ms, p95 +810 ms, mean −591 ms. Three extra streams did not
  cost what a third batch wave might have suggested.
- **The gain remains unmeasurable**, exactly as §4 predicted: the gold set has no archetype for any
  of these three collections, and `docs/GOLD_CANDIDATES_S8.md` deliberately has no questions for
  `explanatory` at all.

### Recommendation

**Leave `LEX_ROUTER_STREAMS_V2` OFF.** Not because it is shown to be harmful — mean recall is flat
and latency is near-free — but because **there is no measurable gain to weigh against a
demonstrated displacement case**, and the instrument that could measure the gain (§5's questions)
is still a draft awaiting validation. Flipping it now would trade a known small risk for an
unquantified benefit.

**What would change the recommendation:** §5's questions validated and scored, plus ten questions
for `explanatory`, plus repeats per arm so displacement can be told apart from router variance.

---

## Per question

| id | kind | streams (5) | streams (8) | recall 5 | recall 8 | ms 5 | ms 8 |
|---|---|---|---|---:|---:|---:|---:|
| A1 | gold | legislation | legislation | 100.0% | 100.0% | 6876 | 5764 |
| A2 | gold | legislation | legislation | 100.0% | 100.0% | 6270 | 5923 |
| A3 | gold | legislation debates committees caselaw guidance | legislation | 100.0% | 100.0% | 12929 | 5765 |
| A4 | gold | legislation | legislation | 100.0% | 100.0% | 6138 | 5892 |
| A5 | gold | legislation debates guidance | legislation debates guidance | 50.0% | 50.0% | 6413 | 6464 |
| B1 | gold | legislation debates committees caselaw guidance | legislation debates committees caselaw guidance | 25.0% | 25.0% | 9917 | 8016 |
| B2 | gold | legislation debates committees guidance | legislation debates committees guidance consultations | 0.0% | 0.0% | 9217 | 9337 |
| B3 | gold | legislation debates committees caselaw guidance | legislation debates committees caselaw guidance | 33.3% | 33.3% | 8674 | 7860 |
| B4 | gold | legislation debates committees caselaw guidance | legislation debates committees caselaw guidance | 0.0% | 0.0% | 8329 | 9781 |
| B5 | gold | legislation debates committees caselaw guidance | legislation debates committees caselaw guidance | 0.0% | 0.0% | 7877 | 12559 |
| C1 | gold | legislation debates committees guidance | legislation debates committees guidance | 33.3% | 33.3% | 11351 | 12053 |
| C2 | gold | legislation debates committees caselaw guidance | legislation debates committees caselaw guidance | 66.7% | 33.3% | 12259 | 11420 |
| C3 | gold | legislation debates committees guidance | legislation debates committees guidance | 0.0% | 0.0% | 9900 | 9302 |
| C4 | gold | legislation debates committees caselaw guidance | legislation debates committees caselaw guidance | 33.3% | 33.3% | 8687 | 8614 |
| C5 | gold | legislation debates committees caselaw guidance | legislation debates committees guidance | 33.3% | 33.3% | 8588 | 8169 |
| D1 | gold | legislation | legislation | 100.0% | 100.0% | 6193 | 7220 |
| D2 | gold | legislation | legislation | 50.0% | 50.0% | 5631 | 5937 |
| D3 | gold | legislation | legislation | 100.0% | 100.0% | 6568 | 5965 |
| D4 | gold | legislation debates committees caselaw guidance | legislation debates committees guidance explanatory | 33.3% | 33.3% | 14215 | 15202 |
| D5 | gold | caselaw | caselaw | 0.0% | 0.0% | 9435 | 7347 |
| E1 | gold | legislation debates committees | explanatory | 50.0% | 50.0% | 8281 | 9377 |
| E2 | gold | debates committees guidance | debates committees guidance impact-assessments consultations explanatory | 0.0% | 50.0% | 5612 | 10926 |
| E3 | gold | legislation debates committees caselaw guidance | debates committees explanatory | 50.0% | 50.0% | 20381 | 8274 |
| E4 | gold | legislation debates committees caselaw guidance | legislation debates committees guidance explanatory | 50.0% | 50.0% | 8366 | 13228 |
| E5 | gold | debates committees guidance | explanatory | 0.0% | 50.0% | 12590 | 10484 |
| F1 | gold | legislation debates committees guidance | legislation debates committees guidance | 0.0% | 0.0% | 10629 | 12662 |
| F2 | gold | legislation debates committees guidance | debates committees consultations | 100.0% | 50.0% | 9987 | 7372 |
| F3 | gold | legislation debates committees guidance | legislation debates committees guidance consultations | 50.0% | 50.0% | 13913 | 11704 |
| F4 | gold | debates committees guidance | debates committees guidance | 0.0% | 0.0% | 4872 | 7742 |
| F5 | gold | debates committees guidance | debates committees | 0.0% | 0.0% | 11287 | 4577 |
| B6 | gold | legislation debates committees guidance | legislation debates committees guidance | 16.7% | 0.0% | 12045 | 10800 |
| S5-1 | s5 | legislation | legislation debates committees caselaw guidance | — | — | 6633 | 15025 |
| S5-2 | s5 | legislation guidance | legislation guidance | — | — | 6957 | 6374 |
| S5-3 | s5 | legislation debates committees caselaw guidance | legislation debates committees caselaw guidance | — | — | 7636 | 11900 |
| S5-4 | s5 | committees | committees | — | — | 3583 | 3713 |
| S5-5 | s5 | debates | debates | — | — | 3729 | 3896 |
| S5-6 | s5 | legislation debates committees caselaw guidance | legislation caselaw guidance | — | — | 29689 | 6317 |
| S5-7 | s5 | legislation debates committees guidance | legislation debates committees guidance | — | — | 12672 | 22122 |
| S5-8 | s5 | committees | committees | — | — | 3819 | 3615 |
| S5-9 | s5 | debates committees guidance | debates committees guidance | — | — | 8401 | 10564 |
| S5-10 | s5 | debates committees guidance | debates committees consultations | — | — | 7784 | 8423 |
| V2-1 | v2-probe | debates committees guidance | — | — | — | 8299 | 2904 |
| V2-2 | v2-probe | committees guidance | consultations | — | — | 5281 | 3216 |
| V2-3 | v2-probe | legislation | explanatory | — | — | 8890 | 7003 |
