// ─────────────────────────────────────────────────────────────────────────────
// 26-R — THE SOURCE REGISTRY: ONE NUMBERED LIST PER IDEA, CITED BY NOTES AND DOCUMENTS ALIKE.
//
// 26-E §3 asked for numbered sources and `[Ref: n]` in the draft; it was sized, not built (CHANGE_LOG 24 Sep). The notebook
// stands on it: a note cites an entry, a document cites the same entry, **nothing is numbered twice** (BRIEF_26R §1).
//
// ⚠ IT REPLACES NOTHING. A source already lived in three places and still does:
//     IdeaSourceDecision  (corpusKey)  — what the user decided about a corpus source
//     EvidenceItem        (sourceId)   — what a pass found, citing a corpus source, a web page, or the user's own document
//     IdeaUserMaterial    (materialId) — an upload or a fetched link
//   `syncRegistry` reads those and ensures one registry row for each distinct source. It is IDEMPOTENT (each key is unique per
//   idea), so it is safe to call on every read that needs numbers, and a source that arrives by any route gets a number.
// ⚠ A NUMBER IS NEVER REUSED (26-E §3e). The database assigns it (`lex_source_number_trg`: one past the highest EVER used in the
//   idea, archived rows included) and a source is archived, never deleted — a `[Ref: 7]` that silently becomes another
//   document is worse than a gap.
// ⚠ AN UNREAD SOURCE MUST NEVER LOOK READ (26-E §3c). `readStatus` is NOT_READ unless the text was actually read, and `readNote`
//   says why not.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@/lib/prisma'

export const refToken = (n: number): string => `[Ref: ${n}]`
export const REF_PATTERN = /\[Ref:\s*(\d+)\s*\]/g

export type SourceKind = 'CORPUS' | 'URL' | 'DOCUMENT' | 'OWN_OBSERVATION'

export interface RegistrySource {
  id: string
  number: number
  kind: SourceKind
  title: string
  url: string | null
  citation: string | null
  sourceType: string | null
  author: string | null
  publishedAt: string | null
  snippet: string | null
  readStatus: 'READ' | 'NOT_READ'
  readNote: string | null
  corpusKey: string | null
  materialId: string | null
  archived: boolean
  createdAt: string
}

type Row = Awaited<ReturnType<typeof prisma.ideaSource.findMany>>[number]
const toSource = (r: Row): RegistrySource => ({
  id: r.id, number: r.number ?? 0, kind: r.kind as SourceKind, title: r.title, url: r.url, citation: r.citation, sourceType: r.sourceType,
  author: r.author, publishedAt: r.publishedAt, snippet: r.snippet, readStatus: r.readStatus === 'READ' ? 'READ' : 'NOT_READ', readNote: r.readNote,
  corpusKey: r.corpusKey, materialId: r.materialId, archived: !!r.archivedAt, createdAt: r.createdAt.toISOString(),
})

export async function listRegistry(ideaId: string, opts: { includeArchived?: boolean } = {}): Promise<RegistrySource[]> {
  const rows = await prisma.ideaSource.findMany({
    where: { ideaId, ...(opts.includeArchived ? {} : { archivedAt: null }) },
    orderBy: [{ number: 'asc' }],
  })
  return rows.map(toSource)
}

const clip = (s: string | null | undefined, n: number): string | null => { const t = (s ?? '').trim(); return t ? t.slice(0, n) : null }

/** A web address reduced to what identifies the page, so the same page cited twice is one source. */
export function urlKey(url: string): string {
  try {
    const u = new URL(url)
    return `url:${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}`.toLowerCase()
  } catch { return `url:${url.trim().toLowerCase()}` }
}

/**
 * Ensure a registry row for every distinct source this idea rests on. Returns what was created. Idempotent.
 * Order is stable (oldest first), so a backfill numbers the same way every time it is run on the same data.
 */
export async function syncRegistry(ideaId: string): Promise<{ created: number; total: number }> {
  const [existing, materials, decisions, evidence] = await Promise.all([
    prisma.ideaSource.findMany({ where: { ideaId }, select: { corpusKey: true, materialId: true } }),
    prisma.ideaUserMaterial.findMany({ where: { ideaId }, orderBy: { createdAt: 'asc' } }),
    prisma.ideaSourceDecision.findMany({ where: { ideaId }, orderBy: { createdAt: 'asc' } }),
    prisma.evidenceItem.findMany({
      where: { ideaId, OR: [{ sourceId: { not: null } }, { url: { not: null } }] },
      orderBy: { id: 'asc' },
      select: { sourceId: true, sourceType: true, citation: true, url: true, title: true },
    }),
  ])
  const haveCorpus = new Set(existing.map((e) => e.corpusKey).filter((x): x is string => !!x))
  const haveMaterial = new Set(existing.map((e) => e.materialId).filter((x): x is string => !!x))
  let created = 0

  for (const m of materials) {
    if (haveMaterial.has(m.id)) continue
    const read = m.status === 'READY'
    await prisma.ideaSource.create({
      data: {
        ideaId, kind: m.kind === 'LINK' ? 'URL' : 'DOCUMENT', title: m.label.slice(0, 300), url: m.url, sourceType: m.kind === 'LINK' ? 'web page' : (m.mimeType ?? 'document'),
        readStatus: read ? 'READ' : 'NOT_READ',
        readNote: read ? null : m.status === 'FAILED' ? (m.failureReason ?? 'could not be read') : 'stored, not yet read',
        materialId: m.id, addedBy: m.addedBy, archivedAt: m.archivedAt, createdAt: m.createdAt,
      },
    })
    haveMaterial.add(m.id); created++
  }

  for (const d of decisions) {
    if (haveCorpus.has(d.sourceKey)) continue
    await prisma.ideaSource.create({
      data: {
        ideaId, kind: 'CORPUS', title: (d.title || d.citation || d.sourceKey).slice(0, 300), url: d.url, citation: d.citation, sourceType: d.sourceType,
        readStatus: 'READ', corpusKey: d.sourceKey, addedBy: d.decidedBy, createdAt: d.createdAt,
      },
    })
    haveCorpus.add(d.sourceKey); created++
  }

  for (const e of evidence) {
    // The user's own document: already a registry row via materialId.
    if (e.sourceType === 'USER_DOCUMENT' && e.sourceId) {
      if (haveMaterial.has(e.sourceId)) continue
      continue // a finding from a document that no longer has a material row — nothing to cite
    }
    const key = e.sourceId ?? (e.url ? urlKey(e.url) : null)
    if (!key || haveCorpus.has(key)) continue
    const isWeb = !e.sourceId && !!e.url
    await prisma.ideaSource.create({
      data: {
        ideaId, kind: isWeb ? 'URL' : 'CORPUS', title: (e.citation || e.title || key).slice(0, 300), url: e.url, citation: e.citation,
        sourceType: e.sourceType ?? (isWeb ? 'web page' : null), readStatus: 'READ', corpusKey: key,
      },
    })
    haveCorpus.add(key); created++
  }

  return { created, total: existing.length + created }
}

/**
 * Called wherever an upload, a fetched link or a chat-filed document is created, so it is numbered the moment it exists.
 * ⚠ A registry failure must not lose the filing — and must not be silent either: it is logged with the idea, and the next
 * `syncRegistry` (every notebook / snapshot read calls one) picks the source up, because the sync is keyed on the material row.
 */
export async function registerNewMaterial(ideaId: string): Promise<void> {
  try { await syncRegistry(ideaId) } catch (err) {
    console.error('[source-registry] could not register new material — it will be picked up on the next sync', { ideaId, error: err instanceof Error ? err.message : String(err) })
  }
}

/** The one "my own observation" entry — a note that rests on the writer's own knowledge cites this, so even that has a number. */
export async function ownObservationSource(ideaId: string, userId: string | null): Promise<RegistrySource> {
  const found = await prisma.ideaSource.findFirst({ where: { ideaId, kind: 'OWN_OBSERVATION' } })
  if (found) return toSource(found)
  const row = await prisma.ideaSource.create({
    data: { ideaId, kind: 'OWN_OBSERVATION', title: 'My own observation', sourceType: 'own observation', readStatus: 'READ', addedBy: userId },
  })
  return toSource(row)
}

export interface AddSourceInput {
  kind: Exclude<SourceKind, 'CORPUS'>
  title: string
  url?: string | null
  citation?: string | null
  author?: string | null
  publishedAt?: string | null
  snippet?: string | null
  sourceType?: string | null
  readStatus?: 'READ' | 'NOT_READ'
  readNote?: string | null
  materialId?: string | null
}

/** Add a source by hand (the Sources panel's "Add source"). A web page that is already registered is returned, not duplicated. */
export async function addSource(ideaId: string, userId: string, input: AddSourceInput): Promise<{ source: RegistrySource; existed: boolean }> {
  const key = input.url ? urlKey(input.url) : null
  if (key) {
    const dupe = await prisma.ideaSource.findFirst({ where: { ideaId, OR: [{ corpusKey: key }, { url: input.url ?? undefined }] } })
    if (dupe) {
      if (dupe.archivedAt) await prisma.ideaSource.update({ where: { id: dupe.id }, data: { archivedAt: null } })
      return { source: toSource({ ...dupe, archivedAt: null }), existed: true }
    }
  }
  const row = await prisma.ideaSource.create({
    data: {
      ideaId, kind: input.kind, title: input.title.trim().slice(0, 300), url: clip(input.url, 2000), citation: clip(input.citation, 500),
      sourceType: clip(input.sourceType, 60), author: clip(input.author, 200), publishedAt: clip(input.publishedAt, 80), snippet: clip(input.snippet, 2000),
      readStatus: input.readStatus ?? 'NOT_READ', readNote: clip(input.readNote, 300), corpusKey: key, materialId: input.materialId ?? null, addedBy: userId,
    },
  })
  return { source: toSource(row), existed: false }
}

/** "Delete" archives. The number stays taken. */
export async function archiveSource(ideaId: string, sourceId: string): Promise<boolean> {
  const r = await prisma.ideaSource.updateMany({ where: { id: sourceId, ideaId }, data: { archivedAt: new Date() } })
  return r.count === 1
}

export async function updateSnippet(ideaId: string, sourceId: string, snippet: string | null, read?: { status: 'READ' | 'NOT_READ'; note: string | null }): Promise<boolean> {
  const r = await prisma.ideaSource.updateMany({
    where: { id: sourceId, ideaId },
    data: { snippet: clip(snippet, 2000), ...(read ? { readStatus: read.status, readNote: clip(read.note, 300) } : {}) },
  })
  return r.count === 1
}

/** Every `[Ref: n]` in a piece of text, in order, de-duplicated. */
export function parseRefs(text: string): number[] {
  const out: number[] = []
  for (const m of text.matchAll(REF_PATTERN)) { const n = Number(m[1]); if (!out.includes(n)) out.push(n) }
  return out
}

/** Which of the refs in a text name a source this idea has, and which name nothing. A ref to nothing is shown, never hidden. */
export async function resolveRefs(ideaId: string, text: string): Promise<{ found: RegistrySource[]; missing: number[] }> {
  const wanted = parseRefs(text)
  if (!wanted.length) return { found: [], missing: [] }
  const rows = await prisma.ideaSource.findMany({ where: { ideaId, number: { in: wanted } } })
  const found = rows.map(toSource)
  return { found, missing: wanted.filter((n) => !found.some((f) => f.number === n)) }
}

/** Number → source, for rendering `[Ref: n]` beside whatever cites it. Built once per document. */
export async function refIndex(ideaId: string): Promise<{
  byCorpusKey: Map<string, number>; byMaterialId: Map<string, number>; byUrlKey: Map<string, number>; all: RegistrySource[]
}> {
  const all = await listRegistry(ideaId, { includeArchived: true })
  const byCorpusKey = new Map<string, number>(), byMaterialId = new Map<string, number>(), byUrlKey = new Map<string, number>()
  for (const s of all) {
    if (s.corpusKey) byCorpusKey.set(s.corpusKey, s.number)
    if (s.materialId) byMaterialId.set(s.materialId, s.number)
    if (s.url) byUrlKey.set(urlKey(s.url), s.number)
  }
  return { byCorpusKey, byMaterialId, byUrlKey, all }
}
