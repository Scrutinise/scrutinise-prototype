export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B18 — ENQUEUE A BUILD AND RUN IT IN THIS PROCESS, SO THIS SPRINT'S CODE EXECUTES.
//
// ⚠⚠ WHY THIS EXISTS AT ALL. The Railway `build-worker` has been running the same
// container since 3 September and Railway builds it from the repository, so a fix in the
// working tree does not reach it until a commit, a push and a redeploy. §12 forbids
// mid-sprint git. This script is the documented alternative — `b14-enqueue.ts` has always
// ended with "Now drain it: build-worker.ts --once" — with the race closed.
//
// ⚠ THE RACE IS REAL AND IT IS REPORTED, NOT HIDDEN. The Railway worker polls every 5s and
// `claimQueuedBuild` is conditional. This claims the row in the same breath as creating it;
// if Railway gets there first the claim returns false and this script STOPS and says so,
// because a build that ran on the old code must not be reported as a test of the new.
//
// ⚠⚠ AND THE RETRIEVAL CONFIGURATION IS FORCED TO THE WORKER'S, NOT THIS LAPTOP'S.
// `.env` here carries FOUR vector streams; the worker carries five (it has `guidance`).
// A build run under a different stream list is not comparable with the eleven of 2
// September, and the whole value of a re-run is the comparison. The override is printed.
//
//   npx tsx --env-file=.env scripts/b18-run-build-locally.ts M-02              (plan)
//   npx tsx --env-file=.env scripts/b18-run-build-locally.ts M-02 --go
//   npx tsx --env-file=.env scripts/b18-run-build-locally.ts M-02 --go --critique <file>
// ─────────────────────────────────────────────────────────────────────────────

// ⚠ BEFORE the imports — `build-config` reads the environment at module load and
// `claimBuild` branches on `buildDriver()`. Same placement and reason as b14-enqueue.ts:18.
process.env.LEX_BUILD_DRIVER = 'worker'

// ⚠ The worker's five streams, as read off the Railway API on 9 September 2026. Named here
// rather than fetched, so a run is reproducible without a Railway token — and printed at
// start-up so a drift between this constant and the service is visible in the log.
const WORKER_VECTOR_STREAMS = 'caselaw,committees,debates,guidance,legislation'
if (process.env.LEX_VECTOR_STREAMS !== WORKER_VECTOR_STREAMS) {
  console.log(`[b18] LEX_VECTOR_STREAMS: overriding this machine's `
    + `"${process.env.LEX_VECTOR_STREAMS ?? '(unset)'}" with the worker's "${WORKER_VECTOR_STREAMS}"`)
  process.env.LEX_VECTOR_STREAMS = WORKER_VECTOR_STREAMS
}

import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { claimBuild, claimQueuedBuild, runBuildToCompletion } from '../lib/lex/build'
import { DEFAULT_FRAMING } from '../lib/lex/build-config'
import { assertRetrievalConfig } from '../lib/lex/harness-preflight'

const BUILDS = join(__dirname, '../../docs/report_run/builds')
const REF = process.argv[2]
const GO = process.argv.includes('--go')
const critiqueArg = process.argv.indexOf('--critique')
const CRITIQUE_FILE = critiqueArg > -1 ? process.argv[critiqueArg + 1] : null

async function main() {
  if (!REF) { console.error('usage: b18-run-build-locally.ts <ref e.g. M-02> [--go] [--critique <file>]'); process.exit(2) }

  // ⚠ THE GUARD, BEFORE ANY SPEND. This is the same assertion §3 added to the worker.
  assertRetrievalConfig(`b18 ${REF}`)

  const ideaId: string = JSON.parse(readFileSync(join(BUILDS, `${REF}.json`), 'utf8')).idea.id
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId }, select: { id: true, title: true, creatorId: true },
  })
  if (!idea) { console.error(`no idea for ${REF}`); process.exit(2) }

  const prior = await prisma.ideaBuild.findMany({
    where: { ideaId }, select: { version: true, status: true }, orderBy: { version: 'desc' }, take: 3,
  })

  let critique: string | null = null
  if (CRITIQUE_FILE) {
    critique = readFileSync(CRITIQUE_FILE, 'utf8')
    // ⚠⚠ `claimBuild` STORES 8,000 CHARACTERS AND `critiqueBlock` SHOWS THE MODEL 6,000.
    // A critique between the two lengths is stored in full, looks complete in the database,
    // and reaches the prompt with its tail cut off. Refuse rather than truncate silently.
    if (critique.length > 6000) {
      console.error(`⚠⚠ the critique is ${critique.length} chars. \`critiqueBlock\` slices at 6,000, `
        + 'so everything past that would be stored but never shown to the model. Shorten it.')
      process.exit(2)
    }
  }

  console.log(`\n── ${REF} · ${idea.title} ──`)
  console.log(`  idea      : ${ideaId}`)
  console.log(`  prior     : ${prior.map((p) => `v${p.version} ${p.status}`).join(' · ') || 'none'}`)
  console.log(`  critique  : ${critique ? `${critique.length} chars from ${CRITIQUE_FILE}` : 'none — single-variable run'}`)
  console.log(`  streams   : ${process.env.LEX_VECTOR_STREAMS}`)

  if (!GO) { console.log('\n  PLAN ONLY — nothing enqueued, nothing spent. Re-run with --go.'); await prisma.$disconnect(); return }

  const buildId = await claimBuild(ideaId, DEFAULT_FRAMING, false, 'FULL', critique)
  const row = await prisma.ideaBuild.findUnique({ where: { id: buildId }, select: { version: true } })
  console.log(`\n  ✔ enqueued build ${buildId} as v${row?.version} — claiming it here, now`)

  // ⚠ THE RACE, CLOSED BY CHECKING RATHER THAN BY HOPING.
  if (!(await claimQueuedBuild(buildId))) {
    console.error('\n⚠⚠ THE RAILWAY WORKER CLAIMED IT FIRST. This build will run on the code Railway')
    console.error('   was built from (3 September), NOT on this working tree, so it is not a test of')
    console.error('   this sprint\'s change. It will still complete and it has still spent the thirds.')
    console.error(`   Watch it:  npx tsx --env-file=.env scripts/_b18-watch-build.ts ${buildId}`)
    await prisma.$disconnect()
    process.exit(1)
  }
  console.log('  ✔ claimed locally — this process runs it, on this working tree\n')

  const started = Date.now()
  const view = await runBuildToCompletion(ideaId, idea.creatorId, buildId)
  console.log(`\n── ${view.status} · ${view.passesComplete}/${view.passesTotal} passes · `
    + `${Math.round((Date.now() - started) / 1000)}s · ${view.spend.line}`)
  for (const p of view.passes) {
    console.log(`   ${String(p.key).padEnd(18)} ${String(p.status).padEnd(11)} ${p.output ?? p.failureReason ?? ''}`)
  }
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error('ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
