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
  } finally {
    for (const key of keysWritten) {
      await r2Delete(key).catch((e) => console.error(`R2 cleanup failed for ${key}:`, e?.name ?? e))
    }
    if (ideaId) {
      await prisma.document.deleteMany({ where: { ideaId } })
      await prisma.idea.delete({ where: { id: ideaId } }).catch((e) => console.error('cleanup failed:', e))
      console.log(`\ncleaned up test idea ${ideaId} and ${keysWritten.length} R2 objects`)
    }
    await prisma.$disconnect()
  }

  if (fail) { console.error(`\n${fail} check(s) failed.`); process.exit(1) }
  console.log('\nAll export end-to-end checks passed.')
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1) })
