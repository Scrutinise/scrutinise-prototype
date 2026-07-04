# VECTOR EMBED — full-corpus gemini-embedding-001 @768-d (build report + runbook)

*2026-07-03 23:01 UTC. Executes the post-pilot embed brief. The pilot (`docs/PILOT_REPORT.md`)
picked the model (gemini-embedding-001, no legal-specialist premium) and dimension (768-d, no
measured recall loss vs 1536-d). This sprint BUILDS the full-corpus embed pipeline + ANN index +
the OFF-by-default production wiring, and CONFIRMS the actual token count + cost against the real
corpus. The embed RUN itself is the Charlie-triggered spend (Hetzner + Batch API) — inert until
then, exactly like the FTS full-corpus build.*

---

## 1. Actual corpus size + cost (the ~$600 gate — CONFIRMED WITHIN BUDGET)

Measured on Neon (`search/measure-corpus.ts`, re-runnable), compiled `corpus_sections`:

| quantity | value |
|---|---|
| compiled sections | **17,640,217** |
| total wordCount | **6,124,815,367** (~6.12 B words; avg 347/section, max 2.09 M) |
| modelled chunks (pilot chunking) | **~22,249,310** (1.26 chunks/section) |
| embedded chars (overlap counted, 8-chunk cap applied) | ~27.59 B |
| **est. embed tokens** | **~6.90 B** (chars/4, conservative) / ~5.69 B (words×1.3) |

**Cost at the Batch-API rate** (gemini-embedding-001 = $0.15/1M standard → **$0.075/1M batch**,
verified on ai.google.dev/gemini-api/docs/pricing):

| token estimate | batch cost @ $0.075/1M |
|---|---|
| 6.90 B (chars/4, conservative) | **~$517** |
| 5.69 B (words×1.3) | **~$427** |

→ **~$430–520.** Within the brief's ~$400–600 prediction and **under the ~$600 gate — no flag
raised, proceeding.** (The 8-chunk cap on the 29,932 >20k-word debate/committee sections is what
keeps the long tail bounded: those embed ≤8 windows each, not their full ~43k-word length.) Actual
invoiced cost is reported by the run; the Batch API meters input tokens, so the real figure lands
between the two estimates above (~$450–490 expected).

**Why 768-d matters for storage (not embed cost):** Gemini meters *input tokens*, so 768 vs 1536
does not change the embed bill — it halves the **vector store**: 768 × 4 B = 3,072 B/vector ×
22.25 M ≈ **68 GB** on R2 (vs ~137 GB at 1536-d), and halves ANN RAM. The batch discount is the
50% embed-cost saving; the 768-d Matryoshka truncation is the 50% storage saving. Both apply.

---

## 2. What was built (inert until triggered)

Pipeline (`scripts/ingest/search/`), all resumable + idempotent (R2 checkpoints), mirroring
`build-fts-index.ts`:

1. **`chunk.ts`** — the validated pilot chunker extracted pure (byte-identical to `pilot-chunk.ts`
   so the pilot's recall numbers transfer): short sections whole; long → ~800-tok windows, 15%
   overlap, cap 8; parent section id on every chunk.
2. **`build-corpus-chunks.ts`** (STEP 1) — streams all 17.6 M compiled sections from Neon → reads
   bodies from R2 → chunks (+ archetype-A citation backfill on legislation, identical to the BM25
   index) → writes the `corpus_chunks` Lance manifest on R2. The bandwidth-bound part (→ Hetzner);
   decoupled so a model/dims re-tune never re-pays the 17.6 M R2 reads.
3. **`gemini-batch.ts`** — the ONLY module touching the Batch API (Files upload →
   `batches.createEmbeddings` (`:asyncBatchEmbedContent`) → poll → download → parse). 50% discount.
   JSONL build + response parse are pure + offline-selftested; the live JSONL/response shape is
   validated by the `--canary` (external-API behaviour advisory until run, per CLAUDE.md §0/§13).
4. **`build-vector-index.ts`** (STEP 2) — shards `corpus_chunks` into ≤40k-request batch jobs
   (< the 50k/job cap), ≤8 in flight (bounds the enqueued-token + Files-storage footprint; input
   files deleted as shards complete), writes vectors to `corpus_vec`, then builds the **IVF_PQ ANN
   index** (cosine, 4096 partitions, 96 sub-vectors). `--canary` runs one small shard end-to-end.
5. **`vector-core.ts` + `vector-query-service.ts`** — live query-embed (RETRIEVAL_QUERY, sync
   `embedContent`) + ANN search collapsing chunks→sections; HTTP serve (INERT, the vector analogue
   of `fts-query-service.ts`).

Production wiring (`scrutinise-web/lib/lex/`):

6. **`vector-search.ts`** — platform adapter (mirrors `fts-search.ts`): POSTs `VECTOR_SEARCH_URL`,
   maps hits → `SearchResult`, hydrates title/citation/url/date. Returns `[]` unless the URL is set.
7. **`search-gateway.ts`** — wired behind the reserved **`LEX_SEARCH_VECTOR`** flag (**OFF**). When
   ON it fuses BM25 with the vector rank via the **TUNED weighted RRF** — `0.7/(60+rank_vec) +
   0.3/(60+rank_bm25)`, the shipped 70/30 spec from `docs/FUSION_REPORT.md` (env
   `LEX_FUSION_VECTOR_WEIGHT`, default 0.7) — NOT the naive equal-weight RRF the pilot showed drags
   a strong model down. **Flag stays OFF** until 70/30 is re-confirmed on the full-corpus ANN index
   + the gold key is validated. `runVectorSearch` is doubly inert (flag OFF *and* URL unset).

`tsc --noEmit`: `scripts/ingest` = only the 4 documented pre-existing errors; `scrutinise-web` =
only the 2 pre-existing `react-markdown` errors. No new errors. `@google/genai@^1.52` added to
`scripts/ingest/package.json` (official SDK; isolates the Batch API's Files-upload + LRO polling).

---

## 3. Runbook — the Charlie-triggered spend (Hetzner CCX43 + Batch API)

The heavy build runs on a transient Hetzner box (`hetzner-build-run.ts`; `run` = the gated spend).
The two steps run on the box; progress checkpoints to R2 (fts-watch-visible).

```
# 0. Reconfirm cost just before spending (cheap, read-only):
npx tsx search/measure-corpus.ts

# 1. CANARY — ✅ RUN + PASSED 2026-07-04 (~$0.01). One 200-chunk shard through the live
#    Batch API to corpus_vec_canary: job SUCCEEDED; 200/200 vectors, all exactly 768-d
#    (Matryoshka honoured); order/key assertions clean; norms 0.572–0.584 (no zero/NaN);
#    cos(adjacent same-section windows)=0.932 > cos(different sections)=0.854. The live
#    JSONL/response contract is CONFIRMED. (SDK note: batches.createEmbeddings() prints an
#    "experimental" warning — pin @google/genai before the full run if re-installing.)
#    corpus_chunks holds the first 5,000 sections (23,130 chunks, 0 body misses) from the
#    bounded STEP-1 run; the full build RESUMES from that checkpoint (no redo).
npx tsx search/build-corpus-chunks.ts --limit 5000   # done
npx tsx search/build-vector-index.ts --canary        # done — PASS

# 2. FULL build on Hetzner (setup is INERT; run is the spend):
npx tsx search/hetzner-build-run.ts setup
HETZNER_API_TOKEN=… npx tsx search/hetzner-build-run.ts run \
  "R2_MAX_SOCKETS=256 npx tsx search/build-corpus-chunks.ts && npx tsx search/build-vector-index.ts"
npx tsx search/hetzner-build-run.ts logs          # tail; monitor R2 checkpoints via fts-watch
npx tsx search/hetzner-build-run.ts teardown      # when done — frees compute

# resumable: re-run either script to resume from its R2 checkpoint; --index-only rebuilds the ANN.
```

Tune before the run if the account's Batch tier is low: `VECTOR_MAX_INFLIGHT` (enqueued-token
quota) and `VECTOR_SHARD_SIZE` (≤50k). Batch jobs have a ≤24h SLA (usually faster for embeddings).

---

## 4. Caveats / follow-ups

- **Flag stays OFF.** Fusion IS tuned (70/30 weighted RRF, `docs/FUSION_REPORT.md`, wired here) —
  but the brief says do NOT flip it live, and it should be **re-confirmed on the full-corpus ANN
  index** (the pilot tuned on the 60k exact-cosine subset) before the flag flips. The plateau
  (60/40–80/20 all ≥85.3%) means the decision won't hinge on the re-run, but the ANN recall
  tradeoff (below) still needs measuring first. Flipping the flag is the next sprint, not this one.
- **ANN recall vs exact** (IVF_PQ, cosine) is a separate measurement (the pilot used exact cosine
  so the model comparison wasn't confounded). Re-score the gold set through the ANN path; tune
  `VECTOR_NPROBES`/`VECTOR_REFINE_FACTOR`/partitions if PQ recall disappoints (or switch to HNSW_SQ).
- ~~**Batch JSONL/response shape** is the one live-unverified contract → the `--canary` is the gate.~~
  **RESOLVED 2026-07-04: canary PASSED** (see §3 step 1) — the live contract is confirmed end-to-end.
  Residual: `batches.createEmbeddings()` is SDK-flagged experimental; `corpus_vec_canary` + its
  checkpoint are throwaway R2 artifacts (drop at will).
- **Gold key** is still CCh's unvalidated draft (same caveat as the FTS harness) — numbers stay
  directional until it's validated.
- **corpus_chunks** (~27 GB chunk text on R2) is retained (feeds hybrid/rerank without re-reading
  the corpus); it can be dropped after embedding if storage is tight.
