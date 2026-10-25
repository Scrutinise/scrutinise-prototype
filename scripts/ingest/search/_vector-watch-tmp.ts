// THROWAWAY watcher — one poll of the vector-build state on R2; prints DELTA lines only.
// Driven in a loop by the session Monitor. State between polls lives in the scratchpad.
import fs from 'fs'
import { r2Get } from '../shared/r2-client'

const STATE_PATH = process.env.WATCH_STATE_PATH ?? 'C:/Users/charl/AppData/Local/Temp/claude/C--Code-scrutinise-prototype/1d791a8c-233a-40c9-8774-9e7764635a39/scratchpad/vector-watch-state.json'
const HEARTBEAT_MS = 4 * 60 * 60 * 1000 // 4-hourly heartbeat for the multi-day batch haul

type State = { chunks?: any; vec?: any; logLen?: number; lastEmit?: number; sawDone?: boolean }

function load(): State { try { return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) } catch { return {} } }
function save(s: State) { fs.mkdirSync(require('path').dirname(STATE_PATH), { recursive: true }); fs.writeFileSync(STATE_PATH, JSON.stringify(s)) }

async function main() {
  const st = load()
  const out: string[] = []
  const now = Date.now()

  const chunksRaw = await r2Get('_search/corpus_chunks.checkpoint.json')
  const vecRaw = await r2Get('_search/corpus_vec.checkpoint.json')
  const tail = await r2Get('_search/hetzner-build.tail.log')

  // READ-BLIP GUARD: if the chunks checkpoint (known to exist once seen) reads null,
  // that's a transient R2/network failure on THIS side — do NOT update state or emit
  // phase-change deltas against nulls (caused the "phase → undefined" noise). Warn once
  // per blip streak, keep prior state, and let the next good poll resume deltas.
  if (!chunksRaw && st.chunks) {
    const streak = (((st as any).blipCount ?? 0) + 1); (st as any).blipCount = streak
    if (streak === 2) console.log('[watch] checkpoint reads failing locally (build state unknown; box likely fine — last good: ' + (st.chunks.sectionsWritten ?? 0).toLocaleString() + ' sections)')
    save(st)
    return
  }
  ;(st as any).blipCount = 0

  const chunks = chunksRaw ? JSON.parse(chunksRaw) : null
  const vec = vecRaw ? JSON.parse(vecRaw) : null

  // terminal / failure markers in the stdout tail (emit once)
  if (tail) {
    const t = tail.slice(-6000)
    if (!st.sawDone && /\[hetzner-build\] DONE|\[hetzner-build\] build exited code=/.test(t)) {
      const m = t.match(/\[hetzner-build\] build exited code=(\d+)/)
      out.push(`BUILD FINISHED on the box — exit code=${m ? m[1] : '?'} → run: hetzner-build-run.ts teardown`)
      st.sawDone = true
    }
    if (/FATAL/.test(t) && !(st as any).sawFatal) { out.push('FATAL seen in build log — inspect: hetzner-build-run.ts logs'); (st as any).sawFatal = true }
  }

  // phase / progress deltas
  const cPhase = chunks?.phase, cN = chunks?.sectionsWritten ?? 0
  const vPhase = vec?.phase, vShards = vec?.doneShards?.length ?? 0, vN = vec?.vectors ?? 0
  const prevC = st.chunks ?? {}, prevV = st.vec ?? {}
  if (cPhase !== prevC.phase) out.push(`chunks phase → ${cPhase} (${cN.toLocaleString()} sections, ${(chunks?.chunksWritten ?? 0).toLocaleString()} chunks, misses=${chunks?.bodyMisses})`)
  if (vPhase !== prevV.phase) out.push(`vectors phase → ${vPhase} (${vShards} shards, ${vN.toLocaleString()} vectors, misses=${vec?.misses})`)

  // stall detection: chunking active but cursor unmoved for 2 polls (~10 min+)
  if (cPhase === 'chunking' && prevC.phase === 'chunking' && chunks?.lastId === prevC.lastId && (st as any).stallCount >= 1 && !(st as any).stallWarned) {
    out.push(`possible STALL: chunks cursor unmoved since last poll (${cN.toLocaleString()} sections, lastId=${chunks?.lastId}) — check logs`)
    ;(st as any).stallWarned = true
  }
  ;(st as any).stallCount = (cPhase === 'chunking' && chunks?.lastId === prevC.lastId) ? (((st as any).stallCount ?? 0) + 1) : 0
  if (chunks?.lastId !== prevC.lastId) (st as any).stallWarned = false

  // est NEW sync spend by CALL accounting (vectors×310 was 2.5× low in dense regions):
  // every sync call is ~17.5k est tok (both pack caps land there) → $0.002625/call.
  // done shards use their observed per-shard call TOTAL (from "[sync] shard-N: X/TOTAL"
  // lines, persisted), else the rolling average; in-flight shards use max calls seen.
  const totals: Record<string, number> = (st as any).shardTotals ?? {}
  const inflight: Record<string, number> = {}
  if (tail) {
    for (const mt of tail.matchAll(/\[sync\] (shard-\d+): (\d+)\/(\d+) calls/g)) {
      const [, tag, callsS, totalS] = mt
      totals[tag] = parseInt(totalS, 10)
      inflight[tag] = Math.max(inflight[tag] ?? 0, parseInt(callsS, 10))
    }
  }
  ;(st as any).shardTotals = totals
  const knownTotals = Object.values(totals)
  const avgCallsPerShard = knownTotals.length ? knownTotals.reduce((a, b) => a + b, 0) / knownTotals.length : 515
  const doneSet = new Set<number>(vec?.doneShards ?? [])
  let doneCalls = 0
  for (const i of doneSet) { const tag = `shard-${String(i).padStart(6, '0')}`; doneCalls += totals[tag] ?? avgCallsPerShard }
  let inflightCalls = 0
  for (const [tag, c] of Object.entries(inflight)) { if (!doneSet.has(parseInt(tag.slice(6), 10))) inflightCalls += c }
  const estSpend = (doneCalls + inflightCalls) * 0.002625
  // spend milestones (once each): $50 ≈ probe-worthy if the $36 counts is wrong, $64 = expected
  // crossing (existing $36 counts), $100 = crossing even if it doesn't
  const flagged: number[] = (st as any).spendFlagged ?? []
  for (const m of [50, 64, 80, 100]) {
    if (estSpend >= m && !flagged.includes(m)) {
      flagged.push(m)
      out.push(`est sync spend crossed ~$${m} (${vN.toLocaleString()} vectors) — check billing console; if total ≥ $100 run: npx tsx search/gemini-tier-probe.ts`)
    }
  }
  ;(st as any).spendFlagged = flagged

  // hourly heartbeat
  if (!out.length && now - (st.lastEmit ?? 0) > HEARTBEAT_MS) {
    out.push(`heartbeat: chunks=${cPhase ?? '(none)'} ${cN.toLocaleString()} sections / ${(chunks?.chunksWritten ?? 0).toLocaleString()} chunks | vec=${vPhase ?? '(none)'} ${vShards} shards / ${vN.toLocaleString()} vectors (~$${estSpend.toFixed(2)} est new sync spend)`)
  }

  if (out.length) { st.lastEmit = now; for (const l of out) console.log(l) }
  st.chunks = chunks; st.vec = vec; st.logLen = tail?.length ?? 0
  save(st)
}
main().catch((e) => console.log('[watch] poll error:', (e as Error).message))
