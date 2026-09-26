export {}

// ─────────────────────────────────────────────────────────────────────────────────────────
// S24b item 1, continued — GROK_API_KEY is now set on build-worker, but
// `deploymentRedeploy` refused ("Cannot redeploy without a snapshot") because the latest
// deployment record was SKIPPED and carries no build artifact. `serviceInstanceDeployV2`
// with an EXPLICIT commit sha triggers a fresh build/deploy instead — per CLAUDE.md, never
// call it with two arguments (that redeploys the OLD pinned commit and still returns
// SUCCESS). Read meta.commitHash back afterwards; never trust the status alone.
//
//   npx tsx --env-file=.env scripts/s24b-deploy-grok-key.ts <commitSha>
// ─────────────────────────────────────────────────────────────────────────────────────────

const T = process.env.RAILWAY_API_TOKEN
const WORKER_SERVICE = 'c0d9fd39-9226-4d85-a9c5-a616341a542f' // build-worker
const ENV = '991f733c-719c-4217-a6d6-1dbe80642bbe'
const SHA = process.argv[2]

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
  if (!SHA) { console.error('usage: s24b-deploy-grok-key.ts <commitSha>'); process.exit(1) }

  console.log(`deploying build-worker @ ${SHA.slice(0, 12)} …`)
  const r = await gql(`mutation($s: String!, $e: String!, $c: String!) {
    serviceInstanceDeployV2(serviceId: $s, environmentId: $e, commitSha: $c)
  }`, { s: WORKER_SERVICE, e: ENV, c: SHA }) as { serviceInstanceDeployV2: string }
  console.log(`  mutation returned deployment id: ${r.serviceInstanceDeployV2}`)

  // Poll until it settles, then read meta.commitHash — never trust the status alone.
  for (let i = 0; i < 30; i++) {
    await new Promise((res) => setTimeout(res, 10_000))
    const d = await gql(`query($s: String!) {
      deployments(first: 1, input: { serviceId: $s }) { edges { node { id status createdAt meta } } }
    }`, { s: WORKER_SERVICE }) as { deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string; meta: any } }> } }
    const latest = d.deployments.edges[0]?.node
    const commit = String(latest?.meta?.commitHash ?? '')
    console.log(`  [${i}] ${latest?.id.slice(0, 8)} ${latest?.status} sha=${commit.slice(0, 12)}`)
    if (latest?.status === 'SUCCESS' || latest?.status === 'FAILED' || latest?.status === 'CRASHED') {
      const matches = commit.startsWith(SHA.slice(0, commit.length)) || SHA.startsWith(commit)
      console.log(`\n${latest.status === 'SUCCESS' ? '✔' : '✘'} settled: ${latest.status}, commit ${matches ? 'MATCHES requested sha' : `⚠ DOES NOT MATCH requested ${SHA.slice(0, 12)}`}`)
      process.exit(latest.status === 'SUCCESS' && matches ? 0 : 1)
    }
  }
  console.log('\n⚠ did not settle within 5 minutes — check the Railway dashboard')
}

main().catch((e) => { console.error('failed:', e instanceof Error ? e.message : e); process.exit(1) })
