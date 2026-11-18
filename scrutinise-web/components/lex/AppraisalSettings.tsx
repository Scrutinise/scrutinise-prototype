'use client'

// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Y decision 335 / §6 — THE IDEA'S APPRAISAL SETTINGS, on the Overview: the appraisal period (1–60 years, default 10), its start
// year, and the price year (default the current financial year), with the deflator series' range and base shown beside it. The owner
// edits; anyone else reads. "Use the default" clears a value, so the report says "default" rather than "the owner's".
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { explainFailure } from '@/lib/api-rejection'
import { CBA_UI, COMMON_UI } from '@/lib/lex/screen-labels'
import { fyWords, APPRAISAL_MIN_YEARS, APPRAISAL_MAX_YEARS } from '@/lib/lex/cba/period'
import type { AppraisalSettings as Settings } from '@/lib/lex/cba/settings'

export default function AppraisalSettings({ ideaId }: { ideaId: string }) {
  const [s, setS] = useState<(Settings & { canEdit?: boolean }) | null>(null)
  const [msg, setMsg] = useState<{ text: string; refused: boolean } | null>(null)
  const [years, setYears] = useState(''), [start, setStart] = useState(''), [price, setPrice] = useState('')
  const load = useCallback(async () => {
    const res = await fetch(`/api/ideas/${ideaId}/appraisal`).catch(() => null)
    if (!res || !res.ok) return
    const b = await res.json()
    setS(b); setYears(String(b.period.years)); setStart(String(b.period.startYear)); setPrice(String(b.period.priceYear))
  }, [ideaId])
  useEffect(() => { void load() }, [load])
  if (!s) return null
  const save = async (patch: Record<string, number | null>) => {
    setMsg(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/appraisal`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
      const b = await res.json().catch(() => null)
      if (!res.ok) { setMsg({ text: `Not saved: ${explainFailure(b, res.status, CBA_UI.settings)}`, refused: true }); return }
      setMsg({ text: `Saved: ${b.words}.`, refused: false }); await load()
    } catch (e) { setMsg({ text: `Not saved: the settings could not reach the server (${e instanceof Error ? e.message : 'network error'}).`, refused: true }) }
  }
  const n = (x: string) => (x.trim() === '' ? null : Number(x))
  const P = s.period
  const inp = 'w-20 text-xs border border-zinc-300 rounded px-1.5 py-0.5'
  return (
    <section data-appraisal-settings aria-label={CBA_UI.settings}>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{CBA_UI.settings}</h3>
      <p className="text-sm">{s.words}. <span className="text-xs text-zinc-600">{[P.set.years ? null : 'period: default', P.set.startYear ? null : 'start: default (the price year)', P.set.priceYear ? null : 'price year: default (the latest deflator release held)'].filter(Boolean).join(' · ')}</span></p>
      <p className="text-xs text-zinc-600">Deflator series held: {s.deflator.firstYear != null ? `${fyWords(s.deflator.firstYear)} to ${fyWords(s.deflator.lastYear!)}` : 'none'}{s.deflator.baseYear != null ? `, base ${fyWords(s.deflator.baseYear)} = 100` : ''}. A line priced in a year the series does not hold is not converted, and the report says so.</p>
      {s.canEdit && (
        <div className="mt-2 flex flex-wrap items-end gap-2 text-xs">
          <label>{CBA_UI.periodYears}<input value={years} onChange={(e) => setYears(e.target.value)} aria-label={CBA_UI.periodYears} className={`block ${inp}`} /><span className="text-[10px] text-zinc-500">{APPRAISAL_MIN_YEARS}–{APPRAISAL_MAX_YEARS}</span></label>
          <label>{CBA_UI.startYear}<input value={start} onChange={(e) => setStart(e.target.value)} aria-label={CBA_UI.startYear} className={`block ${inp}`} /><span className="text-[10px] text-zinc-500">{start && /^\d{4}$/.test(start) ? fyWords(Number(start)) : 'e.g. 2026 = 2026-27'}</span></label>
          <label>{CBA_UI.priceYear}<input value={price} onChange={(e) => setPrice(e.target.value)} aria-label={CBA_UI.priceYear} className={`block ${inp}`} /><span className="text-[10px] text-zinc-500">{price && /^\d{4}$/.test(price) ? fyWords(Number(price)) : ''}</span></label>
          <button type="button" onClick={() => void save({ years: n(years), startYear: n(start), priceYear: n(price) })} className="px-2 py-1 rounded bg-zinc-900 text-white font-medium">{COMMON_UI.save}</button>
          <button type="button" onClick={() => void save({ years: null, startYear: null, priceYear: null })} className="underline">{CBA_UI.useDefault}</button>
        </div>
      )}
      {msg && <p role={msg.refused ? 'alert' : 'status'} className={`mt-1 text-xs ${msg.refused ? 'font-semibold border-2 border-zinc-900 rounded px-2 py-1' : ''}`}>{msg.refused ? '⚠ ' : ''}{msg.text}</p>}
    </section>
  )
}
