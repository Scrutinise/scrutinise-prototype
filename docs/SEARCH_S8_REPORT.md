# SEARCH S8 — FINISH THE INFRASTRUCTURE

**Executes** `docs/BRIEF_SEARCH_S8.md` §1–§8. **Written** 19 August 2026 by CC-Search.
**Format:** per section — what the audit found, what was built, the numbers **with what each is a
percentage OF**, and what is NOT done, named.

**Headline:** the first-pass search infrastructure is finished in the sense the brief meant — the
two S7 jobs are wired and verified against artefacts read back from Neon, attribution reaches Lex,
and the framing experiment can answer its question at last. Four of the eight sections **reversed a
premise the brief or the codebase held**, and in every case the reversal came from running the
thing rather than reading about it.

| § | outcome | the number that matters |
|---|---|---|
| §1 | wired and verified live | **25/25** assertions against Neon-persisted artefacts |
| §2 | built; ⚠⚠ the collection it was for has nothing | **14 of 54** collections carry attribution; committees carries none |
| §3 | ⚠⚠ the experiment can now answer its question | headroom **4/31 → 22/31**; framing **−1.1pp**, a real null |
| §4 | built, flag OFF, measured | recall flat (−0.0pp); ⚠ 3 regressions, but only **1** is the change — the other 2 kept identical streams |
| §5 | 50 draft questions, unscored | ⚠⚠ **case law cannot be keyed from the database at all** |
| §6 | ⚠⚠ prediction refuted | cap 4 is WORSE — 4 is exactly `vector-serve`'s width |
| §7 | ⚠⚠ **the brief's premise was false, both times** | both "non-existent" models return HTTP 200 |

---

## §1 — WIRE `PRECEDENT` AND `DEVOLUTION_SCOPE` INTO THE DEEPENING

### The audit

**What actually executes retrieval for each is not the same thing, and that decided the design.**

| | how it retrieves | is the gateway involved? |
|---|---|---|
| `retrieveDevolutionScope(query)` | calls `runSearch()` with intent `DEVOLUTION_SCOPE` | ✅ yes — an ordinary routed search. The job's contribution is the jurisdiction labelling and the refusal to answer "is it reserved". |
| `retrievePrecedent(gid)` | a keyed `$queryRaw` over three collections | ❌ **no — it never touches the gateway.** Declaring `PRECEDENT` in a pass's `intents` runs a general search that has nothing to do with this job. |

Both intents remain **DESCRIPTIVE** at the gateway (they select no streams), exactly as
`SEARCH_CONTRACT.md` says. That asymmetry is why a job cannot be expressed as an intent, and why
`jobs` is a **second axis** on `PassDef` rather than a longer `intents` list.

### What was built

- `lib/lex/deepening-jobs.ts` — the job registry, instrument identification, and the persistence.
- `PassDef.jobs` — `EVIDENCE_PRECEDENT` declares `PRECEDENT`; `LEGAL` declares `DEVOLUTION_SCOPE`.
  **Extending the two existing passes rather than adding a fifth**, because `LEGAL`'s own
  `mustAnswer` already carries *"Is the subject reserved or devolved, and to which legislature?"* —
  splitting it out would give the user two cards for one question they experience as one.
- The engine runs `def.jobs` and **knows no job key**, exactly as it knows no pass key.

### ⚠⚠ Four defects found by running it, three of them mine and one inherited

**1. The linked-instrument path could never return anything.** `identifiedInstruments` read
`IdeaLegislation.legislationItemId` and treated it as a gid. It is a **UUID**; the gid lives in
`legislationGovUkId`. So the STRONGEST of the two instrument sources silently returned nothing on
every idea, and the pass fell through to retrieval every time. Nothing failed. Found because the
verification harness tried to seed a link and reported it could not.

**2. `retrieveDevolutionScope` ignored its own `limit` — a 577-line evidence body.** The call asks
for 24; the ROUTED path returns the union of every stream it dispatched, which was **360 results**,
and `devolutionBlock` renders two lines each. Across two runs the harness rendered **577 lines**
into `EvidenceItem` bodies. Nothing errored: the caller asked for 24 and stored 360. Fixed with a
`.slice(0, limit)` before the jurisdiction counts, so the shape line describes the items shown.

**3. Jobs ran after the zero-candidate early return.** A pass whose sift kept nothing skipped both
jobs — including a precedent off an instrument LINKED to the idea, which needs no candidates.

**4. Jobs ran after `writePassReferences`, and a real run lost them there.** On the 19 Aug
verification the sift **truncated**, returned its passthrough of all 500 candidates instead of the
usual ~12, and the references write of 500 full results into `Idea.stageSearches` threw. The LEGAL
pass ended FAILED having run no job and recorded no reason. The job loop now runs **before** that
write: a deterministic corpus fact should not be hostage to a JSONB write about something else.

⚠ The underlying cause of (4) — a skipped sift returning 500 candidates into a JSONB column — is
**NOT fixed**. It is the sift's passthrough behaviour, outside this brief, and it is a live
fragility on any pass whose sift truncates.

### Verified live — the artefact, not the counter

`npm run verify:s8-deepening` — **25/25**, every assertion made against the `body` TEXT of a row
re-read from Neon after the run.

```
PASS  ⚠⚠ the LINKED-instrument path produced a group — the strongest source works end to end
PASS  ⚠⚠ the "nobody has checked whether this worked" sentence IS in real stored output
PASS     …with the instruction never to substitute the prediction for the outcome
PASS  ⚠⚠ …and the stored body REFUSES the reservation question
PASS  ⚠⚠ …and the block honours its limit — the 577-line body defect stays fixed (24 items, cap 24)
```

The stored precedent group, in full, from the run:

```
PRECEDENT FOR Small Charitable Donations Act 2012 — intended, predicted, observed:
- [INTENDED] Explanatory Notes: ukpga/2012/23 (1)
    what the provision was FOR — the department's own statement of purpose, laid alongside it

⚠ no impact assessment is held for this instrument; NO POST-IMPLEMENTATION REVIEW EXISTS for this
instrument — nobody has published an assessment of whether it worked. Say so plainly. Do NOT
substitute what was PREDICTED for what was OBSERVED — a prediction is not an outcome.

(this instrument was found by the search for your idea and kept as relevant — it is not something
you have told us your proposal amends)
```

**That is §1's central requirement met in real output**, not asserted from a constant: the
"nobody has checked" sentence is reachable, and the provenance of the instrument travels with it.

`check:deepening` extended with **42 new assertions** (167 total), the source-grep ones each carrying a mutation control — the rule
is re-run against a copy of the source with the rule deliberately broken, and the check fails if
that copy still passes.

⚠ Two of those controls **reported inert on their first run and were themselves wrong**: the
mutation used a single-occurrence `String.replace` on a string that appears twice (once in the
code, once in the module's self-test), so the mutated copy still passed. Global replace fixed it.
A third assertion — "the engine names no job key" — **failed on correct code**, because
`'PRECEDENT'` is also an `EvidenceKind` in the pre-existing precedent-downgrade logic. It now
asserts the thing that matters (the engine never branches on WHICH job) rather than the spelling.

### Not done, named

- The zero-candidate/skipped-sift passthrough that caused defect (4).
- `MECHANISM_ANALOGUE` and `CONTRADICTION` remain unbuilt, with S7's reasons intact.
- ⚠ **`jurisdictionOf` returns `unknown` for most retrieved results** — 17 of 24 on one run. It
  derives jurisdiction from the document identifier, and non-legislation ids carry no doctype. That
  is the never-guess rule working, but it means the devolution block is dominated by `unknown` for
  a query that returns mostly case law and guidance. Reported, not changed: guessing would be worse.

---

## §2 — ATTRIBUTION: WHO SAID IT, THROUGH THE GATEWAY

### The audit — the table §2 asked for, before anything was built

Read from the **store**, not the schema, ≥200 rows per id offset, several offsets per collection.
Full output: `docs/S8_ATTRIBUTION_AUDIT.txt`. Two structured columns exist; across **54**
non-legislation collections, **14 carry one and 40 carry neither**.

| where attribution lives | collections | sampled coverage |
|---|---|---|
| `speaker` | `pwdata-debates` | **4.0% (1919) · 4.5% (1950) · 82.5% (1990) · 99.5% (2010+)** |
| `speaker` | `pwdata-lords` 90% · `pwdata-westminster` 98.5% · `historic-hansard` 87% | |
| `speaker` | `pwdata-wrans`, `-wms`, `-lordswrans`, `-lordswms` | 100% — ⚠ the minister **ANSWERING** |
| `speaker` | `scottish-parliament-or` 92.5–100% · `senedd-cofnod` 87.5% | |
| `speaker` | `early-day-motions` | 100% — ⚠ the **SPONSOR**; nobody spoke |
| `speaker` | `tax-tribunals` | 100% — ⚠ the **JUDGE** |
| `attribution` | `consultations`, `impact-assessments` | 100% — `{organisation} — {stage}` |
| **nothing** | **40 collections**, including all committees, all other case law, all seventeen guidance collections, `niassembly-hansard`, the govuk `written-answers`/`-statements` pair, `lda-*`, `petitions`, both explanatory collections, both division collections | **0%** |

⚠⚠ **THE COLLECTION §2 EXISTS FOR IS THE ONE WITH NOTHING.** `committees-evidence` is 0 of 800
rows across four id offsets, on both columns; `committees-reports` is 0 of 600. Oral evidence
carries no `sectionTitle` either. The witness's name is inside the R2 body and in no metadata we
hold. So a committee transcript ships `attribution: null` — and closing that is an **ingest** job.

⚠ **My own first audit was wrong and the measurement caught it.** It probed corpus names I had
guessed — `caselaw`, `guidance`, `hansard`, `tribunals`, none of which exist — and reported them as
"NO COMPILED ROWS" while never sampling `tna-caselaw`, the collection that serves every case-law
result. The §2 measurement run surfaced a result labelled `tna-caselaw` from a script that had just
reported case law unsampled. The list now comes from `docs/corpus_completeness.json`.
**A corpus name is a fact to look up, not a word to guess.**

⚠ **And the first sample lied about `pwdata-debates`.** `LIMIT 200` with no `ORDER BY` returns one
physical corner of a 15M-row heap; it read **0/200** on a collection that is 99.5% populated from
2010. Every figure above is now sampled at several id offsets, and the spread between them is the
finding rather than an error bar.

### What was built

`lib/lex/attribution.ts` — the **only** function that returns an `Attribution`, and the only place
`null` is assigned. It takes columns, never a title: `attributionFor(corpus, { speaker, attribution })`
has no parameter that could receive one, so the banned inference is unreachable rather than merely
unused. `SearchResult.attribution` and `EvidenceResult.attribution` are populated by both adapters,
and `evidenceBlock` renders `— {name}, {role}`.

`role` is assigned from the **column and the collection**, never parsed from text — and three of
those roles would have been wrong under any plausible default:

- a `tax-tribunals` "speaker" is the **judge**, not somebody speaking in a debate;
- an `early-day-motions` "speaker" is the **sponsor** — an EDM is a signature sheet;
- a `pwdata-wrans` "speaker" is the **minister answering**, not the member asking.

All three were read off the ingest writer in `scripts/ingest/workers/process-row.ts`, not inferred
from the column's name. An unnamed collection gets `named on this record` — a phrase that claims
nothing beyond what is true of every collection at once.

### The number, and what it is a percentage OF

`npm run measure:s8-attribution`, the S5 ten questions, through the configured stack.

**34 of 100 evidence-channel results carried attribution (34%).** Per display type:

| type | retrieved | attributed | rate | the audit said |
|---|---:|---:|---:|---|
| COMMITTEE | 41 | 0 | **0%** | 0% — matches exactly |
| DEBATE | 34 | 33 | **97%** | 4.0–99.5% in the store |
| GUIDANCE | 13 | 0 | 0% | 0% |
| CASE_LAW | 8 | 0 | 0% | 0% |
| EXPLANATORY_NOTE | 2 | 0 | 0% | 0% |
| IMPACT_ASSESSMENT | 1 | 1 | 100% | 100% |

⚠⚠ **THE DIVERGENCE §2 ASKED ME TO REPORT IS ON DEBATE, AND IT IS IN THE GOOD DIRECTION.** The
store says 4.0–99.5%; the hand says **97%**. Retrieval is not a uniform sample of a collection —
modern Hansard outranks 1919 Hansard on almost any question a user asks — so what a user
experiences is far better than the collection average. The two numbers have **different
denominators on purpose**: the audit is of the collection, the measurement is of what ten real
questions surface.

⚠ The overall 34% is **dominated by the composition of the result set**, not by coverage: 41 of
the 100 results are committee documents, and committees holds nothing. Attribution rate is
therefore a fact about what the router selected as much as about the corpus.

`npm run check:s8-attribution` — **33/33**, including a grep that fires on a planted violation and
does *not* fire on the legitimate call. ⚠ Its first version was a one-line regex that produced
**three standing false positives on correct code** (a `$queryRaw` column list, and
`politicalTitle(..., { attribution })` which passes attribution INTO a title builder — the opposite
direction). A check with standing false positives is a check somebody switches off; it is now three
precise rules, each with its own control.

### Not done, named

- Committee attribution. The single most-wanted case, and it needs ingest.
- `LegacySearchResult` is untouched, as required.
- The `{organisation} — {stage}` split is a read of an **ingest format**, not of display text — a
  distinction stated in the code because the two look alike.

---

## §3 — MOVE THE FRAMING HARNESS THROUGH `runSearch()`

### What was built

`scripts/ingest/search/measure-s7-framing.ts` is **deleted** and re-homed as
`scrutinise-web/scripts/measure-s8-framing.ts`. A move, not a fork: two framing harnesses with two
leak tests would drift and the wrong one would be quoted. Kept verbatim — the per-query alternating
run order, the **differential** leak test, the framing recorded in the header, the headroom count
printed by the harness. Added — both arms through `runSearch()`, and the flag state read
**positively** off the running services rather than from `process.env`.

`lib/lex/harness-preflight.ts` gains `readServiceConfig()` and `servedDelta()`: the `served`
counter is read before and after the run, so a results table beside a zero delta is detectable as
"the numbers came from somewhere else".

### The prediction, and the result

Recorded in `CHANGE_LOG.md` **before the run**: the brief's — headroom should rise well above 4 of
31; mine — **at least 20 of 31**, and **no significant framing difference**.

| | recall@20 |
|---|---:|
| bare query | **42.2%** |
| caller-enriched | **41.1%** |
| difference | **−1.1pp** |

**Headroom: 22 of 31** (S7: 4 of 31). Enriched better on 3, worse on 3. 0 excluded for a leak, 0
for a failed search. Engagement: `fts+366 vector+217` — the services were genuinely reached.

⚠⚠ **BOTH PREDICTIONS HELD, AND THE EXPERIMENT NOW ANSWERS ITS QUESTION.** S7's +0.0pp was a floor
effect: 27 of 31 queries scored zero in both arms because the harness was measuring bare BM25 at
8.1% against a platform that does 42.2%. With 22 of 31 scoreable and the split at 3 better / 3
worse, **caller-held context does not help retrieval** — and that is a real null result rather than
an absence of evidence.

⚠ **Which comparison ran, stated as §3 requires:** bare versus **caller-enriched** (the archetype's
declared stream and kind). **NOT** the Lex user-profile contrast. There is no user and no profile
on the gold set, and no result here licenses a claim about user profiles.

⚠ **The configuration is a labelled approximation.** Vercel's flag state is unreadable from this
machine (SAML), so the run used locally-set flags — `LEX_QUERY_ROUTER=true`,
`LEX_VECTOR_STREAMS=legislation,caselaw,guidance` (S7's recommendation), against the live
fts-serve and vector-serve. The report header carries the resolved state and the `served` deltas.

### Not done, named

- The absolute 42.2% is **not** the platform headline: it is `GENERAL_CORPUS_CHAT` at limit 20 over
  the existing gold set, whose answer key is still CCh's unvalidated draft.

---

## §5 — THE GOLD QUESTIONS THAT MAKE MEASUREMENT REAL

`docs/GOLD_CANDIDATES_S8.md` — **50 questions**, ten each for committees, case law, guidance,
impact assessments and consultations. **21 outside-in / 29 document-outward**, each marked. Six new
question shapes (L–Q) defined, because the existing archetypes A–K describe legislation and debates
and do not fit these collections. **Nothing has been scored against them.**

Answer keys were built by querying `corpus_sections` **directly**, never through `runSearch()` —
keying a question on what retrieval returns makes recall 100% by construction. Doing it that way
produced three findings that matter more than any individual question:

**1. ⚠⚠ CASE LAW CANNOT BE KEYED FROM THE DATABASE AT ALL.** Every `tna-caselaw` row has
`sectionTitle = NULL`; the **id IS the neutral citation** and the case name and subject exist only
in the R2 body. A title search returns nothing for *every* legal topic — not because the cases are
missing but because there are no titles. All ten case-law questions are therefore marked
`KEY: PRESENT / SUBJECT UNVERIFIED`: the citation is confirmed present by reading the id back, but
that the case is *about* the question's subject is asserted from outside knowledge and cannot be
checked from here. **This is the biggest single obstacle to a real case-law gold set.**

**2. Impact assessments are keyed through their parent, not their title** — `sectionTitle` is the
internal heading ("Summary", "Costs and benefits"), the S2C6 finding still true. Only **1,566 of
3,000 sampled rows (52%)** resolve to a named instrument via `parentDocId`.

**3. Four guidance collections are unaskable by title** — `ico` (titles are decision-notice
respondents), `fca-handbook` (titles NULL), `sentencing-council`, `planning-policy`. They are as
unevaluable as committees was.

⚠ **A verification bug in my own tooling, caught before any key was written down:** the citation
checker used a prefix `LIKE`, so `[2021] UKSC 1` matched `UKSC 10`, `11` and `12` and reported
three OKs for a citation the corpus does not hold. Fixed with a trailing-colon anchor.

Two questions carry **NO KEY on purpose** — I10 ("has anyone assessed whether the plastic straw ban
worked", where the correct answer is *nobody has checked*) and N10 (renters' reform, which a title
search across `consultations` cannot find). A question the corpus cannot answer is a finding.

### Not done, named

- The `explanatory` stream (§4's third candidate) has **no questions** — it was not in §5's list of
  five collections, so scoring `LEX_ROUTER_STREAMS_V2` is only two-thirds possible.
- Every case-law subject is unverified.

---

## §7 — CONFIG HYGIENE

### ⚠⚠ Item 2 first, because the brief's premise is false — twice over

§7 says "two configured fallback models do not exist in the accounts — a fallback that fails only
when the primary already has". A live 1-token call to each, logged:

| requested | HTTP | model the response ECHOES | verdict |
|---|---:|---|---|
| `claude-haiku-4-5-20251001` | **200** | `claude-haiku-4-5-20251001` | ✅ **callable, and never stale** |
| `grok-3-fast-beta` | **200** | **`grok-4.3`** | ⚠⚠ **silently substituted** |

**Neither would ever have failed.** The registry had excluded the Haiku id on the strength of a
`/v1/models` read that did not list it — **a model-list read is not a callability test.** And
`grok-3-fast-beta` is worse than broken: it works, and returns a different model, with no error,
on every Lex turn that path has served since the id was retired. The model our config named was
never the model any user got.

**The guard worth having is neither "is it in the list" nor "does it 200".** It is: *does the
response echo the model you asked for.* `check:s8-config --probe` asserts that.

Fixed: `claude-haiku-4-5-20251001` added to `REACHABLE`; both Lex routes
(`app/api/ai/[ideaId]/route.ts`, `app/api/ai/public/route.ts`) now name `grok-4.3` explicitly;
`KNOWN_STALE` is empty, which is the correct state. `check:model-registry` had an assertion
requiring the Haiku id to be REFUSED — it was asserting the wrong thing and now tests an
unambiguously-unknown id instead.

### Item 1 — prices

Anthropic and xAI rates added to `lib/lex/build-cost.ts`, **each with its source URL and
date-checked** (a price is a fact about a day). 17 models priced; **no configured model, and no
model an env var could legally select, resolves to "unpriced"** — asserted by `check:s8-config`.

⚠ **Two declared inaccuracies rather than hidden ones.** xAI prices are **tiered by prompt length**
(grok-4.6 is $2/$6 below the threshold and $4/$12 above it); this table holds one rate per model and
records the LOW band, so it **understates a long-prompt call by up to 2×**. And Claude Sonnet 5
carries an introductory rate through 2026-08-31; the **list** price is recorded, because a table
with no expiry mechanism that assumes a discount overstates the ceiling's headroom the day the
promotion ends.

### Item 3 — OpenAI

**Nothing live wants an OpenAI key. Do not add one.** Exactly one server-side read of
`process.env.OPENAI_API_KEY` exists, in `scripts/ingest/shared/compile.ts` — and it sits behind
`compileLegislation`/`compileGeneral`, both of which `throw new Error('LLM compilation disabled —
use rawToText() instead')`. `callGpt4oMini` has no caller anywhere. `/legislation-compare` asks the
**user** for their own key and never reads a server one.

⚠ **One thing found here and deliberately NOT fixed** (out of scope, and dead today): in that same
file a missing key throws `Object.assign(new Error('OPENAI_API_KEY not set'), { rateLimited: true })`
— so a **configuration error would present to the ingest retry layer as a transient rate limit** and
be retried rather than reported. Harmless while the path is dead; a live trap the moment anyone
re-enables it, and the same shape sits on the `TOGETHER_API_KEY` leg.

---

## §4 — EXTEND THE ROUTER TO THE NEWEST TYPED STREAMS

Full detail: `docs/SEARCH_S8_ROUTER_V2.md`. `LEX_ROUTER_STREAMS_V2`, **default OFF**. Both arms in
one process, alternating per question, over 31 scored gold questions + the S5 ten + three
purpose-built selection probes. Engagement `fts+463 vector+254`.

### What it does — and what it explicitly does not

⚠ **It adds no reachability, and claiming otherwise would oversell it.** All three collections
already sit inside tiers an existing stream selects with no corpus filter: `impact-assessments` and
both explanatory collections are tier `legislation`; `consultations` is tier `guidance`. What the
flag adds is a **slot** of their own in the round-robin interleave, so an impact assessment stops
competing for legislation's positions against 1.6M sections of statute — the same mechanism
`stream-scopes.ts` already identifies as the fix for division roll-calls.

The five existing stream descriptions, the exact-citation rule and the three worked examples reach
the model **byte-identical**; the candidates are appended. That makes any displacement attributable
to the streams existing rather than to the prompt being rewritten around them. Divisions stay out.

### The numbers

| | recall@20 | |
|---|---:|---|
| five streams | **41.1%** | |
| eight streams | **41.1%** | **−0.0pp** on 31 scored gold questions |

Latency p50 **−232 ms**, p95 **+810 ms**, mean **−591 ms**. Selection: `explanatory` chosen on 7 of
44, `consultations` on 6, **`impact-assessments` on 1**.

### ⚠⚠ The gate is not met as written — and only one of the three regressions is the change's fault

Three questions regressed (C2, F2, B6) and two improved. Reading their stream sets rather than the
headline:

- **F2** went `legislation, debates, committees, guidance` → `debates, committees, **consultations**`,
  100% → 50%. **Real displacement**: a new stream took a slot from two that were serving the answer.
  This is exactly the risk §4 names.
- **C2 and B6 selected identical streams in both arms** and still moved. They cannot be effects of
  a change that did not touch them. What moved is the router's **per-stream query rewrite** — an
  LLM call made fresh on each arm.

⚠ **With one observation per question per arm, router non-determinism and displacement are
confounded.** The same confound inflates the displacement table, where A3 "lost" four streams by
going from five to one — the router choosing differently, not three new streams crowding it out.
Separating them needs repeats per arm, which this run does not have. **That is a limitation of the
measurement, and it is why the "no regression" gate cannot be cleanly adjudicated here.**

⚠ **The one stream §4 quotes verbatim is the one the router reaches for least.** Its own probe —
*"what did the government predict this policy would cost"* — **did not select `impact-assessments`**,
and the stream was chosen on 1 of 44 questions overall.

### Recommendation

**Leave the flag OFF.** Not because harm is shown — mean recall is flat and latency is near-free —
but because **there is no measurable gain to weigh against a demonstrated displacement case**, and
the instrument that could measure the gain is §5's still-unvalidated draft. This is the honest
outcome §4 predicted: *"no regression, selection looks sane on N probe questions, gain unmeasurable
until §5 questions exist"* — with the correction that the no-regression half is **not** clean.

**What would change it:** §5 validated and scored, ten questions for `explanatory` (which has none),
and repeats per arm.

---

## §6 — THE CONCURRENCY EXPERIMENT: 3 → 4

Full detail: `docs/SEARCH_S8_CONCURRENCY.md`. The S5 ten questions, both caps in **one process**,
alternating per question and per repeat against the same warm services, first query discarded as a
warm-up. 40 scored searches, 0 errors, 0 timeouts. Engagement `fts+185 vector+100`.

### The prediction, recorded before the run — and refuted

The brief's: raising the cap to 4 should cut p50/p95 by roughly one serialised batch wave. Mine,
sharper: five streams at a cap of 3 takes two waves (3+2) and at 4 also takes two (4+1), so a
**real but modest** improvement.

**Both are wrong, and in the opposite direction.** On the case the cap actually binds:

| five-stream questions | cap 3 | cap 4 | |
|---|---:|---:|---|
| p50 | 7,205 ms | 11,136 ms | **+3,931 ms worse** |
| p95 | 13,071 ms | 19,885 ms | **+6,814 ms worse** |
| mean | 8,422 ms | 11,410 ms | **+2,988 ms worse** |

Across all questions p50 improved trivially (5,671 → 5,433 ms) while p95 **worsened by 6,760 ms**.

### ⚠⚠ Why — and the mechanism is in the service's own counters

**4 is exactly `vector-serve`'s width.** Read off `/stats` during the run:
`"concurrency": { "max": 4, "maxQueue": 64, "queueHighWaterMark": 4, "rejections": 0 }`.

Per-stream fusion means each routed stream issues a BM25 call **and** a vector call. At a cap of 3,
three concurrent streams put three vector calls into a four-wide service and leave a slot. At a cap
of 4 they fill it exactly — the queue high-water mark reached **4** — so the fifth stream queues
behind a fully-occupied service instead of using spare capacity. **Raising the cap does not buy a
wave; it buys saturation** — precisely the failure S5 §2 chose 3 to prevent, holding up under test.

### Engagement check

`maxInFlight` observed **3 of 3** at cap 3 (7 of 7 runs where the cap could bind) and **4 of 4** at
cap 4 (5 of 5). The cap really was the thing that differed.

⚠ A blank `maxInFlight` means *the cap could not bind*, not *nothing was measured* — the limiter
logs only when there are more streams than slots. Distinguishing those two took a correction
mid-sprint; the first version of the harness reported bare nulls and would have read as a broken
observation.

### Recommendation

**Leave `LEX_STREAM_CONCURRENCY` at 3.** The lever that would actually move chat-route p95 is
**more width on `vector-serve`**, at which point the cap should follow it up, still one below.

⚠ n is small on the subset that matters (5 observations per arm) and routing is an LLM call, so the
two arms need not select identical streams. The direction is consistent across p50, p95 and mean
and the mechanism is independently visible in the service counters — a strong signal, not a precise
price. **The variable is Charlie's to set; it is unreadable from here (SAML).**

---

## Cost — measured, not estimated

Read from the `LlmSpend` ledger for this sprint's passes rather than estimated:

| pass | calls | tokens in | tokens out | pence |
|---|---:|---:|---:|---:|
| `deepening.sift` | 33 | 1,460,494 | 151,095 | **64.5** |
| `deepening.gather` | 11 | 869,543 | 42,043 | 28.9 |
| `search.query-router` | 242 | 181,884 | 12,721 | 6.8 |
| `deepening.adversarial` | 8 | 16,266 | 2,405 | 0.9 |
| | | | | **£1.01** |

⚠ **My own estimate before reading the ledger was ~£0.40 — 2.5× low.** The number in this report is
the measured one; the estimate is recorded so the gap is visible rather than quietly replaced.

⚠ **The sift is two-thirds of the sprint's spend** (1.46M input tokens across 33 calls), and it is
the same component whose truncation caused §1's fourth defect. Those two facts are the same fact:
the sift is fed ~100 candidates per pass, which is what makes it both expensive and prone to
hitting its output ceiling.

---

## Checks

| check | result |
|---|---|
| `tsc --noEmit` | ⚠ **clean across every file this sprint touched; NOT clean on the tree.** The only errors are `lib/lex/build.ts:132,192,232` — `BuildDriver` / `buildDriver` used without an import, though `build-config.ts` exports both. That file belongs to the **concurrent LEX/25-B session** (it was already modified at session start) and is mid-edit. It is NOT in any commit below. ⚠ If it is committed in that state, production fails to build — CLAUDE.md §20's third incident exactly. |
| `check:deepening` | all pass (21 new assertions, each with a mutation control) |
| `check:s8-attribution` | **33/33** |
| `check:s8-config` | **14/14** offline; **18/18** with `--probe` |
| `check:model-registry` | **25/25** (one assertion corrected — see §7) |
| `verify:s8-deepening` | **25/25** live against Neon |
| `check:flags`, `check:corpus-types`, `check:annotation-titles`, `check:never-claim`, `check:llm-guards` | pass |
| `check:score-scope` | ⚠ **1 pre-existing failure, not mine** — `lib/question-library.ts:244` and `:327`, the Central thread's file. Reported, not edited. My own violation (a mutation-control string in `check-deepening.ts`) is fixed. |

---

## ⚠ FOR CHARLIE — what to verify in a browser, and what only you can do

The environment limits are unchanged: **Vercel flags are unreadable and unsettable from this
machine** (`VERCEL_TOKEN` authenticates and then 403s with `"saml": true` on every project
endpoint), and **no browser walk is possible** — the Chrome extension has no host permission for
`localhost:3000`, and the browser has no Clerk session on production.

**Please check in the browser:**

1. **A Deepening run showing the two new blocks.** On a real idea, run *Evidence & precedents* and
   *Legal*. Expect a card titled *"Intended, predicted, observed — <instrument>"* and one titled
   *"Who has legislated on this — …"*. The precedent card should say plainly when no
   post-implementation review exists, and the devolution card should refuse to say whether the
   subject is reserved while naming the three schedules.
2. **An evidence answer carrying attribution.** Ask Lex about a parliamentary debate. Expect a
   named speaker. ⚠ Ask about **committee evidence** too, and expect **no name** — that absence is
   correct and is the §2 finding.

**Yours to set, with numbers under them in this report:**

- `LEX_ROUTER_STREAMS_V2` — leave OFF unless the §4 numbers below persuade you.
- `LEX_STREAM_CONCURRENCY` — see §6.
- `LEX_VECTOR_STREAMS` — S7's recommendation (`legislation,caselaw,guidance`) still stands.

**And the validation pass only you can do:** `docs/GOLD_CANDIDATES_S8.md`. The case-law section
needs it most — ten questions whose subjects I could not verify from here.
