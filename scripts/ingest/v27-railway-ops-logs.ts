/**
 * v27-railway-ops-logs.ts — V27 §1 diagnosis. Lists services + last deployments
 * for the project and pulls the Ops service's recent deploy logs, so we can see
 * what the live 15-min loop is actually doing.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'

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

async function main() {
  const projectId = process.env.RAILWAY_PROJECT_ID!

  const proj = await gql<{ project: { services: { edges: Array<{ node: {
    id: string; name: string;
    deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string } }> }
  } }> } } }>(
    `query($projectId: String!) {
      project(id: $projectId) {
        services { edges { node {
          id name
          deployments(last: 3) { edges { node { id status createdAt } } }
        } } }
      }
    }`, { projectId })

  let opsDepId: string | null = null
  console.log('=== Services + recent deployments ===')
  for (const { node } of proj.project.services.edges) {
    const deps = [...node.deployments.edges].sort((a, b) => b.node.createdAt.localeCompare(a.node.createdAt))
    console.log(`\n${node.name} (${node.id.slice(0, 8)})`)
    for (const d of deps) console.log(`   ${d.node.id.slice(0, 8)}  ${d.node.status.padEnd(10)} ${d.node.createdAt}`)
    if (/^ops$/i.test(node.name)) opsDepId = deps[0]?.node.id ?? null
  }

  if (!opsDepId) { console.log('\nNo service named "Ops" found.'); return }

  console.log(`\n=== Ops latest deployment ${opsDepId.slice(0, 8)} — recent logs ===`)
  const logs = await gql<{ deploymentLogs: Array<{ timestamp: string; message: string }> }>(
    `query($depId: String!) { deploymentLogs(deploymentId: $depId, limit: 250) { timestamp message } }`,
    { depId: opsDepId })
  for (const l of logs.deploymentLogs) console.log(`${l.timestamp.slice(0, 19)}  ${l.message}`)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
