// ─────────────────────────────────────────────────────────────────────────────
// THE IDEA↔LAW JOIN — vocabulary, shapes and the words a reader gets (GRAPH 7).
//
// ⚠ THIS FILE IMPORTS NOTHING, on purpose (CLAUDE.md §28). The idea page's panel is a client component and
// needs these types and labels; the reader (`ideaLawSet` in statutory-graph.ts) needs the same lists. One
// definition, no edge into the database driver.
//
// ⚠ THE LISTS BELOW ARE ALSO DATABASE CHECK CONSTRAINTS (prisma/graph_7_idea_law_link.sql). The constraint is
// the enforcement; this copy is what the application speaks. `check:idea-law` reads the constraints back from
// pg_constraint and fails if the two ever disagree.
// ─────────────────────────────────────────────────────────────────────────────

/** How the idea stands to the law. The ORDER is the panel's order. */
export const LAW_RELATIONS = ['amends', 'repeals', 'modifies', 'relies_on', 'constrains', 'precedent', 'context'] as const
export type LawRelation = typeof LAW_RELATIONS[number]

export const LAW_SOURCES = ['hand', 'drafting_instruction', 'extraction'] as const
export type LawSource = typeof LAW_SOURCES[number]

export const LAW_TARGET_KINDS = ['act', 'provision', 'instrument', 'bill', 'document'] as const
export type LawTargetKind = typeof LAW_TARGET_KINDS[number]

/**
 * ⚠⚠ FOUR RESOLUTION STATES, NEVER COLLAPSED (BRIEF_GRAPH_7 §2, constraint g).
 * "We do not hold it", "it does not exist" and "we could not find out" are three different facts. An empty list
 * for any of them is the failure this project has already made twice.
 */
export type LawResolutionState = 'held' | 'named-not-held' | 'no-such-id' | 'lookup-failed'

export interface LawResolution {
  state: LawResolutionState
  /** In words: what was looked at, and what it said. */
  reason: string
  /** Display label, read from the corpus — never a stored key. */
  title: string | null
  /** The id form the corpus records this under, where it differs from the stored one (regnal Acts). */
  canonical: string | null
  /** Where the stored id was checked: our corpus, then (only on a miss) the publisher. */
  checkedAgainst: Array<'corpus' | 'legislation.gov.uk' | 'bills-api'>
  /**
   * The provision, separately from the Act. `unaddressable`: a Part or Chapter, which our corpus does not
   * hold as a row of its own; the Act is held and the provision is not checkable here. Said, never guessed.
   */
  provision: { path: string; ref: string; state: 'held' | 'not-held' | 'unaddressable'; reason: string } | null
}

/** GRAPH_6's per-type counts for one target, as the panel shows them — the change-the-words split, never a bare count. */
export interface LawEffectCounts {
  edgeType: string
  total: number
  textual: number
  notTextual: number
  unclassified: number
}

export interface LawEffectsSummary {
  /** Recorded changes made TO the target (inbound), from the official record. */
  perType: LawEffectCounts[]
  /** What those counts were read from, and how fresh it is — the reader's own caveat. */
  caveat: string
  rowsCounted: number
  /** A failure is said, never shown as zero. */
  failed: string | null
}

export interface IdeaLawRow {
  id: string
  ideaId: string
  /** ⚠ SURVIVES THE UNION (constraint c): which action, not merely that something does. */
  action: { id: string; number: number | null; title: string } | null
  targetKind: LawTargetKind
  docUri: string
  provisionPath: string | null
  relation: LawRelation
  source: LawSource
  sourceDetail: string | null
  note: string | null
  asAt: string
  createdAt: string
  resolution: LawResolution
  /** Only for amends / repeals rows on legislation that is HELD. Never for a Bill (constraint f). */
  effects: LawEffectsSummary | null
}

export interface IdeaLawSet {
  ideaId: string
  rows: IdeaLawRow[]
  grouped: Record<LawRelation, IdeaLawRow[]>
  freshness: {
    /** Oldest as_at in the set; null for an empty set. */
    asserted_as_at: string | null
    /** Rows whose target has a recorded change coming into force AFTER the date it was attached against. */
    changed_since: IdeaLawRow[]
    /** ⚠ What `changed_since` could see: the record's own last refresh. A change made after it is invisible. */
    recordRefreshedAt: string | null
    basis: string
  }
  /** Every row that is not `held`, each carrying its own state. Counted, never dropped. */
  unresolved: IdeaLawRow[]
  /** An action row whose action belongs to another idea. Should be empty; reported, never merged. */
  inconsistent: IdeaLawRow[]
  counts: Record<LawResolutionState, number>
  /** ⚠ WHAT WAS COUNTED (constraint h). */
  examined: { linkRows: number; superseded: number; effectRowsCounted: number }
}

/** What each relation group is, and what the panel shows under it. */
export const RELATION_GROUPS: Record<LawRelation, { heading: string; what: string; shows: string }> = {
  amends: {
    heading: 'Amends',
    what: 'the idea changes the words of this law',
    shows: 'the official record of changes already made to it, split by whether they changed the words',
  },
  repeals: {
    heading: 'Repeals',
    what: 'the idea removes this law',
    shows: 'the official record of changes already made to it, split by whether they changed the words',
  },
  modifies: {
    heading: 'Modifies (applies as if altered)',
    what: 'the idea applies this law as if it were altered, without changing its words',
    shows: 'the provision and the stated modification. This is the author’s own drafting choice, and it is kept apart from the official record’s “modifies” entries, which are often unclassified',
  },
  relies_on: {
    heading: 'Relies on',
    what: 'the idea uses a power or framework here without changing it',
    shows: 'the law relied on',
  },
  constrains: {
    heading: 'Constrains the idea',
    what: 'this law limits what the idea may do',
    shows: 'the constraint',
  },
  precedent: {
    heading: 'Precedent',
    what: 'this law already does something like this, elsewhere',
    shows: 'where the same mechanism has been drafted before',
  },
  context: {
    heading: 'Context',
    what: 'relevant, with no legal operation',
    shows: 'a link, nothing computed',
  },
}

/** ⚠ Constraint f, in the words it must render in. */
export const BILL_LABEL = 'before Parliament — not yet law'

export const RESOLUTION_WORDS: Record<LawResolutionState, string> = {
  held: 'held in our corpus',
  'named-not-held': 'named, not held — it exists, and we do not hold its text',
  'no-such-id': 'no such id — nothing exists under this identifier',
  'lookup-failed': 'lookup failed — we could not find out whether we hold it',
}

/** legislation.gov.uk's path segments, as stored: `section/149`, `schedule/2/paragraph/3`. */
export const PROVISION_PATH_SHAPE = /^[a-z]+\/[A-Za-z0-9]+(\/[a-z]+\/[A-Za-z0-9]+)*$/

/**
 * `section/149` → `section-149`: the form our corpus and the effects table record a provision under.
 * ⚠ Case is KEPT (the corpus holds `schedule-1-paragraph-14A`, `part-III`); every comparison is case-insensitive.
 */
export function provisionRefOf(path: string): string {
  return path.trim().replace(/\/+$/, '').split('/').join('-')
}

/** A Part, Chapter or cross-heading is not a row of its own in our corpus, so it cannot be checked there. */
export function isUnaddressableProvision(path: string): boolean {
  return /^(part|chapter|crossheading)\//i.test(path.trim())
}

/** The kind a stored id implies, for the hand path: the file names a doc_uri and a path, never a kind. */
export function targetKindOf(docUri: string, provisionPath: string | null): LawTargetKind {
  if (docUri.startsWith('bill/')) return 'bill'
  if (docUri.startsWith('doc/')) return 'document'
  if (provisionPath) return 'provision'
  // Secondary legislation types on legislation.gov.uk: statutory instruments and their devolved equivalents.
  return /^(uksi|ssi|wsi|nisr|nisi|uksro|ukmo|ukci|ssr|nisro)\//.test(docUri) ? 'instrument' : 'act'
}

export const emptyGroups = (): Record<LawRelation, IdeaLawRow[]> =>
  Object.fromEntries(LAW_RELATIONS.map((r) => [r, [] as IdeaLawRow[]])) as unknown as Record<LawRelation, IdeaLawRow[]>
