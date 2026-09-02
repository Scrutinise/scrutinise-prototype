// ─────────────────────────────────────────────────────────────────────────────
// A one-off build-allowance grant, written the way `PATCH /api/admin/allowance` writes it.
//
// ⚠⚠ THE NOTE IS NOT OPTIONAL, AND IT IS NOT DECORATION. `buildAllowanceThirds` has a database
// default of 4, so a user nobody has touched is INDISTINGUISHABLE BY VALUE from one an admin
// deliberately set to 4. `grantedExplicitly` is read off the note's presence, not off the number.
// A grant written without one is a grant the product cannot tell from a default.
//
// ⚠ IT REPORTS BY RE-READING. The values printed at the end come from `readAllowance()` — the
// same function the page calls — after the write, not from the arguments that were passed in.
//
// Usage:
//   npx tsx --env-file=.env scripts/grant-allowance.ts <email> <thirds> "<reason>"        (plan)
//   npx tsx --env-file=.env scripts/grant-allowance.ts <email> <thirds> "<reason>" --write
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { readAllowance, PILOT_ALLOWANCE_THIRDS, FULL_BUILD_THIRDS, REUSE_BUILD_THIRDS } from '../lib/lex/allowance'

const [, , email, thirdsArg, reason] = process.argv
const WRITE = process.argv.includes('--write')
const thirds = Number(thirdsArg)

async function main() {
  if (!email || !Number.isInteger(thirds) || thirds < 0 || !reason) {
    console.log('usage: grant-allowance.ts <email> <thirds> "<reason>" [--write]')
    process.exit(1)
  }

  const user = await prisma.user.findFirst({
    where: { email }, select: { id: true, email: true, buildAllowanceThirds: true, buildAllowanceNote: true },
  })
  if (!user) { console.log(`No user with email ${email}`); process.exit(1) }

  console.log(`\n${user.email}`)
  console.log(`  before: buildAllowanceThirds=${user.buildAllowanceThirds}`)
  console.log(`  before: buildAllowanceNote=${JSON.stringify(user.buildAllowanceNote)}`)

  if (!WRITE) {
    console.log(`\n  would set to ${thirds} thirds. Plan only. Re-run with --write.\n`)
    await prisma.$disconnect(); return
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      buildAllowanceThirds: thirds,
      buildAllowanceNote: `${reason} — set to ${thirds} thirds by cl@scrutinise.org on `
        + `${new Date().toISOString().slice(0, 16)}Z (was ${user.buildAllowanceThirds})`,
    },
  })

  // ── ⚠ EVERYTHING BELOW IS READ BACK, NOT REPEATED FROM THE ARGUMENTS ──────────
  const after = await prisma.user.findUnique({
    where: { id: user.id }, select: { buildAllowanceThirds: true, buildAllowanceNote: true },
  })
  const a = await readAllowance(user.id)

  console.log(`\n── read back from the database ──`)
  console.log(`  buildAllowanceThirds : ${after?.buildAllowanceThirds}`)
  console.log(`  buildAllowanceNote   : ${after?.buildAllowanceNote}`)
  console.log(`\n── read back through readAllowance(), the function the page calls ──`)
  console.log(`  grantedThirds        : ${a.grantedThirds}`)
  console.log(`  grantedExplicitly    : ${a.grantedExplicitly}`)
  console.log(`  spentThirds          : ${a.spentThirds}`)
  console.log(`  remainingThirds      : ${a.remainingThirds}`)
  console.log(`  remainingBuilds      : ${a.remainingBuilds}`)
  console.log(`  canStartFull         : ${a.canStartFull}`)
  console.log(`  line                 : ${a.line}`)

  console.log(`\n── the PILOT default, read from configuration (unchanged by this grant) ──`)
  console.log(`  PILOT_ALLOWANCE_THIRDS : ${PILOT_ALLOWANCE_THIRDS}`)
  console.log(`  FULL_BUILD_THIRDS      : ${FULL_BUILD_THIRDS}`)
  console.log(`  REUSE_BUILD_THIRDS     : ${REUSE_BUILD_THIRDS}`)
  // ⚠⚠ AND THE CONFIGURATION CANNOT EXPRESS "3 BUILDS AND 3 RE-RUNS". It expresses a BUDGET of
  // 12 thirds. The intended composition — 3 full (9) + 3 reuse (3) — is recorded in the comment
  // beside the constant and enforced by nothing: the thirds are fungible, so a pilot user may
  // spend the same 12 on 4 full builds and no re-runs. Printing "3 builds and 3 re-runs" here
  // would report the intention as though it were the mechanism.
  console.log(`  → a budget of ${PILOT_ALLOWANCE_THIRDS} thirds. The intended split is`
    + ` 3 full builds (${3 * FULL_BUILD_THIRDS}) + 3 re-runs (${3 * REUSE_BUILD_THIRDS}).`)
  console.log(`    ⚠ but thirds are fungible: the same budget also buys`
    + ` ${PILOT_ALLOWANCE_THIRDS / FULL_BUILD_THIRDS} full builds and no re-runs.`)
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
