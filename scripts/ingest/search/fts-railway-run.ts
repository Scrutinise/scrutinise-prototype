/**
 * fts-railway-run.ts — stand up + drive a DEDICATED Railway service that runs the
 * FTS index build IN RAILWAY'S DATACENTRE (datacenter→R2 bandwidth, not a home
 * connection). Isolated from the Ingest worker + Ops liveness, so the live ingest
 * drain is undisturbed and nothing redeploys the build out from under it.
 *
 * WHY a dedicated service (not the v18 startCommand-override on Ingest):
 *   - Ingest is actively draining the queue; hijacking it stalls that for hours.
 *   - Ops liveness redeploys Ingest whenever pending>0 + heartbeat stale — it would
 *     bounce a build running on the Ingest container. It only targets the Ingest
 *     service id, so a separate service is immune.
 *
 * The service is git-connected to Main/RAILPACK/root=scripts/ingest (identical
 * build to Ingest), so the canary validates the SAME environment as the full run —
 * same image, same region, same R2 egress path. The only difference is `--limit`.
 *
 * PREREQUISITE: the FTS code (scripts/ingest/search/* + @lancedb/lancedb +
 * apache-arrow in package.json) must already be on Main — i.e. commit-all.sh has
 * run. Building before that deploys old Main and the start command fails.
 *
 * Reads creds from scrutinise-web/.env and copies the four the indexer needs onto
 * the new service. Does NOT copy RAILWAY_API_TOKEN (the indexer never calls Railway).
 *
 * Usage:
 *   tsx search/fts-railway-run.ts setup     — create + configure the service (no build yet)
 *   tsx search/fts-railway-run.ts canary     — start command = build --limit 5000, deploy, tail
 *   tsx search/fts-railway-run.ts full        — start command = build (no limit), deploy, tail
 *   tsx search/fts-railway-run.ts logs        — tail the latest deployment's logs
 *   tsx search/fts-railway-run.ts teardown    — delete the service (frees compute)
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID!
const ENV_ID = process.env.ENV_ID ?? '991f733c-719c-4217-a6d6-1dbe80642bbe'
const REPO = 'Scrutinise/scrutinise-prototype'
const SERVICE_NAME = 'fts-build'
const STATE_KEY = path.join(__dirname, '.fts-build-service-id')

const CANARY_CMD = 'npx tsx search/build-fts-index.ts --limit 5000'
const FULL_CMD = 'npx tsx search/build-fts-index.ts'

// Env vars the indexer needs (NEON + R2). Names match what lance.ts / r2-client read.
const NEEDED = [
  'NEON_DATABASE_URL',
  'CLOUDFLARE_R2_ACCOUNT_ID',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET_NAME',
] as const

const fs = require('fs') as typeof import('fs')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RAILWAY_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const data = await res.json() as { data?: T; errors?: Array<{ message: string }> }
  if (data.errors?.length) throw new Error(JSON.stringify(data.errors))
  return data.data as T
}

function saveId(id: string) { fs.writeFileSync(STATE_KEY, id, 'utf8') }
function loadId(): string {
  if (!fs.existsSync(STATE_KEY)) throw new Error(`no service id recorded — run "setup" first (${STATE_KEY})`)
  return fs.readFileSync(STATE_KEY, 'utf8').trim()
}

async function setup() {
  const variables: Record<string, string> = {}
  for (const k of NEEDED) {
    const v = process.env[k]
    if (!v) {
      if (k === 'CLOUDFLARE_R2_BUCKET_NAME') continue // lance.ts defaults to scrutinise-legislation
      throw new Error(`${k} not in env (scrutinise-web/.env) — cannot configure the build service`)
    }
    variables[k] = v
  }
  console.log(`creating service "${SERVICE_NAME}" from ${REPO}@Main with ${Object.keys(variables).length} vars`)
  const created = await gql<{ serviceCreate: { id: string } }>(
    `mutation($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }`,
    { input: { projectId: PROJECT_ID, environmentId: ENV_ID, name: SERVICE_NAME, branch: 'Main', source: { repo: REPO }, variables } },
  )
  const id = created.serviceCreate.id
  saveId(id)
  console.log(`  serviceId=${id} (saved to ${STATE_KEY})`)

  console.log('configuring instance: rootDirectory=scripts/ingest, builder=RAILPACK, startCommand=(no-op)')
  // No-op start command first: the initial auto-deploy from serviceCreate builds the
  // image (RAILPACK install — a one-time ~minute), runs `true`, exits 0, and stays
  // stopped (no idle compute burn) until Charlie triggers the canary, which
  // redeploys with the real command. The image is identical regardless of command.
  await gql(
    `mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
    }`,
    { serviceId: id, environmentId: ENV_ID, input: {
        rootDirectory: 'scripts/ingest',
        builder: 'RAILPACK',
        startCommand: 'true',
        numReplicas: 1,
        // never auto-redeploy on unrelated pushes to Main during the build
        watchPatterns: ['scripts/ingest/search/**'],
      } },
  )
  console.log('done. Image will build then idle-stop. Next: "canary" (Charlie-triggered spend).')
}

async function setStartAndDeploy(cmd: string) {
  const id = loadId()
  console.log(`setting startCommand: ${cmd}`)
  await gql(
    `mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
    }`,
    { serviceId: id, environmentId: ENV_ID, input: { startCommand: cmd } },
  )
  console.log('redeploying…')
  await gql(
    `mutation($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }`,
    { serviceId: id, environmentId: ENV_ID },
  )
  await tailLogs(id)
}

async function latestDeployment(id: string) {
  const d = await gql<{ deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string } }> } }>(
    `query($serviceId: String!) { deployments(first: 1, input: { serviceId: $serviceId }) { edges { node { id status createdAt } } } }`,
    { serviceId: id },
  )
  return d.deployments.edges[0]?.node
}

async function tailLogs(id: string) {
  console.log('polling for build → run (Ctrl-C to detach; the build keeps running on Railway)…')
  let lastDep = ''
  for (let i = 0; i < 240; i++) {            // ~60 min of polling at 15s
    await sleep(15_000)
    const dep = await latestDeployment(id)
    if (!dep) { console.log('  (no deployment yet)'); continue }
    if (dep.id !== lastDep) { console.log(`  deployment ${dep.id.slice(0, 8)} ${dep.status} ${dep.createdAt}`); lastDep = dep.id }
    const l = await gql<{ deploymentLogs: Array<{ message: string }> }>(
      `query($deploymentId: String!, $limit: Int!) { deploymentLogs(deploymentId: $deploymentId, limit: $limit) { message } }`,
      { deploymentId: dep.id, limit: 30 },
    )
    const tail = l.deploymentLogs.map(r => r.message).filter(m => m.includes('[fts-index]')).slice(-5)
    if (tail.length) console.log(tail.map(m => '    ' + m).join('\n'))
    if (l.deploymentLogs.some(r => r.message.includes('[fts-index] DONE') || r.message.includes('--limit') && r.message.includes('reached'))) {
      console.log('  >>> build reported completion in logs.'); return
    }
  }
}

async function logs() { await tailLogs(loadId()) }

async function teardown() {
  const id = loadId()
  console.log(`deleting service ${id}`)
  await gql(`mutation($id: String!) { serviceDelete(id: $id) }`, { id })
  fs.unlinkSync(STATE_KEY)
  console.log('deleted.')
}

const mode = process.argv[2]
const fn = mode === 'setup' ? setup
  : mode === 'canary' ? () => setStartAndDeploy(CANARY_CMD)
  : mode === 'full' ? () => setStartAndDeploy(FULL_CMD)
  : mode === 'logs' ? logs
  : mode === 'teardown' ? teardown
  : null
if (!fn) { console.error('usage: fts-railway-run.ts setup|canary|full|logs|teardown'); process.exit(1) }
fn().catch(e => { console.error(e); process.exit(1) })
