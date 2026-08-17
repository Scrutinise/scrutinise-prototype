// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-A — the LIVE verification: the invariants that only exist against a real
// database, checked against the real database.
//
// `check:build-25a` is offline and reads source. The four things below cannot be
// asserted that way, because they are about what Postgres and Prisma actually do:
//
//   1. An abandoned RUNNING build settles to FAILED **by writing the row**, keeps the
//      passes it completed, and says so. (§6)
//   2. A build that is merely SLOW is NOT settled. Without this control, a settle that
//      killed everything would pass check 1 and look correct.
//   3. Two concurrent claims produce exactly one build.
//   4. An unconfirmed elicitation cannot start a build. (§6 — the confirmation blocks it.)
//
// ⚠ EVERY ONE OF THESE IS WATCHED FAILING FIRST, in the same run: each check is paired
// with the state in which it must NOT fire. A settle that always fires and a settle that
// never fires both pass a one-sided test.
//
// It creates its own throwaway idea and HARD-DELETES it at the end (cascade takes the
// builds and the elicitation with it). Nothing it touches belongs to a real user.
//
// Usage: npx tsx --env-file=.env scripts/verify-build-25a-live.ts
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { buildState, claimBuild, requestCancel, BuildAlreadyRunning, ElicitationNotConfirmed } from '../lib/lex/build'
import { ABANDONED_AFTER_MS, BUILD_PASSES } from '../lib/lex/build-config'
import { assertWritableField } from '../lib/lex/stage'
import { initializeFieldStates } from '../lib/lex/field-machine'
import { computeCanonicalState } from '../lib/lex/state'

let pass = 0
let fail = 0
function assert(ok: boolean, name: string, detail = '') {
  if (ok) { pass++; console.log(`  ✓  ${name}`) }
  else { fail++; console.log(`  ✗  ${name}${detail ? `\n       ${detail}` : ''}`) }
}

function passLog(doneCount: number) {
  return BUILD_PASSES.map((p, i) => ({
    key: p.key, label: p.label, detail: p.detail,
    status: i < doneCount ? 'DONE' : 'PENDING',
    startedAt: new Date().toISOString(),
    completedAt: i < doneCount ? new Date().toISOString() : null,
    output: i < doneCount ? `pass ${i + 1} output` : null,
    failureReason: null,
  }))
}

async function main() {
  const host = new URL(process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? 'postgres://unknown').host
  console.log(`── verify:build-25a-live · ${host} ──`)

  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true, email: true } })
  if (!user) { console.error('no user to own the throwaway idea'); process.exit(1) }

  const idea = await prisma.idea.create({
    data: {
      creatorId: user.id,
      title: '[25-A live verification] throwaway — deleted at the end of this script',
      summaryDescription: '', govtArea: '', stage: 'STAGE_1', visibility: 'PRIVATE', status: 'DRAFT',
    },
    select: { id: true },
  })
  const ideaId = idea.id
  console.log(`throwaway idea ${ideaId}\n`)

  try {
    // ── 4 (first, because it is the precondition for everything else) ────────
    await prisma.ideaElicitation.create({
      data: { ideaId, problem: 'x', goalKind: 'UNSURE', status: 'AWAITING_CONFIRMATION', understanding: 'stub' },
    })
    let refused = false
    try { await claimBuild(ideaId, 'A_NAIVE') } catch (e) { refused = e instanceof ElicitationNotConfirmed }
    assert(refused, '§6 an UNCONFIRMED elicitation cannot start a build')
    assert(
      (await prisma.ideaBuild.count({ where: { ideaId } })) === 0,
      '   …and it left no row behind (a refused claim must not create a QUEUED build)',
    )

    await prisma.ideaElicitation.update({ where: { ideaId }, data: { status: 'CONFIRMED', confirmedAt: new Date() } })
    // THE CONTROL for the check above: with the elicitation confirmed, the same call
    // must now succeed. Without this, "claim refused" could simply mean "claim broken".
    const firstId = await claimBuild(ideaId, 'A_NAIVE')
    assert(!!firstId, '   …and a CONFIRMED elicitation does start one (the control for the check above)')

    // ── 3 concurrency ───────────────────────────────────────────────────────
    let secondRefused = false
    try { await claimBuild(ideaId, 'B_CONTEXTUALISED') } catch (e) { secondRefused = e instanceof BuildAlreadyRunning }
    assert(secondRefused, '§2 a second claim while one is RUNNING is refused')

    const settled = await Promise.allSettled([
      claimBuild(ideaId, 'A_NAIVE'), claimBuild(ideaId, 'A_NAIVE'), claimBuild(ideaId, 'A_NAIVE'),
    ])
    assert(
      settled.every((r) => r.status === 'rejected'),
      '   …and three simultaneous claims all lose to the one already running',
      settled.map((r) => r.status).join(','),
    )
    assert(
      (await prisma.ideaBuild.count({ where: { ideaId, status: { in: ['QUEUED', 'RUNNING'] } } })) === 1,
      '   …leaving exactly ONE active build row',
    )

    // ── 2 a slow build is NOT settled (the control for check 1) ─────────────
    await prisma.ideaBuild.update({
      where: { id: firstId },
      data: { startedAt: new Date(), passes: passLog(2) as never, passesComplete: 2, currentPass: 'APPROACH' },
    })
    let state = await buildState(ideaId)
    assert(
      state.latest?.status === 'RUNNING',
      '§2 a build that started SECONDS ago is NOT settled — slow is not dead',
      `status was ${state.latest?.status}`,
    )

    // ── 1 an abandoned build IS settled, by writing ─────────────────────────
    const stale = new Date(Date.now() - ABANDONED_AFTER_MS - 60_000)
    await prisma.ideaBuild.update({ where: { id: firstId }, data: { startedAt: stale } })
    state = await buildState(ideaId)
    assert(
      state.latest?.status === 'FAILED',
      '§6 an ABANDONED build settles to FAILED',
      `status was ${state.latest?.status}`,
    )
    const row = await prisma.ideaBuild.findUnique({ where: { id: firstId } })
    assert(row?.status === 'FAILED', '   …by WRITING the row, not by displaying something different')
    assert(!!row?.failureReason?.length, '   …with a plain reason attached', row?.failureReason ?? '(none)')
    assert(
      state.latest?.passesComplete === 2 &&
        state.latest.passes.filter((p) => p.status === 'DONE').length === 2,
      '   …and it still reports WHICH passes completed',
      `passesComplete=${state.latest?.passesComplete}`,
    )
    assert(state.latest?.currentPass === null, '   …and stops claiming a pass is in progress')

    // ── cancel ──────────────────────────────────────────────────────────────
    const secondId = await claimBuild(ideaId, 'B_CONTEXTUALISED')
    const applied = await requestCancel(ideaId, secondId)
    const cancelRow = await prisma.ideaBuild.findUnique({ where: { id: secondId } })
    assert(applied && cancelRow?.cancelRequested === true, '§2 cancel records the request on the row')
    assert(
      cancelRow?.status === 'RUNNING',
      '   …and does NOT flip the status itself — the engine settles, so the row never lies about what is happening',
      `status was ${cancelRow?.status}`,
    )
    // The control: a cancel against a build that is already finished must not apply.
    await prisma.ideaBuild.update({ where: { id: secondId }, data: { status: 'DONE', completedAt: new Date() } })
    assert(!(await requestCancel(ideaId, secondId)), '   …and a cancel on a finished build applies to nothing')

    // ── versioning: a re-run is the normal case ─────────────────────────────
    const thirdId = await claimBuild(ideaId, 'A_NAIVE')
    const third = await prisma.ideaBuild.findUnique({ where: { id: thirdId }, select: { version: true } })
    assert((third?.version ?? 0) === 3, '§2 a re-run gets the next version, not a rejection', `version ${third?.version}`)
    const all = await prisma.ideaBuild.findMany({ where: { ideaId }, select: { version: true }, orderBy: { version: 'asc' } })
    assert(
      all.map((b) => b.version).join(',') === '1,2,3',
      '   …and the earlier builds are all still there',
      all.map((b) => b.version).join(','),
    )

    // ── §6 "every field is editable and savable exactly as today" ───────────
    //
    // This is the check that would have caught the whole thing being unusable. A build
    // fills fields on all four pages; `assertWritableField` refuses a write to a page
    // ahead of `Idea.lexPage`. If the pointer is not moved, every drafted field beyond
    // Orientation 409s on Save and the user is left looking at a panel of drafts they
    // cannot keep. Asserted BOTH WAYS, because a guard that always allows is not a guard.
    const SPREAD = ['title', 'challenge', 'chosenApproach', 'coherenceCheck']
    await prisma.idea.update({ where: { id: ideaId }, data: { lexPage: 'ORIENTATION' } })
    const blockedBefore = (await Promise.all(SPREAD.map((k) => assertWritableField(ideaId, k)))).filter(Boolean).length
    assert(
      blockedBefore === 3,
      '§6 CONTROL — with the pointer at ORIENTATION, the three later-page fields are refused',
      `${blockedBefore} of 3 refused`,
    )
    await prisma.idea.update({ where: { id: ideaId }, data: { lexPage: 'COHERENT_ACTIONS' } })
    const blockedAfter = (await Promise.all(SPREAD.map((k) => assertWritableField(ideaId, k)))).filter(Boolean).length
    assert(
      blockedAfter === 0,
      '§6 with every page opened (as a completed build leaves it), all four are savable',
      `${blockedAfter} still refused`,
    )

    // ── §6 "an idea created the existing way still works end to end" ────────
    const control = await prisma.idea.create({
      data: {
        creatorId: user.id,
        title: '[25-A live verification] existing-path control — deleted immediately',
        summaryDescription: '', govtArea: '', stage: 'STAGE_1', visibility: 'PRIVATE', status: 'DRAFT',
      },
      select: { id: true },
    })
    try {
      await initializeFieldStates(control.id, user.id)
      const st = await computeCanonicalState(control.id)
      assert(st?.stage === 'ORIENTATION', '§6 an idea made the existing way still starts at ORIENTATION', `stage ${st?.stage}`)
      assert(
        st?.currentField?.key === 'ideaNarrative' && st.currentField.status === 'EMPTY',
        '   …with the same first field, EMPTY',
        `currentField ${st?.currentField?.key}/${st?.currentField?.status}`,
      )
      assert(st?.pages.length === 4, '   …and the same four pages', `${st?.pages.length} pages`)
      assert(
        (await prisma.ideaElicitation.count({ where: { ideaId: control.id } })) === 0,
        '   …and 25-A created NOTHING for it — the new path is not on the old one',
      )
    } finally {
      await prisma.idea.delete({ where: { id: control.id } }).catch(() => {})
    }
  } finally {
    // Hard delete: this is a test artefact, not a proposal. Cascade removes the builds,
    // the forks and the elicitation with it.
    await prisma.idea.delete({ where: { id: ideaId } }).catch((e) =>
      console.error('cleanup failed — remove the idea by hand:', ideaId, e instanceof Error ? e.message : e))
    console.log(`\ncleaned up ${ideaId}`)
  }

  console.log(`\n${pass} passed, ${fail} failed.`)
  await prisma.$disconnect()
  process.exit(fail ? 1 : 0)
}

main().catch(async (e) => {
  console.error('verification threw:', e instanceof Error ? e.stack : e)
  await prisma.$disconnect()
  process.exit(1)
})
