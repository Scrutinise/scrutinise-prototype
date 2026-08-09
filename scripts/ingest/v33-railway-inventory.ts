/**
 * v33-railway-inventory.ts — READ-ONLY inventory of the Railway project (V33 §4).
 *
 * Charlie's steer: **Railway is staying** (Hobby plan, which is fine) and runs some compute, but
 * its exact role is unclear and whatever has fully moved to Neon should be cleared out. This is
 * the measurement that `docs/RAILWAY_ROLE.md` is written from. It removes nothing and stops
 * nothing.
 *
 * ⚠ Endpoint: `backboard.railway.com/graphql/v2`, never `api.railway.app` — the latter returns
 * stale deployment data in queries (root CLAUDE.md, Railway Operations).
 *
 * Usage: tsx v33-railway-inventory.ts [--json out.json]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import fs from 'fs'

export {}

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const OUT = (() => { const i = process.argv.indexOf('--json'); return i >= 0 ? process.argv[i + 1] : '' })()

type Node<T> = { edges: Array<{ node: T }> }
type Deployment = { id: string; status: string; createdAt: string; staticUrl?: string | null }
type Service = {
  id: string; name: string; createdAt: string
  deployments: Node<Deployment>
  serviceInstances: Node<{ id: string; region?: string | null; startCommand?: string | null; numReplicas?: number | null; source?: { image?: string | null; repo?: string | null } | null }>
}

/**
 * ⚠ `RAILWAY_API_TOKEN` in this project is a **PROJECT token** (a bare 36-char UUID), not an
 * account or team token. Railway authenticates those with the `Project-Access-Token` header;
 * `Authorization: Bearer` returns `Not Authorized` on EVERY query — including `me` and
 * `projects`, which is what makes it look like an expired credential rather than a wrong header.
 * Every existing script here (`check-railway-status.ts`, `check-v17-services.ts`, …) sends
 * Bearer and is therefore dead until it is changed. Recorded in docs/RAILWAY_ROLE.md.
 *
 * A project token is also scoped to one project and one environment, so `RAILWAY_PROJECT_ID` is
 * redundant with it — `{ projectToken { projectId environmentId } }` reports both.
 */
async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) throw new Error('RAILWAY_API_TOKEN not set')
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Project-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json() as { data?: T; errors?: Array<{ message: string }> }
  if (body.errors?.length) throw new Error(`Railway API: ${body.errors.map((e) => e.message).join('; ')}`)
  if (!body.data) throw new Error('Railway API returned no data')
  return body.data
}

/** Group the fleet's numbered workers so 30 identical rows do not drown the signal. */
function familyOf(name: string): string {
  return name.replace(/[-_]?\d+$/, '').replace(/\s+\d+$/, '') || name
}

async function main() {
  // `RAILWAY_PROJECT_ID` has never been in `.env` — it lives in INGEST_PLAYBOOK.md §Railway, and
  // a bare `process.env.RAILWAY_PROJECT_ID!` has already sent `undefined` to the API once
  // (CHANGE_LOG 2026-07). Ask the token which project it is for instead of guessing.
  const scope = await gql<{ projectToken: { projectId: string; environmentId: string } }>(
    `{ projectToken { projectId environmentId } }`, {})
  const projectId = scope.projectToken.projectId
  console.log(`token scope: project ${projectId}  environment ${scope.projectToken.environmentId}\n`)

  const data = await gql<{ project: { id: string; name: string; createdAt: string; services: Node<Service>; environments: Node<{ id: string; name: string }> } }>(
    `query Inv($projectId: String!) {
       project(id: $projectId) {
         id name createdAt
         environments { edges { node { id name } } }
         services { edges { node {
           id name createdAt
           deployments(last: 1) { edges { node { id status createdAt staticUrl } } }
           serviceInstances { edges { node { id region startCommand numReplicas source { image repo } } } }
         } } }
       }
     }`, { projectId })

  const proj = data.project
  console.log(`project  ${proj.name}  (${proj.id})  created ${proj.createdAt.slice(0, 10)}`)
  console.log(`environments: ${proj.environments.edges.map((e) => e.node.name).join(', ')}\n`)

  const services = proj.services.edges.map((e) => e.node)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))

  const byFamily = new Map<string, Service[]>()
  for (const s of services) {
    const f = familyOf(s.name)
    byFamily.set(f, [...(byFamily.get(f) ?? []), s])
  }

  console.log(`${services.length} services in ${byFamily.size} families\n`)
  console.log('family                          n  statuses                              last deploy   region')
  console.log('─'.repeat(110))
  for (const [family, list] of [...byFamily.entries()].sort()) {
    const counts: Record<string, number> = {}
    for (const s of list) {
      const st = s.deployments.edges[0]?.node.status ?? 'NONE'
      counts[st] = (counts[st] ?? 0) + 1
    }
    const last = list.map((s) => s.deployments.edges[0]?.node.createdAt ?? '').sort().pop() ?? ''
    const region = list[0]?.serviceInstances.edges[0]?.node.region ?? '—'
    const statusStr = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' ')
    console.log(`${family.padEnd(30)} ${String(list.length).padStart(3)}  ${statusStr.padEnd(36)} ${last.slice(0, 10).padEnd(12)}  ${region}`)
  }

  console.log('\nper-service detail (families of 1, plus anything not SUCCESS/REMOVED):')
  console.log('─'.repeat(110))
  for (const s of services) {
    const d = s.deployments.edges[0]?.node
    const inst = s.serviceInstances.edges[0]?.node
    const singleton = (byFamily.get(familyOf(s.name)) ?? []).length === 1
    if (!singleton && (d?.status === 'SUCCESS' || d?.status === 'REMOVED')) continue
    console.log(`  ${s.name.padEnd(28)} ${String(d?.status ?? 'NONE').padEnd(12)} ${String(d?.createdAt ?? '').slice(0, 19).padEnd(20)} replicas=${inst?.numReplicas ?? '?'} ${inst?.source?.image ? `image=${inst.source.image}` : inst?.source?.repo ? `repo=${inst.source.repo}` : ''}`)
    if (d?.staticUrl) console.log(`  ${''.padEnd(28)} url  https://${d.staticUrl}`)
    if (inst?.startCommand) console.log(`  ${''.padEnd(28)} cmd  ${inst.startCommand.slice(0, 90)}`)
  }

  if (OUT) {
    fs.writeFileSync(OUT, JSON.stringify({ measuredAt: new Date().toISOString(), project: proj }, null, 2))
    console.log(`\nwrote ${OUT}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
