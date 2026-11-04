'use client'

// 26-X addendum 322 — "ADD ACTION": a small focused form (CLAUDE.md §32: a task that ends in a save is a dialog). Title (required, counter) ·
// Statement (optional, 1,000, counter) · Heading (the idea's headings + Unsorted) · the kind is the heading's, shown and not chosen.
// Written by the route's `addAction` op → lib/lex/action-structure.ts addActionAtHeading → field-machine's addAction, the same function the
// import, the gap check and Lex's add_action call. Source USER; it lands first under its heading. Labels: ADD_ACTION_UI (screen-labels.ts).

import { useState } from 'react'
import type { CanonicalActionHeading } from '@/lib/lex/page1-config'
import { colourFor } from '@/lib/lex/action-headings'
import { HEADING_KIND_WORD, isHeadingKind } from '@/lib/lex/action-documents-pure'
import { LIMITS } from '@/lib/lex/input-limits'
import { ADD_ACTION_UI, COMMON_UI } from '@/lib/lex/screen-labels'
import BoundedInput from './BoundedInput'
import FocusDialog from './FocusDialog'

export interface AddActionResult { id: string; number: number | null; title: string; headingId: string | null; headingName: string | null }

export default function AddActionForm({ headings, disabled, onAdd, onClose }: {
  headings: CanonicalActionHeading[]
  disabled: boolean
  /** Sends the form; resolves to the error in words (shown in the form, nothing added) or null once it is added. */
  onAdd: (body: { title: string; practicalStep: string; headingId: string | null }) => Promise<string | null>
  onClose: () => void
}) {
  const [title, setTitle] = useState('')
  const [statement, setStatement] = useState('')
  const [headingId, setHeadingId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const live = headings.filter((h) => !(h as { archivedAt?: unknown }).archivedAt)
  const h = live.find((x) => x.id === headingId)
  const kind = h?.kind && isHeadingKind(h.kind) ? HEADING_KIND_WORD[h.kind] : null
  const save = async () => {
    if (!title.trim()) { setError('Not added: an action needs a title.'); return }
    setBusy(true); setError(null)
    const err = await onAdd({ title: title.trim(), practicalStep: statement.trim(), headingId: headingId || null })
    setBusy(false)
    if (err) setError(err)
  }
  return (
    <FocusDialog title={ADD_ACTION_UI.dialogTitle} onClose={onClose}
      footer={<>
        <button type="button" disabled={disabled || busy || !title.trim()} onClick={() => void save()} data-add-action-save
          className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 text-white disabled:opacity-40">{busy ? 'Adding…' : ADD_ACTION_UI.save}</button>
        <button type="button" onClick={onClose} className="text-sm underline text-zinc-700">{COMMON_UI.cancel}</button>
      </>}>
      <div className="space-y-3" data-add-action-form>
        {error && <p className="text-xs font-semibold text-zinc-900 bg-white border-2 border-zinc-900 rounded px-2 py-1.5" role="alert" data-add-action-error>⚠ {error}</p>}
        <label className="block text-xs font-semibold text-zinc-800">{ADD_ACTION_UI.title} <span className="font-normal text-zinc-600">(required)</span>
          <BoundedInput value={title} onChange={setTitle} max={LIMITS.actionTitle} autoFocus aria-label={ADD_ACTION_UI.title} data-add-action-title
            className="mt-1 w-full text-sm p-1.5 rounded border border-zinc-300 focus:outline-none focus:border-blue-400" />
        </label>
        <label className="block text-xs font-semibold text-zinc-800">{ADD_ACTION_UI.statement} <span className="font-normal text-zinc-600">(optional — the practical step: who does what)</span>
          <BoundedInput value={statement} onChange={setStatement} max={LIMITS.actionStatement} multiline rows={4} aria-label={ADD_ACTION_UI.statement} data-add-action-statement
            className="mt-1 w-full text-sm p-1.5 rounded border border-zinc-300 focus:outline-none focus:border-blue-400" />
        </label>
        <label className="block text-xs font-semibold text-zinc-800">{ADD_ACTION_UI.heading}
          <select value={headingId} onChange={(e) => setHeadingId(e.target.value)} aria-label={ADD_ACTION_UI.heading} data-add-action-heading
            className="mt-1 block text-sm border border-zinc-300 rounded px-1.5 py-1 bg-white">
            <option value="">{ADD_ACTION_UI.unsorted}</option>
            {live.map((x) => <option key={x.id} value={x.id}>{colourFor(x.colourKey).glyph} {x.name}</option>)}
          </select>
        </label>
        <p className="text-xs text-zinc-800" data-add-action-kind><span className="font-semibold">{ADD_ACTION_UI.kind}:</span>{' '}
          {!h ? 'none until it has a heading — the kind comes from the heading.' : kind ? `${kind} — from its heading “${h.name}”.` : `not set on “${h.name}” yet — set it on the heading’s row.`}
        </p>
        <p className="text-[11px] text-zinc-600">It is added as your own action, first under its heading, and opens on the Drafting page. It is linked to no cause until it is classified.</p>
      </div>
    </FocusDialog>
  )
}
