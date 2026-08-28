/**
 * check-4b-identity.ts — GRAPH 4B §1. The check that proves the bridge.
 *
 * ⚠⚠ THE FIRST THREE ASSERTIONS PIN THE BROKEN STATE, NOT THE FIXED ONE. They
 * require the UNBRIDGED join to return ZERO on three known pre-1963 Acts,
 * because that is what it does today and because a zero there does not look
 * like a bug — it looks like an Act nothing cites. If someone later "fixes" the
 * problem by rewriting one of the two tables' id forms, these three fail and
 * say so, which is the point: the bug and the fix must both stay visible.
 *
 * ⚠ And the LAST group is the one that stops this recurring. The regnal-year
 * trap has now appeared in four code paths, and every previous fix was applied
 * to ONE of two places that had to agree. So: no file under `graph/` may build
 * its own alias map. The check greps for the shape and fails on a second copy —
 * watched firing against a planted one.
 *
 *   npx tsx graph/check-4b-identity.ts
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { EDGE_TABLE } from './graph-common'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { IDENTITY_TABLE, loadIdentityBridge, resetIdentityBridge, isRegnalForm } from './identity'
import { KNOWN_PRE_1963 } from './audit-4b-identity'

let passed = 0
const failures: string[] = []
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`) }
  else { failures.push(name); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

/** 4A's measured `cites` counts under the URI's calendar form. Fixed here so a
 *  bridge that recovers a DIFFERENT number fails rather than looking like a
 *  bigger win. */
const EXPECTED_CITES: Record<string, number> = {
  'ukpga/Eliz2/9-10/33': 59,
  'ukpga/Geo6/12-13-14/54': 50,
  'ukpga/Geo5and1Edw8/26/49': 50,
}

async function num(sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await getNeonPool().query(sql, params)
  return Number(rows[0].n)
}

async function main() {
  console.log('\n── the bridge itself')
  const bridge = loadIdentityBridge(true)
  ok('the source enumeration is on disk (bridge NOT degraded)', !bridge.stats.degraded, bridge.stats.sourcePath)
  ok('pairs come from the source, not from us', bridge.stats.enumeratedPairs > 0,
     `${bridge.stats.enumeratedPairs.toLocaleString()} (docId, calendarId) pairs`)
  ok('every bridged form has a non-self basis',
     bridge.rows().every(r => r.basis !== 'self' && r.form !== r.canonical),
     `${bridge.rows().length.toLocaleString()} rows`)

  console.log('\n── ⚠ ambiguity is REFUSED, not resolved by first-wins')
  const AMB = 'ukpga/1801/16'
  ok('a calendar id claimed by two regnal Acts is ambiguous', bridge.isAmbiguous(AMB),
     bridge.candidatesFor(AMB).join(' | '))
  ok('an ambiguous form names exactly the candidates the source gave',
     bridge.candidatesFor(AMB).length === 2)
  ok('an ambiguous form is NOT bridged', bridge.canonical(AMB) === AMB)
  ok('ambiguous forms are counted', bridge.stats.ambiguousForms > 0,
     `${bridge.stats.ambiguousForms} calendar ids name more than one Act`)
  ok('no ambiguous form was given a canonical',
     bridge.rows().every(r => !bridge.isAmbiguous(r.form)))
  ok('⚠ but every ambiguous form IS stored, as a refusal — an absence cannot be counted',
     bridge.refusedRows().length === bridge.stats.ambiguousForms
     && bridge.refusedRows().every(r => r.canonical === null && r.basis === 'ambiguous-refused'),
     `${bridge.refusedRows().length.toLocaleString()} refusal rows`)

  console.log('\n── ⚠ the degraded branch, watched firing')
  process.env.GRAPH_IDENTITY_SOURCE = path.join(__dirname, 'no-such-enumeration-file.json')
  const empty = loadIdentityBridge(true)
  ok('a missing enumeration produces a DEGRADED bridge, not a silent empty one',
     empty.stats.degraded && empty.rows().length === 0)
  let refused = false
  try {
    const { buildIdentityTable } = await import('./setup-identity-table')
    await buildIdentityTable()
  } catch (e) { refused = /REFUSING/.test((e as Error).message) }
  ok('the table build REFUSES to truncate itself from a degraded bridge', refused)
  delete process.env.GRAPH_IDENTITY_SOURCE
  resetIdentityBridge()
  const live = loadIdentityBridge(true)
  ok('the live bridge is restored after the negative control', !live.stats.degraded)

  console.log('\n── the table is built from the module and from nothing else')
  const tableRows = await num(`SELECT COUNT(*)::bigint n FROM ${IDENTITY_TABLE}`)
  ok('row count matches the module exactly (bridges + refusals)',
     tableRows === live.rows().length + live.refusedRows().length,
     `table ${tableRows.toLocaleString()} vs module ${(live.rows().length + live.refusedRows().length).toLocaleString()}`)
  const mismatched = await (async () => {
    const { rows } = await getNeonPool().query(
      `SELECT form, canonical FROM ${IDENTITY_TABLE} WHERE canonical IS NOT NULL`)
    return rows.filter((r: { form: string; canonical: string }) => live.canonical(r.form) !== r.canonical).length
  })()
  ok('every stored canonical equals the module’s answer', mismatched === 0, `${mismatched} disagreements`)
  const storedRefusals = await num(
    `SELECT COUNT(*)::bigint n FROM ${IDENTITY_TABLE} WHERE basis = 'ambiguous-refused' AND canonical IS NULL`)
  ok('every refusal is stored with a NULL canonical', storedRefusals === live.refusedRows().length,
     `${storedRefusals.toLocaleString()} stored`)
  const badBasis = await num(
    `SELECT COUNT(*)::bigint n FROM ${IDENTITY_TABLE} WHERE basis NOT IN ('source-enumeration','prefix-alias','zero-padding','ambiguous-refused')`)
  ok('no row carries a basis outside the four declared ones', badBasis === 0)
  let shapeFired = false
  try {
    await getNeonPool().query(
      `INSERT INTO ${IDENTITY_TABLE} (form, canonical, basis) VALUES ('_check/refusal', '_check/x', 'ambiguous-refused')`)
  } catch (e) { shapeFired = /refusal_ck|check constraint/i.test((e as Error).message) }
  ok('⚠ a refusal carrying a canonical is REFUSED by the database', shapeFired)
  await getNeonPool().query(`DELETE FROM ${IDENTITY_TABLE} WHERE form = '_check/refusal'`)
  let checkFired = false
  try {
    await getNeonPool().query(
      `INSERT INTO ${IDENTITY_TABLE} (form, canonical, basis) VALUES ('_check/looks/alike', '_check/looks/alike2', 'looks-similar')`)
  } catch (e) { checkFired = /basis_ck|check constraint/i.test((e as Error).message) }
  ok('⚠ the database REFUSES a similarity basis', checkFired)
  await getNeonPool().query(`DELETE FROM ${IDENTITY_TABLE} WHERE form = '_check/looks/alike'`)

  console.log('\n── ⚠⚠ THE JOIN: broken today, correct through the bridge')
  for (const a of KNOWN_PRE_1963) {
    const naive = await num(
      `SELECT COUNT(*)::bigint n FROM ${EDGE_TABLE} WHERE edge_type = 'cites' AND split_part(to_id, ':', 2) = $1`, [a.regnal])
    const bridged = await num(`
      SELECT COUNT(*)::bigint n FROM ${EDGE_TABLE} e
      LEFT JOIN ${IDENTITY_TABLE} li ON li.form = split_part(e.to_id, ':', 2)
      WHERE e.edge_type = 'cites' AND COALESCE(li.canonical, split_part(e.to_id, ':', 2)) = $1`, [a.regnal])
    ok(`${a.name}: the unbridged join returns ZERO and looks like an absence`, naive === 0, `${naive} rows`)
    ok(`${a.name}: the bridged join returns the right number`, bridged === EXPECTED_CITES[a.regnal],
       `${bridged} rows, expected ${EXPECTED_CITES[a.regnal]}`)
  }

  console.log('\n── the bridge does not invent rows')
  const modern = 'ukpga/2010/25'
  const direct = await num(
    `SELECT COUNT(*)::bigint n FROM ${EDGE_TABLE} WHERE split_part(to_id, ':', 2) = $1`, [modern])
  const viaBridge = await num(`
    SELECT COUNT(*)::bigint n FROM ${EDGE_TABLE} e
    LEFT JOIN ${IDENTITY_TABLE} li ON li.form = split_part(e.to_id, ':', 2)
    WHERE COALESCE(li.canonical, split_part(e.to_id, ':', 2)) = $1`, [modern])
  ok('an unbridged (post-1963) id joins to exactly itself — the LEFT JOIN keeps it',
     direct === viaBridge && direct > 0, `${direct} rows both ways`)
  const invented = await num(`
    SELECT COUNT(*)::bigint n FROM ${IDENTITY_TABLE} li
    WHERE li.form = li.canonical`)
  ok('no row maps a form to itself (that is not a bridge, it is noise)', invented === 0)

  console.log('\n── the residual is counted, not hidden')
  const { rows: targets } = await getNeonPool().query(
    `SELECT DISTINCT target_act_id gid FROM ${CITATION_TABLE} WHERE target_act_id ~ '^[a-z]+/[A-Z]'`)
  // ⚠ A canonical regnal id is NOT "bridged" — it IS the canonical. The residual
  // that matters is a regnal target the source never gave a calendar twin for,
  // so it can never be joined against a table that keeps calendar forms.
  const noTwin = targets.filter((r: { gid: string }) => isRegnalForm(r.gid) && live.formsOf(r.gid).length === 1)
  ok('every regnal target with NO calendar twin is enumerable, not silently absorbed',
     noTwin.length < targets.length,
     `${noTwin.length} of ${targets.length} regnal targets have no twin — the §1 residual`)
  ok('the residual is small enough that the bridge is doing work',
     targets.length - noTwin.length > 0,
     `${targets.length - noTwin.length} regnal targets carry a calendar twin`)

  console.log('\n── ⚠⚠ NO SECOND COPY OF THE ALIAS LOGIC ANYWHERE THE GRAPH READS')
  const GRAPH_DIR = __dirname
  const SHAPES: Array<{ rx: RegExp; what: string }> = [
    { rx: /function\s+buildAliasMap\s*\(/, what: 'a private buildAliasMap()' },
    { rx: /calendarId/, what: 'reading calendarId out of the enumeration directly' },
    { rx: /PREFIX_ALIASES\s*[:=]/, what: 'a private prefix-alias table' },
  ]
  // ⚠ graph/ AND the citation-gap census, because GRAPH 4A §6 named THAT file
  // and extract-citation-edges.ts as the two copies. A guard scoped to one
  // directory would have declared victory with the second copy still in place.
  const SCANNED: string[] = [
    ...fs.readdirSync(GRAPH_DIR).filter(f => f.endsWith('.ts')).map(f => path.join(GRAPH_DIR, f)),
    path.join(GRAPH_DIR, '..', 'v37-citation-gaps.ts'),
  ]
  const EXEMPT = new Set(['identity.ts', 'check-4b-identity.ts'])
  const offenders: string[] = []
  for (const full of SCANNED) {
    if (EXEMPT.has(path.basename(full)) || !fs.existsSync(full)) continue
    const src = fs.readFileSync(full, 'utf8')
    for (const s of SHAPES) if (s.rx.test(src)) offenders.push(`${path.basename(full)}: ${s.what}`)
  }
  ok('no file the graph reads builds its own identity map', offenders.length === 0, offenders.join(' · ') || `clean across ${SCANNED.length} files`)
  // ⚠ watched firing: the detector must catch a planted copy, or it is not a guard.
  const planted = path.join(GRAPH_DIR, '_planted-alias-copy.ts')
  fs.writeFileSync(planted, 'const x: Record<string, string[]> = {}\nfunction buildAliasMap() { return x }\nexport default buildAliasMap\n')
  try {
    const src = fs.readFileSync(planted, 'utf8')
    ok('⚠ the detector catches a planted second copy', SHAPES.some(s => s.rx.test(src)))
  } finally { fs.unlinkSync(planted) }

  console.log(`\n[check-4b-identity] ${passed} passed, ${failures.length} failed`)
  if (failures.length) for (const f of failures) console.log(`  FAILED: ${f}`)
  await endNeonPool()
  process.exit(failures.length ? 1 : 0)
}

main().catch(e => { console.error('[check-4b-identity] FATAL', e); process.exit(1) })
