// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-X X3 (decision 311) — WHAT A REVIEW READS: THE ACCEPTED DRAFT WHERE ONE EXISTS, ELSE THE STATEMENT. Server half; ONE reader, used by
// the four-model digest (action-digest.ts), the policy test (action-structure.ts testAgainstPolicy) and the Deepening's review runner, so the
// three cannot disagree about which text an action "is". The words are in accepted-drafts-pure.ts.
//
//   The draft is the action's INSTRUMENT (draftKindsOf: never a companion — a collision report, explanatory note or schedule is read beside a
//   draft, not as it). "Accepted" is the version the owner accepted (`acceptedV`): a document accepted at v2 and edited since to v3 is read at
//   v2, and the reader is told a later version exists and is not accepted (26-V1b 263 keeps acceptedV on a DRAFTED document for exactly this).
//
// ⚠ The whole text, never a clip (CCh-Lex 7 Nov (2), 2): a caller that must fit a budget cuts it ITSELF and says so.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { dNumber, type DocumentKind } from './action-documents-pure'
import { draftKindsOf } from './action-progress-pure'
import type { ReadMark } from './accepted-drafts-pure'

export * from './accepted-drafts-pure'

export interface AcceptedDraft {
  actionId: string
  documentId: string
  /** D.207.2 */
  d: string
  kind: DocumentKind
  /** The accepted version, and its text in full. */
  v: number
  body: string
  /** A later version that is NOT accepted, when the document has moved on since; null when the accepted version is the latest. */
  newerV: number | null
}

export const markOf = (draft: AcceptedDraft | undefined, statement: string): ReadMark =>
  draft ? { what: 'draft', d: draft.d, kind: draft.kind, v: draft.v, newerV: draft.newerV, chars: draft.body.length } : { what: 'statement', chars: statement.length }

/** The accepted draft of each live action on the idea that has one (optionally only `actionIds`). An action with none is absent from the map. */
export async function acceptedDrafts(ideaId: string, actionIds?: string[]): Promise<Map<string, AcceptedDraft>> {
  const docs = await prisma.actionDocument.findMany({
    where: { ideaId, status: { not: 'SUPERSEDED' }, acceptedV: { not: null }, ...(actionIds ? { actionId: { in: actionIds } } : {}) },
    include: { versions: { where: { role: 'VERSION' }, orderBy: { v: 'asc' }, select: { v: true, body: true } } },
    orderBy: { number: 'asc' },
  })
  const nums = new Map((await prisma.lexCoherentAction.findMany({ where: { id: { in: [...new Set(docs.map((d) => d.actionId))] }, status: 'LIVE' }, select: { id: true, number: true } })).map((a) => [a.id, a.number]))
  const byAction = new Map<string, typeof docs>()
  for (const d of docs) if (nums.has(d.actionId)) byAction.set(d.actionId, [...(byAction.get(d.actionId) ?? []), d])
  const out = new Map<string, AcceptedDraft>()
  for (const [actionId, list] of byAction) {
    // the instrument: of the kinds accepted, the draft's kinds (never a companion); the lowest-numbered document of the first such kind
    const kinds = draftKindsOf([...new Set(list.map((d) => d.kind as DocumentKind))])
    const doc = list.find((d) => kinds.includes(d.kind as DocumentKind))
    const acc = doc?.versions.find((x) => x.v === doc.acceptedV)
    if (!doc || !acc) continue
    const last = doc.versions.at(-1)
    out.set(actionId, {
      actionId, documentId: doc.id, d: dNumber(nums.get(actionId) ?? null, doc.number), kind: doc.kind as DocumentKind, v: acc.v, body: acc.body,
      newerV: last && last.v > acc.v ? last.v : null,
    })
  }
  return out
}
