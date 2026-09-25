// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-G §2 — WRITTEN EVIDENCE TO A SELECT COMMITTEE.
//
// The output that reaches Parliament without needing an MP: anyone may submit, it is published,
// and it enters the record. Frozen at build-finish, like the Initial Background/Questions pair
// (§4a/§4b of the brief) — a document that leaves the building must be a stable, dateable record
// of what the build actually said, not something that silently changes if a field moves later.
//
// ⚠⚠ §2c — MEASURED, NOT ASSUMED: nothing in this platform's ingest pipeline tracks which
// committee inquiries are currently open. `committees-evidence` holds PUBLISHED evidence, which
// by construction is evidence to inquiries that have already run. So this cannot be addressed to
// a specific inquiry, and does not pretend to be — `COMMITTEE_EVIDENCE_OPENING` says so, on the
// document itself, per §2c's own instruction ("the template produces a submission the user
// adapts, with that limitation stated on it").
//
// §2a's shape, read off a sample of real submissions in the corpus (BRIEF_26G report): a header
// naming the submitter (and any organisational interest, stated inline rather than in a separate
// declared-interest block), then prose answering the inquiry's own questions or terms of
// reference directly — no consistent paragraph numbering, no consistent citation convention.
// §2b's current published guidance could not be checked live — every parliament.uk subdomain
// this session tried returned 403, the same wall the product's own URL-fetch already documents
// (Decision 92, lib/lex/user-material.ts) — so the shape below follows the CORPUS sample only,
// and the document says to check the specific committee's own requirements before sending.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import type { Block, DocumentModel, SourceRef } from './model'
import { betaBlocks } from './build-proposal'
import { markdownToBlocks } from './markdown'
import { ExportUnavailableError } from './build-initial-background'
import {
  COMMITTEE_EVIDENCE_NAME, COMMITTEE_EVIDENCE_OPENING, FIRST_SCRUTINY_NOTE, isFirstScrutiny,
} from './lex-26g-document-names'

export const COMMITTEE_EVIDENCE_KIND = 'COMMITTEE_EVIDENCE'

interface Snapshot {
  buildId: string
  buildVersion: number
  composedAt: Date
  composedLate: boolean
  body: string
  hasContent: boolean
}

/** Only an ACCEPTED (or SKIPPED, printed as absent) field may appear in a document that leaves
 *  the building — the proposer's position, never a draft nobody has agreed to. Same rule
 *  `build-meeting-pack.ts`'s `fieldText` enforces, restated here because this reads raw
 *  `IdeaFieldState` rows rather than a `ProposalSnapshot`. */
function accepted(rows: Map<string, { status: string; value: string | null }>, key: string): string | null {
  const r = rows.get(key)
  if (!r || r.status !== 'ACCEPTED' || !r.value) return null
  try {
    const parsed = JSON.parse(r.value)
    if (typeof parsed === 'string') return parsed.trim() || null
  } catch { /* a plain string, not JSON */ }
  return r.value.trim() || null
}

export async function composeCommitteeEvidence(
  ideaId: string, buildId: string, buildVersion: number, opts: { late: boolean },
): Promise<Snapshot> {
  const [idea, fieldRows, actions, issues, evidence] = await Promise.all([
    prisma.idea.findUnique({
      where: { id: ideaId },
      select: { title: true, creator: { select: { name: true, email: true } } },
    }),
    prisma.ideaFieldState.findMany({
      where: {
        ideaId,
        fieldKey: { in: ['aboutYou', 'challenge', 'summaryDiagnosis', 'rootCause', 'chosenApproach', 'whatItRulesOut', 'summaryCoherentActions'] },
      },
      select: { fieldKey: true, status: true, value: true },
    }),
    prisma.lexCoherentAction.findMany({
      where: { ideaId }, orderBy: { createdAt: 'asc' }, select: { practicalStep: true, whoImplements: true },
    }),
    // §2d — "principal objections and the response to them" and "what remains unresolved" are
    // the SAME rows, split by status: ADDRESSED carries a response, OPEN does not yet.
    prisma.deepeningIssue.findMany({
      where: { ideaId, runVersion: buildVersion, status: { in: ['OPEN', 'ADDRESSED'] } },
      orderBy: { createdAt: 'asc' },
      select: { title: true, text: true, status: true, resolutionNote: true },
    }),
    prisma.evidenceItem.findMany({
      where: { ideaId, runVersion: buildVersion, status: 'ACCEPTED' },
      orderBy: { createdAt: 'asc' },
      select: { title: true, citation: true, url: true },
    }),
  ])
  if (!idea) throw new ExportUnavailableError('That idea no longer exists.')

  const rows = new Map(fieldRows.map((f) => [f.fieldKey, { status: f.status, value: f.value }]))
  const md: string[] = []

  md.push('## Who is submitting')
  md.push('', accepted(rows, 'aboutYou') ?? '*Not yet settled — the submitter should state who they are and any interest to declare here.*')

  md.push('', '## Summary')
  const challenge = accepted(rows, 'challenge')
  md.push('', challenge
    ? `In summary: ${challenge}`
    : '*The problem has not yet been settled on this proposal — there is nothing to summarise yet.*')

  md.push('', '## The problem and its diagnosis')
  md.push('', challenge ?? '*Not yet settled.*')
  const rootCause = accepted(rows, 'rootCause')
  if (rootCause) md.push('', `**Root cause.** ${rootCause}`)
  const diagnosis = accepted(rows, 'summaryDiagnosis')
  if (diagnosis) md.push('', diagnosis)

  md.push('', '## The proposed approach')
  const approach = accepted(rows, 'chosenApproach')
  md.push('', approach ?? '*No guiding policy has been settled on this proposal yet.*')
  const rulesOut = accepted(rows, 'whatItRulesOut')
  if (rulesOut) md.push('', rulesOut)

  md.push('', '## What it would take')
  const actionsSummary = accepted(rows, 'summaryCoherentActions')
  if (actionsSummary) md.push('', actionsSummary)
  if (actions.length) {
    for (const a of actions) {
      md.push(`- ${a.practicalStep}${a.whoImplements ? ` — ${a.whoImplements}` : ''}`)
    }
  } else if (!actionsSummary) {
    md.push('', '*No coherent actions have been recorded on this proposal yet.*')
  }

  // ══ §2e — THE HONEST ROWS SURVIVE. A submission that omits what nobody has measured is a
  // worse submission, not a tidier one — so OPEN issues print here as objections, unresolved,
  // rather than being held back until they look answerable. ══
  const open = issues.filter((i) => i.status === 'OPEN')
  const addressed = issues.filter((i) => i.status === 'ADDRESSED')
  md.push('', '## The principal objections, and the response to them')
  if (addressed.length) {
    for (const i of addressed) {
      md.push(`- **${i.title?.trim() || i.text.slice(0, 80)}** — ${i.resolutionNote?.trim() || i.text}`)
    }
  }
  if (!addressed.length && !open.length) {
    md.push('', '*No objections have been raised against this proposal in the research so far.*')
  }

  md.push('', '## What remains unresolved')
  if (open.length) {
    for (const i of open) md.push(`- ${i.title?.trim() || i.text}`)
  } else {
    md.push('', '*Nothing raised in the research remains unresolved.* That is a statement about what has been checked, not a claim that nothing more could be asked.')
  }

  const hasContent = !!(challenge || approach || rootCause || diagnosis || actions.length)
  return {
    buildId, buildVersion, composedAt: new Date(), composedLate: opts.late,
    body: md.join('\n'), hasContent,
  }
}

export async function snapshotCommitteeEvidence(ideaId: string, buildId: string, buildVersion: number): Promise<void> {
  const s = await composeCommitteeEvidence(ideaId, buildId, buildVersion, { late: false })
  await prisma.document.upsert({
    where: { ideaId_kind: { ideaId, kind: COMMITTEE_EVIDENCE_KIND } },
    create: { ideaId, kind: COMMITTEE_EVIDENCE_KIND, status: 'ready', summary: null, body: s.body, buildId, buildVersion },
    update: { status: 'ready', summary: null, body: s.body, buildId, buildVersion },
  })
  console.log('[lex-diag] 26g committee evidence snapshot written', { ideaId, buildId, buildVersion })
}

async function ensureCommitteeEvidence(ideaId: string): Promise<{
  body: string; buildId: string; buildVersion: number; updatedAt: Date; composedLate: boolean
}> {
  const latest = await prisma.ideaBuild.findFirst({
    where: { ideaId, status: 'DONE' }, orderBy: { version: 'desc' }, select: { id: true, version: true, completedAt: true },
  })
  if (!latest) throw new ExportUnavailableError('There is no completed build on this idea yet, so there is nothing to submit.')

  const doc = await prisma.document.findUnique({
    where: { ideaId_kind: { ideaId, kind: COMMITTEE_EVIDENCE_KIND } },
    select: { body: true, buildId: true, buildVersion: true, updatedAt: true, status: true },
  })
  if (doc?.body && doc.buildId === latest.id && doc.status === 'ready') {
    const late = !latest.completedAt || (doc.updatedAt.getTime() - latest.completedAt.getTime()) > 10 * 60 * 1000
    return { body: doc.body, buildId: latest.id, buildVersion: latest.version, updatedAt: doc.updatedAt, composedLate: late }
  }

  const s = await composeCommitteeEvidence(ideaId, latest.id, latest.version, { late: true })
  const written = await prisma.document.upsert({
    where: { ideaId_kind: { ideaId, kind: COMMITTEE_EVIDENCE_KIND } },
    create: { ideaId, kind: COMMITTEE_EVIDENCE_KIND, status: 'ready', summary: null, body: s.body, buildId: latest.id, buildVersion: latest.version },
    update: { status: 'ready', summary: null, body: s.body, buildId: latest.id, buildVersion: latest.version },
    select: { updatedAt: true },
  })
  return { body: s.body, buildId: latest.id, buildVersion: latest.version, updatedAt: written.updatedAt, composedLate: true }
}

export interface CommitteeEvidenceBuildResult {
  model: DocumentModel
  fingerprint: string
  sourceLabel: string
}

export async function buildCommitteeEvidence(ideaId: string): Promise<CommitteeEvidenceBuildResult> {
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true, stage: true } })
  if (!idea) throw new ExportUnavailableError('That idea no longer exists.')
  const snap = await ensureCommitteeEvidence(ideaId)
  const build = await prisma.ideaBuild.findUnique({ where: { id: snap.buildId }, select: { completedAt: true, startedAt: true } })
  const when = build?.completedAt ?? build?.startedAt ?? snap.updatedAt

  const blocks: Block[] = []
  blocks.push(...betaBlocks())
  // §4c — shown while true, plainly, before the submission itself.
  if (isFirstScrutiny(idea.stage)) blocks.push({ kind: 'note', text: FIRST_SCRUTINY_NOTE })
  const dot = COMMITTEE_EVIDENCE_OPENING.indexOf('. ') + 1
  blocks.push({ kind: 'paragraph', runs: [
    { text: COMMITTEE_EVIDENCE_OPENING.slice(0, dot), bold: true },
    { text: COMMITTEE_EVIDENCE_OPENING.slice(dot) },
  ] })
  blocks.push({ kind: 'paragraph', runs: [{
    text: snap.composedLate
      ? `Composed on ${snap.updatedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC from build `
        + `${snap.buildVersion}'s rows as they stood then. Regenerating re-renders this record; it does not search again.`
      : `Frozen when build ${snap.buildVersion} finished, on ${when.toISOString().slice(0, 16).replace('T', ' ')} UTC. `
        + 'Regenerating re-renders this record; it does not search again.',
    italic: true,
  }] })

  blocks.push(...markdownToBlocks(snap.body))

  // §2d — sources, last.
  const evidenceRows = await prisma.evidenceItem.findMany({
    where: { ideaId, runVersion: snap.buildVersion, status: 'ACCEPTED' },
    orderBy: { createdAt: 'asc' },
    select: { title: true, citation: true, url: true },
  })
  if (evidenceRows.length) {
    blocks.push({
      kind: 'sources',
      label: 'Sources',
      refs: evidenceRows.map((e): SourceRef => ({
        title: e.title, citation: e.citation ?? e.title, url: e.url ?? '',
      })),
    })
  }

  const sourceLabel = [
    `build ${snap.buildVersion} of this idea (${when.toISOString().slice(0, 16).replace('T', ' ')} UTC)`,
    'the stored Written Evidence snapshot',
  ].join(', ')

  return {
    model: {
      title: `${idea.title} — ${COMMITTEE_EVIDENCE_NAME}`,
      sourceLabel,
      generatedAt: new Date(),
      blocks,
    },
    fingerprint: `${snap.buildId}:${snap.body.length}`,
    sourceLabel,
  }
}
