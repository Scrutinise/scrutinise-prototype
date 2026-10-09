// 26-R §2 — a file's readable text, for the Add research form's select-the-quote step. A PREVIEW: nothing is stored here.
// The file is stored (as text only — no binary is kept anywhere) when the user saves a note against it. Refusals say why.

import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { checkRateLimit } from '@/lib/rateLimit'
import { extractFile, MaterialRejected, MAX_UPLOAD_BYTES } from '@/lib/lex/user-material'

export const maxDuration = 60
type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  if (!checkRateLimit(`research-extract:${authz.user.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many files this hour — up to 30. Paste the text instead.' }, { status: 429 })
  }
  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'The file arrived in a form the server could not read (it was not a file upload). Nothing was stored.' }, { status: 400 }) }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'The upload had no file in the field “file”. Nothing was stored.' }, { status: 422 })
  if (file.size === 0) return NextResponse.json({ error: `“${file.name}” is empty, so there is nothing to read.` }, { status: 422 })
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: `“${file.name}” is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${(MAX_UPLOAD_BYTES / 1048576).toFixed(0)} MB. Nothing was stored.` }, { status: 413 })
  try {
    const out = await extractFile(Buffer.from(await file.arrayBuffer()), file.type, file.name)
    return NextResponse.json({ ok: true, title: out.title ?? file.name, text: out.text, truncated: out.truncated, filename: file.name })
  } catch (err) {
    if (err instanceof MaterialRejected) return NextResponse.json({ ok: false, refused: true, kind: (err as MaterialRejected).kind, message: `${err.message} The file was not read — paste its text instead.` })
    throw err
  }
}
