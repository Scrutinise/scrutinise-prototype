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
      // ══ 25-N §1b — THE HANDLE IS VISIBLE, because a control nobody can see is a control
      // nobody uses. §1b: "add a visible resize handle on each divider so it is obvious they
      // can be dragged." A 6px grey strip between two white columns reads as a border.
      //
      // ⚠ THE GRIP IS A SHAPE, NOT A COLOUR (docs/CLAUDE.md §21 — Charlie is colour blind).
      // Three stacked dots at the vertical centre are the same affordance every resizable
      // pane in every desktop application uses, and they survive greyscale intact.
      className="group hidden lg:flex w-2 shrink-0 cursor-col-resize items-center justify-center bg-zinc-100 hover:bg-blue-100 focus:bg-blue-200 focus:outline-none touch-none"
    >
      <span
        aria-hidden
        className="flex flex-col gap-[3px] rounded-full bg-zinc-300 px-[1px] py-1.5 group-hover:bg-blue-500 group-focus:bg-blue-600"
      >
        <span className="block w-[3px] h-[3px] rounded-full bg-white" />
        <span className="block w-[3px] h-[3px] rounded-full bg-white" />
        <span className="block w-[3px] h-[3px] rounded-full bg-white" />
      </span>
    </div>
  )
}

/**
 * ══ 25-N §1b — THE DIVIDER INSIDE THE LEFT PANEL ════════════════════════════════
 *
 * §1b asks for "a vertical divider in the left panel between the worklist and the chat".
 * The worklist was pinned at `max-h-[42%]` — a number chosen once, for everybody, which is
 * wrong for a user with two tasks and wrong again for one with nine.
 *
 * ⚠ IT IS THE SAME CONTROL TURNED THROUGH NINETY DEGREES, and it is the same code: pointer
 * capture, keyboard operation, a visible grip. A second implementation of "drag to resize"
 * would be a second thing to fix the next time one of them breaks.
 *
 * ⚠ IT IS NOT DESKTOP-ONLY, unlike the column dividers. The three COLUMNS are three tabs on
 * a phone and never share a screen, so a divider between them would do nothing. The worklist
 * and the chat DO share a screen on a phone — that is the whole of the left tab — so the
 * divider is real there too.
 */
export function RowDivider({
  label, onDrag,
}: {
  /** What the two halves are, for the accessible name. */
  label: string
  /** Delta as a fraction of the column's height: positive gives the TOP half more. */
  onDrag: (delta: number) => void
}) {
  const startY = useRef<number | null>(null)
  const colHeight = useRef(1)

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    startY.current = e.clientY
    colHeight.current = e.currentTarget.parentElement?.getBoundingClientRect().height || 1
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (startY.current === null) return
    const dy = e.clientY - startY.current
    if (!dy) return
    startY.current = e.clientY
    onDrag(dy / colHeight.current)
  }, [onDrag])

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    startY.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }, [])

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp') { e.preventDefault(); onDrag(-STEP) }
        if (e.key === 'ArrowDown') { e.preventDefault(); onDrag(STEP) }
      }}
      title="Drag to resize — or use the arrow keys"
      className="group flex h-2 shrink-0 cursor-row-resize items-center justify-center bg-zinc-100 hover:bg-blue-100 focus:bg-blue-200 focus:outline-none touch-none"
    >
      <span
        aria-hidden
        className="flex gap-[3px] rounded-full bg-zinc-300 px-1.5 py-[1px] group-hover:bg-blue-500 group-focus:bg-blue-600"
      >
        <span className="block w-[3px] h-[3px] rounded-full bg-white" />
        <span className="block w-[3px] h-[3px] rounded-full bg-white" />
        <span className="block w-[3px] h-[3px] rounded-full bg-white" />
      </span>
    </div>
  )
}
