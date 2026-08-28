// ─────────────────────────────────────────────────────────────────────────────
// 25-I §5 — the one live build the brief authorises, and everything it is for.
//
// ⚠⚠ CEILING: ONE BUILD. §5 says so explicitly, and more than one is spend beyond the
// brief. This script refuses to start a second one on the same idea in the same run, and
// prints the version it is about to create before it creates it.
//
// It reports four things §5 asks for:
//   1. whether §25.7's six qualities appear in the OUTPUT (25-H could only check the input)
//   2. the cost
//   3. the duration
//   4. ⚠ THE MEASURED REUSE SAVING — which since 25-G has been ARITHMETIC (141,926 of
//      217,687 tokens skipped) and not a figure. A prediction nobody scored is a guess.
//
// Usage:
//   tsx --env-file=.env scripts/measure-25i-build.ts <ideaId> [--mode REUSE|FULL]
//   tsx --env-file=.env scripts/measure-25i-build.ts <ideaId> --dry   (plan only, no spend)
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { claimBuild, runBuildToCompletion } from '../lib/lex/build'
import { reuseSourceFor } from '../lib/lex/build'
import { USER_MATERIAL_PASS_PREFIX } from '../lib/lex/heading-map'

/** The arithmetic 25-G left on the record, to be scored rather than repeated. */
const PREDICTED_SKIPPED = 141_926
const PREDICTED_TOTAL = 217_687

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const ideaArg = process.argv[2]
  const dry = process.argv.includes('--dry')
  const mode = (arg('--mode') ?? 'REUSE') as 'REUSE' | 'FULL'
  if (!ideaArg || ideaArg.startsWith('--')) {
    console.error('usage: measure-25i-build.ts <ideaId> [--mode REUSE|FULL] [--dry]')
    process.exitCode = 1
    return
  }

  const idea = await prisma.idea.findFirst({
    where: { id: { startsWith: ideaArg }, deletedAt: null },
    select: { id: true, title: true, creatorId: true },
  })
  if (!idea) { console.error(`no live idea starting ${ideaArg}`); process.exitCode = 1; return }

  const priorBuilds = await prisma.ideaBuild.findMany({
    where: { ideaId: idea.id },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, status: true, tokensIn: true, tokensOut: true, estCostPence: true },
  })
  const material = await prisma.evidenceItem.count({
    where: { ideaId: idea.id, passKey: { startsWith: USER_MATERIAL_PASS_PREFIX } },
  })

  console.log(`── 25-I §5 — ONE live build ──`)
  console.log(`idea      ${idea.id.slice(0, 8)} "${idea.title}"`)
  console.log(`prior     ${priorBuilds.length} build(s); next version would be v${(priorBuilds[0]?.version ?? 0) + 1}`)
  console.log(`material  ${material} findings from the user's own documents are on this idea`)
  for (const b of priorBuilds) {
    console.log(`  v${b.version} ${b.status.padEnd(9)} ${b.tokensIn ?? '-'} in / ${b.tokensOut ?? '-'} out · ${b.estCostPence ?? '-'}p`)
  }

  // What reuse would actually do, BEFORE spending anything.
  const source = await reuseSourceFor(idea.id)
  // ⚠ 25-M — `reuseSourceFor` HAS NEVER RETURNED A `reason`. This printed `undefined` through
  // every run since 25-I and nothing caught it, because `scripts/**` was excluded from the
  // only TypeScript program that existed. The shape is { id, version, passes }.
  console.log(`\nreuse source: ${source ? `v${source.version}` : 'NONE — a REUSE request would run FULL'}`)

  if (dry) { console.log('\n⚠ DRY — nothing started.'); return }

  // ⚠ A CLAIMED-BUT-UNRUN BUILD BLOCKS THE NEXT ONE. `claimBuild` throws
  // `BuildAlreadyRunning` while a QUEUED/RUNNING row exists, so a crash between claiming
  // and running (which is exactly what happened on the first attempt of this script, on a
  // wrong call signature) leaves v2 sitting QUEUED and the ceiling apparently spent. It
  // costs nothing — no pass ran — so it is settled rather than counted against the ceiling.
  const stranded = await prisma.ideaBuild.findFirst({
    where: { ideaId: idea.id, status: { in: ['QUEUED', 'RUNNING'] }, passesComplete: 0 },
    select: { id: true, version: true },
  })
  if (stranded) {
    await prisma.ideaBuild.update({
      where: { id: stranded.id },
      data: { status: 'CANCELLED', failureReason: 'Claimed but never started (harness crash); no pass ran, nothing spent.' },
    })
    console.log(`\n⚠ settled stranded v${stranded.version} (${stranded.id.slice(0, 8)}) — 0 passes, no spend.`)
  }

  const t0 = Date.now()
  const buildId = await claimBuild(idea.id, 'B_CONTEXTUALISED', false, mode)
  console.log(`\nstarted ${buildId.slice(0, 8)} in ${mode} mode; running to completion…\n`)
  await runBuildToCompletion(idea.id, idea.creatorId, buildId)
  const wall = (Date.now() - t0) / 1000

  // ── everything below is RE-READ from the database ─────────────────────────
  const b = await prisma.ideaBuild.findUnique({
    where: { id: buildId },
    select: {
      version: true, status: true, passesComplete: true, tokensIn: true, tokensOut: true,
      estCostPence: true, startedAt: true, completedAt: true, failureReason: true,
    },
  })
  if (!b) { console.log('✗ the build row vanished'); return }

  const dur = b.startedAt && b.completedAt
    ? (b.completedAt.getTime() - b.startedAt.getTime()) / 1000
    : wall

  console.log(`\n── result ──`)
  console.log(`  status        ${b.status}${b.failureReason ? ` (${b.failureReason})` : ''}`)
  console.log(`  passes        ${b.passesComplete} of 10`)
  console.log(`  duration      ${Math.floor(dur / 60)}m ${Math.round(dur % 60)}s   (wall ${Math.round(wall)}s)`)
  console.log(`  tokens        ${b.tokensIn?.toLocaleString()} in / ${b.tokensOut?.toLocaleString()} out`)
  console.log(`  cost          ${b.estCostPence ?? '-'}p`)

  // ── 2. THE MEASURED REUSE SAVING ──────────────────────────────────────────
  const baseline = priorBuilds.find((p) => p.status === 'DONE' && (p.tokensIn ?? 0) > 0)
  console.log(`\n── the reuse saving, measured rather than calculated ──`)
  if (mode !== 'REUSE' || !source) {
    console.log(`  not measurable from this run: mode=${mode}, reuse source ${source ? 'present' : 'absent'}`)
  } else if (!baseline) {
    console.log(`  no completed prior build with recorded tokens to compare against`)
  } else {
    const was = baseline.tokensIn ?? 0
    const now = b.tokensIn ?? 0
    const saved = was - now
    const pct = was ? Math.round((saved / was) * 100) : 0
    console.log(`  full build v${baseline.version}:  ${was.toLocaleString()} input tokens`)
    console.log(`  reuse build v${b.version}: ${now.toLocaleString()} input tokens`)
    console.log(`  MEASURED SAVING:      ${saved.toLocaleString()} tokens (${pct}%)`)
    console.log(`  25-G predicted:       ${PREDICTED_SKIPPED.toLocaleString()} of ${PREDICTED_TOTAL.toLocaleString()} ` +
      `(${Math.round((PREDICTED_SKIPPED / PREDICTED_TOTAL) * 100)}%)`)
    console.log(`  ⚠ the prediction was made against a ${PREDICTED_TOTAL.toLocaleString()}-token build; this baseline is ` +
      `${was.toLocaleString()}, so compare the PERCENTAGES, not the absolute figures.`)
  }

  // ── 3. THE SIX QUALITIES, IN THE OUTPUT ───────────────────────────────────
  const fields = await prisma.ideaFieldState.findMany({
    where: { ideaId: idea.id }, select: { fieldKey: true, value: true },
  })
  const text = fields.map((f) => f.value ?? '').join('\n\n')
  const nested = await prisma.diagnosisCause.count({ where: { ideaId: idea.id, parentCauseId: { not: null } } })
  const allCauses = await prisma.diagnosisCause.count({ where: { ideaId: idea.id } })
  const ev = await prisma.evidenceItem.findMany({
    where: { ideaId: idea.id, runVersion: b.version },
    select: { kind: true, body: true, citation: true, sourceType: true },
  })
  const contra = ev.filter((e) => e.kind === 'CONTRADICTS').length
  const subst = ev.filter((e) => (e.body ?? '').length > 120).length
  const userSourced = ev.filter((e) => e.sourceType === 'USER_DOCUMENT').length

  console.log(`\n── §25.7's six qualities, in the OUTPUT (25-H could only check the input) ──`)
  const six: Array<[string, boolean, string]> = [
    ['1 a causal chain, not an inventory', nested > 0, `${nested} of ${allCauses} causes nested`],
    ['2 a counterintuitive finding', contra > 0, `${contra} CONTRADICTS`],
    ['3 the finding, not the citation', subst > 0, `${subst} of ${ev.length} substantive`],
    ['4 reframes the instrument if wrong', /instead of|rather than a new Act|would not achieve|wrong instrument|existing power|non-legislative/i.test(text), ''],
    ['5 a test the user can apply', /you (could|can|would) (check|test|ask|know)|a test|how you would know/i.test(text), ''],
    ['6 the next action', /next step|the next thing|write to|table an|start by|ask the/i.test(text), ''],
  ]
  for (const [n, ok, note] of six) console.log(`  ${ok ? '✓' : '✗'} ${n}${note ? `  — ${note}` : ''}`)
  console.log(`\n  (${ev.length} evidence rows at v${b.version}; ${userSourced} of them from the user's own documents)`)
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
