// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-V2c (268, revised) — the server half of "Lex proposes a kind for each heading". See heading-kind-pure.ts.
//
//   composeKindProposals — one model call over the headings with no kind and no proposal waiting; writes NOTHING (the measurement calls it).
//   proposeHeadingKinds  — compose, then write each as `proposedKind` + its reason beside the heading. Never sets `kind`.
//   answerKindProposal   — the owner's Accept (sets `kind`, clears the proposal) or "Not this" (clears it). Nothing else changes.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { callModelJson } from './model-call'
import { recordUsage } from './spend-ledger'
import { DRAFT_MODEL } from './action-draft'
import { HEADING_KIND_WORD, isHeadingKind } from './action-documents-pure'
import {
  ACTIONS_PER_HEADING, KIND_PROPOSAL_SCHEMA, KIND_PROPOSAL_SYSTEM, acceptedProposals, kindProposalUser,
  type KindHeadingInput, type KindProposalAnswer,
} from './heading-kind-pure'
import type { Result } from './action-structure'

export * from './heading-kind-pure'

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })
type Call = typeof callModelJson
const PASS = 'actions.heading_kind'

/** The headings Lex is asked about: live, with no kind and no proposal waiting (or the ones named), each with its first actions. */
export async function kindInputs(ideaId: string, headingIds?: string[]): Promise<KindHeadingInput[]> {
  const heads = await prisma.actionHeading.findMany({
    where: { ideaId, archivedAt: null, ...(headingIds ? { id: { in: headingIds } } : { kind: null, proposedKind: null }) },
    select: { id: true, name: true, purpose: true }, orderBy: [{ orderIndex: 'asc' }],
  })
  const acts = await prisma.lexCoherentAction.findMany({
    where: { ideaId, status: 'LIVE', headingId: { in: heads.map((h) => h.id) } },
    select: { headingId: true, number: true, title: true, practicalStep: true }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
  })
  return heads.map((h, i) => {
    const mine = acts.filter((a) => a.headingId === h.id)
    return {
      n: i + 1, id: h.id, name: h.name, purpose: h.purpose,
      actions: mine.slice(0, ACTIONS_PER_HEADING).map((a) => `#${a.number ?? '?'} ${(a.title?.trim() || a.practicalStep).replace(/\s+/g, ' ').slice(0, 160)}`),
      more: Math.max(0, mine.length - ACTIONS_PER_HEADING),
    }
  })
}

export interface KindProposalRun { proposals: Array<{ id: string; name: string; kind: string; reason: string }>; dropped: string[]; pence: number | null; seconds: number; headings: number }

/** The model call and its checks, writing nothing. */
/** `spendIdeaId`: where the spend is recorded, if not the idea read (a measurement charges its scratch copy). */
export async function composeKindProposals(ideaId: string, heads: KindHeadingInput[], ctx: { userId: string | null; call?: Call; spendIdeaId?: string }): Promise<Result<KindProposalRun>> {
  const started = Date.now()
  if (!heads.length) return fail('Every heading already has a kind or a proposal waiting. Nothing was asked.')
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { chosenApproach: true } })
  const call = ctx.call ?? callModelJson
  const res = await call<KindProposalAnswer>({
    model: DRAFT_MODEL, system: KIND_PROPOSAL_SYSTEM, user: kindProposalUser(heads, idea?.chosenApproach ?? null), schema: KIND_PROPOSAL_SCHEMA as never,
    maxOutputTokens: 4_000, timeoutMs: 120_000, reasoningEffort: 'low', label: 'heading-kind', stream: 'lex', pass: PASS, ideaId: ctx.spendIdeaId ?? ideaId, userId: ctx.userId,
  })
  const priced = res.usage.recorded ?? (await recordUsage(res.usage, { stream: 'lex', pass: PASS, ideaId: ctx.spendIdeaId ?? ideaId, userId: ctx.userId, failed: !res.ok }))
  if (!res.ok) return fail(`Lex’s proposal of kinds did not complete: ${(res as { detail?: string }).detail ?? (res as { reason?: string }).reason ?? 'no reason given'}. Nothing was written.${priced.pence ? ` It cost ${priced.pence.toFixed(1)}p.` : ''}`)
  const { kept, dropped } = acceptedProposals(heads, res.value)
  return {
    ok: true,
    data: {
      proposals: kept.map((k) => ({ ...k, name: heads.find((h) => h.id === k.id)!.name })), dropped, pence: priced.pence ?? null,
      seconds: Math.round((Date.now() - started) / 100) / 10, headings: heads.length,
    },
  }
}

/** Compose, then write each proposal beside its heading. The kind itself is the owner's. */
export async function proposeHeadingKinds(ideaId: string, userId: string | null, opts: { call?: Call; headingIds?: string[] } = {}): Promise<Result<KindProposalRun>> {
  const heads = await kindInputs(ideaId, opts.headingIds)
  const r = await composeKindProposals(ideaId, heads, { userId, call: opts.call })
  if (!r.ok) return r
  for (const p of r.data.proposals) await prisma.actionHeading.update({ where: { id: p.id }, data: { proposedKind: p.kind, proposedKindReason: p.reason } })
  return r
}

/** Accept: the proposal becomes the kind. "Not this": the proposal goes, the kind stays as it was. */
export async function answerKindProposal(ideaId: string, headingId: string, accept: boolean): Promise<Result<{ name: string; kind: string | null }>> {
  const h = await prisma.actionHeading.findFirst({ where: { id: headingId, ideaId }, select: { name: true, kind: true, proposedKind: true } })
  if (!h) return fail('That heading is not on this idea.')
  if (!h.proposedKind || !isHeadingKind(h.proposedKind)) return fail(`Lex has no proposal waiting on “${h.name}”. Nothing was changed.`)
  const kind = accept ? h.proposedKind : h.kind
  await prisma.actionHeading.update({ where: { id: headingId }, data: { ...(accept ? { kind: h.proposedKind } : {}), proposedKind: null, proposedKindReason: null } })
  return { ok: true, data: { name: h.name, kind } }
}

/** The words for a proposal beside a heading. */
export const proposalWords = (kind: string) => (isHeadingKind(kind) ? HEADING_KIND_WORD[kind] : kind)
