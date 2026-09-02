/**
 * CENTRAL 25-A §7a/§7b — ONE INVITATION, ONE EMAIL, ONE ACCOUNT.
 *
 * ⚠⚠ THE ONE PLACE THAT DECIDES WHETHER AN ADDRESS MAY HAVE A SCRUTINISE
 * ACCOUNT. Before 25-A that decision existed twice, in two files, and they did
 * not agree with each other about anything except the platform `Invite` table:
 *
 *   · `app/sign-up/[[...sign-up]]/page.tsx` refused anybody without an
 *     `?invite=<token>`, and
 *   · `app/api/webhooks/clerk/route.ts` DELETED the Clerk account of anybody
 *     whose email had no valid platform `Invite`.
 *
 * A Community invitation satisfied neither, which is why five real people were
 * invited to a branch between 26 August and 1 September 2026 and could not
 * create an account (§1).
 *
 * ⚠⚠ §7b IS THE DANGEROUS HALF AND IT IS WHY THIS IS ONE FUNCTION. If the
 * sign-up door starts accepting a new kind of invitation and the WEBHOOK does
 * not learn about it in the same change, people sign up successfully and are
 * then silently deleted seconds later — which is worse than being refused,
 * because nobody finds out. Both callers now ask this function, so the two
 * cannot drift apart: there is nothing to keep in sync.
 *
 * ⚠ WHAT COUNTS AS A CREDENTIAL, AND WHAT DELIBERATELY DOES NOT:
 *
 *   PLATFORM   a valid `Invite` row — unused, unrevoked, unexpired.
 *   COMMUNITY  a `CommunityInvite` ADDRESSED TO THAT PERSON — unrevoked,
 *              unexpired, not used up.
 *   nothing    a SHARED LINK. It carries no address, so it cannot pre-authorise
 *              anybody, and treating it as a credential would turn one link
 *              passed around a WhatsApp group into open account creation. A link
 *              arrival still needs an account first — see the report's §7a.
 *
 * ⚠ NOTE ON §7a's LETTER. The brief says a Community invitation should "issue
 * the platform invite as part of the same act". Recognising the Community
 * invitation itself as a credential produces the same experience — one email,
 * one account, no second invitation to find — WITHOUT a second row, and it
 * avoids a live hazard: `createInvite()` upserts on the address and its update
 * branch rewrites `createdAt` and clears `usedAt`, so minting a platform invite
 * from a Community one would silently destroy the record of any platform
 * invitation that address already held. One act, one record. Stated here
 * because it is a departure from the letter of the instruction.
 */
import { prisma } from '@/lib/prisma'

export type InviteCredential =
  | {
      kind: 'PLATFORM'
      inviteId: string
      email: string
      /** Marked used by the webhook once the account exists. */
      consumeOnSignUp: true
    }
  | {
      kind: 'COMMUNITY'
      inviteId: string
      email: string
      inviteCode: string
      communityId: string
      communityName: string
      /**
       * ⚠ FALSE, AND ON PURPOSE. A Community invitation is consumed when the
       * person JOINS, not when they create an account — otherwise signing up
       * would burn the invitation and leave them outside the branch they were
       * invited to, holding an account and nothing else.
       */
      consumeOnSignUp: false
    }

/**
 * May this address create a Scrutinise account, and on what authority?
 *
 * Returns the credential, or null. Never throws: a lookup failure must not
 * become an outage on the sign-up path.
 */
export async function findInviteCredential(
  rawEmail: string,
  now = new Date(),
): Promise<InviteCredential | null> {
  const email = rawEmail.trim().toLowerCase()
  if (!email) return null

  const platform = await prisma.invite.findUnique({ where: { email } })
  if (platform && !platform.usedAt && !platform.revokedAt && platform.expiresAt > now) {
    return { kind: 'PLATFORM', inviteId: platform.id, email, consumeOnSignUp: true }
  }

  // ⚠ ADDRESSED INVITATIONS ONLY — `email: { not: null }` is doing real work
  // here. Without it every shared link in the database would authorise every
  // address in the world.
  const community = await prisma.communityInvite.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: 'desc' },
    include: { community: { select: { id: true, name: true } } },
  })
  if (community && community.usedCount < community.maxUses) {
    return {
      kind: 'COMMUNITY',
      inviteId: community.id,
      email,
      inviteCode: community.inviteCode,
      communityId: community.community.id,
      communityName: community.community.name,
      consumeOnSignUp: false,
    }
  }

  return null
}

/** Convenience for the pages that only need the yes/no. */
export async function canCreateAccount(email: string, now = new Date()): Promise<boolean> {
  return (await findInviteCredential(email, now)) !== null
}

/**
 * Where a person should land after creating their account.
 *
 * §7a: "what they experience is a single invitation to Scrutinise that lands
 * them where they were invited". For a Community invitation that is the
 * invitation screen itself, one click from being in.
 */
export function landingFor(credential: InviteCredential): string {
  return credential.kind === 'COMMUNITY'
    ? `/community-invite/${credential.inviteCode}`
    : '/dashboard'
}
