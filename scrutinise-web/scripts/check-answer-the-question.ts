// ─────────────────────────────────────────────────────────────────────────────
// §19-E Task 2 — LEX MUST ANSWER THE QUESTION IT WAS ASKED.
//
// Charlie asked: does this need a "Charter" — is that the right instrument? How is
// accountability handled in the Civil Service now? Is anything written down? Is there
// anything in the Civil Service Code? Lex named three corpus documents, pointed at the
// panel, and re-issued the guiding-policy summary. His verdict: "fundamentally
// unhelpful." The same question to plain Gemini and to ChatGPT produced, in both cases,
// a direct substantive answer.
//
// This check cannot test the ANSWER — that needs a model and a browser, and it is on
// the acceptance list for the walk. What it CAN test, and what stops the mechanism
// being quietly removed, is that the machinery is present and wired:
//
//   1. the question detector fires on Charlie's actual question, and stays silent on
//      an ordinary field answer (a detector that fires on everything is a detector
//      that has been switched off);
//   2. the answer-first instruction reaches the prompt on a question turn, and does
//      not on a field turn;
//   3. the field instruction is SUBORDINATED on a question turn, rather than sitting
//      under the question telling Lex to propose;
//   4. the four-sentence ceiling is lifted on a question turn — it was itself part of
//      the defect;
//   5. never-claim says what it does NOT forbid, in the prompt, in words;
//   6. the route discards a proposal on a question turn, so the platform enforces it
//      rather than trusting the model to.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'path'
import { looksLikeAQuestion, methodForStage, methodBlocksFor, M_ANSWER, M_PRESS_TO_READ } from '../lib/lex/method'
import { buildLexSystemPrompt } from '../lib/lex/lex-client'
import type { FieldDef } from '../lib/lex/page1-config'

const ROOT = path.join(__dirname, '..')
let fail = 0
const ok = (label: string, cond: boolean, detail = '') => {
  if (cond) console.log(`  ok   ${label}`)
  else { fail++; console.log(` FAIL  ${label}${detail ? ` — ${detail}` : ''}`) }
}
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const code = (rel: string) => read(rel).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

console.log('§19-E Task 2 — Lex answers the question it was asked\n')

// ── 1. the detector ──────────────────────────────────────────────────────────
console.log('§2a — the question detector fires on the real case, and stays silent otherwise')

// Charlie's question, as he put it (13 Aug walk).
const CHARLIE =
  'Does this need a "Charter" — is that the right instrument? How is accountability handled in the ' +
  'Civil Service now? Is anything written down? Is there anything in the Civil Service Code?'
ok('Charlie\'s Charter question is detected', looksLikeAQuestion(CHARLIE))

const QUESTIONS = [
  CHARLIE,
  'Is a Charter the right instrument here?',
  'What does the Civil Service Code actually cover?',
  'How is this handled at the moment?',
  'Why would a committee object to that?',
  'What do you think of this approach?',
  'Tell me whether this needs primary legislation',
  'Can you explain the Accounting Officer regime',
  'Am I right that this is already covered somewhere?',
  'Which of those two is closer to what I am proposing?',
]
const NOT_QUESTIONS = [
  // Ordinary field content — the thing that must NOT be diverted into an answer turn.
  'The problem is that senior civil servants face no personal consequence for a bad decision.',
  'Add a cause: departments have no incentive to concentrate accountability.',
  "Let's go with the second option.",
  'yes',
  'Change "major" to "significant" in that sentence.',
  'I want to change the amount charged for plastic bags in shops',
  'Save this one and move on',
]
const falseNegatives = QUESTIONS.filter((q) => !looksLikeAQuestion(q))
const falsePositives = NOT_QUESTIONS.filter((q) => looksLikeAQuestion(q))
ok(`all ${QUESTIONS.length} questions detected`, falseNegatives.length === 0, falseNegatives.join(' | '))
ok(`none of ${NOT_QUESTIONS.length} field answers detected as questions`, falsePositives.length === 0, falsePositives.join(' | '))

// ── 2. the blocks reach the prompt, and only when they should ────────────────
console.log('\n§2a/§2c — the blocks are in the prompt on the right turns')
const onQuestion = methodBlocksFor('GUIDING_POLICY', { questionTurn: true, sourcesInHand: true })
const onField = methodBlocksFor('GUIDING_POLICY', { questionTurn: false, sourcesInHand: false })
ok('M-ANSWER is present at EVERY stage, question or not',
  onField.includes('M-ANSWER') && methodBlocksFor('ORIENTATION', {}).includes('M-ANSWER'))
ok('M-ANSWER-FIRST is added on a question turn', onQuestion.includes('M-ANSWER-FIRST'))
ok('...and is ABSENT on a field turn', !onField.includes('M-ANSWER-FIRST'))
ok('M-PRESS-TO-READ appears when sources are in hand', onQuestion.includes('M-PRESS-TO-READ'))
ok('...and is ABSENT when none are', !onField.includes('M-PRESS-TO-READ'))

const questionMethod = methodForStage('GUIDING_POLICY', { questionTurn: true, sourcesInHand: true })
const fieldMethod = methodForStage('GUIDING_POLICY', { questionTurn: false, sourcesInHand: false })
ok('the answer-first text really is in the question-turn method',
  /Answering it is the whole job of this turn/.test(questionMethod))
ok('...and really is not in the field-turn method',
  !/Answering it is the whole job of this turn/.test(fieldMethod))
ok('the stage method block survives alongside it', /The guiding policy is an approach/.test(questionMethod))

// ── 3. the three kinds of statement are drawn, in words ─────────────────────
console.log('\n§2b — grounding does not mean silence')
ok('M-ANSWER names what is corpus-grounded and cited', /CORPUS-GROUNDED AND CITED/.test(M_ANSWER))
ok('...what is reasoned openly and LABELLED as reasoning', /REASONED OPENLY, AND LABELLED AS REASONING/.test(M_ANSWER))
ok('...and what is never done (fabrication, and only fabrication)',
  /NEVER — a fabricated citation/.test(M_ANSWER))
ok('...and it says naming documents is not an answer', /Naming documents is not an answer/.test(M_ANSWER))
ok('...and that pointing at the panel is not an answer', /Pointing at the panel is not an answer/.test(M_ANSWER))
ok('...and that re-stating a written summary is not an answer', /Re-stating a summary you have already written is not an answer/.test(M_ANSWER))
ok('M-PRESS-TO-READ asks for one or two, with reasons, not a list',
  /DO NOT list them/i.test(M_PRESS_TO_READ) && /ONE OR TWO/.test(M_PRESS_TO_READ) && /read those/.test(M_PRESS_TO_READ))

// ── 4. the prompt itself ────────────────────────────────────────────────────
console.log('\n§2a — the field instruction is subordinated, and the length ceiling lifts')
const field: FieldDef = {
  key: 'summaryGuidingPolicy', label: 'Guiding-policy summary', type: 'inferred',
  scope: 'idea', origin: 'proposed', question: 'Here’s the guiding policy.',
} as FieldDef
const base = {
  preferredName: 'Charlie', lexMode: 'COLLABORATIVE', experienceLevel: 'expert',
  ideaTitle: 'Civil Service Decision Paralysis', isFirstIdea: false,
  currentField: field, activePage: 'GUIDING_POLICY', acceptedSummary: 'Chosen approach: a charter',
}
const qPrompt = buildLexSystemPrompt({ ...base, questionTurn: true, sourcesInHand: true })
const fPrompt = buildLexSystemPrompt({ ...base, questionTurn: false, sourcesInHand: false })

ok('a question turn marks the field as CONTEXT ONLY', /THE FIELD BELOW IS CONTEXT ONLY|field below is CONTEXT ONLY/i.test(qPrompt))
ok('...and tells the model to emit no proposal', /Do NOT act on its instruction this turn, and emit no proposal/.test(qPrompt))
ok('a field turn carries no such preamble', !/CONTEXT ONLY/i.test(fPrompt))
ok('the 1–4 sentence ceiling is LIFTED on a question turn', !/chatText is always 1–4 sentences/.test(qPrompt))
ok('...and still applies on a field turn', /chatText is always 1–4 sentences/.test(fPrompt))
ok('a question turn asks for the length the question deserves',
  /at whatever length the question deserves/.test(qPrompt))
ok('...and says a short answer is an evasion', /almost certainly an evasion/.test(qPrompt))
ok('the never-claim rule states what it does NOT forbid, in both prompts',
  /WHAT NEVER-CLAIM DOES NOT MEAN/.test(qPrompt) && /WHAT NEVER-CLAIM DOES NOT MEAN/.test(fPrompt))
ok('...naming reasoning from general knowledge as permitted',
  /reason from general knowledge/.test(fPrompt) && /Refusing to answer a question you can answer is not caution/.test(fPrompt))
ok('...with fabrication as the only hard line',
  /The only hard line is fabrication/.test(fPrompt))

// ── 5. the platform enforces it, not the model ──────────────────────────────
console.log('\n§2a — the platform discards a proposal on a question turn')
const ROUTE = 'app/api/ideas/[id]/lex/route.ts'
const route = code(ROUTE)
ok('the route computes whether the turn is a question', /looksLikeAQuestion\(message\)/.test(route))
ok('...and discards any proposal when it is', /if \(questionTurn && lex\.proposal\)[\s\S]{0,300}lex\.proposal = null/.test(route))
ok('...BEFORE the causes branch, so no path slips past it',
  route.indexOf('lex.proposal = null') < route.indexOf("current?.key === 'causes'"))
ok('...and both signals are logged, so a silent block is distinguishable from a dodged one',
  /\[lex-diag\] turn shape/.test(read(ROUTE)) && /questionTurn/.test(read(ROUTE)))
ok('the prompt builder is given both signals', /questionTurn,/.test(route) && /sourcesInHand,/.test(route))

console.log(fail === 0 ? '\nAll checks pass.' : `\n${fail} check(s) FAILED.`)
process.exit(fail === 0 ? 0 : 1)
