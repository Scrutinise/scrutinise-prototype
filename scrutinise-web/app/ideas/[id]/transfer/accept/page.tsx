import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ token?: string }>
}

export default async function TransferAcceptPage({ params, searchParams }: Props) {
  const { id } = await params
  const { token } = await searchParams
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    redirect(`/sign-in?redirect_url=/ideas/${id}/transfer/accept?token=${token ?? ''}`)
  }

  if (!token) {
    return <ErrorPage ideaId={id} message="This transfer link is missing or malformed." />
  }

  const currentUser = await prisma.user.findUnique({ where: { clerkId } })
  if (!currentUser) {
    return <ErrorPage ideaId={id} message="Your account was not found." />
  }

  const idea = await prisma.idea.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      creatorId: true,
      ownershipTransferToken: true,
      ownershipTransferToId: true,
      ownershipTransferExpiry: true,
    },
  })

  if (!idea) {
    return <ErrorPage ideaId={id} message="Idea not found." />
  }

  if (idea.ownershipTransferToken !== token) {
    return <ErrorPage ideaId={id} message="Invalid or already-used transfer link." />
  }

  if (idea.ownershipTransferToId !== currentUser.id) {
    return <ErrorPage ideaId={id} message="This transfer offer is not addressed to your account." />
  }

  if (!idea.ownershipTransferExpiry || idea.ownershipTransferExpiry < new Date()) {
    return <ErrorPage ideaId={id} message="This transfer offer has expired." />
  }

  const previousOwnerId = idea.creatorId

  await prisma.$transaction(async tx => {
    await tx.idea.update({
      where: { id: idea.id },
      data: {
        creatorId: currentUser.id,
        ownershipTransferToken: null,
        ownershipTransferToId: null,
        ownershipTransferExpiry: null,
      },
    })

    await tx.ideaCollaborator.upsert({
      where: { ideaId_userId: { ideaId: idea.id, userId: previousOwnerId } },
      update: {},
      create: {
        ideaId: idea.id,
        userId: previousOwnerId,
        invitedByUserId: currentUser.id,
        acceptedAt: new Date(),
      },
    })

    await tx.notification.create({
      data: {
        userId: previousOwnerId,
        relatedIdeaId: idea.id,
        type: 'SYSTEM',
        message: `Ownership of "${idea.title}" has been transferred to ${currentUser.name}.`,
      },
    })
  })

  redirect(`/ideas/${id}?transferSuccess=1`)
}

function ErrorPage({ ideaId, message }: { ideaId: string; message: string }) {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-lg font-semibold">Transfer failed</h1>
      <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Link href={`/ideas/${ideaId}`} className="mt-6 inline-block text-sm underline">
        Back to idea
      </Link>
    </main>
  )
}
