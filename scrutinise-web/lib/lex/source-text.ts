// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-W §4c (decision 304) — READ A FILED SOURCE IN FULL. The counterpart of read_section for the user's own sources.
//
// Before 26-W, Lex's read_source returned at most 12 extracted FINDINGS of a filed document, each clipped to 700 characters. On 2 Nov
// Charlie filed the Civil Service Code ([Ref: 218], 12,446 characters held) and the Civil Service Management Code ([Ref: 217], 192,110
// characters held) so Lex could model a draft on them; Lex saw six and five extracts. The whole text was held all along, in
// IdeaUserMaterial.text ("the only copy of the content we hold").
//
// readSourceText reads the held text of one [Ref: n] (or a filed material's 8-character id) in parts:
//   DOCUMENT / URL with a material → the material's extracted text, whitespace and line breaks kept (form matters when modelling style)
//   CORPUS                        → read-section.ts's readSection on its corpus key (the same reader read_section uses)
//   OWN_OBSERVATION / no text      → what is held, labelled for what it is ("only a summary is held"), never presented as the full text
// ⚠ `held` says which. A source whose full text is not held must never come back looking like one that is (26-E §3c, 26-W §7.5).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'
import { readSection } from '@/lib/lex/read-section'

/** One part of a long text. 15,000 characters ≈ 3,750 tokens: the 12,446-character Civil Service Code comes back in one part. */
export const SOURCE_PART_CHARS = 15_000
export const SOURCE_PART_MAX = 30_000

export type SourceHeld = 'full text' | 'summary only' | 'nothing'
export interface SourceText {
  ref: number | null
  title: string
  kind: string
  url: string | null
  held: SourceHeld
  /** Why the full text is not held, in words. Set whenever held is not "full text". */
  note?: string
  text: string
  from: number
  to: number
  total: number
  /** Pass as `from` to read on. Absent once the end is reached. */
  nextFrom?: number
  complete: boolean
  /** The corpus id, when the source is a corpus section (it may then be cited like one search_corpus returned). */
  corpusId?: string
}

type Found = { ok: true; data: SourceText } | { ok: false; error: string }

const slice = (body: string, from: number, size: number) => {
  const total = body.length
  const start = Math.max(0, Math.min(from, total))
  const to = Math.min(total, start + size)
  return { text: body.slice(start, to), from: start, to, total, nextFrom: to < total ? to : undefined, complete: to >= total }
}

/**
 * The held text of one filed source, from `from`, at most `size` characters. `key` is a [Ref: n] number, or the 8-character id of a filed
 * document as list_sources gives it. Never throws for a missing source: says so in words.
 */
export async function readSourceText(ideaId: string, key: { ref?: number; materialId?: string }, opts: { from?: number; size?: number } = {}): Promise<Found> {
  const from = Math.max(0, opts.from ?? 0)
  const size = Math.min(SOURCE_PART_MAX, Math.max(1000, opts.size ?? SOURCE_PART_CHARS))

  let src: { number: number | null; kind: string; title: string; url: string | null; snippet: string | null; corpusKey: string | null; materialId: string | null } | null = null
  if (key.ref != null) {
    src = await prisma.ideaSource.findFirst({ where: { ideaId, number: key.ref }, select: { number: true, kind: true, title: true, url: true, snippet: true, corpusKey: true, materialId: true } })
    if (!src) {
      const top = await prisma.ideaSource.aggregate({ where: { ideaId }, _max: { number: true } })
      return { ok: false, error: `there is no [Ref: ${key.ref}] on this idea${top._max.number ? ` — the references run from 1 to ${top._max.number}` : ''}.` }
    }
  }

  // a filed document or page: the material's whole extracted text
  const materialId = src?.materialId ?? null
  let material = null as null | { id: string; label: string; url: string | null; status: string; text: string | null; failureReason: string | null }
  if (materialId || key.materialId) {
    const mats = await prisma.ideaUserMaterial.findMany({ where: { ideaId, ...(materialId ? { id: materialId } : {}) }, select: { id: true, label: true, url: true, status: true, text: true, failureReason: true } })
    material = materialId ? mats[0] ?? null : mats.find((m) => m.id.startsWith(String(key.materialId).toLowerCase())) ?? null
    if (!material) return { ok: false, error: key.ref != null ? `[Ref: ${key.ref}]'s filed document is no longer on this idea.` : `no filed source on this idea matches "${key.materialId}".` }
    if (!src) src = await prisma.ideaSource.findFirst({ where: { ideaId, materialId: material.id }, select: { number: true, kind: true, title: true, url: true, snippet: true, corpusKey: true, materialId: true } })
  }
  const ref = src?.number ?? null
  const title = src?.title ?? material?.label ?? ''
  const url = src?.url ?? material?.url ?? null
  const kind = src?.kind ?? 'DOCUMENT'

  if (material) {
    if (material.text?.trim()) return { ok: true, data: { ref, title, kind, url, held: 'full text', ...slice(material.text, from, size) } }
    const why = material.status === 'FAILED' ? `the text could not be extracted (${material.failureReason ?? 'no reason recorded'})` : material.status === 'PENDING' ? 'the text is still being extracted' : 'no text was extracted from it'
    return { ok: true, data: { ref, title, kind, url, held: 'nothing', note: `The full text of this source is not held: ${why}.`, text: '', from: 0, to: 0, total: 0, complete: true } }
  }

  // a corpus section: the same reader as read_section
  if (src?.corpusKey) {
    const r = await readSection(src.corpusKey, { from, maxChars: size })
    if (r.status !== 'text') return { ok: true, data: { ref, title, kind, url, held: 'nothing', note: `The corpus text is not available: ${r.reason}`, text: '', from: 0, to: 0, total: 0, complete: true, corpusId: src.corpusKey } }
    return { ok: true, data: { ref, title: r.title ?? title, kind, url: r.url ?? url, held: 'full text', text: r.text ?? '', from: r.from ?? from, to: r.to ?? from, total: r.totalChars ?? 0, nextFrom: r.nextFrom, complete: r.nextFrom == null, corpusId: r.readId ?? r.id } }
  }

  // an observation or a source with only its snippet: say what it is
  const snippet = src?.snippet?.trim() ?? ''
  return {
    ok: true,
    data: { ref, title, kind, url, held: snippet ? 'summary only' : 'nothing', note: snippet ? 'Only a short summary of this source is held, not its full text.' : 'Nothing of this source’s text is held.', ...slice(snippet, from, size) },
  }
}
