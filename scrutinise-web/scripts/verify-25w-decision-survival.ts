import { randomUUID } from 'crypto'
import { prisma } from '../lib/prisma'
import { claimBuild } from '../lib/lex/build'

// ─────────────────────────────────────────────────────────────────────────────────────────
// 25-W §G (decision 57) — DOES A BUILD PRESERVE SETTLED DECISIONS? THE SCRATCH-IDEA TEST.
//
// 25-V's addendum could only answer this for ONE idea, and only by luck: the seven accepted
// fields on `452c5ade` survived a rebuild because none of them is a field the build writes.
// Three of the four decision kinds could not be measured at all — no root cause is marked on
// an idea that has had a build since, `INCLUDED` has never been written on any idea, and no
// ruled-out policy has had a build after it. **0 of 88 accepted build-written fields anywhere
// has ever had a build run after acceptance.**
//
// So this makes the case that does not exist: one throwaway idea carrying all four decisions,
// and one real build over it.
//
//   1. an ACCEPTED `rootCause`        — a field the build writes
//   2. an ACCEPTED `chosenApproach`   — a field the build writes
//   3. a marked root cause on a LEX-authored cause — the shape REVISE deletes
//   4. a RULED_OUT policy option      — the shape `writeSort` is believed to leave alone
//
// ⚠ IT SPENDS 3 OF THE 48 THIRDS. Charlie approved that. It is one FULL build, run through
// `claimBuild` — the same entry point the button uses — so the allowance is charged exactly
// as a user's build is, and the worker picks it up exactly as it picks up a user's.
//
// ⚠ IT IS A COLD READ AT THE END (CLAUDE.md §26). The verification calls nothing the build
// calls and re-implements no predicate: it reads the four rows back with Prisma, compares them
// to what was recorded before, and prints the re-read rather than the intention.
//
// ⚠ THE SCRATCH IDEA IS **NOT** DELETED. A build that reverted a decision leaves the evidence
// in these rows, and destroying them in a `finally` would destroy the finding along with the
// fixture. It is marked, and `--sweep` removes it when Charlie has read the answer.
//
// Usage:
//   npx tsx --env-file=.env scripts/verify-25w-decision-survival.ts --arrange   (no spend)
//   npx tsx --env-file=.env scripts/verify-25w-decision-survival.ts --build     (spends 3 thirds)
//   npx tsx --env-file=.env scripts/verify-25w-decision-survival.ts --verify
//   npx tsx --env-file=.env scripts/verify-25w-decision-survival.ts --sweep
// ─────────────────────────────────────────────────────────────────────────────────────────

const MARK = '25W-DECISION-SURVIVAL'
const STATE = '../docs/25W_DECISION_SURVIVAL.json'

const ROOT_CAUSE_TEXT =
  'Nobody inside the authority is answerable for whether the licence conditions are ever checked.'
const CHOSEN_APPROACH_TEXT =
  'Put the checking duty on one named officer and publish whether it was done.'
const LEX_CAUSE_TEXT =
  'Inspection is funded from the same budget as the service being inspected.'
const RULED_OUT_TEXT = 'Abolish the licence regime altogether.'
const RULE_OUT_REASON = 'The proposer has ruled this out: it removes the protection, not the failure to enforce it.'

import { readFileSync, writeFileSync, existsSync } from 'fs'

type Before = {
  ideaId: string
  buildId?: string
  rootCauseFieldStatus: string
  rootCauseFieldValue: string
  chosenApproachFieldStatus: string
  chosenApproachFieldValue: string
  lexCauseId: string
  lexCauseIsRoot: boolean
  /**
   * ⚠⚠ EXISTENCE IS RECORDED SEPARATELY FROM THE MARK, and the first version of this file did
   * not do that. `cause?.isRootCause ?? false` reports `false` for a row that was cleared AND
   * for a row that was deleted, so the verdict line said "true → false" over a row that had
   * been destroyed — a true sentence that named the wrong mechanism. REVISE deletes every
   * `LEX_CORPUS` cause and writes new ones, which is a different finding from unmarking one.
   */
  lexCauseExists: boolean
  /** How many causes of each origin, so a delete-and-replace is visible as what it is. */
  lexCauseCount: number
  userCauseCount: number
  ruledOutOptionId: string
  ruledOutStatus: string
  ruledOutReason: string
}

async function arrange() {
  const owner = await prisma.user.findFirst({
    where: { email: 'cl@scrutinise.org' }, select: { id: true },
  }) ?? await prisma.user.findFirst({ select: { id: true } })
  if (!owner) throw new Error('no user to own the fixture')

  const idea = await prisma.idea.create({
    data: {
      creatorId: owner.id,
      title: `${MARK} ${randomUUID().slice(0, 8)} — scratch, 25-W §G`,
      summaryDescription: 'Throwaway idea created by 25-W §G to measure whether a build preserves settled decisions. Not a real proposal.',
      govtArea: 'Check fixture',
    },
    select: { id: true, createdAt: true },
  })
  const ideaId = idea.id
  console.log(`scratch idea ${ideaId}  (fresh: ${Date.now() - idea.createdAt.getTime() < 60_000})`)

  // ── the elicitation, CONFIRMED, because `claimBuild` refuses otherwise ────────────────
  await prisma.ideaElicitation.create({
    data: {
      ideaId,
      problem: 'Licence conditions on small waste carriers are set but almost never checked, so the conditions do nothing.',
      goalKind: 'CHANGE_BEHAVIOUR',
      goalDetail: 'Licence conditions are actually inspected, and somebody is answerable when they are not.',
      ruledOut: 'Abolishing the licence regime.',
      ownKnowledge: 'I sat on a district licensing panel for two years and never once saw an inspection report.',
      understanding: 'Conditions are imposed and never enforced, and no one person is answerable for the checking.',
      status: 'CONFIRMED',
      confirmedAt: new Date(),
    },
  })

  // ── 1 + 2. two ACCEPTED fields the build writes ──────────────────────────────────────
  for (const [fieldKey, value] of [
    ['rootCause', ROOT_CAUSE_TEXT],
    ['chosenApproach', CHOSEN_APPROACH_TEXT],
  ] as const) {
    await prisma.ideaFieldState.create({
      data: { ideaId, fieldKey, value, status: 'ACCEPTED' },
    })
  }

  // ── 3. a marked root cause on a LEX-authored cause ───────────────────────────────────
  // ⚠ `source: 'LEX_CORPUS'` on purpose. 25-V read that REVISE deletes causes scoped to
  // exactly that source, so a root-cause mark on one dies with the row. This is the shape
  // that was read in the code and never once observed.
  const lexCause = await prisma.diagnosisCause.create({
    data: { ideaId, cause: LEX_CAUSE_TEXT, source: 'LEX_CORPUS', isRootCause: true },
    select: { id: true },
  })
  await prisma.diagnosisCause.create({
    data: { ideaId, cause: 'Officers have no duty to record whether a condition was checked.', source: 'USER' },
  })

  // ── 4. a RULED_OUT policy option ─────────────────────────────────────────────────────
  const ruledOut = await prisma.policyOption.create({
    data: {
      ideaId, approach: RULED_OUT_TEXT, source: 'LEX',
      status: 'RULED_OUT', ruleOutReason: RULE_OUT_REASON,
    },
    select: { id: true },
  })
  await prisma.policyOption.create({
    data: { ideaId, approach: 'Name one accountable officer per licence and publish the check.', source: 'LEX' },
  })

  const before = await snapshotDecisions(ideaId, lexCause.id, ruledOut.id)
  writeFileSync(STATE, JSON.stringify(before, null, 2), 'utf8')
  console.log(`\narranged. state written to ${STATE}`)
  print('BEFORE', before)
}

async function snapshotDecisions(ideaId: string, lexCauseId: string, ruledOutOptionId: string): Promise<Before> {
  const fields = await prisma.ideaFieldState.findMany({
    where: { ideaId, fieldKey: { in: ['rootCause', 'chosenApproach'] } },
    select: { fieldKey: true, status: true, value: true },
  })
  const f = (k: string) => fields.find((x) => x.fieldKey === k)
  const cause = await prisma.diagnosisCause.findUnique({
    where: { id: lexCauseId }, select: { isRootCause: true },
  })
  const causes = await prisma.diagnosisCause.findMany({
    where: { ideaId }, select: { source: true },
  })
  const opt = await prisma.policyOption.findUnique({
    where: { id: ruledOutOptionId }, select: { status: true, ruleOutReason: true },
  })
  return {
    ideaId,
    rootCauseFieldStatus: f('rootCause')?.status ?? 'MISSING',
    rootCauseFieldValue: String(f('rootCause')?.value ?? ''),
    chosenApproachFieldStatus: f('chosenApproach')?.status ?? 'MISSING',
    chosenApproachFieldValue: String(f('chosenApproach')?.value ?? ''),
    lexCauseId,
    lexCauseIsRoot: cause?.isRootCause ?? false,
    lexCauseExists: cause != null,
    lexCauseCount: causes.filter((c) => c.source === 'LEX_CORPUS').length,
    userCauseCount: causes.filter((c) => c.source !== 'LEX_CORPUS').length,
    ruledOutOptionId,
    ruledOutStatus: opt?.status ?? 'ROW GONE',
    ruledOutReason: opt?.ruleOutReason ?? '',
  }
}

function print(label: string, s: Before) {
  console.log(`\n── ${label} ──`)
  console.log(`  1. rootCause field       : ${s.rootCauseFieldStatus}  "${s.rootCauseFieldValue.slice(0, 70)}"`)
  console.log(`  2. chosenApproach field  : ${s.chosenApproachFieldStatus}  "${s.chosenApproachFieldValue.slice(0, 70)}"`)
  // ⚠ A STATE FILE WRITTEN BY AN EARLIER VERSION OF THIS SCRIPT HAS NO `lexCauseExists`, and
  // `undefined` must not be printed as "ROW DELETED" — that would be this file inventing a
  // fact about a moment it did not record. It says what it has.
  const existence = s.lexCauseExists === undefined
    ? '(existence not recorded — this state file predates the field)'
    : s.lexCauseExists ? `present, isRootCause=${s.lexCauseIsRoot}` : 'ROW DELETED'
  const counts = s.lexCauseCount === undefined
    ? ''
    : `  (causes: ${s.lexCauseCount} LEX_CORPUS, ${s.userCauseCount} user)`
  console.log(`  3. LEX cause ${s.lexCauseId.slice(0, 8)} : ${existence}${counts}`)
  console.log(`  4. ruled-out option      : ${s.ruledOutStatus}  reason "${s.ruledOutReason.slice(0, 60)}"`)
}

async function build() {
  const before = JSON.parse(readFileSync(STATE, 'utf8')) as Before
  const buildId = await claimBuild(before.ideaId, 'B_CONTEXTUALISED')
  before.buildId = buildId
  writeFileSync(STATE, JSON.stringify(before, null, 2), 'utf8')
  // ⚠⚠ THIS SHELL IS NOT THE DEPLOYMENT, AND `claimBuild` READS THE SHELL. The local `.env`
  // has no `LEX_BUILD_DRIVER`, so `buildDriver()` resolves to `client` here and `claimBuild`
  // moves the row straight to RUNNING for a caller that is about to drive it — which this
  // script is not. The row would then sit at RUNNING, invisible to the worker's queue, until
  // the stalled-build sweep found it. Production's driver is `worker` (read off /api/health),
  // so the row is put back to the state production would have left it in, and the count is
  // read rather than assumed.
  const requeued = await prisma.ideaBuild.updateMany({
    where: { id: buildId, status: 'RUNNING' },
    data: { status: 'QUEUED', startedAt: null, currentPass: null },
  })
  console.log(`enqueued build ${buildId} on idea ${before.ideaId}` +
    (requeued.count ? ' (re-queued for the worker — this shell resolves the driver as `client`)' : ''))
  const check = await prisma.ideaBuild.findUnique({ where: { id: buildId }, select: { status: true } })
  console.log(`  row status, re-read: ${check?.status}`)
  console.log('The worker claims it within a few seconds. Re-run with --verify when it is DONE.')
}

async function verify() {
  const before = JSON.parse(readFileSync(STATE, 'utf8')) as Before
  const row = before.buildId
    ? await prisma.ideaBuild.findUnique({
        where: { id: before.buildId },
        select: { status: true, passesComplete: true, estCostPence: true, startedAt: true, completedAt: true, failureReason: true, notifyEmail: true },
      })
    : null
  console.log(`\nbuild ${before.buildId?.slice(0, 8)}: ${row?.status} ${row?.passesComplete} passes ` +
    `${row?.estCostPence}p ${row?.startedAt && row?.completedAt ? Math.round((row.completedAt.getTime() - row.startedAt.getTime()) / 1000) + 's' : ''}` +
    `${row?.failureReason ? ` — ${row.failureReason}` : ''}`)

  // ⚠ THE COLD READ. Prisma, the four rows, nothing the build calls.
  const after = await snapshotDecisions(before.ideaId, before.lexCauseId, before.ruledOutOptionId)
  print('BEFORE (recorded before the build)', before)
  print('AFTER (re-read now)', after)

  const lines: string[] = []
  const verdict = (n: string, survived: boolean, detail: string) => {
    lines.push(`  ${survived ? '✓ SURVIVED' : '✗ REVERTED'}  ${n} — ${detail}`)
  }
  verdict('accepted rootCause',
    after.rootCauseFieldStatus === 'ACCEPTED',
    `${before.rootCauseFieldStatus} → ${after.rootCauseFieldStatus}` +
      (after.rootCauseFieldValue !== before.rootCauseFieldValue ? ' AND THE VALUE WAS REWRITTEN' : ', value unchanged'))
  verdict('accepted chosenApproach',
    after.chosenApproachFieldStatus === 'ACCEPTED',
    `${before.chosenApproachFieldStatus} → ${after.chosenApproachFieldStatus}` +
      (after.chosenApproachFieldValue !== before.chosenApproachFieldValue ? ' AND THE VALUE WAS REWRITTEN' : ', value unchanged'))
  verdict('root-cause mark on a LEX cause',
    after.lexCauseExists && after.lexCauseIsRoot,
    after.lexCauseExists
      ? `the row survived; isRootCause ${before.lexCauseIsRoot} → ${after.lexCauseIsRoot}`
      : `THE ROW WAS DELETED and replaced (${after.lexCauseCount} LEX cause(s) on the idea now) — ` +
        'the mark did not die on its own, it died with the row')
  verdict('ruled-out policy option',
    after.ruledOutStatus === 'RULED_OUT',
    `${before.ruledOutStatus} → ${after.ruledOutStatus}` +
      (after.ruledOutReason !== before.ruledOutReason ? ', REASON CHANGED' : ', reason kept'))

  console.log('\n── §G verdict, per decision kind ──')
  console.log(lines.join('\n'))
  console.log(`\n(the scratch idea ${before.ideaId} is deliberately NOT deleted — run --sweep when read)`)
}

async function sweep() {
  const n = await prisma.idea.deleteMany({ where: { title: { startsWith: MARK } } })
  console.log(`deleted ${n.count} scratch idea(s)`)
  const left = await prisma.idea.count({ where: { title: { startsWith: MARK } } })
  console.log(`re-read: ${left} remaining`)
}

async function main() {
  if (process.argv.includes('--arrange')) return arrange()
  if (process.argv.includes('--build')) return build()
  if (process.argv.includes('--verify')) return verify()
  if (process.argv.includes('--sweep')) return sweep()
  console.log(`state file ${existsSync(STATE) ? 'exists' : 'does not exist'}. Pass --arrange | --build | --verify | --sweep`)
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
