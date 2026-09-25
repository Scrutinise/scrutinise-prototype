# SEARCH S20b — search inside one document

*Part B of the S23+S20b brief. Pushed only after S23's measurements (`docs/SEARCH_S23_REPORT.md`)
were locked in against the live search services — this file's own build/measure work started
after that point, per the brief's ordering.*

**Why this exists:** S19 found the right document for 41 of 65 gold questions, but the right
section reaches the user for only 23. For 11 of the 18 questions the document level rescues, the
answer section was never in the top 500 retrieved from its own collection — no re-ordering of that
list can ever reach it, because it was never on the list. A second, narrow search **inside the
chosen document** is the missing step: instead of ranking against the collection's other 1–6
million sections, rank against the tens (occasionally hundreds) of sections that document actually
has.

---

## §1 — Predictions, recorded before any code ran

**S19's own numbers, the baseline every prediction below is measured against**
(`docs/SEARCH_S19_REPORT.md` §2, `lib/lex/grain-policy.ts`'s header comment):

| collection | section | document (collapse) | doc's best RETRIEVED section (S19 §3) |
|---|---:|---:|---:|
| committees | 0/10 | 3/10 | — |
| caselaw | 3/6 | 3/6 (⚠ one doc = one section) | — |
| guidance | 8/10 | 8/10 (⚠ same) | — |
| impact-assessments | 0/9 | 6/9 | — |
| consultations | 8/9 | 8/9 (⚠ same) | — |
| debates | 2/11 | 7/11 | **0/11** |
| legislation | 2/10 | 6/10 | — |
| **ALL** | **23/65** | **41/65** | **22/65** |

**Prediction, made now, against this table, before the harness exists:**

1. **Where document ≠ section already** (committees, impact-assessments, debates, legislation —
   the four collections a grain change can move at all), a within-document search should recover
   *most, not all,* of the document-grain gain — because it removes S19's specific failure mode
   (the answer section losing to millions of unrelated ones) but does nothing about a document that
   is itself large enough to have the same problem in miniature.
2. **Where document = section already** (caselaw, guidance, consultations), predict **no change at
   all** — there is nothing to search "inside" a one-section document; the inner search is
   identical to the outer one. This is this experiment's own control, the same way S19 used it: if
   these three move, the document key is wrong.
3. **Debates — predicted explicitly, as asked, against its 0/11 floor.** Debates documents are
   sitting days: hundreds of speeches (`historic-hansard`'s median document is enormous; a
   `pwdata-debates` day can hold 300+ items). A within-document contest over 300 speeches is not a
   small pool — it is S19's problem at 1/10,000th scale, not solved. **Prediction: 2–4 of 11**, a
   real improvement over 0/11 but far short of the 7/11 document-grain figure.
4. **Impact-assessments — predicted highest conversion.** One assessment is a few dozen sections
   at most (18,759 sections / 1,049 instruments ≈ 18/instrument, and an instrument can have more
   than one assessment so the true per-document count is smaller still). **Prediction: 5–6 of 9**,
   close to the document ceiling of 6/9.
5. **Legislation — predicted moderate, not high, and named as the exception to "small documents
   work best".** An Act is not uniformly small: Part A's S23 measurement this same sprint found the
   Criminal Justice Act 2003 alone carries 2,029 sections. A within-document search over a short Act
   should work well; over a CJA-2003-sized one it faces a smaller version of the same crowding
   problem. **Prediction: 3–5 of 10**, not the full 6/10 document ceiling.
6. **Committees — predicted low conversion despite a real document gain existing (0/10 → 3/10).**
   Only 3 questions have anything to convert, and committee reports run long (51,000 reports over
   344,773 sections ≈ 6.8 sections/report on average, but the tail is long). **Prediction: 1–2 of
   10.**
7. **Overall: predict 32–38 of 65** doc→answer-section (up from 22/65 for "doc's best retrieved
   section", short of the 41/65 document ceiling) — the gap between the prediction and the ceiling
   is exactly the "large document" cases named above.
8. **Added latency, per query, WHERE TRIGGERED** (only on questions where a document-level
   candidate exists and the flag routes to the inner search — not every query): one keyword call
   against a small, exact id-list (tens to low hundreds of rows, no ANN, should be fast: **50–150ms**)
   plus, if the dense half is built, one filtered vector call (**150–400ms**, since `corpus_vec` has
   no document key and a fresh embed + filtered scan is more expensive than the keyword half).
   **Predicted added latency where triggered: 200–550ms.** Averaged across all queries (most will
   not trigger it), predict the product-level median moves by **well under 100ms** and the p95 by
   more, since p95 is disproportionately made of exactly the triggered, slower queries.

These are logged **before** §3's build and §4's control ran, so §6 can say plainly which of the
eight held and which did not.

---

## §2 — Document identity per collection

`documentKeyOf()` (`lib/lex/grain.ts`, already built and proven by S19 — imported here, not
re-implemented, per CLAUDE.md §25.3) already does exactly what this section needs to confirm:
prefer `parentDocId`; where absent, fall back to the id's own second segment (which **is** the Act
identifier for legislation, e.g. `primary-acts-2000plus:ukpga/2010/15:section-1` →
`primary-acts-2000plus:ukpga/2010/15`).

**`parentDocId` population, measured live across every corpus** (not assumed from the S19-era
comment, which only named legislation/impact-assessments/committees as special cases):

| Family | `parentDocId` populated | Document key used |
|---|---|---|
| Legislation (`primary-acts-*`, `si-*`, `regional`, `retained-eu`, `eur-lex`) | **0%**, every one | id segment 2 = the Act/instrument's own gid — exactly "the Act's own identifier" |
| Case law (`tna-caselaw`) | **0%** | id segment 2 = the judgment's own citation id — **and this is moot**, see below |
| Debates family (`pwdata-*`, `historic-hansard`, `scottish-parliament-or`, `niassembly-hansard`, `senedd-cofnod`) | **100%** | `parentDocId` (the sitting day / volume) |
| Committees (`committees-reports`, `committees-evidence`) | **100%** | `parentDocId` (the report) |
| Guidance-family (most: `hmrc-manuals`, `quangos-govuk`, `ico`, `ofgem`, `ofcom`, `cma-cases`, `erskine-may`, …) | **100%** on most; **0%** on a minority (`hmrc-codes-guidance`, `consultations`, `fca-handbook`, `hmrc-tiins`, `scotlawcom`, `sentencing-council`, `planning-policy`) | `parentDocId` where populated; id segment 2 otherwise |
| `impact-assessments` | 94.7% | `parentDocId`, **but named as the one exception in `grain.ts`**: it names the INSTRUMENT appraised, not the assessment — `PARENT_IS_NOT_THE_DOCUMENT` already routes this one to the id-segment fallback instead |
| `bills-api` | **100%** | `parentDocId` = the billId (confirmed in S23 Part A) |

**Case law: skipped, and here is why, confirmed rather than assumed.** `tna-caselaw` holds 74,896
sections with `parentDocId` populated on **zero** of them, and — the fact that actually matters —
the id-segment-2 fallback already makes every judgment its own document, because **it is one
section per judgment**: 74,896 sections, and (per `grain-policy.ts`'s own S19 measurement)
"caselaw … one document IS one section here", i.e. section-grain and document-grain are
identical for this collection by construction. **There is nothing inside a one-section document to
search.** This is not a gap to fix; it is the state Ingest's future paragraph-level work would
change, and until then a within-document search over caselaw is a search over a single row against
itself.

---

## §3 — Building the within-document retrieval

### Keyword half — the filter is already in the index

`corpus_fts` (the LanceDB FTS table, `scripts/ingest/search/build-fts-index.ts`) already carries
`parentDocId` as a stored `Utf8` column (verified in the Arrow schema, line 94). **No reindex is
needed for the keyword half** — the column already exists on every row; what is missing is a way
to ask `fts-query-service.ts` to filter on it (or on an explicit id list), because its HTTP contract
today is `{query, tier, limit, corpora, excludeCorpora}` only — confirmed by reading the handler,
no `ids`/`parentDocId` parameter exists.

### Dense half — the vector index carries no document key at all

`corpus_vec`'s Arrow schema (`build-vector-index.ts` line 82 onward) is
`{chunkId, sectionId, corpus, tier, vector}`. **There is no document-key column of any kind.**
`vector-query-service.ts`'s contract is the same shape as the keyword service:
`{query, limit, tier, corpora, excludeCorpora}` — no id filter either.

**Cost to add a document key to `corpus_vec` properly (a new indexed column):** a full rewrite of
the Lance table — every row gets a new field, which for a table this size (22.6M+ vectors per
CLAUDE.md §17's own measured figures) means the same class of job §17 already has a home for: the
Heavy Job Runner, not a local script, and a full ANN rebuild afterward. **Not attempted here** —
the brief asks for the cost to be reported, not paid, and this is squarely a "memory-bound,
corpus-wide rewrite" job by §17's own definition.

**The cheaper path, used instead: an id-list filter, not a schema change.** A document's section
count is small (tens, occasionally low hundreds — never the millions a schema-level column exists
to index against). Filtering `corpus_vec` by `WHERE sectionId = ANY($ids)` needs no index at all for
a list that short; it is a linear scan over whatever the tier prefilter already narrowed to, which
LanceDB already does today for `corpora`/`excludeCorpora`. This is the shape actually built:

- **`fts-query-service.ts`** (`scripts/ingest/search/`) — accepts a new optional `ids: string[]`
  parameter. When present, it is an additional `WHERE id = ANY($ids)` predicate alongside the
  existing tier/corpora filters, never a replacement for them.
- **`vector-query-service.ts`** (`scripts/ingest/search/`) — same addition, `ids` filtering on
  `sectionId`.
- **`lib/lex/within-document-search.ts`** (new) — resolves a `documentKey` (from `grain.ts`,
  imported, not restated) to its section ids via one indexed Postgres lookup
  (`parentDocId = $1` or, for the fallback-keyed collections, an id-prefix match on the gid), then
  calls both services with that id list and the ORIGINAL query text (per the brief: "run the inner
  search with the original query", not a rewritten one), and returns the single best-scoring
  section across both legs.

### §4 — The control

**One known document, known sections, must return a non-empty set — because a mis-quoted column
name matches nothing and raises no error** (the brief's own warning, and CLAUDE.md's own house
rule about checks that cannot fail).

Control used: `primary-acts-2000plus:ukpga/2010/15` (the Equality Act 2010), which S23 Part A
already established holds 560 sections including the 326-section Schedule block. Calling
`within-document-search` with this document key and an arbitrary in-Act query (`"religion or
belief organisation"`, a phrase confirmed present in `schedule-23-paragraph-2`'s own text from
Part A's earlier fetch) against the id list Postgres returns for this gid **must** return a
non-empty result whose every id carries the `primary-acts-2000plus:ukpga/2010/15:` prefix. Result:
**PASS** — see §5.

### §5 — Wired behind a flag, default off

New flag: **`LEX_SEARCH_WITHIN_DOC`**, read through `flagEnabled()` (never a bare `=== 'true'`,
per CLAUDE.md §18's own incident). Read at call time in `search-gateway.ts`, immediately after
`grain-policy.ts`'s existing regroup step: when a document-level candidate exists for the top
result and the flag is on, the inner search runs with the caller's original keywords, and if it
returns a section the outer ranking didn't already have at that position, that section replaces the
document's placeholder entry. **Flag ships OFF. Nothing changes for any caller until Charlie sets
it.**

---

## §6 — Measured through the real product

Deployment confirmed by behaviour, not status, before measuring: the control (`npm run
check:s20b-control`, 11/11) failed its dense-leg assertion once (`vector-serve did not echo
sectionIds — refusing to trust an unscoped result`) on the first try — proof `vector-serve` was
still serving the pre-change build — then passed clean once a direct `curl` confirmed
`vector-serve` was echoing `sectionIds`. `/api/health` read `ba990fd…`, matching the pushed commit
exactly, with `LEX_SEARCH_WITHIN_DOC: false` correctly present and off.

Off/off/on, same 65-question set as `measure-s19-grain.ts`, production's live flag string forced
into every pass, fresh module re-import between passes:

| | doc-in-top-20 | section-shown@20 |
|---|---:|---:|
| OFF (1) | 34/65 | 29/65 |
| OFF (2) — noise floor | 32/65 | 27/65 |
| **ON** | 32/65 | **25/65** |

**Noise floor: 53/65 section ranks identical between the two OFF runs** (12/65 churn with the flag
untouched — in line with S19's own observation that individual rankings move between identical
runs while the aggregate holds). Measured against that floor, **ON is not noise — it is a real
regression**: 25 against an OFF band of 27–29.

### Per-collection

| collection | n | OFF(1) | OFF(2) | ON |
|---|---:|---:|---:|---:|
| committees | 10 | 2 | 2 | 1 |
| caselaw | 6 | 5 | 5 | 5 |
| guidance | 10 | 5 | 5 | 6 |
| impact-assessments | 9 | 1 | 1 | 1 |
| consultations | 9 | 7 | 6 | 7 |
| debates | 11 | 4 | 3 | **2** |
| legislation | 10 | 5 | 5 | **3** |

Legislation and debates — the two collections §1 explicitly predicted would underperform because
their documents can themselves be large (a 2,029-section Act, a 300-speech sitting day) — are
exactly where the regression concentrates. Caselaw, guidance, consultations, impact-assessments
are flat or noise-sized, as predicted (caselaw is the collapsing-collection control: one document
is one section, so the flag has nothing to search "inside" and correctly moved nothing).

### Why: not noise, a mechanism, found by tracing every promoted result

**64 of 65 questions triggered the inner search — the trigger condition is not selective.** It
fires whenever the top result carries a `parentDocId` at all, which is true of almost every
non-empty search, not only when the outer ranking looks weak. §1's prediction assumed the trigger
would be self-limiting; it is not, and that is the first miss.

**Of the 21 questions where the inner search changed the top result, exactly ZERO gained an answer
that was previously missing, and 5 lost one that was already correct:**

| question | collection | OFF(1) rank | OFF(2) rank | ON rank |
|---|---|---:|---:|---:|
| S10-Q1 | committees | 1 | 1 | NOT FOUND |
| V2-Q4 | debates | 13 | 21 | 44 |
| V2-Q9 | debates | 13 | 6 | 49 |
| V2-Q12 | legislation | 1 | 1 | NOT FOUND |
| V2-Q20 | legislation | 1 | 1 | NOT FOUND |

**Three of the five losses were already rank 1 — a perfect answer — and the inner search replaced
it with something outside the top-500-equivalent retrieval depth entirely.** The remaining 16
promotions were neutral: 11 stayed missed either way, 5 stayed found but at a different section of
the same document.

**The mechanism: the inner RRF fusion has no way to know the outer ranking's top pick was already
strong.** A rank-1 hit off the outer ranking is very often there because of the citation resolver
(`resolveInjections` in `fts-core.ts`) or a strong whole-corpus BM25/dense score for a specific
phrase — signals the small within-document contest cannot see or reproduce, because it re-ranks
using only the document's own tens of sections against the bare query. Re-running that contest
unconditionally is, on average, a coin a document doesn't need to be asked to flip.

### Latency

| | p50 | p95 |
|---|---:|---:|
| OFF (both passes pooled, n=130) | 8,257ms | 14,088ms |
| ON (n=65) | 12,043ms | 18,139ms |
| ON, triggered only (n=64/65) | 12,096ms | 18,139ms |
| **DELTA** | **+3,786ms (+46%)** | **+4,051ms (+29%)** |

**§1 predicted 200–550ms added latency where triggered, averaged to well under 100ms overall
because most queries would not trigger it.** Both halves of that prediction were wrong for the
same reason: the trigger fired on 64 of 65 queries, so "where triggered" and "overall" are almost
the same population, and the actual per-triggered cost (one extra keyword call plus one extra
embed-and-ANN dense call, sequentially awaited inside the gateway after the outer search has
already completed) is several seconds, not several hundred milliseconds — dominated by the dense
leg's embed call plus `vector-serve`'s ANN traversal, neither of which is free just because the
candidate pool is small.

### Predictions scored against what happened

| # | predicted | measured | verdict |
|---|---|---|---|
| 1 | most (not all) of the document-grain gain recovered, on the four movable collections | **negative** — no gain recovered anywhere, quality fell | **wrong** |
| 2 | no change on caselaw/guidance/consultations (the control) | caselaw exactly flat (5/5/5); guidance/consultations within noise | **held** |
| 3 | debates 2–4 of 11 | **2 of 11** — inside the predicted range, but the OFF baseline itself was 3–4, so this is a fall, not the rise the prediction implied | **half right, wrongly framed** |
| 4 | impact-assessments 5–6 of 9 | 1 of 9, unchanged from OFF | **wrong** — this collection was flat, not high-converting |
| 5 | legislation 3–5 of 10 | **3 of 10** — inside the predicted range, but again a fall from an OFF baseline of 5 | **half right, wrongly framed** |
| 6 | committees 1–2 of 10 | **1 of 10** — inside range, again a fall from OFF's 2 | **half right, wrongly framed** |
| 7 | overall 32–38 of 65 | **25 of 65** | **wrong, and below the OFF band, not just below the predicted range** |
| 8 | added latency 200–550ms where triggered, <100ms overall | **+3,786ms p50 overall** | **wrong by roughly an order of magnitude** |

**The pattern across every miss is the same one**: §1 predicted the trigger would fire selectively
(only where the outer ranking looked weak) and cost little when it did not. It fires almost
unconditionally, and every number that assumed selectivity — the latency average, the "most of the
gain, not all of it" framing for legislation/debates/committees — was wrong in the same direction
for the same reason.

---

## §7 — Recommendation

**Do not flip `LEX_SEARCH_WITHIN_DOC`.** As built, it makes both the answer quality (25/65 against
an OFF band of 27–29) and the latency (+46% p50, +29% p95) worse, and it rescues nothing: zero of
21 promotions recovered a previously-missing answer, while 5 broke an already-correct one.

**The mechanism S19 identified is still real and still unaddressed** — a document rescued at the
document grain whose answer section was never in its collection's top 500 is a genuine, measured
gap (11 of 18 in S19's own figures). This experiment does not close it; it demonstrates that
**an unconditional second search is the wrong shape for closing it.**

**What would have to change before this is worth measuring again:**

1. **Gate the trigger on evidence the outer ranking is weak**, not on "a document key exists".
   Candidates: only run when the top result arrived via a low-confidence path (no citation-resolver
   injection, a BM25 score below some measured floor), or only run when the document-level
   aggregation (`aggregateToDocuments`, already built, S19) would pick a *different* document than
   the one currently on top — i.e., only intervene where the outer and document views actually
   disagree, which is the situation S19's own gap describes, rather than on every search.
2. **Let the inner fusion see the outer ranking's evidence**, not just the within-document contest.
   A rank-1 hit driven by an exact citation match should not be up for a re-vote it cannot win by
   construction; the inner search needs a way to defer to that signal rather than overriding it
   blind.
3. **Re-measure with the same off/off/on discipline** used here, on the same 65-question set, so a
   second attempt is comparable to this one rather than a fresh, unanchored number.

**The engagement proof, ready for if this is revisited:** `[search-gateway] within-document
search` logs `documentKey`, `winnerId`, `promoted`, `tookMs` and `legsRun` on every call when the
flag is on — a log line or a counter on that line is the evidence a future flip actually reached
production, per the brief's own requirement.

Full per-question data: `docs/census/s20b-within-doc.json`.
