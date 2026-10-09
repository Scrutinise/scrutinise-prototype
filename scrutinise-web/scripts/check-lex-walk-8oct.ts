// ─────────────────────────────────────────────────────────────────────────────
// Charlie's walkthrough, 8 Oct 2026 — items 1–3.
//
//   npx tsx --require ./scripts/lib/stub-auth.cjs --env-file=.env scripts/check-lex-walk-8oct.ts
//   (npm run check:lex-walk-8oct)
//
//   2. a rejected request names the input and the reason — proved THROUGH THE REAL ROUTE on a scratch copy of 452c5ade, with the
//      body the old bulk bar actually sent, and with the body it sends now (§25/§26: perform the operation, read it back).
//   3. a new action goes LAST on every path — a scratch idea given the same gappy indices Charlie's has, then every creator.
//   1. the Policy tab — a source assertion (it IS a property of source: which fields the component filters), plus its control.
//
// Counts what RAN (§23.2). Every value assertion has a control that must stay false (§23/§25.5).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { describeIssues, explainFailure } from '../lib/api-rejection'
import { ActionStructureBody, OP_WORDS, INPUT_WORDS } from '../lib/lex/action-structure-schema'
import { addAction, createActions } from '../lib/lex/field-machine'
import { computeCanonicalState } from '../lib/lex/state'
import { scratchCopy, deleteScratch } from './lib/scratch-copy'

let pass = 0, fail = 0, ran = 0, controls = 0, dead = 0
function ok(name: string, cond: boolean, detail = '') {
  ran++
  if (cond) { pass++; console.log(`  ✓ ${name}`) } else { fail++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`) }
}
function control(name: string, propertyHolds: boolean) {
  controls++
  if (propertyHolds) { dead++; console.log(`  ✗ DEAD CONTROL — ${name}`) } else console.log(`  · control fired — ${name}`)
}
const section = (s: string) => console.log(`\n── ${s} ──`)
const BARE = /not valid|invalid request|bad request/i
/** Key-order-independent JSON (jsonb stores keys in its own order, so a string comparison would measure the database, not the report). */
const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))

function walk(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f === '.next') continue
    const p = join(dir, f)
    statSync(p).isDirectory() ? walk(p, out) : /\.(ts|tsx)$/.test(f) && out.push(p)
  }
  return out
}

function partA() {
  section('A · item 2 — the wording (pure)')
  const old = ActionStructureBody.safeParse({ op: 'assignHeading', ids: ['x', 'y'], headingId: 'h1' })
  ok('the OLD bulk-bar body is rejected by the schema', !old.success)
  if (!old.success) {
    const { message, rejected } = describeIssues(old.error.issues, { action: OP_WORDS.assignHeading, labels: INPUT_WORDS })
    console.log(`    → ${message}`)
    ok('the sentence names the control the user pressed', message.includes('“Assign to heading”'))
    ok('…names the INPUT that was rejected, by its key and in the user\'s words', message.includes('“actionIds”') && message.includes('the selected actions'), message)
    ok('…says WHY, in words (it was missing)', /was missing/.test(message), message)
    ok('…says nothing was changed', /Nothing was changed/.test(message))
    ok('…and is never the bare sentence', !BARE.test(message))
    ok('the structured form carries the same facts', rejected.some((r) => r.field === 'actionIds' && /missing/.test(r.reason)))
    control('the old fixed sentence would pass the "names the input" test (must be FALSE)', 'That request was not valid.'.includes('actionIds'))
  }
  const tooLong = ActionStructureBody.safeParse({ op: 'ruleOut', ids: ['a'], reason: 'x'.repeat(601) })
  if (!tooLong.success) {
    const m = describeIssues(tooLong.error.issues, { action: OP_WORDS.ruleOut, labels: INPUT_WORDS }).message
    ok('an over-long reason says which input and the limit', m.includes('“reason”') && /600 characters/.test(m), m)
  } else ok('an over-long reason is rejected', false)
  const unknownOp = ActionStructureBody.safeParse({ op: 'frobnicate' })
  ok('an unknown control is worded, not bare', !unknownOp.success && !BARE.test(describeIssues((unknownOp as { error: { issues: never[] } }).error.issues, { action: 'That action', labels: INPUT_WORDS }).message))

  const flat = explainFailure({ error: { formErrors: [], fieldErrors: { actionIds: ['Invalid input: expected array, received undefined'] } } }, 422, '“Assign to heading”')
  ok('an OLD-shape flatten() body is still worded by the client', flat.includes('“actionIds”') && !BARE.test(flat), flat)
  const mute = explainFailure({}, 500, '“Rule out”')
  ok('a body with no reason at all still names the control and the status', mute.includes('“Rule out”') && mute.includes('500') && !BARE.test(mute), mute)
  control('a fixed "not valid" sentence passes the worded-failure test (must be FALSE)', !BARE.test('That request was not valid.'))
}

async function partB() {
  section('B · item 2 — through the REAL route, on a scratch copy of Charlie\'s idea (the bulk body he sent, then the body sent now)')
  const probe = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = probe
  const copy = await scratchCopy('452c5ade', 'walk8')
  const id = copy.id
  type J = { ok: boolean; error: string | null; rejected?: Array<{ field: string }>; state?: { actions: Array<{ id: string; number: number | null; headingId: string | null }>; actionHeadings?: Array<{ id: string; name: string }> } }
  const call = async (body: Record<string, unknown>) => {
    const { POST } = await import('../app/api/ideas/[id]/action-structure/route')
    const res = await POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
    return { status: res.status, json: (await res.json()) as J }
  }
  try {
    const made = await call({ op: 'createHeading', name: 'Walk8 heading' })
    ok('a heading is created through the route', made.status === 200 && made.json.ok, made.json.error ?? '')
    const live = await prisma.lexCoherentAction.findMany({ where: { ideaId: id, status: 'LIVE' }, orderBy: { number: 'asc' }, select: { id: true, number: true }, take: 2 })
    const heading = await prisma.actionHeading.findFirst({ where: { ideaId: id, name: 'Walk8 heading' }, select: { id: true } })
    ok('the copy has two actions and the just-created heading to assign them to', live.length === 2 && !!heading)
    if (live.length < 2 || !heading) return

    const oldShape = await call({ op: 'assignHeading', ids: live.map((r) => r.id), headingId: heading.id })
    ok('the body the bulk bar USED to send is refused (422)', oldShape.status === 422 && !oldShape.json.ok)
    ok('…and the user is told which input and why, in words', !!oldShape.json.error && oldShape.json.error.includes('“actionIds”') && /missing/.test(oldShape.json.error) && !BARE.test(oldShape.json.error), oldShape.json.error ?? '(no error)')
    ok('…and nothing was assigned', (await prisma.lexCoherentAction.count({ where: { id: { in: live.map((r) => r.id) }, headingId: heading.id } })) === 0)

    const newShape = await call({ op: 'assignHeading', actionIds: live.map((r) => r.id), headingId: heading.id })
    ok('the body it sends NOW is accepted', newShape.status === 200 && newShape.json.ok, newShape.json.error ?? '')
    const after = await prisma.lexCoherentAction.findMany({ where: { id: { in: live.map((r) => r.id) } }, select: { headingId: true } })
    ok('…and both actions carry the new heading when read back', after.every((r) => r.headingId === heading.id))
    const st = await computeCanonicalState(id)
    ok('…and the screen\'s own state agrees', !!st && st.actions.filter((a) => live.some((l) => l.id === a.id)).every((a) => a.headingId === heading.id))
    control('the read-back would also pass if the actions were still unassigned (must be FALSE)', after.every((r) => r.headingId === null))

    const longReason = await call({ op: 'ruleOut', ids: [live[0].id], reason: 'x'.repeat(700) })
    ok('an over-long reason: 422 that names “reason” and the limit', longReason.status === 422 && !!longReason.json.error && longReason.json.error.includes('“reason”') && /600/.test(longReason.json.error), longReason.json.error ?? '')
    const junk = await call({ op: 'assignHeading', actionIds: [], headingId: null })
    ok('an empty selection says it was empty', junk.status === 422 && /empty/.test(junk.json.error ?? ''), junk.json.error ?? '')
  } finally {
    await deleteScratch(id)
  }
}

async function partC() {
  section('C · item 3 — a new action goes LAST on every path (a scratch idea with Charlie\'s gappy indices)')
  const copy = await scratchCopy('452c5ade', 'walk8-order')
  const id = copy.id
  try {
    // Reproduce the defect's precondition: a live row sitting far above count(rows).
    const rows = await prisma.lexCoherentAction.findMany({ where: { ideaId: id }, orderBy: { number: 'desc' }, take: 1 })
    await prisma.lexCoherentAction.update({ where: { id: rows[0].id }, data: { orderIndex: 90 } })
    const total = await prisma.lexCoherentAction.count({ where: { ideaId: id } })
    ok('the precondition holds: the highest index is far above the row count', total < 90, `${total} rows, top index 90`)

    const a = await addAction(id, { practicalStep: 'Walk8 single add', source: 'LEX' })
    await createActions(id, [{ practicalStep: 'Walk8 batch one' }, { practicalStep: 'Walk8 batch two' }], 'LEX')
    const b = await prisma.lexCoherentAction.findMany({ where: { ideaId: id, practicalStep: { startsWith: 'Walk8 batch' } }, orderBy: { orderIndex: 'asc' }, select: { orderIndex: true } })
    ok('addAction lands above the previous top', a.orderIndex === 91, `got ${a.orderIndex}`)
    ok('createActions (the build\'s path) lands above it, in the order given', b.length === 2 && b[0].orderIndex === 92 && b[1].orderIndex === 93, b.map((x) => x.orderIndex).join(','))
    const st = await computeCanonicalState(id)
    const tail = st!.actions.slice(-3).map((x) => x.practicalStep)
    ok('read back through the screen\'s own state: the three new actions are the LAST three, in order', tail[0] === 'Walk8 single add' && tail[1] === 'Walk8 batch one' && tail[2] === 'Walk8 batch two', tail.join(' | '))
    control('the OLD rule (count of rows) would also have put it last (must be FALSE)', total >= 90)
  } finally {
    await deleteScratch(id)
  }

  section('C · item 3 — every creation path sets an order index (source: it is a property of the creators)')
  const lib = walk(join(__dirname, '..', 'lib', 'lex'))
  const offenders: string[] = []
  const creators: string[] = []
  const sweep = (name: string, src: string) => {
    const re = /lexCoherentAction\.create(?:Many)?\(\s*\{\s*data:\s*([\s\S]{0,900}?)\n?\s*\}\s*\)/g
    let m: RegExpExecArray | null
    const bad: string[] = []
    while ((m = re.exec(src))) {
      creators.push(name)
      if (!/orderIndex/.test(m[1])) bad.push(`${name}: ${m[1].slice(0, 70).replace(/\s+/g, ' ')}`)
    }
    return bad
  }
  for (const f of lib) {
    // a MERGE takes its parents' position on purpose (see nextActionOrderIndex) — and says orderIndex, so it passes too.
    offenders.push(...sweep(f.split(/[\\/]/).slice(-1)[0], readFileSync(f, 'utf8')))
  }
  const brokenSweep = sweep('(planted)', 'await prisma.lexCoherentAction.create({ data: { ideaId, practicalStep: "x", source: "LEX" } })')
  creators.pop()
  ok(`there are creators to check (${creators.length})`, creators.length >= 5, creators.join(', '))
  ok('every lexCoherentAction.create / createMany in lib/lex sets orderIndex', offenders.length === 0, offenders.join('\n      '))
  const gps = readFileSync(join(__dirname, '..', 'lib', 'lex', 'guiding-policy-state.ts'), 'utf8')
  ok('the three guiding-policy paths use the shared helper, not a count', (gps.match(/nextActionOrderIndex\(id\)/g) ?? []).length === 3)
  const fm = readFileSync(join(__dirname, '..', 'lib', 'lex', 'field-machine.ts'), 'utf8')
  ok('no creator takes its base from count(rows) any more', !/base = await prisma\.lexCoherentAction\.count/.test(fm))
  control('a planted creator with no orderIndex slips past the sweep (must be FALSE)', brokenSweep.length === 0)
}

function partD() {
  section('D · item 1 — the Policy tab, once a policy is settled (source: which fields the component filters)')
  const src = readFileSync(join(__dirname, '..', 'app', 'ideas', '[id]', 'IdeaDetailClient.tsx'), 'utf8')
  ok('"Candidate approaches" (policyOptions) is filtered out once the Guiding Policy field is ACCEPTED', /policySettled[\s\S]{0,400}f\.key !== 'policyOptions'/.test(src) && /f\.key === 'chosenApproach' && f\.status === 'ACCEPTED'/.test(src))
  ok('the summary is drawn in its own bordered box', /summaryGuidingPolicy' && policySettled[\s\S]{0,300}border-2/.test(src))
  ok('the component is reached: the Policy tab renders CanonicalPageBlock for GUIDING_POLICY', /subTab === 'policy'[\s\S]{0,200}pageByKey\('GUIDING_POLICY'\)/.test(src))
  control('a component that did not filter would pass (must be FALSE)', /policySettled/.test(src.replace(/policySettled/g, 'x')))
}

async function partE() {
  section('E · item 4 — bug reports: verbatim technical detail, a stable reference, attachments (through the real routes)')
  const { sanitiseTechnicalDetail } = await import('../lib/lex/feedback-technical')
  const { scrubPersonal } = await import('../lib/lex/feedback')
  const { buildLexFeedbackEmail } = await import('../lib/email')
  const { FEEDBACK_SURFACES, SURFACE_LABELS, userRefLabel } = await import('../lib/lex/feedback-types')

  ok('"Bug / error report" is a choice in "What is this about?", and it is offered first', FEEDBACK_SURFACES[0] === 'BUG_REPORT' && /^Bug \/ error report/.test(SURFACE_LABELS.BUG_REPORT))

  // the pure sanitiser
  const UUID = '12345678-1234-1234-1234-123456789012' // deliberately all digits: the scrubber's number rules would eat it
  const sample = { op: 'assignHeading', actionNumbers: [4, 20], status: 422, headingId: UUID, error: 'Rejected: the selected actions (“actionIds”) was missing.', note: 'write to jane.doe@example.com about #4' }
  const s1 = sanitiseTechnicalDetail(sample, ['Charlie'])
  const d1 = s1.detail as typeof sample
  ok('the numbers involved pass through untouched (#4, #20, the status)', JSON.stringify(d1.actionNumbers) === '[4,20]' && d1.status === 422)
  ok('an identifier the team needs intact passes through, even an all-digit one', d1.headingId === UUID, String(d1.headingId))
  ok('the error shown passes through word for word', d1.error === sample.error)
  ok('personal content IS removed (an email address)', !/jane\.doe@example\.com/.test(JSON.stringify(s1.detail)) && s1.redactions.some((r) => r.kind === 'email'))
  ok('sanitising is idempotent — what the user was shown is what is stored', JSON.stringify(sanitiseTechnicalDetail(s1.detail, ['Charlie']).detail) === JSON.stringify(s1.detail))
  control('a plain scrub would also have kept the all-digit identifier (must be FALSE)', scrubPersonal(UUID).text === UUID)

  // the reference
  const probe = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' }, select: { id: true, feedbackRef: true } })
  const users = await prisma.user.count()
  const distinct = (await prisma.user.groupBy({ by: ['feedbackRef'] })).length
  ok(`every user has a reference and no two share one (${users} users, ${distinct} distinct)`, users === distinct && !!probe?.feedbackRef)
  ok('the reference reads "User N", never an initial or "the user"', userRefLabel(435) === 'User 435' && /^User \d+$/.test(userRefLabel(probe?.feedbackRef)))
  control('a missing reference must not read as a person (must be FALSE)', /^User \d+$/.test(userRefLabel(null)))

  // the email, read as built
  const mail = buildLexFeedbackEmail({
    feedbackItemId: 'fi-1', stage: 'COHERENT_ACTIONS', surface: 'BUG_REPORT', summarisedText: 'I selected #4 and #20 and chose a heading; it said the request was not valid.',
    userEdited: false, ideaTitle: 'T', ideaId: 'i-1', userRef: 'User 435', technicalDetail: { op: 'assignHeading', actionNumbers: [4, 20] }, files: [{ name: 'shot.png', bytes: 2048, url: 'https://example.invalid/x' }],
  })
  ok('the email names the sender "User 435", in the subject and the body', mail.subject.includes('User 435') && mail.text.includes('From:    User 435') && mail.html.includes('User 435'))
  ok('…never "the user"', !/\bthe user\b/i.test(mail.text) && !/\bA user has\b/.test(mail.text))
  ok('…carries the technical detail verbatim, and says it is not summarised', mail.text.includes('"actionNumbers": [\n    4,\n    20\n  ]') && /not summarised/.test(mail.text))
  ok('…lists the attachment', mail.text.includes('shot.png') && mail.html.includes('shot.png'))
  const plain = buildLexFeedbackEmail({ feedbackItemId: 'fi-2', stage: 'CAUSES', surface: 'CAUSES', summarisedText: 'Too low.', userEdited: false, ideaTitle: 'T', ideaId: 'i-1', userRef: 'User 7', files: [] })
  ok('a Lex-output critique is "User 7 has passed back feedback", with no technical block', plain.text.startsWith('User 7 has passed back feedback') && !/Technical detail/.test(plain.text))
  control('an email with no reference would pass the "names the sender" test (must be FALSE)', buildLexFeedbackEmail({ feedbackItemId: 'x', stage: 's', surface: 'OTHER', summarisedText: 't', userEdited: false, ideaTitle: 'T', ideaId: 'i', files: [] }).text.includes('User 435'))

  // the summariser: bug reports never reach a model; the others are told to use the reference
  const fb = readFileSync(join(__dirname, '..', 'lib', 'lex', 'feedback.ts'), 'utf8')
  ok('the summariser returns a bug report BEFORE any model call (source: the early return precedes the fetch)', fb.indexOf("input.surface === 'BUG_REPORT'") > 0 && fb.indexOf("input.surface === 'BUG_REPORT'") < fb.indexOf('generativelanguage.googleapis.com'))
  ok('the model prompt names the person only by the reference', /Refer to the person ONLY as/.test(fb) && !/What the user said/.test(fb))

  // the real routes
  const dlg = readFileSync(join(__dirname, '..', 'components', 'lex', 'FeedbackDialog.tsx'), 'utf8')
  ok('the dialog takes a file, captures the technical detail, and shows it before sending', /type="file"/.test(dlg) && /getTechnicalDetail\(\)/.test(dlg) && /sent exactly as shown/.test(dlg))
  ;(globalThis as { __STUB_AUTH_USER?: unknown }).__STUB_AUTH_USER = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' } })
  const copy = await scratchCopy('452c5ade', 'walk8-feedback')
  const id = copy.id
  const savedKey = process.env.RESEND_API_KEY
  delete process.env.RESEND_API_KEY // nothing may be emailed from a check; the route must store, and record that the send did not happen
  try {
    const fbRoute = async (body: Record<string, unknown>) => {
      const { POST } = await import('../app/api/ideas/[id]/feedback/route')
      const res = await POST(new Request('http://internal.invalid/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })
      return { status: res.status, json: (await res.json()) as Record<string, any> }
    }
    const words = 'I selected actions 4 and 20, chose “Assign to heading…”, and it said “That request was not valid.” I expected them to move.'
    const tech = { errorShownOnScreen: ['That request was not valid.'], controlsPressedMostRecentLast: [{ control: 'Assign selected to a heading (changed)' }], failedRequestsMostRecentLast: [{ method: 'POST', path: `/api/ideas/${id}/action-structure`, status: 422, sent: { op: 'assignHeading', ids: ['a', 'b'], headingId: UUID } }] }
    const sum = await fbRoute({ action: 'summarise', text: words, surface: 'BUG_REPORT', stage: 'COHERENT_ACTIONS', technicalDetail: tech })
    ok('summarise (bug report): 200, marked verbatim, no model fallback flag', sum.status === 200 && sum.json.verbatim === true && sum.json.usedFallback === false, JSON.stringify(sum.json).slice(0, 200))
    ok('…the user\'s words come back as written — not a summary of something else', sum.json.summarisedText === words, String(sum.json.summarisedText))
    ok('…the technical detail comes back whole, with the identifier and the failing request', sum.json.technicalDetail?.failedRequestsMostRecentLast?.[0]?.sent?.headingId === UUID && sum.json.technicalDetail?.errorShownOnScreen?.[0] === 'That request was not valid.')
    ok('…and says who it is from, by reference', sum.json.userRef === userRefLabel(probe?.feedbackRef), String(sum.json.userRef))
    control('the sentence the model actually produced for Charlie\'s report passes the "as written" test (must be FALSE)', sum.json.summarisedText === 'The grouping of “CAs under pressure”.')

    const sub = await fbRoute({ action: 'submit', originalText: words, summarisedText: words, surface: 'BUG_REPORT', stage: 'COHERENT_ACTIONS', userEdited: false, technicalDetail: sum.json.technicalDetail })
    ok('submit (bug report): stored even though the email could not be sent, and says so', sub.status === 200 && sub.json.stored === true && sub.json.sent === false, JSON.stringify(sub.json).slice(0, 200))
    const row = await prisma.feedbackItem.findFirst({ where: { ideaId: id }, orderBy: { createdAt: 'desc' } })
    ok('…the row carries BUG_REPORT, the technical detail exactly as shown, and the failed send', !!row && row.surface === 'BUG_REPORT' && stable(row.technicalDetail) === stable(sum.json.technicalDetail) && !!row.sendError, row ? `${row.surface} ${row.sendError}` : 'no row')
    const foreign = await fbRoute({ action: 'submit', originalText: 'x', summarisedText: 'x', surface: 'BUG_REPORT', stage: 'S', attachments: [{ key: '_feedback/other-idea/other-user/f.png', name: 'f.png', contentType: 'image/png', bytes: 10 }] })
    ok('an attachment key the user did not upload for this idea is refused, in words', foreign.status === 422 && /not one you uploaded/.test(String(foreign.json.error)), String(foreign.json.error))
    const bad = await fbRoute({ action: 'summarise', surface: 'BUG_REPORT' })
    ok('a malformed feedback request names the missing input', bad.status === 422 && /“text”/.test(String(bad.json.error)) && !BARE.test(String(bad.json.error)), String(bad.json.error))

    // the attachment route's refusals (nothing is written to R2 by any of these)
    const att = async (file: File | null) => {
      const { POST } = await import('../app/api/ideas/[id]/feedback/attachment/route')
      const fd = new FormData(); if (file) fd.append('file', file)
      const res = await POST(new Request('http://internal.invalid/', { method: 'POST', body: fd }), { params: Promise.resolve({ id }) })
      return { status: res.status, json: (await res.json()) as { error?: string } }
    }
    const exe = await att(new File([new Uint8Array(10)], 'run.exe', { type: 'application/x-msdownload' }))
    ok('a file of the wrong kind is refused, naming the file and what is allowed', exe.status === 415 && /run\.exe/.test(exe.json.error ?? '') && /images/.test(exe.json.error ?? ''), exe.json.error)
    const big = await att(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' }))
    ok('a file over the limit is refused, naming its size and the limit', big.status === 413 && /huge\.png/.test(big.json.error ?? '') && /5 MB/.test(big.json.error ?? ''), big.json.error)
    const none = await att(null)
    ok('an upload with no file says which field was empty', none.status === 422 && /“file”/.test(none.json.error ?? ''), none.json.error)
  } finally {
    if (savedKey) process.env.RESEND_API_KEY = savedKey
    await prisma.feedbackItem.deleteMany({ where: { ideaId: id } })
    await deleteScratch(id)
  }
}

async function main() {
  partA()
  partD()
  await partB()
  await partC()
  await partE()
  console.log(`\n${pass} passed, ${fail} failed · ${ran} checks RUN · ${controls} controls, ${controls - dead} fired, ${dead} dead`)
  process.exit(fail || dead ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
