// ─────────────────────────────────────────────────────────────────────────────
// CCW-B22 §6 — THE ROUTE THAT LETS A COHERENT ACTION CARRY A COST RANGE.
//
// Measured before building: **1 of 135 coherent actions carries a cost line.** The schema,
// the write path and 53 `CostBenchmark` rows all exist; nothing drives them. So this is a
// producer, not a new model.
//
// ══ ⚠⚠ WHAT THIS IS NOT, AND THE HEADING THAT FOLLOWS FROM IT ════════════════════════════
//
// Charlie: *"Cost and benefit for now, but upgrade to include human cost and benefit going
// forward."* This builds the FINANCIAL half only. **Do not rename the module in the product
// to anything promising a cost-benefit analysis until it attempts the human side** — a
// heading that claims more than the module delivers is the same defect as a count presented
// as complete, which this project has now recorded eight times.
//
// `costKindOf()` below returns `FINANCIAL_ONLY` and the renderer is expected to print it.
// When the human side is built, that value changes and the heading may change with it. **The
// capability moves first and the wording follows it, never the other way round.**
//
// ══ ⚠ THREE RULES THAT DECIDE THE SHAPE ═════════════════════════════════════════════════
//
// 1. **A RANGE, NEVER A POINT.** `low` and `high` both, always. A single number on a costing
//    of a policy nobody has implemented is false precision, and it is the number that gets
//    quoted.
// 2. **NO LINE WITHOUT A BASIS.** `basis` is nullable in the schema and required here: a cost
//    with no stated assumption is a figure somebody will repeat without being able to defend
//    it. A line whose basis the model cannot state is DROPPED, and the drop is reported.
// 3. **A BENCHMARK IS CITED OR ABSENT, NEVER IMPLIED.** Where a figure comes from one of the
//    53 `CostBenchmark` rows, `benchmarkId` records which. Where it does not, it says the
//    basis is the model's own reasoning. ⚠ The two must never be confusable: a Green Book
//    unit cost and a plausible guess look identical once they are both a number in a table.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { callJson, llmFailed, type LlmUsage } from './build-llm'
import { M_GENERAL } from './method'

/** What the costing currently attempts. ⚠ The heading may not promise more than this. */
export type CostKind = 'FINANCIAL_ONLY' | 'FINANCIAL_AND_HUMAN'
export function costKindOf(): CostKind { return 'FINANCIAL_ONLY' }

export const COST_KIND_CAVEAT =
  'This is a purely financial view. It leaves out the human costs and benefits entirely — who bears '
  + 'them, who gains, and what the change does to people rather than to budgets. Read it as one input '
  + 'to a decision, not as a cost-benefit analysis.'

export interface ProposedCostLine {
  actionId: string
  label: string
  costType: 'STAFF' | 'CAPITAL' | 'PROPERTY' | 'RESEARCH' | 'OTHER'
  category: 'IMPLEMENTATION' | 'ENFORCEMENT' | 'FRICTION'
  low: number
  high: number
  unit: string
  /** ⚠ Required here even though the column is nullable. See rule 2. */
  basis: string
  /** The `CostBenchmark.id` this rests on, where it rests on one. Never invented. */
  benchmarkId?: string
  priceYear?: number
}

export interface CostProposal {
  lines: ProposedCostLine[]
  /** Lines the model returned that were dropped, and why. Reported, never silent. */
  dropped: Array<{ label: string; why: string }>
  /** Actions the pass declined to cost, with its reason. An honest absence. */
  notCosted: Array<{ actionId: string; step: string; why: string }>
  benchmarksOffered: number
}

const SCHEMA = {
  type: 'object',
  properties: {
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          actionId: { type: 'string' },
          label: { type: 'string' },
          costType: { type: 'string', enum: ['STAFF', 'CAPITAL', 'PROPERTY', 'RESEARCH', 'OTHER'] },
          category: { type: 'string', enum: ['IMPLEMENTATION', 'ENFORCEMENT', 'FRICTION'] },
          low: { type: 'number' },
          high: { type: 'number' },
          unit: { type: 'string' },
          basis: { type: 'string' },
          benchmarkId: { type: 'string' },
          priceYear: { type: 'number' },
        },
        required: ['actionId', 'label', 'costType', 'category', 'low', 'high', 'unit', 'basis'],
      },
    },
    notCosted: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          actionId: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['actionId', 'why'],
      },
    },
  },
  required: ['lines'],
} as const

/**
 * Propose cost lines for an idea's coherent actions. **Writes nothing.**
 *
 * ⚠ The benchmarks are OFFERED to the model with their ids, so a figure that rests on one can
 * say which. They are not filtered to the domain: filtering by a guessed domain would hide the
 * benchmark that actually applies, and the model can decline them all.
 */
export async function proposeCosts(input: {
  ideaId: string
  model?: string
  onUsage: (u: LlmUsage) => void
}): Promise<CostProposal | null> {
  const actions = await prisma.lexCoherentAction.findMany({
    where: { ideaId: input.ideaId },
    select: { id: true, practicalStep: true, whoImplements: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!actions.length) return null

  const benchmarks = await prisma.costBenchmark.findMany({
    select: { id: true, domain: true, metric: true, unit: true, low: true, high: true, source: true, year: true, priceYear: true },
    orderBy: [{ domain: 'asc' }, { metric: 'asc' }],
  })

  const idea = await prisma.idea.findUnique({
    where: { id: input.ideaId }, select: { title: true, challenge: true },
  })

  const system = [
    M_GENERAL,
    '',
    '════ WHAT WOULD THIS COST TO DO? ════',
    '',
    'You are costing the ACTIONS of a policy proposal — the money it takes to implement, enforce and',
    'comply with them. You are not judging whether the policy is a good idea.',
    '',
    '⚠⚠ **A RANGE, NEVER A POINT.** Give `low` and `high` and make them honestly far apart where the',
    'uncertainty is real. A single number on a policy nobody has implemented is false precision, and',
    'it is the number that will be quoted back at the proposer.',
    '',
    '⚠⚠ **EVERY LINE STATES ITS BASIS, AND THE BASIS IS THE POINT.** `basis` says what you assumed —',
    'how many people, at what grade, for how long, at what unit cost, and where that unit cost came',
    'from. A cost with no stated assumption is a figure somebody repeats and cannot defend. **If you',
    'cannot state the basis, do not give the line.**',
    '',
    '⚠⚠ **BENCHMARKS ARE CITED OR ABSENT.** You are given real benchmark rows below, with ids. If a',
    'figure rests on one, put its id in `benchmarkId`. If it does not, leave `benchmarkId` out and say',
    'in `basis` that the figure is your own reasoning. **Never imply a source you were not given** — a',
    'Green Book unit cost and a plausible guess look identical once both are numbers in a table, and',
    'the whole value of this exercise is that they are told apart.',
    '',
    '⚠ **AN ACTION YOU CANNOT COST GOES IN `notCosted` WITH A REASON.** "The scope is not specified',
    'enough to cost" is a real and useful answer. An invented figure is worse than a gap, because a',
    'gap gets filled and a figure gets used.',
    '',
    'Categories: `IMPLEMENTATION` (making it happen), `ENFORCEMENT` (keeping it happening),',
    '`FRICTION` (what it costs everybody else to comply).',
    '',
    '⚠ FRICTION IS THE ONE MOST OFTEN MISSED. A duty on four hundred bodies costs those bodies.',
    '',
    '⚠ This costing is FINANCIAL ONLY. Do not attempt to value human costs and benefits, and do not',
    'imply that a total here is a cost-benefit analysis. It is not one.',
  ].join('\n')

  const user = [
    `═══ THE PROPOSAL ═══\n${idea?.title ?? ''}\n${idea?.challenge ?? ''}`,
    '',
    '═══ THE ACTIONS TO COST — use these ids exactly ═══',
    ...actions.map((a) => `[${a.id}] ${a.practicalStep}${a.whoImplements ? ` — ${a.whoImplements}` : ''}`),
    '',
    benchmarks.length
      ? '═══ BENCHMARKS AVAILABLE TO YOU (cite by id, or do not cite) ═══\n'
        + benchmarks.map((b) => `[${b.id}] ${b.domain} · ${b.metric} · ${b.low ?? '?'}–${b.high ?? '?'} ${b.unit}`
          + ` · ${b.source}${b.priceYear ? ` (${b.priceYear} prices)` : b.year ? ` (${b.year})` : ''}`).join('\n')
      : '═══ NO BENCHMARKS ARE AVAILABLE — every figure must say it is your own reasoning ═══',
  ].join('\n')

  const result = await callJson<{
    lines: ProposedCostLine[]
    notCosted?: Array<{ actionId: string; why: string }>
  }>({
    model: input.model ?? process.env.LEX_COST_MODEL ?? 'gemini-2.5-pro',
    system,
    user,
    schema: SCHEMA,
    maxOutputTokens: parseInt(process.env.LEX_COST_TOKENS ?? '12000', 10),
    timeoutMs: parseInt(process.env.LEX_COST_TIMEOUT_MS ?? '180000', 10),
    temperature: 0.2,
    label: 'cost-route',
  })
  input.onUsage(result.usage)
  if (llmFailed(result)) {
    console.error('[cost] the pass did not complete', { reason: result.reason, detail: result.detail?.slice(0, 300) })
    return null
  }

  const actionIds = new Set(actions.map((a) => a.id))
  const benchmarkIds = new Set(benchmarks.map((b) => b.id))
  const raw = Array.isArray(result.value?.lines) ? result.value.lines : []
  const dropped: CostProposal['dropped'] = []
  const lines: ProposedCostLine[] = []

  for (const l of raw) {
    const label = String(l?.label ?? '').trim()
    // ⚠ EACH REJECTION NAMED SEPARATELY. "Invalid" would tell a reader nothing about which
    // rule the pass broke, and these are different faults with different fixes.
    if (!actionIds.has(String(l?.actionId))) { dropped.push({ label, why: 'the actionId is not one of this idea\'s actions' }); continue }
    if (!label) { dropped.push({ label: '(none)', why: 'no label' }); continue }
    if (!String(l?.basis ?? '').trim()) { dropped.push({ label, why: '⚠ NO BASIS STATED — a cost with no assumption is not a cost' }); continue }
    if (typeof l.low !== 'number' || typeof l.high !== 'number' || !Number.isFinite(l.low) || !Number.isFinite(l.high)) {
      dropped.push({ label, why: 'low or high is not a number' }); continue
    }
    if (l.high < l.low) { dropped.push({ label, why: 'high is below low' }); continue }
    // ⚠ A CITED BENCHMARK THAT DOES NOT EXIST IS WORSE THAN NONE — it is a fabricated source.
    if (l.benchmarkId && !benchmarkIds.has(String(l.benchmarkId))) {
      dropped.push({ label, why: `⚠⚠ cites benchmark ${l.benchmarkId}, which does not exist` }); continue
    }
    lines.push({
      actionId: String(l.actionId),
      label,
      costType: (l.costType ?? 'OTHER') as ProposedCostLine['costType'],
      category: (l.category ?? 'IMPLEMENTATION') as ProposedCostLine['category'],
      low: l.low, high: l.high,
      unit: String(l.unit ?? 'GBP').trim() || 'GBP',
      basis: String(l.basis).trim(),
      benchmarkId: l.benchmarkId ? String(l.benchmarkId) : undefined,
      priceYear: typeof l.priceYear === 'number' ? l.priceYear : undefined,
    })
  }

  const byId = new Map(actions.map((a) => [a.id, a.practicalStep]))
  const notCosted = (result.value?.notCosted ?? [])
    .filter((n) => n?.actionId && actionIds.has(String(n.actionId)))
    .map((n) => ({ actionId: String(n.actionId), step: byId.get(String(n.actionId)) ?? '', why: String(n.why ?? '').trim() }))

  return { lines, dropped, notCosted, benchmarksOffered: benchmarks.length }
}

/**
 * Write the proposed lines.
 *
 * ⚠ REFUSES AN ACTION THAT ALREADY HAS LINES, unless extending. The spawn pass taught this the
 * hard way: a non-deterministic producer plus idempotency-by-nothing grows its output every
 * time somebody re-runs it, and every addition looks like a finding.
 */
export async function writeCosts(
  lines: ProposedCostLine[],
  extendExisting = false,
): Promise<{ written: number; skippedActions: string[] }> {
  const actionIds = [...new Set(lines.map((l) => l.actionId))]
  const existing = await prisma.costLine.findMany({
    where: { actionId: { in: actionIds } }, select: { actionId: true },
  })
  const hasLines = new Set(existing.map((e) => e.actionId))
  const skippedActions = extendExisting ? [] : actionIds.filter((a) => hasLines.has(a))

  let written = 0
  for (const [i, l] of lines.entries()) {
    if (!extendExisting && hasLines.has(l.actionId)) continue
    await prisma.costLine.create({
      data: {
        actionId: l.actionId,
        label: l.label,
        costType: l.costType,
        category: l.category,
        low: l.low,
        high: l.high,
        unit: l.unit,
        basis: l.basis,
        benchmarkId: l.benchmarkId ?? null,
        priceYear: l.priceYear ?? null,
        orderIndex: i,
      },
    })
    written++
  }
  return { written, skippedActions }
}
