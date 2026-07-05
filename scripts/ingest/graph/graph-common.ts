/**
 * graph-common.ts — shared helpers for the Tier-1 legislation graph (explicit edges).
 *
 * The edge store is ONE Neon table, `legislation_edges`:
 *   (from_id, to_id, edge_type, sub_type, source, granularity, detail, extracted_at)
 *
 * Ids use the corpus_sections id scheme so the traversal can join back to the
 * corpus: `{corpus}:{gid}` (act-level) or `{corpus}:{gid}:{sectionRef}`
 * (section-level), e.g. `primary-acts-2000plus:ukpga/1988/50:section-21`.
 * Documents no ingested corpus holds (ukla, aep, ukcm, …) get corpus `external`
 * so the edge is still recorded and the gid still parses with split_part(id,':',2).
 *
 * Direction: from = the ACTOR (affecting/citing/made instrument),
 *            to   = the TARGET (affected/cited/enabling provision).
 * "Amended-by / repealed-by / cited-by" are reverse lookups on to_id — not stored.
 */
import { getNeonPool } from '../shared/neon-pool'

export const EDGE_TABLE = 'legislation_edges'

// ── gid → corpus (mirrors seed-tna-enum-queue.ts corpus assignment) ──────────
const REGIONAL_TYPES = new Set(['asp', 'asc', 'anaw', 'mwa', 'nia', 'nisi', 'nisr', 'ssi', 'wsi'])
const RETAINED_EU_TYPES = new Set(['eur', 'eudn', 'eudr'])

export function corpusForGid(gid: string): string {
  const m = gid.match(/^([a-z]+)\/([^/]+(?:\/[0-9-]+)?)\/\d+$/)
  if (!m) return 'external'
  const [, type, yearPart] = m
  // regnal-year gids (ukpga/Geo6/9-10/80) are all pre-1963
  const year = /^\d{4}$/.test(yearPart) ? parseInt(yearPart, 10) : 0
  if (type === 'ukpga') return year >= 2000 ? 'primary-acts-2000plus' : 'primary-acts-pre-2000'
  if (type === 'uksi') return year >= 2010 ? 'si-2010plus' : 'si-pre-2010'
  if (REGIONAL_TYPES.has(type)) return 'regional'
  if (RETAINED_EU_TYPES.has(type)) return 'retained-eu'
  return 'external' // ukla, aep, apgb, aosp, apni, ukcm, nisro, gbla, ukppa, …
}

/** Act-level or section-level edge id in the corpus_sections scheme. */
export function edgeId(gid: string, sectionRef?: string | null): string {
  const corpus = corpusForGid(gid)
  return sectionRef ? `${corpus}:${gid}:${sectionRef}` : `${corpus}:${gid}`
}

/** legislation.gov.uk URI → { gid, sectionRef }. Handles both /id/… and bare
 *  forms, calendar years AND regnal-year gids (pre-1963 acts):
 *  e.g. http://www.legislation.gov.uk/id/ukpga/2010/15/section/186/2
 *       → { gid: 'ukpga/2010/15', sectionRef: 'section-186-2' }
 *       http://www.legislation.gov.uk/id/ukpga/Geo6/9-10/80
 *       → { gid: 'ukpga/Geo6/9-10/80', sectionRef: null }
 *  Returns null for non-gid URIs (european/…, /changes/…). */
export function parseLegUri(uri: string): { gid: string; sectionRef: string | null } | null {
  const m = uri.match(/legislation\.gov\.uk\/(?:id\/)?([a-z]+)\/(\d{4}|[A-Z][A-Za-z0-9and]*\/[0-9-]+)\/(\d+)((?:\/[A-Za-z0-9.\-]+)*)\/?$/)
  if (!m) return null
  const gid = `${m[1]}/${m[2]}/${m[3]}`
  const rest = m[4]?.replace(/^\//, '') ?? ''
  if (!rest) return { gid, sectionRef: null }
  // provision path → CLML ref: section/186/2 → section-186-2; schedule/2/paragraph/12 → schedule-2-paragraph-12
  return { gid, sectionRef: rest.split('/').join('-') }
}

// ── effect Type → edge_type bucket ───────────────────────────────────────────
// The ukm:Effect Type strings are a long tail (~hundreds of variants, some with
// citations embedded). Buckets are checked in order; sub_type keeps the
// normalised raw string for D4-style "what changed" answers.
export function edgeTypeForEffect(rawType: string): 'repeals' | 'commences' | 'amends' | 'modifies' {
  const t = rawType.toLowerCase()
  if (/repeal|revok|omitted|ceases? to have effect|expire/.test(t)) {
    // "words omitted"/"entry omitted" are partial deletions = amendments, not
    // whole-provision repeals; bare "omitted" removes the provision → repeals.
    if (/word|entry|entries|figure|sum|comma|semicolon/.test(t) && !/repeal|revok/.test(t)) return 'amends'
    return 'repeals'
  }
  if (/coming into force|commencement|commenced|appointed day/.test(t)) return 'commences'
  if (/insert|substitut|added|amend|renumber|replac|word|entry|entries|figure|sum|heading|cross-heading/.test(t)) return 'amends'
  return 'modifies' // applied / excluded / restricted / extended / modified / power … (explicit but non-textual)
}

/** Normalise a raw effect Type for sub_type: strip trailing "by <citation>" tails
 *  and parenthetical qualifiers, cap length so the long tail can't bloat rows. */
export function normaliseSubType(rawType: string): string {
  return rawType
    .replace(/\s+by\s+\d{4}\b.*$/i, '')     // "applied by 2010 c. 8, s. 259ZME(3) (as inserted)"
    .replace(/\s+\d{4}\s+c\.\s*\d+.*$/i, '') // "amendment to earlier affecting provision 2022 c. 3, …"
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64)
}

// ── edge rows + batched insert ───────────────────────────────────────────────
export type EdgeRow = {
  fromId: string
  toId: string
  edgeType: string
  subType: string       // '' when not applicable (part of the PK — never null)
  source: string
  granularity: string   // 'section-section' | 'section-act' | 'act-section' | 'act-act'
  detail: string | null
}

export function granularityOf(fromSection: boolean, toSection: boolean): string {
  return `${fromSection ? 'section' : 'act'}-${toSection ? 'section' : 'act'}`
}

/** Batched idempotent insert (ON CONFLICT DO NOTHING on the PK). Returns rows written. */
export async function insertEdges(rows: EdgeRow[]): Promise<number> {
  if (rows.length === 0) return 0
  const pool = getNeonPool()
  let written = 0
  const BATCH = 1000
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const values: unknown[] = []
    const tuples = batch.map((r, j) => {
      values.push(r.fromId, r.toId, r.edgeType, r.subType, r.source, r.granularity, r.detail)
      const b = j * 7
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`
    })
    const res = await pool.query(
      `INSERT INTO ${EDGE_TABLE} (from_id, to_id, edge_type, sub_type, source, granularity, detail)
       VALUES ${tuples.join(',')}
       ON CONFLICT (from_id, to_id, edge_type, sub_type) DO NOTHING`,
      values,
    )
    written += res.rowCount ?? 0
  }
  return written
}

/** In-memory dedupe on the PK before insert (keeps the first detail seen). */
export function dedupeEdges(rows: EdgeRow[]): EdgeRow[] {
  const seen = new Set<string>()
  const out: EdgeRow[] = []
  for (const r of rows) {
    const k = `${r.fromId}${r.toId}${r.edgeType}${r.subType}`
    if (seen.has(k)) continue
    seen.add(flat(k))
    out.push({
      ...r,
      fromId: flat(r.fromId),
      toId: flat(r.toId),
      edgeType: flat(r.edgeType),
      subType: flat(r.subType),
      source: flat(r.source),
      granularity: flat(r.granularity),
      detail: r.detail == null ? null : flat(r.detail),
    })
  }
  return out
}

/** Force a flat string copy. Regex match groups on multi-MB XML are V8 sliced
 *  strings that pin the WHOLE parent document in memory; edge rows built from
 *  them (ids, details) leaked ~0.6 MB/doc in the cites extractor until rows
 *  were flattened before buffering. */
function flat(s: string): string {
  return Buffer.from(s, 'utf8').toString('utf8')
}
