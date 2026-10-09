// ─────────────────────────────────────────────────────────────────────────────
// 26-Q §4–§6 — THE PURE HALF OF "A LONG LIST OF ACTIONS, WORKABLE": facets, regrouping, the coverage grid, the sequence
// layout, and the duplicate ranking. No database, no model, no imports — so the client component, the routes, the Lex
// tools and `check:lex-26q` all call THE SAME functions (docs/CLAUDE.md §26.5: one definition) and a client bundle stays
// clean (§28).
//
// ⚠ ONE HEADING PER ACTION IS THE USER'S STRUCTURE; FACETS ARE THE PLATFORM'S, and several can be sorted by at once. Nothing
// here moves an action between headings — regrouping is a VIEW.
// ─────────────────────────────────────────────────────────────────────────────

export const AVENUES = ['LEGISLATIVE', 'ORGANISATIONAL', 'FINANCIAL'] as const
export type Avenue = (typeof AVENUES)[number]
export const AVENUE_LABEL: Record<Avenue, string> = { LEGISLATIVE: 'Legislative', ORGANISATIONAL: 'Organisational', FINANCIAL: 'Financial' }

export const SEQUENCES = ['NOW', 'NEXT', 'LATER'] as const
export type Sequence = (typeof SEQUENCES)[number]
export const SEQUENCE_LABEL: Record<Sequence, string> = { NOW: 'Now', NEXT: 'Next', LATER: 'Later' }

export const GROUP_MODES = ['heading', 'cause', 'link', 'avenue', 'sequence', 'policy-test'] as const
export type GroupMode = (typeof GROUP_MODES)[number]
export const GROUP_MODE_LABEL: Record<GroupMode, string> = { heading: 'By heading', cause: 'By cause', link: 'By link', avenue: 'By avenue', sequence: 'By sequence', 'policy-test': 'By policy test' }

// ══ DECISION 138 (9 Oct 2026) — THE POLICY TEST, IN THE ONE LIST ═══════════════════════════════════════════════
// What the consolidation's test said about an action against the settled guiding policy. A verdict is a WORD AND A SHAPE OF A DIFFERENT
// KIND, never colour alone (docs/CLAUDE.md §21; Charlie is colour blind): ✗ Conflicts · ○ Does not fit · ? Not tested · ✓ Fits.
// The order is the order they are LISTED in: the worst first, so a conflict is never the last thing a reader reaches.
export const POLICY_VERDICTS = ['CONFLICTS', 'DOES_NOT_FIT', 'NOT_TESTED', 'FITS'] as const
export type PolicyVerdict = (typeof POLICY_VERDICTS)[number]
export const POLICY_VERDICT_UI: Record<PolicyVerdict, { glyph: string; word: string }> = {
  CONFLICTS: { glyph: '✗', word: 'Conflicts' },
  DOES_NOT_FIT: { glyph: '○', word: 'Does not fit' },
  NOT_TESTED: { glyph: '?', word: 'Not tested' },
  FITS: { glyph: '✓', word: 'Fits' },
}
export interface PolicyTest { verdict: PolicyVerdict; reason: string | null; from: string[] }
/** An action the consolidation never tested (the user's own, or from another route) says so in words — it is never shown as fitting. */
export const NOT_IN_POLICY_TEST = 'Not part of the consolidation’s policy test'

export interface ActionLike {
  id: string
  number: number | null
  title: string | null
  practicalStep: string
  whoImplements: string | null
  wording: string | null
  headingId: string | null
  targetCauseIds: string[]
  avenue: string | null
  link: string | null
  sequence: string | null
  beforeIds: string[]
  /** Decision 138 — null/absent = never went through the consolidation's policy test. */
  policyTest?: PolicyTest | null
}
export interface CauseLike { id: string; number: number | null; cause: string }
export interface HeadingLike { id: string; name: string; colourKey: string; hidden: boolean; orderIndex: number }

/** What a line shows first: the title where there is one, else the first words of the action. */
export function actionLabel(a: Pick<ActionLike, 'title' | 'practicalStep'>, max = 90): string {
  const t = a.title?.trim()
  if (t) return t
  const s = a.practicalStep.replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

/** §4 "Specific enough?" — has draft text or a named implementer, or not yet. Derived, never stored. */
export const specificEnough = (a: Pick<ActionLike, 'wording' | 'whoImplements'>): boolean => !!(a.wording?.trim() || a.whoImplements?.trim())

// ── regrouping (§4: "switch the list's grouping to any facet with one control") ─────────────────────────────────

export interface ActionGroup<T> {
  key: string
  label: string
  /** Only for a heading group — the colour key, so the trim and glyph can be drawn. */
  colourKey?: string
  /** A heading group the user has hidden (the header stays; the rows are not shown). */
  hidden?: boolean
  actions: T[]
}

/**
 * Group the actions (in the order given — the user's order is preserved WITHIN every group) by a facet. An action with
 * several causes appears under its FIRST recorded cause only (the coverage grid is where many-to-many is shown); a group
 * that would be empty is not returned, except a heading group — an empty heading still shows, with a count of 0, because
 * the user made it.
 */
export function groupActions<T extends ActionLike>(
  actions: readonly T[], mode: GroupMode, ctx: { headings: readonly HeadingLike[]; causes: readonly CauseLike[] },
): Array<ActionGroup<T>> {
  const out: Array<ActionGroup<T>> = []
  const bucket = (key: string, label: string, extra: Partial<ActionGroup<T>> = {}) => {
    let g = out.find((x) => x.key === key)
    if (!g) { g = { key, label, actions: [], ...extra }; out.push(g) }
    return g
  }
  if (mode === 'heading') {
    for (const h of [...ctx.headings].sort((a, b) => a.orderIndex - b.orderIndex)) bucket(`h:${h.id}`, h.name, { colourKey: h.colourKey, hidden: h.hidden })
    for (const a of actions) {
      const h = ctx.headings.find((x) => x.id === a.headingId)
      if (h) bucket(`h:${h.id}`, h.name).actions.push(a)
      else bucket('none', 'No heading').actions.push(a)
    }
    return out.filter((g) => g.actions.length || g.key.startsWith('h:'))
  }
  if (mode === 'cause') {
    const order = [...ctx.causes].sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9))
    for (const a of actions) {
      const first = order.find((c) => a.targetCauseIds.includes(c.id))
      if (first) bucket(`c:${first.id}`, `Cause ${first.number ?? '?'}: ${first.cause}`).actions.push(a)
      else bucket('none', 'No cause recorded').actions.push(a)
    }
    return out.sort((x, y) => orderOf(x.key, order.map((c) => `c:${c.id}`)) - orderOf(y.key, order.map((c) => `c:${c.id}`)))
  }
  if (mode === 'policy-test') {
    // The four verdicts always head the list in their fixed order — a conflict first — and an action that never went through the test
    // lands in a group that says so, last. (Empty verdict groups are not returned; an empty "Conflicts" is simply good news.)
    for (const a of actions) {
      const v = a.policyTest?.verdict
      if (v && POLICY_VERDICTS.includes(v)) bucket(`pt:${v}`, `${POLICY_VERDICT_UI[v].glyph} ${POLICY_VERDICT_UI[v].word}`).actions.push(a)
      else bucket('none', NOT_IN_POLICY_TEST).actions.push(a)
    }
    return out.sort((x, y) => orderOf(x.key, POLICY_VERDICTS.map((v) => `pt:${v}`)) - orderOf(y.key, POLICY_VERDICTS.map((v) => `pt:${v}`)))
  }
  if (mode === 'avenue') {
    for (const a of actions) {
      const v = AVENUES.find((x) => x === a.avenue)
      if (v) bucket(`a:${v}`, AVENUE_LABEL[v]).actions.push(a)
      else bucket('none', 'No avenue assigned').actions.push(a)
    }
    return out.sort((x, y) => orderOf(x.key, AVENUES.map((v) => `a:${v}`)) - orderOf(y.key, AVENUES.map((v) => `a:${v}`)))
  }
  if (mode === 'sequence') {
    for (const a of actions) {
      const v = SEQUENCES.find((x) => x === a.sequence)
      if (v) bucket(`s:${v}`, SEQUENCE_LABEL[v]).actions.push(a)
      else bucket('none', 'Not placed in the sequence').actions.push(a)
    }
    return out.sort((x, y) => orderOf(x.key, SEQUENCES.map((v) => `s:${v}`)) - orderOf(y.key, SEQUENCES.map((v) => `s:${v}`)))
  }
  // link — distinct link wordings, alphabetical, then none
  for (const a of actions) {
    const l = a.link?.trim()
    if (l) bucket(`l:${l.toLowerCase()}`, l).actions.push(a)
    else bucket('none', 'No link recorded').actions.push(a)
  }
  return out.sort((x, y) => (x.key === 'none' ? 1 : y.key === 'none' ? -1 : x.label.localeCompare(y.label)))
}
function orderOf(key: string, order: string[]): number { const i = order.indexOf(key); return i < 0 ? 1e6 : i }

// ── §6a — the coverage grid: causes × actions ────────────────────────────────────────────────────────────────

export interface CoverageGrid {
  causes: Array<{ id: string; number: number | null; cause: string; actionIds: string[] }>
  /** Causes with NO action attacking them — the gap check's free test, from a RECORDED link rather than a keyword guess. */
  uncovered: Array<{ id: string; number: number | null; cause: string }>
  /** Actions with no recorded cause: the grid cannot place them, and says so. */
  unlinkedActionIds: string[]
  /** How many actions carry a recorded cause link, of how many — so a grid built on three links is not read as a verdict. */
  recorded: { linked: number; total: number }
}

export function coverageGrid(actions: readonly Pick<ActionLike, 'id' | 'targetCauseIds'>[], causes: readonly CauseLike[]): CoverageGrid {
  const known = new Set(causes.map((c) => c.id))
  const rows = [...causes].sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9)).map((c) => ({
    id: c.id, number: c.number, cause: c.cause,
    actionIds: actions.filter((a) => a.targetCauseIds.includes(c.id)).map((a) => a.id),
  }))
  const linked = actions.filter((a) => a.targetCauseIds.some((id) => known.has(id)))
  return {
    causes: rows,
    uncovered: rows.filter((r) => r.actionIds.length === 0).map(({ id, number, cause }) => ({ id, number, cause })),
    unlinkedActionIds: actions.filter((a) => !a.targetCauseIds.some((id) => known.has(id))).map((a) => a.id),
    recorded: { linked: linked.length, total: actions.length },
  }
}

// ── §6b — the sequence view: now / next / later, with BEFORE arrows ──────────────────────────────────────────

export interface SequenceLayout<T> {
  columns: Record<Sequence | 'UNPLACED', T[]>
  /** from must come before to */
  edges: Array<{ from: string; to: string }>
  /** Edges that point at an action not on the list (ruled out since) — reported, not drawn. */
  danglingEdges: Array<{ from: string; to: string }>
  /** Action ids that sit on a cycle (A before B before A): an impossible order, shown rather than hidden. */
  onCycle: string[]
  /** Edges that run AGAINST the columns (a "later" action that must come before a "now" one). */
  contradictions: Array<{ from: string; to: string }>
  /** How many actions each one (transitively) unlocks. Rumelt's proximate objective: achievable first AND unlocks the rest. */
  unlocks: Record<string, number>
  /** The actions to start with: placed NOW (or unplaced) that unlock the most, most first. */
  startWith: string[]
}

export function sequenceLayout<T extends ActionLike>(actions: readonly T[]): SequenceLayout<T> {
  const ids = new Set(actions.map((a) => a.id))
  const columns: SequenceLayout<T>['columns'] = { NOW: [], NEXT: [], LATER: [], UNPLACED: [] }
  for (const a of actions) {
    const s = SEQUENCES.find((x) => x === a.sequence)
    columns[s ?? 'UNPLACED'].push(a)
  }
  const edges: Array<{ from: string; to: string }> = []
  const danglingEdges: Array<{ from: string; to: string }> = []
  for (const a of actions) for (const to of a.beforeIds) (ids.has(to) && to !== a.id ? edges : danglingEdges).push({ from: a.id, to })
  const next = new Map<string, string[]>()
  for (const e of edges) next.set(e.from, [...(next.get(e.from) ?? []), e.to])
  const reach = (start: string): Set<string> => {
    const seen = new Set<string>(); const stack = [...(next.get(start) ?? [])]
    while (stack.length) { const n = stack.pop()!; if (seen.has(n)) continue; seen.add(n); for (const m of next.get(n) ?? []) stack.push(m) }
    return seen
  }
  const unlocks: Record<string, number> = {}
  const onCycle: string[] = []
  for (const a of actions) { const r = reach(a.id); unlocks[a.id] = r.size - (r.has(a.id) ? 1 : 0); if (r.has(a.id)) onCycle.push(a.id) }
  const rank: Record<string, number> = { NOW: 0, NEXT: 1, LATER: 2 }
  const byId = new Map(actions.map((a) => [a.id, a]))
  const contradictions = edges.filter((e) => {
    const f = rank[byId.get(e.from)?.sequence ?? ''], t = rank[byId.get(e.to)?.sequence ?? '']
    return f !== undefined && t !== undefined && f > t
  })
  const startWith = actions
    .filter((a) => (a.sequence === 'NOW' || !a.sequence) && unlocks[a.id] > 0 && !onCycle.includes(a.id))
    .sort((x, y) => unlocks[y.id] - unlocks[x.id])
    .map((a) => a.id)
  return { columns, edges, danglingEdges, onCycle, contradictions, unlocks, startWith }
}

// ── §5b — "Find duplicates": the closest pairs first, ignoring what every action attacks ────────────────────

/** 26-L §9 for policies: a cause attacked by this share of the live list or more tells you nothing about two of them. */
export const UNIVERSAL_CAUSE_THRESHOLD = 0.8
/** Below this many linked actions there is no "everything" to ignore. */
export const UNIVERSAL_MIN_ACTIONS = 5

const STOP = new Set('about above after again against also among because been before being between both could does doing during each from have having into more most must other over same should some such than that their them then there these they this those through under until upon very were what when where which while will with within would your'.split(' '))
export function stems(text: string): Set<string> {
  const out = new Set<string>()
  for (const w of (text || '').toLowerCase().match(/[a-z]{4,}/g) ?? []) if (!STOP.has(w)) out.add(w.slice(0, 5))
  return out
}
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0
  let i = 0
  for (const x of a) if (b.has(x)) i++
  return i / (a.size + b.size - i)
}

/** Cause ids attacked by ≥ 80% of the actions (once there are enough linked actions for that to mean anything). */
export function universalCauseIds(actions: readonly Pick<ActionLike, 'targetCauseIds'>[]): string[] {
  const linked = actions.filter((a) => a.targetCauseIds.length)
  if (linked.length < UNIVERSAL_MIN_ACTIONS) return []
  const count = new Map<string, number>()
  for (const a of linked) for (const id of new Set(a.targetCauseIds)) count.set(id, (count.get(id) ?? 0) + 1)
  return [...count].filter(([, n]) => n / linked.length >= UNIVERSAL_CAUSE_THRESHOLD).map(([id]) => id)
}

export interface DuplicatePair {
  a: string
  b: string
  /** 0–1: word overlap, plus a small lift for shared NON-universal causes. */
  score: number
  textSimilarity: number
  sharedCauseIds: string[]
}

export function rankDuplicates(
  actions: readonly Pick<ActionLike, 'id' | 'title' | 'practicalStep' | 'targetCauseIds'>[],
  opts: { minScore?: number; limit?: number } = {},
): { pairs: DuplicatePair[]; ignoredUniversalCauseIds: string[] } {
  const ignored = new Set(universalCauseIds(actions))
  const st = actions.map((a) => stems(`${a.title ?? ''} ${a.practicalStep}`))
  const pairs: DuplicatePair[] = []
  for (let i = 0; i < actions.length; i++) for (let j = i + 1; j < actions.length; j++) {
    const text = jaccard(st[i], st[j])
    const shared = actions[i].targetCauseIds.filter((c) => actions[j].targetCauseIds.includes(c) && !ignored.has(c))
    const score = Math.min(1, text + (text >= 0.12 ? Math.min(shared.length, 2) * 0.1 : 0))
    if (score >= (opts.minScore ?? 0.3)) pairs.push({ a: actions[i].id, b: actions[j].id, score, textSimilarity: text, sharedCauseIds: shared })
  }
  pairs.sort((x, y) => y.score - x.score)
  return { pairs: pairs.slice(0, opts.limit ?? 30), ignoredUniversalCauseIds: [...ignored] }
}
