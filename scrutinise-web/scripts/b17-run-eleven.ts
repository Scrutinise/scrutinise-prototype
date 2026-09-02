// ─────────────────────────────────────────────────────────────────────────────
// CCW-B17 step 4 — enqueue, drain and export M-02…M-12, ONE AT A TIME.
//
//   npx tsx --env-file=.env scripts/b17-run-eleven.ts            (plan)
//   npx tsx --env-file=.env scripts/b17-run-eleven.ts --go
//   npx tsx --env-file=.env scripts/b17-run-eleven.ts --go --from M-05
//
// ⚠ SERIAL BY CONSTRUCTION. One measure is enqueued, drained and exported before the next
// is touched. Not a throughput choice — a build fires 10–20 searches and vector-serve
// handles four, and B17 is explicit that wall clock is not the constraint.
//
// ⚠⚠ THE ALLOWANCE IS THE REAL LIMIT AND IT IS TIGHT (B17). Roughly 39 thirds remain and
// eleven full builds need 33, leaving about one spare build. So this refuses to start a
// measure when the remaining allowance would not cover it, and STOPS THE WHOLE RUN rather
// than continuing to the next — a twelfth measure unbuilt because an earlier re-run ate
// the margin is the worst outcome available, and CCW asked to be told before that happens.
// ─────────────────────────────────────────────────────────────────────────────
process.env.LEX_BUILD_DRIVER = 'worker'

import { spawnSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { readAllowance, FULL_BUILD_THIRDS } from '../lib/lex/allowance'
import { assertRetrievalConfig } from '../lib/lex/harness-preflight'

const INPUTS = join(__dirname, '../../docs/report_run/lex_build_inputs.json')
const OWNER_EMAIL = 'cl@scrutinise.org'
const GO = process.argv.includes('--go')
const FROM = process.argv.includes('--from') ? process.argv[process.argv.indexOf('--from') + 1] : null

function run(args: string[]): number {
  const r = spawnSync('npx', ['tsx', '--env-file=.env', ...args], {
    stdio: 'inherit', shell: true, env: { ...process.env, LEX_BUILD_DRIVER: 'worker' },
  })
  return r.status ?? 1
}

/**
 * Poll the build row until it leaves QUEUED/RUNNING. Returns null on timeout.
 *
 * ⚠ A build that never settles is reported as a timeout, NOT as a pass. The whole run
 * stops on it, because carrying on would leave a half-built measure behind a wall of
 * later output where nobody would find it.
 */
async function waitForSettle(ideaId: string, maxMs = 20 * 60_000) {
  const t0 = Date.now()
  let last = ''
  while (Date.now() - t0 < maxMs) {
    const b = await prisma.ideaBuild.findFirst({
      where: { ideaId }, orderBy: { version: 'desc' },
      select: { status: true, passesComplete: true, currentPass: true, failureReason: true },
    })
    if (b && b.status !== 'QUEUED' && b.status !== 'RUNNING') return b
    const now = `${b?.status} ${b?.passesComplete} ${b?.currentPass}`
    if (now !== last) { console.log(`   … ${now} (${Math.round((Date.now() - t0) / 1000)}s)`); last = now }
    await new Promise(r => setTimeout(r, 15000))
  }
  return null
}

async function main() {
  // ⚠ The gate B17 step 2 sets. Refuses rather than prints — see b14-drain.ts for why.
  assertRetrievalConfig('b17-run-eleven')

  const inputs = JSON.parse(readFileSync(INPUTS, 'utf8'))
  let refs: string[] = inputs.measures.map((m: any) => m.ref).filter((r: string) => r !== 'M-01')
  if (FROM) refs = refs.slice(refs.indexOf(FROM))

  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } })
  const a0 = await readAllowance(owner!.id)
  console.log(`[b17] ${refs.length} measures to run: ${refs.join(', ')}`)
  console.log(`[b17] allowance: ${a0?.remainingThirds} thirds remaining = ${a0?.remainingBuilds} full builds; ${refs.length} needed = ${refs.length * FULL_BUILD_THIRDS} thirds`)
  if ((a0?.remainingThirds ?? 0) < refs.length * FULL_BUILD_THIRDS) {
    console.log(`[b17] ⚠⚠ NOT ENOUGH FOR ALL ${refs.length}. Short by ${refs.length * FULL_BUILD_THIRDS - (a0?.remainingThirds ?? 0)} thirds. Proceeding one at a time and stopping when it runs out.`)
  }
  if (!GO) { console.log('\nPLAN ONLY — nothing enqueued. Re-run with --go.'); await prisma.$disconnect(); return }

  const done: string[] = []
  for (const ref of refs) {
    const a = await readAllowance(owner!.id)
    if ((a?.remainingThirds ?? 0) < FULL_BUILD_THIRDS) {
      console.log(`\n[b17] ⚠⚠ STOPPING BEFORE ${ref}: ${a?.remainingThirds} thirds left, a full build needs ${FULL_BUILD_THIRDS}.`)
      console.log(`[b17] Completed this run: ${done.join(', ') || '(none)'}. Remaining unbuilt: ${refs.slice(refs.indexOf(ref)).join(', ')}.`)
      break
    }
    const t0 = Date.now()
    console.log(`\n══ ${ref} ═══ (${a?.remainingThirds} thirds left) ═══════════════════`)
    if (run(['scripts/b14-enqueue.ts', ref, '--go'])) { console.log(`[b17] ⚠ enqueue failed for ${ref} — stopping.`); break }

    // ⚠⚠ NO LOCAL DRAIN. The Railway `build-worker` claims a QUEUED row within ~5s
    // (WORKER_IDLE_MS), so a local `--once` worker finds nothing and — correctly —
    // reports that nothing moved. That is not a failure to act on; it is this machine
    // discovering it is not the driver. Waiting on the ROW is the right observation,
    // because it is true whichever worker runs it.
    const title = inputs.measures.find((m: any) => m.ref === ref).idea.title
    const idea = await prisma.idea.findFirst({ where: { title, deletedAt: null }, select: { id: true } })
    const settled = await waitForSettle(idea!.id)
    if (!settled) { console.log(`[b17] ⚠ ${ref} did not settle within the wait — stopping rather than moving on.`); break }
    console.log(`[b17] ${ref} settled: ${settled.status}, ${settled.passesComplete} passes${settled.failureReason ? ` ⚠ ${settled.failureReason}` : ''}`)

    if (run(['scripts/b14-export.ts', ref])) { console.log(`[b17] ⚠ export failed for ${ref} — stopping.`); break }
    done.push(ref)
    console.log(`[b17] ${ref} complete in ${Math.round((Date.now() - t0) / 1000)}s · done so far: ${done.join(', ')}`)
  }

  const aEnd = await readAllowance(owner!.id)
  console.log(`\n[b17] finished. built: ${done.join(', ') || '(none)'} · allowance left: ${aEnd?.remainingThirds} thirds`)
  await prisma.$disconnect()
}
main().catch(e => { console.error('ERROR:', e.message); process.exit(1) })
