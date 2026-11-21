// LEX 26-Y decision 337 — the manifest's server half. Cached for a minute; the paragraphs change only when Ingest writes.
//
// 26-AA item 9(d) — INGEST'S FILE IS NOW THE MANIFEST. It is bundled with this module (`./cba-citation-manifest.json`), so a Vercel function
// reads it with no runtime path that could be missing. Each of its keys is confirmed against the held paragraph row it names (the same id),
// and takes that row's r2Key, so the text can still be read and hashed. Ingest builds it (scripts/ingest/cba/build-manifest.ts) and writes
// it HERE; docs/manifests/ held the first copy, and while both exist check:lex-26aa asserts they are byte-identical. Without a readable
// file the held rows are the manifest, as before 26-AA, and `from: 'held-rows'` says so.
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { r2Get } from '@/lib/r2'
import { MANIFEST_DOCS, manifestFromRows, manifestFromFile, manifestFromFileAndRows, checkCitation, type Manifest, type CitationCheck } from './citation-manifest-pure'
import MANIFEST_FILE from './cba-citation-manifest.json'

type LeftOut = Array<{ key: string; why: string }>
let cache: { at: number; m: Manifest; leftOut: LeftOut } | null = null

/** The held paragraph rows, keyed as the manifest keys them. */
export async function heldRowsManifest(): Promise<Manifest> {
  const rows = await prisma.$queryRaw<Array<{ id: string; parentDocId: string | null; sectionTitle: string | null; sourceUrl: string | null; r2Key: string | null; createdAt: Date }>>`
    SELECT id, "parentDocId", "sectionTitle", "sourceUrl", "r2Key", "createdAt" FROM corpus_sections
    WHERE corpus = 'govuk-core-docs' AND status = 'compiled' AND "parentDocId" = ANY(${MANIFEST_DOCS.map((d) => d.docId)})`
  const heldAt = rows.length ? new Date(Math.max(...rows.map((r) => new Date(r.createdAt).getTime()))).toISOString() : null
  return manifestFromRows(rows, heldAt)
}

/** The manifest, and the file's keys it left out (no held row, or a row with a different id), each with why. */
export async function loadManifestWithReport(opts: { fresh?: boolean } = {}): Promise<{ manifest: Manifest; leftOut: LeftOut }> {
  if (!opts.fresh && cache && Date.now() - cache.at < 60_000) return { manifest: cache.m, leftOut: cache.leftOut }
  const rows = await heldRowsManifest()
  const file = manifestFromFile(MANIFEST_FILE)
  const builtAt = (MANIFEST_FILE as { builtAt?: string }).builtAt ?? rows.heldAt
  const { manifest, leftOut } = file && file.entries.size ? manifestFromFileAndRows(file, rows, builtAt) : { manifest: rows, leftOut: [] as LeftOut }
  cache = { at: Date.now(), m: manifest, leftOut }
  return { manifest, leftOut }
}

export async function loadManifest(opts: { fresh?: boolean } = {}): Promise<Manifest> {
  return (await loadManifestWithReport(opts)).manifest
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
 *  re-points a key is visible by comparing the stored id and hash with the manifest as it is then. The hash is of the text as read NOW
 *  (never the file's, which would hide a re-cut since the file was built). */
export async function resolveCitations(keys: readonly string[]): Promise<Array<{ key: string; sectionId: string | null; textHash: string | null }>> {
  const m = await loadManifest()
  return Promise.all(keys.map(async (k) => { const e = m.entries.get(k); return { key: k, sectionId: e?.sectionId ?? null, textHash: e ? await textHashOf(e.r2Key) : null } }))
}

/** The write-time check, against the manifest as held now. */
export async function checkCitationKey(raw: string): Promise<CitationCheck> {
  return checkCitation(raw, await loadManifest())
}
