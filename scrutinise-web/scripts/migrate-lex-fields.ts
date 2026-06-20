// ─────────────────────────────────────────────────────────────────────────────
// One-off migration (§9). Copies content from fields the Lex rebuild supersedes
// into the new `ideaContext` free narrative, each tagged [migrated: <field>], so
// nothing is lost as Page 1 takes over. There are three test users with no
// meaningful data, so there is NO deprecated-fields UI — this is the whole job.
//
// Idempotent: a field already present in ideaContext (by tag) is not re-copied.
//
// Run against Neon (the production app DB after the V26 cutover):
//   Dry run:  npx tsx scripts/migrate-lex-fields.ts
//   Apply:    npx tsx scripts/migrate-lex-fields.ts --apply
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL
if (!connectionString) {
  console.error('No NEON_DATABASE_URL or DATABASE_URL set.')
  process.exit(1)
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

const APPLY = process.argv.includes('--apply')

// Legacy idea fields that the Page 1 boxes supersede. govtArea / title are kept
// in the new model, so they are NOT migrated.
const LEGACY_FIELDS: { key: string; column: keyof MigratableIdea }[] = [
  { key: 'summaryDescription', column: 'summaryDescription' },
  { key: 'summaryDiagnosis', column: 'summaryDiagnosis' },
  { key: 'backgroundResearch', column: 'backgroundResearch' },
  { key: 'initialThoughts', column: 'initialThoughts' },
]

interface MigratableIdea {
  id: string
  ideaContext: string | null
  summaryDescription: string | null
  summaryDiagnosis: string | null
  backgroundResearch: string | null
  initialThoughts: unknown
}

function asText(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value.trim() || null
  try {
    const s = JSON.stringify(value)
    return s === '{}' || s === '[]' || s === 'null' ? null : s
  } catch {
    return null
  }
}

async function main() {
  const ideas = (await prisma.idea.findMany({
    select: {
      id: true,
      ideaContext: true,
      summaryDescription: true,
      summaryDiagnosis: true,
      backgroundResearch: true,
      initialThoughts: true,
    },
  })) as MigratableIdea[]

  let touched = 0
  for (const idea of ideas) {
    const existing = idea.ideaContext ?? ''
    const additions: string[] = []

    for (const f of LEGACY_FIELDS) {
      const tag = `[migrated: ${f.key}]`
      if (existing.includes(tag)) continue // already migrated
      const text = asText(idea[f.column])
      if (!text) continue
      additions.push(`${tag}\n${text}`)
    }

    if (!additions.length) continue
    touched++
    const next = [existing.trim(), ...additions].filter(Boolean).join('\n\n')
    console.log(`idea ${idea.id}: +${additions.length} field(s)${APPLY ? '' : ' (dry-run)'}`)
    if (APPLY) {
      await prisma.idea.update({ where: { id: idea.id }, data: { ideaContext: next } })
    }
  }

  console.log(`\n${APPLY ? 'Migrated' : 'Would migrate'} ${touched} idea(s) of ${ideas.length}.`)
  if (!APPLY && touched) console.log('Re-run with --apply to write.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
