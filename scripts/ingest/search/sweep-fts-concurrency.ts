/**
 * sweep-fts-concurrency.ts — find the REAL ceiling for FTS_MAX_CONCURRENT instead of assuming 4.
 *
 * 4 was set as a crash guard: concurrent native calls against one shared Lance handle killed the
 * process at 15 concurrent (no JS-catchable error). Three later findings suggest it is over-tight:
 * one handle scaled ~4x from concurrency 1→8 in the handle-pool probe, 64 concurrent chunk reads
 * did not crash, and the index-build OOM turned out to be DataFusion's internal memory pool rather
 * than machine memory — which makes "memory pool", not "handle contention", a live candidate for
 * the original crash too. Meanwhile the service reports p50 960ms while users wait 12s: pure queue.
 *
 * For each cap it sets the Railway variable, redeploys, WAITS FOR A HEALTHY BOOT, then drives the
 * router's real fan-out at 5 and 10 simulated users and records what the client actually saw.
 *
 * A CRASH IS A RESULT, NOT A FAILURE. If a cap kills the process, that is the answer to the open
 * question about the crash mechanism, so the script records it and carries on to the next cap
 * rather than aborting. Railway restarts the service either way.
 *
 * ⚠ fts-serve is the LIVE BM25 path. Every step here restarts it. Run it when traffic is idle.
 *
 * Usage:
 *   tsx search/sweep-fts-concurrency.ts                      # caps 4,8,16,24 at 5 and 10 users
 *   tsx search/sweep-fts-concurrency.ts --caps 4,8 --users 5
 *   tsx search/sweep-fts-concurrency.ts --set 16             # just set a cap and redeploy, no load
 */
import path from 'path'
import fs from 'fs'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })

export {}

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const SERVICE_ID = fs.readFileSync(path.join(__dirname, '.fts-serve-service-id'), 'utf8').trim()
// RAILWAY_PROJECT_ID is NOT in .env — assuming it was cost the first sweep run, because
// `variableUpsert` with projectId: undefined fails as an opaque "Problem processing request"
// rather than a missing-argument error. Resolve both ids from the project token instead; it
// knows them, and that removes the env dependency entirely.
let ENV_ID = process.env.ENV_ID ?? '991f733c-719c-4217-a6d6-1dbe80642bbe'
let PROJECT_ID = process.env.RAILWAY_PROJECT_ID ?? ''
const FTS_URL = (process.env.FTS_TEST_URL ?? 'https://fts-serve-production.up.railway.app').replace(/\/$/, '')

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d }
const CAPS = arg('caps', '4,8,16,24').split(',').map((s) => parseInt(s.trim(), 10))
const USERS = arg('users', '5,10').split(',').map((s) => parseInt(s.trim(), 10))
const SET_ONLY = (() => { const i = process.argv.indexOf('--set'); return i >= 0 ? parseInt(process.argv[i + 1], 10) : null })()
const BOOT_TIMEOUT_MS = parseInt(process.env.SWEEP_BOOT_TIMEOUT_MS ?? '420000', 10)

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Railway has two token kinds and they authenticate differently — see fts-serve-run.ts. */
function authHeader(): Record<string, string> {
  const t = process.env.RAILWAY_API_TOKEN ?? ''
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)
    ? { 'Project-Access-Token': t } : { Authorization: `Bearer ${t}` }
}
async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(RAILWAY_API, { method: 'POST', headers: { ...authHeader(), 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) })
  const data = await res.json() as { data?: T; errors?: Array<{ message: string }> }
  if (data.errors?.length) throw new Error(JSON.stringify(data.errors))
  return data.data as T
}

/** The project token knows its own project + environment; ask it rather than trusting env. */
async function resolveIds(): Promise<void> {
  if (PROJECT_ID) return
  const d = await gql<{ projectToken: { projectId: string; environmentId: string } | null }>(
    `{ projectToken { projectId environmentId } }`, {})
  if (!d.projectToken) throw new Error('RAILWAY_PROJECT_ID unset and the token is not a project token — set RAILWAY_PROJECT_ID')
  PROJECT_ID = d.projectToken.projectId
  ENV_ID = d.projectToken.environmentId
  console.log(`resolved project=${PROJECT_ID} env=${ENV_ID} from the project token`)
}

async function setCap(cap: number): Promise<void> {
  await gql(`mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }`, {
    input: { projectId: PROJECT_ID, environmentId: ENV_ID, serviceId: SERVICE_ID, name: 'FTS_MAX_CONCURRENT', value: String(cap) },
  })
}

/** deploymentRedeploy on the LATEST deployment — not serviceInstanceRedeploy, which rebuilds
 *  from source (slow) and is a silent no-op when there is no deployment to re-run (§Railway ops). */
async function redeploy(): Promise<string> {
  const d = await gql<{ deployments: { edges: Array<{ node: { id: string; status: string } }> } }>(
    `query($serviceId: String!) { deployments(first: 1, input: { serviceId: $serviceId }) { edges { node { id status } } } }`,
    { serviceId: SERVICE_ID })
  const id = d.deployments.edges[0]?.node.id
  if (!id) throw new Error('no deployment found to redeploy')
  await gql(`mutation($id: String!) { deploymentRedeploy(id: $id) { id } }`, { id })
  return id
}

async function stats(): Promise<any | null> {
  try { const r = await fetch(`${FTS_URL}/stats`, { signal: AbortSignal.timeout(15000) }); return r.ok ? await r.json() : null } catch { return null }
}

/** Wait for a NEW process (started_at later than before) that answers /stats and reports the cap
 *  we asked for. Checking the cap is the point: a redeploy that silently kept the old variable
 *  would otherwise be measured as if it were the new one. */
async function waitForBoot(prevStartedAt: string | null, wantCap: number): Promise<any> {
  const t0 = Date.now()
  let lastSeen = 'nothing yet'
  while (Date.now() - t0 < BOOT_TIMEOUT_MS) {
    const s = await stats()
    if (s?.started_at) {
      lastSeen = `started_at=${s.started_at} cap=${s.concurrency?.max}`
      const isNew = !prevStartedAt || s.started_at !== prevStartedAt
      if (isNew && s.concurrency?.max === wantCap) return s
    }
    await sleep(5000)
  }
  throw new Error(`service did not come up with cap=${wantCap} within ${BOOT_TIMEOUT_MS / 1000}s (last seen: ${lastSeen})`)
}

// ── load generation: the router's real fan-out (same scopes as simulate-router-load.ts) ──
const COMMITTEE_CORPORA = ['committees-reports', 'committees-evidence']
const NON_DEBATE = [...COMMITTEE_CORPORA, 'bills-api', 'uk-treaties', 'tax-treaties-dta', 'members-interests', 'erskine-may']
const STREAMS = [
  { tier: 'legislation' },
  { tier: 'parliamentary', excludeCorpora: NON_DEBATE },
  { tier: 'parliamentary', corpora: COMMITTEE_CORPORA },
  { tier: 'caselaw' },
  { tier: 'guidance' },
] as const
const STEMS = [
  'enforcement against water companies for sewage discharge',
  'duty to consult before closing a local service',
  'private rented sector possession grounds reform',
  'planning permission for onshore wind development',
  'statutory guidance on children in temporary accommodation',
  'business rates relief for retail premises',
  'data protection impact assessment obligations',
  'procurement thresholds for local authority contracts',
  'flood risk management funding responsibilities',
  'apprenticeship levy employer obligations',
]
let nonce = 1

async function call(query: string, s: (typeof STREAMS)[number]): Promise<{ ms: number; ok: boolean; err?: string }> {
  const t0 = Date.now()
  try {
    const res = await fetch(`${FTS_URL}/fts-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, limit: 20, tier: s.tier, ...('corpora' in s && s.corpora ? { corpora: s.corpora } : {}), ...('excludeCorpora' in s && s.excludeCorpora ? { excludeCorpora: s.excludeCorpora } : {}) }),
      signal: AbortSignal.timeout(180000),
    })
    await res.text()
    return { ms: Date.now() - t0, ok: res.ok, err: res.ok ? undefined : `HTTP ${res.status}` }
  } catch (e) { return { ms: Date.now() - t0, ok: false, err: (e as Error).message } }
}

const pct = (a: number[], p: number) => a.length ? [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : 0

async function runLevel(users: number) {
  const t0 = Date.now()
  const runs = await Promise.all(Array.from({ length: users }, async (_, u) => {
    const q = `${STEMS[(u + nonce) % STEMS.length]} ${nonce + u}`
    const uT0 = Date.now()
    const calls = await Promise.all(STREAMS.map((s) => call(q, s)))
    return { calls, wallMs: Date.now() - uT0 }
  }))
  nonce += users
  const calls = runs.flatMap((r) => r.calls)
  const ok = calls.filter((c) => c.ok).map((c) => c.ms)
  const failed = calls.filter((c) => !c.ok)
  const wall = runs.map((r) => r.wallMs)
  return {
    users, callP50: pct(ok, 50), callP95: pct(ok, 95),
    userP50: pct(wall, 50), userP95: pct(wall, 95), userMax: Math.max(...wall),
    failed: failed.length, firstErr: failed[0]?.err, levelMs: Date.now() - t0,
  }
}

async function main() {
  await resolveIds()
  if (SET_ONLY != null) {
    const before = (await stats())?.started_at ?? null
    console.log(`setting FTS_MAX_CONCURRENT=${SET_ONLY} and redeploying …`)
    await setCap(SET_ONLY); await redeploy()
    const s = await waitForBoot(before, SET_ONLY)
    console.log(`up: cap=${s.concurrency.max} started_at=${s.started_at}`)
    return
  }

  console.log(`sweep FTS_MAX_CONCURRENT ∈ {${CAPS.join(', ')}} at users ∈ {${USERS.join(', ')}}`)
  console.log(`service ${SERVICE_ID} @ ${FTS_URL}`)
  console.log('⚠ fts-serve is the live BM25 path; each cap restarts it.\n')

  const rows: Array<Record<string, unknown>> = []
  for (const cap of CAPS) {
    const before = (await stats())?.started_at ?? null
    process.stdout.write(`cap=${String(cap).padStart(2)}  setting + redeploying … `)
    await setCap(cap)
    await redeploy()
    let booted: any
    try { booted = await waitForBoot(before, cap) } catch (e) { console.log(`BOOT FAILED — ${(e as Error).message}`); rows.push({ cap, note: 'boot failed' }); continue }
    console.log(`up (${booted.started_at})`)
    for (const users of USERS) {
      const r = await runLevel(users)
      const after = await stats()
      const crashed = !after || after.started_at !== booted.started_at
      rows.push({ cap, ...r, crashed,
        internalP50: after?.warm_p50_ms ?? null, internalP95: after?.warm_p95_ms ?? null,
        queueP95: after?.queue_p95_ms ?? null, queueHWM: after?.concurrency?.queueHighWaterMark ?? null,
        peakRssMb: after?.memory?.peak_rss_mb ?? null, errors: after?.errors ?? null })
      console.log(`   ${String(users).padStart(2)} users → user p50 ${String(r.userP50).padStart(6)}ms  p95 ${String(r.userP95).padStart(6)}ms  ` +
        `call p95 ${String(r.callP95).padStart(6)}ms  failed ${r.failed}${r.firstErr ? ` (${r.firstErr})` : ''}  ` +
        `queueHWM ${after?.concurrency?.queueHighWaterMark ?? '?'}  peakRSS ${after?.memory?.peak_rss_mb ?? '?'}MB` +
        (crashed ? '  ⚠ SERVICE RESTARTED DURING THIS LEVEL — treat as a crash' : ''))
      if (crashed) { await waitForBoot(null, cap).catch(() => {}) }
    }
  }

  console.log('\n════ SUMMARY — user-visible p95 (ms) ════')
  console.log('cap  ' + USERS.map((u) => `${u}u`.padStart(10)).join('') + '   verdict')
  for (const cap of CAPS) {
    const cells = USERS.map((u) => {
      const r = rows.find((x) => x.cap === cap && x.users === u) as any
      return (r ? `${r.userP95}${r.crashed ? '✗' : r.failed ? `/${r.failed}f` : ''}` : '—').padStart(10)
    })
    const any = rows.filter((x: any) => x.cap === cap) as any[]
    const verdict = any.some((r) => r.crashed) ? 'CRASHED' : any.some((r) => r.failed) ? 'errors' : any.length ? 'stable' : 'boot failed'
    console.log(`${String(cap).padEnd(5)}${cells.join('')}   ${verdict}`)
  }
  console.log('\nraw:'); console.log(JSON.stringify(rows, null, 1))
}

main().catch((e) => { console.error(e); process.exit(1) })
