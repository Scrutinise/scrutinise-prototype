import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimit'
import { authorizeIdea } from '@/lib/lex/authz'
import { computeCanonicalState } from '@/lib/lex/state'
import { fireSearchTrigger } from '@/lib/lex/field-machine'
import { runStageSearch, runAdHocResearch, displayStageFor, STAGE_INTENT } from '@/lib/lex/stage-search'

type Params = { params: Promise<{ id: string }> }

// POST /api/ideas/[id]/search — the ONE place a search is re-run on demand (§19-C).
//   { action: 'retry' }              → re-run the search for the current stage
//   { action: 'research', query }    → an ad-hoc corpus search the user asked for
//
// Retry exists because a failed search now stays failed and visible (Task 1a) rather
// than being papered over with a fixture; the user needs a way to ask again.
const BodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('retry') }),
  z.object({ action: z.literal('research'), query: z.string().trim().min(3).max(300) }),
])

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { user, idea } = authz

  // Searches are cheap for us but not free; the same ceiling as the AI routes.
  if (!checkRateLimit(`search:${user.id}`, 40, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Rate limit exceeded — try again shortly.' }, { status: 429 })
  }

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const body = parsed.data

  const current = await prisma.idea.findUnique({ where: { id }, select: { lexPage: true } })
  const page = current?.lexPage ?? 'ORIENTATION'

  let messages: string[] = []
  if (body.action === 'retry') {
    if (page === 'ORIENTATION' || STAGE_INTENT[page] === null) {
      // Orientation's search is the Initial Background; Coherent Actions reuses the
      // Diagnosis landscape, so a retry there re-runs that stage's search.
      if (page === 'ORIENTATION') {
        const out = await fireSearchTrigger(id)
        messages = out.ok
          ? [`I've run the background search again — ${out.results} reference${out.results === 1 ? '' : 's'} are in the panel.`]
          : ["The corpus search didn't complete that time either. I haven't put anything in the panel — we can try again, or press on and come back to it."]
      } else {
        const rec = await runStageSearch(id, displayStageFor(page))
        messages = rec?.ok
          ? [`I've run the search again — ${rec.results.length} reference${rec.results.length === 1 ? '' : 's'} are in the panel.`]
          : ["The corpus search didn't complete. Nothing has been added to the panel."]
      }
    } else {
      const rec = await runStageSearch(id, page)
      messages = rec?.ok
        ? [`I've run the search again — ${rec.results.length} reference${rec.results.length === 1 ? '' : 's'} are in the panel.`]
        : ["The corpus search didn't complete. Nothing has been added to the panel."]
    }
  } else {
    const rec = await runAdHocResearch(id, body.query)
    messages = rec.ok
      ? rec.results.length
        ? [`I've searched the corpus for "${rec.query}" — ${rec.results.length} reference${rec.results.length === 1 ? '' : 's'} are under "Your research" in the panel.`]
        : [`I searched the corpus for "${rec.query}" and found nothing usable. That's a gap in what we hold, not an answer about the law.`]
      : ["The corpus search didn't complete, so I've got nothing to show you. We can try again."]
  }

  // Echo the messages into the transcript so a reload keeps them.
  const ideaRow = await prisma.idea.findUnique({ where: { id }, select: { aiChatHistory: true } })
  type ChatMsg = { role: string; content: string; timestamp?: string; stage?: string }
  const updated: ChatMsg[] = [
    ...(Array.isArray(ideaRow?.aiChatHistory) ? (ideaRow!.aiChatHistory as ChatMsg[]) : []),
    ...messages.map((content) => ({ role: 'lex', content, timestamp: new Date().toISOString(), stage: page })),
  ].slice(-60)
  await prisma.idea.update({ where: { id }, data: { aiChatHistory: updated } })

  const state = await computeCanonicalState(id)
  console.log('[lex-diag] search route', { action: body.action, page, creator: idea.creatorId === user.id })
  return NextResponse.json({ state, messages })
}
