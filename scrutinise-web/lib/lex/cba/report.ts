// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Y §4b / §5 (decision 336) — THE COST–BENEFIT REPORT as an Output Report: generated on demand from the lines and the tables,
// VERSIONED (a new generation is a new CbaReport row; nothing is overwritten), and marked "stale: N lines changed since" when the inputs move.
//
//   status   — every version, newest first, each with its stale count against the lines as they are now; the narrative's price to show
//   generate — the engine (free) → Lex's narrative (the only spend; optional) → the document (stage banner, as every kind) → Word + PDF in R2
//              at `_exports/{ideaId}/cba/v{n}.{docx|pdf}` (a version key never changes, so a link to v2 never changes under its reader)
//   Y2 §5    — "Impact Assessment (draft)" is listed beside it and NOT built: it waits for Ingest to hold the IA template.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { r2Put, r2SignedUrl } from '@/lib/r2'
import { renderDocx } from '@/lib/documents/render-docx'
import { renderPdf } from '@/lib/documents/render-pdf'
import { withStageBanner } from '@/lib/documents/stage-banner'
import { buildProposalSnapshot, SnapshotUnavailableError } from '@/lib/documents/proposal-snapshot'
import { snapshotStage, DOCX_MIME, PDF_MIME } from '@/lib/documents/proposal-export'
import { buildCbaReport } from '@/lib/documents/build-cba-report'
import { runCba, cbaInputs, changedSince } from './engine'
import { writeNarrative, type Narrative } from './narrative'
import { NARRATIVE_PRICE } from './prices'
import { resolveCitations } from './citation-manifest'

export const CBA_KIND = 'CBA'
export const IA_KIND = 'IA_DRAFT'
export const IA_NOT_AVAILABLE = 'not available: IA template not held'

export interface CbaVersionRow { version: number; createdAt: string; stale: { lines: number; period: boolean } | null; narrativePence: number | null; npv: string; bcr: string; gaps: number }
export interface CbaReportStatus {
  versions: CbaVersionRow[]
  /** The narrative's measured price (pence) — the only spend in a generation — or null with the reason. */
  price: { pence: number | null; note: string }
  ia: { available: false; reason: string }
}

export async function iaTemplateHeld(): Promise<boolean> {
  const n = await prisma.$queryRaw<Array<{ n: number }>>`SELECT count(*)::int n FROM corpus_sections WHERE corpus = 'govuk-core-docs' AND status = 'compiled' AND (id ILIKE '%impact-assessment-template%' OR "parentDocId" ILIKE '%impact-assessment-template%')`
  return (n[0]?.n ?? 0) > 0
}

export async function cbaReportStatus(ideaId: string): Promise<CbaReportStatus> {
  const [rows, now, iaHeld] = await Promise.all([
    prisma.cbaReport.findMany({ where: { ideaId, kind: CBA_KIND }, orderBy: { version: 'desc' }, select: { version: true, createdAt: true, inputs: true, narrativePence: true, result: true } }),
    cbaInputs(ideaId),
    iaTemplateHeld(),
  ])
  return {
    versions: rows.map((r) => {
      const res = r.result as { npvWords?: string; bcrWords?: string; gaps?: number }
      return { version: r.version, createdAt: r.createdAt.toISOString(), stale: now ? changedSince((r.inputs as { fingerprint: Record<string, string> }).fingerprint ?? {}, now.fingerprint) : null, narrativePence: r.narrativePence, npv: res.npvWords ?? '', bcr: res.bcrWords ?? '', gaps: res.gaps ?? 0 }
    }),
    price: NARRATIVE_PRICE.pence != null ? { pence: NARRATIVE_PRICE.pence, note: NARRATIVE_PRICE.note } : { pence: null, note: NARRATIVE_PRICE.note },
    ia: { available: false, reason: iaHeld ? 'not available: the IA template is held but the IA draft is not built yet' : IA_NOT_AVAILABLE },
  }
}

const key = (ideaId: string, v: number, f: 'docx' | 'pdf') => `_exports/${ideaId}/cba/v${v}.${f}`

export type GenerateResult = { ok: true; version: number; pence: number | null; narrativeNote: string | null } | { ok: false; error: string; status: number }

export async function generateCbaReport(ideaId: string, userId: string, opts: { narrative?: boolean; now?: Date; narrativeFor?: (n: Parameters<typeof writeNarrative>) => ReturnType<typeof writeNarrative> } = {}): Promise<GenerateResult> {
  const run = await runCba(ideaId, { now: opts.now })
  if (!run) return { ok: false, error: 'That idea was not found.', status: 404 }
  if (!run.result.ok) return { ok: false, error: `The report was not made: ${(run.result as { error: string }).error}`, status: 422 }
  let snapshot
  try { snapshot = await buildProposalSnapshot(ideaId) } catch (e) {
    return { ok: false, error: e instanceof SnapshotUnavailableError ? `The report was not made: ${e.message}` : 'The report was not made: the proposal could not be read just now.', status: 422 }
  }
  const idea = await prisma.idea.findUnique({ where: { id: ideaId }, select: { title: true } })
  let narrative: Narrative | null = null
  let narrativeNote: string | null = null
  let pence: number | null = null
  if (opts.narrative !== false) {
    const call = opts.narrativeFor ?? ((a: Parameters<typeof writeNarrative>) => writeNarrative(...a))
    const n = await call([run.inputs.input, run.result, { ideaId, userId }])
    if (n.ok) { narrative = (n as { data: Narrative }).data; pence = narrative.pence } else { const f = n as { error: string; pence: number | null }; narrativeNote = f.error; pence = f.pence }
  } else narrativeNote = 'Generated without Lex’s narrative (the owner chose the free version).'
  const last = await prisma.cbaReport.findFirst({ where: { ideaId, kind: CBA_KIND }, orderBy: { version: 'desc' }, select: { version: true } })
  const version = (last?.version ?? 0) + 1
  const generatedAt = opts.now ?? new Date()
  const built = buildCbaReport(run.result as Extract<typeof run.result, { ok: true }>, narrative, { ideaTitle: idea?.title || 'Untitled idea', version, heldOn: run.inputs.heldOn, generatedAt, narrativeNote })
  const model = withStageBanner(built.model, snapshotStage(snapshot))
  const [docx, pdf] = await Promise.all([renderDocx(model), renderPdf(model)])
  const docxKey = key(ideaId, version, 'docx'), pdfKey = key(ideaId, version, 'pdf')
  await Promise.all([r2Put(docxKey, docx, DOCX_MIME), r2Put(pdfKey, pdf, PDF_MIME)])
  const r = run.result as Extract<typeof run.result, { ok: true }>
  await prisma.cbaReport.create({ data: {
    ideaId, kind: CBA_KIND, version, generatedById: userId, docxKey, pdfKey, narrativePence: pence,
    narrative: narrative ? `${narrative.costs}\n\n${narrative.benefits}` : null,
    inputs: { fingerprint: run.inputs.fingerprint, heldOn: run.inputs.heldOn } as never,
    // key → section id → text hash for every citation this version prints (CCh GO 18 Nov), so a re-pointed key can be shown later
    result: { npvWords: r.trace.npv.value, bcrWords: r.trace.bcr.value, gaps: r.gaps.length, printed: built.printed, engine: r, citationsResolved: await resolveCitations(r.citations) } as never,
  } })
  return { ok: true, version, pence, narrativeNote }
}

export async function cbaDownload(ideaId: string, version: number, format: 'docx' | 'pdf', filename: string): Promise<string | null> {
  const row = await prisma.cbaReport.findUnique({ where: { ideaId_kind_version: { ideaId, kind: CBA_KIND, version } }, select: { docxKey: true, pdfKey: true } })
  const k = format === 'docx' ? row?.docxKey : row?.pdfKey
  return k ? r2SignedUrl(k, { downloadAs: filename }) : null
}
