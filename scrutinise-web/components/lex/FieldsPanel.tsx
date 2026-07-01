'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { fieldDef, type CanonicalState, type CanonicalField, type CanonicalCause } from '@/lib/lex/page1-config'
import { SLOT_LABELS } from '@/lib/lex/page2-config'

// Grouped causes-loop + root-cause handlers (Page 2). Kept as one object so the panel
// signature stays readable.
export interface CausesApi {
  add: (input: { cause: string; whyPersisted?: string; evidence?: string }) => void
  update: (causeId: string, patch: { cause?: string; whyPersisted?: string; evidence?: string }) => void
  remove: (causeId: string) => void
  confirm: () => void
  skip: () => void
  setRoot: (causeId: string) => void
  skipRoot: () => void
}

function hintsFor(key: string): string[] {
  return fieldDef(key)?.hints ?? []
}

function isTerminal(f: CanonicalField) {
  return f.status === 'ACCEPTED' || f.status === 'SKIPPED'
}

function Tick() {
  return (
    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function StatusDot({ status }: { status: CanonicalField['status'] }) {
  const cls =
    status === 'ACCEPTED' ? 'bg-green-500'
      : status === 'SKIPPED' ? 'bg-zinc-300'
      : status === 'AWAITING_CONFIRMATION' ? 'bg-amber-400'
      : 'bg-zinc-200'
  return (
    <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${cls}`}>
      {status === 'ACCEPTED' && <Tick />}
    </span>
  )
}

function FieldHeader({ field, right }: { field: CanonicalField; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <StatusDot status={field.status} />
      <span className="text-sm font-medium text-zinc-800 flex-1">{field.label}</span>
      {right}
    </div>
  )
}

// A narrative box the user writes directly (Page 1 Box 1/2/3).
function BoxField({
  field, busy, onSubmitBox, onSkip,
}: {
  field: CanonicalField
  busy: boolean
  onSubmitBox: (key: string, value: string) => void
  onSkip: (key: string) => void
}) {
  const proposed =
    field.status === 'AWAITING_CONFIRMATION' && typeof field.proposal?.value === 'string'
      ? (field.proposal!.value as string)
      : null
  const baseline = proposed ?? (typeof field.value === 'string' ? field.value : '')
  const [draft, setDraft] = useState(baseline)
  useEffect(() => { setDraft(baseline) }, [field.value, proposed]) // eslint-disable-line react-hooks/exhaustive-deps

  const hints = hintsFor(field.key)

  return (
    <div className={`rounded-lg border p-3 ${proposed ? 'border-blue-300 bg-blue-50/40' : 'border-zinc-200'}`}>
      <FieldHeader
        field={field}
        right={proposed ? <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">proposed by Lex</span> : undefined}
      />
      {hints.length > 0 && !proposed && (
        <p className="text-[11px] text-zinc-400 mb-2 leading-snug">{hints.join(' · ')}</p>
      )}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        placeholder="Write as much or as little as you like…"
        className="w-full text-sm p-2 rounded-lg border border-zinc-200 bg-white resize-none focus:outline-none focus:border-blue-400"
      />
      <div className="flex gap-2 mt-1.5">
        <button
          onClick={() => onSubmitBox(field.key, draft.trim())}
          disabled={busy || !draft.trim()}
          className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
        >
          {proposed ? 'Save & accept' : 'Save'}
        </button>
        {field.status !== 'ACCEPTED' && field.status !== 'SKIPPED' && (
          <button onClick={() => onSkip(field.key)} disabled={busy}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">
            Skip
          </button>
        )}
      </div>
    </div>
  )
}

// A generated output proposed by Lex, confirmed in CHAT (title / keywords / challenge /
// pivotalObstacle / summaryDiagnosis). The panel is a read-out + Change.
function OutputField({ field, busy, onReopen }: { field: CanonicalField; busy: boolean; onReopen: (key: string) => void }) {
  const accepted = field.status === 'ACCEPTED'
  const display = Array.isArray(field.value)
    ? (field.value as string[]).join(', ')
    : (field.value as string | null) ?? ''
  const canReopen = accepted && field.key !== 'summaryDiagnosis' // summary is regenerated, not hand-edited here
  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <FieldHeader
        field={field}
        right={canReopen ? (
          <button onClick={() => onReopen(field.key)} disabled={busy}
            className="text-[11px] text-zinc-400 hover:text-zinc-700 disabled:opacity-40">Change</button>
        ) : undefined}
      />
      <p className="text-xs mt-1 ml-6 text-zinc-500 whitespace-pre-wrap">
        {accepted ? display
          : field.status === 'AWAITING_CONFIRMATION' ? 'Awaiting your approval in the chat →'
          : field.status === 'SKIPPED' ? 'Skipped'
          : 'Lex will propose this once there’s enough to go on.'}
      </p>
    </div>
  )
}

// A structured field with labelled slots (whoAffectedImpactCost / legalLandscape).
// The box IS the accept surface: pre-filled from the seed/proposal, Save accepts the object.
function StructuredField({
  field, busy, onAccept, onSkip,
}: {
  field: CanonicalField
  busy: boolean
  onAccept: (key: string, value: Record<string, string>) => void
  onSkip: (key: string) => void
}) {
  const slots = fieldDef(field.key)?.slots ?? []
  const source = (field.status === 'AWAITING_CONFIRMATION' ? field.proposal?.value : field.value) as
    | Record<string, unknown> | null | undefined
  const baseline: Record<string, string> = Object.fromEntries(
    slots.map((k) => [k, typeof source?.[k] === 'string' ? (source![k] as string) : '']),
  )
  const [draft, setDraft] = useState(baseline)
  useEffect(() => { setDraft(baseline) }, [field.status, JSON.stringify(source)]) // eslint-disable-line react-hooks/exhaustive-deps

  const terminal = isTerminal(field)
  const seeded = field.status === 'AWAITING_CONFIRMATION'

  return (
    <div className={`rounded-lg border p-3 ${seeded ? 'border-blue-300 bg-blue-50/40' : 'border-zinc-200'}`}>
      <FieldHeader
        field={field}
        right={seeded ? <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">carried over — refine</span> : undefined}
      />
      {terminal ? (
        <div className="ml-6 space-y-1">
          {slots.map((k) => (
            <p key={k} className="text-xs text-zinc-600">
              <span className="text-zinc-400">{SLOT_LABELS[k] ?? k}: </span>
              {typeof source?.[k] === 'string' && source![k] ? (source![k] as string) : <span className="text-zinc-300">—</span>}
            </p>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {slots.map((k) => (
              <div key={k}>
                <label className="block text-[11px] font-medium text-zinc-500 mb-0.5">{SLOT_LABELS[k] ?? k}</label>
                <textarea
                  value={draft[k] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                  rows={2}
                  className="w-full text-sm p-2 rounded-lg border border-zinc-200 bg-white resize-none focus:outline-none focus:border-blue-400"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => onAccept(field.key, draft)} disabled={busy}
              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40">Save</button>
            <button onClick={() => onSkip(field.key)} disabled={busy}
              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">Skip</button>
          </div>
        </>
      )}
    </div>
  )
}

// One editable cause row.
function CauseRow({ cause, busy, api }: { cause: CanonicalCause; busy: boolean; api: CausesApi }) {
  const [editing, setEditing] = useState(false)
  const [c, setC] = useState(cause.cause)
  const [why, setWhy] = useState(cause.whyPersisted ?? '')
  const [ev, setEv] = useState(cause.evidence ?? '')
  useEffect(() => { setC(cause.cause); setWhy(cause.whyPersisted ?? ''); setEv(cause.evidence ?? '') }, [cause])

  if (editing) {
    return (
      <div className="rounded-lg border border-blue-200 bg-white p-2 space-y-1.5">
        <input value={c} onChange={(e) => setC(e.target.value)} placeholder="Cause"
          className="w-full text-sm p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
        <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} placeholder="Why has it persisted?"
          className="w-full text-xs p-1.5 rounded border border-zinc-200 resize-none focus:outline-none focus:border-blue-400" />
        <input value={ev} onChange={(e) => setEv(e.target.value)} placeholder="Evidence (optional)"
          className="w-full text-xs p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
        <div className="flex gap-2">
          <button disabled={busy || !c.trim()} onClick={() => { api.update(cause.id, { cause: c.trim(), whyPersisted: why.trim(), evidence: ev.trim() }); setEditing(false) }}
            className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Save</button>
          <button disabled={busy} onClick={() => setEditing(false)}
            className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300 text-zinc-500">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-2">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="text-sm text-zinc-800">{cause.cause}</p>
          {cause.whyPersisted && <p className="text-[11px] text-zinc-500 mt-0.5">Persists because: {cause.whyPersisted}</p>}
          {cause.evidence && <p className="text-[11px] text-zinc-400 mt-0.5 italic">{cause.evidence}</p>}
        </div>
        {cause.source === 'LEX_CORPUS' && (
          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 rounded px-1 py-0.5">from past debates</span>
        )}
      </div>
      <div className="flex gap-2 mt-1.5">
        <button disabled={busy} onClick={() => setEditing(true)} className="text-[11px] text-zinc-400 hover:text-zinc-700">Edit</button>
        <button disabled={busy} onClick={() => api.remove(cause.id)} className="text-[11px] text-zinc-400 hover:text-red-600">Remove</button>
      </div>
    </div>
  )
}

// The causes loop (§7.2). Interactive while the field is active; read-only once accepted.
function CausesField({ field, causes, busy, api }: { field: CanonicalField; causes: CanonicalCause[]; busy: boolean; api: CausesApi }) {
  const [c, setC] = useState('')
  const [why, setWhy] = useState('')
  const terminal = isTerminal(field)

  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <FieldHeader field={field} />
      {causes.length === 0 && (
        <p className="text-[11px] text-zinc-400 mb-2">
          {terminal ? 'No causes recorded.' : 'I’ll seed a few candidates from past debates; add your own too.'}
        </p>
      )}
      <div className="space-y-1.5">
        {causes.map((cause) =>
          terminal ? (
            <div key={cause.id} className="rounded-lg border border-zinc-200 bg-white p-2">
              <p className="text-sm text-zinc-800">{cause.cause}{cause.isRootCause && <span className="ml-1.5 text-[9px] font-semibold uppercase text-green-700">root</span>}</p>
              {cause.whyPersisted && <p className="text-[11px] text-zinc-500 mt-0.5">Persists because: {cause.whyPersisted}</p>}
            </div>
          ) : (
            <CauseRow key={cause.id} cause={cause} busy={busy} api={api} />
          ),
        )}
      </div>

      {!terminal && (
        <div className="mt-2 rounded-lg border border-dashed border-zinc-300 p-2 space-y-1.5">
          <input value={c} onChange={(e) => setC(e.target.value)} placeholder="Add a cause…"
            className="w-full text-sm p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
          <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} placeholder="Why has it persisted? (optional)"
            className="w-full text-xs p-1.5 rounded border border-zinc-200 resize-none focus:outline-none focus:border-blue-400" />
          <button disabled={busy || !c.trim()} onClick={() => { api.add({ cause: c.trim(), whyPersisted: why.trim() || undefined }); setC(''); setWhy('') }}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40">Add cause</button>
        </div>
      )}

      {!terminal && (
        <div className="flex gap-2 mt-2">
          <button disabled={busy || causes.length === 0} onClick={api.confirm}
            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40">These are my causes</button>
          <button disabled={busy} onClick={api.skip}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">Skip</button>
        </div>
      )}
    </div>
  )
}

// The root-cause selector (§7.1 field 4) — pick one cause as the main driver.
function RootCauseField({ field, causes, busy, api }: { field: CanonicalField; causes: CanonicalCause[]; busy: boolean; api: CausesApi }) {
  const terminal = isTerminal(field)
  const chosen = causes.find((c) => c.isRootCause) ?? null
  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <FieldHeader field={field} />
      {terminal ? (
        <p className="text-xs ml-6 text-zinc-600">{chosen ? chosen.cause : (field.value as string) ?? 'Skipped'}</p>
      ) : causes.length === 0 ? (
        <div>
          <p className="text-[11px] text-zinc-400 mb-1.5">Add causes first, then choose the main driver.</p>
          <button disabled={busy} onClick={api.skipRoot}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">Skip</button>
        </div>
      ) : (
        <>
          <div className="space-y-1">
            {causes.map((cause) => (
              <button key={cause.id} disabled={busy} onClick={() => api.setRoot(cause.id)}
                className="w-full text-left text-sm px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:border-green-400 hover:bg-green-50/40 disabled:opacity-40">
                {cause.cause}
              </button>
            ))}
          </div>
          <button disabled={busy} onClick={api.skipRoot}
            className="mt-2 text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">Skip</button>
        </>
      )}
    </div>
  )
}

// Panel 2 — Fields. Pure renderer of pages[] (+ diagnosisCauses). "X of Y" derived here.
export default function FieldsPanel({
  pages, causes, busy, onSubmitBox, onAcceptStructured, onSkip, onReopen, causesApi,
}: {
  pages: CanonicalState['pages']
  causes: CanonicalCause[]
  busy: boolean
  onSubmitBox: (key: string, value: string) => void
  onAcceptStructured: (key: string, value: Record<string, string>) => void
  onSkip: (key: string) => void
  onReopen: (key: string) => void
  causesApi: CausesApi
}) {
  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
      {pages.map((page) => {
        const total = page.fields.length
        const done = page.fields.filter((f) => f.status === 'ACCEPTED' || f.status === 'SKIPPED').length
        const isLocked = page.status === 'locked'
        return (
          <div key={page.key}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${
                page.status === 'complete' ? 'bg-green-500' : page.status === 'active' ? 'bg-blue-500' : 'bg-zinc-200'
              }`} />
              <span className={`text-xs font-semibold uppercase tracking-wide flex-1 ${isLocked ? 'text-zinc-300' : 'text-zinc-700'}`}>
                {page.label}
              </span>
              {!isLocked && total > 0 && <span className="text-[11px] text-zinc-400">{done} of {total}</span>}
              {isLocked && <span className="text-[11px] text-zinc-300">soon</span>}
            </div>

            {!isLocked && (
              <div className="space-y-2">
                {page.fields.map((f) => {
                  if (f.type === 'narrative') return <BoxField key={f.key} field={f} busy={busy} onSubmitBox={onSubmitBox} onSkip={onSkip} />
                  if (f.type === 'structured') return <StructuredField key={f.key} field={f} busy={busy} onAccept={onAcceptStructured} onSkip={onSkip} />
                  if (f.type === 'loop') return <CausesField key={f.key} field={f} causes={causes} busy={busy} api={causesApi} />
                  if (f.type === 'reference') return <RootCauseField key={f.key} field={f} causes={causes} busy={busy} api={causesApi} />
                  return <OutputField key={f.key} field={f} busy={busy} onReopen={onReopen} />
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
