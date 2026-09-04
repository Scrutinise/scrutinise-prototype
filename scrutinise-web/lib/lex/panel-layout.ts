// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-L §4 — THE THREE PANELS: WHICH ARE OPEN, AND HOW WIDE.
//
// ⚠ THE ROLES ARE STATED ON SCREEN BECAUSE THEY ARE CURRENTLY INFERRED. §4's table is the
// whole point of this file existing rather than three numbers in `localStorage`: a user who
// cannot say what the middle column is FOR cannot decide whether to widen it.
//
//   LEFT    Lex, in the context of what is in the middle
//   MIDDLE  what YOU are saying — the stage you are working on
//   RIGHT   the resources: everything Lex found or worked out about the world
//
// ⚠ SENSIBLE MINIMUMS, SO A PANEL CANNOT BE DRAGGED TO UNUSABILITY. A divider that can take
// a column to two per cent produces a screen the user cannot recover without knowing there
// is a reset — and they do not, because nothing has gone wrong yet at the moment they drag.
// The clamp is here rather than in the drag handler so the SERVER refuses an impossible
// layout too: a stored 1% would come back on every future page load.
//
// ⚠ AND A CLOSED PANEL KEEPS ITS WIDTH. Closing and reopening a column that came back at the
// default would silently discard a size the user chose, which reads as the setting not
// having saved. `open` and `width` are independent.
// ─────────────────────────────────────────────────────────────────────────────

export type PanelKey = 'left' | 'middle' | 'right'

export const PANEL_KEYS: PanelKey[] = ['left', 'middle', 'right']

/**
 * ══ 25-N §2 — THE THREE PANEL TITLES, IN CHARLIE'S OWN WORDS ════════════════════
 *
 * §2 gives the three names verbatim: **WORKING AREA · DRAFT STRATEGY · THE RESEARCH**, and
 * §3 gives the logic they now express — *"raw material on the right · the draft report in
 * the middle · notes and chat on the left."*
 *
 * ⚠⚠ THE SUBTITLES ARE DELETED, EXCEPT ONE. 25-L §4 put a `role` line beside every title
 * because "a user who cannot say what a column is FOR cannot decide whether to widen it".
 * The names now carry that themselves — "WORKING AREA" says what it is in a way that "Lex"
 * did not — and three explanatory lines across the top of three columns is furniture. THE
 * RESEARCH keeps one, because it is the panel whose contents are least guessable from its
 * name, and its sentence is Charlie's, verbatim.
 *
 * ⚠ "THE DRAFT" IS GONE AND SO IS THE 25-L/25-K CONTRADICTION IT RECORDED. "DRAFT STRATEGY"
 * is neither "the proposal" (the implementation word 25-K retired) nor the bare "draft" that
 * left the middle column sounding like a scratchpad. Both earlier rules survive it.
 */
import { EVIDENCE_DISCLOSURE } from './beta-disclosure'

export const PANEL_ROLES: Record<PanelKey, { name: string; role: string; disclosure?: string }> = {
  left: { name: 'WORKING AREA', role: '' },
  middle: { name: 'DRAFT STRATEGY', role: '' },
  right: {
    name: 'THE RESEARCH',
    // ⚠ 25-Z §3 — Charlie's wording, verbatim. A phrase, not a sentence about the panel.
    role: 'The issues, the numbers and the debates behind your strategy',
    // ⚠ 25-V §11b — Charlie's wording, verbatim, on the surface where the evidence is READ.
    // It sits with the panel's own role rather than inside a card, because it is a statement
    // about everything in the column and a card would scroll away from what it qualifies.
    disclosure: EVIDENCE_DISCLOSURE,
  },
}

/**
 * §2 — "Collapse" → "Hide this Panel", on every column.
 *
 * ⚠ ONE CONSTANT, because there were three hand-written variants ("Collapse Lex",
 * "Collapse the draft", "Collapse the resources panel") and a fourth would have been
 * written the next time a column was added.
 */
export const HIDE_PANEL_LABEL = 'Hide this Panel'

export interface PanelLayout {
  open: Record<PanelKey, boolean>
  /** Fractions of the row, summing to 1. Only meaningful for panels that are open. */
  width: Record<PanelKey, number>
}

/**
 * ⚠ THE DEFAULT IS THE LAYOUT THAT SHIPPED, not an even split. A user who has never touched
 * a divider must see exactly what they saw yesterday; changing the default as a side effect
 * of making it adjustable would move every existing user's screen for no reason they asked
 * for.
 */
export const DEFAULT_LAYOUT: PanelLayout = {
  open: { left: true, middle: true, right: true },
  width: { left: 0.375, middle: 0.3125, right: 0.3125 },
}

/** No column may fall below this fraction of the row. */
export const MIN_WIDTH = 0.15

/**
 * Validate and repair anything that arrives from a client or from storage.
 *
 * ⚠ IT REPAIRS RATHER THAN REJECTS. A layout that fails validation is not an error the user
 * can act on — it is a stored value from an older shape, or a rounding drift — and throwing
 * would leave them looking at a broken screen with no way back. Anything unreadable falls to
 * the default, which is always usable.
 *
 * ⚠ AND IT RE-NORMALISES. Widths that no longer sum to 1 (a panel added, a stored value
 * clamped) would otherwise leave a gap or an overflow at the end of the row.
 */
export function normaliseLayout(raw: unknown): PanelLayout {
  if (!raw || typeof raw !== 'object') return DEFAULT_LAYOUT
  const r = raw as Partial<PanelLayout>
  const open = {} as Record<PanelKey, boolean>
  const width = {} as Record<PanelKey, number>

  for (const k of PANEL_KEYS) {
    open[k] = typeof r.open?.[k] === 'boolean' ? r.open[k] : DEFAULT_LAYOUT.open[k]
    const w = Number(r.width?.[k])
    width[k] = Number.isFinite(w) && w > 0 ? w : DEFAULT_LAYOUT.width[k]
  }

  // ⚠ AT LEAST ONE PANEL STAYS OPEN. All three closed is a blank screen with three edges,
  // and a user who reached it would have no reason to believe the app had not crashed.
  if (!PANEL_KEYS.some((k) => open[k])) open.middle = true

  // ⚠⚠ CLAMP AND RE-NORMALISE FIGHT EACH OTHER, AND THE FIRST VERSION OF THIS LOST.
  //
  // Clamping the small ones up to the minimum and then dividing everything by the new total
  // pushes them straight back BELOW the minimum — `{0.01, 0.01, 0.98}` came back with a
  // left column at 0.117 against a floor of 0.15. It was found by `check:lex-25l`, not by
  // reading this, because the arithmetic looks right until you run it.
  //
  // The fix is to take the deficit out of the columns that can afford it, rather than out of
  // everything including the ones just raised. Iterated because raising one column can push
  // its neighbour under the floor in turn; bounded by the number of panels, so it terminates.
  const openKeys = PANEL_KEYS.filter((k) => open[k])
  let total = openKeys.reduce((n, k) => n + width[k], 0)
  if (total <= 0) {
    for (const k of openKeys) width[k] = 1 / openKeys.length
    total = 1
  }
  for (const k of openKeys) width[k] = width[k] / total

  // ⚠ IF EVERY COLUMN CANNOT HAVE THE MINIMUM, AN EVEN SPLIT IS THE ONLY HONEST ANSWER.
  // With four panels and a 0.3 floor there is no layout satisfying the constraint, and
  // silently returning one that violates it is worse than returning one that is merely not
  // what was asked for.
  if (openKeys.length * MIN_WIDTH >= 1) {
    for (const k of openKeys) width[k] = 1 / openKeys.length
    return { open, width }
  }

  for (let pass = 0; pass < openKeys.length; pass++) {
    const under = openKeys.filter((k) => width[k] < MIN_WIDTH)
    if (!under.length) break
    const deficit = under.reduce((n, k) => n + (MIN_WIDTH - width[k]), 0)
    for (const k of under) width[k] = MIN_WIDTH
    const over = openKeys.filter((k) => width[k] > MIN_WIDTH)
    const spare = over.reduce((n, k) => n + (width[k] - MIN_WIDTH), 0)
    if (spare <= 0) break
    for (const k of over) width[k] -= deficit * ((width[k] - MIN_WIDTH) / spare)
  }

  return { open, width }
}

/**
 * The CSS `grid-template-columns` value for a layout. Closed panels become a slim edge.
 *
 * ══ 25-N §1b — `minmax(0, Nfr)`, NEVER A BARE `Nfr` ══════════════════════════════
 *
 * ⚠⚠ THIS ONE CHARACTER SEQUENCE IS THE WHOLE OF "PANELS RESIZE THEMSELVES AND CANNOT BE
 * RESTORED". A bare `Nfr` track is `minmax(auto, Nfr)`: the `auto` minimum means the track
 * may never be narrower than its content's MIN-CONTENT width. So the instant something wide
 * and unbreakable lands in a column — a citation, a legislation.gov.uk URL, a long
 * un-hyphenated title, which is exactly what appears when you click an item in the research
 * panel — the browser widens that track past the fraction the user set and takes the
 * difference out of the other two. Nothing in our code moved; the stored layout is
 * untouched; and there is no control that puts it back, because from the layout's point of
 * view nothing happened.
 *
 * `minmax(0, Nfr)` sets the minimum to zero, so the fractions are the fractions and the
 * content scrolls inside its own column instead of pushing it. The panels then change size
 * ONLY when a divider is dragged, which is §1b's rule.
 *
 * ⚠ THE PANEL BODIES ALSO NEED `min-w-0`. A grid ITEM has `min-width: auto` for the same
 * reason a track does; zeroing the track's minimum without zeroing the item's just moves
 * the overflow one level down.
 */
export function gridTemplate(layout: PanelLayout, edge = '2.5rem'): string {
  return PANEL_KEYS
    .map((k) => (layout.open[k] ? `minmax(0, ${(layout.width[k] * 100).toFixed(3)}fr)` : edge))
    .join(' ')
}
