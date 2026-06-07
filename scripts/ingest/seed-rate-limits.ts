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
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
})

// intervalMs and maxConcurrentWorkers from corpus breakdown spreadsheet.
// sourceKey must match ingest_queue."sourceType" values exactly.
const RATE_LIMITS: Array<{ sourceKey: string; intervalMs: number; maxConcurrentWorkers: number; note: string }> = [
  { sourceKey: 'tna-legislation', intervalMs: 200,  maxConcurrentWorkers: 6,  note: 'legislation.gov.uk' },
  { sourceKey: 'tna-caselaw',     intervalMs: 200,  maxConcurrentWorkers: 4,  note: 'caselaw.nationalarchives.gov.uk — separate subdomain' },
  { sourceKey: 'hansard',         intervalMs: 500,  maxConcurrentWorkers: 3,  note: 'api.parliament.uk' },
  { sourceKey: 'fca',             intervalMs: 500,  maxConcurrentWorkers: 2,  note: 'FCA handbook scraper (retired — superseded by fca-handbook)' },
  { sourceKey: 'fca-handbook',   intervalMs: 500,  maxConcurrentWorkers: 3,  note: 'api-handbook.fca.org.uk JSON API — 200ms built-in chapter delay; 3 concurrent workers cover 63 modules (V10)' },
  { sourceKey: 'hmrc',            intervalMs: 300,  maxConcurrentWorkers: 3,  note: 'gov.uk general scrape (HMRC manuals, NAO, HoCL, etc.)' },
  { sourceKey: 'echr',            intervalMs: 500,  maxConcurrentWorkers: 2,  note: 'hudoc.echr.coe.int' },
  { sourceKey: 'eurlex',          intervalMs: 500,  maxConcurrentWorkers: 3,  note: 'eur-lex.europa.eu' },
  { sourceKey: 'oecd',            intervalMs: 300,  maxConcurrentWorkers: 2,  note: 'gov.uk content API (OECD docs)' },
  { sourceKey: 'treaties',        intervalMs: 300,  maxConcurrentWorkers: 2,  note: 'gov.uk content API (FCDO treaties)' },
  { sourceKey: 'bailii',          intervalMs: 1000, maxConcurrentWorkers: 3,  note: 'www.bailii.org — explicitly requests 1s floor' },
  { sourceKey: 'gov-uk',          intervalMs: 300,  maxConcurrentWorkers: 4,  note: 'gov.uk general content (TIINs, OTS, etc.)' },
  { sourceKey: 'scotlawcom',      intervalMs: 300,  maxConcurrentWorkers: 2,  note: 'scotlawcom.gov.uk — law commission publications' },
  { sourceKey: 'nilawcom',        intervalMs: 300,  maxConcurrentWorkers: 1,  note: 'nilawcommission.gov.uk — defunct since 2015, ~18 historical reports' },
  { sourceKey: 'ssrn',            intervalMs: 200,  maxConcurrentWorkers: 3,  note: 'ssrn.com — PLACEHOLDER: API returned 403 Forbidden on 3 Jun 2026 check; do not seed queue rows until access confirmed' },
  { sourceKey: 'lda-parliament',  intervalMs: 500,  maxConcurrentWorkers: 4,  note: 'lda.data.parliament.uk — 500ms floor (raised from 200ms V7; 524 timeouts indicate needs breathing room)' },
  { sourceKey: 'fca-publications',intervalMs: 300,  maxConcurrentWorkers: 2,  note: 'fca.org.uk/publications — Drupal CMS, PDFs via pdf-parse; client not yet built (V8)' },
  { sourceKey: 'twfy-pwdata',     intervalMs: 500,  maxConcurrentWorkers: 10, note: 'theyworkforyou.com/pwdata — polite rate; mySociety server, no stated limit (V2 4 Jun 2026)' },
  { sourceKey: 'twfy-api',        intervalMs: 1500, maxConcurrentWorkers: 1,  note: 'theyworkforyou.com API — strict 1-worker cap; daily quota exhausted on free tier with >1 worker (V7 6 Jun 2026)' },
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
