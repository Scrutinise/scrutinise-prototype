// ─────────────────────────────────────────────────────────────────────────────
// §8.2 — the idea's generated documents.
//
//   GET  → current export status, including whether the stored file still
//          matches the state it was rendered from.
//   POST → generate, or regenerate on demand (the briefing changes when a search
//          is re-run, and a stale file is never served in its place).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rateLimit'
import { authorizeIdea } from '@/lib/lex/authz'
import { generateExport, readExportStatus } from '@/lib/documents/export'
import { ExportUnavailableError } from '@/lib/documents/build-initial-background'

type Params = { params: Promise<{ id: string }> }

// Rendering two documents is heavier than a normal route; give it room.
export const maxDuration = 60

const BodySchema = z.object({
  action: z.literal('generate'),
  force: z.boolean().default(false),
})

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  return NextResponse.json({ documents: [await readExportStatus(id)] })
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { user } = authz

  if (!checkRateLimit(`export:${user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Rate limit exceeded — up to 20 exports per hour.' }, { status: 429 })
  }

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  try {
    const status = await generateExport(id, { force: parsed.data.force })
    return NextResponse.json({ document: status })
  } catch (err) {
    // "There is nothing to export yet" is a 409 with the reason, not a 500 with a
    // shrug — the user is told which of the two it is (§19-C 1a).
    if (err instanceof ExportUnavailableError) {
      return NextResponse.json({ error: 'unavailable', message: err.message }, { status: 409 })
    }
    console.error('[export] POST failed', { ideaId: id, err })
    return NextResponse.json(
      { error: 'render_failed', message: 'The document could not be generated just now. Nothing has been changed.' },
      { status: 502 },
    )
  }
}
