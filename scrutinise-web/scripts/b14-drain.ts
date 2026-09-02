// ─────────────────────────────────────────────────────────────────────────────
// CCW-B14a — DRAIN THE QUEUE, WITH THE TWO GATES THAT MUST HOLD FIRST.
//
//   npx tsx --env-file=.env scripts/b14-drain.ts
//
// A wrapper around `build-worker.ts --once` that refuses to start unless the run
// can actually do what it is being asked to do, and that PROVES afterwards that
// something moved.
//
// ── WHY THIS EXISTS: TWO WAYS THE DRAIN SILENTLY DOES NOTHING ────────────────
//
//  1. ⚠ `LEX_BUILD_DRIVER` unset. The worker warns "nothing will ever be
//     enqueued for this process", claims nothing, prints "stopped cleanly" and
//     EXITS 0. It happened on this run: a four-second drain that looked like a
//     success. Twelve of those in a loop would report twelve successes and build
//     nothing.
//
//  2. ⚠⚠ Retrieval degraded. CCW-B15 §6(a): read the `[config]` line before
//     every build and refuse to proceed unless it says `fully-configured`. The
//     first M-01 ran with FTS unset and dense off, finished DONE with 11/11
//     passes and no failures, and produced ZERO citations. By status alone it
//     was indistinguishable from a good build.
//
// `assertRetrievalConfig()` already exists in harness-preflight and does gate 2
// properly — build-worker.ts imports only the printer. That file is modified by
// another session today, so rather than edit it, this wrapper calls the
// assertion itself before handing over. The import fix goes on the list.
// ─────────────────────────────────────────────────────────────────────────────
process.env.LEX_BUILD_DRIVER = 'worker'

import { spawnSync } from 'child_process'
import { prisma } from '../lib/prisma'
import { assertRetrievalConfig, resolvedConfigLine } from '../lib/lex/harness-preflight'
import { buildDriver } from '../lib/lex/build-config'

async function main() {
  // ── gate 1 ────────────────────────────────────────────────────────────────
  if (buildDriver() !== 'worker') {
    console.error(`REFUSING: buildDriver() is "${buildDriver()}" — the drain would claim nothing and exit 0.`)
    process.exit(1)
  }

  // ── gate 2 — the assertion, not the printer ──────────────────────────────
  // Throws unless fully configured. This is the call build-worker.ts does not make.
  assertRetrievalConfig('b14-drain')

  const before = await prisma.ideaBuild.findMany({
    where: { status: { in: ['QUEUED', 'RUNNING'] } },
    select: { id: true, ideaId: true, version: true, status: true },
  })
  if (!before.length) { console.log('nothing QUEUED or RUNNING — nothing to drain.'); await prisma.$disconnect(); return }
  console.log(`[b14-drain] ${resolvedConfigLine()}`)
  console.log(`[b14-drain] ${before.length} build(s) to drain: ${before.map(b => `${b.id.slice(0, 8)} v${b.version}`).join(', ')}`)

  await prisma.$disconnect()
  const t0 = Date.now()
  const r = spawnSync('npx', ['tsx', '--env-file=.env', 'scripts/build-worker.ts', '--once'], {
    stdio: 'inherit', shell: true, env: { ...process.env, LEX_BUILD_DRIVER: 'worker' },
  })
  const secs = Math.round((Date.now() - t0) / 1000)

  // ── the proof, because "exit 0" is not evidence that anything ran ────────
  const after = await prisma.ideaBuild.findMany({
    where: { id: { in: before.map(b => b.id) } },
    select: { id: true, version: true, status: true, passesComplete: true, failureReason: true },
  })
  const moved = after.filter(a => a.status !== 'QUEUED' && a.status !== 'RUNNING')
  console.log(`\n[b14-drain] worker exited ${r.status} after ${secs}s`)
  for (const a of after) console.log(`  ${a.id.slice(0, 8)} v${a.version}  ${a.status}  ${a.passesComplete} passes${a.failureReason ? `  ⚠ ${a.failureReason}` : ''}`)
  if (!moved.length) {
    console.error(`\n⚠⚠ NOTHING MOVED. ${before.length} build(s) still QUEUED/RUNNING after a drain that exited ${r.status}.`)
    console.error('   That is the failure this wrapper exists to catch. Do not treat it as a completed run.')
    await prisma.$disconnect(); process.exit(1)
  }
  console.log(`[b14-drain] ✔ ${moved.length} of ${before.length} build(s) settled.`)
  await prisma.$disconnect()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
