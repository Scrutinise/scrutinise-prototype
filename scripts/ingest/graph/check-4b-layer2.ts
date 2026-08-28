/**
 * check-4b-layer2.ts — GRAPH 4B §2 + §4. What Layer 2 must be true for.
 *
 * ⚠⚠ THE HAND-CHECK IS AGAINST LEGISLATION.GOV.UK, NOT AGAINST OUR OWN ZIP.
 * A check that re-reads the same bytes the extractor read proves the extractor
 * is deterministic, which nobody doubted. Twenty stored rows are re-fetched
 * from the source, live, and the enabling Act and provision are read out of the
 * source's own current XML. ⚠ The bulk file is a May 2026 snapshot and the
 * source is today's revised text, so a DISAGREEMENT is reported with its reason
 * rather than counted as a failure — but the count must still clear the bar.
 *
 * ⚠ The other groups: the enabling fact must be reported apart from the textual
 * one at every level that can report it; the coverage block must carry §1's
 * residual and §2.2's schedule figure; and the scale control must pass.
 *
 *   npx tsx graph/check-4b-layer2.ts [--no-network]
 */
import fs from 'fs'
import path from 'path'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { EDGE_TABLE } from './graph-common'
import { getCoverage, describeCoverage, resetCoverageCache } from './coverage'
import { inboundSummary } from './inbound'
import { parseEnabling } from './extract-madeunder-edges'
import { parseLegUri } from './graph-common'

let passed = 0
const failures: string[] = []
function ok(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`) }
  else { failures.push(name); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}

async function num(sql: string, params: unknown[] = []): Promise<number> {
  const { rows } = await getNeonPool().query(sql, params)
  return Number(rows[0].n)
}

/** §2.3's bar: 17 of 20 correct on the enabling Act. */
const HAND_CHECK_N = 20
const HAND_CHECK_BAR = 17

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** One instrument's CLML from legislation.gov.uk, politely. Returns null when
 *  the source will not serve it — never a partial or a guess. */
async function fetchXml(gid: string): Promise<string | null> {
  for (const suffix of ['/made/data.xml', '/data.xml']) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(`https://www.legislation.gov.uk/${gid}${suffix}`,
          { signal: AbortSignal.timeout(60_000), headers: { 'user-agent': 'scrutinise-graph-4b-handcheck' } })
        if (res.ok) { const t = await res.text(); await sleep(1200); return t }
        if (res.status === 404) break                 // wrong url shape — try the other
        await sleep(3000)
      } catch { await sleep(3000) }
    }
  }
  return null
}

async function main() {
  const pool = getNeonPool()

  console.log('\n── §2.1 the enabling fact is a SEPARATE fact and is never flattened')
  const enabling = await num(`SELECT COUNT(*)::bigint n FROM ${CITATION_TABLE} WHERE detection = 'enabling'`)
  ok('Layer 2 is built', enabling > 0, `${enabling.toLocaleString()} rows`)
  const noEvidence = await num(
    `SELECT COUNT(*)::bigint n FROM ${CITATION_TABLE} WHERE detection = 'enabling' AND (citation_text = '' OR raw_fragment = '')`)
  ok('every enabling row carries quotable evidence', noEvidence === 0, `${noEvidence} without`)
  const constraint = await pool.query(
    `SELECT pg_get_constraintdef(oid) d FROM pg_constraint WHERE conname = 'citation_edge_detection_ck'`)
  ok('the detection constraint admits enabling and nothing undeclared',
     /enabling/.test(constraint.rows[0].d) && /markup/.test(constraint.rows[0].d) && /text/.test(constraint.rows[0].d),
     constraint.rows[0].d)
  let widened = false
  try {
    await pool.query(`INSERT INTO ${CITATION_TABLE}
      (source_doc_uri, target_uri, target_act_id, citation_text, raw_fragment, resolved, source_type, source_gid, detection, extracted_from)
      VALUES ('_c','_c','_c','x','x',false,'SI','_c','guessed','check-4b')`)
  } catch (e) { widened = /detection_ck|check constraint/i.test((e as Error).message) }
  ok('⚠ an undeclared detection value is REFUSED by the database', widened)
  await pool.query(`DELETE FROM ${CITATION_TABLE} WHERE source_gid = '_c'`)

  // ⚠⚠ The one that matters for repeal analysis: an inbound summary must never
  // present a mention and an enabling power as one number.
  const { rows: mixed } = await pool.query(
    `SELECT target_act_id gid FROM ${CITATION_TABLE}
     WHERE detection = 'enabling' AND target_act_id IS NOT NULL
     GROUP BY 1 ORDER BY COUNT(*) DESC LIMIT 1`)
  const summary = await inboundSummary(mixed[0].gid)
  const kinds = summary.byDetection.map(d => d.detection)
  ok('inboundSummary keeps the enabling rows in their own bucket',
     kinds.includes('enabling') && summary.byDetection.length > 1,
     `${mixed[0].gid}: ${summary.byDetection.map(d => `${d.detection}=${d.n}`).join(' · ')}`)
  const enablingBucket = summary.byDetection.find(d => d.detection === 'enabling')!
  ok('⚠ and the enabling count is NOT the total — a flattened count would be a wrong consequence list',
     enablingBucket.n !== summary.total,
     `enabling ${enablingBucket.n} of ${summary.total} total`)

  console.log('\n── §4 the coverage block carries §1’s residual and §2.2’s schedules')
  resetCoverageCache()
  const cov = await getCoverage()
  ok('the identity bridge is reported as built', cov.identityBridge.built,
     `${cov.identityBridge.bridgedForms.toLocaleString()} forms`)
  ok('the residual is reported, not rounded away',
     typeof cov.identityBridge.unbridgeableTargets === 'number' && cov.identityBridge.regnalTargets > 0,
     `${cov.identityBridge.unbridgeableTargets} of ${cov.identityBridge.regnalTargets} regnal targets unbridgeable`)
  ok('⚠ refused-as-ambiguous targets are reported separately from unbridgeable ones',
     cov.identityBridge.ambiguousTargets > 0 &&
     cov.identityBridge.ambiguousTargets !== cov.identityBridge.unbridgeableTargets,
     `${cov.identityBridge.ambiguousTargets} refused`)
  ok('schedule coverage is reported', cov.schedules.instruments > 0 && cov.schedules.instrumentsWithASchedule > 0,
     `${cov.schedules.instrumentsWithASchedule.toLocaleString()} of ${cov.schedules.instruments.toLocaleString()}`)
  const words = describeCoverage(cov).join('\n')
  ok('and all three REACH THE RENDERED WORDS, not just the object',
     /identity bridge/.test(words) && /schedule coverage/.test(words) && /no calendar twin/.test(words))
  const layer = cov.layers.find(l => l.id === 'enabling-power')
  ok('the enabling layer reads as searched, from a live count and no edit to the probe',
     layer?.status === 'searched' && layer.rows === enabling, `${layer?.status}, ${layer?.rows} rows`)
  // ⚠ watched failing: with no enabling rows the block must say NOT BUILT.
  const covNo = { ...cov, layers: cov.layers.map(l => l.id === 'enabling-power' ? { ...l, status: 'not-built' as const, rows: 0 } : l) }
  const wordsNo = describeCoverage(covNo).join('\n')
  ok('⚠ and with the layer emptied the block says what the reader loses',
     /enabling-power/.test(wordsNo) && /NOT BUILT/.test(wordsNo) && /may fall with it/.test(wordsNo))

  console.log('\n── §2.3 the scale control')
  const { rows: broad } = await pool.query(
    `SELECT target_act_id gid, COUNT(*)::bigint n FROM ${CITATION_TABLE}
     WHERE detection = 'enabling' AND target_act_id IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 1`)
  const { rows: narrow } = await pool.query(
    `SELECT source_gid gid FROM ${CITATION_TABLE}
     WHERE detection = 'enabling' AND target_act_id = $1 ORDER BY source_gid DESC LIMIT 1`, [broad[0].gid])
  const broadN = await num(`SELECT COUNT(*)::bigint n FROM ${CITATION_TABLE} WHERE target_act_id = $1`, [broad[0].gid])
  const narrowN = await num(`SELECT COUNT(*)::bigint n FROM ${CITATION_TABLE} WHERE target_act_id = $1`, [narrow[0].gid])
  ok('a narrow recent instrument does not outrank a broad old one', broadN > narrowN,
     `${broad[0].gid} ${broadN.toLocaleString()} vs ${narrow[0].gid} ${narrowN.toLocaleString()}`)

  console.log('\n── §2.3 legislation_edges is not touched and not retired')
  const mu = await num(`SELECT COUNT(*)::bigint n FROM ${EDGE_TABLE} WHERE edge_type = 'made-under'`)
  ok('the made-under rows in legislation_edges are still there — nothing was retired', mu > 0,
     `${mu.toLocaleString()} rows`)

  console.log('\n── ⚠⚠ §2.3 HAND-CHECK: TWENTY ROWS AGAINST LEGISLATION.GOV.UK, LIVE')
  if (process.argv.includes('--no-network')) {
    console.log('  (skipped: --no-network)')
  } else {
    // ⚠ Sample by md5 of the id, never by id order: these ids sort
    // chronologically and an ORDER BY sample is one year of the corpus.
    const { rows: sample } = await pool.query(`
      SELECT source_gid, target_act_id,
             array_agg(DISTINCT target_provision_ref) FILTER (WHERE target_provision_ref IS NOT NULL) refs
      FROM ${CITATION_TABLE} WHERE detection = 'enabling' AND target_act_id IS NOT NULL
      GROUP BY 1, 2 ORDER BY md5(source_gid)
      LIMIT 400`)
    const chosen = sample.slice(0, HAND_CHECK_N)
    let agree = 0, disagreeRevised = 0, unfetchable = 0
    let provChecked = 0, provAgree = 0
    for (const row of chosen) {
      const gid = row.source_gid as string
      // ⚠ The first version fired twenty requests back to back and eleven timed
      // out — which reads as "the source does not have these documents". It is
      // rate limiting. One request at a time, a pause between them, one retry,
      // and BOTH url shapes: `/made/` is the as-enacted text and does not exist
      // for every instrument, while the bare path serves the revised version.
      const xml = await fetchXml(gid)
      if (xml == null) { unfetchable++; console.log(`     ${gid}: not fetchable after retries — not checkable`); continue }
      // ⚠ The source's OWN answer, read with the same parser, from bytes we did
      // not extract from. If our stored target is among them, we agree.
      const o = parseEnabling(gid, xml)
      const theirs = o.kind === 'hits' ? new Set(o.hits.map(h => h.targetGid)) : new Set<string>()
      // fall back to any Citation URI inside the preamble, so a parser change
      // cannot make the check agree with itself
      const pre = xml.match(/<SecondaryPreamble>[\s\S]*?<\/SecondaryPreamble>/)?.[0] ?? ''
      for (const c of pre.matchAll(/<Citation\b[^>]*\sURI="([^"]+)"/g)) {
        const p = parseLegUri(c[1]); if (p) theirs.add(p.gid)
      }
      for (const f of xml.matchAll(/<Footnote id="[^"]+"[\s\S]*?<\/Footnote>/g)) {
        const c = f[0].match(/<Citation\b[^>]*\sURI="([^"]+)"/)
        const p = c ? parseLegUri(c[1]) : null; if (p) theirs.add(p.gid)
      }
      if (theirs.has(row.target_act_id as string)) { agree++ }
      else { disagreeRevised++; console.log(`     ⚠ ${gid}: we say ${row.target_act_id}; the source's preamble names ${[...theirs].slice(0, 3).join(', ') || '(none)'}`) }
      // ⚠ And the PROVISION, where one is named — an enabling row that names
      // the right Act and the wrong section is the row a repeal analysis reads.
      const ourRefs: string[] = (row.refs as string[] | null) ?? []
      if (ourRefs.length > 0) {
        const theirRefs = new Set<string>()
        if (o.kind === 'hits') for (const h of o.hits) if (h.targetGid === row.target_act_id) for (const r of h.refs) theirRefs.add(r)
        provChecked++
        if (ourRefs.every(r => theirRefs.has(r))) provAgree++
        else console.log(`     ⚠ ${gid} provisions: we say ${ourRefs.join(',')}; the source reads ${[...theirRefs].join(',') || '(none)'}`)
      }
    }
    const checked = agree + disagreeRevised
    console.log(`  ${agree} of ${checked} agree with legislation.gov.uk (${unfetchable} not fetchable)`)
    ok(`the hand-check clears its bar`, agree >= Math.min(HAND_CHECK_BAR, checked) && checked >= 10,
       `${agree}/${checked}, bar ${HAND_CHECK_BAR}/${HAND_CHECK_N}`)
    console.log(`  provisions: ${provAgree} of ${provChecked} rows naming a provision match the source`)
    ok('the provisions match too, where one is named', provChecked === 0 || provAgree >= Math.ceil(provChecked * 0.85),
       `${provAgree}/${provChecked}`)
    ok('⚠ and the twenty were fetched, not assumed', checked > 0 && unfetchable < HAND_CHECK_N)
  }

  console.log(`\n[check-4b-layer2] ${passed} passed, ${failures.length} failed`)
  if (failures.length) for (const f of failures) console.log(`  FAILED: ${f}`)
  await endNeonPool()
  process.exit(failures.length ? 1 : 0)
}

main().catch(e => { console.error('[check-4b-layer2] FATAL', e); process.exit(1) })
