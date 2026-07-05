/**
 * extract-cites-edges.ts — `cites` edges from the <Citation>/<CitationSubRef>
 * markup in whole-doc CLML (best-collection-xml.zip).
 *
 * AUDIT FINDING the design follows: the per-section raw.xml in R2 has NO
 * citation markup (TNA's per-provision data.xml serves act names as plain
 * text), so the brief's "XML we already hold" for cites is the BULK whole-doc
 * CLML, where citations ARE marked up with URI/SectionRef.
 *
 * Scope: body citations only —
 *   - <Commentaries>/<Footnote> blocks are EXCLUDED (amendment-provenance
 *     annotations; those edges come from the effects data, deduplicating here)
 *   - <SecondaryPreamble> is EXCLUDED (that's made-under, own extractor)
 *   - self-citations (doc citing its own gid) are counted, not stored
 * Attribution: each citation is attributed to the nearest preceding CLML
 * provision element open-tag (P1/Article/Regulation/Rule/Paragraph/Section,
 * the same id set corpus_sections sectionRefs come from) → section-level
 * from_id where possible, act-level otherwise.
 * Targets: CitationSubRef with SectionRef → section-level to_id; bare
 * Citation → act-level.
 *
 * NEON SIZE GATE: run --pilot first; it extrapolates total rows. The full run
 * REFUSES to start unless --max-rows (projection gate, default 4,000,000) is
 * satisfied by the pilot projection recorded in cites-pilot.json.
 * Downgrade lever if projection is too big: --to-act collapses targets to
 * act-level (fewer distinct pairs).
 *
 * Zip access via graph/zip-reader.ts (streaming central directory) — adm-zip's
 * whole-file 1.4 GB Buffer fails allocation on this machine.
 *
 *   npx tsx graph/extract-cites-edges.ts --pilot [N=2000]   — stats + projection, no writes
 *   npx tsx graph/extract-cites-edges.ts [--to-act]         — full run (checkpointed)
 */
import fs from 'fs'
import path from 'path'
import { ZipReader, ZipEntryMeta } from './zip-reader'
import { endNeonPool } from '../shared/neon-pool'
import { EdgeRow, dedupeEdges, edgeId, granularityOf, insertEdges, parseLegUri } from './graph-common'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
const CHECKPOINT = path.join(__dirname, 'cites-checkpoint.json')
const PILOT_FILE = path.join(__dirname, 'cites-pilot.json')
const SOURCE = 'clml-body-citation'

type Stats = { docs: number; citations: number; excludedZone: number; selfCites: number; badUri: number; edges: number; written: number; sectionFrom: number; docErrors: number }
const stats: Stats = { docs: 0, citations: 0, excludedZone: 0, selfCites: 0, badUri: 0, edges: 0, written: 0, sectionFrom: 0, docErrors: 0 }

/** Ranges of the doc to exclude (commentaries, footnotes, preamble). */
function exclusionZones(xml: string): Array<[number, number]> {
  const zones: Array<[number, number]> = []
  for (const rx of [/<Commentaries>[\s\S]*?<\/Commentaries>/g, /<Footnote\b[\s\S]*?<\/Footnote>/g, /<SecondaryPreamble>[\s\S]*?<\/SecondaryPreamble>/g]) {
    for (const m of xml.matchAll(rx)) zones.push([m.index, m.index + m[0].length])
  }
  return zones.sort((a, b) => a[0] - b[0])
}

/** Sorted-zone membership with a moving cursor — citations arrive in document
 *  order, so this is O(zones + citations) instead of O(zones × citations)
 *  (the naive scan made 100k-citation revised acts pathological). */
function zoneCursor(zones: Array<[number, number]>) {
  let zi = 0
  return (i: number): boolean => {
    while (zi < zones.length && zones[zi][1] <= i) zi++
    return zi < zones.length && i >= zones[zi][0]
  }
}

/** Offsets of provision open-tags with ids, in document order. */
function provisionMarks(xml: string): Array<{ at: number; id: string }> {
  const marks: Array<{ at: number; id: string }> = []
  for (const m of xml.matchAll(/<(?:P1|Article|Regulation|Rule|Paragraph|Section)\b[^>]*\sid="([^"]+)"/g)) {
    marks.push({ at: m.index, id: m[1] })
  }
  return marks
}

function extractDoc(gid: string, xml: string): EdgeRow[] {
  stats.docs++
  const zones = exclusionZones(xml)
  const inZone = zoneCursor(zones)
  const marks = provisionMarks(xml)
  const edges: EdgeRow[] = []
  let mi = 0
  const rx = /<(Citation|CitationSubRef)\b[^>]*\sURI="([^"]+)"[^>]*>/g
  for (const m of xml.matchAll(rx)) {
    stats.citations++
    if (inZone(m.index)) { stats.excludedZone++; continue }
    const target = parseLegUri(m[2])
    if (!target) { stats.badUri++; continue }
    if (target.gid === gid) { stats.selfCites++; continue }
    // nearest preceding provision mark (marks and citations are both in doc order,
    // but matchAll restarts — walk mi forward)
    while (mi < marks.length && marks[mi].at < m.index) mi++
    const fromRef = mi > 0 ? marks[mi - 1].id : null
    if (fromRef) stats.sectionFrom++
    const toRef = m[1] === 'CitationSubRef' ? target.sectionRef : null
    edges.push({
      fromId: edgeId(gid, fromRef),
      toId: edgeId(target.gid, toRef),
      edgeType: 'cites',
      subType: '',
      source: SOURCE,
      granularity: granularityOf(fromRef !== null, toRef !== null),
      detail: null,
    })
  }
  return edges
}

/** Collapse target ids to act level (`corpus:gid`) — the --to-act downgrade lever. */
function collapseToAct(edges: EdgeRow[]): EdgeRow[] {
  return dedupeEdges(edges.map(e => {
    const [corpus, gid] = e.toId.split(':')
    return { ...e, toId: `${corpus}:${gid}`, granularity: e.granularity.replace(/-section$/, '-act') }
  }))
}

function legEntries(zip: ZipReader) {
  return zip.entries
    .map(e => ({ e, m: e.name.match(/\/([a-z]+)-(\d{4})-(\d+)-\w+-data\.xml$/) }))
    .filter((x): x is { e: ZipEntryMeta; m: RegExpMatchArray } => x.m != null)
}

async function main() {
  const pilotIx = process.argv.indexOf('--pilot')
  const pilot = pilotIx >= 0
  const pilotN = pilot ? parseInt(process.argv[pilotIx + 1] ?? '2000', 10) || 2000 : 0
  const toAct = process.argv.includes('--to-act')
  if (process.argv.includes('--reset') && fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT)
  const done: Set<string> = pilot || !fs.existsSync(CHECKPOINT) ? new Set() : new Set(JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')).done)

  console.log(`[cites] opening ${ZIP_PATH}…`)
  const zip = new ZipReader(ZIP_PATH)
  const entries = legEntries(zip)
  console.log(`[cites] ${entries.length} legislation docs${pilot ? ` (PILOT: every ${Math.floor(entries.length / pilotN)}th doc, ${pilotN} docs, no writes)` : toAct ? ' (--to-act)' : ''}`)

  // size gate for the full run
  if (!pilot) {
    if (!fs.existsSync(PILOT_FILE)) throw new Error('no cites-pilot.json — run --pilot first (Neon size gate)')
    const p = JSON.parse(fs.readFileSync(PILOT_FILE, 'utf8'))
    const gate = parseInt(process.argv[process.argv.indexOf('--max-rows') + 1] ?? '', 10) || 4_000_000
    const projected = toAct ? p.projectedRowsToAct : p.projectedRows
    if (projected > gate) throw new Error(`projected ${projected} rows > gate ${gate} — use --to-act (projected ${p.projectedRowsToAct}) or raise --max-rows deliberately`)
    console.log(`[cites] size gate OK: projected ${projected} ≤ ${gate}`)
  }

  // pilot samples uniformly across the corpus (not just the oldest docs)
  const step = pilot ? Math.max(1, Math.floor(entries.length / pilotN)) : 1
  let buffer: EdgeRow[] = []
  let processed = 0
  let pilotEdgesToAct = 0
  const t0 = Date.now()
  for (let i = 0; i < entries.length; i += step) {
    const { e, m } = entries[i]
    const gid = `${m[1]}/${m[2]}/${m[3]}`
    if (done.has(gid)) continue
    try {
      const xml = zip.readText(e)
      const raw = dedupeEdges(extractDoc(gid, xml))
      if (pilot) pilotEdgesToAct += collapseToAct(raw).length
      const docEdges = toAct ? collapseToAct(raw) : raw
      stats.edges += docEdges.length
      buffer.push(...docEdges)
    } catch (err) {
      stats.docErrors++
      console.error(`  DOC ERROR ${gid}: ${(err as Error).message}`)
    }
    done.add(gid)
    processed++
    if (pilot && processed >= pilotN) break
    if (!pilot) {
      if (buffer.length >= 5000) {
        stats.written += await insertEdges(dedupeEdges(buffer))
        buffer = []
        fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done] }))
      }
      if (processed % 200 === 0) {
        const mu = process.memoryUsage()
        console.log(`  ${processed}/${entries.length} docs (at ${entries[i].m[0]}), edges=${stats.edges}, written=${stats.written}, heap=${Math.round(mu.heapUsed / 1e6)}MB rss=${Math.round(mu.rss / 1e6)}MB, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
      }
    }
  }
  if (!pilot && buffer.length > 0) {
    stats.written += await insertEdges(dedupeEdges(buffer))
    fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done] }))
  }

  console.log('\n[cites] stats:', JSON.stringify(stats, null, 1))
  console.log(`[cites] accounted: citations=${stats.citations} = stored-or-buffered(${stats.edges} deduped) + excludedZone(${stats.excludedZone}) + selfCites(${stats.selfCites}) + badUri(${stats.badUri}) [dedupe collapses the rest]`)
  if (pilot) {
    const perDoc = stats.edges / Math.max(1, stats.docs)
    const projectedRows = Math.round(perDoc * entries.length)
    const projectedRowsToAct = Math.round((pilotEdgesToAct / Math.max(1, stats.docs)) * entries.length)
    fs.writeFileSync(PILOT_FILE, JSON.stringify({ sampledDocs: stats.docs, perDoc, projectedRows, projectedRowsToAct, at: new Date().toISOString() }, null, 1))
    console.log(`[cites] PILOT projection: ${perDoc.toFixed(1)} edges/doc × ${entries.length} docs ≈ ${projectedRows} rows (→ cites-pilot.json)`)
    console.log(`        at ~300B/row incl. indexes ≈ ${(projectedRows * 300 / 1e9).toFixed(2)} GB — Neon headroom is ~2.5GB, gate is 4M rows`)
  }
  await endNeonPool()
}
main().catch(e => { console.error('[cites] FATAL', e); process.exit(1) })
