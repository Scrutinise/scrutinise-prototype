// 26-T1 §3b — accepting a spelling merge on the "By who" view. The map itself is read from the actions on screen (it stores nothing, decision 203);
// this is the one write it can cause, and it goes through the same Who writer as the screen. Owner or collaborator (authorizeIdea).
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { describeIssues } from '@/lib/api-rejection'
import { mergeImplementerSpellings } from '@/lib/lex/incentive-map-server'

type Params = { params: Promise<{ id: string }> }

const Body = z.object({
  op: z.literal('mergeSpellings'),
  fromKeys: z.array(z.string().min(1).max(200)).min(1).max(10),
  to: z.string().min(1).max(200),
})
const WORDS: Record<string, string> = { op: 'the control', fromKeys: 'the spellings to change', to: 'the spelling to use' }

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'That control sent something the server could not read at all (the body was not JSON). Nothing was changed.' }, { status: 400 }) }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    const { message, rejected } = describeIssues(parsed.error.issues, { action: '“Use this spelling”', labels: WORDS })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
  const r = await mergeImplementerSpellings(id, parsed.data.fromKeys, parsed.data.to)
  return r.ok ? NextResponse.json({ ok: true, result: r.data, error: null }) : NextResponse.json({ ok: false, result: null, error: (r as { error: string }).error }, { status: 422 })
}
