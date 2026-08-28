/** probe-t5-failure.ts — the one row the supplementary draw marked WRONG.
 *  Establish WHAT is wrong before anything is reported about it. */
import { getNeonPool, endNeonPool } from '../shared/neon-pool'
import { CITATION_TABLE } from './setup-citation-edge-table'
import { readDocWithVersion, provisionSlice, flattenClml, closeZip, versionsHeld } from './report-common'

async function main() {
  const pool = getNeonPool()
  const { rows } = await pool.query(
    `SELECT * FROM ${CITATION_TABLE}
     WHERE source_gid = 'uksi/2014/560' AND source_provision_ref = 'schedule-3-paragraph-17'`)
  console.log(`rows on that provision: ${rows.length}`)
  for (const r of rows) {
    console.log(`\n  detection=${r.detection} target_act_id=${r.target_act_id} target_provision_ref=${r.target_provision_ref}`)
    console.log(`  target_uri = ${r.target_uri}`)
    console.log(`  citation_text = ${JSON.stringify(r.citation_text)}`)
    console.log(`  raw_fragment  = ${JSON.stringify(r.raw_fragment).slice(0, 900)}`)
    console.log(`  extracted_from = ${r.extracted_from}`)
  }
  // what does OUR copy of the provision actually say?
  console.log(`\n--- our copy of uksi/2014/560 (versions: ${versionsHeld('uksi/2014/560').join('/')}) ---`)
  const d = readDocWithVersion('uksi/2014/560')
  if (d) {
    const s = provisionSlice(d.xml, 'schedule-3-paragraph-17')
    console.log(`  provision found: ${s != null}`)
    if (s) {
      console.log(`  text: ${flattenClml(s).slice(0, 600)}`)
      const cits = [...s.matchAll(/<(Citation|CitationSubRef)\b[^>]*URI="([^"]+)"[^>]*>/g)]
      console.log(`  Citation/CitationSubRef URIs in this provision:`)
      for (const c of cits) console.log(`     ${c[1]}: ${c[2]}`)
    }
  }
  // does HRA 1998 even have a section 67?
  const h = readDocWithVersion('ukpga/1998/42')
  if (h) {
    console.log(`\n--- does the Human Rights Act 1998 have a section 67? ---`)
    console.log(`  provisionSlice(section-67): ${provisionSlice(h.xml, 'section-67') != null}`)
    const secs = [...new Set([...h.xml.matchAll(/<P1\b[^>]*\sid="(section-[^"]+)"/g)].map(m => m[1]))]
    console.log(`  its sections: ${secs.join(', ')}`)
  }
  await endNeonPool(); closeZip()
}
main().catch(e => { console.error(e); process.exit(1) })
