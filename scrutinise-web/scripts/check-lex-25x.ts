// ─────────────────────────────────────────────────────────────────────────────────────────
// check:lex-25x — a build must not destroy a decision the user has made.
//
// CLAUDE.md §23 (report checks RUN, not only checks PASSED), §25 (assert the data present in
// the rendered output), §26 (the cold read) and §28 all apply.
//
// ⚠ §1 AND §2 ARE ASSERTED BY PERFORMING THE OPERATION, not by reading the source that would
// perform it. The check creates a scratch idea, calls the real `setProposal` — the function
// the build calls — and reads the result back through `computeCanonicalState`, which is the
// function the browser calls. §26's cold read is the DOCUMENT half: the challenge assertions
// take the pilot proposal, an idea this check did not create and does not touch.
//
// Usage: npm run check:lex-25x
// ─────────────────────────────────────────────────────────────────────────────────────────

import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { prisma } from '../lib/prisma'
import { setProposal, acceptField, dismissProposal, reopenField } from '../lib/lex/field-machine'
import { computeCanonicalState } from '../lib/lex/state'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { buildProposalDocument } from '../lib/documents/build-proposal'
import { buildMeetingPackDocument } from '../lib/documents/build-meeting-pack'
import type { Block, DocumentModel } from '../lib/documents/model'

const PILOT = '452c5ade-3153-400a-bf48-3b71aaa52773'
const MARK = '25X-CHECK'
let passed = 0, failed = 0, dead = 0, controls = 0
const notChecked: string[] = []

function ok(label: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
/** ⚠ The lambda returns whether the PROPERTY holds on broken input (CLAUDE.md §23). */
function control(label: string, holdsOnBroken: () => boolean | Promise<boolean>) {
  controls++
  return Promise.resolve(holdsOnBroken()).then((held) => {
    if (held) { dead++; console.log(`  ⚠ DEAD CONTROL — ${label}`) }
    else console.log(`  ✓ fired — ${label}`)
  })
}
function skip(label: string, why: string) { notChecked.push(`${label} — ${why}`); console.log(`  · NOT CHECKED ${label} — ${why}`) }

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const code = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

function textOf(m: DocumentModel): string {
  const out: string[] = [m.title, m.subtitle ?? '', m.sourceLabel]
  for (const b of m.blocks as Block[]) {
    if (b.kind === 'section') out.push(b.title)
    else if (b.kind === 'heading' || b.kind === 'paragraph') out.push(b.runs.map((r) => r.text).join(''))
    else if (b.kind === 'bullets') for (const it of b.items) out.push(it.map((r) => r.text).join(''))
    else if (b.kind === 'note') out.push(b.text)
    else if (b.kind === 'sources') for (const r of b.refs) out.push(`${r.title} ${r.citation} ${r.url} ${r.date ?? ''} ${r.snippet ?? ''}`)
  }
  return out.join('\n')
}

const ACCEPTED_TEXT = 'The authority has nobody answerable for whether a licence condition is ever checked.'
const BUILD_TEXT = 'No officer holds a duty to verify licence conditions, so verification is nobody\'s job.'

async function main() {
  console.log('\n── check:lex-25x — a build must not destroy a decision ──\n')

  await prisma.idea.deleteMany({ where: { title: { startsWith: MARK } } })
  const owner = await prisma.user.findFirst({ where: { email: 'cl@scrutinise.org' }, select: { id: true } })
    ?? await prisma.user.findFirst({ select: { id: true } })
  if (!owner) { console.log('no user to own the fixture'); process.exit(1) }

  const idea = await prisma.idea.create({
    data: {
      creatorId: owner.id,
      title: `${MARK} ${randomUUID().slice(0, 8)} — scratch, deleted by the check`,
      summaryDescription: 'Created and destroyed by check:lex-25x.',
      govtArea: 'Check fixture',
    },
    select: { id: true, createdAt: true },
  })
  const ideaId = idea.id
  ok('the fixture is a new row, not a reused one',
    Date.now() - idea.createdAt.getTime() < 60_000, ideaId.slice(0, 8))

  try {
    // ══ §1 — AN ACCEPTED FIELD SURVIVES A BUILD, AND THE BUILD'S VERSION APPEARS BESIDE IT ══
    console.log('\n§1 (decision 59) — an accepted field is not overwritten')

    await acceptField(ideaId, owner.id, 'challenge', ACCEPTED_TEXT)
    const before = await prisma.ideaFieldState.findUnique({
      where: { ideaId_fieldKey: { ideaId, fieldKey: 'challenge' } },
      select: { status: true, value: true },
    })
    ok('the fixture starts ACCEPTED with the user\'s text',
      before?.status === 'ACCEPTED' && before.value === ACCEPTED_TEXT, before?.status)

    // ⚠ THE OPERATION, through the function the BUILD calls. Not a source read.
    await setProposal(ideaId, 'challenge', { value: BUILD_TEXT, rationale: 'The research narrowed it.' })

    const row = await prisma.ideaFieldState.findUnique({
      where: { ideaId_fieldKey: { ideaId, fieldKey: 'challenge' } },
      select: { status: true, value: true, proposal: true },
    })
    ok('§1a — the field is STILL ACCEPTED after a build proposes to it',
      row?.status === 'ACCEPTED', row?.status)
    ok('§1a — and the value is the user\'s, untouched',
      row?.value === ACCEPTED_TEXT, row?.value === ACCEPTED_TEXT ? 'unchanged' : String(row?.value).slice(0, 60))
    ok('§1b — the build\'s version is stored beside it as a proposal',
      (row?.proposal as { value?: string } | null)?.value === BUILD_TEXT)

    // ⚠⚠ §1c's REJECTED OPTION, ASSERTED AS AN ABSENCE OF ITS SYMPTOM. Guarding the status
    // alone would leave a field marked ACCEPTED whose text had changed underneath — the user
    // recorded as agreeing to words they never read. This is that exact state, and it must
    // not exist.
    ok('§1c — the rejected shape does not occur: no ACCEPTED field holds the build\'s text as its value',
      row?.value !== BUILD_TEXT)

    // §1d, direction 2: it reaches the screen. `computeCanonicalState` is what the browser calls.
    const state = await computeCanonicalState(ideaId)
    const f = state?.pages.flatMap((p) => p.fields).find((x) => x.key === 'challenge')
    ok('§1d — the canonical state carries BOTH: the accepted value and the proposal',
      f?.status === 'ACCEPTED' && f?.value === ACCEPTED_TEXT
      && (f?.proposal?.value as string) === BUILD_TEXT,
      `status=${f?.status} proposal=${f?.proposal ? 'present' : 'MISSING'}`)

    await control('the state read used to drop a proposal on an ACCEPTED field', async () => {
      // The property: a proposal on an ACCEPTED field reaches the client. On the old read
      // (`status === 'AWAITING_CONFIRMATION' && row.proposal`) it does not.
      const oldRule = (status: string, proposal: unknown) =>
        status === 'AWAITING_CONFIRMATION' && !!proposal
      return oldRule('ACCEPTED', row?.proposal)
    })

    // ⚠ AND THE OFFER IS VISIBLY DISTINCT. Source-shaped and legitimately so — the property is
    // that the panel renders a dedicated component, with a non-colour cue (Charlie is colour
    // blind: docs/CLAUDE.md §21 — `border-2` and words, not hue).
    const panel = stripComments(code('components/lex/FieldsPanel.tsx'))
    ok('§1b — the panel has one shared RefinementOffer, not three copies',
      (panel.match(/function RefinementOffer\(/g) ?? []).length === 1
      && (panel.match(/<RefinementOffer /g) ?? []).length === 3,
      `${(panel.match(/<RefinementOffer /g) ?? []).length} call sites`)
    ok('§1b — it carries a non-colour cue: a 2px border and the words',
      /border-2 border-blue-300/.test(panel) && /Proposed by Lex — refine/.test(panel))
    ok('§1b — and it offers BOTH directions',
      /Use Lex’s version/.test(panel) && /Keep mine/.test(panel))

    // "Keep mine" — the offer goes, the acceptance stays.
    const dismissed = await dismissProposal(ideaId, 'challenge')
    const afterKeep = await prisma.ideaFieldState.findUnique({
      where: { ideaId_fieldKey: { ideaId, fieldKey: 'challenge' } },
      select: { status: true, value: true, proposal: true },
    })
    ok('§1b — "keep mine" clears the offer and leaves the acceptance exactly as it was',
      dismissed && afterKeep?.status === 'ACCEPTED' && afterKeep.value === ACCEPTED_TEXT
      && afterKeep.proposal == null,
      `status=${afterKeep?.status} proposal=${afterKeep?.proposal ? 'STILL THERE' : 'cleared'}`)

    await control('"keep mine" refuses a field that is not ACCEPTED', async () => {
      // The property: dismissProposal only touches an ACCEPTED row. Reopen puts the field at
      // AWAITING_CONFIRMATION; dismissing there would leave it awaiting confirmation of nothing.
      await reopenField(ideaId, 'challenge')
      const cleared = await dismissProposal(ideaId, 'challenge')
      await acceptField(ideaId, owner.id, 'challenge', ACCEPTED_TEXT) // put it back
      return cleared
    })

    // ⚠ A PROPOSAL IDENTICAL TO THE ACCEPTED TEXT IS NOT AN OFFER.
    await setProposal(ideaId, 'challenge', { value: ACCEPTED_TEXT })
    const same = await prisma.ideaFieldState.findUnique({
      where: { ideaId_fieldKey: { ideaId, fieldKey: 'challenge' } }, select: { proposal: true },
    })
    ok('§1b — a build proposing exactly the accepted text offers nothing',
      same?.proposal == null, same?.proposal ? 'an empty offer was written' : 'no offer')

    // ⚠ AND THE USER'S OWN REOPEN STILL WORKS. The protection is on LEX's path only.
    await reopenField(ideaId, 'challenge')
    const reopened = await prisma.ideaFieldState.findUnique({
      where: { ideaId_fieldKey: { ideaId, fieldKey: 'challenge' } }, select: { status: true },
    })
    ok('§1 — the user reopening their own field still moves it to AWAITING_CONFIRMATION',
      reopened?.status === 'AWAITING_CONFIRMATION', reopened?.status)

    // ══ §2 — A USER'S ROOT-CAUSE MARK IS A USER DECISION ══════════════════════════════════
    console.log('\n§2 (decision 60) — the revise pass may not take the mark with the row')

    const parent = await prisma.diagnosisCause.create({
      data: { ideaId, cause: 'Funding for inspection comes from the inspected budget.', source: 'LEX_CORPUS' },
      select: { id: true },
    })
    const markedChild = await prisma.diagnosisCause.create({
      data: { ideaId, cause: 'So inspections are cut first.', source: 'LEX_CORPUS', isRootCause: true, parentCauseId: parent.id },
      select: { id: true },
    })
    const userCause = await prisma.diagnosisCause.create({
      data: { ideaId, cause: 'Officers record nothing.', source: 'USER' }, select: { id: true },
    })

    // ⚠ THE PRODUCT'S OWN SEQUENCE, not a re-implementation: detach the marked rows, then
    // delete the unmarked LEX_CORPUS ones. If build.ts changes and this does not, the parity
    // is what breaks — so the sequence is asserted against build.ts below as well.
    await prisma.diagnosisCause.updateMany({
      where: { ideaId, source: 'LEX_CORPUS', isRootCause: true, parentCauseId: { not: null } },
      data: { parentCauseId: null },
    })
    await prisma.diagnosisCause.deleteMany({ where: { ideaId, source: 'LEX_CORPUS', isRootCause: false } })

    const survivors = await prisma.diagnosisCause.findMany({
      where: { ideaId }, select: { id: true, isRootCause: true, source: true },
    })
    ok('§2a — the marked cause SURVIVES the revise deletion',
      survivors.some((s) => s.id === markedChild.id), `${survivors.length} cause(s) left`)
    ok('§2a — and it is still marked',
      survivors.find((s) => s.id === markedChild.id)?.isRootCause === true)
    ok('§2a — the unmarked Lex cause is gone, as a revise intends',
      !survivors.some((s) => s.id === parent.id))
    ok('§2a — and the user\'s own cause is untouched',
      survivors.some((s) => s.id === userCause.id))

    await control('without the detach, the cascade would have taken it anyway', async () => {
      // The property under test is that excluding a marked row from the WHERE is sufficient.
      // It is not: `parent` is onDelete: Cascade. This performs the broken version and asks
      // whether the marked child survived.
      const p2 = await prisma.diagnosisCause.create({
        data: { ideaId, cause: 'control parent', source: 'LEX_CORPUS' }, select: { id: true },
      })
      const c2 = await prisma.diagnosisCause.create({
        data: { ideaId, cause: 'control marked child', source: 'LEX_CORPUS', isRootCause: true, parentCauseId: p2.id },
        select: { id: true },
      })
      // The broken sequence: no detach.
      await prisma.diagnosisCause.deleteMany({ where: { ideaId, source: 'LEX_CORPUS', isRootCause: false } })
      const alive = await prisma.diagnosisCause.count({ where: { id: c2.id } })
      await prisma.diagnosisCause.deleteMany({ where: { id: { in: [p2.id, c2.id] } } })
      return alive > 0
    })

    const build = stripComments(code('lib/lex/build.ts'))
    ok('§2a — build.ts detaches before it deletes, and deletes only unmarked rows',
      /isRootCause: true[\s\S]{0,400}?parentCauseId: null/.test(build)
      && /deleteMany\(\{\s*where: \{ ideaId, source: 'LEX_CORPUS', isRootCause: false \}/.test(build))

    // §2b — the screen says so. Derived, so read it off the state the browser reads.
    const state2 = await computeCanonicalState(ideaId)
    const marked2 = state2?.diagnosisCauses.find((c) => c.id === markedChild.id)
    if (!marked2) skip('§2b', 'the marked cause is not in the canonical state')
    else {
      // No completed build on this scratch idea, so `keptThroughRevision` must be FALSE —
      // saying a cause survived a build that never ran would be a claim about nothing.
      ok('§2b — with no completed build, nothing claims the cause survived one',
        marked2.keptThroughRevision === false, String(marked2.keptThroughRevision))
      const panelSrc = stripComments(code('components/lex/FieldsPanel.tsx'))
      ok('§2b — the panel renders the sentence when it IS true',
        /cause\.keptThroughRevision &&/.test(panelSrc)
        && /the latest build kept it/.test(panelSrc))
    }

    // ══ §3 — THE CLEANUP, ON THE PILOT PROPOSAL (a cold read: not created here) ═══════════
    console.log('\n§3 (decisions 54 + 58) — the challenge cleanup, in the rendered document')
    const snapshot = await buildProposalSnapshot(PILOT)
    const issues = snapshot.issues
    const cur = issues.filter((i) => i.current)
    const promoted = issues.filter((i) => i.promotedToVersion != null)
    const possible = issues.filter((i) => i.relationKind === 'POSSIBLY_DUPLICATE')
    const archived = issues.filter((i) => i.status === 'DISMISSED')

    ok('§3 — nothing was deleted: every challenge is still on the idea',
      issues.length === 225, `${issues.length} rows`)
    ok('§3 — the current set is smaller than the accumulated pile',
      cur.length > 0 && cur.length < issues.length, `${cur.length} of ${issues.length}`)
    ok('§3 — the 43 promotions are applied', promoted.length === 43, `${promoted.length}`)
    ok('§3b — POSSIBLY DUPLICATE exists as a state and those challenges are still OPEN',
      possible.length > 0 && possible.every((i) => i.status === 'OPEN'),
      `${possible.length}, all open`)
    ok('§3 — every archived challenge carries a stated reason',
      archived.length > 0 && archived.every((i) => !!i.dismissReason?.trim()),
      `${archived.length} archived, ${archived.filter((i) => !i.dismissReason?.trim()).length} without a reason`)

    const long = textOf(buildProposalDocument(snapshot).model)
    const pack = textOf(buildMeetingPackDocument(snapshot).model)
    const promotedSample = promoted.find((i) => i.status === 'OPEN' && i.title?.trim())
    if (!promotedSample) skip('§3 the promoted marker', 'no open promoted challenge with a title')
    else {
      ok('§3 — a promoted challenge prints the draft it was raised against',
        long.includes(`[raised against draft ${promotedSample.runVersion}, still applies]`),
        `draft ${promotedSample.runVersion}`)
    }
    ok('§3 — the archived ones are still visible in the document, with their reasons',
      long.includes('Considered and set aside'))
    const archivedSample = archived.find((i) => i.dismissReason?.includes('Already made against'))
    ok('§3 — an archived duplicate NAMES the challenge that duplicates it',
      !!archivedSample, archivedSample ? 'named' : 'no duplicate names its current challenge')
    // ⚠⚠ THE FIRST VERSION OF THIS CONTROL WAS DEAD, AND IT WAS THE CONTROL THAT WAS WRONG.
    // It asserted "not every open challenge appears in the document" — and every open challenge
    // DOES appear, because §3 requires it: the current set under Challenges, the rest under
    // "Raised against earlier drafts". Archive-never-delete is true of the document too.
    //
    // The real property is about WHICH SECTION each one lands in, so the assertion reads the
    // BLOCKS rather than the flattened text: the bullets that follow the Challenges heading
    // must be the current set, and a non-current challenge must not be among them.
    const bulletsUnder = (m: DocumentModel, heading: string): string[] => {
      const blocks = m.blocks as Block[]
      const at = blocks.findIndex((b) =>
        (b.kind === 'heading' && b.runs.map((r) => r.text).join('') === heading))
      if (at < 0) return []
      const next = blocks.slice(at + 1).find((b) => b.kind === 'bullets')
      return next && next.kind === 'bullets' ? next.items.map((it) => it.map((r) => r.text).join('')) : []
    }
    const longModel = buildProposalDocument(snapshot).model
    const challengeBullets = bulletsUnder(longModel, 'Challenges')
    const earlierBullets = bulletsUnder(longModel, 'Raised against earlier drafts, not yet resolved')
    const notCurrentOpen = issues.filter((i) => !i.current && i.status === 'OPEN')

    ok('§3 — the Challenges section is the CURRENT set and nothing else',
      challengeBullets.length > 0
      && challengeBullets.length === cur.filter((i) => i.status === 'OPEN' || i.status === 'DEFERRED').length,
      `${challengeBullets.length} bullets vs ${cur.filter((i) => i.status === 'OPEN' || i.status === 'DEFERRED').length} current`)
    ok('§3 — and the open criticisms of earlier drafts are printed under their own heading',
      earlierBullets.length === notCurrentOpen.length, `${earlierBullets.length} vs ${notCurrentOpen.length}`)
    // ⚠⚠ AND THE SECOND VERSION OF THIS CONTROL WAS DEAD TOO, FOR A DIFFERENT REASON.
    // It asked whether any non-current challenge's first 60 characters appear among the
    // Challenges bullets — and they do, because dozens of these criticisms open with the same
    // words ("The proposal seeks to define 'clear legal duties for…"). It was matching a shared
    // prefix, not a shared row. A substring is not an identity.
    //
    // So the control now PERFORMS the broken filter — the pre-25-X one, with no `current` test
    // — and asks whether the property still holds. On the old code it cannot.
    control('the pre-25-X filter would have printed the challenges of every draft here', () => {
      const brokenFilter = issues.filter((i) => i.status === 'OPEN' || i.status === 'DEFERRED')
      const currentOpen = cur.filter((i) => i.status === 'OPEN' || i.status === 'DEFERRED')
      return brokenFilter.length === currentOpen.length
    })
    ok('§3 — the meeting pack shows the current set too, not nine drafts',
      pack.length > 0 && !pack.includes('[raised against draft'),
      'no earlier-draft markers leak into the pack\'s challenge list')
  } finally {
    // ⚠ The fixture owns its data and destroys it — but only its own.
    const gone = await prisma.idea.deleteMany({ where: { title: { startsWith: MARK } } })
    const left = await prisma.idea.count({ where: { title: { startsWith: MARK } } })
    ok('the scratch idea is gone', gone.count > 0 && left === 0, `${left} left`)
  }

  console.log(`\n── ${passed} passed, ${failed} failed, ${notChecked.length} NOT CHECKED, ` +
    `${controls} controls (${dead} dead) ──`)
  for (const n of notChecked) console.log(`  · NOT CHECKED: ${n}`)
  if (failed || dead) process.exitCode = 1
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e); await prisma.$disconnect(); process.exit(1)
})
