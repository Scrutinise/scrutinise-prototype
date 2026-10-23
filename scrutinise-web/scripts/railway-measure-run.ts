/**
 * railway-measure-run.ts - drive the one-off `measure-job` Railway service (desktop side).
 *
 *   npx tsx --env-file=.env scripts/railway-measure-run.ts setup                      create the service, parked (startCommand `true`, never restarts)
 *   npx tsx --env-file=.env scripts/railway-measure-run.ts run <jobId> <script.ts> [args...]   set the command, redeploy, return (does not wait)
 *   npx tsx --env-file=.env scripts/railway-measure-run.ts status                     latest deployment: status, meta.commitHash
 *   npx tsx --env-file=.env scripts/railway-measure-run.ts logs [n]                   last n [measure-job] / script log lines (default 40)
 *   npx tsx --env-file=.env scripts/railway-measure-run.ts fetch <jobId> <file>       download measure/<jobId>/<file> from R2 into docs/census/
 *   npx tsx --env-file=.env scripts/railway-measure-run.ts park                       startCommand `true` again (stops compute)
 *   npx tsx --env-file=.env scripts/railway-measure-run.ts teardown                   delete the service
 *
 * Pattern copied from scripts/ingest/search/fts-railway-run.ts (project token via Project-Access-Token; serviceInstanceUpdate then redeploy).
 * Uses RAILWAY_API_TOKEN. Copies ONLY the named variables below onto the service. A deploy is proved by meta.commitHash, which `status` prints.
 */
import fs from 'fs'
import path from 'path'

const API = 'https://backboard.railway.com/graphql/v2'
const NAME = 'measure-job'
const REPO = 'Scrutinise/scrutinise-prototype'
const STATE = path.join(__dirname, `.${NAME}-service-id`)
// Secrets and endpoints the harness reads. Flags are NOT here: the job reads production's live flags from /api/health.
const COPY = ['DATABASE_URL', 'DIRECT_URL', 'GEMINI_API_KEY', 'GROK_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
  'CLOUDFLARE_R2_ACCOUNT_ID', 'CLOUDFLARE_R2_ACCESS_KEY_ID', 'CLOUDFLARE_R2_SECRET_ACCESS_KEY', 'CLOUDFLARE_R2_BUCKET_NAME',
  'FTS_SEARCH_URL', 'VECTOR_SEARCH_URL', 'LEX_VECTOR_STREAMS'] as const

async function gql<T = any>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const tok = process.env.RAILWAY_API_TOKEN ?? ''
  const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Project-Access-Token': tok }, body: JSON.stringify({ query, variables }) })
  const j = await res.json() as { data?: T; errors?: Array<{ message: string }> }
  if (j.errors?.length) throw new Error(JSON.stringify(j.errors.map((e) => e.message)))
  return j.data as T
}
const ids = async () => (await gql<{ projectToken: { projectId: string; environmentId: string } }>('{ projectToken { projectId environmentId } }')).projectToken
const serviceId = () => { if (!fs.existsSync(STATE)) throw new Error('no service recorded; run setup'); return fs.readFileSync(STATE, 'utf8').trim() }
const update = async (input: Record<string, unknown>) => {
  const { environmentId } = await ids()
  await gql(`mutation($s:String!,$e:String!,$i:ServiceInstanceUpdateInput!){ serviceInstanceUpdate(serviceId:$s, environmentId:$e, input:$i) }`, { s: serviceId(), e: environmentId, i: input })
}
async function latest() {
  const d = await gql(`query($s:String!){ deployments(first:1, input:{serviceId:$s}){ edges{ node{ id status createdAt meta } } } }`, { s: serviceId() })
  return d.deployments.edges[0]?.node
}

const [mode, ...args] = process.argv.slice(2)
async function main() {
  if (mode === 'setup') {
    const { projectId, environmentId } = await ids()
    const variables: Record<string, string> = {}
    for (const k of COPY) { const v = process.env[k]; if (v) variables[k] = v; else console.log(`  (not in .env, not copied: ${k})`) }
    // FTS_SEARCH_URL / VECTOR_SEARCH_URL are not in .env: the caller exports them for this one command (names only are checked here)
    console.log(`creating ${NAME} from ${REPO}@Main with ${Object.keys(variables).length} variables: ${Object.keys(variables).join(', ')}`)
    const c = await gql(`mutation($i:ServiceCreateInput!){ serviceCreate(input:$i){ id } }`, { i: { projectId, environmentId, name: NAME, branch: 'Main', source: { repo: REPO }, variables } })
    fs.writeFileSync(STATE, c.serviceCreate.id)
    // park BEFORE the first build finishes: `true`, never restart, and only rebuild for changes to this job's own files
    await update({ rootDirectory: 'scrutinise-web', builder: 'RAILPACK', startCommand: 'true', restartPolicyType: 'NEVER', numReplicas: 1,
      watchPatterns: ['scrutinise-web/scripts/railway-measure-job.ts'] })
    console.log(`service ${c.serviceCreate.id} created and parked. Run \`status\` until the first deployment settles.`)
  } else if (mode === 'run') {
    const [jobId, script, ...rest] = args
    if (!jobId || !script) throw new Error('run <jobId> <script.ts> [args...]')
    const cmd = `npx tsx --tsconfig tsconfig.json scripts/railway-measure-job.ts ${[jobId, script, ...rest].map((a) => `'${a.replace(/'/g, `'\\''`)}'`).join(' ')}`
    await update({ startCommand: `sh -c "${cmd.replace(/"/g, '\\"')}"`, restartPolicyType: 'NEVER' })
    const { environmentId } = await ids()
    await gql(`mutation($s:String!,$e:String!){ serviceInstanceRedeploy(serviceId:$s, environmentId:$e) }`, { s: serviceId(), e: environmentId })
    console.log(`redeploying with: ${cmd}\n(returns now; poll with status / logs; results land in R2 at measure/${jobId}/)`)
  } else if (mode === 'status') {
    const d = await latest(); console.log(d ? `${d.id.slice(0, 8)} ${d.status} ${d.createdAt} commit ${String(d.meta?.commitHash ?? '?').slice(0, 12)}` : 'no deployment')
  } else if (mode === 'logs') {
    const d = await latest(); if (!d) return console.log('no deployment')
    const l = await gql(`query($d:String!,$n:Int!){ deploymentLogs(deploymentId:$d, limit:$n){ timestamp message } }`, { d: d.id, n: 400 })
    const rows = (l.deploymentLogs as Array<{ timestamp: string; message: string }>).slice(-Number(args[0] ?? 40))
    console.log(`deployment ${d.id.slice(0, 8)} ${d.status}\n` + rows.map((r) => `${r.timestamp.slice(11, 19)} ${r.message.trimEnd().slice(0, 240)}`).join('\n'))
  } else if (mode === 'fetch') {
    const [jobId, file] = args
    const { r2Get } = await import('../lib/r2')
    const body = await r2Get(`measure/${jobId}/${file}`)
    if (body == null) throw new Error(`measure/${jobId}/${file} not found on R2`)
    const out = path.join(__dirname, '../../docs/census', file); fs.writeFileSync(out, body); console.log(`wrote ${out} (${body.length} bytes)`)
  } else if (mode === 'park') { await update({ startCommand: 'true', restartPolicyType: 'NEVER' }); console.log('parked') }
  else if (mode === 'teardown') { await gql(`mutation($id:String!){ serviceDelete(id:$id) }`, { id: serviceId() }); fs.unlinkSync(STATE); console.log('deleted') }
  else console.error('usage: setup | run <jobId> <script.ts> [args...] | status | logs [n] | fetch <jobId> <file> | park | teardown')
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
