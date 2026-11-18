'use client'

// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Y §6 — DEEPENING SECTION 5, "COSTS AND BENEFITS".
//   · ALWAYS: the X3a roll-up (cost lines by heading, years 1–5) of whatever lines exist, read-only; the analysis — NPV and BCR, or
//     "benefits not valued — no BCR" — and the Gaps count, with the Gaps listed; the appraisal period and price year (set on the Overview).
//   · LOCKED (the brief: "Open regardless of the lock? No"): the lock's count in words, and no Generate.
//   · OPEN: "Generate the Cost–benefit report" — free except Lex's narrative, whose MEASURED price is shown (or "not yet measured"), asked
//     first; "Generate without Lex's narrative (free)"; and every version with Word / PDF and "stale: N lines changed since".
// ⚠ Never colour alone (§21): ● current / ○ stale, and the words.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { explainFailure } from '@/lib/api-rejection'
import { DEEPENING_UI, CBA_UI } from '@/lib/lex/screen-labels'
import type { CbaSummary } from '@/lib/lex/cba/summary-pure'
import type { CbaReportStatus } from '@/lib/lex/cba/report'
import type { DeepeningOverview } from '@/lib/lex/deepening-overview'
import type { AppraisalSettings } from '@/lib/lex/cba/settings'
import { fyWords } from '@/lib/lex/cba/period'
import { Section, Costs } from './DeepeningSections'

export interface CbaRead { summary: CbaSummary; status: CbaReportStatus; rollup: DeepeningOverview['costs']; settings: AppraisalSettings }
const pence = (p: number | null) => (p == null ? 'not yet measured' : p < 1 ? `${p.toFixed(2)}p` : `${p.toFixed(1)}p`)

export function staleWords(s: { lines: number; period: boolean } | null): string {
  if (!s) return 'not checked'
  if (!s.lines && !s.period) return 'current'
  return `stale: ${s.lines} line${s.lines === 1 ? '' : 's'} changed since${s.period ? ', and the appraisal settings' : ''}`
}

export default function DeepeningCostsBenefits({ ideaId, open, initial, toGo }: { ideaId: string; open: boolean; initial?: CbaRead; /** a check's read of the lock count */ toGo?: number }) {
  const [d, setD] = useState<CbaRead | null>(initial ?? null)
  const [lockToGo, setLockToGo] = useState<number | null>(toGo ?? null)
  const [error, setError] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const read = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/cba`)
      const body = await res.json().catch(() => null)
      if (!res.ok) { setError(explainFailure(body, res.status, 'Reading the costs and benefits')); return }
      setD(body as CbaRead); setError(null)
    } catch (e) { setError(`Reading the costs and benefits could not reach the server (${e instanceof Error ? e.message : 'network error'}).`) }
  }, [ideaId])
  useEffect(() => { if (!initial) void read() }, [read, initial])
  useEffect(() => {
    if (open || toGo != null) return
    void fetch(`/api/ideas/${ideaId}/development`).then((r) => r.json()).then((b) => setLockToGo(b?.counts?.toGo ?? null)).catch(() => {})
  }, [ideaId, open, toGo])

  const generate = async (narrative: boolean) => {
    setBusy(true); setError(null); setDone(null); setAsking(false)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/cba`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'generate', narrative }) })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setError(`Not made: ${explainFailure(body, res.status, `“${CBA_UI.generate}”`)}`); return }
      setDone(`Saved: version ${body.version} of the Cost–benefit report${body.pence != null ? ` (Lex’s narrative cost ${pence(body.pence)})` : ''}.${body.narrativeNote ? ` ${body.narrativeNote}` : ''} Its Word and PDF files are below.`)
      await read()
    } catch (e) { setError(`Not made: “${CBA_UI.generate}” could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`) }
    finally { setBusy(false) }
  }

  const s = d?.summary
  return (
    <Section id="costs" title={DEEPENING_UI.costs}>
      {error && <p className="text-xs font-semibold border-2 border-zinc-900 bg-white rounded px-2 py-1" role="alert">⚠ {error} <button type="button" onClick={() => setError(null)} className="underline">OK</button></p>}
      {!d ? <p className="text-xs text-zinc-600" role="status">Reading…</p> : (<>
        <Costs c={d.rollup} />
        <div className="mt-2 rounded border border-zinc-300 bg-white px-2 py-1.5 space-y-1" data-cba-summary>
          <p className="text-xs font-semibold text-zinc-900">{CBA_UI.summary} · {d.settings.words} — change them in {CBA_UI.settings} on the Overview.</p>
          {s && !s.ok ? <p className="text-xs font-semibold" role="alert" data-cba-refused>⚠ {s.error}</p> : s && (<>
            <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs" data-cba-figures>
              <dt className="font-medium">{CBA_UI.npv}</dt><dd data-cba-npv>{s.npv}</dd>
              <dt className="font-medium">{CBA_UI.bcr}</dt><dd data-cba-bcr>{s.bcr}</dd>
              <dt className="font-medium">Present value of costs</dt><dd>{s.pvCosts}</dd>
              <dt className="font-medium">Present value of valued benefits</dt><dd>{s.benefitsValued ? s.pvBenefits : 'no benefit is valued'}</dd>
            </dl>
            {s.obBand && <p className="text-xs text-zinc-800" data-cba-ob-band><span className="font-medium">Optimism bias, not in the figures above:</span> {s.obBand.words}. <span className="text-[10px] text-zinc-600">{s.obBand.caveat}</span></p>}
            <details data-cba-gaps>
              <summary className="cursor-pointer text-xs"><span className="font-semibold">{CBA_UI.gaps}: {s.gaps.length}</span> — what this does not cover. The report prints them before its totals.</summary>
              <ol className="list-decimal pl-5 text-[11px] text-zinc-800 space-y-0.5 mt-0.5">{s.gaps.map((g, i) => <li key={i}>{g.text}</li>)}</ol>
            </details>
            <p className="text-[10px] text-zinc-600">Deflator series held: {d.settings.deflator.firstYear != null ? `${fyWords(d.settings.deflator.firstYear)} to ${fyWords(d.settings.deflator.lastYear!)}` : 'none'}{d.settings.deflator.baseYear != null ? `, base ${fyWords(d.settings.deflator.baseYear)} = 100` : ''}.</p>
          </>)}
        </div>

        {!open ? (
          <p className="mt-2 text-xs text-zinc-800" data-cba-locked><span aria-hidden>🔒</span> The Cost–benefit report is generated once the Deepening opens{lockToGo != null ? <>: <span className="font-semibold">{lockToGo} {lockToGo === 1 ? 'action is' : 'actions are'} still to go</span></> : ''}. The figures above are read from whatever lines exist now.</p>
        ) : (
          <div className="mt-2 space-y-1" data-cba-generate>
            {asking ? (
              <p className="inline-flex flex-wrap items-center gap-1.5 rounded border-2 border-zinc-900 bg-white px-2 py-1 text-[11px]" role="alert" data-cba-confirm>
                <span>This makes a new version from the lines as they are now. Everything is computed for nothing except Lex’s two-paragraph narrative, which costs <span className="font-semibold">{d.status.price.pence != null ? `about ${pence(d.status.price.pence)} (measured)` : 'an amount not yet measured'}</span>. Go on?</span>
                <button type="button" disabled={busy} onClick={() => void generate(true)} className="font-medium px-2 py-0.5 rounded bg-zinc-900 text-white" data-cba-go>{CBA_UI.generateGo}</button>
                <button type="button" onClick={() => setAsking(false)} className="underline">Cancel</button>
              </p>
            ) : (
              <p className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => setAsking(true)} className="text-xs font-medium px-2 py-1 rounded border-2 border-zinc-900 bg-white disabled:opacity-40" data-cba-generate-button>{CBA_UI.generate} — {d.status.price.pence != null ? `about ${pence(d.status.price.pence)}` : 'narrative price not yet measured'}</button>
                <button type="button" disabled={busy} onClick={() => void generate(false)} className="text-xs underline disabled:opacity-40" data-cba-generate-free>{CBA_UI.generateFree}</button>
              </p>
            )}
            {busy && <p className="text-xs font-semibold" role="status">Building the report…</p>}
            {done && <p className="text-xs" role="status" data-cba-done>{done}</p>}
          </div>
        )}
        <CbaVersions ideaId={ideaId} status={d.status} />
      </>)}
    </Section>
  )
}

/** The versions, newest first: Word / PDF and whether each still matches the lines. Shared with the Output Reports. */
export function CbaVersions({ ideaId, status }: { ideaId: string; status: CbaReportStatus }) {
  if (!status.versions.length) return <p className="mt-1 text-[11px] text-zinc-600" data-cba-versions>No version generated yet.</p>
  return (
    <div className="mt-1" data-cba-versions>
      <p className="text-[11px] font-semibold text-zinc-800">{CBA_UI.versions}</p>
      <ul className="space-y-0.5">{status.versions.map((v) => {
        const current = !!v.stale && !v.stale.lines && !v.stale.period
        return (
          <li key={v.version} className="text-[11px] text-zinc-800" data-cba-version={v.version} data-cba-stale={current ? 'no' : 'yes'}>
            <span aria-hidden>{current ? '●' : '○'}</span> Version {v.version} · {v.createdAt.slice(0, 10)} {v.createdAt.slice(11, 16)} UTC · <span className={current ? '' : 'font-semibold'}>{staleWords(v.stale)}</span> · NPV {v.npv} · {v.gaps} gaps ·{' '}
            <a className="underline" href={`/api/ideas/${ideaId}/cba/download?v=${v.version}&format=docx`}>Word</a> · <a className="underline" href={`/api/ideas/${ideaId}/cba/download?v=${v.version}&format=pdf`}>PDF</a>
          </li>
        )
      })}</ul>
    </div>
  )
}
