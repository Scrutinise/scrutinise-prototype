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
