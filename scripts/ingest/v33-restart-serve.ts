/**
 * v33-restart-serve.ts — restart a Railway serve service and PROVE it restarted.
 *
 * WHY IT MATTERS: `fts-serve` and `vector-serve` call `openTable()` once at boot with no
 * `readConsistencyInterval`, so each holds a FIXED SNAPSHOT of its Lance table. After any index
 * work they keep serving the old one, and every measurement taken against them is meaningless
 * until they are restarted (docs/CLAUDE.md §17, "Restart fts-serve after any index work").
 *
 * ⚠ TWO THINGS THIS GETS RIGHT THAT THE OLDER SCRIPTS DO NOT:
 *  1. `RAILWAY_API_TOKEN` is a PROJECT token and must be sent as `Project-Access-Token`.
 *     Every other Railway script here sends `Authorization: Bearer` and gets `Not Authorized`
 *     on every query. See docs/RAILWAY_ROLE.md.
 *  2. `deploymentRedeploy`, never `serviceInstanceRedeploy` — the latter rebuilds from source
 *     (root CLAUDE.md, Railway Operations). We want the SAME build, restarted.
 *
 * The restart is verified from `/stats`, not from the mutation's return value: `started_at` must
 * move and the since-boot counters must reset. A mutation that returns an id has not proven that
 * a process came back.
 *
 * Usage:
 *   tsx v33-restart-serve.ts fts-serve
 *   tsx v33-restart-serve.ts vector-serve --check-only
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

export {}

const API = 'https://backboard.railway.com/graphql/v2'
const SERVICE = process.argv[2]
const CHECK_ONLY = process.argv.includes('--check-only')

async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) throw new Error('RAILWAY_API_TOKEN not set')
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Project-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json() as { data?: T; errors?: Array<{ message: string }> }
  if (body.errors?.length) throw new Error(`Railway API: ${body.errors.map((e) => e.message).join('; ')}`)
  if (!body.data) throw new Error('Railway API returned no data')
  return body.data
}

async function stats(url: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(`${url}/stats`, { signal: AbortSignal.timeout(15_000) })
    if (!r.ok) return null
    return await r.json() as Record<string, unknown>
  } catch { return null }
}

async function main() {
  if (!SERVICE) throw new Error('usage: v33-restart-serve.ts <serviceName> [--check-only]')
  const scope = await gql<{ projectToken: { projectId: string } }>(`{ projectToken { projectId } }`)
  const projectId = scope.projectToken.projectId

  const data = await gql<{ project: { services: { edges: Array<{ node: { id: string; name: string; deployments: { edges: Array<{ node: { id: string; status: string; staticUrl?: string | null } }> } } }> } } }>(
    `query($p:String!){ project(id:$p){ services{ edges{ node{ id name
        deployments(last:1){ edges{ node{ id status staticUrl } } } } } } } }`, { p: projectId })

  const svc = data.project.services.edges.map((e) => e.node).find((s) => s.name === SERVICE)
  if (!svc) throw new Error(`service "${SERVICE}" not found in project ${projectId}`)
  const dep = svc.deployments.edges[0]?.node
  if (!dep) throw new Error(`service "${SERVICE}" has no deployment`)
  const url = dep.staticUrl ? `https://${dep.staticUrl}` : null
  console.log(`${SERVICE}: deployment ${dep.id} status=${dep.status} url=${url ?? '(none)'}`)

  const before = url ? await stats(url) : null
  console.log(`  /stats BEFORE: ${before ? JSON.stringify(before).slice(0, 300) : '(unreachable)'}`)
  if (CHECK_ONLY) return

  console.log(`  deploymentRedeploy(${dep.id}) …`)
  await gql(`mutation($id:String!){ deploymentRedeploy(id:$id){ id status } }`, { id: dep.id })

  if (!url) { console.log('  no public URL — cannot verify from /stats; check the Railway logs.'); return }
  const beforeStart = (before as { started_at?: string } | null)?.started_at
  const deadline = Date.now() + 240_000
  for (;;) {
    if (Date.now() > deadline) { console.error('  ✗ TIMED OUT waiting for the service to come back with a new started_at'); process.exitCode = 1; return }
    await new Promise((r) => setTimeout(r, 8000))
    const after = await stats(url)
    if (!after) { process.stdout.write('.'); continue }
    const startedAt = (after as { started_at?: string }).started_at
    if (startedAt && startedAt !== beforeStart) {
      console.log(`\n  ✅ RESTART PROVEN — started_at ${beforeStart ?? '(unknown)'} → ${startedAt}`)
      console.log(`  /stats AFTER:  ${JSON.stringify(after).slice(0, 400)}`)
      return
    }
    process.stdout.write('.')
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
