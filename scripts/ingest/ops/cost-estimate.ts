// ─────────────────────────────────────────────────────────────────────────────
// What the project costs, per service, from Railway's own usage figures.
//
// ⚠ MEASURED, NOT LIST PRICES. Railway bills on actual memory-GB-hours and CPU-hours, so a
// "$3.11/month" figure only means anything if it came from the meter.
//
//   tsx ops/cost-estimate.ts
//
// S25 — `railwayServiceCosts()` is exported so `cost-digest.ts` (the new daily £ cost
// digest) can pull the SAME per-service figures rather than a second, drifting copy. CLI
// behaviour below is unchanged.
// ─────────────────────────────────────────────────────────────────────────────

import { rail } from './audit-sleep'
import { SERVICES, PROJECT_ID } from './sleep-state'

const BY_ID = new Map<string, string>(Object.entries(SERVICES).map(([n, id]) => [id, n]))

// Railway's published rates (USD): $10 per GB-month of memory, $20 per vCPU-month,
// $0.15 per GB-month of volume.
const MEM_PER_GB_MONTH = 10
const CPU_PER_VCPU_MONTH = 20
const DISK_PER_GB_MONTH = 0.15

export interface RailwayServiceCost { name: string; mem: number; cpu: number; disk: number; dollars: number }
export interface RailwayCostReport { windowStart: string; windowEnd: string; days: number; services: RailwayServiceCost[]; projectedTotal: number }

/**
 * Railway usage → estimated $/month, per service, over [start, end).
 *
 * ⚠⚠ VALUES FROM `usage()` ARE SUMS OF PER-MINUTE SAMPLES, NOT GB-HOURS — dividing by the
 * window's MINUTES (not hours, not a raw sum) is what converts them into an average GB/vCPU
 * held over the window, calibrated against a real bill to ~20% (`scrutinise-db`: computes
 * ~$2.60 against a $3.11 charge). Reading them as GB-hours once produced $2,530/month for a
 * project that bills a few tens of dollars — see the git history of this file if that
 * mistake needs re-diagnosing.
 */
export async function railwayServiceCosts(start: Date, end: Date): Promise<RailwayCostReport> {
  const d = await rail<{
    usage: Array<{ measurement: string; value: number; tags: { serviceId?: string | null } }>
  }>(`
    query U($projectId: String!, $startDate: DateTime!, $endDate: DateTime!) {
      usage(
        measurements: [MEMORY_USAGE_GB, CPU_USAGE, DISK_USAGE_GB]
        projectId: $projectId
        startDate: $startDate
        endDate: $endDate
        groupBy: [SERVICE_ID]
      ) { measurement value tags { serviceId } }
    }
  `, { projectId: PROJECT_ID, startDate: start.toISOString(), endDate: end.toISOString() })

  const perService = new Map<string, Record<string, number>>()
  for (const u of d.usage) {
    const name = BY_ID.get(u.tags.serviceId ?? '') ?? (u.tags.serviceId ?? 'project')
    const row = perService.get(name) ?? {}
    row[u.measurement] = (row[u.measurement] ?? 0) + u.value
    perService.set(name, row)
  }

  const days = (end.getTime() - start.getTime()) / 86_400_000
  const minutes = days * 24 * 60
  const avg = (sum: number) => (minutes > 0 ? sum / minutes : 0)

  let projectedTotal = 0
  const services: RailwayServiceCost[] = []
  for (const [name, m] of [...perService.entries()].sort()) {
    const mem = avg(m.MEMORY_USAGE_GB ?? 0)
    const cpu = avg(m.CPU_USAGE ?? 0)
    const disk = avg(m.DISK_USAGE_GB ?? 0)
    const dollars = mem * MEM_PER_GB_MONTH + cpu * CPU_PER_VCPU_MONTH + disk * DISK_PER_GB_MONTH
    projectedTotal += dollars
    services.push({ name, mem, cpu, disk, dollars })
  }

  return { windowStart: start.toISOString(), windowEnd: end.toISOString(), days, services, projectedTotal }
}

async function main() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const report = await railwayServiceCosts(start, now)

  console.log(`billing window: ${report.windowStart.slice(0, 10)} → ${report.windowEnd.slice(0, 10)} (${report.days.toFixed(1)} days)\n`)
  console.log('service           avg GB   avg vCPU   disk GB   → est. $/month')
  for (const r of report.services) {
    console.log(
      `${r.name.padEnd(15)} ${r.mem.toFixed(3).padStart(9)} ${r.cpu.toFixed(3).padStart(8)} ` +
      `${r.disk.toFixed(2).padStart(9)}   $${r.dollars.toFixed(2)}`,
    )
  }
  console.log(`\nprojected total: $${report.projectedTotal.toFixed(2)}/month at the current rate of use`)

  const db = report.services.find((r) => r.name === 'scrutinise-db')
  if (db) {
    console.log(`\ncalibration: scrutinise-db computes at $${db.dollars.toFixed(2)}; the bill says $3.11.`)
    console.log('  Within ~20%, which is the accuracy this model claims — enough to compare')
    console.log('  services against each other, not enough to quote to the penny.')
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1 })
}
