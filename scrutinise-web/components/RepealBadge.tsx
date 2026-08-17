// ─────────────────────────────────────────────────────────────────────────────
// RepealBadge.tsx — SURFACE 1. ONE component for the three repeal states, so no two
// surfaces word it differently.
//
// ⚠ THE WORDING COMES FROM lib/lex/repeal-status.ts, not from here. That module also writes
// the line Lex reads, and a badge that phrased it independently is how the panel comes to
// say one thing while the answer beside it says another.
//
// ⚠⚠ "NO REPEAL RECORDED" IS NOT "IN FORCE". The third state is deliberately quiet — a
// small grey line, not a green tick — because a reassuring badge is a claim, and we do not
// hold the fact that would justify one. `check:repeal-status` fails the build if the words
// "in force" or "still current" appear as an assertion in this file.
//
// ⚠ AND `undefined` RENDERS NOTHING AT ALL. Undefined means the lookup failed; no-record
// means it succeeded and found nothing. A failed lookup must not manufacture reassurance,
// so the two are visually different: one is silent, the other says what it checked.
// ─────────────────────────────────────────────────────────────────────────────
'use client'

import { repealLabel, repealExplanation, type RepealStatus } from '@/lib/lex/repeal-status'

export function RepealBadge({ repeal, compact = false }: { repeal?: RepealStatus; compact?: boolean }) {
  // Lookup failed (or an older caller never attached one) — say nothing rather than something false.
  if (!repeal) return null

  const repealed = repeal.state !== 'no-record'

  if (repealed) {
    return (
      <span
        title={repealExplanation(repeal)}
        className={`inline-flex items-center gap-1 rounded border font-semibold shrink-0 ${
          compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'
        } bg-red-50 text-red-800 border-red-300`}
      >
        <span aria-hidden>⚠</span>
        {repealLabel(repeal)}
      </span>
    )
  }

  // ── the third state ──
  // Quiet on purpose. It states what the record shows and stops there.
  return (
    <span
      title={repealExplanation(repeal)}
      className={`inline-flex items-center rounded border shrink-0 ${
        compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'
      } bg-gray-50 text-gray-600 border-gray-200`}
    >
      {repealLabel(repeal)}
    </span>
  )
}

/**
 * The longer caption, for a surface with room for it — a detail page rather than a card.
 * Same source of wording; nothing new is asserted.
 */
export function RepealNote({ repeal }: { repeal?: RepealStatus }) {
  if (!repeal) return null
  const repealed = repeal.state !== 'no-record'
  return (
    <p className={`text-xs leading-snug ${repealed ? 'text-red-800' : 'text-muted-foreground'}`}>
      {repealed && <strong>{repealLabel(repeal)}. </strong>}
      {repealExplanation(repeal)}
    </p>
  )
}
