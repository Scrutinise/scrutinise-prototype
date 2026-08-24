# SEARCH S13 — RETURN THE PARAGRAPH THAT ANSWERS THE QUESTION

**From:** CC-Search · **2026-08-24 01:56 UTC** (clock cross-checked against Google and Cloudflare
`date` headers before stamping — after the 23 Aug drift, an unchecked stamp is a guess)
**Executes:** `docs/BRIEF_SEARCH_S13.md`
**Index of record for every number below:** `corpus_fts` **v7308** / 18,272,377 rows · `corpus_vec`
**v4011** / 22,670,808 · `corpus_chunks` **v18447** / 22,670,808. Stamped either side of every run;
they matched.

---

## §0 — TWO THINGS BEFORE THE NUMBERS

**⚠ THE BRIEF'S EXECUTING DOCUMENT DOES NOT EXIST.** `MECHANISM_AND_ARGUMENT_GRAPH_DESIGN.md` is not
in the repository — `git ls-files` finds nothing matching, and `docs/` has no file with "mechanism"
in its name. The brief cites its §2.1–§2.3 and stages 0–2 of §5 as what this sprint executes. **This
is the third sprint running whose named input is absent** (`SCRUTINISE_CORPUS_REGISTER_v4.xlsx` for
C2 Lane 2, four named inputs for Census C1). S13 was therefore built from the brief's own §1–§6,
which are self-contained; nothing here is blocked by the absence, but nothing here can claim to
implement a design document I have not read.

**⚠ THE FLAG STATE IN PRODUCTION IS AN INFERENCE, LABELLED AS ONE (CLAUDE.md §19).** `VERCEL_TOKEN`
is SAML-blocked, so I cannot read Vercel's environment. Every measurement below was taken with
`LEX_QUERY_ROUTER=true` and `LEX_VECTOR_STREAMS=legislation`, which is **the last state Charlie read
off the dashboard (10 Aug)**. If either has changed since, the absolute numbers describe a
configuration production is not in. The services themselves ARE readable and were read.

---

## §1 — THE MERGE AUDIT. NOTHING WAS CHANGED BEFORE THIS WAS TAKEN.

`scripts/audit-s13-merge.ts` · full per-question data in `docs/census/s13-merge-audit.json` · run
twice, **identical output both times**.

### 1.1 What the merge actually does — and the answer to the brief's first question is NO

`runRoutedSearch` → `interleaveStreams`: **floor of 2 per stream, then strict round-robin, exhausted
streams skipped.** The budget passed is the TOTAL number of hits, so the merge is a pure reordering
and **drops nothing**. There is no sort in it.

▶ **"Does a cross-stream comparison ever compare raw scores computed on different scales?"** —
**No, not in the merge.** `interleaveStreams` never touches `score`. The only score sort inside a
routed search is `mergeLegs`, which is *within* one stream and goes through `sortByScore`, which
**throws** unless every result carries the same `scorer`. The defect the brief is remembering was
real and is retired: `groupForPanel` did a global cross-stream score sort until 2026-08-09, and
`score-scope.ts` now exists to stop it returning.

⚠ **So the brief's premise 2 — "the merge discards what the search found" — is half right and the
half that is wrong matters.** The merge does not discard; it **demotes**. Everything retrieved is
still in `results`. What discards is the caller taking a prefix, and the merge decides what is in
that prefix.

### 1.2 THE TABLE — where each lost answer dies · n = 65, whole population, no sampling

Ranks are searched over the **entire** returned population; 20 is used only to classify a rank, so a
key at merged rank 216 is recorded as 216 and not as "absent".

| question | collection | in-stream rank | stream | merged rank | of | verdict |
|---|---|---|---|---|---|---|
| S10-Q1 | committees | 35 | committees | 106 | 180 | DILUTED |
| S10-Q2 | committees | 52 | committees | 52 | 60 | DILUTED |
| S10-Q3 | committees | 16 | committees | 33 | 120 | DILUTED |
| S10-Q4 | committees | 47 | committees | 47 | 60 | DILUTED |
| S10-Q5 | committees | 28 | committees | 57 | 120 | DILUTED |
| S10-Q6…Q10 | committees | — | — | absent | 60–180 | NOT-RETRIEVED ×5 |
| S10-Q12 | caselaw | 1 | caselaw | **5** | 180 | HIT@20 |
| S10-Q13, Q14, Q20 | caselaw | — | — | absent | 60–300 | NOT-RETRIEVED ×3 |
| S10-Q15 | caselaw | 6 | caselaw | **6** | 60 | HIT@20 |
| S10-Q16 | caselaw | 54 | caselaw | 54 | 60 | DILUTED |
| S10-Q21 | guidance | 14 | guidance | 29 | 120 | DILUTED |
| S10-Q22 | guidance | 4 | guidance | 24 | 300 | DILUTED |
| S10-Q23 | guidance | 0 | guidance | **8** | 300 | HIT@20 |
| S10-Q24 | guidance | 15 | guidance | 79 | 300 | DILUTED |
| S10-Q25 | guidance | 12 | guidance | **12** | 60 | HIT@20 |
| S10-Q26 | guidance | 2 | guidance | **14** | 296 | HIT@20 |
| S10-Q27 | guidance | — | — | absent | 60 | NOT-ROUTED |
| S10-Q28, Q30 | guidance | — | — | absent | 60–300 | NOT-RETRIEVED ×2 |
| S10-Q29 | guidance | 1 | guidance | **9** | 300 | HIT@20 |
| S10-Q31 | impact-assessments | 8 | legislation | 32 | 240 | DILUTED |
| S10-Q32 | impact-assessments | — | — | absent | 240 | NOT-RETRIEVED |
| S10-Q33, Q34, Q35, Q39 | impact-assessments | — | — | absent | 180 | NOT-ROUTED ×4 |
| S10-Q36 | impact-assessments | 9 | legislation | 36 | 240 | DILUTED |
| S10-Q37 | impact-assessments | 3 | legislation | **12** | 240 | HIT@20 |
| S10-Q38 | impact-assessments | 7 | legislation | 28 | 240 | DILUTED |
| S10-Q41 | consultations | 0 | guidance | **4** | 180 | HIT@5 |
| S10-Q42, Q43, Q46 | consultations | — | — | absent | 180–240 | NOT-RETRIEVED ×3 |
| S10-Q44 | consultations | 0 | guidance | **4** | 180 | HIT@5 |
| S10-Q45 | consultations | 1 | guidance | **5** | 180 | HIT@20 |
| S10-Q47 | consultations | 0 | guidance | **4** | 180 | HIT@5 |
| S10-Q48 | consultations | 1 | guidance | **5** | 180 | HIT@20 |
| S10-Q49 | consultations | 5 | guidance | 23 | 240 | DILUTED |
| V2-Q1 | debates | — | — | absent | 60 | NOT-RETRIEVED |
| V2-Q2 | debates | 39 | debates | 39 | 60 | DILUTED |
| V2-Q3…Q8, Q10, Q11 | debates | — | — | absent | 60–180 | NOT-RETRIEVED ×8 |
| V2-Q9 | debates | 54 | debates | 216 | 239 | DILUTED |
| V2-Q12 | legislation | 0 | legislation | **0** | 300 | HIT@5 |
| V2-Q13, Q14 | legislation | — | — | absent | 240–299 | NOT-RETRIEVED ×2 |
| **V2-Q15** | legislation | **2** | legislation | **absent** | 297 | **see below** |
| V2-Q16 | legislation | 15 | legislation | 60 | 240 | DILUTED |
| V2-Q17 | legislation | 0 | legislation | **0** | 300 | HIT@5 |
| V2-Q18 | legislation | 19 | legislation | 95 | 299 | DILUTED |
| V2-Q19 | legislation | 2 | legislation | **10** | 300 | HIT@20 |
| V2-Q20 | legislation | 12 | legislation | 48 | 240 | DILUTED |
| V2-Q21 | legislation | 5 | legislation | 25 | 300 | DILUTED |

**Per collection, n beside every figure:**

| collection | n | merged@20 | merged@5 | **in-stream@20** | DILUTED | NOT-RETRIEVED | NOT-ROUTED |
|---|---|---|---|---|---|---|---|
| caselaw | 6 | 2 (33%) | 0 (0%) | 2 (33%) | 1 | 3 | 0 |
| committees | 10 | 0 (0%) | 0 (0%) | 1 (10%) | 5 | 5 | 0 |
| consultations | 9 | 5 (56%) | 3 (33%) | 6 (67%) | 1 | 3 | 0 |
| **debates** | 11 | **0 (0%)** | 0 (0%) | **0 (0%)** | 2 | **9** | 0 |
| guidance | 10 | 4 (40%) | 0 (0%) | 7 (70%) | 3 | 2 | 1 |
| impact-assessments | 9 | 1 (11%) | 0 (0%) | 4 (44%) | 3 | 1 | 4 |
| legislation | 10 | 3 (30%) | 2 (20%) | 8 (80%) | 5 | 2 | 0 |
| **ALL** | **65** | **15 (23%)** | — | **28 (43%)** | 20 | 25 | 5 |

### 1.3 The single most useful thing in this report

**`merged rank ≈ in-stream rank × number of streams routed` holds for 29 of the 34 keys that were
found and merged**, to within one full round. That relation *is* the round-robin — it is not an
approximation of it. It makes the visible window arithmetic:

> With **S** streams routed, a top-20 window can show at most the first **floor(20/S)** of EACH
> stream. An in-stream rank at or beyond that **cannot appear**, whatever its score.

Splitting the 35 questions where retrieval found the answer somewhere:

| | n | of which merged@20 |
|---|---|---|
| **inside** their own question's ceiling | **16** | **15** |
| **at or beyond** it | **19** | 0 |

⚠ **THE MERGE IS ALREADY SHOWING ALMOST EVERYTHING IT CAN.** Of the 16 answers the round-robin was
arithmetically able to display, it displayed 15. The 16th is V2-Q15 and it is not a merge failure —
see below. **So the honest cost of the round-robin is not "it loses things"; it is "it can only ever
show floor(20/S) per stream".**

Of the 19 beyond the ceiling, **12 sit at in-stream rank < 20** — inside their own stream's top 20,
outside the merged top 20. **Those 12 of 65 are the entire recoverable gain from a merge change:
23% → a ceiling of 42%.** The other 7 are at in-stream ranks 16–54 and are retrieval failures, not
merge failures. ⚠ **Four of those seven routed only ONE stream** (S10-Q2 at 52, Q4 at 47, Q16 at 54,
V2-Q2 at 39) — **with one stream routed there is no merge at all**, so no merge change of any kind
can reach them.

### 1.4 ⚠⚠ V2-Q15's answer key points at a document with no text in it

*"Is the old law banning schools from promoting homosexuality still in force?"* keys
`primary-acts-pre-2000:ukpga/1988/9:section-28`. Retrieval finds it at **in-stream rank 2**. It is
then removed by the gateway's C3 Lane B2 hollow-repeal suppression — **correctly**. Read out of R2,
the stored body is **66 characters**:

```
28 . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .
```

`wordCount` 33 — a section number followed by thirty-two dot leaders, which is how the source renders
a repealed provision. **We do not hold the text of section 28.** So Q15 can never score as a hit
however good retrieval becomes, and any recall figure that includes it counts a corpus gap as a
ranking failure. Decision D-3 below.

### 1.5 Is length the mechanism? — **not established, and the raw comparison is confounded**

| | n | median wordCount |
|---|---|---|
| correct answers that SURVIVED into merged top-20 | 15 | **280** |
| correct answers DISCARDED by the merge (DILUTED) | 20 | **773** |
| every document occupying a merged top-20 slot | 1,260 | 489 |

That reads as "long documents lose" — 2.8× — and **I do not believe it as stated**. It is confounded
by collection: a legislation section is a few hundred words and a Hansard speech a few thousand, and
the collections that fail (debates, committees) are the long-document collections. Split by
collection, every cell has n ≤ 5 and there is no consistent direction: guidance's survivors are
*longer* than its discards (4,680 vs 2,528), legislation's are shorter (235 vs 596), consultations
are flat (264 vs 238).

▶ **Naming which one I found, as the brief requires: this is a ROUND-ROBIN defect, not a
normalisation defect.** The arithmetic relation in §1.3 explains the losses completely and needs no
length term. **I decline to make a normalisation change on this evidence** — n is far too small and
the one clean signal points elsewhere.

### 1.6 What is the round-robin costing? — a smaller number than expected, and it is honest

For a correct answer excluded from the merged top-20 at in-stream rank *r*, how many top-20 slots
went to results **their own stream ranked at r or worse**? Those are documents their own stream
considered less relevant than the correct answer, shown in its place.

**Across all 65 questions: 1 affected question, 10 slots.** (That question is V2-Q15, and it is the
suppression case above, so even that one is misattributed.)

⚠ **This is the finding that most contradicts the brief's framing**, and it follows from §1.3: the
round-robin admits *by rank*, so it almost never seats a stream's rank-30 result ahead of another
stream's rank-4. It is not making bad trades. It is making a fair trade too few times, because the
window is 20 and there are up to five streams in it.

---

## §2 — THE FIX, BUILT TO THE AUDIT, FLAG-GATED, DEFAULT OFF, **AND NOT YET MEASURED**

`lib/lex/merge-coverage.ts` · `LEX_MERGE_COVERAGE`, default OFF, read through `flagEnabled()` —
never a bare `=== 'true'`.

**What it does.** The floor stays exactly as it is (2 per stream, reusing `interleaveWithReport`, not
a second copy — a stream reaching zero slots is the failure `interleave.ts` was written to prevent).
The **post-floor** slots stop rotating and are allocated across all streams at once by **the fraction
of the query's content terms present in what the result displays**, ties broken by in-stream rank so
a tie falls back to exactly today's order.

**Why that signal and not a score.** Scores are not comparable — RRF ≈ 0.01 against raw BM25 ≈ 5–25,
and normalising them produces false precision with a more convincing face. Term coverage is a
property of the *(query, document)* pair, computed identically for every stream, dependent on no
index statistic. It is a **coverage heuristic, not a relevance model**; a reranker remains the real
answer to cross-stream ordering, and this does not pre-empt it.

**Why it is a FRACTION and not a count** — the §1.5 length question, handled structurally: a raw
count of matched terms would favour long documents for containing more words. Capping at the number
of distinct query terms means a 30,000-word speech and a 200-word regulation both top out at 1.0.

### ❌ Both arms could NOT be run in one session, and I am not reporting a number I did not take

The brief requires both arms against the same index in one session. **`mergeByCoverage` refuses to
run and says so** when the retrieval services do not send `snippetMatched`, because until §3 is
deployed the snippet is still the first 300 characters of the document — scoring coverage on that
would measure how often a query term happens to appear in a document's opening, report it as a merge
experiment, and **look exactly like a null result**. That is CLAUDE.md §18's corollary: OFF, FAILED
and NOT-MEASURABLE must not look identical.

**Both services are still on pre-S13 builds** (§3 below). So the arm is built, wired and inert, and
**S13 reports no A/B for it.** ▶ It is measurable the moment the services are redeployed; the runner
is `scripts/audit-s13-merge.ts` with `LEX_MERGE_COVERAGE=true` against the cached routes in
`scripts/gold/s13-routes.json`, which is why the routes are cached at all.

⚠ **And I say plainly where I decline to change anything:** the fusion weight, the RRF constant, the
stream floor and the `limit` fan-out are all untouched. §1 gives no evidence about any of them.

---

## §3 — SHOW THE PARAGRAPH THAT MATCHED

### 3.1 The audit: the chunk identity existed, was in scope, and was thrown away

**⚠ It is lost on ONE LINE.** `vector-core.ts::vectorSearchSections` collapses chunk hits to their
parent section:

```ts
best.set(r.sectionId, { sectionId: r.sectionId, corpus: r.corpus, tier: r.tier, score: sim })
//                       ↑ r.chunkId is right there on the row, and is not carried
```

`vector-query-service.ts::snippets` then hydrated a snippet by taking each section's **first** chunk
(`if (!out.has(r.sectionId))` over chunks sorted by `chunkId`), sliced to 300 characters. So the ANN
decided which passage answered the query and the service displayed the opening of the document.

**The sparse leg had the same defect by a different route:** `fts-core.ts::toHit` set
`snippet: body.slice(0, 300)`. BM25 scores the whole section, so a term appearing once 20,000
characters in produces a top hit whose displayed text is the first 300 characters.

**What that costs, measured on the validated debates set** (bodies read out of R2):

| | |
|---|---|
| keyed speeches | 14 |
| word counts | 920 – **5,714** (median ≈ 2,357) |
| Rachel Reeves, Spring Statement 2025 | 26,259 chars — user saw chars **0–300** (**1.1%**), a preamble with no announcement in it |
| Lord Gardiner, death penalty 1969 | 31,657 chars — user saw **0.9%**, from the top |

✅ **AND NO RE-INDEX IS NEEDED.** `corpus_vec` already carries `chunkId` as a column (verified by
reading the table: `chunkId, sectionId, corpus, tier`), and `corpus_chunks` carries `chunkId` +
`body`. This is a **pure serving change** — no re-embed, no re-chunk, no cost.

### 3.2 ⚠⚠ THE S12 SNIPPET FIX IS COMMITTED, PUSHED, AND NOT DEPLOYED — THREE DAYS ON

Read off the running service, not the repository, exactly as the brief instructs:

| `vector-search` limit | empty snippets, measured 2026-08-24 | pre-fix arithmetic (`n × 4` rows) | post-fix (`n × 8`) |
|---|---|---|---|
| 1 | **0 / 1** | 0 / 1 | 0 / 1 |
| 3 | **1 / 3** | 1 / 3 | 0 / 3 |
| 10 | **5 / 10** | 5 / 10 | **0 / 10** |

The fix is commit `bf8eeb1`, **2026-08-21 23:17**. `vector-serve` booted **2026-08-23 00:24** — 25
hours later — and still reproduces the pre-fix table exactly. **A restart re-runs the existing build;
only `vector-serve-run.ts redeploy` rebuilds from Main.** Half of every ten-result case-law response
still arrives with no snippet at all.

### 3.3 What was built

- **`scripts/ingest/search/passage.ts`** — ONE selector, used by BOTH services, so the two legs
  cannot disagree about what a document looks like. (If one showed the matched passage and the other
  the head, the same document would read differently depending on which leg found it — the S11
  case-law-title defect, one layer along. Fusion keeps the first copy it sees, vector before bm25, so
  which leg's text a user gets is not even stable across queries.)
- **`vector-core.ts`** — `VecSectionHit.chunkId` carries the winning chunk out.
- **`vector-query-service.ts`** — hydrates the **winning** chunk, not chunk 0, and runs the selector
  over it. Counts and logs every fallback.
- **`fts-core.ts`** — runs the same selector over the body.
- Both wire `snippetMatched` and `snippetLocation` onto the response; both adapters pass them through
  to `SearchResult` **without defaulting** — `undefined` (service too old to say) stays distinct from
  `false` (looked, found nothing).
- Kill-switch `SEARCH_PASSAGE_SNIPPET=false`, **one name shared by both services** so they cannot be
  turned over separately. ⚠ **It ships ON**, which is a deliberate departure from this project's
  default-OFF norm: the behaviour it replaces is not defensible under measurement, and the brief
  gates only §2 behind a flag. Decision D-1.
- **`check-passage.ts` — 15 assertions, 5 negative controls, all 5 FIRED, 0 silent.**

⚠⚠ **The check earned its keep immediately.** `passageTerms` was written as a deliberate copy of
`fts-core.ts::queryTerms` ("identical, so the two cannot drift"), which keeps every token of three
characters or more — **including `the`**. The selector reported `matched: true` on a document
containing nothing of the query, with a passage centred on a definite article. The §3 verification
number would have come back near 100% for a system that had located nothing. Stopwords are now
removed, which is *faithful* to BM25 rather than a divergence from it (IDF already gives `the`
essentially no weight); `queryTerms` itself is deliberately unchanged, because it feeds the title
boost and this sprint changes what is displayed, not what is ranked.

### 3.4 The §3 number — **BEFORE arm only, and the metric had to be repaired first**

⚠⚠ **My first version of this metric could barely fail.** It scored title + citation + snippet
together and returned **80% on the old build** — the one that shows the first 300 characters. The 80%
was the **title**: a Hansard row titled *"Prepayment Meters: Self-Disconnection"* matches a
prepayment-meter query on its heading alone. It would have moved 80% → ~85% across a change that
alters every snippet on the platform. Split three ways:

**n = 11 debates questions, whole displayed set (`grouped` — what a user is actually shown), no sampling.**

| measured over | before (services on pre-S13 builds) |
|---|---|
| **the SNIPPET alone** — the §3 number | **54 of 81 = 67%** |
| title/citation alone | 52 of 81 = 64% |
| either | 61 of 81 = 75% |
| **mean fraction of the query's content terms inside the snippet** | **25.2%** |

▶ **The brief's expectation — "today that is close to zero by design" — is REFUTED.** It is 67% for
"contains at least one content term", because one word of an eight-word question clears that bar and
a topical query's vocabulary recurs early in a speech. **The number that shows the defect is the mean
coverage: 25.2% of the question is present in the text shown.**

❌ **There is no AFTER number in this report.** Both services are on pre-S13 builds; the delivery
probe fails 3 of 5 assertions and passes both of its controls, so the probe is sound and the verdict
is real. ⚠ Run-to-run variance on the before arm is ±3 results of 81 (two runs gave 57/81 and 54/81)
because routing is an LLM decision and this harness does not cache routes; **the mean-coverage figure
is the stabler one and both runs gave 25%.**

---

## §4 — THE DEBATES RE-KEY IS WRITTEN AND IS WITH CHARLIE

**`docs/GOLD_V2_DEBATES_REKEY.md`** — eleven numbered rows, one verdict line each, the format
Charlie has now completed twice. **Nothing was scored against them, deliberately.**

Every paragraph was read out of the stored body in R2 before it was written down, and the confirming
sentence is printed under each row.

**⚠⚠ A structural finding that changes what "paragraph" can mean: twelve of the fourteen keyed
speeches are stored as ONE paragraph.** The TheyWorkForYou and historic-Hansard compile paths flatten
paragraph breaks; the NI Assembly (53 paras) and Scottish Parliament (34 paras) paths do not. So there
is no stored paragraph index to key on for ten of the eleven questions, and the key is a **verbatim
quotation** instead — which is stricter, because an index survives a re-compile that changes the text
and a quotation does not. *(Reported to ingest, not acted on — §6.)*

**⚠ The Senedd coordination point is resolved without needing to ask:** none of the eleven questions
has a `senedd-cofnod` key (the two Senedd candidates were withdrawn during GOLD V2 when their bodies
turned out to be about oesophageal cancer, and Q3 moved to Northern Ireland). The re-parse and the
re-key cannot collide whichever ran first. It **will** matter for the next Welsh question.

**⚠ Three rows carry a decision rather than a clean re-key** — Q6 (both keys are *abolition* debates
while the question says *"bringing back"*), Q8 (one side of the argument only), Q9 (see below).

**⚠⚠ And §4 corrected me once, which is the reason it insists on reading the source.** For Q9 —
*"Why were energy companies forcing people onto prepayment meters?"* — the term-coverage ranking put
the two best windows at 21% and 14% into the speech, and **both are about consequences, not causes**.
I had written the row up as *"the question and the document do not match"* and recommended amending
the question. Then I read the whole 1,551-word body and the answer to *why* is plainly there, 48% in:
*"energy firms have secured almost 500,000 court warrants to install prepayment meters in the homes
of customers in debt"*. **No amendment is needed.** ⚠ The near-miss is itself a §3 finding: **term
density and "answers the question" are different things**, so the passage selector will sometimes
pick the wrong passage from the right document. It picks a far better one than the head of the
document, which is what it is for.

---

## §5 — NOT DONE, AND THE DEPENDENCY NAMED

**❌ The re-measure has NOT been run and this report supersedes no earlier figure.** It is gated on
two things, in order:

1. **Charlie's validation of `GOLD_V2_DEBATES_REKEY.md`.** A changed key is a changed question;
   scoring against unvalidated keys would put a third number into circulation.
2. **The services being redeployed.** §2's arm cannot run and §3's after-number cannot be taken until
   they are.

⚠ **What §1 DOES establish, and it is a new baseline rather than an improvement on anything:**
**merged@20 = 15/65 (23%)**, **in-stream@20 = 28/65 (43%)**, against `corpus_fts` v7308. **This
supersedes nothing** — S10's per-collection figures are void (the 20 Aug case-law re-compile moved
document frequencies table-wide; S11 measured 0 of 5 rankings reproducing) and S12's §3 baseline was
never taken. There is no earlier number on this index to subtract from.

⚠ **The debates decision the brief defers is still deferred, and now has evidence behind the
deferral:** debates is **9 of 11 NOT-RETRIEVED** — the key never appears in the debates stream's own
list at any depth. That is not a merge question and not a display question; it is retrieval. Re-taking
the meaning-based-search decision on *"find me the argument that X"* questions is the next sprint's
work, and it should be taken **after** the re-key lands, not before.

---

## §6 — DECISIONS FOR CHARLIE

**D-1 · Should the matched-passage snippet ship ON, or behind a default-OFF flag?**
*Recommendation: ON, as built.* The behaviour it replaces shows a user 1.1% of a Spring Statement,
from the top, and the kill-switch `SEARCH_PASSAGE_SNIPPET=false` restores the old text exactly
without a rebuild. *Consequence of default-OFF instead:* the sprint delivers nothing user-visible and
§2's arm stays unmeasurable, because it needs this signal.

**D-2 · Redeploy `fts-serve` and `vector-serve` — REBUILD, not restart.**
This is the only step that makes any of §2 or §3 real, and it is a command I can run
(`tsx search/{fts,vector}-serve-run.ts redeploy`) once the code is on Main. **The signal that proves
it: `vector-search` at `limit=10, tier=caselaw` returning `0` empty snippets where it returns exactly
`5` today, and `snippetMatched` appearing on the wire with its control fields still present.** Not an
absence of errors. `scripts/verify-s13-passage.ts` is that probe and currently fails 3 of 5 with both
controls passing. *Consequence of not doing it:* S12's snippet fix stays undelivered for a fourth day
and S13 delivers nothing at all.

**D-3 · V2-Q15's answer key points at a 66-character dot-leader placeholder.**
*Recommendation: mark it `⛔ UNSCOREABLE — corpus gap` rather than REJECT,* so the behaviour half you
wrote it for ("returning the section without saying it is repealed is a wrong answer that looks
right") survives, and exclude it from recall denominators. *Consequence of leaving it:* every future
recall figure counts a missing document as a ranking failure — **n drops 65 → 64 for recall.**

**D-4 · Q6's two keys answer two different questions** (1969 is "should it come back"; 1956 is
"should it be abolished"). *Recommendation: keep 6b, and AMEND the question to "…last seriously
debate the death penalty?"* *Consequence of leaving both:* an answer key that does not determine a
direction — the exact defect that cost the position graph 136 rows.

**D-5 · Is `LEX_VECTOR_STREAMS` still `legislation` in Vercel?** I cannot read it (SAML). Every
number above assumes the 10 Aug dashboard reading. *Consequence of it having changed:* the §1 audit
describes a configuration production is not in, and would need re-taking — 25 minutes.

---

## APPENDIX — WHAT SHIPPED

| file | what |
|---|---|
| `scripts/ingest/search/passage.ts` | the one passage selector, both legs |
| `scripts/ingest/search/check-passage.ts` | 15 assertions, 5 controls, all fired |
| `scripts/ingest/search/vector-core.ts` | `chunkId` carried out of the collapse |
| `scripts/ingest/search/vector-query-service.ts` | winning chunk hydrated, not chunk 0 |
| `scripts/ingest/search/fts-core.ts` | passage instead of `body.slice(0, 300)` |
| `scrutinise-web/lib/lex/merge-coverage.ts` | §2's arm, `LEX_MERGE_COVERAGE`, default OFF |
| `scrutinise-web/lib/lex/query-router.ts` | the arm wired in; default path byte-identical |
| `scrutinise-web/lib/lex/{fts,vector}-search.ts`, `page1-config.ts` | the new fields, undefaulted |
| `scrutinise-web/scripts/audit-s13-merge.ts` | §1, with cached routes for the A/B |
| `scrutinise-web/scripts/verify-s13-passage.ts` | §3 delivery probe + the number |
| `scrutinise-web/scripts/s13-{read-speech,rekey-candidates}.ts` | §4's reading tools |
| `docs/GOLD_V2_DEBATES_REKEY.md` | §4's deliverable, awaiting verdicts |
| `docs/census/s13-*.json` | the raw data behind every figure |

**Checks watched failing against the real broken state:** `check-passage` 5 controls fired · the
audit's index stamp (fired wrongly at first — it compared a timestamp line, so it reported THE INDEX
MOVED on a run where all three versions were identical; now compares versions) · the audit's fan-out
mode (reported "1 stream" for a set whose fan-out is 1/2/3/4/5 — replaced with a per-question
ceiling) · the §3 metric (80% on the old build, because it was scoring the title).
