// ─────────────────────────────────────────────────────────────────────────────
// Sprint 20-B — download one proposal document. Authorised here, then redirected
// to a fresh 24h signed R2 URL (security rule 10: private objects are reached no
// other way).
//
// `?version=N` serves the immutable render of a stored version. Without it the
// WORKING draft is served, and a stale working draft is refused with its reason
// rather than handed over silently; `?allowStale=1` exists so the UI can offer
// "take the older one anyway" as a deliberate, visible choice.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import {
  signedProposalDownload,
  proposalFilename,
  isProposalKind,
  type ExportFormat,
} from '@/lib/documents/proposal-export'
import { SnapshotUnavailableError } from '@/lib/documents/proposal-snapshot'

type Params = { params: Promise<{ id: string }> }

export const maxDuration = 60

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { idea } = authz

  const url = new URL(req.url)
  const kind = url.searchParams.get('kind') ?? 'PROPOSAL'
  const format = url.searchParams.get('format')
  if (!isProposalKind(kind)) {
    return NextResponse.json({ error: 'kind must be PROPOSAL or PROPOSAL_SUMMARY' }, { status: 422 })
  }
  if (format !== 'docx' && format !== 'pdf') {
    return NextResponse.json({ error: 'format must be docx or pdf' }, { status: 422 })
  }

  const versionRaw = url.searchParams.get('version')
  let versionNumber: number | null = null
  if (versionRaw !== null) {
    const n = Number(versionRaw)
    if (!Number.isInteger(n) || n < 1) {
      return NextResponse.json({ error: 'version must be a positive integer' }, { status: 422 })
    }
    versionNumber = n
  }
  const allowStale = url.searchParams.get('allowStale') === '1'

  const filename = proposalFilename(idea.title, kind, format as ExportFormat, versionNumber)

  try {
    const result = await signedProposalDownload(id, kind, format as ExportFormat, filename, versionNumber)
    if (!result) {
      return NextResponse.json(
        { error: 'not_generated', message: 'That document has not been generated yet.' },
        { status: 404 },
      )
    }
    if (result.stale && !allowStale) {
      return NextResponse.json(
        {
          error: 'stale',
          message: 'The proposal has changed since this file was made, so it is out of date. Regenerate it, or ask for it again with allowStale=1 to take the older version knowingly.',
        },
        { status: 409 },
      )
    }
    return NextResponse.redirect(result.url, 302)
  } catch (err) {
    if (err instanceof SnapshotUnavailableError) {
      return NextResponse.json({ error: 'unavailable', message: err.message }, { status: 409 })
    }
    console.error('[proposal-download] failed', { ideaId: id, kind, err })
    return NextResponse.json({ error: 'download_failed' }, { status: 502 })
  }
}
