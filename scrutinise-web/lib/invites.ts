import { randomBytes } from 'crypto'
import { clerkClient } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

const INVITE_TTL_DAYS = 14

export function generateInviteToken(): string {
  return randomBytes(32).toString('hex')
}

export async function createInvite(email: string, invitedBy: string) {
  const normalisedEmail = email.trim().toLowerCase()
  const token = generateInviteToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

  const invite = await prisma.invite.upsert({
    where: { email: normalisedEmail },
    create: { email: normalisedEmail, token, invitedBy, expiresAt },
    update: { token, invitedBy, expiresAt, usedAt: null, revokedAt: null, createdAt: new Date() },
  })

  try {
    const client = await clerkClient()
    await client.allowlistIdentifiers.createAllowlistIdentifier({
      identifier: normalisedEmail,
      notify: false,
    })
  } catch (err: unknown) {
    // 422 means already on allowlist — fine. Anything else, log and continue;
    // the DB record is the source of truth and admin can resend to re-run this.
    const status = (err as { status?: number })?.status
    if (status !== 422) {
      console.error('[invites] Clerk allowlist add failed:', err)
    }
  }

  return invite
}

export async function revokeInvite(inviteId: string) {
  const invite = await prisma.invite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date() },
  })

  try {
    const client = await clerkClient()
    const list = await client.allowlistIdentifiers.getAllowlistIdentifierList()
    const entry = list.data.find((i) => i.identifier === invite.email)
    if (entry) await client.allowlistIdentifiers.deleteAllowlistIdentifier(entry.id)
  } catch (err) {
    console.error('[invites] Clerk allowlist remove failed:', err)
  }

  return invite
}

export async function markInviteUsed(token: string) {
  return prisma.invite.update({
    where: { token },
    data: { usedAt: new Date() },
  })
}

export async function validateInviteToken(token: string) {
  const invite = await prisma.invite.findUnique({ where: { token } })
  if (!invite) return { valid: false as const, reason: 'not_found' as const }
  if (invite.usedAt) return { valid: false as const, reason: 'used' as const }
  if (invite.revokedAt) return { valid: false as const, reason: 'revoked' as const }
  if (invite.expiresAt < new Date()) return { valid: false as const, reason: 'expired' as const }
  return { valid: true as const, invite }
}
