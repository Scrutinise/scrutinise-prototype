// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-B §6 — THE RE-RUN SITS BENEATH A CHECKLIST DRAWN FROM THE IDEA'S OWN STATE.
//
// Charlie's design: *"the re-run control sits below a clear checklist with checkboxes — I have
// read the briefing · I have answered the outstanding questions · … — drawn from the idea's
// own state, not a fixed list."*
//
// ⚠ EVERY ITEM IS REAL AND COUNTABLE (§6a). *"A checkbox that is always unticked teaches the
// user to ignore it."* So each row below is one of two honest kinds, and says which:
//   · DERIVED — ticked by the rows themselves (decisions resolved of decisions posed, challenges
//     answered of challenges raised, kernel fields settled of fields drafted). The user cannot
//     tick these; the work ticks them.
//   · RECORDED — a thing only the user knows they did (read the briefing), ticked by them and
//     stored as an `IdeaWorklistTick`, the same store the worklist uses.
// A kind that has nothing to count on this idea is OMITTED, not shown unticked forever.
//
// ⚠ §6b — INFORMS, NEVER BLOCKS. An unticked list does not prevent the re-run: a user spending
// their own allowance early is entitled to. Recommended and built that way; Charlie may decide
// otherwise and the switch is one boolean on the page. §6c — the allowance line stays with the
// control, untouched.
//
// ⚠ NO SERVER IMPORTS IN THE TYPES; the assembler below imports Prisma and is called from the
// worklist route only. The page reads the result over the same GET the worklist uses.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { PAGE_SEQUENCE } from './page1-config'

export interface RerunChecklistItem {
  /** Stable key. `recorded:*` rows are tickable; `derived:*` rows are not. */
  key: string
  kind: 'derived' | 'recorded'
  text: string
  done: boolean
  /** For derived rows: how many are done of how many. Null for recorded rows. */
  progress: { done: number; of: number } | null
}

export interface RerunChecklist {
  items: RerunChecklistItem[]
  /** All rows done — the page says "everything on the list is done" rather than reading ticks. */
  complete: boolean
}

const KERNEL_FIELD_KEYS = PAGE_SEQUENCE.filter((p) => p.key !== 'ORIENTATION').flatMap((p) => p.fields.map((f) => f.key))

export const BRIEFING_READ_KEY = 'recorded:read-briefing'
export const QUESTIONS_READ_KEY = 'recorded:read-questions'

export async function buildRerunChecklist(ideaId: string, userId: string): Promise<RerunChecklist> {
  const latest = await prisma.ideaBuild.findFirst({ where: { ideaId, status: 'DONE' }, orderBy: { version: 'desc' }, select: { id: true, version: true } })
  if (!latest) return { items: [], complete: false }

  const [ticks, forks, issues, fields, briefing, questions] = await Promise.all([
    prisma.ideaWorklistTick.findMany({ where: { ideaId, userId, itemKey: { in: [BRIEFING_READ_KEY, QUESTIONS_READ_KEY] } }, select: { itemKey: true } }),
    prisma.buildFork.findMany({ where: { buildId: latest.id }, select: { forkKey: true, resolved: true } }),
    // The latest build's challenges: the ones the re-run is meant to be informed by.
    prisma.deepeningIssue.findMany({ where: { ideaId, runVersion: latest.version }, select: { status: true } }),
    prisma.ideaFieldState.findMany({ where: { ideaId, fieldKey: { in: KERNEL_FIELD_KEYS } }, select: { status: true } }),
    prisma.document.findUnique({ where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } }, select: { status: true } }),
    prisma.document.findUnique({ where: { ideaId_kind: { ideaId, kind: 'INITIAL_QUESTIONS' } }, select: { status: true } }),
  ])
  const ticked = new Set(ticks.map((t) => t.itemKey))
  const items: RerunChecklistItem[] = []

  if (briefing?.status === 'ready') {
    items.push({ key: BRIEFING_READ_KEY, kind: 'recorded', text: 'I have read the Initial Background Briefing', done: ticked.has(BRIEFING_READ_KEY), progress: null })
  }
  if (questions?.status === 'ready') {
    items.push({ key: QUESTIONS_READ_KEY, kind: 'recorded', text: 'I have read the Initial Questions', done: ticked.has(QUESTIONS_READ_KEY), progress: null })
  }

  const decisionKeys = [...new Set(forks.map((f) => f.forkKey))]
  if (decisionKeys.length) {
    const resolved = decisionKeys.filter((k) => forks.find((f) => f.forkKey === k)?.resolved).length
    items.push({
      key: 'derived:decisions', kind: 'derived',
      text: 'I have answered the outstanding decisions',
      done: resolved === decisionKeys.length, progress: { done: resolved, of: decisionKeys.length },
    })
  }

  const drafted = fields.filter((f) => f.status !== 'EMPTY')
  if (drafted.length) {
    const settled = drafted.filter((f) => f.status === 'ACCEPTED' || f.status === 'SKIPPED').length
    items.push({
      key: 'derived:fields', kind: 'derived',
      text: 'I have settled the kernel fields Lex drafted',
      done: settled === drafted.length, progress: { done: settled, of: drafted.length },
    })
  }

  if (issues.length) {
    const answered = issues.filter((i) => i.status !== 'OPEN').length
    items.push({
      key: 'derived:challenges', kind: 'derived',
      text: 'I have responded to the challenges',
      done: answered === issues.length, progress: { done: answered, of: issues.length },
    })
  }

  return { items, complete: items.length > 0 && items.every((i) => i.done) }
}
