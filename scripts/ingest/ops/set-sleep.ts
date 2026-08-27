// ─────────────────────────────────────────────────────────────────────────────
// Turn sleep-on-inactivity on (or off) for a service, and READ IT BACK.
//
// ⚠⚠ DO NOT RUN THIS BEFORE THE SEARCH TIMEOUTS COVER A COLD START. The budgets were 25 s
// against a measured 12–14 s restart and an unknown-but-longer wake; enabling sleep first
// would break search for whoever arrived first after each service dozed off. The raise
// shipped in 54bffb4 and was confirmed in the live build before this was run.
//
// ⚠ THE SETTING IS `sleepApplication` ON `ServiceInstance`, set through
// `serviceInstanceUpdate`. Confirmed present on this plan by querying the SCHEMA rather
// than reading documentation — `scripts/ingest/ops/audit-sleep.ts`.
//
// ⚠ AND IT IS READ BACK. A mutation that returns true is a mutation that was accepted, not
// a setting that is in force.
//
//   tsx ops/set-sleep.ts fts-serve on
//   tsx ops/set-sleep.ts vector-serve off
// ─────────────────────────────────────────────────────────────────────────────

import { rail } from './audit-sleep'
import { SERVICES, ENV_ID, instanceState } from './sleep-state'

type Name = keyof typeof SERVICES

async function setSleep(name: Name, on: boolean) {
  const serviceId = SERVICES[name]
  const before = await instanceState(serviceId)
  console.log(`${name}: sleepApplication is ${before.sleepApplication} → setting ${on}`)
  if (before.sleepApplication === on) { console.log('  (already there; nothing to do)'); return }

  await rail(`
    mutation S($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
    }
  `, { serviceId, environmentId: ENV_ID, input: { sleepApplication: on } })

  // ⚠ RE-READ. Not the mutation's own return value — the setting, fetched again.
  const after = await instanceState(serviceId)
  console.log(`  re-read: sleepApplication = ${after.sleepApplication} ${after.sleepApplication === on ? '✓' : '✗ DID NOT TAKE'}`)
  if (after.sleepApplication !== on) process.exitCode = 1
}

async function main() {
  const name = process.argv[2] as Name
  const mode = process.argv[3]
  if (!name || !(name in SERVICES) || (mode !== 'on' && mode !== 'off')) {
    console.error(`usage: set-sleep.ts <${Object.keys(SERVICES).join('|')}> on|off`)
    process.exitCode = 1
    return
  }
  await setSleep(name, mode === 'on')
}

if (require.main === module) {
  main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1 })
}
