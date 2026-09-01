// ─────────────────────────────────────────────────────────────────────────────
// 25-T §1a/§1b — PROVE THE WORKER IS ALIVE FROM ITS OWN LOGS.
//
// §1a: *"Prove it is alive with a positive log line from the worker itself — a counter, a
// heartbeat, a claim attempt. An absence of errors is not evidence."*
//
// So this reads the deployment's log stream and looks for the lines `build-worker.ts` actually
// writes: the startup line (which names the driver and the concurrency), the idle heartbeat, and
// the per-build claim. It reports which of them it saw.
//
// Usage: npx tsx --env-file=.env scripts/watch-build-worker.ts [--tail 200]
// ─────────────────────────────────────────────────────────────────────────────

const T = process.env.RAILWAY_API_TOKEN!
const SERVICE = 'c0d9fd39-9226-4d85-a9c5-a616341a542f' // build-worker
const LIMIT = Number(process.argv[process.argv.indexOf('--tail') + 1]) || 200

async function gql(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch('https://backboard.railway.com/graphql/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Project-Access-Token': T },
    body: JSON.stringify({ query, variables }),
  })
  const b = await res.json() as { data?: Record<string, unknown>; errors?: Array<{ message: string }> }
  if (b.errors?.length) throw new Error(b.errors.map((e) => e.message).join('; '))
  return b.data ?? {}
}

async function main() {
  const d = await gql(`query($s: String!) {
    deployments(first: 3, input: { serviceId: $s }) {
      edges { node { id status createdAt } }
    }
  }`, { s: SERVICE }) as { deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string } }> } }

  console.log('\n── deployments ──')
  for (const e of d.deployments.edges) {
    console.log(`  ${e.node.id.slice(0, 8)}  ${e.node.status.padEnd(12)} ${e.node.createdAt.slice(0, 19)}`)
  }
  const latest = d.deployments.edges[0]?.node
  if (!latest) { console.log('  no deployments'); return }

  // ⚠ A FAILED DEPLOY HAS NO DEPLOY LOGS — the failure is in the BUILD. Reading only
  // deploymentLogs on a FAILED deployment reports "0 log lines", which looks like silence and is
  // actually the wrong log stream.
  if (latest.status === "FAILED" || latest.status === "CRASHED") {
    try {
      const bl = await gql(`query($id: String!, $limit: Int!) {
        buildLogs(deploymentId: $id, limit: $limit) { timestamp message }
      }`, { id: latest.id, limit: LIMIT }) as { buildLogs: Array<{ timestamp: string; message: string }> }
      const bls = bl.buildLogs ?? []
      console.log(`
── BUILD log, last 40 of ${bls.length} ──`)
      for (const l of bls.slice(-40)) console.log(`  ${l.message}`)
    } catch (e) { console.log('  (build logs unavailable:', e instanceof Error ? e.message : e, ')') }
  }

  let lines: Array<{ timestamp: string; message: string }> = []
  try {
    const logs = await gql(`query($id: String!, $limit: Int!) {
      deploymentLogs(deploymentId: $id, limit: $limit) { timestamp message }
    }`, { id: latest.id, limit: LIMIT }) as
      { deploymentLogs: Array<{ timestamp: string; message: string }> }
    lines = logs.deploymentLogs ?? []
  } catch (e) {
    console.log(`\n  (deploy logs unavailable: ${e instanceof Error ? e.message : e})`)
  }

  console.log(`\n── ${lines.length} log lines from ${latest.id.slice(0, 8)} (${latest.status}) ──`)
  for (const l of lines.slice(-50)) console.log(`  ${l.timestamp.slice(11, 19)} ${l.message}`)

  // ⚠⚠ §1a's TEST, STATED AS THE POSITIVE LINES THE WORKER ACTUALLY WRITES. An absence of errors
  // is not evidence; these are.
  const all = lines.map((l) => l.message).join('\n')
  const started = /\[build-worker [^\]]*\] starting/.test(all)
  const driver = /driver=worker/.test(all)
  const warned = /LEX_BUILD_DRIVER is not "worker"/.test(all)
  const heartbeat = /idle — \d+ polls with an empty queue/.test(all)
  const claimed = /claimed|running build/.test(all)

  console.log('\n── §1a: is it alive, by its own account? ──')
  console.log(`  startup line from the worker itself : ${started ? 'YES' : 'not seen'}`)
  console.log(`  and it reports driver=worker        : ${driver ? 'YES' : 'not seen'}`)
  console.log(`  the "wrong driver" warning          : ${warned ? 'PRESENT' : 'absent (good)'}`)
  console.log(`  idle heartbeat (60 polls, ~5 min)   : ${heartbeat ? 'YES' : 'not yet'}`)
  console.log(`  a build claim                       : ${claimed ? 'YES' : 'none yet'}`)
  console.log(`\n  → ${started && driver ? 'ALIVE, by its own account.' : 'NOT PROVEN ALIVE YET.'}`)
}

main().catch((e) => { console.error('failed:', e instanceof Error ? e.message : e); process.exit(1) })
