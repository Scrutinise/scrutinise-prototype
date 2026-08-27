// ─────────────────────────────────────────────────────────────────────────────
// 25-I §5 — put back the evidence that the MOVE-based carry took off a build.
//
// `carryEvidenceForward` used to move rows rather than copy them (fixed this sprint). Any
// build that was CLAIMED and then failed or was cancelled before running a pass took the
// source build's research with it, permanently. This finds those rows — evidence sitting on
// a version whose build never produced it — and returns them to the last build that did.
//
// ⚠ TARGETS ONLY BUILDS THAT RAN NO PASSES. A build that failed at pass 5 legitimately owns
// the evidence carried to it: it read it. The damage case is specifically a version whose
// build did zero work and yet holds another version's findings.
//
// Usage:
//   tsx --env-file=.env scripts/restore-stranded-evidence.ts            (dry run)
//   tsx --env-file=.env scripts/restore-stranded-evidence.ts --execute
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'

async function main() {
  const execute = process.argv.includes('--execute')

  // Builds that hold evidence but ran nothing.
  const dead = await prisma.ideaBuild.findMany({
    where: { status: { in: ['CANCELLED', 'FAILED'] }, passesComplete: 0 },
    select: { id: true, ideaId: true, version: true, status: true },
  })

  let moved = 0
  for (const b of dead) {
    const held = await prisma.evidenceItem.count({
      where: { ideaId: b.ideaId, runVersion: b.version },
    })
    if (!held) continue

    // The most recent build BELOW this one that actually completed passes — the run that
    // produced this research and should still show it.
    const owner = await prisma.ideaBuild.findFirst({
      where: { ideaId: b.ideaId, version: { lt: b.version }, passesComplete: { gt: 0 } },
      orderBy: { version: 'desc' },
      select: { version: true, status: true, passesComplete: true },
    })
    if (!owner) {
      console.log(`  ${b.ideaId.slice(0, 8)} v${b.version} (${b.status}, 0 passes) holds ${held} rows — no earlier build to return them to; LEAVING ALONE`)
      continue
    }

    console.log(`  ${b.ideaId.slice(0, 8)} v${b.version} (${b.status}, 0 passes) holds ${held} rows → return to v${owner.version} (${owner.status}, ${owner.passesComplete} passes)`)
    if (!execute) continue

    const res = await prisma.evidenceItem.updateMany({
      where: { ideaId: b.ideaId, runVersion: b.version },
      data: { runVersion: owner.version },
    })
    await prisma.deepeningPass.updateMany({
      where: { ideaId: b.ideaId, runVersion: b.version },
      data: { runVersion: owner.version },
    })
    // ⚠ RE-READ. Not the updateMany count — the rows themselves, counted again.
    const leftBehind = await prisma.evidenceItem.count({
      where: { ideaId: b.ideaId, runVersion: b.version },
    })
    const arrived = await prisma.evidenceItem.count({
      where: { ideaId: b.ideaId, runVersion: owner.version },
    })
    console.log(`     updated ${res.count}; re-read: ${leftBehind} left on v${b.version}, ${arrived} now on v${owner.version} ` +
      `${leftBehind === 0 ? '✓' : '✗ SOME STAYED'}`)
    moved += res.count
  }

  if (!execute) console.log(`\n⚠ DRY RUN — pass --execute. Nothing changed.`)
  else console.log(`\n${moved} evidence rows returned.`)
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
