// ─────────────────────────────────────────────────────────────────────────────
// §19-D Task 7 — the cost summary, pinned to known inputs and an expected total.
//
// The walk-through produced "£57/year" for an enforcement cost that could not be
// right for the inputs given. Tracing it found the arithmetic FAITHFUL and the
// SENTENCE dishonest: one line (low=57, high=null, no basis, no price year) was
// summed correctly and then described as a range, with a stated basis, uprated to
// 2025 prices — three claims, none of them true of that figure.
//
// So this check has to assert two different kinds of thing:
//   · the numbers        — a known set of lines totals to a known figure, and the
//                          GDP-deflator uprating does what it says on a 2019 value;
//   · the claims         — the prose never asserts a range, a basis or an uprating
//                          the figures do not support.
//
// It creates a temporary idea + action + cost lines and deletes them in a finally.
// Run: npm run check:cost-summary
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { computeCostSummary } from '../lib/lex/field-machine'

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!url) throw new Error('DIRECT_URL/DATABASE_URL not set')
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, ssl: { rejectUnauthorized: false } }),
} as never)

let fail = 0
const ok = (label: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`✓ ${label}`)
  else { console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`); fail++ }
}
const near = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol

type Totals = {
  implementationCost: { low: number; high: number; n: number; oneSided: number } | null
  enforcementCost: { low: number; high: number; n: number; oneSided: number } | null
  regulatoryFriction: { low: number; high: number; n: number; oneSided: number } | null
  priceYear: number | null
  figures: number; oneSided: number; noBasis: number; noPriceYear: number; uprated: number
  eandcbFlag: boolean
}

async function main() {
  const owner = await prisma.user.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } })
  if (!owner) { console.error('No user in the DB to own a test idea.'); process.exit(1) }

  const deflator = await prisma.deflatorSeries.findMany({ select: { year: true, index: true } })
  const targetYear = deflator.length ? Math.max(...deflator.map((d) => d.year)) : null
  const idxOf = (y: number) => Number(deflator.find((d) => d.year === y)?.index ?? 0)

  let ideaId: string | null = null
  try {
    const idea = await prisma.idea.create({
      data: {
        title: '[§19-D check] cost summary',
        summaryDescription: 'Temporary row created by scripts/check-cost-summary.ts. Deleted at the end of the run.',
        govtArea: '',
        creatorId: owner.id,
        // The Page-2 problem cost the plan is set against.
        whoAffectedImpactCost: { cost: '£40m a year' } as never,
      },
      select: { id: true },
    })
    ideaId = idea.id

    const action = await prisma.lexCoherentAction.create({
      data: { ideaId: idea.id, practicalStep: 'Stand up an enforcement unit', source: 'USER' as never, orderIndex: 0 },
      select: { id: true },
    })

    // ── KNOWN INPUTS ────────────────────────────────────────────────────────
    // Two-sided, with a basis, at 2025 prices (the deflator target) → passes straight
    // through; one-sided with no basis and no price year → the 10 Aug shape exactly.
    await prisma.costLine.createMany({
      data: [
        {
          actionId: action.id, label: 'Build the register', costType: 'CAPITAL' as never,
          category: 'IMPLEMENTATION' as never, low: 2_000_000, high: 3_000_000, unit: 'GBP',
          basis: 'Comparable register build, 2025 prices', priceYear: targetYear, orderIndex: 0,
        },
        {
          actionId: action.id, label: 'Inspectors', costType: 'STAFF' as never,
          category: 'ENFORCEMENT' as never, low: 400_000, high: 600_000, unit: 'GBP',
          basis: '8 FTE × 12 months at ASHE median', priceYear: targetYear, orderIndex: 1,
        },
        {
          // The walk-through's line: a bare figure, no upper bound, no basis, no year.
          actionId: action.id, label: 'Tax collection cost', costType: 'OTHER' as never,
          category: 'ENFORCEMENT' as never, low: 57, high: null, unit: 'GBP',
          basis: null, priceYear: null, orderIndex: 2,
        },
        {
          // A 2019 figure, to prove the uprating is applied and in the right direction.
          actionId: action.id, label: 'Compliance time on business', costType: 'OTHER' as never,
          category: 'FRICTION' as never, low: 1_000_000, high: 1_000_000, unit: 'GBP',
          basis: 'Home Office unit cost', priceYear: 2019, orderIndex: 3,
        },
      ],
    })

    const { summary, totals: rawTotals } = await computeCostSummary(idea.id)
    const t = rawTotals as unknown as Totals
    console.log(`\n  summary: ${summary}\n`)

    // ── the numbers ─────────────────────────────────────────────────────────
    ok('implementation totals the two-sided line exactly',
      !!t.implementationCost && near(t.implementationCost.low, 2_000_000) && near(t.implementationCost.high, 3_000_000),
      JSON.stringify(t.implementationCost))

    ok('enforcement sums both its lines (400,057 – 600,057)',
      !!t.enforcementCost && near(t.enforcementCost.low, 400_057) && near(t.enforcementCost.high, 600_057),
      JSON.stringify(t.enforcementCost))

    if (targetYear && idxOf(2019) > 0) {
      const expected = 1_000_000 * (idxOf(targetYear) / idxOf(2019))
      ok(`the 2019 friction figure is uprated to ${targetYear} (£1,000,000 → £${Math.round(expected).toLocaleString()})`,
        !!t.regulatoryFriction && near(t.regulatoryFriction.low, expected, 2),
        JSON.stringify(t.regulatoryFriction))
      ok('uprating moves the figure UP, not down', !!t.regulatoryFriction && t.regulatoryFriction.low > 1_000_000)
    } else {
      console.log('… skipped: no deflator series in this database, so uprating cannot be checked')
    }

    ok('the one-sided line is counted, not hidden', t.oneSided === 1, `oneSided=${t.oneSided} of ${t.figures}`)
    ok('the figure with no basis is counted', t.noBasis === 1, `noBasis=${t.noBasis}`)
    ok('the figure with no price year is counted', t.noPriceYear === 1, `noPriceYear=${t.noPriceYear}`)
    ok('EANDCB is not flagged below the £5m/yr threshold', t.eandcbFlag === false)

    // ── the claims ──────────────────────────────────────────────────────────
    ok('does NOT claim every figure is a range with a stated basis',
      !/Every figure is a range with a stated basis/.test(summary), summary)
    ok('says a single figure was given instead of a range', /single number rather than a range/.test(summary), summary)
    ok('says a figure has no stated basis', /no stated basis/.test(summary), summary)
    ok('does NOT claim all figures were uprated',
      !/all figures uprated/.test(summary), summary)
    ok('says how many figures were uprated and how many were not',
      /figures uprated to \d{4} prices; \d+ carr(?:y|ies) no price year/.test(summary), summary)
    ok('carries the Page-2 problem cost', summary.includes('£40m a year'), summary)

    // The £57 must not appear as a confident standalone total; it is inside a sum.
    ok('the enforcement figure reads as the SUM, not as the £57 line',
      /£400,057/.test(summary), summary)

    // ── the all-clean case: the reassuring sentence must still be reachable ──
    await prisma.costLine.deleteMany({ where: { actionId: action.id, basis: null } })
    await prisma.costLine.updateMany({ where: { actionId: action.id }, data: { priceYear: targetYear } })
    const clean = await computeCostSummary(idea.id)
    console.log(`\n  clean-case summary: ${clean.summary}\n`)
    ok('with every figure two-sided, based and dated, it says so',
      /Every figure is a range with a stated basis/.test(clean.summary), clean.summary)
    ok('…and claims a full uprating only then',
      targetYear ? new RegExp(`all figures uprated to ${targetYear} prices`).test(clean.summary) : true, clean.summary)
  } finally {
    if (ideaId) {
      await prisma.costLine.deleteMany({ where: { action: { ideaId } } })
      await prisma.lexCoherentAction.deleteMany({ where: { ideaId } })
      await prisma.ideaFieldState.deleteMany({ where: { ideaId } })
      await prisma.idea.delete({ where: { id: ideaId } }).catch(() => {})
      console.log(`cleaned up test idea ${ideaId}`)
    }
    await prisma.$disconnect()
  }

  console.log(fail ? `\n${fail} FAILURE(S)` : '\nall checks passed')
  process.exit(fail ? 1 : 0)
}

main()
