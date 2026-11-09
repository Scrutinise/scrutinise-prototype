// GET /api/ideas/[id]/deepening/overview — 26-X X3 §6a: the Deepening page's own sections (collision, the reviews over accepted drafts, the costs
// by heading and year). Read-only: spends nothing, writes nothing. The digest and the gap check keep their own routes.

import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { deepeningOverview } from '@/lib/lex/deepening-overview'

type Params = { params: Promise<{ id: string }> }

export const maxDuration = 60

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  try {
    return NextResponse.json(await deepeningOverview(id))
  } catch (e) {
    console.error('[deepening-overview] failed', { ideaId: id, error: e instanceof Error ? e.message : String(e) })
    return NextResponse.json({ error: `Reading the Deepening’s sections failed on the server (${e instanceof Error ? e.message.slice(0, 200) : 'unknown error'}). Nothing was changed.` }, { status: 500 })
  }
}
