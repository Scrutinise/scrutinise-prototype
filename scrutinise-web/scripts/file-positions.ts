/**
 * file-positions.ts — SURFACE 3 §2. Put the position graph's findings under the POSITIONS heading
 * of an idea, so the evidence pack, the long report and the meeting pack carry them.
 *
 *   npm run positions:file -- --idea <idPrefix>     one idea
 *   npm run positions:file -- --all                 every live idea
 *   npm run positions:file -- --all --dry-run       what WOULD be filed, writing nothing
 *
 * ⚠ IT REPLACES ONLY ITS OWN ROWS (`passKey = 'positions'`). A user's uploaded material filed
 * under the same heading is untouched, and a PUBLISHED proposal version is unaffected because a
 * version stores its own copy of the snapshot — see `position-block.ts`'s header.
 *
 * ⚠ AND IT PRINTS WHAT IT RE-READ, not what it intended. The row count after every run is a fresh
 * query, because "three ideas I said were deleted were still there five days later".
 */
import { prisma } from '../lib/prisma'
import { filePositionsForIdea } from '../lib/graph/position-block'

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? (process.argv[i + 1] ?? '') : null
}
const has = (name: string) => process.argv.includes(`--${name}`)

async function main() {
  const dryRun = has('dry-run')
  const only = arg('idea')
  if (!only && !has('all')) {
    console.error('Pass --idea <idPrefix> or --all. Add --dry-run to write nothing.')
    process.exitCode = 2
    return
  }

  const ideas = await prisma.idea.findMany({
    where: {
      deletedAt: null,
      ...(only ? { id: { startsWith: only } } : {}),
    },
    select: { id: true, title: true },
    orderBy: { updatedAt: 'desc' },
  })
  if (!ideas.length) { console.error(`No live idea matched ${only ?? '(all)'}`); process.exitCode = 1; return }

  console.log(`${dryRun ? 'DRY RUN — ' : ''}${ideas.length} idea(s)\n`)
  let filed = 0, skipped = 0, rows = 0

  for (const idea of ideas) {
    const r = await filePositionsForIdea(idea.id, { dryRun, limit: 5 })
    const name = `${idea.id.slice(0, 8)}  ${(idea.title ?? 'untitled').slice(0, 44).padEnd(44)}`
    if (!r.positions.length) {
      skipped++
      console.log(`  —  ${name}  ${r.reason?.slice(0, 90)}`)
      continue
    }
    filed++
    console.log(`  ✓  ${name}  ${r.positions.length} position(s) on “${r.target?.targetLabel.slice(0, 40)}” `
      + `(matched “${r.target?.matchedPhrase}”)`)
    if (dryRun) continue

    // ⚠ RE-READ. The count printed is a query against the database after the write, never the
    // return value of the function that did the writing.
    const after = await prisma.evidenceItem.count({
      where: { ideaId: idea.id, headingKey: 'POSITIONS', passKey: 'positions' },
    })
    rows += after
    if (after !== r.written) {
      console.log(`     ⚠ wrote ${r.written} and re-read ${after} — investigate before relying on this.`)
    }
  }

  console.log(`\n${filed} idea(s) got a positions section, ${skipped} had nothing to file.`)
  if (!dryRun) console.log(`${rows} rows re-read across those ideas.`)
  console.log('\nWhere to look: open the idea, Outputs → the long report, under '
    + '"Key people and groups likely to support or oppose".')
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
