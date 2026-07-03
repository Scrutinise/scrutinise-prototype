'use client'

import { useEffect, useState, type ReactNode } from 'react'
import {
  fieldDef,
  type CanonicalState, type CanonicalField, type CanonicalCause, type CauseClassification,
  type CanonicalPolicyOption, type CanonicalAction, type CanonicalBenchmark, type CostRange,
} from '@/lib/lex/page1-config'
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

function hintsFor(key: string): string[] {
  return fieldDef(key)?.hints ?? []
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

  return (
    <div className={`rounded-lg border p-3 ${proposed ? 'border-blue-300 bg-blue-50/40' : 'border-zinc-200'}`}>
      <FieldHeader
        field={field}
        right={proposed ? <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">proposed by Lex</span> : undefined}
      />
      {hints.length > 0 && !proposed && (
        <p className="text-[11px] text-zinc-400 mb-2 leading-snug">{hints.join(' · ')}</p>
      )}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        placeholder="Write as much or as little as you like…"
        className="w-full text-sm p-2 rounded-lg border border-zinc-200 bg-white resize-none focus:outline-none focus:border-blue-400"
      />
      <div className="flex gap-2 mt-1.5">
        <button
          onClick={() => onSubmitBox(field.key, draft.trim())}
          disabled={busy || !draft.trim()}
          className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
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

// A generated output proposed by Lex, confirmed in CHAT (title / keywords / challenge /
// pivotalObstacle / summaryDiagnosis). The panel is a read-out + Change.
function OutputField({ field, busy, onReopen }: { field: CanonicalField; busy: boolean; onReopen: (key: string) => void }) {
  const accepted = field.status === 'ACCEPTED'
  const display = Array.isArray(field.value)
    ? (field.value as string[]).join(', ')
    : (field.value as string | null) ?? ''
  const canReopen = accepted && field.key !== 'summaryDiagnosis' // summary is regenerated, not hand-edited here
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
        {accepted ? display
          : field.status === 'AWAITING_CONFIRMATION' ? 'Awaiting your approval in the chat →'
          : field.status === 'SKIPPED' ? 'Skipped'
          : 'Lex will propose this once there’s enough to go on.'}
      </p>
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
  const seeded = field.status === 'AWAITING_CONFIRMATION'

  return (
    <div className={`rounded-lg border p-3 ${seeded ? 'border-blue-300 bg-blue-50/40' : 'border-zinc-200'}`}>
      <FieldHeader
        field={field}
        right={seeded ? <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">carried over — refine</span> : undefined}
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
                <textarea
                  value={draft[k] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                  rows={2}
                  className="w-full text-sm p-2 rounded-lg border border-zinc-200 bg-white resize-none focus:outline-none focus:border-blue-400"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <button onClick={() => onAccept(field.key, draft)} disabled={busy}
              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40">Save</button>
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
function ClassChips({ cause, busy, api }: { cause: CanonicalCause; busy: boolean; api: CausesApi }) {
  const opts: { key: CauseClassification; label: string }[] = [
    { key: 'MATERIAL', label: 'Material' },
    { key: 'CONTRIBUTORY', label: 'Contributory' },
  ]
  return (
    <div className="flex gap-1">
      {opts.map((o) => {
        const on = cause.classification === o.key
        return (
          <button key={o.key} disabled={busy} onClick={() => api.classify(cause.id, on ? 'UNASSESSED' : o.key)}
            title={o.key === 'MATERIAL' ? 'Remove it and the problem largely goes away' : 'Worsens it, but not decisive'}
            className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full border disabled:opacity-40 ${
              on
                ? o.key === 'MATERIAL' ? 'border-amber-400 bg-amber-100 text-amber-800' : 'border-zinc-400 bg-zinc-100 text-zinc-700'
                : 'border-zinc-200 text-zinc-400 hover:border-zinc-300'
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
          className="w-full text-xs p-1.5 rounded border border-zinc-200 resize-none focus:outline-none focus:border-blue-400" />
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
      <div className="flex flex-wrap items-center gap-2 mt-1.5">
        <ClassChips cause={cause} busy={busy} api={api} />
        <span className="text-zinc-200">|</span>
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

// Read-only tree (once the field is terminal).
function CauseTreeReadOnly({ nodes }: { nodes: CauseTreeNode[] }) {
  return (
    <div className="space-y-1.5">
      {nodes.map((n) => (
        <div key={n.id}>
          <div className={`rounded-lg border p-2 ${CLASS_STYLE[n.classification]}`}>
            <p className="text-sm text-zinc-800">
              {n.cause}
              {n.classification === 'MATERIAL' && <span className="ml-1.5 text-[9px] font-semibold uppercase text-amber-700">material</span>}
              {n.isRootCause && <span className="ml-1.5 text-[9px] font-semibold uppercase text-green-700">root</span>}
            </p>
            {n.whyPersisted && <p className="text-[11px] text-zinc-500 mt-0.5">Persists because: {n.whyPersisted}</p>}
          </div>
          {n.kids.length > 0 && (
            <div className="ml-3 mt-1.5 pl-2 border-l-2 border-zinc-200 space-y-1.5">
              <CauseTreeReadOnly nodes={n.kids} />
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

      {terminal ? (
        <CauseTreeReadOnly nodes={tree} />
      ) : view === 'map' ? (
        <CauseTreeView nodes={tree} busy={busy} api={api} />
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
            className="w-full text-xs p-1.5 rounded border border-zinc-200 resize-none focus:outline-none focus:border-blue-400" />
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
          className="w-full text-xs p-1.5 rounded border border-zinc-200 resize-none focus:outline-none focus:border-blue-400" />
        <textarea value={caseAgainst} onChange={(e) => setCaseAgainst(e.target.value)} rows={2} placeholder="The case against"
          className="w-full text-xs p-1.5 rounded border border-zinc-200 resize-none focus:outline-none focus:border-blue-400" />
        <div className="flex gap-2">
          <button disabled={busy || !approach.trim()} onClick={() => { api.update(option.id, { approach: approach.trim(), caseFor, caseAgainst, mechanismTypes: mechs }); setEditing(false) }}
            className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Save</button>
          <button disabled={busy} onClick={() => setEditing(false)} className="text-xs font-medium px-2 py-0.5 rounded border border-zinc-300 text-zinc-500">Cancel</button>
        </div>
      </div>
    )
  }

  const badge = OPTION_STATUS_BADGE[option.status]
  return (
    <div className={`rounded-lg border p-2 ${option.status === 'CHOSEN' ? 'border-green-300 bg-green-50/40' : 'border-zinc-200 bg-white'}`}>
      <div className="flex items-start gap-2">
        <p className="flex-1 text-sm text-zinc-800">{option.approach}</p>
        <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-wide ${badge.cls}`}>{badge.label}</span>
      </div>
      {option.mechanismTypes.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {option.mechanismTypes.map((m) => <span key={m} className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500">{m}</span>)}
        </div>
      )}
      {option.caseFor && <p className="text-[11px] text-green-800 mt-1"><span className="font-semibold">For:</span> {option.caseFor}</p>}
      {option.caseAgainst && <p className="text-[11px] text-red-800 mt-0.5"><span className="font-semibold">Against:</span> {option.caseAgainst}</p>}
      {option.ruleOutReason && <p className="text-[11px] text-zinc-500 mt-0.5 italic">Ruled out: {option.ruleOutReason}</p>}
      <div className="flex flex-wrap items-center gap-2 mt-1.5">
        {option.source === 'LEX' && <span className="text-[9px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 rounded px-1 py-0.5">from Lex</span>}
        <button disabled={busy} onClick={() => setEditing(true)} className="text-[11px] text-zinc-400 hover:text-zinc-700">Edit</button>
        <button disabled={busy} onClick={() => setRuling((r) => !r)} className="text-[11px] text-zinc-400 hover:text-zinc-700">Rule out</button>
        <button disabled={busy} onClick={() => api.remove(option.id)} className="text-[11px] text-zinc-400 hover:text-red-600">Remove</button>
      </div>
      {ruling && (
        <div className="mt-2 flex gap-1.5">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why rule it out?"
            className="flex-1 text-xs p-1.5 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
          <button disabled={busy} onClick={() => { api.ruleOut(option.id, reason.trim()); setRuling(false) }}
            className="text-xs font-medium px-2 py-0.5 rounded bg-zinc-900 text-white disabled:opacity-40">Set</button>
        </div>
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
            className="w-full text-xs p-1.5 rounded border border-zinc-200 resize-none focus:outline-none focus:border-blue-400" />
          <textarea value={caseAgainst} onChange={(e) => setCaseAgainst(e.target.value)} rows={2} placeholder="The case against (optional)"
            className="w-full text-xs p-1.5 rounded border border-zinc-200 resize-none focus:outline-none focus:border-blue-400" />
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
  return (
    <div className="rounded border border-zinc-200 p-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-zinc-600">{label}</span>
        <span className="text-[9px] text-zinc-400">on {fallsOn}</span>
      </div>
      <div className="flex gap-1 mt-1">
        <input type="number" value={v.low ?? ''} disabled={busy} placeholder="low"
          onChange={(e) => set({ low: e.target.value === '' ? null : Number(e.target.value), userOverride: true })}
          className="w-16 text-xs p-1 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
        <input type="number" value={v.high ?? ''} disabled={busy} placeholder="high"
          onChange={(e) => set({ high: e.target.value === '' ? null : Number(e.target.value), userOverride: true })}
          className="w-16 text-xs p-1 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
        <input value={v.unit ?? ''} disabled={busy} placeholder="unit"
          onChange={(e) => set({ unit: e.target.value || null })}
          className="w-16 text-xs p-1 rounded border border-zinc-200 focus:outline-none focus:border-blue-400" />
        <select disabled={busy} value={v.benchmarkId ?? ''}
          onChange={(e) => {
            const b = benchmarks.find((x) => x.id === e.target.value)
            if (!b) { set({ benchmarkId: null }); return }
            onChange({ low: b.low, high: b.high, unit: b.unit, basis: `${b.metric} — ${b.source}`, benchmarkId: b.id, userOverride: false })
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

function ActionCard({ action, benchmarks, busy, api }: { action: CanonicalAction; benchmarks: CanonicalBenchmark[]; busy: boolean; api: ActionsApi }) {
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
          className="w-full text-xs p-1.5 rounded border border-zinc-200 resize-none focus:outline-none focus:border-blue-400" />
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
      <div className="flex gap-2 mt-1.5">
        {action.source === 'LEX' && <span className="text-[9px] font-semibold uppercase tracking-wide text-blue-600 bg-blue-50 rounded px-1 py-0.5">from Lex</span>}
        <button disabled={busy} onClick={() => setEditing(true)} className="text-[11px] text-zinc-400 hover:text-zinc-700">Edit & cost</button>
        <button disabled={busy} onClick={() => api.remove(action.id)} className="text-[11px] text-zinc-400 hover:text-red-600">Remove</button>
      </div>
    </div>
  )
}

// The actions loop + costing estimator (§18).
function ActionsField({ field, actions, benchmarks, busy, api }: { field: CanonicalField; actions: CanonicalAction[]; benchmarks: CanonicalBenchmark[]; busy: boolean; api: ActionsApi }) {
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
        ) : <ActionCard key={a.id} action={a} benchmarks={benchmarks} busy={busy} api={api} />)}
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
export default function FieldsPanel({
  pages, causes, policyOptions, actions, benchmarks, busy,
  onSubmitBox, onAcceptStructured, onSkip, onReopen, causesApi, policyApi, actionsApi,
}: {
  pages: CanonicalState['pages']
  causes: CanonicalCause[]
  policyOptions: CanonicalPolicyOption[]
  actions: CanonicalAction[]
  benchmarks: CanonicalBenchmark[]
  busy: boolean
  onSubmitBox: (key: string, value: string) => void
  onAcceptStructured: (key: string, value: Record<string, string>) => void
  onSkip: (key: string) => void
  onReopen: (key: string) => void
  causesApi: CausesApi
  policyApi: PolicyApi
  actionsApi: ActionsApi
}) {
  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
      {pages.map((page) => {
        const total = page.fields.length
        const done = page.fields.filter((f) => f.status === 'ACCEPTED' || f.status === 'SKIPPED').length
        const isLocked = page.status === 'locked'
        return (
          <div key={page.key}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`shrink-0 w-2.5 h-2.5 rounded-full ${
                page.status === 'complete' ? 'bg-green-500' : page.status === 'active' ? 'bg-blue-500' : 'bg-zinc-200'
              }`} />
              <span className={`text-xs font-semibold uppercase tracking-wide flex-1 ${isLocked ? 'text-zinc-300' : 'text-zinc-700'}`}>
                {page.label}
              </span>
              {!isLocked && total > 0 && <span className="text-[11px] text-zinc-400">{done} of {total}</span>}
              {isLocked && <span className="text-[11px] text-zinc-300">soon</span>}
            </div>

            {!isLocked && (
              <div className="space-y-2">
                {page.fields.map((f) => {
                  if (f.type === 'narrative') return <BoxField key={f.key} field={f} busy={busy} onSubmitBox={onSubmitBox} onSkip={onSkip} />
                  if (f.type === 'structured') return <StructuredField key={f.key} field={f} busy={busy} onAccept={onAcceptStructured} onSkip={onSkip} />
                  if (f.type === 'loop') {
                    if (f.key === 'policyOptions') return <PolicyOptionsField key={f.key} field={f} options={policyOptions} busy={busy} api={policyApi} />
                    if (f.key === 'actions') return <ActionsField key={f.key} field={f} actions={actions} benchmarks={benchmarks} busy={busy} api={actionsApi} />
                    return <CausesField key={f.key} field={f} causes={causes} busy={busy} api={causesApi} />
                  }
                  if (f.type === 'reference') {
                    if (f.key === 'chosenApproach') return <ChosenApproachField key={f.key} field={f} options={policyOptions} busy={busy} api={policyApi} />
                    return <RootCauseField key={f.key} field={f} causes={causes} busy={busy} api={causesApi} />
                  }
                  return <OutputField key={f.key} field={f} busy={busy} onReopen={onReopen} />
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
