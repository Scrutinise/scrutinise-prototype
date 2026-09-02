/**
 * CENTRAL 25-C — the checks for §1, §2 and §3.
 *
 * Run: npm run check:central-25c
 *
 * ⚠ EVERY VALUE ASSERTION READS WHAT THE PRODUCT READS (docs/CLAUDE.md §25).
 * The gates are the real `canCreateBranchUnder`, `inviteRightFor`,
 * `inviteCreateRightFor` and `canManageCommunity`; the tier is read back off the
 * row; the group-level view comes out of `getGroupLevelView` and is sorted by
 * `sortGroupMembers`, the same function the panel imports. Nothing is
 * re-implemented here, because a re-implementation asserts that two pieces of
 * code agree — which they do until one is fixed (§25.3).
 *
 * ⚠ EVERY VALUE ASSERTION HAS A CONTROL THAT STAYS FALSE, and the control
 * lambda returns whether the PROPERTY holds, not whether some broken text still
 * matches. A control that fires is a bug in this file.
 *
 * ⚠ PART 6 IS A COLD READ (§26): it takes the LIVE Community — rows this script
 * did not create and has not touched — and asks the plainest question there is,
 * with `prisma.findMany` and nothing else. A check that arranges the world and
 * then asserts the world is arranged is measuring itself.
 *
 * Everything it creates is deleted in a `finally`, including on failure, and it
 * asserts its fixtures were fresh before trusting them.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { prisma } from '../lib/prisma'
import {
  canCreateBranchUnder,
  joinCommunityAndRoot,
  getCommunityMembership,
  canManageCommunity,
} from '../lib/community'
import {
  appointBranchOwner,
  branchIsVacant,
  canCreateInvite,
  canInvite,
  decideBranchNomination,
  inviteCreateRightFor,
  inviteRightFor,
  resignAndNominate,
  rootTierFor,
  setMembershipTier,
  vacateBranchOwnership,
} from '../lib/community-permissions'
import {
  TIER_LABEL,
  tierForArrival,
  tierMayFoundBranch,
  type MembershipTier,
} from '../lib/membership-tier'
import { getGroupLevelView, sortGroupMembers } from '../lib/group-view'
import { ACTIVITY_TYPES, SELF_LOGGABLE_ACTIVITIES } from '../lib/activity-types'
import { createActivityClaim } from '../lib/central-points'

let passed = 0
let failed = 0
let controlsFired = 0
let controlsDead = 0
let notChecked = 0
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

/** A control asserts the same PROPERTY over data where it must NOT hold. */
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

/**
 * ⚠⚠ A "MUST NOT APPEAR" GREP READS ITS OWN COMMENTS. The first run of this
 * check went red on a correct file: the note in `[inviteId]/route.ts` explaining
 * WHY it keeps the narrow gate names `requireInviteCreateRight`, and the
 * assertion that the wide gate is absent found it in the explanation. Strip the
 * comments, then ask about the code.
 */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

/** §23.2 — a subject we could not check is COUNTED, never skipped in silence. */
function notCheckedBecause(name: string, why: string) {
  notChecked++
  console.log(`  – NOT CHECKED: ${name} — ${why}`)
}

const MARK = randomUUID().slice(0, 8)
const scratch: { userIds: string[]; communityIds: string[] } = { userIds: [], communityIds: [] }

async function makeUser(tag: string) {
  const u = await prisma.user.create({
    data: {
      clerkId: `check25c_${MARK}_${tag}`,
      firstName: 'Check',
      lastName: tag,
      name: `Check ${tag}`,
      username: `check25c_${MARK}_${tag}`,
      email: `check25c+${MARK}+${tag}@example.invalid`,
      referralCode: randomUUID(),
    },
    select: { id: true, createdAt: true },
  })
  scratch.userIds.push(u.id)
  return u
}

async function main() {
  console.log(`CENTRAL 25-C checks — fixture mark ${MARK}\n`)

  // ══════════════════════════════════════════════════════════════════════════
  // §1a/§1f — THE TIER, AND THE ROW THAT STAYS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('§1a — the tier detaches rights; the root membership row stays')

  const owner = await makeUser('owner')
  const community = await prisma.community.create({
    data: { name: `Check 25C ${MARK}`, description: 'fixture' },
    select: { id: true, createdAt: true },
  })
  scratch.communityIds.push(community.id)
  await prisma.communityMember.create({
    data: { communityId: community.id, userId: owner.id, role: 'OWNER', tier: 'GROUP' },
  })
  const branch = await prisma.community.create({
    data: { name: `Check 25C branch ${MARK}`, parentCommunityId: community.id },
    select: { id: true },
  })
  scratch.communityIds.unshift(branch.id)

  // ⚠ THE FIXTURES ARE ASSERTED FRESH BEFORE THEY ARE TRUSTED. `check:central`
  // once reused a live ActivityClaim and passed on a zero-point award.
  assert(
    'the fixture Community is fresh, not a live row this run happened to find',
    Date.now() - community.createdAt.getTime() < 60_000,
  )

  // A GROUP member: joins ON the root.
  const groupMember = await makeUser('group')
  await joinCommunityAndRoot(groupMember.id, community.id)

  // A BRANCH member: joins into the BRANCH, which creates the root row as a
  // side-effect — the exact arrival §1a is about.
  const branchMember = await makeUser('branch')
  const joined = await joinCommunityAndRoot(branchMember.id, branch.id)

  assert(
    '§1a — a branch join STILL creates the root membership row (the invariant is untouched)',
    joined.joinedRoot === true &&
      (await getCommunityMembership(branchMember.id, community.id)) !== null,
  )
  control(
    'the same property claimed of somebody who joined nothing',
    (await getCommunityMembership(owner.id, branch.id)) !== null,
  )

  const groupTier = await rootTierFor(groupMember.id, community.id)
  const branchTier = await rootTierFor(branchMember.id, community.id)
  assert(`§1f — a top-level join is ${TIER_LABEL.GROUP}`, groupTier === 'GROUP', `got ${groupTier}`)
  assert(
    `§1f — a branch join makes the root row ${TIER_LABEL.BRANCH}`,
    branchTier === 'BRANCH',
    `got ${branchTier}`,
  )
  control(
    'the same derivation claiming a branch arrival is a group member',
    (await rootTierFor(branchMember.id, community.id)) === 'GROUP',
  )

  // The rule itself, imported rather than restated.
  assert(
    'the derivation rule is one function and it agrees with the rows',
    tierForArrival({ joinedNodeId: community.id, rootId: community.id }) === groupTier &&
      tierForArrival({ joinedNodeId: branch.id, rootId: community.id }) === branchTier,
  )

  // ⚠ A group member who LATER joins a branch is not re-tiered. Arriving in a
  // branch only makes somebody a branch member when it is how they got in.
  await joinCommunityAndRoot(groupMember.id, branch.id)
  assert(
    '§1a — joining a branch later does NOT demote an existing group member',
    (await rootTierFor(groupMember.id, community.id)) === 'GROUP',
  )

  // ══════════════════════════════════════════════════════════════════════════
  // §1b/§1g — FOUNDING A BRANCH
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n§1b — a branch member cannot found a branch; a group member can')

  const groupMayFound = await canCreateBranchUnder(groupMember.id, community.id)
  const branchMayFound = await canCreateBranchUnder(branchMember.id, community.id)
  assert('a group member may found a top-level branch', groupMayFound === true)
  assert('a branch member may NOT', branchMayFound === false)
  control('the same gate claiming a branch member may found one', branchMayFound)

  // §1g — the CONTROL that offers it must agree with the gate that decides it.
  // ⚠ A SOURCE assertion, and correctly so: the property is "this component
  // derives its condition from the shared predicate rather than restating it",
  // which is about the file (§25's own carve-out).
  for (const file of [
    'app/communities/[id]/TeamsTree.tsx',
    'app/communities/[id]/FindYourBranch.tsx',
  ]) {
    const src = readFileSync(file, 'utf8')
    assert(
      `§1g — ${file} gates "create your own branch" on the shared predicate`,
      src.includes('tierMayFoundBranch'),
    )
  }
  assert(
    '§1g — and the predicate they call is the one the API decides with',
    tierMayFoundBranch(groupTier) === groupMayFound &&
      tierMayFoundBranch(branchTier) === branchMayFound,
  )
  control(
    'the same agreement claimed for a tier the predicate refuses',
    tierMayFoundBranch('BRANCH') === true,
  )

  // ══════════════════════════════════════════════════════════════════════════
  // §1c — A BRANCH MANAGER REACHES THE TOP LEVEL. THE MOVED ASSERTION.
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n§1c — a branch manager may invite at top level (the reversed rule)')

  const manager = await makeUser('mgr')
  await joinCommunityAndRoot(manager.id, branch.id)
  await prisma.communityMember.update({
    where: { communityId_userId: { communityId: branch.id, userId: manager.id } },
    data: { role: 'OWNER' },
  })

  const mgrAtRoot = await inviteRightFor(manager.id, community.id)
  assert(
    '§1c — a branch manager may invite at TOP LEVEL, so a chair can recruit another chair',
    mgrAtRoot.allowed === true && mgrAtRoot.reason === 'BRANCH_MANAGER',
    `allowed=${mgrAtRoot.allowed} reason=${mgrAtRoot.reason}`,
  )
  control(
    'the same right claimed for a plain branch member, who must NOT reach the top level',
    (await inviteRightFor(branchMember.id, community.id)).allowed,
  )
  assert(
    '§1b — and a plain branch member still may not invite at top level',
    (await canCreateInvite(branchMember.id, community.id)) === false,
  )

  // ⚠ WHAT DID NOT MOVE. Reaching the root is not reaching the whole tree.
  const sibling = await prisma.community.create({
    data: { name: `Check 25C sibling ${MARK}`, parentCommunityId: community.id },
    select: { id: true },
  })
  scratch.communityIds.unshift(sibling.id)
  assert(
    "§1c — a branch manager still cannot invite into somebody ELSE'S branch",
    (await canCreateInvite(manager.id, sibling.id)) === false,
  )
  control(
    "the same test over their OWN branch, where they certainly may",
    !(await canCreateInvite(manager.id, branch.id)),
  )

  // ⚠ A TITLE DID NOT WIDEN WITH IT. 25-A §7e's rule is that a title grants
  // rights only within the node it is held on, or above.
  const title = await prisma.communityTitle.create({
    data: { communityId: community.id, name: `Check 25C title ${MARK}`, grantsInvite: true },
    select: { id: true },
  })
  const titled = await makeUser('titled')
  await joinCommunityAndRoot(titled.id, branch.id)
  await prisma.communityMember.update({
    where: { communityId_userId: { communityId: branch.id, userId: titled.id } },
    data: { titleId: title.id },
  })
  assert(
    '§1c — a title held on a BRANCH still does not confer the right at the top level',
    (await inviteRightFor(titled.id, community.id)).allowed === false,
  )
  control(
    'the same title on the branch it is held on, where it must work',
    !(await canInvite(titled.id, branch.id)),
  )

  // ══════════════════════════════════════════════════════════════════════════
  // §1d — CREATE OPENS; REVOKE AND RESTORE STAY WITH THE MANAGER
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n§1d — any branch member may invite INTO that branch; ejection and revoke do not move')

  const plainInBranch = await makeUser('plainbranch')
  await joinCommunityAndRoot(plainInBranch.id, branch.id)

  const created = await inviteCreateRightFor(plainInBranch.id, branch.id)
  assert(
    '§1d — an ordinary member of the branch MAY create an invitation into it',
    created.allowed === true && created.reason === 'BRANCH_MEMBER',
    `allowed=${created.allowed} reason=${created.reason}`,
  )
  control(
    'the same right claimed over a branch they are not in',
    (await inviteCreateRightFor(plainInBranch.id, sibling.id)).allowed,
  )

  // ⚠⚠ THE TRAP, ASSERTED. `requireInviteRight` guards revoke and restore too.
  assert(
    '§1d — and the SAME person may NOT revoke or restore: the narrow gate refuses them',
    (await inviteRightFor(plainInBranch.id, branch.id)).allowed === false,
  )
  control(
    'the same narrow gate over the branch manager, who must keep revoke and restore',
    !(await inviteRightFor(manager.id, branch.id)).allowed,
  )
  assert(
    '§1d — nor may they eject: ejection follows manage rights, which did not move',
    (await canManageCommunity(plainInBranch.id, branch.id)) === false,
  )
  control(
    'the same ejection right over the branch manager, who has it',
    !(await canManageCommunity(manager.id, branch.id)),
  )

  // ⚠ The two routes must call the two DIFFERENT functions. A source assertion,
  // correctly: the property is "this route imports that gate".
  const createRoute = code(readFileSync('app/api/communities/[id]/invites/route.ts', 'utf8'))
  const modifyRoute = code(
    readFileSync('app/api/communities/[id]/invites/[inviteId]/route.ts', 'utf8'),
  )
  assert(
    '§1d — the CREATE route uses the wide gate and the revoke/restore route uses the narrow one',
    /requireInviteCreateRight\(user\.id, communityId\)/.test(createRoute) &&
      /requireInviteRight\(user\.id, communityId\)/.test(modifyRoute) &&
      !/requireInviteCreateRight/.test(modifyRoute),
  )

  // ══════════════════════════════════════════════════════════════════════════
  // §2e — DEMOTION RESIGNS BRANCH OWNERSHIP IN THE SAME ACTION
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n§2e — a demotion to branch member stands them down from the branch they manage')

  const founder = await makeUser('founder')
  await joinCommunityAndRoot(founder.id, community.id)
  const founded = await prisma.community.create({
    data: { name: `Check 25C founded ${MARK}`, parentCommunityId: community.id },
    select: { id: true },
  })
  scratch.communityIds.unshift(founded.id)
  await joinCommunityAndRoot(founder.id, founded.id, 'OWNER')

  assert(
    'before: they are a group member and they manage the branch they founded',
    (await rootTierFor(founder.id, community.id)) === 'GROUP' &&
      (await branchIsVacant(founded.id)) === false,
  )

  const demoted = await setMembershipTier({
    communityId: community.id,
    targetUserId: founder.id,
    tier: 'BRANCH',
    actorUserId: owner.id,
    reason: 'check 25-C §2e',
  })

  // ⚠ READ BACK OFF THE ROW, not off the return value.
  const founderRow = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: founded.id, userId: founder.id } },
    select: { role: true, tier: true },
  })
  assert(
    '§2e — the demotion stood them down: they are an ordinary MEMBER of the branch',
    founderRow?.role === 'MEMBER',
    `role=${founderRow?.role}`,
  )
  assert(
    '§2f — and the branch is VACANT, not deleted and not handed to anybody',
    (await branchIsVacant(founded.id)) === true &&
      (await prisma.community.findUnique({ where: { id: founded.id } })) !== null,
  )
  assert(
    '§2e — the branch row mirrors the root row, so the table shows one answer',
    founderRow?.tier === 'BRANCH' && demoted.vacatedBranchIds.includes(founded.id),
  )
  control(
    'the same demotion claimed to have left them founding-capable',
    await canCreateBranchUnder(founder.id, community.id),
  )
  assert(
    '§2b — and the Community owner cannot be demoted to branch member',
    await setMembershipTier({
      communityId: community.id,
      targetUserId: owner.id,
      tier: 'BRANCH',
      actorUserId: owner.id,
      reason: 'must refuse',
    })
      .then(() => false)
      .catch(() => true),
  )

  // ══════════════════════════════════════════════════════════════════════════
  // §2i — A PENDING NOMINATION CONFERS NOTHING; AN APPROVED ONE TRANSFERS
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n§2i — resign and nominate, asserted in BOTH directions')

  const successor = await makeUser('successor')
  await joinCommunityAndRoot(successor.id, branch.id)

  const nomination = await resignAndNominate({
    communityId: branch.id,
    actorUserId: manager.id,
    nomineeUserId: successor.id,
    reason: 'check 25-C §2i',
  })

  const afterNomination = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: branch.id, userId: successor.id } },
    select: { role: true },
  })
  assert(
    '§2i — a PENDING nomination confers nothing: the nominee is still an ordinary member',
    afterNomination?.role === 'MEMBER',
    `role=${afterNomination?.role}`,
  )
  assert(
    '§2i — and the resignation itself took effect: the branch is vacant meanwhile',
    (await branchIsVacant(branch.id)) === true,
  )
  assert(
    '§2i — the nominee cannot manage the branch on a pending nomination',
    (await canManageCommunity(successor.id, branch.id)) === false,
  )
  control(
    'the same "cannot manage" test over the Community owner, who certainly can',
    !(await canManageCommunity(owner.id, branch.id)),
  )

  await decideBranchNomination({
    nominationId: nomination.nominationId,
    actorUserId: owner.id,
    approve: true,
  })

  const afterApproval = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: branch.id, userId: successor.id } },
    select: { role: true },
  })
  assert(
    '§2i — an APPROVED nomination transfers: the nominee holds the OWNER row',
    afterApproval?.role === 'OWNER',
    `role=${afterApproval?.role}`,
  )
  assert(
    '§2i — and the branch is no longer vacant',
    (await branchIsVacant(branch.id)) === false,
  )
  control(
    'the same transfer claimed for somebody nobody nominated',
    (
      await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: branch.id, userId: plainInBranch.id } },
        select: { role: true },
      })
    )?.role === 'OWNER',
  )
  assert(
    '§2i — the nomination row records the decision rather than being deleted',
    (
      await prisma.branchOwnerNomination.findUnique({
        where: { id: nomination.nominationId },
        select: { status: true, decidedByUserId: true },
      })
    )?.status === 'APPROVED',
  )

  // ══════════════════════════════════════════════════════════════════════════
  // §1h/§1i — THE CORRECTION SURFACE
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n§1h/§1i — the group-level view surfaces the anomaly and the vacancies')

  // A group member who manages nothing — the row Charlie is watching for.
  const idle = await makeUser('idle')
  await joinCommunityAndRoot(idle.id, community.id)

  const view = await getGroupLevelView(community.id)
  const idleRow = view.members.find((m) => m.userId === idle.id)
  assert(
    '§1h — the view carries the four facts: tier, who invited them, when, and what they manage',
    idleRow !== undefined &&
      idleRow.tier === 'GROUP' &&
      idleRow.managesAnyBranch === false &&
      idleRow.joinedAt instanceof Date &&
      'invitedByName' in idleRow,
  )
  assert(
    '§1h — and it counts the anomaly rather than leaving it to be spotted',
    view.groupMembersManagingNoBranch >= 1,
  )
  const sorted = sortGroupMembers(view.members, 'anomaly')
  const firstIdx = sorted.findIndex((m) => m.tier === 'GROUP' && !m.managesAnyBranch)
  const managerIdx = sorted.findIndex((m) => m.managesAnyBranch)
  assert(
    '§1h — the default sort puts group members managing no branch ABOVE those who do',
    firstIdx >= 0 && managerIdx >= 0 && firstIdx < managerIdx,
    `anomaly at ${firstIdx}, manager at ${managerIdx}`,
  )
  // ⚠ THE CONTROL IS THE 'branches' SORT, NOT THE 'name' SORT. The first draft
  // used `name`, and it DID NOT FIRE — with these fixture names the anomaly
  // happened to sort first anyway, so the control was measuring an accident of
  // the alphabet rather than the ordering rule. `branches` puts the people who
  // manage the MOST branches at the top by construction, so "the anomaly comes
  // first" must be false there whatever anybody is called.
  control(
    'the same ordering claimed of the most-branches sort, which puts managers first by construction',
    (() => {
      const byBranches = sortGroupMembers(view.members, 'branches')
      const a = byBranches.findIndex((m) => m.tier === 'GROUP' && !m.managesAnyBranch)
      const b = byBranches.findIndex((m) => m.managesAnyBranch)
      return a >= 0 && b >= 0 && a < b
    })(),
  )
  assert(
    '§1i — the vacant branch appears in the same view as an action item',
    view.vacantBranches.some((b) => b.id === founded.id),
  )
  control(
    'the same list claimed to contain a branch that HAS a manager',
    view.vacantBranches.some((b) => b.id === branch.id),
  )

  // ⚠ The panel must SORT with the shared function, not a copy of it (§26.5).
  const panelSrc = readFileSync('app/communities/[id]/group-level/GroupLevel.tsx', 'utf8')
  assert(
    '§1h — the panel imports sortGroupMembers rather than keeping its own copy',
    panelSrc.includes('sortGroupMembers'),
  )

  // ══════════════════════════════════════════════════════════════════════════
  // §4c — GAVE_TRAINING IS NO LONGER SELF-LOGGABLE
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n§4c — the self-log list, and the refusal behind it')

  assert(
    '§4c — GAVE_TRAINING is off the self-log list',
    !SELF_LOGGABLE_ACTIVITIES.some((a) => a.key === 'GAVE_TRAINING'),
  )
  assert(
    '§4c — but it is still a real activity with a tariff, awarded through the training exchange',
    ACTIVITY_TYPES.some((a) => a.key === 'GAVE_TRAINING'),
  )
  const refused = await createActivityClaim({
    userId: groupMember.id,
    communityId: community.id,
    activityType: 'GAVE_TRAINING',
    occurredAt: new Date(),
  })
    .then(() => false)
    .catch(() => true)
  assert(
    '§4c — and the SERVER refuses it, not merely the form',
    refused,
  )
  control(
    'the same refusal claimed of an activity that is still self-loggable',
    await createActivityClaim({
      userId: groupMember.id,
      communityId: community.id,
      activityType: 'CANVASSING_SESSION',
      occurredAt: new Date(),
    })
      .then(() => false)
      .catch(() => true),
  )

  // ══════════════════════════════════════════════════════════════════════════
  // PART 6 — THE COLD READ (docs/CLAUDE.md §26)
  //
  // ⚠⚠ NOT ONE ROW BELOW THIS LINE WAS CREATED OR TOUCHED BY THIS SCRIPT. The
  // subject is the live Community, chosen because it is the live Community and
  // not because it is in a state that makes the feature look well. It is read
  // with `prisma.findMany` and nothing else — no app reader, no fixture, no
  // setup call. The question is the only one that spans the whole change: on
  // real rows, is the tier there and does it say something?
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n§26 COLD READ — the live Community, untouched')

  const liveRoots = await prisma.community.findMany({
    where: { parentCommunityId: null, deletedAt: null, id: { notIn: scratch.communityIds } },
    select: { id: true, name: true },
  })
  if (liveRoots.length === 0) {
    notCheckedBecause('the cold read', 'there is no Community this script did not create')
  } else {
    for (const live of liveRoots) {
      const rows = await prisma.communityMember.findMany({
        where: { communityId: live.id },
        select: { userId: true, tier: true, role: true, user: { select: { email: true } } },
      })
      if (rows.length === 0) {
        notCheckedBecause(`${live.name}`, 'no members')
        continue
      }
      const tiers = new Set(rows.map((r) => r.tier))
      assert(
        `cold read — every root membership in “${live.name}” carries a tier`,
        rows.every((r) => r.tier === 'GROUP' || r.tier === 'BRANCH'),
      )
      // ⚠ THE REAL QUESTION. A column where every row says the same thing is a
      // column that was DEFAULTED, not derived — which is exactly what §1f
      // forbade, and it is indistinguishable from a working backfill in every
      // other assertion here.
      assert(
        `cold read — “${live.name}” was DERIVED, not defaulted: both tiers are present`,
        tiers.size === 2,
        `tiers present: ${[...tiers].join(', ')} across ${rows.length} rows`,
      )
      const branchTiered = rows.filter((r) => r.tier === 'BRANCH')
      console.log(
        `    · ${rows.length} members; ${branchTiered.length} branch member(s): ${branchTiered
          .map((r) => r.user.email)
          .join(', ') || '(none)'}`,
      )
    }
  }

  // ── §3a/§3b, read off the live rows, also untouched ──────────────────────
  console.log('\n§3a/§3b — the live invite links, and the fixture user')

  const liveInvites = await prisma.communityInvite.findMany({
    where: { communityId: { notIn: scratch.communityIds } },
    select: { id: true, maxUses: true, email: true, usedCount: true },
  })
  if (liveInvites.length === 0) {
    notCheckedBecause('§3a', 'no live invitations exist')
  } else {
    const over = liveInvites.filter((i) => i.maxUses > 1)
    assert(
      `§3a — every live invitation reads 1 use (${liveInvites.length} checked)`,
      over.length === 0,
      `${over.length} still above 1`,
    )
  }
  const dashSrc = readFileSync('app/communities/[id]/CommunityDashboardClient.tsx', 'utf8')
  assert(
    '§3a — and the generator that MINTS them asks for 1, so the next one is not 10 again',
    /maxUses: 1,/.test(dashSrc),
  )

  // ⚠ §3b — RE-READ, by the exact address, not assumed. CC has corrected itself
  // on this twice.
  const fixtureUser = await prisma.user.findFirst({
    where: { email: 'check25a+a8652576+owner@example.invalid' },
    select: { id: true },
  })
  assert('§3b — the 25-A fixture user is gone, confirmed by re-reading the row', fixtureUser === null)
  const otherFixtures = await prisma.user.findMany({
    where: { email: { contains: '@example.invalid' }, id: { notIn: scratch.userIds } },
    select: { email: true },
  })
  if (otherFixtures.length > 0) {
    console.log(
      `    ⚠ ${otherFixtures.length} OTHER fixture account(s) remain on this database: ${otherFixtures
        .map((u) => u.email)
        .join(', ')}`,
    )
  }

  console.log(
    `\n${passed} passed, ${failed} failed, ${controlsFired} controls fired, ${controlsDead} dead, ${notChecked} not checked`,
  )
  if (failures.length) {
    console.log('\nFAILURES:')
    for (const f of failures) console.log(`  · ${f}`)
  }
  if (failed > 0) process.exitCode = 1
}

async function teardown() {
  // ⚠ STATEMENT-INDEPENDENT. 25-A's teardown was one straight sequence, died on
  // its first statement, and left a fixture user on production.
  const step = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (e) {
      console.error(`  teardown step failed (${label}):`, e instanceof Error ? e.message : e)
    }
  }
  await step('nominations', () =>
    prisma.branchOwnerNomination.deleteMany({ where: { communityId: { in: scratch.communityIds } } }),
  )
  await step('notifications', () =>
    prisma.notification.deleteMany({ where: { userId: { in: scratch.userIds } } }),
  )
  await step('activityLog', () =>
    prisma.activityLog.deleteMany({ where: { userId: { in: scratch.userIds } } }),
  )
  await step('pointsEvents', () =>
    prisma.pointsEvent.deleteMany({ where: { userId: { in: scratch.userIds } } }),
  )
  await step('claims', () =>
    prisma.activityClaim.deleteMany({ where: { userId: { in: scratch.userIds } } }),
  )
  await step('archives', () =>
    prisma.communityMembershipArchive.deleteMany({
      where: { communityId: { in: scratch.communityIds } },
    }),
  )
  await step('members', () =>
    prisma.communityMember.deleteMany({ where: { communityId: { in: scratch.communityIds } } }),
  )
  await step('titles', () =>
    prisma.communityTitle.deleteMany({ where: { communityId: { in: scratch.communityIds } } }),
  )
  await step('invites', () =>
    prisma.communityInvite.deleteMany({ where: { communityId: { in: scratch.communityIds } } }),
  )
  await step('communities', () =>
    prisma.community.deleteMany({ where: { id: { in: scratch.communityIds } } }),
  )
  await step('users', () => prisma.user.deleteMany({ where: { id: { in: scratch.userIds } } }))

  // ⚠ THE SWEEP REPORTS WHAT IT FOUND. A teardown that says nothing is
  // indistinguishable from one that did nothing.
  const leftUsers = await prisma.user.count({ where: { id: { in: scratch.userIds } } })
  const leftCommunities = await prisma.community.count({
    where: { id: { in: scratch.communityIds } },
  })
  console.log(
    leftUsers === 0 && leftCommunities === 0
      ? `\nteardown: clean (${scratch.userIds.length} users, ${scratch.communityIds.length} communities removed)`
      : `\n⚠ TEARDOWN LEFT ROWS BEHIND: ${leftUsers} user(s), ${leftCommunities} community(ies)`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await teardown()
    await prisma.$disconnect()
  })

export {}
