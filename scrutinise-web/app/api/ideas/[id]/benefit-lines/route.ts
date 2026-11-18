import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authorizeIdea } from '@/lib/lex/authz'
import { enterSpendFor } from '@/lib/lex/build-context'
import { assertWritableField } from '@/lib/lex/stage'
import { describeIssues } from '@/lib/api-rejection'
import { LIMITS } from '@/lib/lex/input-limits'
import { PARTY_KINDS, parseLineAppraisal } from '@/lib/lex/cba/line-appraisal'
import { prisma } from '@/lib/prisma'
import { SOURCE_KINDS } from '@/lib/lex/cba/benefit-lines-pure'
import { addBenefitLine, setBenefitLine, changeBenefitStatus, listBenefitLines } from '@/lib/lex/cba/benefit-lines'

type Params = { params: Promise<{ id: string }> }

// LEX 26-Y §2a (decision 334) — benefit lines on an action, the form's route. The writers are lib/lex/cba/benefit-lines.ts, which Lex's tools
// call too (parity). Text limits come from LIMITS so the counters and this schema agree; a refusal is worded (§30), never "not valid".
const Fields = {
  label: z.string().max(LIMITS.benefitLabel),
  beneficiary: z.enum(PARTY_KINDS),
  beneficiaryName: z.string().max(LIMITS.beneficiaryName).nullish(),
  measure: z.string().max(LIMITS.benefitMeasure).nullish(),
  low: z.number().nonnegative().max(LIMITS.amountMax).nullish(),
  high: z.number().nonnegative().max(LIMITS.amountMax).nullish(),
  priceYear: z.number().int().min(1900).max(2100).nullish(),
  recurrence: z.enum(['ONE_OFF', 'PER_YEAR']).nullish(),
  durationMonths: z.number().positive().max(1200).nullish(),
  isHealth: z.boolean().optional(),
  sourceKind: z.enum(SOURCE_KINDS).nullish(),
  sourceRef: z.number().int().positive().nullish(),
  benchmarkId: z.string().max(100).nullish(),
  citationKey: z.string().max(LIMITS.citationKey).nullish(),
  ownerReason: z.string().max(LIMITS.benefitReason).nullish(),
  notValuedWhy: z.string().max(LIMITS.benefitReason).nullish(),
}
const Body = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add'), actionId: z.string().min(1), ...Fields }),
  z.object({ op: z.literal('set'), lineId: z.string().min(1), ...Object.fromEntries(Object.entries(Fields).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()])) as { [K in keyof typeof Fields]: z.ZodOptional<(typeof Fields)[K]> } }),
  z.object({ op: z.enum(['accept', 'set_aside', 'remove', 'restore']), lineId: z.string().min(1) }),
])
const WORDS: Record<string, string> = {
  label: 'What is gained', beneficiary: 'Who gains', beneficiaryName: 'Who gains (named)', measure: 'How it would be measured', low: 'Low figure', high: 'High figure',
  priceYear: 'Price year', recurrence: 'One-off or per year', durationMonths: 'Duration', sourceKind: 'Source', sourceRef: 'Source number', citationKey: 'Citation key',
  ownerReason: 'Reason for the estimate', notValuedWhy: 'Why not valued', actionId: 'The action', lineId: 'The benefit line', op: 'The change',
}

export async function GET(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const actionId = new URL(req.url).searchParams.get('actionId')
  const lines = (await listBenefitLines(id)).filter((l) => !actionId || l.actionId === actionId)
  // the action's cost lines with what they carry for the appraisal (§3.1 / 339 / 340), and the unit-cost rows a benefit may cite
  const [costLines, benchmarks] = actionId ? await Promise.all([
    prisma.costLine.findMany({ where: { actionId, action: { ideaId: id } }, orderBy: { orderIndex: 'asc' }, select: { id: true, label: true, costType: true, low: true, high: true, appraisal: true, citationKey: true } }),
    prisma.costBenchmark.findMany({ orderBy: [{ domain: 'asc' }, { metric: 'asc' }], select: { id: true, domain: true, metric: true, source: true, low: true, high: true, unit: true, priceYear: true } }),
  ]) : [[], []]
  return NextResponse.json({ lines, costLines: costLines.map((c) => ({ ...c, appraisal: parseLineAppraisal(c.appraisal) })), benchmarks })
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  enterSpendFor(authz.user, authz.idea)
  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'Saving the benefit line was not done: the request was not JSON. Nothing was changed.' }, { status: 400 }) }
  const parsed = Body.safeParse(raw)
  if (!parsed.success) {
    const { message, rejected } = describeIssues(parsed.error.issues, { action: 'Saving the benefit line', labels: WORDS })
    return NextResponse.json({ error: message, rejected }, { status: 422 })
  }
  if (await assertWritableField(id, 'actions')) return NextResponse.json({ error: 'Not saved: you haven’t started the Coherent Actions yet.' }, { status: 409 })
  const b = parsed.data
  const actor = { userId: authz.user.id, by: 'OWNER' as const }
  const r = b.op === 'add'
    ? await addBenefitLine(id, b.actionId, { ...b, label: b.label, beneficiary: b.beneficiary }, actor)
    : b.op === 'set'
      ? await setBenefitLine(id, b.lineId, b as never, actor)
      : await changeBenefitStatus(id, b.lineId, b.op, actor)
  if (!r.ok) return NextResponse.json({ error: (r as { error: string }).error }, { status: 422 })
  return NextResponse.json({ ok: true, result: r.data, lines: await listBenefitLines(id) })
}
