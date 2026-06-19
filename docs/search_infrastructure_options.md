# Search Infrastructure — Options for Case Law Scale

**To review and decide on an option after the ingestion of the regional, tax and codes corpus and after the Lex issues are dealt with and Lex’s integration with the corpus is fully working.**

**Context:** Scrutinise currently runs FTS on Railway Hobby tier (5 GB hard limit). At \~750,000 non-case-law rows we will approach that limit before case law ingest begins. Case law (BAILII) is estimated at 500,000–600,000 judgments, broken into paragraphs/passages for FTS = 5–10 million rows. This document captures the three options for review before case law ingest is scoped.

**Decision trigger:** Review this before starting the BAILII scraper sprint.

***

## Option 1 — Railway Pro Tier

Upgrade the existing Railway PostgreSQL instance from Hobby (5 GB) to Pro (100 GB, \~\$20/month).

**Pros**

-   Zero migration effort — no data movement, no connection string changes, no code changes
-   Keeps the entire stack on one provider (simpler ops, one bill, one support relationship)
-   100 GB is sufficient for full non-case-law corpus + several years of case law growth at current density estimates
-   Retains all existing Prisma schema, FTS queries, and pgvector work without modification
-   Reversible — can migrate away later if needed; staying on Postgres throughout makes that easier

**Cons**

-   \$20/month is a recurring cost increase; fine at current scale but not cost-optimised for search workloads
-   Still a single Postgres instance — search and application DB are coupled; a slow FTS query can affect application response times
-   Does not solve the architectural coupling problem; just buys time
-   If case law grows beyond estimates (10M+ rows, large judgment text), 100 GB may not be sufficient long-term
-   Postgres GIN indexes are not the most performant option at very high row counts compared to purpose-built search engines

**Best if:** You want to keep moving fast on ingest without an infrastructure migration, and \$20/month is acceptable.

***

## Option 2 — Separate Postgres Instance with pgvector (Neon or Supabase)

Move the search index (FTS tsvector + pgvector embeddings) to a dedicated Postgres instance on Neon (serverless Postgres) or Supabase, leaving Railway as the application DB only.

**Pros**

-   Decouples search load from application DB — slow search queries no longer affect idea creation, Lex responses, or user-facing features
-   Neon free tier is generous (10 GB, autoscaling, branching for test environments); Supabase free tier is 500 MB but paid plans are reasonable
-   Stays on Postgres — same query language, same Prisma adapter pattern, same FTS and pgvector syntax; migration is a schema copy + data move, not a rewrite
-   Neon's autoscale-to-zero is cost-efficient for a search index that has bursty rather than constant load
-   Natural separation of concerns: Railway = users/ideas/feedback; Neon/Supabase = legislation/case law search index
-   pgvector is first-class on both platforms — vector search (for V.4-FTS-2 semantic layer) stays on the same instance as FTS

**Cons**

-   Requires a migration: copy LegislationSection, LegislationItem, OperationalSection rows to the new instance; update connection strings; test
-   Two DB connections to manage in the codebase (application DB + search DB) — adds some complexity to Prisma client setup
-   Data sync: any legislation metadata updates need to propagate to both DBs (manageable if the search DB is treated as a read-optimised replica of legislation data)
-   Neon free tier has compute limits — sustained heavy ingest may need a paid plan (\$19/month baseline)
-   Not zero-migration effort — probably 1–2 CC sprints to execute cleanly

**Best if:** You want the right architecture for the long term and are willing to spend 1–2 sprints on infrastructure before case law ingest begins.

***

## Option 3 — Purpose-Built Search Service (Typesense or Meilisearch)

Replace Postgres FTS entirely with a dedicated search engine. Typesense and Meilisearch are the two leading open-source options; both have managed cloud offerings.

**Pros**

-   Dramatically faster full-text search at high document counts — purpose-built for this workload
-   Typo tolerance, relevance tuning, faceting, and filtering are first-class features (Postgres FTS has none of these natively)
-   Typesense Cloud and Meilisearch Cloud have generous free/starter tiers
-   Scales to tens of millions of documents without the row-count/index-size constraints of Postgres
-   Could significantly improve Lex search result quality (better ranking, synonym handling, partial matches)

**Cons**

-   **Breaking architectural change** — the current FTS layer is tightly integrated with Postgres (tsvector column, GIN index, ts_rank queries in `lib/search.ts`). Replacing it means rewriting the search query path, the ingest indexing step, and the Lex retrieval logic
-   **pgvector is gone** — vector search (V.4-FTS-2, semantic embeddings) would need to live elsewhere or on a separate Postgres instance anyway, reintroducing the two-DB problem
-   No Prisma integration — Typesense and Meilisearch have their own client SDKs; you'd maintain two data clients
-   Operational overhead: another service to monitor, another API key, another failure mode
-   Hybrid FTS + vector search (planned for V.4-FTS-3) is harder to implement across two different systems
-   Typesense and Meilisearch do not support pgvector — the vector layer would still need Postgres, so you may end up with three data stores (Railway app DB + search engine + vector DB)

**Best if:** Search quality and performance are the primary concern and you are willing to invest in a significant architectural rewrite. Not recommended as the next step given the pgvector roadmap.

***

## Recommendation (for review at decision point)

**Option 2 (Neon/Supabase) is the recommended path** when case law ingest is being scoped.

Reasoning:

-   Option 1 (Railway Pro) is the right *interim* move if case law ingest needs to start before infrastructure work is done — upgrade Railway, buy 100 GB of headroom, then migrate properly.
-   Option 3 is architecturally attractive for search quality but conflicts with the pgvector roadmap (V.4-FTS-2 semantic layer) and requires a larger rewrite than the value justifies at current scale.
-   Option 2 keeps the stack on Postgres (no query language change, Prisma stays), decouples search load, and is compatible with pgvector. The migration cost is one focused sprint.

**Suggested sequence:**

1.  Complete current law corpus (legislation + HMRC + codes) on Railway Hobby — monitor DB size
2.  If Railway approaches 4 GB before case law sprint: upgrade to Railway Pro (Option 1, interim)
3.  Before BAILII scraper sprint begins: execute Option 2 migration (search index → Neon/Supabase)
4.  Case law ingest writes to Neon/Supabase search DB; Railway remains application DB only

***

*Written: 24 May 2026. Review before BAILII scraper sprint is scoped.*
