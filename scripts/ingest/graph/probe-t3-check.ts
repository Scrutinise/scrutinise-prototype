/** probe-t3-check.ts — read the gate file back and check the Supreme Court answer
 *  is about JURISDICTION and not an incidental mention. */
import fs from 'fs'
import path from 'path'
const d = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../docs/report_run/gates_WS-05.json'), 'utf8'))
const sc = d.supreme_court_devolution_jurisdiction
for (const s of sc.schedules) {
  console.log(`\n===== ${s.act_title} ${s.provision_ref} — SC×${s.mentions_supreme_court} JC×${s.mentions_judicial_committee}, ${s.sentences_naming_a_court.length} windows =====`)
  for (const q of s.sentences_naming_a_court.slice(0, 3)) console.log(`  · …${q.replace(/\s+/g,' ').slice(0, 420)}…\n`)
}
console.log('\n===== devolution items =====')
for (const i of d.devolution.items) console.log(`  ${i.act_gid} ${i.provision_ref} v=${i.document_version} words=${i.words} heading=${JSON.stringify(i.heading)} brief=${i.named_in_brief} fail=${i.retrieval_failure}`)
console.log('\n===== NI items =====')
for (const i of d.northern_ireland.items) console.log(`  ${i.provision_ref} words=${i.words} heading=${JSON.stringify(i.heading)}`)
console.log('\n===== CRAG enabling powers conferred =====')
for (const p of d.instrument_allocation.powers) console.log(`  ${p.power_provision_ref ?? '(none named)'} — ${p.instrument_count} instrument(s); power text: ${(p.power_text ?? 'NOT RETRIEVED').slice(0,180)}`)
console.log('\n===== inbound from devolution Acts to CRAG =====')
for (const r of d.devolution.inbound_from_the_devolution_acts.rows) console.log(`  ${r.source_gid}:${r.source_provision_ref} [${r.detection}] → ${r.target_provision_ref}\n     "${r.citation_text.slice(-190)}"`)
