import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { canManageCommunity, getRootCommunityId } from '@/lib/community'
import {
  ImportFormatError,
  MAX_UPLOAD_BYTES,
  applyImport,
  parseUpload,
  planImport,
} from '@/lib/question-import'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/communities/[id]/questions/bulk?mode=preview|apply
 *
 * COMMUNITY ADMINS ONLY at v1 — manage rights over the ROOT, not over the
 * branch the uploader happens to be standing in. A bulk vector should stay
 * reviewable, and a branch admin uploading 200 questions into the whole
 * Community's library is not that.
 *
 * Two steps, and the second re-parses the file rather than trusting a plan
 * posted back by the browser. `mode=preview` writes nothing.
 */
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  const rootId = await getRootCommunityId(id)
  if (!(await canManageCommunity(user.id, rootId))) {
    return NextResponse.json(
      { error: 'Bulk upload is for Community admins. Ask one of yours, or add questions one at a time.' },
      { status: 403 },
    )
  }

  const mode = new URL(req.url).searchParams.get('mode') === 'apply' ? 'apply' : 'preview'

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Send the file as multipart/form-data.' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file. Choose a .xlsx or .csv file to upload.' }, { status: 422 })
  }
  if (file.size === 0) {
    return NextResponse.json({ error: 'That file is empty.' }, { status: 422 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.` },
      { status: 413 },
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // Readability is settled FIRST and on its own. A blanket try/catch around the
  // plan would report a database fault as “that is not a spreadsheet” — a
  // message that is wrong, reassuring, and would send the admin to fix a file
  // that was never the problem.
  try {
    parseUpload(buffer)
  } catch (e) {
    if (e instanceof ImportFormatError) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    return NextResponse.json(
      { error: 'That file could not be read as a spreadsheet. Save it as .xlsx or .csv and try again.' },
      { status: 422 },
    )
  }

  try {
    if (mode === 'preview') {
      return NextResponse.json({ mode, plan: await planImport(id, buffer) })
    }
    const result = await applyImport({
      communityId: id,
      standingOnId: id,
      uploaderId: user.id,
      buffer,
    })
    return NextResponse.json({ mode, ...result }, { status: 201 })
  } catch (e) {
    // Only the importer's own refusals are turned into a message. Anything else
    // is a real fault and is allowed to surface as one.
    if (e instanceof ImportFormatError) {
      return NextResponse.json({ error: e.message }, { status: 422 })
    }
    throw e
  }
}
