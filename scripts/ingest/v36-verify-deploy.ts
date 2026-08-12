/**
 * v36-verify-deploy.ts — is `Ingest` actually running the pushed commit?
 *
 * THE GATE THIS ENFORCES. Seeding 41,913 instruments to workers running the OLD
 * `enumerateSections` would write a 429 down as a permanent "no text" marker across
 * the whole list — the exact defect the push removes, re-run at scale, and invisible
 * afterwards because the reseed dedup treats those rows as work already done. The
 * playbook has recorded this twice (§8: "seed rows that need new processor code ONLY
 * after the push", V19 recurrence).
 *
 * It compares the deployment's commit SHA against local HEAD. A SUCCESS status is not
 * enough on its own: a SUCCESS deployment of the PREVIOUS commit is exactly what this
 * is guarding against, and it looks healthy from every other angle.
 *
 * Usage: tsx v36-verify-deploy.ts
 * Exit 0 only when the deployed SHA == local HEAD and the status is SUCCESS.
 */
import path from 'path'
import { execSync } from 'child_process'
require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') })

const API = 'https://backboard.railway.com/graphql/v2'
const INGEST = 'a7f4d75f-d844-4e1c-8edf-2569346b31c9'
const OPS = 'f3397bee-e588-4b95-921f-2e0f2f169cc5'
const ENV_ID = '991f733c-719c-4217-a6d6-1dbe80642bbe'

async function gql(token: string, query: string, variables: Record<string, unknown>) {
  const res = await fetch(API, {
    method: 'POST',
    // ⚠ Project token: `Project-Access-Token`, never `Authorization: Bearer`. With
    // Bearer EVERY query returns Not Authorized, which reads exactly like a dead
    // credential and cost a whole session on 4 Aug 2026.
    headers: { 'Project-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const body = await res.json() as { data?: unknown; errors?: { message: string }[] }
  if (body.errors?.length) throw new Error(body.errors.map(e => e.message).join('; '))
  return body.data as Record<string, unknown>
}

async function main() {
  const token = process.env.RAILWAY_API_TOKEN
  if (!token) throw new Error('RAILWAY_API_TOKEN not set')
  const head = execSync('git rev-parse HEAD', { cwd: path.join(__dirname, '../..') }).toString().trim()
  console.log(`[deploy] local HEAD : ${head}`)

  let ok = true
  for (const [name, serviceId] of [['Ingest', INGEST], ['Ops', OPS]] as [string, string][]) {
    const d = await gql(token, `
      query($sid: String!, $eid: String!) {
        deployments(first: 3, input: { serviceId: $sid, environmentId: $eid }) {
          edges { node { id status createdAt meta } }
        }
      }`, { sid: serviceId, eid: ENV_ID })
    const edges = (d.deployments as { edges: { node: Record<string, unknown> }[] }).edges
    if (!edges.length) { console.log(`[deploy] ${name}: NO DEPLOYMENTS`); ok = false; continue }
    for (const [i, e] of edges.entries()) {
      const n = e.node
      const meta = (n.meta ?? {}) as Record<string, unknown>
      const sha = String(meta.commitHash ?? meta.commitSHA ?? '')
      const match = sha && head.startsWith(sha.slice(0, 7))
      console.log(`[deploy] ${name}${i === 0 ? ' (latest)' : '        '}: ${String(n.status).padEnd(9)} ` +
        `${sha ? sha.slice(0, 7) : '(no sha)'} ${match ? '← MATCHES HEAD' : ''} ${String(n.createdAt).slice(0, 19)}`)
    }
    const latest = edges[0].node
    const meta = (latest.meta ?? {}) as Record<string, unknown>
    const sha = String(meta.commitHash ?? meta.commitSHA ?? '')
    const matches = !!sha && head.startsWith(sha.slice(0, 7))
    const success = latest.status === 'SUCCESS'
    if (name === 'Ingest') {
      if (!matches || !success) {
        console.log(`[deploy] ⚠ ${name} is NOT on the pushed commit (matches=${matches} status=${latest.status}).`)
        console.log(`[deploy] ⚠ DO NOT SEED. Workers would run the old enumerateSections and re-create the`)
        console.log(`[deploy] ⚠ permanent "no text" marker across 41,913 instruments.`)
        ok = false
      } else {
        console.log(`[deploy] ✅ ${name} is on the pushed commit and SUCCESS — safe to seed.`)
      }
    }
  }
  if (!ok) process.exitCode = 1
}

main().catch(e => { console.error('[deploy] FATAL', e); process.exitCode = 1 })
