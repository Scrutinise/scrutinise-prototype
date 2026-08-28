// SPRINT 25-D §2a / §20.2.1 — what the user decided about a corpus source.
//
// GET   → every decision on record.
// PATCH → include, exclude (with a reason) or annotate one source.
//
// ⚠ AN EXCLUSION WITHOUT A REASON IS REFUSED WITH A 422, not stored with a null. The
// Evidence Pack prints what was considered and set aside, and the annex's whole value is
// that every line in it can be answered. `decideSource` throws; this is where that becomes
// a sentence the user reads.
//
// ⚠ AND NOTHING IS DELETED, EVER. There is no DELETE verb on this route on purpose:
// "excluded, never deleted" is the rule (§20.2.1), and a route that could remove the record
// of a decision would be the way it eventually got broken.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { decideSource, readSourceDecisions, MissingExclusionReason } from '@/lib/lex/sources'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  return NextResponse.json({ decisions: await readSourceDecisions(id) })
}

const PatchSchema = z.object({
  sourceKey: z.string().min(1).max(300),
  /**
   * ⚠ 25-L §3d — THREE STATES, ONE FACT.
   *   `PRIORITY` → goes in the proposal document
   *   `INCLUDED` → goes in the evidence annex
   *   `EXCLUDED` → goes in the considered-and-set-aside list, with its reason
   * A separate "is priority" boolean would have allowed the meaningless fourth state
   * (excluded AND priority) to exist in the data.
   */
  status: z.enum(['INCLUDED', 'EXCLUDED', 'PRIORITY']),
  reason: z.string().max(2000).nullish(),
  annotation: z.string().max(2000).nullish(),
  /**
   * The source as the caller is holding it, so the decision row can stand alone once the
   * source drops out of retrieval. Optional — a caller that does not have it still records
   * a valid decision, and the Evidence Pack falls back to the key.
   */
  source: z.object({
    title: z.string().max(500).nullish(),
    citation: z.string().max(500).nullish(),
    url: z.string().max(2000).nullish(),
    type: z.string().max(60).nullish(),
  }).optional(),
})

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })
  }

  try {
    const decision = await decideSource(id, authz.user.id, {
      sourceKey: parsed.data.sourceKey,
      status: parsed.data.status,
      reason: parsed.data.reason ?? null,
      annotation: parsed.data.annotation ?? null,
      source: parsed.data.source
        ? {
            title: parsed.data.source.title ?? '',
            citation: parsed.data.source.citation ?? '',
            url: parsed.data.source.url ?? '',
            // The panel's `SearchResultType`; stored as a plain string because a decision
            // must outlive a change to that union.
            type: (parsed.data.source.type ?? null) as never,
          }
        : null,
    })
    console.log('[lex-diag] 25d source decision', { ideaId: id, sourceKey: decision.sourceKey, status: decision.status })
    return NextResponse.json({ decision, decisions: await readSourceDecisions(id) })
  } catch (err) {
    if (err instanceof MissingExclusionReason) {
      return NextResponse.json({ error: err.message }, { status: 422 })
    }
    throw err
  }
}
