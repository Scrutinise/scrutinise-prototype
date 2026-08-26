/**
 * record-4a-facts.ts — GRAPH 4A §7. Move this sprint's extraction-run statistics
 * out of log files and markdown and into `graph_coverage_fact`, so the coverage
 * block can quote them WITH THEIR AGE instead of a constant quoting them forever.
 *
 * ⚠ Every value here is read from the audit's own JSON output — not typed in.
 * A number re-keyed by hand is a constant with extra steps, and that is exactly
 * how the 17.5 GB figure survived being retired twice.
 *
 *   npx tsx graph/record-4a-facts.ts
 */
import fs from 'fs'
import path from 'path'
import { recordFact } from './setup-coverage-table'
import { endNeonPool } from '../shared/neon-pool'

const HERE = __dirname
const read = (f: string) => JSON.parse(fs.readFileSync(path.join(HERE, f), 'utf8'))

async function main() {
  const t2 = read('audit-4a-t2-hole.json')
  const t3 = read('audit-4a-t3-spans.json')
  const t1 = read('audit-4a-blast-radius.json')

  await recordFact(
    'oi15_residual_edges', t2.recoveredEdges,
    'citation edges recoverable from the pre-1963 documents the July cites extractor never opened; ' +
    'the residual against legislation_edges, which has NOT been re-extracted. citation_edge itself reads every document.',
    'graph/audit-4a-t2-hole.ts')

  await recordFact(
    'oi15_documents_skipped', t1.zip.missedTotal,
    'documents in the bulk CLML file the shipped calendar-year entry filter skipped, of the total it should have read',
    'graph/audit-4a-blast-radius.ts')

  await recordFact(
    'unresolved_act_name_spans', t3.unresolvedTotal,
    'act-name spans in running text that resolved to no instrument we hold a title for — short forms ' +
    '("the 1998 Act"), pre-1963 Acts under the other id form, and Acts the corpus does not hold. ' +
    'Counted, never dropped silently; short-form resolution is not built.',
    'graph/audit-4a-t3-spans.ts')

  await recordFact(
    'unresolved_spans_in_target_docs_pct', Math.round(t3.pctInCiters * 10) / 10,
    'percentage of those unresolved spans sitting in a document that also carries a resolved citation ' +
    'to one of twelve research-target Acts — the number that decides whether short-form resolution is urgent',
    'graph/audit-4a-t3-spans.ts')

  console.log('[4a-facts] recorded:')
  console.log(`  oi15_residual_edges                 = ${t2.recoveredEdges}`)
  console.log(`  oi15_documents_skipped              = ${t1.zip.missedTotal}`)
  console.log(`  unresolved_act_name_spans           = ${t3.unresolvedTotal}`)
  console.log(`  unresolved_spans_in_target_docs_pct = ${Math.round(t3.pctInCiters * 10) / 10}`)
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[4a-facts] FATAL', e); process.exit(1) })
}
