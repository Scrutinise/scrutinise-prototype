// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A §1 — the two model calls the elicitation makes. Both are small, both
// have a deterministic fallback, and neither is allowed to stall the flow.
//
//   1. pressOnProblem   — the §19-D problem gate, applied to exchange 1.
//   2. writeUnderstanding — §1c, the paragraph Lex says back before it builds.
//
// ⚠ THE UNDERSTANDING PARAGRAPH IS THE ONLY THING STANDING BETWEEN A MISREADING AND A
// TEN-MINUTE BUILD ON TOP OF IT. So it is told, in the prompt, to say what it has
// understood INCLUDING THE PARTS IT IS LEAST SURE OF — a paragraph that only repeats
// the confident half is a confirmation the user cannot fail, and a confirmation nobody
// can fail confirms nothing.
// ─────────────────────────────────────────────────────────────────────────────

import { callJson, type LlmResult } from './build-llm'
import { M_GENERAL, M_PROBLEM_GATE } from './method'

const MODEL = () => process.env.LEX_ELICITATION_MODEL ?? process.env.QUERY_EXPANSION_MODEL ?? 'gemini-2.5-flash'
const MAX_TOKENS = parseInt(process.env.LEX_ELICITATION_MAX_TOKENS ?? '2000', 10)
const TIMEOUT_MS = parseInt(process.env.LEX_ELICITATION_TIMEOUT_MS ?? '30000', 10)

// ── 1. The problem gate ──────────────────────────────────────────────────────

export interface ProblemPress {
  /** What Lex says: acknowledge the remedy, then ask what is going wrong. */
  press: string
  /** Lex's best reading of the problem, stated as a problem, so agreeing is one click. */
  reading: string
}

const PRESS_SCHEMA = {
  type: 'object',
  properties: {
    press: { type: 'string' },
    reading: { type: 'string' },
  },
  required: ['press', 'reading'],
}

const PRESS_SYSTEM = [
  M_GENERAL,
  '',
  M_PROBLEM_GATE,
  '',
  'You are applying the problem gate to the FIRST thing a user has told you about their idea, before',
  'anything has been drafted. Two fields:',
  '  `press`   — what you say to them. Half a sentence acknowledging the remedy they have in mind,',
  '              then what is going wrong that it would fix, offering two or three concrete readings',
  '              so they can just pick one. Do not lecture. Do not use "solution" or "problem',
  '              statement" as jargon. Do not refuse to proceed.',
  '  `reading` — your best reading of the problem, stated as a problem: what is wrong, for whom, and',
  '              why it matters. One or two sentences, in their register, no remedy in it.',
].join('\n')

export async function pressOnProblem(input: {
  text: string
  pressesAlready: number
}): Promise<LlmResult<ProblemPress>> {
  return callJson<ProblemPress>({
    model: MODEL(),
    system: PRESS_SYSTEM,
    user: [
      `THE USER'S WORDS:\n${input.text.slice(0, 4000)}`,
      '',
      input.pressesAlready > 0
        ? 'YOU HAVE ALREADY PRESSED ONCE. This is your last press: be shorter, offer the readings, and ' +
          'make it obvious that they can simply tell you to move on.'
        : '',
    ].filter(Boolean).join('\n'),
    schema: PRESS_SCHEMA,
    maxOutputTokens: MAX_TOKENS,
    timeoutMs: TIMEOUT_MS,
    temperature: 0.5,
    label: 'elicitation-problem-gate',
  })
}

/** Deterministic press, so the gate still fires when the model does not. */
export function fallbackPress(): ProblemPress {
  return {
    press:
      'I can see what you want done. Before I build anything on it, what’s going wrong that it would ' +
      'fix — what’s the harm, who is it happening to, and why does it matter? Say it however you like; ' +
      'and if you’d rather just press on, tell me and we will.',
    reading: '',
  }
}

// ── 2. The confirmation paragraph (§1c) ──────────────────────────────────────

export interface Understanding {
  /** The paragraph itself. No preamble, no sign-off — the copy around it is ours. */
  paragraph: string
}

const UNDERSTANDING_SCHEMA = {
  type: 'object',
  properties: { paragraph: { type: 'string' } },
  required: ['paragraph'],
}

const UNDERSTANDING_SYSTEM = [
  M_GENERAL,
  '',
  'THIS IS THE CONFIRMATION STEP. The user has answered four questions and you are about to go away',
  'and draft a whole strategy kernel from them. Before you do, say back what you understand them to',
  'be trying to do, in ONE short paragraph — four to six sentences at most.',
  '',
  'WHAT MAKES THIS PARAGRAPH USEFUL RATHER THAN POLITE:',
  '  · Say what you have understood the PROBLEM to be, in their register, not in policy language.',
  '  · Say what you take them to WANT, and name anything they have ruled out — getting a ruled-out',
  '    option wrong is the cheapest mistake to catch here and the most expensive to catch later.',
  '  · Say back the part of THEIR OWN KNOWLEDGE you are going to lean on. It is the material the',
  '    record cannot give you, so if you have misread it, everything downstream inherits the error.',
  '  · INCLUDE THE PARTS YOU ARE LEAST SURE OF, plainly ("I am reading X as Y — tell me if that is',
  '    wrong"). A paragraph that only repeats the confident half is a confirmation nobody can fail.',
  '  · Do NOT propose a solution, do not draft anything, and do not flatter the idea.',
  '  · Write in the second person ("you"), warm and direct. No headings, no bullets, no sign-off.',
].join('\n')

export async function writeUnderstanding(input: {
  problem: string
  goalKindLabel: string
  goalDetail: string
  ruledOut: string
  ownKnowledge: string
  aboutYou: string
  /** A previous attempt the user rejected, plus what they said was wrong with it. */
  correction?: { previous: string; whatIsWrong: string }
}): Promise<LlmResult<Understanding>> {
  const parts = [
    `THE PROBLEM, IN THEIR WORDS:\n${input.problem.slice(0, 6000) || '(not given)'}`,
    `\nWHAT THEY WANT TO HAPPEN: ${input.goalKindLabel}${input.goalDetail ? ` — ${input.goalDetail.slice(0, 2000)}` : ''}`,
    input.ruledOut ? `\nALREADY RULED OUT: ${input.ruledOut.slice(0, 2000)}` : '\nALREADY RULED OUT: (nothing stated)',
    // ⚠ LABELLED, ALWAYS. This is the user's own testimony, not retrieved material, and
    // the label travels with it into every prompt that reads it.
    input.ownKnowledge
      ? `\nTHEIR OWN KNOWLEDGE (USER TESTIMONY — this is the user telling you what they know from ` +
        `experience. It is NOT a retrieved source and must never be cited as one):\n${input.ownKnowledge.slice(0, 6000)}`
      : '\nTHEIR OWN KNOWLEDGE: (nothing given)',
    input.aboutYou ? `\nABOUT THEM: ${input.aboutYou.slice(0, 2000)}` : '',
  ]
  if (input.correction) {
    parts.push(
      `\nYOU ALREADY TRIED THIS AND THEY SAID IT WAS WRONG.\nYOUR PREVIOUS ATTEMPT:\n${input.correction.previous.slice(0, 3000)}`,
      `\nWHAT THEY SAID IS WRONG WITH IT:\n${input.correction.whatIsWrong.slice(0, 3000)}`,
      '\nWrite it again, corrected. Do not defend the previous version and do not repeat the part they ' +
        'objected to. Their correction outranks your earlier reading.',
    )
  }

  return callJson<Understanding>({
    model: MODEL(),
    system: UNDERSTANDING_SYSTEM,
    user: parts.filter(Boolean).join('\n'),
    schema: UNDERSTANDING_SCHEMA,
    maxOutputTokens: MAX_TOKENS,
    timeoutMs: TIMEOUT_MS,
    temperature: 0.4,
    label: 'elicitation-understanding',
  })
}
