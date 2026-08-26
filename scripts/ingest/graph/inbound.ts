/**
 * inbound.ts — Sprint 25-H Task 3: the inbound statutory citation lookup.
 *
 * "If you repeal this Act, what else in the statute book is now pointing at
 * something that does not exist?" — one function, callable from a script.
 *
 *   inbound(targetActId, targetProvisionRef?, includeUnresolved?)
 *     → { source_doc_uri, source_provision_ref, citation_text, source_type }[]
 *   inboundSummary(targetActId)
 *     → counts by source_type and by source Act
 *
 * ── THREE DECISIONS A READER NEEDS TO KNOW ABOUT ────────────────────────────
 *
 * 1. AN ACT-LEVEL REFERENCE IS NOT A PART-1 REFERENCE. 94% of citation rows
 *    name an Act and no provision, because CLML body markup mostly does not
 *    carry one (see extract-citation-edges.ts). Folding those into
 *    `inbound(act, 'part-1')` would inflate the answer with references that may
 *    point at Part 7. They are EXCLUDED from a provision-scoped result and
 *    returned separately by `inboundSummary`, never silently either way.
 *    ⚠ For a repeal programme this cuts the other way too: the act-level rows
 *    are a FLOOR on unknown Part-1 exposure, not noise. `inboundSummary`
 *    reports the number so it cannot be overlooked.
 *
 * 2. A PART IS EXPANDED TO ITS MEMBER PROVISIONS, from the Act's own CLML —
 *    not from an assumption about which sections a Part contains. If the bulk
 *    file is not on disk the expansion cannot run, and the function SAYS SO in
 *    `partExpansion.available` rather than quietly matching the literal string
 *    'part-1' and returning a smaller, wrong-looking answer.
 *
 * 3. SUBSECTIONS MATCH THEIR SECTION. `section-3` matches `section-3-2` and
 *    `section-3a`, because TNA records references at subsection grain and a
 *    query for s.3 that missed s.3(2) would be wrong in the direction that
 *    matters. It does NOT match `section-30` — the prefix is followed by a
 *    separator or a letter, never another digit.
 */
import fs from 'fs'
import { getNeonPool } from '../shared/neon-pool'
import { ZipReader } from './zip-reader'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'
import { CITATION_TABLE } from './setup-citation-edge-table'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'

export type InboundRow = {
  source_doc_uri: string
  source_provision_ref: string | null
  citation_text: string
  source_type: 'primary' | 'SI' | 'other'
}

export type InboundEvidenceRow = InboundRow & {
  source_gid: string
  target_uri: string
  target_act_id: string | null
  target_provision_ref: string | null
  raw_fragment: string
  resolved: boolean
  /** 'markup' = the document asserted this identity by URI. 'text' = we resolved
   *  the Act's NAME against corpus_acts titles. Never merge the two in a count
   *  without saying so — see setup-citation-edge-table.ts. */
  detection: 'markup' | 'text'
}

/** Provision refs inside a Part, read from the Act's own CLML. */
export function expandPart(gid: string, partRef: string): { available: boolean; refs: string[]; note: string } {
  if (!fs.existsSync(ZIP_PATH)) {
    return { available: false, refs: [partRef], note: `bulk CLML not on disk at ${ZIP_PATH} — a Part cannot be expanded, only the literal ref '${partRef}' is matched` }
  }
  let zip: ZipReader | null = null
  try {
    zip = new ZipReader(ZIP_PATH)
    const entry = zip.entries.find(e => {
      const m = e.name.match(ENTRY_RX)
      return m != null && gidFromEntry(m) === gid
    })
    if (!entry) return { available: false, refs: [partRef], note: `${gid} is not in the bulk CLML file — Part not expanded` }
    const xml = zip.readText(entry)
    const opens = [...xml.matchAll(/<Part\b[^>]*\sid="([^"]+)"[^>]*>/g)]
    const meIx = opens.findIndex(m => m[1] === partRef)
    if (meIx < 0) return { available: false, refs: [partRef], note: `${gid} has no Part with id="${partRef}"` }
    const start = opens[meIx].index!
    // the Part ends where the next Part at the SAME level begins (a schedule's
    // internal Parts are ids like `schedule-1-part-1`, so they never collide)
    const sameLevel = opens.filter(m => m[1].startsWith('schedule-') === partRef.startsWith('schedule-'))
    const myIx = sameLevel.findIndex(m => m[1] === partRef)
    const end = myIx + 1 < sameLevel.length ? sameLevel[myIx + 1].index! : xml.length
    const slice = xml.slice(start, end)
    const refs = new Set<string>([partRef])
    for (const m of slice.matchAll(/<(?:P1|Section|Article|Regulation|Rule|Paragraph)\b[^>]*\sid="([^"]+)"/g)) refs.add(m[1])
    return { available: true, refs: [...refs], note: `${refs.size - 1} provisions read from ${gid} ${partRef}` }
  } catch (e) {
    return { available: false, refs: [partRef], note: `Part expansion failed: ${(e as Error).message}` }
  } finally {
    zip?.close()
  }
}

/** SQL predicate matching a provision ref and its subsection descendants. */
function provisionPredicate(refs: string[], from: number): { sql: string; params: string[] } {
  const clauses: string[] = []
  const params: string[] = []
  for (const r of refs) {
    params.push(r)
    clauses.push(`target_provision_ref = $${from + params.length}`)
    // subsection/inserted-sibling descendants: `section-3` → `section-3-2`,
    // `section-3a`; never `section-30` (a digit may not follow directly).
    params.push(r + '%')
    clauses.push(`(target_provision_ref LIKE $${from + params.length} AND substring(target_provision_ref from ${r.length + 1} for 1) !~ '[0-9]')`)
  }
  return { sql: `(${clauses.join(' OR ')})`, params }
}

export type InboundOptions = { limit?: number; evidence?: boolean; detection?: 'markup' | 'text' }

async function query(
  targetActId: string,
  targetProvisionRef: string | null,
  includeUnresolved: boolean,
  opts: InboundOptions,
): Promise<{ rows: InboundEvidenceRow[]; partExpansion: ReturnType<typeof expandPart> | null }> {
  const pool = getNeonPool()
  const params: unknown[] = [targetActId]
  let where = `target_act_id = $1`
  // `resolved` is about the TARGET being an instrument we hold text for. An
  // inbound query for an Act we DO hold is by definition resolved=true, so the
  // flag only ever excludes rows whose target_act_id was normalised to
  // something unheld — which for this query would be none. Kept because the
  // brief specifies it and because it is the honest switch if the target is an
  // Act the corpus does not hold.
  if (!includeUnresolved) where += ` AND resolved = true`
  let partExpansion: ReturnType<typeof expandPart> | null = null
  if (targetProvisionRef) {
    let refs = [targetProvisionRef]
    if (/^(schedule-\d+[a-z]*-)?part-/i.test(targetProvisionRef)) {
      partExpansion = expandPart(targetActId, targetProvisionRef)
      refs = partExpansion.refs
    }
    const p = provisionPredicate(refs, params.length)
    where += ` AND ${p.sql}`
    params.push(...p.params)
  }
  if (opts.detection) { params.push(opts.detection); where += ` AND detection = $${params.length}` }
  const cols = opts.evidence
    ? `source_doc_uri, source_provision_ref, citation_text, source_type, source_gid, target_uri, target_act_id, target_provision_ref, raw_fragment, resolved, detection`
    : `source_doc_uri, source_provision_ref, citation_text, source_type`
  const limit = opts.limit ? ` LIMIT ${Math.max(1, Math.floor(opts.limit))}` : ''
  const { rows } = await pool.query(
    `SELECT ${cols} FROM ${CITATION_TABLE} WHERE ${where} ORDER BY source_type, source_gid, source_provision_ref${limit}`, params)
  return { rows: rows as InboundEvidenceRow[], partExpansion }
}

/** The brief's signature, returning exactly the four fields it names. */
export async function inbound(
  targetActId: string,
  targetProvisionRef: string | null = null,
  includeUnresolved = false,
): Promise<InboundRow[]> {
  const { rows } = await query(targetActId, targetProvisionRef, includeUnresolved, {})
  return rows
}

/** Same query, every column, for export and for hand-verification. */
export async function inboundEvidence(
  targetActId: string,
  targetProvisionRef: string | null = null,
  includeUnresolved = false,
  detection?: 'markup' | 'text',
): Promise<{ rows: InboundEvidenceRow[]; partExpansion: ReturnType<typeof expandPart> | null }> {
  return query(targetActId, targetProvisionRef, includeUnresolved, { evidence: true, detection })
}

export type InboundSummary = {
  target_act_id: string
  total: number
  actLevel: number           // rows naming the Act with no provision — the FLOOR on unknown provision-level exposure
  provisionLevel: number
  distinctSourceActs: number
  bySourceType: Array<{ source_type: string; n: number; distinct_sources: number }>
  bySourceAct: Array<{ source_gid: string; source_type: string; n: number }>
  /** ⚠ Always reported. A total that hides the markup/text split invites the
   *  reader to treat an inferred edge as an asserted one. */
  byDetection: Array<{ detection: string; n: number; distinct_sources: number }>
}

export async function inboundSummary(targetActId: string, topSourceActs = 50): Promise<InboundSummary> {
  const pool = getNeonPool()
  const { rows: t } = await pool.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE target_provision_ref IS NULL)::int AS act_level,
            COUNT(*) FILTER (WHERE target_provision_ref IS NOT NULL)::int AS provision_level,
            COUNT(DISTINCT source_gid)::int AS distinct_sources
     FROM ${CITATION_TABLE} WHERE target_act_id = $1`, [targetActId])
  const { rows: byDetection } = await pool.query(
    `SELECT detection, COUNT(*)::int AS n, COUNT(DISTINCT source_gid)::int AS distinct_sources
     FROM ${CITATION_TABLE} WHERE target_act_id = $1 GROUP BY 1 ORDER BY n DESC`, [targetActId])
  const { rows: byType } = await pool.query(
    `SELECT source_type, COUNT(*)::int AS n, COUNT(DISTINCT source_gid)::int AS distinct_sources
     FROM ${CITATION_TABLE} WHERE target_act_id = $1 GROUP BY 1 ORDER BY n DESC`, [targetActId])
  const { rows: byAct } = await pool.query(
    `SELECT source_gid, source_type, COUNT(*)::int AS n
     FROM ${CITATION_TABLE} WHERE target_act_id = $1 GROUP BY 1, 2 ORDER BY n DESC, source_gid LIMIT $2`,
    [targetActId, topSourceActs])
  return {
    target_act_id: targetActId,
    total: t[0].total,
    actLevel: t[0].act_level,
    provisionLevel: t[0].provision_level,
    distinctSourceActs: t[0].distinct_sources,
    bySourceType: byType,
    bySourceAct: byAct,
    byDetection,
  }
}
