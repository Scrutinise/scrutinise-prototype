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

// intervalMs values from corpus breakdown spreadsheet.
// sourceKey must match ingest_queue."sourceType" values exactly.
const RATE_LIMITS: Array<{ sourceKey: string; intervalMs: number; note: string }> = [
  { sourceKey: 'tna-legislation', intervalMs: 200,  note: 'legislation.gov.uk' },
  { sourceKey: 'tna-caselaw',     intervalMs: 200,  note: 'caselaw.nationalarchives.gov.uk — separate subdomain' },
  { sourceKey: 'hansard',         intervalMs: 500,  note: 'api.parliament.uk' },
  { sourceKey: 'fca',             intervalMs: 500,  note: 'FCA handbook scraper' },
  { sourceKey: 'hmrc',            intervalMs: 300,  note: 'gov.uk general scrape (HMRC manuals, NAO, HoCL, etc.)' },
  { sourceKey: 'echr',            intervalMs: 500,  note: 'hudoc.echr.coe.int' },
  { sourceKey: 'eurlex',          intervalMs: 500,  note: 'eur-lex.europa.eu' },
  { sourceKey: 'oecd',            intervalMs: 300,  note: 'gov.uk content API (OECD docs)' },
  { sourceKey: 'treaties',        intervalMs: 300,  note: 'gov.uk content API (FCDO treaties)' },
  { sourceKey: 'bailii',          intervalMs: 1000, note: 'www.bailii.org — explicitly requests 1s floor' },
  { sourceKey: 'gov-uk',          intervalMs: 300,  note: 'gov.uk general content (TIINs, OTS, etc.) — same rate as treaties/hmrc' },
  { sourceKey: 'scotlawcom',      intervalMs: 300,  note: 'scotlawcom.gov.uk — law commission publications' },
  { sourceKey: 'nilawcom',        intervalMs: 300,  note: 'nilawcommission.gov.uk — defunct since 2015, ~18 historical reports' },
  { sourceKey: 'ssrn',            intervalMs: 200,  note: 'ssrn.com — PLACEHOLDER: API returned 403 Forbidden on 3 Jun 2026 check; do not seed queue rows until access confirmed' },
  { sourceKey: 'lda-parliament',    intervalMs: 200,  note: 'lda.data.parliament.uk — no auth, 500 records/page; confirmed working V6 3 Jun 2026' },
  { sourceKey: 'fca-publications',  intervalMs: 300,  note: 'fca.org.uk/publications — Drupal CMS, PDFs via pdf-parse; client not yet built (V8)' },
  { sourceKey: 'twfy-pwdata',       intervalMs: 500,  note: 'theyworkforyou.com/pwdata — polite rate; mySociety server, no stated limit (V2 4 Jun 2026)' },
]

async function main(): Promise<void> {
  console.log('[seed-rate-limits] upserting', RATE_LIMITS.length, 'source entries')
  for (const { sourceKey, intervalMs, note } of RATE_LIMITS) {
    await pool.query(`
      INSERT INTO source_rate_limits ("sourceKey", "intervalMs", "updatedAt")
      VALUES ($1, $2, NOW())
      ON CONFLICT ("sourceKey") DO UPDATE
        SET "intervalMs" = EXCLUDED."intervalMs",
            "updatedAt"  = NOW()
    `, [sourceKey, intervalMs])
    console.log(`  ${sourceKey.padEnd(20)} ${intervalMs}ms  — ${note}`)
  }
  console.log('[seed-rate-limits] done')
  await pool.end()
}

main().catch(err => { console.error(err); process.exit(1) })
