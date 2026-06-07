import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'

async function main() {
  const token     = process.env.RAILWAY_API_TOKEN
  const projectId = process.env.RAILWAY_PROJECT_ID
  if (!token || !projectId) throw new Error('RAILWAY_API_TOKEN or RAILWAY_PROJECT_ID not set')

  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query GetStatus($projectId: String!) {
        project(id: $projectId) {
          services { edges { node { id name
            deployments(last: 1) { edges { node { id status createdAt } } }
          } } }
        }
      }`,
      variables: { projectId },
    }),
  })
  const data = await res.json() as {
    data?: { project?: { services?: { edges?: Array<{ node: { id: string; name: string; deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string } }> } } }> } } }
    errors?: Array<{ message: string }>
  }

  if (data.errors?.length) { console.error('API errors:', data.errors); return }

  const svcs = (data.data?.project?.services?.edges ?? [])
    .map(e => ({
      name:      e.node.name,
      status:    e.node.deployments.edges[0]?.node.status ?? 'NONE',
      createdAt: e.node.deployments.edges[0]?.node.createdAt?.slice(0, 19) ?? '',
    }))
    .filter(s => s.name !== 'scrutinise-db')
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  const counts: Record<string, number> = {}
  svcs.forEach(s => counts[s.status] = (counts[s.status] ?? 0) + 1)
  console.log('Counts:', JSON.stringify(counts))
  svcs.forEach(s => console.log(`  ${s.name.padEnd(30)} ${s.status.padEnd(12)} ${s.createdAt}`))
}

main().catch(err => { console.error(err); process.exit(1) })
