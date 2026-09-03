export {}

// ─────────────────────────────────────────────────────────────────────────────
// 25-W §A/§F — read back the build-worker's variables and its log around a build.
//
// ⚠ NAMES AND PRESENCE ONLY for secrets. A value is printed only for the two
// non-secret settings this sprint is about (LEX_VECTOR_STREAMS, LEX_BUILD_DRIVER).
// ─────────────────────────────────────────────────────────────────────────────

const T = process.env.RAILWAY_API_TOKEN!
const SERVICE = 'c0d9fd39-9226-4d85-a9c5-a616341a542f' // build-worker
const SHOW = new Set(['LEX_VECTOR_STREAMS', 'LEX_BUILD_DRIVER', 'LEX_BUILD_WORKER_CONCURRENCY',
  'FTS_SEARCH_URL', 'VECTOR_SEARCH_URL', 'NEXT_PUBLIC_APP_URL'])

async function gql(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': T },
    body: JSON.stringify({ query, variables }),
  })
  const b = await res.json() as { data?: Record<string, unknown>; errors?: Array<{ message: string }> }
  if (b.errors?.length) throw new Error(b.errors.map((e) => e.message).join('; '))
  return b.data ?? {}
}

async function main() {
  if (!T) { console.log('no RAILWAY_API_TOKEN'); process.exit(1) }
  const { projectToken } = await gql('query { projectToken { projectId environmentId } }') as
    { projectToken: { projectId: string; environmentId: string } }

  const v = await gql(`query($p: String!, $e: String!, $s: String!) {
    variables(projectId: $p, environmentId: $e, serviceId: $s)
  }`, { p: projectToken.projectId, e: projectToken.environmentId, s: SERVICE }) as
    { variables: Record<string, string> }

  const names = Object.keys(v.variables).sort()
  console.log(`\n── build-worker variables (${names.length}) ──`)
  for (const n of names) {
    console.log(`  ${n.padEnd(32)} ${SHOW.has(n) ? `= ${v.variables[n]}` : '(set, value not printed)'}`)
  }

  console.log('\n── the ones §A and §F turn on ──')
  for (const k of ['RESEND_API_KEY', 'NEXT_PUBLIC_APP_URL', 'LEX_VECTOR_STREAMS', 'LEX_BUILD_DRIVER']) {
    const present = k in v.variables
    console.log(`  ${k.padEnd(22)} ${present ? `PRESENT${SHOW.has(k) ? ` = ${v.variables[k]}` : ''}` : 'ABSENT'}`)
  }

  // ── the log around the 10:15–10:22 UTC build ────────────────────────────────
  const d = await gql(`query($s: String!) {
    deployments(first: 3, input: { serviceId: $s }) { edges { node { id status createdAt } } }
  }`, { s: SERVICE }) as { deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string } }> } }
  const latest = d.deployments.edges[0]?.node
  console.log(`\n── latest deployment ${latest?.id.slice(0, 8)} ${latest?.status} ${latest?.createdAt} ──`)
  if (!latest) return

  const logs = await gql(`query($id: String!, $limit: Int!) {
    deploymentLogs(deploymentId: $id, limit: $limit) { timestamp message }
  }`, { id: latest.id, limit: 2000 }) as { deploymentLogs: Array<{ timestamp: string; message: string }> }
  const lines = logs.deploymentLogs ?? []
  console.log(`  ${lines.length} lines`)

  const interesting = lines.filter((l) =>
    /6547478c|build-complete email|RESEND_API_KEY|Email suppressed|running build|settled|DONE ·|streams|vector/i.test(l.message))
  console.log(`\n── lines mentioning the build, the email or retrieval (${interesting.length}) ──`)
  for (const l of interesting) console.log(`  ${l.timestamp.slice(0, 19)} ${l.message.slice(0, 300)}`)

  const all = lines.map((l) => l.message).join('\n')
  console.log('\n── §A: was a send attempted? ──')
  console.log(`  "[lex-diag] 25b build-complete email sent"   : ${/build-complete email sent/.test(all) ? 'PRESENT' : 'ABSENT'}`)
  console.log(`  "build-complete email FAILED"                : ${/build-complete email FAILED/.test(all) ? 'PRESENT' : 'ABSENT'}`)
  console.log(`  "RESEND_API_KEY not set — email not sent"    : ${/RESEND_API_KEY not set/.test(all) ? 'PRESENT' : 'ABSENT'}`)
  console.log(`  "Email suppressed"                           : ${/Email suppressed/.test(all) ? 'PRESENT' : 'ABSENT'}`)
  console.log(`  "25b build settled"                          : ${/25b build settled/.test(all) ? 'PRESENT' : 'ABSENT'}`)
}

main().catch((e) => { console.error('failed:', e instanceof Error ? e.message : e); process.exit(1) })
