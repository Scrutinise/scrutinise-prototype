import { SignUp } from '@clerk/nextjs'
import { validateInviteToken } from '@/lib/invites'
import { findInviteCredential, landingFor } from '@/lib/invite-gate'
import { prisma } from '@/lib/prisma'
import { InviteOnlyLanding } from '@/components/InviteOnlyLanding'

/**
 * ⚠⚠ CENTRAL 25-A §7a — ONE INVITATION, ONE EMAIL, ONE ACCOUNT.
 *
 * This page used to accept exactly one credential: `?invite=<platform token>`,
 * issued only by the SUPER_ADMIN. A Community invitation carried no such token,
 * so everybody invited to a branch met "Scrutinise is invite only", went to the
 * sign-in form instead, and was told by Clerk that their account could not be
 * found — five real people between 26 August and 1 September 2026.
 *
 * It now accepts either:
 *
 *   ?invite=<token>          the platform invitation, unchanged
 *   ?communityInvite=<code>  a Community or branch invitation ADDRESSED to them
 *
 * ⚠ AND THE WEBHOOK WAS TAUGHT THE SAME RULE IN THE SAME CHANGE (§7b). Both ask
 * `findInviteCredential`. Widening this door alone would have let people sign up
 * and then be deleted by `app/api/webhooks/clerk/route.ts` seconds later — a
 * silent failure, and worse than the refusal it replaced.
 *
 * ⚠ A SHARED LINK IS NOT A CREDENTIAL, deliberately: it carries no address, so
 * it cannot pre-authorise anybody, and one link passed around a WhatsApp group
 * would become open account creation.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; communityInvite?: string }>
}) {
  const { invite: token, communityInvite: code } = await searchParams

  // ── A Community or branch invitation ───────────────────────────────────────
  if (code) {
    const communityInvite = await prisma.communityInvite.findUnique({
      where: { inviteCode: code },
      select: { email: true },
    })

    // ⚠ The CODE is not the credential — the ADDRESS on it is. The code is
    // looked up only to find whose invitation it is; whether that address may
    // have an account is decided by the same function the webhook asks.
    const credential = communityInvite?.email
      ? await findInviteCredential(communityInvite.email)
      : null

    if (!credential) {
      return <InviteOnlyLanding reason={communityInvite ? 'expired' : 'not_found'} />
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-[--background] px-4">
        <SignUp
          initialValues={{ emailAddress: credential.email }}
          // §7a — "lands them where they were invited": back to the invitation
          // they came from, one click from being in, rather than a dashboard
          // that says nothing about why they signed up.
          forceRedirectUrl={landingFor(credential)}
        />
      </div>
    )
  }

  // ── The platform invitation ────────────────────────────────────────────────
  if (!token) return <InviteOnlyLanding />

  const result = await validateInviteToken(token)
  if (!result.valid) {
    return <InviteOnlyLanding reason={result.reason} />
  }

  // Clerk only allows sign-up with this email because it's on the allowlist.
  // initialValues pre-fills but doesn't lock — the webhook gate does the locking.
  return (
    <div className="min-h-screen flex items-center justify-center bg-[--background] px-4">
      <SignUp
        initialValues={{ emailAddress: result.invite.email }}
        forceRedirectUrl="/dashboard"
      />
    </div>
  )
}
