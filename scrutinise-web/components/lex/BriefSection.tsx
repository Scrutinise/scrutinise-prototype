'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-X X2 (decision 309, BRIEF_26X §5c–§5d) — THE BRIEF, and "Draft it" between the Brief and the Draft.
//
//   One block per kind of the action's draft (one instrument per action, 313 — usually one block): the saved Brief with its version; Lex's
//   proposed Brief BESIDE it (Use it · Edit it, then save · Set it aside); the form (common fields, then the kind's own); "Ask Lex to write
//   the Brief" at its measured price, asked first; then "Draft it", asked first at the measured price for the kind, refused in words while
//   the Brief is empty; and, under it, which Brief version the draft was drafted from, or "Brief changed since this draft".
//   A draft clause's per-kind fields are its drafting instruction, read in place (Charlie, 7 Nov) and edited with 26-U's own editor.
//
// ⚠ Shape and word, never colour alone (§21): ● saved, ◇ Lex's proposal, ○ none. ⚠ Every limit shows its counter (§30.1).
// ⚠ Imports only pure modules, types and client components (§28).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { BriefView, BriefKindView } from '@/lib/lex/action-brief'
import { KIND_FIELDS, TONES, EMPTY_BRIEF, briefBody, draftedFromWords, modelledOnWords, type Brief, type BriefKind } from '@/lib/lex/action-brief-pure'
import { KIND_WORD } from '@/lib/lex/action-documents-pure'
import { kindPrice, priceWords } from '@/lib/lex/document-drafting-pure'
import { BRIEF_UI, BRIEF_FIELD_WORD, TONE_WORD, COMMON_UI } from '@/lib/lex/screen-labels'
import { LIMITS } from '@/lib/lex/input-limits'
import { explainFailure } from '@/lib/api-rejection'
import BoundedInput from './BoundedInput'
import { Editor } from './ActionDraftSection'

const box = 'w-full text-xs border border-zinc-300 rounded px-1.5 py-1'
const AUTHOR_WORD: Record<string, string> = { OWNER: 'you', COLLABORATOR: 'a collaborator', LEX: 'Lex (used by you)' }
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

export default function BriefSection({ ideaId, a, disabled, onChanged, besideDraftIt, initialView }: {
  ideaId: string; a: { id: string; number: number | null; avenue: string | null }; disabled: boolean; onChanged: () => void
  /** "Needs no draft, because…" — beside "Draft it" (§5c item 3). */
  besideDraftIt?: ReactNode
  /** The view as the route returns it, drawn before the first read (a render harness; the read still runs on mount). */
  initialView?: BriefView
}) {
  const [view, setView] = useState<BriefView | null>(initialView ?? null)
  const [error, setError] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/action-documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'brief', actionId: a.id }) })
      const body = await res.json().catch(() => null)
      if (!res.ok) { setError(explainFailure(body, res.status, 'Reading the Brief')); return }
      setView((body as { data: BriefView }).data); setError(null)
    } catch (e) { setError(`could not reach the server (${e instanceof Error ? e.message : 'network error'})`) }
  }, [ideaId, a.id])
  useEffect(() => { void load() }, [load])
  const post = async (url: string, payload: Record<string, unknown>, label: string, ok: (r: Record<string, unknown> | null) => string): Promise<boolean> => {
    setBusy(true); setSaid(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/${url}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await res.json().catch(() => null) as { ok?: boolean; data?: Record<string, unknown>; result?: Record<string, unknown> } | null
      if (!res.ok || body?.ok === false) { setSaid(`Not done: ${explainFailure(body, res.status, label)}`); return false }
      setSaid(ok(body?.data ?? body?.result ?? null)); await load(); onChanged(); return true
    } finally { setBusy(false) }
  }

  if (error) return <p className="text-xs" role="alert">Not read: {error}</p>
  if (!view) return <p className="text-xs text-zinc-500">Reading the Brief…</p>
  return (
    <div className="space-y-2 text-xs" data-record-brief>
      {!view.kinds.length && <p data-brief-none>No Brief: {view.why}.</p>}
      {view.kinds.map((k) => <KindBrief key={k.kind} k={k} view={view} a={a} busy={busy} disabled={disabled} post={post} />)}
      {view.kinds.length > 0 && besideDraftIt}
      {said && <p className="border border-zinc-300 rounded px-2 py-1" role="status">{said} <button type="button" className="underline ml-1" onClick={() => setSaid(null)}>{COMMON_UI.ok}</button></p>}
    </div>
  )
}

type Post = (url: string, payload: Record<string, unknown>, label: string, ok: (r: Record<string, unknown> | null) => string) => Promise<boolean>

function KindBrief({ k, view, a, busy, disabled, post }: { k: BriefKindView; view: BriefView; a: { id: string; number: number | null; avenue: string | null }; busy: boolean; disabled: boolean; post: Post }) {
  const [editing, setEditing] = useState<Brief | null>(null)
  const [answering, setAnswering] = useState(false) // editing Lex's proposal before saving it
  const [askingPrefill, setAskingPrefill] = useState(false)
  const [askingDraft, setAskingDraft] = useState(false)
  const [instruction, setInstruction] = useState(false)
  const n = `#${a.number ?? '?'}`
  const kindWord = KIND_WORD[k.kind]
  const draftPrice = kindPrice(k.kind)
  const prefill = view.prefill
  const save = async (b: Brief) => {
    const done = answering && k.documentId
      ? await post('action-documents', { op: 'useBrief', documentId: k.documentId, edited: b }, BRIEF_UI.editThenSave, (r) => `Saved: version ${String(r?.v ?? '?')} of the Brief for ${n}’s ${kindWord}, from Lex’s proposal as you edited it.`)
      : await post('action-documents', { op: 'saveBrief', actionId: a.id, kind: k.kind, brief: b }, BRIEF_UI.saveBrief, (r) => `Saved: version ${String(r?.v ?? '?')} of the Brief for ${n}’s ${kindWord}. The earlier versions are kept.`)
    if (done) { setEditing(null); setAnswering(false) }
  }
  const drafted = draftedFromWords(k.draft?.draftedFromBriefV ?? null, k.current?.v ?? null, !!k.draft)
  return (
    <section className="rounded border border-zinc-300 bg-white p-2 space-y-1.5" data-brief-kind={k.kind}>
      <p className="font-semibold">
        <span aria-hidden>{k.current ? '●' : '○'}</span> {BRIEF_UI.section} — {kindWord}{k.d ? ` (${k.d})` : ''} ·{' '}
        <span data-brief-state>{k.current ? `version ${k.current.v}, by ${AUTHOR_WORD[k.current.author] ?? k.current.author}, ${day(k.current.at)}${k.versions.length > 1 ? ` · ${k.versions.length} versions kept` : ''}` : k.kind === 'DRAFT_CLAUSE' && k.instruction ? `its drafting instruction, version ${k.instruction.v}` : BRIEF_UI.noBriefYet}</span>
      </p>
      {k.current && !editing && <pre className="whitespace-pre-wrap font-sans text-[11px] text-zinc-800 bg-zinc-50 border border-zinc-200 rounded p-1.5 max-h-72 overflow-y-auto" data-brief-body>{k.current.body}</pre>}

      {/* a draft clause: its per-kind fields are its drafting instruction, read in place */}
      {k.kind === 'DRAFT_CLAUSE' && (
        <div className="rounded border border-zinc-200 p-1.5" data-brief-instruction>
          <p><span className="font-semibold">{BRIEF_UI.instructionIsBrief}</span>{k.instruction
            ? `: version ${k.instruction.v} — instrument ${k.instruction.instrument ?? 'not set'}; duty on ${k.instruction.dutyOnWhom || 'not set'}; enforced ${k.instruction.enforcedHow || 'not set'}; commencement ${k.instruction.commencement || 'not set'}; ${k.instruction.provisions} provision line${k.instruction.provisions === 1 ? '' : 's'}.`
            : ': none written yet.'}</p>
          {!disabled && !instruction && <button type="button" disabled={busy} onClick={() => setInstruction(true)} className="underline disabled:opacity-40" data-brief-instruction-edit>{BRIEF_UI.editInstruction}</button>}
          {instruction && <Editor start={k.instruction?.full ?? { instrument: null, provisions: [], dutyOnWhom: '', enforcedHow: '', commencement: '', extent: [], precedents: [], clause: '', plainWording: '', purpose: '', citations: [] }} legislative={a.avenue === 'LEGISLATIVE'} disabled={busy} onCancel={() => setInstruction(false)}
            onSave={async (v) => { if (await post('action-structure', { op: 'saveDraft', actionId: a.id, instruction: v }, `Saving the instruction for ${n}`, (r) => `Saved: version ${String(r?.version ?? '?')} of ${n}’s drafting instruction.`)) setInstruction(false) }} />}
        </div>
      )}

      {/* Lex's proposed Brief, BESIDE the saved one — never over it */}
      {k.proposal && !editing && (
        <div className="rounded border-2 border-zinc-900 p-1.5 space-y-1" data-brief-proposal={k.proposal.v}>
          <p><span aria-hidden>◇</span> <span className="font-semibold">{BRIEF_UI.lexProposesBrief}</span>{k.proposal.pence != null ? ` (it cost ${k.proposal.pence.toFixed(1)}p)` : ''}{k.proposal.reason ? ` — ${k.proposal.reason}` : ''}</p>
          <pre className="whitespace-pre-wrap font-sans text-[11px] bg-zinc-50 border border-zinc-200 rounded p-1.5 max-h-72 overflow-y-auto">{k.proposal.body}</pre>
          {k.proposal.split && (
            <div className="space-y-0.5" data-brief-split>
              <p>Using it also moves these paragraphs out of the Action details. The Action details would then keep {k.proposal.split.detailAfter.length.toLocaleString('en-GB')} characters:</p>
              <pre className="whitespace-pre-wrap font-sans text-[11px] bg-zinc-50 border border-zinc-200 rounded p-1.5 max-h-48 overflow-y-auto">{k.proposal.split.detailAfter}</pre>
              {k.proposal.split.stale && <p className="font-semibold" role="alert">⚠ The Action details have changed since this split was proposed, so it cannot be used as it stands.</p>}
            </div>
          )}
          {!disabled && (
            <p className="flex flex-wrap gap-2">
              <button type="button" disabled={busy || !!k.proposal.split?.stale} data-brief-use className="px-2 py-0.5 rounded bg-zinc-900 text-white font-medium disabled:opacity-40"
                onClick={() => void post('action-documents', { op: 'useBrief', documentId: k.documentId }, BRIEF_UI.useBrief, (r) => `Saved: Lex’s proposal is now version ${String(r?.v ?? '?')} of the Brief${r?.split ? ', and the Action details keep the rest (the old text is kept in the history)' : ''}.`)}>
                {k.proposal.split ? BRIEF_UI.acceptSplit : BRIEF_UI.useBrief}</button>
              {!k.proposal.split && <button type="button" disabled={busy} className="underline" data-brief-edit-proposal onClick={() => { setEditing(k.proposal!.brief); setAnswering(true) }}>{BRIEF_UI.editThenSave}</button>}
              <button type="button" disabled={busy} className="underline" data-brief-set-aside
                onClick={() => void post('action-documents', { op: 'setAsideBrief', documentId: k.documentId }, BRIEF_UI.setAside, () => 'Saved: Lex’s proposal is set aside and kept; your Brief is unchanged.')}>{BRIEF_UI.setAside}</button>
            </p>
          )}
        </div>
      )}

      {editing && <BriefForm kind={k.kind} start={editing} busy={busy} onCancel={() => { setEditing(null); setAnswering(false) }} onSave={save} />}

      {!disabled && !editing && (
        <p className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} data-brief-edit onClick={() => setEditing(k.current?.brief ?? EMPTY_BRIEF)} className="px-2 py-0.5 rounded border-2 border-zinc-900 font-medium disabled:opacity-40">{k.current ? BRIEF_UI.editBriefAgain : BRIEF_UI.editBrief}</button>
          {prefill.pence != null && (askingPrefill
            ? <span data-brief-prefill-confirm>This spends about {priceWords(prefill.pence)} (measured, n={prefill.n}); Lex’s Brief waits beside {k.current ? 'yours' : 'the empty one'} for you to use or set aside.{' '}
                <button type="button" className="font-semibold underline" onClick={() => { setAskingPrefill(false); void post('action-documents', { op: 'prefillBrief', actionId: a.id, kind: k.kind }, BRIEF_UI.askLexForBrief, (r) => `Saved: Lex’s proposed Brief is waiting below — use it, edit it or set it aside${r?.pence != null ? ` (it cost ${Number(r.pence).toFixed(1)}p)` : ''}.`) }}>{BRIEF_UI.askLexForBrief}</button>
                {' · '}<button type="button" className="underline" onClick={() => setAskingPrefill(false)}>{COMMON_UI.notNow}</button></span>
            : <button type="button" disabled={busy} data-brief-prefill onClick={() => setAskingPrefill(true)} className="underline disabled:opacity-40">{BRIEF_UI.askLexForBrief} — about {priceWords(prefill.pence)}</button>)}
          {prefill.pence == null && <span className="text-zinc-600" data-brief-prefill-unmeasured>{BRIEF_UI.askLexForBrief}: not offered until its price is measured.</span>}
        </p>
      )}

      {/* §5c item 3 — "Draft it": ONE button between the Brief and the Draft */}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-1.5" data-draft-it={k.kind}>
          {k.empty
            ? <><button type="button" disabled aria-disabled="true" className="px-2 py-0.5 rounded border border-zinc-300 text-zinc-500" data-draft-it-button>{BRIEF_UI.draftIt}</button><span data-draft-it-why>— {BRIEF_UI.briefEmpty}</span></>
            : draftPrice.pence == null
              ? <span>{BRIEF_UI.draftIt}: not offered yet — the price of a {kindWord} has not been measured.</span>
              : askingDraft
                ? <span data-draft-it-confirm>This spends about {priceWords(draftPrice.pence)} (measured, n={draftPrice.n}). Lex’s {kindWord} is saved as a proposal{k.current ? `, drafted from Brief version ${k.current.v}` : ''}.{' '}
                    <button type="button" className="font-semibold underline" onClick={() => { setAskingDraft(false); void post('action-documents', { op: 'draftIt', actionId: a.id, kind: k.kind, agreedPence: draftPrice.pence }, BRIEF_UI.draftIt, (r) => `Saved: Lex’s ${kindWord} for ${n} is waiting as a proposal below${r?.pence != null ? ` (it cost ${Number(r.pence).toFixed(1)}p)` : ''}.`) }}>{BRIEF_UI.draftIt}</button>
                    {' · '}<button type="button" className="underline" onClick={() => setAskingDraft(false)}>{COMMON_UI.notNow}</button></span>
                : <button type="button" disabled={busy} onClick={() => setAskingDraft(true)} className="px-2 py-0.5 rounded bg-zinc-900 text-white font-medium disabled:opacity-40" data-draft-it-button>{BRIEF_UI.draftIt} — about {priceWords(draftPrice.pence)}</button>}
        </div>
      )}
      {drafted && <p data-drafted-from className={k.changed ? 'font-semibold' : ''}>{k.changed ? '⚠ ' : ''}{drafted}</p>}
    </section>
  )
}

/** The form: the common fields, then the kind's own. Every box shows its limit (§30.1); nothing typed is cut without a word. */
function BriefForm({ kind, start, busy, onSave, onCancel }: { kind: BriefKind; start: Brief; busy: boolean; onSave: (b: Brief) => void; onCancel: () => void }) {
  const [b, setB] = useState<Brief>(start)
  const [ref, setRef] = useState(start.modelledOn && 'ref' in start.modelledOn ? String(start.modelledOn.ref) : start.modelledOn && 'corpusId' in start.modelledOn ? start.modelledOn.corpusId : '')
  const set = (p: Partial<Brief>) => setB((x) => ({ ...x, ...p }))
  const modelledOn = (s: string): Brief['modelledOn'] => { const t = s.trim().replace(/^\[?Ref:\s*/i, '').replace(/\]$/, ''); return !t ? null : /^\d+$/.test(t) ? { ref: Number(t) } : { corpusId: s.trim() } }
  const final = { ...b, modelledOn: modelledOn(ref) }
  return (
    <div className="rounded border border-zinc-900 p-2 space-y-2" data-brief-form={kind}>
      <label className="block"><span className="font-semibold">{BRIEF_FIELD_WORD.must}</span>
        <BoundedInput multiline rows={4} value={b.must} onChange={(v) => set({ must: v })} max={LIMITS.briefMust} aria-label={BRIEF_FIELD_WORD.must} className={box} wrapperClassName="w-full" /></label>
      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-1"><span className="font-semibold">{BRIEF_FIELD_WORD.modelledOn}</span>
          <BoundedInput value={ref} onChange={setRef} max={LIMITS.briefCorpusId} placeholder="a source number, as in 12, or a corpus section — or leave empty for none" aria-label={BRIEF_FIELD_WORD.modelledOn} className="w-80 text-xs border border-zinc-300 rounded px-1.5 py-0.5" /></label>
        <span className="text-zinc-600 self-center" data-brief-modelled-words>{modelledOnWords(final.modelledOn)}</span>
        <label className="flex items-center gap-1"><span className="font-semibold">{BRIEF_FIELD_WORD.tone}</span>
          <select value={b.tone ?? ''} onChange={(e) => set({ tone: (e.target.value || null) as Brief['tone'] })} aria-label={BRIEF_FIELD_WORD.tone} className="border border-zinc-300 rounded px-1 py-0.5">
            <option value="">not said</option>{TONES.map((t) => <option key={t} value={t}>{TONE_WORD[t]}</option>)}
          </select></label>
      </div>
      {KIND_FIELDS[kind].map((f) => (
        <label key={f} className="block"><span className="font-semibold">{BRIEF_FIELD_WORD[f]}</span>
          <BoundedInput value={b.kind[f] ?? ''} onChange={(v) => set({ kind: { ...b.kind, [f]: v } })} max={LIMITS.briefField} aria-label={BRIEF_FIELD_WORD[f]} className={box} wrapperClassName="w-full" /></label>
      ))}
      <Points label={BRIEF_FIELD_WORD.mustInclude} items={b.mustInclude} onChange={(xs) => set({ mustInclude: xs })} />
      <Points label={BRIEF_FIELD_WORD.mustNot} items={b.mustNot} onChange={(xs) => set({ mustNot: xs })} />
      <p className="text-zinc-600">Saved as a new version; the earlier ones are kept. It reads: {briefBody(kind, final).split('\n')[0] || '(empty)'}…</p>
      <p className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => onSave(final)} className="px-2 py-0.5 rounded bg-zinc-900 text-white font-medium disabled:opacity-40" data-brief-save>{BRIEF_UI.saveBrief}</button>
        <button type="button" onClick={onCancel} className="underline">{COMMON_UI.cancel}</button>
      </p>
    </div>
  )
}

function Points({ label, items, onChange }: { label: string; items: string[]; onChange: (xs: string[]) => void }) {
  return (
    <fieldset className="space-y-1" data-brief-points={label}>
      <legend className="font-semibold">{label} <span className="font-normal text-zinc-600">({items.length} of up to {LIMITS.briefPoints} points)</span></legend>
      {items.map((p, i) => (
        <div key={i} className="flex items-start gap-1">
          <span className="tabular-nums pt-1">{i + 1}.</span>
          <BoundedInput multiline rows={2} value={p} onChange={(v) => onChange(items.map((x, j) => (j === i ? v : x)))} max={LIMITS.briefPoint} aria-label={`${label}, point ${i + 1}`} className={box} wrapperClassName="flex-1" />
          <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="underline text-zinc-600 pt-1">{BRIEF_UI.removePoint}</button>
        </div>
      ))}
      {items.length < LIMITS.briefPoints && <button type="button" onClick={() => onChange([...items, ''])} className="underline">{BRIEF_UI.addPoint}</button>}
    </fieldset>
  )
}
