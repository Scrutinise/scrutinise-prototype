// Sprint 2.5 (§8.2) — document export, end to end against the live app DB and R2.
//
// The acceptance criterion this exists for: "re-running the search then
// re-exporting produces an updated file, and the UI shows the generation
// timestamp." So the test does exactly that — generates, then CHANGES the stored
// briefing the way a re-run search does, then asserts the stored pair is reported
// STALE rather than served, then regenerates and asserts it is current again and
// that the bytes actually changed.
//
// Creates a temporary idea and deletes it, and its R2 objects, in a finally.
// Run: npx tsx --env-file=.env scripts/check-export-e2e.ts

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { generateExport, readExportStatus, signedDownload, exportFilename } from '../lib/documents/export'
import { buildInitialBackground, ExportUnavailableError } from '../lib/documents/build-initial-background'
import { r2Delete } from '../lib/r2'
import { readFileSync } from 'fs'
import { join } from 'path'
import { buildInitialQuestions, itemsWithoutRoute, INITIAL_QUESTIONS_KIND } from '../lib/documents/build-initial-questions'

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!url) throw new Error('DIRECT_URL/DATABASE_URL not set')
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, ssl: { rejectUnauthorized: false } }),
} as never)

let fail = 0
const ok = (label: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`✓ ${label}`)
  else { console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`); fail++ }
}

const BODY_V1 = `
# What the law says today

The **Road Traffic Act 1988**, s.36 is the operative provision — “failing to comply with a
traffic sign” — and enforcement is split between police forces and local authorities.

## Where it falls short

- Penalties are set in cash terms and have not been uprated since 2013.
- The § numbering in the consolidated text no longer matches the enacted text.
`.trim()

const BODY_V2 = `${BODY_V1}\n\n## Added by a re-run search\n\nThe Traffic Management Act 2004 also bears on this, and the Committee returned to it in 2019.`

const REFS_V1 = [
  {
    id: 'ukpga/1988/52/section/36', type: 'PRIMARY_LEGISLATION',
    title: 'Road Traffic Act 1988', citation: 'Road Traffic Act 1988, s.36',
    url: 'https://www.legislation.gov.uk/ukpga/1988/52/section/36',
    snippet: 'A person driving a vehicle who fails to comply with a traffic sign…',
    date: '1988-05-15', score: 12.4,
  },
]
const REFS_V2 = [
  ...REFS_V1,
  {
    id: 'cmselect/cmtrans/1745', type: 'COMMITTEE',
    title: 'Transport Committee — Road traffic enforcement', citation: 'HC 1745, 2018–19',
    url: 'https://publications.parliament.uk/pa/cm201719/cmselect/cmtrans/1745/1745.pdf',
    snippet: 'Penalty levels have not kept pace with inflation.', date: '2019-07-24', score: 9.1,
  },
]

async function main() {
  const owner = await prisma.user.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } })
  if (!owner) { console.error('No user in the DB to own a test idea.'); process.exit(1) }

  let ideaId: string | null = null
  const keysWritten: string[] = []

  try {
    const idea = await prisma.idea.create({
      data: {
        title: '[sprint-2.5 check] export end to end',
        summaryDescription: 'Temporary row created by scripts/check-export-e2e.ts. Deleted at the end of the run.',
        govtArea: '',
        creatorId: owner.id,
        legislationRefs: REFS_V1,
        stageSearches: { version: 2, byStage: { ORIENTATION: { intent: 'ORIENTATION', ranAt: '2026-08-05T09:12:00.000Z', ok: true, query: ['traffic'], results: [] } }, research: [] },
      },
      select: { id: true },
    })
    ideaId = idea.id
    keysWritten.push(`_exports/${ideaId}/initial_background.docx`, `_exports/${ideaId}/initial_background.pdf`)
    keysWritten.push(`_exports/${ideaId}/initial_questions.docx`, `_exports/${ideaId}/initial_questions.pdf`)

    // ── 1. no briefing yet → refused with a reason, not a broken file ────────
    const before = await readExportStatus(ideaId)
    ok('no briefing → export reported unavailable', !before.available)
    ok('no briefing → the reason is stated', Boolean(before.unavailableReason), before.unavailableReason ?? 'null')
    let refused = false
    try { await generateExport(ideaId) } catch (e) { refused = e instanceof ExportUnavailableError }
    ok('no briefing → generate refuses rather than inventing one', refused)

    // ── 2. a pending briefing is still not exportable ────────────────────────
    await prisma.document.create({
      data: { ideaId, kind: 'INITIAL_BACKGROUND', status: 'pending', summary: null, body: null },
    })
    ok('pending briefing → still unavailable', !(await readExportStatus(ideaId)).available)

    // ── 3. a ready briefing generates both formats ───────────────────────────
    await prisma.document.update({
      where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } },
      data: { status: 'ready', summary: 'A short preview line.', body: BODY_V1 },
    })
    const gen = await generateExport(ideaId)
    ok('generate → reports generated', gen.generated)
    ok('generate → not stale immediately after', !gen.stale)
    ok('generate → records a timestamp', Boolean(gen.generatedAt), gen.generatedAt ?? 'null')
    ok('generate → records what it was made from', Boolean(gen.sourceLabel), gen.sourceLabel ?? 'null')
    ok('generate → exposes both download paths', Boolean(gen.docxUrl && gen.pdfUrl))
    ok('generate → clears any prior error', gen.lastError === null)

    const row1 = await prisma.document.findUnique({
      where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } },
      select: { docxKey: true, pdfKey: true, sourceFingerprint: true, generatedAt: true },
    })
    ok('generate → stores the R2 keys', Boolean(row1?.docxKey && row1?.pdfKey))
    ok('generate → stores a fingerprint', Boolean(row1?.sourceFingerprint))

    const dl1 = await signedDownload(ideaId, 'pdf', exportFilename('x', 'pdf'))
    ok('download → a signed URL is minted', Boolean(dl1?.url.startsWith('https://')))
    ok('download → not stale', dl1?.stale === false)
    ok('download → the URL expires (is not a bare object URL)',
      Boolean(dl1?.url.includes('X-Amz-Expires') || dl1?.url.includes('x-amz-expires')))

    // ── 4. re-running the search changes the stored state → the file is STALE ─
    await prisma.idea.update({ where: { id: ideaId }, data: { legislationRefs: REFS_V2 } })
    await prisma.document.update({
      where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } },
      data: { body: BODY_V2 },
    })
    const afterRerun = await readExportStatus(ideaId)
    ok('re-run search → the stored file is reported stale', afterRerun.stale)
    ok('re-run search → the old timestamp is still shown, not hidden',
      afterRerun.generatedAt === row1?.generatedAt?.toISOString())
    const dl2 = await signedDownload(ideaId, 'pdf', exportFilename('x', 'pdf'))
    ok('re-run search → download reports staleness to its caller', dl2?.stale === true)

    // ── 5. regenerating produces a genuinely different file ──────────────────
    const fpBefore = row1?.sourceFingerprint
    const regen = await generateExport(ideaId, { force: true })
    ok('regenerate → no longer stale', !regen.stale)
    const row2 = await prisma.document.findUnique({
      where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } },
      select: { sourceFingerprint: true, generatedAt: true, sourceLabel: true },
    })
    ok('regenerate → the fingerprint moved', Boolean(row2?.sourceFingerprint) && row2?.sourceFingerprint !== fpBefore)
    ok('regenerate → the timestamp moved',
      Boolean(row2?.generatedAt && row1?.generatedAt && row2.generatedAt > row1.generatedAt))
    ok('regenerate → the source label counts the new reference',
      row2?.sourceLabel?.includes('2 sources') === true, row2?.sourceLabel ?? 'null')

    // The rendered document must actually contain the added content — the
    // fingerprint moving is necessary but not sufficient.
    const rebuilt = await buildInitialBackground(ideaId)
    const text = JSON.stringify(rebuilt.model.blocks)
    ok('regenerate → the new prose is in the document model', text.includes('Added by a re-run search'))
    ok('regenerate → the new source is in the document model', text.includes('HC 1745'))

    // ── 6. idempotence: generating again without changes re-renders nothing ──
    const noop = await generateExport(ideaId)
    ok('generate with no change → timestamp unchanged', noop.generatedAt === row2?.generatedAt?.toISOString())

    // ══ 7. 17 Sep 2026, item 2 — REGENERATION RE-RENDERS, IT DOES NOT RE-RUN ═══════════════
    //
    // A user regenerating an old file gets the same first-pass material in the current layout,
    // with the same build stamp. Asserted on the thing itself: force a regeneration and confirm
    // the source list, the corpus-search time and the build stamp did not move, and that no row
    // the briefing is built from was written.
    const rowsBefore = await prisma.idea.findUnique({ where: { id: ideaId }, select: { legislationRefs: true, stageSearches: true } })
    const docBefore = await prisma.document.findUnique({
      where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } }, select: { body: true, summary: true, buildId: true, buildVersion: true },
    })
    const modelBefore = await buildInitialBackground(ideaId)
    const regen2 = await generateExport(ideaId, { force: true })
    ok('regenerate (old file) → a fresh file was rendered', regen2.generatedAt !== row2?.generatedAt?.toISOString())
    const rowsAfter = await prisma.idea.findUnique({ where: { id: ideaId }, select: { legislationRefs: true, stageSearches: true } })
    const docAfter = await prisma.document.findUnique({
      where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } }, select: { body: true, summary: true, buildId: true, buildVersion: true },
    })
    const modelAfter = await buildInitialBackground(ideaId)
    const refIds = (m: typeof modelBefore) => JSON.stringify(m.model.blocks.filter((b) => b.kind === 'sources'))
    ok('regenerate → the source list is unchanged', refIds(modelBefore) === refIds(modelAfter))
    ok('regenerate → the corpus-search time is unchanged',
      modelBefore.searchRanAt === modelAfter.searchRanAt && modelAfter.searchRanAt === '2026-08-05T09:12:00.000Z', String(modelAfter.searchRanAt))
    ok('regenerate → the build stamp is unchanged', modelBefore.build.label === modelAfter.build.label, modelAfter.build.label)
    ok('regenerate → legislationRefs were not written', JSON.stringify(rowsBefore?.legislationRefs) === JSON.stringify(rowsAfter?.legislationRefs))
    ok('regenerate → stageSearches were not written', JSON.stringify(rowsBefore?.stageSearches) === JSON.stringify(rowsAfter?.stageSearches))
    ok('regenerate → the stored briefing body was not written', docBefore?.body === docAfter?.body && docBefore?.summary === docAfter?.summary)
    ok('regenerate → the fingerprint did not move (same content, same layout)', regen2.stale === false)
    // The export path cannot search: source-level, comments stripped.
    const src = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const exportPath = ['lib/documents/export.ts', 'lib/documents/build-initial-background.ts', 'lib/documents/build-initial-questions.ts', 'lib/documents/render-docx.ts', 'lib/documents/render-pdf.ts']
    ok('the export path imports no search (search-gateway / runSearch / fts-search / vector-search)',
      exportPath.every((f) => !/search-gateway|runSearch|fts-search|vector-search|runOrientation/.test(src(f))))
    // A control for that grep: a file that DOES import the gateway is caught by it.
    ok('control: the grep would catch a file that searches', /search-gateway/.test(src('lib/lex/build.ts')))

    // ══ 8. 17 Sep 2026, items 4–5 — INITIAL QUESTIONS, THE COMPANION, SAME BUILD, STATIC ═══
    ok('no build → the questions document is unavailable, with the reason',
      !(await readExportStatus(ideaId, INITIAL_QUESTIONS_KIND)).available)
    const build = await prisma.ideaBuild.create({
      data: { ideaId, version: 1, status: 'DONE', framing: 'B_CONTEXTUALISED', completedAt: new Date(),
        uncertainties: { pivotalObstacle: 'I am least sure whether the obstacle is the duty itself or how it is read.' } },
      select: { id: true },
    })
    // Bind the briefing to the same build, as ORIENT does.
    await prisma.document.update({ where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } }, data: { buildId: build.id, buildVersion: 1 } })
    await prisma.buildFork.create({ data: {
      ideaId, buildId: build.id, forkKey: 'guidingPolicy:instrument', fieldKey: 'summaryGuidingPolicy', alternativeIndex: 0,
      chosen: 'Primary legislation', alternative: 'Use the existing power: s.36 direction', caseForAlternative: 'It may already reach this.',
      recommendationReason: 'The draft assumed a new Act.', resolved: false,
    } })
    await prisma.deepeningIssue.create({ data: {
      ideaId, passKey: 'ADVERSARIAL', runVersion: 1, status: 'OPEN', title: 'The uprating has no index',
      text: 'The proposal names no index for the uprating, so a clerk will ask which one and why.', sourceModel: 'gemini-2.5-pro',
    } })
    await prisma.deepeningPass.create({ data: {
      ideaId, passKey: 'question:CAUSAL_EVIDENCE', status: 'RUN', runVersion: 1,
      knownUnknowns: [
        { question: 'How many fixed-penalty notices go unpaid each year?', why: 'Nothing retrieved answered this.' },
        { question: 'Did the 2013 freeze have a stated rationale?', why: 'At least one of this question’s searches failed to run.' },
      ],
    } })
    await prisma.ideaElicitation.create({ data: { ideaId, problem: 'Penalties have decayed.', goalKind: 'LAW_CHANGE', goalDetail: 'Uprate them.', ownKnowledge: null, ruledOut: null } })
    await prisma.ideaFieldState.create({ data: {
      ideaId, fieldKey: 'pivotalObstacle', status: 'AWAITING_CONFIRMATION',
      proposal: { value: 'The duty is read as a process test, so compliance is paperwork.', rationale: null },
    } })

    const q1 = await readExportStatus(ideaId, INITIAL_QUESTIONS_KIND)
    ok('build done → the questions document is available', q1.available, q1.unavailableReason ?? '')
    const qgen = await generateExport(ideaId, { kind: INITIAL_QUESTIONS_KIND })
    ok('questions → generated, both formats', qgen.generated && Boolean(qgen.docxUrl && qgen.pdfUrl))
    ok('questions → stamped with build 1', qgen.buildVersion === 1, String(qgen.buildVersion))
    const b1 = await readExportStatus(ideaId, 'INITIAL_BACKGROUND')
    ok('the pair carries the SAME build stamp', b1.buildVersion === qgen.buildVersion && b1.buildVersion === 1, `${b1.buildVersion} vs ${qgen.buildVersion}`)
    const qrow = await prisma.document.findUnique({ where: { ideaId_kind: { ideaId, kind: INITIAL_QUESTIONS_KIND } }, select: { body: true, buildId: true } })
    const body = qrow?.body ?? ''
    ok('questions → bound to the build row', qrow?.buildId === build.id)
    for (const h of ['## Decisions waiting on you', '## Choices between causes, and between approaches', '## What the corpus could not answer', '## What you know that we do not', '## Challenges that need a response']) {
      ok(`questions → section "${h.slice(3)}"`, body.includes(h))
    }
    ok('questions → the open fork is listed with what it rules out', body.includes('Primary legislation') && body.includes('rules out: Use the existing power'))
    ok('questions → the drafted-but-unsettled field is listed with its proposal', body.includes('Kernel fields drafted and not yet settled') && body.includes('The duty is read as a process test'))
    ok('questions → a corpus gap says what KIND of gap it is', body.includes('nothing retrieved answered it') && body.includes('our limitation'))
    ok('questions → the testimony gap is named', body.includes('You gave no first-hand account'))
    ok('questions → the field Lex is unsure of is named', body.includes('I am least sure whether the obstacle'))
    ok('questions → the open challenge is listed with its source', body.includes('The uprating has no index') && body.includes('raised by gemini-2.5-pro'))
    const missing = itemsWithoutRoute(body)
    ok('⚠ 25-V §8 — EVERY item states what would settle it', missing.length === 0, missing.join(' | '))
    // control: the route detector fires on an item with no route
    ok('control: an item with no route is caught', itemsWithoutRoute('## X\n\n- a bare complaint\n\n## Y').length === 1)
    const qmodel = await buildInitialQuestions(ideaId)
    ok('questions → the file opens on the pair sentence', JSON.stringify(qmodel.model.blocks[0]).includes('Here is what we need from you'))
    ok('questions → the file says it is a record of build 1 and points at the worklist',
      JSON.stringify(qmodel.model.blocks[1]).includes('build 1 of this idea') && JSON.stringify(qmodel.model.blocks[1]).includes('worklist'))

    // STATIC: resolve the fork and answer the challenge, regenerate, and the document still
    // lists them — it is the record of what the build asked for, not a live view.
    await prisma.buildFork.updateMany({ where: { buildId: build.id }, data: { resolved: true, resolvedChoice: 'chosen', resolvedAt: new Date() } })
    await prisma.deepeningIssue.updateMany({ where: { ideaId }, data: { status: 'ADDRESSED' } })
    const qregen = await generateExport(ideaId, { kind: INITIAL_QUESTIONS_KIND, force: true })
    const qrow2 = await prisma.document.findUnique({ where: { ideaId_kind: { ideaId, kind: INITIAL_QUESTIONS_KIND } }, select: { body: true } })
    ok('questions → static: the stored body did not change when the rows moved', qrow2?.body === body)
    ok('questions → static: the regenerated file is not reported stale', qregen.stale === false)
    ok('questions → static: the resolved fork is still listed as it was at the build', (qrow2?.body ?? '').includes('rules out: Use the existing power'))
    // control: the live agenda WOULD show it resolved — the two surfaces are meant to differ
    const liveFork = await prisma.buildFork.findFirst({ where: { buildId: build.id }, select: { resolved: true } })
    ok('control: the live row is resolved (so the document and the worklist now differ, by design)', liveFork?.resolved === true)
  } finally {
    for (const key of keysWritten) {
      await r2Delete(key).catch((e) => console.error(`R2 cleanup failed for ${key}:`, e?.name ?? e))
    }
    if (ideaId) {
      await prisma.document.deleteMany({ where: { ideaId } })
      await prisma.ideaFieldState.deleteMany({ where: { ideaId } }).catch(() => {})
      await prisma.deepeningIssue.deleteMany({ where: { ideaId } }).catch(() => {})
      await prisma.deepeningPass.deleteMany({ where: { ideaId } }).catch(() => {})
      await prisma.ideaElicitation.deleteMany({ where: { ideaId } }).catch(() => {})
      await prisma.buildFork.deleteMany({ where: { ideaId } }).catch(() => {})
      await prisma.ideaBuild.deleteMany({ where: { ideaId } }).catch(() => {})
      await prisma.idea.delete({ where: { id: ideaId } }).catch((e) => console.error('cleanup failed:', e))
      console.log(`\ncleaned up test idea ${ideaId} and ${keysWritten.length} R2 objects`)
    }
    await prisma.$disconnect()
  }

  if (fail) { console.error(`\n${fail} check(s) failed.`); process.exit(1) }
  console.log('\nAll export end-to-end checks passed.')
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1) })
