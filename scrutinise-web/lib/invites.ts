import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'

const INVITE_TTL_DAYS = 14

export function generateInviteToken(): string {
  return randomBytes(32).toString('hex')
}

export async function createInvite(email: string, invitedBy: string) {
  const normalisedEmail = email.trim().toLowerCase()
  const token = generateInviteToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

  // No Clerk allowlist call — paid feature not available on free plan.
  // Email match is enforced by the webhook at app/api/webhooks/clerk/route.ts,
  // which deletes any Clerk user whose email has no valid invite.
  return prisma.invite.upsert({
    where: { email: normalisedEmail },
    create: { email: normalisedEmail, token, invitedBy, expiresAt },
    update: { token, invitedBy, expiresAt, usedAt: null, revokedAt: null, createdAt: new Date() },
  })
}

export async function revokeInvite(inviteId: string) {
  return prisma.invite.update({
    where: { id: inviteId },
    data: { revokedAt: new Date() },
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
