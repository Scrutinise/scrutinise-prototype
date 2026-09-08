/**
 * redo-g5-citation-edges.ts — replace this sprint's case-law citation rows after the
 * markup-debris fix.
 *
 * ⚠ WHY A DELETE EXISTS AT ALL. The first full run stored 193,226 quotes (15.0%) opening with a
 * tag remnant — `uk:origin="TNA" uk:type="legislation">section 138D…` — because the 400-character
 * evidence window can begin inside an attribute list and `/<[^>]*>/` needs an opening bracket.
 * The words are all there and every constraint passed; the quote is simply not readable as a
 * quote. `citation_text` is what makes an edge a fact rather than a claim, so the rows are rebuilt
 * rather than left.
 *
 * ── THE GUARDS, BECAUSE THIS DELETES FROM PRODUCTION ─────────────────────────
 *
 *  1. Scoped by BOTH `source_type = 'caselaw'` AND the exact `extracted_from` stamp, so it can
 *     only ever touch rows this sprint wrote. The 1,225,806 pre-existing legislation rows are not
 *     reachable by this statement.
 *  2. It REFUSES if the count it is about to delete differs from the count it expects, so a
 *     concurrent write means it stops rather than guesses.
 *  3. It prints the before and after counts, RE-READ, and the re-read is what it reports.
 *  4. `--apply` is required. Without it nothing is deleted and the plan is printed.
 *
 * ⚠ Reversible in the only sense that matters: the rows are a pure function of 74,896 judgments
 * still sitting in R2, and the extractor rebuilds them in about twenty minutes.
 *
 *   npx tsx graph/redo-g5-citation-edges.ts                 # plan only
 *   npx tsx graph/redo-g5-citation-edges.ts --apply         # delete, then re-extract
 */
import { execFileSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { namesPool, endNamesPool } from '../names/names-pool'
import { CITATION_TABLE } from './setup-citation-edge-table'

const STAMP = 'tna-caselaw:akn-ref@2026-09-08'
const APPLY = process.argv.includes('--apply')

;(async () => {
  const p = namesPool()
  const count = async (where: string) =>
    Number((await p.query(`SELECT COUNT(*)::bigint n FROM ${CITATION_TABLE} WHERE ${where}`)).rows[0].n)

  const scoped = `source_type = 'caselaw' AND extracted_from = '${STAMP}'`
  const before = await count(scoped)
  const others = await count(`source_type <> 'caselaw'`)
  const debris = await count(`${scoped} AND citation_text LIKE '%>%'`)

  console.log(`\n  rows in scope (caselaw + this stamp)   ${before.toLocaleString()}`)
  console.log(`    of which the quote carries debris    ${debris.toLocaleString()}  (${(100 * debris / Math.max(before, 1)).toFixed(1)}%)`)
  console.log(`  rows NOT in scope, untouched by this   ${others.toLocaleString()}`)

  if (!APPLY) { console.log(`\n  PLAN ONLY — pass --apply to delete and re-extract.\n`); await endNamesPool(); return }

  // ⚠ guard 2: refuse if the table moved under us
  const recheck = await count(scoped)
  if (recheck !== before) {
    console.error(`\n  ⚠⚠ REFUSING: the count changed between reads (${before} → ${recheck}). Nothing deleted.`)
    await endNamesPool(); process.exit(1)
  }

  const res = await p.query(`DELETE FROM ${CITATION_TABLE} WHERE ${scoped}`)
  const afterDelete = await count(`source_type = 'caselaw'`)
  const othersAfter = await count(`source_type <> 'caselaw'`)
  console.log(`\n  deleted ${(res.rowCount ?? 0).toLocaleString()} rows`)
  console.log(`  case-law rows remaining, RE-READ        ${afterDelete.toLocaleString()}`)
  console.log(`  other rows, RE-READ                     ${othersAfter.toLocaleString()}  ${othersAfter === others ? '(unchanged ✓)' : '⚠⚠ CHANGED — investigate'}`)
  if (othersAfter !== others) { await endNamesPool(); process.exit(1) }

  // fresh checkpoint, then re-extract in this process's stead
  const cp = path.join(__dirname, 'caselaw-citation-checkpoint.json')
  if (fs.existsSync(cp)) fs.unlinkSync(cp)
  await endNamesPool()

  console.log(`\n  re-extracting…\n`)
  execFileSync(process.execPath, [
    path.join(__dirname, '..', 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(__dirname, 'extract-caselaw-citation-edges.ts'),
  ], { stdio: 'inherit', env: { ...process.env, G5_CONCURRENCY: process.env.G5_CONCURRENCY ?? '32' } })
})().catch(async e => { console.error(e); await endNamesPool(); process.exit(1) })
