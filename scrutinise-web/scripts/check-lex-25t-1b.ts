// ─────────────────────────────────────────────────────────────────────────────
// 25-T §1b/§1d — ENQUEUE ONE JOB AND WATCH THE WORKER PICK IT UP, BY JOB ID.
//
// §1b: *"Enqueue one job and show the worker picking it up, by job id. ⚠ Not 'the queue is empty
// therefore it ran'."*
//
// ⚠⚠ THE ENQUEUE IS THE APP'S OWN, NOT A ROW I WROTE. It calls `claimBuild` — the same function
// the `POST /api/ideas/[id]/build` route calls — so what lands in the queue is the row the product
// actually produces: the version, the pass log, the allowance charge, the unique index, all of it.
// Hand-writing an `IdeaBuild` row would have tested my fixture against the worker and told us
// nothing about whether the product can feed it.
//
// ⚠⚠ AND `LEX_BUILD_DRIVER=worker` IS FORCED IN THIS PROCESS ON PURPOSE. `claimBuild` branches on
// it: under `client` it CLAIMS the row itself (status RUNNING) because no worker is coming, which
// would hide the row from `nextQueuedBuild` and the Railway worker would never see it. Forcing it
// here makes this process take the same branch production will take after §1c — and it changes
// nothing in Vercel, which is Charlie's to flip.
//
// ⚠ THIS SPENDS A THIRD OF AN ALLOWANCE AND RUNS A REAL BUILD. It is plan-by-default.
//
// Usage:
//   npx tsx --env-file=.env scripts/check-lex-25t-1b.ts           (plan — enqueues nothing)
//   npx tsx --env-file=.env scripts/check-lex-25t-1b.ts --go
//   npx tsx --env-file=.env scripts/check-lex-25t-1b.ts --watch <buildId>
// ─────────────────────────────────────────────────────────────────────────────

// ⚠ BEFORE the import — `build-config` reads the environment at module load.
process.env.LEX_BUILD_DRIVER = 'worker'

import { prisma } from '../lib/prisma'

const GO = process.argv.includes('--go')
const WATCH_ARG = process.argv.includes('--watch') ? process.argv[process.argv.indexOf('--watch') + 1] : null
const T = process.env.RAILWAY_API_TOKEN!
const SERVICE = 'c0d9fd39-9226-4d85-a9c5-a616341a542f'

async function railwayLogs(): Promise<string[]> {
  const q = async (query: string, variables: Record<string, unknown>) => {
    const res = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Project-Access-Token': T },
      body: JSON.stringify({ query, variables }),
    })
    const b = await res.json() as { data?: Record<string, unknown>; errors?: Array<{ message: string }> }
    if (b.errors?.length) throw new Error(b.errors.map((e) => e.message).join('; '))
    return b.data ?? {}
  }
  const d = await q(`query($s: String!) {
    deployments(first: 1, input: { serviceId: $s }) { edges { node { id } } }
  }`, { s: SERVICE }) as { deployments: { edges: Array<{ node: { id: string } }> } }
  const id = d.deployments.edges[0]?.node.id
  if (!id) return []
  const l = await q(`query($id: String!) { deploymentLogs(deploymentId: $id, limit: 500) { message } }`, { id }) as
    { deploymentLogs: Array<{ message: string }> }
  return (l.deploymentLogs ?? []).map((x) => x.message)
}

/**
 * ⚠⚠ THE ASSERTION §1b ACTUALLY ASKS FOR. Not "a claim happened" — THIS id, in a line the worker
 * wrote. A regex for /running build/ alone would pass on any build by anyone, which is the
 * "queue is empty therefore it ran" shape the brief names.
 */
function claimedById(lines: string[], buildId: string) {
  return lines.filter((m) => m.includes(buildId))
}

async function main() {
  console.log(`\n══ 25-T §1b — enqueue one job, watch the worker claim it BY ID ══`)
  console.log(`   driver in this process: ${process.env.LEX_BUILD_DRIVER}`)

  if (WATCH_ARG) {
    const lines = await railwayLogs()
    const mine = claimedById(lines, WATCH_ARG)
    const row = await prisma.ideaBuild.findUnique({
      where: { id: WATCH_ARG },
      select: { status: true, currentPass: true, startedAt: true, completedAt: true, passesComplete: true },
    })
    console.log(`\n── worker lines naming ${WATCH_ARG} ──`)
    for (const m of mine) console.log(`  ${m.trimEnd()}`)
    if (!mine.length) console.log('  (none yet)')
    console.log(`\n  row: ${row?.status} · pass ${row?.currentPass ?? '—'} · started ${row?.startedAt?.toISOString().slice(11, 19) ?? '—'}`)
    console.log(`\n  → §1b ${mine.length ? 'PROVEN: the worker named this job id.' : 'not yet proven.'}`)
    await prisma.$disconnect()
    return
  }

  // ── pick a subject the check did not create (CLAUDE.md §26, the cold read) ──
  //
  // ⚠⚠ AND NOT MERELY THE MOST RECENT ROW. The first run of this picked "Untitled idea" — a draft
  // minted by landing on /ideas/build, with no elicitation answers at all. A full build on an
  // empty idea would have completed, looked like a pass, and proved nothing §1d asks for: the
  // acceptance test is a FULL build, and a build with nothing to research is not one. So the
  // subject must have real content, and the emptiness is REFUSED rather than discovered later.
  const wanted = process.argv.includes('--idea') ? process.argv[process.argv.indexOf('--idea') + 1] : null
  const idea = await prisma.idea.findFirst({
    where: {
      builds: { none: { status: { in: ['QUEUED', 'RUNNING'] } } },
      ...(wanted ? { id: { startsWith: wanted } } : { diagnosisCauses: { some: {} } }),
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true, title: true, creatorId: true,
      _count: { select: { diagnosisCauses: true, fieldStates: true } },
    },
  })
  if (!idea) { console.log('no eligible idea'); await prisma.$disconnect(); return }
  console.log(`\n   subject: ${idea.id}  "${(idea.title ?? '').slice(0, 60)}"`)
  console.log(`            ${idea._count.diagnosisCauses} causes · ${idea._count.fieldStates} field states`)
  if (idea._count.fieldStates === 0) {
    console.log('   ⚠ REFUSING: no field states, so this is an empty draft, and a build on it is not')
    console.log('     the full build §1d asks for.')
    await prisma.$disconnect(); return
  }

  if (!GO) {
    console.log('\n   Plan only. Nothing enqueued, no allowance spent. Re-run with --go.\n')
    await prisma.$disconnect()
    return
  }

  const { claimBuild } = await import('../lib/lex/build')
  const buildId = await claimBuild(idea.id, 'B_CONTEXTUALISED', false, 'FULL')
  const row = await prisma.ideaBuild.findUnique({ where: { id: buildId }, select: { status: true } })
  console.log(`\n   enqueued build ${buildId}`)
  console.log(`   status straight after the enqueue: ${row?.status}  ${row?.status === 'QUEUED'
    ? '← QUEUED, so it is visible to the worker' : '⚠ NOT QUEUED — the worker will never see it'}`)
  console.log(`\n   watch it with:`)
  console.log(`     npx tsx --env-file=.env scripts/check-lex-25t-1b.ts --watch ${buildId}\n`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('failed:', e instanceof Error ? e.message : e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
