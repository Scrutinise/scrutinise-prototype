// measure:26ac-linking — ONE REAL RUN of the source-linking exercise on a scratch copy of a real idea (452c5ade by default; 452c5ade
// itself is never written), so its price can be stated as measured (lib/lex/scrutiny-linking-pure.ts LINK_RUNS), never guessed.
// It spends: one Sonnet 5.5 call, recorded on the spend ledger like any other. Prints the line to paste into LINK_RUNS.
//
//   npx tsx --tsconfig tsconfig.json --env-file=.env scripts/measure-26ac-linking.ts [ideaPrefix]
import { prisma } from '../lib/prisma'
import { scratchCopy, copyDocuments, deleteScratch } from './lib/scratch-copy'
import { createEdition, loadEdition } from '../lib/lex/scrutiny-edition'
import { linkingEstimate, runLinking } from '../lib/lex/scrutiny-linking'

;(async () => {
  const prefix = process.argv[2] ?? '452c5ade'
  const src = await prisma.idea.findFirst({ where: { id: { startsWith: prefix } }, select: { id: true } })
  if (!src) throw new Error(`no idea ${prefix}`)
  const s = await scratchCopy(prefix, 'measure-26ac-linking')
  try {
    console.log(`scratch ${s.id.slice(0, 8)}; ${await copyDocuments(src.id, s.id)} documents copied`)
    // the scratch copy carries no source registry: copy the source idea's filed sources onto the SCRATCH copy only, numbers kept, so the
    // run sees what the owner would (the source idea is only read)
    const filed = await prisma.ideaSource.findMany({ where: { ideaId: src.id, archivedAt: null, number: { not: null } } })
    const have = new Set((await prisma.ideaSource.findMany({ where: { ideaId: s.id }, select: { number: true } })).map((x) => x.number))
    const rows = filed.filter((f) => !have.has(f.number)).map(({ id: _id, ideaId: _i, createdAt: _c, updatedAt: _u, ...rest }) => ({ ...rest, ideaId: s.id }))
    if (rows.length) await prisma.ideaSource.createMany({ data: rows })
    console.log(`${rows.length} filed sources copied onto the scratch copy`)
    const c = await createEdition(s.id, s.userId)
    if (!c.ok) throw new Error((c as { error: string }).error)
    const id = (c as { data: { id: string } }).data.id
    const est = await linkingEstimate(s.id, id)
    if (!est.ok) throw new Error((est as { error: string }).error)
    const e = (est as { data: { sections: number; sources: number; words: number } }).data
    console.log(`would send ${e.words.toLocaleString('en-GB')} words: ${e.sections} sections, ${e.sources} filed sources`)
    const t0 = Date.now()
    const r = await runLinking(s.id, id, s.userId, 0, { measuring: true })
    if (!r.ok) throw new Error((r as { error: string }).error)
    const d = (r as { data: { proposed: number; dropped: string[]; unlinked: string[]; pence: number | null } }).data
    const links = (await loadEdition(id))!.links
    console.log(`proposed ${d.proposed} (read back: ${links.length}); dropped ${d.dropped.length}; ${d.unlinked.length} sections left unlinked; ${Math.round((Date.now() - t0) / 1000)} s`)
    for (const x of d.dropped.slice(0, 5)) console.log(`  dropped: ${x}`)
    for (const l of links.slice(0, 5)) console.log(`  ${l.targetKind} → [Ref: ${l.sourceNumber}] ${l.sourceTitle?.slice(0, 50)} — ${l.reason?.slice(0, 90)}`)
    console.log(`\nLINK_RUNS line:\n  { pence: ${d.pence}, words: ${e.words}, on: '${new Date().toISOString().slice(0, 10)}', what: 'one run on a scratch copy of ${prefix} (${e.sections} sections, ${e.sources} filed sources, ${d.proposed} links proposed), Sonnet 5.5, read off the spend ledger' },`)
  } finally {
    console.log(`scratch copy deleted: ${await deleteScratch(s.id)}`)
    await prisma.$disconnect()
  }
})().catch((e) => { console.error(e); process.exit(1) })
