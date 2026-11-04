// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-X §3 (decisions 310, 316, 317) — DEVELOPMENT: its checklist, the progress of every action, and the Deepening's lock. SERVER ONLY.
//
// ⚠ ONE READ OF THE DOCUMENTS TREE (`documentTree`, the same function the Overview's tree and the Deepening's documents read), turned into
//   the strip by the pure `progressOf`. The checklist, the Drafting page's counts and the lock all come from here, so the three cannot
//   disagree about how many actions are still to go.
// ⚠ "LIVE" FOR THE LOCK = live and NOT in Later phase. A parked action is still the owner's and still in the proposal, but it is set aside
//   for a later phase, and drafting it now is not what the owner asked; the count says how many are parked, so nothing is hidden.
// ⚠ READS ONLY, except `recordDeepenOverride`, which APPENDS (decision 317: the override is recorded; nothing is overwritten).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { documentTree } from './action-documents'
import { PASSES } from './deepening-config'
import { activeConditions, parseConditions } from './action-conditions'
import { progressOf, draftingCounts, draftingLine, isDone, type Progress, type DraftingCounts } from './action-progress-pure'
import { LIMITS } from './input-limits'
import { CHECKLIST_WORD, LIFECYCLE_UI } from './screen-labels'

/** The five review passes, counted from the one list (deepening-config PASSES). */
export const REVIEW_PASS_COUNT = PASSES.length

export interface ActionProgressRow { id: string; number: number | null; title: string | null; statement: string; parked: boolean; progress: Progress }

export interface DeepenOverride { reason: string; by: string; at: string; toGo: number }

export interface DevelopmentState {
  /** Every live action, parked or not, with its strip. */
  rows: ActionProgressRow[]
  /** Counted over the live, un-parked actions — the lock's set. */
  counts: DraftingCounts
  parked: number
  /** The override in force, if any (the last one recorded). */
  override: DeepenOverride | null
  /** 317 — the Deepening is open when nothing is to go, or the owner has overridden the lock. */
  deepeningOpen: boolean
  /** The actions still to go, for the lock's list. */
  toGo: Array<{ id: string; number: number | null; title: string | null; statement: string; stage: Progress['stage'] }>
}

export function deepenOverridesOf(raw: unknown): DeepenOverride[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((o): o is DeepenOverride => !!o && typeof o === 'object' && typeof (o as DeepenOverride).reason === 'string' && typeof (o as DeepenOverride).at === 'string')
}

/** Every live action's progress, the counts, the lock. One documents-tree read; no write. */
export async function developmentState(ideaId: string): Promise<DevelopmentState> {
  const [tree, live, headings, idea] = await Promise.all([
    documentTree(ideaId),
    prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE' }, select: { id: true, parked: true } }),
    prisma.actionHeading.findMany({ where: { ideaId }, select: { id: true, kind: true } }),
    prisma.idea.findUnique({ where: { id: ideaId }, select: { deepenOverride: true } }),
  ])
  const parkedIds = new Set(live.filter((a) => a.parked).map((a) => a.id))
  const kindOf = new Map(headings.map((h) => [h.id, h.kind]))
  const rows: ActionProgressRow[] = tree.headings.flatMap((h) => h.actions).map((r) => ({
    id: r.id, number: r.number, title: r.title, statement: r.statement, parked: parkedIds.has(r.id),
    progress: progressOf({
      statement: r.statement, title: r.title, headingId: r.headingId, headingKind: r.headingId ? kindOf.get(r.headingId) ?? null : null, needs: r.needs,
      documents: r.documents.map((d) => ({ kind: d.kind, status: d.status, acceptedV: d.acceptedV, current: d.current, reviewed: d.reviewed })),
    }, REVIEW_PASS_COUNT),
  })).sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9))
  const counted = rows.filter((r) => !r.parked)
  const counts = draftingCounts(counted.map((r) => r.progress))
  const override = deepenOverridesOf(idea?.deepenOverride).at(-1) ?? null
  return {
    rows, counts, parked: rows.length - counted.length, override,
    deepeningOpen: counts.toGo === 0 || !!override,
    toGo: counted.filter((r) => !isDone(r.progress)).map((r) => ({ id: r.id, number: r.number, title: r.title, statement: r.statement, stage: r.progress.stage })),
  }
}

/** 317 — "Deepened with 13 actions undrafted — reason: …". Printed on the Deepening page and on every output it produces. Null when nothing
 *  is to go (the lock opened by itself) or no override is in force. */
export function overrideLine(s: Pick<DevelopmentState, 'override' | 'counts'>): string | null {
  if (!s.override || s.counts.toGo === 0) return null
  const n = s.counts.toGo
  return `Deepened with ${n} action${n === 1 ? '' : 's'} undrafted — reason: ${s.override.reason}`
}

/** 317 — the owner overrides the lock with a reason. APPENDED to the idea's overrides, never replacing one. */
export async function recordDeepenOverride(ideaId: string, reason: string, by: string): Promise<{ ok: true; override: DeepenOverride } | { ok: false; error: string }> {
  const r = reason.trim()
  if (r.length < 3) return { ok: false, error: '“Deepen now” was not done. Rejected: the reason was empty — say why the Deepening should open before every action is drafted. Nothing was changed.' }
  if (r.length > LIMITS.deepenOverrideReason) return { ok: false, error: `“Deepen now” was not done. Rejected: the reason is ${r.length} characters; the limit is ${LIMITS.deepenOverrideReason}. Nothing was changed.` }
  const s = await developmentState(ideaId)
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { deepenOverride: true } })
  const o: DeepenOverride = { reason: r, by, at: new Date().toISOString(), toGo: s.counts.toGo }
  await prisma.idea.update({ where: { id: ideaId }, data: { deepenOverride: [...deepenOverridesOf(idea?.deepenOverride), o] as never } })
  return { ok: true, override: o }
}

// ── §3a — the checklist ─────────────────────────────────────────────────────────────────────────────────────────

export type ChecklistKey = 'problem' | 'causes' | 'policy' | 'organising' | 'drafting' | 'deepening' | 'promotion'
export interface ChecklistLine { key: ChecklistKey; n: number; label: string; state: string; mark: '●' | '◐' | '○' | '🔒'; href: string | null }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export async function developmentChecklist(ideaId: string, dev?: DevelopmentState): Promise<ChecklistLine[]> {
  const s = dev ?? await developmentState(ideaId)
  const [problem, causes, live, headings, idea, chosen, collisions, setDigest] = await Promise.all([
    prisma.ideaFieldState.findFirst({ where: { ideaId, fieldKey: 'challenge' }, select: { status: true } }),
    prisma.diagnosisCause.findMany({ where: { ideaId }, select: { id: true } }),
    prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE', parked: false }, select: { targetCauseIds: true, policyTestVerdict: true, whoImplements: true } }),
    prisma.actionHeading.count({ where: { ideaId, archivedAt: null } }),
    prisma.idea.findUnique({ where: { id: ideaId }, select: { chosenApproach: true, conditions: true } }),
    prisma.policyOption.findFirst({ where: { ideaId, status: 'CHOSEN' }, select: { number: true } }),
    prisma.actionDocument.count({ where: { ideaId, kind: 'COLLISION_REPORT', status: { not: 'SUPERSEDED' } } }),
    // a whole-set digest the judge finished (status READY, action-digest.ts)
    prisma.actionDigest.findFirst({ where: { ideaId, scope: 'SET', status: 'READY' }, orderBy: { createdAt: 'desc' }, select: { id: true } }),
  ])
  const base = `/ideas/create?ideaId=${ideaId}`
  const targeted = new Set(live.flatMap((a) => a.targetCauseIds))
  const withActions = causes.filter((c) => targeted.has(c.id)).length
  const untested = live.filter((a) => !a.policyTestVerdict || a.policyTestVerdict === 'NOT_TESTED').length
  const conditions = activeConditions(parseConditions(idea?.conditions)).length
  const who = live.filter((a) => a.whoImplements?.trim()).length
  // passes on drafts: drafts that all five passes have read at their current version, of the drafts there are
  const drafts = s.rows.filter((r) => !r.parked && r.progress.marks.drafted === 'done')
  const passed = drafts.filter((r) => r.progress.marks.reviewed === 'done').length
  const problemWritten = problem?.status === 'ACCEPTED'
  const lines: ChecklistLine[] = [
    { key: 'problem', n: 1, label: CHECKLIST_WORD.problem, mark: problemWritten ? '●' : problem?.status === 'AWAITING_CONFIRMATION' ? '◐' : '○',
      state: problemWritten ? 'written' : problem?.status === 'AWAITING_CONFIRMATION' ? 'drafted by Lex, not yet accepted' : 'not yet written', href: `${base}&section=problem` },
    { key: 'causes', n: 2, label: CHECKLIST_WORD.causes, mark: causes.length === 0 ? '○' : withActions === causes.length ? '●' : '◐',
      state: `${plural(causes.length, 'cause')} · ${withActions} with actions`, href: `${base}&section=causes` },
    { key: 'policy', n: 3, label: CHECKLIST_WORD.policy, mark: idea?.chosenApproach?.trim() ? '●' : '○',
      state: idea?.chosenApproach?.trim() ? `chosen${chosen?.number != null ? ` · #${chosen.number}` : ''}` : 'not yet chosen', href: `${base}&section=policy` },
    { key: 'organising', n: 4, label: CHECKLIST_WORD.organising, mark: s.counts.total === 0 ? '○' : untested === 0 ? '●' : '◐',
      state: `${s.counts.total} live · ${plural(headings, 'heading')} · ${plural(conditions, 'condition')} · ${untested} untested against the policy${s.parked ? ` · ${s.parked} in Later phase` : ''}`, href: `${base}&view=organising` },
    { key: 'drafting', n: 5, label: CHECKLIST_WORD.drafting, mark: s.counts.total === 0 ? '○' : s.counts.toGo === 0 ? '●' : '◐',
      state: draftingLine(s.counts), href: `${base}&view=drafting` },
    { key: 'deepening', n: 6, label: CHECKLIST_WORD.deepening, mark: s.deepeningOpen ? '◐' : '🔒',
      state: s.deepeningOpen
        ? `${s.override && s.counts.toGo > 0 ? 'opened early by you · ' : ''}collision ${collisions} · four models: ${setDigest ? 'run' : 'not run'} · passes ${REVIEW_PASS_COUNT}/${REVIEW_PASS_COUNT} on ${passed} of ${plural(drafts.length, 'draft')} · costs: not rolled up · who delivers: ${who} of ${live.length} answered`
        : `${CHECKLIST_WORD.locked} until Drafting reads “0 to go” — ${s.counts.toGo} to go`,
      href: `${base}&stage=deepening` },
    { key: 'promotion', n: 7, label: CHECKLIST_WORD.promotion, mark: '○', state: LIFECYCLE_UI.notYetAvailable, href: null },
  ]
  return lines
}
