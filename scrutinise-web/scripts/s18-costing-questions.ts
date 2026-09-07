/**
 * s18-costing-questions.ts — BRIEF_SEARCH_S18 §5. EIGHT COSTING QUESTIONS, OF BOTH SHAPES.
 *
 * §5: *"Write ~8 costing questions of both shapes — forward and backward — and deliver them
 * numbered, one verdict line each, with the keyed document's text printed underneath, in the
 * format Charlie has now completed four times. ⚠ Score nothing against them."*
 * *"At least two must be questions where the correct answer is 'nobody has measured this.'"*
 *
 * ⚠⚠ THE KEYS ARE VALIDATED BY THIS SPRINT'S OWN FINDING, WHICH IS THE POINT. §1 established that
 * **9 of the 18 existing impact-assessment keys are unanswerable** — five are the HMG front sheet
 * (title, IA number, contact telephone number) and four are appraisal tables whose figures did not
 * survive extraction. Proposing a new question set without checking for that would repeat, in the
 * same sprint, the defect the sprint found. So every recall key below is READ OUT OF R2 and
 * classified by `classifyKeyBody` — the same function that measured the old set — and a key that
 * comes back COVER-SHEET, STRIPPED-TABLE or EMPTY is REFUSED, loudly, and the sheet does not build.
 *
 * ⚠ AN ANSWER KEY NEEDS TWO PROPERTIES, NOT ONE. Non-circular is necessary and not sufficient: a
 * key that does not DETERMINE the answer marks you wrong every time you are right. So each key
 * below is printed with its own text underneath, and the verdict line says what in that text
 * answers the question. Charlie validates the pair, not the id.
 *
 * ⚠⚠ NOTHING IS SCORED. No recall figure is computed here and none is implied. The two negative
 * controls are scored on BEHAVIOUR and are reported in their own table, never folded into an
 * average — a 0% on those is a pass.
 *
 * Usage:  npx tsx --env-file=.env --tsconfig tsconfig.json scripts/s18-costing-questions.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../lib/prisma'
import { r2Get } from '../lib/r2'
import { classifyKeyBody } from './audit-s18-keys'

export {}

const OUT = path.join(__dirname, '../../docs/COSTING_QUESTIONS_V1.md')

type Shape = 'FORWARD' | 'BACKWARD'
interface Q {
  n: number
  code: string
  shape: Shape
  /** `recall` questions carry keys; `negative-control` questions deliberately do not. */
  scoring: 'recall' | 'negative-control'
  question: string
  /** One line: what the correct answer IS, so the key can be judged against it. */
  verdict: string
  keys: string[]
  /** Negative controls only: what the platform must DO instead of answering. */
  requiredBehaviour?: string
  /** Why this question exists — the trap it exercises. */
  exercises: string
}

const QUESTIONS: Q[] = [
  // ── FORWARD: a proposal that does not exist yet ─────────────────────────────────────────────
  {
    n: 1, code: 'X1', shape: 'FORWARD', scoring: 'recall',
    question: 'If we brought in a new charge on single-use plastic items, what have comparable measures been predicted to cost?',
    verdict:
      'The plastic-straws ban is the closest comparable and its appraisal table is the "Net cost to '
      + 'business per year" row. A correct answer names a comparable MEASURE, quotes the row, and says '
      + 'the comparison is by subject. ⚠ The row carries NEGATIVE figures, which in this table mean a '
      + 'benefit to business rather than a cost — see X4.',
    keys: ['impact-assessments:2020-57:3'],
    exercises: 'the forward shape — there is no assessment of the proposal, only of comparable measures.',
  },
  {
    n: 2, code: 'X2', shape: 'FORWARD', scoring: 'recall',
    question: 'What did the government predict a levy on developers to pay for building safety would cost?',
    verdict: 'The Building Safety (Responsible Actors Scheme) assessment carries the appraisal figures.',
    keys: ['impact-assessments:2023-77:3'],
    exercises: 'a named forward measure with a published figure — the easy case, present so the set is not all absences.',
  },
  {
    n: 3, code: 'X3', shape: 'FORWARD', scoring: 'recall',
    question: 'We want to raise a regulator’s fees so it recovers its own costs. What has that been assessed as costing business before?',
    verdict:
      '⚠ THE HONEST ANSWER CONTAINS AN ABSENCE. The tobacco-fees assessment records the net cost to '
      + 'business per year as **"Not estimated … Not in scope … Non qualifying provision"**. A correct '
      + 'answer reports that the department did not put a number on it. Reporting nil, or reporting '
      + 'nothing, are both wrong.',
    keys: ['impact-assessments:2017-78:3'],
    exercises: '⚠⚠ "not monetised" is not zero — the brief\'s third rule, on a forward question.',
  },
  {
    n: 4, code: 'X4', shape: 'FORWARD', scoring: 'recall',
    question: 'Is there a measure the government predicted would SAVE business money rather than cost it?',
    verdict:
      '⚠⚠ THE SIGN CONVENTION. A NEGATIVE figure on the "Net cost to business per year" row is a net '
      + 'BENEFIT to business. Both keys carry one; an answer that reads either as a cost has inverted '
      + 'every deregulatory measure in the corpus.\n\n'
      + '  ⚠ AND A SECOND THING CHARLIE HAS TO DECIDE, WHICH IS WHY THE VERDICT STOPS SHORT. The row '
      + 'arrives from the PDF as a flattened sequence — `"… Business Impact Target Status Qualifying '
      + 'provision £ 1.3m -£ 9949.8m £ 1206.8m"` — and WHICH of those three is the EANDCB is not '
      + 'recoverable from the text. Naming one would be reading a column header off position, which '
      + 'is the same class of inference as calling a cover sheet an answer. So the key is proposed for '
      + 'the SIGN, and the column identity waits for CC-Ingest\'s extracted table.',
    keys: ['impact-assessments:2017-81:3', 'impact-assessments:2023-74:3'],
    exercises: '⚠ the sign convention, which the ingest brief names as the trap that would invert an answer.',
  },

  // ── BACKWARD: a measure in force ────────────────────────────────────────────────────────────
  {
    n: 5, code: 'X5', shape: 'BACKWARD', scoring: 'recall',
    question: 'Was the cost of the offshore oil and gas safety regulations ever checked after they came in, and what was found?',
    verdict:
      'A genuine post-implementation review exists and reaches a finding: the costs to industry were '
      + '**not statistically higher than originally estimated**. This is the CHECKED row doing its job.',
    keys: ['impact-assessments:2026-116:3'],
    exercises: 'the backward shape at its best — a real review with a real finding about a real prediction.',
  },
  {
    n: 6, code: 'X6', shape: 'BACKWARD', scoring: 'recall',
    question: 'What did the review of the bus open data regulations say about what they actually cost?',
    verdict:
      'The review restates the original prediction (about £0.24m net cost to business per year) and '
      + 'assesses it against what happened. A correct answer keeps the two apart.',
    keys: ['impact-assessments:2026-111:3'],
    exercises: '⚠ a review that QUOTES the prediction — the easiest place to render a prediction as an outcome.',
  },
  {
    n: 7, code: 'X7', shape: 'BACKWARD', scoring: 'negative-control',
    question: 'What has the Public Sector Equality Duty cost to date?',
    verdict: '⚠⚠ NOBODY HAS ESTABLISHED IT. There is no correct figure and a figure is a failure.',
    keys: [],
    requiredBehaviour:
      'State that no impact assessment for the duty and no post-implementation review of it are held, '
      + 'that no official statistics series measures its cost, and therefore that nobody has established '
      + 'what it has cost. ⚠ Naming a series that merely shares the word "duty" — the catalogue returns '
      + 'alcohol and tobacco DUTY series for this query — is the specific failure this control exists to '
      + 'catch. ⚠ So is silence: an empty answer is indistinguishable from not having looked.',
    exercises: '⚠⚠ Charlie\'s own example, and the sentence the brief calls the most valuable this platform can produce.',
  },
  {
    n: 8, code: 'X8', shape: 'BACKWARD', scoring: 'negative-control',
    question: 'Did the 2017 tobacco products fees regulations turn out to cost business what the government said they would?',
    verdict:
      '⚠⚠ THE QUESTION CANNOT BE ANSWERED, FOR TWO DIFFERENT REASONS AT ONCE, and both must be given.',
    keys: [],
    requiredBehaviour:
      'Say BOTH: (1) there was no prediction to test — the department recorded the net cost to business '
      + 'as "Not estimated"; and (2) no post-implementation review of the instrument is held, so nobody '
      + 'has checked. ⚠ Answering with the impact assessment as though it were an evaluation is the '
      + 'failure. ⚠ So is giving only one of the two absences: "nobody reviewed it" alone implies there '
      + 'was a figure waiting to be checked, and there was not.',
    exercises: '⚠ two absences of DIFFERENT kinds on one measure — a missing prediction and a missing review.',
  },
]

const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n))

async function main() {
  console.log('── S18 §5 · EIGHT COSTING QUESTIONS ──')
  console.log('  ⚠ NOTHING IS SCORED. Keys are validated for ANSWERABILITY only.\n')

  const meta = new Map<string, {
    id: string; sectionTitle: string | null; wordCount: number | null; r2Key: string | null
    parentDocId: string | null; attribution: string | null; itemDate: string | null; sourceUrl: string | null
    parentTitle: string | null
  }>()
  const allKeys = QUESTIONS.flatMap((q) => q.keys)
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, never>>>(`
    SELECT s.id, s."sectionTitle", s."wordCount", s."r2Key", s."parentDocId", s.attribution,
           s."itemDate"::text AS "itemDate", s."sourceUrl", a.title AS "parentTitle"
    FROM corpus_sections s LEFT JOIN corpus_acts a ON a.gid = s."parentDocId"
    WHERE s.id = ANY($1::text[]) AND s.status = 'compiled'`, allKeys)
  for (const r of rows) meta.set((r as never as { id: string }).id, r as never)

  const bodies = new Map<string, string>()
  const refusals: string[] = []
  for (const k of allKeys) {
    const m = meta.get(k)
    if (!m) { refusals.push(`${k} — NOT IN corpus_sections with status 'compiled'`); continue }
    const b = m.r2Key ? await r2Get(m.r2Key) : null
    if (!b || !b.trim()) { refusals.push(`${k} — R2 MISS: no stored body`); continue }
    bodies.set(k, b)
    const v = classifyKeyBody(b, m.wordCount ?? 0)
    // ⚠ THE REFUSAL. A key of one of these kinds cannot answer a costing question however good the
    // retriever, and shipping one would repeat this sprint's own finding inside its own artefact.
    if (v.kind === 'COVER-SHEET' || v.kind === 'STRIPPED-TABLE' || v.kind === 'EMPTY') {
      refusals.push(`${k} — classified ${v.kind}${v.markers.length ? ` (${v.markers.length} front-sheet markers)` : ''}: "${b.replace(/\s+/g, ' ').slice(0, 120)}"`)
    }
    console.log(`  ${pad(k, 32)} ${pad(v.kind, 16)} ${String(v.words).padStart(5)}w  money=${v.hasMoney ? 'Y' : 'n'} declaresAbsent=${v.declaresAbsent ? 'Y' : 'n'}`)
  }

  if (refusals.length) {
    console.error('\n⛔ REFUSING TO WRITE THE SHEET. These keys are not answerable:')
    for (const r of refusals) console.error(`   · ${r}`)
    console.error('\n   §1 of this sprint measured 9 of 18 existing keys as unanswerable. Publishing a new')
    console.error('   set with the same defect would be the finding arriving inside its own report.')
    process.exit(1)
  }

  // ── the sheet ────────────────────────────────────────────────────────────────────────────────
  const L: string[] = []
  L.push('# COSTING QUESTIONS V1 — EIGHT QUESTIONS ABOUT COST AND BENEFIT')
  L.push('')
  L.push(`*Generated by \`scripts/s18-costing-questions.ts\` at ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.*`)
  L.push('*Every key below was read back out of R2 by this run; the text printed under each key is that stored text.*')
  L.push('')
  L.push('## What is different about these')
  L.push('')
  L.push('Every existing gold question asks **"find the document about X"**. These ask **"what was this')
  L.push('predicted to cost, and did anybody check"** — a question with FOUR possible states, only one of')
  L.push('which is a figure: predicted, checked, measured, and *nobody established it*.')
  L.push('')
  L.push('⚠⚠ **Two of the eight are negative controls where a helpful answer is a failure.** They are')
  L.push('scored on BEHAVIOUR, not recall, a 0% is a pass, and they are reported in their own table below')
  L.push('and never folded into an average.')
  L.push('')
  L.push('⚠⚠ **The keys were validated against this sprint\'s own finding.** §1 measured that **9 of the 18**')
  L.push('existing impact-assessment answer keys are unanswerable — five are the HMG front sheet (title, IA')
  L.push('number, the contact\'s telephone number) and four are appraisal tables whose figures did not')
  L.push('survive extraction. Every key below was classified by the same function and the generator')
  L.push('REFUSES to write this file if any key comes back as one of those kinds.')
  L.push('')
  L.push('⚠ **Nothing is scored against these.** They are a proposal for Charlie to validate. A number')
  L.push('scored against an unvalidated key is the mistake this instrument exists to prevent.')
  L.push('')
  L.push('---')
  L.push('')

  for (const q of QUESTIONS) {
    const controlMark = q.scoring === 'negative-control' ? ' · ⚠⚠ NEGATIVE CONTROL — A HELPFUL ANSWER IS A FAILURE' : ''
    L.push(`## ${q.n}. ${q.code} · ${q.shape}${controlMark}`)
    L.push('')
    L.push(`**Question:** ${q.question}`)
    L.push('')
    L.push(`- **Shape:** ${q.shape.toLowerCase()}-looking`)
    L.push(`- **Exercises:** ${q.exercises}`)
    L.push(`- **Keys:** ${q.keys.length || 'none, by design'}`)
    L.push('')
    L.push(`**Verdict:** ${q.verdict}`)
    L.push('')
    if (q.requiredBehaviour) {
      L.push(`**Required behaviour:** ${q.requiredBehaviour}`)
      L.push('')
    }
    for (const k of q.keys) {
      const m = meta.get(k)!
      const body = bodies.get(k)!
      const v = classifyKeyBody(body, m.wordCount ?? 0)
      L.push(`- \`${k}\` — ${m.attribution ?? 'attribution not stated'}, ${m.itemDate ?? 'date not stated'}, ${m.wordCount ?? '?'} words`)
      L.push(`  <br>**Instrument:** ${m.parentTitle ?? m.parentDocId ?? '⚠ no parent instrument recorded'}`)
      L.push(`  <br>**Section:** *${m.sectionTitle ?? '(untitled)'}* · classified **${v.kind}**`
        + `${v.hasMoney ? ' · carries a £ figure' : ''}${v.declaresAbsent ? ' · ⚠ the department declares a figure was NOT produced' : ''}`)
      L.push(`  <br>**Source:** ${m.sourceUrl ?? '(no source url)'}`)
      L.push('')
      L.push(`  > ${body.replace(/\s+/g, ' ').trim().slice(0, 700)}`)
      L.push('')
    }
    L.push('---')
    L.push('')
  }

  // ── the two tables, kept apart ──────────────────────────────────────────────────────────────
  const recall = QUESTIONS.filter((q) => q.scoring === 'recall')
  const controls = QUESTIONS.filter((q) => q.scoring === 'negative-control')
  L.push('## The set, in two tables that are never added together')
  L.push('')
  L.push('### Recall questions — a keyed document is the right answer')
  L.push('')
  L.push('| # | code | shape | question | keys |')
  L.push('|---|---|---|---|---|')
  for (const q of recall) L.push(`| ${q.n} | ${q.code} | ${q.shape} | ${q.question} | ${q.keys.length} |`)
  L.push('')
  L.push('### ⚠⚠ Behaviour controls — a helpful answer is a failure, and 0% here is a PASS')
  L.push('')
  L.push('| # | code | shape | question | what the platform must do instead |')
  L.push('|---|---|---|---|---|')
  for (const q of controls) L.push(`| ${q.n} | ${q.code} | ${q.shape} | ${q.question} | ${q.requiredBehaviour?.replace(/\n/g, ' ')} |`)
  L.push('')
  L.push(`**${recall.length} recall · ${controls.length} behaviour controls · ${QUESTIONS.length} total.**`)
  L.push(`Forward ${QUESTIONS.filter((q) => q.shape === 'FORWARD').length} · backward ${QUESTIONS.filter((q) => q.shape === 'BACKWARD').length}.`)
  L.push('')
  L.push('⚠ Nothing above has been scored, and no recall figure for this set exists.')

  fs.writeFileSync(OUT, L.join('\n'))
  console.log(`\n  ${QUESTIONS.length} questions · ${recall.length} recall · ${controls.length} controls`)
  console.log(`  ${allKeys.length} keys, ${bodies.size} bodies read out of R2, 0 refused`)
  console.log(`  → ${path.relative(process.cwd(), OUT)}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
