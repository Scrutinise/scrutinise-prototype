// LEX 26-Y decision 337 — the manifest's server half: read the held paragraph rows (see citation-manifest-pure.ts for why the manifest is
// derived from them). Cached for a minute; the paragraphs change only when Ingest writes.
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { r2Get } from '@/lib/r2'
import { MANIFEST_DOCS, manifestFromRows, checkCitation, type Manifest, type CitationCheck } from './citation-manifest-pure'

let cache: { at: number; m: Manifest } | null = null

export async function loadManifest(opts: { fresh?: boolean } = {}): Promise<Manifest> {
  if (!opts.fresh && cache && Date.now() - cache.at < 60_000) return cache.m
  const rows = await prisma.$queryRaw<Array<{ id: string; parentDocId: string | null; sectionTitle: string | null; sourceUrl: string | null; r2Key: string | null; createdAt: Date }>>`
    SELECT id, "parentDocId", "sectionTitle", "sourceUrl", "r2Key", "createdAt" FROM corpus_sections
    WHERE corpus = 'govuk-core-docs' AND status = 'compiled' AND "parentDocId" = ANY(${MANIFEST_DOCS.map((d) => d.docId)})`
  const heldAt = rows.length ? new Date(Math.max(...rows.map((r) => new Date(r.createdAt).getTime()))).toISOString() : null
  const m = manifestFromRows(rows, heldAt)
  cache = { at: Date.now(), m }
  return m
}

const hashes = new Map<string, string | null>()
/** sha256 of the held text a key resolves to (first 16 hex), read from R2 once per process. Null when the text cannot be read. */
export async function textHashOf(r2Key: string | null | undefined): Promise<string | null> {
  if (!r2Key) return null
  if (hashes.has(r2Key)) return hashes.get(r2Key)!
  const text = await r2Get(r2Key).catch(() => null)
  const h = text == null ? null : createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16)
  hashes.set(r2Key, h)
  return h
}

/** key → section id → text hash, for the keys a document cites. Stored with every Cost–benefit report version, so a later re-cut that
 *  re-points a key is visible by comparing the stored id and hash with the manifest as it is then. */
export async function resolveCitations(keys: readonly string[]): Promise<Array<{ key: string; sectionId: string | null; textHash: string | null }>> {
  const m = await loadManifest()
  return Promise.all(keys.map(async (k) => { const e = m.entries.get(k); return { key: k, sectionId: e?.sectionId ?? null, textHash: e ? await textHashOf(e.r2Key) : null } }))
}

/** The write-time check, against the manifest as held now. */
export async function checkCitationKey(raw: string): Promise<CitationCheck> {
  return checkCitation(raw, await loadManifest())
}
