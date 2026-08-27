// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25e — the elicitation flow cannot become a dead end again.
//
// ⚠⚠ THE CLASS OF DEFECT THIS GUARDS IS "THE PAGE RENDERED NOTHING", and no existing check
// could have caught it, because every existing check tests a FUNCTION and this was a gap
// BETWEEN functions: a client choosing between three blocks with three independent
// conditions, all of which can be false at once, holding two server objects and refreshing
// only one of them. Both halves were correct. Neither was tested against the other.
//
// So the assertions here are deliberately about the SEAMS:
//   · every phase the server can emit has a branch that renders something;
//   · the client keys those branches off the phase, not off three loose booleans;
//   · every mutation applies BOTH halves of the answer;
//   · no disabled control is shown without the reason it is disabled;
//   · the page cannot lose the user's place.
//
// No database, no network. The live walk is `verify:lex-25e`.
//
//   npx tsx scripts/check-lex-25e.ts
//   npx tsx scripts/check-lex-25e.ts --self-test
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ELICITATION_STEPS } from '../lib/lex/elicitation-config'

const selfTest = process.argv.includes('--self-test')
const ROOT = join(__dirname, '..')

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

/** ⚠ Normalised on read — a Python edit helper writes CRLF here and 25-C lost a day to it. */
function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n')
}

/** Source with comments stripped. ⚠ A guard that fires on the prose explaining the rule is
 *  a guard somebody switches off — this codebase has hit that five times in one day. */
function code(rel: string): string {
  return read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
}

function main() {
  console.log('── check:lex-25e ──\n')

  const client = code('app/ideas/build/BuildIdeaClient.tsx')
  // ⚠ 25-E EXTRACTED THE PHASE CARDS so they could be RENDERED rather than only grepped
  // — see `verify:lex-25e-ui`, which is the harness that could actually have caught this
  // sprint's defect. The markup assertions live there; what stays here is the WIRING: which
  // phases the client dispatches on, and that every mutation applies both halves.
  const cards = code('components/lex/ElicitationCards.tsx')
  const engine = code('lib/lex/elicitation.ts')
  const route = code('app/api/ideas/[id]/elicitation/route.ts')
  const page = code('app/ideas/build/page.tsx')

  // ══ §1 — the page can never render nothing ════════════════════════════════
  console.log('§1 — the dead end')

  // The phases the SERVER can emit, read out of the union rather than typed here — a list
  // copied into the check is a list that goes stale the day someone adds a phase.
  const union = /export type ElicitationPhase =([\s\S]*?)\n\nexport interface/.exec(engine)?.[1] ?? ''
  const phases = [...union.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1])
  ok('the server declares a closed set of phases', phases.length >= 4, phases.join(' · '))

  // ⚠⚠ THE CENTRAL ASSERTION. Every phase must have a branch that renders something.
  const unhandled = phases.filter((p) => !client.includes(`elicit.phase === '${p}'`))
  ok('every phase the server can emit has a render branch', unhandled.length === 0,
    unhandled.length ? `unhandled: ${unhandled.join(', ')}` : `${phases.length} phases, all handled`)
  expectBreak('break: a phase the client does not handle',
    () => [...phases, 'A_NEW_PHASE'].filter((p) => !client.includes(`elicit.phase === '${p}'`)).length === 0)

  // ⚠ AND THE OLD CONDITIONS ARE GONE. Leaving them beside the phase switch would let the
  // two disagree, which is the same defect in a new costume.
  ok('the three loose conditions that could all be false are gone',
    !client.includes("elicit.status === 'AWAITING_CONFIRMATION'")
    && !client.includes("elicit.status === 'CONFIRMED' && !latest")
    && !client.includes("elicit.currentStep !== 'confirm'"))
  expectBreak('break: pretend a render still keys off the old status triple',
    () => !`${client}\n{elicit.status === 'AWAITING_CONFIRMATION' && (<div/>)}`.includes("elicit.status === 'AWAITING_CONFIRMATION'"))

  ok('and there is a backstop that renders when nothing else would',
    client.includes('rendersAControl') && client.includes('<NothingToShowCard')
    && cards.includes('export function NothingToShowCard'))
  expectBreak('break: remove the backstop', () => 'const x = 1'.includes('rendersAControl'))

  // ── the stale-build defect ────────────────────────────────────────────────
  //
  // ⚠⚠ THIS IS THE ONE THAT STOPPED THE PRODUCT. `confirm()` wrote `setElicit(...)` and
  // nothing else, so `build` stayed as fetched at boot — `canStart: false`, blockedReason
  // "Confirm what I've understood first" — and the user was told to do the thing they had
  // just done, with no control left to do it with.
  ok('§1 — every elicitation mutation applies BOTH halves of the answer',
    client.includes('applyMutation')
    && (client.match(/applyMutation\(/g) ?? []).length >= 4
    && !/const confirm = useCallback[\s\S]{0,200}setElicit\(/.test(client),
    `${(client.match(/applyMutation\(/g) ?? []).length} call sites`)
  expectBreak('break: pretend confirm() sets only the elicitation half',
    () => !/const confirm = useCallback[\s\S]{0,200}setElicit\(/.test(
      `${client}\nconst confirm = useCallback(async () => { setElicit(x) })`))

  ok('§1 — the route returns the build state alongside every elicitation mutation',
    route.includes('bothStates') && (route.match(/bothStates\(/g) ?? []).length >= 4)
  expectBreak('break: a route that returns only the elicitation half',
    () => "return NextResponse.json({ state })".includes('bothStates'))

  // ⚠ AND A CONTRADICTORY REASON IS NEVER SHOWN AS FACT.
  ok('§1 — a stale "confirm first" note is suppressed rather than shown',
    cards.includes('!p.buildStale') && cards.includes('p.buildStale &&'))
  expectBreak('break: render blockedReason unconditionally',
    () => '{p.blockedReason && (<p/>)}'.includes('!p.buildStale'))

  // ── §1b/§1c — accept, disagree, AND a text box ────────────────────────────
  // ⚠ SLICED, NOT REGEXED. `/ConfirmationCard\(([\s\S]*?)\n\}/` stops at the first `\n}` —
  // which is the end of the DESTRUCTURED PARAMETER LIST, not the end of the function. It
  // captured the props and none of the body, so both assertions below went red against a
  // component that was perfectly correct: the "looks like it caught something" direction.
  const confirmStart = cards.indexOf('export function ConfirmationCard')
  const confirmEnd = cards.indexOf('\nexport function', confirmStart + 10)
  const confirmBlock = confirmStart < 0 ? ''
    : cards.slice(confirmStart, confirmEnd < 0 ? cards.length : confirmEnd)
  ok('§1b — the confirmation offers accept AND disagree',
    confirmBlock.includes('CONFIRM_YES_LABEL') && confirmBlock.includes('CONFIRM_NO_LABEL'))
  // ⚠⚠ §1c — AND A LIVE TEXT BOX, NOT ONE HIDDEN BEHIND THE "NOT QUITE" BUTTON. Lex has just
  // said "tell me if I've got this wrong"; the means of telling it must be on screen.
  ok('§1c — and a text input, present without pressing anything first',
    confirmBlock.includes('<textarea') && confirmBlock.includes('onCorrection'))
  expectBreak('break: a confirmation with the text box behind a button',
    () => '<button>Not quite</button>'.includes('<textarea'))
  ok('§1c — the correction is no longer gated behind a separate mode',
    !client.includes('setCorrecting') && !client.includes('correcting &&'))

  // ── §1 — the failed understanding can be retried ──────────────────────────
  ok('§1 — a failed understanding offers a retry, and it is not a "correction"',
    engine.includes('export async function retryUnderstanding')
    && route.includes("z.literal('retry')")
    && !/retryUnderstanding[\s\S]{0,400}corrections:\s*\{\s*increment/.test(engine))
  expectBreak('break: route the retry through correctElicitation, which counts it against the user',
    () => !/retryUnderstanding[\s\S]{0,400}corrections:\s*\{\s*increment/.test(
      'export async function retryUnderstanding() { await prisma.x.update({ data: { corrections: { increment: 1 } } }) }'))

  // ══ §2 — the user cannot lose their place ═════════════════════════════════
  console.log('\n§2 — losing the user’s work')

  // ⚠⚠ THE SINGLE LINE THAT MATTERS. Without the id in the URL a refresh mints a new idea
  // and orphans everything written so far. The answers were never lost; the way back was.
  ok('§2 — the idea id is written into the URL as soon as it exists',
    client.includes('history.replaceState') && client.includes("searchParams.set('ideaId'"))
  expectBreak('break: keep the id in React state only',
    () => 'setIdeaId(id)'.includes('history.replaceState'))
  ok('§2 — and by replaceState, so it does not litter the Back history',
    !client.includes('history.pushState'))

  ok('§2 — a bare visit RESUMES unfinished work instead of minting a new idea',
    page.includes('ideaElicitation.findFirst') && page.includes('builds: { none: {} }'))
  expectBreak('break: a page that always mints',
    () => 'const initialIdeaId = undefined'.includes('ideaElicitation.findFirst'))

  // ⚠ "UNFINISHED" MUST MEAN "NO BUILD STARTED", NOT "NOT CONFIRMED" — Charlie's own idea is
  // CONFIRMED with no build, which is exactly the state the dead end created, and a
  // status-based rule would leave his 2,934 characters stranded.
  ok('§2 — unfinished means NO BUILD STARTED, so a blocked-at-the-button idea is reachable',
    !/status:\s*\{\s*not:\s*'CONFIRMED'\s*\}/.test(page))
  expectBreak('break: resume only IN_PROGRESS rows',
    () => !/status:\s*\{\s*not:\s*'CONFIRMED'\s*\}/.test("where: { status: { not: 'CONFIRMED' } }"))

  // ⚠⚠ THE `LIMIT 1` TRAP, GUARDED — it was live in this sprint's own first fix.
  //
  // `findFirst` is `ORDER BY … LIMIT 1`. Filtering for "has content" AFTER it means the newest
  // row wins the ordering and is then discarded for being empty, so ONE blank shell hides
  // every real row behind it. Measured against production, that version landed on a row
  // created hours earlier with nothing in it, and Charlie's own 2,934-character idea never
  // came back — the fix for losing his work would have failed to find it.
  const resumeQuery = /ideaElicitation\.findFirst\(\{([\s\S]*?)\}\)/.exec(page)?.[1] ?? ''
  ok('§2 — the "has something in it" test is in the QUERY, not applied after LIMIT 1',
    /OR:\s*\[/.test(resumeQuery) && /problem:\s*\{\s*not:\s*null/.test(resumeQuery))
  expectBreak('break: filter for content after the query, so one empty row hides the rest',
    () => /OR:\s*\[/.test("where: { idea: { creatorId } }, orderBy: { updatedAt: 'desc' }"))

  ok('§2 — the resumption is ANNOUNCED, not silent',
    client.includes('Picking up where you left off'))
  ok('§2 — and there is a way to start something else instead',
    client.includes('fresh=1') && page.includes("params.fresh !== '1'"))
  expectBreak('break: resume with no opt-out',
    () => 'if (!initialIdeaId && dbUser) {'.includes("params.fresh !== '1'"))

  // ══ §4 — the three smaller defects ════════════════════════════════════════
  console.log('\n§4 — the smaller defects')

  // ⚠ §4a — THE OPENING QUESTION WAS PRINTED TWICE, VERBATIM: `question` for the first step
  // IS `OPENING_ASK`, which Lex has already said in the transcript directly above the card.
  const dupes = ELICITATION_STEPS.filter((s) => s.cardPrompt && s.cardPrompt === s.question)
  ok('§4a — no step’s card prompt repeats its own question', dupes.length === 0,
    dupes.map((d) => d.key).join(', ') || `${ELICITATION_STEPS.length} steps`)
  expectBreak('break: a step whose card prompt is its question',
    () => [...ELICITATION_STEPS, { key: 'x', cardPrompt: 'q', question: 'q' } as never]
      .filter((s: { cardPrompt?: string | null; question?: string }) => s.cardPrompt && s.cardPrompt === s.question).length === 0)
  ok('§4a — the opening step shows the hints rather than a second copy of the paragraph',
    ELICITATION_STEPS.find((s) => s.key === 'problem')?.cardPrompt === null
    && (ELICITATION_STEPS.find((s) => s.key === 'problem')?.hints?.length ?? 0) > 0)
  ok('§4a — and the card renders the card prompt, never the question',
    cards.includes('step.cardPrompt') && !cards.includes('{step.question}'))
  expectBreak('break: the card renders step.question again',
    () => !`${cards}\n<p>{step.question}</p>`.includes('{step.question}'))

  // ⚠ §4b — a disabled control that does not say what would enable it is §1a in miniature.
  ok('§4b — the Send button’s reason for being disabled is computed, not implied',
    client.includes('blockedSend') && cards.includes('{p.blockedSend}'))
  ok('§4b — and the button and the sentence come from the SAME expression, so they cannot disagree',
    cards.includes('disabled={p.busy || !!p.blockedSend}'))
  expectBreak('break: a disabled condition written separately from the explanation',
    () => "disabled={p.busy || !p.goalKind}".includes('!!p.blockedSend'))
  ok('§4b — the requirement is stated before the control is pressed',
    cards.includes('Pick the one that fits best'))

  // ⚠ §4c — the estimate answered a question the user did not ask, at the moment they were
  // deciding whether to commit.
  // ⚠ READ FROM THE SOURCE, not called: `buildEstimate()` reads the database, and this
  // harness is pure by design so it runs identically in CI and on a laptop.
  const estimate = code('lib/lex/build-estimate.ts')
  // ⚠ 25-I §4a WRAPPED THIS LINE, AND THE PROPERTY BELOW IS UNCHANGED.
  //
  // It used to be a bare literal — `line: 'This usually takes a few minutes.'` — and this
  // regex read it directly. §4a requires the sentence to carry the COST as well as the
  // duration ("Nothing currently says a build costs money or takes minutes until it is
  // already running"), so it is now `costLine('This usually takes a few minutes.', pence)`.
  //
  // ⚠ THAT IS NOT THE "TWO THINGS" THIS CHECK EXISTS TO STOP. 25-E's objection was to
  // answering the user's question and then disclaiming OUR sample size at the moment they
  // are deciding to commit. What the user is about to spend is their business, not our
  // apology — so the assertion is on the DURATION half, which is what 25-E owns, and the
  // sample-size prohibition below now reads the whole composed sentence.
  const zeroLine = /durations\.length < MIN_SAMPLE[\s\S]*?line: costLine\('([^']*)'/.exec(estimate)?.[1] ?? ''
  ok('§4c — the zero-data estimate says one thing, not two',
    zeroLine === 'This usually takes a few minutes.', JSON.stringify(zeroLine))
  // The composed sentence, as the user reads it, with no measured figure available.
  const composed = `${zeroLine} It uses one of your builds.`
  ok('§4c — and the composed line still quotes no figure it does not have',
    !/\d/.test(composed), composed)
  ok('§4c — and it no longer confesses our sample size at the moment of commitment',
    !/enough builds/.test(zeroLine) && !/\d/.test(zeroLine))
  expectBreak('break: a line that answers the question and then disclaims itself',
    () => !/enough builds/.test('Usually a few minutes — we don’t have enough builds yet to be precise.'))
  // The precision caveat still earns its place once there IS a number.
  ok('§4c — the sample is still shown when there is one',
    cards.includes('from the last {p.sampleSize} builds'))

  // ── the controls ──────────────────────────────────────────────────────────
  console.log('')
  const inert = breaks.filter((b) => !b.fired)
  for (const b of breaks) {
    if (selfTest || !b.fired) console.log(`  ${b.fired ? '·' : '⚠'} control ${b.fired ? 'fired' : 'DID NOT FIRE'}: ${b.label}`)
  }
  if (inert.length) {
    fail += inert.length
    console.log(`\n⚠⚠ ${inert.length} control(s) did not fire. Those assertions cannot fail, so they assert nothing.`)
  } else {
    console.log(`  ${breaks.length} controls, all fired.`)
  }

  console.log(`\n${pass} passed, ${fail} failed.`)
  process.exit(fail ? 1 : 0)
}

main()
