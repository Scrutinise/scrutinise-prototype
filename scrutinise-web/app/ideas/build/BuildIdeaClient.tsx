'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A — the minimum-elicitation path, end to end.
//
// Four questions → a confirmation → a build with named passes → the existing kernel
// panel. This component holds NO idea of where the user is: the server returns the
// current step and the build's stored status, and this renders whatever it is told,
// exactly as CreateIdeaClient does with canonical state (§3.4).
//
// ⚠ IT ADDS A PATH, IT DOES NOT REMOVE ONE (§0). `/ideas/create` is untouched. When the
// build finishes, this hands off to that page with the same idea id, so the kernel is
// presented "in the panel as it stands today" (§5) rather than in a second viewer built
// for the occasion — and the whole conversation is already above it, because the
// elicitation wrote into the same transcript.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'
import PublicNav from '@/components/PublicNav'
import BuildProgress from '@/components/lex/BuildProgress'
import {
  CONFIRM_YES_LABEL, CONFIRM_NO_LABEL, CORRECTION_PROMPT,
} from '@/lib/lex/elicitation-config'

// The server's shapes, restated for the client. Kept structural rather than imported
// wholesale so this file cannot accidentally pull server-only code into the bundle.
interface StepView {
  key: string; label: string; question: string; hints: string[]
  optional: boolean; done: boolean; answer: string | null
}
interface Msg { role: string; content: string; stage?: string; field?: string }
export interface ElicitationState {
  ideaId: string
  status: 'IN_PROGRESS' | 'AWAITING_CONFIRMATION' | 'CONFIRMED'
  steps: StepView[]
  currentStep: string | null
  understanding: string | null
  problemGate: { fired: boolean; presses: number; spent: boolean }
  reading: { url: string | null; fileName: string | null; note: string | null; status: string }
  goalKinds: ReadonlyArray<{ key: string; label: string }>
  corrections: number
  messages: Msg[]
  hasBuild: boolean
}
export interface PassRecord {
  key: string; label: string; detail: string
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'NOT_REACHED'
  startedAt: string | null; completedAt: string | null
  output: string | null; failureReason: string | null
}
export interface BuildView {
  id: string; version: number
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED'
  framing: string
  passes: PassRecord[]; passesComplete: number; passesTotal: number
  currentPass: string | null
  startedAt: string | null; completedAt: string | null; elapsedSeconds: number | null
  failureReason: string | null; cancelRequested: boolean
  summaryMessage: string | null
  uncertainties: Array<{ fieldKey: string; sentence: string }>
  queryUsed: string | null
  spend: { tokensIn: number; tokensOut: number; pence: number | null; line: string }
  forks: Array<{
    id: string; forkKey: string; fieldKey: string; chosen: string
    alternative: string; caseForAlternative: string; alternativeIndex: number; resolved: boolean
  }>
}
export interface BuildState {
  ideaId: string; canStart: boolean; blockedReason: string | null
  latest: BuildView | null
  history: Array<{ id: string; version: number; status: string; framing: string; completedAt: string | null }>
  ceiling: { budgetMs: number; binding: string; costPence: number }
}

function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

export default function BuildIdeaClient({ initialIdeaId }: { initialIdeaId?: string }) {
  const [ideaId, setIdeaId] = useState<string | null>(initialIdeaId ?? null)
  const [elicit, setElicit] = useState<ElicitationState | null>(null)
  const [build, setBuild] = useState<BuildState | null>(null)
  const [booting, setBooting] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bootedRef = useRef(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Local form state for the current step.
  const [text, setText] = useState('')
  const [goalKind, setGoalKind] = useState('')
  const [ruledOut, setRuledOut] = useState('')
  const [readingUrl, setReadingUrl] = useState('')
  const [correction, setCorrection] = useState('')
  const [correcting, setCorrecting] = useState(false)

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true
    ;(async () => {
      try {
        let id = ideaId
        if (!id) {
          const res = await fetch('/api/ideas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: 'Untitled idea' }),
          })
          if (!res.ok) throw new Error('create idea failed')
          id = (await res.json()).id as string
          setIdeaId(id)
        }
        const [e, b] = await Promise.all([
          fetch(`/api/ideas/${id}/elicitation`).then((r) => r.json()),
          fetch(`/api/ideas/${id}/build`).then((r) => r.json()),
        ])
        setElicit(e)
        setBuild(b)
      } catch {
        setError('Could not start a session. Please refresh.')
      } finally {
        setBooting(false)
      }
    })()
  }, [ideaId])

  const refresh = useCallback(async () => {
    if (!ideaId) return
    const [e, b] = await Promise.all([
      fetch(`/api/ideas/${ideaId}/elicitation`).then((r) => r.json()).catch(() => null),
      fetch(`/api/ideas/${ideaId}/build`).then((r) => r.json()).catch(() => null),
    ])
    if (e) setElicit(e)
    if (b) setBuild(b)
  }, [ideaId])

  // Poll ONLY while a build is actually running. The status shown is the status the
  // server stored — nothing here infers "probably finished by now".
  useEffect(() => {
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }
    const s = build?.latest?.status
    if (s !== 'RUNNING' && s !== 'QUEUED') return
    pollRef.current = setTimeout(() => { void refresh() }, 3000)
    return () => { if (pollRef.current) clearTimeout(pollRef.current) }
  }, [build, refresh])

  // ── Actions ────────────────────────────────────────────────────────────────
  const post = useCallback(async (path: string, body: unknown): Promise<Record<string, unknown> | null> => {
    if (!ideaId) return null
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data?.error === 'string' ? data.error : 'That didn’t work — try again.')
        return null
      }
      return data
    } catch {
      setError('That didn’t work — try again.')
      return null
    } finally {
      setBusy(false)
    }
  }, [ideaId])

  const answer = useCallback(async (extra: Record<string, unknown> = {}) => {
    const step = elicit?.currentStep
    if (!step) return
    const data = await post('/elicitation', {
      action: 'answer', step, text, goalKind: goalKind || undefined,
      ruledOut: ruledOut || undefined, readingUrl: readingUrl || undefined, ...extra,
    })
    if (data?.state) {
      setElicit(data.state as ElicitationState)
      setText(''); setGoalKind(''); setRuledOut(''); setReadingUrl('')
    }
  }, [elicit?.currentStep, post, text, goalKind, ruledOut, readingUrl])

  const confirm = useCallback(async () => {
    const data = await post('/elicitation', { action: 'confirm' })
    if (data?.state) setElicit(data.state as ElicitationState)
  }, [post])

  const sendCorrection = useCallback(async () => {
    const data = await post('/elicitation', { action: 'correct', text: correction })
    if (data?.state) { setElicit(data.state as ElicitationState); setCorrecting(false); setCorrection('') }
  }, [post, correction])

  /**
   * Start the build. The POST is deliberately NOT awaited for the UI: it runs the whole
   * build server-side and can take minutes, and the progress display is driven by
   * polling the stored row. Awaiting it here would mean a blank screen until it finished,
   * which is the "user who cannot see what a five-minute job is doing assumes it has
   * hung" failure §2 names.
   */
  const startBuild = useCallback(() => {
    if (!ideaId) return
    setError(null)
    // Optimistic RUNNING so the panel does not sit inert. The authoritative status still
    // comes from the server on the next poll.
    setBuild((b) => b && ({ ...b, canStart: false }))
    void fetch(`/api/ideas/${ideaId}/build`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setError(typeof data?.error === 'string' ? data.error : 'The build could not be started.')
        }
      })
      .catch(() => setError('The build could not be started.'))
      .finally(() => { void refresh() })
    // Begin polling immediately rather than waiting for the POST to answer.
    setTimeout(() => { void refresh() }, 1200)
  }, [ideaId, refresh])

  const cancelBuild = useCallback(async () => {
    await post('/build/cancel', {})
    await refresh()
  }, [post, refresh])

  // ── Render ─────────────────────────────────────────────────────────────────
  const step = elicit?.steps.find((s) => s.key === elicit.currentStep) ?? null
  const latest = build?.latest ?? null
  const running = latest?.status === 'RUNNING' || latest?.status === 'QUEUED'
  const finished = latest?.status === 'DONE'
  const stopped = latest?.status === 'FAILED' || latest?.status === 'CANCELLED'

  return (
    <div className="flex flex-col min-h-screen bg-white">
      <PublicNav />

      {error && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-4 py-2 text-center">
          {error}
        </div>
      )}

      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-6">
        {booting || !elicit ? (
          <div className="py-24 text-center text-sm text-zinc-400">{error ?? 'Starting your session…'}</div>
        ) : (
          <>
            {/* The step rail — four questions, then a confirmation. Shows how short this is. */}
            <ol className="flex flex-wrap gap-2 mb-6 text-[11px] font-medium">
              {elicit.steps.map((s) => (
                <li
                  key={s.key}
                  className={`px-2.5 py-1 rounded-full border ${
                    s.done
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : s.key === elicit.currentStep
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-zinc-200 text-zinc-400'
                  }`}
                >
                  {s.label}
                </li>
              ))}
            </ol>

            {/* The transcript. Lex's questions and the user's answers, in the same store
                the create page reads — so none of this is lost at the handover. */}
            <div className="space-y-3 mb-6">
              {elicit.messages
                .filter((m) => m.stage === 'ELICITATION' || m.stage === 'BUILD')
                .map((m, i) => (
                  <div
                    key={i}
                    className={`text-sm leading-relaxed whitespace-pre-wrap rounded-2xl px-4 py-3 ${
                      m.role === 'lex'
                        ? 'bg-zinc-50 border border-zinc-200 text-zinc-800'
                        : 'bg-blue-600 text-white ml-8'
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
            </div>

            {/* ── The current question ──────────────────────────────────────── */}
            {elicit.status !== 'CONFIRMED' && elicit.currentStep !== 'confirm' && step && (
              <div className="border border-zinc-200 rounded-2xl p-4">
                <p className="text-sm font-semibold text-zinc-900">{step.label}</p>
                <p className="text-sm text-zinc-600 mt-1">{step.question}</p>
                {step.hints.length > 0 && (
                  <ul className="mt-2 text-xs text-zinc-400 list-disc list-inside space-y-0.5">
                    {step.hints.map((h) => <li key={h}>{h}</li>)}
                  </ul>
                )}

                {step.key === 'goal' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {elicit.goalKinds.map((g) => (
                      <button
                        key={g.key}
                        onClick={() => setGoalKind(g.key)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
                          goalKind === g.key
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                )}

                {step.key === 'reading' && (
                  <input
                    value={readingUrl}
                    onChange={(e) => setReadingUrl(e.target.value)}
                    placeholder="https://…"
                    className="mt-3 w-full text-sm border border-zinc-300 rounded-lg px-3 py-2"
                  />
                )}

                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={step.key === 'problem' ? 8 : 4}
                  placeholder={
                    step.key === 'goal' ? 'Anything more about what you want? (optional)'
                      : step.key === 'reading' ? 'Or tell me what it is (optional)'
                        : 'In your own words…'
                  }
                  className="mt-3 w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 leading-relaxed"
                />

                {step.key === 'goal' && (
                  <textarea
                    value={ruledOut}
                    onChange={(e) => setRuledOut(e.target.value)}
                    rows={2}
                    placeholder="Anything you’ve already ruled out, and why (optional)"
                    className="mt-2 w-full text-sm border border-zinc-300 rounded-lg px-3 py-2"
                  />
                )}

                {/* Exchange 4 says plainly that Lex cannot read it yet. Never-claim, at the
                    point of asking rather than in a footnote afterwards. */}
                {step.key === 'reading' && (
                  <p className="mt-2 text-xs text-zinc-500">
                    I’ll keep it with the idea, but I can’t read documents yet — nothing I draft will
                    come from it. That’s a later sprint, and I’d rather say so than pretend.
                  </p>
                )}

                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => void answer()}
                    disabled={busy || (step.key === 'problem' && !text.trim()) || (step.key === 'goal' && !goalKind)}
                    className="text-sm font-semibold px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 inline-flex items-center gap-2"
                  >
                    {busy && <Spinner className="w-3.5 h-3.5" />}
                    Send
                  </button>
                  {step.optional && (
                    <button
                      onClick={() => void answer({ skip: true })}
                      disabled={busy}
                      className="text-sm font-medium px-3 py-2 rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
                    >
                      Nothing to add
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── §1c The confirmation ──────────────────────────────────────── */}
            {elicit.status === 'AWAITING_CONFIRMATION' && !correcting && (
              <div className="border-2 border-blue-200 bg-blue-50/40 rounded-2xl p-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void confirm()}
                    disabled={busy}
                    className="text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-2"
                  >
                    {busy && <Spinner className="w-3.5 h-3.5" />}
                    {CONFIRM_YES_LABEL}
                  </button>
                  <button
                    onClick={() => setCorrecting(true)}
                    disabled={busy}
                    className="text-sm font-medium px-4 py-2 rounded-full border border-zinc-300 text-zinc-700 hover:bg-white disabled:opacity-40"
                  >
                    {CONFIRM_NO_LABEL}
                  </button>
                </div>
              </div>
            )}

            {correcting && (
              <div className="border border-zinc-200 rounded-2xl p-4">
                <p className="text-sm text-zinc-600">{CORRECTION_PROMPT}</p>
                <textarea
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  rows={4}
                  className="mt-2 w-full text-sm border border-zinc-300 rounded-lg px-3 py-2"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => void sendCorrection()}
                    disabled={busy || !correction.trim()}
                    className="text-sm font-semibold px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 inline-flex items-center gap-2"
                  >
                    {busy && <Spinner className="w-3.5 h-3.5" />}
                    Say it back to me
                  </button>
                  <button
                    onClick={() => setCorrecting(false)}
                    className="text-sm font-medium px-3 py-2 rounded-full text-zinc-500 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* ── §2 The build ─────────────────────────────────────────────── */}
            {elicit.status === 'CONFIRMED' && !latest && (
              <div className="border border-zinc-200 rounded-2xl p-4">
                <p className="text-sm text-zinc-700">
                  That’s everything I need. I’ll go and draft the whole thing — the diagnosis, the
                  approach and the actions — and show you what I’ve got. It usually takes a few
                  minutes, and you can stop it at any point.
                </p>
                <button
                  onClick={startBuild}
                  disabled={busy || !build?.canStart}
                  className="mt-3 text-sm font-semibold px-5 py-2.5 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
                >
                  Build it
                </button>
                {build?.blockedReason && !build.canStart && (
                  <p className="mt-2 text-xs text-amber-700">{build.blockedReason}</p>
                )}
              </div>
            )}

            {latest && (
              <BuildProgress
                build={latest}
                ceiling={build!.ceiling}
                onCancel={running ? cancelBuild : undefined}
                busy={busy}
              />
            )}

            {(finished || stopped) && ideaId && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <a
                  href={`/ideas/create?ideaId=${ideaId}`}
                  className="text-sm font-semibold px-5 py-2.5 rounded-full bg-blue-600 text-white hover:bg-blue-700"
                >
                  {finished ? 'Open the draft' : 'Open what was drafted'}
                </a>
                {/* A re-run is the normal case after a correction, not an error path. */}
                {build?.canStart && (
                  <button
                    onClick={startBuild}
                    disabled={busy}
                    className="text-sm font-medium px-4 py-2.5 rounded-full border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
                  >
                    Run it again
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
