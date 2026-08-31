// ─────────────────────────────────────────────────────────────────────────────
// §8.2 — the document model. One neutral block list, two renderers (docx, PDF).
//
// Deliberately NOT briefing-specific: the Initial Background is the first thing
// built through it, and the full proposal document (§20-B) is meant to be the
// second. A new document type is a new *builder* that returns `DocumentModel` —
// the renderers never learn what they are rendering.
//
// Nothing in here generates content. A builder may only arrange what is already
// stored; if a value isn't in the database it does not appear in the export.
// ─────────────────────────────────────────────────────────────────────────────

/** An inline run — the smallest styled unit both renderers understand. */
export interface Run {
  text: string
  bold?: boolean
  italic?: boolean
  href?: string
}

export interface SourceRef {
  title: string
  citation: string
  url: string
  snippet?: string
  date?: string
}

export type Block =
  /**
   * ══ 25-N §5c — A SECTION, WHOSE NAME IS REPEATED ON EVERY PAGE OF IT ═════════
   *
   * §5c: *"Sections, with the heading repeated in large bold type on every page of that
   * section, so a reader leafing through a hundred pages always knows where they are."*
   *
   * ⚠⚠ IT IS A BLOCK, NOT A PROPERTY OF A HEADING, and that is the whole design. A running
   * header is state that persists across pages; a `level: 1` heading is a mark at one point in
   * the flow. Making it a heading flag would mean every renderer had to remember which heading
   * it had passed most recently and hope no builder ever emitted two in a row — the renderers
   * would be inferring the document's structure from its typography. A `section` block SAYS it.
   *
   * ⚠ AND IT STARTS A NEW PAGE. A section whose name is stamped at the top of a page it starts
   * two thirds of the way down is a header describing the wrong half of the paper.
   */
  | { kind: 'section'; title: string }
  | { kind: 'heading'; level: 1 | 2 | 3; runs: Run[] }
  | { kind: 'paragraph'; runs: Run[] }
  | { kind: 'bullets'; items: Run[][]; ordered?: boolean }
  | { kind: 'sources'; label: string; refs: SourceRef[] }
  | { kind: 'note'; text: string }
  | { kind: 'rule' }

export interface DocumentModel {
  /** Document title, used as the H1 and as the file's own title metadata. */
  title: string
  subtitle?: string
  /** Human "generated from …" — shown in the document and next to the download. */
  sourceLabel: string
  generatedAt: Date
  blocks: Block[]
}

export function plain(text: string): Run[] {
  return [{ text }]
}

/** Flatten runs to plain text (used for measuring and for docx alt paths). */
export function runsToText(runs: Run[]): string {
  return runs.map((r) => r.text).join('')
}
