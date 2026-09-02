import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { markInviteOpened } from '@/lib/community-invitations'
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

  // 25-A §2a — record that the link was opened, once. Fire-and-forget: a note
  // on a page view must never be the reason the page fails to load.
  void markInviteOpened(invite.id)

  // 25-A §2d — withdrawn is its own answer, not "expired" and not "used".
  if (invite.revokedAt) {
    return (
      <InviteLayout>
        <h1 className="text-lg font-semibold text-zinc-900 mb-2">Invitation withdrawn</h1>
        <p className="text-sm text-zinc-600 mb-6">
          This invitation to <strong>{invite.community.name}</strong> has been withdrawn. Ask an
          admin for a new one.
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
  // ⚠⚠ CENTRAL 25-A §7a — THE LINK THAT USED TO LEAD NOWHERE.
  //
  // This was `/sign-up?email_address=…&redirect_url=…`, which the sign-up page
  // ignores entirely: with no credential it renders "Scrutinise is invite only".
  // It now hands over THIS invitation as the credential, and the sign-up page
  // and the Clerk webhook both recognise it (lib/invite-gate.ts).
  //
  // A shared link still cannot authorise an account — it names nobody.
  const signUpUrl = invite.email
    ? `/sign-up?communityInvite=${encodeURIComponent(code)}`
    : `/sign-up?redirect_url=${returnUrl}`

  // ⚠ CENTRAL 25-A §1 — SAY IT IF IT IS STILL TRUE, AND ONLY THEN.
  //
  // §7a removed the wall for an ADDRESSED invitation: this page now hands its own
  // invitation to the sign-up page as the credential. What is left is the case
  // that genuinely cannot be authorised — somebody holding a SHARED LINK who has
  // no account and no invitation of their own. They are told, rather than being
  // sent to a page that will refuse them without saying why.
  let needsOwnInvitation = false
  if (!clerkUserId && !invite.email) {
    needsOwnInvitation = true
  }

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

      {/* ⚠ 25-A §3b — a shared link is an introduction, not an admission. Say so
          before they press the button, not after. */}
      {!invite.email && (
        <p className="text-xs text-zinc-500 mb-6">
          This is a shared link, so joining is not automatic: someone at{' '}
          {invite.community.name} has to let you in. You will be told when they do.
        </p>
      )}

      {clerkUserId ? (
        <JoinButton code={code} isLink={!invite.email} />
      ) : (
        <div className="space-y-3">
          {needsOwnInvitation && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold text-amber-900 mb-1">
                This link cannot create an account for you
              </p>
              <p className="text-xs text-amber-800">
                Scrutinise itself is invite only, and a shared link is not addressed to anybody in
                particular — so it cannot open an account. Ask whoever sent it to invite you by
                email instead: that invitation will let you create your account and join in one go.
              </p>
            </div>
          )}
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
