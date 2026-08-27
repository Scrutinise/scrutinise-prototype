// ─────────────────────────────────────────────────────────────────────────────
// MEASURE how long a search service takes to become answerable from cold.
//
// ⚠ TWO DIFFERENT MEASUREMENTS, AND THEY ARE NOT INTERCHANGEABLE.
//
//   --restart   Restart the service and time until /health answers. This is the only
//               figure available BEFORE sleep is enabled, and it is what the timeout has
//               to be sized from — a container boot plus whatever the process loads.
//   --wake      Wait for the service to have dozed off, then time the first request.
//               The real thing. Only meaningful once sleepApplication is true.
//
// A restart is a PROXY. Railway's wake also has to schedule a container, so the true wake
// can be slower; sizing from the restart and then re-measuring the wake is the honest
// order, and both figures go in the report.
//
//   tsx scripts/ingest/ops/measure-cold-start.ts --restart fts-serve
//   tsx scripts/ingest/ops/measure-cold-start.ts --wake vector-serve
// ─────────────────────────────────────────────────────────────────────────────

import { rail } from './audit-sleep'
import { SERVICES, ENV_ID, instanceState } from './sleep-state'

type Name = keyof typeof SERVICES

/**
 * ⚠⚠ A REAL QUERY, NOT `/health` — AND THE DIFFERENCE IS THE WHOLE POINT OF THIS SCRIPT.
 *
 * `/health` on both services answers from the HTTP layer. The thing a user waits for is the
 * first SEARCH, which additionally needs the Lance table opened and its index paged in.
 * Sizing a timeout from the health figure would under-size it by exactly the amount that
 * matters, and the failure would land on the first user after every doze.
 *
 * So both figures are taken: health (the container is up) and query (it can actually
 * answer), and the timeout is sized from the second.
 */
const PROBE: Record<string, { path: string; body: unknown }> = {
  'fts-serve': { path: '/fts-search', body: { query: 'accountability', limit: 3 } },
  'vector-serve': { path: '/vector-search', body: { query: 'accountability', limit: 3 } },
}

async function timeToAnswer(
  url: string, name: string, budgetMs = 180_000,
): Promise<{ healthMs: number | null; queryMs: number; attempts: number } | null> {
  const probe = PROBE[name]
  const t0 = Date.now()
  let attempts = 0
  let healthMs: number | null = null
  while (Date.now() - t0 < budgetMs) {
    attempts++
    if (healthMs === null) {
      // ⚠ A SHORT PER-ATTEMPT TIMEOUT. A single hanging request would otherwise swallow the
      // whole budget and report "never came up" for a service that was merely slow once.
      const okHealth = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10_000) })
        .then((r) => r.ok).catch(() => false)
      if (okHealth) healthMs = Date.now() - t0
    }
    if (healthMs !== null && probe) {
      const served = await fetch(`${url}${probe.path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(probe.body),
        signal: AbortSignal.timeout(60_000),
      }).then((r) => r.ok).catch(() => false)
      if (served) return { healthMs, queryMs: Date.now() - t0, attempts }
    } else if (healthMs !== null && !probe) {
      return { healthMs, queryMs: healthMs, attempts }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return null
}

async function restartAndTime(name: Name) {
  const id = SERVICES[name]
  const st = await instanceState(id)
  const host = st.domains[0]
  if (!host) throw new Error(`${name} has no public domain`)
  const url = `https://${host}`

  // Confirm it is answering now, so "it came up" means something.
  const before = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10_000) })
    .then((r) => r.ok).catch(() => false)
  console.log(`${name}: answering before restart: ${before}`)

  const dep = await rail<{ serviceInstance: { latestDeployment: { id: string } | null } }>(`
    query I($serviceId: String!, $environmentId: String!) {
      serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
        latestDeployment { id }
      }
    }`, { serviceId: id, environmentId: ENV_ID })
  const deploymentId = dep.serviceInstance.latestDeployment?.id
  if (!deploymentId) throw new Error(`${name} has no deployment to restart`)

  console.log(`${name}: restarting ${deploymentId.slice(0, 8)}…`)
  await rail(`mutation R($id: String!) { deploymentRestart(id: $id) }`, { id: deploymentId })

  // ⚠ WAIT FOR IT TO ACTUALLY GO DOWN FIRST. Timing from the mutation would measure zero
  // on a service that had not yet stopped answering — the old process is still up for a
  // moment, and a "0 ms cold start" is the shape of a measurement that measured nothing.
  const t0 = Date.now()
  let wentDown = false
  while (Date.now() - t0 < 60_000) {
    const up = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3_000) })
      .then((r) => r.ok).catch(() => false)
    if (!up) { wentDown = true; break }
    await new Promise((r) => setTimeout(r, 250))
  }
  console.log(`${name}: observed down after ${Date.now() - t0} ms ${wentDown ? '' : '(NEVER SAW IT DROP — the figure below is a lower bound)'}`)

  const back = await timeToAnswer(url, name)
  if (!back) { console.log(`${name}: DID NOT COME BACK within the budget`); return }
  console.log(`${name}: /health after ${((back.healthMs ?? 0) / 1000).toFixed(1)} s`)
  console.log(`${name}: FIRST SERVED QUERY after ${(back.queryMs / 1000).toFixed(1)} s (${back.attempts} attempts)`)
}

async function wakeAndTime(name: Name) {
  const id = SERVICES[name]
  const st = await instanceState(id)
  const host = st.domains[0]
  if (!host) throw new Error(`${name} has no public domain`)
  if (!st.sleepApplication) {
    console.log(`⚠ ${name}: sleepApplication is FALSE — this measures a warm request, not a wake.`)
  }
  const url = `https://${host}`
  const t0 = Date.now()
  const r = await timeToAnswer(url, name)
  console.log(r
    ? `${name}: /health ${((r.healthMs ?? 0) / 1000).toFixed(1)} s · FIRST SERVED QUERY ${(r.queryMs / 1000).toFixed(1)} s (${r.attempts} attempts, from ${new Date(t0).toISOString()})`
    : `${name}: no answer within the budget`)
}

async function main() {
  const mode = process.argv.includes('--wake') ? 'wake' : 'restart'
  const name = process.argv[process.argv.indexOf(`--${mode}`) + 1] as Name
  if (!name || !(name in SERVICES)) {
    console.error(`usage: measure-cold-start.ts --restart|--wake <${Object.keys(SERVICES).join('|')}>`)
    process.exitCode = 1
    return
  }
  if (mode === 'restart') await restartAndTime(name)
  else await wakeAndTime(name)
}

if (require.main === module) {
  main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1 })
}
