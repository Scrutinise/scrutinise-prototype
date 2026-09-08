/**
 * print-caselaw-coverage.ts — GRAPH 5 §1. The boundary block, regenerated from live state.
 *
 * ⚠ Print this rather than copying the block into a document by hand. A caveat copied by hand goes
 * stale silently, and this project has already had one figure survive being retired twice by living
 * in a comment.
 *
 *   npx tsx graph/print-caselaw-coverage.ts [--json <path>]
 */
import { caseLawCoverage, describeCaseLawBoundary } from './caselaw-coverage'
import { endNeonPool } from '../shared/neon-pool'
import fs from 'fs'

;(async () => {
  const b = await caseLawCoverage()
  console.log('\n' + describeCaseLawBoundary(b).join('\n') + '\n')
  const out = process.argv.indexOf('--json')
  if (out >= 0 && process.argv[out + 1]) {
    fs.writeFileSync(process.argv[out + 1], JSON.stringify(b, null, 2))
    console.log(`  → ${process.argv[out + 1]}\n`)
  }
  await endNeonPool()
})().catch(async e => { console.error(e); await endNeonPool(); process.exit(1) })
