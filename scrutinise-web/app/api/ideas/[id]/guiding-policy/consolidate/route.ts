// ─────────────────────────────────────────────────────────────────────────────
// 26-I §3/§4 — CONSOLIDATE. Four premium models each draft one guiding policy from the
// same explicit context; a fifth premium call (the judge, §4/addendum B2) tests every
// draft and prints the verdict — including failures — on its card.
//
// GET  → the idea's consolidations (most recent first), for the screen to resume one
//        already in progress rather than losing it on a reload.
// POST → start a new consolidation: gather context, draft, judge, persist, return.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorizeIdea } from '@/lib/lex/authz'
import { readPolicyState } from '@/lib/lex/guiding-policy-state'
import { runFourDrafts, type ConsolidateContext } from '@/lib/lex/guiding-policy-consolidate'
import { judgeDrafts, type DraftForJudge } from '@/lib/lex/rumelt-tests'

export const maxDuration = 300

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error

  const consolidations = await prisma.guidingPolicyConsolidation.findMany({
    where: { ideaId: id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { drafts: { orderBy: { createdAt: 'asc' } } },
  })
  return NextResponse.json({ consolidations })
}

export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { idea, user } = authz

  // §2/A5 — the same gate the button's own `enabled` reads; enforced again server-side,
  // because a disabled button is a UI courtesy, not a guarantee.
  const policyState = await readPolicyState(id)
  if (!policyState.consolidate.enabled) {
    // 26-L addendum, decision 103 item 1 — names the numbers, not only the count.
    return NextResponse.json(
      { error: `Waiting on #${policyState.consolidate.waitingOnNumbers.join(', #')} — mark each part of the solution, ruled out, later phase, a duplicate, or leave feedback on it.` },
      { status: 409 },
    )
  }
  if (policyState.consolidate.candidateCount === 0) {
    return NextResponse.json(
      { error: 'Mark at least one candidate "part of the solution" before consolidating.' },
      { status: 409 },
    )
  }

  const ideaRow = await prisma.idea.findUnique({
    where: { id },
    select: { challenge: true, summaryDescription: true, pivotalObstacle: true },
  })
  if (!ideaRow?.pivotalObstacle?.trim()) {
    return NextResponse.json(
      { error: 'There is no pivotal obstacle recorded on the diagnosis yet — Consolidate needs one to test drafts against.' },
      { status: 409 },
    )
  }

  // ⚠ 26-L addendum 4 §2 — "START AGAIN" READS THE FEEDBACK. When the client names the
  // consolidation it is starting again from, its general comment and per-draft comments go to the
  // four new drafters, and the general comment carries over into the new consolidation's own box.
  const fromId = ((await req.json().catch(() => ({}))) as { from?: unknown })?.from
  const previous = typeof fromId === 'string'
    ? await prisma.guidingPolicyConsolidation.findFirst({
        where: { id: fromId, ideaId: id }, include: { drafts: { orderBy: { createdAt: 'asc' } } },
      })
    : null
  const priorRound = previous ? {
    generalFeedback: previous.userFeedback?.trim() || null,
    drafts: previous.drafts
      .filter((d) => d.userFeedback?.trim())
      .map((d) => ({ model: d.model, statement: d.statement, feedback: d.userFeedback!.trim() })),
  } : undefined

  const allPolicies = await prisma.policyOption.findMany({
    where: { ideaId: id },
    select: { id: true, number: true, approach: true, caseFor: true, caseAgainst: true, source: true, disposition: true },
  })
  // ⚠⚠ 26-L addendum, decision 103 item 2 — "Consolidation reads the feedback text." Fetched
  // once for every part-of-solution candidate, keyed by policyOptionId, rather than N queries.
  const partOfSolutionRows = allPolicies.filter((p) => p.disposition === 'PART_OF_SOLUTION' && p.number != null)
  const feedbackRows = partOfSolutionRows.length
    ? await prisma.policyFeedback.findMany({
        where: { ideaId: id, policyOptionId: { in: partOfSolutionRows.map((p) => p.id) } },
        select: { policyOptionId: true, text: true },
        orderBy: { createdAt: 'asc' },
      })
    : []
  const feedbackByPolicyId = new Map<string, string[]>()
  for (const f of feedbackRows) {
    if (!f.policyOptionId) continue
    const arr = feedbackByPolicyId.get(f.policyOptionId) ?? []
    arr.push(f.text)
    feedbackByPolicyId.set(f.policyOptionId, arr)
  }
  const partOfSolution = partOfSolutionRows
    .map((p) => ({
      number: p.number!, approach: p.approach, caseFor: p.caseFor, caseAgainst: p.caseAgainst,
      feedback: feedbackByPolicyId.get(p.id) ?? [],
    }))
  // §3 — "the user's own attempts", distinct from the part-of-solution set: every
  // guiding-policy candidate the user personally typed in, whatever happened to it since.
  const userAttempts = allPolicies
    .filter((p) => p.source === 'USER' && p.number != null)
    .map((p) => ({ number: p.number!, approach: p.approach }))

  const context: ConsolidateContext = {
    problem: ideaRow.challenge?.trim() || ideaRow.summaryDescription?.trim() || '(no problem statement recorded)',
    pivotalObstacle: ideaRow.pivotalObstacle.trim(),
    causes: policyState.causes.map((c) => ({ number: c.number, cause: c.cause })),
    partOfSolution,
    userAttempts,
    ...(priorRound ? { priorRound } : {}),
  }

  const draftResults = await runFourDrafts(context, { ideaId: id, userId: user?.id ?? null })
  const succeeded = draftResults.filter((d) => d.ok && d.value)
  const failed = draftResults.filter((d) => !d.ok)

  // ⚠ A PANEL THAT SILENTLY SHRANK MUST NOT READ LIKE A FULL ONE (build-smart.ts's own
  // rule, carried here) — every failure is named in the response, never dropped.
  if (succeeded.length === 0) {
    return NextResponse.json(
      { error: 'None of the four models produced a draft.', failed: failed.map((f) => ({ model: f.model, error: f.error })) },
      { status: 502 },
    )
  }

  let costPence = draftResults.reduce((sum, d) => sum + (d.priced.pence ?? 0), 0)
  const anyUnpriced = draftResults.some((d) => d.priced.unpriced)

  const consolidation = await prisma.guidingPolicyConsolidation.create({
    data: {
      ideaId: id,
      status: 'DRAFTING',
      userFeedback: priorRound?.generalFeedback ?? null,
      candidateSnapshot: context as never,
      drafts: {
        create: succeeded.map((d) => ({
          model: d.model,
          statement: d.value!.statement,
          rulesOut: d.value!.rulesOut,
          fixesCauseNumbers: d.value!.fixesCauseNumbers,
          likelihood: d.value!.likelihood,
          chainLink: d.value!.chainLink,
          costPence: d.priced.pence,
        })),
      },
    },
    include: { drafts: true },
  })

  // §4/B2 — one batched judge call over every draft that came back.
  const forJudge: DraftForJudge[] = consolidation.drafts.map((d, i) => ({
    index: i, model: d.model, statement: d.statement, rulesOut: d.rulesOut, fixesCauseNumbers: d.fixesCauseNumbers,
  }))
  const judged = await judgeDrafts(
    { pivotalObstacle: context.pivotalObstacle, causes: context.causes },
    forJudge,
    { ideaId: id, userId: user?.id ?? null, pass: 'guiding-policy.judge' },
  )

  if (judged.ok) {
    costPence += judged.priced.pence ?? 0
    if (judged.priced.unpriced) { /* still reported via `unpriced` below */ }
    await Promise.all(
      judged.verdicts.map((v, i) =>
        prisma.guidingPolicyDraft.update({
          where: { id: consolidation.drafts[i].id },
          data: { judge: v as never },
        }),
      ),
    )
  }

  // ⚠ `strict: false` — TS will not narrow `judged`'s boolean `ok` discriminant (same
  // established idiom as reranker.ts/query-expansion.ts), so the fields either side needs
  // are read into plain variables via an explicit cast, once, rather than re-triggering the
  // same non-narrowing at every use site below.
  const judgeError = judged.ok ? null : (judged as { reason: string }).reason
  const judgeUnpriced = judged.ok ? (judged as { priced: { unpriced: boolean } }).priced.unpriced : false

  const finalConsolidation = await prisma.guidingPolicyConsolidation.update({
    where: { id: consolidation.id },
    data: { status: judged.ok ? 'JUDGED' : 'DRAFTING', costPence },
    include: { drafts: { orderBy: { createdAt: 'asc' } } },
  })

  return NextResponse.json({
    consolidation: finalConsolidation,
    failed: failed.map((f) => ({ model: f.model, error: f.error })),
    judgeError,
    unpriced: anyUnpriced || judgeUnpriced,
    judgeModel: judged.model,
  })
}
