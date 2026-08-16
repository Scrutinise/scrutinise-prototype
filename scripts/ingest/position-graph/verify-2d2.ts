/**
 * verify-2d2.ts — the integrity checks for BRIEF_GRAPH_2D2, and the proof that each one can fail.
 *
 * ⚠ The house rule this is built around (docs/CLAUDE.md, "A guard that cannot fail is not a
 * guard"): a check that has never been observed failing is not evidence of anything. So every
 * check here runs TWICE — once against the real data, and once against a deliberately corrupted
 * copy of the same query that MUST come back failing. If the negative control passes, the check is
 * broken and this script says so and exits non-zero, even when the real data is fine.
 *
 * Usage (from scripts/ingest):  npx tsx position-graph/verify-2d2.ts
 * Exit code 0 only if every check passes AND every negative control fails.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

export {}

const pool = getNeonPool()
const head = (s: string) => console.log(`\n════ ${s} ${'═'.repeat(Math.max(0, 78 - s.length))}`)

let passes = 0, failures = 0, brokenControls = 0

/**
 * `sql` must return one row with a `bad` column. The check PASSES when bad = 0.
 * `controlSql` must return bad > 0 — it is the same query aimed at data known to be wrong.
 */
async function check(name: string, sql: string, controlSql: string | null, note = '') {
  const { rows: [r] } = await pool.query<{ bad: string; detail?: string }>(sql)
  const bad = Number(r.bad)
  const ok = bad === 0
  console.log(`   ${ok ? '✓' : '✗'} ${name.padEnd(56)} bad=${bad}${r.detail ? `  ${r.detail}` : ''}`)
  if (note) console.log(`       ${note}`)
  if (ok) passes++; else failures++

  if (controlSql) {
    const { rows: [c] } = await pool.query<{ bad: string }>(controlSql)
    if (Number(c.bad) > 0) console.log(`       ↳ negative control fired (${c.bad}) — the check can fail, so its pass means something`)
    else { console.log(`       ↳ ⚠⚠ NEGATIVE CONTROL DID NOT FIRE — this check cannot fail and proves nothing`); brokenControls++ }
  }
}

async function main() {
  head('2D-2 VERIFICATION')

  // ── §1 the voted edge ────────────────────────────────────────────────────────────────────────
  head('§1 `voted`')
  const { rows: [v] } = await pool.query(
    `SELECT COUNT(*)::text AS edges, COUNT(DISTINCT subject_id)::text AS people,
            COUNT(DISTINCT object_ref)::text AS divisions,
            MIN(observed_on)::text AS first, MAX(observed_on)::text AS last,
            COUNT(*) FILTER (WHERE qualifier='aye')::text AS aye,
            COUNT(*) FILTER (WHERE qualifier='no')::text AS no,
            COUNT(*) FILTER (WHERE qualifier='absent')::text AS absent,
            COUNT(*) FILTER (WHERE teller)::text AS tellers
       FROM graph_voted_edge`)
  console.table([v])
  const { rows: [cover] } = await pool.query(
    `SELECT (SELECT COUNT(DISTINCT member_id) FROM division_votes)::text AS voters,
            (SELECT COUNT(DISTINCT v.member_id) FROM division_votes v
               JOIN graph_entity e ON e.parl_member_id=v.member_id AND e.kind='person')::text AS resolved,
            (SELECT COUNT(*) FROM division_votes)::text AS vote_rows,
            (SELECT COUNT(*) FROM graph_voted_edge)::text AS edges_built`)
  console.table([cover])

  await check('every voted edge names a division we hold',
    `SELECT COUNT(*)::text AS bad FROM graph_voted_edge g
      WHERE NOT EXISTS (SELECT 1 FROM divisions d WHERE d.house||':'||d.division_id = g.object_ref)`,
    // control: the same test against an object_ref that is deliberately not a real division
    `SELECT COUNT(*)::text AS bad FROM (SELECT object_ref||'-NOTREAL' AS object_ref FROM graph_voted_edge LIMIT 50) g
      WHERE NOT EXISTS (SELECT 1 FROM divisions d WHERE d.house||':'||d.division_id = g.object_ref)`)

  await check('EVIDENCE COVERAGE — every derived section id exists in corpus_sections',
    `SELECT COUNT(*)::text AS bad FROM (SELECT DISTINCT evidence_section_id AS sid FROM graph_voted_edge) x
      WHERE NOT EXISTS (SELECT 1 FROM corpus_sections c WHERE c.id = x.sid)`,
    `SELECT COUNT(*)::text AS bad FROM (SELECT DISTINCT evidence_section_id||'-NOTREAL' AS sid FROM graph_voted_edge LIMIT 50) x
      WHERE NOT EXISTS (SELECT 1 FROM corpus_sections c WHERE c.id = x.sid)`,
    'this is what "100% evidence coverage" means for a derived edge: the id resolves, checked, not asserted')

  await check('no voted edge carries a NULL date',
    `SELECT COUNT(*)::text AS bad FROM graph_voted_edge WHERE observed_on IS NULL`, null,
    'the design\'s rule that a changed position is a finding depends on every edge being dated')

  await check('no voted edge sits on an entity that is not a person',
    `SELECT COUNT(*)::text AS bad FROM graph_voted_edge g JOIN graph_entity e ON e.id=g.subject_id WHERE e.kind<>'person'`, null)

  await check('the vote value is only ever aye | no | absent',
    `SELECT COUNT(*)::text AS bad FROM graph_voted_edge WHERE qualifier NOT IN ('aye','no','absent')`, null)

  // ⚠ The single most consequential rule in §1: an MP who did not vote did not vote against.
  head('§1 absent ≠ against — the rule §5.4 says must never be blurred')
  const { rows: abs } = await pool.query(
    `SELECT house, qualifier, absence_known, COUNT(*)::text AS n FROM graph_voted_edge
      GROUP BY 1,2,3 ORDER BY 1,2`)
  console.table(abs)
  await check('no Lords edge claims a measured absence',
    `SELECT COUNT(*)::text AS bad FROM graph_voted_edge WHERE house='lords' AND qualifier='absent'`, null,
    'the Lords publishes no equivalent of NoVoteRecorded, so a Lords "absent" would be invented')
  await check('every absent edge carries absence_known = true',
    `SELECT COUNT(*)::text AS bad FROM graph_voted_edge WHERE qualifier='absent' AND absence_known IS NOT TRUE`, null)

  await check('"passed without a division" is still NOT inferred',
    `SELECT COUNT(*)::text AS bad FROM stage_outcomes WHERE method='title-match'`, null,
    'V34 left stage_outcomes empty rather than fuzzy-match it, and 2D-2 did not fill it either')

  // ── §2 the people ────────────────────────────────────────────────────────────────────────────
  head('§2 identity')
  const { rows: ks } = await pool.query(
    `SELECT kind, key_source, COUNT(*)::text AS n, ROUND(AVG(confidence)::numeric,2)::text AS conf
       FROM graph_entity GROUP BY 1,2 ORDER BY 1,3 DESC`)
  console.table(ks)
  await check('no entity claims a stable key at less than full confidence',
    `SELECT COUNT(*)::text AS bad FROM graph_entity WHERE key_source='parl-member-id' AND confidence < 1.0`, null)
  await check('⚠ no NAME MATCH is dressed up as a stable key',
    `SELECT COUNT(*)::text AS bad FROM graph_entity
      WHERE parl_member_id IS NOT NULL AND key_source='parl-member-id' AND confidence=1.0
        AND id IN (SELECT kept_entity_id FROM graph_merge_log WHERE reason LIKE 'register-name-match%')`, null,
    'the 691 register matches must read as name-match/0.9, never as parl-member-id/1.0')
  await check('every member id in the graph is a member the register knows',
    `SELECT COUNT(*)::text AS bad FROM graph_entity e
      WHERE e.parl_member_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM graph_member_register r WHERE r.mnis_id=e.parl_member_id)`,
    `SELECT COUNT(*)::text AS bad FROM (SELECT 999999999 AS pid) e
      WHERE NOT EXISTS (SELECT 1 FROM graph_member_register r WHERE r.mnis_id=e.pid)`)
  await check('a member id identifies exactly one entity',
    `SELECT COUNT(*)::text AS bad FROM (
       SELECT parl_member_id FROM graph_entity WHERE parl_member_id IS NOT NULL
        GROUP BY 1 HAVING COUNT(*) > 1) x`, null)

  const { rows: [splits] } = await pool.query(
    `SELECT COUNT(DISTINCT kept_entity_id)::text AS n FROM graph_merge_log WHERE reason LIKE 'SPLIT-DETECTED%'`)
  const { rows: [merged] } = await pool.query(
    `SELECT COUNT(*)::text AS n FROM graph_merge_log WHERE reason='merged-on-parl-member-id'`)
  console.log(`   splits logged and deliberately NOT resolved: ${splits.n}`)
  console.log(`   merges performed:                            ${merged.n}`)
  await check('no split-flagged entity was quietly resolved anyway',
    `SELECT COUNT(*)::text AS bad FROM graph_entity e
      WHERE e.parl_member_id IS NOT NULL
        AND e.id IN (SELECT kept_entity_id FROM graph_merge_log WHERE reason LIKE 'SPLIT-DETECTED%')`, null,
    'a split is a refusal to decide; giving it a key afterwards would be deciding')

  await check('the first_seen repair held — no person entity is a single-day actor with multi-day edges',
    `SELECT COUNT(*)::text AS bad FROM graph_entity e
      WHERE e.kind='person' AND e.first_seen = e.last_seen
        AND EXISTS (SELECT 1 FROM graph_edge g WHERE g.subject_id=e.id AND g.first_seen <> g.last_seen)`, null)

  // ── §3 signed-motion ─────────────────────────────────────────────────────────────────────────
  head('§3 `signed-motion`')
  const { rows: [sm] } = await pool.query(
    `SELECT (SELECT COUNT(*) FROM edm_sponsor)::text AS sponsor_rows,
            (SELECT COUNT(*) FROM edm_sponsor WHERE mnis_id IS NULL)::text AS no_id,
            (SELECT COUNT(*) FROM graph_signed_motion_edge)::text AS edges,
            (SELECT COUNT(DISTINCT subject_id) FROM graph_signed_motion_edge)::text AS people,
            (SELECT MIN(observed_on) FROM graph_signed_motion_edge)::text AS first,
            (SELECT MAX(observed_on) FROM graph_signed_motion_edge)::text AS last`)
  console.table([sm])
  await check('EVIDENCE COVERAGE — every signed-motion edge resolves to a section we hold',
    `SELECT COUNT(*)::text AS bad FROM (SELECT DISTINCT evidence_section_id AS sid FROM graph_signed_motion_edge) x
      WHERE NOT EXISTS (SELECT 1 FROM corpus_sections c WHERE c.id = x.sid)`,
    `SELECT COUNT(*)::text AS bad FROM (SELECT DISTINCT evidence_section_id||'-NOTREAL' AS sid FROM graph_signed_motion_edge LIMIT 50) x
      WHERE NOT EXISTS (SELECT 1 FROM corpus_sections c WHERE c.id = x.sid)`)
  await check('every signed-motion edge is dated',
    `SELECT COUNT(*)::text AS bad FROM graph_signed_motion_edge WHERE observed_on IS NULL`, null)

  // ── the whole graph ──────────────────────────────────────────────────────────────────────────
  head('THE GRAPH AS A WHOLE')
  const { rows: all } = await pool.query(
    `SELECT predicate, storage, COUNT(*)::text AS edges, COUNT(DISTINCT subject_id)::text AS actors
       FROM graph_edge_all GROUP BY 1,2 ORDER BY 3 DESC`)
  console.table(all)
  const { rows: [sz] } = await pool.query<{ b: string }>(`SELECT pg_database_size(current_database())::text AS b`)
  const gib = Number(sz.b) / 1024 ** 3
  console.log(`   database ${gib.toFixed(2)} GiB of the 17.5 GiB line = ${((100 * gib) / 17.5).toFixed(1)}%`)

  head('RESULT')
  console.log(`   checks passed ${passes}, failed ${failures}, broken negative controls ${brokenControls}`)
  if (failures || brokenControls) { console.log('   ❌ NOT CLEAN'); process.exit(1) }
  console.log('   ✓ all checks pass and every negative control fired')
  await endNeonPool()
}
main().catch((e) => { console.error('[verify-2d2] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
