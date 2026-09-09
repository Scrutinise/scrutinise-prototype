# Scrutinise — Search Strategy (v5)

**Status:** living document. Authoritative reference for the search stack; cite by section number in
CC briefs. Update as work lands and pilots return data. **Last revised:** 19 August 2026.

**What changed in v5.** Three things.

First, **the first-pass retrieval stack is complete in capability and incomplete in wiring.** The
Lex conversation now sees the whole corpus (SEARCH S5): all five streams, two channels
(legislation and evidence, kept structurally apart), gap notes that name what could not be reached,
and an unmet-demand log. Semantic search has now been *measured per stream* rather than assumed
uniform (SEARCH S7): caselaw and guidance gain a measured +12.5 percentage points of recall,
debates is 15 points *worse* with vector on, and committees cannot be measured at all until it has
real test questions. Two new retrieval jobs — `PRECEDENT` and `DEVOLUTION_SCOPE` — are built,
tested, and called by nothing. v5's near-term programme (§12) is therefore **wiring and honesty
work, not new capability**: connect what is built, add attribution, and finish the measuring
instrument.

Second, **the binding constraint is now formally the measuring instrument, not the search** (§5.2,
new). Turning vector on changes a third to a half of the top twenty results and we cannot say
whether those changes are improvements, because three of five collections are scored on questions
the implementing model wrote for itself and one live metric came back saturated. No retrieval
quality claim is trustworthy until the gold set is real.

Third, **§9.2 is rewritten around a probabilistic position graph.** The hard-extraction approach
(read a submission, assert a position) measured at 44% wrong on a hand-read fifty and stalled. The
reframing — reached independently by a second model (Grok) and consistent with our own late
insight that we already hold 2.5 million perfectly reliable positions in the division votes — is
that the graph should hold **graded, evidence-backed estimates with confidence, provenance and
time decay**, built factual-first, with LLM extraction demoted to one low-confidence signal among
many rather than the foundation.

**This revision documents design and architecture. Day-to-day operational history — exact commits,
dated incidents, before/after numbers — lives in** CHANGE_LOG.md **and** handoff_summary.md.

---

## 1. Governing principles

Carried forward from v4, with four additions earned since. Plain-language glosses inline.

- **Measure against the gold set, always.** No search change ships on a hunch. **The gold set
  itself must be trusted before its numbers are** — answer keys need a human validation pass, and
  any baseline measured across an index change is void and must be retaken.
- **Separate cheap-reversible decisions from expensive-sticky ones** (§2). Pilot sticky ones on a
  subset first.
- **The corpus is ground truth.** The LLM frames the search and writes the answer, but never
  asserts a fact the corpus did not return.
- **Web is for orientation; the corpus is for the law you cite.** Web claims are numbered `[W1]`,
  provably non-colliding with corpus `[1]`, so a web claim can never wear the corpus's authority.
- **Index by *function* and *outcome*, not only by *subject* and *citation*.**
- **Every component is config-driven**, flag-gated, default OFF, flipped only once the gold set
  rewards it.
- **Alternatives considered are recorded.**
- **Every brief is written to disk** before it is trusted to survive a session clear.
- **One shared resource, one owner at a time**, recorded when it changes hands.
- **Verify engagement positively.** A flag flipped is not a flag in effect; prove it with a counter
  that moved.
- **A push is not a deploy.** Deploy state is observed off the running product, never inferred.
- **Fix a failure class in the shared helper, not in each caller.**

New in v5:

- **A saturated metric is not a null result.** A metric that comes back identical in every
  configuration (S7's on-kind count: 180 of 180, four times) is measuring a property that cannot
  vary, not proving the change did nothing. Report the saturation as the finding.
- **A floor effect is not a null result either.** When 27 of 31 test queries score zero in *both*
  arms, only 4 could have shown a difference; "+0.0pp" from that sample licenses no conclusion.
  Every A/B report must state its headroom — how many cases *could* have differed.
- **Record the prediction before the measurement.** S7's brief predicted committees would gain
  most from semantic search; the measurement showed the prediction *could not be tested* (committees
  is at a ceiling on its only questions). A written prediction is what makes a surprising result a
  finding rather than a shrug.
- **An inference must not travel as a measurement.** A 17.5 GiB database limit taken from a
  handoff note shaped a sprint's design; the real ceiling is 16 TiB. When a number matters, fetch
  it from the system, and record where it came from.

## 2. The core distinction — keyword vs vector

*(Unchanged in principle from v4.)* Keyword FTS (BM25 — ranked word-matching) is cheap and
reversible: tune, measure, move on. Vector search (meaning-based matching over embeddings) is a
quality continuum dominated by two sticky choices — embedding model and chunking — both executed
via **pilot → measure → commit** (gemini-embedding-001 at 768 dimensions won the bake-off). Vector
is also operationally a second system: paid hours-long embed jobs, index builds on the heavy-job
runner, and a probe-count parameter that trades latency against candidate size on every query.

**What v5 adds:** vector is also *per-stream* in value, not uniform. The same dense leg that adds
+12.5pp of recall on caselaw and guidance *subtracts* 15pp on debates. "Turn vector on" is not one
decision; it is one decision per stream, gated per stream (`LEX_VECTOR_STREAMS`), each with its own
measurement.

## 3. The stream model

### 3.1 The full stream set

*(Structure unchanged from v4; statuses updated.)* Nineteen streams across two kinds:
*specific-retrieval* streams want the exact item; *principle-retrieval* streams want transferable
patterns and are architecturally different and genuinely unbuilt. The load-bearing rows today:

| Stream | Purpose | Status |
| --- | --- | --- |
| **Legislation** | the precise law to amend, add to or revoke | live · keyword + vector |
| **Debates** (Hansard) | contested views on causes | live · keyword; **vector measured 15pp worse — leave off** |
| **Committees** | evidence and hypotheses on causes and effects | live · keyword; **vector unmeasurable until gold questions exist** |
| **Case law** | how courts interpret the law | live · keyword; **vector +12.5pp — recommended on** |
| **Guidance** | how a regulator expects compliance | live · keyword; **vector +12.5pp — recommended on; +2.5s p50 latency cost, watched** |
| **Explanatory notes / memoranda** | what a measure was *for* | live · typed and indexed |
| **Impact assessments** (incl. 1,014 post-implementation review sections) | what was *predicted* — and what actually happened | live · typed and indexed; router not yet extended to select it deliberately |
| **Consultations** | what was proposed, who objected, what changed | live · typed and indexed; same router caveat |
| **Division votes** | who voted which way | ingested; 2.53M rows; **a graph input, never text-searched** |
| **Members' interests** | declared interests | ingested; a graph input |
| **Statistics catalogue** | does a relevant numeric series exist | unblocked, scoped, not built; values are *called*, never searched |
| **Principle streams** (NAO/PAC evaluations, inquiries as lesson-sources) | where laws succeed and fail | unbuilt; a different build |

### 3.2 Reassembly is a dependency chain, not a merge

*(Unchanged.)* One stream's output becomes another's query; the synthesis layer assembles the
briefing. A stream earns its place only when the gold set shows it improves the result.

### 3.3 The mechanism matrix — what searches what

*(Updated.)* Legend: ● live · ◐ partial or flag-gated · ○ designed, not built · — not applicable.

| Stream | Keyword | Vector | Graph | Routed | Where it runs |
| --- | --- | --- | --- | --- | --- |
| Legislation | ● | ● on | ● citation/amendment | ● | LanceDB FTS + ANN on R2 |
| Debates | ● | ◐ built, **measured worse, off** | ○ argument | ● | same services, tier filter |
| Committees | ● | ◐ built, **unmeasurable** | ○ witness | ● | same |
| Case law | ● | ◐ built, **recommended on** | ◐ cites | ● | same |
| Guidance | ● | ◐ built, **recommended on** | ○ | ● | same |
| Explanatory notes / IA / consultations | ● | ● | — | ◐ surface via neighbours; router prompt predates them | same |
| Division votes | — | — | ● 2.48M `voted` edges | — | relational; graph input |
| Members' interests | — | — | ○ interests | — | relational; graph input |
| Statistics catalogue | ○ | — | — | ○ | statistics DB; headings only |
| Position graph (§9.2) | — | ◐ prototype-scoring uses the existing vector index | ○ soft edges | — side-rail | relational + existing embeddings |
| Web orientation | — | — | — | ◐ flag-gated `LEX_WEB_ORIENTATION` | outside the corpus |

The change from v4: the Vector column is no longer a uniform ●. **The capability is live
everywhere; the decision to *use* it is per stream, evidence-gated, and two streams currently fail
the gate** (debates on evidence, committees on absence of evidence).

### 3.4 Parallel vs series

*(Unchanged from v4, one addition.)* Streams run in parallel; stages run in series; fuse within a
stream before merging across, never the other way round. Addition: **stream concurrency is now
batched at 3** (`LEX_STREAM_CONCURRENCY`) because five parallel streams saturated a four-wide
service, and the limiter's effect is observed (`maxInFlight` logged), not assumed. The pre-batching
scare — 2× latency under two users — does not reproduce post-batching: measured 0.75×–1.37× of
serial p95. Raising the cap to 4 is a one-variable experiment worth running; p95 at 9 seconds on
the chat route is acceptable-ish, not good.

## 4. Target architecture

*(Unchanged.)* Orientation and query understanding in series; per-stream retrieval in parallel with
two legs per stream; per-stream fusion then a merge across streams; rerank not authorised;
grounded synthesis; graphs and statistics as side-rails. The router both selects streams and
rewrites the query per stream; a scoped caller that skips selection must still receive the rewrite.
The router's structured-response truncation fails *open* (query proceeds unrouted); the guard lives
in the shared LLM helper and the failure is loud.

## 5. Layer roadmap

| # | Layer | Status |
| --- | --- | --- |
| 1 | Keyword FTS + citation resolver + legislation boost | ● live |
| 2 | Lex adapter | ● live |
| 3 | Query expansion | ● live |
| 3.5 | Query router | ● live |
| 3.6 | Legacy call-site repoints | ◐ stopped pending the recall/ingest work (§5.1) |
| 4 | FTS index hygiene | ● resolved |
| 4.5 | Act-level metadata (corpus_acts) | ● live |
| 5 | Vector / semantic (hybrid + RRF) | ● live full-corpus; **per-stream enablement is the live decision** (`LEX_VECTOR_STREAMS`) |
| 5.4 | **Lex chat sees the whole corpus** — two channels, gap notes, unmet-demand log | ● **shipped, SEARCH S5** |
| 5.5 | **PRECEDENT + DEVOLUTION_SCOPE retrieval jobs** | ◐ **built and tested; nothing calls them — wiring is S8** |
| 5.6 | **Attribution** (who said it) through the gateway contract | ○ named gap; S8 |
| 6 | Reranker | ⛔ not authorised — binding constraint is recall (§5.1) |
| 7 | Tier 1 graphs (citation/amendment) | ● live |
| 7.5 | Position graph — probabilistic (§9.2) | ○ redesigned; factual layer buildable now from held data |
| 8 | Statistics catalogue | ○ unblocked, scoped |
| 9 | Principle streams + mechanism lens | ○ post-pilot |
| 10 | Web orientation | ◐ flag-gated, measured 10/12 signals vs 1/12 corpus-only; not general web search |

### 5.1 The reranker was declined; the binding constraint was recall

*(Unchanged in substance.)* The reranker measurement showed 11 of 15 scored pairs turned on
retrieval, not ordering; and 17,261 instruments known to the legacy table were absent from the
corpus (since diagnosed further by INGEST V36: the number is wrong in both directions, and the
route is re-fetch, not migrate). Recall work is an ingest problem before it is a search problem;
the legacy-table deletion stays blocked.

### 5.2 The binding constraint now: the measuring instrument (new)

**Nothing about retrieval quality can be improved reliably until the test set is real.** The
current position:

- Three of five collections (committees, caselaw, guidance) are scored on questions CC drafted for
  itself — the implementer writing its own exam.
- Committees sits at 100% on those questions: a ceiling. It cannot show a gain from any change,
  which means the largest evidence collection we hold is currently *unevaluable*.
- One live metric saturated (identical in every arm) and one experiment floored (27 of 31 queries
  zero in both arms). Both were reported as "this cannot answer the question", which is the correct
  output — but it means the question is still open.
- The framing experiment must be re-run through `runSearch()` (the real gateway, with routing,
  fusion and expansion) rather than bare BM25; the harness location, not the design, was the fault.

The fix is cheap and mostly human: **roughly ten questions per collection whose correct answers are
known documents, drafted by CC, validated by Charlie as things a real user would ask.** This is the
bridge from the build phase to the measurement phase and it gates everything in §11.

## 6. Layer detail

*(6a–6c unchanged from v4.)*

### 6d. Statistics — headings are searchable, values are callable

*(Unchanged.)* The catalogue (dataset title, measure, geography, span) is searchable; the numeric
values are called by exact tool once the series is known. Prerequisite (stable series key) met.
Known residuals: `sourceSeriesId` null on a large minority of rows; licence terms are per dataset
and cannot express per-vintage restrictions.

## 7. Synthesis structure — What / So What / Now What

*(Unchanged, strengthened.)* The never-claim rule is now written into `SEARCH_CONTRACT.md` §6 and
enforced in code: if Lex wants something search cannot supply, it says what it looked for and could
not reach — never a vague deflection, never general knowledge dressed as corpus. A failed search
("the corpus was not consulted") is distinguished from an empty one. Every unmet request is logged
(`LexUnmetRequest`) with the streams the router chose — separating *our routing bug* from *a corpus
gap* — and without the question text, because a Stage-1 idea is private.

## 8. (reserved — see §9)

## 9. Graph strategy — a plural taxonomy, one lens, and a rebuilt §9.2

**"Graph" was never one thing.** Our edge is unchanged: existing legal search serves lawyers
looking up what the law is; Scrutinise serves reformers trying to change it — so we index
function, outcome, and people-and-involvement, not only subject and citation.

### 9.1 Explicit / structural graphs (factual, cheap, high precision)

*(Unchanged.)* Citation/amendment graph ● built (powers rescission traversal and the SURFACE 1
repeal labelling). Metadata graph queued. Regulator-oversight graph designed.

### 9.2 The position graph — probabilistic, factual-first (rewritten)

**What died, and why.** The first design read positions out of written submissions with an LLM and
stored them as assertions. Hand-reading fifty against source found 22 wrong or partly wrong (44%).
The diagnosis matters more than the number: the *direction* was wrong on only 2 of 50. The model is
nearly always right about which side a document takes — it simply claims a position far too often,
because saying "this document doesn't take one" feels to a model like failing. Over-eagerness, not
misreading. Meanwhile the corpus already held **2.5 million perfectly reliable positions** — every
division vote *is* a position, needing no extraction, no confidence score and no caveat — and we
had surfaced none of them.

**The reframing.** The graph holds **graded, evidence-backed estimates**, not certainties. Every
edge is:

```
(actor, target, stance_score ∈ [−1, +1], confidence ∈ [0, 1],
 evidence_ids[], observed_at, source_type, decay_policy)
```

where *actor* is a person or organisation, *target* is an idea, bill, instrument or (later) a
mechanism, *stance_score* is direction and strength, *confidence* reflects the reliability of the
source type, *evidence_ids* point at the corpus sections behind the estimate so every claim is
drillable to source, and *observed_at* plus a decay policy make old signals fade rather than
persist as false certainty. Hard facts (a recorded vote) are simply edges with confidence 1.0. The
44%-wrong extractions are not discarded: they become **one low-confidence signal among many**,
weighted for what they are actually good at (direction) and discounted for what they are bad at
(whether a position exists at all).

**The signal ladder, in build order — priced by what already exists:**

| Tier | Signal | Source | Confidence class | Status |
| --- | --- | --- | --- | --- |
| **P0 — factual, held today** | Division votes, weighted: free votes and rebellions ≫ whipped votes (a whipped vote mostly measures the whip; a rebellion measures the member) | 2.53M vote rows; 2.48M `voted` edges already built (GRAPH 2D-2) | fact (1.0); *informativeness* varies, encoded in weight | **buildable now — no new data** |
| P0 | EDM signatures — voluntary signalling, unwhipped | 59,996 sponsorships, held | fact | buildable now |
| P0 | Amendment behaviour — who tables/co-sponsors strengthening vs wrecking amendments | bills-api, held; needs cheap classification of amendment-vs-parent | fact of the act; classification adds a confidence term | buildable now, classification piloted first |
| P0 | Committee membership and witness appearances | held | fact (affinity prior, weak) | buildable now |
| P0 | Declared interests | 1,505 interests + 5,496 org register numbers, held | fact (a prior on alignment, not a position) | buildable now |
| **P1 — public registers, small ingest** | APPG membership and funders (All-Party Parliamentary Groups — voluntary affinity groups; membership, especially of funded groups, is a clean soft prior) | published registers; scrape | fact of membership; soft as stance | small CC-Ingest job |
| P1 | Electoral Commission donations; Companies House joins (MP ← donor → sector paths) | bulk public data | fact of the path; soft as stance | small CC-Ingest job |
| **P2 — embedding prototypes** | Stance scoring by similarity to small sets of prototype texts (known lobby briefs, charity position papers) — reusing the live vector index, no new embed job | existing embeddings + curated prototypes | continuous, calibrated by measurement | cheap pilot after gold set exists |
| P2 | Written/oral questions as revealed attention (volume, framing, persistence) | LDA corpora, held | weak, attention not stance | later |
| **P3 — LLM extraction** | The existing 16,196 extracted positions, plus Charlie's bottom-up claims architecture (measured: finds 74% more claims, 85% real, recovers only 57% of known-correct, costs 3.73× — **a supplement, not a switch**) | committee submissions | low confidence; direction reliable, existence unreliable | demoted to one signal; never shown as fact |
| P3 | Free-text speech stance (plenary language is theatrical; committee "backstage" language less so — weight accordingly) | Hansard + committee oral evidence | low | later |

**Derived structure, once edges exist:** community detection over co-signing/co-voting on *free*
votes; label propagation from a few seeded hard positions; bridge-actor identification
(cross-party APPG members, high-betweenness actors — the natural outreach targets); and, once the
mechanism lens (§9.3) exists, **mechanism-transfer edges** — "actors who supported analogous levers
in other domains" — which is the genuinely original move and depends on §9.3, not on this section.

**The first consumer is unchanged and is the reason the soft model works:** the political-risk pass
in the Lex deepening — "who will resist, on what grounds, with the evidence attached." It runs in
the background with a minutes-long latency budget, so multi-hop traversal and large candidate sets
are affordable; and its output language is naturally probabilistic ("high-confidence opposition
from X, grounded in these three votes and this submission"), which is honest where a hard graph
would have to invent certainty. Ranked-likely-supporters/opponents with drillable evidence is the
product; the graph formalism is just how it is stored.

**Discipline, restated for this graph specifically:**

- Factual edges ship first; every inferred edge carries provenance and confidence; **no edge type
  is promoted into a user-visible surface until measured against a hand-labelled set of known
  controversial bills.**
- Party membership and whipped votes are *weak priors only*, easily overridden by P0 free-vote and
  P1 register signals.
- **Never merge two identities on similarity** (standing rule): an unresolved name is visibly thin
  and harmless; a wrongly merged one is a person who does not exist holding contradictory views.
- The never-claim rule applies: the synthesis layer reports scores and their grounds; it does not
  round a 0.6 up to "supports".

### 9.3 The mechanism / principle lens

*(Unchanged.)* Not a graph among graphs but a cross-cutting lens: tag provisions by what kind of
lever they are, connect matches across unrelated subjects. Deliberately wants topically *distant*
results, which both BM25 and embeddings work against — its own technique, scoped after the streams
it cuts across are solid. It is also the prerequisite for mechanism-transfer edges in §9.2.

### 9.4 Other inferred / content graphs

*(Unchanged.)* Intent/problem→lever; institutional-failure patterns; argument graph over Hansard;
case-law doctrine graph; lineage-of-attempts graph.

### 9.5 Behavioural (needs traffic) — unchanged.

### 9.6 Discipline — unchanged: explicit before inferred; provenance and confidence on every
inferred edge; each layer gates on the gold set; content graphs land after retrieval is solid.

## 10. The seam, the type taxonomy, and the callers

*(Updated.)* `search-gateway.ts` remains the only place that touches search; `SEARCH_CONTRACT.md`
is the standing reference other streams build against, updated in the same commit as any capability
change. The taxonomy is thirteen display types. Two response shapes now exist by design:
`LegacySearchResult` (legislation — `actId`/`actTitle`/`sectionNumber`) and `EvidenceResult`
(everything else), and the separation is structural: `EvidenceResult` has no field through which a
committee transcript could render as a section of an Act. A Bill travels in the evidence channel,
because a proposal is not operative law.

Callers, all through the one gateway: `BACKGROUND_BRIEFING`, `LEGAL_LANDSCAPE`, `CAUSE_SEEDING`,
`POLICY_ALTERNATIVES`, `AD_HOC_RESEARCH`, `GENERAL_CORPUS_CHAT`, `PRECEDENT`, `CAUSAL_EVIDENCE`,
`DEVOLUTION_SCOPE`, plus the three deliberately legislation-only surfaces
(`IDEA_CHAT_GROUNDING` retired in favour of the routed chat path; `LEGISLATION_PANEL`;
`LEGISLATION_SEARCH`). ⚠ **Descriptive intents select no streams** — `PRECEDENT`,
`CAUSAL_EVIDENCE`, `DEVOLUTION_SCOPE`, `GENERAL_CORPUS_CHAT` are logged and keyed off, but adding a
new intent string changes no retrieval; retrieval changes are a conversation with CC-Search.

The two special requirements of the deepening consumer stand: `CAUSAL_EVIDENCE` values
*contradicting* documents as much as supporting ones; and deepening's background budget (minutes)
licenses techniques the interactive path cannot afford — which is exactly where the §9.2 graph
side-rail plugs in.

## 11. Evaluation, A/B, and feedback signals

*(Carried forward, with §5.2 now the governing statement.)* Offline gold-set scoring remains the
instrument; the answer keys have never had a human validation pass and this remains the single
highest-leverage non-build task. A metric that cannot fail is not a metric — watch every metric
failing before trusting it passing; state the headroom of every A/B; candidate-set fidelity is not
recall. The Lex feedback capture (user critique, consent-gated, personal content stripped) is the
first source of observed real questions, and the `LexUnmetRequest` log is the first direct evidence
of what the corpus should hold next.

## 12. Immediate next steps

Ordered. The theme of the first block is **finish the infrastructure by wiring and honesty, not by
adding capability**; the second block is the measurement phase; the third is the graph.

**Block 1 — finish (SEARCH S8):**

1. **Flip `LEX_VECTOR_STREAMS=legislation,caselaw,guidance`** (Charlie, Vercel dashboard; verify
   positively off the running service). Not debates. Committees waits for questions.
2. **Wire `PRECEDENT` and `DEVOLUTION_SCOPE` into the Deepening passes** — built, tested, called by
   nothing.
3. **Attribution through the gateway** — `SearchResult` carries no "who said it"; for a committee
   transcript that is the single most useful fact about it. Structural, honest-null, never faked
   from a title.
4. **Move the framing harness through `runSearch()`** on the web side and re-run; the current
   answer is "unmeasurable" and is not worth repeating.
5. **Extend the router prompt to the three newest typed streams** (impact assessments,
   consultations, explanatory material), re-score, adopt only if the gold set rewards it.
6. **Concurrency experiment:** `LEX_STREAM_CONCURRENCY` 3→4, one variable, against the real
   service.
7. **Config hygiene from the handover:** record Anthropic/xAI prices so the cost ceiling can bind
   on them; fix the two configured fallback models that do not exist in the accounts.

**Block 2 — measure (the gold set becomes real):**

8. **Gold questions for committees, caselaw, guidance** — ~10 per collection, answers are known
   documents, drafted by CC, **validated by Charlie**; then the human validation pass over the
   existing keys. Gates every quality claim.
9. Re-run the per-stream vector decisions and the framing comparison on the validated set.

**Block 3 — the graph (GRAPH 3A):**

10. **The §9.2 edge schema and the P0 factual layer** — votes (rebellion/free-vote weighted), EDMs,
    committee membership, interests — wired as a side-rail into the political-risk pass. No new
    ingest, no LLM spend.
11. **P1 registers** (APPG, Electoral Commission) as a small CC-Ingest job.
12. **P2 prototype pilot** only after Block 2, because a stance score without a validated
    measurement is exactly the mistake §9.2 was rebuilt to avoid.

**Still standing from v4:** the absent-instrument recall/ingest work (route: re-fetch); the
statistics catalogue build; the legacy repoints, resuming after recall; principle streams and the
mechanism lens post-pilot.

One sentence: **the capability is built — now wire it, label it honestly, make the measuring
instrument real, and grow the graph factual-first as graded estimates with provenance, so that
what the platform shows a user is always something it can prove.**
