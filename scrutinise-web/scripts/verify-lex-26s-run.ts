// 26-S — RUN THE IMPORT PASS FOR REAL on a scratch copy of 452c5ade with the hand-made blueprint filed as a numbered source,
// and print what came back and what it cost. SPENDS pence (Sonnet 5.5 chunks + structure, Gemini 2.5 Pro policy test).
//
//   npx tsx --env-file=.env scripts/verify-lex-26s-run.ts [--confirm] [--keep] [--out <file.json>]
//   LEX_IMPORT_CHUNK_WORDS=900 npx tsx --env-file=.env scripts/verify-lex-26s-run.ts     (force several chunks; default 2600)
//
// It deletes the scratch idea unless --keep. The ledger rows it wrote are summed for the idea BEFORE the delete.

import { writeFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import * as RN from '../lib/lex/research-notes'
import * as I from '../lib/lex/action-import'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'
import { buildBlueprint, FIXTURE_TITLE } from './fixtures/action-import-blueprint'

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : undefined }

async function main() {
  const doConfirm = process.argv.includes('--confirm')
  const keep = process.argv.includes('--keep')
  const out = arg('--out')
  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  if (!owner) throw new Error('owner not found')
  const copy = await scratchCopy('452c5ade', 's26')
  const id = copy.id
  console.log('scratch', id, 'chunk words', I.CHUNK_WORDS)
  try {
    const text = buildBlueprint()
    console.log('document words', text.split(/\s+/).length)
    const added = await RN.addNote(id, { id: owner.id }, { id: owner.id, isOwner: true }, {
      op: 'addNote', newSource: { kind: 'DOCUMENT', title: FIXTURE_TITLE, fullText: text, rightsConfirmed: true, readStatus: 'READ' },
    } as never, { readIntoFindings: false })
    if (!added.ok) throw new Error((added as { error: string }).error)
    const ref = (added as { data: { ref: number } }).data.ref
    console.log('filed as [Ref:', ref, ']')

    const t0 = Date.now()
    const started = await I.startImport(id, owner.id, ref)
    if (!started.ok) throw new Error((started as { error: string }).error)
    let view = started.data
    console.log('chunks', view.chunkCount)
    for (let i = 0; i < 60 && view.status === 'MAPPING'; i++) {
      const u0 = Date.now()
      const r = await I.advanceImport(id, owner.id, view.id)
      if (!r.ok) { console.log('ADVANCE FAILED:', (r as { error: string }).error); break }
      view = r.data
      console.log(`  advance ${i + 1}: stage=${view.mapping.stage} chunks ${view.chunksDone}/${view.chunkCount} items=${view.mapping.items.length} (${((Date.now() - u0) / 1000).toFixed(0)}s)`)
    }
    console.log('status', view.status, 'seconds', ((Date.now() - t0) / 1000).toFixed(0), 'spentPence', view.spentPence)
    const spend = await prisma.llmSpend.findMany({ where: { ideaId: id }, select: { pass: true, model: true, estCostPence: true, tokensIn: true, tokensOut: true, failed: true } })
    for (const s of spend) console.log(`    ledger ${s.pass} ${s.model} in=${s.tokensIn} out=${s.tokensOut} ${Number(s.estCostPence ?? 0).toFixed(2)}p${s.failed ? ' FAILED' : ''}`)
    console.log('ledger rows', spend.length, 'sum pence', spend.reduce((a, s) => a + Number(s.estCostPence ?? 0), 0).toFixed(2))
    const m = view.mapping
    const byKind: Record<string, number> = {}
    for (const it of m.items) byKind[it.proposal] = (byKind[it.proposal] ?? 0) + 1
    console.log('rows', m.items.length, JSON.stringify(byKind), 'uncovered', m.uncovered.length, 'headings', m.headings.map((h) => `${h.name}${h.isNew ? '*' : ''}`).join(' | '))
    if (out) writeFileSync(out, JSON.stringify(view, null, 2))

    if (doConfirm && view.status === 'READY') {
      const before = await prisma.lexCoherentAction.count({ where: { ideaId: id } })
      const c = await I.confirmImport(id, owner.id, view.id)
      console.log('CONFIRM', c.ok ? JSON.stringify((c as { data: unknown }).data).slice(0, 600) : (c as { error: string }).error)
      const after = await prisma.lexCoherentAction.count({ where: { ideaId: id } })
      console.log('actions before/after', before, after)
    }
  } finally {
    if (keep) console.log('KEPT scratch', id)
    else console.log('scratch deleted:', await deleteScratch(id))
    await prisma.$disconnect()
  }
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
