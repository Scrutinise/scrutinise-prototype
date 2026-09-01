'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-N §1e — A RUN IN PROGRESS SAYS SO, ACROSS THE TOP, WHEREVER YOU ARE.
//
// ⚠⚠ THE OLD BEHAVIOUR WAS TRUE AND USELESS. Asking for a re-run while one was already
// running produced *"A rerun is not available at this time"* — which is `blockedReason`
// ("A build is already running for this idea", `build.ts`) reaching a surface with no idea
// what to do with it. Charlie: *"True and useless."* It is a refusal where a status belongs:
// the answer to "can I re-run" is "one is running now", and that is information, not a wall.
//
// ⚠ AND IT IS ON THE SURFACE THE USER IS ACTUALLY ON. A re-run is started on Stage 1 and
// takes ten minutes; the user goes back to reading their strategy on Stage 2, where — until
// now — nothing at all said a run was in flight. They came back later to a changed draft with
// no account of why. So this mounts on both surfaces from one component: two copies of "is a
// build running" would eventually disagree, and the one the user believes is whichever they
// happen to be looking at.
//
// ⚠ IT KEEPS THE FINISHED STATE UNTIL IT IS DISMISSED. A banner that vanished the moment the
// run ended would only ever be seen by somebody watching the screen at that second — which is
// precisely the user this is not for. "Re-run finished" stays, with the link, until they
// press the ✕ or reload.
//
// ⚠ POLLING STOPS WHEN THE RUN STOPS. A three-second poll that carries on for ever against a
// finished build is a request storm for a number that will not change.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState } from 'react'

/** How often to ask while a run is in flight. The same cadence the build page polls at. */
const POLL_MS = 4000

interface Shape {
  status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELLED'
  version: number
  passesComplete: number
  passesTotal: number
  currentPassLabel: string | null
}

/**
 * ══ 25-Q §2b — WHERE THE USER SHOULD GO NEXT, FROM WHERE THEY ARE ═════════════════════
 *
 * §2b: *"When a pass finishes, the user is left where they were. Either move them to The
 * Strategy, or say 'Pass finished — now go to the Strategy section' with a control that takes
 * them there."*
 *
 * ⚠⚠ AND THE BANNER HAD THE DEFECT §2b DESCRIBES, IN ITS PUREST FORM: mounted on the build page,
 * its finished control linked to `/ideas/build` — THE PAGE THE USER WAS ALREADY ON. A control
 * that reloads where you are is exactly "left where they were", made worse by looking like a way
 * out. It was invisible because the banner was written once and mounted twice, and on the OTHER
 * surface the same link was right.
 *
 * ⚠ SO IT NOW KNOWS WHICH SURFACE IT IS ON. Not a URL comparison at render time: the surface is
 * a fact the mounting page knows for certain and the component can only guess at.
 */
export default function RerunBanner({ ideaId, surface = 'strategy' }: {
  ideaId: string
  /** Where this banner is mounted. Decides what "somewhere else" means. */
  surface?: 'build' | 'strategy'
}) {
  const [live, setLive] = useState<Shape | null>(null)
  /**
   * ⚠ THE FINISH IS REMEMBERED, NOT DERIVED. A finished build is indistinguishable, on a
   * fresh page load, from a build that finished last Tuesday — and a permanent "Re-run
   * finished" banner on every visit would be furniture within a day. So the finished state is
   * only shown when THIS mount watched it change: we saw it running, then we saw it stop.
   */
  const [finished, setFinished] = useState<Shape | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const sawRunning = useRef(false)

  const read = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/build`)
      if (!res.ok) return null
      const body = await res.json()
      const l = body?.latest
      if (!l) return null
      const passes: Array<{ key: string; label: string }> = l.passes ?? []
      const shape: Shape = {
        status: l.status,
        version: l.version,
        passesComplete: l.passesComplete ?? 0,
        passesTotal: l.passesTotal ?? passes.length,
        currentPassLabel: passes.find((p) => p.key === l.currentPass)?.label ?? null,
      }
      return shape
    } catch {
      // ⚠ A FAILED POLL SHOWS NOTHING RATHER THAN AN ERROR. This is a status strip about
      // somebody else's long job; a red bar because one fetch missed would be worse than the
      // silence it replaced.
      return null
    }
  }, [ideaId])

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      const shape = await read()
      if (!alive) return
      if (shape) {
        const running = shape.status === 'RUNNING' || shape.status === 'QUEUED'
        if (running) {
          sawRunning.current = true
          setLive(shape)
          setFinished(null)
          setDismissed(false)
        } else {
          setLive(null)
          if (sawRunning.current) {
            sawRunning.current = false
            setFinished(shape)
          }
        }
        // ⚠ ONLY KEEP POLLING WHILE THERE IS SOMETHING TO POLL FOR.
        if (running) timer = setTimeout(() => void tick(), POLL_MS)
        return
      }
      timer = setTimeout(() => void tick(), POLL_MS * 3)
    }

    void tick()
    return () => { alive = false; if (timer) clearTimeout(timer) }
  }, [read])

  if (dismissed) return null

  if (live) {
    return (
      <div className="border-b border-blue-200 bg-blue-50 px-4 py-2">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <svg className="w-4 h-4 animate-spin text-blue-700 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-sm text-blue-900 flex-1">
            <span className="font-semibold">Re-running now…</span>{' '}
            {live.passesComplete} of {live.passesTotal} passes done
            {live.currentPassLabel ? ` — ${live.currentPassLabel}` : ''}. You can carry on working;
            nothing here changes until it finishes.
          </p>
          {/* ⚠ NO "WATCH IT" WHEN THEY ARE ALREADY WATCHING IT. A button to the page you are
              on teaches the user that the buttons here do nothing. */}
          {surface !== 'build' && (
            <a
              href={`/ideas/build?ideaId=${ideaId}`}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 border-blue-300 text-blue-800 hover:bg-blue-100 whitespace-nowrap"
            >
              Watch it
            </a>
          )}
        </div>
      </div>
    )
  }

  if (finished) {
    // ⚠ A STOPPED RUN AND A FINISHED ONE DO NOT SHARE A SENTENCE. §1a's whole point: nothing
    // incomplete may be presented as finished, and this banner is the first thing the user
    // reads when they look back up.
    const clean = finished.status === 'DONE'
    return (
      <div className={`border-b px-4 py-2 ${clean ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <p className={`text-sm flex-1 ${clean ? 'text-emerald-900' : 'text-amber-900'}`}>
            <span className="font-semibold">
              {clean ? 'Re-run finished.' : 'The re-run stopped before it finished.'}
            </span>{' '}
            {clean
              ? `Version ${finished.version} is ready — all ${finished.passesTotal} passes ran. `
                + (surface === 'build'
                  ? 'The Strategy is where it landed.'
                  : 'The panel beside you was drawn before it finished.')
              : `${finished.passesComplete} of ${finished.passesTotal} passes ran. What they produced is real; the rest did not happen.`}
          </p>
          {/* ══ §2b — THE CONTROL POINTS AT WHAT CHANGED ═══════════════════════════════
              A finished run changes THE STRATEGY, not the build page — so from the build page
              the way forward is the Strategy, and from the Strategy it is a reload, because the
              panel beside them was drawn before the run finished and is quietly out of date.

              ⚠ A STOPPED RUN STILL GOES TO THE BUILD PAGE. "What happened" is a question about
              the run, and the run's own page is where the passes and their reasons are. */}
          {!clean ? (
            <a
              href={`/ideas/build?ideaId=${ideaId}`}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 whitespace-nowrap border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              See what happened
            </a>
          ) : surface === 'build' ? (
            <a
              href={`/ideas/create?ideaId=${ideaId}`}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 whitespace-nowrap border-emerald-300 text-emerald-800 hover:bg-emerald-100"
            >
              Go to the Strategy
            </a>
          ) : (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-xs font-semibold px-3 py-1.5 rounded-full border-2 whitespace-nowrap border-emerald-300 text-emerald-800 hover:bg-emerald-100"
            >
              Reload to see it
            </button>
          )}
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className={`text-lg leading-none px-1 ${clean ? 'text-emerald-700' : 'text-amber-800'}`}
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return null
}
