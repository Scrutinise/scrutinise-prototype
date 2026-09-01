// ─────────────────────────────────────────────────────────────────────────────
// 25-T §1a — DEPLOY THE SERVICE THAT RUNS `build:worker`.
//
// The build has been running as Vercel functions driven by the user's browser tab polling every
// three seconds. A tester who switches tabs stalls their own build, and SMART has run 285.5 s
// against Vercel's hard 300 s per-invocation limit. This is the service that ends both.
//
// ⚠⚠ IT IS IDEMPOTENT AND IT REFUSES TO MAKE A SECOND ONE. A duplicate worker is two builds in
// flight against a search layer sized for one (`WORKER_CONCURRENCY`'s note), and it bills twice.
//
// ⚠⚠ NO SECRET PASSES THROUGH THIS SCRIPT. Every credential is set as a RAILWAY VARIABLE
// REFERENCE — `${{Ingest.GEMINI_API_KEY}}` — so the value is resolved inside Railway and is never
// read, printed or transmitted here. The only literals set are a hostname, a mode and a number.
//
// ⚠⚠ AND THE DATABASE REFERENCE IS THE ONE TRAP THIS SPRINT NEARLY WALKED INTO.
// `Ingest.DATABASE_URL` points at **switchback.proxy.rlwy.net** — Railway's Postgres, which
// CLAUDE.md §16 declares dead for application data after the June cutover. The app database is
// `Ingest.NEON_DATABASE_URL` (ep-old-dust-aboxi69a). A worker wired to the first would poll an
// empty queue for ever and look **exactly** like a healthy idle worker: §1a's "an absence of
// errors is not evidence", in its purest form.
//
// Usage:
//   npx tsx --env-file=.env scripts/deploy-build-worker.ts            (plan — creates nothing)
//   npx tsx --env-file=.env scripts/deploy-build-worker.ts --create
// ─────────────────────────────────────────────────────────────────────────────

const T = process.env.RAILWAY_API_TOKEN
const CREATE = process.argv.includes('--create')
const SERVICE_NAME = 'build-worker'
const INGEST = 'a7f4d75f-d844-4e1c-8edf-2569346b31c9'

async function gql(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': T! },
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json() as { data?: Record<string, unknown>; errors?: Array<{ message: string }> }
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '))
  return body.data ?? {}
}

/**
 * ⚠ REFERENCES, NOT VALUES. Railway resolves `${{Service.VAR}}` at deploy time inside the
 * project. See the header — this is what keeps the secrets out of this process entirely.
 */
const VARIABLES: Record<string, string> = {
  // ⚠⚠ NEON, NOT `Ingest.DATABASE_URL`. See the header. This is the whole ballgame.
  DATABASE_URL: '${{Ingest.NEON_DATABASE_URL}}',
  GEMINI_API_KEY: '${{Ingest.GEMINI_API_KEY}}',
  ANTHROPIC_API_KEY: '${{Ingest.ANTHROPIC_API_KEY}}',
  // Internal Railway hostnames — not credentials, and unroutable outside the project.
  FTS_SEARCH_URL: 'https://fts-serve-production-4cea.up.railway.app',
  VECTOR_SEARCH_URL: 'https://vector-serve-production.up.railway.app',
  // ⚠ THE POINT OF THE SERVICE. Without this the worker warns and polls an empty queue.
  LEX_BUILD_DRIVER: 'worker',
  // ⚠ ONE BUILD AT A TIME, DELIBERATELY. `build-config.ts`: a build fires 10–20 searches and the
  // vector service handles four at once, so one build must not saturate search for everyone.
  // (Note: this is `LEX_BUILD_WORKER_CONCURRENCY`; Ingest's `WORKER_CONCURRENCY=20` is a
  // different variable for a different worker and is deliberately not referenced.)
  LEX_BUILD_WORKER_CONCURRENCY: '1',
}

async function main() {
  if (!T) { console.log('no RAILWAY_API_TOKEN'); process.exit(1) }

  const { projectToken } = await gql('query { projectToken { projectId environmentId } }') as
    { projectToken: { projectId: string; environmentId: string } }
  const { projectId, environmentId } = projectToken

  const proj = await gql(`query($id: String!) {
    project(id: $id) { name services { edges { node { id name } } } }
  }`, { id: projectId }) as { project: { name: string; services: { edges: Array<{ node: { id: string; name: string } }> } } }

  const existing = proj.project.services.edges.find((s) => s.node.name === SERVICE_NAME)
  console.log(`\nproject ${proj.project.name}`)
  console.log(`  ${proj.project.services.edges.length} services`)
  console.log(`  "${SERVICE_NAME}" ${existing ? `ALREADY EXISTS (${existing.node.id})` : 'does not exist'}`)

  console.log('\n── what would be set ──')
  console.log(`  root directory : scrutinise-web`)
  console.log(`  start command  : npx tsx scripts/build-worker.ts`)
  console.log(`  build command  : npx prisma generate   (NOT \`npm run build\` — see the code)`)
  console.log(`  repo           : Scrutinise/scrutinise-prototype`)
  for (const [k, v] of Object.entries(VARIABLES)) console.log(`  ${k.padEnd(30)} ${v}`)
  console.log('\n  ⚠ LEX_VECTOR_STREAMS is deliberately NOT set here — production\'s value lives in')
  console.log('    Vercel and cannot be read from this machine (SAML). Setting a guess would make')
  console.log('    worker builds retrieve differently from client builds, invisibly.')

  if (existing) {
    console.log('\n⚠ REFUSING TO CREATE A SECOND ONE. A duplicate worker is two builds in flight')
    console.log('  against a search layer sized for one, and it bills twice.')
    if (!CREATE) { console.log('  Re-run with --create to REPAIR the existing one in place.\n'); return }
    console.log('\n── repairing the existing service in place ──')
    await gql(`mutation($id: String!, $env: String!, $input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(serviceId: $id, environmentId: $env, input: $input)
    }`, {
      id: existing.node.id, env: environmentId,
      input: {
        rootDirectory: 'scrutinise-web',
        startCommand: 'npx tsx scripts/build-worker.ts',
        buildCommand: 'npx prisma generate',
        restartPolicyType: 'ON_FAILURE',
        restartPolicyMaxRetries: 10,
      },
    })
    await gql(`mutation($input: VariableCollectionUpsertInput!) {
      variableCollectionUpsert(input: $input)
    }`, {
      input: { projectId, environmentId, serviceId: existing.node.id, variables: VARIABLES, replace: false },
    })
    const red = await gql(`mutation($id: String!, $env: String!) {
      serviceInstanceDeployV2(serviceId: $id, environmentId: $env)
    }`, { id: existing.node.id, env: environmentId })
    console.log(`  settings + variables reapplied; deploy ${JSON.stringify(red).slice(0, 90)}`)
    return
  }
  if (!CREATE) { console.log('\nPlan only. Nothing created. Re-run with --create.\n'); return }

  console.log('\n── creating ──')
  const created = await gql(`mutation($input: ServiceCreateInput!) {
    serviceCreate(input: $input) { id name }
  }`, {
    input: {
      projectId,
      name: SERVICE_NAME,
      source: { repo: 'Scrutinise/scrutinise-prototype' },
    },
  }) as { serviceCreate: { id: string; name: string } }
  const serviceId = created.serviceCreate.id
  console.log(`  service ${serviceId}`)

  await gql(`mutation($id: String!, $env: String!, $input: ServiceInstanceUpdateInput!) {
    serviceInstanceUpdate(serviceId: $id, environmentId: $env, input: $input)
  }`, {
    id: serviceId, env: environmentId,
    input: {
      rootDirectory: 'scrutinise-web',
      startCommand: 'npx tsx scripts/build-worker.ts',
      // ══ ⚠⚠ THE FIRST DEPLOY FAILED HERE, AND THE REASON IS WORTH THE COMMENT ══════════
      //
      // Railway's builder saw a Next.js app in `scrutinise-web` and ran `npm run build` — the
      // full production build — which died prerendering `/admin/invites`:
      //   "@clerk/clerk-react: Missing publishableKey"
      // Correctly: this service has no Clerk key and should never have one.
      //
      // ⚠ THE WORKER DOES NOT NEED A NEXT BUILD. It is `npx tsx scripts/build-worker.ts` — it
      // needs `node_modules` and the Prisma client and nothing else. `npm ci` gives it both
      // (`postinstall: prisma generate`), and this makes the generate explicit so the service
      // does not depend on an install hook staying where it is.
      //
      // ⚠ AND IT IS A REAL SAVING, NOT ONLY A FIX: a worker that rebuilt the whole web app on
      // every deploy would take minutes to restart and could be broken by a page it never serves.
      buildCommand: 'npx prisma generate',
      // ⚠ A worker is not a web service: no healthcheck, and a restart on failure is right for a
      // long-lived poller. `ON_FAILURE` is safe HERE (unlike the heavy-job rule in CLAUDE.md §17)
      // because the loop is idempotent — it claims work it has not already claimed.
      restartPolicyType: 'ON_FAILURE',
      restartPolicyMaxRetries: 10,
    },
  })
  console.log('  root directory and start command set')

  await gql(`mutation($input: VariableCollectionUpsertInput!) {
    variableCollectionUpsert(input: $input)
  }`, {
    input: { projectId, environmentId, serviceId, variables: VARIABLES, replace: false },
  })
  console.log(`  ${Object.keys(VARIABLES).length} variables set (secrets as references)`)

  const dep = await gql(`mutation($id: String!, $env: String!) {
    serviceInstanceDeployV2(serviceId: $id, environmentId: $env)
  }`, { id: serviceId, env: environmentId })
  console.log(`  deploy triggered: ${JSON.stringify(dep).slice(0, 120)}`)
  console.log(`\n⚠ NOT DONE YET. §1a: prove it alive with a POSITIVE log line from the worker`)
  console.log(`  itself. Watch for "[build-worker …] starting · concurrency 1 · driver=worker".\n`)
}

main().catch((e) => { console.error('failed:', e instanceof Error ? e.message : e); process.exit(1) })
