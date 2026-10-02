// ─────────────────────────────────────────────────────────────────────────────
// 26-M ITEM 4 — LEX REPORTS WHAT BEARS ON THE STAGE THE USER IS ON.
//
// Charlie: *"With consolidation open, Lex offers to add the relevant point to the final-version
// feedback — filed by the platform once the user agrees, and confirmed — and names any
// contradiction with the kernel prominently."*
//
// ⚠⚠ THE FILING IS THE PLATFORM'S, NOT LEX'S — Decision 92's pattern a third time. Lex is handed
// the point and told to ASK; it is never given a way to write. The point is remembered on the
// Lex message that asked (`offer`), and only the user's next, short, plain "yes" files it. A
// model that says "I've added that" has claimed nothing the platform did not do, because the
// platform's own confirmation block is what it is told to relay.
//
// ⚠ "FINAL-VERSION FEEDBACK" IS `GuidingPolicyConsolidation.userFeedback` — the general comment
// that BOTH "Write the final version" and "Start again" read (26-L addendum 4 §2). Appended, never
// replaced: whatever the user had already typed there is theirs and stays.
//
// ⚠ "BEARS ON THE STAGE" IS DECIDED FROM THE COMPARISON, NOT GUESSED BY THE MODEL. A change
// bears on the guiding policy when it contradicts the kernel anywhere, proposes a new policy
// option, or targets a policy candidate. A document that only supports a cause is true and is
// not offered, because an offer on every upload is an offer nobody reads.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

// ⚠ A `type`, not an `interface`: it is stored inside the Json chat history, and only a type
// alias is assignable to Prisma's JSON input.
export type FeedbackOffer = {
  kind: 'CONSOLIDATION_FEEDBACK'
  consolidationId: string
  /** Exactly what will be appended, so what the user agrees to is what is written. */
  text: string
}

/** The consolidation still being worked on — the newest, and not yet accepted. */
export async function openConsolidation(ideaId: string): Promise<{ id: string; userFeedback: string | null } | null> {
  const latest = await prisma.guidingPolicyConsolidation.findFirst({
    where: { ideaId }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, userFeedback: true },
  })
  if (!latest || latest.status === 'ACCEPTED') return null
  return { id: latest.id, userFeedback: latest.userFeedback }
}

const CATEGORY_WORDING: Record<string, string> = {
  CONTRADICTS: 'Contradicts the kernel',
  NEW_POLICY_OPTION: 'Suggests a policy option',
  SUPPORTS: 'Supports',
  NEW_CAUSE: 'Suggests a cause',
}

/**
 * The offer for this turn, or null. Only ever built from a comparison that ran this turn.
 */
export async function buildConsolidationOffer(
  ideaId: string,
  proposedChanges: Array<{ evidenceItemId: string; category: string; title: string }>,
): Promise<{ offer: FeedbackOffer; contradictions: string[]; block: string } | null> {
  if (!proposedChanges.length) return null
  const open = await openConsolidation(ideaId)
  if (!open) return null

  const rows = await prisma.evidenceItem.findMany({
    where: { id: { in: proposedChanges.map((p) => p.evidenceItemId) } },
    select: { id: true, fieldRef: true, citation: true },
  })
  const byId = new Map(rows.map((r) => [r.id, r]))

  const relevant = proposedChanges.filter((p) => {
    if (p.category === 'CONTRADICTS' || p.category === 'NEW_POLICY_OPTION') return true
    return (byId.get(p.evidenceItemId)?.fieldRef ?? '').startsWith('policyOptions:')
  }).slice(0, 4)
  if (!relevant.length) return null

  const contradictions = relevant.filter((p) => p.category === 'CONTRADICTS').map((p) => p.title)
  const point = relevant
    .map((p) => {
      const cite = byId.get(p.evidenceItemId)?.citation
      return `- ${CATEGORY_WORDING[p.category] ?? p.category}: ${p.title}${cite ? ` (${cite})` : ''}`
    })
    .join('\n')
  const text = `New material the user added bears on the final version:\n${point}`

  const block = [
    'STAGE RELEVANCE — the user is at the Guiding Policy with Consolidate OPEN, and the material',
    'just compared bears on it. In your reply:',
    ...(contradictions.length
      ? ['  1. LEAD with the contradiction(s) with the kernel, by name, before anything else:',
         ...contradictions.map((t) => `       · ${t}`)]
      : ['  1. (No contradiction with the kernel was found.)']),
    '  2. Say plainly which of the points below bear on the final version.',
    '  3. OFFER, as a question, to add the point to the feedback for the final version. The',
    '     platform files it only if the user then says yes, and will confirm. NEVER say it is',
    '     added, saved or filed — it is not, yet.',
    'POINT THAT WOULD BE ADDED:',
    point,
  ].join('\n')

  return { offer: { kind: 'CONSOLIDATION_FEEDBACK', consolidationId: open.id, text }, contradictions, block }
}

/** The offer carried by the last thing Lex said, if any. Only the LAST message counts — an offer
 *  the conversation has moved past is not one a later "yes" can claim. */
export function pendingOffer(history: Array<{ role: string; offer?: unknown }>): FeedbackOffer | null {
  const last = history[history.length - 1]
  if (!last || last.role !== 'lex') return null
  const o = last.offer as Partial<FeedbackOffer> | undefined
  if (o?.kind !== 'CONSOLIDATION_FEEDBACK' || !o.consolidationId || !o.text) return null
  return o as FeedbackOffer
}

export type OfferFiling = { outcome: 'filed' } | { outcome: 'gone' } | { outcome: 'already-there' }

/** Append the agreed point to the consolidation's general feedback. Never throws. */
export async function fileConsolidationOffer(ideaId: string, offer: FeedbackOffer): Promise<OfferFiling> {
  try {
    const open = await openConsolidation(ideaId)
    // The consolidation must still be the open one: accepted or superseded since the offer was
    // made, and the feedback would be going to a round nobody is reading.
    if (!open || open.id !== offer.consolidationId) return { outcome: 'gone' }
    const existing = (open.userFeedback ?? '').trim()
    if (existing.includes(offer.text)) return { outcome: 'already-there' }
    await prisma.guidingPolicyConsolidation.update({
      where: { id: open.id },
      data: { userFeedback: existing ? `${existing}\n\n${offer.text}` : offer.text },
    })
    return { outcome: 'filed' }
  } catch (err) {
    console.error('[stage-relevance] filing THREW', { error: err instanceof Error ? err.message : err })
    return { outcome: 'gone' }
  }
}

/** What Lex is handed after an agreed offer — a fact to relay, never an action to claim. */
export function offerFiledBlock(result: OfferFiling): string {
  if (result.outcome === 'filed') {
    return 'FEEDBACK FILED THIS TURN (the platform already did it — confirm plainly, once): the point you offered was added to the general feedback for the final version, where "Write the final version" and "Start again" both read it. Never re-ask for it.'
  }
  if (result.outcome === 'already-there') {
    return 'FEEDBACK: that point was already in the general feedback for the final version, so nothing was added. Say so.'
  }
  return 'FEEDBACK NOT FILED: the consolidation the offer was about is no longer open (it was accepted or replaced), so nothing was added. Say so plainly and do not pretend it was.'
}
