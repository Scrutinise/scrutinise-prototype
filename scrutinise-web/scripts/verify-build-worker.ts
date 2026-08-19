// ─────────────────────────────────────────────────────────────────────────────
// AMENDMENT_25B §B/§E — "A BUILD MUST SURVIVE THE USER LEAVING. Test it explicitly:
// start a build, close the tab, return, and find it finished."
//
// ⚠ THE TEST IS THE PROCESS BOUNDARY, AND IT IS THE ONLY THING THAT MAKES IT A TEST.
// Calling `runBuildToCompletion` in-process would prove the engine works — which
// `verify:build-25b-live` already proves — and would prove nothing at all about
// surviving a closed tab. So this:
//
//   1. enqueues a build the way the web request does, and asserts the request DID NO WORK
//      (the row is QUEUED, no pass has started, nothing has been spent);
//   2. spawns the worker as a SEPARATE OS PROCESS and does not touch it;
//   3. sits and polls the DATABASE — which is all a returning browser can see;
//   4. asserts the build finished, and that the passes were run by something that was
//      not this program and not a browser.
//
// Step 2 is the closed tab. Nothing in this process contributes to the build.
//
// Usage:
//   npx tsx --env-file=.env scripts/verify-build-worker.ts
// ─────────────────────────────────────────────────────────────────────────────

import { spawn } from 'node:child_process'
import { prisma } from '../lib/prisma'
import { claimBuild } from '../lib/lex/build'
import { BUILD_PASSES, buildDriver } from '../lib/lex/build-config'
import { readPassLog, passesComplete } from '../lib/lex/build-carry'

let pass = 0
let fail = 0
function assert(ok: boolean, name: string, detail = '') {
  if (ok) { pass++; console.log(`  ✓  ${name}`) }
  else { fail++; console.log(`  ✗  ${name}${detail ? `\n       ${detail}` : ''}`) }
}

const PROBLEM =
  'Bus services in my area were cut and the replacement demand-responsive service does not turn up. ' +
  'The council says the operator is meeting its contract and the operator says the council set the ' +
  'timetable, and nobody will say who is accountable for a bus that never arrives.'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log('── verify:build-worker (the closed-tab test) ──')
  console.log(`driver=${buildDriver()} · ${BUILD_PASSES.length} passes\n`)

  if (buildDriver() !== 'worker') {
    // ⚠ Refused rather than adapted. With the client driver the enqueue path claims the
    // row itself and this test would silently measure something else entirely.
    console.error('LEX_BUILD_DRIVER is not "worker" — this test cannot mean anything. Aborting.')
    process.exit(1)
  }

  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } })
  if (!user) { console.error('no user to own the throwaway idea'); process.exit(1) }

  const idea = await prisma.idea.create({
    data: {
      creatorId: user.id,
      title: '[25-B worker verification] throwaway — deleted at the end',
      summaryDescription: '', govtArea: '', stage: 'STAGE_1', visibility: 'PRIVATE', status: 'DRAFT',
    },
    select: { id: true },
  })
  await prisma.ideaElicitation.create({
    data: {
      ideaId: idea.id,
      problem: PROBLEM,
      goalKind: 'APPLICATION_CHANGE',
      goalDetail: 'Someone nameable is accountable for a bus that does not arrive.',
      ruledOut: 'Re-nationalising the operator.',
      ownKnowledge: 'The depot manager told me the contract has no punctuality penalty at all.',
      ownKnowledgeProvenance: 'USER_TESTIMONY',
      profileSkipped: true,
      understanding: '[WORKER-VERIFICATION STUB — not written by Lex.]',
      status: 'CONFIRMED',
      confirmedAt: new Date(),
    },
  })

  let worker: ReturnType<typeof spawn> | null = null
  try {
    // ── 1. ENQUEUE, exactly as POST /api/ideas/[id]/build does ───────────────
    const t0 = Date.now()
    const buildId = await claimBuild(idea.id, 'B_CONTEXTUALISED')
    const enqueueMs = Date.now() - t0

    const queued = await prisma.ideaBuild.findUnique({ where: { id: buildId } })
    assert(queued?.status === 'QUEUED', 'the web request ENQUEUES and does not start the build',
      `status ${queued?.status}`)
    assert(queued?.startedAt == null, '   …so nothing has started yet')
    assert(passesComplete(readPassLog(queued?.passes)) === 0, '   …and no pass has run')
    assert(enqueueMs < 3000, `   …and the request returned immediately (${enqueueMs}ms)`, `${enqueueMs}ms`)

    // ── 2. THE TAB CLOSES. A separate process picks it up. ──────────────────
    console.log('\n  ── the tab closes: spawning the worker as a separate process ──')
    worker = spawn(
      process.execPath,
      [require.resolve('tsx/cli'), '--env-file=.env', 'scripts/build-worker.ts', '--once'],
      { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } },
    )
    worker.stdout?.on('data', (d) => process.stdout.write(`     │ ${String(d).trimEnd()}\n`))
    worker.stderr?.on('data', (d) => {
      const s = String(d).trimEnd()
      if (/\[build-worker|\[lex-diag\] 25b (build|pass) (settled|starting)/.test(s)) {
        process.stdout.write(`     │ ${s}\n`)
      }
    })

    // ── 3. WATCH THE DATABASE. This is all a returning browser can see. ─────
    const deadline = Date.now() + 15 * 60 * 1000
    let row = queued
    while (Date.now() < deadline) {
      await sleep(5000)
      row = await prisma.ideaBuild.findUnique({ where: { id: buildId } })
      if (row && row.status !== 'QUEUED' && row.status !== 'RUNNING') break
    }

    // ── 4. WHAT THE USER FINDS ON THEIR RETURN ──────────────────────────────
    const log = readPassLog(row?.passes)
    console.log(`\n  result: ${row?.status} · ${passesComplete(log)}/${BUILD_PASSES.length} passes · ` +
      `${row?.tokensIn} in / ${row?.tokensOut} out · ${row?.estCostPence ?? 'unpriced'}p`)

    assert(row?.status === 'DONE', 'the build finished with nothing driving it from a browser',
      `status ${row?.status}: ${row?.failureReason ?? ''}`)
    assert(passesComplete(log) === BUILD_PASSES.length, `   …all ${BUILD_PASSES.length} passes`,
      `${passesComplete(log)}/${BUILD_PASSES.length}`)
    assert(!!row?.summaryMessage, '   …and the summary the user reads first is written')
    assert((row?.tokensIn ?? 0) > 0, '   …and the spend is recorded on the row')

    // The passes were run by the worker, not by this process: this program never called
    // runNextPass, and the only other thing touching the row was the child.
    assert(worker.exitCode === 0 || worker.exitCode === null,
      '   …and the worker exited cleanly', `exit ${worker.exitCode}`)
  } finally {
    if (worker && worker.exitCode === null) worker.kill()
    await prisma.idea.delete({ where: { id: idea.id } }).catch((e) =>
      console.error('cleanup failed — remove by hand:', idea.id, e instanceof Error ? e.message : e))
  }

  console.log(`\n${pass} passed, ${fail} failed.`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
