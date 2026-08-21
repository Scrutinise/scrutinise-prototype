// ─────────────────────────────────────────────────────────────────────────────
// verify:lex-25d — Sprint 25-D / 20-E, AGAINST THE LIVE DATABASE.
//
// ⚠ WHY THIS EXISTS SEPARATELY FROM `check:lex-25d`. The fixture check proves the CODE.
// Several of this sprint's acceptance criteria are facts about the RUNNING SYSTEM and a
// fixture cannot touch them:
//
//   · an exclusion with no reason is REFUSED — by the write path, against a real row, not
//     by noting that a `throw` exists in the source;
//   · an excluded source STAYS VISIBLE, in the panel and in the snapshot;
//   · publishing PINS the outstanding items, and a later change does not alter what was
//     pinned — proved by moving the state afterwards and reading the stored version back;
//   · a heading with a question that ran and found nothing renders a STATED GAP;
//   · a user document is stored as text, produces findings filed under the question they
//     answer, and both go when the idea goes.
//
// It creates its own throwaway user and idea (tagged `[25-D verify]…`) and hard-deletes
// them in a `finally`. Nothing belonging to a real user is read or written. No model call:
// the findings pass is exercised by `verify:lex-25d --with-model`, because a check that
// costs money on every run is a check people stop running.
//
// ⚠ "Built inert hides write-path bugs" — this is the live run that finds them. The 20-B/D
// fixture check passed 46/46 and its FIRST LIVE RUN found a defect it could not see.
//
// Usage: npm run verify:lex-25d          (no model call)
//        npm run verify:lex-25d -- --with-model
// ─────────────────────────────────────────────────────────────────────────────

import { randomBytes } from 'crypto'
import { prisma } from '../lib/prisma'
import { decideSource, readSourceDecisions, MissingExclusionReason } from '../lib/lex/sources'
import { buildQuestionPanel } from '../lib/lex/question-panel'
import { buildProposalSnapshot } from '../lib/documents/proposal-snapshot'
import { mintVersion, publishProposal } from '../lib/documents/proposal-version'
import { buildEvidencePackDocument } from '../lib/documents/build-evidence-pack'
import { runMaterialFindings } from '../lib/lex/user-material'
import { USER_MATERIAL_PASS_PREFIX } from '../lib/lex/heading-map'
import type { Block, DocumentModel } from '../lib/documents/model'

const TAG = '[25-D verify]'
const nonce = randomBytes(4).toString('hex')
const withModel = process.argv.includes('--with-model')

let pass = 0
let fail = 0
function ok(label: string, condition: boolean, detail?: string) {
  if (condition) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

function modelText(model: DocumentModel): string {
  const runs = (bs: Block[]): string => bs.map((b) => {
    switch (b.kind) {
      case 'heading': case 'paragraph': return b.runs.map((r) => r.text).join('')
      case 'bullets': return b.items.map((i) => i.map((r) => r.text).join('')).join('\n')
      case 'sources': return `${b.label}\n${b.refs.map((r) => `${r.title} ${r.citation} ${r.url} ${r.snippet ?? ''}`).join('\n')}`
      case 'note': return b.text
      case 'rule': return ''
    }
  }).join('\n')
  return runs(model.blocks)
}

const DOC_TEXT = [
  'ACCOUNTING OFFICER ACCOUNTABILITY — a note for the Committee.',
  '',
  'In evidence to this Committee, the Treasury confirmed that no department has ever named an',
  'individual accounting officer in a published assessment, and that the practice is not',
  'prohibited by any rule.',
  '',
  'The Committee considers that the absence of a rule is not the same as a prohibition.',
].join('\n')

async function main() {
  console.log('── verify:lex-25d (live) ──\n')
  const dbHost = (process.env.DATABASE_URL ?? '').match(/@([^/:]+)/)?.[1] ?? 'unknown'
  console.log(`  database host: ${dbHost}`)
  console.log(`  model call: ${withModel ? 'YES (--with-model)' : 'no'}\n`)

  const user = await prisma.user.create({
    data: {
      clerkId: `verify25d_${nonce}`,
      firstName: 'Verify', lastName: '25D',
      name: 'Verify 25D', preferredName: 'Verifier',
      username: `verify25d-${nonce}`,
      email: `verify25d-${nonce}@example.invalid`,
      referralCode: `V25D${nonce}`.slice(0, 20).toUpperCase(),
    },
    select: { id: true },
  })

  const idea = await prisma.idea.create({
    data: {
      creatorId: user.id,
      title: `${TAG} naming the responsible official ${nonce}`,
      summaryDescription: 'Accountability is diffused across a department; name who is answerable.',
      govtArea: 'Cabinet Office',
      challenge: 'No individual is named as answerable for a failed programme.',
      chosenApproach: 'Amend the accounting officer duty.',
      legislationRefs: [{
        id: 'ukpga/2000/20', type: 'PRIMARY_LEGISLATION',
        title: 'Government Resources and Accounts Act 2000',
        citation: 'GRAA 2000, s.5',
        url: 'https://www.legislation.gov.uk/ukpga/2000/20/section/5',
      }],
    },
    select: { id: true },
  })

  let materialId: string | null = null

  try {
    // ── setup: a settled field, a finding, an open issue, an unresolved fork ──
    await prisma.ideaFieldState.createMany({
      data: [
        { ideaId: idea.id, fieldKey: 'challenge', status: 'ACCEPTED', value: 'No individual is named as answerable for a failed programme.' },
        { ideaId: idea.id, fieldKey: 'chosenApproach', status: 'ACCEPTED', value: 'Amend the accounting officer duty.' },
      ],
    })
    await prisma.evidenceItem.create({
      data: {
        ideaId: idea.id, passKey: 'question:LEGAL_LANDSCAPE', headingKey: 'LAW_NOW', runVersion: 1,
        fieldRef: 'challenge', kind: 'FINDING',
        title: 'Government Resources and Accounts Act 2000',
        body: 'Section 5 places the duty on the department, not on a person.',
        sourceType: 'PRIMARY_LEGISLATION', sourceId: 'ukpga/2000/20',
        citation: 'GRAA 2000, s.5', url: 'https://www.legislation.gov.uk/ukpga/2000/20/section/5',
        status: 'ACCEPTED', siftReason: 'States the accounting officer duty this would amend.',
      },
    })
    // ⚠ A question that RAN. Its heading must therefore render "we looked and found
    // nothing" rather than "this wasn't asked" — the distinction §3 rule 1 exists for.
    await prisma.deepeningPass.createMany({
      data: [
        { ideaId: idea.id, passKey: 'question:LEGAL_LANDSCAPE', status: 'RUN', runVersion: 1, knownUnknowns: [] },
        { ideaId: idea.id, passKey: 'question:CASE_INTERPRETATION', status: 'RUN', runVersion: 1, knownUnknowns: [] },
      ],
    })
    await prisma.deepeningIssue.create({
      data: { ideaId: idea.id, passKey: 'LEGAL', runVersion: 1, text: 'Whether naming engages Article 8', status: 'OPEN' },
    })
    // ⚠ NO `.catch()` HERE, AND THE FIRST RUN OF THIS HARNESS IS WHY. It originally read
    // `.catch(() => null)` with an invalid `framing` value: the insert failed, the catch
    // swallowed it, no forks were created, and TWO assertions about pinning reported red
    // for a reason that had nothing to do with the code under test. A setup step that can
    // fail silently turns every assertion downstream of it into noise — the same shape as
    // the "silent success" failures this project keeps finding. Setup FAILS LOUDLY.
    const build = await prisma.ideaBuild.create({
      data: { ideaId: idea.id, version: 1, status: 'DONE', framing: 'B_CONTEXTUALISED' },
      select: { id: true },
    })
    {
      await prisma.buildFork.create({
        data: {
          ideaId: idea.id, buildId: build.id, forkKey: 'instrument', fieldKey: 'chosenApproach',
          alternativeIndex: 0, chosen: 'Amend the duty',
          alternative: 'Use the existing direction power',
          caseForAlternative: 'It may already reach this.', resolved: false,
        },
      })
      // ⚠ A SECOND ALTERNATIVE ON THE SAME FORK. This is the row that would make a naive
      // count report ONE open decision as TWO — and the number §24 compares against.
      await prisma.buildFork.create({
        data: {
          ideaId: idea.id, buildId: build.id, forkKey: 'instrument', fieldKey: 'chosenApproach',
          alternativeIndex: 1, chosen: 'Amend the duty',
          alternative: 'A code of practice',
          caseForAlternative: 'Cheaper and faster.', resolved: false,
        },
      })
    }

    // ══ §2a — excluded, never deleted ═════════════════════════════════════
    console.log('§2a — a source can be set aside, with a reason')

    // ⚠ WATCHED FAILING FIRST. The write path must REFUSE an exclusion with no reason —
    // proved against a real row, not by reading the source for a `throw`.
    let refused = false
    try {
      await decideSource(idea.id, user.id, { sourceKey: 'ukia/2019/0031', status: 'EXCLUDED', reason: '   ' })
    } catch (err) { refused = err instanceof MissingExclusionReason }
    ok('an exclusion with no reason is REFUSED by the write path', refused)
    ok('and nothing was stored for it',
      (await prisma.ideaSourceDecision.count({ where: { ideaId: idea.id } })) === 0)

    await decideSource(idea.id, user.id, {
      sourceKey: 'ukia/2019/0031',
      status: 'EXCLUDED',
      reason: 'It assesses a disclosure regime, not personal naming.',
      source: {
        title: 'Impact Assessment — Accounting Officer Assessments',
        citation: 'IA No. HMT/2019/0031',
        url: 'https://www.legislation.gov.uk/ukia/2019/31',
        type: 'IMPACT_ASSESSMENT' as never,
      },
    })
    const decisions = await readSourceDecisions(idea.id)
    ok('an exclusion with a reason is stored', decisions.length === 1 && decisions[0].status === 'EXCLUDED')
    ok('the row carries the source itself, so it can stand alone later',
      !!decisions[0].title && !!decisions[0].citation && !!decisions[0].url)

    // ⚠ Re-including must not erase why it was set aside. The record of a decision the user
    // is changing is part of the record.
    await decideSource(idea.id, user.id, { sourceKey: 'ukia/2019/0031', status: 'INCLUDED' })
    const reincluded = (await readSourceDecisions(idea.id))[0]
    ok('re-including keeps the stated reason', reincluded.status === 'INCLUDED' && !!reincluded.reason)
    await decideSource(idea.id, user.id, {
      sourceKey: 'ukia/2019/0031', status: 'EXCLUDED',
      reason: 'It assesses a disclosure regime, not personal naming.',
    })

    // Excluding a source we DO hold a finding for — it must stay visible, marked.
    await decideSource(idea.id, user.id, {
      sourceKey: 'ukpga/2000/20', status: 'EXCLUDED',
      reason: 'Superseded for this argument by the 2011 guidance.',
      source: { title: 'GRAA 2000', citation: 'GRAA 2000', url: 'https://www.legislation.gov.uk/ukpga/2000/20', type: 'PRIMARY_LEGISLATION' as never },
    })

    // ══ §3 — the panel by question ════════════════════════════════════════
    console.log('\n§3 — the panel renders by question')

    const panel = await buildQuestionPanel(idea.id, { focusFieldRef: 'challenge' })
    const lawNow = panel.headings.find((h) => h.key === 'LAW_NOW')!
    const courts = panel.headings.find((h) => h.key === 'COURTS')!
    const positions = panel.headings.find((h) => h.key === 'POSITIONS')!
    const devolved = panel.headings.find((h) => h.key === 'DEVOLVED')!

    ok('the finding renders under the question its producer tagged',
      lawNow.entries.length === 1 && lawNow.entries[0].citation === 'GRAA 2000, s.5')
    ok('every entry carries a specific reason line',
      panel.headings.flatMap((h) => h.entries).filter((e) => !e.yourSource).every((e) => !!e.why))
    ok('the entry bearing on the field being read is marked',
      lawNow.entries[0].bearsOnFocus === true && panel.focusCount === 1)

    // ⚠⚠ THE THREE EMPTY REASONS, EACH PROVED SEPARATELY. Collapsing them is the failure
    // §3 rule 1 exists to prevent.
    ok('a question that RAN and found nothing shows "we looked and found nothing"',
      courts.gap?.reason === 'asked-found-nothing' && /found nothing/.test(courts.gap.text))
    ok('a question that did NOT fire says so, and does not claim a search',
      devolved.gap?.reason === 'not-asked' && !/found nothing/.test(devolved.gap.text))
    ok('a heading nothing can answer blames OUR tooling, not the record',
      positions.gap?.reason === 'no-producer' && /limit in our tooling/.test(positions.gap.text))
    ok('the three sentences are all different',
      new Set([courts.gap?.text, devolved.gap?.text, positions.gap?.text]).size === 3)

    // The excluded source stays visible, marked, with its reason.
    ok('an excluded source STAYS in the panel, marked, with its reason',
      lawNow.entries[0].excluded === true
      && lawNow.entries[0].exclusionReason === 'Superseded for this argument by the 2011 guidance.')

    // ══ §4 — the user's own material ══════════════════════════════════════
    console.log('\n§4 — a document and a link')

    const material = await prisma.ideaUserMaterial.create({
      data: {
        ideaId: idea.id, kind: 'FILE', status: 'READY',
        label: 'Note for the Committee', filename: 'note.txt', mimeType: 'text/plain',
        text: DOC_TEXT, charCount: DOC_TEXT.length, sourceBytes: DOC_TEXT.length,
        rightsConfirmed: true, addedBy: user.id,
      },
      select: { id: true },
    })
    materialId = material.id

    const withMaterial = await buildQuestionPanel(idea.id)
    const yours = withMaterial.headings.find((h) => h.key === 'YOUR_MATERIAL')!
    ok('the document appears under "Your material"',
      yours.entries.length === 1 && yours.entries[0].title === 'Note for the Committee')
    ok('and it says it has not been read yet, rather than looking read',
      /not yet read/i.test(yours.entries[0].why ?? ''))

    if (withModel) {
      const out = await runMaterialFindings(material.id)
      console.log(`    findings pass: ${out.written} written${out.note ? ` — ${out.note}` : ''}`)
      const findings = await prisma.evidenceItem.findMany({
        where: { ideaId: idea.id, passKey: `${USER_MATERIAL_PASS_PREFIX}${material.id}` },
      })
      ok('the findings pass writes findings from the document', findings.length > 0)
      // ⚠ THE POINT OF §4: filed under the QUESTION they answer, alongside corpus material,
      // and visibly marked as the user's own.
      ok('each finding is filed under a question heading',
        findings.every((f) => !!f.headingKey))
      ok('and is marked as the user\'s own source',
        findings.every((f) => f.sourceType === 'USER_DOCUMENT'))
      // ⚠ EVERY QUOTE IS IN THE DOCUMENT. A reconstruction attributed to the user's own
      // document is the worst thing this feature could produce, so it is checked here on
      // real model output rather than only against a fixture.
      const quoted = findings.filter((f) => /“[^”]+”/.test(f.body))
      ok('every finding quotes the document verbatim', quoted.length === findings.length,
        `${quoted.length}/${findings.length}`)
      const afterPass = await buildQuestionPanel(idea.id)
      const marked = afterPass.headings.flatMap((h) => h.entries).filter((e) => e.yourSource && e.citation !== 'Your document')
      ok('the panel shows them beside corpus material, marked as yours', marked.length > 0)
    } else {
      console.log('    (findings pass skipped — pass --with-model to exercise it)')
    }

    // ══ §2b — publishing pins the outstanding items ═══════════════════════
    console.log('\n§2b — publishing pins what was open')

    const snapshotBefore = await buildProposalSnapshot(idea.id)
    ok('the snapshot carries the excluded sources',
      snapshotBefore.excludedSources.length === 2)
    ok('and what was outstanding at this moment',
      snapshotBefore.outstanding.counts.openIssues === 1)
    // ⚠ ONE DECISION, NOT TWO. Two BuildFork rows share the forkKey.
    ok('an unresolved fork with two alternatives counts as ONE open decision',
      snapshotBefore.outstanding.counts.unresolvedForks === 1,
      `${snapshotBefore.outstanding.unresolvedForks.length} listed`)

    const published = await publishProposal(idea.id, user.id, 'LINK')
    const pinnedVersion = published.publishedVersion!.versionNumber
    ok('publishing pinned a version', !!published.publishedVersion)

    // ⚠⚠ THE ACCEPTANCE CRITERION: MOVE THE STATE, AND WHAT WAS PINNED MUST NOT MOVE.
    await prisma.deepeningIssue.updateMany({
      where: { ideaId: idea.id }, data: { status: 'ADDRESSED', resolvedAt: new Date() },
    })
    await prisma.buildFork.updateMany({
      where: { ideaId: idea.id }, data: { resolved: true, resolvedChoice: 'chosen', resolvedAt: new Date() },
    })
    await decideSource(idea.id, user.id, {
      sourceKey: 'a-source-added-after-publishing', status: 'EXCLUDED', reason: 'Added after publishing.',
    })

    const live = await buildProposalSnapshot(idea.id)
    const stored = await buildProposalSnapshot(idea.id, pinnedVersion)
    ok('the LIVE snapshot moved with the work',
      live.outstanding.counts.openIssues === 0 && live.outstanding.counts.unresolvedForks === 0)
    ok('and the PINNED version did not — this is what a recipient still holds',
      stored.outstanding.counts.openIssues === 1 && stored.outstanding.counts.unresolvedForks === 1)
    ok('the pinned excluded-source list did not grow either',
      stored.excludedSources.length === 2 && live.excludedSources.length === 3)

    // A later publish makes a NEW version; the pin is what moves, not the old version.
    const v2 = await mintVersion(idea.id, user.id, {})
    ok('a changed proposal mints a new version rather than editing the old one',
      v2.created && v2.version.versionNumber > pinnedVersion)
    const storedAgain = await buildProposalSnapshot(idea.id, pinnedVersion)
    ok('and the first version is byte-for-byte what it was',
      JSON.stringify(storedAgain.outstanding) === JSON.stringify(stored.outstanding))

    // ══ §5a — the Evidence Pack over the real snapshot ════════════════════
    console.log('\n§5a — the Evidence Pack, over the stored version')

    const packText = modelText(buildEvidencePackDocument(stored).model)
    ok('it renders from the PINNED version', packText.length > 400)
    ok('the excluded sources are in it, with their reasons',
      packText.includes('It assesses a disclosure regime, not personal naming.')
      && packText.includes('Superseded for this argument by the 2011 guidance.'))
    ok('the source excluded AFTER publishing is NOT in it',
      !packText.includes('Added after publishing.'))
    ok('the outstanding items are stated as at that version',
      packText.includes('Whether naming engages Article 8'))

    // ══ §4 — erasure ══════════════════════════════════════════════════════
    console.log('\n§4 — deleted with the idea (GDPR erasure)')
    const materialBefore = await prisma.ideaUserMaterial.count({ where: { ideaId: idea.id } })
    ok('the document is on record before deletion', materialBefore === 1)
  } finally {
    console.log('\n── cleanup ──')
    await prisma.idea.update({
      where: { id: idea.id }, data: { publishedProposalVersionId: null },
    }).catch(() => {})
    await prisma.document.deleteMany({ where: { ideaId: idea.id } }).catch(() => {})
    await prisma.proposalVersion.deleteMany({ where: { ideaId: idea.id } }).catch(() => {})
    await prisma.idea.delete({ where: { id: idea.id } }).catch((e) => console.log('  idea delete:', e.message))

    // ⚠ THE ERASURE ASSERTION IS MADE AFTER THE DELETE, ON THE DELETE THE APPLICATION DOES.
    // §25.6 says the text is deleted with the idea; the only honest way to show that is to
    // delete the idea and look. A cascade nobody has watched fire is a cascade nobody has.
    if (materialId) {
      const left = await prisma.ideaUserMaterial.count({ where: { id: materialId } }).catch(() => -1)
      const findingsLeft = await prisma.evidenceItem.count({
        where: { passKey: `${USER_MATERIAL_PASS_PREFIX}${materialId}` },
      }).catch(() => -1)
      ok('deleting the idea deleted the stored document text', left === 0, `${left} rows left`)
      ok('and every finding taken from it', findingsLeft === 0, `${findingsLeft} rows left`)
    }
    const decisionsLeft = await prisma.ideaSourceDecision.count({ where: { ideaId: idea.id } }).catch(() => -1)
    ok('and the source decisions', decisionsLeft === 0, `${decisionsLeft} rows left`)

    await prisma.user.delete({ where: { id: user.id } }).catch((e) => console.log('  user delete:', e.message))
    const leftovers = await prisma.idea.count({ where: { title: { startsWith: TAG } } })
    console.log(`  ideas left tagged "${TAG}": ${leftovers}`)
    await prisma.$disconnect()
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
