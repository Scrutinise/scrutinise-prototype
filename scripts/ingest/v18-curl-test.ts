/**
 * v18-curl-test.ts — V18 §3: install curl in the Ingest container (Railpack
 * builder → RAILPACK_DEPLOY_APT_PACKAGES) and test Cloudflare access to
 * committees.parliament.uk / publications.parliament.uk FROM Railway's IP —
 * never testable before because the container had no curl.
 *
 * Mechanism (no mid-sprint git push needed):
 *   1. serviceInstanceUpdate: startCommand → one-shot curl test (records orig)
 *   2. variableUpsert RAILPACK_DEPLOY_APT_PACKAGES=curl → auto-deploys
 *   3. poll deployment → SUCCESS, wait for test output, print logs
 *   4. restore startCommand `npm run worker` + redeploy (pool exits on empty)
 *
 * Usage:
 *   tsx v18-curl-test.ts run       — steps 1–3
 *   tsx v18-curl-test.ts restore   — step 4
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const INGEST_ID = 'a7f4d75f-d844-4e1c-8edf-2569346b31c9'
const ENV_ID = process.env.ENV_ID ?? '991f733c-719c-4217-a6d6-1dbe80642bbe'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const URLS = [
  'https://committees.parliament.uk/publications/reports-responses/?page=1',
  'https://committees.parliament.uk/publications/other-publications/?page=1',
  'https://publications.parliament.uk/pa/cm5901/cmselect/cmspeak/498/report.html',
]
const TEST_CMD =
  `sh -c 'echo CURL_TEST_START; curl --version | head -1; ` +
  URLS.map(u =>
    `echo "TEST ${u}"; curl -sS -o /tmp/page.html -w "HTTP_CODE=%{http_code} SIZE=%{size_download}" --max-time 30 -A "${UA}" "${u}" || echo CURL_FAILED; echo; head -c 200 /tmp/page.html; echo; echo ---; sleep 2; `
  ).join('') +
  `echo CURL_TEST_COMPLETE; sleep 120'`

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RAILWAY_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const data = await res.json() as { data?: T; errors?: Array<{ message: string }> }
  if (data.errors?.length) throw new Error(JSON.stringify(data.errors))
  return data.data as T
}

async function setStartCommand(cmd: string): Promise<void> {
  await gql(
    `mutation($serviceId: String!, $environmentId: String!, $input: ServiceInstanceUpdateInput!) {
      serviceInstanceUpdate(serviceId: $serviceId, environmentId: $environmentId, input: $input)
    }`,
    { serviceId: INGEST_ID, environmentId: ENV_ID, input: { startCommand: cmd } },
  )
}

async function redeploy(): Promise<void> {
  await gql(
    `mutation($serviceId: String!, $environmentId: String!) {
      serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId)
    }`,
    { serviceId: INGEST_ID, environmentId: ENV_ID },
  )
}

async function latestDeployment(): Promise<{ id: string; status: string; createdAt: string }> {
  const d = await gql<{ deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string } }> } }>(
    `query($serviceId: String!) {
      deployments(first: 1, input: { serviceId: $serviceId }) { edges { node { id status createdAt } } }
    }`,
    { serviceId: INGEST_ID },
  )
  return d.deployments.edges[0].node
}

async function printLogs(deploymentId: string): Promise<string> {
  const l = await gql<{ deploymentLogs: Array<{ timestamp: string; message: string }> }>(
    `query($deploymentId: String!, $limit: Int!) {
      deploymentLogs(deploymentId: $deploymentId, limit: $limit) { timestamp message }
    }`,
    { deploymentId, limit: 200 },
  )
  const text = l.deploymentLogs.map(r => r.message).join('\n')
  console.log(text)
  return text
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function run() {
  console.log('1. setting test startCommand')
  await setStartCommand(TEST_CMD)

  console.log('2. setting RAILPACK_DEPLOY_APT_PACKAGES=curl (auto-deploys)')
  await gql(
    `mutation($input: VariableUpsertInput!) { variableUpsert(input: $input) }`,
    { input: { projectId: process.env.RAILWAY_PROJECT_ID, environmentId: ENV_ID, serviceId: INGEST_ID, name: 'RAILPACK_DEPLOY_APT_PACKAGES', value: 'curl' } },
  )
  await sleep(10_000)
  // make sure a deploy is actually building the new config
  let dep = await latestDeployment()
  const before = new Date(dep.createdAt).getTime()
  if (Date.now() - before > 60_000) {
    console.log('   no auto-deploy detected — triggering serviceInstanceRedeploy')
    await redeploy()
  }

  console.log('3. polling for deployment SUCCESS (build + apt install, ~2-5 min)')
  for (let i = 0; i < 40; i++) {
    await sleep(15_000)
    dep = await latestDeployment()
    console.log(`   ${dep.id.slice(0, 8)}  ${dep.status}  ${dep.createdAt}`)
    if (dep.status === 'SUCCESS' || dep.status === 'CRASHED' || dep.status === 'FAILED') break
  }

  console.log('4. waiting 45s for test output, then logs:')
  await sleep(45_000)
  const text = await printLogs(dep.id)
  if (!text.includes('CURL_TEST_COMPLETE')) {
    console.log('\n(test may still be running — re-run logs with: tsx v18-curl-test.ts logs)')
  }
  console.log('\nNOW RUN: tsx v18-curl-test.ts restore')
}

async function restore() {
  console.log('restoring startCommand to "npm run worker" + redeploy')
  await setStartCommand('npm run worker')
  await redeploy()
  for (let i = 0; i < 30; i++) {
    await sleep(15_000)
    const dep = await latestDeployment()
    console.log(`   ${dep.id.slice(0, 8)}  ${dep.status}`)
    if (dep.status === 'SUCCESS') break
  }
  console.log('restored.')
}

async function logs() {
  const dep = await latestDeployment()
  console.log(`latest deployment ${dep.id} (${dep.status})`)
  await printLogs(dep.id)
}

const mode = process.argv[2] ?? 'run'
const fn = mode === 'restore' ? restore : mode === 'logs' ? logs : run
fn().catch(e => { console.error(e); process.exit(1) })
