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

import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { r2Get } from '@/lib/r2'
import { facetOf, type ListedSource } from '@/lib/lex/source-list'

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

/**
 * 26-S2 sec 9a (decision 173) - THE ONE DEFINITION OF "THE DOCUMENTS ON THIS IDEA".
 *
 * The research panel showed each filed document twice because two readers each had their own idea of what a document is: the Sources list read the registry,
 * "Your material" read `IdeaUserMaterial`. They were not the only two. Nine places read the material table directly, and they did not even agree on what to count:
 * the Build page counted ARCHIVED rows (so the composer's "+" kept a document the user had removed), while the stage context, Lex's tools and the chat-attach cap
 * all counted live ones. A document is a registry source with a `materialId` whose material is not archived; THIS is where that is decided, and the readers below
 * ask here. A row is returned with its registry number where it has one (null only for a document filed a moment ago and not yet numbered).
 */
export interface LiveDocument {
  materialId: string
  kind: 'FILE' | 'LINK'
  label: string
  url: string | null
  status: string
  findingCount: number
  failureReason: string | null
  findingsAt: Date | null
  charCount: number
  /** The `[Ref: n]` number, or null when it has not been registered yet. */
  number: number | null
  sourceId: string | null
}

export async function listDocuments(ideaId: string): Promise<LiveDocument[]> {
  const [mats, sources] = await Promise.all([
    prisma.ideaUserMaterial.findMany({
      where: { ideaId, archivedAt: null }, orderBy: { createdAt: 'asc' },
      select: { id: true, kind: true, label: true, url: true, status: true, findingCount: true, failureReason: true, findingsAt: true, charCount: true },
    }),
    prisma.ideaSource.findMany({ where: { ideaId, materialId: { not: null } }, select: { id: true, number: true, materialId: true } }),
  ])
  const byMaterial = new Map(sources.map((s) => [s.materialId as string, s]))
  return mats.map((m) => ({
    materialId: m.id, kind: m.kind === 'LINK' ? 'LINK' : 'FILE', label: m.label, url: m.url, status: m.status, findingCount: m.findingCount, failureReason: m.failureReason, findingsAt: m.findingsAt, charCount: m.charCount,
    number: byMaterial.get(m.id)?.number ?? null, sourceId: byMaterial.get(m.id)?.id ?? null,
  }))
}

/** How many documents the idea holds. The same rows `listDocuments` returns - the cap, the composer's "+", the stage context and Lex all count THESE. */
export async function countDocuments(ideaId: string): Promise<number> {
  return prisma.ideaUserMaterial.count({ where: { ideaId, archivedAt: null } })
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

/**
 * 299 — the list as the Sources list and 298's picker need it: each live source with its KIND for the filter, the ACTIONS it bears on, the hash of
 * its held text (298's duplicate check) and how many notes cite it. Read-only; one query per table, no R2.
 * "Bears on #N": a note on the source bears on action N, or action N's own words cite the source's [Ref: n].
 */
export async function listRegistryDetail(ideaId: string): Promise<ListedSource[]> {
  const [rows, mats, notes, actions] = await Promise.all([
    prisma.ideaSource.findMany({ where: { ideaId, archivedAt: null }, orderBy: [{ number: 'asc' }] }),
    prisma.ideaUserMaterial.findMany({ where: { ideaId, archivedAt: null, text: { not: null } }, select: { id: true, text: true } }),
    prisma.researchNote.findMany({ where: { ideaId, status: { not: 'SET_ASIDE' } }, select: { sourceId: true, bearsOn: true } }),
    prisma.lexCoherentAction.findMany({ where: { ideaId, status: 'LIVE' }, select: { id: true, number: true, title: true, practicalStep: true, commentary: true, wording: true, record: true } }),
  ])
  const hash = new Map(mats.map((m) => [m.id, createHash('sha256').update(m.text ?? '').digest('hex')]))
  const actionNo = new Map(actions.filter((a) => a.number != null).map((a) => [a.id, a.number as number]))
  const bears = new Map<string, Set<number>>()
  const add = (sourceId: string, n: number) => bears.set(sourceId, (bears.get(sourceId) ?? new Set()).add(n))
  const noteCount = new Map<string, number>()
  for (const n of notes) {
    noteCount.set(n.sourceId, (noteCount.get(n.sourceId) ?? 0) + 1)
    for (const b of (Array.isArray(n.bearsOn) ? n.bearsOn : []) as Array<{ kind?: string; id?: string }>) {
      const no = b.kind === 'action' && b.id ? actionNo.get(b.id) : undefined
      if (no != null) add(n.sourceId, no)
    }
  }
  const byNumber = new Map(rows.map((r) => [r.number, r.id]))
  for (const a of actions) {
    if (a.number == null) continue
    const words = [a.title, a.practicalStep, a.commentary, a.wording, a.record ? JSON.stringify(a.record) : null].filter(Boolean).join('\n')
    for (const n of parseRefs(words)) { const sid = byNumber.get(n); if (sid) add(sid, a.number) }
  }
  return rows.map((r) => {
    const s = toSource(r)
    return {
      id: s.id, number: s.number, kind: s.kind, title: s.title, url: s.url, sourceType: s.sourceType, author: s.author, publishedAt: s.publishedAt,
      snippet: s.snippet, readStatus: s.readStatus, readNote: s.readNote, corpusKey: s.corpusKey, materialId: s.materialId, createdAt: s.createdAt,
      addedBy: r.addedBy, facet: facetOf({ kind: s.kind, sourceType: s.sourceType, addedBy: r.addedBy, materialId: s.materialId }),
      bearsOn: [...(bears.get(r.id) ?? [])].sort((x, y) => x - y),
      textHash: s.materialId ? hash.get(s.materialId) ?? null : null,
      noteCount: noteCount.get(r.id) ?? 0,
    }
  })
}

/**
 * 298 — the sha-256 of a text as it would be KEPT: the same normalise and cap `research-notes.ts` applies when it stores a filed text, so the hash of a
 * file read for the form equals the hash `listRegistryDetail` computes for the same file once filed. (Imported lazily: user-material imports this module.)
 */
export async function heldTextHash(text: string): Promise<string> {
  const { normalise, MAX_TEXT_CHARS } = await import('@/lib/lex/user-material')
  return createHash('sha256').update(normalise(text).slice(0, MAX_TEXT_CHARS)).digest('hex')
}

/** The corpus text of one passage (R2), cached for the life of the server instance: corpus text does not change under a key. */
const corpusTextCache = new Map<string, string>()
async function corpusText(corpusKey: string): Promise<string> {
  const hit = corpusTextCache.get(corpusKey)
  if (hit != null) return hit
  const row = await prisma.$queryRaw<Array<{ r2Key: string | null }>>`SELECT "r2Key" FROM corpus_sections WHERE id = ${corpusKey} LIMIT 1`
  const text = row[0]?.r2Key ? String(await r2Get(row[0].r2Key).catch(() => '')) : ''
  if (corpusTextCache.size > 5000) corpusTextCache.clear()
  corpusTextCache.set(corpusKey, text)
  return text
}

/**
 * 299 — search the idea's sources: their titles, and the text we HOLD for them (a document's or page's kept text, the snippet, the notes'
 * quotes and comments, and a corpus passage's text). Every word must appear (case-insensitive). Returns the matching source ids and, for each,
 * WHERE it matched, so the list can say "in the held text" rather than look as if the title matched.
 * ⚠ What is not held cannot be searched: a web address saved without its page is matched on its title and snippet only — the result says so.
 */
export async function searchRegistry(ideaId: string, q: string): Promise<{ matches: Array<{ id: string; where: string[] }>; searchedText: number; notHeld: number }> {
  const words = q.toLowerCase().split(/\s+/).map((w) => w.trim()).filter((w) => w.length >= 2).slice(0, 8)
  if (!words.length) return { matches: [], searchedText: 0, notHeld: 0 }
  const [rows, mats, notes] = await Promise.all([
    prisma.ideaSource.findMany({ where: { ideaId, archivedAt: null }, select: { id: true, title: true, snippet: true, url: true, corpusKey: true, materialId: true, kind: true } }),
    prisma.ideaUserMaterial.findMany({ where: { ideaId, archivedAt: null }, select: { id: true, text: true } }),
    prisma.researchNote.findMany({ where: { ideaId }, select: { sourceId: true, quote: true, comment: true } }),
  ])
  const matText = new Map(mats.map((m) => [m.id, (m.text ?? '').toLowerCase()]))
  const noteText = new Map<string, string>()
  for (const n of notes) noteText.set(n.sourceId, `${noteText.get(n.sourceId) ?? ''}\n${n.quote ?? ''}\n${n.comment ?? ''}`.toLowerCase())
  const corpus = rows.filter((r) => r.kind === 'CORPUS' && r.corpusKey && !r.corpusKey.startsWith('url:'))
  const corpusTexts = new Map<string, string>()
  for (let i = 0; i < corpus.length; i += 16) {
    await Promise.all(corpus.slice(i, i + 16).map(async (r) => { corpusTexts.set(r.id, (await corpusText(r.corpusKey!)).toLowerCase()) }))
  }
  const all = (hay: string) => words.every((w) => hay.includes(w))
  const matches: Array<{ id: string; where: string[] }> = []
  let searchedText = 0, notHeld = 0
  for (const r of rows) {
    const held = (r.materialId ? matText.get(r.materialId) : undefined) ?? corpusTexts.get(r.id) ?? ''
    if (held) searchedText++; else if (r.kind !== 'OWN_OBSERVATION') notHeld++
    const where: string[] = []
    if (all(r.title.toLowerCase())) where.push('title')
    if (held && all(held)) where.push('held text')
    if (r.snippet && all(r.snippet.toLowerCase())) where.push('snippet')
    if (noteText.has(r.id) && all(noteText.get(r.id)!)) where.push('notes')
    if (where.length) matches.push({ id: r.id, where })
  }
  return { matches, searchedText, notHeld }
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
