export {}

// ─────────────────────────────────────────────────────────────────────────────
// B18 §3 — IS RETRIEVAL ACTUALLY LIVE, ON THE SERVICES THE WORKER WILL CALL?
//
// ⚠ The worker's env is a claim about configuration. `/stats` is a claim about the
// service being reachable AND not saturated. `vector-serve` is 4 wide with a 64-deep
// queue and a client abort does NOT cancel queued work, so a saturated service returns
// nothing to every dense leg, silently, with the ranking falling back to BM25 — which is
// exactly the M-01 failure mode wearing a different cause.
//
// Read-only. Prints both services' stats and says whether it is safe to spend.
//
//   npx tsx --env-file=.env scripts/_b18-retrieval-preflight.ts
// ─────────────────────────────────────────────────────────────────────────────

// The URLs the WORKER uses, read off Railway rather than off this laptop's .env — the
// two have disagreed before and the worker's is the one that matters.
const T = process.env.RAILWAY_API_TOKEN!
const SERVICE = 'c0d9fd39-9226-4d85-a9c5-a616341a542f' // build-worker

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

async function stats(name: string, url: string) {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 20000)
    const res = await fetch(`${url.replace(/\/$/, '')}/stats`, { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return { name, ok: false, detail: `HTTP ${res.status}` }
    const j = await res.json() as any
    const c = j.concurrency ?? {}
    const saturated = typeof c.queued === 'number' && typeof c.maxQueue === 'number'
      && c.maxQueue > 0 && c.queued >= c.maxQueue * 0.5
    return {
      name, ok: true, saturated,
      detail: `served=${j.served ?? '?'} width=${c.max ?? '?'} queued=${c.queued ?? '?'}/${c.maxQueue ?? '?'}`
        + ` rejected=${c.rejections ?? '?'} warm_p95=${j.warm_p95_ms ?? '?'}ms since=${j.started_at ?? '?'}`,
    }
  } catch (e) {
    return { name, ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
}

async function main() {
  const { projectToken } = await gql('query { projectToken { projectId environmentId } }') as
    { projectToken: { projectId: string; environmentId: string } }
  const v = await gql(`query($p: String!, $e: String!, $s: String!) {
    variables(projectId: $p, environmentId: $e, serviceId: $s)
  }`, { p: projectToken.projectId, e: projectToken.environmentId, s: SERVICE }) as
    { variables: Record<string, string> }

  const fts = v.variables.FTS_SEARCH_URL
  const vec = v.variables.VECTOR_SEARCH_URL
  const streams = v.variables.LEX_VECTOR_STREAMS
  const router = v.variables.LEX_QUERY_ROUTER

  console.log('── the worker\'s retrieval configuration, read off Railway ──')
  console.log(`  FTS_SEARCH_URL     ${fts ?? 'UNSET ⚠⚠'}`)
  console.log(`  VECTOR_SEARCH_URL  ${vec ?? 'UNSET ⚠⚠'}`)
  console.log(`  LEX_VECTOR_STREAMS ${streams ?? 'UNSET ⚠⚠'}`)
  console.log(`  LEX_QUERY_ROUTER   ${router ?? 'UNSET ⚠⚠'}`)

  const results = await Promise.all([
    fts ? stats('fts', fts) : Promise.resolve({ name: 'fts', ok: false, detail: 'URL unset' }),
    vec ? stats('vector', vec) : Promise.resolve({ name: 'vector', ok: false, detail: 'URL unset' }),
  ])

  console.log('\n── the services, read off /stats ──')
  for (const r of results) {
    console.log(`  ${r.name.padEnd(7)} ${r.ok ? 'REACHABLE' : 'UNREACHABLE ⚠⚠'}  ${r.detail}`
      + ((r as any).saturated ? '  ⚠⚠ SATURATED' : ''))
  }

  const configured = Boolean(fts && vec && streams && router)
  const reachable = results.every((r) => r.ok)
  const clear = results.every((r) => !(r as any).saturated)
  console.log('\n' + (configured && reachable && clear
    ? '✔ SAFE TO SPEND — configured, both services reachable, neither saturated.'
    : '⚠⚠ DO NOT SPEND — see above. A build run in this state will report DONE and retrieve nothing.'))
  process.exit(configured && reachable && clear ? 0 : 1)
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
