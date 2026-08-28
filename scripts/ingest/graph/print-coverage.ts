/**
 * print-coverage.ts — print the live coverage block. GRAPH 4B §5.
 *
 * ⚠ The capability document (`docs/CROSS_REFERENCE_GRAPH.md`) quotes this block
 * as a DATED READING, never as prose someone typed. Re-run it and replace the
 * block whenever the document is revised — a caveat copied by hand goes stale
 * silently, which is the whole reason `coverage.ts` exists.
 *
 *   npx tsx graph/print-coverage.ts [--case-law]
 */
import { getCoverage, describeCoverage } from './coverage'
import { endNeonPool } from '../shared/neon-pool'

async function main() {
  const cov = await getCoverage({ caseLaw: process.argv.includes('--case-law') })
  console.log(describeCoverage(cov).join('\n'))
  await endNeonPool()
}

main().catch(e => { console.error('[print-coverage] FATAL', e); process.exit(1) })
