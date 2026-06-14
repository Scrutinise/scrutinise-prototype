/**
 * v24-verify-breaker.ts — proves the V24 zero-output trip query behaves correctly
 * against the scenarios the brief names. Uses a SESSION-LOCAL temp table so
 * production ingest_queue is never touched.
 *
 * Cases:
 *  A. tna-legislation idempotent reseed: 40 done rows, all produced_output=true
 *     (r2Exists confirmations) → MUST NOT trip. (the V23 false-positive)
 *  B. committees-api: 30 list/item rows produced_output=true → MUST NOT trip.
 *  C. committees-document curl-broken: 30 done rows produced_output=false → TRIP.
 *  D. recovery: 30 empty then 1 produced_output=true (most recent) → trailing
 *     streak resets → MUST NOT trip.
 *  E. legacy rows (produced_output NULL) are ignored entirely.
 */
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const ZERO_OUTPUT_THRESHOLD = 25

async function main() {
  const pool = getNeonPool()
  const c = await pool.connect()
  try {
    await c.query('BEGIN')
    await c.query(`CREATE TEMP TABLE q (
      id text, "sourceType" text, status text, produced_output boolean, "completedAt" timestamptz
    ) ON COMMIT DROP`)

    const ins = async (st: string, n: number, produced: boolean | null, baseMin: number) => {
      for (let i = 0; i < n; i++) {
        await c.query(
          `INSERT INTO q VALUES ($1,$2,'done',$3, NOW() - ($4 || ' minutes')::interval)`,
          [`${st}-${i}`, st, produced, baseMin - i] // higher i = older
        )
      }
    }
    // A: all confirmed reseeds
    await ins('tna-legislation', 40, true, 100)
    // B: structural+item all produced
    await ins('committees-api', 30, true, 100)
    // C: curl-broken, all empty
    await ins('committees-document', 30, false, 100)
    // D: 30 empty (older) + 1 produced (newest)
    await ins('recovered', 30, false, 100)
    await c.query(`INSERT INTO q VALUES ('recovered-new','recovered','done',true, NOW())`)
    // E: legacy nulls only
    await ins('legacy-null', 50, null, 100)

    const res = await c.query<{ sourceType: string; trailing_empty: string }>(`
      WITH ranked AS (
        SELECT "sourceType", produced_output,
               ROW_NUMBER() OVER (PARTITION BY "sourceType" ORDER BY "completedAt" DESC, id DESC) AS rn
        FROM q
        WHERE status='done' AND produced_output IS NOT NULL
          AND "completedAt" > NOW() - INTERVAL '24 hours'
      ),
      agg AS (
        SELECT "sourceType",
               MIN(rn) FILTER (WHERE produced_output = true) AS first_true,
               COUNT(*) AS considered
        FROM ranked GROUP BY "sourceType"
      )
      SELECT "sourceType", COALESCE(first_true - 1, considered)::text AS trailing_empty FROM agg
      ORDER BY "sourceType"`)

    const streak = new Map(res.rows.map(r => [r.sourceType, parseInt(r.trailing_empty, 10)]))
    const trips = (s: string) => (streak.get(s) ?? 0) >= ZERO_OUTPUT_THRESHOLD

    const expect: Array<[string, boolean]> = [
      ['tna-legislation', false],
      ['committees-api', false],
      ['committees-document', true],
      ['recovered', false],
      ['legacy-null', false], // absent from result set entirely
    ]
    let ok = true
    for (const [s, shouldTrip] of expect) {
      const got = trips(s)
      const pass = got === shouldTrip
      ok = ok && pass
      console.log(`${pass ? 'PASS' : 'FAIL'}  ${s.padEnd(20)} trailing_empty=${streak.get(s) ?? '(none)'} trips=${got} expected=${shouldTrip}`)
    }
    await c.query('ROLLBACK')
    console.log(ok ? '\nALL PASS' : '\nFAILURES PRESENT')
    process.exitCode = ok ? 0 : 1
  } finally {
    c.release()
    await endNeonPool()
  }
}
main().catch(e => { console.error(e); process.exit(1) })
