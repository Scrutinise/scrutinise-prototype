// ─────────────────────────────────────────────────────────────────────────────
// CCW-B14a/B14b — PRE-FLIGHT. Reports, changes nothing.
//
// The four numbers B14b asks for before step 2, plus the two pre-flights B14a
// names. Read-only: it enqueues nothing and writes nothing.
//
//   npx tsx --env-file=.env scripts/b14-preflight.ts
//
// ⚠ The allowance is read through `readAllowance()`, the function the product
// itself uses, rather than recomputed here. B14b's own trap #2 — that an
// explicit grant cannot be told from the number — is exactly the kind of rule
// that a re-implementation gets subtly wrong, and this repo has been bitten by
// a restated predicate before.
// ─────────────────────────────────────────────────────────────────────────────

// ⚠ BEFORE the import — `build-config` reads the environment at module load.
// Same reason and same placement as scripts/check-lex-25t-1b.ts:28.
process.env.LEX_BUILD_DRIVER = 'worker'

import { prisma } from '../lib/prisma'
import { readAllowance, FULL_BUILD_THIRDS, ALLOWANCE_EPOCH, PILOT_ALLOWANCE_THIRDS } from '../lib/lex/allowance'
import { buildDriver, WORKER_CONCURRENCY } from '../lib/lex/build-config'
import { looksLikeASolution } from '../lib/lex/method'
import { readFileSync } from 'fs'
import { join } from 'path'

const INPUTS = join(__dirname, '../../docs/report_run/lex_build_inputs.json')
const BUILDS_WANTED = 12

async function main() {
  console.log('══ CCW-B14 pre-flight ══════════════════════════════════════════\n')

  // ── pre-flight 1: the driver ────────────────────────────────────────────
  console.log('1. BUILD DRIVER')
  console.log(`   process.env.LEX_BUILD_DRIVER (forced in this process) = ${process.env.LEX_BUILD_DRIVER}`)
  console.log(`   buildDriver() = ${buildDriver()}   ${buildDriver() === 'worker' ? '✔' : '⚠ NOT worker — enqueued builds would sit unclaimed'}`)
  console.log(`   WORKER_CONCURRENCY = ${WORKER_CONCURRENCY} (serial, as B14a requires)\n`)

  // ── the four numbers ────────────────────────────────────────────────────
  console.log('2. ALLOWANCE — B14b\'s four numbers')
  const candidates = await prisma.user.findMany({
    where: { email: { in: ['cl@scrutinise.org', 'charlieleach1@gmail.com'] } },
    select: { id: true, email: true, buildAllowanceThirds: true, buildAllowanceNote: true, _count: { select: { ideas: true } } },
  })
  for (const u of candidates) {
    const a = await readAllowance(u.id)
    console.log(`\n   ${u.email}  (${u.id})`)
    console.log(`     ideas owned            : ${u._count.ideas}`)
    // ⚠ B14b trap #2: "explicitly granted" is read off the NOTE, never the number.
    console.log(`     buildAllowanceNote set : ${u.buildAllowanceNote ? 'YES — explicit grant' : 'no — running on the default'}`)
    if (u.buildAllowanceNote) console.log(`       note: ${u.buildAllowanceNote}`)
    console.log(`     (1) grantedThirds      : ${a?.grantedThirds ?? '(unreadable)'}`)
    console.log(`     (2) spentThirds        : ${a?.spentThirds ?? '(unreadable)'}   [DONE builds since ${ALLOWANCE_EPOCH.toISOString()}]`)
    console.log(`     (3) remainingThirds    : ${a?.remainingThirds ?? '(unreadable)'}   → ${a?.remainingBuilds ?? '?'} full builds`)
    console.log(`     canStartFull           : ${a?.canStartFull}`)
    const need = BUILDS_WANTED * FULL_BUILD_THIRDS
    const rem = a?.remainingThirds ?? 0
    console.log(`     twelve builds need ${need} thirds → ${rem >= need ? `✔ ENOUGH (${rem} remaining)` : `⚠ SHORT BY ${need - rem}`}`)
  }
  console.log(`\n   For reference: FULL_BUILD_THIRDS=${FULL_BUILD_THIRDS}, PILOT_ALLOWANCE_THIRDS=${PILOT_ALLOWANCE_THIRDS}`)
  console.log('   ⚠ PILOT_ALLOWANCE_THIRDS applies ONLY to users with no explicit grant, so it is')
  console.log('     irrelevant to any account whose note is set. Raising it would not help them.')

  // ── the problem gate, on all twelve, measured not assumed ───────────────
  console.log('\n3. PROBLEM GATE — the deterministic arm, run over all twelve inputs')
  console.log('   ⚠ This is `looksLikeASolution()` imported from lib/lex/method.ts — the same')
  console.log('     function the elicitation calls. It is the DETERMINISTIC reading only; the')
  console.log('     model press that follows it is not exercised here.\n')
  const inputs = JSON.parse(readFileSync(INPUTS, 'utf8'))
  let fired = 0
  for (const m of inputs.measures) {
    const shaped = looksLikeASolution(m.elicitation.problem)
    if (shaped) fired++
    console.log(`   ${m.ref}  gate ${shaped ? '⚠ FIRES ' : 'silent '}  ${String(m.idea.title).slice(0, 58)}`)
  }
  console.log(`\n   ${fired} of ${inputs.measures.length} problem statements read as solution-shaped.`)

  // ── what is already in the database ─────────────────────────────────────
  console.log('\n4. EXISTING STATE')
  const refs: string[] = inputs.measures.map((m: any) => m.ref)
  const existing = await prisma.idea.findMany({
    where: { title: { in: inputs.measures.map((m: any) => m.idea.title) } },
    select: { id: true, title: true, creatorId: true, archivedAt: true, deletedAt: true },
  })
  console.log(`   Ideas already present with one of the twelve titles: ${existing.length}`)
  for (const e of existing) console.log(`     ${e.id} | ${e.title.slice(0, 60)}`)
  const active = await prisma.ideaBuild.count({ where: { status: { in: ['QUEUED', 'RUNNING'] } } })
  console.log(`   IdeaBuild rows currently QUEUED or RUNNING (anywhere): ${active}`)
  console.log(`   refs in the input file: ${refs.join(', ')}`)

  await prisma.$disconnect()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
