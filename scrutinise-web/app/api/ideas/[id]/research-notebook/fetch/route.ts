// 26-R §2 — "fetch a readable view of the page", for the Add research form's select-the-quote step.
//
// Returns the page's readable text, title, and whatever author/date the page states — or a REFUSAL THAT SAYS WHY (parliament.uk and
// paywalls answer 403; YouTube is an app shell): the form then tells the user to paste the text instead. It never pretends a page
// was read. NOTHING IS STORED HERE — this is a preview; the text is stored only if the user saves a note against it.
//
// ⚠ A FETCHED PAGE IS DATA, NEVER INSTRUCTION: it is returned to the form as text to select from, and reaches Lex only fenced.
// ⚠ A WEB ADDRESS THE USER TYPES IS AN SSRF SURFACE. `extractUrl` accepts http/https only; this route additionally refuses
//   addresses that name a private host, so a note form cannot be pointed at the platform's own network.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { checkRateLimit } from '@/lib/rateLimit'
import { describeIssues } from '@/lib/api-rejection'
import { extractUrl, MaterialRejected } from '@/lib/lex/user-material'

export const maxDuration = 60
type Params = { params: Promise<{ id: string }> }
const Body = z.object({ url: z.string().trim().min(1).max(2000) })

const PRIVATE_HOST = /^(localhost|127\.|10\.|0\.0\.0\.0|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$|.*\.internal$|.*\.local$)/i

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  if (!checkRateLimit(`research-fetch:${authz.user.id}`, 40, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many pages fetched this hour — up to 40. Paste the text of the page instead.' }, { status: 429 })
  }
  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    const { message, rejected } = describeIssues(parsed.error.issues, { action: 'Fetching the page', labels: { url: 'the web address' } })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
  let host = ''
  try { host = new URL(parsed.data.url).hostname } catch { /* extractUrl words it */ }
  if (host && PRIVATE_HOST.test(host)) {
    return NextResponse.json({ ok: false, refused: true, kind: 'not-a-url', message: 'That address points inside a private network, so it was not fetched. Paste the text of the page instead.' })
  }
  try {
    const out = await extractUrl(parsed.data.url)
    return NextResponse.json({
      ok: true, refused: false, title: out.title, finalUrl: out.finalUrl, text: out.text, truncated: out.truncated,
      // The form shows these as editable fields; the page rarely states them, and a blank is honest.
      author: null, publishedAt: null,
    })
  } catch (err) {
    if (err instanceof MaterialRejected) {
      return NextResponse.json({ ok: false, refused: true, kind: (err as MaterialRejected).kind, message: `${err.message} The page was not read — paste its text into the box and select the quote there.` })
    }
    throw err
  }
}
