import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const ENV_ID      = '991f733c-719c-4217-a6d6-1dbe80642bbe'

// Workers still CRASHED after first restart attempt (09:09 timestamps = old deployment)
const TARGETS = [
  { name: 'ingest-worker-10', id: 'eecdc235-36e3-4351-bfed-659f3947c752' },
  { name: 'ingest-worker-11', id: '87c9c70c-c865-424b-9025-d7a0de6df30a' },
  { name: 'ingest-worker-13', id: 'af5fdb2c-367f-4087-a11f-9a0a99230807' },
  { name: 'ingest-worker-15', id: 'fc3e1aab-75d9-4aba-ac6c-ae0f96ca0ccb' },
  { name: 'ingest-worker-16', id: 'e683f995-7938-4756-b645-a7b4626f0d7a' },
  { name: 'ingest-worker-17', id: '7d92a1d0-eb24-4631-97b4-797a0fa2a9e4' },
  { name: 'ingest-worker-18', id: '239e52f7-6a5d-41fd-a7bf-b22227ead4af' },
  { name: 'ingest-worker-20', id: '01174183-68c7-4afd-88d0-9932cca3f9fa' },
]

async function main() {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) throw new Error('RAILWAY_API_TOKEN not set')

  console.log(`Re-triggering ${TARGETS.length} crashed workers…`)
  for (const t of TARGETS) {
    const res = await fetch(RAILWAY_API, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation($serviceId: String!, $environmentId: String!) {
          serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
        }`,
        variables: { serviceId: t.id, environmentId: ENV_ID },
      }),
    })
    const d = await res.json() as { errors?: Array<{ message: string }> }
    const ok = !d.errors?.length
    console.log(`  ${ok ? '✓' : '✗'} ${t.name}`, d.errors?.[0]?.message ?? '')
  }

  console.log('Waiting 90s for builds…')
  await new Promise(r => setTimeout(r, 90_000))

  console.log('\nChecking final status…')
  const statusRes = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query($projectId: String!) {
        project(id: $projectId) {
          services { edges { node { id name
            deployments(last: 1) { edges { node { status createdAt } } }
          } } }
        }
      }`,
      variables: { projectId: process.env.RAILWAY_PROJECT_ID },
    }),
  })
  const statusData = await statusRes.json() as {
    data?: { project?: { services?: { edges?: Array<{ node: { id: string; name: string; deployments: { edges: Array<{ node: { status: string; createdAt: string } }> } } }> } } }
  }

  const svcs = (statusData.data?.project?.services?.edges ?? [])
    .map(e => ({
      name:   e.node.name,
      status: e.node.deployments.edges[0]?.node.status ?? 'NONE',
      ts:     e.node.deployments.edges[0]?.node.createdAt?.slice(0, 19) ?? '',
    }))
    .filter(s => s.name !== 'scrutinise-db' && s.name !== 'ingest-monitor')
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  const counts: Record<string, number> = {}
  svcs.forEach(s => counts[s.status] = (counts[s.status] ?? 0) + 1)
  console.log('Counts:', JSON.stringify(counts))
  svcs.forEach(s => console.log(`  ${s.name.padEnd(30)} ${s.status.padEnd(12)} ${s.ts}`))
}

main().catch(err => { console.error(err); process.exit(1) })
