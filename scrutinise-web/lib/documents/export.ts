// ─────────────────────────────────────────────────────────────────────────────
// §8.2 — the export service: build from stored state → render → R2 → record.
//
// The rule that shapes all of it: NEVER SERVE A STALE FILE SILENTLY. The stored
// pair carries the fingerprint of the state it was rendered from; every read
// compares that against the fingerprint of the state as it is NOW and reports
// `stale` when they differ. Re-running a search therefore doesn't corrupt the
// export — it marks it out of date and offers regeneration.
//
// Keys live alongside the existing corpus assets in the same private bucket,
// under `_exports/` so they are obviously not corpus data.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { r2Put, r2SignedUrl } from '@/lib/r2'
import { buildInitialBackground, ExportUnavailableError } from './build-initial-background'
import { renderDocx } from './render-docx'
import { renderPdf } from './render-pdf'

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
export const PDF_MIME = 'application/pdf'

export type ExportFormat = 'docx' | 'pdf'

export interface ExportStatus {
  documentId: string | null
  kind: string
  /** Has a briefing to export at all. */
  available: boolean
  /** Why not, when it isn't — stated plainly rather than an empty panel. */
  unavailableReason: string | null
  /** A rendered pair exists in R2. */
  generated: boolean
  generatedAt: string | null
  sourceLabel: string | null
  /** The stored file no longer matches the stored state it was made from. */
  stale: boolean
  docxUrl: string | null
  pdfUrl: string | null
  lastError: string | null
}

function exportKey(ideaId: string, kind: string, format: ExportFormat): string {
  return `_exports/${ideaId}/${kind.toLowerCase()}.${format}`
}

function downloadPath(ideaId: string, format: ExportFormat): string {
  return `/api/ideas/${ideaId}/documents/download?format=${format}`
}

/** A filename a user can find again on their own disk. */
export function exportFilename(ideaTitle: string, format: ExportFormat): string {
  const slug = (ideaTitle || 'idea')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'idea'
  return `${slug}-initial-background.${format}`
}

/**
 * Read the current export state. Cheap: it rebuilds the model to compute the
 * live fingerprint but renders nothing and writes nothing.
 */
export async function readExportStatus(ideaId: string): Promise<ExportStatus> {
  const doc = await prisma.document.findUnique({
    where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } },
    select: {
      id: true, docxKey: true, pdfKey: true, generatedAt: true,
      sourceFingerprint: true, sourceLabel: true, exportError: true,
    },
  })

  let liveFingerprint: string | null = null
  let unavailableReason: string | null = null
  try {
    liveFingerprint = (await buildInitialBackground(ideaId)).fingerprint
  } catch (err) {
    unavailableReason = err instanceof ExportUnavailableError
      ? err.message
      : 'The briefing could not be read just now.'
  }

  const generated = Boolean(doc?.docxKey && doc?.pdfKey)
  return {
    documentId: doc?.id ?? null,
    kind: 'INITIAL_BACKGROUND',
    available: liveFingerprint !== null,
    unavailableReason,
    generated,
    generatedAt: doc?.generatedAt ? doc.generatedAt.toISOString() : null,
    sourceLabel: doc?.sourceLabel ?? null,
    // Unknown fingerprints (a file generated before this field existed) count as
    // stale: "we cannot prove it is current" and "it is current" are not the same.
    stale: generated ? (!doc?.sourceFingerprint || doc.sourceFingerprint !== liveFingerprint) : false,
    docxUrl: generated ? downloadPath(ideaId, 'docx') : null,
    pdfUrl: generated ? downloadPath(ideaId, 'pdf') : null,
    lastError: doc?.exportError ?? null,
  }
}

/**
 * Render both formats from current stored state and store them. Idempotent by
 * fingerprint: if the pair already matches the live state, nothing is re-rendered
 * unless `force` is set.
 */
export async function generateExport(
  ideaId: string,
  opts: { force?: boolean } = {},
): Promise<ExportStatus> {
  const before = await readExportStatus(ideaId)
  if (!before.available) {
    // Refused, not faked. The caller surfaces this sentence to the user.
    throw new ExportUnavailableError(before.unavailableReason ?? 'There is nothing to export yet.')
  }
  if (before.generated && !before.stale && !opts.force) return before

  const { model, fingerprint, sourceLabel } = await buildInitialBackground(ideaId)

  try {
    const [docx, pdf] = await Promise.all([renderDocx(model), renderPdf(model)])
    const docxKey = exportKey(ideaId, 'INITIAL_BACKGROUND', 'docx')
    const pdfKey = exportKey(ideaId, 'INITIAL_BACKGROUND', 'pdf')
    await Promise.all([
      r2Put(docxKey, docx, DOCX_MIME),
      r2Put(pdfKey, pdf, PDF_MIME),
    ])

    // Both objects are up before the record points at them, so the DB never
    // advertises a file that isn't there.
    await prisma.document.update({
      where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } },
      data: {
        docxKey,
        pdfKey,
        docxUrl: downloadPath(ideaId, 'docx'),
        pdfUrl: downloadPath(ideaId, 'pdf'),
        generatedAt: model.generatedAt,
        sourceFingerprint: fingerprint,
        sourceLabel,
        exportError: null,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[export] generate failed', { ideaId, error: message })
    await prisma.document.update({
      where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } },
      data: { exportError: message.slice(0, 500) },
    }).catch(() => {})
    throw err
  }

  return readExportStatus(ideaId)
}

/**
 * A signed URL for one format. Returns `stale` alongside it so the caller can
 * refuse, regenerate, or warn — the decision is never made silently here.
 */
export async function signedDownload(
  ideaId: string,
  format: ExportFormat,
  filename: string,
): Promise<{ url: string; stale: boolean } | null> {
  const doc = await prisma.document.findUnique({
    where: { ideaId_kind: { ideaId, kind: 'INITIAL_BACKGROUND' } },
    select: { docxKey: true, pdfKey: true, sourceFingerprint: true },
  })
  const key = format === 'docx' ? doc?.docxKey : doc?.pdfKey
  if (!key) return null

  let stale = true
  try {
    stale = (await buildInitialBackground(ideaId)).fingerprint !== doc?.sourceFingerprint
  } catch {
    // The state can no longer be built (e.g. the search was reset). We cannot
    // prove the file is current, so we say it isn't.
    stale = true
  }
  return { url: await r2SignedUrl(key, { downloadAs: filename }), stale }
}
