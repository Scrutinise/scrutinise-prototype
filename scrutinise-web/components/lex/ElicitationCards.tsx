'use client'

// ─────────────────────────────────────────────────────────────────────────────
// 25-E §1 — THE ELICITATION'S PHASE CARDS, AS PURE COMPONENTS.
//
// ⚠⚠ EXTRACTED SO THEY CAN BE RENDERED AND LOOKED AT. The defect that stopped this product
// for eight sprints was not a wrong function — every function was right. It was that at one
// combination of the two state objects the page held, **the rendered output contained no
// control at all**, and there is exactly one way to catch that: render it and look.
//
// While the cards lived inline in `BuildIdeaClient`, whose state arrives in an effect, they
// could not be rendered in isolation — so the only assertions available were greps over the
// source, which is what every previous sprint had and is why nobody saw this. A grep can tell
// you a `<button>` is written down. It cannot tell you the branch containing it is reachable.
//
// So each phase is a component that takes its props explicitly and returns markup.
// `verify:lex-25e-ui` renders every one of them and asserts a usable control comes out.
//
// ⚠ THEY HOLD NO STATE AND FETCH NOTHING. Everything comes in as a prop, which is what makes
// them renderable — and the discipline that keeps them so.
// ─────────────────────────────────────────────────────────────────────────────

import { CONFIRM_YES_LABEL, CONFIRM_NO_LABEL, CORRECTION_PROMPT } from '@/lib/lex/elicitation-config'

export interface StepView {
  key: string; label: string; question: string; hints: string[]
  /** 25-E §4a — the SHORT line for the card, or null when the hints say it better and the
   *  transcript has already asked the question in full. */
  cardPrompt: string | null
  optional: boolean; done: boolean; answer: string | null
}

export function Spinner({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

// ── PHASE: QUESTION ──────────────────────────────────────────────────────────

export interface QuestionCardProps {
  step: StepView
  goalKinds: ReadonlyArray<{ key: string; label: string }>
  text: string; onText: (v: string) => void
  goalKind: string; onGoalKind: (v: string) => void
  ruledOut: string; onRuledOut: (v: string) => void
  readingUrl: string; onReadingUrl: (v: string) => void
  /**
   * 25-E §4b — WHY SEND IS DISABLED, IN WORDS, OR NULL WHEN IT IS NOT.
   *
   * ⚠ ONE VALUE DRIVES BOTH THE BUTTON AND THE SENTENCE, so they cannot disagree. Charlie
   * could not press Send on question two and nothing on the page said a category had to be
   * chosen first — a disabled control that does not say what would enable it is the same
   * defect as the dead end, in miniature.
   */
  blockedSend: string | null
  busy: boolean
  onSend: () => void
  onSkip: () => void
}

export function QuestionCard(p: QuestionCardProps) {
  const { step } = p
  return (
    <div className="border border-zinc-200 rounded-2xl p-4">
      <p className="text-sm font-semibold text-zinc-900">{step.label}</p>
      {/* ⚠ 25-E §4a — THE QUESTION IS SAID ONCE. `step.question` for the opening exchange IS
          `OPENING_ASK`, which Lex has already said in the transcript immediately above this
          card — so it was printed twice, verbatim, and the card's own job (say what goes in
          THIS box) was done by neither copy. */}
      {step.cardPrompt && <p className="text-sm text-zinc-600 mt-1">{step.cardPrompt}</p>}
      {step.hints.length > 0 && (
        <ul className="mt-2 text-xs text-zinc-400 list-disc list-inside space-y-0.5">
          {step.hints.map((h) => <li key={h}>{h}</li>)}
        </ul>
      )}

      {step.key === 'goal' && (
        <div className="mt-3">
          {/* §4b — the requirement is visible BEFORE the control is pressed. */}
          <p className="text-xs font-medium text-zinc-700">
            Pick the one that fits best — you can add anything else underneath.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.goalKinds.map((g) => (
              <button
                key={g.key}
                onClick={() => p.onGoalKind(g.key)}
                aria-pressed={p.goalKind === g.key}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border ${
                  p.goalKind === g.key
                    ? 'bg-zinc-900 text-white border-zinc-900'
                    : 'bg-white text-zinc-600 border-zinc-300 hover:bg-zinc-50'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {step.key === 'reading' && (
        <input
          value={p.readingUrl}
          onChange={(e) => p.onReadingUrl(e.target.value)}
          placeholder="https://…"
          className="mt-3 w-full text-sm border border-zinc-300 rounded-lg px-3 py-2"
        />
      )}

      <textarea
        value={p.text}
        onChange={(e) => p.onText(e.target.value)}
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
          value={p.ruledOut}
          onChange={(e) => p.onRuledOut(e.target.value)}
          rows={2}
          placeholder="Anything you’ve already ruled out, and why (optional)"
          className="mt-2 w-full text-sm border border-zinc-300 rounded-lg px-3 py-2"
        />
      )}

      {/* Exchange 4 says plainly that Lex cannot read it yet. Never-claim, at the point of
          asking rather than in a footnote afterwards. */}
      {step.key === 'reading' && (
        <p className="mt-2 text-xs text-zinc-500">
          I’ll keep it with the idea, but I can’t read documents yet — nothing I draft will come
          from it. That’s a later sprint, and I’d rather say so than pretend.
        </p>
      )}

      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={p.onSend}
          disabled={p.busy || !!p.blockedSend}
          className="text-sm font-semibold px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 inline-flex items-center gap-2"
        >
          {p.busy && <Spinner className="w-3.5 h-3.5" />}
          Send
        </button>
        {step.optional && (
          <button
            onClick={p.onSkip}
            disabled={p.busy}
            className="text-sm font-medium px-3 py-2 rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
          >
            Nothing to add
          </button>
        )}
        {/* §4b — the reason travels WITH the disabled control, so it is read at the moment
            the user tries to press it. */}
        {p.blockedSend && <span className="text-xs text-zinc-500">{p.blockedSend}</span>}
      </div>
    </div>
  )
}

// ── PHASE: UNDERSTANDING_FAILED ──────────────────────────────────────────────

/**
 * ⚠⚠ THIS CARD DID NOT EXIST, AND ITS ABSENCE WAS A DEAD END. When the paragraph fails to
 * write, the row stays IN_PROGRESS with `currentStep` at 'confirm' — the question card was
 * suppressed, the confirmation needed AWAITING_CONFIRMATION and the build card needed
 * CONFIRMED, so NOTHING rendered. Lex's apology said "try again in a moment" and there was no
 * way to try again.
 */
export function UnderstandingFailedCard({ busy, onRetry }: { busy: boolean; onRetry: () => void }) {
  return (
    <div className="border-2 border-amber-200 bg-amber-50/50 rounded-2xl p-4">
      <p className="text-sm text-zinc-800">
        I couldn’t put together what I understand you’re trying to do just then — that’s on me, not
        on anything you wrote. <span className="font-medium">Everything you’ve told me is saved.</span>{' '}
        Let me try again.
      </p>
      <button
        onClick={onRetry}
        disabled={busy}
        className="mt-3 text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-2"
      >
        {busy && <Spinner className="w-3.5 h-3.5" />}
        Try again
      </button>
    </div>
  )
}

// ── PHASE: AWAITING_CONFIRMATION ─────────────────────────────────────────────

/**
 * §1 — accept, disagree, AND a live text box, all present at once.
 *
 * ⚠ THE TEXT BOX IS NOT BEHIND THE "NOT QUITE" BUTTON ANY MORE. Lex has just said "if I've
 * got the wrong end of anything, now is the cheapest moment to say so" — and the only way to
 * say so was to find a button whose label does not obviously mean "type here". A step that
 * invites a correction and hides the means of making one is worse than one that never asked.
 *
 * ⚠ AND ACCEPT IS DISABLED BY NOTHING BUT A REQUEST IN FLIGHT. It used to be reachable only
 * to a user who could get past a build object that had gone stale.
 */
export function ConfirmationCard({
  correction, onCorrection, busy, onConfirm, onCorrect,
}: {
  correction: string
  onCorrection: (v: string) => void
  busy: boolean
  onConfirm: () => void
  onCorrect: () => void
}) {
  return (
    <div className="border-2 border-blue-200 bg-blue-50/40 rounded-2xl p-4">
      <p className="text-sm text-zinc-700">
        Have I got that right? Agree and I’ll build it — or tell me what’s off and I’ll say it back
        to you again. Correcting me only re-runs this bit; we don’t go back to the start.
      </p>
      <textarea
        value={correction}
        onChange={(e) => onCorrection(e.target.value)}
        rows={3}
        placeholder="Anything I’ve got wrong? (leave blank if it’s right)"
        className="mt-3 w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 leading-relaxed bg-white"
      />
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={onConfirm}
          disabled={busy}
          className="text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40 inline-flex items-center gap-2"
        >
          {busy && <Spinner className="w-3.5 h-3.5" />}
          {CONFIRM_YES_LABEL}
        </button>
        <button
          onClick={onCorrect}
          disabled={busy || !correction.trim()}
          className="text-sm font-medium px-4 py-2 rounded-full border border-zinc-300 text-zinc-700 bg-white hover:bg-zinc-50 disabled:opacity-40 inline-flex items-center gap-2"
        >
          {busy && <Spinner className="w-3.5 h-3.5" />}
          {CONFIRM_NO_LABEL}
        </button>
        {!correction.trim() && (
          <span className="text-xs text-zinc-500 self-center">Type what’s wrong above to correct me.</span>
        )}
      </div>
      <p className="mt-2 text-xs text-zinc-500">{CORRECTION_PROMPT}</p>
    </div>
  )
}

// ── PHASE: CONFIRMED — the build is startable ────────────────────────────────

export interface StartBuildCardProps {
  canStart: boolean
  /**
   * ⚠⚠ THE NOTE THAT TOLD THE USER TO DO WHAT THEY HAD JUST DONE. `blockedReason` is computed
   * from `isConfirmed(ideaId)` and was never wrong — it was STALE, held from the boot fetch
   * while the elicitation moved on without it. Rendered beside a greyed-out button it read
   * "Confirm what I've understood first", after confirming, with no control left to confirm
   * with.
   */
  blockedReason: string | null
  /** TRUE when the build half could not be re-read alongside the elicitation. */
  buildStale: boolean
  estimateLine: string | null
  sampleSize: number
  hasMean: boolean
  offerEmail: boolean
  emailWhenDone: boolean
  onEmailWhenDone: (v: boolean) => void
  busy: boolean
  onStart: () => void
  onRetryState: () => void
}

export function StartBuildCard(p: StartBuildCardProps) {
  // ⚠ A REASON THAT CONTRADICTS THIS PHASE IS STALE BY CONSTRUCTION. We are rendering the
  // CONFIRMED card, so a "you have not confirmed" reason cannot be true — it is suppressed
  // and reported as an unreadable state, never shown to the user as fact.
  const showReason = !!p.blockedReason && !p.canStart && !p.buildStale
  return (
    <div className="border border-zinc-200 rounded-2xl p-4">
      <p className="text-sm text-zinc-700">
        That’s everything I need. I’ll go and draft the whole thing — the diagnosis, the approach and
        the actions — and show you what I’ve got. It usually takes a few minutes, and you can stop it
        at any point.
      </p>
      <button
        onClick={p.onStart}
        disabled={p.busy || !p.canStart}
        className="mt-3 text-sm font-semibold px-5 py-2.5 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
      >
        Build it
      </button>

      {p.estimateLine && (
        <p className="mt-2 text-xs text-zinc-500">
          {p.estimateLine}
          {p.hasMean && <span className="text-zinc-400"> (from the last {p.sampleSize} builds)</span>}
        </p>
      )}

      {p.offerEmail && p.canStart && (
        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
          <input
            type="checkbox"
            checked={p.emailWhenDone}
            onChange={(e) => p.onEmailWhenDone(e.target.checked)}
            className="rounded border-zinc-300"
          />
          Email me when it’s done
        </label>
      )}

      {showReason && <p className="mt-2 text-xs text-amber-700">{p.blockedReason}</p>}

      {/* And if the build half could not be re-read, say THAT, rather than showing a disabled
          button with no explanation — CLAUDE.md §18. */}
      {p.buildStale && (
        <p className="mt-2 text-xs text-amber-700">
          I couldn’t check whether the build is ready to start.{' '}
          <button onClick={p.onRetryState} className="underline font-medium">Try again</button>.
        </p>
      )}
    </div>
  )
}

// ── The backstop ─────────────────────────────────────────────────────────────

/**
 * ⚠ A user must never be looking at a page with no way forward — that is what "it crashed"
 * looked like. `phase` is a closed union and every member has a card, so this should be
 * unreachable; it exists because the defect that stopped this product for eight sprints was
 * precisely a combination of conditions nobody had checked was exhaustive.
 */
export function NothingToShowCard({ busy, onReload }: { busy: boolean; onReload: () => void }) {
  return (
    <div className="border-2 border-amber-200 bg-amber-50/50 rounded-2xl p-4">
      <p className="text-sm text-zinc-800">
        Something’s out of step here and I can’t tell you what — but{' '}
        <span className="font-medium">nothing you’ve written is lost</span>; it’s all saved against
        this idea.
      </p>
      <button
        onClick={onReload}
        disabled={busy}
        className="mt-3 text-sm font-semibold px-4 py-2 rounded-full bg-zinc-900 text-white hover:opacity-90 disabled:opacity-40"
      >
        Reload where I am
      </button>
    </div>
  )
}
