# SEARCH_STRATEGY.md

**Status:** living document. Authoritative reference for the search stack; cite by section number in CC briefs (as we do with LEX_REBUILD_DESIGN.md). Update as pilots return data. **Last revised:** 2026-07-15 (v2.1 — adds the X/Grok orientation signal §6d with the two-call design and noise filter, the three reliability tiers §6d.4, the briefing section structure §7.1, the multi-hop status note §4.1, the semantic-chunking alternatives-considered record §6b.1, and a status refresh across §5/§9/§12). **Previous:** v2 (2026-06-28) added the per-corpus stream model, the graph strategy, the type taxonomy, and feedback-driven evaluation.

Scrutinise lives or dies by search quality, so search decisions are made empirically, not by intuition. This document sets out what we are building, in what order, why, and how each piece fits with the others.

***

## 1. Governing principles

1.  **Measure against the gold set, always.** The offline evaluation harness (`score-fts`, gold queries, recall@20 + MRR) is the instrument. No search change ships on a hunch; it ships because it moved the number. The boost sweep (1.0 → 1.8 → 2.5) was this principle in action.
2.  **Separate cheap-reversible decisions from expensive-sticky ones** (§2). Tune the cheap ones freely. *Pilot* the sticky ones on a subset before committing at full scale.
3.  **The corpus is ground truth.** The LLM frames the search and writes the answer, but never asserts a fact the corpus did not return (§6a). This is how we stay grounded and avoid hallucinated law.
4.  **Web is for orientation; the corpus is for the law you cite.** Lex may use a web pass to understand the landscape and *shape* the corpus query, but any legal claim that enters the proposal must be backed by **corpus** text. Web sources are cited as background/current-context, visibly distinct from primary law. **X/social content sits a tier below even that** — it signals sentiment, salience, and circulating arguments, and is never a fact source (§6d).
5.  **Index by function and outcome, not only by subject and citation.** This is the design stance behind both the stream model (§3) and the graph strategy (§9): the connections that help a *reformer* are largely orthogonal to the ones that help a *lawyer looking up the law*.
6.  **Every component is config-driven** (model, chunk size, fusion weights, boosts, reranker on/off, which streams run, orientation calls on/off). A variant is then a config change, scoreable on the gold set the same afternoon.
7.  **Alternatives considered are recorded.** When a consequential design option is rejected, the option and the reasons go in this document (see §6b.1), so the decision is visible and revisitable rather than a silent default.

***

## 2. The core distinction — is vector "deterministic like FTS"? No.

**Keyword FTS (BM25) is cheap and reversible.** The algorithm is fixed and well understood; the only levers are *what we index* and a handful of *boosts/parameters*, all of which we can change and re-score in minutes. *(BM25 = the standard keyword-relevance score: term frequency × term rarity, length-normalised.)*

**Vector search is a quality continuum, dominated by two consequential, sticky choices:**

-   **The embedding model.** Models span a real quality range, and **embeddings from different models are incompatible** — switching model means re-embedding the corpus. *Embeddings set the ceiling for retrieval quality; a bad embedding model cannot be fixed downstream.* *(Embedding = a model that turns text into a vector so that similar meanings sit close together.)*
-   **Chunking.** How we split a document into embeddable units materially changes retrieval, and it is baked into the embeddings — changing it means re-chunking *and* re-embedding (per-corpus, so a targeted tier re-do is possible; see §6b.1).

So vector is **not** "can't go wrong, go ahead," but it is de-riskable by **piloting**: embed a representative subset, score on the gold set, choose model + chunking, then commit at scale. **Pilot → measure → commit.** (Executed June–July 2026: gemini-embedding-001 @768d won the bake-off; full-corpus embed in flight as of this revision.)

***

## 3. The per-corpus stream model

Legislation, debates, committees, case law, codes, investigations, evaluations and the web are **different corpora with different characteristics, and we want different things from each.** We run **specialised streams**, each with its own query strategy and method weighting, and **reassemble** them — each stream's output able to inform another's query (§3.2).

### 3.1 Two kinds of stream — the load-bearing distinction

-   **Specific-retrieval streams** want the *exact item* on the topic of the idea. Search **by topic**, return **ranked hits**.
-   **Principle-retrieval streams** want *transferable patterns* — "general principles not specific items." Search **by the failure mode you suspect** ("enforcement gap", "agency under-resourcing", "guidance ignored", "perverse incentive"), not the idea's topic; the lesson transfers *because* it came from a different domain. Return **clustered, de-duplicated lessons**, not a ranked topical list.

| Stream                                 | Kind                 | Purpose — what we want from it                                                                                   |
|----------------------------------------|----------------------|------------------------------------------------------------------------------------------------------------------|
| **Legislation**                        | specific             | the precise law to amend / add / revoke — *what's there now*                                                     |
| **Debates (Hansard)**                  | specific→principle   | the issues behind the law; the contested views on causes & expected effects                                      |
| **Committees**                         | specific→principle   | evidence and hypotheses on causes & effects                                                                      |
| **Case law**                           | specific + graph     | how courts interpret the law; the real-world edge cases the legislation produced                                 |
| **Codes / guidance**                   | **principle**        | how legislation is *implemented* in practice — transferable even from unrelated law                              |
| **Special investigations / inquiries** | **principle**        | how the civil service & public bodies actually behave; where it goes wrong; their incentives                     |
| **Parliamentary evaluations of laws**  | **principle**        | where laws succeed and fail — *how government works*                                                             |
| **Web + X orientation**                | specific + principle | current-state landscape; academia/research; comparative law; circulating arguments & political temperature (§6d) |

### 3.2 Reassembly is a dependency chain, not a merge

The streams are the **skeleton of the agentic research loop** (§4): one stream's output becomes another's query.

```
  Legislation ──(anchor Acts/sections)──▶ Case law      ("cases interpreting these sections")
       │                              └──▶ Evaluations   ("assessments of these laws")
       ▼
  Debates ──(each contested cause)──▶ Committees / Web  ("evidence on cause X")
       │
       ▼
  Mechanism of the chosen lever ──▶ Codes + Investigations + Evaluations
       │
       ▼
  Web + X (comparative & current) ──▶ SYNTHESIS (§7)
```

A stream earns its place only when the gold set shows it improves the result.

***

## 4. Target architecture

```
                    ┌─────────────────────────────────────────────────────────┐
   user idea ──▶    │  0. ORIENTATION  (optional): Gemini web grounding +     │
                    │     Grok live-X signal (§6d) — shape the corpus query   │
                    └───────────────────────────┬─────────────────────────────┘
                    ┌───────────────────────────▼─────────────────────────────┐
                    │  1. QUERY UNDERSTANDING  (LLM — Gemini)   [LIVE]         │
                    │     rewrite · expand with anchor Acts & terms-of-art ·   │
                    │     extract citations · route to per-stream sub-queries  │
                    └───────────────────────────┬─────────────────────────────┘
              ┌──────────────┬──────────────────┼───────────────┬──────────────┐
              ▼              ▼                   ▼               ▼              ▼
        ┌──────────┐  ┌──────────┐        ┌──────────┐    ┌──────────┐   ┌──────────┐
        │KEYWORD   │  │VECTOR    │        │ GRAPH    │    │PRINCIPLE │   │WEB + X   │
        │(BM25)    │  │(semantic)│        │ Tier 1   │    │streams   │   │(orient + │
        │  [LIVE]  │  │[IN FLIGHT│        │ [BUILT]  │    │ [LATER]  │   │ compare) │
        └────┬─────┘  └────┬─────┘        └────┬─────┘    └────┬─────┘   └────┬─────┘
             └─────────────┴───────────┬───────┴───────────────┴──────────────┘
                                       ▼
                    ┌─────────────────────────────────────────┐
                    │ 2. FUSE (weighted RRF 70/30) [TUNED,     │
                    │    flag OFF] + FILTER/BOOST (tier,domain)│
                    └───────────────────┬─────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │ 3. RERANK (cross-encoder, top ~100)      │  [NOT STARTED]
                    └───────────────────┬─────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │ 4. SYNTHESIS (LLM — Lex)  [LIVE]         │
                    │    What / So What / Now What (§7.1),     │
                    │    citations tiered by source (§6d.4)    │
                    └───────────────────┬─────────────────────┘
                                        ▼
                          ┌─────────────────────────┐
                          │ 5. AGENTIC RE-SEARCH?    │  [LATER] loop to (1) on gaps
                          └─────────────────────────┘
```

*Reciprocal-rank fusion (RRF): merge ranked lists by scoring each document 1/(k + its rank) in each list and summing. Weighted 70/30 vector/BM25 after the pilot showed naive 50/50 collapses strong-model quality.*

*Cross-encoder reranker: reads the query and one candidate* **together** *and scores relevance — far more accurate than retrieval scoring, so it runs only on the fused top \~100.*

### 4.1 Multi-hop — status note (added v2.1)

Running the parallel streams once is *not* multi-hop; multi-hop is when hop 1's **output** becomes hop 2's **query**. Three layers exist at different maturity:

1.  **Graph traversal — BUILT.** Deterministic multi-hop over explicit edges in the database (the rescission impact set is hops: amends → cites → made-under), no LLM involved.
2.  **The dependency chain (§3.2) — designed, not yet automated.** Today the platform runs one parallel pass plus synthesis; stage-3 expansion fakes the first hop cheaply from the LLM's parametric knowledge (naming anchor Acts without retrieving first).
3.  **The agentic re-search loop — later.** The general engine: Lex inspects results, spots a gap, issues targeted follow-ups. Post-pilot.

September scope = single-pass + graph traversal + orientation (§6d). The full loop follows.

***

## 5. Layer roadmap — build order and status (refreshed 15 Jul)

| \# | Layer                                                        | Status                         | Fixes / adds                                                                                                    |
|----|--------------------------------------------------------------|--------------------------------|-----------------------------------------------------------------------------------------------------------------|
| 1  | Keyword FTS (BM25) + citation resolver + legislation boost   | ✅ LIVE                        | exact terms; citation lookup; term-of-art surfacing                                                             |
| 2  | Lex adapter                                                  | ✅ LIVE                        | real results in the product                                                                                     |
| 3  | Query understanding / LLM expansion                          | ✅ LIVE (concept queries only) | the lay-vocabulary gap (+15.3pp archetype B); citation queries excluded (measured regression)                   |
| 4  | Vector / semantic (hybrid + RRF)                             | 🔶 IN FLIGHT                   | full-corpus embed running (gemini @768d); fusion 70/30 TUNED, flag OFF pending ANN re-confirm + gold validation |
| 5  | Reranker (cross-encoder)                                     | ⬜ next build after flag flip  | final-ordering accuracy across all streams                                                                      |
| 6  | Citation / amendment graph (Tier 1) + rescission traversal   | ✅ BUILT 5 Jul                 | relationship queries; archetype D un-floored                                                                    |
| 6b | Rescission political layer (per-Act synthesis)               | ⬜ pre-pilot                   | who fought for it, what harm it closed, the defence — first consumer of §6d                                     |
| 7  | Web + X orientation layer (§6d)                              | ⬜ pre-pilot, after 5          | current context; circulating arguments; political temperature                                                   |
| 8  | Failure-pattern bounded slice (inquiries + evaluations only) | ⬜ approved pre-pilot STRETCH  | cross-department failure linking (§9.5)                                                                         |
| 9  | Mechanism / principle graph (§9.3)                           | post-pilot                     | "graph the principles"                                                                                          |
| 10 | Intent, argument, lineage graphs (§9.4/6/7)                  | post-pilot                     | causes, political risk, prior attempts                                                                          |
| 11 | Archetype / domain projection                                | tuning, later                  | domain-mixture filtering & boosting                                                                             |
| 12 | Co-interest graph (Tier 3)                                   | needs traffic                  | discovery / recommendation                                                                                      |

***

## 6. Layer detail (retrieval & LLM)

### 6a. Query understanding / LLM expansion — LIVE

Bridges the lay-vocabulary gap: Gemini injects likely anchor Acts and statutory terms-of-art ("data protection" → DPA 2018, UK GDPR, PECR) into the corpus query before BM25 runs. Measured: archetype B +15.3pp; **scoped to concept queries only** — the same expansion measurably dilutes precise citation lookups, so the citation path bypasses it. It is a *dynamic thesaurus*, which is why we build no static one. **Guardrail — steer, never assert:** the expansion is a query hint the corpus verifies; a hallucinated Act simply fails to surface.

### 6b. Vector / semantic search — in flight

Hybrid: vector fused (weighted RRF 70/30) with BM25 — BM25 keeps precision on exact terms and citations; vector adds meaning-matching (fixes lay vocabulary and the "buried statute" failure). Model: **gemini-embedding-001 @768 dimensions** (bake-off winner vs voyage-4 and open-weight; 768d showed no measured recall loss vs 1536d, at half the cost and storage). Chunking: short sections whole (≤\~1,024 tokens); long sections into \~800-token windows, \~15% overlap, cap 8, parent-section id on every chunk; **windows never cross a section boundary** (the chunker's unit of work is the section).

#### 6b.1 Alternatives considered — semantic chunking (recorded 13 Jul)

**Option:** content-aware chunking — embedding-similarity boundary detection (split where adjacent-sentence similarity drops) or LLM-read splitting — instead of structure + windows.

**Decision: rejected for the initial build; revisit only on evidence.** Reasons:

1.  **Our corpus is structure-rich.** The primary chunk boundary is the corpus's own unit — the legislation section, the parliamentary contribution — which is semantic-by-authorship. For statute text, machine chunking would at best rediscover boundaries we already hold.
2.  **Cost at scale.** Embedding-similarity chunking needs a sentence-level embedding pre-pass (≈ doubles the embed bill); LLM-read chunking over \~6.8B tokens costs multiples of the entire embed budget.
3.  **Mixed evidence.** Published gains are consistent only against naive fixed-size/no-overlap baselines; against structure-aware chunking *with overlap* (ours), measured gains are small and inconsistent. The 15% overlap already absorbs most boundary-cut damage; BM25 (full body) and the reranker recover the rest. Pilot scored 85.9% vector-alone recall on this chunking.
4.  **The real exposure is debates** (heterogeneous, multi-topic). Mitigant to verify: Hansard appears ingested at per-contribution (speaker) granularity — naturally semantic units. A granularity report (length distribution, % windowed, % hitting the 8-window cap, ingestion unit per parliamentary corpus) is briefed. **Upgrade path if evidence demands:** structure- aware re-chunk of the debate tier at speaker turns/headings from the source XML (deterministic, free, genuinely semantic), then a targeted re-embed of that tier only; embedding-similarity chunking piloted solely for corpora with no usable structure. Gated on archetype-E results; queued behind the reranker.

#### 6b.2 Chunk geometry is FIXED. Only `MAX_CHUNKS` is ever raised. (Charlie, 7 Aug 2026 — standing decision)

**Chunk SIZE (\~800 tokens / `PILOT_WINDOW_CHARS=3200`) and OVERLAP (\~15% / `PILOT_OVERLAP_CHARS=480`) are permanently fixed, along with `PILOT_WHOLE_CHARS=4096`. This is settled, not open. Do not re-litigate it in a future sprint.**

The asymmetry between the two knobs is the whole reason:

- **Raising `MAX_CHUNKS` is safe and cheap.** It appears in `chunkBody()` in exactly one place — the loop condition. Nothing that determines *where* a boundary falls references it. Verified against the chunks actually stored in `corpus_chunks`: 1,321 stored chunks re-derived from their R2 bodies at a raised cap came back **byte-identical, 0 mismatches**. Existing vectors stay valid; new chunks simply append. Removing truncation entirely is a **\$284 incremental top-up** (`V32_COMMITTEES_AUDIT.md` §4 addendum).
- **Changing size or overlap is neither.** It shifts *every* boundary in *every* windowed section, invalidating *every* windowed vector at once. That forces the full **\$785** re-embed rather than a top-up — and it also costs retrieval precision, because \~800 tokens was chosen deliberately (§6b.1) and the 15% overlap is what absorbs boundary-cut damage.

So the two look like sibling tuning parameters and are not: one is an append, the other is a rebuild that also risks quality.

**Operational corollary — a live footgun.** All three geometry values are read from the environment (`PILOT_WHOLE_CHARS` / `PILOT_WINDOW_CHARS` / `PILOT_OVERLAP_CHARS`) and **are NOT recorded in the `corpus_chunks` checkpoint**, which stores only phase/lastId/counts. A future chunk run started with different values would silently re-cut the whole corpus and no artefact would record that it had happened. **Pin all three explicitly on any chunk or top-up run**, and re-run `check-chunk-stability.ts` immediately beforehand — it compares against the stored bytes and so catches geometry drift, a changed R2 body, and a changed citation header (the act title is prepended *before* chunking) in one pass.

### 6c. Reranker (cross-encoder) — next after the flag flip

Re-scores the fused top \~100 against the query directly; typically the single highest-ROI component once retrieval is decent. Config-swappable (small open cross-encoder or a rerank API), scoreable on the gold set.

### 6d. Web + X orientation — the current-context and circulating-arguments layer (new, v2.1)

Two complementary sources, one stage:

-   **Gemini Google-grounding** — the current *web* state: news, government announcements, consultations, academia, comparative/foreign practice.
-   **Grok live X search** — the layer that precedes and amplifies news: political temperature, who is agitating, what row is brewing, and **where opposing positions are actually argued**. (Grok API key already present — it is Lex's fallback model.)

#### 6d.1 Two X calls, two time windows (Charlie, 15 Jul)

1.  **Recency scan — bounded \~90 days.** "Any recent issues relevant to this idea?" Returns structured `{recent_developments[], live_controversies[], who_is_talking[], salience 0–3, sources[] each with date}`. Feeds ONLY the "Known issues & current context" and "Political risks" segments. The 90-day bound applies to this call alone.
2.  **Argument mining — no time bound.** "The strongest articulations for and against this idea, wherever and whenever they appear." Interesting arguments often fall outside any recency window and may only be reachable via X. Returns distinct arguments, stance-classified (for / against / nuanced), each with **date and source noted** — undated items are dropped. Repetition counts toward *salience*, never toward *strength*. Feeds the "Arguments & viewpoints" section; later, complements the Hansard argument graph (§9.6) as its outside-Parliament counterpart.

#### 6d.2 The noise filter (bespoke rules — the extraction contract)

X carries substantive argument buried in noise. The extraction step **discards**: ad hominem, sarcasm-only and "bitchy" remarks, straw-man restatements of the opposing view, irrelevant segues, pile-ons and pure virality. It **keeps**: claims accompanied by reasons or evidence, distinct arguments (deduplicated — one exemplar per argument, not one per retweet), and clearly attributed positions. Low-credibility signals (anonymous virality, bot-likeness) are flagged and down-weighted. These rules live in the prompt/config and are tuned like any other component (§1.6), with their own on/off flag so the layer's contribution is measurable in isolation.

#### 6d.3 Quarantine

X output is **never a fact source**. It is presented as *what is circulating*, attributed and dated — not as "public opinion" (X sampling is skewed) and never as evidence for a legal or empirical claim. Any factual assertion found inside an X argument must be corroborated by corpus or Tier-B web before Lex may state it.

#### 6d.4 Reliability tiers (provenance labelling, visible in the briefing)

-   **Tier A — corpus.** The only permissible source of legal claims. Cited by section.
-   **Tier B — web background.** News, government, academia; dated; cited as context.
-   **Tier C — X/social.** Circulating arguments and sentiment; attributed, dated, visually distinct; quarantined per §6d.3.

***

## 7. Synthesis structure — What / So What / Now What

| Move         | = Rumelt                          | Fed mainly by                                        | Target insights                                                    |
|--------------|-----------------------------------|------------------------------------------------------|--------------------------------------------------------------------|
| **What**     | diagnosis (evidence)              | legislation, case law, committees, web               | what law exists; what was debated; what the courts/edge-cases show |
| **So What**  | diagnosis (interpretation)        | debates, investigations, evaluations, X recency scan | the causes (incl. non-obvious); significance; **political risk**   |
| **Now What** | guiding policy + coherent actions | legislation, codes, web comparison                   | the lever; the precise amendable sections; **implementation**      |

### 7.1 The briefing's section structure (new, v2.1)

The output is sectioned **by stream, for provenance** — and connected **by the Rumelt spine, for argument**. Standard segments (each carrying per-stream labels and §6d.4 tier badges):

Related clauses (the law) · What Parliament said (debates) · Committee evidence · How the courts read it · Codes & implementation · What's been tried and how it went · Known issues & current context (90-day, Tier B/C) · Political risks · Arguments for and against (all-time, incl. X-mined, Tier C) · The proposal (Now What).

**Connect, don't silo:** the synthesis layer's job is to draw the cross-section threads — "the enforcement gap the evaluations found explains the case-law pattern" — so the output reads as a briefing with one argument, not seven buckets. Sections carry the evidence; the spine carries the reasoning.

**By-product:** the stream purposes (§3.1) define what a "good result" means per gold-set archetype and should stay folded into the gold set's success criteria.

***

## 8. (reserved)

***

## 9. Graph strategy — including the original layers

Our edge: existing legal search serves *lawyers looking up what the law is*; Scrutinise serves *reformers trying to change it* — so we index **function and outcome**, not only subject and citation. Eight graphs, three tiers (companion sheet: `graph_family.png`).

### Tier 1 — explicit / structural (factual, cheap, high precision)

1.  **Citation / amendment graph — ✅ BUILT 5 Jul** (2.35M edges in Neon; amends / repeals / commences / cites / made-under) with the **rescission traversal**: "rescind this — what breaks?" → amending law, citing law, orphaned SIs. Archetype D un-floored.
2.  **Metadata graph** — department/policy-area, instrument type, year, committee. Cheap; queued.

### Tier 1a — inbound statutory citation lookup (added 25-H, 26 Aug 2026)

**The question it answers:** *if this Act — or this Part of it — were repealed, what else in the
statute book is now pointing at something that does not exist?* This is the largest single
deliverable of the Starkey Programme, and it is a data problem, not a legal one.

**Table:** `citation_edge` (Neon). One row per citation **instance**, not per (source, target) pair,
and **every row carries its own evidence** — `citation_text` (the literal words) and `raw_fragment`
(the surrounding XML) are `NOT NULL`. An edge with no quotable source is a claim, not a fact.
`target_uri` holds the URI **unmodified** beside the normalised `target_act_id`, so a normalisation
bug is recoverable by re-deriving rather than by re-extracting from a 1.4 GB file.

**API** — `scripts/ingest/graph/inbound.ts`:

```ts
inbound(targetActId, targetProvisionRef = null, includeUnresolved = false)
  -> Array<{ source_doc_uri, source_provision_ref, citation_text, source_type }>

inboundEvidence(targetActId, targetProvisionRef?, includeUnresolved?, detection?)
  -> { rows: (the above + source_gid, target_uri, target_act_id, target_provision_ref,
                raw_fragment, resolved, detection),
       partExpansion }

inboundSummary(targetActId, topSourceActs = 50)
  -> { total, actLevel, provisionLevel, distinctSourceActs,
       bySourceType[], bySourceAct[], byDetection[] }
```

`source_type` is `primary | SI | other`. Indexes are on `target_act_id` and `target_uri` — the
dominant query is inbound, not outbound.

**Three things a caller must know, because getting any of them wrong produces a confident wrong
answer:**

1. ⚠⚠ **`detection` is the most important column.** Only **2–5%** of body-text mentions of an Act
   carry `<Citation>` markup (measured: 5.4% Human Rights Act, 1.8% Equality Act, **0%** CRAG 2010).
   So rows come from two detectors: `markup` — the document asserted the identity by URI — and
   `text` — we resolved the Act's *name* against `corpus_acts` titles. The second is weaker evidence
   and its `target_uri` is **derived, not read from the document**. `inboundSummary` always reports
   the split. Never quote a total without it. Full working: `docs/CITATION_AUDIT.md`.

2. ⚠ **An act-level reference is not a Part-level reference.** Most rows name an Act and no
   provision, because the markup usually does not carry one — "section 3 of the" is plain text
   sitting outside the element. Those rows are **excluded** from a provision-scoped result and
   returned separately as `actLevel`. For a repeal programme they are a **floor on unknown
   exposure**, not noise: any of them may bear on the Part in question and the data does not say.

3. **A Part is expanded to its member provisions from the Act's own CLML**, not from an assumption
   about which sections a Part contains. Subsections match their section (`section-3` matches
   `section-3-2` and `section-3a`, never `section-30`). If the bulk CLML is not on disk the
   expansion cannot run and `partExpansion.available` says so, rather than quietly matching the
   literal string and returning a smaller, wrong-looking answer.

**Relationship to the existing `legislation_edges` graph.** That table's 121,279 `cites` rows are
not superseded and not duplicated: they carry no evidence, collapse instances to pairs, and (as
25-H found) **contain no pre-1963 Act as a source at all** — the extractor's zip-entry filter
required a calendar year, so 1,650 regnal-named Acts were never opened. `citation_edge` reads all
132,990 documents. Where both cover the same target, `citation_edge` returns ~30% more rows.

**Extraction:** `graph/extract-citation-edges.ts` (`--pilot` first; `--detect markup|text|both`),
over `best-collection-xml.zip`. `<Commentaries>`/`<Footnote>`/`<SecondaryPreamble>` are excluded and
counted — those are amendment provenance and already exist as `amends`/`repeals` edges from TNA's
effects data. Parser regression tests: `graph/check-25h-parser.ts`.

***
### Tier 2 — semantic / inferred (LLM-extracted; confidence-tagged)

3.  **Mechanism / principle graph ★** — the same *lever* across unrelated subjects (duty-to-report, licensing, time limits, sunset clauses, strict liability, regulator-powers). "Every way Parliament has implemented a duty-to-report, and how each fared." Backbone of the principle streams. Post-pilot.
4.  **Intent / problem→lever graph** — problem → claimed causes → lever → outcome, from explanatory notes, second readings, impact assessments. A per-Act version already runs at query time inside the rescission report's political layer. Post-pilot as a corpus-wide graph.
5.  **Institutional-outcome / failure-pattern graph** — provision → delivery body → failure mode → outcome. **Bounded slice (inquiries + evaluations only) approved as pre-pilot stretch.** The public evidence campaign (separate plan) plugs in here.
6.  **Argument / contested-cause graph** — who claimed what causes what, supports/contradicts edges over Hansard; §6d.1's X argument mining is its outside-Parliament counterpart. Post-pilot.
7.  **Lineage-of-attempts graph** — bills (incl. failed/withdrawn) → Acts → amendments → repeals threaded over time. Post-pilot.

### Tier 3 — behavioural

8.  **Co-interest graph** — discovered from engagement once there is traffic.

**Discipline:** explicit before inferred; every inferred edge carries provenance + confidence; each layer gates on the gold set; Tier 2 lands after vector + reranker (a graph over weak retrieval is weak).

***

## 10. The seam, the type taxonomy, and the callers

### 10.1 The seam

`query → SearchResult[]` `{ id, type, title, citation, snippet, score, url, date }`. Lex never calls the corpus directly; the platform calls at deterministic trigger points. Stage-3 expansion and (future) orientation happen platform-side, before `runFtsSearch`.

### 10.2 Type taxonomy — ✅ resolved

Three levels, mappings owned in `corpus-type-map`: \~54 raw source types → canonical display type → panel bucket; stream/purpose orthogonal. Audited 3 Jul: hidden corpora reduced 13 → 4 (all intentional); retained-EU / SI routing confirmed correct (the MiFID "no primary legislation" miss was ranking — the vector layer's job — not display).

### 10.3 The callers

Page 1 (Orientation) background briefing — expansion live here; Page 2 (Diagnosis) candidate- cause seeding; Pages 3–4: guiding-policy alternatives (later comparative law); coherent-actions precise amendable sections + the rescission report (graph traversal + political layer).

### 10.4 Latency headroom

The background briefing is not latency-critical (\~1–3s tolerance confirmed); orientation calls fit inside it.

***

## 11. Evaluation, A/B, and feedback signals

**Now:** offline gold-set scoring is the A/B mechanism; every variant is a config change scored the same day. **The foundational investment is the gold set itself** — growing and validating it (the expected-sources pass; the per-stream good-result definitions; queries mined from the feedback feature; expert-tester corrections once invited users arrive) is the highest-leverage non-build task. **Later:** real-user A/B once traffic supports significance. Public-phase contributions route two ways: "you missed this" → the gold set and search benchmark; "here's another angle" → the idea itself.

***

## 12. Immediate next steps (refreshed 15 Jul)

1.  **Embed completes** (in flight) → ANN index → **fusion re-confirm on the full-corpus index** → **flag flip** (vector live in Lex).
2.  **Gold-key validation** (Charlie) — gates trusting every number in step 1's re-confirm and everything after.
3.  **Reranker** (layer 5).
4.  **Rescission political layer + Web/X orientation** (§6d) — the political layer is the orientation layer's first consumer.
5.  **Failure-pattern bounded slice** (approved stretch) if the freeze window allows.
6.  **August feature freeze → September pilot.** Post-pilot: mechanism graph, remaining Tier 2 graphs, agentic loop, semantic-chunking revisit only if archetype E demands it.

One sentence: **run specialised streams, index by function and outcome as well as subject, let the LLM frame and finish — X may speak, but only the corpus testifies — and never ship a change the gold set didn't reward.**
