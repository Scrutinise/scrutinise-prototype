// ─────────────────────────────────────────────────────────────────────────────
// The current sleep/replica state of every service, and its public URL.
// Reads only.
//
//   tsx scripts/ingest/ops/sleep-state.ts
// ─────────────────────────────────────────────────────────────────────────────

import { rail } from './audit-sleep'

export const ENV_ID = '991f733c-719c-4217-a6d6-1dbe80642bbe'
export const PROJECT_ID = '68707c61-5c68-4f37-88fc-c301fd6b90e7'

export const SERVICES = {
  'fts-serve': 'c268ec09-e489-4cfa-837a-7740d95c24c7',
  'vector-serve': 'ae95be0a-3140-409a-8b9a-fd9c81229da4',
  'fts-build': '0ef0f6a5-5805-4c92-af69-9ee4d0486356',
  'fts-pilot': 'fdd32248-1bd5-4264-8ab0-54de78545151',
  'scrutinise-db': '2f0ef638-332c-4ed6-b8da-13384d90b87f',
  Ingest: 'a7f4d75f-d844-4e1c-8edf-2569346b31c9',
  Ops: 'f3397bee-e588-4b95-921f-2e0f2f169cc5',
} as const

export interface InstanceState {
  sleepApplication: boolean | null
  numReplicas: number | null
  region: string | null
  domains: string[]
  latestDeploymentStatus?: string | null
}

export async function instanceState(serviceId: string): Promise<InstanceState> {
  const d = await rail<{
    serviceInstance: {
      sleepApplication: boolean | null
      numReplicas: number | null
      region: string | null
      domains: {
        serviceDomains: Array<{ domain: string }>
        customDomains: Array<{ domain: string }>
      } | null
      latestDeployment: { status: string } | null
    }
  }>(`
    query I($serviceId: String!, $environmentId: String!) {
      serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
        sleepApplication
        numReplicas
        region
        domains { serviceDomains { domain } customDomains { domain } }
        latestDeployment { status }
      }
    }
  `, { serviceId, environmentId: ENV_ID })
  const i = d.serviceInstance
  return {
    sleepApplication: i.sleepApplication,
    numReplicas: i.numReplicas,
    region: i.region,
    domains: [
      ...(i.domains?.serviceDomains ?? []).map((x) => x.domain),
      ...(i.domains?.customDomains ?? []).map((x) => x.domain),
    ],
    latestDeploymentStatus: i.latestDeployment?.status ?? null,
  }
}

async function main() {
  console.log('service          sleep  replicas  region        status      domain')
  for (const [name, id] of Object.entries(SERVICES)) {
    try {
      const s = await instanceState(id)
      console.log(
        `${name.padEnd(15)} ${String(s.sleepApplication).padEnd(6)} ${String(s.numReplicas ?? '-').padEnd(9)} ` +
        `${(s.region ?? '-').padEnd(13)} ${(s.latestDeploymentStatus ?? '-').padEnd(11)} ${s.domains[0] ?? '-'}`,
      )
    } catch (e) {
      console.log(`${name.padEnd(15)} ERROR ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1 })
}
