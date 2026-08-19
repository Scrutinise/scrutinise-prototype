/**
 * names-pool.ts — a DEDICATED pool for this sprint's sweeps.
 *
 * ⚠ WHY NOT `shared/neon-pool.ts`. That pool sets a CLIENT-side `query_timeout` of 60 s, which is
 * correct for the ingest fleet (a claim loop must never wedge on a black-holed socket) and wrong
 * here: a `COUNT(*)` over the 344,773 `committees-reports` rows of a 15-million-row table, run
 * while the case-law sweep is writing to the same table, exceeded it and killed the run. This is
 * the same timeout class as the V27 §1 / V28 §2 ops bug, and `v28-title-extract.ts` already
 * carries the same dedicated-pool workaround for the same reason.
 */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

let _pool: Pool | null = null

export function namesPool(): Pool {
  if (!_pool) {
    const url = process.env.NEON_DATABASE_URL
    if (!url) throw new Error('NEON_DATABASE_URL not set')
    _pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: parseInt(process.env.NAMES_POOL_MAX ?? '4', 10),
      statement_timeout: 900_000,   // 15 min — these are 100k+-row scans and UPDATEs
      // deliberately no client query_timeout: see the header
      keepAlive: true,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 20_000,
    })
  }
  return _pool
}

export async function endNamesPool(): Promise<void> {
  await _pool?.end()
  _pool = null
}
