/**
 * restart-workers-staggered.ts — restart all 20 workers + scheduler in batches of 5,
 * 20s gap between batches, using Railway serviceInstanceRedeploy mutation.
 * Does NOT restart scrutinise-db.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const RAILWAY_API  = 'https://backboard.railway.com/graphql/v2'
const ENV_ID       = '991f733c-719c-4217-a6d6-1dbe80642bbe'
const BATCH_SIZE   = 5
const BATCH_GAP_MS = 20_000

async function railwayGql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) throw new Error('RAILWAY_API_TOKEN not set')
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`Railway API HTTP ${res.status}`)
  const data = await res.json() as { data?: T; errors?: Array<{ message: string }> }
  if (data.errors?.length) throw new Error(data.errors.map(e => e.message).join(', '))
  return data.data as T
}

interface Service { id: string; name: string; latestStatus: string; latestDeployId: string }

async function listServices(): Promise<Service[]> {
  const projectId = process.env.RAILWAY_PROJECT_ID
  if (!projectId) throw new Error('RAILWAY_PROJECT_ID not set')

  const data = await railwayGql<{
    project: {
      services: {
        edges: Array<{
          node: {
            id: string
            name: string
            deployments: { edges: Array<{ node: { id: string; status: string } }> }
          }
        }>
      }
    }
  }>(`
    query GetServices($projectId: String!) {
      project(id: $projectId) {
        services {
          edges {
            node {
              id
              name
              deployments(last: 1) {
                edges { node { id status } }
              }
            }
          }
        }
      }
    }
  `, { projectId })

  return data.project.services.edges.map(e => ({
    id: e.node.id,
    name: e.node.name,
    latestStatus: e.node.deployments.edges[0]?.node.status ?? 'UNKNOWN',
    latestDeployId: e.node.deployments.edges[0]?.node.id ?? '',
  }))
}

async function serviceInstanceRedeploy(serviceId: string): Promise<boolean> {
  try {
    await railwayGql(`
      mutation Redeploy($serviceId: String!, $environmentId: String!) {
        serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
      }
    `, { serviceId, environmentId: ENV_ID })
    return true
  } catch (err) {
    console.error(`  redeploy failed for ${serviceId}:`, err)
    return false
  }
}

async function pollServicesUntilSuccess(
  services: Service[],
  timeoutMs = 180_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  const names = new Set(services.map(s => s.name))
  console.log(`\nPolling ${names.size} services for SUCCESS (timeout ${timeoutMs / 1000}s)…`)

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 8_000))
    const all = await listServices()
    const relevant = all.filter(s => names.has(s.name))
    const pending   = relevant.filter(s => !['SUCCESS', 'CRASHED', 'FAILED'].includes(s.latestStatus))
    const succeeded = relevant.filter(s => s.latestStatus === 'SUCCESS')
    const crashed   = relevant.filter(s => ['CRASHED', 'FAILED'].includes(s.latestStatus))

    console.log(`  ${succeeded.length}/${names.size} SUCCESS  |  ${pending.length} pending  |  ${crashed.length} failed`)
    if (crashed.length) console.log('  FAILED:', crashed.map(s => `${s.name}(${s.latestStatus})`).join(', '))
    if (pending.length === 0) {
      console.log('All services settled.')
      return
    }
  }
  console.warn('Timeout reached before all services settled.')
}

async function main() {
  console.log('Fetching Railway service list…')
  const all = await listServices()
  console.log(`Found ${all.length} total services:`)
  all.forEach(s => console.log(`  ${s.name.padEnd(30)} ${s.latestStatus}  (${s.id})`))

  // Select workers 1–20 + scheduler; exclude scrutinise-db and ingest-monitor
  const SKIP = new Set(['scrutinise-db', 'ingest-monitor'])
  const targets = all.filter(s => {
    const n = s.name.toLowerCase()
    return !SKIP.has(s.name.toLowerCase()) &&
           !SKIP.has(s.name) &&
           (n.startsWith('ingest-worker') || n === 'ingest-scheduler')
  })
  targets.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  console.log(`\nTargeting ${targets.length} services for restart:`)
  targets.forEach(s => console.log(`  ${s.name}`))

  // Staggered restart: batches of BATCH_SIZE with BATCH_GAP_MS between
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    const totalBatches = Math.ceil(targets.length / BATCH_SIZE)
    console.log(`\n── Batch ${batchNum}/${totalBatches}: ${batch.map(s => s.name).join(', ')}`)

    await Promise.all(batch.map(async s => {
      const ok = await serviceInstanceRedeploy(s.id)
      console.log(`  ${ok ? '✓' : '✗'} triggered: ${s.name}`)
    }))

    if (i + BATCH_SIZE < targets.length) {
      console.log(`  Waiting ${BATCH_GAP_MS / 1000}s before next batch…`)
      await new Promise(r => setTimeout(r, BATCH_GAP_MS))
    }
  }

  // Poll until all SUCCESS
  await pollServicesUntilSuccess(targets)

  // Final status table
  console.log('\n── Final deployment status:')
  const final = await listServices()
  const relevant = final.filter(s => targets.some(t => t.id === s.id))
  relevant
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .forEach(s => console.log(`  ${s.name.padEnd(30)} ${s.latestStatus}`))
}

main().catch(err => { console.error(err); process.exit(1) })
