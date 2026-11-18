// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Y §2 (decision 334) — A BENEFIT LINE: the rules, pure and client-safe, so the form, the route and Lex's tools refuse the same things
// in the same words.
//
// ⚠ THE RULE THAT MATTERS: a benefit with no source is stored as "not valued" and never enters a total. A figure typed with no source is
// KEPT (the owner's words are never thrown away) but the line is NOT_VALUED, with the reason said ("a figure was given with no source").
// Valued = an amount AND one of: [Ref: n] · a held unit-cost row · a manifest citation key · "owner's estimate — reason".
// ─────────────────────────────────────────────────────────────────────────────

import { LIMITS } from '../input-limits'
import { PARTY_KINDS, type PartyKind } from './line-appraisal'

export const SOURCE_KINDS = ['REF', 'BENCHMARK', 'CITATION', 'OWNER'] as const
export type SourceKind = (typeof SOURCE_KINDS)[number]
export const BENEFIT_STATUSES = ['ACCEPTED', 'PROPOSED', 'SET_ASIDE', 'REMOVED'] as const
export type BenefitStatus = (typeof BENEFIT_STATUSES)[number]

export interface BenefitInput {
  label: string
  beneficiary: PartyKind
  beneficiaryName?: string | null
  measure?: string | null
  low?: number | null
  high?: number | null
  priceYear?: number | null
  recurrence?: 'ONE_OFF' | 'PER_YEAR' | null
  durationMonths?: number | null
  isHealth?: boolean
  sourceKind?: SourceKind | null
  sourceRef?: number | null
  benchmarkId?: string | null
  citationKey?: string | null
  ownerReason?: string | null
  /** The owner's (or Lex's) words for why it is not valued — required when there is no figure. */
  notValuedWhy?: string | null
}

export interface BenefitRow extends Required<Omit<BenefitInput, 'beneficiaryName' | 'measure' | 'notValuedWhy'>> {
  beneficiaryName: string | null; measure: string | null; notValuedWhy: string | null
  valuation: 'VALUED' | 'NOT_VALUED'
}

/** The source as given, or null when none was. (Whether a REF / BENCHMARK / CITATION resolves is the server's check.) */
export function hasSource(i: BenefitInput): boolean {
  switch (i.sourceKind) {
    case 'REF': return i.sourceRef != null && i.sourceRef > 0
    case 'BENCHMARK': return !!i.benchmarkId
    case 'CITATION': return !!i.citationKey?.trim()
    case 'OWNER': return (i.ownerReason?.trim().length ?? 0) >= 3
    default: return false
  }
}

/** A refusal in words naming the field and its limit, or the line as it would be stored. Never cuts text. */
export function normaliseBenefit(i: BenefitInput): { ok: false; error: string } | { ok: true; row: BenefitRow; note: string | null } {
  const label = i.label?.trim() ?? ''
  if (label.length < 3) return { ok: false, error: 'Not saved: say what is gained (at least 3 characters).' }
  const over = (name: string, v: string | null | undefined, max: number) => (v && v.trim().length > max ? `Not saved: ${name} is ${v.trim().length.toLocaleString('en-GB')} characters; the limit is ${max.toLocaleString('en-GB')}.` : null)
  const tooLong = over('what is gained', label, LIMITS.benefitLabel) ?? over('who gains (the name)', i.beneficiaryName, LIMITS.beneficiaryName) ?? over('how it would be measured', i.measure, LIMITS.benefitMeasure)
    ?? over('the reason for the estimate', i.ownerReason, LIMITS.benefitReason) ?? over('why it is not valued', i.notValuedWhy, LIMITS.benefitReason) ?? over('the citation key', i.citationKey, LIMITS.citationKey)
  if (tooLong) return { ok: false, error: tooLong }
  if (!(PARTY_KINDS as readonly string[]).includes(i.beneficiary)) return { ok: false, error: `Not saved: who gains must be one of ${PARTY_KINDS.join(', ').toLowerCase()}.` }
  for (const [n, v] of [['the low figure', i.low], ['the high figure', i.high]] as const) {
    if (v != null && (!Number.isFinite(v) || v < 0 || v > LIMITS.amountMax)) return { ok: false, error: `Not saved: ${n} must be a sum from £0 to £${LIMITS.amountMax.toLocaleString('en-GB')}.` }
  }
  if (i.low != null && i.high != null && i.high < i.low) return { ok: false, error: 'Not saved: the high figure is below the low figure.' }
  if (i.durationMonths != null && (!(i.durationMonths > 0) || i.durationMonths > 1200)) return { ok: false, error: 'Not saved: a duration is from 1 to 1,200 months.' }
  if (i.priceYear != null && (!Number.isInteger(i.priceYear) || i.priceYear < 1900 || i.priceYear > 2100)) return { ok: false, error: 'Not saved: the price year must be a year from 1900 to 2100.' }
  const figure = i.low != null || i.high != null
  const sourced = hasSource(i)
  let note: string | null = null
  let notValuedWhy = i.notValuedWhy?.trim() || null
  let valuation: 'VALUED' | 'NOT_VALUED' = figure && sourced ? 'VALUED' : 'NOT_VALUED'
  if (figure && !sourced) { notValuedWhy = notValuedWhy ?? 'a figure was given with no source, so it is not counted'; note = 'Saved as NOT VALUED: the figure has no source. Add [Ref: n], a unit-cost row, a Green Book citation, or “owner’s estimate” with a reason, and it will count.' }
  if (figure && sourced && !i.recurrence) note = 'Saved, but it says neither one-off nor per year, so the report counts it and places it in no year.'
  if (!figure && !notValuedWhy) return { ok: false, error: 'Not saved: give a figure with its source, or say why it is not valued (for example “no source measures this yet”).' }
  if (valuation === 'VALUED') notValuedWhy = null
  return {
    ok: true, note,
    row: {
      label, beneficiary: i.beneficiary, beneficiaryName: i.beneficiaryName?.trim() || null, measure: i.measure?.trim() || null,
      low: i.low ?? null, high: i.high ?? null, priceYear: i.priceYear ?? null, recurrence: i.recurrence ?? null, durationMonths: i.durationMonths ?? null,
      isHealth: !!i.isHealth, sourceKind: i.sourceKind ?? null, sourceRef: i.sourceKind === 'REF' ? i.sourceRef ?? null : null,
      benchmarkId: i.sourceKind === 'BENCHMARK' ? i.benchmarkId ?? null : null, citationKey: i.sourceKind === 'CITATION' ? i.citationKey?.trim() ?? null : null,
      ownerReason: i.sourceKind === 'OWNER' ? i.ownerReason?.trim() ?? null : null,
      notValuedWhy, valuation,
    },
  }
}

/** One line in words, for a FieldRevision and for Lex: "Faster decisions — citizens; £1,000–2,000 per year (2025 prices), from [Ref: 3]". */
export function benefitWords(b: { label: string; beneficiary: string; beneficiaryName: string | null; low: number | null; high: number | null; recurrence: string | null; priceYear: number | null; valuation: string; notValuedWhy: string | null; sourceKind: string | null; sourceRef: number | null; citationKey: string | null; benchmarkId: string | null; ownerReason: string | null; measure: string | null }): string {
  const who = `${b.beneficiary.toLowerCase()}${b.beneficiaryName ? ` (${b.beneficiaryName})` : ''}`
  const amt = b.low != null || b.high != null ? `£${Math.round(b.low ?? b.high!).toLocaleString('en-GB')}${b.high != null && b.low != null && b.high !== b.low ? `–${Math.round(b.high).toLocaleString('en-GB')}` : ''}${b.recurrence === 'PER_YEAR' ? ' per year' : b.recurrence === 'ONE_OFF' ? ' one-off' : ''}${b.priceYear ? ` (${b.priceYear} prices)` : ''}` : null
  const src = b.sourceKind === 'REF' ? `[Ref: ${b.sourceRef}]` : b.sourceKind === 'CITATION' ? b.citationKey : b.sourceKind === 'BENCHMARK' ? 'a held unit-cost row' : b.sourceKind === 'OWNER' ? `the owner’s estimate — ${b.ownerReason}` : null
  return `${b.label} — ${who}${b.measure ? `; measured by ${b.measure}` : ''}; ${b.valuation === 'VALUED' ? `valued at ${amt}, from ${src}` : `not valued${b.notValuedWhy ? ` (${b.notValuedWhy})` : ''}${amt ? `; figure kept: ${amt}` : ''}`}`
}
