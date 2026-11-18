// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Y §3 — THE COSTING COMPANION, RE-TEMPLATED (26-V2b kind "Costing"). The action's costing in Green Book shape, GENERATED MOSTLY
// WITHOUT A MODEL: the engine run over this action's lines alone, set out as
//   1 Cost lines · 2 Benefit lines · 3 Assumptions · 4 Totals in the price year, then present value per year · 5 Optimism bias per line ·
//   6 Gaps · 7 Caveat
// and Lex's two-paragraph narrative (the only model call) under "What the costs and benefits are". It lands as a PROPOSAL on the action's
// Costing document, like every other draft, never over the owner's version.
// ⚠ Before 26-Y the whole costing was a model's prose over the lines. Now every figure in it is the engine's, in a table.
// ─────────────────────────────────────────────────────────────────────────────

import { runCba } from './engine'
import { type CbaResult, CAVEAT, rangeWords, NOT_VALUED_WORDS, OB_INDICATIVE, obBandWords } from './engine-pure'
import { ENGINE_CITATIONS } from './citation-manifest-pure'
import { fyWords } from './period'
import { pct } from './line-appraisal'
import { writeNarrative, type Narrative } from './narrative'
import { writeTextProposal } from '../action-documents'
import { prisma } from '@/lib/prisma'

type Ok = Extract<CbaResult, { ok: true }>
const cell = (s: string) => s.replace(/\|/g, '/').replace(/\s+/g, ' ').trim()
const row = (cells: string[]) => `| ${cells.map(cell).join(' | ')} |`
const table = (head: string[], rows: string[][]) => [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n')

/** The companion's body. PURE given the result: every figure is the engine's own words for it. */
export function costingCompanionBody(r: Ok, narrative: Narrative | null, heldOn: string, narrativeNote: string | null): string {
  const P = r.period
  const costs = r.lines.filter((l) => l.side === 'cost'), bens = r.lines.filter((l) => l.side === 'benefit')
  const lineFig = (id: string) => r.trace[`line:${id}`]?.value ?? '—'
  const out: string[] = []
  out.push('## Cost lines', costs.length ? table(['Line', 'Paid by', 'Figure', 'What was done'], costs.map((l) => [l.label, l.payer, lineFig(l.id), l.steps.join('; ') || (l.whyNot ?? 'as entered')])) : 'No cost line is recorded on this action.')
  out.push('', '## Benefit lines', bens.length ? table(['Line', 'For', 'Figure', 'How valued'], bens.map((l) => [l.label, l.payer, l.included ? lineFig(l.id) : 'not valued', l.included ? l.steps.join('; ') || 'as entered' : (l.whyNot ?? 'not valued')])) : 'No benefit line is recorded on this action.')
  out.push('', '## Assumptions', table(['Assumption', 'Source'], r.assumptions.map((a) => [a.text, a.owners ? 'the owner’s' : a.source])))
  out.push('', '## Totals', `In ${fyWords(P.priceYear)} prices over ${P.years} years from ${fyWords(P.startYear)}: costs ${r.trace.costs.value}; present value of costs ${r.trace['pv-costs'].value}; valued benefits ${r.benefitsValued ? r.trace.benefits.value : 'none'}; present value of benefits ${r.benefitsValued ? r.trace['pv-benefits'].value : NOT_VALUED_WORDS}. Net present value: ${r.npv ? rangeWords(r.npv) : `not computed — ${NOT_VALUED_WORDS}`}.`,
    '', table(['Year', 'Factor', 'Costs', 'PV costs', 'Benefits', 'PV benefits'], r.years.map((y) => [fyWords(y.fy), y.factor.toFixed(4), r.trace[`y${y.t}.costs`].value, r.trace[`y${y.t}.pv-costs`].value, r.benefitsValued ? r.trace[`y${y.t}.benefits`].value : 'not valued', r.benefitsValued ? r.trace[`y${y.t}.pv-benefits`].value : 'not valued'])))
  if (r.undated.lines) out.push('', `Not placed in any year: ${r.trace['undated.costs'].value} across ${r.undated.lines} line${r.undated.lines === 1 ? '' : 's'} that say neither one-off nor per year.`)
  out.push('', '## Optimism bias', `Never in the totals above (decision 342). ${r.obBand ? `${obBandWords(r.obBand)}.` : 'No line is banded.'} “${OB_INDICATIVE}” (${ENGINE_CITATIONS.obIndicative})`, '', table(['Line', 'Band', 'Why', 'Source'], r.optimismBias.map((o) => [o.label, o.band ? `${pct(o.band.lower)}–${pct(o.band.upper)}` : 'none', o.why, o.source || '—'])))
  out.push('', '## Gaps', r.gaps.map((g, i) => `${i + 1}. ${g.text}`).join('\n'))
  out.push('', '## What the costs and benefits are', narrative && (narrative.costs || narrative.benefits)
    ? `*Written by Lex from the lines above; it states no figure.*\n\n${narrative.costs}\n\n${narrative.benefits}`
    : `*${narrativeNote ?? 'No narrative was written.'}*`)
  out.push('', '## Caveat', CAVEAT(heldOn))
  return out.join('\n')
}

/** Draft the companion for one action: the engine over its lines, Lex's narrative, written as a PROPOSAL on its Costing document. */
export async function draftCostingCompanion(ideaId: string, actionId: string, userId: string | null, opts: { narrative?: typeof writeNarrative; call?: Parameters<typeof writeNarrative>[2]['call'] } = {}): Promise<{ ok: true; data: { d: string; v: number; pence: number | null; reason: string } } | { ok: false; error: string }> {
  const a = await prisma.lexCoherentAction.findFirst({ where: { id: actionId, ideaId, status: 'LIVE' }, select: { number: true } })
  if (!a) return { ok: false, error: 'That action is not on this idea’s live list. Nothing was drafted.' }
  const run = await runCba(ideaId, { actionId })
  if (!run) return { ok: false, error: 'That idea was not found.' }
  if (!run.result.ok) return { ok: false, error: `The costing was not drafted: ${(run.result as { error: string }).error}` }
  const r = run.result as Ok
  const n = await (opts.narrative ?? writeNarrative)(run.inputs.input, r, { ideaId, userId, pass: 'actions.document.costing', call: opts.call })
  const narrative = n.ok ? (n as { data: Narrative }).data : null
  const note = n.ok ? null : (n as { error: string }).error
  const pence = n.ok ? narrative!.pence : (n as { pence: number | null }).pence
  const body = costingCompanionBody(r, narrative, run.inputs.heldOn, note)
  const reason = [
    `Generated from #${a.number ?? '?'}’s ${r.lines.filter((l) => l.side === 'cost').length} cost and ${r.lines.filter((l) => l.side === 'benefit').length} benefit lines by the cost–benefit engine; every figure is the engine’s, with no model arithmetic.`,
    narrative ? `Lex wrote the two narrative paragraphs only${narrative.cut ? `; ${narrative.cut} sentence${narrative.cut === 1 ? '' : 's'} stating a figure ${narrative.cut === 1 ? 'was' : 'were'} removed` : ''}.` : note ?? '',
    `${r.gaps.length} gap${r.gaps.length === 1 ? '' : 's'} listed.`,
  ].filter(Boolean).join(' ')
  const sources = [...new Set([...body.matchAll(/\[Ref:\s*(\d+)\]/g)].map((m) => Number(m[1])))]
  const w = await writeTextProposal(ideaId, actionId, 'COSTING', 'Costing', { body, reason, pence, sources })
  return { ok: true, data: { d: w.d, v: w.v, pence, reason } }
}
