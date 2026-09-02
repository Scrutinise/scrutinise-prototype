/**
 * CENTRAL 25-A §7c/§7j — the invitation is accepted FOR them.
 *
 * ⚠⚠ ONE MECHANISM, TWO CALLERS. §7j says: fix the writer, then sweep the
 * backlog with the same thing. So `acceptInvitationsFor` is called
 *
 *   · at first sign-in, by the Clerk webhook and the just-in-time sync (§7c);
 *   · over the people who already have an account and an unredeemed
 *     invitation, by `scripts/accept-outstanding-invitations.ts` (§7j).
 *
 * A separate backfill path would be a second thing to get wrong, and the two
 * would drift the moment one of them was fixed.
 *
 * ⚠ IT PLANS BEFORE IT WRITES. `dryRun` returns exactly the rows a real run
 * would create, so the table Charlie approves is produced by the code that then
 * does the work — not by a query that resembles it.
 *
 * The rules, each of them a way of not doing something irreversible:
 *
 *   EXACT ADDRESS, CASE-INSENSITIVE. Nothing fuzzy. Granting the wrong person
 *   access to a private community is not recoverable by apology.
 *
 *   AMBIGUITY IS REPORTED, NEVER RESOLVED. Two live invitations to the same
 *   node for one address is a situation somebody has to look at; picking one is
 *   guessing which invitation a person accepted.
 *
 *   THE INVITATION IS HONOURED AS WRITTEN. A branch invitation admits them to
 *   that branch. ⚠ The Community membership that comes with it is Stage 1.2's
 *   standing branch-implies-root rule (`joinCommunityAndRoot`), not a blanket
 *   community grant — without it a branch member cannot see the Community board
 *   or the rest of the tree, and `check:central` asserts the invariant across
 *   every live membership. See the report's §7j.
 *
 *   THE INVITATION IS CONSUMED. One that stays live after it has been used can
 *   be redeemed again by anyone holding the link.
 *
 *   WHO BROUGHT THEM IN IS KEPT (§7h), and the fact that nobody clicked is
 *   recorded on the membership (`acceptedOnBehalfAt`).
 */
import { prisma } from '@/lib/prisma'
import { joinCommunityAndRoot } from '@/lib/community'
import { recordReferral } from '@/lib/central-points'

export type AcceptancePlanRow = {
  userId: string
  email: string
  name: string | null
  inviteId: string
  inviteCode: string
  communityId: string
  communityName: string
  isBranch: boolean
  rootId: string
  rootName: string
  invitedByUserId: string
  invitedByName: string | null
  /** What a run would create, in the words the table shows. */
  effect: string
}

export type AcceptanceOutcome = {
  planned: AcceptancePlanRow[]
  /** ⚠ Reported, never resolved. Nothing is written for these. */
  ambiguous: { email: string; reason: string; inviteIds: string[] }[]
  /** Only present after a real run: what the RE-READ found, not what the write claimed. */
  created: {
    userId: string
    email: string
    communityId: string
    communityName: string
    role: string
    invitedByName: string | null
    acceptedOnBehalf: boolean
  }[]
  skipped: { email: string; communityName: string; reason: string }[]
}

type Options = {
  dryRun: boolean
  /** Limit to one address — how §7c uses it at first sign-in. */
  onlyEmail?: string
}

/**
 * Accept every outstanding addressed invitation whose address matches a real
 * account. Returns the plan, the ambiguities, and — on a real run — what a
 * re-read of the database actually found afterwards.
 */
export async function acceptOutstandingInvitations(
  options: Options,
): Promise<AcceptanceOutcome> {
  const now = new Date()

  const invites = await prisma.communityInvite.findMany({
    where: {
      email: options.onlyEmail
        ? { equals: options.onlyEmail, mode: 'insensitive' }
        : { not: null },
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: {
      community: { select: { id: true, name: true, parentCommunityId: true, deletedAt: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const live = invites.filter((i) => i.usedCount < i.maxUses && i.community.deletedAt === null)

  const emails = Array.from(new Set(live.map((i) => i.email!.toLowerCase())))
  const users = emails.length
    ? await prisma.user.findMany({
        where: { email: { in: emails, mode: 'insensitive' } },
        select: { id: true, email: true, name: true },
      })
    : []
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]))

  const inviterIds = Array.from(new Set(live.map((i) => i.createdByUserId)))
  const inviters = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: inviterIds } },
        select: { id: true, name: true },
      })
    ).map((u) => [u.id, u.name]),
  )

  const planned: AcceptancePlanRow[] = []
  const ambiguous: AcceptanceOutcome['ambiguous'] = []
  const skipped: AcceptanceOutcome['skipped'] = []

  // ⚠ AMBIGUITY FIRST, before anything is planned. Two live invitations to the
  // same node for one address: which one did they accept? Nobody knows, so
  // nothing is written and the pair is reported.
  const byEmailAndNode = new Map<string, typeof live>()
  for (const i of live) {
    const key = `${i.email!.toLowerCase()}::${i.communityId}`
    byEmailAndNode.set(key, [...(byEmailAndNode.get(key) ?? []), i])
  }
  const blockedKeys = new Set<string>()
  for (const [key, group] of byEmailAndNode) {
    if (group.length > 1) {
      blockedKeys.add(key)
      ambiguous.push({
        email: group[0].email!,
        reason: `${group.length} live invitations to “${group[0].community.name}” for the same address — which one did they accept?`,
        inviteIds: group.map((g) => g.id),
      })
    }
  }

  for (const invite of live) {
    const email = invite.email!.toLowerCase()
    const key = `${email}::${invite.communityId}`
    if (blockedKeys.has(key)) continue

    const user = userByEmail.get(email)
    if (!user) {
      skipped.push({
        email: invite.email!,
        communityName: invite.community.name,
        reason: 'no account with that address yet — nothing to accept on behalf of',
      })
      continue
    }

    // ⚠ EXISTENCE ONLY. A bare `findUnique` returns every column of the row,
    // which makes the PLAN — a read-only operation — fail on any column the
    // database has not been given yet. A dry run must be able to run against
    // the database as it stands, or it is not a plan, it is a second deploy.
    const existing = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: invite.communityId, userId: user.id } },
      select: { id: true },
    })
    if (existing) {
      skipped.push({
        email: invite.email!,
        communityName: invite.community.name,
        reason: 'already a member — the invitation is left alone',
      })
      continue
    }

    const rootId = invite.community.parentCommunityId
      ? await resolveRoot(invite.community.parentCommunityId)
      : invite.communityId
    const rootName =
      rootId === invite.communityId
        ? invite.community.name
        : (await prisma.community.findUniqueOrThrow({ where: { id: rootId }, select: { name: true } }))
            .name

    planned.push({
      userId: user.id,
      email: invite.email!,
      name: user.name,
      inviteId: invite.id,
      inviteCode: invite.inviteCode,
      communityId: invite.communityId,
      communityName: invite.community.name,
      isBranch: invite.community.parentCommunityId !== null,
      rootId,
      rootName,
      invitedByUserId: invite.createdByUserId,
      invitedByName: inviters.get(invite.createdByUserId) ?? null,
      effect:
        invite.community.parentCommunityId !== null
          ? `member of the branch “${invite.community.name}”, and of “${rootName}” with it (the standing branch-implies-root rule)`
          : `member of “${invite.community.name}”`,
    })
  }

  if (options.dryRun) return { planned, ambiguous, created: [], skipped }

  for (const row of planned) {
    await joinCommunityAndRoot(row.userId, row.communityId, 'MEMBER', {
      invitedByUserId: row.invitedByUserId,
      invitedViaInviteId: row.inviteId,
    })
    // ⚠ Nobody clicked. Say so on the row rather than leaving it to look like a
    // membership somebody chose.
    await prisma.communityMember.updateMany({
      where: {
        userId: row.userId,
        communityId: { in: [row.communityId, row.rootId] },
        acceptedOnBehalfAt: null,
        joinedAt: { gte: new Date(Date.now() - 60_000) },
      },
      data: { acceptedOnBehalfAt: new Date() },
    })
    await recordReferral({
      communityId: row.rootId,
      inviterUserId: row.invitedByUserId,
      inviteeUserId: row.userId,
      inviteId: row.inviteId,
    })
    // ⚠ CONSUME IT. An invitation that stays live after it has been used can be
    // redeemed again by anyone holding the link.
    await prisma.communityInvite.update({
      where: { id: row.inviteId },
      data: { usedCount: { increment: 1 } },
    })
  }

  // ⚠⚠ THE RE-READ. Report what the database holds, never what the write said
  // it would hold (docs/CLAUDE.md — report only what you re-read).
  const created: AcceptanceOutcome['created'] = []
  for (const row of planned) {
    const membership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: row.communityId, userId: row.userId } },
      include: {
        community: { select: { name: true } },
        invitedBy: { select: { name: true } },
        user: { select: { email: true } },
      },
    })
    if (!membership) {
      skipped.push({
        email: row.email,
        communityName: row.communityName,
        reason: '⚠ THE WRITE DID NOT LAND — no membership row on re-read',
      })
      continue
    }
    created.push({
      userId: membership.userId,
      email: membership.user.email,
      communityId: membership.communityId,
      communityName: membership.community.name,
      role: membership.role,
      invitedByName: membership.invitedBy?.name ?? null,
      acceptedOnBehalf: membership.acceptedOnBehalfAt !== null,
    })
  }

  return { planned, ambiguous, created, skipped }
}

async function resolveRoot(communityId: string): Promise<string> {
  let cursor = communityId
  for (let guard = 0; guard < 50; guard++) {
    const node: { parentCommunityId: string | null } | null = await prisma.community.findUnique({
      where: { id: cursor },
      select: { parentCommunityId: true },
    })
    if (!node?.parentCommunityId) return cursor
    cursor = node.parentCommunityId
  }
  return cursor
}

/**
 * §7c — the first-sign-in call. One address, fire-and-forget, never the reason
 * a sign-in fails.
 */
export async function acceptInvitationsAtSignIn(email: string): Promise<void> {
  try {
    const outcome = await acceptOutstandingInvitations({ dryRun: false, onlyEmail: email })
    if (outcome.created.length > 0) {
      console.log(
        `[invite-acceptance] ${email} joined ${outcome.created.map((c) => c.communityName).join(', ')} on first sign-in`,
      )
    }
    for (const a of outcome.ambiguous) {
      console.warn(`[invite-acceptance] AMBIGUOUS, nothing written — ${a.email}: ${a.reason}`)
    }
  } catch (err) {
    console.error('[invite-acceptance] failed for', email, err)
  }
}
