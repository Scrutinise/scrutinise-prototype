/**
 * check-271-enabling-role.ts — DECISION 271 (24 Oct 2026): an enabling row is a DEPENDENCY only when the enacting
 * words name the provision as the power exercised; a procedural mention is a reference, for review.
 *
 * ⚠ PART A IS AGAINST HAND LABELS, NOT AGAINST THE CLASSIFIER'S OWN OUTPUT. `decision-271-validation.json` holds 141
 * enabling hits, each labelled by reading its enacting words: 80 from a first seeded draw, 11 for the CRaG s.20 test
 * case and the regressions found while building, and a SECOND holdout of 50 labelled with the rules frozen — which
 * scored 47/50 before its three misses were fixed (the fixture says which). Each is re-parsed from the bulk file and
 * must be found exactly once; the bar is EVERY label met — a dependency list that is wrong in either direction is the
 * failure this decision exists to stop.
 * ⚠ PART B READS THE TABLE: the column, its CHECKs (the presence CHECK VALIDATED, not merely present), every enabling
 * row carrying a role and no other row carrying one, and CRaG s.20 holding no `power` row.
 * ⚠ EVERY PREDICATE HAS A CONTROL fed a broken input, which must come back false.
 *
 *   npx tsx graph/check-271-enabling-role.ts          — A (needs the bulk zip) + B (needs Neon)
 *   npx tsx graph/check-271-enabling-role.ts --no-db  — A only; B is NOT RUN, and says so
 */
import fs from 'fs'
import path from 'path'
import { ZipReader, ZipEntryMeta } from './zip-reader'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'
import { parseEnabling, EnablingHit, ENABLING_ROLES } from './extract-madeunder-edges'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
type Case = { n: number | string; gid: string; target: string; back: boolean; tail?: string; refs?: string[]; power: boolean; mayBeAbsent?: boolean; note?: string }
/** A not-power case the parser has stopped writing at all (a back-reference no longer governed by a power). */
const ABSENT = { role: 'mention', roleWords: '(not written)' } as unknown as EnablingHit
const CASES: Case[] = JSON.parse(fs.readFileSync(path.join(__dirname, 'decision-271-validation.json'), 'utf8')).cases

let passed = 0
const failures: string[] = []
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`) }
  else { failures.push(name); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

/** The one hit a case names, or why there is not exactly one. */
function find(c: Case, hits: EnablingHit[]): EnablingHit | string {
  const same = hits.filter(h => h.targetGid === c.target && h.backReference === c.back
    && (c.tail === undefined || h.beforeWindow.endsWith(c.tail))
    && (c.refs === undefined || [...h.refs].sort().join(',') === [...c.refs].sort().join(',')))
  if (same.length === 0 && c.mayBeAbsent && !c.power) return ABSENT
  return same.length === 1 ? same[0] : `${same.length} hits match`
}

/** THE predicate: every case found once, and `power` exactly where the hand label says power. */
function agrees(found: Array<{ c: Case; hit: EnablingHit | string }>): boolean {
  return found.length > 0 && found.every(({ c, hit }) => typeof hit !== 'string' && (hit.role === 'power') === c.power)
}

async function partA(): Promise<Array<{ c: Case; hit: EnablingHit | string }>> {
  console.log(`\n── A. ${CASES.length} hand-labelled hits, re-parsed from the bulk file`)
  const want = new Set(CASES.map(c => c.gid))
  const parsed = new Map<string, EnablingHit[]>()
  const zip = new ZipReader(ZIP_PATH)
  for (const e of zip.entries) {
    const m = e.name.match(ENTRY_RX)
    if (!m) continue
    const gid = gidFromEntry(m)
    if (!want.has(gid) || parsed.has(gid)) continue   // ⚠ the first entry, as the extractor's checkpoint does
    const o = parseEnabling(gid, zip.readText(e as ZipEntryMeta))
    parsed.set(gid, o.kind === 'hits' ? o.hits : [])
  }
  zip.close()
  const found = CASES.map(c => ({ c, hit: find(c, parsed.get(c.gid) ?? []) }))
  let tp = 0, fp = 0, tn = 0, fn = 0
  for (const { c, hit } of found) {
    if (typeof hit === 'string') { ok(`case ${c.n} found once (${c.gid} → ${c.target}${c.back ? ' back' : ''})`, false, hit); continue }
    const isPower = hit.role === 'power'
    if (isPower && c.power) tp++; else if (isPower) fp++; else if (c.power) fn++; else tn++
    if (isPower !== c.power) ok(`case ${c.n} ${c.gid} → ${c.target}: labelled ${c.power ? 'power' : 'not power'}`, false, `classified ${hit.role} (${hit.roleWords ?? '—'})${c.note ? ` · ${c.note}` : ''}`)
  }
  ok('every case found exactly once', found.every(f => typeof f.hit !== 'string'), `${found.filter(f => typeof f.hit !== 'string').length}/${found.length}`)
  ok('both classes are in the labelled set', CASES.some(c => c.power) && CASES.some(c => !c.power), `${CASES.filter(c => c.power).length} power · ${CASES.filter(c => !c.power).length} not`)
  ok('every hand label met (dependency iff power)', agrees(found), `power→power ${tp} · not→not ${tn} · FALSE POWER ${fp} · MISSED POWER ${fn}`)
  const crag = found.filter(f => f.c.target === 'ukpga/2010/25' && f.c.refs?.includes('section-20'))
  ok('CRaG s.20: all three procedural mentions are NOT power', crag.length === 3 && crag.every(f => typeof f.hit !== 'string' && f.hit.role !== 'power'),
    crag.map(f => (typeof f.hit === 'string' ? f.hit : `${f.c.gid}: ${f.hit.role} (${f.hit.roleWords})`)).join('; '))
  return found
}

async function partB(): Promise<void> {
  console.log('\n── B. the table')
  const q = async <T = any>(sql: string, p: unknown[] = []) => (await getNeonPool().query(sql, p)).rows as T[]
  const cols = await q<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 AND column_name IN ('enabling_role', 'enabling_role_words')`, [CITATION_TABLE])
  ok('enabling_role and enabling_role_words exist, both text', cols.length === 2 && cols.every(c => c.data_type === 'text'), cols.map(c => c.column_name).join(', '))
  const cons = await q<{ conname: string; def: string; convalidated: boolean }>(
    `SELECT conname, pg_get_constraintdef(oid) def, convalidated FROM pg_constraint WHERE conrelid = $1::regclass AND conname LIKE 'citation_edge_enabling_role%'`, [CITATION_TABLE])
  const values = cons.find(c => c.conname === 'citation_edge_enabling_role_ck')
  const present = cons.find(c => c.conname === 'citation_edge_enabling_role_present_ck')
  ok('the role CHECK lists exactly power / mention / unstated', !!values && JSON.stringify([...values.def.matchAll(/'([^']+)'::text/g)].map(m => m[1]).sort()) === JSON.stringify([...ENABLING_ROLES].sort()), values?.def ?? 'missing')
  ok('the presence CHECK exists AND IS VALIDATED (not merely NOT VALID)', !!present && present.convalidated, present ? `convalidated=${present.convalidated}` : 'missing')
  const [counts] = await q<{ enabling: string; with_role: string; others_with_role: string }>(
    `SELECT count(*) FILTER (WHERE detection = 'enabling') enabling,
            count(*) FILTER (WHERE detection = 'enabling' AND enabling_role IS NOT NULL) with_role,
            count(*) FILTER (WHERE detection <> 'enabling' AND enabling_role IS NOT NULL) others_with_role
       FROM ${CITATION_TABLE}`)
  ok('every enabling row has a role', Number(counts.enabling) > 0 && counts.enabling === counts.with_role, `${counts.with_role}/${counts.enabling}`)
  ok('no markup or text row has one', counts.others_with_role === '0', counts.others_with_role)
  const byRole = await q<{ enabling_role: string; n: string; back: string }>(
    `SELECT enabling_role, count(*) n, count(*) FILTER (WHERE citation_text LIKE '%[back-reference] %') back
       FROM ${CITATION_TABLE} WHERE detection = 'enabling' GROUP BY 1 ORDER BY 1`)
  console.log(`     by role: ${byRole.map(r => `${r.enabling_role} ${Number(r.n).toLocaleString()} (back-reference ${r.back})`).join(' · ')}`)
  const unstatedWords = await q<{ n: string }>(`SELECT count(*) n FROM ${CITATION_TABLE} WHERE detection = 'enabling' AND (enabling_role = 'unstated') <> (enabling_role_words IS NULL)`)
  ok('words are present exactly where the role is not unstated', unstatedWords[0].n === '0', unstatedWords[0].n)
  const crag = await q<{ source_gid: string; enabling_role: string }>(
    `SELECT source_gid, enabling_role FROM ${CITATION_TABLE} WHERE detection = 'enabling' AND target_act_id = 'ukpga/2010/25' AND target_provision_ref = 'section-20'`)
  ok('CRaG s.20 in the table: rows exist and none is power', crag.length > 0 && crag.every(r => r.enabling_role !== 'power'), crag.map(r => `${r.source_gid}:${r.enabling_role}`).join(' '))
}

async function main() {
  const found = await partA()

  console.log('\n── controls (each must say false)')
  const real = found.filter(f => typeof f.hit !== 'string') as Array<{ c: Case; hit: EnablingHit }>
  const forced = (role: EnablingHit['role']) => real.map(f => ({ c: f.c, hit: { ...f.hit, role } }))
  const controls: Array<[string, boolean]> = [
    ['every hit classified power', agrees(forced('power'))],
    ['every hit classified mention', agrees(forced('mention'))],
    ['one case not found', agrees([...real.slice(1), { c: real[0].c, hit: '0 hits match' }])],
    ['CRaG s.20 row turned back into a power', agrees(real.map(f => (f.c.n === 'K1' ? { c: f.c, hit: { ...f.hit, role: 'power' as const } } : f)))],
  ]
  for (const [name, holds] of controls) ok(`control fired: ${name}`, holds === false)

  if (process.argv.includes('--no-db')) console.log('\n── B. NOT RUN (--no-db)')
  else { try { await partB() } finally { await endNeonPool() } }

  console.log(`\n${passed} passed · ${failures.length} failed${failures.length ? `\n  ✗ ${failures.join('\n  ✗ ')}` : ''}`)
  process.exit(failures.length ? 1 : 0)
}

main().catch(e => { console.error('[check-271] FATAL', e); process.exit(1) })
