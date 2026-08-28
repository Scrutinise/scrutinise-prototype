'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-L §4 — the draggable divider between two panels.
//
// ⚠ POINTER EVENTS, WITH CAPTURE, AND NOT MOUSE EVENTS. `setPointerCapture` keeps the drag
// attached to this element when the pointer leaves it — which it does immediately, because
// the thing being dragged is four pixels wide. Without capture the divider stops following
// the pointer the moment it moves faster than the re-render, and the user concludes it is
// broken. It also makes the same code work on a touchscreen.
//
// ⚠ IT IS KEYBOARD-OPERABLE, and that is not a box being ticked. A drag handle is the one
// control on this screen with no equivalent anywhere else, so a user who cannot drag has no
// route to the layout at all. Left/Right move it in steps; the role and value are announced.
//
// ⚠ AND IT IS DESKTOP ONLY. On a phone the three panels are three TABS (§6) — there is no
// divider between them because they are never on screen together, and rendering one would
// be a control that does nothing.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useRef } from 'react'
import type { PanelKey } from '@/lib/lex/panel-layout'
import { PANEL_ROLES } from '@/lib/lex/panel-layout'

/** One keyboard press, as a fraction of the row. Two per cent is a visible but small step. */
const STEP = 0.02

export default function PanelDivider({
  a, b, onDrag,
}: {
  a: PanelKey
  b: PanelKey
  /** Delta as a fraction of the row: positive widens `a`. */
  onDrag: (a: PanelKey, b: PanelKey, delta: number) => void
}) {
  const startX = useRef<number | null>(null)
  const rowWidth = useRef(1)

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    startX.current = e.clientX
    // ⚠ MEASURED FROM THE PARENT ROW, not from the window. The columns live inside a
    // max-width container, so a delta computed against the viewport would move the divider
    // at a different speed from the pointer on a wide screen.
    rowWidth.current = e.currentTarget.parentElement?.getBoundingClientRect().width || 1
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (startX.current === null) return
    const dx = e.clientX - startX.current
    if (!dx) return
    startX.current = e.clientX
    onDrag(a, b, dx / rowWidth.current)
  }, [a, b, onDrag])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    startX.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Resize ${PANEL_ROLES[a].name} and ${PANEL_ROLES[b].name}`}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); onDrag(a, b, -STEP) }
        if (e.key === 'ArrowRight') { e.preventDefault(); onDrag(a, b, STEP) }
      }}
      title="Drag to resize — or use the arrow keys"
      className="hidden lg:block w-1.5 shrink-0 cursor-col-resize bg-zinc-200 hover:bg-blue-400 focus:bg-blue-500 focus:outline-none touch-none"
    />
  )
}
