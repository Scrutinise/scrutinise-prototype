// ─────────────────────────────────────────────────────────────────────────────
// 26-Q §3b — THE HEADING PALETTE. NEVER COLOUR ALONE.
//
// Charlie is colour blind. A heading carries FOUR cues, and the colour is the least important of them:
//   1. its NAME, printed on the line;
//   2. a SHAPE glyph, different for every colour (docs/CLAUDE.md §21: "two different characters, not one recoloured");
//   3. the colour's LIGHTNESS — the eight colours are spread down a lightness ladder (CIE L* 16 → 58, about six apart),
//      so they differ in lightness as well as hue, and lightness survives most colour-blindness and a greyscale print;
//   4. the colour itself, as a trim on the line.
// The lightest colour is held at ≥ 3:1 against white (WCAG 1.4.11, non-text) — `check:lex-26q` MEASURES all of this
// rather than trusting the hex values.
//
// Pure and import-free: used by a client component (docs/CLAUDE.md §28), the server and the check.
// ─────────────────────────────────────────────────────────────────────────────

export interface HeadingColour {
  key: string
  /** A plain-words colour name, for screen readers and for the picker. */
  name: string
  hex: string
  /** A different character per colour — a cue that survives greyscale. */
  glyph: string
}

/** Ordered DARKEST → LIGHTEST. Hexes found by search at fixed CIE L* (16, 22, 28, 34, 40, 46, 52, 58), saturation 0.62. */
export const HEADING_PALETTE: readonly HeadingColour[] = [
  { key: 'navy',    name: 'navy blue',   hex: '#142455', glyph: '■' },
  { key: 'maroon',  name: 'maroon',      hex: '#661818', glyph: '▲' },
  { key: 'forest',  name: 'forest green', hex: '#124c2f', glyph: '●' },
  { key: 'brown',   name: 'brown',       hex: '#74451b', glyph: '◆' },
  { key: 'purple',  name: 'purple',      hex: '#872fc6', glyph: '★' },
  { key: 'teal',    name: 'teal',        hex: '#1e7880', glyph: '▼' },
  { key: 'pink',    name: 'pink',        hex: '#d3458c', glyph: '✚' },
  { key: 'olive',   name: 'olive',       hex: '#8d9122', glyph: '◗' },
]

export const colourFor = (key: string | null | undefined): HeadingColour =>
  HEADING_PALETTE.find((c) => c.key === key) ?? HEADING_PALETTE[0]

/** The next colour not yet used on this idea — so a new heading is distinguishable from the ones beside it. */
export function nextColourKey(used: readonly string[]): string {
  const free = HEADING_PALETTE.find((c) => !used.includes(c.key))
  return (free ?? HEADING_PALETTE[used.length % HEADING_PALETTE.length]).key
}

// ── measurement (used by the check, and importable by anything that wants to prove the claim) ──────────────
const lin = (c: number) => { const x = c / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
const parse = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
export const luminance = (hex: string) => { const [r, g, b] = parse(hex); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) }
/** CIE L* (0 = black, 100 = white). */
export const lightnessOf = (hex: string) => { const y = luminance(hex); return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y }
export const contrastOnWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05)
