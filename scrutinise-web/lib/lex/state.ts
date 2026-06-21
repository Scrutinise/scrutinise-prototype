// ─────────────────────────────────────────────────────────────────────────────
// Canonical state assembler (§3.3). Reads the server-authoritative stores and
// returns the ONE object the panels render. `completedCount`/`total` are NOT
// here — they are derived on the client from the fields array (never stored).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { initializeFieldStates } from './field-machine'
import {
  ORIENTATION_FIELDS,
  LOCKED_PAGES,
  type CanonicalState,
  type CanonicalField,
  type CanonicalPage,
  type FieldStatus,
  type SearchResult,
} from './page1-config'

const TERMINAL: FieldStatus[] = ['ACCEPTED', 'SKIPPED']

function decodeValue(fieldKey: string, raw: string | null): unknown {
  if (raw == null) return null
  const def = ORIENTATION_FIELDS.find((f) => f.key === fieldKey)
  if (def?.type === 'structured') {
    try { return JSON.parse(raw) } catch { return raw }
  }
  return raw
}

export async function computeCanonicalState(ideaId: string): Promise<CanonicalState | null> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: {
      id: true,
      creatorId: true,
      legislationRefs: true,
      creator: {
        select: { aboutYouNarrative: true, experienceLevel: true, profileSlots: true },
      },
    },
  })
  if (!idea) return null

  // Lazily ensure the field rows exist (idempotent).
  await initializeFieldStates(ideaId, idea.creatorId)

  const rows = await prisma.ideaFieldState.findMany({
    where: { ideaId },
    select: { fieldKey: true, status: true, value: true, proposal: true },
  })
  const byKey = new Map(rows.map((r) => [r.fieldKey, r]))

  const fields: CanonicalField[] = ORIENTATION_FIELDS.map((def) => {
    const row = byKey.get(def.key)
    const status = (row?.status ?? 'EMPTY') as FieldStatus
    const proposal =
      status === 'AWAITING_CONFIRMATION' && row?.proposal
        ? (row.proposal as { value: unknown; rationale?: string | null })
        : null
    return {
      key: def.key,
      label: def.label,
      type: def.type,
      status,
      value: decodeValue(def.key, row?.value ?? null),
      proposal: proposal ? { value: proposal.value, rationale: proposal.rationale ?? undefined } : null,
    }
  })

  // currentField = first non-terminal field in sequence.
  const current = fields.find((f) => !TERMINAL.includes(f.status)) ?? null
  const orientationComplete = current === null

  const orientationPage: CanonicalPage = {
    key: 'ORIENTATION',
    label: 'Getting started',
    status: orientationComplete ? 'complete' : 'active',
    fields,
  }

  // When Orientation completes, the next page (Diagnosis) unlocks to 'active'
  // (its fields are built in Sprint 2); the rest stay locked.
  const lockedPages: CanonicalPage[] = LOCKED_PAGES.map((p, i) => ({
    key: p.key,
    label: p.label,
    status: orientationComplete && i === 0 ? 'active' : 'locked',
    fields: [],
  }))

  // Initial Background document
  const doc = await prisma.document.findUnique({
    where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } },
    select: { id: true, status: true, summary: true, body: true },
  })

  const legislationRefs = (idea.legislationRefs as unknown as SearchResult[] | null) ?? []

  return {
    ideaId: idea.id,
    stage: orientationComplete ? 'DIAGNOSIS' : 'ORIENTATION',
    currentField: current ? { key: current.key, status: current.status } : null,
    pages: [orientationPage, ...lockedPages],
    userProfile: {
      aboutYou: idea.creator.aboutYouNarrative ?? null,
      experienceLevel: idea.creator.experienceLevel ?? null,
      slots: (idea.creator.profileSlots as Record<string, unknown>) ?? {},
    },
    legislationRefs,
    initialBackground: doc
      ? {
          documentId: doc.id,
          status: doc.status === 'ready' ? 'ready' : 'pending',
          summary: doc.summary ?? null,
          body: doc.body ?? null,
        }
      : null,
  }
}
