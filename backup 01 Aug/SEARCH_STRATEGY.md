# SEARCH_STRATEGY.md

**Status:** living document. Authoritative reference for the search stack; cite by section
number in CC briefs (as we do with LEX_REBUILD_DESIGN.md). Update as pilots return data.
**Last revised:** 2026-06-25.

Scrutinise lives or dies by search quality, so search decisions are made empirically, not by
intuition. This document sets out what we are building, in what order, why, and how each piece
fits with the others.

---

## 1. Governing principles

1. **Measure against the gold set, always.** The offline evaluation harness (`score-fts`,
   30 gold queries, recall@20 + MRR) is the instrument. No search change ships on a hunch;
   it ships because it moved the number. The boost sweep (1.0 → 1.8 → 2.5) was this principle
   in action.
2. **Separate cheap-reversible decisions from expensive-sticky ones** (§2). Tune the cheap ones
   freely. *Pilot* the sticky ones on a subset before committing at full scale.
3. **The corpus is ground truth.** The LLM frames the search and writes the answer, but never
   asserts a fact the corpus did not return (§4, §6a). This is how we stay grounded and avoid
   hallucinated law.
4. **Every component is config-driven** (model, chunk size, fusion weights, boosts, reranker
   on/off). A variant is then a config change, scoreable on the gold set the same afternoon.

---

## 2. The core distinction — is vector "deterministic like FTS"? No.

This is the most important idea in the document, because it changes how we approach the build.

**Keyword FTS (BM25) is cheap and reversible.** The algorithm is fixed and well understood;
the only levers are *what we index* and a handful of *boosts/parameters*, all of which we can
change and re-score in minutes. There is no "wrong BM25 setting that silently poisons
everything." Roughly: tune it, measure it, move on. *(BM25 = the standard keyword-relevance
score: term frequency × term rarity, length-normalised.)*

**Vector search is a quality continuum, dominated by two consequential, sticky choices:**

- **The embedding model.** Models span a real quality range, and crucially **embeddings from
  different models are incompatible** — switching model means re-embedding all ~16.5M sections.
  High switching cost. An industry line worth internalising: *embeddings set the ceiling for
  retrieval quality; a bad embedding model cannot be fixed downstream by any reranker or prompt.*
  *(Embedding = a model that turns text into a vector of numbers so that similar meanings sit
  close together; "vector search" finds the nearest vectors to the query's vector.)*
- **Chunking.** How we split a document into embeddable units (whole section vs paragraph vs
  sliding window) materially changes retrieval, and it is baked into the embeddings — changing
  it means re-chunking *and* re-embedding.

So vector is **not** "can't go wrong, go ahead." But it is **not** "must be perfect first time"
either, for two reasons:

1. It is **one retriever in a hybrid system** — fused with BM25 and cleaned up by a reranker.
   A good-not-perfect vector layer still adds value; its gaps are covered.
2. It is **de-riskable by piloting.** Embed a representative *subset* (~50–100k sections
   spanning the gold-set domains), build a small vector index, score on the gold set, choose
   the model + chunking, **then** commit to embedding all 16.5M.

**The discipline is therefore: pilot → measure → commit.** Same method that paid off on
archetype A and on Finding B. We neither guess blind nor make a one-shot irreversible bet.

---

## 3. Target architecture

The full pipeline, left to right. We are building it incrementally (§5); this is the
destination, not day one.

```
                    ┌─────────────────────────────────────────────────────────┐
   user idea ──▶    │  1. QUERY UNDERSTANDING  (LLM — Gemini)                  │
                    │     rewrite · expand with anchor Acts & terms-of-art ·   │
                    │     extract citations · classify intent/archetype        │
                    └───────────────────────────┬─────────────────────────────┘
                                                 │  (one enriched query → many sub-queries)
              ┌──────────────────────────────────┼──────────────────────────────────┐
              ▼                                   ▼                                   ▼
    ┌───────────────────┐             ┌───────────────────┐             ┌───────────────────┐
    │ 2a. KEYWORD (BM25)│             │ 2b. VECTOR        │             │ 2c. CITATION GRAPH│
    │  exact terms,     │             │  meaning / lay    │             │  amendments,      │
    │  citations  ✅    │             │  vocabulary       │             │  in-force, cases  │
    └─────────┬─────────┘             └─────────┬─────────┘             └─────────┬─────────┘
              └───────────────────────┬──────────┴────────────────────────────────┘
                                      ▼
                    ┌─────────────────────────────────────────┐
                    │ 3. FUSE  (reciprocal-rank fusion)        │  merge the ranked lists
                    │    + FILTER / BOOST (tier, domain)       │  into one candidate pool
                    └───────────────────┬─────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │ 4. RERANK  (cross-encoder, top ~100)     │  expensive, accurate
                    │    re-score each candidate vs the query  │  final ordering
                    └───────────────────┬─────────────────────┘
                                        ▼
                    ┌─────────────────────────────────────────┐
                    │ 5. SYNTHESIS  (LLM — Lex)                │  grounded briefing
                    │    write the answer WITH citations       │  + structured fields
                    └───────────────────┬─────────────────────┘
                                        ▼
                          ┌─────────────────────────┐
                          │ 6. AGENTIC RE-SEARCH?    │  LLM judges sufficiency;
                          │   if gaps → loop to (1)  │  issues follow-up queries
                          └─────────────────────────┘
```

*Reciprocal-rank fusion (RRF): a simple, robust way to merge several ranked lists — each
document scores 1/(k + its rank) in each list, summed across lists. It needs no score
calibration between retrievers, which is why it is the default fuser.*

*Cross-encoder reranker: a model that reads the query and one candidate **together** and outputs
a relevance score. Far more accurate than retrieval scoring (which embeds query and document
separately), but too slow to run over the whole corpus — so it runs only on the fused top ~100.*

---

## 4. What the LLM adds — and when we rank / when we chunk

**The LLM bookends the search; it does not do retrieval or core ranking.** Keeping this boundary
clear is what keeps us grounded.

- **Front — query understanding (cheap, one call).** Rewrites and expands the query, injects
  likely anchor legislation and statutory terms-of-art, extracts any citation, classifies the
  archetype. This is where we fix the *query side* of the vocabulary gap (§6a).
- **Back — synthesis (the existing Lex step).** Reads the reranked top results and writes the
  grounded briefing with citations. Never invents law not in the results.
- **Loop — agentic re-search (later).** The LLM inspects what came back, notices a gap ("found
  the framework Act but no enforcement cases"), and issues a targeted follow-up search.

**When do we chunk?** Only at **embedding time** (the vector layer). BM25 indexes whole sections
and needs no chunking. So chunking strategy is designed and tested as part of the vector pilot —
it does not exist before then.

**When do we rank?** **Twice**, deliberately:

1. **Retrieval ranking — cheap, wide.** Each retriever scores its own candidates (BM25 score;
   vector cosine similarity) and returns a pool (we already over-fetch ~5× the final count).
2. **Reranking — expensive, narrow, accurate.** After fusion, the cross-encoder re-scores the
   top ~100 candidates against the query directly. This is where final-ordering quality is won.

Between the two sit **fusion** (merge the pools) and **boosts/filters** (the legislation-tier
boost, later the domain projection). Final order = rerank output.

---

## 5. Layer roadmap — build order and rationale

Ordered by **value per unit of effort**, given the corpus we have and the queries Lex actually
generates (concept keywords, not citations).

| # | Layer | Status | Fixes | Why here |
|---|-------|--------|-------|----------|
| 1 | Keyword FTS (BM25) + citation resolver + legislation boost | ✅ done | exact terms; citation lookup; term-of-art legislation surfacing | foundation; cheap to iterate |
| 2 | Lex adapter (search wired into Lex) | ✅ done | gets real results in front of users | unblocks everything |
| 3 | **Query understanding / LLM expansion** | **next** | the *lay-vocabulary* gap (proven absent in Finding B) | **cheapest fix for the biggest hole**; one LLM call; ships in days |
| 4 | **Vector / semantic (hybrid + RRF)** | next major build | concept→meaning matching at the *corpus* side | the durable fix for vocabulary mismatch; first real Hetzner job; pilot-measure-commit |
| 5 | **Reranker (cross-encoder)** | after vector | final-ordering accuracy across all query types | highest-ROI quality multiplier once retrieval is decent; cheap to bolt on |
| 6 | **Citation / amendment graph** | after rerank | *relationship* queries (amendments, in-force, interpreting cases) | only fix for the [GRAPH] archetype; data-engineering heavy; narrower value |
| 7 | Archetype / domain projection | later tuning | domain-mixture filtering & boosting | refinement; depends on a stable base |

**Note the deliberate ordering of 3 before 4.** Finding B proved two different failures wear the
same mask: for *term-of-art* queries (MiFID) the anchor was retrieved but mis-ranked (the boost
fixed it); for *lay-phrased* queries (data protection, road safety) the anchor was **absent from
the candidate set** — BM25 literally cannot see it, because the statute's wording does not contain
the lay terms. Two complementary fixes exist for the lay case: expand the *query* to contain the
right words (layer 3, cheap, days) and match on *meaning* (layer 4, durable, weeks). We ship the
cheap one first and let it run alongside building the durable one.

---

## 6. Layer detail

### 6a. Query understanding / LLM expansion — the "Gemini shape" idea

**Verdict: strong, and sequenced early (layer 3).** This is your suggestion — use a general LLM
to get the shape of a legislative area and steer our own search — and it directly targets the
exact failure Finding B exposed.

The lay-vocabulary gap exists because the statute does not describe itself in lay terms: a search
for "data protection / privacy rights" never retrieves the Data Protection Act because the Act's
operative text doesn't use those phrases densely. An LLM that *knows* "data protection → Data
Protection Act 2018, UK GDPR, PECR" can inject those names and terms-of-art into the corpus query,
so the anchor **is** retrieved. It is the **query-side complement** to vector's corpus-side fix,
and it is far cheaper to ship (one LLM call vs embedding 16.5M sections).

**Mechanics.** Before searching, Gemini takes the user's concept keywords and returns: (a) likely
anchoring primary Acts/SIs, (b) statutory terms-of-art, (c) a few rephrasings. We add these to the
corpus query (and optionally fan out into parallel sub-queries, fused by RRF).

**Guardrail — steer, never assert.** LLMs hallucinate Act names and cite repealed law. So the
expansion output is a **query hint that the real corpus search verifies**, never a fact in the
briefing. If Gemini proposes an Act the corpus search can't corroborate, it simply doesn't surface.
The corpus remains ground truth.

**Parametric vs web-grounded.** Start with the model's own knowledge of UK law (cheaper, faster,
sufficient for anchor identification). Add Google/Gemini web grounding only if the model proves
stale on recent legislation — it buys currency at the cost of latency. Either way: steer, don't
assert.

### 6b. Vector / semantic search — and the embedding options

The durable fix for concept queries. Built as a **hybrid**: vector results fused (RRF) with BM25,
so we keep BM25's precision on exact terms and citations while gaining meaning-matching.

**Embedding options (range of cost/quality, ~April 2026 pricing — verify at build time):**

| Model | ~Price /1M tokens | Profile |
|-------|-------------------|---------|
| Gemini Embedding 001 | premium (Google) | leads English MTEB retrieval (~68); best API quality; Google lock-in |
| **Voyage voyage-3-large / 3.1-large** | **~$0.05–0.06** | **domain-tuned: +4–6 pts on legal/medical/code; strong legal pick, ~½ OpenAI-large cost** |
| OpenAI text-embedding-3-small | ~$0.02 | budget default (~62 MTEB); most integrations; Matryoshka dims |
| Google text-embedding-005 | ~$0.006 | best price-performance; 20× cheaper |
| Qwen3-Embedding-8B (self-host) | GPU cost only | top open-weight; flexible dims, 32K context; cheaper once >~100M tokens/mo |
| BGE-M3 (self-host) | GPU cost only | emits dense **and** sparse vectors in one call — convenient for hybrid |
| **Fine-tuned on our corpus** | training cost | **+10–30% on a specialised domain; the V3/V4 strategic asset** |

Cost anchor: a 1M-document pass runs roughly **$20 (OpenAI small) → $130 (OpenAI large)**. Our
corpus chunks into tens of millions of units, so the model choice is a real budget line — another
reason to pilot before committing.

**Recommended first pass:** pilot **2–3** models — one budget general (text-embedding-3-small or
Google 005), one **domain-tuned (voyage-3-large)**, optionally one open-weight (BGE-M3 / Qwen3) —
on the ~50–100k representative subset, score on the gold set, choose the best cost/quality, then
scale on Hetzner. Lean toward the domain-tuned model unless cost forbids: the +4–6 legal points
matter for this corpus, and embeddings are a ceiling we can't raise later without re-embedding.

**Storage note:** a 1,024-dim float32 vector is 4KB; 10M vectors ≈ 40GB. Dimensions drive storage
cost linearly. Some models (OpenAI, Cohere) support Matryoshka truncation — embed at full dimension,
store fewer — which lets us trade quality for storage gracefully.

### 6c. Reranker (cross-encoder)

After retrieval is decent, this is typically the **single highest-ROI component**. It re-scores
the fused top ~100 against the query directly and fixes ordering across *all* query types at once.
Cheap to add: either a small open cross-encoder run on our own box, or a rerank API (Cohere /
Voyage rerank) — both are config-swappable and scoreable on the gold set. Sequenced after vector
because reranking a weak candidate pool only re-sorts weak results; it multiplies a good pool.

### 6d. Citation / amendment graph — and the graphify.net question

**What it fixes:** *relationship* queries only — "what amends section X", "what cases interpret X",
"is this in force", "everything connected to this Act". These are the [GRAPH] archetype that floors
today because there is no edge table yet. It does **not** improve general relevance (that's vector).

**How we build it:** **directly from structured legislation data** — legislation.gov.uk exposes
explicit amendment/commencement/citation relationships (the changes feed, CLML structure). Explicit
edges are accurate and non-hallucinated. Sequenced after vector + rerank because it is
data-engineering heavy and narrower in value. *GraphRAG* (the LLM traversing the graph to assemble
and explain context, e.g. "trace this amendment history") is a later sophistication once the graph
exists.

**graphify.net — assessment: not the right tool, but borrow the patterns.** It is an MIT-licensed,
YC-backed tool that turns a **codebase** into a knowledge graph for AI coding assistants
(Tree-sitter parses code ASTs locally; LLMs extract concepts from prose; NetworkX + Leiden
clustering builds and clusters the graph). Two reasons it doesn't fit:
1. It is built around **code ASTs** (Tree-sitter parsing source) — that machinery doesn't map to
   legislation.
2. Its edges are **LLM-extracted from prose** (tagged EXTRACTED / INFERRED / AMBIGUOUS). For
   legislation that is exactly backwards: we have **explicit** structured relationships, which beat
   inferred ones on accuracy.

Three ideas worth stealing, though: (a) **confidence-tagged edges** — useful if we ever mix
explicit and inferred relationships; (b) **Leiden community detection** to discover policy-domain
clusters — relevant to the archetype/domain layer (§6e); (c) **serving compressed subgraphs** to
the LLM instead of raw documents — a token-efficient GraphRAG pattern for later.

### 6e. Archetype / domain projection

A later tuning layer: profile each document by its policy-domain mixture (a centroid in embedding
space per domain) and use that to filter and boost — your "music-genre archetype" analogy. Depends
on a stable vector base; revisit after layers 4–5 are in and measured. Worth a short design note of
its own before building.

---

## 7. Evaluation & A/B strategy — when do we split traffic?

**Now: offline gold-set scoring is the A/B mechanism.** With one real user (you, testing), there is
no live traffic to split for statistical signal. The gold set fills that role: run variant configs
against it and compare recall@20 / MRR. We have already been doing exactly this (the boost sweep).
Because every component is config-driven (§1.4), each variant is a config change scored the same day.

**Later: real-user A/B testing**, splitting live traffic and measuring engagement/outcomes, becomes
worthwhile once usage is large enough for significance. Premature before then.

**The foundational investment is the gold set itself.** It is the measurement instrument behind every
decision in this document — which embedding model, which chunking, reranker on/off, every boost.
Growing and validating it (the outstanding expected-sources pass) is the **highest-leverage
non-build task we have**, because it is what makes pilot-measure-commit trustworthy. A bigger,
validated gold set is worth more to search quality than any single feature.

---

## 8. Immediate next steps

1. **Ship the Finding A/B fixes** (timeout + warm-up + 1.8 boost): commit and redeploy fts-serve.
   Persist `FTS_FINDING_B_DIAG.md` as the evidence base for the vector decision.
2. **Validate + grow the gold set** (your expected-sources pass). Foundational; unblocks trustworthy
   measurement of everything below.
3. **Build layer 3 — LLM query-expansion** (the "Gemini shape" step). Cheapest fix for the proven
   lay-vocabulary gap; ships in days; runs alongside the vector build.
4. **Run the vector pilot** (layer 4): pick 2–3 embedding models → embed the ~50–100k representative
   subset → score on the gold set → commit to the winner → scale the full embed on Hetzner.
5. **Then** reranker (layer 5), **then** citation graph (layer 6).

Each step is gated on the gold-set number moving. That is the whole strategy in one sentence:
**layer the retrievers, let the LLM frame and finish, and never ship a change the gold set didn't
reward.**
