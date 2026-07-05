/**
 * extract-effects-edges.ts — parse the TNA bulk amendments (effects) XML into
 * `legislation_edges` rows: amends / repeals / commences / modifies.
 *
 * Input: graph/data/amendments-to-*.zip (download-graph-sources.ts), each a set
 * of per-year `<ukm:EffectsBatch>` XML files of `<ukm:Effect>` elements:
 *   from = AffectingURI (+ first AffectingProvisions ukm:Section → section-level)
 *   to   = AffectedURI  (+ every AffectedProvisions ukm:Section → section-level,
 *          fan-out capped at MAX_FANOUT → single act-level edge instead, counted)
 *   edge_type = bucket of Type (graph-common.edgeTypeForEffect), sub_type = raw
 *   detail (commences only) = "date|qualification|applied" from first ukm:InForce
 *
 * Resumable/idempotent: per-(zip,entry) checkpoint + PK ON CONFLICT DO NOTHING
 * (the same effect appearing in overlapping zips — to-secondary vs fresh to-uksi
 * — collapses on the PK). Zero silent drops: every skip/cap is counted + printed.
 *
 *   npx tsx graph/extract-effects-edges.ts --pilot     — first 3 entries/zip, stats + size extrapolation, NO writes
 *   npx tsx graph/extract-effects-edges.ts             — full run (resumes from checkpoint)
 *   npx tsx graph/extract-effects-edges.ts --reset     — clear checkpoint first
 */
import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { endNeonPool } from '../shared/neon-pool'
import { DATA_DIR } from './download-graph-sources'
import { EdgeRow, dedupeEdges, edgeTypeForEffect, edgeId, granularityOf, insertEdges, normaliseSubType, parseLegUri } from './graph-common'

const CHECKPOINT = path.join(__dirname, 'effects-checkpoint.json')
const SOURCE = 'tna-bulk-amendments'
const MAX_FANOUT = 50

type Stats = {
  entries: number
  effects: number
  edges: number
  written: number
  skipNoAffected: number
  skipNoAffecting: number
  skipBadUri: number
  fanoutCapped: number
  ranges: number
  byEdgeType: Record<string, number>
}
const stats: Stats = { entries: 0, effects: 0, edges: 0, written: 0, skipNoAffected: 0, skipNoAffecting: 0, skipBadUri: 0, fanoutCapped: 0, ranges: 0, byEdgeType: {} }

function attr(el: string, name: string): string | null {
  const m = el.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))
  return m ? m[1] : null
}

function sectionRefs(el: string, container: 'AffectedProvisions' | 'AffectingProvisions'): string[] {
  const m = el.match(new RegExp(`<ukm:${container}>([\\s\\S]*?)</ukm:${container}>`))
  if (!m) return []
  if (m[1].includes('SectionRange')) stats.ranges++
  const refs: string[] = []
  for (const s of m[1].matchAll(/<ukm:Section\b[^>]*\sRef="([^"]+)"/g)) refs.push(s[1])
  return [...new Set(refs)]
}

function effectToEdges(el: string): EdgeRow[] {
  stats.effects++
  const rawType = attr(el, 'Type') ?? ''
  const affectedUri = attr(el, 'AffectedURI')
  const affectingUri = attr(el, 'AffectingURI')
  if (!affectedUri) { stats.skipNoAffected++; return [] }
  if (!affectingUri) { stats.skipNoAffecting++; return [] }
  const affected = parseLegUri(affectedUri)
  const affecting = parseLegUri(affectingUri)
  if (!affected || !affecting) { stats.skipBadUri++; return [] }

  const edgeType = edgeTypeForEffect(rawType)
  const subType = normaliseSubType(rawType)
  stats.byEdgeType[edgeType] = (stats.byEdgeType[edgeType] ?? 0) + 1

  // from: first affecting provision (the operative one) or the act
  const fromRefs = sectionRefs(el, 'AffectingProvisions')
  const fromId = edgeId(affecting.gid, fromRefs[0] ?? null)

  // detail: commencement in-force facts (needed for "not yet in force" queries)
  let detail: string | null = null
  if (edgeType === 'commences' || edgeType === 'repeals') {
    const inforce = el.match(/<ukm:InForce\b[^>]*>/)
    if (inforce) {
      const date = attr(inforce[0], 'Date') ?? ''
      const qual = attr(inforce[0], 'Qualification') ?? ''
      const applied = attr(inforce[0], 'Applied') ?? attr(el, 'Applied') ?? ''
      detail = `${date}|${qual}|${applied}`.slice(0, 120)
    } else if (attr(el, 'Applied')) {
      detail = `||${attr(el, 'Applied')}`
    }
  }

  // to: every affected provision, act-level when none or when fan-out capped
  let toRefs = sectionRefs(el, 'AffectedProvisions')
  if (toRefs.length > MAX_FANOUT) {
    stats.fanoutCapped++
    detail = `${detail ?? ''}#provisions:${toRefs.length}`
    toRefs = []
  }
  const targets = toRefs.length > 0 ? toRefs : [null]
  return targets.map(ref => ({
    fromId,
    toId: edgeId(affected.gid, ref),
    edgeType,
    subType,
    source: SOURCE,
    granularity: granularityOf(fromRefs.length > 0, ref !== null),
    detail,
  }))
}

function loadCheckpoint(): Set<string> {
  if (!fs.existsSync(CHECKPOINT)) return new Set()
  return new Set(JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')).done as string[])
}
function saveCheckpoint(done: Set<string>) {
  fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done] }))
}

async function main() {
  const pilot = process.argv.includes('--pilot')
  if (process.argv.includes('--reset') && fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT)
  const done = pilot ? new Set<string>() : loadCheckpoint()

  const zips = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('amendments-to-') && f.endsWith('.zip')).sort()
  if (zips.length === 0) throw new Error(`no amendments zips in ${DATA_DIR} — run download-graph-sources.ts first`)
  console.log(`[effects] ${zips.length} zips${pilot ? ' (PILOT: 3 entries/zip, no writes)' : ''}`)

  let pilotBytes = 0
  for (const zipName of zips) {
    const zip = new AdmZip(path.join(DATA_DIR, zipName))
    let entries = zip.getEntries().filter(e => e.entryName.endsWith('.xml')).sort((a, b) => a.entryName.localeCompare(b.entryName))
    if (pilot) entries = entries.slice(0, 3)
    for (const entry of entries) {
      const key = `${zipName}:${entry.entryName}`
      if (done.has(key)) continue
      const xml = zip.readAsText(entry)
      stats.entries++
      const edges: EdgeRow[] = []
      for (const m of xml.matchAll(/<ukm:Effect\b[^>]*(?:\/>|>[\s\S]*?<\/ukm:Effect>)/g)) {
        edges.push(...effectToEdges(m[0]))
      }
      const deduped = dedupeEdges(edges)
      stats.edges += deduped.length
      if (pilot) {
        pilotBytes += deduped.reduce((n, r) => n + r.fromId.length + r.toId.length + r.subType.length + (r.detail?.length ?? 0) + 40, 0)
      } else {
        stats.written += await insertEdges(deduped)
        done.add(key)
        saveCheckpoint(done)
      }
      console.log(`  ${key}: effects=${stats.effects} edges+=${deduped.length}`)
    }
  }

  console.log('\n[effects] stats:', JSON.stringify(stats, null, 1))
  const dropped = stats.skipNoAffected + stats.skipNoAffecting + stats.skipBadUri
  console.log(`[effects] accounted: effects=${stats.effects} = edges-producing + skips(${dropped}); fanout-capped→act-level: ${stats.fanoutCapped}`)
  if (pilot) {
    const perEffect = stats.edges / Math.max(1, stats.effects)
    const bytesPerEdge = pilotBytes / Math.max(1, stats.edges)
    console.log(`[effects] PILOT extrapolation: ${perEffect.toFixed(2)} edges/effect, ~${Math.round(bytesPerEdge)}B/edge payload`)
    console.log(`          (apply to full-run effect counts before approving the full load)`)
  }
  await endNeonPool()
}
main().catch(e => { console.error('[effects] FATAL', e); process.exit(1) })
