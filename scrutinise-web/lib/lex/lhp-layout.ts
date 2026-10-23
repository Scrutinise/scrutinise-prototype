// ─────────────────────────────────────────────────────────────────────────────
// Decision 249 (CCh 23 Oct (9)) — THE LEFT-HAND PANEL'S TWO HALVES AND THE TYPING BOX, REMEMBERED PER BROWSER.
//   - Each half (the worklist above, Lex/Notes below) has Maximise (word + ⤢) to fill the panel; it then reads Minimise (word + ⤡) and
//     restores the EQUAL split.
//   - The typing box grows as typed to half the chat area, and has a drag handle on its bottom edge.
// The browser remembers both. Pure, no imports: the keys, the parsing and the clamps, so the panel and its check read one definition.
// ⚠ Storage can be missing or throw (private window, blocked site data): every read falls back to the default, every write is best-effort.
// ─────────────────────────────────────────────────────────────────────────────

export type LhpMax = 'none' | 'worklist' | 'chat'

export const LHP_KEYS = { max: 'scrutinise.lhp.max', inputPx: 'scrutinise.chat.inputPx' } as const
/** The split Minimise restores: the two halves equal. */
export const EQUAL_SPLIT = 0.5
/** The typing box never shrinks below three lines, and never grows past half the chat area. */
export const INPUT_MIN_PX = 72

export const MAXIMISE_LABEL = 'Maximise'
export const MINIMISE_LABEL = 'Minimise'
export const MAXIMISE_GLYPH = '⤢'
export const MINIMISE_GLYPH = '⤡'

export function parseMax(v: string | null): LhpMax {
  return v === 'worklist' || v === 'chat' ? v : 'none'
}

/** A remembered height, or null when nothing usable is stored. */
export function parsePx(v: string | null): number | null {
  const n = Number(v)
  return v != null && Number.isFinite(n) && n >= INPUT_MIN_PX ? Math.round(n) : null
}

/** The box's height: what the user dragged it to (or the minimum), grown to fit what is typed, never past half the chat area. */
export function inputHeight(opts: { contentPx: number; chosenPx: number | null; chatAreaPx: number }): number {
  const ceiling = Math.max(INPUT_MIN_PX, Math.floor(opts.chatAreaPx / 2))
  const floor = Math.min(ceiling, Math.max(INPUT_MIN_PX, opts.chosenPx ?? INPUT_MIN_PX))
  return Math.min(ceiling, Math.max(floor, opts.contentPx))
}

export function readStored(key: string): string | null {
  try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key) } catch { return null }
}
export function writeStored(key: string, value: string | null): void {
  try { if (value == null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value) } catch { /* best-effort */ }
}
