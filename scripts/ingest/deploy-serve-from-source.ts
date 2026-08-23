/**
 * deploy-serve-from-source.ts — SHIP CODE to a serve service, and PROVE the code arrived.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠⚠ WHY THIS EXISTS BESIDE `v33-restart-serve.ts`, WHICH LOOKS LIKE IT DOES THE SAME THING.
 *
 * They do OPPOSITE things and S12 learned the difference the expensive way — by shipping a fix,
 * restarting the service, verifying, and finding the bug still there.
 *
 *   `deploymentRedeploy(id)`        re-runs THE SAME BUILD ARTEFACT.  New DATA, never new CODE.
 *   `serviceInstanceRedeploy(...)`  builds from SOURCE.               New CODE.
 *
 * Both are correct in their place, and the repo already says so in two places that read as
 * contradictory until you notice they are about different jobs:
 *   · root `CLAUDE.md` (worker restarts): *"Use deploymentRedeploy(id) — NOT serviceInstanceRedeploy
 *     (which rebuilds from source)"* — because a worker restart must not change the code.
 *   · `scripts/ingest/ops.ts`: *"NEVER deploymentRedeploy — it can resurrect a stale build (this
 *     exact mistake caused the 9 Jun Railway DB incident)"* — because starting a service must.
 *
 * ⚠ AND `vector-serve` DOES NOT AUTO-DEPLOY FROM GITHUB (CHANGE_LOG, 11 Aug: *"the same push
 * deployed fts-serve and produced no vector-serve deployment at all, which is why it had been
 * serving 7 August code"*). So for that service a push does not ship code either. This is the only
 * thing that does.
 *
 * ── THE VERIFICATION IS THE POINT, AND IT IS NOT `started_at` ───────────────────────────────────
 * `started_at` moving proves a PROCESS restarted; it does not prove WHICH CODE it restarted into —
 * that is exactly the mistake this file was written after. So `--expect` takes a probe: a request
 * plus a condition that is FALSE on the old code and TRUE on the new. Without one, the tool says
 * plainly that it has proven a restart and not a deployment.
 *
 * Usage:
 *   tsx deploy-serve-from-source.ts vector-serve
 *   tsx deploy-serve-from-source.ts vector-serve --check-only
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
    // ⚠ PROJECT token → `Project-Access-Token`. `Authorization: Bearer` 401s everything and reads
    // exactly like a dead credential (docs/RAILWAY_ROLE.md).
    headers: { 'Project-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json() as { data?: T; errors?: Array<{ message: string }> }
  if (body.errors?.length) throw new Error(`Railway API: ${body.errors.map((e) => e.message).join('; ')}`)
  if (!body.data) throw new Error('Railway API returned no data')
  return body.data
}

async function stats(url: string) {
  try {
    const r = await fetch(`${url}/stats`, { signal: AbortSignal.timeout(15_000) })
    return r.ok ? await r.json() as Record<string, unknown> : null
  } catch { return null }
}

/** The probe: caselaw snippets. FALSE on the old shared-budget code, TRUE on the fixed one.
 *  Returns the number of EMPTY snippets out of `limit` — the fix makes it 0. */
async function emptySnippets(url: string, limit: number): Promise<number | null> {
  try {
    const r = await fetch(`${url}/vector-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: 'judicial review of a planning decision', limit, tier: 'caselaw' }),
      signal: AbortSignal.timeout(120_000),
    })
    if (!r.ok) return null
    const j = await r.json() as { results?: Array<{ snippet?: string }> }
    const rs = j.results ?? []
    return rs.filter((x) => !(x.snippet ?? '').trim()).length
  } catch { return null }
}

async function main() {
  if (!SERVICE) throw new Error('usage: deploy-serve-from-source.ts <serviceName> [--check-only]')

  const { projectToken } = await gql<{ projectToken: { projectId: string; environmentId: string } }>(
    `{ projectToken { projectId environmentId } }`)
  const { projectId, environmentId } = projectToken

  const data = await gql<{ project: { services: { edges: Array<{ node: { id: string; name: string; deployments: { edges: Array<{ node: { id: string; status: string; staticUrl?: string | null } }> } } }> } } }>(
    `query($p:String!){ project(id:$p){ services{ edges{ node{ id name
        deployments(last:1){ edges{ node{ id status staticUrl } } } } } } } }`, { p: projectId })

  const svc = data.project.services.edges.map((e) => e.node).find((s) => s.name === SERVICE)
  if (!svc) throw new Error(`service "${SERVICE}" not found in project ${projectId}`)
  const dep = svc.deployments.edges[0]?.node
  const url = dep?.staticUrl ? `https://${dep.staticUrl}` : null
  console.log(`${SERVICE}: service=${svc.id} env=${environmentId}`)
  console.log(`  current deployment ${dep?.id} status=${dep?.status} url=${url ?? '(none)'}`)

  const before = url ? await stats(url) : null
  const beforeStart = (before as { started_at?: string } | null)?.started_at
  const beforeEmpty = url ? await emptySnippets(url, 10) : null
  console.log(`  BEFORE: started_at=${beforeStart ?? '?'}  empty caselaw snippets at limit=10: ${beforeEmpty ?? '?'}/10`)
  if (CHECK_ONLY) return

  console.log(`  serviceInstanceRedeploy(${svc.id}) — BUILD FROM SOURCE …`)
  await gql(`mutation($s:String!,$e:String!){ serviceInstanceRedeploy(serviceId:$s, environmentId:$e) }`,
    { s: svc.id, e: environmentId })

  if (!url) { console.log('  no public URL — cannot verify; check the Railway logs.'); return }

  // A source build is slower than a restart: compile + image + boot + Lance warm.
  const deadline = Date.now() + 900_000
  for (;;) {
    if (Date.now() > deadline) {
      console.error('  ✗ TIMED OUT waiting for a new started_at. The build may still be running — check Railway.')
      process.exitCode = 1; return
    }
    await new Promise((r) => setTimeout(r, 15_000))
    const after = await stats(url)
    if (!after) { process.stdout.write('.'); continue }
    const startedAt = (after as { started_at?: string }).started_at
    if (!startedAt || startedAt === beforeStart) { process.stdout.write('.'); continue }

    console.log(`\n  ✅ RESTART PROVEN — started_at ${beforeStart ?? '(unknown)'} → ${startedAt}`)
    // ⚠ And now the part `v33-restart-serve.ts` cannot do: prove the CODE changed, not the process.
    const afterEmpty = await emptySnippets(url, 10)
    console.log(`  empty caselaw snippets at limit=10: ${beforeEmpty ?? '?'}/10  →  ${afterEmpty ?? '?'}/10`)
    if (afterEmpty === 0) {
      console.log('  ✅✅ DEPLOYMENT PROVEN — the probe is false on the old code and true on this one.')
    } else {
      console.log('  ⚠⚠ RESTART PROVEN BUT DEPLOYMENT NOT PROVEN — the process came back and the probe')
      console.log('     still fails. Either the build did not include the fix, or the diagnosis is wrong.')
      console.log('     Do NOT record this as shipped.')
      process.exitCode = 1
    }
    return
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
