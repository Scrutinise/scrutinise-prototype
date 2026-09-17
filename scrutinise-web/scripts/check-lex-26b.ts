// ─────────────────────────────────────────────────────────────────────────────
// check:lex-26b — the instrument comes out of the kernel, not in before it.
//
// Three kinds of assertion, and each says which it is (docs/CLAUDE.md §25/§26):
//   SOURCE — properties that genuinely are about source (a string is gone from a prompt; a
//            question fires on the legislative avenue; nothing branches on `goalKind`).
//   FIXTURE — a scratch idea this check owns: a DONE build with three avenue rows, one that does
//            not apply, an existing-power finding, a search-failed gap — then the Initial
//            Questions body and the agenda read back through the product's own assemblers.
//            Deleted in a `finally`.
//   COLD READ — the most recently completed builds, whatever state they are in, read with plain
//            Prisma: do they carry three avenues, to comparable depth? Builds before 26-B are
//            NOT CHECKED and counted, never skipped silently.
//
// Run: npx tsx --env-file=.env scripts/check-lex-26b.ts
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { composeInitialQuestions, itemsWithoutRoute } from '../lib/documents/build-initial-questions'
import { buildAgenda } from '../lib/lex/agenda'
import { depthReport, AVENUES, avenueStateLine, NOT_NEEDED_SENTENCE, INSUFFICIENT_SENTENCE, normaliseAvenues } from '../lib/lex/build-avenues'
import { kindOf } from '../lib/lex/known-unknowns'
import { readKnownUnknowns } from '../lib/lex/deepening'
import { INTERROGATION_LIBRARY } from '../lib/lex/interrogation-library'
import { ELICITATION_STEPS } from '../lib/lex/elicitation-config'
import { buildRerunChecklist } from '../lib/lex/rerun-checklist'

let pass = 0, fail = 0
const ok = (label: string, cond: boolean, detail?: string) => {
  if (cond) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const controls: Array<{ label: string; fired: boolean }> = []
const control = (label: string, holdsOnBroken: () => boolean) => {
  let held = false
  try { held = holdsOnBroken() } catch { held = false }
  controls.push({ label, fired: !held })
}
const unverified: string[] = []
const src = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '')

/** §3a — the threshold "systematic shortfall" is held to: the median per-build ratio of the
 *  shortest avenue treatment to the longest. 0.5 means the thinnest avenue gets at least half
 *  the words of the fullest, per build, on the median build. */
const DEPTH_RATIO_FLOOR = 0.5

async function main() {
  console.log('\n── check:lex-26b — the instrument comes out of the kernel ──\n')

  // ══ SOURCE ══════════════════════════════════════════════════════════════════
  console.log('§2 — the elicitation (source)')
  const goal = ELICITATION_STEPS.find((s) => s.key === 'goal')
  ok('the goal step asks what should be different — the outcome, not the method (26-B §2 decided)', !goal?.optional && /What do you want to be different/.test(goal?.question ?? '') && /not how it should be done/.test(goal?.question ?? ''))
  ok('the other-information step merges knowledge and reading, and asks for the upload in words', /add it with the \+/i.test(ELICITATION_STEPS.find((s) => s.key === 'ownKnowledge')?.question ?? ''))
  ok('the reading step is gone from the sequence and the ruled-out box from the card', !ELICITATION_STEPS.some((s) => s.key === 'reading') && !/ruledOut/.test(src('components/lex/ElicitationCards.tsx')))
  ok('the card highlights the encouragement to upload, from the shared constant', /UPLOAD_ENCOURAGEMENT\}/.test(src('components/lex/ElicitationCards.tsx')))
  ok('the problem step is first and required', ELICITATION_STEPS[0]?.key === 'problem' && !ELICITATION_STEPS[0]?.optional)
  const webFiles = ['lib/lex/elicitation.ts', 'lib/lex/elicitation-client.ts', 'lib/lex/build-config.ts', 'lib/lex/testimony.ts', 'lib/lex/page-one.ts', 'lib/lex/build.ts', 'lib/lex/build-research.ts', 'lib/lex/interrogation-library.ts', 'components/lex/ElicitationCards.tsx', 'app/ideas/build/BuildIdeaClient.tsx']
  ok('nothing branches on goalKind anywhere in the build or the elicitation', webFiles.every((f) => !/goalKind\s*===|===\s*['"]LAW_CHANGE|isGoalKind\(|GOAL_KINDS/.test(src(f))))
  control('a branch on goalKind would be caught', () => !/goalKind\s*===/.test("if (row.goalKind === 'LAW_CHANGE') {"))
  ok('the goal answer reaches prompts as testimony, labelled as their words and not a setting',
    /WHAT THEY WANT TO BE DIFFERENT — the outcome, in their own words \(testimony, not a setting/.test(src('lib/lex/testimony.ts'))
    && /WHAT THEY WANT TO BE DIFFERENT/.test(src('lib/lex/build-config.ts')))
  ok('the four goal buttons are gone from the card', !/A change in the law|Not sure yet/.test(src('components/lex/ElicitationCards.tsx')))

  console.log('\n§3 — the three avenues (source)')
  const bc = src('lib/lex/build-client.ts')
  ok('the approach pass no longer asks for an instrument', !/`instrument`\s+— ⚠ THE QUESTION THIS SPRINT ADDS/.test(bc) && !/INSTRUMENTS\.join/.test(bc))
  ok('the actions pass takes no assumed instrument', !/THE INSTRUMENT YOU ASSUMED: \$\{input\.instrument\}`,\n    \]\.join/.test(bc) && !/instrument: string\n\}\): Promise<LlmResult<ActionsOutput>>/.test(bc))
  ok('the actions pass demands three avenues to comparable depth', /avenues: AVENUE_SCHEMA/.test(bc) && /COMPARABLE LENGTH AND SPECIFICITY/.test(src('lib/lex/build-avenues.ts')))
  ok('an avenue that is not needed must say so and why, and the prompt keeps NOT_NEEDED and INSUFFICIENT apart', /whyNotApplicable/.test(src('lib/lex/build-avenues.ts')) && /NOT_NEEDED and INSUFFICIENT are opposite statements/.test(src('lib/lex/build-avenues.ts')))
  const ep = INTERROGATION_LIBRARY.find((q) => q.retiresTheInstrument)
  ok('the existing-power question fires on the legislative avenue (instrumentIsPrimary is true by construction)',
    !!ep && ep.firesWhen({ text: '', instrument: 'LEGISLATIVE:\n1. draft', instrumentIsPrimary: true, devolution: 'unknown', namesExistingLaw: false, hasCauses: true, hasChosenApproach: true })
    && /const instrumentIsPrimary = !!legislative \|\|/.test(src('lib/lex/build-research.ts')))
  ok('the "must be reconsidered before anything else" override is gone from the research carry',
    !/This must be reconsidered before anything else/.test(src('lib/lex/build-research.ts')))
  control('the old override line would be caught', () => !/This must be reconsidered before anything else/.test('x This must be reconsidered before anything else in the revision.'))
  ok('the finding lands on the legislative avenue row, not on a fork', /recordExistingPowerOnLegislativeAvenue/.test(src('lib/lex/build.ts')) && !/recordInstrumentRetirement\(/.test(src('lib/lex/build.ts')))
  ok('the smart pass is told the avenues are not its to choose between', /THE THREE AVENUES ARE NOT YOURS TO CHOOSE BETWEEN/.test(src('lib/lex/build-smart.ts')))
  ok('the outside panel is no longer told "if the obvious answer (a new Act) is wrong"', !/If the obvious answer \(a new Act\) is wrong/.test(src('lib/lex/build-smart.ts')))

  console.log('\n§7b — the four quotations are out of the prompts (source, comments stripped)')
  const promptFiles = ['lib/lex/build-client.ts', 'lib/lex/testimony.ts', 'lib/lex/build-query.ts', 'lib/lex/build-smart.ts', 'lib/lex/method.ts', 'lib/lex/deepening-client.ts', 'lib/lex/build-avenues.ts']
  for (const phrase of ['cushy jobs', 'private solicitor', 'outcome owners', 'Osmotherly', 'Carltona']) {
    ok(`"${phrase}" appears in no prompt string`, promptFiles.every((f) => !src(f).includes(phrase)))
  }
  control('a quotation left in a prompt would be caught', () => !'"the Cabinet Office can compel departments to publish outcome owners"'.includes('outcome owners'))

  // ══ FIXTURE ═════════════════════════════════════════════════════════════════
  console.log('\n§4/§7a — the document and the agenda (fixture, owned and deleted)')
  const owner = await prisma.user.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } })
  if (!owner) throw new Error('no user to own the fixture')
  let ideaId: string | null = null
  try {
    const idea = await prisma.idea.create({
      data: { title: '[check:lex-26b] scratch', summaryDescription: 'Temporary. Deleted by the check.', govtArea: '', creatorId: owner.id },
      select: { id: true },
    })
    ideaId = idea.id
    const build = await prisma.ideaBuild.create({ data: { ideaId, version: 1, status: 'DONE', framing: 'B_CONTEXTUALISED', completedAt: new Date() }, select: { id: true } })
    const long = 'x'.repeat(40)
    await prisma.buildAvenue.createMany({ data: [
      { buildId: build.id, ideaId, avenue: 'LEGISLATIVE', applies: true, state: 'FROM_DEBATE', debate: { tried: [{ what: 'A 2014 uprating order', whatHappened: 'laid, then withdrawn after a Commons prayer' }], recommendedNeverImplemented: [{ what: 'index-linking', byWhom: 'the Transport Committee, 2019' }], stillUnsolved: 'the level has not moved since 2013', offListNote: 'An approach not on this list — a per-offence tariff set by the courts — may be what is needed.' }, draft: `1. Introduce a Bill amending s.36 — Department for Transport ${long}`, difficulty: `Second reading is where it dies if the Whips do not want it. ${long}`, tradeoffs: `Durable; slow; reversible only by Parliament. ${long}`, rulesIn: 'a Bill slot', rulesOut: 'acting this year', whatWouldSettleIt: 'whether the existing s.36 direction power reaches uprating — if it does, the Bill is unnecessary', existingPower: 'Road Traffic Act 1988, s.36(3)', existingPowerReach: 'partial: it reaches part of this and not the rest.', chars: 3 * 40 + 120 },
      { buildId: build.id, ideaId, avenue: 'ORGANISATIONAL', applies: true, state: 'INSUFFICIENT', draft: `1. Direct the agency to reissue guidance — Secretary of State ${long}`, difficulty: `No stage kills it; the agency can slow-walk it. ${long}`, tradeoffs: `Fast; reversible by the next minister. ${long}`, rulesIn: 'ministerial attention', rulesOut: 'a statutory footing', whatWouldSettleIt: 'whether the agency has ever complied with a direction of this kind without a statutory hook', chars: 3 * 40 + 110 },
      { buildId: build.id, ideaId, avenue: 'FINANCIAL', applies: false, state: 'NOT_NEEDED', whyNotApplicable: 'The penalty level is set in statute; no grant or charge changes it.', draft: '1. (none — does not apply)', difficulty: 'n/a', tradeoffs: 'n/a', rulesIn: '', rulesOut: '', whatWouldSettleIt: 'a reading of the enabling section showing a charge could substitute', chars: 30 },
    ] })
    await prisma.deepeningPass.create({ data: { ideaId, passKey: 'question:CAUSAL_EVIDENCE', status: 'RUN', runVersion: 1,
      knownUnknowns: [
        { question: 'How many notices go unpaid?', why: 'Nothing retrieved answered this.', kind: 'unanswered' },
        { question: 'Everything a working CAUSAL_EVIDENCE search would have covered', why: 'At least one of this question’s searches failed to run.', kind: 'search-failed' },
        { question: 'Was the freeze deliberate?', why: 'At least one of this question’s searches failed to run.' },
      ] } })

    const snap = await composeInitialQuestions(ideaId, build.id, 1, { late: true })
    const body = snap.body
    ok('the route section leads the document', body.indexOf('## Which route: legislative, organisational, or financial') < body.indexOf('## Decisions waiting on you'))
    for (const k of AVENUES) ok(`the ${k.toLowerCase()} avenue is listed`, new RegExp(`\\*\\*${k.charAt(0) + k.slice(1).toLowerCase()} —`).test(body))
    ok('each avenue says what taking it rules in and out', (body.match(/Taking it rules in:/g) ?? []).length === 3)
    // §10 — the four states, in the document, in plain words; 3 and 4 never confused.
    ok('§10 — the not-needed avenue prints Charlie\'s sentence as a FINDING, with the reason', body.includes('with no financial change required') && body.includes('The penalty level is set in statute'))
    ok('§10 — the insufficient avenue prints Charlie\'s sentence as an ABSENCE, verbatim', body.includes(INSUFFICIENT_SENTENCE))
    ok('§10 — the insufficient avenue is followed by what would settle it', new RegExp(INSUFFICIENT_SENTENCE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]{0,900}?What would settle it:').test(body))
    ok('§10 — the not-needed sentence never appears on the insufficient avenue, nor the reverse',
      (() => { const org = body.slice(body.indexOf('**Organisational'), body.indexOf('**Financial')); const fin = body.slice(body.indexOf('**Financial'), body.indexOf('## Decisions')); return !org.includes('no organisational change required') && !fin.includes(INSUFFICIENT_SENTENCE) })())
    control('a renderer that swapped states 3 and 4 would be caught', () => {
      const swapped = avenueStateLine({ avenue: 'ORGANISATIONAL', state: 'INSUFFICIENT', applies: true, whyNotApplicable: null, restsOn: null })
      return swapped.line.includes('no organisational change required')
    })
    control('a renderer that printed the finding for an absence would be caught', () =>
      avenueStateLine({ avenue: 'LEGISLATIVE', state: 'INSUFFICIENT', applies: true, whyNotApplicable: null, restsOn: null }).line === NOT_NEEDED_SENTENCE)
    ok('§10 — a missing state is never defaulted to INSUFFICIENT (an absence asserted by default)',
      normaliseAvenues([{ avenue: 'FINANCIAL', state: '', applies: true, actions: [], difficulty: '', tradeoffs: '', rulesIn: '', rulesOut: '', whatWouldSettleIt: '' }])[0].state === 'DRAFTED')
    ok('§11 — where a debate exists, the document names what was tried and what happened', body.includes('What was tried, and what happened to it: A 2014 uprating order — laid, then withdrawn'))
    ok('§11 — and keeps recommended-never-implemented apart from tried', body.includes('What was recommended and never implemented (a different thing from what was tried): index-linking (the Transport Committee, 2019)'))
    ok('§11 — and what is still unsolved, and that an off-list approach may be needed', body.includes('still unsolved: the level has not moved since 2013') && body.includes('An approach not on this list'))
    ok('§11 — the debate paragraph appears ONLY on the avenue with a debate (no boilerplate on every avenue)', (body.match(/What was tried, and what happened to it/g) ?? []).length === 1)
    control('boilerplate on every avenue would be caught', () => (body.match(/What was tried, and what happened to it/g) ?? []).length === 3)
    ok('the existing-power finding sits with the legislative avenue as a finding', /Finding from the research: an existing power — Road Traffic Act 1988, s\.36\(3\)/.test(body))
    ok('each avenue ends on what would settle it, and it is evidence', /What would settle it: whether the existing s\.36 direction power reaches uprating/.test(body))
    ok('every item in the document states what would settle it', itemsWithoutRoute(body).length === 0, itemsWithoutRoute(body).join(' | '))
    control('an avenue with no route would be caught', () => itemsWithoutRoute('## X\n\n- **Legislative — x**\n  The steps: y\n\n## Y').length === 0)

    // §7a — the gap's kind survives the reader and the agenda files a failed search as ours.
    const rows = await prisma.deepeningPass.findMany({ where: { ideaId }, select: { knownUnknowns: true } })
    const read = rows.flatMap((r) => readKnownUnknowns(r.knownUnknowns))
    ok('readKnownUnknowns keeps the kind', read.some((g) => g.kind === 'search-failed') && read.some((g) => g.kind === 'unanswered'))
    ok('an untagged row is classified from its producer sentence (shared kindOf)', kindOf(read.find((g) => g.question === 'Was the freeze deliberate?')!) === 'search-failed')
    const agenda = await buildAgenda(ideaId)
    const limitation = agenda.gaps.filter((g) => g.task === 'limitation')
    const research = agenda.gaps.filter((g) => g.task === 'research')
    ok('the agenda files the failed searches as OUR limitation, not the user\'s research', limitation.length === 2 && research.length === 1, `limitation ${limitation.length}, research ${research.length}`)
    // The property: at least one gap is classified as ours. On rows with the kind AND the sentence
    // stripped, the shared classifier has nothing to go on and files all three as research.
    control('rows stripped of kind and sentence would all read as research', () => read.map((g) => ({ question: g.question, why: '' })).some((g) => kindOf(g) === 'search-failed'))
    ok('the document classifies the same gap the same way', /our limitation/.test(body) && /nothing retrieved answered it/.test(body))

    // §6 — the checklist is drawn from the idea's state and omits what has nothing to count
    const cl = await buildRerunChecklist(ideaId, owner.id)
    ok('the checklist omits rows with nothing to count (no forks, no fields, no issues, no documents on this fixture)', cl.items.length === 0)
    await prisma.buildFork.create({ data: { ideaId, buildId: build.id, forkKey: 'diagnosis:rootCause', fieldKey: 'rootCause', alternativeIndex: 0, chosen: 'a', alternative: 'b', caseForAlternative: 'c', resolved: false } })
    await prisma.deepeningIssue.create({ data: { ideaId, passKey: 'ADVERSARIAL', runVersion: 1, status: 'OPEN', text: 'a challenge' } })
    await prisma.document.create({ data: { ideaId, kind: 'INITIAL_BACKGROUND', status: 'ready', summary: 's', body: 'b', buildId: build.id, buildVersion: 1 } })
    const cl2 = await buildRerunChecklist(ideaId, owner.id)
    const dec = cl2.items.find((i) => i.key === 'derived:decisions')
    const ch = cl2.items.find((i) => i.key === 'derived:challenges')
    ok('a decision row appears, derived, 0 of 1', dec?.kind === 'derived' && dec.progress?.done === 0 && dec.progress?.of === 1 && !dec.done)
    ok('a challenge row appears, derived, 0 of 1', ch?.kind === 'derived' && ch.progress?.of === 1 && !ch.done)
    ok('the briefing row appears as a recorded (user-tickable) box', cl2.items.find((i) => i.key === 'recorded:read-briefing')?.kind === 'recorded')
    await prisma.buildFork.updateMany({ where: { buildId: build.id }, data: { resolved: true, resolvedChoice: 'chosen' } })
    await prisma.deepeningIssue.updateMany({ where: { ideaId }, data: { status: 'ADDRESSED' } })
    await prisma.ideaWorklistTick.create({ data: { ideaId, userId: owner.id, itemKey: 'recorded:read-briefing' } })
    const cl3 = await buildRerunChecklist(ideaId, owner.id)
    ok('the work ticks the derived rows; the user ticks the recorded one; the list reports complete', cl3.complete && cl3.items.every((i) => i.done))
    control('a list with an open row is not complete', () => cl2.complete)
  } finally {
    if (ideaId) {
      await prisma.ideaWorklistTick.deleteMany({ where: { ideaId } }).catch(() => {})
      await prisma.document.deleteMany({ where: { ideaId } }).catch(() => {})
      await prisma.deepeningIssue.deleteMany({ where: { ideaId } }).catch(() => {})
      await prisma.deepeningPass.deleteMany({ where: { ideaId } }).catch(() => {})
      await prisma.buildFork.deleteMany({ where: { ideaId } }).catch(() => {})
      await prisma.buildAvenue.deleteMany({ where: { ideaId } }).catch(() => {})
      await prisma.ideaBuild.deleteMany({ where: { ideaId } }).catch(() => {})
      await prisma.idea.delete({ where: { id: ideaId } }).catch(() => {})
      const gone = await prisma.idea.findUnique({ where: { id: ideaId }, select: { id: true } })
      ok('fixture deleted (re-read)', gone === null)
    }
  }

  // ══ COLD READ ═══════════════════════════════════════════════════════════════
  console.log('\n§3a — the depth of each avenue, on real builds (cold read, plain Prisma)')
  const recent = await prisma.ideaBuild.findMany({ where: { status: 'DONE' }, orderBy: { completedAt: 'desc' }, take: 5, select: { id: true, ideaId: true, version: true, completedAt: true } })
  let checked = 0
  for (const b of recent) {
    const av = await prisma.buildAvenue.findMany({ where: { buildId: b.id }, select: { avenue: true, applies: true, chars: true, whyNotApplicable: true } })
    if (!av.length) { unverified.push(`build ${b.ideaId.slice(0, 8)} v${b.version} — completed ${b.completedAt?.toISOString().slice(0, 16)} before 26-B, no avenue rows`); continue }
    checked++
    ok(`${b.ideaId.slice(0, 8)} v${b.version} — three avenues on the row`, av.length === 3, av.map((a) => a.avenue).join(','))
    ok(`${b.ideaId.slice(0, 8)} v${b.version} — an inapplicable avenue, if any, says why`, av.filter((a) => !a.applies).every((a) => !!a.whyNotApplicable?.trim()))
    const applying = av.filter((a) => a.applies).map((a) => a.chars)
    if (applying.length >= 2) {
      const ratio = Math.min(...applying) / Math.max(...applying)
      ok(`${b.ideaId.slice(0, 8)} v${b.version} — thinnest applying avenue ≥ ${DEPTH_RATIO_FLOOR} of the fullest`, ratio >= DEPTH_RATIO_FLOOR, `ratio ${ratio.toFixed(2)} (${av.map((a) => `${a.avenue} ${a.chars}${a.applies ? '' : ' n/a'}`).join(' · ')})`)
    }
  }
  if (!checked) unverified.push('§3a — no completed build carries avenue rows yet; the depth property was not checked on any real build')
  const d = await depthReport()
  console.log(`  depth report: builds ${d.builds}; medians ${AVENUES.map((k) => `${k} ${d.perAvenue[k].median} (n ${d.perAvenue[k].n}, n/a ${d.perAvenue[k].notApplicable})`).join(' · ')}; shortest/longest median ${d.shortestOverLongest.toFixed(2)}; per-build ratio median ${d.perBuildRatio.median.toFixed(2)} worst ${d.perBuildRatio.worst.toFixed(2)}`)

  console.log('\n── negative controls (each must FIRE) ──')
  let dead = 0
  for (const c of controls) { if (c.fired) console.log(`  ✓ fired — ${c.label}`); else { dead++; console.log(`  ✗ DID NOT FIRE — ${c.label}`) } }
  if (unverified.length) {
    console.log(`\n── ${unverified.length} NOT CHECKED, and why ──`)
    for (const u of unverified) console.log(`  · ${u}`)
  }
  console.log(`\n${pass} passed, ${fail} failed, ${unverified.length} not checked, ${controls.length} controls (${dead} dead)\n`)
  process.exit(fail || dead ? 1 : 0)
}

main().catch((e) => { console.error('\ncheck:lex-26b threw:', e); process.exit(1) }).finally(() => prisma.$disconnect())
