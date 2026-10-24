// ─────────────────────────────────────────────────────────────────────────────
// measure-26v2d — LEX 26-V2d: the MEASURED price of each of the five review passes reading a real document.
//
// Reads 452c5ade's documents READ-ONLY (reviewTarget reads; composeReview writes nothing) and charges the spend to a scratch copy, deleted
// after. A document with no version is reported as not reviewable, in words. Sweeps scratch copies first (any left from a killed run).
// Usage:  npx tsx --env-file=.env scripts/measure-26v2d.ts [--runs N] [--out file.json]
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import { PASSES } from '../lib/lex/deepening-config'
import { reviewTarget, composeReview, reviewFallsWords, type ReviewTarget } from '../lib/lex/document-review'
import { dNumber } from '../lib/lex/action-documents-pure'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const argN = (k: string, d: number) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d }
const out = (() => { const i = process.argv.indexOf('--out'); return i > 0 ? process.argv[i + 1] : null })()
const RUNS = argN('--runs', 1)

async function main() {
  const live = await prisma.idea.findMany({ where: { isScratch: true, deletedAt: null }, select: { id: true, title: true, createdAt: true } })
  console.log(`scratch copies live before this run: ${live.length}${live.length ? ` (${live.map((x) => `${x.id.slice(0, 8)} ${x.createdAt.toISOString().slice(0, 16)}`).join(', ')})` : ''}`)
  for (const x of live) if (Date.now() - x.createdAt.getTime() > 30 * 60_000) { await deleteScratch(x.id); console.log(`  swept ${x.id.slice(0, 8)}`) }

  const src = await prisma.idea.findFirstOrThrow({ where: { id: { startsWith: '452c5ade' } }, select: { id: true } })
  const docs = await prisma.actionDocument.findMany({ where: { ideaId: src.id, status: { not: 'SUPERSEDED' } }, select: { id: true } })
  const targets: ReviewTarget[] = []
  for (const d of docs) {
    const t = await reviewTarget(src.id, d.id)
    if ('error' in t) console.log(`not reviewable: ${t.error}`)
    else targets.push(t.data)
  }
  console.log(`452c5ade: ${docs.length} documents, ${targets.length} reviewable: ${targets.map((t) => `${dNumber(t.actionNumber, t.docNumber)} v${t.v} (${t.body.length} chars, ${t.parts.length} parts)`).join('; ')}`)

  const copy = await scratchCopy('452c5ade', 'measure-26v2d')
  const report: Array<Record<string, unknown>> = []
  try {
    for (let run = 1; run <= RUNS; run++) {
      for (const t of targets) {
        const d = dNumber(t.actionNumber, t.docNumber)
        const results = await Promise.all(PASSES.map((p) => composeReview(t, p.key, { userId: copy.userId, spendIdeaId: copy.id }).then((r) => ({ p, r }))))
        for (const { p, r } of results) {
          if ('error' in r) { console.log(`run ${run} ${d} ${p.key}: FAILED ${r.error}`); report.push({ run, d, pass: p.key, failed: r.error }); continue }
          const x = r.data
          console.log(`run ${run} ${d} ${p.key}: ${x.pence?.toFixed(2)}p ${x.seconds}s, ${x.issues.length} issues${reviewFallsWords(x.falls).length ? ` [${reviewFallsWords(x.falls).join('; ')}]` : ''}`)
          for (const i of x.issues) console.log(`    ${i.partN ?? 'whole'} | ${i.title} | ${i.text.slice(0, 220)}`)
          console.log(`    held up: ${x.heldUp}`)
          report.push({ run, d, chars: t.body.length, parts: t.parts.length, pass: p.key, pence: x.pence, seconds: x.seconds, issues: x.issues, heldUp: x.heldUp, falls: x.falls })
        }
      }
    }
  } finally {
    await deleteScratch(copy.id)
    await prisma.$disconnect()
  }
  const perPass = PASSES.map((p) => { const rows = report.filter((r) => r.pass === p.key && typeof r.pence === 'number'); return `${p.key}: ${rows.reduce((a, r) => a + (r.pence as number), 0).toFixed(2)}p over ${rows.length} document reviews` })
  console.log(`\nper pass (all documents, all runs):\n  ${perPass.join('\n  ')}`)
  console.log(`total: ${report.reduce((a, r) => a + (typeof r.pence === 'number' ? (r.pence as number) : 0), 0).toFixed(2)}p`)
  if (out) { writeFileSync(out, JSON.stringify(report, null, 1)); console.log(`written: ${out}`) }
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
