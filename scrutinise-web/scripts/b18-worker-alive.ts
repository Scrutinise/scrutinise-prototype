export {}

// ─────────────────────────────────────────────────────────────────────────────
// B18 — IS THE BUILD WORKER ACTUALLY RUNNING RIGHT NOW?
//
// ⚠ A SUCCESS deployment is not a live process. `deployments` reports the last BUILD;
// a container that has since crashed, been paused for a usage limit, or been scaled to
// zero still shows SUCCESS. The only evidence that settles it is a log line with a
// recent timestamp — the worker prints an idle heartbeat every 60 polls.
//
// Read-only. Prints the newest log line and how old it is.
// ─────────────────────────────────────────────────────────────────────────────

const T = process.env.RAILWAY_API_TOKEN!
const SERVICE = 'c0d9fd39-9226-4d85-a9c5-a616341a542f' // build-worker

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
  if (!T) { console.log('no RAILWAY_API_TOKEN'); process.exit(1) }

  const d = await gql(`query($s: String!) {
    deployments(first: 5, input: { serviceId: $s }) {
      edges { node { id status createdAt staticUrl } }
    }
  }`, { s: SERVICE }) as { deployments: { edges: Array<{ node: { id: string; status: string; createdAt: string } }> } }

  console.log('── build-worker deployments ──')
  for (const e of d.deployments.edges) {
    console.log(`  ${e.node.id.slice(0, 8)}  ${e.node.status.padEnd(10)}  ${e.node.createdAt}`)
  }

  const live = d.deployments.edges.find((e) => e.node.status === 'SUCCESS')?.node
  if (!live) { console.log('\n⚠ no SUCCESS deployment'); return }

  const logs = await gql(`query($id: String!, $limit: Int!) {
    deploymentLogs(deploymentId: $id, limit: $limit) { timestamp message }
  }`, { id: live.id, limit: 50 }) as { deploymentLogs: Array<{ timestamp: string; message: string }> }
  const lines = logs.deploymentLogs ?? []

  console.log(`\n── last ${Math.min(8, lines.length)} log lines of ${live.id.slice(0, 8)} ──`)
  for (const l of lines.slice(-8)) console.log(`  ${l.timestamp}  ${l.message.slice(0, 150)}`)

  const newest = lines.length ? lines[lines.length - 1].timestamp : null
  if (!newest) { console.log('\n⚠⚠ NO LOG LINES AT ALL — treat the worker as not running.'); return }
  const ageMin = (Date.now() - new Date(newest).getTime()) / 60000
  console.log(`\n  newest log line: ${newest}`)
  console.log(`  age: ${ageMin.toFixed(1)} minutes`)
  // The idle heartbeat is every 60 polls at WORKER_IDLE_MS; anything over ~30 minutes of
  // silence means the process is not polling, whatever the deployment status says.
  console.log(ageMin < 30
    ? '  → ALIVE (a heartbeat this recent means the poll loop is running)'
    : '  ⚠⚠ SILENT for more than 30 minutes — do NOT enqueue until this is explained.')
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
