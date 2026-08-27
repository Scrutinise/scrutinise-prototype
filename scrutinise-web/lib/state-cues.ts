// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL Stage 2h item 6 — no state in Central is signalled by colour alone.
//
// ⚠ THE REASON IS NOT ABSTRACT ACCESSIBILITY POLICY. Charlie, who runs this
// platform, is colour blind. A "you have voted" state that differs from "you
// have not voted" only by teal-versus-grey is invisible to him, and he cannot
// tell whether his own click registered.
//
// ⚠ `aria-pressed` DOES NOT FIX THIS. Every control below already carried it,
// and it is worth keeping — but it speaks to a screen reader, not to a sighted
// person who cannot separate two hues. The second cue has to be VISUAL.
//
// THE VOCABULARY, so four controls cannot invent four different answers:
//
//   1. SHAPE — a filled glyph when on, an outline glyph when off. This survives
//      greyscale, every form of colour blindness, and a bad monitor.
//   2. WEIGHT — a heavier border or bolder type on the active state.
//
// Colour stays. It is the fastest cue for the people who can see it; it is just
// never the only one.
//
// WHAT THIS SWEEP FOUND ALREADY CARRYING A SECOND CUE (left alone):
//   · flags — the words "Do not use" / "Use with care" are in the badge
//   · role badges — the role name is the badge text
//   · the AI label — "Written by {model}"
//   · the approval stamp — 2px frame plus a worded superscript (item 13)
//   · favourites — ★ filled versus ☆ outline
//   · context chips, leaderboard tabs, pack size — a filled background against a
//     white one is a LIGHTNESS difference, which colour blindness preserves
//   · bulletin votes — `strokeWidth` 3 versus 2 on the chevron
//   · the leaderboard delta — red/green is the classic deuteranopia pair, but it
//     prints a leading "+" or "−", and the sign is the cue
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filled when the vote is yours, outline when it is not.
 *
 * ⚠ These are four DIFFERENT characters, not one character in two colours:
 * U+25B2/U+25BC are solid, U+25B3/U+25BD are hollow. Photocopy the screen and
 * the state still reads.
 */
export const VOTE_GLYPH = {
  upOn: '▲',
  upOff: '△',
  downOn: '▼',
  downOff: '▽',
} as const

export function upGlyph(active: boolean): string {
  return active ? VOTE_GLYPH.upOn : VOTE_GLYPH.upOff
}

export function downGlyph(active: boolean): string {
  return active ? VOTE_GLYPH.downOn : VOTE_GLYPH.downOff
}

/**
 * The weight cue for a selected control, as one string so every surface picks
 * the same thickness. 2px is the same signal the approval frame uses, and
 * nothing in Central's resting state draws it.
 */
export const SELECTED_WEIGHT = 'border-2 font-semibold'
export const UNSELECTED_WEIGHT = 'border font-normal'
