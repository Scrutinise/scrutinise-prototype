// ─────────────────────────────────────────────────────────────────────────────
// 26-I §5/§6/§7 — favourite + feedback, the one redraft, and accept.
//
// PATCH op:
//   favourite → §5: pick a favourite of the four, optionally with feedback across all four.
//   redraft   → §6: the favourite's model redrafts once, briefed with the user's feedback
//               AND the judge's own findings (never a merge — one author, informed by both).
//   accept    → §7: accept the redraft or an edited version; either way tested again (§4)
//               before `settle` (reused as-is) sets Chosen approach.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { authorizeIdea } from '@/lib/lex/authz'
import { applyPolicyOp } from '@/lib/lex/guiding-policy-state'
import { runFourDrafts, runRedraft, PREMIUM_DRAFT_MODELS, type ConsolidateContext } from '@/lib/lex/guiding-policy-consolidate'
import { judgeDrafts, testIsCompound, testRulesOutNothing, type DraftForJudge, type JudgeVerdict } from '@/lib/lex/rumelt-tests'

type Params = { params: Promise<{ id: string; consolidationId: string }> }

const PatchSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('favourite'),
    model: z.string().min(1),
    // §5b — what worked and did not, across all four. Feedback, never a splice request.
    feedback: z.string().trim().max(4000).optional(),
  }),
  // 26-L addendum 3 §4 — the "what worked across all four" box saves on its own, favourite or not.
  z.object({ op: z.literal('saveFeedback'), feedback: z.string().trim().max(4000) }),
  // 26-L addendum 2 §1 — "Retry reruns only the models that failed."
  z.object({ op: z.literal('retryFailed'), models: z.array(z.string().min(1)).min(1).max(4) }),
  z.object({ op: z.literal('redraft') }),
  z.object({
    op: z.literal('accept'),
    edited: z.object({
      statement: z.string().trim().min(1).max(4000),
      rulesOut: z.string().trim().min(1).max(4000),
      likelihood: z.string().trim().min(1).max(2000),
      chainLink: z.string().trim().min(1).max(2000),
    }).optional(),
  }),
])

function describeVerdictForRedraft(model: string, v: JudgeVerdict): string {
  const lines = [`${model}:`]
  lines.push(v.isCompound ? `  COMPOUND — ${v.compoundWhy}` : '  Not a compound.')
  lines.push(v.rulesOutNothing ? '  Rules out: nothing — this is a weakness.' : '  Rules something out.')
  lines.push(`  Answers the obstacle: ${v.answersObstacle.verdict ? 'yes' : 'no'} — ${v.answersObstacle.why}`)
  lines.push(v.causesMatch
    ? '  Attacks the causes it claims to.'
    : `  Claims causes it does not attack (judge read: ${v.causesAttackedByJudge.join(', ') || 'none'}).`)
  return lines.join('\n')
}

export async function PATCH(req: Request, { params }: Params) {
  const { id, consolidationId } = await params
  const authz = await authorizeIdea(id)
  if (authz.error) return authz.error
  const { user } = authz

  const consolidation = await prisma.guidingPolicyConsolidation.findFirst({
    where: { id: consolidationId, ideaId: id },
    include: { drafts: { orderBy: { createdAt: 'asc' } } },
  })
  if (!consolidation) return NextResponse.json({ error: 'That consolidation is not on this idea.' }, { status: 404 })

  const parsed = PatchSchema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: z.treeifyError(parsed.error) }, { status: 422 })
  const body = parsed.data

  if (body.op === 'saveFeedback') {
    const updated = await prisma.guidingPolicyConsolidation.update({
      where: { id: consolidation.id },
      data: { userFeedback: body.feedback || null },
      include: { drafts: { orderBy: { createdAt: 'asc' } } },
    })
    return NextResponse.json({ consolidation: updated })
  }

  if (body.op === 'favourite') {
    const draft = consolidation.drafts.find((d) => d.model === body.model)
    if (!draft) return NextResponse.json({ error: `No draft from ${body.model} on this consolidation.` }, { status: 422 })
    // §5c — recorded on every run, for ever: "the cheapest experiment the platform will run."
    const updated = await prisma.guidingPolicyConsolidation.update({
      where: { id: consolidation.id },
      data: { favouriteModel: body.model, userFeedback: body.feedback ?? consolidation.userFeedback, status: 'FAVOURITE_CHOSEN' },
      include: { drafts: { orderBy: { createdAt: 'asc' } } },
    })
    return NextResponse.json({ consolidation: updated })
  }

  // ══════════ 26-L ADDENDUM 2 §1 — RETRY REACHES ONLY THE MODELS THAT FAILED ══════════════
  //
  // "Consolidate again" (the original button, unchanged) discards everything and starts a
  // fresh consolidation. This does not: it re-runs exactly the named models against the SAME
  // stored context (`candidateSnapshot`), adds their drafts to THIS consolidation, and judges
  // only the new arrivals — the drafts that already succeeded, and anything already judged,
  // are untouched.
  if (body.op === 'retryFailed') {
    // ⚠ NEVER RE-RUN A MODEL THAT ALREADY HAS A DRAFT HERE. Named-but-already-succeeded is a
    // stale client (a second click after a slow success arrived) rather than a real retry.
    const already = new Set(consolidation.drafts.map((d) => d.model))
    const toRetry = body.models.filter((m) => (PREMIUM_DRAFT_MODELS as readonly string[]).includes(m) && !already.has(m))
    if (!toRetry.length) {
      return NextResponse.json({ error: 'Nothing to retry — every named model already has a draft here.' }, { status: 409 })
    }
    const context = consolidation.candidateSnapshot as unknown as ConsolidateContext
    const retried = await runFourDrafts(context, { ideaId: id, userId: user?.id ?? null }, toRetry)
    const succeeded = retried.filter((d) => d.ok && d.value)
    const failed = retried.filter((d) => !d.ok)
    let costPence = (consolidation.costPence ?? 0) + retried.reduce((sum, d) => sum + (d.priced.pence ?? 0), 0)

    if (succeeded.length) {
      await prisma.guidingPolicyDraft.createMany({
        data: succeeded.map((d) => ({
          consolidationId: consolidation.id,
          model: d.model,
          statement: d.value!.statement,
          rulesOut: d.value!.rulesOut,
          fixesCauseNumbers: d.value!.fixesCauseNumbers,
          likelihood: d.value!.likelihood,
          chainLink: d.value!.chainLink,
          costPence: d.priced.pence,
        })),
      })
      const freshDrafts = await prisma.guidingPolicyDraft.findMany({
        where: { consolidationId: consolidation.id, model: { in: succeeded.map((d) => d.model) } },
      })
      // §4/B2 — judge only the drafts that just arrived; the rest already carry a verdict.
      const forJudge: DraftForJudge[] = freshDrafts.map((d, i) => ({
        index: i, model: d.model, statement: d.statement, rulesOut: d.rulesOut, fixesCauseNumbers: d.fixesCauseNumbers,
      }))
      const judged = await judgeDrafts(
        { pivotalObstacle: context.pivotalObstacle, causes: context.causes },
        forJudge,
        { ideaId: id, userId: user?.id ?? null, pass: 'guiding-policy.judge' },
      )
      if (judged.ok) {
        costPence += judged.priced.pence ?? 0
        await Promise.all(
          judged.verdicts.map((v, i) =>
            prisma.guidingPolicyDraft.update({ where: { id: freshDrafts[i].id }, data: { judge: v as never } }),
          ),
        )
      }
    }

    const totalDrafts = consolidation.drafts.length + succeeded.length
    const updated = await prisma.guidingPolicyConsolidation.update({
      where: { id: consolidation.id },
      // A consolidation with at least one draft, before or after this retry, is judgeable
      // material — DRAFTING only where literally nothing has ever succeeded.
      // ⚠ 26-L addendum 3 §1 — a retry must not demote a consolidation that already has a favourite
      // back to JUDGED: the panel keyed "Write the final version" on FAVOURITE_CHOSEN, so it vanished.
      data: { status: consolidation.favouriteModel ? consolidation.status : totalDrafts > 0 ? 'JUDGED' : 'DRAFTING', costPence },
      include: { drafts: { orderBy: { createdAt: 'asc' } } },
    })
    return NextResponse.json({
      consolidation: updated,
      retried: succeeded.map((d) => d.model),
      failed: failed.map((f) => ({ model: f.model, error: f.error })),
    })
  }

  if (body.op === 'redraft') {
    if (!consolidation.favouriteModel) {
      return NextResponse.json({ error: 'Choose a favourite before asking for the redraft.' }, { status: 409 })
    }
    const favourite = consolidation.drafts.find((d) => d.model === consolidation.favouriteModel)
    if (!favourite) return NextResponse.json({ error: 'The favourite draft could not be found.' }, { status: 500 })

    const judgeFeedback = consolidation.drafts
      .map((d) => describeVerdictForRedraft(d.model, (d.judge as unknown as JudgeVerdict | null) ?? {
        index: 0, isCompound: false, compoundWhy: '', rulesOutNothing: false,
        answersObstacle: { verdict: true, why: 'not judged' }, causesAttackedByJudge: [], causesMatch: true,
      }))
      .join('\n\n')

    const context = consolidation.candidateSnapshot as unknown as ConsolidateContext
    const redraft = await runRedraft(
      context,
      {
        favouriteModel: consolidation.favouriteModel,
        favouriteStatement: favourite.statement,
        userFeedback: consolidation.userFeedback,
        judgeFeedback,
      },
      { ideaId: id, userId: user?.id ?? null },
    )

    if (!redraft.ok || !redraft.value) {
      return NextResponse.json({ error: `The redraft did not complete: ${redraft.error}` }, { status: 502 })
    }

    // §6a — the redraft is tested again by §4 before it is shown.
    const forJudge: DraftForJudge[] = [{
      index: 0, model: consolidation.favouriteModel, statement: redraft.value.statement,
      rulesOut: redraft.value.rulesOut, fixesCauseNumbers: redraft.value.fixesCauseNumbers,
    }]
    const judged = await judgeDrafts(
      { pivotalObstacle: context.pivotalObstacle, causes: context.causes },
      forJudge,
      { ideaId: id, userId: user?.id ?? null, pass: 'guiding-policy.judge' },
    )

    const costPence = (consolidation.costPence ?? 0) + (redraft.priced.pence ?? 0) + (judged.ok ? judged.priced.pence ?? 0 : 0)
    const updated = await prisma.guidingPolicyConsolidation.update({
      where: { id: consolidation.id },
      data: {
        redraftText: redraft.value.statement,
        redraftRulesOut: redraft.value.rulesOut,
        redraftLikelihood: redraft.value.likelihood,
        redraftChainLink: redraft.value.chainLink,
        redraftFixesCauseNumbers: redraft.value.fixesCauseNumbers,
        redraftJudge: judged.ok ? (judged.verdicts[0] as never) : null,
        status: 'REDRAFTED',
        costPence,
      },
      include: { drafts: { orderBy: { createdAt: 'asc' } } },
    })
    // ⚠ `strict: false` — TS will not narrow `judged`'s boolean `ok` discriminant even inside
    // a ternary (established idiom, see reranker.ts/query-expansion.ts); cast once rather than
    // re-trip the same non-narrowing.
    const judgeError = judged.ok ? null : (judged as { reason: string }).reason
    return NextResponse.json({ consolidation: updated, judgeError })
  }

  // ── accept (§7) ────────────────────────────────────────────────────────────
  if (!consolidation.redraftText) {
    return NextResponse.json({ error: 'There is no redraft to accept yet.' }, { status: 409 })
  }
  const context = consolidation.candidateSnapshot as unknown as ConsolidateContext
  const edited = body.edited
  const isEdited = !!edited && (
    edited.statement !== consolidation.redraftText
    || edited.rulesOut !== consolidation.redraftRulesOut
    || edited.likelihood !== consolidation.redraftLikelihood
    || edited.chainLink !== consolidation.redraftChainLink
  )

  const finalText = edited?.statement ?? consolidation.redraftText
  const finalRulesOut = edited?.rulesOut ?? consolidation.redraftRulesOut ?? ''
  const finalLikelihood = edited?.likelihood ?? consolidation.redraftLikelihood ?? ''
  const finalChainLink = edited?.chainLink ?? consolidation.redraftChainLink ?? ''

  // §7a — an edited version is tested again. An unedited acceptance already carries the
  // redraft's own §6a judge result; re-spending a premium call to confirm unchanged text
  // would be the cost §3 warns is only obviously right for the drafts and judge, not for
  // re-checking a sentence nobody touched.
  let finalJudge: JudgeVerdict | null = consolidation.redraftJudge as unknown as JudgeVerdict | null
  let costPence = consolidation.costPence ?? 0
  if (isEdited) {
    const forJudge: DraftForJudge[] = [{
      index: 0, model: consolidation.favouriteModel ?? 'edited', statement: finalText,
      rulesOut: finalRulesOut, fixesCauseNumbers: consolidation.redraftFixesCauseNumbers,
    }]
    const judged = await judgeDrafts(
      { pivotalObstacle: context.pivotalObstacle, causes: context.causes },
      forJudge,
      { ideaId: id, userId: user?.id ?? null, pass: 'guiding-policy.judge' },
    )
    if (judged.ok) {
      finalJudge = judged.verdicts[0]
      costPence += judged.priced.pence ?? 0
    } else {
      // Mechanical half still runs even if the premium half fails — an edit is never
      // accepted with literally zero test run against it.
      // ⚠ `strict: false` cast — see the note above this function's other `judged.ok` check.
      const fail = judged as { reason: string }
      finalJudge = {
        index: 0, isCompound: testIsCompound(finalText).isCompound, compoundWhy: testIsCompound(finalText).why,
        rulesOutNothing: testRulesOutNothing(finalRulesOut),
        answersObstacle: { verdict: false, why: `The judge could not be reached: ${fail.reason}` },
        causesAttackedByJudge: [], causesMatch: false,
      }
    }
  }

  const number = await prisma.policyOption.findMany({ where: { ideaId: id }, select: { number: true } })
    .then((rows) => Math.max(0, ...rows.map((r) => r.number ?? 0)) + 1)

  const created = await prisma.policyOption.create({
    data: {
      ideaId: id,
      approach: finalText,
      number,
      kind: 'GUIDING_POLICY',
      source: isEdited ? 'USER' : 'LEX',
      draftModel: consolidation.favouriteModel,
      rulesOut: finalRulesOut,
      likelihood: finalLikelihood,
      chainLink: finalChainLink || null,
      disposition: 'PART_OF_SOLUTION',
      sortedAt: new Date(),
    },
  })

  // §7b — reuses the EXISTING mechanism: `settle` is what sets Chosen approach and opens
  // Leverage, Anticipated responses, Conditions for success and the Guiding-policy summary.
  // Not a second unlock path — the one this screen has always used, on a fresh row.
  const settled = await applyPolicyOp({ ideaId: id, op: 'settle', policyId: created.id })
  if ('notOnThisIdea' in settled) {
    return NextResponse.json({ error: 'The accepted draft could not be settled.' }, { status: 500 })
  }

  const updated = await prisma.guidingPolicyConsolidation.update({
    where: { id: consolidation.id },
    data: {
      acceptedText: finalText,
      acceptedEdited: isEdited,
      acceptedPolicyOptionId: created.id,
      status: 'ACCEPTED',
      redraftJudge: finalJudge as never,
      costPence,
    },
    include: { drafts: { orderBy: { createdAt: 'asc' } } },
  })

  return NextResponse.json({ consolidation: updated, state: settled.state, judge: finalJudge })
}
