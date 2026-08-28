// ─────────────────────────────────────────────────────────────────────────────
// Redeploy the search services so the RUNNING deployment picks up sleepApplication.
//
// ⚠ THE FINDING THIS TESTS: `sleepApplication` was set to true and read back as true on
// both services, and after **30 minutes of complete silence** both still answered in about
// a second. That is not a measurement artefact — the earlier 15-minute attempt was spoiled
// by my own probing, but this one was not touched.
//
// The likeliest cause is that the setting lives on the SERVICE INSTANCE and is applied when
// a deployment is created. The deployments now running were created before the flag was
// flipped, so they are running under the old configuration. Setting a flag and reading it
// back proves the flag; it does not prove the running container knows about it.
//
//   tsx ops/redeploy-for-sleep.ts
// ─────────────────────────────────────────────────────────────────────────────

import { rail } from './audit-sleep'
import { SERVICES, ENV_ID } from './sleep-state'

async function main() {
  for (const name of ['fts-serve', 'vector-serve'] as const) {
    const d = await rail<{ serviceInstance: { latestDeployment: { id: string; createdAt: string } | null } }>(`
      query I($serviceId: String!, $environmentId: String!) {
        serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
          latestDeployment { id createdAt }
        }
      }`, { serviceId: SERVICES[name], environmentId: ENV_ID })
    const dep = d.serviceInstance.latestDeployment
    if (!dep) { console.log(`${name}: no deployment`); continue }
    console.log(`${name}: current deployment ${dep.id.slice(0, 8)} created ${dep.createdAt}`)

    // ⚠ `deploymentRedeploy`, NOT `serviceInstanceRedeploy` — the latter rebuilds from
    // source, which is a different and much slower operation and would rebuild an index
    // service for no reason. This re-creates the deployment from the same build.
    await rail(`mutation R($id: String!) { deploymentRedeploy(id: $id) { id status } }`, { id: dep.id })
    console.log(`  redeployed`)
  }
  console.log('\nGive them a few minutes to come up, then re-run measure-both-wakes.ts.')
}

if (require.main === module) {
  main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1 })
}
