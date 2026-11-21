'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-AB (decision 354) — THE ⓘ INFO LABEL. A button whose accessible name is "About <field>"; a tap, click, Enter or Space opens a short
// panel that STAYS until it is closed: by its Close button, by Esc, by tapping or clicking anywhere outside it, or by the ⓘ again.
// Esc and Close hand the focus back to the ⓘ, so a keyboard user is never left nowhere.
//
// ⚠ The panel is IN THE FLOW below its heading (put the ⓘ in a `flex flex-wrap` heading row), never a floating box: at 360 px a positioned popover runs
//   off the screen, which is the fault 26-AB §3 is fixing on the same form.
// ⚠ Shape and word, never colour alone (§21): the ⓘ is a glyph with a name; the parts are headed in words.
// ⚠ The words are the field guide's (lib/lex/brief-info.ts), never written here.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useId, useRef, useState } from 'react'
import { INFO_PART_WORD, type InfoText } from '@/lib/lex/brief-info'
import { INFO_UI } from '@/lib/lex/screen-labels'

export default function InfoLabel({ about, info }: { about: string; info: InfoText | string }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLSpanElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); button.current?.focus() } }
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown) }
  }, [open])
  const name = INFO_UI.about(about)
  return (
    // `contents`: the ⓘ and its panel lay out as items of the heading row, so the panel (basis-full) takes the row's whole width below it
    <span ref={wrap} data-info={about} className="contents">
      <button ref={button} type="button" aria-label={name} aria-expanded={open} aria-controls={open ? id : undefined} data-info-button
        // a click inside a <label> must not also focus the field the label is for
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o) }}
        className="ml-1 inline-flex h-6 min-w-6 items-center justify-center rounded-full px-0.5 align-middle text-sm font-normal leading-none text-zinc-700 hover:text-zinc-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900">
        {INFO_UI.open}
      </button>
      {open && (
        <span id={id} role="region" aria-label={name} data-info-panel
          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
          className="mt-1 block basis-full w-full max-w-full rounded border-2 border-zinc-900 bg-white p-2 text-xs font-normal text-zinc-900 break-words">
          {typeof info === 'string'
            ? <span className="block" data-info-part="text">{info}</span>
            : (['what', 'lexDoes', 'example'] as const).map((p) => (
              <span key={p} className="block" data-info-part={p}><span className="font-semibold">{INFO_PART_WORD[p]}:</span> {info[p]}</span>
            ))}
          <button type="button" data-info-close onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(false); button.current?.focus() }}
            className="mt-1 underline">{INFO_UI.close}</button>
        </span>
      )}
    </span>
  )
}
