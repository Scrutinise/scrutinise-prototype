import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { revokeInvite } from '@/lib/invites'
import { sendSignUpInviteEmail } from '@/lib/email'

async function requireSuperAdmin() {
  const { error, user } = await getAuthenticatedUser()
  if (error || !user) return { admin: null }
  if (user.role !== 'SUPER_ADMIN') return { admin: null }
  return { admin: user }
}

// DELETE /api/invites/[id] — revoke
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { admin } = await requireSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const invite = await revokeInvite(id)
  return NextResponse.json({ invite })
}

// POST /api/invites/[id] — resend
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { admin } = await requireSuperAdmin()
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const invite = await prisma.invite.findUnique({ where: { id } })
  if (!invite) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await sendSignUpInviteEmail(invite.email, invite.token, admin.name)
  return NextResponse.json({ ok: true })
}
