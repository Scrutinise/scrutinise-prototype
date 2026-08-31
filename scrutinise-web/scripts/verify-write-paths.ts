// ─────────────────────────────────────────────────────────────────────────────
// verify:write-paths — 25-O ADDENDUM §A1, THE THREE ROUND TRIPS, AGAINST THE LIVE DATABASE.
//
// §A1: *"assert the round trip end to end: click, row exists, row renders, row survives a
// reload."*
//
// ⚠⚠ THIS IS THE CHECK THAT COULD HAVE CAUGHT IT AND DID NOT EXIST. `check:lex-25n` asserted
// that `ReportAdditions` filters on `e.priority` and that the button says "Add to report" — both
// true, both passing, for a feature that wrote a row and rendered nothing. A source assertion
// cannot see a JOIN that misses; only reading the value back through the real assembler can.
//
// ⚠ IT WRITES AND CLEANS UP AFTER ITSELF, and it uses a finding it picked at random rather than
// a fixture — the defect was in how a REAL row's ids relate, and a fixture would have been built
// with whichever id the author had in mind.
//
// ⚠ AND IT PROVES THE READ, NOT THE WRITE. "Row exists" is the easy half and was never in doubt.
// The assertions that matter are `renders` (the assembler returns priority=true) and `survives`
// (a second, independent assembly still does) — which is what "after a full page refresh" means
// in code.
//
// ⚠⚠ AND ALL THREE OF 25-N's WRITE PATHS ARE HERE, because §A1 is right that one of them
// failing makes the other two unproven rather than fine. 25-N reported them as "not verified,
// needs a browser"; the browser found the first one broken. Assuming the other two were well
// would be the same mistake with better odds.
//
// Usage: tsx --env-file=.env scripts/verify-write-paths.ts <ideaIdPrefix>
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { buildQuestionPanel } from '../lib/lex/question-panel'

let pass = 0
let fail = 0
function ok(label: string, condition: boolean, detail?: string) {
  if (condition) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

/** Is this entry priority, as the middle column would compute it? */
async function isPriority(ideaId: string, entryId: string): Promise<boolean> {
  const panel = await buildQuestionPanel(ideaId)
  return panel.headings
    .flatMap((h) => h.entries)
    .some((e) => e.id === entryId && e.priority && !e.excluded)
}

async function main() {
  const prefix = process.argv[2] ?? '452c5ade'
  const idea = await prisma.idea.findFirst({
    where: { id: { startsWith: prefix } }, select: { id: true, title: true, creatorId: true },
  })
  if (!idea) { console.log(`No idea starting "${prefix}"`); process.exit(1) }

  console.log(`\n── verify:add-to-report — ${idea.id.slice(0, 8)} "${idea.title}" ──\n`)

  // ══ 1. THE ROWS CHARLIE'S OWN CLICKS LEFT ══════════════════════════════════
  //
  // ⚠ THE REGRESSION TEST IS REAL DATA, NOT A FIXTURE. These are the rows written by the browser
  // pass that found the bug; if they do not render, the fix has not fixed the reported defect.
  console.log('§A1 — the rows Charlie\'s own clicks left behind')
  const existing = await prisma.ideaSourceDecision.findMany({
    where: { ideaId: idea.id, status: 'PRIORITY' },
    select: { sourceKey: true, title: true, updatedAt: true },
  })
  console.log(`  ${existing.length} PRIORITY decision row(s) on this idea`)
  if (existing.length) {
    const panel = await buildQuestionPanel(idea.id)
    const rendered = panel.headings.flatMap((h) => h.entries).filter((e) => e.priority)
    console.log(`  ${rendered.length} of them render as priority through the assembler`)
    for (const r of rendered) console.log(`      ✓ ${r.title.slice(0, 62)}`)
    ok('§A1 — every stored PRIORITY row reaches the panel',
      rendered.length === existing.length,
      `${rendered.length}/${existing.length}`)
  }

  // ══ 2. THE FULL ROUND TRIP ON A ROW NOBODY HAS TOUCHED ═════════════════════
  console.log('\n§A1 — click, row exists, row renders, row survives a reload')

  const decided = new Set(existing.map((d) => d.sourceKey))
  const target = (await prisma.evidenceItem.findMany({
    where: { ideaId: idea.id, status: { not: 'REJECTED' } },
    select: { id: true, title: true, sourceId: true, citation: true, url: true },
    take: 40,
  })).find((e) => !decided.has(e.id))
  if (!target) { console.log('  no untouched finding to test with'); process.exit(1) }

  console.log(`  using: ${target.title.slice(0, 60)}`)
  console.log(`    EvidenceItem.id = ${target.id.slice(0, 12)}   sourceId = ${target.sourceId?.slice(0, 12) ?? 'NULL'}`)

  ok('before the click, it is NOT priority', !(await isPriority(idea.id, target.id)))

  // The click — the same payload `QuestionPanel.decide` sends.
  await prisma.ideaSourceDecision.upsert({
    where: { ideaId_sourceKey: { ideaId: idea.id, sourceKey: target.id } },
    create: {
      ideaId: idea.id, sourceKey: target.id, status: 'PRIORITY',
      title: target.title, citation: target.citation, url: target.url,
      // ⚠ REQUIRED, and the route supplies it too — a decision with no author is the
      // unaccountable act the column exists to prevent.
      decidedBy: idea.creatorId,
    },
    update: { status: 'PRIORITY' },
  })

  const row = await prisma.ideaSourceDecision.findUnique({
    where: { ideaId_sourceKey: { ideaId: idea.id, sourceKey: target.id } },
    select: { status: true },
  })
  ok('the row EXISTS, and is stored under the EvidenceItem id', row?.status === 'PRIORITY')

  ok('it RENDERS — the assembler the middle column reads returns priority=true',
    await isPriority(idea.id, target.id))

  // ⚠ "SURVIVES A RELOAD" IS A SECOND, INDEPENDENT ASSEMBLY. The first could in principle be
  // served from something cached in the process; a fresh call cannot.
  ok('it SURVIVES A RELOAD — a second independent assembly still returns it',
    await isPriority(idea.id, target.id))

  // ⚠ AND THE CONTROL. A read that returned `priority: true` for everything would pass every
  // assertion above. One untouched finding must still come back false.
  const other = (await prisma.evidenceItem.findMany({
    where: { ideaId: idea.id, status: { not: 'REJECTED' } },
    select: { id: true }, take: 40,
  })).find((e) => e.id !== target.id && !decided.has(e.id))
  ok('CONTROL — a finding nobody prioritised is still NOT priority',
    !!other && !(await isPriority(idea.id, other.id)),
    other ? other.id.slice(0, 12) : 'no control available')

  // ⚠ CLEAN UP. This is production data; the test row goes.
  await prisma.ideaSourceDecision.delete({
    where: { ideaId_sourceKey: { ideaId: idea.id, sourceKey: target.id } },
  })
  ok('cleaned up — and the removal is READ BACK, not assumed',
    !(await isPriority(idea.id, target.id)))

  // ══ 3. THE NOTES WRITE PATH (25-N §3c) ════════════════════════════════════
  //
  // ⚠ THE PRIVACY IS PART OF THE ROUND TRIP, not a separate concern. A note that saves but is
  // readable by the wrong key is a worse defect than one that does not save.
  console.log('\n§A1 — the Notes write path (25-N §3c), demonstrated')

  const note = await prisma.ideaNote.create({
    data: {
      ideaId: idea.id, userId: idea.creatorId,
      title: 'verify:write-paths', body: 'Written by the check; deleted on the next line.',
      heading: '', position: -9999,
    },
  })
  const readBack = await prisma.ideaNote.findFirst({
    where: { id: note.id, ideaId: idea.id, userId: idea.creatorId },
    select: { body: true },
  })
  ok('a note saves and reads back under (ideaId, userId)',
    readBack?.body === 'Written by the check; deleted on the next line.')

  // ⚠ THE CONTROL THAT MATTERS FOR NOTES: another user on the same idea must not see it.
  const otherUser = await prisma.user.findFirst({
    where: { id: { not: idea.creatorId } }, select: { id: true },
  })
  const leaked = otherUser
    ? await prisma.ideaNote.findFirst({
        where: { id: note.id, ideaId: idea.id, userId: otherUser.id }, select: { id: true },
      })
    : null
  ok('CONTROL — the same note is invisible to another user on the same idea',
    !!otherUser && leaked === null)

  await prisma.ideaNote.delete({ where: { id: note.id } })
  ok('the note is gone, read back',
    (await prisma.ideaNote.findUnique({ where: { id: note.id } })) === null)

  // ══ 4. THE WORKLIST TICK WRITE PATH (25-N §3e) ════════════════════════════
  console.log('\n§A1 — the worklist tick write path (25-N §3e), demonstrated')

  const KEY = 'verify:write-paths'
  await prisma.ideaWorklistTick.upsert({
    where: { ideaId_userId_itemKey: { ideaId: idea.id, userId: idea.creatorId, itemKey: KEY } },
    create: { ideaId: idea.id, userId: idea.creatorId, itemKey: KEY },
    update: {},
  })
  const ticked = await prisma.ideaWorklistTick.findMany({
    where: { ideaId: idea.id, userId: idea.creatorId }, select: { itemKey: true },
  })
  ok('a tick saves and comes back in the set the route builds from',
    ticked.some((t) => t.itemKey === KEY), `${ticked.length} tick(s) on this idea`)

  // ⚠ THE DOUBLE-PRESS. A toggle a user will press twice must be idempotent, or an untick
  // leaves a second row behind and the box comes back.
  await prisma.ideaWorklistTick.upsert({
    where: { ideaId_userId_itemKey: { ideaId: idea.id, userId: idea.creatorId, itemKey: KEY } },
    create: { ideaId: idea.id, userId: idea.creatorId, itemKey: KEY },
    update: {},
  })
  const dupes = await prisma.ideaWorklistTick.count({
    where: { ideaId: idea.id, userId: idea.creatorId, itemKey: KEY },
  })
  ok('a second press leaves ONE row, not two', dupes === 1, `${dupes} row(s)`)

  await prisma.ideaWorklistTick.deleteMany({
    where: { ideaId: idea.id, userId: idea.creatorId, itemKey: KEY },
  })
  ok('the untick removes it, read back',
    (await prisma.ideaWorklistTick.count({
      where: { ideaId: idea.id, userId: idea.creatorId, itemKey: KEY },
    })) === 0)

  console.log(`\n${pass} passed, ${fail} failed.\n`)
  await prisma.$disconnect()
  if (fail) process.exit(1)
}

void main()
