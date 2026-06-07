import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const RAILWAY_API  = 'https://backboard.railway.com/graphql/v2'
const MONITOR_SVC  = 'd4945e0c-207a-46ca-aceb-bdc010183cc5'

async function main() {
  const token     = process.env.RAILWAY_API_TOKEN
  const projectId = process.env.RAILWAY_PROJECT_ID
  if (!token || !projectId) throw new Error('RAILWAY_API_TOKEN or RAILWAY_PROJECT_ID not set')

  // Get last 5 deployments for the monitor service
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        query($projectId: String!) {
          project(id: $projectId) {
            services { edges { node { id name
              deployments(last: 5) { edges { node { id status createdAt staticUrl } } }
            } } }
          }
        }
      `,
      variables: { projectId },
    }),
  })
  const data = await res.json() as {
    data?: { project?: { services?: { edges?: Array<{ node: { id: string; name: string; deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string } }> } } }> } } }
    errors?: Array<{ message: string }>
  }

  if (data.errors?.length) { console.error(data.errors); return }

  const monitor = data.data?.project?.services?.edges?.find(e => e.node.id === MONITOR_SVC)
  if (!monitor) { console.log('Monitor service not found'); return }

  console.log(`ingest-monitor (${MONITOR_SVC}) — last 5 deployments:`)
  for (const d of monitor.node.deployments.edges) {
    console.log(`  ${d.node.status.padEnd(14)} ${d.node.createdAt.slice(0, 19)}  id=${d.node.id}`)
  }

  // Also show current serviceInstance config
  const cfgRes = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query($serviceId: String!, $environmentId: String!) {
        serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
          rootDirectory startCommand buildCommand
        }
      }`,
      variables: { serviceId: MONITOR_SVC, environmentId: '991f733c-719c-4217-a6d6-1dbe80642bbe' },
    }),
  })
  const cfg = await cfgRes.json() as { data?: { serviceInstance?: { rootDirectory: string | null; startCommand: string | null; buildCommand: string | null } } }
  const si = cfg.data?.serviceInstance
  console.log('\nCurrent service instance config:')
  console.log('  rootDirectory:', si?.rootDirectory)
  console.log('  startCommand: ', si?.startCommand)
  console.log('  buildCommand: ', si?.buildCommand)
}

main().catch(err => { console.error(err); process.exit(1) })
