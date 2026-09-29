'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-P §1 — THE GUIDING POLICY SCREEN.
//
// ⚠⚠ THE WALKTHROUGH FINDING: *"How do I choose? Do I have to choose one only? What if I want
// parts of others built in?"* — asked of a list of eighteen with no control on it anywhere.
//
// ⚠⚠ AND THE MEASUREMENT THAT SHAPES THE TOP OF THIS SCREEN: those eighteen are SIX BUILDS ×
// THREE, appended — `createPolicyOptions` never deletes and `revisePass` never touches policy
// rows. So the first useful thing to say is not "here are your options"; it is "several of these
// are the same thing in different words, and several are not policies at all."
//
// ⚠ EVERY NUMBER ON THIS SCREEN IS THE STABLE ONE (§1.1), never the position in the list. A
// rejected 7 leaves a visible gap. The user types "merge 4 and 8" and must be able to trust that
// 4 is the 4 they are looking at.
//
// ⚠⚠ NO COLOUR CARRIES MEANING (docs/CLAUDE.md §21 — Charlie is colour blind). §1.6 says it
// outright: **position and text only — no colour-coded grid, no red/amber/green.** The two
// ratings are words in two labelled columns; the verdicts are words; the kinds are words.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MergeAnswer, Rating, Relationship } from '@/lib/lex/guiding-policy'
import { historyLine, clusterLine, GROUP_HEADINGS } from '@/lib/lex/policy-history'
import CollapsedSection from './CollapsedSection'
import PriorVersions from './PriorVersions'
import GuidingPolicyGuideModal from './GuidingPolicyGuideModal'

interface Policy {
  id: string
  number: number | null
  approach: string
  caseFor: string | null
  caseAgainst: string | null
  status: string
  ruleOutReason: string | null
  kind: string
  kindReason: string | null
  sorted: boolean
  moveStatus: string | null
  parkedWithId: string | null
  movedToActionId: string | null
  mergedFrom: number[]
  superseded: boolean
  importance: Rating | null
  addressability: Rating | null
  chainLink: string | null
  phase: string | null
  phaseReason: string | null
  impliedCause: { cause?: string; why?: string; status?: string } | null
  causeNumbers: number[]
  // 26-I §2/§5c
  disposition: 'UNDISPOSITIONED' | 'PART_OF_SOLUTION' | 'SAYS_SAME_AS'
  duplicateOfNumber: number | null
  // 26-L §9 — the sort's own near-duplicate judgement (distinct from the user-asserted one above).
  duplicateOfNumbers: number[]
  draftModel: string | null
  rulesOut: string | null
  likelihood: string | null
  effectiveDisposition: 'RULE_OUT' | 'LATER_PHASE' | 'REALLY_ACTION' | 'PART_OF_SOLUTION' | 'SAYS_SAME_AS' | 'UNDISPOSITIONED'
}

interface State {
  rounds: number
  maxRounds: number
  offerUnresolved: boolean
  unresolved: boolean
  unresolvedWhy: string | null
  settled: string | null
  causes: Array<{ id: string; number: number; cause: string; isRoot: boolean }>
  policies: Policy[]
  pairings: Array<{ a: number; b: number; relationship: Relationship; why: string }>
  // 26-L §9a/§9c/§9d
  nearDuplicates: Array<{ a: number; b: number }>
  excludedCauseNumbers: number[]
  // 26-I addendum A5
  consolidate: {
    candidateCount: number; feedbackCount: number; enabled: boolean; undispositionedCount: number
    // 26-L addendum, decision 103 item 1 — the gate names what it is waiting for.
    waitingOnNumbers: number[]
  }
}

/** 26-I §4 — the judge's verdict on one draft. */
interface JudgeVerdict {
  index: number
  isCompound: boolean
  compoundWhy: string
  rulesOutNothing: boolean
  answersObstacle: { verdict: boolean; why: string }
  causesAttackedByJudge: number[]
  causesMatch: boolean
}

interface Draft {
  id: string
  model: string
  statement: string
  rulesOut: string
  fixesCauseNumbers: number[]
  likelihood: string
  chainLink: string
  judge: JudgeVerdict | null
  costPence: number | null
  userFeedback: string | null
}

interface Consolidation {
  id: string
  status: 'DRAFTING' | 'JUDGED' | 'FAVOURITE_CHOSEN' | 'REDRAFTED' | 'ACCEPTED'
  drafts: Draft[]
  favouriteModel: string | null
  userFeedback: string | null
  redraftText: string | null
  redraftRulesOut: string | null
  redraftLikelihood: string | null
  redraftChainLink: string | null
  redraftJudge: JudgeVerdict | null
  acceptedText: string | null
  acceptedEdited: boolean
  costPence: number | null
}

/**
 * §4 — one card's verdict, in words, no colour (docs/CLAUDE.md §21).
 *
 * ⚠⚠ 26-L §6a / addendum 2 §7 — THE COMPOUND LINE IS A MECHANICAL FLAG, NEVER A VERDICT.
 * `v.isCompound` is `testIsCompound`'s naive "split on and" heuristic (`rumelt-tests.ts`) —
 * measured to false-positive on ordinary compound OBJECTS within one approach ("supporting
 * infrastructure projects and public services" is one approach touching two things, not two
 * approaches; it split "projects and services" and called it two). §6a: "the deterministic
 * test flags for review only — the verdict comes from the judge, with its reasoning" — that
 * verdict is `answersObstacle` below, the judge's own semantic reading. This line is worded to
 * say so, on the card, every time — not only where a check happens to catch it.
 */
function JudgeCard({ v }: { v: JudgeVerdict | null }) {
  if (!v) return <p className="text-[11px] text-zinc-400 mt-2">Not yet tested.</p>
  return (
    <div className="mt-2 pt-2 border-t border-zinc-100 space-y-1">
      <p className={`text-[11px] ${v.isCompound ? 'font-semibold text-amber-800' : 'text-zinc-600'}`}>
        {v.isCompound
          ? // ⚠ 26-L addendum 3 §6 — a FIXED one-line reason, never `v.compoundWhy`: verdicts stored
            // before this fix carry the chopped fragments in that field, and printing it would
            // show them. The judge's own verdict below is the actual finding.
            '⚠ Flagged for review (wording check, not a verdict) — two clauses are joined by “and”; the judge’s reading below says whether it is really two approaches.'
          : 'Mechanical check: not flagged as a compound.'}
      </p>
      <p className={`text-[11px] ${v.rulesOutNothing ? 'font-semibold text-amber-800' : 'text-zinc-600'}`}>
        {v.rulesOutNothing ? '⚠ Rules out: nothing — this is a weakness.' : 'Rules something out.'}
      </p>
      <p className={`text-[11px] ${v.answersObstacle.verdict ? 'text-zinc-600' : 'font-semibold text-amber-800'}`}>
        {v.answersObstacle.verdict ? '✓ Answers the pivotal obstacle' : '⚠ Does not answer the pivotal obstacle'}
        {' — '}{v.answersObstacle.why}
      </p>
      <p className={`text-[11px] ${v.causesMatch ? 'text-zinc-600' : 'font-semibold text-amber-800'}`}>
        {v.causesMatch
          ? '✓ Attacks the causes it claims to.'
          : `⚠ Claims causes it does not attack (the judge read: ${v.causesAttackedByJudge.join(', ') || 'none'}).`}
      </p>
    </div>
  )
}

/** §1.2 — the three outcomes, as a user reads them. */
const KIND_LABEL: Record<string, string> = {
  GUIDING_POLICY: 'A guiding policy',
  COHERENT_ACTION: 'Really a coherent action',
  GOAL_RESTATEMENT: 'Really the goal restated',
}

/** §1.5 — the three relationships, and what each one means you should DO. */
const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  ALTERNATIVES: 'Alternatives — one of these wins',
  CHAIN: 'Different links of one chain — worth merging',
  DISPERSIVE: 'Unrelated branches — sequence, do not combine',
}

/** ⚠ §1.6 — the basis, spelled out. `NOT_FOUND` is the one a reviewer attacks first. */
const BASIS_LABEL: Record<string, string> = {
  RETRIEVED: 'from the research',
  REASONED: 'Lex’s reasoning',
  NOT_FOUND: '⚠ nothing found — not estimated',
}

function RatingCell({ label, r }: { label: string; r: Rating | null }) {
  if (!r) return <div className="text-[11px] text-zinc-400">{label}: not rated yet</div>
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="text-xs text-zinc-800">{r.verdict}</div>
      <div className="text-[11px] text-zinc-600">{r.why}</div>
      {/* ⚠ THE BASIS IS ON THE SCREEN, not in a tooltip. §1.6: label which is reasoning and
          which is retrieved — this is the rating most likely to be wrong. */}
      <div className={`text-[10px] mt-0.5 ${r.basis === 'NOT_FOUND' ? 'font-semibold text-amber-800' : 'text-zinc-500'}`}>
        {BASIS_LABEL[r.basis] ?? r.basis}
      </div>
    </div>
  )
}

/**
 * ══ 25-S §1.2/§1.3 — THE CARD'S OWN HISTORY, AND THE WAY BACK ══════════════════════
 *
 * Charlie: he cannot tell whether the sort ran, because a sorted list looks exactly like an
 * unsorted one. This is the line that tells him, and the control that lets him disagree.
 *
 * ⚠ THE LINE IS COMPUTED IN `lib/lex/policy-history.ts`, not here. The cold read runs the same
 * function over real rows; a copy in the component would be a second vocabulary that agrees
 * until one of them is edited.
 *
 * ⚠ NO LINE WHERE THERE IS NO HISTORY (§1.2). `historyLine` returns null and this renders
 * nothing — which is what lets a reader tell the cards Lex touched from the ones it did not.
 *
 * ⚠ AND THE UNDO ONLY APPEARS WHERE THERE IS SOMETHING TO UNDO. A cluster is a computed
 * relationship rather than a move, so it has no undo and does not pretend to.
 */
function CardHistory({
  p, pairings, busy, onUndo,
}: {
  p: Policy
  pairings: Array<{ a: number; b: number; relationship: string; why: string }>
  busy: boolean
  onUndo?: () => void
}) {
  const line = historyLine({
    number: p.number, kind: p.kind, kindReason: p.kindReason, status: p.status,
    ruleOutReason: p.ruleOutReason, sorted: p.sorted, moveStatus: p.moveStatus,
    mergedFrom: p.mergedFrom, causeNumbers: p.causeNumbers,
    phase: p.phase, phaseReason: p.phaseReason,
    implementsNumber: null,
  })
  const cluster = p.number != null ? clusterLine(p.number, pairings, p.causeNumbers) : null
  if (!line && !cluster && !onUndo) return null

  return (
    <div className="mt-2 pt-1.5 border-t border-zinc-100">
      {line && <p className="text-[11px] text-zinc-600">{line}</p>}
      {cluster && <p className="text-[11px] text-zinc-500">{cluster}</p>}
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          disabled={busy}
          className="mt-1 text-[11px] font-medium text-zinc-600 underline hover:text-zinc-900 disabled:opacity-40"
        >
          Put this back as a guiding policy
        </button>
      )}
    </div>
  )
}

/**
 * ══ 26-L §3b — EVERY CANDIDATE CARD CARRIES THE SAME EDITABLE FIELDS ═══════════════════
 *
 * §3b: *"Every candidate card — built, typed, drafted by Lex or by consolidation — carries the
 * same editable fields: the statement · what it rules out · what it fixes · how likely it is to
 * happen."* Before this there was no edit affordance anywhere on this screen for a card that was
 * not mid-consolidation — a user-typed candidate got a number and nothing to change about it.
 *
 * ⚠ A TOP-LEVEL COMPONENT, NOT A CLOSURE DEFINED INSIDE THE SCREEN'S RENDER. A component
 * declared inside another component's body is a new identity every render, which would drop
 * focus out of the textarea on the first keystroke.
 */
function EditableFields({
  p, editing, draft, busy, onStart, onChange, onSubmit, onCancel,
}: {
  p: Policy
  editing: boolean
  draft: { approach: string; rulesOut: string; caseFor: string; likelihood: string }
  busy: boolean
  onStart: () => void
  onChange: (d: { approach: string; rulesOut: string; caseFor: string; likelihood: string }) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  if (!editing) {
    return (
      <button
        type="button" onClick={onStart} disabled={busy}
        className="text-[11px] text-zinc-500 underline hover:text-zinc-800 disabled:opacity-40 mt-1.5"
      >
        Edit
      </button>
    )
  }
  return (
    <div className="mt-1.5 space-y-1.5 rounded-lg border border-dashed border-zinc-300 p-2">
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">The statement</label>
        <textarea value={draft.approach} onChange={(e) => onChange({ ...draft, approach: e.target.value })}
          rows={2} className="w-full mt-0.5 text-sm rounded border border-zinc-300 p-1.5" />
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">What it rules out</label>
        <textarea value={draft.rulesOut} onChange={(e) => onChange({ ...draft, rulesOut: e.target.value })}
          rows={2} className="w-full mt-0.5 text-xs rounded border border-zinc-300 p-1.5"
          placeholder="What does choosing this close off?" />
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">What it fixes</label>
        <textarea value={draft.caseFor} onChange={(e) => onChange({ ...draft, caseFor: e.target.value })}
          rows={2} className="w-full mt-0.5 text-xs rounded border border-zinc-300 p-1.5"
          placeholder="The case for it" />
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">How likely it is to happen</label>
        <textarea value={draft.likelihood} onChange={(e) => onChange({ ...draft, likelihood: e.target.value })}
          rows={2} className="w-full mt-0.5 text-xs rounded border border-zinc-300 p-1.5" />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onSubmit} disabled={busy || !draft.approach.trim()}
          className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-900 text-white disabled:opacity-40">
          Save
        </button>
        <button type="button" onClick={onCancel} disabled={busy}
          className="text-xs text-zinc-500 underline disabled:opacity-40">
          Cancel
        </button>
      </div>
    </div>
  )
}

/**
 * ══ 26-L addendum 4 §2 — A FEEDBACK BOX THAT SAVES AS YOU TYPE ═════════════════════════════
 * "Every box saves as typed, with visible 'Saved' confirmation — no Send anywhere." Debounced
 * (700ms after the last keystroke) and flushed on blur; the status is always one of four words
 * so the box can never be in a state the user has to guess: Saving…, ✓ Saved, Not saved yet,
 * or a failure that names itself. `onPending` lets the panel hold its buttons until nothing is
 * in flight — a button must never read feedback the server has not yet got.
 * Local text is the truth while typing; a server response never overwrites it.
 */
function AutosaveBox({
  label, initial, resetKey, rows, placeholder, save, onSaved, onPending,
}: {
  label: string
  initial: string
  /** Changes when the box belongs to a different draft/consolidation — the only time `initial` is re-read. */
  resetKey: string
  rows: number
  placeholder?: string
  save: (text: string) => Promise<boolean>
  onSaved: (text: string) => void
  onPending: (pending: boolean) => void
}) {
  const [text, setText] = useState(initial)
  const [status, setStatus] = useState<'clean' | 'dirty' | 'saving' | 'saved' | 'failed'>(initial.trim() ? 'saved' : 'clean')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(text)
  const lastSaved = useRef(initial.trim())

  useEffect(() => {
    setText(initial); latest.current = initial; lastSaved.current = initial.trim()
    setStatus(initial.trim() ? 'saved' : 'clean'); onPending(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  const flush = useCallback(async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const value = latest.current.trim()
    if (value === lastSaved.current) { setStatus(value ? 'saved' : 'clean'); onPending(false); return }
    setStatus('saving'); onPending(true)
    const ok = await save(value)
    if (latest.current.trim() !== value) return // typed more while saving — the newer flush owns the status
    if (ok) { lastSaved.current = value; onSaved(value); setStatus(value ? 'saved' : 'clean') }
    else setStatus('failed')
    onPending(false)
  }, [save, onSaved, onPending])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return (
    <div>
      <label className="text-[11px] font-medium text-zinc-600">{label}</label>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value); latest.current = e.target.value
          setStatus('dirty'); onPending(true)
          if (timer.current) clearTimeout(timer.current)
          timer.current = setTimeout(() => void flush(), 700)
        }}
        onBlur={() => void flush()}
        rows={rows}
        className="w-full mt-1 text-xs rounded border border-zinc-300 p-1.5"
        placeholder={placeholder}
      />
      <p className="text-[10px] font-semibold min-h-[0.875rem]" role="status">
        {status === 'saving' && <span className="text-zinc-500">Saving…</span>}
        {status === 'saved' && <span className="text-emerald-700">✓ Saved</span>}
        {status === 'dirty' && <span className="text-amber-800">Not saved yet</span>}
        {status === 'failed' && <span className="text-red-700">Could not save — your text is still here; it will retry when you edit or leave the box.</span>}
      </p>
    </div>
  )
}

/**
 * ══ 26-I §3-§7 — CONSOLIDATE ═══════════════════════════════════════════════════
 *
 * A5: the button is always visible and shows what it will read (N candidates, M feedback)
 * — never hidden, only disabled, so the gate (§2: every candidate needs a disposition) is
 * something the screen tells you about rather than something you discover by its absence.
 */
function ConsolidatePanel({
  ideaId, consolidateInfo, onSettled,
}: {
  ideaId: string
  consolidateInfo: State['consolidate']
  /** Re-reads the guiding-policy state, e.g. after Accept sets Chosen approach. */
  onSettled: () => void
}) {
  const [consolidation, setConsolidation] = useState<Consolidation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [failedModels, setFailedModels] = useState<Array<{ model: string; error: string }>>([])
  // 26-L addendum 4 §2 — what the SERVER holds, per box (general + one per draft model), kept from
  // each box's own successful save rather than from a response, so two saves in flight cannot
  // overwrite each other. These, not the box text, are what the two buttons say they will use.
  const [savedGeneral, setSavedGeneral] = useState('')
  const [savedDraft, setSavedDraft] = useState<Record<string, string>>({})
  const [pendingBoxes, setPendingBoxes] = useState<Record<string, boolean>>({})
  const [generalOpen, setGeneralOpen] = useState(false)
  const setPending = useCallback((key: string, v: boolean) => {
    setPendingBoxes((m) => (m[key] === v ? m : { ...m, [key]: v }))
  }, [])
  const anyPending = Object.values(pendingBoxes).some(Boolean)
  // 26-L addendum 3 §2 — the outcome of "Start again", so a fresh set of drafts is announced.
  const [startedAgain, setStartedAgain] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [edited, setEdited] = useState({ statement: '', rulesOut: '', likelihood: '', chainLink: '' })

  /** Take what the server holds for a consolidation as the saved baseline for every box. */
  const adoptSaved = useCallback((c: Consolidation) => {
    setSavedGeneral((c.userFeedback ?? '').trim())
    setSavedDraft(Object.fromEntries(c.drafts.map((d) => [d.model, (d.userFeedback ?? '').trim()])))
    setGeneralOpen(!!(c.userFeedback ?? '').trim())
  }, [])

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/ideas/${ideaId}/guiding-policy/consolidate`)
        if (!res.ok) return
        const j = await res.json()
        const latest = (j.consolidations ?? [])[0] ?? null
        if (latest && latest.status !== 'ACCEPTED') {
          setConsolidation(latest)
          adoptSaved(latest)
        }
      } catch { /* no resumable consolidation — starting fresh is fine */ }
    })()
  }, [ideaId])

  const start = useCallback(async (fromId?: string) => {
    setBusy(true); setError(null); setFailedModels([]); setStartedAgain(null)
    try {
      // 26-L addendum 4 §2 — names the consolidation being started again FROM, so the server can
      // hand its feedback (general + per-draft) to the four new drafters.
      const res = await fetch(`/api/ideas/${ideaId}/guiding-policy/consolidate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from: fromId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof j?.error === 'string' ? j.error : 'Consolidate did not complete.'); return }
      setConsolidation(j.consolidation)
      setFailedModels(j.failed ?? [])
      // The new consolidation carries the general comment over (server-side); per-draft boxes
      // start empty because these are new drafts.
      adoptSaved(j.consolidation); setEditing(false)
      setStartedAgain(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    } catch {
      // ⚠ 26-L addendum 3 §2 — a request that dies (a dropped connection on a ~1-minute call)
      // used to end in `finally` and nothing else: the button went back to normal and NOTHING said
      // it had failed. Say so.
      setError('Starting again did not finish — the connection dropped before the four drafts came back. Nothing was lost; press it again, or reload to see whether they arrived.')
    } finally { setBusy(false) }
  }, [ideaId])


  const patchConsolidation = useCallback(async (body: Record<string, unknown>) => {
    if (!consolidation) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/guiding-policy/consolidate/${consolidation.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof j?.error === 'string' ? j.error : 'That did not save.'); return }
      setConsolidation(j.consolidation)
      if (body.op === 'accept') onSettled()
      // 26-L addendum 2 §1 — retry may still leave some models failed; replace the list
      // with whatever failed THIS time, not the original set (a model that just succeeded
      // must stop being offered for retry).
      if (body.op === 'retryFailed') setFailedModels(j.failed ?? [])
      return j
    } finally { setBusy(false) }
  }, [consolidation, ideaId, onSettled])

  /** 26-L addendum 2 §1 — "Retry reruns only the models that failed." */
  const retryFailed = useCallback(() => {
    if (!failedModels.length) return
    void patchConsolidation({ op: 'retryFailed', models: failedModels.map((f) => f.model) })
  }, [failedModels, patchConsolidation])

  /** Autosave for the general box and each draft's box: a plain PATCH that touches no shared
   *  state (no `busy`, no `setConsolidation`), so typing never disables a button or is overwritten. */
  const saveBox = useCallback(async (body: Record<string, unknown>): Promise<boolean> => {
    if (!consolidation) return false
    try {
      const res = await fetch(`/api/ideas/${ideaId}/guiding-policy/consolidate/${consolidation.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      return res.ok
    } catch { return false }
  }, [consolidation, ideaId])

  /** What each button will read, in words — from what is SAVED, never from unsaved box text. */
  const draftsCommented = (consolidation?.drafts ?? []).filter((d) => (savedDraft[d.model] ?? '').trim())
  const usesLine = (action: 'write' | 'again') => {
    const parts: string[] = []
    if (savedGeneral) parts.push('your general feedback')
    if (draftsCommented.length) {
      parts.push(`your comments on ${draftsCommented.length} of the ${consolidation?.drafts.length ?? 4} drafts (${draftsCommented.map((d) => d.model).join(', ')})`)
    }
    const yours = parts.length ? parts.join(' and ') : 'no comments from you yet'
    return action === 'write'
      ? `Will use: ${yours}, and the judge's findings on all four. ${consolidation?.favouriteModel ? `${consolidation.favouriteModel} writes it.` : ''}`.trim()
      : `Will use: ${yours} — to write four new drafts. The drafts above are replaced (your comments on them stay on record).`
  }

  // ⚠ 26-L addendum 3 §5 — UNDER A PENNY IS SHOWN IN PENCE. `£0.00` for a 0.07p draft told the
  // reader it was free; it was 0.07p, and every one of these sums into a margin calculation.
  const pence = (p: number | null | undefined) =>
    p == null ? '(cost unknown)' : p < 1 ? `${p.toFixed(2)}p` : `£${(p / 100).toFixed(2)}`

  return (
    <div className="px-4 py-3 border-t border-zinc-100">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Consolidate</h4>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Reads {consolidateInfo.candidateCount} candidate{consolidateInfo.candidateCount === 1 ? '' : 's'} marked
            part of the solution, sorted, and {consolidateInfo.feedbackCount} item{consolidateInfo.feedbackCount === 1 ? '' : 's'} of feedback.
            {/* ══ 26-L addendum, decision 103 item 1 — NAMES WHAT IT IS WAITING FOR ══════
                A count that doesn't say which is a gap that hides itself. Each number is a
                link that scrolls to the card (`#policy-N`, set on every card in the main
                list and the "Not yet sorted" group). */}
            {!consolidateInfo.enabled && consolidateInfo.waitingOnNumbers.length > 0 && (
              <span className="font-medium text-amber-800">
                {' '}Waiting on{' '}
                {consolidateInfo.waitingOnNumbers.map((n, i) => (
                  <span key={n}>
                    {i > 0 ? (i === consolidateInfo.waitingOnNumbers.length - 1 ? ' and ' : ', ') : ''}
                    <a href={`#policy-${n}`} className="underline hover:text-amber-900">#{n}</a>
                  </span>
                ))}.
              </span>
            )}
          </p>
        </div>
        {/* ══ 26-L addendum 2 §2 — TWO BUTTONS, AND A THIRD, SEPARATE AND LABELLED ═══════════
            "Consolidate" produces four drafts (unchanged). Once a consolidation exists, this
            same button is never reused for "again" — that is its own, explicitly labelled
            control below, so nobody presses it thinking it does the small thing (retry) when
            it does the big one (four fresh drafts, at four models' cost). */}
        {!consolidation && (
          <button
            onClick={() => void start()}
            disabled={busy || !consolidateInfo.enabled}
            className="text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
          >
            {busy ? 'Working…' : 'Consolidate'}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-1.5">{error}</p>}
      {failedModels.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <p className="text-[11px] text-amber-800">
            {failedModels.length} of four models did not draft: {failedModels.map((f) => `${f.model} (${f.error})`).join('; ')}.
          </p>
          {/* §1 — "Retry reruns only the models that failed." Only offered once there is a
              consolidation to retry against (there always is, by the time this renders). */}
          {consolidation && (
            <button
              onClick={retryFailed}
              disabled={busy}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-amber-300 text-amber-800 disabled:opacity-40 whitespace-nowrap"
            >
              {busy ? 'Retrying…' : `Retry ${failedModels.length === 1 ? failedModels[0].model : 'the failed models'}`}
            </button>
          )}
        </div>
      )}

      {consolidation && (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {consolidation.drafts.map((d) => (
              <div
                key={d.id}
                className={`rounded-lg border p-2.5 ${consolidation.favouriteModel === d.model ? 'border-2 border-zinc-900' : 'border-zinc-200'}`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                  {d.model} — {pence(d.costPence)}
                  {consolidation.favouriteModel === d.model && <span className="ml-1 text-zinc-900">· favourite</span>}
                </p>
                <p className="text-sm text-zinc-900 mt-1">{d.statement}</p>
                <p className="text-[11px] text-zinc-600 mt-1.5"><span className="font-medium">Rules out:</span> {d.rulesOut}</p>
                <p className="text-[11px] text-zinc-600 mt-1"><span className="font-medium">Likelihood:</span> {d.likelihood}</p>
                {d.chainLink && (
                  <p className="text-[11px] text-zinc-900 border-l-2 border-zinc-900 pl-2 mt-1.5 font-medium">
                    ⚠ If only part delivered: {d.chainLink}
                  </p>
                )}
                <JudgeCard v={d.judge} />
                {/* ══ 26-L addendum 4 §2 — A BOX ON EACH DRAFT, FOR COMMENTS ON THAT DRAFT ═════ */}
                {consolidation.status !== 'ACCEPTED' && (
                  <div className="mt-2">
                    <AutosaveBox
                      label={`Your comments on ${d.model}'s draft`}
                      initial={d.userFeedback ?? ''}
                      resetKey={d.id}
                      rows={2}
                      placeholder="What is right or wrong about this one?"
                      save={(t) => saveBox({ op: 'saveDraftFeedback', model: d.model, feedback: t })}
                      onSaved={(t) => setSavedDraft((m) => ({ ...m, [d.model]: t }))}
                      onPending={(v) => setPending(`draft:${d.id}`, v)}
                    />
                  </div>
                )}
                {consolidation.status === 'DRAFTING' || consolidation.status === 'JUDGED' ? (
                  <button
                    onClick={() => void patchConsolidation({ op: 'favourite', model: d.model })}
                    disabled={busy}
                    className="mt-2 text-xs font-medium px-2.5 py-1 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40"
                  >
                    Choose this one
                  </button>
                ) : null}
              </div>
            ))}
          </div>

          {consolidation.status !== 'ACCEPTED' && (
            <>
              {/* ══ 26-L addendum 4 §2 — ONE GENERAL BOX, EXPANDABLE, DIRECTLY ABOVE BOTH BUTTONS ═══
                  Replaces the "across all four" box AND the screen's separate "Feedback on the
                  guiding policy in general" box + Send. It is the consolidation's own
                  `userFeedback`: what Charlie had typed into "across all four" is exactly this
                  field, so it carries straight over. Saves as typed; both buttons read it. */}
              <div className="rounded-lg border border-zinc-200 p-2.5">
                <button
                  type="button"
                  onClick={() => setGeneralOpen((o) => !o)}
                  aria-expanded={generalOpen}
                  className="text-[11px] font-semibold text-zinc-700 flex items-center gap-1"
                >
                  <span aria-hidden>{generalOpen ? '▾' : '▸'}</span>
                  General feedback — what worked and what did not, across all four
                  {!generalOpen && savedGeneral && <span className="ml-1 text-emerald-700">· ✓ Saved</span>}
                </button>
                {/* Kept mounted (hidden, not unmounted) so text and save state survive a collapse. */}
                <div className={generalOpen ? 'mt-1.5' : 'hidden'}>
                  <AutosaveBox
                    label="Goes to both “Write the final version” and “Start again”"
                    initial={consolidation.userFeedback ?? ''}
                    resetKey={consolidation.id}
                    rows={4}
                    placeholder="e.g. Gemini's rules-out was the sharpest, but none of them dealt with enforcement burden."
                    save={(t) => saveBox({ op: 'saveFeedback', feedback: t })}
                    onSaved={(t) => setSavedGeneral(t)}
                    onPending={(v) => setPending('general', v)}
                  />
                </div>
              </div>

              {/* ══ 26-L addendum 3 §1 / addendum 4 §1 — "WRITE THE FINAL VERSION" IS ALWAYS THERE ══
                  Greyed out until a favourite is chosen, with the instruction beside it. Keyed on
                  `favouriteModel`, not `status`. Says what it will use (addendum 4 §2). */}
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                <button
                  onClick={() => void patchConsolidation({ op: 'redraft' })}
                  disabled={busy || anyPending || !consolidation.favouriteModel}
                  aria-describedby="write-final-reason"
                  className="text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white disabled:opacity-40 shrink-0"
                >
                  {busy ? 'Working…' : consolidation.redraftText ? 'Write the final version again' : 'Write the final version'}
                </button>
                <div className="flex-1 min-w-[14rem]" id="write-final-reason">
                  {!consolidation.favouriteModel && (
                    <p className="text-[11px] text-zinc-700 mt-1">
                      Choose your favourite of the four. That model then writes the final version — one
                      policy, drawing on all your feedback below.
                    </p>
                  )}
                  <p className="text-[11px] text-zinc-600 mt-1">
                    {anyPending ? 'Saving your feedback…' : usesLine('write')}
                  </p>
                </div>
              </div>

              {/* ══ §2 — "START AGAIN WITH FOUR NEW DRAFTS", SEPARATE AND LABELLED ═════════════════
                  ⚠ 26-L addendum 3 §2 — the click DID work (a fresh consolidation was written); the
                  screen gave no evidence. Progress, reason-when-greyed, arrival confirmation, error.
                  ⚠ 26-L addendum 4 §2 — reads the same feedback as the button above, and says so. */}
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                <button
                  onClick={() => void start(consolidation.id)}
                  disabled={busy || anyPending || !consolidateInfo.enabled}
                  className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40 shrink-0"
                >
                  {busy ? 'Working…' : 'Start again with four new drafts'}
                </button>
                <div className="flex-1 min-w-[14rem]">
                  <p className="text-[11px] text-zinc-600 mt-1">
                    {anyPending ? 'Saving your feedback…' : usesLine('again')}
                  </p>
                  {busy && (
                    <p className="text-[11px] text-zinc-600 mt-1" role="status">
                      Working — this takes about a minute; the result replaces the drafts above when it arrives.
                    </p>
                  )}
                  {!busy && !consolidateInfo.enabled && (
                    <p className="text-[11px] text-amber-800 mt-1">
                      Greyed out: waiting on{' '}
                      {consolidateInfo.waitingOnNumbers.length
                        ? consolidateInfo.waitingOnNumbers.map((n) => `#${n}`).join(', ')
                        : 'a candidate to be sorted'}.
                    </p>
                  )}
                  {!busy && startedAgain && (
                    <p className="text-[11px] font-semibold text-emerald-700 mt-1" role="status">
                      ✓ Four new drafts arrived at {startedAgain} — they replace the earlier set.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {consolidation.redraftText && (
            <div className="rounded-lg border-2 border-zinc-900 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-900">
                Redraft — {consolidation.favouriteModel} — {pence(consolidation.costPence)} total so far
              </p>
              {!editing ? (
                <>
                  <p className="text-sm text-zinc-900 mt-1">{consolidation.redraftText}</p>
                  <p className="text-[11px] text-zinc-600 mt-1.5"><span className="font-medium">Rules out:</span> {consolidation.redraftRulesOut}</p>
                  <p className="text-[11px] text-zinc-600 mt-1"><span className="font-medium">Likelihood:</span> {consolidation.redraftLikelihood}</p>
                  {consolidation.redraftChainLink && (
                    <p className="text-[11px] text-zinc-900 border-l-2 border-zinc-900 pl-2 mt-1.5 font-medium">
                      ⚠ If only part delivered: {consolidation.redraftChainLink}
                    </p>
                  )}
                  <JudgeCard v={consolidation.redraftJudge} />
                  {consolidation.status !== 'ACCEPTED' && (
                    <div className="flex flex-wrap gap-2 mt-2.5">
                      <button
                        onClick={() => void patchConsolidation({ op: 'accept' })}
                        disabled={busy}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-900 text-white disabled:opacity-40"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => {
                          setEdited({
                            statement: consolidation.redraftText ?? '',
                            rulesOut: consolidation.redraftRulesOut ?? '',
                            likelihood: consolidation.redraftLikelihood ?? '',
                            chainLink: consolidation.redraftChainLink ?? '',
                          })
                          setEditing(true)
                        }}
                        disabled={busy}
                        className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40"
                      >
                        Edit before accepting
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-1.5 mt-1.5">
                  <textarea value={edited.statement} onChange={(e) => setEdited((s) => ({ ...s, statement: e.target.value }))}
                    rows={2} className="w-full text-sm rounded border border-zinc-300 p-1.5" placeholder="The statement" />
                  <textarea value={edited.rulesOut} onChange={(e) => setEdited((s) => ({ ...s, rulesOut: e.target.value }))}
                    rows={2} className="w-full text-xs rounded border border-zinc-300 p-1.5" placeholder="What it rules out" />
                  <textarea value={edited.likelihood} onChange={(e) => setEdited((s) => ({ ...s, likelihood: e.target.value }))}
                    rows={2} className="w-full text-xs rounded border border-zinc-300 p-1.5" placeholder="How likely it is to happen" />
                  <textarea value={edited.chainLink} onChange={(e) => setEdited((s) => ({ ...s, chainLink: e.target.value }))}
                    rows={2} className="w-full text-xs rounded border border-zinc-300 p-1.5" placeholder="The chain-link warning" />
                  {/* ⚠ §7a — an edited version is tested again before it is accepted. */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => { void patchConsolidation({ op: 'accept', edited }); setEditing(false) }}
                      disabled={busy || !edited.statement.trim() || !edited.rulesOut.trim() || !edited.likelihood.trim() || !edited.chainLink.trim()}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-900 text-white disabled:opacity-40"
                    >
                      Accept my edit (tested again)
                    </button>
                    <button onClick={() => setEditing(false)} disabled={busy}
                      className="text-xs text-zinc-500 underline disabled:opacity-40">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {consolidation.status === 'ACCEPTED' && (
            <p className="text-xs text-zinc-800 rounded-lg border-2 border-zinc-300 bg-zinc-50/70 px-3 py-2">
              ✓ Accepted{consolidation.acceptedEdited ? ', with your edits' : ''} — this is now the Chosen approach.
              Leverage, Anticipated responses, Conditions for success and the Guiding-policy summary are open below.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function GuidingPolicyScreen({ ideaId }: { ideaId: string }) {
  const [s, setS] = useState<State | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [instruction, setInstruction] = useState('')
  /**
   * ⚠ 25-T §2b — THE PROPOSAL, HELD UNACCEPTED. `na`/`nb` are kept because the card has to show
   * the two PARENTS beside the proposed text, and `wouldBeNumber` is what the merged policy will
   * take if it is accepted — a prediction from the same `nextNumber` the write calls, not a
   * second guess at it. Before 25-T this state described a merge that had ALREADY happened.
   */
  const [answer, setAnswer] = useState<
    { answer: MergeAnswer; wouldBeNumber: number | null; containingNumber: number | null; na: number; nb: number } | null
  >(null)
  const [merged, setMerged] = useState<number | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  // 26-I §1 — the user's own candidate.
  const [addText, setAddText] = useState('')
  const [addCompoundWarning, setAddCompoundWarning] = useState<string | null>(null)
  // 26-I §2 — "says roughly the same as" needs a target number per card.
  const [dupTarget, setDupTarget] = useState<Record<string, string>>({})
  // 26-I addendum A1 — the general feedback box.
  // 26-L §3b — every candidate card carries the same editable fields. One editor open at a
  // time, on the same pattern as ConsolidatePanel's own edit-before-accept.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({ approach: '', rulesOut: '', caseFor: '', likelihood: '' })
  const [showGuide, setShowGuide] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/guiding-policy`)
      if (res.ok) setS(await res.json())
    } catch { /* a screen that cannot load says nothing rather than showing a broken shell */ }
  }, [ideaId])
  useEffect(() => { void load() }, [load])

  const post = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/guiding-policy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { setError(typeof j?.error === 'string' ? j.error : 'That did not complete.'); return null }
      setS(j); return j
    } finally { setBusy(false) }
  }, [ideaId])

  // ══ 26-L addendum 2 §5 — "EVERY ACTION ON A CARD CONFIRMS IT SAVED." ══════════════════════
  // #24 and #25 were set — `disposition: SAYS_SAME_AS`, both with a `duplicateOfNumber`,
  // confirmed live in the database — and Charlie reported no record. The writes were never
  // lost; there was nothing on screen distinguishing "just wrote" from "always was". This is
  // a timestamp per card, set the moment ANY op naming that `policyId` succeeds, read by the
  // disposition row and the feedback box below so a plain write becomes a visible one.
  const [savedAt, setSavedAt] = useState<Record<string, number>>({})

  const patch = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/guiding-policy`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const j = await res.json().catch(() => ({}))
      // ⚠ 25-T §2b — RETURNS THE NEW STATE, as `post` already did. `acceptMerge` has to name the
      // number that was created, and `s` does not carry it yet at the point the caller resumes:
      // `setS` is a queued React update, so reading `s` here would read the list from BEFORE the
      // merge and confidently report the wrong number. Existing callers ignore the return.
      if (!res.ok) { setError(typeof j?.error === 'string' ? j.error : 'That did not save.'); return null }
      setS(j)
      if (typeof body.policyId === 'string') {
        setSavedAt((m) => ({ ...m, [body.policyId as string]: Date.now() }))
      }
      return j
    } finally { setBusy(false) }
  }, [ideaId])

  /** 26-I §1 — the user's own candidate. §1c: tested like the consolidation drafts are —
   *  the compound half of that test, run immediately and shown once, not stored on the card. */
  const addPolicy = useCallback(async () => {
    const text = addText.trim()
    if (!text) return
    setAddCompoundWarning(null)
    const j = await patch({ op: 'add', text })
    if (j) {
      setAddText('')
      if (j.compoundTest?.isCompound) {
        setAddCompoundWarning(`Candidate ${j.addedNumber} — ${j.compoundTest.why}`)
      }
    }
  }, [addText, patch])

  /** §1.7 — "merge 4 and 8". Two numbers is the whole grammar. */
  const runInstruction = useCallback(async () => {
    const nums = (instruction.match(/\d+/g) ?? []).map(Number)
    if (nums.length < 2) {
      setError('Name two policies by their number — for example “merge 4 and 8”.')
      return
    }
    const j = await post({ action: 'merge', numbers: [nums[0], nums[1]] })
    if (j?.answer) {
      setMerged(null)
      setAnswer({
        answer: j.answer, wouldBeNumber: j.wouldBeNumber ?? null,
        containingNumber: j.containingNumber ?? null, na: nums[0], nb: nums[1],
      })
      setInstruction('')
    }
  }, [instruction, post])

  /** 26-L §9c — "Merge?" beside a near-duplicate pair asks the same question `runInstruction`
   *  does, without making the user type the numbers they can already see. */
  const quickMerge = useCallback(async (a: number, b: number) => {
    const j = await post({ action: 'merge', numbers: [a, b] })
    if (j?.answer) {
      setMerged(null)
      setAnswer({ answer: j.answer, wouldBeNumber: j.wouldBeNumber ?? null, containingNumber: j.containingNumber ?? null, na: a, nb: b })
    }
  }, [post])

  /**
   * ⚠⚠ 25-T §2b — THE ACCEPTANCE. This, and nothing before it, is what merges two policies.
   * The number is read back off the STATE THE WRITE RETURNED rather than from `wouldBeNumber`,
   * so what the confirmation names is what was actually created. A prediction repeated back as
   * a result is how a card comes to report a number no row has.
   */
  const acceptMerge = useCallback(async (a: {
    answer: MergeAnswer; na: number; nb: number
  }) => {
    if (!a.answer.merged) return
    const before = new Set((s?.policies ?? []).map((p) => p.number))
    const j = await patch({
      op: 'acceptMerge',
      merge: {
        na: a.na, nb: a.nb, merged: a.answer.merged,
        reasoning: a.answer.reasoning, chainLink: a.answer.chainLink ?? null,
      },
    })
    const created = ((j?.policies ?? []) as Array<{ number: number | null }>)
      .map((p) => p.number).filter((n): n is number => n != null && !before.has(n))
    setMerged(created[0] ?? null)
    setAnswer(null)
  }, [patch, s])

  /**
   * ══ 26-L §2 — "ONE CONTAINS THE OTHER", ACCEPTED. §2a's exact wording is the confirmation. ══
   * ⚠ Unlike `acceptMerge`, no new number is created — the containing policy keeps its own, so
   * there is nothing to read back off the write; the confirmation names the numbers the user
   * already saw on the card.
   */
  const [enhanced, setEnhanced] = useState<{ containing: number; subordinate: number } | null>(null)
  const acceptEnhance = useCallback(async (a: {
    answer: MergeAnswer; containingNumber: number; na: number; nb: number
  }) => {
    if (!a.answer.merged || a.answer.subordinateNumber == null) return
    const j = await patch({
      op: 'acceptEnhance',
      enhance: {
        containingNumber: a.containingNumber,
        subordinateNumber: a.answer.subordinateNumber,
        merged: a.answer.merged,
        reasoning: a.answer.reasoning,
      },
    })
    if (j) setEnhanced({ containing: a.containingNumber, subordinate: a.answer.subordinateNumber })
    setAnswer(null)
  }, [patch])

  /** 26-L §3b — every candidate card carries the same editable fields, whoever drafted it. */
  const startEdit = useCallback((p: Policy) => {
    setEditingId(p.id)
    setEditDraft({
      approach: p.approach, rulesOut: p.rulesOut ?? '', caseFor: p.caseFor ?? '', likelihood: p.likelihood ?? '',
    })
  }, [])
  const submitEdit = useCallback(async (policyId: string) => {
    const j = await patch({ op: 'edit', policyId, edit: editDraft })
    if (j) setEditingId(null)
  }, [patch, editDraft])

  if (!s) return null

  const live = s.policies.filter((p) => p.status !== 'RULED_OUT' && !p.superseded)
  const unsorted = live.filter((p) => !p.sorted)
  const unsortedIds = new Set(unsorted.map((p) => p.id))
  const policies = live.filter((p) => p.kind === 'GUIDING_POLICY' && !unsortedIds.has(p.id))
  const actions = live.filter((p) => p.kind === 'COHERENT_ACTION' && !unsortedIds.has(p.id))
  const goals = live.filter((p) => p.kind === 'GOAL_RESTATEMENT' && !unsortedIds.has(p.id))
  const rejected = s.policies.filter((p) => p.status === 'RULED_OUT')
  const later = policies.filter((p) => p.phase === 'LATER')
  // 26-L addendum, decision 103 item 1 — which cards the gate is waiting on, marked in place.
  const waitingOn = new Set(s.consolidate.waitingOnNumbers)

  return (
    <section className="rounded-2xl border border-zinc-200 mt-3" aria-label="Choosing a guiding policy">
      <div className="px-4 py-3 border-b border-zinc-100">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">Choosing a guiding policy</h3>
          {/* ══ 26-L §8 — "HOW TO WRITE A GUIDING POLICY", SAME COLOUR/FONT/STYLE AS "HOW THIS
              WORKS" (see components/lex/HowItWorksModal.tsx and its callers). */}
          <button
            onClick={() => setShowGuide(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full px-3 py-1.5 shadow-sm transition-colors shrink-0"
          >
            <span aria-hidden className="w-3.5 h-3.5 rounded-full border border-white/80 flex items-center justify-center text-[9px] font-bold">?</span>
            How to write a Guiding Policy
          </button>
        </div>
        {/* ══ 26-L addendum 2 §3 — THE INTRODUCTION, REPLACED VERBATIM ═══════════════════
            Supersedes BRIEF_26L §10a / decision 103 item 2's wording. This version drops "the
            success of your mission" framing for what a guiding policy actually IS — the
            principle by which actions are judged, not the actions — and states the three-way
            gate (sorted, allocated OR commented) explicitly rather than "commented" standing
            in for all three, and names "Write the final version" as its own step. */}
        <p className="text-xs text-zinc-600 mt-2 leading-relaxed">
          After choosing the right cause, getting the guiding policy right is the next most
          important task, and it&rsquo;s not easy. A good guiding policy brings focus and
          clarity by providing the principle by which you can judge which actions to take. It
          shouldn&rsquo;t describe the actions themselves — that&rsquo;s for the next stage.
        </p>
        <p className="text-xs font-semibold text-zinc-900 mt-2">Next steps.</p>
        <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
          First sort the candidate policies below with your comments (and add your own if you
          wish), then click the <span className="font-medium">Consolidate</span> button at the
          end — greyed out until you&rsquo;ve sorted, allocated or commented on each option.
          Consolidation takes your feedback and gives you suggestions from four premium AI
          models. You then choose the best of those, add final feedback and click{' '}
          <span className="font-medium">Write the final version</span>.
        </p>
      </div>

      {showGuide && <GuidingPolicyGuideModal onClose={() => setShowGuide(false)} />}

      {error && <p className="px-4 py-2 text-xs text-amber-800 bg-amber-50 border-b border-amber-200">{error}</p>}

      {/* ══ 26-I §1 — THE USER CAN ADD A GUIDING POLICY OF THEIR OWN ═══════════════
          §1a: their words, verbatim. §1b: enters the sort, numbered, alongside Lex's. §1c:
          tested like the consolidation drafts are — the compound half of that test fires the
          moment it's added, shown once, the way a chat reply would say it. */}
      <div className="px-4 py-3 border-b border-zinc-100">
        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Add a guiding policy
        </label>
        <div className="flex gap-2 mt-1.5">
          <input
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void addPolicy() }}
            placeholder="Your own approach to the obstacle…"
            className="flex-1 text-sm rounded-lg border border-zinc-300 px-2.5 py-1.5"
          />
          <button onClick={() => void addPolicy()} disabled={busy || !addText.trim()}
            className="text-sm font-semibold px-4 py-1.5 rounded-full bg-zinc-900 text-white disabled:opacity-40">
            Add
          </button>
        </div>
        {addCompoundWarning && (
          <p className="mt-1.5 text-[11px] font-medium text-amber-800">⚠ {addCompoundWarning}</p>
        )}
      </div>

      {/* ══ 26-L §1a — "NOT YET SORTED": EVERY UNSORTED CANDIDATE, AS A REAL CARD, AT THE TOP ══
          §1: Charlie added candidate 29 by hand, the screen said "1 of these has not been sorted
          yet", and it rendered nowhere. Whatever the exact mechanism, no candidate should ever
          again depend on the sort having run to be visible at all — this group renders by
          `!p.sorted` alone, independent of `kind`, so it cannot be left with nowhere to render. */}
      {unsorted.length > 0 && (
        <div className="px-4 py-3 border-b border-zinc-100 space-y-3">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Not yet sorted ({unsorted.length})
            </h4>
            <p className="text-xs text-zinc-700 mt-1">
              Lex will say which are guiding policies, which are really coherent actions, and
              which are the goal restated — <span className="font-medium">with its reasoning for
              each</span>. Until then, they are here — full candidates, not placeholders.
            </p>
            <button
              onClick={() => void post({ action: 'sort' })}
              disabled={busy}
              className="mt-2 text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
            >
              {busy ? 'Sorting…' : 'Sort these for me'}
            </button>
          </div>
          {unsorted.map((p) => (
            <article key={p.id} id={`policy-${p.number}`} className="rounded-lg border border-zinc-300 bg-zinc-50/50 p-3 scroll-mt-4">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-zinc-900 tabular-nums">{p.number}</span>
                <p className="text-sm text-zinc-900 flex-1">{p.approach}</p>
              </div>
              {/* ══ 26-L addendum, decision 103 item 1 — MARKED ON THE CARD ═══════════════ */}
              {p.number != null && waitingOn.has(p.number) && (
                <p className="mt-1.5 text-[11px] font-semibold text-amber-800">
                  ⚠ Consolidate is waiting on this one — mark it, or leave feedback below.
                </p>
              )}
              {/* ⚠⚠ §3c — THE COMPOUND FLAG, ON THE CARD, AS ADVICE. Never a verdict (§6a — the
                  verdict comes from the judge/sort, with reasoning); never blocking (the card
                  exists and is fully usable regardless of whether this fired). */}
              {p.kindReason && (
                <p className="mt-1.5 text-[11px] font-medium text-amber-800">{p.kindReason}</p>
              )}
              <EditableFields
                p={p} editing={editingId === p.id} draft={editDraft} busy={busy}
                onStart={() => startEdit(p)} onChange={setEditDraft}
                onSubmit={() => void submitEdit(p.id)} onCancel={() => setEditingId(null)}
              />
              <PriorVersions ideaId={ideaId} fieldKey="policyOptions" targetId={p.id} nonce={editingId === p.id ? 1 : 0} />
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <button onClick={() => void patch({ op: 'reject', policyId: p.id, reason: reasons[p.id] })} disabled={busy}
                  className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 text-zinc-600 disabled:opacity-40">
                  Rule out
                </button>
                <input
                  value={reasons[p.id] ?? ''}
                  onChange={(e) => setReasons((r) => ({ ...r, [p.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter' && reasons[p.id]?.trim()) void patch({ op: 'fileFeedback', policyId: p.id, reason: reasons[p.id] }) }}
                  placeholder="Feedback on this candidate"
                  className="flex-1 min-w-[10rem] text-[11px] rounded border border-zinc-300 px-2 py-1"
                />
                {/* §5 — the same Save button, the same card everywhere it appears. */}
                <button onClick={() => void patch({ op: 'fileFeedback', policyId: p.id, reason: reasons[p.id] })}
                  disabled={busy || !reasons[p.id]?.trim()}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40">
                  Save
                </button>
                {savedAt[p.id] != null && (
                  <span className="text-[10px] font-semibold text-emerald-700">✓ Saved</span>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ⚠⚠ §1.2 — "VISIBLE, NOT SILENT." 26-L addendum 2 §4 moved this line to the bottom,
          just above Consolidate — see there for the templated wording and the links. */}

      {/* ══ THE POLICIES ═══════════════════════════════════════════════════════ */}
      <div className="px-4 py-3 space-y-3">
        {/* ══ 25-S §1.1 — THE HEADING THIS GROUP NEVER HAD ═══════════════════════
            The other two groups have carried a heading and a count since 25-P — "Really
            coherent actions (3)", "Really the goal restated (2)". This one did not, so the
            top of the screen read as *the list* and the rest as appendices to it.

            ⚠ §1.1: **the headings are the sort.** Three named groups with counts tell a user
            that something sorted them; the same items in the same order without them tell
            nobody anything, however good the sorting was. The missing heading was the one
            that mattered most, because it is the one at the top. */}
        <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          {GROUP_HEADINGS.GUIDING_POLICY(policies.length)}
        </h4>
        {policies.map((p) => (
          <article key={p.id} id={`policy-${p.number}`} className="rounded-lg border border-zinc-200 p-3 scroll-mt-4">
            <div className="flex items-baseline gap-2">
              {/* §1.1 — THE STABLE NUMBER, prominent, because the user types it. */}
              <span className="text-sm font-bold text-zinc-900 tabular-nums">{p.number}</span>
              <p className="text-sm text-zinc-900 flex-1">{p.approach}</p>
            </div>

            {/* ══ 26-L addendum, decision 103 item 1 — MARKED ON THE CARD ═══════════════════
                §1: "each waiting card marked on the card itself." */}
            {p.number != null && waitingOn.has(p.number) && (
              <p className="mt-2 text-[11px] font-semibold text-amber-800">
                ⚠ Consolidate is waiting on this one — mark it below, or leave feedback.
              </p>
            )}

            {/* ⚠⚠ §1.8 — THE CHAIN-LINK CONSEQUENCE, FLAGGED AS IMPORTANT. It is the first thing
                cut for length unless it is marked, and a legislature takes the easy half. */}
            {p.chainLink && (
              <p className="mt-2 text-xs text-zinc-900 border-l-2 border-zinc-900 pl-2.5 font-medium">
                ⚠ If only part of this is delivered: {p.chainLink}
              </p>
            )}

            {/* §1.6 — two judgements, side by side, in text. Never a score, never a colour. */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
              <RatingCell label="How much it fixes" r={p.importance} />
              <RatingCell label="How likely it is to happen" r={p.addressability} />
            </div>

            {p.causeNumbers.length > 0 && (
              <p className="text-[11px] text-zinc-500 mt-2">
                Attacks cause {p.causeNumbers.join(', ')}.{' '}
                {/* ⚠⚠ MEASURED: `targetCauseIds` was set on ZERO of 18 rows before this sprint.
                    Nothing has ever written the structural link, so this is Lex's judgement and
                    the screen says so rather than implying the chain asserted it. */}
                <span className="text-zinc-400">Lex’s reading of which cause this answers.</span>
              </p>
            )}

            {/* ⚠ 25-S §1.2 — THE CARD'S OWN HISTORY, AT THE FOOT. "Merged from 4 and 8" used
                to be a bare line here; it is one case of the vocabulary now, so a kept policy,
                a merged one and one held for a later phase all say what happened to them in the
                same voice and the same place. */}
            <CardHistory p={p} pairings={s.pairings} busy={busy} />

            {/* ══ 26-L §2b/§3b — EDIT, AND ITS OWN HISTORY, CLICKABLE ═══════════════
                §2b: an enhanced card shows its wording before the enhancement, both clickable.
                §3b: every candidate card carries the same editable fields. One mechanism does
                both — an edit here and an accepted "one contains the other" both write through
                the same `FieldRevision` history this renders. */}
            <EditableFields
              p={p} editing={editingId === p.id} draft={editDraft} busy={busy}
              onStart={() => startEdit(p)} onChange={setEditDraft}
              onSubmit={() => void submitEdit(p.id)} onCancel={() => setEditingId(null)}
            />
            <PriorVersions ideaId={ideaId} fieldKey="policyOptions" targetId={p.id} nonce={editingId === p.id ? 1 : 0} />

            {/* ══ §1.4 — THE CAUSE THIS POLICY IMPLIES ═══════════════════════════ */}
            {p.impliedCause?.cause && p.impliedCause.status === 'OFFERED' && (
              <div className="mt-2.5 rounded-lg border-2 border-zinc-300 bg-white p-2.5">
                <p className="text-xs text-zinc-900">
                  Choosing {p.number} implies a cause you haven’t included —{' '}
                  <span className="font-medium">{p.impliedCause.cause}</span>. Would you like to add
                  it to your causes?
                </p>
                {p.impliedCause.why && (
                  <p className="text-[11px] text-zinc-600 mt-1">{p.impliedCause.why}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  <button onClick={() => void patch({ op: 'acceptCause', policyId: p.id })} disabled={busy}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-900 text-white disabled:opacity-40">
                    Add it to my causes
                  </button>
                  <button onClick={() => void patch({ op: 'declineCause', policyId: p.id, reason: reasons[p.id] })} disabled={busy}
                    className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40">
                    No — leave my diagnosis as it is
                  </button>
                </div>
                {/* ⚠ THE DECLINE IS RECORDED AGAINST THE POLICY as a weakness, and saying so
                    before they decline is fairer than recording it silently afterwards. */}
                <p className="text-[10px] text-zinc-500 mt-1.5">
                  If you decline, this stays on the record against {p.number} as a gap between the
                  policy and the diagnosis — the hostile read will see it.
                </p>
              </div>
            )}
            {p.impliedCause?.status === 'ACCEPTED' && (
              <p className="text-[11px] text-zinc-700 mt-2">
                ✓ Added to your causes. <span className="text-zinc-500">Your diagnosis has moved —
                the causes section has changed.</span>
              </p>
            )}
            {p.impliedCause?.status === 'DECLINED' && (
              <p className="text-[11px] text-amber-800 mt-2">
                ⚠ Recorded: this policy answers a cause your diagnosis does not claim.
              </p>
            )}

            {p.phase === 'LATER' && (
              <p className="text-[11px] text-zinc-700 mt-2">
                Kept for a later phase{p.phaseReason ? ` — ${p.phaseReason}` : ''}.
              </p>
            )}

            {/* ══ 26-L addendum, decision 103 item 3 — "MAKE THIS THE GUIDING POLICY" BECOMES
                "PART OF THE SOLUTION" ═══════════════════════════════════════════════════════
                It used to settle this candidate directly (`op: 'settle'`) — bypassing
                Consolidate entirely, uncounted by its gate, and the reason #2 could become
                CHOSEN and stay that way through a second press elsewhere. There is no separate
                button any more: the disposition row below already has "Part of the solution",
                doing the same job and counted by the gate. The final choice comes from
                Consolidate and Accept, never from this row. */}
            <div className="flex flex-wrap gap-2 mt-2.5">
              <button onClick={() => void patch({ op: 'phase', policyId: p.id, phase: 'LATER', reason: reasons[p.id] })} disabled={busy}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40">
                Later phase
              </button>
              <button onClick={() => void patch({ op: 'reject', policyId: p.id, reason: reasons[p.id] })} disabled={busy}
                className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 text-zinc-600 disabled:opacity-40">
                Rule out
              </button>
              <input
                value={reasons[p.id] ?? ''}
                onChange={(e) => setReasons((r) => ({ ...r, [p.id]: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter' && reasons[p.id]?.trim()) void patch({ op: 'fileFeedback', policyId: p.id, reason: reasons[p.id] }) }}
                placeholder="Feedback on this candidate (kept, whatever you're doing to it)"
                className="flex-1 min-w-[10rem] text-[11px] rounded border border-zinc-300 px-2 py-1"
              />
              {/* ══ 26-L addendum 2 §5 — "A SAVE BUTTON ON FEEDBACK TEXT." ═══════════════
                  It travelled bundled with Rule out/Later phase before; typing feedback with
                  neither in mind had nothing to press. */}
              <button onClick={() => void patch({ op: 'fileFeedback', policyId: p.id, reason: reasons[p.id] })}
                disabled={busy || !reasons[p.id]?.trim()}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40">
                Save
              </button>
            </div>

            {/* ══ 26-I §2 — THE DISPOSITION, READ AS ONE OF FIVE ══════════════════
                Rule out / Later phase are the buttons above; this row is the two new ones
                plus asserting "really an action" yourself, rather than waiting for the sort. */}
            <div className="flex flex-wrap items-center gap-2 mt-2 pt-2 border-t border-zinc-100">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                {p.effectiveDisposition === 'PART_OF_SOLUTION' ? '✓ Part of the solution'
                  : p.effectiveDisposition === 'SAYS_SAME_AS' ? `✓ Says roughly the same as ${p.duplicateOfNumber}`
                  : 'No disposition yet'}
              </span>
              {/* ══ §5 — "A VISIBLE 'SAVED' AFTER ANY DISPOSITION." #24 and #25 were set —
                  confirmed in the database, `disposition: SAYS_SAME_AS`, both with a
                  `duplicateOfNumber` — and Charlie reported no record, because nothing on
                  screen distinguished a fresh write from the resting state. */}
              {savedAt[p.id] != null && (
                <span className="text-[10px] font-semibold text-emerald-700">✓ Saved</span>
              )}
              {p.effectiveDisposition !== 'PART_OF_SOLUTION' && (
                <button onClick={() => void patch({ op: 'markPartOfSolution', policyId: p.id })} disabled={busy}
                  className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40">
                  Part of the solution
                </button>
              )}
              <select
                value={dupTarget[p.id] ?? ''}
                onChange={(e) => setDupTarget((d) => ({ ...d, [p.id]: e.target.value }))}
                className="text-[11px] rounded border border-zinc-300 px-1.5 py-1"
              >
                <option value="">Says roughly the same as…</option>
                {policies.filter((o) => o.id !== p.id && o.number != null).map((o) => (
                  <option key={o.id} value={o.number!}>
                    {o.number} — {o.approach.slice(0, 40)}{o.approach.length > 40 ? '…' : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  const n = Number(dupTarget[p.id])
                  if (n) void patch({ op: 'markSaysSameAs', policyId: p.id, duplicateOfNumber: n })
                }}
                disabled={busy || !dupTarget[p.id]}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40"
              >
                Set
              </button>
              {p.effectiveDisposition !== 'UNDISPOSITIONED' && (
                <button onClick={() => void patch({ op: 'clearDisposition', policyId: p.id })} disabled={busy}
                  className="text-[11px] text-zinc-500 underline disabled:opacity-40">
                  Clear
                </button>
              )}
              {/* §2 — "really an action... the user may also assert it", unlike the automatic
                  sort below (§1.3), which only OFFERS a reclassification for consent. */}
              <button onClick={() => void patch({ op: 'assertAction', policyId: p.id })} disabled={busy}
                className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40">
                This is really an action
              </button>
            </div>

            {/* 25-P's own ALTERNATIVES relation (§2 — "reuse the alternative relation 25-P
                already computes"), offered as a hint rather than a second mechanism. */}
            {s.pairings.some((x) => (x.a === p.number || x.b === p.number) && x.relationship === 'ALTERNATIVES') && (
              <p className="text-[10px] text-zinc-400 mt-1">
                Lex reads this as an alternative to{' '}
                {s.pairings.filter((x) => (x.a === p.number || x.b === p.number) && x.relationship === 'ALTERNATIVES')
                  .map((x) => (x.a === p.number ? x.b : x.a)).join(', ')} — same cause, different means.
              </p>
            )}
          </article>
        ))}
      </div>

      {/* ══ 26-L addendum 2 §4 — "VISIBLE, NOT SILENT", MOVED TO THE BOTTOM ═══════════════════
          §1.2's original point stands (if Lex removes N of M without saying so, the user
          believes Lex lost them) — it was just in the wrong place, ahead of the very list it
          was summarising. Now generated from the actual counts, not a fixed template, and each
          clause links to its group. */}
      {(actions.length > 0 || goals.length > 0) && (
        <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/70">
          <p className="text-xs font-semibold text-zinc-900">
            {actions.length > 0 && (
              <>
                {actions.length} {actions.length === 1 ? 'was' : 'were'} considered to be{' '}
                {actions.length === 1 ? 'an action' : 'actions'} rather than guiding principles
              </>
            )}
            {actions.length > 0 && goals.length > 0 && ', and '}
            {goals.length > 0 && (
              <>
                {goals.length === 1 ? 'one was' : `${goals.length} were`} considered to be the
                goal restated
              </>
            )}
            . You can review and re-allocate if you disagree —{' '}
            {actions.length > 0 && <a href="#policy-group-actions" className="underline hover:text-zinc-700">see the actions</a>}
            {actions.length > 0 && goals.length > 0 && ', '}
            {goals.length > 0 && <a href="#policy-group-goals" className="underline hover:text-zinc-700">see the goal restatements</a>}
            .
          </p>
        </div>
      )}

      {/* ══ 26-I §3-§7 — CONSOLIDATE ═══════════════════════════════════════════ */}
      <ConsolidatePanel ideaId={ideaId} consolidateInfo={s.consolidate} onSettled={load} />

      {/* ══ 26-L addendum 4 §2 — THE "FEEDBACK ON THE GUIDING POLICY IN GENERAL" BOX AND ITS SEND
          BUTTON ARE GONE from this screen. Its job is done by the one general box inside the
          Consolidate panel above, which saves as typed and is read by both buttons. (The
          `/guiding-policy/feedback` route and any GENERAL_BOX rows already filed are untouched.) */}

      {/* ══ 26-L §9 — HOW THEY RELATE, NEAR-DUPLICATES FIRST ═══════════════════════
          §9: "It declares nearly every pair 'alternatives — one of these wins' because they
          share [the pivotal] cause. Meanwhile #3 and #6, which are near-identical, appear last."
          §9a: relate by similarity of APPROACH, not overlap of causes. §9c: near-duplicates
          first, each with a Merge? action. §9b: a cause every candidate attacks is excluded —
          reported below, not applied silently. */}
      {(s.nearDuplicates.length > 0 || s.pairings.length > 0) && (
        <div className="px-4 py-3 border-t border-zinc-100">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            How these relate
          </h4>

          {s.nearDuplicates.length > 0 && (
            <div className="mt-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Near-duplicates ({s.nearDuplicates.length})
              </p>
              <ul className="mt-1 space-y-1.5">
                {s.nearDuplicates.map((d, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-zinc-700">
                    <span className="font-semibold tabular-nums">{d.a} &amp; {d.b}</span>
                    <span className="text-zinc-600">— Lex reads these as saying substantially the same thing.</span>
                    <button
                      onClick={() => void quickMerge(d.a, d.b)}
                      disabled={busy}
                      className="text-[11px] font-medium px-2.5 py-0.5 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40 shrink-0"
                    >
                      Merge?
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {s.pairings.length > 0 && (
            <div className="mt-2.5">
              {s.nearDuplicates.length > 0 && (
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  By shared cause
                </p>
              )}
              <ul className="mt-1 space-y-1.5">
                {s.pairings.slice(0, 12).map((x, i) => (
                  <li key={i} className="text-xs text-zinc-700">
                    <span className="font-semibold tabular-nums">{x.a} &amp; {x.b}</span>{' '}
                    — <span className="font-medium">{RELATIONSHIP_LABEL[x.relationship]}.</span>{' '}
                    <span className="text-zinc-600">{x.why}</span>
                  </li>
                ))}
              </ul>
              {s.pairings.length > 12 && (
                <p className="text-[11px] text-zinc-500 mt-1">
                  {s.pairings.length - 12} further pairs not listed.
                </p>
              )}
            </div>
          )}

          {/* ⚠ §9b/§9d — REPORTED, NOT SILENT. A cause this many candidates attack carries no
              information about any one pair of them, so it never drives a relationship above. */}
          {s.excludedCauseNumbers.length > 0 && (
            <p className="text-[11px] text-zinc-400 mt-2">
              Cause{s.excludedCauseNumbers.length === 1 ? '' : 's'} {s.excludedCauseNumbers.join(', ')} attacked
              by most or all live candidates — excluded from the relations above; sharing it says
              nothing about any one pair.
            </p>
          )}
        </div>
      )}

      {/* ══ §1.7 — THE INSTRUCTION BOX ═════════════════════════════════════════ */}
      <div className="px-4 py-3 border-t border-zinc-100">
        <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Tell Lex what to do
        </label>
        <div className="flex gap-2 mt-1.5">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void runInstruction() }}
            placeholder="merge 4 and 8"
            className="flex-1 text-sm rounded-lg border border-zinc-300 px-2.5 py-1.5"
          />
          <button onClick={() => void runInstruction()} disabled={busy}
            className="text-sm font-semibold px-4 py-1.5 rounded-full bg-zinc-900 text-white disabled:opacity-40">
            {busy ? 'Thinking…' : 'Ask'}
          </button>
        </div>
        <p className="text-[11px] text-zinc-500 mt-1">
          Refer to policies by their number. Lex will tell you whether they merge, whether one is
          really an action of the other, whether they should be sequenced, or whether they
          contradict — and why.
        </p>

        {/* ⚠ 25-T §2b — the confirmation, AFTER the write, naming the row that now exists. */}
        {merged != null && (
          <p className="mt-2.5 text-xs text-zinc-900 font-medium rounded-lg border-2 border-zinc-300 bg-zinc-50/70 px-3 py-2">
            Merged into policy {merged}. Both originals keep their numbers and are in “Ruled out”
            below, marked “Merged into {merged}.” — restore either one to undo this.
          </p>
        )}

        {/* ⚠⚠ 26-L §2a — THE CONFIRMATION "ONE CONTAINS THE OTHER" NEVER HAD, VERBATIM. */}
        {enhanced && (
          <p className="mt-2.5 text-xs text-zinc-900 font-medium rounded-lg border-2 border-zinc-300 bg-zinc-50/70 px-3 py-2">
            #{enhanced.containing} has been enhanced to include #{enhanced.subordinate}. #{enhanced.subordinate} has
            been archived — see its own wording under “Ruled out” below, and {enhanced.containing}’s wording before
            this change under “Edit” on its card. Restore #{enhanced.subordinate} to undo the archiving.
          </p>
        )}

        {answer && (
          <div className="mt-2.5 rounded-lg border-2 border-zinc-300 bg-zinc-50/70 p-3">
            {/* ══════════ 25-T §2b — A PROPOSAL, NOT A REPORT ════════════════════════════════
                §2b: *"The merge writes only on the user's acceptance, as a card showing the two
                parents and the proposed merged policy side by side."*

                ⚠⚠ THE HEADING USED TO SAY "Merged." — IN THE PAST TENSE, BECAUSE IT WAS TRUE.
                The POST that asked the question performed the write, so by the time this card
                appeared the list had already changed underneath it. The user was reading a
                report of something they had not agreed to. Now it says what it is: a proposal
                with two buttons, and nothing has been written when it renders. */}
            <p className="text-xs font-semibold text-zinc-900">
              {answer.answer.verdict === 'MERGE' ? `These two can merge — nothing has changed yet.`
                : answer.answer.verdict === 'ONE_CONTAINS_THE_OTHER' && answer.answer.merged && answer.containingNumber
                ? `#${answer.containingNumber} covers #${answer.answer.subordinateNumber} — nothing has changed yet.`
                : answer.answer.verdict === 'ONE_CONTAINS_THE_OTHER' ? 'Not a merge — one contains the other.'
                : answer.answer.verdict === 'SEQUENCE' ? 'Not a merge — sequence them.'
                : 'Refused — they contradict.'}
            </p>
            <p className="text-xs text-zinc-700 mt-1">{answer.answer.reasoning}</p>

            {/* ⚠ SIDE BY SIDE, and it wraps to one column on a narrow screen rather than
                shrinking three columns of prose to unreadable width. */}
            {answer.answer.verdict === 'MERGE' && answer.answer.merged && (
              <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
                {[answer.na, answer.nb].map((n) => {
                  const parent = s.policies.find((p) => p.number === n)
                  return (
                    <div key={n} className="rounded-lg border border-zinc-300 bg-white p-2.5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        Policy {n} — would be superseded
                      </p>
                      <p className="text-xs text-zinc-800 mt-1">{parent?.approach ?? '(not found)'}</p>
                    </div>
                  )
                })}
                <div className="rounded-lg border-2 border-zinc-900 bg-white p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-900">
                    Proposed{answer.wouldBeNumber ? ` — would become policy ${answer.wouldBeNumber}` : ''}
                  </p>
                  <p className="text-xs text-zinc-900 mt-1">{answer.answer.merged.approach}</p>
                </div>
              </div>
            )}

            {/* ══ 26-L §2a/§2b — "ONE CONTAINS THE OTHER", AS A PROPOSAL, THE SAME SHAPE AS MERGE ══
                #{containing} keeps its own number; #{subordinate} would be archived into it, not
                superseded by a new row. */}
            {answer.answer.verdict === 'ONE_CONTAINS_THE_OTHER' && answer.answer.merged && answer.containingNumber && (
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-zinc-300 bg-white p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                    #{answer.answer.subordinateNumber} — would be archived
                  </p>
                  <p className="text-xs text-zinc-800 mt-1">
                    {s.policies.find((p) => p.number === answer.answer.subordinateNumber)?.approach ?? '(not found)'}
                  </p>
                </div>
                <div className="rounded-lg border-2 border-zinc-900 bg-white p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-900">
                    #{answer.containingNumber} — would keep its number, wording enhanced
                  </p>
                  <p className="text-xs text-zinc-900 mt-1">{answer.answer.merged.approach}</p>
                </div>
              </div>
            )}

            {answer.answer.chainLink && (
              <p className="mt-1.5 text-xs text-zinc-900 border-l-2 border-zinc-900 pl-2.5 font-medium">
                ⚠ If only part of this is delivered: {answer.answer.chainLink}
              </p>
            )}

            {/* ⚠ 25-T §2e — A VERDICT OFFERS A BUTTON ONLY WHERE THERE IS SOMETHING TO ACCEPT.
                MERGE always does; ONE_CONTAINS_THE_OTHER does only where the judge wrote a
                restated text (26-L §2) — SEQUENCE/CONTRADICTORY remain advice with nothing to
                accept, and offering an inert button would imply otherwise. */}
            {answer.answer.verdict === 'MERGE' && answer.answer.merged ? (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  onClick={() => void acceptMerge(answer)}
                  disabled={busy}
                  className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
                >
                  Merge them into one policy
                </button>
                <button
                  onClick={() => setAnswer(null)}
                  disabled={busy}
                  className="text-xs font-semibold px-3.5 py-1.5 rounded-full border border-zinc-400 text-zinc-800 bg-white hover:bg-zinc-50 disabled:opacity-40"
                >
                  Leave them as they are
                </button>
              </div>
            ) : answer.answer.verdict === 'ONE_CONTAINS_THE_OTHER' && answer.answer.merged && answer.containingNumber ? (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  onClick={() => void acceptEnhance({ answer: answer.answer, containingNumber: answer.containingNumber!, na: answer.na, nb: answer.nb })}
                  disabled={busy}
                  className="text-xs font-semibold px-3.5 py-1.5 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
                >
                  Enhance {answer.containingNumber} and archive {answer.answer.subordinateNumber}
                </button>
                <button
                  onClick={() => setAnswer(null)}
                  disabled={busy}
                  className="text-xs font-semibold px-3.5 py-1.5 rounded-full border border-zinc-400 text-zinc-800 bg-white hover:bg-zinc-50 disabled:opacity-40"
                >
                  Leave them as they are
                </button>
              </div>
            ) : (
              <button onClick={() => setAnswer(null)} className="text-[11px] text-zinc-500 mt-2 underline">
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>

      {/* ══ §1.3 — THE ITEMS THAT ARE REALLY ACTIONS ═══════════════════════════ */}
      {actions.length > 0 && (
        <div id="policy-group-actions" className="px-4 py-3 border-t border-zinc-100 scroll-mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Really coherent actions ({actions.length})
          </h4>
          <p className="text-[11px] text-zinc-600 mt-0.5">
            These are things you would <span className="font-medium">do</span> to carry a policy
            out. They belong in Coherent Actions — but nothing moves until you say so.
          </p>
          <ul className="mt-2 space-y-2">
            {actions.map((a) => {
              const parent = a.parkedWithId ? s.policies.find((x) => x.id === a.parkedWithId) : null
              return (
                <li key={a.id} className="rounded-lg border border-zinc-200 p-2.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-bold text-zinc-900 tabular-nums">{a.number}</span>
                    <p className="text-sm text-zinc-800 flex-1">{a.approach}</p>
                  </div>
                  {/* ⚠ 25-S §1.2/§1.3 — `kindReason` alone said WHY without saying WHAT HAPPENED.
                      The history line names the move ("Was a candidate guiding policy…") and the
                      undo lets the user overrule it: §1.3 — a judgement the user cannot overturn
                      is an imposition, and 25-P measured that the causal link this sort rests on
                      was set on zero of eighteen rows. */}
                  <CardHistory
                    p={a}
                    pairings={s.pairings}
                    busy={busy}
                    onUndo={() => void patch({ op: 'undoSort', policyId: a.id })}
                  />
                  {/* ⚠⚠ §1.3's SECOND HALF: an action belongs to a POLICY. If that policy is not
                      the one settled, the action follows its fate rather than entering the kernel. */}
                  {parent && (
                    <p className="text-[11px] text-zinc-700 mt-1">
                      Carries out policy {parent.number}.{' '}
                      {parent.status === 'CHOSEN'
                        ? 'That is your guiding policy, so this moves straight into Coherent Actions.'
                        : 'That policy is not settled yet, so this waits with it — if you rule that policy out, this goes with it.'}
                    </p>
                  )}
                  {a.moveStatus === 'ACCEPTED' && (
                    <p className="text-[11px] text-zinc-700 mt-1">
                      {a.movedToActionId
                        ? '✓ Moved into Coherent Actions.'
                        : '✓ Accepted — waiting with the policy it carries out.'}
                    </p>
                  )}
                  {a.moveStatus !== 'ACCEPTED' && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button onClick={() => void patch({ op: 'acceptMove', policyId: a.id })} disabled={busy}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full bg-zinc-900 text-white disabled:opacity-40">
                        Move it to Coherent Actions
                      </button>
                      <button onClick={() => void patch({ op: 'declineMove', policyId: a.id })} disabled={busy}
                        className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 text-zinc-700 disabled:opacity-40">
                        No — keep it as a policy
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* §1.2 — the goal restatements, set aside WITH THE REASON. */}
      {goals.length > 0 && (
        <div id="policy-group-goals" className="px-4 py-3 border-t border-zinc-100 scroll-mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Really the goal restated ({goals.length})
          </h4>
          <p className="text-[11px] text-zinc-600 mt-0.5">
            These rule nothing out, so they are goals rather than policies. Set aside, not deleted.
          </p>
          <ul className="mt-2 space-y-1.5">
            {goals.map((g) => (
              <li key={g.id} className="rounded-lg border border-zinc-200 p-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold text-zinc-900 tabular-nums">{g.number}</span>
                  <p className="text-sm text-zinc-800 flex-1">{g.approach}</p>
                </div>
                {/* ⚠ 25-S §1.3 — SET ASIDE IS A MOVE, SO IT HAS AN UNDO TOO. These were the
                    quietest of the three groups: a bare line of text with no way back. */}
                <CardHistory
                  p={g}
                  pairings={s.pairings}
                  busy={busy}
                  onUndo={() => void patch({ op: 'undoSort', policyId: g.id })}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ══ §1.10 — LATER PHASES ═══════════════════════════════════════════════ */}
      {later.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-100">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Later phases ({later.length})
          </h4>
          <p className="text-[11px] text-zinc-600 mt-0.5">
            Wanted, but not in this proposal. Breaking the challenge into chunks is the discipline,
            not a loss.
          </p>
        </div>
      )}

      {/* ══ §1.10 / BRIEF_26E §2a — REJECTED, HIDDEN BY DEFAULT, RESTORABLE ═══════
          §2a: "leaves the list and appears under a collapsed heading at the foot... hidden by
          default." §2b: the mechanism is the SAME ONE — number kept, reason kept, restore by
          number — not a second one; this is the one 25-P built, just no longer open by default. */}
      {rejected.length > 0 && (
        <div className="border-t border-zinc-100">
          <CollapsedSection title="Candidate policies ruled out" count={rejected.length}>
            <ul className="px-4 py-3 space-y-1.5">
              {rejected.map((r) => (
                <li key={r.id} className="text-xs text-zinc-600 flex items-start gap-2">
                  <span className="font-semibold tabular-nums text-zinc-500">{r.number}</span>
                  <span className="flex-1">
                    {r.approach}
                    {r.ruleOutReason && <span className="block text-[11px] text-zinc-500">Why: {r.ruleOutReason}</span>}
                  </span>
                  {/* ⚠ §1.10 — A RESTORE RETURNS THE ORIGINAL NUMBER, because it never left. */}
                  <button onClick={() => void patch({ op: 'restore', policyId: r.id })} disabled={busy}
                    className="text-[11px] text-blue-700 hover:text-blue-900 disabled:opacity-40 shrink-0">
                    Restore as {r.number}
                  </button>
                </li>
              ))}
            </ul>
          </CollapsedSection>
        </div>
      )}

      {/* ══ §1.9 — TWO ROUNDS, THEN LEX STOPS ASKING ═══════════════════════════ */}
      <div className="px-4 py-3 border-t border-zinc-100 bg-zinc-50/60">
        {s.settled ? (
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs text-zinc-800">
              <span className="font-semibold">Settled:</span> {s.settled}
            </p>
            {/* ══ 26-L addendum 2 §6 — CAN BE UN-CHOSEN AND CHANGED ═══════════════════════
                The button that set this directly was removed from the card (addendum 1 item
                3); this is the way back — un-choosing here does not touch which candidate is
                marked "part of the solution", only which one is Chosen. */}
            <button
              onClick={() => void patch({ op: 'unchoose' })}
              disabled={busy}
              className="text-[11px] font-medium text-zinc-500 underline hover:text-zinc-900 disabled:opacity-40 shrink-0 whitespace-nowrap"
            >
              Un-choose, and change it
            </button>
          </div>
        ) : s.unresolved ? (
          <p className="text-xs text-zinc-800">
            <span className="font-semibold">Recorded as unresolved.</span>{' '}
            {s.unresolvedWhy}
          </p>
        ) : s.offerUnresolved ? (
          <>
            {/* ⚠ NEVER A BLOCK. §1.9: a "computer says no" is worse than an unresolved tension.
                After two rounds Lex offers to proceed and records what it turns on. */}
            <p className="text-xs text-zinc-800">
              You have been round this twice. You do not have to settle it now — the proposal can
              carry the choice as <span className="font-medium">unresolved</span>, with what it
              turns on written down.
            </p>
            <div className="flex gap-2 mt-2">
              <input
                value={reasons.__unresolved ?? ''}
                onChange={(e) => setReasons((r) => ({ ...r, __unresolved: e.target.value }))}
                placeholder="What does the choice turn on?"
                className="flex-1 text-xs rounded border border-zinc-300 px-2 py-1"
              />
              <button
                onClick={() => void patch({ op: 'proceedUnresolved', reason: reasons.__unresolved })}
                disabled={busy}
                className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 border-zinc-800 text-zinc-900 disabled:opacity-40 whitespace-nowrap">
                Carry on with it unresolved
              </button>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-zinc-600">
            Round {s.rounds + 1}. You can stop anywhere — merges, moves, ratings and anything you
            have declined all come back exactly as you left them.
          </p>
        )}
      </div>
    </section>
  )
}
