export {}

// ─────────────────────────────────────────────────────────────────────────────
// S20a close-out — build-worker's capability flags vs /api/health.
//
// Reads LEX_QUERY_EXPANSION, LEX_SEARCH_RERANKER, LEX_SEARCH_JUDGED_MERGE, LEX_TIER_FUSION,
// LEX_STATS_STREAM on the `build-worker` service. Any ABSENT flag is set to match what
// /api/health currently resolves to on Vercel — per the B17 convention: set as a NEW
// variable (never overwrite one that already exists), and record which ones were absent
// before the write, so a revert is "delete the variable", never "guess the old value".
//
// Same service/environment ids as scripts/b21-railway-watch.ts (same build-worker), same
// `Project-Access-Token` header (v33-restart-serve.ts's finding: `RAILWAY_API_TOKEN` is a
// PROJECT token — `Authorization: Bearer` gets "Not Authorized").
//
//   npx tsx --env-file=.env scripts/s20a-worker-flags.ts            (read only)
//   npx tsx --env-file=.env scripts/s20a-worker-flags.ts --set      (set absent flags)
//   npx tsx --env-file=.env scripts/s20a-worker-flags.ts --redeploy (also restart the worker)
// ─────────────────────────────────────────────────────────────────────────────

const T = process.env.RAILWAY_API_TOKEN!
const ENV = '991f733c-719c-4217-a6d6-1dbe80642bbe'
const WORKER = 'c0d9fd39-9226-4d85-a9c5-a616341a542f'
const SET = process.argv.includes('--set')
const REDEPLOY = process.argv.includes('--redeploy')

const FLAGS = [
  'LEX_QUERY_EXPANSION', 'LEX_SEARCH_RERANKER', 'LEX_SEARCH_JUDGED_MERGE',
  'LEX_TIER_FUSION', 'LEX_STATS_STREAM',
] as const

async function gql<T = Record<string, unknown>>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': T },
    body: JSON.stringify({ query, variables }),
  })
  const b = await res.json() as { data?: T; errors?: Array<{ message: string }> }
  if (b.errors?.length) throw new Error(b.errors.map((e) => e.message).join('; '))
  return b.data as T
}

async function main() {
  if (!T) { console.log('no RAILWAY_API_TOKEN'); process.exit(1) }

  const { projectToken } = await gql<{ projectToken: { projectId: string } }>('query { projectToken { projectId } }')
  const projectId = projectToken.projectId

  const health = await fetch('https://www.scrutinise.org/api/health').then((r) => r.json()) as {
    commit: string; capabilities: Record<string, boolean>
  }
  console.log(`/api/health (Vercel, commit ${health.commit.slice(0, 8)}):`)
  for (const f of FLAGS) console.log(`  ${f} = ${health.capabilities[f]}`)

  const { variables } = await gql<{ variables: Record<string, string> }>(
    `query($p: String!, $e: String!, $s: String!) { variables(projectId: $p, environmentId: $e, serviceId: $s) }`,
    { p: projectId, e: ENV, s: WORKER },
  )

  console.log('\nbuild-worker, before:')
  const absent: string[] = []
  for (const f of FLAGS) {
    const present = Object.prototype.hasOwnProperty.call(variables, f)
    console.log(`  ${f} = ${present ? JSON.stringify(variables[f]) : 'ABSENT'}`)
    if (!present) absent.push(f)
  }

  if (!absent.length) {
    console.log('\nAll five present on build-worker already — nothing to set.')
  } else if (!SET) {
    console.log(`\n${absent.length} absent: ${absent.join(', ')}`)
    console.log('Would set each to match /api/health. Re-run with --set.')
  } else {
    console.log(`\nSetting ${absent.length} absent flag(s) to match /api/health (recording prior state: ABSENT):`)
    for (const f of absent) {
      const value = String(health.capabilities[f])
      await gql(`mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }`, {
        input: { projectId, environmentId: ENV, serviceId: WORKER, name: f, value },
      })
      console.log(`  ${f}: ABSENT → ${value}`)
    }

    const after = await gql<{ variables: Record<string, string> }>(
      `query($p: String!, $e: String!, $s: String!) { variables(projectId: $p, environmentId: $e, serviceId: $s) }`,
      { p: projectId, e: ENV, s: WORKER },
    )
    console.log('\nbuild-worker, after (read back, not assumed):')
    for (const f of FLAGS) console.log(`  ${f} = ${after.variables[f] ?? 'ABSENT'}`)
  }

  if (REDEPLOY) {
    const { serviceInstance } = await gql<{ serviceInstance: { latestDeployment: { id: string; meta: unknown } } }>(
      `query($s: String!, $e: String!) { serviceInstance(serviceId: $s, environmentId: $e) { latestDeployment { id meta } } }`,
      { s: WORKER, e: ENV },
    )
    const depId = serviceInstance.latestDeployment.id
    console.log(`\ndeploymentRedeploy(${depId}) — same artefact, new variables …`)
    await gql(`mutation($id: String!) { deploymentRedeploy(id: $id) { id status } }`, { id: depId })
    console.log('Redeploy requested. Wait ~30-60s, then check the worker boot log for the new capability line.')
  }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
