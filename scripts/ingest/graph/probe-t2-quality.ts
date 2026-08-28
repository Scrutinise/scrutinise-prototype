/** probe-t2-quality.ts — read the T2 output back and look at what it actually says. */
import fs from 'fs'
import path from 'path'
const DIR = path.join(__dirname, '../../../docs/report_run')

for (const ws of ['WS-05', 'WS-01', 'WS-04']) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, `${ws}_provisions.json`), 'utf8'))
  const rows = d.referring_provisions.rows
  console.log(`\n########## ${ws} ##########`)
  // longest and shortest complete provision-text sentences
  const pt = rows.filter((r: any) => r.sentence_source === 'provision-text' && r.sentence_complete)
  pt.sort((a: any, b: any) => a.quoted_sentence.length - b.quoted_sentence.length)
  console.log(`\n--- SHORTEST complete provision-text sentence (${pt[0].quoted_sentence.length} ch) ---`)
  console.log(`  ${pt[0].source_gid}:${pt[0].source_provision_ref} [${pt[0].detection}] → ${pt[0].target_provision_ref}`)
  console.log(`  "${pt[0].quoted_sentence}"`)
  const mid = pt[Math.floor(pt.length / 2)]
  console.log(`\n--- MEDIAN complete provision-text sentence (${mid.quoted_sentence.length} ch) ---`)
  console.log(`  ${mid.source_gid}:${mid.source_provision_ref} [${mid.detection}] → ${mid.target_provision_ref}`)
  console.log(`  "${mid.quoted_sentence}"`)
  const long = pt[pt.length - 1]
  console.log(`\n--- LONGEST complete provision-text sentence (${long.quoted_sentence.length} ch) ---`)
  console.log(`  ${long.source_gid}:${long.source_provision_ref} [${long.detection}]`)
  console.log(`  "${long.quoted_sentence.slice(0, 700)}${long.quoted_sentence.length > 700 ? ' …[TRUNCATED IN THIS PROBE ONLY]' : ''}"`)

  const inc = rows.filter((r: any) => !r.sentence_complete)
  console.log(`\n--- INCOMPLETE: ${inc.length} ---`)
  for (const r of inc.slice(0, 2)) {
    console.log(`  ${r.source_gid}:${r.source_provision_ref} [${r.detection}] src=${r.sentence_source}`)
    console.log(`    note: ${r.note}`)
    console.log(`    "${(r.quoted_sentence ?? '').slice(0, 300)}…"`)
  }
  const dt = rows.filter((r: any) => r.sentence_source === 'document-text')
  console.log(`\n--- WIDENED TO DOCUMENT: ${dt.length} ---`)
  for (const r of dt.slice(0, 2)) {
    console.log(`  ${r.source_gid}:${r.source_provision_ref} [${r.detection}] occurrences=${r.name_occurrences}`)
    console.log(`    "${(r.quoted_sentence ?? '').slice(0, 300)}"`)
  }
  const rf = rows.filter((r: any) => r.sentence_source === 'raw-fragment')
  if (rf.length) {
    console.log(`\n--- FROM THE STORED FRAGMENT: ${rf.length} ---`)
    for (const r of rf.slice(0, 2)) {
      console.log(`  ${r.source_gid}:${r.source_provision_ref} [${r.detection}] note=${r.note}`)
      console.log(`    "${(r.quoted_sentence ?? '').slice(0, 260)}"`)
    }
  }
  // target provisions sanity
  const tp = d.target_provisions.provisions
  console.log(`\n--- TARGET PROVISIONS: ${tp.length}; first two ---`)
  for (const p of tp.slice(0, 2)) console.log(`  ${p.ref} n=${p.number} heading="${p.heading}" words=${p.words}\n     ${p.text.slice(0, 220)}…`)
  const noText = tp.filter((p: any) => p.words < 5)
  console.log(`  provisions with under 5 words: ${noText.length}${noText.length ? ' → ' + noText.slice(0,5).map((p:any)=>p.ref).join(', ') : ''}`)
}
