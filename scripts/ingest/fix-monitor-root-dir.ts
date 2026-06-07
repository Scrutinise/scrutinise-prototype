import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const RAILWAY_API   = 'https://backboard.railway.com/graphql/v2'
const ENV_ID        = '991f733c-719c-4217-a6d6-1dbe80642bbe'
const MONITOR_SVC   = 'd4945e0c-207a-46ca-aceb-bdc010183cc5'

async function railwayGql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) throw new Error('RAILWAY_API_TOKEN not set')
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const data = await res.json() as { data?: T; errors?: Array<{ message: string }> }
  if (data.errors?.length) throw new Error(data.errors.map(e => e.message).join('; '))
  return data.data as T
}

async function main() {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) throw new Error('RAILWAY_API_TOKEN not set')

  // Verify current config first
  console.log('Current ingest-monitor config:')
  const before = await railwayGql<{ serviceInstance: { rootDirectory: string | null; startCommand: string | null } }>(`
    query($serviceId: String!, $environmentId: String!) {
      serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
        rootDirectory
        startCommand
      }
    }
  `, { serviceId: MONITOR_SVC, environmentId: ENV_ID })
  console.log('  rootDirectory:', before.serviceInstance.rootDirectory)
  console.log('  startCommand: ', before.serviceInstance.startCommand)

  // Update rootDirectory to "scripts/ingest"
  console.log('\nUpdating rootDirectory to "scripts/ingest"…')
  await railwayGql(`
    mutation UpdateInstance($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
    }
  `, {
    serviceId:     MONITOR_SVC,
    environmentId: ENV_ID,
    input: {
      rootDirectory: 'scripts/ingest',
    },
  })
  console.log('Updated.')

  // Verify
  const after = await railwayGql<{ serviceInstance: { rootDirectory: string | null; startCommand: string | null } }>(`
    query($serviceId: String!, $environmentId: String!) {
      serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
        rootDirectory
        startCommand
      }
    }
  `, { serviceId: MONITOR_SVC, environmentId: ENV_ID })
  console.log('\nVerified config:')
  console.log('  rootDirectory:', after.serviceInstance.rootDirectory)
  console.log('  startCommand: ', after.serviceInstance.startCommand)

  // Now trigger a redeploy so the new rootDirectory takes effect
  console.log('\nTriggering redeploy with new rootDirectory…')
  await railwayGql(`
    mutation($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }
  `, { serviceId: MONITOR_SVC, environmentId: ENV_ID })
  console.log('Redeploy triggered. Monitor will now build from scripts/ingest/ where pg is installed.')
}

main().catch(err => { console.error(err); process.exit(1) })
