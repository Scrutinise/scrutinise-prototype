// A FILE THAT TRAVELS WITH A BUG REPORT (Charlie, 8 Oct 2026, item 4b).
//
// Called by the feedback dialog ONLY at the user's explicit Yes — the file sits in the browser until then, so nothing is stored
// before consent. The object goes in the private bucket under `_feedback/<ideaId>/<userId>/…`, and the report row holds the KEY
// (never a URL: a stored URL is a stored expiry — lib/r2.ts). The submit route accepts only keys under this user's own prefix.
//
// ⚠ A picture cannot be scrubbed of personal content the way text can. The dialog says so before the Yes, and the file is
// reachable only by signed URL (security rule 10).

import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { checkRateLimit } from '@/lib/rateLimit'
import { r2Put } from '@/lib/r2'
import { FEEDBACK_ATTACHMENT_MAX_BYTES, FEEDBACK_ATTACHMENT_TYPES, type FeedbackAttachment } from '@/lib/lex/feedback-types'

type Params = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { user, idea } = authz

  if (!checkRateLimit(`feedback-file:${user.id}`, 12, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many files this hour — up to 12 uploads per hour. Nothing was stored.' }, { status: 429 })
  }

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'The file arrived in a form the server could not read (it was not a file upload). Nothing was stored.' }, { status: 400 }) }
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'The upload had no file in the field “file”. Nothing was stored.' }, { status: 422 })
  if (file.size === 0) return NextResponse.json({ error: `“${file.name}” is empty, so it was not attached.` }, { status: 422 })
  if (file.size > FEEDBACK_ATTACHMENT_MAX_BYTES) {
    return NextResponse.json({ error: `“${file.name}” is ${(file.size / 1048576).toFixed(1)} MB; the limit is ${FEEDBACK_ATTACHMENT_MAX_BYTES / 1048576} MB. It was not attached.` }, { status: 413 })
  }
  const type = (file.type || '').toLowerCase()
  if (!(FEEDBACK_ATTACHMENT_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: `“${file.name}” is a ${type || 'file of unknown type'}; only images (png, jpeg, webp, gif), pdf, and plain text, csv or json can be attached. It was not attached.` }, { status: 415 })
  }

  const safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80) || 'file'
  const key = `_feedback/${idea.id}/${user.id}/${randomUUID()}-${safe}`
  await r2Put(key, Buffer.from(await file.arrayBuffer()), type)
  const meta: FeedbackAttachment = { key, name: file.name.slice(0, 200), contentType: type, bytes: file.size }
  return NextResponse.json({ attachment: meta })
}
