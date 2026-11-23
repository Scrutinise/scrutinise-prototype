// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-AC part (a) (BRIEF_26AC §2–§3; decisions 319, 368, 370, 374): THE SCRUTINY EDITION, PURE.
//
// An edition is a ProposalVersion's FROZEN snapshot plus what only an edition has (its notes, what it includes, its source links). This
// file turns those into the reader's page (`editionView`) and the pre-publish checklist (`prePublishChecklist`), with no database and no
// model call, so the page a reviewer reads is a function of stored rows alone: the workspace can change all day and the page cannot.
//
// ⚠ EVERY VALUE COMES FROM THE SNAPSHOT OR THE EDITION'S OWN ROWS. Nothing here reads live idea state, and nothing is written by a model:
//   the summary is the Introductory Summary (26-T 5b, from the kernel), the costs are the recorded figures with their basis or "no basis
//   stated", the drafts are the versions frozen into the snapshot (the ACCEPTED one where there is one, else the latest, labelled so).
// ⚠ A SNAPSHOT MINTED BEFORE 26-T2 HAS NO actionsPack: the page then says so (`predates`) instead of showing empty headings as if the
//   idea had no actions.
// ─────────────────────────────────────────────────────────────────────────────

import type { Block } from '@/lib/documents/model'
import type { ProposalSnapshot, SnapshotAction, SnapshotCostFigure } from '@/lib/documents/proposal-snapshot'
import type { PackAction, PackRuledOut, PackSetAside } from '@/lib/documents/actions-pack-types'
import type { PackDocument } from '@/lib/lex/action-documents'
import { buildIntroductorySummary } from '@/lib/documents/build-background-report'
import { money } from '@/lib/documents/build-proposal'
import { printedVersionWords } from '@/lib/documents/build-actions-pack'
import { draftKindsOf } from './action-progress-pure'
import { KIND_WORD, type DocumentKind } from './action-documents-pure'

// ── the edition's own rows ──────────────────────────────────────────────────────────────────────────────────

export * from './scrutiny-edition-types'
import type { EditionStatus, LinkRow, LinkTarget, NoteRow, NoteTarget, Checklist, ChecklistItem } from './scrutiny-edition-types'

/**
 * What the owner chose to include (§3: "which sections to include"). Stored as `{ hidden: [...] }`: a key listed is left out. The keys are
 * 'summary', 'setAside', 'sources' and `heading:<id>` (`heading:none` = the actions not yet under any heading). Everything else is shown, so
 * an edition created before a new kind of section existed shows it rather than silently hiding it.
 */
export interface EditionInclude { hidden?: string[] }
export const SECTION_KEY = { summary: 'summary', setAside: 'setAside', sources: 'sources', heading: (id: string | null) => `heading:${id ?? 'none'}` } as const
export function parseInclude(v: unknown): EditionInclude {
  const h = (v as { hidden?: unknown } | null)?.hidden
  return { hidden: Array.isArray(h) ? [...new Set(h.filter((x): x is string => typeof x === 'string' && x.length <= 80))].slice(0, 200) : [] }
}
export const isShown = (inc: EditionInclude, key: string) => !(inc.hidden ?? []).includes(key)

// ── the page ────────────────────────────────────────────────────────────────────────────────────────────────

export interface DraftDocView { d: string; kind: string; title: string; body: string; v: number | null; words: string; accepted: boolean | null; newerNote: string | null }
export interface ActionView {
  id: string; number: number; title: string | null; statement: string
  /** The plain explanatory note (the EXPLANATORY_NOTE document's printed version), or null when there is none. */
  explanatory: { body: string; words: string } | null
  /** Each recorded cost figure with its basis, or "no basis stated"; or the owner's "no cost, because …"; empty = not yet costed. */
  costs: string[]
  /** The draft (the legal text): every document that makes up the instrument, each at its printed version. Empty = no draft. */
  drafts: DraftDocView[]
  /** 313 — "needs no draft", with the owner's reason. */
  noDraftReason: string | null
  /** The one-line state the summary and the action show beside "Read the draft wording". */
  draftState: string
  notes: string[]
  /** Registry numbers this action cites ([Ref: n]) plus accepted links. */
  refs: number[]
}
export interface HeadingView { key: string; id: string | null; name: string; purpose: string | null; notes: string[]; actions: ActionView[] }
export interface SourceView { number: number; title: string; citation: string | null; url: string | null; citedBy: string[] }
export interface EditionView {
  title: string
  number: number
  status: EditionStatus
  publishedAt: string | null
  blind: boolean
  /** The snapshot predates 26-T2: it has no headings, actions or set-aside list to show. */
  predates: boolean
  topNotes: string[]
  /** §2.1 — the Introductory Summary's blocks (from the kernel), and each action in one line. null = left out by the owner. */
  summary: { blocks: Block[]; lines: Array<{ id: string; number: number; statement: string; draftState: string; hasDraft: boolean; cost: string | null }> } | null
  headings: HeadingView[]
  /** §2.4 — collapsed by default on the page. null = left out. */
  setAside: { ruledOut: PackRuledOut[]; setAside: PackSetAside[] } | null
  sources: SourceView[] | null
}

const NO_BASIS = 'no basis stated'
function figureLine(label: string, f: SnapshotCostFigure | null | undefined): string | null {
  const amount = money(f ?? null)
  return amount ? `${label}: ${amount} (${f?.basis?.trim() || NO_BASIS})` : null
}
export function costLinesOf(a: SnapshotAction | undefined): string[] {
  if (!a) return []
  const out = [figureLine('Cost to implement', a.implementationCost), figureLine('Cost to enforce', a.enforcementCost), figureLine('Regulatory friction', a.regulatoryFriction)].filter((x): x is string => !!x)
  if (!out.length && a.noCostReason?.trim()) out.push(`No cost, because ${a.noCostReason.trim()}`)
  return out
}
/** A figure with an amount and nothing behind it: no basis stated and no benchmark. The checklist lists these. */
export function uncitedFigures(a: SnapshotAction | undefined): string[] {
  if (!a) return []
  const fs: Array<[string, SnapshotCostFigure | null]> = [['cost to implement', a.implementationCost], ['cost to enforce', a.enforcementCost], ['regulatory friction', a.regulatoryFriction]]
  const own = fs.filter(([, f]) => money(f) && !f?.basis?.trim() && !f?.benchmarkId).map(([w]) => w)
  const lines = (a.costLines ?? []).filter((l) => (l.low != null || l.high != null) && !l.basis?.trim() && !l.benchmarkId).map((l) => `cost line “${l.label}”`)
  return [...own, ...lines]
}

function docView(doc: PackDocument): DraftDocView {
  const words = printedVersionWords(doc)
  return {
    d: doc.d, kind: doc.kind, title: doc.title, body: doc.body, v: doc.v, words, accepted: doc.accepted ?? null,
    newerNote: doc.accepted === true && doc.newerV != null ? `Version ${doc.newerV} is later and not yet accepted; this is the accepted version.` : null,
  }
}
/** The documents that make up the draft (the instrument), plus a consequential schedule, which is legal text too. */
export function draftDocsOf(docs: readonly PackDocument[]): PackDocument[] {
  const withText = docs.filter((d) => d.v != null && d.body.trim())
  const core = new Set(draftKindsOf(withText.map((d) => d.kind as DocumentKind)))
  return withText.filter((d) => core.has(d.kind as DocumentKind) || d.kind === 'CONSEQUENTIAL_SCHEDULE')
}
export function draftStateOf(drafts: DraftDocView[], noDraftReason: string | null): string {
  if (noDraftReason) return `Needs no draft: ${noDraftReason}`
  if (!drafts.length) return 'No draft yet'
  if (drafts.every((d) => d.accepted === true)) return 'Draft accepted'
  return drafts.some((d) => d.accepted === true) ? 'Draft partly accepted; the rest is the latest version, not yet accepted' : 'Latest draft, not yet accepted'
}

function actionView(a: PackAction, snap: SnapshotAction | undefined, notes: string[], linkedRefs: number[]): ActionView {
  const docs = a.documents ?? []
  const drafts = draftDocsOf(docs).map(docView)
  const ex = docs.find((d) => d.kind === 'EXPLANATORY_NOTE' && d.v != null && d.body.trim())
  const noDraftReason = a.noDraftReason?.trim() || null
  return {
    id: a.id, number: a.number, title: a.title, statement: a.statement,
    explanatory: ex ? { body: ex.body, words: printedVersionWords(ex) } : null,
    costs: costLinesOf(snap), drafts, noDraftReason, draftState: draftStateOf(drafts, noDraftReason), notes,
    refs: [...new Set([...a.refs, ...linkedRefs])].sort((x, y) => x - y),
  }
}

const liveNotes = (notes: readonly NoteRow[], kind: NoteTarget, id: string | null) =>
  notes.filter((n) => !n.archivedAt && n.targetKind === kind && (kind === 'TOP' || n.targetId === id)).sort((x, y) => x.orderIndex - y.orderIndex).map((n) => n.body)

/** The reader's page, from the frozen snapshot and the edition's own rows. PURE. */
export function editionView(snapshot: ProposalSnapshot, edition: { number: number; status: EditionStatus; publishedAt: string | null; blind: boolean; include: EditionInclude }, notes: readonly NoteRow[], links: readonly LinkRow[]): EditionView {
  const inc = edition.include
  const data = snapshot.actionsPack
  const accepted = links.filter((l) => l.status === 'ACCEPTED' && l.sourceNumber != null)
  const linkedTo = (kind: LinkTarget, id: string | null) => accepted.filter((l) => l.targetKind === kind && l.targetId === id).map((l) => l.sourceNumber!)
  const snapById = new Map((snapshot.actions ?? []).map((a) => [a.id, a]))

  const actions = (data?.actions ?? []).map((a) => actionView(a, snapById.get(a.id), liveNotes(notes, 'ACTION', a.id), [...linkedTo('ACTION', a.id), ...linkedTo('DRAFT', a.id)]))
  const byId = new Map(actions.map((a) => [a.id, a]))
  // ⚠ `hidden` is the WORKSPACE's show/hide toggle ("Hide all headings"), a view of the screen, not a choice about the proposal: the
  //   Actions Pack prints hidden headings too. What an edition leaves out is the owner's own "Sections included" (include.hidden).
  const headingRows = data?.headings ?? []
  const headings: HeadingView[] = [
    ...headingRows.map((h) => ({ key: SECTION_KEY.heading(h.id), id: h.id, name: h.name, purpose: h.purpose, notes: liveNotes(notes, 'HEADING', h.id), actions: (data?.actions ?? []).filter((a) => a.headingId === h.id).map((a) => byId.get(a.id)!) })),
    ...((): HeadingView[] => {
      const known = new Set(headingRows.map((h) => h.id))
      const loose = (data?.actions ?? []).filter((a) => a.headingId == null || !known.has(a.headingId)).map((a) => byId.get(a.id)!)
      return loose.length ? [{ key: SECTION_KEY.heading(null), id: null, name: 'Not yet under a heading', purpose: null, notes: [], actions: loose }] : []
    })(),
  ].filter((h) => isShown(inc, h.key))

  const shownActions = headings.flatMap((h) => h.actions)
  const summary = isShown(inc, SECTION_KEY.summary) ? {
    blocks: buildIntroductorySummary(snapshot).model.blocks,
    lines: shownActions.map((a) => ({ id: a.id, number: a.number, statement: a.title?.trim() || a.statement, draftState: a.draftState, hasDraft: a.drafts.length > 0, cost: a.costs[0] ?? null })),
  } : null

  let sources: SourceView[] | null = null
  if (isShown(inc, SECTION_KEY.sources)) {
    const cited = new Map<number, Set<string>>()
    const cite = (n: number, label: string) => { if (!cited.has(n)) cited.set(n, new Set()); cited.get(n)!.add(label) }
    for (const a of shownActions) for (const n of a.refs) cite(n, `#${a.number}`)
    for (const h of headings) for (const n of linkedTo('HEADING', h.id)) cite(n, h.name)
    if (summary) for (const n of linkedTo('SUMMARY', null)) cite(n, 'The idea in one page')
    for (const n of linkedTo('NOTE', null)) cite(n, 'An author’s note')
    const reg = new Map((data?.registry ?? []).map((s) => [s.number, s]))
    sources = [...cited.keys()].sort((x, y) => x - y).map((n) => {
      const s = reg.get(n)
      const t = s?.title ?? accepted.find((l) => l.sourceNumber === n)?.sourceTitle ?? `Source ${n}`
      return { number: n, title: t, citation: s?.citation ?? null, url: s?.url ?? null, citedBy: [...cited.get(n)!] }
    })
  }

  return {
    title: snapshot.title, number: edition.number, status: edition.status, publishedAt: edition.publishedAt, blind: edition.blind,
    predates: !data, topNotes: liveNotes(notes, 'TOP', null), summary, headings,
    setAside: isShown(inc, SECTION_KEY.setAside) && data ? { ruledOut: data.ruledOut, setAside: data.setAside } : null,
    sources,
  }
}

// ── §3 the pre-publish checklist ───────────────────────────────────────────────────────────────────────────


/**
 * §3: "sections with no linked source; drafts not accepted; figures without a citation." Each can be published anyway; the list is RECORDED
 * on the edition at publish (`checklist`), so what was published anyway is shown to the owner, not hidden.
 */
export function prePublishChecklist(view: EditionView, snapshot: ProposalSnapshot): Checklist {
  const snapById = new Map((snapshot.actions ?? []).map((a) => [a.id, a]))
  const unlinked: ChecklistItem[] = []
  for (const h of view.headings) {
    const bare = h.actions.filter((a) => !a.refs.length)
    if (h.actions.length && bare.length === h.actions.length) unlinked.push({ key: h.key, words: `${h.name}: none of its ${h.actions.length === 1 ? 'action cites' : `${h.actions.length} actions cite`} a source` })
    else for (const a of bare) unlinked.push({ key: `action:${a.id}`, words: `#${a.number} cites no source` })
  }
  const unaccepted: ChecklistItem[] = []
  const uncited: ChecklistItem[] = []
  for (const a of view.headings.flatMap((h) => h.actions)) {
    if (a.noDraftReason) continue
    if (!a.drafts.length) unaccepted.push({ key: `draft:${a.id}`, words: `#${a.number} has no draft yet` })
    else for (const d of a.drafts.filter((x) => x.accepted !== true)) unaccepted.push({ key: `draft:${a.id}:${d.d}`, words: `#${a.number}: the ${KIND_WORD[d.kind as DocumentKind] ?? 'draft'} ${d.d} is ${d.words || 'not yet accepted'}` })
  }
  for (const a of view.headings.flatMap((h) => h.actions)) for (const w of uncitedFigures(snapById.get(a.id))) uncited.push({ key: `figure:${a.id}:${w}`, words: `#${a.number}: ${w} has no basis or benchmark` })
  return { unlinked, unaccepted, uncited }
}


// ── words ──────────────────────────────────────────────────────────────────────────────────────────────────

export const editionName = (n: number) => `Scrutiny edition ${n}`
export const PUBLISHED_REFUSED = (n: number) => `${editionName(n)} is published, and a published edition never changes. Create a new edition to change what reviewers read. Nothing was changed.`
