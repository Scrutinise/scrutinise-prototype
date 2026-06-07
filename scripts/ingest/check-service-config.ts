import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const ENV_ID      = '991f733c-719c-4217-a6d6-1dbe80642bbe'

// Services to inspect — monitor + two workers for comparison
const INSPECT = [
  'd4945e0c-207a-46ca-aceb-bdc010183cc5',  // ingest-monitor
  'a7f4d75f-d844-4e1c-8edf-2569346b31c9',  // ingest-worker-1
  '87c9c70c-c865-424b-9025-d7a0de6df30a',  // ingest-worker-11
]

async function main() {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) throw new Error('RAILWAY_API_TOKEN not set')

  // Query serviceInstance for each service — gives rootDirectory, startCommand, buildCommand
  const query = `
    query GetInstance($serviceId: String!, $environmentId: String!) {
      serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
        serviceId
        startCommand
        buildCommand
        rootDirectory
        nixpacksPlan
      }
    }
  `

  for (const serviceId of INSPECT) {
    const res = await fetch(RAILWAY_API, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: { serviceId, environmentId: ENV_ID } }),
    })
    const data = await res.json() as {
      data?: {
        serviceInstance?: {
          serviceId: string
          startCommand: string | null
          buildCommand: string | null
          rootDirectory: string | null
          nixpacksPlan: unknown
        }
      }
      errors?: Array<{ message: string }>
    }

    if (data.errors?.length) {
      console.error(`serviceId ${serviceId} — API errors:`, data.errors)
      continue
    }

    const si = data.data?.serviceInstance
    if (!si) { console.log(`serviceId ${serviceId} — no serviceInstance returned`); continue }

    console.log(`\n── serviceId: ${si.serviceId}`)
    console.log(`   rootDirectory: ${JSON.stringify(si.rootDirectory)}`)
    console.log(`   startCommand:  ${JSON.stringify(si.startCommand)}`)
    console.log(`   buildCommand:  ${JSON.stringify(si.buildCommand)}`)
    if (si.nixpacksPlan) console.log(`   nixpacksPlan:  ${JSON.stringify(si.nixpacksPlan).slice(0, 200)}`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
