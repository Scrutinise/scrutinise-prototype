'use client'

// Decision 249 — one half of the left-hand panel: "Maximise ⤢" fills the panel with it; then "Minimise ⤡" restores the equal split.
// ⚠ The state is a WORD and a different GLYPH, plus aria-pressed — never a colour alone (docs/CLAUDE.md §21).

import { MAXIMISE_GLYPH, MAXIMISE_LABEL, MINIMISE_GLYPH, MINIMISE_LABEL } from '@/lib/lex/lhp-layout'

export default function MaximiseToggle({ maximised, half, onToggle }: { maximised: boolean; half: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={maximised}
      aria-label={maximised ? `${MINIMISE_LABEL} ${half} — back to an equal split` : `${MAXIMISE_LABEL} ${half} to fill the panel`}
      data-lhp-toggle={half}
      className="text-[11px] font-medium text-zinc-600 hover:text-zinc-900 whitespace-nowrap px-1.5 py-0.5 rounded border border-zinc-300 bg-white"
    >
      {maximised ? `${MINIMISE_LABEL} ${MINIMISE_GLYPH}` : `${MAXIMISE_LABEL} ${MAXIMISE_GLYPH}`}
    </button>
  )
}
