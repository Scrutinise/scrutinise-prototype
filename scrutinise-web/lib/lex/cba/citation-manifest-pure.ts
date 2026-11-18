// ─────────────────────────────────────────────────────────────────────────────
// LEX 26-Y decision 337 — CITATIONS ONLY THROUGH THE MANIFEST. PURE; CLIENT-SAFE (imports nothing).
//
// A Green Book, discounting or optimism-bias citation is a KEY ("green-book:6.58", "gb-discounting:3.8") and is accepted only if the key
// is in the manifest. Otherwise it is refused at write time, with the nearest valid keys offered. No paragraph number is ever typed free-hand.
//
// ⚠ WHERE THE MANIFEST COMES FROM (cc-lex-26y → CCh, 18 Nov 11:06, engineering call 1). Ingest has not shipped a manifest file
// (BRIEF_INGEST_CBA_1_EXECUTE §6). It HAS written the paragraphs themselves (14 Nov 02:16 UTC, 468 rows in govuk-core-docs), and each row's
// sectionTitle ends with its paragraph number ("… › Discounting › 6.58"). So the manifest is DERIVED from the rows that are held: a key is
// valid exactly when the platform holds that paragraph's text. That is the property the manifest exists to give (a citation that cannot
// silently re-point), and it cannot drift from what is held because it IS what is held. When Ingest ships a file, `manifestFromFile` reads it
// and check:lex-26y asserts the two agree.
// ─────────────────────────────────────────────────────────────────────────────

/** The documents a key may name, by the parentDocId of their paragraph rows. */
export const MANIFEST_DOCS: ReadonlyArray<{ prefix: string; docId: string; title: string }> = [
  { prefix: 'green-book', docId: 'government/publications/the-green-book-2026-paragraphs', title: 'The Green Book (October 2026)' },
  { prefix: 'gb-discounting', docId: 'government/publications/green-book-supplementary-guidance-discounting-paragraphs', title: 'Green Book supplementary guidance: discounting (October 2026)' },
  { prefix: 'gb-optimism-bias', docId: 'government/publications/green-book-supplementary-guidance-optimism-bias-paragraphs', title: 'Green Book supplementary guidance: optimism bias (2013)' },
]

/** A key and what it RESOLVES to: the held row's id, and (resolved on demand, server side) a hash of that row's text. CCh GO 18 Nov: Ingest's
 *  manifest will carry key → id → hash, because its stored ids are a running sequence (":186"); the two are compared by `compareManifests`. */
export interface ManifestEntry { key: string; label: string; heading: string; sectionId: string; sourceUrl: string | null; r2Key?: string | null; textHash?: string | null }
export interface Manifest { entries: ReadonlyMap<string, ManifestEntry>; from: 'held-rows' | 'file'; heldAt: string | null }

export interface HeldRow { id: string; parentDocId: string | null; sectionTitle: string | null; sourceUrl: string | null; r2Key?: string | null }

/** The key a held row carries, or null when it is not a numbered paragraph or table (front matter, an appendix, a worked example). */
export function keyOfRow(row: HeldRow): { key: string; label: string; heading: string } | null {
  const doc = MANIFEST_DOCS.find((d) => d.docId === row.parentDocId)
  if (!doc || !row.sectionTitle) return null
  const parts = row.sectionTitle.split('›').map((s) => s.trim()).filter(Boolean)
  const last = parts[parts.length - 1] ?? ''
  const heading = parts.slice(1, -1).join(' › ')
  if (/^(\d+|[A-Z])\.\d+$/.test(last)) return { key: `${doc.prefix}:${last}`, label: `${doc.title}, para ${last}`, heading }
  const table = /^Table:\s*Table\s+(\d+)\b/i.exec(last)
  if (table) return { key: `${doc.prefix}:table-${table[1]}`, label: `${doc.title}, Table ${table[1]}`, heading: last.replace(/^Table:\s*/i, '') }
  return null
}

export function manifestFromRows(rows: readonly HeldRow[], heldAt: string | null = null): Manifest {
  const entries = new Map<string, ManifestEntry>()
  for (const r of rows) {
    const k = keyOfRow(r)
    if (k && !entries.has(k.key)) entries.set(k.key, { ...k, sectionId: r.id, sourceUrl: r.sourceUrl, r2Key: r.r2Key ?? null })
  }
  return { entries, from: 'held-rows', heldAt }
}

/** Ingest's file, when there is one: { keys: [{ key, label?, sectionId? }] }. */
export function manifestFromFile(json: unknown): Manifest | null {
  const keys = (json as { keys?: unknown })?.keys
  if (!Array.isArray(keys)) return null
  const entries = new Map<string, ManifestEntry>()
  for (const k of keys) {
    const key = typeof k === 'string' ? k : typeof (k as { key?: unknown })?.key === 'string' ? (k as { key: string }).key : null
    if (key) entries.set(key, { key, label: (k as { label?: string })?.label ?? key, heading: '', sectionId: (k as { sectionId?: string; id?: string })?.sectionId ?? (k as { id?: string })?.id ?? '', sourceUrl: null, textHash: (k as { hash?: string })?.hash ?? null })
  }
  return { entries, from: 'file', heldAt: null }
}

const CAN = /^([a-z-]+):((?:\d+|[A-Z])\.\d+|table-\d+)$/

/** A typed key, tidied the way a person would mistype it ("Green Book 6.58", "gb-discounting §3.8") — never changed into a DIFFERENT key. */
export function normaliseKey(raw: string): string {
  const s = raw.trim().replace(/\s+/g, ' ')
  const m = /^(.+?)[\s:]+(?:para(?:graph)?\.?\s*|§\s*)?((?:\d+|[A-Z])\.\d+|table[\s-]*\d+)$/i.exec(s)
  if (!m) return s.toLowerCase()
  const name = m[1].toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')
  const prefix = name === 'the-green-book' ? 'green-book' : name
  const para = /^table/i.test(m[2]) ? `table-${m[2].replace(/\D+/g, '')}` : m[2]
  return `${prefix}:${para}`
}

function nearness(a: string, b: string): number {
  // same document first; then the paragraph number's distance (6.58 is nearer 6.57 than 7.1); then text
  const [pa, xa] = a.split(':'), [pb, xb] = b.split(':')
  const doc = pa === pb ? 0 : 1000
  const num = (x: string) => { const m = /^(\d+)\.(\d+)$/.exec(x ?? ''); return m ? Number(m[1]) * 1000 + Number(m[2]) : null }
  const na = num(xa), nb = num(xb)
  return doc + (na != null && nb != null ? Math.min(999, Math.abs(na - nb) / 10) : 500)
}

export type CitationCheck = { ok: true; key: string; entry: ManifestEntry } | { ok: false; error: string; nearest: string[] }

/** The write-time check. A refusal names the key, says why, and offers the nearest valid keys (same document first). */
export function checkCitation(raw: string, m: Manifest): CitationCheck {
  const key = normaliseKey(raw)
  const hit = m.entries.get(key)
  if (hit) return { ok: true, key, entry: hit }
  const nearest = [...m.entries.keys()].sort((a, b) => nearness(key, a) - nearness(key, b) || a.localeCompare(b)).slice(0, 3)
  const why = !CAN.test(key)
    ? `“${raw.trim()}” is not a citation key. A key names a document and a paragraph, as green-book:6.58 or gb-discounting:3.8.`
    : !MANIFEST_DOCS.some((d) => key.startsWith(`${d.prefix}:`))
      ? `“${key}” names a document the manifest does not cover (it covers ${MANIFEST_DOCS.map((d) => d.prefix).join(', ')}).`
      : `“${key}” is not a paragraph the platform holds, so it cannot be cited.`
  return { ok: false, nearest, error: `${why}${nearest.length ? ` Nearest held: ${nearest.join(', ')}.` : ' No paragraph of that guidance is held yet.'}` }
}

/** Where two manifests disagree on a key: one lacks it, the ids differ, or the text hashes differ (a re-cut that re-pointed it). Empty = agree.
 *  A hash is compared only where both sides carry one. */
export function compareManifests(a: Manifest, b: Manifest, keys?: readonly string[]): Array<{ key: string; why: string }> {
  const out: Array<{ key: string; why: string }> = []
  for (const k of keys ?? [...new Set([...a.entries.keys(), ...b.entries.keys()])]) {
    const x = a.entries.get(k), y = b.entries.get(k)
    if (!x || !y) { out.push({ key: k, why: `only in the ${x ? a.from : b.from} manifest` }); continue }
    if (x.sectionId && y.sectionId && x.sectionId !== y.sectionId) out.push({ key: k, why: `resolves to ${x.sectionId} in one and ${y.sectionId} in the other` })
    else if (x.textHash && y.textHash && x.textHash !== y.textHash) out.push({ key: k, why: 'the same row, but its text has changed' })
  }
  return out
}

/** The citations the ENGINE itself prints. Every one must be in the manifest (check:lex-26y part 4 asserts it). */
export const ENGINE_CITATIONS = {
  stpr: 'gb-discounting:2.1',
  schedule: 'gb-discounting:3.8',
  forwardRates: 'gb-discounting:3.9',
  beyond125: 'gb-discounting:3.10',
  noRetrospective: 'green-book:6.58',
  healthUprate: 'green-book:8.58',
  optimismBias: 'green-book:6.77',
  obUpperBound: 'gb-optimism-bias:3.11',
  obReduce: 'gb-optimism-bias:3.12',
  obIndicative: 'gb-optimism-bias:3.6',
} as const
