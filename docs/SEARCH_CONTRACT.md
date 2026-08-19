# SEARCH CONTRACT — what can be asked of the corpus, and what comes back

**Status:** STANDING REFERENCE. ⚠ **A contract that has drifted is worse than none, because the next
reader trusts it.** Whoever changes what search can do updates this file **in the same commit**.
**Last verified:** 19 August 2026, against the running system and the code, not from memory.
**Owner:** CC-Search. **Audience:** every other stream — Lex, Graph, Central, Ingest.

This document exists because other streams have been building against guesses. It is written in
plain terms, not internal names: **`pwdata-debates` is not a thing anyone outside search should have
to know.**

---

## 1. What the corpus holds

**18,272,362 compiled documents across 74 collections — 6.37 billion words.** Every one is stored in
full and retrievable; nothing here is a summary or an abstract.

| What it is, in plain terms | documents | words |
|---|---:|---:|
| **What Parliament said and how it voted** — Commons and Lords debates back to the nineteenth century, written and oral questions, ministerial statements, division roll-calls, early day motions, public petitions, plus the Scottish Parliament, Senedd and Northern Ireland Assembly | 15,128,838 | 2.58bn |
| **The law itself** — every UK Act and statutory instrument, the devolved and regional equivalents, retained EU law, and the explanatory notes and memoranda that came with them | 1,633,583 | 245m |
| **What committees were told and concluded** — select committee reports and the written and oral evidence submitted to their inquiries | 464,718 | 721m |
| **What courts and tribunals decided** — UK case law, Northern Ireland judgments, Scottish courts, employment and tax tribunals, and Strasbourg | 405,622 | 1.18bn |
| **What regulators and government advise** — HMRC manuals, the FCA Handbook, Ofcom, Ofgem, the ICO, the CMA, CPS guidance, the College of Policing, the Sentencing Council, planning policy, building regulations, arm's-length-body publications | 329,711 | 1.24bn |
| **EU law as retained and mirrored** | 241,571 | 159m |
| **Bills in progress, and treaties** | 33,809 | 157m |
| **Impact assessments and consultations** | 26,204 | 19m |
| **Law Commission, NAO, OTS, independent reviews, OECD** | 4,858 | 67m |
| **MPs' declared interests** | 3,448 | — |

⚠ **Coverage is not completeness, and the gap is measured rather than guessed.** The corpus holds
**44.1% of what its sources publish** (`docs/CORPUS_COMPLETENESS.md`): 99.5% of post-2000 primary
Acts, but **21.4% of pre-2000 primary Acts** and 24.5% of retained EU law. If an answer depends on an
old Act, the absence of a result is as likely to be an ingest gap as an absence of law.

⚠ **Retrievable is not the same as held.** Some collections are in the corpus and reachable by no
search stream at all — see `docs/CORPUS_REACHABILITY.md`. Today that includes `members-interests`,
`erskine-may` where not bridged, `uk-treaties`, `tax-treaties-dta`, and `bills-api` outside the
legislation stream.

---

## 2. What can be asked for today

**One call, one `intent`.** The intent says *why* you are searching; the router decides which parts
of the corpus to interrogate and how to phrase the query for each. **A caller does not choose
streams.**

| intent | what it is for | what comes back |
|---|---|---|
| `BACKGROUND_BRIEFING` | the broad landscape for a new idea (Page 1) | everything relevant across all five streams; gets query expansion first |
| `LEGAL_LANDSCAPE` | what law governs this, and where it falls short | law-weighted, but not law-only |
| `CAUSE_SEEDING` | where has this problem been examined before | debates and committee reports |
| `POLICY_ALTERNATIVES` | how have others approached this | across streams |
| `AD_HOC_RESEARCH` | the user asked, in chat, for a corpus search | across streams |
| `PRECEDENT` | has this been tried — what it was for, what was predicted, what happened | explanatory notes, impact assessments, post-implementation reviews |
| `CAUSAL_EVIDENCE` | is the problem real and measured, and does the evidence support or contradict the diagnosis | across streams |
| `DEVOLUTION_SCOPE` | is the subject reserved or devolved | across streams |
| `GENERAL_CORPUS_CHAT` | an admin asking the whole corpus a question | untiered, fully routed |
| `IDEA_CHAT_GROUNDING` | legislation context for a Lex chat turn | ⚠ **legislation only — see §5** |
| `LEGISLATION_PANEL` | the Create-Idea side panel | ⚠ legislation only, and correctly so |
| `LEGISLATION_SEARCH` | the general `POST /api/search` endpoint | ⚠ legislation only, and correctly so |

**The five streams the router picks between:** the law · what Parliament said · what committees were
told · what courts decided · what regulators advise.

⚠ **Three more exist behind `LEX_ROUTER_STREAMS_V2`, default OFF (S8 §4):** what the government
PREDICTED (impact assessments) · what the government ASKED (consultations) · what a provision was
FOR (explanatory notes and memoranda). **They add no reachability** — all three collections already
sit inside tiers the `legislation` and `guidance` streams select with no corpus filter. What the
flag adds is a SLOT of their own in the round-robin interleave, so an impact assessment stops
competing for legislation's positions against 1.6M sections of statute. Cost: five streams become
eight, and a stream is one retrieval call per query. Measured in `docs/SEARCH_S8_ROUTER_V2.md`.

### ⚠⚠ A NINTH STREAM THAT IS NOT A CORPUS — `statistics` (S9 §4, `LEX_STATS_STREAM`, default OFF)

**What it answers: DOES A RELEVANT NUMERIC SERIES EXIST. It never answers what the number is.**

The statistics catalogue is 5,733 official series from ONS, OBR, HMRC, HM Treasury PESA, the World
Bank and the IMF, in a separate database from the corpus. What is indexed is the **catalogue** —
the headings that describe what a series *is*: title, measure, unit, geography, time span,
publisher, COFOG function. **The observations are not indexed and are never searched.**

Why the line is drawn there: a plausible-looking approximate match over a numeric series is
worthless and dangerous. "Roughly" is a legitimate output for a debate transcript and never a
legitimate output for a statistic.

**How a caller uses it, in two steps that must stay two steps:**

1. `runSearch()` → `result.statistics.results` → a `SeriesDescriptor[]`, each carrying
   `seriesKey`, what the series is, its span, its publisher and its licence.
2. If a VALUE is needed, the caller takes `seriesKey` and makes the exact call —
   `lib/stats/stats-query.ts::getSeriesByKey` then `getSeriesObservations`. **Search does not do
   this and must not be made to.**

⚠ **The payload travels on its own channel, `GatewayResult.statistics`, and NOT in `results`.**
A `SearchResult` is a document Lex may quote as evidence of a fact. A `SeriesDescriptor` is
evidence that a *measurement exists*, and carries no value at all. Interleaving them is how a
catalogue heading would end up cited as a finding — the same reasoning that keeps
`LegacySearchResult` and `EvidenceResult` structurally apart.

⚠ **Licence terms are ENFORCED, not recorded.** 2,329 of 5,733 series (40.6%, all IMF) are
`commercialUseExcluded`. The filter runs on the row set **before scoring**, so a restricted series
is never a candidate rather than being removed from a ranked list afterwards; the caller must
declare `STATS_USE_CONTEXT` (`non-commercial` | `commercial`), an unrecognised value fails to the
restrictive branch, and the number withheld is logged on every call. Every descriptor carries its
licence, licence URL and the attribution the source requires.

⚠ **`unavailable` is not `results: []`.** The first means the catalogue could not be consulted (no
`STATS_DATABASE_URL`, store unreachable); the second means it was consulted and nothing matched.
Lex must not say "there is no such series" for the first. See §6.

⚠ **`statistics` selects no corpus stream and issues no corpus retrieval** — proved
deterministically, not measured: `runRoutedSearch` matches route keys against `STREAM_SCOPES`, and
there is no scope of that name (`check:s9-catalogue`, "adding `statistics` to a route selects no
extra CORPUS stream", 36 results identical both ways).

⚠ **`PRECEDENT`, `CAUSAL_EVIDENCE`, `DEVOLUTION_SCOPE` and `GENERAL_CORPUS_CHAT` are DESCRIPTIVE.**
They are logged and callers key off them, but they select no streams — **adding one changes no
retrieval for anyone.** If you need retrieval to actually change, that is a conversation with
CC-Search, not a new string.

### ⚠ TWO STRUCTURED RETRIEVAL JOBS, WHICH ARE NOT INTENTS (S8 §1)

An **intent** takes keywords, goes through `runSearch()` and returns a ranked candidate list. A
**job** takes an instrument or a query and returns a RENDERED BLOCK that a flat ranking would
destroy. They are a different axis, and S8 §1's audit is what separated them:

| job | what it does | does it use the gateway? |
|---|---|---|
| `retrievePrecedent(gid)` | intended / predicted / observed for **one instrument**, as a GROUP | ❌ **No.** A keyed `$queryRaw` over `explanatory-notes`, `explanatory-memoranda`, `impact-assessments`. Declaring `PRECEDENT` in a pass's `intents` runs a general search that has nothing to do with this. |
| `retrieveDevolutionScope(q)` | who has legislated, jurisdiction-labelled from the **id**, never the title | ✅ Yes — an ordinary routed search; the job's contribution is the labelling and the refusal below |

⚠⚠ **`DEVOLUTION_SCOPE` DOES NOT ANSWER "IS IT RESERVED", and its output says so.** It shows who
has legislated, which is evidence and not a conclusion. The reservation question is settled by
Schedule 5 to the Scotland Act 1998, Schedule 7A to the Government of Wales Act 2006 and Schedules
2 and 3 to the Northern Ireland Act 1998, and the block names them. Answering a constitutional
question with a frequency count is exactly the confident wrong claim this platform exists not to
make.

⚠ **A missing post-implementation review is NEVER filled from the impact assessment.** Most
instruments have never had one, and the honest output says *"NO POST-IMPLEMENTATION REVIEW EXISTS
for this instrument — nobody has published an assessment of whether it worked"*. Verified reachable
in real persisted output, not just present as a constant (`docs/S8_DEEPENING_VERIFY.txt`).

Both are wired into the Deepening (`EVIDENCE_PRECEDENT` and `LEGAL` respectively) as of S8; before
that they were built, tested and called by nothing.

---

## 3. What cannot be asked for yet

Named individually, with what each would take. **This list is the honest half of the contract.**

| not available | what it would take |
|---|---|
| **Committee evidence from the Lex chat route** | ⚠ **LIVE DEFECT, not a missing feature.** SEARCH S5, in progress. Three gates in series: `tier: 'legislation'`, then a `LEGISLATION_TYPES` filter that drops 24 of 36 results, then a response contract (`actTitle`/`sectionNumber`) that would hand a committee transcript to Lex **as a section of an Act**. Widening the tier alone measures as a no-op. |
| **Positions — who supports or opposes a specific claim** | Extracted and stored (GRAPH 2D-3/2D-4: 16,196 positions over one policy area) and **NOT exposed to search**. The hand-read error rate is 44%; it is not going in front of a user at that number. |
| **Contradiction retrieval** — "find evidence that disagrees with this" | A retrieval mode that scores opposition rather than similarity. Not designed. |
| **Cross-domain mechanism analogues** — "where else has a levy-and-rebate been used" | Reserved as `MECHANISM_ANALOGUE`. ⚠ **Naming it in the code is not scheduling it.** |
| **Anything on the open web** | A Gemini-grounded orientation pass exists behind `LEX_WEB_ORIENTATION` (measured: 10/12 signals against a corpus-only control of 1/12, ~30.8s and $0.076 per briefing). It is **not general web search** and it is flag-gated. |
| **Comparative law from other jurisdictions** | Reserved as `COMPARATIVE_LAW`. Nothing ingested for it. |
| **Amendable-section lookup** — "which section would this change amend" | Reserved as `AMENDABLE_SECTION`. |
| **Who gave a piece of committee evidence** | ⚠⚠ **PARTIALLY CLOSED, AND THE HARD HALF IS STILL OPEN.** `attribution` now reaches every caller (§4 above) and covers 14 of 54 non-legislation collections — but **committee evidence and committee reports carry nothing**, on either column, in 1,400 sampled rows. The witness's name is in the R2 body and in no metadata we hold. Ingest work, not search work. |
| **The VALUE of a statistic, from search** | ⚠⚠ **NOT A GAP — A RULE.** Search returns a series *descriptor* and never an observation; the value comes from a separate exact call keyed on `seriesKey` (§2). Enforced at the boundary on every call (`assertNoObservationValues`), watched failing in `check:s9-catalogue`. Do not "add values to the descriptor". |
| **A statistics series for anything outside the fiscal/macro spine** | The store is ONS, OBR, HMRC, PESA (UK fiscal and macroeconomic) plus World Bank and IMF comparatives. Measured: **zero** series match `nhs`, `waiting` or `hospital` anywhere in label or measure. There is health *spending*; there is no health *activity*, no crime, no housing, no education outcomes. Ingest work on the statistics side, not search work. |
| **Reliable discovery of a series whose label is a source column code** | ⚠ 2,807 of 5,733 series (49%) are labelled with the publisher's own codes — `PSNB (April 1978)`, `NICS (October 2018)`, `PCDebtint (March 2022)`. Thirteen of these are glossed from long names the store itself carries elsewhere; the rest are not, and **a gloss will not be invented** — that is the same failure class as an invented figure. Closing it needs either a curated gloss table validated against the publishers' documentation, or dense retrieval over the headings. |
| **Phrase / exact-quotation search** | The keyword index is built **without token positions** (`withPosition: false`), so there are no phrase queries. A quoted string is matched as a bag of words. |
| **Anything in the 55.9% of source material not ingested** | Ingest work, collection by collection. |

### ⚠ The never-claim rule for an unmet request

If Lex wants something search cannot give, **it says what it looked for and could not reach.**

> ✅ *"I looked for what committees have said about this and I can't reach committee evidence yet."*
> ❌ *"I don't have information on that."*

The second is a bad answer to the same situation, because **a user cannot tell it from the corpus
being empty.** The gateway already distinguishes the two: `GatewayResult.failed` is TRUE when the
search could not be completed, which is a different state from a completed search returning nothing.
**Callers must keep those apart in what they store and in what Lex is allowed to say.**

---

## 4. How to ask

### ⚠ WHO SAID IT — `attribution` (added S8 §2)

Every `SearchResult` and every `EvidenceResult` now carries an optional
`attribution: { name, role, source } | null`.

```ts
res.results[0].attribution
// { name: 'Lindsay Hoyle', role: 'speaking in the House of Commons, on the record', source: 'speaker' }
```

⚠⚠ **`null` MEANS "NOT HELD STRUCTURALLY". IT DOES NOT MEAN "ANONYMOUS".** The distinction is the
whole point: a committee submission has a named author, we simply do not store that name as a
field. `ATTRIBUTION_ABSENCE_NOTE` travels into the prompt whenever any item in a block lacks one,
so a model cannot read the gap as anonymity.

⚠ **It is built from two structured columns and from nothing else** — `corpus_sections.speaker`
and `corpus_sections.attribution`. It is **never** parsed out of a title. Several collections put
who-said-it in their title and nowhere else (`committees-reports` ends "— HOUSE OF LORDS";
`scottish-courts` begins "Court of Session:"), and a regex over display text is an inference
travelling as a fact. `scripts/check-s8-attribution.ts` enforces this with a scanner that is
watched firing on a planted violation.

**Which collections carry it** (measured 19 Aug 2026, ≥200 rows per id offset — full table in
`docs/S8_ATTRIBUTION_AUDIT.txt`). Of the **54** non-legislation collections, **14** carry
something and **40** carry nothing:

| carried by | collections | what the value is |
|---|---|---|
| `speaker` | the whole `pwdata` family (90–100%), `historic-hansard` (87%), `scottish-parliament-or` (92.5–100%), `senedd-cofnod` (87.5%) | the member speaking |
| `speaker` | `pwdata-wrans`, `pwdata-wms`, `pwdata-lordswrans`, `pwdata-lordswms` (100%) | ⚠ the minister **ANSWERING**, not the member asking |
| `speaker` | `early-day-motions` (100%) | ⚠ the **SPONSOR** — nobody spoke; an EDM is a signature sheet |
| `speaker` | `tax-tribunals` (100%) | ⚠ the **JUDGE** who decided the case |
| `attribution` | `consultations`, `impact-assessments` (100%) | the publishing organisation, sometimes with a stage |

⚠⚠ **AND THE COLLECTION THIS WAS WANTED FOR HAS NOTHING.** `committees-evidence` is 0 of 800 rows
across four id offsets, on both columns; `committees-reports` is 0 of 600. Oral evidence carries
no `sectionTitle` either. The witness's name is inside the R2 document body and in no metadata we
hold. **Closing that is an ingest job, not a search one.** Also zero: all case law except
`tax-tribunals`, all seventeen guidance collections, `niassembly-hansard`, the govuk
`written-answers`/`written-statements` pair (the pwdata equivalents ARE populated), the three
`lda-*` collections, and `petitions`.

⚠ **`pwdata-debates` has an ERA GRADIENT, not a flat rate:** 4.0% in 1919, 4.5% in 1950, 82.5% in
1990, 99.5% from 2010. Retrieval favours modern Hansard, so what a user actually sees is far
better than the collection average — measured at **97% of retrieved DEBATE results** on the S5 ten
questions (`docs/S8_ATTRIBUTION_MEASURE.txt`).

`LegacySearchResult` is untouched — the three legacy legislation surfaces carry no attribution.

---

```ts
import { runSearch } from '@/lib/lex/search-gateway'

const res = await runSearch({
  keywords: ['sewage', 'discharge', 'water company'],
  intent: 'CAUSE_SEEDING',
  ideaContext: 'optional — steers query expansion ONLY, never enters cited text',
  limit: 40,          // canonical results before grouping; grouping caps ~20
  // tier: 'legislation'  ⚠ see below — almost certainly not what you want
})
// res.results  — ranked, canonical
// res.grouped  — ≤3 per display type, ~20 total, panel-ready
// res.failed   — TRUE = the search could not run. NOT the same as "found nothing".
```

**`runSearch()` is the single point of contact.** It owns query building, expansion, routing,
retrieval, fusion and grouping. When search grows, this file changes and callers do not.

⚠ **Do not set `tier` because you *prefer* one kind of document.** It restricts retrieval to a single
tier and switches off streams the gold set says help. It exists only for callers whose response shape
has nowhere to put anything else. **A caller that merely prefers legislation must not set it.**

**Capability flags** (`LEX_QUERY_EXPANSION`, `LEX_QUERY_ROUTER`, `LEX_SEARCH_VECTOR`,
`LEX_WEB_ORIENTATION`, `LEX_SEARCH_RERANKER`, `LEX_SEARCH_GRAPH`) each gate one capability, default
OFF, read through `flagEnabled()` — never a bare `=== 'true'`, because a capitalised `TRUE` in Vercel
silently disabled the router and expansion for an unknown period.

⚠ **The live flag state is NOT readable from a development machine** (`VERCEL_TOKEN` is SAML-blocked).
Local `.env` sets `VECTOR_SEARCH_URL` and none of the `LEX_*` flags, so **a local harness runs
keyword-only and will look like a regression.** Confirm production state from the Vercel dashboard or
by reading a `served` counter off the running service — never by inference.

---

## 5. What each surface actually gets

**They differ, and the differences have caused two sprints of confusion.**

| surface | scope today | is that right? |
|---|---|---|
| **Page 1 background briefing** | all five streams, expansion on | ✅ yes |
| **Page 2 cause seeding** | all five streams | ✅ yes |
| **Build passes (25-A)** | two intents, `BACKGROUND_BRIEFING` + `LEGAL_LANDSCAPE`, one search each | ✅ yes |
| **The Deepening passes** | all five streams, **plus two structured jobs** (§2 above) — `EVIDENCE_PRECEDENT` runs `PRECEDENT`, `LEGAL` runs `DEVOLUTION_SCOPE` | ✅ yes |
| **`/admin/lex-general`** | untiered, fully routed | ✅ yes |
| **Create-Idea legislation panel** | legislation only | ✅ **right** — measured: it returns *Sewerage (Scotland) Act 1968 s.39* for the sewage question, which is what that panel is for |
| **`POST /api/search`** | legislation only | ✅ right for its contract |
| **The Lex chat route — the platform's main conversation** | **two channels, routed** | ✅ **FIXED by SEARCH S5 (17 Aug 2026).** It was legislation only: 36–146 non-legislation documents per question unreachable, not one committee document, debate or judgment reaching a user on any question, ever. It now calls `retrieveForChat()` with no tier, and returns **legislation and evidence separately**. Measured on the same ten questions: **90 documents the conversation could not previously reach**, 7 of 7 non-legislation questions now served (was 0 of 7), and **no legislation lost** on the three legislation-shaped questions. Latency p50 3.3s → 4.6s. |

---

## 6. ⚠⚠ WHEN LEX WANTS SOMETHING SEARCH CANNOT GIVE

**This is the rule that matters most in this document, and it is a never-claim rule.**

> **If Lex wants something and search cannot supply it, Lex says so plainly and specifically.**
>
> Not silence. Not a vague deflection. And above all **not an answer composed from general
> knowledge presented as though it came from the corpus.**

*"I looked for what select committees have said about this and I can't reach committee evidence
from here yet"* is a **good** answer. It tells the user what exists, what is missing, and that
somebody knows.

*"I don't have information on that"* is a **bad** answer to the same situation, because it is
indistinguishable from the corpus being empty.

⚠ **A gap that announces itself is a feature. A gap that looks like an absence of evidence is the
single most damaging thing this platform can produce**, because the user cannot tell the difference
and neither can we.

### How this is enforced rather than hoped for

| | |
|---|---|
| **The prompt says it** | `GAP_INSTRUCTION` in `lib/lex/chat-retrieval.ts`, injected whenever a gap is detected. It forbids the vague deflection **by name**. |
| **The gap is detected, not guessed at** | `kindsPlainlyAskedFor()` reads the question for the kind of material it asks about. If the user names committees and no committee material comes back, `gapNote()` tells Lex exactly that. |
| **A failed search is distinguished from an empty one** | When retrieval fails outright, the note says *the corpus was not consulted at all* — a different sentence, because they are different facts. |
| **The legacy fallback declares its own limits** | That path reaches legislation only and can never carry a second channel. It says so in the prompt instead of letting silence imply the corpus holds nothing else. |
| **A worked example** | Asked *"what did MPs argue in the debate on assisted dying"*, the OLD path matched `"assist investi"` inside an investigatory-powers SI and had to admit it found nothing. That is precisely the situation this rule governs. |

### ⚠ And every unmet request is logged

`LexUnmetRequest` records the **kind** that was wanted, the **keywords searched**, **which streams
the router chose**, and how many results came back. V37's gap-filler expects exactly this signal:
*what Lex looked for and could not get is the most direct evidence available about what the corpus
should hold next.* Every other gap signal we have is inferred from sweeps; this one is a real user
asking a real question and getting nothing.

⚠ **The question text is NOT stored.** A Stage-1 idea is private by design and a gap log is not a
reason to keep a copy of it.

⚠ **`streams` is the most diagnostic column**, because it separates two failures that look identical
from outside: *the router never selected committees* (our bug, fixable today) versus *it searched
committees and found nothing* (a corpus gap, the ingest stream's work). Read
`LexUnmetDemand`, which splits them.

### What Lex still cannot ask for

See §3. Today that is: cross-domain mechanism analogues, contradiction retrieval, positions, and
anything on the open web. **When Lex wants one of those, §6 applies — name it, do not improvise it.**

---

## Where the numbers in this document come from

- corpus sizes — `corpus_sections` on Neon, `status='compiled'`, 17 Aug 2026
- coverage — `docs/CORPUS_COMPLETENESS.md`, `docs/CORPUS_REACHABILITY.md`
- the Lex chat route — `docs/SEARCH_S4_REPORT.md`, measured through the running retrieval path
- intents, flags and the gateway shape — `scrutinise-web/lib/lex/search-gateway.ts`
- streams and their scopes — `scrutinise-web/lib/lex/stream-scopes.ts`
- index configuration — `scripts/ingest/search/build-fts-index.ts`
- positions — `docs/POSITION_GRAPH_2D3_REPORT.md`, `docs/POSITION_GRAPH_2D4_REPORT.md`
- attribution coverage — `docs/S8_ATTRIBUTION_AUDIT.txt` (the store, ≥200 rows per id offset,
  19 Aug 2026) and `docs/S8_ATTRIBUTION_MEASURE.txt` (what retrieval actually returns, same day).
  ⚠ The two have **different denominators on purpose**: the audit is *of the collection*, the
  measurement is *of what ten real questions surface*, and they diverge sharply where retrieval
  is not a uniform sample of a collection — DEBATE is 4.0–99.5% in the store and 97% in the hand.
- the two structured jobs — `docs/S8_DEEPENING_VERIFY.txt`, 25/25 assertions against artefacts
  read back from Neon, not against counters
- router streams V2 — `docs/SEARCH_S8_ROUTER_V2.md`
- stream concurrency — `docs/SEARCH_S8_CONCURRENCY.md`
