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

import {
  CONFIRM_YES_LABEL, CONFIRM_NO_LABEL, CORRECTION_PROMPT, UPLOAD_ENCOURAGEMENT,
  PROBLEM_INTRO, BACKGROUND_INTRO, BUILD_OFFER_MESSAGE,
} from '@/lib/lex/elicitation-config'

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
  text: string; onText: (v: string) => void
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
  /**
   * ⚠⚠ 25-K §2 — FILE AND LINK UPLOAD LIVES IN THE COMPOSER, AS A "+".
   *
   * Charlie went looking for it where every chat interface puts it — beside the box he was
   * typing in — and it was not there. It was a separate panel that appeared on ONE of the
   * four questions, and a "Choose File" control further down the page. A control the user
   * cannot find is a control that does not exist.
   *
   * The node is passed in rather than imported so these cards stay pure and renderable:
   * `YourMaterial` fetches, and a card that fetches cannot be rendered in isolation, which
   * is the whole reason this file exists.
   */
  attachPanel?: React.ReactNode
  /** How many documents and links are already attached. A count, so "+" is not a mystery. */
  attachCount?: number
  attachOpen?: boolean
  onToggleAttach?: () => void
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

      {/* 26-B §2 — the four goal buttons stood here ("A change in the law" · "A change in how a
          rule is applied" · "Pressure on an institution" · "Not sure yet"). Removed: the method
          comes out of the kernel, not in before it. The box below is the whole question. */}

      <textarea
        value={p.text}
        onChange={(e) => p.onText(e.target.value)}
        rows={step.key === 'problem' ? 8 : 4}
        placeholder={
          step.key === 'goal' ? 'What would be different afterwards — the outcome, in your own words.'
            : step.key === 'ownKnowledge' ? 'Anything else you know — and use the + for anything I should read. (optional)'
              : 'In your own words…'
        }
        className="mt-3 w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 leading-relaxed"
      />

      {/* 26-B §2 DECIDED — the "already ruled out" box stood here and is gone: it asked for a view
          of the remedy before the analysis. The `reading` URL box is gone with its step: it captured
          an address and read nothing. Reading is the "+", and the merged step says so. */}
      {step.key === 'ownKnowledge' && (
        <p className="mt-2 text-sm text-zinc-800 rounded-lg border-2 border-zinc-900 px-3 py-2">
          <span className="font-semibold">Have something I could read?</span> {UPLOAD_ENCOURAGEMENT}
        </p>
      )}

      <div className="flex items-center gap-2 mt-3">
        {/* ⚠ 25-K §2 — THE "+" IS FIRST IN THE ROW, the way every chat composer puts it,
            because "where do I attach a file" is answered by muscle memory or not at all.
            It is on EVERY question, not only the one that asks about reading: a user who
            has the document in front of them at question one should not have to remember
            it until question four.

            ⚠ IT CARRIES A COUNT AND A WORD, not a bare glyph. Charlie is colour blind
            (docs/CLAUDE.md §21): "open" versus "closed" cannot be a hue, so the label says
            which, and the count says whether anything is in there. */}
        {p.onToggleAttach && (
          <button
            type="button"
            onClick={p.onToggleAttach}
            aria-expanded={!!p.attachOpen}
            title="Add a document or a link for me to read — a report, a letter, an article, a web page"
            className={`text-sm font-medium px-3 py-2 rounded-full border-2 inline-flex items-center gap-1.5 ${
              p.attachOpen
                ? 'bg-zinc-900 border-zinc-900 text-white'
                : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            <span aria-hidden className="text-base leading-none">{p.attachOpen ? '−' : '+'}</span>
            <span>
              {p.attachOpen ? 'Close' : 'Add a file or link'}
              {p.attachCount ? ` (${p.attachCount})` : ''}
            </span>
          </button>
        )}
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

      {/* The panel opens IN the composer, under the row that opened it — not somewhere
          else on the page, which is the arrangement that lost it in the first place. */}
      {p.attachOpen && p.attachPanel && (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">{p.attachPanel}</div>
      )}
    </div>
  )
}

// ── PHASE: INTAKE — 26-C §2, ONE box (addendum §14: one, not two) ────────────

export interface IntakeCardProps {
  problem: string; onProblem: (v: string) => void
  busy: boolean
  onSend: () => void
  attachPanel?: React.ReactNode
  attachCount?: number
  attachOpen?: boolean
  onToggleAttach?: () => void
}

/**
 * 26-C addendum §14b — the second box's own encouragement folded in as a fifth bullet,
 * rather than a second field. `background` (the second textarea) is retired: everything
 * goes in the one box, and Lex sorts it (§2a's own principle, applied one field further).
 */
const PROBLEM_HINTS = [
  'what is going wrong, and for whom',
  'what you have seen yourself',
  'why it matters',
  'what you think is really going on',
  BACKGROUND_INTRO,
]

/**
 * 26-C §2 (addendum §14) — THE WHOLE OF THE NEW-IDEA SCREEN'S FIRST TURN. One box, two
 * thirds of the width; the instruction and five bullets beside it, one third (§14f).
 *
 * ⚠ §14c — the placeholder and the instruction used to say the same sentence twice. The
 * instruction (`PROBLEM_INTRO`) stays where it always was, above the bullets; the
 * placeholder is now just "In your words…", which is not a second copy of anything.
 */
export function IntakeCard(p: IntakeCardProps) {
  // §14d — bold the opening words only. Split rather than a second hand-typed string,
  // so the two constants cannot drift apart.
  const [introLead, ...introRestParts] = PROBLEM_INTRO.split('The first step')
  const introRest = introRestParts.join('The first step')
  return (
    <div className="border border-zinc-200 rounded-2xl p-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <textarea
            value={p.problem}
            onChange={(e) => p.onProblem(e.target.value)}
            rows={12}
            placeholder="In your own words…"
            className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 leading-relaxed"
          />
          {/* §14g — the file/link control, on the one box that is left. Every document
              the platform has ever read came in through this control. */}
          {p.onToggleAttach && (
            <div className="mt-2">
              <button
                type="button"
                onClick={p.onToggleAttach}
                aria-expanded={!!p.attachOpen}
                title="Add a document or a link for me to read — a report, a letter, an article, a web page"
                className={`text-sm font-medium px-3 py-2 rounded-full border-2 inline-flex items-center gap-1.5 ${
                  p.attachOpen
                    ? 'bg-zinc-900 border-zinc-900 text-white'
                    : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
                }`}
              >
                <span aria-hidden className="text-base leading-none">{p.attachOpen ? '−' : '+'}</span>
                <span>
                  {p.attachOpen ? 'Close' : 'Add a file or link'}
                  {p.attachCount ? ` (${p.attachCount})` : ''}
                </span>
              </button>
              {p.attachOpen && p.attachPanel && (
                <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">{p.attachPanel}</div>
              )}
            </div>
          )}
        </div>
        <div>
          <p className="text-sm text-zinc-700 leading-relaxed">
            {introLead}
            <span className="font-semibold">The first step</span>
            {introRest}
          </p>
          <ul className="mt-2 text-xs text-zinc-500 list-disc list-inside space-y-1">
            {PROBLEM_HINTS.map((h) => <li key={h}>{h}</li>)}
          </ul>
        </div>
      </div>

      {/* §14e — "Write something in the first box." removed: the disabled state of
          Send already says this, and a sentence repeating a disabled button is a
          sentence nobody needed. */}
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={p.onSend}
          disabled={p.busy || !p.problem.trim()}
          className="text-sm font-semibold px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 inline-flex items-center gap-2"
        >
          {p.busy && <Spinner className="w-3.5 h-3.5" />}
          Send
        </button>
      </div>
    </div>
  )
}

// ── PHASE: REPLY — Lex's (at most two) follow-up turns, one box each time ─────

export interface ReplyCardProps {
  /** Lex's own words for this turn — already in the transcript above; shown here too
   *  as the label, so the box is never mysterious out of context. */
  question: string
  text: string; onText: (v: string) => void
  busy: boolean
  onSend: () => void
  onSkip: () => void
  attachPanel?: React.ReactNode
  attachCount?: number
  attachOpen?: boolean
  onToggleAttach?: () => void
}

/**
 * 26-C §3a — ONE OF LEX'S (AT MOST TWO) REPLIES. The old per-step cards are gone; this is
 * the single shape every follow-up question uses, whether it is the problem-gate press or
 * the closing "anything more?" question — the difference is in what Lex said, which is
 * already the bubble above this card, not in the control.
 */
export function ReplyCard(p: ReplyCardProps) {
  return (
    <div className="border border-zinc-200 rounded-2xl p-4">
      {/* Restated here, not only in the transcript above — a card must stand on its own
          if a reader ever lands on it without the scroll history (§25 of CLAUDE.md: a
          value a screen depends on must be read where the screen reads it). */}
      <p className="text-sm text-zinc-600 mb-2">{p.question}</p>
      <textarea
        value={p.text}
        onChange={(e) => p.onText(e.target.value)}
        rows={5}
        placeholder="In your own words…"
        className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 leading-relaxed"
      />
      <div className="flex items-center gap-2 mt-3">
        {p.onToggleAttach && (
          <button
            type="button"
            onClick={p.onToggleAttach}
            aria-expanded={!!p.attachOpen}
            title="Add a document or a link for me to read — a report, a letter, an article, a web page"
            className={`text-sm font-medium px-3 py-2 rounded-full border-2 inline-flex items-center gap-1.5 ${
              p.attachOpen
                ? 'bg-zinc-900 border-zinc-900 text-white'
                : 'bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50'
            }`}
          >
            <span aria-hidden className="text-base leading-none">{p.attachOpen ? '−' : '+'}</span>
            <span>
              {p.attachOpen ? 'Close' : 'Add a file or link'}
              {p.attachCount ? ` (${p.attachCount})` : ''}
            </span>
          </button>
        )}
        <button
          onClick={p.onSend}
          disabled={p.busy || !p.text.trim()}
          className="text-sm font-semibold px-4 py-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 inline-flex items-center gap-2"
        >
          {p.busy && <Spinner className="w-3.5 h-3.5" />}
          Send
        </button>
        <button
          onClick={p.onSkip}
          disabled={p.busy}
          className="text-sm font-medium px-3 py-2 rounded-full border border-zinc-300 text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
        >
          Nothing more to add
        </button>
      </div>
      {p.attachOpen && p.attachPanel && (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">{p.attachPanel}</div>
      )}
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
  /**
   * ══ 25-N §1d — THE BALANCE, AT THE MOMENT OF DECISION ═══════════════════════
   *
   * ⚠⚠ 25-M §4 BUILT THIS AND WIRED IT INTO EXACTLY ONE PLACE: the re-run dialogue. The card
   * that says "Build it" — the other moment a user commits to spending a build, and the FIRST
   * one they meet — never received it. §1d: *"It was built; it is not appearing at the moment
   * of decision."* The line is the same sentence from the same `readAllowance`, so the two
   * screens cannot quote different balances.
   */
  allowanceLine: string | null
  sampleSize: number
  hasMean: boolean
  offerEmail: boolean
  emailWhenDone: boolean
  /**
   * ⚠ 25-T §1h — WHICH DRIVER IS IN FORCE, because it decides whether "Email me when it's done"
   * is a promise the architecture can keep. Under `client` the build is driven by this tab
   * polling every three seconds, so walking away stops it.
   */
  driver?: 'worker' | 'client'
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
      {/* 26-C §3b/§3c — verbatim, and no number is hardcoded (see `BUILD_OFFER_MESSAGE`'s
          own comment): the allowance sentence right below this, from the same `readAllowance`
          the re-run dialogue quotes, is the one place a figure is ever printed. */}
      <p className="text-sm text-zinc-700">{BUILD_OFFER_MESSAGE}</p>
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

      {/* §1d — beside the price, before the press. Not a warning and not a colour: a
          sentence, where somebody deciding whether to spend it is already looking. */}
      {p.allowanceLine && (
        <p className="mt-1.5 text-xs font-medium text-zinc-700">{p.allowanceLine}</p>
      )}

      {/* ══════════ 25-T §1h — A PROMISE THE ARCHITECTURE CAN ONLY SOMETIMES KEEP ══════════
          §1h: *"This checkbox is currently a promise the architecture cannot keep — it tells the
          user they may walk away, and walking away stops the build."*

          ⚠⚠ AND THAT IS WORSE THAN A MISSING FEATURE. "Email me when it's done" is read as
          permission to close the laptop. Under the client driver the build is this tab polling
          every three seconds, so acting on the permission is what breaks the build — and the
          user would have no way to connect the two.

          ⚠ SO THE CHECKBOX IS ONLY OFFERED WHERE IT IS TRUE. Under `client` the page says what
          is actually required instead. Both revert on their own the moment the driver flips:
          nothing here needs changing again, because it reads the driver rather than a flag
          somebody has to remember to turn over. */}
      {p.offerEmail && p.canStart && (
        p.driver === 'worker' ? (
          <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600 cursor-pointer">
            <input
              type="checkbox"
              checked={p.emailWhenDone}
              onChange={(e) => p.onEmailWhenDone(e.target.checked)}
              className="rounded border-zinc-300"
            />
            Email me when it’s done — you can close this tab
          </label>
        ) : (
          <p className="mt-2 text-xs text-amber-800 bg-amber-50/70 border border-amber-200 rounded-lg px-2.5 py-1.5">
            ⚠ Keep this tab open until it finishes. This build runs from the page, so closing the
            tab or switching away for a long time will stop it part-way. It picks up where it left
            off when you come back.
          </p>
        )
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
