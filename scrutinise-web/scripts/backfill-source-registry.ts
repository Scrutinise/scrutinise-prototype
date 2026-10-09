// 26-R — one registry row per distinct source, for every idea that already rests on any.
//
//   npx tsx --env-file=.env scripts/backfill-source-registry.ts            (DRY RUN — counts only, writes nothing)
//   npx tsx --env-file=.env scripts/backfill-source-registry.ts --apply
//
// Idempotent: a second --apply creates nothing (each key is unique per idea). Reports per idea and re-reads the registry by
// exact address afterwards — "N created" is the writer's claim; the count read back is the fact.

import { prisma } from '../lib/prisma'
import { syncRegistry, urlKey } from '../lib/lex/source-registry'

async function wouldCreate(ideaId: string): Promise<number> {
  const [existing, materials, decisions, evidence] = await Promise.all([
    prisma.ideaSource.findMany({ where: { ideaId }, select: { corpusKey: true, materialId: true } }),
    prisma.ideaUserMaterial.findMany({ where: { ideaId }, select: { id: true } }),
    prisma.ideaSourceDecision.findMany({ where: { ideaId }, select: { sourceKey: true } }),
    prisma.evidenceItem.findMany({ where: { ideaId, OR: [{ sourceId: { not: null } }, { url: { not: null } }] }, select: { sourceId: true, sourceType: true, url: true } }),
  ])
  const corpus = new Set(existing.map((e) => e.corpusKey).filter(Boolean) as string[])
  const mat = new Set(existing.map((e) => e.materialId).filter(Boolean) as string[])
  let n = 0
  for (const m of materials) if (!mat.has(m.id)) { mat.add(m.id); n++ }
  for (const d of decisions) if (!corpus.has(d.sourceKey)) { corpus.add(d.sourceKey); n++ }
  for (const e of evidence) {
    if (e.sourceType === 'USER_DOCUMENT') continue
    const key = e.sourceId ?? (e.url ? urlKey(e.url) : null)
    if (key && !corpus.has(key)) { corpus.add(key); n++ }
  }
  return n
}

async function main() {
  const apply = process.argv.includes('--apply')
  const ideas = await prisma.idea.findMany({ where: { deletedAt: null, NOT: { title: { startsWith: 'ZZ-scratch ' } } }, select: { id: true, title: true } })
  console.log(`${apply ? 'APPLY' : 'DRY RUN'} — ${ideas.length} ideas`)
  let total = 0, touched = 0
  for (const i of ideas) {
    const would = await wouldCreate(i.id)
    if (!apply) { if (would) { console.log(`  ${i.id.slice(0, 8)}  would create ${String(would).padStart(4)}  ${i.title.slice(0, 50)}`); touched++; total += would }; continue }
    if (!would) continue
    const r = await syncRegistry(i.id)
    const readBack = await prisma.ideaSource.count({ where: { ideaId: i.id } })
    console.log(`  ${i.id.slice(0, 8)}  created ${String(r.created).padStart(4)}  registry now ${String(readBack).padStart(4)}  ${i.title.slice(0, 50)}`)
    touched++; total += r.created
  }
  console.log(`${apply ? 'created' : 'would create'} ${total} rows across ${touched} ideas`)
  if (apply) {
    let second = 0
    for (const i of ideas) second += await wouldCreate(i.id)
    console.log(`second pass would create: ${second} (must be 0)`)
    const dupNumbers = await prisma.$queryRaw<Array<{ n: bigint }>>`SELECT COUNT(*) AS n FROM (SELECT "ideaId","number" FROM "IdeaSource" GROUP BY 1,2 HAVING COUNT(*) > 1) d`
    console.log(`duplicate (idea, number) pairs: ${Number(dupNumbers[0].n)} (must be 0)`)
  }
}
main().finally(() => prisma.$disconnect())
