// ─────────────────────────────────────────────────────────────────────────────
// Canonical state assembler (§3.3). Reads the server-authoritative stores and
// returns the ONE object the panels render. `completedCount`/`total` are NOT
// here — they are derived on the client from the fields array (never stored).
//
// Multi-page (Sprint 2): the active page is the Idea.lexPage pointer. `currentField`
// is the first non-terminal field OF THE ACTIVE PAGE — so Diagnosis fields don't
// surface until the user advances into Page 2 ("Continue to Diagnosis").
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { initializeFieldStates } from './field-machine'
import {
  PAGE_SEQUENCE,
  LOCKED_PAGES,
  pageSeqIndex,
  fieldDef,
  type CanonicalState,
  type CanonicalField,
  type CanonicalPage,
  type CanonicalCause,
  type CanonicalPolicyOption,
  type CanonicalAction,
  type CanonicalBenchmark,
  type FieldStatus,
  type SearchResult,
} from './page1-config'

const TERMINAL: FieldStatus[] = ['ACCEPTED', 'SKIPPED']

function decodeValue(fieldKey: string, raw: string | null): unknown {
  if (raw == null) return null
  const def = fieldDef(fieldKey)
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
      lexPage: true,
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

  const toCanonicalField = (def: (typeof PAGE_SEQUENCE)[number]['fields'][number]): CanonicalField => {
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
  }

  const isTerminal = (key: string) => TERMINAL.includes((byKey.get(key)?.status ?? 'EMPTY') as FieldStatus)

  // The active page = the lexPage pointer (default ORIENTATION).
  const lexPage = idea.lexPage ?? 'ORIENTATION'
  const activeIndex = Math.max(0, pageSeqIndex(lexPage))

  const pages: CanonicalPage[] = PAGE_SEQUENCE.map((page, i) => {
    const fields = page.fields.map(toCanonicalField)
    const allTerminal = fields.every((f) => TERMINAL.includes(f.status))
    const status: CanonicalPage['status'] =
      i < activeIndex ? 'complete' : i === activeIndex ? (allTerminal ? 'complete' : 'active') : 'locked'
    return { key: page.key, label: page.label, status, fields }
  })

  // currentField = first non-terminal field of the ACTIVE page (or null when complete).
  const activePage = PAGE_SEQUENCE[activeIndex]
  const currentDef = activePage.fields.find((f) => !isTerminal(f.key)) ?? null
  const current = currentDef
    ? { key: currentDef.key, status: (byKey.get(currentDef.key)?.status ?? 'EMPTY') as FieldStatus }
    : null

  // nextPage drives the "Continue to …" CTA: the active page is complete AND there is
  // a further BUILT page the user hasn't advanced into yet.
  const activeComplete = current === null
  const hasNextBuilt = activeIndex + 1 < PAGE_SEQUENCE.length
  const nextPage =
    activeComplete && hasNextBuilt
      ? { key: PAGE_SEQUENCE[activeIndex + 1].key, label: PAGE_SEQUENCE[activeIndex + 1].label }
      : null

  // Locked placeholder pages (not yet built) so the user can see the road ahead.
  const lockedPages: CanonicalPage[] = LOCKED_PAGES.map((p) => ({
    key: p.key,
    label: p.label,
    status: 'locked' as const,
    fields: [],
  }))

  // Page 2 causes-loop records.
  const causeRows = await prisma.diagnosisCause.findMany({
    where: { ideaId },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true, cause: true, whyPersisted: true, evidence: true, isRootCause: true,
      classification: true, parentCauseId: true, source: true,
    },
  })
  const diagnosisCauses: CanonicalCause[] = causeRows.map((c) => ({
    id: c.id,
    cause: c.cause,
    whyPersisted: c.whyPersisted,
    evidence: c.evidence,
    isRootCause: c.isRootCause,
    classification: c.classification as CanonicalCause['classification'],
    parentCauseId: c.parentCauseId,
    source: c.source as 'USER' | 'LEX_CORPUS',
  }))

  // Page 3 policy options.
  const optionRows = await prisma.policyOption.findMany({
    where: { ideaId },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true, approach: true, mechanismTypes: true, targetCauseIds: true,
      caseFor: true, caseAgainst: true, status: true, ruleOutReason: true, source: true,
    },
  })
  const policyOptions: CanonicalPolicyOption[] = optionRows.map((o) => ({
    id: o.id,
    approach: o.approach,
    mechanismTypes: o.mechanismTypes,
    targetCauseIds: o.targetCauseIds,
    caseFor: o.caseFor,
    caseAgainst: o.caseAgainst,
    status: o.status as CanonicalPolicyOption['status'],
    ruleOutReason: o.ruleOutReason,
    source: o.source as 'USER' | 'LEX',
  }))

  // Page 4 actions.
  const actionRows = await prisma.lexCoherentAction.findMany({
    where: { ideaId },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
  })
  const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)
  const range = (v: unknown) => {
    const r = v as Record<string, unknown> | null
    return r
      ? {
          low: num(r.low), high: num(r.high),
          unit: typeof r.unit === 'string' ? r.unit : null,
          basis: typeof r.basis === 'string' ? r.basis : null,
          benchmarkId: typeof r.benchmarkId === 'string' ? r.benchmarkId : null,
          userOverride: r.userOverride === true,
        }
      : null
  }
  const actions: CanonicalAction[] = actionRows.map((a) => ({
    id: a.id,
    practicalStep: a.practicalStep,
    mechanismType: a.mechanismType,
    whoImplements: a.whoImplements,
    targetOrganisation: a.targetOrganisation,
    wording: a.wording,
    benefits: (a.benefits as CanonicalAction['benefits']) ?? null,
    implementationCost: range(a.implementationCost),
    enforcementCost: range(a.enforcementCost),
    regulatoryFriction: range(a.regulatoryFriction),
    source: a.source as 'USER' | 'LEX',
  }))

  // Costing benchmarks (§18.3) — only load once we're on Page 4 (cheap otherwise to skip).
  let benchmarks: CanonicalBenchmark[] = []
  if ((idea.lexPage ?? 'ORIENTATION') === 'COHERENT_ACTIONS') {
    const bRows = await prisma.costBenchmark.findMany({ orderBy: [{ domain: 'asc' }, { metric: 'asc' }] })
    benchmarks = bRows.map((b) => ({
      id: b.id, domain: b.domain, metric: b.metric, unit: b.unit,
      low: b.low != null ? Number(b.low) : null,
      high: b.high != null ? Number(b.high) : null,
      source: b.source, sourceUrl: b.sourceUrl, year: b.year, method: b.method, notes: b.notes,
    }))
  }

  // Initial Background document
  const doc = await prisma.document.findUnique({
    where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } },
    select: { id: true, status: true, summary: true, body: true },
  })

  const legislationRefs = (idea.legislationRefs as unknown as SearchResult[] | null) ?? []

  return {
    ideaId: idea.id,
    stage: lexPage,
    nextPage,
    currentField: current,
    pages: [...pages, ...lockedPages],
    diagnosisCauses,
    policyOptions,
    actions,
    benchmarks,
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
