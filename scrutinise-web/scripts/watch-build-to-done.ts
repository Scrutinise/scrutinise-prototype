// ─────────────────────────────────────────────────────────────────────────────
// 25-T §1d — THE ACCEPTANCE TEST: ONE FULL BUILD WITH NO TAB.
//
// §1d: *"The acceptance test is one full build with the tab closed. ⚠ Nothing else proves this.
// A build that completes with the browser watching proves only what we already have."*
//
// ⚠⚠ THIS RUN IS STRICTLY STRONGER THAN "THE TAB CLOSED". There is no tab. The build was enqueued
// by a script that exited, and every pass after that ran on Railway with nothing polling it. If it
// finishes, it finished with no browser in existence — the condition §1d is trying to approximate.
//
// ⚠ AND IT ASSERTS THE ROW, NOT THE ABSENCE OF AN ERROR. `passesComplete` and `status` come off
// the same row the page reads.
//
// Usage: npx tsx --env-file=.env scripts/watch-build-to-done.ts <buildId> [--minutes 30]
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'

const BUILD = process.argv[2]
const MINUTES = Number(process.argv[process.argv.indexOf('--minutes') + 1]) || 30
const T = process.env.RAILWAY_API_TOKEN!
const SERVICE = 'c0d9fd39-9226-4d85-a9c5-a616341a542f'

async function workerLines(): Promise<string[]> {
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
  try {
    const d = await q(`query($s: String!) {
      deployments(first: 1, input: { serviceId: $s }) { edges { node { id } } }
    }`, { s: SERVICE }) as { deployments: { edges: Array<{ node: { id: string } }> } }
    const id = d.deployments.edges[0]?.node.id
    if (!id) return []
    const l = await q(`query($id: String!) { deploymentLogs(deploymentId: $id, limit: 500) { message } }`, { id }) as
      { deploymentLogs: Array<{ message: string }> }
    return (l.deploymentLogs ?? []).map((x) => x.message)
  } catch { return [] }
}

async function main() {
  if (!BUILD) { console.log('usage: watch-build-to-done.ts <buildId>'); return }
  const deadline = Date.now() + MINUTES * 60_000
  const t0 = Date.now()
  let row: { status: string; currentPass: string | null; passesComplete: number; startedAt: Date | null; completedAt: Date | null; failureReason: string | null; lastStopReason: string | null; estCostPence: number | null } | null = null

  while (Date.now() < deadline) {
    row = await prisma.ideaBuild.findUnique({
      where: { id: BUILD },
      select: {
        status: true, currentPass: true, passesComplete: true, startedAt: true,
        completedAt: true, failureReason: true, lastStopReason: true, estCostPence: true,
      },
    })
    if (!row) { console.log('no such build'); break }
    console.log(`  ${new Date().toISOString().slice(11, 19)}  ${row.status.padEnd(9)} pass ${String(row.currentPass ?? '—').padEnd(12)} ${row.passesComplete} complete  (+${Math.round((Date.now() - t0) / 1000)}s)`)
    if (row.status !== 'RUNNING' && row.status !== 'QUEUED') break
    await new Promise((r) => setTimeout(r, 30_000))
  }

  const lines = (await workerLines()).filter((m) => m.includes(BUILD) || /\[build-worker/.test(m))
  console.log(`\n── the worker's own lines ──`)
  for (const m of lines.slice(-25)) console.log(`  ${m.trimEnd()}`)

  console.log(`\n── §1d: one full build, no tab in existence ──`)
  console.log(`  build            : ${BUILD}`)
  console.log(`  status           : ${row?.status}`)
  console.log(`  passes complete  : ${row?.passesComplete}`)
  console.log(`  started          : ${row?.startedAt?.toISOString() ?? '—'}`)
  console.log(`  finished         : ${row?.completedAt?.toISOString() ?? '—'}`)
  if (row?.startedAt && row?.completedAt) {
    console.log(`  wall clock       : ${Math.round((row.completedAt.getTime() - row.startedAt.getTime()) / 1000)}s`)
  }
  console.log(`  est cost         : ${row?.estCostPence != null ? `${row.estCostPence}p` : '—'}`)
  if (row?.failureReason) console.log(`  ⚠ failureReason  : ${row.failureReason}`)
  if (row?.lastStopReason) console.log(`  ⚠ lastStopReason : ${row.lastStopReason}`)
  console.log(`\n  → §1d ${row?.status === 'DONE' ? 'PASSES.' : `NOT PASSED (${row?.status}).`}`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error('failed:', e instanceof Error ? e.message : e)
  await prisma.$disconnect().catch(() => {}); process.exit(1)
})
