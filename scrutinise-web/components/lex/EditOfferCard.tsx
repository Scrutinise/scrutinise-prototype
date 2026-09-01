'use client'

import { useState } from 'react'
import type { EditOffer } from '@/lib/lex/field-edit'

/**
 * ══ 25-Q §1b — LEX'S REWRITE, WITH A BUTTON THAT PUTS IT IN ═══════════════════════════
 *
 * Charlie: *"I tried to get Lex to edit this and the result was helpful but no interaction with
 * the Middle Panel."* The rewrite was good and he copied it across by hand. This is the bridge.
 *
 * ⚠⚠ IT SHOWS WHAT IS THERE NOW, NOT ONLY WHAT WOULD REPLACE IT. A card offering to overwrite a
 * sentence without showing the sentence asks the user to decide from memory. Both are here, the
 * current one first, because that is the order the question is asked in: *is this better than
 * what I have?*
 *
 * ⚠ NOTHING HAPPENS UNTIL THE BUTTON IS PRESSED. §1b: Lex proposes, the user accepts, only then
 * does the panel change. The offer arrives with the chat turn and is written by a separate
 * endpoint that only a click reaches.
 *
 * ⚠ AND IT IS EDITABLE FIRST — "You can edit it after" is in the question, and a card that
 * cannot be edited before it lands makes that a smaller promise than it sounds. Same affordance
 * as `AcceptCard`, deliberately: this is the same act in a different place.
 */
export default function EditOfferCard({
  offer,
  busy,
  onAccept,
  onDismiss,
}: {
  offer: EditOffer
  busy: boolean
  onAccept: (text: string) => void
  onDismiss: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(offer.text)

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 my-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-700 mb-1.5">
        {offer.question}
      </div>

      {offer.currentText && (
        <div className="mb-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            What it says now
          </div>
          <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-wrap">
            {offer.currentText}
          </p>
        </div>
      )}

      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        What I would put in
      </div>
      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          className="w-full mt-1 text-sm rounded-lg border border-zinc-300 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <p className="text-sm text-zinc-900 leading-relaxed whitespace-pre-wrap mt-0.5">{draft}</p>
      )}

      <div className="flex items-center gap-2 mt-2.5">
        <button
          type="button"
          disabled={busy || !draft.trim()}
          onClick={() => onAccept(draft.trim())}
          className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
        >
          Put it in
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setEditing((v) => !v)}
          className="text-xs text-zinc-600 hover:text-zinc-900 disabled:opacity-40"
        >
          {editing ? 'Done editing' : 'Edit first'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDismiss}
          className="text-xs text-zinc-500 hover:text-zinc-800 disabled:opacity-40 ml-auto"
        >
          No thanks
        </button>
      </div>
    </div>
  )
}
