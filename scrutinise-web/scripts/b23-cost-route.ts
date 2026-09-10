export {}

// ─────────────────────────────────────────────────────────────────────────────
// CCW-B22 §6 — RUN THE COST ROUTE. Propose, show, then (only if asked) write.
//
// Measured before building: **1 of 135 coherent actions carried a cost line**, with the schema,
// the write path and 53 `CostBenchmark` rows all in place and nothing driving them.
//
// ⚠ Proposing and writing are separate commands, for the reason the spawn pass established: a
// producer that is not deterministic must not be able to grow its own output on a re-run.
//
//   npx tsx --env-file=.env scripts/b23-cost-route.ts                   (plan)
//   npx tsx --env-file=.env scripts/b23-cost-route.ts --go --only M-01
//   npx tsx --env-file=.env scripts/b23-cost-route.ts --go --only M-01 --write
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { prisma } from '../lib/prisma'
import { proposeCosts, writeCosts, costKindOf, COST_KIND_CAVEAT } from '../lib/lex/cost-route'
import type { CostProposal } from '../lib/lex/cost-route'

const BUILDS = join(__dirname, '../../docs/report_run/builds')
const OUT = join(__dirname, '../../docs/report_run/appendices/COSTS.md')
const GO = process.argv.includes('--go')
const WRITE = process.argv.includes('--write')
const onlyArg = process.argv.indexOf('--only')
const ONLY = onlyArg > -1 ? process.argv[onlyArg + 1] : null
const ALL = Array.from({ length: 12 }, (_, i) => `M-${String(i + 1).padStart(2, '0')}`)

const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim()
const money = (n: number, unit: string) =>
  `${unit === 'GBP' ? '£' : ''}${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}${unit === 'GBP' ? '' : ` ${unit}`}`

interface Row {
  ref: string; title: string; ideaId: string
  actions: number
  proposal: CostProposal | null
  written: number; skippedActions: string[]
  tokensIn: number; tokensOut: number
}

async function main() {
  mkdirSync(join(__dirname, '../../docs/report_run/appendices'), { recursive: true })
  const refs = ONLY ? [ONLY] : ALL
  console.log(`${refs.length} measure(s) · ${WRITE ? '⚠ WILL WRITE COST LINES' : 'propose only'}\n`)
  if (!GO) { console.log('PLAN ONLY — nothing called. Re-run with --go.'); await prisma.$disconnect(); return }

  const rows: Row[] = []
  for (const ref of refs) {
    let ideaId: string
    try { ideaId = JSON.parse(readFileSync(join(BUILDS, `${ref}.json`), 'utf8')).idea.id } catch { continue }
    const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })
    if (!idea) continue
    const actions = await prisma.lexCoherentAction.count({ where: { ideaId } })

    const usages: Array<{ tokensIn: number; tokensOut: number }> = []
    const proposal = actions ? await proposeCosts({ ideaId, onUsage: (u) => usages.push(u) }) : null
    const row: Row = {
      ref, title: idea.title, ideaId, actions, proposal, written: 0, skippedActions: [],
      tokensIn: usages.reduce((a, b) => a + (b.tokensIn ?? 0), 0),
      tokensOut: usages.reduce((a, b) => a + (b.tokensOut ?? 0), 0),
    }
    console.log(`  ${ref}  ${actions} action(s) · ${proposal ? `${proposal.lines.length} line(s), `
      + `${proposal.dropped.length} dropped, ${proposal.notCosted.length} not costed` : 'no proposal'}`)
    for (const d of proposal?.dropped ?? []) console.log(`        ⚠ dropped "${d.label}" — ${d.why}`)

    if (WRITE && proposal?.lines.length) {
      const w = await writeCosts(proposal.lines, process.argv.includes('--extend'))
      row.written = w.written
      row.skippedActions = w.skippedActions
      console.log(`        → ${w.written} written${w.skippedActions.length ? `, ${w.skippedActions.length} action(s) skipped (already costed)` : ''}`)
    }
    rows.push(row)
  }

  const L: string[] = []
  L.push('# Appendix — what the actions would cost')
  L.push('')
  L.push(`*Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.*`)
  L.push('')
  L.push(`> ⚠⚠ **${COST_KIND_CAVEAT}**`)
  L.push('')
  L.push(`The costing attempts \`${costKindOf()}\`. **The heading above this section may not promise`)
  L.push('more than that** — when the module is widened to human costs and benefits, that value')
  L.push('changes and the wording may change with it, in that order and not the other.')
  L.push('')
  L.push('## How to read it')
  L.push('')
  L.push('- **Every figure is a range, and the width is information.** A narrow range means the basis')
  L.push('  is firm; a wide one means it is not. A single number would be false precision.')
  L.push('- **Every line states its basis.** A line whose basis could not be stated was dropped, not')
  L.push('  softened — and the drops are listed, because a silently shorter table reads as a cheaper')
  L.push('  policy.')
  L.push('- ⚠ **A cited benchmark and a reasoned estimate are marked differently and must not be**')
  L.push('  **conflated.** A Green Book unit cost and a plausible guess look identical once both are')
  L.push('  numbers in a table. Lines marked *reasoned* rest on the model\'s own assumptions.')
  L.push('- ⚠ **Nothing here is totalled.** Adding implementation, enforcement and friction across')
  L.push('  measures would produce a number with no owner and no basis.')
  L.push('')
  L.push('| Measure | Actions | Lines | Dropped | Not costed |')
  L.push('|---|---|---|---|---|')
  for (const r of rows) {
    L.push(`| ${r.ref} — ${esc(r.title)} | ${r.actions} | ${r.proposal?.lines.length ?? '⚠ none'} `
      + `| ${r.proposal?.dropped.length ?? '—'} | ${r.proposal?.notCosted.length ?? '—'} |`)
  }
  L.push('')
  L.push('---')
  L.push('')

  for (const r of rows) {
    L.push(`## ${r.ref} — ${r.title}`)
    L.push('')
    if (!r.proposal) {
      L.push(`⚠ **No costing.** ${r.actions ? 'The pass did not complete.' : 'This measure has no coherent actions to cost.'}`)
      L.push('')
      continue
    }
    const p = r.proposal
    L.push(`*${r.actions} action(s) · ${p.lines.length} cost line(s) · ${p.benchmarksOffered} benchmark(s) offered `
      + `· ${r.tokensIn} tokens in / ${r.tokensOut} out${r.written ? ` · **${r.written} written**` : ''}.*`)
    L.push('')
    if (p.lines.length) {
      L.push('| Line | Category | Range | Basis | Source |')
      L.push('|---|---|---|---|---|')
      for (const l of p.lines) {
        L.push(`| ${esc(l.label)} | \`${l.category}\` / \`${l.costType}\` `
          + `| ${money(l.low, l.unit)} – ${money(l.high, l.unit)}${l.priceYear ? ` (${l.priceYear} prices)` : ''} `
          + `| ${esc(l.basis).slice(0, 260)} `
          + `| ${l.benchmarkId ? `benchmark \`${l.benchmarkId.slice(0, 8)}\`` : '*reasoned — no benchmark*'} |`)
      }
      L.push('')
    } else {
      L.push('**No cost line survived.** ⚠ That is not the same as "this is free".')
      L.push('')
    }
    if (p.dropped.length) {
      L.push(`### ⚠ ${p.dropped.length} line(s) dropped`)
      L.push('')
      L.push('Listed because a silently shorter table reads as a cheaper policy.')
      L.push('')
      for (const d of p.dropped) L.push(`- **${esc(d.label)}** — ${esc(d.why)}`)
      L.push('')
    }
    if (p.notCosted.length) {
      L.push(`### ${p.notCosted.length} action(s) the pass declined to cost`)
      L.push('')
      L.push('⚠ An honest gap. "The scope is not specified enough to cost" is a real answer, and an')
      L.push('invented figure would be worse — a gap gets filled, a figure gets used.')
      L.push('')
      for (const n of p.notCosted) L.push(`- **${esc(n.step).slice(0, 130)}** — ${esc(n.why)}`)
      L.push('')
    }
    if (r.skippedActions.length) {
      L.push(`⚠ ${r.skippedActions.length} action(s) already carried cost lines and were not written to.`)
      L.push('')
    }
    L.push('---')
    L.push('')
  }

  writeFileSync(OUT, L.join('\n'), 'utf8')
  console.log(`\nwritten: ${OUT}`)
  if (!WRITE) console.log('⚠ PROPOSED ONLY — no cost lines were written to the database.')
  await prisma.$disconnect()
}

main().catch(async (e) => { console.error('ERROR:', e); await prisma.$disconnect().catch(() => {}); process.exit(1) })
