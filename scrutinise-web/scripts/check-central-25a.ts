/**
 * CENTRAL 25-A — the checks for §1, §2, §3c and §6.
 *
 * Run: npm run check:central-25a
 *
 * ⚠ EVERY VALUE ASSERTION HERE READS WHAT THE PAGE READS (docs/CLAUDE.md §25).
 * The statuses come out of `listCommunityPeople`, the refusal comes out of the
 * function the redemption route itself calls, and the sign-in cell comes out of
 * `describeSignIn` — nothing is re-implemented here, because a re-implementation
 * asserts that two pieces of code agree, which they do until one is fixed.
 *
 * ⚠ EVERY VALUE ASSERTION HAS A CONTROL THAT STAYS FALSE, and the control
 * lambda returns whether the PROPERTY holds, not whether some broken text still
 * matches. A control that fires is a bug in this file.
 *
 * Everything it creates is deleted in a `finally`, including on failure, and it
 * asserts its fixtures were fresh before trusting them.
 */
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { prisma } from '../lib/prisma'
import { findInviteCredential, landingFor } from '../lib/invite-gate'
import {
  listCommunityPeople,
  redemptionRefusal,
  inviteIsLive,
  revokeCommunityInvite,
  restoreCommunityInvite,
  markInviteOpened,
} from '../lib/community-invitations'
import { INVITE_STATUS_LABEL, type InviteStatus } from '../lib/invite-status'
import { SIGN_IN_STATE_LABEL, SIGN_IN_STATES } from '../lib/admin-users-labels'
import { describeSignIn, sortAdminUsers, type AdminUserRow } from '../lib/admin-users'
import { acceptOutstandingInvitations } from '../lib/invite-acceptance'
import {
  joinCommunityAndRoot,
  canManageCommunity,
  setMemberRole,
  removeMember,
  leaveCommunity,
  getCommunityMembership,
  getCommunityTree,
  decideJoinRequest,
  listJoinRequests,
} from '../lib/community'
import {
  appointBranchOwner,
  branchIsVacant,
  vacateBranchOwnership,
  archiveMembership,
  canInvite,
  inviteRightFor,
  requestJoinViaInvite,
  listArchivedMemberships,
} from '../lib/community-permissions'
import { INVITE_RIGHT_LABEL } from '../lib/invite-rights'
import { recordReferral } from '../lib/central-points'

let passed = 0
let failed = 0
let controlsFired = 0
let controlsDead = 0
const failures: string[] = []

function assert(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/**
 * A control asserts the same PROPERTY over data where it must NOT hold. If it
 * comes back true the assertion above it is not testing what it claims.
 */
function control(name: string, propertyHolds: boolean) {
  if (propertyHolds) {
    controlsDead++
    failed++
    failures.push(`CONTROL DID NOT FIRE: ${name}`)
    console.log(`  ✗ control did not fire — ${name}`)
  } else {
    controlsFired++
    console.log(`  · control fired — ${name}`)
  }
}

const MARK = randomUUID().slice(0, 8)
const scratch = {
  userIds: [] as string[],
  communityIds: [] as string[],
  platformInviteIds: [] as string[],
}

async function makeUser(label: string, email: string) {
  const u = await prisma.user.create({
    data: {
      clerkId: `check25a_${MARK}_${label}`,
      email,
      firstName: 'Check',
      lastName: `25A ${label}`,
      name: `Check 25A ${label}`,
      username: `check25a_${MARK}_${label}`,
      referralCode: randomUUID(),
    },
    select: { id: true, createdAt: true },
  })
  scratch.userIds.push(u.id)
  return u
}

async function makeInvite(args: {
  communityId: string
  createdByUserId: string
  email?: string
  maxUses?: number
  expiresAt?: Date | null
}) {
  const invite = await prisma.communityInvite.create({
    data: {
      communityId: args.communityId,
      inviteCode: randomUUID().replace(/-/g, ''),
      email: args.email,
      maxUses: args.maxUses ?? 1,
      expiresAt: args.expiresAt ?? undefined,
      createdByUserId: args.createdByUserId,
    },
  })
  return invite
}

/** The one place this file turns a status into the words the panel shows. */
function renderedStatus(status: InviteStatus): string {
  return INVITE_STATUS_LABEL[status]
}

async function main() {
  console.log(`\nCENTRAL 25-A checks (fixture mark ${MARK})\n`)

  // ══ §1 — the sign-up door, as source and as the running site ═════════════
  console.log('§1 — the door a Community invitation leads to')

  // SOURCE properties, and rightly source assertions: which credential each door
  // accepts is decided by one branch on one search param.
  //
  // ⚠ THESE TWO ASSERTED THE DEFECT UNTIL §7a. They read "the sign-up link
  // carries no platform invite token" and "\u002fsign-up refuses without one",
  // which was the FAULT described in §1. They now assert the fix, and the
  // original wording is kept here so the next reader can see the check moved
  // deliberately rather than being quietly relaxed.
  const signUpSrc = readFileSync('app/sign-up/[[...sign-up]]/page.tsx', 'utf8')
  assert(
    '/sign-up still refuses somebody holding no credential at all',
    /if \(!token\) return <InviteOnlyLanding/.test(signUpSrc),
  )
  assert(
    '/sign-up accepts a Community invitation as a credential',
    signUpSrc.includes('communityInvite') && signUpSrc.includes('findInviteCredential'),
  )
  const inviteSrc = readFileSync('app/community-invite/[code]/page.tsx', 'utf8')
  const signUpUrlLines = inviteSrc.split('\n').filter((l) => l.includes('/sign-up?'))
  assert(
    "an addressed Community invitation's sign-up link now hands over that invitation",
    signUpUrlLines.some((l) => l.includes('communityInvite=')),
    signUpUrlLines.join(' | '),
  )
  control(
    'the same test over the old dead link, which must NOT satisfy it',
    ['/sign-up?email_address=x&redirect_url=y'].some((l) => l.includes('communityInvite=')),
  )

  // ══ §2 — the invitation list ═════════════════════════════════════════════
  console.log('\n§2 — invitations, arrivals and members on one page')

  const owner = await makeUser('owner', `check25a+${MARK}+owner@example.invalid`)
  const community = await prisma.community.create({
    data: { name: `Check 25A ${MARK}` },
    select: { id: true },
  })
  scratch.communityIds.push(community.id)
  await prisma.communityMember.create({
    data: { communityId: community.id, userId: owner.id, role: 'OWNER' },
  })

  // ⚠ THE CHECK OWNS ITS DATA (§25.4). Every address below is unique to this
  // run, so nothing here can pass by reusing a live row.
  const addrInvitedOnly = `check25a+${MARK}+noaccount@example.invalid`
  const addrSignedUp = `check25a+${MARK}+signedup@example.invalid`
  const addrJoined = `check25a+${MARK}+joined@example.invalid`
  const addrExpired = `check25a+${MARK}+expired@example.invalid`
  const addrRevoked = `check25a+${MARK}+revoked@example.invalid`
  const addrOpened = `check25a+${MARK}+opened@example.invalid`

  const invited = await makeInvite({ communityId: community.id, createdByUserId: owner.id, email: addrInvitedOnly })
  const signedUpInvite = await makeInvite({ communityId: community.id, createdByUserId: owner.id, email: addrSignedUp })
  const joinedInvite = await makeInvite({ communityId: community.id, createdByUserId: owner.id, email: addrJoined })
  const expiredInvite = await makeInvite({
    communityId: community.id,
    createdByUserId: owner.id,
    email: addrExpired,
    expiresAt: new Date(Date.now() - 86_400_000),
  })
  const revokedInvite = await makeInvite({ communityId: community.id, createdByUserId: owner.id, email: addrRevoked })
  const openedInvite = await makeInvite({ communityId: community.id, createdByUserId: owner.id, email: addrOpened })
  const linkInvite = await makeInvite({ communityId: community.id, createdByUserId: owner.id, maxUses: 50 })

  const signedUpUser = await makeUser('signedup', addrSignedUp)
  const joinedUser = await makeUser('joined', addrJoined)
  await prisma.communityMember.create({
    data: { communityId: community.id, userId: joinedUser.id, role: 'MEMBER' },
  })
  await revokeCommunityInvite(revokedInvite.id, owner.id)
  await markInviteOpened(openedInvite.id)

  // A link arrival, through the real join path's own two writes.
  const linkArrival = await makeUser('arrival', `check25a+${MARK}+arrival@example.invalid`)
  await joinCommunityAndRoot(linkArrival.id, community.id, 'MEMBER')
  await recordReferral({
    communityId: community.id,
    inviterUserId: owner.id,
    inviteeUserId: linkArrival.id,
    inviteId: linkInvite.id,
  })

  const people = await listCommunityPeople(community.id)
  const byEmail = new Map(people.direct.map((d) => [d.email.toLowerCase(), d]))

  const expectations: [string, string, InviteStatus][] = [
    ['no account at all', addrInvitedOnly, 'INVITED'],
    ['an account but no membership', addrSignedUp, 'SIGNED_UP_NOT_JOINED'],
    ['a membership', addrJoined, 'JOINED'],
    ['an expiry in the past', addrExpired, 'EXPIRED'],
    ['a revocation', addrRevoked, 'REVOKED'],
    ['an opened link and no account', addrOpened, 'OPENED'],
  ]
  for (const [label, email, expected] of expectations) {
    const row = byEmail.get(email.toLowerCase())
    assert(
      `an invitation with ${label} renders "${renderedStatus(expected)}"`,
      row?.status === expected,
      `got ${row ? renderedStatus(row.status) : 'no row at all'}`,
    )
  }
  control(
    'the same test asserting the JOINED row renders as never invited',
    byEmail.get(addrJoined.toLowerCase())?.status === 'INVITED',
  )

  // ⚠ THE SIX STATUSES MUST BE DISTINGUISHABLE (§2a). Not "each is correct" —
  // that would pass if two of them rendered the same words.
  const renderedWords = expectations.map(([, , s]) => renderedStatus(s))
  assert(
    'the six statuses render six different sentences',
    new Set(renderedWords).size === renderedWords.length,
    renderedWords.join(' / '),
  )

  // §1's fault, on the row.
  //
  // ⚠⚠ THESE TWO WENT RED WHEN §7a LANDED, BECAUSE THE CODE GOT BETTER. They
  // read "an invitee with no account and no PLATFORM invitation is flagged as
  // unable to sign up" and "issuing a platform invitation clears the flag",
  // which were true all morning: a live Community invitation authorised nothing.
  // §7a made it a credential, so the live row is no longer flagged and the old
  // assertions were asserting the defect. They now test the property under the
  // rule that actually runs — an invitation that no longer authorises an account
  // is flagged, a live one is not — and the wording above records the move so it
  // does not read as a check quietly relaxed.
  assert(
    'a live addressed invitation is NOT flagged: since §7a it is itself the credential',
    byEmail.get(addrInvitedOnly.toLowerCase())?.cannotSignUp === false,
  )
  assert(
    'an invitee with no account whose invitation has EXPIRED is flagged as unable to sign up',
    byEmail.get(addrExpired.toLowerCase())?.cannotSignUp === true,
  )
  const platformInvite = await prisma.invite.create({
    data: {
      email: addrExpired,
      token: randomUUID(),
      invitedBy: 'check25a',
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  })
  scratch.platformInviteIds.push(platformInvite.id)
  const afterPlatformInvite = await listCommunityPeople(community.id)
  assert(
    'and a platform invitation to that same address clears it — the other arm of the gate still counts',
    afterPlatformInvite.direct.find((d) => d.email.toLowerCase() === addrExpired.toLowerCase())
      ?.cannotSignUp === false,
  )
  control(
    'the same test on the revoked invitation, which authorises nothing',
    afterPlatformInvite.direct.find((d) => d.email.toLowerCase() === addrRevoked.toLowerCase())
      ?.cannotSignUp === false,
  )

  // §2b — the arrival, listed separately and attributed to its link.
  assert(
    'someone who came through a shared link is listed as an arrival, not as an invitation',
    people.arrivals.some((a) => a.userId === linkArrival.id) &&
      !people.direct.some((d) => d.email.toLowerCase() === `check25a+${MARK}+arrival@example.invalid`),
  )
  assert(
    'the arrival names the link they came through and what they are now',
    people.arrivals.find((a) => a.userId === linkArrival.id)?.inviteCode === linkInvite.inviteCode &&
      people.arrivals.find((a) => a.userId === linkArrival.id)?.role === 'MEMBER',
  )
  control(
    'the same test over the owner, who arrived through no link',
    people.arrivals.some((a) => a.userId === owner.id),
  )

  // ══ §2d — revoke must PREVENT USE, both directions ═══════════════════════
  console.log('\n§2d — revoke prevents use; a live invitation still works')

  const revokedRow = await prisma.communityInvite.findUniqueOrThrow({ where: { id: revokedInvite.id } })
  const liveRow = await prisma.communityInvite.findUniqueOrThrow({ where: { id: invited.id } })
  assert(
    'the redemption path refuses a revoked invitation, saying it was withdrawn',
    redemptionRefusal(revokedRow)?.error === 'This invitation has been withdrawn',
    JSON.stringify(redemptionRefusal(revokedRow)),
  )
  assert('the redemption path allows a live invitation', redemptionRefusal(liveRow) === null)
  control('the same test claiming the live invitation is refused', redemptionRefusal(liveRow) !== null)

  assert(
    'a withdrawn invitation is refused for being withdrawn, not for having expired',
    redemptionRefusal(revokedRow)?.error !== 'This invite has expired',
  )
  await restoreCommunityInvite(revokedInvite.id)
  const restored = await prisma.communityInvite.findUniqueOrThrow({ where: { id: revokedInvite.id } })
  assert('restoring a revocation makes the invitation usable again', inviteIsLive(restored))
  await revokeCommunityInvite(revokedInvite.id, owner.id)

  // ⚠ The route must not restate the rule — it must call it.
  const joinRouteSrc = readFileSync('app/api/communities/join/route.ts', 'utf8')
  assert(
    'the redemption route calls the shared refusal rather than restating it',
    joinRouteSrc.includes('redemptionRefusal(invite)') &&
      !/if \(invite\.revokedAt\)/.test(joinRouteSrc),
  )

  // ══ §3a — invitation rights are the owner's setting ══════════════
  console.log('\n§3a — who may invite is a setting, not a rule in code')

  // A branch under the Community, with its own manager.
  const branch = await prisma.community.create({
    data: { name: `Check 25A branch ${MARK}`, parentCommunityId: community.id },
    select: { id: true },
  })
  scratch.communityIds.unshift(branch.id)
  const branchManager = await makeUser('bmgr', `check25a+${MARK}+bmgr@example.invalid`)
  await prisma.communityMember.create({
    data: { communityId: community.id, userId: branchManager.id, role: 'MEMBER' },
  })
  await prisma.communityMember.create({
    data: { communityId: branch.id, userId: branchManager.id, role: 'OWNER' },
  })
  const plainMember = await makeUser('plain', `check25a+${MARK}+plain@example.invalid`)
  await prisma.communityMember.create({
    data: { communityId: community.id, userId: plainMember.id, role: 'MEMBER' },
  })

  assert(
    'with no settings row at all, a branch manager may invite — an absent row is not "no rights"',
    await canInvite(branchManager.id, branch.id),
  )
  assert('the owner may invite', await canInvite(owner.id, community.id))
  assert('an ordinary member may not', !(await canInvite(plainMember.id, community.id)))
  control(
    'the same test over the owner, who must never be refused',
    !(await canInvite(owner.id, community.id)),
  )

  // §3d — SCOPE, MEASURED RATHER THAN ASSERTED FROM THE BRIEF.
  //
  // ⚠⚠ CENTRAL 25-C §1c — THIS ASSERTION HAS BEEN MOVED, AND HERE IS THE REASON,
  // RECORDED RATHER THAN THE OLD LINE QUIETLY DELETED.
  //
  // It used to read: "a branch manager's right does NOT reach the Community as a
  // whole", and it passed. **Charlie has reversed the rule it asserted.** A
  // branch manager must be able to bring in ANOTHER BRANCH MANAGER — somebody
  // who will run a different branch — and that cannot be done from inside one
  // branch, because the person being brought in does not belong in the branch
  // doing the inviting. In a party that grows by chairs recruiting chairs, the
  // old rule stopped the growth mechanic dead. It reverses my own §3d
  // recommendation, deliberately, and Charlie took the decision.
  //
  // What the assertion now says is the new rule, in the same place, so that the
  // reversal is visible in the diff of the check and not only in the code.
  const managerAtRoot = await inviteRightFor(branchManager.id, community.id)
  assert(
    "25-C §1c — a branch manager's right DOES now reach the Community, so a chair can recruit another chair",
    managerAtRoot.allowed === true && managerAtRoot.reason === 'BRANCH_MANAGER',
    `allowed=${managerAtRoot.allowed} reason=${managerAtRoot.reason}`,
  )
  control(
    'the same test over a plain member, whose membership must NOT reach the Community',
    (await inviteRightFor(plainMember.id, community.id)).allowed,
  )
  const sibling = await prisma.community.create({
    data: { name: `Check 25A sibling ${MARK}`, parentCommunityId: community.id },
    select: { id: true },
  })
  scratch.communityIds.unshift(sibling.id)
  assert(
    "nor somebody else's branch",
    !(await canInvite(branchManager.id, sibling.id)),
  )
  assert(
    'a Community admin\'s right DOES reach a branch',
    await canInvite(owner.id, branch.id),
  )

  // Now narrow the setting, and watch the same person lose the right.
  await prisma.communitySettings.upsert({
    where: { communityId: community.id },
    create: { communityId: community.id, inviteRights: ['COMMUNITY_ADMIN'] },
    update: { inviteRights: ['COMMUNITY_ADMIN'] },
  })
  const narrowed = await inviteRightFor(branchManager.id, branch.id)
  assert(
    `taking "${INVITE_RIGHT_LABEL.BRANCH_MANAGER}" off the setting stops that branch manager inviting`,
    narrowed.allowed === false && narrowed.reason === 'NOT_GRANTED',
    `allowed=${narrowed.allowed} reason=${narrowed.reason}`,
  )
  assert(
    'and the refusal says the right was not granted, not that they are a stranger',
    narrowed.reason !== 'NO_STANDING',
  )
  assert('the owner still may', await canInvite(owner.id, branch.id))
  control(
    'the same test claiming the narrowed branch manager may still invite',
    (await inviteRightFor(branchManager.id, branch.id)).allowed,
  )
  await prisma.communitySettings.update({
    where: { communityId: community.id },
    data: { inviteRights: ['COMMUNITY_ADMIN', 'BRANCH_MANAGER'] },
  })

  // ══ §3b — a link asks; it does not admit ═════════════════════
  console.log('\n§3b — arriving through a link waits for a decision')

  const walkIn = await makeUser('walkin', `check25a+${MARK}+walkin@example.invalid`)
  const { requestId } = await requestJoinViaInvite(walkIn.id, {
    id: linkInvite.id,
    communityId: community.id,
  })
  assert(
    'somebody who arrives through a link is NOT a member',
    (await getCommunityMembership(walkIn.id, community.id)) === null,
  )
  const waiting = await listJoinRequests(community.id)
  assert(
    'they appear on the requests list, marked as having come through a link',
    waiting.some((r) => r.userId === walkIn.id && r.inviteId === linkInvite.id),
  )
  control(
    'the same test asserting they are already a member',
    (await getCommunityMembership(walkIn.id, community.id)) !== null,
  )

  const refusedDecide = await decideJoinRequest(requestId, owner.id, 'APPROVED')
    .then(() => null)
    .catch((e) => e as Error)
  assert(
    'the owner can approve them',
    refusedDecide === null,
    refusedDecide?.message ?? '',
  )
  assert(
    'and once approved they ARE a member',
    (await getCommunityMembership(walkIn.id, community.id)) !== null,
  )
  assert(
    'the link they came through is only counted as used at that point',
    (await prisma.communityInvite.findUniqueOrThrow({ where: { id: linkInvite.id } })).usedCount >= 1,
  )

  // A second walk-in, decided by somebody WITHOUT the right.
  await prisma.communitySettings.update({
    where: { communityId: community.id },
    data: { inviteRights: [] },
  })
  const walkIn2 = await makeUser('walkin2', `check25a+${MARK}+walkin2@example.invalid`)
  const second = await requestJoinViaInvite(walkIn2.id, {
    id: linkInvite.id,
    communityId: community.id,
  })
  // The branch manager holds manage rights on the Community? No — use a
  // Community ADMIN, who has manage rights and has just lost the invite right.
  const deputy = await makeUser('deputy', `check25a+${MARK}+deputy@example.invalid`)
  await prisma.communityMember.create({
    data: { communityId: community.id, userId: deputy.id, role: 'ADMIN' },
  })
  const deniedErr = await decideJoinRequest(second.requestId, deputy.id, 'APPROVED')
    .then(() => null)
    .catch((e) => e as Error)
  assert(
    'an admin whose role has NOT been given the invitation right cannot let a link arrival in',
    deniedErr !== null,
    deniedErr?.message ?? 'no error thrown',
  )
  assert(
    'and that person is still not a member',
    (await getCommunityMembership(walkIn2.id, community.id)) === null,
  )
  await prisma.communitySettings.update({
    where: { communityId: community.id },
    data: { inviteRights: ['COMMUNITY_ADMIN', 'BRANCH_MANAGER'] },
  })
  const nowAllowed = await decideJoinRequest(second.requestId, deputy.id, 'APPROVED')
    .then(() => null)
    .catch((e) => e as Error)
  assert(
    'give the right back and the same admin can let them in',
    nowAllowed === null && (await getCommunityMembership(walkIn2.id, community.id)) !== null,
    nowAllowed?.message ?? '',
  )

  // ══ §3c — removal archives, contributions stay, nothing cascades ════
  console.log('\n§3c — removal archives the membership and keeps the writing')

  const beforeRemoval = await getCommunityMembership(linkArrival.id, community.id)
  assert('the invitee is a member before the inviter is removed', beforeRemoval !== null)

  // The owner cannot be removed, so the measurement uses the branch manager who
  // did the inviting — the case Charlie actually asked about.
  const manager = await makeUser('manager', `check25a+${MARK}+manager@example.invalid`)
  await prisma.communityMember.create({
    data: { communityId: community.id, userId: manager.id, role: 'ADMIN' },
  })
  const managerInvite = await makeInvite({
    communityId: community.id,
    createdByUserId: manager.id,
    maxUses: 50,
  })
  const theirInvitee = await makeUser('invitee', `check25a+${MARK}+invitee@example.invalid`)
  await joinCommunityAndRoot(theirInvitee.id, community.id, 'MEMBER')
  await recordReferral({
    communityId: community.id,
    inviterUserId: manager.id,
    inviteeUserId: theirInvitee.id,
    inviteId: managerInvite.id,
  })
  assert(
    'the person the branch manager invited is a member before he is removed',
    (await getCommunityMembership(theirInvitee.id, community.id)) !== null,
  )

  // Something they wrote, so "the contributions stay" is measured and not assumed.
  const post = await prisma.bulletinPost.create({
    data: {
      communityId: community.id,
      authorId: manager.id,
      title: `Check 25A post ${MARK}`,
      body: 'Written before removal.',
      category: 'Questions',
      scope: 'COMMUNITY',
    },
    select: { id: true },
  })

  await archiveMembership(community.id, manager.id, owner.id, 'Left the branch')

  assert(
    'the branch manager is gone from the members',
    (await getCommunityMembership(manager.id, community.id)) === null,
  )
  const archived = await listArchivedMemberships(community.id)
  const theirs = archived.find((a) => a.userId === manager.id)
  assert(
    'the membership is ARCHIVED, not deleted — with the role, the join date and who removed them',
    Boolean(theirs) && theirs?.role === 'ADMIN' && theirs?.removedByName !== null,
    JSON.stringify(theirs),
  )
  assert('and the reason given is kept', theirs?.reason === 'Left the branch')
  control(
    'the same test over somebody who was never removed',
    archived.some((a) => a.userId === owner.id),
  )

  // ⚠ The re-read: the row is fetched again, not trusted from the write.
  const postAfter = await prisma.bulletinPost.findUnique({
    where: { id: post.id },
    select: { id: true, authorId: true, deletedAt: true },
  })
  assert(
    'what they wrote is still there, still theirs',
    postAfter?.authorId === manager.id && postAfter?.deletedAt === null,
    JSON.stringify(postAfter),
  )
  control(
    'the same test claiming the post was deleted',
    postAfter === null || postAfter.deletedAt !== null,
  )

  assert(
    'the person they invited is STILL a member — membership does not cascade from the inviter',
    (await getCommunityMembership(theirInvitee.id, community.id)) !== null,
  )
  const tree = await getCommunityTree(community.id, theirInvitee.id)
  assert(
    'and the Teams tree still shows them as a member of the node',
    tree.members.some((m) => m.userId === theirInvitee.id) && tree.viewerRole !== null,
  )
  control(
    'the same test over the removed branch manager, who must NOT still show as a member',
    tree.members.some((m) => m.userId === manager.id),
  )

  const stillInvited = await listCommunityPeople(community.id)
  assert(
    'the invitations he sent survive his removal and are still listed',
    stillInvited.links.some((l) => l.inviteId === managerInvite.id),
  )
  assert(
    'and he is listed under the people who are no longer in the team',
    stillInvited.removed.some((r) => r.userId === manager.id),
  )

  // ══ §7a/§7b — one invitation, one account, and the gate that deletes ══
  console.log('\n§7a/§7b — the two doors ask one question')

  // ⚠⚠ §7b DEMANDS BOTH DIRECTIONS. Every case below runs through
  // `findInviteCredential`, which is the function the sign-up page AND the Clerk
  // webhook both call — so this asserts the rule that actually decides whether
  // somebody's account survives, not a restatement of it.
  const gateComm = `check25a+${MARK}+gate-comm@example.invalid`
  const gatePlat = `check25a+${MARK}+gate-plat@example.invalid`
  const gateNone = `check25a+${MARK}+gate-none@example.invalid`
  const gateDead = `check25a+${MARK}+gate-dead@example.invalid`

  const commCred = await makeInvite({
    communityId: community.id,
    createdByUserId: owner.id,
    email: gateComm,
    expiresAt: new Date(Date.now() + 86_400_000),
  })
  const deadCred = await makeInvite({
    communityId: community.id,
    createdByUserId: owner.id,
    email: gateDead,
    expiresAt: new Date(Date.now() + 86_400_000),
  })
  const platCred = await prisma.invite.create({
    data: {
      email: gatePlat,
      token: randomUUID(),
      invitedBy: 'check25a',
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  })
  scratch.platformInviteIds.push(platCred.id)

  assert(
    'somebody holding a COMMUNITY invitation may create an account',
    (await findInviteCredential(gateComm))?.kind === 'COMMUNITY',
  )
  assert(
    'somebody holding a PLATFORM invitation still may',
    (await findInviteCredential(gatePlat))?.kind === 'PLATFORM',
  )
  assert(
    'somebody holding NEITHER is still stopped',
    (await findInviteCredential(gateNone)) === null,
  )
  control(
    'the same test over the person who holds a Community invitation',
    (await findInviteCredential(gateComm)) === null,
  )

  // The three ways an addressed invitation stops being a credential.
  await revokeCommunityInvite(deadCred.id, owner.id)
  assert(
    'a WITHDRAWN Community invitation is no longer a credential',
    (await findInviteCredential(gateDead)) === null,
  )
  await restoreCommunityInvite(deadCred.id)
  assert(
    'restoring it makes it one again',
    (await findInviteCredential(gateDead))?.kind === 'COMMUNITY',
  )
  await prisma.communityInvite.update({
    where: { id: deadCred.id },
    data: { expiresAt: new Date(Date.now() - 1000) },
  })
  assert(
    'an EXPIRED one is not a credential',
    (await findInviteCredential(gateDead)) === null,
  )
  await prisma.communityInvite.update({
    where: { id: deadCred.id },
    data: { expiresAt: new Date(Date.now() + 86_400_000), usedCount: 1, maxUses: 1 },
  })
  assert(
    'nor is one that has been used up',
    (await findInviteCredential(gateDead)) === null,
  )

  // ⚠⚠ THE ONE THAT WOULD OPEN THE PLATFORM. A shared link names nobody, so it
  // must authorise nobody — otherwise one link in a group chat is open account
  // creation.
  assert(
    'a SHARED LINK authorises no address at all',
    (await findInviteCredential(`check25a+${MARK}+stranger@example.invalid`)) === null,
  )
  const anyLinkExists = await prisma.communityInvite.count({
    where: { communityId: community.id, email: null },
  })
  assert(
    'and that is asserted while a live shared link for this community exists',
    anyLinkExists > 0,
  )

  assert(
    'a Community credential is NOT spent by signing up — it is spent by joining',
    (await findInviteCredential(gateComm))?.consumeOnSignUp === false,
  )
  assert(
    'a platform credential IS spent by signing up',
    (await findInviteCredential(gatePlat))?.consumeOnSignUp === true,
  )
  const commCredential = await findInviteCredential(gateComm)
  assert(
    'and they land back on the invitation they came from, not on a bare dashboard',
    commCredential !== null && landingFor(commCredential) === `/community-invite/${commCred.inviteCode}`,
    commCredential ? landingFor(commCredential) : 'no credential',
  )

  // ⚠ THE THIRD DOOR. `getAuthenticatedUser` creates a User row for a Clerk
  // session that has none, and used to do it with no invitation check at all —
  // so the gate was enforced in one of three places.
  const authSrc = readFileSync('lib/auth.ts', 'utf8')
  assert(
    'the just-in-time user sync asks the same gate before creating an account',
    authSrc.includes('canCreateAccount(primaryEmail)'),
  )

  // §7b as a SOURCE property: the webhook must not keep a rule of its own.
  const webhookSrc = readFileSync('app/api/webhooks/clerk/route.ts', 'utf8')
  assert(
    'the account-deleting webhook asks the shared gate rather than reading the invite table itself',
    webhookSrc.includes('findInviteCredential(primaryEmail') &&
      !/const invite = await prisma\.invite\.findUnique/.test(webhookSrc),
  )
  assert(
    'and it still deletes an account that holds nothing',
    /if \(!credential\) \{[\s\S]{0,200}deleteClerkUser/.test(webhookSrc),
  )

  // ⚠ The owner's list must not go on saying "cannot create an account" about
  // people who now can — it has to ask the same gate.
  const afterGate = await listCommunityPeople(community.id)
  const liveRowNow = afterGate.direct.find((d) => d.email.toLowerCase() === gateComm)
  assert(
    'the owner\'s list no longer flags a live addressed invitation as unable to sign up',
    liveRowNow?.cannotSignUp === false,
  )
  const deadRowNow = afterGate.direct.find((d) => d.email.toLowerCase() === gateDead)
  assert(
    'but it does flag one whose invitation is used up',
    deadRowNow?.cannotSignUp === true,
  )
  control(
    'the same test over the live invitation, which must NOT be flagged',
    afterGate.direct.find((d) => d.email.toLowerCase() === gateComm)?.cannotSignUp === true,
  )

  // ══ §7e — a title is a Community's word, never a platform role ═════
  console.log('\n§7e — titles grant rights inside one Community and nowhere else')

  const titled = await makeUser('titled', `check25a+${MARK}+titled@example.invalid`)
  await prisma.communityMember.create({
    data: { communityId: community.id, userId: titled.id, role: 'MEMBER' },
  })
  await prisma.communityMember.create({
    data: { communityId: branch.id, userId: titled.id, role: 'MEMBER' },
  })
  assert(
    'an ordinary member of a branch cannot invite',
    !(await canInvite(titled.id, branch.id)),
  )

  const chairTitle = await prisma.communityTitle.create({
    data: { communityId: community.id, name: `Branch Chair ${MARK}`, grantsInvite: true },
    select: { id: true },
  })
  const plainTitle = await prisma.communityTitle.create({
    data: { communityId: community.id, name: `Newsletter Editor ${MARK}`, grantsInvite: false },
    select: { id: true },
  })
  await prisma.communityMember.update({
    where: { communityId_userId: { communityId: branch.id, userId: titled.id } },
    data: { titleId: chairTitle.id },
  })

  const byTitle = await inviteRightFor(titled.id, branch.id)
  assert(
    'giving them a title that carries the right lets them invite to their own branch',
    byTitle.allowed && byTitle.reason === 'TITLE',
    `allowed=${byTitle.allowed} reason=${byTitle.reason}`,
  )
  control(
    'the same test before any title was given — over a member who has none',
    (await inviteRightFor(plainMember.id, branch.id)).allowed,
  )
  assert(
    "— and NOT to somebody else's branch",
    !(await canInvite(titled.id, sibling.id)),
  )

  // ⚠⚠ THE LINE THAT MUST NOT BE CROSSED. A title is a Community's own word.
  const platformRole = await prisma.user.findUniqueOrThrow({
    where: { id: titled.id },
    select: { role: true },
  })
  assert(
    'and their PLATFORM role is untouched — still an ordinary member of Scrutinise',
    platformRole.role === 'CITIZEN',
    platformRole.role,
  )
  const titlesSrc = readFileSync('app/api/communities/[id]/titles/route.ts', 'utf8')
  assert(
    'nothing in the titles route can write a platform role',
    !/user\.update|role:\s*'(ADMIN|SUPER_ADMIN|MODERATOR)'/.test(titlesSrc),
  )

  await prisma.communityMember.update({
    where: { communityId_userId: { communityId: branch.id, userId: titled.id } },
    data: { titleId: plainTitle.id },
  })
  assert(
    'a title that carries no right grants none — it is a name, not a permission',
    !(await canInvite(titled.id, branch.id)),
  )
  await prisma.communityMember.update({
    where: { communityId_userId: { communityId: branch.id, userId: titled.id } },
    data: { titleId: null },
  })

  // ══ §7h — who brought whom, and it survives a removal ═════════════
  console.log('\n§7h — the record of who brought whom cannot be destroyed by a removal')

  const chair = await makeUser('chair2', `check25a+${MARK}+chair2@example.invalid`)
  await prisma.communityMember.create({
    data: { communityId: community.id, userId: chair.id, role: 'ADMIN' },
  })
  const chairsInvite = await makeInvite({
    communityId: branch.id,
    createdByUserId: chair.id,
    maxUses: 50,
  })
  const brought = await makeUser('brought', `check25a+${MARK}+brought@example.invalid`)
  await joinCommunityAndRoot(brought.id, branch.id, 'MEMBER', {
    invitedByUserId: chair.id,
    invitedViaInviteId: chairsInvite.id,
  })

  const branchRow = await prisma.communityMember.findUniqueOrThrow({
    where: { communityId_userId: { communityId: branch.id, userId: brought.id } },
    select: { invitedByUserId: true, invitedViaInviteId: true },
  })
  assert(
    'the membership records who brought them in and through which invitation',
    branchRow.invitedByUserId === chair.id && branchRow.invitedViaInviteId === chairsInvite.id,
    JSON.stringify(branchRow),
  )
  const rootRow = await prisma.communityMember.findUniqueOrThrow({
    where: { communityId_userId: { communityId: community.id, userId: brought.id } },
    select: { invitedByUserId: true },
  })
  assert(
    'and so does the Community membership that came with it',
    rootRow.invitedByUserId === chair.id,
  )
  control(
    'the same test over somebody who joined without an invitation',
    (
      await prisma.communityMember.findUniqueOrThrow({
        where: { communityId_userId: { communityId: community.id, userId: plainMember.id } },
        select: { invitedByUserId: true },
      })
    ).invitedByUserId !== null,
  )

  // ⚠ NOW REMOVE THE CHAIR — the point of §7h.
  await archiveMembership(community.id, chair.id, owner.id, 'Stood down')

  const afterChairGone = await prisma.communityMember.findUniqueOrThrow({
    where: { communityId_userId: { communityId: branch.id, userId: brought.id } },
    select: { invitedByUserId: true, invitedViaInviteId: true },
  })
  assert(
    'removing the chair does NOT erase who he brought in',
    afterChairGone.invitedByUserId === chair.id &&
      afterChairGone.invitedViaInviteId === chairsInvite.id,
    JSON.stringify(afterChairGone),
  )
  assert(
    'and the person he brought in is still a member',
    (await getCommunityMembership(brought.id, branch.id)) !== null,
  )
  control(
    'the same test claiming the link was cleared',
    afterChairGone.invitedByUserId === null,
  )

  // And the other direction: remove the person who WAS brought in.
  await archiveMembership(branch.id, brought.id, owner.id)
  const archivedBrought = (await listArchivedMemberships(branch.id)).find(
    (a) => a.userId === brought.id,
  )
  assert(
    'and removing THEM keeps the record too — the archive carries who brought them in',
    archivedBrought?.invitedByName !== null && archivedBrought?.invitedByName !== undefined,
    JSON.stringify(archivedBrought),
  )

  // §7g — what a branch chair can see, on the surface they actually read.
  const membersRoute = readFileSync('app/api/communities/[id]/members/route.ts', 'utf8')
  assert(
    "the members list a branch chair reads carries who invited each person",
    membersRoute.includes('invitedByName'),
  )
  const membersPanel = readFileSync('app/communities/[id]/MembersPanel.tsx', 'utf8')
  assert(
    'and the panel renders it, saying so in words when nobody did',
    membersPanel.includes('invitedByName') &&
      membersPanel.includes('Joined without an invitation'),
  )

  // ══ §7i — a branch chair's control stops at their own branch ═══════
  console.log('\n§7i — full control of their own branch, and of nothing else')

  const chairOfBranch = await makeUser('bchair', `check25a+${MARK}+bchair@example.invalid`)
  await prisma.communityMember.create({
    data: { communityId: community.id, userId: chairOfBranch.id, role: 'MEMBER' },
  })
  await prisma.communityMember.create({
    data: { communityId: branch.id, userId: chairOfBranch.id, role: 'ADMIN' },
  })

  const inTheirBranch = await makeUser('inbranch', `check25a+${MARK}+inbranch@example.invalid`)
  await joinCommunityAndRoot(inTheirBranch.id, branch.id, 'MEMBER', {
    invitedByUserId: chairOfBranch.id,
  })
  const inOtherBranch = await makeUser('insibling', `check25a+${MARK}+insibling@example.invalid`)
  await joinCommunityAndRoot(inOtherBranch.id, sibling.id, 'MEMBER')

  assert(
    'a branch chair may manage their own branch',
    await canManageCommunity(chairOfBranch.id, branch.id),
  )
  // ⚠ THE THREE NEGATIVES, ASSERTED RATHER THAN ASSUMED.
  assert(
    "— and NOT somebody else's branch",
    !(await canManageCommunity(chairOfBranch.id, sibling.id)),
  )
  assert(
    '— and NOT the Community itself',
    !(await canManageCommunity(chairOfBranch.id, community.id)),
  )
  control(
    'the same test over the Community owner, who may manage all three',
    !(
      (await canManageCommunity(owner.id, branch.id)) &&
      (await canManageCommunity(owner.id, sibling.id)) &&
      (await canManageCommunity(owner.id, community.id))
    ),
  )

  // ⚠ NOBODY IN THE COMMUNITY CODE CAN REMOVE ANYBODY FROM THE PLATFORM.
  // A source property, and rightly a source assertion: the claim is that no
  // such path EXISTS, which is not a thing a value can show.
  const communityWritePaths = [
    'lib/community.ts',
    'lib/community-permissions.ts',
    'app/api/communities/[id]/members/[userId]/route.ts',
  ]
  const platformDeletes = communityWritePaths.filter((f) => {
    const src = readFileSync(f, 'utf8')
    // The comments in these files discuss deletion at length, so the comments
    // are stripped before the search — an absence assertion that reads its own
    // explanation is the failure mode this exact check class has hit before.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    return /prisma\.user\.delete|users\.deleteUser|user\.deleteMany/.test(code)
  })
  assert(
    'no Community code path can delete a platform account',
    platformDeletes.length === 0,
    platformDeletes.join(', '),
  )
  control(
    'the same test over the webhook, which CAN delete a Clerk account',
    !/users\.deleteUser/.test(
      readFileSync('app/api/webhooks/clerk/route.ts', 'utf8').replace(/\/\/.*$/gm, ''),
    ),
  )

  // Ejecting from their own branch: archives, keeps the writing, and leaves
  // every other membership alone.
  const theirPost = await prisma.bulletinPost.create({
    data: {
      communityId: branch.id,
      authorId: inTheirBranch.id,
      title: `Check 25A branch post ${MARK}`,
      body: 'Written before being ejected.',
      category: 'Questions',
      scope: 'BRANCH',
    },
    select: { id: true },
  })
  await archiveMembership(branch.id, inTheirBranch.id, chairOfBranch.id, 'Moved away')

  assert(
    'ejecting from the branch removes them from it',
    (await getCommunityMembership(inTheirBranch.id, branch.id)) === null,
  )
  assert(
    '⚠ and does NOT remove them from the Community',
    (await getCommunityMembership(inTheirBranch.id, community.id)) !== null,
  )
  assert(
    'their writing stays, attributed to them',
    (
      await prisma.bulletinPost.findUnique({
        where: { id: theirPost.id },
        select: { authorId: true, deletedAt: true },
      })
    )?.authorId === inTheirBranch.id,
  )
  const ejected = (await listArchivedMemberships(branch.id)).find(
    (a) => a.userId === inTheirBranch.id,
  )
  assert(
    'and the ejection is archived with who did it and why',
    ejected?.reason === 'Moved away' && ejected?.removedByName !== null,
    JSON.stringify(ejected),
  )
  assert(
    'the person in the OTHER branch is untouched',
    (await getCommunityMembership(inOtherBranch.id, sibling.id)) !== null,
  )
  assert(
    'and their platform account still exists — ejection is not deletion',
    (await prisma.user.findUnique({ where: { id: inTheirBranch.id }, select: { id: true } })) !== null,
  )

  // ══ §7c/§7j — the invitation is accepted for them, once ══════════
  console.log('\n§7c/§7j — accepting an invitation on somebody\'s behalf')

  const stuck = await makeUser('stuck', `check25a+${MARK}+stuck@example.invalid`)
  const stuckInvite = await makeInvite({
    communityId: branch.id,
    createdByUserId: chairOfBranch.id,
    email: `check25a+${MARK}+stuck@example.invalid`,
    expiresAt: new Date(Date.now() + 86_400_000),
  })
  assert(
    'before the sweep they hold an invitation and no membership — the state §7j exists for',
    (await getCommunityMembership(stuck.id, branch.id)) === null,
  )

  const dry = await acceptOutstandingInvitations({
    dryRun: true,
    onlyEmail: `check25a+${MARK}+stuck@example.invalid`,
  })
  assert(
    'the list names the person, the invitation and what would be created',
    dry.planned.length === 1 &&
      dry.planned[0].userId === stuck.id &&
      dry.planned[0].communityId === branch.id &&
      dry.planned[0].effect.includes('branch'),
    JSON.stringify(dry.planned),
  )
  assert(
    '⚠ and the list WROTE NOTHING',
    (await getCommunityMembership(stuck.id, branch.id)) === null,
  )
  control(
    'the same test claiming the dry run created the membership',
    (await getCommunityMembership(stuck.id, branch.id)) !== null,
  )

  const real = await acceptOutstandingInvitations({
    dryRun: false,
    onlyEmail: `check25a+${MARK}+stuck@example.invalid`,
  })
  assert(
    'running it creates the branch membership, re-read from the database',
    real.created.length === 1 && real.created[0].communityId === branch.id,
    JSON.stringify(real.created),
  )
  assert(
    'the membership records that it was accepted on their behalf, not clicked',
    real.created[0]?.acceptedOnBehalf === true,
  )
  assert(
    '§7h — and it still names who invited them',
    real.created[0]?.invitedByName !== null,
  )
  assert(
    'the Community membership comes with it, as a branch join always does',
    (await getCommunityMembership(stuck.id, community.id)) !== null,
  )
  assert(
    '⚠ THE INVITATION IS SPENT — a live one could be redeemed again by anyone with the link',
    !inviteIsLive(await prisma.communityInvite.findUniqueOrThrow({ where: { id: stuckInvite.id } })),
  )
  control(
    'the same test before it was consumed — over an invitation nobody has used',
    !inviteIsLive(await prisma.communityInvite.findUniqueOrThrow({ where: { id: invited.id } })),
  )

  const again = await acceptOutstandingInvitations({
    dryRun: true,
    onlyEmail: `check25a+${MARK}+stuck@example.invalid`,
  })
  assert(
    'running it twice does nothing the second time',
    again.planned.length === 0,
    JSON.stringify(again.planned),
  )

  // ⚠ AMBIGUITY IS REPORTED, NOT RESOLVED.
  const twiceInvited = await makeUser('twice', `check25a+${MARK}+twice@example.invalid`)
  await makeInvite({
    communityId: sibling.id,
    createdByUserId: owner.id,
    email: `check25a+${MARK}+twice@example.invalid`,
    expiresAt: new Date(Date.now() + 86_400_000),
  })
  await makeInvite({
    communityId: sibling.id,
    createdByUserId: chairOfBranch.id,
    email: `check25a+${MARK}+twice@example.invalid`,
    expiresAt: new Date(Date.now() + 86_400_000),
  })
  const ambiguousRun = await acceptOutstandingInvitations({
    dryRun: false,
    onlyEmail: `check25a+${MARK}+twice@example.invalid`,
  })
  assert(
    'two live invitations to one node for one address are reported as ambiguous',
    ambiguousRun.ambiguous.length === 1,
    JSON.stringify(ambiguousRun.ambiguous),
  )
  assert(
    '⚠ and NOTHING was written for them — granting the wrong person access is not undoable',
    ambiguousRun.created.length === 0 &&
      (await getCommunityMembership(twiceInvited.id, sibling.id)) === null,
  )
  control(
    'the same test claiming the ambiguous person was admitted',
    (await getCommunityMembership(twiceInvited.id, sibling.id)) !== null,
  )

  // §7c — the sweep and the first-sign-in path are ONE mechanism, not two.
  const webhookSrc7c = readFileSync('app/api/webhooks/clerk/route.ts', 'utf8')
  const sweepSrc = readFileSync('scripts/accept-outstanding-invitations.ts', 'utf8')
  assert(
    'first sign-in and the backlog sweep call the same function',
    webhookSrc7c.includes('acceptInvitationsAtSignIn') &&
      sweepSrc.includes('acceptOutstandingInvitations') &&
      !/prisma\.communityMember\.create/.test(sweepSrc),
  )

  // ══ 25-B §5 — branch ownership is transferable and vacatable ════════
  console.log('\n25-B §5 — standing a branch manager down, and appointing one')

  // ⚠ ITS OWN BRANCH. The first version reused the §3a branch, which already had
  // an OWNER — so `joinCommunityAndRoot(…, 'OWNER')` quietly added a SECOND one,
  // the vacate demoted whichever `findFirst` returned, and the fixture read as
  // "they already manage this branch". Nothing in the schema forbids two owners,
  // which is exactly why `appointBranchOwner` demotes in the same transaction.
  const ownBranch = await prisma.community.create({
    data: { name: `Check 25A ownership ${MARK}`, parentCommunityId: community.id },
    select: { id: true },
  })
  scratch.communityIds.unshift(ownBranch.id)

  const founder = await makeUser('founder', `check25a+${MARK}+founder@example.invalid`)
  const successor = await makeUser('successor', `check25a+${MARK}+successor@example.invalid`)
  const bystander = await makeUser('bystander', `check25a+${MARK}+bystander@example.invalid`)
  await joinCommunityAndRoot(founder.id, ownBranch.id, 'OWNER')
  await joinCommunityAndRoot(successor.id, ownBranch.id, 'MEMBER')
  await joinCommunityAndRoot(bystander.id, sibling.id, 'MEMBER')
  assert(
    'the fixture branch has exactly one manager to begin with',
    (await prisma.communityMember.count({ where: { communityId: ownBranch.id, role: 'OWNER' } })) === 1,
  )

  assert(
    'the branch has a manager to begin with',
    !(await branchIsVacant(ownBranch.id)),
  )

  // ⚠ A REASON IS REQUIRED (decision 51).
  const noReason = await vacateBranchOwnership({
    communityId: ownBranch.id,
    actorUserId: owner.id,
    reason: '   ',
  })
    .then(() => null)
    .catch((e) => e as Error)
  assert('a vacate with no reason is refused', noReason !== null, noReason?.message ?? 'not refused')

  // ⚠ THE ROOT IS NOT VACATABLE.
  const rootVacate = await vacateBranchOwnership({
    communityId: community.id,
    actorUserId: owner.id,
    reason: 'trying to empty the Community',
  })
    .then(() => null)
    .catch((e) => e as Error)
  assert(
    'the Community itself cannot be left without an owner',
    rootVacate !== null,
    rootVacate?.message ?? 'not refused',
  )
  assert(
    'and the Community still has its owner',
    !(await branchIsVacant(community.id)),
  )

  // ⚠ Somebody with no standing cannot change who manages a branch.
  const stranger = await vacateBranchOwnership({
    communityId: ownBranch.id,
    actorUserId: bystander.id,
    reason: 'not mine to decide',
  })
    .then(() => null)
    .catch((e) => e as Error)
  assert(
    'a member of another branch cannot stand this one\'s manager down',
    stranger !== null,
    stranger?.message ?? 'not refused',
  )
  control(
    'the same test over the Community owner, who may',
    (await vacateBranchOwnership({ communityId: ownBranch.id, actorUserId: owner.id, reason: 'probe' })
      .then(() => null)
      .catch((e) => e as Error)) !== null,
  )
  // the control above actually vacated it — put it back for the real assertions
  await appointBranchOwner({
    communityId: ownBranch.id,
    targetUserId: founder.id,
    actorUserId: owner.id,
    reason: 'restoring the fixture',
  })

  // ⚠⚠ DECISION 50 — an admin may stand a manager down WITHOUT their agreement.
  await vacateBranchOwnership({
    communityId: ownBranch.id,
    actorUserId: owner.id,
    reason: 'Stood down by the Community, no agreement sought',
  })
  assert(
    'a Community admin can stand a branch manager down without their agreement',
    await branchIsVacant(ownBranch.id),
  )
  assert(
    '⚠ §5a — and they remain an ordinary MEMBER of the branch, not removed from it',
    (await getCommunityMembership(founder.id, ownBranch.id))?.role === 'MEMBER',
  )
  assert(
    '§5b — the branch is not deleted and does not change hands',
    (await prisma.community.findUnique({ where: { id: ownBranch.id }, select: { deletedAt: true } }))
      ?.deletedAt === null,
  )
  assert(
    'the manager pointer does not outlive the role',
    (await prisma.community.findUniqueOrThrow({ where: { id: ownBranch.id }, select: { managerId: true } }))
      .managerId === null,
  )
  control(
    'the same test claiming the branch still has a manager',
    !(await branchIsVacant(ownBranch.id)),
  )

  // ⚠ The reason is recorded — decision 51's whole point.
  const vacateLog = await prisma.activityLog.findFirst({
    where: { entityType: 'Community', entityId: ownBranch.id, activityType: 'BRANCH_OWNERSHIP_VACATED' },
    orderBy: { createdAt: 'desc' },
    select: { description: true, metadata: true },
  })
  assert(
    'the reason it was vacated is recorded',
    Boolean(vacateLog) && vacateLog!.description.includes('no agreement sought'),
    vacateLog?.description ?? 'no log row',
  )

  // ⚠ A vacant branch is still manageable from above — §5b's whole premise.
  assert(
    'a vacant branch is still manageable by the Community',
    await canManageCommunity(owner.id, ownBranch.id),
  )

  // §5e-adjacent: appointing transfers, and the incumbent is demoted with it.
  await appointBranchOwner({
    communityId: ownBranch.id,
    targetUserId: successor.id,
    actorUserId: owner.id,
    reason: 'Elected at the branch AGM',
  })
  assert(
    'appointing somebody makes them the branch manager',
    (await getCommunityMembership(successor.id, ownBranch.id))?.role === 'OWNER',
  )
  assert(
    'the branch is no longer vacant',
    !(await branchIsVacant(ownBranch.id)),
  )
  assert(
    '⚠ and there is exactly ONE manager — an incumbent is demoted in the same transaction',
    (await prisma.communityMember.count({ where: { communityId: ownBranch.id, role: 'OWNER' } })) === 1,
  )
  control(
    'the same test over a node where two owners would be tolerated',
    (await prisma.communityMember.count({ where: { communityId: ownBranch.id, role: 'OWNER' } })) !== 1,
  )
  assert(
    'appointing a non-member is refused — a manager has to be in the branch',
    (await appointBranchOwner({
      communityId: ownBranch.id,
      targetUserId: bystander.id,
      actorUserId: owner.id,
      reason: 'not a member here',
    })
      .then(() => null)
      .catch((e) => e as Error)) !== null,
  )

  // ⚠ THE GUARDS STAY. This is what stops a node being takeable by a co-admin.
  const stillFixed = await setMemberRole(ownBranch.id, successor.id, 'MEMBER')
    .then(() => null)
    .catch((e) => e as Error)
  assert(
    'the ordinary role control STILL refuses to touch an owner',
    stillFixed !== null,
    stillFixed?.message ?? 'not refused',
  )
  const stillUnremovable = await removeMember(ownBranch.id, successor.id, owner.id)
    .then(() => null)
    .catch((e) => e as Error)
  assert(
    'and the owner still cannot be removed',
    stillUnremovable !== null,
    stillUnremovable?.message ?? 'not refused',
  )

  // ⚠ leaveCommunity was a DEAD END: it told people to hand a branch over,
  // which nothing could do.
  await appointBranchOwner({
    communityId: sibling.id,
    targetUserId: bystander.id,
    actorUserId: owner.id,
    reason: 'so they have a branch to leave',
  })
  const left = await leaveCommunity(bystander.id, community.id)
    .then(() => null)
    .catch((e) => e as Error)
  assert(
    'somebody who manages a branch can now leave the Community',
    left === null,
    left?.message ?? '',
  )
  assert(
    '— and the branch they managed is left VACANT, not deleted',
    (await branchIsVacant(sibling.id)) &&
      (await prisma.community.findUnique({ where: { id: sibling.id }, select: { deletedAt: true } }))
        ?.deletedAt === null,
  )
  control(
    'the same test claiming the branch went with them',
    (await prisma.community.findUnique({ where: { id: sibling.id }, select: { deletedAt: true } }))
      ?.deletedAt !== null,
  )

  // The controls exist on the surface — without them the three functions above
  // are unreachable, which is the whole reason §5c named the panel.
  const membersPanelSrc = readFileSync('app/communities/[id]/MembersPanel.tsx', 'utf8')
  assert(
    'the Members panel offers the branch-manager controls on an OWNER row',
    membersPanelSrc.includes('Stand down as branch manager') &&
      membersPanelSrc.includes('Make branch manager') &&
      membersPanelSrc.includes('/ownership'),
  )
  assert(
    'and it says plainly when a branch has no manager',
    membersPanelSrc.includes('has no branch manager'),
  )

  // ══ §6 — the admin user list ═════════════════════════════════════════════
  console.log('\n§6 — the user list, and the sign-in cell that is never blank')

  const clerkish = 'user_check25a'
  const cases: [string, Parameters<typeof describeSignIn>[1], string][] = [
    ['never signed in', { lastSignInAt: null, createdAt: 1, passwordEnabled: true, providers: [] }, 'Never signed in'],
    ['Clerk has no such user', null, 'No Clerk account'],
    ['Clerk could not be asked', undefined, 'Clerk did not answer'],
  ]
  for (const [label, facts, expected] of cases) {
    const d = describeSignIn(clerkish, facts)
    assert(
      `a user whose state is "${label}" renders "${expected}"`,
      SIGN_IN_STATE_LABEL[d.state] === expected,
      `got "${SIGN_IN_STATE_LABEL[d.state]}"`,
    )
  }
  assert(
    'a seeded account says so rather than reading as somebody who never returned',
    describeSignIn('historical_bma', null).state === 'SEEDED',
  )
  const now = Date.now()
  assert(
    'a sign-in at sign-up time reads "Not since signing up", not as a return visit',
    describeSignIn(clerkish, {
      lastSignInAt: now + 1000,
      createdAt: now,
      passwordEnabled: true,
      providers: [],
    }).state === 'SIGNUP_ONLY',
  )
  assert(
    'a later sign-in reads as a return visit',
    describeSignIn(clerkish, {
      lastSignInAt: now + 86_400_000,
      createdAt: now,
      passwordEnabled: false,
      providers: ['oauth_google'],
    }).state === 'RETURNED',
  )
  assert(
    'the sign-in method is named — password and Google are told apart',
    describeSignIn(clerkish, { lastSignInAt: now, createdAt: now, passwordEnabled: true, providers: ['oauth_google'] })
      .methods.join(', ') === 'Password, Google',
  )

  // ⚠ §6d, AS THE PROPERTY: every state the table can be handed renders words.
  const blanks = SIGN_IN_STATES.filter((s) => !SIGN_IN_STATE_LABEL[s]?.trim())
  assert('no sign-in state renders as an empty cell', blanks.length === 0, blanks.join(','))
  // ⚠ The control reads the SAME map through a wider type rather than casting a
  // fake state to `never`. `Record<SignInState, string>` indexed by `never`
  // narrows to `never`, which `tsc -p scripts/tsconfig.json` rejects outright
  // while the web program let it through — the two are separate TypeScript
  // programs, and `check:scripts` is the one that covers this file.
  const labelsByAnyKey: Record<string, string | undefined> = SIGN_IN_STATE_LABEL
  control(
    'the same test over a state with no label, which must NOT pass',
    ['MADE_UP'].every((s) => Boolean(labelsByAnyKey[s]?.trim())),
  )

  // The sort's purpose: people who never came back are reachable as a group.
  const rows: AdminUserRow[] = [
    { signInState: 'RETURNED', lastSignInAt: new Date(now).toISOString(), joinDate: new Date(now).toISOString(), name: 'Returned' },
    { signInState: 'NEVER', lastSignInAt: null, joinDate: new Date(now).toISOString(), name: 'Never' },
    { signInState: 'SIGNUP_ONLY', lastSignInAt: new Date(now).toISOString(), joinDate: new Date(now).toISOString(), name: 'Signup' },
  ].map((r) => r as unknown as AdminUserRow)
  const sorted = sortAdminUsers(rows, 'lastSignIn').map((r) => r.name)
  assert(
    'sorting by last signed in puts those who never came back after those who did',
    sorted.join(',') === 'Returned,Signup,Never',
    sorted.join(','),
  )

  // And on the real list: no live row renders a blank sign-in cell.
  const liveUsers = await prisma.user.findMany({ select: { clerkId: true } })
  const wouldBeBlank = liveUsers.filter((u) => {
    const d = describeSignIn(u.clerkId, undefined)
    return !d.lastSignInAt && !SIGN_IN_STATE_LABEL[d.state]?.trim()
  })
  assert(
    `all ${liveUsers.length} live users render a sign-in cell with words in it`,
    wouldBeBlank.length === 0,
    `${wouldBeBlank.length} blank`,
  )

  // ══ §2 — the panel is reached (§23.1) ════════════════════════════════════
  console.log('\nreachability — the panel is imported by the page that draws Teams')
  const dashboardSrc = readFileSync('app/communities/[id]/CommunityDashboardClient.tsx', 'utf8')
  assert(
    'InvitationsPanel is imported and rendered by the Community dashboard',
    dashboardSrc.includes("import InvitationsPanel from './InvitationsPanel'") &&
      dashboardSrc.includes('<InvitationsPanel'),
  )
  const panelSrc = readFileSync('app/communities/[id]/InvitationsPanel.tsx', 'utf8')
  assert(
    'the panel renders the status vocabulary rather than restating it',
    panelSrc.includes('INVITE_STATUS_LABEL[row.status]') &&
      !/'Signed up — not yet joined'/.test(panelSrc),
  )
  assert(
    'the panel reads the people route, which is where the derivation lives',
    panelSrc.includes('/people'),
  )
}

/**
 * ⚠⚠ EVERY STATEMENT IS INDEPENDENT, AND THAT IS THE POINT.
 *
 * The first version ran the teardown as one straight sequence. On 1 September
 * 2026 the check threw early against a database that did not yet have `titleId`,
 * the teardown's own first statement threw on the same column, and the whole
 * teardown was abandoned — leaving a fixture user on PRODUCTION, which is the
 * exact collision `docs/CLAUDE.md` §25.4 exists to prevent. A cleanup that gives
 * up on its first failure is a cleanup that fails when it is most needed, since
 * the run that failed is the run with the most to clear up.
 *
 * So: each statement is attempted on its own, failures are collected and
 * REPORTED rather than swallowed, and the sweep at the end reclaims fixtures
 * left behind by any earlier run.
 */
const cleanupProblems: string[] = []

async function attempt(what: string, run: () => Promise<unknown>) {
  try {
    await run()
  } catch (e) {
    cleanupProblems.push(`${what}: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`)
  }
}

async function cleanup() {
  console.log('\ncleaning up…')

  // ⚠⚠ TWO PASSES, NOT ONE LOOP, AND §7h IS WHY.
  //
  // The first version deleted each community's rows in turn. That fails as soon
  // as §7h writes provenance: `joinCommunityAndRoot` records the BRANCH's
  // invite id on the ROOT membership row too, so deleting the branch's invites
  // while the root's members still point at them violates a foreign key — and
  // the branch, its invites and the community above it all survived the run
  // that was supposed to remove them.
  //
  // So: every dependent row across every scratch community first, then every
  // invite, then the communities themselves.
  for (const id of scratch.communityIds) {
    await attempt('untitle members', () =>
      prisma.communityMember.updateMany({ where: { communityId: id }, data: { titleId: null } }),
    )
    await attempt('titles', () => prisma.communityTitle.deleteMany({ where: { communityId: id } }))
    await attempt('posts', () => prisma.bulletinPost.deleteMany({ where: { communityId: id } }))
    await attempt('referrals', () => prisma.communityReferral.deleteMany({ where: { communityId: id } }))
    await attempt('join requests', () =>
      prisma.communityJoinRequest.deleteMany({ where: { communityId: id } }),
    )
    await attempt('archive', () =>
      prisma.communityMembershipArchive.deleteMany({ where: { communityId: id } }),
    )
    await attempt('members', () => prisma.communityMember.deleteMany({ where: { communityId: id } }))
    await attempt('settings', () => prisma.communitySettings.deleteMany({ where: { communityId: id } }))
  }
  // Every membership everywhere is gone by here, so nothing can still point at
  // an invite.
  for (const id of scratch.communityIds) {
    await attempt('invites', () => prisma.communityInvite.deleteMany({ where: { communityId: id } }))
  }
  await attempt('notifications', () =>
    prisma.notification.deleteMany({ where: { userId: { in: scratch.userIds } } }),
  )
  // Children before parents — `communityIds` is ordered with branches at the front.
  for (const id of scratch.communityIds) {
    await attempt('community', () => prisma.community.deleteMany({ where: { id } }))
  }

  await attempt('platform invites', () =>
    prisma.invite.deleteMany({ where: { id: { in: scratch.platformInviteIds } } }),
  )
  await attempt('credibility', () =>
    prisma.credibilityScore.deleteMany({ where: { userId: { in: scratch.userIds } } }),
  )
  // ⚠ NEW IN 25-B §5: the ownership audit writes `ActivityLog` rows that reference
  // the actor. They are a foreign key onto User, so the teardown that never knew
  // about them left twenty-two fixture accounts standing on production.
  await attempt('ownership audit', () =>
    prisma.activityLog.deleteMany({ where: { userId: { in: scratch.userIds } } }),
  )
  await attempt('users', () => prisma.user.deleteMany({ where: { id: { in: scratch.userIds } } }))

  // ⚠ THE SWEEP. Fixtures from an earlier run that died before its teardown —
  // `@example.invalid` is a reserved TLD and the prefix is this check's own, so
  // this can never reach a real person's row.
  const orphans = await prisma.user.findMany({
    where: { email: { startsWith: 'check25a+', endsWith: '@example.invalid' } },
    select: { id: true, email: true },
  })
  const stale = orphans.filter((o) => !scratch.userIds.includes(o.id))
  if (stale.length > 0) {
    console.log(`  sweeping ${stale.length} fixture row(s) left by an earlier run`)
    const ids = stale.map((o) => o.id)
    await attempt('sweep notifications', () =>
      prisma.notification.deleteMany({ where: { userId: { in: ids } } }),
    )
    await attempt('sweep credibility', () =>
      prisma.credibilityScore.deleteMany({ where: { userId: { in: ids } } }),
    )
    await attempt('sweep ownership audit', () =>
      prisma.activityLog.deleteMany({ where: { userId: { in: ids } } }),
    )
    await attempt('sweep users', () => prisma.user.deleteMany({ where: { id: { in: ids } } }))
  }

  // ⚠ And the communities. The first sweep reclaimed only users, so a run that
  // died before its teardown left its scratch tree standing on production — one
  // was found by counting, not by the sweep that was supposed to catch it.
  const staleComms = await prisma.community.findMany({
    where: { name: { startsWith: 'Check 25A ' }, NOT: { id: { in: scratch.communityIds } } },
    select: { id: true, name: true, parentCommunityId: true },
  })
  if (staleComms.length > 0) {
    console.log(`  sweeping ${staleComms.length} fixture community/communities left by an earlier run`)
    // Children first.
    const ordered = [...staleComms].sort((a, b) => (b.parentCommunityId ? 1 : 0) - (a.parentCommunityId ? 1 : 0))
    for (const c of ordered) {
      for (const [what, run] of [
        ['members', () => prisma.communityMember.deleteMany({ where: { communityId: c.id } })],
        ['archive', () => prisma.communityMembershipArchive.deleteMany({ where: { communityId: c.id } })],
        ['referrals', () => prisma.communityReferral.deleteMany({ where: { communityId: c.id } })],
        ['requests', () => prisma.communityJoinRequest.deleteMany({ where: { communityId: c.id } })],
        ['titles', () => prisma.communityTitle.deleteMany({ where: { communityId: c.id } })],
        ['posts', () => prisma.bulletinPost.deleteMany({ where: { communityId: c.id } })],
        ['settings', () => prisma.communitySettings.deleteMany({ where: { communityId: c.id } })],
        ['invites', () => prisma.communityInvite.deleteMany({ where: { communityId: c.id } })],
      ] as [string, () => Promise<unknown>][]) {
        await attempt(`sweep ${what}`, run)
      }
    }
    for (const c of ordered.slice().reverse()) {
      await attempt('sweep community', () => prisma.community.deleteMany({ where: { id: c.id } }))
    }
  }

  // ⚠ Read it back. "Deleted" is an intention; the re-read is the fact.
  const left = await prisma.user.count({
    where: { email: { startsWith: 'check25a+', endsWith: '@example.invalid' } },
  })
  const commsLeft = await prisma.community.count({ where: { name: { startsWith: 'Check 25A ' } } })
  console.log(`  ${left} fixture users and ${commsLeft} fixture communities remain (both should be 0)`)
  for (const problem of cleanupProblems) console.log(`  cleanup problem — ${problem}`)
  if (left || commsLeft) {
    failed++
    failures.push(`cleanup left ${left} users and ${commsLeft} communities behind`)
  }
}

main()
  .catch((e) => {
    failed++
    failures.push(`threw: ${e instanceof Error ? e.message : String(e)}`)
    console.error(e)
  })
  .finally(async () => {
    await cleanup().catch((e) => console.error('cleanup failed', e))
    await prisma.$disconnect()
    console.log(
      `\n${passed} passed, ${failed} failed, ${controlsFired} controls fired, ${controlsDead} dead controls`,
    )
    for (const f of failures) console.log(`  FAIL: ${f}`)
    process.exit(failed > 0 ? 1 : 0)
  })
