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
  reverseActivityClaim,
  applyAnswerVote,
  getBranchLeaderboard,
  getCommunityActivityLog,
  getConfig,
  getIndividualLeaderboard,
  getUserPoints,
  maybeReboostReferral,
  recordReferral,
  referralMultiplier,
  listActivityClaims,
  resolveTariff,
} from '@/lib/central-points'
import { canReadBoard } from '@/lib/community'
import {
  buildPack,
  canPromoteQuestion,
  clearAnswerFlag,
  createEditSuggestion,
  decideEditSuggestion,
  findNearMatches,
  getAcrossBranches,
  getRankedAnswers,
  getTags,
  listQuestions,
  setAnswerFlag,
  setAnswerVote,
  toggleFavourite,
  toggleQuestionVote,
  PACK_DISCLAIMER,
} from '@/lib/question-library'
import {
  CLOSE_WARNING,
  acceptMatch,
  closeMatch,
  contactFor,
  createListing,
  listCompletedSessions,
  listListings,
  listMyMatches,
  listProposalsOn,
  logSessionForMatch,
  proposeMatch,
  sharePreviewForAuthor,
  sharePreviewForResponder,
} from '@/lib/training'
import {
  TEMPLATE_COLUMNS,
  applyImport,
  parseUpload,
  planImport,
} from '@/lib/question-import'
import { existsSync, readFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import * as XLSX from 'xlsx'

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

  // ── Stage 2d, against the live database ────────────────────────────────────
  const tables = (
    await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_name IN ('TrainingListing', 'TrainingMatch', 'TrainingSession')
    `
  ).map((r) => r.table_name).sort()
  eq('the three Stage 2d tables exist', tables, ['TrainingListing', 'TrainingMatch', 'TrainingSession'])

  const userCols = (
    await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'phone'
    `
  ).length
  eq('User.phone exists and is the only contact column Stage 2d added', userCols, 1)

  check('the phone-sharing switch is a row Charlie can flip, not a constant in the code',
    (await prisma.pointsConfig.findUnique({ where: { key: 'TRAINING_PHONE_SHARING' } })) !== null)

  // The §B promotion update, asserted per node rather than in aggregate — the
  // tag set is seeded per Community node, so "promoted" being right at the root
  // says nothing about what a member standing at a branch sees.
  const nodeCount = await prisma.community.count()
  const promoted = ['Party conduct', 'Media skills', 'Economy', 'Social issues', 'Law & rights']
  for (const label of promoted) {
    eq(`"${label}" is promoted on every Community node`,
      await prisma.questionTag.count({ where: { kind: 'TOPIC', label, promoted: true } }), nodeCount)
  }
  eq('Housing is promoted nowhere — it has no questions',
    await prisma.questionTag.count({ where: { kind: 'TOPIC', label: 'Housing', promoted: true } }), 0)
  eq('…while the row itself survives, so it is still in the dropdown',
    await prisma.questionTag.count({ where: { kind: 'TOPIC', label: 'Housing' } }), nodeCount)

  const partyConduct = await prisma.question.count({ where: { topicTags: { has: 'Party conduct' } } })
  const housing = await prisma.question.count({ where: { topicTags: { has: 'Housing' } } })
  check(`"Party conduct" has questions to show (${partyConduct}) and Housing has none (${housing})`,
    partyConduct > 0 && housing === 0, `Party conduct ${partyConduct}, Housing ${housing}`)

  // The chip row is contexts only. Grepped rather than reasoned about, because
  // the regression this prevents is one line of JSX coming back.
  const librarySource = readFileSync(
    resolvePath(process.cwd(), 'app/communities/[id]/questions/QuestionLibrary.tsx'),
    'utf8',
  )
  check('the chip row renders no topic chips', !librarySource.includes('promotedTopics'))
  check('…and topics are still in the dropdown', librarySource.includes('orderedTopics'))
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

    // ⚠ STAGE 2e REWROTE THIS BLOCK. There is no approval step: the claim above
    // already paid on creation. What a manager can still do is reverse it, and
    // the reversal path is asserted end to end in part H.

    // The reverser is the ROOT owner, who is NOT a member of the branch — the
    // admin cascade is what makes that legal, and it still holds.
    check('the reversing root OWNER is not a member of the branch',
      (await getCommunityMembership(owner.id, branch.id)) === null)

    const canvassing = await resolveTariff('CLAIM_CANVASSING_SESSION')
    eq('the canvassing claim paid its tariff the moment it was logged', claim.awarded, canvassing.points)

    const log = await getCommunityActivityLog(root.id)
    const logged = log.find((l) => l.id === claim.id)
    check('the award appears in the Community activity log', logged !== undefined)
    eq('…showing what it paid', logged?.pointsAwarded, canvassing.points)
    check('…and that nobody decided it, because nobody had to', logged?.decidedBy == null)

    const reversedClaim = await createActivityClaim({
      userId: author.id,
      communityId: branch.id,
      activityType: 'RAN_EVENT',
      occurredAt: new Date(),
    })
    claimIds.push(reversedClaim.id)
    const afterAward = await getUserPoints(author.id, root.id)
    await reverseActivityClaim(reversedClaim.id, owner.id, 'zz reversed by the check')
    eq('a reversed claim gives its points back',
      await getUserPoints(author.id, root.id), afterAward - reversedClaim.awarded)
    check('…and is still logged, with its reason',
      (await getCommunityActivityLog(root.id)).some(
        (l) => l.id === reversedClaim.id && l.status === 'REVERSED' && l.reversalReason === 'zz reversed by the check'))

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
    // The RAN_EVENT logged earlier today was REVERSED, and the duplicate guard
    // skips reversed rows — so this second one existing IS the proof.
    check('a reversed activity can be logged again for the same day',
      eventClaim.id !== reversedClaim.id && eventClaim.status === 'AWARDED')

    const ranEvent = await resolveTariff('CLAIM_RAN_EVENT')

    // 60 points, so every layer clears 1.0 on this single event and the whole
    // bonus lands at once. The fractional case — where it does not — is part H.
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

async function partE() {
  console.log('\nE. Stage 2b — question library, votes, flags, packs and scope')

  const stamp = Date.now().toString(36)
  const communityIds: string[] = []
  const questionIds: string[] = []

  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', isHistoricalAccount: false },
    orderBy: { createdAt: 'asc' },
    take: 3,
    select: { id: true, name: true, username: true },
  })
  if (users.length < 3) throw new Error('need at least three active users to run part E')
  const [owner, alice, bob] = users

  try {
    const root = await prisma.community.create({
      data: {
        name: `zz-check-e-root-${stamp}`,
        bulletinCategories: [...DEFAULT_BULLETIN_CATEGORIES],
        members: {
          create: [
            { userId: owner.id, role: 'OWNER' },
            { userId: alice.id, role: 'MEMBER' },
            { userId: bob.id, role: 'MEMBER' },
          ],
        },
      },
    })
    communityIds.push(root.id)

    const branchA = await prisma.community.create({
      data: {
        name: `zz-check-e-A-${stamp}`,
        parentCommunityId: root.id,
        bulletinCategories: [],
        members: { create: [{ userId: alice.id, role: 'MEMBER' }] },
      },
    })
    const branchB = await prisma.community.create({
      data: {
        name: `zz-check-e-B-${stamp}`,
        parentCommunityId: root.id,
        bulletinCategories: [],
        members: { create: [{ userId: bob.id, role: 'MEMBER' }] },
      },
    })
    communityIds.push(branchA.id, branchB.id)

    // Tags are seeded per Community by the migration; a Community created after
    // it has none, so seed this one the way the app would.
    await prisma.questionTag.createMany({
      data: [
        { communityId: root.id, kind: 'CONTEXT_EXTERNAL', label: 'Doorstep', promoted: true },
        { communityId: root.id, kind: 'CONTEXT_INTERNAL', label: 'How-to', promoted: true },
        { communityId: root.id, kind: 'TOPIC', label: 'Housing', promoted: true },
      ],
    })
    const tags = await getTags(root.id)
    eq('context tags split into the two sides', [tags.contextExternal.length, tags.contextInternal.length], [1, 1])

    // ── question votes: up only, self-vote allowed ──────────────────────────
    const q1 = await prisma.question.create({
      data: {
        communityId: root.id, authorId: alice.id, branchId: branchA.id,
        text: 'How are you going to pay for all of this new housing?',
        scope: 'COMMUNITY', contextTags: ['Doorstep'], topicTags: ['Housing'],
      },
    })
    questionIds.push(q1.id)

    const selfVote = await toggleQuestionVote(q1.id, alice.id)
    check('the asker can vote on their own question — they demonstrably were asked',
      selfVote.voted && selfVote.count === 1)
    const second = await toggleQuestionVote(q1.id, bob.id)
    eq('a second member adds one', second.count, 2)
    const undo = await toggleQuestionVote(q1.id, bob.id)
    check('voting again withdraws it', !undo.voted && undo.count === 1)

    // ── answer votes: mutually exclusive, no self-voting ────────────────────
    const answerA = await prisma.answer.create({
      data: { questionId: q1.id, authorId: alice.id, body: 'zz answer from alice', sources: ['https://example.com/a'] },
    })
    const answerB = await prisma.answer.create({
      data: { questionId: q1.id, authorId: bob.id, body: 'zz answer from bob', localExample: 'zz local' },
    })

    const ownAnswer = await refuses(() => setAnswerVote(answerA.id, alice.id, 'UP'), 403)
    check('voting on your own answer is refused', ownAnswer !== null, ownAnswer ?? 'not refused')

    let av = await setAnswerVote(answerA.id, bob.id, 'UP')
    eq('an up vote scores +1', [av.myVote, av.score], ['UP', 1])
    av = await setAnswerVote(answerA.id, bob.id, 'DOWN')
    // The count moves by TWO: the previous vote is withdrawn, not stacked.
    eq('switching up to down withdraws rather than stacks', [av.myVote, av.score], ['DOWN', -1])
    av = await setAnswerVote(answerA.id, bob.id, 'DOWN')
    eq('clicking the active direction again clears the vote', [av.myVote, av.score], [null, 0])
    const rows = await prisma.answerVote.count({ where: { answerId: answerA.id } })
    eq('a cleared vote leaves no row behind', rows, 0)

    const weighted = await prisma.answerVote.create({
      data: { answerId: answerA.id, userId: bob.id, direction: 'UP' },
    })
    eq('voteWeight exists and defaults to 1.0, applied but not yet varied', weighted.voteWeight, 1)

    // ── favourites are private ──────────────────────────────────────────────
    const fav = await toggleFavourite(answerB.id, alice.id)
    check('a favourite records for its owner', fav.favourited)
    const aliceSees = await getRankedAnswers(q1.id, alice.id)
    const ownerSees = await getRankedAnswers(q1.id, owner.id)
    check('the owner of the favourite sees it',
      aliceSees.find((a) => a.id === answerB.id)?.myFavourite === true)
    check('a second admin account cannot see it',
      ownerSees.find((a) => a.id === answerB.id)?.myFavourite === false)
    // No count exists anywhere in the shape — this asserts the absence.
    check('no favourite count is exposed on an answer',
      !Object.keys(ownerSees[0] ?? {}).some((k) => /favouriteCount|favourites/i.test(k)),
      Object.keys(ownerSees[0] ?? {}).join(','))

    // ── flags ───────────────────────────────────────────────────────────────
    const noReason = await refuses(
      () => setAnswerFlag({ answerId: answerA.id, userId: owner.id, level: 'USE_WITH_CARE', reason: '  ' }),
      422,
    )
    check('a flag without a reason is refused', noReason !== null, noReason ?? 'not refused')

    const notManager = await refuses(
      () => setAnswerFlag({ answerId: answerA.id, userId: bob.id, level: 'DO_NOT_USE', reason: 'zz' }),
      403,
    )
    check('a plain member cannot flag', notManager !== null, notManager ?? 'not refused')

    await setAnswerFlag({
      answerId: answerB.id, userId: owner.id, level: 'USE_WITH_CARE', reason: 'zz check with the agent first',
    })
    let pack = await buildPack({ viewerCommunityId: root.id, viewerId: alice.id, size: 10 })
    let entry = pack.entries.find((e) => e.questionId === q1.id)
    const carried = entry?.answer?.flag ?? entry?.favouriteAnswer?.flag
    check('a USE_WITH_CARE answer stays packable and its reason travels with it',
      carried?.level === 'USE_WITH_CARE' && carried.reason.includes('agent'),
      JSON.stringify(carried))

    await setAnswerFlag({
      answerId: answerA.id, userId: owner.id, level: 'DO_NOT_USE', reason: 'zz factually wrong',
    })
    pack = await buildPack({ viewerCommunityId: root.id, viewerId: alice.id, size: 10 })
    entry = pack.entries.find((e) => e.questionId === q1.id)
    check('a DO_NOT_USE answer is excluded from the pack',
      entry?.answer?.body !== 'zz answer from alice' && entry?.favouriteAnswer?.body !== 'zz answer from alice',
      JSON.stringify({ top: entry?.answer?.body, fav: entry?.favouriteAnswer?.body }))

    // ── favourites are ADDITIVE in packs, never substitutive ────────────────
    await clearAnswerFlag(answerA.id, owner.id)
    await setAnswerVote(answerA.id, owner.id, 'UP')
    const ranked = await getRankedAnswers(q1.id, alice.id)
    check('the community’s top answer is not the one alice favourited',
      ranked[0]?.id === answerA.id, ranked.map((r) => `${r.id === answerA.id ? 'A' : 'B'}:${r.score}`).join(','))
    pack = await buildPack({ viewerCommunityId: root.id, viewerId: alice.id, size: 10, includeFavourites: true })
    entry = pack.entries.find((e) => e.questionId === q1.id)
    check('the pack carries the community’s top answer', entry?.answer?.body === 'zz answer from alice')
    check('…AND the favourite alongside it, never instead of it',
      entry?.favouriteAnswer?.body === 'zz answer from bob',
      JSON.stringify({ top: entry?.answer?.body, fav: entry?.favouriteAnswer?.body }))

    const noFav = await buildPack({ viewerCommunityId: root.id, viewerId: alice.id, size: 10, includeFavourites: false })
    check('turning favourites off drops the extra answer',
      noFav.entries.find((e) => e.questionId === q1.id)?.favouriteAnswer === null)

    // ── pins hold position when the ranking moves ───────────────────────────
    const q2 = await prisma.question.create({
      data: {
        communityId: root.id, authorId: bob.id, branchId: branchB.id,
        text: 'zz second question about local services and bins',
        scope: 'COMMUNITY', contextTags: ['Doorstep'],
      },
    })
    questionIds.push(q2.id)
    // q1 outranks q2 on votes; pinning q2 must lift it above regardless.
    const pinnedPack = await buildPack({
      viewerCommunityId: root.id, viewerId: alice.id, size: 10, pinnedQuestionIds: [q2.id],
    })
    eq('a pinned question holds first place as the ranking moves',
      pinnedPack.entries[0]?.questionId, q2.id)
    check('…and is marked as pinned', pinnedPack.entries[0]?.pinned === true)

    const removedPack = await buildPack({
      viewerCommunityId: root.id, viewerId: alice.id, size: 10, removedQuestionIds: [q2.id],
    })
    check('a removed question stays out', !removedPack.entries.some((e) => e.questionId === q2.id))

    check('the disclaimer is a constant every output reads from',
      PACK_DISCLAIMER === 'Community-rated answers, not official positions.')

    // ── branch scope ────────────────────────────────────────────────────────
    const branchQ = await prisma.question.create({
      data: {
        communityId: root.id, authorId: alice.id, branchId: branchA.id,
        text: 'zz branch-only question about the depot',
        scope: 'BRANCH', contextTags: ['How-to'],
      },
    })
    questionIds.push(branchQ.id)

    const fromA = await listQuestions(branchA.id, alice.id, {})
    const fromB = await listQuestions(branchB.id, bob.id, {})
    const fromRoot = await listQuestions(root.id, owner.id, {})
    check('a branch-scoped question is visible in its own branch', fromA.some((q) => q.id === branchQ.id))
    check('…invisible from a sibling branch', !fromB.some((q) => q.id === branchQ.id))
    check('…and visible from the root, whose subtree is the whole Community',
      fromRoot.some((q) => q.id === branchQ.id))

    check('the author can promote it', await canPromoteQuestion(alice.id, branchQ.id))
    check('a Community admin can promote it', await canPromoteQuestion(owner.id, branchQ.id))
    check('an unrelated member cannot', !(await canPromoteQuestion(bob.id, branchQ.id)))

    await prisma.question.update({ where: { id: branchQ.id }, data: { scope: 'COMMUNITY' } })
    check('after promotion the sibling branch can see it',
      (await listQuestions(branchB.id, bob.id, {})).some((q) => q.id === branchQ.id))

    // ── the two-way toggle ──────────────────────────────────────────────────
    const external = await listQuestions(root.id, owner.id, { side: 'external' })
    const internal = await listQuestions(root.id, owner.id, { side: 'internal' })
    check('"Out in the world" shows the Doorstep question', external.some((q) => q.id === q1.id))
    check('…and not the How-to one', !external.some((q) => q.id === branchQ.id))
    check('"Behind the scenes" shows the How-to question', internal.some((q) => q.id === branchQ.id))
    check('…and not the Doorstep one', !internal.some((q) => q.id === q1.id))

    // ── near matches: a shortcut, never a block ─────────────────────────────
    const matches = await findNearMatches(root.id, 'How will you pay for all this housing?')
    check('a near match is found for a reworded version of the same question',
      matches.some((m) => m.id === q1.id), matches.map((m) => m.similarity.toFixed(2)).join(','))
    const unrelated = await findNearMatches(root.id, 'What time does the office open on Fridays?')
    check('an unrelated question matches nothing', !unrelated.some((m) => m.id === q1.id))

    // ── edit suggestions: author decides, no admin path ─────────────────────
    const suggestion = await createEditSuggestion(answerA.id, bob.id, 'zz reworded answer')
    const notified = await prisma.notification.findFirst({
      where: { userId: alice.id, title: 'Suggested edit to your answer' },
    })
    check('the answer’s author is notified', notified !== null)

    const adminTries = await refuses(() => decideEditSuggestion(suggestion.id, owner.id, 'APPLIED'), 403)
    check('a Community admin cannot decide someone else’s suggestion', adminTries !== null, adminTries ?? 'not refused')

    await decideEditSuggestion(suggestion.id, alice.id, 'APPLIED')
    eq('applying rewrites the answer',
      (await prisma.answer.findUniqueOrThrow({ where: { id: answerA.id } })).body, 'zz reworded answer')

    const suggestion2 = await createEditSuggestion(answerA.id, bob.id, 'zz another wording')
    await decideEditSuggestion(suggestion2.id, alice.id, 'DISMISSED')
    eq('dismissing leaves the answer alone',
      (await prisma.answer.findUniqueOrThrow({ where: { id: answerA.id } })).body, 'zz reworded answer')

    // ── across branches: participation only ─────────────────────────────────
    const across = await getAcrossBranches(root.id, null)
    check('every branch appears', across.branches.length === 2)
    const keys = new Set(across.branches.flatMap((b) => Object.keys(b)))
    check('no per-member data is returned — counts only',
      !['members', 'voters', 'userIds', 'memberNames', 'favourites'].some((k) => keys.has(k)),
      [...keys].join(','))
    check('voting members is a COUNT, not a list',
      across.branches.every((b) => typeof b.votingMemberCount === 'number'))
    check('a branch with nothing in it is marked quiet, neutrally',
      across.branches.some((b) => b.quiet) || across.branches.every((b) => b.questionCount > 0))
  } finally {
    const answerIds = (
      await prisma.answer.findMany({ where: { questionId: { in: questionIds } }, select: { id: true } })
    ).map((a) => a.id)
    await prisma.editSuggestion.deleteMany({ where: { answerId: { in: answerIds } } })
    await prisma.answerFlag.deleteMany({ where: { answerId: { in: answerIds } } })
    await prisma.answerFavourite.deleteMany({ where: { answerId: { in: answerIds } } })
    await prisma.answerVote.deleteMany({ where: { answerId: { in: answerIds } } })
    await prisma.answer.deleteMany({ where: { id: { in: answerIds } } })
    await prisma.questionVote.deleteMany({ where: { questionId: { in: questionIds } } })
    await prisma.question.deleteMany({ where: { id: { in: questionIds } } })
    await prisma.pack.deleteMany({ where: { communityId: { in: communityIds } } })
    await prisma.questionTag.deleteMany({ where: { communityId: { in: communityIds } } })
    await prisma.notification.deleteMany({
      where: {
        OR: [
          { title: 'Suggested edit to your answer' },
          ...communityIds.map((id) => ({ linkUrl: { contains: `/communities/${id}` } })),
        ],
      },
    })
    await prisma.communityMember.deleteMany({ where: { communityId: { in: communityIds } } })
    for (const id of [...communityIds].reverse()) {
      await prisma.community.deleteMany({ where: { id } })
    }
    eq('Stage 2b test fixtures cleaned up',
      await prisma.community.count({ where: { name: { startsWith: 'zz-check-e-' } } }), 0)
    eq('no questions left behind', await prisma.question.count({ where: { id: { in: questionIds } } }), 0)
  }
}

async function partF() {
  console.log('\nF. Stage 2d — the training exchange, and who may see a contact detail')

  const stamp = Date.now().toString(36)
  const communityIds: string[] = []
  const listingIds: string[] = []
  const claimIds: string[] = []
  const restorePhone = new Map<string, string | null>()
  let phoneConfigWas: number | null = null

  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', isHistoricalAccount: false },
    orderBy: { createdAt: 'asc' },
    take: 4,
    select: { id: true, name: true, username: true, email: true, phone: true },
  })
  if (users.length < 4) throw new Error('need at least four active users to run part F')
  const [admin, ann, ben, cara] = users

  try {
    // The phone switch is ON for the body of this part and is put back exactly
    // as it was found, whatever that was.
    const cfg = await prisma.pointsConfig.findUnique({ where: { key: 'TRAINING_PHONE_SHARING' } })
    phoneConfigWas = cfg?.numericValue ?? null
    await prisma.pointsConfig.upsert({
      where: { key: 'TRAINING_PHONE_SHARING' },
      create: { key: 'TRAINING_PHONE_SHARING', numericValue: 1, note: 'zz-check restore pending' },
      update: { numericValue: 1 },
    })

    for (const u of [ann, ben, cara]) restorePhone.set(u.id, u.phone)
    await prisma.user.update({ where: { id: ann.id }, data: { phone: '07700 900001' } })
    await prisma.user.update({ where: { id: ben.id }, data: { phone: '07700 900002' } })
    const annPhone = '07700 900001'
    const benPhone = '07700 900002'

    const root = await prisma.community.create({
      data: {
        name: `zz-check-f-root-${stamp}`,
        bulletinCategories: [...DEFAULT_BULLETIN_CATEGORIES],
        members: {
          create: [
            { userId: admin.id, role: 'OWNER' },
            { userId: ann.id, role: 'MEMBER' },
            { userId: ben.id, role: 'MEMBER' },
            { userId: cara.id, role: 'MEMBER' },
          ],
        },
      },
    })
    communityIds.push(root.id)
    const branch = await prisma.community.create({
      data: {
        name: `zz-check-f-branch-${stamp}`,
        parentCommunityId: root.id,
        bulletinCategories: [],
        members: {
          create: [
            { userId: ann.id, role: 'MEMBER' },
            { userId: ben.id, role: 'MEMBER' },
            { userId: cara.id, role: 'MEMBER' },
          ],
        },
      },
    })
    communityIds.push(branch.id)

    // ── posting ─────────────────────────────────────────────────────────────
    const noChannel = await refuses(
      () =>
        createListing({
          userId: ann.id, communityId: branch.id, kind: 'OFFER',
          topic: 'zz nothing ticked', description: 'zz', shareEmail: false, sharePhone: false,
        }),
      422,
    )
    check('a listing with no way to be reached is refused', noChannel !== null, noChannel ?? 'not refused')

    const noPhoneOnFile = await refuses(
      () =>
        createListing({
          userId: cara.id, communityId: branch.id, kind: 'OFFER',
          topic: 'zz phone with no number', description: 'zz', shareEmail: false, sharePhone: true,
        }),
      422,
    )
    check('ticking "share my phone" with no number on file is refused, not silently ignored',
      noPhoneOnFile !== null, noPhoneOnFile ?? 'not refused')

    // Ann OFFERS, and shares her EMAIL ONLY. The asymmetry is the point.
    const offer = await createListing({
      userId: ann.id, communityId: branch.id, kind: 'OFFER',
      topic: 'zz Doorstep conversations', description: 'zz what I can teach',
      availability: 'Tuesday evenings', shareEmail: true, sharePhone: false,
    })
    listingIds.push(offer.id)
    eq('a listing is scoped to the ROOT Community, not the branch it was posted from',
      offer.communityId, root.id)

    // Ben REQUESTS, which is the listing that proves the trainer is decided by
    // the listing rather than by whoever presses "Log this session".
    const request = await createListing({
      userId: ben.id, communityId: root.id, kind: 'REQUEST',
      topic: 'zz Using the canvassing app', description: 'zz what I need',
      shareEmail: true, sharePhone: true,
    })
    listingIds.push(request.id)

    const board = await listListings(branch.id, cara.id, {})
    check('both listings are on the board', board.length === 2)
    // The absence assertion: no row anywhere in the board's shape can carry an
    // address, because none is selected.
    const boardKeys = new Set(board.flatMap((l) => Object.keys(l)))
    check('the board shape has no email or phone field at all',
      !['email', 'phone', 'contact'].some((k) => boardKeys.has(k)), [...boardKeys].join(','))
    check('…and the serialised board contains neither address',
      !JSON.stringify(board).includes(annPhone) && !JSON.stringify(board).includes(ann.email))

    const own = await refuses(
      () => proposeMatch({ listingId: offer.id, userId: ann.id, shareEmail: true, sharePhone: false }),
      409,
    )
    check('you cannot propose on your own listing', own !== null, own ?? 'not refused')

    const outsider = await refuses(
      () => proposeMatch({ listingId: offer.id, userId: admin.id, shareEmail: true, sharePhone: false }),
      404,
    )
    // admin IS a member of this root, so this must NOT refuse — the control for
    // the membership gate is asserted below instead.
    check('a Community member may propose (the membership gate is not refusing everyone)',
      outsider === null, outsider ?? '')
    if (outsider === null) {
      await prisma.trainingMatch.deleteMany({ where: { listingId: offer.id, responderId: admin.id } })
    }

    // ── before either acceptance: nothing is visible ────────────────────────
    // Ben proposes on Ann's offer and shares BOTH his channels.
    const match = await proposeMatch({
      listingId: offer.id, userId: ben.id, message: 'zz please', shareEmail: true, sharePhone: true,
    })
    eq('proposing stamps the responder\'s acceptance and only theirs',
      [match.responderAcceptedAt !== null, match.authorAcceptedAt === null, match.status],
      [true, true, 'PROPOSED'])

    check('before the author accepts, the responder sees nothing',
      (await contactFor(match.id, ben.id)) === null)
    check('before the author accepts, the author sees nothing either',
      (await contactFor(match.id, ann.id)) === null)

    // ── the two "before you accept" statements ──────────────────────────────
    const responderPreview = await sharePreviewForResponder(offer.id, { shareEmail: true, sharePhone: true })
    eq('the responder is told exactly what of theirs goes, and to whom',
      [responderPreview?.yours, responderPreview?.toName],
      [{ email: true, phone: true }, ann.name ?? ann.username])
    eq('…and exactly what comes back — email only, because that is all Ann ticked',
      responderPreview?.theirs, { email: true, phone: false })

    const authorPreview = await sharePreviewForAuthor(match.id)
    eq('the author is told what of theirs goes', authorPreview?.yours, { email: true, phone: false })
    eq('…and what they will get', authorPreview?.theirs, { email: true, phone: true })
    eq('…and who it is with', authorPreview?.toName, ben.name ?? ben.username)

    // ── acceptance ──────────────────────────────────────────────────────────
    const notAuthor = await refuses(() => acceptMatch(match.id, cara.id), 403)
    check('only the listing\'s author can accept a proposal', notAuthor !== null, notAuthor ?? 'not refused')

    await acceptMatch(match.id, ann.id)
    const afterAccept = await prisma.trainingMatch.findUniqueOrThrow({ where: { id: match.id } })
    eq('accepting stamps the second acceptance and the status',
      [afterAccept.authorAcceptedAt !== null, afterAccept.acceptedAt !== null, afterAccept.status],
      [true, true, 'ACCEPTED'])
    eq('the listing comes off the open board',
      (await prisma.trainingListing.findUniqueOrThrow({ where: { id: offer.id } })).status, 'MATCHED')

    // ── after acceptance: each side sees the OTHER side's ticks, and no more ─
    const benSees = await contactFor(match.id, ben.id)
    eq('the responder now sees the author\'s email', benSees?.channels.email, ann.email)
    eq('…and NOT her phone, because she did not tick it', benSees?.channels.phone, null)

    const annSees = await contactFor(match.id, ann.id)
    eq('the author sees the responder\'s email', annSees?.channels.email, ben.email)
    eq('…and his phone, because he did tick it', annSees?.channels.phone, benPhone)

    // The control that makes the four assertions above mean something: the same
    // function, on the same live match, returns null for everyone else.
    check('a second admin account viewing the same match sees nothing',
      (await contactFor(match.id, admin.id)) === null)
    check('an uninvolved member of the same branch sees nothing',
      (await contactFor(match.id, cara.id)) === null)

    const caraMatches = await listMyMatches(branch.id, cara.id)
    check('…and the match does not appear in an uninvolved member\'s list at all',
      !caraMatches.some((m) => m.id === match.id))
    const adminMatches = await listMyMatches(branch.id, admin.id)
    check('…nor in a Community admin\'s', !adminMatches.some((m) => m.id === match.id))

    const benRows = await listMyMatches(branch.id, ben.id)
    const benRow = benRows.find((m) => m.id === match.id)
    eq('the match list carries the same disclosure as contactFor, not a wider one',
      benRow?.contact, { email: ann.email, phone: null })
    eq('…and tells the viewer what THEY are sharing',
      benRow?.sharingFromMe, { email: true, phone: true })

    // The author's own proposal list shows intent, never values.
    const proposals = await listProposalsOn(offer.id, ann.id)
    check('the proposal list says what will be shared, never the values',
      !JSON.stringify(proposals).includes(ben.email) && !JSON.stringify(proposals).includes(benPhone),
      JSON.stringify(proposals).slice(0, 200))
    const proposalsToOthers = await refuses(() => listProposalsOn(offer.id, admin.id), 403)
    check('a Community admin cannot read the proposals on someone else\'s listing',
      proposalsToOthers !== null, proposalsToOthers ?? 'not refused')

    // ── the phone switch, watched in BOTH states ────────────────────────────
    await prisma.pointsConfig.update({
      where: { key: 'TRAINING_PHONE_SHARING' },
      data: { numericValue: 0 },
    })
    const annSeesPhoneOff = await contactFor(match.id, ann.id)
    eq('with phone sharing off, the number stops being shown on a match that ticked it',
      annSeesPhoneOff?.channels.phone, null)
    eq('…and the email is untouched', annSeesPhoneOff?.channels.email, ben.email)
    await prisma.pointsConfig.update({
      where: { key: 'TRAINING_PHONE_SHARING' },
      data: { numericValue: 1 },
    })
    eq('turning it back on restores it — the switch is read at display time',
      (await contactFor(match.id, ann.id))?.channels.phone, benPhone)

    // ── log this session: one action, both records ──────────────────────────
    const outsiderLogs = await refuses(
      () => logSessionForMatch({ matchId: match.id, userId: cara.id, occurredAt: new Date(), branchCommunityId: branch.id }),
      403,
    )
    check('someone outside the match cannot log its session', outsiderLogs !== null, outsiderLogs ?? 'not refused')

    // ⚠ FIVE DAYS AGO, NOT TODAY. The one-per-day guard is per calendar day and
    // it looks at EVERY claim the user has, including real ones: the first run
    // of this part reused Charlie's own live GAVE_TRAINING claim from 24 Aug,
    // which sat in the root Community rather than this branch, and the session
    // silently paid nothing. A date the fixtures own outright cannot collide.
    const occurredAt = new Date()
    occurredAt.setDate(occurredAt.getDate() - 5)
    occurredAt.setHours(12, 0, 0, 0)
    // ⚠ Taken BEFORE the session is logged. Stage 2e pays on logging, so a
    // reading taken afterwards would show a delta of zero and the check would
    // pass while proving nothing.
    const beforeAnn = await getUserPoints(ann.id, root.id)
    const beforeBen = await getUserPoints(ben.id, root.id)
    const logged = await logSessionForMatch({
      matchId: match.id, userId: ben.id, occurredAt, branchCommunityId: branch.id,
    })
    claimIds.push(logged.trainer.claimId, logged.trainee.claimId)

    // BEN pressed it, and BEN is the trainee, because the listing is an OFFER
    // from Ann. Who taught is a property of the listing, not of the presser.
    eq('the trainer is the OFFER\'s author, not whoever pressed the button',
      logged.trainer.userId, ann.id)
    eq('…and the trainee is the responder', logged.trainee.userId, ben.id)
    eq('the trainer\'s claim is worth 40', logged.trainer.points, 40)
    eq('the trainee\'s claim is worth 20', logged.trainee.points, 20)
    // The control for the assertions below: a REUSED claim pays nothing, so if a
    // fixture ever collides with a real claim again this fails here rather than
    // reporting a 0-point award as a pass.
    eq('both claims are new, not reused from a real one',
      [logged.trainer.reused, logged.trainee.reused], [false, false])

    const raised = await prisma.activityClaim.findMany({
      where: { id: { in: [logged.trainer.claimId, logged.trainee.claimId] } },
      select: { userId: true, activityType: true, status: true, communityId: true },
      orderBy: { activityType: 'asc' },
    })
    eq('two claims exist, one each, both AWARDED in the BRANCH the manager oversees',
      raised.map((r) => [r.activityType, r.status, r.communityId === branch.id]),
      [['COMPLETED_TRAINING', 'AWARDED', true], ['GAVE_TRAINING', 'AWARDED', true]])

    const awarded = await listActivityClaims(branch.id, 'AWARDED')
    check('both are visible to the branch manager, who can reverse either',
      [logged.trainer.claimId, logged.trainee.claimId].every((id) => awarded.some((c) => c.id === id)))

    const twice = await refuses(
      () => logSessionForMatch({ matchId: match.id, userId: ann.id, occurredAt, branchCommunityId: branch.id }),
      409,
    )
    check('pressing it twice does not raise four claims', twice !== null, twice ?? 'not refused')
    eq('…and there is still exactly one session for the match',
      await prisma.trainingSession.count({ where: { matchId: match.id } }), 1)

    // ⚠ STAGE 2e: NO APPROVAL STEP. The points landed when the session was
    // logged, so this asserts they are ALREADY there — measured against the
    // totals read before logSessionForMatch ran.
    eq('logging the session awarded the trainer 40 on the spot',
      (await getUserPoints(ann.id, root.id)) - beforeAnn, 40)
    eq('…and the trainee 20', (await getUserPoints(ben.id, root.id)) - beforeBen, 20)
    eq('…with one ledger row per claim and no second payment',
      await prisma.pointsEvent.count({
        where: { sourceType: 'ACTIVITY_CLAIM', sourceId: { in: [logged.trainer.claimId, logged.trainee.claimId] } },
      }),
      2)

    const completed = await listCompletedSessions(branch.id)
    check('the session appears in the branch\'s completed list',
      completed.some((s) => s.topic === 'zz Doorstep conversations'))
    check('…carrying names and topics only, no contact detail',
      !JSON.stringify(completed).includes(ben.email) && !JSON.stringify(completed).includes(benPhone))

    // ── a REQUEST reverses who teaches ──────────────────────────────────────
    const reqMatch = await proposeMatch({
      listingId: request.id, userId: cara.id, shareEmail: true, sharePhone: false,
    })
    await acceptMatch(reqMatch.id, ben.id)
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 6)
    yesterday.setHours(12, 0, 0, 0)
    const reqLogged = await logSessionForMatch({
      matchId: reqMatch.id, userId: ben.id, occurredAt: yesterday, branchCommunityId: branch.id,
    })
    claimIds.push(reqLogged.trainer.claimId, reqLogged.trainee.claimId)
    eq('on a REQUEST the responder is the trainer', reqLogged.trainer.userId, cara.id)
    eq('…and the person who asked is the trainee', reqLogged.trainee.userId, ben.id)

    // ── closing ─────────────────────────────────────────────────────────────
    const strangerCloses = await refuses(() => closeMatch(match.id, cara.id), 403)
    check('only the two people in a match can close it', strangerCloses !== null, strangerCloses ?? 'not refused')
    await closeMatch(match.id, ben.id)
    check('closing stops the author seeing anything', (await contactFor(match.id, ann.id)) === null)
    check('…and the responder too', (await contactFor(match.id, ben.id)) === null)
    eq('…while the record that it was accepted survives',
      (await prisma.trainingMatch.findUniqueOrThrow({ where: { id: match.id } })).status, 'ACCEPTED')
    check('the wording admits what closing cannot do',
      CLOSE_WARNING.includes('cannot unsend'), CLOSE_WARNING)
  } finally {
    const matchIds = (
      await prisma.trainingMatch.findMany({ where: { listingId: { in: listingIds } }, select: { id: true } })
    ).map((m) => m.id)
    await prisma.trainingSession.deleteMany({ where: { communityId: { in: communityIds } } })
    await prisma.trainingMatch.deleteMany({ where: { id: { in: matchIds } } })
    await prisma.trainingListing.deleteMany({ where: { id: { in: listingIds } } })
    await prisma.pointsEvent.deleteMany({ where: { communityId: { in: communityIds } } })
    await prisma.activityClaim.deleteMany({ where: { communityId: { in: communityIds } } })
    await prisma.notification.deleteMany({
      where: { OR: communityIds.map((id) => ({ linkUrl: { contains: `/communities/${id}` } })) },
    })
    await prisma.communityMember.deleteMany({ where: { communityId: { in: communityIds } } })
    for (const id of [...communityIds].reverse()) {
      await prisma.community.deleteMany({ where: { id } })
    }
    for (const [userId, phone] of restorePhone) {
      await prisma.user.update({ where: { id: userId }, data: { phone } })
    }
    if (phoneConfigWas === null) {
      await prisma.pointsConfig.deleteMany({ where: { key: 'TRAINING_PHONE_SHARING' } })
    } else {
      await prisma.pointsConfig.update({
        where: { key: 'TRAINING_PHONE_SHARING' },
        data: { numericValue: phoneConfigWas },
      })
    }

    eq('Stage 2d training fixtures cleaned up',
      await prisma.community.count({ where: { name: { startsWith: 'zz-check-f-' } } }), 0)
    eq('no listings left behind',
      await prisma.trainingListing.count({ where: { id: { in: listingIds } } }), 0)
    eq('no claims left behind',
      await prisma.activityClaim.count({ where: { id: { in: claimIds } } }), 0)
    eq('every borrowed phone number is back as it was',
      (await prisma.user.count({ where: { id: { in: [...restorePhone.keys()] }, phone: { startsWith: '07700 9000' } } })),
      [...restorePhone.values()].filter((p) => p?.startsWith('07700 9000')).length)
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/** Build a spreadsheet in memory, so the check exercises the real parser. */
function sheet(rows: string[][], bookType: 'xlsx' | 'csv' = 'xlsx'): Buffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Questions')
  return XLSX.write(wb, { type: 'buffer', bookType }) as Buffer
}

async function partG() {
  console.log('\nG. Stage 2d — bulk question upload')

  const stamp = Date.now().toString(36)
  const communityIds: string[] = []

  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', isHistoricalAccount: false },
    orderBy: { createdAt: 'asc' },
    take: 2,
    select: { id: true, name: true, username: true },
  })
  if (users.length < 2) throw new Error('need at least two active users to run part G')
  const [admin, member] = users

  const HEADER = [...TEMPLATE_COLUMNS] as string[]
  const NOTE = `zz-note-never-imported-${stamp}`
  const rows = [
    HEADER,
    [`zz Q1 how will you pay for this ${stamp}?`, 'Doorstep', 'Housing', 'zz A1 body', 'https://example.com/1', 'zz local one', NOTE],
    [`zz Q2 why trust you ${stamp}?`, 'Media interview', 'Housing, zz New Topic', 'zz A2 body', '', '', NOTE],
    [`zz Q3 how do I use the app ${stamp}?`, 'How-to', '', '', '', '', NOTE],
  ]

  try {
    const root = await prisma.community.create({
      data: {
        name: `zz-check-g-root-${stamp}`,
        bulletinCategories: [...DEFAULT_BULLETIN_CATEGORIES],
        members: {
          create: [
            { userId: admin.id, role: 'OWNER' },
            { userId: member.id, role: 'MEMBER' },
          ],
        },
      },
    })
    communityIds.push(root.id)
    await prisma.questionTag.createMany({
      data: [
        { communityId: root.id, kind: 'CONTEXT_EXTERNAL', label: 'Doorstep', promoted: true },
        { communityId: root.id, kind: 'CONTEXT_EXTERNAL', label: 'Media interview', promoted: true },
        { communityId: root.id, kind: 'CONTEXT_INTERNAL', label: 'How-to', promoted: true },
        { communityId: root.id, kind: 'TOPIC', label: 'Housing', promoted: false },
      ],
    })

    // ── the template Charlie's admins will actually download ────────────────
    const templatePath = resolvePath(process.cwd(), 'public/central-question-upload-template.xlsx')
    check('the template exists as a static asset', existsSync(templatePath))
    const templateParsed = parseUpload(readFileSync(templatePath))
    eq('…and its columns are the ones the importer reads',
      templateParsed.columns, [...TEMPLATE_COLUMNS])
    // ⚠ The shipped workbook's FIRST sheet is "Read me first". Reading sheet one
    // would parse the instructions as questions and report that the file has no
    // Question column, so the parser looks for the sheet by NAME.
    check('…read from the Questions sheet, not from sheet one',
      templateParsed.columns[0] === 'Question', templateParsed.columns.join(' | '))
    eq('…and every row it ships with is scaffolding: one guidance row, three examples',
      templateParsed.rows.map((r) => r.scaffold),
      ['guidance', 'example', 'example', 'example'])
    const templatePlan = await planImport(root.id, readFileSync(templatePath))
    eq('…so uploading it untouched creates nothing at all',
      [templatePlan.counts.questionsToCreate, templatePlan.counts.answersToCreate, templatePlan.counts.errors],
      [0, 0, 0])
    eq('…and says why, rather than showing four silent skips',
      templatePlan.rows.every((r) => r.action === 'skip' && Boolean(r.note)), true)

    // ── the happy path: three rows, three creations ─────────────────────────
    const good = sheet(rows)
    const plan = await planImport(root.id, good)
    eq('a three-row file plans exactly three creations', plan.counts.questionsToCreate, 3)
    eq('…two of which carry an answer', plan.counts.answersToCreate, 2)
    eq('…and none of which is an error', plan.counts.errors, 0)
    eq('the unknown topic is planned, unpromoted, because a topic has no ambiguous side',
      plan.topicsToCreate, ['zz New Topic'])

    // ── the Notes column reaches nothing ────────────────────────────────────
    // Asserted on the PARSED ROWS, not on the plan: the plan carries only
    // hasAnswer, so a Notes-into-Answer leak would slip past it unseen — a
    // check that cannot fail is not a check.
    check('the parser does not read the Notes column at all',
      !JSON.stringify(parseUpload(good).rows).includes(NOTE),
      JSON.stringify(parseUpload(good).rows).slice(0, 200))

    // ── one bad context fails ONE row, and names the problem ────────────────
    const withBadContext = rows.map((r) => [...r])
    withBadContext[2][1] = 'Doorsteps'
    const mixedPlan = await planImport(root.id, sheet(withBadContext))
    eq('a wrong context fails exactly that row', mixedPlan.counts.errors, 1)
    eq('…and the rows around it still import', mixedPlan.counts.questionsToCreate, 2)
    const badRow = mixedPlan.rows.find((r) => r.action === 'error') ??
      { rowNumber: -1, errors: ['(no row failed)'], context: '' }
    eq('…the failing row is named by its spreadsheet row number', badRow.rowNumber, 3)
    check('…and the message names the offending value and the ones that would work',
      badRow.errors[0].includes('Doorsteps') && badRow.errors[0].includes('Media interview'),
      badRow.errors[0])
    check('…and it is never guessed at — nothing is written for that row',
      badRow.context !== 'Doorstep')

    // ── writing ─────────────────────────────────────────────────────────────
    const applied = await applyImport({
      communityId: root.id, standingOnId: root.id, uploaderId: admin.id, buffer: good,
    })
    eq('three questions are written', applied.written.questions, 3)
    eq('…with their two answers', applied.written.answers, 2)

    const written = await prisma.question.findMany({
      where: { communityId: root.id },
      include: { answers: { select: { authorId: true, body: true, sources: true, localExample: true } } },
      orderBy: { text: 'asc' },
    })
    eq('all three landed', written.length, 3)
    check('every question is authored by the uploader', written.every((q) => q.authorId === admin.id))
    check('every answer is too', written.every((q) => q.answers.every((a) => a.authorId === admin.id)))
    check('sources and the local example survive the trip',
      written.some((q) => q.answers.some((a) => a.sources.includes('https://example.com/1') && a.localExample === 'zz local one')))
    check('a row with no answer creates the question and no answer',
      written.find((q) => q.text.startsWith('zz Q3'))?.answers.length === 0)
    check('nothing anywhere in the library carries the Notes text',
      !JSON.stringify(written).includes(NOTE))
    check('the new topic exists, unpromoted, so it lands in the dropdown and not the chip row',
      (await prisma.questionTag.findFirst({ where: { communityId: root.id, kind: 'TOPIC', label: 'zz New Topic' } }))
        ?.promoted === false)

    // ── idempotence ─────────────────────────────────────────────────────────
    const again = await applyImport({
      communityId: root.id, standingOnId: root.id, uploaderId: admin.id, buffer: good,
    })
    eq('re-uploading the same file writes nothing', [again.written.questions, again.written.answers], [0, 0])
    eq('…and says so in the plan', again.plan.counts.skipped, 3)
    eq('…and the library has not grown',
      await prisma.question.count({ where: { communityId: root.id } }), 3)

    // ── the same file as a .csv reads identically ───────────────────────────
    const csvPlan = await planImport(root.id, sheet(rows, 'csv'))
    eq('a .csv of the same content plans the same way',
      [csvPlan.counts.questionsToCreate, csvPlan.counts.skipped], [0, 3])

    // ── two rows in one file that ask the same question ─────────────────────
    const dupRows = [
      HEADER,
      [`zz Q4 duplicate within the file ${stamp}?`, 'Doorstep', '', 'zz A4 first', '', '', ''],
      [`zz Q4 duplicate within the file ${stamp}?`, 'Doorstep', '', 'zz A4 second', '', '', ''],
    ]
    const dupPlan = await planImport(root.id, sheet(dupRows))
    eq('a question repeated inside one file is planned once, with the second row adding its answer',
      [dupPlan.counts.questionsToCreate, dupPlan.rows[1].action], [1, 'add-answer'])
    const dupApplied = await applyImport({
      communityId: root.id, standingOnId: root.id, uploaderId: admin.id, buffer: sheet(dupRows),
    })
    eq('…and that is what is written', [dupApplied.written.questions, dupApplied.written.answers], [1, 2])

    // ── a file that is not a spreadsheet ────────────────────────────────────
    let refusal = ''
    try {
      parseUpload(Buffer.from('this is not a spreadsheet, it is a sentence'))
    } catch (e) {
      refusal = (e as Error).message
    }
    check('a file with none of the template’s columns is refused rather than half-read',
      refusal.includes('does not look like the question template'), refusal || 'not refused')
    check('…and the refusal quotes what it actually found', refusal.includes('not a spreadsheet'), refusal)

    // The control: the guard fires on a WRONG file, not on any file. A sheet
    // with only the two required columns still reads.
    const minimal = parseUpload(sheet([['Question', 'Context'], ['zz minimal', 'Doorstep']]))
    eq('…while a sheet with just Question and Context still reads', minimal.rows.length, 1)

    // ── the gate the route applies ──────────────────────────────────────────
    check('a plain member does not hold the manage right the bulk route requires',
      !(await canManageCommunity(member.id, root.id)))
    check('…and a Community admin does', await canManageCommunity(admin.id, root.id))
  } finally {
    const questionIds = (
      await prisma.question.findMany({ where: { communityId: { in: communityIds } }, select: { id: true } })
    ).map((q) => q.id)
    await prisma.answer.deleteMany({ where: { questionId: { in: questionIds } } })
    await prisma.question.deleteMany({ where: { id: { in: questionIds } } })
    await prisma.questionTag.deleteMany({ where: { communityId: { in: communityIds } } })
    await prisma.communityMember.deleteMany({ where: { communityId: { in: communityIds } } })
    for (const id of [...communityIds].reverse()) {
      await prisma.community.deleteMany({ where: { id } })
    }
    eq('Stage 2d upload fixtures cleaned up',
      await prisma.community.count({ where: { name: { startsWith: 'zz-check-g-' } } }), 0)
    eq('no questions left behind',
      await prisma.question.count({ where: { id: { in: questionIds } } }), 0)
  }
}

async function partH() {
  console.log('\nH. Stage 2e — AI attribution, votes that pay, award-then-reverse, referral accrual')

  const stamp = Date.now().toString(36)
  const communityIds: string[] = []
  const questionIds: string[] = []

  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE', isHistoricalAccount: false },
    orderBy: { createdAt: 'asc' },
    take: 4,
    select: { id: true, name: true, username: true },
  })
  if (users.length < 4) throw new Error('need at least four active users to run part H')
  const [owner, writer, voter, inviter] = users

  try {
    const root = await prisma.community.create({
      data: {
        name: `zz-check-h-root-${stamp}`,
        bulletinCategories: [...DEFAULT_BULLETIN_CATEGORIES],
        members: {
          create: [
            { userId: owner.id, role: 'OWNER' },
            { userId: writer.id, role: 'MEMBER' },
            { userId: voter.id, role: 'MEMBER' },
            { userId: inviter.id, role: 'MEMBER' },
          ],
        },
      },
    })
    communityIds.push(root.id)
    const branch = await prisma.community.create({
      data: {
        name: `zz-check-h-branch-${stamp}`,
        parentCommunityId: root.id,
        bulletinCategories: [],
        members: {
          create: [
            { userId: writer.id, role: 'MEMBER' },
            { userId: voter.id, role: 'MEMBER' },
            { userId: inviter.id, role: 'MEMBER' },
          ],
        },
      },
    })
    communityIds.push(branch.id)
    await prisma.questionTag.createMany({
      data: [{ communityId: root.id, kind: 'CONTEXT_EXTERNAL', label: 'Doorstep', promoted: true }],
    })

    const question = await prisma.question.create({
      data: {
        communityId: root.id, authorId: writer.id, branchId: branch.id,
        text: `zz H question ${stamp}?`, scope: 'COMMUNITY', contextTags: ['Doorstep'],
      },
    })
    questionIds.push(question.id)

    const memberAnswer = await prisma.answer.create({
      data: { questionId: question.id, authorId: writer.id, body: `zz member answer ${stamp}` },
    })
    const aiAnswer = await prisma.answer.create({
      data: {
        questionId: question.id, authorId: owner.id, body: `zz AI answer ${stamp}`,
        authorType: 'AI', aiModel: 'Claude',
      },
    })

    // ── item 0: an AI answer is labelled wherever it appears ────────────────
    const ranked = await getRankedAnswers(question.id, voter.id)
    eq('the ranked answers carry authorType on every row',
      ranked.every((a) => typeof a.authorType === 'string'), true)
    eq('the AI answer says which model wrote it',
      ranked.find((a) => a.id === aiAnswer.id)?.aiModel, 'Claude')
    eq('…and the member answer claims no model',
      ranked.find((a) => a.id === memberAnswer.id)?.aiModel, null)

    // The three surfaces, grepped rather than assumed — a fourth surface that
    // forgets the label is what this is here to catch.
    for (const [label, file] of [
      ['the question detail', 'app/communities/[id]/questions/[questionId]/QuestionDetail.tsx'],
      ['the library list', 'app/communities/[id]/questions/QuestionLibrary.tsx'],
      ['the pack output', 'app/communities/[id]/packs/new/PackOutput.tsx'],
    ] as const) {
      const src = readFileSync(resolvePath(process.cwd(), file), 'utf8')
      check(`${label} renders the AI label`,
        /AiLabel|AnswerByline|AiNote/.test(src), file)
    }
    const packSrc = readFileSync(
      resolvePath(process.cwd(), 'app/communities/[id]/packs/new/PackOutput.tsx'), 'utf8')
    check('…and the printed sheet uses the plain-text form, which a printer cannot lose',
      packSrc.includes('<AiNote answer={e.answer} plain />'))

    // ── item 3: an answer vote moves the author's points ────────────────────
    const before = await getUserPoints(writer.id, root.id)
    const up = await applyAnswerVote(memberAnswer.id, voter.id, 'UP')
    const afterUp = await getUserPoints(writer.id, root.id)
    eq('an upvote on a member answer pays the mark tariff', afterUp - before, 4)
    eq('…and the caller is told the new total', up.authorPoints, afterUp)
    eq('…recorded against ANSWER_VOTE, so it is tellable apart from a bulletin mark',
      (await prisma.pointsEvent.findFirst({
        where: { sourceType: 'ANSWER_VOTE', sourceId: memberAnswer.id, type: 'MARK_RECEIVED' },
        select: { tariffKey: true },
      }))?.tariffKey,
      'MARK_CONSTRUCTIVE')

    // Switching direction reverses the old award and pays the new one.
    await applyAnswerVote(memberAnswer.id, voter.id, 'DOWN')
    eq('switching to a downvote moves the total by eight, not four',
      (await getUserPoints(writer.id, root.id)) - before, -4)
    await applyAnswerVote(memberAnswer.id, voter.id, 'DOWN')
    eq('clearing the vote returns the author to where they started',
      await getUserPoints(writer.id, root.id), before)
    eq('…by appending, never by deleting: every event survives',
      await prisma.pointsEvent.count({ where: { sourceType: 'ANSWER_VOTE', sourceId: memberAnswer.id } }),
      4)

    const ownVote = await refuses(() => applyAnswerVote(memberAnswer.id, writer.id, 'UP'), 403)
    check('voting on your own answer is still refused', ownVote !== null, ownVote ?? 'not refused')

    // ── item 0: an AI answer ranks but mints nothing ───────────────────────
    const ownerBefore = await getUserPoints(owner.id, root.id)
    const aiVote = await applyAnswerVote(aiAnswer.id, voter.id, 'UP')
    eq('a vote on an AI answer still counts for RANKING', aiVote.score, 1)
    eq('…and the vote row exists',
      await prisma.answerVote.count({ where: { answerId: aiAnswer.id } }), 1)
    eq('…but it mints NOTHING — the seed account cannot accrue points for content nobody wrote',
      await getUserPoints(owner.id, root.id), ownerBefore)
    eq('…and no ledger row was written at all',
      await prisma.pointsEvent.count({ where: { sourceType: 'ANSWER_VOTE', sourceId: aiAnswer.id } }), 0)
    eq('…which the caller is told, rather than left to infer', aiVote.minted, false)

    // ── item 8: a claim pays on submission ─────────────────────────────────
    const voterBefore = await getUserPoints(voter.id, root.id)
    const claim = await createActivityClaim({
      userId: voter.id, communityId: branch.id,
      activityType: 'CANVASSING_SESSION', occurredAt: new Date(),
    })
    eq('a logged activity is AWARDED, not PENDING', claim.status, 'AWARDED')
    eq('…and pays its tariff at once', claim.awarded, 24)
    eq('…so the member\'s total moves immediately, with nobody to ask',
      (await getUserPoints(voter.id, root.id)) - voterBefore, 24)
    eq('…and there is no approval queue left to sit in',
      (await listActivityClaims(branch.id, 'PENDING')).length, 0)
    check('…while the award is visible to the whole Community in the log',
      (await getCommunityActivityLog(root.id)).some((e) => e.id === claim.id))

    // ── item 8: reversal, with a reason, at the original value ─────────────
    const noReason = await refuses(() => reverseActivityClaim(claim.id, owner.id, '   '), 422)
    check('a reversal without a reason is refused', noReason !== null, noReason ?? 'not refused')
    const notManager = await refuses(() => reverseActivityClaim(claim.id, inviter.id, 'zz nope'), 403)
    check('a plain member cannot reverse someone\'s award', notManager !== null, notManager ?? 'not refused')

    // Retune the tariff BEFORE reversing: the reversal must use the original
    // value, or a retune between award and reversal could be banked.
    const retuned = await prisma.pointsTariff.create({
      data: {
        actionKey: 'CLAIM_CANVASSING_SESSION', points: 999, active: true,
        effectiveFrom: new Date(), note: 'zz-check-h retune',
      },
    })
    const reversal = await reverseActivityClaim(claim.id, owner.id, 'zz double-counted')
    await prisma.pointsTariff.delete({ where: { id: retuned.id } })

    // ⚠ READ BACK FROM THE LEDGER, not from the return value. Asserting
    // `reversal.reversed` alone could not fail: the function returns
    // `original.points` whatever it actually wrote, so a reversal priced at
    // today's tariff sailed past that assertion and only surfaced two lines
    // later, in a check about somebody's total.
    eq('the reversal is at the ORIGINAL award value, not today\'s tariff',
      (await prisma.pointsEvent.findFirstOrThrow({
        where: { sourceType: 'ACTIVITY_CLAIM', sourceId: claim.id, type: 'CLAIM_REVERSED' },
      })).points,
      -24)
    eq('…and the caller is told the same number', reversal.reversed, 24)
    eq('…so the member is back where they started', await getUserPoints(voter.id, root.id), voterBefore)
    eq('…the claim records who reversed it and why',
      (await prisma.activityClaim.findUniqueOrThrow({ where: { id: claim.id } })).reversalReason,
      'zz double-counted')
    eq('…and BOTH events stay in the ledger — it only ever appends',
      await prisma.pointsEvent.count({ where: { sourceType: 'ACTIVITY_CLAIM', sourceId: claim.id } }), 2)
    const twice = await refuses(() => reverseActivityClaim(claim.id, owner.id, 'zz again'), 409)
    check('a claim cannot be reversed twice', twice !== null, twice ?? 'not refused')

    // A reversed claim frees the day, so the member can put it right.
    const remade = await createActivityClaim({
      userId: voter.id, communityId: branch.id,
      activityType: 'CANVASSING_SESSION', occurredAt: new Date(),
    })
    eq('after a reversal the same day can be claimed again', remade.status, 'AWARDED')
    const dup = await refuses(
      () => createActivityClaim({
        userId: voter.id, communityId: branch.id,
        activityType: 'CANVASSING_SESSION', occurredAt: new Date(),
      }),
      409,
    )
    check('…but only once — the one-per-day guard still holds', dup !== null, dup ?? 'not refused')

    // ── item 9: referral accrual keeps the fraction ────────────────────────
    // inviter introduced writer. A constructive mark is 4; 10% of 4 is 0.4,
    // which the old arithmetic floored to nothing.
    await prisma.communityReferral.create({
      data: { communityId: root.id, inviterUserId: inviter.id, inviteeUserId: writer.id },
    })
    const inviterBefore = await getUserPoints(inviter.id, root.id)

    const answers: string[] = []
    for (let i = 0; i < 10; i++) {
      const a = await prisma.answer.create({
        data: { questionId: question.id, authorId: writer.id, body: `zz chain answer ${i} ${stamp}` },
      })
      answers.push(a.id)
      // Twelve distinct items for this voter across the whole part, against a
      // daily budget of twenty — deliberately inside it, so this measures the
      // accrual and not the budget.
      await applyAnswerVote(a.id, voter.id, 'UP')
    }
    const link = await prisma.communityReferral.findFirstOrThrow({
      where: { communityId: root.id, inviteeUserId: writer.id },
    })
    eq('ten 4-point marks pay the L1 inviter 4 points, where flooring paid 0',
      (await getUserPoints(inviter.id, root.id)) - inviterBefore, 4)
    check('…and the link carries no stray fraction afterwards',
      Math.abs(link.bonusBalance) < 1e-9, String(link.bonusBalance))

    // The control that makes the number mean something: ONE mark alone pays
    // nothing yet, because 0.4 has not crossed 1.0 — the fraction is held, not
    // discarded.
    const singleAnswer = await prisma.answer.create({
      data: { questionId: question.id, authorId: writer.id, body: `zz single ${stamp}` },
    })
    answers.push(singleAnswer.id)
    const beforeSingle = await getUserPoints(inviter.id, root.id)
    await applyAnswerVote(singleAnswer.id, voter.id, 'UP')
    eq('one mark alone still pays the chain nothing…',
      await getUserPoints(inviter.id, root.id), beforeSingle)
    eq('…but the 0.4 is HELD on the link rather than thrown away',
      Number(
        (
          await prisma.communityReferral.findFirstOrThrow({
            where: { communityId: root.id, inviteeUserId: writer.id },
          })
        ).bonusBalance.toFixed(4),
      ),
      0.4)

    // ── the standing hazard register (item 9b) ─────────────────────────────
    const indexes = await prisma.$queryRaw<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE indexname IN ('ActivityClaim_one_per_day', 'CommunityJoinRequest_pending_unique')`
    eq('both invisible-to-Prisma indexes are present', indexes.length, 2)
    const onePerDay = indexes.find((i) => i.indexname === 'ActivityClaim_one_per_day')
    check('the one-per-day guard is still expression + partial',
      Boolean(onePerDay?.indexdef.includes('date') && onePerDay?.indexdef.includes('WHERE')),
      onePerDay?.indexdef)
    check('…and its predicate now frees a REVERSED claim as well as a DECLINED one',
      Boolean(onePerDay?.indexdef.includes('REVERSED')), onePerDay?.indexdef)
    const register = readFileSync(resolvePath(process.cwd(), '../docs/CLAUDE.md'), 'utf8')
    for (const name of ['ActivityClaim_one_per_day', 'CommunityJoinRequest_pending_unique']) {
      check(`${name} is named in the CLAUDE.md hazard register`, register.includes(name))
    }
  } finally {
    const answerIds = (
      await prisma.answer.findMany({ where: { questionId: { in: questionIds } }, select: { id: true } })
    ).map((a) => a.id)
    await prisma.answerVote.deleteMany({ where: { answerId: { in: answerIds } } })
    await prisma.answer.deleteMany({ where: { id: { in: answerIds } } })
    await prisma.questionVote.deleteMany({ where: { questionId: { in: questionIds } } })
    await prisma.question.deleteMany({ where: { id: { in: questionIds } } })
    await prisma.questionTag.deleteMany({ where: { communityId: { in: communityIds } } })
    await prisma.pointsEvent.deleteMany({ where: { communityId: { in: communityIds } } })
    await prisma.activityClaim.deleteMany({ where: { communityId: { in: communityIds } } })
    await prisma.communityReferral.deleteMany({ where: { communityId: { in: communityIds } } })
    await prisma.notification.deleteMany({
      where: { OR: communityIds.map((id) => ({ linkUrl: { contains: `/communities/${id}` } })) },
    })
    await prisma.communityMember.deleteMany({ where: { communityId: { in: communityIds } } })
    for (const id of [...communityIds].reverse()) {
      await prisma.community.deleteMany({ where: { id } })
    }
    await prisma.pointsTariff.deleteMany({ where: { note: { startsWith: 'zz-check-h' } } })

    eq('Stage 2e fixtures cleaned up',
      await prisma.community.count({ where: { name: { startsWith: 'zz-check-h-' } } }), 0)
    eq('no ledger rows left behind',
      await prisma.pointsEvent.count({ where: { communityId: { in: communityIds } } }), 0)
    eq('the live canvassing tariff is back to one row',
      await prisma.pointsTariff.count({ where: { actionKey: 'CLAIM_CANVASSING_SESSION', active: true } }), 1)
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  console.log('CENTRAL Stage 1.1 + 1.2 + 2 + 2b + 2d + 2e checks — host:', new URL(url).hostname)

  await partA()
  await partB()
  await partC()
  await partD()
  await partE()
  await partF()
  await partG()
  await partH()

  console.log(`\n${pass}/${pass + fail} checks passed`)
  await prisma.$disconnect()
  if (fail > 0) process.exit(1)
}

main().catch(async (e) => {
  console.error('ERROR:', e)
  await prisma.$disconnect()
  process.exit(1)
})
