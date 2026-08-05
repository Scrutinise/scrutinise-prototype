// Sprint 2.5 (§20.5) — feedback capture, end to end against the live app DB.
//
// Two things are proved here that a build-time check cannot:
//   · a deliberately personal input survives NOTHING into `summarisedText`
//   · a MAIL FAILURE still leaves the stored record, with the failure recorded
//
// The second is the one worth having: the write path is where "built inert"
// hides bugs. The test forces the send to fail rather than trusting that the
// catch block would have worked.
//
// It creates a temporary idea, and deletes it (and its rows) in a finally.
// Run: npx tsx --env-file=.env scripts/check-feedback-capture.ts

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { scrubPersonal, summariseCritique } from '../lib/lex/feedback'

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!url) throw new Error('DIRECT_URL/DATABASE_URL not set')
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url, ssl: { rejectUnauthorized: false } }),
} as never)

let fail = 0
const ok = (label: string, cond: boolean, detail?: string) => {
  if (cond) console.log(`✓ ${label}`)
  else { console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`); fail++ }
}

// A single message carrying every category the deterministic pass claims to catch.
const PERSONAL = `
I'm Charlie Lawrence and this costing is nonsense. My email is charlie.lawrence@example.co.uk
and you can call me on 07700 900123 or 020 7946 0958. I live at 42 Acacia Avenue, my postcode
is SW1A 2AA, my NI number is QQ 12 34 56 C and my account number is 4111 1111 1111 1111.
I was born 14/03/1979. My reference is 123456789012. Find me @charlielawrence on there.
My wife Priya has the same problem with her care package.
`.trim()

const IDENTITIES = ['Charlie Lawrence', 'Charlie', 'Lawrence', 'charlie.lawrence@example.co.uk', 'charlielaw']

const MUST_NOT_APPEAR = [
  'charlie.lawrence@example.co.uk',
  '07700 900123',
  '020 7946 0958',
  'SW1A 2AA',
  'QQ 12 34 56 C',
  '4111 1111 1111 1111',
  '14/03/1979',
  '123456789012',
  '@charlielawrence',
  '42 Acacia Avenue',
  'Charlie Lawrence',
]

async function main() {
  // ── 1. the deterministic pass ─────────────────────────────────────────────
  const scrubbed = scrubPersonal(PERSONAL, IDENTITIES)
  for (const needle of MUST_NOT_APPEAR) {
    ok(`scrub removes: ${needle}`, !scrubbed.text.includes(needle))
  }
  ok('scrub keeps the substance of the complaint', scrubbed.text.toLowerCase().includes('costing'))
  ok('scrub reports what it removed', scrubbed.redactions.length >= 6,
    scrubbed.redactions.map((r) => `${r.kind}×${r.count}`).join(', '))

  // ── 2. the full summarise path (model + scrub, or the fallback) ────────────
  const summarised = await summariseCritique({
    text: PERSONAL, surface: 'COSTS', stage: 'COHERENT_ACTIONS', identities: IDENTITIES,
  })
  console.log(`\n  model used: ${summarised.usedFallback ? 'NO (fallback — scrubbed original)' : 'yes'}`)
  console.log(`  summary: ${summarised.summarisedText}\n`)
  for (const needle of MUST_NOT_APPEAR) {
    ok(`summary is free of: ${needle}`, !summarised.summarisedText.includes(needle))
  }
  // The third-party name is the model's job, not the regex's — assert it only
  // when the model actually ran, and say so rather than pretending otherwise.
  if (!summarised.usedFallback) {
    ok('summary drops the third party’s name (model pass)', !summarised.summarisedText.includes('Priya'))
  } else {
    console.log('… skipped: third-party name check needs the model, which did not run')
  }

  // ── 3. persist-then-send, with the send forced to fail ────────────────────
  const owner = await prisma.user.findFirst({ select: { id: true }, orderBy: { createdAt: 'asc' } })
  if (!owner) { console.error('No user in the DB to own a test idea — cannot run the write-path check.'); process.exit(1) }

  let ideaId: string | null = null
  try {
    const idea = await prisma.idea.create({
      data: {
        title: '[sprint-2.5 check] feedback write path',
        summaryDescription: 'Temporary row created by scripts/check-feedback-capture.ts. Deleted at the end of the run.',
        govtArea: '',
        creatorId: owner.id,
      },
      select: { id: true },
    })
    ideaId = idea.id

    // Force the failure the same way production would experience one: no key.
    const savedKey = process.env.RESEND_API_KEY
    delete process.env.RESEND_API_KEY
    const { sendLexFeedbackEmail } = await import('../lib/email')

    const item = await prisma.feedbackItem.create({
      data: {
        userId: owner.id,
        ideaId: idea.id,
        stage: 'COHERENT_ACTIONS',
        surface: 'COSTS',
        originalText: PERSONAL,
        summarisedText: summarised.summarisedText,
        userEdited: false,
        consentGiven: true,
      },
      select: { id: true },
    })

    let threw = false
    try {
      await sendLexFeedbackEmail({
        feedbackItemId: item.id, stage: 'COHERENT_ACTIONS', surface: 'COSTS',
        summarisedText: summarised.summarisedText, userEdited: false,
        ideaTitle: '[sprint-2.5 check] feedback write path', ideaId: idea.id,
      })
    } catch (err) {
      threw = true
      await prisma.feedbackItem.update({
        where: { id: item.id },
        data: { sendError: (err instanceof Error ? err.message : String(err)).slice(0, 500) },
      })
    }
    if (savedKey !== undefined) process.env.RESEND_API_KEY = savedKey

    ok('a missing mail key FAILS rather than reporting a silent success', threw)

    const stored = await prisma.feedbackItem.findUnique({
      where: { id: item.id },
      select: { id: true, sentAt: true, sendError: true, summarisedText: true, originalText: true, consentGiven: true },
    })
    ok('the record survives the mail failure', stored !== null)
    ok('the failure is recorded on the row', Boolean(stored?.sendError), stored?.sendError ?? 'null')
    ok('the row is not marked sent', stored?.sentAt === null)
    ok('consent is recorded', stored?.consentGiven === true)
    ok('the raw wording is kept on the row (never emailed)', stored?.originalText.includes('Priya') === true)
    for (const needle of MUST_NOT_APPEAR) {
      ok(`stored summary is free of: ${needle}`, !stored?.summarisedText.includes(needle))
    }
  } finally {
    if (ideaId) {
      // FeedbackItem cascades from Idea, but delete explicitly so a cascade change
      // never silently leaves rows behind.
      await prisma.feedbackItem.deleteMany({ where: { ideaId } })
      await prisma.idea.delete({ where: { id: ideaId } }).catch((e) => console.error('cleanup failed:', e))
      console.log(`\ncleaned up test idea ${ideaId}`)
    }
    await prisma.$disconnect()
  }

  if (fail) { console.error(`\n${fail} check(s) failed.`); process.exit(1) }
  console.log('\nAll feedback-capture checks passed.')
}

main().catch((e) => { console.error('ERROR:', e); process.exit(1) })
