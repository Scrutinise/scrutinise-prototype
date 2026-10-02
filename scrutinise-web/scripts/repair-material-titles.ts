// 26-M follow-up — decode HTML entities already stored in the titles of the user's own sources.
//
//   npx tsx --env-file=.env scripts/repair-material-titles.ts            # DRY RUN: lists, writes nothing
//   npx tsx --env-file=.env scripts/repair-material-titles.ts --apply    # writes
//
// WHAT IT TOUCHES, AND ONLY THIS:
//   · IdeaUserMaterial.label            — the title the sources list shows
//   · EvidenceItem.citation / siftReason, for sourceType USER_DOCUMENT — both copy the label
// WHAT IT NEVER TOUCHES: IdeaUserMaterial.text (what we read, the thing quotes are verified against —
// rewriting it would silently change provenance) or the body/quote of any finding.
//
// Idempotent: a decoded string has no entities left to decode, so a second run changes nothing, and
// a dry run after an apply reports zero. Uses the very `decodeEntities` the extractor now uses.

import { prisma } from '../lib/prisma'
import { decodeEntities } from '../lib/lex/user-material'

const APPLY = process.argv.includes('--apply')
const HAS_ENTITY = /&(?:#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/i

function show(kind: string, before: string, after: string) {
  console.log(`  ${kind}: ${JSON.stringify(before.slice(0, 110))}\n      → ${JSON.stringify(after.slice(0, 110))}`)
}

async function main() {
  console.log(APPLY ? 'APPLY — writing.\n' : 'DRY RUN — nothing is written. Pass --apply to write.\n')

  const materials = await prisma.ideaUserMaterial.findMany({ select: { id: true, label: true } })
  let labels = 0
  for (const m of materials) {
    if (!HAS_ENTITY.test(m.label)) continue
    const next = decodeEntities(m.label)
    if (next === m.label) continue
    labels++
    show('label', m.label, next)
    if (APPLY) await prisma.ideaUserMaterial.update({ where: { id: m.id }, data: { label: next } })
  }

  const items = await prisma.evidenceItem.findMany({
    where: { sourceType: 'USER_DOCUMENT' }, select: { id: true, citation: true, siftReason: true },
  })
  let cites = 0
  for (const it of items) {
    const data: { citation?: string; siftReason?: string } = {}
    if (it.citation && HAS_ENTITY.test(it.citation) && decodeEntities(it.citation) !== it.citation) data.citation = decodeEntities(it.citation)
    if (it.siftReason && HAS_ENTITY.test(it.siftReason) && decodeEntities(it.siftReason) !== it.siftReason) data.siftReason = decodeEntities(it.siftReason)
    if (!data.citation && !data.siftReason) continue
    cites++
    if (data.citation) show('citation', it.citation!, data.citation)
    if (APPLY) await prisma.evidenceItem.update({ where: { id: it.id }, data })
  }

  console.log(`\n${materials.length} sources scanned, ${labels} label(s) ${APPLY ? 'rewritten' : 'to rewrite'}.`)
  console.log(`${items.length} user-document findings scanned, ${cites} ${APPLY ? 'rewritten' : 'to rewrite'}.`)
}

main().finally(() => prisma.$disconnect())
