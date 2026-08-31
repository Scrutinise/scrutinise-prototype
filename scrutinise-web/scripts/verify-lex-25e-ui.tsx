// ─────────────────────────────────────────────────────────────────────────────
// verify:lex-25e-ui — RENDER EVERY PHASE AND ASSERT A USABLE CONTROL COMES OUT.
//
// ⚠⚠ THIS IS THE ONLY KIND OF CHECK THAT COULD HAVE CAUGHT THE DEFECT.
//
// `check:lex-25e` reads the source; `verify:lex-25e` walks the server. Neither would have
// found it, because the source contained a perfectly good confirmation block and the server
// returned perfectly good state. The failure was that at one combination of the two objects
// the page held, **the rendered output contained no control at all** — and there is exactly
// one way to see that: render it and look at what comes out.
//
// Eight sprints of green checks sat on top of that. `IdeaBuild` was empty.
//
// ⚠ SO THE ASSERTIONS ARE ON THE MARKUP, NOT ON THE SOURCE. Every one below renders a real
// component with real props and inspects the HTML — an ENABLED button, a textarea, the words
// a user reads. A grep can tell you a `<button>` is written down somewhere in the file; it
// cannot tell you the branch containing it is reachable, and that distinction is this entire
// sprint.
//
// ⚠ WHAT THIS IS NOT: a browser walk. Static markup covers the SHAPE and the COPY of the
// first paint. It does not cover click handling, effects, polling or layout. Reporting it as
// a walk would be exactly the dishonesty these guards exist to prevent — a human completing
// the flow is still the acceptance criterion (BRIEF_25E §5).
//
// Usage: npx tsx scripts/verify-lex-25e-ui.tsx
// ─────────────────────────────────────────────────────────────────────────────

// ⚠ 25-K — THIS IMPORT WAS MISSING AND THE HARNESS HAD NOT RUN SINCE IT WAS WRITTEN.
// `tsx` compiles these scripts with the CLASSIC JSX runtime, so every `<Card />` becomes
// `React.createElement` and the file died on `ReferenceError: React is not defined` before
// its first assertion. The two harnesses beside it (`verify-lex-25g-ui`,
// `verify-my-ideas-ui`) both import React and both run; this one did not and does not
// appear in any sprint's reported results. A check that cannot execute is not a check.
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  QuestionCard, UnderstandingFailedCard, ConfirmationCard, StartBuildCard, NothingToShowCard,
  type StepView,
} from '../components/lex/ElicitationCards'
import { ELICITATION_STEPS, GOAL_KINDS } from '../lib/lex/elicitation-config'

let pass = 0
let fail = 0
function ok(label: string, condition: boolean, detail?: string) {
  if (condition) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

const breaks: { label: string; fired: boolean }[] = []
function expectBreak(label: string, propertyHolds: () => boolean) {
  let held: boolean
  try { held = propertyHolds() } catch { held = false }
  breaks.push({ label, fired: !held })
}

const noop = () => {}

function stepFor(key: string): StepView {
  const d = ELICITATION_STEPS.find((s) => s.key === key)!
  return {
    key: d.key, label: d.label, question: d.question,
    cardPrompt: d.cardPrompt ?? null, hints: d.hints ?? [],
    optional: !!d.optional, done: false, answer: null,
  }
}

/**
 * Buttons the user can actually press — `disabled` ones do not count.
 *
 * ⚠⚠ THE FIRST VERSION OF THIS FUNCTION REPORTED EVERY BUTTON AS DISABLED, and it failed in
 * the direction that looks like it caught something — five assertions went red against
 * components that were perfectly correct, which is exactly the shape that sends a session
 * hunting a bug in working code.
 *
 * The cause: every button here carries the Tailwind class `disabled:opacity-40`, and a
 * lookahead for `\sdisabled` matches that class name inside the `class` attribute. The
 * attribute has to be matched AS an attribute — `disabled` followed by `=`, whitespace or
 * `>` — so that `disabled:` (a class prefix) is not mistaken for it.
 */
function enabledButtons(html: string): string[] {
  return [...html.matchAll(/<button(?![^>]*\sdisabled(?:=|\s|>))[^>]*>([\s\S]*?)<\/button>/g)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** Anything the user can act on: a live button, or somewhere to type. */
function usableControls(html: string): number {
  return enabledButtons(html).length
    + (html.match(/<textarea/g) ?? []).length
    + (html.match(/<input(?![^>]*\sdisabled(?:=|\s|>))/g) ?? []).length
}

function text(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}

function main() {
  console.log('── verify:lex-25e-ui (render) ──\n')
  console.log('§1 — every phase puts something on screen the user can use\n')

  // ── PHASE: QUESTION ───────────────────────────────────────────────────────
  const q1 = renderToStaticMarkup(
    <QuestionCard
      step={stepFor('problem')} goalKinds={GOAL_KINDS.map((g) => ({ key: g.key, label: g.label }))}
      text="" onText={noop} goalKind="" onGoalKind={noop}
      ruledOut="" onRuledOut={noop} readingUrl="" onReadingUrl={noop}
      blockedSend="Write something first — anything at all."
      busy={false} onSend={noop} onSkip={noop}
    />,
  )
  ok('QUESTION — the user can type', usableControls(q1) > 0, `${usableControls(q1)} controls`)
  // ⚠ §4a — the opening paragraph must appear ONCE. Lex has already said it above this card.
  ok('§4a — the card does NOT reprint the question Lex just asked',
    !text(q1).includes('The outlying details are often what change the whole approach'),
    'the eighty-word opening ask is not repeated')
  expectBreak('break: a card that prints the full question again',
    () => !text(renderToStaticMarkup(
      <QuestionCard
        step={{ ...stepFor('problem'), cardPrompt: stepFor('problem').question }}
        goalKinds={[]} text="" onText={noop} goalKind="" onGoalKind={noop}
        ruledOut="" onRuledOut={noop} readingUrl="" onReadingUrl={noop}
        blockedSend={null} busy={false} onSend={noop} onSkip={noop}
      />,
    )).includes('The outlying details are often what change the whole approach'))
  // ⚠ §4b — a disabled Send must say what would enable it, IN THE RENDERED OUTPUT.
  ok('§4b — a disabled Send explains itself on screen',
    text(q1).includes('Write something first'))
  expectBreak('break: a disabled Send with no reason rendered',
    () => text(renderToStaticMarkup(
      <QuestionCard
        step={stepFor('problem')} goalKinds={[]} text="" onText={noop} goalKind="" onGoalKind={noop}
        ruledOut="" onRuledOut={noop} readingUrl="" onReadingUrl={noop}
        blockedSend={null} busy={false} onSend={noop} onSkip={noop}
      />,
    )).includes('Write something first'))

  const q2 = renderToStaticMarkup(
    <QuestionCard
      step={stepFor('goal')} goalKinds={GOAL_KINDS.map((g) => ({ key: g.key, label: g.label }))}
      text="" onText={noop} goalKind="" onGoalKind={noop}
      ruledOut="" onRuledOut={noop} readingUrl="" onReadingUrl={noop}
      blockedSend="Pick one of the four above to carry on."
      busy={false} onSend={noop} onSkip={noop}
    />,
  )
  ok('§4b — question 2 states its requirement BEFORE the button is pressed',
    text(q2).includes('Pick the one that fits best') && text(q2).includes('Pick one of the four above'))
  ok('§4b — and all four categories are pressable', enabledButtons(q2).length >= 4,
    `${enabledButtons(q2).length} enabled buttons`)

  // ── PHASE: UNDERSTANDING_FAILED ───────────────────────────────────────────
  //
  // ⚠⚠ THIS PHASE RENDERED NOTHING AT ALL. The question card was suppressed on
  // `currentStep === 'confirm'`, the confirmation needed AWAITING_CONFIRMATION, the build
  // card needed CONFIRMED. Lex apologised and said "try again in a moment", and there was no
  // way to try again.
  const uf = renderToStaticMarkup(<UnderstandingFailedCard busy={false} onRetry={noop} />)
  ok('UNDERSTANDING_FAILED — there is a way to try again', enabledButtons(uf).includes('Try again'))
  ok('   …and the user is told their answers are safe',
    text(uf).includes('Everything you’ve told me is saved') || text(uf).includes("Everything you've told me is saved"))
  expectBreak('break: a phase that renders only an apology',
    () => enabledButtons('<div><p>Sorry, try again in a moment.</p></div>').includes('Try again'))

  // ── PHASE: AWAITING_CONFIRMATION ──────────────────────────────────────────
  const conf = renderToStaticMarkup(
    <ConfirmationCard correction="" onCorrection={noop} busy={false} onConfirm={noop} onCorrect={noop} />,
  )
  const confButtons = enabledButtons(conf)
  ok('§1a — AWAITING_CONFIRMATION — there IS a way to confirm',
    confButtons.some((b) => /That’s right|That's right/.test(b)), confButtons.join(' | '))
  // ⚠ §1b — and a way to disagree. The copy invites a correction; the means must exist.
  ok('§1b — and a way to say "not quite"',
    /Not quite/.test(conf))
  // ⚠ §1c — AND SOMEWHERE TO TYPE, without pressing anything first. Charlie: "there's
  // nowhere to enter a response if I disagreed with any part of it".
  ok('§1c — and somewhere to type, present without pressing anything first',
    (conf.match(/<textarea/g) ?? []).length === 1)
  expectBreak('break: a confirmation whose text box only appears after a click',
    () => (('<div><button>Not quite</button></div>').match(/<textarea/g) ?? []).length === 1)
  ok('§1 — the accept control is disabled by nothing but a request in flight',
    enabledButtons(renderToStaticMarkup(
      <ConfirmationCard correction="" onCorrection={noop} busy={false} onConfirm={noop} onCorrect={noop} />,
    )).some((b) => /right/.test(b)))

  // ── PHASE: CONFIRMED ──────────────────────────────────────────────────────
  const ready = renderToStaticMarkup(
    <StartBuildCard
      canStart blockedReason={null} buildStale={false}
      estimateLine="This usually takes a few minutes." allowanceLine={null} sampleSize={0} hasMean={false}
      offerEmail emailWhenDone={false} onEmailWhenDone={noop}
      busy={false} onStart={noop} onRetryState={noop}
    />,
  )
  ok('CONFIRMED — "Build it" is pressable once the elicitation is confirmed',
    enabledButtons(ready).includes('Build it'), enabledButtons(ready).join(' | '))
  ok('§4c — the estimate says one thing, and quotes no figure it does not have',
    text(ready).includes('This usually takes a few minutes') && !text(ready).includes('enough builds'))
  expectBreak('break: the old two-sentence estimate',
    () => !text(renderToStaticMarkup(
      <StartBuildCard
        canStart blockedReason={null} buildStale={false}
        estimateLine="Usually a few minutes — we don’t have enough builds yet to be precise." allowanceLine={null}
        sampleSize={0} hasMean={false} offerEmail={false} emailWhenDone={false}
        onEmailWhenDone={noop} busy={false} onStart={noop} onRetryState={noop}
      />,
    )).includes('enough builds'))

  // ⚠⚠⚠ THE EXACT STATE CHARLIE WAS STUCK IN, RENDERED.
  //
  // A CONFIRMED elicitation beside a build object still carrying the boot-time answer:
  // `canStart: false`, blockedReason "Confirm what I've understood first". For eight sprints
  // this produced a greyed-out button and a note demanding he do what he had just done, and
  // NOTHING ELSE on the page. The route now makes the combination unreachable; this asserts
  // that even if it occurs, the user is not told a falsehood and is not left stuck.
  const stuck = renderToStaticMarkup(
    <StartBuildCard
      canStart={false}
      blockedReason="Confirm what I’ve understood first — I won’t build on a reading you haven’t seen."
      buildStale
      estimateLine="This usually takes a few minutes." allowanceLine={null} sampleSize={0} hasMean={false}
      offerEmail={false} emailWhenDone={false} onEmailWhenDone={noop}
      busy={false} onStart={noop} onRetryState={noop}
    />,
  )
  ok('⚠ the stale "confirm first" note is NOT shown to a user who has confirmed',
    !text(stuck).includes('Confirm what I’ve understood first'))
  ok('   …and they are given something to do instead of a dead button',
    usableControls(stuck) > 0 && text(stuck).includes('couldn’t check whether the build is ready'),
    enabledButtons(stuck).join(' | '))
  expectBreak('break: render the contradictory reason anyway',
    () => !text(renderToStaticMarkup(
      <StartBuildCard
        canStart={false}
        blockedReason="Confirm what I’ve understood first — I won’t build on a reading you haven’t seen."
        buildStale={false}
        estimateLine={null} allowanceLine={null} sampleSize={0} hasMean={false}
        offerEmail={false} emailWhenDone={false} onEmailWhenDone={noop}
        busy={false} onStart={noop} onRetryState={noop}
      />,
    )).includes('Confirm what I’ve understood first'))

  // ── the backstop ──────────────────────────────────────────────────────────
  const backstop = renderToStaticMarkup(<NothingToShowCard busy={false} onReload={noop} />)
  ok('the backstop offers a way out and says nothing is lost',
    usableControls(backstop) > 0 && text(backstop).includes('nothing you’ve written is lost'))

  // ── controls ──────────────────────────────────────────────────────────────
  console.log('')
  const inert = breaks.filter((b) => !b.fired)
  for (const b of breaks) if (!b.fired) console.log(`  ⚠ control DID NOT FIRE: ${b.label}`)
  if (inert.length) {
    fail += inert.length
    console.log(`\n⚠⚠ ${inert.length} control(s) did not fire.`)
  } else {
    console.log(`  ${breaks.length} controls, all fired.`)
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  console.log('\n⚠ A RENDER assertion, not a browser walk: it proves a usable control exists at')
  console.log('  every phase. It does not prove a click works. The human run is the criterion.')
  process.exit(fail ? 1 : 0)
}

main()
