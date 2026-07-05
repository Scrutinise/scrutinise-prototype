/**
 * traverse-edges.ts — the rescission-impact traversal over `legislation_edges`.
 *
 * Question answered: "if this section/Act is repealed, what is affected?"
 * Given a target (gid, optionally narrowed to a section), returns the impact
 * set grouped by edge type and depth:
 *
 *   direct (depth 1):
 *     madeUnder   — SIs made under the target (they lose their vires)          [to=target, made-under]
 *     citedBy     — provisions whose text cites the target                     [to=target, cites]
 *     amendedBy   — instruments that amended/modified the target (now spent)   [to=target, amends|modifies]
 *     repealedBy  — anything already repealing the target (incl. prospective)  [to=target, repeals]
 *     commencedBy — commencement provisions bringing the target into force     [to=target, commences]
 *     targetTouches — provisions the target itself amends/repeals/commences/
 *                     modifies (its footprint elsewhere on the statute book)   [from=target]
 *   oneHop (depth 2, over the direct madeUnder SIs):
 *     the same inbound groups for each dependent SI — what leans on the things
 *     that lean on the target.
 *
 * Titles are resolved from LegislationItem (same act-title index the citation
 * resolver uses). Exposed as a function (used by edges-query-service.ts and
 * score-gold-d.ts) + a small CLI:
 *
 *   npx tsx graph/traverse-edges.ts ukpga/2022/30
 *   npx tsx graph/traverse-edges.ts ukpga/1988/50 section-21 --depth 2
 */
import { Pool } from 'pg'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { EDGE_TABLE } from './graph-common'

export type ImpactEdge = {
  id: string          // the OTHER end of the edge (corpus-scheme id)
  gid: string
  sectionRef: string | null
  title: string | null
  edgeType: string
  subType: string
  granularity: string
  detail: string | null
  via?: string        // oneHop: the depth-1 node this came through
}

export type ImpactGroups = {
  madeUnder: ImpactEdge[]
  citedBy: ImpactEdge[]
  amendedBy: ImpactEdge[]
  repealedBy: ImpactEdge[]
  commencedBy: ImpactEdge[]
  targetTouches: ImpactEdge[]
}

export type ImpactSet = {
  target: { gid: string; sectionRef: string | null; title: string | null }
  counts: Record<string, number>
  direct: ImpactGroups
  oneHop: Pick<ImpactGroups, 'madeUnder' | 'citedBy'>
}

const INBOUND_GROUP: Record<string, keyof ImpactGroups> = {
  'made-under': 'madeUnder',
  cites: 'citedBy',
  amends: 'amendedBy',
  modifies: 'amendedBy',
  repeals: 'repealedBy',
  commences: 'commencedBy',
}

function parseEdgeEnd(id: string): { gid: string; sectionRef: string | null } {
  const parts = id.split(':')
  return { gid: parts[1] ?? id, sectionRef: parts[2] ?? null }
}

async function titlesFor(pool: Pool, gids: string[]): Promise<Map<string, string>> {
  if (gids.length === 0) return new Map()
  const { rows } = await pool.query(
    `SELECT "legislationGovUkId" AS gid, title FROM "LegislationItem" WHERE "legislationGovUkId" = ANY($1)`,
    [[...new Set(gids)]],
  )
  return new Map(rows.map((r: { gid: string; title: string }) => [r.gid, r.title]))
}

/** Section-ref match: the ref itself, its sub-refs (TNA records at subsection
 *  grain — `section-21-4`), inserted siblings (`section-21A`), or the act-level
 *  id '' (an act-level repeal hits every section). */
function refPattern(sectionRef: string): string {
  return `^${sectionRef.replace(/[^A-Za-z0-9-]/g, '')}([A-Z]|-|$)`
}

/** Inbound edges (to = the given gid/section) for ONE edge_type — per-type
 *  queries so a heavily-amended act can't crowd other groups out of the fetch. */
async function inbound(pool: Pool, gid: string, sectionRef: string | null, edgeType: string, limit: number): Promise<Array<{ other: string; edge_type: string; sub_type: string; granularity: string; detail: string | null }>> {
  const params: unknown[] = [gid, edgeType, limit]
  let refFilter = ''
  if (sectionRef) {
    refFilter = `AND (split_part(to_id, ':', 3) ~ $4 OR split_part(to_id, ':', 3) = '')`
    params.push(refPattern(sectionRef))
  }
  const { rows } = await pool.query(
    `SELECT from_id AS other, edge_type, sub_type, granularity, detail
     FROM ${EDGE_TABLE}
     WHERE split_part(to_id, ':', 2) = $1 AND edge_type = $2 ${refFilter}
     ORDER BY from_id LIMIT $3`, params)
  return rows
}

async function outbound(pool: Pool, gid: string, sectionRef: string | null, limit: number): Promise<Array<{ other: string; edge_type: string; sub_type: string; granularity: string; detail: string | null }>> {
  const params: unknown[] = [gid, limit]
  let refFilter = ''
  if (sectionRef) {
    refFilter = `AND (split_part(from_id, ':', 3) ~ $3 OR split_part(from_id, ':', 3) = '')`
    params.push(refPattern(sectionRef))
  }
  const { rows } = await pool.query(
    `SELECT to_id AS other, edge_type, sub_type, granularity, detail
     FROM ${EDGE_TABLE}
     WHERE split_part(from_id, ':', 2) = $1 ${refFilter}
     ORDER BY edge_type, to_id LIMIT $2`, params)
  return rows
}

const emptyGroups = (): ImpactGroups => ({ madeUnder: [], citedBy: [], amendedBy: [], repealedBy: [], commencedBy: [], targetTouches: [] })

export async function impactSet(pool: Pool, gid: string, sectionRef: string | null = null, opts: { depth?: 1 | 2; limitPerGroup?: number } = {}): Promise<ImpactSet> {
  const depth = opts.depth ?? 2
  const limit = opts.limitPerGroup ?? 500

  const direct = emptyGroups()
  for (const [edgeType, group] of Object.entries(INBOUND_GROUP)) {
    const room = limit - direct[group].length
    if (room <= 0) continue
    for (const r of await inbound(pool, gid, sectionRef, edgeType, room)) {
      const end = parseEdgeEnd(r.other)
      direct[group].push({ id: r.other, ...end, title: null, edgeType: r.edge_type, subType: r.sub_type, granularity: r.granularity, detail: r.detail })
    }
  }
  const outRows = await outbound(pool, gid, sectionRef, limit)
  for (const r of outRows) {
    if (direct.targetTouches.length >= limit) break
    const end = parseEdgeEnd(r.other)
    direct.targetTouches.push({ id: r.other, ...end, title: null, edgeType: r.edge_type, subType: r.sub_type, granularity: r.granularity, detail: r.detail })
  }

  // one hop: what depends on the SIs that depend on the target
  const oneHop: ImpactSet['oneHop'] = { madeUnder: [], citedBy: [] }
  if (depth >= 2) {
    const depGids = [...new Set(direct.madeUnder.map(e => e.gid))].slice(0, 50)
    for (const dep of depGids) {
      for (const edgeType of ['made-under', 'cites'] as const) {
        const group = INBOUND_GROUP[edgeType] as 'madeUnder' | 'citedBy'
        if (oneHop[group].length >= limit) continue
        for (const r of await inbound(pool, dep, null, edgeType, 50)) {
          if (oneHop[group].length >= limit) break
          const end = parseEdgeEnd(r.other)
          oneHop[group].push({ id: r.other, ...end, title: null, edgeType: r.edge_type, subType: r.sub_type, granularity: r.granularity, detail: r.detail, via: dep })
        }
      }
    }
  }

  // resolve titles in one query
  const allEdges = [...Object.values(direct).flat(), ...Object.values(oneHop).flat()]
  const titles = await titlesFor(pool, [gid, ...allEdges.map(e => e.gid)])
  for (const e of allEdges) e.title = titles.get(e.gid) ?? null

  const counts: Record<string, number> = {}
  for (const [k, v] of Object.entries(direct)) counts[k] = v.length
  counts['oneHop.madeUnder'] = oneHop.madeUnder.length
  counts['oneHop.citedBy'] = oneHop.citedBy.length

  return { target: { gid, sectionRef, title: titles.get(gid) ?? null }, counts, direct, oneHop }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
async function cli() {
  const raw = process.argv.slice(2)
  const depthIx = raw.indexOf('--depth')
  const depth = depthIx >= 0 ? (parseInt(raw[depthIx + 1], 10) === 1 ? 1 : 2) : 2
  const args = raw.filter((a, i) => !a.startsWith('--') && !(depthIx >= 0 && i === depthIx + 1))
  if (args.length === 0) { console.error('usage: traverse-edges.ts <gid> [sectionRef] [--depth 1|2]'); process.exit(1) }
  const pool = getNeonPool()
  const res = await impactSet(pool, args[0], args[1] ?? null, { depth })
  console.log(`TARGET ${res.target.gid}${res.target.sectionRef ? ':' + res.target.sectionRef : ''}  "${res.target.title ?? '?'}"`)
  console.log('counts:', JSON.stringify(res.counts))
  for (const [group, edges] of Object.entries(res.direct) as Array<[string, ImpactEdge[]]>) {
    if (edges.length === 0) continue
    console.log(`\n── direct.${group} (${edges.length}) ──`)
    for (const e of edges.slice(0, 25)) {
      console.log(`  ${e.edgeType}${e.subType ? '/' + e.subType : ''}  ${e.gid}${e.sectionRef ? ':' + e.sectionRef : ''}  "${e.title ?? ''}"${e.detail ? `  [${e.detail}]` : ''}`)
    }
    if (edges.length > 25) console.log(`  … +${edges.length - 25} more`)
  }
  for (const [group, edges] of Object.entries(res.oneHop) as Array<[string, ImpactEdge[]]>) {
    if (edges.length === 0) continue
    console.log(`\n── oneHop.${group} (${edges.length}) ──`)
    for (const e of edges.slice(0, 15)) console.log(`  via ${e.via}: ${e.gid}  "${e.title ?? ''}"`)
    if (edges.length > 15) console.log(`  … +${edges.length - 15} more`)
  }
  await endNeonPool()
}
if (require.main === module) cli().catch(e => { console.error('[traverse] FATAL', e); process.exit(1) })
