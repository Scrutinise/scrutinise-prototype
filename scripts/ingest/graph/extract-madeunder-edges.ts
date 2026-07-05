/**
 * extract-madeunder-edges.ts — SI → enabling Act/section edges (`made-under`)
 * from SecondaryPreamble/EnactingText in the whole-doc CLML we already hold
 * (scripts/legislation/v276-bulk/best-collection-xml.zip, May 2026 vintage).
 *
 * The per-section corpus ingest dropped preambles (audit finding), but the bulk
 * ZIP's whole-doc CLML has them: "…in exercise of the powers conferred by
 * sections 70(1), 105(7) … of the National Health Service (Scotland) Act
 * 1978<FootnoteRef f00001/>…" where footnote f00001's FIRST <Citation URI>
 * is the enabling act. Modern SIs may carry inline <Citation> in the
 * EnactingText instead. Both are handled:
 *   from = the SI (act-level)
 *   to   = enabling act (act-level), plus section-level edges where a
 *          "section(s)/article(s)/regulation(s) N … of" list precedes the anchor
 *   detail = the start of the enacting text (provenance for review)
 *
 * Revised SIs whose preamble TNA elided ("… . . . .") are counted, not silent.
 *
 * Zip access via graph/zip-reader.ts (streaming central directory) — adm-zip's
 * whole-file 1.4 GB Buffer fails allocation on this machine.
 *
 *   npx tsx graph/extract-madeunder-edges.ts --pilot [N=500]  — stats only, no writes
 *   npx tsx graph/extract-madeunder-edges.ts                  — full run (checkpointed)
 */
import fs from 'fs'
import path from 'path'
import { ZipReader } from './zip-reader'
import { endNeonPool } from '../shared/neon-pool'
import { EdgeRow, dedupeEdges, edgeId, granularityOf, insertEdges, parseLegUri } from './graph-common'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
const CHECKPOINT = path.join(__dirname, 'madeunder-checkpoint.json')
const SOURCE = 'clml-si-preamble'
const SI_TYPES = new Set(['uksi', 'ssi', 'nisr', 'wsi', 'nisro'])

type Stats = {
  siDocs: number
  noPreamble: number
  elidedPreamble: number
  noTarget: number
  recitalFallback: number
  actEdges: number
  sectionEdges: number
  written: number
}
const stats: Stats = { siDocs: 0, noPreamble: 0, elidedPreamble: 0, noTarget: 0, recitalFallback: 0, actEdges: 0, sectionEdges: 0, written: 0 }

const stripTags = (s: string) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

/** "sections 70(1), 105(7) and 108(1) of" → ['section-70','section-105','section-108'];
 *  keyword decides the ref prefix. Looks only at the tail of the text before the anchor. */
function refListBefore(plainBefore: string): string[] {
  const tail = plainBefore.slice(-220)
  const m = tail.match(/\b(section|sections|article|articles|regulation|regulations|paragraph|paragraphs)\s+([0-9][0-9A-Za-z()]*(?:\s*(?:,|and|to)\s*[0-9][0-9A-Za-z()]*)*)\s+of[^.]{0,120}$/i)
  if (!m) return []
  const kw = m[1].toLowerCase().replace(/s$/, '')
  if (kw === 'paragraph') return [] // schedule paragraphs need the schedule number too — act-level is honest
  const nums = m[2].match(/\d+[A-Z]*/gi) ?? []
  return [...new Set(nums.map(n => `${kw}-${n.toUpperCase()}`))]
}

function extractDoc(gid: string, xml: string): EdgeRow[] {
  stats.siDocs++
  const pre = xml.match(/<SecondaryPreamble>[\s\S]*?<\/SecondaryPreamble>/)
  if (!pre) { stats.noPreamble++; return [] }
  const enacting = pre[0].match(/<EnactingText>[\s\S]*?<\/EnactingText>/)?.[0] ?? pre[0]
  const plain = stripTags(enacting)
  if (/(\.\s+){8,}/.test(plain) || plain.replace(/[.\s]/g, '').length < 20) { stats.elidedPreamble++; return [] }

  // footnote id → first Citation gid in that footnote
  const footnoteGid = new Map<string, string>()
  for (const f of xml.matchAll(/<Footnote id="([^"]+)"[\s\S]*?<\/Footnote>/g)) {
    const cite = f[0].match(/<Citation\b[^>]*\sURI="([^"]+)"/)
    const parsed = cite ? parseLegUri(cite[1]) : null
    if (parsed) footnoteGid.set(f[1], parsed.gid)
  }

  // anchors in document order: inline citations + footnote refs inside EnactingText
  const fromId = edgeId(gid)
  const edges: EdgeRow[] = []
  const anchorRx = /<Citation\b[^>]*\sURI="([^"]+)"[^>]*>|<FootnoteRef\b[^>]*\sRef="([^"]+)"[^>]*\/?>/g
  const scan = (scope: string, detailTag: string) => {
    for (const a of scope.matchAll(anchorRx)) {
      const targetGid = a[1] ? parseLegUri(a[1])?.gid : footnoteGid.get(a[2] ?? '')
      if (!targetGid || targetGid === gid) continue
      const detail = (detailTag + plain.slice(0, 160)).slice(0, 200)
      const refs = refListBefore(stripTags(scope.slice(0, a.index)))
      if (refs.length > 0) {
        for (const ref of refs) {
          edges.push({ fromId, toId: edgeId(targetGid, ref), edgeType: 'made-under', subType: '', source: SOURCE, granularity: granularityOf(false, true), detail })
        }
        stats.sectionEdges += refs.length
      }
      edges.push({ fromId, toId: edgeId(targetGid), edgeType: 'made-under', subType: '', source: SOURCE, granularity: granularityOf(false, false), detail })
      stats.actEdges++
    }
  }
  scan(enacting, '')
  if (edges.length === 0 && pre[0] !== enacting) {
    // enacting words cite indirectly ("the Order of 1978", "powers in Schedule 1")
    // — the defining citation sits in the preamble recitals. Lower precision,
    // flagged in detail.
    scan(pre[0], '[preamble-recital] ')
    if (edges.length > 0) stats.recitalFallback++
  }
  if (edges.length === 0) stats.noTarget++
  return edges
}

function loadCheckpoint(): Set<string> {
  if (!fs.existsSync(CHECKPOINT)) return new Set()
  return new Set(JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')).done as string[])
}

async function main() {
  const pilotIx = process.argv.indexOf('--pilot')
  const pilot = pilotIx >= 0
  const pilotN = pilot ? parseInt(process.argv[pilotIx + 1] ?? '500', 10) || 500 : 0
  if (process.argv.includes('--reset') && fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT)
  const done = pilot ? new Set<string>() : loadCheckpoint()

  console.log(`[made-under] opening ${ZIP_PATH}…`)
  const zip = new ZipReader(ZIP_PATH)
  const entries = zip.entries.filter(e => {
    const m = e.name.match(/\/([a-z]+)-\d{4}-\d+-\w+-data\.xml$/)
    return m != null && SI_TYPES.has(m[1])
  })
  console.log(`[made-under] ${entries.length} SI docs in zip${pilot ? ` (PILOT: first ${pilotN}, no writes)` : ''}`)

  let buffer: EdgeRow[] = []
  let processed = 0
  const t0 = Date.now()
  for (const entry of entries) {
    if (pilot && processed >= pilotN) break
    const m = entry.name.match(/\/([a-z]+)-(\d{4})-(\d+)-\w+-data\.xml$/)!
    const gid = `${m[1]}/${m[2]}/${m[3]}`
    if (done.has(gid)) continue
    buffer.push(...extractDoc(gid, zip.readText(entry)))
    done.add(gid)
    processed++
    if (!pilot && buffer.length >= 5000) {
      stats.written += await insertEdges(dedupeEdges(buffer))
      buffer = []
      fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done] }))
      console.log(`  ${processed} docs, written=${stats.written}, ${((Date.now() - t0) / 1000).toFixed(0)}s`)
    }
  }
  if (!pilot && buffer.length > 0) {
    stats.written += await insertEdges(dedupeEdges(buffer))
    fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done] }))
  }

  console.log('\n[made-under] stats:', JSON.stringify(stats, null, 1))
  console.log(`[made-under] accounted: siDocs=${stats.siDocs} = with-edges(${stats.siDocs - stats.noPreamble - stats.elidedPreamble - stats.noTarget}) + noPreamble(${stats.noPreamble}) + elided(${stats.elidedPreamble}) + noTarget(${stats.noTarget})`)
  if (pilot) {
    const perDoc = (stats.actEdges + stats.sectionEdges) / Math.max(1, stats.siDocs - stats.noPreamble - stats.elidedPreamble)
    console.log(`[made-under] PILOT: ${perDoc.toFixed(2)} edges per preambled doc → extrapolate over full SI count before the full run`)
  }
  await endNeonPool()
}
main().catch(e => { console.error('[made-under] FATAL', e); process.exit(1) })
