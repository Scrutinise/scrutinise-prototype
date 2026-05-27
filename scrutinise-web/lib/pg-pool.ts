/**
 * pg-pool.ts — Thin pg Pool wrapper accessible from scripts.
 * Exports raw pg Pool connections for Railway and Neon.
 * Used by transfer and diagnostic scripts that need direct pg access.
 */
import { Pool } from 'pg'

let _railwayPool: Pool | undefined
let _neonPool: Pool | undefined

export function getRailwayPool(): Pool {
  if (!_railwayPool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL not set')
    _railwayPool = new Pool({
      connectionString: url,
      ssl: url.includes('railway') || url.includes('rlwy')
        ? { rejectUnauthorized: false }
        : undefined,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
  }
  return _railwayPool
}

export function getNeonPool(): Pool {
  if (!_neonPool) {
    const url = process.env.NEON_DATABASE_URL
    if (!url) throw new Error('NEON_DATABASE_URL not set')
    _neonPool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    })
  }
  return _neonPool
}

export async function endPools() {
  if (_railwayPool) { await _railwayPool.end(); _railwayPool = undefined }
  if (_neonPool)    { await _neonPool.end();    _neonPool    = undefined }
}
