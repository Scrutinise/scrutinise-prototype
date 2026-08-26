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

import type { ScorerId } from './score-scope'

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
  /**
   * 25-H §1/§2 — A PROJECTION OF SOMETHING ELSE, NOT A BOX THE USER TYPES IN.
   *
   * A derived field is recomputed from its source on every canonical-state read, so an
   * edit to the source shows here immediately. The field machine REFUSES a write to one:
   * a rule that only the panel honoured would be a rule with the API route as its hole.
   *
   * Editing happens where the value lives — for page one, the elicitation pill (§3).
   */
  derived?: boolean
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
  // ══ 25-H §1/§2 — THE ELICITATION'S ANSWERS ARE PAGE ONE ═══════════════════
  //
  // One field per question asked, in the order they were asked, rather than the two
  // narrative blobs that preceded them. Charlie could not find "the new P1 fields"
  // because they were there — concatenated into `youAndIdeaNarrative`, under a heading
  // naming none of them.
  //
  // ⚠ ALL FOUR ARE `derived`. They are a PROJECTION of the elicitation, refreshed on every
  // canonical-state read (lib/lex/page-one.ts), and the field machine refuses a write to
  // them. Editing an answer happens where the answer lives — the pill on the build screen
  // (§3) — and the projection carries it here.
  {
    key: 'yourAccount',
    label: 'Your account',
    type: 'narrative',
    scope: 'idea',
    origin: 'box',
    derived: true,
    // ⚠ §2 — THE PROVENANCE RULE. Verbatim, never edited, never overwritten. This is
    // testimony, and it is the one thing in the kernel that must survive every rewrite.
    question: 'The problem in your own words, exactly as you wrote it.',
  },
  {
    key: 'yourGoal',
    label: 'What you want to happen',
    type: 'narrative',
    scope: 'idea',
    origin: 'box',
    derived: true,
    question: 'What you told me you want, and what you had already ruled out.',
  },
  {
    key: 'yourKnowledge',
    label: 'What you know at first hand',
    type: 'narrative',
    scope: 'idea',
    origin: 'box',
    derived: true,
    question: 'What you know that the record will not show.',
  },
  {
    key: 'yourReading',
    label: 'What you gave me to read',
    type: 'narrative',
    scope: 'idea',
    origin: 'box',
    derived: true,
    question: 'The documents and links you attached.',
  },
  {
    key: 'ideaNarrative',
    // ⚠ 25-H §2 — THIS IS NOW THE *AGREED* STATEMENT, NOT THE RAW ACCOUNT.
    // It is seeded once as a proposal from `yourAccount` and then owned by the user.
    // Before this sprint it held the verbatim problem AND was editable, so the first
    // edit destroyed the testimony with no copy anywhere.
    label: 'The idea, as agreed',
    type: 'narrative',
    scope: 'idea',
    origin: 'box',
    required: true,
    question: "What's the problem you want to fix?",
    hints: [
      'what you want to change',
      'the problem as you see it',
      "who's affected",
      'rough scale or impact',
      'any costs you know of',
    ],
  },
  // ⚠⚠ `youAndIdeaNarrative` ("You + the idea") WAS HERE AND IS RETIRED BY 25-H §1.
  //
  // It concatenated the goal, the ruled-outs, the own-knowledge and the reading into one
  // narrative blob — which is why the four answers were unfindable, and why editing any
  // one of them meant editing a paragraph that contained all four. The four `derived`
  // fields above replace it, one per question.
  //
  // ⚠ Removing a field needs Charlie's explicit instruction (docs/CLAUDE.md §11), and
  // BRIEF_25H §1 is it: "Retire the old fields — do not leave empty boxes that nothing
  // fills." `migrateLegacyPageOne` moves any content in existing ideas across first, and
  // reports the count.
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

/**
 * Fields whose CONTENT lives in child-entity tables (Cause / PolicyOption / Action) and is
 * written by their own endpoints — `/causes`, `/policy-options`, `/actions` — never by
 * `POST /fields`, which 422s them.
 *
 * ⚠ DEFINED HERE, AND IMPORTED BY BOTH SIDES, BECAUSE THE TWO COPIES DRIFTED APART.
 * `app/api/ideas/[id]/fields/route.ts` had this set privately, and the create client did not
 * know about it at all — so §19-D Task 9a's "Save & exit" cheerfully POSTed
 * `{fieldKey: 'policyOptions', action: 'accept'}` to `/fields` and took the 422 as a failed
 * save. Walk-through, 12 Aug: pressing **Save & exit** on the Guiding Policy page produced
 * *"That didn't save, so I've kept you here"* and the user could not leave except by Discard —
 * which is the exact symptom 9a was written to fix, moved one page along.
 *
 * ⚠ AND THE DIALOG WAS SAYING SOMETHING FALSE. *"'Candidate approaches' is waiting for you to
 * Save. Leave now and that draft is lost."* — the three approaches were already PolicyOption
 * rows in the database, and leaving loses nothing. `AWAITING_CONFIRMATION` on a loop field does
 * not mean "unsaved"; it means the user has not yet declared the list complete, which is a
 * decision to take on the way IN, not on the way out. So these fields are excluded from the
 * unsaved-draft test rather than given a save path: exiting must not silently advance a stage.
 */
export const CHILD_ENTITY_FIELDS: ReadonlySet<string> = new Set([
  'causes', 'rootCause', 'policyOptions', 'chosenApproach', 'actions',
])

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
  /** §19-D Task 3 — `visited` is new: a page the user has worked in and moved on from
   *  (or moved back past) which is NOT finished. Before back-navigation existed every
   *  page behind the pointer was necessarily complete, so the three states sufficed. */
  status: 'locked' | 'active' | 'visited' | 'complete'
  /** §19-D Task 3 — may the user move the working context INTO this page? True for the
   *  active page and every page at or before the furthest one reached. Deliberately
   *  separate from `status`: a half-finished page the user came back past is reachable
   *  AND not complete, and conflating the two is what made the flow one-way. */
  reachable: boolean
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
  // Tenth type (Charlie, 2026-08-10, BRIEF_SEARCH_S2C2 §1). explanatory-notes +
  // explanatory-memoranda — the departmental statement of what a provision was FOR, laid
  // alongside an Act or SI. S2C typed them GUIDANCE as an interim and said so; the reason that
  // could not stand is that "Guidance & regulators" tells a reader they are looking at a
  // regulator's soft law when they are looking at a statement of legislative intent. Presenting
  // one evidentiary class in another's costume is a correctness error in a product whose claim
  // is knowing exactly what the corpus says.
  // ⚠ NOT a legislation type, and that is load-bearing rather than tidy: `isLeg` in
  // fts-search.ts / vector-search.ts rewrites the title to the Act's and the URL to a
  // legislation.gov.uk PROVISION link, which would render an annotation as enacted text — a
  // worse error than the one this type fixes. `check:corpus-types` asserts it stays out.
  | 'EXPLANATORY_NOTE'
  // Eleventh, twelfth and thirteenth (CC-Search, 2026-08-12, BRIEF_SEARCH_S2C6 §1) — the four
  // V34 political-evidence corpora, taken as FOUR decisions rather than one sweep because they
  // are four different kinds of document that happen to have arrived together.
  //
  // ⚠ THE TEST APPLIED TO EACH WAS THE ONE THE TENTH TYPE ESTABLISHED: not "which existing label
  // is least wrong" but "would a reader shown this label form a false belief about what they are
  // reading". Three times the answer was yes, so three types.
  //
  // DIVISION — commons-divisions-votes + lords-divisions-votes. A roll-call: the named list of
  // who voted which way, with party at the date. The obvious home was DEBATE, and it fails on the
  // data: a Lords division's stored title is the bare bill name ("Employment Rights Bill"), so
  // under "Debates" it reads as a debate about that bill rather than the record of a vote on it.
  // A user citing it as "what was said" when it is "what was done" is the error.
  | 'DIVISION'
  // IMPACT_ASSESSMENT — the government's own statement of the problem, the options it weighed and
  // the effects it expected, laid alongside an instrument. GUIDANCE is wrong for the same reason
  // it was wrong for explanatory notes; and it is emphatically NOT a legislation type — see the
  // EXPLANATORY_NOTE note above, which applies here verbatim and is asserted the same way. An IA
  // is what a provision was PREDICTED to do; the note beside it is what it was FOR; the enacted
  // text is what it says. Three different claims, three different labels.
  | 'IMPACT_ASSESSMENT'
  // CONSULTATION — who was asked, what they said, and what the department did about it, before
  // the law existed. Distinct from an IA in kind and in the data: 0% carry a parent instrument
  // against the IA's 94.7%, because most consultations never become anything.
  | 'CONSULTATION'

export interface SearchResult {
  id: string
  type: SearchResultType
  title: string
  citation: string
  snippet: string
  score: number
  /** WHICH scorer produced `score` — bm25 / vector / rrf / stub. REQUIRED, so tsc is what
   *  enforces that a new retrieval path declares it rather than a lint rule nobody runs.
   *  Scores are only comparable within one scorer; see lib/lex/score-scope.ts for why, and
   *  for the only sanctioned way to sort by score. */
  scorer: ScorerId
  url: string
  date: string
  /** SURFACE 1 — repeal status, attached by the search gateway so every consumer of a
   *  SearchResult gets it without knowing it exists. UNDEFINED means the lookup failed and
   *  nothing may be claimed; `no-record` is an explicit finding and still NOT "in force".
   *  See lib/lex/repeal-status.ts. */
  repeal?: import('./repeal-status').RepealStatus
  /** S8 §2 — WHO SAID IT. Built by `attributionFor()` from the two structured columns
   *  (`corpus_sections.speaker` / `.attribution`) and from NOTHING ELSE — never parsed back
   *  out of `title`. NULL means the collection does not hold it structurally; it does NOT
   *  mean the source is anonymous. See lib/lex/attribution.ts. */
  attribution?: import('./attribution').Attribution | null
  /**
   * S13 §3 — WHETHER `snippet` IS THE PASSAGE THAT MATCHED, or the head of the document.
   *
   * Both retrieval services used to return `body.slice(0, 300)`: for a 5,714-word Lords speech
   * that is 0.9% of the document, from the top, whatever the question was. They now return the
   * passage carrying the query's own terms — the dense leg from the CHUNK the ANN actually
   * matched (`vector-core.ts::VecSectionHit.chunkId`), the sparse leg by locating the terms in
   * the body — both through the one shared selector, `scripts/ingest/search/passage.ts`.
   *
   * ⚠ FALSE MEANS NO QUERY TERM COULD BE LOCATED and `snippet` is the old head-of-document text.
   * It is NOT a claim that the document is irrelevant, and it must never be rendered as though
   * it were the matched passage. UNDEFINED means the service predates this field — an older
   * `fts-serve`/`vector-serve` build — which is a THIRD state and is why this is not a bare
   * boolean defaulting to false (CLAUDE.md §18: OFF, FAILED and NOT-MEASURED must not look alike).
   */
  snippetMatched?: boolean
  /** Where in the document the passage sits, in readable words ("about 62% of the way through").
   *  Null/undefined when there is no located passage to place. */
  snippetLocation?: string | null
}
