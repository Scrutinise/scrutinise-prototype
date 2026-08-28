// ─────────────────────────────────────────────────────────────────────────────
// WHY IS IT STILL AWAKE? — the settings that defeat app sleeping.
//
// `sleepApplication` is true on both search services and neither dozed after 15 minutes of
// total silence. Something is either sending them traffic or preventing sleep outright. The
// usual culprit is a configured HEALTHCHECK: Railway pings it, which is inbound traffic, so
// the service can never be idle. A cron schedule or a TCP proxy does the same.
//
// Reads only.
//
//   tsx ops/why-awake.ts
// ─────────────────────────────────────────────────────────────────────────────

import { rail } from './audit-sleep'
import { SERVICES, ENV_ID } from './sleep-state'

async function main() {
  for (const name of ['fts-serve', 'vector-serve'] as const) {
    const d = await rail<{
      serviceInstance: {
        sleepApplication: boolean | null
        healthcheckPath: string | null
        healthcheckTimeout: number | null
        cronSchedule: string | null
        numReplicas: number | null
        restartPolicyType: string | null
        domains: { serviceDomains: Array<{ domain: string }> } | null
      }
    }>(`
      query I($serviceId: String!, $environmentId: String!) {
        serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
          sleepApplication
          healthcheckPath
          healthcheckTimeout
          cronSchedule
          numReplicas
          restartPolicyType
          domains { serviceDomains { domain } }
        }
      }
    `, { serviceId: SERVICES[name], environmentId: ENV_ID })
    const i = d.serviceInstance
    console.log(`\n${name}`)
    console.log(`  sleepApplication  ${i.sleepApplication}`)
    console.log(`  healthcheckPath   ${i.healthcheckPath ?? '(none)'}${i.healthcheckPath ? '   ⚠ RAILWAY PINGS THIS — the service can never be idle' : ''}`)
    console.log(`  healthcheckTimeout ${i.healthcheckTimeout ?? '-'}`)
    console.log(`  cronSchedule      ${i.cronSchedule ?? '(none)'}`)
    console.log(`  numReplicas       ${i.numReplicas}`)
    console.log(`  restartPolicy     ${i.restartPolicyType ?? '-'}`)
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1 })
}
