// ─────────────────────────────────────────────────────────────────────────────
// The real cold start for BOTH search services, from one silent window.
//
// ⚠⚠ NOTHING MAY TOUCH EITHER SERVICE WHILE THIS RUNS. Railway's app sleeping triggers on
// an absence of inbound requests, so a single `curl` — mine, a browser tab left open on the
// ideas hub, anything — resets the idle timer and the measurement silently becomes a warm
// one. That has now happened twice: once from a poller inside the script, and once from me
// checking by hand while the script waited.
//
// ⚠ THE ORDER IS DELIBERATE. `fts-serve` is measured first, which wakes it; `vector-serve`
// stays untouched throughout that, so its own measurement is still from cold. One wait, two
// honest figures.
//
//   tsx ops/measure-both-wakes.ts [quietMinutes]
// ─────────────────────────────────────────────────────────────────────────────

import { SERVICES, instanceState } from './sleep-state'

const PROBE = {
  'fts-serve': { path: '/fts-search', body: { query: 'accountability', limit: 3 } },
  'vector-serve': { path: '/vector-search', body: { query: 'accountability', limit: 3 } },
} as const

type Name = keyof typeof PROBE

async function timeFirstQuery(name: Name, url: string) {
  const p = PROBE[name]
  const t0 = Date.now()
  const res = await fetch(`${url}${p.path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(p.body),
    signal: AbortSignal.timeout(120_000),
  }).catch((e) => { console.log(`${name}: first query THREW after ${Date.now() - t0} ms — ${e.message}`); return null })
  const ms = Date.now() - t0
  if (!res) return

  if (ms < 3_000) {
    console.log(`${name}: ${(ms / 1000).toFixed(1)} s — STILL AWAKE, not a cold start.`)
    return
  }
  console.log(`${name}: COLD START ${(ms / 1000).toFixed(1)} s (HTTP ${res.status})`)
  console.log(`   against the 75 s budget: ${ms < 75_000
    ? `✓ ${((75_000 - ms) / 1000).toFixed(0)} s of headroom`
    : '✗ OVER BUDGET — raise it'}`)

  const w = Date.now()
  await fetch(`${url}${p.path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(p.body), signal: AbortSignal.timeout(60_000),
  }).catch(() => null)
  console.log(`${name}: warm, for comparison: ${((Date.now() - w) / 1000).toFixed(1)} s`)
}

async function main() {
  const quietMin = Number(process.argv[2] ?? 30)
  const urls: Record<Name, string> = {} as never
  for (const n of ['fts-serve', 'vector-serve'] as Name[]) {
    const st = await instanceState(SERVICES[n])
    if (!st.sleepApplication) { console.log(`⚠ ${n}: sleep is OFF — nothing to measure`); return }
    urls[n] = `https://${st.domains[0]}`
  }

  console.log(`waiting ${quietMin} min in complete silence. NOTHING may touch either service.`)
  console.log(`(started ${new Date().toISOString()})`)
  await new Promise((r) => setTimeout(r, quietMin * 60_000))
  console.log(`(silence ended ${new Date().toISOString()})\n`)

  // fts first — waking it leaves vector still cold.
  await timeFirstQuery('fts-serve', urls['fts-serve'])
  console.log('')
  await timeFirstQuery('vector-serve', urls['vector-serve'])
}

if (require.main === module) {
  main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1 })
}
