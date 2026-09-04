// ─────────────────────────────────────────────────────────────────────────────
// SURFACE 3 §2 — FILE THE POSITION GRAPH'S FINDINGS INTO THE PROPOSAL.
//
//   POST { ideaId }  →  writes the POSITIONS rows, returns what it wrote
//
// ⚠ OWNER ONLY. This writes evidence into somebody's proposal. Every other
// position surface is read-only and signed-in; this one changes a document that
// leaves the building, so it is scoped to the person whose document it is.
//
// ⚠ AND IT IS A SEPARATE ROUTE RATHER THAN A STEP INSIDE THE BUILD, DELIBERATELY.
// The build pipeline is the Lex stream's, and SURFACE 3 §5 forbids editing it.
// Wiring this into `build.ts` is a ONE-LINE change and it is written out in
// `docs/SURFACE_3_REPORT.md` for that stream to take or refuse — the capability
// ships either way, and the report says exactly what the line is.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { filePositionsForIdea } from '@/lib/graph/position-block'

const Body = z.object({
  ideaId: z.string().min(1).max(64),
  /** Compute and return, writing nothing. */
  dryRun: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error

  const parsed = Body.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })
  }

  const idea = await prisma.idea.findFirst({
    where: { id: parsed.data.ideaId, deletedAt: null },
    select: { id: true, creatorId: true },
  })
  if (!idea) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (idea.creatorId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const filed = await filePositionsForIdea(idea.id, { dryRun: parsed.data.dryRun })

  // ⚠ THE COUNT IS RE-READ, not reported from the writer's own return value.
  const rows = parsed.data.dryRun ? null : await prisma.evidenceItem.count({
    where: { ideaId: idea.id, headingKey: 'POSITIONS', passKey: 'positions' },
  })

  return NextResponse.json({
    ideaId: idea.id,
    target: filed.target,
    positions: filed.positions.length,
    written: filed.written,
    replaced: filed.replaced,
    rowsOnFile: rows,
    // ⚠ NEVER AN EMPTY RESULT WITH NO REASON. When nothing was filed, the response says why, in
    // the words a user would be shown.
    reason: filed.reason,
  })
}
