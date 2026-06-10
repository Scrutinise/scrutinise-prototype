/**
 * stop-old-deployments.ts — V17: stop the pre-V17 deployments still running on
 * the `Ingest` and `Ops` service shells, so old fleet-era code (old scheduler's
 * Railway-DB Prisma pool; old worker's idle polling) stops running and billing
 * while the consolidated replacements are built.
 *
 * Usage: tsx stop-old-deployments.ts [--execute]
 * Without --execute it only prints current deployment status.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'

const SERVICES = [
  { name: 'Ingest', id: 'a7f4d75f-d844-4e1c-8edf-2569346b31c9' },
  { name: 'Ops',    id: 'f3397bee-e588-4b95-921f-2e0f2f169cc5' },
]

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

async function lastDeployment(serviceId: string) {
  const d = await gql<{ deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string } }> } }>(
    `query($serviceId: String!) {
      deployments(first: 1, input: { serviceId: $serviceId }) {
        edges { node { id status createdAt } }
      }
    }`,
    { serviceId },
  )
  return d.deployments.edges[0]?.node ?? null
}

async function main() {
  const execute = process.argv.includes('--execute')
  for (const svc of SERVICES) {
    const dep = await lastDeployment(svc.id)
    if (!dep) { console.log(`${svc.name}: no deployments`); continue }
    console.log(`${svc.name}: deployment ${dep.id} status=${dep.status} created=${dep.createdAt}`)
    if (!execute) continue
    if (['SUCCESS', 'DEPLOYING', 'BUILDING', 'INITIALIZING', 'WAITING', 'SLEEPING'].includes(dep.status)) {
      await gql(`mutation($id: String!) { deploymentStop(id: $id) }`, { id: dep.id })
      const after = await lastDeployment(svc.id)
      console.log(`  → deploymentStop sent. Now: ${after?.status}`)
    } else {
      console.log(`  → not running (${dep.status}) — nothing to stop`)
    }
  }
}
main().catch(e => { console.error(e); process.exit(1) })
