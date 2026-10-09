// ─────────────────────────────────────────────────────────────────────────────
// 26-R — THE REQUEST CONTRACT OF /api/ideas/[id]/research-notebook, ONE DEFINITION FOR THE ROUTE AND THE UI.
// Same reason as action-structure-schema.ts (CLAUDE.md §30): the client types every call against this with `import type`, so a
// wrong key is a compile error, and every rejection is worded by lib/api-rejection.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'

export const STANCES = ['SUPPORTS', 'CONTRADICTS', 'CONTEXT', 'UNDECIDED'] as const
export type Stance = (typeof STANCES)[number]
/** Shape AND word, never colour alone (CLAUDE.md §21). */
export const STANCE_LABEL: Record<Stance, string> = { SUPPORTS: 'Supports', CONTRADICTS: 'Contradicts', CONTEXT: 'Context', UNDECIDED: 'Undecided' }
export const STANCE_GLYPH: Record<Stance, string> = { SUPPORTS: '✓', CONTRADICTS: '✗', CONTEXT: '○', UNDECIDED: '?' }

export const BEARS_ON_KINDS = ['cause', 'policy', 'action', 'challenge', 'decision'] as const
export type BearsOnKind = (typeof BEARS_ON_KINDS)[number]
export const BEARS_ON_LABEL: Record<BearsOnKind, string> = { cause: 'Cause', policy: 'Policy', action: 'Action', challenge: 'Challenge', decision: 'Decision' }

export const NOTE_STATUSES = ['IN_RECORD', 'UNREVIEWED', 'SET_ASIDE'] as const
export type NoteStatus = (typeof NOTE_STATUSES)[number]
export const STATUS_LABEL: Record<NoteStatus, string> = { IN_RECORD: 'In the record', UNREVIEWED: 'Unreviewed', SET_ASIDE: 'Set aside' }

export const BearsOn = z.object({
  kind: z.enum(BEARS_ON_KINDS),
  /** The row's id (a cause id, policy option id, action id…). For `decision` and `challenge`, the id of that row. */
  id: z.string().min(1).max(100),
  label: z.string().max(200).optional(),
})
export type BearsOnRef = z.infer<typeof BearsOn>

const text = (max: number) => z.string().trim().max(max)
const ids = z.array(z.string().min(1)).min(1).max(300)

/** A source to create in the same act as the note — for "paste anything, name it later". */
export const NewSource = z.object({
  kind: z.enum(['URL', 'DOCUMENT', 'OWN_OBSERVATION']),
  title: z.string().trim().min(1).max(300),
  url: z.string().trim().max(2000).nullish(),
  author: z.string().trim().max(200).nullish(),
  publishedAt: z.string().trim().max(80).nullish(),
  sourceType: z.string().trim().max(60).nullish(),
  /** Set when the page/document text was actually read. A source with no read text is NOT_READ and says why. */
  readStatus: z.enum(['READ', 'NOT_READ']).optional(),
  readNote: z.string().trim().max(300).nullish(),
  /** The full text of a pasted document / fetched page, kept as the source's text and read into findings as uploads are. */
  fullText: z.string().max(200_000).nullish(),
  /** §25.6 — the user's own assertion that they may share what they are filing. REQUIRED whenever `fullText` is given. */
  rightsConfirmed: z.boolean().optional(),
})

export const NotebookBody = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('addNote'),
    /** Exactly one of: an existing registry source, a new one, or "my own observation". */
    sourceId: z.string().min(1).optional(),
    newSource: NewSource.optional(),
    ownObservation: z.boolean().optional(),
    quote: text(8000).nullish(),
    quoteLocation: text(200).nullish(),
    comment: text(8000).nullish(),
    stance: z.enum(STANCES).optional(),
    bearsOn: z.array(BearsOn).max(20).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    heading: text(80).nullish(),
    importance: z.number().int().min(1).max(3).nullish(),
    mineOnly: z.boolean().optional(),
  }),
  z.object({
    op: z.literal('updateNote'),
    noteId: z.string().min(1),
    quote: text(8000).nullish(),
    quoteLocation: text(200).nullish(),
    /** Only the note's AUTHOR may change this. Anyone else replies. */
    comment: text(8000).nullish(),
    stance: z.enum(STANCES).optional(),
    bearsOn: z.array(BearsOn).max(20).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    heading: text(80).nullish(),
    importance: z.number().int().min(1).max(3).nullish(),
  }),
  z.object({ op: z.literal('setStance'), noteIds: ids, stance: z.enum(STANCES) }),
  z.object({ op: z.literal('addTags'), noteIds: ids, tags: z.array(z.string().trim().min(1).max(40)).min(1).max(20) }),
  z.object({ op: z.literal('setHeading'), noteIds: ids, heading: text(80).nullable() }),
  z.object({ op: z.literal('setAside'), noteIds: ids, reason: z.string().trim().min(3).max(600) }),
  z.object({ op: z.literal('restore'), noteIds: ids }),
  /** The IDEA'S OWNER puts unreviewed notes (a team member's, or one Lex wrote) into the record — the only door to the documents. */
  z.object({ op: z.literal('putInRecord'), noteIds: ids }),
  z.object({ op: z.literal('reply'), noteId: z.string().min(1), text: z.string().trim().min(1).max(4000) }),
  z.object({ op: z.literal('share'), noteIds: ids }),
  z.object({ op: z.literal('makeMineOnly'), noteIds: ids }),
])
export type NotebookRequest = z.input<typeof NotebookBody>
export type NotebookOp = NotebookRequest['op']

export const OP_WORDS: Record<NotebookOp, string> = {
  addNote: '“Save” (add research)', updateNote: 'Saving the note', setStance: 'Setting the stance', addTags: 'Adding the tags',
  setHeading: 'Setting the heading', setAside: '“Set aside”', restore: '“Bring back into the record”', putInRecord: '“Put in the record”', reply: '“Reply”',
  share: '“Share with the team”', makeMineOnly: '“Make mine only”',
}
export const INPUT_WORDS: Record<string, string> = {
  sourceId: 'the source', newSource: 'the new source', ownObservation: 'the “my own observation” choice', quote: 'the quote', quoteLocation: 'where the quote is from',
  comment: 'your comment', stance: 'the stance', bearsOn: 'what it bears on', tags: 'the tags', heading: 'the heading', importance: 'the importance',
  noteId: 'the note', noteIds: 'the selected notes', reason: 'the reason', text: 'your reply', mineOnly: 'the mine-only choice', op: 'the control',
}

/** The registry-side contract: adding a source, archiving it, and Lex's snippet. */
export const RegistryBody = z.discriminatedUnion('op', [
  z.object({ op: z.literal('addSource'), source: NewSource.extend({ snippet: z.string().trim().max(2000).nullish(), citation: z.string().trim().max(500).nullish() }) }),
  z.object({ op: z.literal('archiveSource'), sourceId: z.string().min(1) }),
  z.object({ op: z.literal('setSnippet'), sourceId: z.string().min(1), snippet: z.string().trim().max(2000).nullable() }),
  /** Lex reads the page/document (or the text given) and writes a 20–80 word snippet. Spends a little. */
  z.object({ op: z.literal('createSnippet'), sourceId: z.string().min(1).optional(), url: z.string().trim().max(2000).optional(), text: z.string().max(200_000).optional(), title: z.string().trim().max(300).optional() }),
])
export type RegistryRequest = z.input<typeof RegistryBody>
export type RegistryOp = RegistryRequest['op']
export const REGISTRY_OP_WORDS: Record<RegistryOp, string> = {
  addSource: '“Add source”', archiveSource: '“Remove source”', setSnippet: 'Saving the snippet', createSnippet: '“Create snippet”',
}
export const REGISTRY_INPUT_WORDS: Record<string, string> = {
  source: 'the source', sourceId: 'the source', snippet: 'the snippet', url: 'the web address', text: 'the text', title: 'the title', op: 'the control',
}
