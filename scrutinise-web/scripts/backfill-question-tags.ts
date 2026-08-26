/**
 * CENTRAL — give every Community its question-library tag set.
 *
 *   dry run :  tsx --env-file=.env scripts/backfill-question-tags.ts
 *   apply   :  tsx --env-file=.env scripts/backfill-question-tags.ts --apply
 *
 * ⚠ WHY THIS EXISTS. Every tag in every Community came from a migration —
 *   central_stage2b.sql seeded the contexts and six topics, 2d promoted five
 *   more, 2e added the departments — and each ran once, against the nodes that
 *   existed at the time. Community creation seeded `bulletinCategories` and
 *   nothing else, so anything created afterwards had no tag set at all.
 *
 *   For a new BRANCH that was survivable, because the library reads its ROOT's
 *   tags. For a new top-level COMMUNITY it was not: empty chip row, empty topic
 *   dropdown, and every row of a bulk upload failing with "… is not a context
 *   in this Community. Use one of:" followed by an empty list.
 *
 *   Creation now seeds them (lib/community.ts `seedQuestionTags`). This is the
 *   catch-up for whatever was created in between. Idempotent — re-running adds
 *   nothing.
 */
import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import { DEFAULT_QUESTION_TAGS, seedQuestionTags } from '@/lib/community'

const APPLY = process.argv.includes('--apply')

async function main() {
  console.log(`\nCENTRAL question-tag backfill — ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  console.log('host:', new URL(process.env.DATABASE_URL!).hostname)
  console.log(`starter set: ${DEFAULT_QUESTION_TAGS.length} tags ` +
    `(${DEFAULT_QUESTION_TAGS.filter((t) => t.kind.startsWith('CONTEXT')).length} contexts, ` +
    `${DEFAULT_QUESTION_TAGS.filter((t) => t.kind === 'TOPIC').length} topics)`)

  const nodes = await prisma.community.findMany({
    select: { id: true, name: true, parentCommunityId: true },
    orderBy: { createdAt: 'asc' },
  })

  let touched = 0
  for (const n of nodes) {
    const have = await prisma.questionTag.findMany({
      where: { communityId: n.id },
      select: { kind: true, label: true },
    })
    const present = new Set(have.map((t) => `${t.kind} ${t.label}`))
    const missing = DEFAULT_QUESTION_TAGS.filter((t) => !present.has(`${t.kind} ${t.label}`))
    const kind = n.parentCommunityId ? 'branch' : 'root'

    if (!missing.length) {
      console.log(`  · ${n.name} (${kind}) — complete, ${have.length} tags`)
      continue
    }
    console.log(`  ${APPLY ? '✓' : '→'} ${n.name} (${kind}) — has ${have.length}, ${missing.length} missing`)
    for (const m of missing.slice(0, 4)) console.log(`      ${m.kind} ${m.label}`)
    if (missing.length > 4) console.log(`      …and ${missing.length - 4} more`)
    if (APPLY) {
      const added = await seedQuestionTags(n.id)
      console.log(`      added ${added}`)
    }
    touched++
  }

  console.log(`\n${APPLY ? 'seeded' : 'would seed'}: ${touched} node(s)`)
  if (!APPLY) console.log('\nDRY RUN — pass --apply to write.')

  await prisma.$disconnect()
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
