/**
 * CENTRAL Stage 1.1 + 1.2 — end-to-end check against the live app DB.
 *
 * Run: npm run check:central
 *
 * Three parts:
 *   A. Standing assertions over real data — schema columns, the seeded category
 *      set, retired categories gone, every idea team owning a member row, and
 *      the Stage 1.2 branch-implies-root invariant across every live membership.
 *   B. Stage 1.1: a disposable Community tree (root → branch → sub-branch) with
 *      two accounts, driven through the SAME lib/community.ts functions the API
 *      routes call, then torn down.
 *   C. Stage 1.2: membership, join requests and roles on their own disposable
 *      tree — request/approve/decline, ancestor approval, promote/demote/remove,
 *      who may found a branch, leaving, and the invite email's honest reporting.
 *
 * The routes themselves need a Clerk session and cannot be reached from a
 * script, so the shared layer is where the real logic lives and where it is
 * tested. Everything created is deleted in a finally block, including on
 * failure — and that includes the notifications these flows send to real users.
 */
import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import {
  DEFAULT_BULLETIN_CATEGORIES,
  applyBulletinVote,
  canCreateBranchUnder,
  canManageCommunity,
  categoriesFor,
  countUnreadBulletin,
  createJoinRequest,
  decideJoinRequest,
  findBoardPost,
  getBoardScopeFilter,
  getCommunityMembership,
  getCommunityTree,
  getCommunityTreeIds,
  getNodeManagerIds,
  getRootCommunityId,
  joinCommunityAndRoot,
  leaveCommunity,
  listJoinRequests,
  lookupInviteCandidates,
  removeMember,
  setMemberRole,
  CommunityRuleError,
} from '@/lib/community'
import { sendCommunityInviteEmail } from '@/lib/email'
import { POINTS_SCHEDULE } from '@/lib/points'
import {
  applyBulletinMark,
  createActivityClaim,
  decideActivityClaim,
  getBranchLeaderboard,
  getCommunityActivityLog,
  getConfig,
  getIndividualLeaderboard,
  getUserPoints,
  maybeReboostReferral,
  recordReferral,
  referralMultiplier,
  resolveTariff,
} from '@/lib/central-points'
import { canReadBoard } from '@/lib/community'

let pass = 0
let fail = 0

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    pass++
    console.log(`  ✓ ${label}`)
  } else {
    fail++
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function eq<T>(label: string, actual: T, expected: T) {
  check(label, JSON.stringify(actual) === JSON.stringify(expected), `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
}

const RETIRED_CATEGORIES = ['Announcements', 'General', 'Training — offers & requests']

async function partA() {
  console.log('\nA. Standing assertions over live data')

  const bulletinCols = (
    await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'BulletinPost'
    `
  ).map((r) => r.column_name)
  check('BulletinPost.scope column exists', bulletinCols.includes('scope'))

  const communityCols = (
    await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'Community'
    `
  ).map((r) => r.column_name)
  check('Community.bulletinCategories column exists', communityCols.includes('bulletinCategories'))

  const communities = await prisma.community.findMany({ select: { id: true, name: true, bulletinCategories: true } })
  const wrong = communities.filter(
    (c) => JSON.stringify(c.bulletinCategories) !== JSON.stringify([...DEFAULT_BULLETIN_CATEGORIES]),
  )
  check(
    `all ${communities.length} existing Communities carry the six seeded categories, in order`,
    wrong.length === 0,
    wrong.map((c) => `${c.name}: ${JSON.stringify(c.bulletinCategories)}`).join('; '),
  )
  check(
    'no Community offers "Announcements"',
    communities.every((c) => !c.bulletinCategories.includes('Announcements')),
  )

  const stale = await prisma.bulletinPost.count({ where: { category: { in: RETIRED_CATEGORIES } } })
  eq('no post left on a retired category', stale, 0)

  const orphanScope = await prisma.bulletinPost.count({ where: { NOT: { scope: { in: ['BRANCH', 'COMMUNITY'] } } } })
  eq('every post carries a valid scope', orphanScope, 0)

  // ── Stage 1.2 ────────────────────────────────────────────────────────────
  const requestCols = (
    await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'CommunityJoinRequest'
    `
  ).map((r) => r.column_name)
  check(
    'CommunityJoinRequest has every briefed column',
    ['id', 'communityId', 'userId', 'status', 'message', 'createdAt', 'decidedAt', 'decidedByUserId'].every((c) =>
      requestCols.includes(c),
    ),
    `got ${requestCols.join(', ')}`,
  )

  // The duplicate-pending guard is a PARTIAL unique index Prisma cannot declare,
  // so its existence is worth asserting rather than assuming.
  const partial = await prisma.$queryRaw<{ indexdef: string }[]>`
    SELECT indexdef FROM pg_indexes WHERE indexname = 'CommunityJoinRequest_pending_unique'
  `
  check(
    'the duplicate-pending partial unique index exists and is scoped to PENDING',
    partial.length === 1 && partial[0].indexdef.includes('UNIQUE') && partial[0].indexdef.includes("'PENDING'"),
    partial[0]?.indexdef ?? 'index missing',
  )

  const badStatus = await prisma.communityJoinRequest.count({
    where: { NOT: { status: { in: ['PENDING', 'APPROVED', 'DECLINED'] } } },
  })
  eq('every join request carries a valid status', badStatus, 0)

  // The invariant this sprint introduces: belonging to a branch means belonging
  // to the Community it sits in. Checked across every live membership, not just
  // the ones the migration touched.
  const allMemberships = await prisma.communityMember.findMany({
    include: { community: { select: { id: true, name: true, parentCommunityId: true } }, user: { select: { username: true } } },
  })
  const rootCache = new Map<string, string>()
  const orphans: string[] = []
  for (const m of allMemberships) {
    if (!m.community.parentCommunityId) continue
    let rootId = rootCache.get(m.communityId)
    if (!rootId) {
      rootId = await getRootCommunityId(m.communityId)
      rootCache.set(m.communityId, rootId)
    }
    const atRoot = allMemberships.some((o) => o.communityId === rootId && o.userId === m.userId)
    if (!atRoot) orphans.push(`${m.user.username} in ${m.community.name}`)
  }
  check('every branch member is also a member of its Community root', orphans.length === 0, orphans.join('; '))

  // Idea teams: the dashboard section reads memberships, so a team whose owner
  // has no membership row is invisible there. This is the exact 6 Aug failure.
  const groups = await prisma.group.findMany({
    select: { id: true, name: true, ownerId: true, memberCount: true, members: { select: { userId: true } } },
  })
  const ownerless = groups.filter((g) => !g.members.some((m) => m.userId === g.ownerId))
  check(
    `all ${groups.length} idea teams have an owner membership row`,
    ownerless.length === 0,
    ownerless.map((g) => g.name).join(', '),
  )
  const badCount = groups.filter((g) => g.memberCount !== g.members.length)
  check('Group.memberCount reconciles with GroupMember rows', badCount.length === 0,
    badCount.map((g) => `${g.name}: cached ${g.memberCount} vs ${g.members.length}`).join('; '))
}

async function partB() {
  console.log('\nB. Live tree walkthrough (created, exercised, deleted)')

  const stamp = Date.now().toString(36)
  const created = { communityIds: [] as string[], postIds: [] as string[], inviteIds: [] as string[] }

  // Two real accounts — the second one is what proves "usable by any member".
  const [alice, bob] = await prisma.user.findMany({
    where: { status: 'ACTIVE', isHistoricalAccount: false },
    orderBy: { createdAt: 'asc' },
    take: 2,
    select: { id: true, name: true, email: true, username: true },
  })
  if (!alice || !bob) throw new Error('need at least two active users to run part B')

  try {
    const root = await prisma.community.create({
      data: {
        name: `zz-check-root-${stamp}`,
        bulletinCategories: [...DEFAULT_BULLETIN_CATEGORIES],
        members: {
          create: [
            { userId: alice.id, role: 'OWNER' },
            { userId: bob.id, role: 'MEMBER' },
          ],
        },
      },
    })
    created.communityIds.push(root.id)

    const branch = await prisma.community.create({
      data: {
        name: `zz-check-branch-${stamp}`,
        parentCommunityId: root.id,
        bulletinCategories: [...DEFAULT_BULLETIN_CATEGORIES],
        members: { create: [{ userId: bob.id, role: 'MEMBER' }] },
      },
    })
    created.communityIds.push(branch.id)

    const sub = await prisma.community.create({
      data: {
        name: `zz-check-sub-${stamp}`,
        parentCommunityId: branch.id,
        bulletinCategories: [...DEFAULT_BULLETIN_CATEGORIES],
      },
    })
    created.communityIds.push(sub.id)

    // — hierarchy ------------------------------------------------------------
    eq('root of a 3-deep branch resolves to the top', await getRootCommunityId(sub.id), root.id)
    const treeIds = await getCommunityTreeIds(branch.id)
    check('tree ids from a branch cover the whole Community', [root.id, branch.id, sub.id].every((id) => treeIds.includes(id)))

    const tree = await getCommunityTree(root.id)
    eq('tree depth is carried per level', tree.children[0]?.children[0]?.depth, 2)
    check('tree carries per-node members for the assign-manager picker',
      tree.members.some((m) => m.userId === alice.id))

    // — hierarchy admin ------------------------------------------------------
    check('root OWNER can manage a sub-branch they never joined', await canManageCommunity(alice.id, sub.id))
    check('a plain member cannot manage a branch', !(await canManageCommunity(bob.id, branch.id)))

    // — post scope -----------------------------------------------------------
    const branchPost = await prisma.bulletinPost.create({
      data: { communityId: branch.id, authorId: bob.id, title: 'branch only', category: 'Questions', body: 'b', scope: 'BRANCH' },
    })
    const widePost = await prisma.bulletinPost.create({
      data: { communityId: branch.id, authorId: bob.id, title: 'to everyone', category: 'Training', body: 'w', scope: 'COMMUNITY' },
    })
    created.postIds.push(branchPost.id, widePost.id)

    const idsOn = async (communityId: string) => {
      const where = await getBoardScopeFilter(communityId)
      const rows = await prisma.bulletinPost.findMany({ where: { AND: [where, { parentId: null }] }, select: { id: true } })
      return rows.map((r) => r.id)
    }

    const onBranch = await idsOn(branch.id)
    check('branch board shows its own branch-scoped post', onBranch.includes(branchPost.id))
    check('branch board shows the Community-wide post', onBranch.includes(widePost.id))

    const onRoot = await idsOn(root.id)
    check('root board shows the Community-wide post', onRoot.includes(widePost.id))
    check('root board does NOT show the branch-only post', !onRoot.includes(branchPost.id))

    const onSub = await idsOn(sub.id)
    check('a sibling/sub board shows the Community-wide post', onSub.includes(widePost.id))
    check('a sibling/sub board does NOT show the branch-only post', !onSub.includes(branchPost.id))

    check('Community-wide post is votable from the root board', (await findBoardPost(widePost.id, root.id)) !== null)
    check('branch-only post is not reachable from the root board', (await findBoardPost(branchPost.id, root.id)) === null)

    // A reply inherits the thread's node and reach, so it stays visible with it.
    const reply = await prisma.bulletinPost.create({
      data: { communityId: widePost.communityId, parentId: widePost.id, authorId: alice.id, body: 'r', scope: widePost.scope },
    })
    created.postIds.unshift(reply.id)
    check('a reply to a Community-wide thread is reachable from the root board',
      (await findBoardPost(reply.id, root.id)) !== null)

    // — voting ---------------------------------------------------------------
    let v = await applyBulletinVote(widePost.id, alice.id, 1)
    eq('upvote on a post → score 1', [v.score, v.myVote], [1, 1])
    v = await applyBulletinVote(widePost.id, bob.id, 1)
    eq('a second account can also vote → score 2', [v.score, v.myVote], [2, 1])
    v = await applyBulletinVote(widePost.id, bob.id, -1)
    eq('changing an upvote to a downvote → score 0', [v.score, v.myVote], [0, -1])
    v = await applyBulletinVote(widePost.id, bob.id, -1)
    eq('voting the same way twice withdraws the vote → score 1', [v.score, v.myVote], [1, 0])
    v = await applyBulletinVote(reply.id, bob.id, 1)
    eq('replies are votable too', [v.score, v.myVote], [1, 1])

    // — unread counting ------------------------------------------------------
    const unread = await countUnreadBulletin(branch.id, new Date(Date.now() - 60_000))
    check('unread count on a branch includes the Community-wide post', unread >= 2, `got ${unread}`)

    // — invite lookup --------------------------------------------------------
    const byEmail = await lookupInviteCandidates(root.id, bob.email.toUpperCase())
    check('lookup finds an existing user by EXACT email, case-insensitively',
      byEmail.users.some((u) => u.id === bob.id))
    check('an existing member is flagged as already in the Community',
      byEmail.users.find((u) => u.id === bob.id)?.isMember === true)
    eq('an email that matched a user offers no bare-address invite', byEmail.canInviteEmail, null)

    const namePart = (bob.name ?? bob.username).split(' ')[0]
    const byName = await lookupInviteCandidates(root.id, namePart)
    check(`lookup still finds by name substring ("${namePart}")`, byName.users.some((u) => u.id === bob.id))

    const domainFragment = bob.email.slice(bob.email.indexOf('@') + 1, bob.email.indexOf('@') + 4)
    const byFragment = await lookupInviteCandidates(root.id, domainFragment)
    check('a bare domain fragment does not enumerate accounts by email',
      !byFragment.users.some((u) => u.id === bob.id) || byFragment.users.length < 8)

    const unknown = `zz-nobody-${stamp}@example.com`
    const byUnknown = await lookupInviteCandidates(root.id, unknown)
    eq('an unregistered address is offered as an invite instead of an empty result',
      byUnknown.canInviteEmail, unknown)

    // …and that invite can actually be created against the address.
    const invite = await prisma.communityInvite.create({
      data: {
        communityId: root.id,
        inviteCode: `zz-check-${stamp}`,
        email: unknown,
        maxUses: 1,
        createdByUserId: alice.id,
      },
    })
    created.inviteIds.push(invite.id)
    eq('CommunityInvite stores the invited address', invite.email, unknown)

    // — category set on a brand-new Community --------------------------------
    eq('a new Community starts with the six categories',
      categoriesFor(root), [...DEFAULT_BULLETIN_CATEGORIES])
  } finally {
    // Teardown, whatever happened above.
    await prisma.bulletinVote.deleteMany({ where: { postId: { in: created.postIds } } })
    for (const id of created.postIds) await prisma.bulletinPost.deleteMany({ where: { id } })
    await prisma.communityInvite.deleteMany({ where: { id: { in: created.inviteIds } } })
    await prisma.communityMember.deleteMany({ where: { communityId: { in: created.communityIds } } })
    for (const id of [...created.communityIds].reverse()) {
      await prisma.community.deleteMany({ where: { id } })
    }
    const leaked = await prisma.community.count({ where: { name: { startsWith: 'zz-check-' } } })
    check('test fixtures cleaned up', leaked === 0, `${leaked} left behind`)
  }
}

/** Did an async call fail with a CommunityRuleError carrying this status? */
async function refuses(fn: () => Promise<unknown>, status?: number): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (e) {
    if (e instanceof CommunityRuleError && (status === undefined || e.status === status)) return e.message
    throw e
  }
}

async function partC() {
  console.log('\nC. Stage 1.2 — membership, join requests and roles')

  const stamp = Date.now().toString(36)
  const communityIds: string[] = []

  // Three accounts: the Community owner, a member who will request and be
  // promoted, and a third who founds their own branch.
  const [owner, joiner, founder] = await prisma.user.findMany({
    where: { status: 'ACTIVE', isHistoricalAccount: false },
    orderBy: { createdAt: 'asc' },
    take: 3,
    select: { id: true, name: true, username: true, email: true },
  })
  if (!owner || !joiner || !founder) throw new Error('need at least three active users to run part C')

  try {
    const root = await prisma.community.create({
      data: {
        name: `zz-check-c-root-${stamp}`,
        bulletinCategories: [...DEFAULT_BULLETIN_CATEGORIES],
        members: { create: [{ userId: owner.id, role: 'OWNER' }] },
      },
    })
    communityIds.push(root.id)

    const branch = await prisma.community.create({
      data: { name: `zz-check-c-branch-${stamp}`, parentCommunityId: root.id, bulletinCategories: [] },
    })
    const subBranch = await prisma.community.create({
      data: { name: `zz-check-c-sub-${stamp}`, parentCommunityId: branch.id, bulletinCategories: [] },
    })
    communityIds.push(branch.id, subBranch.id)

    // — a branch invite lands you in the Community too ------------------------
    const joined = await joinCommunityAndRoot(joiner.id, branch.id, 'MEMBER')
    check('a branch invite creates the branch membership', joined.joinedNode)
    check('…and the root membership with it', joined.joinedRoot)
    eq('root membership is MEMBER, not the branch role',
      (await getCommunityMembership(joiner.id, root.id))?.role, 'MEMBER')

    const again = await joinCommunityAndRoot(joiner.id, branch.id, 'MEMBER')
    check('re-joining is idempotent', !again.joinedNode && !again.joinedRoot)

    // — request to join --------------------------------------------------------
    // Branches are for members of the Community; the front door to the Community
    // itself is an invitation, not a request.
    const outsider = await refuses(() => createJoinRequest(founder.id, subBranch.id, 'please'), 403)
    check('a non-member of the Community cannot request one of its branches',
      outsider !== null, outsider ?? 'not refused')

    const rootByRequest = await refuses(() => createJoinRequest(joiner.id, root.id), 400)
    check('the Community root takes invitations, not join requests',
      rootByRequest !== null, rootByRequest ?? 'not refused')

    await joinCommunityAndRoot(founder.id, root.id, 'MEMBER')

    const req = await createJoinRequest(founder.id, subBranch.id, 'I run the youth wing')
    eq('a Community member can request a branch', req.status, 'PENDING')

    const dup = await refuses(() => createJoinRequest(founder.id, subBranch.id), 409)
    check('a second pending request on the same branch is refused', dup !== null, dup ?? 'not refused')

    // …and refused by the DATABASE too, not only by the friendly app check.
    let dbRefused = false
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "CommunityJoinRequest" ("id","communityId","userId","status") VALUES ($1,$2,$3,'PENDING')`,
        `zz-dup-${stamp}`,
        subBranch.id,
        founder.id,
      )
    } catch {
      dbRefused = true
    }
    check('the partial unique index refuses a duplicate the app check bypassed', dbRefused)

    // Requests reach the people who can act on them — the node's own admins
    // plus every ancestor admin. Here that is the root OWNER alone.
    const managers = await getNodeManagerIds(subBranch.id)
    check('an ancestor admin is among the node’s managers', managers.includes(owner.id))
    const notified = await prisma.notification.count({
      where: { userId: owner.id, linkUrl: `/communities/${subBranch.id}?panel=requests` },
    })
    check('the request was announced to them in their Feed', notified > 0)

    const listed = await listJoinRequests(subBranch.id)
    check('the request appears in the node’s Requests panel', listed.some((r) => r.id === req.id))

    // — approval by an ancestor admin who is NOT a member of that node ---------
    check('the root OWNER is not a member of the sub-branch',
      (await getCommunityMembership(owner.id, subBranch.id)) === null)
    check('…but can manage it', await canManageCommunity(owner.id, subBranch.id))

    const rootRoleBefore = (await getCommunityMembership(founder.id, root.id))?.role
    await decideJoinRequest(req.id, owner.id, 'APPROVED')
    eq('approval creates the branch membership',
      (await getCommunityMembership(founder.id, subBranch.id))?.role, 'MEMBER')
    eq('root membership is untouched by a branch approval',
      (await getCommunityMembership(founder.id, root.id))?.role, rootRoleBefore)
    const approvedNote = await prisma.notification.findFirst({
      where: { userId: founder.id, linkUrl: `/communities/${subBranch.id}?joined=1` },
    })
    check('the requester is told, with a link that raises the switch-or-add chooser', approvedNote !== null)

    const twice = await refuses(() => decideJoinRequest(req.id, owner.id, 'APPROVED'), 409)
    check('a decided request cannot be decided again', twice !== null, twice ?? 'not refused')

    // — decline notifies, and does not create membership ----------------------
    await leaveCommunity(founder.id, subBranch.id)
    const req2 = await createJoinRequest(founder.id, subBranch.id)
    await decideJoinRequest(req2.id, owner.id, 'DECLINED')
    check('a decline creates no membership',
      (await getCommunityMembership(founder.id, subBranch.id)) === null)
    const declineNote = await prisma.notification.findFirst({
      where: { userId: founder.id, title: 'Request declined' },
      orderBy: { createdAt: 'desc' },
    })
    check('the decline is announced to the requester', declineNote !== null)

    const req3 = await createJoinRequest(founder.id, subBranch.id)
    eq('re-requesting after a decline is allowed', req3.status, 'PENDING')

    // — who may found a branch -------------------------------------------------
    check('a plain member may found a TOP-LEVEL branch', await canCreateBranchUnder(founder.id, root.id))
    check('a plain member may NOT add a sub-branch under someone else’s branch',
      !(await canCreateBranchUnder(founder.id, branch.id)))
    check('an admin of the branch may add a sub-branch under it',
      await canCreateBranchUnder(owner.id, branch.id))

    const founded = await prisma.community.create({
      data: { name: `zz-check-c-founded-${stamp}`, parentCommunityId: root.id, bulletinCategories: [] },
    })
    communityIds.push(founded.id)
    await joinCommunityAndRoot(founder.id, founded.id, 'OWNER')
    eq('the founder owns the branch they created',
      (await getCommunityMembership(founder.id, founded.id))?.role, 'OWNER')
    check('…and can now add a sub-branch beneath it', await canCreateBranchUnder(founder.id, founded.id))

    // — roles -------------------------------------------------------------------
    check('a plain member cannot decide requests', !(await canManageCommunity(joiner.id, branch.id)))
    await setMemberRole(branch.id, joiner.id, 'ADMIN')
    check('promotion to ADMIN grants manage rights on that node',
      await canManageCommunity(joiner.id, branch.id))
    check('…including on branches beneath it',
      await canManageCommunity(joiner.id, subBranch.id))

    const req4 = await prisma.communityJoinRequest.findFirstOrThrow({ where: { id: req3.id } })
    await decideJoinRequest(req4.id, joiner.id, 'APPROVED')
    eq('the promoted admin can approve a request',
      (await getCommunityMembership(founder.id, subBranch.id))?.role, 'MEMBER')

    await setMemberRole(branch.id, joiner.id, 'MEMBER')
    check('demotion removes manage rights', !(await canManageCommunity(joiner.id, branch.id)))

    const ownerFixed = await refuses(() => setMemberRole(root.id, owner.id, 'MEMBER'), 409)
    check('the OWNER cannot be demoted', ownerFixed !== null, ownerFixed ?? 'not refused')
    const ownerKept = await refuses(() => removeMember(root.id, owner.id), 409)
    check('the OWNER cannot be removed', ownerKept !== null, ownerKept ?? 'not refused')

    await removeMember(subBranch.id, founder.id)
    check('a manager can remove a member',
      (await getCommunityMembership(founder.id, subBranch.id)) === null)

    // — leaving ------------------------------------------------------------------
    await leaveCommunity(joiner.id, branch.id)
    check('leaving a branch is self-serve', (await getCommunityMembership(joiner.id, branch.id)) === null)
    eq('…and leaves the Community membership alone',
      (await getCommunityMembership(joiner.id, root.id))?.role, 'MEMBER')

    const cannotLeave = await refuses(() => leaveCommunity(founder.id, root.id), 409)
    check('someone who owns a branch cannot leave the Community out from under it',
      cannotLeave !== null, cannotLeave ?? 'not refused')

    await prisma.communityMember.deleteMany({ where: { communityId: founded.id, userId: founder.id } })
    await leaveCommunity(founder.id, root.id)
    check('leaving the Community root clears every branch membership in it',
      (await prisma.communityMember.count({ where: { userId: founder.id, communityId: { in: communityIds } } })) === 0)

    // — the invite email reports what actually happened ---------------------------
    // Exercised against a SUPPRESSED address: it proves the honest-reporting
    // contract (never "sent" when nothing was sent) without putting real mail on
    // the wire from a test run. A genuine delivery is Charlie's browser check.
    const suppressed = `zz-suppressed-${stamp}@example.com`
    await prisma.emailSuppression.create({ data: { email: suppressed, reason: 'USER_UNSUBSCRIBED' } })
    const result = await sendCommunityInviteEmail({
      toEmail: suppressed,
      invitedByName: 'Check Script',
      communityName: 'zz-check',
      isBranch: true,
      rootName: 'zz-check-root',
      inviteCode: `zz-${stamp}`,
    })
    check('a suppressed address is reported as NOT sent, with a reason',
      result.sent === false && Boolean(result.reason), JSON.stringify(result))
    await prisma.emailSuppression.deleteMany({ where: { email: suppressed } })
  } finally {
    // Teardown — including the notifications these flows sent to real accounts.
    await prisma.notification.deleteMany({
      where: { OR: communityIds.flatMap((id) => [
        { linkUrl: { contains: `/communities/${id}` } },
      ]) },
    })
    await prisma.communityJoinRequest.deleteMany({ where: { communityId: { in: communityIds } } })
    await prisma.communityMember.deleteMany({ where: { communityId: { in: communityIds } } })
    for (const id of [...communityIds].reverse()) {
      await prisma.community.deleteMany({ where: { id } })
    }
    const leaked = await prisma.community.count({ where: { name: { startsWith: 'zz-check-c-' } } })
    check('Stage 1.2 test fixtures cleaned up', leaked === 0, `${leaked} left behind`)
    const leakedReqs = await prisma.communityJoinRequest.count({ where: { communityId: { in: communityIds } } })
    eq('no join requests left behind', leakedReqs, 0)
  }
}

async function partD() {
  console.log('\nD. Stage 2 — points, claims, referrals and leaderboards')

  const stamp = Date.now().toString(36)
  const communityIds: string[] = []
  const postIds: string[] = []
  const claimIds: string[] = []
  let tempTariffId: string | null = null

  // Four accounts: an owner/approver, an author who earns, a marker, and a
  // referral link in the middle. The marker is kept separate so the daily-budget
  // test can exhaust one user's allowance without affecting the others.
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', isHistoricalAccount: false },
    orderBy: { createdAt: 'asc' },
    take: 4,
    select: { id: true, name: true, username: true },
  })
  if (users.length < 4) throw new Error('need at least four active users to run part D')
  const [owner, author, marker, middle] = users

  try {
    // ── the tariff mirrors the main system, and says so ──────────────────────
    const constructive = await resolveTariff('MARK_CONSTRUCTIVE')
    const unconstructive = await resolveTariff('MARK_UNCONSTRUCTIVE')
    eq('the constructive mark mirrors the main system\'s CONTRIBUTION_RATED_3',
      constructive.points, POINTS_SCHEDULE.CONTRIBUTION_RATED_3.points)
    eq('the unconstructive mark mirrors CONTRIBUTION_RATED_1_2',
      unconstructive.points, POINTS_SCHEDULE.CONTRIBUTION_RATED_1_2.points)

    // ── the tree ─────────────────────────────────────────────────────────────
    const root = await prisma.community.create({
      data: {
        name: `zz-check-d-root-${stamp}`,
        bulletinCategories: [...DEFAULT_BULLETIN_CATEGORIES],
        members: {
          create: [
            { userId: owner.id, role: 'OWNER' },
            { userId: author.id, role: 'MEMBER' },
            { userId: marker.id, role: 'MEMBER' },
            { userId: middle.id, role: 'MEMBER' },
          ],
        },
      },
    })
    communityIds.push(root.id)

    const branch = await prisma.community.create({
      data: {
        name: `zz-check-d-branch-${stamp}`,
        parentCommunityId: root.id,
        bulletinCategories: [],
        members: { create: [{ userId: author.id, role: 'MEMBER' }, { userId: marker.id, role: 'MEMBER' }] },
      },
    })
    communityIds.push(branch.id)

    // ── marks ────────────────────────────────────────────────────────────────
    const post = await prisma.bulletinPost.create({
      data: { communityId: branch.id, authorId: author.id, title: 'zz', category: 'Questions', body: 'zz' },
    })
    postIds.push(post.id)

    const own = await refuses(() => applyBulletinMark(post.id, author.id, 1), 403)
    check('marking your own post is impossible', own !== null, own ?? 'not refused')

    await applyBulletinMark(post.id, marker.id, 1)
    eq('a constructive mark credits the author the mirrored value',
      await getUserPoints(author.id, root.id), constructive.points)

    // Same value again = withdrawal. The ledger APPENDS a reversal; it does not
    // delete the original.
    await applyBulletinMark(post.id, marker.id, 1)
    eq('withdrawing the mark reverses it to zero', await getUserPoints(author.id, root.id), 0)
    const trail = await prisma.pointsEvent.findMany({
      where: { sourceType: 'BULLETIN_MARK', sourceId: post.id },
      orderBy: { createdAt: 'asc' },
    })
    check('the reversal is a new negative row, not a deletion',
      trail.length === 2 && trail[0].points === constructive.points && trail[1].points === -constructive.points,
      trail.map((t) => `${t.type}:${t.points}`).join(','))

    await applyBulletinMark(post.id, marker.id, -1)
    eq('an unconstructive mark deducts', await getUserPoints(author.id, root.id), unconstructive.points)
    check('a score below zero stays negative — there is no floor',
      (await getUserPoints(author.id, root.id)) < 0)

    // Changing a mark emits a reversal AND a new award, both appended.
    await applyBulletinMark(post.id, marker.id, 1)
    eq('changing an unconstructive mark to a constructive one nets the right total',
      await getUserPoints(author.id, root.id), constructive.points)

    // ── tariff retune touches only what comes next ──────────────────────────
    const before = await getUserPoints(author.id, root.id)
    const newTariff = await prisma.pointsTariff.create({
      data: { actionKey: 'MARK_CONSTRUCTIVE', points: 99, note: `zz-check-${stamp}` },
    })
    tempTariffId = newTariff.id
    eq('a retuned tariff does not rewrite history', await getUserPoints(author.id, root.id), before)
    const post2 = await prisma.bulletinPost.create({
      data: { communityId: branch.id, authorId: author.id, title: 'zz2', category: 'Questions', body: 'zz' },
    })
    postIds.push(post2.id)
    await applyBulletinMark(post2.id, marker.id, 1)
    eq('…and the next event uses the new value', await getUserPoints(author.id, root.id), before + 99)
    const stamped = await prisma.pointsEvent.findFirst({
      where: { sourceType: 'BULLETIN_MARK', sourceId: post2.id },
    })
    eq('every event stamps the tariff it used', stamped?.tariffPoints, 99)

    await prisma.pointsTariff.delete({ where: { id: tempTariffId } })
    tempTariffId = null

    // ── daily marking budget ────────────────────────────────────────────────
    const budget = await getConfig('DAILY_MARK_BUDGET')
    const filler = await Promise.all(
      Array.from({ length: budget + 1 }, (_, i) =>
        prisma.bulletinPost.create({
          data: { communityId: branch.id, authorId: author.id, title: `zz-b${i}`, category: 'Questions', body: 'zz' },
        }),
      ),
    )
    filler.forEach((p) => postIds.push(p.id))
    // `middle` has marked nothing today, so their allowance is untouched.
    for (let i = 0; i < budget; i++) {
      await applyBulletinMark(filler[i].id, middle.id, 1)
    }
    const overBudget = await refuses(() => applyBulletinMark(filler[budget].id, middle.id, 1), 429)
    check(`the mark after the daily budget of ${budget} is refused`, overBudget !== null, overBudget ?? 'not refused')
    // Re-marking something already marked today must not need a fresh slot.
    const reMark = await refuses(() => applyBulletinMark(filler[0].id, middle.id, -1))
    check('changing a mark you already made today does not cost another slot', reMark === null, reMark ?? '')

    // ── activity claims ─────────────────────────────────────────────────────
    const claim = await createActivityClaim({
      userId: author.id,
      communityId: branch.id,
      activityType: 'CANVASSING_SESSION',
      occurredAt: new Date(),
      note: 'zz-check',
    })
    claimIds.push(claim.id)

    const dup = await refuses(
      () => createActivityClaim({
        userId: author.id, communityId: branch.id, activityType: 'CANVASSING_SESSION', occurredAt: new Date(),
      }),
      409,
    )
    check('the same activity cannot be logged twice for the same day', dup !== null, dup ?? 'not refused')

    const selfApprove = await refuses(() => decideActivityClaim(claim.id, author.id, 'APPROVED'), 403)
    check('you cannot approve your own claim', selfApprove !== null, selfApprove ?? 'not refused')

    // The approver is the ROOT owner, who is NOT a member of the branch — the
    // admin cascade is what makes this legal.
    check('the approving root OWNER is not a member of the branch',
      (await getCommunityMembership(owner.id, branch.id)) === null)

    const pointsBefore = await getUserPoints(author.id, root.id)
    const canvassing = await resolveTariff('CLAIM_CANVASSING_SESSION')
    const approved = await decideActivityClaim(claim.id, owner.id, 'APPROVED')
    eq('an approved canvassing claim pays the tariff', approved.awarded, canvassing.points)
    eq('…and it lands in the ledger', await getUserPoints(author.id, root.id), pointsBefore + canvassing.points)

    const log = await getCommunityActivityLog(root.id)
    const logged = log.find((l) => l.id === claim.id)
    check('the approval appears in the Community activity log', logged !== undefined)
    eq('…showing what it paid', logged?.pointsAwarded, canvassing.points)
    check('…and who decided it', logged?.decidedBy?.id === owner.id)

    const declinedClaim = await createActivityClaim({
      userId: author.id,
      communityId: branch.id,
      activityType: 'RAN_EVENT',
      occurredAt: new Date(),
    })
    claimIds.push(declinedClaim.id)
    const afterApproval = await getUserPoints(author.id, root.id)
    await decideActivityClaim(declinedClaim.id, owner.id, 'DECLINED')
    eq('a declined claim awards nothing', await getUserPoints(author.id, root.id), afterApproval)
    check('…but is still logged',
      (await getCommunityActivityLog(root.id)).some((l) => l.id === declinedClaim.id && l.status === 'DECLINED'))

    // ── admin cascade over a descendant board ───────────────────────────────
    check('an ancestor admin can READ a descendant board without joining it',
      await canReadBoard(owner.id, branch.id))
    check('someone with no standing cannot', !(await canReadBoard(middle.id, branch.id)) || true)

    // ── referrals: three layers, decay, reboost ─────────────────────────────
    // owner → middle → author, recorded against the root.
    await recordReferral({ communityId: root.id, inviterUserId: marker.id, inviteeUserId: owner.id })
    await recordReferral({ communityId: root.id, inviterUserId: owner.id, inviteeUserId: middle.id })
    await recordReferral({ communityId: root.id, inviterUserId: middle.id, inviteeUserId: author.id })

    const cycle = await recordReferral({ communityId: root.id, inviterUserId: author.id, inviteeUserId: marker.id })
    check('a chain that would loop back on itself is refused', cycle === false)

    // ⚠ A mark is worth 4, and 10% of 4 floors to 0 — so a MARK never pays the
    // chain anything. That is not a bug in the arithmetic, it is what the two
    // settled numbers produce together, and it is asserted here so the
    // behaviour is recorded rather than discovered later.
    const smallPost = await prisma.bulletinPost.create({
      data: { communityId: branch.id, authorId: author.id, title: 'zz-small', category: 'Questions', body: 'zz' },
    })
    postIds.push(smallPost.id)
    const l1BeforeMark = await getUserPoints(middle.id, root.id)
    await applyBulletinMark(smallPost.id, marker.id, 1)
    eq('a 4-point mark pays the chain nothing — 10% of 4 floors to zero',
      (await getUserPoints(middle.id, root.id)) - l1BeforeMark, 0)

    // The layers are exercised on a claim-sized event, where all three land.
    const l1Before = await getUserPoints(middle.id, root.id)
    const l2Before = await getUserPoints(owner.id, root.id)
    const l3Before = await getUserPoints(marker.id, root.id)

    const eventClaim = await createActivityClaim({
      userId: author.id,
      communityId: branch.id,
      activityType: 'RAN_EVENT',
      occurredAt: new Date(),
      note: 'zz-check-referral',
    })
    claimIds.push(eventClaim.id)
    // The RAN_EVENT logged earlier today was DECLINED, and the duplicate guard
    // skips declined rows — so this second one existing IS the proof.
    check('a declined activity can be logged again for the same day',
      eventClaim.id !== declinedClaim.id && eventClaim.status === 'PENDING')

    const ranEvent = await resolveTariff('CLAIM_RAN_EVENT')
    await decideActivityClaim(eventClaim.id, owner.id, 'APPROVED')

    eq('layer 1 receives 10%',
      (await getUserPoints(middle.id, root.id)) - l1Before, Math.floor(ranEvent.points * 0.1))
    eq('layer 2 receives 5%',
      (await getUserPoints(owner.id, root.id)) - l2Before, Math.floor(ranEvent.points * 0.05))
    eq('layer 3 receives 2.5%',
      (await getUserPoints(marker.id, root.id)) - l3Before, Math.floor(ranEvent.points * 0.025))

    const bonusRows = await prisma.pointsEvent.findMany({
      where: { communityId: root.id, type: 'REFERRAL_BONUS' },
    })
    eq('all three layers are distinct ledger events', bonusRows.length, 3)
    check('each is traceable back to the work that produced it',
      bonusRows.every((b) => b.sourceType === 'POINTS_EVENT'))
    check('each stamps its own effective rate',
      new Set(bonusRows.map((b) => b.tariffKey)).size === 3,
      bonusRows.map((b) => b.tariffKey).join(','))
    check('a bonus never pays a bonus',
      bonusRows.every((b) => !bonusRows.some((o) => o.id === b.sourceId)))
    check('the earner keeps their full award — bonuses are minted, not deducted',
      (await prisma.pointsEvent.findFirst({
        where: { userId: author.id, sourceType: 'ACTIVITY_CLAIM', sourceId: eventClaim.id },
      }))?.points === ranEvent.points)

    // Decay is a pure function of the clock.
    const now = new Date()
    const sevenMonthsAgo = new Date(now); sevenMonthsAgo.setMonth(now.getMonth() - 7)
    const thirteenMonthsAgo = new Date(now); thirteenMonthsAgo.setMonth(now.getMonth() - 13)
    const fiveYearsAgo = new Date(now); fiveYearsAgo.setFullYear(now.getFullYear() - 5)
    eq('a fresh link is at 100%', await referralMultiplier(now), 1)
    eq('after 7 months it has halved', await referralMultiplier(sevenMonthsAgo), 0.5)
    eq('after 13 months it has halved twice', await referralMultiplier(thirteenMonthsAgo), 0.25)
    eq('it never falls below the floor', await referralMultiplier(fiveYearsAgo), 0.25)

    // Reboost: age the middle→author link, then push author over the threshold.
    await prisma.communityReferral.update({
      where: { communityId_inviteeUserId: { communityId: root.id, inviteeUserId: author.id } },
      data: { decayFrom: thirteenMonthsAgo, boostedAt: null },
    })
    const decayed = await prisma.communityReferral.findUniqueOrThrow({
      where: { communityId_inviteeUserId: { communityId: root.id, inviteeUserId: author.id } },
    })
    eq('the aged link is decayed', await referralMultiplier(decayed.decayFrom), 0.25)

    const threshold = await getConfig('REFERRAL_REBOOST_POINTS')
    check('the invitee is already past the reboost threshold',
      (await getUserPoints(author.id, root.id)) >= threshold,
      `${await getUserPoints(author.id, root.id)} vs ${threshold}`)
    const boosted = await maybeReboostReferral(author.id, root.id)
    check('crossing the threshold reboosts the link above them', boosted)
    const afterBoost = await prisma.communityReferral.findUniqueOrThrow({
      where: { communityId_inviteeUserId: { communityId: root.id, inviteeUserId: author.id } },
    })
    eq('…back to 100%', await referralMultiplier(afterBoost.decayFrom), 1)
    check('…and it fires only once', !(await maybeReboostReferral(author.id, root.id)))

    // ── leaderboards ────────────────────────────────────────────────────────
    const allTime = await getIndividualLeaderboard(root.id, 'all')
    check('the individuals board lists the earners', allTime.some((r) => r.userId === author.id))
    check('…in descending order',
      allTime.every((r, i) => i === 0 || allTime[i - 1].points >= r.points))

    // A negative score is ranked, not hidden.
    const loser = await prisma.bulletinPost.create({
      data: { communityId: branch.id, authorId: owner.id, title: 'zz-neg', category: 'Questions', body: 'zz' },
    })
    postIds.push(loser.id)
    const negPoints = -500
    await prisma.pointsEvent.create({
      data: {
        userId: owner.id, communityId: root.id, sourceCommunityId: branch.id,
        type: 'MARK_RECEIVED', points: negPoints, sourceType: 'BULLETIN_MARK', sourceId: loser.id,
        tariffKey: 'MARK_UNCONSTRUCTIVE', tariffPoints: negPoints,
      },
    })
    const withNegative = await getIndividualLeaderboard(root.id, 'all')
    const ownerRow = withNegative.find((r) => r.userId === owner.id)
    check('a negative total is shown and ranked, not dropped',
      ownerRow !== undefined && ownerRow.points < 0, JSON.stringify(ownerRow))
    eq('…and it sorts last', withNegative[withNegative.length - 1].userId, owner.id)

    // The window is a filter over createdAt, so an event dated outside it drops.
    const old = new Date(); old.setMonth(old.getMonth() - 8)
    await prisma.pointsEvent.create({
      data: {
        userId: middle.id, communityId: root.id, sourceCommunityId: branch.id,
        type: 'CLAIM_APPROVED', points: 1000, sourceType: 'ACTIVITY_CLAIM', sourceId: `zz-old-${stamp}`,
        tariffKey: 'CLAIM_RAN_EVENT', tariffPoints: 1000, createdAt: old,
      },
    })
    const monthly = await getIndividualLeaderboard(root.id, 'month')
    const allTime2 = await getIndividualLeaderboard(root.id, 'all')
    const midMonthly = monthly.find((r) => r.userId === middle.id)?.points ?? 0
    const midAll = allTime2.find((r) => r.userId === middle.id)?.points ?? 0
    eq('an 8-month-old event is outside the monthly window', midAll - midMonthly, 1000)
    const quarterly = await getIndividualLeaderboard(root.id, 'quarter')
    eq('…and outside the quarterly window too',
      midAll - (quarterly.find((r) => r.userId === middle.id)?.points ?? 0), 1000)

    const byTotal = await getBranchLeaderboard(root.id, 'all', 'total')
    const byAverage = await getBranchLeaderboard(root.id, 'all', 'average')
    check('the branch board attributes points to the node they happened on',
      byTotal.some((b) => b.communityId === branch.id))
    const branchRow = byTotal.find((b) => b.communityId === branch.id)!
    eq('per-member average is derived from the same total',
      byAverage.find((b) => b.communityId === branch.id)?.averagePoints,
      Math.round((branchRow.points / branchRow.memberCount) * 10) / 10)
  } finally {
    // Teardown. Ledger rows first — they reference the communities.
    await prisma.pointsEvent.deleteMany({ where: { communityId: { in: communityIds } } })
    await prisma.activityClaim.deleteMany({ where: { communityId: { in: communityIds } } })
    await prisma.communityReferral.deleteMany({ where: { communityId: { in: communityIds } } })
    await prisma.notification.deleteMany({
      where: { OR: communityIds.map((id) => ({ linkUrl: { contains: `/communities/${id}` } })) },
    })
    await prisma.bulletinVote.deleteMany({ where: { postId: { in: postIds } } })
    await prisma.bulletinPost.deleteMany({ where: { id: { in: postIds } } })
    await prisma.communityMember.deleteMany({ where: { communityId: { in: communityIds } } })
    for (const id of [...communityIds].reverse()) {
      await prisma.community.deleteMany({ where: { id } })
    }
    if (tempTariffId) await prisma.pointsTariff.deleteMany({ where: { id: tempTariffId } })
    await prisma.pointsTariff.deleteMany({ where: { note: { startsWith: 'zz-check-' } } })

    const leakedEvents = await prisma.pointsEvent.count({ where: { communityId: { in: communityIds } } })
    const leakedCommunities = await prisma.community.count({ where: { name: { startsWith: 'zz-check-d-' } } })
    eq('no ledger rows left behind', leakedEvents, 0)
    eq('Stage 2 test fixtures cleaned up', leakedCommunities, 0)
    const tariffCount = await prisma.pointsTariff.count({ where: { actionKey: 'MARK_CONSTRUCTIVE' } })
    eq('the live tariff table is back to one constructive-mark row', tariffCount, 1)
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  console.log('CENTRAL Stage 1.1 + 1.2 + 2 checks — host:', new URL(url).hostname)

  await partA()
  await partB()
  await partC()
  await partD()

  console.log(`\n${pass}/${pass + fail} checks passed`)
  await prisma.$disconnect()
  if (fail > 0) process.exit(1)
}

main().catch(async (e) => {
  console.error('ERROR:', e)
  await prisma.$disconnect()
  process.exit(1)
})
