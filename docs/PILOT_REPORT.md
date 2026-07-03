# VECTOR PILOT — embedding-model bake-off: decision report

*2026-07-03 15:50 UTC. Pilot to pick ONE embedding model on the gold set BEFORE the
full-corpus embed (the sticky cost — different models' vectors are incompatible, so
switching = re-embed everything). Numbers: `docs/PILOT_RESULTS.md` + `docs/pilot_results.json`.
Subset: `docs/PILOT_SUBSET.md`. All recall@20 figures are on the same 60k-section subset
(every gold answer + stratified distractors), scored by the same gold regex as the FTS harness.*

## Decision: **gemini-embedding-001** (best-general), NOT the legal-specialist voyage-4

The central question the brief posed — *does a legal-specialist model actually beat a
general one on OUR corpus?* — answers **no**. voyage-4 and gemini **tie on vector-alone
(both 85.9%)**, and **gemini wins on the hybrid end-state (84.3% vs 81.1%)**. There is no
legal-specialist premium to justify a new Voyage dependency; gemini is already integrated
(existing key/infra) and is the more robust choice on the hardest cases (B6 below).

| model | dims | BM25 | vector | hybrid (RRF) | hybrid − BM25 |
|---|---|---|---|---|---|
| **gemini-embedding-001** | 1536 | 68.3% | 85.9% | **84.3%** | **+16.0pp** |
| voyage-4 | 1024 | 68.3% | 85.9% | 81.1% | +12.8pp |
| e5-large-instruct (open-weight) | 1024 | 68.3% | 70.5% | 77.2% | +9.0pp |

*recall@20, excl. the archetype-D [GRAPH] engine floor, n=26. BM25 baseline = the current
engine's semantics on the subset (chunk-BM25 + title/leg-tier boost + archetype-A citation
resolver); it reproduces the full-corpus headline (~67–69%), confirming the subset is a
faithful stand-in.*

## Does the vector layer help? Yes — decisively, and exactly where predicted

- **Overall:** BM25 68.3% → gemini vector **85.9% (+17.6pp)** / hybrid 84.3% (+16.0pp).
- **Archetype B — lay-vocabulary concept search (the brief's core target):** BM25 **23.6% →
  gemini vector 69.4% (+45.8pp)**. This is the vocabulary-bridge win the whole exercise was
  about — "can my landlord kick me out without a reason?" now finds Housing Act 1988 s.21
  without the user knowing the statute's name.
- **B6 — the MiFID legislation-burial flagship:** BM25 **0% → vector 50%** for all three
  models. Vector retrieval surfaces 3 of the 6 validated MiFID sources that BM25 buried under
  parliamentary/HMRC noise even when the Act was named. The vector layer fixes the burial the
  Stage-3 A/B flagged — partially (3/6), so B6 stays the hardest case.
- **Citations (archetype A) are NOT hurt:** gemini hybrid **100%** (vs BM25 90%). The bar
  "vector must not hurt precise lookups" is met — the BM25 citation resolver still pins exact
  sections, and fusion keeps them.

## The important nuance: equal-weight RRF is the wrong fusion for a strong model

For both strong models, **hybrid < vector-alone** (gemini 84.3 < 85.9; voyage 81.1 < 85.9).
Only the weak model improves under hybrid (e5 77.2 > 70.5). Equal-weight RRF drags the strong
vector ranking back toward the much weaker BM25 (68.3%): e.g. B5 gemini vector 100% → hybrid
66.7%; C1 66.7% → 33.3%; E1 100% → 50%. And voyage's B6 **collapses 50% → 0%** purely from the
RRF interaction. The exception is citations, where BM25's resolver genuinely adds (A: hybrid >
vector). 

**Implication for the end-state:** don't ship naive equal-weight RRF. Route by query kind —
vector-dominant (vector-alone or vector-weighted fusion) for concept/lay queries; keep the
BM25 + citation-resolver path for citation lookups (the routing production already does by
scoping expansion to Page-1 keywords vs citation lookups). A weighted RRF (favouring vector,
BM25 as a tiebreaker) is the recommended follow-up to tune.

## The open-weight datapoint (economics)

e5-large-instruct (the only serverless open-weight embedding model Together now serves; BGE-M3
is delisted and BGE-* are non-serverless) lands **~8pp behind** the leaders on vector-alone
(70.5% vs 85.9%) and lost citation precision (A vector 80%). It was handicapped by Together's
**512-token context cap** (chunks truncated to ~700 chars). It still beats BM25 (+9pp hybrid),
so a self-hosted open model is a viable cost floor — but leaves real recall on the table vs a
managed model. Not recommended unless embedding cost becomes the binding constraint.

## Caveats (this is a pilot — provisional)

- Gold expected-sources are CCh's **unvalidated** draft (same caveat as the FTS harness);
  numbers are directional, not final.
- **gemini is 1536-d** vs voyage/e5 1024-d → a larger full-corpus index (~1.5× storage/RAM).
  gemini supports Matryoshka `outputDimensionality` (768/1536/3072); **test gemini@768 before
  the full embed** — if it holds recall, it halves the sticky storage cost.
- Chunking used the default (whole ≤1024 tok; else ~800-tok windows, 15% overlap, cap 8/section
  → 1.33 chunks/section, 79,908 chunks). Not tuned — a lever for the follow-up.
- Vector search was **exact** (in-memory cosine, no ANN) so no recall loss confounds the model
  comparison; the production full-corpus index will need an ANN index (IVF/HNSW) whose recall
  tradeoff is a separate measurement.

## Full-corpus embed — the sticky cost this pilot de-risks

The corpus is ~5.06B words ≈ **~6–7B tokens**. At current embedding prices that is **~$800–1,200
per model** for one pass — which is exactly why picking the model on a 60k subset first (this
pilot, ~28M tokens/model, well within free tiers) was worth it. Recommended next step: embed the
full corpus with **gemini-embedding-001** (test @768-d first), build an ANN index, and wire the
`vector` capability flag already reserved in `lib/lex/search-gateway.ts`.

## How to reproduce / extend

```
tsx search/pilot-subset.ts     # validated subset id-list → R2 _search/pilot/subset.json
tsx search/pilot-chunk.ts      # chunk + subset BM25 index (pilot_chunks)
tsx search/pilot-embed.ts --model gemini|voyage|e5 [--reset]   # per-model vectors
tsx search/pilot-score.ts      # vector/hybrid/BM25 recall@20 → PILOT_RESULTS.md
```
Adding a 4th candidate = one entry in `pilot-providers.ts`, then embed + re-score. Provider keys:
Gemini/Together in `scrutinise-web/.env`; Voyage needs a payment method on the account to lift
the free-tier 3 RPM / 10K TPM cap (standard limits, still within free token credits).
