export {}

// ─────────────────────────────────────────────────────────────────────────────────────────
// 25-W §F (decision 56) — MAKE THE WORKER RETRIEVE THE WAY VERCEL RETRIEVES, AND SAY SO.
//
// Charlie: *"Set LEX_VECTOR_STREAMS on the Railway worker to match Vercel, and report both
// values read back. ⚠ Until this is done every worker build retrieves differently from
// everything tested so far, with nothing saying so."*
//
// ⚠⚠ THE SECOND SENTENCE IS THE WHOLE PROBLEM AND IT IS WHY THIS IS A SCRIPT AND NOT A
// DASHBOARD EDIT. `LEX_VECTOR_STREAMS` unset means dense retrieval is OFF on every stream —
// no error, no warning, no counter, and a build that looks identical to a configured one.
// Every build since the driver flipped to `worker` on 2 September has run in that state.
//
// ⚠ IT COPIES A READING, NOT A GUESS. Production's value is read off `/api/health`, through
// the router's own parse (`resolvedVectorStreams`), so what is written to Railway is what
// Vercel's app actually resolves rather than what someone believed was in the dashboard.
// Vercel's environment cannot be read from a session at all (SAML, docs/CLAUDE.md §19); this
// endpoint is the reachable surface §19 tells us to prefer.
//
// ⚠ AND IT READS BACK AFTER WRITING. A write whose effect is not re-read is an intention,
// not a change (CLAUDE.md, "report only what you re-read").
//
// Usage:
//   npx tsx --env-file=.env scripts/sync-worker-retrieval.ts            (report only)
//   npx tsx --env-file=.env scripts/sync-worker-retrieval.ts --write
// ─────────────────────────────────────────────────────────────────────────────────────────

const T = process.env.RAILWAY_API_TOKEN
const WRITE = process.argv.includes('--write')
const WORKER_SERVICE = 'c0d9fd39-9226-4d85-a9c5-a616341a542f' // build-worker
const HEALTH = 'https://www.scrutinise.org/api/health'

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

  // ── 1. Vercel's value, read off the running site ──────────────────────────────────────
  const res = await fetch(HEALTH, { cache: 'no-store' })
  if (!res.ok) { console.error(`/api/health answered HTTP ${res.status}`); process.exit(1) }
  const health = await res.json() as {
    commit?: string
    retrieval?: { vectorStreams?: unknown; vectorSearchUrl?: boolean }
  }

  // ⚠ ABSENT IS NOT EMPTY. A deployment predating this field returns no key at all, and
  // treating that as "no streams" would write an empty value over a real one and report it as
  // a match. It refuses instead.
  if (!Array.isArray(health.retrieval?.vectorStreams)) {
    console.error(
      `\n⚠ /api/health (commit ${health.commit ?? '?'}) does not report retrieval.vectorStreams.\n` +
      '  That field ships with 25-W. Production is serving a build from before it, so Vercel\'s\n' +
      '  value is still unreadable and nothing should be written to the worker yet.\n' +
      '  Wait for the deploy, confirm the commit, and run this again.',
    )
    process.exit(1)
  }
  const vercelStreams = (health.retrieval!.vectorStreams as unknown[]).map(String)
  const vercelValue = vercelStreams.join(',')

  console.log(`\n── VERCEL (production, commit ${health.commit ?? '?'}) ──`)
  console.log(`  LEX_VECTOR_STREAMS = ${vercelValue || '(empty — dense retrieval is OFF on every stream)'}`)
  console.log(`  VECTOR_SEARCH_URL set: ${health.retrieval?.vectorSearchUrl ? 'yes' : 'NO'}`)

  // ── 2. The worker's value, before ─────────────────────────────────────────────────────
  const { projectToken } = await gql('query { projectToken { projectId environmentId } }') as
    { projectToken: { projectId: string; environmentId: string } }
  const { projectId, environmentId } = projectToken

  const readWorker = async (): Promise<string | null> => {
    const v = await gql(`query($p: String!, $e: String!, $s: String!) {
      variables(projectId: $p, environmentId: $e, serviceId: $s)
    }`, { p: projectId, e: environmentId, s: WORKER_SERVICE }) as { variables: Record<string, string> }
    return 'LEX_VECTOR_STREAMS' in v.variables ? v.variables.LEX_VECTOR_STREAMS : null
  }

  const before = await readWorker()
  console.log('\n── RAILWAY build-worker, before ──')
  console.log(`  LEX_VECTOR_STREAMS = ${before === null ? '(ABSENT — never set)' : before || '(empty)'}`)

  const matches = (before ?? '') === vercelValue
  console.log(`\n  → they ${matches ? 'MATCH' : 'DIFFER'}${matches ? '' : ' — every worker build so far retrieved differently'}`)

  if (!WRITE) {
    console.log('\n  (report only — pass --write to set the worker\'s value)')
    return
  }
  if (matches) {
    console.log('\n  Nothing to write.')
    return
  }

  // ── 3. Write, then re-read ────────────────────────────────────────────────────────────
  await gql(`mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }`, {
    input: {
      projectId, environmentId, serviceId: WORKER_SERVICE,
      name: 'LEX_VECTOR_STREAMS', value: vercelValue,
    },
  })

  const after = await readWorker()
  console.log('\n── RAILWAY build-worker, after (re-read, not assumed) ──')
  console.log(`  LEX_VECTOR_STREAMS = ${after === null ? '(ABSENT)' : after || '(empty)'}`)
  console.log(`\n  → ${(after ?? '') === vercelValue ? 'MATCHES Vercel.' : '⚠ STILL DIFFERS — the write did not take.'}`)
  console.log('\n⚠ A variable change needs a REDEPLOY to reach the running process. The value above is\n' +
    '  what the next deployment will start with, not what the process in memory is using.')
}

main().catch((e) => { console.error('failed:', e instanceof Error ? e.message : e); process.exit(1) })
