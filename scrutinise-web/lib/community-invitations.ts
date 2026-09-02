/**
 * CENTRAL 25-A §2 — what happened to the people an owner invited.
 *
 * ⚠ WHY THIS EXISTS AT ALL. Before 25-A a Community or branch owner could send
 * invitations and had no way of seeing any of them again: `CommunityInvite`
 * recorded `usedCount` and nothing else, so "invited and never came back" and
 * "came back and could not get in" rendered identically — as nothing. That is
 * the pair 25-A §1 turned out to be: five people were invited to a Community
 * through a door that cannot let a new person in, and the failure was invisible
 * to the person who sent them.
 *
 * So the statuses here are chosen to separate the cases that need DIFFERENT
 * ACTIONS from each other, and every one of them is derived from a record we
 * actually hold:
 *
 *   Revoked                   revokedAt is set — refused at redemption
 *   Joined                    a CommunityMember row on this node
 *   Signed up, not joined     a User row for that address, no membership
 *   Invited, no account yet   no User row for that address
 *   Link opened               openedAt set, still no account
 *   Expired                   expiresAt in the past
 *
 * ⚠ AND ONE FLAG THAT IS THE 25-A §1 FAULT MADE VISIBLE: `cannotSignUp`. The
 * platform is invite-only — `/sign-up` renders "Scrutinise is invite only"
 * unless it is given a platform `Invite` token — so a person with no account
 * and no platform invitation for their address CANNOT create one, however many
 * Community invitations they receive. The owner sees that on the row rather
 * than finding out when the invitee gives up.
 */
import { prisma } from '@/lib/prisma'
import { listArchivedMemberships } from '@/lib/community-permissions'
import { findInviteCredential } from '@/lib/invite-gate'
import type { InviteStatus } from '@/lib/invite-status'

export type { InviteStatus }
export { INVITE_STATUSES, INVITE_STATUS_LABEL, INVITE_STATUS_HINT } from '@/lib/invite-status'

export type DirectInvitation = {
  inviteId: string
  email: string
  /** The invitee's name once they have an account; null before that. */
  name: string | null
  invitedAt: Date
  invitedByName: string | null
  invitedByUserId: string
  openedAt: Date | null
  expiresAt: Date | null
  revokedAt: Date | null
  joinedAt: Date | null
  status: InviteStatus
  /** Still redeemable right now — the other half of §2d's assertion. */
  live: boolean
  /**
   * ⚠ 25-A §1: they have no account and no platform invitation, so the sign-up
   * door will refuse them. Nothing the owner does inside the Community fixes
   * this; a platform invitation has to be issued.
   */
  cannotSignUp: boolean
  inviteCode: string
}

export type LinkArrival = {
  userId: string
  name: string | null
  email: string
  arrivedAt: Date
  /** What they are NOW on this node — null when they are no longer a member. */
  role: string | null
  /** The link they came through, when we recorded it. */
  inviteCode: string | null
}

export type CommunityPeople = {
  direct: DirectInvitation[]
  arrivals: LinkArrival[]
  /** Shared links currently issued for this node, with what they have produced. */
  links: {
    inviteId: string
    inviteCode: string
    createdAt: Date
    expiresAt: Date | null
    revokedAt: Date | null
    usedCount: number
    maxUses: number
    live: boolean
  }[]
  /**
   * ⚠ Arrivals we hold a record OF but cannot attribute to a link, because
   * `CommunityReferral.inviteId` did not exist when they joined. Reported as
   * its own number rather than folded into the list — see docs/CLAUDE.md §19.
   */
  unattributedArrivals: number
  /**
   * CENTRAL 25-A §3c — people whose membership was ended, kept rather than
   * deleted. Their contributions are untouched and still theirs.
   */
  removed: {
    userId: string
    name: string | null
    username: string
    role: string
    joinedAt: Date
    removedAt: Date
    removedByName: string | null
    reason: string | null
  }[]
}

function statusOf(args: {
  revokedAt: Date | null
  joinedAt: Date | null
  hasAccount: boolean
  expiresAt: Date | null
  openedAt: Date | null
  now: Date
}): InviteStatus {
  if (args.revokedAt) return 'REVOKED'
  if (args.joinedAt) return 'JOINED'
  if (args.hasAccount) return 'SIGNED_UP_NOT_JOINED'
  if (args.expiresAt && args.expiresAt < args.now) return 'EXPIRED'
  if (args.openedAt) return 'OPENED'
  return 'INVITED'
}

/**
 * Is this invitation still redeemable?
 *
 * ⚠ THE SINGLE SOURCE OF THAT ANSWER. `app/api/communities/join/route.ts`
 * refuses on exactly these three conditions, and this function exists so the
 * page and the check read the same rule the redemption path enforces rather
 * than each restating it (docs/CLAUDE.md §25.3).
 */
export function inviteIsLive(
  invite: { revokedAt: Date | null; expiresAt: Date | null; usedCount: number; maxUses: number },
  now = new Date(),
): boolean {
  return redemptionRefusal(invite, now) === null
}

/**
 * Why this invitation may not be redeemed — or null if it may.
 *
 * ⚠ THE ROUTE CALLS THIS; IT DOES NOT RESTATE IT. `POST /api/communities/join`
 * returns exactly what comes back from here, so a check can assert the refusal
 * by importing the function the redemption actually runs rather than by
 * re-implementing the rule and asserting that two pieces of code agree
 * (docs/CLAUDE.md §25.3).
 */
export function redemptionRefusal(
  invite: { revokedAt: Date | null; expiresAt: Date | null; usedCount: number; maxUses: number },
  now = new Date(),
): { status: number; error: string } | null {
  // ⚠ Revocation is checked FIRST and separately from expiry: an invitation
  // called off and one that ran out are different facts, and before 25-A the
  // only way to stop an invitation was to make it look like the second.
  if (invite.revokedAt) return { status: 410, error: 'This invitation has been withdrawn' }
  if (invite.expiresAt && invite.expiresAt < now) {
    return { status: 410, error: 'This invite has expired' }
  }
  if (invite.usedCount >= invite.maxUses) {
    return { status: 410, error: 'This invite has already been used' }
  }
  return null
}

/**
 * Everyone this node has invited, everyone who arrived through one of its
 * links, and what each of them is now.
 *
 * Reads only — the page renders exactly what comes back from here.
 */
export async function listCommunityPeople(
  communityId: string,
  now = new Date(),
): Promise<CommunityPeople> {
  const invites = await prisma.communityInvite.findMany({
    where: { communityId },
    orderBy: { createdAt: 'desc' },
  })

  const emails = Array.from(
    new Set(invites.map((i) => i.email?.toLowerCase()).filter((e): e is string => Boolean(e))),
  )

  const [invitedUsers, members, inviters, credentials, referrals] = await Promise.all([
    emails.length
      ? prisma.user.findMany({
          where: { email: { in: emails } },
          select: { id: true, email: true, name: true },
        })
      : Promise.resolve([]),
    prisma.communityMember.findMany({
      where: { communityId },
      select: { userId: true, role: true, joinedAt: true, user: { select: { email: true } } },
    }),
    prisma.user.findMany({
      where: { id: { in: Array.from(new Set(invites.map((i) => i.createdByUserId))) } },
      select: { id: true, name: true },
    }),
    // ⚠⚠ 25-A §7a — THE SIGN-UP GATE IS ASKED, NEVER RESTATED. This used to
    // read the platform `Invite` table itself and decide. §7a widened what
    // counts as a credential, and a second copy of that rule here would have
    // gone on telling owners that five people "cannot create an account" on the
    // day they could — the two-validators-one-string failure, in the surface
    // whose whole job is to be believed.
    Promise.all(emails.map(async (e) => [e, await findInviteCredential(e, now)] as const)),
    prisma.communityReferral.findMany({
      where: { inviteId: { in: invites.map((i) => i.id) } },
      select: {
        createdAt: true,
        inviteeUserId: true,
        invitee: { select: { name: true, email: true } },
        invite: { select: { inviteCode: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const userByEmail = new Map(invitedUsers.map((u) => [u.email.toLowerCase(), u]))
  const memberByEmail = new Map(members.map((m) => [m.user.email.toLowerCase(), m]))
  const memberByUserId = new Map(members.map((m) => [m.userId, m]))
  const inviterName = new Map(inviters.map((u) => [u.id, u.name]))
  const credentialByEmail = new Map(credentials)

  const direct: DirectInvitation[] = invites
    .filter((i) => i.email)
    .map((i) => {
      const email = i.email!.toLowerCase()
      const account = userByEmail.get(email) ?? null
      const membership = memberByEmail.get(email) ?? null
      const credential = credentialByEmail.get(email) ?? null

      return {
        inviteId: i.id,
        email: i.email!,
        name: account?.name ?? null,
        invitedAt: i.createdAt,
        invitedByName: inviterName.get(i.createdByUserId) ?? null,
        invitedByUserId: i.createdByUserId,
        openedAt: i.openedAt,
        expiresAt: i.expiresAt,
        revokedAt: i.revokedAt,
        joinedAt: membership?.joinedAt ?? null,
        status: statusOf({
          revokedAt: i.revokedAt,
          joinedAt: membership?.joinedAt ?? null,
          hasAccount: Boolean(account),
          expiresAt: i.expiresAt,
          openedAt: i.openedAt,
          now,
        }),
        live: inviteIsLive(i, now),
        // No account, and nothing that would let them create one. Since §7a a
        // live addressed invitation IS a credential, so this now fires only
        // when the invitation itself has expired, been withdrawn or been used
        // up — which is a different and much rarer thing than it was this
        // morning.
        cannotSignUp: !account && !credential,
        inviteCode: i.inviteCode,
      }
    })

  const arrivals: LinkArrival[] = referrals.map((r) => {
    const membership = memberByUserId.get(r.inviteeUserId) ?? null
    return {
      userId: r.inviteeUserId,
      name: r.invitee.name,
      email: r.invitee.email,
      arrivedAt: r.createdAt,
      role: membership?.role ?? null,
      inviteCode: r.invite?.inviteCode ?? null,
    }
  })

  // Referrals into this Community that name no invitation: everyone who joined
  // before `inviteId` existed. Counted, never guessed at.
  const unattributedArrivals = await prisma.communityReferral.count({
    where: { communityId, inviteId: null },
  })

  const links = invites
    .filter((i) => !i.email)
    .map((i) => ({
      inviteId: i.id,
      inviteCode: i.inviteCode,
      createdAt: i.createdAt,
      expiresAt: i.expiresAt,
      revokedAt: i.revokedAt,
      usedCount: i.usedCount,
      maxUses: i.maxUses,
      live: inviteIsLive(i, now),
    }))

  return {
    direct,
    arrivals,
    links,
    unattributedArrivals,
    removed: await listArchivedMemberships(communityId),
  }
}

/**
 * Revoke an invitation. §2d: this must PREVENT USE, not hide a row — the
 * redemption path checks `revokedAt` before anything else.
 */
export async function revokeCommunityInvite(inviteId: string, byUserId: string) {
  return prisma.communityInvite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date(), revokedByUserId: byUserId },
  })
}

/** Un-revoke — a revocation made by mistake should not need a new invitation. */
export async function restoreCommunityInvite(inviteId: string) {
  return prisma.communityInvite.update({
    where: { id: inviteId },
    data: { revokedAt: null, revokedByUserId: null },
  })
}

/**
 * Record that the invitation screen was opened, once.
 *
 * ⚠ Deliberately fire-and-forget and deliberately first-write-wins: this is a
 * note on a page view, and it must never be the reason an invitation page fails
 * to load.
 */
export async function markInviteOpened(inviteId: string): Promise<void> {
  try {
    await prisma.communityInvite.updateMany({
      where: { id: inviteId, openedAt: null },
      data: { openedAt: new Date() },
    })
  } catch {
    // A page view is not worth an error page.
  }
}
