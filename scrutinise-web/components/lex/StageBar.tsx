// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-K §1 → LEX 26-X §2–§3 (decisions 316, 317) — THE PERSISTENT STAGE INDICATOR.
//
// One component, rendered by every screen of the Lex surface. Two rows:
//
//   1. THE LIFECYCLE — the seven stages (Creation · Development · Private Scrutiny · Public Scrutiny · Promotion · Submission · In Force),
//      each with one line of state from the data, the current one marked.
//   2. THE DEVELOPMENT CHECKLIST (§3a) — on the Development screens: seven lines, state in words and shape, each opening its page. It
//      replaces the old "Stage N of 3" line (§3c). On the Creation screen, that screen's one-line purpose instead.
//
// ⚠⚠ THE CURRENT STAGE IS NOT MARKED BY COLOUR (docs/CLAUDE.md §21; Charlie is colour blind). Four cues, any one of which survives
// greyscale: the WORDS "You are here"; a FILLED disc (●) against hollow ones (○); a filled dark BACKGROUND against white (lightness);
// `border-2` WEIGHT. The checklist's current line carries the words, the weight and bold type. A locked line carries 🔒 AND the word.
//
// ⚠ NOT A CLIENT COMPONENT AND NOT STATEFUL: every link is a full navigation, so no screen holds stale state that looks current.
//
// ⚠ Z1b (CCh, 18 Nov 23:40, item 4) — ON A DESKTOP (≥ 768 px) THE SEVEN STAGES ARE ONE ROW, NEVER WRAPPED ("In Force" had dropped under the
//   others): the cards share the width and their state text shrinks instead. Each row carries a label at its left ("Stages", "Chapters"),
//   from `STAGEBAR_ROW_WORD` (decision 352 may rename them). Below 768 px — panel 1 on a phone — the cards wrap as before, with no labels.
// ─────────────────────────────────────────────────────────────────────────────

import type { StageContext } from '@/lib/lex/stage-context'
import { LEX_STAGES } from '@/lib/lex/stages'
import { LIFECYCLE_UI, STAGEBAR_ROW_WORD } from '@/lib/lex/screen-labels'

const rowLabel = 'hidden md:block w-[4.5rem] shrink-0 pt-1 text-[11px] font-bold uppercase tracking-wide text-zinc-700'

export default function StageBar({ context }: { context: StageContext | null }) {
  // ⚠ NULL ONLY WHEN THE PAGE COULD NOT COMPUTE IT — never as "there is nothing to show".
  if (!context) return null
  const screen = LEX_STAGES.find((s) => s.key === context.here) ?? LEX_STAGES[0]

  return (
    <nav aria-label="Where you are" className="w-full" data-lifecycle-bar>
      <div className="md:flex md:items-start md:gap-2">
      <span className={rowLabel} data-row-label="stages">{STAGEBAR_ROW_WORD.stages}</span>
      <ol className="flex flex-wrap md:flex-nowrap items-stretch gap-1.5 md:min-w-0 md:flex-1" data-stage-row>
        {context.lifecycle.map((s) => {
          const current = s.key === context.current
          const body = (
            <>
              <span className="flex items-baseline gap-1.5">
                <span aria-hidden className="text-[11px] leading-none">{current ? '●' : '○'}</span>
                <span className={`text-[13px] md:text-[12px] leading-tight ${current ? 'font-bold' : 'font-medium'}`}>{s.name}</span>
              </span>
              {current && <span className="block text-[10px] font-semibold uppercase tracking-wide text-white/90" data-you-are-here>{LIFECYCLE_UI.youAreHere}</span>}
              <span className={`block text-[11px] md:text-[10px] md:leading-snug mt-0.5 break-words ${current ? 'text-white/80' : 'text-zinc-600'}`} data-stage-state={s.key}>{s.state}</span>
            </>
          )
          const shell = current
            ? 'border-2 border-zinc-900 bg-zinc-900 text-white'
            : s.href
              ? 'border-2 border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50'
              : 'border-2 border-dashed border-zinc-200 bg-white text-zinc-500'
          return (
            <li key={s.key} className="flex-1 min-w-[7.5rem] md:min-w-0" data-lifecycle-stage={s.key}>
              {s.href && !(current && context.here !== 'deepening') ? (
                <a href={s.href} {...(current ? { 'aria-current': 'step' as const } : {})} className={`block h-full rounded-xl px-2.5 py-1.5 transition-colors ${shell}`}>{body}</a>
              ) : (
                <div {...(current ? { 'aria-current': 'step' as const } : {})} className={`h-full rounded-xl px-2.5 py-1.5 ${shell}`}>{body}</div>
              )}
            </li>
          )
        })}
      </ol>
      </div>

      {context.checklist ? (
        // §3a — the Development checklist: one line each, state in words and shape, each opening its page.
        <div className="mt-1.5 md:flex md:items-start md:gap-2">
        <span className={rowLabel} data-row-label="chapters">{STAGEBAR_ROW_WORD.chapters}</span>
        <ol className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-700 md:min-w-0 md:flex-1" aria-label="Development — the checklist" data-development-checklist>
          {context.checklist.map((l) => {
            const here = l.key === context.checklistHere
            const inner = (
              <>
                <span aria-hidden>{l.mark}</span> <span className={here ? 'font-bold' : 'font-semibold'}>{l.n}. {l.label}</span> — <span data-checklist-state>{l.state}</span>
                {here && <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide">· {LIFECYCLE_UI.youAreHere}</span>}
              </>
            )
            const box = here ? 'border-2 border-zinc-900 rounded px-1.5 py-0.5 bg-white' : 'px-1.5 py-0.5'
            return (
              <li key={l.key} data-checklist-line={l.key} {...(here ? { 'aria-current': 'step' as const } : {})}>
                {l.href ? <a href={l.href} className={`inline-block hover:underline ${box}`}>{inner}</a> : <span className={`inline-block text-zinc-500 ${box}`}>{inner}</span>}
              </li>
            )
          })}
        </ol>
        </div>
      ) : (
        <p className="mt-1.5 text-xs text-zinc-600">
          <span className="font-semibold text-zinc-800">{screen.name}.</span> {screen.purpose}
        </p>
      )}
    </nav>
  )
}
