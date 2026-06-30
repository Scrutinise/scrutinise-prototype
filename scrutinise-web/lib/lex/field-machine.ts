// ─────────────────────────────────────────────────────────────────────────────
// Field state machine (§3.2) — SERVER-AUTHORITATIVE writes only.
//
// IdeaFieldState is the single source of truth for "where we are". Lex and the
// frontend never write it. Every accepted value is also mirrored onto its
// canonical column (Idea/User) per the §3.4 write-ownership table.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import {
  ORIENTATION_FIELDS,
  EXPERIENCE_LEVEL_MAP,
  IDEA_SLOT_KEYS,
  USER_SLOT_KEYS,
  fieldDef,
  type FieldStatus,
} from './page1-config'
import { groupForPanel, buildInitialBackground } from './search-stub'
import { runFtsSearch } from './fts-search'
import { expandQuery } from './query-expansion'

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

  const toCreate = ORIENTATION_FIELDS.filter((f) => !have.has(f.key)).map((f) => {
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
  }
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
/** Fire the search (with optional LLM query expansion) and write legislationRefs + Initial Background. */
export async function fireSearchTrigger(ideaId: string): Promise<void> {
  const idea = await prisma.idea.findUnique({
    where: { id: ideaId },
    select: { keywords: true, ideaNarrative: true, youAndIdeaNarrative: true },
  })
  const keywords = idea?.keywords ?? []

  // LLM query expansion (LEX_QUERY_EXPANSION=true to enable; off by default in prod).
  // Inserts anchor Act names + statutory terms-of-art + rephrasings into the query so
  // lay-vocabulary ideas surface the anchor legislation in the BM25 candidate set.
  // Feeds the FTS query ONLY — never the briefing text (grounding guardrail §3).
  const ideaContext = [idea?.ideaNarrative, idea?.youAndIdeaNarrative]
    .filter(Boolean).join(' ').slice(0, 500)
  const expansion = await expandQuery(keywords, ideaContext)
  const expandedKeywords = [
    ...new Set([...keywords, ...expansion.anchors, ...expansion.termsOfArt, ...expansion.rephrasings]),
  ]
  const addedTerms = expandedKeywords.filter((k) => !keywords.includes(k))
  if (addedTerms.length) {
    console.log('[query-expansion] terms added', {
      original: keywords,
      added: addedTerms,
      anchors: expansion.anchors,
      termsOfArt: expansion.termsOfArt,
      rephrasings: expansion.rephrasings,
    })
  }

  const { results } = await runFtsSearch(expandedKeywords, 12)
  const refs = groupForPanel(results)
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

export type { FieldStatus }
