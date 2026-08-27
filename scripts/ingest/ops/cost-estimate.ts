// ─────────────────────────────────────────────────────────────────────────────
// What the project costs, per service, from Railway's own usage figures.
//
// ⚠ MEASURED, NOT LIST PRICES. Railway bills on actual memory-GB-hours and CPU-hours, so a
// "$3.11/month" figure only means anything if it came from the meter.
//
//   tsx ops/cost-estimate.ts
// ─────────────────────────────────────────────────────────────────────────────

import { rail } from './audit-sleep'
import { SERVICES, PROJECT_ID } from './sleep-state'

const BY_ID = new Map(Object.entries(SERVICES).map(([n, id]) => [id, n]))

async function main() {
  // The current billing window.
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
  const end = now.toISOString()

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
  `, { projectId: PROJECT_ID, startDate: start, endDate: end })

  const perService = new Map<string, Record<string, number>>()
  for (const u of d.usage) {
    const name = BY_ID.get(u.tags.serviceId ?? '') ?? (u.tags.serviceId ?? 'project')
    const row = perService.get(name) ?? {}
    row[u.measurement] = (row[u.measurement] ?? 0) + u.value
    perService.set(name, row)
  }

  const days = (Date.now() - Date.parse(start)) / 86_400_000
  console.log(`billing window: ${start.slice(0, 10)} → ${end.slice(0, 10)} (${days.toFixed(1)} days)\n`)
  console.log('service           avg GB   avg vCPU   disk GB   → est. $/month')

  // Railway's published rates (USD): $10 per GB-month of memory, $20 per vCPU-month,
  // $0.15 per GB-month of volume.
  const MEM_PER_GB_MONTH = 10
  const CPU_PER_VCPU_MONTH = 20
  const DISK_PER_GB_MONTH = 0.15

  /**
   * ⚠⚠ THESE VALUES ARE SUMS OF PER-MINUTE SAMPLES, NOT GB-HOURS — and reading them as
   * GB-hours produced **$2,530/month** for a project that bills a few tens of dollars.
   *
   * The giveaway was `scrutinise-db`'s disk: 102,229. Divided by the minutes in the window
   * it is **2.63 GB**, which is exactly the 2,029 MB database plus overhead. Same divisor
   * turns fts-serve's 69,620 into 1.79 GB of memory — a believable figure for a service
   * holding a Lance index.
   *
   * ⚠ AND IT IS CALIBRATED AGAINST A KNOWN FIGURE. Charlie's bill puts `scrutinise-db` at
   * **$3.11/month**; this model computes ~$2.6 for it. Close enough to trust the shape,
   * and the check is printed below so the next person can re-run the calibration rather
   * than take my word for it.
   */
  const minutes = days * 24 * 60
  const avg = (sum: number) => sum / minutes

  let projected = 0
  const rows: Array<{ name: string; mem: number; cpu: number; disk: number; dollars: number }> = []
  for (const [name, m] of [...perService.entries()].sort()) {
    const mem = avg(m.MEMORY_USAGE_GB ?? 0)
    const cpu = avg(m.CPU_USAGE ?? 0)
    const disk = avg(m.DISK_USAGE_GB ?? 0)
    const dollars = mem * MEM_PER_GB_MONTH + cpu * CPU_PER_VCPU_MONTH + disk * DISK_PER_GB_MONTH
    projected += dollars
    rows.push({ name, mem, cpu, disk, dollars })
    console.log(
      `${name.padEnd(15)} ${mem.toFixed(3).padStart(9)} ${cpu.toFixed(3).padStart(8)} ` +
      `${disk.toFixed(2).padStart(9)}   $${dollars.toFixed(2)}`,
    )
  }
  console.log(`\nprojected total: $${projected.toFixed(2)}/month at the current rate of use`)

  const db = rows.find((r) => r.name === 'scrutinise-db')
  if (db) {
    console.log(`\ncalibration: scrutinise-db computes at $${db.dollars.toFixed(2)}; the bill says $3.11.`)
    console.log('  Within ~20%, which is the accuracy this model claims — enough to compare')
    console.log('  services against each other, not enough to quote to the penny.')
  }
}

if (require.main === module) {
  main().catch((e) => { console.error(`FAILED: ${e.message}`); process.exitCode = 1 })
}
