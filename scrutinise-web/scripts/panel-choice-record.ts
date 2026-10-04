// 26-O §4e — the "which model was chosen" record, RESTARTED on the price-matched panel.
//   npx tsx --env-file=.env scripts/panel-choice-record.ts
// Counts, per panel slot, how often its draft was picked as the favourite and how often it was the accepted/redrafted
// basis — over consolidations created on or after PANEL_RECORD_STARTS only. Earlier rows are a different panel.
import { prisma } from '../lib/prisma'
import { PANEL_RECORD_STARTS, PREMIUM_DRAFT_MODELS } from '../lib/lex/guiding-policy-consolidate'

async function main() {
  const since = new Date(`${PANEL_RECORD_STARTS}T00:00:00Z`)
  const rows = await prisma.guidingPolicyConsolidation.findMany({
    where: { createdAt: { gte: since }, idea: { title: { not: { startsWith: 'ZZ-' } } } },
    select: { id: true, status: true, favouriteModel: true, drafts: { select: { model: true, servedBy: true } } },
  })
  console.log(`consolidations on the new panel since ${PANEL_RECORD_STARTS}: ${rows.length}`)
  for (const m of PREMIUM_DRAFT_MODELS) {
    const drafted = rows.filter((r) => r.drafts.some((d) => d.model === m)).length
    const fav = rows.filter((r) => r.favouriteModel === m).length
    const fb = rows.flatMap((r) => r.drafts).filter((d) => d.model === m && d.servedBy).length
    console.log(`  ${m.padEnd(26)} drafted ${drafted} · chosen as favourite ${fav}${fb ? ` · ${fb} written by a fallback` : ''}`)
  }
  await prisma.$disconnect()
}
main()
