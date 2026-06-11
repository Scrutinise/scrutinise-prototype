# SEARCH-READINESS AUDIT — Search Project, Sprint S0

*Measured 12 June 2026 against Neon (production search DB), Cloudflare R2 (`scrutinise-legislation`), and Railway Postgres (web-app DB). Read-only audit; the only write was the `scratch_fts_sample` experiment table (§4), dropped and verified gone (§8). Live ingest (retained-eu, et-decisions) was running throughout — row counts are a moving snapshot, taken 12 Jun.*

**This document contains measurements only. No architecture recommendations — that is the design doc's job.**

---

## §1 — Schema inventory (Neon)

### 1.1 The brief's "legacy sections table" is `LegislationSection`

There is **no table named `sections`** on Neon. The legacy 914,274-row table is `"LegislationSection"` (exact count 914,274, matching the brief). A companion `"OperationalSection"` exists with **0 rows on Neon** (the populated copy — 61,315 rows — lives on Railway; see §6).

### 1.2 `corpus_sections` — columns and population

9,846,300 rows at audit time (exact count, 12 Jun). Population rates from a ~1% block sample (TABLESAMPLE SYSTEM, n=97,568):

| # | column | type | populated | note |
|---|--------|------|-----------|------|
| 1 | id | text PK | 100% | |
| 2 | corpus | text NOT NULL | 100% | |
| 3 | sourceUrl | text | 100.0% | |
| 4 | r2Key | text | 99.4% | pointer to compiled text in R2 |
| 5 | r2RawKey | text | 6.3% | raw CLML XML pointer (legislation corpora) |
| 6 | compiledAt | timestamptz | 94.1% | |
| 7 | wordCount | integer | 99.4% | |
| 8 | status | text NOT NULL | 100% | |
| 9 | errorMsg | text | 0.4% | |
| 10 | format | text | 7.9% | |
| 11 | xmlPreview | text | ~0% (1 row in sample) | avg 200 chars |
| 12 | notes | text | ~0% (5 rows in sample) | |
| 14 | createdAt | timestamptz NOT NULL | 100% | (ordinal 13 is a dropped column — `compiledText`, removed V3) |
| 15 | **ftsVector** | **tsvector** | **6.8%** | see 1.4 |
| 16 | availability_status | text NOT NULL | 100% (0.6% ≠ 'full') | |
| 17 | availability_note | text | ~0.6% | |
| 18 | sectionTitle | text | 90.7% | |
| 19 | speaker | text | 81.4% | pwdata corpora |
| 20 | itemDate | date | 90.8% | |
| 21 | parentDocId | text | 91.0% | |

### 1.3 `LegislationSection` (legacy, 914,274 rows) — columns and population (exact counts)

| column | type | populated | note |
|--------|------|-----------|------|
| id | text PK | 914,274 (100%) | |
| legislationItemId | text NOT NULL | 100% | FK → LegislationItem (135,531 rows) |
| sectionNumber | text NOT NULL | 100% | |
| sectionTitle | text | 778,368 (85.1%) | |
| sourceType | enum | 100% | |
| **originalText** | **text** | **914,274 (100%)** | avg 940 chars; **sum 859,660,268 chars ≈ 0.86 GB of text held in Postgres** |
| originalXmlKey | text | 536,143 (58.6%) | |
| tnaXmlKey | text | 487,526 (53.3%) | |
| compiledTextKey | text | 24,579 (2.7%) | |
| lexSummaryKey | text | 1,142 (0.1%) | |
| **ftsVector** | **tsvector** | **914,274 (100%)** | maintained by live trigger (1.4) |
| confidence | enum | 26,126 (2.9%) | |
| compilationVersion…needsReview | various | n/a | compile-pipeline metadata |
| tags / unappliedAmendments | text[] / jsonb | 5,635 (0.6%) each | |
| policyArea | text | 0 (0%) | |
| **embedding** | **vector(768)** | **0 (0%)** | pgvector column exists, never populated |

### 1.4 tsvector machinery — what exists and whether it runs

| table | tsvector col | GIN index | trigger | state |
|-------|-------------|-----------|---------|-------|
| LegislationSection | ftsVector | `LegislationSection_ftsVector_idx`, **153 MB** | `trg_legislation_section_fts` → `setweight(to_tsvector('legislation_english', sectionTitle),'A') \|\| setweight(…originalText…,'B')` | **LIVE** — 100% populated |
| OperationalSection | ftsVector | 16 kB (0 rows) | `trg_operational_section_fts` (pageTitle + extractedText) | live but table empty on Neon |
| corpus_sections | ftsVector | `corpus_sections_fts`, **266 MB** | `corpus_sections_fts_trigger` → `corpus_sections_fts_update()` | **NO-OP** — function body is just `RETURN NEW` |

History of the corpus_sections no-op: migration `20260602090000_ingest_queue_fts` created a real trigger over a `compiledText` column; V3 (`scripts/ingest/drop-compiled-text-col.ts`) dropped `compiledText` and rewrote the function to `RETURN NEW`. The ~6.8% of rows with populated `ftsVector` (~670k rows) are pre-V3 relics; **every row ingested since early June 2026 has NULL ftsVector**. The 266 MB GIN index is indexing those relics plus NULLs.

### 1.5 Indexes (name, type, size)

**corpus_sections** (total indexes 1,639 MB):

| index | type | size |
|-------|------|------|
| corpus_sections_pkey (id) | btree | 886 MB |
| corpus_sections_fts (ftsVector) | GIN | 266 MB |
| idx_corpus_sections_parent (parentDocId, partial) | btree | 113 MB |
| corpus_sections_status_idx | btree | 77 MB |
| corpus_sections_notes_idx | btree | 75 MB |
| corpus_sections_corpus_idx | btree | 73 MB |
| corpus_sections_format_idx | btree | 71 MB |
| idx_corpus_sections_availability (partial) | btree | 688 kB |

**LegislationSection** (total indexes 325 MB):

| index | type | size |
|-------|------|------|
| LegislationSection_ftsVector_idx | GIN | 153 MB |
| LegislationSection_legislationItemId_sectionNumber_key | btree | 70 MB |
| LegislationSection_pkey | btree | 52 MB |
| LegislationSection_legislationItemId_idx | btree | 18 MB |
| LegislationSection_needsReview_idx / _compilationStatus_idx | btree | 8.8 MB each |

### 1.6 Extensions

| extension | available version | installed | note |
|-----------|-------------------|-----------|------|
| **vector** (pgvector) | 0.8.0 | **YES — 0.8.0** | `halfvec` available (added in 0.7.0). `vector(768)` column already exists on LegislationSection |
| pg_trgm | 1.6 | no | |
| **pg_search** (ParadeDB BM25) | 0.15.26 | no | available on this Neon plan |
| rum | 1.3 | no | |
| unaccent | 1.1 | no | |

Text-search configs: `legislation_english` exists (plain copy of `english` — Neon can't load the `.ths` thesaurus file; synonym expansion is application-layer per project CLAUDE.md §15).

---

## §2 — Storage and compute baseline

### 2.1 Neon database size

**Total: 9,945,882,624 bytes = 9,485 MB ≈ 9.26 GiB.** Working budget is 20 GB (`DB_LIMIT_GB = 20` in `progress-reporter.ts`; Neon-side `neon.max_cluster_size` reads 16,777,216 MB = 16 TiB, i.e. no hard server-side cap near our scale — the 20 GB is a billing/ops budget, not a wall).

**Free headroom under the 20 GB budget: ≈ 10.5 GB.**

Per-table breakdown (tables ≥ 1 MB; everything else is web-app tables at kB scale):

| table | rows | heap | indexes | TOAST | total |
|-------|------:|-----:|--------:|------:|------:|
| corpus_sections | 9,846,300 | 3,994 MB | 1,563 MB | 1,923 MB | **7,480 MB** |
| LegislationSection | 914,274 | 983 MB | 310 MB | 419 MB | **1,712 MB** |
| ingest_queue | ~442,686 | 146 MB | 70 MB | — | 216 MB |
| LegislationItem | 135,531 | 46 MB | 16 MB | — | 61 MB |
| specialist_queue | 18,453 | — | — | — | 4.8 MB |

### 2.2 Neon compute config

No Neon API key is available locally — **autoscaling CU range needs Charlie to read from the Neon console.** Server-side signals measured directly:

- PostgreSQL 17.10 on aarch64 (Neon build)
- `shared_buffers` = 233 MB, `effective_cache_size` = 25.6 GB (Neon sets this to the local-file-cache ceiling — implies a substantial max autoscale size), `work_mem` = 4 MB, `maintenance_work_mem` = 64 MB, `max_connections` = 901

### 2.3 Row counts per corpus (full-table GROUP BY, exact, 12 Jun)

| corpus | rows | avg words | sum words |
|--------|-----:|----------:|----------:|
| pwdata-debates | 6,381,729 | 159 | 1,010,941,249 |
| pwdata-wrans | 1,222,199 | 147 | 178,969,974 |
| pwdata-lords | 749,793 | 281 | 210,229,793 |
| pwdata-westminster | 238,448 | 350 | 83,111,275 |
| si-pre-2010 | 174,553 | 184 | 32,064,295 |
| pwdata-lordswrans | 173,975 | 157 | 27,275,911 |
| regional | 127,139 | 165 | 20,360,105 |
| primary-acts-2000plus | 90,901 | 150 | 13,619,708 |
| eur-lex | 90,260 | 1,766 | 159,379,976 |
| hmrc-manuals | 85,197 | 301 | 20,775,736 |
| et-decisions | 81,020 (growing) | 940 | 76,187,328 |
| tna-caselaw | 74,896 | 9,089 | 680,711,377 |
| primary-acts-pre-2000 | 70,714 | 220 | 15,351,913 |
| lda-commonsoralquestions | 69,529 | 29 | 2,004,846 |
| si-2010plus | 63,399 | 167 | 10,232,904 |
| retained-eu | 44,030 (growing) | 164 | 4,154,778 |
| pwdata-wms | 24,775 | 427 | 10,118,603 |
| pwdata-lordswms | 21,260 | 453 | 9,390,846 |
| lda-lordswrittenquestions | 20,500 | 52 | 1,072,407 |
| hmrc-codes-guidance | 14,067 | 834 | 11,735,393 |
| lda-commonswrittenquestions | 8,000 | 50 | 402,315 |
| lda-commonsdivisions | 5,553 | 16 | 90,527 |
| fca-handbook | 3,661 | 823 | 3,014,148 |
| uk-treaties | 2,832 | 11,086 | 31,240,058 |
| lda-lordsdivisions | 2,089 | 8 | 17,753 |
| college-of-policing | 1,944 | 923 | 1,795,090 |
| building-regs / hmrc-tiins / planning-policy | 791 each | 184 | 145,223 each |
| oecd | 505 | 659 | 332,565 |
| ots-reports | 497 | 744 | 369,741 |
| hmrc-ancillary | 464 | 2,189 | 1,000,278 |
| scotlawcom | 350 | 45,113 | 15,789,375 |
| tax-treaties-dta | 324 | 3,246 | 1,051,642 |
| sentencing-council | 253 | 5,914 | 1,496,124 |
| govuk-core-docs | 176 | 17,477 | 3,058,430 |
| written-answers | 143 | 305,936 | 43,748,825 |
| written-statements | 129 | 6,610 | 852,742 |
| nilawcom | 17 | 48,909 | 831,445 |
| **TOTAL** | **9,846,300** | | **≈ 2.67 billion words** |

Queue context at audit time: 230,147 pending / 12 claimed / 209,950 done / 2,538 failed / 39 skipped — retained-eu (~153k universe) and et-decisions (~125k) still draining, so the full corpus will land near the brief's 10.5M figure.

---

## §3 — Corpus weight sampling (R2)

**Method:** 507 sections sampled, stratified across 24 corpora (weighted toward the big ones), candidate keys drawn from a 0.5% TABLESAMPLE of corpus_sections (n=50,064 candidates), object sizes read with R2 HEAD (`ContentLength` — exact bytes, no egress). Three small corpora (uk-treaties, fca-handbook, written-answers) sampled directly (`ORDER BY random() LIMIT 8` per corpus).

### 3.1 Compiled-text bytes per section, by corpus

| corpus | n | avg B | median B | p95 B | extrapolated GB (rows × avg) |
|--------|--:|------:|---------:|------:|------:|
| pwdata-debates | 80 | 975 | 324 | 5,106 | **6.22** |
| pwdata-wrans | 40 | 745 | 533 | 1,827 | 0.91 |
| pwdata-lords | 25 | 2,135 | 465 | 10,866 | 1.60 |
| pwdata-westminster | 15 | 1,321 | 640 | 7,825 | 0.31 |
| pwdata-lordswrans | 15 | 1,266 | 1,167 | 4,668 | 0.22 |
| pwdata-wms | 8 | 1,554 | 1,929 | 3,111 | 0.04 |
| pwdata-lordswms | 8 | 2,511 | 2,392 | 5,153 | 0.05 |
| si-pre-2010 | 40 | 1,323 | 592 | 6,643 | 0.23 |
| si-2010plus | 25 | 1,338 | 682 | 4,705 | 0.08 |
| primary-acts-2000plus | 30 | 813 | 622 | 3,286 | 0.07 |
| primary-acts-pre-2000 | 25 | 524 | 247 | 1,529 | 0.04 |
| regional | 20 | 832 | 337 | 6,600 | 0.10 |
| retained-eu | 15 | 868 | 73 | 8,680 | 0.02 (at current 25k fetched; ~0.13 at ~153k) |
| hmrc-manuals | 30 | 1,388 | 1,121 | 3,160 | 0.10 |
| hmrc-codes-guidance | 10 | 2,206 | 2,352 | 4,294 | 0.03 |
| **tna-caselaw** | 40 | **75,128** | 50,758 | 190,499 | **5.63** |
| et-decisions | 20 | 3,474 | 677 | 27,437 | 0.28 (at 81k; ~0.7 at ~206k drained) |
| eur-lex | 20 | 7,451 | 4,435 | 31,677 | 0.67 |
| lda-commonsoralquestions | 10 | 189 | 198 | 244 | 0.01 |
| uk-treaties | 8 | 86,257 | 13,789 | 588,803 | 0.24 |
| fca-handbook | 8 | 2,554 | 1,363 | 7,400 | 0.01 |
| written-answers | 8 | 1,765,532 | 2,386,495 | 2,431,389 | 0.25 |
| college-of-policing | 2 | 16,636 | 26,720 | 26,720 | 0.03 |
| scotlawcom | 5 | 485,251 | 407,374 | 921,870 | 0.17 |
| remaining 15 small corpora | — | (derived from word counts × 6.1 B/word) | | | 0.07 |

### 3.2 Total

**Estimated full-corpus compiled-text volume: ≈ 17.4 GB** (sum of rows × sample-avg per corpus).

Arithmetic: dominated by pwdata-debates (6,377,736 rows × 975 B = 6.22 GB) and tna-caselaw (74,896 × 75,128 B = 5.63 GB); all other corpora sum to ≈ 5.5 GB.

**Cross-check (independent method):** full-table `SUM(wordCount)` = 2.67B words; measured bytes-per-word across sampled corpora clusters tightly at **5.0–6.7 B/word** (median ≈ 6.1). 2.67B × 6.1 = **16.3 GB** — agrees with the 17.4 GB sample-avg method within ~7%. Skew note: distributions are heavily right-skewed (debates median 324 B vs avg 975 B), so corpus avg is sensitive to sample tails; the word-count cross-check is the steadier anchor.

At full drain (retained-eu ~153k + et-decisions ~206k): add roughly +0.5 GB → **~18 GB total text**.

---

## §4 — FTS feasibility experiment (`scratch_fts_sample`)

**Setup:** 99,999 rows (1 of 100,000 lost to a failed R2 fetch). Compiled text fetched from R2, `to_tsvector('english', …)` computed server-side, **only** `(id, corpus, vec tsvector)` stored — text stays in R2, mirroring the likely production pattern. Texts capped at 900 KB (tsvector limit guard — only affects rows from corpora like written-answers; none hit the cap in this sample). Stratification:

| stratum | corpus | rows |
|---------|--------|-----:|
| legislation (50,000) | si-pre-2010 20,000 · primary-acts-2000plus 12,999 · primary-acts-pre-2000 10,000 · si-2010plus 7,000 | 49,999 |
| pwdata speeches (40,000) | pwdata-debates 25,000 · pwdata-wrans 8,000 · pwdata-lords 5,000 · pwdata-westminster 2,000 | 40,000 |
| caselaw (10,000) | tna-caselaw 10,000 | 10,000 |

### 4.1 Measured sizes (99,999 rows; 660 MB of source text)

| component | bytes | pretty |
|-----------|------:|-------:|
| heap | 50,995,200 | 48.6 MB |
| TOAST (large tsvectors, compressed) | 276,054,016 | 263 MB |
| **GIN index on vec** | **58,785,792** | **56.1 MB** |
| pkey (id text) | 8,544,256 | 8.1 MB |
| **table total** | **394,379,264** | **376 MB** |

Per-corpus tsvector cost (avg `pg_column_size(vec)`, i.e. post-compression):

| corpus | avg vec bytes | vs avg text bytes |
|--------|-------------:|------------------:|
| tna-caselaw | 21,898 | 29% of 75,128 |
| pwdata-westminster | 1,671 | — |
| pwdata-lords | 1,463 | 69% of 2,135 |
| pwdata-wrans | 957 | — |
| primary-acts-pre-2000 | 945 | 180% of 524 (floor cost dominates short texts) |
| si-pre-2010 | 891 | 67% of 1,323 |
| pwdata-debates | 784 | 80% of 975 |
| si-2010plus | 759 | — |
| primary-acts-2000plus | 610 | 75% of 813 |

Measured scaling ratios from the sample: heap+TOAST = **1.10×** Σvec (327.0 MB / 297.4 MB); GIN = **0.198×** Σvec (58.8 MB / 297.4 MB); pkey = **85 B/row**.

### 4.2 Extrapolation — the arithmetic

Method: Σvec = Σ(corpus rows × measured avg vec bytes); proxies for unsampled corpora (regional/retained-eu ← si-pre-2010 891 B; eur-lex ← 0.40 × its 7,451 B text = ~3,000 B; et-decisions ← 0.5 × its 3,474 B text ≈ 1,700 B; pwdata-wms/lordswms ≈ 1,500 B; small corpora by text ratio). Then table = 1.10 × Σvec, GIN = 0.198 × Σvec, pkey = 85 B × rows.

**(a) Legislation + caselaw scope** (acts 161,615 + SIs 237,952 + regional 127,139 + retained-eu ~153,000 at drain + eur-lex 90,260 + tna-caselaw 74,896 + et-decisions ~206,000 at drain = **~1.05M rows**; brief's nominal 1.2M):

- Σvec = 2.84 GB → heap+TOAST 3.12 GB + GIN 0.56 GB + pkey 0.09 GB = **≈ 3.8 GB** (≈ 4.3 GB if scaled pro-rata to a nominal 1.2M rows)

**(b) Full corpus ~10.5M rows** (the 1.05M above + pwdata 8.80M + remaining 0.21M = 10.06M now-ish; queue drain takes it to ~10.5M):

- pwdata Σvec = 7.89 GB (debates 6,377,736 × 784 B = 5.00 GB is the single biggest term)
- Full Σvec = 11.03 GB → heap+TOAST 12.13 GB + GIN 2.18 GB + pkey 0.86 GB = **≈ 15.2 GB** (≈ 15.8 GB at 10.5M pro-rata)

Caveat: the GIN ratio (0.198× vec data) was measured on a sample whose vec bytes are 74% caselaw; GIN posting-list compression varies with lexeme distribution, so treat ±30% on the GIN term (±0.7 GB at full scale).

### 4.3 Query latency at 100k rows (floor only — does NOT extrapolate linearly to 10.5M)

Client-measured from Charlie's machine; **network RTT to Neon is 25–26 ms** (measured `SELECT 1` × 5), so server-side time is roughly the figure minus 26 ms. 5 runs each; run 1 = cold-ish (first touch after index build — true cold-storage eviction cannot be forced on Neon), runs 2–5 = warm.

| query | matches in 100k | cold | warm p50 | warm p95 |
|-------|---------------:|-----:|---------:|---------:|
| rare term `sequestration` LIMIT 20 | 89 | 36 ms | 32 ms | 47 ms |
| rare term `aquaculture` LIMIT 20 | 22 | 27 ms | 25 ms | 27 ms |
| common term `tax` LIMIT 20 | 4,998 | 24 ms | 25 ms | 46 ms |
| common term `court` LIMIT 20 | 14,334 | 24 ms | 26 ms | 27 ms |
| phrase `income tax relief` LIMIT 20 | 9 | 57 ms | 35 ms | 38 ms |
| phrase `climate change` LIMIT 20 | 424 | 28 ms | 27 ms | 27 ms |
| `data & protection` LIMIT 20 | 1,326 | 24 ms | 24 ms | 26 ms |
| `environment \| pollution` LIMIT 20 | 3,329 | 27 ms | 24 ms | 32 ms |
| `housing & tenancy` + ts_rank ORDER BY, LIMIT 20 | 760 | 69 ms | 43 ms | 44 ms |
| prefix `employ:*` LIMIT 20 | 8,846 | 26 ms | 24 ms | 26 ms |

Every query is at or near the network floor — server-side cost at 100k rows is ≈ 0–18 ms warm, ≈ 45 ms worst cold (rank-ordered query, which must score all 760 matches). **This is a floor measurement.** At 10.5M rows, posting lists are ~100× longer and rank-ordered queries over common terms (e.g. `tax` would match ~500k rows) must score every match before LIMIT — full-scale latency needs a bigger sample (1M+) if FTS-in-Neon survives the §4.2 size math.

### 4.4 Build time (backfill projection)

Main run measured (86,199 rows, 642.6 MB text, batch 100, single local process, live ingest running concurrently):

| stage | cumulative time | rate |
|-------|----------------:|-----:|
| R2 fetch (concurrency 100/batch) | 483.8 s | 1.33 MB/s, 178 rows/s |
| DB insert incl. server-side `to_tsvector` | 178.0 s | 3.61 MB/s, 484 rows/s |
| wall (pipeline, sequential batches) | 694.8 s | **124 rows/s · 0.92 MB/s** |
| GIN index build (after load, 99,999 rows / 297 MB vec) | 18.5 s | — |

Extrapolation bounds (the truth sits between row-scaled and byte-scaled because the full corpus averages 1.8 KB/row vs the sample's 6.6 KB/row):

| target | by bytes | by rows |
|--------|---------:|--------:|
| 1.05M legislation+caselaw (~8 GB text) | 2.4 h | 2.4 h |
| 10.5M full corpus (~18 GB text) | **5.4 h** | **23.5 h** |
| GIN build, full corpus | 8 min | 32 min |

These are single-process, politeness-gapped figures from one residential connection; R2 fetch dominates and parallelises trivially. GIN build used `maintenance_work_mem = 64 MB` (Neon default here) — a full-scale build will spill more and run closer to the high bound.

---

## §5 — Vector math (no build — paper exercise)

Per-value storage: pgvector `vector(N)` = 4N + 8 bytes; `halfvec(N)` = 2N + 8 bytes. HNSW index assumed ≈ **1.5× vector data** (assumption: m=16, includes graph links; actual ratio varies with m/ef_construction). pgvector 0.8.0 is installed, so halfvec and HNSW-on-halfvec are both available today.

| dims | type | per-row | 1.2M data | 1.2M +HNSW total | 10.5M data | 10.5M +HNSW total |
|-----:|------|--------:|----------:|------------:|-----------:|-------------:|
| 384 | float32 | 1,544 B | 1.73 GiB | **4.31 GiB** | 15.10 GiB | **37.8 GiB** |
| 384 | halfvec | 776 B | 0.87 GiB | **2.17 GiB** | 7.59 GiB | **19.0 GiB** |
| 768 | float32 | 3,080 B | 3.44 GiB | **8.61 GiB** | 30.12 GiB | **75.3 GiB** |
| 768 | halfvec | 1,544 B | 1.73 GiB | **4.31 GiB** | 15.10 GiB | **37.8 GiB** |
| 1024 | float32 | 4,104 B | 4.59 GiB | **11.5 GiB** | 40.13 GiB | **100.3 GiB** |
| 1024 | halfvec | 2,056 B | 2.30 GiB | **5.74 GiB** | 20.11 GiB | **50.3 GiB** |

Arithmetic example (768d float32, 10.5M): (768×4+8) B × 10,500,000 = 32.3 GB data; ×1.5 HNSW = 48.5 GB index; total ≈ 75 GiB. These figures exclude row overhead in the host table (~50–100 B/row extra if vectors live in a dedicated table).

---

## §6 — Existing query paths (scrutinise-web)

Three search endpoints exist; **none touches `corpus_sections`** (the 9.8M-row V17+ corpus appears only in `prisma/schema.prisma` and ingest migrations — zero web reads):

| endpoint | auth | queries | DB | index used | wired to UI? |
|----------|------|---------|----|-----------|--------------|
| `POST /api/search` | yes | `lib/search.ts → searchLegislation()`: LegislationSection (+ LegislationItem join) via `ftsVector @@ to_tsquery/plainto_tsquery`, rank-then-headline CTE, 8s stall-guard | **Neon** (`prismaSearch`) for legislation; **Railway** (`prisma`) for OperationalSection | GIN (both) | **LIVE — Lex grounding**: `app/api/ai/[ideaId]/route.ts` calls it (limit 4, minRank 0.25). No human-facing search UI calls it yet |
| `POST /api/ideas/[id]/legislation-search` | yes | raw SQL: `to_tsvector('english', originalText ⊕ sectionTitle ⊕ policyArea) @@ plainto_tsquery` computed **on the fly** — does NOT use the ftsVector column or any index → sequential scan per query | **Railway** (`prisma`) | none | **LIVE** — CreateIdeaClient calls it; results feed `LegislationPanel` |
| `GET /api/legislation/search` | none | LegislationItem `title contains` (ILIKE), no FTS | Railway | btree at best | Browse page `/legislation` (reachable via breadcrumb links, not in main nav) |

**LegislationPanel state: PRESENT AND LIVE** — `components/LegislationPanel.tsx` is imported and rendered by `app/ideas/create/CreateIdeaClient.tsx` (toggle button + auto-search on Lex triggers). It displays results from the un-indexed Railway path above, then hydrates compiled text per result from R2 (`compiledTextKey` populated for only 2.7% of legacy rows — most results return `compiledText: null`).

**Duplicate legacy data:** LegislationSection exists in full on BOTH databases — Railway (914,274 rows, 100% originalText + ftsVector, in a 2,029 MB DB) and Neon (914,274 rows, same shape, 1,712 MB). `lib/prisma-search.ts` documents the V.4-FTS-3 migration that created the Neon copy; the Railway copy was never retired. `/legislation-compare` is linked in PublicNav (live); OperationalSection search half of `/api/search` runs against Railway's 61,315 rows (Neon's copy is empty).

---

## §7 — Hard blockers (facts only)

1. **Full-corpus FTS-in-Neon exceeds the 20 GB budget.** Projected addition for 10.5M tsvectors + GIN + pkey ≈ **15.2–15.8 GB** (§4.2) against **≈ 10.5 GB free headroom** (§2.1) → DB would land at ≈ 24.5–25.3 GB, **~4.5–5.3 GB over budget**. The pwdata corpora alone account for ≈ 11.0 GB of that projection.
2. **The legislation+caselaw scope fits.** ~1.05M rows project to ≈ 3.8 GB added (≈ 4.3 GB at nominal 1.2M) — within the 10.5 GB headroom with ~6 GB to spare.
3. **corpus_sections has no functioning FTS today.** The trigger is a no-op (`RETURN NEW`) since V3; 93.2% of rows have NULL `ftsVector`; the existing 266 MB GIN index serves no live query path (§1.4, §6). Dropping the relic column contents + index would free ≈ 0.3+ GB.
4. **Full-corpus embeddings do not fit in Neon at any measured configuration.** Cheapest §5 option (384d halfvec, 10.5M rows, HNSW) = 19.0 GiB > 10.5 GB headroom. At the 1.2M scope every option except 1024d float32 fits (§5). The existing `vector(768)` column on LegislationSection has 0 rows populated.
5. **tsvector has a 1 MB hard limit per value.** written-answers rows average 1.77 MB of compiled text (143 rows, day-aggregate files) and cannot be vectorised whole; uk-treaties p95 = 589 KB and scotlawcom median = 407 KB pass but approach it.
6. **No web code reads corpus_sections.** All three live search paths run on the 914k-row legacy tables; the LegislationPanel path computes `to_tsvector` per query with no index (sequential scan on Railway) and its R2 text hydration key (`compiledTextKey`) is populated for only 2.7% of legacy rows.
7. **Latency at 100k rows is network-floor and not load-bearing for the design decision** — server-side ≈ 0–18 ms warm. A 1M+ row sample is required to measure rank-ordered common-term queries at production scale if FTS-in-Neon proceeds (§4.3).

---

## §8 — Acceptance evidence

- **scratch_fts_sample dropped.** `SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname LIKE 'scratch%'` → **0**.
- **No production table modified.** corpus_sections row count: **9,846,300 before** (audit start) → **9,866,543 after** (audit end). The +20,243 delta is live ingest (retained-eu + et-decisions workers draining the queue throughout the audit — 230,147 pending at start); this audit issued only SELECTs against production tables. The only DDL/DML of the session was CREATE/INSERT/DROP on `scratch_fts_sample` and the scratch GIN index, both gone.
- DB size: 9,485 MB at audit start → 9,501 MB after cleanup (delta = live ingest growth; scratch table's 376 MB released back to Neon on drop).
- All §1–§6 values measured directly except: Neon compute CU/autoscaling range (**needs Charlie — Neon console**), and the per-corpus proxy assumptions documented inline in §4.2.
- Scratch scripts ran from a local `tmp-audit/` working folder, deleted at sprint close. Methodology preserved in this document.
