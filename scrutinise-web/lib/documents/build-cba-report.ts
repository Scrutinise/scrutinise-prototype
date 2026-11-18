// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Y §4b (decision 336) — THE COST–BENEFIT REPORT, an Output Report. PURE: it ARRANGES the engine's result; no figure is computed here.
//
// Order (341: Gaps before the totals): the one-page summary → GAPS → ASSUMPTIONS → the tables (by year, by heading, by payer, by
// beneficiary, sensitivity, optimism bias per line) → Lex's narrative (labelled as Lex's) → the caveat → ANNEX: the trace.
//
// ⚠ EVERY PRINTED FIGURE GOES THROUGH `fig(traceId)`: it prints the engine's own words for that figure and a [T n] mark, and the annex
//   lists every mark with its lines, deflator rows, schedule years and Table 1 rows. A figure with no trace id cannot be printed — `fig`
//   throws — so "every printed figure has a trace" is a property of the code, and check:lex-26y part 3 asserts it on the rendered text.
// ─────────────────────────────────────────────────────────────────────────────

import type { Block, DocumentModel, Run } from './model'
import { type CbaResult, NOT_VALUED_WORDS, CAVEAT, rangeWords, OB_INDICATIVE } from '@/lib/lex/cba/engine-pure'
import { ENGINE_CITATIONS } from '@/lib/lex/cba/citation-manifest-pure'
import { fyWords } from '@/lib/lex/cba/period'
import { pct } from '@/lib/lex/cba/line-appraisal'
import type { Narrative } from '@/lib/lex/cba/narrative'

export const CBA_REPORT_TITLE = 'Cost–benefit analysis'

export interface CbaReportMeta { ideaTitle: string; version: number; heldOn: string; generatedAt: Date; narrativeNote: string | null }

export function buildCbaReport(r: Extract<CbaResult, { ok: true }>, narrative: Narrative | null, meta: CbaReportMeta): { model: DocumentModel; printed: string[] } {
  const printed: string[] = []
  const mark = new Map<string, number>()
  const fig = (id: string): Run[] => {
    const t = r.trace[id]
    if (!t) throw new Error(`cba report: no trace for figure "${id}"`)
    if (!mark.has(id)) { mark.set(id, mark.size + 1); printed.push(id) }
    return [{ text: t.value }, { text: ` [T${mark.get(id)}]`, italic: true }]
  }
  const cell = (id: string): Run[] => fig(id)
  const txt = (s: string): Run[] => [{ text: s }]
  const P = r.period
  const blocks: Block[] = []

  // ── 1 · the one-page summary ──
  blocks.push({ kind: 'section', title: 'SUMMARY' })
  blocks.push({ kind: 'table', header: [txt('Measure'), txt('Figure')], rows: [
    [txt('Net present value'), r.npv ? fig('npv') : txt(`not computed — ${NOT_VALUED_WORDS}`)],
    [txt('Benefit–cost ratio'), r.bcr ? fig('bcr') : txt(NOT_VALUED_WORDS)],
    [txt('Present value of costs'), fig('pv-costs')],
    [txt('Present value of valued benefits'), r.benefitsValued ? fig('pv-benefits') : txt('no benefit is valued')],
    [txt('Appraisal period'), txt(`${P.years} years, ${fyWords(P.startYear)} to ${fyWords(P.startYear + P.years - 1)}${P.set.years ? ' (the owner’s)' : ' (default)'}`)],
    [txt('Price year and PV base year'), txt(`${fyWords(P.priceYear)}${P.set.priceYear ? ' (the owner’s)' : P.priceYearFrom === 'current-year' ? ' (default: the current financial year; no deflator series is held)' : ' (default: the latest deflator release held)'}`)],
  ] })
  // 342 — optimism bias beside the headline, never in it, with the guidance's own caveat
  if (r.obBand) {
    blocks.push({ kind: 'paragraph', runs: [{ text: 'Optimism bias (not in the figures above): ', bold: true }, ...fig('ob-band'), { text: `. ${r.obBand.capital} capital line${r.obBand.capital === 1 ? '' : 's'} by project type; ${r.obBand.opex} running-cost line${r.obBand.opex === 1 ? '' : 's'} by Table 1’s outsourcing row — the nearest analogue in the guidance, not a rule.` }] })
    blocks.push({ kind: 'note', text: `“${OB_INDICATIVE}” (${ENGINE_CITATIONS.obIndicative})` })
  }
  const notValued = r.gaps.filter((g) => g.kind === 'not-valued')
  blocks.push({ kind: 'paragraph', runs: [{ text: 'What is not valued: ', bold: true }, { text: notValued.length ? `${notValued.length} benefit ${notValued.length === 1 ? 'line is' : 'lines are'} recorded but not valued, so ${notValued.length === 1 ? 'it is' : 'they are'} in no figure above (listed under Gaps).` : r.benefitsValued ? 'every recorded benefit line is valued.' : 'no benefit is valued.' }] })
  blocks.push({ kind: 'paragraph', runs: [{ text: 'Gaps: ', bold: true }, { text: `${r.gaps.length}, set out next, before any table. Read them before the figures.` }] })

  // ── 2 · GAPS (341) — before the totals ──
  blocks.push({ kind: 'section', title: 'GAPS' })
  blocks.push({ kind: 'note', text: 'What is not valued, what has no duration, which assumptions are the owner’s, which sources are floors, and what the platform does not yet hold.' })
  blocks.push({ kind: 'bullets', ordered: true, items: r.gaps.map((g) => txt(g.text)) })

  // ── 3 · ASSUMPTIONS ──
  blocks.push({ kind: 'section', title: 'ASSUMPTIONS' })
  blocks.push({ kind: 'table', header: [txt('Assumption'), txt('Source')], rows: r.assumptions.map((a) => [txt(a.text), txt(a.owners ? 'the owner’s' : a.source)]) })

  // ── 4 · the tables ──
  blocks.push({ kind: 'section', title: 'COSTS AND BENEFITS BY YEAR' })
  blocks.push({ kind: 'note', text: `In ${fyWords(P.priceYear)} prices. Year 0 of the discount schedule is ${fyWords(P.priceYear)}; factors are Annex A’s, as published to 4 decimal places. Ranges run low to high.` })
  blocks.push({ kind: 'table', header: [txt('Year'), txt('Discount factor'), txt('Costs'), txt('PV costs'), txt('Benefits'), txt('PV benefits')], rows: r.years.map((y) => [
    txt(`${fyWords(y.fy)} (year ${y.discountYear})`), txt(y.factor.toFixed(4)), cell(`y${y.t}.costs`), cell(`y${y.t}.pv-costs`),
    r.benefitsValued ? cell(`y${y.t}.benefits`) : txt('not valued'), r.benefitsValued ? cell(`y${y.t}.pv-benefits`) : txt('not valued'),
  ]).concat([[ [{ text: 'Total', bold: true }], txt(''), fig('costs'), fig('pv-costs'), r.benefitsValued ? fig('benefits') : txt('not valued'), r.benefitsValued ? fig('pv-benefits') : txt('not valued') ]]) })
  if (r.undated.lines) blocks.push({ kind: 'paragraph', runs: [{ text: 'Not placed in any year: ', bold: true }, ...fig('undated.costs'), { text: ` across ${r.undated.lines} cost ${r.undated.lines === 1 ? 'line' : 'lines'} that say neither one-off nor per year. Counted here, in no year, and not discounted.` }] })

  blocks.push({ kind: 'section', title: 'BY HEADING' })
  blocks.push({ kind: 'table', header: [txt('Heading'), txt('PV costs'), txt('PV benefits')], rows: r.byHeading.map((g) => [txt(g.words), cell(`heading:${g.key || 'none'}.pv-costs`), r.benefitsValued ? cell(`heading:${g.key || 'none'}.pv-benefits`) : txt('not valued')]) })
  blocks.push({ kind: 'section', title: 'BY PAYER AND BY BENEFICIARY' })
  blocks.push({ kind: 'table', header: [txt('Who pays'), txt('PV costs')], rows: r.byPayer.length ? r.byPayer.map((g) => [txt(g.words), cell(`payer:${g.key}.pv-costs`)]) : [[txt('no costed line'), txt('—')]] })
  blocks.push({ kind: 'table', header: [txt('Who gains'), txt('PV valued benefits')], rows: r.byBeneficiary.length ? r.byBeneficiary.map((g) => [txt(g.words), cell(`beneficiary:${g.key}.pv-benefits`)]) : [[txt('no valued benefit'), txt('—')]] })

  blocks.push({ kind: 'section', title: 'SENSITIVITY' })
  blocks.push({ kind: 'note', text: 'Each row changes one thing and recomputes. They are tests of how much the answer moves, not forecasts.' })
  blocks.push({ kind: 'table', header: [txt('Test'), txt('PV costs'), txt('PV benefits'), txt('NPV'), txt('BCR')], rows: r.sensitivity.map((s) => [
    s.lost ? [{ text: `${s.label} — ${s.note}: ` }, ...fig(`sens:${s.key}.lost`)] : txt(s.label), cell(`sens:${s.key}.pv-costs`), r.benefitsValued ? cell(`sens:${s.key}.pv-benefits`) : txt('not valued'),
    s.npv ? cell(`sens:${s.key}.npv`) : txt(NOT_VALUED_WORDS), s.bcr ? cell(`sens:${s.key}.bcr`) : txt(NOT_VALUED_WORDS),
  ]) })

  blocks.push({ kind: 'section', title: 'OPTIMISM BIAS' })
  blocks.push({ kind: 'note', text: `Optimism bias never adjusts the headline figures (decision 342): it is the band in the summary. “${OB_INDICATIVE}” (${ENGINE_CITATIONS.obIndicative})` })
  blocks.push({ kind: 'table', header: [txt('Line'), txt('Band'), txt('Why'), txt('Source')], rows: r.optimismBias.map((o) => [txt(`#${o.actionNumber ?? '?'} ${o.label}`), txt(o.band ? `${pct(o.band.lower)}–${pct(o.band.upper)}` : 'none'), txt(o.why), txt(o.source || '—')]) })

  blocks.push({ kind: 'section', title: 'THE LINES' })
  blocks.push({ kind: 'table', header: [txt('Line'), txt('Figure'), txt('What was done')], rows: r.lines.map((l) => [txt(`${l.side === 'cost' ? 'Cost' : 'Benefit'} · #${l.actionNumber ?? '?'} ${l.label} · ${l.side === 'cost' ? 'paid by' : 'for'} ${l.payer}`), cell(`line:${l.id}`), txt(l.steps.join('; ') || (l.whyNot ?? 'as entered'))]) })

  // ── 5 · Lex's narrative ──
  blocks.push({ kind: 'section', title: 'WHAT THE COSTS AND BENEFITS ARE' })
  if (narrative && (narrative.costs || narrative.benefits)) {
    blocks.push({ kind: 'note', text: `Written by Lex from the lines above (${narrative.model}). It states no figure: the figures are in the tables, each with its trace.${narrative.cut ? ` ${narrative.cut} sentence${narrative.cut === 1 ? '' : 's'} that stated a figure or cited a source not on the lines ${narrative.cut === 1 ? 'was' : 'were'} removed.` : ''}` })
    if (narrative.costs) blocks.push({ kind: 'paragraph', runs: txt(narrative.costs) })
    if (narrative.benefits) blocks.push({ kind: 'paragraph', runs: txt(narrative.benefits) })
  } else blocks.push({ kind: 'note', text: meta.narrativeNote ?? 'No narrative was written for this version.' })

  // ── 6 · caveat ──
  blocks.push({ kind: 'paragraph', runs: [{ text: CAVEAT(meta.heldOn), italic: true }] })
  blocks.push({ kind: 'paragraph', runs: [{ text: `Citations: ${r.citations.join(', ')}. Each is a paragraph of HM Treasury guidance the platform holds; sources on the lines are [Ref: n] in the idea’s numbered list.`, italic: true }] })

  // ── ANNEX · the trace ──
  blocks.push({ kind: 'section', title: 'ANNEX — THE TRACE' })
  blocks.push({ kind: 'note', text: 'Every figure above carries a mark [T n]. Here is where each one comes from: the lines it sums, the deflator rows used to convert them, the years of the discount schedule, and any Table 1 row.' })
  blocks.push({ kind: 'table', header: [txt('Mark'), txt('Figure'), txt('From')], rows: printed.map((id) => {
    const t = r.trace[id]
    const from = [
      t.lines.length ? `${t.lines.length} line${t.lines.length === 1 ? '' : 's'} (${t.lines.map((x) => lineName(r, x)).join('; ')})` : 'no line',
      t.deflatorYears.length ? `deflator rows ${t.deflatorYears.map(fyWords).join(', ')}` : '',
      t.scheduleYears.length ? `schedule years ${span(t.scheduleYears)}` : '',
      ...t.tableRows,
      t.how,
    ].filter(Boolean).join(' · ')
    return [txt(`T${mark.get(id)}`), txt(`${t.label}: ${t.value}`), txt(from)]
  }) })

  const model: DocumentModel = {
    title: `${meta.ideaTitle} — ${CBA_REPORT_TITLE}`,
    subtitle: `Version ${meta.version}. ${P.years} years from ${fyWords(P.startYear)}, ${fyWords(P.priceYear)} prices. ${r.npv ? `NPV ${rangeWords(r.npv)}.` : 'Benefits not valued — no NPV, no BCR.'}`,
    sourceLabel: 'the action’s cost and benefit lines, and HM Treasury guidance as held',
    generatedAt: meta.generatedAt,
    blocks,
  }
  return { model, printed }
}

function lineName(r: Extract<CbaResult, { ok: true }>, id: string): string {
  const l = r.lines.find((x) => x.id === id)
  return l ? `#${l.actionNumber ?? '?'} ${l.label}` : id
}
function span(ys: number[]): string {
  if (!ys.length) return ''
  const s = [...ys].sort((a, b) => a - b)
  return s.length > 2 && s[s.length - 1] - s[0] === s.length - 1 ? `${s[0]}–${s[s.length - 1]}` : s.join(', ')
}
