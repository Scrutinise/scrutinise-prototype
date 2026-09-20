'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 26-C ADDENDUM 3 §24 — THE IDEA OVERVIEW'S STATS TAB.
//
// Replaces `components/lex/EvidenceFactsStrip.tsx`, which rendered this same data as a
// small grey box in the page header. §24b: "remove the grey statistics box." §24c: "its
// contents move to a new tab... as bullet points." The facts and the progress label are
// unchanged — §24.1/§24.2's original design (see the retired strip's own comment) — only
// the surface they render on has moved, from a header aside to a tab of its own.
//
// ⚠ §24d — "Facts, not a score — only you can see these for now" IS KEPT. Charlie's list
// of what moves did not name this line; it is doing honest work (the whole point of
// §24.1/§24.2 was separating machine-derived counts from anything that reads as a score),
// and dropping it by omission would be the exact silent-loss CLAUDE.md §11 exists to
// prevent. If this reads as wrong once seen on the tab, it is one line to remove.
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
 * implying a ladder it cannot climb. "Team-reviewed" needs team roles and "Published"
 * needs versioning — neither is built. DEEPENED requires BOTH at least one pass RUN
 * **and its issues triaged**: a pass that ran and left ten open issues has produced a
 * to-do list, not deepened anything.
 */
export function deepeningProgressLabel(passes: PassLite[]): 'Skeleton' | 'Deepened' {
  const run = passes.filter((p) => p.status === 'RUN')
  if (run.length === 0) return 'Skeleton'
  const anyTriaged = run.some((p) => p.issues.length > 0 && p.issues.every((i) => i.status !== 'OPEN'))
  // A run that raised no issues at all counts as triaged — there was nothing to triage.
  const anyClean = run.some((p) => p.issues.length === 0)
  return anyTriaged || anyClean ? 'Deepened' : 'Skeleton'
}

export default function StatsTab({ ideaId, isOwner }: { ideaId: string; isOwner: boolean }) {
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

  // Defence in depth: the tab itself is already hidden from a non-owner (IdeaDetailClient
  // only lists 'stats' in its tab bar when `isOwner`), so this only matters if the tab is
  // reached some other way — e.g. `?tab=stats` typed by hand.
  if (!isOwner) return null
  if (!loaded) return <p className="text-sm text-zinc-400">Loading…</p>
  if (!facts) return <p className="text-sm text-zinc-400">Nothing to show yet.</p>

  const sources = Object.entries(facts.sourcesByType).sort((a, b) => b[1] - a[1])
  const totalSources = sources.reduce((n, [, c]) => n + c, 0)

  return (
    <div>
      <span className="inline-flex items-center rounded-full bg-zinc-100 border border-zinc-300 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
        {label}
      </span>

      {facts.passesRun === 0 && totalSources === 0 && facts.issuesRaised === 0 ? (
        <p className="mt-3 text-sm text-zinc-400">
          Nothing has been deepened yet — nothing to count here until a deepening pass runs.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5 text-sm text-zinc-700 list-disc list-inside">
          <li>
            Issues: {facts.issuesRaised} raised · {facts.issuesResolved} resolved · {facts.issuesOpen} open
          </li>
          <li>Known unknowns: {facts.knownUnknownsDeclared} declared</li>
          <li>
            Sources: {totalSources === 0
              ? 'none yet'
              : sources.map(([t, c]) => `${t.toLowerCase().replace(/_/g, ' ')} ${c}`).join(' · ')}
          </li>
          <li>
            Last deepening run: {facts.lastDeepeningRun
              ? new Date(facts.lastDeepeningRun).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'never'}
          </li>
        </ul>
      )}

      <p className="mt-3 text-xs text-zinc-400">
        Facts, not a score — only you can see these for now.
      </p>
    </div>
  )
}
