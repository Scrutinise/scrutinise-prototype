// ─────────────────────────────────────────────────────────────────────────────
// AUDIT — which services exist, and does this plan offer sleep-on-inactivity?
//
// ⚠ THE TOKEN IS A PROJECT TOKEN. It goes in `Project-Access-Token`, never
// `Authorization: Bearer` — Bearer 401s EVERYTHING and reads like a dead token, which has
// cost this project a diagnosis before. Several older scripts in this repo still use Bearer
// and are stale; this one does not copy them.
//
// Reads only. Nothing here changes a setting.
//
//   tsx scripts/ingest/ops/audit-sleep.ts
// ─────────────────────────────────────────────────────────────────────────────

import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

const API = 'https://backboard.railway.com/graphql/v2'

export async function rail<T = unknown>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) throw new Error('RAILWAY_API_TOKEN not set')
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Project-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json() as { data?: T; errors?: Array<{ message: string }> }
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '))
  if (!body.data) throw new Error(`no data (HTTP ${res.status})`)
  return body.data
}

async function main() {
  // ── 1. What is in the project? ───────────────────────────────────────────
  //
  // ⚠ A PROJECT TOKEN IS SCOPED TO ITS PROJECT. `projectToken` returns ids and nothing
  // else — `me` and the team are Not Authorized, measured. So the ids come from the token
  // and the detail comes from `project(id:)`.
  const ids = await rail<{ projectToken: { projectId: string; environmentId: string } }>(
    '{ projectToken { projectId environmentId } }',
  )
  const { projectId, environmentId } = ids.projectToken
  console.log(`project     ${projectId}`)
  console.log(`environment ${environmentId}`)

  const proj = await rail<{
    project: {
      name: string
      services: { edges: Array<{ node: { id: string; name: string } }> }
    }
  }>(`query P($id: String!) { project(id: $id) { name services { edges { node { id name } } } } }`,
  { id: projectId })
  const p = proj.project
  console.log(`name        ${p.name}`)
  console.log(`\nservices (${p.services.edges.length}):`)
  for (const s of p.services.edges) console.log(`  ${s.node.name.padEnd(28)} ${s.node.id}`)

  // ── 2. Does `serviceInstance` expose a sleep field on this API? ──────────
  //
  // ⚠ ASKED OF THE SCHEMA, not assumed from documentation. Railway's "App Sleeping" is
  // `sleepApplication` on ServiceInstance, but whether it is present and settable depends
  // on the plan — and a script that assumed it and got `null` would report "sleep is off"
  // when the truth is "this plan has no such thing".
  const schema = await rail<{ __type: { fields: Array<{ name: string; type: { name: string | null; kind: string } }> } }>(`
    query { __type(name: "ServiceInstance") { fields { name type { name kind } } } }
  `)
  const names = schema.__type.fields.map((f) => f.name)
  const sleepish = names.filter((n) => /sleep|idle|autoscal|numReplicas|region/i.test(n))
  console.log(`\nServiceInstance fields matching sleep/idle/replicas:`)
  console.log(sleepish.length ? sleepish.map((n) => `  ${n}`).join('\n') : '  (none)')

  // ── 3. And is there a mutation to set it? ────────────────────────────────
  const mut = await rail<{ __type: { fields: Array<{ name: string }> } }>(`
    query { __type(name: "Mutation") { fields { name } } }
  `)
  const setters = mut.__type.fields.map((f) => f.name).filter((n) => /sleep|serviceInstanceUpdate/i.test(n))
  console.log(`\nmutations that could set it:`)
  console.log(setters.length ? setters.map((n) => `  ${n}`).join('\n') : '  (none)')
}

if (require.main === module) {
  main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1 })
}
