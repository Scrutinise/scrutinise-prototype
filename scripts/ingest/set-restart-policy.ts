/**
 * set-restart-policy.ts — set Railway restart policy to ON_FAILURE / max 3 retries
 * on all 22 ingest services (20 workers + scheduler + monitor).
 * Excludes scrutinise-db (postgres service should manage its own restarts).
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const ENV_ID      = '991f733c-719c-4217-a6d6-1dbe80642bbe'

// All 22 ingest services — workers 1-20, scheduler, monitor
const SERVICES = [
  { name: 'ingest-worker-1',   id: 'a7f4d75f-d844-4e1c-8edf-2569346b31c9' },
  { name: 'ingest-worker-2',   id: '239c82f3-5695-401a-8538-e0425c503896' },
  { name: 'ingest-worker-3',   id: 'de3eda47-6988-44d0-9da3-d845b1456a86' },
  { name: 'ingest-worker-4',   id: 'c36412fe-cecc-4534-9b7c-4d0b8288a726' },
  { name: 'ingest-worker-5',   id: 'ea4516e9-d037-4eb4-8739-63333d922a46' },
  { name: 'ingest-worker-6',   id: 'd7b9ed9b-5e37-4a37-8e24-fc0054f99d54' },
  { name: 'ingest-worker-7',   id: '1e66ba24-2cb7-4ab0-85a7-a78640c53f44' },
  { name: 'ingest-worker-8',   id: 'aeb24af8-7965-470a-a0aa-89ff16a7aa2e' },
  { name: 'ingest-worker-9',   id: '45ce2312-01ce-47d2-9d82-5b34f520f802' },
  { name: 'ingest-worker-10',  id: 'eecdc235-36e3-4351-bfed-659f3947c752' },
  { name: 'ingest-worker-11',  id: '87c9c70c-c865-424b-9025-d7a0de6df30a' },
  { name: 'ingest-worker-12',  id: '546a351e-c418-49e0-8160-0c8916c3074d' },
  { name: 'ingest-worker-13',  id: 'af5fdb2c-367f-4087-a11f-9a0a99230807' },
  { name: 'ingest-worker-14',  id: '84a59dfc-ed77-4957-970e-53e50b7f0113' },
  { name: 'ingest-worker-15',  id: 'fc3e1aab-75d9-4aba-ac6c-ae0f96ca0ccb' },
  { name: 'ingest-worker-16',  id: 'e683f995-7938-4756-b645-a7b4626f0d7a' },
  { name: 'ingest-worker-17',  id: '7d92a1d0-eb24-4631-97b4-797a0fa2a9e4' },
  { name: 'ingest-worker-18',  id: '239e52f7-6a5d-41fd-a7bf-b22227ead4af' },
  { name: 'ingest-worker-19',  id: '40839fb3-b395-47b2-bbb4-9ca5d3e8142d' },
  { name: 'ingest-worker-20',  id: '01174183-68c7-4afd-88d0-9932cca3f9fa' },
  { name: 'Ingest-scheduler',  id: 'f3397bee-e588-4b95-921f-2e0f2f169cc5' },
  { name: 'ingest-monitor',    id: 'd4945e0c-207a-46ca-aceb-bdc010183cc5' },
]

async function main() {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) throw new Error('RAILWAY_API_TOKEN not set')

  let ok = 0
  let fail = 0

  for (const svc of SERVICES) {
    const res = await fetch(RAILWAY_API, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation UpdateInstance($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
            serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
          }
        `,
        variables: {
          serviceId:     svc.id,
          environmentId: ENV_ID,
          input: {
            restartPolicyType:       'ON_FAILURE',
            restartPolicyMaxRetries: 3,
          },
        },
      }),
    })
    const data = await res.json() as { data?: unknown; errors?: Array<{ message: string }> }
    if (data.errors?.length) {
      console.log(`  ✗ ${svc.name}: ${data.errors[0].message}`)
      fail++
    } else {
      console.log(`  ✓ ${svc.name}`)
      ok++
    }
  }

  console.log(`\nDone: ${ok} updated, ${fail} failed`)
}

main().catch(err => { console.error(err); process.exit(1) })
