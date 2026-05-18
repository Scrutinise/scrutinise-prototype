import { SignUp } from '@clerk/nextjs'
import { validateInviteToken } from '@/lib/invites'
import { InviteOnlyLanding } from '@/components/InviteOnlyLanding'

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>
}) {
  const { invite: token } = await searchParams

  if (!token) return <InviteOnlyLanding />

  const result = await validateInviteToken(token)
  if (!result.valid) {
    return <InviteOnlyLanding reason={result.reason} />
  }

  // Clerk only allows sign-up with this email because it's on the allowlist.
  // initialValues pre-fills but doesn't lock — the allowlist does the locking.
  return (
    <div className="min-h-screen flex items-center justify-center bg-[--background] px-4">
      <SignUp
        initialValues={{ emailAddress: result.invite.email }}
        forceRedirectUrl="/dashboard"
      />
    </div>
  )
}
