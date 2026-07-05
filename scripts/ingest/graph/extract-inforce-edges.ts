/**
 * extract-inforce-edges.ts — act-level `repeals` edges from the TNA In-Force
 * dataset CSVs (research.legislation.gov.uk "Statute Book Metadata"; local copy
 * scripts/legislation/v276-samples/inforce/InForce_results_47/, downloaded
 * 14 May 2026, dataset vintage ~Aug 2025).
 *
 * Why alongside the effects data: TNA "changes to legislation" coverage starts
 * ~2002 — repeals of/by older instruments (back to 1235) exist ONLY here. Rows
 * whose status names a repealing/revoking instrument (`repealedBy`, `revokedBy`,
 * jurisdiction variants, `supersededBy`, `determinedBy` with an `affecting`
 * URI) become: from = affecting instrument (act-level), to = the item
 * (act-level; provision-level for the ancient acts the dataset splits),
 * sub_type = the raw status code, detail = jurisdictional scope if encoded.
 *
 *   npx tsx graph/extract-inforce-edges.ts --pilot   — stats only
 *   npx tsx graph/extract-inforce-edges.ts           — full load (idempotent)
 */
import fs from 'fs'
import path from 'path'
import { endNeonPool } from '../shared/neon-pool'
import { EdgeRow, dedupeEdges, edgeId, granularityOf, insertEdges, parseLegUri } from './graph-common'

const CSV_DIR = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-samples/inforce/InForce_results_47'
const SOURCE = 'tna-inforce-dataset'

type Stats = { rows: number; repealRows: number; noAffecting: number; badUri: number; edges: number; written: number; byStatus: Record<string, number> }
const stats: Stats = { rows: 0, repealRows: 0, noAffecting: 0, badUri: 0, edges: 0, written: 0, byStatus: {} }

// status codes that name a repealing/revoking instrument in `affecting`
const REPEAL_STATUS = /^(repealed|revoked|superseded|determined)/i

/** Tiny CSV parser (the dataset quotes fields containing commas). */
function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQ) {
      if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++ } else inQ = false }
      else cur += c
    } else if (c === '"') inQ = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

async function main() {
  const pilot = process.argv.includes('--pilot')
  const files = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'))
  console.log(`[inforce] ${files.length} CSVs${pilot ? ' (PILOT: no writes)' : ''}`)
  let buffer: EdgeRow[] = []
  for (const f of files) {
    const lines = fs.readFileSync(path.join(CSV_DIR, f), 'utf8').split(/\r?\n/)
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i]) continue
      stats.rows++
      const [item, , , , , status, affecting] = parseCsvLine(lines[i])
      if (!status || !REPEAL_STATUS.test(status)) continue
      stats.repealRows++
      stats.byStatus[status] = (stats.byStatus[status] ?? 0) + 1
      if (!affecting) { stats.noAffecting++; continue }
      const to = parseLegUri(item)
      const from = parseLegUri(affecting)
      if (!to || !from) { stats.badUri++; continue }
      buffer.push({
        fromId: edgeId(from.gid, from.sectionRef),
        toId: edgeId(to.gid, to.sectionRef),
        edgeType: 'repeals',
        subType: status.slice(0, 64),
        source: SOURCE,
        granularity: granularityOf(from.sectionRef != null, to.sectionRef != null),
        detail: null,
      })
    }
    if (!pilot && buffer.length > 0) {
      const deduped = dedupeEdges(buffer)
      stats.edges += deduped.length
      stats.written += await insertEdges(deduped)
      buffer = []
    } else if (pilot) {
      const deduped = dedupeEdges(buffer)
      stats.edges += deduped.length
      buffer = []
    }
    console.log(`  ${f}: rows=${stats.rows} repealRows=${stats.repealRows} edges=${stats.edges}`)
  }
  console.log('\n[inforce] stats:', JSON.stringify({ ...stats, byStatus: Object.fromEntries(Object.entries(stats.byStatus).sort((a, b) => b[1] - a[1]).slice(0, 12)) }, null, 1))
  console.log(`[inforce] accounted: repealRows=${stats.repealRows} = edges-emitted + noAffecting(${stats.noAffecting}) + badUri(${stats.badUri}) [dedupe collapses the rest]`)
  await endNeonPool()
}
main().catch(e => { console.error('[inforce] FATAL', e); process.exit(1) })
