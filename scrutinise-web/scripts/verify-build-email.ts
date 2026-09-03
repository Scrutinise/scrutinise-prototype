import { prisma } from '../lib/prisma'
import { claimBuild } from '../lib/lex/build'

// ─────────────────────────────────────────────────────────────────────────────────────────
// 25-Y §3 — PROVE THE COMPLETION EMAIL, OR REPORT THAT THERE IS NO PROOF.
//
// 25-W diagnosed it and 25-X set the Railway variables, but the send has never been observed.
// The worker's start-up line now says "email is configured"; that is a statement about an
// environment variable, not about Resend accepting a message.
//
// ⚠⚠ A CANCELLED BUILD EMAILS TOO, and that is deliberate in the product — "only telling people
// about success is how someone waits ten minutes for something that stopped after two". So the
// cheapest possible proof is to start a build, cancel it, and read the provider id out of the
// worker's log. It costs one pass at most instead of eleven.
//
// ⚠ IT IS RUN AGAINST THE WORKER, NOT FROM THIS SHELL. Calling `sendBuildCompleteEmail` here
// would use the LOCAL key and prove nothing about the worker's — a weaker claim wearing a
// stronger one's clothes, which is the failure this whole thread keeps finding.
//
// Usage:
//   npx tsx --env-file=.env scripts/verify-build-email.ts --start
//   npx tsx --env-file=.env scripts/verify-build-email.ts --cancel
//   npx tsx --env-file=.env scripts/verify-build-email.ts --report
// ─────────────────────────────────────────────────────────────────────────────────────────

const STATE = '../docs/25Y_EMAIL_PROOF.json'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const T = process.env.RAILWAY_API_TOKEN
const WORKER_SERVICE = 'c0d9fd39-9226-4d85-a9c5-a616341a542f'

async function gql(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': T! },
    body: JSON.stringify({ query, variables }),
  })
  const b = await res.json() as { data?: Record<string, unknown>; errors?: Array<{ message: string }> }
  if (b.errors?.length) throw new Error(b.errors.map((e) => e.message).join('; '))
  return b.data ?? {}
}

async function start() {
  // The 25-W §G scratch idea — a throwaway with a confirmed elicitation, deliberately kept.
  const idea = await prisma.idea.findFirst({
    where: { title: { startsWith: '25W-DECISION-SURVIVAL' } },
    select: { id: true, title: true, creator: { select: { email: true } } },
  })
  if (!idea) { console.error('the 25-W scratch idea is gone — nothing safe to build on'); process.exit(1) }

  // ⚠ notifyEmail: true EXPLICITLY. The whole point is that the row asks for an email.
  const buildId = await claimBuild(idea.id, 'B_CONTEXTUALISED', true)

  // ⚠ This shell resolves the driver as `client` (no LEX_BUILD_DRIVER in .env), so claimBuild
  // moves the row to RUNNING for a caller that is about to drive it — which this is not.
  // Production is `worker`; put the row back where production would have left it.
  const requeued = await prisma.ideaBuild.updateMany({
    where: { id: buildId, status: 'RUNNING' },
    data: { status: 'QUEUED', startedAt: null, currentPass: null },
  })
  const row = await prisma.ideaBuild.findUnique({
    where: { id: buildId }, select: { status: true, notifyEmail: true, version: true },
  })
  writeFileSync(STATE, JSON.stringify({ ideaId: idea.id, buildId, to: idea.creator.email }, null, 2), 'utf8')
  console.log(`build ${buildId} v${row?.version} on ${idea.id}`)
  console.log(`  status=${row?.status}${requeued.count ? ' (re-queued for the worker)' : ''} notifyEmail=${row?.notifyEmail}`)
  console.log(`  will email: ${idea.creator.email}`)
  console.log('\nWait for the worker to claim it, then run --cancel.')
}

async function cancel() {
  const { buildId } = JSON.parse(readFileSync(STATE, 'utf8')) as { buildId: string }
  const before = await prisma.ideaBuild.findUnique({
    where: { id: buildId }, select: { status: true, currentPass: true, passesComplete: true },
  })
  console.log(`before: ${before?.status} pass=${before?.currentPass} complete=${before?.passesComplete}`)
  if (before?.status !== 'RUNNING') {
    console.log('⚠ not RUNNING yet — the worker has not claimed it. Try again in a few seconds.')
    return
  }
  // ⚠ The co-operative cancel the product uses: the flag is written and the engine reads it
  // between passes. A cancel that only stopped a poller would leave the work running.
  await prisma.ideaBuild.update({ where: { id: buildId }, data: { cancelRequested: true } })
  console.log('cancelRequested = true. The engine stops at the next pass boundary and settles.')
}

async function report() {
  const { buildId, to } = JSON.parse(readFileSync(STATE, 'utf8')) as { buildId: string; to: string }
  const row = await prisma.ideaBuild.findUnique({
    where: { id: buildId },
    select: { status: true, notifyEmail: true, passesComplete: true, estCostPence: true, completedAt: true, failureReason: true },
  })
  console.log(`\nbuild ${buildId.slice(0, 8)}: ${row?.status} · ${row?.passesComplete} passes · ${row?.estCostPence}p`)
  console.log(`  notifyEmail=${row?.notifyEmail} to=${to}`)
  if (row?.failureReason) console.log(`  reason: ${row.failureReason}`)

  if (!T) { console.log('\nno RAILWAY_API_TOKEN — cannot read the worker log'); return }
  const d = await gql(`query($s: String!) {
    deployments(first: 1, input: { serviceId: $s }) { edges { node { id status } } }
  }`, { s: WORKER_SERVICE }) as { deployments: { edges: Array<{ node: { id: string; status: string } }> } }
  const dep = d.deployments.edges[0]?.node
  if (!dep) { console.log('no deployment'); return }
  const logs = await gql(`query($id: String!, $limit: Int!) {
    deploymentLogs(deploymentId: $id, limit: $limit) { timestamp message }
  }`, { id: dep.id, limit: 1000 }) as { deploymentLogs: Array<{ timestamp: string; message: string }> }
  const lines = logs.deploymentLogs ?? []

  const short = buildId.slice(0, 8)
  const relevant = lines.filter((l) =>
    l.message.includes(short) || /build-complete email|RESEND_API_KEY|Email suppressed|Resend error/i.test(l.message))
  console.log(`\n── worker log, ${relevant.length} relevant of ${lines.length} ──`)
  for (const l of relevant) console.log(`  ${l.timestamp.slice(11, 19)} ${l.message.slice(0, 260)}`)

  // ⚠⚠ THE VERDICT IS THE PROVIDER ID OR IT IS NOTHING. An absence of errors is not evidence
  // of a send — that sentence is the whole reason 25-W existed.
  const all = lines.map((l) => l.message).join('\n')
  const sent = /25b build-complete email sent/.test(all)
  const notSent = /25b build-complete email NOT SENT/.test(all)
  const idMatch = all.match(/providerId:\s*'([^']+)'/)
  console.log('\n── §3 verdict ──')
  if (sent && idMatch) console.log(`  ✅ SENT. Provider id: ${idMatch[1]}`)
  else if (sent) console.log('  ⚠ the log says sent but quotes no provider id — Resend accepted it and returned no id')
  else if (notSent) console.log(`  ✗ NOT SENT. ${all.match(/reason: '([^']+)'/)?.[1] ?? 'see the lines above'}`)
  else console.log('  · no send line in this deployment\'s log yet — the build may not have settled')
}

async function main() {
  if (process.argv.includes('--start')) return start()
  if (process.argv.includes('--cancel')) return cancel()
  if (process.argv.includes('--report')) return report()
  console.log(`state ${existsSync(STATE) ? 'exists' : 'absent'}. Pass --start | --cancel | --report`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
