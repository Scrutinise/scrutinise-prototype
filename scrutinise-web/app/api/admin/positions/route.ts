import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthenticatedUser } from '@/lib/auth'
import { positionsFor, findTargets, parseTarget } from '@/lib/graph/positions'
import { POSITION_CONFIG, configVersion } from '@/lib/graph/position-config'
import { getPositionCoverage, describePositionCoverage } from '@/lib/graph/position-coverage'

// GET /api/admin/positions — Admin+. GRAPH 3A §6.
//
// Two modes, one route:
//   ?find=<text>            → candidate targets (divisions and EDMs whose titles match)
//   ?targets=a,b,c[&…]      → the ranked actors with a recorded position on those targets
//
// ⚠ NOT a user-facing surface, and the gate is deliberate rather than incidental. Design §8:
// until the hand-labelled validation set has scored the estimates, they appear only inside the
// deepening's political-risk output and on an admin page. The `app/admin/layout.tsx` Clerk + role
// gate covers the page; this route re-checks independently, because one gate covering two paths
// is a gate that silently stops covering one of them.

const Query = z.object({
  find: z.string().trim().min(3).max(200).optional(),
  targets: z.string().trim().min(3).max(4000).optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  actorKind: z.enum(['person', 'organisation']).optional(),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function GET(req: NextRequest) {
  const { error, user } = await getAuthenticatedUser()
  if (error) return error
  if (!['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = Query.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Bad query', detail: parsed.error.flatten() }, { status: 400 })
  }
  const q = parsed.data

  try {
    if (q.find) {
      return NextResponse.json({ mode: 'find', targets: await findTargets(q.find, 25) })
    }

    if (!q.targets) {
      return NextResponse.json({ error: 'Pass ?find= or ?targets=' }, { status: 400 })
    }

    const wanted = q.targets.split(',').map((s) => s.trim()).filter(Boolean)
    const targets = wanted.map(parseTarget).filter((t): t is NonNullable<typeof t> => t !== null)
    const unparseable = wanted.length - targets.length
    if (!targets.length) {
      return NextResponse.json({ error: 'No target parsed. Use type:id, e.g. division:commons:2071' }, { status: 400 })
    }

    const result = await positionsFor(targets, {
      minConfidence: q.minConfidence,
      limit: q.limit ?? 40,
      actorKind: q.actorKind,
      asOf: q.asOf,
    })

    // ══ SURFACE 3 §1 — THE COVERAGE STATEMENT, ON THE ADMIN SURFACE TOO ══════════════════════
    //
    // ⚠ THE SAME OBJECT THE USER SURFACE AND THE DOCUMENT USE, rendered as the full block rather
    // than as sentences. Charlie eyeballs this page against his own political knowledge, and a
    // ranked list of members with no statement of what the graph could not see is exactly the
    // artefact that makes a short answer look like a complete one.
    const used: Record<string, { n: number }> = {}
    for (const a of result.actors) {
      for (const [k, v] of Object.entries(a.signalCounts)) used[k] = { n: (used[k]?.n ?? 0) + v.n }
    }

    return NextResponse.json({
      mode: 'positions',
      ...result,
      unparseableTargets: unparseable,
      coverage: describePositionCoverage(await getPositionCoverage({ used })),
      // Shown on the page rather than kept in a log: an estimate whose weights nobody can see is
      // an estimate nobody can argue with, and the whole product claim is that we show our working.
      config: {
        version: configVersion(),
        weights: POSITION_CONFIG.weights,
        halfLifeYears: POSITION_CONFIG.halfLifeYears,
        cohesionThreshold: POSITION_CONFIG.cohesionThreshold,
        attentionConfidenceCeiling: POSITION_CONFIG.attentionConfidenceCeiling,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'Position lookup failed', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    )
  }
}
