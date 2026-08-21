// SPRINT 25-D §4 / §25.6 — the user's own documents and links.
//
// GET    → what they have attached, and what each one produced.
// POST   → add one. `multipart/form-data` for a file, JSON `{ url }` for a link.
// DELETE → remove one, and every finding it produced.
//
// ⚠ THE TEXT IS NEVER RETURNED BY GET. The panel needs the label, the link and the counts;
// nothing in the UI renders the document body, and shipping it to the client on every poll
// would put a fifty-page report on the wire repeatedly for no reader. Handing back only
// what a caller uses is also what keeps "the text lives in one place" true.
//
// ⚠ AND THE FINDINGS PASS RUNS INLINE, BEFORE THE RESPONSE. It is one model call on an
// upload the user is waiting for anyway, and doing it in the background would need a job
// runner and would let a user watch a document sit at PENDING with nothing to tell them
// whether it worked. The failure path keeps the document and names the failure.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorizeIdea } from '@/lib/lex/authz'
import {
  extractFile, extractUrl, runMaterialFindings, MaterialRejected,
  MAX_MATERIALS_PER_IDEA, MAX_UPLOAD_BYTES,
} from '@/lib/lex/user-material'
import { USER_MATERIAL_PASS_PREFIX } from '@/lib/lex/heading-map'

type Params = { params: Promise<{ id: string }> }

/** ⚠ `text` is deliberately absent from every select in this file. See the header. */
const LIST_SELECT = {
  id: true, kind: true, status: true, label: true, filename: true, mimeType: true,
  url: true, charCount: true, sourceBytes: true, failureReason: true,
  findingsAt: true, findingCount: true, rightsConfirmed: true, createdAt: true,
} as const

async function listMaterial(ideaId: string) {
  const rows = await prisma.ideaUserMaterial.findMany({
    where: { ideaId }, orderBy: { createdAt: 'desc' }, select: LIST_SELECT,
  })
  return {
    material: rows.map((r) => ({
      ...r,
      findingsAt: r.findingsAt ? r.findingsAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    })),
    limit: MAX_MATERIALS_PER_IDEA,
    maxBytes: MAX_UPLOAD_BYTES,
    remaining: Math.max(0, MAX_MATERIALS_PER_IDEA - rows.length),
  }
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  return NextResponse.json(await listMaterial(id))
}

const LinkSchema = z.object({
  url: z.string().min(4).max(2000),
  label: z.string().max(300).optional(),
  /** §25.6 liability — the user asserts they may share it. */
  rightsConfirmed: z.boolean().optional(),
})

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  // ⚠ THE CAP IS CHECKED BEFORE ANYTHING IS FETCHED OR PARSED. Checking after would mean a
  // 10MB upload is read, extracted and then refused — work done on a request we always knew
  // we would reject.
  const count = await prisma.ideaUserMaterial.count({ where: { ideaId: id } })
  if (count >= MAX_MATERIALS_PER_IDEA) {
    return NextResponse.json({
      error: `This idea already has ${count} documents attached, which is the limit. `
        + 'Remove one you no longer need and add this instead.',
    }, { status: 422 })
  }

  const contentType = req.headers.get('content-type') ?? ''

  try {
    if (contentType.startsWith('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file was attached.' }, { status: 422 })
      }
      const bytes = Buffer.from(await file.arrayBuffer())
      const extracted = await extractFile(bytes, file.type, file.name)
      const label = String(form.get('label') ?? '').trim() || extracted.title || file.name

      const created = await prisma.ideaUserMaterial.create({
        data: {
          ideaId: id,
          kind: 'FILE',
          status: 'READY',
          label: label.slice(0, 300),
          filename: file.name.slice(0, 300),
          mimeType: file.type || null,
          // ⚠ NO BINARY IS WRITTEN ANYWHERE. Only `text` and the size of what it came from.
          text: extracted.text,
          charCount: extracted.text.length,
          sourceBytes: bytes.byteLength,
          rightsConfirmed: String(form.get('rightsConfirmed') ?? '') === 'true',
          addedBy: authz.user.id,
        },
        select: { id: true },
      })
      return finish(id, created.id, extracted.truncated)
    }

    const parsed = LinkSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })
    }
    const extracted = await extractUrl(parsed.data.url)
    const created = await prisma.ideaUserMaterial.create({
      data: {
        ideaId: id,
        kind: 'LINK',
        status: 'READY',
        label: (parsed.data.label?.trim() || extracted.title || extracted.finalUrl).slice(0, 300),
        // ⚠ THE LINK IS RETAINED (§25.6). A quotation whose source cannot be reopened is not
        // evidence — and this is the RESOLVED url, so a redirect chain does not leave the
        // user with an address that no longer reaches what we read.
        url: extracted.finalUrl,
        text: extracted.text,
        charCount: extracted.text.length,
        sourceBytes: extracted.text.length,
        rightsConfirmed: parsed.data.rightsConfirmed === true,
        addedBy: authz.user.id,
      },
      select: { id: true },
    })
    return finish(id, created.id, extracted.truncated)
  } catch (err) {
    if (err instanceof MaterialRejected) {
      // A refusal the user can act on, in their own terms — never a 500 with a stack.
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    console.error('[material] add FAILED', { ideaId: id, error: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: 'That could not be added. Nothing was stored.' }, { status: 500 })
  }
}

/** Read the document into findings, then return the refreshed list with what happened. */
async function finish(ideaId: string, materialId: string, truncated: boolean) {
  let note: string | null = null
  let written = 0
  try {
    const out = await runMaterialFindings(materialId)
    note = out.note
    written = out.written
  } catch (err) {
    // ⚠ THE DOCUMENT SURVIVES A FAILED READ. Losing the user's own material because one
    // model call failed is the worst available outcome; the pass can be run again.
    console.error('[material] findings pass THREW', { materialId, error: err instanceof Error ? err.message : err })
    note = 'The document is stored, but reading it into findings failed. It can be read again.'
  }
  return NextResponse.json({
    ...(await listMaterial(ideaId)),
    added: materialId,
    findingsWritten: written,
    // ⚠ Truncation is SURFACED. A silently shortened document is one whose last pages the
    // user believes were read.
    truncated,
    note,
  })
}

export async function DELETE(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  const materialId = new URL(req.url).searchParams.get('materialId')?.trim()
  if (!materialId) return NextResponse.json({ error: 'materialId is required.' }, { status: 422 })

  const row = await prisma.ideaUserMaterial.findFirst({
    where: { id: materialId, ideaId: id }, select: { id: true },
  })
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ⚠ THE FINDINGS GO WITH IT. A finding quoting a document the user has withdrawn is a
  // quotation with no source — and if the reason for withdrawal was that they should never
  // have shared it, leaving the quotes behind defeats the withdrawal entirely.
  await prisma.$transaction([
    prisma.evidenceItem.deleteMany({
      where: { ideaId: id, passKey: `${USER_MATERIAL_PASS_PREFIX}${materialId}` },
    }),
    prisma.ideaUserMaterial.delete({ where: { id: materialId } }),
  ])

  return NextResponse.json(await listMaterial(id))
}
