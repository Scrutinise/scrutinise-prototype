// ─────────────────────────────────────────────────────────────────────────────
// CCW-B22 §1 (addendum) — THE OPPONENT IS NOT A SCEPTIC. HE IS A PUBLIC LAWYER WHO HAS
// ALREADY WRITTEN HIS ARGUMENT.
//
// Charlie, and it changes what the test is for:
//
//   *"The adversarial pass currently reads as a generalist sceptic. On this programme that is
//    the wrong opponent. The question is not whether the proposal will annoy anyone — it is
//    WHERE A FIRST-RATE LAWYER WOULD ATTACK IT, and whether the plan closes that route."*
//
// ══ ⚠⚠ WHY THE OLD PASS COULD NOT FIND WHAT MATTERS ══════════════════════════════════════
//
// A generalist sceptic asks "will this be unpopular, is this hard, what could go wrong". Those
// are answerable and mostly already answered elsewhere in the build. **A prepared opponent asks
// a different question entirely: given this text, what is the narrowest reading that defeats
// its purpose while appearing to comply with it?**
//
// The distinction is not stylistic. Every route the report has since found against the Human
// Rights Act measure — six of them — **works by reading the Act narrowly rather than by
// refusing to apply it.** A pass looking for refusal finds nothing, because refusal is not
// what a court does. It reads.
//
// ⚠ AND THE DOCTRINAL FACT THAT MAKES THIS CONCRETE IS DELIBERATELY *NOT* IN THE PROMPT BY
// DEFAULT. Since 2013 the senior judiciary has been moving rights protection off the Human
// Rights Act and onto the common law, in reported judgments — Osborn, Kennedy, A v BBC,
// UNISON. Repeal does not restore 1997, because the courts have spent a decade ensuring it
// would not: **the programme is not facing inertia, it is facing a prepared defence.**
//
// Handing the pass that paragraph would tell it the answer for one measure and prove nothing
// about whether the reframing works. So `doctrinalContext` is an OPTIONAL, SEPARATELY LABELLED
// input, and the first run is made WITHOUT it — see `b23-prepared-opponent.ts`, which runs
// both arms and reports whether the persona alone reaches the common-law migration. A pass
// that only finds the answer when handed the answer is not a pass.
// ─────────────────────────────────────────────────────────────────────────────

import { callJson, llmFailed, type LlmUsage } from './build-llm'
import { M_GENERAL } from './method'

export type RouteMechanism =
  /** The words are read down so they do the least possible work. */
  | 'NARROW_READING'
  /** The protection is relocated to a source the proposal does not touch. */
  | 'ALTERNATIVE_SOURCE'
  /** Another instrument or settlement already entrenches it. */
  | 'ENTRENCHED_ELSEWHERE'
  /** A procedural route survives that reaches the same result. */
  | 'PROCEDURAL_SURVIVAL'
  /** The provision is disapplied or qualified in the case that matters. */
  | 'DISAPPLICATION'
  /** Something else, named in `mechanismOther`. */
  | 'OTHER'

export interface AttackRoute {
  /** What the opponent would actually run, in one sentence. */
  route: string
  mechanism: RouteMechanism
  mechanismOther?: string
  /** The authority, doctrine or instrument it rests on. Named, never gestured at. */
  restsOn: string
  /** The words in the proposal that let it in. Quoted. */
  theOpening: string
  /** ⚠ THE CRUX. Does the plan as drafted close this route? */
  planCloses: 'CLOSES' | 'PARTLY' | 'DOES_NOT_CLOSE' | 'MAKES_IT_WORSE'
  /** Why that verdict — naming the action that closes it, or saying no action addresses it. */
  planClosesWhy: string
  /** What would have to be added to close it. Empty when it is already closed. */
  whatWouldClose: string
}

export interface PreparedOpponentResult {
  /** How the opponent characterises the proposal's weakest structural assumption. */
  overallLine: string
  routes: AttackRoute[]
  /**
   * ⚠ NAMED SO THE PASS CAN SAY IT FOUND NOTHING. An empty list from a pass with no way to
   * say "I could not find a route" is indistinguishable from a pass that failed.
   */
  couldNotFind: string
}

const SCHEMA = {
  type: 'object',
  properties: {
    overallLine: { type: 'string' },
    routes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          route: { type: 'string' },
          mechanism: {
            type: 'string',
            enum: ['NARROW_READING', 'ALTERNATIVE_SOURCE', 'ENTRENCHED_ELSEWHERE',
              'PROCEDURAL_SURVIVAL', 'DISAPPLICATION', 'OTHER'],
          },
          mechanismOther: { type: 'string' },
          restsOn: { type: 'string' },
          theOpening: { type: 'string' },
          planCloses: {
            type: 'string',
            enum: ['CLOSES', 'PARTLY', 'DOES_NOT_CLOSE', 'MAKES_IT_WORSE'],
          },
          planClosesWhy: { type: 'string' },
          whatWouldClose: { type: 'string' },
        },
        required: ['route', 'mechanism', 'restsOn', 'theOpening', 'planCloses', 'planClosesWhy'],
      },
    },
    couldNotFind: { type: 'string' },
  },
  required: ['overallLine', 'routes'],
} as const

/**
 * The doctrinal context, supplied only when a caller asks for it.
 *
 * ⚠ THIS IS EVIDENCE ABOUT THE LEGAL LANDSCAPE, NOT AN ANSWER TO A MEASURE. It is still an
 * enormous hint for M-01 specifically, which is exactly why the harness runs the unhinted arm
 * first and reports the difference rather than quietly using the hinted one.
 */
export const COMMON_LAW_MIGRATION = [
  'Since 2013 the senior judiciary has been relocating rights protection from the Human Rights Act',
  'onto the common law, in reported judgments rather than in dicta — Osborn v Parole Board [2013]',
  'UKSC 61, Kennedy v Charity Commission [2014] UKSC 20, A v BBC [2014] UKSC 25, and R (UNISON) v',
  'Lord Chancellor [2017] UKSC 51. The effect is that repealing the Act does not return the law to',
  '1997: the courts have spent a decade ensuring that it would not.',
].join('\n')

export async function runPreparedOpponent(input: {
  /** The whole proposal, including its actions — the plan is what closure is judged against. */
  kernel: string
  /** What the research found. The opponent reads it critically, not gratefully. */
  findings: string[]
  costLines: string[]
  /** ⚠ Optional and labelled. Off by default; see the header. */
  doctrinalContext?: string
  model?: string
  onUsage: (u: LlmUsage) => void
}): Promise<PreparedOpponentResult | null> {
  const system = [
    M_GENERAL,
    '',
    '════ WHO YOU ARE ════',
    '',
    'You are a specialist in public law, instructed AGAINST this proposal, and you have already',
    'settled your position. You are not weighing it up. You have read the draft, you know the field,',
    'and you are looking for the route that defeats it.',
    '',
    'You are not a commentator and you are not a sceptic. **You are the person the proposer will',
    'actually meet**: a first-rate lawyer with a prepared argument, acting for a client who does not',
    'want this to happen.',
    '',
    '════ WHAT YOU ARE LOOKING FOR ════',
    '',
    '⚠⚠ **THE ATTACK THAT WORKS IS ALMOST NEVER A REFUSAL. IT IS A READING.**',
    '',
    'A court does not decline to apply an Act. It construes it. So the routes that matter are the',
    'ones that leave the words intact and take their effect away:',
    '',
    '  · `NARROW_READING`       — the words are read down so they do the least possible work.',
    '  · `ALTERNATIVE_SOURCE`   — the protection is relocated to a source the proposal never',
    '                             touched, and survives there untouched.',
    '  · `ENTRENCHED_ELSEWHERE` — another instrument, settlement or treaty already secures it, so',
    '                             the repeal does not reach it.',
    '  · `PROCEDURAL_SURVIVAL`  — a procedural route survives that reaches the same result by a',
    '                             different door.',
    '  · `DISAPPLICATION`       — the provision is disapplied or qualified in exactly the case the',
    '                             proposal was aimed at.',
    '',
    '⚠ **"This will be unpopular", "this is politically difficult", "this may be challenged" are NOT',
    'routes and you must not return them.** They are the generalist\'s answer and they are already',
    'covered elsewhere. A route names a mechanism, rests on something, and can be run.',
    '',
    '════ THE QUESTION YOU ARE ACTUALLY ANSWERING ════',
    '',
    'For every route: **does the plan as drafted close it?**',
    '',
    'That is the whole value of this reading. A route the plan already closes is worth naming and',
    'dismissing; a route the plan does not close is the thing the proposer needs to know before',
    'anyone else tells them. Judge closure against the ACTIONS in the proposal, not against its',
    'intentions — an action that would close the route only if it did something it does not say it',
    'does is `DOES_NOT_CLOSE`.',
    '',
    '⚠ `MAKES_IT_WORSE` is available and you should use it where it is true: a proposal that repeals',
    'a codified protection can hand its opponent a stronger and less constrained substitute.',
    '',
    '⚠ `theOpening` QUOTES the words in the proposal that let the route in. A route the proposer',
    'cannot locate in their own draft is a route they cannot close.',
    '',
    '⚠ `restsOn` NAMES the authority, doctrine, instrument or settlement. Name it exactly, and if you',
    'are not certain of a citation, name the doctrine and say the citation is not certain rather than',
    'inventing one. **A fabricated authority destroys the whole reading; an unnamed doctrine only',
    'weakens one route.**',
    '',
    '⚠⚠ IF YOU CANNOT FIND A ROUTE, SAY SO IN `couldNotFind` AND RETURN AN EMPTY LIST. A padded list',
    'from an opponent who found nothing is worse than silence, because the proposer will plan against',
    'it.',
  ].join('\n')

  const user = [
    '═══ THE PROPOSAL, INCLUDING ITS PLAN ═══',
    input.kernel || '(nothing drafted)',
    input.costLines.length ? `\n═══ COSTS AS THE PROPOSER HAS ENTERED THEM ═══\n- ${input.costLines.join('\n- ')}` : '',
    input.findings.length
      ? `\n═══ WHAT THE PROPOSER'S OWN RESEARCH FOUND — read critically ═══\n${input.findings.join('\n').slice(0, 24000)}`
      : '',
    // ⚠ LABELLED AS SUPPLIED, so a reader of the output can tell which arm produced it.
    input.doctrinalContext
      ? `\n═══ CONTEXT SUPPLIED TO YOU (not found by you) ═══\n${input.doctrinalContext}`
      : '',
  ].filter(Boolean).join('\n')

  const result = await callJson<PreparedOpponentResult>({
    model: input.model ?? process.env.LEX_OPPONENT_MODEL ?? 'gemini-2.5-pro',
    system,
    user,
    schema: SCHEMA,
    maxOutputTokens: parseInt(process.env.LEX_OPPONENT_TOKENS ?? '12000', 10),
    timeoutMs: parseInt(process.env.LEX_OPPONENT_TIMEOUT_MS ?? '180000', 10),
    temperature: 0.2,
    label: 'prepared-opponent',
  })
  input.onUsage(result.usage)
  if (llmFailed(result)) {
    console.error('[opponent] the pass did not complete', { reason: result.reason, detail: result.detail?.slice(0, 300) })
    return null
  }

  // ⚠ A DECLARED SCHEMA IS A REQUEST, NOT A GUARANTEE. This codebase has had a string arrive
  // where an array was declared and lose four passes to it.
  const raw = Array.isArray(result.value?.routes) ? result.value.routes : []
  const routes = raw
    .filter((r) => r && typeof r.route === 'string' && r.route.trim()
      && typeof r.restsOn === 'string' && typeof r.planCloses === 'string')
    .map((r) => ({
      route: String(r.route).trim(),
      mechanism: (r.mechanism ?? 'OTHER') as RouteMechanism,
      mechanismOther: r.mechanismOther ? String(r.mechanismOther).trim() : undefined,
      restsOn: String(r.restsOn ?? '').trim(),
      theOpening: String(r.theOpening ?? '').trim(),
      planCloses: r.planCloses as AttackRoute['planCloses'],
      planClosesWhy: String(r.planClosesWhy ?? '').trim(),
      whatWouldClose: String(r.whatWouldClose ?? '').trim(),
    }))

  return {
    overallLine: String(result.value?.overallLine ?? '').trim(),
    routes,
    couldNotFind: String(result.value?.couldNotFind ?? '').trim(),
  }
}
