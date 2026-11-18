// ─────────────────────────────────────────────────────────────────────────────
// measure-26y — LEX 26-Y: the PRICE of Lex's cost–benefit narrative (the only model call in the Cost–benefit report and the costing
// companion), measured on a SCRATCH COPY of 452c5ade with the lines its live costing would read. Spends a few pence per run; prints each run's
// pence from the spend ledger, and the mean to put in lib/lex/cba/prices.ts. Deletes its copy.
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/measure-26y.ts [runs=3]
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from '../lib/prisma'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import { cbaInputs } from '../lib/lex/cba/engine'
import { computeCba } from '../lib/lex/cba/engine-pure'
import { writeNarrative, narrativeUser, NARRATIVE_MODEL } from '../lib/lex/cba/narrative'

async function main() {
  const runs = Math.min(5, Number(process.argv[2] ?? 3))
  const scratch = await scratchCopy('452c5ade', '26y-measure')
  try {
    const live = await prisma.lexCoherentAction.findMany({ where: { ideaId: scratch.id, status: 'LIVE' }, orderBy: { number: 'asc' }, take: 4, select: { id: true } })
    const existing = await prisma.costLine.count({ where: { action: { ideaId: scratch.id } } })
    // a realistic set: the copy's own cost lines, plus a staffing, a systems and a capital line and three benefits on its first actions
    await prisma.costLine.createMany({ data: [
      { actionId: live[0].id, label: 'Two policy officers to run the register', costType: 'STAFF', low: 50000, high: 60000, priceYear: 2025, recurrence: 'PER_YEAR', basis: 'two officers at the mid band' },
      { actionId: live[1].id, label: 'Case-management system', costType: 'OTHER', low: 20000, high: 30000, priceYear: 2025, recurrence: 'PER_YEAR', durationMonths: 36, basis: 'a supplier quote' },
      { actionId: live[2].id, label: 'Hearing room fit-out', costType: 'CAPITAL', low: 120000, high: 150000, priceYear: 2025, recurrence: 'ONE_OFF', appraisal: { ob: { type: 'standard-buildings', lowered: null } } },
    ] })
    await prisma.benefitLine.createMany({ data: [
      { actionId: live[0].id, label: 'Faster decisions on complaints', beneficiary: 'CITIZENS', measure: 'days from complaint to decision', low: 80000, high: 90000, priceYear: 2025, recurrence: 'PER_YEAR', valuation: 'VALUED', sourceKind: 'OWNER', ownerReason: 'two days saved per case' },
      { actionId: live[1].id, label: 'Fewer appeals', beneficiary: 'EXCHEQUER', valuation: 'NOT_VALUED', notValuedWhy: 'no held source counts appeals' },
      { actionId: live[3].id, label: 'Trust in the service', beneficiary: 'CITIZENS', valuation: 'NOT_VALUED', notValuedWhy: 'no source measures trust yet' },
    ] })
    const inputs = await cbaInputs(scratch.id)
    const r = computeCba(inputs!.input)
    console.log(`copy ${scratch.id.slice(0, 8)}: ${existing} lines copied + 3 cost and 3 benefit lines added; prompt ${narrativeUser(inputs!.input).length.toLocaleString('en-GB')} characters; model ${NARRATIVE_MODEL}`)
    const pence: number[] = []
    for (let i = 0; i < runs; i++) {
      const n = await writeNarrative(inputs!.input, r, { ideaId: scratch.id, userId: scratch.userId, pass: 'cba.narrative.measure' })
      const p = n.ok ? (n as { data: { pence: number | null; cut: number; costs: string; benefits: string } }).data : null
      console.log(`run ${i + 1}: ${n.ok ? `${p!.pence?.toFixed(2)}p, ${p!.cut} sentence(s) cut, ${p!.costs.length + p!.benefits.length} chars` : `FAILED — ${(n as { error: string }).error} (${(n as { pence: number | null }).pence ?? 0}p)`}`)
      if (n.ok && p!.pence != null) pence.push(p!.pence)
      if (i === 0 && n.ok) console.log(`  costs: ${p!.costs}\n  benefits: ${p!.benefits}`)
    }
    if (pence.length) console.log(`MEASURED: n=${pence.length}, mean ${(pence.reduce((a, b) => a + b, 0) / pence.length).toFixed(2)}p, max ${Math.max(...pence).toFixed(2)}p (${pence.map((x) => x.toFixed(2)).join(', ')})`)
  } finally {
    console.log(`(scratch copy deleted: ${await deleteScratch(scratch.id)})`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
