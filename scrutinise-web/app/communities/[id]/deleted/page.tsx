import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import PublicNav from '@/components/PublicNav'
import { canManageCommunity } from '@/lib/community'
import { listDeletedContent } from '@/lib/content-deletion'
import DeletedItems from './DeletedItems'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Deleted items' }

type Props = { params: Promise<{ id: string }> }

/**
 * CENTRAL — the deleted-items view (27 Aug 2026).
 *
 * ⚠ SOFT DELETE IS ONLY HALF A FEATURE WITHOUT THIS PAGE. `deletedAt` makes a
 * removal reversible in principle; a list makes it reversible in practice. A
 * member who deleted the wrong answer, or a manager who removed a post and was
 * argued out of it, needs somewhere to look — otherwise "it's recoverable" means
 * "recoverable by whoever can write SQL".
 *
 * Manage rights, which cascade from every ancestor — the same gate as the claims
 * queue, and for the same reason: you cannot put back what you cannot see.
 */
export default async function DeletedPage({ params }: Props) {
  const { id } = await params
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) redirect(`/sign-in?redirect_url=/communities/${id}/deleted`)

  const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
  if (!user) redirect(`/sign-in?redirect_url=/communities/${id}/deleted`)

  if (!(await canManageCommunity(user.id, id))) notFound()

  const community = await prisma.community.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true },
  })
  const items = await listDeletedContent(id)

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <p className="mb-2 text-xs text-muted-foreground">
          <Link href={`/communities/${id}?tab=teams`} className="hover:underline">
            ← {community.name}
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Deleted items</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground pretty">
          Everything removed from {community.name} and the branches under it. Nothing here is gone —
          restoring puts the content back and returns the points it had earned.
        </p>

        <DeletedItems
          communityId={id}
          initial={items.map((i) => ({ ...i, deletedAt: i.deletedAt.toISOString() }))}
        />
      </main>
    </div>
  )
}
