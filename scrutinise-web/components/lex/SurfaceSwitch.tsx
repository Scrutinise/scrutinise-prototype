// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-G §2 — THE PERSISTENT ROUTE BETWEEN THE TWO SURFACES.
//
// One component, rendered by BOTH screens, so the two cannot drift into describing each
// other differently. It does two things §2 asks for and they are separate:
//
//   1. IT NAMES WHERE YOU ARE. "The build" / "The proposal", stated, not implied.
//   2. IT OFFERS THE OTHER ONE, WITH WHAT IS OVER THERE. Counted — "23 fields, 10 decisions
//      waiting" — because a number is the difference between a label and an invitation.
//
// ⚠ NOT A CLIENT COMPONENT AND NOT STATEFUL. It is a plain anchor: the two surfaces are
// separate routes with separate server state, and a soft transition between them would
// leave whichever one the user came from holding stale state that looks current. A full
// navigation is the honest one here.
// ─────────────────────────────────────────────────────────────────────────────

import type { SurfaceContext } from '@/lib/lex/surfaces'

export default function SurfaceSwitch({ context }: { context: SurfaceContext | null }) {
  // ⚠ NULL IS A REAL ANSWER. An idea with nothing on the other surface gets no link —
  // see `surfaceContext`. Rendering a disabled or empty one would promise a screen that
  // is not there.
  if (!context) return null

  return (
    <nav
      aria-label="Move between the build and the proposal"
      className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-zinc-200 bg-zinc-50/70 px-3 py-2 mb-4"
    >
      <p className="text-xs text-zinc-500">
        You’re looking at{' '}
        <span className="font-semibold text-zinc-800">{context.hereTitle.toLowerCase()}</span>.
      </p>
      <a
        href={context.there.href}
        className="group inline-flex items-baseline gap-2 text-sm font-medium text-blue-700 hover:text-blue-900"
      >
        <span className="underline underline-offset-2">{context.there.title}</span>
        <span className="text-xs font-normal text-zinc-500">{context.there.detail}</span>
        <span aria-hidden className="text-zinc-400 group-hover:text-blue-700">→</span>
      </a>
    </nav>
  )
}
