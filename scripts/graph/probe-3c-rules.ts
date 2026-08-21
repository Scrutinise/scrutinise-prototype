/**
 * probe-3c-rules.ts — GRAPH 3C §2. Score candidate free-vote rules BEFORE adopting one.
 *
 * Brief §2: *"report which divisions the revised rule tags — the classic free votes must be in that
 * list, and the whipped Northern Ireland abortion regulations must not be."* That is a scorable
 * requirement, so it is scored here, against every candidate, rather than argued for one.
 *
 * ⚠ Nothing here writes. Every candidate is evaluated as a query over the party table that already
 * exists, so the comparison costs no rebuild and no risk.
 *
 * THE CANDIDATES
 *   R0  today  · free ⇔ MAX(cohesion) over whipped parties < T
 *   R1         · free ⇔ the LARGEST whipped party (by voters in THIS division) has cohesion < T
 *   R2  R0 + bill propagation (a majority of the bill's divisions free ⇒ all of them free)
 *   R3  R1 + bill propagation
 *
 * Usage (from scripts/graph):  npx tsx probe-3c-rules.ts
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../ingest/shared/neon-pool'
import { POSITION_CONFIG } from '../../scrutinise-web/lib/graph/position-config'

export {}

const T = POSITION_CONFIG.cohesionThreshold

/**
 * One SQL expression per candidate, over a CTE that holds, per division:
 *   best   — MAX cohesion among whipped parties (3A's rule)
 *   lead   — cohesion of the whipped party with the most voters in that division
 */
const BASE = `
  WITH pd AS (
    SELECT p.house, p.division_id, p.party, p.cohesion, (p.ayes + p.noes) AS voters
      FROM position_division_party p
     WHERE p.is_whipped_party
  ),
  per_div AS (
    SELECT d.house, d.division_id, d.bill_title,
           COALESCE(MAX(pd.cohesion), 0) AS best,
           COALESCE((ARRAY_AGG(pd.cohesion ORDER BY pd.voters DESC, pd.party))[1], 0) AS lead,
           COUNT(pd.party)::int AS n_whipped
      FROM divisions d
      LEFT JOIN pd ON pd.house = d.house AND pd.division_id = d.division_id
     GROUP BY 1, 2, 3
  ),
  base AS (
    SELECT house, division_id, bill_title,
           (best < ${T}) AS r0,
           (lead < ${T}) AS r1,
           best, lead, n_whipped
      FROM per_div
  ),
  billroll AS (
    SELECT bill_title,
           COUNT(*)::int                                  AS n,
           COUNT(*) FILTER (WHERE r0)::int                AS free0,
           COUNT(*) FILTER (WHERE r1)::int                AS free1
      FROM base WHERE bill_title IS NOT NULL AND bill_title <> ''
     GROUP BY 1
  ),
  ruled AS (
    SELECT b.house, b.division_id, b.bill_title, b.best, b.lead, b.n_whipped,
           b.r0,
           b.r1,
           (b.r0 OR COALESCE(br.free0::real / NULLIF(br.n, 0) >= 0.5, FALSE)) AS r2,
           (b.r1 OR COALESCE(br.free1::real / NULLIF(br.n, 0) >= 0.5, FALSE)) AS r3
      FROM base b LEFT JOIN billroll br ON br.bill_title = b.bill_title
  )`

interface Case { label: string; predicate: string; expect: 'FREE' | 'WHIPPED' }

/**
 * The named cases. `expect` is written from the public record, not from what any rule produces —
 * a test case chosen because a rule passes it is not a test case.
 */
const CASES: Case[] = [
  { label: 'Terminally Ill Adults (End of Life) Bill', expect: 'FREE',
    predicate: `d.bill_title = 'Terminally Ill Adults (End of Life) Bill'` },
  { label: 'Assisted Dying Bill [HL] / for the Terminally Ill', expect: 'FREE',
    predicate: `d.title ILIKE '%assisted dying%'` },
  { label: 'Hunting', expect: 'FREE',
    predicate: `d.title ILIKE '%hunting%'` },
  { label: '⛔ Abortion (Northern Ireland) Regulations — WHIPPED', expect: 'WHIPPED',
    predicate: `d.title ILIKE '%abortion (northern ireland)%'` },
  { label: '⛔ Universal Credit and PIP Bill — WHIPPED (3A hand-checked)', expect: 'WHIPPED',
    predicate: `d.title ILIKE '%universal credit%' AND d.title ILIKE '%personal independence%'` },
  { label: '⛔ Safety of Rwanda — WHIPPED', expect: 'WHIPPED',
    predicate: `d.title ILIKE '%rwanda%' OR d.bill_title ILIKE '%rwanda%'` },
]

async function main() {
  const pool = getNeonPool()
  try {
    const host = /@([^/:?]+)/.exec(process.env.NEON_DATABASE_URL ?? '')?.[1] ?? '(unparsed)'
    if (!/ep-old-dust-aboxi69a/.test(host)) { console.error(`❌ not Neon production (${host})`); process.exit(1) }
    console.log(`host ${host}   cohesion threshold T = ${T}`)

    // ── 1 · how wide is each rule, over all 5,645 divisions ──────────────────────────────────
    console.log(`\n════ 1 · BREADTH — divisions tagged free-vote-like, of 5,645 ════`)
    const { rows: [w] } = await pool.query<Record<string, string>>(`${BASE}
      SELECT COUNT(*) FILTER (WHERE r0)::text AS r0,
             COUNT(*) FILTER (WHERE r1)::text AS r1,
             COUNT(*) FILTER (WHERE r2)::text AS r2,
             COUNT(*) FILTER (WHERE r3)::text AS r3,
             COUNT(*)::text AS total
        FROM ruled`)
    for (const k of ['r0', 'r1', 'r2', 'r3']) {
      console.log(`  ${k.toUpperCase()}  ${Number(w[k]).toLocaleString().padStart(6)}   ${((100 * Number(w[k])) / Number(w.total)).toFixed(2)}%`)
    }

    // ── 2 · the named cases ──────────────────────────────────────────────────────────────────
    console.log(`\n════ 2 · THE NAMED CASES — every candidate scored against the public record ════`)
    console.log(`  ${'case'.padEnd(52)} ${'n'.padStart(4)}  ${'R0'.padStart(8)} ${'R1'.padStart(8)} ${'R2'.padStart(8)} ${'R3'.padStart(8)}`)
    const score: Record<string, number> = { r0: 0, r1: 0, r2: 0, r3: 0 }
    for (const c of CASES) {
      const { rows: [r] } = await pool.query<Record<string, string>>(`${BASE}
        SELECT COUNT(*)::text AS n,
               COUNT(*) FILTER (WHERE u.r0)::text AS r0,
               COUNT(*) FILTER (WHERE u.r1)::text AS r1,
               COUNT(*) FILTER (WHERE u.r2)::text AS r2,
               COUNT(*) FILTER (WHERE u.r3)::text AS r3
          FROM ruled u JOIN divisions d ON d.house = u.house AND d.division_id = u.division_id
         WHERE ${c.predicate}`)
      const n = Number(r.n)
      const cell = (k: string) => {
        const hit = Number(r[k])
        // FREE wants all of them tagged; WHIPPED wants none of them tagged.
        const good = c.expect === 'FREE' ? hit === n : hit === 0
        if (good) score[k]++
        return `${good ? '✓' : '✗'}${String(hit).padStart(3)}/${String(n).padEnd(3)}`
      }
      console.log(`  ${c.label.padEnd(52)} ${String(n).padStart(4)}  ${cell('r0').padStart(8)} ${cell('r1').padStart(8)} ${cell('r2').padStart(8)} ${cell('r3').padStart(8)}`)
    }
    console.log(`  ${'SCORE (cases fully correct, of ' + CASES.length + ')'.padEnd(0)}`.padEnd(55) +
      ` ${''.padStart(4)}  ${String(score.r0).padStart(8)} ${String(score.r1).padStart(8)} ${String(score.r2).padStart(8)} ${String(score.r3).padStart(8)}`)

    // ── 3 · exactly which divisions R3 adds over R0 ──────────────────────────────────────────
    console.log(`\n════ 3 · EVERY DIVISION R3 TAGS THAT R0 DOES NOT — the whole list, not a sample ════`)
    const { rows: added } = await pool.query<{
      house: string; division_id: number; division_date: string; title: string
      best: string; lead: string; via: string }>(`${BASE}
      SELECT u.house, u.division_id, d.division_date::text AS division_date, left(d.title, 62) AS title,
             ROUND(u.best::numeric, 4)::text AS best, ROUND(u.lead::numeric, 4)::text AS lead,
             CASE WHEN u.r1 THEN 'largest-party' ELSE 'bill-propagated' END AS via
        FROM ruled u JOIN divisions d ON d.house = u.house AND d.division_id = u.division_id
       WHERE u.r3 AND NOT u.r0
       ORDER BY d.division_date`)
    console.log(`  ${added.length} divisions added`)
    for (const r of added) {
      console.log(`  ${r.division_date}  ${r.house}:${String(r.division_id).padEnd(5)} best ${r.best.padStart(6)} lead ${r.lead.padStart(6)}  ${r.via.padEnd(15)} ${r.title}`)
    }

    // ── 4 · the rebellion floor: how many rebellion signals rest on a party that did not hold ──
    console.log(`\n════ 4 · THE REBELLION FLOOR — minority-side votes by their OWN party's cohesion ════`)
    console.log(`  (rows counted only where the division is NOT free-vote-like under R0, i.e. rebellion:v1 fires today)`)
    for (const floor of [0.70, 0.75, 0.80, 0.85, 0.90]) {
      const { rows: [r] } = await pool.query<{ below: string; above: string }>(`${BASE}
        SELECT SUM(LEAST(p.ayes, p.noes)) FILTER (WHERE p.cohesion <  ${floor})::text AS below,
               SUM(LEAST(p.ayes, p.noes)) FILTER (WHERE p.cohesion >= ${floor})::text AS above
          FROM position_division_party p
          JOIN ruled u ON u.house = p.house AND u.division_id = p.division_id
         WHERE p.is_whipped_party AND NOT u.r0`)
      console.log(`    floor ${floor.toFixed(2)}   ${Number(r.below).toLocaleString().padStart(8)} votes lose rebellion:v1   ${Number(r.above).toLocaleString().padStart(8)} keep it`)
    }

    // ── 5 · the control the floor must not break: real rebellions against a real whip ─────────
    console.log(`\n════ 5 · THE CONTROL — famous rebellions must SURVIVE the floor ════`)
    const controls: Array<[string, string]> = [
      ['Universal Credit and PIP Bill', `d.title ILIKE '%universal credit%'`],
      ['Safety of Rwanda / Illegal Migration', `d.bill_title ILIKE '%rwanda%' OR d.bill_title ILIKE '%illegal migration%'`],
      ['European Union (Withdrawal)', `d.bill_title ILIKE '%european union (withdrawal)%'`],
    ]
    for (const [label, pred] of controls) {
      const { rows: [r] } = await pool.query<{ n: string; minority: string; kept80: string; kept85: string }>(`${BASE}
        SELECT COUNT(DISTINCT (p.house, p.division_id))::text AS n,
               COALESCE(SUM(LEAST(p.ayes, p.noes)), 0)::text AS minority,
               COALESCE(SUM(LEAST(p.ayes, p.noes)) FILTER (WHERE p.cohesion >= 0.80), 0)::text AS kept80,
               COALESCE(SUM(LEAST(p.ayes, p.noes)) FILTER (WHERE p.cohesion >= 0.85), 0)::text AS kept85
          FROM position_division_party p
          JOIN ruled u ON u.house = p.house AND u.division_id = p.division_id
          JOIN divisions d ON d.house = p.house AND d.division_id = p.division_id
         WHERE p.is_whipped_party AND NOT u.r3 AND (${pred})`)
      console.log(`  ${label.padEnd(38)} ${String(r.n).padStart(4)} divisions still whipped under R3, ` +
        `${Number(r.minority).toLocaleString().padStart(6)} minority votes → ${Number(r.kept80).toLocaleString()} kept at floor 0.80, ${Number(r.kept85).toLocaleString()} at 0.85`)
    }
  } finally {
    await endNeonPool()
  }
}

main().catch((e) => { console.error('[probe-3c-rules] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
