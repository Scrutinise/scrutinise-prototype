import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { describeIssues } from '@/lib/api-rejection'
import { readAppraisalSettings, setAppraisalSettings } from '@/lib/lex/cba/settings'

type Params = { params: Promise<{ id: string }> }

// LEX 26-Y decision 335 / §6 — the idea's appraisal period, start year and price year. The OWNER sets them (a collaborator reads them);
// null puts a value back to its default. The refusal rule is period.ts's periodRefusal, the same one the engine applies.
const Body = z.object({
  years: z.number().int().nullable().optional(),
  startYear: z.number().int().nullable().optional(),
  priceYear: z.number().int().nullable().optional(),
})

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  return NextResponse.json({ ...(await readAppraisalSettings(id)), canEdit: authz.idea.creatorId === authz.user.id })
}

export async function PATCH(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  if (authz.idea.creatorId !== authz.user.id) return NextResponse.json({ error: 'Not saved: only the idea’s owner sets the appraisal period and price year.' }, { status: 403 })
  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'Saving the appraisal settings was not done: the request was not JSON. Nothing was changed.' }, { status: 400 }) }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    const { message, rejected } = describeIssues(parsed.error.issues, { action: 'Saving the appraisal settings', labels: { years: 'Appraisal period (years)', startYear: 'Start year', priceYear: 'Price year' } })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
  const r = await setAppraisalSettings(id, parsed.data, authz.user.id)
  if (!r.ok) return NextResponse.json({ error: (r as { error: string }).error }, { status: 422 })
  return NextResponse.json({ ...(r as { data: object }).data, canEdit: true })
}
