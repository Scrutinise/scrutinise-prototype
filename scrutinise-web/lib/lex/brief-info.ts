// ─────────────────────────────────────────────────────────────────────────────
// 26-AB (decision 354) — THE ⓘ TEXT FOR THE BRIEF: for every Brief field (the common ones, then each kind's own), what it is, what Lex
// does with it, and an example. ONE source: the field guide attaches each entry to its `briefField.<key>` entry (so Lex's explain_field
// answers with these words), and BriefSection's ⓘ panels read the same table. Kept apart from field-guide.ts only so a client component
// can import these few lines without bundling the whole guide.
//
// ⚠ BRIEF_26AB §2 gives the Code text kind and the common fields VERBATIM; they are copied exactly. The specification and costing fields
//   are written to the same pattern (§2: "adapt the other kinds in the same pattern and report them").
// ⚠ Every example is generic, never a real user's words (CLAUDE.md §27).
// ⚠ Typed `Record<keyof typeof BRIEF_FIELD_WORD, …>`: a Brief field added without its ⓘ text is a compile error, and check:lex-26ab
//   fails on an entry with an empty part.
// ⚠ PURE (CLAUDE.md §28).
// ─────────────────────────────────────────────────────────────────────────────

import type { BRIEF_FIELD_WORD } from './screen-labels'

export interface InfoText {
  /** What it is (one line). */
  what: string
  /** What Lex does with it (one line). */
  lexDoes: string
  /** An example (one line, generic). */
  example: string
}

/** The three parts' headings, as the panel shows them. */
export const INFO_PART_WORD = { what: 'What it is', lexDoes: 'What Lex does with it', example: 'Example' } as const

export const BRIEF_FIELD_INFO: Record<keyof typeof BRIEF_FIELD_WORD, InfoText> = {
  // ── the common fields, every kind (§2, verbatim) ──
  must: {
    what: 'The job of the instrument in a few sentences: the problem it solves, whom it governs, what changes.',
    lexDoes: 'Reads this first; the draft\'s opening and principles come from it.',
    example: '"Sets the duties of every owner of a publicly funded task: one named owner, matched authority, candour."',
  },
  modelledOn: {
    what: 'An existing document whose structure and style the draft should follow: a source number from your Sources, or a corpus section. Leave empty for Lex\'s standard form.',
    lexDoes: 'Reads it in full and copies its shape, headings and register, not its content.',
    example: '"218" (a filed copy of an existing code)',
  },
  tone: {
    what: 'The register: statutory, code, guidance, specification or plain rules.',
    lexDoes: 'Sets how duties are written: "You must …" for a code; "should" for guidance; numbered subsections for statutory text.',
    example: '"code"',
  },
  mustInclude: {
    what: 'Numbered points the draft must contain.',
    lexDoes: 'Each becomes at least one provision, and each provision names the point it came from.',
    example: '"One named owner for every task"',
  },
  mustNot: {
    what: 'Things the draft must avoid.',
    lexDoes: 'Treated as limits; a draft that breaks one is flagged.',
    example: '"Create a new body"; "Add a separate reporting duty"',
  },
  // ── a code text's own fields (§2, verbatim) ──
  issuedBy: {
    what: 'Who formally issues the instrument.',
    lexDoes: 'Names them in the opening and as its authority.',
    example: '"The Minister for the Civil Service"',
  },
  laidBefore: {
    what: 'The body it must be laid before, if any.',
    lexDoes: 'States the parliamentary step; "none" means it is not laid.',
    example: '"Both Houses of Parliament"',
  },
  appliesTo: {
    what: 'Who must follow it.',
    lexDoes: 'Sets the scope paragraph and the definitions it needs.',
    example: '"Every publicly funded body, phased: departments first"',
  },
  revisionRule: {
    what: 'How, when and by whom it may be changed.',
    lexDoes: 'Writes the closing "changes to this code" section.',
    example: '"Revised only to improve the service; reviewed every three years; laid again when changed"',
  },
  // ── a specification's own fields (adapted to §2's pattern) ──
  users: {
    what: 'Who will use the system the specification describes: the people and bodies who enter, read or act on what it holds.',
    lexDoes: 'Writes the users section, and states each requirement for the users it serves.',
    example: '"Case officers in every department; the public, read only"',
  },
  records: {
    what: 'What the system must hold: each kind of record, and what each one carries.',
    lexDoes: 'Writes the data requirements: each record, what it holds and who may change it.',
    example: '"One record per publicly funded task: its owner, its budget and its status"',
  },
  measures: {
    what: 'What the system must count or report, and how often.',
    lexDoes: 'Writes the reporting requirements, each saying what is counted and when.',
    example: '"Tasks without a named owner, counted each quarter"',
  },
  // ── a costing's own fields (adapted to §2's pattern) ──
  basis: {
    what: 'What the figures rest on: where the costs come from, and the assumptions behind them.',
    lexDoes: 'States the basis in the costing\'s opening and carries each assumption into its notes; the figures themselves come only from the cost lines.',
    example: '"Unit costs from published statistics; each uplift stated as an assumption"',
  },
  priceYear: {
    what: 'The year whose prices the figures are given in.',
    lexDoes: 'States the price year beside the figures; each cost line keeps the year it was priced in.',
    example: '"2026-27 prices"',
  },
}

/** The ⓘ on the Brief heading itself (§2, verbatim). */
export const BRIEF_HEADING_INFO =
  'The Brief is your instruction for the draft. Lex drafts from it, and every draft records which version of the Brief it followed. Each save is a new version; earlier ones are kept.'
