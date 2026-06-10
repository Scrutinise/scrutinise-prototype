/**
 * seed-pwdata-perspeech-v18.ts — V18 §2: pwdata per-speech granularity
 * migration, full archive reseed.
 *
 * ⚠️ RUN ONLY AFTER THE V18 PUSH — the per-speech processor must be deployed
 * first; the pre-V18 worker would re-ingest day-blobs.
 * ⚠️ Run AFTER the pilot numbers were reviewed (predict, measure, commit).
 *
 * Resets every TWFY day-file across all 7 pwdata corpora to pending at P3
 * (the long-running floor — small corpora at P1/P2 never queue behind it).
 * This deliberately does NOT dedup against corpus_sections: the archive is
 * fully ingested at day-blob granularity and every file must be re-processed
 * into per-speech sections. Pending/claimed rows are left untouched; rerun-safe.
 *
 * Rate limit 'twfy-pwdata': 500ms interval, 10 concurrent (unchanged from V2).
 * Reasoning: TWFY is a charity's static-file server; 2 fetches/s sustained is
 * the pace their own scrapers use, and one fetch per day-file means the whole
 * archive is ~50k requests ≈ 7h of fetch time — politeness costs us nothing
 * because section writes, not fetches, dominate row time.
 *
 * corpus_targets denominators come from the V18 pilot sections/file rates
 * (SEC_PER_FILE below) — this is what makes the email's headline % honest
 * (the old ~5.8M denominator was per-speech arithmetic over day-file counts).
 *
 * Run (pwsh):
 *   $env:NODE_PATH = 'scrutinise-web/node_modules'
 *   scrutinise-web/node_modules/.bin/tsx --tsconfig scripts/tsconfig.json scripts/ingest/seed-pwdata-perspeech-v18.ts
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'
import { bulkInsertQueueRows } from './shared/queue-client'
import { listPwdataFiles, PWDATA_CORPUS_CONFIG } from './sources/twfy-pwdata'

// Sections per SITTING DAY measured in the V18 pilot (10 Jun 2026). Files ≠
// days: TWFY publishes multiple scrape versions per day (letter suffixes);
// only the latest yields sections, the rest get superseded-markers. So
// est_sections = distinct days × per-day rate. Pilot rates: debates 2026-03
// 475/day, 1985-03 414/day, 1950-03 328/day → era blend 400; lords 216;
// wrans 436; westminster 92; lordswrans 54; wms 8; lordswms 7.
const SEC_PER_DAY: Record<string, number> = {
  'pwdata-debates': 400,
  'pwdata-lords': 216,
  'pwdata-wrans': 436,
  'pwdata-westminster': 92,
  'pwdata-lordswrans': 54,
  'pwdata-wms': 8,
  'pwdata-lordswms': 7,
}

const LABELS: Record<string, string> = {
  'pwdata-debates': 'Commons Hansard (per-speech)',
  'pwdata-lords': 'Lords Hansard (per-speech)',
  'pwdata-wrans': 'Commons Written Answers (per-Q&A)',
  'pwdata-westminster': 'Westminster Hall (per-speech)',
  'pwdata-lordswrans': 'Lords Written Answers (per-Q&A)',
  'pwdata-wms': 'Commons Written Statements (per-statement)',
  'pwdata-lordswms': 'Lords Written Statements (per-statement)',
}

async function main() {
  const pool = getNeonPool()

  await pool.query(`
    INSERT INTO source_rate_limits ("sourceKey", "intervalMs", "maxConcurrentWorkers", suspended, "isComplete", "updatedAt")
    VALUES ('twfy-pwdata', 500, 10, false, false, NOW())
    ON CONFLICT ("sourceKey") DO UPDATE
      SET "intervalMs" = 500, "maxConcurrentWorkers" = 10, "isComplete" = false, suspended = false, "updatedAt" = NOW()
  `)
  console.log('rate limit: twfy-pwdata 500ms / 10 concurrent, isComplete=false')

  let totalRows = 0
  let totalEst = 0
  for (const corpus of Object.keys(PWDATA_CORPUS_CONFIG)) {
    const files = await listPwdataFiles(corpus)
    const rows = files.map(f => ({
      id: `${corpus}:${f.docId}`,
      corpus,
      docId: f.docId,
      sourceType: 'twfy-pwdata',
      priority: 3,
    }))
    const { affected } = await bulkInsertQueueRows(rows, { resetExisting: true })
    const days = new Set(files.map(f => f.docId.replace(/[a-z]$/, ''))).size
    const est = Math.round(days * (SEC_PER_DAY[corpus] ?? 0))
    totalRows += affected
    totalEst += est
    console.log(`${corpus.padEnd(22)} files=${String(files.length).padStart(6)}  days=${String(days).padStart(6)}  queued=${String(affected).padStart(6)}  est_sections=${est.toLocaleString()}`)

    await pool.query(`
      INSERT INTO corpus_targets (corpus_key, display_label, est_sections, est_is_confirmed, blocked, blocked_reason)
      VALUES ($1, $2, $3, false, false, NULL)
      ON CONFLICT (corpus_key) DO UPDATE
        SET display_label = EXCLUDED.display_label, est_sections = EXCLUDED.est_sections,
            est_is_confirmed = false, blocked = false, blocked_reason = NULL
    `, [corpus, LABELS[corpus], est])
  }

  console.log(`\nDONE — ${totalRows.toLocaleString()} day-file rows queued at P3, est ${totalEst.toLocaleString()} sections`)
  console.log('Ops liveness will start Ingest within 15 min.')
  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
