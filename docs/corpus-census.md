# Corpus Census — 3 Jun 2026

Generated from: Neon DB (legacy pipeline), Railway corpus_sections (new pipeline), live API calls.
TNA Atom feeds (legislation.gov.uk) were unresponsive during this census run; Neon LegislationItem counts used as proxy.

---

## 1. Neon Legacy Pipeline — LegislationItem & LegislationSection

### 1a. Items by type (LegislationItem)

| Type | Items |
|------|-------|
| UKSI | 60,170 |
| EUR (EU retained) | 24,488 |
| EUDN (EU decisions) | 13,173 |
| UKPGA | 11,768 |
| NISR | 9,316 |
| SSI | 8,678 |
| WSI | 4,645 |
| EUDR | 2,035 |
| NISI | 558 |
| ASP | 395 |
| NIA | 232 |
| ANAW | 44 |
| ASC | 29 |
| **Total** | **135,531** |

### 1b. Sections compiled (LegislationSection)

| Type | Sections | Avg/doc |
|------|----------|---------|
| UKSI | 473,828 | 8 |
| UKPGA | 171,346 | 39 (of docs with sections) |
| EUR | 75,658 | 3 |
| SSI | 44,943 | 5 |
| NISR | 42,477 | 5 |
| EUDN | 40,376 | 3 |
| WSI | 25,404 | 5 |
| EUDR | 17,278 | 8 |
| NISI | 12,026 | 22 |
| ASP | 6,678 | 17 |
| NIA | 3,114 | 13 |
| ANAW | 734 | 17 |
| ASC | 412 | 14 |
| **Total** | **914,274** | |

### 1c. Coverage gaps (items with zero sections)

| Type | Zero-section items | Total items | % complete |
|------|--------------------|-------------|-----------|
| UKPGA | **7,427** | 11,768 | 37% |
| UKSI | 207 | 60,170 | 99.7% |
| EUDN | 100 | 13,173 | 99.2% |
| WSI | 3 | 4,645 | ~100% |

**Critical finding:** 7,427 UKPGA (Primary Acts) have zero sections in Neon — 63% of all UKPGA items.
These are the unsupported/failed items from the original ingest, not newly published acts.
At avg 39 sections/doc, this represents ~290,000 uncompiled UKPGA sections in Neon alone.
These are NOT in the new pipeline queue (queue starts at 1963; many of the 7,427 are pre-1963 or
were failed ingest items).

---

## 2. New Pipeline (Railway corpus_sections)

### 2a. Sections by corpus

| Corpus | Sections | Distinct docs | Avg sections/doc | Date range compiled |
|--------|----------|---------------|------------------|---------------------|
| si-pre-2010 | 174,507 | 30,898 | 5.6 | 29 May – 2 Jun 2026 |
| regional | 92,681 | 6,152 | 15.1 | 1 Jun – 2 Jun 2026 |
| primary-acts-2000plus | 90,860 | 540 | 168 | 29 May – 2 Jun 2026 |
| tna-caselaw | 74,730 | 74,730 | 1 | 2 Jun 2026 |
| primary-acts-pre-2000 | 62,664 | 737 | 85 | 29 May – 2 Jun 2026 |
| si-2010plus | 59,951 | 5,866 | 10.2 | 29 May – 3 Jun 2026 |
| retained-eu | 14,390 | 3,390 | 4.2 | 1 Jun – 2 Jun 2026 |
| hmrc-codes-guidance | 13,425 | 13,425 | 1 | 1 Jun – 2 Jun 2026 |
| hmrc-tiins | 791 | 791 | 1 | 3 Jun 2026 |
| ots-reports | 497 | 497 | 1 | 3 Jun 2026 |
| oecd | 462 | 462 | 1 | 2 Jun 2026 |
| scotlawcom | 350 | 350 | 1 | 3 Jun 2026 |
| written-answers | 141 | 141 | 1 | 3 Jun 2026 |
| written-statements | 127 | 127 | 1 | 3 Jun 2026 |
| **Total** | **585,576** | **137,959** | | |

Note: tna-caselaw, hmrc-codes-guidance, hmrc-tiins, ots-reports, oecd, scotlawcom, written-answers, written-statements
appear to store 1 section per document (full text as a single section rather than split by section number).

### 2b. Queue coverage — SI years

SI-pre-2010 (uksi corpus): **1948–2009, continuous coverage, no year gaps.**
~430 SIs/year average. Queue comprehensive.

SI-2010plus (uksi corpus):
| Period | Queue rows | Coverage assessment |
|--------|-----------|---------------------|
| 2010–2014 | 3,044 done | Comprehensive (~600+/year) |
| 2015 | 324 done | **GAP** — TNA UKSI 2015 has ~1,000+ |
| 2016 | 200 done | **GAP** — TNA UKSI 2016 has ~1,200+ |
| 2017 | 232 done | **GAP** — typical year has 800–1,200 UKSI |
| 2018–2020 | ~780 done | **GAP** — Brexit SIs alone = 1,000+/year |
| 2021–2026 | ~1,266 done | **GAP** — 200–300/year but TNA has 500–700 |

**Conclusion:** SI-2010plus queue is INCOMPLETE for 2015–2026. An estimated 5,000–8,000 SIs
are missing from the queue, representing ~50,000–80,000 sections. Action: reseed si-2010plus
queue for 2015–2026 with a full year-by-year crawl.

### 2c. Queue coverage — Primary Acts years

Primary acts: 1963–2026, seeded at ~20 per year. Starts at ukpga/1963/40 — pre-1963 acts
not seeded (these are in Neon but 7,427 items have 0 sections).

20 rows per year is approximately correct for recent years (~15–25 UKPGA per year on TNA).
Risk: years with >20 acts (some years have 22–26) may be missing the highest chapter numbers.

---

## 3. TNA API Counts (Part 3)

TNA legislation.gov.uk Atom feeds were unresponsive (timeouts) during this census run.
Neon LegislationItem counts used as authoritative proxy for TNA totals.

| Type | Neon items (proxy for TNA total) | Note |
|------|----------------------------------|------|
| UKPGA | ~12,000 est. (11,768 in Neon + ~300 added since ingest) | Acts ~15–25/year |
| UKSI (all) | ~65,000 est. (60,170 Neon + ~5k post-ingest) | Including 2015–2026 gap |
| SSI | ~9,000 est. (8,678 Neon) | |
| NISR | ~10,000 est. (9,316 Neon) | |
| WSI | ~5,000 est. (4,645 Neon) | |
| EUR+EUDN+EUDR | ~40,000 est. retained EU | |

Action: retry TNA API census from Charlie's terminal (not CC sandbox) where legislation.gov.uk may be more responsive. Use `scripts/ingest/census/tna-counts.ts`.

---

## 4. Non-Legislation Source Counts (Part 4)

| Source | API Total | Est sections | Compiled (new pipeline) | Gap | Note |
|--------|-----------|-------------|------------------------|-----|------|
| TNA Find Case Law | **374,450** | 374,450 | 74,730 | 299,720 | API confirmed via Atom last-page |
| Written Answers (PQs) | **537,593** | 537,593 | 141 | 537,452 | Sum 2000–2025 from Parliament API |
| Written Statements | **17,487** | 17,487 | 127 | 17,360 | Parliament API confirmed |
| ECHR HUDOC (UK) | ~30,050 est. | 30,050 | 0 | 30,050 | API blocked — 601 queue rows × 50 = est. |
| Hansard Commons | n/a (API blocked) | est. 2,000,000+ | 0 | 2,000,000+ | 2,772 monthly queue chunks done |
| Hansard Lords | n/a (API blocked) | est. 500,000 | 0 | 500,000+ | 2,772 monthly queue chunks done |
| FCA Handbook | 36 sourcebooks | est. 150,000 | 0 | ~150,000 | Full scrape needed for exact count |
| HMRC Guidance | n/a | est. 640,000 | 13,425 | ~627,000 | HMRC web total hard to query |
| OECD (free tier) | n/a | ~462 est. | 462 | 0 | Appears complete |
| OTS Reports | n/a | ~500 est. | 497 | ~3 | Appears complete |
| Scottish Law Commission | n/a | ~350 est. | 350 | 0 | Complete |

---

## 5. Queue Gap Analysis (Part 5)

### SI queue coverage
- **1948–2009:** Comprehensive. No year gaps. ~31,000 queue rows across 62 years.
- **2010–2014:** Comprehensive. ~600+/year, matches expected TNA totals.
- **2015–2026:** **INCOMPLETE.** Only 200–324 rows/year seeded. TNA has 500–1,200+/year.
  - Estimated missing: ~5,000–8,000 documents
  - Action: Re-seed si-2010plus for 2015–2026 using `listTnaLegislation('uksi', year)` per year

### Primary act queue coverage
- **Pre-1963:** Not seeded at all. Covered partially in Neon (with many 0-section gaps).
- **1963–2026:** Seeded at 20 rows/year. Likely complete for most years (15–25 acts/year).
- **Risk:** Acts numbered >20 in a given year are not seeded. Rare but possible.
  - Action: For 2000+ acts, verify ukpga/{year}/21 and above exist before declaring complete.

### Corpora with 0 corpus_sections despite done queue rows
| Corpus | Done queue rows | corpus_sections | Action |
|--------|----------------|-----------------|--------|
| hansard-commons-a/b | 2,772 | 0 | Hansard R2 backfill sprint |
| hansard-lords-a/b | 2,772 | 0 | Hansard R2 backfill sprint |
| echr-hudoc | 601 | 0 | ECHR R2 backfill sprint |
| fca-regulators | 37 | 0 | FCA R2 backfill sprint |
| uk-treaties | 2 | 0 | Small — investigate R2 keys |

---

## 6. Updated CORPUS_MANIFEST estSections

| Label | Old estimate | New estimate | Basis |
|-------|-------------|-------------|-------|
| Primary Acts 2000+ | 100,000 | **100,000** | ~540 acts × avg 168 = 90,860 compiled; allow for unseeded high-chapter acts |
| Primary Acts pre-2000 | 80,000 | **70,000** | 737 docs × avg 85 = 62,664 compiled; comprehensive 1963–1999 |
| Statutory Instruments 2010+ | 300,000 | **120,000** | compiled 59,951; gap ~5,000–8,000 missing docs × avg 10 = +60k |
| Statutory Instruments pre-2010 | 300,000 | **180,000** | compiled 174,507 from ~31k docs; ~5% buffer |
| Regional (Scot/Wales/NI) | 160,000 | **160,000** | compiled 92,681; Neon shows 116k total; gap being closed |
| Retained EU Law | 80,000 | **140,000** | Neon EUR+EUDN+EUDR = 133,312; new pipeline at 14,390 |
| TNA Find Case Law | 374,250 | **374,450** | API confirmed 374,450 (7,489 pages × 50) |
| Hansard Commons | 2,000,000 | **2,000,000** | no API data; keep |
| Hansard Lords | 500,000 | **500,000** | no API data; keep |
| Committee Reports | 100,000 | **100,000** | no data; keep |
| Written Answers (PQs) | 500,000 | **537,593** | Parliament API confirmed |
| Written Ministerial Statements | 50,000 | **17,487** | Parliament API confirmed |
| FCA Handbook | 150,000 | **150,000** | no improvement on estimate |
| HMRC + Guidance | 640,000 | **640,000** | no API data |
| HMRC TIINs | 2,000 | **800** | compiled 791; appears complete |
| Scottish Law Commission | 500 | **350** | compiled 350; appears complete |
| OTS Reports | 200 | **500** | compiled 497 → was underestimated |
| OECD (free tier) | 10,000 | **500** | compiled 462; appears complete for free tier |
| ECHR / HUDOC | 30,000 | **30,050** | 601 queue rows × 50 judgments/page |

---

## 7. Headline Figures

**Total confirmed corpus size (sections):**
- Neon legacy: 914,274
- New pipeline: 585,576
- Combined (with overlap for same legislation): ~1,200,000–1,400,000 unique sections (estimate)
- Note: Neon and new pipeline cover overlapping legislation. True dedup requires cross-referencing.

**Revised total corpus estimate (true denominator):**
| Category | Est total sections |
|----------|--------------------|
| UK Primary Acts (UKPGA, all years) | ~460,000 |
| Statutory Instruments (all) | ~300,000 |
| Devolved legislation (SSI/NISR/WSI/NIA/ANAW/ASP) | ~170,000 |
| Retained EU Law | ~140,000 |
| TNA Case Law | 374,450 |
| Hansard (Commons + Lords) | ~2,500,000 |
| Written Answers + Statements | ~555,000 |
| FCA + HMRC + Regulators | ~790,000 |
| ECHR + OECD + Other | ~32,000 |
| **Grand total** | **~5,300,000** |

**Current % complete (new pipeline only):** 585,576 / 5,300,000 = **~11%**

**Current rate:** ~1–5 sections/hour (trickle mode — initial backlog exhausted).
With SI 2015–2026 reseed (~50–80k sections): could add several weeks of work at full throughput.
With Hansard backfill (~2M sections in R2 already): major acceleration possible.

**Year gaps requiring action:**
1. SI 2015–2026: ~5,000–8,000 documents not seeded — reseed required
2. UKPGA pre-1963: 7,427 Neon items with 0 sections — new pipeline doesn't cover pre-1963
3. Hansard/ECHR/FCA in R2 (backfill sprint planned)
