import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import JoinButton from './JoinButton'

type Props = { params: Promise<{ code: string }> }

// ─────────────────────────────────────────────────────────────────────────────
// Shared layout wrapper — mirrors app/invite/[token]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
function InviteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-xl shadow-sm p-8">
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page — Community invite screen (docs/SCRUTINISE_CENTRAL_SPEC.md §3 item 6):
// name, rules, what earns points — shown before joining; joining is blocked
// until this page is seen, via an explicit Join click rather than auto-accept
// (a reusable code isn't a targeted 1:1 invite the way UserInvite's magic
// link is, so silent auto-accept on page view would be the wrong default).
// ─────────────────────────────────────────────────────────────────────────────
export default async function CommunityInvitePage({ params }: Props) {
  const { code } = await params
  const { userId: clerkUserId } = await auth()

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://scrutinise.org'

  const invite = await prisma.communityInvite.findUnique({
    where: { inviteCode: code },
    include: { community: { select: { id: true, name: true, description: true } } },
  })

  if (!invite) {
    return (
      <InviteLayout>
        <h1 className="text-lg font-semibold text-zinc-900 mb-2">Invalid link</h1>
        <p className="text-sm text-zinc-600 mb-6">
          This invite code is invalid or has been removed.
        </p>
        <Link href="/" className="text-sm font-medium text-zinc-900 underline underline-offset-2">
          Back to Scrutinise
        </Link>
      </InviteLayout>
    )
  }

  if (invite.expiresAt && invite.expiresAt < new Date()) {
    return (
      <InviteLayout>
        <h1 className="text-lg font-semibold text-zinc-900 mb-2">Link expired</h1>
        <p className="text-sm text-zinc-600 mb-6">
          This invite to <strong>{invite.community.name}</strong> has expired. Ask an admin for a new one.
        </p>
        <Link href="/" className="text-sm font-medium text-zinc-900 underline underline-offset-2">
          Back to Scrutinise
        </Link>
      </InviteLayout>
    )
  }

  if (invite.usedCount >= invite.maxUses) {
    return (
      <InviteLayout>
        <h1 className="text-lg font-semibold text-zinc-900 mb-2">Invite no longer available</h1>
        <p className="text-sm text-zinc-600 mb-6">
          This invite to <strong>{invite.community.name}</strong> has already been used.
        </p>
        <Link href="/" className="text-sm font-medium text-zinc-900 underline underline-offset-2">
          Back to Scrutinise
        </Link>
      </InviteLayout>
    )
  }

  const returnUrl = encodeURIComponent(`${APP_URL}/community-invite/${code}`)
  const signInUrl = `/sign-in?redirect_url=${returnUrl}`
  const signUpUrl = invite.email
    ? `/sign-up?email_address=${encodeURIComponent(invite.email)}&redirect_url=${returnUrl}`
    : `/sign-up?redirect_url=${returnUrl}`

  return (
    <InviteLayout>
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">
          Scrutinise Central
        </p>
        <h1 className="text-xl font-semibold text-zinc-900 mb-1">
          You&apos;re invited to join
        </h1>
        <p className="text-sm text-zinc-600">a Community on Scrutinise:</p>
      </div>

      <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 mb-4">
        <p className="text-sm font-semibold text-zinc-900">{invite.community.name}</p>
        {invite.community.description && (
          <p className="text-sm text-zinc-600 mt-2 whitespace-pre-wrap">{invite.community.description}</p>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-6">
        <p className="text-xs font-semibold text-amber-800 mb-1">What earns points here</p>
        <p className="text-xs text-amber-700">
          Points &amp; leaderboards for this Community are coming soon — for now, joining gets you into
          the Teams &amp; branches structure and the bulletin board.
        </p>
      </div>

      <p className="text-xs text-zinc-500 mb-6">
        Community membership does not give you access to any Idea — Ideas stay governed by their own
        collaborator permissions.
      </p>

      {clerkUserId ? (
        <JoinButton code={code} />
      ) : (
        <div className="space-y-3">
          <Link
            href={signUpUrl}
            className="block w-full text-center px-4 py-2.5 bg-zinc-900 text-white text-sm font-semibold rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Create a Scrutinise account to join
          </Link>
          <Link
            href={signInUrl}
            className="block w-full text-center px-4 py-2.5 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-50 transition-colors"
          >
            I already have an account — sign in
          </Link>
        </div>
      )}

      {invite.expiresAt && (
        <p className="text-xs text-zinc-400 mt-5 text-center">
          This invitation expires{' '}
          {new Date(invite.expiresAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          .
        </p>
      )}
    </InviteLayout>
  )
}
