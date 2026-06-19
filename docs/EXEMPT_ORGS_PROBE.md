# EXEMPT-ORG PROBE — V27 §4

**Date:** 19 Jun 2026 · **By:** CC (V27). Sizing pass over the top exempt
regulators (regulators on their own domains — NOT in the ~162k gov.uk
relevant-count; each needs its own adapter, FCA-style). This sprint **sizes**;
it builds + auto-upgrades only the cleanest (clear licence, clean route, <1GB).
The rest are a ranked V28 build list.

## Method
One probe per org: content route (bulk → HTML → API priority), universe size,
licence. All figures measured live 19 Jun 2026 (curl, bot-safe UA). Licence is
the gating criterion — this project default-excludes anything not on a clear
open licence (cf. LICENCE_COMPLIANCE.md, fca-restricted, nao-nc, college-nc).

## Summary table

| Org | Route | Est. size | Licence | Adapter effort | Verdict |
|-----|-------|-----------|---------|----------------|---------|
| **ICO** | flat sitemap → per-leaf HTML + decision PDF | **26,576 leaves** (25,979 decision-notices · 326 FOI-reg · 210 enforcement · 61 audits) ≈ **~82M words / ~0.4 GB** | **OGL v3.0 — VERIFIED** ("All text content is available under the Open Government Licence v3.0, except where otherwise stated", ico.org.uk/global/privacy-cookies-and-legal/legal/) | Low (built V27) | ✅ **BUILT + PILOTED** |
| Ofgem | Drupal paged sitemap (`/sitemap.xml?page=1..10`, 5k urls/page) → per-page HTML+PDF | ~15–20k publications (≈41% of ~50k sitemap urls under `/publications/`) | © Ofgem 2026 — **own copyright, no OGL statement found** | Low–Med (clean route) | ⏸ V28 — licence verification / re-use permission first |
| Ofwat | `/publications/` paged listing (WP; `wp-json` 403) | **7,109** publications (listing "Showing 7109") | © Ofwat — **own copyright, no OGL found** | Med (HTML listing scrape) | ⏸ V28 — licence first |
| Ofcom | no `sitemaps.xml` (404); JS-rendered statements/decisions listings | ~thousands of statements/bulletins/decisions (not cleanly counted — listing is JS) | Own terms — **no OGL found; licence to verify** | Med–High (JS listing / per-section) | ⏸ V28 — licence + route both need work |
| Bank of England / PRA | `/sitemap` (200); `/prudential-regulation/publication/` listing (JS-rendered) | ~thousands of PS/SS/CP prudential publications | © Bank of England — **restrictive terms, no OGL** | Med–High (JS listing, restrictive licence) | ⏸ V28 — likely needs permission |

## Per-org detail

### 1. ICO — BUILT (the clean win)
- **Route:** `https://ico.org.uk/sitemap.xml` is a flat `urlset` (~30.5k urls).
  The legal corpus is the `/action-weve-taken/{category}/{yyyy}/{mm}/{slug}/`
  leaves — **26,576** measured. Each leaf is server-rendered HTML with the
  summary in `<main id="main-content">` AND a link to the full decision/penalty
  PDF (`/media2/…pdf`). Adapter prefers the PDF (full text), falls back to the
  main HTML.
- **Content value:** very high — 25,979 FOI/EIR **decision notices** (quasi-
  judicial adjudications) + 210 GDPR **enforcement** actions (monetary penalty
  notices, undertakings).
- **Licence:** **OGL v3.0, verified** (see table).
- **Pilot (5/5 end-to-end):** PDF where present (6,865 · 2,430 · 5,642 words),
  HTML fallback where not (239 · 276 words). Avg **3,090 words/leaf**.
  **PREDICTION: ~26,576 sections / ~82.1M words** (~0.4 GB R2; trivial Neon FTS).
- Files: `sources/ico.ts`, `processIco` (sourceType `ico`, corpus `ico`),
  `v27-seed-ico.ts`, licence-map `ico`→ogl-3.0, rate-limit `ico` 500ms/2.
  **Seed POST-PUSH** (`v27-seed-ico.ts --seed`); Railway egress canary first.

### 2. Ofgem — V28 candidate
Clean Drupal sitemap route (10 sub-pages × 5,000 urls; ~41% under
`/publications/`). The blocker is **licence**: the site asserts "© Ofgem 2026"
with no OGL statement on `/privacy-and-legal`. As a non-departmental public
body Ofgem's material is plausibly Crown-copyright/OGL-eligible, but it is **not
stated** — needs a copyright-page confirmation or a re-use email before seeding.

### 3. Ofwat — V28 candidate
7,109 publications via a WordPress `/publications/` listing (`wp-json` 403, so
scrape the HTML listing + per-publication PDFs). Licence "© Ofwat", no OGL
found — verify first.

### 4. Ofcom — V28 candidate (harder)
No sitemap (`sitemaps.xml` 404); statements/decisions listings are JS-rendered,
so enumeration needs the per-section JSON XHR (devtools capture, scotcourts-
style) or a rendered crawl. Licence not OGL on the terms page — verify. Two
problems (route + licence) → lower priority than Ofgem/Ofwat.

### 5. Bank of England / PRA — V28 candidate (hardest)
Prudential publications (Policy Statements, Supervisory Statements, Consultation
Papers) are high-value but the publication listing is JS-rendered and the BoE
terms are **restrictive** (© Bank of England; not OGL) — likely needs explicit
permission. Lowest priority of the five.

## Ranked V28 build list (Charlie to prioritise)
1. **Ofgem** — cleanest remaining route (Drupal sitemap); gated only on a licence check.
2. **Ofwat** — small (7.1k), simple HTML listing; gated on a licence check.
3. **Ofcom** — high value but JS route + licence both need work.
4. **Bank of England / PRA** — high value but restrictive licence + JS route; needs permission.

## Decision waiting on Charlie
- Licence verification (or re-use email) for **Ofgem / Ofwat / Ofcom / Bank of
  England** — none publish under an explicit OGL statement, so none could be
  built this sprint under the project's licence discipline. ICO was the only
  clear open-licence build.
