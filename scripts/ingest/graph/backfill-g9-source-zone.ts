/**
 * backfill-g9-source-zone.ts — GRAPH 9 §4: tag every stored markup/text row with WHERE its reference sits.
 *
 * Re-runs the extractor's OWN two detectors (`extractDoc`, `extractDocText` — imported, not restated) over the bulk
 * file on disk, so each re-produced row carries `sourceZone`, and matches stored rows to them by their own key:
 * (source_gid, detection, target_uri, source_provision_ref, target_provision_ref, citation_text).
 *
 * ⚠ NOTHING IS GUESSED. A stored row the file on disk does not re-produce (a document absent from the 14 May file, a
 * window that differs, a title map that has moved) stays NULL and is counted. A key re-produced in two zones is
 * counted as ambiguous and left NULL. The proportion reported is over rows WITH a zone, and the NULLs are stated.
 *
 *   npx tsx graph/backfill-g9-source-zone.ts --dry-run [--limit N]   — match and count, no writes
 *   npx tsx graph/backfill-g9-source-zone.ts                         — write source_zone
 */
import fs from 'fs'
import path from 'path'
import { ZipReader, ZipEntryMeta } from './zip-reader'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { loadIdentityBridge } from './identity'
import { extractDoc, extractDocText, loadActTitles, type SourceZone } from './extract-citation-edges'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
const OUT = path.join(__dirname, 'backfill-g9-source-zone.json')
const LEG_CORPORA = ['primary-acts-2000plus', 'primary-acts-pre-2000', 'si-2010plus', 'si-pre-2010', 'regional', 'retained-eu', 'eur-lex']
const BATCH_DOCS = 300

const keyOf = (g: string, d: string, tu: string, sp: string | null, tp: string | null, ct: string) =>
  `${g}\u0001${d}\u0001${tu}\u0001${sp ?? ''}\u0001${tp ?? ''}\u0001${ct}`

async function main() {
  const dry = process.argv.includes('--dry-run')
  const li = process.argv.indexOf('--limit')
  const limit = li >= 0 ? parseInt(process.argv[li + 1], 10) : Infinity
  const pool = getNeonPool()

  // The extractor's inputs, built the extractor's way — so a re-produced row is the row it would write.
  const { rows: heldRows } = await pool.query(
    `SELECT DISTINCT split_part(id, ':', 2) AS gid FROM corpus_sections WHERE corpus = ANY($1::text[]) AND status = 'compiled'`, [LEG_CORPORA])
  const held = new Set<string>(heldRows.map((r: { gid: string }) => r.gid))
  loadIdentityBridge()
  const titles = await loadActTitles()

  const { rows: gidRows } = await pool.query(`SELECT DISTINCT source_gid FROM citation_edge WHERE detection IN ('markup', 'text')`)
  const storedGids = new Set<string>(gidRows.map((r: { source_gid: string }) => r.source_gid))
  console.log(`[source-zone] ${storedGids.size.toLocaleString()} documents hold markup/text rows${dry ? ' (DRY RUN)' : ''}`)

  const zip = new ZipReader(ZIP_PATH)
  const entries = zip.entries.map((e) => ({ e, m: e.name.match(ENTRY_RX) }))
    .filter((x): x is { e: ZipEntryMeta; m: RegExpMatchArray } => x.m != null)

  const t = { docsWalked: 0, docsWithRows: 0, stored: 0, matched: 0, unmatched: 0, ambiguous: 0, written: 0,
    byZone: { body: 0, 'explanatory-note': 0, 'earlier-orders-note': 0 } as Record<SourceZone, number>,
    byDetectionZone: {} as Record<string, number>, unmatchedSamples: [] as string[] }
  const walked = new Set<string>()
  let batch: Array<{ gid: string; zones: Map<string, SourceZone | 'ambiguous'> }> = []
  const t0 = Date.now()

  const flush = async () => {
    if (!batch.length) return
    const gids = batch.map((b) => b.gid)
    const byGid = new Map(batch.map((b) => [b.gid, b.zones]))
    const { rows } = await pool.query(
      `SELECT id, source_gid, detection, target_uri, source_provision_ref, target_provision_ref, citation_text
         FROM citation_edge WHERE source_gid = ANY($1::text[]) AND detection IN ('markup', 'text')`, [gids])
    const ids: string[] = [], zs: string[] = []
    for (const r of rows) {
      t.stored++
      const z = byGid.get(r.source_gid)!.get(keyOf(r.source_gid, r.detection, r.target_uri, r.source_provision_ref, r.target_provision_ref, r.citation_text))
      if (!z) { t.unmatched++; if (t.unmatchedSamples.length < 10) t.unmatchedSamples.push(`${r.source_gid} ${r.detection} ${String(r.citation_text).slice(-80)}`); continue }
      if (z === 'ambiguous') { t.ambiguous++; continue }
      t.matched++; t.byZone[z]++
      t.byDetectionZone[`${r.detection}:${z}`] = (t.byDetectionZone[`${r.detection}:${z}`] ?? 0) + 1
      ids.push(String(r.id)); zs.push(z)
    }
    if (!dry && ids.length) {
      const res = await pool.query(
        `UPDATE citation_edge c SET source_zone = v.z FROM (SELECT unnest($1::bigint[]) id, unnest($2::text[]) z) v WHERE c.id = v.id`, [ids, zs])
      t.written += res.rowCount ?? 0
    }
    batch = []
  }

  for (const { e, m } of entries) {
    if (t.docsWithRows >= limit) break
    const gid = gidFromEntry(m)
    t.docsWalked++
    if (!storedGids.has(gid) || walked.has(gid)) continue
    walked.add(gid)
    t.docsWithRows++
    let xml: string
    try { xml = zip.readText(e) } catch { continue }
    const zones = new Map<string, SourceZone | 'ambiguous'>()
    for (const r of [...extractDoc(gid, xml, held), ...extractDocText(gid, xml, titles, held)]) {
      const k = keyOf(r.sourceGid, r.detection, r.targetUri, r.sourceProvisionRef, r.targetProvisionRef, r.citationText)
      const had = zones.get(k)
      zones.set(k, had && had !== r.sourceZone ? 'ambiguous' : r.sourceZone)
    }
    batch.push({ gid, zones })
    if (batch.length >= BATCH_DOCS) {
      await flush()
      console.log(`  ${t.docsWithRows.toLocaleString()} docs · ${t.matched.toLocaleString()} matched · ${t.unmatched.toLocaleString()} unmatched · ${((Date.now() - t0) / 1000).toFixed(0)}s`)
    }
  }
  await flush()
  zip.close()

  const notInFile = [...storedGids].filter((g) => !walked.has(g))
  const { rows: missing } = notInFile.length
    ? await pool.query(`SELECT COUNT(*)::int n FROM citation_edge WHERE source_gid = ANY($1::text[]) AND detection IN ('markup', 'text')`, [notInFile])
    : { rows: [{ n: 0 }] }
  const notes = t.byZone['explanatory-note'] + t.byZone['earlier-orders-note']
  const result = {
    measured_at: new Date().toISOString(), dry_run: dry,
    zip: `${ZIP_PATH} (mtime ${fs.statSync(ZIP_PATH).mtime.toISOString().slice(0, 10)})`,
    documents: { with_stored_rows: storedGids.size, walked_from_file: t.docsWithRows, not_in_file: notInFile.length, rows_of_docs_not_in_file: missing[0].n },
    rows: { stored_in_walked_docs: t.stored, matched: t.matched, unmatched: t.unmatched, ambiguous: t.ambiguous, written: t.written },
    by_zone: t.byZone, by_detection_zone: t.byDetectionZone,
    note_share: {
      numerator: notes, denominator: t.matched,
      pct: Math.round((10000 * notes) / Math.max(t.matched, 1)) / 100,
      reading: 'note-sourced rows as a share of stored markup+text rows whose zone was determined; rows not determined are stated above, never assumed body',
    },
    unmatched_samples: t.unmatchedSamples,
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
  await endNeonPool()
}
main().catch((e) => { console.error('[source-zone] FATAL', e); process.exit(1) })
