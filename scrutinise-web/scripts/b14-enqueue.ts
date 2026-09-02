// ─────────────────────────────────────────────────────────────────────────────
// CCW-B14a — CREATE THE IDEA AND ELICITATION FOR ONE MEASURE, AND ENQUEUE ITS BUILD.
//
//   npx tsx --env-file=.env scripts/b14-enqueue.ts M-01          (plan — writes nothing)
//   npx tsx --env-file=.env scripts/b14-enqueue.ts M-01 --go
//
// One ref per invocation, on purpose. B14a: "M-01 alone. Stop. Report." and then the
// remaining eleven drained serially. A script that took a list would make it one keystroke
// to run all twelve before anyone had seen a build.
//
// ⚠ B14b §1 — `visibility`, `status` and `stage` ARE NOT SET. They default to PRIVATE,
// DRAFT, STAGE_1, which puts the twelve in Charlie's own My Ideas list and nowhere else.
// ─────────────────────────────────────────────────────────────────────────────

// ⚠ BEFORE the import — `build-config` reads the environment at module load, and
// `claimBuild` branches on `buildDriver()`. Same placement and same reason as
// scripts/check-lex-25t-1b.ts:28, which forces it deliberately for exactly this.
process.env.LEX_BUILD_DRIVER = 'worker'

import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { claimBuild } from '../lib/lex/build'
// ⚠ `framing` is REQUIRED by claimBuild — it is the API route, not the engine, that
// supplies the default (`isFraming(body.framing) ? body.framing : DEFAULT_FRAMING`).
// Passing undefined here failed with "Argument `framing` is missing" AFTER the Idea row
// had been created, which is why this script now resumes an idea that has no build
// rather than treating "the title exists" as "the work is done".
import { buildDriver, DEFAULT_FRAMING } from '../lib/lex/build-config'
import { looksLikeASolution } from '../lib/lex/method'
import { GOAL_KINDS } from '../lib/lex/elicitation-config'

const INPUTS = join(__dirname, '../../docs/report_run/lex_build_inputs.json')
const OWNER_EMAIL = 'cl@scrutinise.org'
const REF = process.argv[2]
const GO = process.argv.includes('--go')

/**
 * ⚠⚠ CCW'S `goalKind` VALUES ARE PROSE; THE COLUMN IS AN ENUM KEY.
 *
 * `elicitationContext` resolves the label with `GOAL_KINDS.find(g => g.key === row.goalKind)`
 * and falls back to the string "not stated". So writing CCW's sentence into the column
 * would leave every build reading its goal kind as NOT STATED while the sentence sat
 * unused one column over — a silent degradation that looks identical to a correct row.
 *
 * The mapping is therefore explicit and declared, the original is preserved verbatim in
 * the export, and CCW is asked to confirm it before the remaining eleven. Nothing is
 * reworded: the full remedy is in `goalDetail`, which IS what the build reads.
 */
/**
 * ⚠ CCW'S TABLE (B15 §5), NOT MINE. Their rule: *use the instrument the proposer names or
 * clearly implies; where he names none, `UNSURE`, because inventing an instrument for him
 * is what this report exists not to do.* Mine differed on three rows and theirs is right
 * on all three — M-06 needs statute whatever the target, M-09 has no statute saying
 * self-identification to repeal, and M-10 names no instrument at all.
 *
 * ⚠⚠ The distribution is itself a finding: a programme described throughout as a REPEAL
 * programme has two measures with no statute to repeal and one with no stated instrument.
 */
const GOAL_KIND_MAP: Record<string, string> = {
  'M-01': 'LAW_CHANGE',          // repeal and leave
  'M-02': 'LAW_CHANGE',          // repeal
  'M-03': 'LAW_CHANGE',          // abolition needs CRA 2005 Pt 3 repealed
  'M-04': 'LAW_CHANGE',          // each body has a founding statute
  'M-05': 'LAW_CHANGE',          // restricting JR needs statute
  'M-06': 'LAW_CHANGE',          // ⚠ target ambiguous (1854 vs CRAG Pt 1) but any reversal needs statute
  'M-07': 'LAW_CHANGE',          // independence conferred by the Bank of England Act 1998
  'M-08': 'APPLICATION_CHANGE',  // ⚠ the complaint is about practice, not statute
  'M-09': 'APPLICATION_CHANGE',  // ⚠ self-identification was never enacted — no statute to repeal
  'M-10': 'UNSURE',              // ⚠ he names no instrument; legislation, grant conditions and guidance are all available
  'M-11': 'LAW_CHANGE',          // statutory body
  'M-12': 'LAW_CHANGE',          // one omnibus Act
}

/**
 * The confirmation paragraph. Assembled from the user's OWN fields — it restates and
 * invents nothing.
 *
 * ⚠ It is not build input. `elicitationContext` reads problem, goalKind, goalDetail,
 * ruledOut and ownKnowledge, and never `understanding`; this exists so the row looks to
 * the product like one a person confirmed, and so the browser cross-check in B14b §1 has
 * something to show.
 */
function understandingFrom(e: any): string {
  return [
    `You have described the problem as: ${e.problem}`,
    `What you want is ${String(e.goalKind).toLowerCase()} — specifically: ${e.goalDetail}`,
    `You have ruled out: ${e.ruledOut}`,
    `And you have told me what you already know that we would not find: ${e.ownKnowledge}`,
  ].join('\n\n')
}

async function main() {
  if (!REF) { console.error('usage: b14-enqueue.ts <ref e.g. M-01> [--go]'); process.exit(2) }
  const inputs = JSON.parse(readFileSync(INPUTS, 'utf8'))
  const m = inputs.measures.find((x: any) => x.ref === REF)
  if (!m) { console.error(`no measure ${REF} in ${INPUTS}`); process.exit(2) }

  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true, email: true } })
  if (!owner) { console.error(`owner ${OWNER_EMAIL} not found`); process.exit(2) }

  const mappedKind = GOAL_KIND_MAP[REF]
  const validKey = GOAL_KINDS.some(g => g.key === mappedKind)
  const gateFires = looksLikeASolution(m.elicitation.problem)

  console.log(`── ${REF} ─────────────────────────────────────────────`)
  console.log(`  driver        : ${buildDriver()}${buildDriver() === 'worker' ? '' : '  ⚠ NOT worker'}`)
  console.log(`  owner         : ${owner.email}`)
  console.log(`  title         : ${m.idea.title}`)
  console.log(`  goalKind      : "${m.elicitation.goalKind}"`)
  console.log(`                  → mapped to ${mappedKind} ${validKey ? '(valid key)' : '⚠ NOT A VALID KEY'}`)
  console.log(`  problem gate  : ${gateFires ? '⚠ FIRES' : 'silent'}  (deterministic arm, looksLikeASolution)`)
  console.log(`  sourcing      : ${m.sourcing}   from ${(m.source_proposals ?? []).join(', ')}`)

  const existing = await prisma.idea.findFirst({
    where: { creatorId: owner.id, title: m.idea.title, deletedAt: null },
    select: { id: true },
  })
  if (existing) {
    console.log(`\n  ⚠ AN IDEA WITH THIS TITLE ALREADY EXISTS: ${existing.id}`)
    console.log('    Not creating a second. Re-running this script is safe; it will not duplicate.')
    const b = await prisma.ideaBuild.findMany({
      where: { ideaId: existing.id }, select: { id: true, version: true, status: true },
      orderBy: { version: 'desc' }, take: 3,
    })
    for (const x of b) console.log(`    build v${x.version} ${x.status} ${x.id}`)
    // ⚠ AN IDEA WITH NO BUILD IS A HALF-DONE ENQUEUE, NOT A COMPLETED ONE. The first run
    // created the Idea and then failed on claimBuild, and reporting "already exists" for
    // that state would have left the measure permanently unbuilt while looking handled.
    // ⚠ --rebuild IS ITS OWN FLAG, not implied by --go. A measure that already has a DONE
    // build is the normal state after step 1, and making --go silently start a second one
    // would make a re-run indistinguishable from a first run — and spend three more thirds
    // each time somebody re-checked their work.
    const REBUILD = process.argv.includes('--rebuild')
    if (!b.length || REBUILD) {
      if (!GO) {
        console.log(`\n    → ${b.length ? 'a --rebuild was asked for' : 'it has NO build'}. Re-run with --go to enqueue.`)
        await prisma.$disconnect(); return
      }
      if (b.length && REBUILD) {
        console.log(`\n    → --rebuild: enqueueing v${(b[0].version ?? 0) + 1} against this idea. ⚠ This spends 3 more thirds.`)
      }
      const resumedId = await claimBuild(existing.id, DEFAULT_FRAMING, false, 'FULL')
      const st = await prisma.ideaBuild.findUnique({
        where: { id: resumedId }, select: { id: true, version: true, status: true, mode: true },
      })
      console.log(`\n  ✔ build   ${st?.id}  v${st?.version}  ${st?.status}  mode=${st?.mode}  (enqueued against the existing idea)`)
      console.log(`\n  Now drain it:  npx tsx --env-file=.env scripts/build-worker.ts --once`)
    }
    await prisma.$disconnect(); return
  }

  if (!GO) {
    console.log('\n  PLAN ONLY — nothing written. Re-run with --go to create and enqueue.')
    await prisma.$disconnect(); return
  }

  const idea = await prisma.idea.create({
    data: {
      creatorId: owner.id,
      title: m.idea.title,
      summaryDescription: m.idea.summaryDescription,
      govtArea: m.idea.govtArea,
      country: m.idea.country ?? 'GB',
      // visibility / status / stage deliberately omitted — B14b §1.
    },
    select: { id: true },
  })

  await prisma.ideaElicitation.create({
    data: {
      ideaId: idea.id,
      problem: m.elicitation.problem,
      // ⚠ MEASURED, NOT DEFAULTED. Creating the row directly bypasses the chat flow, so
      // this column would otherwise sit at its `false` default and read as "the gate was
      // evaluated and stayed silent" when in truth nothing had evaluated it. It is set
      // from the same function the elicitation calls.
      problemGateFired: gateFires,
      problemPresses: 0,
      goalKind: mappedKind,
      goalDetail: m.elicitation.goalDetail,
      ruledOut: m.elicitation.ruledOut,
      ownKnowledge: m.elicitation.ownKnowledge,
      understanding: understandingFrom(m.elicitation),
      status: 'CONFIRMED',
      confirmedAt: new Date(),
    },
  })

  // ⚠ DEFAULT_FRAMING, not undefined. `framing` is required by claimBuild — it is the API
  // route that supplies the default, not the engine. This was fixed in the resume branch
  // above when M-01 hit it and NOT here, so the first NEW idea after that (M-02) failed
  // the same way, after its Idea row had been created. One fix, two call sites, and only
  // the site that had already failed got it.
  const buildId = await claimBuild(idea.id, DEFAULT_FRAMING, false, 'FULL')
  const state = await prisma.ideaBuild.findUnique({
    where: { id: buildId }, select: { id: true, version: true, status: true, mode: true },
  })
  console.log(`\n  ✔ idea    ${idea.id}`)
  console.log(`  ✔ build   ${state?.id}  v${state?.version}  ${state?.status}  mode=${state?.mode}`)
  console.log(`\n  Now drain it:  npx tsx --env-file=.env scripts/build-worker.ts --once`)
  await prisma.$disconnect()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
