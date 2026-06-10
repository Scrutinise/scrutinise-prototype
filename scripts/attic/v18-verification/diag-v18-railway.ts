/**
 * diag-v18-railway.ts — V18 §3 pre-flight (read-only):
 *  - Ingest service builder + config + latest deployment status
 *  - ingest_service_state heartbeat + queue pending (is the caselaw tail running?)
 *  - a sample committees-document row (for the curl test URL)
 *  - committees-document / committees-portal queue census
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from './shared/neon-pool'

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const INGEST_ID = 'a7f4d75f-d844-4e1c-8edf-2569346b31c9'

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

async function main() {
  const envId = process.env.ENV_ID ?? '991f733c-719c-4217-a6d6-1dbe80642bbe'

  const cfg = await gql<{ serviceInstance: Record<string, unknown> }>(
    `query($serviceId: String!, $environmentId: String!) {
      serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
        rootDirectory startCommand buildCommand builder restartPolicyType
      }
    }`,
    { serviceId: INGEST_ID, environmentId: envId },
  )
  console.log('Ingest serviceInstance:', JSON.stringify(cfg.serviceInstance, null, 2))

  const deps = await gql<{ deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string } }> } }>(
    `query($serviceId: String!) {
      deployments(first: 3, input: { serviceId: $serviceId }) {
        edges { node { id status createdAt } }
      }
    }`,
    { serviceId: INGEST_ID },
  )
  console.log('\nIngest deployments (latest 3):')
  for (const { node } of deps.deployments.edges) console.log(`  ${node.id}  ${node.status}  ${node.createdAt}`)

  const pool = getNeonPool()
  const hb = await pool.query(`SELECT * FROM ingest_service_state`)
  console.log('\ningest_service_state:', JSON.stringify(hb.rows))
  const q = await pool.query<{ status: string; n: string }>(
    `SELECT status, COUNT(*)::text AS n FROM ingest_queue WHERE corpus = 'tna-caselaw' GROUP BY status`
  )
  console.log('tna-caselaw queue:', q.rows.map(r => `${r.status}=${r.n}`).join('  ') || '(none)')
  const cs = await pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM corpus_sections WHERE corpus = 'tna-caselaw'`)
  console.log('tna-caselaw sections:', cs.rows[0].n)

  console.log('\ncommittees queue census:')
  const cq = await pool.query<{ corpus: string; status: string; n: string; err: string | null }>(`
    SELECT corpus, status, COUNT(*)::text AS n, (array_agg("lastError"))[1] AS err
    FROM ingest_queue
    WHERE "sourceType" IN ('committees-document', 'committees-portal')
    GROUP BY corpus, status ORDER BY corpus, status
  `)
  for (const r of cq.rows) console.log(`  ${r.corpus.padEnd(24)} ${r.status.padEnd(8)} ${r.n.padStart(6)}  ${String(r.err ?? '').slice(0, 60)}`)

  const sample = await pool.query(`
    SELECT id, "docId" FROM ingest_queue
    WHERE "sourceType" = 'committees-document' LIMIT 3
  `)
  console.log('\nsample committees-document rows:', JSON.stringify(sample.rows, null, 2))

  const docSections = await pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM corpus_sections WHERE corpus LIKE 'committees%'`
  )
  console.log('committees corpus_sections:', docSections.rows[0].n)

  await endNeonPool()
}
main().catch(e => { console.error(e); process.exit(1) })
