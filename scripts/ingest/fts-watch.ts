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
// FTS_SERVICE selects which service to watch (default fts-build, the real
// corpus_fts index build). The fts-pilot positions track was stood down
// (2026-06-21); checkpoint key is overridable via FTS_CHECKPOINT_KEY.
const FTS_SERVICE = process.env.FTS_SERVICE ?? 'fts-build'
const SERVICE_ID = fs.readFileSync(path.join(__dirname, `search/.${FTS_SERVICE}-service-id`), 'utf8').trim()
const CHECKPOINT = process.env.FTS_CHECKPOINT_KEY ?? '_search/corpus_fts.checkpoint.json'
// Loading-stall threshold. The real index build checkpoints every batch (12 min is
// plenty), but the pilot checkpoints only ONCE PER MERGE (a 400k chunk load + optimize
// can exceed 12 min, and grows), so set FTS_STALL_MIN higher when watching the pilot.
const STALL_MIN = parseInt(process.env.FTS_STALL_MIN ?? '12', 10)
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

async function latestDeployment(): Promise<{ id: string; status: string } | null> {
  const d = await gql<{ deployments: { edges: Array<{ node: { id: string; status: string } }> } }>(
    `query($s:String!){ deployments(first:1,input:{serviceId:$s}){ edges{ node{ id status } } } }`, { s: SERVICE_ID })
  return d.deployments.edges[0]?.node ?? null
}

async function depLogs(id: string): Promise<string[]> {
  const l = await gql<{ deploymentLogs: Array<{ message: string }> }>(
    `query($d:String!,$n:Int!){ deploymentLogs(deploymentId:$d,limit:$n){ message } }`, { d: id, n: 150 })
  return l.deploymentLogs.map(r => r.message)
}

async function main() {
  const t0 = Date.now()
  let prevRows = 0, prevT = Date.now()
  for (let i = 0; Date.now() - t0 < 16 * 3600_000; i++) {
    const raw = await r2Get(CHECKPOINT)
    const dep = await latestDeployment()
    if (raw) {
      const cp = JSON.parse(raw) as { phase: string; rowsWritten: number; updatedAt: string; lastId: string }
      const ageMin = (Date.now() - new Date(cp.updatedAt).getTime()) / 60000
      const dt = (Date.now() - prevT) / 1000
      const rate = i === 0 ? 0 : (cp.rowsWritten - prevRows) / Math.max(dt, 1)
      console.log(`[watch ${new Date().toISOString().slice(11, 19)}Z] phase=${cp.phase} rows=${cp.rowsWritten} ~${rate.toFixed(0)}/s cpAge=${ageMin.toFixed(1)}m dep=${dep?.status ?? '?'} last=${cp.lastId.slice(0, 56)}`)
      prevRows = cp.rowsWritten; prevT = Date.now()

      if (cp.phase === 'done') {
        console.log('\n>>> BUILD DONE. fts-index log tail:')
        if (dep) (await depLogs(dep.id)).filter(m => m.includes('[fts-index]')).slice(-12).forEach(m => console.log('  ' + m))
        process.exit(0)
      }
      // CRASH detection — works in ANY phase, incl. indexing (which writes no
      // checkpoint, so the cpAge stall check alone is blind to an OOM there).
      if (dep && (dep.status === 'CRASHED' || dep.status === 'FAILED')) {
        console.log(`\n>>> CRASH: deployment ${dep.id.slice(0, 8)} status=${dep.status} (phase=${cp.phase}, rows=${cp.rowsWritten}). Likely OOM at the index build — investigate.`)
        ;(await depLogs(dep.id)).slice(-15).forEach(m => console.log('  ' + m))
        process.exit(2)
      }
      // INDEX RESTART-LOOP detection: during indexing the checkpoint is frozen, but a
      // repeating "building … index" banner means it is OOM-restart-looping.
      if (cp.phase === 'indexing' && dep) {
        const banners = (await depLogs(dep.id)).filter(m => m.includes('building native FTS inverted index')).length
        if (banners >= 2) {
          console.log(`\n>>> INDEX RESTART-LOOP: "building … index" seen ${banners}× on one deployment — OOM loop. Investigate.`)
          process.exit(2)
        }
      }
      // Loading-phase stall (indexing legitimately freezes the checkpoint, so exclude it).
      if (ageMin > STALL_MIN && cp.phase === 'loading') {
        console.log(`\n>>> STALL: checkpoint not advanced for ${ageMin.toFixed(1)} min (phase=loading, threshold ${STALL_MIN}m). Investigate.`)
        if (dep) (await depLogs(dep.id)).slice(-8).forEach(m => console.log('  ' + m))
        process.exit(2)
      }
    } else {
      console.log(`[watch] checkpoint absent (dep=${dep?.status ?? '?'})`)
    }
    await sleep(180_000)
  }
  console.log('>>> watcher 16h cap reached — exiting'); process.exit(3)
}
main().catch(e => { console.error('watch error', e); process.exit(1) })
