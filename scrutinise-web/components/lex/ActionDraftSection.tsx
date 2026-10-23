'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-U §3–§4 — THE DRAFTING INSTRUCTION'S EDITOR, and "Draft all legislative actions" under a heading.
// 26-V1b §3: the record's old "Draft text and what this touches" block is gone — the document view (DocumentView.tsx) shows the instruction,
// the clause, Lex's proposal and what it touches; it reuses the Editor below for "Edit".
//
// Draft text: the current drafting-instruction version (every field, the clause with its caveat first), the earlier versions kept beneath,
// Lex's draft BESIDE it (never over it) with "Use this version" / "Dismiss", and "Draft this clause" — priced, measured, asks first above 5p.
// What this touches: computed on request from the current version (never written), with the three honest states in words.
// ⚠ Colour is never the only cue (§21): every state is a word; Lex's draft is a 2px-bordered box headed in words.
// ─────────────────────────────────────────────────────────────────────────────

import { useRef, useState } from 'react'
import { parseDraft, draftPrice, INSTRUMENT_WORD, INSTRUMENTS, RELATIONS, EXTENTS, type DraftInstruction, type Relation, type Instrument } from '@/lib/lex/action-draft-pure'
import { LIMITS } from '@/lib/lex/input-limits'
import BoundedInput from './BoundedInput'


// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Run = (op: any, body: any, label?: string, said?: (r: any) => string | null) => Promise<{ ok: boolean; result: any; error: string | null }>

interface Props { a: { id: string; number: number | null; avenue: string | null; record?: unknown }; run: Run; disabled: boolean }

/** The record's `draft`, read the same way the server reads it. */
const draftOfRecord = (record: unknown) => parseDraft((record as { draft?: unknown } | null)?.draft)


/** Provisions as the editor shows them: one line each, "relation docUri provisionPath — note". */
const toLines = (v: DraftInstruction) => v.provisions.map((p) => `${p.relation} ${p.docUri}${p.provisionPath ? ` ${p.provisionPath}` : ''}${p.note ? ` — ${p.note}` : ''}`).join('\n')
function fromLines(s: string): DraftInstruction['provisions'] {
  return s.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    const [head, ...note] = l.split(' — ')
    const [relation, docUri, provisionPath] = head.trim().split(/\s+/)
    return { relation: ((RELATIONS as readonly string[]).includes(relation) ? relation : 'amends') as Relation, docUri: docUri ?? '', provisionPath: provisionPath ?? null, note: note.join(' — ').trim() }
  })
}

export function Editor({ start, legislative, onSave, onCancel, disabled }: { start: DraftInstruction; legislative: boolean; onSave: (v: DraftInstruction) => void; onCancel: () => void; disabled: boolean }) {
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

