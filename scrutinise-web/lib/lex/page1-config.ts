// ─────────────────────────────────────────────────────────────────────────────
// Lex rebuild — Page 1 (Orientation) field configuration.
//
// SINGLE SOURCE OF TRUTH for the Page 1 field sequence, types, scope and origin.
// The server walks this to compute `currentField` and to advance the stage; the
// panels render whatever canonical state the server returns. Nothing here is a
// counter — "X of Y" is derived from field status on the client (§3.3).
//
// See docs/LEX_REBUILD_DESIGN.md §3, §6.
// ─────────────────────────────────────────────────────────────────────────────

export type FieldType = 'narrative' | 'text' | 'structured' | 'loop' | 'inferred'

/** Where the accepted value is persisted. `idea` → on the Idea; `user` → on the
 *  User profile (reused across every idea — Box 3). */
export type FieldScope = 'idea' | 'user'

/** How the field is filled.
 *  - `box`      : a free-text box the user authors directly (no accept card).
 *  - `proposed` : Lex proposes a value → confirmation card → user accepts/edits/declines. */
export type FieldOrigin = 'box' | 'proposed'

export type FieldStatus = 'EMPTY' | 'AWAITING_CONFIRMATION' | 'ACCEPTED' | 'SKIPPED'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  scope: FieldScope
  origin: FieldOrigin
  /** Side hint list shown beside a box (§6.4); also Lex's gap checklist. */
  hints?: string[]
  /** Required fields are highlighted in the UI; everything may still be skipped. */
  required?: boolean
}

export interface PageDef {
  key: string
  label: string
  fields: FieldDef[]
}

// ── Page 1 — Orientation ─────────────────────────────────────────────────────
// Order: per-idea boxes first (fresh each idea), profile box last (reused), then
// the two generated outputs. `keywords` accept fires the legislation search (§8.4).
export const ORIENTATION_FIELDS: FieldDef[] = [
  {
    key: 'ideaNarrative',
    label: 'The idea',
    type: 'narrative',
    scope: 'idea',
    origin: 'box',
    required: true,
    hints: [
      'what you want to change',
      'the problem as you see it',
      "who's affected",
      'rough scale or impact',
      'any costs you know of',
    ],
  },
  {
    key: 'youAndIdeaNarrative',
    label: 'You + the idea',
    type: 'narrative',
    scope: 'idea',
    origin: 'box',
    hints: [
      'why it matters to you',
      "anything you've already done, written, or researched (you can upload it)",
      'what success would look like',
    ],
  },
  {
    key: 'aboutYou',
    label: 'About you',
    type: 'narrative',
    scope: 'user',
    origin: 'box',
    hints: [
      'who you are',
      'your experience in this area',
      'your experience in politics generally',
      'your career',
      'whether you have a team or resources',
      'what you’re hoping Scrutinise can do for you',
    ],
  },
  {
    key: 'title',
    label: 'Title',
    type: 'text',
    scope: 'idea',
    origin: 'proposed',
    required: true,
  },
  {
    key: 'keywords',
    label: 'Keywords',
    type: 'structured',
    scope: 'idea',
    origin: 'proposed',
    required: true,
  },
]

export const ORIENTATION_PAGE: PageDef = {
  key: 'ORIENTATION',
  label: 'Getting started',
  fields: ORIENTATION_FIELDS,
}

// Later pages are built in subsequent sprints (§11). They render in Panel 2 as
// locked placeholders so the user can see the road ahead, but carry no fields yet.
export const LOCKED_PAGES: { key: string; label: string }[] = [
  { key: 'DIAGNOSIS', label: 'Diagnosis' },
  { key: 'GUIDING_POLICY', label: 'Guiding policy' },
  { key: 'COHERENT_ACTIONS', label: 'Coherent actions' },
]

export const PAGE_SEQUENCE = [ORIENTATION_PAGE]

/** The field whose status decides whether the page (and Page 1 overall) is done. */
export function fieldDef(key: string): FieldDef | undefined {
  return ORIENTATION_FIELDS.find((f) => f.key === key)
}

export const PROPOSABLE_KEYS = new Set(
  ORIENTATION_FIELDS.filter((f) => f.origin === 'proposed').map((f) => f.key),
)
export const BOX_KEYS = new Set(
  ORIENTATION_FIELDS.filter((f) => f.origin === 'box').map((f) => f.key),
)

// ── Behind-the-box slots Lex extracts (§6.1). Stored, not carded. ────────────
// Idea-scoped slots seed Page 2 and calibrate Lex; user-scoped slots are reused.
export const IDEA_SLOT_KEYS = [
  'problemNarrative',
  'currentFraming',
  'motivation',
  'priorWork',
  'ideaGoal',
] as const

export const USER_SLOT_KEYS = [
  'career',
  'resources',
  'legislativeKnowledge',
  'politicalLevel',
  'whatTheyWant',
] as const

export type IdeaSlotKey = (typeof IDEA_SLOT_KEYS)[number]
export type UserSlotKey = (typeof USER_SLOT_KEYS)[number]

// experienceLevel is the branch (§6.1): stored on the User, established early.
// Lex emits a coarse value; map it onto the existing ExperienceLevelEnum.
export const EXPERIENCE_LEVEL_MAP: Record<string, string> = {
  novice: 'NO_BACKGROUND',
  some: 'SECTOR_LIVED',
  expert: 'THINK_TANK_SENIOR',
}

// ── Canonical state shape returned by GET /api/ideas/{id}/state (§3.3) ───────
export interface CanonicalField {
  key: string
  label: string
  type: FieldType
  status: FieldStatus
  value: unknown | null
  proposal?: { value: unknown; rationale?: string } | null
}

export interface CanonicalPage {
  key: string
  label: string
  status: 'locked' | 'active' | 'complete'
  fields: CanonicalField[]
}

export interface CanonicalState {
  ideaId: string
  stage: string
  currentField: { key: string; status: FieldStatus } | null
  pages: CanonicalPage[]
  userProfile: {
    aboutYou: string | null
    experienceLevel: string | null
    slots: Record<string, unknown>
  }
  legislationRefs: SearchResult[]
  initialBackground: {
    documentId: string | null
    status: 'pending' | 'ready'
    summary: string | null
    body: string | null
  } | null
}

// ── The FTS interface contract (§8.3). Stub now, real FTS in Sprint 3. ───────
export type SearchResultType =
  | 'PRIMARY_LEGISLATION'
  | 'STATUTORY_INSTRUMENT'
  | 'DEBATE'
  | 'COMMITTEE'
  | 'CASE_LAW'

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  citation: string
  snippet: string
  score: number
  url: string
  date: string
}
