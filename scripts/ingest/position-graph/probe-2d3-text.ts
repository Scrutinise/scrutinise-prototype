/**
 * probe-2d3-text.ts — read the actual bytes of three submissions before designing anything on top
 * of them (docs/CLAUDE.md §0, §13). Reads only.
 */
import path from 'path'
try { require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') }) } catch { /* ok */ }
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { r2Get } from '../shared/r2-client'

export {}

async function main() {
  const pool = getNeonPool()
  try {
    const { rows } = await pool.query<{ id: string; t: string; w: number; k: string; d: string; url: string; org: string }>(`
      SELECT c.id, c."sectionTitle" t, c."wordCount" w, c."r2Key" k, c."itemDate"::text d, c."sourceUrl" url,
             (SELECT string_agg(DISTINCT en.canonical_name, ' | ') FROM graph_evidence gv2
                JOIN graph_edge ge2 ON ge2.id = gv2.edge_id JOIN graph_entity en ON en.id = ge2.subject_id
               WHERE gv2.section_id = c.id) org
      FROM corpus_sections c
      WHERE c.id IN (
        SELECT gv.section_id FROM graph_edge ge JOIN graph_evidence gv ON gv.edge_id = ge.id
        WHERE ge.predicate='gave-evidence-to' AND ge.object_label LIKE 'Prevention in health and social care%')
      ORDER BY c."wordCount" DESC LIMIT 3`)
    for (const r of rows) {
      console.log('\n════════════════════════════════════════════════════════════════')
      console.log(`${r.id}\n  title=${r.t}  words=${r.w}  date=${r.d}\n  org(s)=${r.org}\n  url=${r.url}`)
      const txt = await r2Get(r.k)
      console.log(`  r2 bytes=${txt ? txt.length : 'NULL'}`)
      if (txt) console.log('  ---- first 1200 chars ----\n' + txt.slice(0, 1200).replace(/^/gm, '  | '))
    }
  } finally { await endNeonPool() }
}
main().catch((e) => { console.error('[probe-2d3-text] FATAL', e instanceof Error ? e.message : e); process.exit(1) })
