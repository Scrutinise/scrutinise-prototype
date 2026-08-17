/**
 * probe-2d3-header.ts — BRIEF_GRAPH_2D3_CONTINUED §4: the submitter's own name is in the document.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * `schema-amd2.sql` records, correctly, that `corpus_sections.speaker` is NULL on committees-evidence
 * and concludes that a per-appearance surface cannot be supplied, so `graph_mention` shows the
 * ENTITY's canonical name and says so in `surface_is_per_entity`.
 *
 * That conclusion is true of the DATABASE and false of the DOCUMENT. Committee written evidence
 * opens with the submitter's own words — *"Written evidence submitted by NHS Providers (PHS0616)"* —
 * and the compiled text is in R2, which the position extractor is already reading end to end.
 *
 * This probe MEASURES rather than asserts:
 *   · how often a header is parseable at all
 *   · how often the document's name and the committees-API submitter AGREE
 *   · how often they DISAGREE, and whether the disagreement is a spelling or a different body
 *
 * ⚠ It builds nothing. The mention layer belongs to the Amendment 2 session; this is the evidence
 * handed to it, so that a source recorded as absent is not re-discovered expensively in a month.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/probe-2d3-header.ts [--sample 600] [--show 15]
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }

import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { getDocText, parseDocumentHeader } from './text-2d3'
import { normaliseName } from './graph-common'
import { mapLimit } from './llm-2d3'

export {}

const argv = process.argv.slice(2)
const num = (n: string, d: number) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? parseInt(argv[i + 1], 10) : d }
const SAMPLE = num('sample', 600)
const SHOW = num('show', 15)

/** Same-body-different-spelling, or a different body? Decided mechanically, never by eye. */
export function relation(docName: string, apiNames: string[]): 'exact' | 'spelling' | 'contains' | 'different' {
  const d = normaliseName(docName)
  for (const a of apiNames) {
    const n = normaliseName(a)
    if (d === n) return 'exact'
  }
  for (const a of apiNames) {
    const n = normaliseName(a)
    if (!n || !d) continue
    if (d.includes(n) || n.includes(d)) return 'contains'
    // A shared distinctive word is a spelling variant; nothing shared is a different body.
    const dw = new Set(d.split(' ').filter((w) => w.length > 3))
    const nw = n.split(' ').filter((w) => w.length > 3)
    const shared = nw.filter((w) => dw.has(w)).length
    if (shared >= 2 || (shared >= 1 && Math.min(dw.size, nw.length) <= 2)) return 'spelling'
  }
  return 'different'
}

async function main() {
  const pool = getNeonPool()
  try {
    const { rows } = await pool.query<{ section_id: string; r2key: string; api_names: string[] }>(`
      SELECT c.id AS section_id, c."r2Key" AS r2key,
             ARRAY(SELECT DISTINCT en.canonical_name
                     FROM graph_evidence gv JOIN graph_edge ge ON ge.id = gv.edge_id
                     JOIN graph_entity en ON en.id = ge.subject_id
                    WHERE gv.section_id = c.id) AS api_names
      FROM corpus_sections c
      WHERE c.corpus='committees-evidence' AND c."r2Key" IS NOT NULL AND c.status='compiled'
        AND c.id LIKE 'committees-evidence:writtenevidence:%'
      ORDER BY md5(c.id) LIMIT $1`, [SAMPLE])

    console.log(`\n════ §4 — IS THE SUBMITTER'S OWN NAME IN THE DOCUMENT? ════`)
    console.log(`  ${rows.length} written-evidence documents drawn at random (md5 order) and read from R2.\n`)

    const stats = { read: 0, unreadable: 0, header: 0, noHeader: 0, noApiName: 0,
      exact: 0, spelling: 0, contains: 0, different: 0, ref: 0 }
    const diffs: Array<{ id: string; doc: string; api: string }> = []

    await mapLimit(rows, 12, async (r) => {
      const t = await getDocText(r.r2key)
      if (!t) { stats.unreadable++; return }
      stats.read++
      const h = parseDocumentHeader(t)
      if (h.reference) stats.ref++
      if (!h.submitter) { stats.noHeader++; return }
      stats.header++
      if (!r.api_names.length) { stats.noApiName++; return }
      const rel = relation(h.submitter, r.api_names)
      stats[rel]++
      if (rel === 'different' && diffs.length < 200) diffs.push({ id: r.section_id, doc: h.submitter, api: r.api_names.join(' | ') })
    })

    const pct = (n: number, d: number) => `${(100 * n / Math.max(1, d)).toFixed(1)}%`
    console.log(`  documents read from R2                 ${stats.read}`)
    console.log(`  unreadable                             ${stats.unreadable}`)
    console.log(`  ── header parsed ──`)
    console.log(`  a submitter name in the opening line   ${stats.header}   ${pct(stats.header, stats.read)}   ← the source recorded as absent`)
    console.log(`  no parseable header                    ${stats.noHeader}   ${pct(stats.noHeader, stats.read)}`)
    console.log(`  an internal reference too (PHS0616)    ${stats.ref}   ${pct(stats.ref, stats.read)}`)
    const cmp = stats.exact + stats.spelling + stats.contains + stats.different
    console.log(`  ── document name vs committees-API submitter (${cmp} comparable) ──`)
    console.log(`  identical after normalisation          ${stats.exact}   ${pct(stats.exact, cmp)}`)
    console.log(`  one contains the other                 ${stats.contains}   ${pct(stats.contains, cmp)}`)
    console.log(`  a spelling variant                     ${stats.spelling}   ${pct(stats.spelling, cmp)}`)
    console.log(`  ⚠ A DIFFERENT BODY ENTIRELY            ${stats.different}   ${pct(stats.different, cmp)}   ← not two spellings`)
    console.log(`  documents with no API submitter at all  ${stats.noApiName}`)

    console.log(`\n  the first ${Math.min(SHOW, diffs.length)} disagreements, so the class can be judged rather than trusted:`)
    for (const d of diffs.slice(0, SHOW)) {
      console.log(`    ${d.id}`)
      console.log(`      document : ${d.doc}`)
      console.log(`      graph    : ${d.api}`)
    }
    console.log(`\n  ⚠ Nothing here is written to the database. The mention layer is the Amendment 2`)
    console.log(`    session's; this is the evidence that the source it recorded as unavailable is not.`)
  } finally { await endNeonPool() }
}
// ⚠ GUARDED: this module exports helpers, and an unguarded main() means an IMPORT runs the
// script. trial-positions.ts imports prefixKey from extract-positions and triggered its $8.51
// population report mid-trial. A module that does work on import cannot be reused.
if (require.main === module) main().catch((e) => { console.error('[probe-2d3-header] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
