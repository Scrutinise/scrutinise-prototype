// ─────────────────────────────────────────────────────────────────────────────
// verify:20bd — Sprint 20-B/D, AGAINST THE LIVE DATABASE AND R2.
//
// ⚠ WHY THIS EXISTS SEPARATELY FROM `check:20bd`. The fixture check proves the
// CODE. Four of this sprint's acceptance criteria are facts about the RUNNING
// SYSTEM and a fixture cannot touch them:
//
//   · a version is APPEND-ONLY — proved by watching the database refuse a second
//     write of the same version number, not by noting that no update path exists;
//   · an unchanged proposal does NOT mint a new version;
//   · a shared link resolves to THE VERSION THAT WAS SHARED — proved by minting a
//     v2 after publishing v1 and watching the resolver still return v1;
//   · COMMUNITY grants a read on a published version AND NOTHING MORE.
//
// It creates its own throwaway users, community and idea (all named
// `[20-BD verify]…`), and hard-deletes every one of them in a `finally`. Nothing
// belonging to a real user is read or written.
//
// ⚠ "Built inert hides write-path bugs" — this is the live run that finds them.
//
// Usage: npm run verify:20bd
// ─────────────────────────────────────────────────────────────────────────────

import { randomBytes } from 'crypto'
import { readFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import { r2Delete, r2Exists } from '../lib/r2'
import { buildProposalSnapshot, snapshotHash } from '../lib/documents/proposal-snapshot'
import {
  mintVersion, publishProposal, unpublishProposal,
  resolveSharedProposal, readPublicationState, listVersions,
} from '../lib/documents/proposal-version'
import { ensureVersionExport, generateProposalExport, readProposalExportStatus } from '../lib/documents/proposal-export'
import { buildProposalDocument } from '../lib/documents/build-proposal'

const TAG = '[20-BD verify]'
const nonce = randomBytes(4).toString('hex')

let pass = 0
let fail = 0
function ok(label: string, condition: boolean, detail?: string) {
  if (condition) { pass++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { fail++; console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}

async function makeUser(suffix: string) {
  return prisma.user.create({
    data: {
      clerkId: `verify20bd_${nonce}_${suffix}`,
      firstName: 'Verify', lastName: suffix,
      name: `Verify ${suffix}`, preferredName: 'Verifier',
      username: `verify20bd-${nonce}-${suffix}`,
      email: `verify20bd-${nonce}-${suffix}@example.invalid`,
      referralCode: `V20BD${nonce}${suffix}`.slice(0, 20).toUpperCase(),
    },
    select: { id: true },
  })
}

async function main() {
  console.log('── verify:20bd (live) ──\n')

  const dbHost = (process.env.DATABASE_URL ?? '').match(/@([^/:]+)/)?.[1] ?? 'unknown'
  console.log(`  database host: ${dbHost}\n`)

  const owner = await makeUser('owner')
  const peer = await makeUser('peer')
  const stranger = await makeUser('stranger')

  const community = await prisma.community.create({
    data: { name: `${TAG} community ${nonce}` },
    select: { id: true },
  })
  await prisma.communityMember.createMany({
    data: [
      { communityId: community.id, userId: owner.id },
      { communityId: community.id, userId: peer.id },
    ],
  })

  const idea = await prisma.idea.create({
    data: {
      creatorId: owner.id,
      title: `${TAG} uprating fixed-penalty notices ${nonce}`,
      summaryDescription: 'Penalties set in cash terms in 2013 have decayed in real terms.',
      govtArea: 'Transport',
      challenge: 'Fixed-penalty levels have not been uprated since 2013.',
      pivotalObstacle: 'No department owns the uprating decision.',
      chosenApproach: 'Index the penalty to CPI.',
      whoAffectedImpactCost: { affectedGroups: 'Councils', impact: 'Costs exceed fines', cost: '£40m a year' },
      legislationRefs: [{
        id: 'ukpga/1988/53', type: 'PRIMARY_LEGISLATION',
        title: 'Road Traffic Offenders Act 1988',
        citation: 'Road Traffic Offenders Act 1988, s.53',
        url: 'https://www.legislation.gov.uk/ukpga/1988/53/section/53',
      }],
    },
    select: { id: true },
  })

  const r2Keys: string[] = []

  try {
    // ── field state, causes, actions, findings, issues ──────────────────────
    for (const [fieldKey, value] of [
      ['challenge', 'Fixed-penalty levels have not been uprated since 2013.'],
      ['pivotalObstacle', 'No department owns the uprating decision.'],
      ['chosenApproach', 'Index the penalty to CPI.'],
      ['whoAffectedImpactCost', JSON.stringify({ affectedGroups: 'Councils', impact: 'Costs exceed fines', cost: '£40m a year' })],
    ] as const) {
      await prisma.ideaFieldState.create({
        data: { ideaId: idea.id, fieldKey, status: 'ACCEPTED', value },
      })
    }

    const cause = await prisma.diagnosisCause.create({
      data: { ideaId: idea.id, cause: 'The level is set in primary legislation', isRootCause: true, classification: 'MATERIAL', source: 'USER' },
      select: { id: true },
    })
    const action = await prisma.lexCoherentAction.create({
      data: {
        ideaId: idea.id, practicalStep: 'Amend Schedule 3 to index the penalty to CPI',
        whoImplements: 'Department for Transport',
        targetOrganisation: 'Road Traffic Offenders Act 1988',
        wording: 'Insert an uprating duty after s.53',
        implementationCost: { low: 120000, high: 180000, unit: 'GBP', basis: 'ASHE mid-level FTE', priceYear: 2026 },
        source: 'USER',
      },
      select: { id: true },
    })
    await prisma.evidenceItem.create({
      data: {
        ideaId: idea.id, passKey: 'EVIDENCE', fieldRef: 'challenge', kind: 'SUPPORTS',
        title: 'Road Traffic Offenders Act 1988, s.53',
        body: 'The level is fixed by order and has not been amended since 2013.',
        citation: 'Road Traffic Offenders Act 1988, s.53',
        url: 'https://www.legislation.gov.uk/ukpga/1988/53/section/53',
        status: 'ACCEPTED',
      },
    })
    // ⚠ A PROPOSED finding, which must NOT reach the artefact that leaves the building.
    await prisma.evidenceItem.create({
      data: {
        ideaId: idea.id, passKey: 'EVIDENCE', fieldRef: 'challenge', kind: 'FINDING',
        title: 'A finding the user has not accepted',
        body: 'PROPOSED_MARKER_MUST_NOT_APPEAR',
        status: 'PROPOSED',
      },
    })
    await prisma.deepeningIssue.create({
      data: { ideaId: idea.id, passKey: 'LEGAL', text: 'No post-implementation review of the 2013 order exists', status: 'OPEN' },
    })
    await prisma.deepeningPass.create({
      data: {
        ideaId: idea.id, passKey: 'EVIDENCE', status: 'RUN',
        knownUnknowns: [{ question: 'What did the 2013 uprating achieve?', why: 'No PIR was published' }],
      },
    })

    // ── §1 the snapshot, from real rows ─────────────────────────────────────
    console.log('§1 — the snapshot, assembled from live rows')
    const snap = await buildProposalSnapshot(idea.id)
    ok('the snapshot reads the kernel from IdeaFieldState',
      snap.fields.find((f) => f.key === 'challenge')?.status === 'ACCEPTED')
    ok('it carries the causes, actions, issues and known unknowns',
      snap.causes.length === 1 && snap.actions.length === 1 &&
      snap.issues.length === 1 && snap.knownUnknowns.length === 1,
      `${snap.causes.length}/${snap.actions.length}/${snap.issues.length}/${snap.knownUnknowns.length}`)
    ok('ACCEPTED evidence is carried and PROPOSED evidence is NOT',
      snap.evidence.length === 1 && !JSON.stringify(snap).includes('PROPOSED_MARKER_MUST_NOT_APPEAR'))
    ok('evidence is attached to the field it bears on',
      snap.fields.find((f) => f.key === 'challenge')?.supported === true)
    ok('a field with no evidence is marked unsupported',
      snap.fields.find((f) => f.key === 'pivotalObstacle')?.supported === false)
    ok('the legislative action is detected from stored drafting intent',
      snap.actions[0]?.legislative === true)
    ok('the corpus sources are grouped', snap.sources.length === 1 && snap.sources[0].refs.length === 1)

    const doc = buildProposalDocument(snap)
    const rendered = JSON.stringify(doc.model.blocks)
    ok('the rendered document names the cause and the action',
      rendered.includes('set in primary legislation') && rendered.includes('index the penalty to CPI'))
    ok('the rendered document marks the unevidenced pivotal obstacle',
      rendered.includes('Not evidenced'))

    // ── §2 versioning, against the database ─────────────────────────────────
    console.log('\n§2 — versioning')
    const v1 = await mintVersion(idea.id, owner.id, { userNote: 'first cut' })
    ok('v1 is created', v1.created && v1.version.versionNumber === 1)
    ok('the change note is computed, not asserted',
      Boolean(v1.version.changeNote?.includes('first cut') && v1.version.changeNote?.includes('First version')),
      v1.version.changeNote ?? 'null')

    const again = await mintVersion(idea.id, owner.id)
    ok('AN UNCHANGED PROPOSAL DOES NOT MINT A NEW VERSION',
      !again.created && again.version.versionNumber === 1)
    ok('there is exactly one version row', (await listVersions(idea.id)).length === 1)

    // ⚠ APPEND-ONLY, PROVED BY THE DATABASE REFUSING THE WRITE — not by noting
    // that the module has no update path.
    let refused = false
    let refusalCode = ''
    try {
      await prisma.proposalVersion.create({
        data: {
          ideaId: idea.id, versionNumber: 1, contentHash: 'duplicate',
          snapshot: {}, createdBy: owner.id,
        },
      })
    } catch (e) {
      refused = true
      refusalCode = (e as { code?: string })?.code ?? 'error'
    }
    ok('APPEND-ONLY: a second write of version 1 is refused by the database',
      refused, refusalCode)

    // ── §2 publication and the PIN ──────────────────────────────────────────
    console.log('\n§2 — publication and the pin')
    const published = await publishProposal(idea.id, owner.id, 'LINK', { userNote: 'sent to the clerk' })
    ok('publishing pins version 1', published.publishedVersion?.versionNumber === 1)
    ok('a share path is minted', Boolean(published.sharePath))
    ok('the live state matches the published version at this point',
      published.liveDiffersFromPublished === false)

    const token = (await prisma.idea.findUnique({
      where: { id: idea.id }, select: { proposalShareToken: true },
    }))!.proposalShareToken!

    const asStranger = await resolveSharedProposal(token, stranger.id)
    ok('a LINK proposal resolves for anyone with the link',
      asStranger.ok && asStranger.proposal?.versionNumber === 1)
    ok('the resolver returns the STORED snapshot, not live state',
      asStranger.proposal?.snapshot?.ideaId === idea.id)

    // ⚠ THE ACCEPTANCE CRITERION. Change the proposal, mint v2, and the link must
    // still hand the recipient v1.
    await prisma.ideaFieldState.update({
      where: { ideaId_fieldKey: { ideaId: idea.id, fieldKey: 'chosenApproach' } },
      data: { value: 'Index the penalty to CPI AND transfer the duty to the Secretary of State.' },
    })
    const v2 = await mintVersion(idea.id, owner.id)
    ok('an edited proposal DOES mint v2', v2.created && v2.version.versionNumber === 2)
    // ⚠ THIS ASSERTION IS TIGHTER THAN IT LOOKS, AND IT CAUGHT A REAL DEFECT.
    // The first live run reported "2 fields edited (Who's affected…, Chosen
    // approach)" when ONE field had been touched: `prev` comes out of a `jsonb`
    // column, Postgres reorders object keys by length then bytewise, and a plain
    // `JSON.stringify` comparison saw a structured field as changed. Asserting
    // ONLY that the edited field is named would have passed straight over it.
    ok('v2’s change note names the edited field',
      Boolean(v2.version.changeNote?.includes('Chosen approach')), v2.version.changeNote ?? 'null')
    ok('and does NOT invent an edit on a field nobody touched (jsonb reorders keys)',
      Boolean(v2.version.changeNote?.includes('1 field edited')) &&
      !v2.version.changeNote?.includes('Who’s affected'),
      v2.version.changeNote ?? 'null')

    const afterV2 = await resolveSharedProposal(token, stranger.id)
    ok('A SHARED LINK RESOLVES TO THE VERSION THAT WAS SHARED, NOT THE LATEST',
      afterV2.ok && afterV2.proposal?.versionNumber === 1,
      `resolver returned v${afterV2.proposal?.versionNumber}, two versions exist`)
    const approachInShared = afterV2.proposal?.snapshot.fields.find((f) => f.key === 'chosenApproach')?.value
    ok('and the recipient’s CONTENT is the old content',
      typeof approachInShared === 'string' && !approachInShared.includes('Secretary of State'),
      String(approachInShared).slice(0, 60))

    const stateNow = await readPublicationState(idea.id)
    ok('the owner is told their working proposal has moved on',
      stateNow.liveDiffersFromPublished === true)

    // ── §2 the community boundary ───────────────────────────────────────────
    console.log('\n§2/§20.7 — the community boundary')
    await publishProposal(idea.id, owner.id, 'COMMUNITY')
    const communityRead = await resolveSharedProposal(token, peer.id)
    ok('a community peer CAN read the published version', communityRead.ok)
    const strangerRead = await resolveSharedProposal(token, stranger.id)
    ok('a non-member CANNOT', !strangerRead.ok && strangerRead.reason === 'not_in_community')
    const signedOut = await resolveSharedProposal(token, null)
    ok('a signed-out reader is told to sign in, not told they are excluded',
      !signedOut.ok && signedOut.reason === 'sign_in_required')

    // ⚠ AND NOTHING MORE. The working proposal is reached only through
    // `authorizeIdea`, whose predicate is owner-or-collaborator. Asserted two ways:
    // the peer holds no collaborator row, and the authoriser contains no community
    // read at all. (This is a STRUCTURAL assertion — it does not exercise an HTTP
    // request, which would need a Clerk session this script cannot mint.)
    const peerCollab = await prisma.ideaCollaborator.count({ where: { ideaId: idea.id, userId: peer.id } })
    ok('the community peer holds no collaborator row on the idea', peerCollab === 0)
    const authzSrc = readFileSync('lib/lex/authz.ts', 'utf8')
    ok('the idea authoriser reads neither Community nor CommunityMember',
      !/community/i.test(authzSrc))

    // Reversible.
    const withdrawn = await unpublishProposal(idea.id)
    ok('withdrawing sets PRIVATE and closes the link', withdrawn.visibility === 'PRIVATE' && withdrawn.sharePath === null)
    ok('a withdrawn link no longer resolves',
      !(await resolveSharedProposal(token, stranger.id)).ok)
    ok('but the versions survive a withdrawal', (await listVersions(idea.id)).length === 2)
    const republished = await publishProposal(idea.id, owner.id, 'LINK')
    const tokenAfter = (await prisma.idea.findUnique({
      where: { id: idea.id }, select: { proposalShareToken: true },
    }))!.proposalShareToken
    ok('re-publishing keeps the SAME token, so a link already sent still works',
      tokenAfter === token)
    ok('re-publishing moves the pin to the current version',
      republished.publishedVersion?.versionNumber === 2)

    // ── §3 the files, into R2 and back ──────────────────────────────────────
    console.log('\n§3 — the rendered files, in R2')
    const working = await generateProposalExport(idea.id, 'PROPOSAL', { force: true })
    r2Keys.push(`_exports/${idea.id}/proposal.docx`, `_exports/${idea.id}/proposal.pdf`)
    ok('the working PROPOSAL renders and is recorded', working.generated && !working.stale)
    ok('it is labelled as coming from the working draft', working.fromVersionNumber === null)

    const summary = await generateProposalExport(idea.id, 'PROPOSAL_SUMMARY', { force: true })
    r2Keys.push(`_exports/${idea.id}/summary.docx`, `_exports/${idea.id}/summary.pdf`)
    ok('the working SUMMARY renders', summary.generated)

    // Re-rendering after a change produces a new file and marks the old one stale.
    await prisma.ideaFieldState.update({
      where: { ideaId_fieldKey: { ideaId: idea.id, fieldKey: 'challenge' } },
      data: { value: 'Fixed-penalty levels have not been uprated since 2013, and recovery has fallen.' },
    })
    const afterEdit = (await readProposalExportStatus(idea.id)).find((d) => d.kind === 'PROPOSAL')!
    ok('a change marks the stored file STALE rather than serving it',
      afterEdit.stale === true)
    const regenerated = await generateProposalExport(idea.id, 'PROPOSAL', { force: true })
    ok('re-rendering clears the staleness and records a new fingerprint',
      regenerated.stale === false && regenerated.generatedAt !== working.generatedAt)

    // The version render — immutable, and keyed by version.
    const vkeys = await ensureVersionExport(idea.id, 1, 'PROPOSAL')
    r2Keys.push(vkeys.docxKey, vkeys.pdfKey)
    ok('a version render is keyed by its version number',
      vkeys.pdfKey === `_exports/${idea.id}/v1/proposal.pdf`, vkeys.pdfKey)
    ok('both version objects are really in R2',
      (await r2Exists(vkeys.docxKey)) && (await r2Exists(vkeys.pdfKey)))

    const v2keys = await ensureVersionExport(idea.id, 2, 'PROPOSAL')
    r2Keys.push(v2keys.docxKey, v2keys.pdfKey)
    ok('v2 renders to a DIFFERENT key, so v1’s file cannot be overwritten',
      v2keys.pdfKey !== vkeys.pdfKey)

    // And the stored snapshots really differ, which is what the two files mean.
    const s1 = await buildProposalSnapshot(idea.id, 1)
    const s2 = await buildProposalSnapshot(idea.id, 2)
    ok('the two stored snapshots differ', snapshotHash(s1) !== snapshotHash(s2))
    ok('v1’s stored snapshot is UNAFFECTED by every edit since',
      String(s1.fields.find((f) => f.key === 'challenge')?.value).includes('since 2013.') &&
      !String(s1.fields.find((f) => f.key === 'challenge')?.value).includes('recovery has fallen'))
  } finally {
    // ── cleanup, in a finally so a failed assertion still tidies up ──────────
    console.log('\n── cleanup ──')
    let deleted = 0
    for (const key of r2Keys) {
      try { await r2Delete(key); deleted++ } catch { /* already gone */ }
    }
    console.log(`  r2 objects removed: ${deleted}/${r2Keys.length}`)
    // The idea must lose its pin before its versions can go.
    await prisma.idea.update({
      where: { id: idea.id },
      data: { publishedProposalVersionId: null },
    }).catch(() => {})
    await prisma.document.deleteMany({ where: { ideaId: idea.id } }).catch(() => {})
    await prisma.proposalVersion.deleteMany({ where: { ideaId: idea.id } }).catch(() => {})
    await prisma.idea.delete({ where: { id: idea.id } }).catch((e) => console.log('  idea delete:', e.message))
    await prisma.communityMember.deleteMany({ where: { communityId: community.id } }).catch(() => {})
    await prisma.community.delete({ where: { id: community.id } }).catch(() => {})
    await prisma.user.deleteMany({
      where: { id: { in: [owner.id, peer.id, stranger.id] } },
    }).catch((e) => console.log('  user delete:', e.message))
    const leftovers = await prisma.idea.count({ where: { title: { startsWith: TAG } } })
    console.log(`  ideas left tagged "${TAG}": ${leftovers}`)
    await prisma.$disconnect()
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

main().catch(async (e) => {
  console.error('ERROR:', e instanceof Error ? e.message : e)
  await prisma.$disconnect().catch(() => {})
  process.exit(1)
})
