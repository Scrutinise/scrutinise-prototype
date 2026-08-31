'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 25-O ADDENDUM §A2 — THE SUPPORTING SECTIONS OF DRAFT STRATEGY, CLOSED BY DEFAULT.
//
// §A2: *"The kernel is what the user is there to read; the supporting sections are reference and
// should be opened deliberately."*
//
// ⚠⚠ CLOSED BY DEFAULT IS THE WHOLE POINT, AND IT IS THE OPPOSITE OF THE KERNEL'S RULE. A kernel
// section you are working in opens expanded (25-N §1c); these open shut. The difference is not
// cosmetic — the middle column is a REPORT, and everything under the kernel is apparatus about
// the report rather than the report itself.
//
// ⚠ IT IS THE SAME CONTROL AS THE KERNEL HEADINGS, DELIBERATELY. §A2 asks for "the same pattern
// as the kernel headings that already work", so this copies their vocabulary exactly: a word
// beside the glyph (`show +` / `hide −`), never a bare chevron; `aria-expanded`; the whole header
// is the button. Two different characters, never one recoloured — Charlie is colour blind
// (docs/CLAUDE.md §21).
//
// ⚠ A COUNT WHERE THERE IS ONE. A section you are being asked to open deliberately is a section
// you need a reason to open, and "3" is the cheapest possible reason. Absent where the caller has
// no meaningful number rather than shown as a 0, which would read as "nothing here" on a section
// that has plenty.
//
// ⚠ AND IT RENDERS NOTHING WHEN THE CALLER HAS NOTHING. The `empty` escape hatch exists because
// a collapsed heading over an empty section is worse than no heading: it is furniture that
// promises content, and the user has to open it to find that out.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, type ReactNode } from 'react'

export default function CollapsedSection({
  title, hint, count, defaultOpen = false, empty = false, children,
}: {
  title: string
  /** One line under the title, readable while it is still shut. */
  hint?: string
  /** How many things are inside. Omitted where there is no meaningful number. */
  count?: number
  /** ⚠ Almost never true. §A2's rule is closed; this exists for a caller that must override. */
  defaultOpen?: boolean
  /** TRUE when there is nothing inside — renders nothing at all rather than a promise. */
  empty?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (empty) return null

  return (
    <section className="rounded-2xl border border-zinc-200 mt-3 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-baseline gap-2 px-4 py-2.5 text-left bg-zinc-50/70 hover:bg-zinc-100"
      >
        <span className="text-sm font-semibold text-zinc-900">{title}</span>
        {typeof count === 'number' && (
          <span className="text-xs font-semibold text-zinc-600">{count}</span>
        )}
        <span className="flex-1" />
        {/* Two different characters plus a word — never one glyph recoloured (§21). */}
        <span className="text-[11px] text-zinc-500 whitespace-nowrap">{open ? 'hide −' : 'show +'}</span>
      </button>
      {/* ⚠ THE HINT STAYS VISIBLE WHILE IT IS SHUT. A closed section whose only clue is its title
          is a section the user has to open to find out whether they wanted it. */}
      {hint && !open && (
        <p className="px-4 pb-2.5 -mt-0.5 text-[11px] text-zinc-500 bg-zinc-50/70">{hint}</p>
      )}
      {open && <div className="border-t border-zinc-100">{children}</div>}
    </section>
  )
}
