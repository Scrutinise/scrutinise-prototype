// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-K §1 — THE PERSISTENT STAGE INDICATOR.
//
// One component, rendered by EVERY screen of the Lex surface, so the three stages cannot
// drift into describing each other differently. It does three things §1 asks for and they
// are separate:
//
//   1. IT SAYS WHICH STAGE YOU ARE IN — by number and by name, in words, not by highlight.
//   2. IT SAYS WHAT THAT STAGE IS FOR, in one line, always visible.
//   3. IT SAYS HOW TO MOVE — the other two are links, both directions, nothing locked.
//
// ⚠ IT REPLACES `SurfaceSwitch`, WHICH NAMED THE SCREENS "the build" and "the proposal".
// Those are implementation words. See `lib/lex/stages.ts` for why that is the whole sprint.
//
// ⚠⚠ THE CURRENT STAGE IS NOT MARKED BY COLOUR. Charlie is colour blind (docs/CLAUDE.md
// §21, "Colour is never the only cue"), and a bar whose only "where am I" signal is a hue
// is a bar that answers the question for everyone except the person who asked it. Four
// cues carry it, and any one of them survives greyscale:
//
//   · the WORDS "You are here", printed in the current tile
//   · a FILLED numbered disc (●1) against hollow ones (○2, ○3) — different characters
//   · a filled dark BACKGROUND against white — a lightness difference, which every form
//     of colour blindness preserves
//   · `border-2` WEIGHT, the same 2px the approval frame uses
//
// ⚠ NOT A CLIENT COMPONENT AND NOT STATEFUL. The three stages are separate routes with
// separate server state; a soft transition would leave whichever one the user came from
// holding stale state that looks current. A full navigation is the honest one here.
// ─────────────────────────────────────────────────────────────────────────────

import type { StageContext } from '@/lib/lex/stage-context'

export default function StageBar({ context }: { context: StageContext | null }) {
  // ⚠ NULL ONLY WHEN THE PAGE COULD NOT COMPUTE IT — never as "there is nothing to show".
  // A stage with nothing in it renders and says so; that is the point.
  if (!context) return null

  const here = context.stages.find((s) => s.key === context.here) ?? context.stages[0]

  return (
    <nav aria-label="Where you are" className="w-full">
      <ol className="flex flex-wrap items-stretch gap-1.5">
        {context.stages.map((s) => {
          const current = s.key === context.here
          const body = (
            <>
              <span className="flex items-baseline gap-1.5">
                {/* A FILLED disc when you are here, a hollow one when you are not. Two
                    different characters, not one character recoloured. */}
                <span aria-hidden className="text-[11px] leading-none">{current ? '●' : '○'}</span>
                <span className={`text-[13px] ${current ? 'font-bold' : 'font-medium'}`}>
                  {s.n} · {s.name}
                </span>
              </span>
              <span className={`block text-[11px] mt-0.5 ${current ? 'text-white/75' : 'text-zinc-500'}`}>
                {current
                  ? 'You are here'
                  : s.available
                    ? s.detail ?? 'nothing here yet'
                    : s.unavailableReason}
              </span>
            </>
          )

          const shell = current
            ? 'border-2 border-zinc-900 bg-zinc-900 text-white'
            : s.available
              ? 'border-2 border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50'
              : 'border-2 border-dashed border-zinc-200 bg-white text-zinc-400'

          return (
            <li key={s.key} className="flex-1 min-w-[9.5rem]">
              {s.available && !current ? (
                <a
                  href={s.href}
                  className={`block h-full rounded-xl px-2.5 py-1.5 transition-colors ${shell}`}
                >
                  {body}
                </a>
              ) : (
                <div
                  // `aria-current="step"` is the screen-reader half. The words in the tile
                  // are the sighted half — §21: aria is never the second cue.
                  {...(current ? { 'aria-current': 'step' as const } : {})}
                  className={`h-full rounded-xl px-2.5 py-1.5 ${shell}`}
                >
                  {body}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {/* §1 — WHAT THIS STAGE IS FOR, IN ONE LINE, ALWAYS VISIBLE. Not a tooltip, not a
          first-visit modal: the sentence a user needs is the one telling them what they are
          supposed to be doing right now, and they need it every time they look up. */}
      <p className="mt-1.5 text-xs text-zinc-600">
        <span className="font-semibold text-zinc-800">Stage {here.n} of 3, {here.name}.</span>{' '}
        {here.purpose}
      </p>
    </nav>
  )
}
