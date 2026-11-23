// LEX 26-AC part (a) — the scrutiny edition's row types and the checklist's shape. CLIENT-SAFE: no imports, so the owner's page (a client
// component) can read them without pulling the document builders (and the server modules behind them) into the browser bundle.
// lib/lex/scrutiny-edition-pure.ts re-exports all of it.

export const EDITION_STATUSES = ['DRAFT', 'PUBLISHED'] as const
export type EditionStatus = (typeof EDITION_STATUSES)[number]
export const NOTE_TARGETS = ['TOP', 'HEADING', 'ACTION'] as const
export type NoteTarget = (typeof NOTE_TARGETS)[number]
export const LINK_TARGETS = ['SUMMARY', 'HEADING', 'ACTION', 'DRAFT', 'NOTE'] as const
export type LinkTarget = (typeof LINK_TARGETS)[number]
export const LINK_STATUSES = ['PROPOSED', 'ACCEPTED', 'REJECTED'] as const
export type LinkStatus = (typeof LINK_STATUSES)[number]

export interface NoteRow { id: string; targetKind: NoteTarget; targetId: string | null; body: string; orderIndex: number; archivedAt: string | null }
/** `sourceNumber` / `sourceTitle` are the filed source's registry number and title, read with the link (the link stores the source's id). */
export interface LinkRow {
  id: string; targetKind: LinkTarget; targetId: string | null; claim: string | null; sourceId: string; sourceNumber: number | null; sourceTitle: string | null
  status: LinkStatus; proposedBy: 'LEX' | 'OWNER'; reason: string | null
}

export interface ChecklistItem { key: string; words: string }
export interface Checklist { unlinked: ChecklistItem[]; unaccepted: ChecklistItem[]; uncited: ChecklistItem[] }
export const checklistCount = (c: Checklist) => c.unlinked.length + c.unaccepted.length + c.uncited.length
/** What the edition records at publish: the checklist as it stood, and that the owner published it anyway. */
export interface PublishedChecklist extends Checklist { publishedAnyway: boolean; at: string }
