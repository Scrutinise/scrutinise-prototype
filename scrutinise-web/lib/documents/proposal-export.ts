// ─────────────────────────────────────────────────────────────────────────────
// Sprint 20-B — the proposal export service.
//
// Two document kinds through Sprint 2.5's pipeline (build → render → R2 →
// record), and one extra idea it needs that the briefing did not: A RENDER CAN
// BE OF THE WORKING DRAFT OR OF A PUBLISHED VERSION, and the two must never be
// confused.
//
//   WORKING RENDER   `_exports/{ideaId}/{kind}.{fmt}`
//                    Rendered from live state. Goes STALE the moment the state
//                    moves, exactly like the briefing export, and says so.
//
//   VERSION RENDER   `_exports/{ideaId}/v{n}/{kind}.{fmt}`
//                    Rendered from a stored snapshot. ⚠ CANNOT GO STALE — a
//                    version is immutable, so the file and the state it came
//                    from can never drift apart. That is not a claim to be
//                    trusted: it is a consequence of the key carrying `v{n}` and
//                    the snapshot never being rewritten.
//
// ⚠ WHY THE VERSION KEY MATTERS MORE THAN IT LOOKS. Without `v{n}` in the key, a
// re-render for v3 would overwrite the object a recipient's v1 link points at,
// and their document would change under them WITHOUT the URL changing — the same
// failure the pinned `publishedProposalVersionId` exists to prevent, arriving
// through the storage layer instead.
//
// The staleness rule from §8.2 is inherited whole: NEVER SERVE A STALE FILE
// SILENTLY.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { r2Put, r2SignedUrl, r2Exists } from '@/lib/r2'
import { renderDocx } from './render-docx'
import { renderPdf } from './render-pdf'
import { buildMeetingPackDocument, type MeetingPackSection } from './build-meeting-pack'
import { buildProposalDocument, buildSummaryDocument, type ProposalBuildResult } from './build-proposal'
import { buildEvidencePackDocument } from './build-evidence-pack'
import {
  buildProposalSnapshot,
  snapshotHash,
  SnapshotUnavailableError,
  type ProposalSnapshot,
} from './proposal-snapshot'

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const PDF_MIME = 'application/pdf'

export type ExportFormat = 'docx' | 'pdf'

/**
 * The kinds that render. `EVIDENCE_PACK` joined them in 20-E; the Online View is a PAGE
 * rather than a file and so is not a kind here, and the standalone Legislative Annex stays
 * scaffolded because its substance waits on the AMENDABLE_SECTION search intent.
 */
// ⚠ 25-N §5e — `MEETING_PACK` IS A THIRD KIND, NOT A VARIANT OF THE PROPOSAL. It is written
// for a different reader (somebody who will contribute but not join the team) and it inverts
// the order every other document uses — what is open first, the settled kernel last. Making it
// an option on `PROPOSAL` would have meant one builder with a mode flag, and the two readers
// would have started sharing sentences that are right for one of them.
export const PROPOSAL_KINDS = ['PROPOSAL', 'PROPOSAL_SUMMARY', 'MEETING_PACK', 'EVIDENCE_PACK'] as const
export type ProposalKind = (typeof PROPOSAL_KINDS)[number]

const KIND_LABEL: Record<ProposalKind, string> = {
  PROPOSAL: 'The Proposal',
  PROPOSAL_SUMMARY: 'The Summary',
  MEETING_PACK: 'The Meeting Pack',
  EVIDENCE_PACK: 'The Evidence Pack',
}

const KIND_SLUG: Record<ProposalKind, string> = {
  PROPOSAL: 'proposal',
  PROPOSAL_SUMMARY: 'summary',
  MEETING_PACK: 'meeting-pack',
  EVIDENCE_PACK: 'evidence-pack',
}

export function isProposalKind(v: string): v is ProposalKind {
  return (PROPOSAL_KINDS as readonly string[]).includes(v)
}

export interface ProposalExportStatus {
  kind: ProposalKind
  label: string
  available: boolean
  unavailableReason: string | null
  generated: boolean
  generatedAt: string | null
  sourceLabel: string | null
  /** 25-N §5d — `null` means "not checked on this read". Never rendered as "current". */
  stale: boolean | null
  /** Which stored version this file came from; null when it is the working draft. */
  fromVersionNumber: number | null
  docxUrl: string | null
  pdfUrl: string | null
  lastError: string | null
}

function workingKey(ideaId: string, kind: ProposalKind, format: ExportFormat): string {
  return `_exports/${ideaId}/${KIND_SLUG[kind]}.${format}`
}

function versionKey(ideaId: string, versionNumber: number, kind: ProposalKind, format: ExportFormat): string {
  return `_exports/${ideaId}/v${versionNumber}/${KIND_SLUG[kind]}.${format}`
}

function downloadPath(ideaId: string, kind: ProposalKind, format: ExportFormat): string {
  return `/api/ideas/${ideaId}/document/download?kind=${kind}&format=${format}`
}

/** A filename a recipient can find again on their own disk. */
export function proposalFilename(
  title: string,
  kind: ProposalKind,
  format: ExportFormat,
  versionNumber?: number | null,
): string {
  const slug = (title || 'proposal')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'proposal'
  const v = versionNumber ? `-v${versionNumber}` : ''
  return `${slug}-${KIND_SLUG[kind]}${v}.${format}`
}

/**
 * Snapshot → the two rendered buffers, for one kind. The ONLY place that decides
 * which builder a kind maps to.
 */
export function buildFor(
  kind: ProposalKind,
  snapshot: ProposalSnapshot,
  onlineViewUrl?: string | null,
  opts: { sections?: MeetingPackSection[] } = {},
): ProposalBuildResult {
  switch (kind) {
    case 'PROPOSAL': return buildProposalDocument(snapshot)
    case 'EVIDENCE_PACK': return buildEvidencePackDocument(snapshot)
    case 'PROPOSAL_SUMMARY': return buildSummaryDocument(snapshot, { onlineViewUrl })
    // §5e — `sections` is what the user chose to show before printing. Absent means all of
    // them: not choosing is not the same as choosing to omit.
    case 'MEETING_PACK': return buildMeetingPackDocument(snapshot, { sections: opts.sections, onlineViewUrl })
  }
}

async function renderPair(result: ProposalBuildResult): Promise<{ docx: Buffer; pdf: Buffer }> {
  const [docx, pdf] = await Promise.all([renderDocx(result.model), renderPdf(result.model)])
  return { docx, pdf }
}

// ── working-draft renders ────────────────────────────────────────────────────

/**
 * ══ 25-N §5d — WHY THIS FUNCTION TAKES SECONDS, AND WHAT `quick` IS FOR ═════════
 *
 * §5d: *"Outputs takes ~5 seconds to show anything. If generation is happening, say 'Building
 * reports'; if it is a page load, fix it. Report which it was."*
 *
 * ⚠⚠ IT IS A PAGE LOAD, AND THE COST IS ONE LINE: `buildProposalSnapshot(ideaId)`. That is the
 * whole 900-line assembler — fields, causes, options, actions, cost lines, evidence, sources,
 * known unknowns, issues, testimony, across a dozen tables — and it is called on every GET for
 * ONE PURPOSE: to hash it, so a generated file can be reported as stale. Nothing else on the
 * panel needs it. So the user waits five seconds for the answer to "is this file current?"
 * before being shown the file's name.
 *
 * ⚠ THE FIX IS NOT TO DROP THE STALENESS CHECK. "Generated" and "generated from what the
 * proposal says NOW" are different facts, and the second is the one that matters to somebody
 * about to send a document to an MP (25-M §1). It is to stop the FAST facts waiting on the SLOW
 * one: `quick: true` returns everything the `Document` rows already know — name, whether it
 * exists, when, its download links, its last error — and marks staleness UNKNOWN. The panel
 * paints on that and asks again without it.
 *
 * ⚠⚠ AND UNKNOWN IS NOT "FRESH". `stale: null` is a third state and the panel says so in words
 * ("checking…"), because an unproven-current file rendered as current is the exact claim this
 * fingerprint exists to prevent — CLAUDE.md §19, a fact measured and a fact assumed must not
 * look identical on the page.
 */
export async function readProposalExportStatus(
  ideaId: string,
  opts: { quick?: boolean } = {},
): Promise<ProposalExportStatus[]> {
  let liveHash: string | null = null
  let unavailableReason: string | null = null
  if (!opts.quick) {
    try {
      liveHash = snapshotHash(await buildProposalSnapshot(ideaId))
    } catch (err) {
      unavailableReason = err instanceof SnapshotUnavailableError
        ? err.message
        : 'The proposal state could not be read just now.'
    }
  }

  const docs = await prisma.document.findMany({
    where: { ideaId, kind: { in: [...PROPOSAL_KINDS] } },
    select: {
      kind: true, docxKey: true, pdfKey: true, generatedAt: true,
      sourceFingerprint: true, sourceLabel: true, exportError: true,
      proposalVersion: { select: { versionNumber: true } },
    },
  })

  return PROPOSAL_KINDS.map((kind) => {
    const doc = docs.find((d) => d.kind === kind)
    const generated = Boolean(doc?.docxKey && doc?.pdfKey)
    return {
      kind,
      label: KIND_LABEL[kind],
      // ⚠ ON A QUICK READ WE HAVE NOT ASKED, so "available" cannot be claimed either way; the
      // optimistic answer is the safe one here because the POST re-checks properly before it
      // renders anything, and a greyed-out Generate on a proposal that is fine is the defect
      // 25-K §2 spent a sprint removing.
      available: opts.quick ? true : liveHash !== null,
      unavailableReason,
      generated,
      generatedAt: doc?.generatedAt ? doc.generatedAt.toISOString() : null,
      sourceLabel: doc?.sourceLabel ?? null,
      // ⚠ A file rendered from a stored VERSION is never stale — the version does
      // not move. Only a working-draft render can drift from live state.
      // And an UNKNOWN fingerprint counts as stale: "we cannot prove it is
      // current" and "it is current" are not the same (§8.2's rule, inherited).
      // ⚠ THREE STATES, NOT TWO: false (current), true (out of date), null (not checked yet).
      // See the header — `null` is what the quick read returns, and the panel renders it as a
      // question rather than as an answer.
      stale: opts.quick && generated
        ? null
        : generated
          ? doc?.proposalVersion
            ? false
            : !doc?.sourceFingerprint || doc.sourceFingerprint !== liveHash
          : false,
      fromVersionNumber: doc?.proposalVersion?.versionNumber ?? null,
      docxUrl: generated ? downloadPath(ideaId, kind, 'docx') : null,
      pdfUrl: generated ? downloadPath(ideaId, kind, 'pdf') : null,
      lastError: doc?.exportError ?? null,
    }
  })
}

/**
 * Render one kind from live state and store it. Idempotent by fingerprint unless
 * `force`.
 */
export async function generateProposalExport(
  ideaId: string,
  kind: ProposalKind,
  opts: { force?: boolean; onlineViewUrl?: string | null; sections?: MeetingPackSection[] } = {},
): Promise<ProposalExportStatus> {
  const snapshot = await buildProposalSnapshot(ideaId)
  // ⚠⚠ 25-N §5e — THE CHOSEN SECTIONS ARE PART OF THE FINGERPRINT, and they have to be.
  // The store is idempotent by hash: without this, a user who unticked two sections and pressed
  // Generate again would get the CACHED file back — the same document, reported as freshly
  // generated, with the sections they thought they had removed still in it. The proposal has
  // not changed, so the snapshot hash has not changed; what changed is what they asked for.
  const hash = kind === 'MEETING_PACK' && opts.sections?.length
    ? `${snapshotHash(snapshot)}:${[...opts.sections].sort().join(',')}`
    : snapshotHash(snapshot)

  const existing = await prisma.document.findUnique({
    where: { ideaId_kind: { ideaId, kind } },
    select: { docxKey: true, pdfKey: true, sourceFingerprint: true, proposalVersionId: true },
  })
  if (
    !opts.force && existing?.docxKey && existing?.pdfKey &&
    existing.sourceFingerprint === hash && !existing.proposalVersionId
  ) {
    return (await readProposalExportStatus(ideaId)).find((s) => s.kind === kind)!
  }

  const result = buildFor(kind, snapshot, opts.onlineViewUrl, { sections: opts.sections })

  try {
    const { docx, pdf } = await renderPair(result)
    const docxKey = workingKey(ideaId, kind, 'docx')
    const pdfKey = workingKey(ideaId, kind, 'pdf')
    // Both objects are up before the record points at them, so the DB never
    // advertises a file that is not there.
    await Promise.all([r2Put(docxKey, docx, DOCX_MIME), r2Put(pdfKey, pdf, PDF_MIME)])

    await prisma.document.upsert({
      where: { ideaId_kind: { ideaId, kind } },
      create: {
        ideaId, kind, status: 'ready',
        docxKey, pdfKey,
        docxUrl: downloadPath(ideaId, kind, 'docx'),
        pdfUrl: downloadPath(ideaId, kind, 'pdf'),
        generatedAt: result.model.generatedAt,
        sourceFingerprint: result.fingerprint,
        sourceLabel: result.sourceLabel,
        proposalVersionId: null,
        exportError: null,
      },
      update: {
        status: 'ready',
        docxKey, pdfKey,
        docxUrl: downloadPath(ideaId, kind, 'docx'),
        pdfUrl: downloadPath(ideaId, kind, 'pdf'),
        generatedAt: result.model.generatedAt,
        sourceFingerprint: result.fingerprint,
        sourceLabel: result.sourceLabel,
        // ⚠ Cleared on purpose. This render IS the working draft; leaving a stale
        // version id here would label a draft as "what the recipient holds".
        proposalVersionId: null,
        exportError: null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[proposal-export] generate failed', { ideaId, kind, error: message })
    await prisma.document.upsert({
      where: { ideaId_kind: { ideaId, kind } },
      create: { ideaId, kind, status: 'failed', exportError: message.slice(0, 500) },
      update: { exportError: message.slice(0, 500) },
    }).catch(() => {})
    throw err
  }

  return (await readProposalExportStatus(ideaId)).find((s) => s.kind === kind)!
}

// ── version renders ──────────────────────────────────────────────────────────

export interface VersionExportKeys {
  docxKey: string
  pdfKey: string
  versionNumber: number
}

/**
 * The rendered pair for a STORED version, rendering it on first request and
 * reusing it afterwards.
 *
 * ⚠ `r2Exists` first, not a database flag. A DB row saying "generated" while the
 * object is missing is the shape of the outage this codebase keeps meeting; the
 * store itself is the only honest answer to "is the file there".
 */
export async function ensureVersionExport(
  ideaId: string,
  versionNumber: number,
  kind: ProposalKind,
  opts: { onlineViewUrl?: string | null } = {},
): Promise<VersionExportKeys> {
  const docxKey = versionKey(ideaId, versionNumber, kind, 'docx')
  const pdfKey = versionKey(ideaId, versionNumber, kind, 'pdf')

  const [hasDocx, hasPdf] = await Promise.all([r2Exists(docxKey), r2Exists(pdfKey)])
  if (hasDocx && hasPdf) return { docxKey, pdfKey, versionNumber }

  // Reads the STORED snapshot — never rebuilt from today's rows.
  const snapshot = await buildProposalSnapshot(ideaId, versionNumber)
  const result = buildFor(kind, snapshot, opts.onlineViewUrl)
  const { docx, pdf } = await renderPair(result)
  await Promise.all([r2Put(docxKey, docx, DOCX_MIME), r2Put(pdfKey, pdf, PDF_MIME)])
  return { docxKey, pdfKey, versionNumber }
}

// ── download ─────────────────────────────────────────────────────────────────

export interface SignedProposalDownload {
  url: string
  stale: boolean
  versionNumber: number | null
}

/**
 * A signed URL for one kind and format.
 *
 * `versionNumber` given → the immutable version render (never stale).
 * `versionNumber` null  → the working draft, with its staleness reported so the
 *                         caller can refuse, regenerate, or warn. The decision is
 *                         never made silently here.
 */
export async function signedProposalDownload(
  ideaId: string,
  kind: ProposalKind,
  format: ExportFormat,
  filename: string,
  versionNumber: number | null,
  opts: { onlineViewUrl?: string | null } = {},
): Promise<SignedProposalDownload | null> {
  if (versionNumber != null) {
    const keys = await ensureVersionExport(ideaId, versionNumber, kind, opts)
    const key = format === 'docx' ? keys.docxKey : keys.pdfKey
    return { url: await r2SignedUrl(key, { downloadAs: filename }), stale: false, versionNumber }
  }

  const doc = await prisma.document.findUnique({
    where: { ideaId_kind: { ideaId, kind } },
    select: { docxKey: true, pdfKey: true, sourceFingerprint: true, proposalVersionId: true },
  })
  const key = format === 'docx' ? doc?.docxKey : doc?.pdfKey
  if (!key) return null

  let stale = true
  try {
    stale = snapshotHash(await buildProposalSnapshot(ideaId)) !== doc?.sourceFingerprint
  } catch {
    stale = true
  }
  return { url: await r2SignedUrl(key, { downloadAs: filename }), stale, versionNumber: null }
}
