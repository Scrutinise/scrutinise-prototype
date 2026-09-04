'use client'

// ─────────────────────────────────────────────────────────────────────────────────────────
// THE RE-RUN CONTROLS, IN THE MIDDLE PANEL OF THE MAIN IDEA PAGE.
//
// Charlie: *"I've lost the rebuild button on the main idea page."*
//
// ⚠⚠ IT WAS NEVER ON THAT PAGE, AND THAT IS WORTH SAYING RATHER THAN QUIETLY "RESTORING" IT.
// `git log -S "Re-run this idea" -- app/ideas/create/CreateIdeaClient.tsx` returns nothing: the
// re-run block has only ever lived on `/ideas/build` (`BuildIdeaClient`). What the main idea
// page has is `RerunBanner`, which reports a run that is ALREADY GOING and disappears when it
// finishes — so on a settled idea there is nothing to press, which is exactly the experience of
// having lost a button. It is a new control here, in the place he asked for it.
//
// ⚠ IT FETCHES ITS OWN STATE, like `ReportAdditions` and `AgendaPanel` beside it. The create
// page does not read the build endpoint at all, and threading a second large object down
// through three panels to serve one box is how a prop becomes stale in one of the places it is
// read. One component, one read, one source of truth.
//
// ⚠ THE DIALOGUE IS THE SAME COMPONENT the build page opens, not a second copy of the choice.
// 25-L §1's rule holds wherever it is opened: ONE button, and the choice of mode lives inside
// the dialogue, beside what each option will do and after the user has said what was wrong.
// Two buttons here would make them choose a price before being asked the only question that
// changes the result.
// ─────────────────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react'
import RerunDialogue, { type RerunReuse } from './RerunDialogue'

interface BuildState {
  canStart: boolean
  blockedReason: string | null
  latest: { status: string; version: number } | null
  // ⚠ THE DIALOGUE'S OWN TYPE, imported rather than restated. A local shape that merely
  // resembled it compiled happily until `fromVersion` was added — which is how a second
  // definition of the same thing announces itself, and the one place it was allowed to.
  reuse: RerunReuse | null
  reuseBlockedReason: string | null
  estimate: { line: string | null; minutes: number | null } | null
  allowance: { line: string | null; canStartFull?: boolean } | null
}

export default function RerunOptions({ ideaId }: { ideaId: string }) {
  const [build, setBuild] = useState<BuildState | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/build`)
      if (res.ok) setBuild(await res.json())
    } catch {
      // ⚠ A box that cannot read its own state renders nothing rather than a broken shell.
      // The build page remains the full surface either way.
    }
  }, [ideaId])

  useEffect(() => { void load() }, [load])

  const start = useCallback(async (mode: 'FULL' | 'REUSE', critique: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/ideas/${ideaId}/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          ...(critique.trim() ? { critique: critique.trim() } : {}),
          // ⚠⚠ SENT EXPLICITLY, BECAUSE THIS CARD MAKES THE PROMISE IN WORDS.
          //
          // `claimBuild` would otherwise fall back to the user's remembered preference, which
          // 25-X §B defaults to true — so the email would very probably be sent anyway. "Very
          // probably" is not what a sentence on the screen says. The line below tells them they
          // will be emailed; this is what makes the row agree with it, whatever that preference
          // happens to be. A promise on a card and a flag on a row that can disagree is the
          // shape of the defect 25-W spent a sprint on.
          notifyEmail: true,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(typeof data?.error === 'string' ? data.error : 'The re-run could not be started.')
      } else {
        setOpen(false)
      }
    } catch {
      setError('The re-run could not be started.')
    } finally {
      setBusy(false)
      void load()
    }
  }, [ideaId, load])

  // ⚠ NOTHING UNTIL THERE IS SOMETHING TO RE-RUN. Before a first build there is no re-run —
  // the first build starts on the build page — and a box saying so would be furniture.
  if (!build?.latest) return null

  const running = build.latest.status === 'RUNNING' || build.latest.status === 'QUEUED'

  return (
    <div className="rounded-xl border-2 border-zinc-300 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Re-run</p>

      {running ? (
        <p className="text-sm text-zinc-700 mt-1.5">
          It is running now — you can re-run it again once this one finishes. Anything you add
          meanwhile will be waiting for it.
        </p>
      ) : !build.canStart ? (
        // ⚠ THE REASON, NOT A MISSING BUTTON. A control that is simply absent reads as broken;
        // one that says why it does not apply does not. The same rule the build page follows.
        <p className="text-sm text-zinc-700 mt-1.5">
          {build.blockedReason ?? 'A re-run is not available on this idea just now.'}
        </p>
      ) : (
        <>
          <p className="text-sm text-zinc-700 mt-1.5">
            {build.reuse
              ? `Re-running from the research already gathered — ${build.reuse.findings} finding`
                + `${build.reuse.findings === 1 ? '' : 's'}, ${build.reuse.cited} cited source`
                + `${build.reuse.cited === 1 ? '' : 's'}. Add new information first if you want me `
                + 'to search again.'
              : 'Re-running reads the corpus from nothing — use it when what you have told me has '
                + 'really changed.'}
          </p>
          <div className="mt-2.5">
            <button
              onClick={() => setOpen(true)}
              disabled={busy}
              className="text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
            >
              Re-run this idea…
            </button>
          </div>
          {/* ══ ⚠⚠ HOW LONG, AND THAT THEY WILL BE TOLD — CHARLIE, 4 SEPTEMBER ══════════════
              *"This may take about ten minutes, we will email you when it's finished."*

              ⚠ THE NUMBER IS THE MEASURED ONE, NOT THE WORD "TEN". It happens to BE ten right
              now — the mean over the last 20 builds is 614.6 seconds — so his sentence and the
              data agree today. Hardcoding it would make the card contradict the estimate line
              beneath it the first time a build got faster, and this codebase has retired two
              hardcoded figures that outlived their own truth already. "About ten minutes" is
              the fallback for an idea with nothing measured yet, where a figure would be a
              guess wearing a number's clothes.

              ⚠ AND IT IS A PROMISE THE ARCHITECTURE KEEPS. 25-T moved the build onto the
              Railway worker, 25-V confirmed one completing with the tab shut, and 25-Y proved
              the send with a provider id. The email is not new; saying so here is. */}
          <p className="mt-2 text-sm text-zinc-700">
            This may take about {build.estimate?.minutes ?? 10} minutes — we will email you when
            it’s finished, so you can close this page.
          </p>
          {/* ⚠ The balance is on the PAGE, not only inside the dialogue (25-N §1d): deciding
              whether to open the re-run is already a decision about spending one. */}
          {build.allowance?.line && (
            <p className="mt-2 text-xs font-medium text-zinc-700">{build.allowance.line}</p>
          )}
          {/* ⚠ The cost half only — the duration is said above, in Charlie's words, and printing
              the estimate line whole would say "about 10 minutes" twice on one card. */}
          {build.estimate?.line && (
            <p className="text-[11px] text-zinc-500 mt-1">
              {build.estimate.line.replace(/^This usually takes[^.]*\.\s*/, '')}
            </p>
          )}
        </>
      )}

      {error && <p className="mt-2 text-xs text-amber-800">{error}</p>}

      {open && (
        <RerunDialogue
          ideaId={ideaId}
          reuse={build.reuse}
          reuseBlockedReason={build.reuseBlockedReason}
          estimateLine={build.estimate?.line ?? null}
          allowanceLine={build.allowance?.line ?? null}
          canStartFull={build.allowance?.canStartFull ?? true}
          busy={busy}
          onCancel={() => setOpen(false)}
          onGo={(mode, critique) => void start(mode, critique)}
          onMaterialChanged={() => void load()}
        />
      )}
    </div>
  )
}
