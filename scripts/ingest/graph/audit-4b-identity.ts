/**
 * audit-4b-identity.ts — GRAPH 4B §1. What the identity bridge changes.
 *
 * Reads only. Nothing is written to either graph table.
 *
 * Answers, in order:
 *   1. Today's join, on a set of known pre-1963 Acts: how many rows are dropped.
 *   2. The bridged join: how many are recovered, and whether the number is
 *      CORRECT (it must equal the count under the other table's own id form —
 *      a bridge that recovers a different number has invented rows).
 *   3. The corpus-wide residual: forms in either table that the bridge cannot
 *      resolve, BY CAUSE, counted rather than guessed at.
 *   4. GRAPH 4A §6 re-answered with the bridge in place: what changes about the
 *      98.1% overlap, and what retiring the superseded `cites` rows would take.
 *
 *   npx tsx graph/audit-4b-identity.ts [--json <path>]
 */
import fs from 'fs'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { EDGE_TABLE } from './graph-common'
import { IDENTITY_TABLE, loadIdentityBridge, isRegnalForm } from './identity'

/** Acts named in GRAPH 4A §6's worked examples, plus the three the brief's
 *  §1 check needs. Chosen BEFORE the measurement, from 4A's table. */
export const KNOWN_PRE_1963: Array<{ regnal: string; calendar: string; name: string }> = [
  { regnal: 'ukpga/Eliz2/9-10/33',      calendar: 'ukpga/1961/33', name: 'Factories Act 1961' },
  { regnal: 'ukpga/Geo6/12-13-14/54',   calendar: 'ukpga/1949/54', name: 'Coast Protection Act 1949' },
  { regnal: 'ukpga/Geo5and1Edw8/26/49', calendar: 'ukpga/1936/49', name: 'Public Health Act 1936' },
]

async function n(sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await getNeonPool().query(sql, params)
  return Number(rows[0].n)
}

export type IdentityAudit = {
  measuredAt: string
  bridge: ReturnType<typeof loadIdentityBridge>['stats']
  /** per-Act: rows in legislation_edges under each form, and via the bridge */
  worked: Array<{
    name: string; regnal: string; calendar: string
    underRegnal: number; underCalendar: number; viaBridge: number
    /** ⚠ the `cites` edge type ALONE — the total-disagreement case. Every
     *  `cites` row keeps the URI's calendar form, so asking in citation_edge's
     *  own regnal form returns ZERO and reads as an honest absence. */
    citesUnderRegnal: number; citesUnderCalendar: number; citesViaBridge: number
    dropped: number; correct: boolean
  }>
  /** corpus-wide identity-form census in both tables */
  forms: {
    citationRegnalRows: number; citationRegnalTargets: number
    edgesRegnalCitesRows: number
    edgesRegnalAnyTypeRows: number
    citationTargetsBridgeable: number
    citationTargetsUnbridged: number
    citationTargetsAmbiguous: number
  }
  /** ⚠ the count the brief asks for: joins previously dropped, now resolved */
  droppedJoinsResolved: {
    citationRowsWhoseTargetOnlyMatchesUnderTheBridge: number
    distinctTargetsRecovered: number
  }
  /** GRAPH 4A §6, re-answered */
  overlap: {
    citesPairs: number; citationPairs: number
    inBothRaw: number; onlyEdgesRaw: number
    inBothBridged: number; onlyEdgesBridged: number
    recoveredByBridge: number
  }
}

async function main() {
  const bridge = loadIdentityBridge()
  const pool = getNeonPool()

  const hasTable = Number((await pool.query(
    `SELECT COUNT(*)::int n FROM information_schema.tables WHERE table_name = $1`, [IDENTITY_TABLE])).rows[0].n) > 0
  if (!hasTable) {
    console.log(`⚠ ${IDENTITY_TABLE} does not exist — run graph/setup-identity-table.ts first.`)
    console.log('  Every "viaBridge" and "Bridged" figure below would be a join against nothing.')
    await endNeonPool(); process.exit(2)
  }

  // ── 1 + 2: the worked examples ───────────────────────────────────────────────
  const worked: IdentityAudit['worked'] = []
  for (const a of KNOWN_PRE_1963) {
    const underRegnal = await n(
      `SELECT COUNT(*)::bigint n FROM ${EDGE_TABLE} WHERE split_part(to_id, ':', 2) = $1`, [a.regnal])
    const underCalendar = await n(
      `SELECT COUNT(*)::bigint n FROM ${EDGE_TABLE} WHERE split_part(to_id, ':', 2) = $1`, [a.calendar])
    // the bridged join: ask in citation_edge's OWN form and let the table translate
    const viaBridge = await n(`
      SELECT COUNT(*)::bigint n
      FROM ${EDGE_TABLE} e
      LEFT JOIN ${IDENTITY_TABLE} li ON li.form = split_part(e.to_id, ':', 2)
      WHERE COALESCE(li.canonical, split_part(e.to_id, ':', 2)) = $1`, [a.regnal])
    const citesUnderRegnal = await n(
      `SELECT COUNT(*)::bigint n FROM ${EDGE_TABLE} WHERE edge_type = 'cites' AND split_part(to_id, ':', 2) = $1`, [a.regnal])
    const citesUnderCalendar = await n(
      `SELECT COUNT(*)::bigint n FROM ${EDGE_TABLE} WHERE edge_type = 'cites' AND split_part(to_id, ':', 2) = $1`, [a.calendar])
    const citesViaBridge = await n(`
      SELECT COUNT(*)::bigint n
      FROM ${EDGE_TABLE} e
      LEFT JOIN ${IDENTITY_TABLE} li ON li.form = split_part(e.to_id, ':', 2)
      WHERE e.edge_type = 'cites' AND COALESCE(li.canonical, split_part(e.to_id, ':', 2)) = $1`, [a.regnal])
    worked.push({
      ...a, underRegnal, underCalendar, viaBridge,
      citesUnderRegnal, citesUnderCalendar, citesViaBridge,
      dropped: citesUnderCalendar - citesUnderRegnal,
      correct: viaBridge === underCalendar + underRegnal && citesViaBridge === citesUnderCalendar,
    })
  }

  // ── 3: the corpus-wide form census ──────────────────────────────────────────
  const citationRegnalRows = await n(
    `SELECT COUNT(*)::bigint n FROM ${CITATION_TABLE} WHERE target_act_id ~ '^[a-z]+/[A-Z]'`)
  const citationRegnalTargets = await n(
    `SELECT COUNT(DISTINCT target_act_id)::bigint n FROM ${CITATION_TABLE} WHERE target_act_id ~ '^[a-z]+/[A-Z]'`)
  const edgesRegnalCitesRows = await n(
    `SELECT COUNT(*)::bigint n FROM ${EDGE_TABLE} WHERE edge_type = 'cites' AND split_part(to_id, ':', 2) ~ '^[a-z]+/[A-Z]'`)
  const edgesRegnalAnyTypeRows = await n(
    `SELECT COUNT(*)::bigint n FROM ${EDGE_TABLE} WHERE split_part(to_id, ':', 2) ~ '^[a-z]+/[A-Z]'`)

  const { rows: targetRows } = await pool.query(
    `SELECT DISTINCT target_act_id gid FROM ${CITATION_TABLE} WHERE target_act_id IS NOT NULL`)
  let bridgeable = 0, unbridged = 0, ambiguousSeen = 0
  for (const r of targetRows) {
    const gid = r.gid as string
    if (bridge.isAmbiguous(gid)) { ambiguousSeen++; continue }
    if (bridge.formsOf(gid).length > 1) bridgeable++
    else if (isRegnalForm(gid)) unbridged++
  }

  // ── the count the brief asks for ────────────────────────────────────────────
  // citation_edge rows whose target matches legislation_edges ONLY once the id
  // is bridged — i.e. joins that today return nothing and look like an absence.
  const droppedRows = await n(`
    WITH edge_targets AS (
      SELECT DISTINCT split_part(to_id, ':', 2) AS gid FROM ${EDGE_TABLE}
    )
    SELECT COUNT(*)::bigint n
    FROM ${CITATION_TABLE} c
    LEFT JOIN ${IDENTITY_TABLE} li ON li.canonical = c.target_act_id
    WHERE c.target_act_id NOT IN (SELECT gid FROM edge_targets)
      AND li.form IN (SELECT gid FROM edge_targets)`)
  const droppedTargets = await n(`
    WITH edge_targets AS (
      SELECT DISTINCT split_part(to_id, ':', 2) AS gid FROM ${EDGE_TABLE}
    )
    SELECT COUNT(DISTINCT c.target_act_id)::bigint n
    FROM ${CITATION_TABLE} c
    LEFT JOIN ${IDENTITY_TABLE} li ON li.canonical = c.target_act_id
    WHERE c.target_act_id NOT IN (SELECT gid FROM edge_targets)
      AND li.form IN (SELECT gid FROM edge_targets)`)

  // ── 4: GRAPH 4A §6, re-answered with the bridge ─────────────────────────────
  const CITES_PAIRS = `
    SELECT DISTINCT split_part(from_id, ':', 2) AS s, split_part(to_id, ':', 2) AS t
    FROM ${EDGE_TABLE} WHERE edge_type = 'cites'`
  const CIT_PAIRS = `
    SELECT DISTINCT source_gid AS s, target_act_id AS t
    FROM ${CITATION_TABLE} WHERE target_act_id IS NOT NULL`
  const BR = (inner: string, col: string) => `
    SELECT DISTINCT p.s, COALESCE(li.canonical, p.${col}) AS t FROM (${inner}) p
    LEFT JOIN ${IDENTITY_TABLE} li ON li.form = p.${col}`

  const citesPairs = await n(`SELECT COUNT(*)::bigint n FROM (${CITES_PAIRS}) x`)
  const citationPairs = await n(`SELECT COUNT(*)::bigint n FROM (${CIT_PAIRS}) x`)
  const inBothRaw = await n(`SELECT COUNT(*)::bigint n FROM (${CITES_PAIRS}) a JOIN (${CIT_PAIRS}) b USING (s, t)`)
  const onlyEdgesRaw = citesPairs - inBothRaw
  const inBothBridged = await n(
    `SELECT COUNT(*)::bigint n FROM (${BR(CITES_PAIRS, 't')}) a JOIN (${BR(CIT_PAIRS, 't')}) b USING (s, t)`)
  const bridgedCites = await n(`SELECT COUNT(*)::bigint n FROM (${BR(CITES_PAIRS, 't')}) x`)
  const onlyEdgesBridged = bridgedCites - inBothBridged

  const out: IdentityAudit = {
    measuredAt: new Date().toISOString(),
    bridge: bridge.stats,
    worked,
    forms: {
      citationRegnalRows, citationRegnalTargets, edgesRegnalCitesRows, edgesRegnalAnyTypeRows,
      citationTargetsBridgeable: bridgeable,
      citationTargetsUnbridged: unbridged,
      citationTargetsAmbiguous: ambiguousSeen,
    },
    droppedJoinsResolved: {
      citationRowsWhoseTargetOnlyMatchesUnderTheBridge: droppedRows,
      distinctTargetsRecovered: droppedTargets,
    },
    overlap: {
      citesPairs, citationPairs, inBothRaw, onlyEdgesRaw,
      inBothBridged, onlyEdgesBridged,
      recoveredByBridge: onlyEdgesRaw - onlyEdgesBridged,
    },
  }

  console.log('\n══ §1 THE JOIN, TODAY AND BRIDGED ══')
  for (const w of out.worked) {
    console.log(`  ${w.name}`)
    console.log(`    ${w.regnal.padEnd(26)} (citation_edge's form)  → ${String(w.underRegnal).padStart(5)} rows in ${EDGE_TABLE}`)
    console.log(`    ${w.calendar.padEnd(26)} (the URI's own form)   → ${String(w.underCalendar).padStart(5)} rows`)
    console.log(`    via ${IDENTITY_TABLE.padEnd(22)}                      → ${String(w.viaBridge).padStart(5)} rows   ${w.correct ? 'CORRECT' : '⚠ WRONG — recovered a different number'}`)
    console.log(`      cites ONLY — regnal ${String(w.citesUnderRegnal).padStart(4)} (⚠ the join that returns nothing today) · calendar ${String(w.citesUnderCalendar).padStart(4)} · bridged ${String(w.citesViaBridge).padStart(4)}`)
  }
  console.log('\n══ §1 FORM CENSUS ══')
  console.log(`  citation_edge rows with a regnal target: ${citationRegnalRows.toLocaleString()} over ${citationRegnalTargets.toLocaleString()} targets`)
  console.log(`  legislation_edges 'cites' rows with a regnal target: ${edgesRegnalCitesRows.toLocaleString()}`)
  console.log(`  legislation_edges ANY type with a regnal target: ${edgesRegnalAnyTypeRows.toLocaleString()}`)
  console.log(`  citation_edge distinct targets: bridgeable ${bridgeable.toLocaleString()} · unbridged-regnal ${unbridged.toLocaleString()} · ambiguous ${ambiguousSeen.toLocaleString()}`)
  console.log('\n══ §1 DROPPED JOINS NOW RESOLVED ══')
  console.log(`  citation_edge rows whose target matches ${EDGE_TABLE} ONLY under the bridge: ${droppedRows.toLocaleString()}`)
  console.log(`  distinct targets recovered: ${droppedTargets.toLocaleString()}`)
  console.log('\n══ §6 RE-ANSWERED WITH THE BRIDGE ══')
  console.log(`  cites pairs ${citesPairs.toLocaleString()} · citation_edge pairs ${citationPairs.toLocaleString()}`)
  console.log(`  in both, raw ids:     ${inBothRaw.toLocaleString()} (${(100 * inBothRaw / citesPairs).toFixed(1)}% of cites) · only in ${EDGE_TABLE}: ${onlyEdgesRaw.toLocaleString()}`)
  console.log(`  in both, bridged ids: ${inBothBridged.toLocaleString()} (${(100 * inBothBridged / bridgedCites).toFixed(1)}% of cites) · only in ${EDGE_TABLE}: ${onlyEdgesBridged.toLocaleString()}`)
  console.log(`  pairs the bridge moves out of "missing": ${out.overlap.recoveredByBridge.toLocaleString()}`)

  const jsonIx = process.argv.indexOf('--json')
  if (jsonIx >= 0 && process.argv[jsonIx + 1]) {
    fs.writeFileSync(process.argv[jsonIx + 1], JSON.stringify(out, null, 1))
    console.log(`\n[audit-4b-identity] wrote ${process.argv[jsonIx + 1]}`)
  }
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[audit-4b-identity] FATAL', e); process.exit(1) })
}
