/**
 * probe-misattribution.ts — is the 19.1% real, or is it my own measurement?
 *
 * The attribution test anchors on the Act's NAME only. A markup citation can
 * name the target by URI with no name in the provision at all
 * (`<Citation URI=".../ukpga/2010/15">the 2010 Act</Citation>`), which this
 * would call MISATTRIBUTED when the provision plainly does carry the reference.
 * Measure both ways before anything is reported.
 */
import fs from 'fs'
import path from 'path'
import { readDocVersion, provisionSlice, flattenClml, actNameRegex, closeZip } from './report-common'

const DIR = path.join(__dirname, '../../../docs/report_run')
const TITLES: Record<string, string> = {
  'WS-05': 'Constitutional Reform and Governance Act 2010',
  'WS-01': 'Human Rights Act 1998',
  'WS-04': 'Equality Act 2010',
}
const GIDS: Record<string, string> = { 'WS-05': 'ukpga/2010/25', 'WS-01': 'ukpga/1998/42', 'WS-04': 'ukpga/2010/15' }

let nameOnly = 0, nameOrUri = 0, total = 0
const byDet: Record<string, { nameOnly: number; nameOrUri: number; n: number }> = {}
const rescued: any[] = []
const survive: any[] = []

for (const ws of Object.keys(TITLES)) {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, `${ws}_provisions.json`), 'utf8'))
  for (const r of d.referring_provisions.rows) {
    if (r.provision_attribution !== 'MISATTRIBUTED') continue
    total++
    const b = byDet[r.detection] ??= { nameOnly: 0, nameOrUri: 0, n: 0 }
    b.n++
    const xml = readDocVersion(r.source_gid, r.document_version)
    const slice = xml ? provisionSlice(xml, r.source_provision_ref) : null
    if (!slice) { survive.push({ ...r, why: 'provision slice not found at all' }); continue }
    const rx = actNameRegex(TITLES[ws])
    const byName = rx.test(flattenClml(slice))
    const byUri = slice.includes(`/${GIDS[ws]}`) || slice.includes(GIDS[ws])
    if (byName) { nameOnly++; b.nameOnly++ }
    if (byName || byUri) { nameOrUri++; b.nameOrUri++; if (!byName) rescued.push({ ws, gid: r.source_gid, ref: r.source_provision_ref, det: r.detection }) }
    else survive.push({ ws, gid: r.source_gid, ref: r.source_provision_ref, det: r.detection, ct: r.citation_text.slice(0, 150) })
  }
}
console.log(`rows currently marked MISATTRIBUTED: ${total}`)
console.log(`  of those, the named provision DOES contain the Act name after re-test : ${nameOnly}`)
console.log(`  of those, it contains the name OR the target URI                      : ${nameOrUri}  ← the honest test`)
console.log(`  rescued by adding the URI test                                        : ${rescued.length}`)
console.log(`  still misattributed                                                   : ${survive.length}`)
console.log('\nby detection:')
for (const [k, v] of Object.entries(byDet)) console.log(`  ${k.padEnd(9)} ${v.n} marked, ${v.nameOrUri} actually contain the reference`)
console.log('\nfirst 6 rescued by the URI test:')
for (const r of rescued.slice(0, 6)) console.log(`  ${r.ws} ${r.gid}:${r.ref} [${r.det}]`)
console.log('\nfirst 6 that survive:')
for (const r of survive.slice(0, 6)) console.log(`  ${r.ws ?? ''} ${r.gid ?? r.source_gid}:${r.ref ?? r.source_provision_ref} [${r.det ?? r.detection}] ${r.why ?? ''}\n      "${(r.ct ?? '').slice(0, 140)}"`)
closeZip()
