/**
 * check-legislation-guide.ts — the check for the published legislation guide and its
 * expert-correction form.
 *
 * Three kinds of assertion:
 *
 *  1. CONTENT INTEGRITY. The guide is sourced from a research draft that carries
 *     `<cite index="45-1">` provenance markers. Those must never reach a public page —
 *     the FAQ renderer uses dangerouslySetInnerHTML, so a stray tag is stray markup on
 *     a live page. Also: section keys are stored on every suggestion, so they must be
 *     unique and must not silently disappear.
 *
 *  2. THE PROMISES THE PAGE MAKES. It says "draft", it asks for experts, no login is
 *     required, and an email address is. Each of those is a source assertion, because
 *     each is a thing a later edit could quietly remove.
 *
 *  3. A REAL WRITE AND A REAL SEND (--live). Built-inert is how the stats layer shipped
 *     six bugs in a tsc-clean build. `--live` writes one row to the app database
 *     through the real Prisma client, sends one real email, then DELETES the row. It
 *     puts one test message in cl@scrutinise.org's inbox — that is the point of it.
 *
 * Usage:
 *   npm run check:legislation-guide            # invariants only
 *   npm run check:legislation-guide -- --live  # + one real row and one real email
 */
import fs from 'fs'
import path from 'path'
import { prisma } from '../lib/prisma'
import { sendLegislationGuideSuggestionEmail } from '../lib/email'
import {
  GUIDE_SECTIONS, GUIDE_INTRO, GUIDE_STATUS, REVIEWER_QUESTIONS,
  SECTION_OPTIONS, GENERAL_SECTION_KEY, sectionLabel,
} from '../lib/reading-legislation-content'

let passed = 0
const failures: string[] = []

function ok(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`) }
  else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`) }
}
function section(title: string) { console.log(`\n${title}`) }

const root = path.join(__dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')
const live = process.argv.slice(2).includes('--live')

// ── 1. content integrity ─────────────────────────────────────────────────────
section('content integrity')
{
  const allText = [GUIDE_INTRO, GUIDE_STATUS, ...GUIDE_SECTIONS.map((s) => s.body), ...REVIEWER_QUESTIONS].join('\n')
  ok('no <cite> provenance markers survive into the published text', !/<cite\b/i.test(allText))
  ok('no stray HTML tags at all', !/<\/?[a-z][^>]*>/i.test(allText))
  ok('every section has a key, a number, a title and a body',
    GUIDE_SECTIONS.every((s) => !!s.key && !!s.number && !!s.title && s.body.trim().length > 50))
  ok('section keys are unique', new Set(GUIDE_SECTIONS.map((s) => s.key)).size === GUIDE_SECTIONS.length)
  ok('all eight sections of the source document are present', GUIDE_SECTIONS.length === 8,
    `found ${GUIDE_SECTIONS.length}`)
  ok('the six reviewer questions are present', REVIEWER_QUESTIONS.length === 6)

  // The keys are a STORED value. Renaming one orphans every suggestion filed against
  // it, and nothing at runtime would notice — so the list is pinned here.
  const PINNED = ['what-am-i-holding', 'anatomy', 'definitions', 'duty-and-power',
    'leverage', 'reading-sequence', 'ambiguity', 'traps']
  ok('section keys are unchanged (they are stored on every suggestion)',
    JSON.stringify(GUIDE_SECTIONS.map((s) => s.key)) === JSON.stringify(PINNED),
    GUIDE_SECTIONS.map((s) => s.key).join(','))
}

section('the section list the form and the API share')
{
  ok('the general option leads the list', SECTION_OPTIONS[0]?.key === GENERAL_SECTION_KEY)
  ok('every guide section is offered', GUIDE_SECTIONS.every((s) => SECTION_OPTIONS.some((o) => o.key === s.key)))
  ok('option keys are unique', new Set(SECTION_OPTIONS.map((o) => o.key)).size === SECTION_OPTIONS.length)
  ok('sectionLabel resolves a real key', !!sectionLabel('leverage'))
  ok('sectionLabel refuses an unknown key', sectionLabel('not-a-section') === null)
}

// ── 2. the promises the page makes ───────────────────────────────────────────
section('the page presents it as a draft, and asks for experts')
{
  const page = read('app/support/page.tsx')
  ok('the guide is a tab on the public support page', /'reading-legislation'/.test(page))
  ok('the draft banner is rendered', /Draft — published for correction/.test(page))
  ok('the expert button says what the brief asked it to say',
    /Are you a legislation expert\? Suggest an improvement/.test(page))
  ok('every section carries its own suggest link', /Suggest an improvement to §/.test(page))
  ok('the direct email route is offered as well', /cl@scrutinise\.org/.test(page))
}

section('no login required, but an email address is')
{
  const route = read('app/api/legislation-guide/suggestions/route.ts')
  const mw = read('middleware.ts')
  ok('the route does NOT require an authenticated user', !/getAuthenticatedUser|auth\(\)/.test(route))
  // The route sits under no protected prefix. If someone ever adds one, this fails.
  ok('middleware does not protect the suggestions route',
    !/'\/api\/legislation-guide/.test(mw.split('const isPublicRoute')[0]))
  ok('email is required by the schema', /email: z\.string\(\)\.trim\(\)\.email\(\)/.test(route))
  ok('credentials are optional', /credentials: z\.string\(\)[\s\S]{0,40}\.optional\(\)/.test(route))
  ok('the section is validated against the shared list', /z\.enum\(SECTION_OPTIONS\.map/.test(route))
  ok('rate limited by IP', /guide-suggest-ip:/.test(route))
  ok('rate limited by email as well', /guide-suggest-email:/.test(route))
  ok('the raw IP is never stored — only a hash', /createHash\('sha256'\)/.test(route) && !/ip,\s*$/m.test(route))
  // Compare CALL SITES, not first mentions — the sender's first mention is its import
  // at the top of the file, which made this assertion fail against correct code.
  ok('the record is written BEFORE the email is attempted',
    route.indexOf('legislationGuideSuggestion.create') < route.indexOf('await sendLegislationGuideSuggestionEmail('))
  ok('the send outcome is recorded on the row', /sentAt: new Date\(\)/.test(route) && /sendError:/.test(route))

  const email = read('lib/email.ts')
  const fn = email.slice(email.indexOf('export async function sendLegislationGuideSuggestionEmail'))
  ok('a missing RESEND_API_KEY throws rather than passing silently', /RESEND_API_KEY not set/.test(fn))
  ok('a suppressed admin address throws too', /suppression list/.test(fn))
  ok('user text is HTML-escaped into the email', /const esc = /.test(fn))
  ok('replies go to the expert, not to noreply', /replyTo: email/.test(fn))
}

// ── 3. a real write and a real send ──────────────────────────────────────────
async function liveTest() {
  section('live write + send')
  const marker = `CHECK-${process.pid}`
  let id: string | null = null
  try {
    const row = await prisma.legislationGuideSuggestion.create({
      data: {
        name: 'Automated check',
        email: 'cl@scrutinise.org',
        credentials: 'not a real submission',
        sectionKey: 'leverage',
        sectionTitle: sectionLabel('leverage')!,
        suggestion: `${marker} — this is check:legislation-guide proving the write path and the email path work end to end. The row is deleted immediately after this send.`,
      },
    })
    id = row.id
    ok('a row can be written through the real Prisma client', !!row.id)
    ok('the default status is NEW', row.status === 'NEW')
    ok('sentAt starts null (persist-then-send)', row.sentAt === null)

    let sendError: string | null = null
    try {
      await sendLegislationGuideSuggestionEmail({
        suggestionId: row.id,
        name: row.name,
        email: row.email,
        credentials: row.credentials,
        sectionTitle: row.sectionTitle,
        suggestion: row.suggestion,
      })
    } catch (err) {
      sendError = err instanceof Error ? err.message : String(err)
    }
    // A missing key locally is an ENVIRONMENT fact, not a defect — RESEND_API_KEY is
    // not in any local .env, so no email path in this codebase can be exercised from a
    // developer machine. Say so at the top of the output rather than turning it into a
    // red run that gets ignored; but if the key IS present and the send fails, that is
    // a real failure and it fails.
    if (!process.env.RESEND_API_KEY?.trim()) {
      console.log('  ! NOT VERIFIED — the email path could not be tested: RESEND_API_KEY is not set')
      console.log('    in this environment. It only exists in Vercel, so the send is verifiable in')
      console.log('    production only. The loud-throw design is what surfaced this at all.')
    } else {
      ok('the email actually sent', sendError === null, sendError ?? '')
      if (sendError === null) console.log('    → one real email is now in cl@scrutinise.org, subject "[Legislation guide] …"')
    }

    const readBack = await prisma.legislationGuideSuggestion.findUnique({ where: { id: row.id } })
    ok('the row reads back', readBack?.suggestion.includes(marker) === true)
  } finally {
    if (id) {
      await prisma.legislationGuideSuggestion.delete({ where: { id } }).catch(() => {})
      const gone = await prisma.legislationGuideSuggestion.findUnique({ where: { id } })
      ok('the test row was deleted again', gone === null)
    }
    await prisma.$disconnect()
  }
}

function report() {
  console.log(`\n${passed} passed, ${failures.length} failed`)
  if (failures.length) { failures.forEach((f) => console.error(`  FAILED: ${f}`)); process.exit(1) }
}

if (!live) {
  console.log('\n(no --live: skipping the real write and the real email)')
  report()
} else {
  liveTest().then(report, (err) => {
    console.error('\n  ✗ the live test threw:', err)
    process.exit(1)
  })
}
