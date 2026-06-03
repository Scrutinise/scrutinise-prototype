import { Pool } from 'pg'

const pool = new Pool({
  connectionString: 'postgresql://postgres:XcNcjUTMuGmoEppCafqDeYdHCdhpYoCu@switchback.proxy.rlwy.net:16156/railway',
  ssl: { rejectUnauthorized: false },
  statement_timeout: 60_000,
})

async function run() {
  console.log('=== PART 2a — corpus_sections count by corpus ===')
  const q2a = await pool.query(`
    SELECT corpus, COUNT(*) as section_count,
      MIN("createdAt") as first_compiled,
      MAX("createdAt") as last_compiled
    FROM corpus_sections
    GROUP BY corpus
    ORDER BY section_count DESC
  `)
  console.table(q2a.rows)

  console.log('\n=== PART 2b — ingest_queue coverage for SI/primary ===')
  const q2b = await pool.query(`
    SELECT corpus, status, COUNT(*) as row_count,
      MIN("docId") as earliest_doc,
      MAX("docId") as latest_doc
    FROM ingest_queue
    WHERE corpus LIKE '%si%' OR corpus LIKE '%ukpga%' OR corpus LIKE '%primary%'
    GROUP BY corpus, status
    ORDER BY corpus, status
  `)
  console.table(q2b.rows)

  console.log('\n=== PART 2c — Distinct docs in corpus_sections (from composite id) ===')
  const q2c = await pool.query(`
    SELECT corpus,
      COUNT(DISTINCT SPLIT_PART(id, ':', 2)) as distinct_docs,
      COUNT(*) as total_sections
    FROM corpus_sections
    GROUP BY corpus
    ORDER BY total_sections DESC
  `)
  console.table(q2c.rows)

  console.log('\n=== PART 5a — SI years processed ===')
  const q5a = await pool.query(`
    SELECT
      SUBSTRING("docId" FROM 'uksi/(\\d{4})/') as year,
      status,
      COUNT(*) as rows
    FROM ingest_queue
    WHERE corpus LIKE '%si%'
      AND "docId" ~ 'uksi/\\d{4}/'
    GROUP BY year, status
    ORDER BY year, status
  `)
  console.table(q5a.rows)

  console.log('\n=== PART 5b — Primary act years processed ===')
  const q5b = await pool.query(`
    SELECT
      SUBSTRING("docId" FROM 'ukpga/(\\d{4})/') as year,
      status,
      COUNT(*) as rows
    FROM ingest_queue
    WHERE (corpus LIKE '%primary%' OR corpus LIKE '%ukpga%')
      AND "docId" ~ 'ukpga/\\d{4}/'
    GROUP BY year, status
    ORDER BY year, status
  `)
  console.table(q5b.rows)

  await pool.end()
}

run().catch(e => { console.error(e); process.exit(1) })
