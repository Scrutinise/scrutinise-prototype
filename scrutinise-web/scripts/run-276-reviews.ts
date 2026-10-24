// ─────────────────────────────────────────────────────────────────────────────
// run-276-reviews — CCh 276 (24 Oct (6)): the five review passes on 452c5ade's documents, WITHOUT asking, under two ceilings:
// £1.50 in total, and no one pass over 30p. Every spend is on the ledger (the review calls record their own LlmSpend rows).
//
// Before anything is spent, the run is priced from the MEASURED runs (REVIEW_RUNS) and refused if either ceiling would be crossed. While it
// runs, each document's real spend is added up per pass; the run stops before the next document if either ceiling has been reached.
// Counts before and after, per pass and per document. Plan by default; --run spends.
//   npx tsx --env-file=.env scripts/run-276-reviews.ts [--run] [--out file.json]
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import { PASSES } from '../lib/lex/deepening-config'
import { reviewTarget, reviewDocument, reviewPrice, type ReviewTarget } from '../lib/lex/document-review'
import { attachmentCounts, countsLine } from '../lib/lex/issue-attach'
import { dNumber } from '../lib/lex/action-documents-pure'

const RUN = process.argv.includes('--run')
const out = (() => { const i = process.argv.indexOf('--out'); return i > 0 ? process.argv[i + 1] : null })()
const TOTAL_CEILING = 150, PASS_CEILING = 30

async function counts(ideaId: string) {
  const [placed, byPass, byDoc, reviews] = await Promise.all([
    attachmentCounts(ideaId),
    prisma.deepeningIssue.groupBy({ by: ['passKey'], where: { ideaId, status: 'OPEN', reviewId: { not: null } }, _count: true }),
    prisma.deepeningIssue.groupBy({ by: ['documentId'], where: { ideaId, status: 'OPEN', documentId: { not: null } }, _count: true }),
    prisma.documentReview.count({ where: { ideaId } }),
  ])
  return { placed, line: countsLine(placed), reviewIssuesByPass: Object.fromEntries(byPass.map((g) => [g.passKey, g._count])), openByDocument: Object.fromEntries(byDoc.map((g) => [g.documentId, g._count])), reviewRows: reviews }
}

async function main() {
  const idea = await prisma.idea.findFirstOrThrow({ where: { id: { startsWith: '452c5ade' } }, select: { id: true, creatorId: true } })
  const docs = await prisma.actionDocument.findMany({ where: { ideaId: idea.id, status: { not: 'SUPERSEDED' } }, select: { id: true } })
  const targets: ReviewTarget[] = []
  const notReviewed: string[] = []
  for (const d of docs) { const t = await reviewTarget(idea.id, d.id); if ('error' in t) notReviewed.push(t.error); else targets.push(t.data) }

  // the price, before anything is spent
  const perPass: Record<string, number> = {}
  for (const t of targets) for (const p of PASSES) perPass[p.key] = (perPass[p.key] ?? 0) + (reviewPrice([p.key], t.body.length).pence ?? Infinity)
  const projected = Object.values(perPass).reduce((a, x) => a + x, 0)
  console.log(`452c5ade: ${docs.length} documents; ${targets.length} to review: ${targets.map((t) => `${dNumber(t.actionNumber, t.docNumber)} v${t.v} (${t.body.length} chars, ${t.parts.length} parts)`).join('; ') || 'none'}`)
  for (const n of notReviewed) console.log(`  not reviewed: ${n}`)
  console.log(`projected from the measured runs: ${projected.toFixed(2)}p in all (ceiling ${TOTAL_CEILING}p); per pass ${PASSES.map((p) => `${p.key} ${perPass[p.key]?.toFixed(2)}p`).join(', ')} (ceiling ${PASS_CEILING}p each)`)
  const over = PASSES.filter((p) => (perPass[p.key] ?? 0) > PASS_CEILING)
  if (projected > TOTAL_CEILING || over.length) { console.log(`STOP: the projection crosses a ceiling (${over.map((p) => p.key).join(', ') || 'the total'}). Nothing was spent.`); await prisma.$disconnect(); return }

  const before = await counts(idea.id)
  console.log(`BEFORE: ${before.line}; review rows ${before.reviewRows}; review issues by pass ${JSON.stringify(before.reviewIssuesByPass)}`)
  if (!RUN) { console.log('plan only (--run to spend)'); await prisma.$disconnect(); return }

  const spent: Record<string, number> = {}
  const log: Array<Record<string, unknown>> = []
  let stopped: string | null = null
  for (const t of targets) {
    const total = Object.values(spent).reduce((a, x) => a + x, 0)
    const passOver = PASSES.find((p) => (spent[p.key] ?? 0) >= PASS_CEILING)
    if (total >= TOTAL_CEILING || passOver) { stopped = `stopped before ${dNumber(t.actionNumber, t.docNumber)}: ${passOver ? `${passOver.key} has spent ${spent[passOver.key].toFixed(2)}p` : `${total.toFixed(2)}p spent in all`}`; break }
    const d = dNumber(t.actionNumber, t.docNumber)
    const r = await reviewDocument(idea.id, t.documentId, { userId: idea.creatorId })
    if ('error' in r) { console.log(`${d}: not reviewed — ${r.error}`); log.push({ d, error: r.error }); continue }
    for (const o of r.data.outcomes) spent[o.passKey] = (spent[o.passKey] ?? 0) + (o.pence ?? 0)
    console.log(`${d} v${r.data.v}: ${r.data.pence?.toFixed(2)}p\n  ${r.data.outcomes.map((o) => o.words).join('\n  ')}`)
    log.push({ d, v: r.data.v, pence: r.data.pence, outcomes: r.data.outcomes })
  }
  // the ledger's own account of the same spend, so the figure reported is the recorded one
  const ledger = await prisma.llmSpend.findMany({ where: { ideaId: idea.id, pass: 'documents.review' }, select: { estCostPence: true, createdAt: true } })
  const after = await counts(idea.id)
  const total = Object.values(spent).reduce((a, x) => a + x, 0)
  console.log(`\nAFTER: ${after.line}; review rows ${after.reviewRows}; review issues by pass ${JSON.stringify(after.reviewIssuesByPass)}`)
  console.log(`spent: ${total.toFixed(2)}p — per pass ${PASSES.map((p) => `${p.key} ${(spent[p.key] ?? 0).toFixed(2)}p`).join(', ')}`)
  console.log(`ledger (LlmSpend, pass documents.review, on 452c5ade, all time): ${ledger.length} rows, ${ledger.reduce((a, x) => a + Number(x.estCostPence ?? 0), 0).toFixed(2)}p`)
  if (stopped) console.log(`⚠ ${stopped}`)
  if (out) { writeFileSync(out, JSON.stringify({ before, after, spent, total, stopped, notReviewed, log }, null, 1)); console.log(`written: ${out}`) }
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
