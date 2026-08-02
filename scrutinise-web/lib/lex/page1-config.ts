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

export type FieldType = 'narrative' | 'text' | 'structured' | 'loop' | 'inferred' | 'reference'

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
  /** Platform-authored question/prompt — the deterministic fallback Lex elaborates
   *  on. Guarantees the flow never stalls even if a Lex turn fails (§13 Task 3). */
  question?: string
  /** Where the accept surface renders. Defaults from origin (box → panel, proposed →
   *  chat) via acceptSurfaceOf; set explicitly only to override. */
  acceptSurface?: 'chat' | 'panel'
  /** Slot keys for a `structured` field (e.g. whoAffectedImpactCost). The value is a
   *  JSON object keyed by these; the panel renders one labelled input per slot. */
  slots?: string[]
}

/** Where a field's accept surface lives. Box-authored fields (narrative/structured/
 *  loop/reference) are their own accept surface in the Fields panel; Lex-proposed
 *  scalars (title/keywords/challenge/…) confirm inline in chat (the AcceptCard). */
export function acceptSurfaceOf(def: FieldDef): 'chat' | 'panel' {
  return def.acceptSurface ?? (def.origin === 'box' ? 'panel' : 'chat')
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
    question: "What's the problem or challenge you want to address?",
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
    question: 'Why does this matter to you, and what would success look like?',
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
    question:
      "Tell me a bit about you — your experience in this area and in politics, and what you're hoping Scrutinise can do for you.",
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
  // Sprint 1.4: aligned with the modal's "Basic idea" first-stage name (was "Getting started").
  label: 'The Basic Idea',
  fields: ORIENTATION_FIELDS,
}

// Pages 2–4 are built in later sprints — imported here so page1-config stays the
// single aggregation point every caller already imports from (no churn to importers).
// Each page-config imports only TYPES from here, so there is no runtime import cycle.
import { DIAGNOSIS_PAGE } from './page2-config'
import { GUIDING_POLICY_PAGE } from './page3-config'
import { COHERENT_ACTIONS_PAGE } from './page4-config'

// The ordered Lex pages that carry fields today (Sprint 3: the full kernel).
export const PAGE_SEQUENCE: PageDef[] = [
  ORIENTATION_PAGE,
  DIAGNOSIS_PAGE,
  GUIDING_POLICY_PAGE,
  COHERENT_ACTIONS_PAGE,
]

// No locked placeholder pages remain — the kernel is complete end-to-end (§19).
export const LOCKED_PAGES: { key: string; label: string }[] = []

/** Every field across all built pages, in page/field order. */
export const ALL_FIELDS: FieldDef[] = PAGE_SEQUENCE.flatMap((p) => p.fields)

/** Look up a field def by key across ALL pages (not just Page 1). */
export function fieldDef(key: string): FieldDef | undefined {
  return ALL_FIELDS.find((f) => f.key === key)
}

/** The page a field belongs to (or undefined). */
export function pageOf(key: string): PageDef | undefined {
  return PAGE_SEQUENCE.find((p) => p.fields.some((f) => f.key === key))
}

/** Index of a page key within PAGE_SEQUENCE (-1 if unknown / a locked page). */
export function pageSeqIndex(pageKey: string): number {
  return PAGE_SEQUENCE.findIndex((p) => p.key === pageKey)
}

export const PROPOSABLE_KEYS = new Set(ALL_FIELDS.filter((f) => f.origin === 'proposed').map((f) => f.key))
export const BOX_KEYS = new Set(ALL_FIELDS.filter((f) => f.origin === 'box').map((f) => f.key))
export const STRUCTURED_KEYS = new Set(ALL_FIELDS.filter((f) => f.type === 'structured').map((f) => f.key))

// ── Behind-the-box slots Lex extracts (§6.1). Stored, not carded. ────────────
// Idea-scoped slots seed Page 2 and calibrate Lex; user-scoped slots are reused.
export const IDEA_SLOT_KEYS = [
  'problemNarrative',
  'currentFraming',
  'motivation',
  'priorWork',
  'ideaGoal',
  // §16.1 cui bono: captured during the pivotalObstacle conversation, stored as a slot.
  'beneficiariesOfStatusQuo',
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

/** A cause classification (§16.1 — the Rumelt spine). */
export type CauseClassification = 'MATERIAL' | 'CONTRIBUTORY' | 'UNASSESSED'

/** A Page 2 causes-loop child record (§7.2 + §16.1/§16.2), as the panel renders it. */
export interface CanonicalCause {
  id: string
  cause: string
  whyPersisted: string | null
  evidence: string | null
  isRootCause: boolean
  classification: CauseClassification
  /** Causal-tree parent (§16.2); null = a root-level cause. */
  parentCauseId: string | null
  source: 'USER' | 'LEX_CORPUS'
}

/** A Page 3 guiding-policy option (§17), as the panel renders it. */
export interface CanonicalPolicyOption {
  id: string
  approach: string
  mechanismTypes: string[]
  targetCauseIds: string[]
  caseFor: string | null
  caseAgainst: string | null
  status: 'CANDIDATE' | 'CHOSEN' | 'RULED_OUT'
  ruleOutReason: string | null
  source: 'USER' | 'LEX'
}

/** A §18.2 cost range-with-basis. `priceYear` (COSTING_SCOPE §3) lets the estimator
 *  uprate the figure to a common price base before aggregating. */
export interface CostRange {
  low: number | null
  high: number | null
  unit: string | null
  basis: string | null
  benchmarkId?: string | null
  userOverride?: boolean
  priceYear?: number | null
}

/** A cost line under an action (§19-C Task 6) — the cost engine's unit of capture. */
export interface CanonicalCostLine {
  id: string
  actionId: string
  label: string
  costType: 'STAFF' | 'CAPITAL' | 'PROPERTY' | 'RESEARCH' | 'OTHER'
  category: 'IMPLEMENTATION' | 'ENFORCEMENT' | 'FRICTION'
  staffLevel: 'JUNIOR' | 'MID' | 'SENIOR' | null
  fteCount: number | null
  durationMonths: number | null
  low: number | null
  high: number | null
  unit: string | null
  basis: string | null
  benchmarkId: string | null
  priceYear: number | null
}

/** A Page 4 coherent action (§18.1), as the panel renders it. */
export interface CanonicalAction {
  id: string
  practicalStep: string
  mechanismType: string | null
  whoImplements: string | null
  targetOrganisation: string | null
  wording: string | null
  benefits: { financial?: string; social?: string; ongoing?: string } | null
  implementationCost: CostRange | null
  enforcementCost: CostRange | null
  regulatoryFriction: CostRange | null
  source: 'USER' | 'LEX'
}

/** A costing benchmark (§18.3 + COSTING_SCOPE §3) — a shared, sourced default value. */
export interface CanonicalBenchmark {
  id: string
  domain: string
  metric: string
  unit: string
  low: number | null
  high: number | null
  source: string
  sourceUrl: string | null
  year: number | null
  method: string | null
  notes: string | null
  priceYear: number | null
  category: string | null
  region: string | null
  uprateMethod: string | null
  confidence: string | null
}

export interface CanonicalState {
  ideaId: string
  /** The current Lex page the user is on (ORIENTATION | DIAGNOSIS | …). */
  stage: string
  /** Whether the current page is complete and the NEXT page is reachable but the user
   *  has not advanced yet — drives the "Continue to …" CTA. null when not applicable. */
  nextPage: { key: string; label: string } | null
  currentField: { key: string; status: FieldStatus } | null
  pages: CanonicalPage[]
  /** Page 2 causes-loop records (empty until Diagnosis). */
  diagnosisCauses: CanonicalCause[]
  /** Page 3 guiding-policy options (empty until Guiding Policy). */
  policyOptions: CanonicalPolicyOption[]
  /** Page 4 coherent-action records (empty until Coherent Actions). */
  actions: CanonicalAction[]
  /** §19-C Task 6 — cost lines across all of this idea's actions. */
  costLines: CanonicalCostLine[]
  /** Costing benchmarks available to the estimator (§18.3). */
  benchmarks: CanonicalBenchmark[]
  userProfile: {
    aboutYou: string | null
    experienceLevel: string | null
    slots: Record<string, unknown>
  }
  legislationRefs: SearchResult[]
  initialBackground: {
    documentId: string | null
    /** §19-C Task 1a — `failed` means the corpus search did not complete. The panel
     *  offers a Retry; it never shows substituted content. */
    status: 'pending' | 'ready' | 'failed'
    summary: string | null
    body: string | null
  } | null
  /** §19-C Task 2 — the ACTIVE stage's search, grouped for the panel. Earlier stages'
   *  results stay stored but fold away, so a later stage never shows an earlier
   *  stage's landscape as though it were current. */
  stageSearch: {
    stage: string
    intent: string
    ranAt: string
    ok: boolean
    resultCount: number
    groups: { key: string; label: string; results: SearchResult[] }[]
  } | null
  /** §19-C Task 1c — corpus searches the user asked for in chat ("Your research"). */
  research: { query: string; ranAt: string; ok: boolean; results: SearchResult[] }[]
}

// ── The FTS interface contract (§8.3). Stub now, real FTS in Sprint 3. ───────
export type SearchResultType =
  | 'PRIMARY_LEGISLATION'
  | 'STATUTORY_INSTRUMENT'
  | 'DEBATE'
  | 'COMMITTEE'
  | 'CASE_LAW'
  // Extended for the real FTS corpus (Charlie, 24 Jun 2026). The FTS corpus spans
  // families with no home in the original 5. Lex-side rendering (groupForPanel caps
  // per type generically; buildInitialBackground only narrates the original 4) should
  // be extended to surface these in the briefing prose.
  | 'GUIDANCE'       // regulator + soft-law (FCA/ICO/HMRC/Ofgem/Ofcom/law-coms/NAO/inquiries/sentencing/CPS/CoP)
  | 'EU_LEGISLATION' // retained-eu + eur-lex (operative law, neither Act nor SI)
  | 'BILL'           // bills-api (pre-enactment)
  | 'TREATY'         // uk-treaties + tax-treaties-dta

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
