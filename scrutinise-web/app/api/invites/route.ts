import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { createInvite } from '@/lib/invites'
import { sendSignUpInviteEmail } from '@/lib/email'

async function requireSuperAdmin() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return { admin: null }
  if (user.role !== 'SUPER_ADMIN') return { admin: null }
  return { admin: user }
}

export async function GET() {
  const { admin } = await requireSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const invites = await prisma.invite.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  return NextResponse.json({ invites })
}

const PostSchema = z.object({
  email: z.string().email(),
})

export async function POST(req: NextRequest) {
  const { admin } = await requireSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = PostSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const invite = await createInvite(parsed.data.email, admin.clerkId)

  try {
    await sendSignUpInviteEmail(invite.email, invite.token, admin.name)
  } catch (err) {
    console.error('[invites] Email send failed:', err)
    return NextResponse.json({
      invite,
      warning: 'Invite created but email failed to send. Use the resend button.',
    })
  }

  return NextResponse.json({ invite })
}
