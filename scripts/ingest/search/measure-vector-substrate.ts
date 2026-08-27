/**
 * measure-vector-substrate.ts — S15-CAPACITY §1, hypotheses H2/H3/H4.
 *
 * "Nobody has ever measured what one dense query costs us. Not the time, not the dominant stage,
 *  not the memory, not the bytes moved. Every capacity decision on this service rests on an
 *  unmeasured number. That is the actual defect."
 *
 * This is that measurement. Four questions, each with a decisive test:
 *
 *   H3  How big is the index on disk, and is it compressed or partitioned?
 *       → list the Lance dataset's own objects in R2 and sum them; read the IVF_PQ parameters
 *         off the index itself. 22.7M x 768 x f32 is 69.7 GB uncompressed; what is it really?
 *
 *   H4  Where does a query READ FROM, and how many bytes?
 *       → the decisive one. `lance.ts` opens s3://{bucket}/_search with no local cache
 *         directory, so if the answer is "R2, per query", more CPU and more RAM buy nothing and
 *         replicas MULTIPLY the cost. Measured by counting R2 GET traffic across a controlled
 *         window of queries, from Railway's own network counter rather than inferred.
 *
 *   H2  Is the box actually busy? → the container's vCPU LIMIT (not os.cpus(), which reports the
 *         host) beside the process CPU actually burned per wall-second.
 *
 * ⚠ os.cpus().length ON RAILWAY REPORTS THE HOST, NOT THE CGROUP QUOTA. /stats says 48; the
 * service is on a Hobby plan and certainly does not have 48. Reading the host and calling it our
 * capacity is exactly the "a number nobody measured" defect this sprint exists to remove, so the
 * limit is read from Railway's own CPU_LIMIT metric.
 *
 * Usage:
 *   tsx search/measure-vector-substrate.ts [--queries=20]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { connectLance } from './lance'
import { CHUNKS_TABLE, VEC_TABLE } from './vector-common'

const BASE = (process.env.VECTOR_SEARCH_URL ?? 'https://vector-serve-production.up.railway.app').replace(/\/$/, '')
const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const PROJECT_ID = process.env.RAILWAY_PROJECT_ID ?? '68707c61-5c68-4f37-88fc-c301fd6b90e7'
const arg = (k: string, d: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d
const QUERIES = parseInt(arg('queries', '20'), 10)

const fs = require('fs') as typeof import('fs')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const gb = (b: number) => (b / 1024 / 1024 / 1024).toFixed(2)
const mb = (b: number) => (b / 1024 / 1024).toFixed(1)

function auth(): Record<string, string> {
  const t = process.env.RAILWAY_API_TOKEN ?? ''
  return /^[0-9a-f-]{36}$/i.test(t) ? { 'Project-Access-Token': t } : { Authorization: `Bearer ${t}` }
}
async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const r = await fetch(RAILWAY_API, { method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) })
  const j = await r.json() as any
  if (j.errors?.length) throw new Error(JSON.stringify(j.errors))
  return j.data
}

function s3(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
  })
}

/** Sum every object under a prefix, bucketed by the Lance directory that holds it. */
async function measurePrefix(client: S3Client, bucket: string, prefix: string) {
  let token: string | undefined
  let total = 0
  let count = 0
  const byDir = new Map<string, { bytes: number; n: number }>()
  do {
    const out = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000 }))
    for (const o of out.Contents ?? []) {
      const size = o.Size ?? 0
      total += size; count++
      // e.g. _search/corpus_vec.lance/_indices/<uuid>/... → "_indices"
      const rest = (o.Key ?? '').slice(prefix.length).replace(/^\//, '')
      const dir = rest.split('/')[0] || '(root)'
      const cur = byDir.get(dir) ?? { bytes: 0, n: 0 }
      cur.bytes += size; cur.n++
      byDir.set(dir, cur)
    }
    token = out.IsTruncated ? out.NextContinuationToken : undefined
  } while (token)
  return { total, count, byDir }
}

async function main() {
  const bucket = process.env.CLOUDFLARE_R2_BUCKET_NAME ?? 'scrutinise-legislation'
  const client = s3()

  console.log('══ H3 — HOW BIG IS THE INDEX, AND IS IT COMPRESSED? ══\n')
  const rows = 22_670_808
  const uncompressed = rows * 768 * 4
  console.log(`  ${rows.toLocaleString()} vectors x 768 dims x 4 bytes (f32) = ${gb(uncompressed)} GB UNCOMPRESSED`)
  console.log(`  (the brief's arithmetic: "roughly 70 GB". What is actually stored:)\n`)

  for (const table of [VEC_TABLE, CHUNKS_TABLE]) {
    const prefix = `_search/${table}.lance`
    const m = await measurePrefix(client, bucket, prefix)
    console.log(`  s3://${bucket}/${prefix}`)
    console.log(`    ${m.count.toLocaleString()} objects · ${gb(m.total)} GB total`)
    for (const [dir, v] of [...m.byDir.entries()].sort((a, b) => b[1].bytes - a[1].bytes)) {
      console.log(`      ${dir.padEnd(16)} ${gb(v.bytes).padStart(8)} GB  (${v.n.toLocaleString()} objects)`)
    }
    if (table === VEC_TABLE) {
      const ratio = uncompressed / m.total
      console.log(`    ⚠ COMPRESSION vs raw f32: ${ratio.toFixed(1)}x  → ${(m.total / rows).toFixed(0)} bytes per vector, against 3,072 raw`)
    }
    console.log('')
  }

  // The index's own parameters, read off the index rather than assumed.
  const conn = await connectLance()
  const vecTbl = await conn.openTable(VEC_TABLE)
  const idx = await (vecTbl as any).listIndices()
  for (const i of idx) {
    const s = await (vecTbl as any).indexStats(i.name)
    console.log(`  index ${i.name}: ${JSON.stringify(s)}`)
    console.log(`  ⚠ IVF_PQ = INVERTED FILE + PRODUCT QUANTISATION: partitioned into IVF lists (nprobes`)
    console.log(`     decides how many are read per query) and each vector lossily compressed. Both`)
    console.log(`     matter here — partitioning is why a query need not read the whole index.`)
  }

  console.log('\n══ H2 — IS THE BOX ACTUALLY BUSY? ══\n')
  const s0 = await (await fetch(`${BASE}/stats`)).json() as any
  console.log(`  os.cpus() inside the container: ${s0.host.cpus}   ⚠ THIS IS THE HOST, NOT OUR QUOTA`)
  console.log(`  loadavg: ${JSON.stringify(s0.host.loadavg)}   (also the host's — 48 cores' worth of other tenants)`)
  console.log(`  process CPU per wall-second (cpu_over_wall, since boot): ${s0.stages.cpu_over_wall}`)

  // The real quota, from Railway's own metric.
  const now = new Date()
  const start = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  try {
    const lim = await gql<any>(
      `query($projectId: String!, $startDate: DateTime!, $endDate: DateTime!, $ms: [MetricMeasurement!]!) {
         metrics(projectId: $projectId, startDate: $startDate, endDate: $endDate, measurements: $ms,
                 groupBy: [SERVICE_ID], sampleRateSeconds: 300) {
           measurement values { ts value } tags { serviceId }
         }
       }`,
      { projectId: PROJECT_ID, startDate: start, endDate: now.toISOString(), ms: ['CPU_LIMIT', 'CPU_USAGE', 'MEMORY_LIMIT_GB', 'MEMORY_USAGE_GB'] },
    )
    const svcId = fs.readFileSync(path.join(__dirname, '.vector-serve-service-id'), 'utf8').trim()
    for (const m of lim.metrics ?? []) {
      if (m.tags?.serviceId !== svcId) continue
      const vals = (m.values ?? []).map((v: any) => v.value).filter((v: number) => v != null)
      if (!vals.length) continue
      const max = Math.max(...vals)
      const mean = vals.reduce((a: number, b: number) => a + b, 0) / vals.length
      console.log(`  ${String(m.measurement).padEnd(18)} max ${max.toFixed(3)} · mean ${mean.toFixed(3)}  (last hour, ${vals.length} samples)`)
    }
  } catch (e) { console.log(`  ⚠ Railway metrics unavailable: ${(e as Error).message}`) }

  console.log('\n══ H4 — WHERE DOES A QUERY READ FROM, AND HOW MANY BYTES? ══\n')
  console.log(`  storage: ${'s3://' + bucket + '/_search'} — object storage, opened with NO local cache directory.`)
  console.log(`  (lance.ts::connectLance passes storageOptions only; there is no cache_dir, no volume mount.)`)
  console.log(`\n  Measuring bytes per query from Railway's own ingress counter across ${QUERIES} queries…`)

  const netBefore = await networkRx()
  const t0 = Date.now()
  let ok = 0
  for (let i = 0; i < QUERIES; i++) {
    const res = await fetch(`${BASE}/vector-search`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: `substrate byte probe ${i} statutory duty compensation appeal notice`, tier: ['legislation', 'caselaw', 'guidance'][i % 3], limit: 60, noCache: true }),
    })
    if (res.ok) ok++
    await res.text()
  }
  const wall = Date.now() - t0
  console.log(`  ${ok}/${QUERIES} queries in ${(wall / 1000).toFixed(1)}s. Waiting 180s for the metric to settle…`)
  await sleep(180_000)
  const netAfter = await networkRx()

  if (netBefore != null && netAfter != null) {
    const deltaGb = netAfter - netBefore
    console.log(`\n  NETWORK_RX over the window: ${netBefore.toFixed(4)} → ${netAfter.toFixed(4)} (delta ${deltaGb.toFixed(4)})`)
    if (deltaGb > 0) {
      const perQuery = (deltaGb * 1024) / ok
      console.log(`  ⚠ ${perQuery.toFixed(1)} MB INGRESS PER QUERY, pulled from R2.`)
      console.log(`     At ${ok} queries that is ${(deltaGb * 1024).toFixed(0)} MB. Nothing else talks to this service.`)
    } else {
      console.log('  ⚠ delta is zero or negative — the metric had not settled, or the unit is not what was assumed.')
      console.log('     Reported as UNMEASURED rather than as "no traffic".')
    }
  }

  const s1 = await (await fetch(`${BASE}/stats`)).json() as any
  console.log(`\n  stages p50 after the probe: ann ${s1.stages.ann_p50_ms} · snippet ${s1.stages.snippet_p50_ms} · cpu ${s1.stages.cpu_p50_ms}`)
  console.log(`  cpu_over_wall ${s1.stages.cpu_over_wall}`)
  console.log(`  peak rss ${s1.memory.peak_rss_mb} MB of ${s1.memory.cap_mb} MB cap (${s1.memory.peak_pct_of_cap}%)`)
}

/** Month-to-date NETWORK_RX_GB for vector-serve, from Railway's usage API. */
async function networkRx(): Promise<number | null> {
  try {
    const now = new Date()
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    const svcId = fs.readFileSync(path.join(__dirname, '.vector-serve-service-id'), 'utf8').trim()
    const u = await gql<any>(
      `query($projectId: String!, $startDate: DateTime!, $endDate: DateTime!, $ms: [MetricMeasurement!]!) {
         usage(projectId: $projectId, startDate: $startDate, endDate: $endDate, measurements: $ms,
               groupBy: [SERVICE_ID], includeDeleted: true) { measurement value tags { serviceId } }
       }`,
      { projectId: PROJECT_ID, startDate: start, endDate: now.toISOString(), ms: ['NETWORK_RX_GB'] },
    )
    const row = (u.usage ?? []).find((r: any) => r.tags?.serviceId === svcId)
    return row?.value ?? null
  } catch { return null }
}

main().catch((e) => { console.error('FAILED', e instanceof Error ? e.message : e); process.exit(1) })
