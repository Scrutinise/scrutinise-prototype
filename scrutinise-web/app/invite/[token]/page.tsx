import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

type Props = { params: Promise<{ token: string }> }

// ─────────────────────────────────────────────────────────────────────────────
// Shared layout wrapper
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
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default async function InvitePage({ params }: Props) {
  const { token } = await params
  const { userId: clerkUserId } = await auth()

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://scrutinise.org'

  // Look up invite with inviter name and idea title
  const invite = await prisma.userInvite.findUnique({
    where: { magicLinkToken: token },
    include: {
      invitedBy: { select: { name: true } },
    },
  })

  // ── Invalid token ──────────────────────────────────────────────────────────
  if (!invite) {
    return (
      <InviteLayout>
        <h1 className="text-lg font-semibold text-zinc-900 mb-2">Invalid link</h1>
        <p className="text-sm text-zinc-600 mb-6">
          This invite link is invalid or has been removed.
        </p>
        <Link href="/" className="text-sm font-medium text-zinc-900 underline underline-offset-2">
          Back to Scrutinise
        </Link>
      </InviteLayout>
    )
  }

  // ── Already used ───────────────────────────────────────────────────────────
  if (invite.status === 'ACCEPTED') {
    const ideaHref = invite.ideaId ? `/prototype/idea/${invite.ideaId}` : '/'
    return (
      <InviteLayout>
        <h1 className="text-lg font-semibold text-zinc-900 mb-2">Already accepted</h1>
        <p className="text-sm text-zinc-600 mb-6">
          This invitation has already been accepted.
        </p>
        {invite.ideaId && (
          <Link
            href={ideaHref}
            className="inline-block px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg"
          >
            Go to idea
          </Link>
        )}
      </InviteLayout>
    )
  }

  // ── Expired ────────────────────────────────────────────────────────────────
  if (invite.status === 'EXPIRED' || invite.expiresAt < new Date()) {
    // Mark as expired if not already
    if (invite.status === 'PENDING') {
      await prisma.userInvite.update({
        where: { id: invite.id },
        data: { status: 'EXPIRED' },
      })
    }
    return (
      <InviteLayout>
        <h1 className="text-lg font-semibold text-zinc-900 mb-2">Link expired</h1>
        <p className="text-sm text-zinc-600 mb-6">
          This invite link expired after 7 days. Ask {invite.invitedBy.name} to send a new invitation.
        </p>
        <Link href="/" className="text-sm font-medium text-zinc-900 underline underline-offset-2">
          Back to Scrutinise
        </Link>
      </InviteLayout>
    )
  }

  // ── Fetch idea title for display ───────────────────────────────────────────
  const idea = invite.ideaId
    ? await prisma.idea.findUnique({
        where: { id: invite.ideaId },
        select: { id: true, title: true },
      })
    : null

  // ── Signed in — check email match ──────────────────────────────────────────
  if (clerkUserId) {
    const dbUser = await prisma.user.findUnique({ where: { clerkId: clerkUserId } })

    if (dbUser) {
      if (dbUser.email.toLowerCase() !== invite.email.toLowerCase()) {
        // Signed in as wrong account
        return (
          <InviteLayout>
            <h1 className="text-lg font-semibold text-zinc-900 mb-2">Wrong account</h1>
            <p className="text-sm text-zinc-600 mb-4">
              This invitation was sent to <strong>{invite.email}</strong>. You are currently
              signed in as <strong>{dbUser.email}</strong>.
            </p>
            <p className="text-sm text-zinc-600 mb-6">
              Sign out and sign in with the invited address to accept.
            </p>
            <Link
              href="/sign-in"
              className="inline-block px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-lg"
            >
              Sign in with a different account
            </Link>
          </InviteLayout>
        )
      }

      // Correct email — auto-accept
      if (invite.ideaId && idea) {
        const existing = await prisma.ideaCollaborator.findFirst({
          where: { ideaId: invite.ideaId, userId: dbUser.id },
        })

        if (!existing) {
          await prisma.ideaCollaborator.create({
            data: {
              ideaId: invite.ideaId,
              userId: dbUser.id,
              role: invite.collaboratorRole ?? 'EDITOR',
              invitedByUserId: invite.invitedByUserId,
            },
          })
        }

        await prisma.userInvite.update({
          where: { id: invite.id },
          data: { status: 'ACCEPTED' },
        })

        redirect(`/prototype/idea/${invite.ideaId}`)
      }
    }
  }

  // ── Not signed in — show invite preview ────────────────────────────────────
  const returnUrl = encodeURIComponent(`${APP_URL}/invite/${token}`)
  const signInUrl = `/sign-in?redirect_url=${returnUrl}`
  const signUpUrl = `/sign-up?email_address=${encodeURIComponent(invite.email)}&redirect_url=${returnUrl}`

  return (
    <InviteLayout>
      {/* Header */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400 mb-3">
          Scrutinise
        </p>
        <h1 className="text-xl font-semibold text-zinc-900 mb-1">
          You&apos;ve been invited to collaborate
        </h1>
        <p className="text-sm text-zinc-600">
          <strong>{invite.invitedBy.name}</strong> has invited you to join them on:
        </p>
      </div>

      {/* Idea card */}
      {idea && (
        <div className="bg-zinc-50 border border-zinc-200 rounded-lg px-4 py-3 mb-4">
          <p className="text-sm font-semibold text-zinc-900">&ldquo;{idea.title}&rdquo;</p>
        </div>
      )}

      {/* Custom message */}
      {invite.customMessage && (
        <blockquote className="border-l-2 border-zinc-300 pl-3 mb-4">
          <p className="text-sm text-zinc-600 italic">&ldquo;{invite.customMessage}&rdquo;</p>
          <p className="text-xs text-zinc-400 mt-1">— {invite.invitedBy.name}</p>
        </blockquote>
      )}

      {/* Role badge */}
      <p className="text-xs text-zinc-500 mb-6">
        You will join as a{' '}
        <span className="font-medium text-zinc-700">
          {invite.collaboratorRole === 'VIEWER' ? 'viewer' : 'editor'}
        </span>
        .
      </p>

      {/* CTAs */}
      <div className="space-y-3">
        <Link
          href={signUpUrl}
          className="block w-full text-center px-4 py-2.5 bg-zinc-900 text-white text-sm font-semibold rounded-lg hover:bg-zinc-700 transition-colors"
        >
          Create a Scrutinise account to accept
        </Link>
        <Link
          href={signInUrl}
          className="block w-full text-center px-4 py-2.5 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-50 transition-colors"
        >
          I already have an account — sign in
        </Link>
      </div>

      {/* Expiry notice */}
      <p className="text-xs text-zinc-400 mt-5 text-center">
        This invitation expires{' '}
        {new Date(invite.expiresAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        .
      </p>
    </InviteLayout>
  )
}
