// 26-J §4 — the Dashboard/Ideas-list sort choice, on the user record, not localStorage.
// GET returns the current choice (null = unset, reads as 'recent'); PATCH sets it.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedUser } from '@/lib/auth'

const IDEA_SORT_MODES = ['recent', 'name', 'created'] as const

export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error
  return NextResponse.json({ mode: user.ideaSortMode ?? 'recent' })
}

const BodySchema = z.object({ mode: z.enum(IDEA_SORT_MODES) })

export async function PATCH(req: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  await prisma.user.update({ where: { id: user.id }, data: { ideaSortMode: parsed.data.mode } })
  return NextResponse.json({ mode: parsed.data.mode })
}
