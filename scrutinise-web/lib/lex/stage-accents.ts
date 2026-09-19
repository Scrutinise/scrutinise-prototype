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
  /** Soft background wash for the stage header row (ChatPanel's divider card, etc.). */
  bg: string
  /** The divider rule in chat. */
  rule: string
  /**
   * 26-C §8a — THE HEADING'S OWN CONTAINER, HEAVY AND STRONGLY SATURATED.
   *
   * §8a: "The box around each heading takes the same colour as the heading, heavy and
   * strongly saturated. At present the heading is coloured and its container is not" —
   * `bg` above is a pale wash (`-50/60`), which is right for the surfaces that already
   * use it (a card full of ordinary dark text) and wrong for a heading's own box, which
   * this is for instead. A NEW field rather than redefining `bg`: `ChatPanel` and
   * `CreateIdeaClient` already read `bg` expecting a pale wash, and repainting it heavy
   * would put white-on-heavy text where dark-on-pale text is still expected.
   */
  headingBg: string
  /**
   * Text colour ON `headingBg`. ⚠⚠ MEASURED, NOT REUSED FROM `text` — CLAUDE.md §21's own
   * register: `amber-600`/`emerald-600` with white text score 3.19:1 / 3.77:1 (fail WCAG
   * AA's 4.5:1); `amber-700`/`emerald-700` score 5.02:1 / 5.48:1 (pass). `blue-600` and
   * `violet-600` already pass at 5.18:1 / 5.70:1. `check:central`'s contrast pattern is
   * the model for this — a "pre-vetted" pair is the same unreadable-combination risk
   * arrived at more slowly.
   */
  onHeadingBg: string
}

const ZINC: StageAccent = {
  dot: 'bg-zinc-300', text: 'text-zinc-500', border: 'border-zinc-200', bg: 'bg-zinc-50', rule: 'bg-zinc-200',
  headingBg: 'bg-zinc-200', onHeadingBg: 'text-zinc-800',
}

export const STAGE_ACCENTS: Record<string, StageAccent> = {
  ORIENTATION: {
    dot: 'bg-blue-600', text: 'text-blue-700', border: 'border-blue-300', bg: 'bg-blue-50/60', rule: 'bg-blue-200',
    headingBg: 'bg-blue-600', onHeadingBg: 'text-white',
  },
  DIAGNOSIS: {
    dot: 'bg-amber-500', text: 'text-amber-700', border: 'border-amber-300', bg: 'bg-amber-50/60', rule: 'bg-amber-200',
    // ⚠ amber-600, not amber-700, measures 3.19:1 with white — see the field's own comment.
    headingBg: 'bg-amber-700', onHeadingBg: 'text-white',
  },
  GUIDING_POLICY: {
    dot: 'bg-violet-600', text: 'text-violet-700', border: 'border-violet-300', bg: 'bg-violet-50/60', rule: 'bg-violet-200',
    headingBg: 'bg-violet-600', onHeadingBg: 'text-white',
  },
  COHERENT_ACTIONS: {
    dot: 'bg-emerald-600', text: 'text-emerald-700', border: 'border-emerald-300', bg: 'bg-emerald-50/60', rule: 'bg-emerald-200',
    // ⚠ emerald-600, not emerald-700, measures 3.77:1 with white — see the field's own comment.
    headingBg: 'bg-emerald-700', onHeadingBg: 'text-white',
  },
}

export function accentFor(pageKey: string | null | undefined): StageAccent {
  return (pageKey && STAGE_ACCENTS[pageKey]) || ZINC
}
