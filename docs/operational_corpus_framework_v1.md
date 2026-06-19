# Operational Corpus Framework v1

*Status: Draft — for CCh review before V.3-C work proceeds.*
*Author: CC, Sprint V.3-A, 2026-05-15*

---

## 1. Purpose

Scrutinise's legislative corpus (legislation.gov.uk statutes and statutory instruments) gives users the formal law. The **operational corpus** fills the space between the statute and practice: guidance documents, handbooks, internal manuals, case law, parliamentary material, and financial documents that explain how the law is applied, enforced, and funded.

This document defines the canonical model, source-quality metadata, scraper interface, rate-limiting policy, provenance flags, and update strategy for all operational corpus sources added from V.3 onwards.

---

## 2. Document Source Taxonomy

The `DocumentSourceType` enum (schema.prisma) classifies every document by its nature as a source. Values:

| Value | Examples | Authority level |
|---|---|---|
| `STATUTE` | UKPGA, UKSI, ASP, NIA, ANAW, NISI, NISR, SSI, WSI | Primary law |
| `STATUTORY_GUIDANCE` | FCA Handbook, PRA Rulebook, Ofsted inspection framework | Sub-primary (statutory force) |
| `ADMINISTRATIVE_GUIDANCE` | HMRC manuals, Civil Service Code, departmental policy papers | Internal / soft law |
| `EXPLANATORY` | Explanatory Notes, Impact Assessments, HoC Library briefings | Secondary / reference |
| `PARLIAMENTARY` | Hansard, Bills in progress, Committee reports | Record of proceedings |
| `JUDICIAL` | BAILII case law | Case law authority |
| `FINANCIAL_DOCUMENT` | Estimates, Spending Reviews, Departmental Annual Reports, PESA | Financial/fiscal record |

The `STATUTE` values are already populated from the legislative corpus ingest. All operational corpus sources use one of the remaining six values.

---

## 3. Canonical Data Model

### OperationalDocument (one per manual / handbook / document collection)

| Field | Type | Purpose |
|---|---|---|
| `id` | UUID | PK |
| `sourceType` | `DocumentSourceType` | Source classification |
| `sourceSlug` | String | Machine identifier (e.g. `employment-income-manual`) |
| `publisherName` | String | Human publisher name (e.g. `HMRC`) |
| `title` | String | Full document title |
| `description` | String? | Summary for UI display |
| `sourceUrl` | String | Canonical URL of the document index |
| `r2Prefix` | String | R2 key prefix (e.g. `operational/hmrc/employment-income-manual`) |
| `jurisdiction` | String | Default `UK`; use ISO 3166-2 sub-code for devolved (e.g. `GB-SCT`) |
| `ingestStatus` | `OperationalIngestStatus` | `PENDING → IN_PROGRESS → COMPLETE / FAILED` |
| `pageCount` | Int | Total pages ingested |
| `lastFetchedAt` | DateTime? | Last successful ingest timestamp |

Unique constraint: `(sourceType, sourceSlug)` — prevents duplicate ingest runs creating duplicate document records.

### OperationalSection (one per page / section)

| Field | Type | Purpose |
|---|---|---|
| `id` | UUID | PK |
| `operationalDocumentId` | String | FK → OperationalDocument |
| `sourceType` | `DocumentSourceType` | Denormalised from parent — enables cross-table filtering |
| `pageSlug` | String | URL slug (e.g. `eim01000`) |
| `chapterSlug` | String? | Inferred chapter grouping (e.g. `eim01`) |
| `pageTitle` | String? | Page/section title |
| `sourceUrl` | String | Full URL of this page |
| `orderIndex` | Int | Position within manual (0-based, from index page order) |
| `htmlKey` | String? | R2 key for raw HTML (e.g. `operational/hmrc/employment-income-manual/eim00/eim00010.html`) |
| `textKey` | String? | R2 key for plain text |
| `extractedText` | String? | First ~1 000 chars for Railway FTS — full text in R2 |
| `wordCount` | Int? | Word count of extracted plain text |
| `extractedBy` | String? | Extraction method: `html-direct`, `pdf-text`, `pdf-ocr`, `ai-summary` |
| `ingestStatus` | `OperationalIngestStatus` | Per-page status |
| `fetchedAt` | DateTime? | When this page was last fetched |

Unique constraint: `(operationalDocumentId, pageSlug)` — upsert-safe.

---

## 4. R2 Key Scheme

```
operational/{publisher}/{manualSlug}/{chapterSlug}/{pageSlug}.html   — raw HTML
operational/{publisher}/{manualSlug}/{chapterSlug}/{pageSlug}.text   — plain text
```

Examples:
```
operational/hmrc/employment-income-manual/eim00/eim00010.html
operational/hmrc/employment-income-manual/eim00/eim00010.text
operational/hmrc/capital-gains-manual/cg10/cg10100.html
operational/hmrc/compliance-handbook/ch10/ch10000.html
```

PDF-source documents (e.g. Spending Reviews) will use:
```
operational/{publisher}/{docSlug}/{pageNum}.pdf      — original PDF
operational/{publisher}/{docSlug}/{pageNum}.text     — extracted text
```

All operational R2 objects are **private** — accessed via 24-hour signed URLs only, consistent with the existing R2 policy in CLAUDE.md §7.

---

## 5. OperationalScraper Interface

All scraper scripts must implement the following logical interface:

```typescript
interface OperationalScraper {
  // Metadata
  manualDef: ManualDef          // slug, title, description, govUkSlug, r2Prefix

  // Lifecycle
  checkRobotsTxt(): Promise<void>           // throw if path is disallowed
  fetchIndex(): Promise<PageLink[]>         // returns ordered list of pages to ingest
  fetchPage(url: string): Promise<RawPage>  // fetches one page, returns html + status
  extractContent(html: string): string      // extracts main body HTML
  extractPlainText(body: string): string    // strips HTML → plain text
  extractTitle(html: string): string        // extracts page title

  // Storage
  storeR2(htmlKey: string, html: string): Promise<void>
  storeDb(section: SectionParams): Promise<void>

  // Checkpoint
  loadCheckpoint(): CheckpointData
  saveCheckpoint(cp: CheckpointData): void
}
```

The `hmrc-ingest.ts` script in V.3-A satisfies this interface. Future scrapers for FCA Handbook, BAILII, Hansard, etc. should follow the same shape.

---

## 6. Rate-Limiting Policy

| Parameter | Value | Rationale |
|---|---|---|
| Minimum request interval | 2 000 ms | 1 req/2s is well within polite limits for gov.uk |
| First backoff on 429/503 | 30 000 ms (30s) | Short enough to resume promptly |
| Maximum backoff | 600 000 ms (10 min) | Prevents hammering under sustained rate-limiting |
| Backoff multiplier | ×2 per retry | Exponential growth towards max |
| Request timeout | 30 000 ms | Prevents stalled connections blocking the run |
| User-Agent | `Scrutinise/1.0 (civic tech; +https://scrutinise.org/about)` | Identifies purpose; links to site |

robots.txt must be checked at startup. If `/hmrc-internal-manuals/` (or the target path) is disallowed for `*` or the Scrutinise agent, the script must abort before making any content requests.

For sources that rate-limit differently (e.g. BAILII API, FCA Handbook API), the delay constants should be overridden per scraper — the 2s default is a floor, not a ceiling.

---

## 7. Provenance Flags

Each `OperationalSection` records `extractedBy` to indicate how plain text was produced:

| Value | Meaning |
|---|---|
| `html-direct` | Main content div extracted from HTML; no AI involved |
| `pdf-text` | PDF text layer extracted directly (e.g. via `pdf-parse`) |
| `pdf-ocr` | PDF scanned; text produced by OCR (lower confidence) |
| `ai-summary` | AI-generated summary (used when source is structured data with no prose equivalent) |

The `html-direct` path is preferred. The `extractedText` field stored in Railway is the first 1 000 characters of the plain text — sufficient for FTS and Lex context retrieval. Full text is always in R2.

---

## 8. Update Strategy

### Frequency

| Source type | Suggested re-ingest frequency | Trigger |
|---|---|---|
| HMRC manuals | Quarterly | HMRC publishes change notes; monitor their "What's changed" pages |
| FCA Handbook | Monthly | FCA maintains versioned releases |
| Hansard / Bills | On-demand | Aligned with idea stage (Stage 4→5 only) |
| Spending Reviews | Post-publication | Event-driven (Budget, Autumn Statement) |
| Case law (BAILII) | Quarterly | Background batch |

### Re-ingest behaviour

The upsert pattern (`ON CONFLICT ... DO UPDATE`) means re-ingest is safe and idempotent. If a page's content changes, the HTML and text R2 objects are overwritten in place and `fetchedAt` / `updatedAt` are updated. The checkpoint file prevents unnecessary re-fetching of unchanged pages unless explicitly cleared.

To force a full re-ingest of a manual: delete `hmrc-checkpoint.json` (or the equivalent), or remove the manual slug from `completedManuals`.

---

## 9. Known Limitations (V.3-A pilot)

1. **Page titles**: For HMRC manuals, `extractTitle` currently returns the manual-level title (from `<title>` or `<h1>`) rather than the section-level title for most pages. Individual pages on gov.uk typically have the section heading in a `<h2>` or `.govuk-heading-*` element. Refinement needed in V.3-B: extract `<h2 class="govuk-heading-l">` or similar as the preferred page title.

2. **Only index-linked pages ingested**: The pilot fetches pages linked from the manual's contents page. Deep sub-pages (e.g. pages not listed in the top-level index) are not discovered. For EIM this covers 42 of the ~3 000 EIM pages. Full ingest (Phase B+ in brief) will need pagination / recursive link following.

3. **cgindex 0-word page**: Capital Gains Manual's `cgindex` page returned 0 words — it appears to be an index/TOC page with no prose content. Not an error; worth filtering from Lex context retrieval.

4. **extractedText FTS**: The 1 000-char truncation is sufficient for pilot search but full BM25 or vector search will need the full R2 text. This is a V.3-C concern.

5. **No section-level `sourceUrl` deduplication**: If the same page URL appears under multiple manuals (unlikely but possible for shared guidance), the `(operationalDocumentId, pageSlug)` unique constraint prevents duplication within a document, but cross-document duplicate URLs are not detected.

---

## 10. Next Sources (V.3-B and beyond)

Priority order, subject to CCh sign-off:

| Source | Type | Publisher | Notes |
|---|---|---|---|
| FCA Handbook | `STATUTORY_GUIDANCE` | FCA | Has dedicated API / structured export |
| PRA Rulebook | `STATUTORY_GUIDANCE` | PRA | Similar structure to FCA Handbook |
| Explanatory Notes | `EXPLANATORY` | legislation.gov.uk | Already partially available via existing scraper |
| HoC Library briefings | `EXPLANATORY` | Parliament | PDF bulk download available |
| Hansard (selected) | `PARLIAMENTARY` | Parliament | On-demand for Stage 4→5 ideas |
| BAILII (selected) | `JUDICIAL` | BAILII | Rate-limited API; high value for policy areas |
| Departmental Estimates | `FINANCIAL_DOCUMENT` | HM Treasury | Annual cycle |

---

*This document should be updated after V.3-B once the FCA Handbook integration is underway and patterns from HMRC ingest are confirmed.*
