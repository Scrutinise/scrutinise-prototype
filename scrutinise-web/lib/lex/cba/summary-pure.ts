// LEX 26-Y §6 / §7 — the engine result, cut down to what Deepening section 5 and Lex's read_cba_summary show. PURE; client-safe.
import { type CbaResult, NOT_VALUED_WORDS, OB_INDICATIVE, obBandWords } from './engine-pure'
import { ENGINE_CITATIONS } from './citation-manifest-pure'
import { fyWords } from './period'

export interface CbaSummary {
  ok: boolean
  error: string | null
  periodWords: string
  priceYearWords: string
  npv: string
  bcr: string
  pvCosts: string
  pvBenefits: string
  benefitsValued: boolean
  /** 342 — the optimism-bias band beside the headline (never in it), with the guidance's caveat; null when no line is banded. */
  obBand: { words: string; caveat: string } | null
  gaps: Array<{ kind: string; text: string }>
  /** Trace ids Lex may hand to explain_cba_figure, with their label and value. */
  figures: Array<{ id: string; label: string; value: string }>
}

export function cbaSummary(r: CbaResult): CbaSummary {
  if (!r.ok) return { ok: false, error: (r as { error: string }).error, periodWords: '', priceYearWords: '', npv: '', bcr: '', pvCosts: '', pvBenefits: '', benefitsValued: false, obBand: null, gaps: [], figures: [] }
  const P = (r as Extract<CbaResult, { ok: true }>).period
  const keep = ['npv', 'bcr', 'pv-costs', 'pv-benefits', 'costs', 'benefits', 'undated.costs', 'ob-band']
  return {
    ok: true, error: null,
    periodWords: `${P.years} years, ${fyWords(P.startYear)} to ${fyWords(P.startYear + P.years - 1)}`,
    priceYearWords: fyWords(P.priceYear),
    npv: r.npv ? r.trace.npv.value : `not computed — ${NOT_VALUED_WORDS}`,
    bcr: r.bcr ? r.trace.bcr.value : NOT_VALUED_WORDS,
    pvCosts: r.trace['pv-costs'].value, pvBenefits: r.trace['pv-benefits'].value, benefitsValued: r.benefitsValued,
    obBand: r.obBand ? { words: obBandWords(r.obBand), caveat: `“${OB_INDICATIVE}” (${ENGINE_CITATIONS.obIndicative})` } : null,
    gaps: r.gaps.map((g) => ({ kind: g.kind, text: g.text })),
    figures: [...keep.filter((k) => r.trace[k]), ...Object.keys(r.trace).filter((k) => /^(sens:|payer:|beneficiary:|heading:[^.]+\.pv-)/.test(k))].map((id) => ({ id, label: r.trace[id].label, value: r.trace[id].value })),
  }
}
