import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { computeCanonicalState } from '@/lib/lex/state'
import { assertWritableField } from '@/lib/lex/stage'
import { addCostLine, updateCostLine, removeCostLine, suggestStaffCost } from '@/lib/lex/field-machine'

type Params = { params: Promise<{ id: string }> }

// The cost engine v0 (§19-C Task 6). One costed line at a time under a Coherent Action,
// replacing the three-range estimator that never fired in the 2 Aug walk-through.
// `suggest` returns an ASHE-derived figure for a staffing line — a suggestion the user
// accepts or overrides; it never writes anything on its own.
const CostTypes = z.enum(['STAFF', 'CAPITAL', 'PROPERTY', 'RESEARCH', 'OTHER'])
const Categories = z.enum(['IMPLEMENTATION', 'ENFORCEMENT', 'FRICTION'])
const StaffLevels = z.enum(['JUNIOR', 'MID', 'SENIOR'])

const LineFields = {
  label: z.string().trim().min(1).max(300),
  costType: CostTypes.optional(),
  category: Categories.optional(),
  staffLevel: StaffLevels.nullish(),
  fteCount: z.number().nonnegative().max(100000).nullish(),
  durationMonths: z.number().nonnegative().max(1200).nullish(),
  low: z.number().nullish(),
  high: z.number().nullish(),
  unit: z.string().trim().max(20).nullish(),
  basis: z.string().trim().max(2000).nullish(),
  benchmarkId: z.string().nullish(),
  priceYear: z.number().int().nullish(),
}

const BodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add'), actionId: z.string().min(1), ...LineFields }),
  z.object({ action: z.literal('update'), lineId: z.string().min(1), ...LineFields, label: LineFields.label.optional() }),
  z.object({ action: z.literal('remove'), lineId: z.string().min(1) }),
  z.object({
    action: z.literal('suggest'),
    staffLevel: StaffLevels,
    fteCount: z.number().positive().max(100000),
    durationMonths: z.number().positive().max(1200),
  }),
])

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const parsed = BodySchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  const body = parsed.data

  // Costing belongs to the actions stage — same write-side page guard as everywhere.
  const blocked = await assertWritableField(id, 'actions')
  if (blocked) {
    return NextResponse.json({ error: 'You haven’t started the Coherent Actions yet.' }, { status: 409 })
  }

  if (body.action === 'suggest') {
    const suggestion = await suggestStaffCost(body.staffLevel, body.fteCount, body.durationMonths)
    if (!suggestion) {
      return NextResponse.json(
        { suggestion: null, note: 'No wage benchmark is loaded, so I can’t suggest a figure — enter one with its basis.' },
      )
    }
    return NextResponse.json({ suggestion })
  }

  try {
    if (body.action === 'add') {
      const { action: _a, actionId, ...fields } = body
      void _a
      const created = await addCostLine(id, actionId, fields)
      if (!created) return NextResponse.json({ error: 'That action was not found.' }, { status: 422 })
    } else if (body.action === 'update') {
      const { action: _a, lineId, ...fields } = body
      void _a
      await updateCostLine(id, lineId, fields)
    } else {
      await removeCostLine(id, body.lineId)
    }
  } catch (err) {
    console.error('[cost-lines] write failed:', err)
    return NextResponse.json({ error: 'Write failed' }, { status: 500 })
  }

  const state = await computeCanonicalState(id)
  console.log('[lex-diag] cost line', { action: body.action, lines: state?.costLines.length ?? 0 })
  return NextResponse.json({ state, messages: [] })
}
