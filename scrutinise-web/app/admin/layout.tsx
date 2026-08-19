// ─────────────────────────────────────────────────────────────────────────────
// AMENDMENT_25B §D — /admin had no way back to the rest of the site.
//
// The admin pages render their own tab bar and nothing else, so once you were in there
// the only exit was the browser's back button. It has annoyed Charlie for weeks.
//
// ⚠ THE FIX GOES IN THE LAYOUT, NOT IN `page.tsx`. There are three admin routes —
// `/admin`, `/admin/invites` and `/admin/lex-general` — and all three were equally
// trapped. Putting the bar on the page that happened to be complained about would have
// left the other two exactly as they were.
// ─────────────────────────────────────────────────────────────────────────────

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId: clerkUserId } = await auth()

  if (!clerkUserId) {
    redirect('/sign-in?redirect_url=/admin')
  }

  const dbUser = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { role: true },
  })

  if (!dbUser) {
    redirect('/sign-in?redirect_url=/admin')
  }

  if (!['ADMIN', 'SUPER_ADMIN'].includes(dbUser.role)) {
    redirect('/dashboard')
  }

  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 flex items-center gap-1.5"
          >
            <span aria-hidden>←</span> Scrutinise
          </Link>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Admin
          </span>
        </div>
      </header>
      {children}
    </>
  )
}
