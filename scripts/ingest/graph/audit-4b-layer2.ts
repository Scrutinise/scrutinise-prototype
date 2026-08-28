/**
 * audit-4b-layer2.ts — GRAPH 4B §2. What Layer 2 actually is, measured.
 *
 * Reads only. Four questions:
 *   1. Volume, storage and cost, against GRAPH 4A's estimate. Priced at the real
 *      $0.35/GB-month figure. ⚠ Storage is a bill, not a wall — the retired
 *      "17.5 GB alert line" is not repeated here and must not be.
 *   2. The enabling relationship reported SEPARATELY from textual reference,
 *      because an instrument that merely mentions an Act survives its repeal and
 *      one whose enabling power is repealed may fall with it.
 *   3. ⚠⚠ How much of the OLD `made-under` extraction's section-level output was
 *      wrong, by re-running both parsers over the same documents. The two
 *      defects fixed in `refListBefore` on 2026-08-28 are already in the
 *      230,681 rows `legislation_edges` holds.
 *   4. The scale control the brief asks for: a narrow recent instrument must not
 *      outrank a broad old one.
 *
 *   npx tsx graph/audit-4b-layer2.ts [--json <path>] [--sample N]
 */
import fs from 'fs'
import path from 'path'
import { Pool } from 'pg'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { ZipReader } from './zip-reader'
import { ENTRY_RX, gidFromEntry } from './audit-25h-citations'
import { parseEnabling, refListDetail } from './extract-madeunder-edges'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { EDGE_TABLE } from './graph-common'

const ZIP_PATH = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-bulk/best-collection-xml.zip'
const SI_TYPES = new Set(['uksi', 'ssi', 'nisr', 'wsi', 'nisro', 'uksro', 'nisi', 'nidsi'])
/** $/GB-month. The real figure, not a threshold. */
const GB_MONTH = 0.35

function slowPool(): Pool {
  return new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }, max: 1,
    statement_timeout: 900_000, query_timeout: 900_000,
  })
}

/** ⚠ The OLD parser, reproduced here EXACTLY as it stood before 2026-08-28, and
 *  used for one purpose only: measuring how much of what it wrote was wrong.
 *  It is never called by anything that writes a row. */
function refListBefore_beforeTheFix(plainBefore: string): { refs: string[]; listText: string | null } {
  const tail = plainBefore.slice(-220)
  const m = tail.match(/\b(section|sections|article|articles|regulation|regulations|paragraph|paragraphs)\s+([0-9][0-9A-Za-z()]*(?:\s*(?:,|and|to)\s*[0-9][0-9A-Za-z()]*)*)\s+of[^.]{0,120}$/i)
  if (!m) return { refs: [], listText: null }
  const kw = m[1].toLowerCase().replace(/s$/, '')
  if (kw === 'paragraph') return { refs: [], listText: m[2] }
  const nums = m[2].match(/\d+[A-Z]*/gi) ?? []
  return { refs: [...new Set(nums.map(n => `${kw}-${n.toUpperCase()}`))], listText: m[2] }
}

export type Layer2Audit = {
  measuredAt: string
  volume: {
    enablingRows: number; enablingInstruments: number; enablingTargets: number
    actLevelRows: number; provisionRows: number; provisionPct: number
    resolvedRows: number; resolvedPct: number; recitalRows: number
    madeUnderRowsInEdges: number; instrumentsInEdges: number
  }
  storage: {
    tableBytes: number; totalRows: number; bytesPerRow: number
    enablingBytes: number; enablingGb: number; monthlyUsd: number
    fourAEstimateGb: number; fourAEstimateUsd: number
  }
  separation: {
    byDetection: Array<{ detection: string; rows: number; sourceDocs: number }>
    /** an Act with BOTH kinds pointing at it, to show they are not the same set */
    worked: Array<{ target: string; mentions: number; enabling: number }>
  }
  parserDefect: {
    sampled: number; docsWithRefs: number
    refsOld: number; refsNew: number
    droppedSubsectionArtefacts: number
    reattributedToADifferentAct: number
    pctOfOldSectionRefsWrong: number
  }
  scaleControl: {
    narrow: { gid: string; title: string | null; inbound: number }
    broad: { gid: string; title: string | null; inbound: number }
    passes: boolean
  }
}

async function main() {
  const pool = slowPool()
  const sampleIx = process.argv.indexOf('--sample')
  const sampleN = sampleIx >= 0 ? parseInt(process.argv[sampleIx + 1] ?? '1500', 10) : 1500

  // ── 1: volume ───────────────────────────────────────────────────────────────
  const { rows: v } = await pool.query(`
    SELECT COUNT(*)::bigint rows,
           COUNT(DISTINCT source_gid)::bigint instruments,
           COUNT(DISTINCT target_act_id)::bigint targets,
           COUNT(*) FILTER (WHERE target_provision_ref IS NULL)::bigint act_level,
           COUNT(*) FILTER (WHERE target_provision_ref IS NOT NULL)::bigint provision,
           COUNT(*) FILTER (WHERE resolved)::bigint resolved,
           COUNT(*) FILTER (WHERE citation_text LIKE '[preamble-recital]%')::bigint recital
    FROM ${CITATION_TABLE} WHERE detection = 'enabling'`)
  const { rows: me } = await pool.query(`
    SELECT COUNT(*)::bigint rows, COUNT(DISTINCT split_part(from_id, ':', 2))::bigint instruments
    FROM ${EDGE_TABLE} WHERE edge_type = 'made-under'`)
  const enablingRows = Number(v[0].rows)

  // ── 2: storage, at the real price ───────────────────────────────────────────
  const { rows: sz } = await pool.query(`
    SELECT pg_total_relation_size('${CITATION_TABLE}')::bigint bytes,
           (SELECT COUNT(*) FROM ${CITATION_TABLE})::bigint total`)
  const tableBytes = Number(sz[0].bytes)
  const totalRows = Number(sz[0].total)
  const bytesPerRow = tableBytes / totalRows
  const enablingBytes = bytesPerRow * enablingRows

  // ── 3: the enabling fact reported apart from the textual one ────────────────
  const { rows: byDetection } = await pool.query(`
    SELECT detection, COUNT(*)::bigint rows, COUNT(DISTINCT source_gid)::bigint docs
    FROM ${CITATION_TABLE} GROUP BY 1 ORDER BY rows DESC`)
  const { rows: worked } = await pool.query(`
    SELECT target_act_id target,
           COUNT(*) FILTER (WHERE detection IN ('markup','text'))::bigint mentions,
           COUNT(*) FILTER (WHERE detection = 'enabling')::bigint enabling
    FROM ${CITATION_TABLE} WHERE target_act_id IS NOT NULL
    GROUP BY 1 HAVING COUNT(*) FILTER (WHERE detection = 'enabling') > 0
    ORDER BY enabling DESC LIMIT 8`)

  // ── 4: how wrong the old section refs were ──────────────────────────────────
  let sampled = 0, docsWithRefs = 0, refsOld = 0, refsNew = 0, dropped = 0, reattributed = 0
  const zip = new ZipReader(ZIP_PATH)
  const entries = zip.entries
    .map(e => ({ e, m: e.name.match(ENTRY_RX) }))
    .filter((x): x is { e: typeof zip.entries[0]; m: RegExpMatchArray } => x.m != null && SI_TYPES.has(x.m[1]))
  const step = Math.max(1, Math.floor(entries.length / sampleN))
  for (let i = 0; i < entries.length && sampled < sampleN; i += step) {
    const gid = gidFromEntry(entries[i].m)
    const xml = zip.readText(entries[i].e)
    sampled++
    const o = parseEnabling(gid, xml)
    if (o.kind !== 'hits') continue
    // ⚠ Both parsers get IDENTICAL bytes — `beforeWindow` is the exact input
    // `refListBefore` was handed, not the truncated quote. Feeding one of them
    // the shortened `citationText` would have measured the truncation.
    for (const h of o.hits) {
      const oldR = refListBefore_beforeTheFix(h.beforeWindow)
      const newR = refListDetail(h.beforeWindow)
      if (oldR.refs.length === 0 && newR.refs.length === 0) continue
      docsWithRefs++
      refsOld += oldR.refs.length
      refsNew += newR.refs.length
      // ⚠ Same phrase, fewer numbers = a subsection was being read as a section.
      //   Different phrase entirely = the list belonged to a different Act.
      const samePhrase = oldR.listText === newR.listText
      for (const r of oldR.refs) {
        if (newR.refs.includes(r)) continue
        if (samePhrase) dropped++
        else reattributed++
      }
    }
  }
  zip.close()

  // ── 5: the scale control ────────────────────────────────────────────────────
  // A narrow recent instrument vs a broad old Act. Read from the data, not
  // hand-picked: the enabling Act with the MOST inbound enabling rows (broad)
  // and one made under it (narrow).
  const { rows: broadRow } = await pool.query(`
    SELECT target_act_id gid, COUNT(*)::bigint n FROM ${CITATION_TABLE}
    WHERE detection = 'enabling' AND target_act_id IS NOT NULL
    GROUP BY 1 ORDER BY n DESC LIMIT 1`)
  const broadGid = broadRow[0].gid as string
  const { rows: narrowRow } = await pool.query(`
    SELECT source_gid gid FROM ${CITATION_TABLE}
    WHERE detection = 'enabling' AND target_act_id = $1
    ORDER BY source_gid DESC LIMIT 1`, [broadGid])
  const narrowGid = narrowRow[0].gid as string
  const inboundOf = async (gid: string) => Number((await pool.query(
    `SELECT COUNT(*)::bigint n FROM ${CITATION_TABLE} WHERE target_act_id = $1`, [gid])).rows[0].n)
  const { rows: titles } = await pool.query(
    `SELECT gid, title FROM corpus_acts WHERE gid = ANY($1::text[])`, [[broadGid, narrowGid]])
  const titleOf = (g: string) => titles.find((t: { gid: string }) => t.gid === g)?.title ?? null
  const broadInbound = await inboundOf(broadGid)
  const narrowInbound = await inboundOf(narrowGid)

  const out: Layer2Audit = {
    measuredAt: new Date().toISOString(),
    volume: {
      enablingRows,
      enablingInstruments: Number(v[0].instruments),
      enablingTargets: Number(v[0].targets),
      actLevelRows: Number(v[0].act_level),
      provisionRows: Number(v[0].provision),
      provisionPct: 100 * Number(v[0].provision) / enablingRows,
      resolvedRows: Number(v[0].resolved),
      resolvedPct: 100 * Number(v[0].resolved) / enablingRows,
      recitalRows: Number(v[0].recital),
      madeUnderRowsInEdges: Number(me[0].rows),
      instrumentsInEdges: Number(me[0].instruments),
    },
    storage: {
      tableBytes, totalRows, bytesPerRow,
      enablingBytes, enablingGb: enablingBytes / 1e9,
      monthlyUsd: (enablingBytes / 1e9) * GB_MONTH,
      fourAEstimateGb: 0.27, fourAEstimateUsd: 0.27 * GB_MONTH,
    },
    separation: {
      byDetection: byDetection.map((r: Record<string, string>) => ({
        detection: r.detection, rows: Number(r.rows), sourceDocs: Number(r.docs),
      })),
      worked: worked.map((r: Record<string, string>) => ({
        target: r.target, mentions: Number(r.mentions), enabling: Number(r.enabling),
      })),
    },
    parserDefect: {
      sampled, docsWithRefs, refsOld, refsNew,
      droppedSubsectionArtefacts: dropped,
      reattributedToADifferentAct: reattributed,
      pctOfOldSectionRefsWrong: refsOld === 0 ? 0 : 100 * (dropped + reattributed) / refsOld,
    },
    scaleControl: {
      narrow: { gid: narrowGid, title: titleOf(narrowGid), inbound: narrowInbound },
      broad: { gid: broadGid, title: titleOf(broadGid), inbound: broadInbound },
      passes: broadInbound > narrowInbound,
    },
  }

  console.log('\n══ §2.3 VOLUME ══')
  console.log(`  enabling rows            ${out.volume.enablingRows.toLocaleString()}`)
  console.log(`  instruments covered      ${out.volume.enablingInstruments.toLocaleString()}  (legislation_edges made-under: ${out.volume.instrumentsInEdges.toLocaleString()})`)
  console.log(`  distinct enabling Acts   ${out.volume.enablingTargets.toLocaleString()}`)
  console.log(`  act-level / provision    ${out.volume.actLevelRows.toLocaleString()} / ${out.volume.provisionRows.toLocaleString()} (${out.volume.provisionPct.toFixed(1)}% name a provision)`)
  console.log(`  resolved targets         ${out.volume.resolvedRows.toLocaleString()} (${out.volume.resolvedPct.toFixed(1)}%)`)
  console.log(`  ⚠ from the recitals, not the enacting words: ${out.volume.recitalRows.toLocaleString()} — lower precision, and it says so on the row`)
  console.log(`  legislation_edges made-under rows: ${out.volume.madeUnderRowsInEdges.toLocaleString()} (no evidence column)`)

  console.log('\n══ §2.3 STORAGE, AT $0.35/GB-MONTH — THE REAL FIGURE, NOT A THRESHOLD ══')
  console.log(`  ${CITATION_TABLE}: ${(tableBytes / 1e9).toFixed(2)} GB over ${totalRows.toLocaleString()} rows = ${bytesPerRow.toFixed(0)} bytes/row`)
  console.log(`  Layer 2's share: ${out.storage.enablingGb.toFixed(3)} GB → $${out.storage.monthlyUsd.toFixed(2)}/month`)
  console.log(`  GRAPH 4A estimated ${out.storage.fourAEstimateGb} GB → $${out.storage.fourAEstimateUsd.toFixed(2)}/month`)

  console.log('\n══ §2.1 THE ENABLING FACT, KEPT APART FROM THE TEXTUAL ONE ══')
  for (const d of out.separation.byDetection) console.log(`  ${d.detection.padEnd(10)} ${d.rows.toLocaleString().padStart(10)} rows from ${d.sourceDocs.toLocaleString()} documents`)
  console.log('  ⚠ the two are DIFFERENT SETS, not two names for one:')
  for (const w of out.separation.worked) console.log(`    ${w.target.padEnd(20)} mentions ${String(w.mentions).padStart(6)} · made-under ${String(w.enabling).padStart(6)}`)

  console.log('\n══ ⚠⚠ HOW WRONG THE OLD SECTION REFS WERE ══')
  console.log(`  ${sampled.toLocaleString()} documents sampled · ${docsWithRefs.toLocaleString()} enabling hits carrying a ref list`)
  console.log(`  section refs: old parser ${refsOld.toLocaleString()} → fixed parser ${refsNew.toLocaleString()}`)
  console.log(`  dropped as subsection artefacts: ${dropped.toLocaleString()} · re-attributed away from the wrong Act: ${reattributed.toLocaleString()}`)
  console.log(`  ⚠ ${out.parserDefect.pctOfOldSectionRefsWrong.toFixed(1)}% of the old parser's section refs were wrong — and legislation_edges still holds them`)

  console.log('\n══ §2.3 THE SCALE CONTROL ══')
  console.log(`  broad old  ${out.scaleControl.broad.gid} — ${out.scaleControl.broad.title ?? '(no title held)'} → ${out.scaleControl.broad.inbound.toLocaleString()} inbound`)
  console.log(`  narrow new ${out.scaleControl.narrow.gid} — ${out.scaleControl.narrow.title ?? '(no title held)'} → ${out.scaleControl.narrow.inbound.toLocaleString()} inbound`)
  console.log(`  ${out.scaleControl.passes ? 'PASSES' : '⚠ FAILS'} — the narrow recent instrument does not outrank the broad old one`)

  const jsonIx = process.argv.indexOf('--json')
  if (jsonIx >= 0 && process.argv[jsonIx + 1]) {
    fs.writeFileSync(process.argv[jsonIx + 1], JSON.stringify(out, null, 1))
    console.log(`\n[audit-4b-layer2] wrote ${process.argv[jsonIx + 1]}`)
  }
  await pool.end()
}

if (require.main === module) {
  main().catch(e => { console.error('[audit-4b-layer2] FATAL', e); process.exit(1) })
}
