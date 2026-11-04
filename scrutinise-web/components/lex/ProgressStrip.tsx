// 26-X §5f (decision 310) — THE PROGRESS STRIP: Defined ● → Briefed ● → Drafted ○ → Reviewed ○ → Accepted ○.
// A SHAPE AND A WORD for every state, never colour (CLAUDE.md §21): ● done · ◐ in progress · ○ not yet. "Needs no draft" (313) reads
// "Defined ● · needs no draft ✓". The states are derived (lib/lex/action-progress-pure.ts), never stored. Shown on every row of Organising and
// Drafting. Not a client component of its own: it holds no state, so the workspace and the checks render the same markup.

import { PROGRESS_WORD } from '@/lib/lex/screen-labels'
import { MARK_GLYPH, NO_DRAFT_GLYPH, PROGRESS_KEYS, stripWords, type Progress } from '@/lib/lex/action-progress-pure'

export default function ProgressStrip({ p }: { p: Progress | undefined }) {
  if (!p) return <span className="text-[11px] text-zinc-500" data-progress-strip="unread">progress not read yet</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 text-[11px] text-zinc-800" data-progress-strip={p.stage} aria-label={stripWords(p)}>
      {p.noDraft ? (
        <>
          <span data-progress="defined" data-mark={p.marks.defined}>{PROGRESS_WORD.defined} <span aria-hidden>{MARK_GLYPH[p.marks.defined]}</span></span>
          <span aria-hidden>·</span>
          <span className="font-semibold" data-progress="noDraft">{PROGRESS_WORD.noDraft} <span aria-hidden>{NO_DRAFT_GLYPH}</span></span>
        </>
      ) : PROGRESS_KEYS.map((k, i) => (
        <span key={k} className={p.marks[k] === 'done' ? 'font-semibold' : ''} data-progress={k} data-mark={p.marks[k]}>
          {i > 0 && <span aria-hidden className="mr-1.5 text-zinc-400">→</span>}{PROGRESS_WORD[k]} <span aria-hidden>{MARK_GLYPH[p.marks[k]]}</span>
        </span>
      ))}
    </span>
  )
}
