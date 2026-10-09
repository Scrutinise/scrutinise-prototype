'use client'

import { useState } from 'react'
import YourMaterial from './YourMaterial'
import AddResearch from './AddResearch'

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
  // 26-R (DECISION 133) — "+ Add a file or link" is "+ Add research" here, as on every surface: one door for a file, a link, pasted
  // text of any length, a quote or a thought. The documents already filed stay listed beneath it (no add controls of their own).
  const [showFiled, setShowFiled] = useState(false)
  const [count, setCount] = useState(0)
  return (
    <div className="mb-2">
      <AddResearch ideaId={ideaId} onSaved={onChanged} />
      <button type="button" onClick={() => setShowFiled((s) => !s)} aria-expanded={showFiled} className="text-[11px] underline text-zinc-500">
        {showFiled ? 'Hide' : 'Show'} what has been filed{count ? ` (${count})` : ''}
      </button>
      {showFiled && (
        <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-zinc-200 p-2">
          <YourMaterial ideaId={ideaId} onChanged={onChanged} onCount={setCount} hideAdd />
        </div>
      )}
    </div>
  )
}
