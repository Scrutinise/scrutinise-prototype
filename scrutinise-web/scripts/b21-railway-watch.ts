export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B21 TRACK 1 — `build-worker` HAS NO WATCH PATHS, AND THAT IS THE ROOT CAUSE.
//
// The service that runs every build had `watchPatterns: []`, so sixteen pushes produced no
// deployment record for it at all while `fts-serve` and `vector-serve` each got a SKIPPED
// one. It served the same container from 3 to 9 September. Every "the fix is live" claim in
// that window was a claim about a repository, not about a machine.
//
// ⚠⚠ AND THE FIX FOR THE TRAP WAS ITSELF TRAPPED. `serviceInstanceDeployV2` takes THREE
// arguments. Called with two it returns SUCCESS, with a fresh deployment id, having built
// the OLD commit — `a47cdcaa` went green in four minutes on `15bafe1f` while the intended
// commit was `5b92b93`. Read `meta.commitHash`. Never the status, never the id.
//
// ⚠ THE PATHS ARE REPO-ROOT-RELATIVE, NOT ROOT-DIRECTORY-RELATIVE. `build-worker`'s
// `rootDirectory` is `scrutinise-web`, but `fts-serve`'s `rootDirectory` is `scripts/ingest`
// and its working pattern is `scripts/ingest/search/**` — the full path from the repo root.
// A pattern written as `lib/lex/**` would match nothing and would look exactly like the
// empty list it replaced.
//
//   npx tsx --env-file=.env scripts/b21-railway-watch.ts              (read only)
//   npx tsx --env-file=.env scripts/b21-railway-watch.ts --set
// ─────────────────────────────────────────────────────────────────────────────

const T = process.env.RAILWAY_API_TOKEN!
const ENV = '991f733c-719c-4217-a6d6-1dbe80642bbe'
const WORKER = 'c0d9fd39-9226-4d85-a9c5-a616341a542f'
const SET = process.argv.includes('--set')

/**
 * What the worker actually runs, and therefore what should rebuild it.
 *
 * ⚠ `lib/**` NOT `lib/lex/**`. The brief asks for "at minimum `scrutinise-web/lib/lex/**`",
 * and the minimum is too narrow: `build.ts` imports `@/lib/prisma`, `@/lib/env-flags` and
 * `@/lib/ai/*`, and a change to any of those changes what the worker does. A watch list that
 * covers the interesting file and not its dependencies reproduces the same failure in a
 * smaller shape.
 * ⚠ `prisma/**` is included because the generated client is built at deploy time; a schema
 * change that the worker's client does not know about is the twelve-hours-early-schema
 * incident from CLAUDE.md §0, arriving from the other direction.
 */
const PATTERNS = [
  'scrutinise-web/lib/**',
  'scrutinise-web/scripts/build-worker.ts',
  'scrutinise-web/prisma/**',
  'scrutinise-web/package.json',
  'scrutinise-web/package-lock.json',
]

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

async function read() {
  const d = await gql(`query($s: String!, $e: String!) {
    serviceInstance(serviceId: $s, environmentId: $e) {
      watchPatterns rootDirectory
      latestDeployment { id status createdAt meta }
    }
  }`, { s: WORKER, e: ENV }) as { serviceInstance: any }
  return d.serviceInstance
}

async function main() {
  if (!T) { console.log('no RAILWAY_API_TOKEN'); process.exit(1) }
  const before = await read()
  console.log('── build-worker, before ──')
  console.log(`  rootDirectory : ${before.rootDirectory}`)
  console.log(`  watchPatterns : ${JSON.stringify(before.watchPatterns)}`)
  console.log(`  latest        : ${String(before.latestDeployment?.id ?? '').slice(0, 8)} ${before.latestDeployment?.status}`
    + ` sha=${String(before.latestDeployment?.meta?.commitHash ?? '').slice(0, 12)}`)

  if (!SET) {
    console.log('\n── would set ──')
    for (const p of PATTERNS) console.log(`  ${p}`)
    console.log('\nREAD ONLY — nothing changed. Re-run with --set.')
    return
  }

  await gql(`mutation($s: String!, $e: String!, $in: ServiceInstanceUpdateInput!) {
    serviceInstanceUpdate(serviceId: $s, environmentId: $e, input: $in)
  }`, { s: WORKER, e: ENV, in: { watchPatterns: PATTERNS } })

  // ══ ⚠⚠ AND THE WATCH PATHS WERE THE SYMPTOM, NOT THE LAYER ══════════════════════════════
  //
  // Setting `watchPatterns` alone changed nothing, and the read-back said it had worked.
  // **`build-worker` had NO REPO TRIGGER AT ALL** — `repoTriggers` returned 0 for it and 1 for
  // every other repo-backed service in the project. So no push has ever reached it, and the
  // empty watch list was irrelevant because there was nothing arriving to be filtered.
  //
  // That is why the service was the only one with NO deployment record per push while
  // `fts-serve` and `vector-serve` got a SKIPPED one each: a SKIPPED record is a trigger
  // firing and the watch declining. No record is no trigger.
  //
  // ⚠ A trigger means a push touching a watched path now REPLACES THE CONTAINER, which
  // interrupts a build in flight. That is the deliberate trade: the watch list is scoped to
  // what the worker actually runs, and six days of silent staleness is the alternative.
  const { project } = await gql(`query($id: String!) {
    project(id: $id) { services { edges { node { id name repoTriggers { edges { node { id branch repository provider } } } } } } }
  }`, { id: (await gql('query { projectToken { projectId } }') as any).projectToken.projectId }) as any
  const me = project.services.edges.find((e: any) => e.node.id === WORKER)?.node
  const existing = me?.repoTriggers?.edges ?? []
  console.log(`\n  repoTriggers on build-worker: ${existing.length}`)

  if (!existing.length) {
    // Copied from a sibling that works, rather than typed from memory.
    const sibling = project.services.edges
      .map((e: any) => e.node.repoTriggers?.edges?.[0]?.node)
      .find(Boolean)
    if (!sibling) throw new Error('no sibling trigger to copy the repo/branch/provider from')
    console.log(`  creating one, copying ${sibling.repository}@${sibling.branch} (${sibling.provider}) from a sibling`)
    const pt = (await gql('query { projectToken { projectId environmentId } }') as any).projectToken
    try {
      await gql(`mutation($in: DeploymentTriggerCreateInput!) { deploymentTriggerCreate(input: $in) { id } }`, {
        in: {
          branch: sibling.branch, repository: sibling.repository, provider: sibling.provider,
          serviceId: WORKER, environmentId: pt.environmentId, projectId: pt.projectId,
        },
      })
    } catch (e) {
      // ⚠⚠ `Bad Access` — AND IT IS NOT A DEAD TOKEN. `serviceInstanceUpdate` above succeeded
      // with the same credential, so the refusal is specific to the GitHub linkage:
      // `deploymentTriggerCreate` and `serviceInstanceAutoDeployUpdate` both need the ACCOUNT's
      // connection to the repository, which a Project-Access-Token does not carry.
      // This is Charlie's, in the dashboard, and it is one action.
      console.error(`\n⚠⚠ COULD NOT CREATE THE TRIGGER: ${(e as Error).message}`)
      console.error('   A project token cannot link a service to GitHub. `serviceInstanceUpdate`')
      console.error('   worked with this same token, so the credential is fine and the permission')
      console.error('   is not.')
      console.error('\n   CHARLIE, ONE ACTION: Railway → build-worker → Settings → Source →')
      console.error(`   connect ${sibling.repository} @ ${sibling.branch}, and enable auto-deploy.`)
      console.error('   The watch paths are already set, so it will build only on the files above.')
      console.error('\n   Until then the worker is deployed by hand:')
      console.error('     serviceInstanceDeployV2(serviceId, environmentId, commitSha) — and READ THE SHA BACK.')
    }
  }

  // ⚠ READ IT BACK. A mutation that returns without error is a claim about a request.
  const after = await read()
  const trig = await gql(`query($id: String!) {
    project(id: $id) { services { edges { node { id repoTriggers { edges { node { id branch repository } } } } } } }
  }`, { id: (await gql('query { projectToken { projectId } }') as any).projectToken.projectId }) as any
  const nowTriggers = trig.project.services.edges.find((e: any) => e.node.id === WORKER)?.node?.repoTriggers?.edges ?? []

  console.log('\n── build-worker, after (read back, not assumed) ──')
  console.log(`  watchPatterns : ${JSON.stringify(after.watchPatterns)}`)
  console.log(`  repoTriggers  : ${nowTriggers.length}${nowTriggers.length ? ` — ${nowTriggers[0].node.repository}@${nowTriggers[0].node.branch}` : ''}`)
  const ok = JSON.stringify(after.watchPatterns) === JSON.stringify(PATTERNS) && nowTriggers.length > 0
  console.log('\n' + (ok
    ? '✔ set and read back. ⚠ THIS IS STILL NOT PROOF — push a change to a watched path and\n'
      + '  confirm a deployment appears for the service that nobody triggered.'
    : '⚠⚠ WHAT CAME BACK IS NOT WHAT WAS SENT.'))
  process.exit(ok ? 0 : 1)
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
