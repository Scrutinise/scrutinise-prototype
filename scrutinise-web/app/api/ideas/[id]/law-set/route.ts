// LEX 26-V1 §6 (decision 244) — the GRAPH 7 law set for the Deepening page's law table (the Overview reads it on the server).
// Owner or collaborator. ⚠ A failed read is said as a failure, never returned as an empty set.

import { NextResponse } from 'next/server'
import { authorizeIdea } from '@/lib/lex/authz'
import { ideaLawSet } from '@/lib/lex/statutory-graph'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  try { return NextResponse.json({ set: await ideaLawSet(id), error: null }) }
  catch (e) { return NextResponse.json({ set: null, error: e instanceof Error ? e.message : String(e) }) }
}
