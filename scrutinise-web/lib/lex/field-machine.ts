// ─────────────────────────────────────────────────────────────────────────────
// Field state machine (§3.2) — SERVER-AUTHORITATIVE writes only.
//
// IdeaFieldState is the single source of truth for "where we are". Lex and the
// frontend never write it. Every accepted value is also mirrored onto its
// canonical column (Idea/User) per the §3.4 write-ownership table.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import {
  ALL_FIELDS,
  EXPERIENCE_LEVEL_MAP,
  IDEA_SLOT_KEYS,
  USER_SLOT_KEYS,
  STRUCTURED_KEYS,
  fieldDef,
  pageSeqIndex,
  PAGE_SEQUENCE,
  type FieldStatus,
} from './page1-config'
import { buildInitialBackground } from './search-stub'
import { runSearch } from './search-gateway'

// Prisma enum values mirror our string union.
type DbStatus = 'EMPTY' | 'AWAITING_CONFIRMATION' | 'ACCEPTED' | 'SKIPPED'

/** Create the EMPTY field rows for a new idea (idempotent). A returning user's
 *  `aboutYou` profile box is pre-accepted as a check-back (§6.3). */
export async function initializeFieldStates(ideaId: string, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aboutYouNarrative: true },
  })
  const existing = await prisma.ideaFieldState.findMany({
    where: { ideaId },
    select: { fieldKey: true },
  })
  const have = new Set(existing.map((r) => r.fieldKey))

  // Create rows for every field across all built pages (idempotent). Diagnosis rows
  // sit EMPTY until the user advances into that page; currentField is scoped to the
  // active (lexPage) page in computeCanonicalState, so they don't surface early.
  const toCreate = ALL_FIELDS.filter((f) => !have.has(f.key)).map((f) => {
    const isProfileCheckBack = f.key === 'aboutYou' && !!user?.aboutYouNarrative
    return {
      ideaId,
      fieldKey: f.key,
      status: (isProfileCheckBack ? 'ACCEPTED' : 'EMPTY') as DbStatus,
      value: isProfileCheckBack ? user!.aboutYouNarrative : null,
    }
  })
  if (toCreate.length) {
    // skipDuplicates makes this race-safe against concurrent first requests.
    await prisma.ideaFieldState.createMany({ data: toCreate, skipDuplicates: true })
  }
}

// ── Canonical mirror writes (§3.4) ───────────────────────────────────────────
async function mirrorValue(ideaId: string, userId: string, fieldKey: string, value: unknown) {
  const def = fieldDef(fieldKey)
  if (!def) return
  if (def.scope === 'user') {
    if (fieldKey === 'aboutYou') {
      await prisma.user.update({
        where: { id: userId },
        data: { aboutYouNarrative: value == null ? null : String(value) },
      })
    }
    return
  }
  // idea-scoped
  switch (fieldKey) {
    // ── Page 1 ──
    case 'ideaNarrative':
      await prisma.idea.update({ where: { id: ideaId }, data: { ideaNarrative: String(value) } })
      break
    case 'youAndIdeaNarrative':
      await prisma.idea.update({ where: { id: ideaId }, data: { youAndIdeaNarrative: String(value) } })
      break
    case 'title':
      await prisma.idea.update({ where: { id: ideaId }, data: { title: String(value) } })
      break
    case 'keywords': {
      const arr = Array.isArray(value) ? value.map(String) : []
      await prisma.idea.update({ where: { id: ideaId }, data: { keywords: arr } })
      break
    }
    // ── Page 2 (Diagnosis) ──
    case 'challenge':
      await prisma.idea.update({ where: { id: ideaId }, data: { challenge: String(value) } })
      break
    case 'pivotalObstacle':
      await prisma.idea.update({ where: { id: ideaId }, data: { pivotalObstacle: String(value) } })
      break
    case 'summaryDiagnosis':
      await prisma.idea.update({ where: { id: ideaId }, data: { summaryDiagnosis: String(value) } })
      break
    case 'whoAffectedImpactCost':
      await prisma.idea.update({
        where: { id: ideaId },
        data: { whoAffectedImpactCost: asJson(value) as never },
      })
      break
    case 'legalLandscape':
      await prisma.idea.update({
        where: { id: ideaId },
        data: { legalLandscape: asJson(value) as never },
      })
      break
    case 'rootCause':
      // value is the chosen cause text; the DiagnosisCause.isRootCause flag is set in
      // setRootCause (the route). Here we mirror the text onto the legacy column.
      await prisma.idea.update({ where: { id: ideaId }, data: { rootCause: String(value) } })
      break
    // ── Page 3 (Guiding Policy) ──
    case 'chosenApproach':
      // The CHOSEN PolicyOption's status is set in choosePolicyApproach (the route);
      // here we mirror the approach text onto the Idea.
      await prisma.idea.update({ where: { id: ideaId }, data: { chosenApproach: String(value) } })
      break
    case 'whatItRulesOut':
      await prisma.idea.update({ where: { id: ideaId }, data: { whatItRulesOut: String(value) } })
      break
    case 'leverage':
      await prisma.idea.update({ where: { id: ideaId }, data: { leverage: String(value) } })
      break
    case 'anticipatedResponses':
      await prisma.idea.update({ where: { id: ideaId }, data: { anticipatedResponses: asJson(value) as never } })
      break
    case 'conditionsForSuccess':
      await prisma.idea.update({ where: { id: ideaId }, data: { conditionsForSuccessLex: String(value) } })
      break
    case 'summaryGuidingPolicy':
      await prisma.idea.update({ where: { id: ideaId }, data: { summaryGuidingPolicy: String(value) } })
      break
    // ── Page 4 (Coherent Actions) ──
    case 'coherenceCheck':
      await prisma.idea.update({ where: { id: ideaId }, data: { coherenceCheck: String(value) } })
      break
    case 'costSummary':
      // The accepted value is a plain-English summary; keep the structured aggregate
      // (computed at seed time) alongside it under { summary }.
      await prisma.idea.update({ where: { id: ideaId }, data: { costSummary: { summary: String(value) } as never } })
      break
    case 'summaryCoherentActions':
      await prisma.idea.update({ where: { id: ideaId }, data: { summaryCoherentActions: String(value) } })
      break
  }
}

/** Coerce an accepted structured value (object, or JSON string) into a plain object. */
function asJson(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch { /* fall through */ }
  }
  return {}
}

/** Serialise a field value for storage in IdeaFieldState.value (TEXT). */
function encode(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value)
}

async function setStatus(
  ideaId: string,
  fieldKey: string,
  status: DbStatus,
  data: { value?: string | null; proposal?: unknown },
) {
  await prisma.ideaFieldState.upsert({
    where: { ideaId_fieldKey: { ideaId, fieldKey } },
    create: {
      ideaId,
      fieldKey,
      status,
      value: data.value ?? null,
      proposal: (data.proposal ?? undefined) as never,
    },
    update: {
      status,
      ...(data.value !== undefined ? { value: data.value } : {}),
      proposal: (data.proposal ?? null) as never,
    },
  })
}

// ── Transitions ──────────────────────────────────────────────────────────────

/** A box (narrative) field the user authored directly → ACCEPTED. */
export async function submitBox(ideaId: string, userId: string, fieldKey: string, value: string) {
  await setStatus(ideaId, fieldKey, 'ACCEPTED', { value, proposal: null })
  await mirrorValue(ideaId, userId, fieldKey, value)
}

/** Lex proposed a value → AWAITING_CONFIRMATION (the confirmation card renders). */
export async function setProposal(
  ideaId: string,
  fieldKey: string,
  proposal: { value: unknown; rationale?: string },
) {
  await setStatus(ideaId, fieldKey, 'AWAITING_CONFIRMATION', {
    proposal: { value: proposal.value, rationale: proposal.rationale ?? null },
  })
}

/** User accepts (optionally editing) → ACCEPTED. Returns whether keywords fired. */
export async function acceptField(
  ideaId: string,
  userId: string,
  fieldKey: string,
  editedValue?: unknown,
): Promise<void> {
  let value = editedValue
  if (value === undefined) {
    const row = await prisma.ideaFieldState.findUnique({
      where: { ideaId_fieldKey: { ideaId, fieldKey } },
      select: { proposal: true, value: true },
    })
    const prop = row?.proposal as { value?: unknown } | null
    value = prop?.value ?? row?.value ?? null
  }
  await setStatus(ideaId, fieldKey, 'ACCEPTED', { value: encode(value), proposal: null })
  await mirrorValue(ideaId, userId, fieldKey, value)
}

/** User declines → SKIPPED. */
export async function skipField(ideaId: string, fieldKey: string) {
  await setStatus(ideaId, fieldKey, 'SKIPPED', { proposal: null })
}

/** User reopens an accepted field to change it → AWAITING_CONFIRMATION (§3.2). */
export async function reopenField(ideaId: string, fieldKey: string) {
  const row = await prisma.ideaFieldState.findUnique({
    where: { ideaId_fieldKey: { ideaId, fieldKey } },
    select: { value: true },
  })
  let current: unknown = row?.value ?? null
  if (fieldDef(fieldKey)?.type === 'structured' && typeof current === 'string') {
    try { current = JSON.parse(current) } catch { /* keep string */ }
  }
  await setStatus(ideaId, fieldKey, 'AWAITING_CONFIRMATION', {
    proposal: { value: current, rationale: null },
  })
}

// ── Lex-extracted slots (§4 `extracted`) — stored, never carded ───────────────
export async function storeExtracted(
  ideaId: string,
  userId: string,
  extracted: Record<string, unknown>,
) {
  const ideaSlots: Record<string, unknown> = {}
  const userSlots: Record<string, unknown> = {}
  let experienceLevel: string | undefined

  for (const [k, v] of Object.entries(extracted)) {
    if (v == null || v === '') continue
    if (k === 'experienceLevel') {
      experienceLevel = EXPERIENCE_LEVEL_MAP[String(v).toLowerCase()]
      continue
    }
    if ((IDEA_SLOT_KEYS as readonly string[]).includes(k)) ideaSlots[k] = v
    else if ((USER_SLOT_KEYS as readonly string[]).includes(k)) userSlots[k] = v
  }

  if (Object.keys(ideaSlots).length) {
    const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { ideaSlots: true } })
    const merged = { ...((idea?.ideaSlots as object) ?? {}), ...ideaSlots }
    await prisma.idea.update({ where: { id: ideaId }, data: { ideaSlots: merged as never } })
  }
  if (Object.keys(userSlots).length || experienceLevel) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { profileSlots: true } })
    const merged = { ...((user?.profileSlots as object) ?? {}), ...userSlots }
    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(Object.keys(userSlots).length ? { profileSlots: merged as never } : {}),
        ...(experienceLevel ? { experienceLevel: experienceLevel as never } : {}),
      },
    })
  }
}

// ── Search trigger (§8.4): deterministic, platform-owned ─────────────────────
/**
 * Fire the search through the gateway (§14) and write legislationRefs + Initial Background.
 *
 * §19-C Task 1a — a FAILED search is now recorded as failed. It writes no references
 * and no briefing prose, and the document is marked `failed` so the panel can offer a
 * Retry instead of showing invented law. Previously the stub fallback produced a
 * briefing that read "The law in Data protection … is anchored by Road Traffic Act 1988".
 */
export async function fireSearchTrigger(ideaId: string): Promise<{ ok: boolean; results: number }> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { keywords: true, ideaNarrative: true, youAndIdeaNarrative: true },
  })
  const keywords = idea?.keywords ?? []

  // All search goes through the ONE gateway. Intent BACKGROUND_BRIEFING gets stage-3
  // expansion (capability flag) applied to the FTS query only; ideaContext steers
  // that expansion but never enters the briefing text (grounding guardrail §3).
  const ideaContext = [idea?.ideaNarrative, idea?.youAndIdeaNarrative]
    .filter(Boolean).join(' ').slice(0, 500)
  const { grouped: refs, failed, failureReason } = await runSearch({
    keywords,
    intent: 'BACKGROUND_BRIEFING',
    ideaContext,
    limit: 12,
  })

  if (failed) {
    // Honest empty state. No references, no prose, and a status the panel renders as
    // "the corpus search didn't complete — Retry".
    console.error('[lex-diag] briefing search FAILED — storing honest empty state', { ideaId, failureReason })
    await prisma.idea.update({ where: { id: ideaId }, data: { legislationRefs: [] as never } })
    await prisma.document.upsert({
      where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } },
      create: { ideaId, kind: 'INITIAL_BACKGROUND', status: 'failed', summary: null, body: null },
      update: { status: 'failed', summary: null, body: null },
    })
    return { ok: false, results: 0 }
  }

  // Briefing prose uses the user's original keywords (not the expanded set) — ground truth only.
  const { summary, body } = buildInitialBackground(keywords, refs)

  await prisma.idea.update({
    where: { id: ideaId },
    data: { legislationRefs: refs as never },
  })
  await prisma.document.upsert({
    where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } },
    create: { ideaId, kind: 'INITIAL_BACKGROUND', status: 'ready', summary, body },
    update: { status: 'ready', summary, body },
  })
  return { ok: true, results: refs.length }
}

// ── Page advance (§14 / Sprint 2 Task 4): explicit forward move between Lex pages ──
/** Advance the Lex page pointer forward by one, but only from a COMPLETE page to the
 *  immediately-next built page. Returns the new page key, or null if not allowed. */
export async function advanceLexPage(ideaId: string): Promise<string | null> {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { lexPage: true } })
  const currentKey = idea?.lexPage ?? 'ORIENTATION'
  const idx = pageSeqIndex(currentKey)
  if (idx < 0 || idx + 1 >= PAGE_SEQUENCE.length) return null

  // Guard: the current page must be complete (all its fields terminal).
  const currentPage = PAGE_SEQUENCE[idx]
  const rows = await prisma.ideaFieldState.findMany({
    where: { ideaId, fieldKey: { in: currentPage.fields.map((f) => f.key) } },
    select: { fieldKey: true, status: true },
  })
  const byKey = new Map(rows.map((r) => [r.fieldKey, r.status as DbStatus]))
  const allTerminal = currentPage.fields.every((f) => {
    const s = byKey.get(f.key) ?? 'EMPTY'
    return s === 'ACCEPTED' || s === 'SKIPPED'
  })
  if (!allTerminal) return null

  const next = PAGE_SEQUENCE[idx + 1].key
  await prisma.idea.update({ where: { id: ideaId }, data: { lexPage: next } })
  return next
}

// ── Page 2 carry-forward (§7.1): seed whoAffectedImpactCost from Page 1, don't re-ask ──
/** Build a whoAffectedImpactCost seed object from Page 1's volunteered impact/cost. */
export async function buildWhoAffectedSeed(ideaId: string): Promise<Record<string, string>> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { whoAffected: true },
  })
  // Page 1 Box 1 volunteers rough who/impact/cost; only `whoAffected` has a canonical
  // home so far — carry it into affectedGroups. The rest start blank for the user.
  return {
    affectedGroups: (typeof idea?.whoAffected === 'string' && idea.whoAffected) || '',
    impact: '',
    cost: '',
    evidence: '',
  }
}

// ── Causes loop (§7.2) — DiagnosisCause child records ─────────────────────────
type Classification = 'MATERIAL' | 'CONTRIBUTORY' | 'UNASSESSED'

export interface CauseInput {
  cause: string
  whyPersisted?: string | null
  evidence?: string | null
  source?: 'USER' | 'LEX_CORPUS'
  /** §16.2 causal tree — the parent cause id, or null for a root-level cause. */
  parentCauseId?: string | null
  classification?: Classification
  /** §16.2 Lex chains: candidate sub-causes to create as children of this cause. */
  subCauses?: CauseInput[]
}

export async function listCauses(ideaId: string) {
  return prisma.diagnosisCause.findMany({
    where: { ideaId },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
  })
}

/** Bulk-create candidate causes (e.g. from the CAUSE_SEEDING corpus search). Supports
 *  one level of Lex-proposed chains via `subCauses` (§16.2) — a parent is created, then
 *  its children point at it. */
export async function createCauses(ideaId: string, causes: CauseInput[], source: 'USER' | 'LEX_CORPUS') {
  const clean = causes.filter((c) => c.cause?.trim())
  if (!clean.length) return
  let base = await prisma.diagnosisCause.count({ where: { ideaId } })
  for (const c of clean) {
    const parent = await prisma.diagnosisCause.create({
      data: {
        ideaId,
        cause: c.cause.trim(),
        whyPersisted: c.whyPersisted?.trim() || null,
        evidence: c.evidence?.trim() || null,
        classification: (c.classification ?? 'UNASSESSED') as never,
        parentCauseId: c.parentCauseId ?? null,
        source: (c.source ?? source) as never,
        orderIndex: base++,
      },
    })
    const kids = (c.subCauses ?? []).filter((s) => s.cause?.trim())
    if (kids.length) {
      await prisma.diagnosisCause.createMany({
        data: kids.map((s, i) => ({
          ideaId,
          cause: s.cause.trim(),
          whyPersisted: s.whyPersisted?.trim() || null,
          evidence: s.evidence?.trim() || null,
          classification: (s.classification ?? 'UNASSESSED') as never,
          parentCauseId: parent.id,
          source: (s.source ?? source) as never,
          orderIndex: base + i,
        })),
      })
      base += kids.length
    }
  }
}

export async function addCause(ideaId: string, input: CauseInput) {
  const base = await prisma.diagnosisCause.count({ where: { ideaId } })
  // Scope the parent to this idea so a caller can't graft onto another idea's tree.
  let parentCauseId: string | null = null
  if (input.parentCauseId) {
    const parent = await prisma.diagnosisCause.findFirst({
      where: { id: input.parentCauseId, ideaId }, select: { id: true },
    })
    parentCauseId = parent?.id ?? null
  }
  return prisma.diagnosisCause.create({
    data: {
      ideaId,
      cause: input.cause.trim(),
      whyPersisted: input.whyPersisted?.trim() || null,
      evidence: input.evidence?.trim() || null,
      classification: (input.classification ?? 'UNASSESSED') as never,
      parentCauseId,
      source: (input.source ?? 'USER') as never,
      orderIndex: base,
    },
  })
}

/** Set a cause's material/contributory classification (§16.1). */
export async function classifyCause(ideaId: string, causeId: string, classification: Classification) {
  const row = await prisma.diagnosisCause.findFirst({ where: { id: causeId, ideaId }, select: { id: true } })
  if (!row) return null
  return prisma.diagnosisCause.update({ where: { id: causeId }, data: { classification: classification as never } })
}

export async function updateCause(
  ideaId: string,
  causeId: string,
  patch: { cause?: string; whyPersisted?: string | null; evidence?: string | null },
) {
  // Scope by ideaId so a caller can't edit another idea's cause.
  const row = await prisma.diagnosisCause.findFirst({ where: { id: causeId, ideaId }, select: { id: true } })
  if (!row) return null
  return prisma.diagnosisCause.update({
    where: { id: causeId },
    data: {
      ...(patch.cause !== undefined ? { cause: patch.cause.trim() } : {}),
      ...(patch.whyPersisted !== undefined ? { whyPersisted: patch.whyPersisted?.trim() || null } : {}),
      ...(patch.evidence !== undefined ? { evidence: patch.evidence?.trim() || null } : {}),
    },
  })
}

export async function removeCause(ideaId: string, causeId: string) {
  const row = await prisma.diagnosisCause.findFirst({ where: { id: causeId, ideaId }, select: { id: true, isRootCause: true } })
  if (!row) return
  await prisma.diagnosisCause.delete({ where: { id: causeId } })
  // If the deleted cause was the chosen root cause, clear the rootCause field back to EMPTY.
  if (row.isRootCause) {
    await setStatus(ideaId, 'rootCause', 'EMPTY', { value: null, proposal: null })
    await prisma.idea.update({ where: { id: ideaId }, data: { rootCause: null } })
  }
}

/** Mark exactly one cause as the root cause (§7.1 field 4) and accept the rootCause field. */
export async function setRootCause(ideaId: string, causeId: string): Promise<boolean> {
  const chosen = await prisma.diagnosisCause.findFirst({ where: { id: causeId, ideaId }, select: { id: true, cause: true } })
  if (!chosen) return false
  await prisma.$transaction([
    prisma.diagnosisCause.updateMany({ where: { ideaId }, data: { isRootCause: false } }),
    prisma.diagnosisCause.update({ where: { id: causeId }, data: { isRootCause: true } }),
  ])
  await setStatus(ideaId, 'rootCause', 'ACCEPTED', { value: chosen.cause, proposal: null })
  await prisma.idea.update({ where: { id: ideaId }, data: { rootCause: chosen.cause } })
  return true
}

// ── Page 3 (Guiding Policy) — PolicyOption child records (§17) ─────────────────
export interface PolicyOptionInput {
  approach: string
  caseFor?: string | null
  caseAgainst?: string | null
  mechanismTypes?: string[]
  targetCauseIds?: string[]
  source?: 'USER' | 'LEX'
}

export async function listPolicyOptions(ideaId: string) {
  return prisma.policyOption.findMany({ where: { ideaId }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }] })
}

export async function createPolicyOptions(ideaId: string, options: PolicyOptionInput[], source: 'USER' | 'LEX') {
  const clean = options.filter((o) => o.approach?.trim())
  if (!clean.length) return
  const base = await prisma.policyOption.count({ where: { ideaId } })
  await prisma.policyOption.createMany({
    data: clean.map((o, i) => ({
      ideaId,
      approach: o.approach.trim(),
      caseFor: o.caseFor?.trim() || null,
      caseAgainst: o.caseAgainst?.trim() || null,
      mechanismTypes: o.mechanismTypes ?? [],
      targetCauseIds: o.targetCauseIds ?? [],
      source: (o.source ?? source) as never,
      orderIndex: base + i,
    })),
  })
}

export async function addPolicyOption(ideaId: string, input: PolicyOptionInput) {
  const base = await prisma.policyOption.count({ where: { ideaId } })
  return prisma.policyOption.create({
    data: {
      ideaId,
      approach: input.approach.trim(),
      caseFor: input.caseFor?.trim() || null,
      caseAgainst: input.caseAgainst?.trim() || null,
      mechanismTypes: input.mechanismTypes ?? [],
      targetCauseIds: input.targetCauseIds ?? [],
      source: (input.source ?? 'USER') as never,
      orderIndex: base,
    },
  })
}

export async function updatePolicyOption(
  ideaId: string,
  optionId: string,
  patch: { approach?: string; caseFor?: string | null; caseAgainst?: string | null; mechanismTypes?: string[] },
) {
  const row = await prisma.policyOption.findFirst({ where: { id: optionId, ideaId }, select: { id: true } })
  if (!row) return null
  return prisma.policyOption.update({
    where: { id: optionId },
    data: {
      ...(patch.approach !== undefined ? { approach: patch.approach.trim() } : {}),
      ...(patch.caseFor !== undefined ? { caseFor: patch.caseFor?.trim() || null } : {}),
      ...(patch.caseAgainst !== undefined ? { caseAgainst: patch.caseAgainst?.trim() || null } : {}),
      ...(patch.mechanismTypes !== undefined ? { mechanismTypes: patch.mechanismTypes } : {}),
    },
  })
}

export async function removePolicyOption(ideaId: string, optionId: string) {
  const row = await prisma.policyOption.findFirst({ where: { id: optionId, ideaId }, select: { id: true, status: true } })
  if (!row) return
  await prisma.policyOption.delete({ where: { id: optionId } })
  // If the chosen option was removed, reopen the chosenApproach field.
  if (row.status === 'CHOSEN') {
    await setStatus(ideaId, 'chosenApproach', 'EMPTY', { value: null, proposal: null })
    await prisma.idea.update({ where: { id: ideaId }, data: { chosenApproach: null } })
  }
}

/** Mark one option RULED_OUT with a reason (without committing to a chosen one). */
export async function ruleOutPolicyOption(ideaId: string, optionId: string, reason: string) {
  const row = await prisma.policyOption.findFirst({ where: { id: optionId, ideaId }, select: { id: true } })
  if (!row) return null
  return prisma.policyOption.update({
    where: { id: optionId },
    data: { status: 'RULED_OUT' as never, ruleOutReason: reason.trim() || null },
  })
}

/** Commit to one approach (§17 field 2): CHOSEN for it, RULED_OUT for the rest,
 *  accept the chosenApproach field, and mirror the approach text onto the Idea. */
export async function choosePolicyApproach(ideaId: string, userId: string, optionId: string): Promise<boolean> {
  const chosen = await prisma.policyOption.findFirst({ where: { id: optionId, ideaId }, select: { id: true, approach: true } })
  if (!chosen) return false
  await prisma.$transaction([
    prisma.policyOption.updateMany({ where: { ideaId, id: { not: optionId } }, data: { status: 'RULED_OUT' as never } }),
    prisma.policyOption.update({ where: { id: optionId }, data: { status: 'CHOSEN' as never, ruleOutReason: null } }),
  ])
  await setStatus(ideaId, 'chosenApproach', 'ACCEPTED', { value: chosen.approach, proposal: null })
  await mirrorValue(ideaId, userId, 'chosenApproach', chosen.approach)
  return true
}

// ── Page 4 (Coherent Actions) — LexCoherentAction records + costing (§18) ─────
type CostRangeInput = {
  low?: number | null; high?: number | null; unit?: string | null; basis?: string | null
  benchmarkId?: string | null; userOverride?: boolean; priceYear?: number | null
} | null
export interface ActionInput {
  practicalStep: string
  mechanismType?: string | null
  whoImplements?: string | null
  targetOrganisation?: string | null
  wording?: string | null
  benefits?: Record<string, string> | null
  implementationCost?: CostRangeInput
  enforcementCost?: CostRangeInput
  regulatoryFriction?: CostRangeInput
  source?: 'USER' | 'LEX'
}

export async function listActions(ideaId: string) {
  return prisma.lexCoherentAction.findMany({ where: { ideaId }, orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }] })
}

export async function createActions(ideaId: string, actions: ActionInput[], source: 'USER' | 'LEX') {
  const clean = actions.filter((a) => a.practicalStep?.trim())
  if (!clean.length) return
  const base = await prisma.lexCoherentAction.count({ where: { ideaId } })
  await prisma.lexCoherentAction.createMany({
    data: clean.map((a, i) => ({
      ideaId,
      practicalStep: a.practicalStep.trim(),
      mechanismType: a.mechanismType?.trim() || null,
      whoImplements: a.whoImplements?.trim() || null,
      targetOrganisation: a.targetOrganisation?.trim() || null,
      wording: a.wording?.trim() || null,
      benefits: (a.benefits ?? undefined) as never,
      implementationCost: (a.implementationCost ?? undefined) as never,
      enforcementCost: (a.enforcementCost ?? undefined) as never,
      regulatoryFriction: (a.regulatoryFriction ?? undefined) as never,
      source: (a.source ?? source) as never,
      orderIndex: base + i,
    })),
  })
}

export async function addAction(ideaId: string, input: ActionInput) {
  const base = await prisma.lexCoherentAction.count({ where: { ideaId } })
  return prisma.lexCoherentAction.create({
    data: {
      ideaId,
      practicalStep: input.practicalStep.trim(),
      mechanismType: input.mechanismType?.trim() || null,
      whoImplements: input.whoImplements?.trim() || null,
      targetOrganisation: input.targetOrganisation?.trim() || null,
      wording: input.wording?.trim() || null,
      benefits: (input.benefits ?? undefined) as never,
      implementationCost: (input.implementationCost ?? undefined) as never,
      enforcementCost: (input.enforcementCost ?? undefined) as never,
      regulatoryFriction: (input.regulatoryFriction ?? undefined) as never,
      source: (input.source ?? 'USER') as never,
      orderIndex: base,
    },
  })
}

export async function updateAction(ideaId: string, actionId: string, patch: Partial<ActionInput>) {
  const row = await prisma.lexCoherentAction.findFirst({ where: { id: actionId, ideaId }, select: { id: true } })
  if (!row) return null
  return prisma.lexCoherentAction.update({
    where: { id: actionId },
    data: {
      ...(patch.practicalStep !== undefined ? { practicalStep: patch.practicalStep.trim() } : {}),
      ...(patch.mechanismType !== undefined ? { mechanismType: patch.mechanismType?.trim() || null } : {}),
      ...(patch.whoImplements !== undefined ? { whoImplements: patch.whoImplements?.trim() || null } : {}),
      ...(patch.targetOrganisation !== undefined ? { targetOrganisation: patch.targetOrganisation?.trim() || null } : {}),
      ...(patch.wording !== undefined ? { wording: patch.wording?.trim() || null } : {}),
      ...(patch.benefits !== undefined ? { benefits: (patch.benefits ?? undefined) as never } : {}),
      ...(patch.implementationCost !== undefined ? { implementationCost: (patch.implementationCost ?? undefined) as never } : {}),
      ...(patch.enforcementCost !== undefined ? { enforcementCost: (patch.enforcementCost ?? undefined) as never } : {}),
      ...(patch.regulatoryFriction !== undefined ? { regulatoryFriction: (patch.regulatoryFriction ?? undefined) as never } : {}),
    },
  })
}

export async function removeAction(ideaId: string, actionId: string) {
  const row = await prisma.lexCoherentAction.findFirst({ where: { id: actionId, ideaId }, select: { id: true } })
  if (!row) return
  await prisma.lexCoherentAction.delete({ where: { id: actionId } })
}

/** The hand-seeded costing benchmarks (§18.3), available to the estimator. */
export async function listBenchmarks() {
  return prisma.costBenchmark.findMany({ orderBy: [{ domain: 'asc' }, { metric: 'asc' }] })
}

// ── Cost engine v0 (§19-C Task 6) — line items under an action ────────────────
type CostLineType = 'STAFF' | 'CAPITAL' | 'PROPERTY' | 'RESEARCH' | 'OTHER'
type CostLineCategory = 'IMPLEMENTATION' | 'ENFORCEMENT' | 'FRICTION'
type StaffLevel = 'JUNIOR' | 'MID' | 'SENIOR'

export interface CostLineInput {
  label: string
  costType?: CostLineType
  category?: CostLineCategory
  staffLevel?: StaffLevel | null
  fteCount?: number | null
  durationMonths?: number | null
  low?: number | null
  high?: number | null
  unit?: string | null
  basis?: string | null
  benchmarkId?: string | null
  priceYear?: number | null
}

/** Cost lines for every action on an idea (one query, grouped by the caller). */
export async function listCostLines(ideaId: string) {
  return prisma.costLine.findMany({
    where: { action: { ideaId } },
    orderBy: [{ actionId: 'asc' }, { orderIndex: 'asc' }],
  })
}

/** Scope the action to the idea so a caller can't attach a line to someone else's plan. */
async function actionInIdea(ideaId: string, actionId: string) {
  return prisma.lexCoherentAction.findFirst({ where: { id: actionId, ideaId }, select: { id: true } })
}

export async function addCostLine(ideaId: string, actionId: string, input: CostLineInput) {
  if (!(await actionInIdea(ideaId, actionId))) return null
  const base = await prisma.costLine.count({ where: { actionId } })
  return prisma.costLine.create({
    data: {
      actionId,
      label: input.label.trim(),
      costType: (input.costType ?? 'OTHER') as never,
      category: (input.category ?? 'IMPLEMENTATION') as never,
      staffLevel: (input.staffLevel ?? null) as never,
      fteCount: input.fteCount ?? null,
      durationMonths: input.durationMonths ?? null,
      low: input.low ?? null,
      high: input.high ?? null,
      unit: input.unit ?? 'GBP',
      basis: input.basis?.trim() || null,
      benchmarkId: input.benchmarkId ?? null,
      priceYear: input.priceYear ?? null,
      orderIndex: base,
    },
  })
}

export async function updateCostLine(ideaId: string, lineId: string, patch: Partial<CostLineInput>) {
  const row = await prisma.costLine.findFirst({ where: { id: lineId, action: { ideaId } }, select: { id: true } })
  if (!row) return null
  return prisma.costLine.update({
    where: { id: lineId },
    data: {
      ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
      ...(patch.costType !== undefined ? { costType: patch.costType as never } : {}),
      ...(patch.category !== undefined ? { category: patch.category as never } : {}),
      ...(patch.staffLevel !== undefined ? { staffLevel: (patch.staffLevel ?? null) as never } : {}),
      ...(patch.fteCount !== undefined ? { fteCount: patch.fteCount } : {}),
      ...(patch.durationMonths !== undefined ? { durationMonths: patch.durationMonths } : {}),
      ...(patch.low !== undefined ? { low: patch.low } : {}),
      ...(patch.high !== undefined ? { high: patch.high } : {}),
      ...(patch.unit !== undefined ? { unit: patch.unit } : {}),
      ...(patch.basis !== undefined ? { basis: patch.basis?.trim() || null } : {}),
      ...(patch.benchmarkId !== undefined ? { benchmarkId: patch.benchmarkId } : {}),
      ...(patch.priceYear !== undefined ? { priceYear: patch.priceYear } : {}),
    },
  })
}

export async function removeCostLine(ideaId: string, lineId: string) {
  const row = await prisma.costLine.findFirst({ where: { id: lineId, action: { ideaId } }, select: { id: true } })
  if (!row) return
  await prisma.costLine.delete({ where: { id: lineId } })
}

/**
 * ASHE wage suggestions for a staffing line (§19-C Task 6). The mapping from our three
 * staff levels onto the seeded ASHE benchmarks is recorded in LEX_PLAYBOOK §14 — it is
 * a SUGGESTION the user can always override, never an assertion, and the basis string
 * always names the benchmark it came from.
 */
export const STAFF_LEVEL_METRIC: Record<StaffLevel, string> = {
  JUNIOR: 'annual gross pay — lower quartile',
  MID: 'annual gross pay — median',
  SENIOR: 'annual gross pay — upper quartile',
}

export async function suggestStaffCost(level: StaffLevel, fte: number, months: number) {
  const benchmarks = await prisma.costBenchmark.findMany({
    where: { domain: { contains: 'wage', mode: 'insensitive' } },
    orderBy: { metric: 'asc' },
  })
  const wanted = STAFF_LEVEL_METRIC[level]
  const match =
    benchmarks.find((b) => b.metric.toLowerCase().includes(wanted.split('—')[1]?.trim() ?? '')) ??
    benchmarks.find((b) => /median/i.test(b.metric)) ??
    benchmarks[0]
  if (!match || (match.low == null && match.high == null)) return null
  const years = (months || 0) / 12
  const scale = (fte || 0) * years
  const low = match.low != null ? Number(match.low) * scale : null
  const high = match.high != null ? Number(match.high) * scale : low
  return {
    low, high,
    unit: match.unit ?? 'GBP',
    benchmarkId: match.id,
    priceYear: match.priceYear ?? match.year ?? null,
    basis:
      `${fte} FTE × ${months} months at ${match.metric} (${match.source}` +
      `${match.priceYear ? `, ${match.priceYear} prices` : ''})`,
  }
}

/** Aggregate the per-action §18.2 costs into totals + a plain-English summary set
 *  against the Page 2 problem cost. Every number stays a RANGE (low/high), and each
 *  figure is UPRATED to a common price year via the GDP deflator (COSTING_SCOPE §3)
 *  before totalling, so a 2016 value and a 2024 value can be summed honestly. */
export async function computeCostSummary(ideaId: string): Promise<{ summary: string; totals: Record<string, unknown> }> {
  const [actions, deflator, lines] = await Promise.all([
    prisma.lexCoherentAction.findMany({
      where: { ideaId },
      select: { implementationCost: true, enforcementCost: true, regulatoryFriction: true },
    }),
    prisma.deflatorSeries.findMany({ select: { year: true, index: true } }),
    // §19-C Task 6 — cost LINES are the primary source now; the legacy per-action
    // three-range fields are still summed so nothing captured before this sprint is lost.
    prisma.costLine.findMany({
      where: { action: { ideaId } },
      select: { category: true, low: true, high: true, priceYear: true },
    }),
  ])

  // Uprate a figure from its price year to the latest year in the deflator series.
  const idx = new Map(deflator.map((d) => [d.year, d.index]))
  const targetYear = deflator.length ? Math.max(...deflator.map((d) => d.year)) : null
  const uprate = (value: number, fromYear?: number | null): number => {
    if (targetYear == null || fromYear == null) return value
    const from = idx.get(fromYear), to = idx.get(targetYear)
    if (!from || !to) return value
    return value * (to / from)
  }

  const sum = (key: 'implementationCost' | 'enforcementCost' | 'regulatoryFriction') => {
    let low = 0, high = 0, any = false
    for (const a of actions) {
      const r = a[key] as { low?: number; high?: number; priceYear?: number | null } | null
      if (r && (typeof r.low === 'number' || typeof r.high === 'number')) {
        any = true
        const lo = typeof r.low === 'number' ? r.low : 0
        const hi = typeof r.high === 'number' ? r.high : lo
        low += uprate(lo, r.priceYear)
        high += uprate(hi, r.priceYear)
      }
    }
    return any ? { low, high } : null
  }
  // Cost lines roll up into the same three categories, uprated the same way.
  const lineSum = (category: 'IMPLEMENTATION' | 'ENFORCEMENT' | 'FRICTION') => {
    let low = 0, high = 0, any = false
    for (const l of lines) {
      if (l.category !== category) continue
      if (l.low == null && l.high == null) continue
      any = true
      const lo = l.low ?? 0
      const hi = l.high ?? lo
      low += uprate(lo, l.priceYear)
      high += uprate(hi, l.priceYear)
    }
    return any ? { low, high } : null
  }
  const merge = (a: { low: number; high: number } | null, b: { low: number; high: number } | null) =>
    a && b ? { low: a.low + b.low, high: a.high + b.high } : a ?? b

  const impl = merge(sum('implementationCost'), lineSum('IMPLEMENTATION'))
  const enf = merge(sum('enforcementCost'), lineSum('ENFORCEMENT'))
  const fric = merge(sum('regulatoryFriction'), lineSum('FRICTION'))

  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { whoAffectedImpactCost: true } })
  const problemCost = (idea?.whoAffectedImpactCost as { cost?: string } | null)?.cost || null

  const gbp = (r: { low: number; high: number } | null) =>
    r ? `£${Math.round(r.low).toLocaleString()}–${Math.round(r.high).toLocaleString()}` : '—'
  const oneOff = impl ? `${gbp(impl)} one-off (implementation)` : ''
  const ongoing = [enf ? `${gbp(enf)}/yr enforcement` : '', fric ? `${gbp(fric)}/yr compliance friction` : ''].filter(Boolean).join(' + ')
  const parts = [oneOff, ongoing ? `${ongoing} ongoing` : ''].filter(Boolean)
  const planCost = parts.length ? parts.join('; ') : 'not yet estimated'
  const priceBase = targetYear ? ` (all figures uprated to ${targetYear} prices)` : ''

  // §19-C Task 6 — the EANDCB threshold: an equivalent annual net direct cost to
  // business beyond ±£5m/yr triggers RPC scrutiny, which changes what the proposal
  // has to carry. Flag it as soon as the friction estimate crosses it.
  const EANDCB_THRESHOLD = 5_000_000
  const frictionPeak = fric ? Math.max(Math.abs(fric.low), Math.abs(fric.high)) : 0
  const eandcbFlag = frictionPeak > EANDCB_THRESHOLD
  const eandcbNote = eandcbFlag
    ? ` Ongoing friction on business is above £5m a year, so this would fall in scope of RPC scrutiny (an EANDCB assessment) — worth knowing before it reaches a department.`
    : ''

  const summary =
    `The problem costs ${problemCost ? `~${problemCost}` : '(not yet quantified on Page 2)'}. ` +
    `This plan costs ${planCost}${priceBase}. All figures are ranges with a stated basis — challenge any of them.${eandcbNote}`

  const totals = {
    implementationCost: impl, enforcementCost: enf, regulatoryFriction: fric,
    problemCost, priceYear: targetYear, costLines: lines.length, eandcbFlag,
  }
  return { summary, totals }
}

export { setStatus }

export type { FieldStatus }
