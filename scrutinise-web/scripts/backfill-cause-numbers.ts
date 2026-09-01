// ─────────────────────────────────────────────────────────────────────────────
// 25-S §2a — number the causes written before the column existed.
//
// ⚠ THE SAME SHAPE AS 25-R's POLICY BACKFILL, AND THE SAME REASONING: the number is assigned at
// write time now (`field-machine.ts`), so this only catches what came before. Per idea, in
// `createdAt` order, using the writer's own `nextCauseNumber` — two ways of choosing a number is
// how two rows end up sharing one.
//
// ⚠ DRY RUN BY DEFAULT. `--write` applies.
//
// Usage: tsx --env-file=.env scripts/backfill-cause-numbers.ts [--write]
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { nextCauseNumber } from '../lib/lex/cause-tree'

const WRITE = process.argv.includes('--write')

async function main() {
  console.log(`\n── 25-S §2a — cause numbering ${WRITE ? '(WRITING)' : '(dry run)'} ──\n`)

  const unnumbered = await prisma.diagnosisCause.findMany({
    where: { number: null },
    select: { id: true, ideaId: true, cause: true },
    orderBy: { createdAt: 'asc' },
  })
  const total = await prisma.diagnosisCause.count()
  console.log(`${total} causes; ${unnumbered.length} carry no number.\n`)
  if (!unnumbered.length) { console.log('Nothing to do.'); return }

  const byIdea = new Map<string, typeof unnumbered>()
  for (const r of unnumbered) {
    if (!byIdea.has(r.ideaId)) byIdea.set(r.ideaId, [])
    byIdea.get(r.ideaId)!.push(r)
  }

  const plan: Array<{ id: string; number: number; ideaId: string; cause: string }> = []
  for (const [ideaId, rows] of byIdea) {
    // ⚠ THE WHOLE IDEA'S ROWS — `nextCauseNumber` must see the numbers already taken.
    const all = await prisma.diagnosisCause.findMany({
      where: { ideaId }, select: { number: true },
    })
    let n = nextCauseNumber(all)
    for (const r of rows) { plan.push({ id: r.id, number: n++, ideaId, cause: r.cause }) }
    console.log(`  ${ideaId.slice(0, 8)}  ${rows.length} to number, starting at ${nextCauseNumber(all)}`)
  }

  console.log('\n── three of them ──')
  for (const p of plan.slice(0, 3)) {
    console.log(`  ${p.ideaId.slice(0, 8)}  → [${p.number}] ${p.cause.slice(0, 78)}`)
  }

  if (!WRITE) { console.log(`\nDry run. ${plan.length} rows would be numbered.\n`); return }

  for (const p of plan) {
    await prisma.diagnosisCause.update({ where: { id: p.id }, data: { number: p.number } })
  }

  // ⚠⚠ RE-READ AND REPORT THE RE-READ, and check the failure that would matter: two causes on
  // one idea sharing a number, which would make "cause 3" ambiguous — the exact thing §2a exists
  // to prevent.
  const stillNull = await prisma.diagnosisCause.count({ where: { number: null } })
  const dupes = await prisma.$queryRaw<Array<{ ideaId: string; number: number; n: bigint }>>`
    SELECT "ideaId", "number", COUNT(*) AS n
    FROM "DiagnosisCause"
    WHERE "number" IS NOT NULL
    GROUP BY "ideaId", "number"
    HAVING COUNT(*) > 1`
  console.log(`\nwrote ${plan.length}.`)
  console.log(`re-read: ${stillNull} still unnumbered; ${dupes.length} (idea, number) collisions.`)
  for (const d of dupes.slice(0, 5)) console.log(`  ⚠ ${d.ideaId.slice(0, 8)} number ${d.number} × ${d.n}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
