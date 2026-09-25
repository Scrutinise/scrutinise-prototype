// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-G §3 — THE ONE-PAGE SUMMARY. For a minister, an MP between meetings, a journalist.
//
// ⚠⚠ §3a — ONE PAGE, ENFORCED, NOT A TARGET. Reuses the clip-budget technique
// `buildSummaryDocument` already proved for PROPOSAL_SUMMARY (build-proposal.ts, 25-N §5b: "four
// sections at ~450 characters... is a page" — the fix for a draft that ran to seven sections and
// two pages). This document carries eight short items rather than four longer ones, so each
// budget is smaller; the TOTAL is calibrated to be no larger than that proven one-page total. Not
// independently verified by rendering a PDF — reported, not assumed (BRIEF_26G report, §3a).
// Nothing is ever silently cut mid-sentence: `clip()` always closes on a word boundary with "…".
//
// §3c/§3d — every caveat this needs is ON the page: the beta marker, First Scrutiny where it
// applies, and the strongest argument against is never omitted for space. If space runs out,
// what is cut is UNRESOLVED (the least load-bearing item for a two-minute reader), never the
// argument against — see `BUDGET` below, ordered by what goes first.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import type { Block, DocumentModel } from './model'
import { betaBlocks } from './build-proposal'
import { markdownToBlocks } from './markdown'
import { ExportUnavailableError } from './build-initial-background'
import { AVENUES, AVENUE_LABEL } from '@/lib/lex/build-avenues'
import { ONE_PAGE_SUMMARY_NAME, FIRST_SCRUTINY_NOTE, isFirstScrutiny } from './lex-26g-document-names'

export const ONE_PAGE_SUMMARY_KIND = 'ONE_PAGE_SUMMARY'

/** Character budgets, one page's worth in total — see the file header. Order matters: if the
 *  render genuinely will not fit (§3a: "report what happens when the content does not fit"),
 *  the LAST key in this object is dropped first, never the earlier ones. `against` is never
 *  droppable (§3d) — it is not a key a caller may omit. */
const BUDGET = {
  problem: 220, difference: 200, approach: 260, instrument: 160,
  for: 260, against: 320, unresolved: 180, evidenceLine: 140,
} as const
/** §3a — if a render must drop something to fit, this is the order (last dropped first).
 *  `against` and `problem` are absent from this list on purpose: never dropped. */
const DROP_ORDER: (keyof typeof BUDGET)[] = ['unresolved', 'evidenceLine', 'instrument', 'difference', 'for', 'approach']

function clip(s: string, n: number): string {
  const t = s.trim()
  if (t.length <= n) return t
  const cut = t.slice(0, n - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > n * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

function accepted(rows: Map<string, { status: string; value: string | null }>, key: string): string | null {
  const r = rows.get(key)
  if (!r || r.status !== 'ACCEPTED' || !r.value) return null
  try {
    const parsed = JSON.parse(r.value)
    if (typeof parsed === 'string') return parsed.trim() || null
  } catch { /* plain string */ }
  return r.value.trim() || null
}

interface Snapshot {
  buildId: string
  buildVersion: number
  body: string
  included: (keyof typeof BUDGET)[]
  dropped: (keyof typeof BUDGET)[]
}

export async function composeOnePageSummary(
  ideaId: string, buildId: string, buildVersion: number, opts: { late: boolean },
): Promise<Snapshot> {
  const [fieldRows, chosenOption, avenueRows, adversarial, anyOpen, evidenceCount] = await Promise.all([
    prisma.ideaFieldState.findMany({
      where: { ideaId, fieldKey: { in: ['challenge', 'yourGoal', 'chosenApproach'] } },
      select: { fieldKey: true, status: true, value: true },
    }),
    prisma.policyOption.findFirst({ where: { ideaId, status: 'CHOSEN' }, select: { caseFor: true } }),
    prisma.buildAvenue.findMany({ where: { buildId }, orderBy: { avenue: 'asc' }, select: { avenue: true, applies: true, restsOn: true } }),
    // §3d — the strongest argument against comes from the challenges, and the ADVERSARIAL pass
    // ("read back as a hostile clerk" — DeepeningPanel's own words) is where the sharpest ones
    // are. Falls back to any OPEN challenge if that pass raised none.
    prisma.deepeningIssue.findFirst({
      where: { ideaId, runVersion: buildVersion, status: 'OPEN', passKey: 'ADVERSARIAL' },
      orderBy: { createdAt: 'asc' }, select: { title: true, text: true },
    }),
    prisma.deepeningIssue.findFirst({
      where: { ideaId, runVersion: buildVersion, status: 'OPEN' },
      orderBy: { createdAt: 'asc' }, select: { title: true, text: true },
    }),
    prisma.deepeningIssue.count({ where: { ideaId, runVersion: buildVersion, status: 'OPEN' } }),
  ])
  const rows = new Map(fieldRows.map((f) => [f.fieldKey, { status: f.status, value: f.value }]))

  const against = adversarial ?? anyOpen
  const chosenAvenue = avenueRows.find((a) => a.applies)
  const evidenceSourced = await prisma.evidenceItem.count({ where: { ideaId, runVersion: buildVersion, status: 'ACCEPTED' } })

  const raw: Partial<Record<keyof typeof BUDGET, string>> = {
    problem: accepted(rows, 'challenge') ?? undefined,
    difference: accepted(rows, 'yourGoal') ?? undefined,
    approach: accepted(rows, 'chosenApproach') ?? undefined,
    instrument: chosenAvenue
      ? `${AVENUE_LABEL[chosenAvenue.avenue as (typeof AVENUES)[number]]}${chosenAvenue.restsOn ? ` — ${chosenAvenue.restsOn}` : ''}`
      : undefined,
    for: chosenOption?.caseFor?.trim() || undefined,
    against: against ? (against.title?.trim() ? `${against.title.trim()}: ${against.text}` : against.text) : undefined,
    unresolved: evidenceCount >= 0
      ? `${anyOpen ? 'Outstanding' : 'No outstanding'} challenges: ${evidenceCount} unresolved.`
      : undefined,
    evidenceLine: `Drawn from ${evidenceSourced} accepted source${evidenceSourced === 1 ? '' : 's'} in the research.`,
  }

  // §3a — enforce the total. Drop from the END of DROP_ORDER inward until it fits; `against`
  // and `problem` are never candidates.
  let keys = (Object.keys(BUDGET) as (keyof typeof BUDGET)[]).filter((k) => raw[k])
  const total = () => keys.reduce((n, k) => n + Math.min(raw[k]!.length, BUDGET[k]), 0)
  const dropped: (keyof typeof BUDGET)[] = []
  const TOTAL_BUDGET = Object.values(BUDGET).reduce((a, b) => a + b, 0)
  for (const d of DROP_ORDER) {
    if (total() <= TOTAL_BUDGET) break
    if (keys.includes(d)) { keys = keys.filter((k) => k !== d); dropped.push(d) }
  }

  const LABEL: Record<keyof typeof BUDGET, string> = {
    problem: 'The problem', difference: 'What would be different', approach: 'The approach',
    instrument: 'The instrument', for: 'The strongest argument for', against: 'The strongest argument against',
    unresolved: 'Still unresolved', evidenceLine: 'Where the evidence comes from',
  }
  const md: string[] = []
  for (const k of Object.keys(BUDGET) as (keyof typeof BUDGET)[]) {
    if (!keys.includes(k)) continue
    md.push(`## ${LABEL[k]}`, '', clip(raw[k]!, BUDGET[k]), '')
  }
  if (!keys.length) {
    md.push('*Not enough of the kernel is settled yet to summarise on one page.*')
  }

  return { buildId, buildVersion, body: md.join('\n'), included: keys, dropped }
}

export async function snapshotOnePageSummary(ideaId: string, buildId: string, buildVersion: number): Promise<void> {
  const s = await composeOnePageSummary(ideaId, buildId, buildVersion, { late: false })
  await prisma.document.upsert({
    where: { ideaId_kind: { ideaId, kind: ONE_PAGE_SUMMARY_KIND } },
    create: { ideaId, kind: ONE_PAGE_SUMMARY_KIND, status: 'ready', summary: null, body: s.body, buildId, buildVersion },
    update: { status: 'ready', summary: null, body: s.body, buildId, buildVersion },
  })
  console.log('[lex-diag] 26g one-page summary snapshot written', {
    ideaId, buildId, buildVersion, dropped: s.dropped,
  })
}

async function ensureOnePageSummary(ideaId: string): Promise<{
  body: string; buildId: string; buildVersion: number; updatedAt: Date; composedLate: boolean
}> {
  const latest = await prisma.ideaBuild.findFirst({
    where: { ideaId, status: 'DONE' }, orderBy: { version: 'desc' }, select: { id: true, version: true, completedAt: true },
  })
  if (!latest) throw new ExportUnavailableError('There is no completed build on this idea yet, so there is nothing to summarise.')

  const doc = await prisma.document.findUnique({
    where: { ideaId_kind: { ideaId, kind: ONE_PAGE_SUMMARY_KIND } },
    select: { body: true, buildId: true, buildVersion: true, updatedAt: true, status: true },
  })
  if (doc?.body && doc.buildId === latest.id && doc.status === 'ready') {
    const late = !latest.completedAt || (doc.updatedAt.getTime() - latest.completedAt.getTime()) > 10 * 60 * 1000
    return { body: doc.body, buildId: latest.id, buildVersion: latest.version, updatedAt: doc.updatedAt, composedLate: late }
  }

  const s = await composeOnePageSummary(ideaId, latest.id, latest.version, { late: true })
  const written = await prisma.document.upsert({
    where: { ideaId_kind: { ideaId, kind: ONE_PAGE_SUMMARY_KIND } },
    create: { ideaId, kind: ONE_PAGE_SUMMARY_KIND, status: 'ready', summary: null, body: s.body, buildId: latest.id, buildVersion: latest.version },
    update: { status: 'ready', summary: null, body: s.body, buildId: latest.id, buildVersion: latest.version },
    select: { updatedAt: true },
  })
  return { body: s.body, buildId: latest.id, buildVersion: latest.version, updatedAt: written.updatedAt, composedLate: true }
}

export interface OnePageSummaryBuildResult {
  model: DocumentModel
  fingerprint: string
  sourceLabel: string
}

export async function buildOnePageSummary(ideaId: string): Promise<OnePageSummaryBuildResult> {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true, stage: true } })
  if (!idea) throw new ExportUnavailableError('That idea no longer exists.')
  const snap = await ensureOnePageSummary(ideaId)
  const build = await prisma.ideaBuild.findUnique({ where: { id: snap.buildId }, select: { completedAt: true, startedAt: true } })
  const when = build?.completedAt ?? build?.startedAt ?? snap.updatedAt

  const blocks: Block[] = []
  blocks.push(...betaBlocks())
  if (isFirstScrutiny(idea.stage)) blocks.push({ kind: 'note', text: FIRST_SCRUTINY_NOTE })
  blocks.push({ kind: 'note', text:
    snap.composedLate
      ? `Composed on ${snap.updatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC from build ${snap.buildVersion}'s rows as they stood then.`
      : `Frozen when build ${snap.buildVersion} finished, on ${when.toISOString().slice(0, 16).replace('T', ' ')} UTC.` })

  blocks.push(...markdownToBlocks(snap.body))

  const sourceLabel = [
    `build ${snap.buildVersion} of this idea (${when.toISOString().slice(0, 16).replace('T', ' ')} UTC)`,
    'the stored One-Page Summary snapshot',
  ].join(', ')

  return {
    model: {
      title: `${idea.title} — ${ONE_PAGE_SUMMARY_NAME}`,
      sourceLabel,
      generatedAt: new Date(),
      blocks,
    },
    fingerprint: `${snap.buildId}:${snap.body.length}`,
    sourceLabel,
  }
}
