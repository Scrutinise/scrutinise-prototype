import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { getRootCommunityId } from '@/lib/community'
import { requireInviteRight } from '@/lib/community-permissions'
import { revokeCommunityInvite, restoreCommunityInvite } from '@/lib/community-invitations'
import { sendCommunityInviteEmail } from '@/lib/email'

type Params = { params: Promise<{ id: string; inviteId: string }> }

/**
 * CENTRAL 25-A §2d — resend and revoke, on one invitation.
 *
 *   POST   → send the invitation email again
 *   DELETE → revoke it. ⚠ The revocation is enforced at redemption
 *            (app/api/communities/join/route.ts checks `revokedAt` first), so
 *            this genuinely stops the link working rather than tidying a list.
 *   PATCH  → restore a revocation made by mistake.
 *
 * Every one of them re-checks manage rights on the node the invitation belongs
 * to, and refuses an invitation belonging to a different node — the id in the
 * path is not evidence of anything on its own.
 *
 * ⚠⚠ CENTRAL 25-C §1d — THIS FILE DELIBERATELY DID NOT MOVE. §1d opened the
 * CREATION of an invitation to any member of the branch, and the trap it names
 * is that `requireInviteRight` guards these three verbs too. Widening the
 * import here would let every member of every branch withdraw the branch
 * manager's invitations and reinstate ones the manager had called off. **Create
 * opens; revoke and restore stay with the manager**, so ../route.ts uses
 * `requireInviteCreateRight` and this one keeps `requireInviteRight`.
 *
 * ⚠ RESEND (POST) IS NOT NAMED BY §1d and is kept on the narrow side, which is
 * a judgment call and is reported as one: it acts on an existing invitation and
 * puts mail in somebody's inbox, so the conservative reading applies until
 * Charlie says otherwise. The cost is that a branch member who created an
 * invitation cannot send it again themselves.
 */
async function loadInvite(communityId: string, inviteId: string) {
  const invite = await prisma.communityInvite.findUnique({
    where: { id: inviteId },
    include: {
      community: { select: { id: true, name: true, parentCommunityId: true } },
    },
  })
  if (!invite || invite.communityId !== communityId) return null
  return invite
}

export async function POST(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId, inviteId } = await params
  // ⚠ 25-A §3a — resending, withdrawing and restoring are invitation acts,
  // so they follow the owner's invitation setting rather than manage rights.
  const denied = await requireInviteRight(user.id, communityId)
  if (denied) return denied

  const invite = await loadInvite(communityId, inviteId)
  if (!invite) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!invite.email) {
    return NextResponse.json(
      { error: 'That is a shared link, not an emailed invitation — copy the link instead.' },
      { status: 422 },
    )
  }
  if (invite.revokedAt) {
    return NextResponse.json(
      { error: 'That invitation has been withdrawn — restore it first.' },
      { status: 409 },
    )
  }

  const rootId = await getRootCommunityId(communityId)
  const rootName =
    rootId === communityId
      ? invite.community.name
      : (await prisma.community.findUniqueOrThrow({ where: { id: rootId }, select: { name: true } }))
          .name

  // ⚠ REPORTED, NEVER ASSUMED — the same rule as the first send: sendEmail goes
  // quiet when there is no API key and when the address is suppressed, and
  // telling an owner "resent" when nothing left the building is the whole
  // failure this work exists to remove.
  const emailed = await sendCommunityInviteEmail({
    toEmail: invite.email,
    invitedByName: user.name,
    communityName: invite.community.name,
    isBranch: invite.community.parentCommunityId !== null,
    rootName,
    inviteCode: invite.inviteCode,
  })

  return NextResponse.json({ emailed })
}

export async function DELETE(_req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId, inviteId } = await params
  // ⚠ 25-A §3a — resending, withdrawing and restoring are invitation acts,
  // so they follow the owner's invitation setting rather than manage rights.
  const denied = await requireInviteRight(user.id, communityId)
  if (denied) return denied

  const invite = await loadInvite(communityId, inviteId)
  if (!invite) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await revokeCommunityInvite(inviteId, user.id)
  return NextResponse.json({ revoked: true })
}

const PatchSchema = z.object({ action: z.literal('restore') })

export async function PATCH(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id: communityId, inviteId } = await params
  // ⚠ 25-A §3a — resending, withdrawing and restoring are invitation acts,
  // so they follow the owner's invitation setting rather than manage rights.
  const denied = await requireInviteRight(user.id, communityId)
  if (denied) return denied

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Unknown action' }, { status: 422 })

  const invite = await loadInvite(communityId, inviteId)
  if (!invite) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await restoreCommunityInvite(inviteId)
  return NextResponse.json({ restored: true })
}
