'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-U §3–§4 — THE OPENED RECORD'S "DRAFT TEXT" AND "WHAT THIS TOUCHES".
//
// Draft text: the current drafting-instruction version (every field, the clause with its caveat first), the earlier versions kept beneath,
// Lex's draft BESIDE it (never over it) with "Use this version" / "Dismiss", and "Draft this clause" — priced, measured, asks first above 5p.
// What this touches: computed on request from the current version (never written), with the three honest states in words.
// ⚠ Colour is never the only cue (§21): every state is a word; Lex's draft is a 2px-bordered box headed in words.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from 'react'
import {
  parseDraft, currentVersion, missingFields, draftPrice, DRAFT_CONFIRM_ABOVE_PENCE, INSTRUMENT_WORD, INSTRUMENTS, RELATIONS, EXTENTS, provisionLine,
  type DraftInstruction, type DraftVersion, type Relation, type Instrument,
} from '@/lib/lex/action-draft-pure'
import { STATE_WORDS, type TouchesResult, type Touch } from '@/lib/lex/action-touches-pure'
import { LIMITS } from '@/lib/lex/input-limits'
import BoundedInput from './BoundedInput'


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Run = (op: any, body: any, label?: string, said?: (r: any) => string | null) => Promise<{ ok: boolean; result: any; error: string | null }>

interface Props { a: { id: string; number: number | null; avenue: string | null; record?: unknown }; run: Run; disabled: boolean }

/** The record's `draft`, read the same way the server reads it. */
const draftOfRecord = (record: unknown) => parseDraft((record as { draft?: unknown } | null)?.draft)

function Fields({ v, legislative }: { v: DraftInstruction; legislative: boolean }) {
  const row = (label: string, value: string | null) => (
    <p className="text-[11px]"><span className="font-semibold text-zinc-700">{label}:</span> {value?.trim() ? value : <span className="font-semibold">not yet answered</span>}</p>
  )
  return (
    <div className="space-y-0.5">
      {row('Instrument', v.instrument ? INSTRUMENT_WORD[v.instrument] : null)}
      {legislative && (
        <div className="text-[11px]"><span className="font-semibold text-zinc-700">Amends / inserts into / repeals:</span>{' '}
          {v.provisions.length ? <ul className="list-disc ml-4">{v.provisions.map((p, i) => <li key={i} data-provision-line>{provisionLine(p)}</li>)}</ul> : <span className="font-semibold">not yet answered</span>}</div>
      )}
      {row('Duty on whom', v.dutyOnWhom)}
      {row('Enforced how', v.enforcedHow)}
      {legislative && row('Commencement', v.commencement)}
      {legislative && row('Extent', v.extent.join(', '))}
      {legislative && row('Precedent drawn on', v.precedents.map((p) => `${p.docUri}${p.provisionPath ? ` · ${p.provisionPath}` : ''} — ${p.how}`).join('; '))}
      {legislative
        ? (v.clause ? <pre className="mt-1 whitespace-pre-wrap text-[11px] font-serif bg-zinc-50 border border-zinc-200 rounded p-2" data-clause>{v.clause}</pre> : row('The clause', null))
        : row('Wording', v.plainWording)}
      {v.citations.length > 0 && <p className="text-[10px] text-zinc-500">Drafted from: {v.citations.join(' · ')}</p>}
    </div>
  )
}

/** Provisions as the editor shows them: one line each, "relation docUri provisionPath — note". */
const toLines = (v: DraftInstruction) => v.provisions.map((p) => `${p.relation} ${p.docUri}${p.provisionPath ? ` ${p.provisionPath}` : ''}${p.note ? ` — ${p.note}` : ''}`).join('\n')
function fromLines(s: string): DraftInstruction['provisions'] {
  return s.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [head, ...note] = l.split(' — ')
    const [relation, docUri, provisionPath] = head.trim().split(/\s+/)
    return { relation: ((RELATIONS as readonly string[]).includes(relation) ? relation : 'amends') as Relation, docUri: docUri ?? '', provisionPath: provisionPath ?? null, note: note.join(' — ').trim() }
  })
}

function Editor({ start, legislative, onSave, onCancel, disabled }: { start: DraftInstruction; legislative: boolean; onSave: (v: DraftInstruction) => void; onCancel: () => void; disabled: boolean }) {
  const [v, setV] = useState<DraftInstruction>(start)
  const [lines, setLines] = useState(toLines(start))
  const set = (p: Partial<DraftInstruction>) => setV((x) => ({ ...x, ...p }))
  const box = 'w-full text-xs p-1.5 rounded border border-zinc-300'
  return (
    <div className="space-y-1.5 rounded border border-blue-200 p-2" data-draft-editor>
      <label className="block text-[11px]">Instrument
        <select value={v.instrument ?? ''} onChange={(e) => set({ instrument: (e.target.value || null) as Instrument | null })} className="ml-1 border border-zinc-300 rounded px-1 py-0.5">
          <option value="">not chosen</option>{INSTRUMENTS.map((i) => <option key={i} value={i}>{INSTRUMENT_WORD[i]}</option>)}
        </select></label>
      {legislative && (
        <label className="block text-[11px]">Amends / inserts into / repeals — one line each: relation ({RELATIONS.join(', ')}), the Act (ukpga/2010/25), the provision (section/5), then “ — ” and a note
          <textarea value={lines} onChange={(e) => setLines(e.target.value)} rows={4} className={box} aria-label="Provisions" /></label>
      )}
      {/* Every bounded box shows its limit and says when it cut something (§30.1); the numbers are the schema's own. */}
      <label className="block text-[11px]">Duty on whom<BoundedInput value={v.dutyOnWhom} onChange={(x) => set({ dutyOnWhom: x })} className={box} max={LIMITS.instructionLine} aria-label="Duty on whom" /></label>
      <label className="block text-[11px]">Enforced how<BoundedInput value={v.enforcedHow} onChange={(x) => set({ enforcedHow: x })} className={box} max={LIMITS.instructionLine} aria-label="Enforced how" /></label>
      {legislative && <label className="block text-[11px]">Commencement<BoundedInput value={v.commencement} onChange={(x) => set({ commencement: x })} className={box} max={LIMITS.instructionLine} aria-label="Commencement" /></label>}
      {legislative && (
        <fieldset className="text-[11px]"><legend>Extent</legend>{EXTENTS.map((x) => (
          <label key={x} className="mr-2"><input type="checkbox" checked={v.extent.includes(x)} onChange={(e) => set({ extent: e.target.checked ? [...v.extent, x] : v.extent.filter((y) => y !== x) })} /> {x}</label>
        ))}</fieldset>
      )}
      {legislative
        ? <label className="block text-[11px]">The clause — its first line is always the caveat, added if you leave it out<textarea value={v.clause} onChange={(e) => set({ clause: e.target.value })} rows={8} className={`${box} font-serif`} aria-label="The clause" /></label>
        : <label className="block text-[11px]">Wording, in plain English<textarea value={v.plainWording} onChange={(e) => set({ plainWording: e.target.value })} rows={4} className={box} /></label>}
      <label className="block text-[11px]">Purpose — one line<BoundedInput value={v.purpose} onChange={(x) => set({ purpose: x })} className={box} max={LIMITS.instructionPurpose} aria-label="Purpose" /></label>
      <div className="flex gap-2">
        <button disabled={disabled} onClick={() => onSave({ ...v, provisions: legislative ? fromLines(lines) : [] })} className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Save as a new version</button>
        <button onClick={onCancel} className="text-xs underline text-zinc-600">Cancel</button>
      </div>
    </div>
  )
}

function TouchView({ t }: { t: Touch }) {
  return (
    <li className="border border-zinc-200 rounded p-1.5 text-[11px]" data-touch-state={t.state}>
      <p><span className="font-semibold">{provisionLine(t.line)}</span>{t.actTitle ? ` (${t.actTitle})` : ''} — <span className="font-semibold">{STATE_WORDS[t.state]}</span>{t.stateReason ? `: ${t.stateReason}` : ''}</p>
      {t.heldText && <details><summary className="cursor-pointer text-zinc-600">The provision as held ({t.heldChars?.toLocaleString('en-GB')} characters)</summary><pre className="whitespace-pre-wrap font-serif mt-1">{t.heldText}</pre></details>}
      {t.effects && (
        <div className="mt-1" data-touch-effects>
          <p>{t.effects.headline}</p>
          <ul className="ml-4 list-disc">{t.effects.perType.map((c) => (
            <li key={c.type}>{c.type}: {c.total} — {c.changeTheWords} change the words, {c.doNotChangeTheWords} do not, {c.unclassified} unclassified</li>
          ))}</ul>
          <p className="text-zinc-500">{t.effects.freshness} {t.effects.coverage}</p>
        </div>
      )}
      {t.near.length > 0 && (
        <details className="mt-1" open><summary className="cursor-pointer text-zinc-700">Near provisions in the same Act ({t.near.length})</summary>
          <ul className="ml-4 list-disc" data-near>{t.near.map((n) => <li key={n.ref}>s.{n.number} {n.title} ({n.why}) — <span className="font-semibold">{n.question}</span></li>)}</ul></details>
      )}
      {t.nearNote && <p className="text-zinc-500">{t.nearNote}</p>}
    </li>
  )
}

/**
 * 26-U §3b — "Draft all legislative actions" under a heading: one draft per action, one after another; each is STORED as it completes, so
 * stopping (or a failure, or closing the tab) loses nothing and pressing again carries on with the rest. Asks first, with the measured price.
 * ⚠ Runs from the page, one route call per action — not on the build worker (BRIEF_26U asks for the worker; see the 26-U report).
 */
export function DraftAllButton({ actions, run, disabled, headingName }: { actions: Props['a'][]; run: Run; disabled: boolean; headingName: string }) {
  const legis = actions.filter((x) => x.avenue === 'LEGISLATIVE')
  const todo = legis.filter((x) => { const d = draftOfRecord(x.record); return !d?.proposal && !d?.versions.length })
  const [asking, setAsking] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const stop = useRef(false) // a ref, not state: the running loop must see the press
  const price = draftPrice()
  if (!legis.length) return null
  const total = Math.round(price.pence * todo.length * 10) / 10
  const go = async () => {
    setAsking(false); stop.current = false
    let done = 0, pence = 0
    for (const x of todo) {
      if (stop.current) break
      setProgress(`Drafting #${x.number ?? '?'} — ${done} of ${todo.length} done so far`)
      const r = await run('draftAction', { actionId: x.id }, `Lex is drafting #${x.number ?? '?'}`, () => null)
      if (!r.ok) { setProgress(`Stopped at #${x.number ?? '?'}: ${r.error ?? 'the draft did not complete'}. ${done} drafted; press again to carry on with the rest.`); return }
      done++; pence += Number(r.result?.pence ?? 0)
    }
    setProgress(`${done} of ${todo.length} drafted under “${headingName}” (${pence.toFixed(1)}p). Each is beside its action’s instruction, waiting for you.`)
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] pl-2" data-draft-all>
      {!asking && todo.length > 0 && <button type="button" disabled={disabled || !!progress?.startsWith('Drafting')} onClick={() => setAsking(true)} className="font-medium px-1.5 py-0.5 rounded border border-zinc-300">Draft all legislative actions ({todo.length} not yet drafted)</button>}
      {asking && <span>This drafts {todo.length} clause{todo.length === 1 ? '' : 's'}, about {total}p in all ({price.measured ? `measured, n=${price.n}` : 'an estimate'}). <button onClick={() => void go()} className="font-semibold underline">Draft them</button> · <button onClick={() => setAsking(false)} className="underline">Not now</button></span>}
      {progress?.startsWith('Drafting') && <button type="button" onClick={() => { stop.current = true }} className="underline">Stop after this one</button>}
      {!todo.length && <span className="text-zinc-600">Every legislative action here has a drafting instruction or a draft waiting.</span>}
      {progress && <span role="status">{progress}</span>}
    </div>
  )
}

export default function ActionDraftSection({ a, run, disabled }: Props) {
  const d = draftOfRecord(a.record)
  const cur: DraftVersion | null = currentVersion(d)
  const legislative = a.avenue === 'LEGISLATIVE'
  const [editing, setEditing] = useState(false)
  const [asking, setAsking] = useState(false)
  const [touches, setTouches] = useState<TouchesResult | null>(null)
  const price = draftPrice()
  const priceWords = `about ${price.pence}p, ${price.measured ? `measured (n=${price.n})` : 'an estimate'}`
  const missing = missingFields(cur, legislative)
  const draft = () => { setAsking(false); void run('draftAction', { actionId: a.id }, 'Lex is drafting (a minute or two)', (r) => `Lex’s draft for #${a.number ?? '?'} is beside your instruction${r?.pence != null ? ` — it cost ${Number(r.pence).toFixed(1)}p` : ''}. Nothing of yours was changed.`) }

  return (
    <div className="space-y-2" data-draft-section>
      <div className="rounded border border-zinc-200 bg-white p-2 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Draft text {cur ? `— version ${cur.v}, by ${cur.by === 'USER' ? 'you' : 'Lex (accepted)'}${cur.at ? `, ${cur.at.slice(0, 10)}` : ''}` : '— no drafting instruction yet'}</p>
        {cur && !editing && <Fields v={cur} legislative={legislative} />}
        {!editing && missing.length > 0 && <p className="text-[11px]"><span className="font-semibold">Still missing:</span> {missing.join(', ')}.</p>}
        {editing && <Editor start={cur ?? { instrument: null, provisions: [], dutyOnWhom: '', enforcedHow: '', commencement: '', extent: [], precedents: [], clause: '', plainWording: '', purpose: '', citations: [] }} legislative={legislative} disabled={disabled}
          onCancel={() => setEditing(false)}
          onSave={async (v) => { const r = await run('saveDraft', { actionId: a.id, instruction: v }, undefined, (x) => `Saved as version ${x?.version ?? '?'} of the drafting instruction for #${a.number ?? '?'}. The earlier versions are kept.`); if (r.ok) setEditing(false) }} />}
        {!editing && (
          <div className="flex flex-wrap gap-2 items-center">
            <button disabled={disabled} onClick={() => setEditing(true)} className="text-[11px] font-medium px-2 py-0.5 rounded border border-zinc-300">{cur ? 'Edit (saves a new version)' : 'Write the instruction'}</button>
            {!asking && <button disabled={disabled} onClick={() => (price.pence > DRAFT_CONFIRM_ABOVE_PENCE ? setAsking(true) : draft())} className="text-[11px] font-medium px-2 py-0.5 rounded border border-zinc-300" data-draft-button
              title={`Lex writes the instruction and ${legislative ? 'an illustrative clause' : 'the wording'} to the Parliamentary Counsel’s guidance, beside yours. ${priceWords}.`}>Draft this {legislative ? 'clause' : 'wording'} with Lex ({priceWords})</button>}
            {asking && <span className="text-[11px]" data-draft-confirm>This spends {priceWords}. <button onClick={draft} className="font-semibold underline">Draft it</button> · <button onClick={() => setAsking(false)} className="underline">Not now</button></span>}
          </div>
        )}
        {d && d.versions.length > 1 && (
          <details className="text-[11px]"><summary className="cursor-pointer text-zinc-600">Earlier versions ({d.versions.length - 1}) — kept</summary>
            <ol className="ml-4 list-decimal">{d.versions.slice(0, -1).reverse().map((v) => <li key={v.v} value={v.v}>by {v.by === 'USER' ? 'you' : 'Lex (accepted)'}, {v.at.slice(0, 10)}<Fields v={v} legislative={legislative} /></li>)}</ol></details>
        )}
      </div>

      {d?.proposal && (
        <div className="rounded-lg border-2 border-zinc-900 bg-zinc-50 p-2 space-y-1" data-draft-proposal>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-700"><span aria-hidden>◇</span> Lex’s draft — beside your instruction, not over it</p>
          <p className="text-[11px] text-zinc-600">{d.proposal.reason}{d.proposal.pence != null ? ` (It cost ${d.proposal.pence.toFixed(1)}p.)` : ''}</p>
          <Fields v={d.proposal} legislative={legislative} />
          <div className="flex gap-2">
            <button disabled={disabled} onClick={() => void run('acceptDraft', { actionId: a.id }, undefined, (x) => `Lex’s draft is now version ${x?.version ?? '?'}. Your earlier versions are kept.`)} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-zinc-900 text-white disabled:opacity-40">Use this version</button>
            <button disabled={disabled} onClick={() => void run('dismissDraft', { actionId: a.id }, undefined, () => 'Lex’s draft is dismissed. Nothing else changed.')} className="text-xs px-2.5 py-1 rounded-lg border border-zinc-300">Dismiss</button>
          </div>
        </div>
      )}

      <div className="rounded border border-zinc-200 bg-white p-2 space-y-1.5" data-touches-section>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">What this touches</p>
        {!cur && <p className="text-[11px]">Computed from the drafting instruction’s named provisions — there is no instruction yet.</p>}
        {cur && <button disabled={disabled} onClick={async () => { const r = await run('touches', { actionId: a.id }, 'Reading the statute book', () => null); if (r.ok) setTouches(r.result) }} className="text-[11px] font-medium px-2 py-0.5 rounded border border-zinc-300">{touches ? 'Read it again' : 'Show what this touches'} (free)</button>}
        {touches && (touches.touches.length
          ? <ul className="space-y-1" data-touches>{touches.touches.map((t, i) => <TouchView key={i} t={t} />)}</ul>
          : <p className="text-[11px] font-semibold">The instruction names no provision it amends, repeals, modifies, relies on or is constrained by.</p>)}
      </div>
    </div>
  )
}
