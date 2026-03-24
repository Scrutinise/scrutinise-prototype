import { prisma } from './prisma'

/**
 * Anonymise accounts where deletionScheduledFor has passed.
 * Run this function via a scheduled job (Railway cron or Vercel cron).
 * It does NOT delete the User record — contribution history is preserved
 * with anonymised author details.
 */
export async function anonymiseExpiredAccounts(): Promise<void> {
  const now = new Date()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expired = await (prisma.user.findMany as any)({
    where: {
      status: 'DELETION_PENDING',
      deletionScheduledFor: { lt: now },
    },
    select: { id: true },
  }) as { id: string }[]

  for (const { id } of expired) {
    const anon = `deleted_${id.slice(0, 8)}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma.user.update as any)({
      where: { id },
      data: {
        name: 'Deleted User',
        firstName: 'Deleted',
        lastName: 'User',
        email: `${anon}@deleted.scrutinise.co.uk`,
        username: anon,
        bio: null,
        preferredName: null,
        displayName: null,
        status: 'DELETED',
        deletionRequestedAt: null,
        deletionScheduledFor: null,
      },
    })
  }
}
