// ─────────────────────────────────────────────────────────────────────────────
// 26-V2b §5 — the five kind templates, FOR REAL, on a scratch copy of 452c5ade (deleted after). Prints each document and its measured price,
// and the lines to paste into KIND_RUNS (lib/lex/document-drafting-pure.ts). Spends: one Sonnet 5.5 call per run (approved 24 Oct).
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/measure-26v2b-kinds.ts [out-file] [KIND,KIND]   (the second narrows the runs)
//
// ⚠ A scratch copy carries the actions and headings but not their cost lines or the idea's numbered sources, so those two are read from
// 452c5ade itself — READ ONLY — and put into the input. `composeKindDocument` writes nothing; the spend is recorded against the copy.
// ─────────────────────────────────────────────────────────────────────────────

import { writeFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import { composeKindDocument, kindInput, type TemplateKind } from '../lib/lex/document-drafting'
import { resolveRefs } from '../lib/lex/source-registry'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

const SOURCE = '452c5ade'
const out = process.argv[2] ?? null
const only = process.argv[3] ? new Set(process.argv[3].split(',')) : null

async function pickRuns(srcId: string): Promise<Array<{ n: number; kind: TemplateKind; why: string }>> {
  const acts = await prisma.lexCoherentAction.findMany({ where: { ideaId: srcId, status: 'LIVE' }, select: { number: true, avenue: true, commentary: true, headingId: true, _count: { select: { costLines: true } } } })
  const heads = new Map((await prisma.actionHeading.findMany({ where: { ideaId: srcId }, select: { id: true, name: true } })).map((h) => [h.id, h.name]))
  const by = (f: (a: (typeof acts)[number]) => boolean) => acts.filter(f).map((a) => a.number!).filter(Boolean)
  const refs = (a: (typeof acts)[number]) => /\[Ref:\s*\d+\]/.test(a.commentary ?? '')
  const detail = (a: (typeof acts)[number]) => (a.commentary ?? '').trim().length > 0
  const pick = (xs: number[], k: number) => xs.slice(0, k)
  const under = (name: string) => (a: (typeof acts)[number]) => heads.get(a.headingId ?? '') === name
  return [
    ...pick(by((a) => a.avenue === 'ORGANISATIONAL' && detail(a)), 1).map((n) => ({ n, kind: 'OPERATING_TEXT' as const, why: 'organisational, with an Explanation' })),
    ...pick(by((a) => a.avenue === 'ORGANISATIONAL' && !detail(a)), 1).map((n) => ({ n, kind: 'OPERATING_TEXT' as const, why: 'organisational, no Explanation' })),
    ...pick(by((a) => a._count.costLines > 0), 1).map((n) => ({ n, kind: 'COSTING' as const, why: 'has cost lines' })),
    ...pick(by((a) => a.avenue === 'FINANCIAL'), 1).map((n) => ({ n, kind: 'COSTING' as const, why: 'the financial action' })),
    ...pick(by((a) => a.avenue === 'ORGANISATIONAL' && detail(a)).slice(1), 1).map((n) => ({ n, kind: 'COSTING' as const, why: 'organisational, with an Explanation' })),
    ...pick(by((a) => under('CS Code')(a) && detail(a)), 1).map((n) => ({ n, kind: 'CODE_TEXT' as const, why: 'under CS Code, with an Explanation' })),
    ...pick(by((a) => under('CS Mgt Code')(a)), 1).map((n) => ({ n, kind: 'CODE_TEXT' as const, why: 'under CS Mgt Code' })),
    ...pick(by((a) => under('The platform')(a) && detail(a)), 1).map((n) => ({ n, kind: 'SPECIFICATION' as const, why: 'under The platform, with an Explanation' })),
    ...pick(by((a) => under('The platform')(a) && !detail(a)), 1).map((n) => ({ n, kind: 'SPECIFICATION' as const, why: 'under The platform, no Explanation' })),
    ...pick(by(refs), 2).map((n) => ({ n, kind: 'BACKGROUND_NOTE' as const, why: 'its Explanation cites sources' })),
  ]
}

async function main() {
  const src = await prisma.idea.findFirst({ where: { id: { startsWith: SOURCE } }, select: { id: true } })
  if (!src) throw new Error(`no idea ${SOURCE}`)
  const runs = (await pickRuns(src.id)).filter((r) => !only || only.has(r.kind))
  console.log('runs:', runs.map((r) => `${r.kind} #${r.n} (${r.why})`).join('; '))
  const copy = await scratchCopy(SOURCE, '26v2b-kinds')
  const done: Array<{ kind: TemplateKind; pence: number; seconds: number; label: string }> = []
  const log: string[] = []
  try {
    for (const r of runs) {
      const a = await prisma.lexCoherentAction.findFirst({ where: { ideaId: copy.id, number: r.n }, select: { id: true } })
      const s = await prisma.lexCoherentAction.findFirst({ where: { ideaId: src.id, number: r.n }, select: { commentary: true, costLines: { orderBy: { orderIndex: 'asc' } } } })
      if (!a || !s) { console.log(`#${r.n}: not on the copy`); continue }
      const input = await kindInput(copy.id, a.id)
      if (!input) { console.log(`#${r.n}: not live on the copy`); continue }
      // read only, from 452c5ade: its cost lines and the sources its Explanation cites
      input.costLines = s.costLines.map((c) => ({ label: c.label, low: c.low, high: c.high, unit: c.unit, basis: c.basis, priceYear: c.priceYear, recurrence: c.recurrence }))
      input.sources = (await resolveRefs(src.id, s.commentary ?? '')).found.filter((x) => !x.archived).map((x) => ({ number: x.number, title: x.title, citation: x.citation, snippet: x.snippet }))
      const res = await composeKindDocument(r.kind, input, { ideaId: copy.id, userId: copy.userId })
      const label = `${r.kind} #${r.n} — ${r.why}${r.kind === 'COSTING' ? `, ${input.costLines.length} cost lines` : ''}${r.kind === 'BACKGROUND_NOTE' ? `, ${input.sources.length} sources` : ''}`
      if (!res.ok) { console.log(`${label}: FAILED — ${'error' in res ? res.error : ''}`); log.push(`══ ${label}: FAILED`); continue }
      done.push({ kind: r.kind, pence: res.data.pence ?? NaN, seconds: res.data.seconds, label: `#${r.n}, ${r.why}` })
      const block = `\n══ ${label} — ${res.data.pence?.toFixed(2)}p, ${res.data.seconds}s\nreason: ${res.data.reason}\n${res.data.body}`
      log.push(block)
      console.log(`══ ${label} — ${res.data.pence?.toFixed(2)}p, ${res.data.seconds}s, ${res.data.body.length} chars`)
    }
    const good = done.filter((x) => Number.isFinite(x.pence))
    const paste = `\nPASTE into KIND_RUNS:\n${good.map((p) => `  ${p.kind}: { pence: ${p.pence.toFixed(2)}, seconds: ${p.seconds}, on: 'scratch copy of 452c5ade, ${new Date().toISOString().slice(0, 10)} (${p.label})' },`).join('\n')}`
    console.log(paste)
    if (out) writeFileSync(out, log.join('\n') + paste)
  } finally { await deleteScratch(copy.id); await prisma.$disconnect() }
}
main()
