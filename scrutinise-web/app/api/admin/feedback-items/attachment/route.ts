// 26-S decision 154 — open one attachment of a feedback item. Admin only. The key comes from the ROW (item id + index), never from the
// request, so this cannot be pointed at an arbitrary object; the bucket stays private and the URL is a fresh signed one (security rule 10).

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'
import { r2SignedUrl } from '@/lib/r2'
import type { FeedbackAttachment } from '@/lib/lex/feedback-types'

export async function GET(req: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) return NextResponse.json({ error: 'Only an administrator can open feedback attachments.' }, { status: 403 })
  const q = new URL(req.url).searchParams
  const id = q.get('id') ?? ''
  const index = Number(q.get('index'))
  const row = id ? await prisma.feedbackItem.findUnique({ where: { id }, select: { attachments: true } }) : null
  const list = ((row?.attachments ?? []) as unknown as FeedbackAttachment[])
  const att = Number.isInteger(index) ? list[index] : undefined
  if (!att) return NextResponse.json({ error: 'That attachment is not on this feedback item (the item or the file number was not found).' }, { status: 404 })
  const url = await r2SignedUrl(att.key, { expiresIn: 300 })
  return NextResponse.redirect(url, 302)
}
