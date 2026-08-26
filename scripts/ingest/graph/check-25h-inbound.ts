/**
 * check-25h-inbound.ts — controls on the QUERY SURFACE, not on the data.
 *
 * The pilot's own controls (negative Act, scale ordering) test whether the
 * TABLE is sane. These test whether `inbound()` is doing what it claims:
 * a lookup that returns rows for an Act that does not exist, or that lets
 * Part 2's references leak into Part 1's answer, would pass every one of the
 * pilot's controls and still be worthless.
 *
 * Every assertion here has a paired opposite — a positive that must fire and a
 * negative that must not — because a filter that matches nothing passes any
 * test made only of negatives.
 *
 *   npx tsx graph/check-25h-inbound.ts
 */
import { inbound, inboundEvidence, inboundSummary, expandPart } from './inbound'
import { endNeonPool } from '../shared/neon-pool'

const CRAG = 'ukpga/2010/25'
let pass = 0, fail = 0
function assert(ok: boolean, label: string, detail = '') {
  if (ok) pass++; else fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`)
}

async function main() {
  console.log('── the target must actually gate the query ──')
  const nonsense = await inbound('ukpga/9999/999')
  assert(nonsense.rows.length === 0, 'an Act that does not exist returns 0 rows', `got ${nonsense.rows.length}`)
  const real = await inbound(CRAG)
  assert(real.rows.length > 0, 'CRAG returns rows (the negative above is not a broken query)', `got ${real.rows.length}`)
  // ⚠ GRAPH 4A §7 — the EMPTY result is the one that most needs the coverage
  // block, because an empty list is the answer most easily read as "nothing
  // refers to this" rather than "nothing that this graph can see".
  assert(nonsense.coverage != null && nonsense.coverage.layers.length > 0,
    'an EMPTY result still carries a coverage block',
    `${nonsense.coverage?.layers.length ?? 0} layers named`)

  console.log('\n── Part expansion is read from the Act, and confirmed externally ──')
  const p1 = expandPart(CRAG, 'part-1')
  assert(p1.available, 'part-1 expansion available', p1.note)
  const sections1 = p1.refs.filter(r => /^section-\d+$/.test(r)).map(r => +r.split('-')[1]).sort((a, b) => a - b)
  assert(
    sections1.length === 19 && sections1[0] === 1 && sections1[18] === 19,
    'part-1 expands to sections 1–19',
    `got ${sections1.length} sections [${sections1[0]}…${sections1[sections1.length - 1]}]`,
  )
  const p2 = expandPart(CRAG, 'part-2')
  assert(p2.available && !p2.refs.includes('section-19'), 'part-2 does NOT contain section 19', p2.note)
  assert(p2.refs.includes('section-20'), 'part-2 DOES contain section 20 (the boundary is real, not an empty set)')

  console.log('\n── a Part-scoped query must not return the whole Act ──')
  const { rows: partRows } = await inboundEvidence(CRAG, 'part-1')
  const summary = await inboundSummary(CRAG)
  assert(partRows.length < summary.total, 'part-1 rows are a strict subset of the act-wide rows',
    `${partRows.length} < ${summary.total}`)
  const p1set = new Set(p1.refs)
  const strays = partRows.filter(r => {
    if (!r.target_provision_ref) return true
    if (p1set.has(r.target_provision_ref)) return false
    // allowed: a subsection of a Part 1 provision (section-3-2 under section-3)
    return ![...p1set].some(ref => r.target_provision_ref!.startsWith(ref) && !/^\d/.test(r.target_provision_ref!.slice(ref.length, ref.length + 1)))
  })
  assert(strays.length === 0, 'every part-1 row names a Part 1 provision',
    strays.length ? `strays: ${strays.slice(0, 3).map(s => s.target_provision_ref).join(', ')}` : '')

  console.log('\n── subsections match their section; section-30 does not match section-3 ──')
  // Done against real data: find a target act that has both, or state that the
  // case is untested rather than pretending it passed.
  const { rows: s3 } = await inboundEvidence('ukpga/1998/42', 'section-3')
  const wrong = s3.filter(r => r.target_provision_ref && /^section-3\d/.test(r.target_provision_ref))
  assert(wrong.length === 0, 'HRA section-3 query returns no section-3x provisions',
    wrong.length ? `leaked: ${wrong.map(w => w.target_provision_ref).join(', ')}` : `${s3.length} rows checked`)
  const sub = s3.filter(r => r.target_provision_ref && r.target_provision_ref !== 'section-3')
  console.log(`     (of ${s3.length} rows, ${sub.length} are subsection-level descendants — ` +
    `${sub.length ? 'the prefix rule is exercised' : '⚠ the prefix rule is NOT exercised by this data, so it is untested here'})`)

  console.log('\n── the detection split must be reported, never merged silently ──')
  assert(summary.byDetection.length > 0, 'inboundSummary reports byDetection',
    summary.byDetection.map(d => `${d.detection}=${d.n}`).join(' '))
  const sum = summary.byDetection.reduce((a, d) => a + d.n, 0)
  assert(sum === summary.total, 'byDetection sums to the total', `${sum} vs ${summary.total}`)

  console.log(`\n${pass} passed, ${fail} failed`)
  await endNeonPool()
  process.exit(fail === 0 ? 0 : 1)
}
main().catch(e => { console.error('FATAL', e); process.exit(1) })
