/**
 * fts-watch.ts — background watcher for the full FTS build. Polls the R2 checkpoint
 * every 3 min; logs rows + instantaneous rows/s each tick. Exits (notifying the
 * caller) when:
 *   - phase=done  → fetches the Railway logs, prints "FTS index built in Xs" + final
 *                   row count (the index-build measurement we want). exit 0.
 *   - stalled     → checkpoint updatedAt older than 12 min while not done. exit 2.
 *   - safety cap  → ~16h elapsed. exit 3.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../scrutinise-web/.env') }) } catch {}
const fs = require('fs') as typeof import('fs')
import { r2Get } from './shared/r2-client'

const RAILWAY_API = 'https://backboard.railway.com/graphql/v2'
const SERVICE_ID = fs.readFileSync(path.join(__dirname, 'search/.fts-build-service-id'), 'utf8').trim()
const CHECKPOINT = '_search/corpus_fts.checkpoint.json'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(RAILWAY_API, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RAILWAY_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  const d = await res.json() as { data?: T }
  return d.data as T
}

async function indexLogs(): Promise<string[]> {
  const dep = await gql<{ deployments: { edges: Array<{ node: { id: string } }> } }>(
    `query($s:String!){ deployments(first:1,input:{serviceId:$s}){ edges{ node{ id } } } }`, { s: SERVICE_ID })
  const id = dep.deployments.edges[0]?.node.id
  if (!id) return []
  const l = await gql<{ deploymentLogs: Array<{ message: string }> }>(
    `query($d:String!,$n:Int!){ deploymentLogs(deploymentId:$d,limit:$n){ message } }`, { d: id, n: 100 })
  return l.deploymentLogs.map(r => r.message).filter(m => m.includes('[fts-index]'))
}

async function main() {
  const t0 = Date.now()
  let prevRows = 0, prevT = Date.now()
  for (let i = 0; Date.now() - t0 < 16 * 3600_000; i++) {
    const raw = await r2Get(CHECKPOINT)
    if (raw) {
      const cp = JSON.parse(raw) as { phase: string; rowsWritten: number; updatedAt: string; lastId: string }
      const ageMin = (Date.now() - new Date(cp.updatedAt).getTime()) / 60000
      const dt = (Date.now() - prevT) / 1000
      const rate = i === 0 ? 0 : (cp.rowsWritten - prevRows) / Math.max(dt, 1)
      console.log(`[watch ${new Date().toISOString().slice(11, 19)}Z] phase=${cp.phase} rows=${cp.rowsWritten} ~${rate.toFixed(0)}/s cpAge=${ageMin.toFixed(1)}m last=${cp.lastId.slice(0, 60)}`)
      prevRows = cp.rowsWritten; prevT = Date.now()

      if (cp.phase === 'done') {
        console.log('\n>>> BUILD DONE. fts-index log tail:')
        ;(await indexLogs()).slice(-12).forEach(m => console.log('  ' + m))
        process.exit(0)
      }
      if (ageMin > 12 && cp.phase !== 'indexing') {
        console.log(`\n>>> STALL: checkpoint not advanced for ${ageMin.toFixed(1)} min (phase=${cp.phase}). Investigate.`)
        ;(await indexLogs()).slice(-8).forEach(m => console.log('  ' + m))
        process.exit(2)
      }
    } else {
      console.log(`[watch] checkpoint absent`)
    }
    await sleep(180_000)
  }
  console.log('>>> watcher 16h cap reached — exiting'); process.exit(3)
}
main().catch(e => { console.error('watch error', e); process.exit(1) })
