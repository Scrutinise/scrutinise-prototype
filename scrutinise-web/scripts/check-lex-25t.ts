// ─────────────────────────────────────────────────────────────────────────────
// check:lex-25t — 25-T, asserted on rendered data and on real writes.
//
// CLAUDE.md §25 (assert rendered data) and §26 (the cold read) apply. §3 of the brief adds a
// third rule, and it is the one this sprint most needs: *"not a rule about how to write a check,
// but a list of sentences that must be visible."* The strings are listed in the report and read
// off production in a browser; what this file does is assert the BEHAVIOUR under them, so that a
// sentence which is true today cannot quietly become false.
//
// ⚠⚠ THE FIXTURE IS A SCRATCH IDEA IT CREATES AND DELETES. This runs against production Neon,
// where a fixture that reuses a live row is a check that passes on Charlie's own data — the
// `check:central` failure of 22 August, exactly. Leftovers from an interrupted run are swept
// first and REPORTED.
//
// Usage: npm run check:lex-25t
// ─────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { writeMerge, applyPolicyOp, readPolicyState, POLICY_OPS } from '../lib/lex/guiding-policy-state'
import { AUTO_RESUME_LIMIT } from '../lib/lex/build'
import { buildDriver } from '../lib/lex/build-config'

let passed = 0
let failed = 0
let dead = 0
let controls = 0
const notChecked: string[] = []

function ok(label: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

/**
 * ⚠⚠ A CONTROL IS THE ASSERTION RUN AGAINST INPUT THAT SHOULD BREAK IT. If it does not fail, the
 * assertion above it proves nothing, and the control is reported DEAD rather than passing —
 * CLAUDE.md's "a guard that cannot fail is not a guard", made countable.
 */
function control(label: string, propertyHoldsOnBrokenInput: () => boolean) {
  controls++
  const held = propertyHoldsOnBrokenInput()
  if (held) { dead++; console.log(`  ⚠ DEAD CONTROL — ${label} (it passed on input that should break it)`) }
  else console.log(`  ✓ fired — ${label}`)
}

function code(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}

/** ⚠ Comments are stripped before an ABSENCE is asserted — a note explaining a deleted string
 *  quotes it, and the grep then reads its own explanation. (CLAUDE.md, 30 Aug.) */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const MARK = '25T-CHECK'

async function main() {
  console.log('\n── check:lex-25t — the build off the tab, and the merge made real ──\n')

  // ══════════════════ §1 — THE BUILD RUNS SOMEWHERE THAT IS NOT A TAB ═══════════════════
  console.log('§1 — the worker')

  const deploy = code('scripts/deploy-build-worker.ts')
  // ⚠ THE FIRST DEPLOY FAILED ON EXACTLY THIS. Railway saw a Next.js app and ran `npm run build`,
  // which died prerendering /admin/invites with no Clerk key. The worker needs node_modules and
  // the Prisma client, nothing else.
  ok('the worker service does not run the Next.js production build',
    /buildCommand: 'npx prisma generate'/.test(deploy))
  ok('and it points at the Neon database, not Railway\'s dead one',
    /DATABASE_URL: '\$\{\{Ingest\.NEON_DATABASE_URL\}\}'/.test(deploy)
    && !/DATABASE_URL: '\$\{\{Ingest\.DATABASE_URL\}\}'/.test(stripComments(deploy)))
  control('a service copying Ingest.DATABASE_URL must fail that',
    () => !/\$\{\{Ingest\.DATABASE_URL\}\}/.test("DATABASE_URL: '${{Ingest.DATABASE_URL}}'"))

  // ── §1c — the flip is verifiable from outside, which is the whole reason it was added ──
  const health = code('app/api/health/route.ts')
  ok('the health endpoint reports which build driver is in force',
    /build: \{ driver: buildDriver\(\) \}/.test(health))
  ok('and it reads it through the code\'s own resolver, not process.env',
    /buildDriver\(\)/.test(health) && !/process\.env\.LEX_BUILD_DRIVER/.test(stripComments(health)))
  console.log(`    (this process resolves the driver as: ${buildDriver()})`)

  // ── §1f — bounded, and the bound is spent before the attempt ──
  const build = code('lib/lex/build.ts')
  ok('auto-resume is bounded at two attempts', AUTO_RESUME_LIMIT === 2, `${AUTO_RESUME_LIMIT}`)
  ok('the counter goes up BEFORE the attempt, so a throw cannot leave it unspent',
    /autoResumeCount: \{ increment: 1 \} \},\s*\}\)\s*await resumeBuild/.test(build.replace(/\/\/[^\n]*\n/g, '\n')))
  // ⚠ MEASURED, NOT ASSUMED: the CANCELLED term could never match, because the one CANCELLED row
  // on Neon has a NULL completedAt and the window filter excludes it.
  ok('it resumes FAILED builds only — a user\'s cancellation is never restarted',
    /status: 'FAILED',\s*\n\s*autoResumeCount/.test(build))
  ok('and a cost stop is never retried', /spend\|cost\|ceiling/.test(build))

  // ── §1h — the checkbox only promises what the architecture can keep ──
  const cards = code('components/lex/ElicitationCards.tsx')
  ok('"you can close this tab" is offered only under the worker driver',
    /p\.driver === 'worker'/.test(cards) && /you can close this tab/.test(cards))
  ok('and under the client driver the page says the tab must stay open',
    /Keep this tab open until it finishes/.test(cards))

  // ══════════════════════════ §2 — THE MERGE, ON A REAL WRITE ═══════════════════════════
  console.log('\n§2 — the merge')

  // ⚠ §2b's CENTRAL FACT, ASSERTED AS AN ABSENCE ON STRIPPED SOURCE. The route used to call
  // `writeMerge` in the same request that judged, so asking the question performed the merge.
  const route = stripComments(code('app/api/ideas/[id]/guiding-policy/route.ts'))
  ok('the judging POST no longer writes the merge',
    !/writeMerge\(/.test(route))
  ok('and acceptance is a real operation the validator admits',
    POLICY_OPS.includes('acceptMerge'))
  control('a schema that dropped the op must fail that',
    () => (['reject', 'restore'] as string[]).includes('acceptMerge'))

  const swept = await prisma.idea.deleteMany({ where: { title: { startsWith: MARK } } })
  if (swept.count) console.log(`  · swept ${swept.count} leftover scratch idea(s) from an earlier run`)

  const owner = await prisma.user.findFirst({
    where: { email: 'charles@scalablefinance.com' }, select: { id: true },
  }) ?? await prisma.user.findFirst({ select: { id: true } })
  if (!owner) { console.log('No user to own the fixture.'); process.exit(1) }

  const idea = await prisma.idea.create({
    data: {
      creatorId: owner.id,
      title: `${MARK} ${randomUUID().slice(0, 8)} — scratch fixture, deleted by the check`,
      summaryDescription: 'Created and destroyed by check:lex-25t. Not a real proposal.',
      govtArea: 'Check fixture',
    },
    select: { id: true, createdAt: true },
  })
  ok('the fixture is a new row, not a reused one',
    Date.now() - idea.createdAt.getTime() < 60_000, idea.id.slice(0, 8))
  const ideaId = idea.id

  try {
    const c1 = await prisma.diagnosisCause.create({
      data: { ideaId, cause: 'Nobody is obliged to disclose the terms.', isRootCause: true },
    })
    const c2 = await prisma.diagnosisCause.create({
      data: { ideaId, cause: 'The fee is set with nothing to check it against.' },
    })
    await prisma.policyOption.create({
      data: { ideaId, approach: 'Publish the terms in a register.', number: 1,
        targetCauseIds: [c1.id], kind: 'GUIDING_POLICY' },
    })
    await prisma.policyOption.create({
      data: { ideaId, approach: 'Cap the fee.', number: 2,
        targetCauseIds: [c2.id], kind: 'GUIDING_POLICY' },
    })

    // ── §2c — the parents go somewhere the user can see, with a reason ──
    const MERGED = 'Publish the terms in a register and cap the fee against what it shows.'
    const createdNumber = await writeMerge({
      ideaId, na: 1, nb: 2,
      answer: { verdict: 'MERGE', reasoning: 'Neither is enforceable without the other.',
        chainLink: 'The cap is unmeasurable without the register.',
        merged: { approach: MERGED, caseFor: 'It becomes checkable.', caseAgainst: 'Two duties at once.' } },
    })
    ok('the merged policy takes the next number', createdNumber === 3, `${createdNumber}`)

    let state = await readPolicyState(ideaId)
    const byNum = (n: number) => state.policies.find((p) => p.number === n)

    // ⚠⚠ THE ASSERTION THIS SPRINT EXISTS FOR. 25-P set `mergedIntoId` and nothing else, so the
    // parents rendered in NO list — while the screen said "shown below as superseded". The
    // rendered-list assertion is what makes that sentence true rather than merely intended.
    const rejectedList = state.policies.filter((p) => p.status === 'RULED_OUT')
    ok('both parents appear in the ruled-out list, where the screen says they are',
      [1, 2].every((n) => rejectedList.some((p) => p.number === n)),
      `ruled out: [${rejectedList.map((p) => p.number).join(', ')}]`)
    ok('each names the number it was merged into',
      [1, 2].every((n) => byNum(n)?.ruleOutReason === `Merged into ${createdNumber}.`),
      `${byNum(1)?.ruleOutReason}`)
    control('a parent left with no reason must fail that',
      () => (null as string | null) === `Merged into ${createdNumber}.`)
    ok('and they are still superseded, so the live list does not offer them',
      !!byNum(1)?.superseded && !!byNum(2)?.superseded)
    ok('the merged policy carries BOTH parents\' causes',
      [1, 2].every((n) => (byNum(createdNumber!)?.causeNumbers ?? []).includes(n)),
      `causes [${(byNum(createdNumber!)?.causeNumbers ?? []).join(', ')}]`)

    // ── §2c — and a restore actually returns one to the list ──
    const parentId = byNum(1)!.id
    await applyPolicyOp({ ideaId, op: 'restore', policyId: parentId })
    state = await readPolicyState(ideaId)
    // ⚠ BOTH COLUMNS, OR IT IS NOT A RESTORE. `status: CANDIDATE` alone left the row filtered out
    // by `!p.superseded`, so the button reported success and changed nothing visible.
    const restoredIsLive = () => byNum(1)?.status !== 'RULED_OUT' && !byNum(1)?.superseded
    ok('a restored parent is live again — not merely un-rejected',
      restoredIsLive(), `status ${byNum(1)?.status}, superseded ${byNum(1)?.superseded}`)

    // ⚠⚠ THE CONTROL IS RUN, NOT ASSERTED. My first version of this line was
    //     control('clearing only the status must fail that', () => !(true) === true)
    // — a literal that evaluates to `false` and therefore "fires" without touching the database.
    // It would have gone on firing if `restore` were reverted to the broken one-column write,
    // which is the only thing it exists to catch. So the broken write is now PERFORMED on the
    // other parent, the SAME predicate is run against it, and the control passes only because
    // that predicate genuinely comes back false.
    await prisma.policyOption.updateMany({
      where: { ideaId, number: 2 }, data: { status: 'CANDIDATE' },   // the old, one-column restore
    })
    state = await readPolicyState(ideaId)
    control('the one-column restore 25-P shipped must fail that same predicate',
      () => byNum(2)?.status !== 'RULED_OUT' && !byNum(2)?.superseded)
    // put it back, so the assertions below still describe a superseded row
    await prisma.policyOption.updateMany({
      where: { ideaId, number: 2 }, data: { status: 'RULED_OUT' },
    })
    state = await readPolicyState(ideaId)
    ok('and the stale "Merged into 3." reason is gone from a policy that is no longer merged',
      !byNum(1)?.ruleOutReason)
    ok('while the other parent is untouched by that restore',
      byNum(2)?.status === 'RULED_OUT' && !!byNum(2)?.superseded)

    // ── §2e — the other three verdicts write nothing ──
    const beforeCount = state.policies.length
    for (const verdict of ['ONE_CONTAINS_THE_OTHER', 'SEQUENCE', 'CONTRADICTORY']) {
      const r = await writeMerge({
        ideaId, na: 1, nb: 2,
        answer: { verdict, reasoning: 'x', merged: { approach: 'should never be written' } },
      })
      ok(`a ${verdict} verdict writes nothing`, r === null)
    }
    state = await readPolicyState(ideaId)
    ok('and the list is the same length after all three',
      state.policies.length === beforeCount, `${state.policies.length} vs ${beforeCount}`)
    control('a verdict that had written would fail that',
      () => beforeCount + 1 === beforeCount)

    // ⚠ §2b's write path, end to end, through the op the route calls.
    await prisma.policyOption.updateMany({
      where: { ideaId, number: 2 }, data: { status: 'CANDIDATE', mergedIntoId: null, ruleOutReason: null },
    })
    const applied = await applyPolicyOp({
      ideaId, op: 'acceptMerge',
      merge: { na: 1, nb: 2, merged: { approach: 'Accepted through the op.' }, reasoning: 'r' },
    })
    ok('acceptMerge writes the merge the user accepted',
      'state' in applied
      && applied.state.policies.some((p) => p.approach === 'Accepted through the op.'))

  } finally {
    // ⚠ DELETED, AND RE-READ TO SAY SO. "Deleted" is a claim about the database, not about the
    // call that was made — three ideas I reported deleted on 25 August were still there.
    await prisma.idea.delete({ where: { id: ideaId } }).catch(() => {})
    const stillThere = await prisma.idea.findUnique({ where: { id: ideaId }, select: { id: true } })
    ok('the fixture is gone, re-read after deleting it', !stillThere)
    await prisma.idea.deleteMany({ where: { title: { startsWith: MARK } } }).catch(() => {})
  }

  // ── §3c — what this file cannot reach, named rather than omitted ──
  notChecked.push(
    '§1f\'s two user-facing sentences ("I restarted this build twice…" / "…once, without being '
    + 'asked") need a build with autoResumeCount > 0, which requires a real time-stopped build '
    + 'inside the 30-minute window. Not constructed here: writing that state by hand would assert '
    + 'the fixture, not the worker.',
  )

  console.log(`\n── ${notChecked.length} NOT CHECKED, and why ──`)
  for (const n of notChecked) console.log(`  · ${n}`)
  console.log('  ⚠ These are not passes. Nothing above should be read as covering them.')

  console.log(`\n${passed} passed, ${failed} failed, ${notChecked.length} not checked, `
    + `${controls} controls (${dead} dead)\n`)
  if (failed || dead) process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
