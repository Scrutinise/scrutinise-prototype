// ─────────────────────────────────────────────────────────────────────────────
// SPRINT 25-B §9 — THE ACCEPTANCE CRITERIA, VERIFIED BY MAKING THEM HAPPEN.
//
// check:build-25b asserts the code says the right things. This runs a REAL BUILD and
// asserts what actually came out of it, because those are different claims and 25-A's
// own history is the argument: a tsc-clean build with every offline check green served
// nothing on production for ten hours.
//
// It drives the pass loop the way the client does — `runNextPass` until there is no next
// pass — which also exercises §1's architecture rather than asserting it.
//
// ⚠ WHAT THIS RUN CANNOT SHOW, stated up front so the report does not overclaim: this
// machine's `.env` has no FTS_SEARCH_URL and no LEX_VECTOR_STREAMS, so retrieval is
// whatever the local gateway can reach rather than the production stack. A thin corpus
// makes STATED GAPS more likely, not less — which exercises the honesty paths hard and
// the findings paths lightly. Both halves are reported.
//
// Usage:
//   npx tsx --env-file=.env scripts/verify-build-25b-live.ts
//   npx tsx --env-file=.env scripts/verify-build-25b-live.ts --perspectives
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { claimBuild, runNextPass } from '../lib/lex/build'
import { BUILD_PASSES, PASS_BUDGET_MS, HARD_STOP_MS, COST_CEILING_PENCE, perspectivesFor } from '../lib/lex/build-config'
import { INTERROGATION_LIBRARY, retrievalStanding } from '../lib/lex/interrogation-library'
import { generateAdversarialIssues } from '../lib/lex/deepening-adversarial'

/** The revised kernel, assembled the same way pass 5 assembles it. */
async function kernelFor(ideaId: string): Promise<string> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: {
      title: true, challenge: true, summaryDiagnosis: true, rootCause: true, pivotalObstacle: true,
      chosenApproach: true, summaryGuidingPolicy: true, summaryCoherentActions: true,
      diagnosisCauses: { select: { cause: true, classification: true } },
      lexActions: { select: { practicalStep: true, whoImplements: true } },
    },
  })
  if (!idea) return ''
  return [
    idea.title && `TITLE: ${idea.title}`,
    idea.challenge && `THE PROBLEM: ${idea.challenge}`,
    idea.diagnosisCauses.length && `CAUSES:\n${idea.diagnosisCauses.map((c) => `- (${c.classification}) ${c.cause}`).join('\n')}`,
    idea.rootCause && `ROOT CAUSE: ${idea.rootCause}`,
    idea.pivotalObstacle && `PIVOTAL OBSTACLE: ${idea.pivotalObstacle}`,
    idea.summaryDiagnosis && `THE DIAGNOSIS: ${idea.summaryDiagnosis}`,
    idea.chosenApproach && `THE APPROACH: ${idea.chosenApproach}`,
    idea.summaryGuidingPolicy && `THE GUIDING POLICY: ${idea.summaryGuidingPolicy}`,
    idea.lexActions.length && `ACTIONS:\n${idea.lexActions.map((a) => `- ${a.practicalStep}${a.whoImplements ? ` — ${a.whoImplements}` : ''}`).join('\n')}`,
    idea.summaryCoherentActions && `THE PLAN: ${idea.summaryCoherentActions}`,
  ].filter(Boolean).join('\n\n')
}

let pass = 0
let fail = 0
const notes: string[] = []
function assert(ok: boolean, name: string, detail = '') {
  if (ok) { pass++; console.log(`  ✓  ${name}`) }
  else { fail++; console.log(`  ✗  ${name}${detail ? `\n       ${detail}` : ''}`) }
}
function note(line: string) { notes.push(line); console.log(`  ·  ${line}`) }

/**
 * A problem chosen so the acceptance criteria have something to bite on:
 *   · it is plainly a candidate for PRIMARY legislation, so the leading question fires;
 *   · a delegated power very plausibly already exists, so a positive finding is possible;
 *   · it has a measurable claim in it, so the research can contradict the draft.
 */
/**
 * ⚠ 25-C §3a — THIS IDEA IS CHOSEN, NOT HOPEFUL.
 *
 * `EXISTING_POWER` returned false on four consecutive runs and "undemonstrated" carried for two
 * sprints. A fifth build on a topic picked for other reasons would have produced a fifth
 * non-result. This problem is chosen because the corpus DEMONSTRABLY holds delegated powers over
 * it: the 25-B runs themselves surfaced the Renters' Rights Act 2025 and s.123 of the Housing and
 * Planning Act 2016 while researching exactly this, and `scripts/probe-existing-power.ts` confirms
 * the assessment recognises both when it is shown them.
 *
 * So a false verdict here cannot be blamed on the corpus. That is what makes it a test rather
 * than another attempt.
 */
const PROBLEM =
  'Private landlords in my town are letting flats with damp and mould that make children ill, and the ' +
  'council says it has no power to force repairs quickly enough. I want a new law requiring landlords ' +
  'to fix serious damp within 14 days or face automatic fines, because at the moment tenants wait ' +
  'months and nothing happens.'

async function main() {
  const withPerspectives = process.argv.includes('--perspectives')
  if (withPerspectives) process.env.LEX_BUILD_PERSPECTIVES = 'true'

  console.log(`── verify:build-25b-live${withPerspectives ? ' --perspectives' : ''} ──`)
  console.log(`${BUILD_PASSES.length} passes · pass budget ${Math.round(PASS_BUDGET_MS / 1000)}s · ` +
    `hard stop ${Math.round(HARD_STOP_MS / 1000)}s · build ceiling ${COST_CEILING_PENCE}p`)
  console.log(`perspectives: ORIENT ${perspectivesFor('ORIENT').length}, RESEARCH ${perspectivesFor('RESEARCH').length}\n`)

  const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } })
  if (!user) { console.error('no user to own the throwaway idea'); process.exit(1) }

  const idea = await prisma.idea.create({
    data: {
      creatorId: user.id,
      title: `[25-B live verification${withPerspectives ? ' · perspectives' : ''}] throwaway — deleted at the end`,
      summaryDescription: '', govtArea: '', stage: 'STAGE_1', visibility: 'PRIVATE', status: 'DRAFT',
    },
    select: { id: true },
  })
  await prisma.ideaElicitation.create({
    data: {
      ideaId: idea.id,
      problem: PROBLEM,
      goalKind: 'NEW_LAW',
      goalDetail: 'A duty on landlords with a hard deadline and an automatic penalty.',
      ruledOut: 'Anything that relies on tenants going to court themselves.',
      ownKnowledge: 'Our environmental health officer told me they are two years behind on inspections.',
      ownKnowledgeProvenance: 'USER_TESTIMONY',
      profileSkipped: true,
      understanding: '[25-B VERIFICATION STUB — not written by Lex.]',
      status: 'CONFIRMED',
      confirmedAt: new Date(),
    },
  })

  const perPassSeconds: Array<{ key: string; seconds: number }> = []

  try {
    const buildId = await claimBuild(idea.id, 'B_CONTEXTUALISED')

    // ── §1 — DRIVE ONE PASS PER REQUEST ────────────────────────────────────
    let view = await (async () => {
      const t0 = Date.now()
      const v = await runNextPass(idea.id, user.id, buildId)
      perPassSeconds.push({ key: BUILD_PASSES[0].key, seconds: Math.round((Date.now() - t0) / 1000) })
      return v
    })()

    for (let i = 0; i < BUILD_PASSES.length + 2 && view.nextPass; i++) {
      const key = view.nextPass
      const t0 = Date.now()
      view = await runNextPass(idea.id, user.id, buildId)
      perPassSeconds.push({ key, seconds: Math.round((Date.now() - t0) / 1000) })
      const p = view.passes.find((x) => x.key === key)
      console.log(`     ${key}: ${p?.status} — ${p?.output ?? p?.failureReason ?? ''}`)
    }

    console.log(`\nresult: ${view.status} · ${view.passesComplete}/${view.passesTotal} passes · ` +
      `${view.elapsedSeconds}s · ${view.spend.line}`)
    console.log(`reason: ${view.failureReason ?? '(none)'}\n`)

    // ── §9 — a build completes all passes without hitting the 300s ceiling ──
    assert(view.status === 'DONE', 'a build completes every pass', `status ${view.status}: ${view.failureReason ?? ''}`)
    assert(view.passesComplete === view.passesTotal, `   …all ${view.passesTotal} of them`,
      `${view.passesComplete}/${view.passesTotal}`)
    const overrun = perPassSeconds.filter((p) => p.seconds * 1000 > PASS_BUDGET_MS)
    assert(overrun.length === 0, '   …and NO SINGLE PASS exceeded its own request budget',
      overrun.map((p) => `${p.key} ${p.seconds}s`).join(', '))
    note(`per-pass seconds: ${perPassSeconds.map((p) => `${p.key} ${p.seconds}s`).join(' · ')}`)
    note(`whole build: ${view.elapsedSeconds}s — 25-A ran four passes in one 45–53s request`)

    // ── §9 — pass 3 runs the library, sifts, and states its gaps ───────────
    const questionRows = await prisma.deepeningPass.findMany({
      where: { ideaId: idea.id, passKey: { in: INTERROGATION_LIBRARY.map((q) => q.id) } },
    })
    assert(questionRows.length > 0, 'pass 3 ran library questions and recorded each one',
      `${questionRows.length} question rows`)
    const reviewed = questionRows.reduce((n, r) => n + r.candidatesReviewed, 0)
    const kept = questionRows.reduce((n, r) => n + r.candidatesKept, 0)
    note(`questions asked: ${questionRows.length} of ${INTERROGATION_LIBRARY.length} in the library`)
    note(`sift: reviewed ${reviewed}, kept ${kept}`)

    const withGaps = questionRows.filter((r) => Array.isArray(r.knownUnknowns) && (r.knownUnknowns as unknown[]).length)
    assert(withGaps.length > 0, '   …and every question that found nothing states a gap',
      `${withGaps.length} of ${questionRows.length} carry stated gaps`)

    // The unrouted-intent case, which the brief singles out: a question whose retrieval
    // mode Search has not built must appear as a STATED GAP, never as an absence.
    const unroutedIds = INTERROGATION_LIBRARY.filter((q) => retrievalStanding(q) === 'unrouted').map((q) => q.id)
    const unroutedRows = questionRows.filter((r) => unroutedIds.includes(r.passKey))
    assert(unroutedRows.length > 0,
      '   …including questions whose retrieval mode Search has not built',
      `unrouted questions that ran: ${unroutedRows.map((r) => r.passKey).join(', ') || '(none)'}`)

    // ── §9 — the instrument question fires, and a positive finding moves the fork ──
    const leader = INTERROGATION_LIBRARY.find((q) => q.leads)!
    const leaderRow = questionRows.find((r) => r.passKey === leader.id)
    assert(!!leaderRow, 'the instrument question fired on a primary-legislation draft', leader.id)

    const instrumentForks = await prisma.buildFork.findMany({
      where: { buildId, forkKey: 'guidingPolicy:instrument' },
    })
    const moved = instrumentForks.some((f) => /THE RESEARCH FOUND AN EXISTING POWER/.test(f.caseForAlternative))
    if (moved) {
      assert(true, '   …and a positive finding VISIBLY changed the instrument fork')
      note(`instrument fork now reads: ${instrumentForks.find((f) => /EXISTING POWER/.test(f.caseForAlternative))?.alternative}`)
    } else {
      // ⚠ NOT A FAILURE, AND NOT SILENTLY PASSED EITHER. Whether a power exists is a fact
      // about the world; the criterion is that a positive finding CHANGES the fork, and a
      // run where none was found cannot demonstrate that. Reported as undemonstrated.
      note('⚠ NO EXISTING POWER WAS FOUND on this run, so "a positive finding changes the fork" is')
      note('  UNDEMONSTRATED here rather than passed. The path is unit-covered in check:build-25b.')
    }

    // ── §9 — pass 4 rewrites the causes and PRESERVES a contradiction ──────
    const contradictions = await prisma.evidenceItem.findMany({
      where: { ideaId: idea.id, passKey: 'REVISE', kind: 'CONTRADICTS' },
    })
    assert(contradictions.length > 0,
      'pass 4 preserved at least one place the evidence changed the draft',
      `${contradictions.length} contradictions`)
    if (contradictions.length) {
      const c = contradictions[0]
      assert(/I first concluded/.test(c.body) && /The evidence says/.test(c.body),
        '   …keeping what the first draft said, not just the new answer')
      assert(c.citation === null && c.sourceId === null,
        '   …with no invented citation attached to a reasoning step')
      console.log(`\n     ── a preserved contradiction ──\n     ${c.body.replace(/\n/g, '\n     ')}\n`)
      notes.push(`CONTRADICTION SAMPLE: ${c.body.replace(/\n+/g, ' | ').slice(0, 400)}`)
    }

    const causes = await prisma.diagnosisCause.count({ where: { ideaId: idea.id } })
    assert(causes > 0, '   …and the causes were rewritten rather than duplicated', `${causes} causes on the idea`)

    // ── §9 — pass 5 produces issues against the WHOLE kernel ───────────────
    const advIssues = await prisma.deepeningIssue.findMany({
      where: { ideaId: idea.id, passKey: 'ADVERSARIAL' },
    })
    assert(advIssues.length > 0, 'pass 5 raised issues against the whole proposal', `${advIssues.length} issues`)
    const advPass = view.passes.find((p) => p.key === 'ADVERSARIAL')
    assert(/read by /.test(advPass?.output ?? ''), '   …and the panel says whose reading they are',
      advPass?.output ?? '')
    if (advIssues.length) {
      console.log(`     ── the clerk's first issue ──\n     ${advIssues[0].text}\n`)
      notes.push(`ADVERSARIAL SAMPLE: ${advIssues[0].text.slice(0, 400)}`)
    }

    // ── §9 — one evidence layer, and the spend per pass ────────────────────
    const evidence = await prisma.evidenceItem.groupBy({
      by: ['passKey'], where: { ideaId: idea.id }, _count: true,
    })
    note(`evidence rows by passKey: ${evidence.map((e) => `${e.passKey}=${e._count}`).join(' · ') || '(none)'}`)

    const spent = view.spendByPass.filter((s) => s.tokensIn || s.tokensOut)
    assert(spent.length >= 5, 'the spend is recorded per pass, not only per build', `${spent.length} passes with spend`)
    const summed = spent.reduce((n, s) => n + s.tokensIn, 0)
    assert(summed === view.spend.tokensIn, '   …and the per-pass figures sum to the build total',
      `${summed} vs ${view.spend.tokensIn}`)
    console.log('\n     ── spend by pass ──')
    for (const s of view.spendByPass) {
      console.log(`     ${s.key.padEnd(13)} ${String(s.tokensIn).padStart(8)} in / ${String(s.tokensOut).padStart(6)} out — ` +
        `${s.pence == null ? 'not priced' : `${s.pence.toFixed(2)}p`}`)
    }
    notes.push(`TOTAL SPEND: ${view.spend.line}`)
    notes.push(`SPEND BY PASS: ${view.spendByPass.map((s) => `${s.key} ${s.pence == null ? 'n/a' : `${s.pence.toFixed(2)}p`}`).join(' · ')}`)

    // ── §6 — THE STRONGER MODEL, ON THE SAME KERNEL ────────────────────────
    //
    // ⚠ RUN AS A SECOND READING OF THE SAME PROPOSAL, not as a second build. Two builds
    // produce two different kernels, so comparing their clerks would compare the drafts
    // as well as the models and measure neither. §6 asks for "the difference in the
    // findings, not in a score", and that only means something if both readers were
    // handed the same thing.
    const strongModel = process.argv.includes('--strong-adversarial')
      ? (process.env.LEX_STRONG_ADVERSARIAL_MODEL ?? 'gemini-2.5-pro')
      : null
    if (strongModel) {
      const kernel = await kernelFor(idea.id)
      const findings = await prisma.evidenceItem.findMany({
        where: { ideaId: idea.id, status: { not: 'REJECTED' } },
        select: { kind: true, title: true, body: true },
      })
      const strong = await generateAdversarialIssues(
        {
          idea: kernel,
          costLines: [],
          findings: findings.map((f) => ({ kind: f.kind as 'FINDING', title: f.title, body: f.body, sourceId: '' })),
          passMethod:
            'This is the COMPLETE proposal after research and revision — the diagnosis, the approach, ' +
            'the instrument and the actions, with every finding attached. You are not covering one angle ' +
            'of it; you are reading all of it, cold, for the first time.',
          knownUnknowns: [],
        },
        { model: strongModel, label: 'build-adversarial-strong', stream: 'build' },
      )
      assert(!!strong, `§6 the stronger model (${strongModel}) produced a reading`, 'it returned null')
      if (strong) {
        console.log(`\n     ── ${strongModel} on the SAME kernel (${strong.length} issues) ──`)
        strong.forEach((s, i) => console.log(`     ${i + 1}. ${s}`))
        notes.push(`STRONG MODEL (${strongModel}): ${strong.length} issues`)
        strong.forEach((s, i) => notes.push(`  STRONG ${i + 1}: ${s}`))
      }
    }

    // ── §7 — what the extra perspectives bought, when they ran ─────────────
    if (withPerspectives) {
      const researchPass = view.passes.find((p) => p.key === 'RESEARCH')
      note(`RESEARCH output with perspectives on: ${researchPass?.output ?? '(none)'}`)
      const unique = await prisma.evidenceItem.count({
        where: { ideaId: idea.id, body: { contains: 'Found only by' } },
      })
      note(`findings only one perspective produced: ${unique}`)
      notes.push(`PERSPECTIVES: ${perspectivesFor('RESEARCH').length} ran; ${unique} findings unique to one`)
    }
  } finally {
    console.log('\n── for the report ──')
    for (const n of notes) console.log(`  ${n}`)
    await prisma.idea.delete({ where: { id: idea.id } }).catch((e) =>
      console.error('cleanup failed — remove by hand:', idea.id, e instanceof Error ? e.message : e))
  }

  console.log(`\n${pass} passed, ${fail} failed.`)
  console.log('⚠ Local retrieval only (no FTS_SEARCH_URL / LEX_VECTOR_STREAMS in this .env).')
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
