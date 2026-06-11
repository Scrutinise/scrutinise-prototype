// V19: gov.uk 429 storm response — politeness doctrine: halve the rate, document, clear, resume.
// V18 150ms/10 (~6.7rps) was fine for hmrc-manuals body-only pages; et-decisions adds a PDF
// fetch per row and gov.uk began 429ing within the hour. 300ms/5 ≈ 3.3 rps sustained.
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool } from './shared/neon-pool'

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const INGEST_SERVICE = 'a7f4d75f-d844-4e1c-8edf-2569346b31c9'
const ENV_ID = '991f733c-719c-4217-a6d6-1dbe80642bbe'

async function main() {
  const pool = getNeonPool()

  const r = await pool.query(`
    UPDATE source_rate_limits SET "intervalMs"=300, "maxConcurrentWorkers"=5, "updatedAt"=now()
    WHERE "sourceKey"='govuk-content'
    RETURNING "sourceKey","intervalMs","maxConcurrentWorkers"`)
  console.log('rate halved:', r.rows)

  // Restart Ingest so the new rate loads (config is read at startup only)
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RAILWAY_API_TOKEN}` },
    body: JSON.stringify({
      query: `mutation { serviceInstanceRedeploy(environmentId: "${ENV_ID}", serviceId: "${INGEST_SERVICE}") }`,
    }),
  })
  console.log('Ingest redeploy:', res.status, JSON.stringify(await res.json()))

  // Clear breaker + unpark + reset 429 failures (root cause = rate, now fixed)
  await pool.query(`UPDATE source_status SET state='ok', trip_reason=NULL, tripped_at=NULL, zero_output_streak=0 WHERE source_key='govuk-content'`)
  const unpark = await pool.query(`UPDATE ingest_queue SET status='pending', "lastError"=NULL WHERE "sourceType"='govuk-content' AND status='blocked' RETURNING id`)
  const refail = await pool.query(`UPDATE ingest_queue SET status='pending', "lastError"=NULL, "claimedBy"=NULL, "claimedAt"=NULL WHERE "sourceType"='govuk-content' AND status='failed' RETURNING id`)
  console.log(`breaker cleared; unparked ${unpark.rowCount} blocked rows; reset ${refail.rowCount} failed rows`)

  await pool.end()
}
main().catch(e => { console.error(e); process.exit(1) })
