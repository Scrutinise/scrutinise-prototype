// Daily reconciliation: the LlmSpend ledger against each provider's OWN usage/cost report.
//
//   npx tsx --env-file=.env scripts/reconcile-spend.ts [--days 7]
//
// ⚠ THE RULE THIS FILE HOLDS (docs/CLAUDE.md §23): A RECONCILIATION THAT CANNOT READ THE OTHER SIDE
// MUST SAY SO, NEVER PRINT A GAP OF ZERO. Each provider is either RECONCILED (both sides read, gap
// shown) or NOT READ (with the exact reason). The closing line counts providers reconciled out of
// four, so an all-"not read" run cannot be mistaken for an all-clear.
//
// Credentials: the ordinary inference keys cannot read usage reports (probed 29 Sep 2026 — OpenAI
// 403 "Missing scopes: api.usage.read", Anthropic 401 "requires an Admin API key"). Set, in .env:
//   OPENAI_ADMIN_KEY      (or an OPENAI_API_KEY granted api.usage.read)
//   ANTHROPIC_ADMIN_KEY   (sk-ant-admin…)
// xAI has no usage-report endpoint we can reach with the inference key; Gemini's AI Studio key has
// none either (Google Cloud Billing / BigQuery export is the source) — both reported as NOT READ.
//
// ⚠ The OpenAI and Anthropic readers below are UNTESTED against a live report (no credential with the
// scope exists on this machine when this was written). They fail loudly on an unexpected shape.

import { prisma } from '../lib/prisma'

const USD_TO_GBP = Number(process.env.LEX_BUILD_USD_GBP ?? '0.79')
const days = Number(process.argv[process.argv.indexOf('--days') + 1]) || 7

const providerOf = (m: string) =>
  m.startsWith('gemini') ? 'google' : m.startsWith('claude') ? 'anthropic' : m.startsWith('grok') ? 'xai' : m.startsWith('gpt') ? 'openai' : 'other'

type Day = string // YYYY-MM-DD, UTC
type Ledger = Record<string, Record<Day, { rows: number; pence: number; unpriced: number }>>

async function ledger(): Promise<Ledger> {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT to_char("createdAt" AT TIME ZONE 'UTC','YYYY-MM-DD') d, model, count(*)::int n,
            coalesce(sum("estCostPence"),0)::float8 pence, count(*) FILTER (WHERE unpriced)::int unpriced
       FROM "LlmSpend" WHERE "createdAt" >= now() - interval '${days} days' GROUP BY 1,2`,
  ) as Array<{ d: string; model: string; n: number; pence: number; unpriced: number }>
  const out: Ledger = {}
  for (const r of rows) {
    const p = providerOf(r.model)
    const o = ((out[p] ??= {})[r.d] ??= { rows: 0, pence: 0, unpriced: 0 })
    o.rows += r.n; o.pence += r.pence; o.unpriced += r.unpriced
  }
  return out
}

type Report = { ok: true; usdByDay: Record<Day, number> } | { ok: false; reason: string }

async function openai(): Promise<Report> {
  const key = process.env.OPENAI_ADMIN_KEY ?? process.env.OPENAI_API_KEY
  if (!key) return { ok: false, reason: 'no OPENAI_ADMIN_KEY / OPENAI_API_KEY' }
  const start = Math.floor(Date.now() / 1000) - days * 86400
  const res = await fetch(`https://api.openai.com/v1/organization/costs?start_time=${start}&bucket_width=1d&limit=${days + 1}`, { headers: { Authorization: `Bearer ${key}` } })
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status} ${(await res.text()).slice(0, 160).replace(/\s+/g, ' ')}` }
  const j = await res.json() as { data?: Array<{ start_time: number; results?: Array<{ amount?: { value?: number; currency?: string } }> }> }
  if (!Array.isArray(j.data)) return { ok: false, reason: 'unexpected response shape (no data[])' }
  const usdByDay: Record<Day, number> = {}
  for (const b of j.data) {
    const d = new Date(b.start_time * 1000).toISOString().slice(0, 10)
    usdByDay[d] = (b.results ?? []).reduce((s, r) => s + (r.amount?.value ?? 0), 0)
  }
  return { ok: true, usdByDay }
}

async function anthropic(): Promise<Report> {
  const key = process.env.ANTHROPIC_ADMIN_KEY
  if (!key) return { ok: false, reason: 'no ANTHROPIC_ADMIN_KEY (the inference key gets 401 "requires an Admin API key")' }
  const start = new Date(Date.now() - days * 86400_000).toISOString()
  const res = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?starting_at=${encodeURIComponent(start)}&bucket_width=1d&limit=${days + 1}`, {
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
  })
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status} ${(await res.text()).slice(0, 160).replace(/\s+/g, ' ')}` }
  const j = await res.json() as { data?: Array<{ starting_at: string; results?: Array<{ amount?: string | number }> }> }
  if (!Array.isArray(j.data)) return { ok: false, reason: 'unexpected response shape (no data[])' }
  const usdByDay: Record<Day, number> = {}
  for (const b of j.data) {
    // `amount` is documented as the lowest currency unit (cents) — UNVERIFIED here; a first live run
    // must confirm the unit against the console before this gap is trusted.
    usdByDay[b.starting_at.slice(0, 10)] = (b.results ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0) / 100
  }
  return { ok: true, usdByDay }
}

async function main() {
  const L = await ledger()
  const readers: Array<[string, () => Promise<Report>]> = [
    ['openai', openai],
    ['anthropic', anthropic],
    ['xai', async () => ({ ok: false, reason: 'no usage-report endpoint reachable with the inference key (management-api.x.ai 404); the ledger uses xAI\'s own per-call `cost_in_usd_ticks`, which is the vendor\'s figure per call but not a reconciliation against the invoice' })],
    ['google', async () => ({ ok: false, reason: 'AI Studio keys expose no usage report; needs Google Cloud Billing export (BigQuery) or the Cloud console' })],
  ]
  let reconciled = 0
  for (const [name, read] of readers) {
    console.log(`\n== ${name}`)
    const mine = L[name] ?? {}
    let report: Report
    try { report = await read() } catch (e) { report = { ok: false, reason: `request failed: ${String(e)}` } }
    const daysSeen = [...new Set([...Object.keys(mine), ...(report.ok ? Object.keys(report.usdByDay) : [])])].sort()
    if (!report.ok) {
      console.log(`PROVIDER REPORT NOT READ — ${(report as { reason: string }).reason}`)
      for (const d of Object.keys(mine).sort()) {
        const v = mine[d]; console.log(`  ${d}  ledger ${v.pence.toFixed(2)}p (£${(v.pence / 100).toFixed(4)})  rows ${v.rows}${v.unpriced ? `  ⚠ ${v.unpriced} unpriced` : ''}`)
      }
      if (!Object.keys(mine).length) console.log('  (no ledger rows in the window)')
      continue
    }
    reconciled++
    for (const d of daysSeen) {
      const ledgerGbp = (mine[d]?.pence ?? 0) / 100
      const provGbp = (report.usdByDay[d] ?? 0) * USD_TO_GBP
      const gap = ledgerGbp - provGbp
      console.log(`  ${d}  ledger £${ledgerGbp.toFixed(4)}  provider £${provGbp.toFixed(4)}  gap £${gap.toFixed(4)} (${provGbp ? ((gap / provGbp) * 100).toFixed(1) : 'n/a'}%)`)
    }
  }
  console.log(`\nRECONCILED ${reconciled} of 4 providers over ${days} days.${reconciled < 4 ? ' The rest were NOT read — their gap is unknown, not zero.' : ''}`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
