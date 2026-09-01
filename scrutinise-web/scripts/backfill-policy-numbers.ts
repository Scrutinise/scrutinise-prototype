// ─────────────────────────────────────────────────────────────────────────────
// 25-R §2 — NUMBER THE CANDIDATES THAT NOBODY EVER OPENED A SCREEN FOR.
//
// 25-P assigned the stable number inside `ensureNumbered`, called by `readPolicyState`, which
// runs when the guiding-policy screen is opened. So an idea whose guiding-policy section was
// never opened has unnumbered candidates — measured on production, an idea built this morning
// had 0 of 3.
//
// ⚠⚠ THE FIX IS IN `field-machine.ts` (the number is assigned where the row is created). This
// only catches the rows written before that, and it is deliberately the SAME function — 25-P's
// `nextNumber`, max+1, never reusing a gap — because two ways of choosing a number is how two
// rows end up sharing one.
//
// ⚠ PER IDEA, IN `createdAt` ORDER, which is what `ensureNumbered` does. Numbering globally or in
// id order would give a user's list numbers that do not match the order they were written in.
//
// ⚠ DRY RUN BY DEFAULT. `--write` applies.
//
// Usage: npm run backfill:policy-numbers [-- --write]
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { nextNumber } from '../lib/lex/guiding-policy'

const WRITE = process.argv.includes('--write')

async function main() {
  console.log(`\n── 25-R §2 — policy numbering ${WRITE ? '(WRITING)' : '(dry run)'} ──\n`)

  const unnumbered = await prisma.policyOption.findMany({
    where: { number: null },
    select: { id: true, ideaId: true, createdAt: true, approach: true },
    orderBy: { createdAt: 'asc' },
  })
  const total = await prisma.policyOption.count()
  console.log(`${total} policy options; ${unnumbered.length} carry no number.\n`)
  if (!unnumbered.length) { console.log('Nothing to do.'); return }

  const byIdea = new Map<string, typeof unnumbered>()
  for (const r of unnumbered) {
    if (!byIdea.has(r.ideaId)) byIdea.set(r.ideaId, [])
    byIdea.get(r.ideaId)!.push(r)
  }
  console.log(`across ${byIdea.size} idea(s):\n`)

  let planned = 0
  const plan: Array<{ id: string; number: number; ideaId: string; approach: string }> = []
  for (const [ideaId, rows] of byIdea) {
    // ⚠ THE WHOLE IDEA'S ROWS, not only the unnumbered ones — `nextNumber` has to see the
    // numbers already taken or it will hand out one of them again.
    const all = await prisma.policyOption.findMany({
      where: { ideaId }, select: { number: true },
    })
    let n = nextNumber(all)
    for (const r of rows) {
      plan.push({ id: r.id, number: n, ideaId, approach: r.approach })
      n++
      planned++
    }
    console.log(`  ${ideaId.slice(0, 8)}  ${rows.length} to number, starting at ${nextNumber(all)}`)
  }

  console.log('\n── three of them ──')
  for (const p of plan.slice(0, 3)) {
    console.log(`  ${p.ideaId.slice(0, 8)}  → [${p.number}] ${p.approach.slice(0, 80)}`)
  }

  if (!WRITE) { console.log(`\nDry run. ${planned} rows would be numbered. Re-run with --write.\n`); return }

  for (const p of plan) {
    await prisma.policyOption.update({ where: { id: p.id }, data: { number: p.number } })
  }

  // ⚠⚠ RE-READ AND REPORT THE RE-READ, and check for the failure that would matter: a duplicate
  // number within one idea. "Updated" is a claim about a call.
  const stillNull = await prisma.policyOption.count({ where: { number: null } })
  const dupes = await prisma.$queryRaw<Array<{ ideaId: string; number: number; n: bigint }>>`
    SELECT "ideaId", "number", COUNT(*) AS n
    FROM "PolicyOption"
    WHERE "number" IS NOT NULL
    GROUP BY "ideaId", "number"
    HAVING COUNT(*) > 1`
  console.log(`\nwrote ${plan.length}.`)
  console.log(`re-read: ${stillNull} still unnumbered; ${dupes.length} (idea, number) collisions.`)
  if (dupes.length) {
    for (const d of dupes.slice(0, 5)) console.log(`  ⚠ ${d.ideaId.slice(0, 8)} number ${d.number} × ${d.n}`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
