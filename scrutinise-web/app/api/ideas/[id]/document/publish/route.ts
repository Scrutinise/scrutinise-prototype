// ─────────────────────────────────────────────────────────────────────────────
// Sprint 20-D — publish, re-publish, and unpublish.
//
//   POST   { visibility, changeNote? }  → mint (or reuse) a version, PIN it, and
//                                          set the visibility.
//   DELETE                              → back to PRIVATE. The version and the
//                                          share token both survive.
//   PUT    { action: 'version' }        → mint a version WITHOUT publishing, so a
//                                          user can pin a point in the record
//                                          before a review without sharing it.
//
// ⚠ PUBLISHING IS THE OWNER'S ACT, not a collaborator's. `authorizeIdea` admits
// collaborators, which is right for reading and rendering and wrong for the
// decision to send something out of the building under the owner's name — so the
// owner check is made here, explicitly, on top of it.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rateLimit'
import { authorizeIdea } from '@/lib/lex/authz'
import {
  publishProposal,
  unpublishProposal,
  mintVersion,
  readPublicationState,
} from '@/lib/documents/proposal-version'
import { SnapshotUnavailableError } from '@/lib/documents/proposal-snapshot'

type Params = { params: Promise<{ id: string }> }

export const maxDuration = 60

const PublishSchema = z.object({
  visibility: z.enum(['LINK', 'COMMUNITY', 'PUBLIC']),
  changeNote: z.string().trim().max(500).optional().nullable(),
})

const VersionSchema = z.object({
  action: z.literal('version'),
  changeNote: z.string().trim().max(500).optional().nullable(),
})

function forbidden() {
  return NextResponse.json(
    { error: 'Forbidden', message: 'Only the owner of a proposal can publish it.' },
    { status: 403 },
  )
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { user, idea } = authz
  if (idea.creatorId !== user.id) return forbidden()

  if (!checkRateLimit(`proposal-publish:${user.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Rate limit exceeded — up to 30 publish actions per hour.' }, { status: 429 })
  }

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = PublishSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  try {
    const publication = await publishProposal(id, user.id, parsed.data.visibility, {
      userNote: parsed.data.changeNote ?? null,
    })
    return NextResponse.json({ publication })
  } catch (err) {
    if (err instanceof SnapshotUnavailableError) {
      return NextResponse.json({ error: 'unavailable', message: err.message }, { status: 409 })
    }
    console.error('[proposal-publish] POST failed', { ideaId: id, err })
    return NextResponse.json({ error: 'publish_failed' }, { status: 502 })
  }
}

export async function PUT(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { user, idea } = authz
  if (idea.creatorId !== user.id) return forbidden()

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = VersionSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  try {
    const result = await mintVersion(id, user.id, { userNote: parsed.data.changeNote ?? null })
    return NextResponse.json({
      version: result.version,
      // ⚠ Reported, not hidden. A user who presses "Save a version" twice is told
      // the proposal was unchanged rather than shown a phantom v4.
      created: result.created,
      publication: await readPublicationState(id),
    })
  } catch (err) {
    if (err instanceof SnapshotUnavailableError) {
      return NextResponse.json({ error: 'unavailable', message: err.message }, { status: 409 })
    }
    console.error('[proposal-publish] PUT failed', { ideaId: id, err })
    return NextResponse.json({ error: 'version_failed' }, { status: 502 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { user, idea } = authz
  if (idea.creatorId !== user.id) return forbidden()

  try {
    return NextResponse.json({ publication: await unpublishProposal(id) })
  } catch (err) {
    console.error('[proposal-publish] DELETE failed', { ideaId: id, err })
    return NextResponse.json({ error: 'unpublish_failed' }, { status: 502 })
  }
}
