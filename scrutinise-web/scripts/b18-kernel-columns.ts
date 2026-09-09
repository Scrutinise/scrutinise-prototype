// ─────────────────────────────────────────────────────────────────────────────
// B18 §2 — HOW OFTEN IS THE KERNEL THE CHECK READS ACTUALLY POPULATED, ANYWHERE?
//
// `kernelText()` reads the canonical `Idea` columns. The twelve report-run measures all
// show 1 of 10 populated. The question this answers is whether that is a property of the
// twelve (created by script, never opened in the UI) or of the product.
//
// ⚠ IT COUNTS OVER EVERY IDEA THAT HAS EVER HAD A DONE BUILD, not over a sample, and it
// counts the columns POSITIVELY — "how many have a diagnosis" — rather than as an
// exclusion. A set defined as "everything except the ones I know about" is how a count
// grows flatteringly when a new case appears.
//
// Read-only.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '../lib/prisma'

/** The eight scalar kernel columns `kernelText` reads, excluding `title` (which is set at
 *  creation and so tells us nothing) and the two JSON columns (counted separately). */
const SCALARS = [
  'challenge', 'rootCause', 'pivotalObstacle', 'summaryDiagnosis',
  'chosenApproach', 'summaryGuidingPolicy', 'summaryCoherentActions',
] as const

async function main() {
  const built = await prisma.ideaBuild.findMany({
    where: { status: 'DONE' },
    select: { ideaId: true },
    distinct: ['ideaId'],
  })
  const ids = built.map((b) => b.ideaId)
  console.log(`ideas with at least one DONE build: ${ids.length}`)

  const ideas = await prisma.idea.findMany({
    where: { id: { in: ids } },
    select: {
      id: true, title: true, createdAt: true,
      challenge: true, rootCause: true, pivotalObstacle: true, summaryDiagnosis: true,
      chosenApproach: true, summaryGuidingPolicy: true, summaryCoherentActions: true,
    },
  })

  const has = (v: unknown) => typeof v === 'string' && v.trim().length > 0
  const perColumn = new Map<string, number>(SCALARS.map((k) => [k, 0]))
  const histogram = new Map<number, number>()
  const full: string[] = []

  for (const i of ideas) {
    let n = 0
    for (const k of SCALARS) {
      if (has((i as Record<string, unknown>)[k])) { perColumn.set(k, perColumn.get(k)! + 1); n++ }
    }
    histogram.set(n, (histogram.get(n) ?? 0) + 1)
    if (n === SCALARS.length) full.push(`${i.id.slice(0, 8)} ${i.title}`)
  }

  console.log(`\n── how many of the ${SCALARS.length} kernel columns are populated, per idea ──`)
  for (const n of [...histogram.keys()].sort((a, b) => a - b)) {
    console.log(`  ${n} of ${SCALARS.length} populated : ${histogram.get(n)} idea(s)`)
  }

  console.log(`\n── per column, across ${ideas.length} ideas that have been built ──`)
  for (const k of SCALARS) {
    const n = perColumn.get(k)!
    console.log(`  ${k.padEnd(24)} ${String(n).padStart(4)}  (${(100 * n / (ideas.length || 1)).toFixed(1)}%)`)
  }

  console.log(`\n  ideas where the kernel the check reads is COMPLETE: ${full.length}`)
  for (const f of full.slice(0, 10)) console.log(`    ${f}`)

  // ⚠ THE CONTROL: the same question asked of IdeaFieldState, which is where the build
  // actually writes. If this is also near zero the diagnosis is wrong and the builds
  // genuinely produced nothing.
  const states = await prisma.ideaFieldState.groupBy({
    by: ['fieldKey'],
    where: { ideaId: { in: ids }, fieldKey: { in: [...SCALARS] } },
    _count: { _all: true },
  })
  console.log(`\n── control: the same fields in IdeaFieldState, where the build writes them ──`)
  for (const s of states.sort((a, b) => a.fieldKey.localeCompare(b.fieldKey))) {
    console.log(`  ${s.fieldKey.padEnd(24)} ${String(s._count._all).padStart(4)} rows`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
