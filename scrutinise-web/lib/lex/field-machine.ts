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
/** Fire the search through the gateway (§14) and write legislationRefs + Initial Background. */
export async function fireSearchTrigger(ideaId: string): Promise<void> {
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
  const { grouped: refs } = await runSearch({
    keywords,
    intent: 'BACKGROUND_BRIEFING',
    ideaContext,
    limit: 12,
  })

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
export interface CauseInput {
  cause: string
  whyPersisted?: string | null
  evidence?: string | null
  source?: 'USER' | 'LEX_CORPUS'
}

export async function listCauses(ideaId: string) {
  return prisma.diagnosisCause.findMany({
    where: { ideaId },
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
  })
}

/** Bulk-create candidate causes (e.g. from the CAUSE_SEEDING corpus search). */
export async function createCauses(ideaId: string, causes: CauseInput[], source: 'USER' | 'LEX_CORPUS') {
  if (!causes.length) return
  const base = await prisma.diagnosisCause.count({ where: { ideaId } })
  await prisma.diagnosisCause.createMany({
    data: causes
      .filter((c) => c.cause?.trim())
      .map((c, i) => ({
        ideaId,
        cause: c.cause.trim(),
        whyPersisted: c.whyPersisted?.trim() || null,
        evidence: c.evidence?.trim() || null,
        source: (c.source ?? source) as never,
        orderIndex: base + i,
      })),
  })
}

export async function addCause(ideaId: string, input: CauseInput) {
  const base = await prisma.diagnosisCause.count({ where: { ideaId } })
  return prisma.diagnosisCause.create({
    data: {
      ideaId,
      cause: input.cause.trim(),
      whyPersisted: input.whyPersisted?.trim() || null,
      evidence: input.evidence?.trim() || null,
      source: (input.source ?? 'USER') as never,
      orderIndex: base,
    },
  })
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

export { setStatus }

export type { FieldStatus }
