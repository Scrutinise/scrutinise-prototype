// ─────────────────────────────────────────────────────────────────────────────
// 25-M §5b — ONE LIVE BUILD, AND THE ASSERTION IS ON THE VALUE.
//
// ⚠⚠ THE WHOLE POINT IS THAT THE SCHEMA IS NOT THE ANSWER. `check:lex-25h` has asserted for
// three sprints that `nestByDrivenBy` exists and that `drivenBy` is in the schema. Both were
// true the entire time, and the output nested nothing — `""` satisfies `required`, which is
// how this stayed invisible. So this script reads `DiagnosisCause.parentCauseId` AFTER a real
// build and reports whether any cause actually sits beneath another.
//
// ⚠ THE BASELINE IS MEASURED, NOT ASSUMED. It prints the nesting on the idea BEFORE the run
// and the nesting AFTER, because "0 nested" is only evidence of a fix having worked if we
// know it was 0 before. A survey on 28 Aug found the database contains exactly ONE nested
// cause and it was created by a USER, by hand, on 14 August — no build has ever produced one.
//
// ⚠ CEILING: ONE BUILD, and it refuses to start a second in the same run. §5b says "one
// build"; more is spend beyond the brief.
//
// ⚠ IT IS A REUSE RUN BY DEFAULT. The prompt fix is in the drafting and revision passes, not
// in retrieval, so re-searching the corpus would spend three times as much to test something
// the search cannot affect. `--mode FULL` overrides.
//
// Usage:
//   tsx --env-file=.env scripts/verify-25m-driven-by.ts <ideaId> [--mode REUSE|FULL] [--dry]
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { claimBuild, runBuildToCompletion } from '../lib/lex/build'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name)
  return i >= 0 ? process.argv[i + 1] : undefined
}

/** What the causal chain looks like right now. The number that matters is `nested`. */
async function chainOf(ideaId: string) {
  const rows = await prisma.diagnosisCause.findMany({
    where: { ideaId },
    select: { id: true, cause: true, parentCauseId: true, source: true },
    orderBy: { createdAt: 'asc' },
  })
  return {
    total: rows.length,
    nested: rows.filter((r) => r.parentCauseId).length,
    fromBuild: rows.filter((r) => r.source === 'LEX_CORPUS').length,
    nestedFromBuild: rows.filter((r) => r.parentCauseId && r.source === 'LEX_CORPUS').length,
    rows,
  }
}

function print(label: string, c: Awaited<ReturnType<typeof chainOf>>) {
  console.log(`${label}: ${c.total} causes, ${c.nested} nested `
    + `(${c.fromBuild} from a build, ${c.nestedFromBuild} of those nested)`)
  for (const r of c.rows) {
    const parent = r.parentCauseId ? c.rows.find((x) => x.id === r.parentCauseId) : null
    console.log(`    ${parent ? '  └─ ' : ''}[${r.source}] ${r.cause.slice(0, 74)}`)
    if (parent) console.log(`         beneath: ${parent.cause.slice(0, 66)}`)
  }
}

async function main() {
  const ideaArg = process.argv[2]
  const dry = process.argv.includes('--dry')
  const mode = (arg('--mode') ?? 'REUSE') as 'REUSE' | 'FULL'
  if (!ideaArg || ideaArg.startsWith('--')) {
    console.error('usage: verify-25m-driven-by.ts <ideaId> [--mode REUSE|FULL] [--dry]')
    process.exitCode = 1
    return
  }

  const idea = await prisma.idea.findFirst({
    where: { id: { startsWith: ideaArg }, deletedAt: null },
    select: { id: true, title: true, creatorId: true },
  })
  if (!idea) { console.error(`no live idea starting ${ideaArg}`); process.exitCode = 1; return }

  console.log(`idea   : ${idea.id}  "${idea.title}"`)
  console.log(`mode   : ${mode}${dry ? '  (DRY — nothing will be built)' : ''}`)

  const before = await chainOf(idea.id)
  print('BEFORE ', before)

  // ⚠ THE WHOLE-DATABASE BASELINE, printed with the local one. "0 nested on this idea" is
  // much weaker evidence than "0 nested anywhere, ever, from any build".
  const everNested = await prisma.diagnosisCause.count({
    where: { parentCauseId: { not: null }, source: 'LEX_CORPUS' },
  })
  console.log(`\nnested causes produced by ANY build, in the whole database, before this run: ${everNested}`)

  if (dry) {
    console.log('\n--dry: stopping before any spend.')
    return
  }

  const started = Date.now()

  // ⚠⚠ RESUME AN ALREADY-CLAIMED BUILD RATHER THAN CLAIM A SECOND ONE.
  //
  // §5b authorises ONE build. The first attempt at this script crashed after `claimBuild`
  // had created the row and before a single pass ran — a wrong-arity call that no
  // typechecker could see, because `scripts/**` was excluded from the only TypeScript
  // program that existed. Claiming again would spend twice for one authorised run and leave
  // a RUNNING row behind for the settle to reap.
  //
  // ⚠ ONLY A BUILD THAT HAS RUN NOTHING. A row part-way through belongs to whoever is
  // driving it, and resuming that from here would double-drive it.
  const orphan = await prisma.ideaBuild.findFirst({
    where: { ideaId: idea.id, status: { in: ['QUEUED', 'RUNNING'] }, passesComplete: 0 },
    orderBy: { version: 'desc' },
    select: { id: true, version: true },
  })
  const buildId = orphan?.id ?? await claimBuild(idea.id, 'B_CONTEXTUALISED', false, mode)
  console.log(`\nbuild  : ${buildId} ${orphan ? `RESUMED (v${orphan.version}, claimed but never ran)` : 'claimed'}, running…`)
  await runBuildToCompletion(idea.id, idea.creatorId, buildId)

  const row = await prisma.ideaBuild.findUnique({
    where: { id: buildId },
    select: { version: true, status: true, passesComplete: true, estCostPence: true, failureReason: true },
  })
  const secs = Math.round((Date.now() - started) / 1000)
  console.log(`\nresult : v${row?.version} ${row?.status} `
    + `${row?.passesComplete} passes, ${row?.estCostPence ?? '?'}p, ${secs}s`)
  if (row?.failureReason) console.log(`         ${row.failureReason}`)

  const after = await chainOf(idea.id)
  console.log('')
  print('AFTER  ', after)

  // ══ THE ASSERTION, ON THE VALUE ═══════════════════════════════════════════
  //
  // ⚠ `nestedFromBuild`, NOT `nested`. The one nested cause already in the database was made
  // by a USER by hand; counting it would let this pass on somebody else's work.
  const ok = after.nestedFromBuild > 0
  console.log('')
  console.log(ok
    ? `✓ §5b — the causes NEST: ${after.nestedFromBuild} of ${after.fromBuild} build-written causes sit beneath another.`
    : `✗ §5b — the causes are still FLAT: 0 of ${after.fromBuild} build-written causes nest. `
      + 'The prompt fix reached the prompt and did not reach the output.')
  process.exitCode = ok ? 0 : 1
}

// ⚠⚠ A CRASH MUST NOT REPORT SUCCESS, AND THE FIRST VERSION OF THIS DID.
//
// `main().finally(...)` leaves a thrown error as an unhandled rejection: Node prints the
// stack and the process still exited 0, so the task reported "completed (exit code 0)" over
// a build that had died in its first pass. That is the silent-success class exactly — and it
// is worse in a verification script than anywhere else, because the whole job of this file is
// to be believed about whether something worked.
main()
  .catch((e) => {
    console.error('\n✗ the run FAILED before it could answer §5b:')
    console.error(e instanceof Error ? (e.stack ?? e.message) : String(e))
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
