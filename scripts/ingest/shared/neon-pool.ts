/**
 * neon-pool.ts — the single shared pg.Pool to Neon for the whole process (V17).
 *
 * Before V17 each module (queue-client, db-metadata, progress-reporter) created
 * its own Pool, so one worker process could hold 7+ connections. With the fleet
 * consolidated into one pool process, every module shares this pool: loops hold
 * a connection only for the short claim/insert moments, not during fetches, so
 * max 10 covers 20 concurrent loops with headroom.
 */
import { Pool } from 'pg'
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

let _pool: Pool | null = null

export function getNeonPool(): Pool {
  if (!_pool) {
    const url = process.env.NEON_DATABASE_URL
    if (!url) throw new Error('NEON_DATABASE_URL not set')
    const max = parseInt(process.env.NEON_POOL_MAX ?? '10', 10)
    _pool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: isNaN(max) || max < 1 ? 10 : max,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 15_000,
      statement_timeout: 120_000,
      // query_timeout is CLIENT-side: statement_timeout cannot fire on a
      // black-holed socket, and a query that never settles froze every claim
      // loop in the first V17 shakedown (they all await one shared refresh
      // promise). keepAlive surfaces dead sockets to pg quickly.
      query_timeout: 60_000,
      keepAlive: true,
    })
  }
  return _pool
}

export async function endNeonPool(): Promise<void> {
  await _pool?.end()
  _pool = null
}
