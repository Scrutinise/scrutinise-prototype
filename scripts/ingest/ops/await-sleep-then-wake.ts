// ─────────────────────────────────────────────────────────────────────────────
// Wait for a service to actually doze off, then time the FIRST REAL QUERY.
//
// ⚠⚠ THIS IS THE ONLY HONEST COLD-START FIGURE. `--restart` measures a container
// restarting, which is a proxy; this measures what a user actually experiences — Railway
// scheduling a container that is not running, the process booting, and the index paging in
// from R2 before a search can be answered.
//
// ⚠ "ASLEEP" IS OBSERVED, NOT ASSUMED FROM A CLOCK. The script polls until the service
// stops answering. Timing a wake on a service that never went to sleep would report a warm
// query and call it a cold start — a measurement that measured nothing, reported as a
// reassuringly small number.
//
//   tsx ops/await-sleep-then-wake.ts fts-serve
// ─────────────────────────────────────────────────────────────────────────────

import { SERVICES, instanceState } from './sleep-state'

type Name = keyof typeof SERVICES

const PROBE: Record<string, { path: string; body: unknown }> = {
  'fts-serve': { path: '/fts-search', body: { query: 'accountability', limit: 3 } },
  'vector-serve': { path: '/vector-search', body: { query: 'accountability', limit: 3 } },
}

async function main() {
  const name = process.argv[2] as Name
  const waitBudgetMs = Number(process.argv[3] ?? 1_800_000)
  if (!name || !(name in SERVICES)) {
    console.error(`usage: await-sleep-then-wake.ts <fts-serve|vector-serve> [waitMs]`)
    process.exitCode = 1
    return
  }
  const st = await instanceState(SERVICES[name])
  if (!st.sleepApplication) {
    console.log(`⚠ ${name}: sleepApplication is FALSE. It will never doze; nothing to measure.`)
    process.exitCode = 1
    return
  }
  const url = `https://${st.domains[0]}`
  const probe = PROBE[name]

  // ── 1. wait in SILENCE ────────────────────────────────────────────────
  //
  // ⚠⚠ THE FIRST VERSION POLLED `/health` EVERY 15 SECONDS AND THEREFORE NEVER SLEPT.
  //
  // Railway's app sleeping triggers on an absence of INBOUND REQUESTS. A poller checking
  // "has it gone to sleep yet?" is itself inbound traffic, so it held both services awake
  // for the entire wait and then reported that they had not dozed — a measurement that
  // prevented the thing it was measuring, and which would have been read as "sleep is not
  // working on this plan".
  //
  // So this waits without touching the service at all. The only request it makes is the one
  // being timed.
  const quietMs = Math.min(waitBudgetMs, 15 * 60_000)
  console.log(`${name}: waiting ${Math.round(quietMs / 60000)} min in silence — NOT polling, that is what keeps it awake.`)
  await new Promise((r) => setTimeout(r, quietMs))

  // ── 2. one real query, timed ──────────────────────────────────────────
  const w0 = Date.now()
  const res = await fetch(`${url}${probe.path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(probe.body),
    signal: AbortSignal.timeout(120_000),
  }).catch((e) => { console.log(`  first query threw after ${Date.now() - w0} ms: ${e.message}`); return null })

  if (!res) { process.exitCode = 1; return }
  const ms = Date.now() - w0
  // ⚠ WAS IT ACTUALLY ASLEEP? A fast answer means it never dozed and this is a warm
  // number wearing a cold label — say so rather than quietly reporting a small figure.
  if (ms < 3_000) {
    console.log(`${name}: answered in ${(ms / 1000).toFixed(1)} s — it was still AWAKE.`)
    console.log('   Not a cold start. Something is sending it traffic, or the idle window is longer.')
    return
  }
  console.log(`${name}: FIRST QUERY FROM COLD answered ${res.status} after ${(ms / 1000).toFixed(1)} s`)
  console.log(`   against the 75 s budget: ${ms < 75_000 ? `✓ ${(75_000 - ms) / 1000}s of headroom` : '✗ OVER BUDGET'}`)

  // A second query, to show the warm figure beside it.
  const w1 = Date.now()
  await fetch(`${url}${probe.path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(probe.body), signal: AbortSignal.timeout(60_000),
  }).catch(() => null)
  console.log(`${name}: warm query for comparison: ${((Date.now() - w1) / 1000).toFixed(1)} s`)
}

if (require.main === module) {
  main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1 })
}
