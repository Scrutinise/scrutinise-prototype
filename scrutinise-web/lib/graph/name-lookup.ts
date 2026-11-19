/**
 * name-lookup.ts — GRAPHS work, done by the Search session on CCh-Search's GO of 18 Nov (overnight item 6).
 *
 * A name as it is written in web or model text ("Keir Starmer MP", "the Institute for Government") →
 * the graph entities it could be, each with what a screen may say about its identity:
 *   entity_id · kind · canonical_name · identity_tier · parl_member_id · confidence · the surface that matched.
 *
 * READ-ONLY. No schema change. Reads `graph_alias` (indexed on surface_norm) and the view
 * `graph_entity_identity` (identity_tier is READ from the view, never re-derived from key_source —
 * the view's own comment).
 *
 * ⚠ AMBIGUITY IS RETURNED, NEVER RESOLVED. Two people called "John Smith" are two candidates; this
 * module does not pick one, rank one first by guesswork, or merge them. `status` says 'none' | 'one' |
 * 'many', and 'many' carries every candidate. Choosing is the caller's job, with the context it has.
 *
 * ⚠ THE NORMALISER IS A COPY, AND WHY. `graph_alias.surface_norm` was written by `normaliseName` /
 * `normalisePersonName` in scripts/ingest/position-graph/graph-common.ts. The web app cannot import
 * from that package (CLAUDE.md §20 check 0: a cross-package import breaks the Vercel build), so the two
 * functions are restated below. A copy can drift, so `check:graph-name-lookup` does not compare the
 * copy with the original — it compares the copy with the STORED surface_norm of a sample of real
 * alias rows, which is what a lookup actually has to match.
 */
import { getNeonPool } from '@/lib/pg-pool'

/** COPY of graph-common.ts normaliseName — see the header. */
export function normaliseName(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’'`]/g, '')
    .replace(/[-–—/]/g, ' ')
    .replace(/[^a-z0-9()+ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '')
    .trim()
}

/** COPY of graph-common.ts normalisePersonName — see the header. */
export function normalisePersonName(raw: string): string {
  return normaliseName(raw)
    .replace(/^(rt hon|right honourable|the rt hon) /, '')
    .replace(/^(mr|mrs|ms|miss|dr|prof|professor|sir|dame|lord|lady|baroness|baron|rev|reverend|cllr|councillor) /, '')
    .replace(/ (mp|mep|msp|ms|qc|kc|obe|mbe|cbe|kbe|dbe)$/, '')
    .trim()
}

export interface NameCandidate {
  entityId: string
  kind: 'person' | 'organisation' | 'publication' | string
  canonicalName: string
  identityTier: string
  identityStatement: string | null
  parlMemberId: number | null
  confidence: number | null
  /** the alias surface(s), exactly as recorded, that matched this lookup */
  matchedSurfaces: string[]
}

export interface NameLookupResult {
  query: string
  /** the normalised keys looked up (the plain form and, where different, the person form) */
  keys: string[]
  status: 'none' | 'one' | 'many'
  candidates: NameCandidate[]
}

/**
 * Look a written name up. `kind` narrows to people or organisations when the caller knows which.
 * Candidates are ordered by identity tier (identified → probable → mention-only), then name — an order
 * that says how sure the GRAPH is of each identity, not which candidate the text meant.
 */
export async function lookupName(name: string, opts: { kind?: 'person' | 'organisation'; limit?: number } = {}): Promise<NameLookupResult> {
  const plain = normaliseName(name)
  const person = normalisePersonName(name)
  const keys = [...new Set([plain, person].filter((k) => k.length >= 2))]
  if (!keys.length) return { query: name, keys, status: 'none', candidates: [] }
  const limit = Math.min(Math.max(opts.limit ?? 25, 1), 100)
  const { rows } = await getNeonPool().query(
    `SELECT i.entity_id::text AS entity_id, i.kind, i.canonical_name, i.identity_tier, i.identity_statement,
            i.parl_member_id, i.confidence, m.surfaces
       FROM (SELECT a.entity_id, ARRAY_AGG(DISTINCT a.surface) AS surfaces
               FROM graph_alias a
              WHERE a.surface_norm = ANY($1::text[])
              GROUP BY a.entity_id) m
       JOIN graph_entity_identity i ON i.entity_id = m.entity_id
      WHERE ($2::text IS NULL OR i.kind = $2::text)
      ORDER BY CASE i.identity_tier WHEN 'identified' THEN 0 WHEN 'probable' THEN 1 WHEN 'mention-only' THEN 2 ELSE 3 END,
               i.canonical_name, i.entity_id
      LIMIT $3`,
    [keys, opts.kind ?? null, limit],
  )
  const candidates: NameCandidate[] = rows.map((r: any) => ({
    entityId: r.entity_id, kind: r.kind, canonicalName: r.canonical_name, identityTier: r.identity_tier,
    identityStatement: r.identity_statement ?? null, parlMemberId: r.parl_member_id ?? null,
    confidence: r.confidence == null ? null : Number(r.confidence), matchedSurfaces: r.surfaces ?? [],
  }))
  return { query: name, keys, status: candidates.length === 0 ? 'none' : candidates.length === 1 ? 'one' : 'many', candidates }
}
