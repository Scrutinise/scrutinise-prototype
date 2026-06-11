// V19 §1.1 — halve twfy-pwdata rate (politeness doctrine: 503 storm = rate signal),
// then reset the 297 failed pwdata rows to pending. Ops liveness starts Ingest,
// which reads source_rate_limits at startup.
import { getNeonPool } from './shared/neon-pool'

async function main() {
  const pool = getNeonPool()

  // V18 rate was 500ms / 10 loops. TWFY 503'd under that load on 10-11 Jun.
  // Halve: 1000ms global interval, 5 concurrent loops.
  const rate = await pool.query(
    `UPDATE source_rate_limits
     SET "intervalMs" = 1000, "maxConcurrentWorkers" = 5, "updatedAt" = now()
     WHERE "sourceKey" = 'twfy-pwdata'
     RETURNING "sourceKey", "intervalMs", "maxConcurrentWorkers"`
  )
  console.log('rate limit updated:', rate.rows)

  const reset = await pool.query(
    `UPDATE ingest_queue
     SET status = 'pending', "lastError" = NULL, "claimedBy" = NULL, "claimedAt" = NULL
     WHERE status = 'failed' AND corpus LIKE 'pwdata%'
     RETURNING corpus`
  )
  const byCorpus: Record<string, number> = {}
  for (const r of reset.rows) byCorpus[r.corpus] = (byCorpus[r.corpus] ?? 0) + 1
  console.log(`reset ${reset.rowCount} failed pwdata rows to pending:`, byCorpus)

  await pool.end()
}

main().catch(e => { console.error(e); process.exit(1) })
