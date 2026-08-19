// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A §6 — "Hitting the 15-minute or cost ceiling produces an honest FAILED,
// never a truncated draft." Verified by MAKING IT HAPPEN, not by reading the code.
//
// The ceilings are read from the environment at module load, so they cannot be moved at
// runtime. This script therefore does ONE build with whatever ceilings the environment
// gives it, and asserts that the outcome is the one the configuration implies:
//
//   LEX_BUILD_HARD_STOP_MS=1     → the time ceiling must fire before any pass runs
//   LEX_BUILD_COST_PENCE=0.0001  → the cost ceiling must fire after the first pass
//   (neither set)                → the build must finish DONE
//
// ⚠ THE POINT IS THE THIRD CASE AS MUCH AS THE FIRST TWO. A ceiling that always fires
// looks identical, from a one-sided test, to a ceiling that works. Run all three.
//
// It also asserts the thing the brief actually cares about: whatever the build managed
// to draft BEFORE stopping is still there. A ceiling must truncate the RUN, never the
// draft, and it must never be reported as a completed build.
// ─────────────────────────────────────────────────────────────────────────────

// ⚠ 25-B UPDATE — THE TIME CEILING UNDER TEST HAS CHANGED, AND SO HAS HOW A BUILD RUNS.
//
// 25-A ran every pass in one call to `runBuild`, and the ceiling that could fire was the
// in-request budget. 25-B runs ONE PASS PER REQUEST (§1), so this harness now drives the
// same loop the client drives — `runNextPass` until there is no next pass — and the time
// ceiling under test is the WHOLE-BUILD hard stop, which is measured from the stored
// `startedAt` and is therefore reachable for the first time.
//
// Usage (run all three, in order):
//   LEX_BUILD_HARD_STOP_MS=1    npx tsx --env-file=.env scripts/verify-build-25a-ceilings.ts
//   LEX_BUILD_COST_PENCE=0.0001 npx tsx --env-file=.env scripts/verify-build-25a-ceilings.ts
//                               npx tsx --env-file=.env scripts/verify-build-25a-ceilings.ts

import { prisma } from '../lib/prisma'
import { claimBuild, runNextPass } from '../lib/lex/build'
import { effectiveBudgetMs, COST_CEILING_PENCE, HARD_STOP_MS, BUILD_PASSES } from '../lib/lex/build-config'

/**
 * Drive the build the way the client does: run a pass, read the state, run the next.
 * The loop is bounded by the pass count plus a small margin — an unbounded "until DONE"
 * loop against a build that refuses to advance is an infinite loop in a verifier, which
 * is a worse failure than the one being tested.
 */
async function driveBuild(ideaId: string, userId: string, buildId: string) {
  let view = await runNextPass(ideaId, userId, buildId)
  for (let i = 0; i < BUILD_PASSES.length + 2 && view.nextPass; i++) {
    view = await runNextPass(ideaId, userId, buildId)
  }
  return view
}

let pass = 0
let fail = 0
function assert(ok: boolean, name: string, detail = '') {
  if (ok) { pass++; console.log(`  ✓  ${name}`) }
  else { fail++; console.log(`  ✗  ${name}${detail ? `\n       ${detail}` : ''}`) }
}

const PROBLEM =
  'Our council moved to fortnightly bin collections and the side streets are now permanently full of ' +
  'fly-tipped rubbish. The published standard says weekly for flats above shops and that has simply ' +
  'stopped happening; nobody enforces it and nobody answers a complaint.'

async function main() {
  const budget = effectiveBudgetMs()
  const tinyTime = HARD_STOP_MS < 5_000
  const tinyCost = COST_CEILING_PENCE < 0.01
  const expect = tinyTime ? 'time' : tinyCost ? 'cost' : 'complete'

  console.log('── verify:build-25a-ceilings ──')
  console.log(`pass budget ${budget.ms}ms (${budget.binding}) · hard stop ${HARD_STOP_MS}ms · ` +
    `cost ceiling ${COST_CEILING_PENCE}p · ${BUILD_PASSES.length} passes · expecting: ${expect}`)

  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } })
  if (!user) { console.error('no user to own the throwaway idea'); process.exit(1) }

  const idea = await prisma.idea.create({
    data: {
      creatorId: user.id,
      title: `[25-A ceiling verification · ${expect}] throwaway — deleted at the end`,
      summaryDescription: '', govtArea: '', stage: 'STAGE_1', visibility: 'PRIVATE', status: 'DRAFT',
    },
    select: { id: true },
  })
  await prisma.ideaElicitation.create({
    data: {
      ideaId: idea.id,
      problem: PROBLEM,
      goalKind: 'APPLICATION_CHANGE',
      goalDetail: 'Hold the council to the standard it publishes.',
      ruledOut: 'A new national Act.',
      ownKnowledge: 'A depot supervisor told me two rounds were merged with no public notice.',
      ownKnowledgeProvenance: 'USER_TESTIMONY',
      profileSkipped: true,
      understanding: '[CEILING-VERIFICATION STUB — not written by Lex.]',
      status: 'CONFIRMED',
      confirmedAt: new Date(),
    },
  })

  try {
    const buildId = await claimBuild(idea.id, 'B_CONTEXTUALISED')
    const view = await driveBuild(idea.id, user.id, buildId)
    console.log(`\nresult: ${view.status} · ${view.passesComplete}/${view.passesTotal} passes · ${view.elapsedSeconds}s · ${view.spend.line}`)
    console.log(`reason: ${view.failureReason ?? '(none)'}\n`)

    if (expect === 'complete') {
      assert(view.status === 'DONE', 'with ordinary ceilings the build COMPLETES', `status ${view.status}`)
      assert(view.passesComplete === view.passesTotal, '   …every configured pass', `${view.passesComplete}/${view.passesTotal}`)
      assert(!view.failureReason, '   …with no failure reason', view.failureReason ?? '')

      // ── §4, and this is a guard against a real thing that happened ────────
      // The instrument choice is recorded BY THE PLATFORM under one canonical key, so
      // 25-C can find it without matching prose. Measured on 2026-08-17: every one of
      // six builds ALSO emitted an instrument fork of its own — `instrument:chosen`,
      // `instrument:type`, `instrument:regulatorRule` — so the same decision reached
      // the user twice under two names. The prompt now forbids it; this is what proves
      // the prompt worked, rather than the fix shipping inert.
      const keys = [...new Set(view.forks.map((f) => f.forkKey))]
      console.log(`fork keys: ${keys.join(' | ')}`)
      const instrumentish = keys.filter((k) => /instrument/i.test(k))
      assert(
        instrumentish.length === 1 && instrumentish[0] === 'guidingPolicy:instrument',
        '§4 the instrument decision is recorded EXACTLY ONCE, under the platform key',
        `instrument-ish fork keys: ${instrumentish.join(', ') || '(none)'}`,
      )
      const alts = view.forks.filter((f) => f.forkKey === 'guidingPolicy:instrument')
      assert(alts.length === 2, '   …with two alternatives', `${alts.length} alternatives`)
      assert(
        alts.every((a) => a.caseForAlternative.trim().length > 20),
        '   …each carrying a real case, not a token',
      )
      assert(keys.length >= 3, '   …and the build recorded other decisions too', `${keys.length} decision points`)
    } else {
      assert(view.status === 'FAILED', `the ${expect} ceiling produces a FAILED build`, `status ${view.status}`)
      assert(view.status !== 'DONE', '   …and NEVER a DONE build with a short draft in it')
      assert(!!view.failureReason, '   …with a plain reason a user can read', view.failureReason ?? '(none)')
      const words = expect === 'time' ? /ran out of time/i : /spend ceiling/i
      assert(words.test(view.failureReason ?? ''), `   …naming the ${expect} ceiling specifically`, view.failureReason ?? '')
      assert(
        view.passesComplete < view.passesTotal,
        '   …and reporting fewer than every pass',
        `${view.passesComplete}/${view.passesTotal}`,
      )
      assert(
        view.passes.some((p) => p.status === 'NOT_REACHED'),
        '   …with the passes it never got to marked NOT_REACHED, not "pending"',
      )
      // The draft is not truncated — what was written stays written.
      const rows = await prisma.ideaFieldState.count({ where: { ideaId: idea.id } })
      if (expect === 'cost') {
        assert(rows > 0, '   …and whatever it drafted before stopping is STILL THERE', `${rows} field rows`)
      } else {
        assert(rows === 0, '   …and nothing was half-written before the ceiling fired', `${rows} field rows`)
      }
      assert(
        (view.spend.tokensIn > 0) === (expect === 'cost'),
        `   …and the spend recorded matches what actually ran (${view.spend.tokensIn} in)`,
      )
    }
  } finally {
    await prisma.idea.delete({ where: { id: idea.id } }).catch((e) =>
      console.error('cleanup failed — remove by hand:', idea.id, e instanceof Error ? e.message : e))
    console.log(`cleaned up ${idea.id}`)
  }

  console.log(`\n${pass} passed, ${fail} failed.`)
  await prisma.$disconnect()
  process.exit(fail ? 1 : 0)
}

main().catch(async (e) => {
  console.error('ceiling verification threw:', e instanceof Error ? e.stack : e)
  await prisma.$disconnect()
  process.exit(1)
})
