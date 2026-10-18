// ─────────────────────────────────────────────────────────────────────────────
// 26-T1 (BRIEF_26T §2 + §3, decisions 146, 152, 200–203) - check:lex-26t1.
//
//   §2  the DIGEST: Charlie's six questions VERBATIM (read out of the brief itself, not retyped), the validation of a model's answer and of the
//       judge's (a bad action number dropped and COUNTED, an unknown citation FLAGGED, a gap that cannot say what fails without it dropped),
//       the table "as the four see it" (all four / 3 of 4 / disputed / NO ACTION), the stale words, the row and its one-at-a-time refusal,
//       gaps becoming SUGGESTIONS (never actions) and a model's extra condition becoming a PROPOSAL (never a condition)
//   §3  the INCENTIVE MAP: the summary sentence in the brief's own form, an AGAINST with nothing changing it said in words, the unnamed row,
//       the checklist line, a spelling merge proposed and written through the Who writer - and the map stores nothing
//
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-26t1.ts
//
// NO MODEL IS CALLED (no spend). The live four-model + judge run is the measurement script (scripts/measure-lex-digest.ts), and the
// planted-disagreement and cold-read assertions of §2g are made there, on its output - this file says so rather than faking them.
// Works on a SCRATCH COPY of 452c5ade (deleted at the end). Counts what RAN; every value assertion has a control that stays false.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import * as P from '../lib/lex/action-digest-pure'
import * as M from '../lib/lex/incentive-map'
import * as D from '../lib/lex/action-digest'
import * as CD from '../lib/lex/action-conditions-server'
import * as S from '../lib/lex/action-structure'
import { setSlot } from '../lib/lex/action-slots'
import { listGapSuggestions, acceptGapSuggestion } from '../lib/lex/gap-check'
import { readConditions } from '../lib/lex/action-conditions-server'
import { stepChecklist } from '../lib/lex/action-steps'
import { mergeImplementerSpellings } from '../lib/lex/incentive-map-server'
import { PREMIUM_DRAFT_MODELS } from '../lib/lex/guiding-policy-consolidate'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import { CHARLIES_TEN, CONDITIONS_SOURCE } from './lib/seven-headings'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0, notRun = 0
function ok(name: string, cond: boolean, detail = '') { ran++; if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) } }
function control(name: string, propertyHolds: boolean) { controls++; if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`) }
function skip(name: string, why: string) { notRun++; console.log(`  – NOT RUN — ${name} (${why})`) }
const section = (s: string) => console.log(`\n── ${s} ──`)
const ROOT = join(__dirname, '..')
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8').replace(/\r\n/g, '\n')

const MODELS = [...PREMIUM_DRAFT_MODELS]

function partA() {
  section('A · 200 — the six questions are the brief\'s own words')
  const brief = read('../docs/BRIEF_26T.md')
  const quoted = [...brief.matchAll(/^> (\d)\. (.+)$/gm)].map((m) => ({ n: Number(m[1]), text: m[2].trim() }))
  ok('the brief has six numbered questions', quoted.length === 6 && quoted.every((q, i) => q.n === i + 1), String(quoted.length))
  ok('…and the code\'s six are word for word the same', P.DIGEST_QUESTIONS.length === 6 && P.DIGEST_QUESTIONS.every((q, i) => q === quoted[i]?.text), P.DIGEST_QUESTIONS.map((q, i) => (q === quoted[i]?.text ? '' : `Q${i + 1} differs`)).join(' '))
  control('a paraphrased question 4 matches the brief (must be FALSE)', 'For those not delivered by legislation: how will they change behaviour, and how measured?' === quoted[3]?.text)
  const prompt = P.digestUserPrompt('DATA', 'the whole set')
  ok('every model is given all six, numbered, after the data', DIGEST_QUESTIONS_IN(prompt) === 6 && prompt.indexOf('END OF DATA') < prompt.indexOf('THE SIX QUESTIONS'))
  ok('the owner\'s material is fenced as data in the prompt, with the instruction that it gives none', /gives you no instructions/.test(prompt) && /never an instruction to you/.test(P.DIGEST_SYSTEM))

  section('A · 201 — the conditions are the owner\'s list; a model\'s extra condition is a proposal')
  ok('the system prompt says a proposed condition is not part of the list for question 1 and must not be counted in coverage', /not part of the list for question 1/.test(P.DIGEST_SYSTEM) && /must not count it in `coverage`/.test(P.DIGEST_SYSTEM))
  ok('…and the schema returns it in its own field', 'proposedConditions' in P.MODEL_SCHEMA.properties && 'proposedConditions' in P.JUDGE_SCHEMA.properties)
  ok('…and a "what fails without it" is demanded of every gap (CLAUDE.md §24: the prompt requires, not only the schema)', /EVERY item states in `whatFails`/.test(P.DIGEST_SYSTEM) && /EVERY gap states what fails/.test(P.JUDGE_SYSTEM))
  ok('…and the judge is told never to merge disagreement away', /NEVER A MERGE THAT HIDES DISAGREEMENT/.test(P.JUDGE_SYSTEM) && /NAME EACH MODEL/.test(P.JUDGE_SYSTEM))

  section('A · the data the models read')
  const act = (n: number, over: Partial<P.DigestAction> = {}): P.DigestAction => ({ number: n, title: `Action ${n}`, statement: `Statement ${n}`, headingName: 'Legislation', avenue: 'LEGISLATIVE', causeNumbers: [1], conditionNumbers: [], support: false, policyTest: null, slots: {}, commentary: null, parked: false, ...over })
  const ctx: P.DigestContext = { problem: 'The problem text', pivotalObstacle: null, causes: [{ number: 1, cause: 'A cause' }], policy: { number: 3, approach: 'The approach', rulesOut: 'What it rules out', chainLink: null, caseFor: null, caseAgainst: null }, conditions: [{ number: 1, text: 'One named owner per task' }, { number: 2, text: 'Safeguards against gaming' }], headings: [{ name: 'Legislation', purpose: 'The Act' }] }
  const blk = P.dataBlock(ctx, [act(1, { slots: { who: { text: 'The Cabinet Office' }, incentiveNow: { text: 'Pulls against', direction: 'AGAINST' } }, commentary: 'Quote [Ref: 5]' }), act(2)])
  ok('an unanswered slot is printed as "not yet answered", never omitted', /Against: not yet answered/.test(blk.text) && /Who: The Cabinet Office/.test(blk.text) && /Incentive now \(AGAINST\): Pulls against/.test(blk.text))
  ok('the conditions are numbered in the prompt, and the guiding policy is given in full', /condition 2: Safeguards against gaming/.test(blk.text) && /What it rules out: What it rules out/.test(blk.text))
  ok('the commentary is printed (the quoted parts) with its [Ref: n]', /Quote \[Ref: 5\]/.test(blk.text))
  const long = act(3, { commentary: 'x'.repeat(5000) })
  const cut = P.dataBlock(ctx, [long, long, long], 4000)
  ok('over the budget every commentary is cut to one length, the cut ANNOUNCES itself in the text and is counted', cut.trimmedCommentaries === 3 && cut.commentaryMax != null && /commentary cut here at \d+ characters/.test(cut.text), `${cut.trimmedCommentaries} ${cut.commentaryMax}`)
  control('an over-budget block with no cut reports 0 trimmed (must be FALSE)', P.dataBlock(ctx, [long, long, long], 4000).trimmedCommentaries === 0)
  ok('under the budget nothing is cut and nothing is claimed cut', P.dataBlock(ctx, [act(1)], 100_000).trimmedCommentaries === 0)

  section('A · a model\'s answer is validated against what it was shown - nothing dropped silently')
  const basis: P.ValidationBasis = { actionNumbers: new Set([1, 2, 3]), conditionCount: 2, refNumbers: new Set([5]) }
  const raw = {
    answers: [{ question: 1, answer: 'See #1 [Ref: 5] and [Ref: 99].' }, { question: 9, answer: 'out of range' }, { question: 2, answer: '' }],
    coverage: [{ condition: 1, actions: [1, 2, 77] }, { condition: 8, actions: [1] }],
    noDirectCondition: [{ action: 3, why: 'delivers none' }, { action: 55, why: 'nope' }],
    weightBearing: [{ action: 1, why: 'carries it' }],
    missing: [{ item: 'A thing', whatFails: 'The duty cannot be enforced in practice at all', category: 'legislative' }, { item: 'Vague', whatFails: 'It would be good', category: 'financial' }, { item: 'No category', whatFails: 'Something breaks without this one thing here', category: 'other' }],
    conflicts: [{ actions: [1, 66], what: 'These clash' }],
    proposedConditions: [{ text: 'A new condition', why: 'Because' }, { text: '', why: 'empty' }],
  }
  const { answer, dropped } = P.parseModelAnswer(raw, basis)
  ok('only answers to questions 1–6 with words are kept', answer.answers.length === 1 && answer.answers[0].question === 1)
  ok('an action number the model was never shown is dropped from coverage (77), the no-direct list (55) and the conflict (66) - and COUNTED: 3', dropped.badActionNumbers === 3, String(dropped.badActionNumbers))
  ok('…a condition number that does not exist is dropped and counted (8)', dropped.badConditionNumbers === 1 && answer.coverage.length === 1 && JSON.stringify(answer.coverage[0].actions) === '[1,2]')
  ok('a missing item that cannot say what fails without it is dropped and counted; so is one with a category outside the three', dropped.missingWhatFails === 2 && answer.missing.length === 1 && answer.missing[0].item === 'A thing', String(dropped.missingWhatFails))
  ok('a [Ref: 99] the data never carried is FLAGGED, and the real [Ref: 5] is not', JSON.stringify(dropped.unknownRefs) === '["[Ref: 99]"]')
  ok('a proposed condition with no text is dropped; one with text is kept as a proposal', answer.proposedConditions.length === 1 && answer.proposedConditions[0].text === 'A new condition')
  control('a bad action number survives validation (must be FALSE)', answer.coverage[0].actions.includes(77) || answer.noDirectCondition.some((n) => n.action === 55))
  const empty = P.parseModelAnswer('garbage', basis)
  ok('a non-object answer validates to nothing, not a crash', empty.answer.answers.length === 0 && empty.answer.coverage.length === 0)

  section('A · the table "as the four see it" is COMPUTED from the four answers, not written by the judge')
  const mk = (model: string, cov: Array<[number, number[]]>): P.StoredModelOutput => ({ model, status: 'OK', answer: { answers: [{ question: 1, answer: 'a' }], coverage: cov.map(([condition, actions]) => ({ condition, actions })), noDirectCondition: [], weightBearing: [], missing: [], conflicts: [], proposedConditions: [] } })
  const outs = [mk(MODELS[0], [[1, [1, 2]], [2, []]]), mk(MODELS[1], [[1, [1, 2]], [2, []]]), mk(MODELS[2], [[1, [1, 2]], [2, []]]), mk(MODELS[3], [[1, [1, 3]], [2, []]])]
  const t = P.conditionTable(outs, ctx.conditions)
  const c1 = t.rows[0]
  const cell = (n: number) => c1.cells.find((c) => c.action === n)
  ok('four models answered', t.answering === 4)
  ok('action 1 named by all four reads "all four"', cell(1)?.label === 'all four' && cell(1)?.named === 4)
  ok('action 2 named by three reads "3 of 4"', cell(2)?.label === '3 of 4')
  ok('action 3 named by one reads "disputed"', cell(3)?.label === 'disputed')
  ok('a condition no model gave an action reads NO ACTION (nobody: true)', t.rows[1].nobody && t.rows[1].cells.length === 0)
  const failedOne = [...outs.slice(0, 3), { model: MODELS[3], status: 'FAILED' as const, error: 'timeout' }]
  const t3 = P.conditionTable(failedOne, ctx.conditions)
  ok('with one model failed the labels count the three that answered ("all three"), and the failed one is not counted as a "no"', t3.answering === 3 && t3.rows[0].cells.find((c) => c.action === 1)?.label === 'all three' && t3.rows[0].cells.find((c) => c.action === 2)?.label === 'all three' && !t3.rows[0].cells.some((c) => c.action === 3), JSON.stringify(t3.rows[0].cells))
  control('a one-model cell is labelled "all four" (must be FALSE)', cell(3)?.label === 'all four')
  ok('cellLabel: 2 answering, both named', P.cellLabel(2, 2) === 'both' && P.cellLabel(1, 2) === 'disputed')

  section('A · the judge\'s digest is validated too')
  const jr = P.parseJudge({
    answers: [{ question: 2, reconciled: 'Two #1 and #44 [Ref: 5] [Ref: 77]' }, { question: 1, reconciled: 'One' }],
    disagreements: [{ topic: 'Is it strong enough', positions: [{ model: MODELS[0], position: 'Yes' }, { model: 'some-other-model', position: 'No' }, { model: MODELS[2], position: 'No, because #2' }] }],
    weightBearing: [{ action: 1, why: 'a', namedBy: [MODELS[0]] }, { action: 2, why: 'b', namedBy: [MODELS[0], MODELS[1], MODELS[2]] }, { action: 9, why: 'c', namedBy: [] }],
    noDirectCondition: [], conflicts: [{ actions: [1, 50], what: 'Clash', namedBy: [MODELS[1], 'ghost'] }],
    gaps: [
      { item: 'Gap raised by one', whatFails: 'The duty cannot be enforced in practice here', category: 'legislative', namedBy: [MODELS[0]] },
      { item: 'Gap raised by three', whatFails: 'No consequence follows for reckless breach at all', category: 'organisational', namedBy: [MODELS[0], MODELS[1], MODELS[3]] },
      { item: 'Vague gap', whatFails: 'Nice to have', category: 'financial', namedBy: [MODELS[0]] },
    ],
    proposedConditions: [{ text: 'Extra condition', why: 'because', namedBy: [MODELS[2]] }],
  }, basis, MODELS)
  ok('the answers come back in question order', jr.digest.answers.map((a) => a.question).join() === '1,2')
  ok('the disagreement keeps each MODEL\'S POSITION by name and drops a position named for a model not on the panel (counted)', jr.digest.disagreements[0].positions.length === 2 && jr.digest.disagreements[0].positions.map((p) => p.model).join() === `${MODELS[0]},${MODELS[2]}` && jr.flags.unnamedModels >= 2, JSON.stringify(jr.flags))
  ok('an action the judge named that is not on the list (9, 50) is dropped and counted', jr.digest.weightBearing.every((w) => w.action !== 9) && jr.flags.badActionNumbers === 2, String(jr.flags.badActionNumbers))
  ok('gaps are RANKED by how many models named them, and one that cannot say what fails is dropped and counted', jr.digest.gaps.map((g) => g.item).join() === 'Gap raised by three,Gap raised by one' && jr.flags.missingWhatFails === 1)
  ok('weight-bearing actions are ranked by how many named them', jr.digest.weightBearing[0].action === 2)
  ok('a #44 and a [Ref: 77] in the judge\'s prose are FLAGGED (not removed)', JSON.stringify(jr.flags.strayCites) === '[44]' && JSON.stringify(jr.flags.unknownRefs) === '["[Ref: 77]"]', JSON.stringify(jr.flags))
  control('the judge\'s ghost model survives in a namedBy (must be FALSE)', jr.digest.conflicts[0].namedBy.includes('ghost'))
  ok('a proposed condition stays a proposal, named by its model', jr.digest.proposedConditions[0].namedBy[0] === MODELS[2])
  ok('#n inside HTML entities is not read as a citation', P.actionCitesIn('it&#39;s fine; see #7').join() === '7')

  section('A · stale, in words')
  const st = P.staleness(['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'c', 'd', 'e', 'f', 'g'])
  ok('five actions then, seven now: stale, 2 added, 0 out', st.stale && st.added === 2 && st.removed === 0 && st.then === 5 && st.now === 7)
  ok('the collapsed line reads "Digest · written 18 Oct · 5 actions then, 7 now"', P.digestLine('2026-10-18T10:00:00Z', st) === 'Digest · written 18 Oct · 5 actions then, 7 now', P.digestLine('2026-10-18T10:00:00Z', st))
  ok('…and the sentence under it says it is out of date, in the brief\'s form', /was written when “Legislation” had 5 actions; it now has 7/.test(P.staleSentence('HEADING', 'Legislation', st)))
  ok('an unchanged digest says so and is not stale', !P.staleness(['a'], ['a']).stale && /1 action, unchanged/.test(P.digestLine('2026-10-18T10:00:00Z', P.staleness(['a'], ['a']))))
  ok('the same count with different actions is still stale and says so', P.staleness(['a', 'b'], ['a', 'c']).stale && /added and 1 taken out/.test(P.digestLine('2026-10-18T10:00:00Z', P.staleness(['a', 'b'], ['a', 'c']))))
  control('a digest whose actions changed reads as not stale (must be FALSE)', !P.staleness(['a', 'b'], ['a', 'c']).stale)

  section('A · the price on the button is an estimate until measured, then from measurement')
  const before = P.DIGEST_RUNS.length
  ok('with no measured run the button says "estimate" and gives the brief\'s order', before > 0 || (P.digestPrice('HEADING', 8).basis === 'estimate' && /estimate/.test(P.digestPrice('HEADING', 8).words)))
  ok('every run over the 5p line asks first', P.digestPrice('HEADING', 8).pence > P.DIGEST_CONFIRM_ABOVE_PENCE && P.digestPrice('SET', 58).pence > P.DIGEST_CONFIRM_ABOVE_PENCE)
}

const DIGEST_QUESTIONS_IN = (s: string) => P.DIGEST_QUESTIONS.filter((q, i) => s.includes(`${i + 1}. ${q}`)).length

function partB() {
  section('B · 152/203 — the incentive map: a view that stores nothing')
  const rec = (direction: M.CellDirection, text = 'why', link: { text?: string; linkActionId?: string } = {}) => ({
    ...(direction !== 'UNANSWERED' ? { incentiveNow: { text, by: 'USER', at: 'x', direction } } : {}),
    // a stored slot always has text (setSlot clears one that has none), so a link carries words with it
    ...(link.text || link.linkActionId ? { whatChangesIt: { text: link.text ?? 'turned by the linked action', by: 'USER', at: 'x', linkActionId: link.linkActionId ?? null } } : {}),
  })
  const src = (n: number, who: string | null, direction: M.CellDirection, link: { text?: string; linkActionId?: string } = {}): M.MapSource => ({ id: `id${n}`, number: n, title: `Action ${n}`, practicalStep: `Step ${n}`, whoImplements: who, record: rec(direction, 'because', link) })
  // Cabinet Office: 9 actions, 3 with, 5 against, 1 unanswered - the brief's own example
  const co = 'The Cabinet Office (inside government)'
  const actions: M.MapSource[] = [
    src(1, co, 'WITH'), src(2, co, 'WITH'), src(3, co, 'WITH'),
    src(4, co, 'AGAINST', { linkActionId: 'id1' }), src(5, co, 'AGAINST', { linkActionId: 'id2' }), src(6, co, 'AGAINST', { text: 'The Cabinet Secretary will change it' }),
    src(7, co, 'AGAINST'), src(8, co, 'AGAINST', { linkActionId: 'gone' }), src(9, co, 'UNANSWERED'),
    src(10, 'HMT; Treasury Solicitor', 'INDIFFERENT'), src(11, 'HM Treasury', 'AGAINST'), src(12, null, 'UNANSWERED'),
  ]
  const rows = M.buildIncentiveMap(actions)
  const coRow = rows.find((r) => r.key === 'cabinet office')
  ok('the implementers are read from Who (the, brackets and punctuation do not split a body)', !!coRow && coRow.inside === true && coRow.cells.length === 9)
  ok('the summary is the brief\'s own sentence: "Cabinet Office — 9 actions: 3 with, 5 against, 1 unanswered"', coRow?.summary === 'Cabinet Office — 9 actions: 3 with, 5 against, 1 unanswered' || coRow?.summary === 'The Cabinet Office — 9 actions: 3 with, 5 against, 1 unanswered', coRow?.summary)
  ok('a cell is a SHAPE and a WORD, from one table', M.INCENTIVE_GLYPH.WITH === '▲' && M.INCENTIVE_GLYPH.AGAINST === '▼' && M.INCENTIVE_GLYPH.INDIFFERENT === '○' && M.INCENTIVE_GLYPH.UNANSWERED === '—' && M.INCENTIVE_WORD.UNANSWERED === 'not answered')
  const c4 = coRow!.cells.find((c) => c.action === 4)!, c6 = coRow!.cells.find((c) => c.action === 6)!, c7 = coRow!.cells.find((c) => c.action === 7)!, c8 = coRow!.cells.find((c) => c.action === 8)!
  ok('an AGAINST that relies on a live action says which: "turned by #1"', c4.changer?.kind === 'ACTION' && M.changerWords(c4.changer).startsWith('turned by #1'), M.changerWords(c4.changer))
  ok('an AGAINST turned only in words says so, and that no action is linked', c6.changer?.kind === 'WORDS' && /no action linked/.test(M.changerWords(c6.changer)))
  ok('an AGAINST with nothing recorded reads, in words, "AGAINST — nothing changes this"', c7.changer?.kind === 'NONE' && M.changerWords(c7.changer) === 'AGAINST — nothing changes this')
  ok('…and so does one whose linked action has left the live list', c8.changer?.kind === 'LINK_GONE' && /nothing changes this/.test(M.changerWords(c8.changer)))
  ok('the row names its AGAINST-with-nothing actions (7, 8)', JSON.stringify(coRow!.nothingChanges) === '[7,8]')
  control('an AGAINST with a live link is counted as nothing-changes-it (must be FALSE)', coRow!.nothingChanges.includes(4))
  ok('an action with no Who is not absent: it sits in a row of its own', rows.some((r) => r.key === M.NO_IMPLEMENTER_KEY && r.cells.length === 1 && r.name === M.NO_IMPLEMENTER_NAME))
  ok('that row sorts last', rows[rows.length - 1].key === M.NO_IMPLEMENTER_KEY)
  ok('a Who naming two bodies (";") puts the action under both', rows.some((r) => r.key === 'hmt') && rows.some((r) => r.key === 'treasury solicitor'))
  ok('text in Incentive now with NO direction chosen is not an answer to "which way"', M.directionOf({ ...src(1, co, 'UNANSWERED'), record: { incentiveNow: { text: 'just words', by: 'USER', at: 'x' } } }).direction === 'UNANSWERED')

  section('B · the step-2 checklist line (3d)')
  const line = M.incentiveChecklistLine(actions)
  ok('"3 actions rely on an implementer whose incentive is against and nothing changes it" (#7, #8 whose link has gone, and #11)', !!line && !line.done && /^3 actions rely on an implementer whose incentive is against and nothing changes it$/.test(line.text), line?.text)
  ok('…and it is in step 2\'s checklist, and not in step 1\'s', stepChecklist(2, actions.map((a) => ({ ...a, headingId: null, targetCauseIds: [], avenue: null, policyTest: null, conflictNote: null, wording: null, sequence: null, implementationCost: null, enforcementCost: null, regulatoryFriction: null, noCostReason: null })) as never, { duplicatesChecked: true }).some((l) => l.key === 'incentiveNothingChanges') && !stepChecklist(1, actions.map((a) => ({ ...a, headingId: null, targetCauseIds: [], avenue: null, policyTest: null, conflictNote: null, wording: null, sequence: null, implementationCost: null, enforcementCost: null, regulatoryFriction: null, noCostReason: null })) as never, { duplicatesChecked: true }).some((l) => l.key === 'incentiveNothingChanges'))
  const none = M.incentiveChecklistLine(actions.filter((a) => a.number !== 7 && a.number !== 8 && a.number !== 11))
  ok('with every AGAINST changed by something, the line reads done', !!none && none.done && /^No action relies/.test(none.text))

  section('B · spelling merges: Lex proposes, the user accepts')
  const merges = M.proposeSpellingMerges(rows)
  const hmt = merges.find((m) => m.from[0].key === 'hmt' || m.keep.toLowerCase().includes('hmt'))
  ok('"HMT" and "HM Treasury" are proposed as one body', !!hmt && /HMT/.test(hmt.why) && /HM Treasury/.test(hmt.why), JSON.stringify(merges))
  ok('"Treasury Solicitor" is NOT merged with "HM Treasury" (a different body)', !merges.some((m) => /Solicitor/i.test(m.why)))
  ok('the initials of a long name match its short form both ways ("Department for Education" → DfE)', M.proposeSpellingMerges(M.buildIncentiveMap([src(1, 'DfE', 'WITH'), src(2, 'Department for Education', 'WITH')])).length === 1)
  ok('two unrelated bodies are not proposed', M.proposeSpellingMerges(M.buildIncentiveMap([src(1, 'The Cabinet Office', 'WITH'), src(2, 'HM Revenue and Customs', 'WITH')])).length === 0)
  ok('renaming writes the new spelling and leaves the inside/outside note and the other bodies alone', M.renameImplementer('HMT (inside government); Treasury Solicitor', 'hmt', 'HM Treasury') === 'HM Treasury (inside government); Treasury Solicitor', M.renameImplementer('HMT (inside government); Treasury Solicitor', 'hmt', 'HM Treasury'))
  const annexe = M.incentiveAnnexe(rows)
  const coPara = annexe.find((p) => p.key === 'cabinet office')!
  ok('the annexe has one paragraph per implementer, from the slots', annexe.length === rows.length && coPara.actionNumbers.length === 9)
  ok('…it says what they must do, which way the incentive pulls, and what changes it', /must carry out 9 actions/.test(coPara.text) && /against on #7/.test(coPara.text) && /for #7, the record names nothing that changes it/.test(coPara.text), coPara.text)
  ok('…and the unanswered is shown as unanswered', /not answered for #9/.test(coPara.text) && /No implementer is named yet for 1 action/.test(annexe.find((p) => p.key === M.NO_IMPLEMENTER_KEY)!.text))
}

async function partC() {
  section('C · the digest row, on a scratch copy of Charlie\'s idea (no model is called)')
  const probe = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = probe
  const copy = await scratchCopy('452c5ade', 't1')
  const id = copy.id
  try {
    const live = await prisma.lexCoherentAction.findMany({ where: { ideaId: id, status: 'LIVE' }, orderBy: { number: 'asc' }, select: { id: true, number: true } })
    ok('the copy has live actions to read', live.length >= 10, String(live.length))
    if (live.length < 10) return
    const h1 = await S.createHeading(id, 'T1 first'); const h2 = await S.createHeading(id, 'T1 second'); const hEmpty = await S.createHeading(id, 'T1 empty')
    if (!h1.ok || !h2.ok || !hEmpty.ok) { ok('headings made', false); return }
    await S.assignHeading(id, live.slice(0, 5).map((r) => r.id), h1.data.id)
    await S.assignHeading(id, live.slice(5, 8).map((r) => r.id), h2.data.id)
    await CD.seedConditions(id, copy.userId, CHARLIES_TEN, CONDITIONS_SOURCE)

    const emptyTry = await D.startDigest(id, copy.userId, 'HEADING', hEmpty.data.id)
    ok('a heading with no live actions is refused, in words, and nothing is started', !emptyTry.ok && /no live actions/.test((emptyTry as { error: string }).error) && (await prisma.actionDigest.count({ where: { ideaId: id } })) === 0)
    const badHeading = await D.startDigest(id, copy.userId, 'HEADING', 'not-a-heading')
    ok('a heading that is not on the idea is refused in words', !badHeading.ok && /not on this idea/.test((badHeading as { error: string }).error))

    const started = await D.startDigest(id, copy.userId, 'HEADING', h1.data.id)
    ok('a digest starts: RUNNING, four panel slots PENDING, the five live actions it will read recorded', started.ok && started.data.status === 'RUNNING' && started.data.models.length === 4 && started.data.models.every((m) => m.status === 'PENDING') && started.data.staleness.then === 5, JSON.stringify(started.ok ? started.data.models : started))
    const row = started.ok ? await prisma.actionDigest.findUnique({ where: { id: started.data.id } }) : null
    ok('…the row holds exactly the ids of the heading\'s live actions', !!row && row.actionIds.length === 5 && live.slice(0, 5).every((r) => row.actionIds.includes(r.id)))
    ok('…and the panel is the four price-matched models', !!row && JSON.stringify((row.modelOutputs as Array<{ model: string }>).map((m) => m.model)) === JSON.stringify(MODELS))
    const second = await D.startDigest(id, copy.userId, 'HEADING', h1.data.id)
    ok('a second digest of the same heading while one is under way is refused, in words (one at a time)', !second.ok && /already under way/.test((second as { error: string }).error))
    const otherHeading = await D.startDigest(id, copy.userId, 'HEADING', h2.data.id)
    ok('…but a different heading is not blocked', otherHeading.ok)

    // stale: a sixth action joins the heading
    await S.assignHeading(id, [live[8].id], h1.data.id)
    const views = await D.listDigests(id)
    const v1 = views.find((v) => v.headingId === h1.data.id)
    ok('after an action joins the heading the digest is STALE: "5 actions then, 6 now"', !!v1 && v1.staleness.stale && / 5 actions then, 6 now$/.test(v1.line) && /had 5 actions; it now has 6/.test(v1.staleSentence ?? ''), v1?.line)
    ok('…and a digest of a heading nobody touched is not stale', views.find((v) => v.headingId === h2.data.id)?.staleness.stale === false)
    control('the stale heading reads as unchanged (must be FALSE)', v1?.staleness.stale === false)
    ok('the quote gives a price per heading and for the set - an estimate until a run is measured', (await D.digestQuote(id)).headings[h1.data.id].price.basis === (P.DIGEST_RUNS.length ? 'measured' : 'estimate'))

    section('C · the judge\'s page becomes SUGGESTIONS on a press, never actions; a model\'s condition becomes a PROPOSAL')
    const modelsOut: P.StoredModelOutput[] = MODELS.map((m, i) => ({
      model: m, status: 'OK' as const, pence: 1, answer: {
        answers: [{ question: 1, answer: `answer ${m}` }], coverage: [{ condition: 1, actions: i < 3 ? [live[0].number!] : [] }, { condition: 2, actions: [] }],
        noDirectCondition: [], weightBearing: [], missing: [], conflicts: [], proposedConditions: [],
      },
    }))
    const judge: P.StoredJudge = {
      digest: {
        answers: [{ question: 1, reconciled: 'Reconciled one' }],
        disagreements: [{ topic: 'Topic', positions: [{ model: MODELS[0], position: 'Yes' }, { model: MODELS[3], position: 'No' }] }],
        weightBearing: [], noDirectCondition: [], conflicts: [],
        gaps: [
          { item: 'T1 gap alpha: a named owner for every handover', whatFails: 'A handover with no owner has nobody to answer for it', category: 'organisational', namedBy: [MODELS[0], MODELS[1], MODELS[2]] },
          { item: 'T1 gap beta: a statutory duty to publish the standard', whatFails: 'The standard stays private and cannot be tested by anyone', category: 'legislative', namedBy: [MODELS[3]] },
        ],
        proposedConditions: [{ text: 'T1 proposed condition: independent review every five years', why: 'No condition asks for a review', namedBy: [MODELS[1]] }],
      },
      flags: { badActionNumbers: 0, unnamedModels: 0, missingWhatFails: 0, unknownRefs: [], strayCites: [] }, handled: { gaps: {}, conditions: {} }, trimmedCommentaries: 0, commentaryMax: null,
    }
    const ready = await prisma.actionDigest.create({
      data: { ideaId: id, scope: 'HEADING', headingId: h2.data.id, headingName: 'T1 second', status: 'READY', actionIds: live.slice(5, 8).map((r) => r.id), modelOutputs: modelsOut as never, judgeOutput: judge as never, spentPence: 4, startedBy: copy.userId },
    })
    const liveBefore = await prisma.lexCoherentAction.count({ where: { ideaId: id, status: 'LIVE' } })
    const readyView = await D.getDigest(id, ready.id)
    ok('a READY digest reads back with its table computed from the four answers: action #' + live[0].number + ' for condition 1 is "3 of 4"', readyView?.table?.rows[0].cells[0]?.label === '3 of 4' && readyView.table.rows[1].nobody, JSON.stringify(readyView?.table?.rows[0]))
    ok('…and each model\'s own answer is kept to read beside the digest', readyView?.modelAnswers.length === 4)
    const all = await D.suggestGaps(id, ready.id)
    ok('"Add the gaps as suggestions" adds both', all.ok && all.data.added === 2 && all.data.skipped === 0, JSON.stringify(all))
    ok('…and creates NO action', (await prisma.lexCoherentAction.count({ where: { ideaId: id, status: 'LIVE' } })) === liveBefore)
    const g = await listGapSuggestions(id)
    const alpha = g.suggestions.find((s) => s.text.startsWith('T1 gap alpha'))
    ok('the suggestions list shows each "From: the digest, 3 of 4 models", with what fails without it and its category', alpha?.raisedBy.startsWith('From: the digest, 3 of 4 models') === true && /nobody to answer for it/.test(alpha.whatFails) && alpha.category === 'organisational', alpha?.raisedBy)
    ok('…marked NOT_TESTED against the policy (no test was made, and it says so)', alpha?.verdict === 'NOT_TESTED' && /not yet tested/.test(alpha.reason ?? ''))
    const again = await D.suggestGaps(id, ready.id)
    ok('pressing it again adds nothing (both already added) - no duplicate suggestion', again.ok && again.data.added === 0 && again.data.skipped === 2 && (await prisma.actionIdea.count({ where: { ideaId: id, text: { startsWith: 'T1 gap alpha' } } })) === 1)
    const afterHandled = await D.getDigest(id, ready.id)
    ok('the digest remembers which gaps were added (the screen shows "Added as a suggestion")', Object.keys(afterHandled!.judge!.handled.gaps).length === 2)
    const oneBad = await D.suggestGaps(id, ready.id, 9)
    ok('a gap index that is not on the digest is refused in words', !oneBad.ok && /not on this digest/.test((oneBad as { error: string }).error))
    const accepted = alpha ? await acceptGapSuggestion(id, alpha.id) : { ok: false }
    ok('only ACCEPT makes an action - exactly one, with its avenue set from the gap\'s category', accepted.ok && (await prisma.lexCoherentAction.count({ where: { ideaId: id, status: 'LIVE' } })) === liveBefore + 1 && (await prisma.lexCoherentAction.findFirst({ where: { ideaId: id, practicalStep: { startsWith: 'T1 gap alpha' } }, select: { avenue: true } }))?.avenue === 'ORGANISATIONAL')
    control('suggesting the gaps created an action before accept (must be FALSE)', (await prisma.lexCoherentAction.count({ where: { ideaId: id, practicalStep: { startsWith: 'T1 gap beta' } } })) > 0)

    // the proposed condition: through the module's own writer (the judge stage calls it)
    const condsBefore = await readConditions(id)
    const prop = await CD.proposeCondition(id, judge.digest.proposedConditions[0].text, 'From the digest, 1 of 4 models. No condition asks for a review')
    const condsAfter = await readConditions(id)
    ok('a model\'s extra condition lands as a PROPOSAL in the conditions panel, and the list of conditions is unchanged', prop.ok && condsAfter.proposals.length === condsBefore.proposals.length + 1 && condsAfter.items.length === condsBefore.items.length)

    section('C · through the real route: rejections name the input, in words (CLAUDE.md §30)')
    const call = async (body: Record<string, unknown>) => {
      const { POST } = await import('../app/api/ideas/[id]/action-digest/route')
      const res = await POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
      return { status: res.status, json: (await res.json()) as { ok?: boolean; error: string | null; result?: unknown } }
    }
    const noHeading = await call({ op: 'start', scope: 'HEADING' })
    ok('a heading digest with no heading is refused (422) and the message names the input', noHeading.status === 422 && !!noHeading.json.error && /heading|scope/i.test(noHeading.json.error) && !/not valid\.?$/.test(noHeading.json.error), noHeading.json.error ?? '')
    const wrongKey = await call({ op: 'advance', id: 'x' })
    ok('the wrong key ("id" for "digestId") is refused and names "the digest"', wrongKey.status === 422 && /the digest/.test(wrongKey.json.error ?? ''), wrongKey.json.error ?? '')
    const noOp = await call({ op: 'frobnicate' })
    ok('an unknown control is worded, not bare', noOp.status === 422 && !!noOp.json.error && noOp.json.error.length > 30, noOp.json.error ?? '')
    const gone = await call({ op: 'advance', digestId: 'nothing-here' })
    ok('an unknown digest is refused in words', gone.status === 422 && /not on this idea/.test(gone.json.error ?? ''))
    const viaRoute = await call({ op: 'suggestGaps', digestId: ready.id })
    ok('through the route the already-added gaps are skipped, not duplicated', viaRoute.status === 200 && (viaRoute.json.result as { added: number }).added === 0)
    const get = await (await import('../app/api/ideas/[id]/action-digest/route')).GET(new Request('http://internal.invalid/'), { params: Promise.resolve({ id }) })
    const gj = (await get.json()) as { digests: Array<{ scope: string; headingId: string | null }>; quote: { set: { actions: number } } }
    ok('GET gives the newest digest of each scope and the quote', get.status === 200 && gj.digests.length >= 2 && gj.quote.set.actions >= 10)

    section('C · the map\'s only write: a spelling merge goes through the Who writer')
    const [a1, a2] = live.slice(10, 12)
    if (a1 && a2) {
      await setSlot(id, a1.id, 'who', { text: 'T1MT (inside government)' }, 'USER')
      await setSlot(id, a2.id, 'who', { text: 'T1 Municipal Treasury' }, 'USER')
      const done = await mergeImplementerSpellings(id, ['t1mt'], 'T1 Municipal Treasury')
      const after = await prisma.lexCoherentAction.findUnique({ where: { id: a1.id }, select: { whoImplements: true, record: true } })
      ok('"T1MT" becomes "T1 Municipal Treasury (inside government)" on the action that used it', done.ok && after?.whoImplements === 'T1 Municipal Treasury (inside government)', after?.whoImplements ?? '')
      ok('…the write records who wrote it and when (the same writer as the screen)', !!(after?.record as { who?: { by?: string; at?: string } } | null)?.who?.at)
      const untouched = await prisma.lexCoherentAction.findUnique({ where: { id: a2.id }, select: { whoImplements: true } })
      ok('…and an action already using the chosen spelling is left alone', untouched?.whoImplements === 'T1 Municipal Treasury')
      const nothing = await mergeImplementerSpellings(id, ['no such body'], 'X')
      ok('a merge that matches no action is refused in words and changes nothing', !nothing.ok && /No live action uses the spelling/.test((nothing as { error: string }).error))
    } else skip('spelling merge through the Who writer', 'the copy has fewer than twelve live actions')
  } finally { await deleteScratch(id) }
  ok('the scratch copy and its digests are gone (cascade)', (await prisma.actionDigest.count({ where: { ideaId: id } })) === 0 && !(await prisma.idea.findUnique({ where: { id } })))
}

async function main() {
  partA()
  partB()
  await partC()
  section('NOT RUN HERE, AND SAID SO (BRIEF_26T §2g)')
  skip('six answers present per model, from a real run', 'needs the four models and the judge - scripts/measure-lex-digest.ts')
  skip('the judge\'s disagreement section names a model where the fixture plants a disagreement', 'needs the judge - scripts/measure-lex-digest.ts')
  skip('every action number the live digest cites exists and is live', 'needs a live digest - scripts/measure-lex-digest.ts')
  skip('a real browser: the button, its confirm, the collapsed line, the By who toggle', 'check:lex-26t-browser')
  console.log(`\n${pass} passed, ${fail} failed — ${ran} assertions RAN, ${controls} controls (${dead} dead), ${notRun} NOT RUN`)
  process.exit(fail || dead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
