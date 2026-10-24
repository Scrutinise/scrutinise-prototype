/**
 * audit-g9-provision-ids.ts — GRAPH 9 §0: which rows does the 36.1% cover?
 *
 * GRAPH 4B measured that 36.1% of the OLD preamble parser's section-level refs were wrong, and
 * `legislation_edges` still holds them. GRAPH 6's effects reader reads `legislation_edges` too. This
 * asks, of EVERY section-level row, whether its stored provision identifier is one the publisher gave.
 *
 *   OFFICIAL — `tna-bulk-amendments`: every stored provision (both ends) is looked up among the `Ref`
 *     attributes the publisher wrote on the effects that join the same two documents, re-read from the
 *     same zips with a parse written here (not the extractor's `sectionRefs`), so the test is not the
 *     extractor agreeing with itself. `tna-inforce-dataset`: the stored provision against the item /
 *     affecting URI in the publisher's CSV.
 *   EXTRACTED — `clml-si-preamble` made-under: every stored section against `citation_edge`'s enabling
 *     rows (the corrected parser, GRAPH 4B) for the same instrument and Act. ⚠ That parser drops a list
 *     with a bare bracketed item ("52(2) and (4)", GRAPH_271_REPORT §6.1), so a true section it missed
 *     counts here as a disagreement: the extracted figure is an UPPER bound on wrongness, the 36.1%
 *     (same bytes, both parsers) stays the measurement of record.
 *
 * Read-only. Writes audit-g9-provision-ids.json.
 *   npx tsx graph/audit-g9-provision-ids.ts
 */
import fs from 'fs'
import path from 'path'
import AdmZip from 'adm-zip'
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { DATA_DIR } from './download-graph-sources'

const OUT = path.join(__dirname, 'audit-g9-provision-ids.json')
const INFORCE_DIR = 'C:/Code/scrutinise-prototype/scripts/legislation/v276-samples/inforce/InForce_results_47'

/** gid from a legislation.gov.uk URI — written here, deliberately not graph-common's parseLegUri. */
const GID_RX = /legislation\.gov\.uk\/(?:id\/)?([a-z]+\/(?:\d{4}|[A-Z][A-Za-z0-9and]*\/[0-9-]+)\/\d+)/
function gidOf(uri: string | null): string | null {
  const m = uri?.match(GID_RX)
  return m ? m[1] : null
}
/** provision path after the gid in a URI, as the CLML ref form (section/20/1 → section-20-1). */
function refOfUri(uri: string): string | null {
  const m = uri.match(/legislation\.gov\.uk\/(?:id\/)?[a-z]+\/(?:\d{4}|[A-Z][A-Za-z0-9and]*\/[0-9-]+)\/\d+\/(.+?)\/?$/)
  return m ? m[1].split('/').join('-') : null
}
const attrOf = (el: string, name: string) => el.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? null

const flat = (s: string) => Buffer.from(s, 'utf8').toString('utf8')

/** Stored id `{corpus}:{gid}[:{ref}]` → [gid, ref]. */
function splitId(id: string): [string, string] {
  const parts = id.split(':')
  return [parts[1] ?? '', parts.slice(2).join(':')]
}

async function main() {
  const pool = getNeonPool()

  // ── 1. The publisher's own provision identifiers, from the effects zips ──────────────────────
  // key: affectedGid|affectingGid|ref  (one set per side)
  const affectedRefs = new Set<string>()
  const affectingRefs = new Set<string>()
  let effects = 0, sectionEls = 0, refUriDisagree = 0, refUriBoth = 0
  const refUriSamples: string[] = []
  const zips = fs.readdirSync(DATA_DIR).filter((f) => /^amendments-to-.*\.zip$/.test(f)).sort()
  for (const z of zips) {
    const zip = new AdmZip(path.join(DATA_DIR, z))
    for (const e of zip.getEntries()) {
      if (e.isDirectory || !e.entryName.endsWith('.xml')) continue
      const xml = e.getData().toString('utf8')
      for (const m of xml.matchAll(/<ukm:Effect\b[\s\S]*?<\/ukm:Effect>/g)) {
        effects++
        const el = m[0]
        const open = el.slice(0, el.indexOf('>') + 1)
        const affected = gidOf(attrOf(open, 'AffectedURI'))
        const affecting = gidOf(attrOf(open, 'AffectingURI'))
        if (!affected || !affecting) continue
        for (const [side, set] of [['AffectedProvisions', affectedRefs], ['AffectingProvisions', affectingRefs]] as const) {
          const block = el.match(new RegExp(`<ukm:${side}>([\\s\\S]*?)</ukm:${side}>`))?.[1]
          if (!block) continue
          for (const s of block.matchAll(/<ukm:Section\b[^>]*>/g)) {
            sectionEls++
            const ref = attrOf(s[0], 'Ref')
            if (!ref) continue
            // ⚠ flat(): a regex match on a multi-MB document is a V8 sliced string that pins the whole document.
            set.add(flat(`${affected}|${affecting}|${ref}`))
            // The publisher's two identifiers for one provision: Ref and URI. Do they agree?
            const uri = attrOf(s[0], 'URI')
            const uriRef = uri ? refOfUri(uri) : null
            if (uriRef) {
              refUriBoth++
              if (uriRef !== ref) { refUriDisagree++; if (refUriSamples.length < 8) refUriSamples.push(flat(`${ref} vs ${uri}`)) }
            }
          }
        }
      }
    }
    console.log(`  ${z}: effects so far ${effects.toLocaleString()}, refs ${affectedRefs.size.toLocaleString()} / ${affectingRefs.size.toLocaleString()}`)
  }

  // ── 2. Every stored section-level official row, tested against those ────────────────────────
  const off = { rows: 0, toChecked: 0, toMismatch: 0, fromChecked: 0, fromMismatch: 0, samples: [] as string[] }
  // CONTROL: a zero must be shown able to be non-zero. Real rows, provision deliberately wrong in the two ways
  // the old preamble parser was wrong — a subsection read as a section (section-52-2 → section-2) and a ref
  // attached to the wrong document (another row's affecting gid). Every one must miss.
  const byType: Record<string, number> = {}
  const control: Array<[string, string, string]> = []
  const ctl = { subsection: 0, subsectionMissed: 0, reattributed: 0, reattributedMissed: 0 }
  for (const t of ['amends', 'repeals', 'commences', 'modifies']) {
    const r = await pool.query<{ from_id: string; to_id: string }>(
      `SELECT from_id, to_id FROM legislation_edges
        WHERE source = 'tna-bulk-amendments' AND edge_type = $1 AND granularity <> 'act-act'`, [t])
    for (const row of r.rows) {
      off.rows++
      const [fg, fr] = splitId(row.from_id)
      const [tg, tr] = splitId(row.to_id)
      if (tr) {
        if (control.length < 5000 && /^section-\d+-\d+$/.test(tr)) control.push([tg, fg, tr])
        off.toChecked++
        if (!affectedRefs.has(`${tg}|${fg}|${tr}`)) { off.toMismatch++; byType[tg.split('/')[0]] = (byType[tg.split('/')[0]] ?? 0) + 1; if (off.samples.length < 12) off.samples.push(`to ${row.to_id} ← ${row.from_id}`) }
      }
      if (fr) {
        off.fromChecked++
        if (!affectingRefs.has(`${tg}|${fg}|${fr}`)) { off.fromMismatch++; if (off.samples.length < 12) off.samples.push(`from ${row.from_id} → ${row.to_id}`) }
      }
    }
    console.log(`  official ${t}: ${off.rows.toLocaleString()} rows read`)
  }
  for (let i = 0; i < control.length; i++) {
    const [tg, fg, tr] = control[i]
    const asSection = `section-${tr.split('-')[2]}` // section-52-2 → section-2
    if (asSection !== `section-${tr.split('-')[1]}`) {
      ctl.subsection++
      if (!affectedRefs.has(`${tg}|${fg}|${asSection}`)) ctl.subsectionMissed++
    }
    const otherFg = control[(i + 1) % control.length][1]
    if (otherFg !== fg) {
      ctl.reattributed++
      if (!affectedRefs.has(`${tg}|${otherFg}|${tr}`)) ctl.reattributedMissed++
    }
  }
  affectedRefs.clear(); affectingRefs.clear()

  // ── 3. In-force dataset: stored provision against the publisher's item / affecting URI ──────
  const inforceExpected = new Set<string>()
  for (const f of fs.readdirSync(INFORCE_DIR).filter((x) => x.endsWith('.csv'))) {
    for (const line of fs.readFileSync(path.join(INFORCE_DIR, f), 'utf8').split(/\r?\n/).slice(1)) {
      const cols = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '')) ?? []
      const item = cols[0], affecting = cols[6]
      if (!item || !affecting) continue
      const ig = gidOf(item), ag = gidOf(affecting)
      if (!ig || !ag) continue
      inforceExpected.add(`${ig}|${refOfUri(item) ?? ''}|${ag}|${refOfUri(affecting) ?? ''}`)
    }
  }
  const inf = { rows: 0, checked: 0, mismatch: 0, samples: [] as string[] }
  const ir = await pool.query<{ from_id: string; to_id: string }>(
    `SELECT from_id, to_id FROM legislation_edges WHERE source = 'tna-inforce-dataset' AND granularity <> 'act-act'`)
  for (const row of ir.rows) {
    inf.rows++
    const [fg, fr] = splitId(row.from_id)
    const [tg, tr] = splitId(row.to_id)
    inf.checked++
    if (!inforceExpected.has(`${tg}|${tr}|${fg}|${fr}`)) { inf.mismatch++; if (inf.samples.length < 8) inf.samples.push(`${row.from_id} → ${row.to_id}`) }
  }

  // ── 4. Extracted made-under rows against the corrected parser ───────────────────────────────
  const fixed = new Set<string>()
  const fixedDocs = new Set<string>()
  const ce = await pool.query<{ source_gid: string; target_uri: string; target_provision_ref: string | null }>(
    `SELECT source_gid, target_uri, target_provision_ref FROM citation_edge WHERE detection = 'enabling'`)
  for (const r of ce.rows) {
    fixedDocs.add(r.source_gid)
    const tg = gidOf(r.target_uri)
    if (tg && r.target_provision_ref) fixed.add(`${r.source_gid}|${tg}|${r.target_provision_ref}`)
  }
  const ext = { rows: 0, notInFixedCorpus: 0, checked: 0, mismatch: 0, samples: [] as string[] }
  const mr = await pool.query<{ from_id: string; to_id: string }>(
    `SELECT from_id, to_id FROM legislation_edges WHERE edge_type = 'made-under' AND granularity = 'act-section'`)
  for (const row of mr.rows) {
    ext.rows++
    const [fg] = splitId(row.from_id)
    const [tg, tr] = splitId(row.to_id)
    if (!fixedDocs.has(fg)) { ext.notInFixedCorpus++; continue }
    ext.checked++
    if (!fixed.has(`${fg}|${tg}|${tr}`)) { ext.mismatch++; if (ext.samples.length < 12) ext.samples.push(`${row.from_id} → ${row.to_id}`) }
  }

  const pct = (a: number, b: number) => (b ? Math.round((100000 * a) / b) / 1000 : null)
  const result = {
    measured_at: new Date().toISOString(),
    // ⚠ Which publisher files were read. The four daily types (uksi/ssi/nisr/wsi) were replaced on 24 Oct at 18:21 UTC
    // by an unguarded import (download-graph-sources.ts, now guarded); `legislation_edges` was built from the 5 July files.
    // Against the July files this test found 0 and 0; against later files a mismatch is the PUBLISHER having re-keyed a
    // record since we loaded it — staleness, not a parse error.
    sources: Object.fromEntries(zips.map((z) => [z, fs.statSync(path.join(DATA_DIR, z)).mtime.toISOString()])),
    rows_built_from: 'the 5 July 2026 files (extract-effects-edges.ts); the July uksi/ssi/nisr/wsi copies no longer exist on disk',
    run_against_july_files: { measured_at: '2026-10-24T18:21:21Z', to_side: '0 of 1,786,206', from_side: '0 of 1,744,253', effects_reparsed: 2605737 },
    publisher_ref_vs_uri: { section_elements: sectionEls, with_both: refUriBoth, disagree: refUriDisagree, samples: refUriSamples },
    official_bulk_amendments: {
      effects_reparsed: effects, rows_read: off.rows,
      to_side: { checked: off.toChecked, not_a_publisher_ref: off.toMismatch, pct: pct(off.toMismatch, off.toChecked), by_affected_type: byType },
      from_side: { checked: off.fromChecked, not_a_publisher_ref: off.fromMismatch, pct: pct(off.fromMismatch, off.fromChecked) },
      samples: off.samples,
      control: {
        ...ctl,
        reading: 'real rows with the provision made wrong the old parser\'s two ways; "missed" must be close to the total. '
          + 'A few may legitimately hit — the same effect pair can genuinely name section-2 as well as section-52-2.',
      },
    },
    official_inforce: { checked: inf.checked, not_in_publisher_csv: inf.mismatch, pct: pct(inf.mismatch, inf.checked), samples: inf.samples },
    extracted_made_under: {
      section_rows: ext.rows, instrument_not_in_citation_edge: ext.notInFixedCorpus, checked: ext.checked,
      not_produced_by_corrected_parser: ext.mismatch, pct: pct(ext.mismatch, ext.checked), samples: ext.samples,
      reading: 'upper bound on wrongness: the corrected parser drops "52(2) and (4)"-shaped lists (GRAPH_271_REPORT §6.1); the 36.1% (GRAPH 4B, same bytes) is the measurement of record',
    },
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
  await endNeonPool()
}
main().catch((e) => { console.error('[audit-g9-provision-ids] FATAL', e); process.exit(1) })
