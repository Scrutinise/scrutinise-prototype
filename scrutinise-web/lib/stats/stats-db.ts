// ─────────────────────────────────────────────────────────────────────────────
// Connection to the STATISTICS database (the `scrutinise-stats` Neon project) —
// a different database from the app/corpus one, reached with its own env var.
//
// Why raw `pg` and not Prisma: the stats schema's generated Prisma client lives at
// scripts/stats/generated/ which is GITIGNORED and outside the Vercel build root,
// so the web app cannot import the script-side read layer at build time. `pg` is
// already a direct dependency here (the Prisma adapter uses it), so this adds no
// new dependency and no second client to generate. The SQL below mirrors
// scripts/stats/query/stats-query.ts — see the sync note there.
//
// Read-only by construction: every statement this module issues is a SELECT, and
// the pool sets a short statement_timeout so a slow analytical query can never
// hold a Lex turn open (the FTS 25s-timeout incident, CHANGE_LOG 2026-08-01).
// ─────────────────────────────────────────────────────────────────────────────

import { Pool } from 'pg'

const STATEMENT_TIMEOUT_MS = parseInt(process.env.STATS_STATEMENT_TIMEOUT_MS ?? '5000', 10)

const globalForStats = globalThis as unknown as { statsPool: Pool | undefined }

/** True when the stats DB is configured for this environment. Callers degrade
 *  gracefully rather than throwing — a missing stats DB must never break a Lex turn. */
export function statsConfigured(): boolean {
  return !!process.env.STATS_DATABASE_URL
}

function getPool(): Pool {
  if (globalForStats.statsPool) return globalForStats.statsPool
  const connectionString = process.env.STATS_DATABASE_URL
  if (!connectionString) {
    // Deliberately explicit: never fall back to DATABASE_URL. Pointing stats queries
    // at the corpus DB is the exact class of mistake docs/CLAUDE.md §16 exists to stop.
    throw new Error('STATS_DATABASE_URL not set — refusing to guess (see docs/STATS_SCHEMA.md).')
  }
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: parseInt(process.env.STATS_POOL_MAX ?? '3', 10),
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 8_000,
    statement_timeout: STATEMENT_TIMEOUT_MS,
  })
  pool.on('error', (err) => console.error('[stats-db] idle client error:', err.message))
  if (process.env.NODE_ENV !== 'production') globalForStats.statsPool = pool
  return pool
}

/** Run one read-only query against the stats DB. */
export async function statsQuery<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { rows } = await getPool().query(sql, params)
  return rows as T[]
}

/** Connectivity + shape check used by the health route (and worth running after any
 *  env change): proves the app can reach the stats DB and that it holds real rows. */
export async function statsHealth(): Promise<{
  ok: boolean
  host: string | null
  /** The Postgres role the app actually connected as, and whether it can write.
   *  Reported because "Lex structurally cannot write to the stats DB" is a claim that
   *  should be checkable from production, not taken on trust — a connection string can
   *  be swapped back to an owner role by accident at any time. */
  role: string | null
  canWrite: boolean | null
  datasets: number
  series: number
  observations: number
  latestRefresh: string | null
  error?: string
}> {
  const host = process.env.STATS_DATABASE_URL
    ? new URL(process.env.STATS_DATABASE_URL).hostname
    : null
  try {
    const [counts] = await statsQuery<{
      datasets: string; series: string; observations: string; latest: Date | null
      role: string; can_write: boolean
    }>(`
      SELECT (SELECT count(*) FROM stat_dataset)     AS datasets,
             (SELECT count(*) FROM stat_series)      AS series,
             (SELECT count(*) FROM stat_observation) AS observations,
             (SELECT max("lastRefreshedAt") FROM stat_dataset) AS latest,
             current_user AS role,
             has_table_privilege(current_user, 'stat_observation', 'INSERT') AS can_write
    `)
    return {
      ok: true,
      host,
      role: counts.role,
      canWrite: counts.can_write,
      datasets: Number(counts.datasets),
      series: Number(counts.series),
      observations: Number(counts.observations),
      latestRefresh: counts.latest ? new Date(counts.latest).toISOString() : null,
    }
  } catch (err) {
    return {
      ok: false, host, role: null, canWrite: null, datasets: 0, series: 0, observations: 0, latestRefresh: null,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
