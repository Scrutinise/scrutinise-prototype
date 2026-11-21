// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Y §4a — the engine's SERVER half: read an idea's lines, its appraisal period, the deflator series and what Ingest holds, and run
// the pure engine. Read-only. The same reader serves the report, the Deepening's section 5, the costing companion (one action) and Lex.
//
// Which lines count (as computeCostSummary, decision 198): a line on a LIVE action, or on a component FOLDED into one (it counts under the
// mechanism's heading and number). Benefit lines: ACCEPTED only — a PROPOSED line is Lex's and waits; SET_ASIDE and REMOVED are kept, not counted.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { computeCba, type CbaResult, type EngineInput, type EngineCostLine, type EngineBenefitLine } from './engine-pure'
import { resolvePeriod, type AppraisalPeriod } from './period'
import { parseLineAppraisal, PARTY_KINDS, type PartyKind } from './line-appraisal'
import { loadManifest } from './citation-manifest'
import { attributionOf, attributionWords } from './attribution'
import { statsConfigured } from '@/lib/stats/stats-db'
import { cssHeld, deflatorRelease, readCell, CSS_DATASET } from '@/lib/stats/cba-cells'
import { css7Key } from '@/lib/stats/cell-pure'
import { STAFF_GRADE_ASSUMED } from './engine-pure'

export interface CbaInputs { input: EngineInput; fingerprint: Record<string, string>; heldOn: string }

/** The benefit line's source in words, or null (then it is not valued, whatever its figure). */
export function benefitSourceWords(b: { sourceKind: string | null; sourceRef: number | null; benchmarkId: string | null; citationKey: string | null; ownerReason: string | null }, bench: Map<string, { source: string; metric: string }>, manifestLabel: (k: string) => string | null): string | null {
  if (b.sourceKind === 'REF' && b.sourceRef != null) return `[Ref: ${b.sourceRef}]`
  if (b.sourceKind === 'BENCHMARK' && b.benchmarkId) { const r = bench.get(b.benchmarkId); return r ? `${r.source} — ${r.metric}` : null }
  if (b.sourceKind === 'CITATION' && b.citationKey) { const l = manifestLabel(b.citationKey); return l ? `${b.citationKey} (${l})` : null }
  if (b.sourceKind === 'OWNER' && b.ownerReason?.trim() && b.ownerReason.trim().length >= 3) return `the owner’s estimate — ${b.ownerReason.trim()}`
  return null
}

/**
 * 26-AA item 9(c) — what Ingest holds, read where Ingest put it: the STATISTICS database (lib/stats). The old test looked for a
 * `civil_service` table and a release column on Neon, which were never going to exist, so both gaps could never close.
 *   · Civil Service Statistics: css-2026's all-levels median is a held value.
 *   · The deflator's release: the index the engine uses (DeflatorSeries) matches one dated release year by year (deflatorRelease).
 * A stats database that cannot be reached leaves both "not held", with why; it never stops the analysis.
 */
async function heldFlags(deflator: ReadonlyArray<{ year: number; index: number }>): Promise<Omit<EngineInput['held'], 'manifest'>> {
  if (!statsConfigured()) return { civilServiceStatistics: false, deflatorReleaseDates: false, deflatorRelease: null, deflatorWhy: 'the statistics database is not configured here', css: null }
  try {
    const grades = [...new Set(Object.values(STAFF_GRADE_ASSUMED))]
    const [css, rel, cells] = await Promise.all([cssHeld(), deflatorRelease(deflator), Promise.all(grades.map((g) => readCell(CSS_DATASET, css7Key(g))))])
    return {
      civilServiceStatistics: css.held,
      css: css.held ? { releaseDate: css.releaseDate, priceBasis: css.priceBasis, floors: Object.fromEntries(grades.map((g, i) => [g, cells[i]])) } : null,
      deflatorReleaseDates: rel.held, deflatorRelease: rel.held && rel.vintage ? { vintage: rel.vintage, releaseDate: rel.releaseDate, priceBasis: rel.priceBasis } : null, deflatorWhy: rel.why,
    }
  } catch (e) {
    return { civilServiceStatistics: false, deflatorReleaseDates: false, deflatorRelease: null, deflatorWhy: `the statistics database could not be read (${e instanceof Error ? e.message.slice(0, 80) : 'error'})`, css: null }
  }
}

/** Everything the engine reads, for one idea (or one action of it). `fingerprint` = one hash-ish string per line + the period, for "stale". */
export async function cbaInputs(ideaId: string, opts: { actionId?: string; now?: Date } = {}): Promise<CbaInputs | null> {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { appraisalYears: true, appraisalStartYear: true, cbaPriceYear: true } })
  if (!idea) return null
  const [actions, headings, deflator, manifest] = await Promise.all([
    prisma.lexCoherentAction.findMany({ where: { ideaId }, select: { id: true, number: true, title: true, practicalStep: true, status: true, headingId: true, foldedIntoId: true, noCostReason: true } }),
    prisma.actionHeading.findMany({ where: { ideaId }, orderBy: { orderIndex: 'asc' }, select: { id: true, name: true } }),
    prisma.deflatorSeries.findMany({ select: { year: true, index: true }, orderBy: { year: 'asc' } }),
    loadManifest(),
  ])
  const flags = await heldFlags(deflator)
  const period: AppraisalPeriod = resolvePeriod(idea, opts.now ?? new Date(), deflator.length ? deflator[deflator.length - 1].year : null)
  const byId = new Map(actions.map((a) => [a.id, a]))
  const home = (id: string) => { const a = byId.get(id); return a?.foldedIntoId ? byId.get(a.foldedIntoId) ?? a : a }
  const counted = actions.filter((a) => (a.status === 'LIVE' || a.foldedIntoId) && (!opts.actionId || a.id === opts.actionId || a.foldedIntoId === opts.actionId))
  const ids = counted.map((a) => a.id)
  const [costRows, benefitRows] = await Promise.all([
    prisma.costLine.findMany({ where: { actionId: { in: ids } }, orderBy: [{ actionId: 'asc' }, { orderIndex: 'asc' }] }),
    prisma.benefitLine.findMany({ where: { actionId: { in: ids }, status: 'ACCEPTED' }, orderBy: [{ actionId: 'asc' }, { orderIndex: 'asc' }] }),
  ])
  // 26-AA item 9(a): the rows behind cost lines too, and their notes, so a licensed figure carries its attribution wherever it is shown
  const benchIds = [...new Set([...benefitRows, ...costRows].map((b) => b.benchmarkId).filter((x): x is string => !!x))]
  const bench = new Map((benchIds.length ? await prisma.costBenchmark.findMany({ where: { id: { in: benchIds } }, select: { id: true, source: true, metric: true, notes: true } }) : []).map((b) => [b.id, b]))
  const attributionFor = (benchmarkId: string | null) => (benchmarkId ? attributionWords(attributionOf(bench.get(benchmarkId)?.notes)) : null)
  const label = (a: { title: string | null; practicalStep: string }) => a.title?.trim() || a.practicalStep.slice(0, 90)
  const rec = (r: string | null) => (r === 'ONE_OFF' || r === 'PER_YEAR' ? r : null)
  const costs: EngineCostLine[] = costRows.map((l) => {
    const h = home(l.actionId)!
    return {
      id: l.id, actionId: l.actionId, actionNumber: h.number ?? null, actionTitle: label(h), headingId: h.headingId ?? null,
      label: l.label, costType: l.costType, category: l.category, low: l.low, high: l.high, priceYear: l.priceYear,
      recurrence: rec(l.recurrence), durationMonths: l.durationMonths, basis: l.basis, citationKey: l.citationKey, benchmarkId: l.benchmarkId,
      appraisal: parseLineAppraisal(l.appraisal), attribution: attributionFor(l.benchmarkId),
      staffLevel: l.staffLevel ?? null, fteCount: l.fteCount ?? null,
    }
  })
  const benefits: EngineBenefitLine[] = benefitRows.map((b) => {
    const h = home(b.actionId)!
    const sourceWords = benefitSourceWords(b, bench, (k) => manifest.entries.get(k)?.label ?? null)
    return {
      id: b.id, actionId: b.actionId, actionNumber: h.number ?? null, actionTitle: label(h), headingId: h.headingId ?? null,
      label: b.label, beneficiary: ((PARTY_KINDS as readonly string[]).includes(b.beneficiary) ? b.beneficiary : 'OTHER') as PartyKind, beneficiaryName: b.beneficiaryName,
      measure: b.measure, low: b.low, high: b.high, priceYear: b.priceYear, recurrence: rec(b.recurrence), durationMonths: b.durationMonths, isHealth: b.isHealth,
      valuation: b.valuation === 'VALUED' ? 'VALUED' : 'NOT_VALUED', notValuedWhy: b.notValuedWhy, sourceWords, ownerEstimate: b.sourceKind === 'OWNER',
      attribution: b.sourceKind === 'BENCHMARK' ? attributionFor(b.benchmarkId) : null,
    }
  })
  const live = actions.filter((a) => a.status === 'LIVE' && (!opts.actionId || a.id === opts.actionId))
  const withLines = new Set(costRows.map((l) => home(l.actionId)?.id))
  const input: EngineInput = {
    period, deflator, costs, benefits, headings,
    held: { ...flags, manifest: manifest.entries.size ? manifest.from : 'none' },
    uncostedActions: live.filter((a) => !withLines.has(a.id) && !a.noCostReason?.trim()).length,
  }
  const fingerprint: Record<string, string> = {
    period: `${period.years}:${period.startYear}:${period.priceYear}`,
    ...Object.fromEntries(costRows.map((l) => [`c:${l.id}`, JSON.stringify([l.label, l.costType, l.low, l.high, l.priceYear, l.recurrence, l.durationMonths, l.basis, l.citationKey, l.appraisal, h(l.actionId), ...(l.costType === 'STAFF' ? [l.staffLevel, l.fteCount] : [])])])),
    ...Object.fromEntries(benefitRows.map((b) => [`b:${b.id}`, JSON.stringify([b.label, b.beneficiary, b.beneficiaryName, b.low, b.high, b.priceYear, b.recurrence, b.durationMonths, b.isHealth, b.valuation, b.sourceKind, b.sourceRef, b.benchmarkId, b.citationKey, b.ownerReason, h(b.actionId)])])),
  }
  function h(actionId: string) { const x = home(actionId); return [x?.number ?? null, x?.headingId ?? null] }
  return { input, fingerprint, heldOn: (manifest.heldAt ?? new Date().toISOString()).slice(0, 10) }
}

export async function runCba(ideaId: string, opts: { actionId?: string; now?: Date } = {}): Promise<{ result: CbaResult; inputs: CbaInputs } | null> {
  const inputs = await cbaInputs(ideaId, opts)
  if (!inputs) return null
  return { result: computeCba(inputs.input), inputs }
}

/** "stale: N lines changed since" — how many lines (and the settings) differ between a stored fingerprint and now. 0 = current. */
export function changedSince(stored: Record<string, string>, now: Record<string, string>): { lines: number; period: boolean } {
  const keys = new Set([...Object.keys(stored), ...Object.keys(now)].filter((k) => k !== 'period'))
  let lines = 0
  for (const k of keys) if (stored[k] !== now[k]) lines++
  return { lines, period: stored.period !== now.period }
}
