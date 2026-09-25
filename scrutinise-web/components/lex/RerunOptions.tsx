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
import CollapsedSection from './CollapsedSection'
import { stageHref } from '@/lib/lex/stages'

interface PassSummary {
  key: string
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'NOT_REACHED' | 'SKIPPED'
  output: string | null
}

interface BuildState {
  canStart: boolean
  blockedReason: string | null
  latest: { status: string; version: number; passes?: PassSummary[] } | null
  // ⚠ THE DIALOGUE'S OWN TYPE, imported rather than restated. A local shape that merely
  // resembled it compiled happily until `fromVersion` was added — which is how a second
  // definition of the same thing announces itself, and the one place it was allowed to.
  reuse: RerunReuse | null
  reuseBlockedReason: string | null
  estimate: { line: string | null; minutes: number | null } | null
  allowance: {
    line: string | null
    canStartFull?: boolean
    /** BRIEF_26E §4 — whole builds, both currencies, so the count needs no arithmetic. */
    remainingBuilds?: number
    grantedBuilds?: number
  } | null
}

/**
 * ⚠ BRIEF_26F §1b — the SAME shape `WorkList.tsx`'s `AgendaShape` reads, from the SAME
 * `/api/ideas/[id]/agenda` endpoint. §5's acceptance criterion is that these counts MATCH the
 * left panel; fetching the one thing the left panel already fetches is what makes that true by
 * construction rather than by two counters agreeing today and drifting tomorrow.
 */
interface AgendaCounts {
  challenges: Array<{ status: string }>
  decisions: Array<{ resolved: boolean }>
  reading: Array<{ id: string }>
}

// ⚠ §2 — "each with a line saying why you would choose it." One row shape for all five
// options, so the reasoning always sits in the same place relative to the title.
function OptionRow({
  title, reason, note, href, children,
}: {
  title: string
  reason: string
  /** ⚠ §2 — "anything not yet built says so." A plain sentence, not a disabled-looking button. */
  note?: string
  href?: string
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-zinc-200 p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        {href && (
          <a href={href} className="text-xs font-medium text-blue-700 hover:text-blue-900 whitespace-nowrap">
            Go →
          </a>
        )}
      </div>
      <p className="text-xs text-zinc-600 mt-0.5">{reason}</p>
      {note && <p className="text-[11px] text-amber-700 mt-1">{note}</p>}
      {children}
    </div>
  )
}

export default function RerunOptions({ ideaId, kernelComplete }: {
  ideaId: string
  /**
   * BRIEF_26F §1/§2 — the SAME `kernelComplete` `CreateIdeaClient.tsx` already computes to gate
   * the Deepening panel (`state.pages.every(p => p.status === 'complete')`). Passed in rather
   * than recomputed here for the same reason: two readings of "is the kernel done" is two
   * places for the answer to disagree, and `DeepeningPanel`'s `unlocked` prop already proves
   * this exact value is available at the call site.
   */
  kernelComplete: boolean
}) {
  const [build, setBuild] = useState<BuildState | null>(null)
  const [agenda, setAgenda] = useState<AgendaCounts | null>(null)
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

  const loadAgenda = useCallback(async () => {
    try {
      const res = await fetch(`/api/ideas/${ideaId}/agenda`)
      if (res.ok) setAgenda(await res.json())
    } catch { /* the counts are additive to the box; a failed read just omits them */ }
  }, [ideaId])

  useEffect(() => { void load() }, [load])
  // ⚠ ONLY FETCHED ONCE THE KERNEL IS COMPLETE — the same "nothing until there is something to
  // show" rule the box already follows for the re-run block itself.
  useEffect(() => { if (kernelComplete) void loadAgenda() }, [kernelComplete, loadAgenda])

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

  // ⚠ THE RE-RUN BODY, UNCHANGED FROM 26-E, COMPUTED ONCE. §2's box offers Re-run as ONE of
  // five options once the kernel is complete; before that it is still the whole box. Extracted
  // rather than duplicated, so the two places it can render never say different things.
  const reRunBody = (
    <>
      {running ? (
        <p className="text-sm text-zinc-700">
          It is running now — you can re-run it again once this one finishes. Anything you add
          meanwhile will be waiting for it.
        </p>
      ) : !build.canStart ? (
        // ⚠ THE REASON, NOT A MISSING BUTTON. A control that is simply absent reads as broken;
        // one that says why it does not apply does not. The same rule the build page follows.
        <p className="text-sm text-zinc-700">
          {build.blockedReason ?? 'A re-run is not available on this idea just now.'}
        </p>
      ) : (
        <>
          <p className="text-sm text-zinc-700">
            {build.reuse
              ? `Re-running from the research already gathered — ${build.reuse.findings} finding`
                + `${build.reuse.findings === 1 ? '' : 's'}, ${build.reuse.cited} cited source`
                + `${build.reuse.cited === 1 ? '' : 's'}. Add new information first if you want me `
                + 'to search again.'
              : 'Re-running reads the corpus from nothing — use it when what you have told me has '
                + 'really changed.'}
          </p>
          {/* ⚠ BRIEF_26F §1c — WHY, NOT JUST THAT. "A re-run is likely to be wanted" once the
              kernel is settled, and the reason is that it searches against decisions that did
              not exist when the last one ran — so the sentence says exactly that, once. */}
          {kernelComplete && (
            <p className="text-sm text-zinc-700 mt-1">
              Worth doing now: it searches afresh against every decision you have settled since
              the last build ran, which the last run could not have known about.
            </p>
          )}
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
    </>
  )

  // ══ BRIEF_26F §1a — THE COHERENCE CHECK, READ FROM THE LATEST BUILD'S OWN PASS LOG ═════════
  //
  // ⚠⚠ MEASURED, NOT ASSUMED: `KERNEL_CHECK`/`LOGIC_CHECK` are entries in the STANDARD build
  // pass sequence (`build-config.ts`) — they run automatically on every full build, including
  // the first, and write their failures to the same `DeepeningIssue` rows the left panel counts
  // as challenges. There is no separate, cheaper trigger for "just the coherence check" today —
  // re-running the whole build is what re-runs it. So this reads what the LAST build's own log
  // says rather than offering a button that would either lie about doing something new or
  // silently become a second Re-run.
  const kernelCheck = build.latest.passes?.find((p) => p.key === 'KERNEL_CHECK') ?? null
  const logicCheck = build.latest.passes?.find((p) => p.key === 'LOGIC_CHECK') ?? null
  const coherenceLine = kernelCheck || logicCheck
    ? [kernelCheck?.output, logicCheck?.output].filter(Boolean).join(' ')
      || 'Ran on the last build, but left no readable result.'
    // ⚠ §1a — SAID PLAINLY, before it is offered as anything. On an idea whose first draft
    // predates this pass being added to the build sequence, this is the honest answer.
    : 'Has not run on this idea yet — it runs automatically as part of a build, and this idea’s '
      + 'builds predate it.'

  const challengesOpen = agenda?.challenges.filter((c) => c.status === 'OPEN').length ?? 0
  const decisionsOpen = agenda?.decisions.filter((d) => !d.resolved).length ?? 0
  const readingLeft = agenda?.reading.length ?? 0

  return (
    <div>
      {/* ══ BRIEF_26E §4 — BUILD CREDITS, BOLD, AT THE TOP, NEVER BEHIND A COLLAPSE ══════
          §4c: "Charlie should be able to see how many builds he has without arithmetic." The
          unit is Builds. The detailed sentence (thirds, re-runs, the mix) still runs below,
          inside Re-run, for the nuance a headline can't carry — this is not a decoration of
          that sentence, it is the number pulled out of it. */}
      {build.allowance && (
        <p className="text-sm mb-2">
          <span className="font-bold text-zinc-900">Build credits: {build.allowance.remainingBuilds ?? 0}</span>
          {typeof build.allowance.grantedBuilds === 'number' && (
            <span className="text-zinc-500"> of {build.allowance.grantedBuilds}</span>
          )}
        </p>
      )}

      {kernelComplete ? (
        <>
          {/* ══ BRIEF_26F §1 — THE MOMENT, STATED, NOT SILENCE ═══════════════════════════
              §1: "When all four kernel sections are settled, say so and say what is now
              possible." §1b: the counts are the SAME ones the left panel already shows — see
              `AgendaCounts` above — named here at the moment they become the thing to act on. */}
          <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50/50 p-3 mb-2">
            <p className="text-sm font-bold text-emerald-900">The kernel is settled.</p>
            <p className="text-xs text-zinc-700 mt-1 leading-snug">
              Diagnosis, guiding policy and coherent actions are all confirmed. That is not the
              same as finished — here is what is still open.
            </p>
            {agenda && (
              <ul className="text-xs text-zinc-800 mt-1.5 space-y-0.5">
                <li>{challengesOpen} challenge{challengesOpen === 1 ? '' : 's'} not yet answered</li>
                <li>{decisionsOpen} decision{decisionsOpen === 1 ? '' : 's'} still unresolved</li>
                <li>{readingLeft} thing{readingLeft === 1 ? '' : 's'} still to read</li>
              </ul>
            )}
          </div>

          {/* ══ BRIEF_26F §2 — THE BOX BECOMES A RANGE OF OPTIONS ════════════════════════
              §2: "each with a line saying why you would choose it." Open by default — this is
              now the primary thing to do at the end of the kernel, not a rarely-used control. */}
          <CollapsedSection title="What next" defaultOpen hint="A range of options, and why you would choose each.">
            <div className="p-3 space-y-2.5">
              <OptionRow
                title="Run the coherence check"
                reason="Does the policy answer the diagnosis, and do the actions implement the policy?"
                note={`Not yet built as its own action — today it runs automatically inside Re-run, below. ${coherenceLine}`}
              />
              <OptionRow
                title="Answer the outstanding challenges"
                reason={`${challengesOpen} unanswered — these are the objections your proposal will meet.`}
                href={challengesOpen > 0 ? `${stageHref('deepening', ideaId)}#deepening-passes` : undefined}
                note={challengesOpen === 0 ? 'None open right now.' : undefined}
              />
              <div className="rounded-lg border border-zinc-200 p-2.5">
                <p className="text-sm font-semibold text-zinc-900">Re-run</p>
                <p className="text-xs text-zinc-600 mt-0.5 mb-1.5">
                  Searches afresh against everything you have settled since the last build.
                </p>
                {reRunBody}
              </div>
              <OptionRow
                title="Take the working document away"
                reason="The proposal, the two-page summary, or the meeting pack — for report, for the wider team, or for someone helping who has not joined it."
                href={`/ideas/${ideaId}?tab=exports`}
              />
              {/* ⚠ §2 — "shown only if and when it does something." Kernel complete is exactly
                  when the Deepening unlocks (`DeepeningPanel`'s own `unlocked` gate), so there
                  is no separate condition to compute here — this branch already implies it. */}
              <OptionRow
                title="Go deeper"
                reason="Optional, in any order — evidence, the law, the costings and the politics, each handing you findings to judge."
                href={stageHref('deepening', ideaId)}
              />
            </div>
          </CollapsedSection>
        </>
      ) : (
        // ══ BRIEF_26E §5 — THE SAME COLLAPSING HEADER AS THE KERNEL SECTIONS ═════════════
        // Charlie: "I've lost the rebuild button on the main idea page" — the reason this block
        // exists at all (see the file header). `CollapsedSection` IS that control — its own
        // header comment says it copies the kernel headings' vocabulary exactly. Open by
        // default while a build is actually running, so a live status is never hidden.
        <CollapsedSection
          title="Re-run"
          defaultOpen={running}
          hint={running ? 'Running now.' : 'Re-run this idea, or check on a run in progress.'}
        >
          <div className="p-3">
            {reRunBody}
          </div>
        </CollapsedSection>
      )}
    </div>
  )
}
