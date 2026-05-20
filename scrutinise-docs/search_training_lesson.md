# Search architecture — apprentice training lesson

This is a self-contained education on full-text search and semantic search, written for someone who reads code but doesn't write it. By the end you'll understand the architecture choices for Scrutinise, the technical terms used in search work, and what's happening under the hood when Lex performs a search.

---

## Part 1: The fundamental problem

When you have 650,000 sections of legal text and a user asks Lex "find me legislation about data protection," what does the computer actually do?

It can't read every section in order — that'd take minutes per query. It needs to have done preparation work in advance so that at query time, finding relevant sections is fast (milliseconds).

This preparation work is called **indexing**. The data structure that holds the preparation work is called an **index**. Searching is fundamentally about building good indexes and querying them efficiently.

The two main families of indexes for text search:

1. **Inverted indexes** (used by FTS) — "for each word, which documents contain it?"
2. **Vector indexes** (used by semantic search) — "which documents are conceptually closest to this query?"

We'll cover each in detail.

---

## Part 2: Full-text search (FTS)

### The inverted index

Suppose you have three documents:

```
Doc 1: "The Data Protection Act 2018"
Doc 2: "The Online Safety Act 2023"
Doc 3: "The Data Reform Act 2022"
```

A simple inverted index of words to documents:

```
"the":         [Doc 1, Doc 2, Doc 3]
"data":        [Doc 1, Doc 3]
"protection":  [Doc 1]
"act":         [Doc 1, Doc 2, Doc 3]
"2018":        [Doc 1]
"online":      [Doc 2]
"safety":      [Doc 2]
"2023":        [Doc 2]
"reform":      [Doc 3]
"2022":        [Doc 3]
```

To search "data protection," you:
1. Look up "data" → [Doc 1, Doc 3]
2. Look up "protection" → [Doc 1]
3. Intersect → [Doc 1]

Doc 1 is your match. This took two index lookups and an intersection — fast even for millions of documents.

This is the core idea behind FTS. Real implementations are more sophisticated:

### Tokenisation, stemming, stopwords

Before building the index, raw text gets transformed:

**Tokenisation** — splitting text into words. Simple in English ("split on whitespace and punctuation"), harder for Chinese (no spaces between words). Postgres tokenises English by default.

**Stemming** — reducing words to their root form. "Running," "runs," "ran" → "run". So a search for "runs" matches a document containing "running." Postgres uses Snowball stemmer by default.

**Stopwords** — common words that carry little meaning are excluded from the index. "the," "a," "of," "and" appear in nearly every document — indexing them wastes space without helping searches. Postgres has a default English stopword list.

So our index above is wrong — Postgres would skip "the" because it's a stopword and stem "protection" might become "protect" depending on configuration.

### Tsvector and tsquery

Postgres has two specialised types for FTS:

**tsvector** is a sorted, deduplicated list of stemmed tokens with their positions in the original text. It's the data structure stored in the index.

```sql
SELECT to_tsvector('english', 'The Data Protection Act 2018');
-- Returns: '2018':5 'act':4 'data':2 'protect':3
```

Note: "the" was dropped (stopword), "protection" was stemmed to "protect," numbers preserved. The `:N` is position in the original text — useful for phrase matching.

**tsquery** is a structured query expression.

```sql
SELECT plainto_tsquery('english', 'data protection');
-- Returns: 'data' & 'protect'
```

The query is "data AND protect" (after stemming). The `&` is AND, `|` is OR, `!` is NOT.

The match operator `@@` checks whether a tsvector satisfies a tsquery:

```sql
SELECT to_tsvector('english', 'The Data Protection Act 2018') @@ plainto_tsquery('english', 'data protection');
-- Returns: true
```

### GIN index

A tsvector column on its own isn't searchable fast. Postgres needs a **GIN (Generalized Inverted iNdex)** to make `@@` queries efficient:

```sql
CREATE INDEX idx_fts ON legislation_section USING GIN (fts_vector);
```

Without this index, a tsvector match query scans every row. With it, the query uses the inverted index structure described above.

GIN indexes are slow to build (15-30 minutes for 650k rows) and slightly slow to update (each new row updates the index), but very fast to query (sub-100ms for our corpus). The trade-off is right for our use case where we read far more than we write.

There's also **GiST (Generalized Search Tree)** — an alternative index type for tsvector. GiST is faster to build and update but slower to query. GIN is correct for us.

### Ranking — ts_rank vs ts_rank_cd

Matching is binary (yes/no) but **ranking** is what gives search results their order. Two main approaches in Postgres:

**ts_rank** — counts term frequency. The more times a query term appears, the higher the rank.

**ts_rank_cd** (cover density) — also considers term proximity. If "data" and "protection" appear next to each other, that's a better match than if they're paragraphs apart. Cover density is generally better for natural language queries.

Both produce a number between 0 and 1. Higher is more relevant. We use `ts_rank_cd`.

There's a subtle issue: these ranks don't account for document length. A 50-word section with two matches ranks higher than a 5,000-word section with two matches, which is usually right. But sometimes you want the long substantive section, not the short procedural one. Tuning this is what makes search tuning hard.

### Weighting

We can weight different parts of a document. In our schema:

```sql
setweight(to_tsvector('english', title), 'A') ||
setweight(to_tsvector('english', compiled_text), 'B')
```

The title gets weight A (highest), body text gets weight B. Default weights are:
- A: 1.0
- B: 0.4
- C: 0.2
- D: 0.1 (default)

So a title match counts as 2.5× a body match. If you wanted to add a `summary` field weighted between title and body, you'd give it weight C.

### Phrase search

To search for an exact phrase, use `phraseto_tsquery`:

```sql
SELECT plainto_tsquery('english', 'criminal procedure');
-- Returns: 'criminal' & 'procedur'  (any document with both words)

SELECT phraseto_tsquery('english', 'criminal procedure');
-- Returns: 'criminal' <-> 'procedur'  (the words must be adjacent)
```

The `<->` operator is "followed by." `<2>` is "within 2 words." This lets users search for phrases like `"Criminal Procedure Code"` and find exact matches, not just documents containing all three words separately.

### Snippets — ts_headline

After finding matches, you want to show users (or Lex) WHERE in the document the match occurred. `ts_headline` generates a snippet with the matched terms highlighted:

```sql
SELECT ts_headline(
  'english',
  'In section 5(1), the data protection principles apply to processing.',
  plainto_tsquery('english', 'data protection'),
  'MaxFragments=2,MinWords=10,MaxWords=30'
);
-- Returns: 'In section 5(1), the <b>data</b> <b>protection</b> principles apply to processing.'
```

Highlighting wraps matched terms in `<b>` tags (configurable). For Lex tool calls, we'd return plain snippets without HTML.

### Limitations of FTS

What FTS does well:
- Exact and near-exact keyword matching
- Phrase matching
- Boolean queries
- Fast (sub-100ms on our corpus size)
- Cheap (no API calls, just SQL)
- Deterministic

What FTS doesn't do:
- **Semantic matching.** Won't find "GDPR" when user searches "data protection regulation" unless both literal terms are in the document.
- **Synonyms.** Won't know that "automobile" and "car" are the same thing without explicit synonym configuration.
- **Spelling correction.** "data protetion" won't match "data protection."
- **Conceptual similarity.** "regulating online speech" won't find content about "social media moderation" unless those words appear together.

For these capabilities, you need vector search.

---

## Part 3: Vector search (semantic search)

### Embeddings — the core concept

The breakthrough idea behind modern semantic search: **represent meaning as a list of numbers**.

A neural network reads a piece of text and outputs a list of (say) 768 numbers. This list is called an **embedding** or a **vector**. Two pieces of text with similar meaning produce embeddings with similar number patterns.

```
"Data Protection Act 2018"      → [0.21, -0.04, 0.78, 0.55, ..., -0.12]  (768 numbers)
"GDPR regulation 2016"          → [0.19, -0.06, 0.74, 0.52, ..., -0.10]  (similar numbers)
"Recipe for chocolate cake"     → [-0.45, 0.81, -0.30, 0.02, ..., 0.61] (very different)
```

The embedding model has learned during training that "data protection" and "GDPR" are related concepts, so their embeddings end up in similar regions of the 768-dimensional space.

How does it know? By being trained on enormous amounts of text where these concepts appear in similar contexts. The model has seen sentences like "GDPR governs personal data protection" and "the Data Protection Act implements GDPR" countless times, so their semantic representations converge.

### Dimensions and what they mean

A 768-dimensional vector lives in 768-dimensional space. We can't visualise this directly (we're 3D creatures), but the maths is the same as 2D or 3D.

In a hypothetical simplified 2-dimensional embedding space, you might imagine:

```
Dimension 1: "Legal / Technical" axis
Dimension 2: "Privacy / Public" axis

Data Protection Act:  [0.9 legal, 0.8 privacy]
GDPR:                 [0.9 legal, 0.9 privacy]
Open Data Initiative: [0.7 legal, 0.1 privacy]
Sourdough recipe:     [0.0 legal, 0.0 privacy]
```

GDPR and Data Protection Act are close in this 2D space (both high legal, both high privacy). Real embedding models have 768 or more dimensions and we don't know what each one "means" — they're abstract features learned by the model.

### Similarity measures

Once we have embeddings as vectors, how do we compare them? Three common methods:

**Cosine similarity** — angle between vectors. Range: -1 (opposite) to 1 (identical direction). Ignores magnitude. Most common for text embeddings.

```
cos(A, B) = (A · B) / (||A|| × ||B||)
```

**Euclidean distance** — straight-line distance. Lower is more similar. Used when magnitude matters.

**Dot product** — fast to compute. Good when vectors are normalised (so magnitude doesn't matter).

For Scrutinise: cosine similarity is the default. pgvector supports all three via different operators (`<=>`, `<->`, `<#>`).

### Generating embeddings

You don't write code that produces embeddings — you call an API. Major providers:

| Provider | Model | Dimensions | Cost per 1M tokens | Notes |
|---|---|---|---|---|
| Google | text-embedding-004 | 768 | $0.13 | Recommended for Scrutinise — same vendor as Lex |
| OpenAI | text-embedding-3-small | 1536 | $0.02 | Cheaper, slightly better quality |
| OpenAI | text-embedding-3-large | 3072 | $0.13 | Higher quality, more storage cost |
| Cohere | embed-english-v3.0 | 1024 | $0.10 | Specialised for English |

The trade-offs:
- More dimensions = more storage but generally better quality (up to a point)
- More dimensions = slower similarity computation but with proper indexes, marginal
- Different models capture different "meanings" — switching models requires re-embedding everything

For 650k sections at ~500 tokens average = 325 million tokens. Gemini text-embedding-004 cost: about $42 for the whole corpus, one-time. Plus ongoing costs for new documents and search queries (each query needs its own embedding).

### Chunking

Embedding models have token limits. Gemini's text-embedding-004 handles up to 2,048 tokens (~1,500 words). What about a 5,000-word section?

You **chunk** — split the section into overlapping passages, embed each separately:

```
Original section: 5,000 words

Chunks (1500 words each, 200 word overlap):
  Chunk 1: words 1-1500     → embedding A
  Chunk 2: words 1300-2800  → embedding B  
  Chunk 3: words 2600-4100  → embedding C
  Chunk 4: words 3900-5000  → embedding D
```

The overlap is crucial — it prevents a relevant phrase from being split across chunks and losing context.

Each chunk gets its own embedding. Search returns chunks; the application maps chunks back to their parent sections. Lex sees both the matched chunk and the parent section for full context.

For Scrutinise: most legal sections are under 2,000 words and need no chunking. Long sections (Acts with massive schedules) need chunking. We'd implement chunking conditionally based on length.

### Vector indexes

Like FTS needs GIN indexes, vector search needs specialised indexes to be fast. With 650k vectors, comparing a query vector to every stored vector takes too long without an index (called "brute force" search).

Three index types in pgvector:

**HNSW (Hierarchical Navigable Small World)** — graph-based index. Very fast queries (sub-10ms typical). Slightly slower to build. Recommended for most use cases including ours.

**IVFFlat (Inverted File with Flat compression)** — partition-based index. Faster to build than HNSW. Slightly slower at query time. Requires periodic rebuilding as data grows.

**No index (brute force)** — for small datasets only (<10k vectors).

For Scrutinise: HNSW is the right choice.

### How vector search works in practice

```sql
-- The user query: "find legislation about regulating online speech"

-- Step 1: Embed the query (API call to Gemini)
-- Returns: [0.34, -0.12, 0.89, ..., 0.05]  (768 numbers)

-- Step 2: Find sections with most similar embeddings (cosine similarity)
SELECT 
  id,
  actId,
  sectionNumber,
  title,
  embedding <=> $1 AS distance
FROM legislation_section
WHERE embedding IS NOT NULL
ORDER BY embedding <=> $1
LIMIT 20;

-- The <=> operator is cosine distance (1 - cosine similarity)
-- Lower distance = more similar
-- The HNSW index makes this query fast
```

Results would include sections about online safety, social media regulation, content moderation, free speech laws, communications acts — even if those sections don't contain the literal words "regulating online speech."

### Strengths of vector search

- **Semantic understanding.** Finds conceptually related content regardless of vocabulary
- **Multilingual.** Most modern embedding models handle multiple languages
- **Robust to typos and rewording.** Embeddings are stable across small text variations
- **Powerful for LLMs.** Vectors are the native representation LLMs work with

### Weaknesses of vector search

- **No exact matching.** Can't reliably find documents containing a specific phrase
- **Latency.** Every query needs an embedding API call (~200-500ms)
- **Cost.** Each query costs money. Each new document costs money to embed.
- **Black box.** Hard to debug "why didn't this match?" — embeddings aren't human-readable
- **Tuning is hard.** Chunking strategy, model choice, similarity threshold all affect quality

---

## Part 4: Hybrid search — why we use both

Each approach has complementary strengths:

| Capability | FTS | Vector |
|---|---|---|
| Exact phrase | Excellent | Poor |
| Semantic similarity | Poor | Excellent |
| Speed | Fast (10-50ms) | Medium (200-500ms) |
| Cost | Free per query | $0.001-0.01 per query |
| Determinism | High | Medium |
| Handles typos | Poor | Good |
| Handles synonyms | Poor (needs config) | Excellent |

Hybrid search runs both queries in parallel and combines results. This catches cases where one approach fails.

### Combining results — Reciprocal Rank Fusion (RRF)

The challenge: FTS returns a list ranked by tsrank (e.g. 0.0-1.0 scores), vector search returns a list ranked by cosine distance (e.g. 0.0-2.0 inverse). The score ranges don't compare directly.

**RRF** is a simple but effective fusion method:

```
For each result, compute: 1 / (rank + k)
  where rank is the position in the source list (1-based)
  and k is a constant (typically 60)

Sum scores across both lists for items that appear in both.
Sort by total score, return top N.
```

Example:
```
FTS results:
  Doc A: rank 1 → 1/(1+60) = 0.0164
  Doc B: rank 2 → 1/(2+60) = 0.0161
  Doc C: rank 3 → 1/(3+60) = 0.0159

Vector results:
  Doc D: rank 1 → 0.0164
  Doc A: rank 2 → 0.0161
  Doc E: rank 3 → 0.0159

Combined:
  Doc A: 0.0164 (FTS) + 0.0161 (vector) = 0.0325  ← appears in both, wins
  Doc D: 0.0164
  Doc B: 0.0161
  Doc E: 0.0159
  Doc C: 0.0159
```

RRF is simple, score-range-agnostic, and works well in practice. More sophisticated fusion methods exist (learned-to-rank, weighted combinations) but RRF is a strong baseline.

### Reranking

After fusion, results can be further improved by **reranking** — taking the top N results and re-scoring them more carefully.

**Cross-encoder reranking:**

A cross-encoder model takes (query, document) pairs and outputs a relevance score. Unlike embedding similarity (which is computed independently for query and document), cross-encoders look at both together — they're more accurate but slower.

Typical pipeline:
1. Retrieve top 50 candidates using hybrid FTS + vector
2. Score each candidate using a cross-encoder model (cost: ~5ms × 50 = 250ms)
3. Re-sort by cross-encoder score
4. Return top 10

This is what state-of-the-art search products do.

**LLM reranking:**

For high-stakes queries, send the top 20 results to Lex with a prompt like "Which 5 of these best answer the query?" Lex reasons about relevance more deeply than any embedding model can. Cost: more time and money per query.

For Scrutinise: start without reranking. Add cross-encoder reranking in v2 if search quality is insufficient. Add LLM reranking for specific analytical queries where quality matters more than cost.

---

## Part 5: Lex's analytical mode — putting it together

Charlie's stated goal: Lex should be able to say "last time this was discussed, the main concerns were X, Y, Z."

This requires:

1. **Cross-corpus search.** Lex needs to find related material in Hansard (parliamentary debates), committee evidence, and Erskine May (procedural manual), not just primary legislation.

2. **Embeddings across all corpora.** All material — legislation, Hansard, committees, codes — uses the same embedding model. This lets Lex find semantic neighbours regardless of corpus.

3. **Temporal awareness.** "Last time this was discussed" implies time. Embeddings don't know about time; the database does (via timestamp fields). Lex's query construction includes temporal filters.

4. **Multi-step retrieval.** Lex first identifies the topic (e.g. "this proposal is similar to the Online Safety Act section 121"), then searches for related material around that anchor.

5. **Synthesis.** Lex reads the retrieved material and synthesises an answer. This is where the LLM (Gemini) shines.

### Example flow

User asks Lex: "How would Parliament likely react to a proposal to require platforms to verify users' real names?"

Lex's internal reasoning (simplified):
1. Identify topic: "platform identity verification" 
2. Search legislation FTS+vector: find Online Safety Act 2023 provisions on platforms, identity verification
3. Search Hansard vector: find debates about identity verification, real-name requirements, anonymity
4. Search committee material vector: find evidence sessions, reports on platform regulation
5. For each retrieved item, note key concerns raised, dates, speakers
6. Synthesise: "When similar provisions were debated in 2021 (Online Safety Bill), the main concerns were: anonymity protection for vulnerable users [Lords debate 12 May 2022], operational burden on smaller platforms [JCHR report Jan 2022], and effectiveness given international users [Tech Committee evidence Nov 2021]. Recent ICO guidance suggests..."

This kind of response is what makes Lex genuinely useful versus generic AI. It cites real sources, draws on real debate, and gives Charlie's users (policy professionals) something they couldn't easily produce themselves.

None of this works without good search underneath. Hence the priority.

---

## Part 6: Key technical terms — quick reference

| Term | Meaning |
|---|---|
| **FTS** | Full-text search — keyword/phrase matching using inverted indexes |
| **Inverted index** | Data structure mapping words to the documents containing them |
| **Tsvector** | Postgres data type holding stemmed, deduplicated tokens with positions |
| **Tsquery** | Postgres data type for structured FTS queries (AND, OR, phrase) |
| **GIN index** | Generalized Inverted iNdex — the Postgres index type used for FTS |
| **GiST index** | Alternative to GIN — faster build, slower query |
| **Stemming** | Reducing words to root form ("running" → "run") |
| **Stopwords** | Common words excluded from indexing ("the," "and," "of") |
| **Tokenisation** | Splitting text into words for indexing |
| **ts_rank / ts_rank_cd** | FTS ranking functions (cover density variant considers proximity) |
| **ts_headline** | Postgres function to generate highlighted snippets |
| **Embedding** | A vector of numbers representing the meaning of a piece of text |
| **Vector** | Same as embedding — a list of numbers in N-dimensional space |
| **Dimensions** | The length of an embedding vector (768, 1024, 1536, 3072 are common) |
| **Cosine similarity** | Most common similarity measure for embeddings — angle between vectors |
| **pgvector** | Postgres extension that adds vector storage and similarity search |
| **HNSW** | Hierarchical Navigable Small World — efficient vector index type |
| **IVFFlat** | Alternative vector index — faster build, slower query |
| **Chunking** | Splitting long documents into smaller passages for embedding |
| **Hybrid search** | Running FTS and vector search in parallel, combining results |
| **RRF** | Reciprocal Rank Fusion — simple method to combine ranked result lists |
| **Reranking** | Post-processing search results with a more accurate (slower) model |
| **Cross-encoder** | Model that scores (query, document) pairs together — more accurate than embedding similarity |
| **BM25** | Classic FTS ranking algorithm — Postgres uses a variant |
| **Recall** | What fraction of relevant documents the search found |
| **Precision** | What fraction of returned documents are actually relevant |
| **MAP / NDCG** | Search quality metrics (Mean Average Precision, Normalised Discounted Cumulative Gain) |

---

## Part 7: Concrete answer to "why hybrid for Scrutinise?"

Now putting it all together for your specific case:

**Lex is the primary user of search**, not end-users. Lex makes multiple queries per analytical task, combines results, reasons about relevance. The complexity of hybrid search is well within Lex's tolerance.

**Legal content has both exact-phrase needs and conceptual needs.** Sometimes Lex needs the exact wording of section 5 of the Data Protection Act 2018 (FTS). Sometimes Lex needs to find conceptually similar provisions across multiple Acts (vector). Hybrid handles both.

**You'll add Hansard, committees, Erskine May, codes.** Cross-corpus semantic search is what makes Lex's analytical mode possible — finding related debates and procedural context for a given legislation section. This is impossible with FTS alone.

**Cost is manageable.** Embedding the corpus once: ~$40. Per-query embedding: ~$0.0001. Even at 10,000 queries/day that's $1/day. Negligible at your scale.

**Postgres native + pgvector keeps infrastructure simple.** No Elasticsearch, no Pinecone, no separate search service. Everything lives in Railway. Same backup, same observability, same access control.

**You're not optimising for theoretical future scale.** 650k sections is well within Postgres FTS + pgvector range. Elasticsearch becomes necessary at 10-100M documents — when case law goes in and you grow further, you might revisit. For now, simpler infrastructure is better.

This is genuinely the right architecture for Scrutinise. Not over-engineered, not under-engineered. Capable of growing with you for years.

---

## Optional further reading

If you want to go deeper:

- **"Introduction to Information Retrieval"** by Manning, Raghavan, Schütze — free textbook, foundational concepts of search
- **Postgres FTS docs** — concise, accurate, well-organised — https://www.postgresql.org/docs/current/textsearch.html
- **pgvector readme** — practical guide to vector storage in Postgres — https://github.com/pgvector/pgvector
- **"Pretrained Transformers for Text Ranking: BERT and Beyond"** — for the embedding model side, academic but readable
- **Cohere blog on RAG** — practical patterns for retrieval-augmented generation — https://cohere.com/blog

You don't need any of these to direct the work. CC handles implementation. But if you want to feel comfortable with the concepts at architecture review time, the Postgres FTS docs are the highest-value 30 minutes you could spend.
