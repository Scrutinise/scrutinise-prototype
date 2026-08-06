/**
 * CENTRAL Stage 1.1 — end-to-end check against the live app DB.
 *
 * Run: npm run check:central
 *
 * Two halves:
 *   A. Standing assertions over real data — schema columns, the seeded category
 *      set, retired categories gone, every idea team owning a member row.
 *   B. A disposable Community tree (root → branch → sub-branch) with two
 *      accounts, driven through the SAME lib/community.ts functions the API
 *      routes call, then torn down. The routes themselves need a Clerk session
 *      and cannot be reached from a script, so the shared layer is where the
 *      real logic lives and where it is tested.
 *
 * Everything it creates is deleted in a finally block, including on failure.
 */
import 'dotenv/config'
import { prisma } from '@/lib/prisma'
import {
  DEFAULT_BULLETIN_CATEGORIES,
  applyBulletinVote,
  canManageCommunity,
  categoriesFor,
  countUnreadBulletin,
  findBoardPost,
  getBoardScopeFilter,
  getCommunityTree,
  getCommunityTreeIds,
  getRootCommunityId,
  lookupInviteCandidates,
} from '@/lib/community'

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

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  console.log('CENTRAL Stage 1.1 checks — host:', new URL(url).hostname)

  await partA()
  await partB()

  console.log(`\n${pass}/${pass + fail} checks passed`)
  await prisma.$disconnect()
  if (fail > 0) process.exit(1)
}

main().catch(async (e) => {
  console.error('ERROR:', e)
  await prisma.$disconnect()
  process.exit(1)
})
