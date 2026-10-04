// 26-P ADDENDUM (CCh follow-up) — what the section checklists look like for ONE idea and ONE user.
//
// Server-side assembly, shared by the GET route, the PATCH route and the check. A PURE READ — no model call, no write —
// so it is as cheap as the worklist's own fetch and can be asked for on every refresh.
//
// ⚠ THE TICKS ARE PER USER (the same `IdeaWorklistTick` the worklist already uses): two collaborators who have each
// checked the causes have checked different things, and one's tick must not tell the other they have.

import { prisma } from '@/lib/prisma'
import { allChecklists, checksNotDone, notYetDoneLine, type SectionChecklist } from './section-checklists'

export interface ChecklistView {
  section: string
  heading: string
  blurb: string
  confirmLabel: string
  /** The line printed beside the confirm control, or null when every check is done. */
  notYetDone: string | null
  checks: Array<{ key: string; title: string; question: string; ticked: boolean }>
}

export interface ChecklistsState {
  /** Only the checklists that are showing now. Empty is a real answer (causes confirmed, or none yet). */
  checklists: ChecklistView[]
  /** Whether "Ask Lex" can run for this user — the tool-calling Lex is switched on per account (LEX_AGENT). */
  askLexAvailable: boolean
}

type RowCounts = { causes: number; policyOptions: number; actions: number }

async function rowCounts(ideaId: string): Promise<RowCounts> {
  const [causes, policyOptions, actions] = await Promise.all([
    prisma.diagnosisCause.count({ where: { ideaId } }),
    prisma.policyOption.count({ where: { ideaId, mergedIntoId: null } }),
    prisma.lexCoherentAction.count({ where: { ideaId, status: 'LIVE' } }),
  ])
  return { causes, policyOptions, actions }
}

/** Is this checklist showing? Reads the registry's `shownWhile` — it knows nothing about Diagnosis in particular. */
export function isShowing(c: SectionChecklist, fieldStatus: string | null, counts: RowCounts): boolean {
  const w = c.shownWhile
  if (fieldStatus && w.untilStatusIn.includes(fieldStatus)) return false
  if (w.needsRows && counts[w.needsRows] === 0) return false
  return true
}

export async function buildChecklists(ideaId: string, userId: string, askLexAvailable: boolean): Promise<ChecklistsState> {
  const lists = allChecklists()
  if (!lists.length) return { checklists: [], askLexAvailable }
  const [fields, ticks, counts] = await Promise.all([
    prisma.ideaFieldState.findMany({ where: { ideaId, fieldKey: { in: lists.map((l) => l.shownWhile.fieldKey) } }, select: { fieldKey: true, status: true } }),
    prisma.ideaWorklistTick.findMany({ where: { ideaId, userId, itemKey: { startsWith: 'check:' } }, select: { itemKey: true } }),
    rowCounts(ideaId),
  ])
  const statusOf = new Map(fields.map((f) => [f.fieldKey, f.status as string]))
  const ticked = new Set(ticks.map((t) => t.itemKey))
  const out: ChecklistView[] = []
  for (const c of lists) {
    if (!isShowing(c, statusOf.get(c.shownWhile.fieldKey) ?? null, counts)) continue
    out.push({
      section: c.section, heading: c.heading, blurb: c.blurb, confirmLabel: c.confirmLabel,
      notYetDone: notYetDoneLine(checksNotDone(c, ticked), c.checks.length),
      checks: c.checks.map((k) => ({ key: k.key, title: k.title, question: k.question, ticked: ticked.has(k.key) })),
    })
  }
  return { checklists: out, askLexAvailable }
}
