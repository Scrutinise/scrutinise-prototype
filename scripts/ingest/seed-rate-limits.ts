/**
 * seed-rate-limits.ts — upsert source_rate_limits with known per-source intervals.
 * Run once after migration: NODE_PATH=scrutinise-web/node_modules \
 *   scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json \
 *   scripts/ingest/seed-rate-limits.ts
 * Safe to re-run — upserts on conflict.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
})

// intervalMs and maxConcurrentWorkers from corpus breakdown spreadsheet.
// sourceKey must match ingest_queue."sourceType" values exactly.
const RATE_LIMITS: Array<{ sourceKey: string; intervalMs: number; maxConcurrentWorkers: number; note: string }> = [
  { sourceKey: 'tna-legislation', intervalMs: 200,  maxConcurrentWorkers: 10, note: 'legislation.gov.uk — increased 6→10 V11 (no 429s observed; adaptive throttle handles backoff)' },
  { sourceKey: 'tna-caselaw',     intervalMs: 200,  maxConcurrentWorkers: 4,  note: 'caselaw.nationalarchives.gov.uk — separate subdomain' },
  { sourceKey: 'hansard',         intervalMs: 500,  maxConcurrentWorkers: 3,  note: 'api.parliament.uk' },
  { sourceKey: 'fca',             intervalMs: 500,  maxConcurrentWorkers: 2,  note: 'FCA handbook scraper (retired — superseded by fca-handbook)' },
  { sourceKey: 'fca-handbook',   intervalMs: 500,  maxConcurrentWorkers: 3,  note: 'api-handbook.fca.org.uk JSON API — 200ms built-in chapter delay; 3 concurrent workers cover 63 modules (V10)' },
  { sourceKey: 'hmrc',            intervalMs: 300,  maxConcurrentWorkers: 3,  note: 'gov.uk general scrape (HMRC manuals, NAO, HoCL, etc.)' },
  { sourceKey: 'echr',            intervalMs: 500,  maxConcurrentWorkers: 2,  note: 'hudoc.echr.coe.int' },
  { sourceKey: 'eurlex',          intervalMs: 500,  maxConcurrentWorkers: 8,  note: 'eur-lex.europa.eu — increased 3→8 V15 (600 pending rows, idle workers)' },
  { sourceKey: 'oecd',            intervalMs: 300,  maxConcurrentWorkers: 2,  note: 'gov.uk content API (OECD docs)' },
  // 'treaties' retired V19 — uk-treaties re-pointed to govuk-content (gov.uk filter_format=international_treaty)
  { sourceKey: 'govuk-content',   intervalMs: 300,  maxConcurrentWorkers: 5,  note: 'gov.uk Content API — HALVED from 150ms/10 V19 (11 Jun 2026): 429 storm within an hour of et-decisions seeding (each row adds a PDF asset fetch); 300ms/5 ≈ 3.3 rps' },
  { sourceKey: 'bailii',          intervalMs: 1000, maxConcurrentWorkers: 3,  note: 'www.bailii.org — explicitly requests 1s floor' },
  { sourceKey: 'gov-uk',          intervalMs: 300,  maxConcurrentWorkers: 4,  note: 'gov.uk general content (TIINs, OTS, etc.)' },
  { sourceKey: 'scotlawcom',      intervalMs: 300,  maxConcurrentWorkers: 2,  note: 'scotlawcom.gov.uk — law commission publications' },
  { sourceKey: 'nilawcom',        intervalMs: 300,  maxConcurrentWorkers: 1,  note: 'nilawcommission.gov.uk — defunct since 2015, ~18 historical reports' },
  { sourceKey: 'ssrn',            intervalMs: 200,  maxConcurrentWorkers: 3,  note: 'ssrn.com — PLACEHOLDER: API returned 403 Forbidden on 3 Jun 2026 check; do not seed queue rows until access confirmed' },
  { sourceKey: 'lda-parliament',  intervalMs: 500,  maxConcurrentWorkers: 2,  note: 'lda.data.parliament.uk — 500ms floor; reduced 4→2 V15 (pages 272+ consistently 524, cap-full wastes workers)' },
  { sourceKey: 'fca-publications',intervalMs: 300,  maxConcurrentWorkers: 2,  note: 'fca.org.uk/publications — Drupal CMS, PDFs via pdf-parse; client not yet built (V8)' },
  { sourceKey: 'twfy-pwdata',     intervalMs: 1000, maxConcurrentWorkers: 5,  note: 'theyworkforyou.com/pwdata — HALVED from 500ms/10 V19 (11 Jun 2026): V18 full-archive run drew a 503 storm from mySociety (a charity); a 5xx storm under load is a rate signal, not a retry signal' },
  { sourceKey: 'twfy-api',          intervalMs: 1500, maxConcurrentWorkers: 1,  note: 'theyworkforyou.com API — strict 1-worker cap; daily quota exhausted on free tier with >1 worker (V7 6 Jun 2026)' },
  { sourceKey: 'committees-portal',  intervalMs: 500,  maxConcurrentWorkers: 3,  note: 'committees.parliament.uk portal — 500ms floor; Parliament shared infra same as blocked API (V15 9 Jun 2026)' },
  { sourceKey: 'committees-document', intervalMs: 300, maxConcurrentWorkers: 5,  note: 'publications.parliament.uk — per-document fetch; accessible from Railway IPs (V16); separate from committees-portal listing which is IP-blocked' },
  { sourceKey: 'committees-api',      intervalMs: 1000, maxConcurrentWorkers: 3, note: 'committees-api.parliament.uk JSON API (V20) — 2 fetches/row (detail + document), 1000ms/3 ≈ 2 rps at the host; Railway egress unverified until post-push canary' },
  { sourceKey: 'tax-tribunals',       intervalMs: 1000, maxConcurrentWorkers: 2, note: 'financeandtax.decisions.tribunals.gov.uk (V20) — legacy HMCTS WebForms host; 2 fetches/row (view + judgment file), keep gentle at ~2 rps' },
  { sourceKey: 'lawcom',              intervalMs: 500,  maxConcurrentWorkers: 2, note: 'lawcom.gov.uk WP REST API + MoJ CDN PDFs (V20) — small universe (240 pubs), OGL v3.0' },
  { sourceKey: 'judiciaryni',         intervalMs: 2000, maxConcurrentWorkers: 1, note: 'judiciaryni.uk Drupal (V20) — 2 fetches/row (page + PDF), ~5,900 decisions; official NI record FCL lacks. V22: HALVED from 1000ms/2 — host IP-cut the Railway drain at ~428 rows on 12 Jun (politeness §1b); client now backs off on 403/socket failures too' },
  { sourceKey: 'nao',                 intervalMs: 500,  maxConcurrentWorkers: 2, note: 'nao.org.uk WP REST API + uploads PDFs (V20) — 2,755 reports; licence nao-nc (non-commercial + attribution)' },
  { sourceKey: 'historic-hansard',    intervalMs: 5000, maxConcurrentWorkers: 2, note: 'hansard-archive.parliament.uk bulk volume zips (V21) — 1 fetch/row (~1-2MB zip) then minutes of local parse + R2 puts; 5000ms/2 is half of a reasonable 2500ms/4 per the politeness doctrine (Parliament static archive, CF-fronted)' },
  { sourceKey: 'historic-hansard-html', intervalMs: 500, maxConcurrentWorkers: 2, note: 'api.parliament.uk/historic-hansard HTML gap-fill (V22) — gapday rows make ~5-40 page fetches each; client throttle floors 500ms within the row, so the host sees ≲2 rps total' },
  { sourceKey: 'niassembly-hansard',  intervalMs: 1000, maxConcurrentWorkers: 2, note: 'data.niassembly.gov.uk AIMS Open Data (V24) — Microsoft-IIS, no Cloudflare; 1 fetch/row (~0.7MB component list) then local parse + R2 puts. 646 plenary reports 2012-. OGL v3.0.' },
  { sourceKey: 'inquiry-reports',     intervalMs: 500,  maxConcurrentWorkers: 3, note: 'gov.uk content API publication-attachment PDFs + UK Gov Web Archive (V24) — public inquiry final reports, OGL v3.0; PDF text via pdf-parse.' },
  { sourceKey: 'senedd-cofnod',       intervalMs: 500,  maxConcurrentWorkers: 3, note: 'record.senedd.wales (V25 §2) — custom .NET host, NO Cloudflare. 1 fetch/row (~1.5MB plenary transcript) then local parse + R2 puts. Welsh Parliament Plenary Cofnod, one section per English speaker-turn. OGL v3.0.' },
  { sourceKey: 'bills-api',           intervalMs: 500,  maxConcurrentWorkers: 3, note: 'bills-api.parliament.uk (V25 §4) — JSON API + API-hosted PDF downloads; list:{billId} row = 1 JSON call, content row = 1 PDF. OPL v3.0.' },
  { sourceKey: 'college-policing-archive', intervalMs: 1000, maxConcurrentWorkers: 2, note: 'webarchive.nationalarchives.gov.uk (V25 §3) — TNA infra, CF-free; 1 archived-capture fetch/row (id_ raw HTML). College APP 2022 snapshots, licence college-nc (commercial-surface excluded). Archive can be slow — keep gentle.' },
  { sourceKey: 'scottish-parliament-or', intervalMs: 1000, maxConcurrentWorkers: 2, note: 'www.parliament.scot Official Report HTML (V28 §7) — supersedes the V25/V27 gated stub; conventional server-rendered HTML, no capture. Enumeration via sitemap.xml (5,131 reports 2016-); each row fetches the base report page + one page per agenda item (iob), so ~8-15 fetches/row — 1000ms floor keeps the host ≲2 rps. Per-contribution sections. Scottish Parliament Copyright Licence (spcb).' },
  { sourceKey: 'division-votes',      intervalMs: 400,  maxConcurrentWorkers: 3, note: 'commonsvotes-api / lordsvotes-api.parliament.uk (V28 §3, reworked V34 §A) — robust JSON, 1 detail fetch/row → one corpus section per division PLUS one `divisions` row and N `division_votes` rows (the countable per-member facts). 5,645 divisions re-measured 10 Aug 2026 (Commons 2,361 from 2016-03-09; Lords 3,284 from 1999-11-24). ⚠ Commons list take is server-capped at 25 regardless of what is asked — see sources/division-votes.ts. Measured ~600ms/division end to end. Open Parliament Licence v3.0.' },
  { sourceKey: 'library-briefings',   intervalMs: 1000, maxConcurrentWorkers: 2, note: 'commonslibrary / lordslibrary.parliament.uk (V28 §5) — BUILT TO THE GATE. WordPress behind a Cloudflare managed-challenge on the content endpoints; do NOT seed until a cf_clearance cookie + research-briefing post-type slug are captured (see sources/library-briefings.ts). Expected OPL v3.0.' },
  { sourceKey: 'scottish-courts',     intervalMs: 1000, maxConcurrentWorkers: 2, note: 'www.scotcourts.gov.uk (V27 §2) — enumeration via api.pa.web.scotcourts.gov.uk JSON (Origin/Referer-gated, no auth); 1 PDF fetch/row → 1 section. 13,066 judgments, OGL v3.0. Railway PDF-egress canary first.' },
  { sourceKey: 'ico',                 intervalMs: 500,  maxConcurrentWorkers: 2, note: 'ico.org.uk (V27 §4, exempt org) — flat-sitemap enumeration; per row 1 HTML page + 1–6 decision/penalty PDFs. ~26,576 action-weve-taken leaves (mostly FOI decision-notices), OGL v3.0. V29 §1: adapter hardened with a polite retry after ~12% transient throttle on the full drain.' },
  // ── V29 ──────────────────────────────────────────────────────────────────────
  { sourceKey: 'erskine-may',         intervalMs: 400,  maxConcurrentWorkers: 3, note: 'erskinemay-api.parliament.uk (V29 §3.1) — robust JSON, 1 fetch/row → one section per Erskine May Section. 2,038 sections. OPL v3.0.' },
  // ── V34 — BRIEF_INGEST_POLITICAL_SOURCES ─────────────────────────────────────
  { sourceKey: 'impact-assessments',  intervalMs: 700,  maxConcurrentWorkers: 2, note: 'legislation.gov.uk /ukia/ (V34 §B) — BULK route: per-year Atom feed, then 1 PDF fetch/row. IAs are LARGE (mean 120k chars extracted, max measured 542k over 233 pages) so each row does one big download plus N R2 puts after proforma sectioning; 700ms and 2 workers keeps TNA gentle while a 1.5MB PDF is in flight. 1,181 IAs over 2005-2026 with holes at 2008-2016 and 2024-2025 (recorded, not smoothed). OGL v3.0.' },
  { sourceKey: 'consultations',       intervalMs: 500,  maxConcurrentWorkers: 3, note: 'gov.uk Search + Content API (V34 §C) — 1 content fetch/row → one section per consultation carrying the body, the government response, and the document list WITH each attachment classified (individual response vs summarised). 7,447 total (86 open + 1,059 closed + 6,302 outcomes). ⚠ document_type `consultation` returns 0 — the real types are open_/closed_consultation and consultation_outcome. OGL v3.0.' },
  { sourceKey: 'early-day-motions',   intervalMs: 400,  maxConcurrentWorkers: 3, note: 'oralquestionsandmotions-api.parliament.uk (V29 §3.2) — JSON list pages; 1 fetch/row → up to 100 motion sections. ~60,737 motions. OPL v3.0.' },
  { sourceKey: 'petitions',           intervalMs: 400,  maxConcurrentWorkers: 3, note: 'petition.parliament.uk (V29 §3.3) — JSON list pages (open + archived); 1 fetch/row → up to 25 petition sections (full text + govt response + debate). ~66k petitions. OPL v3.0.' },
  { sourceKey: 'members-interests',   intervalMs: 400,  maxConcurrentWorkers: 2, note: 'interests-api.parliament.uk (V29 §3.4) — JSON list pages; 1 fetch/row → one section per interest. ~3,341 interests. OPL v3.0.' },
  { sourceKey: 'cps-guidance',        intervalMs: 1000, maxConcurrentWorkers: 2, note: 'cps.gov.uk (V29 §4, own domain) — Drupal sitemap enumeration; 1 HTML fetch/row → one section per guidance doc. 270 prosecution-guidance docs + Code for Crown Prosecutors. OGL v3.0 (verified /crown-copyright-and-disclaimer). Keep gentle (CF-fronted).' },
  { sourceKey: 'independent-reviews', intervalMs: 500,  maxConcurrentWorkers: 3, note: 'gov.uk assets.publishing.service.gov.uk PDFs (V29 §5) — per-PDF rows (reuses inquiry-reports machinery). ~345 reviews / ~675 report PDFs, OGL v3.0.' },
  { sourceKey: 'ofgem',               intervalMs: 1000, maxConcurrentWorkers: 2, note: 'ofgem.gov.uk (V29 §6, exempt org) — Drupal sitemap; per row 1 HTML + up to 6 PDFs (PDF-heavy). 12,899 /publications/ leaves, OGL v3.0 (verified /copyright). Railway egress canary first.' },
  { sourceKey: 'ofcom',               intervalMs: 1000, maxConcurrentWorkers: 2, note: 'ofcom.org.uk (V29 §6, exempt org) — topic-sitemap enumeration; per row 1 HTML + optional PDFs. ~4,093 regulatory pages, ofcom-open (verified /about-ofcom/website/terms-of-use). Railway egress canary first.' },
  { sourceKey: 'lgsco',               intervalMs: 1000, maxConcurrentWorkers: 2, note: 'lgo.org.uk (V29 §7, ombudsman) — self-propagating paged listing (list:{category}:{page}) + per-decision HTML; 1 fetch/row. Large DB (decisions since 2013). lgsco-open OGL-equivalent (verified /copyright). The clean-licence ombudsman build.' },
  { sourceKey: 'library-briefings',   intervalMs: 1000, maxConcurrentWorkers: 2, note: 'commons/lords/post research-briefings WP REST (V28 §5 / V29 §9) — CAPTURE-GATED (Cloudflare managed-challenge); seeds nothing until a per-host cf_clearance + CPT slug is captured. 1 fetch/row. OPL v3.0.' },
  // ── V30 ──────────────────────────────────────────────────────────────────────
  { sourceKey: 'cma-cases',           intervalMs: 300,  maxConcurrentWorkers: 5, note: 'gov.uk cma_case finder + assets.publishing.service.gov.uk PDFs (V30 §1.1) — body overview row (gov.uk content API) + per-PDF decision-doc rows. ~2,562 cases, ~12.5k sections est. OGL v3.0 (CMA non-ministerial dept). Mixed gov.uk + CDN, 300ms/5 ≈ 16 rps headroom under gov.uk’s ~10rps ask.' },
  { sourceKey: 'inquiry-evidence',    intervalMs: 1000, maxConcurrentWorkers: 2, note: 'public-inquiry evidence sites (V30 §3) — §0-governed. Pilot: postofficehorizoninquiry.org.uk Drupal evidence library; per row 1 detail page (resolves the live /file download token + §0 metadata) + 1 PDF. ~19,605 items. OGL v3.0 (verified /terms-and-conditions). Charity/inquiry host — keep gentle, ≲2 rps.' },
  // scottish-parliament-or (V30 §4 pre-2016 archive) reuses the existing entry
  // above; independent-reviews (V30 §2 own-domain) reuses its V29 entry.
  // ── V31 ──────────────────────────────────────────────────────────────────────
  { sourceKey: 'fcdo-treaties', intervalMs: 750, maxConcurrentWorkers: 2, note: 'treaties.fcdo.gov.uk (V31 STEP 1) — legacy JBoss/Knowvation AWARE host, reverse-engineered anonymous JSON search API (no bulk/HTML route exists). 1 search-by-id fetch/row + up to N PDF fetches (references field). 21,970 records, 33% carry a PDF. OGL v3.0. Keep gentle — old enterprise box, no CDN in front of it.' },
  { sourceKey: 'parliament-treaties', intervalMs: 400, maxConcurrentWorkers: 3, note: 'treaties-api.parliament.uk (V31 STEP 2) — documented OpenAPI, same robust family as bills-api/committees-api. 2 fetches/row (Treaty detail + BusinessItems). 328 treaties total (CRaG 2010 scrutiny register). OPL v3.0.' },
]

async function main(): Promise<void> {
  console.log('[seed-rate-limits] upserting', RATE_LIMITS.length, 'source entries')
  for (const { sourceKey, intervalMs, maxConcurrentWorkers, note } of RATE_LIMITS) {
    await pool.query(`
      INSERT INTO source_rate_limits ("sourceKey", "intervalMs", "maxConcurrentWorkers", "updatedAt")
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT ("sourceKey") DO UPDATE
        SET "intervalMs"           = EXCLUDED."intervalMs",
            "maxConcurrentWorkers" = EXCLUDED."maxConcurrentWorkers",
            "updatedAt"            = NOW()
    `, [sourceKey, intervalMs, maxConcurrentWorkers])
    console.log(`  ${sourceKey.padEnd(20)} ${intervalMs}ms  max ${maxConcurrentWorkers} workers  — ${note}`)
  }
  console.log('[seed-rate-limits] done')
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
