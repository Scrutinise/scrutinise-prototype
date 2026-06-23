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
// Service selector. The positions memory pilot (FTS_SERVICE=fts-pilot, TRACK 2)
// was STOOD DOWN — positions are parked for a single-shot v2 build on Hetzner, so
// the incremental-merge pilot is obsolete (see CHANGE_LOG 2026-06-21).
//   FTS_SERVICE=fts-build (default) — the real index build (corpus_fts)
const SERVICE_NAME = process.env.FTS_SERVICE ?? 'fts-build'
const STATE_KEY = path.join(__dirname, `.${SERVICE_NAME}-service-id`)

// Isolated canary: a throwaway table+checkpoint (FTS_TABLE_NAME) so it validates the
// FULL path — Neon read → R2 body → Lance write → compact → FTS index on R2 — WITHOUT
// touching the real corpus_fts build. --canary implies --reset + proceeds to the index
// build after the 5k load. The full run uses the default table, untouched.
const CANARY_CMD = "sh -c 'FTS_TABLE_NAME=corpus_fts_canary npx tsx search/build-fts-index.ts --limit 5000 --canary'"
// Tuned for the R2-GET-latency bottleneck: lift the S3 socket cap (R2_MAX_SOCKETS, else
// the SDK's 50 default throttles us) AND request 256-way fetch concurrency + 5000-row
// batches (fewer checkpoint PUTs / fewer, larger Lance fragments → also faster index
// build). Inline env so an ON_FAILURE resume keeps the same tuning. Only the build
// uses the higher cap; the worker keeps the 50 default.
const FULL_CMD = "sh -c 'R2_MAX_SOCKETS=256 FTS_R2_CONCURRENCY=256 FTS_BATCH=5000 npx tsx search/build-fts-index.ts'"
// TRACK 1 v1: build the no-positions index over the already-loaded 16.5M in place
// (resumes at phase=indexing, no reset) — fits memory, working search this week.
const V1_CMD = "sh -c 'R2_MAX_SOCKETS=256 FTS_WITH_POSITIONS=false npx tsx search/build-fts-index.ts'"

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
        // NEVER restart: the no-op `true` exits 0 after the image builds, and with
        // NEVER it stays fully stopped (zero idle compute) until canary/full flips
        // the policy + start command. Without this, a RAILPACK default of npm start
        // (the worker!) or an ALWAYS restart policy could burn compute / claim rows.
        restartPolicyType: 'NEVER',
        numReplicas: 1,
        // never auto-redeploy on unrelated pushes to Main during the build
        watchPatterns: ['scripts/ingest/search/**'],
      } },
  )
  console.log('done. Image will build then idle-stop. Next: "canary" (Charlie-triggered spend).')
}

async function updateInstance(id: string, input: Record<string, unknown>) {
  await gql(
    `mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
    }`,
    { serviceId: id, environmentId: ENV_ID, input },
  )
}

async function redeploy(id: string) {
  await gql(
    `mutation($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }`,
    { serviceId: id, environmentId: ENV_ID },
  )
}

// Park the service: no-op start command + NEVER restart. Set BEFORE pushing so the
// auto-redeploy that a push to Main triggers (watchPatterns match search/**) idle-
// stops instead of re-running a stale build command. No redeploy here — the push does it.
async function idle() {
  const id = loadId()
  await updateInstance(id, { startCommand: 'true', restartPolicyType: 'NEVER' })
  console.log('fts-build parked: startCommand=true, restartPolicyType=NEVER (safe for push auto-redeploy)')
}

async function deployWith(cmd: string) {
  const id = loadId()
  console.log(`setting startCommand: ${cmd}`)
  // ON_FAILURE: a crashed build auto-restarts + resumes from the R2 checkpoint; a
  // clean exit 0 (done / --limit reached) stays stopped. --reset is NEVER in cmd.
  await updateInstance(id, { startCommand: cmd, restartPolicyType: 'ON_FAILURE' })
  console.log('redeploying…')
  await redeploy(id)
  return id
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

// Bounded startup monitor for the full build: watch build → run → the first few
// rows/s progress lines, then RETURN (the build keeps running on Railway). Used to
// read steady-state throughput in the first minutes and decide go / stop.
async function monitorStartup(id: string, maxMinutes: number) {
  const deadline = Date.now() + maxMinutes * 60_000
  const seen = new Set<string>()
  let lastDep = ''
  console.log(`monitoring startup for up to ${maxMinutes} min (build keeps running after this returns)…`)
  while (Date.now() < deadline) {
    await sleep(15_000)
    const dep = await latestDeployment(id)
    if (!dep) { console.log('  (no deployment yet)'); continue }
    if (dep.id !== lastDep) { console.log(`  deployment ${dep.id.slice(0, 8)} ${dep.status} ${dep.createdAt}`); lastDep = dep.id }
    const l = await gql<{ deploymentLogs: Array<{ timestamp: string; message: string }> }>(
      `query($deploymentId: String!, $limit: Int!) { deploymentLogs(deploymentId: $deploymentId, limit: $limit) { timestamp message } }`,
      { deploymentId: dep.id, limit: 50 },
    )
    for (const r of l.deploymentLogs) {
      if (!r.message.includes('[fts-index]')) continue
      const key = r.timestamp + r.message
      if (seen.has(key)) continue
      seen.add(key)
      console.log(`    ${r.timestamp.slice(11, 19)}  ${r.message.trim()}`)
    }
    if (l.deploymentLogs.some(r => r.message.includes('[fts-index] DONE'))) { console.log('  >>> DONE'); return }
  }
  console.log('monitor window elapsed — build continues on Railway. Re-attach with: fts-railway-run.ts logs')
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
  : mode === 'idle' ? idle
  : mode === 'canary' ? async () => { await tailLogs(await deployWith(CANARY_CMD)) }
  : mode === 'full' ? async () => { await monitorStartup(await deployWith(FULL_CMD), 7) }
  : mode === 'v1' ? async () => { await monitorStartup(await deployWith(V1_CMD), 7) }
  : mode === 'logs' ? logs
  : mode === 'teardown' ? teardown
  : null
if (!fn) { console.error('usage: FTS_SERVICE=<svc> fts-railway-run.ts setup|idle|canary|full|v1|logs|teardown'); process.exit(1) }
fn().catch(e => { console.error(e); process.exit(1) })
