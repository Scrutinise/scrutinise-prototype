export {}

// ─────────────────────────────────────────────────────────────────────────────────────────
// 25-W §A — GIVE THE BUILD WORKER WHAT IT NEEDS TO SEND THE EMAIL IT ALREADY TRIES TO SEND.
//
// The diagnosis: the preference WAS stored (`notifyEmail = true` on build 6547478c, 2 Sep
// 10:15 UTC), the worker DID reach the notification path, and `sendEmail` declined for want
// of `RESEND_API_KEY` — a variable the service was never created with. It logged a warning
// and returned the same nothing it returns on success, so the next line said "email sent".
//
// ⚠⚠ NO SECRET PASSES THROUGH THIS SCRIPT. `RESEND_API_KEY` is set as a RAILWAY VARIABLE
// REFERENCE — `${{Ingest.RESEND_API_KEY}}` — resolved inside Railway at deploy time. The
// value is never read, printed or transmitted here, exactly as `deploy-build-worker.ts` does
// it for every other credential.
//
// Usage:
//   npx tsx --env-file=.env scripts/set-worker-email-vars.ts            (report only)
//   npx tsx --env-file=.env scripts/set-worker-email-vars.ts --write
// ─────────────────────────────────────────────────────────────────────────────────────────

const T = process.env.RAILWAY_API_TOKEN
const WRITE = process.argv.includes('--write')
const WORKER_SERVICE = 'c0d9fd39-9226-4d85-a9c5-a616341a542f' // build-worker

const WANTED: Record<string, string> = {
  RESEND_API_KEY: '${{Ingest.RESEND_API_KEY}}',
  // Without this the completion email's "Read it" button falls back to the bare apex domain
  // instead of the canonical host every other link in the product uses.
  NEXT_PUBLIC_APP_URL: 'https://www.scrutinise.org',
}

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
  console.log('\n── build-worker, before (presence only) ──')
  for (const k of Object.keys(WANTED)) console.log(`  ${k.padEnd(22)} ${before.has(k) ? 'PRESENT' : 'ABSENT'}`)

  const missing = Object.keys(WANTED).filter((k) => !before.has(k))
  if (!missing.length) { console.log('\n  Nothing to set.'); return }
  if (!WRITE) { console.log(`\n  ${missing.length} to set — pass --write.`); return }

  for (const k of missing) {
    await gql('mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }', {
      input: { projectId, environmentId, serviceId: WORKER_SERVICE, name: k, value: WANTED[k] },
    })
    console.log(`  set ${k}`)
  }

  // ⚠ RE-READ. A write reported from the intention rather than from the row is how three
  // "deleted" ideas turned out to still be there five days later.
  const after = await names()
  console.log('\n── build-worker, after (re-read) ──')
  for (const k of Object.keys(WANTED)) console.log(`  ${k.padEnd(22)} ${after.has(k) ? 'PRESENT' : '⚠ STILL ABSENT'}`)

  // ══ ⚠⚠ A VARIABLE THE RUNNING PROCESS HAS NOT READ IS NOT A FIX ══════════════════════
  //
  // `process.env` is captured at start-up. Until the service is redeployed the worker in
  // memory still has no key, and a build finishing in the meantime still sends nothing and
  // still says it did — so "I set the variable" is exactly the shape of claim this sprint
  // exists to stop making.
  //
  // ⚠ `deploymentRedeploy`, NOT `serviceInstanceRedeploy` (CLAUDE.md: the second rebuilds
  // from source). One service, not a fleet, so the staggered-restart rule does not apply.
  const d = await gql(`query($s: String!) {
    deployments(first: 1, input: { serviceId: $s }) { edges { node { id status createdAt } } }
  }`, { s: WORKER_SERVICE }) as { deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string } }> } }
  const latest = d.deployments.edges[0]?.node
  if (!latest) { console.log('\n⚠ no deployment to redeploy — do it from the Railway dashboard.'); return }

  console.log(`\n── redeploying ${latest.id.slice(0, 8)} (${latest.status}, ${latest.createdAt.slice(0, 19)}) ──`)
  await gql('mutation($id: String!) { deploymentRedeploy(id: $id) { id status } }', { id: latest.id })

  const now = await gql(`query($s: String!) {
    deployments(first: 1, input: { serviceId: $s }) { edges { node { id status createdAt } } }
  }`, { s: WORKER_SERVICE }) as { deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string } }> } }
  const fresh = now.deployments.edges[0]?.node
  console.log(`  now: ${fresh?.id.slice(0, 8)} ${fresh?.status} ${fresh?.createdAt.slice(0, 19)}`)
  console.log('\n⚠ THE SEND IS STILL UNPROVEN. Watch the worker log for the start-up line that says\n' +
    '  "email is configured", then finish one build with the box ticked and read back the\n' +
    '  provider id in "[lex-diag] 25b build-complete email sent". An absence of errors is not\n' +
    '  evidence of a send — that id is.')
}

main().catch((e) => { console.error('failed:', e instanceof Error ? e.message : e); process.exit(1) })
