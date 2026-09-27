// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-K §3 — "research an angle": the user types a question instead of researching
// elsewhere and uploading the result. Runs a focused corpus round on that angle only and
// returns the same proposed-changes shape §2's material comparison does.
//
// ⚠ NOT the same as §3's full spec. §3 asks for "corpus plus the four-model check" — the
// four-model check is Search's own in-flight S26 Stage 3 (confirmed via docs/SPRINT.md;
// docs/HANDOVER_RESEARCH_SEQUENCE.md does not exist yet). Building a stand-in now would use
// different models and a different output schema than S26's, which is real, avoidable
// rework — so this ships the corpus half only, and reports the gap rather than guessing at
// a four-model mechanism that would likely be thrown away. See the CHANGE_LOG entry.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { runUpdatePass } from '@/lib/lex/update-pass'

export const maxDuration = 120

type Params = { params: Promise<{ id: string }> }

const BodySchema = z.object({ angle: z.string().trim().min(3).max(300) })

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { user } = authz

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })

  const result = await runUpdatePass(id, user?.id ?? null, { angle: parsed.data.angle })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
  return NextResponse.json(result)
}
