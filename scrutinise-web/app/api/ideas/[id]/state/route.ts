import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { computeCanonicalState } from '@/lib/lex/state'

type Params = { params: Promise<{ id: string }> }

// GET /api/ideas/[id]/state — the single source of truth (§3.3).
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  const state = await computeCanonicalState(id)
  if (!state) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(state)
}
