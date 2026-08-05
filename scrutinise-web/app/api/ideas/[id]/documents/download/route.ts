// ─────────────────────────────────────────────────────────────────────────────
// §8.2 — download one format. Authorised here, then redirected to a fresh 24h
// signed R2 URL (security rule 10: private objects are reached no other way).
//
// A stale file is NOT served silently. By default the request is refused with the
// reason and the caller is expected to regenerate; `?allowStale=1` exists so the
// UI can offer "download the old one anyway" as a deliberate, visible choice.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorizeIdea } from '@/lib/lex/authz'
import { signedDownload, exportFilename, type ExportFormat } from '@/lib/documents/export'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { idea } = authz

  const url = new URL(req.url)
  const format = url.searchParams.get('format')
  if (format !== 'docx' && format !== 'pdf') {
    return NextResponse.json({ error: 'format must be docx or pdf' }, { status: 422 })
  }
  const allowStale = url.searchParams.get('allowStale') === '1'

  const filename = exportFilename(idea.title, format as ExportFormat)
  const result = await signedDownload(id, format as ExportFormat, filename)
  if (!result) {
    return NextResponse.json(
      { error: 'not_generated', message: 'That file has not been generated yet.' },
      { status: 404 },
    )
  }

  if (result.stale && !allowStale) {
    const doc = await prisma.document.findUnique({
      where: { ideaId_kind: { ideaId: id, kind: 'INITIAL_BACKGROUND' } },
      select: { generatedAt: true, sourceLabel: true },
    })
    return NextResponse.json(
      {
        error: 'stale',
        message: 'The briefing has changed since this file was made, so it is out of date. Regenerate it, or ask for it again with allowStale=1 to take the older version knowingly.',
        generatedAt: doc?.generatedAt?.toISOString() ?? null,
        sourceLabel: doc?.sourceLabel ?? null,
      },
      { status: 409 },
    )
  }

  return NextResponse.redirect(result.url, 302)
}
