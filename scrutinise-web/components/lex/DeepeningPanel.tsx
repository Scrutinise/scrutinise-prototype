'use client'

// ─────────────────────────────────────────────────────────────────────────────
// THE DEEPENING — the stage section in the middle panel, after Coherent Actions.
//
// Lex does the heavy lifting; the user does the judging. Everything here is a judging
// surface: accept or reject a finding, address / defer / dismiss an issue. Nothing on
// this panel edits a canonical field — accepting a finding attaches EVIDENCE to a field,
// and the field's own value still changes only through the normal save path.
//
// THREE THINGS THIS COMPONENT WILL NOT DO, each because the design says so and each easy
// to add back by accident:
//   • No score, no rating, no thermometer, no aggregate of any kind (§24 supersedes
//     §22.3). Counts are facts a reader can weigh; a total is a judgment laundered as a
//     number. `check:deepening` greps this file for the vocabulary.
//   • No hiding of a CONTRADICTS finding, and no hiding of a dismissed issue. What was
//     considered and set aside is a strength.
//   • No "known unknowns" section that disappears when it is empty. "Nothing was
//     unfindable" is itself information, and an absent block reads as "not checked".
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SearchResult } from '@/lib/lex/page1-config'
import { repairRefUrl } from '@/lib/lex/legislation-url'
// 25-C §2.3 — the label and the provenance note are derived in ONE place, shared with any
// other renderer, so two surfaces cannot disagree about what a row is.
import { evidenceLabel, provenanceNote, isAssembled } from '@/lib/lex/evidence-labels'

interface KnownUnknown { question: string; why: string }
interface EvidenceView {
  id: string; kind: string; title: string; body: string; fieldRef: string | null
  sourceType: string | null; citation: string | null; url: string | null
  status: string; note: string | null; runVersion: number
  /** §19-E Task 3 — the sift's one-line reason this source bears on the proposal.
   *  Null on findings written before the sift existed; absence renders as absence. */
  siftReason: string | null
  precedentTestPassed: boolean | null
}
interface IssueView {
  id: string; text: string; status: string; dismissReason: string | null
  resolutionNote: string | null; resolutionEvidenceId: string | null; runVersion: number
}
export interface PassState {
  passKey: string; label: string; strapline: string; training: string
  status: 'NOT_RUN' | 'RUNNING' | 'RUN' | 'FAILED'
  runVersion: number; startedAt: string | null; completedAt: string | null
  failureReason: string | null
  knownUnknowns: KnownUnknown[]
  findings: EvidenceView[]
  issues: IssueView[]
  references: SearchResult[]
  /** §19-E Task 3 — "reviewed 104 sources; 12 bore on this proposal." Null before a run. */
  sift: { reviewed: number; kept: number; skipped: boolean; line: string } | null
}
export interface EvidenceFacts {
  issuesRaised: number; issuesResolved: number; issuesOpen: number
  knownUnknownsDeclared: number; sourcesByType: Record<string, number>
  lastDeepeningRun: string | null; passesRun: number; passesTotal: number
}

/** An assembled record is styled apart from a model's reading — different kind, different weight. */
const ASSEMBLED_CLASS = 'bg-indigo-50 text-indigo-700 border-indigo-200'

const KIND_LABEL: Record<string, string> = {
  FINDING: 'Finding',
  PRECEDENT: 'Precedent',
  SUPPORTS: 'Supports the diagnosis',
  CONTRADICTS: 'Contradicts the diagnosis',
  COMPARISON: 'Comparison',
}
// CONTRADICTS is coloured to STAND OUT rather than to warn. It is not a problem with the
// proposal; it is the most useful thing a pass can hand back, and styling it as an error
// would teach the user to skim past it.
const KIND_CLASS: Record<string, string> = {
  CONTRADICTS: 'bg-violet-50 text-violet-700 border-violet-200',
  SUPPORTS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PRECEDENT: 'bg-sky-50 text-sky-700 border-sky-200',
  COMPARISON: 'bg-sky-50 text-sky-700 border-sky-200',
  FINDING: 'bg-zinc-50 text-zinc-600 border-zinc-200',
}

function Chip({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded border ${className}`}>{children}</span>
}

function Spinner() {
  return (
    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export default function DeepeningPanel({
  ideaId,
  unlocked,
  onOpenPass,
  onDiscussIssue,
}: {
  ideaId: string
  /** The kernel's four stages are complete. Locked before that — deepening a skeleton
   *  that does not exist yet produces findings about nothing. */
  unlocked: boolean
  /** Raise the open pass's retrieval to the right-hand panel. */
  onOpenPass: (pass: { label: string; results: SearchResult[] } | null) => void
  /** Hand an issue into the chat as context for a focused thread. */
  onDiscussIssue: (issueText: string, passLabel: string) => void
}) {
  const [passes, setPasses] = useState<PassState[] | null>(null)
  const [facts, setFacts] = useState<EvidenceFacts | null>(null)
  const [openPass, setOpenPass] = useState<string | null>(null)
  const [showTraining, setShowTraining] = useState<Set<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/deepening`)
      if (!res.ok) return
      const data = await res.json() as { passes: PassState[]; facts: EvidenceFacts }
      setPasses(data.passes)
      setFacts(data.facts)
      return data
    } catch { /* a failed poll is not an error state — the next one will try again */ }
  }, [ideaId])

  useEffect(() => { if (unlocked) void load() }, [unlocked, load])

  // Poll only while something is actually RUNNING. A permanent timer on a finished
  // page is a background load nobody asked for.
  useEffect(() => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }
    if (!passes?.some((p) => p.status === 'RUNNING')) return
    pollRef.current = setTimeout(() => { void load() }, 4000)
    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [passes, load])

  // Keep the right panel in step with whichever pass is open.
  useEffect(() => {
    const p = passes?.find((x) => x.passKey === openPass)
    onOpenPass(p ? { label: p.label, results: p.references } : null)
    // onOpenPass is stable in the parent; listing it re-fires on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPass, passes])

  const run = async (passKey: string) => {
    setBusyId(passKey); setError(null)
    // Optimistically show RUNNING so the card does not sit inert for a minute. The
    // authoritative status still comes from the server on the next poll.
    setPasses((ps) => ps?.map((p) => p.passKey === passKey ? { ...p, status: 'RUNNING' } : p) ?? ps)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/deepening/${passKey}/run`, { method: 'POST' })
      if (res.status === 409) setError('That pass is already running.')
      else if (!res.ok) setError('The run could not be started.')
    } catch {
      setError('The run could not be started.')
    } finally {
      setBusyId(null)
      await load()
    }
  }

  const judge = async (evidenceId: string, status: 'ACCEPTED' | 'REJECTED') => {
    setBusyId(evidenceId)
    try {
      await fetch(`/api/ideas/${ideaId}/deepening/evidence/${evidenceId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await load()
    } finally { setBusyId(null) }
  }

  const triage = async (issueId: string, action: string, extra: Record<string, string> = {}) => {
    setBusyId(issueId); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/deepening/issues/${issueId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      if (!res.ok) setError(action === 'dismiss' ? 'Dismissing an issue needs a reason.' : 'That didn’t save.')
      await load()
    } finally { setBusyId(null) }
  }

  if (!unlocked) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="shrink-0 w-4 h-4 rounded-full bg-zinc-200" />
          <span className="text-sm text-zinc-400 flex-1">Deepening</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-300">later</span>
        </div>
        <p className="text-[11px] text-zinc-400 mt-1.5 ml-6">
          Once the four sections above are done, Lex can go deep on the evidence, the law, the
          costings and the politics — and hand you what it finds to judge.
        </p>
      </div>
    )
  }

  return (
    // ⚠ 25-K §4 — `deepening-passes` and `deepening-issues` are the anchors `WorkList`
    // jumps to. Named here so a worklist row is a route to the work rather than a label
    // for it. `scroll-mt` keeps the heading clear of the sticky nav.
    <div id="deepening-passes" className="scroll-mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-700 flex-1">Deepening</span>
        {facts && (
          <span className="text-[11px] text-zinc-400">{facts.passesRun} of {facts.passesTotal} run</span>
        )}
      </div>
      <p className="text-[11px] text-zinc-500 leading-snug">
        Entirely optional, in any order, to whatever depth you want. Each pass searches the corpus in
        the background and hands you findings to judge and gaps to work through — it never edits your
        proposal.
      </p>

      {facts && <FactsStrip facts={facts} />}

      {error && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">{error}</p>}

      {passes === null
        ? <p className="text-xs text-zinc-400">Loading…</p>
        : passes.map((p) => {
          const open = openPass === p.passKey
          const openIssues = p.issues.filter((i) => i.status === 'OPEN').length
          const live = p.findings.filter((f) => f.status !== 'REJECTED')
          return (
            <div key={p.passKey} className="rounded-lg border border-zinc-200">
              <button
                onClick={() => setOpenPass(open ? null : p.passKey)}
                className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-zinc-50"
              >
                <span className={`shrink-0 w-4 h-4 mt-0.5 rounded-full ${
                  p.status === 'RUN' ? 'bg-emerald-500'
                    : p.status === 'RUNNING' ? 'bg-amber-400'
                      : p.status === 'FAILED' ? 'bg-rose-400' : 'bg-zinc-200'}`} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-zinc-800">{p.label}</span>
                  <span className="block text-[11px] text-zinc-500 leading-snug">{p.strapline}</span>
                </span>
                <span className="shrink-0 text-[11px] text-zinc-400 text-right">
                  <WorkflowChip status={p.status} findings={live.length} openIssues={openIssues} />
                  <span className="block mt-0.5">{open ? '▲' : '▼'}</span>
                </span>
              </button>

              {open && (
                <div className="border-t border-zinc-100 px-3 py-3 space-y-4">
                  {/* Training panel — collapsible, always retrievable. */}
                  <div>
                    <button
                      onClick={() => setShowTraining((s) => {
                        const n = new Set(s); n.has(p.passKey) ? n.delete(p.passKey) : n.add(p.passKey); return n
                      })}
                      className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
                    >
                      {showTraining.has(p.passKey) ? 'Hide' : 'What this pass looks for'}
                    </button>
                    {showTraining.has(p.passKey) && (
                      <p className="mt-1.5 text-xs text-zinc-600 leading-relaxed bg-blue-50/50 border border-blue-100 rounded-lg p-2.5">
                        {p.training}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => run(p.passKey)}
                      disabled={busyId === p.passKey || p.status === 'RUNNING'}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {p.status === 'RUNNING' && <Spinner />}
                      {p.status === 'RUNNING' ? 'Running…' : p.runVersion > 0 ? 'Re-run this pass' : 'Run this pass'}
                    </button>
                    {p.runVersion > 0 && <span className="text-[11px] text-zinc-400">run {p.runVersion}</span>}
                  </div>

                  {/* An honest failure, with what it managed kept. */}
                  {p.status === 'FAILED' && p.failureReason && (
                    <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                      {p.failureReason}
                    </p>
                  )}

                  {/* §19-E Task 3 — WHAT THE SIFT DISCARDED, SAID OUT LOUD.
                      "Reviewed 104 sources; 12 bore on this proposal." A sift whose
                      discard count is hidden is indistinguishable from no sift at all,
                      and the honest number is also the quality signal we watch. */}
                  {p.sift && (
                    <p className={`text-xs rounded-lg p-2 border ${p.sift.skipped
                      ? 'text-amber-800 bg-amber-50 border-amber-200'
                      : 'text-zinc-500 bg-zinc-50 border-zinc-200'}`}>
                      {p.sift.line}
                    </p>
                  )}

                  {/* FINDINGS */}
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">
                      Findings {live.length > 0 && <span className="text-zinc-400 font-normal">· {live.length}</span>}
                    </div>
                    {p.status === 'NOT_RUN'
                      ? <p className="text-xs text-zinc-400">Not run yet.</p>
                      : live.length === 0
                        ? <p className="text-xs text-zinc-500">
                            {/* Three different silences, and the panel must not blur them:
                                nothing was retrieved, nothing that was retrieved bore on
                                the proposal, or the search itself broke. */}
                            {p.sift && p.sift.reviewed > 0 && p.sift.kept === 0
                              ? `This pass reviewed ${p.sift.reviewed} sources and none of them bore on your proposal. That is a statement about what the corpus holds, not about your idea — and it is worth reading as a signal that the search terms may need widening.`
                              : 'This pass produced no findings. That is a statement about what the corpus holds on your idea, not about your idea.'}
                          </p>
                        : <div className="space-y-2">
                            {live.map((f) => (
                              <FindingCard key={f.id} f={f} busy={busyId === f.id} onJudge={judge} />
                            ))}
                          </div>}
                  </div>

                  {/* ISSUES */}
                  <div id={`deepening-issues-${p.passKey}`} className="scroll-mt-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">
                      Issues to work through {p.issues.length > 0 && <span className="text-zinc-400 font-normal">· {openIssues} open of {p.issues.length}</span>}
                    </div>
                    {/* §19-E Task 4 — say WHOSE reading this is. The issues used to come
                        from the same call that wrote the findings, i.e. an author asked
                        what they had missed. Naming the vantage point is what tells the
                        user how to read the list. */}
                    {p.issues.length > 0 && (
                      <p className="text-[11px] text-zinc-400 mb-1.5">
                        Read back as a hostile committee clerk would — where this is weakest, and what it cannot answer.
                      </p>
                    )}
                    {p.issues.length === 0
                      ? <p className="text-xs text-zinc-400">{p.status === 'NOT_RUN' ? 'Not run yet.' : 'No issues raised.'}</p>
                      : <div className="space-y-2">
                          {p.issues.map((i) => (
                            <IssueCard
                              key={i.id} i={i} busy={busyId === i.id}
                              onTriage={triage}
                              onDiscuss={() => onDiscussIssue(i.text, p.label)}
                            />
                          ))}
                        </div>}
                  </div>

                  {/* KNOWN UNKNOWNS — rendered even when empty, always. */}
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1.5">
                      Known unknowns
                    </div>
                    {p.status === 'NOT_RUN'
                      ? <p className="text-xs text-zinc-400">Not run yet.</p>
                      : p.knownUnknowns.length === 0
                        ? <p className="text-xs text-zinc-500">Nothing this pass looked for was unfindable.</p>
                        : <ul className="space-y-1.5">
                            {p.knownUnknowns.map((k, n) => (
                              <li key={n} className="text-xs text-zinc-600 border-l-2 border-zinc-200 pl-2">
                                <span className="text-zinc-800">{k.question}</span>
                                {k.why && <span className="block text-zinc-400">{k.why}</span>}
                              </li>
                            ))}
                          </ul>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
    </div>
  )
}

function WorkflowChip({ status, findings, openIssues }: { status: string; findings: number; openIssues: number }) {
  if (status === 'RUNNING') return <Chip className="bg-amber-50 text-amber-700 border-amber-200">Running</Chip>
  if (status === 'NOT_RUN') return <Chip className="bg-zinc-50 text-zinc-500 border-zinc-200">Not run</Chip>
  if (status === 'FAILED') return <Chip className="bg-rose-50 text-rose-700 border-rose-200">Failed</Chip>
  return (
    <Chip className="bg-emerald-50 text-emerald-700 border-emerald-200">
      Run — {findings} finding{findings === 1 ? '' : 's'}, {openIssues} open
    </Chip>
  )
}

/**
 * §24.2 evidence facts. COUNTS ONLY. There is deliberately no total, no percentage of
 * "completeness", and no visual that implies one — the composition is the signal.
 */
function FactsStrip({ facts }: { facts: EvidenceFacts }) {
  const sources = Object.entries(facts.sourcesByType).sort((a, b) => b[1] - a[1])
  const totalSources = sources.reduce((n, [, c]) => n + c, 0)
  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-3 py-2 text-[11px] text-zinc-600 space-y-1">
      <div>
        <span className="text-zinc-400">Issues:</span> {facts.issuesRaised} raised · {facts.issuesResolved} resolved · {facts.issuesOpen} open
      </div>
      <div>
        <span className="text-zinc-400">Known unknowns declared:</span> {facts.knownUnknownsDeclared}
      </div>
      <div>
        <span className="text-zinc-400">Sources:</span>{' '}
        {totalSources === 0 ? 'none yet' : sources.map(([t, c]) => `${t.toLowerCase().replace(/_/g, ' ')} ${c}`).join(' · ')}
      </div>
      <div>
        <span className="text-zinc-400">Last deepening run:</span>{' '}
        {facts.lastDeepeningRun ? new Date(facts.lastDeepeningRun).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'never'}
      </div>
    </div>
  )
}

function FindingCard({ f, busy, onJudge }: {
  f: EvidenceView; busy: boolean; onJudge: (id: string, status: 'ACCEPTED' | 'REJECTED') => void
}) {
  const accepted = f.status === 'ACCEPTED'
  return (
    <div className={`rounded-lg border p-2.5 ${accepted ? 'border-emerald-200 bg-emerald-50/40' : 'border-zinc-200'}`}>
      <div className="flex items-start gap-2">
        {/* 25-C §2.3 — the badge is DERIVED FROM PROVENANCE, not from the kind alone. An
            assembled precedent record and a model's reading of one document are different
            things and no longer share a word. See lib/lex/evidence-labels.ts. */}
        <Chip className={isAssembled(f.sourceType) ? ASSEMBLED_CLASS : (KIND_CLASS[f.kind] ?? KIND_CLASS.FINDING)}>
          {evidenceLabel(f.kind, f.sourceType)}
        </Chip>
        {accepted && <Chip className="bg-emerald-50 text-emerald-700 border-emerald-200">Accepted</Chip>}
      </div>
      <p className="text-sm font-medium text-zinc-800 mt-1.5">{f.title}</p>
      <p className="text-xs text-zinc-600 leading-relaxed mt-1 whitespace-pre-wrap">{f.body}</p>
      {/* How it was produced, where that is worth saying. */}
      {provenanceNote(f.kind, f.sourceType) && (
        <p className="text-[11px] text-zinc-500 italic mt-1">{provenanceNote(f.kind, f.sourceType)}</p>
      )}
      {/* §19-E Task 3 — WHY THIS SOURCE SURVIVED THE SIFT. A keep with no reason is a
          rank in disguise, so the reason is shown rather than kept in a log. Absent on
          findings written before the sift existed, and absence renders as absence. */}
      {f.siftReason && (
        <p className="text-[11px] text-zinc-500 mt-1.5 border-l-2 border-zinc-200 pl-2">
          <span className="text-zinc-400">why this one: </span>{f.siftReason}
        </p>
      )}
      {/* Provenance is not optional decoration — a finding without its source is a claim. */}
      <p className="text-[11px] text-zinc-400 mt-1.5">
        {f.citation || 'source not recorded'}
        {/* §19-E Task 8 — repaired on the way out, exactly as BackgroundPanel does it.
            An EvidenceItem persisted before this sprint carries the bare committee URL
            that 404s, and a finding whose "open" link is dead is worse than one with no
            link: the user clicks it precisely to check whether we are telling the truth. */}
        {f.url && <> · <a href={repairRefUrl(f.sourceType, null, f.url)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">open</a></>}
        {f.fieldRef && <> · bears on <span className="text-zinc-500">{f.fieldRef}</span></>}
      </p>
      {f.status === 'PROPOSED' && (
        <div className="flex gap-2 mt-2">
          <button onClick={() => onJudge(f.id, 'ACCEPTED')} disabled={busy}
            className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-50">Accept</button>
          <button onClick={() => onJudge(f.id, 'REJECTED')} disabled={busy}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">Reject</button>
        </div>
      )}
    </div>
  )
}

function IssueCard({ i, busy, onTriage, onDiscuss }: {
  i: IssueView; busy: boolean
  onTriage: (id: string, action: string, extra?: Record<string, string>) => void
  onDiscuss: () => void
}) {
  const [mode, setMode] = useState<null | 'address' | 'dismiss'>(null)
  const [text, setText] = useState('')

  const open = i.status === 'OPEN'
  const tone =
    i.status === 'ADDRESSED' ? 'border-emerald-200 bg-emerald-50/40'
      : i.status === 'DISMISSED' ? 'border-zinc-200 bg-zinc-50/60'
        : i.status === 'DEFERRED' ? 'border-amber-200 bg-amber-50/40'
          : 'border-zinc-200'

  return (
    <div className={`rounded-lg border p-2.5 ${tone}`}>
      <p className="text-sm text-zinc-800 leading-relaxed">{i.text}</p>

      {/* A dismissed issue STAYS VISIBLE, with its reason. That is the point of it. */}
      {i.status === 'DISMISSED' && (
        <p className="text-[11px] text-zinc-500 mt-1.5">Dismissed — {i.dismissReason}</p>
      )}
      {i.status === 'ADDRESSED' && (
        <p className="text-[11px] text-emerald-700 mt-1.5">Addressed{i.resolutionNote ? ` — ${i.resolutionNote}` : ''}</p>
      )}
      {i.status === 'DEFERRED' && <p className="text-[11px] text-amber-700 mt-1.5">Deferred for now.</p>}

      {mode === 'address' && (
        <div className="mt-2 space-y-1.5">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
            placeholder="How did you deal with it?"
            className="w-full text-sm p-2 rounded-lg border border-zinc-200 bg-white resize-y focus:outline-none focus:border-blue-400" />
          <div className="flex gap-2">
            <button disabled={busy || !text.trim()} onClick={() => { onTriage(i.id, 'address', { note: text.trim() }); setMode(null); setText('') }}
              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-50">Save</button>
            <button onClick={() => { setMode(null); setText('') }}
              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50">Cancel</button>
          </div>
        </div>
      )}

      {mode === 'dismiss' && (
        <div className="mt-2 space-y-1.5">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
            placeholder="Why is this not an issue? (required — it stays on the record)"
            className="w-full text-sm p-2 rounded-lg border border-zinc-200 bg-white resize-y focus:outline-none focus:border-blue-400" />
          <div className="flex gap-2">
            {/* Disabled without a reason, AND refused by the API — the form is a courtesy,
                the API is the rule. */}
            <button disabled={busy || !text.trim()} onClick={() => { onTriage(i.id, 'dismiss', { reason: text.trim() }); setMode(null); setText('') }}
              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-900 text-white hover:opacity-90 disabled:opacity-50">Dismiss</button>
            <button onClick={() => { setMode(null); setText('') }}
              className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50">Cancel</button>
          </div>
        </div>
      )}

      {mode === null && (
        <div className="flex flex-wrap gap-2 mt-2">
          {open && (
            <>
              <button onClick={onDiscuss} disabled={busy}
                className="text-xs font-medium px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">Work on this with Lex</button>
              <button onClick={() => setMode('address')} disabled={busy}
                className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">Mark addressed</button>
              <button onClick={() => onTriage(i.id, 'defer')} disabled={busy}
                className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-50">Defer</button>
              <button onClick={() => setMode('dismiss')} disabled={busy}
                className="text-xs font-medium px-2.5 py-1 rounded-lg text-zinc-500 hover:bg-zinc-50 disabled:opacity-50">Dismiss…</button>
            </>
          )}
          {!open && (
            <button onClick={() => onTriage(i.id, 'reopen')} disabled={busy}
              className="text-[11px] text-zinc-400 hover:text-zinc-700 disabled:opacity-40">Reopen</button>
          )}
        </div>
      )}
    </div>
  )
}
