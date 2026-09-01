// ─────────────────────────────────────────────────────────────────────────────
// 25-Q §2c — MEASURE THE OUTPUTS WAIT, AND SAY WHICH CAUSE IT IS.
//
// §2c: *"the wait when opening Outputs was about five seconds with nothing on screen, and the
// same on the second open. If a report is being assembled, say 'Building reports'. If it is not
// being assembled, the delay has another cause — measure it and report which."*
//
// ⚠⚠ THE SECOND HALF IS THE INSTRUCTIVE ONE: "and the same on the second open". A wait that does
// not shrink on a repeat is not generation — generation caches. That already points away from
// "Building reports" and towards a read that is expensive every time, which is what 25-N §5d
// found: `readProposalExportStatus` called `buildProposalSnapshot` — the whole twelve-table
// assembler — on every GET, purely to hash it for a staleness flag, BEFORE the panel could paint
// a single filename.
//
// So this measures the two reads the panel actually makes, in order, against a real idea:
//   1. `?quick=1` — what the document rows know. This is what paints.
//   2. the full read — the same, plus the staleness hash.
//
// ⚠ IT MEASURES SERVER TIME, NOT A BROWSER. A browser number folds in Clerk, the network and
// React; this isolates the half we can fix, and says so rather than claiming to be the wait the
// user felt.
//
// Usage: npm run measure:outputs-open [ideaIdPrefix]
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { readProposalExportStatus } from '../lib/documents/proposal-export'

async function time<T>(label: string, fn: () => Promise<T>): Promise<{ label: string; ms: number; value: T }> {
  const t0 = Date.now()
  const value = await fn()
  return { label, ms: Date.now() - t0, value }
}

async function main() {
  const prefix = process.argv[2] ?? '452c5ade'
  const idea = await prisma.idea.findFirst({
    where: { id: { startsWith: prefix } }, select: { id: true, title: true },
  })
  if (!idea) { console.log(`No idea starting "${prefix}"`); process.exit(1) }
  console.log(`\n── 25-Q §2c — opening Outputs on ${idea.id.slice(0, 8)} "${idea.title?.slice(0, 46)}" ──\n`)

  // ⚠ A COLD FIRST CALL AND THEN A REPEAT, because §2c's own evidence is that the second open was
  // no faster. If the repeat is as slow as the first, nothing is being cached and "generation" is
  // ruled out by arithmetic rather than by reading the code.
  const runs: Array<{ label: string; ms: number }> = []
  for (const pass of [1, 2]) {
    const quick = await time(`quick=1  (pass ${pass})`, () => readProposalExportStatus(idea.id, { quick: true }))
    const full = await time(`full     (pass ${pass})`, () => readProposalExportStatus(idea.id))
    runs.push({ label: quick.label, ms: quick.ms }, { label: full.label, ms: full.ms })
    if (pass === 1) {
      console.log(`  ${quick.value.length} document rows; `
        + `${quick.value.filter((d) => d.generatedAt).length} generated.`)
      // ⚠⚠ SCOPED TO THE GENERATED ROWS, AND THE FIRST VERSION OF THIS LINE WAS NOT — it asked
      // whether `stale` was null on EVERY row and reported "the quick read is doing the expensive
      // work" because two of four rows had never been generated. An ungenerated file cannot be
      // out of date, so `false` is the right answer for it and always available without the hash.
      // The measurement was asking the wrong question and would have sent someone to fix
      // correct code.
      const gen = quick.value.filter((d) => d.generated)
      console.log(`  staleness on the quick read: `
        + `${gen.length === 0 ? 'no generated rows to check'
          : gen.every((d) => d.stale === null)
            ? `null on all ${gen.length} generated rows (unchecked, as designed)`
            : 'ANSWERED — the quick read is doing the expensive work'}`)
    }
  }

  console.log()
  for (const r of runs) console.log(`  ${r.label}  ${String(r.ms).padStart(6)} ms`)

  const q1 = runs[0].ms, f1 = runs[1].ms, q2 = runs[2].ms, f2 = runs[3].ms
  console.log('\n── what that says ──')
  console.log(`  first paint waits ${q1} ms, not ${f1} ms — the staleness read is behind it.`)
  // ⚠ THE ARITHMETIC IS THE ARGUMENT. A repeat within a few percent of the first call is not a
  // cache miss; it is work being done again.
  const repeatRatio = f1 > 0 ? f2 / f1 : 1
  console.log(`  the full read repeats at ${Math.round(repeatRatio * 100)}% of its first time `
    + `(${f1} → ${f2} ms) — ${repeatRatio > 0.7 ? 'nothing is cached, so this is a re-read, not generation'
      : 'something is cached between calls'}.`)
  console.log(`  → the delay is ${q1 > 1500 ? 'STILL IN THE FIRST PAINT' : 'no longer in the first paint'}; `
    + `"Building reports" would be ${q1 > 1500 ? 'worth saying' : 'the wrong sentence — nothing is being built'}.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
