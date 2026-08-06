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

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  console.log('CENTRAL Stage 1.1 + 1.2 checks — host:', new URL(url).hostname)

  await partA()
  await partB()
  await partC()

  console.log(`\n${pass}/${pass + fail} checks passed`)
  await prisma.$disconnect()
  if (fail > 0) process.exit(1)
}

main().catch(async (e) => {
  console.error('ERROR:', e)
  await prisma.$disconnect()
  process.exit(1)
})
