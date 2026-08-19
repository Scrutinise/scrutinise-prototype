/**
 * build-position-estimates.ts — GRAPH 3A §4. Aggregate the signal layer into `position_estimate`.
 *
 * Re-runnable, truncate-and-rebuild. Design §2 makes that safe: no fact lives only in an estimate,
 * so the whole table can be dropped and rebuilt from signals plus a config version at any time.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHERE THE ARITHMETIC LIVES, AND WHY IT IS NOT IN THIS FILE
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * In `scrutinise-web/lib/graph/position-math.ts`, because the read API has to do the SAME
 * arithmetic across the several targets a search returns, and two implementations of one formula
 * drift silently — both halves keep returning plausible numbers and nothing says which is right.
 * One function, two callers, one set of checks (`check-3a.ts`).
 *
 * ⚠ DECAY IS MEASURED AGAINST AN AS-AT DATE, so "which numbers produced this table" is
 * (config_version, as_of), not config_version alone. Both go into `position_estimate_meta`. A
 * rebuild tomorrow with identical config legitimately produces different estimates, and without
 * that row nothing would say so.
 *
 * Usage (from scripts/graph):
 *   npx tsx build-position-estimates.ts
 *   npx tsx build-position-estimates.ts --as-of 2026-08-19   # fixed date, for a reproducible run
 *   npx tsx build-position-estimates.ts --dry-run            # aggregate, report, write nothing
 *   npx tsx build-position-estimates.ts --limit-actors 500   # a quick shakedown over few actors
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import { POSITION_CONFIG, configVersion } from '../../scrutinise-web/lib/graph/position-config'
import { aggregate, SignalForMath } from '../../scrutinise-web/lib/graph/position-math'

export {}

const argv = process.argv.slice(2)
const DRY = argv.includes('--dry-run')
const AS_OF = (() => {
  const i = argv.indexOf('--as-of')
  const v = i >= 0 ? argv[i + 1] : undefined
  if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v
  return new Date().toISOString().slice(0, 10)
})()
const LIMIT_ACTORS = (() => {
  const i = argv.indexOf('--limit-actors')
  return i >= 0 ? parseInt(argv[i + 1], 10) : 0
})()

/** How many actors to pull signals for at a time. Sized so a chunk is tens of thousands of rows. */
const ACTOR_CHUNK = 1_500
/** Rows per multi-row INSERT. */
const INSERT_BATCH = 1_000

interface Row {
  actor_id: string
  target_type: string
  target_id: string
  signal_ref: string
  signal_type: string
  direction: number
  derivation: string | null
  raw_weight: number
  observed_at: string
}

async function main() {
  const pool = getNeonPool()
  const cv = configVersion()
  try {
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host}) — refusing`); process.exit(1) }
    console.log(`host ${host}`)
    console.log(`config_version ${cv}   as_of ${AS_OF}   ${DRY ? '(DRY RUN — nothing written)' : ''}`)
    console.log(`confidence saturation ${POSITION_CONFIG.confidenceSaturation}, attention ceiling ${POSITION_CONFIG.attentionConfidenceCeiling}`)

    const { rows: [sz0] } = await pool.query<{ b: string }>(`SELECT pg_database_size(current_database())::text AS b`)

    // Every actor that HAS a signal. An actor with none must end with no row at all — design §6:
    // absence, not zero. Building from this list rather than from graph_entity is what makes that
    // true by construction rather than by a filter somebody could remove.
    const { rows: bounds } = await pool.query<{ lo: string; hi: string; n: string }>(
      `SELECT MIN(actor_id)::text AS lo, MAX(actor_id)::text AS hi, COUNT(DISTINCT actor_id)::text AS n
         FROM position_signal`)
    const lo = Number(bounds[0].lo), hi = Number(bounds[0].hi)
    console.log(`\n${Number(bounds[0].n).toLocaleString()} actors carry at least one signal; actor_id ${lo}…${hi}`)

    if (!DRY) {
      await pool.query(`TRUNCATE position_estimate`)
      console.log(`position_estimate truncated.`)
    }

    const t0 = Date.now()
    let signalsSeen = 0
    let estimatesWritten = 0
    let actorsDone = 0
    let pending: unknown[][] = []

    for (let a = lo; a <= hi; a += ACTOR_CHUNK) {
      const b = Math.min(a + ACTOR_CHUNK - 1, hi)
      const { rows } = await pool.query<Row>(`
        SELECT actor_id::text, target_type, target_id, signal_ref, signal_type,
               direction, derivation, raw_weight, observed_at::text
          FROM position_signal
         WHERE actor_id BETWEEN $1 AND $2
         ORDER BY actor_id, target_type, target_id`, [a, b])
      if (!rows.length) continue
      signalsSeen += rows.length

      // Group consecutive rows by (actor, target_type, target_id) — the ORDER BY above guarantees
      // they arrive together, so this needs no map and no memory beyond one group.
      let i = 0
      const seenActors = new Set<string>()
      while (i < rows.length) {
        const head = rows[i]
        const group: SignalForMath[] = []
        while (
          i < rows.length &&
          rows[i].actor_id === head.actor_id &&
          rows[i].target_type === head.target_type &&
          rows[i].target_id === head.target_id
        ) {
          const r = rows[i]
          group.push({
            id: r.signal_ref,
            signalType: r.signal_type as SignalForMath['signalType'],
            derivation: r.derivation,
            direction: r.direction,
            rawWeight: r.raw_weight,
            observedAt: r.observed_at,
          })
          i++
        }
        seenActors.add(head.actor_id)
        const agg = aggregate(group, AS_OF, POSITION_CONFIG)
        pending.push([
          head.actor_id, head.target_type, head.target_id,
          agg.stanceScore, agg.confidence, JSON.stringify(agg.signalCounts), cv,
        ])
        estimatesWritten++
        if (pending.length >= INSERT_BATCH) { if (!DRY) await flush(pool, pending); pending = [] }
      }
      actorsDone += seenActors.size
      if (LIMIT_ACTORS && actorsDone >= LIMIT_ACTORS) { console.log(`--limit-actors ${LIMIT_ACTORS} reached`); break }
      if (actorsDone % 15_000 < ACTOR_CHUNK) {
        const rate = signalsSeen / Math.max(1, (Date.now() - t0) / 1000)
        console.log(`  … ${actorsDone.toLocaleString()} actors, ${signalsSeen.toLocaleString()} signals, ${estimatesWritten.toLocaleString()} estimates, ${Math.round(rate).toLocaleString()}/s`)
      }
    }
    if (pending.length && !DRY) await flush(pool, pending)

    const elapsed = Date.now() - t0
    console.log(`\n════ BUILT ════  ${(elapsed / 1000).toFixed(1)}s`)
    console.log(`  signals read       ${signalsSeen.toLocaleString()}`)
    console.log(`  estimates produced ${estimatesWritten.toLocaleString()}`)

    if (DRY) { console.log('\n--dry-run: nothing written.'); return }

    await pool.query(
      `INSERT INTO position_estimate_meta (config_version, as_of, n_estimates, n_signals, elapsed_ms)
       VALUES ($1, $2, $3, $4, $5)`, [cv, AS_OF, estimatesWritten, signalsSeen, elapsed])

    // Read back. A rowCount says what the driver thought it sent.
    console.log(`\n════ READ BACK ════`)
    const { rows: byType } = await pool.query<{ target_type: string; n: string; mean_conf: string; mean_abs: string }>(`
      SELECT target_type, COUNT(*)::text AS n,
             ROUND(AVG(confidence)::numeric, 3)::text AS mean_conf,
             ROUND(AVG(ABS(stance_score))::numeric, 3)::text AS mean_abs
        FROM position_estimate GROUP BY 1 ORDER BY 2::bigint DESC`)
    for (const r of byType) {
      console.log(`  ${r.target_type.padEnd(14)} ${Number(r.n).toLocaleString().padStart(11)}  mean confidence ${r.mean_conf}  mean |stance| ${r.mean_abs}`)
    }

    const { rows: [ver] } = await pool.query<{ n: string; versions: string }>(
      `SELECT COUNT(DISTINCT config_version)::text AS n,
              STRING_AGG(DISTINCT config_version, ', ') AS versions FROM position_estimate`)
    console.log(`\n  config_version on the table: ${ver.versions} (${ver.n} distinct — more than one means a partial rebuild)`)

    const { rows: [ceil] } = await pool.query<{ n: string; over: string }>(`
      SELECT COUNT(*)::text AS n,
             COUNT(*) FILTER (WHERE confidence > ${POSITION_CONFIG.attentionConfidenceCeiling} + 1e-6)::text AS over
        FROM position_estimate
       WHERE NOT (signal_counts ?| ARRAY['vote','edm_signature'])`)
    console.log(`  attention-only estimates: ${Number(ceil.n).toLocaleString()}; of those, ${ceil.over} exceed the ${POSITION_CONFIG.attentionConfidenceCeiling} ceiling` +
      (Number(ceil.over) === 0 ? '  ✓' : '  ❌'))

    const { rows: [sz1] } = await pool.query<{ b: string }>(`SELECT pg_database_size(current_database())::text AS b`)
    const { rows: [tsz] } = await pool.query<{ s: string; bytes: string }>(
      `SELECT pg_size_pretty(pg_total_relation_size('position_estimate')) AS s,
              pg_total_relation_size('position_estimate')::text AS bytes`)
    console.log(`\n════ WHAT IT COST ════`)
    console.log(`  position_estimate   ${tsz.s}  (${(Number(tsz.bytes) / estimatesWritten).toFixed(1)} bytes/row)`)
    console.log(`  database            ${(Number(sz0.b) / 1024 ** 3).toFixed(2)} → ${(Number(sz1.b) / 1024 ** 3).toFixed(2)} GiB`)
    console.log(`  ops ALERT line      17.5 GiB — now ${((100 * Number(sz1.b)) / (17.5 * 1024 ** 3)).toFixed(1)}% of it`)
  } finally {
    await endNeonPool()
  }
}

async function flush(pool: ReturnType<typeof getNeonPool>, rows: unknown[][]) {
  const cols = 7
  const values: unknown[] = []
  const tuples: string[] = []
  rows.forEach((r, i) => {
    tuples.push(`($${i * cols + 1},$${i * cols + 2},$${i * cols + 3},$${i * cols + 4},$${i * cols + 5},$${i * cols + 6}::jsonb,$${i * cols + 7})`)
    values.push(...r)
  })
  await pool.query(
    `INSERT INTO position_estimate
       (actor_id, target_type, target_id, stance_score, confidence, signal_counts, config_version)
     VALUES ${tuples.join(',')}
     ON CONFLICT (actor_id, target_type, target_id) DO UPDATE
       SET stance_score = EXCLUDED.stance_score, confidence = EXCLUDED.confidence,
           signal_counts = EXCLUDED.signal_counts, config_version = EXCLUDED.config_version,
           computed_at = now()`, values)
}

if (require.main === module) {
  main().catch((e) => { console.error('[build-position-estimates] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
}
