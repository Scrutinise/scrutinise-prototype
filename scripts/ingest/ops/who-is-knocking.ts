// ─────────────────────────────────────────────────────────────────────────────
// Is anything hitting the search services during the "silent" windows?
//
// ⚠ THE QUESTION THIS SETTLES. `sleepApplication` is true on both, survives a redeploy, and
// neither service dozes after 30 minutes untouched by me. Two very different causes remain,
// with opposite remedies:
//
//   (a) Railway is not sleeping them — the plan or the service shape does not support it.
//       Nothing we can do in code; the saving does not exist.
//   (b) Something IS knocking — a bot, a scanner, an uptime check on the public
//       *.up.railway.app domain. Every inbound request resets the idle timer, so a public
//       domain that the internet can find may never be idle. Remedy: remove the public
//       domain and reach the services privately.
//
// A public Railway domain is discoverable and does attract scanners, so (b) is not exotic.
//
//   tsx ops/who-is-knocking.ts [minutesBack]
// ─────────────────────────────────────────────────────────────────────────────

import { rail } from './audit-sleep'
import { SERVICES, ENV_ID } from './sleep-state'

async function main() {
  const minutes = Number(process.argv[2] ?? 90)
  const startDate = new Date(Date.now() - minutes * 60_000).toISOString()

  for (const name of ['fts-serve', 'vector-serve'] as const) {
    const dep = await rail<{ serviceInstance: { latestDeployment: { id: string } | null } }>(`
      query I($serviceId: String!, $environmentId: String!) {
        serviceInstance(serviceId: $serviceId, environmentId: $environmentId) {
          latestDeployment { id }
        }
      }`, { serviceId: SERVICES[name], environmentId: ENV_ID })
    const id = dep.serviceInstance.latestDeployment?.id
    if (!id) { console.log(`${name}: no deployment`); continue }

    try {
      const logs = await rail<{
        httpLogs: Array<{ timestamp: string; path: string; method: string; httpStatus: number; clientUa?: string | null }>
      }>(`
        query L($deploymentId: String!, $startDate: String, $limit: Int) {
          httpLogs(deploymentId: $deploymentId, startDate: $startDate, limit: $limit) {
            timestamp path method httpStatus clientUa
          }
        }`, { deploymentId: id, startDate, limit: 500 })

      const rows = logs.httpLogs ?? []
      console.log(`\n${name}: ${rows.length} HTTP requests in the last ${minutes} min`)
      // Group by user agent — a scanner announces itself, and my own probes are curl/node.
      const byUa = new Map<string, number>()
      for (const r of rows) {
        const ua = (r.clientUa ?? '(none)').slice(0, 60)
        byUa.set(ua, (byUa.get(ua) ?? 0) + 1)
      }
      for (const [ua, n] of [...byUa.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
        console.log(`   ${String(n).padStart(4)}  ${ua}`)
      }
      // The gaps matter more than the count: sleeping needs a long unbroken quiet.
      if (rows.length > 1) {
        const ts = rows.map((r) => Date.parse(r.timestamp)).sort((a, b) => a - b)
        let maxGap = 0
        for (let i = 1; i < ts.length; i++) maxGap = Math.max(maxGap, ts[i] - ts[i - 1])
        console.log(`   longest gap between requests: ${(maxGap / 60_000).toFixed(1)} min`)
      }
    } catch (e) {
      console.log(`${name}: httpLogs unavailable — ${e instanceof Error ? e.message : String(e)}`)
    }
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1 })
}
