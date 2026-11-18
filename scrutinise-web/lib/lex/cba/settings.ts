// LEX 26-Y decision 335 / §6 — read and write the idea's appraisal settings. One writer for the Settings form and Lex's set_appraisal_period.
import { prisma } from '@/lib/prisma'
import { resolvePeriod, periodRefusal, fyWords, currentFinancialYear, priceYearWords, type AppraisalPeriod } from './period'

export interface AppraisalSettings {
  period: AppraisalPeriod
  /** The deflator series' base and its last year — shown beside the price year (§6 "deflator base shown"). */
  deflator: { firstYear: number | null; lastYear: number | null; baseYear: number | null; rows: number }
  defaultPriceYear: number
  words: string
}

export async function readAppraisalSettings(ideaId: string, now = new Date()): Promise<AppraisalSettings> {
  const [idea, d] = await Promise.all([
    prisma.idea.findUnique({ where: { id: ideaId }, select: { appraisalYears: true, appraisalStartYear: true, cbaPriceYear: true } }),
    prisma.deflatorSeries.findMany({ select: { year: true, index: true }, orderBy: { year: 'asc' } }),
  ])
  const latest = d[d.length - 1]?.year ?? null
  const period = resolvePeriod(idea ?? { appraisalYears: null, appraisalStartYear: null, cbaPriceYear: null }, now, latest)
  const base = d.find((r) => Math.abs(r.index - 100) < 1e-6)?.year ?? null
  return {
    period,
    deflator: { firstYear: d[0]?.year ?? null, lastYear: latest, baseYear: base, rows: d.length },
    defaultPriceYear: latest ?? currentFinancialYear(now),
    words: `${period.years} years from ${fyWords(period.startYear)}; ${priceYearWords(period)}`,
  }
}

export async function setAppraisalSettings(ideaId: string, patch: { years?: number | null; startYear?: number | null; priceYear?: number | null }, userId: string, now = new Date()): Promise<{ ok: true; data: AppraisalSettings } | { ok: false; error: string }> {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { appraisalYears: true, appraisalStartYear: true, cbaPriceYear: true } })
  if (!idea) return { ok: false, error: 'That idea was not found.' }
  const cols = {
    appraisalYears: patch.years !== undefined ? patch.years : idea.appraisalYears,
    appraisalStartYear: patch.startYear !== undefined ? patch.startYear : idea.appraisalStartYear,
    cbaPriceYear: patch.priceYear !== undefined ? patch.priceYear : idea.cbaPriceYear,
  }
  const latest = (await prisma.deflatorSeries.findFirst({ orderBy: { year: 'desc' }, select: { year: true } }))?.year ?? null
  const p = resolvePeriod(cols, now, latest)
  const refused = periodRefusal(p)
  if (refused) return { ok: false, error: refused }
  const before = resolvePeriod(idea, now, latest)
  await prisma.idea.update({ where: { id: ideaId }, data: cols })
  const fmt = (x: AppraisalPeriod) => `${x.years} years from ${fyWords(x.startYear)}, in ${fyWords(x.priceYear)} prices`
  if (fmt(before) !== fmt(p) || JSON.stringify(before.set) !== JSON.stringify(p.set)) {
    await prisma.fieldRevision.create({ data: { ideaId, fieldKey: 'appraisalPeriod', targetId: null, targetNumber: null, previousText: fmt(before), previousSource: 'USER', newText: fmt(p), acceptedById: userId, origin: 'APPRAISAL_SETTINGS' } })
  }
  return { ok: true, data: await readAppraisalSettings(ideaId, now) }
}
