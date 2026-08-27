// ─────────────────────────────────────────────────────────────────────────────
// §6 — size the statutory-consequences pass before wiring it into every build.
//
// ⚠ CEILING: TWO LIVE RUNS — one small target, one large. Each invocation is ONE model
// call, because classification runs over GROUPS and never over references.
//
// Reports the measured cost, the duration, and the pricing implication — stated, never
// decided (§6: "Report the figure; do not choose").
//
// Usage:
//   tsx --env-file=.env scripts/measure-consequences.ts ukpga/2010/25
//   tsx --env-file=.env scripts/measure-consequences.ts ukpga/2010/15 --provision section-3
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { inboundFor, describeCoverage, coverageStateKey } from '../lib/lex/statutory-graph'
import { groupReferences, describeScale, classifyGroups } from '../lib/lex/statutory-consequences'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const target = process.argv[2]
  if (!target || target.startsWith('--')) {
    console.error('usage: measure-consequences.ts <gid> [--provision section-N]')
    process.exitCode = 1
    return
  }
  const provision = arg('--provision') ?? null

  const t0 = Date.now()
  const inbound = await inboundFor(target, provision)
  const tGraph = Date.now() - t0

  const grouped = groupReferences(inbound.rows, inbound.titleOnly.length)
  const tGroup = Date.now() - t0 - tGraph

  console.log(`══ ${target}${provision ? ` ${provision}` : ''} ══`)
  console.log(describeScale(grouped))
  console.log('')

  const t1 = Date.now()
  const out = await classifyGroups(target, grouped)
  const tLlm = Date.now() - t1

  for (const g of out.groups) {
    console.log(`  ${String(g.members.length).padStart(5)}  ${g.disposition.toUpperCase().padEnd(10)} ${g.label}`)
    console.log(`         ${g.reason}`)
    if (g.evidence) {
      console.log(`         evidence [${g.evidence.sourceGid} ${g.evidence.provision}]:`)
      console.log(`           "${g.evidence.words.slice(0, 150)}"`)
    } else {
      console.log(`         ⚠ NO EVIDENCE — this group has no quotable words`)
    }
  }
  if (out.note) console.log(`\n  note: ${out.note}`)

  console.log(`\n── coverage, adjacent to the count ──`)
  console.log(`  ${describeCoverage(inbound.coverage)}`)
  console.log(`\n  cache key: ${coverageStateKey(inbound.coverage)}`)

  console.log(`\n── cost and time ──`)
  console.log(`  graph query      ${tGraph} ms`)
  console.log(`  grouping (code)  ${tGroup} ms   ⚠ no model call`)
  console.log(`  classification   ${tLlm} ms   ONE model call over ${grouped.totalGroups} groups`)
  console.log(`  classified cleanly: ${out.classified}`)

  console.log(`  tokens         ${out.spend?.tokensIn.toLocaleString()} in / ${out.spend?.tokensOut.toLocaleString()} out`)
  console.log(`  COST           ${out.spend?.pence.toFixed(4)}p`)

  // ⚠ RE-READ FROM THE LEDGER, not taken from the return value. `recordSpend` swallows its
  // own failures by design so a ledger fault cannot kill the work it measures — which means
  // "it returned a price" and "a row exists" are different facts, and only the second is
  // the one a pricing decision rests on.
  const led = await prisma.$queryRawUnsafe<Array<{ n: bigint; pence: number | null }>>(`
    SELECT COUNT(*)::bigint AS n, SUM("estCostPence")::float AS pence
    FROM "LlmSpend"
    WHERE "pass" = 'deepening.consequences' AND "ref" = $1
      AND "createdAt" > now() - interval '10 minutes'`, target)
  console.log(`  ledger re-read: ${Number(led[0]?.n ?? 0)} row(s), ${led[0]?.pence ?? '—'}p`)
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
