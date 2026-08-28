/**
 * check-4a-coverage.ts — GRAPH 4A §7 and §3/T4.
 *
 * ⚠⚠ The thing this check exists to prevent is a coverage block that is a
 * DECORATION: a caveat that looks right, reads well, and would say exactly the
 * same words if the corpus doubled or emptied. That is what the 17.5 GB alert
 * line was, and it survived being retired twice.
 *
 * So every assertion here has a paired negative that is WATCHED FIRING:
 *   · the block must MOVE when the state moves (a fact is planted, the block is
 *     re-read, the number must change, and the plant is removed);
 *   · a fact past its freshness window must NAME ITSELF stale (planted with an
 *     old date, watched being flagged);
 *   · a layer that is not built must be NAMED, not omitted;
 *   · an EMPTY result must still carry the block — an empty list is the answer
 *     most easily misread as "nothing refers to this";
 *   · `coverage.ts` must contain no figure about the corpus in any string.
 *     This is a source-level grep, because the failure mode is a constant that
 *     is correct on the day it is typed.
 *
 * Plus T4: the export redaction for CLML commentary handles, which are `key-`
 * plus 32 hex and byte-identical in shape to an API key. ⚠ Standing rule:
 * never bypass secret scanning — change the data, not the guard.
 *
 *   npx tsx graph/check-4a-coverage.ts
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { getCoverage, describeCoverage, resetCoverageCache, FRESHNESS_DAYS } from './coverage'
import { COVERAGE_TABLE, recordFact } from './setup-coverage-table'
import { inbound, inboundSummary } from './inbound'

const CRAG = 'ukpga/2010/25'
const CLML_HANDLE_RX = /key-[0-9a-f]{32}/g
const PLANT = '__check_4a_plant__'

let pass = 0, fail = 0
function assert(ok: boolean, label: string, detail = '') {
  if (ok) pass++; else fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`)
}

async function main() {
  const pool = getNeonPool()

  console.log('── the block exists on every surface, including the empty one ──')
  const empty = await inbound('ukpga/9999/999')
  assert(empty.rows.length === 0 && empty.coverage.layers.length > 0,
    'an empty inbound() result carries a populated coverage block',
    `${empty.rows.length} rows, ${empty.coverage.layers.length} layers`)
  const real = await inbound(CRAG)
  assert(real.rows.length > 0, 'the control is not an empty query', `${real.rows.length} rows`)
  const summary = await inboundSummary(CRAG)
  assert(summary.coverage != null, 'inboundSummary carries one too')

  console.log('\n── a layer that is NOT built must be NAMED, with its consequence ──')
  const cov = await getCoverage({ caseLaw: true })
  const missing = cov.layers.filter(l => l.status !== 'searched')
  assert(missing.length > 0, 'at least one layer is reported as not searched',
    missing.map(l => l.id).join(', '))
  assert(missing.every(l => l.consequence.length > 20),
    'every unsearched layer states what the reader loses by it')
  const caselaw = cov.layers.find(l => l.id === 'case-law-citations')
  assert(caselaw != null && caselaw.status !== 'searched',
    'case-law citations are reported as absent (they are)', caselaw?.status)
  // ⚠ The regression this pins: an early probe counted incidental phrase matches
  // and reported the enabling layer as SEARCHED on 858 rows it does not hold.
  // ⚠⚠ UPDATED 2026-08-28. GRAPH 4B BUILT THIS LAYER, so the assertion had to
  // change — and it changed only after the old one was watched FAILING, which is
  // the whole reason it was written that way. The probe itself is untouched: 4A
  // wrote it to flip on a `detection` value outside the two textual detectors,
  // and building the layer flipped it with no edit to `coverage.ts`'s probe.
  // The regression it still pins is the ORIGINAL one — the layer may only read
  // 'searched' on rows that really carry that detection value.
  const enabling = cov.layers.find(l => l.id === 'enabling-power')
  assert(enabling != null && enabling.status === 'searched' && enabling.rows > 0,
    'the enabling relationship is reported as SEARCHED, on rows this table really holds',
    `${enabling?.status}, ${enabling?.rows} rows`)
  const phraseMatches = await pool.query(
    `SELECT COUNT(*)::bigint n FROM citation_edge
     WHERE detection IN ('markup','text') AND citation_text ILIKE '%in exercise of the powers%'`)
  assert(enabling != null && enabling.rows !== Number(phraseMatches.rows[0].n),
    '⚠ and NOT on incidental phrase matches — the 858-row false positive cannot come back',
    `layer ${enabling?.rows} rows vs ${Number(phraseMatches.rows[0].n)} incidental phrase matches`)
  const evidenced = await pool.query(
    `SELECT COUNT(*)::bigint n FROM citation_edge
     WHERE detection = 'enabling' AND (citation_text = '' OR raw_fragment = '')`)
  assert(Number(evidenced.rows[0].n) === 0,
    'every enabling row carries its evidence — an edge with no quotable source is a claim, not a fact',
    `${Number(evidenced.rows[0].n)} rows with empty evidence`)
  assert(cov.caseLawBoundary != null, 'the case-law date boundary is reported when asked for',
    cov.caseLawBoundary ? `${cov.caseLawBoundary.earliest} … ${cov.caseLawBoundary.latest}` : '')

  console.log('\n── ⚠ THE BLOCK MUST MOVE WHEN THE STATE MOVES (negative control) ──')
  const before = (await getCoverage()).recorded.length
  await recordFact(PLANT, 424242, 'planted by check-4a-coverage, removed in the same run', 'graph/check-4a-coverage.ts')
  resetCoverageCache()
  const during = await getCoverage()
  const planted = during.recorded.find(f => f.key === PLANT)
  assert(during.recorded.length === before + 1 && planted?.n === 424242,
    'planting a fact changes the block',
    `${before} → ${during.recorded.length}, planted n=${planted?.n}`)
  const rendered = describeCoverage(during).join('\n')
  assert(rendered.includes('424242') || rendered.includes('424,242'),
    'the planted number reaches the RENDERED words, not just the object')

  console.log('\n── ⚠ A STALE FACT MUST NAME ITSELF (negative control) ──')
  await pool.query(
    `UPDATE ${COVERAGE_TABLE} SET measured_at = now() - ($2 || ' days')::interval WHERE key = $1`,
    [PLANT, String(FRESHNESS_DAYS + 5)])
  resetCoverageCache()
  const staleCov = await getCoverage()
  assert(staleCov.staleFacts.includes(PLANT), 'a fact past the freshness window is flagged stale',
    `staleFacts=[${staleCov.staleFacts.join(', ')}]`)
  assert(describeCoverage(staleCov).join('\n').includes('STALE'),
    'the rendered block says STALE in words, not only in a field')

  await pool.query(`DELETE FROM ${COVERAGE_TABLE} WHERE key = $1`, [PLANT])
  resetCoverageCache()
  const after = await getCoverage()
  assert(!after.recorded.some(f => f.key === PLANT) && after.recorded.length === before,
    'the plant is removed and the block returns to its real state',
    `${after.recorded.length} facts`)

  console.log('\n── the real facts are recorded, and are not zero ──')
  for (const k of ['oi15_residual_edges', 'oi15_documents_skipped', 'unresolved_act_name_spans']) {
    const f = after.recorded.find(x => x.key === k)
    assert(f != null && f.n != null && f.n > 0, `${k} is recorded and non-zero`, `n=${f?.n ?? 'absent'}`)
    assert(f != null && !f.stale, `${k} is inside the freshness window`, `${f?.ageDays ?? '?'} days old`)
  }

  console.log('\n── ⚠ NO FIGURE ABOUT THE CORPUS MAY BE HARDCODED IN coverage.ts ──')
  const src = fs.readFileSync(path.join(__dirname, 'coverage.ts'), 'utf8')
  // every template literal and quoted string in the file, minus the SQL (which
  // legitimately carries column positions) and minus this rule's own comment.
  const strings = [...src.matchAll(/`([^`]*)`|'([^'\n]*)'/g)].map(m => m[1] ?? m[2] ?? '')
  const offenders = strings.filter(s =>
    !/SELECT|FROM|WHERE|GROUP BY|ORDER BY|COUNT|FILTER|::|\$\d/.test(s) &&
    /\b\d[\d,.]*\s*(rows|%|GB|MB|documents|spans|edges|of)\b/i.test(s))
  assert(offenders.length === 0,
    'no string in coverage.ts states a figure about the corpus',
    offenders.length ? `offenders: ${offenders.slice(0, 3).map(o => JSON.stringify(o.slice(0, 60))).join(' | ')}` : `${strings.length} strings scanned`)
  // ⚠ and the rule must be capable of failing — plant a violation in a copy
  const planted2 = src.replace('const lines: string[] = []', 'const lines: string[] = []\n  const bad = `the corpus holds 17.5 GB of data`')
  const strings2 = [...planted2.matchAll(/`([^`]*)`|'([^'\n]*)'/g)].map(m => m[1] ?? m[2] ?? '')
  const offenders2 = strings2.filter(s =>
    !/SELECT|FROM|WHERE|GROUP BY|ORDER BY|COUNT|FILTER|::|\$\d/.test(s) &&
    /\b\d[\d,.]*\s*(rows|%|GB|MB|documents|spans|edges|of)\b/i.test(s))
  assert(offenders2.length === 1, 'the hardcoded-figure rule FIRES on a planted violation',
    `caught ${offenders2.length}: ${JSON.stringify(offenders2[0] ?? '')}`)

  console.log('\n── T4: export hygiene — the CLML handle redaction ──')
  const artefacts = ['../../../docs/crag_part1_inbound.json', '../../../docs/citation_pilot_25h.json', '../../../docs/citation_audit_25h.json']
  let checked = 0
  for (const rel of artefacts) {
    const p = path.join(__dirname, rel)
    if (!fs.existsSync(p)) { console.log(`     (absent, not checked: ${path.basename(p)})`); continue }
    const body = fs.readFileSync(p, 'utf8')
    const live = body.match(CLML_HANDLE_RX) ?? []
    assert(live.length === 0, `${path.basename(p)} carries no live CLML handle`,
      live.length ? `${live.length} found, e.g. ${live[0]}` : `${(body.match(/key-REDACTED/g) ?? []).length} redacted markers present`)
    checked++
  }
  assert(checked > 0, 'at least one export artefact was actually read', `${checked} files`)

  // ⚠⚠ The rule must be able to fail, so the pattern is tested against a REAL
  // handle — fetched from the database at run time, never written into this
  // file. A literal here would put the token shape into the repository, which
  // is precisely what the redaction exists to prevent: the first version of
  // this check embedded one and GitHub's push protection rejected the push.
  // ⚠ The fix was to change the DATA, not the guard. Never bypass secret
  // scanning; an allow-listed secret is Charlie's decision, recorded with its
  // reason, and none was needed here.
  const { rows: liveRows } = await pool.query(
    `SELECT COUNT(*)::bigint n FROM citation_edge WHERE citation_text ~ 'key-[0-9a-f]{32}'`)
  assert(Number(liveRows[0].n) > 0,
    'the DATABASE still holds the unredacted handles — the change is to the export, not to the evidence',
    `${Number(liveRows[0].n).toLocaleString()} rows`)
  const { rows: sampleRow } = await pool.query(
    `SELECT substring(citation_text from 'key-[0-9a-f]{32}') AS handle
     FROM citation_edge WHERE citation_text ~ 'key-[0-9a-f]{32}' LIMIT 1`)
  const realHandle: string | undefined = sampleRow[0]?.handle
  assert(realHandle != null && (realHandle.match(CLML_HANDLE_RX) ?? []).length === 1,
    'the handle pattern FIRES on a real handle read from the database (the passes above are not vacuous)',
    realHandle ? `matched a ${realHandle.length}-character handle` : 'no handle available to test against')
  assert(realHandle != null && !src.includes(realHandle),
    'and that handle does NOT appear in this check\'s own source — the fixture is fetched, not embedded')

  console.log('\n── the block, as a reader sees it ──')
  for (const l of describeCoverage(await getCoverage({ caseLaw: true }))) console.log('   ' + l)

  console.log(`\n${pass} passed, ${fail} failed`)
  await endNeonPool()
  process.exit(fail === 0 ? 0 : 1)
}

if (require.main === module) {
  main().catch(async e => { console.error('FATAL', e); await endNeonPool().catch(() => {}); process.exit(1) })
}
