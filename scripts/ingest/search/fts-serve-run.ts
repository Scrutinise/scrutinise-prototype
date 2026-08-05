/**
 * fts-serve-run.ts — stand up the PERMANENT, always-on Railway service that serves
 * the FTS query API (fts-query-service.ts → POST /fts-search) for the platform/Lex.
 *
 * Sibling of fts-railway-run.ts (the transient BUILD runner). The difference:
 *   - build runner: restartPolicy ON_FAILURE, exits when done, no public domain.
 *   - THIS (serve):  restartPolicy ALWAYS, long-lived HTTP server, PUBLIC domain so
 *     scrutinise-web can call it. Small instance — serving is light (opens corpus_fts
 *     on R2 once, loads the 135k-row ActIndex from Neon at boot), well inside the 8GB
 *     Hobby cap post-28-Jun. This is the permanent serving home.
 *
 * Git-connected to Main/RAILPACK/root=scripts/ingest, identical image to Ingest+build.
 * Injects NEON + R2 creds (so the citation resolver is active); NOT RAILWAY_API_TOKEN
 * (the service never calls Railway).
 *
 * Usage:
 *   tsx search/fts-serve-run.ts up        — create + configure + public domain + deploy; prints the URL
 *   tsx search/fts-serve-run.ts url       — print the public URL
 *   tsx search/fts-serve-run.ts redeploy  — redeploy latest Main (after a code change)
 *   tsx search/fts-serve-run.ts logs      — tail the latest deployment's [fts-query] logs
 *   tsx search/fts-serve-run.ts teardown  — delete the service
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID!
const ENV_ID = process.env.ENV_ID ?? '991f733c-719c-4217-a6d6-1dbe80642bbe'
const REPO = 'Scrutinise/scrutinise-prototype'
const SERVICE_NAME = process.env.FTS_SERVE_SERVICE ?? 'fts-serve'
const PORT = parseInt(process.env.FTS_SERVE_PORT ?? '8080', 10)
const STATE_KEY = path.join(__dirname, `.${SERVICE_NAME}-service-id`)

// Long-lived HTTP server. FTS_PORT pins the listen port to the domain's targetPort.
const START_CMD = `sh -c 'FTS_PORT=${PORT} npx tsx search/fts-query-service.ts'`

// NEON (citation resolver / ActIndex) + R2 (corpus_fts dataset). Same set the build
// needs; NOT the Railway token.
const NEEDED = [
  'NEON_DATABASE_URL',
  'CLOUDFLARE_R2_ACCOUNT_ID',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET_NAME',
] as const

const fs = require('fs') as typeof import('fs')
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * Railway has TWO token kinds and they authenticate DIFFERENTLY (3 Aug 2026):
 *   - account / team token  → `Authorization: Bearer <token>`
 *   - PROJECT token (a UUID, scoped to one project+environment)
 *                           → `Project-Access-Token: <token>`  (Bearer returns "Not Authorized")
 * This file hardcoded Bearer until 2026-08-05, so EVERY command in it — including the
 * `redeploy` that must follow any index rebuild — failed with a bare "Not Authorized" against
 * the project token in .env. Copied from fts-railway-run.ts, which already had it right;
 * the two should not drift again.
 */
function railwayAuthHeader(): Record<string, string> {
  const token = process.env.RAILWAY_API_TOKEN ?? ''
  const isProjectToken = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)
  return isProjectToken ? { 'Project-Access-Token': token } : { Authorization: `Bearer ${token}` }
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { ...railwayAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const data = await res.json() as { data?: T; errors?: Array<{ message: string }> }
  if (data.errors?.length) throw new Error(JSON.stringify(data.errors))
  return data.data as T
}

function saveId(id: string) { fs.writeFileSync(STATE_KEY, id, 'utf8') }
function loadId(): string {
  if (!fs.existsSync(STATE_KEY)) throw new Error(`no service id recorded — run "up" first (${STATE_KEY})`)
  return fs.readFileSync(STATE_KEY, 'utf8').trim()
}

function collectVars(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of NEEDED) {
    const v = process.env[k]
    if (!v) {
      if (k === 'CLOUDFLARE_R2_BUCKET_NAME') continue // lance.ts defaults to scrutinise-legislation
      throw new Error(`${k} not in env (scrutinise-web/.env) — cannot configure the serve service`)
    }
    out[k] = v
  }
  return out
}

async function updateInstance(id: string, input: Record<string, unknown>) {
  await gql(
    `mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
    }`,
    { serviceId: id, environmentId: ENV_ID, input },
  )
}

async function ensureDomain(id: string): Promise<string> {
  // Reuse an existing domain if one is already attached.
  const existing = await gql<{ domains: { serviceDomains: Array<{ domain: string }> } }>(
    `query($serviceId: String!, $environmentId: String!) {
      domains(serviceId: $serviceId, environmentId: $environmentId) { serviceDomains { domain } }
    }`,
    { serviceId: id, environmentId: ENV_ID },
  ).catch(() => null) as { domains: { serviceDomains: Array<{ domain: string }> } } | null
  const have = existing?.domains?.serviceDomains?.[0]?.domain
  if (have) return have
  const created = await gql<{ serviceDomainCreate: { domain: string } }>(
    `mutation($input: ServiceDomainCreateInput!) { serviceDomainCreate(input: $input) { domain } }`,
    { input: { serviceId: id, environmentId: ENV_ID, targetPort: PORT } },
  )
  return created.serviceDomainCreate.domain
}

async function redeployLatest(id: string) {
  await gql(
    `mutation($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }`,
    { serviceId: id, environmentId: ENV_ID },
  )
}

async function up() {
  const variables = collectVars()
  let id: string
  if (fs.existsSync(STATE_KEY)) {
    id = loadId()
    console.log(`service "${SERVICE_NAME}" already recorded (${id}) — reconfiguring`)
  } else {
    console.log(`creating service "${SERVICE_NAME}" from ${REPO}@Main with ${Object.keys(variables).length} vars`)
    const created = await gql<{ serviceCreate: { id: string } }>(
      `mutation($input: ServiceCreateInput!) { serviceCreate(input: $input) { id } }`,
      { input: { projectId: PROJECT_ID, environmentId: ENV_ID, name: SERVICE_NAME, branch: 'Main', source: { repo: REPO }, variables } },
    )
    id = created.serviceCreate.id
    saveId(id)
    console.log(`  serviceId=${id} (saved → ${STATE_KEY})`)
  }

  console.log('configuring: rootDirectory=scripts/ingest, builder=RAILPACK, restart=ALWAYS, start=fts-query-service')
  await updateInstance(id, {
    rootDirectory: 'scripts/ingest',
    builder: 'RAILPACK',
    startCommand: START_CMD,
    restartPolicyType: 'ALWAYS',
    numReplicas: 1,
    // never auto-redeploy on unrelated pushes — only search code matters here
    watchPatterns: ['scripts/ingest/search/**'],
  })

  const domain = await ensureDomain(id)
  console.log(`  public domain: https://${domain}`)
  console.log('redeploying…')
  await redeployLatest(id)
  console.log('\nup. The image builds (~1-2 min), the server boots (opens corpus_fts on R2 + loads ActIndex),')
  console.log('then serves. Endpoints:')
  console.log(`  POST https://${domain}/fts-search   {query, tier?, limit?}`)
  console.log(`  GET  https://${domain}/health`)
  console.log(`  GET  https://${domain}/stats`)
  console.log('\nVerify when the build finishes:  npx tsx search/fts-serve-run.ts logs')
}

async function url() {
  const id = loadId()
  const d = await ensureDomain(id)
  console.log(`https://${d}`)
}

async function redeploy() {
  const id = loadId()
  await redeployLatest(id)
  console.log('redeploy triggered.')
}

async function latestDeployment(id: string) {
  const d = await gql<{ deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string } }> } }>(
    `query($serviceId: String!) { deployments(first: 1, input: { serviceId: $serviceId }) { edges { node { id status createdAt } } } }`,
    { serviceId: id },
  )
  return d.deployments.edges[0]?.node
}

async function logs() {
  const id = loadId()
  console.log('polling [fts-query] logs (Ctrl-C to detach)…')
  let lastDep = ''
  for (let i = 0; i < 80; i++) { // ~20 min at 15s
    await sleep(15_000)
    const dep = await latestDeployment(id)
    if (!dep) { console.log('  (no deployment yet)'); continue }
    if (dep.id !== lastDep) { console.log(`  deployment ${dep.id.slice(0, 8)} ${dep.status} ${dep.createdAt}`); lastDep = dep.id }
    const l = await gql<{ deploymentLogs: Array<{ message: string }> }>(
      `query($deploymentId: String!, $limit: Int!) { deploymentLogs(deploymentId: $deploymentId, limit: $limit) { message } }`,
      { deploymentId: dep.id, limit: 30 },
    )
    const tail = l.deploymentLogs.map(r => r.message).filter(m => m.includes('[fts-query]')).slice(-6)
    if (tail.length) console.log(tail.map(m => '    ' + m).join('\n'))
    if (l.deploymentLogs.some(r => r.message.includes('[fts-query] listening'))) { console.log('  >>> serving.'); return }
  }
}

async function teardown() {
  const id = loadId()
  console.log(`deleting service ${id}`)
  await gql(`mutation($id: String!) { serviceDelete(id: $id) }`, { id })
  fs.unlinkSync(STATE_KEY)
  console.log('deleted.')
}

const mode = process.argv[2]
const fn = mode === 'up' ? up
  : mode === 'url' ? url
  : mode === 'redeploy' ? redeploy
  : mode === 'logs' ? logs
  : mode === 'teardown' ? teardown
  : null
if (!fn) { console.error('usage: fts-serve-run.ts up|url|redeploy|logs|teardown'); process.exit(1) }
fn().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
