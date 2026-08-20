// ─────────────────────────────────────────────────────────────────────────────
// Sprint 20-B/D — the idea's proposal documents.
//
//   GET  → export status for both kinds, the publication state, and the version
//          list. One read, because the publish page needs all three together and
//          three round trips would let them disagree on screen.
//   POST → generate (or regenerate) one kind from the WORKING state.
//
// Authorisation is `authorizeIdea` — owner or collaborator. ⚠ It does not know
// communities exist, and that is §20.7's boundary holding structurally: community
// membership reaches a PUBLISHED VERSION through `/api/proposals/[token]` and can
// reach the working proposal by no path at all.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rateLimit'
import { authorizeIdea } from '@/lib/lex/authz'
import {
  readProposalExportStatus,
  generateProposalExport,
  PROPOSAL_KINDS,
} from '@/lib/documents/proposal-export'
import { readPublicationState, listVersions } from '@/lib/documents/proposal-version'
import { SnapshotUnavailableError } from '@/lib/documents/proposal-snapshot'

type Params = { params: Promise<{ id: string }> }

// Rendering two documents in two formats is heavier than a normal route.
export const maxDuration = 60

const BodySchema = z.object({
  action: z.literal('generate'),
  kind: z.enum(PROPOSAL_KINDS),
  force: z.boolean().default(false),
})

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  try {
    const [documents, publication, versions] = await Promise.all([
      readProposalExportStatus(id),
      readPublicationState(id),
      listVersions(id),
    ])
    return NextResponse.json({ documents, publication, versions })
  } catch (err) {
    if (err instanceof SnapshotUnavailableError) {
      return NextResponse.json({ error: 'unavailable', message: err.message }, { status: 409 })
    }
    console.error('[proposal-document] GET failed', { ideaId: id, err })
    return NextResponse.json({ error: 'read_failed' }, { status: 502 })
  }
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { user } = authz

  if (!checkRateLimit(`proposal-export:${user.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Rate limit exceeded — up to 20 renders per hour.' }, { status: 429 })
  }

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  try {
    const status = await generateProposalExport(id, parsed.data.kind, { force: parsed.data.force })
    return NextResponse.json({ document: status })
  } catch (err) {
    // "There is nothing to render yet" is a 409 with the reason, not a 500 with a
    // shrug — the user is told which of the two it is (§19-C 1a).
    if (err instanceof SnapshotUnavailableError) {
      return NextResponse.json({ error: 'unavailable', message: err.message }, { status: 409 })
    }
    console.error('[proposal-document] POST failed', { ideaId: id, err })
    return NextResponse.json(
      { error: 'render_failed', message: 'The document could not be generated just now. Nothing has been changed.' },
      { status: 502 },
    )
  }
}
