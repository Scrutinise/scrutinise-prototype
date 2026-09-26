export {}

// ─────────────────────────────────────────────────────────────────────────────────────────
// S24b item 1 — set GROK_API_KEY on build-worker.
//
// ⚠ Unlike set-worker-email-vars.ts, this CANNOT use a Railway variable reference
// (`${{Service.VAR}}`) — a project-wide sweep of all 9 services (fts-build, cost-alert-cron,
// scrutinise-db, Ingest, vector-serve, build-worker, fts-serve, Ops, fts-pilot) found
// GROK_API_KEY absent from every one of them. There is nothing to reference, so the value
// read from the local .env is sent once via variableUpsert and never printed or logged here.
//
// Usage:
//   npx tsx --env-file=.env scripts/s24b-set-grok-key.ts            (report only)
//   npx tsx --env-file=.env scripts/s24b-set-grok-key.ts --write
// ─────────────────────────────────────────────────────────────────────────────────────────

const T = process.env.RAILWAY_API_TOKEN
const KEY = process.env.GROK_API_KEY
const WRITE = process.argv.includes('--write')
const WORKER_SERVICE = 'c0d9fd39-9226-4d85-a9c5-a616341a542f' // build-worker

async function gql(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': T! },
    body: JSON.stringify({ query, variables }),
  })
  const b = await res.json() as { data?: Record<string, unknown>; errors?: Array<{ message: string }> }
  if (b.errors?.length) throw new Error(b.errors.map((e) => e.message).join('; '))
  return b.data ?? {}
}

async function main() {
  if (!T) { console.error('no RAILWAY_API_TOKEN'); process.exit(1) }
  if (!KEY) { console.error('no GROK_API_KEY in local .env — nothing to set'); process.exit(1) }

  const { projectToken } = await gql('query { projectToken { projectId environmentId } }') as
    { projectToken: { projectId: string; environmentId: string } }
  const { projectId, environmentId } = projectToken

  const names = async (): Promise<Set<string>> => {
    const v = await gql(`query($p: String!, $e: String!, $s: String!) {
      variables(projectId: $p, environmentId: $e, serviceId: $s)
    }`, { p: projectId, e: environmentId, s: WORKER_SERVICE }) as { variables: Record<string, string> }
    return new Set(Object.keys(v.variables))
  }

  const before = await names()
  console.log(`\nbuild-worker: GROK_API_KEY ${before.has('GROK_API_KEY') ? 'already PRESENT' : 'ABSENT'}`)
  if (before.has('GROK_API_KEY')) { console.log('Nothing to set.'); return }
  if (!WRITE) { console.log('Pass --write to set it.'); return }

  await gql('mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }', {
    input: { projectId, environmentId, serviceId: WORKER_SERVICE, name: 'GROK_API_KEY', value: KEY },
  })
  console.log('  set GROK_API_KEY (value not printed)')

  // ⚠ RE-READ. A write reported from the intention rather than from the row is not proof.
  const after = await names()
  console.log(`\nbuild-worker, after: GROK_API_KEY ${after.has('GROK_API_KEY') ? 'PRESENT' : '⚠ STILL ABSENT'}`)

  // ── redeploy, so the running process actually picks it up ──
  // §18/§20 family: a variable the running process has not read is not a fix.
  const d = await gql(`query($s: String!) {
    deployments(first: 1, input: { serviceId: $s }) { edges { node { id status createdAt } } }
  }`, { s: WORKER_SERVICE }) as { deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string } }> } }
  const latest = d.deployments.edges[0]?.node
  if (!latest) { console.log('\n⚠ no deployment to redeploy — do it from the Railway dashboard.'); return }

  console.log(`\nredeploying ${latest.id.slice(0, 8)} (${latest.status}, ${latest.createdAt.slice(0, 19)})`)
  await gql('mutation($id: String!) { deploymentRedeploy(id: $id) { id status } }', { id: latest.id })

  const now = await gql(`query($s: String!) {
    deployments(first: 1, input: { serviceId: $s }) { edges { node { id status createdAt meta } } }
  }`, { s: WORKER_SERVICE }) as { deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string; meta: any } }> } }
  const fresh = now.deployments.edges[0]?.node
  console.log(`  now: ${fresh?.id.slice(0, 8)} ${fresh?.status} sha=${String(fresh?.meta?.commitHash ?? '').slice(0, 12)}`)
  console.log('\n⚠ Read meta.commitHash back once it settles, per CLAUDE.md — a fresh id/SUCCESS status is not proof of the right commit.')
}

main().catch((e) => { console.error('failed:', e instanceof Error ? e.message : e); process.exit(1) })
