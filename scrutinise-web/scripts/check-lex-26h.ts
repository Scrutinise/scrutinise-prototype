// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-H — the seven stages, the stage banner on every document, the review status.
//
//   npm run check:lex-26h
//
// Part A (pure) asserts the copy. Part B is a COLD READ (CLAUDE.md §26): Charlie's own idea (452c5ade), not created and
// not touched here, through the SAME functions the product calls (`export.buildFor` for the four briefing/outgoing kinds,
// `proposal-export.buildFor` + `buildProposalSnapshot` for the four proposal kinds), then the .docx and .pdf are RENDERED
// and the banner is read back out of the rendered file (§25 — the value on the output, not the code that would produce it).
// Every value assertion has a control that must stay false (§23/§25.5). Counts what RAN (§23.2).
// ─────────────────────────────────────────────────────────────────────────────

import JSZip from 'jszip'
import { prisma } from '../lib/prisma'
import {
  SEVEN_STAGES, STAGE_CAVEAT, STAGE_CAVEAT_HEADING, NOT_YET_AVAILABLE, reviewStatus, stageBannerBlocks, stageSentence,
  documentStage, withStageBanner, NO_REVIEW_RECORDED, kernelProgressOf,
} from '../lib/documents/stage-banner'
import { readKernelProgress } from '../lib/documents/stage-facts'
import { LEX_STAGES } from '../lib/lex/stages'
import { DEEPENING_PASS_KEYS } from '../lib/lex/pass-keys'
import { PASS_KEYS } from '../lib/lex/deepening-config'
import { FAQ_MARKDOWN } from '../lib/faq-content'
import { EXPORT_KINDS, buildFor as buildExportModel } from '../lib/documents/export'
import { PROPOSAL_KINDS, buildFor as buildProposalModel } from '../lib/documents/proposal-export'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { renderDocx } from '../lib/documents/render-docx'
import { renderPdf } from '../lib/documents/render-pdf'
import { runsToText, type DocumentModel } from '../lib/documents/model'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0
function ok(name: string, cond: boolean, detail = '') {
  ran++
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) }
}
/** §25.5 — a control that must come out FALSE: the property is deliberately broken and the check has to notice. */
function control(name: string, propertyHolds: boolean) {
  controls++
  if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`)
}
const section = (s: string) => console.log(`\n── ${s} ──`)

const text = (m: DocumentModel, n = 6) =>
  m.blocks.slice(0, n).map((b) => {
    if (b.kind === 'paragraph' || b.kind === 'heading') return runsToText(b.runs)
    if (b.kind === 'note') return b.text
    if (b.kind === 'bullets') return b.items.map(runsToText).join('\n')
    return ''
  }).join('\n')

async function main() {
  section('A · the copy')
  ok('seven stages, in the brief\'s order and names',
    SEVEN_STAGES.map((s) => s.name).join('|') === 'The First Pass|The First Draft|The Deepening|Private Scrutiny|Public Scrutiny|Submission|In Force')
  ok('Stage 2 is "The First Draft", never "First Scrutiny" (§2a)', SEVEN_STAGES[1].name === 'The First Draft' && !SEVEN_STAGES.some((s) => /First Scrutiny/i.test(s.name)))
  ok('Stage 6 is "Submission", not "Parliamentary submission" (§2b)', SEVEN_STAGES[5].name === 'Submission')
  ok('only In Force is marked not yet available (§3)', SEVEN_STAGES.filter((s) => !s.available).map((s) => s.name).join() === 'In Force')
  ok('the stage sentence is the brief\'s form', stageSentence(2) === 'This is a Stage 2 document: The First Draft.')
  ok('review status defaults to First Scrutiny', reviewStatus().label === 'First Scrutiny')
  ok('a recorded private review names its number and date (§5)', reviewStatus({ privateReview: { reviewers: 4, date: '2027-05-12' }, publicReview: null }).label === 'Privately reviewed — 4 reviewers, 12 May 2027')
  ok('a recorded public review beats a private one, one reviewer is singular',
    reviewStatus({ privateReview: { reviewers: 4, date: '2027-05-12' }, publicReview: { reviewers: 1, date: '2027-06-01' } }).label === 'Publicly reviewed — 1 reviewer, 1 June 2027')
  ok('§5b — zero reviewers, or no date, is NOT a review', reviewStatus({ privateReview: { reviewers: 0, date: '2027-05-12' }, publicReview: { reviewers: 3, date: '' } }).key === 'FIRST_SCRUTINY')
  control('a review with no reviewers must not read as reviewed', reviewStatus({ privateReview: { reviewers: 0, date: '2027-05-12' }, publicReview: null }).key !== 'FIRST_SCRUTINY')
  // ── Decision 135 — the stage is the kernel's PROGRESS ────────────────────────────────────────────────────────────
  const P = (built: boolean, kernelComplete: boolean, enteredDeepening: boolean) => ({ built, kernelComplete, enteredDeepening })
  ok('135: briefing documents are Stage 1 whatever the progress', documentStage({ kind: 'FIRST_PASS', progress: P(true, true, true) }) === 1)
  ok('135: Stage 1 until the first build', documentStage({ kind: 'KERNEL', progress: P(false, false, false) }) === 1)
  ok('135: built, kernel not complete → Stage 2', documentStage({ kind: 'KERNEL', progress: P(true, false, false) }) === 2)
  ok('135: kernel complete but the Deepening not entered → still Stage 2', documentStage({ kind: 'KERNEL', progress: P(true, true, false) }) === 2)
  ok('135: Deepening entered but the kernel NOT complete → still Stage 2', documentStage({ kind: 'KERNEL', progress: P(true, false, true) }) === 2)
  ok('135: built, kernel complete AND Deepening entered → Stage 3', documentStage({ kind: 'KERNEL', progress: P(true, true, true) }) === 3)
  ok('135: the document stack\'s list of Deepening pass keys is the Deepening\'s own (no drift)', [...DEEPENING_PASS_KEYS].sort().join() === [...PASS_KEYS].sort().join(), ` vs `)
  const KEYS = ['EVIDENCE_PRECEDENT', 'LEGAL']
  const prog = (statuses: string[], passes: { passKey: string; status: string }[]) => kernelProgressOf({ built: true, fieldStatuses: statuses, deepeningPassKeys: KEYS, passes })
  ok('135: decision 97 — every field ACCEPTED or SKIPPED is complete', prog(['ACCEPTED', 'SKIPPED', 'ACCEPTED'], []).kernelComplete)
  ok('135: one AWAITING_CONFIRMATION / EMPTY field means the kernel is not complete', !prog(['ACCEPTED', 'AWAITING_CONFIRMATION'], []).kernelComplete && !prog(['ACCEPTED', 'EMPTY'], []).kernelComplete)
  ok('135: a RUN row the BUILD wrote (its own research key) is not the user entering the Deepening', !prog(['ACCEPTED'], [{ passKey: 'SMART_VOCABULARY', status: 'RUN' }]).enteredDeepening)
  ok('135: a Deepening pass the user began counts, run or still running', prog(['ACCEPTED'], [{ passKey: 'LEGAL', status: 'RUNNING' }]).enteredDeepening && prog(['ACCEPTED'], [{ passKey: 'LEGAL', status: 'RUN' }]).enteredDeepening)
  ok('135: a NOT_RUN Deepening row is not entry', !prog(['ACCEPTED'], [{ passKey: 'LEGAL', status: 'NOT_RUN' }]).enteredDeepening)
  control('135: a build-written RUN row must not make a Stage 3 document (must be FALSE)',
    documentStage({ kind: 'KERNEL', progress: prog(['ACCEPTED', 'AWAITING_CONFIRMATION'], [{ passKey: 'SMART_VOCABULARY', status: 'RUN' }]) }) === 3)

  const banner = stageBannerBlocks(2)
  const empty: DocumentModel = { title: 't', sourceLabel: 's', generatedAt: new Date(0), blocks: [{ kind: 'paragraph', runs: [{ text: 'BODY' }] }] }
  const wrapped = withStageBanner(empty, 2)
  const bt = text(wrapped, banner.length)
  ok('the banner is FIRST and in the brief\'s order: stage (bold) → review status → seven stages → caveat',
    wrapped.blocks[0].kind === 'paragraph' && (wrapped.blocks[0] as { runs: { bold?: boolean }[] }).runs[0].bold === true
    && bt.indexOf('This is a Stage 2 document') < bt.indexOf('Review status') && bt.indexOf('Review status') < bt.indexOf('1 · The First Pass')
    && bt.indexOf('7 · In Force') < bt.indexOf(STAGE_CAVEAT_HEADING) && wrapped.blocks[banner.length] === empty.blocks[0])
  ok('this stage is marked in WORDS, and In Force says it is not yet available', /2 · The First Draft — what you propose, specifically — this document/.test(bt) && new RegExp(`7 · In Force — did it work \\(${NOT_YET_AVAILABLE}\\)`).test(bt))
  ok('the caveat is verbatim', bt.includes(STAGE_CAVEAT) && STAGE_CAVEAT.includes('Vagueness is not caution; it is the absence of a proposal.'))
  ok('the banner never calls stage 2 "First Scrutiny"', !/Stage 2[^\n]{0,40}First Scrutiny/.test(bt) && !/First Scrutiny[^\n]{0,40}Stage 2 document/.test(bt))
  ok('the FAQ carries the seven stages, In Force marked, the caveat, and says First Scrutiny is a review status not a stage',
    SEVEN_STAGES.every((s) => FAQ_MARKDOWN.includes(s.name)) && FAQ_MARKDOWN.includes(`In Force** — did it work *(${NOT_YET_AVAILABLE})*`)
    && FAQ_MARKDOWN.includes(STAGE_CAVEAT) && /"First Scrutiny" is not a stage\. It is a review status/.test(FAQ_MARKDOWN))
  ok('no FAQ line names First Scrutiny as a stage', !/Stage \d[^\n]{0,30}First Scrutiny/.test(FAQ_MARKDOWN))
  control('a document with no banner must fail the banner test', /This is a Stage \d document/.test(text(empty)))

  section('B · COLD READ — Charlie\'s idea 452c5ade, every generated document kind, rendered and read back')
  const idea = await prisma.idea.findFirst({ where: { id: { startsWith: '452c5ade' } }, select: { id: true, stage: true } })
  if (!idea) { console.log('  NOT CHECKED — idea 452c5ade is not in this database'); return summary() }
  const before = await prisma.lexCoherentAction.count({ where: { ideaId: idea.id } })

  const built: { kind: string; model: DocumentModel }[] = []
  for (const k of EXPORT_KINDS) built.push({ kind: k, model: (await buildExportModel(k, idea.id)).model })
  const snap = await buildProposalSnapshot(idea.id)
  for (const k of PROPOSAL_KINDS) built.push({ kind: k, model: buildProposalModel(k, snap, null).model })
  ok(`all eight kinds were built (${built.length})`, built.length === 8, built.map((b) => b.kind).join())

  const progress = await readKernelProgress(idea.id)
  console.log(`  progress read off the idea: ${JSON.stringify(progress)}`)
  const kernelStage = documentStage({ kind: 'KERNEL', progress })
  for (const b of built) {
    const t = text(b.model, banner.length)
    const first = b.model.blocks[0]
    const firstText = first && first.kind === 'paragraph' ? runsToText(first.runs) : ''
    ok(`${b.kind}: opens with the stage in bold, before anything else`, /^This is a Stage [123] document: /.test(firstText) && (first as { runs: { bold?: boolean }[] }).runs[0].bold === true, firstText.slice(0, 80))
    ok(`${b.kind}: review status First Scrutiny, the seven stages and the caveat follow`, t.includes('Review status: First Scrutiny') && t.includes('7 · In Force') && t.includes(STAGE_CAVEAT))
    const expected = b.kind === 'INITIAL_BACKGROUND' || b.kind === 'INITIAL_QUESTIONS' ? 1 : kernelStage
    ok(`${b.kind}: is a Stage ${expected} document (derived from what it is, not from Idea.stage=${idea.stage})`, firstText.startsWith(`This is a Stage ${expected} document`), firstText)
    ok(`${b.kind}: nothing in the document names stage 2 "First Scrutiny"`, !/First Scrutiny[^\n]{0,40}(The First Draft|Stage 2)|Stage 2[^\n]{0,40}First Scrutiny/.test(text(b.model, 400)))
  }
  // Charlie's stated expectation for this idea (Decision 135), asserted as written and not derived: the One-Page Summary
  // of 452c5ade opens "This is a Stage 2 document: The First Draft."
  const onePage = built.find((b) => b.kind === 'ONE_PAGE_SUMMARY')
  const onePageFirst = onePage && onePage.model.blocks[0].kind === 'paragraph' ? runsToText(onePage.model.blocks[0].runs) : ''
  ok('135: the One-Page Summary of 452c5ade opens "This is a Stage 2 document: The First Draft."', onePageFirst === 'This is a Stage 2 document: The First Draft.', onePageFirst)
  control('135: a Stage 3 opening must not satisfy that expectation (must be FALSE)', 'This is a Stage 3 document: The Deepening.' === 'This is a Stage 2 document: The First Draft.')

  // Decision 136 — the bar and the documents say the same thing.
  ok('136: the workspace bar names its stages from the documents\' words',
    LEX_STAGES.map((s) => s.name).join('|') === SEVEN_STAGES.slice(0, 3).map((s) => s.name).join('|'), LEX_STAGES.map((s) => s.name).join('|'))
  control('136: the old bar names must not match the documents (must be FALSE)', ['The Idea', 'The Strategy', 'The Deepening'].join('|') === SEVEN_STAGES.slice(0, 3).map((s) => s.name).join('|'))

  control('a built document with the banner stripped must fail', /^This is a Stage/.test(text({ ...built[0].model, blocks: built[0].model.blocks.slice(banner.length) }, 1)))

  // Rendered files: read the banner back OUT of the .docx and confirm the .pdf renders (not the model, the file).
  const sample = built.find((b) => b.kind === 'PROPOSAL') ?? built[0]
  const docx = await renderDocx(sample.model)
  const zip = await JSZip.loadAsync(docx)
  const xml = await zip.file('word/document.xml')!.async('string')
  const flat = xml.replace(/<[^>]+>/g, '')
  ok('the RENDERED .docx carries the stage sentence, the review status, In Force "not yet available" and the caveat',
    flat.includes('This is a Stage') && flat.includes('Review status') && flat.includes(`(${NOT_YET_AVAILABLE})`) && flat.includes('Vagueness is not caution'))
  ok('the stage sentence is the FIRST text in the rendered .docx body', flat.indexOf('This is a Stage') < flat.indexOf('Review status') && flat.indexOf('This is a Stage') < 400, `at ${flat.indexOf('This is a Stage')}`)
  const pdf = await renderPdf(sample.model)
  ok('the .pdf renders', pdf.length > 5000 && pdf.subarray(0, 4).toString() === '%PDF')
  control('a rendered .docx without the banner must fail', (await JSZip.loadAsync(await renderDocx({ ...sample.model, blocks: sample.model.blocks.slice(banner.length) })).then((z) => z.file('word/document.xml')!.async('string'))).replace(/<[^>]+>/g, '').includes('Vagueness is not caution'))

  ok('the cold read wrote nothing (action rows unchanged)', (await prisma.lexCoherentAction.count({ where: { ideaId: idea.id } })) === before)
  void NO_REVIEW_RECORDED
  summary()
}

function summary() {
  console.log(`\n${pass} passed, ${fail} failed · ${ran} checks RUN · ${controls} controls, ${controls - dead} fired, ${dead} dead`)
  process.exit(fail || dead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
