// ─────────────────────────────────────────────────────────────────────────────
// §8.2 — build the Initial Background document model from STORED STATE ONLY.
//
// Every value here comes from a row that already exists: the `Document` record
// (summary + body) and `Idea.legislationRefs` (the Page-1 source cards). Nothing
// is searched, summarised or written at export time. If the briefing is missing,
// the export is refused rather than filled in — the same honesty rule the panel
// follows (§19-C 1a).
//
// The one derived value is `sourceFingerprint`: a hash over exactly the bytes
// that were rendered, so a later export can tell whether the file it holds still
// matches the state it came from.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'crypto'
import { betaBlocks } from './build-proposal'
import { BETA_MARKER } from '../lex/beta-disclosure'
import { prisma } from '@/lib/prisma'
import type { Block, DocumentModel, SourceRef } from './model'
import { markdownToBlocks } from './markdown'
import { repairRefUrl } from '@/lib/lex/legislation-url'
import { INITIAL_BACKGROUND_NAME, FIRST_PASS_CAVEAT } from './initial-background-name'

/**
 * Pilot feedback (Angus Barry, 16 Sep 2026) — rendered layout, in the fingerprint.
 *
 * The fingerprint covers the STORED VALUES that were rendered; it cannot see that the
 * renderer now puts a caveat and a name on the page that the stored file does not carry.
 * Without this token every file generated before the change reads as current and is served
 * without the caveat. Bump it when what the file says changes for a reason the rows cannot show.
 */
const LAYOUT_VERSION = 'v2-named-with-first-pass-caveat'

// ⚠ `Record<string, string>`, not `Record<SearchResultType, string>` — so tsc does NOT force a
// new display type to be added here, and TYPE_ORDER below is a plain array for the same reason.
// A type absent from both is silently missing from the stored briefing. `check:corpus-types`
// asserts both against the live union; keep them in step with BackgroundPanel.tsx.
const TYPE_LABELS: Record<string, string> = {
  PRIMARY_LEGISLATION: 'Primary legislation',
  STATUTORY_INSTRUMENT: 'Statutory instruments',
  EU_LEGISLATION: 'Retained EU law',
  EXPLANATORY_NOTE: 'What the law was for',
  IMPACT_ASSESSMENT: 'What it was expected to cost',
  DEBATE: 'Debates',
  DIVISION: 'How they voted',
  CONSULTATION: 'Who was asked',
  COMMITTEE: 'Committee reports',
  CASE_LAW: 'Case law',
  BILL: 'Bills',
  TREATY: 'Treaties',
  GUIDANCE: 'Guidance & regulators',
}
const TYPE_ORDER = [
  'PRIMARY_LEGISLATION', 'STATUTORY_INSTRUMENT', 'EU_LEGISLATION', 'EXPLANATORY_NOTE',
  'IMPACT_ASSESSMENT', 'DEBATE', 'DIVISION', 'COMMITTEE', 'CONSULTATION',
  'CASE_LAW', 'BILL', 'TREATY', 'GUIDANCE',
]

interface StoredRef {
  id?: string
  type?: string
  title?: string
  citation?: string
  url?: string
  snippet?: string
  date?: string
}

export interface BuildResult {
  model: DocumentModel
  /** sha-256 over exactly the stored values that were rendered. */
  fingerprint: string
  sourceLabel: string
}

/** Why an export could not be built — stated, never papered over. */
export class ExportUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExportUnavailableError'
  }
}

function refsFrom(raw: unknown): StoredRef[] {
  return Array.isArray(raw) ? (raw as StoredRef[]) : []
}

export async function buildInitialBackground(ideaId: string): Promise<BuildResult> {
  const [doc, idea] = await Promise.all([
    prisma.document.findUnique({
      where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } },
      select: { status: true, summary: true, body: true, updatedAt: true },
    }),
    prisma.idea.findUnique({
      where: { id: ideaId },
      select: { title: true, legislationRefs: true, stageSearches: true },
    }),
  ])

  if (!idea) throw new ExportUnavailableError('That idea no longer exists.')
  if (!doc) {
    throw new ExportUnavailableError(
      'There is no Initial Background briefing on this idea yet, so there is nothing to export.',
    )
  }
  if (doc.status === 'failed') {
    throw new ExportUnavailableError(
      'The briefing search did not complete, so there is no briefing to export. Re-run the search first.',
    )
  }
  if (!doc.body || !doc.body.trim()) {
    throw new ExportUnavailableError(
      'The briefing is still being prepared — there is no text to export yet.',
    )
  }

  const refs = refsFrom(idea.legislationRefs)
  const grouped = TYPE_ORDER
    .map((t) => ({ type: t, items: refs.filter((r) => r.type === t) }))
    .filter((g) => g.items.length > 0)

  const blocks: Block[] = []
  // ⚠ THE CAVEAT SITS AT THE TOP, BEFORE ANYTHING ELSE — Charlie's placement, pilot feedback
  // of 16 Sep 2026. A paragraph, not a `note`: the beta disclosure below renders as small
  // muted italics, and small print is exactly what this must not be. First sentence bold.
  const dot = FIRST_PASS_CAVEAT.indexOf('. ') + 1
  blocks.push({ kind: 'paragraph', runs: [
    { text: FIRST_PASS_CAVEAT.slice(0, dot), bold: true },
    { text: FIRST_PASS_CAVEAT.slice(dot) },
  ] })
  // ⚠ 25-V §11a/§11b — the disclosure, on every generated document. See `betaBlocks`.
  // Second here, because the caveat above is Charlie's later and more specific placement.
  blocks.push(...betaBlocks())

  if (doc.summary && doc.summary.trim()) {
    blocks.push({ kind: 'note', text: doc.summary.trim() })
  }

  blocks.push(...markdownToBlocks(doc.body))

  if (grouped.length) {
    blocks.push({ kind: 'rule' })
    blocks.push({ kind: 'heading', level: 2, runs: [{ text: 'Sources' }] })
    for (const g of grouped) {
      const sources: SourceRef[] = g.items.map((r) => ({
        title: r.title?.trim() || 'Untitled source',
        citation: r.citation?.trim() || '',
        // §19-D Task 5 — repaired on the way out, so briefings exported before the
        // fix (and every ref already stored on an idea) carry links that open. It
        // changes the fingerprint, which correctly marks a stored export stale.
        url: repairRefUrl(r.type, r.id, r.url)?.trim() || '',
        snippet: r.snippet?.trim() || undefined,
        date: r.date?.trim() || undefined,
      }))
      blocks.push({ kind: 'sources', label: TYPE_LABELS[g.type] ?? g.type, refs: sources })
    }
  }

  // "What it was generated from", in words a user can check.
  const searchRanAt = (() => {
    const s = idea.stageSearches as { byStage?: Record<string, { ranAt?: string }> } | null
    const ranAt = s?.byStage?.ORIENTATION?.ranAt
    return typeof ranAt === 'string' ? ranAt : null
  })()
  const sourceLabel = [
    'the stored Initial Background briefing',
    `${refs.length} source${refs.length === 1 ? '' : 's'}`,
    searchRanAt ? `corpus search of ${new Date(searchRanAt).toISOString().slice(0, 16).replace('T', ' ')} UTC` : null,
  ].filter(Boolean).join(', ')

  // The fingerprint covers exactly what was rendered — body, summary and the
  // reference list. A re-run search that changes any of them makes the stored
  // file stale, and the UI says so rather than serving it.
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({
      layout: LAYOUT_VERSION,
      title: idea.title,
      summary: doc.summary ?? '',
      body: doc.body,
      refs: refs.map((r) => [r.id ?? '', r.type ?? '', r.title ?? '', r.citation ?? '', repairRefUrl(r.type, r.id, r.url)]),
    }))
    .digest('hex')

  return {
    model: {
      // The document's own name is the title; the idea is the subtitle. What the tab calls
      // it, the file calls itself.
      title: INITIAL_BACKGROUND_NAME,
      subtitle: `${idea.title || 'Untitled idea'} · ${BETA_MARKER}`,
      sourceLabel,
      generatedAt: new Date(),
      blocks,
    },
    fingerprint,
    sourceLabel,
  }
}

/** The fingerprint of the CURRENT stored state, without building the document. */
export async function currentFingerprint(ideaId: string): Promise<string | null> {
  try {
    return (await buildInitialBackground(ideaId)).fingerprint
  } catch {
    return null
  }
}
