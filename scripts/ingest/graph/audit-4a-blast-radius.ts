/**
 * audit-4a-blast-radius.ts — GRAPH 4A §1 (T1).
 *
 * OI-15: `extract-cites-edges.ts`'s zip-entry filter requires a CALENDAR year in
 * the filename, so every pre-1963 Act — cited by regnal session, e.g.
 * `ukpga-Geo3-41-52-revised-data.xml` — was never opened. The brief's question
 * is NOT "is the regex wrong" (it is, and 25-H proved it). It is:
 *
 *   ⚠ **A FIX WAS APPLIED TO ONE OF TWO PLACES THAT MUST AGREE, WITH NO CHECK
 *   THAT THEY AGREE. What else did we get wrong the same way?**
 *
 * So this measures, rather than reads:
 *   A. every zip entry, by doctype, matched by the SHIPPED filter vs the widened
 *      one — and BOTH WAYS, because a "widening" that tightens the suffix group
 *      from `\w+` to `[a-z-]+` could quietly drop entries the old one caught;
 *   B. the same filter in `extract-madeunder-edges.ts`, which is the second copy
 *      — restricted to SI types, so the question is whether any SI-type entry
 *      carries a regnal filename;
 *   C. the DB consequence per (edge_type, source): the regnal share on BOTH ends
 *      of the edge. An extractor that never opened a document cannot produce an
 *      edge FROM it; one that reads a CSV or an amendments feed can, which is
 *      exactly the contrast that proves the defect by consequence;
 *   D. what each downstream consumer would see. Consumers are enumerated by
 *      hand in CONSUMERS below from a repo-wide grep, and each one's exposure is
 *      MEASURED here rather than argued.
 *
 * Reads only. Writes nothing to the database.
 *
 *   npx tsx graph/audit-4a-blast-radius.ts [--json out.json]
 */
import fs from 'fs'
import path from 'path'
import { ZipReader } from './zip-reader'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'

/** The filter as shipped in extract-cites-edges.ts:120 and
 *  extract-madeunder-edges.ts:125 — byte-identical in both. */
const SHIPPED_RX = /\/([a-z]+)-(\d{4})-(\d+)-\w+-data\.xml$/
/** extract-madeunder-edges.ts:34 */
const SI_TYPES = new Set(['uksi', 'ssi', 'nisr', 'wsi', 'nisro'])

/** Every reader of `legislation_edges` in the repository, from
 *  `grep -rn "legislation_edges\|EDGE_TABLE"` over scripts/ and scrutinise-web/.
 *  `edgeTypes` is what the consumer actually SELECTs. */
const CONSUMERS = [
  { file: 'scripts/ingest/graph/traverse-edges.ts', what: 'impactSet() — the rescission-impact traversal, depth 2', edgeTypes: ['cites', 'made-under', 'amends', 'repeals', 'commences', 'modifies'] },
  { file: 'scripts/ingest/graph/edges-query-service.ts', what: 'HTTP service over impactSet() on :8091', edgeTypes: ['cites', 'made-under', 'amends', 'repeals', 'commences', 'modifies'] },
  { file: 'scripts/ingest/graph/score-gold-d.ts', what: 'scores the gold-D question set through impactSet()', edgeTypes: ['cites', 'made-under', 'amends', 'repeals', 'commences', 'modifies'] },
  { file: 'scripts/ingest/v37-citation-gaps.ts', what: 'the corpus citation-gap census → CORPUS_CITATION_GAPS.md', edgeTypes: ['*'] },
  { file: 'scripts/ingest/v37-repeal-census.ts', what: 'section_repeals — repealing instrument per dead provision', edgeTypes: ['repeals'] },
  { file: 'scripts/ingest/c2/l2-recensus-eu.ts', what: 'retained-EU re-census of section_repeals', edgeTypes: ['repeals'] },
]

type Out = Record<string, unknown>

async function main() {
  const out: Out = { at: new Date().toISOString() }

  // ── A + B: the zip, both regexes, both directions ─────────────────────────
  console.log(`[4a-T1] opening ${ZIP_PATH}…`)
  const zip = new ZipReader(ZIP_PATH)
  const dataEntries = zip.entries.filter(e => /-data\.xml$/.test(e.name))
  type Row = { type: string; widened: number; shipped: number; missed: number; siType: boolean }
  const byType = new Map<string, Row>()
  let widenedTotal = 0, shippedTotal = 0
  const shippedOnly: string[] = []   // matched by SHIPPED and NOT by ENTRY_RX
  const missedSample: string[] = []

  for (const e of dataEntries) {
    const w = e.name.match(ENTRY_RX)
    const s = SHIPPED_RX.test(e.name)
    if (w) {
      widenedTotal++
      const t = w[1]
      const r = byType.get(t) ?? { type: t, widened: 0, shipped: 0, missed: 0, siType: SI_TYPES.has(t) }
      r.widened++
      if (s) r.shipped++
      else { r.missed++; if (missedSample.length < 8) missedSample.push(`${e.name} → ${gidFromEntry(w)}`) }
      byType.set(t, r)
    }
    if (s) {
      shippedTotal++
      if (!w && shippedOnly.length < 20) shippedOnly.push(e.name)
    }
  }
  zip.close()

  const rows = [...byType.values()].sort((a, b) => b.missed - a.missed || b.widened - a.widened)
  const missedTotal = widenedTotal - rows.reduce((n, r) => n + r.shipped, 0)
  const siMissed = rows.filter(r => r.siType).reduce((n, r) => n + r.missed, 0)

  console.log(`\n── A. ZIP ENTRY CENSUS (${dataEntries.length.toLocaleString()} *-data.xml entries) ──`)
  console.log(`  widened ENTRY_RX matches : ${widenedTotal.toLocaleString()}`)
  console.log(`  shipped filter matches   : ${shippedTotal.toLocaleString()}`)
  console.log(`  SKIPPED by the shipped filter: ${missedTotal.toLocaleString()}`)
  console.log(`\n  type      widened   shipped   SKIPPED   (SI type?)`)
  for (const r of rows.filter(r => r.missed > 0 || r.widened > 2000)) {
    console.log(`  ${r.type.padEnd(8)} ${String(r.widened).padStart(8)} ${String(r.shipped).padStart(9)} ${String(r.missed).padStart(9)}   ${r.siType ? 'YES' : ''}`)
  }
  console.log(`\n  ⚠ entries matched by the SHIPPED regex but NOT by the widened one: ${shippedOnly.length === 0 ? '0 — the widening is strict' : shippedOnly.length + ' ← NOT A STRICT WIDENING'}`)
  for (const n of shippedOnly) console.log(`      ${n}`)
  console.log(`\n── B. THE SECOND COPY (extract-madeunder-edges.ts, SI types only) ──`)
  console.log(`  SI-type entries the shipped filter skips: ${siMissed}`)
  console.log(`  → the same defective regex is present, and ${siMissed === 0 ? 'costs nothing, because SI filenames are calendar-year' : 'DOES bite'}`)
  console.log(`\n  sample of skipped entries:`)
  for (const s of missedSample) console.log(`      ${s}`)

  out.zip = {
    dataEntries: dataEntries.length, widenedTotal, shippedTotal, missedTotal, siMissed,
    shippedNotWidened: shippedOnly, byType: rows, missedSample,
  }

  // ── C: the DB consequence, per producer ───────────────────────────────────
  const pool = getNeonPool()
  console.log(`\n── C. THE CONSEQUENCE IN legislation_edges ──`)
  const { rows: cons } = await pool.query(`
    SELECT edge_type, source, COUNT(*)::bigint AS n,
           COUNT(*) FILTER (WHERE split_part(from_id, ':', 2) ~ '^[a-z]+/[A-Za-z]')::bigint AS regnal_from,
           COUNT(*) FILTER (WHERE split_part(to_id,   ':', 2) ~ '^[a-z]+/[A-Za-z]')::bigint AS regnal_to
    FROM legislation_edges GROUP BY 1, 2 ORDER BY n DESC`)
  console.log(`  edge_type    source                    rows        regnal FROM   regnal TO`)
  for (const r of cons) {
    console.log(`  ${String(r.edge_type).padEnd(12)} ${String(r.source).padEnd(24)} ${String(r.n).padStart(9)} ${String(r.regnal_from).padStart(13)} ${String(r.regnal_to).padStart(11)}`)
  }
  console.log(`\n  ⚠ read the regnal FROM column: an extractor that never OPENED a document cannot`)
  console.log(`    emit an edge from it. The two rows produced by the defective filter must read 0;`)
  console.log(`    a row produced from a CSV or an amendments feed need not.`)
  out.legislationEdges = cons

  // the control: 25-H's citation_edge used the widened regex on the same zip
  const { rows: ce } = await pool.query(`
    SELECT detection, COUNT(*)::bigint AS n,
           COUNT(*) FILTER (WHERE source_gid ~ '^[a-z]+/[A-Za-z]')::bigint AS regnal_src,
           COUNT(DISTINCT source_gid) FILTER (WHERE source_gid ~ '^[a-z]+/[A-Za-z]')::bigint AS regnal_docs
    FROM citation_edge GROUP BY 1 ORDER BY n DESC`)
  console.log(`\n  CONTROL — citation_edge, built with the widened regex over the same file:`)
  for (const r of ce) console.log(`    ${String(r.detection).padEnd(8)} ${String(r.n).padStart(9)} rows, ${r.regnal_src} from regnal sources (${r.regnal_docs} documents)`)
  out.citationEdge = ce

  // ── D: per-consumer exposure ──────────────────────────────────────────────
  console.log(`\n── D. PER-CONSUMER EXPOSURE ──`)
  const consumerOut: Out[] = []
  for (const c of CONSUMERS) {
    const affectedTypes = c.edgeTypes.includes('*') ? ['cites', 'made-under'] : c.edgeTypes.filter(t => t === 'cites' || t === 'made-under')
    let n = 0
    if (affectedTypes.length > 0) {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::bigint AS n FROM legislation_edges WHERE edge_type = ANY($1::text[])`, [affectedTypes])
      n = Number(rows[0].n)
    }
    const affected = affectedTypes.length > 0
    console.log(`  ${affected ? 'AFFECTED' : '   clear'}  ${c.file}`)
    console.log(`            ${c.what}`)
    console.log(`            reads: ${c.edgeTypes.join(', ')}${affected ? `  → ${n.toLocaleString()} rows built by the defective filter` : '  → nothing built by the defective filter'}`)
    consumerOut.push({ ...c, affected, rowsFromDefectiveFilter: n })
  }
  out.consumers = consumerOut

  // Does anything a USER touches read this graph? Measured as a file-tree fact.
  const webRoot = 'C:/Code/scrutinise-prototype/scrutinise-web'
  const hits: string[] = []
  const walk = (d: string) => {
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.name === 'node_modules' || f.name === '.next' || f.name.startsWith('.')) continue
      const p = path.join(d, f.name)
      if (f.isDirectory()) walk(p)
      else if (/\.tsx?$/.test(f.name) && /legislation_edges|citation_edge|traverse-edges|impactSet/.test(fs.readFileSync(p, 'utf8'))) hits.push(p)
    }
  }
  walk(webRoot)
  console.log(`\n  ⚠ files under scrutinise-web/ referring to either graph table: ${hits.length}`)
  for (const h of hits) console.log(`      ${h}`)
  console.log(`  → ${hits.length === 0 ? 'NO user-facing surface reads the graph. The blast radius is internal.' : 'A USER-FACING SURFACE READS THE GRAPH.'}`)
  out.webConsumers = hits

  // ── the gap census, the one published artefact built on `cites` ────────────
  const { rows: gaps } = await pool.query(`
    WITH t AS (
      SELECT split_part(to_id, ':', 2) AS gid,
             count(*) FILTER (WHERE edge_type IN ('cites','made-under'))::int AS ours,
             count(*) FILTER (WHERE edge_type NOT IN ('cites','made-under'))::int AS external
      FROM legislation_edges GROUP BY 1)
    SELECT COUNT(*)::int AS instruments,
           COUNT(*) FILTER (WHERE ours > 0 AND external = 0)::int AS only_from_ours,
           COUNT(*) FILTER (WHERE ours = 0)::int AS none_from_ours
    FROM t WHERE gid <> '' AND gid LIKE '%/%'`)
  console.log(`\n  v37-citation-gaps denominator: ${gaps[0].instruments.toLocaleString()} distinct instruments referred to;`)
  console.log(`    ${gaps[0].only_from_ours.toLocaleString()} of them are known ONLY through cites/made-under —`)
  console.log(`    those are the rows whose counts the hole can move, and new ones it could add.`)
  out.gapCensus = gaps[0]

  const jsonIx = process.argv.indexOf('--json')
  if (jsonIx >= 0 && process.argv[jsonIx + 1]) {
    fs.writeFileSync(process.argv[jsonIx + 1], JSON.stringify(out, null, 1))
    console.log(`\n[4a-T1] → ${process.argv[jsonIx + 1]}`)
  }
  await endNeonPool()
}

if (require.main === module) {
  main().catch(e => { console.error('[4a-T1] FATAL', e); process.exit(1) })
}
