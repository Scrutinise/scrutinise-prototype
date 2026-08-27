// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL Stage 2h item 7 — the platform accent, chosen per user.
//
// ⚠ WHY THIS EXISTS, on the record: Central's live-state accent is a teal
// (#14b8a6) that sits close to one party's brand colour. Scrutinise is a neutral
// platform, and a neutral platform wearing a party's colour is a poor look
// whichever party it happens to resemble. Letting each person choose removes the
// question rather than answering it.
//
// ⚠ A FIXED PALETTE, NOT A COLOUR PICKER. Free hex entry produces unreadable
// text and non-compliant contrast within about four clicks, and there is no
// sensible way to refuse a colour without explaining colour theory in a tooltip.
// Every entry below has its THREE values hand-set rather than derived: a base
// for fills and borders, and two darkened text values. Deriving the text colours
// from the base by a lightness shift is what generates the unreadable
// combinations this palette exists to avoid — a mid-yellow darkened by a fixed
// amount is still unreadable, and a mid-blue darkened by the same amount is
// nearly black.
//
// ⚠ THE FILL AND BORDER TOKENS TAKE AN 8-DIGIT HEX (#rrggbbaa). They are alpha
// variants of the base, so they must stay in hex rather than becoming
// `color-mix`: the existing `globals.css` values are `#14b8a60a` and friends,
// and a surface reading one of these expects a colour, not a function.
// ─────────────────────────────────────────────────────────────────────────────

export type AccentOption = {
  key: string
  label: string
  /** Fills, borders and the live-state rule. */
  base: string
  /** Body-size text on white. */
  text: string
  /** Small-caps headings on a tinted fill. */
  textDeep: string
}

/**
 * ⚠ ORDER IS THE UI ORDER. Teal stays first and stays the default, because
 * changing what existing members already see is a bigger act than offering them
 * an alternative.
 */
export const ACCENT_PALETTE: readonly AccentOption[] = [
  { key: 'teal', label: 'Teal', base: '#14b8a6', text: '#0d7a6f', textDeep: '#0b6f66' },
  { key: 'indigo', label: 'Indigo', base: '#4f46e5', text: '#4338ca', textDeep: '#3730a3' },
  { key: 'slate', label: 'Graphite', base: '#475569', text: '#334155', textDeep: '#1e293b' },
  { key: 'violet', label: 'Violet', base: '#7c3aed', text: '#6d28d9', textDeep: '#5b21b6' },
  { key: 'green', label: 'Green', base: '#15803d', text: '#15803d', textDeep: '#14532d' },
  { key: 'ochre', label: 'Ochre', base: '#b45309', text: '#a4500a', textDeep: '#7c2d12' },
  { key: 'rose', label: 'Rose', base: '#be123c', text: '#a81236', textDeep: '#881337' },
] as const

export const DEFAULT_ACCENT_KEY = 'teal'

export function accentByKey(key: string | null | undefined): AccentOption {
  return ACCENT_PALETTE.find((a) => a.key === key) ?? ACCENT_PALETTE[0]
}

/** Whether a stored value is one this build still offers. */
export function isAccentKey(value: string): boolean {
  return ACCENT_PALETTE.some((a) => a.key === value)
}

/**
 * The eight `--central-teal*` custom properties, for one accent.
 *
 * ⚠ THE VARIABLE NAMES KEEP SAYING "teal" ON PURPOSE. Twenty-five call sites in
 * the components and seventeen in `globals.css` reference `--central-teal*`;
 * renaming them to `--central-accent*` would be a rename of every one of those
 * in the same change that introduces the feature, and any site missed would
 * silently fall back to nothing. The name is now a misnomer, and a misnomer that
 * works everywhere beats a correct name that works in most places. This comment
 * is the note for whoever renames them later.
 */
export function accentVariables(accent: AccentOption): Record<string, string> {
  const { base, text, textDeep } = accent
  return {
    '--central-teal': base,
    '--central-teal-text': text,
    '--central-teal-text-deep': textDeep,
    '--central-teal-fill-faint': `${base}0a`,
    '--central-teal-fill': `${base}0f`,
    '--central-teal-fill-strong': `${base}14`,
    '--central-teal-border': `${base}4d`,
    '--central-teal-border-soft': `${base}33`,
  }
}

/** The same thing as a CSS declaration block, for a `<style>` or `style` attr. */
export function accentCss(accent: AccentOption): string {
  return Object.entries(accentVariables(accent))
    .map(([k, v]) => `${k}:${v}`)
    .join(';')
}
