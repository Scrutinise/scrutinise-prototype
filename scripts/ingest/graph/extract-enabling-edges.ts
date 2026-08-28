/**
 * extract-enabling-edges.ts — GRAPH 4B §2. LAYER 2: THE ENABLING RELATIONSHIP,
 * WITH ITS EVIDENCE.
 *
 * ── WHY THIS IS A SEPARATE EDGE TYPE AND NOT MORE CITATIONS ──────────────────
 *
 * ⚠⚠ "This instrument was made under section 15 of that Act" is **not** "this
 * instrument mentions that Act". An instrument that merely mentions an Act
 * survives its repeal. An instrument whose ENABLING POWER is repealed may fall
 * with it — that is the whole question a repeal programme has to answer, and it
 * is unanswerable if the two facts are summed. So these rows carry
 * `detection = 'enabling'`, and every count that reports them alongside the
 * textual detectors reports them SEPARATELY. Flattening the two would produce a
 * confident, wrong consequence list, which is worse than a short one.
 *
 * ── WHY IT GOES IN `citation_edge` WHEN `legislation_edges` ALREADY HAS IT ───
 *
 * `legislation_edges` holds 230,681 `made-under` rows and **has no text column
 * at all**, so an enabling edge there can be asserted but never quoted. This
 * table requires `citation_text` and `raw_fragment` NOT NULL: an edge with no
 * quotable source is a claim, not a fact. GRAPH 4A §4 measured the gap and
 * priced closing it at about nine cents a month.
 *
 * ⚠ THE PARSER IS IMPORTED, NOT RESTATED. `parseEnabling` lives in
 * `extract-madeunder-edges.ts` and both writers call it. Two copies of one
 * parser is the shape that put the regnal-year trap in four code paths, and
 * `check-4b-layer2.ts` asserts this file contains no preamble regex of its own.
 *
 *   npx tsx graph/extract-enabling-edges.ts --pilot [N=1500]  — stats + projection, NO writes
 *   npx tsx graph/extract-enabling-edges.ts                   — full run (checkpointed)
 *   npx tsx graph/extract-enabling-edges.ts --reset           — drop the checkpoint first
 */
import fs from 'fs'
import path from 'path'
import { ZipReader, ZipEntryMeta } from './zip-reader'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { parseEnabling, EnablingHit } from './extract-madeunder-edges'
import { identitiesFor, loadIdentityBridge } from './identity'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
const CHECKPOINT = path.join(__dirname, 'enabling-edge-checkpoint.json')
const LEG_CORPORA = [
  'primary-acts-2000plus', 'primary-acts-pre-2000',
  'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu', 'eur-lex',
]

/** Same caps as the body-citation rows, for the same reason. */
const CITATION_TEXT_MAX = 300
const RAW_FRAGMENT_MAX = 600

/** ⚠ Every secondary-legislation type in the bulk file, not the five the July
 *  `made-under` run used. `nisi`, `uksro` and `nidsi` carry preambles too, and a
 *  narrower set here would look like "those instruments have no enabling power". */
const SI_TYPES = new Set(['uksi', 'ssi', 'nisr', 'wsi', 'nisro', 'uksro', 'nisi', 'nidsi'])

export const DETECTION = 'enabling' as const

type Stats = {
  docs: number; docErrors: number
  noPreamble: number; elided: number; noTarget: number
  hits: number; recitalFallback: number
  rows: number; written: number
  withProvision: number; resolvedRows: number
}
const stats: Stats = {
  docs: 0, docErrors: 0, noPreamble: 0, elided: 0, noTarget: 0,
  hits: 0, recitalFallback: 0, rows: 0, written: 0, withProvision: 0, resolvedRows: 0,
}

export type EnablingRow = {
  sourceDocUri: string; sourceProvisionRef: null
  targetUri: string; targetActId: string; targetProvisionRef: string | null
  citationText: string; rawFragment: string
  resolved: boolean; sourceGid: string
}

const uriFor = (gid: string) => `http://www.legislation.gov.uk/id/${gid}`

/** One SI's enabling hits → rows. `held` decides `resolved`. */
export function rowsFor(gid: string, hits: EnablingHit[], held: Set<string>): EnablingRow[] {
  const out: EnablingRow[] = []
  for (const h of hits) {
    // ⚠ `target_uri` is DERIVED here, exactly as it is for the text detector:
    // the preamble names the power in WORDS and the identity comes from the
    // footnote's own <Citation URI>, which parseEnabling has already resolved.
    // It must never be quoted back as if the enacting sentence contained it.
    const canonical = loadIdentityBridge().canonical(h.targetGid)
    const resolved = identitiesFor(h.targetGid).some(id => held.has(id))
    const text = (h.recitalFallback ? '[preamble-recital] ' : '') + h.citationText
    const base = {
      sourceDocUri: uriFor(gid), sourceProvisionRef: null as null,
      targetUri: uriFor(h.targetGid), targetActId: canonical,
      citationText: text.slice(0, CITATION_TEXT_MAX) || '(enacting words empty)',
      rawFragment: h.rawFragment.slice(0, RAW_FRAGMENT_MAX) || '(no fragment)',
      resolved, sourceGid: gid,
    }
    // ⚠ An act-level row is ALWAYS written, even when provisions are named. A
    // provision-only row would make "is this instrument made under that Act at
    // all?" unanswerable without knowing every provision in advance.
    out.push({ ...base, targetProvisionRef: null })
    for (const ref of h.refs) out.push({ ...base, targetProvisionRef: ref })
  }
  return out
}

async function loadHeld(): Promise<Set<string>> {
  const { rows } = await getNeonPool().query(
    `SELECT DISTINCT split_part(id, ':', 2) gid FROM corpus_sections
     WHERE corpus = ANY($1::text[]) AND status = 'compiled'`, [LEG_CORPORA])
  return new Set(rows.map((r: { gid: string }) => r.gid))
}

async function insert(rows: EnablingRow[], provenance: string): Promise<number> {
  if (rows.length === 0) return 0
  const pool = getNeonPool()
  let written = 0
  const BATCH = 500
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const values: unknown[] = []
    const tuples = batch.map((r, j) => {
      values.push(r.sourceDocUri, r.sourceProvisionRef, r.targetUri, r.targetActId,
                  r.targetProvisionRef, r.citationText, r.rawFragment, r.resolved,
                  'SI', r.sourceGid, DETECTION, provenance)
      const b = j * 12
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10},$${b + 11},$${b + 12})`
    })
    const res = await pool.query(
      `INSERT INTO ${CITATION_TABLE}
        (source_doc_uri, source_provision_ref, target_uri, target_act_id, target_provision_ref,
         citation_text, raw_fragment, resolved, source_type, source_gid, detection, extracted_from)
       VALUES ${tuples.join(',')}`, values)
    written += res.rowCount ?? 0
  }
  return written
}

function loadCheckpoint(): Set<string> {
  if (!fs.existsSync(CHECKPOINT)) return new Set()
  return new Set(JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8')).done as string[])
}

async function main() {
  const pilotIx = process.argv.indexOf('--pilot')
  const pilot = pilotIx >= 0
  const pilotN = pilot ? parseInt(process.argv[pilotIx + 1] ?? '1500', 10) || 1500 : 0
  if (process.argv.includes('--reset') && fs.existsSync(CHECKPOINT)) fs.unlinkSync(CHECKPOINT)
  const done = pilot ? new Set<string>() : loadCheckpoint()

  const bridge = loadIdentityBridge()
  if (bridge.stats.degraded) {
    console.error('[enabling] ⚠⚠ identity bridge DEGRADED — refusing to write rows whose target ids cannot be canonicalised')
    process.exit(2)
  }
  const held = await loadHeld()
  console.log(`[enabling] ${held.size.toLocaleString()} held instruments · ${bridge.stats.bridgedForms.toLocaleString()} bridged id forms`)

  const zipStat = fs.statSync(ZIP_PATH)
  const provenance = `best-collection-xml.zip@${zipStat.mtime.toISOString().slice(0, 10)}`
  const zip = new ZipReader(ZIP_PATH)
  const entries = zip.entries
    .map(e => ({ e, m: e.name.match(ENTRY_RX) }))
    .filter((x): x is { e: ZipEntryMeta; m: RegExpMatchArray } => x.m != null && SI_TYPES.has(x.m[1]))
  console.log(`[enabling] ${entries.length.toLocaleString()} secondary-legislation documents in scope${pilot ? ` (PILOT ${pilotN}, no writes)` : ''}`)

  // ⚠ A STRIDE, never "the first N": these ids sort chronologically and a
  // first-N pilot of this corpus is one year of it.
  const step = pilot ? Math.max(1, Math.floor(entries.length / pilotN)) : 1
  let buffer: EnablingRow[] = []
  const t0 = Date.now()
  let processed = 0

  for (let i = 0; i < entries.length; i += step) {
    const { e, m } = entries[i]
    const gid = gidFromEntry(m)
    if (done.has(gid)) continue
    try {
      const xml = zip.readText(e)
      stats.docs++
      const outcome = parseEnabling(gid, xml)
      if (outcome.kind === 'no-preamble') stats.noPreamble++
      else if (outcome.kind === 'elided') stats.elided++
      else if (outcome.kind === 'no-target') stats.noTarget++
      else {
        stats.hits += outcome.hits.length
        if (outcome.hits.some(h => h.recitalFallback)) stats.recitalFallback++
        const rows = rowsFor(gid, outcome.hits, held)
        stats.rows += rows.length
        stats.withProvision += rows.filter(r => r.targetProvisionRef !== null).length
        stats.resolvedRows += rows.filter(r => r.resolved).length
        if (!pilot) buffer.push(...rows)
      }
    } catch (err) {
      stats.docErrors++
      console.error(`  DOC ERROR ${gid}: ${(err as Error).message}`)
    }
    done.add(gid)
    processed++
    if (!pilot && buffer.length >= 5000) {
      stats.written += await insert(buffer, provenance)
      buffer = []
      fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done] }))
      console.log(`  ${processed.toLocaleString()} docs · ${stats.written.toLocaleString()} written · ${((Date.now() - t0) / 1000).toFixed(0)}s`)
    }
    if (pilot && processed >= pilotN) break
  }
  if (!pilot && buffer.length > 0) {
    stats.written += await insert(buffer, provenance)
    fs.writeFileSync(CHECKPOINT, JSON.stringify({ done: [...done] }))
  }
  zip.close()

  console.log(`\n[enabling] stats: ${JSON.stringify(stats, null, 1)}`)
  // ⚠ The accounting line. Every document must land in exactly one bucket, or
  // something was dropped silently — which is how a short list becomes a
  // confident one.
  const withHits = stats.docs - stats.noPreamble - stats.elided - stats.noTarget - stats.docErrors
  console.log(`[enabling] accounted: docs=${stats.docs} = withHits(${withHits}) + noPreamble(${stats.noPreamble}) + elided(${stats.elided}) + noTarget(${stats.noTarget}) + errors(${stats.docErrors})`)
  if (pilot) {
    const scale = entries.length / Math.max(1, stats.docs)
    console.log(`[enabling] PILOT PROJECTION over ${entries.length.toLocaleString()} documents:`)
    console.log(`  rows          ~${Math.round(stats.rows * scale).toLocaleString()}`)
    console.log(`  with provision ${(100 * stats.withProvision / Math.max(1, stats.rows)).toFixed(1)}%`)
    console.log(`  resolved       ${(100 * stats.resolvedRows / Math.max(1, stats.rows)).toFixed(1)}%`)
    const secs = (Date.now() - t0) / 1000
    console.log(`  time          ~${(secs * scale / 60).toFixed(1)} min  (pilot ${secs.toFixed(0)}s for ${stats.docs} docs)`)
  }
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[enabling] FATAL', e); process.exit(1) })
}
