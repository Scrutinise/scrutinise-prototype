# THE CORPUS TEXT IS NOT FULLY DECODED — MEASURED, FIXED WHERE IT MATTERS, AND NOT WHERE IT DOES NOT

**Executes:** `docs/BRIEF_INGEST_ENTITY_DECODE.md` §1–§4
**Written:** 17 August 2026, 08:35 UTC
**Owner:** CC-Ingest

---

## THE HEADLINE, AND IT REVERSES THE BRIEF'S OWN PREMISE

**The contamination is real, wider than the brief knew, and costs no measurable recall.**

| | |
|---|---:|
| corpora with a literal entity in a 150-document sample | **16 of 74** |
| worst affected | **`tna-caselaw` — 95.3% of documents**, 23,613 occurrences in 150 docs |
| the corpus that found the defect | `committees-evidence` — 12.0% |
| extrapolated documents carrying at least one | ~184,000 (1.01%) |
| **searchable tokens recovered by decoding** | **0 of 15,659,766** |
| section titles carrying one (exhaustive, not sampled) | **4,532** |
| `speaker` values | **10,660** |
| `attribution` values | **1,613** |
| **user-visible values REPAIRED this sprint** | **16,805 — all of them** |
| R2 backfill cost, priced and NOT run | $0.90 + an index rebuild |

⚠ **§0's mechanism is wrong, and the whole urgency argument rested on it.** The brief says
`&#xa0;` "usually sits BETWEEN TWO WORDS. So the two words are glued into one token." Two
independent measurements say otherwise, and a third says the premise's factual base is wrong too.

---

## §2 FIRST, BECAUSE IT DECIDES EVERYTHING ELSE

### The tokeniser, measured on a local index with the production configuration

`entity-decode-search-test.ts --local` builds a LanceDB table with the exact config copied from
`build-fts-index.ts` (`baseTokenizer: 'simple'`, `stem`, `asciiFolding`, `lowercase`,
`withPosition: false`) and indexes crafted documents alongside clean twins.

| what was asked | verdict |
|---|---|
| a word adjacent to an entity between two words | **✓ unaffected** |
| both words either side, as a two-word query | **✓ unaffected** |
| a word split by a soft-hyphen entity `&#xad;` | **⚠ LOST** |
| a word split by a non-breaking-hyphen entity `&#x2011;` | · not testable — *the clean twin fails too* |
| a word following `&amp;` | ✓ unaffected |
| the entity itself | ⚠ indexed as a junk token `xa0` — index bloat, not lost recall |

**The `simple` tokeniser splits on every non-alphanumeric character.** `Barbara&#xa0;Rayment`
indexes as `barbara | xa0 | rayment` — **both real words survive**, and with `withPosition: false`
there are no phrase queries for the junk token to disrupt.

⚠ **One of my own verdicts was unsound and was corrected before it was believed.** The first version
reported "a non-breaking hyphen inside a word DESTROYS it", because `coordinator` did not retrieve
`co&#x2011;ordinator`. It does not retrieve the clean `co-ordinator` either — the tokeniser splits
on an ordinary hyphen too. Scoring against an absolute expectation blamed the entity for a
pre-existing property of the index. Every verdict now compares a damaged document with **its own
clean twin**, and that case is reported as not testable.

### The token census — the number the recommendation rests on

`entity-decode-census.ts --context`. A token the repaired text has and the raw text does not is a
token no query can reach. Over 200 documents from each of the 16 contaminated corpora:

| repair | tokens recovered | of |
|---|---:|---:|
| decode | **0** | 15,659,766 |
| decode + strip invisibles | **98** | 15,659,766 |

⚠ **My first attempt at this measured the wrong thing.** I classified each occurrence as INSIDE a
word or BETWEEN two by looking at the adjacent characters. That cannot distinguish them:
`Barbara&#xa0;Rayment` has a letter on both sides and loses nothing, `preven&#xad;tative` has a
letter on both sides and loses everything. The difference is what the entity *decodes to*, so the
test had to become token-level.

⚠ **And the 98 are not entities at all.** They come from `scotlawcom`, and a direct check found
**0 soft-hyphen entities and 1,337 literal U+00AD characters** in the same 200 documents. Those are
real soft hyphens in the source text — an adjacent, separate, much smaller defect.

### The live index, and it is honestly underpowered

`--live` against `fts-serve-production`: 40 probes, each an eight-word phrase spanning an entity
against an eight-word control from the immediately preceding window of the same document.

- **31 of 40 retrieved nothing either way.** Over an 18M-document index an eight-word query is
  still not selective enough to guarantee a specific document.
- Of the 9 testable, the **damaged** phrases retrieved their document **7** times and the controls
  **4**. The sign is the wrong way round for the damage hypothesis.

⚠ **Two earlier versions of this test produced confident, wrong numbers, and both are worth
recording because the failure is instructive.** v1 (two-word phrases) left a denominator of two and
reported "50% lost". v2 (eight words, but the control drawn from the longest entity-free region)
reported "62.5% lost" — and every bit of that was a difference in *query specificity and position*:
the damaged phrase came from the document's opening boilerplate while the control came from
distinctive mid-document prose, and the damaged query was polluted with the entity's own debris
(`electricity on the GB xa Alongside this the`). **A control has to be matched for length, register
and position or it measures the control, not the treatment.**

**So §2's answer rests on the token analysis, which is exact, and the live test is reported as the
weak corroboration it is.**

### ⚠ §2's question about numbers already reported: they are NOT floors

The brief asks whether the gold-set recall figures, the ABSENT counts and the tier-fusion
measurement were taken over a partially damaged index. **They were taken over an index that is not
damaged in any way that costs recall.** No previously reported search number needs a caveat on
account of this defect, and no CHANGE_LOG entry needs amending. That is a stronger statement than
"the comparisons still hold", and it is the one the measurement supports.

---

## §1 — THE SPREAD

### Bodies, 150 documents per corpus from R2

16 of 74 corpora carry at least one literal entity. The ones that matter:

| corpus | rows | docs hit | share | occurrences / 150 docs |
|---|---:|---:|---:|---:|
| **`tna-caselaw`** | 74,896 | 143 | **95.3%** | **23,613** |
| `planning-policy` | 64 | 50 | 78.1% | 94 |
| `building-regs` | 21 | 12 | 57.1% | 28 |
| `hmrc-codes-guidance` | 14,067 | 76 | 50.7% | 354 |
| `ots-reports` | 497 | 70 | 46.7% | 211 |
| `oecd` | 505 | 69 | 46.0% | 156 |
| `eur-lex` | 241,571 | 48 | 32.0% | 318 |
| `sentencing-council` | 253 | 34 | 22.7% | 57 |
| `hmrc-tiins` | 791 | 22 | 14.7% | 27 |
| **`committees-evidence`** | 140,567 | 18 | **12.0%** | 4,045 |

⚠ **The corpus that found the defect is not the worst affected.** `tna-caselaw` — 74,896 judgments —
carries an entity in 95% of documents. Nobody was looking there because nothing had gone wrong
loudly enough.

⚠ **The big political corpora are clean**: `pwdata-debates` (6.4M), `historic-hansard` (4.6M),
`pwdata-lords` (753k), `committees-reports` (324k), all legislation corpora — 0 in 150.

**Which entities, by volume:** `&#8217;` 7,653 · `&#8220;` 5,145 · `&#8221;` 5,135 · **`&#xa0;`
3,940** · `&#160;` 1,325 · `&#163;` 1,143 · `&#8230;` 937 · `&#8216;` 932 · `&#8211;` 870 ·
`&#x2011;` 106. **The overwhelming majority are typographic** — curly quotes, dashes, a pound sign —
which are a *rendering* defect and provably not a retrieval one.

### §0's factual base, checked

Reading 300 real `committees-evidence` documents: 43 carry an entity, and the shape
`word&#xa0;word` occurs **0 times**. `&#xa0;` in this corpus is a paragraph spacer standing alone
between spaces — `21 &#xa0; European Affairs Committee` — not a substitute for a space between two
words. So even if gluing mattered to the tokeniser, it is not what is happening.

### §1.3 — does it reach the user? Yes, and this half is exhaustive

Titles are in Neon, so no sampling was needed. **4,532 of 18,521,104 titles (0.02%)** carry a
literal entity, concentrated rather than spread: `ofcom` 21.2%, `ni-judgments` 19.2%, `ofgem` 5.8%,
`cps-guidance` 4.1%. Plus **10,660 `speaker` values** and **1,613 `attribution` values**, and 0
`sourceUrl`. A title and a speaker are rendered straight into a search result, so this is visible
damage rather than index damage — and it is the half worth fixing.

⚠ **Also found, and a different defect: 73 titles contain `&#65533;`** — U+FFFD REPLACEMENT
CHARACTER, which is what a failed decode leaves behind. Those bytes are already lost and no
decoding recovers them. `uk-treaties-fcdo` has "Convention concerning Seafarer&#65533;s Hours of
Work". Reported, not fixed: it needs a re-fetch, not a decoder.

---

## THE ROOT CAUSE, NAMED EXACTLY

`sources/committees-portal.ts` decoded a hand-written list:

```ts
.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
.replace(/&gt;/g, '>').replace(/&#x2013;/g, '–').replace(/&#x2014;/g, '—')
```

**`&nbsp;` is decoded. `&#xa0;` — the numeric form of the very same character — is not.** The list
was not wrong about anything it named; it was incomplete, and a hand-written list always will be.
The same file had a second copy of the same list for titles, with the same omission.

**And it is a class defect, now counted: 17 source files decode HTML entities from hand-written
lists**, and none of them decodes a numeric entity.

---

## §3 — FIXED AT THE LAYERS THE MEASUREMENT SUPPORTS

**1. One decoder — `shared/html-entities.ts`.** Named list plus the numeric forms, 26 self-tests.
§3's "do not decode blindly" is enforced by refusals that are asserted to fire: `&c;` from old
statute, an unknown named entity, an out-of-range codepoint and a lone surrogate are all **left
exactly as they were** rather than replaced with a space.

⚠ **Two things in that decoder were found by reading its own output, not by knowing the spec:**

- **`&#145;` must map through Windows-1252, not straight to Unicode.** A real Hansard title reads
  `&#145;inadvertent breach&#146;`. Decoded naively that is U+0091 — an **invisible C1 control** —
  so the repair would have deleted the quotation marks rather than fixing them. 73 titles carry one.
- **LF, CR and TAB must be decoded even though other C0 controls must not.** 28 `pwdata-debates`
  speaker values read `&#10;   Dr. DRUMMOND&#13;&#10;   SHIELS&#10;`. My first version refused all
  C0 controls and left those 28 unreadable in exactly the place a user sees them.

**2. The compiler — repaired.** `committees-portal.ts` now calls `decodeForIndex` for both body and
title. Future documents arrive clean.

⚠ **The first version of that fix was INERT** — it decoded into a new variable and returned the old
one. `check-entity-decode.ts` now asserts that every value assigned from the decoder is read
afterwards, and that assertion was **watched failing on the exact broken form and passing on the
fixed one**.

**3. The user-visible columns — repaired, all 16,805.** `entity-decode-fix.ts --titles --apply`.
Every column was read back after writing and reconciled against the prediction: `sectionTitle`
4,532 → 0, `speaker` 10,660 → 0, `attribution` 1,613 → 0.

**4. A ratchet, not a clean bill of health.** `npm run check:entity-decode` records the 16 remaining
hand-rolled decoders as a baseline and fails only if the number **goes up**. Failing the build on a
pre-existing backlog gets checks disabled; a new source arriving with a hand-written list is the
thing worth blocking.

**5. The R2 backfill — priced and NOT run.** ~184,000 objects, $0.90 in R2 operations, ~26 minutes,
**plus an FTS rebuild through the Heavy Job Runner and re-embedding of every changed chunk, which
is the real cost.** On a measured recall damage of zero that spend buys nothing for retrieval.

▶ **CHARLIE'S CALL, and it is a genuine choice:** decode-at-render in the search adapters (cheap,
immediate, covers all 16 corpora at once, but every future reader has to remember) versus the
one-off R2 rewrite (permanent, the stored text finally matches the source, and the index rebuild
comes with it). **My recommendation is decode-at-render now and fold the R2 rewrite into the next
reprocessing pass that is happening anyway** — the entities have been there for two months without
costing a single search result, so they can wait for a bus rather than get a taxi.

---

## §4 — THE PREDICTION, AND WHAT IT COST

This sprint spent **no LLM tokens at all** — every measurement is a query, an R2 read or a local
index. The only spend is R2 Class B reads for the census: roughly 15,000 documents across the two
passes, about **$0.005**.

The reprocessing cost §4 asks to be predicted before running is above, and the run is deferred with
its reason.

---

## VERIFICATION

- `npm run check:html-entities` — **26/26**, including six refusal cases and the two output-derived
  corrections
- `npm run check:entity-decode` — all pass; the inert check watched failing first
- `entity-decode-census.ts --self-test` — **17/17**, including four negative controls that stop the
  pattern firing on `Marks & Spencer` and `&#160` without a semicolon
- `tsc --noEmit` clean for every file this sprint added
- the repair reconciled by reading back all three columns, not by trusting the write

## WHAT IS NOT DONE

- **The 16 remaining hand-rolled decoders**, held at a baseline that cannot grow.
- **`tna-caselaw`'s 95%** — the largest contamination, untouched. It is typographic and costs no
  recall, but it is 74,896 judgments and it is the first thing a backfill should cover.
- **The R2 backfill**, deferred with a price and a recommendation.
- **73 titles with U+FFFD** — already-lost bytes, needing a re-fetch rather than a decoder.
- **Literal U+00AD in `scotlawcom`** — 1,337 characters in 200 documents, a separate defect that
  the strip half of `decodeForIndex` would fix on a reprocess.
