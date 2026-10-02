'use client'

import { useState } from 'react'
import YourMaterial from './YourMaterial'

/**
 * ══ DECISION 109 — THE "+" IS IN THE CHAT ON EVERY STAGE ═══════════════════════════════════
 *
 * Until now the "+" lived only in The Idea's question cards, so a user on the Strategy stage who
 * wanted to give Lex a PDF had to go back a stage to do it — and Lex, which has no way to say
 * "use the + beside the box" when there is none, sent them there. 26-M item 1 forbade that; this
 * is the control that makes the prohibition costless.
 *
 * ⚠ THE SAME `YourMaterial` AS THE CARDS, NOT A COPY. One upload path, one set of refusal
 * messages, one list. A second implementation would drift on exactly the things a refusal has to
 * get right (the reason, and what works instead).
 *
 * ⚠ LABEL AND COUNT, NOT A BARE GLYPH (docs/CLAUDE.md §21): open versus closed is carried by the
 * word and by the glyph's shape (+ / −), never by hue alone.
 */
export default function ChatAttach({ ideaId, onChanged }: { ideaId: string; onChanged?: () => void }) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(0)

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Add a document or a link for me to read — a report, a letter, an article, a web page"
        className={`text-xs font-medium px-3 py-1.5 rounded-full border-2 inline-flex items-center gap-1.5 ${
          open ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
        }`}
      >
        <span aria-hidden className="text-sm leading-none">{open ? '−' : '+'}</span>
        <span>{open ? 'Close' : 'Add a file or link'}{count ? ` (${count})` : ''}</span>
      </button>
      {/* Mounted only while open, but the count is kept in this component's state so it survives. */}
      {open && (
        <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 p-2">
          <YourMaterial ideaId={ideaId} onChanged={onChanged} onCount={setCount} />
        </div>
      )}
    </div>
  )
}
