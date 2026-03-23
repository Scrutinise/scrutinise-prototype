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

  return <>{children}</>
}
