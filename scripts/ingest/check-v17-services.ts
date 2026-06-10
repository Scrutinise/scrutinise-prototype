/**
 * check-v17-services.ts — service IDs, config and variable NAMES (not values)
 * for the post-fleet `Ingest` and `Ops` services.
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
  const envId = process.env.ENV_ID ?? '991f733c-719c-4217-a6d6-1dbe80642bbe'

  const proj = await gql<{ project: { services: { edges: Array<{ node: { id: string; name: string } }> } } }>(
    `query($projectId: String!) { project(id: $projectId) { services { edges { node { id name } } } } }`,
    { projectId },
  )

  for (const { node } of proj.project.services.edges) {
    console.log(`\n=== ${node.name}  (${node.id})`)
    if (node.name === 'scrutinise-db') continue
    try {
      const cfg = await gql<{ serviceInstance: { rootDirectory: string | null; startCommand: string | null; buildCommand: string | null; restartPolicyType: string | null; restartPolicyMaxRetries: number | null } }>(
        `query($serviceId: String!, $environmentId: String!) {
          serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
            rootDirectory startCommand buildCommand restartPolicyType restartPolicyMaxRetries
          }
        }`,
        { serviceId: node.id, environmentId: envId },
      )
      console.log(`  rootDirectory:  ${cfg.serviceInstance.rootDirectory}`)
      console.log(`  startCommand:   ${cfg.serviceInstance.startCommand}`)
      console.log(`  restartPolicy:  ${cfg.serviceInstance.restartPolicyType} / ${cfg.serviceInstance.restartPolicyMaxRetries}`)
    } catch (e) { console.log(`  config query failed: ${e}`) }
    try {
      const vars = await gql<{ variables: Record<string, string> }>(
        `query($projectId: String!, $environmentId: String!, $serviceId: String!) {
          variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
        }`,
        { projectId, environmentId: envId, serviceId: node.id },
      )
      console.log(`  variables: ${Object.keys(vars.variables).sort().join(', ')}`)
    } catch (e) { console.log(`  variables query failed: ${e}`) }
  }
}
main().catch(err => { console.error(err); process.exit(1) })
