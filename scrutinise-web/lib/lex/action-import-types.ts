// ─────────────────────────────────────────────────────────────────────────────
// 26-S §3 — THE SHAPE OF THE REVIEW TABLE, AND THE WORDS THE SCREEN PRINTS FOR IT.
//
// ⚠ NO IMPORTS. A `'use client'` file's value imports are followed into the browser bundle (docs/CLAUDE.md §28), and the panel
// needs these constants. The server module (`action-import.ts`) imports Prisma; this one must never.
// ─────────────────────────────────────────────────────────────────────────────

/** The words the user knows each control by, for the rejection sentence (docs/CLAUDE.md §30). Keyed by the request's `op`. */
export const IMPORT_OP_WORDS: Record<'start' | 'advance' | 'edit' | 'confirm' | 'discard', string> = {
  start: '“Import actions from a document”', advance: 'Reading the document', edit: 'Saving your changes to the table',
  confirm: 'Confirming the import', discard: 'Discarding the import',
}

export const IMPORT_INPUT_WORDS: Record<string, string> = {
  sourceNumber: 'the document’s number', passId: 'the import', items: 'the rows you changed', existing: 'the headings for the existing actions',
  headings: 'the proposed headings', op: 'the control', itemId: 'the row', patch: 'the change to the row', title: 'the title', summary: 'the summary',
  implementer: 'the implementer', proposal: 'the proposal', headingName: 'the heading', actionNumber: 'the action number', purpose: 'the purpose paragraph',
  actionId: 'the action', proposedHeading: 'the heading', name: 'the heading name',
}

/** What the pass proposes to do with one item of the document (BRIEF_26S §3c). */
export type ProposalKind = 'NEW' | 'ADDS_TO' | 'PART_OF' | 'POLICY' | 'NOT_ACTION' | 'UNPLACED'
export const PROPOSAL_KINDS: readonly ProposalKind[] = ['NEW', 'ADDS_TO', 'PART_OF', 'POLICY', 'NOT_ACTION', 'UNPLACED']

/** The words in the Proposal column. `{h}` is the heading, `{n}` an action number. */
export const PROPOSAL_WORDS: Record<ProposalKind, string> = {
  NEW: 'New action',
  ADDS_TO: 'Adds to',
  PART_OF: 'Part of',
  POLICY: 'For the policy, not an action',
  NOT_ACTION: 'Not an action',
  UNPLACED: 'Could not place — needs you',
}

/** A glyph per kind, so no state is colour alone (docs/CLAUDE.md §21). */
export const PROPOSAL_GLYPH: Record<ProposalKind, string> = { NEW: '＋', ADDS_TO: '⊕', PART_OF: '⊂', POLICY: '§', NOT_ACTION: '–', UNPLACED: '?' }

export type PolicyVerdict = 'FITS' | 'DOES_NOT_FIT' | 'CONFLICTS' | 'NOT_TESTED'

/** The five categories of the 26-K update pass, so a policy-level item lands where the policy review already looks. */
export type PolicyCategory = 'SUPPORTS' | 'CONTRADICTS' | 'NEW_CAUSE' | 'NEW_POLICY_OPTION'

export interface ImportItem {
  id: string
  /** Index into `mapping.chunks`. */
  chunk: number
  /** The document's own reference for where the item is: "§5.1", "Clause 3", "table row 4". */
  section: string
  /** The DOCUMENT'S words (<= 60). Only ever a span the stored text really contains — see `quoteVerified`. */
  quote: string
  /** false = the model's string could not be found word for word in the document, so it is shown labelled as Lex's wording. */
  quoteVerified: boolean
  proposal: ProposalKind
  /** NEW: the heading it goes under — an existing heading's name or one of `mapping.headings`. */
  headingName: string | null
  /** ADDS_TO / PART_OF: the number of the existing action. */
  actionNumber: number | null
  /** Why — for Not an action, Could not place and the policy kinds; for the others, what Lex noticed. */
  reason: string
  policyTest: { verdict: PolicyVerdict; reason: string } | null
  /** Lex's wording (labelled as such on screen): <= 12 words, in the idea's voice. */
  title: string
  /** Lex's wording: one line. */
  summary: string
  implementer: string | null
  /** POLICY only: the 26-K category and what it bears on ('causes:3', 'policyOptions:2', 'pivotalObstacle', 'challenge'). */
  policyCategory: PolicyCategory | null
  policyTarget: string | null
  /** Struck by the user: not imported. The row stays in the table, so the review shows what was set aside. */
  struck: boolean
  /** The user changed something on this row. Their edit is never overwritten by a later step. */
  edited: boolean
}

export interface ImportExisting {
  actionId: string
  number: number | null
  label: string
  currentHeading: string | null
  /** null = no change. */
  proposedHeading: string | null
}

export interface ImportHeading {
  name: string
  colourKey: string
  /** <= 120 words. Empty until written. */
  purpose: string
  /** true = does not exist on this idea yet and is created on confirm. */
  isNew: boolean
  /** The user struck a proposed new heading: the actions proposed under it are left without one. */
  struck: boolean
}

export interface ImportChunk {
  index: number
  label: string
  /** Character offsets into the stored text, so a resumed pass chunks identically. */
  from: number
  to: number
  status: 'PENDING' | 'DONE' | 'FAILED'
  itemCount: number
  /** Calls made on this chunk. A transient failure is tried once more; a second names itself and ends the pass. */
  tries: number
  error: string | null
}

export type ImportStage = 'ITEMS' | 'STRUCTURE' | 'POLICY_TEST' | 'DONE'

export interface ImportMapping {
  version: 1
  sourceTitle: string
  chunks: ImportChunk[]
  stage: ImportStage
  items: ImportItem[]
  existing: ImportExisting[]
  headings: ImportHeading[]
  /** Passages that read as proposals and are inside no row's quote. A count and a list — never silently rows. */
  uncovered: Array<{ section: string; text: string }>
  /** The accepted Guiding Policy the test used, or null with the reason it was not run. */
  guidingPolicy: string | null
  policyTestNote: string | null
  /** Next item index the policy test has not yet covered. */
  policyTestCursor: number
  model: string
}

/** CONFIRMING is the lock a confirm takes, so two clicks (or two tabs) cannot write the rows twice. */
export type ImportStatus = 'MAPPING' | 'READY' | 'CONFIRMING' | 'CONFIRMED' | 'FAILED' | 'DISCARDED'

/** What the panel reads: the pass row without the machinery. */
export interface ImportPassView {
  id: string
  status: ImportStatus
  sourceNumber: number
  chunkCount: number
  chunksDone: number
  spentPence: number | null
  failure: string | null
  mapping: ImportMapping
  result: ImportResult | null
  createdAt: string
}

export interface ImportCounts { newActions: number; addsTo: number; partOf: number; forPolicy: number; notAction: number; unplaced: number; struck: number }

export interface ImportResult {
  created: Array<{ id: string; number: number | null; title: string }>
  addedTo: number[]
  findings: number
  headingsCreated: string[]
  reheaded: number
  counts: ImportCounts
  at: string
}

/** The tallies on the confirm card, counted from the table AS EDITED (a struck row is not counted). */
export function countItems(items: readonly ImportItem[]): ImportCounts {
  const c: ImportCounts = { newActions: 0, addsTo: 0, partOf: 0, forPolicy: 0, notAction: 0, unplaced: 0, struck: 0 }
  for (const it of items) {
    if (it.struck) { c.struck++; continue }
    if (it.proposal === 'NEW') c.newActions++
    else if (it.proposal === 'ADDS_TO') c.addsTo++
    else if (it.proposal === 'PART_OF') c.partOf++
    else if (it.proposal === 'POLICY') c.forPolicy++
    else if (it.proposal === 'NOT_ACTION') c.notAction++
    else c.unplaced++
  }
  return c
}

/** "Import 41 actions · add to 8 · send 5 to the policy" — the confirm card's sentence (BRIEF_26S §3d), minus the price. */
export function confirmSentence(c: ImportCounts): string {
  const enrich = c.addsTo + c.partOf
  return `Import ${c.newActions} action${c.newActions === 1 ? '' : 's'} · add to ${enrich} · send ${c.forPolicy} to the policy`
}

/** The provenance line written on every new row (BRIEF_26S §3e). */
export const provenanceLine = (sourceNumber: number, section: string): string => `From: [Ref: ${sourceNumber}] ${section}`.trim()

/**
 * ⚠ WHAT AN IMPORT COSTS — MEASURED, NOT GUESSED (CLAUDE.md §19). Every figure is the ledger sum of a REAL run of the whole pass
 * (chunks + headings + policy test) on a scratch copy of idea 452c5ade with the hand-made blueprint fixture filed as a source
 * (scripts/verify-lex-26s-run.ts). The price scales with the document, so the card quotes a rate per 1,000 words, and says how many
 * runs it rests on. ONE run is a sample, not a mean: the card says "n=1" in so many words.
 */
export const IMPORT_RUNS: ReadonlyArray<{ words: number; pence: number; on: string }> = [
  { words: 1620, pence: 21.4, on: '2026-10-15' }, // 3 parts of ~900 words, 46 rows (verify-lex-26s-run.ts)
  { words: 1620, pence: 22.1, on: '2026-10-15' }, // 3 parts, 47 rows (inside check:lex-26s --live)
  { words: 1620, pence: 21.2, on: '2026-10-15' }, // ONE part of 1,620 words, 47 rows — the single-pass comparison (report §E)
]
export const importPenceFor = (words: number): { pence: number; basis: string } => {
  const w = IMPORT_RUNS.reduce((a, r) => a + r.words, 0), p = IMPORT_RUNS.reduce((a, r) => a + r.pence, 0)
  return {
    pence: Math.max(1, Math.round((p / w) * Math.max(words, 1) * 10) / 10),
    basis: `measured, ${IMPORT_RUNS.length === 1 ? 'n=1' : `mean of n=${IMPORT_RUNS.length}`} real run${IMPORT_RUNS.length === 1 ? '' : 's'} on a shorter document, scaled by length — ${IMPORT_RUNS[IMPORT_RUNS.length - 1].on}`,
  }
}

/** A filed document the import can read: a numbered, READ source with stored text. */
export interface ImportableSource { number: number; title: string; words: number; estimatePence: number; basis: string }

/** How many words a heading's purpose may run to (decision 141). */
export const PURPOSE_MAX_WORDS = 120
export const wordCount = (s: string): number => (s.trim() ? s.trim().split(/\s+/).length : 0)
