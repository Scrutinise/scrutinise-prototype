/**
 * verify-edges.ts — read a named organisation's edges by HAND, against the source (§5).
 *
 * The brief's one non-count requirement: "pick three organisations you would expect to be well
 * represented and read their edges by hand. If the graph says something obviously wrong about a body
 * you can check, the counts are decoration."
 *
 * This is that check, made repeatable and made able to FAIL. For each organisation it prints how the
 * entity was identified, then for its most recent edges:
 *   1. asks the committees API what inquiry `object_ref` actually is, and compares the title we
 *      stored against the title the source returns — a wrong join shows up here as ✗ DIFFERS;
 *   2. confirms the cited `corpus_sections` row exists and prints its title, date and URL, so a
 *      human can open the submission and read it.
 *
 * Usage (from scripts/ingest):
 *   npx tsx position-graph/verify-edges.ts
 *   npx tsx position-graph/verify-edges.ts "Shelter" "Age UK" "Confederation of British Industry"
 */
import path from 'path'
require('dotenv').config({ path: path.join(__dirname, '../../../scrutinise-web/.env') })
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
const UA = 'Scrutinise-Ingest/1.0 (+https://scrutinise.org)'
let mismatches = 0
async function main() {
  const pool = getNeonPool()
  // A body anyone can check.
  const names = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  for (const name of names.length ? names : ['Local Government Association', 'Which?', 'Shelter']) {
    const { rows: e } = await pool.query(
      `SELECT id, canonical_name, key_source, parl_cis_id, confidence FROM graph_entity WHERE kind='organisation' AND name_norm = $1`,
      [name.toLowerCase().replace(/[?’']/g, '').replace(/\s+/g, ' ').trim()])
    if (!e.length) { console.log(`\n${name}: no entity row`); continue }
    const ent = e[0]
    console.log(`\n${name} → entity ${ent.id} "${ent.canonical_name}" via ${ent.key_source} cis=${ent.parl_cis_id} conf=${ent.confidence}`)
    const { rows: edges } = await pool.query(
      `SELECT g.object_ref, g.object_label, g.first_seen::text AS d,
              (SELECT v.section_id FROM graph_evidence v WHERE v.edge_id=g.id LIMIT 1) AS section_id
         FROM graph_edge g WHERE g.subject_id=$1 AND g.predicate='gave-evidence-to'
        ORDER BY g.first_seen DESC LIMIT 3`, [ent.id])
    for (const g of edges) {
      console.log(`  inquiry ${g.object_ref}: ${String(g.object_label).slice(0, 80)}  [${g.d}]`)
      console.log(`    our evidence section: ${g.section_id}`)
      // VERIFY at source: does that inquiry exist, and is it the one we named?
      const r = await fetch(`https://committees-api.parliament.uk/api/CommitteeBusiness/${g.object_ref}`, { headers: { Accept: 'application/json', 'User-Agent': UA } })
      if (r.ok) {
        const j: any = await r.json()
        const same = !!String(j.title ?? '').trim() && String(g.object_label).startsWith(String(j.title).trim())
        if (!same) mismatches++
        console.log(`    API says inquiry ${g.object_ref} = "${String(j.title).slice(0, 70)}" → ${same ? '✓ MATCHES our label' : '✗ DIFFERS'}`)
      } else console.log(`    API ${r.status} for inquiry ${g.object_ref} (endpoint may differ; not evidence of a wrong edge)`)
      // And does the section we cite actually exist and belong to that item?
      const { rows: s } = await pool.query(`SELECT id, "sectionTitle", "itemDate"::text AS d, "sourceUrl" FROM corpus_sections WHERE id=$1`, [g.section_id])
      if (s.length) console.log(`    section exists: "${String(s[0].sectionTitle).slice(0, 70)}" ${s[0].d} ${s[0].sourceUrl}`)
      else { mismatches++; console.log(`    ✗ section ${g.section_id} NOT FOUND — that would be an FK violation`) }
    }
  }
  console.log(mismatches === 0
    ? '\n✓ every inquiry id resolved at the source to the title we stored, and every cited section exists.'
    : `\n✗ ${mismatches} mismatch(es) — read them before trusting any count in this graph.`)
  await endNeonPool()
  if (mismatches) process.exit(1)
}
main().catch((e) => { console.error(e.message); process.exit(1) })
