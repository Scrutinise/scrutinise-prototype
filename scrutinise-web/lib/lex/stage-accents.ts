// ─────────────────────────────────────────────────────────────────────────────
// Per-stage accent colours (§19-B Task 3).
//
// Entering a new stage must LOOK like something happened. Each Lex page owns one
// restrained accent, reused across the three panels: the fields-panel stage header
// + active-section border, and the chat's stage divider.
//
// The set is drawn from colours the design system already uses, so nothing new
// enters the palette: blue = the platform primary (buttons, "proposed by Lex"),
// amber = already the MATERIAL-cause chip, emerald = already the chosen/root
// affirmative, violet = the one addition, chosen to sit between the two without
// competing with either.
//
// Tailwind scans source for literal class names — every class here MUST stay a
// complete literal string. Never build one by interpolation.
// ─────────────────────────────────────────────────────────────────────────────

export interface StageAccent {
  /** Status dot / divider rule. */
  dot: string
  /** Stage label text. */
  text: string
  /** Active-section border. */
  border: string
  /** Soft background wash for the stage header row. */
  bg: string
  /** The divider rule in chat. */
  rule: string
}

const ZINC: StageAccent = {
  dot: 'bg-zinc-300', text: 'text-zinc-500', border: 'border-zinc-200', bg: 'bg-zinc-50', rule: 'bg-zinc-200',
}

export const STAGE_ACCENTS: Record<string, StageAccent> = {
  ORIENTATION: {
    dot: 'bg-blue-600', text: 'text-blue-700', border: 'border-blue-300', bg: 'bg-blue-50/60', rule: 'bg-blue-200',
  },
  DIAGNOSIS: {
    dot: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-300', bg: 'bg-amber-50/60', rule: 'bg-amber-200',
  },
  GUIDING_POLICY: {
    dot: 'bg-violet-600', text: 'text-violet-700', border: 'border-violet-300', bg: 'bg-violet-50/60', rule: 'bg-violet-200',
  },
  COHERENT_ACTIONS: {
    dot: 'bg-emerald-600', text: 'text-emerald-700', border: 'border-emerald-300', bg: 'bg-emerald-50/60', rule: 'bg-emerald-200',
  },
}

export function accentFor(pageKey: string | null | undefined): StageAccent {
  return (pageKey && STAGE_ACCENTS[pageKey]) || ZINC
}
