'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A §2 — THE PROGRESS DISPLAY. "Named passes, not a spinner."
//
// A user who cannot see what a five-minute job is doing assumes it has hung. So this
// shows the four named passes, which one is running, how long it has been going, what
// each finished pass actually produced, and what the run has cost.
//
// THREE THINGS IT WILL NOT DO:
//   · It will not show a status the server did not store. There is no "probably nearly
//     done", no client-side progress estimate, and no percentage — the row says QUEUED,
//     RUNNING, DONE, FAILED or CANCELLED, and so does this.
//   · It will not hide a failure behind a completed-looking bar. A FAILED build says
//     which pass failed and why, and lists the passes that DID complete, because a
//     partial build's output is real and is already in the panel.
//   · It will not print a cost it does not have. When the spend is unpriced it says so
//     in words rather than showing 0p (see lib/lex/build-cost.ts).
// ─────────────────────────────────────────────────────────────────────────────

import type { BuildView } from '@/app/ideas/build/BuildIdeaClient'

const STATUS_LABEL: Record<BuildView['status'], string> = {
  QUEUED: 'Starting',
  RUNNING: 'Building',
  DONE: 'Done',
  FAILED: 'Stopped',
  CANCELLED: 'Cancelled by you',
}

const STATUS_CLASS: Record<BuildView['status'], string> = {
  QUEUED: 'bg-zinc-100 text-zinc-600 border-zinc-200',
  RUNNING: 'bg-blue-50 text-blue-700 border-blue-200',
  DONE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  // ⚠ Amber, not red. A build that stopped at its ceiling did not malfunction — it did
  // the thing the ceiling exists for, and what it drafted before stopping is real.
  FAILED: 'bg-amber-50 text-amber-800 border-amber-200',
  CANCELLED: 'bg-zinc-100 text-zinc-600 border-zinc-200',
}

function Dot({ status }: { status: string }) {
  if (status === 'RUNNING') {
    return (
      <svg className="w-4 h-4 animate-spin text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    )
  }
  const cls =
    status === 'DONE' ? 'bg-emerald-500'
      : status === 'FAILED' ? 'bg-amber-500'
        : 'bg-zinc-300'
  return <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${cls}`} aria-hidden />
}

/**
 * 25-B §8 — the per-pass spend line, or null when a pass has not spent anything.
 *
 * ⚠ An UNPRICED pass says so rather than showing nothing: a pass that ran on a model with
 * no rate on file has a real cost we cannot state, and a blank line reads as free.
 */
function spendFor(build: BuildView, key: string): string | null {
  const row = build.spendByPass?.find((s) => s.key === key)
  if (!row || (!row.tokensIn && !row.tokensOut)) return null
  const tokens = `${row.tokensIn.toLocaleString()} in / ${row.tokensOut.toLocaleString()} out`
  if (row.pence == null) return `${tokens} — cost not estimated`
  return `${tokens} — ${row.pence < 1 ? 'under 1p' : `${row.pence.toFixed(1)}p`}`
}

/** Mirrors humaniseSeconds in lib/lex/build-estimate.ts — "about 7 minutes", never 6.8. */
function humanise(seconds: number): string {
  if (seconds < 90) return 'about a minute'
  const mins = seconds / 60
  if (mins < 10) return `about ${Math.round(mins)} minutes`
  return `about ${Math.round(mins / 5) * 5} minutes`
}

function elapsed(seconds: number | null): string {
  if (seconds == null) return ''
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m ? `${m}m ${s}s` : `${s}s`
}

export default function BuildProgress({
  build,
  ceiling,
  estimate,
  onCancel,
  busy,
}: {
  build: BuildView
  ceiling: { budgetMs: number; binding: string; costPence: number }
  /** AMENDMENT_25B §C4 — the measured mean, or an admission that there isn't one yet. */
  estimate?: { meanSeconds: number | null; sampleSize: number; line: string }
  /** Present only while the build is actually running (§2 — "Cancel is available"). */
  onCancel?: () => void | Promise<void>
  busy: boolean
}) {
  const running = build.status === 'RUNNING' || build.status === 'QUEUED'

  // §C4 — "If a build overruns the estimate materially, say so rather than letting the
  // progress bar sit there." Only ever said when there IS a measured mean: "taking longer
  // than usual" is a claim about a usual we would not have.
  const overrun =
    running && estimate?.meanSeconds != null && build.elapsedSeconds != null &&
    build.elapsedSeconds >= estimate.meanSeconds * 1.5

  // §C4 — the actual duration beside the estimate once it is over, INCLUDING when the
  // estimate was wrong. A figure only ever shown before the event cannot be calibrated by
  // the person reading it, and one that disappears when it misses is worse than none.
  const finishedLine =
    !running && build.elapsedSeconds != null
      ? estimate?.meanSeconds != null
        ? `Took ${elapsed(build.elapsedSeconds)} — usually ${humanise(estimate.meanSeconds)}.`
        : `Took ${elapsed(build.elapsedSeconds)}.`
      : null

  return (
    <div className="border border-zinc-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-100">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded border ${STATUS_CLASS[build.status]}`}>
            {STATUS_LABEL[build.status]}
          </span>
          <span className="text-xs text-zinc-500">
            {build.passesComplete} of {build.passesTotal} passes
            {build.elapsedSeconds != null && ` · ${elapsed(build.elapsedSeconds)}`}
            {/* §C4 — the estimate again as time elapses, so the number the user was
                given before they committed is still on screen while they wait. */}
            {running && estimate?.meanSeconds != null && !overrun &&
              ` of ${humanise(estimate.meanSeconds)}`}
          </span>
          {overrun && (
            <span className="text-xs font-medium text-amber-700">
              Taking longer than usual — still running.
            </span>
          )}
        </div>
        {running && onCancel && (
          <button
            onClick={() => void onCancel()}
            disabled={busy || build.cancelRequested}
            className="text-xs font-medium px-3 py-1.5 rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
          >
            {build.cancelRequested ? 'Stopping…' : 'Stop'}
          </button>
        )}
      </div>

      {/* Cancel is co-operative — say so, rather than letting a press that appears to do
          nothing for thirty seconds read as a broken button. */}
      {build.cancelRequested && running && (
        <p className="px-4 py-2 text-xs text-zinc-500 border-b border-zinc-100">
          I’ll stop at the end of the pass that’s running. Everything drafted so far stays.
        </p>
      )}

      <ul className="divide-y divide-zinc-100">
        {build.passes.map((p) => (
          <li key={p.key} className="flex gap-3 px-4 py-3">
            <Dot status={p.status} />
            <div className="min-w-0">
              <p className={`text-sm font-medium ${p.status === 'PENDING' || p.status === 'NOT_REACHED' ? 'text-zinc-400' : 'text-zinc-900'}`}>
                {p.label}
                {p.status === 'NOT_REACHED' && <span className="ml-2 text-xs font-normal text-zinc-400">— not reached</span>}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">{p.detail}</p>
              {/* 25-B §8 — "Progress must show what is happening, not a spinner: the
                  current pass, THE QUESTION BEING ASKED, and findings appearing as they
                  land." The research pass writes this line before each library question,
                  so a five-minute pass is legible while it runs rather than after it. */}
              {p.status === 'RUNNING' && p.activity && (
                <p className="text-xs text-blue-700 mt-1">{p.activity}…</p>
              )}
              {p.output && <p className="text-xs text-emerald-700 mt-1">{p.output}</p>}
              {p.failureReason && <p className="text-xs text-amber-700 mt-1">{p.failureReason}</p>}
              {/* §8 — the spend for THIS pass. A build total cannot answer "which pass
                  cost that", which is the question the numbers exist to answer. */}
              {spendFor(build, p.key) && (
                <p className="text-[11px] text-zinc-400 mt-1">{spendFor(build, p.key)}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {build.failureReason && (
        <p className="px-4 py-3 text-sm text-amber-800 bg-amber-50 border-t border-amber-200">
          {build.failureReason}
        </p>
      )}

      {build.summaryMessage && (
        <p className="px-4 py-3 text-sm text-zinc-800 whitespace-pre-wrap border-t border-zinc-100">
          {build.summaryMessage}
        </p>
      )}

      {/* §4.2 — what Lex is unsure about, per field. "This is what the user reads first." */}
      {build.uncertainties.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">What I’m least sure about</p>
          <ul className="mt-2 space-y-1.5">
            {build.uncertainties.map((u) => (
              <li key={u.fieldKey} className="text-sm text-zinc-700">
                <span className="text-xs font-medium text-zinc-500">{u.fieldKey}</span> — {u.sentence}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* §4.1 — the forks, captured. 25-C turns them into decisions; here they are shown
          so the user can see that a choice WAS made and what was set aside. */}
      {build.forks.length > 0 && (
        <div className="px-4 py-3 border-t border-zinc-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Where I had to choose ({new Set(build.forks.map((f) => f.forkKey)).size} decisions)
          </p>
          <ul className="mt-2 space-y-3">
            {[...new Set(build.forks.map((f) => f.forkKey))].map((key) => {
              const group = build.forks.filter((f) => f.forkKey === key)
              return (
                <li key={key} className="text-sm">
                  <p className="text-zinc-900"><span className="text-zinc-500">I chose:</span> {group[0].chosen}</p>
                  <ul className="mt-1 ml-3 space-y-1">
                    {group.map((f) => (
                      <li key={f.id} className="text-zinc-600 text-[13px]">
                        <span className="text-zinc-400">Instead of:</span> {f.alternative}
                        <span className="block text-zinc-500 italic">{f.caseForAlternative}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <div className="px-4 py-2 border-t border-zinc-100 text-[11px] text-zinc-400 space-y-0.5">
        {/* §C4 — the estimate, checked against what it actually took. */}
        {finishedLine && <p className="text-zinc-500">{finishedLine}</p>}
        <p>{build.spend.line}</p>
        <p>
          Framing {build.framing === 'A_NAIVE' ? 'A (naive)' : 'B (contextualised)'}
          {' · '}ceiling {Math.round(ceiling.budgetMs / 1000)}s ({ceiling.binding}) / {ceiling.costPence}p
        </p>
        {build.queryUsed && <p className="truncate" title={build.queryUsed}>Query: {build.queryUsed}</p>}
      </div>
    </div>
  )
}
