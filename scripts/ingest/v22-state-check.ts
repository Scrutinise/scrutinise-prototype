/**
 * v22-state-check.ts — read-only sprint-open diagnostic for V22.
 * Breakers, queue by corpus×status, failure samples for the two tripped
 * sources, enum-row state, and corpus_targets rows the sprint touches.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()

  console.log('=== source_status (breakers) ===')
  const breakers = await pool.query(`SELECT * FROM source_status ORDER BY source_key`)
  for (const r of breakers.rows) console.log(JSON.stringify(r))

  console.log('\n=== ingest_queue by corpus × status ===')
  const q = await pool.query(`
    SELECT corpus, status, COUNT(*)::int AS n
    FROM ingest_queue GROUP BY corpus, status ORDER BY corpus, status`)
  for (const r of q.rows) console.log(`${r.corpus}\t${r.status}\t${r.n}`)

  console.log('\n=== committees-api failed/blocked lastError samples ===')
  const ca = await pool.query(`
    SELECT status, "lastError", COUNT(*)::int AS n
    FROM ingest_queue
    WHERE "sourceType" = 'committees-api' AND status IN ('failed','blocked')
    GROUP BY status, "lastError" ORDER BY n DESC LIMIT 20`)
  for (const r of ca.rows) console.log(`${r.status}\t${r.n}\t${r.lastError}`)

  console.log('\n=== committees-api blocked docId sample ===')
  const cad = await pool.query(`
    SELECT "docId", corpus, status FROM ingest_queue
    WHERE "sourceType" = 'committees-api' AND status IN ('failed','blocked')
    ORDER BY "docId" LIMIT 10`)
  for (const r of cad.rows) console.log(JSON.stringify(r))

  console.log('\n=== judiciaryni failed lastError samples ===')
  const ni = await pool.query(`
    SELECT status, "lastError", COUNT(*)::int AS n
    FROM ingest_queue
    WHERE "sourceType" = 'judiciaryni'
    GROUP BY status, "lastError" ORDER BY n DESC LIMIT 20`)
  for (const r of ni.rows) console.log(`${r.status}\t${r.n}\t${r.lastError}`)

  console.log('\n=== judiciaryni failed docId sample ===')
  const nid = await pool.query(`
    SELECT "docId", status, "lastError" FROM ingest_queue
    WHERE "sourceType" = 'judiciaryni' AND status = 'failed'
    ORDER BY "docId" LIMIT 12`)
  for (const r of nid.rows) console.log(JSON.stringify(r))

  console.log('\n=== enum rows (tna enum + committees list) ===')
  const en = await pool.query(`
    SELECT corpus, status, COUNT(*)::int AS n,
           MIN("lastError") AS sample_err
    FROM ingest_queue
    WHERE "docId" LIKE 'enum:%' OR "docId" LIKE 'list:%'
    GROUP BY corpus, status ORDER BY corpus, status`)
  for (const r of en.rows) console.log(`${r.corpus}\t${r.status}\t${r.n}\t${r.sample_err ?? ''}`)

  console.log('\n=== corpus_targets sprint-relevant ===')
  const ct = await pool.query(`
    SELECT corpus_key, est_sections, est_is_confirmed, blocked, blocked_reason, retired, notes
    FROM corpus_targets
    WHERE corpus_key IN ('historic-hansard','echr-hudoc','quangos-govuk','retained-eu',
      'explanatory-notes','explanatory-memoranda','tax-tribunals','nao-reports',
      'ni-judgments','committees-reports','committees-evidence','si-2010plus',
      'primary-acts-pre-2000','regional','lawcom')
    ORDER BY corpus_key`)
  for (const r of ct.rows) console.log(JSON.stringify(r))

  console.log('\n=== ingest service heartbeat ===')
  const hb = await pool.query(`SELECT * FROM ingest_service_state`)
  for (const r of hb.rows) console.log(JSON.stringify(r))

  console.log('\n=== section counts for sprint corpora ===')
  const sc = await pool.query(`
    SELECT corpus, COUNT(*)::int AS n
    FROM corpus_sections
    WHERE corpus IN ('historic-hansard','echr-hudoc','retained-eu','tax-tribunals',
      'nao-reports','ni-judgments','committees-reports','committees-evidence',
      'explanatory-notes','explanatory-memoranda','lawcom')
    GROUP BY corpus ORDER BY corpus`)
  for (const r of sc.rows) console.log(`${r.corpus}\t${r.n}`)

  await endNeonPool()
}

main().catch(e => { console.error(e); process.exit(1) })
