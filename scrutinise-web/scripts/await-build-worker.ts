// ⚠ CENTRAL 25-B decision 52 — THIS MAKES THE FILE A MODULE, and that is the
// whole fix. Without an import or an export TypeScript treats a .ts file as a
// GLOBAL script, so these three siblings shared one scope and every top-level
// `const T` / `SERVICE` and helper collided with its twin — nine of the twelve
// errors that were failing `check:scripts` for everybody. No runtime change.
export {}

// ─────────────────────────────────────────────────────────────────────────────
// 25-T §1a — WAIT FOR THE DEPLOY, THEN ANSWER THE ONE QUESTION.
//
// ⚠⚠ THE FIRST ATTEMPT AT THIS REPORTED "0 log lines" AND I READ IT AS SILENCE. It was not
// silence — it was the WRONG LOG STREAM. A FAILED deployment never runs, so it has no deploy
// logs at all; its whole story is in `buildLogs`. The failure was a real, specific one
// (Railway ran `npm run build` and Next died prerendering `/admin/invites` without a Clerk key)
// and it was sitting in a stream I had not queried. So this reads BOTH, always, and says which
// it read — the same class as CLAUDE.md's "an absence of errors is not evidence".
//
// Usage: npx tsx --env-file=.env scripts/await-build-worker.ts [--minutes 8]
// ─────────────────────────────────────────────────────────────────────────────

const T = process.env.RAILWAY_API_TOKEN!
const SERVICE = 'c0d9fd39-9226-4d85-a9c5-a616341a542f' // build-worker
const MINUTES = Number(process.argv[process.argv.indexOf('--minutes') + 1]) || 8

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

async function logs(kind: 'buildLogs' | 'deploymentLogs', id: string) {
  try {
    const d = await gql(`query($id: String!) { ${kind}(deploymentId: $id, limit: 400) { message } }`, { id }) as
      Record<string, Array<{ message: string }>>
    return (d[kind] ?? []).map((l) => l.message)
  } catch { return [] as string[] }
}

async function main() {
  const deadline = Date.now() + MINUTES * 60_000
  let latest: { id: string; status: string } | undefined

  while (Date.now() < deadline) {
    const d = await gql(`query($s: String!) {
      deployments(first: 1, input: { serviceId: $s }) { edges { node { id status } } }
    }`, { s: SERVICE }) as { deployments: { edges: Array<{ node: { id: string; status: string } }> } }
    latest = d.deployments.edges[0]?.node
    if (!latest) { console.log('no deployments'); return }
    console.log(`  ${new Date().toISOString().slice(11, 19)}  ${latest.id.slice(0, 8)}  ${latest.status}`)

    // SUCCESS means the container is RUNNING — but §1a is not satisfied by a green box in
    // Railway's UI. It is satisfied by a line the worker wrote. So keep going until we read one.
    if (latest.status === 'SUCCESS') {
      const dl = await logs('deploymentLogs', latest.id)
      if (dl.some((m) => /\[build-worker/.test(m))) break
    }
    if (latest.status === 'FAILED' || latest.status === 'CRASHED') break
    await new Promise((r) => setTimeout(r, 15_000))
  }
  if (!latest) return

  const build = await logs('buildLogs', latest.id)
  const run = await logs('deploymentLogs', latest.id)

  console.log(`\n── BUILD log: ${build.length} lines ──`)
  for (const m of build.slice(-12)) console.log(`  ${m.trimEnd()}`)
  console.log(`\n── RUNTIME log: ${run.length} lines ──`)
  for (const m of run.slice(-40)) console.log(`  ${m.trimEnd()}`)

  // ⚠⚠ §1a's TEST: the POSITIVE lines the worker itself writes.
  const all = run.join('\n')
  const started = /\[build-worker[^\]]*\]/.test(all)
  const driver = /driver=worker/.test(all)
  const warned = /LEX_BUILD_DRIVER is not/.test(all)
  const heartbeat = /idle|empty queue/i.test(all)
  const claimed = /claim/i.test(all)

  console.log('\n── §1a: is it alive, by its own account? ──')
  console.log(`  deployment status                   : ${latest.status}`)
  console.log(`  a line from the worker itself       : ${started ? 'YES' : 'not seen'}`)
  console.log(`  and it reports driver=worker        : ${driver ? 'YES' : 'not seen'}`)
  console.log(`  the "wrong driver" warning          : ${warned ? 'PRESENT ⚠' : 'absent'}`)
  console.log(`  idle / empty-queue line             : ${heartbeat ? 'YES' : 'not yet'}`)
  console.log(`  a claim                             : ${claimed ? 'YES' : 'none yet'}`)
  console.log(`\n  → ${started && driver ? 'ALIVE, by its own account.' : 'NOT PROVEN ALIVE.'}`)
  process.exit(started && driver ? 0 : 1)
}

main().catch((e) => { console.error('failed:', e instanceof Error ? e.message : e); process.exit(1) })
