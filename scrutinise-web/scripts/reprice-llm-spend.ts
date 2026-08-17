/**
 * reprice-llm-spend.ts — price the rows the ingest side could not.
 *
 * ⚠ WHY THIS EXISTS, AND WHY IT IS NOT A WORKAROUND. `scripts/ingest/shared/spend-ledger.ts` writes
 * tokens and leaves the cost NULL with `unpriced = TRUE`, deliberately: a second copy of the rate
 * card on the other side of the rootDir boundary is how two components come to disagree about what
 * something cost. One writer per runtime, ONE pricer, one table. This is that pricer.
 *
 * Without it, every ingest and graph row stays unpriced forever and every platform total reports
 * NULL — which would be honest and useless. So the repricing pass is part of the design, not a
 * patch over it.
 *
 * ⚠ IT ONLY EVER FILLS IN A MISSING PRICE. It never revises one already recorded: a stored cost is
 * what we believed at the time and a silent retro-repricing would make yesterday's reported figure
 * unreproducible. A rate-card correction that should move old rows is a deliberate, separate job.
 *
 * Usage (from scrutinise-web):
 *   npx tsx --env-file=.env scripts/reprice-llm-spend.ts            # dry run
 *   npx tsx --env-file=.env scripts/reprice-llm-spend.ts --apply
 */
import { Client } from 'pg'
import { rates } from '../lib/lex/build-cost'

export {}

const APPLY = process.argv.includes('--apply')
const USD_TO_GBP = Number(process.env.LEX_BUILD_USD_GBP ?? '0.79')

async function main() {
  const url = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL
  if (!url) throw new Error('NEON_DATABASE_URL / DATABASE_URL not set')
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()
  try {
    const card = rates()
    const { rows } = await client.query<{ id: string; model: string; ti: string; tout: string; th: string }>(
      `SELECT id::text, model, "tokensIn"::text ti, "tokensOut"::text tout, "tokensThinking"::text th
         FROM "LlmSpend" WHERE unpriced IS TRUE AND "estCostPence" IS NULL`)
    console.log(`\n════ REPRICE ${APPLY ? '(APPLYING)' : '(dry run)'} ════`)
    console.log(`  ${rows.length} unpriced rows · rate card covers: ${Object.keys(card).join(', ')}\n`)

    let priced = 0
    let stillUnpriced = 0
    const byModel = new Map<string, { n: number; pence: number | null }>()
    for (const r of rows) {
      const rate = card[r.model]
      const e = byModel.get(r.model) ?? { n: 0, pence: rate ? 0 : null }
      e.n++
      if (!rate) { stillUnpriced++; e.pence = null; byModel.set(r.model, e); continue }
      const out = Number(r.tout) + Number(r.th)
      const usd = (Number(r.ti) / 1e6) * rate.inPerM + (out / 1e6) * rate.outPerM
      const pence = usd * USD_TO_GBP * 100
      if (e.pence != null) e.pence += pence
      byModel.set(r.model, e)
      priced++
      if (APPLY) {
        await client.query(
          `UPDATE "LlmSpend" SET "estCostPence" = $2, unpriced = FALSE WHERE id = $1::bigint`,
          [r.id, pence.toFixed(4)])
      }
    }
    for (const [model, e] of byModel) {
      console.log(`  ${model.padEnd(30)} ${String(e.n).padStart(5)} rows  ${e.pence == null ? '⚠ NO RATE ON FILE — left unpriced' : `£${(e.pence / 100).toFixed(4)}`}`)
    }
    console.log(`\n  priced ${priced} · left unpriced ${stillUnpriced}`)
    if (stillUnpriced) {
      console.log(`  ⚠ Those rows need a rate in build-cost.ts or LEX_BUILD_RATES. Until then every total`)
      console.log(`    containing one reports NULL, which is the intended behaviour — see docs/MODEL_CONTRACT.md §3.`)
    }
    if (!APPLY) console.log(`\n  dry run — nothing written. Re-run with --apply.`)
    else {
      const { rows: [after] } = await client.query<{ n: string }>(
        `SELECT COUNT(*)::text n FROM "LlmSpend" WHERE unpriced IS TRUE`)
      console.log(`  read back: ${after.n} rows still unpriced (expected ${stillUnpriced})`)
      if (Number(after.n) !== stillUnpriced) console.log(`  ⚠ MISMATCH`)
    }
  } finally { await client.end() }
}
main().catch((e) => { console.error('[reprice-llm-spend] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
