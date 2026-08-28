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

/** §4's table, in one place, so the three surfaces cannot describe the columns differently. */
export const PANEL_ROLES: Record<PanelKey, { name: string; role: string }> = {
  left: { name: 'Lex', role: 'Lex, in the context of what is in the middle' },
  // ⚠⚠ "THE DRAFT", NOT "PROPOSAL", AND THIS CONTRADICTS 25-L §6's OWN WORDING.
  // §6 names the middle tab "Proposal". 25-K §1 retired "proposal" as navigation — that
  // was Charlie's own diagnosis of why he got lost in his own product, and `check:lex-25k`
  // sweeps every screen for it. Two briefs cannot both be obeyed here, so the newer rule
  // about the WORD loses to the older rule about NAVIGATION, which is the one that was
  // written after somebody actually got lost. Recorded in the sprint report for Charlie.
  middle: { name: 'The draft', role: 'what you are saying — the stage you are working on' },
  right: { name: 'Resources', role: 'everything Lex found or worked out about the world' },
}

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

/** The CSS `grid-template-columns` value for a layout. Closed panels become a slim edge. */
export function gridTemplate(layout: PanelLayout, edge = '2.5rem'): string {
  return PANEL_KEYS
    .map((k) => (layout.open[k] ? `${(layout.width[k] * 100).toFixed(3)}fr` : edge))
    .join(' ')
}
