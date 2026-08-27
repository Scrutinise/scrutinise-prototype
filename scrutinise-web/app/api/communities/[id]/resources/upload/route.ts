import { NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth'
import { requireLibraryAccess } from '@/lib/question-library'
import { r2Put } from '@/lib/r2'
import { MAX_RESOURCE_BYTES, checkUpload } from '@/lib/resources'

type Params = { params: Promise<{ id: string }> }

/** Strip anything that could climb out of the key prefix or confuse a header. */
function safeName(name: string): string {
  return (name.split(/[\/]/).pop() ?? 'file')
    .replace(/[^A-Za-z0-9._ -]/g, '_')
    .slice(0, 120)
}

// POST /api/communities/[id]/resources/upload  (multipart/form-data, field "file")
//
// ⚠ THE GATE IS HERE, BEFORE R2 SEES THE BYTES. Checking the type after storing
// would mean a rejected executable had already been written to the bucket and
// was reachable by key for as long as the cleanup took.
export async function POST(req: Request, { params }: Params) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const { id } = await params
  try {
    await requireLibraryAccess(user.id, id)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected a file upload' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was attached' }, { status: 422 })
  }
  // Refuse on the declared length before reading, so an oversized body is not
  // pulled into memory just to be rejected.
  if (file.size > MAX_RESOURCE_BYTES) {
    return NextResponse.json(
      { error: `That file is larger than the ${MAX_RESOURCE_BYTES / 1024 / 1024} MB limit.` },
      { status: 413 },
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const check = checkUpload(buffer, file.type, file.name)
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 422 })
  }

  const name = safeName(file.name)
  const key = `central/resources/${id}/${crypto.randomUUID()}-${name}`
  await r2Put(key, buffer, check.type)

  return NextResponse.json({
    file: { key, name, type: check.type, size: buffer.length },
  })
}
