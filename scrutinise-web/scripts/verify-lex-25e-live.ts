// ─────────────────────────────────────────────────────────────────────────────
// verify:lex-25e — THE WHOLE ELICITATION, WALKED, AGAINST THE LIVE DATABASE.
//
// ⚠⚠ WHY THIS EXISTS, AND IT IS THE MOST EXPENSIVE LESSON THIS PROJECT HAS LEARNED.
//
// Eight sprints of work — the build, the review agenda, the by-question panel, document
// upload, publishing, the proposal, the summary, the evidence pack — sit behind this flow,
// every one of them green on its own checks, and NONE OF IT HAS EVER BEEN REACHED. The
// `IdeaBuild` table was EMPTY. Not one build had ever been started, by anyone, because the
// front door did not open.
//
// Every one of those sprints' checks was true. They tested the code behind the door.
//
// So this walks the flow the way a person walks it, in order, through the real functions,
// and asserts the ONE thing no previous check asserted: **that after the user confirms, the
// build can actually be started.** That is the assertion that was false in production for
// eight sprints while everything around it was green.
//
// It creates its own throwaway user and idea (tagged `[25-E verify]…`) and hard-deletes them
// in a `finally`.
//
// ⚠ IT MAKES ONE REAL MODEL CALL — the understanding paragraph. That is not optional here:
// the confirmation cannot be reached without it, and the whole point is to reach it.
//
// Usage: npm run verify:lex-25e
// ─────────────────────────────────────────────────────────────────────────────

import { randomBytes } from 'crypto'
import { prisma } from '../lib/prisma'
import {
  elicitationState, answerStep, confirmElicitation, correctElicitation, retryUnderstanding,
} from '../lib/lex/elicitation'
import { buildState } from '../lib/lex/build'

const TAG = '[25-E verify]'
const nonce = randomBytes(4).toString('hex')

let pass = 0
let fail = 0
function ok(label: string, condition: boolean, detail?: string) {
  if (condition) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

// Deliberately problem-shaped, not solution-shaped: the §19-D gate is not what is under test
// here and a press would add a model call and a branch that has its own harness.
const PROBLEM = [
  'Families in temporary accommodation in my borough are moved with under 48 hours notice, and',
  'the children lose their school place because the new placement is outside the catchment. I have',
  'seen four cases this year. Nobody records the moves, so the scale is invisible to the council.',
].join(' ')
const OWN_KNOWLEDGE = [
  'I sat on the housing panel for six years. The moves are driven by a nightly-rate cap the',
  'finance team applies, not by any housing officer decision — that is not written down anywhere.',
].join(' ')

async function main() {
  console.log('── verify:lex-25e (live) ──\n')
  const dbHost = (process.env.DATABASE_URL ?? '').match(/@([^/:]+)/)?.[1] ?? 'unknown'
  console.log(`  database host: ${dbHost}\n`)

  const user = await prisma.user.create({
    data: {
      clerkId: `verify25e_${nonce}`,
      firstName: 'Verify', lastName: '25E',
      name: 'Verify 25E', preferredName: 'Verifier',
      username: `verify25e-${nonce}`,
      email: `verify25e-${nonce}@example.invalid`,
      referralCode: `V25E${nonce}`.slice(0, 20).toUpperCase(),
      // A returning user, so the optional profile step is skipped — the shortest real path.
      aboutYouNarrative: 'Six years on a borough housing panel.',
    },
    select: { id: true },
  })

  const idea = await prisma.idea.create({
    data: {
      creator: { connect: { id: user.id } },
      title: `${TAG} temporary accommodation ${nonce}`,
      summaryDescription: 'Children lose their school place when families are moved at short notice.',
      govtArea: 'Housing',
    },
    select: { id: true },
  })

  try {
    // ── the walk ────────────────────────────────────────────────────────────
    console.log('§1/§2 — walking the flow the way a person walks it')

    let s = await elicitationState(idea.id, user.id)
    ok('a fresh elicitation opens on a question', s.phase === 'QUESTION' && s.currentStep === 'problem',
      `phase=${s.phase} step=${s.currentStep}`)
    ok('§4a — the opening card does NOT reprint the question Lex just asked',
      s.steps.find((x) => x.key === 'problem')?.cardPrompt === null)

    ;({ state: s } = await answerStep(idea.id, user.id, { step: 'problem', text: PROBLEM }))
    // ⚠ §2 — READ BACK FROM THE DATABASE, not from the object the writer returned. An
    // in-memory round trip proves nothing about persistence, which is the whole question.
    const afterProblem = await prisma.ideaElicitation.findUnique({ where: { ideaId: idea.id } })
    ok('§2 — the answer is in the DATABASE the moment it is given',
      afterProblem?.problem === PROBLEM, `${afterProblem?.problem?.length ?? 0} chars stored`)

    // §4b — the requirement the UI now states is a real one, so stating it is not decoration.
    let refused = false
    try { await answerStep(idea.id, user.id, { step: 'goal', text: 'something' }) }
    catch { refused = true }
    ok('§4b — question 2 really does require a category (so saying so is honest)', refused)

    ;({ state: s } = await answerStep(idea.id, user.id, { step: 'goal', goalKind: 'APPLICATION_CHANGE', text: 'Stop out-of-borough moves mid-term.' }))
    ok('after question 2 the flow moves on', s.currentStep === 'ownKnowledge', `step=${s.currentStep}`)

    ;({ state: s } = await answerStep(idea.id, user.id, { step: 'ownKnowledge', text: OWN_KNOWLEDGE }))
    const afterKnowledge = await prisma.ideaElicitation.findUnique({ where: { ideaId: idea.id } })
    ok('§2 — the most valuable answer is stored, with its provenance',
      afterKnowledge?.ownKnowledge === OWN_KNOWLEDGE && afterKnowledge?.ownKnowledgeProvenance === 'USER_TESTIMONY')

    // The last question. Answering it is what triggers the understanding paragraph.
    ;({ state: s } = await answerStep(idea.id, user.id, { step: 'reading', skip: true }))
    ok('§1 — every question answered leaves the user AT THE CONFIRMATION, with a paragraph to read',
      s.phase === 'AWAITING_CONFIRMATION' && !!s.understanding,
      `phase=${s.phase} understanding=${s.understanding ? `${s.understanding.length} chars` : 'NULL'}`)

    // ── §2: survive a reload ────────────────────────────────────────────────
    const reloaded = await elicitationState(idea.id, user.id)
    ok('§2 — a reload returns the same state, not a blank one',
      reloaded.phase === s.phase && reloaded.understanding === s.understanding
      && reloaded.steps.find((x) => x.key === 'problem')?.answer === PROBLEM)

    // ⚠ AND THE RESUME QUERY FINDS IT. This is `page.tsx`'s own condition, restated: a user
    // who closes the tab and comes back to a bare `/ideas/build` must land on THIS idea and
    // not on a new one. It is the query, not the intention, that decides.
    const resumeTarget = await prisma.ideaElicitation.findFirst({
      where: { idea: { creatorId: user.id, deletedAt: null, builds: { none: {} } } },
      orderBy: { updatedAt: 'desc' },
      select: { ideaId: true },
    })
    ok('§2 — returning to a bare /ideas/build resumes THIS idea rather than minting a new one',
      resumeTarget?.ideaId === idea.id)

    // ── §1: the headline. ───────────────────────────────────────────────────
    console.log('\n§1 — the assertion that was false in production for eight sprints')

    const beforeConfirm = await buildState(idea.id)
    ok('before confirming, the build is correctly blocked',
      !beforeConfirm.canStart && !!beforeConfirm.blockedReason)

    const confirmed = await confirmElicitation(idea.id, user.id)
    ok('confirming moves the elicitation to CONFIRMED', confirmed.phase === 'CONFIRMED')

    // ⚠⚠ THIS ONE. Every previous sprint's checks passed while this was, in effect, false on
    // the user's screen — not because the server was wrong, but because the client never
    // asked again. Both halves are asserted from the same moment in time.
    const afterConfirm = await buildState(idea.id)
    ok('⚠ AFTER CONFIRMING, THE BUILD CAN ACTUALLY BE STARTED',
      afterConfirm.canStart === true,
      `canStart=${afterConfirm.canStart} blockedReason=${JSON.stringify(afterConfirm.blockedReason)}`)
    ok('and no stale "confirm first" reason survives alongside it',
      afterConfirm.blockedReason === null)

    // The user's own words reached the fields the rest of the product reads.
    const fields = await prisma.ideaFieldState.findMany({ where: { ideaId: idea.id } })
    ok('confirming puts the user’s own words where the product looks for them',
      fields.some((f) => f.fieldKey === 'ideaNarrative' && (f.value ?? '').includes('48 hours')))

    // ── §1: the second dead end ─────────────────────────────────────────────
    console.log('\n§1 — the failed-understanding dead end')

    // Reproduce exactly what a failed `writeUnderstanding` leaves behind: every question
    // answered, no paragraph, status IN_PROGRESS.
    await prisma.ideaElicitation.update({
      where: { ideaId: idea.id },
      data: { status: 'IN_PROGRESS', understanding: null, confirmedAt: null },
    })
    const broken = await elicitationState(idea.id, user.id)
    // ⚠ THE OLD CLIENT RENDERED NOTHING HERE: the question card was suppressed on
    // `currentStep === 'confirm'`, the confirmation needed AWAITING_CONFIRMATION and the
    // build card needed CONFIRMED. A page with no controls on it.
    ok('a failed understanding is a NAMED phase, not three false conditions',
      broken.phase === 'UNDERSTANDING_FAILED', `phase=${broken.phase} step=${broken.currentStep}`)
    ok('and the answers are still all there',
      broken.steps.find((x) => x.key === 'problem')?.answer === PROBLEM)

    const retried = await retryUnderstanding(idea.id, user.id)
    ok('and it can be retried back to the confirmation',
      retried.phase === 'AWAITING_CONFIRMATION' && !!retried.understanding, `phase=${retried.phase}`)

    // ⚠ A retry is NOT a correction — it must not count against the user or put words in
    // their mouth, which is what routing it through `correct` would have done.
    const afterRetry = await prisma.ideaElicitation.findUnique({ where: { ideaId: idea.id } })
    ok('a retry is not recorded as the user correcting Lex', afterRetry?.corrections === 0,
      `corrections=${afterRetry?.corrections}`)

    // A correction, by contrast, IS counted and re-runs only the confirmation.
    const corrected = await correctElicitation(idea.id, user.id, 'It is the school place that matters, not the housing.')
    const afterCorrection = await prisma.ideaElicitation.findUnique({ where: { ideaId: idea.id } })
    ok('§1b — "not quite" re-runs the confirmation ONLY, and is counted',
      corrected.phase === 'AWAITING_CONFIRMATION' && afterCorrection?.corrections === 1
      && corrected.steps.find((x) => x.key === 'problem')?.answer === PROBLEM,
      `phase=${corrected.phase} corrections=${afterCorrection?.corrections}`)
  } finally {
    console.log('\n── cleanup ──')
    await prisma.ideaFieldState.deleteMany({ where: { ideaId: idea.id } }).catch(() => {})
    await prisma.idea.delete({ where: { id: idea.id } }).catch((e) => console.log('  idea delete:', e.message))
    await prisma.user.delete({ where: { id: user.id } }).catch((e) => console.log('  user delete:', e.message))
    const left = await prisma.idea.count({ where: { title: { startsWith: TAG } } })
    console.log(`  ideas left tagged "${TAG}": ${left}`)
    await prisma.$disconnect()
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
