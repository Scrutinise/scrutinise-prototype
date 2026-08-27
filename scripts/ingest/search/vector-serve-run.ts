/**
 * vector-serve-run.ts — stand up the PERMANENT, always-on Railway service that serves the
 * DENSE (vector) query API (vector-query-service.ts → POST /vector-search) for the
 * platform/Lex.
 *
 * Sibling of fts-serve-run.ts, and deliberately a near-copy of it: the two serve services
 * should be operated the same way, and a second file that drifted in its Railway handling
 * would be worse than a bit of duplication. Differences are listed below, each with a reason.
 *
 * DIFFERENCES FROM fts-serve-run.ts
 *   1. START_CMD runs vector-query-service.ts on VECTOR_PORT (8081), not 8080.
 *   2. GEMINI_API_KEY IS INJECTED. This is blocker B2 (docs/VECTOR_DEPLOY_READINESS.md):
 *      vector-core.ts embeds every live query through Gemini, so unlike BM25 this service
 *      has an external dependency on the SERVING path — a cost, a rate limit and an
 *      outage mode that FTS does not have. Without the key the service boots and then
 *      fails every query, so it is REQUIRED, not optional.
 *   3. NEON_DATABASE_URL is NOT injected. fts-serve needs it for the citation-resolver
 *      ActIndex; vector-query-service.ts opens no Postgres connection at all. Injecting an
 *      unused production database credential into a service that has no use for it is a
 *      needless widening of where that secret exists.
 *   4. A `restart` command exists alongside `redeploy`, and they are NOT the same thing —
 *      see the note on those functions. fts-serve-run.ts has only `redeploy`.
 *
 * ⚠ DEPLOYING THIS CHANGES NOTHING USER-VISIBLE, BY DESIGN. Two independent gates stay
 * shut: `runVectorSearch` returns [] unless VECTOR_SEARCH_URL is set (it is not set
 * anywhere, local or Vercel), and `fusedStream` delegates to BM25 unless
 * LEX_VECTOR_STREAMS names the stream (it is unset). The service exists and is warm;
 * nothing routes to it. Setting VECTOR_SEARCH_URL in Vercel is a SEPARATE, later step and
 * is Charlie's call.
 *
 * Usage:
 *   tsx search/vector-serve-run.ts plan      — print exactly what `up` would do. Creates nothing.
 *   tsx search/vector-serve-run.ts up        — create + configure + public domain + deploy; prints the URL
 *   tsx search/vector-serve-run.ts url       — print the public URL
 *   tsx search/vector-serve-run.ts redeploy  — rebuild from latest Main (after a CODE change)
 *   tsx search/vector-serve-run.ts restart   — restart the SAME build (after an INDEX change)
 *   tsx search/vector-serve-run.ts logs      — tail the latest deployment's [vector-query] logs
 *   tsx search/vector-serve-run.ts stats     — GET /stats (memory, concurrency, cache, latency)
 *   tsx search/vector-serve-run.ts teardown  — delete the service
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

export {}

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
// RAILWAY_PROJECT_ID is documented in docs/INGEST_PLAYBOOK.md but is NOT in
// scrutinise-web/.env, so fts-serve-run.ts's bare `process.env.RAILWAY_PROJECT_ID!` would
// send `undefined` to the API and fail with an opaque Railway error. Default to the
// project id VERIFIED against the live API on 2026-08-07 (project "miraculous-nature",
// whose services are fts-build / fts-serve / fts-pilot / Ingest / Ops / scrutinise-db),
// still overridable by env.
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID ?? '68707c61-5c68-4f37-88fc-c301fd6b90e7'
const ENV_ID = process.env.ENV_ID ?? '991f733c-719c-4217-a6d6-1dbe80642bbe'
const REPO = 'Scrutinise/scrutinise-prototype'
const SERVICE_NAME = process.env.VECTOR_SERVE_SERVICE ?? 'vector-serve'
const PORT = parseInt(process.env.VECTOR_SERVE_PORT ?? '8081', 10)
const STATE_KEY = path.join(__dirname, `.${SERVICE_NAME}-service-id`)

// Long-lived HTTP server. VECTOR_PORT pins the listen port to the domain's targetPort.
const START_CMD = `sh -c 'VECTOR_PORT=${PORT} npx tsx search/vector-query-service.ts'`

// GEMINI (live query embedding — B2) + R2 (corpus_vec / corpus_chunks datasets).
// NOT Neon, and NOT the Railway token: this service calls neither.
const NEEDED = [
  'GEMINI_API_KEY',
  'CLOUDFLARE_R2_ACCOUNT_ID',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET_NAME',
] as const

const fs = require('fs') as typeof import('fs')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Railway has TWO token kinds and they authenticate DIFFERENTLY (3 Aug 2026):
 *   - account / team token  → `Authorization: Bearer <token>`
 *   - PROJECT token (a UUID, scoped to one project+environment)
 *                           → `Project-Access-Token: <token>`  (Bearer returns "Not Authorized")
 * fts-serve-run.ts hardcoded Bearer until 2026-08-05 and every command in it failed with a
 * bare "Not Authorized" against the project token in .env. Copied here in its fixed form;
 * the two must not drift again.
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

/**
 * Connect the service to Main. NOT optional, and not what `serviceCreate` does any more.
 *
 * ⚠ `serviceCreate({ branch: 'Main', source: { repo } })` — exactly what fts-serve-run.ts
 * does, and what created `fts-serve` in June — created the service WITHOUT a repo trigger
 * on 7 Aug 2026. The service came up fully configured (source, rootDirectory, builder,
 * startCommand, restartPolicy all correct) and `up` reported success, but
 * `repoTriggers` was `[]`, `deployments` was `[]`, and the public domain served
 * `404 Application not found` — Railway had nothing to build from. `fts-serve` has a repo
 * trigger; `vector-serve` did not. Fixed by connecting explicitly, which is idempotent
 * and safe to re-run.
 */
async function ensureRepoConnected(id: string) {
  const existing = await gql<{ service: { repoTriggers: { edges: Array<{ node: { branch: string } }> } } }>(
    `query($id: String!) { service(id: $id) { repoTriggers { edges { node { branch repository } } } } }`,
    { id },
  ).catch(() => null)
  if (existing?.service?.repoTriggers?.edges?.length) return 'present'
  try {
    await gql(
      `mutation($id: String!, $input: ServiceConnectInput!) { serviceConnect(id: $id, input: $input) { id } }`,
      { id, input: { repo: REPO, branch: 'Main' } },
    )
    return 'connected'
  } catch (e) {
    // `serviceConnect` returns "Not Authorized" for a PROJECT token — connecting a GitHub
    // repo needs an account token with the GitHub link. This is NOT fatal: the trigger only
    // provides AUTO-deploy on push, and `serviceInstanceDeploy(latestCommit)` below deploys
    // from the branch head without it. The consequence is simply that vector-serve does not
    // rebuild by itself when Main moves — it deploys when this script says so, which for a
    // service being brought up deliberately is arguably the safer default. To get
    // auto-deploy, connect the repo once in the Railway UI.
    if ((e as Error).message.includes('Not Authorized')) return 'unauthorized'
    throw e
  }
}

/** REBUILD from latest Main. Use after a CODE change — it pulls and rebuilds the image. */
async function redeployLatest(id: string) {
  // serviceInstanceRedeploy re-runs the LATEST DEPLOYMENT. With no deployment yet (a
  // freshly created service) there is nothing for it to re-run, so it succeeds and does
  // nothing — which is precisely how the first `up` reported success while deploying
  // nothing. serviceInstanceDeploy(latestCommit) builds from the branch head instead, so
  // it works both for the first deploy and for every later one.
  await gql(
    `mutation($serviceId: String!, $environmentId: String!) {
      serviceInstanceDeploy(serviceId: $serviceId, environmentId: $environmentId, latestCommit: true)
    }`,
    { serviceId: id, environmentId: ENV_ID },
  )
}

async function latestDeployment(id: string) {
  const d = await gql<{ deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string } }> } }>(
    `query($serviceId: String!) { deployments(first: 1, input: { serviceId: $serviceId }) { edges { node { id status createdAt } } } }`,
    { serviceId: id },
  )
  return d.deployments.edges[0]?.node
}

/**
 * RESTART the same build. Distinct from `redeploy`, and the distinction is load-bearing:
 * vector-query-service.ts calls openTable() ONCE at boot with no readConsistencyInterval,
 * so it holds a FIXED SNAPSHOT of corpus_vec. After any index work (a rebuild, a merge, a
 * vec-hygiene deletion) it keeps serving the OLD index until the process restarts, and any
 * measurement taken before that restart is meaningless — docs/CLAUDE.md §17 records this
 * as an already-paid-for trap on fts-serve. This uses deploymentRedeploy (restart the
 * existing deployment) rather than serviceInstanceRedeploy (rebuild from source), per the
 * root CLAUDE.md Railway note.
 */
async function restart() {
  const id = loadId()
  const dep = await latestDeployment(id)
  if (!dep) throw new Error('no deployment to restart — run "up" first')
  await gql(
    `mutation($id: String!) { deploymentRedeploy(id: $id) { id status } }`,
    { id: dep.id },
  )
  console.log(`restart triggered on deployment ${dep.id.slice(0, 8)} (same build, fresh openTable snapshot).`)
}

/**
 * S15 §5 — SET THE SERVICE'S WIDTH, THEN READ BACK WHAT IT ACTUALLY IS.
 *
 * ⚠ THE READ-BACK IS THE POINT, NOT A COURTESY. The brief: "Prove the new width is real. Read
 * the concurrency off /stats on the running service, not from the configuration you set. A
 * limiter that silently failed open would look identical to one that worked — this project has
 * already shipped that exact defect once, which is why `maxInFlight` is observed rather than
 * assumed."
 *
 * So this sets `VECTOR_MAX_CONCURRENT`, restarts, waits for the service to answer, and prints
 * the value the RUNNING PROCESS reports. If the two disagree it says so and exits non-zero —
 * a variable that was accepted by the API and ignored by the process is exactly the shape that
 * would otherwise be written up as a successful capacity change.
 *
 * ⚠ `restart` and not `redeploy`: this changes an environment variable, not code. A redeploy
 * would rebuild from Main and confuse "the width changed" with "the code changed" in the same
 * measurement.
 */
async function width() {
  const n = parseInt(process.argv[3] ?? '', 10)
  if (!Number.isFinite(n) || n < 1 || n > 64) {
    console.error('usage: vector-serve-run.ts width <1..64>   (also sets the queue cap to 2x by default)')
    process.exit(1)
  }
  const id = loadId()
  const before = await readStats()
  console.log(`current: max=${before.concurrency.max} maxQueue=${before.concurrency.maxQueue} (build ${before.build ?? '?'})`)

  await gql(
    `mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }`,
    { input: { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: id, name: 'VECTOR_MAX_CONCURRENT', value: String(n) } },
  )
  console.log(`set VECTOR_MAX_CONCURRENT=${n}; restarting (same build)…`)
  await restart()

  // Wait for the NEW process: `started_at` moving is how a restart is told from a service that
  // never went away. Comparing `max` alone would pass instantly against the old process if the
  // restart had silently failed.
  // ⚠ THE WAIT TOLERATES 502s, BECAUSE THE CONTAINER SWAP PRODUCES THEM AND AN UNREADABLE
  // SERVICE IS NOT A FAILED ONE. The first version of this treated "started_at never moved" as
  // the failure condition, and reported ⛔ against a service that had in fact restarted and was
  // already reporting max=16 — it had simply been 502ing through the whole poll window. A guard
  // that cries wolf gets ignored, which is the same end state as no guard.
  const deadline = Date.now() + 8 * 60_000
  let after: any = null
  let lastErr = ''
  while (Date.now() < deadline) {
    await sleep(10_000)
    try {
      const s = await readStats()
      // Either signal is enough: a new process, or the value we asked for. Requiring BOTH is
      // what made this brittle — the restart can complete between two polls.
      if (s.started_at !== before.started_at || s.concurrency.max === n) { after = s; break }
      after = s
    } catch (e) { lastErr = (e as Error).message }
  }
  if (!after) {
    console.error(`⛔ the service never became readable within 8 minutes (last error: ${lastErr}). Width UNKNOWN — check /stats before recording anything.`)
    process.exit(1)
  }
  console.log(`observed on the running service: max=${after.concurrency.max} maxQueue=${after.concurrency.maxQueue} started_at=${after.started_at}`)
  if (after.concurrency.max !== n) {
    console.error(`⛔ SET ${n}, SERVICE REPORTS ${after.concurrency.max}. The configuration did not take effect — do not record this as a capacity change.`)
    process.exit(1)
  }
  if (after.started_at === before.started_at) {
    console.error('⛔ the width reads correct but the process never restarted — that cannot both be true. Investigate before recording.')
    process.exit(1)
  }
  console.log(`✅ width is ${n}, read off the running process. Queue cap ${after.concurrency.maxQueue} (2x by default).`)
}

/**
 * ⚠ DELIBERATELY NOT `ensureDomain`. That helper's existence-query is wrapped in
 * `.catch(() => null)`, so a transient GraphQL blip makes it fall through to CREATING a domain —
 * and on 27 Aug that turned a read of /stats into "You have reached the limit for service domains
 * per service on your plan". A function whose job is to observe must not be able to mutate.
 */
function statsUrl(): string {
  const explicit = process.env.VECTOR_SEARCH_URL
  if (explicit) return `${explicit.replace(/\/$/, '')}/stats`
  return `https://${SERVICE_NAME}-production.up.railway.app/stats`
}
async function readStats(): Promise<any> {
  const res = await fetch(statsUrl())
  if (!res.ok) throw new Error(`/stats ${res.status}`)
  return await res.json()
}

async function plan() {
  console.log('PLAN — nothing below is executed.\n')
  const exists = fs.existsSync(STATE_KEY)
  console.log(`  service name      ${SERVICE_NAME}`)
  console.log(`  already recorded  ${exists ? `yes (${loadId()}) → would RECONFIGURE` : 'no → would CREATE'}`)
  console.log(`  project / env     ${PROJECT_ID} / ${ENV_ID}`)
  console.log(`  source            ${REPO}@Main, rootDirectory=scripts/ingest, builder=RAILPACK`)
  console.log(`  start command     ${START_CMD}`)
  console.log(`  restart policy    ALWAYS, numReplicas=1`)
  console.log(`  watchPatterns     scripts/ingest/search/**`)
  console.log(`  public domain     yes, targetPort=${PORT}`)
  let vars: Record<string, string> = {}
  try { vars = collectVars() } catch (e) { console.log(`  variables         ✗ ${(e as Error).message}`); }
  if (Object.keys(vars).length) {
    console.log(`  variables         ${Object.keys(vars).length} injected: ${Object.keys(vars).join(', ')}`)
    console.log(`                    (values not printed; GEMINI_API_KEY is B2 — required, unlike fts-serve)`)
  }
  console.log('\n  COST: one always-on Railway service (a second serve container alongside fts-serve).')
  console.log('  USER IMPACT: none. VECTOR_SEARCH_URL is unset and LEX_VECTOR_STREAMS is unset,')
  console.log('  so nothing routes to it. Both gates stay shut until deliberately opened.')
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

  console.log('configuring: rootDirectory=scripts/ingest, builder=RAILPACK, restart=ALWAYS, start=vector-query-service')
  await updateInstance(id, {
    rootDirectory: 'scripts/ingest',
    builder: 'RAILPACK',
    startCommand: START_CMD,
    restartPolicyType: 'ALWAYS',
    numReplicas: 1,
    watchPatterns: ['scripts/ingest/search/**'],
  })

  const connected = await ensureRepoConnected(id)
  console.log({
    present: '  repo trigger already present (auto-deploys on push to Main)',
    connected: '  connected repo trigger → Scrutinise/scrutinise-prototype@Main',
    unauthorized: '  ⚠ no repo trigger — the project token cannot create one ("Not Authorized").\n' +
      '    Deploys still work via this script; the service just will NOT auto-deploy on push.\n' +
      '    Connect the repo once in the Railway UI if auto-deploy is wanted.',
  }[connected])

  const domain = await ensureDomain(id)
  console.log(`  public domain: https://${domain}`)
  console.log('deploying from Main…')
  await redeployLatest(id)
  console.log('\nup. The image builds (~1-2 min), the server boots (opens corpus_vec + corpus_chunks on R2,')
  console.log('self-warms one ANN query), then serves. Endpoints:')
  console.log(`  POST https://${domain}/vector-search   {query, tier?, limit?, corpora?, excludeCorpora?, noCache?}`)
  console.log(`  GET  https://${domain}/health`)
  console.log(`  GET  https://${domain}/stats`)
  console.log('\nVerify when the build finishes:  npx tsx search/vector-serve-run.ts logs')
  console.log('Then MEASURE MEMORY (B3):        npx tsx search/vector-serve-run.ts stats')
  console.log('\nNOTE: VECTOR_SEARCH_URL is deliberately NOT set anywhere by this script.')
}

async function url() {
  const id = loadId()
  const d = await ensureDomain(id)
  console.log(`https://${d}`)
}

async function redeploy() {
  const id = loadId()
  await redeployLatest(id)
  console.log('redeploy (rebuild from Main) triggered.')
}

async function logs() {
  const id = loadId()
  console.log('polling [vector-query] logs (Ctrl-C to detach)…')
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
    const tail = l.deploymentLogs.map((r) => r.message).filter((m) => m.includes('[vector-query]')).slice(-6)
    if (tail.length) console.log(tail.map((m) => '    ' + m).join('\n'))
    if (l.deploymentLogs.some((r) => r.message.includes('[vector-query] listening'))) { console.log('  >>> serving.'); return }
  }
}

async function stats() {
  const id = loadId()
  const d = await ensureDomain(id)
  const res = await fetch(`https://${d}/stats`)
  if (!res.ok) { console.error(`/stats returned ${res.status}`); process.exit(1) }
  const s = await res.json() as any
  console.log(JSON.stringify(s, null, 2))
  if (s.memory) {
    console.log(`\nMEMORY vs the ${s.memory.cap_mb} MB per-replica cap:`)
    console.log(`  current ${s.memory.rss_mb} MB (${s.memory.pct_of_cap}%)   PEAK ${s.memory.peak_rss_mb} MB (${s.memory.peak_pct_of_cap}%) at ${s.memory.peak_rss_at}`)
    console.log(s.memory.peak_pct_of_cap >= 70
      ? '  ⚠ peak is at/above 70% of the cap — see docs/CLAUDE.md §17 before doing anything else.'
      : '  peak is comfortably inside the cap.')
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
const fn = mode === 'plan' ? plan
  : mode === 'up' ? up
  : mode === 'url' ? url
  : mode === 'redeploy' ? redeploy
  : mode === 'restart' ? restart
  : mode === 'width' ? width
  : mode === 'logs' ? logs
  : mode === 'stats' ? stats
  : mode === 'teardown' ? teardown
  : null
if (!fn) { console.error('usage: vector-serve-run.ts plan|up|url|redeploy|restart|logs|stats|teardown'); process.exit(1) }
fn().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
