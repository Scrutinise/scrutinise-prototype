'use client'

// ─────────────────────────────────────────────────────────────────────────────
// §24.1 PROGRESS LABEL + §24.2 EVIDENCE FACTS, on the idea header.
//
// Both were specified by BRIEF_DEEPENING_RESTART.md §2.5 and both were missed in the
// first build: the facts were rendered inside the Deepening section of the CREATE flow,
// where only someone already deepening the idea would see them, and the progress label
// was not built at all. They belong here, on the idea itself.
//
// ⚠ §24 SUPERSEDES §22.3, AND THAT IS THE WHOLE POINT OF THIS COMPONENT'S SHAPE.
// There is no thermometer, no star rating, and no aggregate. Three different questions
// were being answered by one scale and they are separated here:
//   • "How far along is this?"      → a plain STAGE LABEL (progress)
//   • "How much is verifiable?"     → COUNTS, machine-derived (facts)
//   • "Should a stranger trust it?" → attributed human review — NOT here, and not a
//                                     number. §24.3, sequenced after §20-D.
// Numbers for what can be counted; named humans for what must be judged; never a number
// that launders a judgment. `check:deepening` greps for the vocabulary of a score.
//
// ⚠ OWNER-VISIBLE ONLY FOR NOW. §24.7's public credibility panel needs versioning
// (§20-D) and the review instrument before it can be shown to a stranger, and half of
// that panel — the reviews and endorsements — does not exist yet. Showing the counts
// publicly on their own would read as the finished signal when it is one column of it.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

interface Facts {
  issuesRaised: number
  issuesResolved: number
  issuesOpen: number
  knownUnknownsDeclared: number
  sourcesByType: Record<string, number>
  lastDeepeningRun: string | null
  passesRun: number
  passesTotal: number
}
interface PassLite { status: string; issues: Array<{ status: string }> }

/**
 * §24.1 — the progress label. A plain word for how far the work has gone, on the track
 * the work actually follows.
 *
 * ⚠ ONLY THE FIRST TWO RUNGS ARE REACHABLE TODAY, and the component says so rather than
 * implying a ladder it cannot climb. "Team-reviewed" needs §22.4's team roles and
 * "Published" needs §20.3 — neither is built. A label that can never advance past
 * Deepened would be a promise the product does not keep, so the remaining rungs are
 * simply not shown.
 *
 * DEEPENED requires BOTH halves, per §24.1: at least one pass RUN **and its issues
 * triaged**. A pass that ran and left ten open issues has not deepened anything — it has
 * produced a to-do list. That distinction is the difference between work done and work
 * started, and it is exactly what the old thermometer blurred.
 */
export function deepeningProgressLabel(passes: PassLite[]): 'Skeleton' | 'Deepened' {
  const run = passes.filter((p) => p.status === 'RUN')
  if (run.length === 0) return 'Skeleton'
  const anyTriaged = run.some((p) => p.issues.length > 0 && p.issues.every((i) => i.status !== 'OPEN'))
  // A run that raised no issues at all counts as triaged — there was nothing to triage.
  const anyClean = run.some((p) => p.issues.length === 0)
  return anyTriaged || anyClean ? 'Deepened' : 'Skeleton'
}

export default function EvidenceFactsStrip({ ideaId, isOwner }: { ideaId: string; isOwner: boolean }) {
  const [facts, setFacts] = useState<Facts | null>(null)
  const [label, setLabel] = useState<'Skeleton' | 'Deepened'>('Skeleton')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!isOwner) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/ideas/${ideaId}/deepening`)
        if (!res.ok) return
        const data = await res.json() as { passes: PassLite[]; facts: Facts }
        if (cancelled) return
        setFacts(data.facts)
        setLabel(deepeningProgressLabel(data.passes))
      } finally {
        if (!cancelled) setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [ideaId, isOwner])

  if (!isOwner || !loaded || !facts) return null

  const sources = Object.entries(facts.sourcesByType).sort((a, b) => b[1] - a[1])
  const totalSources = sources.reduce((n, [, c]) => n + c, 0)
  // Nothing has been deepened and nothing has been found: say nothing rather than render
  // a row of zeroes, which reads as a failing grade rather than as work not yet started.
  if (facts.passesRun === 0 && totalSources === 0 && facts.issuesRaised === 0) return null

  return (
    <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
        <span className="inline-flex items-center rounded-full bg-white border border-zinc-300 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
          {label}
        </span>
        <span><span className="text-zinc-400">Issues:</span> {facts.issuesRaised} raised · {facts.issuesResolved} resolved · {facts.issuesOpen} open</span>
        <span><span className="text-zinc-400">Known unknowns:</span> {facts.knownUnknownsDeclared} declared</span>
        <span>
          <span className="text-zinc-400">Sources:</span>{' '}
          {totalSources === 0 ? 'none yet' : sources.map(([t, c]) => `${t.toLowerCase().replace(/_/g, ' ')} ${c}`).join(' · ')}
        </span>
        <span>
          <span className="text-zinc-400">Last deepening run:</span>{' '}
          {facts.lastDeepeningRun
            ? new Date(facts.lastDeepeningRun).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            : 'never'}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-zinc-400">
        Facts, not a score — only you can see these for now.
      </p>
    </div>
  )
}
