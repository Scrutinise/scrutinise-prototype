// ─────────────────────────────────────────────────────────────────────────────
// Sprint 20-D — a recipient downloads the version that was shared.
//
// ⚠ THE VERSION NUMBER IS NOT A QUERY PARAMETER HERE. It comes from the resolver,
// which reads the pin. A recipient cannot ask for a different version of someone
// else's proposal by changing a number in a URL, and the owner's later edits
// cannot change what this link hands over.
//
// The file is rendered from the STORED snapshot on first request and reused
// afterwards, so it can never drift from the version it claims to be.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimit'
import { resolveSharedProposal } from '@/lib/documents/proposal-version'
import {
  ensureVersionExport,
  proposalFilename,
  isProposalKind,
  type ExportFormat,
} from '@/lib/documents/proposal-export'
import { r2SignedUrl } from '@/lib/r2'

type Params = { params: Promise<{ token: string }> }

export const maxDuration = 60

async function readerId(): Promise<string | null> {
  try {
    const { userId: clerkUserId } = await auth()
    if (!clerkUserId) return null
    const user = await prisma.user.findUnique({ where: { clerkId: clerkUserId }, select: { id: true } })
    return user?.id ?? null
  } catch {
    return null
  }
}

export async function GET(req: Request, { params }: Params) {
  const { token } = await params
  const url = new URL(req.url)
  const kind = url.searchParams.get('kind') ?? 'PROPOSAL'
  const format = url.searchParams.get('format') ?? 'pdf'

  if (!isProposalKind(kind)) {
    return NextResponse.json({ error: 'kind must be PROPOSAL or PROPOSAL_SUMMARY' }, { status: 422 })
  }
  if (format !== 'docx' && format !== 'pdf') {
    return NextResponse.json({ error: 'format must be docx or pdf' }, { status: 422 })
  }

  // This route can render on a cache miss, so it is rate limited by IP — an
  // unauthenticated caller must not be able to drive rendering by looping.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (!checkRateLimit(`proposal-share-download:${ip}`, 60, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 })
  }

  const outcome = await resolveSharedProposal(token, await readerId())
  if (!outcome.ok) {
    const status = outcome.reason === 'sign_in_required' ? 401 : outcome.reason === 'not_in_community' ? 403 : 404
    return NextResponse.json({ error: outcome.reason }, { status })
  }

  const { proposal } = outcome
  try {
    const keys = await ensureVersionExport(proposal.ideaId, proposal.versionNumber, kind, {
      onlineViewUrl: `${url.origin}/proposals/${token}`,
    })
    const filename = proposalFilename(proposal.title, kind, format as ExportFormat, proposal.versionNumber)
    const key = format === 'docx' ? keys.docxKey : keys.pdfKey
    return NextResponse.redirect(await r2SignedUrl(key, { downloadAs: filename }), 302)
  } catch (err) {
    console.error('[proposal-share-download] failed', { token: token.slice(0, 6), kind, err })
    return NextResponse.json(
      { error: 'render_failed', message: 'That document could not be prepared just now.' },
      { status: 502 },
    )
  }
}
