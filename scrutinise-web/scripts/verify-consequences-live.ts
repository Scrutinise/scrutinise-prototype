// ─────────────────────────────────────────────────────────────────────────────
// Drive the CITATION_CONSEQUENCES job exactly as the deepening engine drives it.
//
// ⚠ THROUGH `runJob`, NOT BY CALLING THE BODY. S7 built two retrieval functions, tested
// them 31/31 and shipped with nothing calling them — "built-but-unwired is not 90% done; it
// is 0% delivered and it looks like 100%". Calling `runStatutoryConsequences` directly here
// would repeat that: it would prove the body works and nothing about the wiring.
//
// ⚠ AND IT RE-READS WHAT WAS WRITTEN. The JobOutcome's `written` is what the job intended;
// the EvidenceItem rows are what the database has.
//
// Usage:
//   tsx --env-file=.env scripts/verify-consequences-live.ts <ideaId> [--keep]
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../lib/prisma'
import { runJob } from '../lib/lex/deepening-jobs'

const PASS_KEY = 'STATUTORY_CONSEQUENCES'

async function main() {
  const ideaArg = process.argv[2]
  const keep = process.argv.includes('--keep')
  if (!ideaArg || ideaArg.startsWith('--')) {
    console.error('usage: verify-consequences-live.ts <ideaId> [--keep]')
    process.exitCode = 1
    return
  }
  const idea = await prisma.idea.findFirst({
    where: { id: { startsWith: ideaArg }, deletedAt: null },
    select: { id: true, title: true },
  })
  if (!idea) { console.error(`no live idea starting ${ideaArg}`); process.exitCode = 1; return }

  // Highest existing runVersion + 1, so this cannot collide with a real build's evidence.
  const top = await prisma.evidenceItem.aggregate({
    where: { ideaId: idea.id }, _max: { runVersion: true },
  })
  const runVersion = (top._max.runVersion ?? 0) + 1

  const linked = await prisma.ideaLegislation.findMany({
    where: { ideaId: idea.id },
    select: { legislationItem: { select: { legislationGovUkId: true, title: true } } },
  }).catch(() => [])
  console.log(`idea ${idea.id.slice(0, 8)} "${idea.title}"`)
  console.log(`linked instruments: ${linked.length ? linked.map((l) => l.legislationItem?.legislationGovUkId).join(', ') : 'NONE'}`)
  console.log(`writing at runVersion ${runVersion}\n`)

  const t0 = Date.now()
  const outcome = await runJob('CITATION_CONSEQUENCES', {
    ideaId: idea.id, passKey: PASS_KEY, runVersion, keywords: [], kept: [],
  })
  const ms = Date.now() - t0

  console.log('── the outcome the job reported ──')
  console.log(`  written      ${outcome.written}`)
  console.log(`  skipReason   ${outcome.skipReason ?? '—'}`)
  console.log(`  detail       ${outcome.detail}`)
  console.log(`  subjects     ${(outcome.subjects ?? []).join(', ') || '—'}`)
  console.log(`  took         ${ms} ms`)

  // ⚠ RE-READ. `written` is intent; these rows are fact.
  const rows = await prisma.evidenceItem.findMany({
    where: { ideaId: idea.id, passKey: PASS_KEY, runVersion },
    select: { title: true, body: true, citation: true, sourceType: true, url: true },
  })
  console.log(`\n── re-read: ${rows.length} EvidenceItem row(s) ──`)
  console.log(`  reconciles: ${rows.length === outcome.written ? '✓' : '✗ MISMATCH'}`)
  for (const r of rows) {
    console.log(`\n  · ${r.title}`)
    console.log(`    sourceType=${r.sourceType} citation=${r.citation ?? '—'}`)
    // ⚠ THE TWO PROPERTIES §3 AND §5 DEMAND, asserted on the STORED row rather than assumed:
    // the disposition must carry its source words, and the count must carry its coverage.
    const hasQuote = /“[^”]{40,}”/.test(r.body ?? '')
    const hasCoverage = /does not yet cover|Treat any number here/.test(r.body ?? '')
    console.log(`    carries a quotation: ${hasQuote ? '✓' : '✗'}   carries the coverage statement: ${hasCoverage ? '✓' : '✗'}`)
    console.log(`    ${(r.body ?? '').replace(/\s+/g, ' ').slice(0, 200)}…`)
  }

  const spend = await prisma.$queryRawUnsafe<Array<{ n: bigint; pence: number | null }>>(`
    SELECT COUNT(*)::bigint AS n, SUM("estCostPence")::float AS pence
    FROM "LlmSpend"
    WHERE "pass" = 'deepening.consequences' AND "ideaId" = $1
      AND "createdAt" > now() - interval '10 minutes'`, idea.id)
  console.log(`\n── ledger ──`)
  console.log(`  ${Number(spend[0]?.n ?? 0)} call(s), ${spend[0]?.pence ?? '—'}p`)

  if (!keep) {
    const del = await prisma.evidenceItem.deleteMany({
      where: { ideaId: idea.id, passKey: PASS_KEY, runVersion },
    })
    const left = await prisma.evidenceItem.count({
      where: { ideaId: idea.id, passKey: PASS_KEY, runVersion },
    })
    console.log(`\ncleaned up ${del.count}; re-read: ${left === 0 ? '✓ gone' : `✗ ${left} REMAIN`}`)
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
