'use client'

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-L §1 — THE RE-RUN DIALOGUE. 25-K gave Stage 1 a re-run control; this makes it
// worth pressing.
//
// ⚠⚠ THE BUTTON NO LONGER FIRES. A re-run that starts the instant it is clicked spends
// four minutes and 34p reproducing the draft the user was just unhappy with, because
// nothing has changed between the two runs except the model's temperature. The one thing
// that would change it — what they think is wrong with it — is in their head, and nobody
// has ever asked.
//
// ⚠ EVERYTHING GOES IN BEFORE IT STARTS. Text, files and links, in one place, all addable
// before "go". The old flow made the user add a document, watch the page reload, then find
// the re-run button again, and gave them no way at all to say why they were adding it.
//
// ⚠ IT SAYS WHAT WILL HAPPEN AND WHAT IT COSTS, and the two prices are different questions:
// "will the research be reused" and "how much will this cost" have separate answers, and
// the answer to the first CHANGES when the user adds material — so the panel recomputes
// rather than printing a number chosen when it opened.
//
// ⚠ NOTHING IS SENT UNTIL "GO". The critique is a single field on the build row, written
// when the build is claimed. Closing this dialogue discards it, and the copy says so —
// silently keeping a draft criticism the user walked away from would be a stored opinion
// they never submitted.
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from 'react'
import YourMaterial from './YourMaterial'

export interface RerunReuse {
  findings: number
  cited: number
  sources: number
  fromVersion: number
}

/**
 * §1's copy, close to Charlie's wording. Exported so `check:lex-25l` asserts the words
 * rather than a paraphrase of them — this is the one place in the flow where the question
 * being asked determines the quality of everything downstream.
 */
export const RERUN_PROMPT_HEADING = 'You’d like to re-run this idea.'
export const RERUN_PROMPT_BODY =
  'What new information or change of direction would you like to see this time? Tell me what '
  + 'was missing, misunderstood or misguided about the last run — the more specific you are, '
  + 'the better this run will be.'

export default function RerunDialogue({
  ideaId, reuse, reuseBlockedReason, estimateLine, busy, onCancel, onGo, onMaterialChanged,
}: {
  ideaId: string
  /** What a REUSE run would reuse, or null when there is nothing to reuse. */
  reuse: RerunReuse | null
  /** Why reuse is unavailable, in words. */
  reuseBlockedReason: string | null
  /** The measured duration-and-cost sentence for a full run. */
  estimateLine: string | null
  busy: boolean
  onCancel: () => void
  onGo: (mode: 'FULL' | 'REUSE', critique: string) => void
  /** Bumped upward when material is added, so the caller can re-read reuse availability. */
  onMaterialChanged: () => void
}) {
  const [critique, setCritique] = useState('')
  const [showMaterial, setShowMaterial] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rerun-heading"
    >
      <div className="bg-white rounded-2xl shadow-xl max-w-xl w-full p-5 my-8">
        <h2 id="rerun-heading" className="text-base font-semibold text-zinc-900">
          {RERUN_PROMPT_HEADING}
        </h2>
        <p className="text-sm text-zinc-600 mt-1.5 leading-relaxed">{RERUN_PROMPT_BODY}</p>

        <textarea
          value={critique}
          onChange={(e) => setCritique(e.target.value)}
          rows={7}
          autoFocus
          placeholder="What was missing, misunderstood or misguided?"
          className="mt-3 w-full rounded-lg border border-zinc-300 p-2.5 text-sm leading-relaxed"
        />

        {/* §1 — "accepts everything before it starts: free text, multiple files, multiple
            URLs, in one place, all addable before pressing go." The same component the
            composer uses, so a document added here goes through the same pipeline and is
            read on the spot rather than waiting for the build. */}
        <button
          type="button"
          onClick={() => setShowMaterial((v) => !v)}
          aria-expanded={showMaterial}
          className={`mt-3 text-sm font-medium px-3 py-2 rounded-full border-2 inline-flex items-center gap-1.5 ${
            showMaterial
              ? 'bg-zinc-900 border-zinc-900 text-white'
              : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          <span aria-hidden className="text-base leading-none">{showMaterial ? '−' : '+'}</span>
          {showMaterial ? 'Close' : 'Add files or links for this run'}
        </button>

        {showMaterial && (
          <div className="mt-2.5 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
            <YourMaterial ideaId={ideaId} onChanged={onMaterialChanged} />
          </div>
        )}

        {/* ══ WHAT WILL HAPPEN, AND WHAT IT COSTS ═══════════════════════════════
            ⚠ THE REUSE ANSWER IS RECOMPUTED, NOT FROZEN WHEN THE DIALOGUE OPENED. Adding a
            document is exactly the thing that can change it, and it is the thing this
            dialogue invites. A price printed once at the top of a form the user then
            changes is a price that becomes wrong while they read it. */}
        <div className="mt-4 rounded-xl border border-zinc-200 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            What will happen
          </p>
          {reuse ? (
            <p className="text-sm text-zinc-700 mt-1.5">
              I can reuse the research I already have — {reuse.findings} finding
              {reuse.findings === 1 ? '' : 's'} and {reuse.cited} cited source
              {reuse.cited === 1 ? '' : 's'} from version {reuse.fromVersion} — and redraft against
              what you have just told me. That skips the two search passes and costs roughly a third
              of a full build. Searching again reads the corpus from nothing.
            </p>
          ) : (
            <p className="text-sm text-zinc-700 mt-1.5">
              {reuseBlockedReason ?? 'This will search the corpus again from scratch.'}
            </p>
          )}
          {estimateLine && <p className="text-[11px] text-zinc-500 mt-1.5">A full run: {estimateLine}</p>}
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {reuse && (
            <button
              onClick={() => onGo('REUSE', critique)}
              disabled={busy}
              className="text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
            >
              Redraft from what I found
            </button>
          )}
          <button
            onClick={() => onGo('FULL', critique)}
            disabled={busy}
            className={`text-sm px-4 py-2 rounded-full disabled:opacity-40 ${
              reuse
                ? 'font-medium border border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                : 'font-semibold bg-zinc-900 text-white hover:opacity-90'
            }`}
          >
            {reuse ? 'Search again from scratch' : 'Run it again'}
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="text-sm font-medium px-3 py-2 rounded-full text-zinc-500 hover:bg-zinc-50 disabled:opacity-40"
          >
            Not now
          </button>
        </div>

        {/* ⚠ IT IS NOT REQUIRED, AND SAYING SO MATTERS. A user who genuinely just wants the
            same thing run again must not be made to invent a criticism to get past a
            gate — an invented one would then be fed to the passes as an instruction. */}
        <p className="mt-2.5 text-[11px] text-zinc-500">
          You can leave the box empty and run it as it stands. What you write here is kept with this
          run so we can see what you asked for; closing this without running discards it.
        </p>
      </div>
    </div>
  )
}
