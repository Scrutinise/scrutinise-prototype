// ─────────────────────────────────────────────────────────────────────────────
// What is actually inside scrutinise-db, before anything is dumped or deleted.
//
// ⚠ READS ONLY. Nothing here changes or removes anything.
//
//   tsx scripts/ingest/ops/legacy-db-info.ts
// ─────────────────────────────────────────────────────────────────────────────

import { rail } from './audit-sleep'
import { SERVICES, ENV_ID } from './sleep-state'

async function main() {
  // The connection details live on the service's own variables.
  const v = await rail<{ variables: Record<string, string> }>(`
    query V($projectId: String!, $environmentId: String!, $serviceId: String!) {
      variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
    }
  `, {
    projectId: '68707c61-5c68-4f37-88fc-c301fd6b90e7',
    environmentId: ENV_ID,
    serviceId: SERVICES['scrutinise-db'],
  })

  const keys = Object.keys(v.variables ?? {})
  console.log(`scrutinise-db variables (${keys.length}):`)
  for (const k of keys) {
    // ⚠ NEVER PRINT THE VALUE OF A CONNECTION STRING OR PASSWORD. The names are enough to
    // know what is here; the values go into the dump command through the environment, not
    // through a terminal this conversation can see.
    const secret = /PASSWORD|URL|URI|SECRET|KEY|TOKEN/i.test(k)
    console.log(`  ${k}${secret ? ' = <redacted>' : ` = ${v.variables[k]}`}`)
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1 })
}
