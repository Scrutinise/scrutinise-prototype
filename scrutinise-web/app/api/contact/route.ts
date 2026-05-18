import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendContactFormEmail } from '@/lib/email'

// Simple in-memory rate limit: one submission per IP per 60s.
// Fine for single-region Vercel; swap for Upstash if multi-region.
const recentSubmissions = new Map<string, number>()

const BodySchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const now = Date.now()
  const last = recentSubmissions.get(ip)
  if (last && now - last < 60_000) {
    return NextResponse.json({ error: 'Please wait before submitting again' }, { status: 429 })
  }

  const body = await req.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing or invalid fields' }, { status: 400 })
  }

  recentSubmissions.set(ip, now)

  try {
    await sendContactFormEmail(parsed.data.email, parsed.data.name, parsed.data.message)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[contact] Email send failed:', err)
    return NextResponse.json(
      { error: 'Failed to send. Please email cl@scrutinise.org directly.' },
      { status: 500 },
    )
  }
}
