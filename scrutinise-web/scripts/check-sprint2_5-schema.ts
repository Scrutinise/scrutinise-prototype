// Sprint 2.5 schema guard — proves the additive SQL actually landed on the APP DB
// (not just that `db execute` said "success"). Run: npx tsx --env-file=.env
// scripts/check-sprint2_5-schema.ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const EXPECTED_FEEDBACK_COLS = [
  'id', 'userId', 'ideaId', 'stage', 'surface', 'originalText', 'summarisedText',
  'userEdited', 'consentGiven', 'sentAt', 'sendError', 'createdAt',
]
const EXPECTED_DOC_COLS = [
  'docxUrl', 'pdfUrl', 'docxKey', 'pdfKey', 'generatedAt', 'sourceFingerprint',
  'sourceLabel', 'exportError',
]

async function main() {
  const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
  if (!url) throw new Error('DIRECT_URL/DATABASE_URL not set')
  console.log('host:', new URL(url).hostname)

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url, ssl: { rejectUnauthorized: false } }),
  } as never)

  const cols = async (table: string) =>
    (await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = ${table}
    `).map((r) => r.column_name)

  const feedback = await cols('FeedbackItem')
  const doc = await cols('Document')
  const enumVals = (await prisma.$queryRaw<{ enumlabel: string }[]>`
    SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'FeedbackSurface' ORDER BY e.enumsortorder
  `).map((r) => r.enumlabel)

  let fail = 0
  const check = (label: string, missing: string[]) => {
    if (missing.length) { console.error(`✗ ${label} missing: ${missing.join(', ')}`); fail++ }
    else console.log(`✓ ${label}`)
  }
  check('FeedbackItem columns', EXPECTED_FEEDBACK_COLS.filter((c) => !feedback.includes(c)))
  check('Document export columns', EXPECTED_DOC_COLS.filter((c) => !doc.includes(c)))
  check('FeedbackSurface enum', ['BRIEFING', 'CAUSES', 'OPTIONS', 'COSTS', 'OTHER'].filter((v) => !enumVals.includes(v)))

  // The client must be able to read the table, not merely see the columns.
  const n = await prisma.feedbackItem.count()
  console.log(`✓ FeedbackItem readable via Prisma client (${n} rows)`)

  await prisma.$disconnect()
  if (fail) process.exit(1)
  console.log('\nAll Sprint 2.5 schema checks passed.')
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1) })
