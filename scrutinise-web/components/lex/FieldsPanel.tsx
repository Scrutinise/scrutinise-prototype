'use client'

import { useEffect, useState } from 'react'
import { ORIENTATION_FIELDS, type CanonicalState, type CanonicalField } from '@/lib/lex/page1-config'

function hintsFor(key: string): string[] {
  return ORIENTATION_FIELDS.find((f) => f.key === key)?.hints ?? []
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

// A narrative box the user writes directly (Box 1/2/3).
function BoxField({
  field, busy, onSubmitBox, onSkip,
}: {
  field: CanonicalField
  busy: boolean
  onSubmitBox: (key: string, value: string) => void
  onSkip: (key: string) => void
}) {
  // The BOX is the accept surface (§5/§13): when AWAITING_CONFIRMATION the box is
  // pre-filled with Lex's proposed text (marked "proposed") and Save confirms it.
  const proposed =
    field.status === 'AWAITING_CONFIRMATION' && typeof field.proposal?.value === 'string'
      ? (field.proposal!.value as string)
      : null
  const baseline = proposed ?? (typeof field.value === 'string' ? field.value : '')
  const [draft, setDraft] = useState(baseline)
  // Re-sync when the server hands us a new value or proposal (only happens on a
  // transition — never mid-keystroke — so a user's in-progress text isn't clobbered).
  useEffect(() => { setDraft(baseline) }, [field.value, proposed]) // eslint-disable-line react-hooks/exhaustive-deps

  const hints = hintsFor(field.key)

  return (
    <div className={`rounded-lg border p-3 ${proposed ? 'border-blue-300 bg-blue-50/40' : 'border-zinc-200'}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <StatusDot status={field.status} />
        <span className="text-sm font-medium text-zinc-800 flex-1">{field.label}</span>
        {proposed && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">proposed by Lex</span>
        )}
      </div>
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
          <button
            onClick={() => onSkip(field.key)}
            disabled={busy}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  )
}

// A generated output (title / keywords) — proposed by Lex, confirmed in chat.
function OutputField({
  field, busy, onReopen,
}: {
  field: CanonicalField
  busy: boolean
  onReopen: (key: string) => void
}) {
  const accepted = field.status === 'ACCEPTED'
  const display = Array.isArray(field.value)
    ? (field.value as string[]).join(', ')
    : (field.value as string | null) ?? ''
  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <div className="flex items-center gap-2">
        <StatusDot status={field.status} />
        <span className="text-sm font-medium text-zinc-800 flex-1">{field.label}</span>
        {accepted && (
          <button
            onClick={() => onReopen(field.key)}
            disabled={busy}
            className="text-[11px] text-zinc-400 hover:text-zinc-700 disabled:opacity-40"
          >
            Change
          </button>
        )}
      </div>
      <p className="text-xs mt-1 ml-6 text-zinc-500">
        {accepted ? display
          : field.status === 'AWAITING_CONFIRMATION' ? 'Awaiting your approval in the chat →'
          : field.status === 'SKIPPED' ? 'Skipped'
          : 'Lex will propose this once there’s enough to go on.'}
      </p>
    </div>
  )
}

// Panel 2 — Fields. Pure renderer of pages[]. "X of Y" derived here, never stored.
export default function FieldsPanel({
  pages, busy, onSubmitBox, onSkip, onReopen,
}: {
  pages: CanonicalState['pages']
  busy: boolean
  onSubmitBox: (key: string, value: string) => void
  onSkip: (key: string) => void
  onReopen: (key: string) => void
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
              <span
                className={`shrink-0 w-2.5 h-2.5 rounded-full ${
                  page.status === 'complete' ? 'bg-green-500' : page.status === 'active' ? 'bg-blue-500' : 'bg-zinc-200'
                }`}
              />
              <span className={`text-xs font-semibold uppercase tracking-wide flex-1 ${isLocked ? 'text-zinc-300' : 'text-zinc-700'}`}>
                {page.label}
              </span>
              {!isLocked && total > 0 && (
                <span className="text-[11px] text-zinc-400">{done} of {total}</span>
              )}
              {isLocked && <span className="text-[11px] text-zinc-300">soon</span>}
            </div>

            {!isLocked && (
              <div className="space-y-2">
                {page.fields.map((f) =>
                  f.type === 'narrative' ? (
                    <BoxField key={f.key} field={f} busy={busy} onSubmitBox={onSubmitBox} onSkip={onSkip} />
                  ) : (
                    <OutputField key={f.key} field={f} busy={busy} onReopen={onReopen} />
                  ),
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
