// ─────────────────────────────────────────────────────────────────────────────
// 25-D §2a / §20.2.1 — A SOURCE THE USER SET ASIDE STAYS IN THE RECORD, EXCLUDED.
//
// ⚠⚠ THE RULE, AND IT IS THE WHOLE POINT: **EXCLUDED, NEVER DELETED.** Showing what was
// considered and rejected — with the reason — is the strongest thing an evidence annex
// does. A proposal whose annex says "we looked at the 2019 impact assessment and set it
// aside because it prices a different population" survives a question that a proposal
// which silently dropped it does not. Deleting the row would turn a strength into an
// absence nobody can see, and would make the two indistinguishable from outside.
//
// ⚠ AND IT IS NOT A FLAG ON THE SOURCE. Corpus sources live in JSON columns that RETRIEVAL
// writes: `Idea.legislationRefs`, the per-stage search store. A decision recorded there is
// destroyed the next time the search runs — which it does, on every stage transition and
// every retry. The decision has to outlive the retrieval that produced the source, so it
// is its own row, keyed by the source id every surface already uses.
//
// ⚠⚠ AND THE ROW IS SELF-SUFFICIENT — title, citation, url, type, copied at decision time.
// This is the part that is easy to leave out and expensive to add later. A source can be
// excluded today and gone from retrieval tomorrow: rankings move, collections are
// reindexed, a stage search re-runs with different terms. Without its own copy, the
// Evidence Pack's "what was considered and set aside" degrades into a list of ids nobody
// can resolve — and the feature fails precisely in the case it exists for, which is the
// source somebody went looking for and could not find.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import type { SearchResult } from './page1-config'

/**
 * 25-L §3d — the three things a user can decide about a source.
 *
 * ⚠ `PRIORITY` IMPLIES INCLUDED. Everything not excluded is in the annex; priority says
 * additionally that it belongs in the document itself. Anywhere that asks "is this in the
 * evidence?" must therefore test `!== 'EXCLUDED'`, never `=== 'INCLUDED'` — the second
 * would silently drop the sources the user rated highest, which is the worst available
 * direction for that bug to break in.
 */
export type SourceDecisionStatus = 'INCLUDED' | 'EXCLUDED' | 'PRIORITY'

/** In the evidence at all — see the note above about why this is a helper and not `===`. */
export function isInEvidence(status: SourceDecisionStatus): boolean {
  return status !== 'EXCLUDED'
}

/** In the proposal document itself, not only the annex. */
export function isPrioritySource(status: SourceDecisionStatus): boolean {
  return status === 'PRIORITY'
}

export interface SourceDecision {
  sourceKey: string
  status: SourceDecisionStatus
  /** Required when EXCLUDED. Never null on an excluded row that this module wrote. */
  reason: string | null
  annotation: string | null
  /** The source's own details, copied at decision time — see the header. */
  title: string | null
  citation: string | null
  url: string | null
  sourceType: string | null
  decidedAt: string
}

/** Thrown rather than silently stored — an exclusion with no reason is an unaccountable veto. */
export class MissingExclusionReason extends Error {
  constructor() {
    super('An excluded source must carry a reason. What was considered and set aside is part of the record.')
    this.name = 'MissingExclusionReason'
  }
}

export async function readSourceDecisions(ideaId: string): Promise<SourceDecision[]> {
  const rows = await prisma.ideaSourceDecision.findMany({
    where: { ideaId },
    orderBy: { decidedAt: 'desc' },
  })
  return rows.map((r) => ({
    sourceKey: r.sourceKey,
    status: r.status as SourceDecisionStatus,
    reason: r.reason,
    annotation: r.annotation,
    title: r.title,
    citation: r.citation,
    url: r.url,
    sourceType: r.sourceType,
    decidedAt: r.decidedAt.toISOString(),
  }))
}

/** The excluded keys, as a set — the shape every consumer actually wants. */
export async function readExcludedKeys(ideaId: string): Promise<Set<string>> {
  const rows = await prisma.ideaSourceDecision.findMany({
    where: { ideaId, status: 'EXCLUDED' },
    select: { sourceKey: true },
  })
  return new Set(rows.map((r) => r.sourceKey))
}

export interface DecideInput {
  sourceKey: string
  status: SourceDecisionStatus
  reason?: string | null
  annotation?: string | null
  /** The source as it stands right now, so the row can stand alone later. */
  source?: Pick<SearchResult, 'title' | 'citation' | 'url' | 'type'> | null
}

/**
 * Record what the user decided about one source.
 *
 * ⚠ AN EXCLUSION WITHOUT A REASON IS REFUSED. Not defaulted to "no reason given", not
 * stored with a null — refused, at the point of writing. The moment an empty reason is
 * storable, the Evidence Pack starts printing exclusions nobody can account for, and the
 * annex's credibility rests on every line in it being answerable.
 *
 * ⚠ RE-INCLUDING KEEPS THE REASON. `reason` is not cleared when a source goes back to
 * INCLUDED: the user changed their mind, and why they had set it aside is part of the
 * record of that. Only an explicit new reason overwrites it.
 */
export async function decideSource(
  ideaId: string, userId: string, input: DecideInput,
): Promise<SourceDecision> {
  const reason = input.reason?.trim() || null
  if (input.status === 'EXCLUDED' && !reason) {
    const existing = await prisma.ideaSourceDecision.findUnique({
      where: { ideaId_sourceKey: { ideaId, sourceKey: input.sourceKey } },
      select: { reason: true },
    })
    if (!existing?.reason?.trim()) throw new MissingExclusionReason()
  }

  const details = input.source
    ? {
        title: input.source.title?.trim() || null,
        citation: input.source.citation?.trim() || null,
        url: input.source.url?.trim() || null,
        sourceType: input.source.type ?? null,
      }
    : {}

  const row = await prisma.ideaSourceDecision.upsert({
    where: { ideaId_sourceKey: { ideaId, sourceKey: input.sourceKey } },
    create: {
      ideaId,
      sourceKey: input.sourceKey,
      status: input.status,
      reason,
      annotation: input.annotation?.trim() || null,
      decidedBy: userId,
      ...details,
    },
    update: {
      status: input.status,
      // ⚠ `?? undefined`, NOT `?? null`. Prisma treats null as "write null" and undefined as
      // "leave it". Passing null here would erase the stated reason every time the user
      // re-included a source, which is the record of the decision they are changing.
      ...(reason ? { reason } : {}),
      ...(input.annotation !== undefined ? { annotation: input.annotation?.trim() || null } : {}),
      decidedBy: userId,
      decidedAt: new Date(),
      ...details,
    },
  })

  return {
    sourceKey: row.sourceKey,
    status: row.status as SourceDecisionStatus,
    reason: row.reason,
    annotation: row.annotation,
    title: row.title,
    citation: row.citation,
    url: row.url,
    sourceType: row.sourceType,
    decidedAt: row.decidedAt.toISOString(),
  }
}

/**
 * Apply decisions to a retrieved list.
 *
 * ⚠ IT RETURNS BOTH HALVES. A filter that silently dropped the excluded ones would make
 * the panel agree with the Evidence Pack about what is in and disagree about what was
 * considered — and it is the second list the user is being asked to stand behind.
 */
export function partitionByDecision<T extends { id: string }>(
  items: T[], decisions: Map<string, SourceDecision>,
): { included: T[]; excluded: Array<T & { exclusionReason: string | null }> } {
  const included: T[] = []
  const excluded: Array<T & { exclusionReason: string | null }> = []
  for (const it of items) {
    const d = decisions.get(it.id)
    if (d?.status === 'EXCLUDED') excluded.push({ ...it, exclusionReason: d.reason })
    else included.push(it)
  }
  return { included, excluded }
}

export function decisionMap(decisions: SourceDecision[]): Map<string, SourceDecision> {
  return new Map(decisions.map((d) => [d.sourceKey, d]))
}
