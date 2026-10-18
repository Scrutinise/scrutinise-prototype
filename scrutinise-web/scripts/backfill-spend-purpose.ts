// 26-S2 §11b (decision 176) — give the history a PURPOSE. The 273 ledger rows since 29 Sep that carry neither a user nor an idea were almost all
// measurement runs (reachability, the Search router/reranker burst, build drafts, model review, probes). They are real money with no owner; from
// now on a script says so at the call site (`enterPurpose`, lib/lex/build-context.ts). This labels what already happened.
//
//   npx tsx --env-file=.env scripts/backfill-spend-purpose.ts            (dry run: counts, changes nothing)
//   npx tsx --env-file=.env scripts/backfill-spend-purpose.ts --apply    (writes `purpose = 'measurement'` where it is NULL)
//
// ⚠ ONLY rows with NO user AND NO idea AND no purpose yet, and only the passes listed. A row that carries a user is a person's spend and is never
// relabelled; the product passes that lost attribution (lex.feedback, lex.agent.web-search, lex.general-chat) are NOT relabelled — they are a
// product row without an owner, which is the thing the attribution check exists to show.
import { prisma } from '../lib/prisma'

const SINCE = '2026-09-29'
const MEASUREMENT_PASSES = ['reachability', 'search.query-router', 'search.reranker', 'build.draft', 'model-review.draft', 'model-review.judge', 'probe.grok', 'probe.effort-verify']

async function main() {
  const apply = process.argv.includes('--apply')
  const rows = await prisma.$queryRawUnsafe<Array<{ pass: string; n: number; pence: string | null }>>(
    `SELECT pass, count(*)::int n, round(sum("estCostPence")::numeric, 2)::text pence FROM "LlmSpend"
      WHERE "userId" IS NULL AND "ideaId" IS NULL AND purpose IS NULL AND "createdAt" >= $1 AND pass = ANY($2::text[]) GROUP BY 1 ORDER BY n DESC`, SINCE, MEASUREMENT_PASSES)
  const total = rows.reduce((s, r) => s + r.n, 0)
  const pence = rows.reduce((s, r) => s + Number(r.pence ?? 0), 0)
  for (const r of rows) console.log(`  ${r.pass.padEnd(24)} ${String(r.n).padStart(4)} rows  ${r.pence}p`)
  console.log(`${apply ? 'APPLYING' : 'DRY RUN'}: ${total} rows, ${pence.toFixed(1)}p -> purpose = 'measurement'`)
  if (!apply) { console.log('Nothing changed. Add --apply to write.'); return }
  const n = await prisma.$executeRawUnsafe(
    `UPDATE "LlmSpend" SET purpose = 'measurement'
      WHERE "userId" IS NULL AND "ideaId" IS NULL AND purpose IS NULL AND "createdAt" >= $1 AND pass = ANY($2::text[])`, SINCE, MEASUREMENT_PASSES)
  console.log(`updated ${n} rows`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
