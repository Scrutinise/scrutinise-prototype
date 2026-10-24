// ─────────────────────────────────────────────────────────────────────────────
// measure-26v2c — LEX 26-V2c: the MEASURED price of (1) Lex proposing heading kinds and (2) re-attaching open issues, on real data.
//
// Reads 452c5ade READ-ONLY (its headings, actions, documents and open issues) and WRITES NOTHING to it: both passes are called through
// their compose functions, which write nothing; the spend is recorded against a scratch copy, deleted after. It reads only columns that
// existed before 26-V2c, so it runs before or after the DDL.
// Usage:  npx tsx --env-file=.env scripts/measure-26v2c.ts [--kinds N] [--attach-batches N] [--out file.json]
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { partsOf, type DocumentKind } from '../lib/lex/action-documents-pure'
import { composeKindProposals, ACTIONS_PER_HEADING, type KindHeadingInput } from '../lib/lex/heading-kind'
import { composeAttachments, ATTACH_BATCH, type AttachContext } from '../lib/lex/issue-attach'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const arg = (k: string, d: number) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d }   // --kinds 0: attach only
const out = (() => { const i = process.argv.indexOf('--out'); return i > 0 ? process.argv[i + 1] : null })()
const KIND_RUNS = arg('--kinds', 2), BATCHES = arg('--attach-batches', 2)

async function main() {
  const src = await prisma.idea.findFirstOrThrow({ where: { id: { startsWith: '452c5ade' } }, select: { id: true } })
  const heads = await prisma.actionHeading.findMany({ where: { ideaId: src.id, archivedAt: null }, select: { id: true, name: true, purpose: true }, orderBy: { orderIndex: 'asc' } })
  const acts = await prisma.lexCoherentAction.findMany({ where: { ideaId: src.id, status: 'LIVE' }, select: { id: true, number: true, title: true, practicalStep: true, headingId: true }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }] })
  const kindIn: KindHeadingInput[] = heads.map((h, i) => {
    const mine = acts.filter((a) => a.headingId === h.id)
    return { n: i + 1, id: h.id, name: h.name, purpose: h.purpose, actions: mine.slice(0, ACTIONS_PER_HEADING).map((a) => `#${a.number ?? '?'} ${(a.title?.trim() || a.practicalStep).replace(/\s+/g, ' ').slice(0, 160)}`), more: Math.max(0, mine.length - ACTIONS_PER_HEADING) }
  })
  const docs = await prisma.actionDocument.findMany({ where: { ideaId: src.id, status: { not: 'SUPERSEDED' } }, include: { versions: { where: { role: 'VERSION' }, orderBy: { v: 'desc' }, take: 1 } } })
  const issues = await prisma.deepeningIssue.findMany({ where: { ideaId: src.id, status: 'OPEN' }, select: { id: true, title: true, text: true, passKey: true }, orderBy: { createdAt: 'asc' } })
  const numbered = acts.filter((a) => a.number != null)
  const headName = new Map(heads.map((h) => [h.id, h.name]))
  const num = new Map(numbered.map((a) => [a.id, a.number!]))
  const ctx: AttachContext = {
    actions: numbered.sort((a, b) => a.number! - b.number!).map((a) => ({ id: a.id, number: a.number!, title: a.title?.trim() || a.practicalStep, heading: a.headingId ? headName.get(a.headingId) ?? null : null, headingKind: null })),
    docs: docs.filter((d) => num.has(d.actionId)).map((d) => ({ id: d.id, actionId: d.actionId, action: num.get(d.actionId)!, number: d.number, kind: d.kind, title: d.title, parts: d.versions[0] ? partsOf(d.kind as DocumentKind, d.versions[0].body).map((p) => ({ n: p.n, title: p.title })) : [] })),
    issues: issues.map((i, k) => ({ key: `i${k + 1}`, id: i.id, title: i.title, text: i.text, passKey: i.passKey })),
  }
  console.log(`452c5ade: ${heads.length} headings, ${numbered.length} numbered live actions, ${ctx.docs.length} documents, ${issues.length} open issues`)

  const copy = await scratchCopy('452c5ade', 'measure-26v2c')
  const report: Record<string, unknown> = {}
  try {
    const kindRuns = []
    for (let r = 0; r < KIND_RUNS; r++) {
      const k = await composeKindProposals(src.id, kindIn, { userId: copy.userId, spendIdeaId: copy.id })
      if (!k.ok) { console.log('kinds FAILED', (k as { error: string }).error); continue }
      kindRuns.push({ pence: k.data.pence, seconds: k.data.seconds, proposals: k.data.proposals.map((p) => `${p.name} → ${p.kind}: ${p.reason}`), dropped: k.data.dropped })
      console.log(`kinds run ${r + 1}: ${k.data.pence?.toFixed(2)}p ${k.data.seconds}s\n  ${kindRuns.at(-1)!.proposals.join('\n  ')}`)
    }
    report.kinds = kindRuns
    const limit = Math.min(ctx.issues.length, BATCHES * ATTACH_BATCH)
    const a = await composeAttachments(ctx, { spendIdeaId: copy.id, userId: copy.userId, limit })
    if (!a.ok) console.log('attach FAILED', (a as { error: string }).error)
    else {
      const p = a.data.placements
      const tally = { DOCUMENT: p.filter((x) => x.place === 'DOCUMENT').length, ACTION: p.filter((x) => x.place === 'ACTION').length, PROPOSAL: p.filter((x) => x.place === 'PROPOSAL').length }
      const perIssue = a.data.pence != null ? a.data.pence / limit : null
      console.log(`attach: ${limit} issues in ${a.data.calls} calls, ${a.data.pence?.toFixed(2)}p (${perIssue?.toFixed(3)}p per issue → about ${perIssue != null ? (perIssue * ctx.issues.length).toFixed(1) : '?'}p for all ${ctx.issues.length}), ${a.data.seconds}s; placed ${JSON.stringify(tally)}; falls ${JSON.stringify(a.data.falls)}; failed batches ${a.data.failedBatches}`)
      const byId = new Map(ctx.issues.map((i) => [i.id, i]))
      const actNum = new Map(ctx.actions.map((x) => [x.id, x.number]))
      report.attach = {
        issues: limit, calls: a.data.calls, pence: a.data.pence, seconds: a.data.seconds, tally, falls: a.data.falls, failedBatches: a.data.failedBatches,
        sample: p.map((x) => ({ issue: `${byId.get(x.issueId)?.passKey} | ${byId.get(x.issueId)?.title ?? ''} | ${byId.get(x.issueId)?.text.slice(0, 160)}`, place: x.place, action: 'actionId' in x ? actNum.get(x.actionId) : null, doc: x.place === 'DOCUMENT' ? x.documentId : null, part: x.place === 'DOCUMENT' ? x.partN : null, reason: x.reason })),
      }
    }
  } finally {
    await deleteScratch(copy.id)
    await prisma.$disconnect()
  }
  if (out) {
    const file = existsSync(out) && statSync(out).isDirectory() ? join(out, 'measure-26v2c.json') : out
    writeFileSync(file, JSON.stringify(report, null, 1))
    console.log(`written: ${file}`)
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1 })
