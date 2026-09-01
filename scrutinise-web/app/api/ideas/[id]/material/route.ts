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
// 25-L §2 — every refusal is counted, with its type. See `material-rejection.ts`.
import { logRejection, readRejections } from '@/lib/lex/material-rejection'
import { MAX_TEXT_CHARS } from '@/lib/lex/user-material'

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
    // ⚠ 25-L §2 — WHAT WE COULD NOT READ TRAVELS WITH WHAT WE COULD. §2: "never silently
    // drop it, always say why at the time, always record it." A refusal that only ever
    // existed as a toast is a gap the user cannot see five minutes later, and a document
    // list that shows nine of the ten things they gave us is a list that lies by omission.
    rejected: await readRejections(ideaId),
  }
}

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  // ══ 25-N §1f — THE USER MAY OPEN WHAT THEY GAVE US ═══════════════════════════
  //
  // ⚠⚠ AND WHAT THEY GET BACK IS THE TEXT, NOT THE FILE, BECAUSE THE FILE DOES NOT EXIST.
  // §25.6 stores extracted text and no binary, deliberately — "the file itself is never
  // stored" is printed on the upload control. So "let the user open what they uploaded"
  // cannot mean handing back a PDF, and pretending otherwise would be a promise the schema
  // cannot keep. It means: show them exactly what we read, which is the thing that actually
  // determines what Lex concluded. The viewer says which it is, in those words.
  //
  // ⚠ ONE ROW AT A TIME, ASKED FOR BY ID. The header's rule stands — `text` stays out of the
  // list select, so a fifty-page report is not on the wire on every poll. It travels only
  // when somebody has pressed "Open".
  const materialId = new URL(req.url).searchParams.get('materialId')
  if (materialId) {
    const row = await prisma.ideaUserMaterial.findFirst({
      // ⚠ SCOPED TO THE IDEA, not looked up by id alone. `authorizeIdea` proved access to
      // THIS idea; a bare id lookup would serve any material row to anyone who owns any idea.
      where: { id: materialId, ideaId: id },
      select: {
        id: true, kind: true, label: true, filename: true, mimeType: true, url: true,
        text: true, charCount: true, status: true, failureReason: true,
        findingsAt: true, findingCount: true, createdAt: true,
        // 25-Q §5 — the size of what was handed in, so "kept" can be stated against something.
        sourceBytes: true,
      },
    })
    if (!row) return NextResponse.json({ error: 'That is not on this idea.' }, { status: 404 })
    return NextResponse.json({
      ...row,
      findingsAt: row.findingsAt ? row.findingsAt.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      // ══ 25-Q §5 — "CHARACTERS KEPT" MEANS NOTHING UNTIL SOMETHING SAYS WHAT WAS DROPPED ══
      //
      // §5: *"Do not guess the intended meaning: read what produces the numbers and report it,
      // then write the label to match."* `charCount` is `extracted.text.length`, and
      // `extracted` has been through `cap()`, which slices at `MAX_TEXT_CHARS` and nowhere
      // else. So the number is the length of what we hold, and it is short of the document
      // only when the cap fired.
      //
      // ⚠⚠ THE FLAG IS COMPUTED HERE, NOT IN THE COMPONENT, because the cap is a server
      // constant read from the environment (`LEX_MATERIAL_MAX_CHARS`). A client that compared
      // against its own copy of 200,000 would be right until somebody set that variable — the
      // "import the predicate, never restate it" rule, in its cheapest form.
      truncated: row.charCount >= MAX_TEXT_CHARS,
      capChars: MAX_TEXT_CHARS,
    })
  }

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
    const detail = `This idea already has ${count} documents attached, which is the limit. `
      + 'Remove one you no longer need and add this instead.'
    // ⚠ THE CAP IS A REJECTION TOO. It is the one kind we already knew the rate of and
    // still never recorded, and a run of these is the evidence for raising the cap.
    await logRejection({ ideaId: id, userId: authz.user.id, kind: 'too-many', target: '(cap)', detail })
    return NextResponse.json({ error: detail }, { status: 422 })
  }

  const contentType = req.headers.get('content-type') ?? ''
  // ⚠ WHAT WAS BEING ADDED, RECORDED AS WE GO. The rejection is thrown from inside the
  // extractor, which does not know whether it is looking at a file or a link — so the
  // handler remembers, and the log records the URL or the filename rather than "(unknown)".
  // A rejection log whose targets are all "(unknown)" cannot be broken down by host, which
  // is the one breakdown that decides whether transcript-fetching is worth building.
  let pendingTarget = '(unknown)'

  try {
    if (contentType.startsWith('multipart/form-data')) {
      const form = await req.formData()
      const file = form.get('file')
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'No file was attached.' }, { status: 422 })
      }
      pendingTarget = file.name || file.type || '(unnamed file)'
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
    pendingTarget = parsed.data.url
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
      // ⚠ LOGGED BEFORE IT IS ANSWERED, and `logRejection` cannot throw — a logging failure
      // must never turn a clean refusal into a 500, which would tell the user something is
      // broken when in fact we simply cannot read videos.
      await logRejection({
        ideaId: id, userId: authz.user.id, kind: err.kind,
        target: rejectionTarget(contentType, pendingTarget),
        detail: err.message,
      })
      // A refusal the user can act on, in their own terms — never a 500 with a stack.
      // ⚠ THE KIND TRAVELS TO THE CLIENT so the panel can style a "you can fix this" refusal
      // apart from a dead end, rather than inferring it from the wording.
      return NextResponse.json({ error: err.message, kind: err.kind }, { status: 422 })
    }
    console.error('[material] add FAILED', { ideaId: id, error: err instanceof Error ? err.message : err })
    return NextResponse.json({ error: 'That could not be added. Nothing was stored.' }, { status: 500 })
  }
}

/**
 * What to record as the thing we refused.
 *
 * ⚠ A LINK IS RECORDED IN FULL, A FILE BY NAME ONLY. The host is the whole point of the
 * log for links — "eleven YouTube links" is the finding — and a filename is all we have for
 * an upload, whose bytes were never stored and never will be.
 */
function rejectionTarget(contentType: string, pending: string): string {
  return contentType.startsWith('multipart/form-data') ? `file: ${pending}` : pending
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
