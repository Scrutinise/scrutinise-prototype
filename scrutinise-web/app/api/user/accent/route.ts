import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ACCENT_PALETTE, DEFAULT_ACCENT_KEY, accentByKey, isAccentKey } from '@/lib/accent'

// GET /api/user/accent — the viewer's chosen accent, and the palette to pick from.
export async function GET() {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { accentColour: true },
  })
  const accent = accentByKey(row?.accentColour)
  return NextResponse.json({
    key: accent.key,
    accent,
    palette: ACCENT_PALETTE,
    isDefault: !row?.accentColour,
  })
}

const PatchSchema = z.object({
  // ⚠ An enum over the palette, not a string. The whole point of item 7 is that
  // the set of possible values is closed and vetted; a free string here would
  // reintroduce free hex through the back door, one route at a time.
  key: z.string().refine(isAccentKey, { message: 'Not a colour on the palette' }),
})

// PATCH /api/user/accent
export async function PATCH(req: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Not a colour on the palette' }, { status: 422 })
  }

  // Storing the default as NULL rather than as 'teal' keeps "I have not chosen"
  // distinguishable from "I chose the default", so a future change to the
  // platform default follows everyone who never expressed a preference.
  await prisma.user.update({
    where: { id: user.id },
    data: { accentColour: parsed.data.key === DEFAULT_ACCENT_KEY ? null : parsed.data.key },
  })

  return NextResponse.json({ key: parsed.data.key, accent: accentByKey(parsed.data.key) })
}
