// ─────────────────────────────────────────────────────────────────────────────
// cost-alert.ts — S22 "Alerts". A DAILY JOB, not a route: reads month-to-date LlmSpend and
// emails Charlie through the existing Resend path (lib/email.ts) once when MTD spend passes
// $20, and once at $50. "Once" is a stateful claim — MTD spend stays above $20 for the rest
// of the month once it crosses, and a check with no memory would email every day for three
// weeks — so `CostAlertSent` (prisma/cost_alert.sql) records one row per (month, threshold)
// actually sent, with a UNIQUE constraint so a double-run cannot double-send.
//
// ⚠ USD, NOT THE STORED GBP PENCE. `LlmSpend.estCostPence` is GBP (spend-ledger.ts prices
// every row at `LEX_BUILD_USD_GBP`, default 0.79), and S22's thresholds are USD — reversed
// with the SAME exported rate the ledger priced at, not a second hardcoded number.
//
// ⚠ AN UNPRICED CALL IS REPORTED, NEVER SILENTLY DROPPED FROM THE TOTAL. Same rule as
// spend-ledger.ts's `fold()`: a month containing a call with no rate on file states so in
// the alert email rather than understating the true spend.
//
// Scheduling is NOT built here — this is the job; wiring it to fire daily (Railway cron, a
// PM2 scheduled task, GitHub Actions) is an infrastructure decision for Charlie to make
// once the job itself is proven. Run it manually or from whatever scheduler is chosen.
//
// Usage:
//   npx tsx --env-file=.env scripts/cost-alert.ts                 (real thresholds, $20/$50)
//   npx tsx --env-file=.env scripts/cost-alert.ts --dry-run        (report, send nothing)
//   LEX_COST_ALERT_THRESHOLDS=0.01 npx tsx --env-file=.env scripts/cost-alert.ts
//     — S22's own proof step: a threshold real spend has certainly already passed, to show
//       the whole path (query → compose → Resend → dedupe row) fires end to end.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { USD_TO_GBP } from '../lib/lex/spend-ledger'
import { sendCostAlertEmail } from '../lib/email'

const ALERT_EMAIL = process.env.LEX_COST_ALERT_EMAIL ?? 'cl@scrutinise.org'
const DRY_RUN = process.argv.includes('--dry-run')

function thresholds(): number[] {
  const raw = process.env.LEX_COST_ALERT_THRESHOLDS ?? '20,50'
  return raw.split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
}

/** 'YYYY-MM' in UTC — CLAUDE.md's UTC-only rule applies to a month boundary as much as to
 *  any other timestamp; a BST evening on the last day of the month is still the same UTC day. */
function currentMonthUtc(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

interface MonthTotal { usd: number; unpricedCalls: number; totalCalls: number }

async function monthToDateUsd(month: string): Promise<MonthTotal> {
  const [y, m] = month.split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1))
  const rows = await prisma.$queryRaw<Array<{ estCostPence: unknown; unpriced: boolean }>>`
    SELECT "estCostPence", unpriced FROM "LlmSpend" WHERE "createdAt" >= ${start} AND "createdAt" < ${end}`
  let pence = 0
  let unpricedCalls = 0
  for (const r of rows) {
    if (r.unpriced || r.estCostPence == null) { unpricedCalls++; continue }
    pence += Number(r.estCostPence)
  }
  return { usd: pence / 100 / USD_TO_GBP, unpricedCalls, totalCalls: rows.length }
}

async function alreadySent(month: string, threshold: number): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ id: bigint }>>`
    SELECT id FROM "CostAlertSent" WHERE month = ${month} AND "thresholdUsd" = ${threshold}`
  return rows.length > 0
}

async function recordSent(month: string, threshold: number, providerId: string | null): Promise<void> {
  // ON CONFLICT DO NOTHING: the UNIQUE(month, thresholdUsd) constraint is the actual
  // guarantee against a double-send race; this makes a second write land as a no-op
  // rather than an error.
  await prisma.$executeRaw`
    INSERT INTO "CostAlertSent" (month, "thresholdUsd", "providerId")
    VALUES (${month}, ${threshold}, ${providerId})
    ON CONFLICT (month, "thresholdUsd") DO NOTHING`
}

async function main() {
  const month = currentMonthUtc()
  const total = await monthToDateUsd(month)
  const limits = thresholds()

  console.log(`\n════ cost-alert — ${month} (UTC) ════`)
  console.log(`MTD spend: $${total.usd.toFixed(4)} across ${total.totalCalls} call(s)`
    + (total.unpricedCalls ? ` (${total.unpricedCalls} unpriced, NOT included — true total is at least this much)` : ''))
  console.log(`thresholds: ${limits.map((t) => `$${t}`).join(', ')}`)

  for (const threshold of limits) {
    if (total.usd < threshold) {
      console.log(`  $${threshold} — not yet passed`)
      continue
    }
    if (await alreadySent(month, threshold)) {
      console.log(`  $${threshold} — passed, already alerted this month (CostAlertSent has a row)`)
      continue
    }
    if (DRY_RUN) {
      console.log(`  $${threshold} — passed, WOULD alert ${ALERT_EMAIL} (--dry-run, not sending)`)
      continue
    }
    const result = await sendCostAlertEmail({
      toEmail: ALERT_EMAIL, thresholdUsd: threshold, spentUsd: total.usd, month,
      unpricedCalls: total.unpricedCalls,
    })
    if (result.sent) {
      await recordSent(month, threshold, result.providerId)
      console.log(`  $${threshold} — ALERTED ${ALERT_EMAIL} (Resend id ${result.providerId ?? '(none returned)'}), recorded in CostAlertSent`)
    } else {
      // ⚠ NOT recorded as sent. A skip (no key, suppressed) must be retried tomorrow's run,
      // not permanently silenced by a dedupe row for a send that never happened.
      console.log(`  $${threshold} — passed, NOT sent: ${result.reason}. Will retry next run (not recorded).`)
    }
  }
  console.log('════ done ════\n')
}

main().then(() => process.exit(0)).catch((e) => { console.error('FATAL', e); process.exit(1) })
