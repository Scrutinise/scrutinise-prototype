'use client'

// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Y §2a (334) and §3.1 / 337 / 339 / 340 — IN THE ACTION RECORD'S COSTS SECTION, under the cost lines:
//   · "For the cost–benefit analysis", per cost line: who pays; a staffing line's employer on-cost (or "excludes employer costs"); a capital
//     line's Table 1 project type and a lower rate with its reason; a Green Book citation key (refused unless held, with the nearest keys);
//   · "Benefits": the lines, Lex's proposals waiting (Accept / Set aside), "Removed and set aside" (Restore), and Add a benefit.
// Every input shows its limit and the count left (BoundedInput, LIMITS); every refusal is a sentence in the strip; nothing is deleted.
// ⚠ Never colour alone (§21): a proposal is "Lex proposes", a valued line says "valued at", a not-valued one says "not valued".
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import { explainFailure } from '@/lib/api-rejection'
import { CBA_UI, COMMON_UI } from '@/lib/lex/screen-labels'
import { LIMITS } from '@/lib/lex/input-limits'
import { PARTY_KINDS, PARTY_WORD, OB_TYPES, OB_TYPE_WORD, partyWords, pct, type LineAppraisal, type PartyKind, type ObType } from '@/lib/lex/cba/line-appraisal'
import { benefitWords } from '@/lib/lex/cba/benefit-lines-pure'
import BoundedInput from './BoundedInput'

interface BenefitRowT {
  id: string; actionId: string; label: string; beneficiary: string; beneficiaryName: string | null; measure: string | null
  low: number | null; high: number | null; priceYear: number | null; recurrence: string | null; durationMonths: number | null; isHealth: boolean
  sourceKind: string | null; sourceRef: number | null; benchmarkId: string | null; citationKey: string | null; ownerReason: string | null
  notValuedWhy: string | null; valuation: string; status: string; proposedWhy: string | null
}
interface CostRowT { id: string; label: string; costType: string; low: number | null; high: number | null; appraisal: LineAppraisal; citationKey: string | null }
interface Bench { id: string; domain: string; metric: string; source: string; low: number | null; high: number | null; unit: string | null; priceYear: number | null }

const num = (s: string): number | null => { const t = s.replace(/[£,\s]/g, ''); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : NaN }
const inp = 'text-[11px] border border-zinc-300 rounded px-1.5 py-0.5'

export default function ActionCbaLines({ ideaId, actionId, actionNumber, disabled, onChanged }: { ideaId: string; actionId: string; actionNumber: number | null; disabled?: boolean; onChanged?: () => void }) {
  const [data, setData] = useState<{ lines: BenefitRowT[]; costLines: CostRowT[]; benchmarks: Bench[] } | null>(null)
  const [msg, setMsg] = useState<{ text: string; refused: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const read = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/benefit-lines?actionId=${encodeURIComponent(actionId)}`)
      const body = await res.json().catch(() => null)
      if (!res.ok) { setMsg({ text: explainFailure(body, res.status, 'Reading the benefit lines'), refused: true }); return }
      setData(body)
    } catch (e) { setMsg({ text: `Reading the benefit lines could not reach the server (${e instanceof Error ? e.message : 'network error'}).`, refused: true }) }
  }, [ideaId, actionId])
  useEffect(() => { void read() }, [read])

  const post = async (url: string, body: unknown, control: string, done: (r: { result?: { note?: string | null }; saved?: string }) => string) => {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const r = await res.json().catch(() => null)
      if (!res.ok) { setMsg({ text: `Not saved: ${explainFailure(r, res.status, control)}`, refused: true }); return false }
      setMsg({ text: done(r ?? {}), refused: false }); await read(); onChanged?.(); return true
    } catch (e) { setMsg({ text: `Not saved: ${control} could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`, refused: true }); return false }
    finally { setBusy(false) }
  }
  const benefitOp = (body: Record<string, unknown>, control: string, done: string) => post(`/api/ideas/${ideaId}/benefit-lines`, body, control, (r) => `${done}${r.result?.note ? ` ${r.result.note}` : ''}`)
  const appraisal = (lineId: string, patch: Record<string, unknown>, control: string) => post(`/api/ideas/${ideaId}/cost-lines`, { action: 'appraisal', lineId, ...patch }, control, (r) => `Saved: ${r.saved ?? control}.`)

  if (!data) return <p className="text-[11px] text-zinc-600" role="status">Reading the benefit lines…</p>
  const live = data.lines.filter((l) => l.status === 'ACCEPTED')
  const proposed = data.lines.filter((l) => l.status === 'PROPOSED')
  const kept = data.lines.filter((l) => l.status === 'REMOVED' || l.status === 'SET_ASIDE')
  const dis = disabled || busy

  return (
    <div className="space-y-2" data-cba-lines>
      {msg && <p role={msg.refused ? 'alert' : 'status'} className={`text-[11px] rounded px-2 py-1 ${msg.refused ? 'font-semibold border-2 border-zinc-900 bg-white' : 'border border-zinc-300 bg-zinc-50'}`} data-cba-msg>{msg.refused ? '⚠ ' : ''}{msg.text} <button type="button" onClick={() => setMsg(null)} className="underline">{COMMON_UI.ok}</button></p>}

      {data.costLines.length > 0 && (
        <details className="rounded border border-zinc-200 bg-white" data-cba-appraisal>
          <summary className="cursor-pointer px-2 py-1 text-[11px] text-zinc-700"><span className="font-semibold">{CBA_UI.forAppraisal}</span> · {data.costLines.filter((c) => c.appraisal.payer).length} of {data.costLines.length} say who pays</summary>
          <div className="px-2 pb-2 space-y-2">
            {data.costLines.map((c) => <CostAppraisal key={c.id} c={c} disabled={dis} save={(patch, control) => appraisal(c.id, patch, control)} />)}
          </div>
        </details>
      )}

      <div className="rounded border border-zinc-200 bg-white px-2 py-1.5" data-benefits>
        <p className="text-[11px] font-semibold text-zinc-800">{CBA_UI.benefits} · {live.length ? `${live.filter((l) => l.valuation === 'VALUED').length} valued, ${live.filter((l) => l.valuation !== 'VALUED').length} not valued` : 'none recorded'}{proposed.length ? ` · ${proposed.length} proposed by Lex` : ''}</p>
        {live.length > 0 && (
          <ul className="mt-1 space-y-1">{live.map((l) => <BenefitItem key={l.id} l={l} benchmarks={data.benchmarks} disabled={dis}
            onSave={(patch) => benefitOp({ op: 'set', lineId: l.id, ...patch }, CBA_UI.editBenefit, `Saved: the benefit “${patch.label ?? l.label}” on #${actionNumber ?? '?'}.`)}
            onRemove={() => benefitOp({ op: 'remove', lineId: l.id }, CBA_UI.removeBenefit, `Saved: “${l.label}” removed. It is kept under “${CBA_UI.removedBenefits}” and can be restored.`)} />)}</ul>
        )}
        {proposed.length > 0 && (
          <ul className="mt-1 space-y-1" data-benefit-proposals>{proposed.map((l) => (
            <li key={l.id} className="text-[11px] rounded border-2 border-dashed border-zinc-400 px-1.5 py-1" data-benefit-proposal>
              <span className="font-semibold">{CBA_UI.lexProposes}:</span> {benefitWords(l)}{l.proposedWhy ? <span className="block text-zinc-600 italic">{l.proposedWhy}</span> : null}
              <span className="flex gap-2 mt-0.5">
                <button type="button" disabled={dis} onClick={() => void benefitOp({ op: 'accept', lineId: l.id }, COMMON_UI.accept, `Saved: Lex’s benefit “${l.label}” is now on #${actionNumber ?? '?'}.`)} className="font-medium px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">{COMMON_UI.accept}</button>
                <button type="button" disabled={dis} onClick={() => void benefitOp({ op: 'set_aside', lineId: l.id }, COMMON_UI.setAside, `Saved: Lex’s benefit “${l.label}” set aside (kept under “${CBA_UI.removedBenefits}”).`)} className="underline disabled:opacity-40">{COMMON_UI.setAside}</button>
              </span>
            </li>))}</ul>
        )}
        <BenefitForm benchmarks={data.benchmarks} disabled={dis} submitLabel={CBA_UI.addBenefit}
          onSubmit={(v) => benefitOp({ op: 'add', actionId, ...v }, CBA_UI.addBenefit, `Saved: the benefit “${v.label}” on #${actionNumber ?? '?'}.`)} />
        {kept.length > 0 && (
          <details className="mt-1" data-benefits-removed>
            <summary className="cursor-pointer text-[11px] text-zinc-600">{CBA_UI.removedBenefits} ({kept.length})</summary>
            <ul className="mt-0.5 space-y-0.5">{kept.map((l) => (
              <li key={l.id} className="text-[11px] text-zinc-700">{l.status === 'SET_ASIDE' ? 'Set aside: ' : 'Removed: '}{benefitWords(l)}{' '}
                <button type="button" disabled={dis} onClick={() => void benefitOp({ op: 'restore', lineId: l.id }, CBA_UI.restoreBenefit, `Saved: “${l.label}” restored.`)} className="underline disabled:opacity-40">{CBA_UI.restoreBenefit}</button></li>))}</ul>
          </details>
        )}
      </div>
    </div>
  )
}

function BenefitItem({ l, benchmarks, disabled, onSave, onRemove }: { l: BenefitRowT; benchmarks: Bench[]; disabled: boolean; onSave: (p: Record<string, unknown> & { label?: string }) => Promise<boolean>; onRemove: () => void }) {
  const [editing, setEditing] = useState(false)
  if (editing) return <li><BenefitForm initial={l} benchmarks={benchmarks} disabled={disabled} submitLabel={COMMON_UI.save} onCancel={() => setEditing(false)} onSubmit={async (v) => { if (await onSave(v)) setEditing(false) }} /></li>
  return (
    <li className="text-[11px] text-zinc-800 flex items-start gap-2" data-benefit={l.id} data-valuation={l.valuation}>
      <span aria-hidden>{l.valuation === 'VALUED' ? '●' : '○'}</span>
      <span className="flex-1">{benefitWords(l)}{l.isHealth ? ' · a health effect' : ''}</span>
      <button type="button" disabled={disabled} onClick={() => setEditing(true)} className="underline disabled:opacity-40">{CBA_UI.editBenefit}</button>
      <button type="button" disabled={disabled} onClick={onRemove} className="underline disabled:opacity-40">{CBA_UI.removeBenefit}</button>
    </li>
  )
}

function BenefitForm({ initial, benchmarks, disabled, submitLabel, onSubmit, onCancel }: { initial?: BenefitRowT; benchmarks: Bench[]; disabled: boolean; submitLabel: string; onSubmit: (v: Record<string, unknown> & { label: string }) => unknown; onCancel?: () => void }) {
  const [open, setOpen] = useState(!!initial)
  const [label, setLabel] = useState(initial?.label ?? '')
  const [who, setWho] = useState<PartyKind>((initial?.beneficiary as PartyKind) ?? 'CITIZENS')
  const [named, setNamed] = useState(initial?.beneficiaryName ?? '')
  const [measure, setMeasure] = useState(initial?.measure ?? '')
  const [valued, setValued] = useState(initial ? initial.valuation === 'VALUED' || initial.low != null || initial.high != null : true)
  const [low, setLow] = useState(initial?.low != null ? String(initial.low) : '')
  const [high, setHigh] = useState(initial?.high != null ? String(initial.high) : '')
  const [priceYear, setPriceYear] = useState(initial?.priceYear != null ? String(initial.priceYear) : '')
  const [rec, setRec] = useState(initial?.recurrence ?? 'PER_YEAR')
  const [months, setMonths] = useState(initial?.durationMonths != null ? String(initial.durationMonths) : '')
  const [health, setHealth] = useState(initial?.isHealth ?? false)
  const [sk, setSk] = useState(initial?.sourceKind ?? 'OWNER')
  const [ref, setRef] = useState(initial?.sourceRef != null ? String(initial.sourceRef) : '')
  const [bench, setBench] = useState(initial?.benchmarkId ?? '')
  const [cite, setCite] = useState(initial?.citationKey ?? '')
  const [why, setWhy] = useState(initial?.ownerReason ?? '')
  const [nvWhy, setNvWhy] = useState(initial?.notValuedWhy ?? '')
  const [local, setLocal] = useState<string | null>(null)
  if (!open) return <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="mt-1 text-[11px] font-medium px-2 py-0.5 rounded border border-zinc-300 bg-white disabled:opacity-40" data-add-benefit>+ {CBA_UI.addBenefit}</button>
  const submit = () => {
    const lo = num(low), hi = num(high), py = num(priceYear), mo = num(months), rf = num(ref)
    if ([lo, hi, py, mo, rf].some((x) => Number.isNaN(x))) { setLocal('Not saved: a figure, year, duration or source number is not a number.'); return }
    setLocal(null)
    void onSubmit({
      label: label.trim(), beneficiary: who, beneficiaryName: named.trim() || null, measure: measure.trim() || null,
      ...(valued
        ? { low: lo, high: hi, priceYear: py, recurrence: rec || null, durationMonths: rec === 'PER_YEAR' ? mo : null, isHealth: health, sourceKind: sk, sourceRef: sk === 'REF' ? rf : null, benchmarkId: sk === 'BENCHMARK' ? bench || null : null, citationKey: sk === 'CITATION' ? cite.trim() || null : null, ownerReason: sk === 'OWNER' ? why.trim() || null : null, notValuedWhy: null }
        : { low: null, high: null, priceYear: null, recurrence: null, durationMonths: null, isHealth: health, sourceKind: null, notValuedWhy: nvWhy.trim() || null }),
    })
    if (!initial) { setLabel(''); setMeasure(''); setLow(''); setHigh(''); setWhy(''); setNvWhy(''); setOpen(false) }
  }
  return (
    <div className="mt-1 rounded border-2 border-zinc-300 p-1.5 space-y-1" data-benefit-form>
      <label className="block text-[11px] text-zinc-700">{CBA_UI.whatGained}<BoundedInput value={label} onChange={setLabel} max={LIMITS.benefitLabel} aria-label={CBA_UI.whatGained} wrapperClassName="w-full" className={`w-full ${inp}`} /></label>
      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-[11px] text-zinc-700">{CBA_UI.whoGains}<select value={who} onChange={(e) => setWho(e.target.value as PartyKind)} className={`block ${inp}`} aria-label={CBA_UI.whoGains}>{PARTY_KINDS.map((k) => <option key={k} value={k}>{PARTY_WORD[k]}</option>)}</select></label>
        <label className="text-[11px] text-zinc-700 flex-1 min-w-[10rem]">{CBA_UI.whoNamed}<BoundedInput value={named} onChange={setNamed} max={LIMITS.beneficiaryName} aria-label={CBA_UI.whoNamed} wrapperClassName="w-full" className={`w-full ${inp}`} /></label>
      </div>
      <label className="block text-[11px] text-zinc-700">{CBA_UI.howMeasured}<BoundedInput multiline rows={2} value={measure} onChange={setMeasure} max={LIMITS.benefitMeasure} aria-label={CBA_UI.howMeasured} wrapperClassName="w-full" className={`w-full ${inp}`} /></label>
      <fieldset className="text-[11px] text-zinc-700 flex gap-3" aria-label={CBA_UI.valuedAt}>
        <label className="flex items-center gap-1"><input type="radio" checked={valued} onChange={() => setValued(true)} /> {CBA_UI.valuedAt}</label>
        <label className="flex items-center gap-1"><input type="radio" checked={!valued} onChange={() => setValued(false)} /> {CBA_UI.notValued}</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={health} onChange={(e) => setHealth(e.target.checked)} /> {CBA_UI.healthEffect}</label>
      </fieldset>
      {valued ? (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-1.5 items-center text-[11px]">
            <span>£</span><input value={low} onChange={(e) => setLow(e.target.value)} placeholder="low" aria-label="Low figure (£)" className={`w-24 ${inp}`} />
            <span>to £</span><input value={high} onChange={(e) => setHigh(e.target.value)} placeholder="high" aria-label="High figure (£)" className={`w-24 ${inp}`} />
            <input value={priceYear} onChange={(e) => setPriceYear(e.target.value)} placeholder="price year" aria-label="Price year" className={`w-20 ${inp}`} />
            <select value={rec} onChange={(e) => setRec(e.target.value)} aria-label="One-off or per year" className={inp}><option value="PER_YEAR">per year</option><option value="ONE_OFF">one-off</option><option value="">not said</option></select>
            {rec === 'PER_YEAR' && <input value={months} onChange={(e) => setMonths(e.target.value)} placeholder="months (blank = the whole period)" aria-label="Duration in months" className={`w-52 ${inp}`} />}
          </div>
          <div className="flex flex-wrap gap-1.5 items-end text-[11px]">
            <label>{CBA_UI.source}<select value={sk} onChange={(e) => setSk(e.target.value)} className={`block ${inp}`} aria-label={CBA_UI.source}>
              <option value="OWNER">{CBA_UI.sourceOwner}</option><option value="REF">{CBA_UI.sourceRef}</option><option value="BENCHMARK">{CBA_UI.sourceBenchmark}</option><option value="CITATION">{CBA_UI.sourceCitation}</option>
            </select></label>
            {sk === 'REF' && <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="n" aria-label="Source number" className={`w-16 ${inp}`} />}
            {sk === 'BENCHMARK' && <select value={bench} onChange={(e) => setBench(e.target.value)} aria-label={CBA_UI.sourceBenchmark} className={`max-w-[22rem] ${inp}`}><option value="">choose a row…</option>{benchmarks.map((b) => <option key={b.id} value={b.id}>{b.metric} — {b.source}</option>)}</select>}
            {sk === 'CITATION' && <BoundedInput value={cite} onChange={setCite} max={LIMITS.citationKey} placeholder="green-book:8.58" aria-label={CBA_UI.sourceCitation} className={`w-40 ${inp}`} />}
            {sk === 'OWNER' && <label className="flex-1 min-w-[12rem]">{CBA_UI.ownerReason}<BoundedInput value={why} onChange={setWhy} max={LIMITS.benefitReason} aria-label={CBA_UI.ownerReason} wrapperClassName="w-full" className={`w-full ${inp}`} /></label>}
          </div>
          <p className="text-[10px] text-zinc-600">A figure with no source is kept but not valued, and counts in no total.</p>
        </div>
      ) : (
        <label className="block text-[11px] text-zinc-700">{CBA_UI.notValuedWhy}<BoundedInput value={nvWhy} onChange={setNvWhy} max={LIMITS.benefitReason} placeholder="e.g. no source measures this yet" aria-label={CBA_UI.notValuedWhy} wrapperClassName="w-full" className={`w-full ${inp}`} /></label>
      )}
      {local && <p role="alert" className="text-[11px] font-semibold border-2 border-zinc-900 rounded px-2 py-0.5">⚠ {local}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={disabled || label.trim().length < 3} onClick={submit} className="text-[11px] font-medium px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40" data-benefit-save>{submitLabel}</button>
        <button type="button" onClick={() => { setOpen(false); onCancel?.() }} className="text-[11px] underline">{COMMON_UI.cancel}</button>
      </div>
    </div>
  )
}

function CostAppraisal({ c, disabled, save }: { c: CostRowT; disabled: boolean; save: (patch: Record<string, unknown>, control: string) => Promise<boolean> }) {
  const a = c.appraisal
  const [payer, setPayer] = useState<string>(a.payer?.kind ?? '')
  const [payerName, setPayerName] = useState(a.payer?.name ?? '')
  const [rate, setRate] = useState(a.onCost ? String(Math.round(a.onCost.rate * 1000) / 10) : '')
  const [src, setSrc] = useState(a.onCost?.source ?? '')
  const [ob, setOb] = useState<string>(a.ob?.type ?? '')
  const [lower, setLower] = useState(a.ob?.lowered ? String(Math.round(a.ob.lowered.rate * 1000) / 10) : '')
  const [lowerWhy, setLowerWhy] = useState(a.ob?.lowered?.reason ?? '')
  const [cite, setCite] = useState(c.citationKey ?? '')
  return (
    <div className="text-[11px] text-zinc-800 border-t border-zinc-100 pt-1" data-cost-appraisal={c.id}>
      <p className="font-medium">{c.label} <span className="text-zinc-500">· {c.costType.toLowerCase()} · pays: {partyWords(a.payer)}</span></p>
      <div className="flex flex-wrap gap-1.5 items-end mt-0.5">
        <label>{CBA_UI.whoPays}<select value={payer} disabled={disabled} onChange={(e) => setPayer(e.target.value)} className={`block ${inp}`} aria-label={`${CBA_UI.whoPays} — ${c.label}`}><option value="">not stated</option>{PARTY_KINDS.map((k) => <option key={k} value={k}>{PARTY_WORD[k]}</option>)}</select></label>
        <BoundedInput value={payerName} onChange={setPayerName} max={LIMITS.beneficiaryName} placeholder="named (optional)" aria-label={`${CBA_UI.whoNamed} — ${c.label}`} className={`w-40 ${inp}`} />
        <button type="button" disabled={disabled} onClick={() => void save({ payer: payer ? { kind: payer, name: payerName.trim() || null } : null }, CBA_UI.whoPays)} className="px-2 py-0.5 rounded border border-zinc-400 disabled:opacity-40">{COMMON_UI.save}</button>
      </div>
      {c.costType === 'STAFF' && (
        <div className="mt-1" data-on-cost>
          {a.onCost?.status === 'PROPOSED' ? (
            <p className="rounded border-2 border-dashed border-zinc-400 px-1.5 py-0.5"><span className="font-semibold">{CBA_UI.lexProposes}:</span> an employer on-cost of {pct(a.onCost.rate)} (source: {a.onCost.source}).{' '}
              <button type="button" disabled={disabled} onClick={() => void save({ onCostAnswer: 'accept' }, COMMON_UI.accept)} className="font-medium px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">{COMMON_UI.accept}</button>{' '}
              <button type="button" disabled={disabled} onClick={() => void save({ onCostAnswer: 'decline' }, COMMON_UI.setAside)} className="underline">{COMMON_UI.setAside}</button></p>
          ) : (
            <p className="text-zinc-700">{a.onCost ? `${CBA_UI.onCost}: ${pct(a.onCost.rate)} (${a.onCost.source})` : <span className="font-semibold">{CBA_UI.onCost}: none — this line {CBA_UI.excludesEmployer} (a floor).</span>}</p>
          )}
          <div className="flex flex-wrap gap-1.5 items-end mt-0.5">
            <input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="%" aria-label={`${CBA_UI.onCost} (%) — ${c.label}`} className={`w-14 ${inp}`} /><span>%</span>
            <BoundedInput value={src} onChange={setSrc} max={LIMITS.appraisalSource} placeholder={CBA_UI.onCostSource} aria-label={`${CBA_UI.onCostSource} — ${c.label}`} className={`w-64 ${inp}`} />
            <button type="button" disabled={disabled} onClick={() => { const r = num(rate); void save({ onCost: r == null ? null : { rate: (r as number) / 100, source: src } }, CBA_UI.onCost) }} className="px-2 py-0.5 rounded border border-zinc-400 disabled:opacity-40">{COMMON_UI.save}</button>
          </div>
        </div>
      )}
      {c.costType === 'CAPITAL' && (
        <div className="mt-1 flex flex-wrap gap-1.5 items-end" data-ob>
          <label>{CBA_UI.obType}<select value={ob} disabled={disabled} onChange={(e) => setOb(e.target.value)} className={`block ${inp}`} aria-label={`${CBA_UI.obType} — ${c.label}`}><option value="">not chosen (no uplift)</option>{OB_TYPES.map((t) => <option key={t} value={t}>{OB_TYPE_WORD[t as ObType]}</option>)}</select></label>
          <button type="button" disabled={disabled} onClick={() => void save({ obType: ob || null }, CBA_UI.obType)} className="px-2 py-0.5 rounded border border-zinc-400 disabled:opacity-40">{COMMON_UI.save}</button>
          {a.ob && (<>
            <span className="basis-full" />
            <label>{CBA_UI.obLower}<input value={lower} onChange={(e) => setLower(e.target.value)} placeholder="%" aria-label={`${CBA_UI.obLower} (%) — ${c.label}`} className={`block w-14 ${inp}`} /></label>
            <label className="flex-1 min-w-[12rem]">{CBA_UI.obLowerReason}<BoundedInput value={lowerWhy} onChange={setLowerWhy} max={LIMITS.obLowerReason} aria-label={`${CBA_UI.obLowerReason} — ${c.label}`} wrapperClassName="w-full" className={`w-full ${inp}`} /></label>
            <button type="button" disabled={disabled} onClick={() => { const r = num(lower); void save({ obLowered: r == null ? null : { rate: (r as number) / 100, reason: lowerWhy } }, CBA_UI.obLower) }} className="px-2 py-0.5 rounded border border-zinc-400 disabled:opacity-40">{COMMON_UI.save}</button>
          </>)}
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-1.5 items-end">
        <label>{CBA_UI.citationKey}<BoundedInput value={cite} onChange={setCite} max={LIMITS.citationKey} placeholder="gb-discounting:3.8" aria-label={`${CBA_UI.citationKey} — ${c.label}`} className={`block w-44 ${inp}`} /></label>
        <button type="button" disabled={disabled} onClick={() => void save({ citationKey: cite.trim() || null }, CBA_UI.citationKey)} className="px-2 py-0.5 rounded border border-zinc-400 disabled:opacity-40">{COMMON_UI.save}</button>
      </div>
    </div>
  )
}
