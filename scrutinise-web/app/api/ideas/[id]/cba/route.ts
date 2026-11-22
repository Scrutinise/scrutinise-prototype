import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'
import { describeIssues } from '@/lib/api-rejection'
import { runCba } from '@/lib/lex/cba/engine'
import { cbaSummary } from '@/lib/lex/cba/summary-pure'
import { cbaReportStatus, generateCbaReport } from '@/lib/lex/cba/report'
import { costSection } from '@/lib/lex/deepening-overview'
import { readAppraisalSettings } from '@/lib/lex/cba/settings'

type Params = { params: Promise<{ id: string }> }

// LEX 26-Y §4 / §6 (decision 336) — the Cost–benefit report. GET: the engine's summary (free, no model) and the versions with their stale
// counts. POST: generate a new version; `narrative: false` makes the free version (no model call). The screen asks first, with the price.
export const maxDuration = 120

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id, 'read')
  if (authz.error) return authz.error
  const [run, status, rollup, settings] = await Promise.all([runCba(id), cbaReportStatus(id), costSection(id), readAppraisalSettings(id)])
  if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ summary: cbaSummary(run.result), status, rollup, settings })
}

const Body = z.object({ op: z.literal('generate'), narrative: z.boolean().default(true) })

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea)
  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'Generating the report was not done: the request was not JSON.' }, { status: 400 }) }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    const { message, rejected } = describeIssues(parsed.error.issues, { action: 'Generating the Cost–benefit report', labels: { op: 'The request', narrative: 'With Lex’s narrative' } })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
  const r = await generateCbaReport(id, authz.user.id, { narrative: parsed.data.narrative })
  if (!r.ok) { const f = r as { error: string; status: number }; return NextResponse.json({ error: f.error }, { status: f.status }) }
  return NextResponse.json({ ...r, status: await cbaReportStatus(id) })
}
