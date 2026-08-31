'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  fieldDef,
  type CanonicalState, type CanonicalField, type CanonicalCause, type CauseClassification,
  type CanonicalPolicyOption, type CanonicalAction, type CanonicalBenchmark, type CanonicalCostLine, type CostRange,
} from '@/lib/lex/page1-config'
import { accentFor } from '@/lib/lex/stage-accents'
import { SLOT_LABELS } from '@/lib/lex/page2-config'
import { MECHANISM_TYPES } from '@/lib/lex/page3-config'
import { COST_CATEGORIES } from '@/lib/lex/page4-config'

// Grouped causes-loop + root-cause handlers (Page 2). Kept as one object so the panel
// signature stays readable.
export interface CausesApi {
  add: (input: { cause: string; whyPersisted?: string; evidence?: string; parentCauseId?: string }) => void
  update: (causeId: string, patch: { cause?: string; whyPersisted?: string; evidence?: string }) => void
  remove: (causeId: string) => void
  classify: (causeId: string, classification: CauseClassification) => void
  confirm: () => void
  skip: () => void
  setRoot: (causeId: string) => void
  skipRoot: () => void
}

// §16.2 soft depth cap: beyond this Lex nudges consolidation rather than more depth.
const MAX_CAUSE_DEPTH = 4

// Page 3 policy-options loop + chosen-approach handlers.
export interface PolicyApi {
  add: (input: { approach: string; caseFor?: string; caseAgainst?: string; mechanismTypes?: string[] }) => void
  update: (optionId: string, patch: { approach?: string; caseFor?: string; caseAgainst?: string; mechanismTypes?: string[] }) => void
  remove: (optionId: string) => void
  ruleOut: (optionId: string, reason: string) => void
  confirm: () => void
  skip: () => void
  choose: (optionId: string) => void
  skipChoose: () => void
}

// Page 4 actions loop + costing handlers.
export interface ActionDraft {
  practicalStep: string
  mechanismType?: string | null
  whoImplements?: string | null
  targetOrganisation?: string | null
  wording?: string | null
  benefits?: Record<string, string> | null
  implementationCost?: CostRange | null
  enforcementCost?: CostRange | null
  regulatoryFriction?: CostRange | null
}
export interface ActionsApi {
  add: (input: ActionDraft) => void
  update: (actionId: string, patch: Partial<ActionDraft>) => void
  remove: (actionId: string) => void
  confirm: () => void
  skip: () => void
}

// §19-C Task 6 — cost lines under an action.
export interface CostLineDraft {
  label: string
  costType?: CanonicalCostLine['costType']
  category?: CanonicalCostLine['category']
  staffLevel?: CanonicalCostLine['staffLevel']
  fteCount?: number | null
  durationMonths?: number | null
  low?: number | null
  high?: number | null
  basis?: string | null
  benchmarkId?: string | null
  priceYear?: number | null
}
export interface StaffSuggestion {
  low: number | null
  high: number | null
  unit: string
  benchmarkId: string
  priceYear: number | null
  basis: string
}
export interface CostLinesApi {
  add: (actionId: string, input: CostLineDraft) => void
  update: (lineId: string, patch: Partial<CostLineDraft>) => void
  remove: (lineId: string) => void
  suggest: (staffLevel: 'JUNIOR' | 'MID' | 'SENIOR', fteCount: number, durationMonths: number) => Promise<StaffSuggestion | null>
}

const COST_TYPES: CanonicalCostLine['costType'][] = ['STAFF', 'CAPITAL', 'PROPERTY', 'RESEARCH', 'OTHER']
const COST_CATEGORY_LABEL: Record<CanonicalCostLine['category'], string> = {
  IMPLEMENTATION: 'Implementation (one-off)',
  ENFORCEMENT: 'Enforcement (ongoing)',
  FRICTION: 'Friction on the economy (ongoing)',
}

function hintsFor(key: string): string[] {
  return fieldDef(key)?.hints ?? []
}

// §19-E Task 7 — the stage-level hint, VERBATIM from the brief for Diagnosis. Keyed by
// page so a later stage can have its own; a stage with no entry shows nothing rather
// than a generic line, because a hint that applies everywhere teaches nothing.
const STAGE_HINT: Record<string, string> = {
  DIAGNOSIS:
    'Dictating is a faster way to get your ideas down — Lex will tidy up your thoughts. ' +
    'You can answer in the chat or write straight into the boxes here; either works.',
}

// ─── §19-E Task 5 — the editing surface ──────────────────────────────────────
//
// Charlie, with screenshots: the field editors show about two and a half lines of what
// is often a long Lex draft. `whatItRulesOut` on his run was 579 characters and
// `conditionsForSuccess` 1,282 — read three lines at a time, through a scrollbar, in a
// box the user could not resize because every textarea carried `resize-none`.
//
// // A draft you cannot read is a draft you cannot judge, and judging the draft is the
// // user's entire job on this panel.
//
// GrowTextarea does three things:
//   1. Sizes itself to its CONTENT on mount and on every change, so a long draft is
//      simply visible — no scrolling to find out what Lex wrote.
//   2. Has a floor (so an empty box still looks like somewhere to write) and a ceiling
//      (so a 3,000-character value does not push the Save button off the screen — past
//      the ceiling it scrolls, which is the honest behaviour for something genuinely
//      longer than the panel).
//   3. Is DRAG-RESIZABLE (`resize-y`), and once the user drags it, auto-sizing stops
//      for that box. A control that springs back to a computed height the moment you
//      type in it is worse than one that never moved.
const GROW_MIN_ROWS = 8
const GROW_MAX_PX = 520

function GrowTextarea({
  value, onChange, placeholder, minRows = GROW_MIN_ROWS, className = '',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  minRows?: number
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  // Set by the resize observer the moment the user drags the handle. From then on this
  // box's height is theirs, not ours.
  const [userSized, setUserSized] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || userSized) return
    // `auto` first: without it scrollHeight never shrinks, so deleting text leaves the
    // box at its high-water mark for the rest of the session.
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, GROW_MAX_PX)}px`
  }, [value, userSized])

  // The drag handle writes an inline height. Watching for a height that differs from
  // the one we computed is how we know the user moved it — there is no resize event on
  // a textarea drag, so this is the only honest signal.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    let ours = el.clientHeight
    const obs = new ResizeObserver(() => {
      if (!ref.current) return
      const h = ref.current.clientHeight
      // A 2px tolerance: sub-pixel layout changes are not a drag.
      if (Math.abs(h - ours) > 2 && !userSized) setUserSized(true)
      ours = h
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [userSized])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={minRows}
      placeholder={placeholder}
      className={`w-full text-sm p-2 rounded-lg border border-zinc-200 bg-white resize-y overflow-auto focus:outline-none focus:border-blue-400 ${className}`}
    />
  )
}

// §19-C Task 7 — Save is grey until there is something to save. A pending Lex proposal
// is different: "Save & accept" genuinely awaits a press, so it stays black from the off.
function saveClass(enabled: boolean): string {
  return enabled
    ? 'text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40'
    : 'text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-200 text-zinc-500 disabled:opacity-60'
}

function isTerminal(f: CanonicalField) {
  return f.status === 'ACCEPTED' || f.status === 'SKIPPED'
}

function Tick() {
  return (
    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function StatusDot({ status }: { status: CanonicalField['status'] }) {
  const cls =
    status === 'ACCEPTED' ? 'bg-green-500'
      : status === 'SKIPPED' ? 'bg-zinc-300'
      : status === 'AWAITING_CONFIRMATION' ? 'bg-amber-400'
      : 'bg-zinc-200'
  return (
    <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${cls}`}>
      {status === 'ACCEPTED' && <Tick />}
    </span>
  )
}

function FieldHeader({ field, right }: { field: CanonicalField; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-1.5">
      <StatusDot status={field.status} />
      <span className="text-sm font-medium text-zinc-800 flex-1">{field.label}</span>
      {right}
    </div>
  )
}

// A narrative box the user writes directly (Page 1 Box 1/2/3).
function BoxField({
  field, busy, onSubmitBox, onSkip,
}: {
  field: CanonicalField
  busy: boolean
  onSubmitBox: (key: string, value: string) => void
  onSkip: (key: string) => void
}) {
  const proposed =
    field.status === 'AWAITING_CONFIRMATION' && typeof field.proposal?.value === 'string'
      ? (field.proposal!.value as string)
      : null
  const baseline = proposed ?? (typeof field.value === 'string' ? field.value : '')
  const [draft, setDraft] = useState(baseline)
  useEffect(() => { setDraft(baseline) }, [field.value, proposed]) // eslint-disable-line react-hooks/exhaustive-deps

  const hints = hintsFor(field.key)
  const note = fieldDef(field.key)?.note

  return (
    <div className={`rounded-lg border p-3 ${proposed ? 'border-blue-300 bg-blue-50/40' : 'border-zinc-200'}`}>
      <FieldHeader
        field={field}
        right={proposed ? <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">proposed by Lex</span> : undefined}
      />
      {/* 25-I §4c — why this field behaves differently from the ones around it, said HERE
          rather than in a FAQ. It renders even on a proposal, because the proposal is
          exactly when a user is deciding whether they are allowed to change it. */}
      {note && (
        <p className="text-[11px] text-zinc-500 mb-2 leading-snug border-l-2 border-zinc-200 pl-2">{note}</p>
      )}
      {hints.length > 0 && !proposed && (
        <p className="text-[11px] text-zinc-400 mb-2 leading-snug">{hints.join(' · ')}</p>
      )}
      <GrowTextarea
        value={draft}
        onChange={setDraft}
        placeholder="Write as much or as little as you like…"
      />
      <div className="flex gap-2 mt-1.5">
        <button
          onClick={() => onSubmitBox(field.key, draft.trim())}
          disabled={busy || !draft.trim()}
          className={saveClass(!!draft.trim() && (!!proposed || draft !== baseline))}
        >
          {proposed ? 'Save & accept' : 'Save'}
        </button>
        {field.status !== 'ACCEPTED' && field.status !== 'SKIPPED' && (
          <button onClick={() => onSkip(field.key)} disabled={busy}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">
            Skip
          </button>
        )}
      </div>
    </div>
  )
}

// A generated output proposed by Lex (title / keywords / challenge / pivotalObstacle /
// summaryDiagnosis / the Page 3–4 equivalents). Confirmed inline in chat — AND, since
// §19-B Task 1, editable-and-saveable here too: every non-terminal card carries its own
// action buttons, so no field can ever render inert. Terminal = read-out + Change.
function OutputField({
  field, busy, onAcceptOutput, onSkip, onReopen,
}: {
  field: CanonicalField
  busy: boolean
  onAcceptOutput: (key: string, value: string | string[]) => void
  onSkip: (key: string) => void
  onReopen: (key: string) => void
}) {
  const accepted = field.status === 'ACCEPTED'
  const terminal = isTerminal(field)
  // The SAME test AcceptCard.tsx uses (`field.type === 'structured'`), deliberately, so the
  // two accept surfaces for one field cannot disagree about whether its value is a list.
  // Only SLOTLESS structured fields reach this component — renderField sends slotted ones to
  // StructuredField — so `structured` here means exactly "a comma-separated list".
  const isList = field.type === 'structured'
  const asText = (v: unknown) => (Array.isArray(v) ? (v as string[]).join(', ') : ((v as string | null) ?? ''))

  const proposed = field.status === 'AWAITING_CONFIRMATION' ? asText(field.proposal?.value) : ''
  const baseline = proposed || asText(field.value)
  const [draft, setDraft] = useState(baseline)
  useEffect(() => { setDraft(baseline) }, [field.status, baseline]) // eslint-disable-line react-hooks/exhaustive-deps

  const canReopen = accepted && field.key !== 'summaryDiagnosis' // summary is regenerated, not hand-edited here

  if (terminal) {
    return (
      <div className="rounded-lg border border-zinc-200 p-3">
        <FieldHeader
          field={field}
          right={canReopen ? (
            <button onClick={() => onReopen(field.key)} disabled={busy}
              className="text-[11px] text-zinc-400 hover:text-zinc-700 disabled:opacity-40">Change</button>
          ) : undefined}
        />
        <p className="text-xs mt-1 ml-6 text-zinc-500 whitespace-pre-wrap">
          {accepted ? asText(field.value) : 'Skipped'}
        </p>
      </div>
    )
  }

  const hasProposal = !!proposed
  const submit = () => {
    const text = draft.trim()
    if (!text) return
    onAcceptOutput(field.key, isList ? text.split(',').map((s) => s.trim()).filter(Boolean) : text)
  }

  return (
    <div className={`rounded-lg border p-3 ${hasProposal ? 'border-blue-300 bg-blue-50/40' : 'border-zinc-200'}`}>
      <FieldHeader
        field={field}
        right={hasProposal ? <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">proposed by Lex</span> : undefined}
      />
      <p className="text-[11px] text-zinc-400 mb-2 leading-snug">
        {hasProposal
          ? 'Accept it in the chat, or edit it here and Save.'
          : 'Lex will propose this from what you’ve said — or write it yourself and Save.'}
      </p>
      {/* A keyword list is genuinely one line of comma-separated chips and must not be
          given eight rows; a Lex-drafted summary is 600–1,300 characters and must not be
          given three. Same control, different floor. */}
      <GrowTextarea
        value={draft}
        onChange={setDraft}
        minRows={isList ? 2 : GROW_MIN_ROWS}
        placeholder={isList ? 'keyword, keyword, keyword…' : 'Write it here if you’d rather…'}
      />
      <div className="flex gap-2 mt-1.5">
        <button onClick={submit} disabled={busy || !draft.trim()}
          className={saveClass(!!draft.trim() && (hasProposal || draft !== baseline))}>
          {hasProposal ? 'Save & accept' : 'Save'}
        </button>
        <button onClick={() => onSkip(field.key)} disabled={busy}
          className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">
          Skip
        </button>
      </div>
    </div>
  )
}

// A field further down the ACTIVE stage — shown greyed-out so the user can see the
// shape of what's coming, but not workable until the flow reaches it (§19-B Task 3).
/**
 * ⚠ 25-H §7d — A QUEUED FIELD NOW SAYS WHAT IT IS WAITING FOR AND WHAT RELEASES IT.
 *
 * Charlie, on the coherence check: *"I guess I have to go through and approve and save
 * before the coherence check can be carried out?"* He was right — a field becomes current
 * only when every field before it on the page is terminal, so the coherence check waits on
 * the actions loop being confirmed or skipped.
 *
 * §7d: *"Whatever the answer, the screen must say it: what is waiting, on what, and what
 * the user must do to release it."* It said "next up", which is a position, not a
 * condition — and a user who has to GUESS the rule will guess wrong and conclude the
 * feature is broken.
 *
 * ⚠ THE BLOCKER IS NAMED, NOT DESCRIBED GENERICALLY. "Waiting on something above" is the
 * same non-answer in more words; the field that is actually holding it up is passed in.
 */
function QueuedField({ field, waitingOn }: { field: CanonicalField; waitingOn?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-3 py-2">
      <div className="flex items-center gap-2">
        <span className="shrink-0 w-4 h-4 rounded-full bg-zinc-200" />
        <span className="text-sm text-zinc-400 flex-1">{field.label}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-300">waiting</span>
      </div>
      {waitingOn && (
        <p className="text-[11px] text-zinc-400 mt-1 pl-6 leading-snug">
          Waiting on <span className="font-medium text-zinc-500">{waitingOn}</span> — save or skip
          that and this opens.
        </p>
      )}
    </div>
  )
}

// A structured field with labelled slots (whoAffectedImpactCost / legalLandscape).
// The box IS the accept surface: pre-filled from the seed/proposal, Save accepts the object.
function StructuredField({
  field, busy, onAccept, onSkip,
}: {
  field: CanonicalField
  busy: boolean
  onAccept: (key: string, value: Record<string, string>) => void
  onSkip: (key: string) => void
}) {
  const slots = fieldDef(field.key)?.slots ?? []
  const source = (field.status === 'AWAITING_CONFIRMATION' ? field.proposal?.value : field.value) as
    | Record<string, unknown> | null | undefined
  const baseline: Record<string, string> = Object.fromEntries(
    slots.map((k) => [k, typeof source?.[k] === 'string' ? (source![k] as string) : '']),
  )
  const [draft, setDraft] = useState(baseline)
  useEffect(() => { setDraft(baseline) }, [field.status, JSON.stringify(source)]) // eslint-disable-line react-hooks/exhaustive-deps

  const terminal = isTerminal(field)
  // §19-D Task 2a — THE BADGE FOLLOWS THE CONTENT, NOT THE STATUS.
  //
  // This read `field.status === 'AWAITING_CONFIRMATION'` alone, and the conductor put
  // every structured field into that status even when it seeded `{currentLaw: '',
  // whereItFails: ''}`. Result on the 10 Aug walk-through: the legal-landscape box
  // carried "Proposed by Lex" over two empty inputs. Lex proposed nothing; the UI said
  // it had. That is the §19-C never-claim invariant broken by the panel itself.
  //
  // `awaiting` still drives the Save-&-accept affordance (the field IS awaiting the
  // user); only the CLAIM about Lex having proposed something is now content-gated.
  const awaiting = field.status === 'AWAITING_CONFIRMATION'
  const hasProposedContent =
    awaiting &&
    !!field.proposal &&
    Object.values((field.proposal.value ?? {}) as Record<string, unknown>)
      .some((v) => typeof v === 'string' && v.trim())
  const seeded = awaiting

  return (
    <div className={`rounded-lg border p-3 ${hasProposedContent ? 'border-blue-300 bg-blue-50/40' : 'border-zinc-200'}`}>
      <FieldHeader
        field={field}
        right={hasProposedContent ? <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">proposed by Lex — refine</span> : undefined}
      />
      {terminal ? (
        <div className="ml-6 space-y-1">
          {slots.map((k) => (
            <p key={k} className="text-xs text-zinc-600">
              <span className="text-zinc-400">{SLOT_LABELS[k] ?? k}: </span>
              {typeof source?.[k] === 'string' && source![k] ? (source![k] as string) : <span className="text-zinc-300">—</span>}
            </p>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {slots.map((k) => (
              <div key={k}>
                <label className="block text-[11px] font-medium text-zinc-500 mb-0.5">{SLOT_LABELS[k] ?? k}</label>
                {/* Five slots at eight rows each would be a 40-row wall, so a structured
                    slot starts at four and grows to what Lex actually drafted — on the
                    13 Aug run the anticipatedResponses slots were 309–401 characters
                    apiece, which is six or seven lines, not two. */}
                <GrowTextarea
                  value={draft[k] ?? ''}
                  onChange={(v) => setDraft((d) => ({ ...d, [k]: v }))}
                  minRows={4}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => onAccept(field.key, draft)} disabled={busy}
              className={saveClass(seeded || JSON.stringify(draft) !== JSON.stringify(baseline))}>
              {seeded ? 'Save & accept' : 'Save'}
            </button>
            <button onClick={() => onSkip(field.key)} disabled={busy}
              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">Skip</button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Causal tree helpers (§16.2) ──────────────────────────────────────────────
interface CauseTreeNode extends CanonicalCause { depth: number; kids: CauseTreeNode[] }

/** Build a parent→children tree from the flat cause list (stable order preserved). */
function buildCauseTree(causes: CanonicalCause[]): CauseTreeNode[] {
  const byId = new Map(causes.map((c) => [c.id, { ...c, depth: 0, kids: [] as CauseTreeNode[] }]))
  const roots: CauseTreeNode[] = []
  for (const node of byId.values()) {
    const parent = node.parentCauseId ? byId.get(node.parentCauseId) : null
    if (parent) parent.kids.push(node)
    else roots.push(node)
  }
  const setDepth = (n: CauseTreeNode, d: number) => { n.depth = d; n.kids.forEach((k) => setDepth(k, d + 1)) }
  roots.forEach((r) => setDepth(r, 0))
  return roots
}

const CLASS_STYLE: Record<CauseClassification, string> = {
  MATERIAL: 'border-amber-400 bg-amber-50/60',
  CONTRIBUTORY: 'border-zinc-200 bg-white',
  UNASSESSED: 'border-zinc-200 bg-white',
}

// Material / contributory chips (§16.1). Material is visually distinct (amber).
//
// §19-D Task 9e — Charlie could not find how to classify a cause. It WAS built: two
// 10px outline chips in a row of five grey text links, indistinguishable from labels.
// An affordance nobody can see is not an affordance. Unclassified causes now carry the
// question in words, and the choice reads as a choice.
function ClassChips({ cause, busy, api }: { cause: CanonicalCause; busy: boolean; api: CausesApi }) {
  const opts: { key: CauseClassification; label: string; hint: string }[] = [
    { key: 'MATERIAL', label: 'Material', hint: 'Remove it and the problem largely goes away — decisive' },
    { key: 'CONTRIBUTORY', label: 'Contributory', hint: 'Worsens it, but not decisive' },
  ]
  const unassessed = cause.classification === 'UNASSESSED'
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {unassessed && (
        <span className="text-[11px] text-zinc-500">Is this material or contributory?</span>
      )}
      {opts.map((o) => {
        const on = cause.classification === o.key
        return (
          <button key={o.key} disabled={busy} onClick={() => api.classify(cause.id, on ? 'UNASSESSED' : o.key)}
            title={o.hint}
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors disabled:opacity-40 ${
              on
                ? o.key === 'MATERIAL'
                  ? 'border-amber-400 bg-amber-100 text-amber-800 font-semibold'
                  : 'border-zinc-400 bg-zinc-100 text-zinc-700 font-semibold'
                : unassessed
                  ? 'border-blue-300 bg-white text-blue-700 hover:bg-blue-50'
                  : 'border-zinc-200 bg-white text-zinc-400 hover:border-zinc-300'
            }`}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// One interactive cause card — edit / classify / add-beneath / remove. Used in both views.
function CauseCard({ cause, depth, busy, api }: { cause: CanonicalCause; depth: number; busy: boolean; api: CausesApi }) {
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [c, setC] = useState(cause.cause)
  const [why, setWhy] = useState(cause.whyPersisted ?? '')
  const [ev, setEv] = useState(cause.evidence ?? '')
  const [subC, setSubC] = useState('')
  useEffect(() => { setC(cause.cause); setWhy(cause.whyPersisted ?? ''); setEv(cause.evidence ?? '') }, [cause])

  if (editing) {
    return (
      <div className="rounded-lg border border-blue-200 bg-white p-2 space-y-1.5">
        <input value={c} onChange={(e) => setC(e.target.value)} placeholder="Cause"
          className="w-full text-sm p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
        <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} placeholder="Why has it persisted?"
          className="w-full text-xs p-1.5 rounded border border-zinc-200 resize-y focus:outline-none focus:border-blue-400" />
        <input value={ev} onChange={(e) => setEv(e.target.value)} placeholder="Evidence (optional)"
          className="w-full text-xs p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
        <div className="flex gap-2">
          <button disabled={busy || !c.trim()} onClick={() => { api.update(cause.id, { cause: c.trim(), whyPersisted: why.trim(), evidence: ev.trim() }); setEditing(false) }}
            className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Save</button>
          <button disabled={busy} onClick={() => setEditing(false)}
            className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300 text-zinc-500">Cancel</button>
        </div>
      </div>
    )
  }

  const canGoDeeper = depth + 1 < MAX_CAUSE_DEPTH
  return (
    <div className={`rounded-lg border p-2 ${CLASS_STYLE[cause.classification]}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <p className="text-sm text-zinc-800">
            {cause.cause}
            {cause.isRootCause && <span className="ml-1.5 text-[9px] font-semibold uppercase text-green-700">root</span>}
          </p>
          {cause.whyPersisted && <p className="text-[11px] text-zinc-500 mt-0.5">Persists because: {cause.whyPersisted}</p>}
          {cause.evidence && <p className="text-[11px] text-zinc-400 mt-0.5 italic">{cause.evidence}</p>}
        </div>
        {cause.source === 'LEX_CORPUS' && (
          <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 rounded px-1 py-0.5">from past debates</span>
        )}
      </div>
      {/* §19-D Task 9e — the classification is a decision, so it gets its own line
          above the incidental actions rather than sitting in a row of grey links. */}
      <div className="mt-2">
        <ClassChips cause={cause} busy={busy} api={api} />
      </div>
      <div className="flex flex-wrap items-center gap-2 mt-1.5">
        <button disabled={busy} onClick={() => setEditing(true)} className="text-[11px] text-zinc-400 hover:text-zinc-700">Edit</button>
        {canGoDeeper ? (
          <button disabled={busy} onClick={() => setAdding((a) => !a)} className="text-[11px] text-zinc-400 hover:text-zinc-700">+ cause beneath</button>
        ) : (
          <span className="text-[11px] text-zinc-300" title="Consolidate rather than go deeper — a diagnosis should get clear, not exhaustive">deepest level</span>
        )}
        <button disabled={busy} onClick={() => api.remove(cause.id)} className="text-[11px] text-zinc-400 hover:text-red-600">Remove</button>
      </div>
      {adding && canGoDeeper && (
        <div className="mt-2 flex gap-1.5">
          <input value={subC} onChange={(e) => setSubC(e.target.value)} placeholder="…because of this deeper cause"
            className="flex-1 text-xs p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
          <button disabled={busy || !subC.trim()} onClick={() => { api.add({ cause: subC.trim(), parentCauseId: cause.id }); setSubC(''); setAdding(false) }}
            className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Add</button>
        </div>
      )}
    </div>
  )
}

// Map view — the causal tree, indented with a left connector; material nodes distinct.
function CauseTreeView({ nodes, busy, api }: { nodes: CauseTreeNode[]; busy: boolean; api: CausesApi }) {
  return (
    <div className="space-y-1.5">
      {nodes.map((n) => (
        <div key={n.id}>
          <CauseCard cause={n} depth={n.depth} busy={busy} api={api} />
          {n.kids.length > 0 && (
            <div className="ml-3 mt-1.5 pl-2 border-l-2 border-zinc-200 space-y-1.5">
              <CauseTreeView nodes={n.kids} busy={busy} api={api} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// The causes loop (§7.2 + §16.2 tree). Interactive while active; read-only once accepted.
function CausesField({ field, causes, busy, api }: { field: CanonicalField; causes: CanonicalCause[]; busy: boolean; api: CausesApi }) {
  const [c, setC] = useState('')
  const [why, setWhy] = useState('')
  const [view, setView] = useState<'list' | 'map'>('list')
  const terminal = isTerminal(field)
  const tree = buildCauseTree(causes)

  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <FieldHeader
        field={field}
        right={causes.length > 0 ? (
          <div className="flex rounded-lg border border-zinc-200 overflow-hidden text-[11px]">
            {(['list', 'map'] as const).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2 py-0.5 capitalize ${view === v ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-50'}`}>{v}</button>
            ))}
          </div>
        ) : undefined}
      />
      {causes.length === 0 && (
        <p className="text-[11px] text-zinc-400 mb-2">
          {terminal ? 'No causes recorded.' : 'I’ll seed a few candidates from past debates; add your own too. Mark each material or contributory, and build causes beneath a cause where one drives another.'}
        </p>
      )}

      {/* §19-C Task 7 — cards stay editable AFTER the loop is confirmed. Previously a
          confirmed loop rendered read-only, which is why three Lex-seeded road-traffic
          causes could not be deleted from a data-protection idea. */}
      {/* ⚠⚠ 25-H §7a — "the map view does not work — only the list renders".
          It was not broken. `CauseTreeView` draws a nested tree from `parentCauseId`, and
          the build never set one — every cause was a root, the tree had no edges, and the
          map rendered a flat list identical to the list view. A view that silently looks
          like another view is indistinguishable from a view that failed.

          The build now emits `drivenBy` and nests the causes (lib/lex/build.ts
          `nestByDrivenBy`), so there is usually a chain to draw. When there genuinely is
          not — every cause independent, which is a real answer — the map SAYS so instead of
          impersonating the list. */}
      {view === 'map' ? (
        tree.some((n) => n.kids.length > 0) ? (
          <CauseTreeView nodes={tree} busy={busy} api={api} />
        ) : (
          <div className="space-y-1.5">
            <p className="text-[11px] text-amber-700 bg-amber-50/60 border border-amber-200 rounded-lg px-2 py-1.5">
              Nothing here drives anything else yet, so the map is the same as the list. Use
              “beneath” on a cause to say which one it follows from — that chain is the most useful
              thing a diagnosis can say.
            </p>
            {causes.map((cause) => (
              <CauseCard key={cause.id} cause={cause} depth={0} busy={busy} api={api} />
            ))}
          </div>
        )
      ) : (
        <div className="space-y-1.5">
          {causes.map((cause) => (
            <CauseCard key={cause.id} cause={cause} depth={0} busy={busy} api={api} />
          ))}
        </div>
      )}

      {!terminal && (
        <div className="mt-2 rounded-lg border border-dashed border-zinc-300 p-2 space-y-1.5">
          <input value={c} onChange={(e) => setC(e.target.value)} placeholder="Add a cause…"
            className="w-full text-sm p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
          <textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={2} placeholder="Why has it persisted? (optional)"
            className="w-full text-xs p-1.5 rounded border border-zinc-200 resize-y focus:outline-none focus:border-blue-400" />
          <button disabled={busy || !c.trim()} onClick={() => { api.add({ cause: c.trim(), whyPersisted: why.trim() || undefined }); setC(''); setWhy('') }}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40">Add cause</button>
        </div>
      )}

      {!terminal && (
        <div className="flex gap-2 mt-2">
          <button disabled={busy || causes.length === 0} onClick={api.confirm}
            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40">These are my causes</button>
          <button disabled={busy} onClick={api.skip}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">Skip</button>
        </div>
      )}
    </div>
  )
}

// The root-cause selector (§7.1 field 4 + §16.1) — pick one cause as the main driver.
// Choose among the MATERIAL causes; if none are marked material yet, fall back to all
// so the flow is never blocked (with a nudge to classify first).
function RootCauseField({ field, causes, busy, api }: { field: CanonicalField; causes: CanonicalCause[]; busy: boolean; api: CausesApi }) {
  const terminal = isTerminal(field)
  const chosen = causes.find((c) => c.isRootCause) ?? null
  const material = causes.filter((c) => c.classification === 'MATERIAL')
  const options = material.length ? material : causes
  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <FieldHeader field={field} />
      {terminal ? (
        <p className="text-xs ml-6 text-zinc-600">{chosen ? chosen.cause : (field.value as string) ?? 'Skipped'}</p>
      ) : causes.length === 0 ? (
        <div>
          <p className="text-[11px] text-zinc-400 mb-1.5">Add causes first, then choose the main driver.</p>
          <button disabled={busy} onClick={api.skipRoot}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">Skip</button>
        </div>
      ) : options.length === 1 ? (
        // A5: a single cause — propose it as root with one-click confirm, don't ask "which".
        <>
          <p className="text-[11px] text-zinc-400 mb-1.5">You’ve got a single cause here — confirm it as the root cause.</p>
          <button disabled={busy} onClick={() => api.setRoot(options[0].id)}
            className="w-full text-left text-sm px-2.5 py-1.5 rounded-lg border border-green-300 bg-green-50/40 hover:border-green-400 disabled:opacity-40">
            Confirm “{options[0].cause}” as the root cause
          </button>
          <button disabled={busy} onClick={api.skipRoot}
            className="mt-2 text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">Skip</button>
        </>
      ) : (
        <>
          <p className="text-[11px] text-zinc-400 mb-1.5">
            {material.length ? 'Of the material causes, which is the main driver?' : 'Tip: mark the decisive causes “material” above first — the root cause is chosen among those.'}
          </p>
          <div className="space-y-1">
            {options.map((cause) => (
              <button key={cause.id} disabled={busy} onClick={() => api.setRoot(cause.id)}
                className="w-full text-left text-sm px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:border-green-400 hover:bg-green-50/40 disabled:opacity-40">
                {cause.cause}
                {cause.classification === 'MATERIAL' && <span className="ml-1.5 text-[9px] font-semibold uppercase text-amber-700">material</span>}
              </button>
            ))}
          </div>
          <button disabled={busy} onClick={api.skipRoot}
            className="mt-2 text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">Skip</button>
        </>
      )}
    </div>
  )
}

// ── Page 3 — Guiding Policy ───────────────────────────────────────────────────
const OPTION_STATUS_BADGE: Record<CanonicalPolicyOption['status'], { label: string; cls: string }> = {
  CANDIDATE: { label: 'candidate', cls: 'text-zinc-400' },
  CHOSEN: { label: 'chosen', cls: 'text-green-700' },
  RULED_OUT: { label: 'ruled out', cls: 'text-zinc-400 line-through' },
}

function MechChips({ selected, onToggle, busy }: { selected: string[]; onToggle: (m: string) => void; busy: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {MECHANISM_TYPES.map((m) => {
        const on = selected.includes(m)
        return (
          <button key={m} disabled={busy} onClick={() => onToggle(m)}
            className={`text-[10px] px-1.5 py-0.5 rounded-full border disabled:opacity-40 ${on ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-zinc-200 text-zinc-400 hover:border-zinc-300'}`}>
            {m}
          </button>
        )
      })}
    </div>
  )
}

function OptionCard({ option, busy, api }: { option: CanonicalPolicyOption; busy: boolean; api: PolicyApi }) {
  const [editing, setEditing] = useState(false)
  const [ruling, setRuling] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [approach, setApproach] = useState(option.approach)
  const [caseFor, setCaseFor] = useState(option.caseFor ?? '')
  const [caseAgainst, setCaseAgainst] = useState(option.caseAgainst ?? '')
  const [mechs, setMechs] = useState<string[]>(option.mechanismTypes)
  const [reason, setReason] = useState(option.ruleOutReason ?? '')
  useEffect(() => {
    setApproach(option.approach); setCaseFor(option.caseFor ?? ''); setCaseAgainst(option.caseAgainst ?? '')
    setMechs(option.mechanismTypes); setReason(option.ruleOutReason ?? '')
  }, [option])

  if (editing) {
    return (
      <div className="rounded-lg border border-blue-200 bg-white p-2 space-y-1.5">
        <input value={approach} onChange={(e) => setApproach(e.target.value)} placeholder="The approach"
          className="w-full text-sm p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
        <MechChips selected={mechs} busy={busy} onToggle={(m) => setMechs((s) => s.includes(m) ? s.filter((x) => x !== m) : [...s, m])} />
        <textarea value={caseFor} onChange={(e) => setCaseFor(e.target.value)} rows={2} placeholder="The case for"
          className="w-full text-xs p-1.5 rounded border border-zinc-200 resize-y focus:outline-none focus:border-blue-400" />
        <textarea value={caseAgainst} onChange={(e) => setCaseAgainst(e.target.value)} rows={2} placeholder="The case against"
          className="w-full text-xs p-1.5 rounded border border-zinc-200 resize-y focus:outline-none focus:border-blue-400" />
        <div className="flex gap-2">
          <button disabled={busy || !approach.trim()} onClick={() => { api.update(option.id, { approach: approach.trim(), caseFor, caseAgainst, mechanismTypes: mechs }); setEditing(false) }}
            className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Save</button>
          <button disabled={busy} onClick={() => setEditing(false)} className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300 text-zinc-500">Cancel</button>
        </div>
      </div>
    )
  }

  // §19-C Task 3 — Title / Detail / For / Against, collapsed to the title until
  // clicked, and the CHOSEN option unmistakable (bold + the stage accent).
  const badge = OPTION_STATUS_BADGE[option.status]
  const chosen = option.status === 'CHOSEN'
  const accent = accentFor('GUIDING_POLICY')
  const hasDetail = !!(option.caseFor || option.caseAgainst || option.ruleOutReason || option.mechanismTypes.length)
  // §19-D Task 9f — the cards did not visibly collapse to their title, and there were
  // two reasons. (1) The +/− toggle only appeared when the option had a case for or
  // against, and the 10 Aug options were user-added with neither — so there was nothing
  // to press. (2) The Edit / Rule out / Delete row rendered BELOW the title whether the
  // card was expanded or not, so even a collapsed card was three lines tall and never
  // read as collapsed. The toggle is now unconditional and the actions live inside the
  // expanded body: collapsed means title, status and chevron. Nothing else.
  return (
    <div className={`rounded-lg border ${chosen ? `${accent.border} ${accent.bg} border-2` : 'border-zinc-200 bg-white'}`}>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left p-2 flex items-start gap-2 cursor-pointer"
        aria-expanded={expanded}
      >
        <p className={`flex-1 text-sm ${chosen ? `font-semibold ${accent.text}` : 'text-zinc-800'}`}>
          {option.approach}
        </p>
        <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-wide ${chosen ? accent.text : badge.cls}`}>
          {badge.label}
        </span>
        <span className="shrink-0 text-[11px] text-zinc-400 w-3 text-center">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <>
          <div className="px-2 pb-2 space-y-1">
            {option.mechanismTypes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {option.mechanismTypes.map((m) => <span key={m} className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500">{m}</span>)}
              </div>
            )}
            {option.caseFor && <p className="text-[11px] text-green-800"><span className="font-semibold">For:</span> {option.caseFor}</p>}
            {option.caseAgainst && <p className="text-[11px] text-red-800"><span className="font-semibold">Against:</span> {option.caseAgainst}</p>}
            {option.ruleOutReason && <p className="text-[11px] text-zinc-500 italic">Ruled out: {option.ruleOutReason}</p>}
            {!hasDetail && (
              <p className="text-[11px] text-zinc-400">
                No case for or against yet — an approach nobody has argued against hasn’t been weighed. Edit to add both.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 px-2 pb-2">
            {option.source === 'LEX' && <span className="text-[9px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 rounded px-1 py-0.5">from Lex</span>}
            <button disabled={busy} onClick={() => setEditing(true)} className="text-[11px] text-zinc-400 hover:text-zinc-700">Edit</button>
            <button disabled={busy} onClick={() => setRuling((r) => !r)} className="text-[11px] text-zinc-400 hover:text-zinc-700">Rule out</button>
            <button disabled={busy} onClick={() => api.remove(option.id)} className="text-[11px] text-zinc-400 hover:text-red-600">Delete</button>
          </div>
          {ruling && (
            <div className="px-2 pb-2 flex gap-1.5">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why rule it out?"
                className="flex-1 text-xs p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
              <button disabled={busy} onClick={() => { api.ruleOut(option.id, reason.trim()); setRuling(false) }}
                className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Set</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// The policy-options loop (§17 field 1).
function PolicyOptionsField({ field, options, busy, api }: { field: CanonicalField; options: CanonicalPolicyOption[]; busy: boolean; api: PolicyApi }) {
  const [approach, setApproach] = useState('')
  const [caseFor, setCaseFor] = useState('')
  const [caseAgainst, setCaseAgainst] = useState('')
  const terminal = isTerminal(field)

  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <FieldHeader field={field} />
      {options.length === 0 && (
        <p className="text-[11px] text-zinc-400 mb-2">
          {terminal ? 'No approaches recorded.' : 'I’ll seed a few candidate approaches per material cause with the case for and against — add and argue your own.'}
        </p>
      )}
      <div className="space-y-1.5">
        {options.map((o) => terminal ? (
          <div key={o.id} className={`rounded-lg border p-2 ${o.status === 'CHOSEN' ? 'border-green-300 bg-green-50/40' : 'border-zinc-200 bg-white'}`}>
            <p className="text-sm text-zinc-800">{o.approach}<span className={`ml-1.5 text-[9px] font-semibold uppercase ${OPTION_STATUS_BADGE[o.status].cls}`}>{OPTION_STATUS_BADGE[o.status].label}</span></p>
          </div>
        ) : <OptionCard key={o.id} option={o} busy={busy} api={api} />)}
      </div>
      {!terminal && (
        <div className="mt-2 rounded-lg border border-dashed border-zinc-300 p-2 space-y-1.5">
          <input value={approach} onChange={(e) => setApproach(e.target.value)} placeholder="Add an approach…"
            className="w-full text-sm p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
          <textarea value={caseFor} onChange={(e) => setCaseFor(e.target.value)} rows={2} placeholder="The case for (optional)"
            className="w-full text-xs p-1.5 rounded border border-zinc-200 resize-y focus:outline-none focus:border-blue-400" />
          <textarea value={caseAgainst} onChange={(e) => setCaseAgainst(e.target.value)} rows={2} placeholder="The case against (optional)"
            className="w-full text-xs p-1.5 rounded border border-zinc-200 resize-y focus:outline-none focus:border-blue-400" />
          <button disabled={busy || !approach.trim()} onClick={() => { api.add({ approach: approach.trim(), caseFor: caseFor.trim() || undefined, caseAgainst: caseAgainst.trim() || undefined }); setApproach(''); setCaseFor(''); setCaseAgainst('') }}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40">Add approach</button>
        </div>
      )}
      {!terminal && (
        <div className="flex gap-2 mt-2">
          <button disabled={busy || options.length === 0} onClick={api.confirm}
            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40">These are my options</button>
          <button disabled={busy} onClick={api.skip}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">Skip</button>
        </div>
      )}
    </div>
  )
}

// The chosen-approach selector (§17 field 2) — commit to one; the rest are ruled out.
function ChosenApproachField({ field, options, busy, api }: { field: CanonicalField; options: CanonicalPolicyOption[]; busy: boolean; api: PolicyApi }) {
  const terminal = isTerminal(field)
  const chosen = options.find((o) => o.status === 'CHOSEN') ?? null
  const selectable = options.filter((o) => o.status !== 'RULED_OUT')
  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <FieldHeader field={field} />
      {terminal ? (
        <p className="text-xs ml-6 text-zinc-600">{chosen ? chosen.approach : (field.value as string) ?? 'Skipped'}</p>
      ) : options.length === 0 ? (
        <div>
          <p className="text-[11px] text-zinc-400 mb-1.5">Add candidate approaches first, then commit to one.</p>
          <button disabled={busy} onClick={api.skipChoose} className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">Skip</button>
        </div>
      ) : (
        <>
          <p className="text-[11px] text-zinc-400 mb-1.5">Commit to one — the rest are ruled out (that’s the point).</p>
          <div className="space-y-1">
            {selectable.map((o) => (
              <button key={o.id} disabled={busy} onClick={() => api.choose(o.id)}
                className="w-full text-left text-sm px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:border-green-400 hover:bg-green-50/40 disabled:opacity-40">
                {o.approach}
              </button>
            ))}
          </div>
          <button disabled={busy} onClick={api.skipChoose}
            className="mt-2 text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">Skip</button>
        </>
      )}
    </div>
  )
}

// ── Page 4 — Coherent Actions + costing (§18) ─────────────────────────────────
function costLabel(r: CostRange | null | undefined): string {
  if (!r || (r.low == null && r.high == null)) return '—'
  const lo = r.low != null ? Math.round(r.low).toLocaleString() : '?'
  const hi = r.high != null ? Math.round(r.high).toLocaleString() : lo
  return `£${lo}–${hi}${r.unit ? ' ' + r.unit : ''}`
}

// One §18.2 cost category editor — a range with a basis, optionally seeded from a benchmark.
function CostRangeEditor({
  label, fallsOn, value, benchmarks, busy, onChange,
}: {
  label: string; fallsOn: string; value: CostRange | null; benchmarks: CanonicalBenchmark[]; busy: boolean
  onChange: (v: CostRange | null) => void
}) {
  const v = value ?? { low: null, high: null, unit: null, basis: null, benchmarkId: null, userOverride: false }
  const set = (patch: Partial<CostRange>) => onChange({ ...v, ...patch })
  // §19-D Task 7 — the same scale control as the cost-line adder. Typed amounts are
  // held separately from the stored value, which is always whole pounds.
  // Seeded from whatever is already stored (in pounds, so scale starts at 1). The
  // editor remounts each time an action is opened for editing, so this is enough.
  const [rawLow, setRawLow] = useState(value?.low != null ? String(value.low) : '')
  const [rawHigh, setRawHigh] = useState(value?.high != null ? String(value.high) : '')
  const [scale, setScale] = useState(1)
  return (
    <div className="rounded border border-zinc-200 p-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-zinc-600">{label}</span>
        <span className="text-[9px] text-zinc-400">on {fallsOn}</span>
      </div>
      <div className="flex gap-1 mt-1">
        <input type="number" value={rawLow} disabled={busy} placeholder="low"
          onChange={(e) => { setRawLow(e.target.value); set({ low: e.target.value === '' ? null : Number(e.target.value) * scale, userOverride: true }) }}
          className="w-14 text-xs p-1 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
        <input type="number" value={rawHigh} disabled={busy} placeholder="high"
          onChange={(e) => { setRawHigh(e.target.value); set({ high: e.target.value === '' ? null : Number(e.target.value) * scale, userOverride: true }) }}
          className="w-14 text-xs p-1 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
        <select value={scale} disabled={busy}
          onChange={(e) => {
            const s = Number(e.target.value)
            setScale(s)
            set({
              low: rawLow === '' ? null : Number(rawLow) * s,
              high: rawHigh === '' ? null : Number(rawHigh) * s,
              userOverride: true,
            })
          }}
          className="text-[11px] p-1 rounded border border-zinc-200 bg-white">
          <option value={1}>£</option>
          <option value={1000}>£k</option>
          <option value={1000000}>£m</option>
          <option value={1000000000}>£bn</option>
        </select>
        <input value={v.unit ?? ''} disabled={busy} placeholder="unit"
          onChange={(e) => set({ unit: e.target.value || null })}
          className="w-14 text-xs p-1 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
        <select disabled={busy} value={v.benchmarkId ?? ''}
          onChange={(e) => {
            const b = benchmarks.find((x) => x.id === e.target.value)
            if (!b) { set({ benchmarkId: null }); return }
            // Keep the typed boxes in step with the benchmark's own figures.
            setScale(1)
            setRawLow(b.low != null ? String(b.low) : '')
            setRawHigh(b.high != null ? String(b.high) : '')
            onChange({
              low: b.low, high: b.high, unit: b.unit,
              basis: `${b.metric} — ${b.source}${b.priceYear ? ` (${b.priceYear} prices)` : ''}`,
              benchmarkId: b.id, userOverride: false, priceYear: b.priceYear,
            })
          }}
          className="flex-1 text-xs p-1 rounded border border-zinc-200 bg-white focus:outline-none focus:border-blue-400">
          <option value="">use a benchmark…</option>
          {benchmarks.map((b) => <option key={b.id} value={b.id}>{b.metric} ({b.unit})</option>)}
        </select>
      </div>
      <input value={v.basis ?? ''} disabled={busy} placeholder="basis / assumption"
        onChange={(e) => set({ basis: e.target.value || null })}
        className="w-full text-[11px] p-1 mt-1 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
    </div>
  )
}

// §19-C Task 6 — add ONE cost line at a time to an action. Staffing lines offer an
// ASHE-derived suggestion (accepted or overridden, never asserted); everything else
// takes an amount with a stated basis.
function CostLineAdder({ actionId, busy, api }: { actionId: string; busy: boolean; api: CostLinesApi }) {
  const [open, setOpen] = useState(false)
  const [d, setD] = useState<CostLineDraft>({ label: '', costType: 'STAFF', category: 'IMPLEMENTATION', staffLevel: 'MID' })
  const [suggesting, setSuggesting] = useState(false)
  // §19-D Task 7 — the amount as typed, kept apart from the amount as stored. The
  // stored value is always in whole pounds; `scale` is only ever a multiplier on entry.
  const [rawLow, setRawLow] = useState('')
  const [rawHigh, setRawHigh] = useState('')
  const [scale, setScale] = useState(1)
  const set = (p: Partial<CostLineDraft>) => setD((x) => ({ ...x, ...p }))

  if (!open) {
    return (
      <button disabled={busy} onClick={() => setOpen(true)}
        className="text-[11px] text-zinc-500 hover:text-zinc-800 disabled:opacity-40">+ add a cost</button>
    )
  }

  const isStaff = d.costType === 'STAFF'
  const canSuggest = isStaff && !!d.staffLevel && !!d.fteCount && !!d.durationMonths

  return (
    <div className="mt-1.5 rounded-lg border border-dashed border-zinc-300 p-2 space-y-1.5">
      <input value={d.label} onChange={(e) => set({ label: e.target.value })} placeholder="What is this cost? e.g. “ICO guidance team”"
        className="w-full text-xs p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
      <div className="flex gap-1">
        <select value={d.costType} disabled={busy} onChange={(e) => set({ costType: e.target.value as CanonicalCostLine['costType'] })}
          className="text-[11px] p-1 rounded border border-zinc-200 bg-white">
          {COST_TYPES.map((t) => <option key={t} value={t}>{t.toLowerCase()}</option>)}
        </select>
        <select value={d.category} disabled={busy} onChange={(e) => set({ category: e.target.value as CanonicalCostLine['category'] })}
          className="flex-1 text-[11px] p-1 rounded border border-zinc-200 bg-white">
          {(Object.keys(COST_CATEGORY_LABEL) as CanonicalCostLine['category'][]).map((c) =>
            <option key={c} value={c}>{COST_CATEGORY_LABEL[c]}</option>)}
        </select>
      </div>

      {isStaff && (
        <div className="flex gap-1 items-center">
          <select value={d.staffLevel ?? 'MID'} disabled={busy}
            onChange={(e) => set({ staffLevel: e.target.value as 'JUNIOR' | 'MID' | 'SENIOR' })}
            className="text-[11px] p-1 rounded border border-zinc-200 bg-white">
            <option value="JUNIOR">junior</option><option value="MID">mid</option><option value="SENIOR">senior</option>
          </select>
          <input type="number" value={d.fteCount ?? ''} placeholder="FTE" disabled={busy}
            onChange={(e) => set({ fteCount: e.target.value === '' ? null : Number(e.target.value) })}
            className="w-14 text-[11px] p-1 rounded border border-zinc-200" />
          <input type="number" value={d.durationMonths ?? ''} placeholder="months" disabled={busy}
            onChange={(e) => set({ durationMonths: e.target.value === '' ? null : Number(e.target.value) })}
            className="w-16 text-[11px] p-1 rounded border border-zinc-200" />
          <button disabled={busy || !canSuggest || suggesting}
            onClick={async () => {
              setSuggesting(true)
              const s = await api.suggest(d.staffLevel as 'JUNIOR' | 'MID' | 'SENIOR', d.fteCount!, d.durationMonths!)
              setSuggesting(false)
              if (s) {
                set({ low: s.low, high: s.high, basis: s.basis, benchmarkId: s.benchmarkId, priceYear: s.priceYear })
                // Keep the typed-amount fields in step with the suggestion, in whole
                // pounds — otherwise the boxes show the old figures over new values.
                setScale(1)
                setRawLow(s.low != null ? String(Math.round(s.low)) : '')
                setRawHigh(s.high != null ? String(Math.round(s.high)) : '')
              }
            }}
            className="text-[11px] px-1.5 py-1 rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40">
            {suggesting ? '…' : 'suggest from ASHE'}
          </button>
        </div>
      )}

      {/* §19-D Task 7 — a scale, and a live echo of what was actually entered.
          The 10 Aug run stored `low=57` against "Tax collection cost" and the summary
          reported "£57/year" for an enforcement cost. The arithmetic was right; the
          user had no way to say "million" and no read-back to notice it by. */}
      <div className="flex gap-1 items-center">
        <input type="number" value={rawLow} placeholder="low £" disabled={busy}
          onChange={(e) => { setRawLow(e.target.value); set({ low: e.target.value === '' ? null : Number(e.target.value) * scale }) }}
          className="w-20 text-[11px] p-1 rounded border border-zinc-200" />
        <input type="number" value={rawHigh} placeholder="high £" disabled={busy}
          onChange={(e) => { setRawHigh(e.target.value); set({ high: e.target.value === '' ? null : Number(e.target.value) * scale }) }}
          className="w-20 text-[11px] p-1 rounded border border-zinc-200" />
        <select value={scale} disabled={busy}
          onChange={(e) => {
            const s = Number(e.target.value)
            setScale(s)
            set({
              low: rawLow === '' ? null : Number(rawLow) * s,
              high: rawHigh === '' ? null : Number(rawHigh) * s,
            })
          }}
          className="text-[11px] p-1 rounded border border-zinc-200 bg-white">
          <option value={1}>£</option>
          <option value={1000}>£ thousand</option>
          <option value={1000000}>£ million</option>
          <option value={1000000000}>£ billion</option>
        </select>
      </div>
      {(d.low != null || d.high != null) && (
        <p className="text-[10px] text-zinc-500">
          That’s {d.low != null ? `£${Math.round(d.low).toLocaleString()}` : '?'}
          {d.high != null && d.high !== d.low ? `–£${Math.round(d.high).toLocaleString()}` : ''}
          {d.high == null && d.low != null ? ' — no upper bound given, so it will be treated as a floor' : ''}.
        </p>
      )}
      <input value={d.basis ?? ''} onChange={(e) => set({ basis: e.target.value })} placeholder="basis / assumption — where does this number come from?"
        className="w-full text-[11px] p-1 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
      <div className="flex gap-2">
        <button disabled={busy || !d.label.trim()} onClick={() => {
          // §19-D Task 7 — `staffLevel` used to travel with a non-staff line: the draft
          // defaults it to MID and nothing cleared it when the type changed, which is
          // how a CAPITAL line came to be stored with staffLevel=MID.
          api.add(actionId, d.costType === 'STAFF' ? d : { ...d, staffLevel: null, fteCount: null, durationMonths: null })
          setD({ label: '', costType: 'STAFF', category: 'IMPLEMENTATION', staffLevel: 'MID' })
          setRawLow(''); setRawHigh(''); setScale(1); setOpen(false)
        }}
          className={saveClass(!!d.label.trim())}>Add cost</button>
        <button disabled={busy} onClick={() => setOpen(false)}
          className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300 text-zinc-500">Cancel</button>
      </div>
    </div>
  )
}

function costLineLabel(l: CanonicalCostLine): string {
  const range = l.low == null && l.high == null
    ? 'no figure yet'
    : `£${Math.round(l.low ?? l.high ?? 0).toLocaleString()}${l.high != null && l.high !== l.low ? `–${Math.round(l.high).toLocaleString()}` : ''}`
  const staff = l.costType === 'STAFF' && l.fteCount ? ` · ${l.fteCount} FTE${l.durationMonths ? ` × ${l.durationMonths}m` : ''}` : ''
  return `${range}${staff}`
}

function ActionCard({ action, benchmarks, costLines, busy, api, costLinesApi }: {
  action: CanonicalAction; benchmarks: CanonicalBenchmark[]; costLines: CanonicalCostLine[]
  busy: boolean; api: ActionsApi; costLinesApi: CostLinesApi
}) {
  const [editing, setEditing] = useState(false)
  const [d, setD] = useState<ActionDraft>(action)
  useEffect(() => { setD(action) }, [action])
  const patch = (p: Partial<ActionDraft>) => setD((x) => ({ ...x, ...p }))

  if (editing) {
    return (
      <div className="rounded-lg border border-blue-200 bg-white p-2 space-y-1.5">
        <input value={d.practicalStep} onChange={(e) => patch({ practicalStep: e.target.value })} placeholder="The practical step"
          className="w-full text-sm p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
        <div className="flex gap-1">
          <input value={d.whoImplements ?? ''} onChange={(e) => patch({ whoImplements: e.target.value })} placeholder="Who implements"
            className="flex-1 text-xs p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
          <input value={d.mechanismType ?? ''} onChange={(e) => patch({ mechanismType: e.target.value })} placeholder="Mechanism"
            className="w-28 text-xs p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
        </div>
        <input value={d.targetOrganisation ?? ''} onChange={(e) => patch({ targetOrganisation: e.target.value })} placeholder="Target organisation (legislative)"
          className="w-full text-xs p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
        <textarea value={d.wording ?? ''} onChange={(e) => patch({ wording: e.target.value })} rows={2} placeholder="Intended wording (legislative)"
          className="w-full text-xs p-1.5 rounded border border-zinc-200 resize-y focus:outline-none focus:border-blue-400" />
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Costs (ranges with basis)</p>
          {COST_CATEGORIES.map((cat) => (
            <CostRangeEditor key={cat.key} label={cat.label} fallsOn={cat.fallsOn}
              value={(d[cat.key as keyof ActionDraft] as CostRange | null) ?? null} benchmarks={benchmarks} busy={busy}
              onChange={(v) => patch({ [cat.key]: v } as Partial<ActionDraft>)} />
          ))}
        </div>
        <div className="flex gap-2">
          <button disabled={busy || !d.practicalStep.trim()} onClick={() => { api.update(action.id, d); setEditing(false) }}
            className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Save</button>
          <button disabled={busy} onClick={() => { setD(action); setEditing(false) }} className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300 text-zinc-500">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-2">
      <p className="text-sm text-zinc-800">{action.practicalStep}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-zinc-500">
        {action.whoImplements && <span>Who: {action.whoImplements}</span>}
        {action.mechanismType && <span>Mechanism: {action.mechanismType}</span>}
        {action.targetOrganisation && <span>Target: {action.targetOrganisation}</span>}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-zinc-600">
        <span>Impl: {costLabel(action.implementationCost)}</span>
        <span>Enforce: {costLabel(action.enforcementCost)}</span>
        <span>Friction: {costLabel(action.regulatoryFriction)}</span>
      </div>
      {/* §19-C Task 6 — the costed lines for this action, and the add-one flow. */}
      {costLines.length > 0 && (
        <div className="mt-1.5 space-y-1">
          {costLines.map((l) => (
            <div key={l.id} className="flex items-start gap-2 text-[11px]">
              <span className="text-zinc-300">·</span>
              <div className="flex-1">
                <span className="text-zinc-700">{l.label}</span>
                <span className="text-zinc-400"> — {costLineLabel(l)}</span>
                <span className="text-zinc-300"> · {COST_CATEGORY_LABEL[l.category].split(' (')[0]}</span>
                {l.basis && <div className="text-zinc-400 italic">{l.basis}</div>}
              </div>
              <button disabled={busy} onClick={() => costLinesApi.remove(l.id)}
                className="text-zinc-300 hover:text-red-600">delete</button>
            </div>
          ))}
        </div>
      )}
      {!action.whoImplements && (
        <p className="text-[11px] text-amber-700 mt-1">No implementer named yet.</p>
      )}
      <div className="flex flex-wrap gap-2 mt-1.5 items-center">
        {action.source === 'LEX' && <span className="text-[9px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 rounded px-1 py-0.5">from Lex</span>}
        <button disabled={busy} onClick={() => setEditing(true)} className="text-[11px] text-zinc-400 hover:text-zinc-700">Edit</button>
        <CostLineAdder actionId={action.id} busy={busy} api={costLinesApi} />
        <button disabled={busy} onClick={() => api.remove(action.id)} className="text-[11px] text-zinc-400 hover:text-red-600">Delete</button>
      </div>
    </div>
  )
}

// The actions loop + costing estimator (§18).
function ActionsField({ field, actions, benchmarks, costLines, busy, api, costLinesApi }: {
  field: CanonicalField; actions: CanonicalAction[]; benchmarks: CanonicalBenchmark[]
  costLines: CanonicalCostLine[]; busy: boolean; api: ActionsApi; costLinesApi: CostLinesApi
}) {
  const [step, setStep] = useState('')
  const terminal = isTerminal(field)
  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <FieldHeader field={field} />
      {actions.length === 0 && (
        <p className="text-[11px] text-zinc-400 mb-2">
          {terminal ? 'No actions recorded.' : 'Add the coordinated steps. Edit each to cost it — with sourced ranges you can override.'}
        </p>
      )}
      <div className="space-y-1.5">
        {actions.map((a) => terminal ? (
          <div key={a.id} className="rounded-lg border border-zinc-200 bg-white p-2">
            <p className="text-sm text-zinc-800">{a.practicalStep}</p>
            <div className="flex flex-wrap gap-x-3 mt-1 text-[11px] text-zinc-500">
              <span>Impl: {costLabel(a.implementationCost)}</span>
              <span>Enforce: {costLabel(a.enforcementCost)}</span>
              <span>Friction: {costLabel(a.regulatoryFriction)}</span>
            </div>
          </div>
        ) : <ActionCard key={a.id} action={a} benchmarks={benchmarks} costLines={costLines.filter((l) => l.actionId === a.id)} busy={busy} api={api} costLinesApi={costLinesApi} />)}
      </div>
      {!terminal && (
        <div className="mt-2 flex gap-1.5">
          <input value={step} onChange={(e) => setStep(e.target.value)} placeholder="Add an action…"
            className="flex-1 text-sm p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
          <button disabled={busy || !step.trim()} onClick={() => { api.add({ practicalStep: step.trim() }); setStep('') }}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40">Add</button>
        </div>
      )}
      {!terminal && (
        <div className="flex gap-2 mt-2">
          <button disabled={busy || actions.length === 0} onClick={api.confirm}
            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40">These are my actions</button>
          <button disabled={busy} onClick={api.skip}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-500 hover:bg-zinc-50 disabled:opacity-40">Skip</button>
        </div>
      )}
    </div>
  )
}

// Panel 2 — Fields. Pure renderer of pages[] (+ child entities). "X of Y" derived here.
// A2: completed stages collapse into accordions (title + tick + "n of n", "+" to expand).
// A3: on Save the next active field scrolls to the top of the panel.
export default function FieldsPanel({
  pages, causes, policyOptions, actions, costLines, benchmarks, busy, currentFieldKey,
  onSubmitBox, onAcceptStructured, onAcceptOutput, onSkip, onReopen, onGoToPage,
  causesApi, policyApi, actionsApi, costLinesApi, deepening,
}: {
  pages: CanonicalState['pages']
  causes: CanonicalCause[]
  policyOptions: CanonicalPolicyOption[]
  actions: CanonicalAction[]
  costLines: CanonicalCostLine[]
  benchmarks: CanonicalBenchmark[]
  busy: boolean
  /** The active field key — A3 scrolls it into view when it changes. */
  currentFieldKey?: string | null
  onSubmitBox: (key: string, value: string) => void
  onAcceptStructured: (key: string, value: Record<string, string>) => void
  /** §19-B: accept a proposed scalar from the PANEL (text or keyword list). */
  onAcceptOutput: (key: string, value: string | string[]) => void
  onSkip: (key: string) => void
  onReopen: (key: string) => void
  /** §19-D Task 3 — move the working context into an already-reached stage. */
  onGoToPage: (pageKey: string) => void
  causesApi: CausesApi
  policyApi: PolicyApi
  actionsApi: ActionsApi
  costLinesApi: CostLinesApi
  /** The Deepening stage section, rendered after the four kernel pages (§22). */
  deepening?: ReactNode
}) {
  /** Sections the user has opened that would otherwise be closed (finished ones). */
  const [manualExpanded, setManualExpanded] = useState<Set<string>>(new Set())
  /**
   * 25-N §1c — sections the user has CLOSED that would otherwise be open.
   *
   * ⚠ TWO SETS, NOT ONE FLIPPED BOOLEAN. The default differs by status — a finished section
   * starts closed, the one you are working in starts open — so a single set cannot say both
   * "expand this finished one" and "collapse this active one"; it would mean opposite things
   * depending on a status that changes underneath it.
   */
  const [manualCollapsed, setManualCollapsed] = useState<Set<string>>(new Set())
  const activeRef = useRef<HTMLDivElement>(null)
  const stageHeaderRef = useRef<HTMLDivElement>(null)

  const activePageKey = pages.find((p) => p.status === 'active')?.key ?? null

  // A3: bring the newly-active box to the top of the panel on Save (currentFieldKey change).
  useEffect(() => {
    if (currentFieldKey) activeRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [currentFieldKey])

  // §19-B Task 3: on STAGE entry the new stage's header goes to the top. Declared after
  // the field effect so it wins when both fire in the same commit (a stage change also
  // changes the current field).
  useEffect(() => {
    if (activePageKey) stageHeaderRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [activePageKey])

  const renderField = (f: CanonicalField) => {
    if (f.type === 'narrative') return <BoxField field={f} busy={busy} onSubmitBox={onSubmitBox} onSkip={onSkip} />
    // §19-D Task 2a, second instance — found on the 12 Aug walk, not by a type error.
    //
    // `keywords` is declared `type: 'structured'` (page1-config.ts) and carries NO `slots`,
    // because "structured" is what AcceptCard keys off to render it as chips in the chat.
    // This line sent it to StructuredField anyway, which renders one input PER SLOT — so with
    // zero slots it drew a card containing a "proposed by Lex — refine" badge, a Save & accept
    // button, and nothing else. A confident claim over a literally empty box: the exact defect
    // 2a fixed for legalLandscape, surviving in a second place, on the same walk-through.
    //
    // Worse than cosmetic: `baseline` is `Object.fromEntries([])` = `{}`, so pressing the
    // panel's Save & accept would have written an EMPTY OBJECT over Lex's proposed keywords —
    // silently discarding them while reporting success.
    //
    // A slotless structured field falls through to OutputField, which already has `isList` for
    // precisely this and emits `string[]` — byte-identical to what the chat AcceptCard sends.
    // Guarding on slots rather than special-casing the key means the next slotless structured
    // field cannot reintroduce the empty claim either.
    if (f.type === 'structured' && (fieldDef(f.key)?.slots?.length ?? 0) > 0) {
      return <StructuredField field={f} busy={busy} onAccept={onAcceptStructured} onSkip={onSkip} />
    }
    if (f.type === 'loop') {
      if (f.key === 'policyOptions') return <PolicyOptionsField field={f} options={policyOptions} busy={busy} api={policyApi} />
      if (f.key === 'actions') return <ActionsField field={f} actions={actions} benchmarks={benchmarks} costLines={costLines} busy={busy} api={actionsApi} costLinesApi={costLinesApi} />
      return <CausesField field={f} causes={causes} busy={busy} api={causesApi} />
    }
    if (f.type === 'reference') {
      if (f.key === 'chosenApproach') return <ChosenApproachField field={f} options={policyOptions} busy={busy} api={policyApi} />
      return <RootCauseField field={f} causes={causes} busy={busy} api={causesApi} />
    }
    return <OutputField field={f} busy={busy} onAcceptOutput={onAcceptOutput} onSkip={onSkip} onReopen={onReopen} />
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
      {/* ══ 25-N §3d — THE DRAFT'S OWN INTRODUCTION, IN CHARLIE'S WORDS, VERBATIM ═════
          §3d gives this its exact wording, and it is the first thing in the column for a
          reason: DRAFT STRATEGY is a report the user is being asked to take over, and until
          now nothing at the top of it said so. A user meeting a filled-in kernel with no
          framing reads it as a form to complete rather than as a draft to argue with — and
          the sentence that fixes that is also the sentence that tells them the two ways to
          change it. */}
      <p className="text-sm text-zinc-700 leading-relaxed border-l-2 border-zinc-300 pl-3">
        Here is the draft strategy I have written for you to review and develop into your formal
        proposal. As you go through this you can edit and improve it by typing directly in any box
        or discussing with Lex and asking Lex to write it for you.
      </p>

      {pages.map((page) => {
        const total = page.fields.length
        const done = page.fields.filter((f) => f.status === 'ACCEPTED' || f.status === 'SKIPPED').length
        const isLocked = page.status === 'locked'
        const isActive = page.status === 'active'
        const accent = accentFor(page.key)
        // §19-D Task 3 — a stage the user has already reached but isn't in. Clicking
        // "Work on this" moves chat, panel and the save path there together; the header
        // click keeps its old job (expand/collapse), because conflating "let me look at
        // that" with "take me back there" is how you lose your place by accident.
        const canReEnter = page.reachable && !isActive
        // ══ 25-N §1c — EVERY HEADING TOGGLES BOTH WAYS, ALWAYS ═══════════════════════
        //
        // ⚠⚠ `collapsible` USED TO BE `complete || visited`, WHICH IS WHY "WORK ON THIS"
        // LOCKED THE USER IN. Pressing it makes the section ACTIVE — neither complete nor
        // visited — so the heading stopped being a toggle at the exact moment the user had
        // just chosen to open it, and there was no way back out short of finishing it.
        // Charlie: *"Sections cannot be closed once opened."*
        //
        // ⚠ A LOCKED SECTION IS STILL NOT A TOGGLE, and that is not the same rule. There is
        // nothing under it to show or hide — it has not been reached — so a chevron there
        // would be a control that does nothing.
        const collapsible = !isLocked
        // ⚠ AND THE DEFAULT STILL DEPENDS ON THE STATUS. A2's rule stands: a stage you have
        // finished opens collapsed, a stage you are working in opens expanded. What changed
        // is only that the user may now overrule EITHER — `manualCollapsed` is the second
        // set, because one set cannot express "expand this finished one" and "collapse this
        // active one" at the same time.
        const collapsedByDefault = page.status === 'complete' || page.status === 'visited'
        const collapsed = collapsedByDefault
          ? !manualExpanded.has(page.key)
          : manualCollapsed.has(page.key)
        // 25-N §1c — the toggle writes to whichever set overrules THIS section's default.
        const toggle = () => {
          const flip = (s: Set<string>) => {
            const n = new Set(s)
            n.has(page.key) ? n.delete(page.key) : n.add(page.key)
            return n
          }
          if (collapsedByDefault) setManualExpanded(flip)
          else setManualCollapsed(flip)
        }
        // §19-B Task 3: within the ACTIVE stage, everything past the current field is
        // queued — visible (so the shape of the stage is legible) but not workable.
        const currentIdx = isActive && currentFieldKey ? page.fields.findIndex((f) => f.key === currentFieldKey) : -1
        return (
          <div key={page.key}>
            <div
              ref={isActive ? stageHeaderRef : undefined}
              className={`flex items-center gap-2 mb-2 rounded-lg px-2 py-1.5 ${isActive ? accent.bg : ''} ${collapsible ? 'cursor-pointer' : ''}`}
              onClick={collapsible ? toggle : undefined}
              // 25-N §1c — a heading that toggles is a control, so it announces itself as
              // one and works from the keyboard. It was a bare div with an onClick.
              {...(collapsible
                ? {
                    role: 'button' as const,
                    tabIndex: 0,
                    'aria-expanded': !collapsed,
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle() }
                    },
                  }
                : {})}
            >
              <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${
                page.status === 'complete' ? 'bg-green-500' : isActive ? accent.dot : 'bg-zinc-200'
              }`} />
              <span className={`text-xs font-semibold uppercase tracking-wide flex-1 ${
                isLocked ? 'text-zinc-300' : isActive ? accent.text : 'text-zinc-700'
              }`}>
                {page.label}
              </span>
              {/* ⚠ 25-N §2 — "0 of 7 approved", not "0 of 7". A bare fraction beside a section
                  heading is a count of something the reader has to guess at, and the two
                  plausible guesses — how much Lex has drafted, how much you have signed off —
                  point in opposite directions. `done` counts ACCEPTED and SKIPPED, so the word
                  that fits it is "approved". */}
              {!isLocked && total > 0 && (
                <span className="text-[11px] text-zinc-400 whitespace-nowrap">{done} of {total} approved</span>
              )}
              {isLocked && <span className="text-[11px] text-zinc-300">soon</span>}
              {canReEnter && (
                <button
                  disabled={busy}
                  onClick={(e) => { e.stopPropagation(); onGoToPage(page.key) }}
                  title="Move back into this section — Lex, the research panel and your edits all follow. Nothing later is lost."
                  className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full border border-zinc-300 text-zinc-500 hover:border-blue-400 hover:text-blue-600 disabled:opacity-40"
                >
                  Work on this
                </button>
              )}
              {/* ⚠ TWO DIFFERENT CHARACTERS, never one recoloured (docs/CLAUDE.md §21), and
                  a word beside them so "this opens" is not left to be inferred from a glyph. */}
              {collapsible && (
                <span className="text-[11px] text-zinc-400 whitespace-nowrap">
                  {collapsed ? 'show +' : 'hide −'}
                </span>
              )}
            </div>

            {/* §19-E Task 7 — THE DICTATION HINT, at the top of the stage.
                Diagnosis is where the writing gets long — a problem statement, causes
                with why each persisted, the legal landscape — and it is the stage where
                Charlie found the interaction had quietly become panel-only. The hint
                does two jobs: it tells the user dictation exists (the mic is already
                built, per docs/CLAUDE.md §6), and it says Lex will tidy up what they
                say, which is the thing that makes talking rather than typing safe.
                Shown on the ACTIVE stage only: a hint repeated over four collapsed
                stages is furniture. */}
            {isActive && !isLocked && !collapsed && STAGE_HINT[page.key] && (
              <p className="text-[11px] text-zinc-500 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-2 mb-2 leading-snug">
                {STAGE_HINT[page.key]}
              </p>
            )}

            {!isLocked && !collapsed && (
              <div className={`space-y-2 ${isActive ? `border-l-2 ${accent.border} pl-3` : ''}`}>
                {page.fields.map((f, i) => {
                  const queued = currentIdx >= 0 && i > currentIdx && !isTerminal(f)
                  // 25-H §7d — the field actually holding this one up: the first
                  // non-terminal one above it, which is what `currentIdx` points at.
                  const blocker = queued ? page.fields[currentIdx]?.label : undefined
                  return (
                    <div key={f.key} ref={f.key === currentFieldKey ? activeRef : undefined}>
                      {queued ? <QueuedField field={f} waitingOn={blocker} /> : renderField(f)}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {/* The Deepening (§22) sits AFTER the kernel's four stages — it is not a fifth page
          of the state machine and deliberately does not join PAGE_SEQUENCE. The kernel
          produces the skeleton; this is what turns it into something that survives
          scrutiny, and it is optional, re-runnable and enterable in any order, which the
          one-way page machine cannot express. Passed in as a node so the panel stays a
          pure renderer of canonical state. */}
      {deepening}
    </div>
  )
}
