'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-Q — THE COHERENT-ACTIONS LIST, MADE WORKABLE AT FIFTY OR A HUNDRED ROWS.
//
//   §1  a title on every action (editable; Lex drafts them as PROPOSALS)         §5 merge · compare · find duplicates
//   §2  a titles-only list: open in place, drag, bulk select, a heading dropdown   §6 the coverage grid · the sequence view
//   §3  the user's headings — a colour trim AND the name AND a shape               §7 park (Later phase) · rule out (restorable)
//   §4  facets, regroupable with one control
//
// ⚠ NOTHING IS SIGNALLED BY COLOUR ALONE (docs/CLAUDE.md §21; Charlie is colour blind): a heading is its NAME, a SHAPE glyph
// that differs per colour, a palette spread down a lightness ladder, and only then the colour. Every state is also a word.
// ⚠ EVERY MODEL OUTPUT HERE IS A PROPOSAL the user accepts, edits or dismisses; nothing deletes (rule-out and merge keep the row).
// ⚠ The full action card is passed in (`renderFull`) so this file does not import FieldsPanel (no cycle) and the existing
// editing, costing and cost lines are reused as they are.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { CanonicalAction, CanonicalActionHeading, CanonicalCause } from '@/lib/lex/page1-config'
import { HEADING_PALETTE, colourFor } from '@/lib/lex/action-headings'
import { HEADING_KINDS, HEADING_KIND_WORD, isHeadingKind, type HeadingKind } from '@/lib/lex/action-documents-pure'
import { kindProposalPrice } from '@/lib/lex/heading-kind-pure'
import { POLICY_VERDICT_UI } from '@/lib/lex/action-facets'
import type { ActionStructureRequest, ActionStructureOp } from '@/lib/lex/action-structure-schema'
import { OP_WORDS } from '@/lib/lex/action-structure-schema'
import { explainFailure } from '@/lib/api-rejection'
import { LIMITS } from '@/lib/lex/input-limits'
import BoundedInput from './BoundedInput'
import ActionSlots from './ActionSlots'
import { useDigests, HeadingDigest, SetDigest, SetDigestButton } from './ActionDigest'
import IncentiveMap from './IncentiveMap'
import { usePackPrint, PackStatus } from './ActionsPackPrint'
import ActionComments from './ActionComments'
import { DraftAllButton } from './ActionDraftSection'
import { useRecordFacts, JumpBand, DocumentsSection, LawSection } from './ActionRecordSections'
import { bandStates, sectionLabel, type RecordSection } from '@/lib/lex/record-layout-pure'

import { ConditionsPanel, ConditionsCoverageView, ConditionChooser, ResortTool, ConsolidateCard, type ConsolidateCardState } from './ActionsStructureTools'
import { EMPTY_CONDITIONS, conditionWords, activeConditions, type ConditionsDoc } from '@/lib/lex/action-conditions'
import type { HeadingPlan } from '@/lib/lex/action-resort-pure'
import { ALL_SLOTS, SLOT_RUNS, SLOT_CONFIRM_ABOVE_PENCE, slotPriceEstimate, answeredCount, proposalCount, slotAnswered, slotProposal, specificTag } from '@/lib/lex/action-record'
import {
  AVENUES, AVENUE_LABEL, GROUP_MODE_LABEL,
  actionLabel, specificEnough, groupActions, coverageGrid, provenanceLine, NOT_TESTED_TITLE, type GroupMode,
} from '@/lib/lex/action-facets'
import { afterOf, afterWords } from '@/lib/lex/action-order-pure'
import { findByNumber, findWords as findWordsOf, numberQuery, textMatches } from '@/lib/lex/action-find'
import ActionsBoard from './ActionsBoard'
import { OrderSection, OrderView, becauseFor } from './ActionsOrder'
import { COMMON_UI, RECORD_UI, FACET_WORD, WORKSPACE_UI, WORKSPACE_VIEW_WORD } from '@/lib/lex/screen-labels'
import {
  STEPS, DEFAULT_STEP, stepChecklist, otherStepLine, unresolvedConflict, hasCostRange, type ActionsStep,
} from '@/lib/lex/action-steps'
import type { ActionsPage } from '@/lib/lex/stages'
import { PAGE_UI, DRAFTING_FILTER_WORD, ORGANISING_TOOLBAR_UI, withCount } from '@/lib/lex/screen-labels'
import { titleProposalPrice, untitledWords } from '@/lib/lex/title-proposal-pure'
import AddActionForm from './AddActionForm'
import { DRAFTING_STAGES, draftingLine, type Progress, type DraftingCounts, type DraftingStage } from '@/lib/lex/action-progress-pure'
import ProgressStrip from './ProgressStrip'

// ── talking to the route ─────────────────────────────────────────────────────────────────────────────────

interface OpResult<T = unknown> { ok: boolean; result: T | null; error: string | null }

/** The body of a call, typed against the route's own schema: `ids` where the route wants `actionIds` is a compile error. */
type Bodies = { [R in ActionStructureRequest as R['op']]: Omit<R, 'op'> }

/**
 * ⚠⚠ 26-S BROWSER PASS (17 Oct 2026) — THE RULE FOR EVERY WRITE ON THIS SCREEN:
 *   1. it RE-READS the list before it says anything — `onChanged()` is awaited, and if the re-read fails that is said, in words;
 *   2. a refusal renders as "Not saved: <reason>" with an OK button, in the strip that stays at the top of the viewport
 *      (the old message sat in the toolbar, above the fold of a 100-row list, so a rejection looked like nothing happening);
 *   3. a success says WHAT happened ("#12 is now under “Legislation”") — a row that jumps to another group otherwise looks like it vanished.
 */
function useOps(ideaId: string, onChanged: () => void | Promise<boolean | void>) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)
  // `K` is inferred from `op`, so `body` is checked against THAT op's schema. The result is untyped (`any`); the few callers
  // that read it annotate it where they use it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = useCallback(async <K extends keyof Bodies>(op: K, body: Bodies[K], label?: string, said?: (result: any) => string | null): Promise<OpResult<any>> => {
    type T = any // eslint-disable-line @typescript-eslint/no-explicit-any
    setBusy(label ?? op); setError(null); setSaved(null)
    const url = `/api/ideas/${ideaId}/action-structure`
    const sent = { op, ...body }
    const control = OP_WORDS[op]
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sent) })
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; error?: unknown }
      // §30 — every rejection says which input and why. `explainFailure` words even an old-shape body.
      const err = j.error || !res.ok ? `Not saved: ${explainFailure(j, res.status, control)}` : null
      if (err) { setError(err); return { ok: false, result: null, error: err } }
      const fresh = await onChanged()
      if (fresh === false) setError(`Saved, but the list could not be re-read from the server, so what is on screen may be out of date. Reload the page to see it.`)
      else if (said) setSaved(said((j.result ?? null) as T | null))
      return { ok: true, result: (j.result ?? null) as T | null, error: null }
    } catch (e) {
      const m = `Not saved: ${control} could not reach the server (${e instanceof Error ? e.message : 'network error'}). Nothing was changed.`
      setError(m); return { ok: false, result: null, error: m }
    } finally { setBusy(null) }
  }, [ideaId, onChanged])
  return { run, busy, error, saved, setSaved, note, setNote, clearError: () => setError(null), /** 26-V1b — a write made outside `run` (the document view) re-reads the list the same way. */ refresh: onChanged }
}

// ── 26-X §5f (310) — every action's progress strip and the Drafting counts, from /development (one documents-tree read). Re-read whenever
//    the list is re-read (`actions` changes after every write), so a strip is never older than the row beside it. ──
export interface DevelopmentView { rows: Array<{ id: string; progress: Progress }>; counts: DraftingCounts; parked: number }
function useDevelopment(ideaId: string, actions: CanonicalAction[], initial: DevelopmentView | null = null) {
  const [dev, setDev] = useState<DevelopmentView | null>(initial)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    fetch(`/api/ideas/${ideaId}/development`).then(async (res) => {
      const body = await res.json().catch(() => null)
      if (!live) return
      if (!res.ok) { setError(explainFailure(body, res.status, 'Reading how far each action has got')); return }
      setDev(body as DevelopmentView); setError(null)
    }).catch((e) => { if (live) setError(`Reading how far each action has got could not reach the server (${e instanceof Error ? e.message : 'network error'}).`) })
    return () => { live = false }
  }, [ideaId, actions])
  const byId = useMemo(() => new Map((dev?.rows ?? []).map((r) => [r.id, r.progress])), [dev])
  return { dev, byId, error }
}

// Decision 179: the three cost columns are COST lines — "Cost to implement / Cost to enforce / Cost of compliance" (never "Against", the step-2 slot).
const COST_LINE_LABEL_SHORT = { implementationCost: 'Implement', enforcementCost: 'Enforce', regulatoryFriction: 'Compliance' } as const

// Decision 167: "Link" is retired from the screen (the column stays; nothing is written to it).
// FACET_WORD is in lib/lex/screen-labels (26-W-b)

/** 26-S2 §3b — which list groupings belong to which step. A grouping that belongs to another step is not offered (absent, not greyed). */
// 262: grouping by Now / Next / Later is retired with the words.
const STEP_GROUP_MODES: Record<ActionsStep, GroupMode[]> = { 1: ['heading', 'cause', 'avenue', 'policy-test'], 2: ['heading'], 3: ['heading'], 4: ['heading'] }
/** …and which views: the board and the coverage grid are step-1 tools (255; causes against actions); the derived order is step 4's (262). */
const STEP_VIEWS: Record<ActionsStep, View[]> = { 1: ['list', 'board', 'coverage', 'conditions'], 2: ['list', 'who'], 3: ['list'], 4: ['list', 'order'] }
const VIEW_LABEL: Record<View, string> = WORKSPACE_VIEW_WORD

/** A proposal belongs to a step by what it proposes: causes, avenue and conditions are step 1's; what comes before what, step 4's. */
const proposalStep = (p: NonNullable<CanonicalAction['facetProposal']>): ActionsStep[] => [
  ...(p.targetCauseIds || p.avenue !== undefined || p.conditionIds || p.supportOnly ? [1 as const] : []), ...(p.beforeIds?.length ? [4 as const] : []),
]

/** 26-S §5d / 26-S2 §8 — the list filter. `Unreviewed` is READ NARROWLY (the brief does not define it): a proposal of Lex's is waiting for the user (a title or a classification for this step), or the action was never tested against the policy. `Not yet specific` exists from step 2 on. */
type Filter = 'all' | 'unreviewed' | 'conflicts' | 'notSpecific' | 'untitled'
const FILTER_LABEL: Record<Filter, string> = { all: 'All actions', unreviewed: 'Unreviewed', conflicts: 'Conflicts', notSpecific: 'Not yet specific', untitled: ORGANISING_TOOLBAR_UI.untitledFilter }
const isUntested = (a: Pick<CanonicalAction, 'policyTest'>): boolean => !a.policyTest || a.policyTest.verdict === 'NOT_TESTED'
/** What a finished policy test says, in words, with what it cost (170: the price is measured, never a guess). */
const testedWords = (r: { tested: number; counts: Record<string, number>; pence: number | null } | null): string => {
  if (!r || r.tested === 0) return 'Nothing needed testing: every action already has a verdict.'
  const c = r.counts
  return `Tested ${r.tested} action${r.tested === 1 ? '' : 's'} against your Guiding Policy: ${c.FITS ?? 0} fit, ${c.DOES_NOT_FIT ?? 0} do not fit, ${c.CONFLICTS ?? 0} conflict${c.NOT_TESTED ? `, ${c.NOT_TESTED} could not be tested` : ''}. ${r.pence == null ? 'The price was not recorded.' : `It cost ${r.pence < 1 ? r.pence.toFixed(2) : r.pence.toFixed(1)}p (measured on this run).`}`
}

const cost = (c: CanonicalAction['implementationCost']): string => {
  if (!c || (c.low == null && c.high == null)) return ''
  const f = (n: number) => `£${Math.round(n).toLocaleString()}`
  return c.low != null && c.high != null && c.low !== c.high ? `${f(c.low)}–${f(c.high)}` : f((c.low ?? c.high)!)
}

// ── the heading mark: name + shape + colour, together ───────────────────────────────────────────────────

function HeadingMark({ h, withName = true }: { h: Pick<CanonicalActionHeading, 'name' | 'colourKey'>; withName?: boolean }) {
  const c = colourFor(h.colourKey)
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-800" title={`${h.name} (${c.name})`}>
      <span aria-hidden style={{ color: c.hex }} className="leading-none">{c.glyph}</span>
      {withName && <span>{h.name}</span>}
    </span>
  )
}

interface Props {
  ideaId: string
  actions: CanonicalAction[]
  setAside: CanonicalAction[]
  headings: CanonicalActionHeading[]
  causes: CanonicalCause[]
  busy: boolean
  /** Re-reads the list. Resolves `false` when the re-read failed (so the screen can say so); anything else is a success. */
  onChanged: () => void | Promise<boolean | void>
  /** The existing action card, one STEP of it at a time (1 the body, 2 Who, 3 the cost ranges and lines, 4 nothing) — shown in place when a title is opened. */
  renderFull: (a: CanonicalAction, step: ActionsStep, between?: ReactNode) => ReactNode
  /** Ids of rows to render already open. Used by the render checks, so that what an OPENED row shows is read from the output. */
  initiallyOpen?: string[]
  /** 26-X 308 — the page the user is on. Organising shows step 1's tools and only those (§4a); Drafting shows the strips and opens records
   *  with their Drafts at the top (§5a). Default Organising. */
  page?: ActionsPage
  /** 318 — the flip: Organising → Drafting with an action open, and "← Back to Organising". Absent: the page cannot change from here. */
  onPage?: (p: ActionsPage, actionNumber?: number | null) => void
  /** The progress to show before /development answers (the render checks hand in what the route returned). The browser re-reads it. */
  initialDevelopment?: DevelopmentView | null
  /** Ids of the actions that have cost lines (step 3's checklist counts a cost line as a cost). */
  costLineActionIds?: string[]
  /** 26-S2 188 + 190 - the idea's conditions, the instrument headings the Re-sort sorts into, the headings it archived, and how many moved actions Undo can put back. */
  structure?: { conditions: ConditionsDoc; headingPlan: HeadingPlan | null; archivedHeadings: Array<{ id: string; name: string }>; resortUndoable: number }
  /** 26-X addendum 321 — "Import actions from a document" (row 2, Add) and "Check for gaps" (row 3, Lex and checks), rendered by the caller
   *  (they carry their own state and routes) and placed on the Organising toolbar's rows. */
  importSlot?: ReactNode
  gapSlot?: ReactNode
}

type View ='list' | 'board' | 'coverage' | 'conditions' | 'order' | 'who'

export default function ActionsWorkspace({ ideaId, actions, setAside, headings, causes, busy: parentBusy, onChanged, renderFull, initiallyOpen, page = 'organising', onPage, costLineActionIds, structure, initialDevelopment, importSlot, gapSlot }: Props) {
  // 26-X 308 — Organising IS step 1's toolset; the old steps 2–4 have no page (their data is on the record). `step` stays the name the
  // step-1 helpers (stepChecklist, the facet proposals) take, fixed at 1.
  const org = page === 'organising'
  const step: ActionsStep = DEFAULT_STEP
  const conditions = structure?.conditions ?? EMPTY_CONDITIONS
  const headingPlan = structure?.headingPlan ?? null
  const archivedHeadings = structure?.archivedHeadings ?? []
  const ops = useOps(ideaId, onChanged)
  const development = useDevelopment(ideaId, actions, initialDevelopment ?? null)
  // §5a — the Drafting page's own filter (to brief · to draft · to review · to accept · needs no draft · accepted), kept across the flip
  const [draftFilter, setDraftFilter] = useState<'all' | DraftingStage>('all')
  // 318 — where Organising was when an action was opened from it, so "← Back to Organising" returns to the same place
  const rootRef = useRef<HTMLDivElement>(null)
  const organisingScroll = useRef<number | null>(null)
  const scrollParent = (): HTMLElement | null => {
    let el = rootRef.current?.parentElement ?? null
    while (el && !(el.scrollHeight > el.clientHeight && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) el = el.parentElement
    return el
  }
  const [viewAsked, setView] = useState<View>('list')
  const [modeAsked, setMode] = useState<GroupMode>('heading')
  // a view or grouping that belongs to another step is not offered here: fall back to the list / by heading
  // Drafting is the list only (§5a); Organising offers step 1's views (List · Board · Coverage grid · Conditions — §4a)
  const view: View = org && STEP_VIEWS[step].includes(viewAsked) ? viewAsked : 'list'
  const mode: GroupMode = STEP_GROUP_MODES[step].includes(modeAsked) ? modeAsked : 'heading'
  // "find duplicates has run since the last change": remembered per idea in this browser, against a signature of the list
  const [dupesSig, setDupesSig] = useState<string | null>(null)
  const [sigReady, setSigReady] = useState(false)
  const [open, setOpen] = useState<Set<string>>(new Set(initiallyOpen ?? []))
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newHeading, setNewHeading] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ name: string; why: string }> | null>(null)
  const [dupes, setDupes] = useState<null | { pairs: Array<{ a: string; b: string; aNumber: number | null; bNumber: number | null; aLabel: string; bLabel: string; score: number; sharedCauseIds: string[] }>; ignoredUniversalCauses: Array<{ number: number; cause: string }> }>(null)
  const [pair, setPair] = useState<null | { a: number; b: number; mode: 'merge' | 'compare' }>(null)
  const [reason, setReason] = useState('')
  const [bulkNewOpen, setBulkNewOpen] = useState(false)
  const [bulkNewName, setBulkNewName] = useState('')
  const [showParked, setShowParked] = useState(false)
  const [showSetAside, setShowSetAside] = useState(false)
  const [showRetired, setShowRetired] = useState(false)
  const byIdAll = useMemo(() => new Map([...actions, ...setAside].map((a) => [a.id, a])), [actions, setAside])
  const disabled = parentBusy || !!ops.busy

  const live = actions
  const unparked = useMemo(() => live.filter((a) => !a.parked), [live])
  const parked = useMemo(() => live.filter((a) => a.parked), [live])
  const causeLite = useMemo(() => causes.map((c) => ({ id: c.id, number: c.number ?? null, cause: c.cause })), [causes])
  // 26-X addendum 323 — the count on "Title them with Lex" is the actions with NO TITLE (the Untitled filter shows exactly them); Lex is asked
  // only about those with no proposal waiting; a proposal is shown (and counted for "Accept all") only on a row that still has no title.
  const hasNoTitle = (a: CanonicalAction) => !a.title?.trim()
  const untitled = live.filter((a) => !a.parked && hasNoTitle(a)).length
  const toAskTitles = live.filter((a) => !a.parked && hasNoTitle(a) && !a.titleProposal).length
  const titleProposals = live.filter((a) => hasNoTitle(a) && a.titleProposal).length
  const [adding, setAdding] = useState(false)
  const [headingBoxOpen, setHeadingBoxOpen] = useState(false)
  const facetProposals = live.filter((a) => a.facetProposal && proposalStep(a.facetProposal).includes(step)).length
  const byId = useMemo(() => new Map(live.map((a) => [a.id, a])), [live])
  const headingById = useMemo(() => new Map(headings.map((h) => [h.id, h])), [headings])
  const costLineIds = useMemo(() => new Set(costLineActionIds ?? []), [costLineActionIds])

  // ── step 1's "no unresolved duplicate": find-duplicates has run since the last change to the list ──
  const listSig = useMemo(() => live.map((a) => `${a.id}:${a.practicalStep.length}:${a.title ?? ''}`).join('|'), [live])
  const sigKey = `lex:dupes-checked:${ideaId}`
  useEffect(() => { try { setDupesSig(window.localStorage.getItem(sigKey)) } catch { /* private window: it reads as not run, which is true */ } setSigReady(true) }, [sigKey])
  const markDuplicatesChecked = () => { try { window.localStorage.setItem(sigKey, listSig) } catch { /* ditto */ } setDupesSig(listSig) }
  const duplicatesChecked = sigReady && dupesSig === listSig
  const untestedCount = unparked.filter(isUntested).length
  // ── the list filter (§8) ──
  const [filterAsked, setFilter] = useState<Filter>('all')
  const filter: Filter = filterAsked === 'notSpecific' && step === 1 ? 'all' : filterAsked
  const matches: Record<Filter, (a: CanonicalAction) => boolean> = {
    all: () => true,
    unreviewed: (a) => !!a.titleProposal || (!!a.facetProposal && proposalStep(a.facetProposal).includes(step)) || (step === 2 && proposalCount(a) > 0) || isUntested(a),
    conflicts: (a) => a.policyTest?.verdict === 'CONFLICTS',
    notSpecific: (a) => !specificEnough(a),
    untitled: (a) => hasNoTitle(a),
  }
  const filterCounts: Record<Filter, number> = { all: unparked.length, unreviewed: unparked.filter(matches.unreviewed).length, conflicts: unparked.filter(matches.conflicts).length, notSpecific: unparked.filter(matches.notSpecific).length, untitled: unparked.filter(matches.untitled).length }
  const filterKeys: Filter[] = step === 1 ? ['all', 'unreviewed', 'conflicts', 'untitled'] : ['all', 'unreviewed', 'conflicts', 'notSpecific', 'untitled']
  // 190 (UI B) - the FIND BOX: matches title, statement and commentary (and "#12"), every word of it, case-blind; filters the list live
  const [find, setFind] = useState('')
  const findWords = useMemo(() => findWordsOf(find), [find])
  // 284 - "63" / "#63" is ACTION 63 first, from the list or the set-aside rows, with where it went; text matches come below
  const numberHit = useMemo(() => { const n = numberQuery(find); return n == null ? null : findByNumber(n, actions, setAside) }, [find, actions, setAside])
  const found = (a: CanonicalAction) => (numberHit?.action.id === a.id ? false : textMatches(a, findWords))
  const shown = useMemo(() => unparked.filter(matches[filter]).filter(found), [unparked, filter, step, findWords]) // eslint-disable-line react-hooks/exhaustive-deps
  // a heading reads `· n archived` after a rebuild or a merge archives one of its actions (they sit under `Ruled out and merged away`)
  const archivedByHeading = useMemo(() => { const m = new Map<string, number>(); for (const a of setAside) if (a.status === 'ARCHIVED' && a.headingId) m.set(a.headingId, (m.get(a.headingId) ?? 0) + 1); return m }, [setAside])
  // §5a — Drafting: the same live list by heading, through its own filter (the find box and the Organising filters are Organising's tools)
  const draftShown = useMemo(() => unparked.filter((a) => draftFilter === 'all' || development.byId.get(a.id)?.stage === draftFilter), [unparked, draftFilter, development.byId])
  const groups = useMemo(() => groupActions(org ? shown : draftShown, org ? mode : 'heading', { headings, causes: causeLite }), [org, shown, draftShown, mode, headings, causeLite])
  const checklist = useMemo(() => stepChecklist(step, unparked, { duplicatesChecked, conditions }, { actionIdsWithCostLines: costLineIds }), [step, unparked, duplicatesChecked, costLineIds, conditions])
  // 190 - Consolidate this heading: one card at a time, under the heading's own header
  const [consolidate, setConsolidate] = useState<ConsolidateCardState | null>(null)
  // 26-T1 - the digest (four models + a judge), per heading and for the whole set: step 1's
  const digests = useDigests(ideaId, org, onChanged)
  const [setDigestOpen, setSetDigestOpen] = useState(false)
  // 26-T2 - the Actions Pack: any selection, one heading, or all
  const pack = usePackPrint(ideaId)
  /** "#12" in a digest opens that action in the list and brings it into view. */
  const openByNumber = (n: number) => {
    const a = live.find((x) => x.number === n)
    if (!a) return
    setFilter('all'); setFind('')
    setOpen((s) => new Set(s).add(a.id))
    setTimeout(() => document.querySelector(`[data-action-id="${a.id}"]`)?.scrollIntoView?.({ block: 'center' }), 50)
  }
  // ── 318 — THE FLIP. From Organising, an action's title (or "Open") goes to Drafting with that action open; the Organising scroll position
  //    is remembered, and the find box, filter and grouping are this component's own state, which the flip does not unmount. ──
  const flipTo = (a: CanonicalAction) => {
    organisingScroll.current = scrollParent()?.scrollTop ?? null
    setOpen(new Set([a.id]))
    if (draftFilter !== 'all' && development.byId.get(a.id)?.stage !== draftFilter) setDraftFilter('all')
    onPage?.('drafting', a.number)
    setTimeout(() => document.querySelector(`[data-action-id="${a.id}"]`)?.scrollIntoView?.({ block: 'start' }), 80)
  }
  const backToOrganising = () => {
    const y = organisingScroll.current
    onPage?.('organising')
    setTimeout(() => { const p = scrollParent(); if (p && y != null) p.scrollTop = y }, 80)
  }
  // 318 — a deep link (`/ideas/[id]/drafting#38`) lands on Drafting with #38 open
  useEffect(() => {
    if (page !== 'drafting' || typeof window === 'undefined') return
    const m = /^#(\d+)$/.exec(window.location.hash)
    const a = m ? live.find((x) => x.number === Number(m[1])) : undefined
    if (!a) return
    setOpen(new Set([a.id]))
    setTimeout(() => document.querySelector(`[data-action-id="${a.id}"]`)?.scrollIntoView?.({ block: 'start' }), 150)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- on arrival only
  const allHeadingsHidden = headings.length > 0 && headings.every((h) => h.hidden)

  const toggleOpen = (id: string) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selIds = [...selected].filter((id) => byId.has(id))
  const selNums = selIds.map((id) => byId.get(id)!.number).filter((n): n is number => n != null)

  // ── drag to reorder (pointer events — the ideas list's mechanism; touch-safe) ──
  const [order, setOrder] = useState<string[] | null>(null)
  const orderRef = useRef<string[]>([])
  const [dragging, setDragging] = useState<string | null>(null)
  const displayed = useMemo(() => {
    if (!order) return groups
    const pos = new Map(order.map((id, i) => [id, i]))
    return groups.map((g) => ({ ...g, actions: [...g.actions].sort((x, y) => (pos.get(x.id) ?? 0) - (pos.get(y.id) ?? 0)) }))
  }, [groups, order])
  const persist = useCallback(async (ids: string[]) => { await ops.run('reorder', { order: ids }, 'saving the order'); setOrder(null) }, [ops])
  const onPointerDownDrag = (id: string) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    orderRef.current = live.map((a) => a.id)
    setOrder(orderRef.current); setDragging(id)
    const onMove = (ev: PointerEvent) => {
      const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
      const target = el?.closest('[data-action-id]') as HTMLElement | null
      const tid = target?.dataset.actionId
      if (!tid || tid === id) return
      const cur = [...orderRef.current]
      const from = cur.indexOf(id), to = cur.indexOf(tid)
      if (from < 0 || to < 0) return
      cur.splice(from, 1); cur.splice(to, 0, id)
      orderRef.current = cur; setOrder(cur)
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove); handle.removeEventListener('pointerup', onUp); handle.removeEventListener('pointercancel', onUp)
      setDragging(null); void persist(orderRef.current)
    }
    handle.addEventListener('pointermove', onMove); handle.addEventListener('pointerup', onUp); handle.addEventListener('pointercancel', onUp)
  }
  const nudge = (id: string, dir: -1 | 1) => {
    const ids = live.map((a) => a.id); const from = ids.indexOf(id), to = from + dir
    if (from < 0 || to < 0 || to >= ids.length) return
    const [x] = ids.splice(from, 1); ids.splice(to, 0, x); void persist(ids)
  }

  // ── bulk ──
  // Typed per control (no generic `bulk(op, extra)`: a helper that spreads `{ ids }` into every op is exactly how the
  // bulk "Assign to heading" came to send `ids` where the route wants `actionIds`).
  const clearIfDone = (r: { ok: boolean }) => { if (r.ok) { setSelected(new Set()); setReason('') } }
  const movedWords = (n: number, asked: number, to: string) => `${n} action${n === 1 ? '' : 's'} ${to}${n < asked ? ` (${asked - n} of the ${asked} selected ${asked - n === 1 ? 'was' : 'were'} not in the live list)` : ''}.`
  const headingName = (id: string | null) => (id ? headings.find((h) => h.id === id)?.name ?? 'that heading' : null)
  const bulkAssign = (headingId: string | null) => ops.run('assignHeading', { actionIds: selIds, headingId }, undefined,
    (r: { assigned: number }) => `Saved: ${movedWords(r.assigned, selIds.length, headingId ? `now under “${headingName(headingId)}”` : 'now have no heading')}`).then(clearIfDone)
  const bulkNewHeading = async () => {
    const name = bulkNewName.trim()
    if (!name) return
    const r = await ops.run('assignToNewHeading', { actionIds: selIds, name }, 'making the heading and moving the rows',
      (x: { name: string; created: boolean; assigned: number }) => `Saved: ${x.created ? `heading “${x.name}” made; ` : `heading “${x.name}” already existed; `}${movedWords(x.assigned, selIds.length, `moved onto it`)}`)
    clearIfDone(r)
    if (r.ok) { setBulkNewOpen(false); setBulkNewName('') }
  }
  const bulkPark = () => ops.run('park', { ids: selIds, reason: reason.trim() || null }, undefined,
    (r: { parked?: number }) => `Saved: ${r?.parked ?? selIds.length} action${(r?.parked ?? selIds.length) === 1 ? '' : 's'} moved to “Later phase”.`).then(clearIfDone)
  const bulkRuleOut = () => ops.run('ruleOut', { ids: selIds, reason: reason.trim() }, undefined,
    (r: { ruledOut: number }) => `Saved: ${r.ruledOut} action${r.ruledOut === 1 ? '' : 's'} ruled out, with your reason. They are kept under “Ruled out and merged away”; Restore brings one back.`).then(clearIfDone)
  const addHeading = async () => {
    const name = newHeading.trim()
    if (!name) return
    const r = await ops.run('createHeading', { name }, 'adding the heading',
      (x: { name: string; created: boolean }) => x.created
        ? `Saved: heading “${x.name}” added. It is in the list with no actions on it yet — use a row’s heading menu, or select rows and “Assign to heading”.`
        : `Nothing added: you already have a heading called “${x.name}”.`)
    if (r.ok) { setNewHeading(''); setHeadingBoxOpen(false) }
  }
  // 322 — "Add action": written through the shared addAction; the new row opens on Drafting, first under its heading
  const addOwnAction = async (body: { title: string; practicalStep: string; headingId: string | null }): Promise<string | null> => {
    const r = await ops.run('addAction', body, 'adding the action',
      (x: { number: number | null; title: string; headingName: string | null }) => `Saved: #${x.number ?? '?'} “${x.title}” added, first under ${x.headingName ? `“${x.headingName}”` : 'No heading (Unsorted)'}. It is open on the Drafting page; it reads “Defined ◐” until it has a statement and a heading with a kind.`)
    if (!r.ok) return r.error
    setAdding(false)
    const made = r.result as { id: string; number: number | null } | null
    if (made) {
      organisingScroll.current = scrollParent()?.scrollTop ?? null
      setOpen(new Set([made.id]))
      if (draftFilter !== 'all') setDraftFilter('all')
      onPage?.('drafting', made.number)
      setTimeout(() => document.querySelector(`[data-action-id="${made.id}"]`)?.scrollIntoView?.({ block: 'start' }), 120)
    }
    return null
  }

  // ── one line ──
  const renderRow = (a: CanonicalAction) => {
    const h = a.headingId ? headingById.get(a.headingId) : undefined
    const c = h ? colourFor(h.colourKey) : null
    // 318 — a record opens on Drafting only; on Organising a title flips to Drafting with the action open
    const isOpen = !org && open.has(a.id)
    const originals = setAside.filter((s) => s.mergedIntoId === a.id)
    // 26-S browser pass D — an OPENED record is ONE box: a 2px border and a light grey fill (border and fill, never colour alone).
    const boxClass = isOpen ? 'border-2 border-zinc-900 bg-zinc-100' : `border bg-white ${dragging === a.id ? 'border-zinc-900 shadow' : 'border-zinc-200'}`
    // The heading menu: on an Organising row, and in an opened record's band on Drafting (a heading is part of "Defined"). The tick box and
    // the drag handle are Organising's only — absent on Drafting, not greyed.
    const headingSelect = (
      <select value={a.headingId ?? ''} disabled={disabled} aria-label={`Heading for action ${a.number ?? ''}`}
        onChange={(e) => {
          if (e.target.value === '__new') { e.target.value = a.headingId ?? ''; setSelected(new Set([a.id])); setBulkNewOpen(true); return }
          const to = e.target.value || null
          void ops.run('assignHeading', { actionIds: [a.id], headingId: to }, undefined,
            () => `Saved: #${a.number ?? '?'} ${to ? `is now under “${headingName(to)}”` : 'now has no heading'}.`)
        }}
        className="text-[11px] border border-zinc-300 rounded px-1 py-0.5 max-w-[9rem] shrink-0 bg-white">
        <option value="">No heading</option>
        {headings.map((x) => <option key={x.id} value={x.id}>{colourFor(x.colourKey).glyph} {x.name}</option>)}
        <option value="__new">+ New heading…</option>
      </select>
    )
    return (
      <li key={a.id} data-action-id={a.id} data-open={isOpen ? 'true' : undefined} className={`rounded-lg ${boxClass}`} style={c ? { borderLeft: `6px solid ${c.hex}` } : undefined}>
        <div className="flex items-start gap-1.5 px-2 py-1.5">
          {org && <input type="checkbox" checked={selected.has(a.id)} onChange={() => toggleSel(a.id)} aria-label={`Select action ${a.number ?? ''}`} className="mt-1 w-4 h-4 accent-zinc-900 shrink-0" />}
          {org && (
            <button type="button" disabled={disabled} onPointerDown={onPointerDownDrag(a.id)}
              onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); nudge(a.id, -1) } if (e.key === 'ArrowDown') { e.preventDefault(); nudge(a.id, 1) } }}
              title="Drag to reorder — or use the arrow keys" aria-label={`Reorder action ${a.number ?? ''}`}
              className="shrink-0 cursor-grab active:cursor-grabbing text-zinc-300 hover:text-zinc-500 disabled:opacity-30 touch-none px-0.5" style={{ touchAction: 'none' }}>
              <span aria-hidden className="text-base leading-none">{WORKSPACE_UI.reorder}</span>
            </button>
          )}
          <span className="text-[11px] text-zinc-400 tabular-nums mt-0.5 w-7 shrink-0">#{a.number ?? '?'}</span>
          <div className="flex-1 min-w-0">
            {/* 18 Oct (CCh B) — OPENED: the title line is [title · Edit title] with Close at the right; the snippet, the repeated title and the tag line are gone (the record below says all of it). */}
            {isOpen ? (
              <OpenTitle a={a} disabled={disabled} ops={ops} />
            ) : (
              // 318 — on Organising the title goes to Drafting with this action open; on Drafting it opens the record in place
              <button type="button" onClick={() => (org ? flipTo(a) : toggleOpen(a.id))} aria-expanded={org ? undefined : isOpen} className="text-left w-full" data-row-title>
                <span className={`text-sm ${a.title ? 'font-medium text-zinc-900' : 'text-zinc-700'}`} data-shown-value>{actionLabel(a)}</span>
                <span className="text-[11px] text-zinc-400 ml-1.5">{org ? `${PAGE_UI.openInDrafting} → ${PAGE_UI.drafting}` : WORKSPACE_UI.openRecord}</span>
              </button>
            )}
            {/* 26-X §4b / §5a — the progress strip, on every row of both pages (Organising shows how drafting stands; it has no drafting control). */}
            {!isOpen && <div className="mt-0.5"><ProgressStrip p={development.byId.get(a.id)} /></div>}
            {/* Organising: the closed row keeps a two-line snippet and step 1's tags — heading, avenue, causes, conditions, the policy verdict. */}
            {!isOpen && org && a.title && <span className="block text-[11px] text-zinc-500 mt-0.5 overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }} data-row-summary>{a.practicalStep.length > 240 ? `${a.practicalStep.slice(0, 239)}…` : a.practicalStep}</span>}
            {!isOpen && <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-zinc-500 items-center">
              {!org && h && <HeadingMark h={h} />}
              {org && (
                <>
                  {h && <HeadingMark h={h} />}
                  {a.avenue && <span>{AVENUE_LABEL[a.avenue]}</span>}
                  {a.targetCauseIds.length > 0 && <span>{a.targetCauseIds.length} cause{a.targetCauseIds.length === 1 ? '' : 's'}</span>}
                  {activeConditions(conditions).length > 0 && <span data-condition-tag>{a.supportOnly ? 'support' : a.conditionIds.length ? `condition${a.conditionIds.length === 1 ? '' : 's'} ${conditionWords(conditions, a)}` : 'no condition'}</span>}
                  {setAside.some((s) => s.foldedIntoId === a.id) && <span data-folded-count>{setAside.filter((s) => s.foldedIntoId === a.id).length} tucked in</span>}
                  {a.mergedFrom.length > 0 && <span>merged from #{a.mergedFrom.join(', #')}</span>}
                  {/* DECISION 138 — the policy test, in the one list: a WORD AND A SHAPE (✗ ○ ? ✓), never colour alone. A conflict is boxed. */}
                  {a.policyTest ? (
                    <span title={a.policyTest.reason ?? undefined}
                      className={`font-semibold text-zinc-800 ${a.policyTest.verdict === 'CONFLICTS' ? 'border-2 border-zinc-900 rounded px-1' : ''}`}>
                      <span aria-hidden>{POLICY_VERDICT_UI[a.policyTest.verdict].glyph}</span> {POLICY_VERDICT_UI[a.policyTest.verdict].word}
                      {a.policyTest.verdict === 'CONFLICTS' && a.conflictNote && <span className="font-normal"> · kept, with a note</span>}
                    </span>
                  ) : (
                    // 26-S browser pass C — a row the consolidation never tested says so IN WORDS; blank reads as "fine".
                    <span title={NOT_TESTED_TITLE} className="font-semibold text-zinc-800" data-not-tested>
                      <span aria-hidden>{POLICY_VERDICT_UI.NOT_TESTED.glyph}</span> {POLICY_VERDICT_UI.NOT_TESTED.word}
                    </span>
                  )}
                </>
              )}
              {/* 26-X 308 — the old steps 2–4 tags (Who, cost, order) left the row with the step tabs; their data is on the record. */}
              {org && a.facetProposal && proposalStep(a.facetProposal).includes(1) && <span className="font-semibold text-zinc-700">Lex has proposed causes or an avenue</span>}
            </div>}
            {/* 323 — a proposal waiting is shown on its row, under the statement, never hidden: "Lex proposes: … — Accept · Not this".
                Only on a row with no title: a title the owner wrote is never replaced. */}
            {!isOpen && a.titleProposal && hasNoTitle(a) && (
              <p className="mt-1 text-[11px] text-zinc-800 bg-zinc-50 border border-zinc-300 rounded px-1.5 py-1" data-title-proposal>
                <span className="font-semibold">{ORGANISING_TOOLBAR_UI.lexProposes}</span> <em>{a.titleProposal}</em> —{' '}
                <button disabled={disabled} data-title-accept onClick={() => void ops.run('acceptTitles', { ids: [a.id] }, undefined, (x: { accepted: number }) => x.accepted ? `Saved: #${a.number ?? '?'} is titled “${a.titleProposal}”.` : `Nothing changed: #${a.number ?? '?'} already has a title of yours, which is kept.`)} className="underline font-semibold">{ORGANISING_TOOLBAR_UI.acceptTitle}</button>
                {' · '}
                <button disabled={disabled} data-title-not-this onClick={() => void ops.run('dismissTitles', { ids: [a.id] }, undefined, () => `Saved: Lex’s title for #${a.number ?? '?'} set aside; it stays untitled.`)} className="underline">{ORGANISING_TOOLBAR_UI.notThisTitle}</button>
              </p>
            )}
          </div>
          {isOpen ? (
            // 18 Oct (CCh B) — opened: Close is on the title line; the heading menu moved down beside the policy test.
            <button type="button" onClick={() => toggleOpen(a.id)} aria-expanded className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded border-2 border-zinc-900 bg-white">{WORKSPACE_UI.closeRecord}</button>
          ) : org ? (
            <span className="shrink-0 flex items-center gap-1.5">
              {headingSelect}
              <button type="button" onClick={() => flipTo(a)} data-open-in-drafting className="text-[11px] font-medium px-1.5 py-0.5 rounded border border-zinc-300 bg-white">{PAGE_UI.openInDrafting}</button>
            </span>
          ) : null}
        </div>
        {isOpen && <OpenAction a={a} originals={originals} step={step} hasCostLines={costLineIds.has(a.id)} headingSelect={headingSelect} onBack={onPage ? backToOrganising : undefined} ctx={{ ideaId, live, byId, causeLite, disabled, ops, renderFull, headingName, conditions }} />}
      </li>
    )
  }

  // ── the toolbar ──
  // 26-S2 §3b — ONLY THIS STEP'S CONTROLS ARE RENDERED. Controls that belong to another step are absent (not greyed).
  //   step 1: titles, headings, causes and avenue (Classify), the board, the coverage grid, duplicates · step 4: what comes before what
  //   (Classify) and the derived order. Steps 2 and 3 have no toolbar yet: their questions are the opened record's (who; the cost ranges).
  const modes = STEP_GROUP_MODES[step]
  const views = STEP_VIEWS[step].filter((v) => v !== 'conditions' || activeConditions(conditions).length > 0)
  const classifyWords = 'causes and avenue'
  // 26-X 308 — step 2's bulk "Classify with Lex" (the seven answers for every action) and step 4's ordering classification left with the step
  // tabs. The per-action "Ask Lex" stays on the record's "Who, how and against"; the whole-set view of those answers is the Deepening's
  // "Who delivers and who resists" (315, part X3). The data and the route ops are untouched.
  // 190 (UI A, 18 Oct (6) C) - Hide all / Show all headings: the same control on every step (a heading's hidden state is per idea, so it holds across steps)
  // 26-V2c (268, revised) — "Ask Lex to propose kinds": for headings with no kind and no proposal waiting; asks first, at the measured price
  const [askKinds, setAskKinds] = useState(false)
  const kindless = headings.filter((h) => !h.kind && !h.proposedKind).length
  const kPrice = kindProposalPrice()
  const KindsAsk = kindless > 0 && kPrice.pence != null ? (askKinds
    ? <span className="inline-flex flex-wrap items-center gap-1.5 rounded border-2 border-zinc-900 bg-white px-2 py-1 text-xs" data-kinds-ask>
        Lex proposes a kind for {kindless} heading{kindless === 1 ? '' : 's'} with none — about {kPrice.pence}p (measured on a copy of a real idea, n={kPrice.n}). Each proposal waits beside its heading for you to accept; none is set by Lex.
        <button type="button" disabled={disabled} data-kinds-go onClick={() => { setAskKinds(false); void ops.run('proposeHeadingKinds', { agreedPence: kPrice.pence! }, 'Lex is proposing kinds',
          (r: { proposals: unknown[]; pence: number | null; dropped: string[] }) => `Lex proposed a kind for ${r.proposals.length} heading${r.proposals.length === 1 ? '' : 's'}${r.pence != null ? ` (${r.pence.toFixed(1)}p)` : ''}. Each waits beside its heading: Accept or Not this.${r.dropped.length ? ` Not proposed: ${r.dropped.join('; ')}.` : ''}`) }}
          className="px-2 py-0.5 rounded bg-zinc-900 text-white font-medium disabled:opacity-40">Propose them — about {kPrice.pence}p</button>
        <button type="button" onClick={() => setAskKinds(false)} className="underline">Not now</button>
      </span>
    : <button type="button" disabled={disabled} data-kinds-button onClick={() => setAskKinds(true)} title="Each heading has a kind: the type of instrument its actions make. Lex reads each heading's actions and proposes one; you accept or not."
        className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-800 hover:bg-zinc-50 disabled:opacity-40">Ask Lex to propose kinds ({kindless} heading{kindless === 1 ? '' : 's'} with none)</button>
  ) : null
  const HideAll = view === 'list' && mode === 'heading' && headings.length > 0 ? (
    <>
      <button type="button" disabled={disabled} data-hide-all-headings onClick={() => void ops.run('setHeadingsHidden', { hidden: !allHeadingsHidden }, undefined,
        (r: { changed: number }) => `Saved: ${allHeadingsHidden ? 'every heading is shown' : 'every heading is hidden'} (${r.changed} changed).`)}
        className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-800 hover:bg-zinc-50 disabled:opacity-40">{allHeadingsHidden ? WORKSPACE_UI.showAllHeadings : WORKSPACE_UI.hideAllHeadings}</button>
    </>
  ) : null
  // ── 26-X §5a — the Drafting page's head: the counts, then the filters (one per stage of the strip), each with its count ──
  const dc = development.dev?.counts
  const DraftingBar = (
    <div className="space-y-1.5" data-drafting-bar>
      {development.error && <p className="text-xs font-semibold text-zinc-900 bg-white border-2 border-zinc-900 rounded px-2 py-1.5" role="alert">⚠ Not read: {development.error}</p>}
      <p className="text-sm font-semibold text-zinc-900" data-drafting-counts>
        {dc ? draftingLine(dc) : 'Reading how far each action has got…'}
        {development.dev && development.dev.parked > 0 && <span className="font-normal text-zinc-600"> · {development.dev.parked} in Later phase, not counted</span>}
      </p>
      {dc && (
        <div role="group" aria-label="Show the actions that are" className="flex flex-wrap items-center gap-1" data-drafting-filters>
          {(['all', ...DRAFTING_STAGES] as const).map((k) => {
            const here = draftFilter === k
            const n = k === 'all' ? dc.total : dc.byStage[k]
            return (
              <button key={k} type="button" onClick={() => setDraftFilter(k)} aria-pressed={here} data-drafting-filter={k}
                className={`text-xs rounded px-2 py-0.5 ${here ? 'border-2 border-zinc-900 bg-white font-bold' : 'border border-zinc-300 bg-zinc-50'}`}>
                <span aria-hidden>{here ? '●' : '○'}</span> {DRAFTING_FILTER_WORD[k]} ({n})
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
  // 26-X addendum 321 — the find box (284) and Show are on the View row (they were below the toolbar)
  const ViewRowFind = (
    <>
        {/* 190 (UI B) - the find box: title, statement and commentary; the list (and the board's cards, 255) filter as you type; "n of m actions match"; one press clears it. */}
        {org && (view === 'list' || view === 'board') && unparked.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5" data-find-box>
            <input type="search" value={find} onChange={(e) => setFind(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') setFind('') }}
              placeholder="Find in the actions — title, statement, Action details" aria-label="Find in the actions"
              className="text-xs p-1.5 rounded border border-zinc-300 w-80 max-w-full focus:outline-none focus:border-blue-400" />
            {find.trim() && (
              <>
                <span className="text-[11px] font-semibold text-zinc-800" data-find-count role="status">{shown.length} of {unparked.length} action{unparked.length === 1 ? '' : 's'} match</span>
                <button type="button" onClick={() => setFind('')} className="text-[11px] underline text-zinc-700" data-find-clear>Clear</button>
              </>
            )}
            {/* 284 - the number itself first: action N wherever it is now, and where it went; the text matches are the list below */}
            {find.trim() && numberQuery(find) != null && (
              <div className="basis-full text-[11px] rounded border-2 border-zinc-700 bg-white px-2 py-1 flex flex-wrap items-start gap-2" data-find-number role="status">
                {numberHit ? (
                  <>
                    <span className="font-semibold">#{numberHit.action.number}</span>
                    <span className="flex-1 min-w-0">{actionLabel(numberHit.action)} <span className="text-zinc-700" data-find-where>— {numberHit.where}</span></span>
                    {numberHit.place === 'list' && <button type="button" className="underline font-medium" data-find-show onClick={() => openByNumber(numberHit.action.number!)}>Open it</button>}
                    {numberHit.place === 'parked' && <button type="button" className="underline font-medium" data-find-show onClick={() => { setShowParked(true); setTimeout(() => document.querySelector(`[data-parked-id="${numberHit.action.id}"]`)?.scrollIntoView?.({ block: 'center' }), 50) }}>Show it in Later phase</button>}
                    {numberHit.place === 'setAside' && org && <button type="button" className="underline font-medium" data-find-show onClick={() => { setShowSetAside(true); setTimeout(() => document.querySelector(`[data-set-aside-id="${numberHit.action.id}"]`)?.scrollIntoView?.({ block: 'center' }), 50) }}>Show it in Ruled out and merged away</button>}
                    {numberHit.goTo?.number != null && <button type="button" className="underline font-medium" data-find-goto onClick={() => openByNumber(numberHit.goTo!.number!)}>Go to #{numberHit.goTo.number}</button>}
                  </>
                ) : <span data-find-where>No action #{numberQuery(find)} on this idea — not in the list, Later phase, or the ruled-out and merged-away actions.</span>}
              </div>
            )}
          </div>
        )}
  
        {org && view === 'list' && unparked.length > 0 && (
          <label className="text-[11px] text-zinc-600 flex flex-wrap items-center gap-1" data-list-filter title="Unreviewed: a proposal of Lex’s is waiting for you (a title, or this step’s classification), or the action has not been tested against the policy.">{WORKSPACE_UI.listFilter}
            <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="border border-zinc-300 rounded px-1 py-0.5 text-xs" aria-label="Filter the list">
              {filterKeys.map((k) => <option key={k} value={k}>{FILTER_LABEL[k]} ({filterCounts[k]})</option>)}
            </select>
            {filter !== 'all' && <span className="font-semibold text-zinc-800" data-shown-value>{shown.length} of {unparked.length} shown{shown.length === 0 ? ' — none match' : ''}</span>}
            {/* 184 - the filter's own help text: what each choice means, in words (the definition of "Unreviewed" is Lex's reading, confirmed by CCh) */}
            <span className="basis-full text-[10px] text-zinc-500" data-filter-help>
              <span className="font-semibold">Unreviewed</span> — Lex has a proposal waiting for you (a title, this step’s classification{step === 2 ? ' or answers' : ''}), or the action has not been tested against the policy. <span className="font-semibold">Conflicts</span> — the policy test says the action conflicts with your Guiding Policy.{step === 1 ? '' : ' '}{step !== 1 && <><span className="font-semibold">Not yet specific</span> — Who and Against are not both answered (draft text, for a legislative action).</>}
            </span>
          </label>
        )}
    </>
  )
  // ══ 26-X addendum 321 — THE ORGANISING TOOLBAR IS THREE LABELLED ROWS: View · Add · Lex and checks. "Add action" and "Add heading" are the
  //    page's primary (filled) buttons. Every label is in screen-labels.ts and has a field-guide entry that names its row. ══
  const rowLabel = (word: string) => <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-700 w-28 shrink-0 mt-1" data-toolbar-row-label>{word}</span>
  const titlePrice = titleProposalPrice(toAskTitles)
  const Toolbar = !org ? DraftingBar : (
    <div className="space-y-2 rounded-lg border border-zinc-200 bg-zinc-50/60 p-2" data-organising-toolbar>
      {/* Row 1 — View. Nothing on this row changes the actions. */}
      <div className="flex items-start gap-2" data-toolbar-row="view">
        {rowLabel(ORGANISING_TOOLBAR_UI.rowView)}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {views.length > 1 && (
              <div role="tablist" aria-label="View" className="inline-flex rounded-lg border border-zinc-300 overflow-hidden">
                {views.map((v) => (
                  <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                    className={`text-xs px-2.5 py-1 ${view === v ? 'bg-zinc-900 text-white font-semibold' : 'bg-white text-zinc-700 hover:bg-zinc-50'}`}>{view === v ? '● ' : '○ '}{VIEW_LABEL[v]}</button>
                ))}
              </div>
            )}
            {view === 'list' && modes.length > 1 && (
              <label className="text-[11px] text-zinc-600 flex items-center gap-1">{WORKSPACE_UI.group}
                <select value={mode} onChange={(e) => setMode(e.target.value as GroupMode)} className="border border-zinc-300 rounded px-1 py-0.5 text-xs">
                  {modes.map((m) => <option key={m} value={m}>{GROUP_MODE_LABEL[m]}</option>)}
                </select></label>
            )}
            {/* 190 (UI A) - one control for every heading: hides the lot, or shows the lot. A hidden heading keeps its actions; the list just does not show them. */}
            {HideAll}
          </div>
          {ViewRowFind}
        </div>
      </div>

      {/* Row 2 — Add. */}
      <div className="flex items-start gap-2" data-toolbar-row="add">
        {rowLabel(ORGANISING_TOOLBAR_UI.rowAdd)}
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
          <button type="button" disabled={disabled} onClick={() => setAdding(true)} data-add-action
            className="text-xs font-semibold px-3 py-1 rounded-lg bg-zinc-900 text-white border-2 border-zinc-900 disabled:opacity-40">+ {ORGANISING_TOOLBAR_UI.addAction}</button>
          {/* the name box opens on press (it was always shown, with its counter) */}
          {headingBoxOpen ? (
            <span className="inline-flex flex-wrap items-center gap-1 rounded border-2 border-zinc-900 bg-white p-1" data-add-heading-box>
              <BoundedInput value={newHeading} onChange={setNewHeading} max={LIMITS.headingName} placeholder="New heading — e.g. legislation, practical…" aria-label="New heading name"
                onEnter={() => void addHeading()} disabled={disabled} autoFocus
                className="text-xs p-1.5 rounded border border-zinc-300 w-60 focus:outline-none focus:border-blue-400" />
              <button disabled={disabled || !newHeading.trim()} onClick={() => void addHeading()} className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-zinc-900 text-white disabled:opacity-40">{COMMON_UI.save}</button>
              <button type="button" onClick={() => { setHeadingBoxOpen(false); setNewHeading('') }} className="text-xs underline text-zinc-600">{COMMON_UI.cancel}</button>
            </span>
          ) : (
            <button type="button" disabled={disabled} onClick={() => setHeadingBoxOpen(true)} data-add-heading
              className="text-xs font-semibold px-3 py-1 rounded-lg bg-zinc-900 text-white border-2 border-zinc-900 disabled:opacity-40">+ {WORKSPACE_UI.addHeading}</button>
          )}
          <button disabled={disabled} onClick={async () => {
            const r = await ops.run('suggestHeadings', {}, 'Lex is reading your guiding policy')
            if (r.ok && r.result) setSuggestions(r.result.suggestions)
          }} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 bg-white hover:bg-zinc-50">{WORKSPACE_UI.suggestHeadings}</button>
          {importSlot}
        </div>
      </div>

      {/* Row 3 — Lex and checks. Each that spends says its price first or when it finishes. */}
      <div className="flex items-start gap-2" data-toolbar-row="lex">
        {rowLabel(ORGANISING_TOOLBAR_UI.rowLex)}
        <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1.5">
          {/* 323 — the count's meaning is in the label; pressing it also shows the Untitled filter, so the N are on screen */}
          {untitled > 0 && (
            <button disabled={disabled} data-title-them onClick={async () => {
              setView('list'); setFind(''); setFilter('untitled')
              if (toAskTitles === 0) { ops.setNote(`Every untitled action already has a title proposal waiting on its row: Accept or Not this. Nothing was asked.`); return }
              const r = await ops.run('proposeTitles', {}, 'Lex is writing titles')
              if (r.ok && r.result) ops.setNote(`Lex proposed ${r.result.proposed} title${r.result.proposed === 1 ? '' : 's'}${r.result.pence != null ? ` (${Number(r.result.pence).toFixed(1)}p)` : ''}${r.result.skipped ? `; ${r.result.skipped} it could not title` : ''}${r.result.asTopics ? `; ${r.result.asTopics} read like a topic rather than an action — worth a look` : ''}. Each waits on its row, under the statement: Accept or Not this. Nothing is saved until you accept.`)
            }} title={`Lex proposes a title for each action with no title and no proposal waiting${titlePrice.pence != null ? ` — about ${titlePrice.pence}p (the mean of ${titlePrice.runs} measured runs)` : ''}. A title you wrote is never replaced.`}
              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 disabled:opacity-40">
              <span data-title-count>{untitledWords(untitled)}</span> · {WORKSPACE_UI.titleThemWithLex}{toAskTitles > 0 && titlePrice.pence != null ? ` — about ${titlePrice.pence}p` : ''}
            </button>
          )}
          {titleProposals > 0 && <button disabled={disabled} data-accept-all-titles onClick={() => void ops.run('acceptTitles', {}, undefined, (x: { accepted: number; keptYours: number }) => `Saved: ${x.accepted} title${x.accepted === 1 ? '' : 's'} accepted.${x.keptYours ? ` ${x.keptYours} row${x.keptYours === 1 ? '' : 's'} you had titled since kept your title.` : ''}`)}
            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white">{withCount(ORGANISING_TOOLBAR_UI.acceptAllTitles, titleProposals)}</button>}
          <button disabled={disabled || live.length === 0} title={`Lex proposes the ${classifyWords} for every action that has none. You accept or correct.`} onClick={async () => {
            const r = await ops.run('proposeFacets', {}, 'Lex is classifying')
            if (r.ok && r.result) ops.setNote(`Lex proposed the ${classifyWords} for ${r.result.proposed} action${r.result.proposed === 1 ? '' : 's'}. Open an action to correct it, or accept the lot.`)
          }} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 disabled:opacity-40">{WORKSPACE_UI.classifyWithLex}</button>
          {facetProposals > 0 && <button disabled={disabled} onClick={() => void ops.run('acceptFacets', { step }, undefined,
            (r: { accepted: number; refused?: string[] }) => `Saved: ${r.accepted} accepted.${r.refused?.length ? ` Not taken, because the order would go round in a circle: ${r.refused.join(' ')}` : ''}`)} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white">Accept all {facetProposals} proposed {step === 1 ? 'classifications' : 'orderings'}</button>}
          <button disabled={disabled || live.length < 2} onClick={async () => {
            const r = await ops.run('findDuplicates', {}, 'finding duplicates')
            if (r.ok) { setDupes(r.result); markDuplicatesChecked() }
          }} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 disabled:opacity-40">{WORKSPACE_UI.findDuplicates}</button>
          {headingPlan && <ResortTool plan={headingPlan} undoable={structure?.resortUndoable ?? 0} ops={ops} disabled={disabled} />}
          {untestedCount > 0 && (
            <button disabled={disabled} data-test-policy title="Runs the same test the import uses, on the actions that read ? Not tested. Measured once on a real idea: 14 actions for 3.9p in about 40 seconds (n=1). The price of this run is shown when it finishes." onClick={() => { setView('list'); setFind(''); setFilter('unreviewed'); void ops.run('testPolicy', {}, 'Lex is testing the actions against your Guiding Policy', testedWords) }}
              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 disabled:opacity-40">{ORGANISING_TOOLBAR_UI.testAgainstPolicy} ({untestedCount} untested)</button>
          )}
          <SetDigestButton state={digests} disabled={disabled || live.length === 0} onOpened={() => setSetDigestOpen(true)} />
          {KindsAsk}
          {gapSlot}
          <button type="button" disabled={disabled || pack.busy || live.length === 0} data-print-all onClick={() => void pack.print(undefined, 'all the actions')} title="A printable pack of every action with everything the record holds, every paragraph numbered. No model is called." className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50 disabled:opacity-40">{WORKSPACE_UI.printAll}</button>
        </div>
      </div>
      {adding && <AddActionForm headings={headings} disabled={disabled} onAdd={addOwnAction} onClose={() => setAdding(false)} />}

      {org && suggestions && (
        <div className="rounded-lg border border-zinc-200 bg-white p-2">
          <p className="text-[11px] font-semibold text-zinc-700">Starting headings from your guiding policy — add, rename later, or ignore.</p>
          <ul className="mt-1 space-y-1">
            {suggestions.map((s) => {
              const have = headings.some((h) => h.name.toLowerCase() === s.name.toLowerCase())
              return (
                <li key={s.name} className="flex items-start gap-2 text-[11px]">
                  <button disabled={disabled || have} onClick={() => void ops.run('createHeading', { name: s.name })} className="shrink-0 font-medium px-1.5 py-0.5 rounded border border-zinc-300 disabled:opacity-40">{have ? 'Added' : 'Add'}</button>
                  <span><span className="font-semibold">{s.name}</span> — {s.why}</span>
                </li>
              )
            })}
          </ul>
          <button onClick={() => setSuggestions(null)} className="mt-1 text-[11px] underline text-zinc-500">Ignore these</button>
        </div>
      )}

    </div>
  )

  // ── the status strip: STAYS AT THE TOP OF THE VIEWPORT while the list is scrolled ──
  // (it used to sit in the toolbar, above the fold of a long list: a refusal rendered, off screen, and looked like nothing happening.)
  const statusRef = useRef<HTMLDivElement>(null)
  useEffect(() => { if (ops.error) statusRef.current?.scrollIntoView?.({ block: 'nearest' }) }, [ops.error])
  const Status = (ops.busy || ops.error || ops.saved || ops.note || digests.error || digests.note || pack.busy || pack.error || pack.ready) ? (
    <div ref={statusRef} className="space-y-1" data-status-strip>
      <PackStatus s={pack} />
      {digests.error && (
        <p className="text-xs font-semibold text-zinc-900 bg-white border-2 border-zinc-900 rounded px-2 py-1.5" role="alert" data-digest-error>⚠ {digests.error}{' '}
          <button type="button" onClick={digests.clearError} className="ml-1 px-2 py-0.5 rounded border border-zinc-900 bg-zinc-100 font-semibold">OK</button>
        </p>
      )}
      {digests.note && <p className="text-[11px] text-zinc-700 bg-zinc-50 border border-zinc-200 rounded px-2 py-1" data-digest-note>{digests.note} <button onClick={digests.clearNote} className="underline ml-1">dismiss</button></p>}
      {ops.busy &&<p className="text-[11px] text-zinc-700 bg-white border border-zinc-300 rounded px-2 py-1" role="status">Working: {ops.busy}…</p>}
      {ops.error && (
        <p className="text-xs font-semibold text-zinc-900 bg-white border-2 border-zinc-900 rounded px-2 py-1.5" role="alert">⚠ {ops.error}{' '}
          <button type="button" onClick={ops.clearError} className="ml-1 px-2 py-0.5 rounded border border-zinc-900 bg-zinc-100 font-semibold">OK</button>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('scrutinise:report-bug'))} className="underline font-medium ml-2">Report this problem</button>
        </p>
      )}
      {ops.saved && <p className="text-xs text-zinc-900 bg-white border border-zinc-400 rounded px-2 py-1" role="status">✓ {ops.saved} <button type="button" onClick={() => ops.setSaved(null)} className="ml-1 underline">OK</button></p>}
      {ops.note && <p className="text-[11px] text-zinc-700 bg-zinc-50 border border-zinc-200 rounded px-2 py-1">{ops.note} <button onClick={() => ops.setNote(null)} className="underline ml-1">dismiss</button></p>}
    </div>
  ) : null

  // ── bulk bar ──
  const BulkBar = org && selIds.length > 0 && (
    <div className="rounded-lg border-2 border-zinc-900 bg-white p-2 flex flex-wrap items-start gap-1.5" data-bulk-bar>
      <span className="text-xs font-semibold mt-0.5">{selIds.length} selected</span>
      <select disabled={disabled} defaultValue="" onChange={(e) => {
        const v = e.target.value
        if (v === '__') return
        e.target.value = '__'
        if (v === '__new') { setBulkNewOpen(true); return }
        void bulkAssign(v === '' ? null : v)
      }} aria-label="Assign selected to a heading" className="text-xs border border-zinc-300 rounded px-1 py-0.5 mt-0.5">
        <option value="__">Assign to heading…</option><option value="__new">+ New heading…</option><option value="">No heading</option>
        {headings.map((h) => <option key={h.id} value={h.id}>{colourFor(h.colourKey).glyph} {h.name}</option>)}
      </select>
      {bulkNewOpen && (
        <span className="inline-flex flex-wrap items-start gap-1 rounded border border-zinc-400 bg-zinc-50 p-1" data-bulk-new-heading>
          <BoundedInput value={bulkNewName} onChange={setBulkNewName} max={LIMITS.headingName} placeholder="Name the new heading" aria-label="Name of the new heading"
            onEnter={() => void bulkNewHeading()} disabled={disabled} className="text-xs border border-zinc-300 rounded px-1.5 py-0.5 w-44" />
          <button disabled={disabled || !bulkNewName.trim()} onClick={() => void bulkNewHeading()} className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Create and move {selIds.length}</button>
          <button type="button" onClick={() => { setBulkNewOpen(false); setBulkNewName('') }} className="text-xs underline text-zinc-600 mt-0.5">Cancel</button>
        </span>
      )}
      <button disabled={disabled} onClick={() => void bulkPark()} className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300 mt-0.5">Later phase</button>
      <BoundedInput value={reason} onChange={setReason} max={LIMITS.ruleOutReason} placeholder="Reason (to rule out)" aria-label="Reason to rule out the selected actions"
        className="text-xs border border-zinc-300 rounded px-1.5 py-0.5 w-44" />
      <button disabled={disabled || reason.trim().length < 3} onClick={() => void bulkRuleOut()} className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Rule out</button>
      <button disabled={disabled || selNums.length !== 2} onClick={() => setPair({ a: selNums[0], b: selNums[1], mode: 'merge' })} title={selNums.length === 2 ? 'Lex reads both and gives a verdict and a reason; you edit her restated wording and confirm. Nothing is merged until you do.' : 'Select exactly two actions'} className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Ask Lex to review and merge</button>
      <button disabled={disabled || selNums.length !== 2} onClick={() => setPair({ a: selNums[0], b: selNums[1], mode: 'compare' })} title={selNums.length === 2 ? undefined : 'Select exactly two actions'} className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">Compare</button>
      <button disabled={disabled || pack.busy} data-print-selected onClick={() => void pack.print({ actionIds: selIds }, `${selIds.length} selected ${selIds.length === 1 ? 'action' : 'actions'}`)} title="Print the selected actions as an Actions Pack (Word and PDF), every paragraph numbered." className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300 mt-0.5 disabled:opacity-40">Print selected as an Actions Pack</button>
      <button onClick={() => setSelected(new Set())} className="text-xs underline text-zinc-500 ml-auto">Clear</button>
    </div>
  )

  return (
    <div ref={rootRef} className="space-y-2" data-actions-page={page}>
      {Toolbar}
      {org && <HeldFromConsolidation ideaId={ideaId} onChanged={onChanged} />}
      {org && <ConditionsPanel doc={conditions} actions={unparked} ops={ops} disabled={disabled} />}
      {(Status || BulkBar) && <div className="sticky top-0 z-20 space-y-1" data-sticky-top>{Status}{BulkBar}</div>}
      {org && pair && <PairPanel key={`${pair.a}-${pair.b}-${pair.mode}`} ideaId={ideaId} a={pair.a} b={pair.b} mode={pair.mode} ops={ops} onClose={() => { setPair(null); setSelected(new Set()) }} byNumber={(n) => live.find((x) => x.number === n)} />}
      {org && dupes && <DuplicatesPanel data={dupes} onClose={() => setDupes(null)} onMerge={(a, b) => setPair({ a, b, mode: 'merge' })} causes={causeLite} />}


      {view === 'list' && (
        <>
          {live.length === 0 && <p className="text-[11px] text-zinc-400">No actions yet.</p>}
          <div className="space-y-2.5">
            {displayed.map((g) => {
              const h = g.key.startsWith('h:') ? headingById.get(g.key.slice(2)) : undefined
              return (
                <section key={g.key} aria-label={g.label}>
                  <GroupHeader g={g} h={h} compact={!org} ops={ops} disabled={disabled} archived={h ? archivedByHeading.get(h.id) ?? 0 : 0}
                    onConsolidate={org && h && g.actions.length >= 2 ? async () => {
                      const r = await ops.run('consolidatePlan', { headingId: h.id }, 'reading the heading')
                      if (r.ok && r.result) setConsolidate({ headingId: h.id, phase: 'confirm', heading: r.result.heading, actions: r.result.actions, estimate: r.result.estimate })
                    } : undefined}
                    onShowArchived={org ? () => { setShowSetAside(true); setTimeout(() => document.getElementById('set-aside-block')?.scrollIntoView?.({ block: 'start' }), 0) } : undefined} />
                  {consolidate && h && consolidate.headingId === h.id && <ConsolidateCard s={consolidate} ops={ops} disabled={disabled} setS={setConsolidate} onClose={() => setConsolidate(null)} />}
                  {org && h && <HeadingDigest headingId={h.id} headingName={h.name} actionCount={g.actions.length} state={digests} onOpenAction={openByNumber} disabled={disabled}
                    extra={<button type="button" disabled={disabled || pack.busy || g.actions.length === 0} data-print-heading onClick={() => void pack.print({ headingId: h.id }, `the heading “${h.name}”`)} title="Print this heading as an Actions Pack (Word and PDF), every paragraph numbered." className="text-[11px] font-medium px-1.5 py-0.5 rounded border border-zinc-300 text-zinc-800 hover:bg-zinc-50 disabled:opacity-40">{WORKSPACE_UI.printHeading}</button>} />}
                  {/* §4b — no drafting control on Organising: "Draft all legislative actions" is a Drafting tool */}
                  {!org && h && !g.hidden && <DraftAllButton actions={g.actions as never} run={ops.run as never} disabled={disabled} headingName={h.name} />}
                  {!g.hidden && <ul className="space-y-1">{g.actions.map((a) => renderRow(a))}</ul>}
                  {/* 26-X — an action OPENED on Drafting (a flip, a deep link #N, a new "Add action") is drawn even under a hidden heading:
                      hidden hides the list's rows, never the record the user asked for. The note counts the rest. */}
                  {g.hidden && !org && g.actions.some((a) => open.has(a.id)) && <ul className="space-y-1" data-open-under-hidden>{g.actions.filter((a) => open.has(a.id)).map((a) => renderRow(a))}</ul>}
                  {g.hidden && (() => { const rest = g.actions.length - (!org ? g.actions.filter((a) => open.has(a.id)).length : 0); return rest > 0 || org ? <p className="text-[11px] text-zinc-400 pl-2">Hidden — {rest} {!org && rest !== g.actions.length ? 'more ' : ''}action{rest === 1 ? '' : 's'} not shown.</p> : null })()}
                </section>
              )
            })}
          </div>
          {org && parked.length > 0 && (
            <CollapsedBlock title={WORKSPACE_UI.laterPhaseBlock} count={parked.length} open={showParked} onToggle={() => setShowParked((v) => !v)} hint="Parked for later — still yours, still in the proposal.">
              <ul className="space-y-1">{parked.map((a) => (
                <li key={a.id} data-parked-id={a.id} className="flex items-start gap-2 text-[11px] rounded border border-zinc-200 bg-white px-2 py-1">
                  <span className="text-zinc-400">#{a.number}</span><span className="flex-1">{actionLabel(a)}{a.parkedReason ? <span className="text-zinc-500"> — {a.parkedReason}</span> : null}</span>
                  <button disabled={disabled} onClick={() => void ops.run('unpark', { ids: [a.id] }, undefined, () => `Saved: #${a.number ?? '?'} brought back into the list.`)} className="underline font-medium">Bring back</button>
                </li>))}</ul>
            </CollapsedBlock>
          )}
        </>
      )}

      {/* 26-V1b §7a (255) — the board: the same cards as the list (live, not parked, through the find box); its writes are the list's own */}
      {view === 'board' && org && (
        <ActionsBoard ideaId={ideaId} actions={unparked.filter(found)} headings={headings} conditions={conditions} ops={ops} disabled={disabled} headingName={headingName}
          pairs={dupes?.pairs ?? null}
          onFindPairs={async () => { const r = await ops.run('findDuplicates', {}, 'finding duplicates'); if (r.ok) { setDupes(r.result); markDuplicatesChecked() } }}
          onMerge={(x, y) => { setPair({ a: x, b: y, mode: 'merge' }); setTimeout(() => document.querySelector('[aria-label="Merge two actions"]')?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 0) }} />
      )}
      {view === 'coverage' && <CoverageView actions={unparked} causes={causeLite} headings={headings} />}
      {view === 'conditions' && <ConditionsCoverageView doc={conditions} actions={unparked} headings={headings} />}
      {view === 'order' && <OrderView actions={unparked} />}
      {view === 'who' && <IncentiveMap ideaId={ideaId} actions={unparked} onOpenAction={openByNumber} onChanged={onChanged} disabled={disabled} />}

      {/* 26-T1 - the whole-set digest, at the foot of step 1 */}
      {org && <SetDigest state={digests} open={setDigestOpen} setOpen={setSetDigestOpen} onOpenAction={openByNumber} disabled={disabled} />}

      {/* 26-S2 §3c — this step's checklist at the foot of the list. ADVISORY: it says what is unfinished and never blocks moving on. */}
      {org && checklist.length > 0 && <StepChecklist step={step} lines={checklist} />}

      {org && setAside.length > 0 && (
        <CollapsedBlock id="set-aside-block" title={WORKSPACE_UI.ruledOutBlock} count={setAside.length} open={showSetAside} onToggle={() => setShowSetAside((v) => !v)} hint="Kept, with the reason. Nothing here is deleted.">
          <ul className="space-y-1">{setAside.map((a) => (
            <li key={a.id} data-set-aside-id={a.id} className="flex items-start gap-2 text-[11px] rounded border border-zinc-200 bg-white px-2 py-1">
              <span className="text-zinc-400">#{a.number}</span>
              <span className="flex-1">{actionLabel(a)}<span className="text-zinc-500"> — {a.foldedIntoId ? `part of #${byIdAll.get(a.foldedIntoId)?.number ?? '?'}` : a.status === 'ARCHIVED' ? 'merged away' : 'ruled out'}{a.ruleOutReason && !a.foldedIntoId ? `: ${a.ruleOutReason}` : ''}</span></span>
              <button disabled={disabled} onClick={() => void ops.run('restore', { ids: [a.id] }, undefined, () => a.foldedIntoId ? `Saved: #${a.number ?? '?'} restored as its own row; its quote is out of #${byIdAll.get(a.foldedIntoId)?.number ?? '?'}’s Detail.` : `Saved: #${a.number ?? '?'} restored to the list.`)} className="underline font-medium">{WORKSPACE_UI.restore}</button>
            </li>))}</ul>
        </CollapsedBlock>
      )}
      {org && archivedHeadings.length > 0 && (
        <CollapsedBlock id="retired-headings-block" title={WORKSPACE_UI.retiredHeadingsBlock} count={archivedHeadings.length} open={showRetired} onToggle={() => setShowRetired((v) => !v)} hint="Archived by a re-sort. Kept; nothing is deleted.">
          <ul className="space-y-1">{archivedHeadings.map((h) => (
            <li key={h.id} className="flex items-start gap-2 text-[11px] rounded border border-zinc-200 bg-white px-2 py-1" data-retired-heading>
              <span className="flex-1">{h.name}</span>
              <button disabled={disabled} onClick={() => void ops.run('restoreHeading', { headingId: h.id }, undefined, () => `Saved: the heading “${h.name}” is back (empty — no action is moved onto it).`)} className="underline font-medium">Bring back</button>
            </li>))}</ul>
        </CollapsedBlock>
      )}
    </div>
  )
}

interface OpenCtx {
  ideaId: string
  live: CanonicalAction[]
  byId: Map<string, CanonicalAction>
  causeLite: Array<{ id: string; number: number | null; cause: string }>
  disabled: boolean
  ops: ReturnType<typeof useOps>
  renderFull: (a: CanonicalAction, step: ActionsStep, between?: ReactNode) => ReactNode
  /** The heading's name, for the collapsed step-1 line of an opened record viewed from another step. */
  headingName: (id: string | null) => string | null
  /** 26-S2 188 - the idea's conditions, for the chooser on a step-1 record. */
  conditions: ConditionsDoc
}

/** 18 Oct (CCh B) — the opened record's title line: the title as text, "Edit title" at its end (the box replaces it). Close sits at the row's right. */
function OpenTitle({ a, disabled, ops }: { a: CanonicalAction; disabled: boolean; ops: ReturnType<typeof useOps> }) {
  const [title, setTitle] = useState(a.titleProposal ?? a.title ?? '')
  const [editingTitle, setEditingTitle] = useState(false)
  const saveTitle = async () => {
    const r = await ops.run('setTitle', { actionId: a.id, title: title.trim() || null }, undefined, () => `Saved: the title of #${a.number ?? '?'}.`)
    if (r.ok) setEditingTitle(false)
  }
  return editingTitle ? (
    <div className="flex flex-wrap gap-1.5 items-start" data-open-title>
      <BoundedInput value={title} onChange={setTitle} max={LIMITS.actionTitle} placeholder="A short title saying what this action does" aria-label={`Title of action ${a.number ?? ''}`}
        onEnter={() => void saveTitle()} className="flex-1 min-w-[12rem] text-sm p-1.5 rounded border border-zinc-300 focus:outline-none focus:border-blue-400" />
      <button disabled={disabled} onClick={() => void saveTitle()} className="text-xs font-medium px-2 py-1 rounded bg-zinc-900 text-white disabled:opacity-40">{COMMON_UI.save}</button>
      <button type="button" onClick={() => { setTitle(a.titleProposal ?? a.title ?? ''); setEditingTitle(false) }} className="text-xs underline text-zinc-600 mt-1">{COMMON_UI.cancel}</button>
    </div>
  ) : (
    <p className="text-sm font-semibold text-zinc-900" data-open-title>
      {a.title?.trim() || <span className="font-normal text-zinc-600">{RECORD_UI.noTitle}</span>}{' '}
      <button type="button" disabled={disabled} onClick={() => setEditingTitle(true)} className="text-xs font-medium underline text-zinc-700 ml-1 disabled:opacity-40">{RECORD_UI.editTitle}</button>
    </p>
  )
}

function OpenAction({ a, originals, ctx, step, hasCostLines, headingSelect, onBack }: { a: CanonicalAction; originals: CanonicalAction[]; ctx: OpenCtx; step: ActionsStep; hasCostLines: boolean; headingSelect: ReactNode; onBack?: () => void }) {
  const { live, byId, causeLite, disabled, ops, renderFull } = ctx
  const [keepNote, setKeepNote] = useState(a.conflictNote ?? '')
  const [why, setWhy] = useState('')
  const [seeOriginal, setSeeOriginal] = useState<string | null>(null)
  const others = live.filter((x) => x.id !== a.id)
  const facetSet = (patch: Record<string, unknown>) => void ops.run('setFacets', { actionId: a.id, patch }, undefined, () => 'Saved: the classification.')
  const sources = a.policyTest ? provenanceLine(a.policyTest.from) : ''
  const headingName = a.headingId ? ctx.headingName(a.headingId) : null
  // 170 — the same test as the import's, on this one action (a first test, or again after an edit)
  const testOne = () => void ops.run('testPolicy', { ids: [a.id] }, 'Lex is testing it against your Guiding Policy', testedWords)
  const saveKeep = async (note: string | null) => {
    const r = await ops.run('keepConflict', { actionId: a.id, note }, undefined, () => note ? `Saved: #${a.number ?? '?'} is kept, with your note.` : `Saved: the note on #${a.number ?? '?'} is cleared.`)
    if (r.ok && !note) setKeepNote('')
  }

  // ── 26-V1b §2a — ONE ORDER, top to bottom: Statement → jump band → policy test → Detail → Documents → Law → Who, how and against → Costs
  //    → Order → Comments. The CURRENT step's own section is open; another step's sits in its place under one line (§31: out of the way,
  //    never hidden). The statement and the Detail are the card's (renderFull); the band and the policy test are handed in between them.
  const policyBlock = (
          <div className="space-y-2">
            {/* 18 Oct (CCh B) - [policy test | heading menu] on one line, the test not full width; then avenue and causes. The statement above and the commentary below are the card's. */}
            <div className="flex flex-wrap items-start justify-between gap-2" data-test-line>
        {/* 170 — an action the consolidation never tested says so in words, and offers the test. */}
        {!a.policyTest && (
          <div className="rounded border border-zinc-200 bg-white p-2 text-xs w-fit max-w-[34rem]" data-not-tested-box>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{RECORD_UI.policyTest}</p>
            <p className="mt-0.5 text-zinc-900"><span className="font-semibold"><span aria-hidden>{POLICY_VERDICT_UI.NOT_TESTED.glyph}</span> {POLICY_VERDICT_UI.NOT_TESTED.word}.</span> No policy test has been run on this action yet.</p>
            <p className="mt-1"><button type="button" disabled={disabled} onClick={testOne} className="text-[11px] font-medium px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">{RECORD_UI.testAgainstPolicy}</button></p>
          </div>
        )}
        {/* DECISION 138 — WHY IT IS IN THE LIST, when the row is opened: what the policy test said and where the action came from. */}
        {a.policyTest && (
          <div className={`rounded bg-white p-2 text-xs w-fit max-w-[34rem] ${a.policyTest.verdict === 'CONFLICTS' ? 'border-2 border-zinc-900' : 'border border-zinc-200'}`}>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{RECORD_UI.policyTest}</p>
            <p className="mt-0.5 text-zinc-900">
              <span className="font-semibold"><span aria-hidden>{POLICY_VERDICT_UI[a.policyTest.verdict].glyph}</span> {POLICY_VERDICT_UI[a.policyTest.verdict].word}.</span>{' '}
              {a.policyTest.reason ?? <span className="text-zinc-500">No reason was recorded.</span>}
            </p>
            <p className="mt-1"><button type="button" disabled={disabled} onClick={testOne} className="text-[11px] font-medium px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">{a.policyTest.verdict === 'NOT_TESTED' ? RECORD_UI.testAgainstPolicy : RECORD_UI.testAgain}</button></p>
            {/* 26-S2 §3c — an action the policy conflicts with is ruled out, edited and re-tested, or KEPT WITH A NOTE. */}
            {a.policyTest.verdict === 'CONFLICTS' && (
              <div className="mt-1.5 space-y-1" data-keep-note>
                {a.conflictNote && <p className="text-zinc-900"><span className="font-semibold">{RECORD_UI.keptWithNote}</span> {a.conflictNote}</p>}
                <BoundedInput value={keepNote} onChange={setKeepNote} max={LIMITS.ruleOutReason} placeholder="Why you are keeping it, although the policy conflicts" aria-label={`Why action ${a.number ?? ''} is kept although it conflicts`}
                  className="w-full text-[11px] border border-zinc-300 rounded px-1.5 py-0.5" />
                <button type="button" disabled={disabled || keepNote.trim().length < 3 || keepNote.trim() === (a.conflictNote ?? '')} onClick={() => void saveKeep(keepNote.trim())}
                  className="text-[11px] font-medium px-2 py-0.5 rounded border border-zinc-300 disabled:opacity-40">{RECORD_UI.keepWithNote}</button>
                {a.conflictNote && <button type="button" disabled={disabled} onClick={() => void saveKeep(null)} className="text-[11px] underline text-zinc-600 ml-2 disabled:opacity-40">{RECORD_UI.clearNote}</button>}
              </div>
            )}
          </div>
        )}
            </div>
        <div className="rounded border border-zinc-200 bg-white p-2 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{RECORD_UI.facetsTitle}{activeConditions(ctx.conditions).length ? RECORD_UI.facetsTitleConditions : ''} {a.facetProposal && proposalStep(a.facetProposal).includes(1) && '— Lex has proposed some of it'}</p>
          {a.facetProposal && proposalStep(a.facetProposal).includes(1) && <FacetProposal a={a} step={1} causes={causeLite} others={others} conditions={ctx.conditions} onAccept={() => void ops.run('acceptFacets', { ids: [a.id], step: 1 })} onDismiss={() => void ops.run('dismissFacets', { ids: [a.id], step: 1 })} />}
          <div className="flex flex-wrap gap-2 items-center text-[11px]">
            <label className="flex items-center gap-1">{FACET_WORD.avenue}
              <select value={a.avenue ?? ''} onChange={(e) => facetSet({ avenue: e.target.value || null })} disabled={disabled} className="border border-zinc-300 rounded px-1 py-0.5">
                <option value="">not assigned</option>{AVENUES.map((v) => <option key={v} value={v}>{AVENUE_LABEL[v]}</option>)}
              </select></label>
          </div>
          <details className="text-[11px]">
            <summary className="cursor-pointer text-zinc-600">{FACET_WORD.causes}: {a.targetCauseIds.length ? a.targetCauseIds.map((id) => `#${causeLite.find((c) => c.id === id)?.number ?? '?'}`).join(', ') : 'none recorded'} {RECORD_UI.change}</summary>
            <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
              {causeLite.map((c) => (
                <li key={c.id}><label className="flex items-start gap-1.5">
                  <input type="checkbox" checked={a.targetCauseIds.includes(c.id)} disabled={disabled} className="mt-0.5 accent-zinc-900"
                    onChange={(e) => facetSet({ targetCauseIds: e.target.checked ? [...a.targetCauseIds, c.id] : a.targetCauseIds.filter((x) => x !== c.id) })} />
                  <span><span className="font-medium">#{c.number}</span> {c.cause}</span></label></li>
              ))}
            </ul>
          </details>
          <ConditionChooser a={a} doc={ctx.conditions} ops={ops} disabled={disabled} />
        </div>

          </div>
  )
  const pruneBlock = (
      <div className="space-y-2">
        {/* 26-S browser pass E — where it came from is a SOURCE of the record, not part of the verdict line. */}
        {sources && (
          <div className="rounded border border-zinc-200 bg-white p-2 text-xs" data-record-sources>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{RECORD_UI.sources}</p>
            <p className="mt-0.5 text-zinc-800">{sources}</p>
          </div>
        )}

        {originals.length > 0 && (
          <div className="rounded border border-zinc-200 bg-white p-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{RECORD_UI.originals}</p>
            <ul className="mt-1 space-y-1">
              {originals.map((o) => (
                <li key={o.id} className="text-[11px]">
                  <button type="button" onClick={() => setSeeOriginal(seeOriginal === o.id ? null : o.id)} aria-expanded={seeOriginal === o.id} className="text-left underline decoration-dotted">
                    #{o.number} — {actionLabel(o, 80)}
                  </button>
                  {seeOriginal === o.id && <p className="mt-1 text-zinc-700 whitespace-pre-wrap">{o.practicalStep}{o.whoImplements ? ` — ${o.whoImplements}` : ''}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <button disabled={disabled} onClick={() => void ops.run('park', { ids: [a.id], reason: why || null }, undefined, () => `Saved: #${a.number ?? '?'} moved to “Later phase”.`)} className="text-[11px] font-medium px-2 py-0.5 rounded border border-zinc-300 text-zinc-700">{RECORD_UI.laterPhase}</button>
          <button disabled={disabled || why.trim().length < 3} onClick={() => void ops.run('ruleOut', { ids: [a.id], reason: why }, undefined, () => `Saved: #${a.number ?? '?'} ruled out, with your reason. It is kept under “Ruled out and merged away”; Restore brings it back.`)} title={why.trim().length < 3 ? 'Give a reason first — it is kept so you can bring the action back.' : undefined}
            className="text-[11px] font-medium px-2 py-0.5 rounded border border-zinc-300 text-zinc-700 disabled:opacity-40">{RECORD_UI.ruleOut}</button>
          <BoundedInput value={why} onChange={setWhy} max={LIMITS.ruleOutReason} placeholder="Reason (needed to rule out)" aria-label={`Reason to rule out action ${a.number ?? ''}`}
            className="flex-1 min-w-[10rem] text-[11px] border border-zinc-300 rounded px-1.5 py-0.5" />
        </div>
      </div>
  )
  const section: Record<2 | 3 | 4, ReactNode> = {
    2: <div className="space-y-2"><ActionSlots a={a} others={others} disabled={disabled} run={ops.run as never} /></div>,
    3: <div className="space-y-2">{renderFull(a, 3)}</div>,
    // 26-V1b §7b (262) — Order by dependency only: "must come after #59, because …". Now / Next / Later is not on the screen.
    4: (
      <div className="space-y-1.5">
        {a.facetProposal && proposalStep(a.facetProposal).includes(4) && <FacetProposal a={a} step={4} causes={causeLite} others={others}
          onAccept={() => void ops.run('acceptFacets', { ids: [a.id], step: 4 }, undefined, (r: { refused?: string[] }) => r.refused?.length ? `Saved, but not all of it: ${r.refused.join(' ')}` : 'Saved: Lex’s proposed order for this action.')}
          onDismiss={() => void ops.run('dismissFacets', { ids: [a.id], step: 4 })} />}
        <OrderSection a={a} live={live} ops={ops} disabled={disabled} />
      </div>
    ),
  }
  // ── the record's facts (documents, law rows, comments) and the jump band (256) ──
  const facts = useRecordFacts(ctx.ideaId, a.id)
  const box = useRef<HTMLDivElement>(null)
  const jump = (k: RecordSection) => {
    const el = box.current?.querySelector<HTMLElement>(`[data-record-section="${k}"]`)
    if (!el) return
    if (el instanceof HTMLDetailsElement) el.open = true
    el.querySelectorAll<HTMLDetailsElement>(':scope > details').forEach((d) => { d.open = true })
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const docsLive = facts.docs?.documents.filter((d) => d.status !== 'SUPERSEDED') ?? []
  const needed = facts.docs?.needs.kinds ?? []
  const states = bandStates({
    detail: a.commentary,
    documents: facts.docs ? { needed: needed.length, drafted: docsLive.filter((d) => needed.includes(d.kind) && d.current).length, accepted: docsLive.filter((d) => needed.includes(d.kind) && d.status === 'ACCEPTED').length, total: docsLive.length } : null,
    lawRows: facts.docs?.lawRows ?? null,
    whoAnswered: answeredCount(a), whoOf: ALL_SLOTS.length,
    costs: a.noCostReason?.trim() ? 'no cost' : hasCostRange(a) || hasCostLines ? 'answered' : 'not answered',
    after: others.filter((o) => o.beforeIds.includes(a.id)).map((o) => o.number),
    comments: facts.comments,
  })
  // 265 (24 Oct) — every section of the record is closed when it opens; the band above names each one with its state, and each closed line
  // says the same. 26-X 308: there are no steps, so a line no longer says "this step" or "from step N" — EXCEPT the Drafts, which open at
  // the top of the record, open (§5a).
  const here = (line: string, _n: number) => line.replace(/ · from step \d$/, '')
  const closed = (key: string, n: number | null, line: ReactNode, body: ReactNode, opened = false) => (
    <details data-record-section={key} {...(n != null ? { 'data-step-section': n } : {})} open={opened || undefined} className="rounded border border-zinc-200 bg-white scroll-mt-10">
      <summary className="cursor-pointer px-2 py-1 text-[11px] text-zinc-700">{line}</summary>
      <div className="px-2 pb-2 pt-1 space-y-2">{body}</div>
    </details>
  )
  const stepPart = (n: 2 | 3 | 4, key: RecordSection) =>
    closed(key, n, here(otherStepLine(n, a, hasCostLines, headingName, afterOf(live, a.id, becauseFor(live))), n), section[n])
  const titled = (key: RecordSection, title: string, body: ReactNode, opened = false) =>
    closed(key, null, <><span className="font-semibold">{title}</span> · <span data-section-state>{states[key]}</span></>, body, opened)
  return (
    <div ref={box} className="border-t-2 border-zinc-300 px-2.5 py-2 space-y-2" data-record-order="26x">
      {/* 318 — the way back, at the top of the record: Organising at the same scroll position, with its find box and filters as they were */}
      {onBack && <p><button type="button" onClick={onBack} data-back-to-organising className="text-xs font-semibold px-2 py-0.5 rounded border-2 border-zinc-900 bg-white">{PAGE_UI.backToOrganising}</button></p>}
      {/* §5a — the Drafts section, OPEN, at the top of the record (5c's full order, with the Brief above the Draft, is part X2) */}
      {titled('documents', sectionLabel('documents'), <DocumentsSection ideaId={ctx.ideaId} a={a} facts={facts} disabled={disabled} onChanged={() => void ops.refresh()} />, true)}
      {renderFull(a, 1, (
        <div className="space-y-2">
          <JumpBand states={states} onJump={jump} headingSelect={headingSelect} />
          {closed('policy', 1, here(otherStepLine(1, a, hasCostLines, headingName), 1), policyBlock)}
        </div>
      ))}
      {titled('law', sectionLabel('law'), <LawSection facts={facts} number={a.number} />)}
      {/* CCh-Lex 4 Nov (2), item 1 — "Who, how and against" stays a record section until X3 moves it to the Deepening */}
      {stepPart(2, 'who')}
      {stepPart(3, 'costs')}
      {stepPart(4, 'order')}
      {closed('prune', null, RECORD_UI.pruneLine, pruneBlock)}
      {/* 26-T2 §6 - the comment thread, at the foot of the record on every step */}
      <div data-record-section="comments" className="scroll-mt-10"><ActionComments ideaId={ctx.ideaId} actionId={a.id} number={a.number} /></div>
    </div>
  )
}

// ── pieces ───────────────────────────────────────────────────────────────────────────────────────────────

function GroupHeader<T>({ g, h, compact = false, ops, disabled, archived = 0, onShowArchived, onConsolidate }: { compact?: boolean; g: { key: string; label: string; colourKey?: string; hidden?: boolean; actions: T[] }; h?: CanonicalActionHeading; ops: ReturnType<typeof useOps>; disabled: boolean; archived?: number; onShowArchived?: () => void; onConsolidate?: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(g.label)
  const c = g.colourKey ? colourFor(g.colourKey) : null
  return (
    <div className="flex flex-wrap items-center gap-2 mb-1 pb-0.5 border-b border-zinc-200" style={c ? { borderBottom: `3px solid ${c.hex}` } : undefined}>
      {c && <span aria-hidden style={{ color: c.hex }} className="text-base leading-none">{c.glyph}</span>}
      {editing && h ? (
        <>
          <BoundedInput value={name} onChange={setName} max={LIMITS.headingName} aria-label={`New name for the heading ${h.name}`} className="text-sm border border-zinc-300 rounded px-1.5 py-0.5" />
          <button disabled={disabled || !name.trim()} onClick={async () => { const r = await ops.run('updateHeading', { headingId: h.id, name }, undefined, () => `Saved: the heading is now called “${name.trim()}”.`); if (r.ok) setEditing(false) }} className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-zinc-900 text-white">{COMMON_UI.save}</button>
          <button onClick={() => { setName(g.label); setEditing(false) }} className="text-[11px] underline">{COMMON_UI.cancel}</button>
        </>
      ) : (
        <h4 className="text-sm font-semibold text-zinc-900">{g.label}</h4>
      )}
      <span className="text-[11px] text-zinc-500">{g.actions.length} action{g.actions.length === 1 ? '' : 's'}{c ? ` · ${c.name}` : ''}
        {archived > 0 && (<> · {onShowArchived ? <button type="button" onClick={onShowArchived} className="underline font-medium text-zinc-700" data-archived-count>{archived} archived</button> : <span data-archived-count>{archived} archived</span>}</>)}
      </span>
      {h && compact && (
        <span className="ml-auto flex gap-2 items-center text-[11px]">
          <button disabled={disabled} data-heading-hide onClick={() => void ops.run('updateHeading', { headingId: h.id, hidden: !h.hidden })} className="underline text-zinc-600">{h.hidden ? RECORD_UI.show : RECORD_UI.hide}</button>
        </span>
      )}
      {h && !compact && !editing && (
        <span className="ml-auto flex flex-wrap gap-2 items-center text-[11px]">
          {onConsolidate && <button type="button" disabled={disabled} onClick={onConsolidate} data-consolidate-button title="Lex looks for actions here that are only parts of another, and for two saying the same thing. Nothing is deleted; each can be restored." className="font-medium px-1.5 py-0.5 rounded border border-zinc-300 text-zinc-800 disabled:opacity-40">{RECORD_UI.consolidateHeading}</button>}
          <button onClick={() => setEditing(true)} className="underline text-zinc-600">{RECORD_UI.rename}</button>
          <select value={h.colourKey} disabled={disabled} onChange={(e) => void ops.run('updateHeading', { headingId: h.id, colourKey: e.target.value })} aria-label={`Colour for ${h.name}`} className="border border-zinc-300 rounded px-1 py-0.5">
            {HEADING_PALETTE.map((p) => <option key={p.key} value={p.key}>{p.glyph} {p.name}</option>)}
          </select>
          {/* 26-V2c (268, revised) — the heading's kind: the type of instrument its actions make, set by the owner. "Platform" derives a specification for each. */}
          <label className="flex items-center gap-1" title="The type of instrument this heading's actions make. “Platform” means each action under it needs a specification.">
            <span className="text-zinc-600">{RECORD_UI.headingKind}</span>
            <select value={h.kind ?? ''} disabled={disabled} data-heading-kind={h.kind ?? 'none'}
              onChange={(e) => { const kind = (e.target.value || null) as HeadingKind | null; void ops.run('updateHeading', { headingId: h.id, kind }, undefined, () => `Saved: “${h.name}” is now ${kind ? `a ${HEADING_KIND_WORD[kind]} heading` : 'a heading with no kind'}${kind === 'PLATFORM' ? ' — each action under it needs a specification' : ''}.`) }}
              aria-label={`Kind of instrument for ${h.name}`} className="border border-zinc-300 rounded px-1 py-0.5">
              <option value="">not yet said</option>
              {HEADING_KINDS.map((k) => <option key={k} value={k}>{HEADING_KIND_WORD[k]}</option>)}
            </select>
          </label>
          <button disabled={disabled} onClick={() => void ops.run('updateHeading', { headingId: h.id, hidden: !h.hidden })} className="underline text-zinc-600">{h.hidden ? RECORD_UI.show : RECORD_UI.hide}</button>
          <button disabled={disabled} onClick={() => { if (g.actions.length === 0 || window.confirm(`Retire the heading “${h.name}”? Its ${g.actions.length} action(s) stay, with no heading. Nothing is deleted: “Bring back” under Retired headings restores it.`)) void ops.run('deleteHeading', { headingId: h.id }, undefined, () => `Saved: the heading “${h.name}” is retired; its actions stay, with no heading. Bring it back under Retired headings.`) }} className="underline text-zinc-500">{RECORD_UI.retireHeading}</button>
        </span>
      )}
      {/* 26-V2c (268, revised) — Lex's proposed kind waits beside the heading for the owner: Accept or Not this. It never sets the kind itself. */}
      {h && !compact && h.proposedKind && isHeadingKind(h.proposedKind) && (
        <p className="basis-full text-[11px] border border-zinc-900 rounded px-1.5 py-0.5" data-kind-proposal={h.proposedKind}>
          <span aria-hidden>◇</span> <span className="font-semibold">Lex proposes the kind “{HEADING_KIND_WORD[h.proposedKind]}”</span>{h.kind ? ` (now “${isHeadingKind(h.kind) ? HEADING_KIND_WORD[h.kind] : h.kind}”)` : ''}{h.proposedKindReason ? ` — ${h.proposedKindReason}` : ''}{' '}
          <button type="button" disabled={disabled} data-kind-accept onClick={() => void ops.run('answerKindProposal', { headingId: h.id, accept: true }, undefined, () => `Saved: “${h.name}” is now a ${HEADING_KIND_WORD[h.proposedKind as HeadingKind]} heading${h.proposedKind === 'PLATFORM' ? ' — each action under it needs a specification' : ''}.`)}
            className="ml-1 px-1.5 py-0.5 rounded bg-zinc-900 text-white font-medium disabled:opacity-40">{COMMON_UI.accept}</button>{' '}
          <button type="button" disabled={disabled} data-kind-dismiss onClick={() => void ops.run('answerKindProposal', { headingId: h.id, accept: false }, undefined, () => `Saved: Lex’s proposal for “${h.name}” is set aside; its kind is unchanged.`)}
            className="underline">{RECORD_UI.notThis}</button>
        </p>
      )}
    </div>
  )
}

function CollapsedBlock({ id, title, count, hint, open, onToggle, children }: { id?: string; title: string; count: number; hint: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <section id={id} className="rounded-lg border border-zinc-200">
      <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-baseline gap-2 px-2.5 py-1.5 text-left">
        {/* data-label-part / data-shown-value: check:lex-26w-b reads the title and the toggle as labels, the count and the hint as not */}
        <span className="text-sm font-semibold text-zinc-800" data-label-part>{title}</span><span className="text-[11px] text-zinc-500" data-shown-value>{count}</span>
        <span className="text-[11px] text-zinc-400 flex-1" data-shown-value>{hint}</span><span className="text-[11px] text-zinc-500" data-label-part>{open ? WORKSPACE_UI.blockHide : WORKSPACE_UI.blockShow}</span>
      </button>
      {open && <div className="px-2.5 pb-2">{children}</div>}
    </section>
  )
}

/** 26-S2 §3 — advisory, never blocking: each line is a shape AND words ("✓" done, "○" not yet), with its count. */
function StepChecklist({ step, lines }: { step: ActionsStep; lines: Array<{ key: string; done: boolean; text: string }> }) {
  const open = lines.filter((l) => !l.done).length
  return (
    <section aria-label={`Checklist for step ${step}: ${STEPS[step].label}`} className="rounded-lg border border-zinc-300 bg-zinc-50 p-2.5" data-step-checklist={step}>
      <p className="text-xs font-semibold text-zinc-800">Step {step} checklist — {open === 0 ? 'all done' : `${open} thing${open === 1 ? '' : 's'} still open`}. <span className="font-normal text-zinc-600">Advisory: it never stops you moving on.</span></p>
      <ul className="mt-1 space-y-0.5">
        {lines.map((l) => (
          <li key={l.key} className={`text-[11px] ${l.done ? 'text-zinc-600' : 'text-zinc-900 font-medium'}`}>
            <span aria-hidden>{l.done ? '✓' : '○'}</span> <span className="sr-only">{l.done ? 'Done: ' : 'Not yet: '}</span>{l.text}
          </li>
        ))}
      </ul>
    </section>
  )
}

function FacetProposal({ a, step, causes, others, onAccept, onDismiss, conditions }: { a: CanonicalAction; step: ActionsStep; causes: Array<{ id: string; number: number | null }>; others: CanonicalAction[]; onAccept: () => void; onDismiss: () => void; conditions?: ConditionsDoc }) {
  const p = a.facetProposal!
  const bits: string[] = []
  if (step === 1 && p.supportOnly) bits.push('marked as support (delivers no condition directly)')
  if (step === 1 && p.conditionIds?.length && conditions) bits.push(`delivers condition${p.conditionIds.length === 1 ? '' : 's'} ${conditionWords(conditions, { id: a.id, conditionIds: p.conditionIds, supportOnly: false })}`)
  // only THIS step's part of the proposal is shown and accepted here; "link" is retired (decision 167)
  if (step === 1 && p.targetCauseIds?.length) bits.push(`causes ${p.targetCauseIds.map((id) => `#${causes.find((c) => c.id === id)?.number ?? '?'}`).join(', ')}`)
  if (step === 1 && p.avenue) bits.push(`avenue ${AVENUE_LABEL[p.avenue as keyof typeof AVENUE_LABEL] ?? p.avenue}`)
  // 262: an old proposal's Now / Next / Later is not shown (accepting drops it)
  if (step === 4 && p.beforeIds?.length) bits.push(`comes before ${p.beforeIds.map((id) => `#${others.find((o) => o.id === id)?.number ?? '?'}`).join(', ')}`)
  return (
    <p className="text-[11px] bg-zinc-50 border border-zinc-200 rounded px-1.5 py-1">
      <span className="font-semibold">{RECORD_UI.lexProposes}</span> {bits.join(' · ') || 'nothing more than is already set'}.{' '}
      <button onClick={onAccept} className="underline font-medium ml-1">{COMMON_UI.accept}</button><button onClick={onDismiss} className="underline ml-2 text-zinc-500">{COMMON_UI.dismiss}</button>
    </p>
  )
}

function PairPanel({ ideaId, a, b, mode, ops, onClose, byNumber }: { ideaId: string; a: number; b: number; mode: 'merge' | 'compare'; ops: ReturnType<typeof useOps>; onClose: () => void; byNumber: (n: number) => CanonicalAction | undefined }) {
  void ideaId
  type Answer = { verdict: 'MERGE' | 'ONE_CONTAINS_THE_OTHER' | 'SEQUENCE' | 'CONTRADICTORY'; reasoning: string; merged: { title: string; practicalStep: string } | null; subordinateNumber: number | null }
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [edited, setEdited] = useState<{ title: string; practicalStep: string } | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [pairReason, setPairReason] = useState('')
  const A = byNumber(a), B = byNumber(b)
  const judge = async () => {
    const r = await ops.run('judgeMerge', { a, b }, 'Lex is comparing them')
    if (r.ok && r.result) { setAnswer(r.result.answer); setEdited(r.result.answer.merged) }
  }
  const apply = async () => {
    if (!answer) return
    const r = await ops.run('applyMerge', { a, b, answer: { ...answer, merged: edited ?? answer.merged } }, 'merging')
    if (r.ok && r.result) setDone(r.result.kind === 'MERGED' ? `Merged into #${r.result.resultNumber}. The originals are kept beneath it.` : `Joined into #${r.result.resultNumber}. The other is kept, marked merged away.`)
  }
  const VERDICT: Record<string, string> = {
    MERGE: 'Merge — parts of one thing to do', ONE_CONTAINS_THE_OTHER: 'One contains the other', SEQUENCE: 'Sequence — separate; one goes first', CONTRADICTORY: 'Contradictory — they cannot both be done',
  }
  return (
    <section className="rounded-lg border-2 border-zinc-900 bg-white p-2.5 space-y-2" aria-label={mode === 'merge' ? 'Merge two actions' : 'Compare two actions'}>
      <div className="flex items-center gap-2"><h4 className="text-sm font-semibold">{mode === 'merge' ? 'Lex reviews, then merges' : 'Compare'} #{a} and #{b}</h4><button onClick={onClose} className="ml-auto text-xs underline">Close</button></div>
      <div className="grid sm:grid-cols-2 gap-2">
        {[A, B].map((x, i) => (
          <div key={i} className="rounded border border-zinc-200 p-2 text-[11px] text-zinc-800">
            <p className="font-semibold">#{x?.number} {x?.title ?? ''}</p>
            <p className="mt-0.5 whitespace-pre-wrap">{x?.practicalStep}</p>
            {x?.whoImplements && <p className="mt-0.5 text-zinc-500">Who: {x.whoImplements}</p>}
          </div>
        ))}
      </div>
      {/* 197 - the user decides: three one-press controls beside Lex's review. Each RULES OUT (never deletes) with a reason that is already worded
          ("Duplicate of #n" / "Neither needed"); typing in the box replaces it before the press. The same strip confirms ("#b ruled out") or refuses ("Not saved: …"). */}
      {!done && A && B && (
        <div className="flex flex-wrap items-center gap-1.5" data-pair-ruleout>
          {([
            { key: 'keepA', label: `Keep #${a}, rule out #${b}`, ids: [B.id], nums: `#${b}`, dflt: `Duplicate of #${a}` },
            { key: 'keepB', label: `Keep #${b}, rule out #${a}`, ids: [A.id], nums: `#${a}`, dflt: `Duplicate of #${b}` },
            { key: 'both', label: 'Rule out both', ids: [A.id, B.id], nums: `#${a} and #${b}`, dflt: 'Neither needed' },
          ] as Array<{ key: string; label: string; ids: string[]; nums: string; dflt: string }>).map((o) => {
            const why = (pairReason.trim() || o.dflt).slice(0, LIMITS.ruleOutReason)
            return (
              <button key={o.key} type="button" disabled={!!ops.busy} data-pair-ruleout-button={o.key} title={`Rules out ${o.nums} with the reason “${why}”. Nothing is deleted; Restore brings it back.`}
                onClick={async () => {
                  const r = await ops.run('ruleOut', { ids: o.ids, reason: why }, undefined, () => `${o.nums} ruled out (“${why}”). Kept under “Ruled out and merged away”; Restore brings ${o.ids.length === 1 ? 'it' : 'them'} back.`)
                  if (r.ok) onClose()
                }}
                className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-400 text-zinc-900 hover:bg-zinc-50 disabled:opacity-40">{o.label}</button>
            )
          })}
          <BoundedInput value={pairReason} onChange={setPairReason} max={LIMITS.ruleOutReason} placeholder="Reason — or leave it: “Duplicate of #n” / “Neither needed”" aria-label="Reason to rule out (leave empty to use the worded one)"
            className="text-xs border border-zinc-300 rounded px-1.5 py-0.5 w-72 max-w-full" />
        </div>
      )}
      {!answer && !done && <button disabled={!!ops.busy} onClick={judge} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white disabled:opacity-40">{mode === 'merge' ? 'Ask Lex how they relate' : 'Compare them'}</button>}
      {answer && (
        <div className="space-y-1.5">
          <p className="text-xs"><span className="font-semibold">Lex’s verdict:</span> {VERDICT[answer.verdict] ?? answer.verdict}</p>
          <p className="text-[11px] text-zinc-700 whitespace-pre-wrap">{answer.reasoning}</p>
          {(answer.verdict === 'MERGE' || answer.verdict === 'ONE_CONTAINS_THE_OTHER') && answer.merged && edited && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold">{answer.verdict === 'MERGE' ? 'The merged action' : `The containing action, restated (#${answer.subordinateNumber === a ? b : a})`} — edit it if you like:</p>
              <input value={edited.title} onChange={(e) => setEdited({ ...edited, title: e.target.value })} className="w-full text-sm p-1.5 rounded border border-zinc-300" />
              <textarea value={edited.practicalStep} onChange={(e) => setEdited({ ...edited, practicalStep: e.target.value })} rows={3} className="w-full text-xs p-1.5 rounded border border-zinc-300" />
              <p className="text-[11px] text-zinc-700" data-statement-count>{edited.practicalStep.length > LIMITS.actionStatement
                ? `${edited.practicalStep.length} characters: the statement keeps the first ${LIMITS.actionStatement}, and the whole wording is kept in its Action details — nothing is dropped.`
                : `${LIMITS.actionStatement - edited.practicalStep.length} left of ${LIMITS.actionStatement}.`}</p>
            </div>
          )}
          {mode === 'merge' && (answer.verdict === 'MERGE' || answer.verdict === 'ONE_CONTAINS_THE_OTHER') && !done && (
            <button disabled={!!ops.busy} onClick={apply} className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white disabled:opacity-40">{answer.verdict === 'MERGE' ? 'Merge them' : `Join #${answer.subordinateNumber} into #${answer.subordinateNumber === a ? b : a}`}</button>
          )}
          {mode === 'merge' && answer.verdict === 'SEQUENCE' && answer.subordinateNumber != null && <p className="text-[11px] text-zinc-600">Nothing is merged. In step 4, open #{answer.subordinateNumber} and say it must come after #{answer.subordinateNumber === a ? b : a}, and why.</p>}
          {mode === 'merge' && answer.verdict === 'CONTRADICTORY' && <p className="text-[11px] text-zinc-600">Nothing is merged. Rule one of them out, with a reason, or keep both and say why.</p>}
        </div>
      )}
      {done && <p className="text-xs font-semibold text-zinc-800" role="status">✓ {done}</p>}
    </section>
  )
}

function DuplicatesPanel({ data, onClose, onMerge, causes }: { data: { pairs: Array<{ a: string; b: string; aNumber: number | null; bNumber: number | null; aLabel: string; bLabel: string; score: number; sharedCauseIds: string[] }>; ignoredUniversalCauses: Array<{ number: number; cause: string }> }; onClose: () => void; onMerge: (a: number, b: number) => void; causes: Array<{ id: string; number: number | null }> }) {
  return (
    <section className="rounded-lg border border-zinc-300 bg-white p-2.5 space-y-1.5" aria-label="Possible duplicates">
      <div className="flex items-center gap-2"><h4 className="text-sm font-semibold">Possible duplicates — closest first</h4><button onClick={onClose} className="ml-auto text-xs underline">Close</button></div>
      {data.pairs.length === 0 && <p className="text-[11px] text-zinc-600">No two actions read as close enough to be duplicates.</p>}
      <ul className="space-y-1">
        {data.pairs.map((p) => (
          <li key={`${p.a}-${p.b}`} className="flex items-start gap-2 text-[11px] border border-zinc-200 rounded px-2 py-1">
            <span className="shrink-0 font-semibold tabular-nums w-10">{Math.round(p.score * 100)}%</span>
            <span className="flex-1"><span className="font-medium">#{p.aNumber}</span> {p.aLabel}<br /><span className="font-medium">#{p.bNumber}</span> {p.bLabel}
              {p.sharedCauseIds.length > 0 && <span className="text-zinc-500"> · both attack cause{p.sharedCauseIds.length === 1 ? '' : 's'} {p.sharedCauseIds.map((id) => `#${causes.find((c) => c.id === id)?.number ?? '?'}`).join(', ')}</span>}</span>
            <button onClick={() => p.aNumber != null && p.bNumber != null && onMerge(p.aNumber, p.bNumber)} className="shrink-0 font-medium px-1.5 py-0.5 rounded border border-zinc-300">Merge?</button>
          </li>
        ))}
      </ul>
      {data.ignoredUniversalCauses.length > 0 && <p className="text-[11px] text-zinc-500">Ignored as evidence of similarity — nearly every action attacks {data.ignoredUniversalCauses.length === 1 ? 'this cause' : 'these causes'}: {data.ignoredUniversalCauses.map((c) => `#${c.number}`).join(', ')}.</p>}
    </section>
  )
}

export function CoverageView({ actions, causes, headings }: { actions: CanonicalAction[]; causes: Array<{ id: string; number: number | null; cause: string }>; headings: CanonicalActionHeading[] }) {
  const grid = coverageGrid(actions, causes)
  const cols = useMemo(() => {
    const out: Array<{ a: CanonicalAction; heading: CanonicalActionHeading | null }> = []
    for (const h of headings) for (const a of actions.filter((x) => x.headingId === h.id)) out.push({ a, heading: h })
    for (const a of actions.filter((x) => !x.headingId || !headings.some((h) => h.id === x.headingId))) out.push({ a, heading: null })
    return out
  }, [actions, headings])
  return (
    <section aria-label="Coverage grid: causes by actions" className="space-y-1.5">
      <p className="text-[11px] text-zinc-600">Each row is a cause; each column an action. <span className="font-semibold">●</span> means the action attacks that cause. <span className="font-semibold">An empty row is a cause with no action against it.</span>{' '}
        {grid.recorded.linked} of {grid.recorded.total} actions have a recorded cause{grid.recorded.linked < grid.recorded.total ? ' — use “Classify with Lex” to propose the rest' : ''}.</p>
      {grid.uncovered.length > 0 && (
        <div className="rounded border-2 border-zinc-900 bg-white p-2 text-[11px]">
          <p className="font-semibold">{grid.uncovered.length} cause{grid.uncovered.length === 1 ? ' has' : 's have'} no action against {grid.uncovered.length === 1 ? 'it' : 'them'}:</p>
          <ul className="list-disc pl-4">{grid.uncovered.map((u) => <li key={u.id}><span className="font-medium">Cause {u.number}</span> — {u.cause}</li>)}</ul>
        </div>
      )}
      <div className="overflow-x-auto rounded border border-zinc-200">
        <table className="text-[11px] border-collapse">
          <thead>
            <tr><th className="sticky left-0 bg-white border-b border-zinc-200 px-2 py-1 text-left min-w-[14rem]">Cause</th>
              {cols.map(({ a, heading }) => (
                <th key={a.id} className="border-b border-zinc-200 px-1 py-1 font-medium align-bottom" title={`${actionLabel(a)}${heading ? ` — ${heading.name}` : ''}`} style={heading ? { borderBottom: `4px solid ${colourFor(heading.colourKey).hex}` } : undefined}>
                  <div className="tabular-nums">#{a.number}</div>{heading && <div className="text-[9px] text-zinc-500 max-w-[4rem] truncate">{colourFor(heading.colourKey).glyph} {heading.name}</div>}
                </th>))}</tr>
          </thead>
          <tbody>
            {grid.causes.map((r) => (
              <tr key={r.id} className={r.actionIds.length === 0 ? 'bg-zinc-100' : ''}>
                <th scope="row" className="sticky left-0 bg-inherit border-b border-zinc-100 px-2 py-1 text-left font-normal">
                  <span className="font-semibold">{r.number}.</span> {r.cause.length > 90 ? `${r.cause.slice(0, 89)}…` : r.cause}
                  {r.actionIds.length === 0 && <span className="ml-1 font-semibold text-zinc-900">— NO ACTION</span>}
                </th>
                {cols.map(({ a }) => <td key={a.id} className="border-b border-zinc-100 text-center px-1">{r.actionIds.includes(a.id) ? <span aria-label="attacks this cause">●</span> : <span className="text-zinc-200" aria-hidden>·</span>}</td>)}
              </tr>))}
          </tbody>
        </table>
      </div>
      {grid.unlinkedActionIds.length > 0 && <p className="text-[11px] text-zinc-500">{grid.unlinkedActionIds.length} action{grid.unlinkedActionIds.length === 1 ? ' has' : 's have'} no recorded cause, so the grid cannot place {grid.unlinkedActionIds.length === 1 ? 'it' : 'them'}: {grid.unlinkedActionIds.map((id) => `#${actions.find((a) => a.id === id)?.number}`).join(', ')}.</p>}
    </section>
  )
}


/**
 * DECISION 138 — the one thing the old "Added from the consolidation" box did that is not a property of an action: the RETRY. Ideas
 * lifted from the drafts are HELD until the settled guiding policy has tested them; if the step did not complete, they stay held and
 * this says so, with the button to run it again. It shows nothing when nothing is held. (The added actions themselves are in the
 * list above, each with its verdict.)
 */
function HeldFromConsolidation({ ideaId, onChanged }: { ideaId: string; onChanged: () => void }) {
  const [held, setHeld] = useState(0)
  const [settled, setSettled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/action-ideas`)
      if (!res.ok) return
      const j = await res.json()
      setHeld(Number(j.held) || 0); setSettled(!!j.settledPolicyId)
    } catch { /* a notice that cannot load simply does not show */ }
  }, [ideaId])
  useEffect(() => { void load() }, [load])
  if (!(held > 0 && settled)) return msg ? <p role="alert" className="text-[11px] font-semibold text-amber-800">⚠ {msg}</p> : null
  return (
    <p className="text-[11px] text-zinc-800 rounded border border-zinc-300 bg-zinc-50 px-2 py-1.5">
      {held} idea{held === 1 ? '' : 's'} from the consolidation {held === 1 ? 'is' : 'are'} being held and not yet in your list.{' '}
      <button type="button" disabled={busy} className="underline font-medium disabled:opacity-40"
        onClick={async () => {
          setBusy(true); setMsg(null)
          try {
            const res = await fetch(`/api/ideas/${ideaId}/action-ideas`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'test' }) })
            const j = await res.json().catch(() => ({}))
            if (!res.ok) { setMsg(explainFailure(j, res.status, 'Testing the held ideas')); return }
            await load(); onChanged()
          } finally { setBusy(false) }
        }}>
        {busy ? 'Adding…' : 'Test and add them now'}
      </button>
      {msg && <span role="alert" className="block font-semibold text-amber-800 mt-1">⚠ {msg}</span>}
    </p>
  )
}
