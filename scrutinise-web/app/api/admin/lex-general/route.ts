import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { runGeneralCorpusChat } from '@/lib/lex/general-chat'

// POST /api/admin/lex-general — the general corpus chat turn. ADMIN / SUPER_ADMIN only.
//
// ADMIN-ONLY BECAUSE IT BYPASSES THE IDEA STRUCTURE. There is no open idea, no
// on-topic requirement and no field machine, which is the entire point of it as a
// search-testing surface and exactly why it is not a citizen-facing route yet:
// nothing here holds the answer to a policy method, and the corpus can be asked
// anything at all.
//
// STATELESS BY CONSTRUCTION. The transcript arrives from the client and is not
// persisted. This route reads no Idea and writes nothing — a surface that skips the
// idea structure must not be able to leave a mark on idea data.
const BodySchema = z.object({
  question: z.string().trim().min(3).max(1000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'lex']),
        content: z.string().max(8000),
      }),
    )
    .max(40)
    .optional(),
  /** Canonical results requested from the gateway before grouping. */
  limit: z.number().int().min(1).max(40).optional(),
})

export async function POST(req: Request) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // One retrieval fan-out plus one Gemini call per turn; the same ceiling the other
  // AI/search routes use. Cheap for the user to hold Enter down, not free for us.
  if (!checkRateLimit(`lex-general:${user.id}`, 40, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Rate limit exceeded — try again shortly.' }, { status: 429 })
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { question, history, limit } = parsed.data
  const out = await runGeneralCorpusChat({ question, history, limit })
  return NextResponse.json(out)
}
