// ─────────────────────────────────────────────────────────────────────────────
// 26-AB (decision 354) — THE ⓘ TEXT FOR THE BRIEF: for every Brief field (the common ones, then each kind's own), what it is, what Lex
// does with it, and an example. ONE source: the field guide attaches each entry to its `briefField.<key>` entry (so Lex's explain_field
// answers with these words), and BriefSection's ⓘ panels read the same table. Kept apart from field-guide.ts only so a client component
// can import these few lines without bundling the whole guide.
//
// ⚠ BRIEF_26AB §2 gives the Code text kind and the common fields VERBATIM; they are copied exactly. The specification and costing fields
//   are written to the same pattern (§2: "adapt the other kinds in the same pattern and report them").
// ⚠ Every example is generic, never a real user's words (CLAUDE.md §27).
// ⚠ 354 AMENDED (Charlie, 21 Nov 01:54): a FOURTH part, "Why it's needed", on every ⓘ, and "Optional: Lex will propose an answer" on
//   every optional field. Charlie's texts for Users / Records / Measures (one text, the three together), Basis and Price year are
//   VERBATIM; the rest are written to the same pattern and reported. Optional = a field whose emptiness has a stated meaning (Lex's
//   standard form, no listed points, not laid, no revision rule); the job, who issues it, whom it applies to, and the specification's
//   and costing's own fields are needed.
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
  /** 354 amended (Charlie, 21 Nov 01:54): why it's needed (one line). Shown fourth. */
  why: string
  /** The field may be left empty; then the panel ends "Optional: Lex will propose an answer" (it does: "Ask Lex to write the Brief"). */
  optional?: boolean
}

/** The four parts' headings, as the panel shows them, in order. */
export const INFO_PART_WORD = { what: 'What it is', lexDoes: 'What Lex does with it', example: 'Example', why: 'Why it’s needed' } as const
export const INFO_PARTS = ['what', 'lexDoes', 'example', 'why'] as const
/** 354 amended: the line on every optional field (Charlie's words). */
export const INFO_OPTIONAL_WORD = 'Optional: Lex will propose an answer'

/** The Brief heading's ⓘ: its sentence (§2, verbatim) and, as every ⓘ now has, why it's needed. */
export interface HeadingInfo { text: string; why: string }

export const BRIEF_FIELD_INFO: Record<keyof typeof BRIEF_FIELD_WORD, InfoText> = {
  // ── the common fields, every kind (§2, verbatim) ──
  must: {
    what: 'The job of the instrument in a few sentences: the problem it solves, whom it governs, what changes.',
    lexDoes: 'Reads this first; the draft\'s opening and principles come from it.',
    example: '"Sets the duties of every owner of a publicly funded task: one named owner, matched authority, candour."',
    why: "Without it there is nothing to draft from: every other field only refines this one.",
  },
  modelledOn: {
    what: 'An existing document whose structure and style the draft should follow: a source number from your Sources, or a corpus section. Leave empty for Lex\'s standard form.',
    lexDoes: 'Reads it in full and copies its shape, headings and register, not its content.',
    example: '"218" (a filed copy of an existing code)',
    why: "Following a document its readers already know makes the draft easier to read, check and accept.",
    optional: true,
  },
  tone: {
    what: 'The register: statutory, code, guidance, specification or plain rules.',
    lexDoes: 'Sets how duties are written: "You must …" for a code; "should" for guidance; numbered subsections for statutory text.',
    example: '"code"',
    why: "The register decides whether a provision binds or advises; the wrong one changes what the text means.",
    optional: true,
  },
  mustInclude: {
    what: 'Numbered points the draft must contain.',
    lexDoes: 'Each becomes at least one provision, and each provision names the point it came from.',
    example: '"One named owner for every task"',
    why: "It is how you make sure the points that matter to you are in the draft, each traceable to where it landed.",
    optional: true,
  },
  mustNot: {
    what: 'Things the draft must avoid.',
    lexDoes: 'Treated as limits; a draft that breaks one is flagged.',
    example: '"Create a new body"; "Add a separate reporting duty"',
    why: "It keeps out what you have already ruled out, so it does not have to be found and removed by hand.",
    optional: true,
  },
  // ── a code text's own fields (§2, verbatim) ──
  issuedBy: {
    what: 'Who formally issues the instrument.',
    lexDoes: 'Names them in the opening and as its authority.',
    example: '"The Minister for the Civil Service"',
    why: "An instrument says who issues it and on what authority; without that it cannot be issued.",
  },
  laidBefore: {
    what: 'The body it must be laid before, if any.',
    lexDoes: 'States the parliamentary step; "none" means it is not laid.',
    example: '"Both Houses of Parliament"',
    why: "Whether it is laid decides its parliamentary procedure, and the draft has to state it.",
    optional: true,
  },
  appliesTo: {
    what: 'Who must follow it.',
    lexDoes: 'Sets the scope paragraph and the definitions it needs.',
    example: '"Every publicly funded body, phased: departments first"',
    why: "A duty cannot be followed or enforced by people who cannot tell that it applies to them.",
  },
  revisionRule: {
    what: 'How, when and by whom it may be changed.',
    lexDoes: 'Writes the closing "changes to this code" section.',
    example: '"Revised only to improve the service; reviewed every three years; laid again when changed"',
    why: "A code with no rule for changing it either never changes or changes without scrutiny.",
    optional: true,
  },
  // ── a specification's own fields (adapted to §2's pattern) ──
  users: {
    what: 'Who will use the system the specification describes: the people and bodies who enter, read or act on what it holds.',
    lexDoes: 'Writes the users section, and states each requirement for the users it serves.',
    example: '"Case officers in every department; the public, read only"',
    why: "A system cannot be built or put out to tender without saying who uses it, what it holds and what it reports; these are the minimum a supplier asks for.",
  },
  records: {
    what: 'What the system must hold: each kind of record, and what each one carries.',
    lexDoes: 'Writes the data requirements: each record, what it holds and who may change it.',
    example: '"One record per publicly funded task: its owner, its budget and its status"',
    why: "A system cannot be built or put out to tender without saying who uses it, what it holds and what it reports; these are the minimum a supplier asks for.",
  },
  measures: {
    what: 'What the system must count or report, and how often.',
    lexDoes: 'Writes the reporting requirements, each saying what is counted and when.',
    example: '"Tasks without a named owner, counted each quarter"',
    why: "A system cannot be built or put out to tender without saying who uses it, what it holds and what it reports; these are the minimum a supplier asks for.",
  },
  // ── a costing's own fields (adapted to §2's pattern) ──
  basis: {
    what: 'What the figures rest on: where the costs come from, and the assumptions behind them.',
    lexDoes: 'States the basis in the costing\'s opening and carries each assumption into its notes; the figures themselves come only from the cost lines.',
    example: '"Unit costs from published statistics; each uplift stated as an assumption"',
    why: "The Green Book requires every figure to state its source, so it can be checked.",
  },
  priceYear: {
    what: 'The year whose prices the figures are given in.',
    lexDoes: 'States the price year beside the figures; each cost line keeps the year it was priced in.',
    example: '"2026-27 prices"',
    why: "The Green Book requires a price year; without it, figures from different years cannot be compared.",
  },
}

/** The ⓘ on the Brief heading itself (§2, verbatim). */
export const BRIEF_HEADING_INFO =
  'The Brief is your instruction for the draft. Lex drafts from it, and every draft records which version of the Brief it followed. Each save is a new version; earlier ones are kept.'
/** The heading's ⓘ as the panel and the guide carry it: the sentence, and why it's needed (354 amended). */
export const BRIEF_HEADING: HeadingInfo = {
  text: BRIEF_HEADING_INFO,
  why: 'Without a Brief, Lex drafts from its own reading of the action; with one, the draft follows your instructions and says which version it followed.',
}
