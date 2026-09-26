// ─────────────────────────────────────────────────────────────────────────────
// cost-digest.ts — S25 §4. ONE daily email in £: what did yesterday cost, and on what.
//
// Replaces `scripts/ingest/search/serve-observer.ts`'s old daily digest, which reported
// engineering counters (memory/concurrency/throughput/cache/Neon) rather than cost — the
// only daily digest email that existed anywhere in this codebase before this one (confirmed
// by search; a SEPARATE, unrelated ingest-progress email — `progress-reporter.ts`'s
// `sendProgressEmail` — reports corpus/section counts and is out of scope: content-pipeline
// health, not LLM spend).
//
// The data-gathering lives in `lib/lex/cost-digest-data.ts` (shared with the
// `/api/admin/cost-digest` route this email links to as its "raw counters"), including the
// package-boundary reasoning for why Railway/Neon/search-health are read via thin, minimal,
// OWN calls rather than importing `scripts/ingest/**` (docs/CLAUDE.md §20 Check A).
//
// Deploy as its own Railway cron service, same pattern as `cost-alert-cron`
// (`npx tsx scripts/cost-digest.ts`, e.g. `0 8 * * *`) — scheduling is Charlie's
// infrastructure decision, same note `cost-alert.ts` already carries.
//
// Usage:
//   npx tsx --env-file=.env scripts/cost-digest.ts               (real send)
//   npx tsx --env-file=.env scripts/cost-digest.ts --dry-run       (print, send nothing)
// ─────────────────────────────────────────────────────────────────────────────

import { buildCostDigestData } from '../lib/lex/cost-digest-data'
import { sendCostDigestEmail } from '../lib/email'

const DIGEST_EMAIL = process.env.LEX_COST_ALERT_EMAIL ?? 'cl@scrutinise.org'
const DRY_RUN = process.argv.includes('--dry-run')
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://scrutinise.org'
const RAWCOUNTERS_URL = `${APP_URL}/admin/cost-digest`

async function main() {
  const data = await buildCostDigestData()

  console.log(`\n════ cost-digest — ${data.dateUtc} (UTC) ════`)
  console.log(`yesterday: £${data.yesterday.gbp?.toFixed(2) ?? '?'}${data.yesterday.unpricedCalls ? ` (${data.yesterday.unpricedCalls} unpriced)` : ''}`)
  console.log(`MTD: £${data.monthToDate.gbp?.toFixed(2) ?? '?'} ($${data.monthToDate.usd?.toFixed(2) ?? '?'}), projected month-end $${data.monthToDate.projectedUsd?.toFixed(2) ?? '?'}`)
  console.log(`health: ${data.healthLine}`)
  console.log(`⚠ ${data.attributionNote}`)
  console.log(`Railway: ${data.railwayServices.length ? 'ok' : 'unavailable (no RAILWAY_API_TOKEN or query failed)'}`)
  console.log(`Neon storage: ${data.neon.storageUsd != null ? `$${data.neon.storageUsd.toFixed(2)}/month` : 'unavailable'}`)
  if (data.unmappedPasses.length) console.log(`⚠ unmapped passes: ${data.unmappedPasses.join(', ')}`)

  if (DRY_RUN) { console.log('\n--dry-run: not sending'); return }

  const result = await sendCostDigestEmail({
    toEmail: DIGEST_EMAIL,
    dateUtc: data.dateUtc,
    rawLinkUrl: RAWCOUNTERS_URL,
    healthLine: data.healthLine,
    yesterday: data.yesterday,
    monthToDate: data.monthToDate,
    byPurpose: data.byPurpose,
    unmappedPasses: data.unmappedPasses,
    bySupplier: data.bySupplier,
    railwayServices: data.railwayServices,
    neon: { storageUsd: data.neon.storageUsd ?? 0, computeCaptured: data.neon.computeCaptured },
    vercelCaptured: data.vercelCaptured,
    topIdeas: data.topIdeas,
    topUsers: data.topUsers,
  })
  console.log(result.sent ? `\nsent (Resend id ${result.providerId ?? '(none)'})` : `\nNOT sent: ${result.reason}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error('FATAL', e); process.exit(1) })
