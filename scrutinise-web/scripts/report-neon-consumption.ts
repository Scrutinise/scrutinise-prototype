/**
 * report-neon-consumption.ts - this month's Neon consumption by project and by type (compute, storage, transfer), and the hours each compute was awake.
 *
 *   NEON_API_KEY=<key> npx tsx --env-file=.env scripts/report-neon-consumption.ts [--from 2026-10-01] [--to 2026-10-22] [--org org-xxxx]
 *
 * READ-ONLY. Needs NEON_API_KEY (an organisation or personal API key from console.neon.tech -> Account settings -> API keys). The database owner
 * password in .env does NOT work here: this is the Neon control-plane API, not Postgres.
 *
 * ⚠ WRITTEN WITHOUT A KEY TO TEST AGAINST. It uses Neon's consumption-history endpoints as documented (v2: /consumption_history/v2/projects; v1 as a
 * fallback), and it PRINTS THE RAW SHAPE of the first response it gets, so a field I have named wrongly shows up as a visible zero with the raw JSON beside
 * it, not as a quiet wrong total. Quantities are measured; DOLLARS ARE NOT RETURNED BY THIS API and are estimated here from per-unit rates that are
 * overridable (NEON_RATE_COMPUTE_CU_HOUR, NEON_RATE_STORAGE_GB_MONTH, NEON_RATE_TRANSFER_GB) and labelled as estimates — reconcile the total against the
 * console's invoice before quoting it.
 */
const KEY = process.env.NEON_API_KEY
const argv = process.argv.slice(2)
const arg = (k: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined }
const now = new Date()
const FROM = arg('from') ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
const TO = arg('to') ?? now.toISOString().slice(0, 10)
const ORG = arg('org') ?? process.env.NEON_ORG_ID
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
const rate = (k: string, d: number) => { const v = Number(process.env[k]); return Number.isFinite(v) && v > 0 ? v : d }
// Defaults are the published Scale-plan list prices as I recall them — NOT verified, hence overridable and labelled.
const R = { cu: rate('NEON_RATE_COMPUTE_CU_HOUR', 0.222), gbMonth: rate('NEON_RATE_STORAGE_GB_MONTH', 0.35), gbTransfer: rate('NEON_RATE_TRANSFER_GB', 0.10) }

async function neon(pathAndQuery: string): Promise<any> {
  const r = await fetch(`https://console.neon.tech/api/v2${pathAndQuery}`, { headers: { Authorization: `Bearer ${KEY}`, Accept: 'application/json' } })
  const text = await r.text()
  if (!r.ok) throw new Error(`Neon API ${r.status} on ${pathAndQuery.split('?')[0]}: ${text.slice(0, 400)}`)
  return JSON.parse(text)
}

async function main() {
  if (!KEY) { console.error('NEON_API_KEY is not set. Create one at console.neon.tech -> Account settings -> API keys and export it for this run only.'); process.exit(2) }
  const q = new URLSearchParams({ from: `${FROM}T00:00:00Z`, to: `${TO}T23:59:59Z`, granularity: 'daily', limit: '100' })
  if (ORG) q.set('org_id', ORG)
  let projects: any[] = []
  let mode = 'v2'
  try {
    q.set('metrics', 'compute_unit_seconds,root_branch_bytes_month,instant_restore_bytes_month,extra_branches_bytes_month,public_network_transfer_bytes,private_network_transfer_bytes')
    let cursor: string | undefined
    do {
      if (cursor) q.set('cursor', cursor)
      const j = await neon(`/consumption_history/v2/projects?${q}`)
      if (!projects.length) console.log('RAW SHAPE (first v2 response, truncated):', JSON.stringify(j).slice(0, 700))
      projects.push(...(j.projects ?? []))
      cursor = j.pagination?.cursor
    } while (cursor)
  } catch (e) {
    console.log(`v2 failed (${(e as Error).message.slice(0, 200)}) — trying v1`)
    mode = 'v1'; projects = []
    q.delete('metrics'); q.delete('cursor')
    let cursor: string | undefined
    do {
      if (cursor) q.set('cursor', cursor)
      const j = await neon(`/consumption_history/projects?${q}`)
      if (!projects.length) console.log('RAW SHAPE (first v1 response, truncated):', JSON.stringify(j).slice(0, 700))
      projects.push(...(j.projects ?? []))
      cursor = j.pagination?.cursor
    } while (cursor)
  }
  console.log(`\nNeon consumption ${FROM} -> ${TO} (${mode}), ${projects.length} projects${ORG ? `, org ${ORG}` : ''}\n`)

  // names, so the table is readable
  const names = new Map<string, string>()
  try { for (const p of (await neon(`/projects?limit=100${ORG ? `&org_id=${ORG}` : ''}`)).projects ?? []) names.set(p.id, p.name) } catch { /* names are a convenience */ }

  const rows: Array<{ id: string; name: string; cuHours: number; awakeHours: number; storageGbMonth: number; transferGb: number; usd: { compute: number; storage: number; transfer: number } }> = []
  for (const p of projects) {
    let cuSec = 0, activeSec = 0, storageByteMonthish = 0, transferBytes = 0, days = 0
    for (const period of p.periods ?? []) for (const c of period.consumption ?? []) {
      days++
      if (mode === 'v2') {
        const m: Record<string, number> = {}
        for (const x of c.metrics ?? []) m[x.metric_name] = num(x.value)
        cuSec += m.compute_unit_seconds ?? 0
        storageByteMonthish += (m.root_branch_bytes_month ?? 0) + (m.instant_restore_bytes_month ?? 0) + (m.extra_branches_bytes_month ?? 0)
        transferBytes += (m.public_network_transfer_bytes ?? 0) + (m.private_network_transfer_bytes ?? 0)
        // v2 has no active-time metric: awake hours are read from the v1 shape below when available
      } else {
        cuSec += num(c.compute_time_seconds); activeSec += num(c.active_time_seconds)
        storageByteMonthish += num(c.synthetic_storage_size_bytes) / 30 // a daily size sample, spread over the month
        transferBytes += num(c.data_transfer_bytes)
      }
    }
    const cuHours = cuSec / 3600, gbMonth = storageByteMonthish / 1e9 / (mode === 'v2' ? 1 : 1)
    const transferGb = transferBytes / 1e9
    rows.push({ id: p.project_id, name: names.get(p.project_id) ?? p.project_id, cuHours, awakeHours: activeSec / 3600, storageGbMonth: gbMonth, transferGb,
      usd: { compute: cuHours * R.cu, storage: gbMonth * R.gbMonth, transfer: transferGb * R.gbTransfer } })
  }

  // v2 does not return active time; take it from v1 so "hours each compute was awake" is always answered
  if (mode === 'v2') {
    try {
      const q1 = new URLSearchParams({ from: `${FROM}T00:00:00Z`, to: `${TO}T23:59:59Z`, granularity: 'daily', limit: '100' })
      if (ORG) q1.set('org_id', ORG)
      const j1 = await neon(`/consumption_history/projects?${q1}`)
      for (const p of j1.projects ?? []) {
        const row = rows.find((r) => r.id === p.project_id)
        if (row) row.awakeHours = (p.periods ?? []).flatMap((pe: any) => pe.consumption ?? []).reduce((a: number, c: any) => a + num(c.active_time_seconds), 0) / 3600
      }
    } catch (e) { console.log(`(awake hours unavailable from v1: ${(e as Error).message.slice(0, 160)})`) }
  }

  const f = (n: number, d = 2) => n.toFixed(d)
  console.log('project'.padEnd(34), 'awake h'.padStart(8), 'CU-hours'.padStart(9), 'stor GB-mo'.padStart(11), 'xfer GB'.padStart(8), '~$compute'.padStart(10), '~$storage'.padStart(10), '~$xfer'.padStart(8), '~$total'.padStart(9))
  for (const r of rows.sort((a, b) => (b.usd.compute + b.usd.storage + b.usd.transfer) - (a.usd.compute + a.usd.storage + a.usd.transfer))) {
    const t = r.usd.compute + r.usd.storage + r.usd.transfer
    console.log(r.name.slice(0, 33).padEnd(34), f(r.awakeHours, 1).padStart(8), f(r.cuHours, 1).padStart(9), f(r.storageGbMonth).padStart(11), f(r.transferGb).padStart(8), f(r.usd.compute).padStart(10), f(r.usd.storage).padStart(10), f(r.usd.transfer).padStart(8), f(t).padStart(9))
  }
  const tot = rows.reduce((a, r) => ({ c: a.c + r.usd.compute, s: a.s + r.usd.storage, t: a.t + r.usd.transfer }), { c: 0, s: 0, t: 0 })
  console.log(`\nESTIMATED TOTAL $${f(tot.c + tot.s + tot.t)}  (compute $${f(tot.c)}, storage $${f(tot.s)}, transfer $${f(tot.t)}) at rates $${R.cu}/CU-h, $${R.gbMonth}/GB-month, $${R.gbTransfer}/GB.`)
  console.log('⚠ Quantities are Neon\'s; the dollars are this script\'s arithmetic on list rates. Reconcile against the console invoice before quoting.')
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1) })
