import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) return NextResponse.json({ role: null })

  const user = await prisma.user.findUnique({
    where: { clerkId: clerkUserId },
    select: { role: true },
  })

  return NextResponse.json({ role: user?.role ?? null })
}
